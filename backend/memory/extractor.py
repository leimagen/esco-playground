import asyncio
import json
import logging
import re
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import SessionLocal, MemoryFact, Message
from memory.vector_store import upsert_facts
import httpx
from config import settings

logger = logging.getLogger("esco.memory.extractor")

EXTRACT_PROMPT = """Read this conversation and extract ONLY concrete, personal facts about the HUMAN USER (not the AI agent).
Only include facts that would be useful to remember about the user in future conversations.
Do NOT extract facts about the agent, generic statements, or conversational filler.
Return ONLY a JSON array. Max 3 facts. If nothing personal and concrete was said, return [].

Good facts: name, location, job, hobby, preference, goal, project.
Bad facts: anything about the agent, meta-commentary, generic phrases.

Each fact: {{"s":"el usuario","p":"verb phrase","o":"specific value","c":0.85}}

Conversation:
{conversation}

JSON only, no markdown:"""


async def extract_and_store(agent_id: int, user_content: str, assistant_content: str) -> None:
    conversation = f"Usuario: {user_content}\nAgente: {assistant_content}"
    prompt = EXTRACT_PROMPT.format(conversation=conversation)

    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=60.0) as client:
            resp = await client.post("/api/chat", json={
                "model": settings.background_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            })
            resp.raise_for_status()
            response = resp.json()["message"]["content"]

        raw = response.strip()
        # Strip markdown code fences
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        # Fix common malformed patterns like `0 end=0.9` → `0.9`
        raw = re.sub(r'\d+\s+end=(\d+\.?\d*)', r'\1', raw)
        raw = re.sub(r'"confidence":\s*\d+\s+', '"confidence": 0.8, ', raw)

        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return

        try:
            facts_raw = json.loads(raw[start:end])
        except json.JSONDecodeError:
            # Try to salvage individual objects
            import re as _re
            objects = _re.findall(r'\{[^{}]+\}', raw[start:end])
            facts_raw = []
            for obj_str in objects:
                try:
                    facts_raw.append(json.loads(obj_str))
                except Exception:
                    pass

        if not isinstance(facts_raw, list) or not facts_raw:
            return

        chroma_facts = []
        db_facts = []
        for f in facts_raw[:4]:
            if not isinstance(f, dict):
                continue
            # Accept both long keys (subject/predicate/object) and short (s/p/o)
            subject = str(f.get("subject") or f.get("s", "el usuario"))
            predicate = str(f.get("predicate") or f.get("p", "mencionó"))
            obj = str(f.get("object") or f.get("o") or f.get("obj", ""))
            try:
                confidence = float(f.get("confidence") or f.get("c", 0.8))
            except (TypeError, ValueError):
                confidence = 0.8
            if not subject or not obj:
                continue

            chroma_id = f"agent{agent_id}_{uuid.uuid4().hex[:12]}"
            chroma_facts.append({
                "chroma_id": chroma_id,
                "subject": subject,
                "predicate": predicate,
                "object": obj,
                "confidence": confidence,
            })
            db_facts.append(MemoryFact(
                agent_id=agent_id,
                chroma_id=chroma_id,
                subject=subject,
                predicate=predicate,
                object=obj,
                confidence=confidence,
            ))

        if chroma_facts:
            upsert_facts(agent_id, chroma_facts)
            async with SessionLocal() as db:
                for fact in db_facts:
                    db.add(fact)
                await db.commit()
            logger.info(f"Stored {len(chroma_facts)} memory facts for agent {agent_id}")

    except json.JSONDecodeError:
        pass
    except Exception as e:
        logger.warning(f"Memory extraction error for agent {agent_id}: {e}")


def schedule_extraction(agent_id: int, user_content: str, assistant_content: str) -> None:
    asyncio.create_task(extract_and_store(agent_id, user_content, assistant_content))

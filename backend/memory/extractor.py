import asyncio
import json
import logging
import re
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import SessionLocal, MemoryFact
from memory.vector_store import upsert_facts
import httpx
from config import settings

logger = logging.getLogger("esco.memory.extractor")

EXTRACT_PROMPT = """Extract concrete, memorable facts from this conversation. Output ONLY a JSON array in English. Max 4 facts. Return [] if nothing memorable.

SUBJECT RULES — identify exactly who each fact is about:
- If a person gives their name, use that name as subject (e.g. "Luis", "María")
- If the user has not given their name, use "the user"
- If the conversation is about a specific agent (e.g. David, Ana), use that agent's name
- If about a third party mentioned, use their name or role

Only extract: real names, locations, jobs, skills, hobbies, preferences, ongoing projects, relationships.
Skip: agent self-descriptions, greetings, meta-conversation, things already obvious from context.
NEVER use "el usuario" or any Spanish — output must be English only.

Format: [{{"s":"exact subject name","p":"short verb phrase","o":"specific value","c":0.85}}]

Conversation:
{conversation}

JSON array only, no markdown, no explanation:"""


async def extract_and_store(
    agent_id: int,
    user_content: str,
    assistant_content: str,
    known_names: list[str] | None = None,
) -> None:
    conversation = f"User: {user_content}\nAgent: {assistant_content}"
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
        # Fix common malformed patterns
        raw = re.sub(r'"confidence":\s*\d+\s+\S+\s*(\d+\.?\d*)', r'"confidence": \1', raw)

        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return

        try:
            facts_raw = json.loads(raw[start:end])
        except json.JSONDecodeError:
            objects = re.findall(r'\{[^{}]+\}', raw[start:end])
            facts_raw = []
            for obj_str in objects:
                try:
                    facts_raw.append(json.loads(obj_str))
                except Exception:
                    pass

        if not isinstance(facts_raw, list) or not facts_raw:
            return

        # Build a set of known agent names to validate subjects
        known_lower = {n.lower() for n in (known_names or [])}
        GENERIC_SUBJECTS = {"el usuario", "the user", "user", "usuario", "the agent", "the assistant"}

        chroma_facts = []
        db_facts = []
        for f in facts_raw[:4]:
            if not isinstance(f, dict):
                continue
            subject = str(f.get("s") or f.get("subject", "the user")).strip()
            predicate = str(f.get("p") or f.get("predicate", "mentioned")).strip()

            raw_obj = f.get("o") or f.get("object") or f.get("obj", "")
            # Reject boolean/null objects (model hallucination)
            if isinstance(raw_obj, bool) or raw_obj is None:
                continue
            obj = str(raw_obj).strip()

            try:
                confidence = float(f.get("c") or f.get("confidence", 0.8))
            except (TypeError, ValueError):
                confidence = 0.8

            if not subject or not obj or len(obj) < 2 or obj.lower() in ("true", "false", "null", "none"):
                continue

            # If predicate is very long and contains the object info, split it
            if len(predicate) > 60:
                predicate = predicate[:60].rsplit(" ", 1)[0]

            # Normalize generic subjects to "the user" (English)
            if subject.lower() in GENERIC_SUBJECTS:
                subject = "the user"

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
            logger.info(f"Stored {len(chroma_facts)} facts for agent {agent_id}: {[(f['subject'], f['object']) for f in chroma_facts]}")

    except json.JSONDecodeError:
        pass
    except Exception as e:
        logger.warning(f"Memory extraction error for agent {agent_id}: {e}")


def schedule_extraction(
    agent_id: int,
    user_content: str,
    assistant_content: str,
    known_names: list[str] | None = None,
) -> None:
    asyncio.create_task(
        extract_and_store(agent_id, user_content, assistant_content, known_names)
    )

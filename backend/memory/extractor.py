import asyncio
import json
import logging
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import SessionLocal, MemoryFact, Message
from memory.vector_store import upsert_facts
import httpx
from config import settings

logger = logging.getLogger("esco.memory.extractor")

EXTRACT_PROMPT = """Analiza esta conversación y extrae hechos concretos sobre el USUARIO (no sobre el agente).
Solo extrae datos que valga la pena recordar en futuras conversaciones.
Responde SOLO con un array JSON. Máximo 4 hechos. Si no hay nada relevante, responde [].

Formato:
[
  {{"subject": "el usuario", "predicate": "sujeto/verbo corto", "object": "dato específico", "confidence": 0.8}}
]

Conversación:
{conversation}

Responde solo el JSON:"""


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
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return

        facts_raw = json.loads(raw[start:end])
        if not isinstance(facts_raw, list) or not facts_raw:
            return

        chroma_facts = []
        db_facts = []
        for f in facts_raw[:4]:
            if not isinstance(f, dict):
                continue
            subject = str(f.get("subject", ""))
            predicate = str(f.get("predicate", ""))
            obj = str(f.get("object", ""))
            confidence = float(f.get("confidence", 0.8))
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

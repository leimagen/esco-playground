import uuid
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import SessionLocal, MemoryFact
from memory.vector_store import list_all_facts, upsert_facts, delete_fact
from sqlalchemy import select, delete as sql_delete

logger = logging.getLogger("esco.memory.router")
router = APIRouter()


class MemoryFactResponse(BaseModel):
    chroma_id: str
    subject: str
    predicate: str
    object: str
    confidence: float
    text: str


class AddMemoryPayload(BaseModel):
    subject: str
    predicate: str
    object: str
    confidence: float = 0.9


@router.get("/memory/{agent_id}", response_model=list[MemoryFactResponse])
async def list_memories(agent_id: int):
    facts = list_all_facts(agent_id)
    return [
        MemoryFactResponse(
            chroma_id=f["chroma_id"],
            subject=f["subject"],
            predicate=f["predicate"],
            object=f["object"],
            confidence=f["confidence"],
            text=f["text"],
        )
        for f in facts
    ]


@router.post("/memory/{agent_id}", response_model=MemoryFactResponse)
async def add_memory(agent_id: int, payload: AddMemoryPayload):
    chroma_id = f"agent{agent_id}_manual_{uuid.uuid4().hex[:12]}"
    fact = {
        "chroma_id": chroma_id,
        "subject": payload.subject,
        "predicate": payload.predicate,
        "object": payload.object,
        "confidence": payload.confidence,
    }
    upsert_facts(agent_id, [fact])

    async with SessionLocal() as db:
        db_fact = MemoryFact(
            agent_id=agent_id,
            chroma_id=chroma_id,
            subject=payload.subject,
            predicate=payload.predicate,
            object=payload.object,
            confidence=payload.confidence,
        )
        db.add(db_fact)
        await db.commit()

    logger.info(f"Manual memory added for agent {agent_id}: {payload.subject} {payload.object}")
    return MemoryFactResponse(
        chroma_id=chroma_id,
        subject=payload.subject,
        predicate=payload.predicate,
        object=payload.object,
        confidence=payload.confidence,
        text=f"{payload.subject} {payload.predicate} {payload.object}",
    )


@router.delete("/memory/{agent_id}/{chroma_id:path}")
async def remove_memory(agent_id: int, chroma_id: str):
    delete_fact(agent_id, chroma_id)
    async with SessionLocal() as db:
        result = await db.execute(
            select(MemoryFact).where(
                MemoryFact.agent_id == agent_id,
                MemoryFact.chroma_id == chroma_id,
            )
        )
        fact = result.scalar_one_or_none()
        if fact:
            await db.delete(fact)
            await db.commit()
    return {"status": "deleted"}

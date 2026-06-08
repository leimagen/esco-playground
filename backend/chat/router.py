import json
import re
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
from database import get_db, SessionLocal, Thread, ThreadAgent, Message, Agent
from agents.executor import run_agent_stream
from memory.extractor import schedule_extraction

logger = logging.getLogger("esco.chat")
router = APIRouter()


class ThreadCreate(BaseModel):
    title: Optional[str] = None
    type: str = "single"
    agent_ids: list[int]


class ThreadResponse(BaseModel):
    id: int
    title: Optional[str]
    type: str
    agent_ids: list[int]
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    agent_id: Optional[int]
    role: str
    content: str
    image_b64: Optional[str] = None
    created_at: str


class SendPayload(BaseModel):
    content: str
    image_b64: Optional[str] = None
    agent_id: Optional[int] = None


class InvitePayload(BaseModel):
    agent_id: int


def thread_to_response(t: Thread, participants: list) -> ThreadResponse:
    return ThreadResponse(
        id=t.id,
        title=t.title,
        type=t.type,
        agent_ids=[p.agent_id for p in participants],
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    )


def parse_mention(content: str, agents: list[Agent]) -> Agent | None:
    match = re.search(r"@(\w+)", content)
    if not match:
        return None
    mention_name = match.group(1).lower()
    for agent in agents:
        if agent.name.lower() == mention_name or agent.slug.lower() == mention_name:
            return agent
    return None


@router.get("/threads", response_model=list[ThreadResponse])
async def list_threads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Thread).order_by(Thread.updated_at.desc()))
    threads = result.scalars().all()
    out = []
    for t in threads:
        parts_result = await db.execute(select(ThreadAgent).where(ThreadAgent.thread_id == t.id))
        parts = parts_result.scalars().all()
        out.append(thread_to_response(t, parts))
    return out


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(payload: ThreadCreate, db: AsyncSession = Depends(get_db)):
    thread = Thread(title=payload.title, type=payload.type)
    db.add(thread)
    await db.flush()

    for agent_id in payload.agent_ids:
        db.add(ThreadAgent(thread_id=thread.id, agent_id=agent_id))

    await db.commit()
    await db.refresh(thread)
    parts_result = await db.execute(select(ThreadAgent).where(ThreadAgent.thread_id == thread.id))
    parts = parts_result.scalars().all()
    logger.info(f"Created thread {thread.id} with agents {payload.agent_ids}")
    return thread_to_response(thread, parts)


@router.get("/threads/{thread_id}/messages", response_model=list[MessageResponse])
async def get_messages(thread_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
    )
    msgs = result.scalars().all()
    return [
        MessageResponse(
            id=m.id,
            thread_id=m.thread_id,
            agent_id=m.agent_id,
            role=m.role,
            content=m.content,
            image_b64=m.image_b64,
            created_at=m.created_at.isoformat(),
        )
        for m in msgs
    ]


@router.post("/threads/{thread_id}/invite")
async def invite_agent(thread_id: int, payload: InvitePayload, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(ThreadAgent).where(
            ThreadAgent.thread_id == thread_id,
            ThreadAgent.agent_id == payload.agent_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already in thread"}

    db.add(ThreadAgent(thread_id=thread_id, agent_id=payload.agent_id))
    await db.execute(
        update(Thread).where(Thread.id == thread_id).values(type="group")
    )
    await db.commit()
    logger.info(f"Agent {payload.agent_id} invited to thread {thread_id}")
    return {"status": "invited", "agent_id": payload.agent_id}


@router.delete("/threads/{thread_id}/agents/{agent_id}")
async def remove_agent_from_thread(thread_id: int, agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ThreadAgent).where(
            ThreadAgent.thread_id == thread_id,
            ThreadAgent.agent_id == agent_id,
        )
    )
    ta = result.scalar_one_or_none()
    if not ta:
        raise HTTPException(status_code=404, detail="Agent not in thread")
    await db.delete(ta)

    parts_result = await db.execute(
        select(ThreadAgent).where(ThreadAgent.thread_id == thread_id)
    )
    remaining = parts_result.scalars().all()
    if len(remaining) <= 1:
        await db.execute(update(Thread).where(Thread.id == thread_id).values(type="single"))
    await db.commit()
    return {"status": "removed"}


@router.post("/threads/{thread_id}/send")
async def send_message(thread_id: int, payload: SendPayload):
    async with SessionLocal() as db:
        parts_result = await db.execute(
            select(ThreadAgent).where(ThreadAgent.thread_id == thread_id)
        )
        participants = parts_result.scalars().all()
        if not participants:
            raise HTTPException(status_code=404, detail="Thread not found or has no agents")

        all_agents_result = await db.execute(select(Agent))
        all_agents = all_agents_result.scalars().all()

        mentioned_agent = parse_mention(payload.content, all_agents)
        if mentioned_agent:
            part_ids = [p.agent_id for p in participants]
            if mentioned_agent.id not in part_ids:
                db.add(ThreadAgent(thread_id=thread_id, agent_id=mentioned_agent.id))
                await db.execute(update(Thread).where(Thread.id == thread_id).values(type="group"))
                await db.commit()
            agent_id = mentioned_agent.id
        else:
            agent_id = payload.agent_id or participants[0].agent_id

        user_msg = Message(
            thread_id=thread_id,
            agent_id=None,
            role="user",
            content=payload.content,
            image_b64=payload.image_b64,
        )
        db.add(user_msg)
        await db.flush()

        msgs_result = await db.execute(
            select(Message)
            .where(Message.thread_id == thread_id)
            .order_by(Message.created_at.asc())
        )
        thread_messages = msgs_result.scalars().all()[:-1]

        assistant_msg = Message(
            thread_id=thread_id,
            agent_id=agent_id,
            role="assistant",
            content="",
        )
        db.add(assistant_msg)
        await db.flush()
        assistant_id = assistant_msg.id
        await db.commit()

    async def stream():
        collected = []
        try:
            async with SessionLocal() as stream_db:
                async for token in run_agent_stream(
                    stream_db, agent_id, thread_messages, payload.content, payload.image_b64
                ):
                    collected.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'data': token})}\n\n"

            full_response = "".join(collected)

            async with SessionLocal() as save_db:
                await save_db.execute(
                    update(Message).where(Message.id == assistant_id).values(content=full_response)
                )
                if payload.content:
                    await save_db.execute(
                        update(Thread)
                        .where(Thread.id == thread_id, Thread.title.is_(None))
                        .values(title=payload.content[:50])
                    )
                await save_db.commit()

            schedule_extraction(agent_id, payload.content, full_response)

            yield f"data: {json.dumps({'type': 'done', 'data': 'agent_id:' + str(agent_id)})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    await db.delete(thread)
    await db.commit()
    return {"status": "deleted"}

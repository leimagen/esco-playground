import re
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db, Agent, AgentSkill
from config import DATA_DIR

AVATARS_DIR = DATA_DIR / "avatars"
AVATARS_DIR.mkdir(exist_ok=True)

logger = logging.getLogger("esco.agents")
router = APIRouter()


class AgentCreate(BaseModel):
    name: str
    persona: str
    model_id: str
    vision: bool = False
    color: str = "#7c6fcd"


class AgentResponse(BaseModel):
    id: int
    name: str
    slug: str
    persona: str
    model_id: str
    vision: bool
    color: str
    has_avatar: bool = False
    created_at: str

    class Config:
        from_attributes = True


class SkillResponse(BaseModel):
    id: int
    agent_id: int
    topic: str
    conversation_count: int
    confidence_score: float

    class Config:
        from_attributes = True


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def avatar_path(agent_id: int) -> str:
    return str(AVATARS_DIR / f"{agent_id}.jpg")


def has_avatar(agent_id: int) -> bool:
    return os.path.isfile(avatar_path(agent_id))


def to_response(a: Agent) -> AgentResponse:
    return AgentResponse(
        id=a.id,
        name=a.name,
        slug=a.slug,
        persona=a.persona,
        model_id=a.model_id,
        vision=a.vision,
        color=a.color,
        has_avatar=has_avatar(a.id),
        created_at=a.created_at.isoformat(),
    )


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.created_at))
    return [to_response(a) for a in result.scalars().all()]


@router.post("/agents", response_model=AgentResponse)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    slug = slugify(payload.name)
    existing = await db.execute(select(Agent).where(Agent.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{int(__import__('time').time())}"

    agent = Agent(
        name=payload.name,
        slug=slug,
        persona=payload.persona,
        model_id=payload.model_id,
        vision=payload.vision,
        color=payload.color,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    logger.info(f"Created agent: {agent.name} ({agent.slug})")
    return to_response(agent)


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return to_response(agent)


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: int, payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.name = payload.name
    agent.persona = payload.persona
    agent.model_id = payload.model_id
    agent.vision = payload.vision
    agent.color = payload.color
    await db.commit()
    await db.refresh(agent)
    return to_response(agent)


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
    # Remove avatar file if exists
    p = avatar_path(agent_id)
    if os.path.isfile(p):
        os.remove(p)
    return {"status": "deleted"}


@router.get("/agents/{agent_id}/skills", response_model=list[SkillResponse])
async def get_skills(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentSkill)
        .where(AgentSkill.agent_id == agent_id)
        .order_by(AgentSkill.confidence_score.desc())
    )
    return result.scalars().all()


@router.get("/agents/{agent_id}/avatar")
async def get_avatar(agent_id: int):
    p = avatar_path(agent_id)
    if not os.path.isfile(p):
        raise HTTPException(status_code=404, detail="No avatar")
    return FileResponse(p, media_type="image/jpeg")


@router.put("/agents/{agent_id}/avatar")
async def upload_avatar(agent_id: int, file: UploadFile = File(...)):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or GIF allowed")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB)")

    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        img.thumbnail((256, 256), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88)
        with open(avatar_path(agent_id), "wb") as f:
            f.write(out.getvalue())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process image: {e}")

    logger.info(f"Avatar saved for agent {agent_id}")
    return {"status": "ok", "has_avatar": True}


@router.delete("/agents/{agent_id}/avatar")
async def delete_avatar(agent_id: int):
    p = avatar_path(agent_id)
    if os.path.isfile(p):
        os.remove(p)
    return {"status": "ok", "has_avatar": False}

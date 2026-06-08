import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db, Setting, FileWhitelist

logger = logging.getLogger("esco.settings")
router = APIRouter()


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting))
    rows = result.scalars().all()
    return {r.key: json.loads(r.value) for r in rows}


@router.post("/settings")
async def update_settings(payload: dict, db: AsyncSession = Depends(get_db)):
    for key, value in payload.items():
        result = await db.execute(select(Setting).where(Setting.key == key))
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = json.dumps(value)
        else:
            db.add(Setting(key=key, value=json.dumps(value)))
    await db.commit()
    return {"status": "updated"}


class WhitelistEntry(BaseModel):
    path: str
    label: Optional[str] = None
    can_write: bool = False


@router.get("/settings/file-whitelist")
async def list_whitelist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FileWhitelist).order_by(FileWhitelist.added_at))
    return result.scalars().all()


@router.post("/settings/file-whitelist")
async def add_whitelist(entry: WhitelistEntry, db: AsyncSession = Depends(get_db)):
    item = FileWhitelist(path=entry.path, label=entry.label, can_write=entry.can_write)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/settings/file-whitelist/{entry_id}")
async def remove_whitelist(entry_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FileWhitelist).where(FileWhitelist.id == entry_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}

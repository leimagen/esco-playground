import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from agents.router import router as agents_router
from chat.router import router as chat_router
from memory.router import router as memory_router
from settings.router import router as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("esco")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Esco Playground backend...")
    await init_db()
    logger.info("Database ready")
    yield
    logger.info("Shutting down...")


app = FastAPI(title="Esco Playground API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "null", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(memory_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/shutdown")
async def shutdown():
    asyncio.get_event_loop().call_later(0.5, lambda: sys.exit(0))
    return {"status": "shutting down"}

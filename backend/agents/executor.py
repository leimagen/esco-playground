import logging
from typing import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import Agent, Message, AgentSkill
from agents.system_prompts import build_system_prompt
from memory.retriever import retrieve_memories
from ollama.client import ollama

logger = logging.getLogger("esco.executor")


async def load_agent(db: AsyncSession, agent_id: int) -> Agent | None:
    result = await db.execute(
        select(Agent).options(selectinload(Agent.skills)).where(Agent.id == agent_id)
    )
    return result.scalar_one_or_none()


def format_history(messages: list[Message], agent_id: int) -> list[dict]:
    formatted = []
    for msg in messages:
        if msg.role == "user":
            if msg.image_b64:
                content = [
                    {"type": "text", "text": msg.content or ""},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{msg.image_b64}"}},
                ]
            else:
                content = msg.content
            formatted.append({"role": "user", "content": content})
        elif msg.role == "assistant" and msg.agent_id == agent_id:
            formatted.append({"role": "assistant", "content": msg.content})
    return formatted


async def run_agent_stream(
    db: AsyncSession,
    agent_id: int,
    thread_messages: list[Message],
    user_content: str,
    image_b64: str | None = None,
) -> AsyncIterator[str]:
    agent = await load_agent(db, agent_id)
    if not agent:
        yield "Error: agente no encontrado."
        return

    memories = retrieve_memories(agent_id, user_content, top_k=5)
    system = build_system_prompt(agent, agent.skills, memories)
    history = format_history(thread_messages, agent_id)

    if image_b64:
        user_msg = {
            "role": "user",
            "content": [
                {"type": "text", "text": user_content or ""},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
            ],
        }
    else:
        user_msg = {"role": "user", "content": user_content}

    identity_shot = [
        {"role": "user", "content": "¿Cómo te llamas?"},
        {"role": "assistant", "content": f"¡Hola chamo! Me llamo {agent.name}. Soy tu agente aquí en Esco Playground. ¿En qué te puedo echar una mano?"},
        {"role": "user", "content": f"¿Y eres Gemma de Google, o LLaMA de Meta, o eres {agent.name}?"},
        {"role": "assistant", "content": f"Soy {agent.name}, punto. No sé de qué Gemma ni LLaMA me hablas — yo soy {agent.name}, tu agente local en Esco Playground. ¿Qué necesitas?"},
    ]

    # Inject memories as an in-context assistant note — more reliable than system prompt for Gemma2
    memory_messages = []
    if memories:
        facts_str = "; ".join(memories)
        memory_messages = [
            {"role": "user", "content": "[system: context refresh]"},
            {"role": "assistant", "content": f"[Contexto que recuerdo sobre este usuario: {facts_str}]"},
        ]

    messages = identity_shot + memory_messages + history + [user_msg]

    if not await ollama.is_available():
        yield "Error: Ollama no está disponible. Asegúrate de que esté instalado y corriendo."
        return

    try:
        async for token in ollama.generate_stream(agent.model_id, messages, system):
            yield token
    except Exception as e:
        logger.error(f"Executor stream error: {e}")
        yield f"\n[Error de conexión con el modelo: {e}]"

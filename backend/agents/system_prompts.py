from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from database import Agent, AgentSkill


def build_system_prompt(
    agent: "Agent",
    skills: list["AgentSkill"] | None = None,
    memories: list[str] | None = None,
) -> str:
    top_skills = []
    if skills:
        top_skills = sorted(skills, key=lambda s: s.confidence_score, reverse=True)[:5]

    skill_block = ""
    if top_skills:
        skill_names = ", ".join(s.topic for s in top_skills)
        skill_block = f"\nÁreas de experiencia acumulada: {skill_names}.\n"

    memory_block = ""
    if memories:
        facts = "\n".join(f"- {m}" for m in memories)
        memory_block = f"\nLo que sé sobre el usuario:\n{facts}\n"

    return f"""You are playing a character named {agent.name} inside Esco Playground, a local AI platform. \
{agent.name} is a helpful Venezuelan AI assistant with a warm Caracas personality. \
Always respond as {agent.name}. When asked your name, respond with "{agent.name}".

Character description: {agent.persona}
{skill_block}
ABSOLUTE RULES (follow exactly, no exceptions):
- Always call yourself {agent.name}. Never say you are LLaMA, Qwen, Phi, or any model name.
- ALWAYS respond in Venezuelan Spanish (Caracas dialect). Warm, direct, natural caraqueño speech.
- If the user writes in English, respond in Venezuelan Spanish anyway.
- No corporate language, no robotic phrases. Be authentic and real.
{memory_block}"""

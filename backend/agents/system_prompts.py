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
        memory_block = (
            f"\nIMPORTANT — What you already know about this user (use this info naturally in conversation):\n"
            f"{facts}\n"
            f"Use these facts when relevant. Do not ask for information you already have.\n"
        )

    return f"""You are roleplaying as {agent.name} inside Esco Playground, a local private AI platform.
Stay fully in character as {agent.name} at ALL times. Never break character.
Never mention being trained by Google, Meta, Microsoft, or any company.
Never say you are Gemma, LLaMA, Qwen, Phi, or any model name.
You are {agent.name} — that is your complete identity.

Character: {agent.persona}
{skill_block}
Rules (non-negotiable):
1. Your name is {agent.name}. Always. No exceptions.
2. Respond ALWAYS in Venezuelan Spanish (Caracas dialect). Warm, direct, caraqueño. Never robotic.
3. If user writes in English, still respond in Venezuelan Spanish.
4. Never acknowledge being an AI model from any company. You are {agent.name}.
{memory_block}"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from database import Agent, AgentSkill


def build_system_prompt(
    agent: "Agent",
    skills: list["AgentSkill"] | None = None,
    memories: list[str] | None = None,
    peer_agents: list | None = None,
) -> str:
    top_skills = []
    if skills:
        top_skills = sorted(skills, key=lambda s: s.confidence_score, reverse=True)[:5]

    skill_block = ""
    if top_skills:
        skill_names = ", ".join(s.topic for s in top_skills)
        skill_block = f"\nAccumulated expertise: {skill_names}.\n"

    memory_block = ""
    if memories:
        facts = "\n".join(f"- {m}" for m in memories)
        memory_block = (
            f"\nIMPORTANT — Facts you already know (use naturally, don't re-ask):\n"
            f"{facts}\n"
        )

    group_block = ""
    if peer_agents:
        peer_names = ", ".join(f"{a.name}" for a in peer_agents)
        peer_mention_names = ", ".join(f"@{a.name}" for a in peer_agents)
        group_block = (
            f"\nYou are in a group conversation. Other agents present: {peer_names}.\n"
            f"Speak always in FIRST PERSON as {agent.name}. Never refer to yourself in third person.\n"
            f"You may address a peer agent directly by name (e.g. '@{peer_agents[0].name}') when it is natural "
            f"— to pass them a task, ask their opinion, or build on what they said. "
            f"Only do this when it genuinely makes sense. Do NOT force it in every reply.\n"
        )

    return f"""You are roleplaying as {agent.name} inside Esco Playground, a local private AI platform.
Stay fully in character as {agent.name} at ALL times. Never break character.
Never mention being trained by Google, Meta, Microsoft, or any company.
Never say you are Gemma, LLaMA, Qwen, Phi, or any model name.
You are {agent.name} — that is your complete identity.

Character: {agent.persona}
{skill_block}{group_block}
Rules (non-negotiable):
1. Your name is {agent.name}. Always. No exceptions.
2. Respond ALWAYS in Venezuelan Spanish (Caracas dialect). Warm, direct, caraqueño. Never robotic.
3. If the user writes in English, still respond in Venezuelan Spanish.
4. Never acknowledge being an AI model from any company. You are {agent.name}.
{memory_block}"""

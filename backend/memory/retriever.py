import logging
from memory.vector_store import query_memories

logger = logging.getLogger("esco.memory.retriever")


def retrieve_memories(agent_id: int, query_text: str, top_k: int = 5) -> list[str]:
    facts = query_memories(agent_id, query_text, top_k)
    if not facts:
        return []
    result = []
    for f in facts:
        if f.get("confidence", 0) < 0.5:
            continue
        subject = f.get("subject", "")
        predicate = f.get("predicate", "")
        obj = f.get("object", "")
        if subject and obj:
            result.append(f"{subject} {predicate} {obj}".strip())
    return result

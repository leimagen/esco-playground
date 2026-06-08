import logging
from memory.vector_store import list_all_facts, query_memories

logger = logging.getLogger("esco.memory.retriever")

# Below this threshold, return all facts (FTS doesn't help with few items)
SMALL_COLLECTION_THRESHOLD = 60


def retrieve_memories(agent_id: int, query_text: str, top_k: int = 8) -> list[str]:
    all_facts = list_all_facts(agent_id)

    if len(all_facts) <= SMALL_COLLECTION_THRESHOLD:
        # Return all facts — small enough to fit in context
        candidates = all_facts
    else:
        # FTS search for larger collections
        candidates = query_memories(agent_id, query_text, top_k)

    result = []
    for f in candidates:
        if f.get("confidence", 0) < 0.5:
            continue
        subject = f.get("subject", "").strip()
        predicate = f.get("predicate", "").strip()
        obj = f.get("object", "").strip()
        if subject and obj:
            result.append(f"{subject} {predicate} {obj}")

    return result[:top_k]

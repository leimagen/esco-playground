"""
Memory store using SQLite FTS5 for full-text retrieval.
No external vector DB required — zero extra dependencies.
"""
import sqlite3
import logging
import os
from config import settings

logger = logging.getLogger("esco.memory.store")

_DB_PATH = os.path.join(settings.chroma_dir, "memories.db")


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(_DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("""
        CREATE TABLE IF NOT EXISTS memory_facts (
            chroma_id  TEXT PRIMARY KEY,
            agent_id   INTEGER NOT NULL,
            subject    TEXT NOT NULL,
            predicate  TEXT NOT NULL,
            object     TEXT NOT NULL,
            confidence REAL DEFAULT 0.8,
            text       TEXT NOT NULL
        )
    """)
    con.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
        USING fts5(chroma_id UNINDEXED, agent_id UNINDEXED, text, content='memory_facts', content_rowid='rowid')
    """)
    con.execute("""
        CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_facts BEGIN
            INSERT INTO memory_fts(rowid, chroma_id, agent_id, text)
            VALUES (new.rowid, new.chroma_id, new.agent_id, new.text);
        END
    """)
    con.execute("""
        CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_facts BEGIN
            INSERT INTO memory_fts(memory_fts, rowid, chroma_id, agent_id, text)
            VALUES ('delete', old.rowid, old.chroma_id, old.agent_id, old.text);
        END
    """)
    con.commit()
    return con


def upsert_facts(agent_id: int, facts: list[dict]) -> None:
    con = _conn()
    try:
        for fact in facts:
            text = f"{fact['subject']} {fact['predicate']} {fact['object']}"
            con.execute("""
                INSERT INTO memory_facts (chroma_id, agent_id, subject, predicate, object, confidence, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(chroma_id) DO UPDATE SET
                    subject=excluded.subject, predicate=excluded.predicate,
                    object=excluded.object, confidence=excluded.confidence, text=excluded.text
            """, (fact["chroma_id"], agent_id, fact["subject"], fact["predicate"],
                  fact["object"], fact.get("confidence", 0.8), text))
        con.commit()
    finally:
        con.close()


def _sanitize_fts_query(text: str) -> str:
    import re
    words = re.findall(r'\w+', text)
    if not words:
        return '""'
    return " OR ".join(words[:8])


def query_memories(agent_id: int, query_text: str, top_k: int = 5) -> list[dict]:
    con = _conn()
    try:
        fts_query = _sanitize_fts_query(query_text)
        rows = con.execute("""
            SELECT f.chroma_id, f.subject, f.predicate, f.object, f.confidence, f.text
            FROM memory_facts f
            JOIN memory_fts ON memory_fts.chroma_id = f.chroma_id
            WHERE memory_fts MATCH ? AND f.agent_id = ?
            ORDER BY rank
            LIMIT ?
        """, (fts_query, agent_id, top_k)).fetchall()
        return [
            {"chroma_id": r[0], "subject": r[1], "predicate": r[2],
             "object": r[3], "confidence": r[4], "text": r[5]}
            for r in rows
        ]
    except Exception as e:
        logger.warning(f"Memory FTS query error: {e}")
        try:
            rows = con.execute("""
                SELECT chroma_id, subject, predicate, object, confidence, text
                FROM memory_facts WHERE agent_id = ? LIMIT ?
            """, (agent_id, top_k)).fetchall()
            return [
                {"chroma_id": r[0], "subject": r[1], "predicate": r[2],
                 "object": r[3], "confidence": r[4], "text": r[5]}
                for r in rows
            ]
        except Exception:
            return []
    finally:
        con.close()


def delete_fact(agent_id: int, chroma_id: str) -> None:
    con = _conn()
    try:
        con.execute("DELETE FROM memory_facts WHERE agent_id=? AND chroma_id=?", (agent_id, chroma_id))
        con.commit()
    finally:
        con.close()


def list_all_facts(agent_id: int) -> list[dict]:
    con = _conn()
    try:
        rows = con.execute("""
            SELECT chroma_id, subject, predicate, object, confidence, text
            FROM memory_facts WHERE agent_id = ?
            ORDER BY rowid DESC
        """, (agent_id,)).fetchall()
        return [
            {"chroma_id": r[0], "subject": r[1], "predicate": r[2],
             "object": r[3], "confidence": r[4], "text": r[5]}
            for r in rows
        ]
    finally:
        con.close()

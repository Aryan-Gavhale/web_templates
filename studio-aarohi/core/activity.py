"""Audit trail — so the owner can see what changed and when."""

from .db import insert, now, q


def log(action: str, entity: str = "", entity_id=None, summary: str = "", user=None) -> None:
    name = "system"
    if user is not None:
        try:
            name = user["name"] or user["email"]
        except (TypeError, KeyError):
            name = str(user)
    insert("activity", {
        "user_name": name,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "summary": summary[:400],
        "created_at": now(),
    })


def recent(limit: int = 12) -> list:
    return q("SELECT * FROM activity ORDER BY id DESC LIMIT ?", (limit,))


def trim(keep: int = 500) -> None:
    q("DELETE FROM activity WHERE id NOT IN "
      "(SELECT id FROM activity ORDER BY id DESC LIMIT ?)", (keep,))

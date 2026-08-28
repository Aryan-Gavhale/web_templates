"""Session auth for the admin console."""

import functools

from flask import g, jsonify, redirect, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from .db import now, q1, run

SESSION_KEY = "uid"


def hash_password(raw: str) -> str:
    return generate_password_hash(raw, method="pbkdf2:sha256", salt_length=16)


def verify(user_row, raw: str) -> bool:
    if not user_row:
        return False
    return check_password_hash(user_row["password_hash"], raw)


def find_by_email(email: str):
    return q1("SELECT * FROM users WHERE lower(email) = lower(?)", (email.strip(),))


def login(user_row) -> None:
    session.clear()
    session[SESSION_KEY] = user_row["id"]
    session.permanent = True
    run("UPDATE users SET last_login_at = ? WHERE id = ?", (now(), user_row["id"]))


def logout() -> None:
    session.clear()


def current_user():
    """Cached per request. Returns None when signed out."""
    if "user" in g:
        return g.user
    uid = session.get(SESSION_KEY)
    g.user = q1("SELECT * FROM users WHERE id = ?", (uid,)) if uid else None
    return g.user


def login_required(view):
    @functools.wraps(view)
    def wrapped(*a, **kw):
        if current_user() is None:
            if request.path.startswith("/api/"):
                return jsonify(ok=False, error="Not signed in"), 401
            return redirect(url_for("admin.login", next=request.full_path))
        return view(*a, **kw)

    return wrapped


def change_password(user_id: int, new_raw: str) -> None:
    run("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_raw), user_id))


def password_problem(raw: str):
    """Returns a message when the password is unusable, else None."""
    if len(raw or "") < 8:
        return "Use at least 8 characters."
    if raw.isdigit():
        return "Use more than digits alone."
    return None

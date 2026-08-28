"""Studio Aarohi — dynamic interior-design site with an owner's admin console.

Run:  python app.py           (http://127.0.0.1:8900)
"""

import os
import secrets
import sys
from datetime import timedelta

from flask import Flask, redirect, send_from_directory, url_for

from core import settings as cfg
from core.content import tile_spans
from core.db import UPLOAD_DIR, close_db, init_db
from core.money import compact, money, pretty_date
from core.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_if_empty

BASE = os.path.dirname(os.path.abspath(__file__))
SECRET_FILE = os.path.join(BASE, "data", ".secret")
PORT = int(os.environ.get("PORT", 8910))

# The default Windows console is cp1252 and this project speaks in ₹ and en dashes.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def _secret_key() -> bytes:
    """Persist a random key so sessions survive a restart."""
    env = os.environ.get("SECRET_KEY")
    if env:
        return env.encode()
    os.makedirs(os.path.dirname(SECRET_FILE), exist_ok=True)
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, "rb") as fh:
            data = fh.read().strip()
            if data:
                return data
    key = secrets.token_bytes(48)
    with open(SECRET_FILE, "wb") as fh:
        fh.write(key)
    return key


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.update(
        SECRET_KEY=_secret_key(),
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        JSON_SORT_KEYS=False,
        TEMPLATES_AUTO_RELOAD=True,
    )
    app.teardown_appcontext(close_db)

    init_db()
    with app.app_context():
        if seed_if_empty():
            app.logger.info("Demo content installed.")

    from routes.admin import bp as admin_bp
    from routes.api import bp as api_bp
    from routes.public import bp as public_bp

    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/uploads/<path:name>")
    def uploads(name):
        return send_from_directory(UPLOAD_DIR, name, max_age=60 * 60 * 24 * 30)

    @app.route("/favicon.ico")
    def favicon():
        return redirect(url_for("static", filename="public/favicon.svg"))

    # Filters the templates lean on constantly.
    app.jinja_env.filters["money"] = lambda v: money(v, cfg.get("currency_symbol", "₹"))
    app.jinja_env.filters["compact"] = lambda v: compact(v, cfg.get("currency_symbol", "₹"))
    app.jinja_env.filters["nicedate"] = pretty_date
    app.jinja_env.filters["paras"] = lambda t: [p.strip() for p in (t or "").split("\n\n") if p.strip()]
    app.jinja_env.filters["tile_spans"] = tile_spans

    return app


app = create_app()

if __name__ == "__main__":
    banner = f"""
  Studio Aarohi is running.

    Website        http://127.0.0.1:{PORT}/
    Admin console  http://127.0.0.1:{PORT}/admin

    Sign in with   {DEMO_EMAIL}
                   {DEMO_PASSWORD}

  Change that password under Admin → Settings → Account.
"""
    print(banner)
    debug = os.environ.get("DEBUG") == "1"
    app.run(host="127.0.0.1", port=PORT, debug=debug, use_reloader=debug, threaded=True)

"""Dental clinic site + admin CMS.

    python app.py            run the dev server
    python app.py seed       apply the schema and load the demo clinic
    python app.py reset      delete the database, then seed
    python app.py user       add or update an admin account

Nothing on the public page is hard-coded; every heading, image, service and
colour is a row in SQLite that the admin panel edits.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import timedelta
from pathlib import Path

from flask import Flask, g, render_template, request

from core import auth, db, media, settings, util

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = {
    "secret_key": "dev-only-secret-change-me",
    "host": "127.0.0.1",
    "port": 8120,
    "debug": True,
    "db_path": "db/clinic.db",
    "upload_dir": "static/uploads",
    "max_upload_mb": 12,
    "owner_email": "owner@anvayadental.in",
    "owner_password": "anvaya2026",
    "owner_name": "Practice Owner",
    "google_verify_tls": True,
}


def load_config() -> dict:
    """Defaults, overridden by config.json, overridden by CLINIC_* in the env.

    config.example.json is deliberately not read: a placeholder secret key should
    never become the live one just because nobody copied the file.
    """
    data = dict(DEFAULT_CONFIG)
    path = ROOT / "config.json"
    if path.exists():
        try:
            data.update(json.loads(path.read_text(encoding="utf-8")))
        except ValueError as exc:
            print(f"[config] ignoring config.json: {exc}")
    for key in list(data):
        env = os.environ.get("CLINIC_" + key.upper())
        if env is not None:
            data[key] = env
    return data


def create_app() -> Flask:
    cfg = load_config()
    app = Flask(__name__, static_folder="static", template_folder="templates")

    app.secret_key = str(cfg["secret_key"])
    if app.secret_key == DEFAULT_CONFIG["secret_key"]:
        print("[config] using the built-in development secret key. Create config.json "
              "with your own secret_key before putting this on a real domain.")
    app.config.update(
        DB_PATH=cfg["db_path"],
        UPLOAD_DIR=cfg["upload_dir"],
        OWNER_EMAIL=cfg["owner_email"],
        OWNER_PASSWORD=cfg["owner_password"],
        OWNER_NAME=cfg["owner_name"],
        HOST=cfg["host"],
        PORT=int(cfg["port"]),
        GOOGLE_VERIFY_TLS=util.parse_bool(cfg["google_verify_tls"]),
        MAX_CONTENT_LENGTH=int(cfg["max_upload_mb"]) * 1024 * 1024,
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        TEMPLATES_AUTO_RELOAD=bool(cfg["debug"]),
        JSON_SORT_KEYS=False,
    )

    db.init_app(app)
    with app.app_context():
        settings.ensure_defaults()
    auth.bootstrap_owner(app)

    register_jinja(app)
    register_blueprints(app)
    register_errors(app)
    return app


# ── template helpers ────────────────────────────────────────────────────────
def register_jinja(app: Flask) -> None:
    from core import crud
    from core import sections as sections_mod

    app.jinja_env.trim_blocks = True
    app.jinja_env.lstrip_blocks = True

    app.add_template_filter(util.money, "money")
    app.add_template_filter(util.inr, "inr")
    app.add_template_filter(util.pretty_date, "date_fmt")
    app.add_template_filter(util.pretty_datetime, "datetime_fmt")
    app.add_template_filter(util.time_ago, "ago")
    app.add_template_filter(util.truncate, "shorten")
    app.add_template_filter(util.initials, "initials")
    app.add_template_filter(util.split_list, "as_list")
    app.add_template_filter(util.load_json, "from_json")
    app.add_template_filter(util.slugify, "slugify")

    @app.template_filter("paragraphs")
    def paragraphs(value):
        blocks = [b.strip() for b in str(value or "").split("\n\n") if b.strip()]
        return [b.replace("\n", " ") for b in blocks]

    # Helpers go in globals rather than a context processor, because a macro
    # imported without "with context" cannot see context values, and every admin
    # form is built out of macros.
    app.jinja_env.globals.update(
        S=settings.get,
        csrf_token=auth.csrf_token,
        current_user=auth.current_user,
        can=auth.can,
        media_url=media.media_url,
        media_alt=media.media_alt,
        media_row=media.get,
        field_value=crud.form_value,
        SECTION_TYPES=sections_mod.SECTION_TYPES,
        section_fields=sections_mod.fields_for,
        type_label=sections_mod.type_label,
        ROLE_LABELS=auth.ROLE_LABELS,
    )

    @app.context_processor
    def inject():
        return {
            "brand": settings.group("brand"),
            "contact": settings.group("contact"),
            "theme": settings.group("theme"),
            "social": settings.group("social"),
        }

    @app.before_request
    def _touch():
        g.request_path = request.path


def register_blueprints(app: Flask) -> None:
    from blueprints.admin import bp as admin_bp
    from blueprints.public import bp as public_bp

    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")


def register_errors(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(exc):
        return render_template("errors/error.html", code=400, title="That request looked wrong",
                               message=getattr(exc, "description", "")), 400

    @app.errorhandler(403)
    def forbidden(exc):
        return render_template("errors/error.html", code=403, title="Not your door",
                               message="Your account does not have access to that page."), 403

    @app.errorhandler(404)
    def not_found(exc):
        if request.path.startswith("/admin"):
            return render_template("errors/error.html", code=404, title="Nothing here",
                                   message="That admin page does not exist."), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(413)
    def too_large(exc):
        limit = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return render_template("errors/error.html", code=413, title="That file is too big",
                               message=f"Uploads are capped at {limit} MB per file."), 413

    @app.errorhandler(500)
    def server_error(exc):
        app.logger.exception("Unhandled error")
        return render_template("errors/error.html", code=500, title="Something broke",
                               message="The error has been logged. Try again."), 500


# ── CLI ─────────────────────────────────────────────────────────────────────
def _cli(argv: list[str]) -> int:
    command = argv[0] if argv else "serve"
    app = None

    if command == "reset":
        cfg = load_config()
        target = ROOT / cfg["db_path"]
        for suffix in ("", "-wal", "-shm"):
            candidate = Path(str(target) + suffix)
            if candidate.exists():
                candidate.unlink()
                print(f"[reset] removed {candidate.name}")
        command = "seed"

    if command == "seed":
        app = create_app()
        from db.seed import run as seed_run
        with app.app_context():
            seed_run(force="--force" in argv)
        return 0

    if command == "user":
        app = create_app()
        if len(argv) < 4:
            print("usage: python app.py user <email> <name> <password> [role]")
            return 1
        email, name, password = argv[1], argv[2], argv[3]
        role = argv[4] if len(argv) > 4 else "admin"
        with app.app_context():
            existing = auth.find_user(email)
            if existing:
                db.update("users", existing["id"],
                          {"password_hash": auth.hash_password(password), "role": role,
                           "name": name, "is_active": 1})
                print(f"[user] updated {email} ({role})")
            else:
                auth.create_user(email, name, password, role)
                print(f"[user] created {email} ({role})")
        return 0

    app = create_app()
    host, port = app.config["HOST"], app.config["PORT"]
    debug = load_config()["debug"]
    print(f"  Public site   http://{host}:{port}/")
    print(f"  Admin panel   http://{host}:{port}/admin")
    print(f"  First login   {app.config['OWNER_EMAIL']}")
    app.run(host=host, port=port, debug=debug, threaded=True,
            use_reloader=debug and "--no-reload" not in argv)
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))

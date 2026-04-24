"""Runtime configuration loaded from environment."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local", override=True)


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str
    anthropic_auth_token: str
    exa_api_key: str | None
    redis_url: str
    database_path: str
    allowed_origins: list[str]
    log_level: str
    briefing_model: str
    validation_model: str
    brief_cache_ttl_seconds: int
    rate_limit_per_hour: int
    anchor_date: str
    use_live_exa: bool
    debug_token: str | None


def _parse_origins(raw: str | None) -> list[str]:
    if not raw:
        return ["http://localhost:3000"]
    return [o.strip() for o in raw.split(",") if o.strip()]


def load_settings() -> Settings:
    origins_str = os.getenv("ALLOWED_ORIGINS")
    log.warning(f"DEBUG: ALLOWED_ORIGINS env var = {origins_str!r}")
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        anthropic_auth_token=os.getenv("ANTHROPIC_AUTH_TOKEN", ""),
        exa_api_key=os.getenv("EXA_API_KEY") or None,
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        database_path=os.getenv("DATABASE_PATH", str(REPO_ROOT / "data" / "primer.db")),
        allowed_origins=_parse_origins(origins_str),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        briefing_model=os.getenv("BRIEFING_MODEL", "claude-opus-4-7"),
        validation_model=os.getenv("VALIDATION_MODEL", "claude-haiku-4-5-20251001"),
        brief_cache_ttl_seconds=int(os.getenv("BRIEF_CACHE_TTL_SECONDS", "900")),
        rate_limit_per_hour=int(os.getenv("RATE_LIMIT_PER_HOUR", "20")),
        anchor_date=os.getenv("ANCHOR_DATE", "2026-04-22"),
        use_live_exa=os.getenv("USE_LIVE_EXA", "0") == "1",
        debug_token=os.getenv("DEBUG_TOKEN") or None,
    )


SETTINGS = load_settings()

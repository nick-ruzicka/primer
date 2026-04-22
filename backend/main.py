"""Primer backend — FastAPI app with SSE briefing endpoint.

Routes:
  GET  /health                          liveness + subsystem status
  GET  /api/accounts                    left-rail payload (grouped + standalone)
  GET  /briefing/{account_id}           SSE stream of a briefing
  GET  /debug/mcp-smoke                 one-call-per-server smoke probe
  GET  /debug/intelligence/{account_id} raw intelligence bundle (no agent)
  GET  /debug/context/{account_id}      context blob that would be sent to Claude
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from .accounts import account_exists, list_accounts, resolve_account_id
from .agent import build_context_blob, stream_brief, validate_brief
from .cache import CacheClient, get_cache, set_cache
from .config import SETTINGS
from .intelligence import fetch_intelligence, shape_sections, shape_sections_for_frontend
from .logging_setup import configure_logging
from .mcp_client import MCPPool, set_pool

log = logging.getLogger("backend")


# ---- lifespan --------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(SETTINGS.log_level)
    log.info(
        "startup.begin",
        extra={
            "database_path": SETTINGS.database_path,
            "redis_url": SETTINGS.redis_url,
            "briefing_model": SETTINGS.briefing_model,
            "validation_model": SETTINGS.validation_model,
            "anchor_date": SETTINGS.anchor_date,
            "anthropic_key_present": bool(SETTINGS.anthropic_api_key),
        },
    )

    pool = MCPPool()
    cache = CacheClient(
        SETTINGS.redis_url,
        SETTINGS.brief_cache_ttl_seconds,
        SETTINGS.rate_limit_per_hour,
    )
    try:
        await pool.connect_all()
        set_pool(pool)
        await cache.connect()
        set_cache(cache)
        log.info("startup.ready", extra={"servers": pool.servers, "cache": cache.available})
        yield
    finally:
        log.info("shutdown.begin")
        try:
            await cache.close()
        except Exception:  # noqa: BLE001
            log.exception("shutdown.cache_close_failed")
        set_cache(None)
        try:
            await pool.close_all()
        except Exception:  # noqa: BLE001
            log.exception("shutdown.pool_close_failed")
        set_pool(None)
        log.info("shutdown.done")


app = FastAPI(title="Primer Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ---- health + debug --------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, Any]:
    pool = None
    try:
        from .mcp_client import get_pool as _get_pool

        pool = _get_pool()
    except RuntimeError:
        pool = None

    try:
        cache = get_cache()
    except RuntimeError:
        cache = None

    if SETTINGS.anthropic_auth_token:
        anthropic_auth = "oauth"
    elif SETTINGS.anthropic_api_key:
        anthropic_auth = "api_key"
    else:
        anthropic_auth = "missing"

    return {
        "status": "ok",
        "anthropic_auth": anthropic_auth,
        "briefing_model": SETTINGS.briefing_model,
        "validation_model": SETTINGS.validation_model,
        "anchor_date": SETTINGS.anchor_date,
        "mcp_servers": pool.servers if pool else [],
        "cache_available": bool(cache and cache.available),
    }


@app.get("/debug/mcp-smoke")
async def mcp_smoke() -> dict[str, Any]:
    from .mcp_client import get_pool

    pool = get_pool()
    probe_account = "northstar_beauty"
    results: dict[str, Any] = {}
    for server in pool.servers:
        tools = pool.list_tools(server)
        if not tools:
            results[server] = {"_error": "no tools"}
            continue
        first_tool = tools[0]
        try:
            payload = await asyncio.wait_for(
                pool.call(server, first_tool, {"account_id": probe_account}),
                timeout=5.0,
            )
            results[server] = {
                "tool": first_tool,
                "ok": True,
                "type": type(payload).__name__,
                "sample_keys": list(payload.keys())[:6]
                if isinstance(payload, dict)
                else None,
            }
        except Exception as exc:  # noqa: BLE001
            results[server] = {"tool": first_tool, "ok": False, "error": str(exc)}
    return {"account_id": probe_account, "results": results}


@app.get("/debug/intelligence/{account_id}")
async def debug_intelligence(account_id: str) -> dict[str, Any]:
    from .mcp_client import get_pool

    canonical = resolve_account_id(account_id)
    if not account_exists(canonical):
        raise HTTPException(status_code=404, detail=f"Unknown account: {account_id}")
    account_id = canonical
    pool = get_pool()
    t0 = time.perf_counter()
    bundle = await fetch_intelligence(pool, account_id)
    duration_ms = int((time.perf_counter() - t0) * 1000)
    sections = shape_sections(bundle)
    return {
        "account_id": account_id,
        "duration_ms": duration_ms,
        "raw": bundle.to_raw(),
        "sections": sections,
    }


@app.get("/debug/context/{account_id}")
async def debug_context(account_id: str) -> dict[str, Any]:
    from .mcp_client import get_pool

    canonical = resolve_account_id(account_id)
    if not account_exists(canonical):
        raise HTTPException(status_code=404, detail=f"Unknown account: {account_id}")
    account_id = canonical
    pool = get_pool()
    bundle = await fetch_intelligence(pool, account_id)
    blob, fb = build_context_blob(account_id, bundle)
    return {
        "account_id": account_id,
        "context_blob": blob,
        "facts": [
            {
                "fact_id": f.fact_id,
                "source": f.source,
                "text": f.text,
                "timestamp": f.timestamp,
            }
            for f in fb.all()
        ],
    }


# ---- accounts --------------------------------------------------------------


@app.get("/api/accounts")
async def accounts() -> JSONResponse:
    payload = list_accounts()
    return JSONResponse(payload)


# ---- briefing SSE ---------------------------------------------------------




def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _sse(event: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data)}


async def _briefing_event_stream(
    account_id: str,
    refresh: bool,
    request: Request,
    cached_transcript: list[dict[str, Any]] | None = None,
) -> AsyncIterator[dict[str, str]]:
    from .mcp_client import get_pool

    pool = get_pool()
    cache = get_cache()
    started_at = time.perf_counter()
    transcript: list[dict[str, Any]] = []  # for caching

    def record_and_yield(event: str, data: dict[str, Any]) -> dict[str, str]:
        transcript.append({"event": event, "data": data})
        return _sse(event, data)

    # 1. Cache replay — the HTTP handler already pre-fetched so that rate
    # limiting could be skipped for hits. Just replay.
    if cached_transcript is not None:
        log.info(
            "briefing.cache_hit",
            extra={"account_id": account_id, "events": len(cached_transcript)},
        )
        for evt in cached_transcript:
            if await request.is_disconnected():
                return
            yield _sse(evt["event"], evt["data"])
            await asyncio.sleep(0.04)
        return

    # 2. Fan out. Emit intelligence events as soon as the bundle is ready.
    try:
        bundle = await fetch_intelligence(pool, account_id)
    except Exception as exc:  # noqa: BLE001
        log.exception("briefing.fetch_intelligence_failed", extra={"account_id": account_id})
        yield record_and_yield(
            "validation_warning",
            {
                "severity": "critical",
                "type": "missing_ground",
                "message": f"Intelligence fetch failed: {exc!s}",
                "brief_excerpt": "",
                "sources": [],
            },
        )
        yield record_and_yield("done", {"total_tokens": None, "duration_ms": 0})
        return

    sections = shape_sections_for_frontend(bundle)
    for section in sections:
        if await request.is_disconnected():
            return
        # Emit the whole IntelligenceSection object. Payload carries both
        # spec-legacy keys (section, sublabel, tone) and the frontend's
        # keys (id, sub, flag) so either consumer works.
        yield record_and_yield("intelligence", section)
        # Tiny spacing so the frontend can animate panels in
        await asyncio.sleep(0.02)

    # 3. Build the context blob + FactBook.
    try:
        context_blob, fact_book = build_context_blob(account_id, bundle)
    except Exception as exc:  # noqa: BLE001
        log.exception("briefing.context_blob_failed", extra={"account_id": account_id})
        yield record_and_yield(
            "validation_warning",
            {
                "severity": "critical",
                "type": "missing_ground",
                "message": f"Context construction failed: {exc!s}",
                "brief_excerpt": "",
                "sources": [],
            },
        )
        yield record_and_yield(
            "done",
            {
                "total_tokens": None,
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
            },
        )
        return

    # 4. Stream the brief from Claude.
    brief_markdown = ""
    total_tokens = 0
    try:
        async for evt in stream_brief(account_id, bundle, fact_book, context_blob):
            if await request.is_disconnected():
                return
            if evt.kind == "brief_chunk":
                yield record_and_yield("brief_chunk", evt.data)
            elif evt.kind == "source_cited":
                yield record_and_yield("source_cited", evt.data)
            elif evt.kind == "done":
                # Capture and fall through to validation
                brief_markdown = evt.data.get("brief_markdown", "")
                total_tokens = evt.data.get("total_tokens", 0)
    except Exception as exc:  # noqa: BLE001
        log.exception("briefing.stream_failed", extra={"account_id": account_id})
        yield record_and_yield(
            "validation_warning",
            {
                "severity": "critical",
                "type": "missing_ground",
                "message": f"Brief generation failed: {exc!s}",
                "brief_excerpt": "",
                "sources": [],
            },
        )
        yield record_and_yield(
            "done",
            {
                "total_tokens": None,
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
            },
        )
        return

    # 5. Validation pass.
    if brief_markdown:
        try:
            warnings = await validate_brief(account_id, brief_markdown, context_blob)
        except Exception as exc:  # noqa: BLE001
            log.exception("briefing.validation_failed", extra={"account_id": account_id})
            warnings = [
                {
                    "severity": "watch",
                    "type": "missing_ground",
                    "message": f"Validation unavailable: {exc!s}",
                    "brief_excerpt": "",
                    "sources": [],
                }
            ]
        for w in warnings:
            if await request.is_disconnected():
                return
            yield record_and_yield("validation_warning", w)
            await asyncio.sleep(0.08)

    # 6. Done + cache.
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    done_payload = {"total_tokens": total_tokens, "duration_ms": duration_ms}
    yield record_and_yield("done", done_payload)

    # Fire-and-forget cache write (don't block the stream returning).
    try:
        await cache.set_brief(account_id, transcript)
    except Exception:  # noqa: BLE001
        log.exception("briefing.cache_write_failed", extra={"account_id": account_id})

    log.info(
        "briefing.done",
        extra={
            "account_id": account_id,
            "duration_ms": duration_ms,
            "total_tokens": total_tokens,
            "events": len(transcript),
        },
    )


@app.get("/briefing/{account_id}")
async def briefing(account_id: str, request: Request, refresh: int = 0):
    canonical = resolve_account_id(account_id)
    if not account_exists(canonical):
        raise HTTPException(status_code=404, detail=f"Unknown account: {account_id}")
    account_id = canonical

    cache = get_cache()
    ip = _client_ip(request)

    # Pre-read the cache so rate-limiting only gates fresh generations. A
    # cache replay serves from Redis and consumes zero Anthropic tokens; it
    # has no reason to count against the 20/hr IP quota. This matters in
    # particular once nginx terminates on a single upstream IP — without
    # this check, every demo visitor would share one quota bucket even on
    # already-generated briefs.
    cached_transcript: list[dict[str, Any]] | None = None
    if not refresh:
        cached_transcript = await cache.get_brief(account_id)

    if cached_transcript is None:
        # Fresh generation path — rate-limit applies.
        allowed, remaining = await cache.check_rate_limit(ip)
        if not allowed:
            log.warning(
                "briefing.rate_limited",
                extra={"ip": ip, "account_id": account_id},
            )
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({SETTINGS.rate_limit_per_hour}/hour). Remaining: {remaining}",
            )
    else:
        remaining = None

    log.info(
        "briefing.begin",
        extra={
            "account_id": account_id,
            "refresh": bool(refresh),
            "ip": ip,
            "cache_prefetched": cached_transcript is not None,
            "remaining_quota": remaining,
        },
    )

    return EventSourceResponse(
        _briefing_event_stream(
            account_id, bool(refresh), request, cached_transcript=cached_transcript
        ),
        ping=15,
    )

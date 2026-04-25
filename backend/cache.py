"""Thin Redis wrapper for brief cache + per-IP rate limiting.

Degrades gracefully if Redis is unreachable: every method becomes a no-op
and ``available`` flips to False so callers can skip cache lookups without
raising.
"""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from typing import Any

import redis.asyncio as redis_asyncio

log = logging.getLogger(__name__)


class CacheClient:
    def __init__(self, url: str, brief_ttl: int, rate_limit_per_hour: int) -> None:
        self._url = url
        self._ttl = brief_ttl
        self._rate_limit = rate_limit_per_hour
        self._client: redis_asyncio.Redis | None = None
        self.available: bool = False
        # In-memory fallback for rate limiting when Redis is unavailable
        self._fallback_limits: defaultdict[str, list[float]] = defaultdict(list)

    async def connect(self) -> None:
        try:
            self._client = redis_asyncio.from_url(self._url, decode_responses=True)
            await self._client.ping()
            self.available = True
            log.info("cache.connected", extra={"url": self._url})
        except Exception as exc:  # noqa: BLE001
            self._client = None
            self.available = False
            log.warning("cache.unavailable", extra={"url": self._url, "error": str(exc)})

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            finally:
                self._client = None
                self.available = False

    async def get_brief(self, account_id: str) -> list[dict[str, Any]] | None:
        if not self.available or self._client is None:
            return None
        try:
            raw = await self._client.get(f"brief:{account_id}")
        except Exception as exc:  # noqa: BLE001
            log.warning("cache.get_failed", extra={"error": str(exc)})
            return None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            log.warning("cache.bad_json", extra={"account_id": account_id})
            return None

    async def set_brief(self, account_id: str, events: list[dict[str, Any]]) -> None:
        if not self.available or self._client is None:
            return
        try:
            await self._client.set(
                f"brief:{account_id}",
                json.dumps(events),
                ex=self._ttl,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("cache.set_failed", extra={"error": str(exc)})

    async def invalidate_brief(self, account_id: str) -> None:
        if not self.available or self._client is None:
            return
        try:
            await self._client.delete(f"brief:{account_id}")
        except Exception as exc:  # noqa: BLE001
            log.warning("cache.invalidate_failed", extra={"error": str(exc)})

    async def check_rate_limit(self, ip: str) -> tuple[bool, int]:
        """Return (allowed, remaining). Uses in-memory fallback if Redis is unavailable."""
        if not self.available or self._client is None:
            # In-memory fallback: track requests per IP for the past hour
            now = time.time()
            # Clean up old requests older than 1 hour
            self._fallback_limits[ip] = [
                t for t in self._fallback_limits[ip] if now - t < 3600
            ]
            count = len(self._fallback_limits[ip])
            if count >= self._rate_limit:
                remaining = 0
                allowed = False
                log.warning(
                    "rate_limit.fallback_denied",
                    extra={"ip": ip, "count": count, "limit": self._rate_limit},
                )
                return allowed, remaining
            self._fallback_limits[ip].append(now)
            remaining = self._rate_limit - count - 1
            return True, remaining
        try:
            key = f"ratelimit:{ip}"
            count = await self._client.incr(key)
            if count == 1:
                await self._client.expire(key, 3600)
            remaining = max(0, self._rate_limit - count)
            allowed = count <= self._rate_limit
            return allowed, remaining
        except Exception as exc:  # noqa: BLE001
            log.warning("cache.rate_limit_failed", extra={"error": str(exc)})
            # Fall back to in-memory tracking on error
            return await self.check_rate_limit(ip)


_cache: CacheClient | None = None


def set_cache(cache: CacheClient | None) -> None:
    global _cache
    _cache = cache


def get_cache() -> CacheClient:
    if _cache is None:
        raise RuntimeError("Cache client not initialized")
    return _cache


def now_ms() -> int:
    return int(time.time() * 1000)

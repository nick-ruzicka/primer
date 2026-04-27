"""Type-safe structured logging helper for FastAPI.

Provides LogContext for building structured logs with required fields
and optional context data, ensuring consistency across the codebase.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Any

log = logging.getLogger("backend")


@dataclass
class LogContext:
    """Structured log context with required base fields."""

    event: str
    account_id: str | None = None
    trace_id: str | None = None
    refresh: bool | None = None

    def with_context(self, **kwargs: Any) -> dict[str, Any]:
        """Merge dataclass fields with additional context."""
        base = asdict(self)
        base.pop("event")
        base.update({k: v for k, v in kwargs.items() if v is not None})
        return base

    def info(self, **kwargs: Any) -> None:
        """Log info level with structured context."""
        log.info(self.event, extra=self.with_context(**kwargs))

    def warning(self, **kwargs: Any) -> None:
        """Log warning level with structured context."""
        log.warning(self.event, extra=self.with_context(**kwargs))

    def error(self, exc: Exception | None = None, **kwargs: Any) -> None:
        """Log error level with structured context and optional exception."""
        if exc:
            log.exception(self.event, extra=self.with_context(**kwargs))
        else:
            log.error(self.event, extra=self.with_context(**kwargs))


def make_context(
    event: str,
    account_id: str | None = None,
    trace_id: str | None = None,
    refresh: bool | None = None,
) -> LogContext:
    """Factory for creating structured log contexts."""
    return LogContext(event=event, account_id=account_id, trace_id=trace_id, refresh=refresh)

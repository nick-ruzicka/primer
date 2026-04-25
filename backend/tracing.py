"""Distributed tracing for end-to-end request visibility.

Provides span tracking and correlation across service boundaries
using trace IDs established at request entry point.
"""

from __future__ import annotations

import json
import logging
import time
from contextvars import ContextVar
from dataclasses import dataclass, asdict
from typing import Any, Generator, TypeVar

log = logging.getLogger("backend")

T = TypeVar("T")

# Context variables for trace propagation
current_trace_id: ContextVar[str] = ContextVar("trace_id", default="")
current_span_id: ContextVar[str] = ContextVar("span_id", default="")


@dataclass
class SpanEvent:
    """A single event within a span."""

    timestamp: float
    name: str
    attributes: dict[str, Any]


@dataclass
class Span:
    """Represents a unit of work within a trace."""

    name: str
    trace_id: str
    span_id: str
    start_time: float
    end_time: float | None = None
    duration_ms: float | None = None
    status: str = "unset"
    events: list[SpanEvent] = None

    def __post_init__(self) -> None:
        if self.events is None:
            self.events = []

    def end(self) -> None:
        """Mark span as complete."""
        if self.end_time is None:
            self.end_time = time.perf_counter()
            self.duration_ms = (self.end_time - self.start_time) * 1000

    def add_event(self, name: str, attributes: dict[str, Any] | None = None) -> None:
        """Record an event within the span."""
        self.events.append(
            SpanEvent(timestamp=time.perf_counter(), name=name, attributes=attributes or {})
        )

    def set_status(self, status: str) -> None:
        """Set the final status (ok, error, etc)."""
        self.status = status

    def to_dict(self) -> dict[str, Any]:
        """Convert span to dictionary for serialization."""
        return {
            **asdict(self),
            "events": [asdict(e) for e in self.events],
        }


class SpanContext:
    """Context manager for creating and tracking spans."""

    def __init__(self, name: str, trace_id: str, span_id: str):
        self.span = Span(
            name=name, trace_id=trace_id, span_id=span_id, start_time=time.perf_counter()
        )
        self._token = None

    def __enter__(self) -> Span:
        self._token = current_span_id.set(self.span.span_id)
        return self.span

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.span.end()
        if exc_type:
            self.span.set_status("error")
            log.debug(
                f"span.error",
                extra={
                    "trace_id": self.span.trace_id,
                    "span_id": self.span.span_id,
                    "error": str(exc_val),
                },
            )
        else:
            self.span.set_status("ok")
        if self._token:
            current_span_id.reset(self._token)


def create_span(name: str, trace_id: str = "", span_id: str = "") -> SpanContext:
    """Create a new span within a trace."""
    _trace_id = trace_id or current_trace_id.get()
    _span_id = span_id or f"span_{int(time.perf_counter() * 1000000)}"
    return SpanContext(name, _trace_id, _span_id)


def set_trace_id(trace_id: str) -> None:
    """Set the trace ID for the current context."""
    current_trace_id.set(trace_id)


def get_trace_id() -> str:
    """Get the current trace ID."""
    return current_trace_id.get()


def get_span_id() -> str:
    """Get the current span ID."""
    return current_span_id.get()


class TracedIterable:
    """Wrapper for tracking iteration progress within a span."""

    def __init__(self, items: list[T], name: str):
        self.items = items
        self.name = name
        self.index = 0

    def __iter__(self) -> Generator[T, None, None]:
        for idx, item in enumerate(self.items):
            self.index = idx
            span = create_span(f"{self.name}[{idx}]")
            span.span.add_event("item_start", {"index": idx})
            with span:
                yield item
            span.span.add_event("item_end", {"index": idx})

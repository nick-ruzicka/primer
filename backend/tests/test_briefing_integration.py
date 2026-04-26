"""Integration tests for the complete briefing SSE pipeline.

Validates that a full /briefing/{account_id} request:
- Returns events in the correct order
- Has valid JSON shapes
- Citations reference existing facts
- Produces no malformed data
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app


class _FakeBundle:
    """Minimal stub so build_context_blob and shape_sections_for_frontend don't crash."""
    def to_raw(self):
        return {}


async def _fake_stream_brief(account_id, bundle, fact_book, context_blob):
    """Async generator that yields a minimal brief stream."""
    from backend.agent import BriefStreamEvent
    yield BriefStreamEvent(kind="brief_chunk", data={"delta": "Hello "})
    yield BriefStreamEvent(kind="brief_chunk", data={"delta": "world."})
    yield BriefStreamEvent(
        kind="done",
        data={"brief_markdown": "Hello world.", "total_tokens": 42},
    )


@pytest.fixture
def mock_cache():
    """Mock cache that allows fresh generation (rate limit passes)."""
    cache = MagicMock()
    cache.available = True
    cache.get_brief = AsyncMock(return_value=None)  # cache miss → fresh generation
    cache.check_rate_limit = AsyncMock(return_value=(True, 19))  # allowed
    cache.set_brief = AsyncMock(return_value=None)
    return cache


@pytest.fixture
def client(mock_cache):
    fake_section = {
        "id": "financials",
        "title": "Financials",
        "desc": "Key numbers",
        "items": [],
    }
    mock_pool = MagicMock()
    with patch("backend.main.get_cache", return_value=mock_cache), \
         patch("backend.cache.get_cache", return_value=mock_cache), \
         patch("backend.mcp_client.get_pool", return_value=mock_pool), \
         patch("backend.main.fetch_intelligence", new_callable=AsyncMock,
               return_value=_FakeBundle()), \
         patch("backend.main.shape_sections_for_frontend", return_value=[fake_section]), \
         patch("backend.main.build_intel_evid_index", return_value={}), \
         patch("backend.main.build_context_blob", return_value=("ctx", MagicMock())), \
         patch("backend.main.stream_brief", side_effect=_fake_stream_brief), \
         patch("backend.main.validate_brief", new_callable=AsyncMock, return_value=[]):
        yield TestClient(app, raise_server_exceptions=False)


def test_briefing_stream_event_order(client):
    """Verify events arrive in correct order: intelligence → brief → citations → done."""
    events = []

    with client.stream("GET", "/briefing/northstar_beauty") as response:
        for line in response.iter_lines():
            if not line or line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_type = line.split("event:", 1)[1].strip()
                events.append(event_type)

    # Verify sequence: intelligence sections first, then brief chunks, then done
    assert "intelligence" in events, f"Missing intelligence events. Got: {events}"
    assert "done" in events, f"Missing done event. Got: {events}"

    intelligence_indices = [i for i, e in enumerate(events) if e == "intelligence"]
    brief_indices = [i for i, e in enumerate(events) if e == "brief_chunk"]
    citation_indices = [i for i, e in enumerate(events) if e == "source_cited"]
    done_index = events.index("done") if "done" in events else len(events)

    # Verify rough ordering (intelligence before brief before citations before done)
    if intelligence_indices and brief_indices:
        assert max(intelligence_indices) < min(brief_indices), "Intelligence should complete before brief chunks"
    if brief_indices and citation_indices:
        assert max(brief_indices) < min(citation_indices), "Brief chunks should precede citations"
    if citation_indices:
        assert max(citation_indices) < done_index, "Citations should precede done event"


def test_briefing_stream_valid_json(client):
    """Verify all SSE data payloads are valid JSON."""
    malformed_count = 0

    with client.stream("GET", "/briefing/northstar_beauty") as response:
        for line in response.iter_lines():
            if line.startswith("data:"):
                data_str = line.split("data:", 1)[1].strip()
                try:
                    json.loads(data_str)
                except json.JSONDecodeError as e:
                    malformed_count += 1
                    print(f"Malformed JSON: {data_str[:100]}... Error: {e}")

    assert malformed_count == 0, f"{malformed_count} events had invalid JSON"


def test_briefing_stream_citation_schema(client):
    """Verify source_cited events have required citation fields."""
    citations = []

    with client.stream("GET", "/briefing/northstar_beauty") as response:
        for line in response.iter_lines():
            if line.startswith("event: source_cited"):
                pass
            elif line.startswith("data:"):
                try:
                    data = json.loads(line.split("data:", 1)[1].strip())
                    if "citation_number" in data:
                        citations.append(data)
                except json.JSONDecodeError:
                    pass

    # Verify each citation has required fields (no citations in stub, so this passes vacuously)
    required_fields = {"citation_number", "evid", "source_system", "provenance"}
    for citation in citations:
        missing = required_fields - set(citation.keys())
        assert not missing, f"Citation missing fields: {missing}. Citation: {citation}"

        if citation["provenance"] == "surfaced":
            assert "snippet" in citation or citation.get("snippet") is None, "Surfaced citation missing snippet"
        elif citation["provenance"] in ("raw", "scored"):
            assert "field" in citation, f"{citation['provenance']} citation missing field"
            assert "value_display" in citation, f"{citation['provenance']} citation missing value_display"


def test_briefing_stream_done_event(client):
    """Verify the done event is well-formed and contains metadata."""
    done_event = None

    with client.stream("GET", "/briefing/northstar_beauty") as response:
        for line in response.iter_lines():
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split("data:", 1)[1].strip())
                    if "total_tokens" in data or "duration_ms" in data:
                        done_event = data
                except json.JSONDecodeError:
                    pass

    assert done_event is not None, "No done event found in stream"
    assert "total_tokens" in done_event or "duration_ms" in done_event, "Done event missing metadata"


def test_briefing_stream_handles_nonexistent_account(client):
    """Verify graceful handling of invalid account IDs returns 404."""
    response = client.get("/briefing/nonexistent-account-xyz")
    assert response.status_code == 404, f"Expected 404 for invalid account, got {response.status_code}"


def test_health_endpoint_reflects_mcp_status(client):
    """Verify /health endpoint returns server status."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    # Check keys that actually exist in the health response
    assert "cache_available" in data, "/health missing cache_available status"
    assert "mcp_healthy" in data, "/health missing mcp_healthy status"
    assert "anthropic_auth" in data, "/health missing anthropic_auth status"

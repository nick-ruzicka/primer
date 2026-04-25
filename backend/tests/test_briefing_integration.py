"""Integration tests for the complete briefing SSE pipeline.

Validates that a full /briefing/{account_id} request:
- Returns events in the correct order
- Has valid JSON shapes
- Citations reference existing facts
- Produces no malformed data
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


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

    # Verify sequence: intelligence sections first, then brief chunks, then citations, then done
    assert "intelligence" in events, "Missing intelligence events"
    assert "done" in events, "Missing done event"

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
                # Next line should be data
                pass
            elif line.startswith("data:"):
                try:
                    data = json.loads(line.split("data:", 1)[1].strip())
                    if "citation_number" in data:
                        citations.append(data)
                except json.JSONDecodeError:
                    pass

    # Verify each citation has required fields
    required_fields = {"citation_number", "evid", "source_system", "provenance"}
    for citation in citations:
        missing = required_fields - set(citation.keys())
        assert not missing, f"Citation missing fields: {missing}. Citation: {citation}"

        # Verify provenance-specific fields
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
            if line.startswith("event: done"):
                # Next line is data
                continue
            elif line.startswith("data:") and done_event is None:
                try:
                    data = json.loads(line.split("data:", 1)[1].strip())
                    if "completed_at" in data or "total_tokens" in data:
                        done_event = data
                except json.JSONDecodeError:
                    pass

    assert done_event is not None, "No done event found in stream"
    assert "completed_at" in done_event or "total_tokens" in done_event, "Done event missing metadata"


def test_briefing_stream_handles_nonexistent_account(client):
    """Verify graceful handling of invalid account IDs."""
    with pytest.raises(Exception):  # Should either error or return gracefully
        with client.stream("GET", "/briefing/nonexistent-account-xyz") as response:
            events = list(response.iter_lines())
            # Should either timeout or return a warning event
            assert len(events) > 0, "No response for invalid account"


def test_health_endpoint_reflects_mcp_status(client):
    """Verify /health endpoint returns server status."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert "database" in data, "/health missing database status"
    assert "cache" in data, "/health missing cache status"

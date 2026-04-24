"""Tests for Fact provenance extension (spec §4.1)."""
from backend.agent import Fact, FactBook


def test_fact_carries_raw_provenance():
    fb = FactBook()
    fact = fb.add(
        provenance="raw",
        source="salesforce",
        source_system="Salesforce",
        source_module="Accounts",
        field="account_name",
        value_display="Northstar Beauty",
        retrieved_at="2026-04-24T14:00:00Z",
        time_ago="pulled 2h ago",
        text="Salesforce account_name: Northstar Beauty.",
    )
    assert fact.provenance == "raw"
    assert fact.source_system == "Salesforce"
    assert fact.source_module == "Accounts"
    assert fact.field == "account_name"
    assert fact.value_display == "Northstar Beauty"
    assert fact.snippet is None
    assert fact.url is None


def test_fact_carries_scored_provenance():
    fb = FactBook()
    fact = fb.add(
        provenance="scored",
        source="catalyst",
        source_system="Catalyst",
        source_module="Relationship health",
        field="relationship_score",
        value_display="61 / 100",
        retrieved_at="2026-04-24T14:00:00Z",
        data_as_of="2026-04-22T00:00:00Z",
        time_ago="pulled 14m ago",
        text="Catalyst relationship_score: 61 (was 68, delta -7).",
    )
    assert fact.provenance == "scored"
    assert fact.field == "relationship_score"
    assert fact.data_as_of == "2026-04-22T00:00:00Z"


def test_fact_carries_surfaced_provenance_with_url():
    fb = FactBook()
    fact = fb.add(
        provenance="surfaced",
        source="exa",
        source_system="Exa",
        source_module="LinkedIn post by Priya Shah",
        snippet="Thinking hard about vendor consolidation for 2026.",
        url="https://linkedin.com/posts/priya-shah-abc123",
        retrieved_at="2026-04-24T14:00:00Z",
        data_as_of="2026-04-09T00:00:00Z",
        time_ago="posted 13d ago",
        text="Exa LinkedIn post by Priya Shah: Thinking hard about...",
    )
    assert fact.provenance == "surfaced"
    assert fact.snippet == "Thinking hard about vendor consolidation for 2026."
    assert fact.url == "https://linkedin.com/posts/priya-shah-abc123"
    assert fact.field is None


def test_fact_book_lookup_still_works():
    fb = FactBook()
    fact = fb.add(
        provenance="raw",
        source="salesforce",
        source_system="Salesforce",
        field="stage",
        value_display="Expansion",
        retrieved_at="2026-04-24T14:00:00Z",
        time_ago="pulled 2h ago",
        text="stage: Expansion",
    )
    assert fb.lookup(fact.fact_id) is fact
    assert fb.lookup(999) is None

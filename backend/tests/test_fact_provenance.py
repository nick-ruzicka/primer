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


def test_source_cited_payload_includes_new_fields():
    """When a fact is emitted via source_cited, the payload must carry the
    full provenance shape alongside the legacy source/fact/evid fields."""
    from backend.agent import _build_source_cited_payload
    fb = FactBook()
    f = fb.add(
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
    payload = _build_source_cited_payload(f)
    # new fields
    assert payload["provenance"] == "scored"
    assert payload["source_system"] == "Catalyst"
    assert payload["source_module"] == "Relationship health"
    assert payload["field"] == "relationship_score"
    assert payload["value_display"] == "61 / 100"
    assert payload["retrieved_at"] == "2026-04-24T14:00:00Z"
    assert payload["data_as_of"] == "2026-04-22T00:00:00Z"
    assert payload["time_ago"] == "pulled 14m ago"
    assert payload["url"] is None
    assert payload["citation_number"] == f.fact_id
    # back-compat fields
    assert payload["source"] == "catalyst"
    assert payload["fact"] == f.text
    assert payload["evid"] == f.text
    assert payload["label"] == f.text  # label == fact.text during migration


def test_source_cited_payload_for_surfaced_includes_url_and_snippet():
    from backend.agent import _build_source_cited_payload
    fb = FactBook()
    f = fb.add(
        provenance="surfaced",
        source="exa",
        source_system="Exa",
        source_module="LinkedIn post by Priya Shah",
        snippet="Thinking hard about vendor consolidation for 2026.",
        url="https://linkedin.com/posts/priya-shah-abc123",
        retrieved_at="2026-04-24T14:00:00Z",
        data_as_of="2026-04-09T00:00:00Z",
        time_ago="posted 13d ago",
        text="Exa LinkedIn post: Thinking hard about vendor consolidation for 2026.",
    )
    payload = _build_source_cited_payload(f)
    assert payload["snippet"] == "Thinking hard about vendor consolidation for 2026."
    assert payload["url"] == "https://linkedin.com/posts/priya-shah-abc123"
    assert payload["field"] is None
    assert payload["value_display"] is None


def test_now_iso_returns_z_suffix():
    from backend.agent import _now_iso
    result = _now_iso()
    assert result.endswith("Z")
    assert "T" in result  # ISO datetime format


def test_time_ago_from_iso_relative_string():
    from backend.agent import _time_ago_from_iso
    # Anchor-aware — the project pins ANCHOR_DATE in .env; the helper
    # reads that and computes relative to it. Test passes an explicit anchor.
    assert _time_ago_from_iso("2026-04-24T12:00:00Z", anchor="2026-04-24T14:00:00Z") == "2h ago"
    assert _time_ago_from_iso("2026-04-23T14:00:00Z", anchor="2026-04-24T14:00:00Z") == "1d ago"
    assert _time_ago_from_iso(None, anchor="2026-04-24T14:00:00Z") == "—"


def test_time_ago_from_iso_sub_hour_windows():
    from backend.agent import _time_ago_from_iso
    assert _time_ago_from_iso("2026-04-24T13:59:30Z", anchor="2026-04-24T14:00:00Z") == "30s ago"
    assert _time_ago_from_iso("2026-04-24T13:45:00Z", anchor="2026-04-24T14:00:00Z") == "15m ago"


def test_build_context_blob_emits_per_field_salesforce_facts():
    """After the refactor, Salesforce get_account should emit one fact per
    meaningful attribute, not one bundled fact."""
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle

    bundle = IntelligenceBundle(
        salesforce={
            "get_account": {
                "account_name": "Northstar Beauty",
                "parent_account_name": "Northstar Group",
                "industry": "Beauty & Personal Care",
                "segment": "DTC",
                "arr_cents": 94_000_000,
                "employees": 260,
                "hq_city": "Los Angeles",
                "hq_state": "CA",
                "stage": "Renewal",
                "state": "hot",
                "owner_name": "Morgan Yu",
                "owner_role": "Senior Account Executive",
            }
        },
        catalyst={}, netsuite={}, gong={}, snowflake={}, exa={},
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    sf_facts = [f for f in fb.all() if f.source == "salesforce"]
    # Expect at least: account_name, industry+segment, arr, employees,
    # hq, stage, owner = ~7 facts from get_account alone
    assert len(sf_facts) >= 6
    assert all(f.provenance == "raw" for f in sf_facts)
    assert all(f.field is not None for f in sf_facts)
    assert all(f.source_system == "Salesforce" for f in sf_facts)
    fields = {f.field for f in sf_facts}
    assert "account_name" in fields
    assert "arr_cents" in fields
    assert "stage" in fields

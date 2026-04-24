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


def test_build_context_blob_splits_catalyst_by_provenance():
    """Catalyst's get_relationship_health mixes RAW (status, last exec
    touch) and SCORED (relationship_score, score_delta) fields."""
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle

    bundle = IntelligenceBundle(
        salesforce={},
        catalyst={
            "get_relationship_health": {
                "relationship_status": "Watchlist",
                "status_since": "2026-04-01",
                "relationship_score": 61,
                "relationship_score_prior": 68,
                "relationship_score_delta": -7,
                "last_executive_touch": "2026-03-10",
            },
            "get_renewal_forecast": {
                "renewal_forecast": "Best Case",
                "notes": "ap_block_opened",
            },
            "get_expansion_readiness": {
                "expansion_readiness": "Hold",
            },
        },
        netsuite={}, gong={}, snowflake={}, exa={},
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    catalyst_facts = [f for f in fb.all() if f.source == "catalyst"]
    by_field = {f.field: f for f in catalyst_facts}

    assert by_field["relationship_status"].provenance == "raw"
    assert by_field["last_executive_touch"].provenance == "raw"
    assert by_field["relationship_score"].provenance == "scored"
    assert by_field["renewal_forecast"].provenance == "scored"
    assert by_field["expansion_readiness"].provenance == "scored"

    assert by_field["relationship_score"].value_display == "61 / 100"
    assert by_field["renewal_forecast"].value_display == "Best Case"


def test_build_context_blob_netsuite_all_raw():
    """NetSuite fields are all RAW — ledger values and deterministic rule
    outputs (AP policy flags). Spec §4.4 refinement."""
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle
    bundle = IntelligenceBundle(
        salesforce={}, catalyst={}, gong={}, snowflake={}, exa={},
        netsuite={
            "get_billing_status": {
                "past_due_balance_cents": 1_850_000,
                "days_overdue": 41,
                "current_balance_cents": 5_200_000,
            },
            "get_ap_policy_flags": [
                {"flag_name": "past_due_block", "flag_reason": "overdue > 30d"},
            ],
            "get_recent_invoices": [
                {"invoice_id": "INV-2026-0042", "amount_cents": 1_850_000,
                 "status": "past_due", "due_date": "2026-03-14"},
            ],
        },
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    ns_facts = [f for f in fb.all() if f.source == "netsuite"]
    assert all(f.provenance == "raw" for f in ns_facts), (
        f"expected all RAW, got {[(f.field, f.provenance) for f in ns_facts]}"
    )
    fields = {f.field for f in ns_facts}
    assert "past_due_balance" in fields
    assert "days_overdue" in fields
    assert any(f.startswith("ap_flag.") for f in fields)
    assert any(f.startswith("invoice.") for f in fields)


def test_build_context_blob_gong_competitor_split():
    """Gong get_competitor_mentions produces RAW (competitor_name, excerpt)
    and SCORED (sentiment) facts from the same record."""
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle
    bundle = IntelligenceBundle(
        salesforce={}, catalyst={}, netsuite={}, snowflake={}, exa={},
        gong={
            "get_competitor_mentions": [
                {
                    "competitor_name": "Klaviyo",
                    "excerpt": "We're evaluating Klaviyo for the summer relaunch.",
                    "sentiment": "negative",
                    "call_date": "2026-04-18",
                },
            ],
        },
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    gong_facts = [f for f in fb.all() if f.source == "gong"]
    by_prov: dict[str, list[str]] = {}
    for f in gong_facts:
        by_prov.setdefault(f.provenance, []).append(f.field or "")
    assert "raw" in by_prov
    assert "scored" in by_prov
    assert any("sentiment" in f for f in by_prov["scored"])
    assert any("competitor" in f or "excerpt" in f for f in by_prov["raw"])


def test_build_context_blob_snowflake_split():
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle
    bundle = IntelligenceBundle(
        salesforce={}, catalyst={}, netsuite={}, gong={}, exa={},
        snowflake={
            "get_usage_metrics": {
                "sends_30d": 3_124_112,
                "sends_prior_30d": 3_801_440,
                "mau": 482_000,
            },
            "get_portfolio_comparison": {
                "peer_median_sends_30d": 2_900_000,
                "percentile": 68,
            },
        },
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    snow_facts = [f for f in fb.all() if f.source == "snowflake"]
    by_field = {f.field: f for f in snow_facts}
    assert by_field["sends_30d"].provenance == "raw"
    assert by_field["mau"].provenance == "raw"
    assert by_field["percentile"].provenance == "scored"


def test_build_context_blob_exa_surfaced_with_url():
    from backend.agent import build_context_blob
    from backend.intelligence import IntelligenceBundle
    bundle = IntelligenceBundle(
        salesforce={}, catalyst={}, netsuite={}, gong={}, snowflake={},
        exa={
            "search_account_signals": [
                {
                    "title": "LinkedIn post by Priya Shah",
                    "snippet": "Thinking hard about vendor consolidation for 2026.",
                    "url": "https://linkedin.com/posts/priya-shah-abc123",
                    "published_at": "2026-04-09",
                },
            ],
        },
    )
    _ctx, fb = build_context_blob("ns-beauty", bundle)
    exa_facts = [f for f in fb.all() if f.source == "exa"]
    assert len(exa_facts) >= 1
    ef = exa_facts[0]
    assert ef.provenance == "surfaced"
    assert ef.snippet == "Thinking hard about vendor consolidation for 2026."
    assert ef.url == "https://linkedin.com/posts/priya-shah-abc123"
    assert ef.field is None
    assert ef.value_display is None

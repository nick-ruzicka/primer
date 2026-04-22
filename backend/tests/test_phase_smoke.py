"""Phase-smoke tests — exercise real subsystems, not mocks.

These require:
  - the MCP pool (real stdio subprocesses)
  - a seeded SQLite DB at DATABASE_PATH
  - (for test_brief_e2e) a valid Anthropic credential in .env

They are intentionally coarse-grained: one test per phase verifies the
end-to-end contract. Run with:

    uv run pytest backend/tests -v

To skip the Anthropic-dependent tests without a key set, they detect
missing credentials and self-skip.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from backend.accounts import account_exists, list_accounts
from backend.agent import build_context_blob
from backend.config import SETTINGS
from backend.intelligence import fetch_intelligence, shape_sections
from backend.mcp_client import MCPPool


@pytest_asyncio.fixture(scope="module")
async def pool():
    p = MCPPool()
    await p.connect_all()
    try:
        yield p
    finally:
        # AsyncExitStack teardown can raise anyio's "different task" error
        # when pytest-asyncio shifts the loop between module-scope fixture
        # entry and exit. Tests have already asserted; don't fail teardown.
        try:
            await p.close_all()
        except Exception:  # noqa: BLE001
            pass


def test_accounts_endpoint_shape() -> None:
    payload = list_accounts()
    assert "groups" in payload
    assert "standalone" in payload
    billable = sum(len(g["accounts"]) for g in payload["groups"]) + len(payload["standalone"])
    assert billable == 10, f"expected 10 billable accounts, got {billable}"
    northstar = next(
        (g for g in payload["groups"] if g["parent_id"] == "northstar_group"), None
    )
    assert northstar is not None
    assert northstar["combined_arr_cents"] == 307_000_000
    assert len(northstar["accounts"]) == 3


def test_account_exists() -> None:
    assert account_exists("northstar_beauty")
    assert not account_exists("fake_account_id")


@pytest.mark.asyncio
async def test_mcp_pool_connects_all_six(pool: MCPPool) -> None:
    servers = pool.servers
    assert set(servers) == {
        "salesforce",
        "snowflake",
        "catalyst",
        "netsuite",
        "gong",
        "exa",
    }
    for s in servers:
        tools = pool.list_tools(s)
        assert tools, f"no tools for {s}"


@pytest.mark.asyncio
async def test_intelligence_fanout_has_all_sections(pool: MCPPool) -> None:
    bundle = await fetch_intelligence(pool, "northstar_beauty")
    sections = shape_sections(bundle)
    assert set(sections.keys()) == {
        "relationship",
        "commercial",
        "product_usage",
        "conversations",
        "portfolio",
        "external",
    }
    # Commercial should surface both the forecast disagreement and past due.
    commercial_labels = [item["label"] for item in sections["commercial"]]
    assert "Salesforce forecast" in commercial_labels
    assert "Catalyst forecast" in commercial_labels
    assert "AP blocked" in commercial_labels
    # Past-due tone is bad.
    past_due = next(i for i in sections["commercial"] if i["label"] == "Past due")
    assert past_due["tone"] == "bad"


@pytest.mark.asyncio
async def test_null_semantics_preserved_for_prospect(pool: MCPPool) -> None:
    bundle = await fetch_intelligence(pool, "tidepool_swim")
    # Prospect: no contract row (null), no billing row (null),
    # relationship_health is a dict with null fields + notes.
    assert bundle.salesforce["get_contract"] is None
    assert bundle.netsuite["get_billing_status"] is None
    health = bundle.catalyst["get_relationship_health"]
    assert isinstance(health, dict)
    assert health["relationship_status"] is None
    assert "Prospect" in (health.get("notes") or "")


@pytest.mark.asyncio
async def test_context_blob_has_monotonic_fact_ids(pool: MCPPool) -> None:
    bundle = await fetch_intelligence(pool, "northstar_beauty")
    blob, fact_book = build_context_blob("northstar_beauty", bundle)
    facts = fact_book.all()
    assert len(facts) > 10, "expected many facts for northstar_beauty"
    # IDs increment monotonically starting at 1.
    for i, f in enumerate(facts, start=1):
        assert f.fact_id == i
    # Forecast disagreement should be two separate facts with different sources.
    cat_forecast_facts = [f for f in facts if "Catalyst renewal forecast" in f.text]
    sf_renewal_facts = [f for f in facts if "Renewal FY27" in f.text]
    assert cat_forecast_facts and sf_renewal_facts
    assert cat_forecast_facts[0].source == "catalyst"
    assert sf_renewal_facts[0].source == "salesforce"
    # Money formatting — ensure no 100x errors.
    arr_facts = [f for f in facts if "$940K" in f.text or "940.00K" in f.text or "$940.00K" in f.text]
    assert arr_facts, "ARR should render as $940K (cents → dollars)"


@pytest.mark.asyncio
async def test_e2e_brief_smoke(pool: MCPPool) -> None:
    if not (SETTINGS.anthropic_auth_token or SETTINGS.anthropic_api_key):
        pytest.skip("No Anthropic credentials in environment")
    from backend.agent import stream_brief

    bundle = await fetch_intelligence(pool, "ember_coffee")
    blob, fb = build_context_blob("ember_coffee", bundle)
    chunks: list[str] = []
    citations = 0
    async for evt in stream_brief("ember_coffee", bundle, fb, blob):
        if evt.kind == "brief_chunk":
            chunks.append(evt.data["delta"])
        elif evt.kind == "source_cited":
            citations += 1
        elif evt.kind == "done":
            brief = evt.data["brief_markdown"]
            break
    full = "".join(chunks)
    assert len(full) > 500, "brief should be at least a few hundred chars"
    assert "01 · The read" in full or "01  · The read" in full
    # Ember is a clean account — should have several citations.
    assert citations >= 3

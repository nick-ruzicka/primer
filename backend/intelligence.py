"""Parallel MCP fan-out + context-blob construction for the briefing agent.

Shape of the returned bundle mirrors the intelligence-panel sections the
frontend renders: relationship, commercial, product_usage, conversations,
portfolio, external.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from .mcp_client import MCPPool

log = logging.getLogger(__name__)

TOOL_TIMEOUT_SECONDS = 5.0


# ---- raw fetchers ----------------------------------------------------------


async def _safe_call(
    pool: MCPPool, server: str, tool: str, account_id: str
) -> Any:
    try:
        return await asyncio.wait_for(
            pool.call(server, tool, {"account_id": account_id}),
            timeout=TOOL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        log.warning("intelligence.tool_timeout", extra={"server": server, "tool": tool})
        return {"_error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        log.exception("intelligence.tool_error", extra={"server": server, "tool": tool})
        return {"_error": str(exc)}


async def _fetch_salesforce(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = [
        "get_account",
        "get_contract",
        "get_contacts",
        "get_open_opportunities",
        "get_recent_closed_opportunities",
        "get_account_hierarchy",
    ]
    results = await asyncio.gather(
        *[_safe_call(pool, "salesforce", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


async def _fetch_snowflake(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = ["get_usage_metrics", "get_portfolio_comparison"]
    results = await asyncio.gather(
        *[_safe_call(pool, "snowflake", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


async def _fetch_catalyst(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = ["get_relationship_health", "get_renewal_forecast", "get_expansion_readiness"]
    results = await asyncio.gather(
        *[_safe_call(pool, "catalyst", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


async def _fetch_netsuite(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = ["get_billing_status", "get_ap_policy_flags", "get_recent_invoices"]
    results = await asyncio.gather(
        *[_safe_call(pool, "netsuite", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


async def _fetch_gong(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = ["get_recent_calls", "get_competitor_mentions", "get_pricing_signals"]
    results = await asyncio.gather(
        *[_safe_call(pool, "gong", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


async def _fetch_exa(pool: MCPPool, account_id: str) -> dict[str, Any]:
    keys = ["search_account_signals", "get_decision_maker_signals"]
    results = await asyncio.gather(
        *[_safe_call(pool, "exa", k, account_id) for k in keys]
    )
    return dict(zip(keys, results))


@dataclass
class IntelligenceBundle:
    salesforce: dict[str, Any] = field(default_factory=dict)
    snowflake: dict[str, Any] = field(default_factory=dict)
    catalyst: dict[str, Any] = field(default_factory=dict)
    netsuite: dict[str, Any] = field(default_factory=dict)
    gong: dict[str, Any] = field(default_factory=dict)
    exa: dict[str, Any] = field(default_factory=dict)

    def to_raw(self) -> dict[str, Any]:
        return {
            "salesforce": self.salesforce,
            "snowflake": self.snowflake,
            "catalyst": self.catalyst,
            "netsuite": self.netsuite,
            "gong": self.gong,
            "exa": self.exa,
        }


async def fetch_intelligence(pool: MCPPool, account_id: str) -> IntelligenceBundle:
    """Parallel fan-out across all six MCP servers for one account."""
    sf, sn, cat, ns, gg, ex = await asyncio.gather(
        _fetch_salesforce(pool, account_id),
        _fetch_snowflake(pool, account_id),
        _fetch_catalyst(pool, account_id),
        _fetch_netsuite(pool, account_id),
        _fetch_gong(pool, account_id),
        _fetch_exa(pool, account_id),
    )
    return IntelligenceBundle(
        salesforce=sf, snowflake=sn, catalyst=cat, netsuite=ns, gong=gg, exa=ex
    )


# ---- section shaping for the intelligence panel ---------------------------


def _money(cents: int | None) -> str:
    if cents is None:
        return "—"
    dollars = cents / 100
    if dollars >= 1_000_000:
        return f"${dollars / 1_000_000:.1f}M"
    if dollars >= 1_000:
        return f"${dollars / 1_000:.0f}K"
    return f"${dollars:,.0f}"


def relationship_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    health = bundle.catalyst.get("get_relationship_health")
    expansion = bundle.catalyst.get("get_expansion_readiness")
    raw_contacts = bundle.salesforce.get("get_contacts")
    contacts: list[dict[str, Any]] = raw_contacts if isinstance(raw_contacts, list) else []

    items: list[dict[str, Any]] = []

    if isinstance(health, dict):
        status = health.get("relationship_status")
        if status:
            items.append(
                {
                    "label": "Status",
                    "value": status,
                    "sublabel": f"since {health.get('status_since')}"
                    if health.get("status_since")
                    else None,
                    "tone": _tone_for_status(status),
                    "source": "catalyst",
                    "field": "relationship_status",
                }
            )
        score = health.get("relationship_score")
        if score is not None:
            prior = health.get("relationship_score_prior")
            delta = health.get("relationship_score_delta")
            items.append(
                {
                    "label": "Relationship score",
                    "value": str(score),
                    "sublabel": (
                        f"was {prior} ({'+' if (delta or 0) > 0 else ''}{delta})"
                        if prior is not None and delta is not None
                        else None
                    ),
                    "tone": _tone_for_delta(delta),
                    "source": "catalyst",
                    "field": "relationship_score",
                }
            )
        last_touch = health.get("last_executive_touch")
        if last_touch:
            items.append(
                {
                    "label": "Last exec touch",
                    "value": last_touch,
                    "source": "catalyst",
                    "field": "last_executive_touch",
                }
            )
        notes = health.get("notes")
        if notes:
            items.append(
                {
                    "label": "Notes",
                    "value": notes,
                    "source": "catalyst",
                    "field": "notes",
                }
            )

    if isinstance(expansion, dict) and expansion.get("expansion_readiness"):
        items.append(
            {
                "label": "Expansion readiness",
                "value": expansion["expansion_readiness"],
                "source": "catalyst",
                "field": "expansion_readiness",
            }
        )

    champion = next(
        (c for c in contacts if c.get("role") == "Champion"),
        None,
    )
    exec_sponsor = next(
        (c for c in contacts if c.get("role") == "Executive Sponsor"),
        None,
    )
    if champion:
        items.append(
            {
                "label": "Champion",
                "value": f"{champion['name']} — {champion.get('title','')}",
                "sublabel": _tenure(champion.get("tenure_months")),
                "source": "salesforce",
                "field": f"contact.{champion['name']}",
            }
        )
    if exec_sponsor:
        items.append(
            {
                "label": "Executive sponsor",
                "value": f"{exec_sponsor['name']} — {exec_sponsor.get('title','')}",
                "sublabel": _tenure(exec_sponsor.get("tenure_months")),
                "source": "salesforce",
                "field": f"contact.{exec_sponsor['name']}",
            }
        )

    return items


def commercial_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    account = bundle.salesforce.get("get_account") or {}
    if not isinstance(account, dict):
        account = {}
    contract = bundle.salesforce.get("get_contract")
    renewal = bundle.catalyst.get("get_renewal_forecast")
    raw_open = bundle.salesforce.get("get_open_opportunities")
    open_opps = raw_open if isinstance(raw_open, list) else []
    raw_closed = bundle.salesforce.get("get_recent_closed_opportunities")
    closed_opps = raw_closed if isinstance(raw_closed, list) else []
    billing = bundle.netsuite.get("get_billing_status")
    ap = bundle.netsuite.get("get_ap_policy_flags")
    raw_inv = bundle.netsuite.get("get_recent_invoices")
    invoices = raw_inv if isinstance(raw_inv, list) else []

    items: list[dict[str, Any]] = []

    if account:
        items.append(
            {
                "label": "ARR",
                "value": _money(account.get("arr_cents")),
                "source": "salesforce",
                "field": "arr_cents",
            }
        )

    if isinstance(contract, dict):
        items.append(
            {
                "label": "Plan",
                "value": contract.get("plan_name", "—"),
                "sublabel": f"seats {contract.get('seats_used')}/{contract.get('seats_licensed')}"
                if contract.get("seats_licensed")
                else None,
                "source": "salesforce",
                "field": "plan_name",
            }
        )
        items.append(
            {
                "label": "Contract end",
                "value": contract.get("contract_end", "—"),
                "sublabel": "auto-renew on" if contract.get("auto_renew") else "auto-renew off",
                "source": "salesforce",
                "field": "contract_term",
            }
        )
    elif contract is None:
        items.append(
            {
                "label": "Contract",
                "value": "No contract on file",
                "source": "salesforce",
                "field": "contract",
            }
        )

    # Forecast — surface both if they disagree so frontend can flag
    sf_renewal_opp = next(
        (o for o in open_opps if (o.get("opp_name") or "").lower().startswith("renewal")),
        None,
    )
    sf_forecast = sf_renewal_opp.get("forecast_category") if sf_renewal_opp else None
    cat_forecast = renewal.get("renewal_forecast") if isinstance(renewal, dict) else None
    if sf_forecast:
        items.append(
            {
                "label": "Salesforce forecast",
                "value": sf_forecast,
                "source": "salesforce",
                "field": f"opp.{sf_renewal_opp.get('opp_name')}" if sf_renewal_opp else None,
            }
        )
    if cat_forecast:
        tone = "warn" if sf_forecast and cat_forecast and sf_forecast != cat_forecast else None
        items.append(
            {
                "label": "Catalyst forecast",
                "value": cat_forecast,
                "sublabel": "disagrees with Salesforce" if tone else None,
                "tone": tone,
                "source": "catalyst",
                "field": "renewal_forecast",
            }
        )

    # Open opps (filtered to non-renewal expansion-ish rows)
    expansion_opps = [o for o in open_opps if o is not sf_renewal_opp]
    for opp in expansion_opps[:3]:
        items.append(
            {
                "label": opp.get("opp_name", "Opportunity"),
                "value": _money(opp.get("amount_cents")),
                "sublabel": f"{opp.get('stage')} · {opp.get('forecast_category')}",
                "source": "salesforce",
                "field": f"opp.{opp.get('opp_name')}" if opp.get("opp_name") else None,
            }
        )

    for opp in closed_opps[:2]:
        tone = "bad" if opp.get("status") == "closed_lost" else "good"
        items.append(
            {
                "label": opp.get("opp_name", "Closed opp"),
                "value": opp.get("stage") or "—",
                "sublabel": _money(opp.get("amount_cents")),
                "tone": tone,
                "source": "salesforce",
                "field": f"closed.{opp.get('opp_name')}" if opp.get("opp_name") else None,
            }
        )

    if isinstance(billing, dict):
        past_due = billing.get("past_due_balance_cents") or 0
        items.append(
            {
                "label": "Past due",
                "value": _money(past_due) if past_due else "None",
                "sublabel": (
                    f"{billing.get('past_due_days')} days overdue"
                    if past_due
                    else "billing current"
                ),
                "tone": "bad" if past_due else "good",
                "source": "netsuite",
                "field": "past_due_balance",
            }
        )
    if isinstance(ap, dict) and ap.get("ap_blocked"):
        items.append(
            {
                "label": "AP blocked",
                "value": "YES",
                "sublabel": f"on {ap.get('ap_blocked_date')} — {ap.get('ap_blocked_reason','').strip()}",
                "tone": "bad",
                "source": "netsuite",
                "field": "ap_flag.ap_blocked",
            }
        )
    if invoices:
        inv = invoices[0]
        items.append(
            {
                "label": "Last invoice",
                "value": _money(inv.get("amount_cents")),
                "sublabel": inv.get("invoice_date"),
                "source": "netsuite",
                "field": f"invoice.{inv.get('invoice_id')}" if inv.get("invoice_id") else None,
            }
        )

    return items


def product_usage_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    usage = bundle.snowflake.get("get_usage_metrics")
    if not isinstance(usage, dict) or "_error" in usage:
        return []

    items: list[dict[str, Any]] = []

    sends = usage.get("sends_30d")
    prior = usage.get("sends_prior_30d")
    trend = usage.get("sends_trend_pct")
    if sends is not None:
        tone = None
        if isinstance(trend, (int, float)):
            tone = "bad" if trend <= -10 else ("good" if trend >= 10 else None)
        items.append(
            {
                "label": "Sends (30d)",
                "value": f"{sends/1_000_000:.1f}M" if sends >= 1_000_000 else f"{sends/1_000:.0f}K",
                "sublabel": (
                    f"was {prior/1_000_000:.1f}M ({'+' if (trend or 0) > 0 else ''}{trend}% )"
                    if prior and trend is not None
                    else None
                ),
                "tone": tone,
                "source": "snowflake",
                "field": "sends_30d",
            }
        )

    flows_active = usage.get("flows_active")
    flows_prov = usage.get("flows_provisioned")
    if flows_active is not None and flows_prov:
        items.append(
            {
                "label": "Flows active",
                "value": f"{flows_active}/{flows_prov}",
                "sublabel": (
                    f"{usage.get('flows_paused_this_period')} paused this period"
                    if usage.get("flows_paused_this_period")
                    else None
                ),
                "tone": "warn" if flows_active / flows_prov < 0.75 else None,
                "source": "snowflake",
                "field": "flows_active",
            }
        )

    health = usage.get("health_score")
    health_prior = usage.get("health_score_prior")
    health_delta = usage.get("health_delta")
    if health is not None:
        items.append(
            {
                "label": "Health score",
                "value": str(health),
                "sublabel": (
                    f"was {health_prior} ({'+' if (health_delta or 0) > 0 else ''}{health_delta})"
                    if health_prior is not None
                    else None
                ),
                "tone": _tone_for_delta(health_delta),
                "source": "snowflake",
                "field": "health_score",
            }
        )

    adoption = usage.get("adoption_score")
    group = usage.get("adoption_group_avg")
    if adoption is not None and group is not None:
        items.append(
            {
                "label": "Adoption",
                "value": str(adoption),
                "sublabel": f"group avg {group}",
                "tone": "warn" if adoption < group - 5 else None,
                "source": "snowflake",
                "field": "adoption_score",
            }
        )

    last_send = usage.get("last_send_date")
    if last_send:
        items.append(
            {
                "label": "Last send",
                "value": last_send,
                "source": "snowflake",
                "field": "last_send_date",
            }
        )

    return items


def conversations_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    raw_calls = bundle.gong.get("get_recent_calls")
    calls = raw_calls if isinstance(raw_calls, list) else []
    if not calls:
        return []

    items: list[dict[str, Any]] = []
    for c in calls[:5]:
        sublabel_bits: list[str] = []
        if c.get("competitor_mentioned"):
            sublabel_bits.append(f"competitor: {c.get('competitor_name')}")
        if c.get("pricing_pushback"):
            sublabel_bits.append("pricing pushback")
        items.append(
            {
                "label": f"{c.get('call_type','Call')} · {c.get('call_date')}",
                "value": (c.get("summary") or "")[:220],
                "sublabel": " · ".join(sublabel_bits) if sublabel_bits else None,
                "tone": (
                    "bad"
                    if c.get("sentiment") == "negative"
                    else "warn"
                    if c.get("competitor_mentioned") or c.get("pricing_pushback")
                    else None
                ),
                "source": "gong",
            }
        )
    return items


def portfolio_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    hier = bundle.salesforce.get("get_account_hierarchy")
    comp = bundle.snowflake.get("get_portfolio_comparison")
    items: list[dict[str, Any]] = []

    if isinstance(hier, dict) and hier.get("parent"):
        parent = hier["parent"]
        siblings = hier.get("siblings") or []
        items.append(
            {
                "label": "Parent",
                "value": parent.get("account_name", "—"),
                "sublabel": f"{len(siblings) + 1} accounts in group",
                "source": "salesforce",
                "field": "parent_account",
            }
        )
        for sib in siblings:
            items.append(
                {
                    "label": sib.get("account_name", "—"),
                    "value": _money(sib.get("arr_cents")),
                    "sublabel": f"{sib.get('stage','—')} · {sib.get('state','—')}",
                    "source": "salesforce",
                }
            )

    if isinstance(comp, dict) and comp.get("siblings"):
        for sib in comp["siblings"]:
            items.append(
                {
                    "label": f"{sib.get('account_name','—')} usage",
                    "value": f"health {sib.get('health_score')} · adoption {sib.get('adoption_score')}",
                    "sublabel": f"sends {sib.get('sends_30d',0)/1_000_000:.1f}M",
                    "source": "snowflake",
                }
            )

    return items


def external_section(bundle: IntelligenceBundle) -> list[dict[str, Any]]:
    raw = bundle.exa.get("search_account_signals")
    signals = raw if isinstance(raw, list) else []
    if not signals:
        return []
    items: list[dict[str, Any]] = []
    for s in signals[:6]:
        items.append(
            {
                "label": f"{s.get('signal_type','signal')} · {s.get('signal_date','')}",
                "value": s.get("title", "—"),
                "sublabel": (s.get("snippet") or "")[:200],
                "source": "web",
                "meta": {
                    "url": s.get("url"),
                    "reliability": s.get("reliability"),
                    "origin": s.get("source"),
                },
            }
        )
    return items


def shape_sections(bundle: IntelligenceBundle) -> dict[str, list[dict[str, Any]]]:
    return {
        "relationship": relationship_section(bundle),
        "commercial": commercial_section(bundle),
        "product_usage": product_usage_section(bundle),
        "conversations": conversations_section(bundle),
        "portfolio": portfolio_section(bundle),
        "external": external_section(bundle),
    }


# ---- frontend-facing normalization ---------------------------------------

# Terminal 3's IntelligenceState keys `product_usage` as `product`. Map.
_SECTION_ID: dict[str, str] = {
    "relationship": "relationship",
    "commercial": "commercial",
    "product_usage": "product",
    "conversations": "conversations",
    "portfolio": "portfolio",
    "external": "external",
}

_SECTION_META: dict[str, dict[str, str]] = {
    "relationship": {"title": "Relationship", "desc": "Status, score, contacts"},
    "commercial": {"title": "Commercial", "desc": "ARR, contract, forecast, billing"},
    "product_usage": {"title": "Product usage", "desc": "Sends, flows, health, adoption"},
    "conversations": {"title": "Conversations", "desc": "Recent Gong calls + signals"},
    "portfolio": {"title": "Portfolio", "desc": "Parent + sibling accounts"},
    "external": {"title": "External signals", "desc": "Press, hiring, social, podcasts"},
}

# Terminal 3's SourceId enum differs slightly from spec names.
_SOURCE_ID: dict[str, str] = {
    "salesforce": "sf",
    "snowflake": "snowflake",
    "catalyst": "catalyst",
    "netsuite": "netsuite",
    "gong": "gong",
    "web": "exa",
    "exa": "exa",
}


def normalize_source(source: str | None) -> str:
    if not source:
        return "internal"
    return _SOURCE_ID.get(source, source)


def _slugify(text: str) -> str:
    out = []
    for ch in text.lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "_":
            out.append("_")
    return "".join(out).strip("_") or "item"


def shape_sections_for_frontend(
    bundle: IntelligenceBundle,
) -> list[dict[str, Any]]:
    """Return a list of IntelligenceSection objects in the shape the
    Next.js frontend expects: `{id, title, desc, items:[{evid, source,
    label, value, sub, time, flag, ...}]}`.

    We keep the spec-legacy ``section`` and ``sublabel``/``tone`` fields as
    well, so any consumer written against either name works.
    """
    raw = shape_sections(bundle)
    out: list[dict[str, Any]] = []
    for spec_key in (
        "relationship",
        "commercial",
        "product_usage",
        "conversations",
        "portfolio",
        "external",
    ):
        fe_id = _SECTION_ID[spec_key]
        meta = _SECTION_META[spec_key]
        items_out: list[dict[str, Any]] = []
        for i, item in enumerate(raw.get(spec_key, [])):
            label = item.get("label") or f"item_{i}"
            evid = f"{fe_id}_{_slugify(label)}_{i}"
            items_out.append(
                {
                    "evid": evid,
                    "source": normalize_source(item.get("source")),
                    "label": label,
                    "value": item.get("value"),
                    # frontend naming
                    "sub": item.get("sublabel"),
                    "flag": _tone_to_flag(item.get("tone")),
                    # underlying MCP data field — used by agent.py to wire
                    # source_cited.intel_evid → this item's evid. None for
                    # aggregate or compositionally-derived items.
                    "field": item.get("field"),
                    # spec-legacy naming (kept so either consumer works)
                    "sublabel": item.get("sublabel"),
                    "tone": item.get("tone"),
                    "meta": item.get("meta"),
                }
            )
        out.append(
            {
                "id": fe_id,
                "section": spec_key,  # legacy spec name
                "title": meta["title"],
                "desc": meta["desc"],
                "items": items_out,
            }
        )
    return out


def build_intel_evid_index(
    sections: list[dict[str, Any]],
) -> dict[tuple[str, str], str]:
    """Build a (source, field) → intel_evid lookup from shaped sections.

    Used by agent.build_context_blob to populate Fact.intel_evid so the
    source_cited SSE event can carry a deterministic pointer to the
    matching intelligence card. Items without a `field` (e.g. composite
    rollups) are skipped — facts derived from those won't get a target.
    """
    index: dict[tuple[str, str], str] = {}
    for section in sections:
        for item in section.get("items", []):
            field = item.get("field")
            source = item.get("source")
            evid = item.get("evid")
            if not field or not source or not evid:
                continue
            key = (source, field)
            # First write wins — there shouldn't be (source, field) collisions
            # but if there are, keep the first deterministically.
            index.setdefault(key, evid)
    return index


def _tone_to_flag(tone: str | None) -> str | None:
    if tone == "bad":
        return "critical"
    if tone == "warn":
        return "warn"
    # "good" doesn't map to a frontend flag variant (no "good" in Severity set)
    return None


# ---- helpers ---------------------------------------------------------------


def _tone_for_status(status: str) -> str | None:
    mapping = {
        "Healthy": "good",
        "Green": "good",
        "Watchlist": "warn",
        "At Risk": "bad",
        "Cold": "bad",
    }
    return mapping.get(status)


def _tone_for_delta(delta: int | float | None) -> str | None:
    if delta is None:
        return None
    if delta <= -5:
        return "bad"
    if delta <= -1:
        return "warn"
    if delta >= 5:
        return "good"
    return None


def _tenure(months: int | None) -> str | None:
    if months is None:
        return None
    if months < 12:
        return f"{months} mo tenure"
    years = months // 12
    rem = months % 12
    if rem == 0:
        return f"{years} yr tenure"
    return f"{years} yr {rem} mo tenure"

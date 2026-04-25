"""Briefing agent + validation agent — direct Anthropic SDK usage.

- ``build_context_blob`` turns the raw intelligence bundle into the
  ``[source: X, fact_id: N] ...`` format the system prompt expects.
- ``stream_brief`` calls Opus 4.7 in streaming mode and yields tokens as
  they arrive, plus source_cited events when ``·N`` markers land.
- ``validate_brief`` asks Haiku 4.5 for a JSON list of warnings.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field as _dc_field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Literal

import asyncio as _asyncio

from anthropic import APIStatusError, AsyncAnthropic, RateLimitError

from .config import SETTINGS
from .intelligence import IntelligenceBundle, normalize_source as _normalize_source

log = logging.getLogger(__name__)

# Anthropic OAuth tokens (sk-ant-oat01-...) require the oauth beta header and
# Bearer auth. This preamble is prepended to the caller's system prompt when
# using OAuth so the token's Claude Code scope is honored.
_OAUTH_SYSTEM_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude."

SKILLS_DIR = Path(__file__).parent / "skills"


def _load_skill(relpath: str) -> str:
    return (SKILLS_DIR / relpath).read_text()


_MASTER_SKILL = _load_skill("master.md")
_PRE_CALL_BRIEF_SKILL = _load_skill("artifact_types/pre_call_brief.md")
_BRIEF_VALIDATION_SKILL = _load_skill("validation/brief_validation.md")

# Briefing agent: master constitutional rules inherited first, then the
# pre-call brief artifact skill specializes. Same pattern will work for
# future artifacts (QBR prep, portfolio review, renewal-risk alert, etc.).
_BRIEFING_PROMPT = _MASTER_SKILL + "\n\n---\n\n" + _PRE_CALL_BRIEF_SKILL

# Validation agent: its own skill governs its behavior (emit JSON, not prose),
# and the master skill is attached below as reference material — the yardstick
# it measures the brief against, not rules it follows itself.
_VALIDATION_PROMPT = (
    _BRIEF_VALIDATION_SKILL
    + "\n\n---\n\n"
    + "# Reference — master skill rules\n\n"
    + "Below are the rules the briefing agent was required to follow. "
    + "Use them as the checklist you evaluate the brief against. "
    + "Do not apply them to your own output; your output is JSON, not prose.\n\n"
    + "---\n\n"
    + _MASTER_SKILL
)


# ---- citation registry ----------------------------------------------------


@dataclass
class Fact:
    """A single citable fact. One field per fact — the per-field split is
    how the RAW/SCORED/SURFACED provenance tag maps cleanly to the reference
    entry's `field = value` layout."""
    fact_id: int
    provenance: Literal["raw", "scored", "surfaced"]
    source: str                          # short id, preserved for back-compat
    source_system: str                   # display name: "Salesforce", "Catalyst", ...
    text: str                            # short display form for prompt + back-compat
    retrieved_at: str                    # ISO
    time_ago: str                        # pre-computed human relative time
    source_module: str | None = None
    field: str | None = None             # raw/scored only
    value_display: str | None = None     # raw/scored only
    snippet: str | None = None           # surfaced only
    data_as_of: str | None = None
    url: str | None = None               # surfaced only (in V1)
    meta: dict[str, Any] = _dc_field(default_factory=dict)
    # Deterministic pointer to the matching intelligence-panel card. Set by
    # build_context_blob via the (source, field) → intel_evid index built
    # from shape_sections_for_frontend. None when no intel card matches —
    # the citation chip still renders, the workspace verification mode just
    # has nothing to highlight.
    intel_evid: str | None = None

    @property
    def timestamp(self) -> str | None:
        """Back-compat accessor — existing code reading .timestamp gets data_as_of
        (or retrieved_at as fallback) so the old time_ago code path keeps working."""
        return self.data_as_of or self.retrieved_at


class FactBook:
    """Monotonic fact_id allocator. Each add() produces a single cited fact
    tagged with provenance metadata (spec §4.1)."""

    def __init__(
        self,
        intel_evid_index: dict[tuple[str, str], str] | None = None,
    ) -> None:
        self._facts: list[Fact] = []
        self._counter = 0
        # When set, add() auto-populates fact.intel_evid by looking up
        # (source, field) in this index. Lets every existing fb.add() call
        # site stay unchanged while still emitting deterministic
        # citation→intel pointers in the SSE source_cited payload.
        self._intel_evid_index = intel_evid_index or {}

    def add(
        self,
        *,
        provenance: Literal["raw", "scored", "surfaced"],
        source: str,
        source_system: str,
        text: str,
        retrieved_at: str,
        time_ago: str,
        source_module: str | None = None,
        field: str | None = None,
        value_display: str | None = None,
        snippet: str | None = None,
        data_as_of: str | None = None,
        url: str | None = None,
        meta: dict[str, Any] | None = None,
        intel_evid: str | None = None,
    ) -> Fact:
        self._counter += 1
        # If caller didn't pass an explicit intel_evid, look it up by
        # (source, field) in the index seeded from the intel sections.
        # The fact's source is the short id ("salesforce") but the index
        # is keyed on the normalized id ("sf") to match what the frontend
        # consumes — normalize before lookup.
        if intel_evid is None and field is not None:
            intel_evid = self._intel_evid_index.get(
                (_normalize_source(source), field)
            )
        fact = Fact(
            fact_id=self._counter,
            provenance=provenance,
            source=source,
            source_system=source_system,
            source_module=source_module,
            field=field,
            value_display=value_display,
            snippet=snippet,
            retrieved_at=retrieved_at,
            data_as_of=data_as_of,
            time_ago=time_ago,
            url=url,
            text=text.strip(),
            meta=meta or {},
            intel_evid=intel_evid,
        )
        self._facts.append(fact)
        return fact

    def lookup(self, fact_id: int) -> Fact | None:
        for f in self._facts:
            if f.fact_id == fact_id:
                return f
        return None

    def all(self) -> list[Fact]:
        return list(self._facts)

    def to_raw_context(self) -> str:
        """Render as the context-blob format the briefing prompt expects.
        Unchanged from before — Claude's interface stays stable."""
        return "\n".join(
            f"[source: {f.source}, fact_id: {f.fact_id}] {f.text}" for f in self._facts
        )


# ---- context-blob construction --------------------------------------------


def _money(cents: int | None) -> str:
    if cents is None:
        return "—"
    dollars = cents / 100
    if dollars >= 1_000_000:
        return f"${dollars / 1_000_000:.2f}M"
    if dollars >= 1_000:
        return f"${dollars / 1_000:,.0f}K"
    return f"${dollars:,.0f}"


def _fmt_pct(v: float | int | None) -> str:
    if v is None:
        return "—"
    return f"{v:+.1f}%"


def build_context_blob(
    account_id: str,
    bundle: IntelligenceBundle,
    intel_evid_index: dict[tuple[str, str], str] | None = None,
) -> tuple[str, FactBook]:
    """Assemble the context blob + FactBook for the briefing agent.

    `intel_evid_index` is the (source, field) → intel_evid lookup built by
    intelligence.build_intel_evid_index. When provided, every fact whose
    (source, field) is in the index gets fact.intel_evid populated
    automatically by FactBook.add(), so the source_cited SSE event can
    carry a deterministic pointer to the matching intel card. Optional for
    back-compat; absent → all facts emit intel_evid=None (frontend's
    verification mode just doesn't highlight).
    """
    fb = FactBook(intel_evid_index=intel_evid_index)

    # ---- Salesforce: Account (all RAW) ----
    acc = bundle.salesforce.get("get_account")
    if isinstance(acc, dict):
        now = _now_iso()
        def _sf_account(field: str, value_display: str, text: str) -> None:
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Accounts",
                field=field,
                value_display=value_display,
                retrieved_at=now,
                time_ago="just now",
                text=text,
            )

        account_name = acc.get("account_name")
        if account_name:
            _sf_account("account_name", account_name, f"Salesforce account_name: {account_name}.")

        industry = acc.get("industry")
        segment = acc.get("segment")
        if industry or segment:
            display = f"{industry} · {segment}" if industry and segment else (industry or segment)
            _sf_account("industry", display, f"Salesforce industry: {display}.")

        arr = acc.get("arr_cents")
        if arr is not None:
            _sf_account("arr_cents", _money(arr), f"Salesforce ARR: {_money(arr)}.")

        emp = acc.get("employees")
        if emp is not None:
            _sf_account("employees", str(emp), f"Salesforce employees: {emp}.")

        hq_city, hq_state = acc.get("hq_city"), acc.get("hq_state")
        if hq_city and hq_state:
            _sf_account("hq", f"{hq_city}, {hq_state}", f"Salesforce HQ: {hq_city}, {hq_state}.")

        stage = acc.get("stage")
        if stage:
            _sf_account("stage", stage, f"Salesforce stage: {stage}.")

        owner = acc.get("owner_name")
        owner_role = acc.get("owner_role")
        if owner:
            display = f"{owner} ({owner_role})" if owner_role else owner
            _sf_account("owner", display, f"Salesforce owner: {display}.")

    # ---- Salesforce: Contract ----
    contract = bundle.salesforce.get("get_contract")
    if isinstance(contract, dict):
        now = _now_iso()
        def _sf_contract(field: str, value_display: str, text: str, data_as_of: str | None = None) -> None:
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Contracts",
                field=field,
                value_display=value_display,
                retrieved_at=now,
                data_as_of=data_as_of,
                time_ago=_time_ago_from_iso(data_as_of) if data_as_of else "just now",
                text=text,
            )
        plan = contract.get("plan_name")
        if plan:
            _sf_contract("plan_name", plan, f"Salesforce plan: {plan}.")
        start = contract.get("contract_start")
        end = contract.get("contract_end")
        if start and end:
            _sf_contract(
                "contract_term",
                f"{start} → {end}",
                f"Salesforce contract term: {start} → {end}.",
                data_as_of=end,
            )
        auto = contract.get("auto_renew")
        if auto is not None:
            _sf_contract("auto_renew", "on" if auto else "off", f"Salesforce auto-renew: {'on' if auto else 'off'}.")
        used, licensed = contract.get("seats_used"), contract.get("seats_licensed")
        if used is not None and licensed is not None:
            _sf_contract(
                "seats",
                f"{used} / {licensed}",
                f"Salesforce seats: {used}/{licensed}.",
            )
    elif contract is None:
        now = _now_iso()
        fb.add(
            provenance="raw",
            source="salesforce",
            source_system="Salesforce",
            source_module="Contracts",
            field="contract",
            value_display="— (prospect)",
            retrieved_at=now,
            time_ago="just now",
            text="No contract on file — account is a prospect, not a customer.",
        )

    # ---- Salesforce: Contacts ----
    contacts = bundle.salesforce.get("get_contacts") or []
    if isinstance(contacts, list):
        now = _now_iso()
        for c in contacts:
            name = c.get("name")
            if not name:
                continue
            title = c.get("title", "")
            role = c.get("role", "")
            months = c.get("tenure_months")
            tenure = (
                f"{months // 12}y {months % 12}m"
                if months and months >= 12
                else (f"{months}m" if months else "—")
            )
            display = f"{title}, {tenure} tenure" if title else tenure
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Contacts",
                field=f"contact.{name}",
                value_display=display,
                retrieved_at=now,
                time_ago="just now",
                text=f"{name} — {title}. Role: {role}. Tenure: {tenure}.",
            )

    # ---- Catalyst: Relationship health (mixed RAW + SCORED) ----
    health = bundle.catalyst.get("get_relationship_health")
    if isinstance(health, dict):
        now = _now_iso()
        status = health.get("relationship_status")
        status_since = health.get("status_since")
        if status:
            fb.add(
                provenance="raw",
                source="catalyst",
                source_system="Catalyst",
                source_module="Relationship health",
                field="relationship_status",
                value_display=status,
                retrieved_at=now,
                data_as_of=status_since,
                time_ago=_time_ago_from_iso(status_since) if status_since else "just now",
                text=f"Catalyst relationship_status: {status}"
                     + (f" (since {status_since})" if status_since else "") + ".",
            )

        score = health.get("relationship_score")
        prior = health.get("relationship_score_prior")
        delta = health.get("relationship_score_delta")
        if score is not None:
            delta_text = ""
            if prior is not None and delta is not None:
                delta_text = f" (was {prior}, delta {delta:+d})"
            fb.add(
                provenance="scored",
                source="catalyst",
                source_system="Catalyst",
                source_module="Relationship health",
                field="relationship_score",
                value_display=f"{score} / 100",
                retrieved_at=now,
                time_ago="just now",
                text=f"Catalyst relationship_score: {score}{delta_text}.",
            )

        last_exec = health.get("last_executive_touch")
        if last_exec:
            fb.add(
                provenance="raw",
                source="catalyst",
                source_system="Catalyst",
                source_module="Relationship health",
                field="last_executive_touch",
                value_display=last_exec,
                retrieved_at=now,
                data_as_of=last_exec,
                time_ago=_time_ago_from_iso(last_exec),
                text=f"Catalyst last_executive_touch: {last_exec}.",
            )

        notes = health.get("notes")
        if notes:
            fb.add(
                provenance="raw",
                source="catalyst",
                source_system="Catalyst",
                source_module="Relationship health",
                field="notes",
                value_display=notes[:80] + ("…" if len(notes) > 80 else ""),
                retrieved_at=now,
                time_ago="just now",
                text=f"Catalyst notes: {notes}",
            )

    # ---- Catalyst: Renewal forecast (SCORED) ----
    renewal = bundle.catalyst.get("get_renewal_forecast")
    if isinstance(renewal, dict) and renewal.get("renewal_forecast"):
        now = _now_iso()
        fc = renewal["renewal_forecast"]
        fb.add(
            provenance="scored",
            source="catalyst",
            source_system="Catalyst",
            source_module="Forecast",
            field="renewal_forecast",
            value_display=fc,
            retrieved_at=now,
            time_ago="just now",
            text=f"Catalyst renewal_forecast: {fc}. Notes: {renewal.get('notes', '')}".strip(),
        )

    # ---- Catalyst: Expansion readiness (SCORED) ----
    expansion = bundle.catalyst.get("get_expansion_readiness")
    if isinstance(expansion, dict) and expansion.get("expansion_readiness"):
        now = _now_iso()
        er = expansion["expansion_readiness"]
        fb.add(
            provenance="scored",
            source="catalyst",
            source_system="Catalyst",
            source_module="Expansion readiness",
            field="expansion_readiness",
            value_display=er,
            retrieved_at=now,
            time_ago="just now",
            text=f"Catalyst expansion_readiness: {er}.",
        )

    # ---- Salesforce: Open opportunities ----
    open_opps = bundle.salesforce.get("get_open_opportunities") or []
    if isinstance(open_opps, list):
        now = _now_iso()
        for opp in open_opps:
            name = opp.get("opp_name")
            if not name:
                continue
            amount = opp.get("amount_cents")
            close = opp.get("close_date")
            fc = opp.get("forecast_category")
            stage = opp.get("stage")
            parts = []
            if stage:
                parts.append(f"stage={stage}")
            if fc:
                parts.append(f"forecast={fc}")
            if amount is not None:
                parts.append(f"amount={_money(amount)}")
            if close:
                parts.append(f"close={close}")
            display = " · ".join(parts) if parts else name
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Opportunities",
                field=f"opp.{name}",
                value_display=display,
                retrieved_at=now,
                data_as_of=close,
                time_ago=_time_ago_from_iso(close) if close else "just now",
                text=f"Salesforce open opportunity: {name} — {display}.",
            )

    # ---- Salesforce: Recent closed opportunities ----
    closed_opps = bundle.salesforce.get("get_recent_closed_opportunities") or []
    if isinstance(closed_opps, list):
        now = _now_iso()
        for opp in closed_opps:
            name = opp.get("opp_name")
            if not name:
                continue
            stage = opp.get("stage", "")
            amount = opp.get("amount_cents")
            close = opp.get("close_date")
            display_parts = [stage] if stage else []
            if amount is not None:
                display_parts.append(_money(amount))
            if close:
                display_parts.append(close)
            display = " · ".join(display_parts) or name
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Opportunities (closed)",
                field=f"closed.{name}",
                value_display=display,
                retrieved_at=now,
                data_as_of=close,
                time_ago=_time_ago_from_iso(close) if close else "—",
                text=f"Salesforce closed opportunity: {name} — {display}.",
            )

    # ---- NetSuite: Billing status (RAW) ----
    billing = bundle.netsuite.get("get_billing_status")
    if isinstance(billing, dict):
        now = _now_iso()
        past_due = billing.get("past_due_balance_cents")
        if past_due is not None and past_due > 0:
            fb.add(
                provenance="raw",
                source="netsuite",
                source_system="NetSuite",
                source_module="Accounts Receivable",
                field="past_due_balance",
                value_display=_money(past_due),
                retrieved_at=now,
                time_ago="just now",
                text=f"NetSuite past_due_balance: {_money(past_due)}.",
            )
        days_overdue = billing.get("days_overdue")
        if days_overdue is not None and days_overdue > 0:
            fb.add(
                provenance="raw",
                source="netsuite",
                source_system="NetSuite",
                source_module="Accounts Receivable",
                field="days_overdue",
                value_display=f"{days_overdue} days",
                retrieved_at=now,
                time_ago="just now",
                text=f"NetSuite days_overdue: {days_overdue}.",
            )
        current = billing.get("current_balance_cents")
        if current is not None:
            fb.add(
                provenance="raw",
                source="netsuite",
                source_system="NetSuite",
                source_module="Accounts Receivable",
                field="current_balance",
                value_display=_money(current),
                retrieved_at=now,
                time_ago="just now",
                text=f"NetSuite current_balance: {_money(current)}.",
            )

    # ---- NetSuite: AP policy flags (RAW — deterministic rule outputs) ----
    flags = bundle.netsuite.get("get_ap_policy_flags") or []
    if isinstance(flags, list):
        now = _now_iso()
        for flag in flags:
            name = flag.get("flag_name")
            if not name:
                continue
            reason = flag.get("flag_reason", "")
            fb.add(
                provenance="raw",
                source="netsuite",
                source_system="NetSuite",
                source_module="AP policy flags",
                field=f"ap_flag.{name}",
                value_display=reason or name,
                retrieved_at=now,
                time_ago="just now",
                text=f"NetSuite AP flag {name}: {reason}".strip(": "),
            )

    # ---- NetSuite: Recent invoices (RAW) ----
    invoices = bundle.netsuite.get("get_recent_invoices") or []
    if isinstance(invoices, list):
        now = _now_iso()
        for inv in invoices:
            inv_id = inv.get("invoice_id")
            if not inv_id:
                continue
            amount = inv.get("amount_cents")
            status = inv.get("status", "")
            due = inv.get("due_date")
            display_parts = [_money(amount)] if amount is not None else []
            if status:
                display_parts.append(status)
            if due:
                display_parts.append(f"due {due}")
            display = " · ".join(display_parts) or inv_id
            fb.add(
                provenance="raw",
                source="netsuite",
                source_system="NetSuite",
                source_module="Invoices",
                field=f"invoice.{inv_id}",
                value_display=display,
                retrieved_at=now,
                data_as_of=due,
                time_ago=_time_ago_from_iso(due) if due else "just now",
                text=f"NetSuite invoice {inv_id}: {display}.",
            )

    # ---- Snowflake: Usage metrics (RAW — counts) ----
    usage = bundle.snowflake.get("get_usage_metrics")
    if isinstance(usage, dict):
        now = _now_iso()
        for raw_field, raw_value in usage.items():
            if raw_value is None:
                continue
            fb.add(
                provenance="raw",
                source="snowflake",
                source_system="Snowflake",
                source_module="Usage metrics",
                field=raw_field,
                value_display=f"{raw_value:,}" if isinstance(raw_value, (int, float)) else str(raw_value),
                retrieved_at=now,
                time_ago="just now",
                text=f"Snowflake {raw_field}: {raw_value}.",
            )

    # ---- Snowflake: Portfolio comparison (SCORED — derived math) ----
    portfolio = bundle.snowflake.get("get_portfolio_comparison")
    if isinstance(portfolio, dict):
        now = _now_iso()
        for raw_field, raw_value in portfolio.items():
            if raw_value is None:
                continue
            fb.add(
                provenance="scored",
                source="snowflake",
                source_system="Snowflake",
                source_module="Portfolio comparison",
                field=raw_field,
                value_display=f"{raw_value:,}" if isinstance(raw_value, (int, float)) else str(raw_value),
                retrieved_at=now,
                time_ago="just now",
                text=f"Snowflake portfolio {raw_field}: {raw_value}.",
            )

    # ---- Salesforce: Account hierarchy ----
    hierarchy = bundle.salesforce.get("get_account_hierarchy")
    if isinstance(hierarchy, dict):
        now = _now_iso()
        parent = hierarchy.get("parent_account_name")
        if parent:
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Account hierarchy",
                field="parent_account",
                value_display=parent,
                retrieved_at=now,
                time_ago="just now",
                text=f"Salesforce parent account: {parent}.",
            )
        subs = hierarchy.get("subsidiaries") or []
        if isinstance(subs, list) and subs:
            fb.add(
                provenance="raw",
                source="salesforce",
                source_system="Salesforce",
                source_module="Account hierarchy",
                field="subsidiaries",
                value_display=f"{len(subs)} subsidiaries",
                retrieved_at=now,
                time_ago="just now",
                text=f"Salesforce subsidiaries: {', '.join(str(s) for s in subs)}.",
            )

    # ---- Gong: Recent calls (RAW — metadata) ----
    calls = bundle.gong.get("get_recent_calls") or []
    if isinstance(calls, list):
        now = _now_iso()
        for call in calls:
            title = call.get("call_title") or call.get("title")
            if not title:
                continue
            date = call.get("date") or call.get("call_date")
            duration = call.get("duration_minutes")
            attendees = call.get("attendees") or []
            parts = []
            if duration is not None:
                parts.append(f"{duration}m")
            if attendees:
                parts.append(f"{len(attendees)} attendees")
            display = " · ".join(parts) or title
            fb.add(
                provenance="raw",
                source="gong",
                source_system="Gong",
                source_module="Calls",
                field=f"call.{title}",
                value_display=display,
                retrieved_at=now,
                data_as_of=date,
                time_ago=_time_ago_from_iso(date) if date else "just now",
                text=f"Gong call {title} on {date}: {display}.",
            )

    # ---- Gong: Competitor mentions (RAW excerpt + SCORED sentiment) ----
    comp_mentions = bundle.gong.get("get_competitor_mentions") or []
    if isinstance(comp_mentions, list):
        now = _now_iso()
        for m in comp_mentions:
            name = m.get("competitor_name")
            if not name:
                continue
            excerpt = m.get("excerpt", "")
            call_date = m.get("call_date") or m.get("date")
            fb.add(
                provenance="raw",
                source="gong",
                source_system="Gong",
                source_module="Competitor mentions",
                field=f"competitor.{name}",
                value_display=excerpt[:80] + ("…" if len(excerpt) > 80 else "") if excerpt else name,
                retrieved_at=now,
                data_as_of=call_date,
                time_ago=_time_ago_from_iso(call_date) if call_date else "just now",
                text=f"Gong competitor mention — {name}: \"{excerpt}\".",
            )
            sentiment = m.get("sentiment")
            if sentiment:
                fb.add(
                    provenance="scored",
                    source="gong",
                    source_system="Gong",
                    source_module="Competitor mentions",
                    field=f"sentiment.{name}",
                    value_display=sentiment,
                    retrieved_at=now,
                    data_as_of=call_date,
                    time_ago=_time_ago_from_iso(call_date) if call_date else "just now",
                    text=f"Gong sentiment on {name}: {sentiment}.",
                )

    # ---- Gong: Pricing signals (SCORED — NLP direction classifier) ----
    pricing = bundle.gong.get("get_pricing_signals") or []
    if isinstance(pricing, list):
        now = _now_iso()
        for sig in pricing:
            text_val = sig.get("signal_text") or sig.get("text")
            direction = sig.get("direction", "")
            if not text_val:
                continue
            fb.add(
                provenance="scored",
                source="gong",
                source_system="Gong",
                source_module="Pricing signals",
                field=f"pricing_signal.{direction}",
                value_display=direction or "signal",
                retrieved_at=now,
                time_ago="just now",
                text=f"Gong pricing signal ({direction}): {text_val}.",
            )

    # ---- Exa: Account signals (SURFACED — third-party web content) ----
    account_signals = bundle.exa.get("search_account_signals") or []
    if isinstance(account_signals, list):
        now = _now_iso()
        for hit in account_signals:
            snippet = hit.get("snippet") or hit.get("text") or ""
            if not snippet:
                continue
            title = hit.get("title", "")
            published = hit.get("signal_date") or hit.get("published_at") or hit.get("date")
            url = hit.get("url")
            fb.add(
                provenance="surfaced",
                source="exa",
                source_system="Exa",
                source_module=title or "Web result",
                snippet=snippet,
                url=url,
                retrieved_at=now,
                data_as_of=published,
                time_ago=_time_ago_from_iso(published) if published else "just now",
                text=f"Exa: {title} — \"{snippet[:160]}{'…' if len(snippet) > 160 else ''}\".",
            )

    # ---- Exa: Decision-maker signals (SURFACED) ----
    dm_signals = bundle.exa.get("get_decision_maker_signals") or []
    if isinstance(dm_signals, list):
        now = _now_iso()
        for hit in dm_signals:
            snippet = hit.get("snippet") or hit.get("text") or ""
            if not snippet:
                continue
            author = hit.get("author", "")
            title = hit.get("title", "")
            published = hit.get("signal_date") or hit.get("published_at") or hit.get("date")
            url = hit.get("url")
            module = f"{title} · {author}" if (title and author) else (title or author or "Web result")
            fb.add(
                provenance="surfaced",
                source="exa",
                source_system="Exa",
                source_module=module,
                snippet=snippet,
                url=url,
                retrieved_at=now,
                data_as_of=published,
                time_ago=_time_ago_from_iso(published) if published else "just now",
                text=f"Exa DM signal — {author} · \"{snippet[:160]}{'…' if len(snippet) > 160 else ''}\".",
            )

    return f"# ACCOUNT CONTEXT FOR BRIEFING — {account_id}\n\n" + fb.to_raw_context(), fb


# ---- Anthropic client -----------------------------------------------------


_client: AsyncAnthropic | None = None
_using_oauth: bool = False


def _auth_mode() -> str:
    if SETTINGS.anthropic_auth_token:
        return "oauth"
    if SETTINGS.anthropic_api_key:
        return "api_key"
    return "none"


def get_client() -> AsyncAnthropic:
    """Lazy-build an Anthropic client. Prefers OAuth tokens when set.

    OAuth tokens (``sk-ant-oat01-...``) are issued by Claude Code sign-in
    and must be sent via ``Authorization: Bearer ...`` plus the
    ``anthropic-beta: oauth-2025-04-20`` header. Falls back to
    ``ANTHROPIC_API_KEY`` (``sk-ant-api03-...``) if no OAuth token is
    present.
    """
    global _client, _using_oauth
    if _client is not None:
        return _client

    mode = _auth_mode()
    if mode == "oauth":
        # The SDK prefers api_key when both are set. Pass ``api_key=None`` and
        # also scrub the env var so the client can't fall back to x-api-key.
        import os as _os

        _os.environ.pop("ANTHROPIC_API_KEY", None)
        _client = AsyncAnthropic(
            api_key=None,
            auth_token=SETTINGS.anthropic_auth_token,
            default_headers={"anthropic-beta": "oauth-2025-04-20"},
        )
        _using_oauth = True
        log.info("agent.client.init", extra={"mode": "oauth"})
    elif mode == "api_key":
        # Symmetric to the oauth branch: scrub any stale auth_token from env
        # so the SDK doesn't send ``Authorization: Bearer `` (empty) alongside
        # the api_key. python-dotenv sets empty env vars to "", which the SDK
        # reads as "auth_token is set" and produces a malformed header.
        import os as _os

        _os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
        _client = AsyncAnthropic(
            api_key=SETTINGS.anthropic_api_key,
            auth_token=None,
        )
        _using_oauth = False
        log.info("agent.client.init", extra={"mode": "api_key"})
    else:
        raise RuntimeError("No Anthropic credentials: set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN")
    return _client


def _system_prompt(user_prompt: str) -> str | list[dict[str, object]]:
    """Build the system prompt array.

    When using OAuth, Anthropic requires the first system block to mark the
    caller as Claude Code. We prepend that preamble as a separate block so
    our task-specific prompt stays intact.
    """
    if _auth_mode() == "oauth":
        return [
            {"type": "text", "text": _OAUTH_SYSTEM_PREAMBLE},
            {"type": "text", "text": user_prompt},
        ]
    return user_prompt


async def _call_with_retry(fn, *, attempts: int = 4, base: float = 1.5, label: str = "anthropic") -> object:
    """Call ``fn`` (an async callable returning the Anthropic response) with
    exponential backoff on transient errors (rate limits, 5xx).
    """
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await fn()
        except RateLimitError as exc:
            last_exc = exc
            delay = base ** (attempt + 1)
            log.warning(
                f"{label}.rate_limited",
                extra={"attempt": attempt + 1, "delay_s": round(delay, 2)},
            )
            await _asyncio.sleep(delay)
        except APIStatusError as exc:
            if exc.status_code and 500 <= exc.status_code < 600:
                last_exc = exc
                delay = base ** (attempt + 1)
                log.warning(
                    f"{label}.server_error",
                    extra={"attempt": attempt + 1, "status": exc.status_code, "delay_s": round(delay, 2)},
                )
                await _asyncio.sleep(delay)
                continue
            raise
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"{label}: exhausted retries with no result")


# ---- streaming brief ------------------------------------------------------


_CITATION_RE = re.compile(r"·(\d+)")


@dataclass
class BriefStreamEvent:
    """Yielded by stream_brief — either a token delta, a citation, or the
    final end-of-stream marker."""

    kind: str  # "brief_chunk" | "source_cited" | "done"
    data: dict[str, Any]


def _build_source_cited_payload(fact: Fact) -> dict[str, Any]:
    """Build the SSE source_cited payload. Authoritative shape per spec §9 step 4.
    All frontend call-sites consume the discriminated-union fields."""
    return {
        "citation_number": fact.fact_id,
        "provenance": fact.provenance,
        "source_system": fact.source_system,
        "source_module": fact.source_module,
        "field": fact.field,
        "value_display": fact.value_display,
        "snippet": fact.snippet,
        "retrieved_at": fact.retrieved_at,
        "data_as_of": fact.data_as_of,
        "time_ago": fact.time_ago,
        "url": fact.url,
        "evid": fact.text,  # stable id for citation chip ↔ reference lookup
        # Deterministic pointer to the matching intelligence panel card
        # (when one exists). Frontend Workspace verification mode uses this
        # to scroll/highlight the card on citation click. Null for facts
        # without a matching intel item (composite/aggregate items).
        "intel_evid": fact.intel_evid,
    }


async def stream_brief(
    account_id: str,
    bundle: IntelligenceBundle,
    fact_book: FactBook,
    context_blob: str,
) -> AsyncIterator[BriefStreamEvent]:
    """Stream the briefing from Claude. Yields brief_chunk + source_cited."""

    client = get_client()
    base_system = _BRIEFING_PROMPT.replace("{today}", SETTINGS.anchor_date)
    system_payload = _system_prompt(base_system)

    user_message = (
        "Here is the structured context blob for this account. "
        "Use only these facts and cite them by fact_id.\n\n"
        f"{context_blob}\n\n"
        f"Today is {SETTINGS.anchor_date}. Write the pre-call briefing now."
    )

    accumulated = ""
    emitted_citations: set[int] = set()
    total_input_tokens = 0
    total_output_tokens = 0

    log.info(
        "agent.brief_stream.start",
        extra={
            "account_id": account_id,
            "model": SETTINGS.briefing_model,
            "facts": len(fact_book.all()),
            "context_chars": len(context_blob),
            "auth_mode": _auth_mode(),
        },
    )

    # Retry on rate-limit / 5xx. We need to re-open the stream each attempt.
    attempts = 4
    last_exc: Exception | None = None
    stream_cm = None
    for attempt in range(attempts):
        try:
            stream_cm = client.messages.stream(
                model=SETTINGS.briefing_model,
                max_tokens=1200,
                system=system_payload,
                messages=[{"role": "user", "content": user_message}],
            )
            break
        except RateLimitError as exc:
            last_exc = exc
            delay = 1.5 ** (attempt + 1)
            log.warning(
                "agent.brief_stream.rate_limited",
                extra={"attempt": attempt + 1, "delay_s": round(delay, 2)},
            )
            await _asyncio.sleep(delay)
    if stream_cm is None:
        raise last_exc or RuntimeError("Failed to open brief stream")

    async with stream_cm as stream:
        async for delta in stream.text_stream:
            if not delta:
                continue
            accumulated += delta
            yield BriefStreamEvent("brief_chunk", {"delta": delta})

            # Look for citation markers in the running text. We only emit
            # citations whose trailing digits are definitely complete, i.e.
            # the number is followed by at least one non-digit character.
            for match in _CITATION_RE.finditer(accumulated):
                end = match.end()
                if end >= len(accumulated):
                    # digits might still be extending in the next chunk
                    continue
                num = int(match.group(1))
                if num in emitted_citations:
                    continue
                fact = fact_book.lookup(num)
                if fact is None:
                    log.warning(
                        "agent.unknown_citation",
                        extra={"account_id": account_id, "citation": num},
                    )
                    emitted_citations.add(num)
                    continue
                emitted_citations.add(num)
                yield BriefStreamEvent(
                    "source_cited",
                    _build_source_cited_payload(fact),
                )

        final_message = await stream.get_final_message()
        total_input_tokens = final_message.usage.input_tokens
        total_output_tokens = final_message.usage.output_tokens

    # Flush any citation whose digits ran up to the end of the stream
    for match in _CITATION_RE.finditer(accumulated):
        num = int(match.group(1))
        if num in emitted_citations:
            continue
        fact = fact_book.lookup(num)
        if fact is None:
            continue
        emitted_citations.add(num)
        yield BriefStreamEvent(
            "source_cited",
            _build_source_cited_payload(fact),
        )

    log.info(
        "agent.brief_stream.done",
        extra={
            "account_id": account_id,
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "citations": len(emitted_citations),
            "chars": len(accumulated),
        },
    )

    yield BriefStreamEvent(
        "done",
        {
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "total_tokens": total_input_tokens + total_output_tokens,
            "brief_markdown": accumulated,
        },
    )


# ---- validation -----------------------------------------------------------


async def validate_brief(
    account_id: str,
    brief_markdown: str,
    context_blob: str,
) -> list[dict[str, Any]]:
    """Second-pass validation. Returns a list of warning dicts."""
    client = get_client()
    base_system = _VALIDATION_PROMPT.replace("{today}", SETTINGS.anchor_date)
    system_payload = _system_prompt(base_system)

    user_message = (
        "BRIEF:\n\n"
        f"{brief_markdown}\n\n"
        "----\n\n"
        "RAW CONTEXT BLOB (the only facts the brief was allowed to cite):\n\n"
        f"{context_blob}\n\n"
        "Emit the JSON warnings array now. If everything checks out, return []."
    )

    log.info(
        "agent.validate.start",
        extra={"account_id": account_id, "model": SETTINGS.validation_model},
    )

    async def _go():
        return await client.messages.create(
            model=SETTINGS.validation_model,
            max_tokens=800,
            system=system_payload,
            messages=[{"role": "user", "content": user_message}],
        )

    try:
        response = await _call_with_retry(_go, label="agent.validate")
    except Exception as exc:  # noqa: BLE001
        log.exception("agent.validate.failed", extra={"account_id": account_id})
        return [
            {
                "severity": "watch",
                "type": "missing_ground",
                "message": f"Validation agent unavailable: {exc!s}",
                "brief_excerpt": "",
                "sources": [],
            }
        ]

    text = "".join(
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text"
    ).strip()

    parsed = _extract_json_array(text)
    if parsed is None:
        log.warning(
            "agent.validate.bad_json",
            extra={"account_id": account_id, "text_snippet": text[:200]},
        )
        return []

    # defensive scrub
    clean: list[dict[str, Any]] = []
    for w in parsed:
        if not isinstance(w, dict):
            continue
        clean.append(
            {
                "severity": w.get("severity", "watch"),
                "type": w.get("type", "missing_ground"),
                "message": str(w.get("message", "")).strip(),
                "brief_excerpt": str(w.get("brief_excerpt", "")).strip(),
                "sources": [str(s) for s in (w.get("sources") or [])],
            }
        )

    log.info(
        "agent.validate.done",
        extra={"account_id": account_id, "warnings": len(clean)},
    )
    return clean


def _extract_json_array(text: str) -> list | None:
    """Pull the first JSON array out of the validator's response."""
    if not text:
        return None
    # Strip code fences if the model wrapped it
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, list) else None
    except json.JSONDecodeError:
        pass
    # Find the first [...] substring
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, list) else None
    except json.JSONDecodeError:
        return None


# ---- helpers --------------------------------------------------------------


def _time_ago(iso_date: str | None) -> str | None:
    if not iso_date:
        return None
    from datetime import date as _date

    try:
        then = _date.fromisoformat(iso_date)
        today = _date.fromisoformat(SETTINGS.anchor_date)
    except ValueError:
        return None
    days = (today - then).days
    if days < 0:
        # future date — e.g. contract_end
        days = -days
        return f"{days}d ahead"
    if days == 0:
        return "today"
    if days == 1:
        return "1d ago"
    if days < 7:
        return f"{days}d ago"
    if days < 30:
        return f"{days // 7}w ago"
    if days < 365:
        return f"{days // 30}mo ago"
    return f"{days // 365}y ago"


def _now_iso() -> str:
    """ISO timestamp for the backend's current 'now', respecting ANCHOR_DATE
    when set (demo mode). Format: 2026-04-24T14:30:00Z."""
    anchor = os.getenv("ANCHOR_DATE")
    if anchor:
        # Treat ANCHOR_DATE as midnight UTC of the named day + a synthetic
        # afternoon offset consistent with other demo-mode timestamping.
        return f"{anchor}T14:00:00Z"
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _time_ago_from_iso(iso: str | None, anchor: str | None = None) -> str:
    """Human relative string from an ISO timestamp, anchored to the project's
    ANCHOR_DATE (or an explicit anchor for tests). Returns '—' for None input
    or unparseable timestamps."""
    if iso is None:
        return "—"
    try:
        then = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return "—"
    # Treat naive datetimes (e.g. date-only "2026-04-01") as UTC so subtraction
    # with an aware datetime doesn't raise TypeError.
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    if anchor:
        now = datetime.fromisoformat(anchor.replace("Z", "+00:00"))
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
    else:
        now = datetime.now(timezone.utc)
    delta = now - then
    secs = int(delta.total_seconds())
    if secs < 60:
        return f"{secs}s ago"
    if secs < 3600:
        return f"{secs // 60}m ago"
    if secs < 86400:
        return f"{secs // 3600}h ago"
    return f"{secs // 86400}d ago"

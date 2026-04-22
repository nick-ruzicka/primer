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
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator

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
    fact_id: int
    source: str
    text: str
    timestamp: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


class FactBook:
    """Monotonic fact_id allocator keyed by source."""

    def __init__(self) -> None:
        self._facts: list[Fact] = []
        self._counter = 0

    def add(
        self,
        source: str,
        text: str,
        timestamp: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> Fact:
        self._counter += 1
        fact = Fact(
            fact_id=self._counter,
            source=source,
            text=text.strip(),
            timestamp=timestamp,
            meta=meta or {},
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
        """Render as the context-blob format the briefing prompt expects."""
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


def build_context_blob(account_id: str, bundle: IntelligenceBundle) -> tuple[str, FactBook]:
    """Assemble the context blob + FactBook for the briefing agent."""
    fb = FactBook()

    sections: list[str] = [f"# ACCOUNT CONTEXT FOR BRIEFING — {account_id}"]

    # Account ------------------------------------------------------------
    acc = bundle.salesforce.get("get_account")
    if isinstance(acc, dict):
        parts = [
            f"{acc.get('account_name')} ({account_id}).",
            f"Parent: {acc.get('parent_account_name') or 'none'}.",
            f"Industry: {acc.get('industry')} · segment: {acc.get('segment')}.",
            f"ARR: {_money(acc.get('arr_cents'))}.",
            f"Employees: {acc.get('employees')}.",
            f"HQ: {acc.get('hq_city')}, {acc.get('hq_state')}.",
            f"Stage: {acc.get('stage')} · state: {acc.get('state')}.",
            f"AE: {acc.get('owner_name')} ({acc.get('owner_role')}).",
        ]
        fact = fb.add("salesforce", " ".join(parts))
        sections.append(f"## Account\n[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")

    # Contract ----------------------------------------------------------
    contract = bundle.salesforce.get("get_contract")
    if isinstance(contract, dict):
        fact = fb.add(
            "salesforce",
            (
                f"Plan: {contract.get('plan_name')}. "
                f"Contract runs {contract.get('contract_start')} → {contract.get('contract_end')}. "
                f"Auto-renew: {'on' if contract.get('auto_renew') else 'off'}. "
                f"Seats: {contract.get('seats_used')}/{contract.get('seats_licensed')}."
            ),
            timestamp=contract.get("contract_end"),
        )
        sections.append(f"## Contract\n[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")
    elif contract is None:
        fact = fb.add(
            "salesforce",
            "No contract on file — account is a prospect, not a customer.",
        )
        sections.append(f"## Contract\n[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")

    # Contacts ----------------------------------------------------------
    contacts = bundle.salesforce.get("get_contacts") or []
    if isinstance(contacts, list) and contacts:
        contact_lines = []
        for c in contacts:
            months = c.get("tenure_months")
            tenure = (
                f"{months // 12}y {months % 12}m tenure"
                if months and months >= 12
                else (f"{months}m tenure" if months else "tenure unknown")
            )
            fact = fb.add(
                "salesforce",
                f"{c.get('name')}, {c.get('title')}. Role: {c.get('role')}. {tenure}.",
            )
            contact_lines.append(f"[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## Contacts\n" + "\n".join(contact_lines))

    # Relationship health + renewal + expansion ------------------------
    health = bundle.catalyst.get("get_relationship_health")
    if isinstance(health, dict) and health.get("relationship_status"):
        bits = [f"Status: {health.get('relationship_status')}"]
        if health.get("status_since"):
            bits.append(f"since {health.get('status_since')}")
        score = health.get("relationship_score")
        prior = health.get("relationship_score_prior")
        delta = health.get("relationship_score_delta")
        if score is not None:
            bits.append(
                f"score {score}"
                + (
                    f" (was {prior}, delta {delta:+d})"
                    if prior is not None and delta is not None
                    else ""
                )
            )
        if health.get("last_executive_touch"):
            bits.append(f"last exec touch {health.get('last_executive_touch')}")
        if health.get("notes"):
            bits.append(f"notes: {health.get('notes')}")
        fact = fb.add(
            "catalyst",
            " · ".join(bits) + ".",
            timestamp=health.get("status_since"),
        )
        sections.append(
            f"## Relationship health\n[source: catalyst, fact_id: {fact.fact_id}] {fact.text}"
        )
    elif isinstance(health, dict):
        fact = fb.add(
            "catalyst",
            f"Catalyst row exists but relationship fields are null. Notes: {health.get('notes','(none)')}.",
        )
        sections.append(
            f"## Relationship health\n[source: catalyst, fact_id: {fact.fact_id}] {fact.text}"
        )

    renewal = bundle.catalyst.get("get_renewal_forecast")
    if isinstance(renewal, dict) and renewal.get("renewal_forecast"):
        fact = fb.add(
            "catalyst",
            f"Catalyst renewal forecast: {renewal.get('renewal_forecast')}. Notes: {renewal.get('notes','')}",
        )
        sections.append(
            f"## Catalyst renewal forecast\n[source: catalyst, fact_id: {fact.fact_id}] {fact.text}"
        )

    expansion = bundle.catalyst.get("get_expansion_readiness")
    if isinstance(expansion, dict) and expansion.get("expansion_readiness"):
        fact = fb.add(
            "catalyst",
            f"Catalyst expansion readiness: {expansion.get('expansion_readiness')}.",
        )
        sections.append(
            f"## Expansion readiness\n[source: catalyst, fact_id: {fact.fact_id}] {fact.text}"
        )

    # Open opportunities ------------------------------------------------
    open_opps = bundle.salesforce.get("get_open_opportunities") or []
    if isinstance(open_opps, list) and open_opps:
        opp_lines = []
        for o in open_opps:
            fact = fb.add(
                "salesforce",
                (
                    f"{o.get('opp_name')} — stage {o.get('stage')}, "
                    f"amount {_money(o.get('amount_cents'))}, "
                    f"close date {o.get('close_date')}, "
                    f"forecast category {o.get('forecast_category')}."
                ),
                timestamp=o.get("close_date"),
            )
            opp_lines.append(f"[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## Open opportunities\n" + "\n".join(opp_lines))

    # Recent closed opps -----------------------------------------------
    closed_opps = bundle.salesforce.get("get_recent_closed_opportunities") or []
    if isinstance(closed_opps, list) and closed_opps:
        lines = []
        for o in closed_opps:
            fact = fb.add(
                "salesforce",
                (
                    f"{o.get('opp_name')} — {o.get('stage')}, "
                    f"amount {_money(o.get('amount_cents'))}, "
                    f"closed {o.get('close_date')}."
                ),
                timestamp=o.get("close_date"),
            )
            lines.append(f"[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## Recent closed opportunities\n" + "\n".join(lines))

    # Billing -----------------------------------------------------------
    billing = bundle.netsuite.get("get_billing_status")
    if isinstance(billing, dict):
        past_due = billing.get("past_due_balance_cents") or 0
        if past_due:
            fact = fb.add(
                "netsuite",
                (
                    f"Past-due balance {_money(past_due)} "
                    f"({billing.get('past_due_days')} days overdue). "
                    f"Current balance {_money(billing.get('current_balance_cents'))}."
                ),
            )
        else:
            fact = fb.add(
                "netsuite",
                f"Billing current. Current balance {_money(billing.get('current_balance_cents'))}, no past-due.",
            )
        sections.append(
            f"## Billing status\n[source: netsuite, fact_id: {fact.fact_id}] {fact.text}"
        )
    elif billing is None:
        fact = fb.add("netsuite", "No billing row — account is not a customer yet.")
        sections.append(
            f"## Billing status\n[source: netsuite, fact_id: {fact.fact_id}] {fact.text}"
        )

    ap = bundle.netsuite.get("get_ap_policy_flags")
    if isinstance(ap, dict) and ap.get("ap_blocked"):
        fact = fb.add(
            "netsuite",
            (
                f"AP blocked on {ap.get('ap_blocked_date')}. "
                f"Reason: {ap.get('ap_blocked_reason','').strip()}"
            ),
            timestamp=ap.get("ap_blocked_date"),
        )
        sections.append(
            f"## AP policy\n[source: netsuite, fact_id: {fact.fact_id}] {fact.text}"
        )

    invoices = bundle.netsuite.get("get_recent_invoices") or []
    if isinstance(invoices, list) and invoices:
        lines = []
        for inv in invoices[:3]:
            fact = fb.add(
                "netsuite",
                f"Invoice {inv.get('invoice_number')} — {_money(inv.get('amount_cents'))} on {inv.get('invoice_date')}.",
                timestamp=inv.get("invoice_date"),
            )
            lines.append(f"[source: netsuite, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## Recent invoices\n" + "\n".join(lines))

    # Usage -------------------------------------------------------------
    usage = bundle.snowflake.get("get_usage_metrics")
    if isinstance(usage, dict) and "_error" not in usage:
        fact = fb.add(
            "snowflake",
            (
                f"Sends last 30d {usage.get('sends_30d')} (prior {usage.get('sends_prior_30d')}, "
                f"trend {_fmt_pct(usage.get('sends_trend_pct'))}). "
                f"Flows {usage.get('flows_active')}/{usage.get('flows_provisioned')} "
                f"({usage.get('flows_paused_this_period')} paused this period). "
                f"Health {usage.get('health_score')} (was {usage.get('health_score_prior')}, delta {usage.get('health_delta')}). "
                f"Adoption {usage.get('adoption_score')} vs group avg {usage.get('adoption_group_avg')}. "
                f"Last send {usage.get('last_send_date')}."
            ),
            timestamp=usage.get("last_send_date"),
        )
        sections.append(
            f"## Product usage\n[source: snowflake, fact_id: {fact.fact_id}] {fact.text}"
        )

    # Portfolio comparison ---------------------------------------------
    comp = bundle.snowflake.get("get_portfolio_comparison")
    if isinstance(comp, dict) and comp.get("siblings"):
        lines = []
        for sib in comp["siblings"]:
            fact = fb.add(
                "snowflake",
                (
                    f"Sibling {sib.get('account_name')} — health {sib.get('health_score')}, "
                    f"adoption {sib.get('adoption_score')}, "
                    f"sends {sib.get('sends_30d')} (trend {_fmt_pct(sib.get('sends_trend_pct'))})."
                ),
            )
            lines.append(f"[source: snowflake, fact_id: {fact.fact_id}] {fact.text}")
        if lines:
            sections.append("## Portfolio comparison (siblings)\n" + "\n".join(lines))

    # Hierarchy / parent snapshot -------------------------------------
    hier = bundle.salesforce.get("get_account_hierarchy")
    if isinstance(hier, dict) and hier.get("parent"):
        parent = hier["parent"]
        siblings = hier.get("siblings") or []
        sib_names = ", ".join(
            f"{s.get('account_name')} ({_money(s.get('arr_cents'))}, {s.get('stage')})"
            for s in siblings
        )
        fact = fb.add(
            "salesforce",
            (
                f"Parent {parent.get('account_name')}. "
                f"{len(siblings) + 1} accounts in group. "
                f"Siblings: {sib_names or 'none'}."
            ),
        )
        sections.append(
            f"## Account hierarchy\n[source: salesforce, fact_id: {fact.fact_id}] {fact.text}"
        )

    # Recent calls ------------------------------------------------------
    calls = bundle.gong.get("get_recent_calls") or []
    if isinstance(calls, list) and calls:
        lines = []
        for c in calls[:5]:
            bits = [
                f"{c.get('call_type')} on {c.get('call_date')}",
                f"sentiment {c.get('sentiment')}",
            ]
            if c.get("competitor_mentioned"):
                bits.append(
                    f"competitor {c.get('competitor_name')} mentioned {c.get('competitor_mention_count')}x"
                )
            if c.get("pricing_pushback"):
                bits.append("pricing pushback")
            summary = (c.get("summary") or "").strip()
            fact = fb.add(
                "gong",
                f"{' · '.join(bits)}. Summary: {summary}",
                timestamp=c.get("call_date"),
            )
            lines.append(f"[source: gong, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## Recent calls (Gong)\n" + "\n".join(lines))

    # External signals --------------------------------------------------
    signals = bundle.exa.get("search_account_signals") or []
    if isinstance(signals, list) and signals:
        lines = []
        for s in signals[:8]:
            snippet = (s.get("snippet") or "").replace("\n", " ").strip()
            fact = fb.add(
                "web",
                (
                    f"{s.get('signal_type')} via {s.get('source')} on {s.get('signal_date')}: "
                    f"{s.get('title')}. {snippet}"
                ),
                timestamp=s.get("signal_date"),
                meta={"url": s.get("url"), "reliability": s.get("reliability")},
            )
            lines.append(f"[source: web, fact_id: {fact.fact_id}] {fact.text}")
        sections.append("## External signals (Exa)\n" + "\n".join(lines))

    blob = "\n\n".join(sections)
    return blob, fb


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
        _client = AsyncAnthropic(api_key=SETTINGS.anthropic_api_key)
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
                    {
                        "citation_number": num,
                        "source": _normalize_source(fact.source),
                        "fact": fact.text,
                        "evid": fact.text,  # frontend's tooltip/body uses `evid`
                        "time_ago": _time_ago(fact.timestamp) if fact.timestamp else None,
                    },
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
            {
                "citation_number": num,
                "source": fact.source,
                "fact": fact.text,
                "time_ago": _time_ago(fact.timestamp) if fact.timestamp else None,
            },
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

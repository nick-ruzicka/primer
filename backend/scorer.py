"""Decomposed warning confidence scoring for the validator."""
from __future__ import annotations

import logging
import re
from typing import Any, Callable

log = logging.getLogger(__name__)

# --- regex patterns ---

_PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_CURRENCY_RE = re.compile(r"\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([KkMmBb])?")
_PLAIN_NUM_RE = re.compile(r"\b(\d+(?:\.\d+)?)\b")
_CITATION_RE = re.compile(r"·(\d+)")
_HEDGE_RE = re.compile(
    r"\b(reads like|suggests|appears|may indicate|looks like|seems to|"
    r"could be|likely|probably)\b",
    re.IGNORECASE,
)

WEIGHTS = {
    "citation_match": 0.40,
    "source_appropriateness": 0.20,
    "semantic_drift": 0.25,
    "inference_legitimacy": 0.15,
}

# Severity thresholds
_CRITICAL_THRESHOLD = 0.70
# V1: NOTE tier (< _WATCH_THRESHOLD) not yet rendered — derives to "watch".
# Keep for V2 promotion path.
_WATCH_THRESHOLD = 0.40


def _extract_numbers(text: str) -> list[float]:
    """Extract all numerical values from text, normalizing currency suffixes."""
    values: list[float] = []
    covered_starts: set[int] = set()

    for m in _PCT_RE.finditer(text):
        values.append(float(m.group(1)))
        for i in range(m.start(), m.end()):
            covered_starts.add(i)

    for m in _CURRENCY_RE.finditer(text):
        raw = m.group(1).replace(",", "")
        val = float(raw)
        suffix = (m.group(2) or "").upper()
        if suffix == "K":
            val *= 1_000
        elif suffix == "M":
            val *= 1_000_000
        elif suffix == "B":
            val *= 1_000_000_000
        values.append(val)
        for i in range(m.start(), m.end()):
            covered_starts.add(i)

    for m in _PLAIN_NUM_RE.finditer(text):
        if m.start() not in covered_starts:
            values.append(float(m.group(1)))

    return values


def _fact_numbers(fact: Any) -> list[float]:
    """Extract numerical values from a Fact's value_display and text fields."""
    combined = " ".join(filter(None, [
        getattr(fact, "value_display", None),
        getattr(fact, "text", None),
    ]))
    return _extract_numbers(combined)


def _safe_fact_value(fact: Any, max_chars: int = 200) -> str:
    """Sanitize a fact value for inclusion in an LLM prompt."""
    val = getattr(fact, "value_display", None) or getattr(fact, "text", "?") or "?"
    return str(val).replace("\n", " ").replace("\r", " ")[:max_chars]


def compute_citation_match(claim_text: str, cited_facts: list[Any]) -> float:
    """
    Mechanical citation match score.
    Returns probability this is a real problem (0.0 = fine, 1.0 = definitely bad).
    """
    is_hedged = bool(_HEDGE_RE.search(claim_text))
    # Strip citation markers (·N) before number extraction so fact_ids aren't
    # treated as numerical claims.
    claim_text_clean = _CITATION_RE.sub("", claim_text)
    claim_numbers = _extract_numbers(claim_text_clean)
    has_citations = bool(cited_facts)

    # --- No citations branch ---
    if not has_citations:
        if claim_numbers:
            return 0.85  # uncited quantitative claim
        # Qualitative: apply hard floor if not hedged
        return 0.30 if is_hedged else 0.60

    # --- Has citations but no numerical content ---
    if not claim_numbers:
        return 0.30  # qualitative claim — defer to LLM sub-scores

    # --- Per-fact numerical comparison ---
    # A claim must be consistent with ALL cited facts, not just the best one.
    # For each (claim_number, cited_fact) pair, find the closest number WITHIN
    # that fact. Track the MAXIMUM mismatch across all pairs — if any cited
    # fact is badly mismatched, that's the score.
    any_fact_has_numbers = False
    max_rel_diff = 0.0
    for fact in cited_facts:
        fact_nums = _fact_numbers(fact)
        if not fact_nums:
            continue
        any_fact_has_numbers = True
        for cn in claim_numbers:
            fact_best = min(
                abs(cn - fn) / max(abs(fn), 1.0)
                for fn in fact_nums
            )
            max_rel_diff = max(max_rel_diff, fact_best)

    if not any_fact_has_numbers:
        # Citations exist but no extractable numbers from any fact
        return 0.30

    if max_rel_diff > 0.20:
        return 0.95
    elif max_rel_diff > 0.05:
        return 0.65
    else:
        return 0.10


async def _llm_score(
    prompt: str,
    client: Any,
    model: str,
    system_payload: Any = None,
) -> tuple[float, str]:
    """Single narrow LLM scoring call. Returns (score, reason). Defaults to 0.5 on failure."""
    try:
        create_kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": 80,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_payload is not None:
            create_kwargs["system"] = system_payload
        resp = await client.messages.create(**create_kwargs)
        text = resp.content[0].text.strip()
        # Split on any whitespace (space or newline) to separate score from reason
        parts = text.split(None, 1)
        score = float(parts[0])
        reason = parts[1].strip() if len(parts) > 1 else ""
        return max(0.0, min(1.0, score)), reason
    except Exception:
        log.exception("scorer.llm_score_failed")
        return 0.5, "scoring unavailable"


async def compute_source_appropriateness(
    claim_text: str,
    cited_facts: list[Any],
    client: Any,
    model: str,
    system_payload: Any = None,
) -> tuple[float, str]:
    """
    Narrow LLM judgment: is this source appropriate for this claim?
    Returns (score, reason) where higher score = more inappropriate.
    Averages across multiple cited facts.
    """
    if not cited_facts:
        return 0.5, "no cited facts"

    scores: list[float] = []
    reasons: list[str] = []
    for fact in cited_facts:
        prompt = (
            f'CLAIM: "{claim_text}"\n'
            f"CITED FACT: source={getattr(fact, 'source_system', '?')}, "
            f"field={getattr(fact, 'field', '?')}, "
            f"value={_safe_fact_value(fact)}\n\n"
            "On a scale of 0.0 to 1.0, score how INAPPROPRIATE this source is for "
            "this claim. Higher = more inappropriate.\n"
            "- 0.0: Source is the canonical, expected source for this kind of claim\n"
            "- 0.3: Source is plausible but not ideal\n"
            "- 0.7: Source is wrong domain\n"
            "- 1.0: Source is unrelated to claim entirely\n\n"
            "Respond with just a number 0.0-1.0 and a 1-sentence reason."
        )
        s, r = await _llm_score(prompt, client, model, system_payload)
        scores.append(s)
        reasons.append(r)

    avg = sum(scores) / len(scores)
    return avg, "; ".join(reasons)


async def compute_semantic_drift(
    claim_text: str,
    cited_facts: list[Any],
    client: Any,
    model: str,
    system_payload: Any = None,
) -> tuple[float, str]:
    """
    Narrow LLM judgment: does the claim amplify or drift from the cited facts?
    Returns (score, reason) where higher = more drift.
    """
    if not cited_facts:
        return 0.5, "no cited facts"

    fact_displays = "\n".join(
        f"- {_safe_fact_value(f)}"
        for f in cited_facts
    )
    prompt = (
        f'CLAIM: "{claim_text}"\n'
        f"CITED FACTS:\n{fact_displays}\n\n"
        "On a scale of 0.0 to 1.0, score how much the claim AMPLIFIES or DRIFTS "
        "from what the cited facts actually say. Higher = more drift.\n"
        "- 0.0: Claim is a faithful, neutral restatement of the facts\n"
        "- 0.3: Claim adds mild interpretation\n"
        "- 0.6: Claim amplifies tone\n"
        "- 1.0: Claim says something the facts don't support at all\n\n"
        "Respond with just a number 0.0-1.0 and a 1-sentence reason."
    )
    return await _llm_score(prompt, client, model, system_payload)


async def compute_inference_legitimacy(
    claim_text: str,
    has_citations: bool,
    client: Any,
    model: str,
    system_payload: Any = None,
) -> tuple[float, str]:
    """
    Narrow LLM judgment: for uncited claims, is this legitimately hedged?
    Returns (score, reason). For cited claims always returns (0.0, "").
    """
    if has_citations:
        return 0.0, ""

    prompt = (
        f'UNCITED CLAIM: "{claim_text}"\n\n'
        "This claim has no fact_id citations, so it must be either:\n"
        "(a) A synthesis/inference that hedges appropriately, OR\n"
        "(b) A definitive uncited assertion (problematic).\n\n"
        "On a scale of 0.0 to 1.0, score how PROBLEMATIC this is.\n"
        "- 0.0: Claim uses clear hedge language and reads as a synthesis\n"
        "- 0.4: Claim is partially hedged but slips into definitive framing\n"
        "- 1.0: Claim is a definitive uncited assertion\n\n"
        "Respond with just a number 0.0-1.0 and a 1-sentence reason."
    )
    return await _llm_score(prompt, client, model, system_payload)


async def compute_warning_confidence(
    warning: dict[str, Any],
    fact_lookup: Callable[[int], Any] | None,
    client: Any,
    model: str,
    system_payload: Any = None,
) -> dict[str, Any]:
    """
    Augments a warning dict with warning_confidence, scores, reasoning fields.
    Derives severity from warning_confidence thresholds.
    fact_lookup: callable(fact_id: int) -> Fact | None, or None if no FactBook available.
    """
    brief_excerpt = warning.get("brief_excerpt", "") or ""

    # Extract cited fact_ids from the brief_excerpt (·N markers)
    cited_fact_ids = [int(m.group(1)) for m in _CITATION_RE.finditer(brief_excerpt)]
    cited_facts: list[Any] = []
    if fact_lookup and cited_fact_ids:
        for fid in cited_fact_ids:
            f = fact_lookup(fid)
            if f is not None:
                cited_facts.append(f)

    has_citations = bool(cited_fact_ids)

    # Strip citation markers before sending to LLM sub-scores
    claim_text_clean = _CITATION_RE.sub("", brief_excerpt).strip()

    # Sub-score 1: mechanical
    try:
        citation_match = compute_citation_match(brief_excerpt, cited_facts)
    except Exception:
        log.exception("scorer.citation_match_failed")
        citation_match = 0.5

    # Sub-scores 2–4: narrow LLM judgments
    try:
        source_appropriateness, sa_reason = await compute_source_appropriateness(
            claim_text_clean, cited_facts, client, model, system_payload
        )
    except Exception:
        log.exception("scorer.source_appropriateness_failed")
        source_appropriateness, sa_reason = 0.5, "scoring unavailable"

    try:
        semantic_drift, sd_reason = await compute_semantic_drift(
            claim_text_clean, cited_facts, client, model, system_payload
        )
    except Exception:
        log.exception("scorer.semantic_drift_failed")
        semantic_drift, sd_reason = 0.5, "scoring unavailable"

    try:
        inference_legitimacy, il_reason = await compute_inference_legitimacy(
            claim_text_clean, has_citations, client, model, system_payload
        )
    except Exception:
        log.exception("scorer.inference_legitimacy_failed")
        inference_legitimacy, il_reason = 0.5, "scoring unavailable"

    # Weighted sum
    warning_confidence = max(0.0, min(1.0, (
        WEIGHTS["citation_match"] * citation_match
        + WEIGHTS["source_appropriateness"] * source_appropriateness
        + WEIGHTS["semantic_drift"] * semantic_drift
        + WEIGHTS["inference_legitimacy"] * inference_legitimacy
    )))

    # Derive severity from thresholds
    if warning_confidence >= _CRITICAL_THRESHOLD:
        derived_severity = "critical"
    else:
        derived_severity = "watch"

    log.info(
        "validator.warning_scored",
        extra={
            "claim_text": brief_excerpt[:100],
            "citation_match": citation_match,
            "source_appropriateness": source_appropriateness,
            "semantic_drift": semantic_drift,
            "inference_legitimacy": inference_legitimacy,
            "warning_confidence": warning_confidence,
            "derived_severity": derived_severity,
        },
    )

    return {
        **warning,
        "severity": derived_severity,
        "original_severity": warning.get("severity", "watch"),
        "warning_confidence": warning_confidence,
        "scores": {
            "citation_match": citation_match,
            "source_appropriateness": source_appropriateness,
            "semantic_drift": semantic_drift,
            "inference_legitimacy": inference_legitimacy,
        },
        "reasoning": {
            "source_appropriateness": sa_reason,
            "semantic_drift": sd_reason,
            "inference_legitimacy": il_reason,
        },
    }

"""Unit tests for the decomposed warning confidence scorer."""
import pytest
from backend.scorer import _extract_numbers, compute_citation_match


# --- _extract_numbers ---

def test_extract_percentage():
    assert 17.0 in _extract_numbers("adoption dropped 17% in 90 days")

def test_extract_percentage_and_plain():
    nums = _extract_numbers("adoption dropped 17% in 90 days")
    assert 90.0 in nums

def test_extract_currency_k():
    nums = _extract_numbers("revenue is $940K")
    assert 940_000.0 in nums

def test_extract_currency_m():
    nums = _extract_numbers("ARR is $1.4M")
    assert pytest.approx(1_400_000.0) in nums

def test_extract_plain_range():
    nums = _extract_numbers("score went from 74 to 61")
    assert 74.0 in nums
    assert 61.0 in nums

def test_extract_empty():
    assert _extract_numbers("no numbers here") == []


# --- compute_citation_match ---

class _MockFact:
    def __init__(self, value_display, text):
        self.value_display = value_display
        self.text = text
        self.source_system = "Catalyst"
        self.field = "score"


def test_citation_match_big_miss_single_fact():
    # 17 (percent) vs -13 (point delta) — this is the actual Beauty catch
    # abs(17 - 13)/13 = 0.31 → > 0.20 → 0.95
    fact = _MockFact("-13", "health_delta: -13")
    score = compute_citation_match("adoption dropped 17%·1", [fact])
    assert score == pytest.approx(0.95)


def test_citation_match_worst_case_wins_across_facts():
    # Two cited facts: one mismatches (17 vs -13), one is close (17 vs -18).
    # Per-fact evaluation takes the WORST match, not the best.
    # fact_id 41 (-13): rel_diff(17,13)=0.31 → >0.20 → mismatch
    # fact_id 40 (-18): rel_diff(17,18)=0.056 → <0.20 → OK
    # max_rel_diff=0.31 → score=0.95 (worst-case wins)
    fact_41 = _MockFact("-13", "health_delta: -13")
    fact_40 = _MockFact("-18.0", "sends_trend_pct: -18.0")
    score = compute_citation_match("adoption dropped 17%·40·41", [fact_40, fact_41])
    assert score == pytest.approx(0.95)


def test_citation_match_within_5pct():
    # Claim says 13 points, fact shows delta -13 — should be close match
    fact = _MockFact("-13", "health_score delta: -13")
    score = compute_citation_match("dropped 13 points·1", [fact])
    assert score == pytest.approx(0.10)  # |13-13|/13 = 0 → all match


def test_citation_match_suspect():
    # 17 vs -18 alone: abs(17-18)/18 = 0.056 (5-20% range → suspect)
    fact = _MockFact("-18.0", "sends_trend_pct: -18.0")
    score = compute_citation_match("adoption dropped 17%·1", [fact])
    assert score == pytest.approx(0.65)


def test_citation_match_no_citations_quantitative_not_hedged():
    score = compute_citation_match("adoption dropped 17%", [])
    assert score == pytest.approx(0.85)


def test_citation_match_no_citations_qualitative_not_hedged():
    score = compute_citation_match("The exec sponsor is fully engaged", [])
    assert score == pytest.approx(0.60)  # floor applied


def test_citation_match_no_citations_hedged():
    score = compute_citation_match("This suggests strong executive sponsorship", [])
    assert score == pytest.approx(0.30)  # no floor for hedged


def test_citation_match_qualitative_with_citations():
    fact = _MockFact(None, "Exec sponsor: Sam Rivera, CMO, Champion")
    score = compute_citation_match("exec sponsor Sam Rivera·1", [fact])
    assert score == pytest.approx(0.30)  # no numbers, defer to LLM


# --- LLM sub-score tests ---

from unittest.mock import AsyncMock, MagicMock
from backend.scorer import (
    compute_inference_legitimacy,
    compute_source_appropriateness,
    compute_semantic_drift,
    _llm_score,
)


def _mock_client(response_text: str):
    """Build a minimal mock AsyncAnthropic client that returns response_text."""
    block = MagicMock()
    block.text = response_text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=resp)
    return client


async def test_llm_score_parses_number_and_reason():
    client = _mock_client("0.7 Source is in the wrong domain entirely.")
    score, reason = await _llm_score("prompt", client, "claude-haiku-4-5-20251001")
    assert score == pytest.approx(0.7)
    assert "wrong domain" in reason


async def test_llm_score_clamps_above_1():
    client = _mock_client("1.5 Way off.")
    score, _ = await _llm_score("prompt", client, "claude-haiku-4-5-20251001")
    assert score == pytest.approx(1.0)


async def test_llm_score_defaults_on_failure():
    client = MagicMock()
    client.messages.create = AsyncMock(side_effect=RuntimeError("API down"))
    score, reason = await _llm_score("prompt", client, "claude-haiku-4-5-20251001")
    assert score == pytest.approx(0.5)
    assert reason == "scoring unavailable"


async def test_source_appropriateness_single_fact():
    fact = _MockFact("Sam Rivera, CMO", "Salesforce contact: Sam Rivera")
    fact.source_system = "Salesforce"
    fact.field = "contact_name"
    client = _mock_client("0.3 Salesforce is plausible but LinkedIn would be more current.")
    score, reason = await compute_source_appropriateness(
        "exec sponsor Sam Rivera·1", [fact], client, "claude-haiku-4-5-20251001"
    )
    assert score == pytest.approx(0.3)


async def test_inference_legitimacy_skipped_for_cited():
    score, reason = await compute_inference_legitimacy(
        "claim·1", has_citations=True, client=None, model=""
    )
    assert score == pytest.approx(0.0)
    assert reason == ""


# --- compute_warning_confidence combiner tests ---

from backend.scorer import compute_warning_confidence


async def test_compute_warning_confidence_deterministic_high():
    """17% claim vs cited facts [-13 delta, -18%] → citation_match=0.95 → confidence >= 0.70.

    Mirrors the actual Northstar Beauty catch: claim says "17%" but
    cited fact_id 41 has value_display="-13" (health delta, rel_diff=0.31 > 0.20).
    """
    fact_41 = _MockFact("-13", "health_delta: -13")
    fact_41.source_system = "Catalyst"
    fact_41.field = "health_delta"
    fact_40 = _MockFact("-18.0", "sends_trend_pct: -18.0")
    fact_40.source_system = "Snowflake"
    fact_40.field = "sends_trend_pct"

    # Mock client returns 0.8 for all LLM calls (problematic claim → high LLM scores).
    # Math check: 0.40*0.95 + 0.20*0.8 + 0.25*0.8 + 0.15*0.0 = 0.38+0.16+0.20+0.0 = 0.74 ≥ 0.70
    client = _mock_client("0.8 Source is inappropriate for this claim.")

    warning = {
        "severity": "watch",
        "type": "unsupported_claim",
        "message": "17% not supported by cited facts",
        "brief_excerpt": "adoption dropped 17% in 90 days·40·41",
        "sources": ["snowflake", "catalyst"],
    }

    def lookup(fid: int):
        if fid == 40:
            return fact_40
        if fid == 41:
            return fact_41
        return None

    result = await compute_warning_confidence(
        warning, lookup, client, "claude-haiku-4-5-20251001"
    )

    assert result["warning_confidence"] >= 0.70
    assert result["severity"] == "critical"
    assert "scores" in result
    # fact_41 drives: abs(17-13)/13 = 0.31 > 0.20 → citation_match = 0.95
    assert result["scores"]["citation_match"] == pytest.approx(0.95)
    assert "reasoning" in result


async def test_compute_warning_confidence_low_confidence():
    """Hedged qualitative uncited claim → low confidence."""
    client = _mock_client("0.1 Hedge language present.")

    warning = {
        "severity": "watch",
        "type": "missing_ground",
        "message": "Uncited hedged claim",
        "brief_excerpt": "This suggests the exec sponsor is engaged",
        "sources": [],
    }

    result = await compute_warning_confidence(
        warning, None, client, "claude-haiku-4-5-20251001"
    )

    # citation_match = 0.30 (hedged, no citations)
    # All LLM scores = 0.1
    # confidence = 0.40*0.30 + 0.20*0.1 + 0.25*0.1 + 0.15*0.1 = 0.12 + 0.06 + 0.025 + 0.015 = 0.22
    assert result["warning_confidence"] < 0.40
    assert result["severity"] == "watch"


async def test_compute_warning_confidence_preserves_original_fields():
    """Augmented warning must keep all original fields intact."""
    client = _mock_client("0.5 Neutral.")
    warning = {
        "severity": "critical",
        "type": "source_contradiction",
        "message": "Test message",
        "brief_excerpt": "some claim",
        "sources": ["salesforce"],
    }
    result = await compute_warning_confidence(
        warning, None, client, "claude-haiku-4-5-20251001"
    )
    assert result["type"] == "source_contradiction"
    assert result["message"] == "Test message"
    assert result["sources"] == ["salesforce"]

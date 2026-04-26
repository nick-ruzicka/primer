# References Block + Inference-Voice Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two-axis credibility system from `docs/superpowers/specs/2026-04-24-references-block-design.md` — `RAW | SCORED | SURFACED` provenance on every reference entry, gutter-mark typography on inferential prose, full removal of the coarse section-level confidence pills.

**Architecture:** Extend backend `Fact` dataclass with provenance metadata. Refactor `build_context_blob` in `backend/agent.py` to emit one fact per cited *field* instead of one per intelligence *section*. Dual-emit the SSE `source_cited` event with both new and legacy fields during migration, then tighten. Rewrite frontend `CitationMeta` as a discriminated union keyed on `provenance`. Migrate consumer components one at a time (`ReferencesSection` → `CitationTooltip` → `ReferenceModal` → fixtures). Ship V1 inference detection via hedge-phrase regex at paragraph granularity applying a 2px warm-amber left-gutter CSS rule; V2 structured spans are parked in `specs/10_INFERENCE_SPANS_V2.md`. Remove `HedgePill` and trim `ConfidenceStrip` in the same commit as the prose typography to keep the visual redesign coherent.

**Tech Stack:** Python 3.12 (`backend/`, FastAPI + Anthropic SDK + MCP), TypeScript + React + Next.js 16 Turbopack (`frontend/`). Tests: `uv run pytest` for backend, `tsc --noEmit` + dev-server browser verification for frontend. A single `node --test` file for the inference-detector pure function (no framework setup needed).

**Working directory:** This plan targets `feature/reading-view-redesign` on the existing worktree at `.worktrees/reading-view-redesign/`. All paths below are relative to that worktree's root. Confirm before starting:

```bash
git worktree list
# expect: .worktrees/reading-view-redesign  <sha>  [feature/reading-view-redesign]
cd .worktrees/reading-view-redesign
```

**Migration posture:** tasks are grouped into phases A–H that match the 4-step spec migration (§9 of the design). Each task produces a single commit. Each phase boundary is a natural pause point for review.

---

## File structure

**Backend (Python, in `backend/`):**

| File | Change | Responsibility after change |
|---|---|---|
| `agent.py` | Extend `Fact` dataclass; refactor `build_context_blob` to per-field; update `source_cited` emission. | Fact registry + per-field fact construction + citation streaming |
| `skills/master.md` | Add one sentence to the citation rules. | Brief prompt (voice + citation discipline) |
| `intelligence.py` | Light helper additions if needed (depends on existing shape). | Intelligence bundle builder |
| `tests/test_fact_provenance.py` | **New.** Unit tests for extended `Fact` and per-field fact emission. | Regression coverage for the refactor |

**Frontend (TypeScript/React, in `frontend/`):**

| File | Change | Responsibility after change |
|---|---|---|
| `lib/types.ts` | Rewrite `CitationMeta` as discriminated union; drop `hedge` from `BriefSection`. | Shared type surface |
| `lib/sse.ts` | Update `pushSourceCited` path to carry new fields. | SSE → store pipeline |
| `lib/inference-detector.ts` | **New.** Pure function: paragraph text → `isInference` boolean. | V1 inference voice detection |
| `lib/inference-detector.test.mjs` | **New.** Node native test runner tests. | Unit coverage for detector |
| `lib/fixtures/northstar-beauty-brief.ts` | Rebuild citations array against new union; drop hedge blocks from sections. | Canonical mock fixture |
| `lib/fixtures/briefs-registry.ts` (+ other fixture files) | Same migration as ns-beauty. | Mock fixtures for other accounts |
| `components/brief/references-section.tsx` | Rewrite against Variant A mockup. | Reference list at end of brief |
| `components/brief/reference-modal.tsx` | Add "View original" button for SURFACED with `url`. | Full-detail modal on row click |
| `components/brief/citation-tooltip.tsx` | Consume new `CitationMeta` fields in the preview. | Hover tooltip over `·N` chips |
| `components/brief/prose.tsx` | Apply `.inference` className per paragraph via detector. | Brief body rendering |
| `components/brief/brief.tsx` | Pass new-shape citations through; wire URL to modal. | Brief container |
| `components/brief/brief-section.tsx` | Remove `HedgePill` import + render. | Section heading + body |
| `components/brief/hedge-pill.tsx` | **DELETE.** | n/a |
| `components/confidence-strip.tsx` | Drop `· {confidenceLabel}` segment. | Top-of-brief status strip |
| `app/globals.css` | Add `.inference` class rule (gutter border). | Global styles |

---

## Phase A — Data model foundation

Backend `Fact` extension, frontend types rewrite, SSE dual-emit scaffolding. Lands one commit per task. After Phase A, briefs still work end-to-end on the old field shapes via back-compat — nothing visible changes yet.

### Task 1: Extend `Fact` dataclass with provenance metadata

**Files:**
- Modify: `backend/agent.py:67-71` (Fact dataclass) and `backend/agent.py:80-104` (FactBook.add)
- Create: `backend/tests/test_fact_provenance.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_fact_provenance.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py -v
```

Expected: 4 FAILURES with `TypeError: FactBook.add() got an unexpected keyword argument 'provenance'` (or similar).

- [ ] **Step 3: Extend `Fact` dataclass + `FactBook.add` signature**

Replace `backend/agent.py:67-71` and surrounding FactBook class. New top-of-file imports (add `Literal` if missing):

```python
from typing import Any, Literal
```

Replace the `Fact` dataclass and `FactBook` class (lines ~65-110) with:

```python
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
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def timestamp(self) -> str | None:
        """Back-compat accessor — existing code reading .timestamp gets data_as_of
        (or retrieved_at as fallback) so the old time_ago code path keeps working."""
        return self.data_as_of or self.retrieved_at


class FactBook:
    """Monotonic fact_id allocator. Each add() produces a single cited fact
    tagged with provenance metadata (spec §4.1)."""

    def __init__(self) -> None:
        self._facts: list[Fact] = []
        self._counter = 0

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
    ) -> Fact:
        self._counter += 1
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Confirm nothing else breaks by running the full test suite**

```bash
uv run pytest -v
```

Expected: all tests pass *except possibly* `test_phase_smoke.py` if it relies on old `FactBook.add` positional args. If that smoke fails, note the failure line — Task 2's `build_context_blob` refactor will fix it. Don't fix the smoke test here.

- [ ] **Step 6: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "feat(backend): extend Fact dataclass with provenance metadata

Adds provenance (raw|scored|surfaced), source_system, source_module,
field, value_display, snippet, retrieved_at, data_as_of, url to Fact.
FactBook.add is now keyword-only with per-field named args.

Prompt context format unchanged — Claude's interface stays stable.
Legacy .timestamp accessor preserved via property for back-compat.

Ref: spec §4.1"
```

---

### Task 2: Rewrite `CitationMeta` as a discriminated union

**Files:**
- Modify: `frontend/lib/types.ts` (search for `interface CitationMeta` or `type CitationMeta`)
- Modify: `frontend/lib/fixtures/northstar-beauty-brief.ts` if `CitationMeta` is defined there (spec notes it might be — verify)

- [ ] **Step 1: Locate the current CitationMeta definition**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
grep -rn "interface CitationMeta\|type CitationMeta" lib/ 2>/dev/null
```

Expected: one or two hits. The canonical definition is the one imported by `sse.ts` and `brief.tsx`. Note the file path.

- [ ] **Step 2: Rewrite the type as a discriminated union**

In the file that defines `CitationMeta` (likely `lib/types.ts` or `lib/fixtures/northstar-beauty-brief.ts`), replace the existing `CitationMeta` interface/type with:

```ts
export type FactProvenance = "raw" | "scored" | "surfaced";

type CitationCommon = {
  /** 1-indexed display number that appears as ·N in prose. */
  n: number;
  /** Stable id for citation-chip ↔ reference-entry lookup. */
  evid: string;
  /** Full display name: "NetSuite", "Catalyst", "Salesforce", "Gong", "Snowflake", "Exa". */
  source_system: string;
  /** Subsystem label: "Accounts Receivable", "Forecast", "LinkedIn post by Priya Shah". */
  source_module?: string;
  /** ISO — when the backend fetched it. */
  retrieved_at: string;
  /** ISO — when the data represents. Optional; often null for live RAW reads. */
  data_as_of?: string;
  /** Pre-computed human relative string from backend: "pulled 2h ago", "posted 13d ago". */
  time_ago: string;

  // ---- back-compat shim (drop after final migration pass) ----
  /** @deprecated use source_system. Kept during migration. */
  source: string;
  /** @deprecated use field + value_display or snippet. Kept during migration. */
  label: string;
};

export type CitationMeta =
  | (CitationCommon & {
      provenance: "raw" | "scored";
      /** Field path: "past_due_balance", "relationship_score". */
      field: string;
      /** Formatted value for display: "$18,500", "61 / 100", "Commit". */
      value_display: string;
    })
  | (CitationCommon & {
      provenance: "surfaced";
      /** The quoted passage (e.g. LinkedIn post body, web snippet). */
      snippet: string;
      /** External URL when source exposes one. */
      url?: string;
    });
```

- [ ] **Step 3: Run the TypeScript compiler to find every consumer that breaks**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
npx tsc --noEmit 2>&1 | head -80
```

Expected: several errors. Record the list — these are the files Tasks 3 onwards will fix. Don't fix them yet. Typical errors will reference:
- `lib/sse.ts` (the `pushSourceCited` event handler)
- `components/brief/references-section.tsx`
- `components/brief/citation-tooltip.tsx`
- `components/brief/reference-modal.tsx`
- `lib/fixtures/*.ts`

- [ ] **Step 4: Add a short comment block at the file top explaining the union**

Prepend to the file where `CitationMeta` lives, above the type:

```ts
/**
 * CitationMeta — discriminated union keyed on `provenance`.
 *
 * RAW (directly measured) and SCORED (upstream-system model output) share
 * the `field` + `value_display` shape. SURFACED (third-party content from
 * Exa/web) uses `snippet` + optional `url` instead.
 *
 * The union forces the renderer to branch on `provenance` and statically
 * know which fields exist. See docs/superpowers/specs/2026-04-24-references-block-design.md §3.
 */
```

- [ ] **Step 5: Commit (the type change + broken-consumers list as commit body)**

```bash
git add lib/types.ts  # adjust path if different
git commit -m "feat(frontend): rewrite CitationMeta as discriminated union

Keyed on provenance (raw|scored|surfaced). RAW/SCORED entries carry
field + value_display; SURFACED entries carry snippet + optional url.
Back-compat fields source + label kept during migration (drop in final
cleanup pass).

Consumer migration follows: sse.ts → ReferencesSection → CitationTooltip
→ ReferenceModal → fixtures. Each lands in a separate commit.

Ref: spec §3"
```

---

### Task 3: Dual-emit `source_cited` SSE event with new + legacy fields

**Files:**
- Modify: `backend/agent.py:659-664` (first emission, inside the streaming loop)
- Modify: `backend/agent.py:683-688` (second emission, after stream)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
def test_source_cited_payload_includes_new_fields():
    """When a fact is emitted via source_cited, the payload must carry the
    full provenance shape alongside the legacy source/fact/evid fields."""
    from backend.agent import _build_source_cited_payload  # added in step 3
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest backend/tests/test_fact_provenance.py -v
```

Expected: 2 new failures with `ImportError: cannot import name '_build_source_cited_payload' from 'backend.agent'`.

- [ ] **Step 3: Add the helper + refactor both emission sites**

Add to `backend/agent.py`, above the `stream_brief` function (around line 540):

```python
def _build_source_cited_payload(fact: Fact) -> dict[str, Any]:
    """Build the SSE source_cited payload carrying both new (provenance +
    per-field) and legacy (source/fact/evid/label) fields. Spec §4.5.

    Legacy fields are dual-emitted during frontend migration and removed
    in the final cleanup pass once all call-sites consume the new shape."""
    return {
        # new fields
        "provenance": fact.provenance,
        "source_system": fact.source_system,
        "source_module": fact.source_module,
        "field": fact.field,
        "value_display": fact.value_display,
        "snippet": fact.snippet,
        "retrieved_at": fact.retrieved_at,
        "data_as_of": fact.data_as_of,
        "url": fact.url,
        # shared / back-compat
        "citation_number": fact.fact_id,
        "source": _normalize_source(fact.source),
        "time_ago": fact.time_ago,
        "fact": fact.text,
        "evid": fact.text,  # frontend tooltip/body uses `evid`
        "label": fact.text,  # legacy short label
    }
```

Replace both emission blocks. First site (around `backend/agent.py:659`):

```python
yield BriefStreamEvent(
    "source_cited",
    _build_source_cited_payload(fact),
)
```

Second site (around `backend/agent.py:683`):

```python
yield BriefStreamEvent(
    "source_cited",
    _build_source_cited_payload(fact),
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest backend/tests/test_fact_provenance.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "feat(backend): dual-emit source_cited with new + legacy fields

Adds _build_source_cited_payload helper and uses it at both emission
sites. Payload carries provenance/source_system/source_module/field/
value_display/snippet/retrieved_at/data_as_of/url alongside the
pre-existing source/fact/evid/label for back-compat during frontend
migration.

Legacy fields will be removed in the final cleanup commit.

Ref: spec §4.5, §9 step 1"
```

---

## Phase B — Backend per-field refactor

The biggest functional change: `build_context_blob` stops emitting one bundled fact per section and starts emitting one fact per cited field. After Phase B, the backend emits the 25-35 per-brief citations the spec targets. The frontend still consumes the legacy `source` + `label` fields, so end-to-end briefs still work.

**Pre-phase check:** Read `backend/agent.py:138-500` (the `build_context_blob` function). Note every `fb.add(...)` call site. The refactor visits each one.

Helpers added once in Task 4 are used across all per-source tasks (5–10).

### Task 4: Add `_now_iso()` and `_time_ago_from_iso()` helpers

**Files:**
- Modify: `backend/agent.py` — add helpers near the top of the file after existing `_money`, `_pct_delta`, etc.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
def test_now_iso_returns_z_suffix():
    from backend.agent import _now_iso
    result = _now_iso()
    assert result.endswith("Z")
    assert "T" in result  # ISO datetime format


def test_time_ago_from_iso_relative_string():
    from backend.agent import _time_ago_from_iso
    # Anchor-aware — the project pins ANCHOR_DATE in .env; the helper
    # reads that and computes relative to it. Test passes a known anchor.
    assert _time_ago_from_iso("2026-04-24T12:00:00Z", anchor="2026-04-24T14:00:00Z") == "2h ago"
    assert _time_ago_from_iso("2026-04-23T14:00:00Z", anchor="2026-04-24T14:00:00Z") == "1d ago"
    assert _time_ago_from_iso(None, anchor="2026-04-24T14:00:00Z") == "—"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_now_iso_returns_z_suffix backend/tests/test_fact_provenance.py::test_time_ago_from_iso_relative_string -v
```

Expected: FAILs with `ImportError: cannot import name '_now_iso'`.

- [ ] **Step 3: Implement the helpers**

Add to `backend/agent.py` near the other `_` helpers (around line 130):

```python
from datetime import datetime, timezone
import os


def _now_iso() -> str:
    """ISO timestamp for the backend's current 'now', respecting ANCHOR_DATE
    when set (demo mode). Format: 2026-04-24T14:30:00Z."""
    anchor = os.getenv("ANCHOR_DATE")
    if anchor:
        # Treat anchor as midnight UTC of the named day + a synthetic offset
        # that we've been using elsewhere in the demo. Keep in sync with
        # backend/config.py if that pattern already exists there.
        return f"{anchor}T14:00:00Z"
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _time_ago_from_iso(iso: str | None, anchor: str | None = None) -> str:
    """Human relative string from an ISO timestamp, anchored to the project's
    ANCHOR_DATE if set. Returns '—' for None input."""
    if iso is None:
        return "—"
    try:
        then = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return "—"
    if anchor:
        now = datetime.fromisoformat(anchor.replace("Z", "+00:00"))
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest backend/tests/test_fact_provenance.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "feat(backend): add _now_iso and _time_ago_from_iso helpers

Used by the per-field build_context_blob refactor (Tasks 5-10) to stamp
every Fact with retrieved_at + time_ago. Respects ANCHOR_DATE for demo
mode."
```

---

### Task 5: Refactor `build_context_blob` — Salesforce per-field facts

**Files:**
- Modify: `backend/agent.py:138-300` (roughly — the Salesforce portion of `build_context_blob`)

Replace every `fb.add("salesforce", ...)` call with per-field `fb.add(provenance=..., source="salesforce", source_system="Salesforce", source_module="...", field="...", value_display="...", ...)` calls. Each account-level attribute, contract-level attribute, contact entry, and opportunity entry becomes its own Fact.

All Salesforce facts are **RAW** per the spec §4.4 audit table.

- [ ] **Step 1: Read the current Salesforce section**

```bash
sed -n '140,260p' /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/backend/agent.py
```

Note the sections: `# Account`, `# Contract`, `# Contacts`, `# Open opportunities`, `# Recent closed opportunities`, `# Account hierarchy`.

- [ ] **Step 2: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
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
    # Every fact is RAW
    assert all(f.provenance == "raw" for f in sf_facts)
    # Every fact has a field name
    assert all(f.field is not None for f in sf_facts)
    # Every fact has source_system = "Salesforce"
    assert all(f.source_system == "Salesforce" for f in sf_facts)
    # Specific fields present
    fields = {f.field for f in sf_facts}
    assert "account_name" in fields
    assert "arr_cents" in fields
    assert "stage" in fields
```

- [ ] **Step 3: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_emits_per_field_salesforce_facts -v
```

Expected: FAIL (current code emits one bundled Salesforce fact).

- [ ] **Step 4: Refactor the Salesforce block in `build_context_blob`**

Replace the existing `# Account` / `# Contract` / `# Contacts` / `# Open opportunities` / `# Recent closed opportunities` / `# Account hierarchy` blocks with the per-field versions. The pattern:

```python
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
```

Remove the old `sections.append(f"## Account\n[source: salesforce, fact_id: {fact.fact_id}] {fact.text}")` lines for each block — the prompt context blob is rebuilt from the FactBook via `to_raw_context()` at the end of the function.

**Important:** if the existing `build_context_blob` appends to `sections` list manually to render the context blob, change the final return to use the FactBook's built-in rendering. At the bottom of the function, find the section-joining and replace with:

```python
    context_blob = f"# ACCOUNT CONTEXT FOR BRIEFING — {account_id}\n\n" + fb.to_raw_context()
    return context_blob, fb
```

- [ ] **Step 5: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_emits_per_field_salesforce_facts -v
```

Expected: PASS.

- [ ] **Step 6: Smoke-test end-to-end: spin up a brief locally, verify nothing crashes**

```bash
# From one terminal, start backend
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
PATH="$HOME/.local/bin:$PATH" uv run uvicorn backend.main:app --port 8000 --log-level info &
# Wait ~5s, then trigger a brief
curl -sS 'http://localhost:8000/briefing/ns-beauty?refresh=1' --max-time 90 | head -c 4000
# Stop the backend
kill %1
```

Expected: a stream of `data:` SSE lines. Look for `"provenance":"raw"` in at least one `source_cited` event.

- [ ] **Step 7: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): Salesforce per-field facts in build_context_blob

Every Salesforce attribute (account_name, arr_cents, stage, contract
fields, each contact, each opportunity, hierarchy) is now its own Fact
with provenance=raw, source_system='Salesforce', and the appropriate
source_module.

Context blob for Claude is rebuilt via FactBook.to_raw_context() — the
prompt interface is unchanged.

Ref: spec §4.2, §4.4 (Salesforce rows)"
```

---

### Task 6: Refactor `build_context_blob` — Catalyst per-field facts (mixed RAW/SCORED)

**Files:**
- Modify: `backend/agent.py` (the `# Relationship health` + `# Catalyst renewal forecast` + `# Expansion readiness` blocks)

Catalyst is the key mixed-provenance example. `relationship_status` and `last_executive_touch` are **RAW**; `relationship_score`, `score_delta`, `renewal_forecast`, `expansion_readiness` are **SCORED**.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
def test_build_context_blob_splits_catalyst_by_provenance():
    """Catalyst's get_relationship_health mixes RAW (status, last exec
    touch) and SCORED (relationship_score, score_delta) fields. The
    per-field split must tag each correctly."""
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

    # RAW fields
    assert by_field["relationship_status"].provenance == "raw"
    assert by_field["last_executive_touch"].provenance == "raw"
    # SCORED fields
    assert by_field["relationship_score"].provenance == "scored"
    assert by_field["renewal_forecast"].provenance == "scored"
    assert by_field["expansion_readiness"].provenance == "scored"

    # value_display present
    assert by_field["relationship_score"].value_display == "61 / 100"
    assert by_field["renewal_forecast"].value_display == "Best Case"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_splits_catalyst_by_provenance -v
```

Expected: FAIL.

- [ ] **Step 3: Refactor the Catalyst blocks**

Replace the Catalyst portion of `build_context_blob`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_splits_catalyst_by_provenance -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): Catalyst per-field facts, RAW vs SCORED split

relationship_status and last_executive_touch → RAW.
relationship_score, renewal_forecast, expansion_readiness → SCORED.

Spec §4.4 audit table: Catalyst is the primary example of an MCP tool
response that yields mixed-provenance facts — the per-field split
handles this naturally.

Ref: spec §4.2, §4.4 (Catalyst rows)"
```

---

### Task 7: Refactor `build_context_blob` — NetSuite per-field facts

**Files:**
- Modify: `backend/agent.py` (the NetSuite blocks: billing_status, ap_policy_flags, recent_invoices)

All NetSuite facts are **RAW** per the spec §4.4 (post-flip on `get_ap_policy_flags`).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
def test_build_context_blob_netsuite_all_raw():
    """NetSuite fields are all RAW — ledger values and deterministic rule
    outputs (AP policy flags). Flip from earlier draft that had flags as
    SCORED. Ref spec §4.4 refinement."""
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_netsuite_all_raw -v
```

Expected: FAIL.

- [ ] **Step 3: Refactor the NetSuite blocks**

Replace (or add if missing) the NetSuite section of `build_context_blob`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_netsuite_all_raw -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): NetSuite per-field facts, all RAW

past_due_balance, days_overdue, current_balance, AP policy flags, and
each recent invoice are their own Fact. All RAW — ledger values and
deterministic rule-based AP flags pass the 'reproducible without
learned weights' test.

Ref: spec §4.4 refinement (AP flags flip from SCORED to RAW)"
```

---

### Task 8: Refactor `build_context_blob` — Gong per-field facts (mixed RAW + SCORED)

**Files:**
- Modify: `backend/agent.py` (Gong blocks: recent_calls, competitor_mentions, pricing_signals)

Gong's `get_competitor_mentions` is the *second* key mixed-provenance example. `competitor_name` and `excerpt` are **RAW** (extracted text); `sentiment` is **SCORED** (NLP classifier output). Spec §4.4.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_fact_provenance.py`:

```python
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
    by_prov = {}
    for f in gong_facts:
        by_prov.setdefault(f.provenance, []).append(f.field)
    assert "raw" in by_prov, "expected RAW facts for competitor_name/excerpt"
    assert "scored" in by_prov, "expected SCORED fact for sentiment"
    assert any("sentiment" in f for f in by_prov["scored"])
    assert any("competitor" in f or "excerpt" in f for f in by_prov["raw"])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_gong_competitor_split -v
```

Expected: FAIL.

- [ ] **Step 3: Refactor the Gong blocks**

Add/replace:

```python
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
            # RAW — the competitor name + excerpt
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
            # SCORED — the sentiment classifier output
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_gong_competitor_split -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): Gong per-field facts — RAW excerpt + SCORED sentiment

get_competitor_mentions produces two Fact entries per record: the
excerpt and competitor name are RAW (direct extraction), the sentiment
classifier output is SCORED.

get_recent_calls = RAW (metadata), get_pricing_signals = SCORED (NLP).

Ref: spec §4.4 (Gong rows; per-field split for mixed-provenance MCP
responses)"
```

---

### Task 9: Refactor `build_context_blob` — Snowflake per-field facts (mixed RAW + SCORED)

**Files:**
- Modify: `backend/agent.py` (Snowflake blocks: usage_metrics, portfolio_comparison)

Snowflake raw counts are **RAW**; portfolio comparison (percentile, peer_median) is **SCORED**.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_snowflake_split -v
```

Expected: FAIL.

- [ ] **Step 3: Refactor the Snowflake blocks**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_snowflake_split -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): Snowflake per-field facts

get_usage_metrics → RAW (counts). get_portfolio_comparison → SCORED
(peer_median and percentile require comparison math).

Ref: spec §4.4 (Snowflake rows)"
```

---

### Task 10: Refactor `build_context_blob` — Exa per-field facts (SURFACED, carry `url`)

**Files:**
- Modify: `backend/agent.py` (Exa blocks: search_account_signals, get_decision_maker_signals)

Every Exa result is **SURFACED** and should carry `url` + `snippet` into the Fact.

- [ ] **Step 1: Write the failing test**

```python
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
    assert ef.field is None  # SURFACED has no field
    assert ef.value_display is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_fact_provenance.py::test_build_context_blob_exa_surfaced_with_url -v
```

Expected: FAIL.

- [ ] **Step 3: Refactor the Exa blocks**

```python
    # ---- Exa: Account signals (SURFACED — third-party web content) ----
    account_signals = bundle.exa.get("search_account_signals") or []
    if isinstance(account_signals, list):
        now = _now_iso()
        for hit in account_signals:
            snippet = hit.get("snippet") or hit.get("text") or ""
            if not snippet:
                continue
            title = hit.get("title", "")
            published = hit.get("published_at") or hit.get("date")
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
            published = hit.get("published_at") or hit.get("date")
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
```

- [ ] **Step 4: Run tests + the full suite**

```bash
uv run pytest backend/tests/ -v
```

Expected: all Phase-B tests pass. `test_phase_smoke.py` may still fail if it asserted on exact fact counts — if so, update its expected citation count to match the new per-field output (25-35 per brief).

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/tests/test_fact_provenance.py
git commit -m "refactor(backend): Exa per-field facts, SURFACED with url threaded

search_account_signals and get_decision_maker_signals each emit one
Fact per hit with provenance=surfaced, snippet=result text,
url=result URL (when present). Modal's 'View original' button will
thread to fact.url on the frontend.

Ref: spec §4.4 (Exa rows), §5.3 (View original interaction)"
```

---

### Task 11: Update the briefing prompt with per-field citation discipline

**Files:**
- Modify: `backend/skills/master.md` — add one paragraph to the citation rules

- [ ] **Step 1: Read the current citation rules**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
grep -n "cite\|citation" backend/skills/master.md | head
```

Note where the existing citation rule ("a fact cited twice reuses its number") lives.

- [ ] **Step 2: Add the new rule**

Insert immediately after the existing citation-reuse rule (find it in the file first; the exact location depends on what's already there). The new paragraph:

```markdown
Cite the most specific field once per claim. The fact registry now
exposes one fact per field (e.g. `relationship_score` is its own fact,
separate from `relationship_status` and `last_executive_touch` even
though they come from the same Catalyst call). Prefer the precise
field-level citation over a more general one. Do not restate a
citation across sentences for the same fact unless a second citation
materially adds to the argument — a fact cited twice reuses its
number (existing rule); prefer one precise citation over two redundant
ones.
```

- [ ] **Step 3: Verify by running a brief manually**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
PATH="$HOME/.local/bin:$PATH" uv run uvicorn backend.main:app --port 8000 --log-level info &
sleep 5
curl -sSN 'http://localhost:8000/briefing/ns-beauty?refresh=1' --max-time 120 | grep '"citation_number"' | wc -l
kill %1
```

Expected: the count should land in the 18-35 range (up from ~8-12). Exact number depends on which account; the target is "demonstrably more citations, not 10×".

- [ ] **Step 4: Commit**

```bash
git add backend/skills/master.md
git commit -m "prompt: cite most specific field once per claim

Per-field fact split (Tasks 5-10) multiplies the citable unit count.
This rule keeps brief prose from feeling over-annotated — prefer one
precise field-level citation over bundled or restated citations for
the same fact across a paragraph.

Ref: spec §4.3"
```

---

## Phase C — Frontend consumes new CitationMeta shape

At this point the backend emits both new and legacy fields on `source_cited`. Now migrate the frontend components one at a time. After each component commit, the app still runs end-to-end — `tsc --noEmit` should be green at every step.

### Task 12: Update `sse.ts` to populate new CitationMeta fields

**Files:**
- Modify: `frontend/lib/sse.ts` (the `source_cited` event handler + `pushSourceCited` → store)

- [ ] **Step 1: Locate the source_cited handler**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
grep -n "source_cited\|pushSourceCited" lib/sse.ts
```

Around `lib/sse.ts:354` there's an `es.addEventListener("source_cited", ...)`.

- [ ] **Step 2: Update the handler to parse new fields**

Replace the existing `source_cited` handler body with:

```ts
es.addEventListener("source_cited", (e) => {
  try {
    const data = JSON.parse((e as MessageEvent).data);
    // New shape (provenance-aware). Backend dual-emits during migration.
    const base = {
      n: data.citation_number,
      evid: data.evid,
      source_system: data.source_system ?? data.source, // fallback to short id
      source_module: data.source_module ?? undefined,
      retrieved_at: data.retrieved_at ?? new Date().toISOString(),
      data_as_of: data.data_as_of ?? undefined,
      time_ago: data.time_ago ?? "",
      // legacy back-compat fields (drop in final cleanup)
      source: data.source,
      label: data.label ?? data.fact ?? "",
    };
    let citation: CitationMeta;
    if (data.provenance === "surfaced") {
      citation = {
        ...base,
        provenance: "surfaced",
        snippet: data.snippet ?? data.fact ?? "",
        url: data.url ?? undefined,
      };
    } else {
      // "raw" | "scored" — default to "raw" if provenance missing (legacy briefs)
      citation = {
        ...base,
        provenance: (data.provenance as "raw" | "scored") ?? "raw",
        field: data.field ?? "",
        value_display: data.value_display ?? data.fact ?? "",
      };
    }
    pushSourceCited(citation);
  } catch (err) {
    console.error("[primer] source_cited parse error", err);
  }
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: fewer errors than after Task 2 — this handler is now correct. Some component-level errors may remain; those are addressed in Tasks 13+.

- [ ] **Step 4: Smoke-test**

Start the frontend dev server (Next dev) and the backend (uvicorn). Load a live brief for `ns-beauty` and verify citations arrive. No visual regression expected yet — tooltip and references block will look unchanged because they still read the legacy fields.

```bash
# terminal 1: backend
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
PATH="$HOME/.local/bin:$PATH" uv run uvicorn backend.main:app --port 8000 --log-level info
# terminal 2: frontend
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
npx next dev
```

Open `http://localhost:3000`, trigger a brief, confirm no console errors. Stop both when done.

- [ ] **Step 5: Commit**

```bash
git add lib/sse.ts
git commit -m "feat(frontend): parse provenance + per-field source_cited shape

source_cited handler now constructs CitationMeta by branching on
data.provenance. Falls back to 'raw' with value_display=data.fact for
legacy briefs or events where provenance is missing — safe migration.

Consumer components (ReferencesSection, CitationTooltip, ReferenceModal,
fixtures) migrate next.

Ref: spec §3, §9 step 2"
```

---

### Task 13: Rewrite `<ReferencesSection>` to Variant A layout

**Files:**
- Modify: `frontend/components/brief/references-section.tsx` (full rewrite)

Target layout is Variant A from the brainstorm mockup (`.superpowers/brainstorm/.../references-section.html`). Entries have three rows: source header, field=value or snippet, timing + tag chip.

- [ ] **Step 1: Read the current implementation to remember what's there**

```bash
cat /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/components/brief/references-section.tsx
```

Confirm it's the 46-line minimal version.

- [ ] **Step 2: Replace the component with the Variant A implementation**

Replace `frontend/components/brief/references-section.tsx` with:

```tsx
"use client";

import type { CitationMeta, FactProvenance } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReferencesSectionProps {
  id?: string;
  citations: CitationMeta[];
  onReferenceClick?: (evid: string) => void;
  highlightedCitationId?: string | null;
}

const SOURCE_DOT_COLOR: Record<string, string> = {
  Salesforce: "var(--color-source-sf)",
  Snowflake: "var(--color-source-snowflake)",
  Catalyst: "var(--color-source-catalyst)",
  NetSuite: "var(--color-source-netsuite)",
  Gong: "var(--color-source-gong)",
  Exa: "var(--color-source-exa)",
};

const TAG_LABEL: Record<FactProvenance, string> = {
  raw: "Raw",
  scored: "Scored",
  surfaced: "Surfaced",
};

const TAG_CLASS: Record<FactProvenance, string> = {
  raw: "text-ink-4",
  scored: "text-warn-strong",
  surfaced: "text-source-exa",
};

export function ReferencesSection({
  id,
  citations,
  onReferenceClick,
  highlightedCitationId,
}: ReferencesSectionProps) {
  if (citations.length === 0) return null; // §5.4 empty-state rule

  return (
    <section
      id={id}
      className="references-section mt-24 pt-6 border-t border-line"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-4">
        References
      </h3>
      <ol className="space-y-0">
        {citations.map((citation) => {
          const isHighlighted = highlightedCitationId === citation.evid;
          const dotColor =
            SOURCE_DOT_COLOR[citation.source_system] ??
            "var(--color-source-internal)";
          return (
            <li
              key={citation.evid}
              className={cn(
                "grid grid-cols-[28px_1fr] gap-3 py-3 border-b border-line/30 cursor-pointer",
                "hover:bg-surface-sunk rounded",
                isHighlighted && "bg-accent-soft/20 shadow-[inset_2px_0_0_var(--color-accent)] px-2",
              )}
              onClick={() => onReferenceClick?.(citation.evid)}
            >
              <span className="font-serif text-ink-3 text-sm text-right pt-0.5">
                {citation.n}.
              </span>
              <div className="min-w-0">
                {/* row 1: source system + module */}
                <div className="text-xs text-ink-3 mb-1">
                  <span
                    className="inline-block w-[7px] h-[7px] rounded-full mr-2 align-[2px]"
                    style={{ background: dotColor }}
                  />
                  <span className="text-ink-2 font-medium">
                    {citation.source_system}
                  </span>
                  {citation.source_module && (
                    <span className="text-ink-3"> · {citation.source_module}</span>
                  )}
                </div>

                {/* row 2: field = value OR snippet */}
                {citation.provenance === "surfaced" ? (
                  <div className="font-serif italic text-ink-2 text-[14.5px] leading-snug mb-1">
                    "{citation.snippet}"
                  </div>
                ) : (
                  <div className="font-mono text-sm text-ink mb-1">
                    <span className="text-ink-3">{citation.field}</span>
                    <span className="text-ink-4 mx-1">=</span>
                    <span className="text-ink font-medium">
                      {citation.value_display}
                    </span>
                  </div>
                )}

                {/* row 3: timing · tag */}
                <div className="text-[11.5px] text-ink-4 flex items-center gap-2">
                  {citation.data_as_of && (
                    <>
                      <span>data as of {citation.data_as_of.slice(0, 10)}</span>
                      <span className="text-ink-4">·</span>
                    </>
                  )}
                  <span
                    className={cn(
                      citation.provenance === "surfaced" &&
                        (citation as Extract<CitationMeta, { provenance: "surfaced" }>).url &&
                        "after:content-['_↗'] after:text-ink-4 after:text-xs",
                    )}
                  >
                    {citation.time_ago}
                  </span>
                  <span
                    className={cn(
                      "text-[9.5px] font-bold tracking-wider uppercase px-[7px] py-[2px] rounded-full border",
                      TAG_CLASS[citation.provenance],
                      "ml-auto",
                    )}
                  >
                    {TAG_LABEL[citation.provenance]}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep references-section
```

Expected: no errors in this file.

- [ ] **Step 4: Visual verification**

Start dev server + backend. Load `http://localhost:3000`, click into a hot account (ns-beauty), let the brief stream. Switch to Reading mode (key `3`). Scroll to the bottom of the brief. Verify:

- References heading renders
- Each entry has the source dot + name + module on row 1
- Row 2 shows `field = value` for RAW/SCORED, italic snippet for SURFACED
- Tag chip at the right end colored per provenance (gray for Raw, amber for Scored, orange for Surfaced)
- Clicking a `·N` chip in prose scrolls and highlights the matching entry

Known issue at this stage: `ReferenceModal` still uses the old shape, so clicking an entry may fail silently or show outdated content. Task 14 fixes this.

- [ ] **Step 5: Commit**

```bash
git add components/brief/references-section.tsx
git commit -m "feat(frontend): rewrite ReferencesSection to Variant A layout

Three-row entry structure (source header / field=value or snippet /
timing + provenance tag chip). Tag chip colored per provenance per
spec §5.2. SURFACED entries with url get a trailing ↗ indicator.

ReferenceModal integration updates in the next commit.

Ref: spec §5.1-5.2, §5.4"
```

---

### Task 14: Update `<ReferenceModal>` with "View original" for SURFACED

**Files:**
- Modify: `frontend/components/brief/reference-modal.tsx`

- [ ] **Step 1: Read the current modal**

```bash
cat /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/components/brief/reference-modal.tsx
```

- [ ] **Step 2: Rewrite to consume new `CitationMeta` fields**

Replace with:

```tsx
"use client";

import type { CitationMeta } from "@/lib/types";

interface ReferenceModalProps {
  citation: CitationMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReferenceModal({
  citation,
  isOpen,
  onClose,
}: ReferenceModalProps) {
  if (!isOpen || !citation) return null;

  const isSurfaced = citation.provenance === "surfaced";
  const url = isSurfaced
    ? (citation as Extract<CitationMeta, { provenance: "surfaced" }>).url
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-lg max-w-xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-4 mb-1">
              Reference ·{citation.n}
            </div>
            <h2 className="text-lg font-serif text-ink">
              {citation.source_system}
              {citation.source_module && (
                <span className="text-ink-3"> · {citation.source_module}</span>
              )}
            </h2>
          </div>
          <span
            className={`text-[9.5px] font-bold tracking-wider uppercase px-2 py-1 rounded-full border ${
              citation.provenance === "raw"
                ? "text-ink-4"
                : citation.provenance === "scored"
                ? "text-warn-strong"
                : "text-source-exa"
            }`}
          >
            {citation.provenance}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          {isSurfaced ? (
            <blockquote className="font-serif italic text-ink-2 text-base leading-relaxed border-l-2 border-line pl-4 py-1">
              "{(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet}"
            </blockquote>
          ) : (
            <div className="font-mono text-sm">
              <div className="text-ink-3 mb-1">Field</div>
              <div className="text-ink">
                {(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).field}
              </div>
              <div className="text-ink-3 mt-3 mb-1">Value</div>
              <div className="text-ink font-medium">
                {(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).value_display}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line text-xs text-ink-3 space-y-1">
            <div>
              <span className="text-ink-4">Retrieved:</span>{" "}
              {new Date(citation.retrieved_at).toLocaleString()}
            </div>
            {citation.data_as_of && (
              <div>
                <span className="text-ink-4">Data as of:</span>{" "}
                {new Date(citation.data_as_of).toLocaleString()}
              </div>
            )}
            <div>
              <span className="text-ink-4">Relative:</span> {citation.time_ago}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-accent text-accent-ink rounded font-medium text-sm hover:opacity-90"
            >
              View original ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-sunk text-ink-2 rounded text-sm hover:bg-line"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep reference-modal
```

Expected: no errors.

- [ ] **Step 4: Visual verification**

Dev server running. Click a row in the References section. Modal should open with:
- Provenance badge top-right
- For SURFACED entries: blockquote snippet + "View original ↗" button
- For RAW/SCORED: field/value labeled clearly
- Retrieved / Data as of / Relative timing block
- Close button

Click "View original" on an Exa row — should open in new tab. Verify no `window.opener` leak by checking new tab's `window.opener` in its console (should be `null`).

- [ ] **Step 5: Commit**

```bash
git add components/brief/reference-modal.tsx
git commit -m "feat(frontend): ReferenceModal renders new CitationMeta shape

- Provenance badge in header
- Blockquote snippet for SURFACED, field/value grid for RAW/SCORED
- 'View original ↗' button for SURFACED with url, target=_blank
  rel=noopener noreferrer (safety per spec §5.3)
- Retrieved / data_as_of / relative timing block

Ref: spec §5.3"
```

---

### Task 15: Update `<CitationTooltip>` to consume new fields

**Files:**
- Modify: `frontend/components/brief/citation-tooltip.tsx`

- [ ] **Step 1: Read + rewrite**

Replace with:

```tsx
"use client";

import type { CitationMeta } from "@/lib/types";

interface CitationTooltipProps {
  citation: CitationMeta;
  x: number;
  y: number;
}

export function CitationTooltip({ citation, x, y }: CitationTooltipProps) {
  const isSurfaced = citation.provenance === "surfaced";
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 bg-surface border border-line-strong rounded-md px-3 py-2 shadow-md max-w-[320px]"
      style={{ left: x + 12, top: y + 12 }}
    >
      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-1">
        ·{citation.n} · {citation.provenance}
      </div>
      <div className="text-xs font-medium text-ink mb-1">
        {citation.source_system}
        {citation.source_module && (
          <span className="text-ink-3"> · {citation.source_module}</span>
        )}
      </div>
      {isSurfaced ? (
        <div className="text-xs text-ink-2 font-serif italic leading-snug">
          "{(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet.slice(0, 140)}
          {(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet.length > 140 ? "…" : ""}"
        </div>
      ) : (
        <div className="font-mono text-xs text-ink">
          <span className="text-ink-3">{(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).field}</span>
          <span className="text-ink-4 mx-1">=</span>
          <span>{(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).value_display}</span>
        </div>
      )}
      <div className="text-[10px] text-ink-4 mt-1">{citation.time_ago}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + visual check**

```bash
npx tsc --noEmit 2>&1 | grep citation-tooltip
```

Expected: clean. Hover a `·N` chip in the brief prose — tooltip should show provenance type, system/module, field=value or snippet, and time_ago.

- [ ] **Step 3: Commit**

```bash
git add components/brief/citation-tooltip.tsx
git commit -m "feat(frontend): CitationTooltip renders new CitationMeta shape

Shows provenance, source system + module, field=value or truncated
snippet, and relative time. Matches the ReferencesSection visual
language so hover preview ↔ clicked entry feel consistent.

Ref: spec §5.3 (hover interaction)"
```

---

## Phase D — Fixtures migration

### Task 16: Migrate `northstar-beauty-brief.ts` fixture to new CitationMeta shape

**Files:**
- Modify: `frontend/lib/fixtures/northstar-beauty-brief.ts` — rewrite the `citations` array to the discriminated union

- [ ] **Step 1: Read current fixture**

```bash
grep -n "citations:" /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/lib/fixtures/northstar-beauty-brief.ts | head
sed -n "/citations:/,/^  \]/p" /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/lib/fixtures/northstar-beauty-brief.ts | head -80
```

- [ ] **Step 2: Rewrite the citations array with real provenance metadata**

Replace each existing `{ n, source, evid, label, time_ago }` object with the discriminated-union shape. Example rewrite — adapt to the actual entries in the file:

```ts
  citations: [
    {
      n: 1,
      evid: "ns-beauty-past-due-ar",
      provenance: "raw",
      source_system: "NetSuite",
      source_module: "Accounts Receivable",
      field: "past_due_balance",
      value_display: "$18,500",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "pulled 2h ago",
      source: "netsuite",
      label: "NetSuite past_due_balance: $18,500",
    },
    {
      n: 2,
      evid: "ns-beauty-forecast",
      provenance: "raw",
      source_system: "Salesforce",
      source_module: "Opportunities",
      field: "forecast_category",
      value_display: "Commit",
      retrieved_at: "2026-04-22T14:00:00Z",
      data_as_of: "2026-06-30T00:00:00Z",
      time_ago: "pulled 1h ago",
      source: "sf",
      label: "Salesforce forecast: Commit",
    },
    {
      n: 3,
      evid: "ns-beauty-rel-score",
      provenance: "scored",
      source_system: "Catalyst",
      source_module: "Relationship health",
      field: "relationship_score",
      value_display: "61 / 100",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "pulled 14m ago",
      source: "catalyst",
      label: "Catalyst relationship_score: 61",
    },
    // ... continue for each existing citation, mapping each to the right
    // provenance per the spec §4.4 table. Exa entries get snippet + url.
    {
      n: 12,
      evid: "ns-beauty-priya-post",
      provenance: "surfaced",
      source_system: "Exa",
      source_module: "LinkedIn post by Priya Shah",
      snippet:
        "Thinking hard about vendor consolidation for 2026 — too many tools, not enough leverage.",
      url: "https://linkedin.com/posts/priya-shah-abc123",
      retrieved_at: "2026-04-22T14:00:00Z",
      data_as_of: "2026-04-09T00:00:00Z",
      time_ago: "posted 13d ago",
      source: "exa",
      label: "Exa: Priya Shah LinkedIn post",
    },
  ],
```

(Fill in the remaining entries following the pattern — RAW/SCORED for system reads, SURFACED for Exa/web.)

- [ ] **Step 3: Leave `hedge` blocks in place for now**

**Do not** delete `hedge: {...}` objects from this fixture yet. The `BriefSection` type still requires the field at this step; removing the blocks here would break `tsc --noEmit`. All `hedge` cleanup (type field + every fixture + backend emission) happens atomically in Task 21 per spec §9 step 3.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "northstar-beauty|BriefFixture|BriefSection"
```

Expected: clean. Both the citations migration and the untouched hedge blocks compile against the current types.

- [ ] **Step 5: Visual verification**

Switch the dev server to mock mode (unset `NEXT_PUBLIC_API_BASE` or rename `.env.local` temporarily) and reload. Pick `ns-beauty`. Verify:
- References section renders 10-15 entries with correct provenance tags
- Clicking a `·N` chip scrolls to the matching reference
- Hover preview shows correct field/value/snippet

Restore `.env.local` after the check.

- [ ] **Step 6: Commit**

```bash
git add lib/fixtures/northstar-beauty-brief.ts
git commit -m "fixture: migrate ns-beauty citations to new union shape

Each citation now carries provenance (raw|scored|surfaced),
source_system, source_module, field+value_display OR snippet+url, and
explicit retrieved_at. Hedge blocks removed from sections (will be
removed from BriefSection type in Task 20).

Ref: spec §9 step 2"
```

---

### Task 17: Migrate remaining fixtures in `lib/fixtures/`

**Files:**
- Modify: every other `*-brief.ts` in `lib/fixtures/` and `lib/fixtures/briefs-registry.ts` mapping table

- [ ] **Step 1: List remaining fixtures**

```bash
ls /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/lib/fixtures/*.ts
grep -l "citations:" /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/lib/fixtures/*.ts
```

- [ ] **Step 2: For each fixture file, apply the same transform as Task 16**

Map each citation object to the union. **Leave `hedge` blocks in place** (removed atomically in Task 21). When the old `label` string doesn't carry enough structure to produce a clean `field = value_display` split — e.g., a `label` like `"Morgan Yu — Senior AE"` that mashes two concepts — use the whole label as `value_display` and pick the most descriptive short token for `field` (e.g., `field: "owner"`, `value_display: "Morgan Yu — Senior AE"`). Don't invent provenance if it's unclear from the label; default to `"raw"` for anything from Salesforce/NetSuite/Snowflake, `"scored"` for Catalyst/Gong score/sentiment language, `"surfaced"` for Exa.

- [ ] **Step 3: Type-check after each file; commit per file**

```bash
npx tsc --noEmit 2>&1 | grep fixtures
```

Expected: clean after each commit.

One commit per fixture file keeps review digestible:

```bash
git add lib/fixtures/northstar-active-brief.ts   # example
git commit -m "fixture: migrate northstar-active to new citation shape"
# repeat for each
```

- [ ] **Step 4: Final full-suite type-check**

```bash
npx tsc --noEmit
```

Expected: the only remaining errors should reference `BriefSection.hedge` — which Task 20 removes.

---

## Phase E — Prose typography (V1)

Detector + CSS + accessibility + a small instrumentation hook. Ship as separate small tasks so each is reviewable independently.

### Task 18: Add `lib/inference-detector.ts` pure function + node test

**Files:**
- Create: `frontend/lib/inference-detector.ts`
- Create: `frontend/lib/inference-detector.test.mjs`

- [ ] **Step 1: Write the detector as a pure function**

Create `frontend/lib/inference-detector.ts`:

```ts
/**
 * V1 hedge-phrase detector for inference-voice prose styling.
 *
 * Returns true if the given paragraph text contains any of the hedge
 * markers enforced by backend/skills/master.md, matched at word
 * boundaries (case-insensitive).
 *
 * Known limitation — adjective use of "likely" ("a likely buyer") is a
 * false positive. Documented in docs/superpowers/specs/2026-04-24-references-block-design.md §6
 * and the V2 parked spec removes this class via structured markers.
 *
 * Structured-span V2 plan: specs/10_INFERENCE_SPANS_V2.md.
 */
export function isInferenceParagraph(text: string): boolean {
  return HEDGE_RE.test(text);
}

// Word-boundary match. Phrases like "this suggests" include the preceding
// article so false-matches on "suggest" inside "suggestions" are avoided.
const HEDGE_RE =
  /\b(?:likely|probably|seems|appears|suggests?|my read|this read|reads less like|reads more like|looks like)\b/i;

/**
 * Count matches per hedge phrase, for V1 instrumentation (spec V2 §7).
 * Returns a map of phrase → occurrence count.
 */
export function hedgeMarkersIn(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const patterns: [string, RegExp][] = [
    ["likely", /\blikely\b/gi],
    ["probably", /\bprobably\b/gi],
    ["seems", /\bseems\b/gi],
    ["appears", /\bappears\b/gi],
    ["suggests", /\bsuggests?\b/gi],
    ["my read", /\bmy read\b/gi],
    ["this read", /\bthis read\b/gi],
    ["reads less like", /\breads less like\b/gi],
    ["reads more like", /\breads more like\b/gi],
    ["looks like", /\blooks like\b/gi],
  ];
  for (const [label, re] of patterns) {
    const m = text.match(re);
    if (m && m.length > 0) counts[label] = m.length;
  }
  return counts;
}
```

- [ ] **Step 2: Write the test file**

Create `frontend/lib/inference-detector.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isInferenceParagraph, hedgeMarkersIn } from "./inference-detector.ts";

test("flags 'this suggests' as inference", () => {
  assert.equal(
    isInferenceParagraph("This suggests the account will churn by Q3."),
    true,
  );
});

test("flags 'likely' as inference (modal use)", () => {
  assert.equal(
    isInferenceParagraph("Likely the most productive opening is AP."),
    true,
  );
});

test("also flags adjective-use 'likely' (known V1 false positive)", () => {
  // Documented limitation — we want this to flag even though it's a FP.
  assert.equal(
    isInferenceParagraph("A likely buyer emerged this week."),
    true,
  );
});

test("does not flag pure fact restatement", () => {
  assert.equal(
    isInferenceParagraph("Past-due AR is $18,500, now 41 days overdue."),
    false,
  );
});

test("handles multi-sentence paragraphs (first match wins)", () => {
  assert.equal(
    isInferenceParagraph(
      "Past-due AR is $18,500. My read: AP block is the inflection.",
    ),
    true,
  );
});

test("hedgeMarkersIn returns per-phrase counts", () => {
  const counts = hedgeMarkersIn(
    "Likely churn. This suggests risk. My read: hold.",
  );
  assert.equal(counts["likely"], 1);
  assert.equal(counts["suggests"], 1);
  assert.equal(counts["my read"], 1);
});
```

- [ ] **Step 3: Run the test and verify it fails (because .ts import in node --test needs a loader)**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
node --experimental-strip-types --test lib/inference-detector.test.mjs
```

Expected (Node ≥ 22.6): PASSES with `--experimental-strip-types`. If Node is older, temporarily convert `inference-detector.ts` → `.mjs` for the test run, or use `tsx`:

```bash
npx tsx --test lib/inference-detector.test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add lib/inference-detector.ts lib/inference-detector.test.mjs
git commit -m "feat(frontend): V1 inference-voice detector + unit tests

Pure function on paragraph text. Word-boundary hedge-phrase match
against the markers enforced by backend/skills/master.md. Known V1
false-positive class (adjective 'likely') documented in-file and in
spec §6.1.

hedgeMarkersIn() returns per-phrase counts for V1 instrumentation
(V2 parked spec §7 — logging requirement).

Ref: spec §6.1, parked V2 §7"
```

---

### Task 19: Apply `.inference` class in `prose.tsx` and CSS rule in `globals.css`

**Files:**
- Modify: `frontend/components/brief/prose.tsx` (import and use detector per paragraph)
- Modify: `frontend/app/globals.css` (add `.inference` rule)

- [ ] **Step 1: Read prose.tsx to understand the paragraph rendering**

```bash
cat /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/components/brief/prose.tsx | head -60
```

Find where each paragraph is rendered. The detector applies to the concatenated paragraph text.

- [ ] **Step 2: Add the detector to paragraph rendering**

In `prose.tsx`, at the top:

```tsx
import { isInferenceParagraph } from "@/lib/inference-detector";
```

Around the paragraph renderer, compute the paragraph's plain text and conditionally apply the class + aria-label:

```tsx
// before the existing paragraph <p> render, add this helper:
function paragraphPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.kind === "text" || n.kind === "bold" || n.kind === "italic") {
        return (n as { value: string }).value ?? "";
      }
      return ""; // cite/etc. don't contribute text for detection
    })
    .join(" ");
}
```

Then in the paragraph render (replace the existing `<p>` wrapper):

```tsx
const plain = paragraphPlainText(nodes);
const isInference = isInferenceParagraph(plain);
return (
  <p
    key={idx}
    className={cn("brief-paragraph", isInference && "inference")}
    aria-label={isInference ? "Inferential passage" : undefined}
  >
    {renderedInline}
  </p>
);
```

Keep the rest of the file's inline rendering exactly as-is.

- [ ] **Step 3: Add the CSS**

Append to `frontend/app/globals.css`:

```css
/* Inference-voice treatment (spec §6.2) — 2px warm-amber left gutter,
   body text stays full contrast. V1 detection is paragraph-level via
   lib/inference-detector.ts. */
.inference {
  position: relative;
  padding-left: 14px;
  border-left: 2px solid var(--color-warn-strong);
}
```

- [ ] **Step 4: Type-check + visual verification**

```bash
npx tsc --noEmit 2>&1 | grep -E "prose|inference"
```

Expected: clean.

Visual: load a brief in the dev server (ns-beauty works). The "The read" section's inferential paragraphs (containing "reads less like", "my read", "likely") should show the warm-amber gutter; fact-restatement paragraphs should not.

- [ ] **Step 5: Commit**

```bash
git add components/brief/prose.tsx app/globals.css
git commit -m "feat(frontend): inference-voice paragraph gutter (V1)

Paragraphs whose plain text triggers isInferenceParagraph() get a
2px warm-amber left border via .inference class. Body text contrast
unchanged (spec §6.2). aria-label='Inferential passage' for a11y.

Detection is paragraph-level (V1). V2 parked spec promotes to
sentence-level via structured markers.

Ref: spec §6.2, §6.3"
```

---

### Task 20: V1 instrumentation — log detector stats per brief

**Files:**
- Modify: `frontend/lib/store.ts` (or wherever briefs finalize) — emit a log on `markBriefDone`

This satisfies the V2 parked spec's §7 logging requirement so V2 promotion can be evidence-based.

- [ ] **Step 1: Locate `markBriefDone`**

```bash
grep -n "markBriefDone" /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend/lib/store.ts
```

- [ ] **Step 2: Emit a structured log when the brief finishes**

Add inside the `markBriefDone` action (or a helper invoked from it):

```ts
import { hedgeMarkersIn } from "./inference-detector";

function logInferenceDetectorStats(fixture: BriefFixture): void {
  if (typeof window === "undefined") return;
  const allParagraphs: string[] = [];
  for (const section of fixture.sections) {
    for (const p of section.paragraphs ?? []) {
      // Flatten inline nodes to text for logging
      const plain = p
        .map((n) => ("value" in n ? (n as { value: string }).value : ""))
        .join(" ");
      if (plain.trim()) allParagraphs.push(plain);
    }
  }
  const totalSentences = allParagraphs.reduce(
    (sum, p) => sum + (p.match(/[.!?]+(?:\s|$)/g)?.length ?? 1),
    0,
  );
  const markers: Record<string, number> = {};
  let inferenceParagraphCount = 0;
  for (const p of allParagraphs) {
    const phraseCounts = hedgeMarkersIn(p);
    const hadAny = Object.keys(phraseCounts).length > 0;
    if (hadAny) inferenceParagraphCount += 1;
    for (const [label, count] of Object.entries(phraseCounts)) {
      markers[label] = (markers[label] ?? 0) + count;
    }
  }
  const payload = {
    ts: new Date().toISOString(),
    kind: "inference.detector.stats",
    account_id: fixture.account_id,
    paragraph_count: allParagraphs.length,
    inference_paragraph_count: inferenceParagraphCount,
    total_sentences: totalSentences,
    markers_by_phrase: markers,
  };
  // Dev-mode: console.info + localStorage. Production backend collection
  // is out of scope for V1 per spec §11.
  console.info("[primer.inference-detector]", payload);
  try {
    const key = "primer:inference-detector-log";
    const existing = JSON.parse(
      window.localStorage.getItem(key) ?? "[]",
    ) as unknown[];
    existing.push(payload);
    // Keep last 50 briefs per V2 parked spec §7
    const trimmed = existing.slice(-50);
    window.localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    /* localStorage full or disabled — non-fatal */
  }
}
```

Invoke at the end of `markBriefDone`:

```ts
export function markBriefDone(meta: BriefDoneMeta): void {
  // ... existing logic that flips brief.complete = true ...
  const fixture = getState().brief.fixture;
  if (fixture) logInferenceDetectorStats(fixture);
}
```

- [ ] **Step 3: Verify**

Load a brief in dev, open DevTools → Console. After the brief completes, look for `[primer.inference-detector]` with payload. Check `localStorage.getItem("primer:inference-detector-log")` returns a JSON array.

- [ ] **Step 4: Commit**

```bash
git add lib/store.ts lib/inference-detector.ts
git commit -m "feat(frontend): V1 inference detector instrumentation

Emits a structured log on markBriefDone with paragraph/sentence counts
and per-phrase marker occurrences. Dev-mode: console.info + localStorage
(last 50 briefs). Backend log collection is out of scope for V1.

This satisfies the V2 parked spec §7 requirement — V2 promotion can be
evidence-based from day one.

Ref: parked spec specs/10_INFERENCE_SPANS_V2.md §7"
```

---

## Phase F — Remove coarse confidence labels (ship with Phase E)

### Task 21: Delete `HedgePill`, remove from `BriefSection` + every fixture, trim `ConfidenceStrip`

**Files:**
- Delete: `frontend/components/brief/hedge-pill.tsx`
- Modify: `frontend/components/brief/brief-section.tsx` (remove import + usage)
- Modify: `frontend/lib/types.ts` (remove `hedge` from `BriefSection` type)
- Modify: **every** `frontend/lib/fixtures/*-brief.ts` (delete `hedge: {...}` blocks from each section)
- Modify: `frontend/components/confidence-strip.tsx` (drop `· {confidenceLabel}` segment)
- Modify: `frontend/app/page.tsx` (if it passes `confidenceLabel` as prop, drop the prop)

- [ ] **Step 1: Delete HedgePill**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
rm components/brief/hedge-pill.tsx
```

- [ ] **Step 2: Remove HedgePill from brief-section.tsx**

```bash
# Find and remove
grep -n "HedgePill" components/brief/brief-section.tsx
```

Delete the import line and the `<HedgePill ... />` render block (around lines 10 and 81-85 of the current file).

- [ ] **Step 3: Remove `hedge` from the `BriefSection` type AND every fixture, atomically**

This step has three sub-edits. Do them together — partial application breaks `tsc --noEmit` because the type and its usages must change in lockstep.

1. In `lib/types.ts` (or wherever `BriefSection` is defined), find `hedge: { level: ...; label: string; tip?: string }` and delete the line entirely.
2. In every file under `lib/fixtures/` matching `*-brief.ts`, delete each `hedge: {...}` block inside section objects.
3. Verify:

```bash
grep -rn "^\s*hedge:" lib/ | grep -v node_modules
```

Expected: **zero** matches. If any remain, delete and re-run.

- [ ] **Step 4: Trim ConfidenceStrip**

In `components/confidence-strip.tsx`, find the render that outputs `{confidence} · {confidenceLabel}`. Replace with just `{confidence}`. If there's no existing caption above the number, add a small inline qualifier:

```tsx
<span className="text-xs text-ink-3 uppercase tracking-wider mr-2">
  brief confidence
</span>
<span className="text-ink font-medium">{confidence}</span>
```

(Check the current component first — if there's already a "BRIEF CONFIDENCE" caption, just drop the `· label` and leave the caption in place.)

Also remove `confidenceLabel` from the `Props` interface and the defaulting.

- [ ] **Step 5: Remove `confidenceLabel` prop from page.tsx if passed**

```bash
grep -n "confidenceLabel" app/page.tsx
```

Delete the `confidenceLabel={...}` prop line.

- [ ] **Step 6: Stop backend emission of `hedge`**

In `backend/agent.py`, find any emission of `{"hedge": ...}` on brief section events. Delete.

```bash
cd /Users/nicholasruzicka/primer-attentive
grep -n '"hedge"\|hedge_level\|hedge_label' backend/agent.py backend/skills/master.md
```

Remove the lines. If `master.md` contains a prompt instruction to emit a hedge level, delete that instruction too.

- [ ] **Step 7: Type-check and visual verify**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
npx tsc --noEmit
```

Expected: clean.

Visual: load a brief. Section headers should no longer show "likely" / "very likely" pills. Top strip should show just the numeric confidence with whatever caption the component has.

- [ ] **Step 8: Commit (single coherent commit per spec §9 step 3)**

```bash
git add -A  # confirm diff first: git status
git commit -m "refactor: drop coarse confidence labels

- Delete HedgePill component (spec §7.1)
- Remove <HedgePill> usage from BriefSection
- Remove 'hedge' field from BriefSection type
- Remove hedge blocks from fixtures (already done in Task 16)
- Stop backend emission of hedge.level/hedge.label
- Trim ConfidenceStrip: show '84' not '84 · likely' (spec §7.2)

Sentence-level voice gutter (Task 19) + reference-block provenance
tags (Tasks 13-15) replace the coarse labels. Shipping together so
the visual redesign lands coherently per spec §9 step 3.

Ref: spec §7"
```

---

## Phase G — Final cleanup (after all frontends migrated)

### Task 22: Remove legacy back-compat fields from SSE payload and `CitationMeta`

**Files:**
- Modify: `backend/agent.py` (drop `source`/`fact`/`evid`/`label` from `_build_source_cited_payload`, keep only the new shape)
- Modify: `frontend/lib/types.ts` (remove the `source` + `label` shim fields from `CitationCommon`)
- Modify: `frontend/lib/sse.ts` (stop reading legacy fallbacks)

- [ ] **Step 1: Verify no consumer still reads `source` or `label`**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
grep -rn "\.source[^_]\|\.label" lib/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "source_system\|source_module\|source:\"\|label:" | head
```

Expected: no results that access `.source` or `.label` on a CitationMeta instance. If any remain, migrate them first.

- [ ] **Step 2: Drop shim fields from `CitationCommon`**

Remove these lines from the `CitationCommon` type in `lib/types.ts`:

```ts
// ---- back-compat shim (drop after final migration pass) ----
/** @deprecated use source_system. Kept during migration. */
source: string;
/** @deprecated use field + value_display or snippet. Kept during migration. */
label: string;
```

- [ ] **Step 3: Drop legacy fallbacks from sse.ts**

In the `source_cited` handler, change the `base` object to:

```ts
const base = {
  n: data.citation_number,
  evid: data.evid,
  source_system: data.source_system,
  source_module: data.source_module ?? undefined,
  retrieved_at: data.retrieved_at,
  data_as_of: data.data_as_of ?? undefined,
  time_ago: data.time_ago,
};
```

And drop the `?? data.fact` fallbacks in the branches — backend is authoritative now.

- [ ] **Step 4: Drop legacy fields from backend payload**

In `_build_source_cited_payload`, replace with:

```python
def _build_source_cited_payload(fact: Fact) -> dict[str, Any]:
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
    }
```

Update the corresponding test in `test_fact_provenance.py` — remove assertions on `source`, `fact`, `label`.

- [ ] **Step 5: Run full test suite + type-check + visual smoke**

```bash
cd /Users/nicholasruzicka/primer-attentive
uv run pytest -v
cd .worktrees/reading-view-redesign/frontend
npx tsc --noEmit
```

Both expected clean. Visual: load a brief end-to-end — references, tooltips, modal, inference gutter all still work.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: drop back-compat source/fact/label from citation payload

All frontend call-sites consume the discriminated-union shape. Backend
emits only the authoritative field set. CitationCommon no longer
carries the @deprecated shim fields.

Ref: spec §9 step 4 (final migration cutover)"
```

---

## Self-review (automated plan validation)

After finishing Task 22, run these checks to confirm the spec's acceptance criteria (§10) are met end-to-end:

- [ ] **Data model:**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
npx tsc --noEmit   # expect: clean
grep -rn "any\|unknown" lib/types.ts | grep -i "citation"  # expect: no escape hatches
```

- [ ] **References block:** load a brief in both dark and light themes; verify Variant A visual; click `·N` chip; verify scroll+highlight fades ~1.5s; click a SURFACED row; verify modal's "View original" opens new tab; verify 0-citation brief renders no References section (requires a mock with `citations: []`).

- [ ] **Prose typography:**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign/frontend
node --experimental-strip-types --test lib/inference-detector.test.mjs   # expect: all pass
```

Plus visual: confirm aria-label on inference paragraphs via DevTools Accessibility pane.

- [ ] **Confidence labels gone:**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
grep -rn "HedgePill\|hedge:" frontend/ backend/ | grep -v node_modules | grep -v ".next"
```

Expected: **zero** matches.

- [ ] **Backend citation count:**

```bash
cd /Users/nicholasruzicka/primer-attentive/.worktrees/reading-view-redesign
PATH="$HOME/.local/bin:$PATH" uv run uvicorn backend.main:app --port 8000 --log-level info &
sleep 5
curl -sSN 'http://localhost:8000/briefing/ns-beauty?refresh=1' --max-time 120 | grep '"citation_number"' | wc -l
kill %1
```

Expected: 18-35 citations. Verify two more accounts — `tidepool` and `kindred_pet` — land in a similar range.

---

## Done criteria

All of the following hold:

- `uv run pytest -v` — green
- `npx tsc --noEmit` — green
- `node --experimental-strip-types --test lib/inference-detector.test.mjs` — green
- Visual: ns-beauty brief loads, References block renders Variant A with correct tags, inference paragraphs have warm-amber gutter, no HedgePill anywhere, ConfidenceStrip shows just the numeric
- Backend brief citation count 18-35 for ns-beauty; mixed provenance types emitted
- No `source: string` or `label: string` fields on `CitationMeta`; no `hedge:` property on `BriefSection`

---

**After merging this work:** monitor `localStorage: primer:inference-detector-log` for ~4 weeks. If any V2 promotion trigger in `specs/10_INFERENCE_SPANS_V2.md` §6 fires, open a follow-up plan for V2.

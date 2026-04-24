# References block + inference-voice typography — design spec

**Date:** 2026-04-24
**Branch:** `feature/reading-view-redesign`
**Status:** Approved design. Ready for implementation plan.
**Parked follow-up:** `specs/10_INFERENCE_SPANS_V2.md`

---

## 1. Motivation

Today's brief shows per-section confidence pills ("likely", "very likely") and a minimal references list at the bottom. Both are coarse. A rep reading a brief needs a sharper answer to two questions on every claim:

1. **How much should I trust the underlying number?** (Is it a direct measurement from a system of record, or a scored metric from an upstream model, or third-party content we surfaced?)
2. **What kind of sentence is this?** (Is the brief restating a fact I can cite verbatim, or reasoning with the fact as load-bearing input?)

Neither question is answered by a fuzzy "likely" label at the section header. This spec replaces the coarse confidence treatment with a two-axis credibility system:

- **Axis 1 — Provenance.** Surface on every reference entry as a `RAW | SCORED | SURFACED` tag. Property of the cited value.
- **Axis 2 — Usage.** Surface in the prose itself via a left gutter mark on inferential sentences. Property of the sentence.

The two axes are orthogonal. A sentence can restate a scored metric ("Catalyst rates this Commit [·7]" — direct restatement of a SCORED value), or it can be an inference off a raw value ("Likely churn because AP is past-due [·1]" — inference off a RAW fact). Treating them as one "confidence" label conflates them.

## 2. Scope

**In scope:**

- Data-model extension of `CitationMeta` and backend `Fact` with provenance metadata
- Refactor of `backend/agent.py::build_context_blob` from section-level facts to per-field facts
- Provenance tagging audit of all six MCP-tool response categories
- Rebuild of `<ReferencesSection>` to render the new entry shape
- Click-through on SURFACED entries to external URL via the existing `ReferenceModal`
- V1 inference-voice typography in prose (hedge-phrase regex detector + 2px gutter mark)
- Removal of the per-section `HedgePill` and the `· likely` label on the top `ConfidenceStrip`

**Out of scope (documented separately):**

- Structured inference spans from the backend (`specs/10_INFERENCE_SPANS_V2.md`)
- Deep-link URLs on RAW/SCORED entries (e.g., Salesforce record links) — the `url` field is typed only on the SURFACED variant in V1
- Any sentence-level confidence scoring (the voice is binary: fact-restatement vs inference; there is no "70% inference" state)

## 3. Data model

Citations travel over SSE as JSON and land in the frontend as `CitationMeta`. Current shape is flat and thin. New shape is a discriminated union keyed on `provenance`:

```ts
// frontend: lib/types.ts (or wherever CitationMeta lives)
export type FactProvenance = "raw" | "scored" | "surfaced";

type CitationCommon = {
  n: number;               // 1-indexed display number
  evid: string;            // stable id for citation-chip ↔ reference-entry lookup
  source_system: string;   // display name: "NetSuite", "Catalyst", "Salesforce",
                           //               "Gong", "Snowflake", "Exa"
  source_module?: string;  // subsystem: "Accounts Receivable", "Forecast",
                           //            "Opportunities", "LinkedIn post by Priya Shah"
  retrieved_at: string;    // ISO — when backend fetched it
  data_as_of?: string;     // ISO — when the data represents (optional; often same
                           //       as retrieved_at for live reads, differs for
                           //       dated content like "posted on 2026-04-09")
  time_ago: string;        // pre-computed human string from backend: "pulled 2h ago",
                           //                                         "posted 13d ago"
};

export type CitationMeta =
  | (CitationCommon & {
      provenance: "raw" | "scored";
      field: string;                // "past_due_balance", "relationship_score"
      value_display: string;        // "$18,500", "61 / 100", "Commit"
    })
  | (CitationCommon & {
      provenance: "surfaced";
      snippet: string;              // "Thinking hard about vendor consolidation..."
      url?: string;                 // external URL when source exposes one
    });
```

### Why a discriminated union

Three provenance types have genuinely different rendering needs. `RAW` and `SCORED` use `field + value_display`; `SURFACED` uses `snippet`. A polymorphic `content: string` field would force the renderer to parse shape out of strings, or lose the `field=value` structural affordance on RAW/SCORED. The union makes the TS compiler carry the discipline: the renderer branches on `provenance` and statically knows which fields exist.

### Back-compat during migration

Existing `source: SourceId` short id and `label: string` display blob remain on the emitted payload as a compatibility shim while frontend call-sites migrate. **Deleted after all call-sites move over** — see §9 Migration.

### What's deliberately *not* on this type

- `confidence` or `score_quality` on scored metrics. Source systems don't advertise confidence today; adding a field we can't populate is clutter.
- `url` on RAW/SCORED. Future nice-to-have (deep links to Salesforce records, Catalyst dashboards). Not blocking V1.

## 4. Backend changes

### 4.1 Fact dataclass extension

`backend/agent.py` currently has:

```python
@dataclass
class Fact:
    fact_id: int
    source: str
    text: str
    timestamp: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)
```

New shape:

```python
@dataclass
class Fact:
    fact_id: int
    provenance: Literal["raw", "scored", "surfaced"]
    source: str                         # short id, preserved for back-compat
    source_system: str                  # display name
    source_module: str | None
    field: str | None                   # raw/scored: e.g. "past_due_balance"
    value_display: str | None           # raw/scored: formatted value
    snippet: str | None                 # surfaced: quoted passage
    retrieved_at: str                   # ISO
    data_as_of: str | None              # ISO
    time_ago: str                       # pre-computed relative (backend owns this)
    url: str | None                     # surfaced only (in V1); optional slot for later
    text: str                           # short display form for prompt context + back-compat
```

`FactBook.to_raw_context()` keeps emitting the existing `[source: X, fact_id: N] text` prompt format — **Claude's interface is unchanged**. Provenance metadata surfaces only on the `source_cited` SSE event.

### 4.2 `build_context_blob` refactor — per-field facts

This is the largest lift in the spec. Today each section of intelligence data produces **one bundled fact**:

```python
# Today — bundled: mixes RAW and SCORED fields in one fact.text
fact = fb.add(
    "catalyst",
    "Status: Watchlist · since 2026-04-01 · score 61 (was 68, delta -7) "
    "· last exec touch 45d ago · notes: …",
    timestamp=health.get("status_since"),
)
```

This breaks the Section 3 data contract: `field` and `value_display` are required on RAW/SCORED entries, but the bundled text has neither a single field name nor a single value.

The refactor: **every field that could be cited gets its own `Fact`.** Catalyst relationship health emits ~4 facts instead of 1. Brief citation count rises from ~12 to ~25-30 per brief.

```python
# After — per-field, per-provenance
fb.add(
    provenance="raw",
    source="catalyst", source_system="Catalyst",
    source_module="Relationship health",
    field="relationship_status",
    value_display=health["relationship_status"],
    text=f"Catalyst relationship_status: {health['relationship_status']}.",
    retrieved_at=_now_iso(),
    data_as_of=health.get("status_since"),
    time_ago=_time_ago(health.get("status_since")),
)
fb.add(
    provenance="raw",
    source="catalyst", source_system="Catalyst",
    source_module="Relationship health",
    field="last_executive_touch",
    value_display=health["last_executive_touch"],
    text=f"Catalyst last_executive_touch: {health['last_executive_touch']}.",
    retrieved_at=_now_iso(),
    data_as_of=health["last_executive_touch"],
    time_ago=_time_ago(health["last_executive_touch"]),
)
fb.add(
    provenance="scored",
    source="catalyst", source_system="Catalyst",
    source_module="Relationship health",
    field="relationship_score",
    value_display=f"{health['relationship_score']} / 100",
    text=f"Catalyst relationship_score: {health['relationship_score']} "
         f"(was {prior}, delta {delta:+d}).",
    retrieved_at=_now_iso(),
    data_as_of=health.get("score_date"),
    time_ago=_time_ago(health.get("score_date")),
)
```

### 4.3 Citation-density prompt tweak

Per-field facts mean more citable units per brief. Mitigate prose clutter with one rule added to `backend/skills/master.md`:

> Cite the most specific field once per claim. Don't restate a citation across sentences unless a second citation materially adds to the argument. A fact cited twice reuses its number (existing rule).

Prefer `[·7]` once over `[·7] ... [·7] ... [·7]` across a paragraph.

### 4.4 Provenance audit — tagging mapping

Final mapping after the Section-2 refinement (NetSuite AP flags flipped RAW):

| Source | Tool | Fields | Provenance |
|---|---|---|---|
| Salesforce | `get_account` | account_name, industry, segment, arr_cents, employees, hq_city, hq_state, stage, state, owner_name | **RAW** |
| Salesforce | `get_contract` | plan_name, contract_start, contract_end, auto_renew, seats_used, seats_licensed | **RAW** |
| Salesforce | `get_contacts[]` | name, title, role, tenure_months | **RAW** |
| Salesforce | `get_open_opportunities[]` | opp_name, stage, close_date, amount, forecast_category | **RAW** (forecast_category is rep-typed judgment, still RAW) |
| Salesforce | `get_recent_closed_opportunities[]` | same as above | **RAW** |
| Salesforce | `get_account_hierarchy` | parent, subsidiaries | **RAW** |
| Snowflake | `get_usage_metrics` | sends_30d, mau, api_calls, etc. | **RAW** (counts) |
| Snowflake | `get_portfolio_comparison` | peer_median, percentile | **SCORED** (comparison math) |
| Catalyst | `get_relationship_health` | relationship_status, last_executive_touch | **RAW** |
| Catalyst | `get_relationship_health` | relationship_score, score_delta, score_prior | **SCORED** (model output) |
| Catalyst | `get_renewal_forecast` | renewal_forecast | **SCORED** |
| Catalyst | `get_expansion_readiness` | expansion_readiness | **SCORED** |
| NetSuite | `get_billing_status` | past_due_balance, days_overdue, current_balance | **RAW** |
| NetSuite | `get_ap_policy_flags[]` | flag_name, flag_reason | **RAW** (deterministic rule-based, not model output) |
| NetSuite | `get_recent_invoices[]` | invoice_id, amount, status, due_date | **RAW** |
| Gong | `get_recent_calls[]` | call_title, date, attendees, duration | **RAW** |
| Gong | `get_competitor_mentions[]` | competitor_name, excerpt | **RAW** |
| Gong | `get_competitor_mentions[]` | sentiment | **SCORED** (NLP classifier) |
| Gong | `get_pricing_signals[]` | signal_text, direction | **SCORED** (NLP) |
| Exa | `search_account_signals[]` | snippet, url, published_at, title | **SURFACED** |
| Exa | `get_decision_maker_signals[]` | snippet, url, published_at, author | **SURFACED** |

**A single MCP-tool response can produce facts of multiple provenance types** — e.g., `get_competitor_mentions` produces a RAW `competitor_excerpt` fact and a SCORED `sentiment` fact from the same record. The per-field split in §4.2 handles this; do not tag at object granularity.

### 4.5 Updated `source_cited` SSE event

```json
{
  "citation_number": 7,
  "source": "catalyst",
  "source_system": "Catalyst",
  "source_module": "Relationship health",
  "provenance": "scored",
  "field": "relationship_score",
  "value_display": "61 / 100",
  "retrieved_at": "2026-04-24T14:30:00Z",
  "data_as_of": "2026-04-22T00:00:00Z",
  "time_ago": "pulled 14m ago",
  "url": null,
  "fact": "Catalyst relationship_score: 61 (was 68, delta -7).",
  "evid": "Catalyst relationship_score: 61 (was 68, delta -7)."
}
```

`source`, `fact`, `evid` are the back-compat fields; remove in the final migration pass.

## 5. References block UI

Component: `components/brief/references-section.tsx`. Replace the minimal current renderer with the approved layout. Full mockup lives in the brainstorming companion at `.superpowers/brainstorm/.../references-section.html` (Variant A — trailing tag chip).

### 5.1 Entry anatomy

Three-row grid per entry, 28px leading column for `·N`:

```
·N   [source dot] SourceSystem · Source module
     field = value_display      ← OR italic-serif snippet for SURFACED
     secondary-timing · primary-timing                         [tag chip]
```

Spacing, colors, and the 2px `brief-section` rule above the References header come from the mockup — not repeated here.

### 5.2 Tag chip styling

`[RAW]`, `[SCORED]`, `[SURFACED]` rendered as a small uppercase bordered chip at the right end of the footer row.

- **RAW** — `color: --color-ink-4` (de-emphasized — the baseline, not the signal)
- **SCORED** — `color: --color-warn-strong` (warmer amber; draws the eye)
- **SURFACED** — `color: --color-source-exa` (distinct from scored; matches Exa brand token)

Transparent fill, 1px `currentColor` border, 999px border-radius, 9.5px font. Scales the same in light and dark theme (colors from design tokens, not hardcoded).

### 5.3 Interaction

| Action | Effect |
|---|---|
| Hover on `·N` chip in prose | `<CitationTooltip>` renders mini-preview of the reference (existing behavior, data gets richer) |
| Click `·N` chip in prose | Smooth-scroll to `#references-section`; target entry briefly highlighted with `--color-accent` background + inset left rule (existing behavior; visual treatment locked in mockup) |
| Click anywhere on an entry row | Opens `<ReferenceModal>` with full citation detail |
| Click "View original" in `ReferenceModal` (SURFACED with `url` only) | Opens `url` in new tab with `target="_blank" rel="noopener noreferrer"` |
| `↗` indicator on SURFACED footer row | Visual-only affordance signaling external content. Not a separate click target. If `url` is null, `↗` is hidden. |

The click-target is the entire row (consistent across all provenance types). The external-link action is surfaced inside the modal, not bifurcated onto the row.

### 5.4 Empty state

If the brief has zero citations (shouldn't happen in live mode, possible in a partial mock fixture), render `null` — no empty "References" heading. The section literally doesn't exist when there's nothing to reference.

## 6. Prose typography — inference voice (V1)

Component: `components/brief/prose.tsx` (and/or `brief-section.tsx` where paragraphs render). Apply Treatment 2 from the brainstorming mockup — **gutter mark only, no color change.**

### 6.1 Detector

At render time, for each rendered paragraph, test against a hedge-marker regex. V1 markers (must match at a word boundary to avoid mid-word hits):

```
\b(likely|probably|seems|appears|suggests?|my read|this read|
   reads less like|reads more like|looks like)\b
```

Match is case-insensitive. A paragraph containing any match gets `className="inference"`. Detection is paragraph-level, not phrase-level.

Known V1 false-positive class: adjective use of `likely` ("a likely buyer"). Accepted limitation; V2 (`specs/10_INFERENCE_SPANS_V2.md`) removes this class.

### 6.2 Visual treatment

```css
/* applied to .inference paragraphs inside a brief */
.inference {
  position: relative;
  padding-left: 14px;
  border-left: 2px solid var(--color-warn-strong);
}
```

- No color change on the body text itself — prose stays full-contrast readable
- Inline citation chips render normally inside an inference paragraph
- 14px left padding compensates for the border so body text alignment stays consistent with fact paragraphs

### 6.3 Accessibility

Add `aria-label="Inferential passage"` to the paragraph element when `.inference` applies. Screen readers announce the voice shift; visual users read the gutter. Cheap to do right now even though a11y is demoted overall.

### 6.4 Granularity note

V1 starts at **paragraph-level** — simpler and matches how briefs tend to be written (one voice per paragraph). If V2 ships and wraps sentences with `⟨inf⟩` markers, granularity drops to sentence-level automatically via the marker detector. No frontend refactor needed for the granularity shift; the rendering hook (`<p className="inference">` vs `<span className="inference">`) is the only difference.

## 7. Drop the coarse confidence labels

### 7.1 Per-section `HedgePill` — full removal

| File | Change |
|---|---|
| `components/brief/hedge-pill.tsx` | delete file |
| `components/brief/brief-section.tsx` | remove import; remove `<HedgePill>` render in the section header |
| `lib/types.ts` (wherever `BriefSection` is defined) | remove the `hedge: { level, label, tip }` sub-object |
| `lib/fixtures/*` | remove `hedge` blocks from every fixture brief |
| `backend/agent.py` + `backend/skills/master.md` | stop emitting `hedge.level`/`hedge.label` in the streaming brief |

### 7.2 Top `ConfidenceStrip` — partial trim

Component: `components/confidence-strip.tsx`. Drop **only** the `· {confidenceLabel}` segment; keep the numeric.

Before: `"84 · likely"`
After: `"84"`, with the existing "BRIEF CONFIDENCE" caption above the number preserved (verify in the component). If the caption has since been removed, add a small inline qualifier `"brief confidence 84"` — just enough to orient. Do **not** reintroduce a fuzzy English label.

Same commit as the HedgePill removal. Applies the same rule consistently across positions.

## 8. Component inventory (what changes, what stays)

| Component / file | Change | Notes |
|---|---|---|
| `components/brief/references-section.tsx` | **Rewrite** | New entry shape per §5 |
| `components/brief/reference-modal.tsx` | **Update** | Add "View original" button for SURFACED with `url`; enrich detail display |
| `components/brief/citation-tooltip.tsx` | **Update** | Mini-preview uses new `CitationMeta` fields |
| `components/brief/prose.tsx` | **Update** | V1 inference detector + `.inference` className application |
| `components/brief/hedge-pill.tsx` | **Delete** | |
| `components/brief/brief-section.tsx` | **Update** | Remove HedgePill import/render |
| `components/brief/brief.tsx` | **Update** | Pass new-shape citations through; wire URL to modal |
| `components/confidence-strip.tsx` | **Update** | Drop `· {label}` segment |
| `components/brief/citation-chip.tsx` | Unchanged | Chip itself doesn't need to know provenance |
| `lib/types.ts` | **Update** | `CitationMeta` discriminated union; drop `BriefSection.hedge` |
| `lib/sse.ts` | **Update** | Parse new `source_cited` fields into `CitationMeta` |
| `lib/fixtures/*` | **Update** | Rebuild fixtures against new union; remove hedge blocks |
| `backend/agent.py` | **Refactor** | `build_context_blob` per-field; `Fact` extension; `source_cited` emission |
| `backend/skills/master.md` | **Update** | Per-field citation rule (§4.3); no voice changes for V1 |
| `backend/intelligence.py` | Light touch | May need helper functions to split bundled source data into per-field units (depends on existing shape) |

## 9. Migration sequence

The `source` + `label` back-compat fields stay on the wire while call-sites migrate. Four-step cutover:

1. **Backend dual-emit.** `source_cited` event carries the new discriminated-union fields *and* the legacy `source` + `fact` + `evid` + `label` fields. Old frontend unchanged; new frontend can consume either shape.

2. **Frontend migration by component.** `ReferencesSection` → `CitationTooltip` → `ReferenceModal` → fixtures, one at a time. Each PR: migrate one component, land, verify. No single big-bang rename.

3. **Prose-typography + HedgePill removal.** Ship in one commit with the confidence-strip trim (§7). Small diff across several files; easy to review as a unit.

4. **Backend legacy-field removal.** After all frontend call-sites consume the new shape, drop `source`/`fact`/`label` from the SSE payload. Tighten `CitationMeta` to the discriminated union (no back-compat optionals).

Each step is independently shippable. Rollback = revert the one step that broke something.

## 10. Acceptance criteria

**Data model:**
- `CitationMeta` is a discriminated union, compiles without `any`/`unknown` escape hatches
- All six MCP-tool response categories tagged per §4.4
- Zero `hedge: {...}` references remaining in `BriefSection` type or fixtures

**References block:**
- Mockup Variant A rendered pixel-matched in dark and light theme
- Tag chip colored per §5.2; RAW visibly de-emphasized vs SCORED
- Click `·N` in prose → scroll to references, target entry highlighted, highlight fades after ~1.5s
- Click row → modal opens; modal's "View original" button on SURFACED entries with `url` opens new tab with noopener/noreferrer
- 0-citation brief renders no References section at all

**Prose typography:**
- V1 detector flags the example paragraph from the mockup correctly
- Adjective-use false positive ("a likely buyer") documented as known limitation in the prose.tsx file comment
- `aria-label="Inferential passage"` present on `.inference` elements
- No visual regression on fact-restatement paragraphs (full-contrast body text unchanged)

**Confidence labels:**
- `HedgePill` component file deleted; zero imports remain
- Top `ConfidenceStrip` renders `"84"` not `"84 · likely"`
- Caption still contextualizes the number ("BRIEF CONFIDENCE" header visible, or fallback qualifier applied)

**Backend:**
- Brief citation count lands in the 25-35 range per brief after the refactor (up from ~12). Manual sanity check on Northstar Beauty and two other representative accounts.
- `source_cited` event payload validated against the schema in §4.5 (one golden-path smoke test per provenance type)
- Prompt update in `master.md` live; manual review of three newly-generated briefs confirms no citation restatement within a paragraph unless justified

## 11. Non-goals

This spec does **not** cover:

- **Structured inference spans (`⟨inf⟩…⟨/inf⟩` markers)** — parked in `specs/10_INFERENCE_SPANS_V2.md`. V1 ships with regex detection; V2 promotes when evidence warrants.
- **Rep-facing "this looks wrong" feedback affordance** on misclassified sentences. Useful for V2 evidence-gathering; not V1 work.
- **Deep-link URLs on RAW/SCORED entries.** Field typed only on SURFACED for now; additive change when we decide to implement.
- **Confidence scoring on scored metrics.** Neither Catalyst nor Gong exposes a confidence value today. If they do in the future, add a field then.
- **Theming the gutter-mark color.** V1 uses `--color-warn-strong` (warm amber). If future user testing suggests a different color carries the "inference" connotation more cleanly, tweak the token — not a spec-level decision.
- **`ConfidenceStrip` redesign beyond dropping the `· label` segment.** Everything else in that strip (sources queried, stale count, generated-ago, regenerate) stays exactly as is.

## 12. Open questions (for implementation)

None blocking. Flagged for the implementer's judgment:

- **Per-field fact timestamp granularity on bundled source data.** If a NetSuite `get_billing_status` response returns `past_due_balance` and `days_overdue` together with one "as of" timestamp, both per-field facts share that timestamp. If the response provides per-field `as_of`, use it. Existing response shapes should be checked during implementation.
- **Truncation of long snippets.** `SURFACED` snippets from Exa can be 200+ chars. Entry display should truncate at ~140 chars with ellipsis; full text lives in the modal. Pick the truncation function and stick with it across all SURFACED renders (entry, tooltip, modal-header).
- **Mock fixtures for the full new shape.** Only one reference account (`ns-beauty`) has a hand-built fixture today. Migrating fixtures is straightforward mechanical work; decide during implementation whether to migrate only ns-beauty now or all accounts.

---

**Implementation plan — out of scope for this spec.** Will be produced via the `writing-plans` skill in the next step.

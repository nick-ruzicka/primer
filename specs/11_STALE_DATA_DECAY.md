# Stale-data tag decay — parked design note

**Status:** Parked. Considered-not-implemented.
**Related:** `docs/superpowers/specs/2026-04-24-references-block-design.md` (ships RAW/SCORED/SURFACED tags without staleness decay) and the per-field provenance-explainers feature that ships freshness context on hover.
**Purpose of this file:** Document a considered-not-implemented design so a future implementer doesn't have to re-derive it. Promote only when the decision trigger in §3 fires.

---

## 1. What

Visual decay on the provenance tag chip in the References block when `data_as_of` exceeds a source-specific threshold. A `RAW` citation from 6 months ago renders with a muted/desaturated chip; a `RAW` from 3 hours ago renders with full color. Answers "should I trust this number right now?" at the scan layer, without requiring a hover.

Proposed thresholds (first-pass, tune from rep feedback):

| Source | Threshold for `stale` | Rationale |
|---|---|---|
| Snowflake usage metrics | 24 hours | Rebuilt nightly; anything > 24h is suspect |
| NetSuite ledger | 24 hours | Near real-time in the ledger |
| Salesforce CRM fields | 14 days | Human-edited; decays slowly but gets stale after ~2 weeks |
| Catalyst scores / status | 7 days | Scores recompute on a weekly cadence |
| Gong call data | n/a | Dated content; relative time already carries the meaning |
| Exa SURFACED | 30 days | Web content, moderate decay |

Render: swap the tag chip's color to a desaturated version + optionally append `· stale` as a suffix in the tag label.

## 2. Why parked

- `time_ago` is already visible on every reference entry. Explicit staleness decay would amplify a signal that's already present, at the cost of new visual state to learn.
- Per-field provenance explainers (shipped in variant A) cover freshness context on hover for reps who want to dig into a specific citation.
- Tuning thresholds is subjective per account. A 15-day-old Salesforce field is fine for one account and critical for another. A fixed threshold table will produce false alarms.
- "Stale" as a label may be misread as "wrong" when it actually means "from last week."

## 3. Decision trigger — when to promote

Promote if **any** of:

- **Rep feedback:** two or more reports of "I cited a stale number on a call because the brief didn't flag it." One qualitative incident from a customer-facing rep is enough.
- **Demo incident:** a customer demo where stale data undercut the brief's credibility and the rep would have caught it had staleness been visible at scan layer.
- **Measured hover pattern:** once hover-telemetry ships (future), if reps frequently hover provenance tags on old entries, that signals they're checking freshness manually — a scan-layer cue would be cheaper.

## 4. Infrastructure already in place

- `retrieved_at` (ISO) and `data_as_of` (ISO, optional) are emitted on every `source_cited` event and carried through `CitationMeta`.
- `time_ago` is pre-computed by the backend against `ANCHOR_DATE` for demo mode.
- Frontend can compute staleness client-side by comparing `data_as_of` (or `retrieved_at` as fallback) against `new Date()` — no backend change required.

## 5. Estimated work if promoted

~1 day:

- Threshold table (~6 entries) in `lib/staleness-thresholds.ts`.
- Helper `isStale(citation: CitationMeta): boolean` that checks `data_as_of` against the threshold for `source_system`.
- CSS class `.tag-stale` that desaturates the chip (e.g., `opacity-60` + `grayscale(0.3)`).
- Wire into `ReferencesSection` tag rendering and `CitationTooltip`.
- Copy decision: append `· stale` to the tag label, or rely on visual decay alone. Editor pass.

## 6. Out of scope

- Per-account threshold overrides (some accounts tolerate staler data than others). Tune the universal table first; account-level overrides become meaningful only if the fixed table is demonstrably wrong.
- Auto-refresh of stale data. Orthogonal concern.

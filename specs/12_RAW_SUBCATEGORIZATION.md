# RAW provenance subcategorization — parked design note

**Status:** Parked. Considered-not-implemented.
**Related:** `docs/superpowers/specs/2026-04-24-references-block-design.md` (ships three-tier RAW/SCORED/SURFACED) and the per-field provenance-explainers feature (variant A) that addresses the RAW overload on the hover layer.
**Purpose of this file:** Document a considered-not-implemented design so a future implementer doesn't have to re-derive it. Promote only when the decision trigger in §3 fires.

---

## 1. What

Split the `RAW` provenance tier into two:

- **LEDGER** — deterministic system-of-record values with no human judgment in the loop. NetSuite AR balances, Snowflake event counts, Salesforce contract start/end dates.
- **SELF-REPORTED** — human-entered judgment fields in source systems. Salesforce `forecast_category` (the rep's call), Catalyst `relationship_status` (the CSM's label), Salesforce `notes`, `opp.stage`.

SCORED and SURFACED stay unchanged.

Resulting four-tier scan order: **LEDGER / SELF-REPORTED / SCORED / SURFACED.**

At the chip level this answers "is this a recorded number, or someone's opinion we happened to capture?" — a distinction that currently lives inside the `RAW` bucket.

## 2. Why parked

- Variant (A) per-field explainers ship first and address the RAW overload at the hover layer. Reps who want to know whether a value is a ledger read or a rep-typed judgment can read the explainer. No fourth tier is needed if the hover surfaces the information.
- Three tiers is scannable. Four tiers starts to tax visual parsing at the chip level, especially in a brief with 25+ citations.
- The LEDGER / SELF-REPORTED cut is contentious at the boundary. Is Salesforce `contract_end` LEDGER (it reflects a signed document) or SELF-REPORTED (a human typed the date into the CRM)? Arguing the boundary for each of ~20 RAW fields is expensive.
- Adds a fourth color to the theme palette, a fourth chip style to render consistently across tooltip, entry, and modal, and a fourth explainer variant.

## 3. Decision trigger — when to promote

Promote if, after ~4 weeks of variant (A) shipping:

- **Rep feedback:** reps still report conflating ledger values with rep-typed judgments. If the hover explainer is working, this should stop within the first week of real use.
- **Usage telemetry (when available):** if hover rate on `RAW` citations is low (< 20% of citation clicks), the explainer isn't being read and the distinction needs to move to the chip level.
- **Demo incident:** a customer demo where a rep cited a `forecast_category` as if it were a ledger value and got called out. One incident is enough.

If none of the above materializes, variant (A) is sufficient and this stays parked indefinitely.

## 4. Migration plan if promoted

- Audit the ~20 RAW fields in `backend/agent.py::build_context_blob` and assign `ledger` or `self_reported` per field. Fields like NetSuite AR balances, Snowflake counts, Salesforce contract dates → LEDGER. Fields like Salesforce `forecast_category`, `stage`, `notes`, Catalyst `relationship_status` → SELF-REPORTED.
- Update `backend.agent.Fact.provenance` literal type: `"ledger" | "self_reported" | "scored" | "surfaced"`.
- Update FactBook.add call sites across Tasks 5–10's refactored blocks.
- Update `source_cited` SSE event shape (existing consumers branch on provenance — add the two new values).
- Update `frontend/lib/types.ts` `CitationMeta` discriminated union: split the `"raw" | "scored"` branch into `"ledger" | "self_reported" | "scored"`, or add a new variant and drop `"raw"`.
- Update `ReferencesSection`, `CitationTooltip`, `ReferenceModal` to render four tag styles. Pick a fourth theme color (likely a neutral for LEDGER and a warmer beige for SELF-REPORTED, or vice versa — editor call).
- Update `lib/provenance-explainers.ts`: the table keys stay `SourceSystem.field` so specific explainers don't need to move, but the `BY_SOURCE` and `FALLBACK` defaults split along the new lines.
- Migrate fixtures (`northstar-beauty-brief.ts`, `kindred-pet-brief.ts`, any others) to the new union.
- Update spec `docs/superpowers/specs/2026-04-24-references-block-design.md` §4.4 audit table with the two-way split.

Estimated work: **~2 days** of coordinated backend + frontend + fixture changes. The per-field assignment audit is the bulk of it.

## 5. What V1 doesn't pre-bake

No frontend-only toggle to experiment with this split. The tier change affects the backend emission shape and the frontend type union, so promotion requires a coordinated release. The parked doc exists to avoid re-deriving the audit boundary from scratch when the decision trigger fires.

## 6. Out of scope

- Reverting variant (A) explainers after this ships. The per-field explainers remain valuable even with a fourth tier — they still carry the "what is this" information that the tier alone can't convey.
- Further subdivision (e.g., splitting SCORED into "model output" vs "derived statistic"). If the four-tier version ships and reps still conflate categories inside SCORED, open a new parked doc at that point.

# Inference spans V2 — parked design note

**Status:** Parked. Considered-not-implemented.
**Related:** `docs/superpowers/specs/2026-04-24-references-block-design.md` (ships V1)
**Purpose of this file:** Document a considered-not-implemented design so a future implementer doesn't have to re-derive it. Promote V2 when (and only when) the decision trigger in §6 fires.

---

## 1. Why this is parked, not deleted

V1 of inference-voice typography (see main spec §6) ships hedge-phrase regex detection at paragraph granularity. It relies on the prompt enforcing hedge markers like "likely", "this suggests", "my read". Known V1 limitations:

- **False positives:** adjective use of hedge words ("a likely buyer") styled as inference
- **False negatives:** un-hedged inferences Claude occasionally emits without any marker slip through entirely
- **Granularity ceiling:** paragraph-level; can't mark one inferential sentence inside a mostly-factual paragraph

V1 is good enough to ship and learn from. V2 fixes those limitations by moving detection to the backend, where Claude's output can be structurally tagged rather than heuristically re-parsed. V2 is more rigorous but requires coordinated change across prompt, SSE stream, and frontend, so the cost is higher — not worth paying until V1's limitations are measurably costing us.

## 2. Architectural shift

V1: frontend regex on rendered markdown.
V2: backend wraps inferential passages with sentinel markers; frontend parses markers as a separate layer of the existing `brief_chunk` stream.

Inline markers, not a separate SSE event. One ordered stream is simpler than two coordinated streams that have to agree on offsets when chunks split mid-sentence.

## 3. SSE event shape

No new event type. The existing `brief_chunk` event gains sentinel characters around inferential passages:

```
brief_chunk.delta: "Past-due AR is $18,500. ⟨inf⟩This reads less
like a normal Q2 renewal prep and more like a churn risk.⟨/inf⟩"
```

The frontend renderer parses `⟨inf⟩…⟨/inf⟩` spans alongside `·N` citation markers. Inference styling (Treatment 2 from V1 — 2px warm-amber left gutter) applies to the wrapped text at sentence or span granularity — finer than V1's paragraph-level.

### 3.1 Marker choice rationale

Markers are `U+27E8` and `U+27E9` (mathematical angle brackets — `⟨` and `⟩`). Chosen over HTML-like `<inf>…</inf>` for four reasons:

- **Chunk-boundary safe.** Single codepoints each. An unfortunate SSE chunk split on byte 17 can't break a 2-codepoint marker the way it could split `<inf>` into `<in` and `f>`.
- **Collision-resistant.** Real angle brackets (`<`, `>`) appear in natural prose (`"CPM < $0.50"`, inequality notation, `<Vendor>` placeholders). Mathematical brackets effectively never do.
- **Layer-separation.** Distinct from citation markers (`·N`) and markdown syntax so the parser treats them as an independent rendering layer without regex acrobatics.
- **Terminal-safe fallback.** If markers leak into a text-only export (logs, copied text, exports), they render as readable bracket characters, not gibberish or mojibake.

## 4. Prompt change in `backend/skills/master.md`

Add one rule to the voice section. **Don't remove the existing hedge-phrase rules** — those still shape voice. Markers are a machine-readable overlay, not a replacement.

> When you write a sentence in hedged voice (starting with "this suggests", "likely", "my read is", "reads less like", etc.), wrap the sentence with `⟨inf⟩` and `⟨/inf⟩` markers. Wrap only the inferential sentence, not the surrounding paragraph. Citations (`·N`) and bold markers work as usual inside the span.

## 5. Migration plan — V1/V2 coexistence

Frontend detector becomes a preference chain:

```
if brief text contains ⟨inf⟩ markers → use marker-based detection (V2)
else                                   → fall back to regex (V1)
```

Behavior by brief type:

- **Live briefs generated after V2 ships:** detected via markers
- **Cached live briefs from before V2:** fall back to regex (still works correctly)
- **Mock/fixture briefs:** stay on regex forever unless hand-annotated — acceptable, mocks are demo data

Rollback = delete the marker-detection branch and V1 regex resumes for everything. One-line revert, no schema rollback.

## 6. Decision trigger — when to promote V2

V1 ships with the measurement infrastructure in §7 already in place. Promote to V2 if **any** of:

- **False-negative rate > 10% across 50+ briefs, measured twice at least a week apart.** The week gap catches drift vs. one bad day. 50+ briefs is the minimum for the rate to be statistically meaningful; `~10% across ~20 briefs` is only 2 misses and could be noise.
- **False-positive rate > 5% (sentences styled as inference that are actually fact-restatement with a hedge-word appearing in a non-modal position).** False positives are more user-visible than false negatives — they visually mislabel a sentence the rep is reading *right now* — so the threshold is tighter.
- **Single rep-feedback incident where a misclassification undercut trust in a customer demo.** One-shot qualitative override. Not a metric; a judgment call from the incident review.

If none fire within 4 weeks of V1 shipping, V1 is good enough and V2 stays parked.

## 7. V1 instrumentation requirements

For V2 promotion to be evidence-based, V1 must emit the data a human reviewer can score against. V1 must log:

- **Per brief:** total sentence count, sentence count tagged as inference, which hedge marker matched each tagged sentence.
- **Cache the last 50 briefs' detector output** for periodic manual review — the ground truth for FP/FN calculation.
- **(Optional, future)** a rep-facing "this looks wrong" affordance on styled sentences. Useful signal if implemented; not required for V1 ship.

Log destination: structured JSON to `logs/inference-detector.log`, same JSONL format as `logs/uvicorn.log`.

Sampling script: `scripts/review_inference_tags.py` — pulls the cached briefs, dumps a side-by-side of "Claude wrote" vs "detector flagged" for a reviewer to hand-score.

Without this infrastructure, "ship V1 and measure" is aspirational. With it, measurement starts on day one.

## 8. Estimated V2 work

**~1 day** of coordinated effort:

- Prompt update in `master.md` — 30 min
- Frontend parser update (marker recognition, render at sentence granularity) — ~4 hours
- V1/V2 preference chain (§5) and migration flag — 1 hour
- Golden-path re-test across mock + live flows — 2 hours

Not technically hard. The reason V2 stays parked isn't difficulty — it's that the coordination cost (prompt + stream + frontend changing together) only pays off once the evidence warrants.

## 9. What V2 does *not* change

- **V1 prose styling is reused.** Same 2px warm-amber left gutter, same `aria-label="Inferential passage"`. Only the detection mechanism changes.
- **Section-level confidence pills stay dropped.** The main spec's decision to delete `HedgePill` is independent of V1 vs V2 detection.
- **Reference-block provenance (RAW/SCORED/SURFACED).** Unrelated to inference detection. Ships in V1 main spec, unchanged by V2.
- **Existing citation system.** V2 doesn't touch `source_cited` events, `·N` chips, or reference-block rendering.

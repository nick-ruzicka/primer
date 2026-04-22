# 04 — Agent Spec

Two Claude calls per briefing: the briefing agent (generates the prose) and the validation agent (checks for contradictions). Both use the Anthropic SDK directly.

## The briefing agent

**Model:** `claude-opus-4-7`
**Max tokens:** 2000 (briefs are ~600-1000 tokens of output)
**Streaming:** yes
**Tool use:** yes (the six MCP tools, re-exposed to Claude as tool definitions)

### System prompt

Location: `backend/prompts/briefing.md`

Full prompt:

```
You are the briefing engine inside Primer, Attentive's pre-call account briefing product. Your job is to write a pre-call briefing for an Account Executive who has a customer call coming up.

A briefing is four sections:

1. THE READ — 2-4 sentences stating what this call is actually about. The opinionated thesis. What the rep needs to know if they have 30 seconds to prepare.
2. WHY THIS READ — 2-4 short paragraphs walking through the signals that support the read. Every factual claim is cited with an inline source chip: ·N where N increments across the brief.
3. WHAT TO DO ON THE CALL — 3-5 numbered actions. Each action is a single crisp line with a one-sentence italicized rationale underneath.
4. SUGGESTED TALK TRACK — 4-5 numbered questions the rep can lead with. Conversational, not interrogative.

## Writing principles

- Take a position. Don't summarize, argue. The brief exists because a dashboard isn't opinionated enough.
- Write prose. Not bullets, not dashboards, not tables. Full sentences that read like a thoughtful colleague wrote them.
- Distinguish facts from inferences. Facts come from source systems and carry inline source chips (·N). Inferences are hedged: "this suggests," "this reads less like X and more like Y," "likely."
- Every factual claim is cited. Not optional. If you can't cite it, don't claim it. If data is missing, say so explicitly — don't infer.
- Use confidence hedges in section headers: "— very likely," "— likely," "— agent recommendation," "— draft."
- Short sentences. Active voice. No corporate language.
- Bold the 2-3 highest-signal phrases per paragraph. Not more.

## Output format

Output as markdown with this structure:

## 01 · The read — {confidence hedge}

{prose with inline ·N citations and **bolded key phrases**}

## 02 · Why this read — {confidence hedge}

{prose}

{prose}

## 03 · What to do on the call — agent recommendation

1. **{action}**
   _{italicized rationale}_

2. **{action}**
   _{italicized rationale}_

## 04 · Suggested talk track — draft

1. {question}
2. {question}
...

## Citation numbering

The caller gives you a context blob with all the data. You will see entries like:

[source: catalyst, fact_id: 4] Relationship status changed from Healthy to Watchlist on 2026-03-28.

When you reference this fact in the brief, write it as: "Catalyst moved Beauty to Watchlist on Mar 28 ·4". The citation number maps to the fact_id.

Citations must increment monotonically through the brief (start at ·1 at the top, increase as you add new facts). A fact cited twice reuses the same number.

## Forbidden

- Don't write a summary. This is a briefing, not a recap.
- Don't list every fact. Use the ones that matter for the call, skip the rest.
- Don't use confidence percentages ("82% confidence"). Use voice hedges.
- Don't invent facts. If a claim doesn't appear in the context blob with a fact_id, don't make it.
- Don't output anything other than the four-section markdown. No preamble, no "Here's your briefing," no sign-off.
```

### Context blob format

The orchestrator builds a structured context blob before calling the agent. Shape:

```
# ACCOUNT CONTEXT FOR BRIEFING

## Account
[source: salesforce, fact_id: 1] Northstar Beauty. Parent: Northstar Group. $940K ARR. 78 employees. Brooklyn, NY.

## Contract
[source: salesforce, fact_id: 2] Plan: Flows Pro + Journeys. Contract ends 2026-09-12. Auto-renew on.

## Decision maker
[source: salesforce, fact_id: 3] Priya Shah, VP Marketing. 2 years 4 months tenure.

## Relationship health
[source: catalyst, fact_id: 4] Status: Watchlist (changed from Healthy on 2026-03-28).
[source: catalyst, fact_id: 5] Relationship score: 61 (down from 74).

## ... continues for all data
```

The orchestrator assigns fact_ids sequentially and the agent uses them as citation numbers. This guarantees citation integrity — the agent can't cite a non-existent fact.

### Tool use

Expose the MCP tools to Claude as tool definitions. The agent rarely needs follow-up tool calls because pre-fetch covers most cases, but enable them for completeness. If the agent does make a tool call, log it — those are signals that our pre-fetch missed something important.

## The validation agent

**Model:** `claude-haiku-4-5-20251001` (fast, cheap, sufficient)
**Max tokens:** 800
**Streaming:** no (batch response)
**Tool use:** no

### System prompt

Location: `backend/prompts/validation.md`

```
You are the validation agent inside Primer. Your job is to read a generated briefing and the raw source data it was built from, and flag contradictions or unsupported claims.

You do not rewrite the briefing. You emit warnings.

## What to flag

1. SOURCE CONTRADICTION — the brief states X, but two or more source systems disagree about X. Example: brief says "renewal forecast is Commit" but Catalyst shows forecast is Best Case.

2. UNSUPPORTED CLAIM — the brief states a fact with a citation number (·N), but fact_id N in the context doesn't support that claim.

3. STALE DATA — the brief references data where the source timestamp is older than the freshness threshold (30 days for usage, 90 days for relationship events).

4. MISSING GROUND — the brief makes a factual claim without any citation. (Inferences hedged with "this suggests" are fine. Unhedged factual claims without ·N are not.)

## Output format

Strict JSON, list of warnings:

[
  {
    "severity": "watch" | "critical",
    "type": "source_contradiction" | "unsupported_claim" | "stale_data" | "missing_ground",
    "message": "One-sentence plain-English description of the issue",
    "brief_excerpt": "The exact phrase from the brief that triggered the warning",
    "sources": ["salesforce", "catalyst"]
  }
]

If no warnings, return [].
```

### Severity rules

- `critical` — the brief will embarrass the rep if they cite this (hallucinated numbers, wrong names, wrong dates)
- `watch` — the brief contains a judgment call the rep should verify (source-of-truth disagreements, stale data)

## Testing the agent

Manual test cases in `backend/tests/`:

1. **Northstar Beauty** — should produce the trust-repair brief we've been designing. Validation should flag the Salesforce-Commit vs. Catalyst-Best-Case contradiction.
2. **Ember Coffee** — should produce a "nothing to see here, easy renewal" brief. Validation should return [].
3. **Kindred Pet Supply** — should produce a DM-change-plus-adoption-collapse brief distinct from Beauty's billing story.
4. **Tidepool Swim** — should produce a discovery/new-business brief with no renewal framing.

Run these three and visually QA the output. If any read like a dashboard summary instead of an opinionated brief, the system prompt needs tightening.

## Rate of improvement

Expect the first few brief generations to be underwhelming. The prompt will need iteration. Check the "unsupported claim" warnings carefully in the early runs — they often reveal that the agent is inventing numbers rather than citing them.

If a brief reads too generic:
- Tighten the "take a position" language in the system prompt
- Add negative examples ("Don't write: 'The account is performing well overall.'")
- Reduce the context blob — sometimes too much data makes the agent hedge

If the agent fabricates citations:
- Add stronger constraint language about fact_ids
- Consider structured output with tool_use instead of markdown generation

Don't over-engineer the prompt before the first real run. Get it generating, then iterate on real output.

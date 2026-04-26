# Pre-call brief skill

This skill inherits from `skills/master.md`. All rules in the master skill apply. Rules below specialize for this artifact type.

## Description

A pre-call briefing for an Account Executive about to speak with a customer contact. The rep has 30 seconds to prep; every sentence must earn its place.

## Required data

The orchestrator pre-fetches this bundle from the six MCP servers before invoking this skill. You don't make additional tool calls — everything you need is in the context blob.

- **Salesforce:** account, contract, contacts, open opps, recent closed opps, account hierarchy.
- **Snowflake:** usage metrics, portfolio comparison.
- **Catalyst:** relationship health, renewal forecast, expansion readiness.
- **NetSuite:** billing status, AP policy flags, recent invoices.
- **Gong:** recent calls, competitor mentions, pricing signals.
- **Exa (web):** external signals, decision-maker signals.

## Voice

- **Take a position.** Argue, don't summarize. The brief exists because a dashboard isn't opinionated enough.
- **Write prose.** Full sentences that sound like a thoughtful colleague wrote them. Not bullets, not dashboards, not tables.
- **Short sentences. Active voice.** Cut anything a busy AE would skim past.
- **Bold the 2–3 highest-signal phrases per paragraph.** Not more. Bold means "look here first," not "emphasize everything."
- **Ruthlessly terse.** Target ~400–600 words total. If a paragraph runs over 4 sentences, cut it.
- **Surface the signals that matter; skip the rest.** Selection is this artifact's job. A pre-call brief doesn't enumerate every fact in the context blob — it picks the ones that change how the rep opens the call.

## Output structure

Output as markdown with exactly this five-section structure. Use the confidence hedges from master rule 5 at each section header.

```
## 01 · The read — {confidence hedge}

{2 sentences. The opinionated thesis: what this call is actually about. Inline ·N citations.}

## 02 · Why this read — {confidence hedge}

{2–3 short paragraphs, ≤4 sentences each. The signals that support the read. Every factual claim carries an inline ·N source chip.}

## 03 · What to do on the call — agent recommendation

1. **{action}**
   _{one italicized rationale sentence}_

2. **{action}**
   _{one italicized rationale sentence}_

3. **{action}**
   _{one italicized rationale sentence}_

## 04 · Discovery questions — agent recommendation

1. {question}
2. {question}
3. {question}
4. {optional fourth question}
5. {optional fifth question}

## 05 · Suggested talk track — draft

1. {question}
2. {question}
3. {question}
4. {optional fourth question}
```

Exactly **3 numbered actions** in section 03. **3–5 numbered questions** in section 04. **3–4 numbered questions** in section 05.

## Discovery questions (section 04) — rules

These are the questions the rep should ask on the call to validate or advance the read. Distinct from the talk track in section 05, which is the rep's opening language.

- **Tied to the read.** Each question helps the rep test or progress the hypothesis from section 01 (renewal, expansion, trust-repair, etc.). No generic best-practice questions.
- **Citation-bound when applicable.** When a question references a specific fact (a number, a name, a date, an event), cite the `fact_id` in the same `·N` format used elsewhere in the brief: *"What's the success criteria for the Identity pilot ·22?"*
- **Standalone questions allowed.** When no specific fact applies, omit the citation: *"Who else needs to be in the room for the close conversation?"*
- **Rep voice.** Direct, conversational, the kind of question a senior AE would actually ask on a call. Cut consulting hedges ("could you help me understand," "I'm curious about your thinking on"). Just the question.
- **Order matters.** Most important question first. The rep might not get to all five.
- **Pure questions.** No preamble, no observation framing ("I noticed you're hiring…"). That belongs in talk track. Discovery is the question itself.

## Talk track (section 05) — rules

- The rep's opening beats: openers, acknowledgments, observations that lead into a question. Different artifact from discovery. Some items will look like questions; the difference is the framing — talk track sets the stage, discovery probes for an answer.
- Same citation discipline as discovery (·N when a specific fact is referenced).

## Forbidden (pre-call brief specific)

- Don't write a summary. This is a briefing, not a recap.
- Don't output anything other than the five-section markdown.
- Don't use confidence percentages (already banned by master, restated here because this artifact is most tempting for them).
- Don't repeat a question across discovery and talk track; they serve different moments in the call.

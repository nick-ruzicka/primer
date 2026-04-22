# Skills

Primer's agent prompts live here in a two-layer structure.

## Layout

```
skills/
├── master.md                        # constitutional rules — every artifact inherits
├── artifact_types/
│   └── pre_call_brief.md            # the pre-call brief artifact skill
├── validation/
│   └── brief_validation.md          # validation checker for pre-call briefs
└── README.md                        # this file
```

## Why two layers

The spec calls for multiple artifact types over time: pre-call brief today, CSM renewal, QBR prep, portfolio review, drafted emails, renewal risk alerts. Without a constitutional layer, each artifact would restate the same foundational rules (how to cite, when to hedge, what "confidence" means, what actions are unsafe). Drift across those restatements becomes inevitable, and the validation agent can't measure against any single source of truth.

With master inheritance:

- One place to change citation syntax or add a new forbidden phrase.
- New artifacts start from a known-safe base and only write what's specific to them.
- Validation measures the brief against the master rules, not whatever each artifact happens to say.

## What lives where

**`master.md` — constitutional layer.** Rules every artifact must follow:

1. Synthesis, not summary (stance hint, specialized per artifact).
2. Citation discipline (grounding rule + `·N` marker format).
3. Context handling (context-blob structure, null semantics).
4. Voice hedging (facts don't hedge, inferences do).
5. Confidence expression (verbal hedges only, canonical phrases).
6. Source disagreements (surface them, don't smooth over).
7. Safety (no actions that contradict account state).
8. Universal output discipline (no preamble, no sign-off, no meta-commentary).
9. Forbidden patterns (corporate language, feature-dumping, em-dash abuse).

**`artifact_types/{name}.md` — artifact skill.** Specialization for each output type:

- Description: what the artifact is, when it's used.
- Required data: which MCP pre-fetch bundle is expected.
- Voice: artifact-specific posture (argue, draft, scan, recap, etc.).
- Output structure: exact markdown skeleton, section counts, length target.
- Artifact-specific forbidden patterns (additions to master rule 9).

**`validation/{name}.md` — validation skill.** A checker for a specific artifact type. It reads the master skill as *reference material* — the yardstick — and its own rules govern only how it emits warnings (structured JSON, severity gradations, flag types). The master's prose-style rules don't apply to a validation agent because it doesn't emit prose.

## How the orchestrator loads skills

`backend/agent.py` stitches the skills at request time:

**Briefing agent:**

```
<master.md>
---
<artifact_types/pre_call_brief.md>
```

The two files are concatenated, `{today}` is substituted to the `ANCHOR_DATE` setting, and the result is the system prompt. This concatenation is the inheritance mechanism — there's no template engine, no partial substitution.

**Validation agent:**

```
<validation/brief_validation.md>
---
# Reference — master skill rules
You are evaluating output generated under the following rules.
Flag any violations, but do not apply them to your own output.
---
<master.md>
```

The validation skill's own rules come first (they govern its behavior), then the master rules follow as reference material the agent uses to score the brief.

## Adding a new artifact type

Three steps:

1. **Write the skill.** Create `artifact_types/{name}.md`. First line: `"This skill inherits from skills/master.md. All rules in the master skill apply. Rules below specialize for this artifact type."` Then: description, required data, voice, output structure, artifact-specific forbidden patterns.

2. **Wire it in the agent.** In `backend/agent.py`, add a loader for the new skill (or factor the existing concat helper to accept an artifact-skill filename). If the artifact reuses the same MCP bundle as `pre_call_brief`, the existing `fetch_intelligence` fan-out can be reused as-is. Otherwise, define a new fan-out function.

3. **Add a route.** In `backend/main.py`, expose the new artifact as a new endpoint (e.g. `/qbr-prep/{account_id}`) or as a variant parameter on an existing one (e.g. `/briefing/{account_id}?type=qbr_prep`).

The first artifact (pre-call brief) is deliberately monolithic — one skill, one endpoint. The structure supports fan-out to many artifacts once the pattern proves out.

## Future extensions (not in V1)

The skill layer is designed so these can be added without rearchitecture:

- **Variant skills.** Within one artifact type, different account states route to different variants (`at_risk_renewal.md`, `healthy_renewal.md`, `prospect_discovery.md`). The orchestrator picks a variant based on the account's state signals before invoking the agent. The variant inherits from the artifact skill, which inherits from master.
- **Admin-editable UI.** Skills are plain markdown. A future admin dashboard would let a sales leader edit master rules or artifact skills without a deploy; the agent re-reads the files on next request.
- **A/B testing harness.** Two variants of the same artifact skill, A and B, routed randomly per request, measured by downstream rep satisfaction or call outcome.
- **Per-rep voice overlay.** A small per-rep addendum (`voice_overlays/{rep_id}.md`) appended to the artifact skill so briefs match the AE's preferred tone.
- **Pattern Analyst.** An offline job that reads call transcripts + briefs + rep feedback and proposes skill changes ("reps ignore section 04 for at-risk accounts; tighten or drop it"). Proposals land in a PR queue for human review.

None of these are implemented. The structure exists so they can be added without breaking changes.

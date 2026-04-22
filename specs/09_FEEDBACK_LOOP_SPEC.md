# 09 — Skill Evolution and Feedback Loop Spec

How the skill library improves over time without engineering intervention. V2 architecture, not V1 scope — but the design is stable and worth capturing now so the product trajectory is clear.

## The problem

A static skill library decays. Authored once, skills go stale in months as:
- The GTM team's tactics evolve
- The customer base shifts
- New objection patterns emerge
- AEs learn new approaches that the skill library doesn't encode

Without a feedback loop, the skill library is a config file. With one, it's a compounding asset.

## The three-signal composite

Every generated brief collects three signals. Together they form a quality score per skill.

### Signal 1 — AI-judged A/B testing

**When used:** whenever an admin proposes a skill edit. Runs automatically in preview mode before the edit can be promoted to production.

**How it works:**
1. Admin edits `at_risk_renewal.md` in the skill editor
2. System generates two briefs for each seeded test account (Northstar Beauty, Kindred Pet Supply, etc.):
   - Brief A using the current skill (v3.1)
   - Brief B using the edited skill (v3.2)
3. A judge agent (Claude, probably Haiku for speed) reads both briefs + the raw data context and rates each on:
   - **Groundedness** — did the brief cite sources for every factual claim?
   - **Opinion strength** — did the brief take a position, or hedge everything?
   - **Specificity** — did the brief reference the specific account situation, or stay generic?
   - **Actionability** — are the recommended actions concrete and executable?
   - **Constitution adherence** — did the brief follow every rule in the master skill?
4. Output: 0-10 composite score per brief, plus a plain-English diff summary ("B stronger on opinion, weaker on specificity, tied on groundedness")
5. Admin sees the comparison side-by-side before deciding to publish

**Guardrail:** a skill edit that regresses the composite score by more than 1.0 cannot be published without an admin override. Regressions never ship silently.

**Why this matters:** prevents well-intentioned skill edits from degrading brief quality across the team. Catches obvious mistakes before they reach reps.

### Signal 2 — Explicit rep feedback

**When used:** always. Every brief shows a small ⬆ ⬇ in the corner after the call.

**How it works:**
1. Rep completes the call
2. A small prompt appears on the brief: "Was this brief useful?"
3. Rep clicks up or down. Optional one-sentence note field.
4. System logs: `{ skill_version, skill_name, rep_id, account_id, outcome: up|down, note, timestamp }`
5. Aggregate view per skill: thumbs ratio over last 30 days, 90 days, all-time

**Guardrail:** minimum sample size before acting on rep feedback. A skill with only 3 ratings can't trigger any automated action. Requires 20+ ratings within a time window.

**Why this matters:** low-friction, high-signal. The rep is the user; their vote is the ultimate ground truth on whether the brief worked.

### Signal 3 — Implicit rep behavior

**When used:** always. Silent. The rep never knows this is being tracked.

**What's measured:**

- **Edit distance on the talk track.** How much did the rep rewrite the drafted questions before sending? A 95% unchanged talk track means the brief nailed the voice and posture. A 20% unchanged talk track means the rep had to rewrite everything — signal that the skill is off for this type of call.
- **Regeneration requests.** Did the rep hit "regenerate brief" before the call? How many times? Regeneration is a signal of dissatisfaction even if the rep never thumbs-down.
- **Mode switches to Prep.** Did the rep jump to Prep mode to verify claims? Jumping to Prep is a signal the rep didn't fully trust the read — they needed to see the underlying evidence before relying on the brief.
- **Citation click-throughs.** Did the rep click inline `·N` citations to see source details? Clicks are a positive signal of engagement, but heavy clicking may indicate mistrust.
- **Brief read-time.** Did the rep spend 30 seconds with the brief or 3 minutes? Too short = rep gave up; too long = brief was confusing. Neither is ideal.
- **Time between brief open and "Join call."** How long did the rep take to go from opening Primer to hitting the call? Short = confident prep; long = working to piece it together.

**Guardrail:** implicit signals are noisy. Never act on a single metric; composite them into an overall behavioral score per brief.

**Why this matters:** honest even when reps are rushed. A rushed rep won't click thumbs-up on a good brief — they'll just use it. Their edit patterns and mode switches don't lie.

## Composite scoring

Each skill gets an aggregate quality score:

```
skill_score = (
    0.4 * normalized_ai_judge_score +
    0.3 * normalized_explicit_signal +
    0.3 * normalized_implicit_signal
)
```

Weights are a starting hypothesis — validate empirically and adjust. The AI judge weight is highest because it's the only signal available at skill-edit time (before any rep sees the updated skill). Explicit and implicit signals are longitudinal.

Scores are per skill, per 30-day window, with confidence intervals reported. A skill with a low sample size (< 20 briefs) has wide confidence intervals and shouldn't trigger any action.

## Skill lifecycle

Every skill in the library has one of four states:

1. **Proposed** — authored but not yet used in production. No rep data yet.
2. **Pilot** — used for a subset of reps or accounts. Gathering rep data.
3. **Production** — default skill for its domain. Used for all qualifying accounts.
4. **Deprecated** — previously production, now rolled back. Kept for audit.

State transitions:
- Proposed → Pilot: admin action, after AI judge passes
- Pilot → Production: automatic if composite score > threshold after sample size threshold
- Production → Deprecated: automatic if composite score regresses below threshold, or admin action

All transitions logged with timestamp, trigger, and actor.

## What the Pattern Analyst does with this

The Pattern Analyst is a separate system (V3 scope) that reads the skill library + all the signals above + the Gong corpus and proposes skill improvements.

**Proposed actions:**
- "Skill `at_risk_renewal.md` is scoring 6.2/10 on opinion strength across 143 briefs. Top-performing reps who edit the talk track add more specific questions about billing status. Consider tightening the prompt."
- "Pattern detected: briefs for accounts with a new DM in the last 60 days have 3x the mode-switch-to-Prep rate. Consider a new skill variant for `new_dm_transition.md`."
- "Skill `expansion.md` has not been used in 47 days. Consider deprecating or investigating why the routing rule isn't matching."

The Pattern Analyst's proposals are reviewed by the admin in Slack. Approve, reject, or edit before committing. Rejections feed back into the Pattern Analyst so it learns what kinds of proposals get rejected and stops making them.

## What this enables that wasn't possible before

**Onboarding acceleration.** A new AE joining the team inherits the current skill library. Their first 50 calls are guided by the accumulated wisdom of every AE who came before. They ramp in weeks instead of quarters.

**Best-practice propagation.** When a top-performing AE has a style that works, their editing patterns tune the voice profile — and if the pattern generalizes, it gets proposed as an update to the company skill. Tribal knowledge becomes distributed knowledge without requiring anyone to write a memo.

**Accountability.** When a skill update regresses brief quality, the composite score catches it. No more "we changed the prompt and nothing happened" or "we changed the prompt and things got worse but we didn't notice for two months."

**Explainability.** Every brief's "why did it say that" is traceable. The skill version is logged. The skill's rules are readable. The source citations trace every fact. Debugging is no longer "ask the prompt engineer" — it's "read the skill."

## V1 vs. V2 vs. V3 scope

**V1 (shipped):**
- One skill (`pre_call_brief.md`)
- Master skill exists but isn't yet authored — current rules live in the artifact skill
- No feedback loop
- No admin editor

**V2 (next 90 days at Attentive):**
- Master skill extracted, inheritance wired
- Artifact skill variants: healthy_renewal, at_risk_renewal, new_business_discovery, expansion
- Admin editor UI
- AI-judged A/B for skill edits
- Explicit rep feedback (thumbs + note)

**V3 (12-month horizon):**
- Implicit behavioral signals tracked and scored
- Composite scoring per skill
- Skill lifecycle states (Proposed → Pilot → Production → Deprecated)
- Pattern Analyst proposing changes from the Gong corpus
- Additional artifact types (QBR prep, renewal risk alert, drafted follow-up)
- Per-rep voice profile overlay

## Why this is worth naming now

Even though none of it is V1 scope, the V2/V3 trajectory informs V1 architectural decisions. Specifically:

- The skill file format should be authorable by non-engineers from day one. Readable markdown, not YAML configs.
- Every brief generation should log the skill version used. V2 analytics need this historical data.
- The master/artifact inheritance pattern should be wired in V1 even with just one artifact, so V2 can add variants without restructuring.
- Rep actions (mode switches, regenerations, citation clicks) should be logged from day one, even if no one is reading the logs yet. V3 behavioral scoring is impossible without historical data.

This is the "log everything from day one so V2 has something to analyze" principle applied to the skill layer.

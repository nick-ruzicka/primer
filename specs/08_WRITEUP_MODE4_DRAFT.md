# Primer — Mode 4 Writeup (Draft v3)

Revisions from v2:
- Section 9 (feedback loop) collapsed into Section 8 (skills as playbooks)
- "Paths not taken" framing made explicit in the architectural sections
- Three-option RevTech-relationship analysis added as its own section
- Slight tightening across all sections

Format: each section renders with a bold Fraunces heading, a larger-body-type thesis, bullet evidence, and collapsed "Speaker notes" that expand on click.

---

## Section 1 — Hero

**The brief that thinks with you.**

Pre-call briefings for Attentive AEs, built in 48 hours as a takehome submission.

Nick Ruzicka · April 2026

[ Open the prototype → ] [ Read the architecture below ]

---

## Section 2 — The problem we're actually solving

**Account executives don't have a dashboards problem. They have a synthesis problem.**

Six source systems can agree on forty facts and still fail to tell you what the call is about. The gap between *fact* and *read* is where reps lose an hour a day, and where one-off prep guides stop working.

- A rep has Salesforce open, Gong tabs, Catalyst dashboard, NetSuite finance view, Snowflake usage reports, and a LinkedIn window. Each one has signal. None has synthesis.
- The hour of prep before a call is spent assembling a story — and that assembly is where value gets created *and* where mistakes get made, because it happens under time pressure with incomplete recall.
- Making the dashboards prettier doesn't help. Making a chat interface that answers questions doesn't help — the rep doesn't know what to ask. What helps is a tool that takes a position.

**Speaker notes** *(expand)*

The industry default is more dashboards, more panels, more tabs. Every CRM and revenue intelligence product I've looked at treats the AE as an analyst: give them more data, they'll figure it out. This is wrong at the first-principles level. The rep isn't short on data; the rep is short on time to synthesize it.

Primer inverts the relationship. The tool does the synthesis; the rep verifies it. A rep can read three paragraphs and know what the call is about. Everything else on the screen — the flagged intelligence cards, the portfolio comparisons, the competitor-mention counts — is evidence the rep can dip into when they want to verify a claim or look past the read.

---

## Section 3 — What I built (and what I considered building)

**Three interaction modes for three moments in the rep's workflow, all delivering one opinionated brief.**

One briefing per account. Four sections: *The read · Why this read · What to do on the call · Suggested talk track.*

- **Reading mode** — 60-second scan before the call. Opinionated prose with inline source citations and section-level confidence hedges.
- **Prep mode** — deeper exploration, an hour before or mid-week. Brief compresses to a nav strip; Account Intelligence takes the foreground.
- **Split mode** — live during the call. Brief on one side, Account Intelligence on the other. Click a citation in the brief to jump to the supporting row.
- **Mode 4 is this writeup.** The prototype and the thinking in one link.

**What I considered and rejected:**

- **Chat interface.** Every AI-in-GTM tool today defaults to chat. For pre-call prep it's the wrong pattern — the rep doesn't know what to ask. Writing first, letting the rep click for depth, is higher-leverage per rep-minute.
- **Dashboard with AI summary on top.** Concentrates manual work in one tab instead of five. Rep still has to synthesize. Doesn't solve the hour of prep.
- **Slack bot.** Useful for notifications but wrong for prep — the rep needs to read and navigate, not skim a thread.
- **Chrome extension layered on Salesforce/Gong.** Meets reps where they are, but inherits their UI constraints. Standalone app gives more design freedom in the 48-hour window.

The three-mode design emerged from the observation that reps use prep tools in genuinely different states. A "one-size layout" product forces the rep to adapt; Primer's modes are designed around the moment.

**Speaker notes** *(expand)*

The three modes aren't cosmetic. They're three distinct rep states. The keyboard shortcuts (1/2/3/4) make mode-switching cost-free, so the rep can fluidly move between scanning and verifying during a call.

---

## Section 4 — The core architectural decision: a read layer, not a write layer

**Primer never mutates upstream data. Six MCP servers wrap existing APIs, reason across them, write a brief. Nothing writes back.**

The prompt names a RevTech team that owns Salesforce architecture and long-term systems strategy. They have a unified data layer on the roadmap. This is the single most important constraint in the brief, and it shaped everything downstream.

- **Read-only architecture** means Primer sits on top of what RevTech already owns and never competes with it.
- **When RevTech ships their unified layer, MCP servers repoint.** The agent doesn't change. The interface doesn't change. The skill library doesn't change. Primer is designed as a migration target for their work, not a migration blocker.
- **Drafted actions, not direct mutations.** Email follow-ups, proposed SFDC field updates, Slack posts to deal channels are generated as proposals for the rep to approve and send themselves. The rep is the actor; the agent is the analyst.

**Speaker notes** *(expand)*

The temptation with any new GTM tool is to build it as a replacement — a new CRM, a new system of record. That path competes with RevTech's roadmap, requires migration, and creates political friction. Primer's architecture assumes the existing stack stays; value is added via intelligent reading, not by rebuilding what works.

The MCP protocol is the right abstraction here. Each source system gets a server that exposes read-only tools. If Attentive swaps Catalyst for Gainsight tomorrow, we swap the Catalyst MCP server. If RevTech ships the unified layer in 18 months, we point the servers at the new endpoints. The rest of the system is invariant.

---

## Section 5 — Three ways this could have been built — and why I chose this one

**Given the RevTech constraint, there were three plausible architectures. Each has a specific failure mode.**

**Option A — Salesforce-native.** Build Primer as a Lightning panel inside Salesforce. Pros: reps already live there; leverages existing auth; feels integrated. Cons: requires Apex and Lightning Web Component development; inherits Salesforce's UI constraints; directly overlaps RevTech's ownership; locks the product to one CRM forever.

**Option B — Build on RevTech's future data layer.** Wait for their unified customer data roadmap, build Primer on top of it. Pros: single source of truth; clean architecture; aligns with their strategy. Cons: 12-18 month wait before AEs see any value; Primer becomes a downstream dependency of a roadmap I don't own; no shipping learnings during the wait.

**Option C — Adjacent read-layer (chosen).** Six MCP servers sitting on top of existing APIs, a standalone web app, designed to repoint at the unified layer when it ships. Pros: RevTech-independent; ships in 48 hours; AEs get value immediately; seamless upgrade path. Cons: temporarily duplicates some data access; staleness management needs to be explicit.

**Why Option C wins for this problem:**

- It's the only option that delivers value within the 30-day window the prompt asked for.
- It's the only option that doesn't create RevTech coordination overhead.
- The tradeoff — temporary data duplication — is managed with explicit staleness indicators on every cached fact. The rep always knows when data is fresh vs. 15 minutes old.
- When RevTech's layer ships, migration is a configuration change, not a rewrite.

**Speaker notes** *(expand)*

This is the question that most separates a junior GTM Engineer from a senior one. The junior engineer picks the architecture that's "most correct" in isolation. The senior engineer picks the architecture that works inside the organization — respecting existing ownership, avoiding political friction, delivering value on the team's timeline, and leaving room for the right long-term architecture to emerge.

Option C reads as pragmatic rather than elegant. That's the point. Elegance that requires organizational change is harder to ship than pragmatism that preserves it.

---

## Section 6 — The brief takes a position

**An opinionated brief does the synthesis for the rep. A dashboard concentrates manual work in one tab instead of five.**

- For Northstar Beauty, the brief opens: *"Renewal on paper — trust-repair underneath."*
- For a healthy expansion account, the brief would open completely differently — same system, same architecture, different read.
- The rep walks in knowing the posture, not juggling signals.
- Comes with real risk: an opinionated product can be wrong. That's why the architecture below matters.

**What I considered and rejected:**

- **Neutral summary product.** Lower risk, lower value. A neutral summary requires the rep to form the opinion themselves — which is exactly the synthesis work Primer is trying to remove.
- **Confidence-weighted claims with no position.** Hedging every sentence makes the brief unreadable as prose and doesn't actually help the rep. Better to take a position and ground every claim than to hedge everything.

The product's value per minute of rep time is proportional to how much synthesis it does. An opinionated brief delivers 100% synthesis. A dashboard delivers ~20%. The gap between them is the product.

---

## Section 7 — Deterministic vs. probabilistic — load-bearing but invisible

**Every piece of content is either a fact from a source system or an inference from the agent. The distinction drives how the product handles trust.**

- Facts carry inline source chips (`·N`). Inferences use hedged voice: *"this suggests," "reads less like X and more like Y," "likely."*
- Section confidence is expressed in words, not numbers: *"— very likely," "— likely," "— agent recommendation," "— draft."*
- The rep never sees the words "deterministic" or "probabilistic." The pattern is encoded in typography and language, not labels.
- A careful reader picks up the rule: cited claims are facts, hedged claims are inferences, and the brief refuses to state things it can't ground.

**Visual moment:** side-by-side — the same sentence, one with a source chip, one in hedged voice.

**Speaker notes** *(expand)*

An AI summary tool blurs fact and inference into a single confident paragraph. A briefing product distinguishes them so the rep knows what they can cite on the call and what they need to verify first. This distinction is the most important design decision in the product — it's what separates "useful prep" from "a summary I can't trust."

The rep doesn't need to learn architecture. They learn by use: after a few briefs, the pattern is natural. Cited is verified; hedged is my judgment call to make.

---

## Section 8 — Hallucination guardrails are architectural, not prompted

**The failure mode that kills trust in tools like this is confident wrong answers. We prevent them at the rendering layer, not the prompt.**

- **Structured output** — every claim the agent makes is tied to a specific fact_id in the pre-fetched context. Citations aren't generated; they reference a pre-built fact index.
- **Validation agent** — a second Claude pass reads the generated brief against the raw tool outputs and flags contradictions *before* render. Source contradictions, unsupported claims, stale data — all surfaced as warnings at the top of the brief.
- **Refusal over inference** — when a source is missing or unreachable, the system says so explicitly rather than inventing a plausible value.
- **Staleness indicators** — every cached fact shows its age. The rep knows when they're looking at 2-minute-old data vs. 2-day-old data.

**What I considered and rejected:**

- **Prompt-based hallucination controls** ("be careful," "cite your sources," "don't make things up"). Fragile. Work in 95% of cases and fail in the 5% that matter most.
- **Output parsing with regex rule checks.** Catches shape but not semantic contradictions. A regex can confirm a ·N citation exists; it can't confirm the claim matches the underlying fact.
- **No validation layer.** The common industry choice. Works until it doesn't, and then it breaks trust catastrophically.

**Visual moment:** screenshot of the validation warning banner from Northstar Beauty — the "Forecast vs. evidence conflict" one.

**Speaker notes** *(expand)*

The validation agent is where architectural discipline becomes automatic. For Northstar Beauty it flags the Salesforce-Commit vs. Catalyst-Best-Case contradiction — exactly the disagreement a careful AE would notice when cross-referencing systems, surfaced automatically before the rep even reads the brief.

Prompt-based controls are discouragement. Architectural controls are enforcement. They're different things, and the difference matters when you're asking a rep to walk into a call and cite what the product said.

---

## Section 9 — Skills as the playbook layer

**The AI is the rendering engine. Skills are the intellectual property.**

Today, Primer generates pre-call briefs using one skill file. A skill encodes what an artifact is — what data to pre-fetch, how to structure the output, what voice to write in, what rules it must follow. Every artifact the system produces is defined by a skill.

This matters because it flips the product:

- Without skills, Primer is "an AI that generates briefs."
- With skills, Primer is **"a system for capturing and operationalizing GTM knowledge, with briefs as the first visible artifact."**
- The AI rendering layer is replaceable. The skill library accumulates. It's what compounds.

**Skills are hierarchical:**

- A **master skill** defines the constitution every brief must follow: citation discipline, voice hedging, confidence expression, refusal rules, forbidden phrases. Every other skill inherits from it. The validation agent reads the master and checks every brief against it — that's how the deterministic/probabilistic discipline becomes automatic across the library.
- **Artifact skills** define specific artifact types: pre-call brief, QBR prep, renewal risk alert, drafted follow-up.
- **Variants** handle account state: healthy renewal vs. at-risk vs. new-business discovery. Rule-based routing over deterministic account metadata — no Claude classifier in the routing layer, no hallucinations in routing.

**In production, skills become an editable layer inside the app:**

- RevOps and Enablement leads author and tune skills without filing engineering tickets.
- Preview mode shows what a skill change would do — before-vs-after briefs on a test account, side by side.
- Version history and rollback for every edit.
- Reps see which skill generated a given brief (small affordance), but editing is admin-only. Exposing skill machinery to reps would break the magic; reps just see the brief.

**The library improves via three feedback signals:**

- **AI-judged A/B.** When a skill update is proposed, a judge agent compares before-vs-after briefs across seeded test accounts. Regressions never ship; improvements get flagged for human review.
- **Explicit rep signal.** A thumbs-up/down on each brief. Low-friction but requires engagement.
- **Implicit rep behavior.** Edit distance on the talk track. Regeneration requests. Mode switches to Prep (signal: rep didn't trust the read). Honest even when reps are rushed.
- Composite score across all three decides whether an updated skill gets promoted.

**Visual moment:** simple tree diagram — master skill at top, artifact skills below, variants below that.

**What I considered and rejected:**

- **Fine-grained sub-skills** (e.g., `trust_repair_after_billing_incident_with_new_dm.md`). Over-fits; creates a library no one can maintain. The right granularity: a skill exists when a skilled human would meaningfully adjust their *approach* to the call, not when the situation varies.
- **Config-file skills engineers must modify.** The point of skills is that GTM teams author them. Hiding them in the codebase defeats the architecture.
- **No feedback loop.** Static skill libraries go stale in months. Without feedback, the library is a config file, not a compounding asset.

**Speaker notes** *(expand)*

The master skill is the constitutional layer. The scope question — how granular should skills be — has a principle behind it: a skill exists when a skilled human would meaningfully adjust their approach. A great AE walking into an at-risk renewal approaches the call fundamentally differently than a healthy renewal. That's a skill boundary. The difference between "trust repair after billing incident" and "trust repair after missed commitment" is handled inside `at_risk_renewal.md` by referring to the account's situation — not a new skill.

The feedback loop is what makes the skill library compounding rather than static. The AI judge catches obvious regressions before they reach reps. The explicit thumbs are the low-friction human signal. The implicit signals (edit distance, mode switches) are often more honest than explicit ones — reps who are rushed won't thumb-up a good brief, but their edit patterns don't lie.

---

## Section 10 — The 90-day plan if I joined Attentive

**The skill library isn't something you write in a month. It's something you mine.**

Attentive has years of Gong call recordings. Inside those calls is the accumulated knowledge of what works in every sales and CSM motion — locked in individual recordings, not organizational memory.

**First 30 days:**
- Ship Primer V1 to a pilot AE team. One artifact, one skill, full instrumentation.
- Begin pulling Gong corpus. Cluster calls by outcome: renewals saved, renewals churned, expansions won, expansions stalled.

**30-60 days:**
- Identify patterns. What signals predicted each outcome? What did top-performing AEs do differently? What questions did they ask? What talk tracks worked?
- Encode patterns as skill variants. Author `at_risk_renewal.md` from actual data of actual saves. Author `expansion_with_skeptical_buyer.md` from real wins and losses.

**60-90 days:**
- Ship the skill editor to RevOps and Enablement. Skills become an authorable surface, not a config file.
- Start the feedback loop. AI-judged A/B testing, rep thumbs, edit-distance tracking. Skills begin compounding.

**The longer horizon (12 months):**
- Primer expands to additional artifacts (QBR prep, renewal risk alerts, drafted follow-up emails). Same skill architecture, new artifact types.
- The skill library becomes the company's GTM memory. New AE onboarding is "inheriting the accumulated wisdom of everyone who came before" rather than "shadow three calls and figure it out."
- The AI rendering layer is replaceable. The skill library is the compounding moat.

**Speaker notes** *(expand)*

This is the concrete answer to "what would you do in this role." Not a generic pitch — a three-phase plan with measurable outputs each phase, grounded in the specific asset Attentive has (the Gong corpus) that most competitors don't.

The pattern is proven at smaller scale. The Linera Signal Engine I built learned from rep edit patterns and improved outbound performance by 18% on SQL conversion. The architecture generalizes.

---

## Section 11 — What I intentionally left out

**A V1 is defined more by what it excludes than what it includes.**

- **No chat.** Reps don't want to ask questions; they want a prepared read.
- **No generic dashboards.** Only flagged and contradictory data gets prominence. A "Current ARR: $940K" tile with no context is noise.
- **No write-back to Salesforce.** Drafted proposals for rep approval, never direct writes. RevTech owns that surface.
- **No multi-account briefings.** One rep, one call, one brief. Portfolio views come after single-account briefs earn trust.
- **No custom confidence weighting.** A validated scoring model matters more than a configurable one.
- **No tool-use loop.** The orchestrator pre-fetches from all six MCP servers in parallel rather than exposing tools for Claude to drive. Trades flexibility for predictability: every brief has a known latency envelope, the streaming contract stays monotonic, and every fact is traceable.

**Speaker notes** *(expand)*

Exclusions are decisions. Each item above is something I thought about and deliberately chose not to build. The chat interface decision is the most important — every AI product in GTM today defaults to chat, and for pre-call prep it's the wrong pattern.

The pre-fetch vs. agentic loop choice is worth calling out: the agentic loop is the more flexible pattern, but it complicates the streaming contract and makes latency unpredictable. For V1 with one artifact type, pre-fetching everything is cheaper than deciding conditionally. When Primer expands to multiple artifact types with different data subsets, the agentic loop becomes the right move.

---

## Section 12 — Tradeoffs

**Every interesting decision was a tradeoff.**

- **Freshness vs. cost** — cached with staleness timestamps rather than live-fetching every brief. Most account data doesn't change in 15 minutes; the rep sees the staleness indicator and can refresh.
- **Source of truth vs. velocity** — the brief surfaces contradictions instead of reconciling them. Northstar Beauty's Salesforce-Commit vs. Catalyst-Best-Case is flagged, not hidden. The rep sees the conflict and decides.
- **Opinion vs. informational** — opinion is higher-leverage per rep-minute but higher-risk. Guardrails make opinion safe to ship.
- **Read-only vs. write-back** — read-only earns trust first. Write-back is the right next move, with drafted proposals and rep approval, not direct mutations.
- **Standalone vs. embedded** — standalone gives design freedom for V1 but adds a new app to the rep's stack. Long-term, a Lightning panel or Gong integration is additive.
- **Pre-fetch vs. agentic loop** — pre-fetch trades flexibility for predictability in a single-artifact product. The agentic loop becomes right when artifacts multiply.
- **Single-account vs. portfolio** — single is enough for V1. Portfolio views come when single-account product has validated.

---

## Section 13 — How I built this

**Primer went from zero to live in about 48 hours over a weekend.**

- One Claude Code terminal per build surface — frontend, backend, MCP servers, infra — running in parallel overnight
- Claude Design for the UI system, four iterations
- Direct Anthropic SDK for the agent — no LangChain, no wrapper frameworks
- MCP servers as stdio subprocesses, parallel fan-out via asyncio
- All eight phases of the backend spec, all seven phases of the frontend spec, shipped with verification logs at every step

**This is the point.** GTM Engineering in 2026 compresses what was a multi-week sprint into a weekend prototype. Teams that invest in building ship differentiated infrastructure. Teams that rent off-the-shelf ship the same thing as their competitors. The economics have flipped.

**Visual moment:** screenshot of four Ghostty terminals running Claude Code in parallel.

**Speaker notes** *(expand)*

The hours number isn't a brag. It's an argument. Six years ago, building something like this was a multi-engineer, multi-week project. Today it's a weekend for one person with parallelized AI tooling. That's not incremental productivity improvement — it's a regime change in what a GTM team can build in-house.

The companies that figure out how to use this productivity shift will build proprietary infrastructure competitors can't buy. The companies that don't will be renting the same tools everyone else rents.

---

## Section 14 — Closing

**Primer is live at [primer.yourdomain.com]. Source at [github.com/nick-ruzicka/primer-attentive].**

Demo walkthrough video: [loom.com/...]

Questions: nick.c.ruzicka@gmail.com

Built with Claude Code + Claude Design, April 2026.

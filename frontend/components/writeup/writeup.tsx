"use client";

import type { ReactNode } from "react";

/**
 * Mode 4 · Writeup — full v3 content from specs/08_WRITEUP_MODE4_DRAFT.md.
 * Slide-style: each section renders a Fraunces claim header, a larger-body
 * subthesis, bullet evidence, optional "What I considered / rejected" block,
 * and a collapsible Speaker notes <details>. Visual-moment placeholders
 * appear where the spec flagged screenshots/diagrams for later.
 */
export function Writeup() {
  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <article className="mx-auto max-w-[720px] px-8 pb-24">
        <Hero />

        <WriteupSection
          number="02"
          claim="The problem we're actually solving"
          subthesis="Account executives don't have a dashboards problem. They have a synthesis problem."
        >
          <p>
            Six source systems can agree on forty facts and still fail to tell
            you what the call is about. The gap between <em>fact</em> and{" "}
            <em>read</em> is where reps lose an hour a day, and where one-off
            prep guides stop working.
          </p>
          <BulletList>
            <li>
              A rep has Salesforce open, Gong tabs, Catalyst dashboard, NetSuite
              finance view, Snowflake usage reports, and a LinkedIn window. Each
              one has signal. None has synthesis.
            </li>
            <li>
              The hour of prep before a call is spent assembling a story — and
              that assembly is where value gets created <em>and</em> where
              mistakes get made, because it happens under time pressure with
              incomplete recall.
            </li>
            <li>
              Making the dashboards prettier doesn't help. Making a chat
              interface that answers questions doesn't help — the rep doesn't
              know what to ask. What helps is a tool that takes a position.
            </li>
          </BulletList>
          <SpeakerNotes>
            <p>
              The industry default is more dashboards, more panels, more tabs.
              Every CRM and revenue intelligence product I've looked at treats
              the AE as an analyst: give them more data, they'll figure it out.
              This is wrong at the first-principles level. The rep isn't short
              on data; the rep is short on time to synthesize it.
            </p>
            <p>
              Primer inverts the relationship. The tool does the synthesis; the
              rep verifies it. A rep can read three paragraphs and know what the
              call is about. Everything else on the screen — the flagged
              intelligence cards, the portfolio comparisons, the
              competitor-mention counts — is evidence the rep can dip into when
              they want to verify a claim or look past the read.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="03"
          claim="What I built (and what I considered building)"
          subthesis="Three interaction modes for three moments in the rep's workflow, all delivering one opinionated brief."
        >
          <p>
            One briefing per account. Four sections:{" "}
            <em>
              The read · Why this read · What to do on the call · Suggested talk
              track.
            </em>
          </p>
          <BulletList>
            <li>
              <b>Reading mode</b> — 60-second scan before the call. Opinionated
              prose with inline source citations and section-level confidence
              hedges.
            </li>
            <li>
              <b>Prep mode</b> — deeper exploration, an hour before or mid-week.
              Brief compresses to a nav strip; Account Intelligence takes the
              foreground.
            </li>
            <li>
              <b>Split mode</b> — live during the call. Brief on one side,
              Account Intelligence on the other. Click a citation in the brief
              to jump to the supporting row.
            </li>
            <li>
              <b>Mode 4 is this writeup.</b> The prototype and the thinking in
              one link.
            </li>
          </BulletList>
          <RejectedBlock>
            <li>
              <b>Chat interface.</b> Every AI-in-GTM tool today defaults to
              chat. For pre-call prep it's the wrong pattern — the rep doesn't
              know what to ask. Writing first, letting the rep click for depth,
              is higher-leverage per rep-minute.
            </li>
            <li>
              <b>Dashboard with AI summary on top.</b> Concentrates manual work
              in one tab instead of five. Rep still has to synthesize. Doesn't
              solve the hour of prep.
            </li>
            <li>
              <b>Slack bot.</b> Useful for notifications but wrong for prep —
              the rep needs to read and navigate, not skim a thread.
            </li>
            <li>
              <b>Chrome extension layered on Salesforce/Gong.</b> Meets reps
              where they are, but inherits their UI constraints. Standalone app
              gives more design freedom in the 48-hour window.
            </li>
          </RejectedBlock>
          <p>
            The three-mode design emerged from the observation that reps use
            prep tools in genuinely different states. A "one-size layout"
            product forces the rep to adapt; Primer's modes are designed around
            the moment.
          </p>
          <SpeakerNotes>
            <p>
              The three modes aren't cosmetic. They're three distinct rep
              states. The keyboard shortcuts (<Mono>1</Mono>/<Mono>2</Mono>/
              <Mono>3</Mono>/<Mono>4</Mono>) make mode-switching cost-free, so
              the rep can fluidly move between scanning and verifying during a
              call.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="04"
          claim="The core architectural decision: a read layer, not a write layer"
          subthesis="Primer never mutates upstream data. Six MCP servers wrap existing APIs, reason across them, write a brief. Nothing writes back."
        >
          <p>
            The prompt names a RevTech team that owns Salesforce architecture
            and long-term systems strategy. They have a unified data layer on
            the roadmap. This is the single most important constraint in the
            brief, and it shaped everything downstream.
          </p>
          <BulletList>
            <li>
              <b>Read-only architecture</b> means Primer sits on top of what
              RevTech already owns and never competes with it.
            </li>
            <li>
              <b>
                When RevTech ships their unified layer, MCP servers repoint.
              </b>{" "}
              The agent doesn't change. The interface doesn't change. The skill
              library doesn't change. Primer is designed as a migration target
              for their work, not a migration blocker.
            </li>
            <li>
              <b>Drafted actions, not direct mutations.</b> Email follow-ups,
              proposed SFDC field updates, Slack posts to deal channels are
              generated as proposals for the rep to approve and send themselves.
              The rep is the actor; the agent is the analyst.
            </li>
          </BulletList>
          <VisualMoment caption="Architecture sketch: read-layer over existing APIs, repointable to RevTech's unified layer when it ships." />
          <SpeakerNotes>
            <p>
              The temptation with any new GTM tool is to build it as a
              replacement — a new CRM, a new system of record. That path
              competes with RevTech's roadmap, requires migration, and creates
              political friction. Primer's architecture assumes the existing
              stack stays; value is added via intelligent reading, not by
              rebuilding what works.
            </p>
            <p>
              The MCP protocol is the right abstraction here. Each source system
              gets a server that exposes read-only tools. If Attentive swaps
              Catalyst for Gainsight tomorrow, we swap the Catalyst MCP server.
              If RevTech ships the unified layer in 18 months, we point the
              servers at the new endpoints. The rest of the system is invariant.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="05"
          claim="Three ways this could have been built — and why I chose this one"
          subthesis="Given the RevTech constraint, there were three plausible architectures. Each has a specific failure mode."
        >
          <OptionBlock letter="A" title="Salesforce-native">
            Build Primer as a Lightning panel inside Salesforce. <b>Pros:</b>{" "}
            reps already live there; leverages existing auth; feels integrated.{" "}
            <b>Cons:</b> requires Apex and Lightning Web Component development;
            inherits Salesforce's UI constraints; directly overlaps RevTech's
            ownership; locks the product to one CRM forever.
          </OptionBlock>
          <OptionBlock letter="B" title="Build on RevTech's future data layer">
            Wait for their unified customer data roadmap, build Primer on top of
            it. <b>Pros:</b> single source of truth; clean architecture; aligns
            with their strategy. <b>Cons:</b> 12-18 month wait before AEs see
            any value; Primer becomes a downstream dependency of a roadmap I
            don't own; no shipping learnings during the wait.
          </OptionBlock>
          <OptionBlock letter="C" title="Adjacent read-layer (chosen)" chosen>
            Six MCP servers sitting on top of existing APIs, a standalone web
            app, designed to repoint at the unified layer when it ships.{" "}
            <b>Pros:</b> RevTech-independent; ships in 48 hours; AEs get value
            immediately; seamless upgrade path. <b>Cons:</b> temporarily
            duplicates some data access; staleness management needs to be
            explicit.
          </OptionBlock>
          <h3 className="mt-7 mb-2 font-serif text-[18px] font-medium text-ink">
            Why Option C wins for this problem:
          </h3>
          <BulletList>
            <li>
              It's the only option that delivers value within the 30-day window
              the prompt asked for.
            </li>
            <li>
              It's the only option that doesn't create RevTech coordination
              overhead.
            </li>
            <li>
              The tradeoff — temporary data duplication — is managed with
              explicit staleness indicators on every cached fact. The rep always
              knows when data is fresh vs. 15 minutes old.
            </li>
            <li>
              When RevTech's layer ships, migration is a configuration change,
              not a rewrite.
            </li>
          </BulletList>
          <SpeakerNotes>
            <p>
              This is the question that most separates a junior GTM Engineer
              from a senior one. The junior engineer picks the architecture
              that's "most correct" in isolation. The senior engineer picks the
              architecture that works inside the organization — respecting
              existing ownership, avoiding political friction, delivering value
              on the team's timeline, and leaving room for the right long-term
              architecture to emerge.
            </p>
            <p>
              Option C reads as pragmatic rather than elegant. That's the point.
              Elegance that requires organizational change is harder to ship
              than pragmatism that preserves it.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="06"
          claim="The brief takes a position"
          subthesis="An opinionated brief does the synthesis for the rep. A dashboard concentrates manual work in one tab instead of five."
        >
          <BulletList>
            <li>
              For Northstar Beauty, the brief opens:{" "}
              <em>"Renewal on paper — trust-repair underneath."</em>
            </li>
            <li>
              For a healthy expansion account, the brief would open completely
              differently — same system, same architecture, different read.
            </li>
            <li>The rep walks in knowing the posture, not juggling signals.</li>
            <li>
              Comes with real risk: an opinionated product can be wrong. That's
              why the architecture below matters.
            </li>
          </BulletList>
          <RejectedBlock>
            <li>
              <b>Neutral summary product.</b> Lower risk, lower value. A neutral
              summary requires the rep to form the opinion themselves — which is
              exactly the synthesis work Primer is trying to remove.
            </li>
            <li>
              <b>Confidence-weighted claims with no position.</b> Hedging every
              sentence makes the brief unreadable as prose and doesn't actually
              help the rep. Better to take a position and ground every claim
              than to hedge everything.
            </li>
          </RejectedBlock>
          <p>
            The product's value per minute of rep time is proportional to how
            much synthesis it does. An opinionated brief delivers 100%
            synthesis. A dashboard delivers ~20%. The gap between them is the
            product.
          </p>
        </WriteupSection>

        <WriteupSection
          number="07"
          claim="Deterministic vs. probabilistic — load-bearing but invisible"
          subthesis="Every piece of content is either a fact from a source system or an inference from the agent. The distinction drives how the product handles trust."
        >
          <BulletList>
            <li>
              Facts carry inline source chips (<Mono>·N</Mono>). Inferences use
              hedged voice:{" "}
              <em>
                "this suggests," "reads less like X and more like Y," "likely."
              </em>
            </li>
            <li>
              Section confidence is expressed in words, not numbers:{" "}
              <em>
                "— very likely," "— likely," "— agent recommendation," "—
                draft."
              </em>
            </li>
            <li>
              The rep never sees the words "deterministic" or "probabilistic."
              The pattern is encoded in typography and language, not labels.
            </li>
            <li>
              A careful reader picks up the rule: cited claims are facts, hedged
              claims are inferences, and the brief refuses to state things it
              can't ground.
            </li>
          </BulletList>
          <VisualMoment caption="Side-by-side — the same sentence, one with a source chip, one in hedged voice." />
          <SpeakerNotes>
            <p>
              An AI summary tool blurs fact and inference into a single
              confident paragraph. A briefing product distinguishes them so the
              rep knows what they can cite on the call and what they need to
              verify first. This distinction is the most important design
              decision in the product — it's what separates "useful prep" from
              "a summary I can't trust."
            </p>
            <p>
              The rep doesn't need to learn architecture. They learn by use:
              after a few briefs, the pattern is natural. Cited is verified;
              hedged is my judgment call to make.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="08"
          claim="Hallucination guardrails are architectural, not prompted"
          subthesis="The failure mode that kills trust in tools like this is confident wrong answers. We prevent them at the rendering layer, not the prompt."
        >
          <BulletList>
            <li>
              <b>Structured output</b> — every claim the agent makes is tied to
              a specific <Mono>fact_id</Mono> in the pre-fetched context.
              Citations aren't generated; they reference a pre-built fact index.
            </li>
            <li>
              <b>Validation agent</b> — a second Claude pass reads the generated
              brief against the raw tool outputs and flags contradictions{" "}
              <em>before</em> render. Source contradictions, unsupported claims,
              stale data — all surfaced as warnings at the top of the brief.
            </li>
            <li>
              <b>Refusal over inference</b> — when a source is missing or
              unreachable, the system says so explicitly rather than inventing a
              plausible value.
            </li>
            <li>
              <b>Staleness indicators</b> — every cached fact shows its age. The
              rep knows when they're looking at 2-minute-old data vs. 2-day-old
              data.
            </li>
          </BulletList>
          <RejectedBlock>
            <li>
              <b>Prompt-based hallucination controls</b> ("be careful," "cite
              your sources," "don't make things up"). Fragile. Work in 95% of
              cases and fail in the 5% that matter most.
            </li>
            <li>
              <b>Output parsing with regex rule checks.</b> Catches shape but
              not semantic contradictions. A regex can confirm a <Mono>·N</Mono>{" "}
              citation exists; it can't confirm the claim matches the underlying
              fact.
            </li>
            <li>
              <b>No validation layer.</b> The common industry choice. Works
              until it doesn't, and then it breaks trust catastrophically.
            </li>
          </RejectedBlock>
          <VisualMoment caption="Screenshot of the validation warning banner from Northstar Beauty — the 'Forecast vs. evidence conflict' one." />
          <SpeakerNotes>
            <p>
              The validation agent is where architectural discipline becomes
              automatic. For Northstar Beauty it flags the Salesforce-Commit vs.
              Catalyst-Best-Case contradiction — exactly the disagreement a
              careful AE would notice when cross-referencing systems, surfaced
              automatically before the rep even reads the brief.
            </p>
            <p>
              Prompt-based controls are discouragement. Architectural controls
              are enforcement. They're different things, and the difference
              matters when you're asking a rep to walk into a call and cite what
              the product said.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="09"
          claim="Skills as the playbook layer"
          subthesis="The AI is the rendering engine. Skills are the intellectual property."
        >
          <p>
            Today, Primer generates pre-call briefs using one skill file. A
            skill encodes what an artifact is — what data to pre-fetch, how to
            structure the output, what voice to write in, what rules it must
            follow. Every artifact the system produces is defined by a skill.
          </p>
          <p>This matters because it flips the product:</p>
          <BulletList>
            <li>Without skills, Primer is "an AI that generates briefs."</li>
            <li>
              With skills, Primer is{" "}
              <b>
                "a system for capturing and operationalizing GTM knowledge, with
                briefs as the first visible artifact."
              </b>
            </li>
            <li>
              The AI rendering layer is replaceable. The skill library
              accumulates. It's what compounds.
            </li>
          </BulletList>

          <h3 className="mt-7 mb-2 font-serif text-[18px] font-medium text-ink">
            Skills are hierarchical:
          </h3>
          <BulletList>
            <li>
              A <b>master skill</b> defines the constitution every brief must
              follow: citation discipline, voice hedging, confidence expression,
              refusal rules, forbidden phrases. Every other skill inherits from
              it. The validation agent reads the master and checks every brief
              against it — that's how the deterministic/probabilistic discipline
              becomes automatic across the library.
            </li>
            <li>
              <b>Artifact skills</b> define specific artifact types: pre-call
              brief, QBR prep, renewal risk alert, drafted follow-up.
            </li>
            <li>
              <b>Variants</b> handle account state: healthy renewal vs. at-risk
              vs. new-business discovery. Rule-based routing over deterministic
              account metadata — no Claude classifier in the routing layer, no
              hallucinations in routing.
            </li>
          </BulletList>

          <h3 className="mt-7 mb-2 font-serif text-[18px] font-medium text-ink">
            In production, skills become an editable layer inside the app:
          </h3>
          <BulletList>
            <li>
              RevOps and Enablement leads author and tune skills without filing
              engineering tickets.
            </li>
            <li>
              Preview mode shows what a skill change would do — before-vs-after
              briefs on a test account, side by side.
            </li>
            <li>Version history and rollback for every edit.</li>
            <li>
              Reps see which skill generated a given brief (small affordance),
              but editing is admin-only. Exposing skill machinery to reps would
              break the magic; reps just see the brief.
            </li>
          </BulletList>

          <h3 className="mt-7 mb-2 font-serif text-[18px] font-medium text-ink">
            The library improves via three feedback signals:
          </h3>
          <BulletList>
            <li>
              <b>AI-judged A/B.</b> When a skill update is proposed, a judge
              agent compares before-vs-after briefs across seeded test accounts.
              Regressions never ship; improvements get flagged for human review.
            </li>
            <li>
              <b>Explicit rep signal.</b> A thumbs-up/down on each brief.
              Low-friction but requires engagement.
            </li>
            <li>
              <b>Implicit rep behavior.</b> Edit distance on the talk track.
              Regeneration requests. Mode switches to Prep (signal: rep didn't
              trust the read). Honest even when reps are rushed.
            </li>
            <li>
              Composite score across all three decides whether an updated skill
              gets promoted.
            </li>
          </BulletList>

          <VisualMoment caption="Simple tree diagram — master skill at top, artifact skills below, variants below that." />

          <RejectedBlock>
            <li>
              <b>Fine-grained sub-skills</b> (e.g.,{" "}
              <Mono>trust_repair_after_billing_incident_with_new_dm.md</Mono>).
              Over-fits; creates a library no one can maintain. The right
              granularity: a skill exists when a skilled human would
              meaningfully adjust their <em>approach</em> to the call, not when
              the situation varies.
            </li>
            <li>
              <b>Config-file skills engineers must modify.</b> The point of
              skills is that GTM teams author them. Hiding them in the codebase
              defeats the architecture.
            </li>
            <li>
              <b>No feedback loop.</b> Static skill libraries go stale in
              months. Without feedback, the library is a config file, not a
              compounding asset.
            </li>
          </RejectedBlock>

          <SpeakerNotes>
            <p>
              The master skill is the constitutional layer. The scope question —
              how granular should skills be — has a principle behind it: a skill
              exists when a skilled human would meaningfully adjust their
              approach. A great AE walking into an at-risk renewal approaches
              the call fundamentally differently than a healthy renewal. That's
              a skill boundary. The difference between "trust repair after
              billing incident" and "trust repair after missed commitment" is
              handled inside <Mono>at_risk_renewal.md</Mono> by referring to the
              account's situation — not a new skill.
            </p>
            <p>
              The feedback loop is what makes the skill library compounding
              rather than static. The AI judge catches obvious regressions
              before they reach reps. The explicit thumbs are the low-friction
              human signal. The implicit signals (edit distance, mode switches)
              are often more honest than explicit ones — reps who are rushed
              won't thumb-up a good brief, but their edit patterns don't lie.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="10"
          claim="The 90-day plan if I joined Attentive"
          subthesis="The skill library isn't something you write in a month. It's something you mine."
        >
          <p>
            Attentive has years of Gong call recordings. Inside those calls is
            the accumulated knowledge of what works in every sales and CSM
            motion — locked in individual recordings, not organizational memory.
          </p>
          <PhaseBlock title="First 30 days">
            <li>
              Ship Primer V1 to a pilot AE team. One artifact, one skill, full
              instrumentation.
            </li>
            <li>
              Begin pulling Gong corpus. Cluster calls by outcome: renewals
              saved, renewals churned, expansions won, expansions stalled.
            </li>
          </PhaseBlock>
          <PhaseBlock title="30–60 days">
            <li>
              Identify patterns. What signals predicted each outcome? What did
              top-performing AEs do differently? What questions did they ask?
              What talk tracks worked?
            </li>
            <li>
              Encode patterns as skill variants. Author{" "}
              <Mono>at_risk_renewal.md</Mono> from actual data of actual saves.
              Author <Mono>expansion_with_skeptical_buyer.md</Mono> from real
              wins and losses.
            </li>
          </PhaseBlock>
          <PhaseBlock title="60–90 days">
            <li>
              Ship the skill editor to RevOps and Enablement. Skills become an
              authorable surface, not a config file.
            </li>
            <li>
              Start the feedback loop. AI-judged A/B testing, rep thumbs,
              edit-distance tracking. Skills begin compounding.
            </li>
          </PhaseBlock>
          <PhaseBlock title="The longer horizon (12 months)">
            <li>
              Primer expands to additional artifacts (QBR prep, renewal risk
              alerts, drafted follow-up emails). Same skill architecture, new
              artifact types.
            </li>
            <li>
              The skill library becomes the company's GTM memory. New AE
              onboarding is "inheriting the accumulated wisdom of everyone who
              came before" rather than "shadow three calls and figure it out."
            </li>
            <li>
              The AI rendering layer is replaceable. The skill library is the
              compounding moat.
            </li>
          </PhaseBlock>
          <SpeakerNotes>
            <p>
              This is the concrete answer to "what would you do in this role."
              Not a generic pitch — a three-phase plan with measurable outputs
              each phase, grounded in the specific asset Attentive has (the Gong
              corpus) that most competitors don't.
            </p>
            <p>
              The pattern is proven at smaller scale. The Linera Signal Engine I
              built learned from rep edit patterns and improved outbound
              performance by 18% on SQL conversion. The architecture
              generalizes.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="11"
          claim="What I intentionally left out"
          subthesis="A V1 is defined more by what it excludes than what it includes."
        >
          <BulletList>
            <li>
              <b>No chat.</b> Reps don't want to ask questions; they want a
              prepared read.
            </li>
            <li>
              <b>No generic dashboards.</b> Only flagged and contradictory data
              gets prominence. A "Current ARR: $940K" tile with no context is
              noise.
            </li>
            <li>
              <b>No write-back to Salesforce.</b> Drafted proposals for rep
              approval, never direct writes. RevTech owns that surface.
            </li>
            <li>
              <b>No multi-account briefings.</b> One rep, one call, one brief.
              Portfolio views come after single-account briefs earn trust.
            </li>
            <li>
              <b>No custom confidence weighting.</b> A validated scoring model
              matters more than a configurable one.
            </li>
            <li>
              <b>No tool-use loop.</b> The orchestrator pre-fetches from all six
              MCP servers in parallel rather than exposing tools for Claude to
              drive. Trades flexibility for predictability: every brief has a
              known latency envelope, the streaming contract stays monotonic,
              and every fact is traceable.
            </li>
          </BulletList>
          <SpeakerNotes>
            <p>
              Exclusions are decisions. Each item above is something I thought
              about and deliberately chose not to build. The chat interface
              decision is the most important — every AI product in GTM today
              defaults to chat, and for pre-call prep it's the wrong pattern.
            </p>
            <p>
              The pre-fetch vs. agentic loop choice is worth calling out: the
              agentic loop is the more flexible pattern, but it complicates the
              streaming contract and makes latency unpredictable. For V1 with
              one artifact type, pre-fetching everything is cheaper than
              deciding conditionally. When Primer expands to multiple artifact
              types with different data subsets, the agentic loop becomes the
              right move.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <WriteupSection
          number="12"
          claim="Tradeoffs"
          subthesis="Every interesting decision was a tradeoff."
        >
          <BulletList>
            <li>
              <b>Freshness vs. cost</b> — cached with staleness timestamps
              rather than live-fetching every brief. Most account data doesn't
              change in 15 minutes; the rep sees the staleness indicator and can
              refresh.
            </li>
            <li>
              <b>Source of truth vs. velocity</b> — the brief surfaces
              contradictions instead of reconciling them. Northstar Beauty's
              Salesforce-Commit vs. Catalyst-Best-Case is flagged, not hidden.
              The rep sees the conflict and decides.
            </li>
            <li>
              <b>Opinion vs. informational</b> — opinion is higher-leverage per
              rep-minute but higher-risk. Guardrails make opinion safe to ship.
            </li>
            <li>
              <b>Read-only vs. write-back</b> — read-only earns trust first.
              Write-back is the right next move, with drafted proposals and rep
              approval, not direct mutations.
            </li>
            <li>
              <b>Standalone vs. embedded</b> — standalone gives design freedom
              for V1 but adds a new app to the rep's stack. Long-term, a
              Lightning panel or Gong integration is additive.
            </li>
            <li>
              <b>Pre-fetch vs. agentic loop</b> — pre-fetch trades flexibility
              for predictability in a single-artifact product. The agentic loop
              becomes right when artifacts multiply.
            </li>
            <li>
              <b>Single-account vs. portfolio</b> — single is enough for V1.
              Portfolio views come when single-account product has validated.
            </li>
          </BulletList>
        </WriteupSection>

        <WriteupSection
          number="13"
          claim="How I built this"
          subthesis="Primer went from zero to live in about 48 hours over a weekend."
        >
          <BulletList>
            <li>
              One <Mono>Claude Code</Mono> terminal per build surface —
              frontend, backend, MCP servers, infra — running in parallel
              overnight
            </li>
            <li>Claude Design for the UI system, four iterations</li>
            <li>
              Direct Anthropic SDK for the agent — no LangChain, no wrapper
              frameworks
            </li>
            <li>
              MCP servers as <Mono>stdio</Mono> subprocesses, parallel fan-out
              via <Mono>asyncio</Mono>
            </li>
            <li>
              All eight phases of the backend spec, all seven phases of the
              frontend spec, shipped with verification logs at every step
            </li>
          </BulletList>
          <p>
            <b>This is the point.</b> GTM Engineering in 2026 compresses what
            was a multi-week sprint into a weekend prototype. Teams that invest
            in building ship differentiated infrastructure. Teams that rent
            off-the-shelf ship the same thing as their competitors. The
            economics have flipped.
          </p>
          <VisualMoment caption="Screenshot of four Ghostty terminals running Claude Code in parallel." />
          <SpeakerNotes>
            <p>
              The hours number isn't a brag. It's an argument. Six years ago,
              building something like this was a multi-engineer, multi-week
              project. Today it's a weekend for one person with parallelized AI
              tooling. That's not incremental productivity improvement — it's a
              regime change in what a GTM team can build in-house.
            </p>
            <p>
              The companies that figure out how to use this productivity shift
              will build proprietary infrastructure competitors can't buy. The
              companies that don't will be renting the same tools everyone else
              rents.
            </p>
          </SpeakerNotes>
        </WriteupSection>

        <ClosingSection />
      </article>
    </div>
  );
}

// ---------- sub-components ----------

function Hero() {
  return (
    <header className="pt-20 pb-14 border-b border-line">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
        Primer · Mode 4
      </p>
      <h1 className="mt-4 font-serif text-[48px] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
        The brief that thinks with you.
      </h1>
      <p className="mt-5 font-serif text-[18px] leading-[1.55] text-ink-2 max-w-[540px]">
        Pre-call briefings for Attentive AEs, built in 48 hours as a takehome
        submission.
      </p>
      <p className="mt-5 text-[13px] text-ink-3">Nick Ruzicka · April 2026</p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <CTAButton primary onClick={() => null}>
          Open the prototype →
        </CTAButton>
        <CTAButton onClick={() => null}>Read the architecture below</CTAButton>
      </div>
    </header>
  );
}

function ClosingSection() {
  return (
    <section className="mt-16 border-t border-line pt-14 pb-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
        14 · Closing
      </p>
      <h2 className="mt-3 font-serif text-[32px] font-medium leading-[1.15] tracking-[-0.015em] text-ink">
        Primer is live at{" "}
        <a
          href="#"
          className="underline decoration-accent decoration-2 underline-offset-4"
        >
          primer.yourdomain.com
        </a>
        .
        <br />
        Source at{" "}
        <a
          href="#"
          className="underline decoration-accent decoration-2 underline-offset-4"
        >
          github.com/nick-ruzicka/primer-attentive
        </a>
        .
      </h2>
      <div className="mt-6 space-y-2 text-[14px] text-ink-2 leading-relaxed">
        <p>
          Demo walkthrough video:{" "}
          <a
            href="#"
            className="underline decoration-ink-4/40 hover:decoration-ink"
          >
            loom.com/…
          </a>
        </p>
        <p>
          Questions:{" "}
          <a
            href="mailto:nick.c.ruzicka@gmail.com"
            className="underline decoration-ink-4/40 hover:decoration-ink"
          >
            nick.c.ruzicka@gmail.com
          </a>
        </p>
        <p className="pt-2 text-ink-4">
          Built with Claude Code + Claude Design, April 2026.
        </p>
      </div>
    </section>
  );
}

function WriteupSection({
  number,
  claim,
  subthesis,
  children,
}: {
  number: string;
  claim: string;
  subthesis: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-16">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
        {number} · Section
      </p>
      <h2 className="mt-3 font-serif text-[30px] font-medium leading-[1.18] tracking-[-0.015em] text-ink">
        {claim}
      </h2>
      <p className="mt-4 font-serif text-[18px] leading-[1.5] text-ink-2 italic">
        {subthesis}
      </p>
      <div className="mt-5 space-y-4 text-[15px] leading-[1.7] text-ink-2">
        {children}
      </div>
    </section>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">{children}</ul>
  );
}

function RejectedBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-line bg-surface-sunk/40 px-5 py-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4 mb-3">
        What I considered and rejected
      </h3>
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4 text-[14px] text-ink-2">
        {children}
      </ul>
    </div>
  );
}

function OptionBlock({
  letter,
  title,
  chosen = false,
  children,
}: {
  letter: string;
  title: string;
  chosen?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "mt-4 rounded-lg border px-5 py-4 " +
        (chosen
          ? "border-accent bg-accent-soft/40"
          : "border-line bg-surface-2/40")
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          Option {letter}
        </span>
        <span className="font-serif text-[17px] font-medium text-ink">
          {title}
        </span>
        {chosen && (
          <span className="ml-auto rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
            Chosen
          </span>
        )}
      </div>
      <p className="mt-2 text-[14px] leading-[1.65] text-ink-2">{children}</p>
    </div>
  );
}

function PhaseBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
        {title}
      </h3>
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">{children}</ul>
    </div>
  );
}

function SpeakerNotes({ children }: { children: ReactNode }) {
  return (
    <details className="mt-6 rounded-lg border border-line/70 bg-surface/60 [&_summary::marker]:hidden">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-3 text-[12px] font-mono uppercase tracking-[0.1em] text-ink-3 hover:text-ink">
        <svg
          className="h-3 w-3 transition-transform group-open:rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>Speaker notes</span>
      </summary>
      <div className="space-y-3 px-5 pb-5 pt-2 text-[14px] leading-[1.7] text-ink-2 [&_p]:m-0">
        {children}
      </div>
    </details>
  );
}

function VisualMoment({ caption }: { caption: string }) {
  return (
    <figure className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface-sunk/30 px-6 py-10 text-center">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
        Visual moment
      </p>
      <p className="mt-3 font-serif text-[15px] italic text-ink-3 max-w-[480px] mx-auto leading-[1.5]">
        {/* TODO: operator to replace with actual image/diagram */}
        {caption}
      </p>
    </figure>
  );
}

function CTAButton({
  children,
  primary = false,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-4 py-2 text-[13px] font-medium transition-colors " +
        (primary
          ? "bg-accent text-accent-ink shadow-sm hover:bg-accent-2"
          : "border border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-surface-sunk/80 px-1 py-0.5 font-mono text-[12.5px] text-ink-2">
      {children}
    </code>
  );
}

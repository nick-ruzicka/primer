"use client";

import type { ReactNode } from "react";

export function Writeup() {
  return (
    <div className="w-full overflow-y-auto bg-bg">
      <article className="mx-auto max-w-[1024px] px-6 py-16 sm:px-10 sm:py-20">
        <Hero />

        <Section claim="The problem we're actually solving">
          <p>
            AEs don't have a dashboards problem. They have a synthesis problem.
          </p>
          <p>
            A rep walks into a customer call with six tabs open: Salesforce,
            Gong, Catalyst, NetSuite, Snowflake, LinkedIn. Each has signal.
            None tells you what the call is about.
          </p>
          <p>The hour of prep is spent assembling a story:</p>
          <BulletList>
            <li>What state is this account actually in?</li>
            <li>Who's the new decision-maker?</li>
            <li>What did we agree to last quarter and never follow up on?</li>
            <li>Renewal, trust-repair, or expansion?</li>
          </BulletList>
          <p>
            The assembly happens in the rep's head, under time pressure, with
            incomplete recall. That's where deals get lost.
          </p>
          <p>
            Primer takes a position. Every claim grounded in a source. Every
            claim it can't ground, it refuses to make.
          </p>
        </Section>

        <Section claim="What I built">
          <p>Two terms before anything else:</p>
          <BulletList>
            <li>
              <b>Artifact:</b> whatever Primer produces for a rep. Today: the
              pre-call brief. Tomorrow: post-call summaries, drafted outreach,
              renewal risk alerts.
            </li>
            <li>
              <b>Skill file:</b> a markdown document that defines an artifact.
              What data to pull, how to structure it, what voice to write in,
              what rules it must follow.
            </li>
          </BulletList>
          <p>
            <b>Today's artifact: the pre-call brief.</b> A single-page web app
            with four modes (Reading, Workspace, Split, Writeup), all rendering
            one brief per account.
          </p>
          <p>The brief itself has five sections:</p>
          <BulletList>
            <li>
              <b>The read.</b> What's the call about, in one paragraph.
            </li>
            <li>
              <b>Why this read.</b> The evidence behind it.
            </li>
            <li>
              <b>What to do on the call.</b> Specific actions.
            </li>
            <li>
              <b>Discovery questions.</b> Three to five questions tied to the
              read. Sales runs on questions.
            </li>
            <li>
              <b>Suggested talk track.</b> Language to actually use.
            </li>
          </BulletList>
          <p>
            At production, the brief also surfaces{" "}
            <b>revenue × health by product</b> ("paying $X for Flows Pro at
            health 82, $Y for Journeys at 61") so the rep sees combined
            value-and-risk per line, not separately.
          </p>
          <p>
            <b>Stretch goals I scoped out:</b>
          </p>
          <BulletList>
            <li>
              <b>Calendar-aware brief generation.</b> Wire Google Calendar /
              Outlook. Brief auto-generates 30 minutes before a customer call.
            </li>
            <li>
              <b>Slack as a distribution surface.</b>{" "}
              <Mono>/primer [account]</Mono> slash command, or auto-post briefs
              into deal channels on calendar trigger.
            </li>
            <li>
              <b>Mobile read view.</b> Brief renders cleanly on phone for the
              rep checking it in the Uber to the meeting.
            </li>
            <li>
              <b>Email digest.</b> Daily morning summary of upcoming calls and
              their briefs, in the inbox.
            </li>
            <li>
              <b>Pipeline ops uptime monitoring.</b> Health-check dashboard for
              the MCP servers. Alerts when a connector starts failing silently.
            </li>
            <li>
              <b>User analytics tracking.</b> Per-rep usage dashboard: which
              briefs got opened, time-on-page, edit patterns,
              helpful/not-helpful rates.
            </li>
          </BulletList>
        </Section>

        <Section claim="Three architectures I considered">
          <p>
            <b>Option A: Salesforce-native (Lightning panel + Agentforce).</b>
          </p>
          <BulletList>
            <li>Build inside Salesforce. Use Agentforce for synthesis.</li>
            <li>
              <em>Pros:</em> meets reps where they live, leverages existing
              licenses.
            </li>
            <li>
              <em>Cons:</em> Salesforce can only synthesize what Salesforce can
              see. Catalyst, Snowflake usage, NetSuite, Slack, external signals
              all live outside.
            </li>
          </BulletList>
          <p>
            <b>Option B: Vector DB / RAG layer.</b>
          </p>
          <BulletList>
            <li>
              Embed every fact and document into a vector store. Retrieve
              relevant chunks per brief via semantic search.
            </li>
            <li>
              <em>Embeddings:</em> vector representations of unstructured text
              that allow semantic retrieval. "Find notes about pricing
              pushback" works even if no note literally says those words.
            </li>
            <li>
              <em>Vector DB:</em> where embeddings live (Pinecone, Weaviate,
              pgvector).
            </li>
            <li>
              <em>Cons:</em> retrieval is lossy. Hard to guarantee a specific
              fact (champion name, exact ARR) makes it into context. Hybrid
              keyword + semantic search reduces some failure modes (Dispatch
              ran this way), but the hallucination risk compounds with corpus
              size.
            </li>
          </BulletList>
          <p>
            <b>
              Option C: Read-layer with deterministic pre-fetch via MCP.
            </b>{" "}
            ← chosen
          </p>
          <BulletList>
            <li>
              Pre-fetch every value through MCP servers. Bundle into a fact
              index with unique IDs. Citations point at specific{" "}
              <Mono>fact_id</Mono>s.
            </li>
            <li>
              <em>Pros:</em> every fact is structurally addressable. Citations
              can't hallucinate. No shadow database.
            </li>
          </BulletList>
          <p>
            C trades flexibility for predictability. Exactly the trade you want
            when the product's job is making confident, defensible claims.
          </p>
        </Section>

        <Section claim="The architecture in four decisions">
          <Subhead>1. Read-only, not write-back</Subhead>
          <BulletList>
            <li>Six MCP servers read. Primer never writes back.</li>
            <li>Drafted actions for the rep to approve and send themselves.</li>
            <li>
              When RevTech's unified data layer ships, MCP servers repoint.
            </li>
          </BulletList>

          <Subhead>2. Pre-fetch, not agentic loop</Subhead>
          <BulletList>
            <li>
              An <em>agentic loop</em> is when the model decides what to do
              next on each step (call this tool, then that one, then
              synthesize). Pre-fetch is the opposite: pull everything first,
              reason once.
            </li>
            <li>
              Pre-fetch wins for one artifact with a known shape. Latency
              bounded, cost fixed per brief.
            </li>
            <li>
              Agentic loops are right when artifacts multiply and the model has
              to decide which tools to call.
            </li>
          </BulletList>

          <Subhead>3. Skills are the playbook layer</Subhead>
          <p>
            Skills are organized as a hierarchy. A constitutional{" "}
            <b>master skill</b> sets the universal rules.{" "}
            <b>Artifact-type skills</b> define shape (the pre-call brief always
            has these five sections, the same data sources, the same voice).{" "}
            <b>Variant skills</b> under each type adjust content per situation.
          </p>
          <p>Take the master skill rules. They read like laws:</p>
          <RuleQuote>
            <p>Never claim something you can't cite.</p>
            <p>
              Never write "the customer is happy" when the data only says
              "health score is 72."
            </p>
            <p>
              When the rep asks who the champion is and three sources disagree,
              show all three. Don't pick.
            </p>
          </RuleQuote>
          <p>
            Take a variant. The renewal-call brief variant adds rules like{" "}
            <em>"open with renewal posture in the first sentence"</em> and{" "}
            <em>"flag any unresolved billing items in 'what to do.'"</em> The
            discovery-call variant says{" "}
            <em>
              "open with what we know about the prospect's stated pain"
            </em>{" "}
            and{" "}
            <em>
              "the talk track section should focus on credibility, not
              features."
            </em>
          </p>
          <p>
            Same shape. Different content. Variants are where the playbook
            actually lives.
          </p>
          <p>
            Skills anchor the LLM to business context. They're permanent
            knowledge structures: how a brief should read, when to escalate,
            what "expansion-ready" looks like at this company. The LLM is the
            rendering engine. Skills are how it learns the business.
          </p>

          <Subhead>4. The validator agent</Subhead>
          <p>
            The validator's job is being truthful. Three layered defenses:
          </p>
          <p>
            <b>Structured output via fact_ids.</b> Every value gets a unique ID
            before the LLM runs:
          </p>
          <CodeBlock>
{`fact_id: 16
source_system: catalyst
field: relationship_score
value: 61
data_as_of: 2026-04-23`}
          </CodeBlock>
          <p>
            The LLM writes claims that reference the fact:{" "}
            <em>"Health dropped from 74 to 61 ·16."</em> The agent can only
            cite things in the index. Hallucinated citations become
            structurally impossible.
          </p>
          <p>
            <b>Validator agent.</b> A second model (Claude Haiku) reads the
            brief against source data. It's picky on purpose.
          </p>
          <p>Real catch from testing:</p>
          <ExampleQuote>
            <p>
              <em>Brief tried to write:</em> "Avery Collins and Jules Okafor
              have built a disciplined operation"
            </p>
            <p>
              <em>Citation supported:</em> "adoption leadership"
            </p>
            <p>
              <em>Validator's response:</em> you're being a hype man. The fact
              says they're adoption leaders, not disciplined operators. Tone
              it down.
            </p>
          </ExampleQuote>
          <p>The brief wanted to upsell. The validator made it stop.</p>
          <p>
            <b>Refusal rules.</b> When the brief can't ground a claim, it
            refuses. "No data on this" beats "made-up specifics" on trust.
          </p>
          <VisualMarker>validation warning panel from a real brief</VisualMarker>
          <VisualMarker>
            side-by-side prose, fact-citation vs hedged-inference
          </VisualMarker>
        </Section>

        <Section claim="What V1 misses: the narrative layer">
          <p>V1 reads structured facts. It doesn't read the narrative.</p>
          <p>
            <b>Where the narrative lives:</b>
          </p>
          <BulletList>
            <li>
              <b>Salesforce:</b> rep-typed notes, activities, Chatter, email
              logs. Gong AI summaries <em>if</em> the sync ran.
            </li>
            <li>
              <b>Gong:</b> full call transcripts. Salesforce only has the
              summary by default.
            </li>
            <li>
              <b>Catalyst:</b> CSM-authored notes, expansion planning,
              escalation history. Not in Salesforce.
            </li>
          </BulletList>
          <p>
            The Gong-to-Salesforce sync depends on rep action or admin filters;
            in practice many calls don't make it through. Reading directly from
            Gong avoids the dependency on whether someone pressed a button.
          </p>
          <p>
            <b>The cheap fix: last 5 of each.</b>
          </p>
          <p>V1.5 ships in week 2:</p>
          <BulletList>
            <li>5 most recent notes/activities from Salesforce</li>
            <li>5 most recent Catalyst notes</li>
            <li>5 most recent Gong call summaries</li>
          </BulletList>
          <p>
            ~1,500 added tokens per brief. No new infrastructure. Probably the
            permanent answer for most accounts. Reps need the last call, the
            recent escalation, the thread from two weeks ago. Note #6 from 14
            months ago is rarely the unlock.
          </p>
          <p>
            <b>The competitor: Agentforce Account Management.</b>
          </p>
          <p>
            Salesforce ships a product whose job is exactly Primer's. The
            catch: what Salesforce can synthesize is bounded by what Salesforce
            can see.
          </p>
          <p>
            The textbook answer is the modern data stack: Fivetran ingests
            every source into Snowflake, dbt models the data, Hightouch (or
            Fivetran Activations) syncs the synthesized output back into
            Salesforce. Best practice, $1,000–$10,000+/month at scale,
            requires a data team, ships value only after the dbt models are in
            production. Salesforce's Data Cloud + Informatica is the
            inside-the-walled-garden version.
          </p>
          <p>
            <b>Primer's positioning:</b> read from each system through MCP
            servers. Synthesize at the edge. Ship value this quarter. When the
            customer eventually does build the warehouse stack, MCP servers
            point at it.
          </p>
          <p>
            Salesforce is moving here. They acquired Informatica in 2025
            because data unification is what bottlenecks Agentforce. They're
            trying to solve it. It will take years.
          </p>
          <p>
            <b>The own-it path (V2B): cross-system embeddings.</b>
          </p>
          <p>
            For history blended <em>across</em> systems Salesforce can't see
            (Catalyst CSM narrative, full Gong transcripts, Primer's own
            feedback signals), build cross-system embeddings + vector DB +
            per-artifact retrieval. Six weeks to ship. Right at Attentive's
            scale.
          </p>
          <p>
            <b>The feedback loop, regardless of path.</b>
          </p>
          <p>Once Primer is in production, it accumulates its own signal:</p>
          <BulletList>
            <li>Did the rep edit the brief before the call?</li>
            <li>Did the rep mark the brief as helpful?</li>
            <li>Did the deal advance after the call?</li>
            <li>
              Did any brief content get pasted into Salesforce notes or
              follow-ups?
            </li>
          </BulletList>
          <p>
            Skills are the playbook. History is the memory of every play
            that's been run.
          </p>
          <p>
            <b>The four-tier roadmap:</b>
          </p>
          <BulletList>
            <li>
              <b>V1 (today):</b> Structured facts only. Shipped.
            </li>
            <li>
              <b>V1.5 (week 2):</b> Last 5 notes/activities/calls from each
              source. No new infra.
            </li>
            <li>
              <b>V2A (month 2):</b> Wrap any Salesforce-side AI compression as
              MCP tools, if the customer has them.
            </li>
            <li>
              <b>V2B (month 3-4):</b> Cross-system embedding layer when scale
              demands it.
            </li>
          </BulletList>
          <p>
            V1.5 ships before V2A and V2B. V2A and V2B aren't sequential.
          </p>
        </Section>

        <Section claim="Tradeoffs">
          <p>
            <b>Freshness.</b>
          </p>
          <BulletList>
            <li>15-minute Redis cache. Regeneration on explicit refresh.</li>
            <li>
              Every citation shows data age. Stale past threshold, the brief
              calls it out.
            </li>
          </BulletList>
          <p>
            <b>System boundaries.</b>
          </p>
          <BulletList>
            <li>
              Salesforce owns accounts. NetSuite owns billing. Gong owns
              conversations. Primer never owns it.
            </li>
            <li>
              Drafted actions fire to whichever system already owns the
              workflow.
            </li>
            <li>
              Primer surfaces contradictions instead of resolving them: when
              Salesforce says Best Case and Catalyst flags Watchlist on the
              same account, the brief shows both.
            </li>
          </BulletList>
          <p>
            <b>Opinion vs. informational.</b>
          </p>
          <BulletList>
            <li>
              A neutral summary forces the rep to do the synthesis themselves.
            </li>
            <li>An opinionated brief is higher-leverage and higher-risk.</li>
            <li>
              The validator agent and the four guardrails make opinion safe to
              ship.
            </li>
          </BulletList>
        </Section>

        <Section claim="The 90-day plan if I joined Attentive">
          <Subhead>Days 0-14: Validate before scaling</Subhead>
          <BulletList>
            <li>
              Wire production OAuth to Attentive's Salesforce, Gong, Catalyst
              sandboxes.
            </li>
            <li>Harden MCP servers: rate limits, retry logic, auth refresh.</li>
            <li>
              Get 3-5 reps using Primer on actual upcoming calls. Capture
              structured feedback.
            </li>
            <li>
              Manager-led QA: review 20 generated briefs against ground truth.
            </li>
            <li>
              Sales team interviews: 5-8 reps to learn their actual prep
              workflow.
            </li>
          </BulletList>

          <Subhead>Days 15-30: Author seed skills from the Gong corpus</Subhead>
          <BulletList>
            <li>
              Pull 12 months of calls. Find the motions: renewal, expansion,
              trust-repair, discovery, demo.
            </li>
            <li>
              Author five seed skills covering the dominant call types. RevOps
              reviews and signs off.
            </li>
          </BulletList>

          <Subhead>Days 30-60: Ship V1.5 + roll out skills</Subhead>
          <BulletList>
            <li>
              Add last-5 notes/activities/Gong from each source to pre-fetch.
            </li>
            <li>Roll out the five seed skills to the team.</li>
            <li>
              Instrument feedback signals: which skill got invoked, edit rate
              per skill, helpful/not-helpful rate, drafted-action-sent rate.
            </li>
            <li>Cut what doesn't work.</li>
          </BulletList>

          <Subhead>Days 60-90: Wire the feedback loop</Subhead>
          <BulletList>
            <li>Primer reads its own call transcripts back through Gong.</li>
            <li>Compares what the brief said to how the call actually went.</li>
            <li>Proposes skill updates where the brief was wrong.</li>
            <li>The library starts compounding.</li>
          </BulletList>

          <p>
            <b>Twelve months out:</b> new AE onboarding shifts from "shadow
            three calls and figure it out" to "inherit the accumulated reads
            of every senior rep who came before."
          </p>
        </Section>

        <Section claim="How I built this">
          <p>The build itself was the AI workflow being tested.</p>
          <BulletList>
            <li>
              <b>Setup.</b> Four parallelized Claude Code terminals on a
              personal Mac. Backend, frontend, infrastructure, writeup — one
              per terminal.
            </li>
            <li>
              <b>Roles.</b> Claude Chat as architect and QA. Claude Code as
              contractor. Claude Design as stylist. Me as client (direction,
              taste, ship decisions).
            </li>
          </BulletList>
          <p>
            GTM Engineering in 2026 compresses a multi-week sprint into a
            focused build. Teams that invest in building ship differentiated
            infrastructure. Teams that rent off-the-shelf ship the same thing
            as their competitors. The economics flipped when the cost of
            building one good thing dropped faster than the cost of integrating
            five mediocre ones.
          </p>
        </Section>

        <Closing />
      </article>
    </div>
  );
}

function Hero() {
  return (
    <header className="border-b border-line pb-14">
      <h1 className="font-serif text-[56px] font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-[64px]">
        The brief that thinks with you.
      </h1>
      <p className="mt-6 font-serif text-[19px] leading-[1.55] text-ink-2">
        <b>Pre-call briefings for Attentive AEs.</b>
      </p>
      <p className="mt-3 text-[13px] text-ink-3">Nick Ruzicka · April 2026</p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <CTAButton primary onClick={() => null}>
          Open the prototype →
        </CTAButton>
        <CTAButton onClick={() => null}>Read the architecture below</CTAButton>
      </div>
    </header>
  );
}

function Closing() {
  return (
    <section className="mt-20 space-y-6 border-t border-line pb-4 pt-14 text-[16px] leading-[1.7] text-ink-2">
      <p>
        Primer is live at{" "}
        <a
          href="#"
          className="underline decoration-accent decoration-2 underline-offset-4"
        >
          primer.[hetzner-url-here]
        </a>
        .
      </p>
      <p>
        Source at{" "}
        <a
          href="#"
          className="underline decoration-accent decoration-2 underline-offset-4"
        >
          github.com/nick-ruzicka/primer-attentive
        </a>
        .
      </p>
      <p>
        Questions, pushback, follow-ups:{" "}
        <a
          href="mailto:nick.c.ruzicka@gmail.com"
          className="underline decoration-ink-4/40 hover:decoration-ink"
        >
          nick.c.ruzicka@gmail.com
        </a>
        .
      </p>
    </section>
  );
}

function Section({
  claim,
  children,
}: {
  claim: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-20">
      <h2 className="mb-8 font-serif text-[34px] font-medium leading-[1.18] tracking-[-0.015em] text-ink">
        {claim}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.7] text-ink-2">
        {children}
      </div>
    </section>
  );
}

function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-8 font-serif text-[22px] font-medium leading-[1.3] text-ink">
      {children}
    </h3>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">{children}</ul>
  );
}

function RuleQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-2 border-l-2 border-accent pl-5 font-serif text-[17px] italic leading-[1.6] text-ink-2 [&>p]:my-3">
      {children}
    </blockquote>
  );
}

function ExampleQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-2 rounded-md border border-line bg-surface-sunk/40 px-5 py-4 text-[15px] leading-[1.65] text-ink-2 [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-md border border-line bg-surface-sunk/60 px-4 py-3 font-mono text-[13px] leading-[1.6] text-ink-2">
      <code>{children}</code>
    </pre>
  );
}

function VisualMarker({ children }: { children: ReactNode }) {
  return (
    <p className="my-2 font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-4">
      [VISUAL: {children}]
    </p>
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

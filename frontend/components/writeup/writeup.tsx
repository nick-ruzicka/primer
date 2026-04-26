"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlignJustify, ChevronDown, FileText, Mail, Package, Rocket } from "lucide-react";
import { WriteupToc } from "./writeup-toc";

const TOC_SECTIONS = [
  { id: "top", number: "", title: "Top" },
  { id: "problem", number: "01", title: "The problem we're actually solving" },
  { id: "what-built", number: "02", title: "What I built" },
  { id: "architectures", number: "03", title: "Three architectures I considered" },
  { id: "decisions", number: "04", title: "The architecture in four decisions" },
  { id: "v1-misses", number: "05", title: "What V1 misses: the narrative layer" },
  { id: "tradeoffs", number: "06", title: "Tradeoffs" },
  { id: "scaling", number: "07", title: "What scaling this would surface" },
  { id: "plan", number: "08", title: "The 90-day plan to ship Primer" },
  { id: "how-built", number: "09", title: "How I built this" },
  { id: "closing", number: "", title: "Closing" },
];

export function Writeup() {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState("top");
  const [tocOpen, setTocOpen] = useState(false);

  // Track active ToC item on scroll
  useEffect(() => {
    if (!scrollEl) return;
    const update = () => {
      const sections = Array.from(scrollEl.querySelectorAll<HTMLElement>("[data-section]"));
      let active = "top";
      const base = scrollEl.getBoundingClientRect().top;
      for (const el of sections) {
        if (el.getBoundingClientRect().top - base < 100) active = el.id;
      }
      setActiveSection(active);
    };
    scrollEl.addEventListener("scroll", update, { passive: true });
    update();
    return () => scrollEl.removeEventListener("scroll", update);
  }, [scrollEl]);

  // Fade-in for pull quotes on scroll into view
  useEffect(() => {
    if (!scrollEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { root: scrollEl, threshold: 0.15 },
    );
    scrollEl.querySelectorAll(".pull-quote").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollEl]);

  return (
    <div className="w-full overflow-y-auto bg-bg" ref={setScrollEl}>
      {/* Floating ToC button — narrow viewports only */}
      <button
        className="xl:hidden fixed bottom-6 left-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3 shadow-md transition-colors hover:text-ink"
        onClick={() => setTocOpen(true)}
        aria-label="Open table of contents"
      >
        <AlignJustify size={16} />
      </button>

      {/* ToC slide-out drawer — narrow viewports only */}
      {tocOpen && (
        <div className="xl:hidden fixed inset-0 z-40" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-ink/20" onClick={() => setTocOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[280px] overflow-y-auto border-r border-line bg-surface p-6 shadow-md">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
                Contents
              </span>
              <button
                onClick={() => setTocOpen(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <WriteupToc
              sections={TOC_SECTIONS}
              activeId={activeSection}
              onNavigate={() => setTocOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)]">
          {/* Left col: sticky ToC */}
          <aside className="hidden xl:block">
            <div className="sticky top-0 pl-4 pr-6 pt-16">
              <WriteupToc sections={TOC_SECTIONS} activeId={activeSection} />
            </div>
          </aside>

          {/* Right col: content — no max-width, fills available space */}
          <article className="w-full px-10 py-16 sm:px-14 xl:px-20 sm:py-20">
            <Hero />

            <TldrPanel />

            <Section id="problem" number="01" claim="The problem we're actually solving">
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
              <PullQuote>
                AEs don't have a dashboards problem. They have a synthesis problem.
              </PullQuote>
              <p>
                Primer takes a position. Every claim grounded in a source. Every
                claim it can't ground, it refuses to make.
              </p>
            </Section>

            <Section id="what-built" number="02" claim="What I built">
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

            <Section id="architectures" number="03" claim="Three architectures I considered">
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

            <Section id="decisions" number="04" claim="The architecture in four decisions">
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
                cite things in the index.
              </p>
              <PullQuote>Hallucinated citations become structurally impossible.</PullQuote>
              <p>
                <b>Validator agent.</b> A second model (Claude Haiku) reads the
                brief against source data. It's picky on purpose.
              </p>
              <p>Real catch from testing:</p>
              <ExampleQuote>
                <p>
                  <em>Brief tried to write:</em> "Adoption dropped 17% in 90
                  days"
                </p>
                <p>
                  <em>Cited <Mono>fact_id</Mono> 41:</em> health_delta of −13
                  (not 17%)
                </p>
                <p>
                  <em>Cited <Mono>fact_id</Mono> 40:</em> sends_trend_pct of
                  −18% (not adoption)
                </p>
                <p>
                  <em>Validator's response:</em> you took two different metrics
                  from two different sources and mashed them into one made-up
                  number. <Mono>fact_id</Mono> 41 says health dropped 13
                  points. <Mono>fact_id</Mono> 40 says sends are down 18%.
                  Neither says "adoption dropped 17%." Pick which one you
                  mean.
                </p>
              </ExampleQuote>
              <p>The brief invented a percentage. The validator caught the math.</p>
              <p>
                <b>Refusal rules.</b> When the brief can't ground a claim, it
                refuses. "No data on this" beats "made-up specifics" on trust.
              </p>
              <VisualMarker src="/images/writeup/validator-warnings.png">
                Three real catches the validator surfaced on this brief. The
                CRITICAL catch (top) flags an invented metric — see decision
                4 above.
              </VisualMarker>
              <VisualMarker src="/images/writeup/citations-vs-hedging.png">
                Left: confident claim with <Mono>·N</Mono> citation chip
                points to a specific <Mono>fact_id</Mono>. Right: inference
                uses hedged voice ("reads like") because no single fact
                supports the full statement.
              </VisualMarker>
            </Section>

            <Section id="v1-misses" number="05" claim="What V1 misses: the narrative layer">
              <p className="italic text-ink-3">
                V1 reads structured facts. It doesn't read the narrative.
              </p>

              <SlidePoint
                headline="The narrative lives outside Salesforce's reach."
                cite={1}
                note={
                  <>
                    <p>
                      <b>Salesforce:</b> rep-typed notes, activities, Chatter,
                      email logs. Gong AI summaries <em>if</em> the sync ran.
                    </p>
                    <p>
                      <b>Gong:</b> full call transcripts. Salesforce only has
                      the summary by default.
                    </p>
                    <p>
                      <b>Catalyst:</b> CSM-authored notes, expansion planning,
                      escalation history. Not in Salesforce.
                    </p>
                    <p>
                      The Gong-to-Salesforce sync depends on rep action or
                      admin filters; in practice many calls don't make it
                      through. Reading directly from Gong avoids the dependency.
                    </p>
                  </>
                }
              >
                Rep notes, call transcripts, and CSM history sit in systems
                Salesforce can only partially synthesize.
              </SlidePoint>

              <SlidePoint
                headline="The cheap fix ships in week 2."
                cite={2}
                note={
                  <>
                    <p>
                      <b>What V1.5 pre-fetches per brief:</b>
                    </p>
                    <p>
                      • 5 most recent Salesforce notes/activities
                      <br />
                      • 5 most recent Catalyst notes
                      <br />
                      • 5 most recent Gong call summaries
                    </p>
                    <p>
                      Reps need the last call, the recent escalation, the
                      thread from two weeks ago. Note #6 from 14 months ago is
                      rarely the unlock.
                    </p>
                  </>
                }
              >
                Pull the last 5 notes, activities, and calls from each source
                on every brief. ~1,500 added tokens, zero new infrastructure.
                Probably the permanent answer for most accounts.
              </SlidePoint>

              <SlidePoint
                headline="Salesforce will ship its own version."
                cite={3}
                note={
                  <>
                    <p>
                      <b>The textbook answer is the modern data stack:</b>{" "}
                      Fivetran ingests every source into Snowflake, dbt models
                      the data, Hightouch syncs the synthesized output back.
                      $1k–$10k+/month at scale, requires a data team, ships
                      value only after the dbt models are in production.
                      Salesforce's Data Cloud + Informatica is the
                      inside-the-walled-garden version.
                    </p>
                    <p>
                      Salesforce acquired Informatica in 2025 because data
                      unification is what bottlenecks Agentforce. They're
                      trying to solve it. It will take years.
                    </p>
                  </>
                }
              >
                Agentforce Account Management is being built for exactly this
                job — bounded by what Salesforce can see, dependent on data
                unification work that's years out. Primer ships at the edge
                today; when the warehouse arrives, MCP servers repoint.
              </SlidePoint>

              <SlidePoint
                headline="Own the layer Salesforce can't see."
                cite={4}
                note={
                  <p>
                    <b>What gets embedded:</b> Catalyst CSM narrative, full
                    Gong transcripts, Primer's own feedback signals. The
                    retrieval layer surfaces relevant chunks per artifact —
                    history blended <em>across</em> systems Salesforce can't
                    consolidate from the inside.
                  </p>
                }
              >
                V2B builds cross-system embeddings + per-artifact retrieval.
                Six weeks at 's scale.
              </SlidePoint>

              <SlidePoint
                headline="Primer learns from how it's used."
                cite={5}
                note={
                  <>
                    <p>
                      <b>The feedback signals Primer accumulates:</b>
                    </p>
                    <p>
                      • Did the rep edit the brief before the call?
                      <br />
                      • Did the rep mark the brief as helpful?
                      <br />
                      • Did the deal advance after the call?
                      <br />
                      • Did any brief content get pasted into Salesforce notes
                      or follow-ups?
                    </p>
                  </>
                }
              >
                Edit rates, helpful flags, paste-back signals,
                deal-advance correlation. The brief sees its own signal
                accumulate per account.
              </SlidePoint>

              <PullQuote>
                Skills are the playbook. History is the memory of every play
                that's been run.
              </PullQuote>

              <p>
                <b>The four-tier roadmap:</b>
              </p>
              <RoadmapGrid />
              <p className="mt-2 text-[15px] italic text-ink-3">
                V1.5 ships before V2A and V2B. V2A and V2B aren't sequential.
              </p>
            </Section>

            <Section id="tradeoffs" number="06" claim="Tradeoffs">
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

            <Section id="scaling" number="07" claim="What scaling this would surface">
              <p className="italic text-ink-3">
                Five things V1 handles that would have to level up at  scale.
              </p>

              <SlidePoint
                headline="Adoption is the long pole, not technology."
                cite={1}
                note={
                  <>
                    <p>
                      <b>Detection vs. prevention.</b> Instrumentation
                      (helpful/not-helpful, edit rates) catches abandonment{" "}
                      <em>after</em> it happens.
                    </p>
                    <p>
                      Preventing it — onboarding, manager calibration,
                      distribution inside Slack and Calendar where reps already
                      are — is the real V2 work.
                    </p>
                  </>
                }
              >
                The brief has to beat 5 minutes of grepping Salesforce, every
                time, or it's abandoned by week 3.
              </SlidePoint>

              <SlidePoint
                headline="Trust is a one-strike system."
                cite={2}
                note={
                  <p>
                    <b>High-stakes facts that need human-in-the-loop</b>{" "}
                    verification before display: champion identity, contract
                    values, recent leadership changes. Everything else stays
                    automated.
                  </p>
                }
              >
                The first time the brief says "your champion is Priya Shah" and
                Priya left three weeks ago, the rep stops using the tool.
              </SlidePoint>

              <SlidePoint
                headline="Model spend isn't where this gets expensive."
                cite={3}
                note={
                  <>
                    <p>
                      <b>Source APIs:</b> Gong transcript pulls and Catalyst
                      event endpoints have per-call pricing.
                    </p>
                    <p>
                      <b>MCP:</b> six stateful services × multi-region HA.
                    </p>
                    <p>
                      <b>Validator:</b> confidence-scored two-pass consistency
                      is months of work.
                    </p>
                  </>
                }
              >
                Sonnet 4.6 runs ~$0.06/brief end-to-end. 120 AEs × 4 briefs ×
                250 days = ~$7K/yr. What scales: source-system API egress, MCP
                HA, validator engineering.
              </SlidePoint>

              <SlidePoint
                headline="Validator severity is the wrong abstraction."
                cite={4}
                note={
                  <>
                    <p>
                      Same brief, four runs, different warning counts — Haiku
                      temperature noise on a judgment call. Determinism isn't
                      the fix; scoring is.
                    </p>
                    <p>
                      Production trust-and-safety stacks (Jigsaw, Hive, OpenAI
                      moderation) all output continuous scores and let the
                      surface decide the threshold.
                    </p>
                  </>
                }
              >
                Binary critical/watch produces different counts on identical
                reruns. Fix is a continuous 0–1 confidence score per warning —
                how production content-moderation actually works.
              </SlidePoint>

              <SlidePoint
                headline="Six MCP servers means six failure points."
                cite={5}
                note={
                  <p>
                    Silent-stale-data is the worst case — brief still generates,
                    just with rotten inputs. Partial generation: detect
                    degradation, flag affected sections in the UI, pass the
                    missing-source list to the validator so it doesn't flag
                    those claims as ungrounded.
                  </p>
                }
              >
                Partial generation has to be first-class: when a source fails,
                the brief flags the degraded section and tells the validator
                not to mark those claims as ungrounded.
              </SlidePoint>

              <p className="mt-2 text-[15px] italic text-ink-3">
                Exa is V1-stubbed. Live wrapper is a half-day swap.
              </p>
            </Section>

            <Section id="plan" number="08" claim="The 90-day plan to ship Primer at ">
              <p className="italic text-ink-3">
                Parallel tracks for the first two weeks — validate the product,
                seed the skills library. The back half prioritizes whichever
                gap V1.5 telemetry surfaces.
              </p>

              <PhaseHeader label="DAYS 0-14" title="Product Validation" />
              <BulletList>
                <li>
                  Wire production OAuth to 's Salesforce, Gong, Catalyst
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

              <PhaseHeader label="DAYS 0-14" title="Context and Memory" />
              <BulletList>
                <li>
                  <b>Map real data, configure MCP per source.</b> Production
                  access lets every Salesforce custom field, Catalyst tag
                  taxonomy, NetSuite billing schema, and Snowflake usage table
                  get a typed path through the MCP layer. -specific
                  internal tools get new MCP wrappers where needed — this is
                  where the architecture earns its flexibility.
                </li>
                <li>
                  Pull 12 months of Gong calls. Find the motions: renewal,
                  expansion, trust-repair, discovery, demo.
                </li>
                <li>
                  Catalog -specific semantics: product taxonomy (Flows,
                  Journeys, Pro tiers), what "expansion-ready" means here,
                  escalation conventions. Skills cite this as ground truth.
                </li>
                <li>
                  Author seed skills per motion, with variants underneath for
                  situation-specific overrides (renewal-with-billing-friction,
                  expansion-after-trust-repair, etc.). RevOps reviews and signs
                  off.
                </li>
                <li>
                  Calibrate objectivity scoring and refusal thresholds against
                  real examples. Feed the validator known good/bad 
                  briefs so the "opinion-vs-grounded-fact" threshold and the
                  "we don't have enough evidence to surface this" cutoff both
                  reflect this domain's data quality, not a generic prior.
                </li>
                <li>
                  Wire external monitoring on key accounts: LinkedIn employment
                  status, Exa-live for press mentions, Gong transcripts scanned
                  for departure language. Defines which signals fire for which
                  motions and at what cadence.
                </li>
                <li>
                  Validate skills against a held-out set of calls before rollout.
                </li>
              </BulletList>

              <PhaseHeader label="DAYS 15-60" title="Ship V1.5 + roll out skills" />
              <BulletList>
                <li>
                  Add last-5 notes/activities/Gong from each source to pre-fetch.
                </li>
                <li>Deploy V1.5 to the broader AE team beyond the initial 3-5.</li>
                <li>
                  Roll out the seed skills and variants. Instrument feedback
                  signals: which skill got invoked, edit rate per skill,
                  helpful/not-helpful rate, drafted-action-sent rate.
                </li>
                <li>
                  Cut what doesn't work. Author additional variants where the
                  data says they're needed.
                </li>
              </BulletList>

              <PhaseHeader
                label="DAYS 60-90"
                title="Highest-leverage next move (priority TBD by V1.5 data)"
              />
              <p>
                The default is to <b>wire the feedback loop:</b> Primer reads
                its own call transcripts back through Gong, compares against
                how the call actually went, proposes skill updates where the
                brief was wrong. RevOps approves before any ships; the library
                starts compounding.
              </p>
              <p>
                Whether that's the right call depends on V1.5 telemetry.
                Alternatives if the data points elsewhere: Slack/Calendar
                distribution (if adoption is the gap), more skill variants (if
                breadth is the gap), V2A Salesforce-side AI MCP wrappers (if
                 has them), or a manager coaching surface (if
                managers ask for visibility into rep edit patterns).
              </p>

              <p>
                <b>Twelve months out:</b> new AE onboarding shifts from "shadow
                three calls and figure it out" to "inherit the accumulated reads
                of every senior rep who came before."
              </p>
            </Section>

            <Section id="how-built" number="09" claim="How I built this">
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
    </div>
  );
}

// ---------- Hero ----------

function Hero() {
  return (
    <header id="top" className="border-b border-line pb-14">
      <h1
        className="font-serif font-medium leading-[1.05] tracking-[-0.02em] text-ink"
        style={{ fontSize: "clamp(3rem, 7vw, 6.5rem)" }}
      >
        The brief that thinks with you.
      </h1>
      <p className="mt-6 font-serif text-[19px] leading-[1.55] text-ink-2">
        <b>Pre-call briefings for enterprise AEs.</b>
      </p>
      <p className="mt-2 max-w-[540px] font-serif text-[18px] italic leading-[1.5] text-ink-3">
        An architecture writeup. Read on for the four decisions, the tradeoffs, and the 90-day plan.
      </p>
      <p className="mt-6 text-[13px] text-ink-3">Nick Ruzicka · April 2026</p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <CTAButton primary onClick={() => null}>
          Open the prototype →
        </CTAButton>
        <CTAButton onClick={() => null}>
          Read the architecture below
          <ChevronDown size={14} className="ml-1.5" />
        </CTAButton>
      </div>
      <hr className="mt-20 border-line" />
    </header>
  );
}

// ---------- TldrPanel ----------

function TldrPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={
        "mt-10 max-w-[720px] overflow-hidden rounded-md border bg-surface-2 transition-colors " +
        (open ? "border-line border-l-[3px] border-l-accent" : "border-line")
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-ink-2 hover:text-ink"
        aria-expanded={open}
      >
        <FileText size={14} className="text-ink-3" />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          TL;DR — 30 seconds
        </span>
        <ChevronDown
          size={14}
          className={
            "ml-auto text-ink-4 transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      <div
        className={
          "grid transition-[grid-template-rows] duration-300 ease-out " +
          (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
        }
      >
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4 pt-2 text-[17px] leading-[1.6] text-ink-2">
            <p>
              Primer is a pre-call briefing tool for AEs. It reads from six
              source systems in parallel via MCP servers, generates an
              opinionated brief grounded in deterministic <Mono>fact_id</Mono>s,
              and runs a validator agent against every claim before display.
            </p>
            <p>
              The architecture skips the multi-quarter data unification project
              and ships value this quarter; when the data layer eventually does
              ship, the MCP servers point at it instead.
            </p>
            <p>
              Watch the validator catch the brief overstating its claims in
              real time when you open the prototype.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Closing ----------

function Closing() {
  return (
    <section id="closing" className="mt-24 border-t border-line pb-16 pt-14">
      <p className="mb-6 text-center font-serif text-[15px] italic text-ink-3">
        Thanks for reading.
      </p>
      <hr className="mx-auto mb-10 w-[60%] border-line" />
      <div className="space-y-6 rounded-lg border border-line bg-surface-2 p-8">
        <FooterRow
          icon={<Rocket size={16} />}
          label="Try the prototype"
          href="#"
          text="primer.[hetzner-url-here]"
        />
        <FooterRow
          icon={<Package size={16} />}
          label="Source code"
          href="https://github.com/nick-ruzicka/primer-"
          text="github.com/nick-ruzicka/primer-"
        />
        <FooterRow
          icon={<Mail size={16} />}
          label="Questions, pushback, follow-ups"
          href="mailto:nick.c.ruzicka@gmail.com"
          text="nick.c.ruzicka@gmail.com"
        />
      </div>
    </section>
  );
}

function FooterRow({
  icon,
  label,
  href,
  text,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <div>
        <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
          {label}
        </p>
        <a href={href} className="text-[15px] text-ink decoration-accent hover:underline">
          {text}
        </a>
      </div>
    </div>
  );
}

// ---------- Section ----------

function Section({
  id,
  number,
  claim,
  children,
}: {
  id?: string;
  number?: string;
  claim: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-section className="mt-32 scroll-mt-20">
      <header className="mb-10 flex items-start gap-4">
        <div className="mt-3 h-10 w-[3px] flex-none rounded-full bg-accent" />
        <div>
          {number && (
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {number}
            </span>
          )}
          <h2 className="font-serif text-[52px] font-medium leading-[1.1] tracking-[-0.025em] text-ink">
            {claim}
          </h2>
        </div>
      </header>
      <div className="space-y-5 text-[17px] leading-[1.7] text-ink-2">{children}</div>
    </section>
  );
}

// ---------- Subhead (used in Section 04 for decisions) ----------

function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-8 font-serif text-[22px] font-medium leading-[1.3] text-ink">
      {children}
    </h3>
  );
}

// ---------- PhaseHeader (used in Section 07 for 90-day plan) ----------

function PhaseHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-4 mt-8 flex items-baseline gap-3 rounded-sm border border-line bg-accent-soft/20 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-2">
        {label}
      </span>
      <span className="text-[15px] font-medium text-ink">{title}</span>
    </div>
  );
}

// ---------- PullQuote ----------

function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="pull-quote my-14 max-w-[75ch] border-l-[3px] border-accent pl-8 font-serif text-[32px] font-normal italic leading-[1.25] text-ink-2">
      {children}
    </blockquote>
  );
}

// ---------- RoadmapGrid ----------

function RoadmapGrid() {
  type Status = "shipped" | "next" | "future";
  const tiers: Array<{
    version: string;
    timing: string;
    body: string;
    status: Status;
  }> = [
    {
      version: "V1",
      timing: "TODAY",
      body: "Structured facts only. Shipped.",
      status: "shipped",
    },
    {
      version: "V1.5",
      timing: "WEEK 2",
      body: "Last 5 notes/activities/calls from each source. No new infra.",
      status: "next",
    },
    {
      version: "V2A",
      timing: "MONTH 2",
      body: "Wrap any Salesforce-side AI compression as MCP tools, if  has them.",
      status: "future",
    },
    {
      version: "V2B",
      timing: "MONTH 3-4",
      body: "Cross-system embedding layer when scale demands it.",
      status: "future",
    },
  ];

  const cardChrome: Record<Status, string> = {
    shipped: "border-good/40 bg-good/[0.04]",
    next: "border-accent/45 bg-accent-soft/15",
    future: "border-line bg-surface-2",
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiers.map((t) => (
        <div
          key={t.version}
          className={`relative rounded-lg border p-5 transition-colors ${cardChrome[t.status]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-serif text-[26px] font-semibold leading-[1] text-ink">
                {t.version}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
                {t.timing}
              </div>
            </div>
            {t.status === "shipped" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-good/40 bg-good/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-good">
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                shipped
              </span>
            )}
            {t.status === "next" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                next
              </span>
            )}
          </div>
          <p className="mt-4 text-[13px] leading-[1.55] text-ink-2">{t.body}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- BulletList ----------

function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">{children}</ul>
  );
}

// ---------- RuleQuote ----------

function RuleQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-2 border-l-2 border-accent pl-5 font-serif text-[17px] italic leading-[1.6] text-ink-2 [&>p]:my-3">
      {children}
    </blockquote>
  );
}

// ---------- ExampleQuote ----------

function ExampleQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-2 rounded-md border border-line bg-surface-sunk/40 px-5 py-4 text-[15px] leading-[1.65] text-ink-2 [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  );
}

// ---------- CodeBlock ----------

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-md border border-line/60 bg-surface-sunk/30 px-3 py-2.5 font-mono text-[12.5px] leading-[1.6] text-ink-2">
      <code>{children}</code>
    </pre>
  );
}

// ---------- VisualMarker ----------

function VisualMarker({
  children,
  aspectRatio = "16:9",
  src,
}: {
  children: ReactNode;
  aspectRatio?: "16:9" | "4:3" | "3:2";
  src?: string;
}) {
  const padMap = { "16:9": "56.25%", "4:3": "75%", "3:2": "66.67%" } as const;
  const altText = typeof children === "string" ? children : "";
  const [imgError, setImgError] = useState(false);
  const showImage = !!src && !imgError;
  return (
    <figure className="my-8">
      <div
        className="relative overflow-hidden rounded-lg border border-line bg-surface-sunk/40 shadow-sm"
        style={{ paddingBottom: padMap[aspectRatio] }}
      >
        {showImage ? (
          <img
            src={src}
            alt={altText}
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
              Visual placeholder
            </span>
            <span className="max-w-[360px] text-center font-serif text-[14px] italic leading-[1.5] text-ink-3">
              {children}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-center text-[12px] italic text-ink-3">
        {children}
      </figcaption>
    </figure>
  );
}

// ---------- CTAButton ----------

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
        "inline-flex items-center rounded-lg font-medium transition-colors " +
        (primary
          ? "bg-accent px-6 py-3 text-[14px] text-accent-ink shadow-sm hover:bg-accent-2"
          : "border border-line bg-surface-2 px-4 py-2 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

// ---------- Mono ----------

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-surface-sunk/80 px-1 py-0.5 font-mono text-[12.5px] text-ink-2">
      {children}
    </code>
  );
}

// ---------- Cite (Chicago-style anchored note) ----------

function Cite({ n, children }: { n: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const tipWidth = 380;
    const margin = 12;

    let left = rect.left + rect.width / 2;
    const half = tipWidth / 2;
    if (left - half < margin) left = margin + half;
    if (left + half > window.innerWidth - margin) {
      left = window.innerWidth - margin - half;
    }

    // Default below the chip; flip above when it would overflow the viewport
    // and the chip has more headroom above than below. Tooltip height is
    // measured after first paint, so this resolves on the position update
    // that runs once the tip is in the DOM.
    const gap = 8;
    let top = rect.bottom + gap;
    const tipHeight = tipRef.current?.offsetHeight ?? 0;
    if (
      tipHeight > 0 &&
      top + tipHeight > window.innerHeight - margin &&
      rect.top - gap > tipHeight
    ) {
      top = rect.top - tipHeight - gap;
    }

    setPos({ left, top });
  }, []);

  // Position must be measured + applied before paint so the flip-above logic
  // doesn't show the tooltip at the wrong spot for one frame on open.
  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (tipRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`cite src-note${open ? " hot" : ""}`}
        aria-expanded={open}
        aria-label={`Note ${n}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cite-dot" />
        <span>{n}</span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="fixed z-50 w-[380px] max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-md border border-line-strong bg-surface px-4 py-3 shadow-md"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
              Note {n}
            </div>
            <div className="space-y-2 text-[13.5px] leading-[1.55] text-ink-2">
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------- SlidePoint (slide-mode entry with anchored note) ----------

function SlidePoint({
  headline,
  cite,
  note,
  children,
}: {
  headline: string;
  cite: number;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-7">
      <div className="mb-1 leading-snug">
        <span className="font-medium text-ink">{headline}</span>
        <Cite n={cite}>{note}</Cite>
      </div>
      <p className="text-[16px] leading-[1.6] text-ink-2">{children}</p>
    </div>
  );
}

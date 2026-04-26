"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlignJustify, ChevronDown, FileText, Mail, Package, Rocket } from "lucide-react";
import { setMode } from "@/lib/store";
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
    let timeout: ReturnType<typeof setTimeout>;
    const update = () => {
      const sections = Array.from(scrollEl.querySelectorAll<HTMLElement>("[data-section]"));
      let active = "top";
      const base = scrollEl.getBoundingClientRect().top;
      for (const el of sections) {
        if (el.getBoundingClientRect().top - base < 100) active = el.id;
      }
      setActiveSection(active);
    };
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(update, 50);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
    };
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
    <div className="w-full snap-y snap-mandatory overflow-y-auto bg-bg" ref={setScrollEl}>
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
          <article className="w-full px-10 sm:px-14 xl:px-20">
            <div className="flex min-h-screen snap-start flex-col justify-center gap-10">
              <Hero />
              <TldrPanel />
            </div>

            <Section id="problem" number="01" claim="The problem we're actually solving">
              <p>
                AEs at enterprise SaaS companies cover dozens of accounts.
                Each account has decision-making structure — champions,
                blockers, exec sponsors, finance contacts — and that
                structure changes constantly across systems no single tool
                watches. The signals that matter (a champion leaving, a
                payables block, a usage cliff, a competitor sniff) live in
                places the rep doesn't think to check. By the time anyone
                notices, the deal is already moving against them.
              </p>
              <div className="my-10 rounded-lg border-l-[3px] border-accent bg-accent-soft/15 px-7 py-6">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-3">
                  The diagnosis
                </p>
                <p className="mb-5 font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">
                  Information overload, not a dashboards problem.
                </p>
                <p className="text-[16px] leading-[1.65] text-ink-2">
                  A rep tracking 40 accounts can't watch every system every
                  day. The rep who forecasts a renewal at 70% likelihood
                  and then loses the deal isn't lazy — they didn't see the
                  new CFO arrived three weeks ago.
                </p>
                <p className="mt-3 font-serif text-[16px] italic leading-[1.65] text-ink-3">
                  Management wasn't aware either.
                </p>
              </div>
              <p>
                Synthesis is the visible part: six tabs, an hour of prep, a
                story the rep assembles in their head under time pressure.
                The deeper problem is what they didn't think to look for.
              </p>
              <p>
                Primer is the start of an account intelligence platform. V1
                ships the pre-call brief: every claim grounded in a source,
                every claim it can't ground refused, the most call-relevant
                account state surfaced in one read.
              </p>
            </Section>

            <Section id="what-built" number="02" claim="What I built">
              <p>
                <b>The brief.</b> Single-page app, one brief per account.
                Three modes (Reading, Workspace, Split) render the same
                brief at different densities. Five sections per brief:
                the read (what the call is about), why this read (the
                evidence), what to do, discovery questions, suggested talk
                track.
              </p>

              <p>
                <b>Two terms before the architecture.</b>
              </p>
              <BulletList>
                <li>
                  <b>Artifact</b>: whatever Primer produces. Today it's the
                  brief. Tomorrow: post-call summaries, drafted outreach,
                  renewal alerts.
                </li>
                <li>
                  <b>Skill file</b>: a markdown contract the LLM has to
                  follow on every call. Rules (<em>"if you can't cite it,
                  you can't claim it"</em>), structure, voice, forbidden
                  behaviors. Not a prompt — a policy.
                </li>
              </BulletList>

              <p>
                Skills are tiered: a master skill that applies to
                everything, an artifact skill per artifact type, variant
                skills underneath (renewal-call, expansion, trust-repair).
                Adding a new artifact is writing a new skill file, not
                retraining a model. The skills are the moat — they encode
                what good looks like for this business, in plain markdown.
              </p>

              <p>
                Calendar-aware brief generation and Slack distribution are
                stretch goals — see the 90-day plan.
              </p>
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
                  <em>Cons:</em> Salesforce can only synthesize what Salesforce
                  can see — but doesn't tell the rep what it's missing. The
                  brief looks complete even when half the signal lives outside.
                </li>
              </BulletList>
              <p>
                <b>Option B: Vector database / semantic search.</b> Embed
                every fact and conversation into a database that lets you
                search by meaning instead of keyword.
              </p>
              <p>
                <em>Pros:</em> handles the long tail. Once you have years of
                Gong calls and multi-quarter Catalyst notes, semantic search
                is the only way to find what matters.
              </p>
              <p>
                <em>Cons:</em> retrieval is fuzzy. The brief might miss a
                specific fact (champion name, exact ARR) because the
                embedding pulled adjacent content. For a brief where every
                claim has to be cited, that's the wrong tradeoff today.
              </p>
              <p>
                Right answer for V3, not V1. V1 doesn't have the corpus
                volume yet.
              </p>
              <p>
                <b>
                  Option C: Read-layer with deterministic pre-fetch via MCP.
                </b>{" "}
                ← chosen
              </p>
              <p>
                Pre-fetch every value through MCP servers into a fact index
                with unique IDs. Citations point at specific{" "}
                <Mono>fact_id</Mono>s. Every fact is structurally
                addressable, citations can't hallucinate, no shadow database
                to maintain. C trades flexibility for predictability —
                exactly the trade you want when the product's job is making
                confident, defensible claims.
              </p>
            </Section>

            <Section id="decisions" number="04" claim="The architecture in four decisions">
              <ArchitectureDiagram />

              <Subhead>1. Read-only, not write-back</Subhead>
              <p>
                Six MCP servers read. Primer never writes back. Drafted
                actions go to whichever system already owns the workflow.
                When RevTech's unified data layer ships, MCP servers repoint.
              </p>

              <Subhead>2. Pre-fetch, not agentic loop</Subhead>
              <p>
                An agentic loop is when the model decides what to do next on
                each step. Pre-fetch is the opposite: pull everything first,
                reason once. Pre-fetch wins for one artifact with a known
                shape — bounded latency, fixed cost. Agentic loops are right
                when artifacts multiply and the model has to decide which
                tools to call.
              </p>

              <Subhead>3. Skills carry the playbook</Subhead>
              <p>
                Covered in section 02. The decision to put business rules in
                markdown skill files (instead of model weights or hard-coded
                heuristics) is what makes the system replicable per
                customer.
              </p>

              <Subhead>4. The validator agent</Subhead>
              <p>
                Three layered defenses: structured <Mono>fact_id</Mono>s the
                LLM cites, a second model that cross-checks every citation,
                and refusal rules when nothing grounds.
              </p>
              <PullQuote>Hallucinated citations become structurally impossible.</PullQuote>
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
                <p>
                  The brief invented a percentage. The validator caught the
                  math.
                </p>
              </ExampleQuote>
              <VisualMarker src="/images/writeup/validator-warnings.png">
                Four real catches the validator surfaced on this brief. The
                CRITICAL catch (top) flags an invented metric — see decision
                4 above. Confidence scores (0.71, 0.63, 0.22) come from the
                decomposed scorer.
              </VisualMarker>
              <p>
                The 17% catch is a synthesis-grounding catch: the brief made
                a claim the data didn't support. The harder catch is{" "}
                <em>awareness</em>-grounding: the brief says "Priya is your
                champion" because Salesforce still says she is, but Priya
                left three weeks ago. The validator can't catch that today
                — the data still technically grounds the claim. V2 extends
                the validator from "is this claim grounded in the data we
                have?" to "is the data we have still current?" External
                monitoring on key contacts: LinkedIn employment lookups,
                Gong transcripts scanned for departure language, Exa for
                press mentions.
              </p>
              <p>
                <b>Decomposed confidence scoring.</b> Each warning gets a
                score across four factors: citation match (60%, mechanical),
                source appropriateness (15%), semantic drift (15%), and
                inference legitimacy (10%). The "adoption dropped 17%" catch
                scored <Mono>0.71</Mono>. Most of the score is mechanical;
                the LLM only handles parts that need judgment. The rep sees
                a graded warning, not a binary alarm.
              </p>
              <figure className="my-8">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-lg border border-line bg-surface-sunk/40 shadow-sm">
                    <img
                      src="/images/writeup/the-read-citations.png"
                      alt="The read paragraph showing dense citation chips"
                      className="block h-auto w-full"
                    />
                  </div>
                  <div className="overflow-hidden rounded-lg border border-line bg-surface-sunk/40 shadow-sm">
                    <img
                      src="/images/writeup/why-this-read-inference.png"
                      alt="Why this read inference paragraph showing fewer citations and interpretive language"
                      className="block h-auto w-full"
                    />
                  </div>
                </div>
              </figure>
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
                Six weeks at Attentive's scale.
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
                Historical data grounds the initial skills. The feedback loop
                keeps them reactive as situations evolve.
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
                <li>Briefs are cached for 15 minutes. Click refresh to regenerate.</li>
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
              <p>
                A neutral summary says "health score is 61." An opinionated
                brief says "the renewal is at risk; the conversation should
                be about what broke operationally, not defending the
                renewal." Higher leverage, higher risk. The validator agent
                and four guardrails make the opinion safe to ship.
              </p>
            </Section>

            <Section id="scaling" number="07" claim="What scaling this would surface">
              <p className="italic text-ink-3">
                Five things V1 handles that would have to level up at Attentive scale.
              </p>

              <SlidePoint
                headline="Trust is a one-strike system."
                cite={1}
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
                headline="Adoption is the long pole, not technology."
                cite={2}
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
                      are — is V2.
                    </p>
                  </>
                }
              >
                The brief has to beat 5 minutes of grepping Salesforce, every
                time, or it's abandoned by week 3. The way you prevent that
                is the Phase 1 validation work: 3-5 reps on real calls,
                structured feedback, cut what doesn't work before scaling.
              </SlidePoint>

              <SlidePoint
                headline="Model spend isn't where this gets expensive."
                cite={3}
                note={
                  <p>
                    A single AE's salary is 20-30x the annual model spend.
                    The model isn't the cost. What scales: source-system API
                    costs (Gong and Catalyst charge per call) and the
                    engineering time to keep the validator getting smarter.
                  </p>
                }
              >
                ~$0.06 per brief end-to-end. At Attentive scale (120 AEs ×
                4 briefs/day × 250 days = 120K briefs/year), that's
                ~$7K/year in Anthropic costs.
              </SlidePoint>

              <SlidePoint
                headline="Six MCP servers means six failure points."
                cite={4}
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

            <Section id="plan" number="08" claim="The 90-day plan to ship Primer at Attentive">
              <p>
                Primer in V1 is a brief. Primer at maturity is a platform
                that watches account state across systems and tells the rep
                what changed and what to do about it. The brief is the
                wedge: it proves the architecture (deterministic citations,
                validator-caught hallucinations, opinionated synthesis) on
                a single high-leverage artifact. From there, the same
                skill stack extends to other artifacts on the same data
                layer — outreach drafts grounded in account state,
                competitive intel as another signal, post-call evaluation
                that asks whether the brief actually prepped the rep,
                churn prediction that fires before the renewal forecast
                does.
              </p>
              <p className="italic text-ink-3">
                The 90-day plan ships V1 well, then lets V1.5 telemetry
                decide which artifact comes next. Parallel tracks for the
                first two weeks — validate the product, seed the skills
                library. The back half adapts based on what the data says.
              </p>

              <PhaseHeader label="DAYS 0-14" title="Product Validation" />
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

              <PhaseHeader label="DAYS 0-14" title="Context and Memory" />
              <BulletList>
                <li>
                  <b>Map real data, configure MCP per source.</b> Production
                  access lets every Salesforce custom field, Catalyst tag
                  taxonomy, NetSuite billing schema, and Snowflake usage table
                  get a typed path through the MCP layer. Attentive-specific
                  internal tools get new MCP wrappers where needed.
                </li>
                <li>
                  Pull 12 months of Gong calls. Find the motions: renewal,
                  expansion, trust-repair, discovery, demo.
                </li>
                <li>
                  Catalog Attentive-specific semantics: product taxonomy (Flows,
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
                  real examples. Feed the validator known good/bad Attentive
                  briefs so the "opinion-vs-grounded-fact" threshold and the
                  "we don't have enough evidence to surface this" cutoff both
                  reflect this domain's data quality, not a generic prior.
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
                <li>
                  Surface account health for renewal calls: usage trending down,
                  champion departures, rising support tickets. Surface market
                  opportunity for expansion: competitor changes, funding/hiring at
                  the account, product momentum. Different motions, different
                  signals.
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
                brief was wrong. RevOps approves before any ships; each skill
                gets richer as it learns what actually worked on calls.
              </p>
              <p>
                Whether that's the right call depends on V1.5 telemetry.
                Alternatives if the data points elsewhere: Slack/Calendar
                distribution (if adoption is the gap), more skill variants (if
                breadth is the gap), V2A Salesforce-side AI MCP wrappers (if
                Attentive has them), or a manager coaching surface (if
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
    <header id="top" className="flex flex-col">
      <h1
        className="font-serif font-medium leading-[1.05] tracking-[-0.02em] text-ink"
        style={{ fontSize: "clamp(3rem, 7vw, 6.5rem)" }}
      >
        The brief that thinks with you.
      </h1>
      <p className="mt-6 font-serif text-[19px] leading-[1.55] text-ink-2">
        <b>Pre-call briefings for Attentive AEs.</b>
      </p>
      <p className="mt-2 max-w-[540px] font-serif text-[18px] italic leading-[1.5] text-ink-3">
        An architecture writeup. Read on for the four decisions, the tradeoffs, and the 90-day plan.
      </p>
      <p className="mt-6 text-[13px] text-ink-3">Nick Ruzicka · April 2026</p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <CTAButton primary onClick={() => setMode("split")}>
          Open the prototype →
        </CTAButton>
        <CTAButton
          onClick={() => {
            document
              .getElementById("problem")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Read the architecture below
          <ChevronDown size={14} className="ml-1.5" />
        </CTAButton>
      </div>
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
          href="https://github.com/nick-ruzicka/primer-attentive"
          text="github.com/nick-ruzicka/primer-attentive"
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
    <section
      id={id}
      data-section
      className="flex min-h-screen snap-start scroll-mt-0 flex-col pt-16 pb-12"
    >
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
      body: "Wrap any Salesforce-side AI compression as MCP tools, if Attentive has them.",
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

// ---------- ArchitectureDiagram ----------

function ArchitectureDiagram() {
  const sources = [
    "Salesforce",
    "Gong",
    "Catalyst",
    "NetSuite",
    "Snowflake",
    "LinkedIn",
  ];
  const SOURCE_X = 24;
  const SOURCE_W = 140;
  const SOURCE_H = 36;
  const SOURCE_GAP = 8;
  const SOURCE_Y0 = 12;

  const FACT_X = 264;
  const FACT_Y = 36;
  const FACT_W = 200;
  const FACT_H = 224;
  const FACT_ENTRY_Y = FACT_Y + FACT_H / 2;

  const WRITER_X = 520;
  const WRITER_Y = 60;
  const WRITER_W = 200;
  const WRITER_H = 120;

  const VAL_X = 520;
  const VAL_Y = 230;
  const VAL_W = 200;
  const VAL_H = 120;

  const BRIEF_X = 780;
  const BRIEF_Y = 210;
  const BRIEF_W = 160;
  const BRIEF_H = 160;

  const labelMono = {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  };
  const sampleMono = {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
  };
  const sampleSerif = {
    fontFamily: "var(--font-serif), Georgia, serif",
    fontSize: 12,
    fontStyle: "italic" as const,
  };

  return (
    <figure className="-mx-2 my-10 sm:mx-0">
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 960 380"
          role="img"
          aria-labelledby="arch-diagram-title"
          className="block w-full min-w-[760px]"
        >
          <title id="arch-diagram-title">
            Primer architecture: six MCP sources fan into a fact index that
            feeds a Sonnet writer; a Haiku validator cross-checks every
            citation before the brief ships.
          </title>

          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={5}
              markerHeight={5}
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                style={{ fill: "var(--color-ink-3)" }}
              />
            </marker>
            <marker
              id="arch-arrow-faint"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={5}
              markerHeight={5}
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                style={{ fill: "var(--color-ink-4)" }}
              />
            </marker>
          </defs>

          {sources.map((name, i) => {
            const y = SOURCE_Y0 + i * (SOURCE_H + SOURCE_GAP);
            return (
              <g key={name}>
                <rect
                  x={SOURCE_X}
                  y={y}
                  width={SOURCE_W}
                  height={SOURCE_H}
                  rx={5}
                  style={{
                    fill: "var(--color-surface-2)",
                    stroke: "var(--color-line)",
                  }}
                  strokeWidth={1}
                />
                <text
                  x={SOURCE_X + SOURCE_W / 2}
                  y={y + SOURCE_H / 2 + 4}
                  textAnchor="middle"
                  style={{
                    fill: "var(--color-ink-2)",
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: 13,
                  }}
                >
                  {name}
                </text>
              </g>
            );
          })}

          <text
            x={SOURCE_X + SOURCE_W / 2}
            y={SOURCE_Y0 + sources.length * (SOURCE_H + SOURCE_GAP) + 12}
            textAnchor="middle"
            style={{ ...labelMono, fill: "var(--color-ink-3)" }}
          >
            via MCP servers · parallel
          </text>

          {sources.map((_, i) => {
            const y = SOURCE_Y0 + i * (SOURCE_H + SOURCE_GAP) + SOURCE_H / 2;
            return (
              <line
                key={i}
                x1={SOURCE_X + SOURCE_W}
                y1={y}
                x2={FACT_X}
                y2={FACT_ENTRY_Y}
                style={{ stroke: "var(--color-line-strong)" }}
                strokeWidth={0.75}
                strokeOpacity={0.7}
              />
            );
          })}

          <g>
            <rect
              x={FACT_X}
              y={FACT_Y}
              width={FACT_W}
              height={FACT_H}
              rx={6}
              style={{
                fill: "var(--color-surface-2)",
                stroke: "var(--color-line)",
              }}
              strokeWidth={1}
            />
            <rect
              x={FACT_X}
              y={FACT_Y}
              width={3}
              height={FACT_H}
              style={{ fill: "var(--color-accent)" }}
            />
            <text
              x={FACT_X + 14}
              y={FACT_Y + 22}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              Fact Index
            </text>
            {[
              { id: "16", body: "catalyst · health 61" },
              { id: "17", body: "gong · Priya engaged" },
              { id: "18", body: "salesforce · ARR $680K" },
              { id: "19", body: "netsuite · due $18K" },
              { id: "20", body: "linkedin · CFO arrived" },
              { id: "…", body: "" },
            ].map((f, i) => (
              <text
                key={i}
                x={FACT_X + 14}
                y={FACT_Y + 56 + i * 28}
                style={{ ...sampleMono, fill: "var(--color-ink-2)" }}
              >
                <tspan style={{ fill: "var(--color-ink-3)" }}>{f.id}</tspan>
                {f.body && ` · ${f.body}`}
              </text>
            ))}
          </g>

          <line
            x1={FACT_X + FACT_W}
            y1={FACT_ENTRY_Y - 20}
            x2={WRITER_X - 4}
            y2={WRITER_Y + WRITER_H / 2}
            style={{ stroke: "var(--color-ink-3)" }}
            strokeWidth={1}
            markerEnd="url(#arch-arrow)"
          />

          <line
            x1={FACT_X + FACT_W}
            y1={FACT_ENTRY_Y + 20}
            x2={VAL_X - 4}
            y2={VAL_Y + VAL_H / 2}
            style={{ stroke: "var(--color-ink-4)" }}
            strokeWidth={1}
            strokeDasharray="3 3"
            markerEnd="url(#arch-arrow-faint)"
          />

          <g>
            <rect
              x={WRITER_X}
              y={WRITER_Y}
              width={WRITER_W}
              height={WRITER_H}
              rx={6}
              style={{
                fill: "var(--color-surface-2)",
                stroke: "var(--color-line)",
              }}
              strokeWidth={1}
            />
            <text
              x={WRITER_X + 14}
              y={WRITER_Y + 22}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              Writer · Sonnet 4.6
            </text>
            <text
              x={WRITER_X + 14}
              y={WRITER_Y + 50}
              style={{ ...sampleSerif, fill: "var(--color-ink-2)" }}
            >
              "Health 74 → 61"
            </text>
            <text
              x={WRITER_X + WRITER_W - 14}
              y={WRITER_Y + 50}
              textAnchor="end"
              style={{ ...sampleMono, fill: "var(--color-accent-2)" }}
            >
              ·16
            </text>
            <text
              x={WRITER_X + 14}
              y={WRITER_Y + 72}
              style={{ ...sampleSerif, fill: "var(--color-ink-2)" }}
            >
              "Priya engaged"
            </text>
            <text
              x={WRITER_X + WRITER_W - 14}
              y={WRITER_Y + 72}
              textAnchor="end"
              style={{ ...sampleMono, fill: "var(--color-accent-2)" }}
            >
              ·17
            </text>
            <text
              x={WRITER_X + 14}
              y={WRITER_Y + WRITER_H - 14}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              guided by skill files
            </text>
          </g>

          <line
            x1={WRITER_X + WRITER_W / 2 + 16}
            y1={WRITER_Y + WRITER_H}
            x2={WRITER_X + WRITER_W / 2 + 16}
            y2={VAL_Y - 4}
            style={{ stroke: "var(--color-ink-3)" }}
            strokeWidth={1}
            markerEnd="url(#arch-arrow)"
          />

          <path
            d={`M ${WRITER_X + WRITER_W / 2 - 16} ${VAL_Y} Q ${WRITER_X + WRITER_W / 2 - 40} ${VAL_Y - 25}, ${WRITER_X + WRITER_W / 2 - 16} ${WRITER_Y + WRITER_H}`}
            fill="none"
            style={{ stroke: "var(--color-ink-4)" }}
            strokeWidth={1}
            strokeDasharray="3 3"
            markerEnd="url(#arch-arrow-faint)"
          />
          <text
            x={WRITER_X + WRITER_W / 2 - 44}
            y={WRITER_Y + WRITER_H + 28}
            textAnchor="end"
            style={{
              ...labelMono,
              fill: "var(--color-ink-4)",
              fontSize: 8.5,
            }}
          >
            rewrite if reject
          </text>

          <g>
            <rect
              x={VAL_X}
              y={VAL_Y}
              width={VAL_W}
              height={VAL_H}
              rx={6}
              style={{
                fill: "var(--color-surface-2)",
                stroke: "var(--color-line)",
              }}
              strokeWidth={1}
            />
            <rect
              x={VAL_X}
              y={VAL_Y}
              width={3}
              height={VAL_H}
              style={{ fill: "var(--color-accent)" }}
            />
            <text
              x={VAL_X + 14}
              y={VAL_Y + 22}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              Validator · Haiku
            </text>
            <text
              x={VAL_X + 14}
              y={VAL_Y + 50}
              style={{ ...sampleMono, fill: "var(--color-ink-2)" }}
            >
              <tspan style={{ fill: "var(--color-accent-2)" }}>·16</tspan>
              <tspan>  0.97</tspan>
              <tspan dx={10} style={{ fill: "var(--color-accent-2)" }}>·17</tspan>
              <tspan>  0.83</tspan>
            </text>
            <text
              x={VAL_X + 14}
              y={VAL_Y + 72}
              style={{ ...sampleMono, fill: "var(--color-ink-2)" }}
            >
              <tspan style={{ fill: "var(--color-accent-2)" }}>·22</tspan>
              <tspan>  0.22</tspan>
              <tspan dx={10} style={{ fill: "var(--color-ink-3)" }}>critical</tspan>
            </text>
            <text
              x={VAL_X + 14}
              y={VAL_Y + VAL_H - 14}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              scores 0–1 across 4 factors
            </text>
          </g>

          <line
            x1={VAL_X + VAL_W}
            y1={VAL_Y + VAL_H / 2}
            x2={BRIEF_X - 4}
            y2={BRIEF_Y + BRIEF_H / 2}
            style={{ stroke: "var(--color-ink-3)" }}
            strokeWidth={1}
            markerEnd="url(#arch-arrow)"
          />

          <g>
            <rect
              x={BRIEF_X}
              y={BRIEF_Y}
              width={BRIEF_W}
              height={BRIEF_H}
              rx={6}
              style={{
                fill: "var(--color-bg)",
                stroke: "var(--color-line-strong)",
              }}
              strokeWidth={1}
            />
            <text
              x={BRIEF_X + 14}
              y={BRIEF_Y + 22}
              style={{ ...labelMono, fill: "var(--color-ink-3)" }}
            >
              Brief
            </text>
            {[
              { y: 38, w: 130, h: 7 },
              { y: 50, w: 100, h: 4 },
              { y: 60, w: 116, h: 4 },
              { y: 70, w: 88, h: 4 },
              { y: 88, w: 124, h: 7 },
              { y: 100, w: 110, h: 4 },
              { y: 110, w: 120, h: 4 },
              { y: 120, w: 80, h: 4 },
              { y: 138, w: 104, h: 7 },
            ].map((row, i) => (
              <rect
                key={i}
                x={BRIEF_X + 14}
                y={BRIEF_Y + row.y}
                width={row.w}
                height={row.h}
                rx={1}
                style={{
                  fill:
                    row.h === 7
                      ? "var(--color-ink-2)"
                      : "var(--color-ink-3)",
                  fillOpacity: row.h === 7 ? 1 : 0.55,
                }}
              />
            ))}
          </g>
        </svg>
      </div>

      <figcaption className="mx-auto mt-4 max-w-[640px] text-center font-serif text-[13px] italic leading-[1.5] text-ink-3">
        Six sources fan into a fact index. The Writer (Sonnet 4.6) drafts
        prose grounded in <Mono>fact_id</Mono>s. The Validator (Haiku)
        cross-checks every citation against the index — and rejects claims
        it can't ground.
      </figcaption>
    </figure>
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

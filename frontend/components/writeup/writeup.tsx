"use client";

/**
 * Mode 4 · Writeup — full-width editorial placeholder. The actual writeup copy
 * lands via 07_WRITEUP_INTEGRATION_SPEC.md (Terminal 4 deliverable).
 */
export function Writeup() {
  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <article className="mx-auto max-w-[680px] px-8 pb-20 pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">Primer · Writeup</p>
        <h1 className="mt-4 font-serif text-[44px] font-medium leading-[1.1] tracking-[-0.015em] text-ink">
          The brief that thinks with you.
        </h1>
        <p className="mt-4 text-[14px] text-ink-3">
          April 2026 · Nick Ruzicka ·  portfolio piece
        </p>

        <Divider />

        <Section title="The problem we're actually solving">
          <p>
            Account executives don't have a dashboards problem. They have a{" "}
            <b>synthesis</b> problem. Six source systems can agree on forty facts
            and still fail to tell you what the call is about. The gap between{" "}
            <em>fact</em> and <em>read</em> is where reps lose an hour a day,
            and where one-off prep guides stop working.
          </p>
          <p>
            Primer is the brief that argues a position. It pre-fetches from six
            systems in parallel, reasons over the result, and writes an
            opinionated four-section read the AE can open ten minutes before a
            call. Every claim is cited. The opinion is named. Contradictions
            get flagged by a second agent that never edits the brief — it only
            watches it.
          </p>
        </Section>

        <Section title="How it's built">
          <p>
            Six MCP servers — one per source system — over stdio. A FastAPI
            orchestrator fans out tool calls with a 5-second per-source
            timeout, streams Account Intelligence back immediately, then calls
            Claude (Opus) with the bundled context to write the brief.
            Claude-Haiku runs a second pass over the output + raw source data
            and flags contradictions via structured JSON.
          </p>
          <p>
            The frontend is Next.js 16 + Tailwind v4, streaming via native
            EventSource. State lives in a module store built on{" "}
            <code>useSyncExternalStore</code> — no state library, no CSS-in-JS,
            no SSE client. Every displayed string traces to a fact id in the
            pre-fetch bundle.
          </p>
        </Section>

        <Section title="What's next">
          <p>
            Primer's natural second lift is the <b>Pattern Analyst</b> —
            running the same tool bundle over twelve months of calls to find
            the shared failure modes across the book. This writeup expands
            once the live demo is running and Terminal 4's integration lands.
          </p>
        </Section>
      </article>
    </div>
  );
}

function Divider() {
  return <hr className="my-8 border-t border-line" />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-[15.5px] leading-[1.7] text-ink-2">
        {children}
      </div>
    </section>
  );
}

"use client";

import { findAccount } from "./fixtures/accounts";
import { getMockForAccount } from "./fixtures/briefs-registry";
import {
  appendCitations,
  markBriefDone,
  pushSourceCited,
  pushWarning,
  resetAccountState,
  revealBriefSection,
  revealIntelligence,
  setBriefFixture,
} from "./store";
import type { ValidationWarning } from "./types";

const API_BASE =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined;

/**
 * Mock mode = live backend URL not configured. Flip to live by setting
 * NEXT_PUBLIC_API_BASE in the shell/env — one-line swap.
 */
export const MOCK_MODE = !API_BASE;

let currentAbort: AbortController | null = null;
let currentEventSource: EventSource | null = null;

export interface LoadOptions {
  refresh?: boolean;
}

export function loadAccount(accountId: string, opts: LoadOptions = {}): void {
  // Tear down whatever's in flight
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }

  const account = findAccount(accountId);
  resetAccountState(account, accountId);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("primer:lastAccount", accountId);
  }

  if (MOCK_MODE) {
    runMockStream(accountId, currentAbort.signal);
  } else {
    runLiveStream(accountId, opts);
  }
}

// ---------- Mock streaming ----------

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });
}

async function runMockStream(
  accountId: string,
  signal: AbortSignal,
): Promise<void> {
  const account = findAccount(accountId);
  const { brief, intelligence } = getMockForAccount(
    accountId,
    account?.full_name ?? account?.name ?? "",
  );
  setBriefFixture(brief);

  try {
    // Phase A (300ms-2400ms): intelligence sections pop in one at a time.
    await sleep(300, signal);
    for (const section of intelligence) {
      if (section.items.length === 0) continue;
      revealIntelligence(section);
      await sleep(280, signal);
    }

    // Phase B (~2400ms-6400ms): brief sections stream, one per ~1s.
    for (const section of brief.sections) {
      await sleep(750, signal);
      revealBriefSection(section.id);
      // Emit source_cited for each citation referenced in this section,
      // and add the matching citation metadata to the store.
      const referenced = new Set<number>();
      const collectRefs = (nodes: { kind: string; n?: number }[]) => {
        for (const node of nodes) {
          if (node.kind === "cite" && typeof node.n === "number")
            referenced.add(node.n);
        }
      };
      if (section.paragraphs)
        for (const p of section.paragraphs) collectRefs(p);
      if (section.actions) {
        for (const a of section.actions) {
          collectRefs(a.body);
          collectRefs(a.rationale);
        }
      }
      if (section.questions) for (const q of section.questions) collectRefs(q);

      const citationsForSection = brief.citations.filter((c) =>
        referenced.has(c.n),
      );
      appendCitations(citationsForSection);
      for (const c of citationsForSection) {
        pushSourceCited({
          citation_number: c.n,
          source: c.source,
          time_ago: c.time_ago,
          evid: c.evid,
        });
        await sleep(40, signal);
      }
    }

    // Phase C (~6500ms): brief complete + validation warnings.
    await sleep(400, signal);
    const warnings = warningsForAccount(accountId);
    for (const w of warnings) {
      pushWarning(w);
      await sleep(600, signal);
    }

    markBriefDone({
      completedAt: Date.now(),
      totalTokens: 1847,
      durationMs: 7_000,
    });
  } catch (err) {
    // aborted — silent
    if (err instanceof Error && err.message === "aborted") return;
    throw err;
  }
}

function warningsForAccount(accountId: string): ValidationWarning[] {
  if (accountId === "ns-beauty") {
    return [
      {
        severity: "critical",
        type: "source_contradiction",
        message:
          "Salesforce says Commit; Catalyst (Watchlist) + NetSuite (past-due AP-blocked) + Gong (competitor 2×) disagree.",
        brief_excerpt: "Salesforce still shows the renewal as Commit",
        sources: ["sf", "catalyst", "netsuite", "gong"],
      },
      {
        severity: "watch",
        type: "stale_data",
        message:
          "Exa web results last refreshed 4h ago — verify external claims before citing.",
        sources: ["exa"],
      },
    ];
  }
  if (accountId === "kindred") {
    return [
      {
        severity: "watch",
        type: "missing_ground",
        message:
          "Exec sponsor 'Mei Chen — CMO' last touch exceeds 90 days; verify still in role before referencing.",
        sources: ["catalyst"],
      },
    ];
  }
  return [];
}

// ---------- Live SSE (swap-ready; not exercised when MOCK_MODE) ----------

function runLiveStream(accountId: string, opts: LoadOptions): void {
  const url = `${API_BASE}/briefing/${accountId}${opts.refresh ? "?refresh=1" : ""}`;
  const es = new EventSource(url);
  currentEventSource = es;

  es.addEventListener("intelligence", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    revealIntelligence(data);
  });

  // TODO(live): brief_chunk → parse + incremental reveal. For phase 5 we
  // trust the backend to emit full-section payloads we can route through
  // revealBriefSection. The token-level marked-based path lives behind a
  // flag we can flip when the backend-team payload shape is confirmed.

  es.addEventListener("source_cited", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    pushSourceCited(data);
  });

  es.addEventListener("validation_warning", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    pushWarning(data);
  });

  es.addEventListener("done", (e) => {
    const meta = JSON.parse((e as MessageEvent).data);
    markBriefDone({
      completedAt: Date.now(),
      totalTokens: meta.total_tokens,
      durationMs: meta.duration_ms,
    });
    es.close();
    currentEventSource = null;
  });

  es.addEventListener("error", () => {
    pushWarning({
      severity: "critical",
      type: "missing_ground",
      message: "Connection to briefing stream lost. Refresh to retry.",
    });
    es.close();
    currentEventSource = null;
  });
}

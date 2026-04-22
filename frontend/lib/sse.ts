"use client";

import { findAccount } from "./fixtures/accounts";
import { getMockForAccount } from "./fixtures/briefs-registry";
import type { BriefFixture } from "./fixtures/northstar-beauty-brief";
import { parseStreamingBrief } from "./live-brief-parser";
import {
  appendCitations,
  getState,
  markBriefDone,
  pushSourceCited,
  pushWarning,
  resetAccountState,
  revealBriefSection,
  revealIntelligence,
  setBriefFixture,
  updateLiveBriefFixture,
} from "./store";
import type {
  IntelligenceItem,
  IntelligenceSection,
  IntelSectionId,
  ValidationWarning,
} from "./types";

const API_BASE =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined;

/**
 * Mock mode off when NEXT_PUBLIC_API_BASE is truthy. Setting it to an absolute
 * URL (http://localhost:8000) uses cross-origin directly; empty string keeps
 * the old same-origin-via-Next-rewrite path, which we leave wired in
 * next.config.ts as a fallback if CORS ever blocks us.
 */
export const MOCK_MODE = !API_BASE;

let currentAbort: AbortController | null = null;
let currentEventSource: EventSource | null = null;

export interface LoadOptions {
  refresh?: boolean;
}

export function loadAccount(accountId: string, opts: LoadOptions = {}): void {
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
    await sleep(300, signal);
    for (const section of intelligence) {
      if (section.items.length === 0) continue;
      revealIntelligence(section);
      await sleep(280, signal);
    }

    for (const section of brief.sections) {
      await sleep(750, signal);
      revealBriefSection(section.id);
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

// ---------- Live SSE ----------

/**
 * Buffer for brief_chunk deltas; mutated as chunks arrive. Parsed into sections
 * on each update and any newly-complete section is pushed to the store.
 */
let liveBriefBuffer = "";
let liveBriefFixture: BriefFixture | null = null;
let liveRevealedIds = new Set<string>();

function resetLiveBriefBuffer(accountId: string) {
  liveBriefBuffer = "";
  liveRevealedIds = new Set();
  liveBriefFixture = {
    account_id: accountId,
    // Live confidence isn't currently part of the SSE contract; show a
    // neutral placeholder until the backend emits it in `done` or a
    // dedicated event. Historical fixtures (mock) retain their exact value.
    confidence: 78,
    confidence_label: "likely",
    sections: [],
    citations: [],
  };
  setBriefFixture(liveBriefFixture);
}

function handleBriefChunk(delta: string) {
  liveBriefBuffer += delta;
  const { complete } = parseStreamingBrief(liveBriefBuffer);
  if (!liveBriefFixture) return;

  let mutated = false;
  for (const section of complete) {
    const idx = liveBriefFixture.sections.findIndex((s) => s.id === section.id);
    if (idx < 0) {
      liveBriefFixture.sections.push(section);
      mutated = true;
    } else {
      liveBriefFixture.sections[idx] = section;
    }
  }

  if (mutated) {
    // Keep sections sorted so the rendered order matches spec-01/02/03/04.
    liveBriefFixture = {
      ...liveBriefFixture,
      sections: [...liveBriefFixture.sections].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    };
    updateLiveBriefFixture(liveBriefFixture);
  }

  // Reveal any newly-complete section. Safe to call each chunk — the store
  // setter flips the flag idempotently.
  for (const section of complete) {
    if (!liveRevealedIds.has(section.id)) {
      liveRevealedIds.add(section.id);
      revealBriefSection(section.id);
    }
  }
}

const VALID_SECTIONS: Set<IntelSectionId> = new Set([
  "relationship",
  "commercial",
  "product",
  "conversations",
  "portfolio",
  "external",
]);

/**
 * Adapt the backend `intelligence` payload into our IntelligenceSection shape.
 * Backend format is mostly compatible but lacks `flagPill` / `action` / `time`
 * and rolls web content into `value`/`sub` rather than `web.{title,snippet}`.
 */
function adaptIntelligenceEvent(data: unknown): IntelligenceSection | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  const id = (payload.id ?? payload.section) as string | undefined;
  if (!id) return null;
  const normalizedId = id.replace("_usage", "") as IntelSectionId;
  if (!VALID_SECTIONS.has(normalizedId)) return null;

  const items = Array.isArray(payload.items)
    ? (payload.items as Record<string, unknown>[])
    : [];
  const adaptedItems: IntelligenceItem[] = items.map((raw) => {
    const flag = (raw.flag as IntelligenceItem["flag"]) ?? null;
    const flagPill = raw.flagPill
      ? (raw.flagPill as string)
      : flag === "critical"
        ? "Critical"
        : flag === "warn"
          ? "Watch"
          : undefined;
    const source = (raw.source as IntelligenceItem["source"]) ?? "internal";
    const item: IntelligenceItem = {
      evid: String(
        raw.evid ?? `${id}-${Math.random().toString(36).slice(2, 8)}`,
      ),
      source,
      label: String(raw.label ?? ""),
      value: raw.value ? String(raw.value) : undefined,
      sub: raw.sub ? String(raw.sub) : undefined,
      flag,
      flagPill,
      time: raw.time ? String(raw.time) : undefined,
      action: raw.action ? String(raw.action) : undefined,
    };
    // External signals: synthesize a `web` block from meta + value/sub
    if (
      normalizedId === "external" &&
      raw.meta &&
      typeof raw.meta === "object"
    ) {
      const meta = raw.meta as Record<string, unknown>;
      item.web = {
        title: item.value ?? "",
        snippet: item.sub ?? "",
      };
      item.fav =
        typeof meta.origin === "string"
          ? String(meta.origin).slice(0, 2).toUpperCase()
          : "W";
      // the sub-ttle used by the pill row becomes source + reliability
      item.sub = [
        meta.origin,
        meta.reliability && `reliability: ${meta.reliability}`,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return item;
  });

  return {
    id: normalizedId,
    title: String(payload.title ?? ""),
    desc: String(payload.desc ?? ""),
    items: adaptedItems,
  };
}

function runLiveStream(accountId: string, opts: LoadOptions): void {
  resetLiveBriefBuffer(accountId);

  const url = `${API_BASE}/briefing/${accountId}${opts.refresh ? "?refresh=1" : ""}`;
  const es = new EventSource(url);
  currentEventSource = es;

  es.addEventListener("intelligence", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const section = adaptIntelligenceEvent(data);
      if (section) revealIntelligence(section);
    } catch (err) {
      console.error("[primer] intelligence parse error", err);
    }
  });

  es.addEventListener("brief_chunk", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      if (typeof data.delta === "string") handleBriefChunk(data.delta);
    } catch (err) {
      console.error("[primer] brief_chunk parse error", err);
    }
  });

  es.addEventListener("source_cited", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      pushSourceCited(data);
      if (data.citation_number != null && data.source && data.evid) {
        appendCitations([
          {
            n: Number(data.citation_number),
            source: data.source,
            evid: String(data.evid),
            label: String(data.label ?? ""),
            time_ago: String(data.time_ago ?? ""),
          },
        ]);
      }
    } catch (err) {
      console.error("[primer] source_cited parse error", err);
    }
  });

  es.addEventListener("validation_warning", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      pushWarning(data);
    } catch (err) {
      console.error("[primer] validation_warning parse error", err);
    }
  });

  es.addEventListener("done", (e) => {
    try {
      const meta = JSON.parse((e as MessageEvent).data);
      markBriefDone({
        completedAt: Date.now(),
        totalTokens: meta.total_tokens ?? null,
        durationMs: meta.duration_ms ?? null,
      });
      // If the live brief produced nothing (e.g. upstream agent error), fall
      // back to the mock so the demo still shows what a finished brief looks
      // like. A validation_warning already notifies the operator.
      const state = getState();
      const hasAnyRevealed = Object.values(state.brief.revealed).some(Boolean);
      if (!hasAnyRevealed) {
        const mock = getMockForAccount(
          accountId,
          findAccount(accountId)?.full_name ??
            findAccount(accountId)?.name ??
            "",
        );
        setBriefFixture(mock.brief);
        for (const section of mock.brief.sections) {
          revealBriefSection(section.id);
        }
        appendCitations(mock.brief.citations);
        pushWarning({
          severity: "watch",
          type: "missing_ground",
          message:
            "Brief generation failed upstream — showing mock brief so the demo remains coherent.",
        });
      }
    } catch (err) {
      console.error("[primer] done parse error", err);
    }
    es.close();
    currentEventSource = null;
  });

  es.addEventListener("error", () => {
    // Only act if the stream is actually closed; EventSource fires `error` on
    // transient disconnects too.
    if (es.readyState === EventSource.CLOSED) {
      pushWarning({
        severity: "critical",
        type: "missing_ground",
        message: "Connection to briefing stream lost. Refresh to retry.",
      });
    }
  });
}

"use client";

import { DEFAULT_BRIEF_META } from "./fixtures/brief-meta";
import { getMockForAccount } from "./fixtures/briefs-registry";
import type { BriefFixture } from "./fixtures/northstar-beauty-brief";
import { parseStreamingBrief } from "./live-brief-parser";
import {
  appendCitations,
  findAccountInStore,
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
  CitationMeta,
  IntelligenceItem,
  IntelligenceSection,
  IntelSectionId,
  ValidationWarning,
} from "./types";
import {
  validateBriefChunk,
  validateCitation,
  validateDoneEvent,
  validateIntelligenceEvent,
  validateWarning,
} from "./validators";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

/**
 * Mock mode off when NEXT_PUBLIC_API_BASE is truthy. Setting it to an absolute
 * URL (http://localhost:8000) uses cross-origin directly; empty string keeps
 * the old same-origin-via-Next-rewrite path, which we leave wired in
 * next.config.ts as a fallback if CORS ever blocks us.
 */
export const MOCK_MODE = !API_BASE;

let currentAbort: AbortController | null = null;
let currentEventSource: EventSource | null = null;
let currentAccountId: string | null = null;
let currentStreamId: string | null = null;  // Unique ID for each stream to prevent race conditions
let currentTraceId: string | null = null;  // Trace ID for debugging and observability

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

  // Generate unique IDs for this stream
  currentStreamId = `${accountId}_${Date.now()}_${Math.random()}`;
  currentTraceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  currentAccountId = accountId;

  const account = findAccountInStore(accountId);
  resetAccountState(account, accountId);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("primer:lastAccount", accountId);
    // Store trace ID for debugging (users can share in bug reports)
    window.localStorage.setItem("primer:lastTraceId", currentTraceId);
  }

  if (MOCK_MODE) {
    runMockStream(accountId, currentAbort.signal, currentStreamId);
  } else {
    runLiveStream(accountId, opts, currentStreamId, currentTraceId);
  }
}

// ---------- Mock streaming ----------

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runMockStream(
  accountId: string,
  signal: AbortSignal,
  streamId: string,
): Promise<void> {
  const activeStreamId = streamId;
  const account = findAccountInStore(accountId);
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
        pushSourceCited(c);
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
    confidence: DEFAULT_BRIEF_META.confidence,
    sections: [],
    citations: [],
  };
  setBriefFixture(liveBriefFixture);
}

function handleBriefChunk(delta: string) {
  liveBriefBuffer += delta;
  const { complete } = parseStreamingBrief(liveBriefBuffer);
  if (!liveBriefFixture) return;

  let changed = false;
  for (const section of complete) {
    const idx = liveBriefFixture.sections.findIndex((s) => s.id === section.id);
    if (idx < 0) {
      liveBriefFixture.sections.push(section);
      changed = true;
    } else {
      // Any late edit to an already-streamed section (citation added,
      // paragraph appended) needs to flow back to the store too.
      const prev = liveBriefFixture.sections[idx];
      if (prev !== section) {
        liveBriefFixture.sections[idx] = section;
        changed = true;
      }
    }
  }

  if (changed) {
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

function runLiveStream(accountId: string, opts: LoadOptions, streamId: string, traceId: string): void {
  resetLiveBriefBuffer(accountId);

  const params = new URLSearchParams();
  if (opts.refresh) params.set("refresh", "1");
  params.set("trace_id", traceId);
  const queryStr = params.toString();
  const url = `${API_BASE}/briefing/${accountId}${queryStr ? `?${queryStr}` : ""}`;
  const es = new EventSource(url);
  currentEventSource = es;

  // Capture streamId to validate all events belong to this stream
  const activeStreamId = streamId;

  // Store handler references so we can remove them later and prevent memory leaks
  const handlers: Record<string, EventListener> = {};

  es.addEventListener("intelligence", (e) => {
    if (currentStreamId !== activeStreamId) return;  // Ignore if stream switched
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const section = validateIntelligenceEvent(data);
      if (!section) {
        pushWarning({
          severity: "critical",
          type: "missing_ground",
          message: "Intelligence data malformed — skipping section",
        });
        return;
      }
      const adapted = adaptIntelligenceEvent(section);
      if (adapted) revealIntelligence(adapted);
    } catch (err) {
      console.error("[primer] intelligence parse error", err);
      pushWarning({
        severity: "critical",
        type: "missing_ground",
        message: `Intelligence parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  es.addEventListener("brief_chunk", (e) => {
    if (currentStreamId !== activeStreamId) return;  // Ignore if stream switched
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const delta = validateBriefChunk(data);
      if (!delta) {
        console.warn("[primer] brief_chunk validation failed", data);
        return;
      }
      handleBriefChunk(delta);
    } catch (err) {
      console.error("[primer] brief_chunk parse error", err);
    }
  });

  es.addEventListener("source_cited", (e) => {
    if (currentStreamId !== activeStreamId) return;  // Ignore if stream switched
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const validatedData = validateCitation(data);
      if (!validatedData) {
        pushWarning({
          severity: "critical",
          type: "missing_ground",
          message: "Citation data malformed — skipping",
        });
        return;
      }
      // Authoritative shape — backend emits the discriminated-union payload.
      const base = {
        n: data.citation_number,
        evid: data.evid,
        intel_evid: data.intel_evid ?? null,
        source_system: data.source_system,
        source_module: data.source_module ?? undefined,
        retrieved_at: data.retrieved_at ?? new Date().toISOString(),
        data_as_of: data.data_as_of ?? undefined,
        time_ago: data.time_ago ?? "",
      };
      let citation: CitationMeta;
      if (data.provenance === "surfaced") {
        citation = {
          ...base,
          provenance: "surfaced",
          snippet: data.snippet ?? "",
          url: data.url ?? undefined,
        };
      } else {
        // "raw" | "scored" — default to "raw" if provenance missing
        citation = {
          ...base,
          provenance: (data.provenance as "raw" | "scored") ?? "raw",
          field: data.field ?? "",
          value_display: data.value_display ?? "",
        };
      }
      pushSourceCited(citation);
      appendCitations([citation]);
    } catch (err) {
      console.error("[primer] source_cited parse error", err);
    }
  });

  es.addEventListener("validation_warning", (e) => {
    if (currentStreamId !== activeStreamId) return;
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const warning = validateWarning(data);
      if (!warning) {
        console.warn("[primer] validation_warning validation failed", data);
        return;
      }
      pushWarning(warning);
    } catch (err) {
      console.error("[primer] validation_warning parse error", err);
    }
  });

  // Create a cleanup function to prevent memory leaks from lingering event listeners
  const cleanup = () => {
    es.close();
    currentEventSource = null;
    // Note: Due to the complexity of removing inline event listeners in browser
    // EventSource API, we rely on the closed EventSource being garbage collected.
    // The activeStreamId check in each handler prevents stale events from being processed.
  };

  es.addEventListener("done", (e) => {
    if (currentStreamId !== activeStreamId) return;
    try {
      const data = JSON.parse((e as MessageEvent).data);
      const meta = validateDoneEvent(data);
      if (!meta) {
        console.warn("[primer] done event validation failed", data);
        cleanup();
        return;
      }
      markBriefDone({
        completedAt: Date.now(),
        totalTokens: meta.total_tokens ?? null,
        durationMs: meta.duration_ms ?? null,
      });
      // If the live brief produced nothing (e.g. upstream agent error),
      // surface that explicitly. Showing a mock brief in its place would
      // hand a sales rep fake content right before a customer call.
      const state = getState();
      const hasAnyRevealed = Object.values(state.brief.revealed).some(Boolean);
      if (!hasAnyRevealed) {
        pushWarning({
          severity: "critical",
          type: "missing_ground",
          message:
            "Brief generation failed upstream. No content available — refresh to retry.",
        });
      }
    } catch (err) {
      console.error("[primer] done parse error", err);
    }
    cleanup();
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
      cleanup();
    }
  });
}

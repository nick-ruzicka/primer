"use client";

import { useSyncExternalStore } from "react";
import type { Density, VerifyIntensity } from "@/components/tweaks-panel";
import type {
  BriefFixture,
  CitationMeta,
} from "./fixtures/northstar-beauty-brief";
import type {
  Account,
  AccountGroup,
  IntelligenceSection,
  IntelligenceState,
  SourceCited,
  ValidationWarning,
  ViewMode,
} from "./types";

/**
 * Per-section progressive reveal flags for the brief. A section flips to `true`
 * once the mock/live stream has fully rendered it. Phase 5 does per-section
 * reveal rather than per-token; phase 7 can refine to word-level if needed.
 */
export interface BriefStreamState {
  fixture: BriefFixture | null;
  revealed: Record<"01" | "02" | "03" | "04", boolean>;
  complete: boolean;
}

export interface GenerationMeta {
  startedAt: number | null;
  completedAt: number | null;
  totalTokens: number | null;
  durationMs: number | null;
}

export interface StoreState {
  // Account data
  accounts: Account[];
  accountGroups: AccountGroup[];
  standalone: Account[];
  activeAccountId: string | null;
  activeAccount: Account | null;

  // Progressive intelligence per section
  intelligence: IntelligenceState;

  // Progressive brief
  brief: BriefStreamState;
  citations: CitationMeta[];
  sourceCitedEvents: SourceCited[];
  warnings: ValidationWarning[];
  generationMeta: GenerationMeta;

  // UI state
  mode: ViewMode;
  theme: "light" | "dark";
  density: Density;
  verifyIntensity: VerifyIntensity;
  tweaksOpen: boolean;
  intelligencePanelOpen: boolean;
  hoveredEvid: string | null;
}

const EMPTY_INTELLIGENCE: IntelligenceState = {
  relationship: null,
  commercial: null,
  product: null,
  conversations: null,
  portfolio: null,
  external: null,
};

const EMPTY_BRIEF: BriefStreamState = {
  fixture: null,
  revealed: { "01": false, "02": false, "03": false, "04": false },
  complete: false,
};

const INITIAL_STATE: StoreState = {
  accounts: [],
  accountGroups: [],
  standalone: [],
  activeAccountId: null,
  activeAccount: null,
  intelligence: EMPTY_INTELLIGENCE,
  brief: EMPTY_BRIEF,
  citations: [],
  sourceCitedEvents: [],
  warnings: [],
  generationMeta: {
    startedAt: null,
    completedAt: null,
    totalTokens: null,
    durationMs: null,
  },
  mode: "split",
  theme: "dark",
  density: "comfortable",
  verifyIntensity: "subtle",
  tweaksOpen: false,
  intelligencePanelOpen: false,
  hoveredEvid: null,
};

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();

export function getState(): StoreState {
  return state;
}

export function setState(updater: (prev: StoreState) => StoreState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Selector hook. Uses strict-equality by default; the store stays coarse-grained
 * enough that this is fine for the scope we're rendering.
 */
export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(INITIAL_STATE),
  );
}

// ---------- action helpers (used by sse.ts and page.tsx) ----------

/**
 * Look up an account by id across accountGroups.brands + standalone. Returns
 * null if the account list hasn't been populated yet (e.g. before /api/accounts
 * resolves on initial load).
 */
export function findAccountInStore(id: string): Account | null {
  for (const g of state.accountGroups) {
    const match = g.brands.find((b) => b.id === id);
    if (match) return match;
  }
  return state.standalone.find((a) => a.id === id) ?? null;
}

export function resetAccountState(
  account: Account | null,
  accountId: string | null,
) {
  setState((s) => ({
    ...s,
    activeAccountId: accountId,
    activeAccount: account,
    intelligence: EMPTY_INTELLIGENCE,
    brief: { ...EMPTY_BRIEF },
    citations: [],
    sourceCitedEvents: [],
    warnings: [],
    generationMeta: {
      startedAt: Date.now(),
      completedAt: null,
      totalTokens: null,
      durationMs: null,
    },
  }));
}

export function revealIntelligence(section: IntelligenceSection) {
  setState((s) => ({
    ...s,
    intelligence: { ...s.intelligence, [section.id]: section },
  }));
}

export function setBriefFixture(fixture: BriefFixture) {
  setState((s) => ({
    ...s,
    brief: {
      ...EMPTY_BRIEF,
      fixture,
      revealed: { "01": false, "02": false, "03": false, "04": false },
    },
    citations: [],
  }));
}

/**
 * Replace the fixture's sections without resetting per-section reveal flags.
 * Used by the live brief streamer to swap in refined section structures as
 * more of the markdown arrives, without re-playing the reveal animation.
 */
export function updateLiveBriefFixture(fixture: BriefFixture) {
  setState((s) => ({
    ...s,
    brief: { ...s.brief, fixture },
  }));
}

export function revealBriefSection(sectionId: "01" | "02" | "03" | "04") {
  setState((s) => ({
    ...s,
    brief: { ...s.brief, revealed: { ...s.brief.revealed, [sectionId]: true } },
  }));
}

export function appendCitations(toAdd: CitationMeta[]) {
  setState((s) => {
    const existing = new Set(s.citations.map((c) => c.n));
    const merged = [...s.citations];
    for (const c of toAdd) if (!existing.has(c.n)) merged.push(c);
    return { ...s, citations: merged };
  });
}

export function pushSourceCited(event: SourceCited) {
  setState((s) => ({
    ...s,
    sourceCitedEvents: [...s.sourceCitedEvents, event],
  }));
}

export function pushWarning(warning: ValidationWarning) {
  setState((s) => ({ ...s, warnings: [...s.warnings, warning] }));
}

export function markBriefDone(meta: Partial<GenerationMeta>) {
  setState((s) => ({
    ...s,
    brief: { ...s.brief, complete: true },
    generationMeta: { ...s.generationMeta, ...meta },
  }));
}

export function setMode(mode: ViewMode) {
  setState((s) => ({ ...s, mode }));
}

export function setTheme(theme: "light" | "dark") {
  setState((s) => ({ ...s, theme }));
}

export function setDensity(density: Density) {
  setState((s) => ({ ...s, density }));
}

export function setVerify(v: VerifyIntensity) {
  setState((s) => ({ ...s, verifyIntensity: v }));
}

export function setTweaksOpen(open: boolean) {
  setState((s) => ({ ...s, tweaksOpen: open }));
}

export function setIntelligencePanelOpen(open: boolean) {
  setState((s) => ({ ...s, intelligencePanelOpen: open }));
}

export function setHoveredEvid(evid: string | null) {
  setState((s) => ({ ...s, hoveredEvid: evid }));
}

export function setAccounts(
  accountGroups: AccountGroup[],
  standalone: Account[],
) {
  const flat = [...accountGroups.flatMap((g) => g.brands), ...standalone];
  setState((s) => ({ ...s, accountGroups, standalone, accounts: flat }));
}

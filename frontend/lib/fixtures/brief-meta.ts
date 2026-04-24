import type { SourceId } from "../types";

/**
 * Confidence-strip + source-status fixture. Matches the reference briefing at the
 * moment screenshots were taken. Real data ships via the orchestrator's `done`
 * event + per-source status once the backend is wired.
 */
export interface SourceStatus {
  id: SourceId;
  label: string;
  status: "ok" | "stale" | "pending";
  lastSync: string;
  count: number;
}

export const DEFAULT_SOURCE_STATUSES: SourceStatus[] = [
  {
    id: "sf",
    label: "Salesforce",
    status: "ok",
    lastSync: "2m ago",
    count: 47,
  },
  {
    id: "catalyst",
    label: "Catalyst",
    status: "ok",
    lastSync: "5m ago",
    count: 12,
  },
  {
    id: "netsuite",
    label: "NetSuite",
    status: "ok",
    lastSync: "1m ago",
    count: 9,
  },
  {
    id: "snowflake",
    label: "Snowflake",
    status: "ok",
    lastSync: "8m ago",
    count: 3,
  },
  { id: "gong", label: "Gong", status: "ok", lastSync: "11m ago", count: 6 },
  {
    id: "exa",
    label: "Exa (web)",
    status: "stale",
    lastSync: "4h ago",
    count: 14,
  },
];

export const DEFAULT_BRIEF_META = {
  confidence: 84,
  generatedAgo: "6 min ago",
  staleCount: 1,
  intelligenceItemCount: 24,
} as const;

/**
 * The rep whose shoes the demo is stepping into — matches the canonical seed
 * owner on /api/accounts (every account is owned by Morgan Yu so the demo
 * reads as "your accounts"). Revisit if/when real auth lands.
 */
export const CURRENT_USER = {
  initials: "MY",
  name: "Morgan Yu",
  role: "Senior AE",
} as const;

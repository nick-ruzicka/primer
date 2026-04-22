import type { IntelligenceItem, IntelligenceSection } from "../types";

const RELATIONSHIP: IntelligenceItem[] = [
  {
    evid: "kp-dm",
    flag: "warn",
    source: "sf",
    label: "Decision maker",
    flagPill: "New — 2m",
    value: "Jamie Park — VP Marketing",
    sub: "Replaced Rowan Sato (Feb). <em>Two months in seat; still ramping on the stack.</em>",
    time: "3m ago",
  },
  {
    evid: "kp-exec",
    flag: "critical",
    source: "catalyst",
    label: "Executive sponsor",
    flagPill: "Cold 127d",
    value: "Mei Chen — CMO",
    sub: "<b>Last executive touch: Dec 15.</b> Relationship has gone cold since the DM change.",
    time: "5m ago",
  },
  {
    evid: "kp-health",
    flag: "critical",
    source: "catalyst",
    label: "Relationship health",
    flagPill: "At risk",
    value: "48 — at risk",
    sub: "Was 81 in January. Dropped 33 points in two months, tracking the DM transition.",
    time: "5m ago",
  },
];

const COMMERCIAL: IntelligenceItem[] = [
  {
    evid: "kp-arr",
    flag: null,
    source: "sf",
    label: "Current ARR",
    value: "$145,000",
    sub: "Plan · Flows Pro · 5 of 8 seats used.",
    time: "3m ago",
  },
  {
    evid: "kp-forecast",
    flag: "critical",
    source: "catalyst",
    label: "Renewal forecast",
    flagPill: "At risk",
    value: "Jun 9, 2026 · At Risk",
    sub: "48 days out. Catalyst forecast moved from Commit to At Risk on Mar 12.",
    time: "5m ago",
    action: "Open in Catalyst ↗",
  },
  {
    evid: "kp-billing",
    flag: null,
    source: "netsuite",
    label: "Billing",
    value: "Current · $0 past due",
    sub: "No billing friction. This is an adoption problem, not a finance problem.",
    time: "1m ago",
  },
];

const PRODUCT: IntelligenceItem[] = [
  {
    evid: "kp-sends",
    flag: "critical",
    source: "snowflake",
    label: "Sends (30d)",
    flagPill: "↓ 41%",
    value: "620k · ↓ 41%",
    sub: "Collapse started the week Jamie took over. Has not recovered.",
    time: "8m ago",
  },
  {
    evid: "kp-flows",
    flag: "warn",
    source: "snowflake",
    label: "Flows active",
    flagPill: "Watch",
    value: "4 of 12",
    sub: "Eight flows paused since Feb — <b>three recoverable in < 1 week</b> based on the last audit.",
    time: "8m ago",
  },
];

const CONVERSATIONS: IntelligenceItem[] = [
  {
    evid: "kp-call",
    flag: "critical",
    source: "gong",
    label: "Apr 14 check-in",
    flagPill: "Watch",
    value: "Consolidation mention",
    sub: "Jamie: <em>\"evaluating whether we're using it to its full potential — otherwise we'll consolidate\"</em>. Spoken at 00:24:08.",
    time: "7m ago",
    action: "Open in Gong ↗",
  },
];

const EXTERNAL: IntelligenceItem[] = [
  {
    evid: "kp-li",
    flag: null,
    source: "exa",
    label: "LinkedIn",
    fav: "in",
    verify: true,
    web: {
      title: "Jamie Park — post on stack consolidation",
      snippet:
        '<em>"First 90-day read: too many tools doing 70% of their job, not enough doing 100%. Looking to <mark>consolidate the marketing stack</mark> this quarter."</em>',
    },
    sub: "linkedin.com · Apr 13 · 9 days ago",
  },
];

export const KINDRED_PET_INTELLIGENCE: IntelligenceSection[] = [
  {
    id: "relationship",
    title: "Relationship",
    desc: "New DM, cold sponsor",
    items: RELATIONSHIP,
  },
  {
    id: "commercial",
    title: "Commercial",
    desc: "Renewal + billing",
    items: COMMERCIAL,
  },
  {
    id: "product",
    title: "Product & usage",
    desc: "Adoption collapsed",
    items: PRODUCT,
  },
  {
    id: "conversations",
    title: "Conversations",
    desc: "Most recent check-in",
    items: CONVERSATIONS,
  },
  {
    id: "portfolio",
    title: "Portfolio",
    desc: "Standalone account",
    items: [],
  },
  {
    id: "external",
    title: "External signals",
    desc: "Verify before quoting",
    items: EXTERNAL,
  },
];

export const KINDRED_PET_INTEL_COUNT = KINDRED_PET_INTELLIGENCE.reduce(
  (sum, s) => sum + s.items.length,
  0,
);

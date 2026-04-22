import type { IntelligenceItem, IntelligenceSection, IntelligenceState } from "../types";

/**
 * Northstar Beauty intelligence fixture — lifted verbatim from the reference
 * HTML `EVIDENCE` constant. Six topic-grouped sections, each with evidence
 * items bearing a stable `evid` used for citation↔card targeting.
 *
 * The `sub` fields contain minimal inline HTML (<b>, <em>, <mark>) mirroring
 * the reference, which the cards render via `dangerouslySetInnerHTML` inside
 * a constrained scope.
 */

const RELATIONSHIP_ITEMS: IntelligenceItem[] = [
  {
    evid: "priya",
    flag: null,
    source: "sf",
    label: "Decision maker",
    value: "Priya Shah — VP Marketing",
    sub: "Champion · 2y 4m tenure at Northstar. Econ buyer on the Loyalty oppty. Last engagement Apr 11 QBR.",
    time: "2m ago",
  },
  {
    evid: "sponsor",
    flag: null,
    source: "catalyst",
    label: "Executive sponsor",
    value: "Sam Rivera — CMO, Northstar Group",
    sub: "Group-level sponsor across all three brands. <em>Last executive touch: Jan 22. Relationship is cold.</em>",
    time: "5m ago",
  },
  {
    evid: "rel-health",
    flag: "warn",
    source: "catalyst",
    label: "Relationship health",
    flagPill: "Watch",
    value: "61 — cooled",
    sub: "Catalyst relationship signal down from 74 (Feb). <em>Exec sponsor has not been engaged in 89 days.</em>",
    time: "5m ago",
  },
];

const COMMERCIAL_ITEMS: IntelligenceItem[] = [
  {
    evid: "arr",
    flag: null,
    source: "sf",
    label: "Current ARR",
    value: "$940,000",
    sub: "Plan · Flows Pro + Journeys · 7 of 10 seats used.",
    time: "2m ago",
  },
  {
    evid: "forecast",
    flag: "warn",
    source: "sf",
    label: "Contract & forecast",
    flagPill: "Watch",
    value: "Sep 12, 2026 · Commit",
    sub: "Auto-renew on · Forecast = <b>Commit</b>. <em>Forecast and every other signal in this account are in direct conflict.</em>",
    time: "2m ago",
    action: "Open in Salesforce ↗",
  },
  {
    evid: "past-due",
    flag: "critical",
    source: "netsuite",
    label: "Past-due invoice",
    flagPill: "Past due",
    value: "$18,500 · 41 days overdue",
    sub: "Invoice NS-20314. <b>Finance marked the account as blocked for further invoicing on Apr 18.</b>",
    time: "1m ago",
    action: "Open in NetSuite ↗",
  },
  {
    evid: "ap-policy",
    flag: null,
    source: "internal",
    label: "AP policy signal",
    value: "Finance blocked",
    sub: "Blocking flag set the day after CFO Carla Reyes' start date. <em>Not stated as policy, but pattern-consistent with her prior role.</em>",
    time: "inferred",
  },
];

const PRODUCT_ITEMS: IntelligenceItem[] = [
  {
    evid: "sends",
    flag: "warn",
    source: "snowflake",
    label: "Sends (30d)",
    flagPill: "Watch",
    value: "3.1M · ↓ 18%",
    sub: "Down 18% vs. prior 30 days. Decline started the week of Mar 17.",
    time: "8m ago",
  },
  {
    evid: "flows",
    flag: "warn",
    source: "snowflake",
    label: "Flows active",
    flagPill: "Watch",
    value: "9 of 20 provisioned",
    sub: "3 flows paused since Mar — welcome-series, winback, and replenishment.",
    time: "8m ago",
  },
  {
    evid: "health",
    flag: "critical",
    source: "catalyst",
    label: "Health score",
    flagPill: "Watch",
    value: "61 · ↓ 13 pts",
    sub: "Was 74 on Feb 28. Adoption subscore drove the decline (dropped 19 pts).",
    time: "5m ago",
  },
  {
    evid: "adoption-vs",
    flag: null,
    source: "snowflake",
    label: "Adoption vs. Group",
    value: "Beauty lags",
    sub: "Active: 83 · Home: 79 · <b>Beauty: 61</b>. Beauty is the only brand below the Group average in adoption.",
    time: "8m ago",
  },
];

const CONVERSATIONS_ITEMS: IntelligenceItem[] = [
  {
    evid: "gong-apr11",
    flag: "warn",
    source: "gong",
    label: "Apr 11 QBR",
    flagPill: "Watch",
    value: "Competitor referenced 2×",
    sub: "<b>'Active Loyalty'</b> mentioned at 00:18:32 and 00:41:05. Pricing pushback from Priya at 00:32:14. Follow-ups assigned: <em>none closed</em>.",
    time: "11m ago",
    action: "Open in Gong ↗",
  },
  {
    evid: "last-email",
    flag: null,
    source: "sf",
    label: "Last email",
    value: "Apr 18 — pricing follow-up",
    sub: "Sent to Priya · opened · no reply. Thread originated on the Apr 11 QBR.",
    time: "2m ago",
  },
  {
    evid: "tickets",
    flag: "warn",
    source: "sf",
    label: "Open tickets",
    flagPill: "Watch",
    value: "2 open",
    sub: "Deliverability (<b>9 days</b> old) + SLA question (4 days old). <em>Neither has a response SLA assigned.</em>",
    time: "2m ago",
  },
];

const PORTFOLIO_ITEMS: IntelligenceItem[] = [
  {
    evid: "port-beauty",
    flag: "critical",
    source: "catalyst",
    label: "Beauty",
    flagPill: "This account",
    value: "$940K · Watchlist",
    sub: "Health 61 · past-due $18.5K · Flows 9/20 · competitor mentioned twice on last call.",
    time: "5m ago",
  },
  {
    evid: "port-active",
    flag: null,
    source: "catalyst",
    label: "Active",
    value: "$1.85M · Commit · healthy",
    sub: "Health 83 · current on billing · 14 flows running · QBR forecast unchanged.",
    time: "5m ago",
  },
  {
    evid: "port-home",
    flag: null,
    source: "catalyst",
    label: "Home",
    value: "$610K · Commit · healthy",
    sub: "Health 79 · expansion Stage 2 (SMS + Review) · QBR forecast strong.",
    time: "5m ago",
  },
  {
    evid: "port-total",
    flag: null,
    source: "internal",
    label: "Group ARR",
    value: "$3.40M combined",
    sub: "<b>Beauty at risk; Active + Home healthy.</b> Exposure if Beauty doesn't renew: ~28% of group ARR.",
    time: "inferred",
  },
];

const EXTERNAL_ITEMS: IntelligenceItem[] = [
  {
    evid: "cfo",
    flag: null,
    source: "exa",
    label: "Retail Dive",
    fav: "RD",
    verify: true,
    web: {
      title: "Northstar Group taps new CFO amid growth push",
      snippet:
        "The holding company named Carla Reyes CFO on <mark>Apr 02</mark>; she previously led tighter <mark>AP controls and vendor consolidation</mark> at her prior role.",
    },
    sub: "retaildive.com · Apr 02 · 19 days ago",
  },
  {
    evid: "priya-li",
    flag: null,
    source: "exa",
    label: "LinkedIn",
    fav: "in",
    verify: true,
    web: {
      title: "Priya Shah — post on lifecycle tooling",
      snippet:
        '<em>"Evaluating how many ESPs we really need across the group — the <mark>overlap between our brands\' vendors</mark> is adding cost, not coverage."</em> (38 likes, 12 comments)',
    },
    sub: "linkedin.com · Apr 09 · 12 days ago",
  },
  {
    evid: "pod-apr11",
    flag: null,
    source: "exa",
    label: "DTC Pod · Ep. 212",
    fav: "🎙",
    verify: true,
    web: {
      title: "Priya Shah on consolidation",
      snippet:
        "Mentions frustration with <mark>stitched-together lifecycle tools</mark> and praises Active's integrated loyalty approach by name.",
    },
    sub: "thedtcpod.com · Apr 11 · 10 days ago",
  },
  {
    evid: "glassdoor",
    flag: null,
    source: "exa",
    label: "Glassdoor — inferred",
    fav: "GD",
    verify: true,
    web: {
      title: "Northstar Beauty — 2 lifecycle hires, last 60 days",
      snippet:
        "Inferred from job-posting removals. <mark>Senior Lifecycle Manager</mark> role filled Mar 22; a second opened this week.",
    },
    sub: "inferred · 5 weeks ago",
  },
];

export const NORTHSTAR_BEAUTY_INTELLIGENCE: IntelligenceSection[] = [
  { id: "relationship", title: "Relationship", desc: "Decision maker, sponsor, and health", items: RELATIONSHIP_ITEMS },
  { id: "commercial", title: "Commercial", desc: "ARR, plan, renewal, billing", items: COMMERCIAL_ITEMS },
  { id: "product", title: "Product & usage", desc: "Adoption, health, trend", items: PRODUCT_ITEMS },
  { id: "conversations", title: "Conversations", desc: "Calls, emails, tickets, follow-ups", items: CONVERSATIONS_ITEMS },
  { id: "portfolio", title: "Portfolio — Northstar Group", desc: "Beauty vs. Active vs. Home", items: PORTFOLIO_ITEMS },
  { id: "external", title: "External signals", desc: "Verify before quoting", items: EXTERNAL_ITEMS },
];

export const NORTHSTAR_BEAUTY_INTEL_STATE: IntelligenceState = {
  relationship: NORTHSTAR_BEAUTY_INTELLIGENCE[0],
  commercial: NORTHSTAR_BEAUTY_INTELLIGENCE[1],
  product: NORTHSTAR_BEAUTY_INTELLIGENCE[2],
  conversations: NORTHSTAR_BEAUTY_INTELLIGENCE[3],
  portfolio: NORTHSTAR_BEAUTY_INTELLIGENCE[4],
  external: NORTHSTAR_BEAUTY_INTELLIGENCE[5],
};

/** Flat item count across all six sections — 22 for Northstar Beauty. */
export const NORTHSTAR_BEAUTY_INTEL_COUNT = NORTHSTAR_BEAUTY_INTELLIGENCE.reduce(
  (sum, s) => sum + s.items.length,
  0,
);

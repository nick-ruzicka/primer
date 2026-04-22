import type { ConfidenceLevel, SourceId } from "../types";

/**
 * Northstar Beauty brief fixture — lifted verbatim from the reference HTML
 * (reference/Attentive_Briefing.html, extracted JSX source). This copy is the
 * canonical brief-quality bar the streaming agent must hit.
 *
 * Structure mirrors the `<Prose>` / `<Cite>` model in the reference: each
 * paragraph is an array of inline nodes, with citations as `{kind: 'cite'}`
 * tokens pointing at evidence ids.
 */

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "cite"; n: number };

export type Paragraph = InlineNode[];

export interface BriefAction {
  id: string; // e.g. "A1"
  body: Paragraph;
  rationale: Paragraph;
}

export interface BriefSection {
  id: "01" | "02" | "03" | "04";
  key: "read" | "why" | "what_to_do" | "talk_track";
  title: string;
  hedge: { level: ConfidenceLevel; label: string; tip: string };
  preview: string;
  // For 01 / 02: list of paragraphs
  paragraphs?: Paragraph[];
  // For 03: list of actions
  actions?: BriefAction[];
  // For 04: list of questions
  questions?: Paragraph[];
}

export interface CitationMeta {
  n: number;
  source: SourceId;
  evid: string;
  label: string;
  time_ago: string;
}

export interface BriefFixture {
  account_id: string;
  confidence: number;
  confidence_label: string;
  sections: BriefSection[];
  citations: CitationMeta[];
}

// Inline-node helpers — keep fixture readable.
const t = (value: string): InlineNode => ({ kind: "text", value });
const b = (value: string): InlineNode => ({ kind: "bold", value });
const i = (value: string): InlineNode => ({ kind: "italic", value });
const c = (n: number): InlineNode => ({ kind: "cite", n });

export const NORTHSTAR_BEAUTY_BRIEF: BriefFixture = {
  account_id: "ns-beauty",
  confidence: 84,
  confidence_label: "likely",
  sections: [
    {
      id: "01",
      key: "read",
      title: "The read",
      hedge: {
        level: "very-likely",
        label: "very likely",
        tip: "Very likely — multiple independent signals agree. Internal systems and external sources both support this read; low risk of being wrong.",
      },
      preview:
        "Renewal on paper — trust-repair underneath. Beauty is the weakest brand in a group-wide consolidation review.",
      paragraphs: [
        [
          t(
            "This call looks like a renewal conversation on paper, but the signals underneath say it's a ",
          ),
          b("trust-repair call"),
          t(". Priya isn't opening the quarter — she's running a "),
          b("vendor-consolidation review"),
          t(" across the three Northstar brands"),
          c(2),
          c(3),
          t(", and Northstar Beauty is the weakest of the three."),
        ],
        [
          t("A new group CFO, Carla Reyes, started Apr 02"),
          c(1),
          t(" — the same week Beauty was moved to Catalyst's watchlist"),
          c(4),
          t(" and NetSuite blocked further invoicing against an "),
          b("18,500 past-due balance"),
          c(5),
          t(". Salesforce still shows the renewal as "),
          b("Commit"),
          c(6),
          t("; Catalyst, NetSuite, and Gong disagree."),
        ],
        [
          t(
            "Go in expecting to earn the renewal, not expand it. If the invoice and deliverability don't resolve, expansion",
          ),
          c(6),
          t(" is off the table for this conversation."),
        ],
      ],
    },
    {
      id: "02",
      key: "why",
      title: "Why this read",
      hedge: {
        level: "likely",
        label: "likely",
        tip: "Likely — the supporting signals cluster toward one interpretation, but a single new data point could shift the picture. Worth validating on the call.",
      },
      preview:
        "New CFO blocked payment; exec sponsor has been cold 89 days; Beauty usage is the only brand under Group average.",
      paragraphs: [
        [
          t(
            "Four independent signals contradict the Commit forecast. Catalyst moved Beauty to Watchlist on Mar 28 after a 13-point health drop",
          ),
          c(4),
          t(
            ", driven almost entirely by adoption: three flows paused since March",
          ),
          c(9),
          t(" and send volume down 18% vs. the prior 30 days"),
          c(10),
          t(". "),
          i(
            "Accounts with that combination plus a past-due balance churn at roughly 3× baseline in our book.",
          ),
        ],
        [
          t(
            "The Apr 11 QBR is the clearest signal of what Priya is actually evaluating. A competitor's loyalty product was named twice on the call, and Priya pushed back on pricing in the same session",
          ),
          c(11),
          t(
            ". Her LinkedIn post two days earlier called out vendor overlap across the group by name",
          ),
          c(2),
          t(
            ", and on the DTC Pod that week she praised Active's integrated approach directly",
          ),
          c(3),
          t(". "),
          i(
            "This reads less like a feature complaint and more like a short list being built.",
          ),
        ],
        [
          t(
            "The CFO change is the forcing function. Carla's prior role emphasized AP controls and vendor consolidation",
          ),
          c(1),
          t(
            "; NetSuite's invoice-blocking flag was set the day after her start date",
          ),
          c(12),
          t(". "),
          i(
            "This suggests Priya has a new internal incentive to come out of this week with a tighter vendor posture — and Beauty is the easiest of the three brands to justify cutting.",
          ),
        ],
      ],
    },
    {
      id: "03",
      key: "what_to_do",
      title: "What to do on the call",
      hedge: {
        level: "rec",
        label: "agent recommendation",
        tip: "Agent recommendation — these are prescriptive next actions generated from the read above. Edit or discard any; nothing here is committed until you act on it.",
      },
      preview:
        "Lead with finance. Pre-solve the invoice before it becomes the call. Reset the exec relationship at the SVP level.",
      actions: [
        {
          id: "A1",
          body: [t("Acknowledge NS-20314 in the first two minutes.")],
          rationale: [
            t(
              "Priya already knows about it. Naming it first makes this a trust-repair conversation instead of her raising it and making it a negotiation.",
            ),
          ],
        },
        {
          id: "A2",
          body: [
            t("Bring up Carla on your terms — don't let Priya introduce her."),
          ],
          rationale: [
            t(
              '"We saw the CFO news — we\'d like to get you clean on invoicing this week" positions you as the one proposing the reset.',
            ),
          ],
        },
        {
          id: "A3",
          body: [t("Do not pitch Loyalty or the App Pilot on this call.")],
          rationale: [
            t(
              "Expansion talk while Finance is blocking invoices will read as tone-deaf and will put you behind the podcast comment about stitched-together tools.",
            ),
          ],
        },
        {
          id: "A4",
          body: [t("Reframe around the group, not Beauty alone.")],
          rationale: [
            t(
              "Beauty is the weakest of the three brands. Bring a side-by-side of Beauty + Active + Home so the conversation is consolidation onto Attentive, not off it.",
            ),
          ],
        },
        {
          id: "A5",
          body: [t("Pull Rae in live if deliverability comes up.")],
          rationale: [
            t(
              "The ticket is 9 days old. Solving it on the call is the single highest-trust move available today.",
            ),
          ],
        },
      ],
    },
    {
      id: "04",
      key: "talk_track",
      title: "Suggested talk track",
      hedge: {
        level: "draft",
        label: "draft — not sent",
        tip: "Draft — a first-pass opening the agent will refine in real time as you talk. Use it as a starting point, not a script.",
      },
      preview:
        "Four-beat open: acknowledge → address → reframe → propose. Don't pitch Loyalty until the invoice is resolved.",
      questions: [
        [
          t(
            "Priya — before anything else, we saw NS-20314 is 41 days out. What do you need from us this week to get Finance unblocked?",
          ),
        ],
        [
          t(
            "We noticed Carla joined as CFO this month — happy to loop her in on a simplified billing setup across the three brands if that would help.",
          ),
        ],
        [
          t(
            "I want to earn the renewal before we talk anything bigger. Walk me through what's changed on lifecycle since the Apr 11 QBR.",
          ),
        ],
        [
          t(
            "You mentioned Active's integrated loyalty on the podcast — worth noting Beauty, Active, and Home are all on us. Want to look at loyalty as a group-level consolidation rather than a Beauty add-on?",
          ),
        ],
        [
          t(
            "On the deliverability ticket — I'm pulling Rae in now so we can work through it live rather than offline.",
          ),
        ],
      ],
    },
  ],
  citations: [
    {
      n: 1,
      source: "exa",
      evid: "cfo",
      label: "Retail Dive — Northstar Group taps new CFO",
      time_ago: "19 days ago",
    },
    {
      n: 2,
      source: "exa",
      evid: "priya-li",
      label: "LinkedIn — Priya Shah on lifecycle tooling",
      time_ago: "12 days ago",
    },
    {
      n: 3,
      source: "exa",
      evid: "pod-apr11",
      label: "DTC Pod · Ep. 212 — Priya Shah on consolidation",
      time_ago: "10 days ago",
    },
    {
      n: 4,
      source: "catalyst",
      evid: "rel-health",
      label: "Catalyst — relationship health 61 (cooled)",
      time_ago: "5m ago",
    },
    {
      n: 5,
      source: "netsuite",
      evid: "past-due",
      label: "NetSuite — past-due $18,500 (Invoice NS-20314)",
      time_ago: "1m ago",
    },
    {
      n: 6,
      source: "sf",
      evid: "forecast",
      label: "Salesforce — Sep 12, 2026 · Commit · auto-renew on",
      time_ago: "2m ago",
    },
    {
      n: 9,
      source: "snowflake",
      evid: "flows",
      label: "Snowflake — flows active 9 of 20 provisioned",
      time_ago: "8m ago",
    },
    {
      n: 10,
      source: "snowflake",
      evid: "sends",
      label: "Snowflake — sends (30d) 3.1M · ↓ 18%",
      time_ago: "8m ago",
    },
    {
      n: 11,
      source: "gong",
      evid: "gong-apr11",
      label: "Gong — Apr 11 QBR (competitor referenced 2×)",
      time_ago: "11m ago",
    },
    {
      n: 12,
      source: "internal",
      evid: "ap-policy",
      label: "Internal — AP policy signal (finance blocked)",
      time_ago: "inferred",
    },
  ],
};

/**
 * For mock SSE streaming: flattens the structured brief into a single markdown
 * string matching the shape the real backend will emit. parseBriefSections is
 * the inverse (used by the live path in lib/markdown.ts).
 */
export function briefToMarkdown(fixture: BriefFixture): string {
  const renderInline = (nodes: Paragraph): string =>
    nodes
      .map((n) => {
        if (n.kind === "text") return n.value;
        if (n.kind === "bold") return `**${n.value}**`;
        if (n.kind === "italic") return `_${n.value}_`;
        return ` ·${n.n}`;
      })
      .join("");

  const out: string[] = [];
  for (const s of fixture.sections) {
    out.push(`## ${s.id} · ${s.title} — ${s.hedge.label}`);
    out.push("");
    out.push(`> ${s.preview}`);
    out.push("");
    if (s.paragraphs) {
      for (const p of s.paragraphs) {
        out.push(renderInline(p));
        out.push("");
      }
    } else if (s.actions) {
      for (const a of s.actions) {
        out.push(`${a.id}. **${renderInline(a.body)}**`);
        out.push(`   _${renderInline(a.rationale)}_`);
        out.push("");
      }
    } else if (s.questions) {
      for (const q of s.questions) {
        out.push(`- ${renderInline(q)}`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}

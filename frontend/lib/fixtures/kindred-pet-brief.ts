import type {
  BriefFixture,
  InlineNode,
  Paragraph,
} from "./northstar-beauty-brief";

/**
 * Kindred Pet Supply — adoption-collapse-after-DM-change story.
 * Deliberately distinct from Northstar Beauty's billing/trust story so the
 * mock path demonstrates that different accounts produce different briefs.
 */

const t = (value: string): InlineNode => ({ kind: "text", value });
const b = (value: string): InlineNode => ({ kind: "bold", value });
const i = (value: string): InlineNode => ({ kind: "italic", value });
const c = (n: number): InlineNode => ({ kind: "cite", n });

const P1: Paragraph = [
  t("This renewal is "),
  b("at risk for adoption, not trust"),
  t(". Rowan left two months ago"),
  c(1),
  t(", Jamie Park took over in February, and usage has "),
  b("collapsed since"),
  c(2),
  t(
    " — four of twelve flows paused, sends down 41%, and relationship score dropped from 81 to 48",
  ),
  c(3),
  t("."),
];

const P2: Paragraph = [
  t("Jamie was candid on the last call: they're "),
  i(
    "evaluating whether we're using it to its full potential — otherwise we'll consolidate",
  ),
  c(4),
  t(". Her LinkedIn post last week talked about "),
  b("consolidating the marketing stack"),
  c(5),
  t("."),
];

const P3: Paragraph = [
  t("The renewal is 48 days out. You don't have a billing problem — you have "),
  b("no champion"),
  t(". Rebuild one, fast."),
];

const WHY_P1: Paragraph = [
  t("Usage tells the story cleanly. Health 48 (down from 81)"),
  c(3),
  t(", four flows paused in the last eight weeks"),
  c(6),
  t(", and send volume down 41% since the DM change"),
  c(2),
  t(". "),
  i("No billing or exec-touch signals — this is a pure adoption failure."),
];

const WHY_P2: Paragraph = [
  t(
    "The DM turnover is the root cause. Rowan owned the relationship for three years and has been replaced by someone who inherited a stack she didn't choose",
  ),
  c(1),
  t(". Exec sponsor hasn't been engaged in 127 days"),
  c(7),
  t("."),
];

export const KINDRED_PET_BRIEF: BriefFixture = {
  account_id: "kindred",
  confidence: 71,
  sections: [
    {
      id: "01",
      key: "read",
      title: "The read",
      preview:
        "Not a billing problem — an adoption problem with a new DM who inherited a stack she didn't choose.",
      paragraphs: [P1, P2, P3],
    },
    {
      id: "02",
      key: "why",
      title: "Why this read",
      preview:
        "Usage halved since Rowan left. Exec sponsor dark 127 days. Jamie explicitly naming 'consolidation' on the last call.",
      paragraphs: [WHY_P1, WHY_P2],
    },
    {
      id: "03",
      key: "what_to_do",
      title: "What to do on the call",
      preview:
        "Rebuild a champion. Show Jamie what 'full potential' actually looks like with her stack, her flows, her brand.",
      actions: [
        {
          id: "A1",
          body: [t("Acknowledge the DM change directly.")],
          rationale: [
            t(
              "\"You inherited this — let's make sure you own what's here\" takes the consolidation threat off the table as the opening frame.",
            ),
          ],
        },
        {
          id: "A2",
          body: [t("Walk a 30-day plan to unpause the four flows.")],
          rationale: [
            t(
              "Concrete, short, and measurable. Gets a win on the scoreboard before the renewal conversation.",
            ),
          ],
        },
        {
          id: "A3",
          body: [t("Offer a CS pairing for the first two weeks.")],
          rationale: [
            t(
              "She is two months in with no context; a live-ops partner for a bounded window beats a dashboard.",
            ),
          ],
        },
        {
          id: "A4",
          body: [t("Do not defend features. Do not discount.")],
          rationale: [
            t(
              "Neither builds trust with a DM who is evaluating whether to care. Build competence first, commercial second.",
            ),
          ],
        },
      ],
    },
    {
      id: "04",
      key: "talk_track",
      title: "Suggested talk track",
      preview:
        "Curious, not defensive. Jamie needs to feel you're invested in her succeeding, not invested in the renewal.",
      questions: [
        [
          t(
            "Jamie — before we get into product, what's the version of this program that would make you proud in six months?",
          ),
        ],
        [
          t(
            "Rowan left in February — what's the part of what she set up that you'd keep, and what do you want to rebuild?",
          ),
        ],
        [
          t(
            "Three of the paused flows look recoverable in a week of work. Want to walk those and pick one to restart this week?",
          ),
        ],
        [
          t(
            "You mentioned consolidation on our last call — help me understand what 'good' looks like there so I know whether we're part of the answer.",
          ),
        ],
      ],
    },
  ],
  citations: [
    {
      n: 1,
      evid: "kp-dm-change",
      provenance: "raw",
      source_system: "Salesforce",
      source_module: "Contacts",
      field: "owner",
      value_display: "Jamie Park (replaced Rowan Sato, Feb 2026)",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "3m ago",
    },
    {
      n: 2,
      evid: "kp-sends",
      provenance: "raw",
      source_system: "Snowflake",
      source_module: "Product usage",
      field: "sends_30d_delta",
      value_display: "↓ 41% since DM change (Feb)",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "8m ago",
    },
    {
      n: 3,
      evid: "kp-health",
      provenance: "scored",
      source_system: "Catalyst",
      source_module: "Relationship health",
      field: "relationship_score",
      value_display: "48 / 100 (down from 81)",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "5m ago",
    },
    {
      n: 4,
      evid: "kp-call",
      provenance: "scored",
      source_system: "Gong",
      source_module: "Last call transcript",
      field: "consolidation_signal",
      value_display: "Jamie: 'full potential otherwise we'll consolidate'",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "7 days ago",
    },
    {
      n: 5,
      evid: "kp-li",
      provenance: "surfaced",
      source_system: "Exa",
      source_module: "LinkedIn post by Jamie Park",
      snippet:
        "Consolidating our marketing stack this year — fewer vendors, clearer ownership, better outcomes. If you're not earning your seat, you're out.",
      url: "https://linkedin.com/posts/jamie-park-marketing-stack",
      retrieved_at: "2026-04-22T14:00:00Z",
      data_as_of: "2026-04-13T00:00:00Z",
      time_ago: "9 days ago",
    },
    {
      n: 6,
      evid: "kp-flows",
      provenance: "raw",
      source_system: "Snowflake",
      source_module: "Product usage",
      field: "flows_active",
      value_display: "4 of 12 provisioned (8 paused)",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "8m ago",
    },
    {
      n: 7,
      evid: "kp-exec",
      provenance: "scored",
      source_system: "Catalyst",
      source_module: "Exec engagement",
      field: "exec_sponsor_last_touch",
      value_display: "127 days cold (Mei Chen — CMO)",
      retrieved_at: "2026-04-22T14:00:00Z",
      time_ago: "5m ago",
    },
  ],
};

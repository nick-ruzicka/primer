import type { IntelligenceSection } from "../types";
import { KINDRED_PET_BRIEF } from "./kindred-pet-brief";
import { KINDRED_PET_INTELLIGENCE } from "./kindred-pet-intelligence";
import type { BriefFixture } from "./northstar-beauty-brief";
import { NORTHSTAR_BEAUTY_BRIEF } from "./northstar-beauty-brief";
import { NORTHSTAR_BEAUTY_INTELLIGENCE } from "./northstar-beauty-intelligence";

interface AccountMock {
  brief: BriefFixture;
  intelligence: IntelligenceSection[];
}

/**
 * Account id → {brief, intelligence} for the mock SSE path.
 * Accounts not listed fall back to `getMockForAccount`'s generic stub.
 */
const MOCK_REGISTRY: Record<string, AccountMock> = {
  "ns-active": {
    brief: NORTHSTAR_BEAUTY_BRIEF,
    intelligence: NORTHSTAR_BEAUTY_INTELLIGENCE,
  },
  "ns-beauty": {
    brief: NORTHSTAR_BEAUTY_BRIEF,
    intelligence: NORTHSTAR_BEAUTY_INTELLIGENCE,
  },
  kindred: {
    brief: KINDRED_PET_BRIEF,
    intelligence: KINDRED_PET_INTELLIGENCE,
  },
};

/** Generic placeholder used when an account doesn't have a hand-authored fixture. */
function makeGenericMock(accountId: string, accountName: string): AccountMock {
  const brief: BriefFixture = {
    account_id: accountId,
    confidence: 62,
    sections: [
      {
        id: "01",
        key: "read",
        title: "The read",
        preview: `Straightforward check-in for ${accountName}.`,
        paragraphs: [
          [
            {
              kind: "text",
              value: `This brief is a minimal mock for ${accountName}. `,
            },
            {
              kind: "text",
              value:
                "Once the backend is wired, Claude generates a full four-section briefing grounded in the six source systems.",
            },
          ],
        ],
      },
      {
        id: "02",
        key: "why",
        title: "Why this read",
        preview: "No contradictions in the pre-fetch.",
        paragraphs: [
          [
            {
              kind: "text",
              value:
                "Full data pulls from Salesforce, Snowflake, Catalyst, NetSuite, Gong, and Exa complete this section in the live path.",
            },
          ],
        ],
      },
      {
        id: "03",
        key: "what_to_do",
        title: "What to do on the call",
        preview: "Action list renders here.",
        actions: [
          {
            id: "A1",
            body: [
              {
                kind: "text",
                value: "Review the account in Salesforce before the call.",
              },
            ],
            rationale: [
              {
                kind: "text",
                value: "The real brief fills in grounded next actions.",
              },
            ],
          },
        ],
      },
      {
        id: "04",
        key: "talk_track",
        title: "Suggested talk track",
        preview: "Starter questions render here.",
        questions: [
          [
            {
              kind: "text",
              value:
                "Generic opener — real talk tracks come from the live agent.",
            },
          ],
        ],
      },
    ],
    citations: [],
  };
  return { brief, intelligence: [] };
}

export function getMockForAccount(
  accountId: string,
  accountName: string,
): AccountMock {
  return MOCK_REGISTRY[accountId] ?? makeGenericMock(accountId, accountName);
}

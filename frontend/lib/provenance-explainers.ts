import type { CitationMeta } from "./types";

/**
 * Per-field provenance explainers — variant (A) from the References block
 * design. Purely descriptive: what the field is, where it came from, how
 * fresh it is. No reliability judgments — reps make that call themselves
 * with the full context already visible in the reference entry and modal.
 *
 * Lookup order:
 *   1. EXACT match on "SourceSystem.field" for fields whose specific
 *      nature wouldn't be captured by a source-level default.
 *   2. PREFIX match on "SourceSystem.field_prefix." for dynamic fields
 *      (contact.*, invoice.*, sentiment.*, etc.).
 *   3. BY_SOURCE default keyed on "SourceSystem.provenance".
 *   4. FALLBACK_BY_PROVENANCE if nothing else matches.
 *
 * Related parked specs:
 *   - specs/11_STALE_DATA_DECAY.md — freshness decay on the tag chip
 *   - specs/12_RAW_SUBCATEGORIZATION.md — LEDGER vs SELF-REPORTED split
 */

const EXACT: Record<string, string> = {
  "Salesforce.forecast_category":
    "The opportunity's forecast category, set by the account owner in Salesforce.",
  "Salesforce.arr_cents":
    "Annual recurring revenue as recorded in Salesforce. Updated when the account team edits the record.",
  "Salesforce.stage":
    "Account stage in Salesforce, set by the account owner.",
  "Salesforce.owner":
    "The account owner recorded in Salesforce.",

  "Catalyst.relationship_score":
    "Catalyst's proprietary health score, derived from the signals Catalyst uses to model account health.",
  "Catalyst.renewal_forecast":
    "Catalyst's forecast model output for the renewal.",
  "Catalyst.expansion_readiness":
    "Catalyst's expansion-readiness assessment, produced by Catalyst's model.",
  "Catalyst.relationship_status":
    "A status label set in Catalyst by the CSM or by a workflow rule.",
  "Catalyst.last_executive_touch":
    "Timestamp of the most recent executive-level interaction, recorded in Catalyst.",
  "Catalyst.notes":
    "Free-text notes maintained in Catalyst by the CSM.",

  "NetSuite.past_due_balance":
    "Past-due accounts receivable balance from the NetSuite ledger. Reflects recorded transactions as of retrieval.",
  "NetSuite.days_overdue":
    "Days since the oldest past-due invoice's due date, from the NetSuite ledger.",
  "NetSuite.current_balance":
    "Current open AR balance from the NetSuite ledger.",
};

const PREFIX: Array<[string, string]> = [
  [
    "Salesforce.contact.",
    "A contact record from Salesforce. Maintained by the account team.",
  ],
  [
    "Salesforce.opp.",
    "Open opportunity record from Salesforce. Updated when the opportunity owner edits the deal.",
  ],
  [
    "Salesforce.closed.",
    "Closed opportunity record from Salesforce.",
  ],
  [
    "NetSuite.ap_flag.",
    "An AP policy flag raised by NetSuite when ledger conditions cross a configured threshold.",
  ],
  [
    "NetSuite.invoice.",
    "An invoice record from NetSuite.",
  ],
  [
    "Gong.call.",
    "Call metadata from Gong — title, date, attendees. Populated when the call is recorded.",
  ],
  [
    "Gong.competitor.",
    "A passage extracted by Gong from a recorded call transcript.",
  ],
  [
    "Gong.sentiment.",
    "Sentiment classification from Gong's NLP model, applied to a call passage.",
  ],
  [
    "Gong.pricing_signal.",
    "A pricing-related signal extracted by Gong's NLP model from call transcripts.",
  ],
];

const BY_SOURCE: Record<string, string> = {
  "Salesforce.raw":
    "A field from Salesforce. Updated when the account team edits the record.",
  "Salesforce.scored":
    "A computed value from Salesforce.",

  "NetSuite.raw":
    "From the NetSuite ledger. Reflects recorded transactions as of retrieval.",

  "Snowflake.raw":
    "Aggregated from event logs in Snowflake.",
  "Snowflake.scored":
    "Computed in Snowflake by comparing this account against peer accounts.",

  "Catalyst.raw":
    "A field maintained in Catalyst.",
  "Catalyst.scored":
    "A score produced by a Catalyst model.",

  "Gong.raw":
    "Extracted from a Gong call recording or transcript.",
  "Gong.scored":
    "Produced by a Gong NLP model, applied to call transcripts.",

  "Exa.surfaced":
    "Content retrieved from the public web via Exa. Snapshot taken at retrieval; the original page may have changed.",
};

const FALLBACK: Record<CitationMeta["provenance"], string> = {
  raw: "A direct read from the source system.",
  scored: "A computed or classified value from the source system.",
  surfaced: "Content retrieved from an external source.",
};

export function explainProvenance(citation: CitationMeta): string {
  if (citation.provenance === "surfaced") {
    return (
      BY_SOURCE[`${citation.source_system}.surfaced`] ?? FALLBACK.surfaced
    );
  }

  const key = `${citation.source_system}.${citation.field ?? ""}`;
  const exact = EXACT[key];
  if (exact) return exact;

  for (const [prefix, text] of PREFIX) {
    if (key.startsWith(prefix)) return text;
  }

  const bySource =
    BY_SOURCE[`${citation.source_system}.${citation.provenance}`];
  if (bySource) return bySource;

  return FALLBACK[citation.provenance];
}

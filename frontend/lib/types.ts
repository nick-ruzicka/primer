/**
 * Types that mirror the backend SSE + /api/accounts payloads.
 * Kept snake_case end-to-end to match FastAPI defaults.
 */

export type SourceId =
  | "sf"
  | "snowflake"
  | "catalyst"
  | "netsuite"
  | "gong"
  | "exa"
  | "hubspot"
  | "internal";

export type FactProvenance = "raw" | "scored" | "surfaced";

export type AccountState = "hot" | "warm" | "cool";

export type ViewMode = "split" | "workspace" | "reading" | "writeup";

export type ConfidenceLevel = "very-likely" | "likely" | "rec" | "draft";

export type Severity = "critical" | "watch";

export type IntelSectionId =
  | "relationship"
  | "commercial"
  | "product"
  | "conversations"
  | "portfolio"
  | "external";

export interface Account {
  id: string;
  /** Short label used in the left rail (e.g. "Beauty"). */
  name: string;
  /** Full display name used in the account header (e.g. "Northstar Beauty"). Falls back to `name`. */
  full_name?: string;
  /** 2-letter tile used in rail (brand short, e.g. "BE"). */
  initial: string;
  /** 2-letter tile used in header (full-name initials, e.g. "NB"). Falls back to `initial`. */
  header_initial?: string;
  color: string;
  industry?: string;
  /** Pre-formatted short ARR e.g. "$940k" — used in rail. */
  arr: string;
  /** Pre-formatted ARR for header e.g. "$940k ARR". Falls back to `{arr} ARR`. */
  arr_display?: string;
  arr_cents?: number;
  hq?: string;
  employees?: number;
  owner?: string;
  state: AccountState;
  note: string;
  parent_group_id?: string | null;
  parent_group_name?: string | null;
  call_when?: string;
  countdown?: string;
  attendees?: Attendee[];
}

export interface Attendee {
  name: string;
  role: string;
  ours: boolean;
}

export interface AccountGroup {
  id: string;
  name: string;
  total_arr: string;
  initials: string;
  brands: Account[];
}

export interface AccountsResponse {
  groups: AccountGroup[];
  standalone: Account[];
}

export interface WebSnippet {
  title: string;
  snippet: string;
}

type CitationCommon = {
  /** 1-indexed display number that appears as ·N in prose. */
  n: number;
  /** Stable id for citation-chip ↔ reference-entry lookup. */
  evid: string;
  /** Full display name: "NetSuite", "Catalyst", "Salesforce", "Gong", "Snowflake", "Exa". */
  source_system: string;
  /** Subsystem label: "Accounts Receivable", "Forecast", "LinkedIn post by Priya Shah". */
  source_module?: string;
  /** ISO — when the backend fetched it. */
  retrieved_at: string;
  /** ISO — when the data represents. Optional; often null for live RAW reads. */
  data_as_of?: string;
  /** Pre-computed human relative string from backend: "pulled 2h ago", "posted 13d ago". */
  time_ago: string;
};

/**
 * CitationMeta — discriminated union keyed on `provenance`.
 *
 * RAW (directly measured) and SCORED (upstream-system model output) share
 * the `field` + `value_display` shape. SURFACED (third-party content from
 * Exa/web) uses `snippet` + optional `url` instead.
 *
 * The union forces the renderer to branch on `provenance` and statically
 * know which fields exist. See docs/superpowers/specs/2026-04-24-references-block-design.md §3.
 */
export type CitationMeta =
  | (CitationCommon & {
      provenance: "raw" | "scored";
      /** Field path: "past_due_balance", "relationship_score". */
      field: string;
      /** Formatted value for display: "$18,500", "61 / 100", "Commit". */
      value_display: string;
    })
  | (CitationCommon & {
      provenance: "surfaced";
      /** The quoted passage (e.g. LinkedIn post body, web snippet). */
      snippet: string;
      /** External URL when source exposes one. */
      url?: string;
    });

export interface IntelligenceItem {
  evid: string;
  source: SourceId;
  label: string;
  value?: string;
  sub?: string;
  time?: string;
  flag?: "critical" | "warn" | null;
  flagPill?: string;
  action?: string;
  web?: WebSnippet;
  fav?: string;
  verify?: boolean;
}

export interface IntelligenceSection {
  id: IntelSectionId;
  title: string;
  desc: string;
  items: IntelligenceItem[];
}

export interface Citation {
  src: SourceId;
  evid: string;
  n: number;
}

export interface SourceCited {
  citation_number: number;
  source: SourceId;
  time_ago?: string;
  evid?: string;
}

export interface ValidationWarning {
  severity: Severity;
  type:
    | "source_contradiction"
    | "unsupported_claim"
    | "stale_data"
    | "missing_ground";
  message: string;
  brief_excerpt?: string;
  sources?: SourceId[];
  // Decomposed confidence scoring (V1: threaded through but not yet rendered)
  warning_confidence?: number;
  scores?: {
    citation_match: number;
    source_appropriateness: number;
    semantic_drift: number;
    inference_legitimacy: number;
  };
  reasoning?: {
    source_appropriateness: string;
    semantic_drift: string;
    inference_legitimacy: string;
  };
}

export interface BriefSections {
  read: string;
  why: string;
  what_to_do: string;
  talk_track: string;
}

export interface BriefState {
  rawMarkdown: string;
  sections: BriefSections;
  confidence: number | null;
  confidenceHedge: ConfidenceLevel | null;
  isComplete: boolean;
}

export interface GenerationMeta {
  startedAt: number | null;
  completedAt: number | null;
  totalTokens: number | null;
}

export interface IntelligenceState {
  relationship: IntelligenceSection | null;
  commercial: IntelligenceSection | null;
  product: IntelligenceSection | null;
  conversations: IntelligenceSection | null;
  portfolio: IntelligenceSection | null;
  external: IntelligenceSection | null;
}

export interface StoreState {
  accounts: Account[];
  accountGroups: AccountGroup[];
  standalone: Account[];
  activeAccountId: string | null;
  activeAccount: Account | null;
  intelligence: IntelligenceState;
  brief: BriefState;
  citations: SourceCited[];
  warnings: ValidationWarning[];
  generationMeta: GenerationMeta;
  mode: ViewMode;
  theme: "light" | "dark";
  density: "comfortable" | "compact";
  verifyIntensity: "subtle" | "medium" | "loud";
  tweaksOpen: boolean;
  intelligencePanelOpen: boolean;
}

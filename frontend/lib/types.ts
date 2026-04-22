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

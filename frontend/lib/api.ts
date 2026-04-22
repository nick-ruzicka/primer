"use client";

import type {
  Account,
  AccountGroup,
  AccountState,
  AccountsResponse,
} from "./types";

const API_BASE =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined;
const LIVE_MODE = !!API_BASE;

/**
 * Backend /api/accounts shape (per `specs/03_ORCHESTRATOR_SPEC.md` +
 * what the live backend actually emits). We adapt it to our Account shape
 * so the rest of the app doesn't care which path sourced the data.
 */
interface BackendAccount {
  id: string;
  frontend_id?: string;
  name: string;
  stage?: string;
  state?: AccountState;
  arr_cents?: number;
  logo_color?: string;
  logo_initial?: string;
  industry?: string;
  segment?: string;
  hq_city?: string;
  hq_state?: string;
  employees?: number;
  parent_id?: string | null;
  parent_name?: string | null;
  owner_name?: string;
  owner_role?: string;
}

interface BackendGroup {
  parent_id: string;
  parent_name: string;
  combined_arr_cents: number;
  accounts: BackendAccount[];
}

interface BackendAccountsResponse {
  groups: BackendGroup[];
  standalone: BackendAccount[];
}

function fmtArr(cents?: number): string {
  if (!cents) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1_000_000)
    return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}k`;
  return `$${dollars}`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function adaptAccount(b: BackendAccount, _forHeader = false): Account {
  const id = b.frontend_id ?? b.id;
  const fullName = b.name;
  // Rail "short name" = full name with the parent prefix stripped
  const parent = b.parent_name ?? undefined;
  const shortName =
    parent && fullName.startsWith(`${parent} `)
      ? fullName.slice(parent.length + 1)
      : fullName;
  const arrShort = fmtArr(b.arr_cents);
  return {
    id,
    name: shortName,
    full_name: fullName,
    initial: initials(shortName) || b.logo_initial || "?",
    header_initial: b.logo_initial || initials(fullName) || "?",
    color: b.logo_color ?? "#6b6454",
    arr: arrShort,
    arr_display: `${arrShort} ARR`,
    arr_cents: b.arr_cents,
    state: b.state ?? "cool",
    note: deriveNote(b),
    parent_group_id: b.parent_id ?? null,
    parent_group_name: b.parent_name ?? null,
    industry:
      b.industry && b.segment ? `${b.industry} · ${b.segment}` : b.industry,
    hq: b.hq_city && b.hq_state ? `${b.hq_city}, ${b.hq_state}` : b.hq_city,
    employees: b.employees,
    owner: b.owner_name,
  };
}

function deriveNote(b: BackendAccount): string {
  const bits: string[] = [];
  if (b.stage) bits.push(b.stage);
  if (b.state === "hot") bits.push("flagged");
  return bits.join(" · ");
}

function adaptGroup(g: BackendGroup): AccountGroup {
  return {
    id: g.parent_id,
    name: g.parent_name,
    total_arr: `${fmtArr(g.combined_arr_cents)} combined`,
    initials: initials(g.parent_name) || "??",
    brands: g.accounts.map((a) => adaptAccount(a)),
  };
}

/**
 * Fetches accounts from the live backend. Returns null when MOCK_MODE / no
 * API base is configured so the caller falls back to the fixture.
 */
export async function fetchAccounts(): Promise<AccountsResponse | null> {
  if (!LIVE_MODE) return null;
  const url = API_BASE ? `${API_BASE}/api/accounts` : `/api/accounts`; // empty base → same-origin, served by Next rewrite
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`accounts fetch failed: ${res.status}`);
    const data = (await res.json()) as BackendAccountsResponse;
    return {
      groups: (data.groups ?? []).map(adaptGroup),
      standalone: (data.standalone ?? []).map((a) => adaptAccount(a)),
    };
  } catch (err) {
    console.error(
      "[primer] fetchAccounts failed, will fall back to fixture",
      err,
    );
    return null;
  }
}

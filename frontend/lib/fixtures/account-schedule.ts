/**
 * Demo schedule for the sidebar's time-aware UI. Offsets are computed from
 * `Date.now()` at call time so the demo never has stale timestamps —
 * "Northstar Beauty in 12 min" stays "in 12 min" regardless of when the
 * page loads.
 *
 * Calendar integration (Google / Outlook) is parked as a V1.5 stretch goal.
 */

import type { Account } from "@/lib/types";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Account-name → offset-from-now (ms). Matched against `Account.full_name`
 * with a fallback to `Account.name`. `null` means no call scheduled.
 */
const OFFSETS_BY_NAME: Record<string, number | null> = {
  "Northstar Beauty": 12 * MIN,
  "Northstar Active": 3 * HOUR,
  "Northstar Home": 1 * DAY,
  "Quiver Group": 1 * DAY + 2 * HOUR,
  "Quiver Supplements": 2 * DAY,
  "Quiver Rituals": 3 * DAY,
  "Mellow Mattress": 5 * HOUR,
  "Hearth Home Goods": 2 * DAY,
  "Kindred Pet Supply": 4 * DAY,
  "Ember Coffee Co.": null,
  "Tidepool Swim Co.": null,
};

/**
 * Returns the demo `next_call_at` ISO string for an account, or `null` if
 * unscheduled / unknown. Computed at the moment `enrichAccountsWithSchedule`
 * runs, so the offsets stay relative to "now."
 */
function nextCallAtFor(account: Account, now: number): string | null {
  const key = account.full_name ?? account.name;
  const offset = OFFSETS_BY_NAME[key];
  if (offset == null) return null;
  return new Date(now + offset).toISOString();
}

/**
 * Walks the account graph (groups + standalone) and returns a new structure
 * with `next_call_at` populated on each account. Pure — no mutation.
 */
export function enrichAccountsWithSchedule<
  T extends { groups: { brands: Account[] }[]; standalone: Account[] },
>(input: T, now: number = Date.now()): T {
  const enrich = (a: Account): Account => ({
    ...a,
    next_call_at: nextCallAtFor(a, now),
  });
  return {
    ...input,
    groups: input.groups.map((g) => ({ ...g, brands: g.brands.map(enrich) })),
    standalone: input.standalone.map(enrich),
  } as T;
}

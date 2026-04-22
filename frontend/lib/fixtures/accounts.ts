import type { Account, AccountGroup, AccountsResponse } from "../types";

/**
 * Canonical account fixtures. Copy and values lifted from the reference HTML
 * (Northstar Group) and dataset spec 01_DATASET_SPEC.md (other accounts) so the
 * mock-SSE path can exercise all ten accounts once real briefs are wired.
 */

export const NORTHSTAR_GROUP: AccountGroup = {
  id: "northstar-group",
  name: "Northstar Group",
  total_arr: "$3.4M combined",
  initials: "NS",
  brands: [
    {
      id: "ns-beauty",
      name: "Beauty",
      full_name: "Northstar Beauty",
      initial: "BE",
      header_initial: "NB",
      color: "#c26b7a",
      arr: "$940k",
      arr_display: "$940k ARR",
      arr_cents: 94_000_000,
      state: "hot",
      note: "Watchlist · past due",
      parent_group_id: "northstar-group",
      parent_group_name: "Northstar Group",
      industry: "Skincare · DTC",
      hq: "Brooklyn, NY",
      employees: 142,
      owner: "Jamie Kwon",
      call_when: "Today · 2:30 PM",
      countdown: "In 47 min",
      attendees: [
        { name: "Priya Shah", role: "VP Marketing · Northstar Beauty", ours: false },
        { name: "Dev Patel", role: "Head of Lifecycle · Northstar Beauty", ours: false },
        { name: "Jamie Kwon", role: "AE · ", ours: true },
        { name: "Rae Nguyen", role: "SE · ", ours: true },
      ],
    },
    {
      id: "ns-active",
      name: "Active",
      full_name: "Northstar Active",
      initial: "AC",
      header_initial: "NA",
      color: "#4a7b8a",
      arr: "$1.4M",
      arr_display: "$1.4M ARR",
      arr_cents: 145_000_000,
      state: "warm",
      note: "Expansion · Q2",
      parent_group_id: "northstar-group",
      parent_group_name: "Northstar Group",
      industry: "Athleisure · DTC",
      hq: "Brooklyn, NY",
      employees: 210,
      owner: "Jamie Kwon",
    },
    {
      id: "ns-home",
      name: "Home",
      full_name: "Northstar Home",
      initial: "HO",
      header_initial: "NH",
      color: "#5c7349",
      arr: "$680k",
      arr_display: "$680k ARR",
      arr_cents: 68_000_000,
      state: "cool",
      note: "Just live · Mar",
      parent_group_id: "northstar-group",
      parent_group_name: "Northstar Group",
      industry: "Home goods · DTC",
      hq: "Brooklyn, NY",
      employees: 88,
      owner: "Jamie Kwon",
    },
  ],
};

export const STANDALONE_ACCOUNTS: Account[] = [
  {
    id: "tidepool",
    name: "Tidepool Swim",
    initial: "TI",
    color: "#6b6454",
    arr: "$220k",
    state: "warm",
    note: "New biz",
    parent_group_id: null,
    parent_group_name: null,
    industry: "Swimwear · DTC",
    owner: "Jamie Kwon",
  },
  {
    id: "mellow",
    name: "Mellow Mattress",
    initial: "ME",
    color: "#6b6454",
    arr: "$310k",
    state: "cool",
    note: "Discovery",
    parent_group_id: null,
    parent_group_name: null,
    industry: "Mattresses · DTC",
    owner: "Jamie Kwon",
  },
  {
    id: "ember",
    name: "Ember Coffee",
    initial: "EM",
    color: "#6b6454",
    arr: "$80k",
    state: "cool",
    note: "Renewal",
    parent_group_id: null,
    parent_group_name: null,
    industry: "Coffee · DTC",
    owner: "Jamie Kwon",
  },
  {
    id: "kindred",
    name: "Kindred Pet",
    initial: "KI",
    color: "#6b6454",
    arr: "$145k",
    state: "hot",
    note: "At risk · 48d",
    parent_group_id: null,
    parent_group_name: null,
    industry: "Pet supply · DTC",
    owner: "Jamie Kwon",
  },
  {
    id: "hearth",
    name: "Hearth Home Goods",
    initial: "HE",
    color: "#6b6454",
    arr: "$180k",
    state: "warm",
    note: "QBR prep · 5d",
    parent_group_id: null,
    parent_group_name: null,
    industry: "Home goods · DTC",
    owner: "Jamie Kwon",
  },
];

export const QUIVER_GROUP: AccountGroup = {
  id: "quiver-group",
  name: "Quiver Group",
  total_arr: "$700k combined",
  initials: "QV",
  brands: [
    {
      id: "quiver-supplements",
      name: "Supplements",
      initial: "QS",
      color: "#7a6b4a",
      arr: "$520k",
      state: "warm",
      note: "Expansion",
      parent_group_id: "quiver-group",
      parent_group_name: "Quiver Group",
      industry: "Supplements · DTC",
      owner: "Jamie Kwon",
    },
    {
      id: "quiver-rituals",
      name: "Rituals",
      initial: "QR",
      color: "#7a6b4a",
      arr: "$180k",
      state: "warm",
      note: "Expansion · Stage 2",
      parent_group_id: "quiver-group",
      parent_group_name: "Quiver Group",
      industry: "Wellness · DTC",
      owner: "Jamie Kwon",
    },
  ],
};

export const ACCOUNTS_FIXTURE: AccountsResponse = {
  groups: [NORTHSTAR_GROUP, QUIVER_GROUP],
  standalone: STANDALONE_ACCOUNTS,
};

/** Quick helper for the rail: only the accounts the reference shows under "Other upcoming". */
export const OTHER_UPCOMING_VISIBLE: Account[] = STANDALONE_ACCOUNTS.slice(0, 3);

/** Look up any account by id. */
export function findAccount(id: string): Account | null {
  for (const g of ACCOUNTS_FIXTURE.groups) {
    const match = g.brands.find((b) => b.id === id);
    if (match) return match;
  }
  return ACCOUNTS_FIXTURE.standalone.find((a) => a.id === id) ?? null;
}

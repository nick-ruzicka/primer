#!/usr/bin/env node
/**
 * Sanity check for the Tidepool pipeline-enrichment logic in page.tsx.
 * Replicates the filter on a realistic sample of the live Commercial
 * intelligence event and asserts we pull "$220K" out.
 */

// Real payload shape captured from GET /briefing/tidepool
const tidepoolCommercial = {
  id: "commercial",
  title: "Commercial",
  items: [
    { evid: "commercial_arr_0", label: "ARR", value: "$0", sub: null },
    {
      evid: "commercial_contract_1",
      label: "Contract",
      value: "No contract on file",
      sub: null,
    },
    {
      evid: "commercial_initial_platform_2",
      label: "Initial platform",
      value: "$220K",
      sub: "Discovery · Pipeline",
    },
  ],
};

const kindredCommercial = {
  id: "commercial",
  title: "Commercial",
  items: [
    { evid: "a", label: "ARR", value: "$145K", sub: "since 2024" },
    { evid: "b", label: "Expansion", value: "$45K", sub: "Closed Lost" },
  ],
};

const emptyCommercial = { id: "commercial", title: "Commercial", items: [] };

function deriveProspect(commercial) {
  return (
    commercial?.items.find(
      (i) => /pipeline/i.test(i.sub ?? "") && /\$/.test(i.value ?? ""),
    )?.value ?? null
  );
}

const cases = [
  ["tidepool (prospect w/ pipeline)", tidepoolCommercial, "$220K"],
  ["kindred (ARR, no pipeline label)", kindredCommercial, null],
  ["empty commercial section", emptyCommercial, null],
  ["undefined commercial", undefined, null],
];

let fail = 0;
for (const [label, input, expected] of cases) {
  const got = deriveProspect(input);
  const ok = got === expected;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${label} → ${JSON.stringify(got)} (expected ${JSON.stringify(expected)})`,
  );
  if (!ok) fail++;
}
process.exit(fail);

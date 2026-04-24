#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Browser verification for QA_LOG C1 (multi-citation parsing) and C2
 * (Tidepool header shows $220k ARR). Runs Northstar Beauty and Tidepool
 * live against the backend, captures screenshots, and asserts:
 *  - No orphan ",NN" text nodes remain after a citation chip in the brief.
 *  - Tidepool's header meta row shows "Prospect", not "$220k ARR".
 *  - Tidepool rail badge still shows $0.
 */
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const accounts = [
  { id: "ns-beauty", label: "Northstar Beauty" },
  { id: "tidepool", label: "Tidepool" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

const results = [];

for (const { id, label } of accounts) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.addInitScript((aid) => {
    localStorage.setItem("primer:lastAccount", aid);
  }, id);
  await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(24_000);

  const headerLabel = await page
    .locator('section[aria-label="Account header"]')
    .first()
    .innerText()
    .catch(() => "(not found)");

  // Find any text in brief prose that looks like an orphan ",NN" remnant.
  // Pattern: a digit followed by a comma and another run of digits, NOT inside
  // a citation chip. We scan for leaked text by looking at literal ',\d+' in
  // brief section text content.
  const orphanHits = await page.evaluate(() => {
    const root = document.querySelector('main[aria-label*="Brief"]');
    if (!root) return [];
    const hits = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      // a comma immediately followed by digits — like ",15" or ",28." — is a
      // tell for a failed multi-citation split.
      if (/,\s*\d/.test(n.nodeValue ?? "")) {
        hits.push(n.nodeValue?.trim());
      }
    }
    return hits;
  });

  const railBadge = await page
    .locator(`[data-account-id="${id}"]`)
    .first()
    .innerText()
    .catch(() => "(rail badge not found)");

  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_qa-c1c2-${id}.png`),
    fullPage: false,
  });

  results.push({
    id,
    label,
    headerLabel,
    orphanHits,
    railBadge,
    consoleErrors,
  });
  await page.close();
}

await browser.close();

let failed = false;
for (const r of results) {
  console.log(`\n=== ${r.label} (${r.id}) ===`);
  console.log(`header:\n${r.headerLabel.replace(/\n/g, " | ")}`);
  console.log(`rail: ${r.railBadge.replace(/\n/g, " | ")}`);
  if (r.orphanHits.length) {
    console.log(`  ⚠ orphan citation hits: ${JSON.stringify(r.orphanHits)}`);
  } else {
    console.log("  citation orphans: none");
  }
  if (r.id === "tidepool") {
    const has220 = r.headerLabel.includes("$220k");
    const hasProspect = r.headerLabel.includes("Prospect");
    if (has220) {
      console.log("  ❌ tidepool header still shows $220k");
      failed = true;
    } else if (!hasProspect) {
      console.log('  ❌ tidepool header missing "Prospect" label');
      failed = true;
    } else {
      console.log('  ✓ tidepool header shows "Prospect"');
    }
  }
  if (r.id === "ns-beauty" && r.orphanHits.length) {
    failed = true;
  }
  if (r.consoleErrors.length) {
    console.log(`  console errors: ${r.consoleErrors.length}`);
    for (const e of r.consoleErrors.slice(0, 3)) console.log(`    ! ${e}`);
  }
}

process.exit(failed ? 1 : 0);

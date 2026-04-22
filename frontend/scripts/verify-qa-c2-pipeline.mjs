#!/usr/bin/env node
/**
 * Browser verification for the QA C2 enhancement (+ S1 re-confirmation).
 * Walks Northstar Beauty, Tidepool, Kindred, Ember, verifies:
 *  - canonical long name in header (S1)
 *  - header meta row ARR label follows C2 rules (no misleading ARR for
 *    prospects; pipeline shown for prospects; real ARR shown otherwise)
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const accounts = [
  {
    id: "ns-beauty",
    name: "Northstar Beauty",
    expectedName: "Northstar Beauty",
    expectedArrLabel: /\$940k ARR/,
    forbidden: [],
  },
  {
    id: "tidepool",
    name: "Tidepool",
    expectedName: "Tidepool Swim Co.",
    expectedArrLabel: /Prospect · \$220K in discovery/,
    forbidden: [/\$220k ARR/i, /\$220K ARR/],
  },
  {
    id: "kindred",
    name: "Kindred",
    expectedName: "Kindred Pet Supply",
    expectedArrLabel: /\$(145|140)k ARR/i,
    forbidden: [],
  },
  {
    id: "ember",
    name: "Ember",
    expectedName: "Ember Coffee Co.",
    expectedArrLabel: /\$(80|75|85)k ARR/i,
    forbidden: [],
  },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

let failed = false;

for (const acc of accounts) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.addInitScript((aid) => {
    localStorage.setItem("primer:lastAccount", aid);
  }, acc.id);
  await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  // Wait enough for intelligence events to land (commercial arrives early).
  await page.waitForTimeout(18_000);

  const headerText = await page
    .locator('section[aria-label="Account header"]')
    .first()
    .innerText()
    .catch(() => "(not found)");

  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_qa-c2-pipeline-${acc.id}.png`),
    fullPage: false,
    clip: { x: 260, y: 0, width: 1180, height: 240 },
  });

  const nameOk = headerText.includes(acc.expectedName);
  const arrOk = acc.expectedArrLabel.test(headerText);
  const forbiddenHits = acc.forbidden.filter((re) => re.test(headerText));

  console.log(`\n=== ${acc.name} (${acc.id}) ===`);
  console.log(`header: ${headerText.replace(/\n/g, " | ")}`);
  console.log(`  name match    : ${nameOk ? "✓" : "❌"}  (expected "${acc.expectedName}")`);
  console.log(`  arr label match: ${arrOk ? "✓" : "❌"}  (expected /${acc.expectedArrLabel.source}/)`);
  if (forbiddenHits.length) {
    console.log(`  ❌ forbidden patterns present: ${forbiddenHits.map((r) => r.source).join(", ")}`);
  }
  if (consoleErrors.length) {
    console.log(`  console errors: ${consoleErrors.length}`);
    for (const e of consoleErrors.slice(0, 3)) console.log(`    ! ${e}`);
  }
  if (!nameOk || !arrOk || forbiddenHits.length) failed = true;

  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);

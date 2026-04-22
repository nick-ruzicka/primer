#!/usr/bin/env node
/**
 * Final cross-origin integration probe after CORS fix.
 * Loads 3 accounts, confirms:
 *  - No console errors
 *  - No failed requests to :8000
 *  - Confidence ring value varies per account (pulled from done.total_tokens)
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const accounts = [
  { id: "ns-beauty", label: "Beauty" },
  { id: "kindred", label: "Kindred" },
  { id: "ember", label: "Ember" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

for (const { id, label } of accounts) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    requestFailures.push(`${r.failure()?.errorText} ${r.url()}`);
  });

  await page.addInitScript((aid) => {
    localStorage.setItem("primer:lastAccount", aid);
  }, id);
  await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));

  // Wait for stream to complete — backend takes ~18s per the earlier probe.
  await page.waitForTimeout(22_000);

  // Read the confidence ring label text (e.g. "4726 · likely")
  const ringText = await page
    .locator("text=/^\\d+\\s*·/")
    .first()
    .innerText()
    .catch(() => "(not found)");

  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_final-cross-origin-${id}.png`),
    fullPage: false,
  });

  console.log(`${label} (${id}): ring="${ringText.replace(/\n/g, " ")}"`);
  if (consoleErrors.length) console.log(`  console-errors: ${consoleErrors.length}`);
  if (requestFailures.length) console.log(`  req-failures: ${requestFailures.length}`);
  consoleErrors.slice(0, 3).forEach((e) => console.log(`    ! ${e}`));
  requestFailures.slice(0, 3).forEach((e) => console.log(`    ! ${e}`));

  await page.close();
}

await browser.close();

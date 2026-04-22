#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Runs the Beauty / Kindred / Ember / Tidepool integration test per the
 * T1 spec. Each account: load, wait for completion, capture screenshot,
 * report first paragraph + warning count.
 */
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const ACCOUNTS = [
  { id: "ns-beauty", label: "Beauty" },
  { id: "kindred", label: "Kindred" },
  { id: "ember", label: "Ember" },
  { id: "tidepool", label: "Tidepool" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();

for (const { id, label } of ACCOUNTS) {
  await page.addInitScript((accountId) => {
    localStorage.setItem("primer:lastAccount", accountId);
  }, id);
  await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  // Wait 14s for stream to complete
  await page.waitForTimeout(14_000);
  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_phase8-live-${id}.png`),
    fullPage: false,
  });

  const briefLead = (
    await page
      .locator(".the-read, .why-stack")
      .first()
      .innerText()
      .catch(() => "")
  )
    .slice(0, 140)
    .replace(/\s+/g, " ");
  const _warningCount = await page
    .locator('[role="dialog"], .bg-bad-soft, .bg-warn-soft\\/60')
    .count()
    .catch(() => 0);
  const banners = await page
    .locator(
      "text=SOURCE CONTRADICTION, text=UNSUPPORTED CLAIM, text=STALE DATA, text=MISSING GROUND",
    )
    .count()
    .catch(() => 0);
  console.log(
    `${label} (${id}): lead="${briefLead.slice(0, 100)}${briefLead.length > 100 ? "..." : ""}" · warnings=${banners}`,
  );
}

await browser.close();

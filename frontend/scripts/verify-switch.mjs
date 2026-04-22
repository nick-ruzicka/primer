#!/usr/bin/env node
/**
 * Verifies account switching: loads Northstar Beauty, captures complete,
 * then sets localStorage to Kindred and reloads so the bootstrap picks the
 * new account. Captures Kindred after its stream completes.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
const HOST = process.env.PRIMER_HOST ?? "http://localhost:3002";

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();

// Fresh load at Northstar Beauty
await page.goto(HOST, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.removeItem("primer:lastAccount");
  document.documentElement.classList.add("dark");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(7500);
await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase5-beauty-complete.png"),
  fullPage: false,
});
console.log("Wrote Beauty complete");

// Switch to Kindred via localStorage + reload (bootstrap picks it up)
await page.evaluate(() => {
  localStorage.setItem("primer:lastAccount", "kindred");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(7500);
await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase5-kindred-complete.png"),
  fullPage: false,
});
console.log("Wrote Kindred complete");

await browser.close();

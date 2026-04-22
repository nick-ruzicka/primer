#!/usr/bin/env node
/**
 * Walks through the mock SSE stream timeline: captures the app at 500ms (just
 * after load), 2000ms (intelligence populated, brief pending), 5000ms (brief
 * mid-stream), and 10000ms (complete with warnings). Used to verify that each
 * phase of the stream renders as expected.
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

// Clear any persisted last-account so we always start at Beauty
await context.addInitScript(() => {
  try {
    window.localStorage.removeItem("primer:lastAccount");
  } catch {}
});

await page.goto(HOST, { waitUntil: "commit" });
await page.waitForLoadState("domcontentloaded");
await page.evaluate(() => document.documentElement.classList.add("dark"));

const checkpoints = [
  { label: "stream-500ms", delay: 500 },
  { label: "stream-2000ms", delay: 1500 },
  { label: "stream-5000ms", delay: 3000 },
  { label: "stream-complete", delay: 5500 },
];

for (const cp of checkpoints) {
  await page.waitForTimeout(cp.delay);
  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_phase5-${cp.label}.png`),
    fullPage: false,
  });
  console.log(`Wrote ${cp.label}`);
}

await browser.close();

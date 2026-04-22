#!/usr/bin/env node
/** Full Mode 4 writeup capture — hero, middle sections, closing. */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();
await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(400);
await page.keyboard.press("4");
await page.waitForTimeout(400);

const stops = [
  { label: "01-hero", y: 0 },
  { label: "02-problem", y: 700 },
  { label: "03-modes", y: 1600 },
  { label: "04-options-05", y: 3000 },
  { label: "05-skills-09", y: 5200 },
  { label: "06-plan-10", y: 7000 },
  { label: "07-tradeoffs-12", y: 8500 },
  { label: "08-closing-14", y: 10500 },
];

for (const stop of stops) {
  await page.evaluate((y) => {
    const scroller = document.querySelector("main") ?? document.querySelector('[role="article"]') ?? document.scrollingElement;
    const writeup = document.querySelector("article");
    if (writeup) {
      // the writeup article's parent is a scrollable div
      const target = writeup.parentElement;
      if (target && target.scrollTo) target.scrollTo({ top: y, behavior: "instant" });
    }
  }, stop.y);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_t3-writeup-${stop.label}.png`),
    fullPage: false,
  });
}
console.log(`Wrote ${stops.length} writeup screenshots`);

// Also expand all speaker notes and capture
await page.evaluate(() => {
  document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const writeup = document.querySelector("article");
  const target = writeup?.parentElement;
  target?.scrollTo({ top: 1400, behavior: "instant" });
});
await page.waitForTimeout(250);
await page.screenshot({
  path: join(OUT_DIR, `2026-04-22_t3-writeup-speaker-notes-expanded.png`),
  fullPage: false,
});

await browser.close();

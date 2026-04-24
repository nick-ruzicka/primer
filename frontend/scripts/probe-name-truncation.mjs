#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Probe: what exactly does the account header render for Kindred, Tidepool,
 * Ember, Quiver Supplements? Compare to the rail text.
 */
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
await mkdir(OUT_DIR, { recursive: true });

const accounts = [
  { id: "kindred", expected: "Kindred Pet Supply" },
  { id: "tidepool", expected: "Tidepool Swim Co." },
  { id: "ember", expected: "Ember Coffee Co." },
  { id: "quiver-supplements", expected: "Quiver Supplements" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

for (const { id, expected } of accounts) {
  const page = await ctx.newPage();
  await page.addInitScript((aid) => {
    localStorage.setItem("primer:lastAccount", aid);
  }, id);
  await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(8_000);

  const headerH1 = await page
    .locator('section[aria-label="Account header"] h1 span')
    .first()
    .innerText()
    .catch(() => "(h1 span not found)");

  const headerH1Raw = await page
    .locator('section[aria-label="Account header"] h1')
    .first()
    .innerText()
    .catch(() => "(h1 not found)");

  const bbox = await page
    .locator('section[aria-label="Account header"] h1 span')
    .first()
    .boundingBox()
    .catch(() => null);

  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_name-probe-${id}.png`),
    fullPage: false,
    clip: { x: 260, y: 0, width: 1180, height: 240 },
  });

  console.log(`${id.padEnd(24)} expected=${JSON.stringify(expected)}`);
  console.log(`  h1 span: ${JSON.stringify(headerH1)}`);
  console.log(
    `  h1 full: ${JSON.stringify(headerH1Raw.replace(/\n/g, " | "))}`,
  );
  if (bbox)
    console.log(
      `  bbox:    ${bbox.width.toFixed(0)}×${bbox.height.toFixed(0)}`,
    );

  await page.close();
}

await browser.close();

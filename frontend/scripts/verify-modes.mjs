#!/usr/bin/env node
/**
 * Cycles through the three view modes (Split / Workspace / Reading) via keyboard
 * shortcuts, takes a viewport screenshot for each, then a scrolled Reading view.
 * Writes artifacts to verification-output/ with the prefix `phase3-mode-*`.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "verification-output");
const HOST = process.env.PRIMER_HOST ?? "http://localhost:3002";
const theme = process.env.PRIMER_THEME ?? "dark";

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: theme === "light" ? "light" : "dark",
});
const page = await context.newPage();
await page.goto(HOST, { waitUntil: "networkidle", timeout: 15_000 });
if (theme === "light") {
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
} else {
  await page.evaluate(() => document.documentElement.classList.add("dark"));
}
await page.waitForTimeout(500);

const label = theme === "light" ? "light" : "dark";

// Split (default, kbd 1)
await page.keyboard.press("1");
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT_DIR, `2026-04-22_phase3-mode-split-${label}.png`), fullPage: false });

// Workspace (kbd 2)
await page.keyboard.press("2");
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT_DIR, `2026-04-22_phase3-mode-workspace-${label}.png`), fullPage: false });

// Reading (kbd 3)
await page.keyboard.press("3");
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT_DIR, `2026-04-22_phase3-mode-reading-${label}.png`), fullPage: false });

// Reading scrolled down
await page.evaluate(() => {
  const main = document.querySelector("main");
  const scroller = main?.parentElement;
  scroller?.scrollTo({ top: 900, behavior: "instant" });
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT_DIR, `2026-04-22_phase3-mode-reading-scrolled-${label}.png`), fullPage: false });

console.log(`Wrote 4 mode screenshots (${label})`);
await browser.close();

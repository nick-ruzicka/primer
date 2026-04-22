#!/usr/bin/env node
/**
 * Captures the Reading mode with the intelligence overlay open.
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
await page.goto(HOST, { waitUntil: "networkidle", timeout: 15_000 });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(400);

await page.keyboard.press("3"); // Reading
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Intelligence/ }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase4-reading-intel-overlay.png"),
  fullPage: false,
});
console.log("Wrote overlay screenshot");
await browser.close();

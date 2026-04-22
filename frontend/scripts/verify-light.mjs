#!/usr/bin/env node
/** Light-theme QA pass: all three modes + writeup + intel overlay. */
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
  colorScheme: "light",
});
const page = await context.newPage();
await page.goto(HOST, { waitUntil: "domcontentloaded" });
// Wait a moment for the page to hydrate
await page.waitForTimeout(400);

// Toggle to light via the tweaks panel (the store owns theme; we go through
// the real UI path so the <html>.dark class stays consistent).
await page.getByRole("button", { name: /Open tweaks/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^Light$/ }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /Close tweaks/i }).click();

// Wait for Beauty stream to complete
await page.waitForTimeout(7500);

for (const [key, label] of [["1", "split"], ["2", "workspace"], ["3", "reading"]]) {
  await page.keyboard.press(key);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: join(OUT_DIR, `2026-04-22_phase7-${label}-light.png`),
    fullPage: false,
  });
}

// Reading + intel overlay
await page.keyboard.press("3");
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^Intelligence/ }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase7-reading-overlay-light.png"),
  fullPage: false,
});

// Writeup
await page.keyboard.press("4");
await page.waitForTimeout(200);
await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase7-writeup-light.png"),
  fullPage: false,
});

console.log("Light QA pass complete");
await browser.close();

#!/usr/bin/env node
/**
 * Probes a cross-origin live connection (NEXT_PUBLIC_API_BASE=http://localhost:8000):
 * - captures console errors
 * - captures network failures to :8000
 * - waits 9s for the stream to complete
 * - reports whether CORS or other errors blocked the flow
 */
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

const consoleMessages = [];
const failedRequests = [];

page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on("requestfailed", (req) => {
  failedRequests.push(`${req.failure()?.errorText} ${req.url()}`);
});
page.on("response", async (res) => {
  if (res.url().includes("localhost:8000") && (res.status() >= 400 || res.status() === 0)) {
    failedRequests.push(`HTTP ${res.status()} ${res.url()}`);
  }
});

await page.goto("http://localhost:3002", { waitUntil: "domcontentloaded" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(9000);

await page.screenshot({
  path: join(OUT_DIR, "2026-04-22_phase8-live-crossorigin.png"),
  fullPage: false,
});

console.log("---console errors/warnings---");
consoleMessages.forEach((m) => console.log(m));
console.log("---failed requests---");
failedRequests.forEach((m) => console.log(m));

// Check if brief rendered
const briefText = await page.locator(".the-read").first().innerText().catch(() => "");
console.log(`---brief first paragraph: ${briefText.slice(0, 80)}${briefText.length > 80 ? "..." : ""}---`);

await browser.close();

#!/usr/bin/env node
// Visual verification helper — screenshots the running dev server at each viewport
// we care about and writes artifacts to verification-output/ for side-by-side diffing
// against reference/screenshots/.
//
// Usage:
//   node scripts/verify-visual.mjs                # screenshots the base shell
//   node scripts/verify-visual.mjs --name foo     # labels output with `foo`
//   node scripts/verify-visual.mjs --path "/?m=2" # custom path under http://localhost:3000

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "verification-output");

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}

const name = flag("name", "shell");
const path = flag("path", "/");
const host = flag("host", process.env.PRIMER_HOST || "http://localhost:3002");
const theme = flag("theme", null); // "dark" | "light" | null (use app default)

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
const outFile = join(OUT_DIR, `${timestamp}_${name}.png`);

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme === "light" ? "light" : "dark",
  });
  const page = await context.newPage();

  const url = `${host}${path}`;
  console.log(`[verify-visual] ${name} → ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
  } catch (err) {
    console.error(`[verify-visual] FAIL: ${err.message}`);
    await browser.close();
    process.exit(2);
  }

  if (theme === "light") {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  } else if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }

  // Let fonts settle
  await page.waitForTimeout(600);

  await page.screenshot({ path: outFile, fullPage: true });
  console.log(`[verify-visual] wrote ${outFile}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

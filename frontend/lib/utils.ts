import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Backend intelligence fields flow into intel-card.tsx's
// dangerouslySetInnerHTML. Fixtures intentionally include <em>/<b> for visual
// emphasis; live content could contain anything. Use a safe whitelist approach.
const ALLOWED_TAGS = new Set(["em", "b", "strong", "i", "mark"]);

export function sanitizeInlineHtml(input: string | null | undefined): string {
  if (!input) return "";

  const div = document.createElement("div");
  div.textContent = input;
  let html = div.innerHTML;

  // Restore only the whitelisted formatting tags by careful regex.
  // Match opening/closing tags, extract tag name, only allow specific tags.
  const tagRe = /&lt;(\/?)(em|b|strong|i|mark)&gt;/gi;
  html = html.replace(tagRe, "<$1$2>");

  // Final safety check: use a temporary element and reject if it contains script/event handlers
  const test = document.createElement("div");
  test.innerHTML = html;
  const scripts = test.querySelectorAll("script");
  if (scripts.length > 0) return input;  // Reject if script tags are present

  // Check for event handler attributes
  const allElements = test.querySelectorAll("*");
  for (const el of allElements) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith("on")) return input;  // Reject if event handlers found
    }
  }

  return html;
}

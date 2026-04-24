import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Backend intelligence fields flow into intel-card.tsx's
// dangerouslySetInnerHTML. Fixtures intentionally include <em>/<b> for visual
// emphasis; live content (Exa snippets) could contain anything. Allow only the
// emphasis tags fixtures use and escape the rest.
const ALLOWED_TAGS = new Set(["em", "b", "strong", "i", "mark"]);
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

export function sanitizeInlineHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(TAG_RE, (full, name: string) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const isClose = full.startsWith("</");
    return isClose ? `</${tag}>` : `<${tag}>`;
  });
}

/**
 * V1 hedge-phrase detector for inference-voice prose styling.
 *
 * Returns true if the given paragraph text contains any of the hedge
 * markers enforced by backend/skills/master.md, matched at word
 * boundaries (case-insensitive).
 *
 * Known limitation — adjective use of "likely" ("a likely buyer") is a
 * false positive. Documented in docs/superpowers/specs/2026-04-24-references-block-design.md §6
 * and the V2 parked spec removes this class via structured markers.
 *
 * Structured-span V2 plan: specs/10_INFERENCE_SPANS_V2.md.
 */
export function isInferenceParagraph(text: string): boolean {
  return HEDGE_RE.test(text);
}

// Word-boundary match. Phrases like "this suggests" include the preceding
// article so false-matches on "suggest" inside "suggestions" are avoided.
const HEDGE_RE =
  /\b(?:likely|probably|seems|appears|suggests?|my read|this read|reads less like|reads more like|looks like)\b/i;

/**
 * Count matches per hedge phrase, for V1 instrumentation (spec V2 §7).
 * Returns a map of phrase → occurrence count.
 */
export function hedgeMarkersIn(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const patterns: [string, RegExp][] = [
    ["likely", /\blikely\b/gi],
    ["probably", /\bprobably\b/gi],
    ["seems", /\bseems\b/gi],
    ["appears", /\bappears\b/gi],
    ["suggests", /\bsuggests?\b/gi],
    ["my read", /\bmy read\b/gi],
    ["this read", /\bthis read\b/gi],
    ["reads less like", /\breads less like\b/gi],
    ["reads more like", /\breads more like\b/gi],
    ["looks like", /\blooks like\b/gi],
  ];
  for (const [label, re] of patterns) {
    const m = text.match(re);
    if (m && m.length > 0) counts[label] = m.length;
  }
  return counts;
}

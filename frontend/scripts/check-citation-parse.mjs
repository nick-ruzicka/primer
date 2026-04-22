#!/usr/bin/env node
/**
 * Quick sanity check for the citation tokenizer's multi-citation handling.
 * Mirrors tokenizeInline() in lib/live-brief-parser.ts verbatim.
 */

function tokenizeInline(text) {
  const out = [];
  const regex =
    /\*\*([^*]+)\*\*|_([^_]+)_|·(\d+(?:\s*[,，]\s*\d+)*)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const [, bold, italic, cite] = match;
    if (bold) out.push({ kind: "bold", value: bold });
    else if (italic) out.push({ kind: "italic", value: italic });
    else if (cite) {
      const nums = cite.split(/\s*[,，]\s*/).map((n) => Number(n));
      nums.forEach((n, i) => {
        if (i > 0) out.push({ kind: "text", value: " " });
        out.push({ kind: "cite", n });
      });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

const cases = [
  ["hello ·14 world", [14]],
  ["hello ·14 ·15 world", [14, 15]],
  ["hello ·14,15 world", [14, 15]],
  ["hello ·14, 15 world", [14, 15]],
  ["hello ·14 ,15 world", [14, 15]],
  ["hello ·14, ·15 world", [14, 15]],
  ["past-due $18K with AP blocked ·14 ,15", [14, 15]],
  ["tool overlap ·24 ,25.", [24, 25]],
  ["actively hiring ·26 ,28.", [26, 28]],
];

let pass = 0;
let fail = 0;
for (const [input, expected] of cases) {
  const tokens = tokenizeInline(input);
  const cites = tokens.filter((t) => t.kind === "cite").map((t) => t.n);
  const ok =
    cites.length === expected.length &&
    cites.every((n, i) => n === expected[i]);
  if (ok) {
    pass++;
    console.log(`  ok   ${JSON.stringify(input)} → [${cites.join(", ")}]`);
  } else {
    fail++;
    console.log(
      `  FAIL ${JSON.stringify(input)} → got [${cites.join(", ")}], expected [${expected.join(", ")}]`,
    );
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);

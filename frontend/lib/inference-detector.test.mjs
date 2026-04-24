import test from "node:test";
import assert from "node:assert/strict";
import { isInferenceParagraph, hedgeMarkersIn } from "./inference-detector.ts";

test("flags 'this suggests' as inference", () => {
  assert.equal(
    isInferenceParagraph("This suggests the account will churn by Q3."),
    true,
  );
});

test("flags 'likely' as inference (modal use)", () => {
  assert.equal(
    isInferenceParagraph("Likely the most productive opening is AP."),
    true,
  );
});

test("also flags adjective-use 'likely' (known V1 false positive)", () => {
  // Documented limitation — we want this to flag even though it's a FP.
  assert.equal(
    isInferenceParagraph("A likely buyer emerged this week."),
    true,
  );
});

test("does not flag pure fact restatement", () => {
  assert.equal(
    isInferenceParagraph("Past-due AR is $18,500, now 41 days overdue."),
    false,
  );
});

test("handles multi-sentence paragraphs (first match wins)", () => {
  assert.equal(
    isInferenceParagraph(
      "Past-due AR is $18,500. My read: AP block is the inflection.",
    ),
    true,
  );
});

test("hedgeMarkersIn returns per-phrase counts", () => {
  const counts = hedgeMarkersIn(
    "Likely churn. This suggests risk. My read: hold.",
  );
  assert.equal(counts["likely"], 1);
  assert.equal(counts["suggests"], 1);
  assert.equal(counts["my read"], 1);
});

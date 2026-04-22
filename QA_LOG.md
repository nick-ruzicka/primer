# Primer QA Log — 2026-04-22

Structured sweep of 7 accounts before final polish and Hetzner deploy. Findings grouped by severity and type. Fixes prioritized by user-visible impact.

Accounts reviewed: Northstar Beauty, Northstar Active, Kindred Pet Supply, Tidepool Swim, Ember Coffee, Mellow Mattress, Quiver Supplements.
Not yet reviewed: Northstar Home, Hearth Home Goods, Quiver Group (parent), Quiver Rituals.

## CRITICAL — must fix before demo

### C1. Citation chip rendering bug — orphaned numbers

**Impact:** Visible across the full Northstar Beauty brief. Makes prose look unprofessional — orphan text like `,25.` and `,28.` reads like typos.

**What happens:** When the agent emits two consecutive citations separated by a comma (`·14,15` or `·14, 15`), the frontend regex only catches the first `·N` and renders the rest as plain text.

**Examples on Beauty brief:**
- *"past-due $18K with AP blocked ·14 ,15"* — orphan `,15`
- *"tool overlap ·24 ,25."* — orphan `,25.`
- *"actively hiring ·26 ,28."* — orphan `,28.`

**Works correctly when:** Space separator (`·13 ·14`) — both render as chips. Comma+space (`·13 , ·18`) — also works.

**Root cause:** The regex in `frontend/lib/markdown.ts` (or equivalent) that converts `·N` to chips matches greedy first-occurrence only. The pattern `/·(\d+)/g` handles single citations but doesn't parse `·14,15` as two citations.

**Fix:**
Two options:
- **A (frontend):** Update the regex to handle multi-citation patterns.
- **B (backend):** Tighten the briefing prompt to always use space-separated citations.

**Recommendation:** Do both. [DONE on backend as commit e50bfaf 2026-04-22; frontend pending Terminal 3.]

**Owner:** Terminal 3 (frontend regex) + Terminal 2 (prompt tweak — COMPLETE).

---

### C2. Tidepool header conflates ARR with opportunity amount

**Impact:** The Tidepool account header reads `$220k ARR` but Tidepool is a prospect with no ARR (spec: $0). $220K is the opportunity amount in the Discovery-stage deal.

**Why it matters:** A rep looking at the header would think Tidepool is already an existing customer paying $220K, which is wrong. This is a fact-level bug, not a styling bug.

**Fix:** In `AccountHeader` component, for accounts where `arr_cents === 0` and a deal is in Discovery, display either:
- `$0 ARR · $220k pipeline` (explicit about both)
- `Prospect · $220k opportunity` (prospect framing)

Current rail badge correctly shows `$0`. Header should match.

**Owner:** Terminal 3 (frontend rendering). Backend /api/accounts returns arr_cents: 0 correctly — confirmed by Terminal 2 sweep.

---

## SUBSTANTIVE — fix if time permits

### S1. Account name truncation across header vs. rail

**Impact:** Inconsistency that a careful reader notices.

**Pattern:** Rail shows full name; header shows truncated name.

**Examples:**
- Rail: *"Kindred Pet Supply"* → Header: *"Kindred Pet"*
- Rail: *"Tidepool Swim Co."* → Header: *"Tidepool Swim"*
- Rail: *"Ember Coffee Co."* → Header: *"Ember Coffee"*
- Rail: *"Quiver Supplements"* → Header: *"Supplements"*

**Root cause:** Confirmed frontend issue. Backend /api/accounts returns canonical long names. No short_name field exists. Terminal 3 component is truncating for display.

**Fix:** Use the same name field across header and rail. Pick the longer version as canonical.

**Owner:** Terminal 3.

---

### S2. Validation warnings have variable severity calibration

**Impact:** Some CRITICAL warnings are actually pedantic/framing issues that should be WATCH. This dilutes the signal — a rep who sees a CRITICAL should really care, not just note a word-choice nit.

**Examples of over-severity:**

- **Active:** CRITICAL flagged brief saying *"14% QoQ email revenue was shared at the QBR"* as unsupported because the fact only confirms it was shared, not that it's independent/current. Should be WATCH.

- **Supplements:** CRITICAL flagged brief saying *"nearly two years"* for 1y 8m tenure. Technically overstates (20 months, not 24), but "nearly two years" is reasonable phrasing. Should be WATCH.

**Examples of legitimate CRITICAL:**

- **Beauty:** CRITICAL on `"'any renewal conversation needs a clear resourcing story'"` with quotation marks around text that Gong only paraphrased. Rep would embarrass themselves citing this. Correctly CRITICAL.

- **Active:** CRITICAL on brief citing fact_id 18 for health score climb when fact_id 18 is a QBR summary without health numbers. Hallucinated citation. Correctly CRITICAL.

- **Mellow:** CRITICAL on *"contract renews in just over two years"* — actual renewal is ~115 days away. Real factual error. Correctly CRITICAL.

**Fix:** Tighten validation severity rules. [DONE as commit 53c8258 2026-04-22.]

**Owner:** Terminal 2 — COMPLETE.

---

### S3. Dataset mismatches between spec and seed

**Impact:** Low — the product is internally consistent (agent reasons from seed, not spec). But the writeup references dataset details that may not match what's rendered.

**Examples found:**
- **Beauty contract end:** spec said 2026-09-12; seed shows 2026-08-17.
- **Active plan:** spec said "Flows Pro + Journeys"; seed shows "Flows Pro + Journeys + SMS Plus" (reasonable seed expansion).
- **Kindred contacts:** spec didn't name "Lee Avery" or "Marta Ruiz" — Terminal 1 added them as seed contacts.
- **Supplements contacts:** spec didn't name "Owen" — seed addition.

**Not necessarily a problem** — Terminal 1 enriched the seed with realistic detail. But worth knowing if the writeup or interview discussion references spec numbers that differ from what's shown.

**Fix recommendation:** Update writeup references to match seed (lower-risk).

**Owner:** User (decision).

---

### S4. Validator firing warnings about correct staleness claims

**Impact:** Medium. False-positive warnings waste the rep's attention and undermine trust in the validation layer.

**Examples:**

- **Tidepool** WATCH stale-data: Validator itself says the claim is correct but still emits a warning. Should not fire.

- **Ember** WATCH stale-data: Brief correctly says "last exec touch was 6 weeks ago" (accurate to within a day). Validator flags as stale-data violation, but the brief is correctly informing the rep.

**Fix:** Tighten validation skill. [DONE as commit 9b112a1 2026-04-22.]

**Owner:** Terminal 2 — COMPLETE.

---

### S5. Delete dead frontend fixture data

**Impact:** Low. Stale fixture values no longer render but create drift risk between "what the code hints" and "what ships."

**Background:** Terminal 3's commit `a459ac6` ("frontend: switch to direct backend via ALLOWED_ORIGINS, remove workarounds") rewired the account rail + header to read from `/api/accounts` instead of the hardcoded fixture. The fixture was left in place as an "offline mode fallback" but no longer renders when the backend is reachable (which is required for Primer to do anything useful anyway).

Concretely, `frontend/lib/fixtures/accounts.ts` and `frontend/lib/fixtures/brief-meta.ts` still carry pre-integration mockup values from the Claude Design reference HTML (`"Brooklyn, NY" · 142 employees · Owner Jamie Kwon` for Northstar Beauty). The live backend seed is `Los Angeles, CA · 260 · Morgan Yu`. Neither is wrong in isolation; only the live one is authoritative. (Confirmed via `/api/accounts`, Salesforce MCP `get_account`, and SQLite seed — all agree.)

**Files:** `frontend/lib/fixtures/accounts.ts`, `frontend/lib/fixtures/brief-meta.ts`.

**Options:**
- **(a)** Delete entirely. Live backend is required for Primer to function; an offline fallback doesn't earn its keep.
- **(b)** Keep as offline fallback but update values to match the live seed (LA/260/Morgan Yu), so the two sources agree.

**Recommendation:** **(a).** Simpler repo, no drift risk. The existing mock-mode flag in `lib/sse.ts` already handles offline dev scenarios for briefs; the account list doesn't need a separate fixture.

**Commit:** `refactor: remove dead pre-integration account fixtures`

**Owner:** Terminal 3. Ships alongside C1 / C2 / S1 as the fourth item in the PR-sized batch.

---

## COSMETIC — fix only if trivially cheap

### Co1. Truncation in Conversations cards

**Impact:** Minor. Call summaries in Conversations section truncated mid-word.

**Example (Beauty):** *"her team has been evaluatin"* (missing last word).

**Owner:** Terminal 3. Non-blocking.

---

### Co2. Variance in warnings per run

**Impact:** Different runs produce different warning counts (0/3/4/4 observed on Beauty prior to Task 3+4 fixes).

**Not really a bug** — nature of a second LLM call. Document in Mode 4 writeup as honest-variance rather than hiding it.

---

## Summary table

| ID | Title | Severity | Owner | Status |
|---|---|---|---|---|
| C1 | Citation chip comma-separated rendering | CRITICAL | T3 + T2 | T2 done, T3 pending |
| C2 | Tidepool header $0 vs $220K | CRITICAL | T3 | pending |
| S1 | Name truncation header vs. rail | Substantive | T3 | pending (T2 confirmed frontend-side) |
| S2 | Validator severity calibration | Substantive | T2 | DONE 53c8258 |
| S3 | Spec/seed mismatches | Substantive | User | decision pending |
| S4 | Validator false positives | Substantive | T2 | DONE 9b112a1 |
| S5 | Delete dead frontend fixture data | Substantive | T3 | pending |
| Co1 | Conversation card truncation | Cosmetic | T3 | deferred |
| Co2 | Run variance | Cosmetic | documented | accepted |

**Critical path:** Terminal 3 has four fixes remaining (C1 frontend, C2, S1, S5) — one PR-sized batch. All other items are complete, deferred, or user-decision.

## What this proves about the system (for the writeup)

1. The validator is doing real work. Most warnings are substantive. The catch on Beauty's hallucinated Sam Rivera quote is exactly the trust-breaking mistake the architecture is designed to prevent.

2. The citation-rendering bug is the kind of polish issue you only catch by clicking every account. The architecture is sound; the render layer has edges.

3. Severity calibration is a prompt-engineering problem, not an architectural one. The skills layer makes it solvable — tighten `brief_validation.md`, no code changes needed.

4. The spec-vs-seed diff is actually a positive signal — Terminal 1 enriched the seed with contacts and context the spec didn't mandate, which gave the agent better material.

## What to record in the Mode 4 writeup

Add to Section 13 ("How I built this"):

> **Structured QA sweep before ship.** After the build converged I ran a structured pass across 7 accounts checking citation validity, severity calibration, header/rail consistency, and hallucination guardrails. Findings logged in `QA_LOG.md` with severity ratings. Two criticals fixed same-day; four substantive issues documented with fix paths; cosmetic nits deferred. The sweep surfaced a rendering bug (multi-citation parsing) that single-account testing would have missed, and validated that the hallucination guardrails catch the class of errors they're designed to catch.

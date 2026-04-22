# Verification Log

Per-component verification against reference screenshots, timestamped. Fail entries include
the drift observed and the fix; every fail that closes includes a revalidated PASS note.

Reference screenshots live in `reference/screenshots/`. Verification artifacts are written
to `verification-output/` by `scripts/verify-visual.mjs` and are gitignored.

---

## 2026-04-22T03:20:00Z — Phase 4 · Intelligence panel

**Status:** PASS

**Compared:** `verification-output/2026-04-22_phase4-reading-intel-overlay.png` + `_phase3-mode-split-dark.png` (re-captured) + `_phase3-mode-workspace-dark.png` (re-captured) against references `03_workspace_view_dark.png`, `05_reading_view_intelligence_panel_open.png`, `08_workspace_view_cards_open.png`.

**Matches:**
- Six sections render in correct order: Relationship, Commercial, Product & usage, Conversations, Portfolio — Northstar Group, External signals.
- Section headers: mono `01` kicker, serif title, right-aligned `{visible} of {total}` count.
- Relationship section: Priya + Sam in 2-col avatar-card grid; full-width health card with sparkline below.
- Commercial section: `$18,500` hero card renders with red tint, big serif number, `PAST DUE` red flag pill, "41 days overdue" meta, "Open in NetSuite" dark CTA button.
- Product/Conversations/Portfolio: standard cards with label + serif value + HTML-escaped sub text + source pill + time.
- External signals: web cards with favicon tile + source label + serif title + snippet with `<mark>`-highlighted phrases + "Exa (web)" amber pill.
- Filter chips: All / Flagged / Critical only with counts; Search input.
- Hover state: moving mouse over a card activates `.hot` class (yellow ring + lift); state is lifted to the page so brief citations can highlight matching evidence (wire-up in phase 5).
- Reading mode overlay: clicking "Intelligence" in the topbar opens a right-side slide-over (560px) with close button, description subtitle, filters, and all sections.

**Variant coverage:**
- `compact` (Split Mode 1): narrow column; header shows "grouped by topic · click a ·n in the brief to jump".
- `workspace` (Mode 2): full filter bar + adaptive section layouts.
- `overlay` (Reading Mode 3): slide-over dialog, close button, same filter bar.

**Minor drift (Phase 7 polish):**
- Sparkline is a static stub — good enough visually, but the reference animates it in. Accepting for now.
- External card favicon tile uses text (`RD`, `in`, `🎙`, `GD`) rather than actual favicons; matches reference fallback behavior, but could be nicer.
- `ms-auto`/`pill time` right-alignment works but some hero card CTAs break onto their own line at narrower widths — not visible in current Mode 1/2 captures, but worth watching.

---

## 2026-04-22T02:45:00Z — Phase 3 · Brief rendering

**Status:** PASS

**Compared:** all four mode screenshots in `verification-output/2026-04-22_phase3-mode-*.png` against references `02_split_view_dark.png`, `03_workspace_view_dark.png`, `04_reading_view_dark.png`, `06_reading_view_scrolled.png`.

**Matches:**
- Section 01 · The read (very likely): serif body (Fraunces 17.5px 1.6 line height, max-width 62ch), bolded key phrases (`trust-repair call`, `vendor-consolidation review`, `18,500 past-due balance`, `Commit`), inline citation chips with source-colored dots.
- Section 02 · Why this read (likely): sans body (Inter Tight 14px 1.6 line-height, max-width 68ch), italic hedge lines at paragraph ends.
- Section 03 · What to do on the call (agent recommendation, yellow accent pill): A1–A5 actions with bold body + italic rationale, dashed dividers between items.
- Section 04 · Suggested talk track (draft — not sent, neutral pill): auto-numbered talk-list.
- Confidence hedge pills: four variants render distinctly (purple filled for very-likely, purple muted for likely, yellow for agent-recommendation, neutral grey for draft).
- Citation chips: `·N` pattern with 6 source palette (sf blue, catalyst green, netsuite teal, snowflake cyan, gong lavender, exa amber, internal grey).
- Mode switching via keyboard 1/2/3 works; Workspace variant makes sections collapsible with chevron indicator.
- Reading mode shows the Intelligence pill in the topbar (not the inline right column).

**Deliberate design deltas from spec (documented in `lib/fixtures/northstar-beauty-brief.ts`):**
- Brief body is stored as structured `Paragraph[]` rather than raw markdown. The `marked`-based parser in `05_FRONTEND_SPEC.md` is appropriate for streaming output from the real agent; for the fixture we have the exact shape the reference renders and precision outweighs consistency with a library we don't need. Spec's `parseBriefSections` regex is still implemented (in `lib/markdown.ts`, Phase 5) for the live path.
- A helper `briefToMarkdown(fixture)` produces the markdown string the mock SSE will emit, so the frontend can render either form without divergence.

**Minor drift (Phase 7 polish):**
- Brief column gradient from the reference (subtle AI-surface → AI-surface-2) isn't yet applied; the dark theme is correct but the light theme has a flat surface where reference has a lavender wash.
- Workspace mode's left column is currently a fixed 360px; reference feels slightly wider. Nudge in Phase 7 if it still reads off.

---

## 2026-04-22T02:10:00Z — Phase 2 · Static shell

**Status:** PASS (with minor drift noted)

**Compared:** `verification-output/2026-04-22_phase2-split-dark.png` + `_phase2-split-light.png` against `reference/screenshots/02_split_view_dark.png` + `01_split_view_light.png`.

**Matches:**
- Left rail structure: Attentive brand + Briefing · AE kicker; ⌘K search; Northstar Group section with NS group-head row; Beauty (active, yellow border), Active, Home children; "Other upcoming" with Tidepool Swim / Mellow Mattress / Ember Coffee; Jamie Kwon footer.
- State dots (hot/warm/cool) use correct color tokens.
- Topbar: breadcrumb "Briefings › Northstar Beauty › Pre-call"; mode toggle with 1/2/3 kbd hints; Refresh (subtle) + Join call (yellow accent).
- Account header: NB tile + "Northstar Beauty" + NORTHSTAR GROUP pill; meta row ("Skincare · DTC · $940k ARR · HQ Brooklyn, NY · 142 employees · Owner — Jamie Kwon"); call card with Today · 2:30 PM + In 47 min yellow pill + four attendees.
- Confidence strip: ring at 84, "84 · likely", 6 green source dots with 1 amber (stale), "6 sources queried · 1 stale", Clock icon + "Generated 6 min ago", Regenerate brief CTA.
- Tweaks panel: floating bottom-right trigger, Theme/Density/Verify segmented controls when open, theme toggle flips `.dark` on html.
- Keyboard shortcuts: 1/2/3/4 switch modes (4 active in Phase 6 when Writeup lands).

**Minor drift (non-blocking — to revisit in Phase 7):**
- Light-mode rail background reads slightly too warm vs reference; may need to nudge `--color-surface` down.
- Mode-toggle tab sizing feels a touch compact — reference buttons have a little more horizontal padding.
- `Northstar Beauty` heading in the header runs slightly tighter kerning than reference — likely Fraunces weight difference; acceptable for now.

Drifts logged, moving to Phase 3.

---

## 2026-04-22T01:40:00Z — Phase 1 · Foundation shell

**Status:** PASS

**Compared:** `verification-output/2026-04-22_phase1-shell-dark.png` vs reference screenshots' overall layout (260px rail + topbar + main scroll area).

**Notes:**
- Dark theme `.dark` class is active on `<html>` by default — confirmed bg matches reference `#0e0d0b`.
- 260px left rail, topbar strip across top-right, main area below. Grid geometry correct.
- Fraunces + Inter Tight + JetBrains Mono loading via next/font — font preload links visible in response headers.
- A stray "N" avatar at bottom-left is the Next.js dev-only toolbar. Not a component issue.
- Initial port collision: `:3000` was in use by another process; dev server fell back to `:3002` and `scripts/verify-visual.mjs` was updated to default to that port (`PRIMER_HOST` env var also supported).
- Turbopack root had to be pinned in `next.config.ts` because a stale `package-lock.json` in `/Users/nicholasruzicka/` was being auto-detected as the workspace root.

**Token decisions worth noting (inline spec delta):**
- Source-dot hex values in `specs/05_FRONTEND_SPEC.md` (`catalyst: #c5843a`, `netsuite: #5a8a65`) did **not** match the reference CSS or the screenshots. Reference CSS values used instead (`catalyst: #8bd091`, `netsuite: #58b890`). Per source-of-truth rules, screenshots win for visual.

---

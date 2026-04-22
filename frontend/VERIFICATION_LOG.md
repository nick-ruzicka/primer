# Verification Log

Per-component verification against reference screenshots, timestamped. Fail entries include
the drift observed and the fix; every fail that closes includes a revalidated PASS note.

Reference screenshots live in `reference/screenshots/`. Verification artifacts are written
to `verification-output/` by `scripts/verify-visual.mjs` and are gitignored.

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

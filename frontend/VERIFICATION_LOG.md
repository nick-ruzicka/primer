# Verification Log

Per-component verification against reference screenshots, timestamped. Fail entries include
the drift observed and the fix; every fail that closes includes a revalidated PASS note.

Reference screenshots live in `reference/screenshots/`. Verification artifacts are written
to `verification-output/` by `scripts/verify-visual.mjs` and are gitignored.

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

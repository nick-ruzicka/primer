# Primer — Frontend

The Next.js application for Primer, 's pre-call briefing product. Terminal 3 deliverable.

## Run it

```bash
cd frontend
npm install           # one-time
npm run dev           # starts dev server (defaults to port 3000, falls back if occupied)
```

The app opens on [http://localhost:3000](http://localhost:3000). If another process holds :3000, Next will pick the next available port — watch the terminal output.

**What you'll see:** Northstar Beauty loads by default. The mock SSE stream reveals Account Intelligence first (~300ms–2s), then brief sections (~2s–6s), then two validation warnings (~6s–7.5s). Try:

- Keyboard **1/2/3/4** to swap modes (Split / Workspace / Reading / Writeup).
- Click a different account in the left rail to re-stream.
- Open the Tweaks trigger (gear icon, bottom-right) to toggle light/dark.
- In Reading mode, the topbar gets an "Intelligence" pill that slides the panel over from the right.

## Architecture

```
frontend/
├── app/                     # Next.js app router (single page; 'use client' shell)
│   ├── layout.tsx           # Fraunces + Inter Tight + JetBrains Mono via next/font
│   ├── page.tsx             # Grid shell, reads from store, dispatches actions
│   └── globals.css          # Tailwind v4 @theme tokens + citation/card CSS
├── components/
│   ├── left-rail.tsx        # Accounts + group header + user footer
│   ├── topbar.tsx           # Breadcrumb + mode tabs + refresh + join call
│   ├── account-header.tsx   # Hero card with logo, name, meta, attendees
│   ├── confidence-strip.tsx # Ring + source dots + generated time + regen CTA
│   ├── validation-banner.tsx# Top-of-main critical/watch stack
│   ├── tweaks-panel.tsx     # Floating theme/density/verify controls
│   ├── brief/               # BriefSection, Prose, CitationChip
│   ├── intelligence/        # IntelligencePanel + card variants + sparkline
│   └── writeup/             # Mode 4 full-width editorial
├── lib/
│   ├── store.ts             # useSyncExternalStore module store (per spec)
│   ├── sse.ts               # loadAccount() — mock OR live via MOCK_MODE
│   ├── bootstrap.ts         # useBootstrap + useKeyboardShortcuts hooks
│   ├── types.ts             # SSE payload + store-state types (snake_case)
│   ├── utils.ts             # cn() helper
│   └── fixtures/            # Hand-authored account + brief + intelligence data
├── scripts/                 # Playwright verification helpers
└── reference/               # Design export + screenshots (authoritative target)
```

### Source-of-truth priority
1. **`specs/*.md`** — architecture (stack, SSE shape, component names). Final.
2. **`reference/_Briefing.html`** — copy (labels, prose, talk track). HTML wins for strings.
3. **`reference/screenshots/*.png`** — visual target (layout, color, spacing). Screenshots win for visuals.

## Swapping to the live backend

Mock mode is controlled by a single env var. When unset, `lib/sse.ts` replays the Northstar Beauty and Kindred Pet fixtures on realistic timers. When set, `loadAccount()` opens an EventSource against `${NEXT_PUBLIC_API_BASE}/briefing/{account_id}`.

```bash
# .env.local
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Restart `npm run dev` after changing the env var. No code changes required.

The SSE event names (`intelligence`, `brief_chunk`, `source_cited`, `validation_warning`, `done`) and payload shapes are defined in `specs/00_BUILD_PLAN.md` and consumed by the action helpers in `lib/store.ts` (`revealIntelligence`, `pushSourceCited`, `pushWarning`, `markBriefDone`).

Note: the live path currently uses per-section `brief_chunk` payloads via `revealBriefSection`. If the real backend emits token-level deltas, the TODO in `lib/sse.ts#runLiveStream` flags where to plug in a marked-based incremental parser.

## Verification

`scripts/verify-visual.mjs` and friends use Playwright headless Chromium to screenshot the running dev server.

```bash
npm run dev &                               # start dev server (background)
node scripts/verify-modes.mjs               # all 3 modes, dark
node scripts/verify-stream.mjs              # mock stream at 4 checkpoints
node scripts/verify-switch.mjs              # account-switch fidelity
node scripts/verify-intel-overlay.mjs       # reading-mode slide-over
node scripts/verify-writeup.mjs             # mode 4
```

Artifacts land in `verification-output/` (gitignored). Compare against `reference/screenshots/`.

`VERIFICATION_LOG.md` has a phase-by-phase record of every check with the pass/fail call and drift notes.

## Known drift from reference

Documented in `VERIFICATION_LOG.md` under each phase's "Minor drift" section. Summary:
- Brief column gradient (light theme) — flat vs. subtle lavender wash in reference.
- Workspace mode left column width — fixed 360px; reference feels slightly wider.
- Sparkline is static; reference animates in.
- External-signal favicons are text badges, not real favicons.
- Skeleton shimmer uses generic bars, not per-section silhouettes.

None are blocking for the portfolio piece demo.

## What's deliberately out of scope

- Tests beyond type-checking and biome lint (demo product).
- State library (Redux/Zustand/Jotai) — `useSyncExternalStore` only.
- CSS-in-JS — Tailwind only.
- SSE client library — native `EventSource`.
- Auth (single-tenant public demo).
- Multi-account briefings / scheduled generation.

## Development commands

```bash
npm run dev           # next dev --turbopack
npm run build         # next build
npm run start         # next start
npm run lint          # biome check
npm run format        # biome format --write
./node_modules/.bin/tsc --noEmit   # type check
```

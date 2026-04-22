# 05 — Frontend Spec (Next.js + Tailwind, from scratch)

**Decision: build the frontend properly in Next.js + Tailwind, using the Claude Design export as a visual reference only.**

The Claude Design export is the *visual target*. We look at it to know colors, spacing, typography, layout. We do not use its code. Everything is rewritten as idiomatic Next.js + Tailwind + TypeScript so the result is a reusable architecture for future projects.

## Stack

- **Next.js 15** — App Router, TypeScript
- **Tailwind v4** — `@theme` directive for design tokens
- **React 19**
- **shadcn/ui** — cherry-pick: Button, ScrollArea, Tooltip, Popover, Dialog
- **`next/font/google`** — Fraunces, Inter Tight, JetBrains Mono
- **Lucide React** — icons
- **`marked`** — client-side markdown for the streamed brief
- **No state library** — `useSyncExternalStore` + plain module store
- **No CSS-in-JS** — Tailwind only
- **Biome** — lint + format

## Directory layout

```
frontend/
├── app/
│   ├── layout.tsx              # root layout, fonts, theme
│   ├── page.tsx                # the briefing page
│   ├── globals.css             # Tailwind + design tokens
│   └── favicon.ico
├── components/
│   ├── topbar.tsx
│   ├── left-rail.tsx
│   ├── account-header.tsx
│   ├── confidence-strip.tsx
│   ├── brief/
│   │   ├── brief.tsx
│   │   ├── brief-section.tsx
│   │   ├── citation-chip.tsx
│   │   └── validation-banner.tsx
│   ├── intelligence/
│   │   ├── intelligence-panel.tsx
│   │   ├── intelligence-section.tsx
│   │   ├── relationship-card.tsx
│   │   ├── commercial-card.tsx
│   │   ├── past-due-card.tsx
│   │   ├── usage-card.tsx
│   │   ├── conversations-card.tsx
│   │   └── portfolio-card.tsx
│   ├── writeup/
│   │   └── writeup.tsx
│   ├── tweaks-panel.tsx
│   ├── source-pill.tsx
│   ├── confidence-indicator.tsx
│   └── ui/                     # shadcn primitives
├── lib/
│   ├── store.ts
│   ├── sse.ts
│   ├── markdown.ts
│   ├── types.ts
│   ├── api.ts
│   └── bootstrap.ts
├── public/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── biome.json
└── README.md
```

## Design tokens → Tailwind

Extract CSS variables from the Claude Design `styles.css` and map them to Tailwind's `@theme` directive in `globals.css`.

```css
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-bg: #f4f1ec;
  --color-surface: #fbfaf7;
  --color-surface-2: #ffffff;
  --color-surface-sunk: #efebe3;

  /* Lines */
  --color-line: #e6e0d4;
  --color-line-strong: #d2c9b8;

  /* Ink */
  --color-ink: #1a1712;
  --color-ink-2: #3d372d;
  --color-ink-3: #6b6454;
  --color-ink-4: #9a9281;

  /* Accent — Attentive yellow */
  --color-accent: #f5d03a;
  --color-accent-2: #e6b918;
  --color-accent-soft: #fcf3c9;
  --color-accent-ink: #3a2f08;

  /* Semantic */
  --color-good: #3a6b4a;
  --color-good-soft: #e0ead9;
  --color-warn-strong: #b87a2a;
  --color-warn-soft: #f4e8d0;
  --color-bad: #8a2f2f;
  --color-bad-soft: #f0dcdc;

  /* Source dots */
  --color-source-sf: #2e8fbf;
  --color-source-snowflake: #5aa8d6;
  --color-source-catalyst: #c5843a;
  --color-source-netsuite: #5a8a65;
  --color-source-gong: #8c6ebc;
  --color-source-web: #b87a2a;

  /* Typography */
  --font-sans: var(--font-inter-tight);
  --font-serif: var(--font-fraunces);
  --font-mono: var(--font-jetbrains-mono);

  /* Radii */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-pill: 999px;
}

/* Dark theme */
.dark {
  --color-bg: #0e0d0b;
  --color-surface: #1a1816;
  --color-surface-2: #221f1b;
  --color-surface-sunk: #100e0c;
  --color-line: #2c2824;
  --color-line-strong: #433d35;
  --color-ink: #f3eee4;
  --color-ink-2: #d6cebe;
  --color-ink-3: #9e9684;
  --color-ink-4: #6a6251;
  --color-accent: #f5d03a;
  --color-accent-2: #e6b918;
  --color-accent-soft: #2a2410;
  --color-accent-ink: #f5d03a;
}

/* Font loading classes defined by next/font land on <html> */
```

Use Tailwind utilities directly: `bg-bg text-ink border-line`. Works because the `@theme` variables get exposed as Tailwind color utilities automatically.

## Fonts

```typescript
// app/layout.tsx
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600'],
});
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['400', '500', '600', '700'],
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${interTight.variable} ${jetbrains.variable} dark`}
    >
      <body className="font-sans bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
```

## Types

See spec file — full TypeScript types for `Account`, `AccountGroup`, `IntelligenceItem`, `Citation`, `ValidationWarning`, `BriefSections`, `StoreState`. Match the backend payload shapes exactly (snake_case field names since FastAPI defaults to them; use the `lib/api.ts` wrapper to convert to camelCase if desired, or keep snake_case end-to-end for simplicity).

## Store

```typescript
// lib/store.ts
'use client';

import { useSyncExternalStore } from 'react';
import type { StoreState } from './types';

const INITIAL_STATE: StoreState = {
  accounts: [],
  accountGroups: [],
  standalone: [],
  activeAccountId: null,
  intelligence: {
    relationship: null,
    commercial: null,
    product_usage: null,
    conversations: null,
    portfolio: null,
    external: null,
  },
  brief: {
    rawMarkdown: '',
    sections: { read: '', why: '', what_to_do: '', talk_track: '' },
    confidence: null,
    confidenceHedge: null,
    isComplete: false,
  },
  citations: [],
  warnings: [],
  generationMeta: { startedAt: null, completedAt: null, totalTokens: null },
  mode: 1,
};

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();

export function getState(): StoreState {
  return state;
}

export function setState(updater: (prev: StoreState) => StoreState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(INITIAL_STATE)
  );
}
```

## SSE consumer

```typescript
// lib/sse.ts
'use client';

import { setState } from './store';
import { parseBriefSections } from './markdown';

let currentStream: EventSource | null = null;

export function loadAccount(accountId: string, opts: { refresh?: boolean } = {}) {
  if (currentStream) currentStream.close();

  setState((s) => ({
    ...s,
    activeAccountId: accountId,
    intelligence: {
      relationship: null, commercial: null, product_usage: null,
      conversations: null, portfolio: null, external: null,
    },
    brief: {
      rawMarkdown: '',
      sections: { read: '', why: '', what_to_do: '', talk_track: '' },
      confidence: null,
      confidenceHedge: null,
      isComplete: false,
    },
    citations: [],
    warnings: [],
    generationMeta: { startedAt: Date.now(), completedAt: null, totalTokens: null },
  }));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('lastAccount', accountId);
  }

  const url = `/briefing/${accountId}${opts.refresh ? '?refresh=1' : ''}`;
  const es = new EventSource(url);
  currentStream = es;

  es.addEventListener('intelligence', (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    setState((s) => ({
      ...s,
      intelligence: { ...s.intelligence, [data.section]: data.items },
    }));
  });

  es.addEventListener('brief_chunk', (e) => {
    const { delta } = JSON.parse((e as MessageEvent).data);
    setState((s) => {
      const raw = s.brief.rawMarkdown + delta;
      return {
        ...s,
        brief: { ...s.brief, rawMarkdown: raw, sections: parseBriefSections(raw) },
      };
    });
  });

  es.addEventListener('source_cited', (e) => {
    const citation = JSON.parse((e as MessageEvent).data);
    setState((s) => ({ ...s, citations: [...s.citations, citation] }));
  });

  es.addEventListener('validation_warning', (e) => {
    const warning = JSON.parse((e as MessageEvent).data);
    setState((s) => ({ ...s, warnings: [...s.warnings, warning] }));
  });

  es.addEventListener('done', (e) => {
    const meta = JSON.parse((e as MessageEvent).data);
    setState((s) => ({
      ...s,
      brief: { ...s.brief, isComplete: true },
      generationMeta: {
        ...s.generationMeta,
        completedAt: Date.now(),
        totalTokens: meta.total_tokens,
      },
    }));
    es.close();
    currentStream = null;
  });

  es.addEventListener('error', () => {
    setState((s) => ({
      ...s,
      warnings: [
        ...s.warnings,
        { severity: 'critical', type: 'missing_ground', message: 'Connection lost. Please refresh.' },
      ],
    }));
    es.close();
    currentStream = null;
  });
}
```

## Markdown

```typescript
// lib/markdown.ts
import { marked } from 'marked';
import type { Citation, BriefSections } from './types';

export function parseBriefSections(markdown: string): BriefSections {
  const sections: BriefSections = { read: '', why: '', what_to_do: '', talk_track: '' };
  const regex = /##\s*0([1-4])\s*·\s*(?:The read|Why this read|What to do on the call|Suggested talk track)([\s\S]*?)(?=##\s*0[1-4]|$)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const [, num, body] = match;
    const keys = ['read', 'why', 'what_to_do', 'talk_track'] as const;
    const key = keys[parseInt(num, 10) - 1];
    if (key) sections[key] = body.trim();
  }
  return sections;
}

export function renderSection(markdown: string, citations: Citation[]): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return html.replace(/·(\d+)/g, (_, num) => {
    const citation = citations.find((c) => c.citation_number === parseInt(num, 10));
    if (!citation) return `<span class="citation pending">·${num}</span>`;
    return `<span class="citation" data-citation="${num}" data-source="${citation.source}">·${num}</span>`;
  });
}
```

Citation styling lives in `globals.css` as a small custom class, referencing the source-dot color variables.

## Page shell

```typescript
// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useBootstrap } from '@/lib/bootstrap';
import { Topbar } from '@/components/topbar';
import { LeftRail } from '@/components/left-rail';
import { AccountHeader } from '@/components/account-header';
import { ConfidenceStrip } from '@/components/confidence-strip';
import { Brief } from '@/components/brief/brief';
import { IntelligencePanel } from '@/components/intelligence/intelligence-panel';
import { Writeup } from '@/components/writeup/writeup';
import { TweaksPanel } from '@/components/tweaks-panel';
import { cn } from '@/lib/utils';

export default function BriefingPage() {
  useBootstrap();
  const mode = useStore((s) => s.mode);

  return (
    <div className="grid h-screen grid-cols-[260px_1fr] overflow-hidden bg-bg text-ink">
      <LeftRail />
      <div className="flex flex-col overflow-hidden">
        <Topbar />
        {mode === 4 ? (
          <Writeup />
        ) : (
          <div className="flex flex-col overflow-y-auto">
            <AccountHeader />
            <ConfidenceStrip />
            <main
              className={cn(
                'grid min-h-0 flex-1',
                mode === 1 && 'grid-cols-[1fr_320px]',
                mode === 2 && 'grid-cols-[320px_1fr]',
                mode === 3 && 'grid-cols-[1fr_1fr]',
              )}
            >
              {mode === 1 && (
                <>
                  <Brief layout="centered" />
                  <IntelligencePanel variant="compact" />
                </>
              )}
              {mode === 2 && (
                <>
                  <Brief layout="nav" />
                  <IntelligencePanel variant="full" />
                </>
              )}
              {mode === 3 && (
                <>
                  <Brief layout="split" />
                  <IntelligencePanel variant="full" />
                </>
              )}
            </main>
          </div>
        )}
      </div>
      <TweaksPanel />
    </div>
  );
}
```

## Component build order (your 30-min-a-day plan)

**Day 1:**
1. `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --biome`
2. Install deps: `marked lucide-react class-variance-authority clsx tailwind-merge`
3. `globals.css` with design tokens
4. Root layout with fonts
5. Blank page shell that renders the grid correctly

**Day 2:**
6. `LeftRail` with hardcoded accounts — visually match the export
7. `Topbar` with mode switcher (1-4) + keyboard shortcuts
8. `TweaksPanel` (theme toggle wired to the `dark` class)

**Day 3:**
9. `AccountHeader` + `ConfidenceStrip`
10. `Brief` + `BriefSection` shells rendering static markdown
11. `CitationChip` inline component

**Day 4:**
12. `IntelligencePanel` + all card components
13. `store.ts` + `sse.ts` wired in
14. `useBootstrap` hook to load accounts
15. End-to-end test: click account, brief streams in
16. `Writeup` (Mode 4) — content placeholder until final copy

Every day: diff your dev server against the Claude Design screenshot side-by-side. Catch visual drift early.

## API wrapper

```typescript
// lib/api.ts
import type { AccountsResponse } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export async function fetchAccounts(): Promise<AccountsResponse> {
  const r = await fetch(`${API_BASE}/api/accounts`);
  if (!r.ok) throw new Error(`Failed to load accounts: ${r.status}`);
  return r.json();
}
```

Set `NEXT_PUBLIC_API_BASE` in `.env.local` to point at the FastAPI backend for local dev.

## Bootstrap hook

```typescript
// lib/bootstrap.ts
'use client';

import { useEffect } from 'react';
import { setState } from './store';
import { fetchAccounts } from './api';
import { loadAccount } from './sse';
import { installKeyboardShortcuts } from './keyboard';

export function useBootstrap() {
  useEffect(() => {
    let cancelled = false;
    fetchAccounts().then((data) => {
      if (cancelled) return;
      setState((s) => ({
        ...s,
        accounts: [...data.groups.flatMap(g => g.accounts), ...data.standalone],
        accountGroups: data.groups,
        standalone: data.standalone,
      }));
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lastAccount') : null;
      const firstId = stored ?? data.groups[0]?.accounts[0]?.id ?? data.standalone[0]?.id;
      if (firstId) loadAccount(firstId);
    });
    installKeyboardShortcuts();
    return () => { cancelled = true; };
  }, []);
}
```

## Deployment

Either:

**Option A (same box as backend — recommended for simplicity):**
- Build: `next build`
- Serve: `next start` behind nginx, proxied on port 3000
- Single systemd service for the frontend

**Option B (Vercel + Hetzner backend):**
- Push frontend to Vercel, set `NEXT_PUBLIC_API_BASE` to the Hetzner URL
- Backend on Hetzner with CORS headers for the Vercel domain
- Faster iteration cycle, crosses origins for SSE (works, just needs CORS)

Pick A for the takehome. One deploy target is simpler to debug and explain.

## What NOT to do

- Don't install Redux / Zustand / Jotai
- Don't install CSS-in-JS
- Don't install an SSE library
- Don't split the app into multiple routes
- Don't add authentication
- Don't add analytics
- Don't use server components for the interactive shell — `page.tsx` is `'use client'`
- Don't memoize prematurely — measure first
- Don't over-engineer types beyond the backend contract
- Don't rebuild the shadcn components we use — import and customize with Tailwind

## Fidelity checklist — validate before shipping

- [ ] Left rail account cards match export pixel-for-pixel
- [ ] Account header + call-card layout match
- [ ] Confidence strip layout matches (ring, metadata, buttons)
- [ ] Brief section numbering typography matches (01 · The read)
- [ ] Source pill colors match source-dot values exactly
- [ ] Intelligence card flagged treatments match (PAST DUE red, WATCH amber)
- [ ] Tweaks panel placement + content match
- [ ] Dark theme renders correctly with all surface values
- [ ] Mode switcher styling + keyboard hint labels match
- [ ] Font weights render as in export (Fraunces 500/600, Inter Tight 400/500/600)
- [ ] Citation chip rendering inline with prose (not breaking lines)
- [ ] Streaming brief renders token-by-token smoothly
- [ ] Intelligence sections populate progressively
- [ ] Mode switching doesn't refetch the brief
- [ ] `/api/accounts` fetch happens once on load

# Reading View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the reading view of briefs with improved layout, typography, and a functional citation system with References section.

**Architecture:** Layer the changes from bottom-up: styling first (headers, widths, spacing), then components (tooltip, references section, modal), then interactions (wiring click/hover handlers). Each task produces testable UI changes.

**Tech Stack:** React, Tailwind CSS, TypeScript, existing Brief/Prose component structure

---

## Task 1: Update Section Header Styling

**Files:**
- Modify: `frontend/components/brief/brief-section.tsx`

**Context:** Section headers need larger size, softer color, left border accent, and adjusted spacing.

- [ ] **Step 1: Open brief-section.tsx and locate the header className**

File: `frontend/components/brief/brief-section.tsx:45-50` (the `<header>` element)

Current:
```jsx
<header
  className={cn(
    "brief-head flex items-baseline gap-2.5 border-b border-dashed border-line pb-2 mb-2.5",
    isWorkspace && "border-b-0 mb-0 pb-1 cursor-pointer select-none",
  )}
```

- [ ] **Step 2: Replace header className to add new styling**

```jsx
<header
  className={cn(
    "brief-head flex items-baseline gap-2.5 border-l-4 border-l-blue-500 pl-4 mb-20 pb-0",
    isWorkspace && "border-b border-line border-l-0 pl-0 mb-0 pb-1 cursor-pointer select-none",
  )}
  style={!isWorkspace ? { borderLeftColor: 'var(--accent)' } : undefined}
/>
```

(Adjust `--accent` color variable name to match your design tokens; if using Tailwind color directly, use `border-l-blue-600` or appropriate brand color)

- [ ] **Step 3: Update the `<h2>` title element className**

Locate the `<h2>` inside the header (line 66):

Current:
```jsx
<h2 className="brief-title">
```

Replace with:
```jsx
<h2 className="brief-title text-2xl font-semibold text-ink-2">
```

- [ ] **Step 4: Update the preview text className (if exists)**

Locate line 92:
```jsx
<p className="brief-preview">{section.preview}</p>
```

Replace with:
```jsx
<p className="brief-preview text-ink-3 mt-1 mb-4">{section.preview}</p>
```

- [ ] **Step 5: Add spacing to the prose container**

Locate line 94 (the `<div>` wrapping paragraphs):
```jsx
<div className={section.id === "01" ? "the-read" : "why-stack"}>
```

Replace with:
```jsx
<div className={cn(section.id === "01" ? "the-read" : "why-stack", "prose-body")}>
```

- [ ] **Step 6: Add prose-body styles inline or to global CSS**

Add to `frontend/styles/globals.css` or your Tailwind config (in a `@layer components` block):

```css
.prose-body p {
  line-height: 1.8;
  margin-bottom: 1rem;
}

.brief-section {
  margin-bottom: 5rem;
}

.brief-section:first-child {
  margin-top: 2rem;
}
```

- [ ] **Step 7: Test visually**

Run dev server: `npm run dev`
Navigate to reading view, verify:
- Section headers are larger (28-32px)
- Left border is visible on headers (4px accent color)
- Headers have softer color (less black)
- Spacing between sections is generous (5rem)
- Preview text is lighter gray

- [ ] **Step 8: Commit**

```bash
git add frontend/components/brief/brief-section.tsx frontend/styles/globals.css
git commit -m "feat: improve section header styling and spacing

- Increase header font size to 2xl, weight to 600
- Add left border accent (4px)
- Update color to ink-2 (softer)
- Increase section margin-bottom to 5rem
- Add prose line-height 1.8 and paragraph margin 1rem
- Adjust preview text color to ink-3"
```

---

## Task 2: Update Brief Max-Width for Centered Layout

**Files:**
- Modify: `frontend/components/brief/brief.tsx`

- [ ] **Step 1: Open brief.tsx and locate the centered layout className**

File: `frontend/components/brief/brief.tsx:33`, the line:
```jsx
layout === "centered" && "mx-auto max-w-[760px] px-8",
```

- [ ] **Step 2: Update max-width from 760px to 900px**

Replace:
```jsx
layout === "centered" && "mx-auto max-w-[760px] px-8",
```

With:
```jsx
layout === "centered" && "mx-auto max-w-[900px] px-8",
```

- [ ] **Step 3: Test visually**

Run dev server, navigate to reading view (make sure it's using centered layout).
Verify: content area is wider, lines use more horizontal space without feeling cramped.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/brief/brief.tsx
git commit -m "feat: increase reading view max-width to 900px"
```

---

## Task 3: Create CitationTooltip Component

**Files:**
- Create: `frontend/components/brief/citation-tooltip.tsx`

- [ ] **Step 1: Create citation-tooltip.tsx with TypeScript interface**

```tsx
import { ReactNode } from "react";

interface CitationTooltipProps {
  sourceIcon: ReactNode; // e.g., <SalesforceIcon />
  sourceName: string; // e.g., "Salesforce"
  dataPoint: string; // e.g., "forecast: Commit"
  timestamp: string; // e.g., "Updated 2h ago"
  isOpen: boolean;
  position: { top: number; left: number };
}

export function CitationTooltip({
  sourceIcon,
  sourceName,
  dataPoint,
  timestamp,
  isOpen,
  position,
}: CitationTooltipProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute bg-surface-2 border border-line rounded-md px-3 py-2 text-sm shadow-lg z-50 pointer-events-none"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%) translateY(-100%)",
        marginTop: "-8px",
        whiteSpace: "nowrap",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="w-4 h-4">{sourceIcon}</span>
        <span className="font-semibold">{sourceName}</span>
      </div>
      <div className="text-ink-3 mt-1">{dataPoint.substring(0, 60)}</div>
      <div className="text-ink-4 text-xs mt-0.5">{timestamp}</div>
    </div>
  );
}
```

- [ ] **Step 2: Test render**

Create a small test in the dev environment: render the component with mock props and verify structure.

```tsx
<CitationTooltip
  sourceIcon={<div>📊</div>}
  sourceName="Salesforce"
  dataPoint="forecast: Commit"
  timestamp="Updated 2h ago"
  isOpen={true}
  position={{ top: 100, left: 200 }}
/>
```

Visual check: tooltip appears above the anchor point, shows icon + name + data point + timestamp.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/brief/citation-tooltip.tsx
git commit -m "feat: create CitationTooltip component for cite hover preview"
```

---

## Task 4: Wire Up Citation Hover Tooltip in Prose

**Files:**
- Modify: `frontend/components/brief/prose.tsx`

- [ ] **Step 1: Open prose.tsx and locate where citations are rendered**

Look for the citation chip rendering (likely around line 30-50). Current code probably looks like:

```tsx
<span className="citation-chip" onClick={...}>
  ·{citationNumber}
</span>
```

- [ ] **Step 2: Add hover state management to citation span**

Update the citation chip element to include onMouseEnter/onMouseLeave:

```tsx
import { useState, useRef } from "react";
import { CitationTooltip } from "./citation-tooltip";

// Inside Prose component:
const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
const citationRef = useRef<HTMLSpanElement>(null);

// In the citation chip rendering:
<span
  ref={citationRef}
  className="citation-chip cursor-pointer hover:opacity-75"
  onClick={() => onCitationClick?.(citation.id)}
  onMouseEnter={(e) => {
    if (citationRef.current) {
      const rect = citationRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top, left: rect.left + rect.width / 2 });
      setHoveredCitation(citation.id);
    }
  }}
  onMouseLeave={() => setHoveredCitation(null)}
>
  ·{citation.number}
</span>
```

- [ ] **Step 3: Render CitationTooltip next to the citation chip**

After the citation span, add:

```tsx
<CitationTooltip
  sourceIcon={getSourceIcon(citation.source)} // you'll define this helper
  sourceName={citation.sourceName}
  dataPoint={citation.dataPoint}
  timestamp={citation.timestamp}
  isOpen={hoveredCitation === citation.id}
  position={tooltipPos}
/>
```

- [ ] **Step 4: Create helper to map source to icon**

Add a helper function (or use existing icon library):

```tsx
function getSourceIcon(source: string) {
  const iconMap: Record<string, ReactNode> = {
    salesforce: <span>📊</span>,
    gong: <span>🎙️</span>,
    netsuite: <span>📑</span>,
    catalyst: <span>⚡</span>,
    snowflake: <span>❄️</span>,
    exa: <span>🔍</span>,
  };
  return iconMap[source.toLowerCase()] || <span>🔗</span>;
}
```

(Replace with actual icon components if available in your codebase, e.g., from `lucide-react`)

- [ ] **Step 5: Test hover interaction**

Run dev server, navigate to reading view. Hover over citation chips (·1, ·2, etc.).
Verify: tooltip appears above the chip with source, data point, and timestamp.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/brief/prose.tsx frontend/components/brief/citation-tooltip.tsx
git commit -m "feat: add hover tooltip to citation chips showing source preview"
```

---

## Task 5: Create ReferencesSection Component

**Files:**
- Create: `frontend/components/brief/references-section.tsx`

- [ ] **Step 1: Create references-section.tsx with TypeScript**

```tsx
import type { CitationMeta } from "@/lib/fixtures/northstar-beauty-brief";
import { ReactNode } from "react";

interface ReferencesSectionProps {
  citations: CitationMeta[];
  onReferenceClick?: (citationId: string) => void;
  highlightedCitationId?: string | null;
  sourceIcons?: Record<string, ReactNode>;
}

export function ReferencesSection({
  citations,
  onReferenceClick,
  highlightedCitationId,
  sourceIcons = {},
}: ReferencesSectionProps) {
  return (
    <section className="references-section mt-24 pt-6 border-t border-line">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4 mb-4">
        References
      </h3>
      <ol className="space-y-3">
        {citations.map((citation, idx) => (
          <li
            key={citation.id}
            className={`flex gap-3 cursor-pointer hover:opacity-75 p-2 rounded transition-colors ${
              highlightedCitationId === citation.id
                ? "bg-surface-2"
                : ""
            }`}
            onClick={() => onReferenceClick?.(citation.id)}
          >
            <span className="text-ink-3 flex-shrink-0 w-6">{idx + 1}.</span>
            <span className="flex-shrink-0 w-4">{sourceIcons[citation.source] || "🔗"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">
                {citation.sourceName}
              </div>
              <div className="text-sm text-ink-3 truncate">
                {citation.dataPoint}
              </div>
              <div className="text-xs text-ink-4 mt-0.5">
                {citation.timestamp}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: Test render with mock data**

In the dev environment, render the component with mock citations and verify structure.

```tsx
<ReferencesSection
  citations={[
    {
      id: "1",
      sourceName: "Salesforce",
      source: "salesforce",
      dataPoint: "forecast: Commit",
      timestamp: "Updated 2h ago",
    },
  ]}
/>
```

Visual check: references appear as a numbered list with source icon, name, data point, timestamp. Hover shows opacity change.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/brief/references-section.tsx
git commit -m "feat: create ReferencesSection component for Chicago-style citations"
```

---

## Task 6: Wire Up Citation Click to Scroll + Highlight

**Files:**
- Modify: `frontend/components/brief/brief.tsx`
- Modify: `frontend/components/brief/brief-section.tsx`

- [ ] **Step 1: Add state to Brief for tracking highlighted citation**

In `frontend/components/brief/brief.tsx`, add state at the top of the component:

```tsx
import { useState } from "react";

export function Brief({
  brief,
  layout = "split",
  hoveredEvid,
  onCitationHover,
  onCitationClick,
}: Props) {
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);

  const handleCitationClick = (citationId: string) => {
    setHighlightedCitationId(citationId);
    onCitationClick?.(citationId);
    
    // Scroll to References section (will add in next step)
    setTimeout(() => {
      const refElement = document.getElementById("references-section");
      if (refElement) {
        refElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  // ... rest of component
```

- [ ] **Step 2: Pass click handler down through BriefSection**

Update the BriefSection render call (around line 40):

```tsx
<BriefSection
  key={s.id}
  section={s}
  citations={brief.citations}
  variant={isWorkspace ? "workspace" : "default"}
  defaultOpen={isWorkspace ? s.id === "01" : true}
  hoveredEvid={hoveredEvid}
  onCitationHover={onCitationHover}
  onCitationClick={handleCitationClick}  // Use the new handler
/>
```

- [ ] **Step 3: Update Prose to use the correct handler**

In `frontend/components/brief/prose.tsx`, ensure the citation click calls the provided handler:

```tsx
onClick={() => {
  onCitationClick?.(citation.id);
}}
```

- [ ] **Step 4: Test interaction**

Run dev server, navigate to reading view. Click a citation chip.
Verify: page scrolls down to References section, the corresponding reference row highlights and then fades.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/brief/brief.tsx frontend/components/brief/prose.tsx
git commit -m "feat: wire citation click to scroll to References with highlight"
```

---

## Task 7: Create ReferenceModal Component

**Files:**
- Create: `frontend/components/brief/reference-modal.tsx`

- [ ] **Step 1: Create reference-modal.tsx**

```tsx
import type { CitationMeta } from "@/lib/fixtures/northstar-beauty-brief";
import { X } from "lucide-react";

interface ReferenceModalProps {
  citation: CitationMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReferenceModal({
  citation,
  isOpen,
  onClose,
}: ReferenceModalProps) {
  if (!isOpen || !citation) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{citation.sourceName}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase">
              Data Point
            </label>
            <p className="text-sm mt-1">{citation.dataPoint}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase">
              Last Updated
            </label>
            <p className="text-sm mt-1">{citation.timestamp}</p>
          </div>

          <button className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
            View Raw Data
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test render**

In dev environment, render the modal with mock citation data.

```tsx
<ReferenceModal
  citation={{
    id: "1",
    sourceName: "Salesforce",
    source: "salesforce",
    dataPoint: "forecast: Commit",
    timestamp: "Updated 2h ago",
  }}
  isOpen={true}
  onClose={() => {}}
/>
```

Visual check: modal appears centered, shows source name, data point, timestamp, and "View Raw Data" button. Close button works.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/brief/reference-modal.tsx
git commit -m "feat: create ReferenceModal component for viewing full citation details"
```

---

## Task 8: Add ReferencesSection to Brief and Wire Modal

**Files:**
- Modify: `frontend/components/brief/brief.tsx`

- [ ] **Step 1: Add modal state to Brief**

In `frontend/components/brief/brief.tsx`, add to the component state:

```tsx
const [selectedReferenceForModal, setSelectedReferenceForModal] = useState<CitationMeta | null>(null);
```

- [ ] **Step 2: Import ReferencesSection and ReferenceModal**

At the top of brief.tsx:

```tsx
import { ReferencesSection } from "./references-section";
import { ReferenceModal } from "./reference-modal";
```

- [ ] **Step 3: Add ReferencesSection and ReferenceModal to Brief render**

Before the closing `</div>` of the Brief component (around line 50), add:

```tsx
{!isWorkspace && (
  <>
    <ReferencesSection
      citations={brief.citations}
      onReferenceClick={(citationId) => {
        const citation = brief.citations.find((c) => c.id === citationId);
        setSelectedReferenceForModal(citation || null);
      }}
      highlightedCitationId={highlightedCitationId}
    />
    <ReferenceModal
      citation={selectedReferenceForModal}
      isOpen={selectedReferenceForModal !== null}
      onClose={() => setSelectedReferenceForModal(null)}
    />
  </>
)}
```

(Conditionally render only in centered/split layouts, not workspace)

- [ ] **Step 4: Test interactions**

Run dev server, navigate to reading view.
- Click a citation chip → should scroll to References and highlight that row
- Click a reference row → should open modal with full details
- Close modal or click outside → modal closes

- [ ] **Step 5: Commit**

```bash
git add frontend/components/brief/brief.tsx
git commit -m "feat: add ReferencesSection and ReferenceModal to reading view

- References section appears at bottom with all citations
- Click reference row to open full details modal
- Citation chip clicks scroll to reference with highlight"
```

---

## Task 9: Update Prose Global Styles for Line-Height and Spacing

**Files:**
- Modify: `frontend/styles/globals.css` (or Tailwind config)

- [ ] **Step 1: Verify prose-body styles added in Task 1**

Check if you added `.prose-body` styles in globals.css. If so, verify:

```css
.prose-body p {
  line-height: 1.8;
  margin-bottom: 1rem;
}
```

If not, add it now.

- [ ] **Step 2: Test visually**

Run dev server, look at the brief prose paragraphs.
Verify: text has better spacing between lines (1.8), paragraphs have 1rem gap between them.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add frontend/styles/globals.css
git commit -m "feat: update prose typography with line-height 1.8 and paragraph spacing"
```

---

## Task 10: Visual Polish and Final Testing

**Files:**
- No files modified (visual inspection only)

- [ ] **Step 1: Full flow test in reading view**

Run dev server, navigate to the reading view. Test:
- Content width is wider (900px), uses space well
- Section headers are prominent (larger, left border, softer color)
- Spacing between sections feels generous (5rem)
- Prose text is readable (line-height 1.8, good paragraph spacing)

- [ ] **Step 2: Citation interaction test**

- Hover over citation chip → tooltip appears with source + data point + timestamp
- Click citation chip → smooth scroll to References, row highlights
- Hover over reference row → opacity changes (clickable state)
- Click reference row → modal opens with full details
- Close modal → modal closes

- [ ] **Step 3: Workspace mode unchanged**

Verify workspace/split layouts are unaffected by checking those view modes still work.

- [ ] **Step 4: Test on multiple widths**

Resize browser window, verify layout works at different widths (900px content should center on large screens, adapt on smaller).

- [ ] **Step 5: Fix any visual issues found**

If any issues (alignment, spacing, colors), apply inline fixes to the relevant component and commit.

- [ ] **Step 6: Final commit summary (if needed)**

If no issues found, skip. If fixes made:

```bash
git add [modified files]
git commit -m "polish: final visual refinements for reading view redesign"
```

---

## Summary of Changes

| File | Change | Task |
|------|--------|------|
| `brief-section.tsx` | Header styling (size, color, border, spacing) | 1 |
| `brief.tsx` | Max-width 900px, add ReferencesSection + ReferenceModal | 2, 8 |
| `prose.tsx` | Hover tooltip, click handler wiring | 4, 6 |
| `citation-tooltip.tsx` | New component for hover preview | 3 |
| `references-section.tsx` | New component for References list | 5 |
| `reference-modal.tsx` | New component for full citation details | 7 |
| `globals.css` | Prose line-height and spacing | 9 |


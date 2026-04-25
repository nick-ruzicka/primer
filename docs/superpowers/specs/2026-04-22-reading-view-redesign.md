# Reading View Redesign: Layout, Typography & Citations

**Date:** 2026-04-22  
**Scope:** Redesign the reading view (centered layout) of briefs to improve spacing, typography hierarchy, and citation interaction.

---

## Overview

The current reading view underutilizes horizontal space and has awkward section spacing with weak header hierarchy. Citations are inline but orphaned—they don't refer to visible data. This redesign:

1. **Widens the content area** from 760px to 900px
2. **Improves vertical rhythm** with consistent 5rem gaps between sections and better typography
3. **Creates a References section** at the bottom (Chicago-style footnotes) that citations link to
4. **Adds citation interactions**: hover tooltips, click to scroll + highlight, click reference row to open modal with full details

---

## Layout & Typography

### Content Width
- **Reading mode** (`.centered` layout): `max-w-[900px]` (currently 760px)
- Applies to `Brief` component wrapper
- Allows full use of available screen width without overwhelming line lengths

### Section Headers
- **Size:** 28-32px (increased from ~24px)
- **Weight:** 600 (down from 700, softer for editorial feel)
- **Color:** `ink-2` (softer than `ink-1`, reduces visual harshness)
- **Left border:** 4px solid brand accent color, positioned left of header text
- **Padding:** 1rem left padding (space between border and text)
- **Spacing above:** 5rem margin-bottom (80px) between sections; first section gets 2rem
- **Spacing below header:** 0.5rem to preview text, 1rem from preview to body prose

### Prose Typography
- **Line-height:** 1.8 (up from ~1.6, improves readability at wider widths)
- **Paragraph spacing:** 1rem margin-bottom between `<p>` tags
- **Preview text** (description under header): color `ink-3` to visually de-emphasize vs. body

---

## Citations & References System

### Citation Chips (inline in prose)

**Appearance:** Remain unchanged—`·1`, `·2`, etc.

**Interactions:**

1. **Click:** 
   - Smooth scroll to References section
   - Highlight the corresponding reference row with `bg-surface-2` or `accent/10%`
   - Auto-fade highlight after 2 seconds
   - Scroll margin: position reference row ~200px from top of viewport for readability

2. **Hover:** 
   - After 300ms hover, show a tooltip
   - Tooltip content: source icon + name, first ~60 chars of data point, timestamp (e.g., "Salesforce — forecast: Commit — Updated 2h ago")
   - Position above chip, avoid going off-screen
   - Auto-hide on mouse leave

3. **Click reference row** (at bottom in References section):
   - Opens a modal with full reference details
   - Modal shows: source, full data point text, timestamp, "View raw" button

### References Section

**Position:** After all `BriefSection` components, before closing `</div>` in `Brief`

**Container styling:**
- Background: `bg-ink/5` or `bg-surface-2` (subtle background)
- Border: 1px solid `line`
- Border-radius: 8px
- Padding: 2rem
- Margin-top: 6rem (significant visual break from last section)
- Max-width: inherit (same 900px constraint as content above)

**Header:**
- Text: "References"
- Size: 12-14px
- Style: uppercase, letter-spaced
- Color: `ink-4` (very subtle)
- Margin-bottom: 1.5rem

**List format (Chicago-style):**
```
1. [source icon] Source Name — Data point text — Updated 2h ago
2. [source icon] Source Name — Data point text — Updated 6 weeks ago
...
```

**Row styling:**
- Height: ~1.5rem per row
- Gap between rows: 0.75rem (compact but readable)
- Each row is clickable (cursor pointer, slight hover effect like `opacity-75` or light background)
- Source icon: 16x16, left-aligned
- Text: single line, truncate data point if needed (full text in modal)

---

## Components

### New Components

**`ReferencesSection`**
- Props: `citations: CitationMeta[]`, `onReferenceClick?: (citationId: string) => void`
- Renders the References container, header, and list
- Each reference row is a clickable element
- Handles scroll-to logic or delegates via callback

**`CitationTooltip`** (or reuse existing)
- Props: `sourceIcon`, `sourceName`, `dataPoint`, `timestamp`, `isOpen`, `position`
- Renders a small tooltip above the citation chip
- Auto-positioning to stay in viewport

**`ReferenceModal`**
- Props: `citation: CitationMeta`, `isOpen`, `onClose`
- Shows full reference details
- Includes "View raw" button (behavior TBD—likely opens a modal or drawer with raw data)

### Existing Component Changes

**`Brief` (brief.tsx)**
- Update max-width in className: `.centered && "mx-auto max-w-[900px]"`
- Add `ReferencesSection` after the section loop
- Pass modal state or callback handlers to manage reference details modal

**`BriefSection` (brief-section.tsx)**
- Update header className:
  - Increase font-size (h2 → larger)
  - Add left border styling
  - Update color to `ink-2`
  - Adjust spacing (margin-bottom 5rem, margin-bottom 0.5rem to preview)
- No structural changes

**`Prose` (prose.tsx)**
- Citation chip: wire up click handler to scroll to reference + highlight
- Add hover tooltip rendering (can use existing tooltip system or new CitationTooltip)
- Pass citation click callback from parent

---

## Data Flow

1. **Citation clicks in prose** → Parent (`BriefSection`) receives `onCitationClick(citationId)`
2. **Parent bubbles to `Brief`** → Stores in state: `selectedCitationId`
3. **`Brief` passes down** → Passes `selectedCitationId` to `ReferencesSection`
4. **`ReferencesSection` highlights** → Applies highlight class/style to matching reference row
5. **Reference row click** → Opens `ReferenceModal` with full citation details
6. **Modal close** → Clears `selectedCitationId` state

---

## Edge Cases & Interactions

- **Multiple citations on one line:** Each citation is individually clickable, can hover/click independently
- **Citation not in References:** Should not happen (data integrity), but design assumes 1:1 mapping
- **Very long data points:** Truncated in list view, full text in modal or tooltip
- **Small screens:** References section remains readable (may need responsive padding adjustments for mobile, future scope)
- **Highlight timing:** Fade highlight after 2 seconds so it doesn't feel sticky
- **Tooltip positioning:** Check viewport edges, flip to below if no room above

---

## Styling Values Summary

| Element | Property | Value |
|---------|----------|-------|
| Brief (centered) | max-width | 900px |
| Section header | font-size | 28-32px |
| Section header | font-weight | 600 |
| Section header | color | ink-2 |
| Section header | border-left | 4px solid accent |
| Section header | padding-left | 1rem |
| Section header | margin-bottom | 5rem |
| First section | margin-top | 2rem |
| Prose | line-height | 1.8 |
| Prose `<p>` | margin-bottom | 1rem |
| Preview text | color | ink-3 |
| References container | margin-top | 6rem |
| References container | padding | 2rem |
| References container | background | bg-ink/5 |
| References container | border | 1px solid line |
| References container | border-radius | 8px |
| Reference row | gap | 0.75rem |
| References header | font-size | 12-14px |
| References header | text-transform | uppercase |
| References header | color | ink-4 |

---

## Testing

- **Visual:** Brief reads at wide width, headers feel prominent, sections breathe, References section is clean and scannable
- **Interaction:** Click citation → scroll + highlight works smoothly, tooltip appears on hover, modal opens on reference row click
- **Accessibility:** Headers use semantic `<h2>`, references use `<ol>` for ordered list, modal has proper focus management
- **Responsive:** Layout works at small widths (future: may need adjustments for mobile)

---

## Not in Scope

- Mobile optimizations (responsive adjustments for < 768px)
- "View raw" modal implementation (deferred to follow-up)
- Citation data model changes (assumes existing CitationMeta structure)
- Styling for other layout modes (workspace, split) — focused on reading/centered mode only

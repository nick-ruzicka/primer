"use client";

import type { CitationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  n: number;
  citation?: CitationMeta;
  hovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

/**
 * Inline Perplexity-style citation chip: `·N` with a source-colored dot.
 * When the matching citation hasn't arrived yet, renders in a "pending" state.
 */
export function CitationChip({
  n,
  citation,
  hovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  const src = citation?.source_system?.toLowerCase() ?? "internal";
  // aria-label keeps screen-reader access; we deliberately don't set the
  // native `title` attribute because the React CitationTooltip provides
  // a richer hover preview, and the OS tooltip would render a clashing
  // delayed bubble on top of it.
  const ariaLabel = citation
    ? `Citation ${n} from ${citation.source_system ?? "unknown source"}, ${citation.time_ago}`
    : `Citation ${n}, loading`;
  return (
    <button
      type="button"
      className={cn("cite", `src-${src}`, hovered && "hot")}
      aria-label={ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <span className="cite-dot" />
      <span>{n}</span>
    </button>
  );
}

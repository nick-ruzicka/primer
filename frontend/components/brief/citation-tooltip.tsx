"use client";

import type { CitationMeta } from "@/lib/types";

interface CitationTooltipProps {
  citation: CitationMeta;
  x: number;
  y: number;
}

export function CitationTooltip({ citation, x, y }: CitationTooltipProps) {
  const isSurfaced = citation.provenance === "surfaced";
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 bg-surface border border-line-strong rounded-md px-3 py-2 shadow-md max-w-[320px]"
      style={{ left: x + 12, top: y + 12 }}
    >
      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-1">
        ·{citation.n} · {citation.provenance}
      </div>
      <div className="text-xs font-medium text-ink mb-1">
        {citation.source_system}
        {citation.source_module && (
          <span className="text-ink-3"> · {citation.source_module}</span>
        )}
      </div>
      {isSurfaced ? (
        <div className="text-xs text-ink-2 font-serif italic leading-snug">
          &ldquo;{(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet.slice(0, 140)}
          {(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet.length > 140 ? "…" : ""}&rdquo;
        </div>
      ) : (
        <div className="font-mono text-xs text-ink">
          <span className="text-ink-3">{(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).field}</span>
          <span className="text-ink-4 mx-1">=</span>
          <span>{(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).value_display}</span>
        </div>
      )}
      <div className="text-[10px] text-ink-4 mt-1">{citation.time_ago}</div>
    </div>
  );
}

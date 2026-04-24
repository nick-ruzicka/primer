"use client";

import type { CitationMeta } from "@/lib/types";

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

  const isSurfaced = citation.provenance === "surfaced";
  const url = isSurfaced
    ? (citation as Extract<CitationMeta, { provenance: "surfaced" }>).url
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-lg max-w-xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-4 mb-1">
              Reference ·{citation.n}
            </div>
            <h2 className="text-lg font-serif text-ink">
              {citation.source_system}
              {citation.source_module && (
                <span className="text-ink-3"> · {citation.source_module}</span>
              )}
            </h2>
          </div>
          <span
            className={`text-[9.5px] font-bold tracking-wider uppercase px-2 py-1 rounded-full border ${
              citation.provenance === "raw"
                ? "text-ink-4"
                : citation.provenance === "scored"
                ? "text-warn-strong"
                : "text-source-exa"
            }`}
          >
            {citation.provenance}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          {isSurfaced ? (
            <blockquote className="font-serif italic text-ink-2 text-base leading-relaxed border-l-2 border-line pl-4 py-1">
              &ldquo;{(citation as Extract<CitationMeta, { provenance: "surfaced" }>).snippet}&rdquo;
            </blockquote>
          ) : (
            <div className="font-mono text-sm">
              <div className="text-ink-3 mb-1">Field</div>
              <div className="text-ink">
                {(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).field}
              </div>
              <div className="text-ink-3 mt-3 mb-1">Value</div>
              <div className="text-ink font-medium">
                {(citation as Extract<CitationMeta, { provenance: "raw" | "scored" }>).value_display}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line text-xs text-ink-3 space-y-1">
            <div>
              <span className="text-ink-4">Retrieved:</span>{" "}
              {new Date(citation.retrieved_at).toLocaleString()}
            </div>
            {citation.data_as_of && (
              <div>
                <span className="text-ink-4">Data as of:</span>{" "}
                {new Date(citation.data_as_of).toLocaleString()}
              </div>
            )}
            <div>
              <span className="text-ink-4">Relative:</span> {citation.time_ago}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-accent text-accent-ink rounded font-medium text-sm hover:opacity-90"
            >
              View original ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-sunk text-ink-2 rounded text-sm hover:bg-line"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

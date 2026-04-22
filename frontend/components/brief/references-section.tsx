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
        {citations.map((citation) => (
          <li
            key={citation.evid}
            className={`flex gap-3 cursor-pointer hover:opacity-75 p-2 rounded transition-colors ${
              highlightedCitationId === citation.evid
                ? "bg-surface-2"
                : ""
            }`}
            onClick={() => onReferenceClick?.(citation.evid)}
          >
            <span className="text-ink-3 flex-shrink-0 w-6">{citation.n}.</span>
            <span className="flex-shrink-0 w-4">{sourceIcons[citation.source] || "🔗"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">
                {citation.label}
              </div>
              <div className="text-xs text-ink-4 mt-0.5">
                {citation.time_ago}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

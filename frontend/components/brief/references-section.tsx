"use client";

import type { CitationMeta, FactProvenance } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReferencesSectionProps {
  id?: string;
  citations: CitationMeta[];
  onReferenceClick?: (evid: string) => void;
  highlightedCitationId?: string | null;
}

const SOURCE_DOT_COLOR: Record<string, string> = {
  Salesforce: "var(--color-source-sf)",
  Snowflake: "var(--color-source-snowflake)",
  Catalyst: "var(--color-source-catalyst)",
  NetSuite: "var(--color-source-netsuite)",
  Gong: "var(--color-source-gong)",
  Exa: "var(--color-source-exa)",
};

const TAG_LABEL: Record<FactProvenance, string> = {
  raw: "Raw",
  scored: "Scored",
  surfaced: "Surfaced",
};

const TAG_CLASS: Record<FactProvenance, string> = {
  raw: "text-ink-4",
  scored: "text-warn-strong",
  surfaced: "text-source-exa",
};

export function ReferencesSection({
  id,
  citations,
  onReferenceClick,
  highlightedCitationId,
}: ReferencesSectionProps) {
  if (citations.length === 0) return null; // §5.4 empty-state rule

  return (
    <section
      id={id}
      className="references-section mt-24 pt-6 border-t border-line"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-4">
        References
      </h3>
      <ol className="space-y-0">
        {citations.map((citation) => {
          const isHighlighted = highlightedCitationId === citation.evid;
          const dotColor =
            SOURCE_DOT_COLOR[citation.source_system] ??
            "var(--color-source-internal)";
          return (
            <li
              key={citation.evid}
              className={cn(
                "grid grid-cols-[28px_1fr] gap-3 py-3 border-b border-line/30 cursor-pointer",
                "hover:bg-surface-sunk rounded",
                isHighlighted && "bg-accent-soft/20 shadow-[inset_2px_0_0_var(--color-accent)] px-2",
              )}
              onClick={() => onReferenceClick?.(citation.evid)}
            >
              <span className="font-serif text-ink-3 text-sm text-right pt-0.5">
                {citation.n}.
              </span>
              <div className="min-w-0">
                {/* row 1: source system + module */}
                <div className="text-xs text-ink-3 mb-1">
                  <span
                    className="inline-block w-[7px] h-[7px] rounded-full mr-2 align-[2px]"
                    style={{ background: dotColor }}
                  />
                  <span className="text-ink-2 font-medium">
                    {citation.source_system}
                  </span>
                  {citation.source_module && (
                    <span className="text-ink-3"> · {citation.source_module}</span>
                  )}
                </div>

                {/* row 2: field = value OR snippet */}
                {citation.provenance === "surfaced" ? (
                  <div className="font-serif italic text-ink-2 text-[14.5px] leading-snug mb-1">
                    &ldquo;{citation.snippet}&rdquo;
                  </div>
                ) : (
                  <div className="font-mono text-sm text-ink mb-1">
                    <span className="text-ink-3">{citation.field}</span>
                    <span className="text-ink-4 mx-1">=</span>
                    <span className="text-ink font-medium">
                      {citation.value_display}
                    </span>
                  </div>
                )}

                {/* row 3: timing · tag */}
                <div className="text-[11.5px] text-ink-4 flex items-center gap-2">
                  {citation.data_as_of && (
                    <>
                      <span>data as of {citation.data_as_of.slice(0, 10)}</span>
                      <span className="text-ink-4">·</span>
                    </>
                  )}
                  <span
                    className={cn(
                      citation.provenance === "surfaced" &&
                        (citation as Extract<CitationMeta, { provenance: "surfaced" }>).url &&
                        "after:content-['_↗'] after:text-ink-4 after:text-xs",
                    )}
                  >
                    {citation.time_ago}
                  </span>
                  <span
                    className={cn(
                      "text-[9.5px] font-bold tracking-wider uppercase px-[7px] py-[2px] rounded-full border",
                      TAG_CLASS[citation.provenance],
                      "ml-auto",
                    )}
                  >
                    {TAG_LABEL[citation.provenance]}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

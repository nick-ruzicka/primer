import type { CitationMeta } from "@/lib/fixtures/northstar-beauty-brief";
import { ReactNode } from "react";

interface ReferencesSectionProps {
  id?: string;
  citations: CitationMeta[];
  onReferenceClick?: (citationId: string) => void;
  highlightedCitationId?: string | null;
  sourceIcons?: Record<string, ReactNode>;
}

function getSourceName(source: string): string {
  const nameMap: Record<string, string> = {
    sf: "Salesforce",
    salesforce: "Salesforce",
    gong: "Gong",
    netsuite: "NetSuite",
    catalyst: "Catalyst",
    snowflake: "Snowflake",
    exa: "Exa",
    hubspot: "HubSpot",
    internal: "Internal",
  };
  return nameMap[source.toLowerCase()] || source;
}

export function ReferencesSection({
  id,
  citations,
  onReferenceClick,
  highlightedCitationId,
  sourceIcons = {},
}: ReferencesSectionProps) {
  return (
    <section id={id} className="references-section mt-24 pt-6 border-t border-line">
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
              <div className="text-xs font-semibold text-ink-3 uppercase">{getSourceName(citation.source)}</div>
              <div className="text-sm text-ink mt-0.5">{citation.label}</div>
              <div className="text-xs text-ink-4 mt-1">{citation.time_ago}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

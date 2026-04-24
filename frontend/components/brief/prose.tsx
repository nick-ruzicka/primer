"use client";

import { Fragment, useState, useRef } from "react";
import type {
  CitationMeta,
  Paragraph,
} from "@/lib/fixtures/northstar-beauty-brief";
import { CitationChip } from "./citation-chip";
import { CitationTooltip } from "./citation-tooltip";

interface Props {
  nodes: Paragraph;
  citations: CitationMeta[];
  hoveredEvid?: string | null;
  onCitationHover?: (evid: string | null) => void;
  onCitationClick?: (evid: string) => void;
}

/**
 * Source icon map and name map for citations.
 */
function getSourceIcon(source: string) {
  const iconMap: Record<string, React.ReactNode> = {
    sf: <span>📊</span>,
    salesforce: <span>📊</span>,
    gong: <span>🎙️</span>,
    netsuite: <span>📑</span>,
    catalyst: <span>⚡</span>,
    snowflake: <span>❄️</span>,
    exa: <span>🔍</span>,
    hubspot: <span>🤝</span>,
    internal: <span>🔗</span>,
  };
  return iconMap[source.toLowerCase()] || <span>🔗</span>;
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

/**
 * Renders a paragraph of inline nodes (text/bold/italic + citation chips).
 * Keeps citation chips clickable so they can scroll the intelligence panel
 * to the matching evidence card. Shows CitationTooltip on citation hover.
 */
export function Prose({
  nodes,
  citations,
  hoveredEvid,
  onCitationHover,
  onCitationClick,
}: Props) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const citationRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <>
      {nodes.map((node, idx) => {
        if (node.kind === "text") {
          return <Fragment key={idx}>{node.value}</Fragment>;
        }
        if (node.kind === "bold") {
          return <b key={idx}>{node.value}</b>;
        }
        if (node.kind === "italic") {
          return <em key={idx}>{node.value}</em>;
        }
        // cite
        const match = citations.find((c) => c.n === node.n);
        return (
          <Fragment key={idx}>
            <span
              ref={(el) => {
                if (el && match) {
                  citationRefs.current[match.evid] = el.querySelector("button");
                }
              }}
              onMouseEnter={(e) => {
                if (match && citationRefs.current[match.evid]) {
                  const rect = citationRefs.current[match.evid]!.getBoundingClientRect();
                  setTooltipPos({
                    top: rect.top,
                    left: rect.left + rect.width / 2,
                  });
                  setHoveredCitation(match.evid);
                }
              }}
              onMouseLeave={() => setHoveredCitation(null)}
            >
              <CitationChip
                n={node.n}
                citation={match}
                hovered={!!match && hoveredEvid === match.evid}
                onMouseEnter={() => match && onCitationHover?.(match.evid)}
                onMouseLeave={() => onCitationHover?.(null)}
                onClick={() => match && onCitationClick?.(match.evid)}
              />
            </span>
            {match && hoveredCitation === match.evid && (
              <CitationTooltip
                sourceIcon={getSourceIcon(match.source)}
                sourceName={getSourceName(match.source)}
                dataPoint={match.label}
                timestamp={match.time_ago}
                isOpen={hoveredCitation === match.evid}
                position={tooltipPos}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

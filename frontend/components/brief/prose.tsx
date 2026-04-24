"use client";

import { Fragment, useState, useRef } from "react";
import type { Paragraph } from "@/lib/fixtures/northstar-beauty-brief";
import type { CitationMeta } from "@/lib/types";
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
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
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
              onMouseEnter={() => {
                if (match && citationRefs.current[match.evid]) {
                  const rect = citationRefs.current[match.evid]!.getBoundingClientRect();
                  setTooltipPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
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
                citation={match}
                x={tooltipPos.x}
                y={tooltipPos.y}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

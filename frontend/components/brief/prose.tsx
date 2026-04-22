"use client";

import { Fragment } from "react";
import type { CitationMeta, Paragraph } from "@/lib/fixtures/northstar-beauty-brief";
import { CitationChip } from "./citation-chip";

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
 * to the matching evidence card.
 */
export function Prose({
  nodes,
  citations,
  hoveredEvid,
  onCitationHover,
  onCitationClick,
}: Props) {
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
          <CitationChip
            key={idx}
            n={node.n}
            citation={match}
            hovered={!!match && hoveredEvid === match.evid}
            onMouseEnter={() => match && onCitationHover?.(match.evid)}
            onMouseLeave={() => onCitationHover?.(null)}
            onClick={() => match && onCitationClick?.(match.evid)}
          />
        );
      })}
    </>
  );
}

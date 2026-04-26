"use client";

import { useState } from "react";
import type { BriefFixture } from "@/lib/fixtures/northstar-beauty-brief";
import type { CitationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BriefSection } from "./brief-section";
import { ReferencesSection } from "./references-section";
import { ReferenceModal } from "./reference-modal";

interface Props {
  brief: BriefFixture;
  /**
   * Layout variant:
   *  - `centered` — Reading mode: wide editorial column, no frame.
   *  - `split`    — Split mode: slightly narrower so it fits a two-pane grid.
   *  - `workspace`— Workspace mode: compact, cards, sections collapsible.
   */
  layout?: "centered" | "split" | "workspace";
  hoveredEvid?: string | null;
  onCitationHover?: (evid: string | null) => void;
  onCitationClick?: (evid: string) => void;
  /**
   * When true, citation clicks skip the in-brief scroll to the References
   * section. Set in Workspace mode where citations drive the right-side
   * intelligence panel instead of an in-column references list.
   */
  disableReferencesScroll?: boolean;
}

export function Brief({
  brief,
  layout = "split",
  hoveredEvid,
  onCitationHover,
  onCitationClick,
  disableReferencesScroll = false,
}: Props) {
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);
  const [selectedReferenceForModal, setSelectedReferenceForModal] = useState<CitationMeta | null>(null);
  const isWorkspace = layout === "workspace";

  const handleCitationClick = (citationId: string) => {
    setHighlightedCitationId(citationId);
    onCitationClick?.(citationId);

    if (disableReferencesScroll) return;

    setTimeout(() => {
      const refElement = document.getElementById("references-section");
      if (refElement) {
        refElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  const getCitationById = (citationId: string): CitationMeta | null => {
    return brief.citations.find((c) => c.evid === citationId) || null;
  };
  return (
    <div
      className={cn(
        "min-w-0 flex-1 px-7 pb-10 pt-6",
        layout === "centered" && "mx-auto max-w-[900px] px-8",
        layout === "split" && "border-r border-line",
        isWorkspace &&
          "max-w-[360px] border-r border-line bg-surface/40 px-4 py-4",
      )}
    >
      {brief.sections.map((s) => (
        <BriefSection
          key={s.id}
          section={s}
          citations={brief.citations}
          variant={isWorkspace ? "workspace" : "default"}
          defaultOpen={isWorkspace ? s.id === "01" : true}
          hoveredEvid={hoveredEvid}
          onCitationHover={onCitationHover}
          onCitationClick={handleCitationClick}
        />
      ))}
      {!isWorkspace && (
        <>
          <ReferencesSection
            id="references-section"
            citations={brief.citations}
            onReferenceClick={(citationId) => {
              const citation = getCitationById(citationId);
              setSelectedReferenceForModal(citation);
            }}
            highlightedCitationId={highlightedCitationId}
          />
          <ReferenceModal
            citation={selectedReferenceForModal}
            isOpen={selectedReferenceForModal !== null}
            onClose={() => setSelectedReferenceForModal(null)}
          />
        </>
      )}
    </div>
  );
}

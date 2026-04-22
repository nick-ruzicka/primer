"use client";

import type { BriefFixture } from "@/lib/fixtures/northstar-beauty-brief";
import { cn } from "@/lib/utils";
import { BriefSection } from "./brief-section";

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
}

export function Brief({
  brief,
  layout = "split",
  hoveredEvid,
  onCitationHover,
  onCitationClick,
}: Props) {
  const isWorkspace = layout === "workspace";
  return (
    <div
      className={cn(
        "min-w-0 flex-1 px-7 pb-10 pt-6",
        layout === "centered" && "mx-auto max-w-[760px] px-8",
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
          onCitationClick={onCitationClick}
        />
      ))}
    </div>
  );
}

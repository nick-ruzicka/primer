"use client";

import type { BriefFixture } from "@/lib/fixtures/northstar-beauty-brief";
import type { CitationMeta } from "@/lib/types";
import { Prose } from "./prose";

interface Props {
  brief: BriefFixture;
  revealed: Record<string, boolean>;
  citations: CitationMeta[];
  hoveredEvid?: string | null;
  onCitationHover?: (evid: string | null) => void;
}

/**
 * Workspace mode header strip. Renders the brief's "read" paragraph(s)
 * above the intelligence grid so the rep has a one-paragraph anchor for
 * what the intel panels relate to. Only the prose — no kicker, no title —
 * since the read is the framing, not a section in its own right here.
 */
export function WorkspaceReadStrip({
  brief,
  revealed,
  citations,
  hoveredEvid,
  onCitationHover,
}: Props) {
  const readSection = brief.sections.find((s) => s.key === "read");
  if (
    !readSection ||
    !revealed[readSection.id] ||
    !readSection.paragraphs?.length
  ) {
    return null;
  }
  return (
    <div className="border-b border-line bg-bg px-7 py-6">
      <div className="prose-body mx-auto max-w-[820px]">
        {readSection.paragraphs.map((p, idx) => (
          <p key={idx} className="brief-paragraph text-ink-2">
            <Prose
              nodes={p}
              citations={citations}
              hoveredEvid={hoveredEvid}
              onCitationHover={onCitationHover}
            />
          </p>
        ))}
      </div>
    </div>
  );
}

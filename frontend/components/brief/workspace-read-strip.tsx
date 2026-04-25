"use client";

import type { BriefFixture } from "@/lib/fixtures/northstar-beauty-brief";
import type { CitationMeta } from "@/lib/types";
import { Prose } from "./prose";

interface Props {
  brief: BriefFixture | null;
  revealed: Record<string, boolean>;
  citations: CitationMeta[];
  hoveredEvid?: string | null;
  onCitationHover?: (evid: string | null) => void;
}

/**
 * Workspace mode left column. Renders the brief's "read" paragraph(s)
 * alongside the intelligence grid so the rep has a one-paragraph anchor
 * for what the intel relates to. Always renders the column container so
 * the workspace grid keeps both cells populated even before the read
 * section streams in — otherwise the lone intelligence panel collapses
 * into the left grid cell on initial load.
 */
export function WorkspaceReadStrip({
  brief,
  revealed,
  citations,
  hoveredEvid,
  onCitationHover,
}: Props) {
  const readSection = brief?.sections.find((s) => s.key === "read");
  const ready =
    readSection &&
    revealed[readSection.id] &&
    Boolean(readSection.paragraphs?.length);

  return (
    <div className="min-w-0 overflow-y-auto border-r border-line bg-bg px-7 py-6">
      {ready ? (
        <div className="prose-body">
          {readSection.paragraphs?.map((p, idx) => (
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
      ) : (
        <ReadSkeleton />
      )}
    </div>
  );
}

function ReadSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 w-[92%] rounded bg-ink-4/15" />
      <div className="h-3 w-full rounded bg-ink-4/15" />
      <div className="h-3 w-[85%] rounded bg-ink-4/15" />
      <div className="h-3 w-[78%] rounded bg-ink-4/15" />
    </div>
  );
}

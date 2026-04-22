"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type {
  BriefSection as BriefSectionData,
  CitationMeta,
} from "@/lib/fixtures/northstar-beauty-brief";
import { cn } from "@/lib/utils";
import { HedgePill } from "./hedge-pill";
import { Prose } from "./prose";

interface Props {
  section: BriefSectionData;
  citations: CitationMeta[];
  /** `workspace` variant makes section collapsible (matches reference Mode 2). */
  variant?: "default" | "workspace";
  defaultOpen?: boolean;
  hoveredEvid?: string | null;
  onCitationHover?: (evid: string | null) => void;
  onCitationClick?: (evid: string) => void;
}

export function BriefSection({
  section,
  citations,
  variant = "default",
  defaultOpen = true,
  hoveredEvid,
  onCitationHover,
  onCitationClick,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isWorkspace = variant === "workspace";
  const isOpen = !isWorkspace || open;

  return (
    <section
      className={cn(
        "brief-section",
        isWorkspace &&
          "rounded-lg border border-line bg-surface-2 px-4 py-3 mb-2",
      )}
    >
      <header
        className={cn(
          "brief-head flex items-baseline gap-2.5 border-l-4 border-l-accent pl-4 mb-20 pb-0",
          isWorkspace && "border-b border-line border-l-0 pl-0 mb-0 pb-1 cursor-pointer select-none",
        )}
        onClick={isWorkspace ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          isWorkspace
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
        role={isWorkspace ? "button" : undefined}
        tabIndex={isWorkspace ? 0 : undefined}
        aria-expanded={isWorkspace ? isOpen : undefined}
      >
        <span className="brief-kicker">{section.id}</span>
        <h2 className="brief-title text-2xl font-semibold text-ink-2">
          {section.id === "01" && (
            <span className="yellow-accent" aria-hidden />
          )}
          {section.title}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <HedgePill
            level={section.hedge.level}
            label={section.hedge.label}
            tip={section.hedge.tip}
          />
          {isWorkspace && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-ink-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0",
              )}
              strokeWidth={2}
            />
          )}
        </div>
      </header>

      {isOpen && (
        <div>
          <p className="brief-preview text-ink-3 mt-1 mb-4">{section.preview}</p>
          {section.paragraphs && (
            <div className={cn(section.id === "01" ? "the-read" : "why-stack", "prose-body")}>
              {section.paragraphs.map((p, idx) => (
                <p key={idx}>
                  <Prose
                    nodes={p}
                    citations={citations}
                    hoveredEvid={hoveredEvid}
                    onCitationHover={onCitationHover}
                    onCitationClick={onCitationClick}
                  />
                </p>
              ))}
            </div>
          )}
          {section.actions && (
            <ol className="actions-list">
              {section.actions.map((a) => (
                <li key={a.id}>
                  <span className="action-num">{a.id}</span>
                  <div>
                    <div className="action-body">
                      <Prose
                        nodes={a.body}
                        citations={citations}
                        hoveredEvid={hoveredEvid}
                        onCitationHover={onCitationHover}
                        onCitationClick={onCitationClick}
                      />
                    </div>
                    <div className="action-why">
                      <Prose
                        nodes={a.rationale}
                        citations={citations}
                        hoveredEvid={hoveredEvid}
                        onCitationHover={onCitationHover}
                        onCitationClick={onCitationClick}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {section.questions && (
            <ol className="talk-list">
              {section.questions.map((q, idx) => (
                <li key={idx}>
                  <Prose
                    nodes={q}
                    citations={citations}
                    hoveredEvid={hoveredEvid}
                    onCitationHover={onCitationHover}
                    onCitationClick={onCitationClick}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

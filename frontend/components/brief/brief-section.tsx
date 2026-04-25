"use client";

import {
  ChevronDown,
  MessageCircle,
  MessageCircleQuestion,
} from "lucide-react";
import { useState } from "react";
import type { BriefSection as BriefSectionData } from "@/lib/fixtures/northstar-beauty-brief";
import type { CitationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isInferenceParagraph } from "@/lib/inference-detector";
import { Prose, paragraphPlainText } from "./prose";

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

/**
 * Spacing strategy for brief sections:
 * - Header margin-bottom: mb-1 (0.25rem) - small gap between header and preview
 * - Preview margin: mt-1 mb-4 (0.25rem top, 1rem bottom) - separates preview from body
 * - Section margin: CSS .brief-section { margin-bottom: 5rem } - controls space between sections
 * - Workspace mode: header mb-0, section CSS applies mb-2 inline for compact spacing
 */

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
          "brief-head flex items-baseline gap-2.5 border-l-4 border-l-accent pl-4 mb-1 pb-0",
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
        {isWorkspace && (
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 text-ink-4 transition-transform",
              isOpen ? "rotate-180" : "rotate-0",
            )}
            strokeWidth={2}
          />
        )}
      </header>

      {isOpen && (
        <div>
          <p className="brief-preview text-ink-3 mt-1 mb-4">{section.preview}</p>
          {section.paragraphs && (
            <div className={cn(section.id === "01" ? "the-read" : "why-stack", "prose-body")}>
              {section.paragraphs.map((p, idx) => {
                const plain = paragraphPlainText(p);
                const isInference = isInferenceParagraph(plain);
                return (
                  <p
                    key={idx}
                    className={cn("brief-paragraph", isInference && "inference")}
                    aria-label={isInference ? "Inferential passage" : undefined}
                  >
                    <Prose
                      nodes={p}
                      citations={citations}
                      hoveredEvid={hoveredEvid}
                      onCitationHover={onCitationHover}
                      onCitationClick={onCitationClick}
                    />
                  </p>
                );
              })}
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
            <ol
              className={cn(
                "talk-list",
                section.key === "discovery" && "discovery-list",
                section.key === "talk_track" && "talktrack-list",
              )}
            >
              {section.questions.map((q, idx) => (
                <li key={idx}>
                  <div>
                    <QuestionMarker kind={section.key} />
                    <Prose
                      nodes={q}
                      citations={citations}
                      hoveredEvid={hoveredEvid}
                      onCitationHover={onCitationHover}
                      onCitationClick={onCitationClick}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Tiny icon prefix that distinguishes the two question-list sections.
 * Discovery questions probe; talk-track items frame. Different artifacts.
 */
function QuestionMarker({ kind }: { kind: BriefSectionData["key"] }) {
  if (kind === "discovery") {
    return (
      <MessageCircleQuestion
        className="question-marker discovery"
        strokeWidth={1.8}
        aria-hidden
      />
    );
  }
  if (kind === "talk_track") {
    return (
      <MessageCircle
        className="question-marker talktrack"
        strokeWidth={1.8}
        aria-hidden
      />
    );
  }
  return null;
}

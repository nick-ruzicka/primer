"use client";

import type { ReactNode } from "react";

interface TocSection {
  id: string;
  number: string;
  title: string;
  demoLevel?: "essential" | "supporting" | "optional";
}

interface Props {
  sections: TocSection[];
  activeId: string;
  onNavigate?: () => void;
}

export function WriteupToc({ sections, activeId, onNavigate }: Props) {
  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    onNavigate?.();
  };

  const bgMap = {
    essential: "bg-good/5",
    supporting: "bg-accent-soft/5",
    optional: "",
  };

  return (
    <nav aria-label="Table of contents">
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const isActive = activeId === section.id;
          const bgClass = section.demoLevel ? bgMap[section.demoLevel] : "";
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => handleClick(section.id)}
                className={
                  "flex w-full items-baseline gap-2 border-l-2 py-[5px] pl-3 pr-2 rounded text-left transition-colors " +
                  (isActive
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-3 hover:text-ink-2") +
                  ` ${bgClass}`
                }
              >
                {section.number && (
                  <span className="flex-none font-mono text-[10px] text-ink-4">
                    {section.number}
                  </span>
                )}
                <span className="text-[12px] leading-[1.3]">{section.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 pl-3">
        <button
          type="button"
          onClick={() => handleClick("top")}
          className="flex items-center gap-1.5 text-[11px] text-ink-4 transition-colors hover:text-ink-2"
        >
          <span>↑</span>
          <span>Back to top</span>
        </button>
      </div>
    </nav>
  );
}

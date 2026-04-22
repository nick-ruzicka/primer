"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { IntelligenceItem, IntelligenceSection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IntelCard } from "./intel-card";

interface Props {
  sections: IntelligenceSection[];
  /**
   * Layout variant:
   *   - `compact`  — Mode 1 (split): narrow column, cards stacked
   *   - `workspace`— Mode 2: filter bar + grouped cards, adaptive layouts per section
   *   - `overlay`  — Mode 3 Reading: slide-over panel with close button
   */
  variant?: "compact" | "workspace" | "overlay";
  hoveredEvid?: string | null;
  onCardHover?: (evid: string | null) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
}

export function IntelligencePanel({
  sections,
  variant = "compact",
  hoveredEvid,
  onCardHover,
  onClose,
  title = "Account Intelligence",
  description,
}: Props) {
  const [filter, setFilter] = useState<"all" | "flagged" | "critical">("all");
  const [search, setSearch] = useState("");

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  );
  const flaggedCount = allItems.filter((i) => i.flag === "critical" || i.flag === "warn").length;
  const totalCount = allItems.length;

  const itemMatches = (it: IntelligenceItem) => {
    if (filter === "flagged" && !it.flag) return false;
    if (filter === "critical" && it.flag !== "critical") return false;
    if (search) {
      const hay = [it.label, it.value, it.sub, it.web?.title, it.web?.snippet, it.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  };

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-hidden bg-surface",
        variant === "overlay" && "h-full",
      )}
      aria-label={title}
    >
      {variant !== "compact" && (
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[17px] font-medium leading-tight text-ink">
              {variant === "overlay" ? "Account intelligence" : title}
            </h2>
            {description && <p className="mt-0.5 text-[11.5px] text-ink-3 italic">{description}</p>}
          </div>
          {variant === "overlay" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close intelligence panel"
              className="rounded-md p-1 text-ink-3 hover:bg-surface-sunk hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </header>
      )}

      {variant !== "compact" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={totalCount} />
          <FilterChip active={filter === "flagged"} onClick={() => setFilter("flagged")} label="Flagged" count={flaggedCount} />
          <FilterChip active={filter === "critical"} onClick={() => setFilter("critical")} label="Critical only" />
          <div className="flex-1" />
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-4" strokeWidth={2} />
            <input
              type="search"
              placeholder="Search intelligence…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-[200px] rounded-md border border-line bg-surface-2 pl-7 pr-2 text-[11.5px] text-ink-2 placeholder:text-ink-4 focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {variant === "compact" && (
          <header className="mb-4 flex items-baseline gap-2">
            <h2 className="font-serif text-[15px] font-medium text-ink">Account Intelligence</h2>
            <span className="ml-auto text-[10.5px] text-ink-4">
              grouped by topic · click a <span className="cite inline-flex"><span className="cite-dot" /><span>n</span></span> in the brief to jump
            </span>
          </header>
        )}

        {sections.length === 0 && <IntelligenceSkeleton />}

        {sections.map((section, sectionIdx) => {
          const visible = section.items.filter(itemMatches);
          if (visible.length === 0) return null;
          return (
            <section key={section.id} className="mb-6 last:mb-0">
              <header className="mb-3 flex items-baseline gap-2 border-b border-dashed border-line pb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
                  0{sectionIdx + 1}
                </span>
                <h3 className="font-serif text-[15px] font-medium text-ink">{section.title}</h3>
                {variant !== "compact" && (
                  <span className="ml-auto text-[10.5px] text-ink-4">
                    {visible.length} of {section.items.length}
                  </span>
                )}
                {variant === "compact" && (
                  <span className="ml-auto font-mono text-[10px] text-ink-4">{section.items.length}</span>
                )}
              </header>
              <SectionBody
                section={section}
                items={visible}
                hoveredEvid={hoveredEvid}
                onCardHover={onCardHover}
              />
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-2/40 p-4">
          <div className="h-3 w-20 rounded bg-ink-4/20" />
          <div className="mt-3 h-5 w-3/4 rounded bg-ink-4/25" />
          <div className="mt-2 h-3 w-full rounded bg-ink-4/15" />
          <div className="mt-1.5 h-3 w-[85%] rounded bg-ink-4/15" />
          <div className="mt-3 flex gap-2">
            <div className="h-4 w-14 rounded-full bg-ink-4/15" />
            <div className="h-4 w-12 rounded-full bg-ink-4/15" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "border-ink bg-ink text-bg"
          : "border-line bg-surface-2 text-ink-3 hover:border-line-strong",
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "rounded-sm px-1 font-mono text-[9.5px]",
            active ? "bg-bg/25 text-bg/80" : "bg-surface-sunk text-ink-4",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface BodyProps {
  section: IntelligenceSection;
  items: IntelligenceItem[];
  hoveredEvid?: string | null;
  onCardHover?: (evid: string | null) => void;
}

function SectionBody({ section, items, hoveredEvid, onCardHover }: BodyProps) {
  const cardProps = (evid: string) => ({
    hovered: hoveredEvid === evid,
    onMouseEnter: () => onCardHover?.(evid),
    onMouseLeave: () => onCardHover?.(null),
  });

  if (section.id === "relationship") {
    const people = items.filter((i) => i.evid === "priya" || i.evid === "sponsor");
    const health = items.filter((i) => i.evid === "rel-health");
    return (
      <>
        {people.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-3 @xl:grid-cols-2 sm:grid-cols-2">
            {people.map((p) => (
              <IntelCard key={p.evid} item={p} variant="person" {...cardProps(p.evid)} />
            ))}
          </div>
        )}
        {health.map((h) => (
          <IntelCard key={h.evid} item={h} variant="health" {...cardProps(h.evid)} />
        ))}
      </>
    );
  }

  if (section.id === "commercial") {
    const hero = items.filter((i) => i.flag === "critical");
    const others = items.filter((i) => i.flag !== "critical");
    return (
      <>
        {hero.map((h) => (
          <IntelCard key={h.evid} item={h} variant="hero" {...cardProps(h.evid)} />
        ))}
        {others.map((o) => (
          <IntelCard key={o.evid} item={o} variant="standard" {...cardProps(o.evid)} />
        ))}
      </>
    );
  }

  if (section.id === "external") {
    return (
      <>
        {items.map((item) => (
          <IntelCard key={item.evid} item={item} variant="web" {...cardProps(item.evid)} />
        ))}
      </>
    );
  }

  // product / conversations / portfolio — compact standard list
  return (
    <>
      {items.map((item) => (
        <IntelCard key={item.evid} item={item} variant="standard" {...cardProps(item.evid)} />
      ))}
    </>
  );
}

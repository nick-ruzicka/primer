"use client";

import { ArrowUpRight } from "lucide-react";
import type { IntelligenceItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

interface Props {
  item: IntelligenceItem;
  /** Rendering variant:
   *  - `standard` — regular card with label + value + sub + pill row.
   *  - `hero`     — critical hero card (e.g. past-due): tinted bg, big number, CTA.
   *  - `person`   — relationship card: circular avatar + name + role.
   *  - `web`      — external signal: favicon + title + snippet.
   *  - `health`   — relationship-health with sparkline to the right of the value.
   */
  variant?: "standard" | "hero" | "person" | "web" | "health";
  hovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function IntelCard({
  item,
  variant = "standard",
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  if (variant === "person") return <PersonCard item={item} hovered={hovered} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} />;
  if (variant === "web") return <WebCard item={item} hovered={hovered} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} />;
  if (variant === "hero") return <HeroCard item={item} hovered={hovered} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} />;
  if (variant === "health") return <HealthCard item={item} hovered={hovered} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} />;
  return <StandardCard item={item} hovered={hovered} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} />;
}

interface SubProps {
  item: IntelligenceItem;
  hovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function cardClass(item: IntelligenceItem, hovered?: boolean, extra?: string): string {
  return cn(
    "intel-card",
    item.flag === "critical" && "critical",
    item.flag === "warn" && "watch",
    hovered && "hot",
    extra,
  );
}

function StandardCard({ item, hovered, onClick, onMouseEnter, onMouseLeave }: SubProps) {
  return (
    <div
      data-evid={item.evid}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cardClass(item, hovered)}
    >
      {item.flagPill && (
        <span className={cn("card-flag", item.flag === "warn" ? "warn" : "")}>
          <span className="dot" aria-hidden />
          {item.flagPill}
        </span>
      )}
      <div className="card-label">{item.label}</div>
      <div className="card-value">{item.value}</div>
      {item.sub && (
        <p
          className="card-person-meta"
          dangerouslySetInnerHTML={{ __html: item.sub }}
        />
      )}
      <div className="card-foot">
        <span className={cn("pill", `src-${item.source}`)}>
          <span className="dot" aria-hidden />
          {item.source}
        </span>
        {item.time && <span className="pill time">· {item.time}</span>}
        {item.action && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onClick?.();
            }}
            className="open-link ml-auto flex items-center gap-0.5"
          >
            {item.action.replace(" ↗", "")}
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

function PersonCard({ item, hovered, onClick, onMouseEnter, onMouseLeave }: SubProps) {
  const fullValue = item.value ?? "";
  const [name, role] = fullValue.split("—").map((s) => s.trim());
  const isExec = item.evid === "sponsor";
  const initials = (name || "?")
    .split(/[\s—·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div
      data-evid={item.evid}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(cardClass(item, hovered), "flex items-start gap-3")}
    >
      <div className={cn("card-avatar", isExec && "exec")}>{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="card-compact-label">{item.label}</div>
        <div className="card-person-name">{name}</div>
        {role && <div className="card-person-role">{role}</div>}
        {item.sub && (
          <p className="card-person-meta" dangerouslySetInnerHTML={{ __html: item.sub }} />
        )}
        <div className="card-foot">
          <span className={cn("pill", `src-${item.source}`)}>
            <span className="dot" aria-hidden />
            {item.source}
          </span>
          {item.time && <span className="pill time">· {item.time}</span>}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onClick?.();
            }}
            className="open-link ml-auto"
          >
            Open →
          </a>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ item, hovered, onClick, onMouseEnter, onMouseLeave }: SubProps) {
  return (
    <div
      data-evid={item.evid}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cardClass(item, hovered)}
    >
      {item.flagPill && (
        <span className={cn("card-flag", item.flag === "warn" ? "warn" : "")}>
          <span className="dot" aria-hidden />
          {item.flagPill}
        </span>
      )}
      <div className="card-label">{item.label}</div>
      <div className="card-value flex items-baseline gap-3">
        <span>{item.value}</span>
        <Sparkline />
      </div>
      {item.sub && (
        <p className="card-person-meta" dangerouslySetInnerHTML={{ __html: item.sub }} />
      )}
      <div className="card-foot">
        <span className={cn("pill", `src-${item.source}`)}>
          <span className="dot" aria-hidden />
          {item.source}
        </span>
        {item.time && <span className="pill time">· {item.time}</span>}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onClick?.();
          }}
          className="open-link ml-auto"
        >
          Open →
        </a>
      </div>
    </div>
  );
}

function HeroCard({ item, hovered, onClick, onMouseEnter, onMouseLeave }: SubProps) {
  const [lead, ...rest] = (item.value ?? "").split("·").map((s) => s.trim());
  const meta = rest.join(" · ");
  const flagIsCritical = item.flag === "critical";
  return (
    <div
      data-evid={item.evid}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn("intel-card hero", flagIsCritical && "critical", hovered && "hot")}
    >
      {item.flagPill && (
        <span className={cn("card-flag", item.flag === "warn" ? "warn" : "")}>
          <span className="dot" aria-hidden />
          {item.flagPill}
        </span>
      )}
      <div className="card-hero-label">{item.label}</div>
      <div className="card-hero-number">{lead}</div>
      {meta && (
        <div className="mt-1 text-[12px] font-medium text-ink-3 tnum">{meta}</div>
      )}
      {item.sub && (
        <p className="card-person-meta max-w-[420px]" dangerouslySetInnerHTML={{ __html: item.sub }} />
      )}
      <div className="card-foot">
        <span className={cn("pill", `src-${item.source}`)}>
          <span className="dot" aria-hidden />
          {item.source}
        </span>
        {item.time && <span className="pill time">· {item.time}</span>}
        {item.action && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onClick?.();
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-bg"
          >
            {item.action.replace(" ↗", "")}
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

function WebCard({ item, hovered, onClick, onMouseEnter, onMouseLeave }: SubProps) {
  if (!item.web) return <StandardCard item={item} hovered={hovered} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
  return (
    <div
      data-evid={item.evid}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cardClass(item, hovered)}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-surface-sunk text-[10px] font-semibold text-ink-3">
          {item.fav}
        </span>
        <span className="card-compact-label">{item.label}</span>
      </div>
      <div className="mt-1.5 font-serif text-[14.5px] font-medium leading-snug text-ink">
        {item.web.title}
      </div>
      <p
        className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2 [&_mark]:bg-accent-soft [&_mark]:text-ink [&_mark]:px-0.5 [&_mark]:rounded-sm"
        dangerouslySetInnerHTML={{ __html: item.web.snippet }}
      />
      <div className="card-foot">
        <span className="pill src-exa">
          <span className="dot" aria-hidden />
          Exa (web)
        </span>
        {item.sub && <span className="pill time">· {item.sub}</span>}
      </div>
    </div>
  );
}

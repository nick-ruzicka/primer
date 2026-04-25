"use client";

import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import { useState } from "react";
import type { SourceId, ValidationWarning } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceDot {
  id: SourceId;
  label: string;
  status: "ok" | "stale" | "pending";
  lastSync: string;
}

interface Props {
  confidence: number;
  sources: SourceDot[];
  staleCount: number;
  generatedAgo: string;
  warnings?: ValidationWarning[];
  onRegenerate?: () => void;
}

const warningKey = (w: ValidationWarning) =>
  `${w.severity}|${w.type}|${w.message}`;

/**
 * Meta strip between account header and main briefing body:
 * confidence ring · source dots · generated timestamp · validation pill ·
 * regenerate CTA. The pill expands a panel below the strip listing each
 * warning; critical warnings auto-expand on first paint, watch-only
 * warnings stay collapsed until the user clicks.
 */
export function ConfidenceStrip({
  confidence,
  sources,
  staleCount,
  generatedAgo,
  warnings = [],
  onRegenerate,
}: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  const visible = warnings.filter((w) => !dismissed.has(warningKey(w)));
  const criticalCount = visible.filter(
    (w) => w.severity === "critical",
  ).length;
  const watchCount = visible.filter((w) => w.severity === "watch").length;
  const hasCritical = criticalCount > 0;
  // Default-collapsed for watch-only; auto-expand once critical is present.
  // Explicit user toggle (open or close) overrides the default thereafter.
  const open = userOpen !== null ? userOpen : hasCritical;

  return (
    <div className="border-b border-line bg-surface" aria-live="polite">
      <div className="flex items-center gap-4 px-7 py-3 text-[12px] text-ink-3">
        <div className="flex items-center gap-3">
          <ConfidenceRing value={confidence} />
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-4">
              Brief confidence
            </span>
            <span className="font-serif text-[15px] font-semibold text-ink tnum">
              {confidence}
            </span>
          </div>
        </div>

        <span className="h-6 w-px bg-line" aria-hidden />

        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1">
          <span className="flex gap-0.5" aria-label="Source health">
            {sources.map((s) => (
              <span
                key={s.id}
                title={`${s.label} · ${s.lastSync}`}
                className={
                  "block h-1.5 w-1.5 rounded-full " +
                  (s.status === "ok"
                    ? "bg-good"
                    : s.status === "stale"
                      ? "bg-warn-strong"
                      : "bg-ink-4")
                }
              />
            ))}
          </span>
          <span className="text-ink-3">
            <b className="font-medium text-ink-2">{sources.length}</b> sources
            queried
          </span>
          {staleCount > 0 && (
            <span className="text-warn-strong">· {staleCount} stale</span>
          )}
        </span>

        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1">
          <Clock3 className="h-3 w-3 text-ink-4" strokeWidth={2.2} />
          <span className="text-ink-3">
            Generated <b className="font-medium text-ink-2">{generatedAgo}</b>
          </span>
        </span>

        {visible.length > 0 && (
          <WarningsPill
            count={visible.length}
            criticalCount={criticalCount}
            watchCount={watchCount}
            open={open}
            onToggle={() => setUserOpen(!open)}
          />
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:border-line-strong"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2.2} />
          Regenerate brief
        </button>
      </div>

      {open && visible.length > 0 && (
        <WarningsPanel
          warnings={visible}
          onDismiss={(key) =>
            setDismissed((prev) => {
              const next = new Set(prev);
              next.add(key);
              return next;
            })
          }
        />
      )}
    </div>
  );
}

function WarningsPill({
  count,
  criticalCount,
  watchCount,
  open,
  onToggle,
}: {
  count: number;
  criticalCount: number;
  watchCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const tone: "critical" | "watch" = criticalCount > 0 ? "critical" : "watch";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${count} validation ${count === 1 ? "issue" : "issues"}, click to ${open ? "collapse" : "expand"}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors",
        tone === "critical"
          ? "border-bad/60 bg-bad-soft text-ink hover:bg-bad-soft/80"
          : "border-warn-strong/40 bg-warn-soft/60 text-ink-2 hover:bg-warn-soft/80",
      )}
    >
      <AlertTriangle
        className={cn(
          "h-3 w-3",
          tone === "critical" ? "text-bad" : "text-warn-strong",
        )}
        strokeWidth={2.2}
      />
      <span className="leading-none">
        <b className="font-medium">{count}</b>{" "}
        {count === 1 ? "issue" : "issues"}
        {(criticalCount > 0 || watchCount > 0) && " · "}
        {criticalCount > 0 && (
          <span className="text-bad">{criticalCount} critical</span>
        )}
        {criticalCount > 0 && watchCount > 0 && (
          <span className="text-ink-3">, </span>
        )}
        {watchCount > 0 && (
          <span className="text-warn-strong">{watchCount} watch</span>
        )}
      </span>
      <ChevronDown
        className={cn(
          "h-3 w-3 transition-transform duration-200",
          open && "rotate-180",
        )}
        strokeWidth={2.2}
      />
    </button>
  );
}

function WarningsPanel({
  warnings,
  onDismiss,
}: {
  warnings: ValidationWarning[];
  onDismiss: (key: string) => void;
}) {
  return (
    <ul
      className="divide-y divide-line/60 border-t border-line bg-surface-sunk/30 transition-all duration-200"
      role="list"
    >
      {warnings.map((w) => {
        const critical = w.severity === "critical";
        const key = warningKey(w);
        return (
          <li
            key={key}
            className={cn(
              "flex items-start gap-3 px-7 py-2.5 text-[12.5px]",
              critical
                ? "border-l-4 border-bad bg-bad-soft/20"
                : "border-l-4 border-warn-strong bg-warn-soft/20",
            )}
          >
            {critical ? (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-bad"
                strokeWidth={2}
              />
            ) : (
              <Info
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn-strong"
                strokeWidth={2}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em]",
                    critical ? "bg-bad text-bg" : "bg-warn-strong/90 text-bg",
                  )}
                >
                  {w.severity}
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-4">
                  {w.type.replace(/_/g, " ")}
                </span>
                {w.sources && w.sources.length > 0 && (
                  <span className="ml-auto flex gap-1">
                    {w.sources.map((src) => (
                      <span key={src} className={cn("pill", `src-${src}`)}>
                        <span className="dot" aria-hidden />
                        {src}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <p className="mt-1 leading-relaxed text-ink-2">{w.message}</p>
              {w.brief_excerpt && (
                <p className="mt-1 text-[11.5px] italic text-ink-3">
                  &ldquo;{w.brief_excerpt}&rdquo;
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(key)}
              aria-label="Mark warning reviewed"
              className="rounded-md p-1 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 11;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);
  const tier = value >= 75 ? "high" : value >= 55 ? "med" : "low";
  const color =
    tier === "high"
      ? "var(--color-accent)"
      : tier === "med"
        ? "var(--color-warn-strong)"
        : "var(--color-bad)";
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="3"
      />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

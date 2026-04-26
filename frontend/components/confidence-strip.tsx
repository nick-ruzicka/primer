"use client";

import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Info,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  /** Epoch ms when the brief finished generating. Null while streaming. */
  generatedAt: number | null;
  /** True while the brief is still streaming in. Suppresses the freshness chip. */
  streaming?: boolean;
  warnings?: ValidationWarning[];
  onRegenerate?: () => void;
}

/**
 * Meta strip between account header and main briefing body:
 * confidence ring · source dots · generated timestamp · validation pill ·
 * regenerate CTA. The pill stays collapsed by default; the rep clicks to
 * expand a list of compact warning rows. Each row click expands inline to
 * reveal the cited fact and quoted excerpt. Warnings persist until the
 * brief is regenerated — they are validator catches, not notifications.
 */
export function ConfidenceStrip({
  confidence,
  sources,
  staleCount,
  generatedAt,
  streaming = false,
  warnings = [],
  onRegenerate,
}: Props) {
  const [open, setOpen] = useState(false);
  const { label: ageLabel, tier: ageTier } = useFreshness(generatedAt, streaming);

  const criticalCount = warnings.filter(
    (w) => w.severity === "critical",
  ).length;
  const watchCount = warnings.filter((w) => w.severity === "watch").length;

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

        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors",
            ageTier === "fresh" &&
              "border-line bg-surface-2 text-ink-3",
            ageTier === "warming" &&
              "border-warn-strong/35 bg-warn-soft/40 text-ink-2",
            ageTier === "stale" &&
              "border-bad/40 bg-bad-soft/60 text-ink",
            ageTier === "streaming" && "border-line bg-surface-2 text-ink-3",
          )}
          title={
            generatedAt
              ? `Brief generated at ${new Date(generatedAt).toLocaleTimeString()}`
              : "Brief is currently streaming in."
          }
        >
          <Clock3
            className={cn(
              "h-3 w-3",
              ageTier === "fresh" && "text-ink-4",
              ageTier === "warming" && "text-warn-strong",
              ageTier === "stale" && "text-bad",
              ageTier === "streaming" && "text-ink-4 animate-pulse",
            )}
            strokeWidth={2.2}
          />
          <span>
            Generated <b className="font-medium text-ink">{ageLabel}</b>
          </span>
        </span>

        {warnings.length > 0 && (
          <WarningsPill
            count={warnings.length}
            criticalCount={criticalCount}
            watchCount={watchCount}
            open={open}
            onToggle={() => setOpen((v) => !v)}
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

      {open && warnings.length > 0 && (
        <ul
          className="divide-y divide-line/60 border-t border-line bg-surface-sunk/30"
          role="list"
        >
          {warnings.map((w, i) => (
            <WarningRow key={`${w.severity}-${w.type}-${i}`} warning={w} />
          ))}
        </ul>
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

const SCORE_LABELS: { key: keyof NonNullable<ValidationWarning["scores"]>; label: string }[] = [
  { key: "citation_match", label: "citation" },
  { key: "source_appropriateness", label: "source" },
  { key: "semantic_drift", label: "drift" },
  { key: "inference_legitimacy", label: "inference" },
];

function scoreBarColor(val: number): string {
  if (val >= 0.70) return "bg-bad";
  if (val >= 0.40) return "bg-warn-strong";
  return "bg-ink-4";
}

function WarningRow({ warning }: { warning: ValidationWarning }) {
  const [expanded, setExpanded] = useState(false);
  const critical = warning.severity === "critical";
  const hasDetail = Boolean(warning.brief_excerpt) || Boolean(warning.scores);
  return (
    <li
      className={cn(
        "border-l-4",
        critical ? "border-bad" : "border-warn-strong",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        aria-expanded={hasDetail ? expanded : undefined}
        disabled={!hasDetail}
        className={cn(
          "flex w-full items-center gap-3 px-7 py-2 text-left text-[12.5px] transition-colors",
          hasDetail && "hover:bg-surface-sunk/50",
          !hasDetail && "cursor-default",
        )}
      >
        <span
          className={cn(
            "flex-shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em]",
            critical ? "bg-bad text-bg" : "bg-warn-strong/90 text-bg",
          )}
        >
          {warning.severity}
        </span>
        {warning.warning_confidence !== undefined && (
          <span className={cn(
            "flex-shrink-0 font-mono text-[10px] tabular-nums",
            critical ? "text-bad" : "text-warn-strong",
          )}>
            {warning.warning_confidence.toFixed(2)}
          </span>
        )}
        {warning.sources && warning.sources.length > 0 && (
          <span className="flex flex-shrink-0 gap-1">
            {warning.sources.map((src) => (
              <span key={src} className={cn("pill", `src-${src}`)}>
                <span className="dot" aria-hidden />
                {src}
              </span>
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-ink-2">
          {warning.message}
        </span>
        {hasDetail && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 text-ink-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
            strokeWidth={2}
          />
        )}
      </button>
      {expanded && hasDetail && (
        <div className="flex items-start gap-3 px-7 pb-3 pt-0 text-[12px] text-ink-3">
          {critical ? (
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-bad"
              strokeWidth={2}
            />
          ) : (
            <Info
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn-strong"
              strokeWidth={2}
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-4">
              {warning.type.replace(/_/g, " ")}
            </p>
            {warning.brief_excerpt && (
              <p className="italic text-ink-3">
                &ldquo;{warning.brief_excerpt}&rdquo;
              </p>
            )}
            {warning.scores && (
              <div className="mt-2 space-y-1.5">
                {SCORE_LABELS.map(({ key, label }) => {
                  const val = warning.scores![key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-16 flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-4">
                        {label}
                      </span>
                      <div className="h-1.5 flex-1 rounded-full bg-surface-sunk">
                        <div
                          className={cn("h-1.5 rounded-full transition-all", scoreBarColor(val))}
                          style={{ width: `${val * 100}%` }}
                        />
                      </div>
                      <span className="w-7 flex-shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-3">
                        {val.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

type FreshnessTier = "streaming" | "fresh" | "warming" | "stale";

/**
 * Live freshness label + tier for the "Generated …" chip. Ticks every 30s
 * while the component is mounted, so a brief that ages from 4m → 6m flips
 * its tone without a manual refresh. Tier thresholds match the Redis cache
 * TTL pattern (15m): fresh under 5m, warming 5–15m, stale past 15m.
 */
function useFreshness(
  generatedAt: number | null,
  streaming: boolean,
): { label: string; tier: FreshnessTier } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (streaming || !generatedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [streaming, generatedAt]);

  if (streaming || !generatedAt) {
    return { label: "streaming…", tier: "streaming" };
  }
  const ageMs = Math.max(0, now - generatedAt);
  const minutes = Math.floor(ageMs / 60_000);
  const tier: FreshnessTier =
    minutes < 5 ? "fresh" : minutes < 15 ? "warming" : "stale";
  let label: string;
  if (minutes < 1) label = "just now";
  else if (minutes < 60) label = `${minutes}m ago`;
  else {
    const hours = Math.floor(minutes / 60);
    label = `${hours}h ago`;
  }
  return { label, tier };
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

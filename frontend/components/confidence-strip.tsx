"use client";

import { Clock3, RefreshCw } from "lucide-react";
import type { SourceId } from "@/lib/types";

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
  onRegenerate?: () => void;
}

/**
 * Meta strip between account header and main briefing body:
 * confidence ring · source dots · generated timestamp · regenerate CTA.
 */
export function ConfidenceStrip({
  confidence,
  sources,
  staleCount,
  generatedAgo,
  onRegenerate,
}: Props) {
  return (
    <div className="flex items-center gap-4 border-b border-line bg-surface px-7 py-3 text-[12px] text-ink-3">
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

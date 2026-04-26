"use client";

import { Activity, Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { IntelligenceState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  intelligence: IntelligenceState;
  /** Hides the strip once the brief itself is fully rendered. */
  briefComplete: boolean;
}

/**
 * Live progress strip that surfaces the read-layer pre-fetch as it happens.
 * Shows the six source systems lighting up in turn as intelligence sections
 * land via the SSE `intelligence` events. The mapping section→source is
 * approximate (each section is the main consumer of the named system); the
 * intent is to make the "six MCP servers, pre-fetch first" architecture
 * legible to the rep instead of hiding it behind a skeleton.
 */
export function SourcePulseStrip({ intelligence, briefComplete }: Props) {
  // Section order corresponds to the order the backend emits them in
  // `_briefing_event_stream` (see backend/main.py). Each chip lights up the
  // moment its matching IntelligenceSection arrives in the store.
  const arrivals: { id: SourceKey; label: string; arrived: boolean }[] = [
    { id: "salesforce", label: "Salesforce", arrived: !!intelligence.commercial },
    { id: "snowflake", label: "Snowflake", arrived: !!intelligence.product },
    { id: "catalyst", label: "Catalyst", arrived: !!intelligence.relationship },
    { id: "netsuite", label: "NetSuite", arrived: !!intelligence.commercial },
    { id: "gong", label: "Gong", arrived: !!intelligence.conversations },
    { id: "exa", label: "Exa", arrived: !!intelligence.external },
  ];
  const arrivedCount = arrivals.filter((a) => a.arrived).length;
  const total = arrivals.length;

  // Once the brief itself completes, fade the strip out so it doesn't compete
  // with the finished read for attention. Mount/unmount on a small delay so
  // we never get a jarring instant-collapse.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (briefComplete) {
      const id = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(id);
    }
    setVisible(true);
  }, [briefComplete]);

  if (!visible) return null;

  const allArrived = arrivedCount === total;

  return (
    <div
      className={cn(
        "border-b border-line bg-surface/80 backdrop-blur-sm transition-opacity duration-500",
        briefComplete && "opacity-0",
      )}
      role="status"
      aria-live="polite"
      aria-label={`Pulled ${arrivedCount} of ${total} sources`}
    >
      <div className="flex items-center gap-3 px-7 py-2 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <Activity
            className={cn(
              "h-3 w-3 text-accent",
              !allArrived && "animate-pulse",
            )}
            strokeWidth={2.4}
          />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em]">
            {allArrived ? "Pre-fetch complete" : "Pulling intelligence"}
          </span>
        </span>

        <span className="h-3 w-px bg-line" aria-hidden />

        <ul className="flex flex-wrap items-center gap-1.5" role="list">
          {arrivals.map((a) => (
            <li key={a.id}>
              <SourceChip
                source={a.id}
                label={a.label}
                arrived={a.arrived}
                streaming={!briefComplete}
              />
            </li>
          ))}
        </ul>

        <span className="ml-auto font-mono text-[10.5px] tabular-nums text-ink-4">
          {arrivedCount}/{total}
        </span>
      </div>
    </div>
  );
}

type SourceKey =
  | "salesforce"
  | "snowflake"
  | "catalyst"
  | "netsuite"
  | "gong"
  | "exa";

function SourceChip({
  source,
  label,
  arrived,
  streaming,
}: {
  source: SourceKey;
  label: string;
  arrived: boolean;
  streaming: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
        arrived
          ? "border-accent/40 bg-accent/10 text-ink"
          : "border-line bg-surface-2 text-ink-4",
      )}
    >
      <span
        className={cn(
          "block h-1.5 w-1.5 rounded-full",
          arrived ? `src-${source}-dot bg-good` : "bg-ink-4/40",
          !arrived && streaming && "animate-pulse",
        )}
        aria-hidden
      />
      <span>{label}</span>
      {arrived && (
        <Check
          className="h-2.5 w-2.5 text-good"
          strokeWidth={3}
          aria-hidden
        />
      )}
    </span>
  );
}

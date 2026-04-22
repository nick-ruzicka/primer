"use client";

import type { ConfidenceLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  level: ConfidenceLevel;
  label: string;
  tip?: string;
}

/**
 * Per-section confidence pill. Purple for very-likely / likely (soft variant),
 * accent yellow for agent-recommendation, neutral for draft.
 */
export function HedgePill({ level, label, tip }: Props) {
  return (
    <span
      className={cn("brief-hedge", `confidence-${level}`)}
      tabIndex={0}
      title={tip}
    >
      <span>{label}</span>
    </span>
  );
}

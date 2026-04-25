"use client";

import { useEffect, useState } from "react";

/**
 * Tiers map to styling buckets in the rail. `null` here is a sentinel for
 * "don't render a chip at all" — used when there's no scheduled call (or
 * the call is in the past / unparseable).
 */
export type CallTimingTier =
  | "urgent" // <30 min — pulsing accent
  | "soon" // <60 min — accent, no pulse
  | "today" // later today
  | "tomorrow"
  | "thisWeek" // within 7 days
  | "later"; // >7 days

export interface CallTiming {
  label: string;
  tier: CallTimingTier;
  /** ms until the call, never negative. */
  diffMs: number;
}

/**
 * Computes label + tier from a target ISO timestamp and a "now" anchor.
 * Pulled out of the hook so the "Next Call" picker can score candidates
 * with a single shared `now` and stay deterministic across renders.
 */
export function computeCallTiming(
  targetIso: string | null | undefined,
  now: number,
): CallTiming | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target) || target <= now) return null;

  const diffMs = target - now;
  const diffMin = Math.round(diffMs / 60_000);
  const targetDate = new Date(target);
  const nowDate = new Date(now);

  if (diffMin < 30) {
    return { label: `in ${Math.max(1, diffMin)} min`, tier: "urgent", diffMs };
  }
  if (diffMin < 60) {
    return { label: `in ${diffMin} min`, tier: "soon", diffMs };
  }

  const sameDay = isSameLocalDay(targetDate, nowDate);
  if (sameDay) {
    return { label: `today ${formatClock(targetDate)}`, tier: "today", diffMs };
  }

  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(targetDate, tomorrow)) {
    return { label: "tomorrow", tier: "tomorrow", diffMs };
  }

  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return {
      label: `${WEEKDAYS[targetDate.getDay()]} ${formatClock(targetDate)}`,
      tier: "thisWeek",
      diffMs,
    };
  }

  return { label: "next week", tier: "later", diffMs };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatClock(d: Date): string {
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  if (minutes === 0) return `${hours12}${period}`;
  return `${hours12}:${String(minutes).padStart(2, "0")}${period}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Ticks every 30 s while mounted so "in 12 min" decrements naturally
 * during a session. Mirrors the freshness-chip pattern in
 * `confidence-strip.tsx`.
 */
export function useCallTiming(
  targetIso: string | null | undefined,
): CallTiming | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetIso]);

  return computeCallTiming(targetIso, now);
}

/**
 * `now` snapshot that ticks every 30 s. Used by code that needs to score
 * many timestamps with a single anchor (e.g. picking the soonest call).
 */
export function useTickingNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

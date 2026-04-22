"use client";

import { AlertTriangle, Info } from "lucide-react";
import type { ValidationWarning } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  warnings: ValidationWarning[];
}

/**
 * Top-of-main banner that stacks critical/watch validation messages. Rendered
 * after the brief generation completes (or as warnings arrive in the live path).
 */
export function ValidationBanner({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className="border-b border-line bg-surface" aria-live="polite">
      {warnings.map((w, idx) => {
        const critical = w.severity === "critical";
        return (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-3 px-7 py-3 text-[12.5px]",
              critical
                ? "bg-bad-soft text-ink border-l-4 border-bad"
                : "bg-warn-soft/60 text-ink-2 border-l-4 border-warn-strong",
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
            <div className="min-w-0">
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
              <p className="mt-1 leading-relaxed">{w.message}</p>
              {w.brief_excerpt && (
                <p className="mt-1 text-[11.5px] italic text-ink-3">
                  “{w.brief_excerpt}”
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

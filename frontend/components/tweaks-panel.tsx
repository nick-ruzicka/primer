"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Density = "comfortable" | "compact";
export type VerifyIntensity = "subtle" | "medium" | "loud";

interface Props {
  open: boolean;
  theme: "light" | "dark";
  density: Density;
  verify: VerifyIntensity;
  onThemeChange: (t: "light" | "dark") => void;
  onDensityChange: (d: Density) => void;
  onVerifyChange: (v: VerifyIntensity) => void;
  onClose: () => void;
}

/**
 * Floating lower-right panel. Matches reference "Tweaks" widget —
 * theme / density / verify-styling segmented controls.
 */
export function TweaksPanel({
  open,
  theme,
  density,
  verify,
  onThemeChange,
  onDensityChange,
  onVerifyChange,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <aside
      role="dialog"
      aria-label="Tweaks"
      className="fixed bottom-5 right-5 z-40 w-[280px] rounded-xl border border-line bg-surface-2 p-4 shadow-md"
    >
      <header className="mb-3 flex items-center">
        <span className="font-serif text-[14px] font-semibold text-ink">
          Tweaks
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tweaks panel"
          className="ml-auto text-ink-3 hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <div className="flex flex-col gap-3">
        <SegRow label="Theme">
          <Seg
            active={theme === "light"}
            onClick={() => onThemeChange("light")}
            label="Light"
          />
          <Seg
            active={theme === "dark"}
            onClick={() => onThemeChange("dark")}
            label="Dark"
          />
        </SegRow>
        <SegRow label="Density">
          <Seg
            active={density === "comfortable"}
            onClick={() => onDensityChange("comfortable")}
            label="Comfortable"
          />
          <Seg
            active={density === "compact"}
            onClick={() => onDensityChange("compact")}
            label="Compact"
          />
        </SegRow>
        <SegRow label="Verify styling">
          <Seg
            active={verify === "subtle"}
            onClick={() => onVerifyChange("subtle")}
            label="Subtle"
          />
          <Seg
            active={verify === "medium"}
            onClick={() => onVerifyChange("medium")}
            label="Medium"
          />
          <Seg
            active={verify === "loud"}
            onClick={() => onVerifyChange("loud")}
            label="Loud"
          />
        </SegRow>
      </div>
    </aside>
  );
}

function SegRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-4">
        {label}
      </span>
      <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-sunk p-0.5">
        {children}
      </div>
    </div>
  );
}

function Seg({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-surface-2 text-ink shadow-sm"
          : "text-ink-3 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

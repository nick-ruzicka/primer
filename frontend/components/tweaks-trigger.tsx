"use client";

import { Sliders } from "lucide-react";

interface Props {
  onClick: () => void;
  open: boolean;
}

/**
 * Small floating trigger for the Tweaks panel in the bottom-right. Hidden when
 * the panel is open so it doesn't stack over the panel itself.
 */
export function TweaksTrigger({ onClick, open }: Props) {
  if (open) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open tweaks"
      title="Tweaks"
      className="fixed bottom-5 right-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3 shadow-md transition-colors hover:border-line-strong hover:text-ink"
    >
      <Sliders className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

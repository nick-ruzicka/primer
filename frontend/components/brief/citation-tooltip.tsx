import { ReactNode } from "react";

interface CitationTooltipProps {
  sourceIcon: ReactNode; // e.g., <SalesforceIcon />
  sourceName: string; // e.g., "Salesforce"
  dataPoint: string; // e.g., "forecast: Commit"
  timestamp: string; // e.g., "Updated 2h ago"
  isOpen: boolean;
  position: { top: number; left: number };
}

export function CitationTooltip({
  sourceIcon,
  sourceName,
  dataPoint,
  timestamp,
  isOpen,
  position,
}: CitationTooltipProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute bg-surface-2 border border-line rounded-md px-3 py-2 text-sm shadow-lg z-50 pointer-events-none"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%) translateY(-100%)",
        marginTop: "-8px",
        whiteSpace: "nowrap",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="w-4 h-4">{sourceIcon}</span>
        <span className="font-semibold">{sourceName}</span>
      </div>
      <div className="text-ink-3 mt-1">{dataPoint.substring(0, 60)}</div>
      <div className="text-ink-4 text-xs mt-0.5">{timestamp}</div>
    </div>
  );
}

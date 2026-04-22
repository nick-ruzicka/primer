"use client";

import {
  BookOpen,
  Columns2,
  FileText,
  LayoutPanelLeft,
  Phone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  breadcrumbAccount: string;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  intelligenceCount?: number;
  intelligenceOpen?: boolean;
  onToggleIntelligence?: () => void;
  onRefresh?: () => void;
  onJoinCall?: () => void;
}

const MODES: { id: ViewMode; label: string; key: string; Icon: typeof Columns2 }[] = [
  { id: "split", label: "Split", key: "1", Icon: Columns2 },
  { id: "workspace", label: "Workspace", key: "2", Icon: LayoutPanelLeft },
  { id: "reading", label: "Reading", key: "3", Icon: BookOpen },
  { id: "writeup", label: "Writeup", key: "4", Icon: FileText },
];

export function Topbar({
  breadcrumbAccount,
  mode,
  onModeChange,
  intelligenceCount = 24,
  intelligenceOpen = false,
  onToggleIntelligence,
  onRefresh,
  onJoinCall,
}: Props) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-line bg-bg px-5">
      <nav className="flex items-center gap-2 text-[12px] text-ink-3" aria-label="Breadcrumb">
        <span>Briefings</span>
        <span className="text-ink-4">›</span>
        <span className="font-medium text-ink">{breadcrumbAccount}</span>
        <span className="text-ink-4">›</span>
        <span>Pre-call</span>
      </nav>

      <div className="flex-1" />

      <div
        role="tablist"
        aria-label="View mode"
        className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5"
      >
        {MODES.map(({ id, label, key, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => onModeChange(id)}
            title={`${label} view — press ${key}`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              mode === id
                ? "bg-ink text-bg shadow-sm"
                : "text-ink-3 hover:bg-surface-sunk hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{label}</span>
            <span
              className={cn(
                "ml-1 rounded-sm border px-1.5 font-mono text-[9.5px]",
                mode === id
                  ? "border-bg/30 text-bg/80"
                  : "border-line text-ink-4",
              )}
            >
              {key}
            </span>
          </button>
        ))}
      </div>

      {mode === "reading" && (
        <button
          type="button"
          onClick={onToggleIntelligence}
          title="Open account intelligence panel"
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
            intelligenceOpen
              ? "border-accent bg-accent text-accent-ink"
              : "border-line bg-surface-2 text-ink-2 hover:border-line-strong",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Intelligence</span>
          <span
            className={cn(
              "rounded-sm px-1 font-mono text-[10px]",
              intelligenceOpen ? "bg-accent-ink/15 text-accent-ink" : "bg-surface-sunk text-ink-4",
            )}
          >
            {intelligenceCount}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:border-line-strong"
      >
        <RefreshCw className="h-3 w-3" strokeWidth={2.2} />
        Refresh
      </button>

      <button
        type="button"
        onClick={onJoinCall}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink shadow-sm hover:bg-accent-2"
      >
        <Phone className="h-3 w-3" strokeWidth={2.2} />
        Join call
      </button>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountHeader } from "@/components/account-header";
import { Brief } from "@/components/brief/brief";
import { ConfidenceStrip } from "@/components/confidence-strip";
import { IntelligencePanel } from "@/components/intelligence/intelligence-panel";
import { LeftRail } from "@/components/left-rail";
import { Topbar } from "@/components/topbar";
import { TweaksPanel, type Density, type VerifyIntensity } from "@/components/tweaks-panel";
import { TweaksTrigger } from "@/components/tweaks-trigger";
import { findAccount, NORTHSTAR_GROUP, OTHER_UPCOMING_VISIBLE } from "@/lib/fixtures/accounts";
import { CURRENT_USER, DEFAULT_BRIEF_META, DEFAULT_SOURCE_STATUSES } from "@/lib/fixtures/brief-meta";
import { NORTHSTAR_BEAUTY_BRIEF } from "@/lib/fixtures/northstar-beauty-brief";
import {
  NORTHSTAR_BEAUTY_INTELLIGENCE,
  NORTHSTAR_BEAUTY_INTEL_COUNT,
} from "@/lib/fixtures/northstar-beauty-intelligence";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/types";

export default function BriefingPage() {
  const [activeId, setActiveId] = useState("ns-beauty");
  const [mode, setMode] = useState<ViewMode>("split");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [density, setDensity] = useState<Density>("comfortable");
  const [verify, setVerify] = useState<VerifyIntensity>("subtle");
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [hoveredEvid, setHoveredEvid] = useState<string | null>(null);

  const account = findAccount(activeId) ?? NORTHSTAR_GROUP.brands[0];
  const brief = NORTHSTAR_BEAUTY_BRIEF; // Phase 5 swaps this for store-driven state

  // Theme toggling — flip `.dark` on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Keyboard shortcuts for modes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // skip when typing in inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") setMode("split");
      else if (e.key === "2") setMode("workspace");
      else if (e.key === "3") setMode("reading");
      else if (e.key === "4") setMode("writeup");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleToggleIntelligence = useCallback(() => setIntelligenceOpen((o) => !o), []);

  return (
    <div className="grid h-screen grid-cols-[260px_minmax(0,1fr)] overflow-hidden bg-bg text-ink">
      <LeftRail
        group={NORTHSTAR_GROUP}
        otherUpcoming={OTHER_UPCOMING_VISIBLE}
        activeId={activeId}
        onSelect={setActiveId}
        currentUser={CURRENT_USER}
      />
      <div className="flex min-w-0 flex-col overflow-hidden">
        <Topbar
          breadcrumbAccount={account.full_name ?? account.name}
          mode={mode}
          onModeChange={setMode}
          intelligenceCount={NORTHSTAR_BEAUTY_INTEL_COUNT}
          intelligenceOpen={intelligenceOpen}
          onToggleIntelligence={handleToggleIntelligence}
        />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <AccountHeader account={account} parentGroupName={account.parent_group_name} />
          <ConfidenceStrip
            confidence={DEFAULT_BRIEF_META.confidence}
            confidenceLabel={DEFAULT_BRIEF_META.confidenceLabel}
            sources={DEFAULT_SOURCE_STATUSES}
            staleCount={DEFAULT_BRIEF_META.staleCount}
            generatedAgo={DEFAULT_BRIEF_META.generatedAgo}
          />
          <main
            className={cn(
              "flex flex-1 min-h-0",
              mode === "split" && "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
              mode === "workspace" && "grid grid-cols-[360px_minmax(0,1fr)]",
              mode === "reading" && "flex-col",
            )}
            aria-label="Brief + intelligence"
          >
            {mode === "reading" ? (
              <Brief
                brief={brief}
                layout="centered"
                hoveredEvid={hoveredEvid}
                onCitationHover={setHoveredEvid}
              />
            ) : (
              <Brief
                brief={brief}
                layout={mode === "workspace" ? "workspace" : "split"}
                hoveredEvid={hoveredEvid}
                onCitationHover={setHoveredEvid}
              />
            )}
            {mode !== "reading" && (
              <IntelligencePanel
                sections={NORTHSTAR_BEAUTY_INTELLIGENCE}
                variant={mode === "workspace" ? "workspace" : "compact"}
                hoveredEvid={hoveredEvid}
                onCardHover={setHoveredEvid}
              />
            )}
          </main>

          {/* Reading mode: slide-over intelligence panel */}
          {mode === "reading" && intelligenceOpen && (
            <div
              className="fixed inset-y-0 right-0 z-20 flex w-[560px] max-w-[90vw] flex-col border-l border-line bg-surface shadow-md"
              role="dialog"
              aria-label="Account intelligence overlay"
            >
              <IntelligencePanel
                sections={NORTHSTAR_BEAUTY_INTELLIGENCE}
                variant="overlay"
                hoveredEvid={hoveredEvid}
                onCardHover={setHoveredEvid}
                onClose={() => setIntelligenceOpen(false)}
                description={`Everything known about ${account.full_name ?? account.name}, updated in real time from 6 systems.`}
              />
            </div>
          )}
        </div>
      </div>

      <TweaksTrigger onClick={() => setTweaksOpen(true)} open={tweaksOpen} />
      <TweaksPanel
        open={tweaksOpen}
        theme={theme}
        density={density}
        verify={verify}
        onThemeChange={setTheme}
        onDensityChange={setDensity}
        onVerifyChange={setVerify}
        onClose={() => setTweaksOpen(false)}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountHeader } from "@/components/account-header";
import { ConfidenceStrip } from "@/components/confidence-strip";
import { LeftRail } from "@/components/left-rail";
import { Topbar } from "@/components/topbar";
import { TweaksPanel, type Density, type VerifyIntensity } from "@/components/tweaks-panel";
import { TweaksTrigger } from "@/components/tweaks-trigger";
import { findAccount, NORTHSTAR_GROUP, OTHER_UPCOMING_VISIBLE } from "@/lib/fixtures/accounts";
import { CURRENT_USER, DEFAULT_BRIEF_META, DEFAULT_SOURCE_STATUSES } from "@/lib/fixtures/brief-meta";
import type { ViewMode } from "@/lib/types";

export default function BriefingPage() {
  const [activeId, setActiveId] = useState("ns-beauty");
  const [mode, setMode] = useState<ViewMode>("split");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [density, setDensity] = useState<Density>("comfortable");
  const [verify, setVerify] = useState<VerifyIntensity>("subtle");
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);

  const account = findAccount(activeId) ?? NORTHSTAR_GROUP.brands[0];

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
          intelligenceCount={DEFAULT_BRIEF_META.intelligenceItemCount}
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
          <main className="flex-1" aria-label="Brief + intelligence">
            {/* Phase 3/4 fills this in */}
            <div className="px-7 py-10 font-serif text-[14px] text-ink-3">
              <p>
                Static shell ready. Brief + intelligence render in phase 3–4.
                Current mode: <b className="font-semibold text-ink">{mode}</b>.
              </p>
            </div>
          </main>
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

"use client";

import { useEffect } from "react";
import { AccountHeader } from "@/components/account-header";
import { Brief } from "@/components/brief/brief";
import { WorkspaceReadStrip } from "@/components/brief/workspace-read-strip";
import { ConfidenceStrip } from "@/components/confidence-strip";
import { IntelligencePanel } from "@/components/intelligence/intelligence-panel";
import { LeftRail } from "@/components/left-rail";
import { Topbar } from "@/components/topbar";
import { TweaksPanel } from "@/components/tweaks-panel";
import { TweaksTrigger } from "@/components/tweaks-trigger";
import { Writeup } from "@/components/writeup/writeup";
import { useBootstrap, useKeyboardShortcuts } from "@/lib/bootstrap";
import {
  CURRENT_USER,
  DEFAULT_BRIEF_META,
  DEFAULT_SOURCE_STATUSES,
} from "@/lib/fixtures/brief-meta";
import { loadAccount } from "@/lib/sse";
import {
  setDensity,
  setHoveredEvid,
  setIntelligencePanelOpen,
  setMode,
  setTheme,
  setTweaksOpen,
  setVerify,
  toggleSidebar,
  useStore,
} from "@/lib/store";
import type { IntelligenceSection } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BriefingPage() {
  useBootstrap();
  useKeyboardShortcuts();

  const mode = useStore((s) => s.mode);
  const theme = useStore((s) => s.theme);
  const density = useStore((s) => s.density);
  const verify = useStore((s) => s.verifyIntensity);
  const tweaksOpen = useStore((s) => s.tweaksOpen);
  const intelligenceOpen = useStore((s) => s.intelligencePanelOpen);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const activeId = useStore((s) => s.activeAccountId);
  const activeAccount = useStore((s) => s.activeAccount);
  const hoveredEvid = useStore((s) => s.hoveredEvid);
  const brief = useStore((s) => s.brief);
  const intelligence = useStore((s) => s.intelligence);
  const citations = useStore((s) => s.citations);
  const warnings = useStore((s) => s.warnings);
  const accountGroups = useStore((s) => s.accountGroups);
  const standaloneAccounts = useStore((s) => s.standalone);
  const accountsLoading =
    accountGroups.length === 0 && standaloneAccounts.length === 0;

  // Propagate theme to <html>.dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const displayAccount = activeAccount ??
    accountGroups[0]?.brands[0] ??
    standaloneAccounts[0] ?? {
      id: "",
      name: "",
      initial: "",
      color: "#6b6454",
      arr: "",
      state: "cool" as const,
      note: "",
    };

  // Rebuild intelligence section list in declaration order, skipping unrevealed.
  const intelligenceSections: IntelligenceSection[] = [
    intelligence.relationship,
    intelligence.commercial,
    intelligence.product,
    intelligence.conversations,
    intelligence.portfolio,
    intelligence.external,
  ].filter((s): s is IntelligenceSection => !!s);
  const intelligenceCount = intelligenceSections.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  // For prospects (arr_cents === 0), pull the open-pipeline dollar amount from
  // the Commercial section's pipeline line — typically an item whose sub reads
  // "Discovery · Pipeline" with value like "$220K". Not available on
  // /api/accounts, so we derive it from the live intelligence stream.
  const prospectPipeline =
    displayAccount.arr_cents === 0
      ? (intelligence.commercial?.items.find(
          (i) => /pipeline/i.test(i.sub ?? "") && /\$/.test(i.value ?? ""),
        )?.value ?? null)
      : null;

  return (
    <div
      className={cn(
        "grid h-screen overflow-hidden bg-bg text-ink transition-[grid-template-columns] duration-200",
        sidebarCollapsed
          ? "grid-cols-[0px_minmax(0,1fr)]"
          : "grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-opacity duration-200",
          sidebarCollapsed && "pointer-events-none opacity-0",
        )}
        aria-hidden={sidebarCollapsed}
      >
        <LeftRail
          groups={accountGroups}
          standalone={standaloneAccounts}
          activeId={activeId}
          onSelect={(id) => loadAccount(id)}
          currentUser={CURRENT_USER}
          loading={accountsLoading}
        />
      </div>
      <div className="flex min-w-0 flex-col overflow-hidden">
        <Topbar
          breadcrumbAccount={displayAccount.full_name ?? displayAccount.name}
          mode={mode}
          onModeChange={setMode}
          intelligenceCount={
            intelligenceCount || DEFAULT_BRIEF_META.intelligenceItemCount
          }
          intelligenceOpen={intelligenceOpen}
          onToggleIntelligence={() =>
            setIntelligencePanelOpen(!intelligenceOpen)
          }
          onRefresh={() => activeId && loadAccount(activeId, { refresh: true })}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {mode === "writeup" ? (
          <Writeup />
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <AccountHeader
              account={displayAccount}
              parentGroupName={displayAccount.parent_group_name}
              prospectPipeline={prospectPipeline}
            />
            <ConfidenceStrip
              confidence={
                brief.fixture?.confidence ?? DEFAULT_BRIEF_META.confidence
              }
              sources={DEFAULT_SOURCE_STATUSES}
              staleCount={DEFAULT_BRIEF_META.staleCount}
              generatedAgo={brief.complete ? "just now" : "streaming…"}
              warnings={warnings}
              onRegenerate={() =>
                activeId && loadAccount(activeId, { refresh: true })
              }
            />

            <main
              className={cn(
                "flex flex-1 min-h-0",
                mode === "split" &&
                  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                mode === "workspace" &&
                  "grid grid-cols-[minmax(0,460px)_minmax(0,1fr)]",
                mode === "reading" && "flex-col",
              )}
              aria-label="Brief + intelligence"
            >
              {mode === "workspace" && (
                <WorkspaceReadStrip
                  brief={brief.fixture}
                  revealed={brief.revealed}
                  citations={citations}
                  hoveredEvid={hoveredEvid}
                  onCitationHover={setHoveredEvid}
                />
              )}

              {mode !== "workspace" &&
                (() => {
                  const revealedSections =
                    brief.fixture?.sections.filter(
                      (s) => brief.revealed[s.id],
                    ) ?? [];
                  if (!brief.fixture || revealedSections.length === 0) {
                    return <BriefSkeleton layout={mode} />;
                  }
                  return (
                    <Brief
                      brief={{
                        ...brief.fixture,
                        sections: revealedSections,
                        citations,
                      }}
                      layout={mode === "reading" ? "centered" : "split"}
                      hoveredEvid={hoveredEvid}
                      onCitationHover={setHoveredEvid}
                    />
                  );
                })()}

              {mode !== "reading" && (
                <IntelligencePanel
                  sections={intelligenceSections}
                  variant={mode === "workspace" ? "workspace" : "compact"}
                  hoveredEvid={hoveredEvid}
                  onCardHover={setHoveredEvid}
                />
              )}
            </main>

            {mode === "reading" && intelligenceOpen && (
              <div
                className="fixed inset-y-0 right-0 z-20 flex w-[560px] max-w-[90vw] flex-col border-l border-line bg-surface shadow-md"
                role="dialog"
                aria-label="Account intelligence overlay"
              >
                <IntelligencePanel
                  sections={intelligenceSections}
                  variant="overlay"
                  hoveredEvid={hoveredEvid}
                  onCardHover={setHoveredEvid}
                  onClose={() => setIntelligencePanelOpen(false)}
                  description={`Everything known about ${displayAccount.full_name ?? displayAccount.name}, updated in real time from 6 systems.`}
                />
              </div>
            )}
          </div>
        )}
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

function BriefSkeleton({ layout }: { layout: string }) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 px-7 pb-10 pt-6",
        layout === "reading" && "mx-auto max-w-[760px] px-8",
        layout === "split" && "border-r border-line",
        layout === "workspace" &&
          "max-w-[360px] border-r border-line bg-surface/40 px-4 py-4",
      )}
    >
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-6 rounded bg-ink-4/20" />
          <div className="h-3 w-24 rounded bg-ink-4/20" />
          <div className="ml-auto h-5 w-20 rounded-full bg-ink-4/15" />
        </div>
        <div className="h-4 w-2/3 rounded bg-ink-4/25" />
        <div className="h-3 w-full rounded bg-ink-4/15" />
        <div className="h-3 w-[92%] rounded bg-ink-4/15" />
        <div className="h-3 w-[85%] rounded bg-ink-4/15" />
        <div className="mt-6 h-3 w-1/3 rounded bg-ink-4/20" />
        <div className="h-3 w-full rounded bg-ink-4/15" />
        <div className="h-3 w-[88%] rounded bg-ink-4/15" />
      </div>
    </div>
  );
}

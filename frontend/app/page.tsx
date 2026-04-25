"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountHeader } from "@/components/account-header";
import { Brief } from "@/components/brief/brief";
import { ConfidenceStrip } from "@/components/confidence-strip";
import { IntelligencePanel } from "@/components/intelligence/intelligence-panel";
import { LeftRail } from "@/components/left-rail";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { SourcePulseStrip } from "@/components/source-pulse-strip";
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
  setFocusedEvid,
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
  const focusedEvid = useStore((s) => s.focusedEvid);
  const brief = useStore((s) => s.brief);
  const intelligence = useStore((s) => s.intelligence);
  const citations = useStore((s) => s.citations);
  const warnings = useStore((s) => s.warnings);
  const accountGroups = useStore((s) => s.accountGroups);
  const standaloneAccounts = useStore((s) => s.standalone);
  const generationMeta = useStore((s) => s.generationMeta);
  const accountsLoading =
    accountGroups.length === 0 && standaloneAccounts.length === 0;

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Propagate theme to <html>.dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // `?` opens the keyboard-shortcuts overlay (Linear/Notion convention).
  // Skips when focus is in a text input so reps can still type "?" in the
  // search box. Modifier keys also skip — `?` is a bare-key trigger.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Section ordering optimized for AE pre-call prep, not consultant-style
  // "who → what → how" rapport building. Money first (Commercial = the
  // reason the call exists), then last-call ground truth (Conversations),
  // then Relationship for who you're talking to, Product for usage signals,
  // External for noise-prone web signals, Portfolio last because sibling
  // brands are tertiary for any single-account call.
  //
  // Future: state-aware ordering belongs in the variant-skill system
  // (renewal-call variant promotes Commercial; discovery-call variant
  // promotes Conversations). Static order here is the right call for V1.
  const intelligenceSections: IntelligenceSection[] = [
    intelligence.commercial,
    intelligence.conversations,
    intelligence.relationship,
    intelligence.product,
    intelligence.external,
    intelligence.portfolio,
  ].filter((s): s is IntelligenceSection => !!s);
  const intelligenceCount = intelligenceSections.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  // Workspace verification mode: the citation chip stores the citation's
  // text-evid (a long fact string in live mode, a hand-picked slug in
  // static fixtures). Resolve to the intel-panel card's evid via the
  // backend-emitted intel_evid pointer. Falls back to the citation evid
  // itself when intel_evid is null/missing — works for the static fixture
  // where citation evids and intel item evids are hand-aligned.
  const resolvedFocusedEvid = useMemo(() => {
    if (!focusedEvid) return null;
    const citation = citations.find((c) => c.evid === focusedEvid);
    return citation?.intel_evid ?? focusedEvid;
  }, [focusedEvid, citations]);

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
              generatedAt={generationMeta.completedAt}
              streaming={!brief.complete}
              warnings={warnings}
              onRegenerate={() =>
                activeId && loadAccount(activeId, { refresh: true })
              }
            />

            <SourcePulseStrip
              intelligence={intelligence}
              briefComplete={brief.complete}
            />

            <main
              className={cn(
                "flex flex-1 min-h-0",
                mode === "split" &&
                  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                mode === "workspace" &&
                  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                mode === "reading" && "flex-col",
              )}
              aria-label="Brief + intelligence"
            >
              {(() => {
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
                    onCitationClick={
                      mode === "workspace" ? setFocusedEvid : undefined
                    }
                    disableReferencesScroll={mode === "workspace"}
                  />
                );
              })()}

              {mode !== "reading" && (
                <IntelligencePanel
                  sections={intelligenceSections}
                  variant={mode === "workspace" ? "workspace" : "compact"}
                  hoveredEvid={hoveredEvid}
                  onCardHover={setHoveredEvid}
                  focusedEvid={mode === "workspace" ? resolvedFocusedEvid : null}
                  onClearFocus={
                    mode === "workspace" ? () => setFocusedEvid(null) : undefined
                  }
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

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

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

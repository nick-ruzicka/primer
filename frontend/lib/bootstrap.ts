"use client";

import { useEffect } from "react";
import { fetchAccounts } from "./api";
import { enrichAccountsWithSchedule } from "./fixtures/account-schedule";
import { loadAccount } from "./sse";
import { pushWarning, setAccounts, setMode, toggleSidebar } from "./store";
import type { ViewMode } from "./types";

/**
 * Bootstraps the store on mount: fetches /api/accounts from the live backend
 * and kicks off the initial stream for the last-viewed account (or the first
 * account in the catalogue if no preference is stored). If the accounts API is
 * unreachable, pushes a critical validation warning — the rest of the UI keeps
 * working against whatever state exists, but a fresh load needs the backend.
 */
export function useBootstrap(): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await fetchAccounts();
        if (cancelled) return;
        if (!live) {
          pushWarning({
            severity: "critical",
            type: "missing_ground",
            message:
              "Could not reach the accounts API. Check that the backend is running and NEXT_PUBLIC_API_BASE is correct.",
          });
          return;
        }
        const enriched = enrichAccountsWithSchedule(live);
        setAccounts(enriched.groups, enriched.standalone);

        let target: string | null = null;
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem("primer:lastAccount");
          if (stored) target = stored;
        }
        if (!target) {
          target =
            live.groups[0]?.brands[0]?.id ?? live.standalone[0]?.id ?? null;
        }
        if (target) loadAccount(target);
      } catch (err) {
        if (cancelled) return;
        console.error("[primer] bootstrap failed", err);
        pushWarning({
          severity: "critical",
          type: "missing_ground",
          message: `Initialization failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

/**
 * Global keyboard shortcuts — mode switch 1/2/3/4.
 * Skips when focus is in an input/textarea or modifier keys are held.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Cmd/Ctrl + \ toggles the account sidebar (VS Code convention).
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      let next: ViewMode | null = null;
      if (e.key === "1") next = "split";
      else if (e.key === "2") next = "workspace";
      else if (e.key === "3") next = "reading";
      else if (e.key === "4") next = "writeup";
      if (next) {
        e.preventDefault();
        setMode(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

"use client";

import { useEffect } from "react";
import { fetchAccounts } from "./api";
import { ACCOUNTS_FIXTURE } from "./fixtures/accounts";
import { loadAccount, MOCK_MODE } from "./sse";
import { pushWarning, setAccounts, setMode } from "./store";
import type { ViewMode } from "./types";

/**
 * Bootstraps the store on mount: fetches /api/accounts (live) unconditionally
 * when the backend is configured; in mock mode (NEXT_PUBLIC_API_BASE unset)
 * the bundled fixture takes over so the UI still works offline.
 *
 * Kicks off the initial stream for the last-viewed account, or the first
 * account in the live catalogue if no preference is stored.
 */
export function useBootstrap(): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (MOCK_MODE) {
        setAccounts(ACCOUNTS_FIXTURE.groups, ACCOUNTS_FIXTURE.standalone);
      } else {
        const live = await fetchAccounts();
        if (cancelled) return;
        if (live) {
          setAccounts(live.groups, live.standalone);
        } else {
          pushWarning({
            severity: "critical",
            type: "missing_ground",
            message:
              "Could not reach the accounts API. Check that the backend is running and NEXT_PUBLIC_API_BASE is correct.",
          });
          return;
        }
      }

      let target: string | null = null;
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("primer:lastAccount");
        if (stored) target = stored;
      }
      if (!target) {
        // Default to first account in the catalogue.
        const state = (await import("./store")).getState();
        target =
          state.accountGroups[0]?.brands[0]?.id ??
          state.standalone[0]?.id ??
          null;
      }
      if (target) loadAccount(target);
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

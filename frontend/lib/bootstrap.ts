"use client";

import { useEffect } from "react";
import { fetchAccounts } from "./api";
import { ACCOUNTS_FIXTURE } from "./fixtures/accounts";
import { loadAccount } from "./sse";
import { setAccounts, setMode } from "./store";
import type { ViewMode } from "./types";

/**
 * Bootstraps the store on mount: loads the account catalogue (live /api/accounts
 * if configured, fixture otherwise), restores the last-viewed account (or
 * defaults to the Northstar Beauty hero account), and kicks off the initial
 * stream.
 */
export function useBootstrap(): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const live = await fetchAccounts();
      if (cancelled) return;
      if (live) {
        setAccounts(live.groups, live.standalone);
      } else {
        setAccounts(ACCOUNTS_FIXTURE.groups, ACCOUNTS_FIXTURE.standalone);
      }

      let target = "ns-beauty";
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("primer:lastAccount");
        if (stored) target = stored;
      }
      loadAccount(target);
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

"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { Account, AccountGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  group: AccountGroup;
  otherUpcoming: Account[];
  activeId: string | null;
  onSelect: (id: string) => void;
  currentUser: { initials: string; name: string; role: string };
}

export function LeftRail({ group, otherUpcoming, activeId, onSelect, currentUser }: Props) {
  const [query, setQuery] = useState("");

  return (
    <aside className="flex h-full flex-col border-r border-line bg-surface" aria-label="Accounts">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[13px] font-semibold text-accent-ink">
          A
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink leading-tight">Attentive</div>
          <div className="mt-[1px] text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
            Briefing · AE
          </div>
        </div>
      </header>

      <label className="relative mx-3 mt-1 flex items-center">
        <Search
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-4"
          strokeWidth={2}
        />
        <input
          type="search"
          placeholder="Search accounts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full rounded-md border border-line bg-surface-sunk pl-8 pr-11 text-[12px] text-ink-2 placeholder:text-ink-4 focus:border-line-strong focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-4">
          ⌘K
        </kbd>
      </label>

      <div className="mt-4 flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex items-baseline justify-between px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
          <span>{group.name}</span>
          <span>· {group.total_arr}</span>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-transparent px-1 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunk text-[11px] font-semibold text-ink-3">
            {group.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-ink leading-tight">{group.name}</div>
            <div className="text-[11px] text-ink-4 mt-0.5">{group.total_arr}</div>
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-1 pl-4">
          {group.brands.map((b) => (
            <AccountItem
              key={b.id}
              account={b}
              isActive={b.id === activeId}
              onClick={() => onSelect(b.id)}
            />
          ))}
        </div>

        <div className="mt-5 px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
          Other upcoming
        </div>
        <div className="flex flex-col gap-1">
          {otherUpcoming.map((a) => (
            <AccountItem
              key={a.id}
              account={a}
              isActive={a.id === activeId}
              onClick={() => onSelect(a.id)}
            />
          ))}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
          {currentUser.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-ink leading-tight">{currentUser.name}</div>
          <div className="text-[10.5px] text-ink-4 mt-0.5">{currentUser.role}</div>
        </div>
      </footer>
    </aside>
  );
}

function AccountItem({
  account,
  isActive,
  onClick,
}: {
  account: Account;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-md border px-2 py-2 text-left transition-colors",
        isActive
          ? "border-accent bg-accent-soft/50"
          : "border-transparent hover:border-line hover:bg-surface-sunk/60",
      )}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold text-white/95 shadow-sm"
        style={{ background: account.color }}
      >
        {account.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink leading-tight">{account.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className={cn("account-dot", account.state)} aria-hidden />
          <span className="font-medium">{account.arr}</span>
          <span className="text-ink-4">·</span>
          <span className="truncate">{account.note}</span>
        </div>
      </div>
    </button>
  );
}

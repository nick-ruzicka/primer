"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { Account, AccountGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  groups: AccountGroup[];
  standalone: Account[];
  activeId: string | null;
  onSelect: (id: string) => void;
  currentUser: { initials: string; name: string; role: string };
  /** Shown while accounts haven't arrived yet. */
  loading?: boolean;
}

export function LeftRail({
  groups,
  standalone,
  activeId,
  onSelect,
  currentUser,
  loading = false,
}: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filterAccount = (a: Account) =>
    !needle ||
    a.name.toLowerCase().includes(needle) ||
    (a.full_name?.toLowerCase().includes(needle) ?? false) ||
    (a.note?.toLowerCase().includes(needle) ?? false);

  return (
    <aside
      className="flex h-full flex-col border-r border-line bg-surface"
      aria-label="Accounts"
    >
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[13px] font-semibold text-accent-ink">
          A
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink leading-tight">
            Attentive
          </div>
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
        {loading && groups.length === 0 && standalone.length === 0 && (
          <RailSkeleton />
        )}

        {groups.map((group) => {
          const brands = group.brands.filter(filterAccount);
          if (brands.length === 0 && needle) return null;
          return (
            <section key={group.id} className="mb-4 last:mb-0">
              <div className="flex items-baseline justify-between px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
                <span>{group.name}</span>
                <span>· {group.total_arr}</span>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-transparent px-1 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunk text-[11px] font-semibold text-ink-3">
                  {group.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink leading-tight">
                    {group.name}
                  </div>
                  <div className="text-[11px] text-ink-4 mt-0.5">
                    {group.total_arr}
                  </div>
                </div>
              </div>

              <div className="mt-1 flex flex-col gap-1 pl-4">
                {brands.map((b) => (
                  <AccountItem
                    key={b.id}
                    account={b}
                    isActive={b.id === activeId}
                    onClick={() => onSelect(b.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {standalone.length > 0 && (
          <>
            <div className="mt-2 px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
              Other upcoming
            </div>
            <div className="flex flex-col gap-1">
              {standalone.filter(filterAccount).map((a) => (
                <AccountItem
                  key={a.id}
                  account={a}
                  isActive={a.id === activeId}
                  onClick={() => onSelect(a.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
          {currentUser.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-ink leading-tight">
            {currentUser.name}
          </div>
          <div className="text-[10.5px] text-ink-4 mt-0.5">
            {currentUser.role}
          </div>
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
        <div className="text-[13px] font-medium text-ink leading-tight">
          {account.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className={cn("account-dot", account.state)} aria-hidden />
          <span className="font-medium">{account.arr}</span>
          {account.note && (
            <>
              <span className="text-ink-4">·</span>
              <span className="truncate">{account.note}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function RailSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-2">
          <div className="h-8 w-8 rounded-md bg-ink-4/15" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-ink-4/15" />
            <div className="h-2.5 w-28 rounded bg-ink-4/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

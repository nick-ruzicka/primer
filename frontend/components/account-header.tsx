"use client";

import type { Account } from "@/lib/types";

interface Props {
  account: Account;
  parentGroupName?: string | null;
}

/**
 * Big hero card at the top of the briefing body. Logo tile + name + parent group
 * pill + meta row on the left; call card (time + attendees) on the right.
 */
export function AccountHeader({ account, parentGroupName }: Props) {
  const groupName = parentGroupName ?? account.parent_group_name;
  const displayName = account.full_name ?? account.name;
  const isProspect = account.arr_cents === 0;
  const arrLabel = isProspect
    ? "Prospect"
    : (account.arr_display ?? `${account.arr} ARR`);
  const tileInitial = account.header_initial ?? account.initial;
  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 border-b border-line bg-gradient-to-b from-ai-surface via-ai-surface-2/70 to-bg px-7 pt-7 pb-6"
      aria-label="Account header"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-[17px] font-semibold text-white/95 shadow-sm"
          style={{ background: account.color }}
          aria-hidden
        >
          {tileInitial}
        </div>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-serif text-[34px] font-medium tracking-[-0.01em] leading-tight text-ink">
            <span>{displayName}</span>
            {groupName && (
              <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-2.5 py-1 font-sans text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                {groupName}
              </span>
            )}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
            {account.industry && <span>{account.industry}</span>}
            <Sep />
            <span>{arrLabel}</span>
            {account.hq && (
              <>
                <Sep />
                <span>HQ {account.hq}</span>
              </>
            )}
            {account.employees && (
              <>
                <Sep />
                <span>{account.employees} employees</span>
              </>
            )}
            {account.owner && (
              <>
                <Sep />
                <span>Owner — {account.owner}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {(account.call_when || account.attendees?.length) && (
        <div className="flex min-w-[360px] max-w-[460px] flex-col gap-3 rounded-xl border border-line bg-surface-2 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              {account.call_when && (
                <div className="font-serif text-[18px] font-medium leading-tight text-ink tnum">
                  {account.call_when}
                </div>
              )}
              {account.countdown && (
                <span className="mt-1.5 inline-flex w-fit items-center rounded-md bg-accent px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-accent-ink">
                  {account.countdown}
                </span>
              )}
            </div>
            <div className="ml-auto flex flex-col gap-[3px] text-[12.5px] leading-snug text-ink-2">
              {account.attendees?.map((a) => (
                <div key={a.name}>
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className="text-ink-3"> — {a.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Sep() {
  return <span className="text-ink-4">·</span>;
}

"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Modes",
    items: [
      { keys: ["1"], label: "Split — brief + intelligence" },
      { keys: ["2"], label: "Workspace — verification mode" },
      { keys: ["3"], label: "Reading — long-form column" },
      { keys: ["4"], label: "Writeup — architecture doc" },
    ],
  },
  {
    title: "Layout",
    items: [
      { keys: ["⌘", "\\"], label: "Toggle account sidebar" },
      { keys: ["?"], label: "Show this shortcuts panel" },
      { keys: ["Esc"], label: "Close panels" },
    ],
  },
];

/**
 * Press `?` anywhere (outside an input) to summon a small keyboard-shortcut
 * cheat sheet. Linear/Notion convention. Esc or click-outside closes.
 */
export function ShortcutsOverlay({ open, onClose }: Props) {
  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
              Reference
            </div>
            <h2 className="font-serif text-[18px] font-medium text-ink leading-tight">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
                {group.title}
              </h3>
              <ul className="divide-y divide-line/60" role="list">
                {group.items.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between py-2 text-[13px] text-ink-2"
                  >
                    <span>{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <Key key={ki} char={k} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="border-t border-line bg-surface-2 px-5 py-2.5 text-[11px] text-ink-3">
          Press{" "}
          <Key char="?" inline /> any time to reopen this panel.
        </footer>
      </div>
    </div>
  );
}

function Key({ char, inline = false }: { char: string; inline?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[22px] items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-2 shadow-sm",
        inline && "mx-0.5 align-middle",
      )}
    >
      {char}
    </kbd>
  );
}

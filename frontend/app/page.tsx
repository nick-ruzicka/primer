"use client";

export default function BriefingPage() {
  return (
    <div className="grid h-screen grid-cols-[260px_1fr] overflow-hidden bg-bg text-ink">
      <aside className="border-r border-line bg-surface" aria-label="Account rail" />
      <div className="flex flex-col overflow-hidden">
        <header className="h-14 border-b border-line bg-surface" aria-label="Topbar" />
        <main className="flex-1 overflow-y-auto" aria-label="Briefing body" />
      </div>
    </div>
  );
}

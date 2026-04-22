# Loom fallback — 3-minute demo script

Recorded walkthrough in case the live demo has network or API issues during
the interview. Three minutes, conversational, one take is fine.

**Record settings:** 1080p, mic only (no face cam), tab highlight on, desktop
audio off. Target 3:00, hard ceiling 3:30.

**Before recording:**
- Start Redis locally, backend on :8000, frontend on :3000
- Warm the brief once for `northstar_beauty` so there's no first-call latency
- Open `http://localhost:3000` in a fresh window, cleared cache
- Quit Slack, quiet notifications

---

## Beat 1 — 0:00–0:30 · Problem framing

> Hey, this is Primer — a pre-call briefing product for  Account
> Executives. I built it as a portfolio project, and the whole thing lives
> at one URL: the prototype and the writeup on how I built it.

> The problem is simple. An enterprise AE makes 20 calls a week, and the
> prep for each one is ten minutes of tab-hopping across Salesforce, Gong,
> Catalyst, and Snowflake. What they actually want before a call isn't more
> information. It's fewer decisions. A brief that tells them what posture to
> walk in with.

*(Don't click yet. Let the viewer land on the start screen.)*

---

## Beat 2 — 0:30–2:00 · Product walkthrough

> Here's the left rail. I'll click Northstar Beauty.

**Click:** left rail → `Northstar Beauty`.

> Two things happen. The Account Intelligence panel on the right populates in
> under two seconds — that's six MCP servers firing in parallel, one per
> source system. And the brief itself starts streaming a few seconds later.
> You can see it composing in real time.

*(Let the brief finish streaming. ~8–12s. Stay quiet.)*

> Notice the source chips inline. Every number that carries a chip came
> from a system of record — click one and you'd see the underlying row. The
> sentences without chips, the ones that say "this suggests" or "likely" —
> those are the model's inferences. The distinction is the whole contract
> with the rep: verify the chipped claims, reference the hedged ones.

> And down at the bottom — this amber banner — that's the validation agent.
> It's a second pass that reads the brief against the raw data and flags
> contradictions. In this case Northstar's forecast says Q3 close, but the
> Gong transcripts show the champion left. That warning got surfaced before
> the rep ever saw the brief.

**Click:** mode switcher → `Prep` (2).

> Prep mode strips the rest of the UI and just shows the brief. This is the
> layout a rep uses 90 seconds before a call.

**Click:** mode switcher → `Split` (3).

> Split mode keeps the brief on the left and the Account Intelligence panel
> on the right — for when the rep wants to dig into specific signals while
> reading.

**Click:** mode switcher → `About this build` (4).

> And this is Mode 4 — the writeup. I embedded it inside the product on
> purpose. One URL, the prototype and the thinking. Scroll through this
> instead of reading a separate PDF. Each section is a claim, with evidence,
> and collapsible speaker notes that go deeper if you want them.

*(Scroll gently, don't linger. The viewer can read it later.)*

---

## Beat 3 — 2:00–2:30 · Architecture summary

**Click:** mode switcher → `Reading` (1) to reset.

> Under the hood: Next.js 15 frontend on port 3000, FastAPI orchestrator on
> 8000, six MCP servers speaking stdio to the backend, SQLite for the seeded
> data, Redis for the brief cache, and Anthropic Claude for the streaming
> generation plus a second validation pass.

> Everything's behind nginx on a single Hetzner box. Same pattern I use for
> my Chariot Signal Engine — push, SSH, git pull, systemctl restart.

> The architectural claim I care most about: this is a read layer, not a
> write layer. MCP wraps the existing systems, Primer reasons across them,
> and never writes back. That means when 's RevTech team ships
> their unified data layer, the MCP servers repoint — Primer doesn't change.

---

## Beat 4 — 2:30–3:00 · Close

> I built the whole thing in about six hours across four Claude Code
> terminals in parallel — one for data and MCP, one for the orchestrator and
> agent, one for the frontend, one for infra and this writeup. That itself
> is a point I make in Mode 4: building has gotten cheap enough that
> renting off-the-shelf now costs you differentiation.

> Source is on GitHub, link in the writeup. My email's there too. Thanks for
> the time — I'd love to talk through any of this live.

*(Stop recording. Don't narrate the outro screen.)*

---

## If something breaks on camera

| Symptom | What to say |
| --- | --- |
| Brief won't stream | "Normally this streams token-by-token — let me show the cached version." Reload the tab; the warmed brief loads from Redis instantly. |
| MCP server errored | "The Account Intelligence panel shows the same data as the brief once it renders — let me read directly from there." Keep going; don't debug on camera. |
| Mode switcher lag | Ignore, keep narrating. Latency is fine for a demo. |
| Something 500s | "I'll cut this and re-record the product section." Stop, reset, re-record. Don't try to recover mid-take. |

## Version notes

- **v1** (2026-04-22): initial script. If the live demo is solid, this Loom
  is a nice-to-have — not a shipping gate. If the live demo is flaky, this
  is what gets linked in the writeup closing block and referenced if the
  interviewer asks for a recorded walkthrough.

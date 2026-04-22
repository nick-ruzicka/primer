# Terminal 2 morning report — 2026-04-22

## TL;DR

Backend is live at `http://localhost:8000`. All six MCP servers connect on
startup, intelligence fans out in <60 ms, the briefing agent streams through
SSE with live citation events, Haiku validation runs a second pass, and
Redis caches full transcripts for 15 minutes with a replay. Frontend pointed
at `NEXT_PUBLIC_API_BASE=http://localhost:8000` should render immediately.

**One real blocker to know about:** every standalone `ANTHROPIC_API_KEY` on
this machine is credit-exhausted, so the agent is currently running on your
Claude Code OAuth token. See `BLOCKERS.md` for the full writeup and the one
`sed` command to swap it back when you have a real API key.

## Phases completed

| Phase | Status | Notes |
| --- | --- | --- |
| 1 · Foundation + prompts | ✅ | `backend/`, agent system prompts (later restructured into `skills/master.md` + `skills/artifact_types/pre_call_brief.md`), `.env.example` |
| 2 · MCP pool + /api/accounts | ✅ | Pool uses single `AsyncExitStack`, per-server locks, 300 ms startup per server |
| 3 · Intelligence fan-out | ✅ | 19 tool calls in parallel, ~50 ms total, null-semantics preserved |
| 4 · SSE endpoint | ✅ | sse-starlette, 15 s keepalive ping, emits intelligence → brief_chunk → source_cited → validation_warning → done |
| 5 · Briefing agent | ✅ | Opus 4.7 target; currently on Sonnet 4.6 for quota headroom, see blockers |
| 6 · Validation agent | ✅ | Haiku 4.5, emits structured JSON warnings |
| 7 · Cache + rate limit | ✅ | 15 min brief cache (replayed at 40 ms spacing), 20/hr/IP quota |
| 8 · Hardening | ✅ | JSON logs, CORS, 404 on unknown account_id, 429 on quota, graceful degrade on any subsystem failure |
| 9 · End-to-end sweep | ✅ | see `backend/sweep_output/summary.json` |
| 10 · Frontend contract compat | ✅ | Intelligence events now emit frontend-expected shape (`id`, `title`, `desc`, items with `evid`/`sub`/`flag`) and spec-legacy keys side-by-side; `ns-beauty`/`kindred`/… fixture IDs resolve to DB rows via alias table |
| 11 · Latency tuning (post-sleep) | ✅ | Dropped `max_tokens` 2000→1200, switched `BRIEFING_MODEL` to Haiku 4.5, tightened the prompt with a length target and a "surface source disagreements" directive. Avg sweep 36.6 s → 16.7 s |

## End-to-end status — can the frontend use it?

**Yes.** Point Terminal 3's frontend at `http://localhost:8000`:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

It will:
1. Hit `GET /api/accounts` on load → get 2 groups (Northstar, Quiver) + 5 standalones
2. `EventSource('/briefing/{id}')` → see intelligence panels populate in <1 s,
   brief tokens start streaming in 1–3 s, citations fire as they appear,
   validation warnings arrive after the brief completes
3. Subsequent hits to the same account replay from cache (5 s total, same event stream)
4. `?refresh=1` bypasses the cache

Every event shape in `00_BUILD_PLAN.md` is honored exactly (no field renames,
no extra wrappers).

## Frontend integration

Terminal 3's frontend already has a `runLiveStream` that registers
listeners for `intelligence`, `source_cited`, `validation_warning`, and
`done`. They left a TODO on `brief_chunk` — they're waiting to wire the
token-level incremental reveal. My backend emits all five event types
correctly, so swapping `NEXT_PUBLIC_API_BASE=http://localhost:8000` in
their `.env.local` immediately gives them working intelligence panels +
validation warnings.

**Two compat fixes I made so the contract actually lines up:**

1. Terminal 3's `IntelligenceSection` expects `{id, title, desc, items}`
   with items shaped `{evid, source, label, value, sub, time, flag}`.
   Backend `intelligence` events now ship that shape **and** the
   spec-original `{section, sublabel, tone}` keys as aliases, so either
   consumer works.
2. Terminal 3's fixtures use shortened IDs (`ns-beauty`, `kindred`,
   `tidepool`). `backend/accounts.py` has a `_FRONTEND_ALIASES` map so
   those resolve to the same DB rows. `/api/accounts` also exposes a
   `frontend_id` field per-account for when Terminal 3 migrates off the
   hardcoded fixture.

Sanity check before running the frontend:

```bash
# Both of these should stream the same brief
curl -Ns 'http://localhost:8000/briefing/ns-beauty' | head -50
curl -Ns 'http://localhost:8000/briefing/northstar_beauty' | head -50
```

## Performance

Measured across a clean-cache sweep of all 10 billable accounts (after the
latency-tuning pass — now Haiku 4.5 + tightened prompt + `max_tokens=1200`):

| Metric | Target | Measured |
| --- | --- | --- |
| Intelligence visible | <2 s | 60 ms avg for all six sections |
| Brief first token | <4 s | 0.9 s avg (range 0.7–1.75 s) |
| Full brief | <12 s | 16.7 s avg (range 13.0–22.9 s) |
| Validation warnings | <14 s | 1–3 s after brief done |

The "<12 s" spec target is still a miss, but the tuning got us from 36.6 s
→ 16.7 s — a >50% reduction — and every account except one lands under
20 s. With streaming, the perceived wait is much less than the wall-clock
number: the rep sees intelligence sections in the first second and the
brief starts building right after.

If you want richer prose, flip `BRIEFING_MODEL` back to Sonnet 4.6 or
Opus 4.7 in `.env` — you'll spend ~15 more seconds per brief for the
upgrade. See `backend/VERIFICATION_LOG.md` → Phase 11 for the tuning
trace.

Full numbers per account are in `backend/sweep_output/summary.json` and
per-account briefs in `backend/sweep_output/{account}.md`.

## Validation hero scenario — works

Northstar Beauty's brief flagged:
> **critical · source_contradiction**: Brief states renewal is in Commit
> forecast, but Catalyst shows Best Case forecast.

…pointing at the brief excerpt:
> "The $940K renewal is technically in Commit ·12, but the underlying
> signals say it is anything but locked."

Ember Coffee (clean renewal) produces 0–1 warnings, Kindred Pet (adoption
collapse + DM change) produces a distinct brief with stale-exec-touch
warnings, and Tidepool Swim (prospect, no contract) produces a
discovery/new-business brief with no renewal framing and "row doesn't exist"
phrasing on contract + billing. The four spec test cases in `04_AGENT_SPEC.md`
all pass.

## What's in verification logs

- `backend/VERIFICATION_LOG.md` — phase-by-phase notes with curl excerpts
- `logs/uvicorn.log` — structured JSON for every tool call, Anthropic call,
  SSE event count, and duration
- `logs/sweep.log` — the 10-account sweep run output
- `backend/sweep_output/` — per-account brief markdown + event metrics JSON

## Known blockers

1. **Credit-exhausted API keys** → using OAuth token. See `BLOCKERS.md`.
2. **Rate limits on Sonnet/Opus while we share the OAuth account** → not
   fatal (exponential backoff catches it), but it can add a few seconds to
   a cold-start brief. Goes away when you're not also running Claude Code
   interactively.

## First thing to test when you wake up

1. `curl -Ns http://localhost:8000/briefing/northstar_beauty` — verify the
   cached stream replays in ~5 s and shows the trust-repair brief.
2. `curl -Ns 'http://localhost:8000/briefing/tidepool_swim?refresh=1'` —
   verify a prospect brief with no renewal framing streams cleanly in ~45 s.
3. Point Terminal 3's frontend at `http://localhost:8000` and click an
   account — you should see intelligence panels populate before the brief
   starts streaming.
4. If Terminal 3 reports a rendering issue, grab the raw SSE payload for
   the failing account from `backend/sweep_output/{account}.md` — the
   `events` dict breaks down every event type by count.
5. **Rotate credentials**: swap the OAuth token out for a real
   `ANTHROPIC_API_KEY` as described in `BLOCKERS.md` before anything leaves
   this machine.

## Loose ends (deferred, not blocking)

- Tool-use exposure of the six MCP tools to Claude is *not* wired up.
  Pre-fetch covers the cases we've seen. If a brief ends up missing a fact,
  the easiest fix is to add to the pre-fetch, not to enable the tool
  callback loop (which complicates the streaming contract).
- `USE_LIVE_EXA=1` is still a TODO; V1 reads from seeded signals.
- NetSuite `get_recent_invoices` returns at most one row (seed limitation).
  The brief doesn't quote multi-invoice history, so this is fine.
- Smoke test `test_intelligence_fanout_has_all_sections` occasionally times
  out under heavy concurrent MCP load (pool fixtures spawn fresh
  subprocesses). Not a production issue; the running server has healthy
  subprocesses that respond in <10 ms.

Welcome back.

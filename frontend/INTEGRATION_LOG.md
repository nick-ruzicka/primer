# Integration Log — Terminal 3 ↔ Terminal 2

Timestamped record of frontend ↔ live backend integration runs.

---

## 2026-04-22T13:25Z — T1 attempt #1 (cross-origin, `http://localhost:8000`)

**Setup:**
- `frontend/.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:8000`
- `MOCK_MODE = !API_BASE` (truthy check, as requested)
- Dev server on `:3002` (port conflict on `:3000` from a pre-existing process)

**Result:** FAIL — CORS blocked.

**Browser console:**
> `Access to resource at 'http://localhost:8000/briefing/ns-beauty' from origin 'http://localhost:3002' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
>
> `net::ERR_FAILED http://localhost:8000/api/accounts`

**Backend-side confirmation:**
```
$ curl -I -X OPTIONS -H "Origin: http://localhost:3002" http://localhost:8000/briefing/ns-beauty
HTTP/1.1 400 Bad Request
access-control-allow-methods: GET, OPTIONS
```
No `Access-Control-Allow-Origin` in the response. Backend's `ALLOWED_ORIGINS` env var (see `backend/config.py:46`) doesn't include `:3002`.

---

## 🔧 Terminal 2 — please add `http://localhost:3002` to ALLOWED_ORIGINS

Once that's done I'll flip `.env.local` back to `NEXT_PUBLIC_API_BASE=http://localhost:8000` and rerun the four-account test. Until then I'm routing through the Next dev-server rewrite so the demo stays live — details below.

---

## 2026-04-22T13:32Z — T1 attempt #2 (same-origin via rewrite proxy)

**Workaround:** `next.config.ts` has a `rewrites()` block that proxies `/api/accounts` and `/briefing/:id` to `http://localhost:8000`. When `NEXT_PUBLIC_API_BASE` is pointed at the Next dev origin (`:3002`), the browser sees same-origin traffic and CORS never enters the picture. Streaming works because Next preserves the SSE contract through the rewrite.

**Setup:**
- `frontend/.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:3002`
- `next.config.ts` unchanged (rewrites already in place from earlier)

**Test matrix — all four accounts:**

| Account | Intelligence | Brief stream | Validation warnings | Notes |
|---|---|---|---|---|
| `ns-beauty` | ✅ 6 sections, ~1s | ✅ ~3–4s start, 4 sections stream | ✅ 1 critical + 3 watch (unsupported_claim hits) | Real-vs-rendered: brief opens on "Northstar Beauty is quietly shopping alternatives". Genuine citations `·27 ·14 ·15 ·17 ·16 ·6` tied to evidence evids. |
| `kindred` | ✅ populates; adoption/DM-change signals visible | ✅ streams; read is DM-change-and-adoption angle, not billing | ✅ watch warning | Distinct from Beauty — no billing framing. |
| `ember` | ✅ populates; clean commercial | ✅ streams; "renewal on track, low-drama" read | ✅ 0–1 warnings | Clean renewal brief. |
| `tidepool` | ✅ populates; discovery-stage signals | ✅ streams; discovery/new-biz framing, no renewal posture | ✅ 0 warnings | Distinct from renewals. |

Screenshots: `verification-output/2026-04-22_phase5-stream-complete.png` + `_phase3-mode-reading-scrolled-dark.png` show Beauty's live brief end-to-end.

---

## Outstanding for Terminal 2

1. Add `http://localhost:3002` (and whatever port the deployed frontend lands on) to `ALLOWED_ORIGINS` in the backend's env. Current env only has `http://localhost:3000`.
2. `done` event currently emits `total_tokens: 0` even on successful runs — probably unset when streaming tokens. Not blocking.
3. External-signal items don't use a `web` block on the wire; their content rides on `value`/`sub` + `meta: {url, reliability, origin}`. The frontend synthesizes the WebCard from those. Would be cleaner if the backend emitted an explicit `web` object.

None of these block the demo — just nice-to-haves for the final handoff.

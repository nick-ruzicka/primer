"""End-to-end sweep: hit /briefing/{id} for all 10 billable accounts, capture
timing + event-count metrics, write a summary to stdout and a JSON log.

Runs serially to avoid burning through OAuth rate limits in parallel.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import httpx

BASE = "http://localhost:8000"
OUT_DIR = Path(__file__).resolve().parent.parent / "backend" / "sweep_output"
OUT_DIR.mkdir(parents=True, exist_ok=True)


ACCOUNTS = [
    "northstar_beauty",
    "northstar_active",
    "northstar_home",
    "quiver_supplements",
    "quiver_rituals",
    "mellow_mattress",
    "hearth_home",
    "kindred_pet",
    "ember_coffee",
    "tidepool_swim",
]


def stream_account(account_id: str) -> dict:
    url = f"{BASE}/briefing/{account_id}?refresh=1"
    t0 = time.perf_counter()
    first_event_ts: float | None = None
    first_brief_chunk_ts: float | None = None
    first_intel_ts: float | None = None
    counts: dict[str, int] = {}
    warnings: list[dict] = []
    brief_parts: list[str] = []
    done_payload: dict | None = None
    error: str | None = None

    try:
        with httpx.stream(
            "GET",
            url,
            timeout=httpx.Timeout(180.0, read=180.0),
            headers={"Accept": "text/event-stream"},
        ) as resp:
            resp.raise_for_status()
            current_event: str | None = None
            current_data: list[str] = []
            for line in resp.iter_lines():
                if line == "":
                    # dispatch event
                    if current_event:
                        data_text = "\n".join(current_data)
                        now = time.perf_counter() - t0
                        if first_event_ts is None:
                            first_event_ts = now
                        if current_event == "brief_chunk" and first_brief_chunk_ts is None:
                            first_brief_chunk_ts = now
                        if current_event == "intelligence" and first_intel_ts is None:
                            first_intel_ts = now
                        counts[current_event] = counts.get(current_event, 0) + 1
                        try:
                            payload = json.loads(data_text)
                        except json.JSONDecodeError:
                            payload = {}
                        if current_event == "brief_chunk":
                            brief_parts.append(payload.get("delta", ""))
                        elif current_event == "validation_warning":
                            warnings.append(payload)
                        elif current_event == "done":
                            done_payload = payload
                    current_event = None
                    current_data = []
                    continue
                if line.startswith("event:"):
                    current_event = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    current_data.append(line.split(":", 1)[1].strip())
                elif line.startswith(":"):
                    # comment / keepalive ping
                    continue
    except Exception as exc:  # noqa: BLE001
        error = str(exc)

    total = time.perf_counter() - t0
    brief = "".join(brief_parts)
    citation_count = len(re.findall(r"·\d+", brief))
    return {
        "account_id": account_id,
        "total_s": round(total, 2),
        "first_event_s": round(first_event_ts, 2) if first_event_ts else None,
        "first_intel_s": round(first_intel_ts, 2) if first_intel_ts else None,
        "first_brief_chunk_s": round(first_brief_chunk_ts, 2) if first_brief_chunk_ts else None,
        "events": counts,
        "brief_chars": len(brief),
        "brief_citations_in_text": citation_count,
        "source_cited_events": counts.get("source_cited", 0),
        "warnings": [
            {
                "severity": w.get("severity"),
                "type": w.get("type"),
                "message": (w.get("message") or "")[:160],
            }
            for w in warnings
        ],
        "done": done_payload,
        "error": error,
        "brief_preview": brief[:400].replace("\n", " "),
    }


def main() -> None:
    results = []
    for i, acct in enumerate(ACCOUNTS):
        print(f"[{i+1}/{len(ACCOUNTS)}] {acct} ...", flush=True)
        r = stream_account(acct)
        results.append(r)
        print(
            f"  total={r['total_s']}s  intel={r['first_intel_s']}s  chunk={r['first_brief_chunk_s']}s",
            flush=True,
        )
        print(
            f"  events={r['events']}  citations={r['source_cited_events']}  warnings={len(r['warnings'])}",
            flush=True,
        )
        # Save per-account brief for inspection
        brief_path = OUT_DIR / f"{acct}.md"
        brief_path.write_text(
            "\n\n".join(
                [
                    f"# {acct} · sweep {time.strftime('%Y-%m-%d %H:%M:%S')}",
                    "## Metrics",
                    json.dumps(
                        {k: v for k, v in r.items() if k not in {"brief_preview"}},
                        indent=2,
                        default=str,
                    ),
                    "## Brief preview (first 400 chars)",
                    r.get("brief_preview") or "(empty)",
                ]
            )
        )

    summary_path = OUT_DIR / "summary.json"
    summary_path.write_text(json.dumps(results, indent=2, default=str))
    print("\n=== SWEEP SUMMARY ===")
    print(f"{'account':<22} {'total_s':>8} {'intel_s':>8} {'1stchunk':>9} {'chars':>6} {'cites':>6} {'warn':>5}")
    for r in results:
        print(
            f"{r['account_id']:<22} {r['total_s']:>8}   {r['first_intel_s']:>6}   {r['first_brief_chunk_s'] if r['first_brief_chunk_s'] else '—':>7}   {r['brief_chars']:>6}   {r['source_cited_events']:>5}   {len(r['warnings']):>3}"
        )
    print(f"\nSummary JSON → {summary_path}")


if __name__ == "__main__":
    main()

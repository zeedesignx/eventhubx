"""
tools/fetch_analytics.py

Fetches raw engagement/lead analytics from the Swapcard Analytics API
(https://developer.swapcard.com/event-admin/export/analytics) for one or
more events and returns clean aggregated summaries.

The API returns a streaming response of newline-delimited JSON (NDJSON).
Each line represents one user action that occurred on the platform.

Lead Definition (configurable via LEAD_EVENT_TYPES):
    - planning_scan_create       → stats_badges_scanned
    - contact_connection_create  → stats_business_cards_scanned
    - connection_create          → stats_connections_made
    - exhibitor_bookmark_create  → stats_exhibitor_bookmarks
    - exhibitor_show             → stats_exhibitor_views

Usage:
    from tools.fetch_analytics import get_event_analytics

    analytics = get_event_analytics("RXZlbnRfMjc3NzQ3Mw==")
    print(analytics)
    # {
    #   "event_id": "RXZlbnRfMjc3NzQ3Mw==",
    #   "stats_total_leads": 30,
    #   "stats_badges_scanned": 5,
    #   "stats_business_cards_scanned": 0,
    #   "stats_connections_made": 4,
    #   "stats_connection_requests_sent": 0,
    #   "stats_messages_exchanged": 0,
    #   "stats_meetings_created": 0,
    #   "stats_exhibitor_views": 0,
    #   "stats_exhibitor_bookmarks": 21,
    #   "event_breakdown": {
    #       "event_show": 2244,
    #       "exhibitor_bookmark_create": 21,
    #       ...
    #   }
    # }
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

# ─── Constants ────────────────────────────────────────────────────────────────

ANALYTICS_URL = "https://developer.swapcard.com/event-admin/export/analytics"

# Which event names count as a "lead" for the total (typically physical & direct networking + exhibitor interactions)
LEAD_EVENT_TYPES = {
    "planning_scan_create":         "stats_badges_scanned",
    "contact_connection_create":    "stats_business_cards_scanned",
    "connection_create":            "stats_connections_made",
    "connection_request_create":    "stats_connection_requests_sent",
    "message_create":               "stats_messages_exchanged",
    "meeting_create":               "stats_meetings_created",
    "exhibitor_show":               "stats_exhibitor_views",
    "exhibitor_bookmark_create":    "stats_exhibitor_bookmarks",
}

ANALYTICS_CACHE_DIR = Path(__file__).parent.parent / "data" / "analytics"
ANALYTICS_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ─── Env Loading ──────────────────────────────────────────────────────────────

def _load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()


def _get_api_key():
    _load_env()
    key = os.environ.get("SWAPCARD_API_KEY")
    if not key:
        raise EnvironmentError("SWAPCARD_API_KEY not set in environment or .env file")
    return key


# ─── Core Streaming Fetcher ───────────────────────────────────────────────────

def _fetch_analytics_stream(event_ids: list, time_gt: str, time_lt: str | None = None,
                             max_events: int | None = None, verbose: bool = False) -> dict:
    """
    Calls the Swapcard Analytics API and aggregates the response stream.

    Returns:
        {
            "raw_count": int,
            "breakdown": {event_name: count},
            "cursor_last": str | None
        }
    """
    api_key = _get_api_key()

    payload = {
        "event_ids": event_ids,
        "time_gt": time_gt,
    }
    if time_lt:
        payload["time_lt"] = time_lt

    req = urllib.request.Request(
        ANALYTICS_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST"
    )
    req.add_header("Authorization", api_key)
    req.add_header("Content-Type", "application/json")

    count = 0
    breakdown: dict[str, int] = {}
    cursor_last = None

    try:
        # Increase timeout for large historical datasets and add explicit error handling for the stream
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw_line in resp:
                try:
                    line = raw_line.strip()
                    if not line:
                        continue
                    event_obj = json.loads(line.decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError, TimeoutError, Exception) as line_err:
                    if verbose:
                        print(f"  [Warn] Skipping line due to error: {line_err}")
                    continue

                ev_name = event_obj.get("event", "unknown")
                breakdown[ev_name] = breakdown.get(ev_name, 0) + 1
                
                # Check for "scanned" flag in properties for badge discovery
                if ev_name in ("connection_create", "contact_connection_create"):
                    props = event_obj.get("properties", {})
                    if props.get("scanned") is True:
                        scanned_key = f"{ev_name}_scanned"
                        breakdown[scanned_key] = breakdown.get(scanned_key, 0) + 1

                cursor_last = event_obj.get("cursor")
                count += 1

                if verbose and count % 1000 == 0:
                    print(f"  ... {count} events streamed")

                if max_events is not None and count >= max_events:
                    if verbose:
                        print(f"  Reached max_events limit ({max_events}). Stopping.")
                    break

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"Analytics API HTTP {e.code}: {detail}") from e

    return {
        "raw_count": count,
        "breakdown": breakdown,
        "cursor_last": cursor_last,
    }


# ─── Public API ───────────────────────────────────────────────────────────────

def get_event_analytics(
    event_id: str,
    time_gt: str | None = None,
    time_lt: str | None = None,
    days_back: int = 365,
    use_cache: bool = False,
    verbose: bool = False,
) -> dict:
    """
    Fetch and aggregate analytics for a single event.

    Args:
        event_id:   Swapcard event ID (base64-encoded)
        time_gt:    ISO8601 start time (default: `days_back` days ago)
        time_lt:    ISO8601 end time (default: None = up to now)
        days_back:  How many days back to fetch if time_gt not given (default 365)
        use_cache:  If True, return cached result if less than 6 hours old
        verbose:    Print progress to stdout

    Returns:
        dict with stats_total_leads, stats_badges_scanned, stats_business_cards_scanned, stats_connections_made,
        stats_connection_requests_sent, stats_messages_exchanged, stats_meetings_created, stats_exhibitor_views, 
        stats_exhibitor_bookmarks, event_breakdown, raw_count, fetched_at
    """
    cache_file = ANALYTICS_CACHE_DIR / f"{event_id}.json"

    # ── Cache read ──
    if use_cache and cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            cached = json.load(f)
        fetched_at = datetime.fromisoformat(cached.get("fetched_at", "2000-01-01"))
        if datetime.utcnow() - fetched_at < timedelta(hours=6):
            if verbose:
                print(f"[cache] Returning cached analytics for {event_id}")
            return cached

    # ── Time range ──
    if not time_gt:
        time_gt = (datetime.utcnow() - timedelta(days=days_back)).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )

    if verbose:
        print(f"[analytics] Fetching event {event_id} from {time_gt} ...")

    # ── Fetch ──
    raw = _fetch_analytics_stream(
        event_ids=[event_id],
        time_gt=time_gt,
        time_lt=time_lt,
        verbose=verbose,
    )

    breakdown: dict[str, int] = raw["breakdown"]

    # ── Aggregate leads ──
    lead_counts: dict[str, int] = {v: 0 for v in LEAD_EVENT_TYPES.values()}
    for api_name, field_name in LEAD_EVENT_TYPES.items():
        lead_counts[field_name] = breakdown.get(api_name, 0)

    # CRITICAL: Attribute scanned connections/contacts to badges scanned
    # These events show up as normal connections but have a 'scanned' flag in payload.
    scanned_extra = (
        breakdown.get("connection_create_scanned", 0) + 
        breakdown.get("contact_connection_create_scanned", 0)
    )
    lead_counts["stats_badges_scanned"] += scanned_extra

    leads_total = (
        lead_counts["stats_badges_scanned"] +
        lead_counts["stats_business_cards_scanned"] +
        lead_counts["stats_connections_made"] +
        lead_counts["stats_exhibitor_views"] +
        lead_counts["stats_exhibitor_bookmarks"]
    )

    result = {
        "event_id": event_id,
        "stats_total_leads": leads_total,
        **lead_counts,
        "event_breakdown": breakdown,
        "raw_count": raw["raw_count"],
        "fetched_at": datetime.utcnow().isoformat(),
        "time_gt": time_gt,
        "time_lt": time_lt,
    }

    # ── Cache write ──
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    if verbose:
        print(f"[analytics] Done. {raw['raw_count']} events → {leads_total} total leads")

    return result


def get_bulk_analytics(
    event_ids: list[str],
    time_gt: str | None = None,
    days_back: int = 365,
    use_cache: bool = True,
    verbose: bool = True,
) -> dict[str, dict]:
    """
    Fetch analytics for multiple events, returning a dict keyed by event_id.
    """
    results: dict[str, dict] = {}
    total = len(event_ids)

    for i, eid in enumerate(event_ids, 1):
        if verbose:
            print(f"[{i}/{total}] Fetching analytics for event {eid} ...")
        try:
            results[eid] = get_event_analytics(
                event_id=eid,
                time_gt=time_gt,
                days_back=days_back,
                use_cache=use_cache,
                verbose=verbose,
            )
        except Exception as exc:
            print(f"  ERROR for event {eid}: {exc}")
            results[eid] = {"event_id": eid, "error": str(exc)}

    return results


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    event_id = sys.argv[1] if len(sys.argv) > 1 else "RXZlbnRfMjc3NzQ3Mw=="

    print(f"Fetching analytics for: {event_id}\n")
    analytics = get_event_analytics(event_id, verbose=True)

    print("\n── Result ─────────────────────────────────────────────────")
    for k, v in analytics.items():
        if k not in ("event_breakdown",):
            print(f"  {k:30} {v}")
    print("\n── Event Breakdown ───────────────────────────────────────")
    for ev, cnt in sorted(analytics["event_breakdown"].items(), key=lambda x: -x[1]):
        marker = " ← LEAD" if ev in LEAD_EVENT_TYPES else ""
        print(f"  {ev:45} {cnt:>6}{marker}")

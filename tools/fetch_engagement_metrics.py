"""
tools/fetch_engagement_metrics.py

Fetches unique user engagement metrics from Swapcard Analytics API.
Processes the analytics stream to count unique users who performed specific actions.

Usage:
    from tools.fetch_engagement_metrics import get_event_engagement_metrics

    metrics = get_event_engagement_metrics("RXZlbnRfMjc3NzQ3Mw==")
    print(metrics)
    # {
    #   "event_id": "RXZlbnRfMjc3NzQ3Mw==",
    #   "stats_active_users": 4288,
    #   "stats_users_connected": 664,
    #   "stats_users_meetings_confirmed": 144,
    #   "stats_users_exhibitor_bookmarks": 111,
    #   "stats_users_session_bookmarks": 569,
    #   "engagement_synced_at": "2026-02-22T...",
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

ENGAGEMENT_CACHE_DIR = Path(__file__).parent.parent / "data" / "engagement"
ENGAGEMENT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

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


# ─── Core Analytics Stream Processor ──────────────────────────────────────────

def _fetch_engagement_metrics_stream(event_id: str, time_gt: str, time_lt: str | None = None,
                                      verbose: bool = False) -> dict:
    """
    Processes the Swapcard Analytics API stream to count unique users.

    Returns:
        {
            "stats_active_users": int,
            "stats_users_connected": int,
            "stats_users_meetings_confirmed": int,
            "stats_users_exhibitor_bookmarks": int,
            "stats_users_session_bookmarks": int,
            "total_events": int
        }
    """
    api_key = _get_api_key()

    payload = {
        "event_ids": [event_id],
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

    # Track unique users for each engagement type
    unique_users_all = set()
    unique_users_connections = set()
    unique_users_meetings_confirmed = set()
    unique_users_exhibitor_bookmarks = set()
    unique_users_session_bookmarks = set()

    count = 0

    try:
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

                user_id = event_obj.get("user_id")
                event_name = event_obj.get("event")
                properties = event_obj.get("properties", {})

                if user_id:
                    # All active users
                    unique_users_all.add(user_id)

                    # Connection events
                    if event_name in ("connection_create", "connection_create_scanned", "contact_connection_create"):
                        unique_users_connections.add(user_id)

                    # Meeting confirmation events
                    elif event_name == "meeting_update":
                        if properties.get("status") == "CONFIRMED":
                            unique_users_meetings_confirmed.add(user_id)
                    elif event_name == "meeting_participant_update":
                        if properties.get("status") == "ACCEPTED":
                            unique_users_meetings_confirmed.add(user_id)

                    # Bookmark events
                    elif event_name == "exhibitor_bookmark_create":
                        unique_users_exhibitor_bookmarks.add(user_id)
                    elif event_name == "planning_bookmark_create":
                        unique_users_session_bookmarks.add(user_id)

                count += 1

                if verbose and count % 25000 == 0:
                    print(f"  ... {count} events streamed, {len(unique_users_all)} unique users")

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"Analytics API HTTP {e.code}: {detail}") from e

    return {
        "stats_active_users": len(unique_users_all),
        "stats_users_connected": len(unique_users_connections),
        "stats_users_meetings_confirmed": len(unique_users_meetings_confirmed),
        "stats_users_exhibitor_bookmarks": len(unique_users_exhibitor_bookmarks),
        "stats_users_session_bookmarks": len(unique_users_session_bookmarks),
        "total_events": count,
    }


# ─── Public API ───────────────────────────────────────────────────────────────

def get_event_engagement_metrics(
    event_id: str,
    time_gt: str | None = None,
    time_lt: str | None = None,
    days_back: int = 365,
    use_cache: bool = False,
    verbose: bool = False,
) -> dict:
    """
    Fetch unique user engagement metrics for a single event.

    Args:
        event_id:   Swapcard event ID (base64-encoded)
        time_gt:    ISO8601 start time (default: `days_back` days ago)
        time_lt:    ISO8601 end time (default: None = up to now)
        days_back:  How many days back to fetch if time_gt not given (default 365)
        use_cache:  If True, return cached result if less than 6 hours old
        verbose:    Print progress to stdout

    Returns:
        dict with stats_active_users, stats_users_connected, stats_users_meetings_confirmed,
        stats_users_exhibitor_bookmarks, stats_users_session_bookmarks, engagement_synced_at
    """
    cache_file = ENGAGEMENT_CACHE_DIR / f"{event_id}.json"

    # ── Cache read ──
    if use_cache and cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            cached = json.load(f)
        synced_at = datetime.fromisoformat(cached.get("engagement_synced_at", "2000-01-01"))
        if datetime.utcnow() - synced_at < timedelta(hours=6):
            if verbose:
                print(f"[cache] Returning cached engagement metrics for {event_id}")
            return cached

    # ── Time range ──
    if not time_gt:
        time_gt = (datetime.utcnow() - timedelta(days=days_back)).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )

    if verbose:
        print(f"[engagement] Fetching event {event_id} from {time_gt} ...")

    # ── Fetch ──
    metrics = _fetch_engagement_metrics_stream(
        event_id=event_id,
        time_gt=time_gt,
        time_lt=time_lt,
        verbose=verbose,
    )

    result = {
        "event_id": event_id,
        "stats_active_users": metrics["stats_active_users"],
        "stats_users_connected": metrics["stats_users_connected"],
        "stats_users_meetings_confirmed": metrics["stats_users_meetings_confirmed"],
        "stats_users_exhibitor_bookmarks": metrics["stats_users_exhibitor_bookmarks"],
        "stats_users_session_bookmarks": metrics["stats_users_session_bookmarks"],
        "total_events": metrics["total_events"],
        "engagement_synced_at": datetime.utcnow().isoformat(),
        "time_gt": time_gt,
        "time_lt": time_lt,
    }

    # ── Cache write ──
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    if verbose:
        print(f"[engagement] Done. {metrics['total_events']} events -> {metrics['stats_active_users']} active users")

    return result


def get_bulk_engagement_metrics(
    event_ids: list[str],
    time_gt: str | None = None,
    days_back: int = 365,
    use_cache: bool = True,
    verbose: bool = True,
) -> dict[str, dict]:
    """
    Fetch engagement metrics for multiple events.
    """
    results: dict[str, dict] = {}
    total = len(event_ids)

    for i, eid in enumerate(event_ids, 1):
        if verbose:
            print(f"[{i}/{total}] Fetching engagement metrics for event {eid} ...")
        try:
            results[eid] = get_event_engagement_metrics(
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

    event_id = sys.argv[1] if len(sys.argv) > 1 else "RXZlbnRfMjc3NzQ3Ng=="

    print(f"Fetching engagement metrics for: {event_id}\n")
    metrics = get_event_engagement_metrics(event_id, verbose=True)

    print("\n── Result ─────────────────────────────────────────────────")
    for k, v in metrics.items():
        if k not in ("total_events",):
            print(f"  {k:40} {v}")

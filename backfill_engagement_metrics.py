"""
backfill_engagement_metrics.py

Backfills unique user engagement metrics for ALL events in Supabase.
Fetches analytics from Swapcard API and updates swapcard_events table.

Usage:
    python backfill_engagement_metrics.py                    # Fetch last 2 years
    python backfill_engagement_metrics.py --days 365         # Fetch last 1 year
    python backfill_engagement_metrics.py --force            # Force re-fetch even if cached
    python backfill_engagement_metrics.py --category Past    # Only past events
    python backfill_engagement_metrics.py --event RXZlbnRfMjc3NzQ3Ng==  # Single event
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).parent))

from tools.supabase_client import supabase
from tools.fetch_engagement_metrics import get_event_engagement_metrics
from tools.get_events import get_events


def parse_args():
    p = argparse.ArgumentParser(description="Backfill engagement metrics for all events")
    p.add_argument("--days", type=int, default=730, help="Days back to fetch (default: 730 = 2 years)")
    p.add_argument("--force", action="store_true", help="Force re-fetch even if cached")
    p.add_argument("--category", choices=["Active", "Future", "Past"], help="Only process one category")
    p.add_argument("--event", type=str, help="Process only a single event ID")
    p.add_argument("--dry-run", action="store_true", help="Only print what would be done, don't write")
    return p.parse_args()


def get_all_event_ids(category_filter: str | None = None) -> list[dict]:
    """Fetch all event IDs from Swapcard via the existing get_events tool."""
    print("[Backfill] Loading events from Swapcard API...")
    result = get_events()
    events_by_cat: dict = result.get("events", {})

    all_events = []
    for cat, evs in events_by_cat.items():
        if category_filter and cat != category_filter:
            continue
        for ev in evs:
            all_events.append({
                "id": ev["id"],
                "title": ev.get("title", "Untitled"),
                "category": cat,
            })

    return all_events


def backfill_single_event(event_id: str, title: str, days_back: int, force: bool, dry_run: bool) -> bool:
    """Backfill engagement metrics for a single event. Returns True on success."""

    time_gt = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    if dry_run:
        print(f"  DRY RUN - would fetch engagement metrics")
        return True

    try:
        metrics = get_event_engagement_metrics(
            event_id=event_id,
            time_gt=time_gt,
            use_cache=not force,
            verbose=False,
        )

        upsert = {
            "id": event_id,
            "stats_active_users": metrics.get("stats_active_users", 0),
            "stats_users_connected": metrics.get("stats_users_connected", 0),
            "stats_users_meetings_confirmed": metrics.get("stats_users_meetings_confirmed", 0),
            "stats_users_exhibitor_bookmarks": metrics.get("stats_users_exhibitor_bookmarks", 0),
            "stats_users_session_bookmarks": metrics.get("stats_users_session_bookmarks", 0),
            "engagement_synced_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("swapcard_events").upsert(upsert).execute()

        active_users = metrics.get("stats_active_users", 0)
        print(f"  {active_users:>5} active users")

        return True

    except Exception as exc:
        print(f"  ERROR: {exc}")
        return False


def backfill(events: list[dict], days_back: int, force: bool, dry_run: bool):
    total = len(events)
    succeeded = 0
    failed = 0

    time_gt = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"[Backfill] Processing {total} events, window: from {time_gt} to now")
    print()

    for i, ev in enumerate(events, 1):
        eid = ev["id"]
        title = ev["title"][:50]
        cat = ev["category"]

        prefix = f"[{i:>3}/{total}] [{cat:6}] {title:50}"
        print(prefix, end=" -> ")

        success = backfill_single_event(eid, title, days_back, force, dry_run)
        if success:
            succeeded += 1
        else:
            failed += 1

    print()
    print("─" * 80)
    print(f"[Backfill] Done: {succeeded} succeeded, {failed} failed out of {total} events")


if __name__ == "__main__":
    args = parse_args()

    if args.event:
        # Single event mode
        print(f"[Backfill] Processing single event: {args.event}")
        print()

        # Get event details from Supabase
        result = supabase.table("swapcard_events").select("id, title").eq("id", args.event).execute()
        if result.data:
            event = result.data[0]
            title = event.get("title", "Unknown")
            print(f"Event: {title}")
            print(f"ID: {args.event}")
            print()

            success = backfill_single_event(args.event, title, args.days, args.force, args.dry_run)
            if success:
                print("\nSUCCESS!")
            else:
                print("\nFAILED!")
                sys.exit(1)
        else:
            print(f"ERROR: Event not found in database: {args.event}")
            sys.exit(1)
    else:
        # Bulk mode
        events = get_all_event_ids(category_filter=args.category)
        if not events:
            print("[Backfill] No events found. Exiting.")
            sys.exit(0)

        backfill(
            events=events,
            days_back=args.days,
            force=args.force,
            dry_run=args.dry_run,
        )

"""
backfill_analytics.py

One-time script to backfill lead analytics for ALL events in Supabase.
Fetches Swapcard Analytics API data for each event and updates the
swapcard_events table with real lead counts.

Usage:
    python backfill_analytics.py                    # Fetch last 2 years
    python backfill_analytics.py --days 365         # Fetch last 1 year
    python backfill_analytics.py --force            # Force re-fetch even if cached
    python backfill_analytics.py --category Past    # Only past events
"""

import os
import sys
import json
import asyncio
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).parent))

from tools.supabase_client import supabase
from tools.fetch_analytics import get_event_analytics
from tools.get_events import get_events


def parse_args():
    p = argparse.ArgumentParser(description="Backfill lead analytics for all events")
    p.add_argument("--days", type=int, default=730, help="Days back to fetch (default: 730 = 2 years)")
    p.add_argument("--force", action="store_true", help="Force re-fetch even if cached")
    p.add_argument("--category", choices=["Active", "Future", "Past"], help="Only process one category")
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


def backfill(events: list[dict], days_back: int, force: bool, dry_run: bool):
    total = len(events)
    succeeded = 0
    failed = 0
    skipped = 0

    time_gt = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"[Backfill] Processing {total} events, window: from {time_gt} to now")
    print()

    for i, ev in enumerate(events, 1):
        eid = ev["id"]
        title = ev["title"][:50]
        cat = ev["category"]

        prefix = f"[{i:>3}/{total}] [{cat:6}] {title:50}"

        if dry_run:
            print(f"{prefix} → DRY RUN")
            continue

        try:
            analytics = get_event_analytics(
                event_id=eid,
                time_gt=time_gt,
                use_cache=not force,
                verbose=False,
            )

            upsert = {
                "id": eid,
                "stats_total_leads":              analytics.get("stats_total_leads", 0),
                "stats_badges_scanned":           analytics.get("stats_badges_scanned", 0),
                "stats_business_cards_scanned":   analytics.get("stats_business_cards_scanned", 0),
                "stats_connections_made":         analytics.get("stats_connections_made", 0),
                "stats_connection_requests_sent": analytics.get("stats_connection_requests_sent", 0),
                "stats_messages_exchanged":       analytics.get("stats_messages_exchanged", 0),
                "stats_meetings_created":         analytics.get("stats_meetings_created", 0),
                "stats_exhibitor_views":          analytics.get("stats_exhibitor_views", 0),
                "stats_exhibitor_bookmarks":      analytics.get("stats_exhibitor_bookmarks", 0),
                "analytics_synced_at": datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("swapcard_events").upsert(upsert).execute()
            leads_total = analytics.get("stats_total_leads", 0)

            print(f"{prefix} → {leads_total:>4} leads ✓")
            succeeded += 1

        except Exception as exc:
            print(f"{prefix} → ERROR: {exc}")
            failed += 1

    print()
    print("─" * 80)
    print(f"[Backfill] Done: {succeeded} succeeded, {skipped} skipped, {failed} failed out of {total} events")


if __name__ == "__main__":
    args = parse_args()

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

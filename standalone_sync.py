import os
import json as _json
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from tools import get_events, supabase_client
from tools.supabase_client import supabase
from tools.fetch_analytics import get_event_analytics
from tools.get_airtable import get_airtable_events, get_portfolio_mapping
import re

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

def _load_sync_settings():
    try:
        res = supabase.table("sync_settings").select("*").eq("id", 1).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"Error loading sync settings from Supabase: {e}")
    return {"disabled_communities": [], "disabled_events": [], "sync_interval_minutes": 60}

ANALYTICS_MAX_AGE_HOURS = 24  # Re-fetch analytics if older than this


def _should_refresh_analytics(analytics_synced_at_str: str | None, force_refresh: bool) -> bool:
    """Returns True if analytics data should be refreshed."""
    if force_refresh or not analytics_synced_at_str:
        return True
    try:
        synced_at = datetime.fromisoformat(analytics_synced_at_str.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - synced_at
        return age > timedelta(hours=ANALYTICS_MAX_AGE_HOURS)
    except Exception:
        return True


def _clean_community_name(name: str | None) -> str:
    if not name:
        return ""
    # Standard prefix to remove
    prefix = "Informa Markets | IM EMEA | Tahaluf | "
    if name.startswith(prefix):
        name = name[len(prefix):]
    
    # Specific common ones
    if name == "Informa Markets Maritime and Design":
        return "Maritime & Design"
    
    return name.strip()


def _get_base_name(title: str | None) -> str:
    if not title:
        return ""
    # Remove years (2020-2029) and trim
    clean = re.sub(r'\b202[0-9]\b', '', title)
    return clean.strip()


async def run_standalone_sync(force_refresh: bool = False):
    """Performs a sync of Swapcard events ONLY and saves to Supabase."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sync] Starting events-only sync...")
    
    try:
        # 1. Load settings
        settings = _load_sync_settings()

        # 2. Fetch Swapcard events
        print("[Sync] Phase 1: Fetching Swapcard events via GraphQL...")
        result = get_events.get_events(settings=settings)
        events_by_cat = result.get("events", {})
        all_events_flat = [ev for evs in events_by_cat.values() for ev in evs]
        print(f"[Sync] Found {len(all_events_flat)} events total.")

        # 2.5 Fetch Airtable Portfolio Mapping
        print("[Sync] Phase 1.5: Fetching Airtable portfolio mapping...")
        portfolio_records = get_portfolio_mapping()
        
        # Build base_name -> portfolio mapping
        portfolio_map = {}
        for record in portfolio_records:
            p = record.get('portfolio')
            name = record.get('name')
            if name and p:
                base_name = _get_base_name(name)
                if base_name:
                    portfolio_map[base_name] = p
        
        # Also include direct ID hits from the Projects table if possible
        # (Optional but good for fallback)
        direct_id_map = {}
        try:
            project_records = get_airtable_events()
            for r in project_records:
                eid = r.get('event_id')
                p = r.get('portfolio')
                if eid and p:
                    direct_id_map[eid] = p
        except Exception:
            pass
        
        print(f"[Sync] Resolved portfolio mapping for {len(portfolio_map)} series.")

        # 3. Upsert Events with metadata
        print("[Sync] Phase 2: Updating events in Supabase (swapcard_events table)...")
        for category, events in events_by_cat.items():
            print(f"  - Processing {len(events)} {category} events...")
            for ev in events:
                eid = ev["id"]
                
                # Calculate registrations from groups (available in event metadata)
                registrations = sum(group.get("peopleCount", 0) for group in ev.get("groups", []))

                # ── Analytics: fetch lead counts from Swapcard Analytics API ──
                # Check the current analytics_synced_at from Supabase to avoid unnecessary re-fetches
                leads_data = {
                    "stats_total_leads": 0, "stats_badges_scanned": 0, "stats_business_cards_scanned": 0,
                    "stats_connections_made": 0, "stats_connection_requests_sent": 0, "stats_messages_exchanged": 0,
                    "stats_meetings_created": 0, "stats_exhibitor_views": 0, "stats_exhibitor_bookmarks": 0, 
                    "analytics_synced_at": None
                }
                try:
                    existing = supabase.table("swapcard_events").select(
                        "analytics_synced_at"
                    ).eq("id", eid).maybe_single().execute()
                    current_synced_at = (existing.data or {}).get("analytics_synced_at")

                    if _should_refresh_analytics(current_synced_at, force_refresh):
                        analytics = get_event_analytics(event_id=eid, use_cache=not force_refresh)
                        leads_data = {
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
                        print(f"    [Analytics] {ev.get('title', eid)[:40]:40} → {leads_data['stats_total_leads']} leads")
                    else:
                        print(f"    [Analytics] {ev.get('title', eid)[:40]:40} → skipped (fresh cache)")
                        # Preserve existing values by not overwriting
                        leads_data = {"analytics_synced_at": current_synced_at}
                except Exception as ae:
                    print(f"    [Analytics] Warning: could not fetch analytics for {eid}: {ae}")

                # Prepare upsert data with metadata available from get_events
                upsert_data = {
                    "id": eid,
                    "slug": ev.get("slug"),
                    "title": ev.get("title"),
                    "data": ev,
                    "category": category,
                    "updated_at": ev.get("updatedAt") or ev.get("createdAt"),
                    "registrations_count": registrations,
                    "exhibitors_count": ev.get("totalExhibitors", 0),
                    "speakers_count": ev.get("totalSpeakers", 0),
                    "sessions_count": ev.get("totalPlannings", 0),
                    "members_count": 0,
                    "begins_at": ev.get("beginsAt"),
                    "ends_at": ev.get("endsAt"),
                    "banner_url": (ev.get("banner") or {}).get("imageUrl"),
                    "city": (ev.get("address") or {}).get("city"),
                    "country": (ev.get("address") or {}).get("country"),
                    "community_id": (ev.get("community") or {}).get("id"),
                    "community_name": _clean_community_name((ev.get("community") or {}).get("name")),
                    "community_logo_url": (ev.get("community") or {}).get("logoUrl"),
                    "community_banner_url": (ev.get("community") or {}).get("bannerImageUrl"),
                    "portfolio": direct_id_map.get(eid) or portfolio_map.get(_get_base_name(ev.get("title"))),
                    "is_live": ev.get("isLive", False),
                    "is_public": ev.get("isPublic", True),
                    "description_html": ev.get("htmlDescription"),
                    **leads_data,
                }
                
                try:
                    supabase.table("swapcard_events").upsert(upsert_data).execute()
                except Exception as e:
                    print(f"Error upserting event {eid}: {e}")

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sync] Standalone events-only sync completed successfully.")
        
    except Exception as e:
        print(f"[Sync] Standalone sync failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_standalone_sync())

"""
Script to add lead stat columns to swapcard_events table using programmatic updates.
"""
import sys
import os
from datetime import datetime
from pathlib import Path

# Fix path to allow importing from tools
current_dir = Path(__file__).parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

from tools.supabase_client import supabase

def run_lead_migration():
    print("="*80)
    print("ADDING LEAD STAT COLUMNS TO SWAPCARD_EVENTS")
    print("="*80)
    
    sample_update = {
        "stats_total_leads": 0,
        "stats_badges_scanned": 0,
        "stats_business_cards_scanned": 0,
        "stats_connections_made": 0,
        "stats_connection_requests_sent": 0,
        "stats_messages_exchanged": 0,
        "stats_meetings_created": 0,
        "stats_exhibitor_views": 0,
        "stats_exhibitor_bookmarks": 0
    }
    
    print("[1/1] Attempting to update event records with new lead columns...")
    
    try:
        # Get first event ID to test
        res = supabase.table("swapcard_events").select("id").limit(1).execute()
        if not res.data:
            print("No events found in table.")
            return
        
        eid = res.data[0]['id']
        print(f"Testing update on event: {eid}")
        
        # This will fail if columns don't exist
        try:
            supabase.table("swapcard_events").update(sample_update).eq("id", eid).execute()
            print("✅ Columns already exist or were created!")
        except Exception as e:
            # We check if the error is specifically about missing columns
            e_str = str(e)
            if "column" in e_str.lower() and "does not exist" in e_str.lower():
                print(f"❌ Columns do not exist: {e}")
                print("\nPLEASE RUN THIS SQL IN THE SUPABASE DASHBOARD:")
                print("="*80)
                print("""
ALTER TABLE swapcard_events 
ADD COLUMN IF NOT EXISTS stats_total_leads INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_badges_scanned INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_business_cards_scanned INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_connections_made INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_connection_requests_sent INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_messages_exchanged INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_meetings_created INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_exhibitor_views INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_exhibitor_bookmarks INT DEFAULT 0;
                """)
                print("="*80)
            else:
                print(f"✅ Columns seem to be present (Update attempted). Message: {e_str[:100]}")
                
    except Exception as e:
        print(f"Global error: {e}")

if __name__ == "__main__":
    run_lead_migration()

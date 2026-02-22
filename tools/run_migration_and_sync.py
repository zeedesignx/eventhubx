"""
Complete migration and sync script.
1. Runs SQL migration to add stat columns
2. Triggers full Swapcard sync to populate all data
"""

from supabase_client import supabase
import sys

def run_sql_migration():
    """Runs the SQL migration to add stat columns."""
    print("[Migration] Adding stat columns to swapcard_events table...")

    sql = """
    -- Add new stat columns to swapcard_events table
    ALTER TABLE swapcard_events
    ADD COLUMN IF NOT EXISTS registrations_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS exhibitors_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS speakers_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sessions_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS leads_count INTEGER DEFAULT 0;

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_swapcard_events_registrations ON swapcard_events(registrations_count);
    CREATE INDEX IF NOT EXISTS idx_swapcard_events_exhibitors ON swapcard_events(exhibitors_count);
    CREATE INDEX IF NOT EXISTS idx_swapcard_events_speakers ON swapcard_events(speakers_count);

    -- Migrate existing data from stats JSONB column to new columns
    UPDATE swapcard_events
    SET
        exhibitors_count = COALESCE((stats->>'exhibitorCount')::integer, 0),
        members_count = COALESCE((stats->>'membersCount')::integer, 0),
        speakers_count = COALESCE((stats->>'personCount')::integer, 0),
        sessions_count = COALESCE((stats->>'sessionsCount')::integer, 0),
        leads_count = COALESCE((stats->>'leadsCount')::integer, 0)
    WHERE stats IS NOT NULL;
    """

    try:
        # Execute SQL via RPC or direct query
        result = supabase.rpc('exec_sql', {'sql': sql}).execute()
        print("✅ SQL migration completed successfully!")
        return True
    except Exception as e:
        print(f"⚠️  Direct SQL execution failed: {e}")
        print("\nPlease run this SQL manually in Supabase SQL Editor:")
        print("="*80)
        print(sql)
        print("="*80)

        response = input("\nHave you run the SQL in Supabase? (y/n): ")
        return response.lower() == 'y'

def trigger_full_sync():
    """Triggers a full sync via the API endpoint."""
    import requests

    print("\n[Sync] Triggering full Swapcard sync...")
    try:
        response = requests.post("http://localhost:8000/api/sync/manual")
        if response.status_code == 200:
            print("✅ Sync triggered successfully!")
            print("   The sync is running in the background.")
            print("   Check server logs for progress.")
            return True
        else:
            print(f"❌ Sync trigger failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Could not connect to server: {e}")
        print("   Make sure the server is running (python main.py)")
        return False

def main():
    print("="*80)
    print("SWAPCARD → SUPABASE MIGRATION & SYNC")
    print("="*80)
    print()

    # Step 1: Run migration
    if not run_sql_migration():
        print("\n❌ Migration incomplete. Please fix errors and try again.")
        sys.exit(1)

    print()

    # Step 2: Trigger sync
    if not trigger_full_sync():
        print("\n⚠️  Sync not triggered. You can manually trigger it:")
        print("   - Via UI: Click 'Sync from Swapcard' button")
        print("   - Via API: POST to http://localhost:8000/api/sync/manual")
        sys.exit(1)

    print()
    print("="*80)
    print("✅ MIGRATION & SYNC COMPLETED!")
    print("="*80)
    print("\nYour dashboard should now show real data from Swapcard.")
    print("All stats are stored in separate columns for better performance.")

if __name__ == "__main__":
    main()

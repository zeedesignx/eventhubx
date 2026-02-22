"""
Migration script to add separate stat columns to swapcard_events table.
This replaces the generic 'stats' JSONB column with individual typed columns for better querying.
"""

from supabase_client import supabase

def migrate_add_stat_columns():
    """
    Adds individual stat columns to swapcard_events table.

    New columns:
    - registrations_count (int) - Total registrations (sum of groups.peopleCount)
    - exhibitors_count (int) - Total exhibitors
    - members_count (int) - Total exhibitor members
    - speakers_count (int) - Total speakers/people
    - sessions_count (int) - Total sessions/plannings
    - leads_count (int) - Total leads
    """

    print("[Migration] Starting migration to add stat columns...")

    # Note: Supabase schema changes must be done via SQL in the Supabase dashboard
    # This script will show you the SQL to run

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

    -- Calculate registrations from data JSONB (groups.peopleCount)
    -- This is more complex and will be handled by the sync script
    """

    print("\n" + "="*80)
    print("RUN THIS SQL IN SUPABASE SQL EDITOR:")
    print("="*80)
    print(sql)
    print("="*80)
    print("\nAfter running the SQL, the sync script will populate registrations_count.")
    print("\nMigration SQL generated successfully!")

if __name__ == "__main__":
    migrate_add_stat_columns()

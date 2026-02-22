"""
Migrates existing event data to populate new stat columns.
Since Supabase client doesn't support direct DDL, columns must be added via SQL Editor.
This script migrates the data into those columns.
"""

from supabase_client import supabase
import sys

def execute_migration():
    """Migrates existing event data to new stat columns."""
    print("="*80)
    print("MIGRATING EVENT DATA TO STAT COLUMNS")
    print("="*80)
    print()
    print("NOTE: Stat columns must already exist in Supabase.")
    print("If you get errors, please run the SQL from migration_add_stat_columns.sql first.")
    print()

    print("[1/1] Migrating existing data to stat columns...")

    try:
        # Get all events and update them using the client
        print("  → Fetching existing events...")
        result = supabase.table('swapcard_events').select('id, stats, data').execute()
        events = result.data

        print(f"  → Found {len(events)} events")

        updated = 0
        for event in events:
            eid = event['id']
            stats = event.get('stats') or {}
            data = event.get('data') or {}

            # Calculate registrations from groups
            registrations = 0
            for group in data.get('groups', []):
                registrations += group.get('peopleCount', 0)

            # Update with individual stat columns
            update_data = {
                'exhibitors_count': stats.get('exhibitorCount', 0),
                'members_count': stats.get('membersCount', 0),
                'speakers_count': stats.get('personCount', 0),
                'sessions_count': stats.get('sessionsCount', 0),
                'leads_count': stats.get('leadsCount', 0),
                'registrations_count': registrations
            }

            supabase.table('swapcard_events').update(update_data).eq('id', eid).execute()
            updated += 1

            if updated % 10 == 0:
                print(f"  → Migrated {updated}/{len(events)} events...")

        print(f"  ✓ Successfully migrated {updated} events")

    except Exception as e:
        print(f"  ❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    print()
    print("="*80)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
    print("="*80)
    return True

if __name__ == "__main__":
    success = execute_migration()
    sys.exit(0 if success else 1)

"""
Migrates data to stat columns by updating existing records.
Supabase will auto-create the columns when we insert data with new fields.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tools.supabase_client import supabase

def migrate_data():
    print("="*80)
    print("MIGRATING EVENT DATA TO STAT COLUMNS")
    print("="*80)
    print()

    try:
        # Fetch all events
        print("[1/2] Fetching all events from Supabase...")
        result = supabase.table('swapcard_events').select('*').execute()
        events = result.data
        print(f"  Found {len(events)} events")

        if not events:
            print("  No events to migrate!")
            return True

        print()
        print("[2/2] Updating events with stat columns...")

        updated = 0
        errors = 0

        for i, event in enumerate(events, 1):
            eid = event['id']
            stats = event.get('stats') or {}
            data = event.get('data') or {}

            # Calculate registrations from groups
            registrations = 0
            for group in data.get('groups', []):
                registrations += group.get('peopleCount', 0)

            # Prepare update with new stat columns
            update_data = {
                'registrations_count': registrations,
                'exhibitors_count': stats.get('exhibitorCount', 0),
                'members_count': stats.get('membersCount', 0),
                'speakers_count': stats.get('personCount', 0),
                'sessions_count': stats.get('sessionsCount', 0),
                'leads_count': stats.get('leadsCount', 0)
            }

            try:
                supabase.table('swapcard_events').update(update_data).eq('id', eid).execute()
                updated += 1

                if updated % 10 == 0:
                    print(f"  Progress: {updated}/{len(events)} events migrated...")

            except Exception as e:
                errors += 1
                print(f"  Error updating event {eid}: {e}")

        print()
        print("="*80)
        print(f"MIGRATION COMPLETE!")
        print(f"  Successfully updated: {updated} events")
        print(f"  Errors: {errors}")
        print("="*80)

        return errors == 0

    except Exception as e:
        print(f"MIGRATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = migrate_data()
    sys.exit(0 if success else 1)

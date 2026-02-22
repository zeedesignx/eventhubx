# SwapcardOS → Supabase Sync Guide

This guide walks you through setting up the new stat columns and syncing all data from Swapcard to Supabase.

## What Changed

### Before
- Dashboard stats showed zeros because data wasn't properly wired
- Stats were stored in a generic `stats` JSONB column
- Hard to query and aggregate stats

### After
- ✅ Separate columns for each stat (faster queries, better indexing)
- ✅ Dashboard wired to pull real data from Supabase
- ✅ Events Overview cards show accurate stats
- ✅ All data syncs from Swapcard automatically

## New Database Schema

The `swapcard_events` table now has these **individual stat columns**:

| Column | Type | Description |
|--------|------|-------------|
| `registrations_count` | INTEGER | Total registrations (sum of groups.peopleCount) |
| `exhibitors_count` | INTEGER | Total exhibitors |
| `members_count` | INTEGER | Total exhibitor members |
| `speakers_count` | INTEGER | Total speakers/people |
| `sessions_count` | INTEGER | Total sessions/plannings |
| `leads_count` | INTEGER | Total leads generated |

## Migration Steps

### Step 1: Run SQL Migration

1. Open your Supabase dashboard
2. Go to SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
3. Copy and paste the contents of `migration_add_stat_columns.sql`
4. Click **Run**

This will:
- Add the 6 new stat columns
- Create indexes for performance
- Migrate existing data from the old `stats` JSONB column
- Calculate registrations from groups data

### Step 2: Trigger Data Sync

**Option A: Via Web UI** (Recommended)
1. Start your server: `python main.py`
2. Open http://localhost:8000
3. Click **"Sync from Swapcard"** button in the dashboard
4. Wait for sync to complete (~30-60 seconds depending on data volume)

**Option B: Via Python Script**
```bash
python tools/run_migration_and_sync.py
```

**Option C: Via API**
```bash
curl -X POST http://localhost:8000/api/sync/manual
```

### Step 3: Verify

1. Refresh your dashboard
2. Check that the top stat cards show real numbers (not zeros)
3. Verify Events Overview cards display correct stats
4. Check that combined cards show both values:
   - Exhibitors & Members: "25 (120)"
   - Speakers & Sessions: "50 (30)"

## How Sync Works

The sync process runs in 3 phases:

### Phase 1: Events Sync
- Fetches all events from Swapcard API
- Categorizes into Active/Future/Past
- Calculates registrations from groups
- Stores in `swapcard_events` table with individual stat columns

### Phase 2: Subpages Sync
- Fetches exhibitors, people (speakers), sessions, sponsors for each event
- Calculates aggregated stats (leads, members, etc.)
- Updates stat columns in `swapcard_events`

### Phase 3: Airtable Sync
- Fetches project metadata from Airtable
- Stores in `events` table
- Links to Swapcard events by matching titles

## Automatic Sync

By default, sync runs **every 60 minutes** automatically.

To change the interval:
1. Go to Settings page
2. Update "Sync Interval" dropdown
3. Click Save

## Dashboard Stats

The dashboard now shows 4 stat cards:

1. **Events** - Total number of events across all categories
2. **Registrations** - Total people registered across all events
3. **Exhibitors & Members** - Format: "25 (120)" = 25 exhibitors, 120 team members
4. **Speakers & Sessions** - Format: "50 (30)" = 50 speakers, 30 sessions

All stats are **live** and update on every sync!

## Troubleshooting

### Dashboard shows zeros
- Make sure you ran the SQL migration
- Trigger a manual sync
- Check server console for errors

### Sync fails
- Verify `SWAPCARD_API_KEY` in `.env` file
- Check network connection
- Look for errors in server console

### Supabase connection errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
- Check Supabase project is running

## Files Modified

### Backend
- `main.py` - Updated sync to populate separate stat columns
- `tools/get_events.py` - No changes (already working)
- `tools/get_subpages.py` - No changes (already working)

### Frontend
- `index.html` - Reorganized dashboard stat cards
- `js/events.js` - Updated to read from separate stat columns

### Migration
- `migration_add_stat_columns.sql` - SQL migration script
- `tools/migrate_stats_columns.py` - Python migration helper
- `tools/run_migration_and_sync.py` - Complete migration + sync script

## Support

If you encounter issues:
1. Check server console for detailed error messages
2. Verify `.env` file has all required keys
3. Ensure Supabase schema matches (run migration)
4. Try manual sync to see real-time errors

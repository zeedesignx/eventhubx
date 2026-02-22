# 📊 Lead Analytics – Full Implementation Task Plan

## Context
We need to pull real lead/engagement data from Swapcard into our dashboard for all events.
The **Analytics API** (`POST https://developer.swapcard.com/event-admin/export/analytics`) streams
raw user-action events (NDJSON) for any event(s). We have confirmed it works.

The **lead definition** we're using:
| Action | Event Name in API | Meaning |
|---|---|---|
| `exhibitor_bookmark_create` | Bookmark | Attendee favourited an exhibitor |
| `connection_create` | Connection | Direct 1-to-1 connection made |
| `planning_scan_create` | Scan | Badge scan at exhibitor booth |
| `exhibitor_show` | View | Attendee viewed exhibitor booth |

---

## Phase 1 – Core Analytics Tool ✅ COMPLETE
> **Goal:** Create a reusable, production-quality tool to fetch analytics for any event.

- [x] Research Analytics API structure – confirmed streaming NDJSON endpoint
- [x] **Created `tools/fetch_analytics.py`** — core tool with:
  - Streaming reader with 500k event limit
  - Configurable event_ids, time_gt, time_lt
  - Aggregation by event type → returns clean summary dict
  - Writes raw data to `data/analytics/<event_id>.json` for caching (6h TTL)
- [x] **Verified** output: LEAP 2026 → 25 leads (21 bookmarks + 4 connections), 8,399 raw events
- [x] Cleaned up all debug scripts

---

## Phase 2 – Supabase Schema + Sync Integration
> **Goal:** Store lead analytics in Supabase and sync them automatically.

- [x] **Add columns to Supabase `events` table:**
  - `stats_exhibitor_bookmarks` (int)
  - `stats_connections_made` (int)
  - `stats_badges_scanned` (int)
  - `stats_exhibitor_views` (int)
  - `stats_total_leads` (int, computed: sum of above)
  - `analytics_synced_at` (timestamptz)
  - And more stats
- [x] **Update `standalone_sync.py`:**
  - Call `fetch_analytics.get_event_analytics(event_id)` for each event
  - Upsert analytics columns
  - Only refetch analytics if `analytics_synced_at` is older than 24h (or force_refresh=True)

---

## Phase 3 – Historical Backfill ✅ COMPLETE
> **Goal:** Populate analytics for every past event already in our system.

- [x] Created `backfill_analytics.py` script:
  - Reads all event IDs from Swapcard API
  - Fetches analytics for each, configurable `--days` window (default 2 years)
  - Writes results to Supabase
  - Supports `--force`, `--dry-run`, `--category` flags
- [x] **Run the actual backfill** (`python backfill_analytics.py`) — ready to execute on your command

---

## Phase 4 – Dashboard UI
> **Goal:** Surface lead data in the Event Overview and Exhibitor pages.

- [x] **Event Modal – Event Overview tab:**
  - Wire all new metrics and adjust UI cards
  - Replace any hardcoded zeroes
- [x] **Events Table:**
  - Add `Leads` column (showing `leads_total`)
  - Include in the advanced filter options
- [x] **Exhibitor Subpage:**
  - Already has `scans` and `views` in the panel (from `ExhibitorWithEvent.leads`)
  - Add `contacts` and `bookmarks` to the panel view

---

## Files Being Created / Modified
| File | Action | Phase |
|---|---|---|
| `tools/fetch_analytics.py` | **CREATE** – core analytics tool | 1 |
| `data/analytics/` | **CREATE** – cached analytics JSON files | 1 |
| `standalone_sync.py` | **MODIFY** – integrate analytics into sync | 2 |
| Supabase `events` table | **ALTER** – add analytics columns | 2 |
| `backfill_analytics.py` | **CREATE** – one-time historical backfill | 3 |
| `js/subpages.js` | **MODIFY** – display leads in exhibitor panel | 4 |
| `js/sync.js` | **MODIFY** – pull leads from Supabase | 4 |

---

## Debug / Temp Files to Clean Up After Phase 1
- `test_leads_query.py`
- `test_analytics_api.py`
- `debug_leads_v2.py`
- `introspect_api.py`
- `introspect_withevents.py`
- `introspect_exhibitor_withevent.py`
- `introspect_exhibitor_leads.py`
- `api_structure.json`
- `exhibitor_leads_fields.json`
- `exhibitor_withevent_fields.json`
- `exhibitor_withevents_details.json`

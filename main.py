from fastapi import FastAPI, Request, BackgroundTasks, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import os
import hashlib
import json as _json
import asyncio
import mimetypes
import httpx
import uuid
import base64
from datetime import datetime, timezone, timedelta
from pathlib import Path
from tools import get_airtable, get_events, get_subpages
# Import Navigation layer
import navigation

from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="EventHubX API")

# ── Paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
JS_DIR   = BASE_DIR / "js"
CSS_DIR  = BASE_DIR / "css"
IMG_CACHE_DIR = BASE_DIR / "img_cache"
IMG_CACHE_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
CHAT_SESSIONS_DIR = DATA_DIR / "chat_sessions"
CHAT_SESSIONS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR = IMG_CACHE_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)

AIRTABLE_CACHE_PATH = BASE_DIR / "airtable_data.json"
SYNC_SETTINGS_PATH = BASE_DIR / "sync_settings.json"

# ── Static Assets ──────────────────────────────────────────────────────────────
if JS_DIR.is_dir():
    app.mount("/js",  StaticFiles(directory=str(JS_DIR)),  name="js")
if CSS_DIR.is_dir():
    app.mount("/css", StaticFiles(directory=str(CSS_DIR)), name="css")
# Serve cached images directly as static files for fast delivery
app.mount("/img_cache", StaticFiles(directory=str(IMG_CACHE_DIR)), name="img_cache")


# ── Image Proxy & Persistent Cache ────────────────────────────────────────────
def _cache_path(url: str) -> Path:
    """Returns a stable local path for a given URL (based on MD5 hash)."""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    raw_ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
    ext = raw_ext if raw_ext in ("png", "jpg", "jpeg", "gif", "webp", "svg", "ico") else "png"
    return IMG_CACHE_DIR / f"{url_hash}.{ext}"

def _local_url(url: str) -> str:
    """Returns the fastest available URL for an image:
       - /img_cache/<hash>.ext  (static file, zero proxy overhead) if cached on disk
       - /api/img?url=...       (proxy, downloads+caches on first hit) if not yet cached
    """
    if not url:
        return ""
    dest = _cache_path(url)
    if dest.exists():
        return f"/img_cache/{dest.name}"
    from urllib.parse import quote
    return f"/api/img?url={quote(url, safe='')}"

async def _download_one(client, url: str):
    dest = _cache_path(url)
    if dest.exists():
        return
    try:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 200:
            dest.write_bytes(resp.content)
    except Exception as e:
        safe_url = str(url)[:60] if url else "unknown"
        print(f"[ImgCache] {safe_url}: {e}")

async def _bulk_download_parallel(urls: list[str]):
    """Downloads all URLs concurrently (max 20 at a time) into img_cache/."""
    fresh = [u for u in urls if u and not _cache_path(u).exists()]
    if not fresh:
        print(f"[ImgCache] All {len(urls)} images already cached.")
        return
    print(f"[ImgCache] Downloading {len(fresh)} images in parallel...")
    sem = asyncio.Semaphore(20)  # max 20 concurrent downloads
    async def bounded(url):
        async with sem:
            await _download_one(client, url)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        await asyncio.gather(*[bounded(u) for u in fresh])
    print(f"[ImgCache] Done. {len(list(IMG_CACHE_DIR.glob('*')))} total cached.")

async def _startup_preload():
    """Runs at server startup: downloads ALL event banners + Airtable logos concurrently."""
    urls = []
    # 1. Airtable logos + tech stack
    try:
        if AIRTABLE_CACHE_PATH.exists():
            records = _json.loads(AIRTABLE_CACHE_PATH.read_text(encoding="utf-8"))
            for r in records:
                if r.get("logo_url"): urls.append(r["logo_url"])
                for tech in r.get("tech_stack") or []:
                    domain = tech.get("domain", "") if isinstance(tech, dict) else ""
                    if domain:
                        urls.append(f"https://logo.clearbit.com/{domain}")
                        urls.append(f"https://www.google.com/s2/favicons?domain={domain}&sz=64")
    except Exception as e:
        print(f"[ImgCache] Airtable preload read error: {e}")
    # 2. Event banners + community logos
    try:
        result = navigation.route_action("get_events")
        events = result.get("events", {})
        for tab_evs in events.values():
            for ev in tab_evs:
                if ev.get("banner") and ev["banner"].get("imageUrl"):
                    urls.append(ev["banner"]["imageUrl"])
                if ev.get("community"):
                    if ev["community"].get("bannerImageUrl"): urls.append(ev["community"]["bannerImageUrl"])
                    if ev["community"].get("logoUrl"):        urls.append(ev["community"]["logoUrl"])
    except Exception as e:
        print(f"[ImgCache] Events preload read error: {e}")
    # 3. Exhibitors + Sponsors logos
    try:
        data = get_subpages.get_subpages_data()
        for ex in data.get('exhibitors', []):
            if ex.get('logoUrl'): urls.append(ex['logoUrl'])
        for sp in data.get('sponsors', []):
            if sp.get('logoUrl'): urls.append(sp['logoUrl'])
    except Exception as e:
        print(f"[ImgCache] Subpage preload read error: {e}")
    await _bulk_download_parallel(list(dict.fromkeys(filter(None, urls))))

# ── Background Sync / Local Database ──────────────────────────────────────────

from tools.supabase_client import supabase

def _load_sync_settings():
    try:
        res = supabase.table("sync_settings").select("*").eq("id", 1).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"Error loading sync settings from Supabase: {e}")
    return {"disabled_communities": [], "disabled_events": [], "sync_interval_minutes": 60}

async def _sync_all_data_task(force_refresh: bool = False):
    """Performs a full sync of Swapcard events and saves to Supabase."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sync] Starting events-only background sync...")
    try:
        # 0. Load settings from Supabase
        settings = _load_sync_settings()

        # 1. Fetch Swapcard events
        print("[Sync] Fetching Swapcard events via GraphQL...")
        result = get_events.get_events(settings=settings)
        events_by_cat = result.get("events", {})

        # 2. Skip Subpages for now (Requested: "Concentrate only on the swap card events. Don't search subpages yet")
        # print("[Sync] Skipping subpage data (per user request)...")
        # _sync_subpages_to_supabase(all_events_flat, force_refresh=force_refresh)
        
        # 3. Upsert Events to Supabase
        print("[Sync] Upserting events to Supabase...")

        for category, events in events_by_cat.items():
            for ev in events:
                eid = ev["id"]

                # Calculate registrations from groups (available in event metadata)
                registrations = sum(group.get("peopleCount", 0) for group in ev.get("groups", []))

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
                    "leads_count": 0, # Skip for now
                    "members_count": 0, # Skip for now
                    "begins_at": ev.get("beginsAt"),
                    "ends_at": ev.get("endsAt"),
                    "banner_url": (ev.get("banner") or {}).get("imageUrl"),
                    "city": (ev.get("address") or {}).get("city"),
                    "country": (ev.get("address") or {}).get("country"),
                    "community_id": (ev.get("community") or {}).get("id"),
                    "community_name": (ev.get("community") or {}).get("name"),
                    "community_logo_url": (ev.get("community") or {}).get("logoUrl"),
                    "community_banner_url": (ev.get("community") or {}).get("bannerImageUrl"),
                    "is_live": ev.get("isLive", False),
                    "is_public": ev.get("isPublic", True),
                    "description_html": ev.get("htmlDescription")
                }

                supabase.table("swapcard_events").upsert(upsert_data).execute()
        
        # 4. Skip Airtable for now (Requested: "Concentrate only on the swap card events")
        # print("[Sync] Skipping Airtable sync (per user request)...")
        
        # 5. Preload images
        print("[Sync] Preloading image assets...")
        # Collect URLs for preloading
        all_urls = []
        for cat, evs in events_by_cat.items():
            for ev in evs:
                if ev.get("banner", {}).get("imageUrl"): all_urls.append(ev["banner"]["imageUrl"])
                if ev.get("community", {}).get("logoUrl"): all_urls.append(ev["community"]["logoUrl"])
        if all_urls:
            await _bulk_download_parallel(list(set(all_urls)))
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sync] Background sync completed successfully.")
    except Exception as e:
        print(f"[Sync] Full sync failed: {e}")
        import traceback
        traceback.print_exc()

async def _background_sync_loop():
    """Recurring task that syncs data on an interval."""
    # Sync on startup
    await _sync_all_data_task()

    while True:
        settings = _load_sync_settings()
        interval = settings.get("sync_interval_minutes", 60)
        # Minimum 5 minutes to avoid abuse
        sleep_mins = max(5, interval)
        
        # Wait for next interval
        await asyncio.sleep(sleep_mins * 60)
        await _sync_all_data_task()

# ── FastAPI lifespan: preload images on startup ──────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(application):
    # Startup: preload all images and start sync loop (only if NOT on Vercel)
    if not os.environ.get("VERCEL"):
        print("[Lifespan] Not on Vercel, starting background sync loop...")
        asyncio.create_task(_background_sync_loop())
    else:
        print("[Lifespan] Running on Vercel, skipping background sync loop (managed by Cron).")
    yield
    # Shutdown: nothing to do

app.router.lifespan_context = lifespan

async def _download_and_cache(url: str) -> Path | None:
    """Downloads a URL and saves it to img_cache/. Returns path or None on error."""
    dest = _cache_path(url)
    if dest.exists():
        return dest
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            await _download_one(client, url)
        return _cache_path(url) if _cache_path(url).exists() else None
    except Exception as e:
        print(f"[ImgCache] Failed to download {url}: {e}")
    return None

@app.get("/api/img")
async def proxy_image(url: str = Query(..., description="External image URL to proxy/cache")):
    """Returns the image from local cache (downloads first if needed)."""
    if not url:
        return Response(status_code=400)
    dest = _cache_path(url)
    if not dest.exists():
        dest = await _download_and_cache(url)
    if dest and dest.exists():
        mime, _ = mimetypes.guess_type(str(dest))
        return FileResponse(str(dest), media_type=mime or "image/png",
                            headers={"Cache-Control": "public, max-age=604800"})
    return Response(status_code=404)

class PreloadRequest(BaseModel):
    urls: list[str]

async def _bulk_download(urls: list[str]):
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        tasks = [_download_one(client, u) for u in urls if u]
        await asyncio.gather(*tasks)

@app.post("/api/img/preload")
async def preload_images(body: PreloadRequest, background_tasks: BackgroundTasks):
    """Accepts a list of URLs and downloads them to disk in the background."""
    fresh = [u for u in body.urls if u and not _cache_path(u).exists()]
    if fresh:
        background_tasks.add_task(_bulk_download, fresh)
    already = len(body.urls) - len(fresh)
    return {"status": "ok", "queued": len(fresh), "already_cached": already}

@app.get("/api/img/status")
async def image_cache_status():
    """Returns how many images are currently cached on disk."""
    files = list(IMG_CACHE_DIR.glob("*"))
    total_mb = sum(f.stat().st_size for f in files) / (1024 * 1024)
    return {"cached_files": len(files), "disk_mb": float(f"{total_mb:.2f}")}


# ── User Database ─────────────────────────────────────────────────────────────
USERS_PATH = os.path.join(os.path.dirname(__file__), "users.json")

def _load_users():
    try:
        res = supabase.table("users").select("*").execute()
        return res.data or []
    except Exception as e:
        print(f"Error loading users from Supabase: {e}")
        return []

def _safe_user(u):
    """Return user dict without the password_hash field."""
    return {k: v for k, v in u.items() if k != "password_hash"}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(req: LoginRequest):
    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    users = _load_users()
    user = next((u for u in users if u["username"].lower() == req.username.lower() and u["password_hash"] == pw_hash), None)
    if user:
        return JSONResponse(content={"status": "success", "user": _safe_user(user)})
    return JSONResponse(content={"status": "error", "message": "Invalid username or password"}, status_code=401)

@app.get("/api/users")
async def get_users():
    """Returns all users (without password hashes) for admin reference."""
    return JSONResponse(content={"status": "success", "data": [_safe_user(u) for u in _load_users()]})

class UpdateProfileRequest(BaseModel):
    user_id:          str
    current_password: str
    new_display_name: str = ""
    new_short_name:   str = ""
    new_role:         str = ""
    new_username:     str = ""
    new_password:     str = ""

@app.put("/api/users/update")
async def update_profile(req: UpdateProfileRequest):
    users = _load_users()
    # Find target user
    user = next((u for u in users if u["id"] == req.user_id), None)
    if not user:
        return JSONResponse(content={"status": "error", "message": "User not found"}, status_code=404)
    # Verify current password
    pw_hash = hashlib.sha256(req.current_password.encode()).hexdigest()
    if user["password_hash"] != pw_hash:
        return JSONResponse(content={"status": "error", "message": "Current password is incorrect"}, status_code=401)
    
    update_data = {}
    
    # Enforce username uniqueness (if changing)
    new_un = req.new_username.strip().lower()
    if new_un and new_un != user["username"].lower():
        if any(u["username"].lower() == new_un for u in users if u["id"] != req.user_id):
            return JSONResponse(content={"status": "error", "message": "Username already taken"}, status_code=409)
        update_data["username"] = req.new_username.strip()
        user["username"] = req.new_username.strip()
        
    # Apply optional changes
    if req.new_display_name.strip():
        update_data["display_name"] = req.new_display_name.strip()
        user["display_name"] = req.new_display_name.strip()
    if req.new_short_name.strip():
        update_data["short_name"] = req.new_short_name.strip()
        user["short_name"] = req.new_short_name.strip()
    if req.new_role.strip():
        update_data["role"] = req.new_role.strip()
        user["role"] = req.new_role.strip()
    if req.new_password.strip():
        update_data["password_hash"] = hashlib.sha256(req.new_password.strip().encode()).hexdigest()
        user["password_hash"] = update_data["password_hash"]
        
    # Persist
    if update_data:
        try:
            supabase.table("users").update(update_data).eq("id", req.user_id).execute()
        except Exception as e:
            return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
            
    return JSONResponse(content={"status": "success", "user": _safe_user(user)})

# Serve landing.html for the root
@app.get("/")
async def read_landing():
    print("[ROOT] Serving landing.html")
    return HTMLResponse(content=(BASE_DIR / "landing.html").read_text(encoding="utf-8"))

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard():
    return HTMLResponse(content=(BASE_DIR / "index.html").read_text(encoding="utf-8"))

@app.get("/login", response_class=HTMLResponse)
async def read_login_direct():
    # If users go to /login, they see the landing but we can trigger modal via query param if needed
    # For now, just landing.
    return HTMLResponse(content=(BASE_DIR / "landing.html").read_text(encoding="utf-8"))

# Define request models
class EventRequest(BaseModel):
    id: str

class PersonRequest(BaseModel):
    eventId: str
    email: str
    firstName: str
    lastName: str
    role: str

class ExhibitorRequest(BaseModel):
    id: str
    name: str

class CreatePersonRequest(BaseModel):
    eventId: str
    firstName: str
    lastName: str
    email: str = None
    jobTitle: str = None
    organization: str = None

class CreateExhibitorRequest(BaseModel):
    eventId: str
    name: str
    description: str = None

# API Endpoints
# Removed /api/events and /api/event as they are now handled by direct Supabase queries from the frontend.

from tools.mutations import create_event_person, create_event_exhibitor

@app.post("/api/person/create")
async def api_create_person(req: CreatePersonRequest):
    try:
        res = create_event_person(req.eventId, req.firstName, req.lastName, req.email, req.jobTitle, req.organization)
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/exhibitor/create")
async def api_create_exhibitor(req: CreateExhibitorRequest):
    try:
        res = create_event_exhibitor(req.eventId, req.name, req.description)
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# Removed /api/airtable and /api/airtable/sync as Airtable sync is part of background task and data is fetched via Supabase.

from tools import get_subpages

# Removed /api/subpages/stats

def _sync_subpages_to_supabase(events_list: list, force_refresh: bool = False):
    """Fetches subpage data for all events and syncs to normalized Supabase tables."""
    # fetch_all_subpages_data also writes to local disk (data/subpages/<id>/*.json)
    get_subpages.fetch_all_subpages_data(force_refresh=force_refresh)
    
    table_map = {
        'people': 'event_people',
        'plannings': 'event_planning',
        'exhibitors': 'event_exhibitors',
        'sponsors': 'event_sponsors'
    }
    
    for ev in events_list:
        eid = ev.get("id")
        if not eid:
            continue
            
        for data_type, table_name in table_map.items():
            records = get_subpages.get_event_subpage_data(eid, data_type)
            if not records:
                continue
            
            batch = []
            for r in records:
                rid = r.get('id')
                if not rid:
                    continue
                
                row = {
                    "id": rid,
                    "event_id": eid,
                    "data": r,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Extract fields for normalization
                if data_type == 'exhibitors':
                    if r.get('logoUrl'):
                        r['cachedLogoUrl'] = _local_url(r['logoUrl'])
                    booths = r.get('withEvent', {}).get('booths', [])
                    booth_name = booths[0].get('name') if booths else None
                    
                    # Industry extraction
                    industry = None
                    for f in r.get('fields', []):
                        if f.get('definition', {}).get('name') == 'Company Industry':
                            industry = f.get('multipleSelectValue') or f.get('selectValue') or f.get('textValue')
                            break
                    
                    leads = r.get('withEvent', {}).get('leads', {})
                    
                    row.update({
                        "name": r.get('name'),
                        "type": r.get('type'),
                        "logo_url": r.get('logoUrl'),
                        "website_url": r.get('websiteUrl'),
                        "booth": booth_name,
                        "email": r.get('email'),
                        "city": (r.get('address') or {}).get('city'),
                        "country": (r.get('address') or {}).get('country'),
                        "industry": industry,
                        "leads_scans": (leads or {}).get('scans', {}).get('totalCount', 0),
                        "leads_views": (leads or {}).get('views', {}).get('totalCount', 0),
                        "total_members": r.get('totalMembers', 0),
                        "created_at": r.get('createdAt')
                    })
                elif data_type == 'people':
                    row.update({
                        "first_name": r.get('firstName'),
                        "last_name": r.get('lastName'),
                        "organization": r.get('organization'),
                        "job_title": r.get('jobTitle'),
                        "email": r.get('email'),
                        "photo_url": r.get('photoUrl'),
                        "city": (r.get('address') or {}).get('city'),
                        "country": (r.get('address') or {}).get('country')
                    })
                elif data_type == 'plannings':
                    row.update({
                        "title": r.get('title'),
                        "begins_at": r.get('beginsAt'),
                        "start_time": r.get('beginsAt'),
                        "end_time": r.get('endsAt'),
                        "location_name": (r.get('place') or {}).get('name'),
                        "type": r.get('type'),
                        "format": r.get('format')
                    })
                elif data_type == 'sponsors':
                    row.update({
                        "name": r.get('name'),
                        "category": r.get('category'),
                        "type": r.get('type'),
                        "external_url": r.get('externalUrl'),
                        "logo_url": r.get('logoUrl')
                    })
                
                batch.append(row)
                
                if len(batch) >= 100:
                    try:
                        supabase.table(table_name).upsert(batch).execute()
                    except Exception as e:
                        print(f"[Sync] Failed batch for {table_name}: {e}")
                    batch = []
            
            if batch:
                try:
                    supabase.table(table_name).upsert(batch).execute()
                except Exception as e:
                    print(f"[Sync] Failed final batch for {table_name}: {e}")
                    
    print(f"[Sync] Normalized subpage data pushed to Supabase for {len(events_list)} events.")

@app.get("/api/subpages/{event_id}/{data_type}")
async def get_event_data_api(event_id: str, data_type: str):
    """Returns records for a specific event and type from Supabase (one row per event with JSONB data array)."""
    table_map = {
        'people': 'event_people',
        'plannings': 'event_planning',
        'exhibitors': 'event_exhibitors',
        'sponsors': 'event_sponsors'
    }

    table_name = table_map.get(data_type)
    if not table_name:
        return JSONResponse(content={"status": "error", "message": f"Unknown data type: {data_type}"}, status_code=400)

    try:
        # Query Supabase for single row with JSONB data array
        res = supabase.table(table_name) \
            .select("data, record_count, updated_at") \
            .eq("event_id", event_id) \
            .single() \
            .execute()

        if res.data and isinstance(res.data.get('data'), list):
            data = res.data['data']
            # Add cached logo URLs for exhibitors
            if data_type == 'exhibitors':
                for item in data:
                    if item.get('logoUrl'):
                        item['cachedLogoUrl'] = _local_url(item['logoUrl'])

            return JSONResponse(content={
                "status": "success",
                "data": data,
                "source": "supabase",
                "record_count": res.data.get('record_count', len(data)),
                "updated_at": res.data.get('updated_at')
            })
        else:
            return JSONResponse(content={"status": "success", "data": [], "source": "supabase"})

    except Exception as e:
        print(f"[API] Supabase lookup failed for {table_name}/{event_id}: {e}")
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# Removed /api/subpages

@app.post("/api/subpages/sync")
async def sync_subpages_live():
    """Forces a live fetch for all subpages data and pushes to Supabase."""
    try:
        settings = _load_sync_settings()
        result = get_events.get_events(settings=settings)
        events_by_cat = result.get("events", {})
        all_events_flat = [ev for evs in events_by_cat.values() for ev in evs]
        _sync_subpages_to_supabase(all_events_flat)
        return JSONResponse(content={
            "status": "success",
            "message": f"Subpage data synced for {len(all_events_flat)} events and pushed to Supabase.",
            "event_count": len(all_events_flat)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": str(e)})

@app.post("/api/subpages/sync-leap")
async def sync_leap_only():
    """Clears exhibitor data and fetches ONLY LEAP x DeepFest 2026 exhibitors using the full V2 query."""
    try:
        stats = get_subpages.fetch_leap_only()
        data = get_subpages.get_subpages_data()
        for ex in data.get('exhibitors', []):
            if ex.get('logoUrl'):
                ex['cachedLogoUrl'] = _local_url(ex['logoUrl'])
        return JSONResponse(content={"status": "success", "data": data, "stats": stats})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": str(e)})

# ── Activity Log ──────────────────────────────────────────────────────────────
from datetime import datetime, timezone

def _read_activity():
    try:
        res = supabase.table("activity_logs").select("*").order("timestamp", desc=True).limit(50).execute()
        return res.data or []
    except Exception as e:
        print(f"Error loading activity logs from Supabase: {e}")
        return []

class ActivityEntry(BaseModel):
    user: str
    action: str
    context: str
    timestamp: str = ""  # ISO 8601; server fills if empty

@app.get("/api/activity")
async def get_activity():
    return JSONResponse(content={"status": "success", "data": _read_activity()})

@app.post("/api/activity")
async def log_activity(entry: ActivityEntry):
    ts = entry.timestamp or datetime.now(timezone.utc).isoformat()
    new_entry = {
        "user_name": entry.user,
        "action": entry.action,
        "context": entry.context,
        "timestamp": ts
    }
    try:
        supabase.table("activity_logs").insert(new_entry).execute()
    except Exception as e:
        print(f"Error saving activity log: {e}")
    # Return matched format for frontend (which expects 'user', not 'user_name')
    frontend_entry = {"user": entry.user, "action": entry.action, "context": entry.context, "timestamp": ts}
    return JSONResponse(content={"status": "success", "entry": frontend_entry})



@app.post("/api/person")
async def upsert_person(req: PersonRequest):
    # Route via Layer 2
    result = navigation.route_action(
        "upsert_person", 
        eventId=req.eventId, 
        email=req.email, 
        firstName=req.firstName, 
        lastName=req.lastName, 
        role=req.role
    )
    return JSONResponse(content={"status": "success", "data": result})

@app.post("/api/exhibitor")
async def manage_exhibitor(req: ExhibitorRequest):
    # Route via Layer 2
    result = navigation.route_action("upsert_exhibitor", exhibitor_id=req.id, name=req.name)
    return JSONResponse(content={"status": "success", "data": result})

@app.get("/api/settings")
async def get_settings():
    """Returns current environment keys and sync filters."""
    import os
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding="utf-8") as f:
                for line in f:
                    if '=' in line:
                        k, v = line.strip().split('=', 1)
                        env_vars[k] = v
        except Exception: pass
    
    filters = _load_sync_settings()
            
    return JSONResponse(content={"status": "success", "keys": env_vars, "filters": filters})

@app.post("/api/settings/keys")
async def save_keys(req: Request):
    """Saves API keys directly to the .env file."""
    data = await req.json()
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    try:
        lines = [f"{k}={v}" for k, v in data.items() if v.strip()]
        with open(env_path, 'w', encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        return JSONResponse(content={"status": "success"})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# Removed /api/settings/filters as settings are now updated in Supabase directly from the frontend.

@app.post("/api/sync/manual")
async def trigger_manual_sync(background_tasks: BackgroundTasks):
    """Triggers a full sync in the background with forced refresh from Swapcard."""
    background_tasks.add_task(_sync_all_data_task, force_refresh=True)
    return JSONResponse(content={"status": "success", "message": "Manual sync triggered in background."})

@app.get("/api/cron/sync")
async def cron_sync_task(request: Request, background_tasks: BackgroundTasks):
    """Endpoint for Vercel Cron to trigger data sync."""
    auth_header = request.headers.get("Authorization")
    cron_secret = os.environ.get("CRON_SECRET")
    
    # Simple check for Cron secret if configured
    if cron_secret and auth_header != f"Bearer {cron_secret}":
        return JSONResponse({"status": "error", "message": "Unauthorized"}, status_code=401)
        
    print("[Cron] Synchronizing data...")
    # For Vercel, we might want to wait for it since the process will die after the request
    # but _sync_all_data_task is async, so we can just await it directly here.
    await _sync_all_data_task(force_refresh=True)
    return {"status": "success", "message": "Cron sync completed"}

@app.get("/api/communities")
async def get_communities():
    """Fetches full list of communities and events from Swapcard without filtering."""
    result = navigation.route_action("get_communities")
    return JSONResponse(content={"status": "success", "data": result})

# ── Claude AI Chat Integration ───────────────────────────────────────────────

class ScreenshotUploadRequest(BaseModel):
    image_data: str  # base64 encoded PNG

class CreateSessionRequest(BaseModel):
    session_id: str = None

@app.post("/api/claude/upload")
async def upload_screenshot(req: ScreenshotUploadRequest):
    """Upload screenshot for annotation, returns temp file path."""
    try:
        # Generate unique filename
        filename = f"{uuid.uuid4()}.png"
        filepath = SCREENSHOTS_DIR / filename

        # Decode base64 and save (remove data:image/png;base64, prefix)
        if ',' in req.image_data:
            image_bytes = base64.b64decode(req.image_data.split(',')[1])
        else:
            image_bytes = base64.b64decode(req.image_data)

        filepath.write_bytes(image_bytes)

        return JSONResponse({
            "status": "success",
            "filename": filename,
            "url": f"/img_cache/screenshots/{filename}"
        })
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Screenshot upload failed: {str(e)}"},
            status_code=500
        )

@app.post("/api/claude/sessions")
async def create_chat_session(req: CreateSessionRequest):
    """Create a new empty chat session."""
    try:
        session_id = req.session_id or str(uuid.uuid4())
        session_data = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "title": "New Chat",
            "messages": [],
            "context": {}
        }

        path = CHAT_SESSIONS_DIR / f"{session_id}.json"
        with open(path, 'w', encoding='utf-8') as f:
            _json.dump(session_data, f, indent=2)

        return JSONResponse({"status": "success", "session": session_data})
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Session creation failed: {str(e)}"},
            status_code=500
        )

@app.get("/api/claude/sessions")
async def list_chat_sessions():
    """List all chat sessions sorted by updated_at desc."""
    try:
        sessions = []
        for file in CHAT_SESSIONS_DIR.glob("*.json"):
            with open(file, 'r', encoding='utf-8') as f:
                data = _json.load(f)
                sessions.append({
                    "session_id": data["session_id"],
                    "title": data.get("title", "New Chat"),
                    "updated_at": data.get("updated_at"),
                    "message_count": len(data.get("messages", []))
                })

        sessions.sort(key=lambda x: x["updated_at"], reverse=True)
        return JSONResponse({"status": "success", "sessions": sessions})
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Failed to list sessions: {str(e)}"},
            status_code=500
        )

@app.get("/api/claude/sessions/{session_id}")
async def get_chat_session(session_id: str):
    """Get full session data including all messages."""
    try:
        path = CHAT_SESSIONS_DIR / f"{session_id}.json"
        if not path.exists():
            return JSONResponse(
                {"status": "error", "message": "Session not found"},
                status_code=404
            )

        with open(path, 'r', encoding='utf-8') as f:
            data = _json.load(f)

        return JSONResponse({"status": "success", "session": data})
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Failed to load session: {str(e)}"},
            status_code=500
        )

@app.delete("/api/claude/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """Delete a chat session permanently."""
    try:
        path = CHAT_SESSIONS_DIR / f"{session_id}.json"
        if path.exists():
            path.unlink()
        return JSONResponse({"status": "success"})
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Failed to delete session: {str(e)}"},
            status_code=500
        )

@app.get("/api/claude/chat")
async def claude_chat_stream(
    session: str = Query(...),
    message: str = Query(...),
    screenshot: str = Query(default=""),
    context: str = Query(default="{}")
):
    """SSE streaming endpoint for Claude chat with vision support."""

    # Check API key
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        return JSONResponse(
            {"status": "error", "message": "Claude API key not configured. Please add ANTHROPIC_API_KEY to .env file."},
            status_code=500
        )

    # Load session history
    session_path = CHAT_SESSIONS_DIR / f"{session}.json"
    if session_path.exists():
        with open(session_path, 'r', encoding='utf-8') as f:
            session_data = _json.load(f)
    else:
        # Create new session
        session_data = {
            "session_id": session,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "title": "New Chat",
            "messages": [],
            "context": {}
        }

    # Parse context
    try:
        context_data = _json.loads(context)
    except:
        context_data = {}

    # Build system prompt with context awareness
    current_page = context_data.get('current_page', 'dashboard')
    system_prompt = f"""You are Claude, an AI assistant integrated into SwapcardOS, an event management dashboard for Swapcard events.

Current Context:
- Page: {current_page}
- Time: {datetime.now(timezone.utc).isoformat()}

You have access to event data, exhibitor information, people records, and session schedules. When users share screenshots, analyze the UI elements and provide specific, actionable guidance.

Be concise, helpful, and specific to SwapcardOS functionality."""

    # Build Claude API messages array
    claude_messages = []

    # Add last 10 messages from history for context
    for msg in session_data.get("messages", [])[-10:]:
        claude_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    # Build current user message content
    user_content = []

    # Add screenshot if provided
    if screenshot:
        screenshot_path = BASE_DIR / screenshot.lstrip('/')
        if screenshot_path.exists():
            try:
                screenshot_bytes = screenshot_path.read_bytes()
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                user_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_b64
                    }
                })
            except Exception as e:
                print(f"Error loading screenshot: {e}")

    # Add text message
    user_content.append({
        "type": "text",
        "text": message
    })

    # Add current user message
    claude_messages.append({
        "role": "user",
        "content": user_content
    })

    # Save user message to session
    session_data["messages"].append({
        "role": "user",
        "content": message,
        "screenshot": screenshot if screenshot else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # SSE streaming generator
    async def event_generator():
        full_response = ""
        try:
            client = AsyncAnthropic(api_key=api_key)
            async with client.messages.stream(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                system=system_prompt,
                messages=claude_messages
            ) as stream:
                async for text in stream.text_stream:
                    full_response += text
                    yield {
                        "event": "message",
                        "data": _json.dumps({
                            "type": "content_block_delta",
                            "delta": {"text": text}
                        })
                    }

            # Send completion event
            yield {
                "event": "message",
                "data": _json.dumps({"type": "message_stop"})
            }

            # Save assistant response to session
            session_data["messages"].append({
                "role": "assistant",
                "content": full_response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            # Auto-generate title from first exchange
            if len(session_data["messages"]) == 2 and session_data["title"] == "New Chat":
                session_data["title"] = message[:50] + ("..." if len(message) > 50 else "")

            # Update session metadata
            session_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            session_data["context"] = context_data

            # Save updated session
            with open(session_path, 'w', encoding='utf-8') as f:
                _json.dump(session_data, f, indent=2)

            # Delete screenshot if provided
            if screenshot:
                screenshot_path = BASE_DIR / screenshot.lstrip('/')
                if screenshot_path.exists():
                    try:
                        screenshot_path.unlink()
                    except:
                        pass

        except Exception as e:
            yield {
                "event": "error",
                "data": _json.dumps({
                    "type": "error",
                    "message": str(e)
                })
            }

    return EventSourceResponse(event_generator())

# ── SPA Routes for client-side navigation ────────────────────────────────────
# Define explicit routes for each SPA view instead of catch-all
@app.get("/exhibitors", response_class=HTMLResponse)
@app.get("/people", response_class=HTMLResponse)
@app.get("/speakers", response_class=HTMLResponse)
@app.get("/sessions", response_class=HTMLResponse)
@app.get("/sponsors", response_class=HTMLResponse)
@app.get("/events", response_class=HTMLResponse)
@app.get("/settings", response_class=HTMLResponse)
async def spa_routes():
    """Serve index.html for SPA client-side routing"""
    return HTMLResponse(content=(BASE_DIR / "index.html").read_text(encoding="utf-8"))

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=3000, reload=True, access_log=True, log_level="info")

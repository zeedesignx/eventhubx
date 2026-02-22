import os
import json
import urllib.request
import urllib.error

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    except FileNotFoundError:
        pass

import datetime

def _fetch_all_raw_events():
    """Internal helper to fetch all events from Swapcard API without any filtering."""
    load_env()
    api_key = os.environ.get('SWAPCARD_API_KEY')
    if not api_key:
        raise ValueError("Missing API key")
        
    url = 'https://developer.swapcard.com/event-admin/graphql'
    query = """
    query GetEvents($page: Int!) {
      events(page: $page, pageSize: 100) {
        id
        slug
        title
        beginsAt
        endsAt
        createdAt
        banner { imageUrl }
        isLive
        isPublic
        totalPlannings
        totalExhibitors
        totalSpeakers
        groups { id name peopleCount }
        community { id name logoUrl bannerImageUrl }
        address { city country }
        htmlDescription
        updatedAt
      }
    }
    """
    
    events_list = []
    page = 1
    while True:
        data = json.dumps({'query': query, 'variables': {'page': page}}).encode('utf-8')
        req = urllib.request.Request(url, data=data)
        req.add_header('Authorization', str(api_key))
        req.add_header('Content-Type', 'application/json')
        
        try:
            response = urllib.request.urlopen(req)
            raw_data = json.loads(response.read().decode('utf-8'))
            batch = raw_data.get('data', {}).get('events', [])
            if not batch: break
            events_list.extend(batch)
            page += 1
            if page > 50: break
        except Exception: break
    return events_list

def get_raw_events():
    """Returns all events grouped by community for the settings page."""
    events = _fetch_all_raw_events()
    communities = {}
    for ev in events:
        c_name = (ev.get('community') or {}).get('name') or 'Other'
        if c_name not in communities:
            communities[c_name] = {
                "name": c_name,
                "banner": (ev.get('community') or {}).get('bannerImageUrl'),
                "logo": (ev.get('community') or {}).get('logoUrl'),
                "events": []
            }
        comm_events = communities[c_name].get("events")
        if isinstance(comm_events, list):
            comm_events.append({
                "id": ev.get("id"),
                "title": ev.get("title"),
                "isLive": ev.get("isLive")
            })
    return sorted(list(communities.values()), key=lambda x: x["name"])

def get_events(settings=None):
    """Returns filtered events based on settings (dict) or default hardcoded rules."""
    load_env()
    events_list = _fetch_all_raw_events()
    
    # If settings not provided, try to load from local file (legacy)
    if settings is None:
        settings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sync_settings.json')
        if os.path.exists(settings_path):
            try:
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
            except Exception: pass

    now = datetime.datetime.now(datetime.timezone.utc)
    filtered_events = {"Active": [], "Future": [], "Past": []}
    
    for ev in events_list:
        community_dict = ev.get('community') or {}
        community_name = community_dict.get('name') or ''
        title = ev.get('title') or ''
        ev_id = ev.get('id')

        # 1. Custom settings check
        if isinstance(settings, dict):
            # If specific event is disabled, skip
            if ev_id in settings.get('disabled_events', []): continue
            # If entire community is disabled, skip
            if community_name in settings.get('disabled_communities', []): continue
        else:
            # No settings yet, follow simple defaults (skip events without banners)
            if not ev.get('banner') or not ev.get('banner').get('imageUrl'): continue

        # Parse dates and categorize
        begins_at = now + datetime.timedelta(days=365)
        ends_at = now + datetime.timedelta(days=365)
        try:
            if ev.get('beginsAt'):
                dt = datetime.datetime.fromisoformat(ev['beginsAt'].replace('Z', '+00:00'))
                begins_at = dt.replace(tzinfo=datetime.timezone.utc) if dt.tzinfo is None else dt
            if ev.get('endsAt'):
                dt = datetime.datetime.fromisoformat(ev['endsAt'].replace('Z', '+00:00'))
                ends_at = dt.replace(tzinfo=datetime.timezone.utc) if dt.tzinfo is None else dt
        except Exception: pass
            
        if now > ends_at: filtered_events["Past"].append(ev)
        elif ev.get('isLive') or (begins_at <= now <= ends_at): filtered_events["Active"].append(ev)
        else: filtered_events["Future"].append(ev)
            
    # Metrics
    total_events_count = sum(len(lst) for lst in filtered_events.values())
    active_events_count = len(filtered_events["Active"])
    total_exhibitors_count = sum(int(ev.get("totalExhibitors") or 0) for cat in filtered_events for ev in filtered_events[cat])
    total_people_count = sum(int(g.get("peopleCount") or 0) for cat in filtered_events for ev in filtered_events[cat] for g in (ev.get("groups") or []))
                
    result = {
        "events": filtered_events,
        "metrics": {
            "totalEvents": total_events_count,
            "activeEvents": active_events_count,
            "totalExhibitors": total_exhibitors_count,
            "totalPeople": total_people_count
        }
    }

    return result

def get_cached_events(cache_path):
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception: pass
    return None

if __name__ == '__main__':
    print(get_events())

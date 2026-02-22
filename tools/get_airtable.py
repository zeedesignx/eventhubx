import os
import json
import urllib.request
import urllib.parse

TECH_STACK_TABLE_ID = 'tbllMBeBHgYPL12Ar'
EVENTS_TABLE_ID = 'tblFYq3SCOmVWIgxT'
PORTFOLIO_FIELD_ID = 'fldrPay6wUdVz2dtM'
EVENT_NAME_FIELD_ID = 'fldFvyGpbwQBdqRfB'

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def _fetch_all(url_base, api_key):
    """Paginate through all records from an Airtable endpoint."""
    records = []
    offset = None
    while True:
        params: dict = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        url = url_base + '?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {api_key}'})
        try:
            res = json.loads(urllib.request.urlopen(req).read())
        except Exception as e:
            print(f"Airtable fetch error: {e}")
            break
        records.extend(res.get('records', []))
        offset = res.get('offset')
        if not offset:
            break
    return records

def _build_techstack_lookup(api_key, base_id):
    """Fetch Tech Stack table and return {recordId: {name, website}} map."""
    url = f'https://api.airtable.com/v0/{base_id}/{TECH_STACK_TABLE_ID}'
    records = _fetch_all(url, api_key)
    lookup = {}
    for r in records:
        f = r['fields']
        name    = f.get('Name', r['id'])
        website = f.get('Website', '') or ''
        # Derive a clean domain for logo lookup
        domain = ''
        if website:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(website)
                domain = parsed.netloc.lstrip('www.')
            except Exception:
                pass
        lookup[r['id']] = {'name': name, 'website': website, 'domain': domain}
    return lookup

def get_airtable_events():
    # load_env removed
    api_key = os.environ.get('AIRTABLE_API_KEY')
    base_id = os.environ.get('AIRTABLE_BASE_ID')
    table_id = os.environ.get('AIRTABLE_TABLE_ID')

    if not api_key or not base_id or not table_id:
        raise ValueError("Missing Airtable credentials in .env")

    # Build Tech Stack ID -> Name lookup first
    tech_lookup = _build_techstack_lookup(api_key, base_id)

    # Save the lookup so front-end/debug can reference it
    lookup_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'techstack_lookup.json')
    with open(lookup_path, 'w', encoding='utf-8') as f:
        json.dump(tech_lookup, f, indent=2)

    # Fetch all event project records
    url = f'https://api.airtable.com/v0/{base_id}/{table_id}'
    raw_records = _fetch_all(url, api_key)

    results = []
    for r in raw_records:
        f = r.get('fields', {})
        name = f.get('Name', '')

        # Skip non-event records (no event dates = internal tasks, integrations etc.)
        if not name or not f.get('Event Start Date'):
            continue

        # Project leads (collaborator objects)
        leads = [p.get('name', '') for p in f.get('Project lead', []) if isinstance(p, dict)]

        # Progress: float 0.0–1.0 → "36%"
        progress_raw = f.get('Progress', 0) or 0
        progress_pct = f"{round(progress_raw * 100)}%"
        tasks_done  = f.get('Tasks Done', 0) or 0
        total_tasks = f.get('Total Tasks', 0) or 0

        # Tech Stack: list of record IDs → resolve to {name, domain} objects
        tech_ids   = f.get('Tech Stack', [])
        tech_items = []
        for tid in tech_ids:
            if isinstance(tid, str) and tid in tech_lookup:
                tech_items.append({
                    'name':   tech_lookup[tid]['name'],
                    'domain': tech_lookup[tid]['domain'],
                })
        tech_names = [t['name'] for t in tech_items]  # plain list kept for backward compat

        # Logo URL (first attachment)
        logo_url = None
        logos = f.get('Logo', [])
        if logos and isinstance(logos[0], dict):
            logo_url = logos[0].get('url')

        # Mockup URL (first attachment)
        mockup_url = None
        mockups = f.get('Mockup', [])
        if mockups and isinstance(mockups[0], dict):
            mockup_url = mockups[0].get('url')

        results.append({
            'record_id':                r['id'],
            'event_id':                 f.get('Event ID'),
            'name':                     name,
            'stage':                    f.get('Stage'),
            'project_lead':             leads,
            'type':                     f.get('Type', []),
            'event_start_date':         f.get('Event Start Date'),
            'event_end_date':           f.get('Event End Date'),
            'kickoff_date':             f.get('Kickoff date'),
            'planned_exhibitor_launch': f.get('Planned Exhibitor Launch') or f.get('EXH Launch'),
            'planned_visitor_launch':   f.get('Planned Visitor Launch') or f.get('VIS Launch'),
            'actual_exhibitor_launch':  f.get('Actual Exhibitor Launch'),
            'actual_visitor_launch':    f.get('Actual Visitor Launch'),
            'delayed_exh_launch':       f.get('Delayed EXH Launch'),
            'delayed_vis_launch':       f.get('Delayed VIS Launch'),
            'progress':                 progress_pct,
            'tasks_done':               tasks_done,
            'total_tasks':              total_tasks,
            'status_of_app':            f.get('Status of App'),
            'app_ready_date':           f.get('App Ready Date'),
            'last_modified':            f.get('Last modified'),
            'tech_stack':               tech_items,  # list of {name, domain}
            'logo_url':                 logo_url,
            'mockup_url':               mockup_url,
            'portfolio':                f.get('Portfolio', {}).get('name') if isinstance(f.get('Portfolio'), dict) else f.get('Portfolio'),
        })

    # Cache to disk
    cache_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'airtable_data.json')
    with open(cache_path, 'w', encoding='utf-8') as cf:
        json.dump(results, cf, indent=2)

    return results


def get_portfolio_mapping():
    # load_env removed
    api_key = os.environ.get('AIRTABLE_API_KEY')
    base_id = os.environ.get('AIRTABLE_BASE_ID')

    if not api_key or not base_id:
        raise ValueError("Missing Airtable credentials in .env")

    url = f'https://api.airtable.com/v0/{base_id}/{EVENTS_TABLE_ID}'
    raw_records = _fetch_all(url, api_key)

    mapping = []
    for r in raw_records:
        f = r.get('fields', {})
        name = f.get('Event Name')
        portfolio = f.get('Portfolio')
        
        if name and portfolio:
            mapping.append({
                'name': name,
                'portfolio': portfolio.get('name') if isinstance(portfolio, dict) else portfolio
            })
    return mapping


if __name__ == '__main__':
    data = get_airtable_events()
    print(f"Fetched {len(data)} Airtable records")
    for r in data:
        print(f"  {r['name']!r:45s} | {r.get('stage',''):12s} | {r['progress']:5s} | {r['status_of_app'] or '—':20s} | {r['tech_stack']}")

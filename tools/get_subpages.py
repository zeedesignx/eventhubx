import os, json, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from tools.get_events import get_events

env_path = '.env'
try:
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line:
                k, v = line.strip().split('=', 1)
                os.environ[k] = v
except Exception: pass

API_KEY = os.environ.get('SWAPCARD_API_KEY')
URL = 'https://developer.swapcard.com/event-admin/graphql'
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
if os.environ.get("VERCEL") == "1":
    DATA_DIR = "/tmp/data"

if not os.path.exists(DATA_DIR):
    try:
        os.makedirs(DATA_DIR)
    except Exception: pass

# Community mapping is now dynamically resolved from get_events()


def query_graphql(query, variables):
    req = urllib.request.Request(URL, data=json.dumps({'query': query, 'variables': variables}).encode('utf-8'))
    req.add_header('Authorization', API_KEY)
    req.add_header('Content-Type', 'application/json')
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.read().decode()}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

# ── Full ExhibitorsV2 Query ──────────────────────────────────────────────────
EXHIBITORS_V2_QUERY = '''
query ExhibitorsV2Query($communityId: ID!, $eventId: ID!, $cursor: CursorPaginationInput, $filter: CommunityExhibitorsFilterInput) {
  exhibitorsV2(communityId: $communityId, cursor: $cursor, filter: $filter) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      name
      email
      clientIds
      description
      htmlDescription
      logoUrl
      websiteUrl
      backgroundImageUrl
      createdAt
      updatedAt
      totalMembers
      type
      address {
        city
        country
        place
        state
        street
        zipCode
      }
      banner {
        imageUrl
      }
      phoneNumbers {
        countryCode
        formattedNumber
        label
        number
        type
      }
      socialNetworks {
        profile
        type
      }
      typeLabel {
        color
        elements
        id
        name
        position
        value
      }
      features {
        inviteMembers
        scanBadge
        scanBadgeOneWay
        qrCodeAccess
        qualifyLeads
        teamConnections
        recommendedLeads
        canViewVisits
        canExportContacts
        canExportMeetingsConfirmed
        canExportChats
        canExportExhibitorPages
        canExportExhibitorItems
        canExportAdvertisements
        canExportRegistrations
        canExportSessionScanning
        canExportWatchedExhibitorPlannings
        canExportDocuments
        generateApiKey
      }
      fields {
        ... on NumberField {
          id
          numberValue: value
          definition { id name isDefault isEditable isSearchable placeholder }
        }
        ... on UrlField {
          id
          urlValue: value
          definition { id name isDefault isEditable isSearchable placeholder }
        }
        ... on TextField {
          id
          textValue: value
          definition { id name isDefault isEditable isSearchable placeholder maxCharacters }
        }
        ... on LongTextField {
          id
          longTextValue: value
          definition { id name isDefault isEditable isSearchable placeholder maxCharacters }
        }
        ... on SelectField {
          id
          selectValue: value
          usage
          translations { value }
          definition { id name isDefault isEditable isSearchable placeholder }
        }
        ... on MultipleSelectField {
          id
          multipleSelectValue: value
          usage
          translations { value }
          definition { id name isDefault isEditable isSearchable placeholder maxChoices }
        }
        ... on MultipleTextField {
          id
          multipleTextValue: value
          definition { id name isDefault isEditable isSearchable placeholder maxCharacters maxChoices }
        }
        ... on DateField {
          id
          dateValue: value
          definition { id name isDefault isEditable isSearchable placeholder }
        }
        ... on MediaField {
          id
          mediaValue: value
          fileName
          definition { id name isDefault isEditable isSearchable placeholder }
        }
        ... on TreeField {
          id
          treeValue: value { path value }
          translations { value }
          definition { id name isDefault isEditable isSearchable placeholder maxChoices }
        }
      }
      members(page: 1, pageSize: 10) {
        firstName
        lastName
        email
        id
        jobTitle
        organization
        photoUrl
        userId
        websiteUrl
        biography
        addresses { city country place state street zipCode }
        phoneNumbers { countryCode formattedNumber label number type }
        socialNetworks { profile type }
        roles { id name description isDefault translations { name } permissions { id description } }
      }
      documents {
        id
        name
        description
        url
        embeddedUrl
        clientId
        totalExhibitors
        totalPlannings
      }
      editableFields {
        name
        address
        logoUrl
        description
        categories
        websiteUrl
        type
        socialNetworks
        phoneNumbers
        booth
        email
        bannerImage
        bannerVideo
        backgroundImage
        advertisements
      }
      categoryLimits {
        limit
        category { id name imageUrl translations { name } }
      }
      linkedExhibitors {
        link { id childName parentName translations { childName parentName } }
      }
      withEvent(eventId: $eventId) {
        totalMembers
        booths { id name capacity category clientId isVirtual isBooth externalUrl totalMeetings }
        categoryLimits { limit category { id name imageUrl } }
        documents { id name description url embeddedUrl clientId totalExhibitors totalPlannings }
        fields {
          ... on NumberField { id numberValue: value }
          ... on UrlField { id urlValue: value }
          ... on TextField { id textValue: value }
          ... on LongTextField { id longTextValue: value }
          ... on SelectField { id selectValue: value usage }
          ... on MultipleSelectField { id multipleSelectValue: value usage }
          ... on MultipleTextField { id multipleTextValue: value }
          ... on DateField { id dateValue: value }
          ... on MediaField { id mediaValue: value fileName }
          ... on TreeField { id treeValue: value { path value } }
        }
        linkedExhibitors { link { id childName parentName } }
        members(page: 1, pageSize: 10) {
          firstName
          lastName
          email
          id
          jobTitle
          organization
          photoUrl
          userId
          websiteUrl
          biography
          addresses { city country place state street zipCode }
          phoneNumbers { countryCode formattedNumber label number type }
          socialNetworks { profile type }
          roles { id name description isDefault }
        }
        group {
          id
          name
          isDefault
          exhibitorCount
          peopleCount
          priority
          announcementMessage
        }
        leads {
          contacts { totalCount }
          meetings { totalCount }
          chats { totalCount }
          documents { totalCount }
          products { totalCount }
          advertisementViews { totalCount }
          advertisementOpen { totalCount }
          planningBookmarks { totalCount }
          views { totalCount }
          scans { totalCount }
          bookmarks { totalCount }
        }
      }
    }
  }
}
'''

def fetch_exhibitors_v2(community_id, event_id, filter_event_ids=None):
    """Fetch full exhibitor data using the exhibitorsV2 query with cursor pagination.

    Args:
        filter_event_ids: Optional list of event IDs to scope exhibitors to specific events.
    """
    all_nodes = []
    cursor_after = None
    page_size = 50
    page_num = 0

    while True:
        page_num += 1
        variables = {
            'communityId': community_id,
            'eventId': event_id,
            'cursor': {'first': page_size}
        }
        if filter_event_ids:
            variables['filter'] = {'eventIds': filter_event_ids}
        if cursor_after:
            variables['cursor']['after'] = cursor_after

        result = query_graphql(EXHIBITORS_V2_QUERY, variables)
        if not result or 'data' not in result or not result['data'].get('exhibitorsV2'):
            if result and 'errors' in result:
                print(f"  GraphQL errors on page {page_num}: {result['errors']}, retrying...")
                time.sleep(2)
                result = query_graphql(EXHIBITORS_V2_QUERY, variables)
                if not result or 'data' not in result or not result['data'].get('exhibitorsV2'):
                    print(f"  Retry failed on page {page_num}, stopping.")
                    break
            else:
                break

        v2_data = result['data']['exhibitorsV2']
        nodes = v2_data.get('nodes', [])
        total = v2_data.get('totalCount', 0)
        page_info = v2_data.get('pageInfo', {})

        all_nodes.extend(nodes)
        print(f"  Page {page_num}: fetched {len(nodes)} exhibitors ({len(all_nodes)}/{total})")

        if page_info.get('hasNextPage') and page_info.get('endCursor'):
            cursor_after = page_info['endCursor']
            time.sleep(0.5)  # Rate limit protection
        else:
            break

    print(f"  Total fetched: {len(all_nodes)} exhibitors for event {event_id}")
    return all_nodes


def fetch_for_event(event_id, community_id=None):
    # Fetch Data for a single event


    res = {
        'eventId': event_id,
        'exhibitors': [],
        'plannings': [],
        'sponsors': [],
        'people': []
    }

    # Exhibitors — use V2 if community mapping exists, else fallback to basic query
    if community_id:
        res['exhibitors'] = fetch_exhibitors_v2(community_id, event_id)
    
    # Fallback to basic if V2 produced nothing or no communityId
    if not res['exhibitors']:
        exhibitors_query = '''
        query GetExh($eventId: String!) { exhibitors(eventId: $eventId, page: 1, pageSize: 100) { id name logoUrl backgroundImageUrl description htmlDescription email websiteUrl type typeLabel { name } totalMembers } }
        '''
        exh_data = query_graphql(exhibitors_query, {'eventId': event_id})
        if exh_data and 'data' in exh_data and exh_data['data'].get('exhibitors'):
            res['exhibitors'] = exh_data['data']['exhibitors']

    # Plannings
    plannings_query_list = '''
    query GetPla($eventId: String!) { plannings(eventId: $eventId, page: 1, pageSize: 100) { id title type format beginsAt endsAt } }
    '''
    plannings_query_conn = '''
    query GetPla($eventId: String!) { plannings(eventId: $eventId, page: 1, pageSize: 100) { nodes { id title type format beginsAt endsAt } } }
    '''
    pla_data = query_graphql(plannings_query_list, {'eventId': event_id})
    if pla_data and 'data' in pla_data and pla_data['data'].get('plannings'):
        res['plannings'] = pla_data['data']['plannings']
    else:
        pla_data2 = query_graphql(plannings_query_conn, {'eventId': event_id})
        if pla_data2 and 'data' in pla_data2 and pla_data2['data'].get('plannings') and 'nodes' in pla_data2['data']['plannings']:
            res['plannings'] = pla_data2['data']['plannings']['nodes']

    # Sponsors
    sponsors_query = '''
    query GetSpo($eventId: String!) {
      sponsors(eventId: $eventId) {
        ... on Sponsor { id name category type externalUrl logoUrl }
      }
    }
    '''
    spo_data = query_graphql(sponsors_query, {'eventId': event_id})
    if spo_data and 'data' in spo_data and spo_data['data'].get('sponsors'):
        res['sponsors'] = spo_data['data']['sponsors']

    # People (using eventPerson nodes)
    people_query = '''
    query GetPeo($eventId: ID!) { eventPerson(eventId: $eventId, cursor: { first: 100 }) { nodes { id firstName lastName jobTitle organization email type photoUrl address { city country } } } }
    '''
    peo_data = query_graphql(people_query, {'eventId': event_id})
    if peo_data and 'data' in peo_data and peo_data['data'].get('eventPerson') and 'nodes' in peo_data['data']['eventPerson']:
        res['people'] = peo_data['data']['eventPerson']['nodes']

    return res

def fetch_all_subpages_data(force_refresh=False):
    events_data = get_events()
    event_dict = events_data.get('events', {})

    # Stats for the global preview (to keep dashboards fast)
    # Structure: eventId -> { exhibitorCount: X, leadsCount: Y, membersCount: Z, personCount: W, sessionsCount: K, sponsorsCount: L }
    global_stats = {}
    stats_path = os.path.join(DATA_DIR, 'subpages_stats.json')
    if os.path.exists(stats_path):
        try:
            with open(stats_path, 'r', encoding='utf-8') as f:
                global_stats = json.load(f)
        except Exception: pass

    # We determine which events to fetch vs reuse
    # Reusing logic: if folder data/subpages/{id} exists, skip fetching for Past events
    # UNLESS force_refresh is True
    events_to_fetch = []
    events_to_reuse = []

    for cat in ['Active', 'Future']:
        if cat in event_dict:
            events_to_fetch.extend(event_dict[cat])

    for cat in ['Past']:
        if cat in event_dict:
            for ev in event_dict[cat]:
                ev_dir = os.path.join(DATA_DIR, 'subpages', ev['id'].replace('=', '')) # Remove = for cleaner paths
                if os.path.exists(ev_dir) and not force_refresh:
                    events_to_reuse.append(ev)
                else:
                    events_to_fetch.append(ev)

    if force_refresh:
        print(f"Force Refresh enabled: Fetching ALL {len(events_to_fetch)} events.")
    else:
        print(f"Sync Strategy: Fetching {len(events_to_fetch)} active/new events, reusing {len(events_to_reuse)} past events.")

    def save_event_data(eid, data):
        # Create directory for event
        safe_eid = eid.replace('=', '')
        ev_dir = os.path.join(DATA_DIR, 'subpages', safe_eid)
        if not os.path.exists(ev_dir):
            os.makedirs(ev_dir)
        
        # Save specific types
        for t in ['exhibitors', 'people', 'sponsors', 'plannings']:
            with open(os.path.join(ev_dir, f'{t}.json'), 'w', encoding='utf-8') as f:
                json.dump(data.get(t, []), f)
        
        # Calculate stats for this event
        stats = {
            'exhibitorCount': len(data.get('exhibitors', [])),
            'personCount': len(data.get('people', [])),
            'sponsorsCount': len(data.get('sponsors', [])),
            'sessionsCount': len(data.get('plannings', [])),
            'leadsCount': 0,
            'membersCount': 0
        }
        
        for ex in data.get('exhibitors', []):
            # Total members across all exhibitors in this event
            stats['membersCount'] += (ex.get('withEvent', {}).get('totalMembers') or ex.get('totalMembers') or 0)
            
            # Total leads
            leads = ex.get('withEvent', {}).get('leads', {})
            if leads:
                stats['leadsCount'] += (leads.get('scans', {}).get('totalCount') or 0)
                stats['leadsCount'] += (leads.get('views', {}).get('totalCount') or 0)
                stats['leadsCount'] += (leads.get('contacts', {}).get('totalCount') or 0)
                stats['leadsCount'] += (leads.get('meetings', {}).get('totalCount') or 0)
                stats['leadsCount'] += (leads.get('bookmarks', {}).get('totalCount') or 0)
                stats['leadsCount'] += (leads.get('products', {}).get('totalCount') or 0)
        
        return eid, stats

    # 1. Fetch new data in parallel
    if events_to_fetch:
        print(f"Fetching subpage data for {len(events_to_fetch)} events in parallel...")
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(fetch_for_event, e['id'], (e.get('community') or {}).get('id')): e['id'] for e in events_to_fetch}
            for future in as_completed(futures):
                try:
                    data = future.result()
                    if not data: continue
                    eid, stats = save_event_data(data['eventId'], data)
                    global_stats[eid] = stats
                except Exception as e:
                    print(f"Error fetching subpages for event {futures[future]}: {e}")

    # 2. Update global stats manifest
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(global_stats, f, indent=2)

    print(f"Saved stats for {len(global_stats)} events to data/subpages_stats.json")

    return {
        'status': 'success',
        'events_fetched': len(events_to_fetch),
        'events_reused': len(events_to_reuse),
        'total_events_in_stats': len(global_stats)
    }

def fetch_leap_only():
    """Fetch exhibitor data ONLY for LEAP x DeepFest 2026 event using eventIds filter."""
    event_id = 'RXZlbnRfMjc3NzQ3Mw=='
    community_id = 'Q29tbXVuaXR5XzI0Mjg1'

    print(f"Fetching LEAP x DeepFest 2026 exhibitors (event-scoped V2 query)...")
    exhibitors = fetch_exhibitors_v2(community_id, event_id, filter_event_ids=[event_id])

    # Tag each exhibitor with the event ID
    for ex in exhibitors:
        ex['eventId'] = event_id

    # Clear and save only LEAP data
    with open(os.path.join(DATA_DIR, 'exhibitors.json'), 'w', encoding='utf-8') as f:
        json.dump(exhibitors, f, ensure_ascii=False)

    print(f"Saved {len(exhibitors)} LEAP exhibitors to data/exhibitors.json")
    return {'exhibitors': len(exhibitors)}

def get_subpages_stats():
    """Returns the global stats for all events (lightweight)."""
    stats_path = os.path.join(DATA_DIR, 'subpages_stats.json')
    if os.path.exists(stats_path):
        with open(stats_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def get_event_subpage_data(event_id, data_type):
    """Returns specific data (exhibitors, people, etc) for ONE event."""
    # Try event-specific path first
    safe_eid = event_id.replace('=', '')
    path = os.path.join(DATA_DIR, 'subpages', safe_eid, f'{data_type}.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    # Fallback to global data files (all events combined)
    global_path = os.path.join(DATA_DIR, f'{data_type}.json')
    if os.path.exists(global_path):
        print(f"[get_event_subpage_data] Using global {data_type}.json for event {event_id}")
        with open(global_path, 'r', encoding='utf-8') as f:
            all_data = json.load(f)
            # Filter by event_id if the data has an eventId field
            if all_data and isinstance(all_data, list) and len(all_data) > 0:
                # Check if items have event_id field
                if 'eventId' in all_data[0]:
                    filtered = [item for item in all_data if item.get('eventId') == event_id]
                    print(f"[get_event_subpage_data] Filtered {len(filtered)} from {len(all_data)} {data_type} for event {event_id}")
                    return filtered
                else:
                    # No event_id field, return all (assumes single-event file)
                    print(f"[get_event_subpage_data] Returning all {len(all_data)} {data_type} (no event filtering)")
                    return all_data

    return []

def get_subpages_data():
    """Legacy helper: Returns stats instead of full data to prevent app crash."""
    return get_subpages_stats()

def ensure_data():
    if not os.path.exists(os.path.join(DATA_DIR, 'exhibitors.json')):
        fetch_all_subpages_data()

if __name__ == '__main__':
    # Run full global sync for all events
    res = fetch_all_subpages_data()
    print("Done fetching everything:", res)

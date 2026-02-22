import os, json, urllib.request

API_KEY = os.environ.get('SWAPCARD_API_KEY')
if not API_KEY:
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    if k == 'SWAPCARD_API_KEY':
                        API_KEY = v
                        os.environ[k] = v
    except Exception: pass

URL = 'https://developer.swapcard.com/event-admin/graphql'

def query_graphql(query, variables):
    req = urllib.request.Request(URL, data=json.dumps({'query': query, 'variables': variables}).encode('utf-8'))
    req.add_header('Authorization', API_KEY)
    req.add_header('Content-Type', 'application/json')
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.read().decode('utf-8')}")
        raise e
    except Exception as e:
        raise e

def create_event_person(event_id: str, first_name: str, last_name: str, email: str = None, job_title: str = None, organization: str = None):
    query = '''
    mutation ImportPerson($eventId: ID!, $data: [ImportEventPersonInput!]!) {
        importEventPeople(eventId: $eventId, data: $data, validateOnly: false) {
            __typename
        }
    }
    '''
    person_data = {
        "firstName": first_name,
        "lastName": last_name,
        "isUser": False
    }
    if email: person_data["email"] = email
    if job_title: person_data["jobTitle"] = job_title
    if organization: person_data["organization"] = organization

    variables = {
        "eventId": event_id,
        "data": [{"create": person_data}]
    }
    return query_graphql(query, variables)

def create_event_exhibitor(event_id: str, name: str, description: str = None):
    query = '''
    mutation ImportExh($eventId: ID!, $exhibitors: [ImportEventExhibitorInput!]!) {
        importEventExhibitor(eventId: $eventId, exhibitors: $exhibitors, validateOnly: false) {
           __typename
        }
    }
    '''
    exh_data = {
        "name": name
    }
    if description: exh_data["description"] = description

    variables = {
        "eventId": event_id,
        "exhibitors": [{"create": exh_data}]
    }
    return query_graphql(query, variables)

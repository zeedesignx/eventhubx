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

def get_event(event_id):
    load_env()
    api_key = os.environ.get('SWAPCARD_API_KEY')
    if not api_key:
        raise ValueError("Missing API key")
        
    url = 'https://developer.swapcard.com/event-admin/graphql'
    # Base query for event info
    query = """
    query GetEvent($eventId: ID!) {
      event(id: $eventId) {
        id
        title
        timezone
      }
    }
    """
    
    data = json.dumps({'query': query, 'variables': {'eventId': event_id}}).encode('utf-8')
    req = urllib.request.Request(url, data=data)
    req.add_header('Authorization', str(api_key))
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', 'application/json')
    
    try:
        response = urllib.request.urlopen(req)
        return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
        return None

if __name__ == '__main__':
    # Test script usage
    pass

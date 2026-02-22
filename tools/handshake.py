import urllib.request
import urllib.error
import json
import os

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    except FileNotFoundError:
        print(f"Error: .env file not found at {env_path}")
        exit(1)

def verify_connection():
    api_key = os.environ.get('SWAPCARD_API_KEY')
    if not api_key:
        print("Error: SWAPCARD_API_KEY not found in .env")
        exit(1)

    url = 'https://developer.swapcard.com/event-admin/graphql'
    
    # Simple introspection query to verify access
    query = """
    query {
        __typename
    }
    """
    
    data = json.dumps({'query': query}).encode('utf-8')
    
    req = urllib.request.Request(url, data=data)
    req.add_header('Authorization', str(api_key))
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', 'application/json')

    print("Sending Handshake payload to Swapcard API...")

    tmp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.tmp')
    os.makedirs(tmp_dir, exist_ok=True)
    
    try:
        response = urllib.request.urlopen(req)
        response_body = response.read().decode('utf-8')
        print(f"Success! Status code: {response.getcode()}")
        
        # Save output to .tmp
        out_path = os.path.join(tmp_dir, 'handshake_response.json')
        with open(out_path, 'w') as f:
            f.write(response_body)
            
        print(f"Response saved to {out_path}")
        print("Response Content:")
        print(json.dumps(json.loads(response_body), indent=2))
        
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
        exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        exit(1)

if __name__ == '__main__':
    load_env()
    verify_connection()

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

def upsert_person(event_id, email, first_name, last_name, role):
    # Note: In a real implementation this would perform the exact GraphQL 
    # mutation required by Swapcard to create or update a user.
    load_env()
    api_key = os.environ.get('SWAPCARD_API_KEY')
    if not api_key:
        raise ValueError("Missing API key")
        
    print(f"Upserting person {first_name} {last_name} ({email}) for Event {event_id} with role {role}...")
    
    # Placeholder for the actual GraphQL Mutation
    # Swapcard docs note: Check if user exists, if not, create them.
    # It requires 'eventId', 'email', 'firstName', 'lastName'
    
    return {
        "status": "success",
        "message": f"Simulated Upsert for {email}",
        "person": {
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "role": role
        }
    }

if __name__ == '__main__':
    # Test script usage
    pass

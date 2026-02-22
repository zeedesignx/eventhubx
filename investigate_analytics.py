import os, sys, json, urllib.request

ANALYTICS_URL = "https://developer.swapcard.com/event-admin/export/analytics"

# Load env
env_path = ".env"
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

api_key = os.environ.get("SWAPCARD_API_KEY")

payload = {"event_ids": ["RXZlbnRfMjc3NzQ3Ng=="], "time_gt": "2024-02-23T12:27:19.000Z"}
req = urllib.request.Request(
    ANALYTICS_URL,
    data=json.dumps(payload).encode("utf-8"),
    method="POST"
)
req.add_header("Authorization", api_key)
req.add_header("Content-Type", "application/json")

count = 0
found_events = {}

with urllib.request.urlopen(req) as resp:
    for raw_line in resp:
        line = raw_line.strip()
        if not line: continue
        try:
            ev_obj = json.loads(line.decode("utf-8"))
            ev_name = ev_obj.get("event")
            
            if ev_name == "meeting_create":
                print(f"--- FULL OBJECT FOR {ev_name} ---")
                print(json.dumps(ev_obj, indent=2))
                found_events[ev_name] = True
                break
            
            count += 1
            if count % 10000 == 0:
                # print(f"DEBUG: Read {count} lines...")
                pass
                
            if count > 300000:
                print("DEBUG: Searched 300k lines, no meeting_create found.")
                break
        except Exception as e:
            pass





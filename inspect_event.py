from tools import get_events
import json

def inspect_leap():
    print("Fetching all raw events...")
    raw_events = get_events._fetch_all_raw_events()
    
    leap_matches = [ev for ev in raw_events if "LEAP" in ev.get("title", "").upper()]
    
    if leap_matches:
        print(f"Found {len(leap_matches)} LEAP-related events.")
        with open("leap_data_dump.json", "w", encoding="utf-8") as f:
            json.dump(leap_matches, f, indent=2)
        print("Detailed data dumped to leap_data_dump.json")
    else:
        print("No LEAP events found.")

if __name__ == "__main__":
    inspect_leap()

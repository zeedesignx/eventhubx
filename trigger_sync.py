"""
Triggers a full Swapcard → Supabase sync.
Run this after executing the SQL migration.
"""

import requests
import sys

print("="*80)
print("TRIGGERING SWAPCARD → SUPABASE SYNC")
print("="*80)
print()

try:
    print("[1/2] Checking if server is running...")
    response = requests.get("http://localhost:8000", timeout=5)
    print("  ✓ Server is running")
except Exception as e:
    print(f"  ✗ Server not running: {e}")
    print()
    print("Please start the server first:")
    print("  python main.py")
    sys.exit(1)

print()
print("[2/2] Triggering sync...")

try:
    response = requests.post("http://localhost:8000/api/sync/manual", timeout=300)

    if response.status_code == 200:
        print("  ✓ Sync triggered successfully!")
        print()
        print("="*80)
        print("SYNC IN PROGRESS")
        print("="*80)
        print()
        print("The sync is running in the background.")
        print("Check the server console for progress.")
        print()
        print("Once complete, refresh your dashboard to see the data!")
        sys.exit(0)
    else:
        print(f"  ✗ Sync failed: {response.status_code}")
        print(f"     {response.text}")
        sys.exit(1)

except Exception as e:
    print(f"  ✗ Error: {e}")
    sys.exit(1)

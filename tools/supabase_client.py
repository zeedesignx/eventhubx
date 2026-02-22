import os
from supabase import create_client, Client

# Attempt to load from .env if it exists (local dev)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Read from environment variables (works locally with .env or on Vercel/Supabase)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://liocnahgqtsztaebfuhj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2NuYWhncXRzenRhZWJmdWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTI0NzgsImV4cCI6MjA4NzE2ODQ3OH0.Y2rvnPAh0V6sjBDOqRyD-tSKFG29HMOwi8BMTEEa9Sw")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[Supabase] Warning: Missing SUPABASE_URL or SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

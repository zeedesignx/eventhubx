import os
from supabase import create_client, Client

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
def get_env_var(key, default=""):
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding="utf-8") as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.strip().split('=', 1)[1]
    return default

# Read from env if present, else fallback
SUPABASE_URL = get_env_var("SUPABASE_URL", "https://liocnahgqtsztaebfuhj.supabase.co")
SUPABASE_KEY = get_env_var("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2NuYWhncXRzenRhZWJmdWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTI0NzgsImV4cCI6MjA4NzE2ODQ3OH0.Y2rvnPAh0V6sjBDOqRyD-tSKFG29HMOwi8BMTEEa9Sw")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

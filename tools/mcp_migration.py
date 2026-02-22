"""
Uses Supabase MCP to execute SQL migration.
Adds stat columns and migrates data.
"""

import anthropic
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
        pass

load_env()

# Get API key
api_key = os.environ.get('ANTHROPIC_API_KEY')
if not api_key:
    print("ERROR: ANTHROPIC_API_KEY not found in .env file")
    exit(1)

client = anthropic.Anthropic(api_key=api_key)

# SQL to execute
migration_sql = """
-- Add stat columns
ALTER TABLE swapcard_events
ADD COLUMN IF NOT EXISTS registrations_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS exhibitors_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS speakers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sessions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS leads_count INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_swapcard_events_registrations ON swapcard_events(registrations_count);
CREATE INDEX IF NOT EXISTS idx_swapcard_events_exhibitors ON swapcard_events(exhibitors_count);
CREATE INDEX IF NOT EXISTS idx_swapcard_events_speakers ON swapcard_events(speakers_count);

-- Migrate existing data from stats JSONB
UPDATE swapcard_events
SET
    exhibitors_count = COALESCE((stats->>'exhibitorCount')::integer, 0),
    members_count = COALESCE((stats->>'membersCount')::integer, 0),
    speakers_count = COALESCE((stats->>'personCount')::integer, 0),
    sessions_count = COALESCE((stats->>'sessionsCount')::integer, 0),
    leads_count = COALESCE((stats->>'leadsCount')::integer, 0)
WHERE stats IS NOT NULL;

-- Calculate registrations from data JSONB
UPDATE swapcard_events
SET registrations_count = (
    SELECT COALESCE(SUM((group_item->>'peopleCount')::integer), 0)
    FROM jsonb_array_elements(COALESCE(data->'groups', '[]'::jsonb)) AS group_item
)
WHERE data->'groups' IS NOT NULL;
"""

print("="*80)
print("EXECUTING SQL MIGRATION VIA SUPABASE MCP")
print("="*80)
print()

# Use Claude with Supabase MCP to execute the SQL
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    tools=[
        {
            "type": "mcp",
            "server_name": "supabase"
        }
    ],
    messages=[
        {
            "role": "user",
            "content": f"""Execute this SQL migration on the Supabase database:

{migration_sql}

After executing, report back with:
1. How many columns were added
2. How many events were updated
3. Any errors encountered"""
        }
    ]
)

print("Response from Claude:")
print(response.content)
print()
print("="*80)

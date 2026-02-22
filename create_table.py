#!/usr/bin/env python3
"""Create dashboard_views table in Supabase"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.supabase_client import supabase

def create_dashboard_views_table():
    """Create the dashboard_views table in Supabase"""

    # Read the SQL
    sql_file = os.path.join(os.path.dirname(__file__), 'create_dashboard_views_table.sql')
    with open(sql_file, 'r') as f:
        sql = f.read()

    print('Creating dashboard_views table in Supabase...')
    print('=' * 60)

    try:
        # Check if table already exists
        result = supabase.table('dashboard_views').select('count', count='exact').execute()
        print(f'SUCCESS: Table already exists! Current record count: {result.count}')
        return True

    except Exception as e:
        error_msg = str(e)

        if 'Could not find the table' in error_msg or 'PGRST205' in error_msg:
            print('Table does not exist yet.')
            print('')
            print('MANUAL STEP REQUIRED:')
            print('Please execute this SQL in your Supabase SQL Editor:')
            print('')
            print('1. Go to: https://supabase.com/dashboard')
            print('2. Select your project')
            print('3. Click "SQL Editor" in the left sidebar')
            print('4. Click "+ New Query"')
            print('5. Paste and run the following SQL:')
            print('')
            print('-' * 60)
            print(sql)
            print('-' * 60)
            print('')
            print('6. After running the SQL, the table will be ready!')
            return False
        else:
            print(f'Error checking table: {error_msg}')
            return False

if __name__ == '__main__':
    create_dashboard_views_table()

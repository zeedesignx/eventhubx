"""
Pre-cache and resize Airtable logos (app icons + tech stack icons) for instant access.
Resizes images to small icon sizes and stores them locally in img_cache/airtable/
"""
import os
import json
import urllib.request
import hashlib
from PIL import Image
from io import BytesIO

# Directories
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CACHE_DIR = os.path.join(BASE_DIR, 'img_cache', 'airtable')
AIRTABLE_DATA_PATH = os.path.join(BASE_DIR, 'airtable_data.json')
TECH_LOOKUP_PATH = os.path.join(BASE_DIR, 'techstack_lookup.json')

# Icon sizes (small since they're only shown as icons)
APP_ICON_SIZE = (64, 64)  # Event app icons
TECH_ICON_SIZE = (32, 32)  # Tech stack logos

def ensure_cache_dir():
    """Create cache directory if it doesn't exist."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(os.path.join(CACHE_DIR, 'apps'), exist_ok=True)
    os.makedirs(os.path.join(CACHE_DIR, 'tech'), exist_ok=True)

def url_to_cache_filename(url):
    """Generate a consistent cache filename from URL."""
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:12]
    ext = '.png'  # Always save as PNG for consistency
    return f"{url_hash}{ext}"

def download_and_resize(url, target_size, output_path):
    """Download image from URL, resize it, and save to output_path."""
    try:
        print(f"  Downloading: {url[:80]}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=10)
        image_data = response.read()

        # Open image with PIL
        img = Image.open(BytesIO(image_data))

        # Convert to RGBA if needed
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA')

        # Resize with high-quality resampling
        img.thumbnail(target_size, Image.Resampling.LANCZOS)

        # Save as PNG
        img.save(output_path, 'PNG', optimize=True)
        print(f"  [OK] Saved: {output_path}")
        return True
    except Exception as e:
        print(f"  [ERROR] downloading {url[:80]}: {e}")
        return False

def cache_app_icons():
    """Cache all app icons (logo_url) from Airtable events."""
    if not os.path.exists(AIRTABLE_DATA_PATH):
        print("WARNING: airtable_data.json not found. Run tools/get_airtable.py first.")
        return 0

    with open(AIRTABLE_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"\n[APP ICONS] Caching {len(data)} app icons...")
    cached_count = 0

    for event in data:
        logo_url = event.get('logo_url')
        if not logo_url:
            continue

        cache_filename = url_to_cache_filename(logo_url)
        cache_path = os.path.join(CACHE_DIR, 'apps', cache_filename)

        # Skip if already cached
        if os.path.exists(cache_path):
            print(f"  [SKIP] Already cached: {event['name']}")
            cached_count += 1
            continue

        print(f"  [DOWNLOAD] {event['name']}")
        if download_and_resize(logo_url, APP_ICON_SIZE, cache_path):
            cached_count += 1

    print(f"[SUCCESS] Cached {cached_count} app icons\n")
    return cached_count

def cache_tech_stack_logos():
    """Cache all tech stack logos from Airtable + generate Clearbit/Google fallbacks."""
    if not os.path.exists(TECH_LOOKUP_PATH):
        print("WARNING: techstack_lookup.json not found. Run tools/get_airtable.py first.")
        return 0

    with open(TECH_LOOKUP_PATH, 'r', encoding='utf-8') as f:
        tech_lookup = json.load(f)

    print(f"\n[TECH STACK] Caching {len(tech_lookup)} tech stack logos...")
    cached_count = 0

    for tech_id, tech_data in tech_lookup.items():
        domain = tech_data.get('domain', '')
        name = tech_data.get('name', tech_id)

        if not domain:
            print(f"  [SKIP] No domain for {name}")
            continue

        # Try Clearbit logo first (best quality)
        clearbit_url = f"https://logo.clearbit.com/{domain}"
        cache_filename = f"tech_{hashlib.md5(domain.encode()).hexdigest()[:12]}.png"
        cache_path = os.path.join(CACHE_DIR, 'tech', cache_filename)

        # Skip if already cached
        if os.path.exists(cache_path):
            print(f"  [SKIP] Already cached: {name}")
            cached_count += 1
            continue

        print(f"  [DOWNLOAD] {name} ({domain})")

        # Try Clearbit first
        if download_and_resize(clearbit_url, TECH_ICON_SIZE, cache_path):
            cached_count += 1
            continue

        # Fallback to Google favicon
        google_favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
        if download_and_resize(google_favicon_url, TECH_ICON_SIZE, cache_path):
            cached_count += 1

    print(f"[SUCCESS] Cached {cached_count} tech stack logos\n")
    return cached_count

def generate_cache_manifest():
    """Generate a manifest JSON mapping URLs to local cache paths."""
    manifest = {
        'apps': {},
        'tech': {}
    }

    # Map app icons
    if os.path.exists(AIRTABLE_DATA_PATH):
        with open(AIRTABLE_DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for event in data:
            logo_url = event.get('logo_url')
            if logo_url:
                cache_filename = url_to_cache_filename(logo_url)
                cache_path = os.path.join(CACHE_DIR, 'apps', cache_filename)
                if os.path.exists(cache_path):
                    manifest['apps'][logo_url] = f'/img_cache/airtable/apps/{cache_filename}'

    # Map tech stack logos
    if os.path.exists(TECH_LOOKUP_PATH):
        with open(TECH_LOOKUP_PATH, 'r', encoding='utf-8') as f:
            tech_lookup = json.load(f)
        for tech_id, tech_data in tech_lookup.items():
            domain = tech_data.get('domain', '')
            if domain:
                cache_filename = f"tech_{hashlib.md5(domain.encode()).hexdigest()[:12]}.png"
                cache_path = os.path.join(CACHE_DIR, 'tech', cache_filename)
                if os.path.exists(cache_path):
                    # Store both Clearbit and Google favicon URLs
                    clearbit_url = f"https://logo.clearbit.com/{domain}"
                    google_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
                    local_path = f'/img_cache/airtable/tech/{cache_filename}'
                    manifest['tech'][clearbit_url] = local_path
                    manifest['tech'][google_url] = local_path
                    manifest['tech'][domain] = local_path  # Also map domain directly

    # Save manifest
    manifest_path = os.path.join(CACHE_DIR, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"[SUCCESS] Generated cache manifest: {manifest_path}")
    print(f"  - {len(manifest['apps'])} app icon mappings")
    print(f"  - {len(manifest['tech'])} tech stack logo mappings\n")

if __name__ == '__main__':
    print("=" * 70)
    print("AIRTABLE LOGO CACHE SYSTEM")
    print("=" * 70)

    ensure_cache_dir()

    # First fetch Airtable data if needed
    if not os.path.exists(AIRTABLE_DATA_PATH):
        print("\n[INFO] Fetching Airtable data first...")
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from get_airtable import get_airtable_events
        get_airtable_events()

    app_count = cache_app_icons()
    tech_count = cache_tech_stack_logos()
    generate_cache_manifest()

    print("=" * 70)
    print(f"[DONE] Cached {app_count} app icons + {tech_count} tech logos")
    print("=" * 70)

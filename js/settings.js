/* ────────────────────────────────────────────────────────────
 * settings.js — API keys, sync preferences, switchView
 * ──────────────────────────────────────────────────────────── */

async function openSettings() {
    switchView('settings');
    const listEl = document.getElementById('communities-list');
    listEl.innerHTML = `<div class="text-center py-12 text-slate-500 animate-pulse"><span class="material-symbols-outlined text-4xl block mb-2">hub</span>Fetching communities...</div>`;

    try {
        // 1. Fetch API keys from backend (stored in .env)
        const res = await fetch('/api/settings');
        const data = await res.json();

        // 2. Fetch Sync Settings from Supabase directly
        const { data: filters, error } = await window.supabaseClient
            .from('sync_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        if (data.status === 'success') {
            currentSettings = {
                ...data,
                filters: filters // Use filters from Supabase
            };
            renderSettings();
        }
    } catch (err) {
        console.error('[Settings] Error opening settings:', err);
        showToast('Error', 'Failed to load system settings.');
    }
}

async function saveAPIKeys() {
    const btn = document.getElementById('save-keys-btn');
    const spinner = document.getElementById('save-keys-spinner');
    const text = document.getElementById('save-keys-text');

    btn.disabled = true; spinner.classList.remove('hidden'); text.textContent = 'Saving...';

    const keys = {};
    ['SWAPCARD_API_KEY', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'ANTHROPIC_API_KEY'].forEach(id => {
        keys[id] = document.getElementById(`key-${id}`).value.trim();
    });

    try {
        const res = await fetch('/api/settings/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keys)
        });
        if ((await res.json()).status === 'success') {
            showToast('Success', 'API keys updated successfully.');
        }
    } catch (e) {
        showToast('Error', 'Failed to save keys.');
    } finally {
        btn.disabled = false; spinner.classList.add('hidden'); text.textContent = 'Save Keys';
    }
}

async function saveSyncFilters() {
    const btn = document.getElementById('save-filters-btn');
    const spinner = document.getElementById('save-filters-spinner');
    const text = document.getElementById('save-filters-text');

    btn.disabled = true; spinner.classList.remove('hidden'); text.textContent = 'Updating...';

    try {
        // Update Supabase directly
        const { error } = await window.supabaseClient
            .from('sync_settings')
            .update({
                disabled_communities: currentSettings.filters.disabled_communities,
                disabled_events: currentSettings.filters.disabled_events,
                sync_interval_minutes: currentSettings.filters.sync_interval_minutes
            })
            .eq('id', 1);

        if (error) throw error;

        showToast('Success', 'Sync preferences saved.');
        await logActivity(currentUser.short_name, 'Updated sync filters', 'System');
    } catch (e) {
        console.error('[Settings] Error saving filters:', e);
        showToast('Error', 'Failed to save filters.');
    } finally {
        btn.disabled = false; spinner.classList.add('hidden'); text.textContent = 'Save Sync Preferences';
    }
}

async function saveSyncInterval() {
    const select = document.getElementById('sync-interval-select');
    const interval = parseInt(select.value);

    try {
        // Update Supabase directly
        const { error } = await window.supabaseClient
            .from('sync_settings')
            .update({ sync_interval_minutes: interval })
            .eq('id', 1);

        if (error) throw error;

        showToast('Success', `Sync interval updated to ${interval} minutes.`);
        await logActivity(currentUser.short_name, `Updated sync interval to ${interval}m`, 'System');

        // Update local state too
        if (currentSettings && currentSettings.filters) {
            currentSettings.filters.sync_interval_minutes = interval;
        }
    } catch (e) {
        console.error('[Settings] Error updating sync interval:', e);
        showToast('Error', 'Failed to update sync interval.');
    }
}

async function triggerManualSync() {
    const btn = document.getElementById('manual-sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Syncing...';

    try {
        const res = await fetch('/api/sync/manual', { method: 'POST' });
        const d = await res.json();
        if (d.status === 'success') {
            showToast('Sync Triggered', 'Full database refresh started in background.');
            await logActivity(currentUser.short_name, 'Triggered manual full sync', 'System');
        }
    } catch (e) {
        showToast('Error', 'Failed to trigger sync.');
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">sync</span> Refresh All Now';
        }, 3000);
    }
}

function switchView(view, push = true) {
    const views = ['dashboard', 'events', 'exhibitors', 'people', 'speakers', 'sessions', 'sponsors', 'settings'];



    // 1. Update UI
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');

        const nav = document.getElementById(`nav-${v}`);
        if (nav) {
            nav.classList.remove('bg-primary', 'text-white');
            nav.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-surface-hover');
        }
    });

    const activeEl = document.getElementById(`view-${view}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const activeNav = document.getElementById(`nav-${view}`);
    if (activeNav) {
        activeNav.classList.add('bg-primary', 'text-white');
        activeNav.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-surface-hover');
    }

    // Toggle AI panel for v2 based on view


    const titleMap = {
        'dashboard': 'Dashboard Overview',
        'events': 'Events Directory',
        'exhibitors': 'Exhibitors Management',
        'people': 'People Directory',
        'speakers': 'Speakers Roster',
        'sessions': 'Session & Agenda Planning',
        'sponsors': 'Sponsorships',
        'settings': 'System Settings'
    };
    const titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = titleMap[view] || 'EventHubX';

    // Hide/Show Global Event Filter based on view
    const filterContainer = document.getElementById('global-filter-container');
    if (filterContainer) {
        if (view === 'dashboard' || view === 'events') {
            filterContainer.classList.add('hidden');
            filterContainer.classList.remove('md:block');
        } else {
            filterContainer.classList.remove('hidden');
            filterContainer.classList.add('md:block');
        }
    }

    const subpages = ['exhibitors', 'people', 'speakers', 'sessions', 'sponsors'];
    if (subpages.includes(view) && typeof renderSubpageMocks === 'function') {
        renderSubpageMocks(view);
    } else if (view === 'events' && typeof renderAllEventsData === 'function') {
        renderAllEventsData();
    }

    // 2. Update History / URL
    if (push) {
        // Unified SPA routing: no more prefixing with /v2
        const path = view === 'dashboard' ? '/dashboard' : `/${view}`;
        history.pushState({ view }, '', path);
    }
}

// ── Handle Browser Navigation ────────────────────────────────────────────────
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        // Fallback to path parsing
        const path = window.location.pathname.replace(/\/$/, '').replace(/^\//, '');
        const views = ['dashboard', 'events', 'exhibitors', 'people', 'speakers', 'sessions', 'sponsors', 'settings'];
        if (views.includes(path) || path === '') {
            switchView(path || 'dashboard', false);
        } else {
            switchView('dashboard', false);
        }
    }
});
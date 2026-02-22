/* ────────────────────────────────────────────────────────────
 * app.js — Shared utilities, toast, init/bootstrap
 * ──────────────────────────────────────────────────────────── */

// generateSubpages() is called in DOMContentLoaded (after subpages.js is loaded)

// Globals are defined in config.js or implicitly on window
let currentTab = 'Active';

// Global Event Selector Change
function onGlobalEventFilterChange() {
    const select = document.getElementById('global-event-filter');
    if (!select) return;
    globalSelectedEventId = select.value;

    // Auto-refresh the current view if applicable
    if (typeof renderAllEventsData === 'function' && document.getElementById('view-events') && !document.getElementById('view-events').classList.contains('hidden')) {
        renderAllEventsData();
    }
    if (typeof generateSubpages === 'function') {
        const activeSubpageId = window.location.pathname.replace(/^\//, '') || 'dashboard';
        const validSubpages = ['exhibitors', 'people', 'speakers', 'sessions', 'sponsors'];
        if (validSubpages.includes(activeSubpageId)) {
            // Re-render the specific subpage if we are on it
            renderSubpageMocks(activeSubpageId);
        } else if (activeSubpageId === 'dashboard') {
            // If on dashboard, re-rendering events might be needed
            renderEvents();
        }
    }
}

function populateGlobalEventSelector() {
    const select = document.getElementById('global-event-filter');
    if (!select) return;
    select.innerHTML = '<option value="all" class="font-bold">All Events</option>';

    let allEvs = [];
    if (window.allEventsData) {
        Object.values(window.allEventsData).forEach(tabList => {
            tabList.forEach(e => {
                if (!allEvs.find(ev => ev.id === e.id)) {
                    allEvs.push(e);
                }
            });
        });

        allEvs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        const now = new Date();
        const active = [];
        const future = [];
        const past = [];

        allEvs.forEach(e => {
            const start = e.startDate ? new Date(e.startDate) : null;
            const end = e.endDate ? new Date(e.endDate) : null;

            if (!start && !end) {
                future.push(e); // default unknown to future or past, but usually future
            } else if (start && end && now >= start && now <= end) {
                active.push(e);
            } else if (end && now > end) {
                past.push(e);
            } else if (start && now < start) {
                future.push(e);
            } else {
                future.push(e);
            }
        });

        if (active.length > 0) {
            const group = document.createElement('optgroup');
            group.label = '🟢 Active Events';
            active.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.title;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }

        if (future.length > 0) {
            const group = document.createElement('optgroup');
            group.label = '🔵 Future Events';
            future.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.title;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }

        if (past.length > 0) {
            const group = document.createElement('optgroup');
            group.label = '⚪ Past Events';
            past.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.title;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }
    }

    // Safely re-apply selection
    const optionExists = Array.from(select.options).some(opt => opt.value === window.globalSelectedEventId);
    if (optionExists) {
        select.value = window.globalSelectedEventId;
    } else {
        select.value = 'all';
        window.globalSelectedEventId = 'all';
    }
}


// ── Auth ─────────────────────────────────────────────────────────────────
function applyUser(user) {
    currentUser = user;

    // Classic interface elements (sidebar)
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
        sidebarAvatar.textContent = user.initials;
        sidebarAvatar.className =
            `size-9 rounded-full bg-gradient-to-br ${user.avatar_color} flex items-center justify-center text-white text-xs font-bold shrink-0`;
    }

    const sidebarName = document.getElementById('sidebar-name');
    if (sidebarName) sidebarName.textContent = user.display_name;

    const sidebarRole = document.getElementById('sidebar-role');
    if (sidebarRole) sidebarRole.textContent = user.role;

    const userMenuName = document.getElementById('user-menu-name');
    if (userMenuName) userMenuName.textContent = user.display_name;

    const userMenuRole = document.getElementById('user-menu-role');
    if (userMenuRole) userMenuRole.textContent = user.role;

    // Modern interface elements (top nav)
    const topNavAvatar = document.getElementById('top-nav-avatar');
    if (topNavAvatar) topNavAvatar.textContent = user.initials;

    // Dashboard greeting (works for both interfaces)
    const greeting = document.querySelector('h1.text-3xl');
    if (greeting) greeting.innerHTML = `Welcome back, ${user.short_name} 👋`;
}






document.addEventListener('click', (e) => {
    // User Menu
    const menu = document.getElementById('user-menu');
    const userBtn = document.getElementById('sidebar-user-btn');
    if (menu && !menu.classList.contains('hidden')) {
        if (userBtn && !userBtn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    }

    // Exhibitor Settings Menu
    const exSettings = document.getElementById('ex-settings-dropdown');
    if (exSettings && !exSettings.classList.contains('hidden')) {
        // Find the button that toggles it (it has the tune icon)
        const toggleBtn = e.target.closest('button');
        const isToggleBtn = toggleBtn && toggleBtn.querySelector('.material-symbols-outlined')?.textContent === 'tune';

        if (!isToggleBtn && !exSettings.contains(e.target)) {
            exSettings.classList.add('hidden');
        }
    }
});



// ── Profile Management ──────────────────────────────────────────────────






// ── Password Management ──










// ── Server-Side Persistent Image Cache ──────────────────────────────────────
// All external images are routed through /api/img?url=... which downloads them
// to img_cache/ on disk. Once cached, they're served as static files instantly.
// Browser also caches with max-age=7days headers, so truly zero-wait after first load.

/**
 * Converts any external image URL into a localhost proxy URL.
 * Already-local URLs (starting with /) are returned unchanged.
 */
function imgUrl(url) {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('data:') || url.includes('supabase.co/storage')) return url;

    // Check Airtable cache first (app icons + tech logos)
    const cached = window.getCachedLogoUrl ? window.getCachedLogoUrl(url) : null;
    if (cached && cached !== url) return cached;  // Return cached local path

    return `/api/img?url=${encodeURIComponent(url)}`;
}

// Track what we've sent to the server for bulk preloading
const _queuedForServer = new Set();

/**
 * POSTs a list of external URLs to /api/img/preload.
 * Server downloads them to disk in the background (non-blocking).
 * Already-queued URLs are skipped.
 */
async function serverPreload(urls) {
    const fresh = urls.filter(u => u && !_queuedForServer.has(u));
    if (!fresh.length) return;
    fresh.forEach(u => _queuedForServer.add(u));
    try {
        const res = await fetch('/api/img/preload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: fresh })
        });
        const d = await res.json();
        console.log(`[ImgCache] Queued ${d.queued} new, ${d.already_cached} already cached.`);
    } catch (e) {
        console.warn('[ImgCache] Preload request failed:', e);
    }
}

/**
 * Collects all Airtable logo_url + tech stack logo URLs and sends them
 * to the server for background caching. Called after airtableData loads.
 */
function preloadAirtableImages() {
    if (!airtableData || !airtableData.length) return;

    const allUrls = [];
    airtableData.forEach(airEv => {
        if (airEv.logo_url) allUrls.push(airEv.logo_url);
        if (airEv.tech_stack && Array.isArray(airEv.tech_stack)) {
            airEv.tech_stack.forEach(tech => {
                const domain = typeof tech === 'string' ? '' : (tech.domain || '');
                if (domain) {
                    allUrls.push(`https://logo.clearbit.com/${domain}`);
                    allUrls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
                }
            });
        }
    });

    serverPreload(allUrls);
}

// Keep old name as alias for any existing call sites
const preloadTechLogos = preloadAirtableImages;




document.addEventListener('DOMContentLoaded', async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[App] 🚀 DOMContentLoaded fired - Starting initialization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');



    // 1. Generate subpage views (subpages.js must be loaded by now)
    console.log('[App] 📄 Generating subpage views');
    generateSubpages();

    // 2. Restore session FIRST (before routing)
    console.log('[App] 🔐 Checking for user session');
    const saved = sessionStorage.getItem('swapcard_user');
    if (!saved) {
        // No session exists, redirect to landing page (with loop prevention)
        console.log('[App] ❌ No session found, redirecting to landing');
        // Prevent infinite loop: only redirect if not already on root
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        } else {
            console.error('[App] 🔴 Already on root but index.html loaded - check routing!');
        }
        return;  // Stop execution
    }
    console.log('[App] ✅ Session found');

    // 3. URL Routing Logic (Handle direct entry to subpages)
    // Strip trailing slashes to correctly match valid views
    const path = window.location.pathname.replace(/\/$/, '').replace(/^\//, '');
    const validViews = ['dashboard', 'events', 'event-dashboard', 'exhibitors', 'people', 'speakers', 'sessions', 'sponsors', 'settings'];

    console.log('[App] 🧭 Current path:', window.location.pathname, '→ Parsed:', path);

    if (validViews.includes(path) || path === '') {
        const targetView = path || 'dashboard';
        console.log('[App] 🎯 Switching to view:', targetView);
        switchView(targetView, false);
    } else {
        console.log('[App] ⚠️  Invalid path, defaulting to dashboard');
        switchView('dashboard', false);
    }

    // 4. Apply user session (already validated above)
    console.log('[App] 👤 Applying user session');
    try {
        const user = JSON.parse(saved);
        applyUser(user);
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.add('hidden');
        console.log('[App] ✅ User session applied:', user.username);
    } catch {
        console.error('[App] ❌ Failed to parse session, clearing and redirecting');
        sessionStorage.removeItem('swapcard_user');
        window.location.href = '/';
        return;
    }

    // 5. Load all data
    console.log('[App] 📊 Starting data load sequence');
    console.log('[App] 📅 Loading events...');
    await loadEvents();
    // Apply default view if it exists
    if (typeof applyDefaultEventsView === 'function') applyDefaultEventsView();
    console.log('[App] 🗂️  Loading Airtable data...');
    await syncAirtable(true);
    // Re-render events once Airtable icons are definitely loaded
    console.log('[App] 🔄 Re-rendering events with Airtable data');
    if (typeof renderAllEventsData === 'function') renderAllEventsData();
    console.log('[App] 📋 Loading activity log');
    loadActivity();
    console.log('[App] ✅ Initialization complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});





// ── Activity Log helpers ──────────────────────────────────────────────






// ── Sync Result Modal ─────────────────────────────────────────────────
let _syncModalTimer = null;
let _syncModalBarTimer = null;

function showSyncModal({ title, subtitle, icon = 'sync', iconBg = 'bg-primary', stats = [], diffs = [], barColor = 'bg-primary' }) {
    clearTimeout(_syncModalTimer);
    clearInterval(_syncModalBarTimer);

    const modal = document.getElementById('sync-modal');
    document.getElementById('sync-modal-title').textContent = title;
    document.getElementById('sync-modal-subtitle').textContent = subtitle;
    document.getElementById('sync-modal-icon-sym').textContent = icon;
    document.getElementById('sync-modal-icon').className =
        `size-10 rounded-xl flex items-center justify-center text-white shrink-0 ${iconBg}`;

    // Stats row
    const statsEl = document.getElementById('sync-modal-stats');
    statsEl.innerHTML = stats.map(s => `
                <div class="flex flex-col items-center py-3 px-2 bg-background-dark/60 gap-0.5">
                    <span class="text-lg font-bold ${s.color || 'text-white'}">${s.value}</span>
                    <span class="text-[10px] text-slate-500 text-center leading-tight">${s.label}</span>
                </div>`).join('');
    statsEl.style.gridTemplateColumns = `repeat(${stats.length}, 1fr)`;

    // Diff tags
    const diffEl = document.getElementById('sync-modal-diff');
    const tagsEl = document.getElementById('sync-modal-diff-tags');
    if (diffs && diffs.length) {
        tagsEl.innerHTML = diffs.map(d =>
            `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${d.cls}">${d.icon} ${d.label}</span>`
        ).join('');
        diffEl.classList.remove('hidden');
    } else {
        diffEl.classList.add('hidden');
    }

    // Countdown bar
    const bar = document.getElementById('sync-modal-bar');
    bar.className = `h-1 rounded-full ${barColor}`;
    bar.style.width = '100%';
    bar.style.transition = 'none';
    document.getElementById('sync-countdown').textContent = '5';

    // Slide in
    modal.classList.remove('translate-x-[120%]', 'opacity-0');
    modal.classList.add('translate-x-0', 'opacity-100');

    // Animate countdown bar smoothly
    let remaining = 5000;
    const tick = 50;
    _syncModalBarTimer = setInterval(() => {
        remaining -= tick;
        const pct = Math.max(0, (remaining / 5000) * 100);
        bar.style.transition = `width ${tick}ms linear`;
        bar.style.width = pct + '%';
        document.getElementById('sync-countdown').textContent = Math.ceil(remaining / 1000);
        if (remaining <= 0) clearInterval(_syncModalBarTimer);
    }, tick);

    _syncModalTimer = setTimeout(() => closeSyncModal(), 5000);
}




















function showError(msg, detail = '') {
    document.getElementById('event-list-container').innerHTML = `
                <div class="text-center py-10 bg-red-500/10 rounded-xl border border-red-500/20">
                    <span class="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                    <h3 class="text-red-400 text-sm">${msg}</h3>
                    ${detail ? `<p class="text-red-400/70 text-xs mt-1 mb-0">${detail}</p>` : ''}
                </div>
            `;
}

// ── Settings Subpage ────────────────────────────────────────────────────
let currentSettings = { keys: {}, filters: { disabled_communities: [], disabled_events: [] } };
let allCommunities = [];





function renderSettings() {
    // Render Keys
    const container = document.getElementById('api-keys-container');
    container.innerHTML = '';
    const keyNames = [
        { id: 'SWAPCARD_API_KEY', label: 'Swapcard API Key' },
        { id: 'AIRTABLE_API_KEY', label: 'Airtable API Key' },
        { id: 'AIRTABLE_BASE_ID', label: 'Airtable Base ID' },
        { id: 'AIRTABLE_TABLE_ID', label: 'Airtable Table ID' },
        { id: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key (Claude)' }
    ];

    keyNames.forEach(k => {
        const val = currentSettings.keys[k.id] || '';
        container.innerHTML += `
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1.5">${k.label}</label>
                        <input id="key-${k.id}" type="text" value="${val}" class="w-full bg-background-dark border border-border-dark/60 focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all" />
                    </div>
                `;
    });

    // Set current sync interval
    const intervalSelect = document.getElementById('sync-interval-select');
    if (intervalSelect && currentSettings.filters && currentSettings.filters.sync_interval_minutes) {
        intervalSelect.value = currentSettings.filters.sync_interval_minutes;
    }



    // Trigger communities fetch
    fetchCommunities();
}

async function fetchCommunities() {
    try {
        const res = await fetch('/api/communities');
        const data = await res.json();
        if (data.status === 'success') {
            allCommunities = data.data;
            renderCommunitiesList();
        }
    } catch (e) {
        document.getElementById('communities-list').innerHTML = `<p class="text-red-400 text-sm">Error loading communities.</p>`;
    }
}

function renderCommunitiesList() {
    const container = document.getElementById('communities-list');
    container.innerHTML = '';

    allCommunities.forEach(c => {
        const isDisabled = (currentSettings.filters.disabled_communities || []).includes(c.name);
        const eventsHtml = c.events.map(ev => {
            const isEvDisabled = (currentSettings.filters.disabled_events || []).includes(ev.id);
            return `
                        <label class="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">event</span>
                                <span class="text-sm ${isEvDisabled ? 'text-slate-500 line-through' : 'text-slate-200'}">${ev.title}</span>
                            </div>
                            <input type="checkbox" ${!isEvDisabled ? 'checked' : ''} onchange="toggleEventFilter('${ev.id}', this.checked)" class="w-4 h-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary/40 focus:ring-offset-background-dark" />
                        </label>
                    `;
        }).join('');

        container.innerHTML += `
                    <div class="border border-border-dark/40 rounded-xl overflow-hidden bg-background-dark/20">
                        <div class="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-border-dark/40">
                            <div class="flex items-center gap-3">
                                ${c.logo ? `<img src="${imgUrl(c.logo)}" class="size-6 object-contain rounded" />` : `<span class="material-symbols-outlined text-slate-500">domain</span>`}
                                <span class="text-sm font-semibold ${isDisabled ? 'text-slate-500 line-through' : 'text-white'}">${c.name}</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">${c.events.length} Events</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-slate-500 italic">Sync Community</span>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" ${!isDisabled ? 'checked' : ''} onchange="toggleCommunityFilter('${c.name.replaceAll("'", "\\'")}', this.checked)" class="sr-only peer">
                                        <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="p-2 space-y-1">
                            ${eventsHtml}
                        </div>
                    </div>
                `;
    });
}

function toggleCommunityFilter(name, enabled) {
    let commList = currentSettings.filters.disabled_communities || [];
    let eventList = currentSettings.filters.disabled_events || [];

    if (enabled) {
        commList = commList.filter(n => n !== name);
        // Note: We don't force-enable events here to allow partial selection
    } else {
        if (!commList.includes(name)) commList.push(name);
        // Rule: If community turned off, turn off all its events
        const comm = allCommunities.find(c => c.name === name);
        if (comm) {
            comm.events.forEach(ev => {
                if (!eventList.includes(ev.id)) eventList.push(ev.id);
            });
        }
    }
    currentSettings.filters.disabled_communities = commList;
    currentSettings.filters.disabled_events = eventList;
    renderCommunitiesList();
}

function toggleEventFilter(id, enabled) {
    let eventList = currentSettings.filters.disabled_events || [];
    let commList = currentSettings.filters.disabled_communities || [];

    if (enabled) {
        eventList = eventList.filter(n => n !== id);
        // Rule: If event turned on, parent community MUST be on
        const parentComm = allCommunities.find(c => c.events.some(ev => ev.id === id));
        if (parentComm) {
            commList = commList.filter(n => n !== parentComm.name);
        }
    } else {
        if (!eventList.includes(id)) eventList.push(id);
    }
    currentSettings.filters.disabled_events = eventList;
    currentSettings.filters.disabled_communities = commList;
    renderCommunitiesList();
}





function showToast(title, sub) {
    const modal = document.getElementById('sync-modal');
    document.getElementById('sync-modal-title').textContent = title;
    document.getElementById('sync-modal-subtitle').textContent = sub;
    document.getElementById('sync-modal-stats').innerHTML = '';
    document.getElementById('sync-modal-diff').classList.add('hidden');

    modal.classList.replace('translate-x-[120%]', 'translate-x-0');
    modal.classList.replace('opacity-0', 'opacity-100');

    setTimeout(() => {
        modal.classList.replace('translate-x-0', 'translate-x-[120%]');
        modal.classList.replace('opacity-100', 'opacity-0');
    }, 3000);
}

// ── Actions & Forms ──────────────────────────────────────────────────────
function updateEventsUI() {
    const tabs = ['Active', 'All', 'Future', 'Past', 'Archive']; // IDs match HTML creation
    tabs.forEach(t => {
        const el = document.getElementById(`tab-ev-${t}`);
        if (el) {
            const isMatch = (t === eventsState.tab || (t === 'Archive' && eventsState.tab === 'Archived'));
            if (isMatch) {
                el.className = "px-3 py-1.5 text-xs font-medium text-white bg-surface-hover border border-border-dark/60 shadow-sm rounded-lg transition-colors whitespace-nowrap";
            } else {
                el.className = "px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap";
            }
        }
    });

    const tableBtn = document.getElementById('view-ev-table');
    const gridBtn = document.getElementById('view-ev-grid');
    if (tableBtn && gridBtn) {
        if (eventsState.view === 'table') {
            tableBtn.className = "p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip";
            gridBtn.className = "p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors tooltip";
        } else {
            gridBtn.className = "p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip";
            tableBtn.className = "p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors tooltip";
        }
    }
}











function populateEventSelects(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Select an Event...</option>';
    if (allEventsData) {
        Object.values(allEventsData).flat().forEach(e => {
            select.innerHTML += `<option value="${e.id}">${e.title}</option>`;
        });
    }
}













// ── Airtable Logo Cache System ───────────────────────────────────────────
window.airtableLogoCache = null;

async function loadAirtableLogoCache() {
    try {
        const res = await fetch('/img_cache/airtable/manifest.json');
        if (res.ok) {
            window.airtableLogoCache = await res.json();
            console.log('[AirtableCache] Loaded logo manifest:',
                window.airtableLogoCache.apps ? Object.keys(window.airtableLogoCache.apps).length : 0, 'apps,',
                window.airtableLogoCache.tech ? Object.keys(window.airtableLogoCache.tech).length : 0, 'tech logos');
        }
    } catch (e) {
        console.warn('[AirtableCache] Failed to load manifest:', e);
    }
}

// Helper to get cached logo URL (returns local path if cached, otherwise original URL)
window.getCachedLogoUrl = function (url) {
    if (!url) return '';
    if (!window.airtableLogoCache) return url;

    // Check apps cache
    if (window.airtableLogoCache.apps && window.airtableLogoCache.apps[url]) {
        return window.airtableLogoCache.apps[url];
    }

    // Check tech cache
    if (window.airtableLogoCache.tech && window.airtableLogoCache.tech[url]) {
        return window.airtableLogoCache.tech[url];
    }

    return url;  // Not cached, return original
};

// Load cache on page load
loadAirtableLogoCache();

// ── Event Dashboard ──────────────────────────────────────────────────────
let currentEventDashboardId = null;

// Initialize event dashboard when switching to that view
async function initEventDashboard() {
    console.log('[EventDashboard] Initializing dashboard');

    // Load saved configuration
    currentDashboardConfig = loadDashboardConfig();
    console.log('[EventDashboard] Loaded config:', currentDashboardConfig);

    // Ensure events data is loaded
    if (!window.allEventsData || Object.keys(window.allEventsData).length === 0) {
        console.log('[EventDashboard] Events data not loaded, fetching...');
        try {
            // Call the global loadEvents function from events.js
            if (typeof loadEvents === 'function') {
                await loadEvents();
                console.log('[EventDashboard] Events loaded:', Object.keys(window.allEventsData || {}).length, 'tabs');
            } else {
                console.error('[EventDashboard] loadEvents function not found');
            }
        } catch (error) {
            console.error('[EventDashboard] Failed to load events:', error);
        }
    } else {
        console.log('[EventDashboard] Events already loaded:', Object.keys(window.allEventsData).length, 'tabs');
    }

    // Populate event selector
    populateEventDashboardSelector();
}

function populateEventDashboardSelector() {
    const selector = document.getElementById('event-dashboard-selector');
    if (!selector) {
        console.error('[EventDashboard] Selector element not found');
        return;
    }

    // Get all events from allEventsData (organized by tabs)
    if (!window.allEventsData) {
        console.warn('[EventDashboard] window.allEventsData not available');
        selector.innerHTML = '<option value="">No events available</option>';
        return;
    }

    console.log('[EventDashboard] Populating selector from allEventsData:', Object.keys(window.allEventsData));

    // Flatten all events from all tabs
    const allEvents = [];
    Object.entries(window.allEventsData).forEach(([tabName, tabEvents]) => {
        console.log(`[EventDashboard] Tab "${tabName}":`, Array.isArray(tabEvents) ? `${tabEvents.length} events` : 'not an array');
        if (Array.isArray(tabEvents)) {
            tabEvents.forEach(evt => {
                // Avoid duplicates
                if (!allEvents.find(e => e.id === evt.id)) {
                    allEvents.push(evt);
                }
            });
        }
    });

    console.log(`[EventDashboard] Total unique events found: ${allEvents.length}`);

    if (allEvents.length === 0) {
        selector.innerHTML = '<option value="">No events available</option>';
        return;
    }

    // Sort events by name
    allEvents.sort((a, b) => {
        const nameA = a.eventName || a.title || a.name || '';
        const nameB = b.eventName || b.title || b.name || '';
        return nameA.localeCompare(nameB);
    });

    selector.innerHTML = '<option value="">Select an event...</option>' +
        allEvents.map(evt =>
            `<option value="${evt.id}">${evt.eventName || evt.title || evt.name || 'Unnamed Event'}</option>`
        ).join('');

    console.log('[EventDashboard] Selector populated with', allEvents.length, 'events');
}

async function loadEventDashboard() {
    const selector = document.getElementById('event-dashboard-selector');
    if (!selector) {
        console.error('[EventDashboard] Selector not found');
        return;
    }

    const eventId = selector.value;

    console.log('[EventDashboard] Loading dashboard for event:', eventId);

    if (!eventId) {
        showEventDashboardEmpty();
        return;
    }

    currentEventDashboardId = eventId;

    // Find the event data from allEventsData
    let event = null;
    if (window.allEventsData) {
        console.log('[EventDashboard] Searching through allEventsData tabs:', Object.keys(window.allEventsData));
        for (let tab in window.allEventsData) {
            const tabEvents = window.allEventsData[tab];
            if (Array.isArray(tabEvents)) {
                const found = tabEvents.find(e => e.id === eventId);
                if (found) {
                    event = found;
                    console.log('[EventDashboard] Found event in tab:', tab, event);
                    break;
                }
            }
        }
    } else {
        console.error('[EventDashboard] window.allEventsData not available');
    }

    if (!event) {
        console.error('[EventDashboard] Event not found for ID:', eventId);
        showEventDashboardEmpty();
        return;
    }

    // Update dashboard header
    const eventName = event.eventName || event.title || event.name || 'Event Dashboard';
    document.getElementById('event-dashboard-title').textContent = eventName;
    document.getElementById('event-dashboard-subtitle').textContent = `Analytics for ${eventName}`;

    // Show the dashboard grid
    document.getElementById('event-dashboard-empty').classList.add('hidden');
    document.getElementById('event-dashboard-grid').classList.remove('hidden');

    // Apply dashboard customization
    renderDashboardWithConfig();

    // Calculate and display metrics (await the async function)
    try {
        await updateEventDashboardMetrics(event);
    } catch (error) {
        console.error('[EventDashboard] Error updating metrics:', error);
    }
}

async function updateEventDashboardMetrics(event) {
    console.log('[EventDashboard] Loading metrics for event:', event.id);

    // Use the same data source as the Events module: window.allSubpagesStats
    const stats = (window.allSubpagesStats && window.allSubpagesStats[event.id]) || {};

    console.log('[EventDashboard] Stats from allSubpagesStats:', stats);

    // Extract all metrics from stats (same as Events module)
    const exhibitorsCount = stats.exhibitorCount || 0;
    const speakersCount = stats.personCount || 0;
    const sponsorsCount = stats.sponsorsCount || 0;
    const sessionsCount = stats.sessionsCount || 0;
    const membersCount = stats.membersCount || 0;
    const leadsCount = stats.leadsCount || 0;

    // Lead breakdown (from analytics columns)
    const totalLeads = stats.stats_total_leads || 0;
    const leadBookmarks = stats.stats_exhibitor_bookmarks || 0;
    const leadConnections = stats.stats_connections_made || 0;
    const leadScans = stats.stats_badges_scanned || 0;
    const leadContacts = stats.stats_business_cards_scanned || 0;
    const leadRequests = stats.stats_connection_requests_sent || 0;
    const leadMessages = stats.stats_messages_exchanged || 0;
    const leadMeetings = stats.stats_meetings_created || 0;
    const leadViews = stats.stats_exhibitor_views || 0;

    // Event-level metrics from event object
    const totalRegistrations = event.registrations_count || event.totalRegistrations || event.registrations || 0;
    const totalAttendees = event.totalAttendees || event.attendees || 0;

    // Booth count - try to get from event data
    const totalBooths = event.totalBooths || exhibitorsCount; // Fallback to exhibitor count

    console.log('[EventDashboard] Extracted metrics:', {
        exhibitorsCount,
        speakersCount,
        sponsorsCount,
        sessionsCount,
        membersCount,
        totalLeads,
        leadScans,
        leadViews,
        leadContacts,
        leadMeetings,
        totalRegistrations,
        totalAttendees
    });

    // Update primary stats (4 main cards)
    animateEventDashboardNumber('ed-exhibitors-count', exhibitorsCount);
    animateEventDashboardNumber('ed-leads-count', totalLeads);
    animateEventDashboardNumber('ed-speakers-count', speakersCount);
    animateEventDashboardNumber('ed-sponsors-count', sponsorsCount);

    // Update secondary stats (6 cards)
    animateEventDashboardNumber('ed-attendees-count', totalAttendees);
    animateEventDashboardNumber('ed-sessions-count', sessionsCount);
    animateEventDashboardNumber('ed-registrations-count', totalRegistrations);
    animateEventDashboardNumber('ed-booths-count', totalBooths);
    animateEventDashboardNumber('ed-members-count', membersCount);
    animateEventDashboardNumber('ed-views-count', leadViews);

    // Update lead breakdown stats (4 gradient cards)
    animateEventDashboardNumber('ed-scans-count', leadScans);
    animateEventDashboardNumber('ed-lead-views-count', leadViews);
    animateEventDashboardNumber('ed-contacts-count', leadContacts);
    animateEventDashboardNumber('ed-meetings-count', leadMeetings);

    // Update top panels: Active Users and Total Leads
    // Active Users calculation (based on attendees who have activity)
    const activeUsersCount = totalAttendees; // For now, using attendees as active users
    const totalUsersCount = totalRegistrations;
    const activeUsersPercent = totalUsersCount ? Math.round((activeUsersCount / totalUsersCount) * 100) || 0 : 0;

    animateEventDashboardNumber('ed-active-users-count', activeUsersCount);
    const activeUsersPercentEl = document.getElementById('ed-active-users-percent');
    const activeUsersBarEl = document.getElementById('ed-active-users-bar');
    if (activeUsersPercentEl) activeUsersPercentEl.textContent = activeUsersPercent + '%';
    if (activeUsersBarEl) activeUsersBarEl.style.width = activeUsersPercent + '%';

    // Total Leads
    animateEventDashboardNumber('ed-total-leads-count', totalLeads);

    // Update attendance rate (legacy - if still used elsewhere)
    const attendanceRate = totalRegistrations ? Math.round((totalAttendees / totalRegistrations) * 100) || 0 : 0;
    const attendanceRateEl = document.getElementById('ed-attendance-rate');
    const attendanceBarEl = document.getElementById('ed-attendance-bar');
    if (attendanceRateEl) attendanceRateEl.textContent = attendanceRate + '%';
    if (attendanceBarEl) attendanceBarEl.style.width = attendanceRate + '%';

    // Update speakers subtitle
    const speakersSubtitle = document.getElementById('ed-speakers-subtitle');
    if (speakersSubtitle) speakersSubtitle.textContent = `${sessionsCount} sessions scheduled`;

    // Load detailed exhibitor data for top exhibitors list
    let exhibitors = [];
    if (typeof ensureEventSubpageData === 'function') {
        exhibitors = await ensureEventSubpageData(event.id, 'exhibitors') || [];
        console.log('[EventDashboard] Loaded', exhibitors.length, 'exhibitors for top list');
    }

    // Update top exhibitors
    updateEventDashboardTopExhibitors(exhibitors);

    // Update activity feed with stats
    updateEventDashboardActivity(event, stats, exhibitors);

    console.log('[EventDashboard] Metrics updated successfully');
}

function animateEventDashboardNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const duration = 1000;
    const steps = 30;
    const stepValue = targetValue / steps;
    let currentValue = 0;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        currentValue = Math.min(Math.floor(stepValue * step), targetValue);
        element.textContent = currentValue.toLocaleString();

        if (step >= steps) {
            clearInterval(interval);
            element.textContent = targetValue.toLocaleString();
        }
    }, duration / steps);
}

function updateEventDashboardTopExhibitors(exhibitors) {
    const container = document.getElementById('ed-top-exhibitors');
    if (!container) return;

    // Sort by leads and take top 5
    const topExhibitors = exhibitors
        .map(ex => {
            // Calculate leads the same way as Events module
            const leads = ex.withEvent?.leads || ex.leads || {};
            const scans = leads.scans?.totalCount || leads.scans || 0;
            const views = leads.views?.totalCount || leads.views || 0;
            const contacts = leads.contacts?.totalCount || leads.contacts || 0;
            const meetings = leads.meetings?.totalCount || leads.meetings || 0;
            const bookmarks = leads.bookmarks?.totalCount || leads.bookmarks || 0;
            const leadsCount = parseInt(scans) + parseInt(views) + parseInt(contacts) + parseInt(meetings) + parseInt(bookmarks);

            return {
                ...ex,
                leadsCount: leadsCount
            };
        })
        .sort((a, b) => b.leadsCount - a.leadsCount)
        .slice(0, 5);

    if (topExhibitors.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-600">
                <span class="material-symbols-outlined text-4xl mb-2">storefront</span>
                <p class="text-sm">No exhibitor data available</p>
            </div>
        `;
        return;
    }

    const colors = ['primary', 'blue-400', 'emerald-400', 'amber-400', 'slate-400'];

    container.innerHTML = topExhibitors.map((ex, idx) => {
        const orgName = ex.organizationName || ex.organization || ex.company || ex.name || 'Unknown';
        const booth = ex.boothNumber || ex.booth || ex.stand || 'No booth';
        const industry = ex.industry || ex.category || ex.sector || 'General';

        return `
            <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer">
                <div class="size-8 rounded-lg bg-${colors[idx]}/20 flex items-center justify-center text-${colors[idx]} font-bold text-sm shrink-0">
                    ${idx + 1}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-white truncate">${orgName}</p>
                    <p class="text-xs text-slate-500">${booth} • ${industry}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-emerald-400">${ex.leadsCount}</p>
                    <p class="text-xs text-slate-500">leads</p>
                </div>
            </div>
        `;
    }).join('');
}

function updateEventDashboardActivity(event, exhibitors, speakers) {
    const container = document.getElementById('ed-activity-feed');
    if (!container) return;

    // Generate activity based on event data
    const activities = [];

    // Add some realistic activities from exhibitors
    const recentExhibitors = (exhibitors || []).slice(0, 2);

    recentExhibitors.forEach((ex, idx) => {
        const orgName = ex.organizationName || ex.organization || ex.company || 'Exhibitor';
        activities.push({
            type: 'lead',
            message: `${orgName} captured new leads`,
            time: `${(idx + 1) * 15} min ago`,
            icon: 'person_add',
            color: 'emerald-400'
        });
    });

    // Add speaker activities
    const recentSpeakers = (speakers || []).slice(0, 1);

    recentSpeakers.forEach(sp => {
        const name = `${sp.firstName || ''} ${sp.lastName || ''}`.trim() || sp.name || 'Speaker';
        activities.push({
            type: 'speaker',
            message: `${name} confirmed for session`,
            time: '45 min ago',
            icon: 'podium',
            color: 'blue-400'
        });
    });

    // Add system activity
    activities.push({
        type: 'system',
        message: `Event dashboard accessed`,
        time: 'Just now',
        icon: 'analytics',
        color: 'primary'
    });

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-600">
                <span class="material-symbols-outlined text-4xl mb-2">history</span>
                <p class="text-sm">No recent activity</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activities.map(activity => `
        <div class="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
            <div class="size-8 rounded-lg bg-${activity.color}/20 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-${activity.color} text-sm">${activity.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-300">${activity.message}</p>
                <p class="text-xs text-slate-500 mt-1">${activity.time}</p>
            </div>
        </div>
    `).join('');
}

function showEventDashboardEmpty() {
    document.getElementById('event-dashboard-empty').classList.remove('hidden');
    document.getElementById('event-dashboard-grid').classList.add('hidden');
    document.getElementById('event-dashboard-title').textContent = 'Event Dashboard';
    document.getElementById('event-dashboard-subtitle').textContent = 'Select an event to view detailed analytics';
}

async function refreshEventDashboard() {
    console.log('[EventDashboard] Refresh button clicked');

    if (!currentEventDashboardId) {
        console.warn('[EventDashboard] No event selected to refresh');
        return;
    }

    console.log('[EventDashboard] Refreshing dashboard for event:', currentEventDashboardId);

    // Clear the cache for this event to force fresh data
    if (window.eventSubpagesCache) {
        if (window.eventSubpagesCache[currentEventDashboardId]) {
            delete window.eventSubpagesCache[currentEventDashboardId];
            console.log('[EventDashboard] Cleared cache for event:', currentEventDashboardId);
        }
    } else {
        console.warn('[EventDashboard] eventSubpagesCache not initialized');
    }

    // Reload the dashboard
    try {
        await loadEventDashboard();
        console.log('[EventDashboard] Dashboard refreshed successfully');
    } catch (error) {
        console.error('[EventDashboard] Error refreshing dashboard:', error);
    }
}

// ── Dashboard Customization ──────────────────────────────────────────────────

// Stat descriptions mapping
const statDescriptions = {
    'exhibitors': 'Total registered',
    'leads': 'Captured leads',
    'speakers': 'Active speakers',
    'sponsors': 'Active sponsors',
    'attendees': 'Total attendees',
    'sessions': 'Event sessions',
    'registrations': 'Total registrations',
    'booths': 'Exhibition booths',
    'members': 'Community members',
    'views': 'Profile views',
    'scans': 'Lead scans',
    'lead-views': 'Profile views',
    'contacts': 'Contact exchanges',
    'meetings': 'Scheduled meetings',
    'top-exhibitors': 'Top performing exhibitors',
    'event-overview': 'Event metrics summary',
    'recent-activity': 'Latest activity feed'
};

// Render dashboard cards dynamically based on configuration
function renderDashboardCards() {
    console.log('[Dashboard] === renderDashboardCards START ===');
    console.log('[Dashboard] Config:', JSON.stringify(currentDashboardConfig, null, 2));

    // Render primary stats
    const primaryContainer = document.getElementById('primary-stats-container');
    console.log('[Dashboard] Primary container found:', !!primaryContainer);

    if (primaryContainer) {
        const visiblePrimaryStats = currentDashboardConfig.primaryStats.filter(stat => stat.visible);
        console.log('[Dashboard] Rendering', visiblePrimaryStats.length, 'primary stats:', visiblePrimaryStats.map(s => s.label));

        primaryContainer.innerHTML = visiblePrimaryStats
            .map(stat => {
                const size = stat.size || 'medium';
                const sizeClasses = {
                    small: 'p-3',
                    medium: 'p-5',
                    large: 'p-7'
                };
                const textSizeClasses = {
                    small: 'text-xl',
                    medium: 'text-3xl',
                    large: 'text-4xl'
                };
                return `
                <div class="bg-[#1a2332]/50 backdrop-blur-sm rounded-2xl border border-slate-700/30 ${sizeClasses[size]} hover:border-slate-600/50 transition-all">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-slate-400 text-xs font-bold uppercase tracking-wider">${stat.label}</span>
                        <span class="material-symbols-outlined text-${stat.color} text-xl">${stat.icon}</span>
                    </div>
                    <div class="${textSizeClasses[size]} font-black text-white" id="ed-${stat.id}-count">0</div>
                    <div class="text-xs text-slate-500 mt-2" id="ed-${stat.id}-subtitle">${statDescriptions[stat.id] || ''}</div>
                </div>
                `;
            }).join('');
    }

    // Render secondary stats
    const secondaryContainer = document.getElementById('secondary-stats-container');
    console.log('[Dashboard] Secondary container found:', !!secondaryContainer);

    if (secondaryContainer) {
        const visibleSecondaryStats = currentDashboardConfig.secondaryStats.filter(stat => stat.visible);
        console.log('[Dashboard] Rendering', visibleSecondaryStats.length, 'secondary stats:', visibleSecondaryStats.map(s => s.label));

        secondaryContainer.innerHTML = visibleSecondaryStats
            .map(stat => {
                const size = stat.size || 'small';
                const sizeClasses = {
                    small: 'p-3',
                    medium: 'p-4',
                    large: 'p-6'
                };
                const textSizeClasses = {
                    small: 'text-xl',
                    medium: 'text-2xl',
                    large: 'text-3xl'
                };
                return `
                <div class="bg-[#1a2332]/50 backdrop-blur-sm rounded-2xl border border-slate-700/30 ${sizeClasses[size]}">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="material-symbols-outlined text-${stat.color} text-lg">${stat.icon}</span>
                        <span class="text-slate-400 text-xs font-bold uppercase tracking-wider">${stat.label}</span>
                    </div>
                    <div class="${textSizeClasses[size]} font-black text-white" id="ed-${stat.id}-count">0</div>
                    <div class="text-xs text-slate-500 mt-1">${statDescriptions[stat.id] || ''}</div>
                </div>
                `;
            }).join('');
    }

    // Render lead breakdown stats
    const leadBreakdownContainer = document.getElementById('lead-breakdown-container');
    console.log('[Dashboard] Lead breakdown container found:', !!leadBreakdownContainer);

    if (leadBreakdownContainer) {
        const colorMap = {
            'primary': 'from-primary/10 to-primary/5 border-primary/20',
            'emerald-400': 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
            'blue-400': 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
            'purple-400': 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
            'amber-400': 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
            'cyan-400': 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
            'rose-400': 'from-rose-500/10 to-rose-600/5 border-rose-500/20',
            'indigo-400': 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
            'teal-400': 'from-teal-500/10 to-teal-600/5 border-teal-500/20',
            'orange-400': 'from-orange-500/10 to-orange-600/5 border-orange-500/20'
        };

        const visibleLeadStats = currentDashboardConfig.leadBreakdown.filter(stat => stat.visible);
        console.log('[Dashboard] Rendering', visibleLeadStats.length, 'lead breakdown stats:', visibleLeadStats.map(s => s.label));

        leadBreakdownContainer.innerHTML = visibleLeadStats
            .map(stat => {
                const size = stat.size || 'small';
                const sizeClasses = {
                    small: 'p-3',
                    medium: 'p-4',
                    large: 'p-6'
                };
                const textSizeClasses = {
                    small: 'text-xl',
                    medium: 'text-2xl',
                    large: 'text-3xl'
                };
                return `
                <div class="bg-gradient-to-br ${colorMap[stat.color] || 'from-slate-500/10 to-slate-600/5 border-slate-500/20'} backdrop-blur-sm rounded-2xl border ${sizeClasses[size]}">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="material-symbols-outlined text-${stat.color} text-lg">${stat.icon}</span>
                        <span class="text-slate-400 text-xs font-bold uppercase tracking-wider">${stat.label}</span>
                    </div>
                    <div class="${textSizeClasses[size]} font-black text-${stat.color}" id="ed-${stat.id}-count">0</div>
                    <div class="text-xs text-slate-500 mt-1">${statDescriptions[stat.id] || ''}</div>
                </div>
                `;
            }).join('');
    }

    // Render top dashboard panels (Event Overview only)
    const topPanelsContainer = document.getElementById('dashboard-top-panels-container');
    const bottomPanelsContainer = document.getElementById('dashboard-bottom-panels-container');
    console.log('[Dashboard] Top panels container found:', !!topPanelsContainer);
    console.log('[Dashboard] Bottom panels container found:', !!bottomPanelsContainer);

    // Ensure topPanels and bottomPanels exist
    if (!currentDashboardConfig.topPanels) {
        currentDashboardConfig.topPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.topPanels));
    }
    if (!currentDashboardConfig.bottomPanels) {
        currentDashboardConfig.bottomPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.bottomPanels));
    }

    const visibleTopPanels = currentDashboardConfig.topPanels.filter(panel => panel.visible);
    const visibleBottomPanels = currentDashboardConfig.bottomPanels.filter(panel => panel.visible);
    console.log('[Dashboard] Rendering', visibleTopPanels.length, 'top panels:', visibleTopPanels.map(p => p.label));
    console.log('[Dashboard] Rendering', visibleBottomPanels.length, 'bottom panels:', visibleBottomPanels.map(p => p.label));

    // Render Event Overview in top container (Active Users + Total Leads)
    if (topPanelsContainer) {
        const eventOverviewPanel = visibleTopPanels.find(p => p.id === 'event-overview');
        if (eventOverviewPanel) {
            topPanelsContainer.innerHTML = `
                <!-- Active Users Card -->
                <div class="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6 hover:border-emerald-500/40 transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div class="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <span class="material-symbols-outlined text-[20px]">person_check</span>
                        </div>
                        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Live</span>
                    </div>
                    <p class="text-slate-400 text-xs font-medium mb-0.5 uppercase tracking-wider">Active Users</p>
                    <div class="flex items-baseline gap-2 mb-3">
                        <h3 id="ed-active-users-count" class="text-3xl font-bold text-white tracking-tight">0</h3>
                        <span class="text-emerald-400 text-sm font-semibold" id="ed-active-users-percent">0%</span>
                    </div>
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Engagement Rate</div>
                    <div class="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                        <div id="ed-active-users-bar" class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" style="width: 0%"></div>
                    </div>
                </div>

                <!-- Total Leads Card -->
                <div class="bg-gradient-to-br from-rose-500/10 to-rose-600/5 backdrop-blur-sm rounded-2xl border border-rose-500/20 p-6 hover:border-rose-500/40 transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div class="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                            <span class="material-symbols-outlined text-[20px]">monitoring</span>
                        </div>
                        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">All Time</span>
                    </div>
                    <p class="text-slate-400 text-xs font-medium mb-0.5 uppercase tracking-wider">Total Leads</p>
                    <h3 id="ed-total-leads-count" class="text-3xl font-bold text-white tracking-tight mb-3">0</h3>
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider">Unique engagement actions attributed to this event</div>
                </div>
            `;
        } else {
            topPanelsContainer.innerHTML = '';
        }
    }

    // Render Top Exhibitors and Recent Activity in bottom container
    if (bottomPanelsContainer) {
        bottomPanelsContainer.innerHTML = visibleBottomPanels
            .map(panel => {
                if (panel.id === 'top-exhibitors') {
                    return `
                        <div class="bg-[#1a2332]/50 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6">
                            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span class="material-symbols-outlined text-${panel.color}">${panel.icon}</span>
                                ${panel.label}
                            </h3>
                            <div id="ed-top-exhibitors" class="space-y-3">
                                <div class="text-center py-8 text-slate-600">
                                    <span class="material-symbols-outlined text-4xl mb-2">storefront</span>
                                    <p class="text-sm">No exhibitor data available</p>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (panel.id === 'recent-activity') {
                    return `
                        <div class="bg-[#1a2332]/50 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6">
                            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span class="material-symbols-outlined text-${panel.color}">${panel.icon}</span>
                                ${panel.label}
                            </h3>
                            <div id="ed-activity-feed" class="space-y-3">
                                <div class="text-center py-8 text-slate-600">
                                    <span class="material-symbols-outlined text-4xl mb-2">history</span>
                                    <p class="text-sm">No recent activity</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
                return '';
            }).join('');
    }

    console.log('[Dashboard] Cards and panels rendered');
}

// Default dashboard configuration
const defaultDashboardConfig = {
    primaryStats: [
        { id: 'exhibitors', label: 'Exhibitors', icon: 'storefront', color: 'primary', visible: true, size: 'medium' },
        { id: 'leads', label: 'Total Leads', icon: 'trending_up', color: 'emerald-400', visible: true, size: 'medium' },
        { id: 'speakers', label: 'Speakers', icon: 'podium', color: 'blue-400', visible: true, size: 'medium' },
        { id: 'sponsors', label: 'Sponsors', icon: 'handshake', color: 'amber-400', visible: true, size: 'medium' }
    ],
    secondaryStats: [
        { id: 'attendees', label: 'Attendees', icon: 'groups', color: 'purple-400', visible: true, size: 'small' },
        { id: 'sessions', label: 'Sessions', icon: 'event', color: 'cyan-400', visible: true, size: 'small' },
        { id: 'registrations', label: 'Registrations', icon: 'app_registration', color: 'rose-400', visible: true, size: 'small' },
        { id: 'booths', label: 'Booths', icon: 'business', color: 'indigo-400', visible: true, size: 'small' },
        { id: 'members', label: 'Members', icon: 'person_add', color: 'teal-400', visible: true, size: 'small' },
        { id: 'views', label: 'Profile Views', icon: 'visibility', color: 'orange-400', visible: true, size: 'small' }
    ],
    leadBreakdown: [
        { id: 'scans', label: 'Scans', icon: 'qr_code_scanner', color: 'emerald-400', visible: true, size: 'small' },
        { id: 'lead-views', label: 'Views', icon: 'remove_red_eye', color: 'blue-400', visible: true, size: 'small' },
        { id: 'contacts', label: 'Contacts', icon: 'mail', color: 'purple-400', visible: true, size: 'small' },
        { id: 'meetings', label: 'Meetings', icon: 'calendar_month', color: 'amber-400', visible: true, size: 'small' }
    ],
    topPanels: [
        { id: 'event-overview', label: 'Event Overview', icon: 'analytics', color: 'emerald-400', visible: true, size: 'medium' }
    ],
    bottomPanels: [
        { id: 'top-exhibitors', label: 'Top Exhibitors', icon: 'emoji_events', color: 'primary', visible: true, size: 'medium' },
        { id: 'recent-activity', label: 'Recent Activity', icon: 'schedule', color: 'amber-400', visible: true, size: 'medium' }
    ]
};

// Load dashboard config from localStorage
function loadDashboardConfig() {
    const saved = localStorage.getItem('eventDashboardConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);

            // Migrate old "panels" structure to topPanels/bottomPanels
            if (config.panels && !config.topPanels && !config.bottomPanels) {
                config.topPanels = config.panels.filter(p => p.id === 'event-overview');
                config.bottomPanels = config.panels.filter(p => p.id !== 'event-overview');
                delete config.panels;
            }

            // Ensure topPanels and bottomPanels exist
            if (!config.topPanels) {
                config.topPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.topPanels));
            }
            if (!config.bottomPanels) {
                config.bottomPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.bottomPanels));
            }

            return config;
        } catch (e) {
            console.error('[Dashboard] Failed to parse saved config:', e);
        }
    }
    return JSON.parse(JSON.stringify(defaultDashboardConfig)); // Deep clone
}

// Save dashboard config to localStorage
function saveDashboardConfig(config) {
    localStorage.setItem('eventDashboardConfig', JSON.stringify(config));
}

// Current dashboard configuration
let currentDashboardConfig = loadDashboardConfig();

// Store loaded views globally for access
let loadedDashboardViews = [];

function openDashboardCustomizer() {
    try {
        console.log('[Dashboard] Opening customizer...');
        const modal = document.getElementById('dashboard-customizer-modal');
        if (!modal) {
            console.error('[Dashboard] Modal not found!');
            return;
        }

        console.log('[Dashboard] Current config:', currentDashboardConfig);

        // Populate customizer with current config
        populateTopPanelsCustomizer();
        populatePrimaryStatsCustomizer();
        populateSecondaryStatsCustomizer();
        populateLeadBreakdownCustomizer();
        populateBottomPanelsCustomizer();
        loadSavedViews();

        modal.classList.remove('hidden');
        console.log('[Dashboard] Customizer opened successfully');
    } catch (error) {
        console.error('[Dashboard] Error opening customizer:', error);
        alert('Error opening dashboard customizer: ' + error.message);
    }
}

function closeDashboardCustomizer() {
    const modal = document.getElementById('dashboard-customizer-modal');
    if (modal) modal.classList.add('hidden');
}

function populatePrimaryStatsCustomizer() {
    const container = document.getElementById('primary-stats-customizer');
    if (!container) return;

    // Filter out any null/undefined entries
    currentDashboardConfig.primaryStats = currentDashboardConfig.primaryStats.filter(stat => stat != null);

    container.innerHTML = currentDashboardConfig.primaryStats.map((stat, index) => `
        <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all" draggable="true" data-section="primary" data-index="${index}">
            <span class="material-symbols-outlined text-slate-500 cursor-move text-[16px]">drag_indicator</span>
            <div class="flex-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-${stat.color} text-[18px]">${stat.icon}</span>
                <span class="text-xs font-medium text-white">${stat.label}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${stat.visible ? 'checked' : ''} onchange="toggleStatVisibility('primary', ${index})" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    addDragAndDropListeners('primary');
}

function populateSecondaryStatsCustomizer() {
    const container = document.getElementById('secondary-stats-customizer');
    if (!container) return;

    // Filter out any null/undefined entries
    currentDashboardConfig.secondaryStats = currentDashboardConfig.secondaryStats.filter(stat => stat != null);

    container.innerHTML = currentDashboardConfig.secondaryStats.map((stat, index) => `
        <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all" draggable="true" data-section="secondary" data-index="${index}">
            <span class="material-symbols-outlined text-slate-500 cursor-move text-[16px]">drag_indicator</span>
            <div class="flex-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-${stat.color} text-[18px]">${stat.icon}</span>
                <span class="text-xs font-medium text-white">${stat.label}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${stat.visible ? 'checked' : ''} onchange="toggleStatVisibility('secondary', ${index})" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    addDragAndDropListeners('secondary');
}

function populateLeadBreakdownCustomizer() {
    const container = document.getElementById('lead-breakdown-customizer');
    if (!container) return;

    // Filter out any null/undefined entries
    currentDashboardConfig.leadBreakdown = currentDashboardConfig.leadBreakdown.filter(stat => stat != null);

    container.innerHTML = currentDashboardConfig.leadBreakdown.map((stat, index) => `
        <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all" draggable="true" data-section="leadBreakdown" data-index="${index}">
            <span class="material-symbols-outlined text-slate-500 cursor-move text-[16px]">drag_indicator</span>
            <div class="flex-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-${stat.color} text-[18px]">${stat.icon}</span>
                <span class="text-xs font-medium text-white">${stat.label}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${stat.visible ? 'checked' : ''} onchange="toggleStatVisibility('leadBreakdown', ${index})" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    addDragAndDropListeners('leadBreakdown');
}

function populateTopPanelsCustomizer() {
    const container = document.getElementById('top-panels-customizer');
    if (!container) return;

    // Ensure topPanels exist
    if (!currentDashboardConfig.topPanels) {
        currentDashboardConfig.topPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.topPanels));
    }

    // Filter out any null/undefined entries
    currentDashboardConfig.topPanels = currentDashboardConfig.topPanels.filter(panel => panel != null);

    container.innerHTML = currentDashboardConfig.topPanels.map((panel, index) => `
        <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all" draggable="true" data-section="topPanels" data-index="${index}">
            <span class="material-symbols-outlined text-slate-500 cursor-move text-[16px]">drag_indicator</span>
            <div class="flex-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-${panel.color} text-[18px]">${panel.icon}</span>
                <span class="text-xs font-medium text-white">${panel.label}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${panel.visible ? 'checked' : ''} onchange="toggleStatVisibility('topPanels', ${index})" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    addDragAndDropListeners('topPanels');
}

function populateBottomPanelsCustomizer() {
    const container = document.getElementById('bottom-panels-customizer');
    if (!container) return;

    // Ensure bottomPanels exist
    if (!currentDashboardConfig.bottomPanels) {
        currentDashboardConfig.bottomPanels = JSON.parse(JSON.stringify(defaultDashboardConfig.bottomPanels));
    }

    // Filter out any null/undefined entries
    currentDashboardConfig.bottomPanels = currentDashboardConfig.bottomPanels.filter(panel => panel != null);

    container.innerHTML = currentDashboardConfig.bottomPanels.map((panel, index) => `
        <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all" draggable="true" data-section="bottomPanels" data-index="${index}">
            <span class="material-symbols-outlined text-slate-500 cursor-move text-[16px]">drag_indicator</span>
            <div class="flex-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-${panel.color} text-[18px]">${panel.icon}</span>
                <span class="text-xs font-medium text-white">${panel.label}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${panel.visible ? 'checked' : ''} onchange="toggleStatVisibility('bottomPanels', ${index})" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    addDragAndDropListeners('bottomPanels');
}

function toggleStatVisibility(section, index) {
    console.log('[Dashboard] Toggling visibility:', section, index);

    // Map section names to config property names
    const sectionMap = {
        'primary': 'primaryStats',
        'secondary': 'secondaryStats',
        'leadBreakdown': 'leadBreakdown',
        'topPanels': 'topPanels',
        'bottomPanels': 'bottomPanels'
    };

    const configSection = sectionMap[section] || section;
    currentDashboardConfig[configSection][index].visible = !currentDashboardConfig[configSection][index].visible;

    console.log('[Dashboard] New visibility state:', currentDashboardConfig[configSection][index].label, '=', currentDashboardConfig[configSection][index].visible);
}

function changeSectionSize(section, size) {
    console.log('[Dashboard] Changing section size:', section, size);

    // Map section names to config property names
    const sectionMap = {
        'primary': 'primaryStats',
        'secondary': 'secondaryStats',
        'leadBreakdown': 'leadBreakdown',
        'topPanels': 'topPanels',
        'bottomPanels': 'bottomPanels'
    };

    const configSection = sectionMap[section] || section;

    // Apply size to all stats in the section
    currentDashboardConfig[configSection].forEach(stat => {
        stat.size = size;
    });

    // Update button states
    ['small', 'medium', 'large'].forEach(s => {
        const btn = document.getElementById(`${section}-size-${s}`);
        if (btn) {
            if (s === size) {
                btn.className = 'size-6 rounded bg-primary text-white flex items-center justify-center text-[10px] font-bold transition-all';
            } else {
                btn.className = 'size-6 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 flex items-center justify-center text-[10px] font-bold transition-all';
            }
        }
    });

    console.log('[Dashboard] Section', section, 'resized to', size);
}

let draggedElement = null;
let draggedSection = null;
let draggedIndex = null;

function addDragAndDropListeners(section) {
    let containerId;
    if (section === 'topPanels') {
        containerId = 'top-panels-customizer';
    } else if (section === 'bottomPanels') {
        containerId = 'bottom-panels-customizer';
    } else if (section === 'primary' || section === 'secondary') {
        containerId = `${section}-stats-customizer`;
    } else {
        containerId = `${section}-customizer`;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const items = container.querySelectorAll(`[data-section="${section}"]`);

    // Make container a drop zone (with visual feedback)
    container.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (draggedElement && draggedSection !== section) {
            container.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            container.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        }
    });

    container.addEventListener('dragleave', (e) => {
        // Only remove highlight if leaving the container itself
        if (e.target === container) {
            container.style.backgroundColor = '';
            container.style.borderColor = '';
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Remove visual feedback
        container.style.backgroundColor = '';
        container.style.borderColor = '';

        // Handle drop - works for both empty containers and dropping in empty space
        if (draggedElement) {
            // Append to container if dropped on container itself or if container is empty
            const items = container.querySelectorAll(`[data-section="${section}"]`);
            if (e.target === container || items.length === 0) {
                container.appendChild(draggedElement);
            }
            handleCrossSectionDrop(draggedSection, section);
        }
    });

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedSection = section;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('opacity-50');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('opacity-50');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedElement !== item) {
                const bounding = item.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                if (offset > bounding.height / 2) {
                    item.parentNode.insertBefore(draggedElement, item.nextSibling);
                } else {
                    item.parentNode.insertBefore(draggedElement, item);
                }
            }
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const targetSection = item.dataset.section;
            handleCrossSectionDrop(draggedSection, targetSection);
        });
    });
}

function handleCrossSectionDrop(fromSection, toSection) {
    const sectionMap = {
        'primary': 'primaryStats',
        'secondary': 'secondaryStats',
        'leadBreakdown': 'leadBreakdown',
        'topPanels': 'topPanels',
        'bottomPanels': 'bottomPanels'
    };

    const fromConfigSection = sectionMap[fromSection] || fromSection;
    const toConfigSection = sectionMap[toSection] || toSection;

    console.log('[Dashboard] Drop:', fromSection, '->', toSection);
    console.log('[Dashboard] Dragged index:', draggedIndex);

    if (fromSection === toSection) {
        // Same section - reorder
        let containerId;
        if (toSection === 'topPanels') {
            containerId = 'top-panels-customizer';
        } else if (toSection === 'bottomPanels') {
            containerId = 'bottom-panels-customizer';
        } else if (toSection === 'primary' || toSection === 'secondary') {
            containerId = `${toSection}-stats-customizer`;
        } else {
            containerId = `${toSection}-customizer`;
        }
        const container = document.getElementById(containerId);
        const allItems = container.querySelectorAll(`[data-section="${toSection}"]`);
        const newOrder = Array.from(allItems).map(el => parseInt(el.dataset.index));

        // Create new array with reordered items
        const reordered = newOrder.map(oldIndex => currentDashboardConfig[toConfigSection][oldIndex]);
        currentDashboardConfig[toConfigSection] = reordered;

        console.log('[Dashboard] Reordered', toConfigSection, ':', reordered.map(s => s.label));
    } else {
        // Different section - move item
        const movedItem = currentDashboardConfig[fromConfigSection][draggedIndex];

        if (!movedItem) {
            console.error('[Dashboard] No item found at index', draggedIndex, 'in', fromConfigSection);
            return;
        }

        console.log('[Dashboard] Moving item:', movedItem.label);

        // Get target section's size (use the first item's size, or default)
        let targetSectionSize = 'medium'; // default
        if (currentDashboardConfig[toConfigSection].length > 0) {
            targetSectionSize = currentDashboardConfig[toConfigSection][0].size || 'medium';
        } else {
            // Use default sizes for each section type
            const defaultSizes = {
                'primaryStats': 'medium',
                'secondaryStats': 'small',
                'leadBreakdown': 'small',
                'topPanels': 'medium',
                'bottomPanels': 'medium'
            };
            targetSectionSize = defaultSizes[toConfigSection] || 'medium';
        }

        // Apply the target section's size to the moved item
        movedItem.size = targetSectionSize;
        console.log('[Dashboard] Applied size', targetSectionSize, 'to', movedItem.label);

        // Get target position from DOM BEFORE removing from source
        let targetContainerId;
        if (toSection === 'topPanels') {
            targetContainerId = 'top-panels-customizer';
        } else if (toSection === 'bottomPanels') {
            targetContainerId = 'bottom-panels-customizer';
        } else if (toSection === 'primary' || toSection === 'secondary') {
            targetContainerId = `${toSection}-stats-customizer`;
        } else {
            targetContainerId = `${toSection}-customizer`;
        }
        const targetContainerEl = document.getElementById(targetContainerId);

        // Find where the dragged element is in the target container's DOM
        const allChildren = Array.from(targetContainerEl.children);
        const draggedElPosition = allChildren.indexOf(draggedElement);

        // Remove from source configuration
        currentDashboardConfig[fromConfigSection].splice(draggedIndex, 1);

        // Insert into target at the position where it was dropped
        if (draggedElPosition >= 0) {
            currentDashboardConfig[toConfigSection].splice(draggedElPosition, 0, movedItem);
            console.log('[Dashboard] Inserted at position', draggedElPosition);
        } else {
            currentDashboardConfig[toConfigSection].push(movedItem);
            console.log('[Dashboard] Pushed to end');
        }

        console.log('[Dashboard] Moved', movedItem.label, 'from', fromConfigSection, 'to', toConfigSection);
        console.log('[Dashboard] Source now has', currentDashboardConfig[fromConfigSection].length, 'items');
        console.log('[Dashboard] Target now has', currentDashboardConfig[toConfigSection].length, 'items');
    }

    // Refresh all sections
    populateTopPanelsCustomizer();
    populatePrimaryStatsCustomizer();
    populateSecondaryStatsCustomizer();
    populateLeadBreakdownCustomizer();
    populateBottomPanelsCustomizer();
}

function applyDashboardCustomization() {
    console.log('[Dashboard] ═══ Applying Customization ═══');
    console.log('[Dashboard] Current config:', JSON.stringify(currentDashboardConfig, null, 2));

    // Save the configuration to localStorage
    saveDashboardConfig(currentDashboardConfig);
    console.log('[Dashboard] ✅ Configuration saved to localStorage');

    // Verify it was saved
    const savedConfig = localStorage.getItem('eventDashboardConfig');
    console.log('[Dashboard] Verification - Config in localStorage:', savedConfig ? 'YES' : 'NO');

    // Close the modal
    closeDashboardCustomizer();

    // Apply the changes to the current dashboard view
    console.log('[Dashboard] Applying configuration to dashboard...');
    renderDashboardWithConfig();

    // Reload current event if one is selected to refresh the view
    if (currentEventDashboardId) {
        console.log('[Dashboard] Reloading event dashboard with new configuration');
        loadEventDashboard();
    } else {
        console.log('[Dashboard] No event selected, configuration will apply on next load');
    }

    console.log('[Dashboard] ═══ Customization Applied ═══');
}

function resetDashboardToDefault() {
    // Reset to default configuration
    currentDashboardConfig = JSON.parse(JSON.stringify(defaultDashboardConfig));

    // Save the configuration
    saveDashboardConfig(currentDashboardConfig);

    // Update customizer UI
    populateTopPanelsCustomizer();
    populatePrimaryStatsCustomizer();
    populateSecondaryStatsCustomizer();
    populateLeadBreakdownCustomizer();
    populateBottomPanelsCustomizer();

    // Apply to dashboard immediately
    renderDashboardWithConfig();

    // Reload current event if one is selected
    if (currentEventDashboardId) {
        loadEventDashboard();
    }

    console.log('[Dashboard] Reset to default configuration');
}

function resetAllFields() {
    // Make all fields visible
    currentDashboardConfig.primaryStats.forEach(stat => stat.visible = true);
    currentDashboardConfig.secondaryStats.forEach(stat => stat.visible = true);
    currentDashboardConfig.leadBreakdown.forEach(stat => stat.visible = true);
    if (currentDashboardConfig.topPanels) {
        currentDashboardConfig.topPanels.forEach(panel => panel.visible = true);
    }
    if (currentDashboardConfig.bottomPanels) {
        currentDashboardConfig.bottomPanels.forEach(panel => panel.visible = true);
    }

    // Save the configuration
    saveDashboardConfig(currentDashboardConfig);

    // Refresh UI
    populateTopPanelsCustomizer();
    populatePrimaryStatsCustomizer();
    populateSecondaryStatsCustomizer();
    populateLeadBreakdownCustomizer();
    populateBottomPanelsCustomizer();

    console.log('[Dashboard] All fields reset to visible');
}

function renderDashboardWithConfig() {
    console.log('[Dashboard] ═══ Rendering Dashboard ═══');
    console.log('[Dashboard] Current config:', currentDashboardConfig);
    console.log('[Dashboard] Primary stats visible:', currentDashboardConfig.primaryStats.filter(s => s.visible).map(s => s.label));
    console.log('[Dashboard] Secondary stats visible:', currentDashboardConfig.secondaryStats.filter(s => s.visible).map(s => s.label));
    console.log('[Dashboard] Lead breakdown visible:', currentDashboardConfig.leadBreakdown.filter(s => s.visible).map(s => s.label));
    renderDashboardCards();
    console.log('[Dashboard] ═══ Rendering Complete ═══');
}

// Saved Views Management
async function loadSavedViews() {
    const container = document.getElementById('saved-views-list');
    if (!container) return;

    let views = [];

    // Load from Supabase if user is logged in
    if (window.currentUser && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('dashboard_views')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                views = data.map(row => ({
                    id: row.id,
                    name: row.view_name,
                    config: row.configuration,
                    savedAt: row.created_at
                }));
                console.log('[Dashboard] Loaded', views.length, 'views from Supabase');
            }
        } catch (error) {
            console.error('[Dashboard] Failed to load from Supabase:', error);
        }
    }

    // Fallback to localStorage if no Supabase data
    if (views.length === 0) {
        const saved = localStorage.getItem('dashboardSavedViews');
        views = saved ? JSON.parse(saved) : [];
    }

    // Store globally for access by loadSavedView
    loadedDashboardViews = views;

    if (views.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">No saved views yet</p>';
        return;
    }

    container.innerHTML = views.map((view, index) => `
        <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/30">
            <button onclick="loadSavedView(${index})" class="text-xs font-medium text-white hover:text-primary transition-all">${view.name}</button>
            <button onclick="deleteSavedView(${index}, ${view.id ? `'${view.id}'` : 'null'})" class="text-slate-500 hover:text-red-400 transition-all">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        </div>
    `).join('');
}

async function saveCurrentView() {
    const viewName = prompt('Enter a name for this view:');
    if (!viewName) return;

    const viewData = {
        name: viewName,
        config: JSON.parse(JSON.stringify(currentDashboardConfig)),
        savedAt: new Date().toISOString()
    };

    // Save to Supabase if user is logged in
    if (window.currentUser && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('dashboard_views')
                .insert([{
                    user_id: window.currentUser.id,
                    view_name: viewName,
                    configuration: viewData.config,
                    created_at: viewData.savedAt
                }]);

            if (error) throw error;

            console.log('[Dashboard] Saved view to Supabase:', viewName);
        } catch (error) {
            console.error('[Dashboard] Failed to save to Supabase:', error);
            // Fallback to localStorage
        }
    }

    // Also save to localStorage as backup
    const saved = localStorage.getItem('dashboardSavedViews');
    const views = saved ? JSON.parse(saved) : [];
    views.push(viewData);
    localStorage.setItem('dashboardSavedViews', JSON.stringify(views));

    console.log('[Dashboard] Saved view:', viewName, 'Config:', currentDashboardConfig);
    await loadSavedViews();

    // Show success message
    alert(`View "${viewName}" saved successfully!`);
}

function loadSavedView(index) {
    if (!loadedDashboardViews || !loadedDashboardViews[index]) {
        console.error('[Dashboard] View not found at index:', index);
        return;
    }

    const view = loadedDashboardViews[index];
    console.log('[Dashboard] Loading saved view:', view.name, view.config);

    // Deep clone the configuration
    currentDashboardConfig = JSON.parse(JSON.stringify(view.config));

    // Update the customizer UI
    populateTopPanelsCustomizer();
    populatePrimaryStatsCustomizer();
    populateSecondaryStatsCustomizer();
    populateLeadBreakdownCustomizer();
    populateBottomPanelsCustomizer();

    console.log('[Dashboard] View loaded, current config:', currentDashboardConfig);
}

async function deleteSavedView(index, viewId) {
    if (!confirm('Delete this saved view?')) return;

    // Delete from Supabase if viewId exists
    if (viewId && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('dashboard_views')
                .delete()
                .eq('id', viewId);

            if (error) throw error;
            console.log('[Dashboard] Deleted view from Supabase:', viewId);
        } catch (error) {
            console.error('[Dashboard] Failed to delete from Supabase:', error);
        }
    }

    // Also delete from localStorage
    const saved = localStorage.getItem('dashboardSavedViews');
    if (saved) {
        const views = JSON.parse(saved);
        views.splice(index, 1);
        localStorage.setItem('dashboardSavedViews', JSON.stringify(views));
    }

    await loadSavedViews();
}

// ── Advanced Filters Modal Management ─────────────────────────────────────
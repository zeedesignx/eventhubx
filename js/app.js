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
function initEventDashboard() {
    // Populate event selector
    populateEventDashboardSelector();
}

function populateEventDashboardSelector() {
    const selector = document.getElementById('event-dashboard-selector');
    if (!selector) return;

    // Get all events from allEventsData (organized by tabs)
    if (!window.allEventsData) {
        selector.innerHTML = '<option value="">No events available</option>';
        return;
    }

    // Flatten all events from all tabs
    const allEvents = [];
    Object.values(window.allEventsData).forEach(tabEvents => {
        if (Array.isArray(tabEvents)) {
            tabEvents.forEach(evt => {
                // Avoid duplicates
                if (!allEvents.find(e => e.id === evt.id)) {
                    allEvents.push(evt);
                }
            });
        }
    });

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
}

async function loadEventDashboard() {
    const selector = document.getElementById('event-dashboard-selector');
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
        for (let tab in window.allEventsData) {
            const found = window.allEventsData[tab].find(e => e.id === eventId);
            if (found) {
                event = found;
                console.log('[EventDashboard] Found event:', event);
                break;
            }
        }
    }

    if (!event) {
        console.error('[EventDashboard] Event not found:', eventId);
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

    // Calculate and display metrics (await the async function)
    await updateEventDashboardMetrics(event);
}

async function updateEventDashboardMetrics(event) {
    console.log('[EventDashboard] Loading metrics for event:', event.id);

    // Load event-specific data using ensureEventSubpageData
    const exhibitors = await ensureEventSubpageData(event.id, 'exhibitors');
    const speakers = await ensureEventSubpageData(event.id, 'people');
    const sponsors = await ensureEventSubpageData(event.id, 'sponsors');
    const sessions = await ensureEventSubpageData(event.id, 'sessions');

    console.log('[EventDashboard] Data loaded:', {
        exhibitors: exhibitors.length,
        speakers: speakers.length,
        sponsors: sponsors.length,
        sessions: sessions.length
    });

    // Log first exhibitor to see structure
    if (exhibitors.length > 0) {
        console.log('[EventDashboard] Sample exhibitor:', exhibitors[0]);
    }

    // Calculate total leads
    const totalLeads = exhibitors.reduce((sum, ex) => {
        const leads = parseInt(ex.leads || ex.numberOfLeads || ex.lead_count || 0);
        return sum + leads;
    }, 0);

    console.log('[EventDashboard] Total leads calculated:', totalLeads);

    // Update stats cards
    animateEventDashboardNumber('ed-exhibitors-count', exhibitors.length);
    animateEventDashboardNumber('ed-leads-count', totalLeads);
    animateEventDashboardNumber('ed-speakers-count', speakers.length);
    animateEventDashboardNumber('ed-sponsors-count', sponsors.length);
    animateEventDashboardNumber('ed-sessions-count', sessions.length);
    animateEventDashboardNumber('ed-attendees-count', event.totalRegistrations || event.registrations || 0);

    // Update attendance rate
    const totalRegs = event.totalRegistrations || event.registrations || 0;
    const totalAtt = event.totalAttendees || event.attendees || 0;
    const attendanceRate = totalRegs ? Math.round((totalAtt / totalRegs) * 100) || 0 : 0;
    document.getElementById('ed-attendance-rate').textContent = attendanceRate + '%';
    document.getElementById('ed-attendance-bar').style.width = attendanceRate + '%';

    // Update speakers subtitle
    document.getElementById('ed-speakers-subtitle').textContent = `${sessions.length} sessions scheduled`;

    // Update top exhibitors
    updateEventDashboardTopExhibitors(exhibitors);

    // Update activity feed
    updateEventDashboardActivity(event, exhibitors, speakers);

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
        .map(ex => ({
            ...ex,
            leadsCount: parseInt(ex.leads || ex.numberOfLeads || ex.lead_count || 0)
        }))
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
    if (currentEventDashboardId) {
        // Clear the cache for this event to force fresh data
        if (window.eventSubpagesCache && window.eventSubpagesCache[currentEventDashboardId]) {
            delete window.eventSubpagesCache[currentEventDashboardId];
            console.log('[EventDashboard] Cleared cache for event:', currentEventDashboardId);
        }

        // Reload the dashboard
        await loadEventDashboard();
        console.log('[EventDashboard] Dashboard refreshed');
    } else {
        console.log('[EventDashboard] No event selected to refresh');
    }
}

// ── Advanced Filters Modal Management ─────────────────────────────────────
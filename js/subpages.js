/* ────────────────────────────────────────────────────────────
 * subpages.js — generateSubpages, renderSubpageMocks, filters
 * ──────────────────────────────────────────────────────────── */

async function ensureEventSubpageData(eventId, dataType) {
    const isGlobal = !eventId || eventId === 'all';
    const cacheKey = isGlobal ? 'all' : eventId;

    if (!window.eventSubpagesCache[cacheKey]) {
        window.eventSubpagesCache[cacheKey] = {};
    }

    if (window.eventSubpagesCache[cacheKey][dataType]) {
        console.log(`[Cache] 💾 Using cached ${dataType} for event ${cacheKey}:`, window.eventSubpagesCache[cacheKey][dataType].length);
        return window.eventSubpagesCache[cacheKey][dataType];
    }

    // Map common frontend names to storage names
    const typeMap = {
        'sessions': 'plannings',
        'speakers': 'people'
    };
    const apiType = typeMap[dataType] || dataType;

    console.log(`[Cache] 📥 Fetching ${dataType} (apiType: ${apiType}) for event: ${cacheKey}`);

    // 1. Try Supabase type-specific tables first (primary source)
    const tableMap = {
        'people': 'event_people',
        'plannings': 'event_planning',
        'exhibitors': 'event_exhibitors',
        'sponsors': 'event_sponsors'  // Add sponsors table mapping
    };
    const tableName = tableMap[apiType];

    if (tableName) {
        try {
            let query = window.supabaseClient.from(tableName).select('data, record_count, updated_at');

            if (!isGlobal) {
                query = query.eq('event_id', eventId).single();
                console.log(`[Cache] 🔍 Querying Supabase table ${tableName} for event_id: ${eventId}`);
                const { data: row, error } = await query;

                if (error) {
                    console.warn(`[Cache] ⚠️ Supabase error for ${tableName}/${eventId}:`, error);
                }

                if (!error && row && Array.isArray(row.data)) {
                    window.eventSubpagesCache[cacheKey][dataType] = row.data;
                    console.log(`[Cache] ✅ Supabase (${tableName}): ${row.data.length} ${dataType} for event ${cacheKey}`);
                    return row.data;
                } else if (!error && row) {
                    console.warn(`[Cache] ⚠️ Row exists but data is not an array:`, row);
                }
            } else {
                const { data: rows, error } = await query;
                if (!error && rows && Array.isArray(rows)) {
                    let allData = [];
                    rows.forEach(r => {
                        if (r.data && Array.isArray(r.data)) allData.push(...r.data);
                    });
                    window.eventSubpagesCache[cacheKey][dataType] = allData;
                    console.log(`[Cache] ✅ Supabase (${tableName}): ${allData.length} ${dataType} for ALL events`);
                    return allData;
                }
            }
        } catch (supaErr) {
            console.warn(`[Cache] Supabase lookup failed for ${tableName || apiType}/${cacheKey}, falling back to API:`, supaErr);
        }
    }

    // 2. Fallback: backend API (reads from local JSON files)
    try {
        if (!isGlobal) {
            console.log(`[Cache] 🌐 Trying API fallback: /api/subpages/${eventId}/${apiType}`);
            const res = await fetch(`/api/subpages/${encodeURIComponent(eventId)}/${apiType}`);
            const d = await res.json();
            console.log(`[Cache] 📦 API response for ${dataType}:`, d);
            if (d.status === 'success') {
                window.eventSubpagesCache[cacheKey][dataType] = d.data;
                console.log(`[Cache] ✅ API fallback: ${d.data.length} ${dataType} for event ${cacheKey}`);
                return d.data;
            }
        } else {
            console.log(`[Cache] API fallback not supported for global view of ${dataType}`);
        }
    } catch (apiErr) {
        console.error(`[Cache] ❌ API fallback also failed for ${dataType}/${cacheKey}:`, apiErr);
    }

    console.warn(`[Cache] ⚠️ Returning empty array for ${dataType}/${cacheKey}`);
    return [];
}

let exCurrentPage = 1;
let exItemsPerPage = parseInt(localStorage.getItem('exItemsPerPage')) || 10;
let defaultCols = { industry: true, events: true, onboarding: true, booth: true, members: true, leads: true, createdOn: true, updatedOn: true };
let savedCols = localStorage.getItem('exVisibleColumns');
let exVisibleColumns = savedCols ? JSON.parse(savedCols) : defaultCols;
// Ensure new columns exist in saved prefs
if (exVisibleColumns.members === undefined) exVisibleColumns.members = true;
if (exVisibleColumns.leads === undefined) exVisibleColumns.leads = true;

// Sorting state
let exSortColumn = localStorage.getItem('exSortColumn') || '';
let exSortDirection = localStorage.getItem('exSortDirection') || 'asc';

// Filter tab state
let exFilterTab = 'all';

// Toggle function for columns
window.toggleExColumn = function (col) {
    if (exVisibleColumns[col] !== undefined) {
        exVisibleColumns[col] = !exVisibleColumns[col];
        localStorage.setItem('exVisibleColumns', JSON.stringify(exVisibleColumns));
        renderSubpageMocks('exhibitors');
    }
};

window.setExhibitorPage = function (page) {
    exCurrentPage = page;
    renderSubpageMocks('exhibitors');
};

window.setExhibitorPageSize = function (size) {
    exItemsPerPage = parseInt(size, 10);
    exCurrentPage = 1;
    localStorage.setItem('exItemsPerPage', exItemsPerPage);
    renderSubpageMocks('exhibitors');
};

window.toggleExSettings = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('ex-settings-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

window.setExSortColumn = function (col) {
    if (exSortColumn === col) {
        exSortDirection = exSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        exSortColumn = col;
        exSortDirection = 'asc';
    }
    localStorage.setItem('exSortColumn', exSortColumn);
    localStorage.setItem('exSortDirection', exSortDirection);
    exCurrentPage = 1;
    renderSubpageMocks('exhibitors');
};

window.setExFilterTab = function (tab) {
    exFilterTab = tab;
    exCurrentPage = 1;
    renderSubpageMocks('exhibitors');
    // Update tab button styles
    document.querySelectorAll('[data-ex-tab]').forEach(btn => {
        if (btn.dataset.exTab === tab) {
            btn.className = btn.className.replace('text-slate-400 hover:text-white hover:bg-white/5', 'text-white bg-surface-hover border border-border-dark/60 shadow-sm');
        } else {
            btn.className = btn.className.replace('text-white bg-surface-hover border border-border-dark/60 shadow-sm', 'text-slate-400 hover:text-white hover:bg-white/5');
        }
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// PEOPLE STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let peopleCurrentPage = 1;
let peopleItemsPerPage = parseInt(localStorage.getItem('peopleItemsPerPage')) || 25;
let peopleDefaultCols = { jobTitle: true, organization: true, type: true, email: true, events: true, createdOn: false, updatedOn: false };
let peopleSavedCols = localStorage.getItem('peopleVisibleColumns');
let peopleVisibleColumns = peopleSavedCols ? JSON.parse(peopleSavedCols) : peopleDefaultCols;
let peopleSortColumn = localStorage.getItem('peopleSortColumn') || 'name';
let peopleSortDirection = localStorage.getItem('peopleSortDirection') || 'asc';
let peopleFilterTab = 'all';

window.togglePeopleColumn = function (col) {
    if (peopleVisibleColumns[col] !== undefined) {
        peopleVisibleColumns[col] = !peopleVisibleColumns[col];
        localStorage.setItem('peopleVisibleColumns', JSON.stringify(peopleVisibleColumns));
        renderSubpageMocks('people');
    }
};

window.setPeoplePage = function (page) {
    peopleCurrentPage = page;
    renderSubpageMocks('people');
};

window.setPeoplePageSize = function (size) {
    peopleItemsPerPage = parseInt(size, 10);
    peopleCurrentPage = 1;
    localStorage.setItem('peopleItemsPerPage', peopleItemsPerPage);
    renderSubpageMocks('people');
};

window.togglePeopleSettings = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('people-settings-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.setPeopleSortColumn = function (col) {
    if (peopleSortColumn === col) {
        peopleSortDirection = peopleSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        peopleSortColumn = col;
        peopleSortDirection = 'asc';
    }
    localStorage.setItem('peopleSortColumn', peopleSortColumn);
    localStorage.setItem('peopleSortDirection', peopleSortDirection);
    peopleCurrentPage = 1;
    renderSubpageMocks('people');
};

window.setPeopleFilterTab = function (tab) {
    peopleFilterTab = tab;
    peopleCurrentPage = 1;
    renderSubpageMocks('people');
    document.querySelectorAll('[data-people-tab]').forEach(btn => {
        if (btn.dataset.peopleTab === tab) {
            btn.className = btn.className.replace('text-slate-400 hover:text-white hover:bg-white/5', 'text-white bg-surface-hover border border-border-dark/60 shadow-sm');
        } else {
            btn.className = btn.className.replace('text-white bg-surface-hover border border-border-dark/60 shadow-sm', 'text-slate-400 hover:text-white hover:bg-white/5');
        }
    });
};

window.openPersonDetails = function (id) {
    const backdrop = document.getElementById('person-panel-backdrop');
    const panel = document.getElementById('person-side-panel');
    if (!backdrop || !panel) return;
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    setTimeout(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }, 10);
    let person = null;
    const eventId = window.globalSelectedEventId;
    if (window.eventSubpagesCache[eventId]) {
        const peopleData = window.eventSubpagesCache[eventId].people || window.eventSubpagesCache[eventId].speakers;
        if (peopleData) {
            person = peopleData.find(p => p.id === id);
        }
    }
    renderPersonPanel(person, id);
};

window.closePersonPanel = function () {
    const backdrop = document.getElementById('person-panel-backdrop');
    const panel = document.getElementById('person-side-panel');
    if (!backdrop || !panel) return;
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
};

// ═══════════════════════════════════════════════════════════════════════════
// SESSIONS (PLANNINGS) STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let sessionsCurrentPage = 1;
let sessionsItemsPerPage = parseInt(localStorage.getItem('sessionsItemsPerPage')) || 25;
let sessionsDefaultCols = { type: true, format: true, datetime: true, duration: false, speakers: true, location: false, attendees: false };
let sessionsSavedCols = localStorage.getItem('sessionsVisibleColumns');
let sessionsVisibleColumns = sessionsSavedCols ? JSON.parse(sessionsSavedCols) : sessionsDefaultCols;
let sessionsSortColumn = localStorage.getItem('sessionsSortColumn') || 'datetime';
let sessionsSortDirection = localStorage.getItem('sessionsSortDirection') || 'asc';
let sessionsFilterTab = 'all';

window.toggleSessionsColumn = function (col) {
    if (sessionsVisibleColumns[col] !== undefined) {
        sessionsVisibleColumns[col] = !sessionsVisibleColumns[col];
        localStorage.setItem('sessionsVisibleColumns', JSON.stringify(sessionsVisibleColumns));
        renderSubpageMocks('sessions');
    }
};

window.setSessionsPage = function (page) {
    sessionsCurrentPage = page;
    renderSubpageMocks('sessions');
};

window.setSessionsPageSize = function (size) {
    sessionsItemsPerPage = parseInt(size, 10);
    sessionsCurrentPage = 1;
    localStorage.setItem('sessionsItemsPerPage', sessionsItemsPerPage);
    renderSubpageMocks('sessions');
};

window.toggleSessionsSettings = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('sessions-settings-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.setSessionsSortColumn = function (col) {
    if (sessionsSortColumn === col) {
        sessionsSortDirection = sessionsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sessionsSortColumn = col;
        sessionsSortDirection = 'asc';
    }
    localStorage.setItem('sessionsSortColumn', sessionsSortColumn);
    localStorage.setItem('sessionsSortDirection', sessionsSortDirection);
    sessionsCurrentPage = 1;
    renderSubpageMocks('sessions');
};

window.setSessionsFilterTab = function (tab) {
    sessionsFilterTab = tab;
    sessionsCurrentPage = 1;
    renderSubpageMocks('sessions');
    document.querySelectorAll('[data-sessions-tab]').forEach(btn => {
        if (btn.dataset.sessionsTab === tab) {
            btn.className = btn.className.replace('text-slate-400 hover:text-white hover:bg-white/5', 'text-white bg-surface-hover border border-border-dark/60 shadow-sm');
        } else {
            btn.className = btn.className.replace('text-white bg-surface-hover border border-border-dark/60 shadow-sm', 'text-slate-400 hover:text-white hover:bg-white/5');
        }
    });
};

window.openSessionDetails = function (id) {
    const backdrop = document.getElementById('session-panel-backdrop');
    const panel = document.getElementById('session-side-panel');
    if (!backdrop || !panel) return;
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    setTimeout(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }, 10);
    let session = null;
    const eventId = window.globalSelectedEventId;
    if (window.eventSubpagesCache[eventId] && window.eventSubpagesCache[eventId].sessions) {
        session = window.eventSubpagesCache[eventId].sessions.find(s => s.id === id);
    }
    renderSessionPanel(session, id);
};

window.closeSessionPanel = function () {
    const backdrop = document.getElementById('session-panel-backdrop');
    const panel = document.getElementById('session-side-panel');
    if (!backdrop || !panel) return;
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
};

// ═══════════════════════════════════════════════════════════════════════════
// SPONSORS STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let sponsorsCurrentPage = 1;
let sponsorsItemsPerPage = parseInt(localStorage.getItem('sponsorsItemsPerPage')) || 25;
let sponsorsDefaultCols = { tier: true, type: true, website: true, events: true, status: false, createdOn: false };
let sponsorsSavedCols = localStorage.getItem('sponsorsVisibleColumns');
let sponsorsVisibleColumns = sponsorsSavedCols ? JSON.parse(sponsorsSavedCols) : sponsorsDefaultCols;
let sponsorsSortColumn = localStorage.getItem('sponsorsSortColumn') || 'name';
let sponsorsSortDirection = localStorage.getItem('sponsorsSortDirection') || 'asc';
let sponsorsFilterTab = 'all';

window.toggleSponsorsColumn = function (col) {
    if (sponsorsVisibleColumns[col] !== undefined) {
        sponsorsVisibleColumns[col] = !sponsorsVisibleColumns[col];
        localStorage.setItem('sponsorsVisibleColumns', JSON.stringify(sponsorsVisibleColumns));
        renderSubpageMocks('sponsors');
    }
};

window.setSponsorsPage = function (page) {
    sponsorsCurrentPage = page;
    renderSubpageMocks('sponsors');
};

window.setSponsorsPageSize = function (size) {
    sponsorsItemsPerPage = parseInt(size, 10);
    sponsorsCurrentPage = 1;
    localStorage.setItem('sponsorsItemsPerPage', sponsorsItemsPerPage);
    renderSubpageMocks('sponsors');
};

window.toggleSponsorsSettings = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('sponsors-settings-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.setSponsorsSortColumn = function (col) {
    if (sponsorsSortColumn === col) {
        sponsorsSortDirection = sponsorsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sponsorsSortColumn = col;
        sponsorsSortDirection = 'asc';
    }
    localStorage.setItem('sponsorsSortColumn', sponsorsSortColumn);
    localStorage.setItem('sponsorsSortDirection', sponsorsSortDirection);
    sponsorsCurrentPage = 1;
    renderSubpageMocks('sponsors');
};

window.setSponsorsFilterTab = function (tab) {
    sponsorsFilterTab = tab;
    sponsorsCurrentPage = 1;
    renderSubpageMocks('sponsors');
    document.querySelectorAll('[data-sponsors-tab]').forEach(btn => {
        if (btn.dataset.sponsorsTab === tab) {
            btn.className = btn.className.replace('text-slate-400 hover:text-white hover:bg-white/5', 'text-white bg-surface-hover border border-border-dark/60 shadow-sm');
        } else {
            btn.className = btn.className.replace('text-white bg-surface-hover border border-border-dark/60 shadow-sm', 'text-slate-400 hover:text-white hover:bg-white/5');
        }
    });
};

window.openSponsorDetails = function (id) {
    const backdrop = document.getElementById('sponsor-panel-backdrop');
    const panel = document.getElementById('sponsor-side-panel');
    if (!backdrop || !panel) return;
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    setTimeout(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }, 10);
    let sponsor = null;
    const eventId = window.globalSelectedEventId;
    if (window.eventSubpagesCache[eventId] && window.eventSubpagesCache[eventId].sponsors) {
        sponsor = window.eventSubpagesCache[eventId].sponsors.find(s => s.id === id);
    }
    renderSponsorPanel(sponsor, id);
};

window.closeSponsorPanel = function () {
    const backdrop = document.getElementById('sponsor-panel-backdrop');
    const panel = document.getElementById('sponsor-side-panel');
    if (!backdrop || !panel) return;
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
};

window.openExhibitorDetails = function (exId) {
    const backdrop = document.getElementById('exhibitor-panel-backdrop');
    const panel = document.getElementById('exhibitor-side-panel');
    const content = document.getElementById('exhibitor-panel-content');

    if (!backdrop || !panel || !content) return;

    // Show backdrop
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');

    // Slide in
    setTimeout(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }, 10);

    // Find data
    let exhibitor = null;
    const eventId = window.globalSelectedEventId;
    if (window.eventSubpagesCache[eventId] && window.eventSubpagesCache[eventId].exhibitors) {
        exhibitor = window.eventSubpagesCache[eventId].exhibitors.find(e => e.id === exId);
    }

    renderExhibitorPanel(exhibitor, exId);
};

window.closeExhibitorPanel = function () {
    const backdrop = document.getElementById('exhibitor-panel-backdrop');
    const panel = document.getElementById('exhibitor-side-panel');

    if (!backdrop || !panel) return;

    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');

    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
};

function renderExhibitorPanel(item, id) {
    const isReal = typeof item === 'object';
    const name = isReal ? (item.name || 'Unnamed Exhibitor') : `Exhibitor Co. ${parseInt(id) + 1}`;
    const type = isReal ? (item.industry || item.processedType || 'Exhibitor') : 'Exhibitor';
    const logoUrl = item ? (item.cachedLogoUrl || (item.logoUrl ? imgUrl(item.logoUrl) : '')) : '';
    const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'EX';

    // Banner logic — use exhibitor's own banner, then background image, then event banner
    let bannerUrl = '';
    if (isReal && item.banner && item.banner.imageUrl) {
        bannerUrl = imgUrl(item.banner.imageUrl);
    } else if (isReal && item.backgroundImageUrl) {
        bannerUrl = imgUrl(item.backgroundImageUrl);
    } else if (isReal && item.targetEventIds && item.targetEventIds.length > 0) {
        const rawEvents = window.allEventsData || {};
        Object.values(rawEvents).forEach(list => {
            if (Array.isArray(list)) {
                const ev = list.find(e => e.id === (item.targetEventIds || [])[0]);
                if (ev && ev.banner && ev.banner.imageUrl) bannerUrl = imgUrl(ev.banner.imageUrl);
            }
        });
    }

    // ── Extract all data safely ──────────────────────────────────────────────
    const desc = isReal ? (item.description || '') : '';
    const htmlDesc = isReal ? (item.htmlDescription || '') : '';
    const email = isReal ? (item.email || item.email || '') : '';
    const website = isReal ? (item.websiteUrl || '') : '';
    const address = isReal ? (item.address || {}) : {};
    const phones = isReal ? (item.phoneNumbers || []) : [];
    const socials = isReal ? (item.socialNetworks || []) : [];
    const members = isReal ? (item.members || []) : [];
    const documents = isReal ? (item.documents || []) : [];
    const fields = isReal ? (item.fields || []) : [];
    const features = isReal ? (item.features || {}) : {};
    const totalMembers = isReal ? (item.total_members !== undefined ? item.total_members : (item.totalMembers || 0)) : 0;
    const createdAt = isReal && (item.created_at || item.createdAt) ? new Date(item.created_at || item.createdAt) : null;
    const updatedAt = isReal && (item.updated_at || item.updatedAt) ? new Date(item.updated_at || item.updatedAt) : null;
    const withEvent = isReal ? (item.withEvent || null) : null;

    // Extract custom fields
    let industry = isReal && item.industry ? item.industry : '';
    let boothLocation = isReal && item.booth ? item.booth : '';
    let exhibitorCategory = '';
    fields.forEach(f => {
        const defName = f.definition ? f.definition.name : '';
        if (defName === 'Company Industry' && !industry) {
            const raw = f.selectValue || f.textValue || '';
            industry = raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } else if (defName === 'Booth Location' && !boothLocation) {
            boothLocation = (f.textValue || f.selectValue || '').toUpperCase();
        } else if (defName === 'Type') {
            exhibitorCategory = f.selectValue || f.textValue || '';
            exhibitorCategory = exhibitorCategory.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
    });

    // Build address string
    const addressParts = isReal && (item.city || item.country)
        ? [item.city, item.country].filter(Boolean)
        : [address.street, address.city, address.state, address.country].filter(Boolean);
    const addressStr = addressParts.join(', ');

    // Social network icons mapping
    const socialIcons = {
        'LINKEDIN': { icon: 'fab fa-linkedin', color: 'text-blue-400', prefix: 'https://linkedin.com/company/' },
        'TWITTER': { icon: 'fab fa-x-twitter', color: 'text-slate-300', prefix: 'https://x.com/' },
        'FACEBOOK': { icon: 'fab fa-facebook', color: 'text-blue-500', prefix: 'https://facebook.com/' },
        'INSTAGRAM': { icon: 'fab fa-instagram', color: 'text-pink-400', prefix: 'https://instagram.com/' },
        'YOUTUBE': { icon: 'fab fa-youtube', color: 'text-red-500', prefix: 'https://youtube.com/' },
        'TIKTOK': { icon: 'fab fa-tiktok', color: 'text-slate-300', prefix: 'https://tiktok.com/@' },
    };

    // withEvent leads data
    const leads = withEvent && withEvent.leads ? withEvent.leads : null;
    const booths = withEvent && withEvent.booths ? withEvent.booths : [];
    const eventGroup = withEvent && withEvent.group ? withEvent.group : null;

    // Booth from withEvent or from custom fields
    const boothDisplay = booths.length > 0 ? booths.map(b => b.name).join(', ') : boothLocation;

    // ── Build Sections ───────────────────────────────────────────────────────

    // Stats row
    const statsHtml = `
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-3.5 text-center group hover:border-primary/40 transition-colors">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Members</p>
                <p class="text-xl font-bold text-white">${totalMembers}</p>
            </div>
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-3.5 text-center group hover:border-emerald-400/40 transition-colors">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Scans</p>
                <p class="text-xl font-bold text-white">${leads && leads.scans ? leads.scans.totalCount : '—'}</p>
            </div>
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-3.5 text-center group hover:border-sky-400/40 transition-colors">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Views</p>
                <p class="text-xl font-bold text-white">${leads && leads.views ? leads.views.totalCount : '—'}</p>
            </div>
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-3.5 text-center group hover:border-purple-400/40 transition-colors">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Contacts</p>
                <p class="text-xl font-bold text-white">${leads && leads.contacts ? leads.contacts.totalCount : '—'}</p>
            </div>
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-3.5 text-center group hover:border-amber-400/40 transition-colors">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Bookmarks</p>
                <p class="text-xl font-bold text-white">${leads && leads.bookmarks ? leads.bookmarks.totalCount : '—'}</p>
            </div>
        </div>`;

    // Description section
    const descSection = desc ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-primary">info</span>
                About
            </h3>
            <div class="text-[13px] text-slate-400 leading-relaxed font-medium max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                ${htmlDesc ? htmlDesc : `<p>${desc}</p>`}
            </div>
        </div>` : '';

    // Industry & Category badges
    const badgesHtml = (industry || exhibitorCategory) ? `
        <div class="flex flex-wrap gap-2">
            ${industry ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover border border-border-dark text-slate-300 text-[10px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined text-[13px]">category</span>${industry}</span>` : ''}
            ${exhibitorCategory ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover border border-border-dark text-slate-300 text-[10px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined text-[13px]">label</span>${exhibitorCategory}</span>` : ''}
        </div>` : '';

    // Contact section
    let contactItems = '';
    if (website) {
        const cleanUrl = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
        contactItems += `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/40 border border-border-dark/60 hover:border-primary/30 transition-colors group/contact">
                <div class="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-[18px]">public</span>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Website</span>
                    <a href="${website}" target="_blank" class="text-[12px] font-bold text-slate-200 hover:text-primary transition-colors truncate">${cleanUrl}</a>
                </div>
                <span class="material-symbols-outlined text-[14px] text-slate-600 group-hover/contact:text-primary transition-colors">open_in_new</span>
            </div>`;
    }
    if (email) {
        contactItems += `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/40 border border-border-dark/60 hover:border-amber-500/30 transition-colors group/contact">
                <div class="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-amber-400 text-[18px]">mail</span>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Email</span>
                    <a href="mailto:${email}" class="text-[12px] font-bold text-slate-200 hover:text-amber-400 transition-colors truncate">${email}</a>
                </div>
            </div>`;
    }
    phones.forEach(ph => {
        const display = ph.formattedNumber || ph.number || '';
        if (!display) return;
        contactItems += `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/40 border border-border-dark/60 hover:border-emerald-500/30 transition-colors">
                <div class="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-emerald-400 text-[18px]">phone</span>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${ph.label || ph.type || 'Phone'}</span>
                    <span class="text-[12px] font-bold text-slate-200">${display}</span>
                </div>
            </div>`;
    });
    if (addressStr) {
        contactItems += `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/40 border border-border-dark/60">
                <div class="size-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-rose-400 text-[18px]">location_on</span>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Address</span>
                    <span class="text-[12px] font-bold text-slate-200">${addressStr}</span>
                </div>
            </div>`;
    }
    const contactSection = contactItems ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-amber-500">contact_page</span>
                Contact Information
            </h3>
            <div class="grid grid-cols-1 gap-2">${contactItems}</div>
        </div>` : '';

    // Social Networks
    const socialsHtml = socials.length > 0 ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-cyan-400">share</span>
                Social Media
            </h3>
            <div class="flex flex-wrap gap-2">
                ${socials.map(s => {
        const info = socialIcons[s.type] || { icon: 'fas fa-link', color: 'text-slate-400', prefix: '' };
        const profile = s.profile || '';
        const url = profile.startsWith('http') ? profile : (info.prefix + profile);
        const label = s.type ? s.type.charAt(0) + s.type.slice(1).toLowerCase() : 'Link';
        return `<a href="${url}" target="_blank" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-dark/40 border border-border-dark/60 hover:border-primary/40 hover:bg-surface-hover/40 transition-all group/social">
                        <span class="material-symbols-outlined text-[16px] ${info.color}">${s.type === 'LINKEDIN' ? 'work' : s.type === 'TWITTER' ? 'tag' : s.type === 'FACEBOOK' ? 'thumb_up' : s.type === 'INSTAGRAM' ? 'photo_camera' : s.type === 'YOUTUBE' ? 'play_circle' : 'link'}</span>
                        <span class="text-[11px] font-bold text-slate-300 group-hover/social:text-white transition-colors">${label}</span>
                        <span class="material-symbols-outlined text-[12px] text-slate-600 group-hover/social:text-primary transition-colors">open_in_new</span>
                    </a>`;
    }).join('')}
            </div>
        </div>` : '';

    // Booth section
    const boothSection = boothDisplay ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-emerald-400">meeting_room</span>
                Booth & Location
            </h3>
            <div class="bg-surface-dark/40 border border-border-dark/60 rounded-xl p-4 flex items-center gap-4">
                <div class="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <span class="material-symbols-outlined text-[24px]">location_on</span>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Booth</p>
                    <p class="text-lg font-bold text-white truncate">${boothDisplay}</p>
                </div>
            </div>
        </div>` : '';

    // Team / Members section
    const membersSection = members.length > 0 ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-indigo-400">group</span>
                Team Members
                <span class="ml-auto text-[10px] font-bold text-slate-600 bg-surface-dark/60 px-2 py-0.5 rounded-full border border-border-dark/40">${members.length}${totalMembers > members.length ? ` of ${totalMembers}` : ''}</span>
            </h3>
            <div class="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                ${members.map(m => {
        const mName = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unknown';
        const mInitials = (m.firstName ? m.firstName[0] : '') + (m.lastName ? m.lastName[0] : '');
        const mPhoto = m.photoUrl ? imgUrl(m.photoUrl) : '';
        const mTitle = m.jobTitle || '';
        const mOrg = m.organization || '';
        const mEmail = m.email || '';
        const mRole = m.roles && m.roles.length > 0 ? m.roles[0].name : '';

        return `<div class="flex items-center gap-3 p-2.5 rounded-lg bg-surface-dark/30 border border-border-dark/40 hover:border-primary/30 transition-colors group/member">
                        ${mPhoto
                ? `<img src="${mPhoto}" class="size-10 rounded-full object-cover border-2 border-border-dark/60 shrink-0" />`
                : `<div class="size-10 rounded-full bg-surface-dark flex items-center justify-center text-primary text-[11px] font-black shrink-0 border-2 border-border-dark/60">${mInitials}</div>`
            }
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <p class="text-[12px] font-bold text-white truncate">${mName}</p>
                                ${mRole ? `<span class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary shrink-0">${mRole}</span>` : ''}
                            </div>
                            <p class="text-[10px] text-slate-400 truncate">${mTitle}${mTitle && mOrg ? ' at ' : ''}${mOrg}</p>
                        </div>
                        ${mEmail ? `<a href="mailto:${mEmail}" onclick="event.stopPropagation()" class="size-7 rounded-md bg-surface-dark/60 hover:bg-primary/20 flex items-center justify-center text-slate-500 hover:text-primary transition-all shrink-0" title="${mEmail}"><span class="material-symbols-outlined text-[14px]">mail</span></a>` : ''}
                    </div>`;
    }).join('')}
            </div>
        </div>` : '';

    // Documents section
    const docsSection = documents.length > 0 ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-orange-400">description</span>
                Documents
                <span class="ml-auto text-[10px] font-bold text-slate-600 bg-surface-dark/60 px-2 py-0.5 rounded-full border border-border-dark/40">${documents.length}</span>
            </h3>
            <div class="space-y-2">
                ${documents.map(doc => {
        const docUrl = doc.url || doc.embeddedUrl || '#';
        const docName = doc.name || 'Untitled Document';
        return `<a href="${docUrl}" target="_blank" class="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/40 border border-border-dark/60 hover:border-orange-500/30 hover:bg-surface-hover/30 transition-all group/doc">
                        <div class="size-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-orange-400 text-[18px]">description</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-[12px] font-bold text-slate-200 group-hover/doc:text-white truncate">${docName}</p>
                            ${doc.description ? `<p class="text-[10px] text-slate-500 truncate">${doc.description}</p>` : ''}
                        </div>
                        <span class="material-symbols-outlined text-[14px] text-slate-600 group-hover/doc:text-orange-400 transition-colors shrink-0">download</span>
                    </a>`;
    }).join('')}
            </div>
        </div>` : '';

    // Features / Permissions badges
    const enabledFeatures = [];
    if (features.scanBadge) enabledFeatures.push({ label: 'Badge Scanning', icon: 'qr_code_scanner' });
    if (features.qualifyLeads) enabledFeatures.push({ label: 'Lead Qualification', icon: 'verified' });
    if (features.teamConnections) enabledFeatures.push({ label: 'Team Connect', icon: 'handshake' });
    if (features.recommendedLeads) enabledFeatures.push({ label: 'Recommended Leads', icon: 'recommend' });
    if (features.inviteMembers) enabledFeatures.push({ label: 'Invite Members', icon: 'person_add' });
    if (features.canExportContacts) enabledFeatures.push({ label: 'Export Contacts', icon: 'download' });

    const featuresSection = enabledFeatures.length > 0 ? `
        <div class="space-y-3">
            <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-teal-400">toggle_on</span>
                Enabled Features
            </h3>
            <div class="flex flex-wrap gap-1.5">
                ${enabledFeatures.map(f => `
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-500/8 border border-teal-500/15 text-teal-300 text-[10px] font-bold">
                        <span class="material-symbols-outlined text-[12px]">${f.icon}</span>
                        ${f.label}
                    </span>
                `).join('')}
            </div>
        </div>` : '';

    // Metadata footer
    const formatDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const metaSection = `
        <div class="pt-4 border-t border-border-dark/30">
            <div class="flex items-center justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                <span>Created ${formatDate(createdAt)}</span>
                <span>Updated ${formatDate(updatedAt)}</span>
            </div>
            ${isReal && item.id ? `<p class="text-[9px] text-slate-700 font-mono mt-1.5 truncate" title="${item.id}">ID: ${item.id}</p>` : ''}
        </div>`;

    // ── Assemble Panel ───────────────────────────────────────────────────────
    const html = `
        <div class="h-44 w-full bg-slate-800 relative shrink-0">
            ${bannerUrl ? `<img src="${bannerUrl}" class="w-full h-full object-cover opacity-60" />` : `<div class="w-full h-full bg-gradient-to-br from-primary/30 to-background-dark"></div>`}
            <div class="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent"></div>

            <button onclick="closeExhibitorPanel()" class="absolute top-5 left-5 z-20 size-9 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/10 group">
                <span class="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            </button>

            <div class="absolute -bottom-10 left-6 z-10 flex items-end gap-5 w-[calc(100%-3rem)]">
                <div class="relative shrink-0">
                    ${logoUrl
            ? `<div class="size-[4.5rem] rounded-2xl bg-white p-1 shadow-2xl border-4 border-[#0f172a]"><img src="${logoUrl}" class="w-full h-full object-contain rounded-lg" /></div>`
            : `<div class="size-[4.5rem] rounded-2xl bg-surface-dark border-4 border-border-dark shadow-2xl flex items-center justify-center text-primary text-2xl font-black">${initials}</div>`
        }
                </div>
                <div class="pb-1 min-w-0 flex-1">
                    <h2 class="text-xl font-black text-white tracking-tight mb-1 truncate">${name}</h2>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[9px] uppercase font-black tracking-widest">${type}</span>
                        ${eventGroup ? `<span class="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[9px] uppercase font-black tracking-widest">${eventGroup.name}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 pt-16 space-y-7">
            ${badgesHtml}
            ${statsHtml}
            ${descSection}
            ${contactSection}
            ${socialsHtml}
            ${boothSection}
            ${membersSection}
            ${docsSection}
            ${featuresSection}
            ${metaSection}
        </div>

        <!-- Footer Actions -->
        <div class="p-5 border-t border-border-dark/60 bg-white/2 shrink-0">
            <div class="flex gap-3">
                <button onclick="event.stopPropagation(); window.syncSpecificExhibitor && window.syncSpecificExhibitor('${isReal ? item.id : id}')" class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">cloud_sync</span>
                    Sync Updates
                </button>
                <button class="px-4 py-2.5 bg-surface-hover hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all border border-border-dark/60 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                </button>
            </div>
        </div>
    `;

    const content = document.getElementById('exhibitor-panel-content');
    if (content) content.innerHTML = html;
}


function generateSubpages() {
    console.log('[Subpages] 🛠️  Generating dynamic subpage views...');
    const container = document.querySelector('main');
    if (!container) {
        console.error('[Subpages] ❌ Main container not found!');
        return;
    }

    subpagesConfig.forEach(page => {
        const div = document.createElement('div');
        div.id = `view-${page.id}`;
        div.className = 'flex-1 overflow-y-auto p-8 hidden';
        let extraButtons = '';
        let tabsHtml = `
                    <button class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover rounded-lg border border-border-dark/60 shadow-sm whitespace-nowrap">All</button>
                    <button class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Active</button>
                    <button class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Archived</button>
                `;
        let viewToggles = `
                     <button class="p-1.5 text-slate-400 hover:text-white rounded bg-surface-hover border border-border-dark/60 transition-colors"><span class="material-symbols-outlined text-[18px] block">grid_view</span></button>
                     <button class="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                `;

        if (page.id === 'exhibitors') {
            tabsHtml = `
                        <button data-ex-tab="all" onclick="setExFilterTab('all')" class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover rounded-lg border border-border-dark/60 shadow-sm whitespace-nowrap transition-colors">All</button>
                        <button data-ex-tab="no-logo" onclick="setExFilterTab('no-logo')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">No Logo</button>
                        <button data-ex-tab="zero-members" onclick="setExFilterTab('zero-members')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">0 Members</button>
                        <button data-ex-tab="zero-leads" onclick="setExFilterTab('zero-leads')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">0 Leads</button>
                    `;
            viewToggles = `
                         <div class="relative inline-block">
                             <button onclick="window.toggleExSettings(event)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors tooltip hover:bg-white/5" title="Column Settings"><span class="material-symbols-outlined text-[18px] block">tune</span></button>
                             <div id="ex-settings-dropdown" class="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 p-2 glass-dark">
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('industry')" ${exVisibleColumns.industry ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Industry</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('events')" ${exVisibleColumns.events ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Events</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('onboarding')" ${exVisibleColumns.onboarding ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Onboarding</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('booth')" ${exVisibleColumns.booth ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Booth</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('members')" ${exVisibleColumns.members ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Members</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('leads')" ${exVisibleColumns.leads ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Leads</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('createdOn')" ${exVisibleColumns.createdOn ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Created On</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleExColumn('updatedOn')" ${exVisibleColumns.updatedOn ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Updated On</label>
                             </div>
                         </div>
                         <button id="view-ex-grid" onclick="setExhibitorView('grid')" class="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors tooltip" title="Grid View"><span class="material-symbols-outlined text-[18px] block">grid_view</span></button>
                         <button id="view-ex-table" onclick="setExhibitorView('table')" class="p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip" title="Table View"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                    `;
        }

        if (page.id === 'people' || page.id === 'speakers') {
            tabsHtml = `
                        <button data-people-tab="all" onclick="setPeopleFilterTab('all')" class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover rounded-lg border border-border-dark/60 shadow-sm whitespace-nowrap transition-colors">All</button>
                        <button data-people-tab="speakers" onclick="setPeopleFilterTab('speakers')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Speakers</button>
                        <button data-people-tab="featured" onclick="setPeopleFilterTab('featured')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Featured</button>
                        <button data-people-tab="no-email" onclick="setPeopleFilterTab('no-email')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">No Email</button>
                        <button data-people-tab="no-org" onclick="setPeopleFilterTab('no-org')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">No Organization</button>
                    `;
            viewToggles = `
                         <div class="relative inline-block">
                             <button onclick="window.togglePeopleSettings(event)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors tooltip hover:bg-white/5" title="Column Settings"><span class="material-symbols-outlined text-[18px] block">tune</span></button>
                             <div id="people-settings-dropdown" class="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 p-2 glass-dark">
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('jobTitle')" ${peopleVisibleColumns.jobTitle ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Job Title</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('organization')" ${peopleVisibleColumns.organization ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Organization</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('type')" ${peopleVisibleColumns.type ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Type/Role</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('email')" ${peopleVisibleColumns.email ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Email</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('events')" ${peopleVisibleColumns.events ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Events</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('createdOn')" ${peopleVisibleColumns.createdOn ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Created On</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="togglePeopleColumn('updatedOn')" ${peopleVisibleColumns.updatedOn ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Updated On</label>
                             </div>
                         </div>
                         <button class="p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip" title="Table View"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                    `;
        }

        if (page.id === 'sessions') {
            tabsHtml = `
                        <button data-sessions-tab="all" onclick="setSessionsFilterTab('all')" class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover rounded-lg border border-border-dark/60 shadow-sm whitespace-nowrap transition-colors">All</button>
                        <button data-sessions-tab="keynote" onclick="setSessionsFilterTab('keynote')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Keynotes</button>
                        <button data-sessions-tab="panel" onclick="setSessionsFilterTab('panel')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Panels</button>
                        <button data-sessions-tab="workshop" onclick="setSessionsFilterTab('workshop')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Workshops</button>
                        <button data-sessions-tab="virtual" onclick="setSessionsFilterTab('virtual')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Virtual</button>
                    `;
            viewToggles = `
                         <div class="relative inline-block">
                             <button onclick="window.toggleSessionsSettings(event)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors tooltip hover:bg-white/5" title="Column Settings"><span class="material-symbols-outlined text-[18px] block">tune</span></button>
                             <div id="sessions-settings-dropdown" class="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 p-2 glass-dark">
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('type')" ${sessionsVisibleColumns.type ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Type</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('format')" ${sessionsVisibleColumns.format ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Format</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('datetime')" ${sessionsVisibleColumns.datetime ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Date & Time</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('duration')" ${sessionsVisibleColumns.duration ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Duration</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('speakers')" ${sessionsVisibleColumns.speakers ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Speakers</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('location')" ${sessionsVisibleColumns.location ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Location</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSessionsColumn('attendees')" ${sessionsVisibleColumns.attendees ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Attendees</label>
                             </div>
                         </div>
                         <button class="p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip" title="Table View"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                    `;
        }

        if (page.id === 'sponsors') {
            tabsHtml = `
                        <button data-sponsors-tab="all" onclick="setSponsorsFilterTab('all')" class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover rounded-lg border border-border-dark/60 shadow-sm whitespace-nowrap transition-colors">All</button>
                        <button data-sponsors-tab="platinum" onclick="setSponsorsFilterTab('platinum')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Platinum</button>
                        <button data-sponsors-tab="gold" onclick="setSponsorsFilterTab('gold')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Gold</button>
                        <button data-sponsors-tab="silver" onclick="setSponsorsFilterTab('silver')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Silver</button>
                        <button data-sponsors-tab="no-logo" onclick="setSponsorsFilterTab('no-logo')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">No Logo</button>
                    `;
            viewToggles = `
                         <div class="relative inline-block">
                             <button onclick="window.toggleSponsorsSettings(event)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors tooltip hover:bg-white/5" title="Column Settings"><span class="material-symbols-outlined text-[18px] block">tune</span></button>
                             <div id="sponsors-settings-dropdown" class="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 p-2 glass-dark">
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('tier')" ${sponsorsVisibleColumns.tier ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Tier/Category</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('type')" ${sponsorsVisibleColumns.type ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Type</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('website')" ${sponsorsVisibleColumns.website ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Website</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('events')" ${sponsorsVisibleColumns.events ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Events</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('status')" ${sponsorsVisibleColumns.status ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Status</label>
                                <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleSponsorsColumn('createdOn')" ${sponsorsVisibleColumns.createdOn ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Created On</label>
                             </div>
                         </div>
                         <button class="p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip" title="Table View"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                    `;
        }

        if (page.id === 'events') {
            extraButtons = `
                        <div class="relative group inline-block mr-2">
                            <button onclick="toggleSavedViewsDropdown(event)" class="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-border-dark/60 text-white text-sm rounded-lg hover:bg-surface-hover transition-colors shadow-sm min-w-[140px]">
                                <span class="material-symbols-outlined text-[18px] text-primary">visibility</span>
                                <span id="current-view-name" class="truncate max-w-[100px]">Default View</span>
                                <span class="material-symbols-outlined text-[16px] text-slate-500 ml-auto">expand_more</span>
                            </button>
                            <div id="saved-views-dropdown" class="absolute left-0 top-full mt-2 w-64 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 p-2 backdrop-blur-md bg-opacity-95">
                                <div class="px-3 py-2 border-b border-border-dark/40 mb-1">
                                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saved Views</span>
                                </div>
                                <div id="saved-views-list" class="space-y-1 mb-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    <!-- Views will be injected here -->
                                </div>
                                <div class="border-t border-border-dark/40 pt-2 pb-1 px-1">
                                    <button onclick="promptSaveView()" class="w-full text-left px-3 py-2 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-2 transition-colors">
                                        <span class="material-symbols-outlined text-[16px]">add_circle</span>
                                        Save current as new...
                                    </button>
                                </div>
                            </div>
                        </div>

                        <select id="events-year-filter" onchange="setEventsYear(this.value)" class="bg-surface-dark border border-border-dark/60 text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center]">
                            <option value="All">All Years</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                        <button onclick="exportEventsToExcel()" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-100 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 hover:border-emerald-400 rounded-lg transition-colors shadow-sm shrink-0"><span class="material-symbols-outlined text-[18px]">download</span>Export</button>
                    `;
            tabsHtml = `
                        <button id="tab-ev-Active" onclick="setEventsTab('Active')" class="px-3 py-1.5 text-xs font-medium text-white bg-surface-hover border border-border-dark/60 shadow-sm rounded-lg transition-colors whitespace-nowrap">Active</button>
                        <button id="tab-ev-All" onclick="setEventsTab('All')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">All</button>
                        <button id="tab-ev-Future" onclick="setEventsTab('Future')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Upcoming</button>
                        <button id="tab-ev-Past" onclick="setEventsTab('Past')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Past</button>
                        <button id="tab-ev-Archive" onclick="setEventsTab('Archived')" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap">Archived</button>
                    `;
            viewToggles = `
                         <div class="relative inline-block mr-2">
                             <button onclick="window.toggleEventsSettings(event)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors tooltip hover:bg-white/5" title="Column Settings"><span class="material-symbols-outlined text-[18px] block">tune</span></button>
                             <div id="events-settings-dropdown" class="absolute right-0 top-full mt-2 w-64 bg-[#0f172a] border border-border-dark/60 rounded-xl shadow-2xl hidden z-50 glass-dark max-h-[600px] overflow-y-auto">
                                <div class="sticky top-0 bg-[#0f172a] border-b border-border-dark/40 px-3 py-2 z-10">
                                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Core Metrics</p>
                                </div>
                                <div class="p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('registrations')" ${eventsState.visibleColumns.registrations ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Registrations</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leads')" ${eventsState.visibleColumns.leads ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Leads (Total)</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('exhibitors')" ${eventsState.visibleColumns.exhibitors ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Exhibitors</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('members')" ${eventsState.visibleColumns.members ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Members</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('speakers')" ${eventsState.visibleColumns.speakers ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Speakers</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('sessions')" ${eventsState.visibleColumns.sessions ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Sessions</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('sponsors')" ${eventsState.visibleColumns.sponsors ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Sponsors</label>
                                </div>
                                <div class="sticky top-[42px] bg-[#0f172a] border-b border-t border-border-dark/40 px-3 py-2 z-10">
                                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Leads Breakdown</p>
                                </div>
                                <div class="p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsViews')" ${eventsState.visibleColumns.leadsViews ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Views</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsBookmarks')" ${eventsState.visibleColumns.leadsBookmarks ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Bookmarks</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsConnections')" ${eventsState.visibleColumns.leadsConnections ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Connections</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsScans')" ${eventsState.visibleColumns.leadsScans ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Badge Scans</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsContacts')" ${eventsState.visibleColumns.leadsContacts ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Contacts</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsRequests')" ${eventsState.visibleColumns.leadsRequests ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Requests</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsMessages')" ${eventsState.visibleColumns.leadsMessages ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Messages</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('leadsMeetings')" ${eventsState.visibleColumns.leadsMeetings ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Meetings</label>
                                </div>
                                <div class="sticky top-[84px] bg-[#0f172a] border-b border-t border-border-dark/40 px-3 py-2 z-10">
                                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Event Details</p>
                                </div>
                                <div class="p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('status')" ${eventsState.visibleColumns.status ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Status</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('community')" ${eventsState.visibleColumns.community ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Community</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('startDate')" ${eventsState.visibleColumns.startDate ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Start Date</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('endDate')" ${eventsState.visibleColumns.endDate ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> End Date</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('duration')" ${eventsState.visibleColumns.duration ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Duration</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('year')" ${eventsState.visibleColumns.year ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Year</label>
                                </div>
                                <div class="sticky top-[126px] bg-[#0f172a] border-b border-t border-border-dark/40 px-3 py-2 z-10">
                                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</p>
                                </div>
                                <div class="p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('city')" ${eventsState.visibleColumns.city ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> City</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('country')" ${eventsState.visibleColumns.country ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Country</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('venue')" ${eventsState.visibleColumns.venue ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Venue</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('timezone')" ${eventsState.visibleColumns.timezone ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Timezone</label>
                                </div>
                                <div class="sticky top-[168px] bg-[#0f172a] border-b border-t border-border-dark/40 px-3 py-2 z-10">
                                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">System</p>
                                </div>
                                <div class="p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('eventId')" ${eventsState.visibleColumns.eventId ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Event ID</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('createdAt')" ${eventsState.visibleColumns.createdAt ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Created At</label>
                                    <label class="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 font-medium"><input type="checkbox" onchange="toggleEventsColumn('updatedAt')" ${eventsState.visibleColumns.updatedAt ? 'checked' : ''} class="mr-3 accent-primary rounded bg-surface-dark border-border-dark w-3 h-3"> Updated At</label>
                                </div>
                                <div class="border-t border-border-dark/40 p-2 mt-2 space-y-1">
                                    <button onclick="promptSaveView()" class="w-full px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                                        <span class="material-symbols-outlined text-[16px]">save</span>
                                        Save Current View
                                    </button>
                                </div>
                             </div>
                         </div>
                         <button id="view-ev-grid" onclick="setEventsView('grid')" class="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors tooltip" title="Grid View"><span class="material-symbols-outlined text-[18px] block">grid_view</span></button>
                         <button id="view-ev-table" onclick="setEventsView('table')" class="p-1.5 text-white bg-surface-hover border border-border-dark/60 rounded transition-colors tooltip" title="List View"><span class="material-symbols-outlined text-[18px] block">view_list</span></button>
                    `;
        }

        div.innerHTML = `
                    <div class="max-w-[1600px] mx-auto xl:flex gap-10 px-4">
                        <div class="flex-1 min-w-0 space-y-8 pb-10">
                            <!-- Breadcrumbs -->
                            <nav class="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500 mb-[-1.5rem] mt-2">
                                <a href="#" onclick="switchView('dashboard')" class="hover:text-primary transition-colors">Dashboard</a>
                                <span class="material-symbols-outlined text-[10px] opacity-40">chevron_right</span>
                                <span class="text-slate-300">${page.title} Directory</span>
                            </nav>

                            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
                                <div>
                                    <h1 class="text-4xl font-extrabold text-white mb-2 flex items-center gap-4 tracking-tight">
                                        <div class="size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                                            <span class="material-symbols-outlined text-primary text-[28px] block">${page.icon}</span>
                                        </div>
                                        ${page.title}
                                    </h1>
                                    <p class="text-slate-400 text-sm font-medium pl-1">${page.desc}</p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="relative hidden sm:block">
                                        <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
                                        <input id="search-${page.id}" oninput="handleSearch('${page.id}')" class="bg-surface-dark/50 border border-border-dark/60 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 w-72 focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder-slate-500 transition-all outline-none glass-dark" placeholder="Search ${page.title.toLowerCase()}..." type="text"/>
                                    </div>
                                    ${extraButtons}
                                    <button onclick="openActivityModal('${page.id}')" class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-300 bg-surface-dark border border-border-dark/60 hover:bg-surface-hover hover:border-border-dark rounded-xl transition-all shadow-md group">
                                        <span class="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary transition-colors">history</span>
                                        Activity Logs
                                    </button>
                                    ${page.btn ? `<button onclick="handleNewAction('${page.id}')" class="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-all shadow-xl shadow-primary/20 transform active:scale-95">
                                        <span class="material-symbols-outlined text-[18px]">add</span>
                                        ${page.btn}
                                    </button>` : ''}
                                </div>
                            </div>

                            <!-- Main Content Block -->
                            <div class="bg-surface-dark/30 border border-border-dark/50 rounded-2xl overflow-hidden flex flex-col min-h-[600px] shadow-2xl glass-dark relative group/card">
                                <div class="absolute inset-x-0 h-px top-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50"></div>
                                
                                <div class="flex items-center justify-between p-4 border-b border-border-dark/50 bg-white/2">
                                    <div class="flex items-center gap-1.5">
                                        ${tabsHtml}
                                    </div>
                                    <div class="flex items-center gap-2 pl-4">
                                        <div class="h-6 w-px bg-border-dark/40 mx-2"></div>
                                        ${viewToggles}
                                    </div>
                                </div>

                                <div id="content-${page.id}" class="flex-1 flex flex-col overflow-x-auto">
                                    <div class="flex-1 flex flex-col items-center justify-center text-center p-20">
                                        <div class="size-24 rounded-[2rem] bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center text-primary mb-8 ring-1 ring-primary/30 shadow-inner shimmer">
                                            <span class="material-symbols-outlined text-[48px] opacity-80">${page.icon}</span>
                                        </div>
                                        <h3 class="text-2xl font-bold text-white mb-3 tracking-tight">System Ready</h3>
                                        <p class="text-slate-400 text-sm max-w-sm mb-10 leading-relaxed">Start by synchronizing with Swapcard or adding a new record to see your data here.</p>
                                        <button onclick="syncSubpage('${page.id}')" class="flex items-center gap-3 px-8 py-3 bg-surface-hover hover:scale-105 active:scale-95 text-white rounded-xl text-sm font-bold transition-all border border-border-dark/50 shadow-lg group">
                                            <span class="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform duration-700">cloud_sync</span>
                                            Sync Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sidebar removed to prefer top bar Modal -->
                    </div>
                `;
        container.appendChild(div);

        // Don't render yet - data will be loaded by loadEvents() first
        // if (page.id !== 'events') {
        //     renderSubpageMocks(page.id);
        // }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR RENDERING
// ═══════════════════════════════════════════════════════════════════════════

// Helper: Format date/time for sessions
function formatDateTime(date) {
    if (!date) return '<span class="text-slate-600 text-[11px]">-</span>';
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `<span class="text-slate-300 text-[11px] font-medium">${dateStr} <span class="text-slate-500">·</span> ${timeStr}</span>`;
}

// Helper: Calculate duration between two dates
function calculateDuration(beginsAt, endsAt) {
    if (!beginsAt || !endsAt) return '-';
    const start = new Date(beginsAt);
    const end = new Date(endsAt);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}


// ===================================================================
// COMPREHENSIVE RENDERING FUNCTIONS FOR PEOPLE, SESSIONS, SPONSORS
// ===================================================================

function renderPeopleTable(pageId, rawData, searchQuery) {
    console.log('[Render] 👥 Rendering people/speakers page');
    const baseData = pageId === 'speakers' ? rawData.filter(p => typeof p === 'object' && p.type && p.type.toLowerCase().includes('speaker')) : rawData;

    let filtered = baseData;

    if (searchQuery) {
        filtered = filtered.filter(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            const jobMatch = (p.jobTitle || '').toLowerCase().includes(searchQuery);
            const orgMatch = (p.organization || '').toLowerCase().includes(searchQuery);
            const emailMatch = (p.email || '').toLowerCase().includes(searchQuery);
            return fullName.includes(searchQuery) || jobMatch || orgMatch || emailMatch;
        });
    }

    // Filter tab logic
    if (peopleFilterTab === 'speakers') {
        filtered = filtered.filter(p => p.type && p.type.toLowerCase().includes('speaker'));
    } else if (peopleFilterTab === 'featured') {
        filtered = filtered.filter(p => p.type && p.type.toLowerCase().includes('featured'));
    } else if (peopleFilterTab === 'no-email') {
        filtered = filtered.filter(p => !p.email || p.email.trim() === '');
    } else if (peopleFilterTab === 'no-org') {
        filtered = filtered.filter(p => !p.organization || p.organization.trim() === '');
    }

    // Sorting
    if (peopleSortColumn) {
        filtered.sort((a, b) => {
            let valA, valB;
            switch (peopleSortColumn) {
                case 'name':
                    valA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
                    valB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
                    return peopleSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'jobTitle':
                    valA = (a.jobTitle || '').toLowerCase();
                    valB = (b.jobTitle || '').toLowerCase();
                    return peopleSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'organization':
                    valA = (a.organization || '').toLowerCase();
                    valB = (b.organization || '').toLowerCase();
                    return peopleSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'type':
                    valA = (a.type || '').toLowerCase();
                    valB = (b.type || '').toLowerCase();
                    return peopleSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default:
                    return 0;
            }
        });
    }

    const totalPeople = filtered.length;
    let withEmail = 0;
    let withOrganization = 0;
    let speakers = 0;
    let featured = 0;

    filtered.forEach(p => {
        if (p.email && p.email.trim()) withEmail++;
        if (p.organization && p.organization.trim()) withOrganization++;
        if (p.type && p.type.toLowerCase().includes('speaker')) speakers++;
        if (p.type && p.type.toLowerCase().includes('featured')) featured++;
    });

    const missingInfo = totalPeople - Math.max(withEmail, withOrganization);

    // Pagination
    const totalPages = Math.ceil(totalPeople / peopleItemsPerPage) || 1;
    const startIndex = (peopleCurrentPage - 1) * peopleItemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + peopleItemsPerPage);

    const sortIcon = (col) => {
        if (peopleSortColumn !== col) return '<span class="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">unfold_more</span>';
        return peopleSortDirection === 'asc'
            ? '<span class="material-symbols-outlined text-[14px] text-primary">arrow_upward</span>'
            : '<span class="material-symbols-outlined text-[14px] text-primary">arrow_downward</span>';
    };

    const formatDate = (date) => {
        if (!date) return '<span class="text-slate-600 text-[11px]">-</span>';
        const d = new Date(date);
        return `<span class="text-slate-300 text-[11px] font-medium">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
    };

    return `
        <div class="flex-1 flex flex-col min-h-0 bg-background-dark">
            <!-- Stats Bar -->
            <div class="px-6 pt-6 pb-4 border-b border-border-dark/40 bg-gradient-to-b from-background-dark/80 to-transparent backdrop-blur-sm sticky top-0 z-30">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div class="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-3 hover:shadow-lg hover:shadow-primary/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Total People</span>
                            <span class="material-symbols-outlined text-primary text-[16px]">groups</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${totalPeople}</p>
                    </div>
                    <div class="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border border-violet-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-violet-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Speakers</span>
                            <span class="material-symbols-outlined text-violet-400 text-[16px]">podium</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${speakers}</p>
                    </div>
                    <div class="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">With Email</span>
                            <span class="material-symbols-outlined text-amber-400 text-[16px]">mail</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${withEmail}</p>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">With Org</span>
                            <span class="material-symbols-outlined text-emerald-400 text-[16px]">business</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${withOrganization}</p>
                    </div>
                    <div class="bg-gradient-to-br from-rose-500/5 to-rose-500/10 border border-rose-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-rose-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Featured</span>
                            <span class="material-symbols-outlined text-rose-400 text-[16px]">star</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${featured}</p>
                    </div>
                    <div class="bg-gradient-to-br from-slate-500/5 to-slate-500/10 border border-slate-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-slate-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Missing Info</span>
                            <span class="material-symbols-outlined text-slate-400 text-[16px]">error</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${missingInfo}</p>
                    </div>
                </div>
            </div>

            <!-- Table Container -->
            <div class="flex-1 overflow-auto custom-scrollbar">
                <div class="min-w-full inline-block align-middle">
                    <table class="min-w-full border-collapse">
                        <thead class="bg-[#0a0e1a] sticky top-0 z-20 shadow-sm">
                            <tr class="border-b border-border-dark/60">
                                <th onclick="setPeopleSortColumn('name')" class="px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Person</span>
                                        ${sortIcon('name')}
                                    </div>
                                </th>
                                ${peopleVisibleColumns.jobTitle ? `<th onclick="setPeopleSortColumn('jobTitle')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Job Title</span>
                                        ${sortIcon('jobTitle')}
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.organization ? `<th onclick="setPeopleSortColumn('organization')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Organization</span>
                                        ${sortIcon('organization')}
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.type ? `<th onclick="setPeopleSortColumn('type')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Type/Role</span>
                                        ${sortIcon('type')}
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.email ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Email</span>
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.events ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Events</span>
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.createdOn ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Created On</span>
                                    </div>
                                </th>` : ''}
                                ${peopleVisibleColumns.updatedOn ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Updated On</span>
                                    </div>
                                </th>` : ''}
                                <th class="px-3 py-3 pr-4 text-right">
                                    <div class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Actions</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-background-dark divide-y divide-border-dark/30">
                            ${paginatedItems.map((item, idx) => {
        const isReal = typeof item === 'object';
        const firstName = isReal ? (item.firstName || '') : 'Jane';
        const lastName = isReal ? (item.lastName || '') : `Doe ${idx}`;
        const fullName = `${firstName} ${lastName}`.trim();
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'JD';
        const jobTitle = isReal ? (item.jobTitle || '-') : 'Senior Specialist';
        const organization = isReal ? (item.organization || '-') : 'TechOrg';
        const email = isReal ? (item.email || '-') : 'email@example.com';
        const type = isReal ? (item.type || 'Attendee') : 'Attendee';
        const createdDate = isReal && item.createdAt ? item.createdAt : null;
        const updatedDate = isReal && item.updatedAt ? item.updatedAt : null;

        return `
                                <tr onclick="openPersonDetails('${isReal ? item.id : idx}')" class="group hover:bg-surface-hover/40 cursor-pointer transition-all border-b border-border-dark/20">
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-3">
                                            <div class="size-10 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center text-white text-xs font-bold border border-primary/30 shadow-lg shrink-0">
                                                ${initials}
                                            </div>
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">${fullName}</p>
                                                <p class="text-[11px] text-slate-500 truncate">${organization}</p>
                                            </div>
                                        </div>
                                    </td>
                                    ${peopleVisibleColumns.jobTitle ? `<td class="px-3 py-3">
                                        <span class="text-[11px] text-slate-300">${jobTitle}</span>
                                    </td>` : ''}
                                    ${peopleVisibleColumns.organization ? `<td class="px-3 py-3">
                                        <span class="text-[11px] text-slate-300">${organization}</span>
                                    </td>` : ''}
                                    ${peopleVisibleColumns.type ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${type.toLowerCase().includes('speaker') ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30' : type.toLowerCase().includes('featured') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'}">${type}</span>
                                    </td>` : ''}
                                    ${peopleVisibleColumns.email ? `<td class="px-3 py-3">
                                        ${email !== '-' ? `<a href="mailto:${email}" onclick="event.stopPropagation()" class="text-[11px] text-primary hover:text-primary-hover hover:underline">${email}</a>` : '<span class="text-slate-600 text-[11px]">-</span>'}
                                    </td>` : ''}
                                    ${peopleVisibleColumns.events ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/30">
                                            <span class="material-symbols-outlined text-[12px]">event</span>
                                            1 event
                                        </span>
                                    </td>` : ''}
                                    ${peopleVisibleColumns.createdOn ? `<td class="px-3 py-3">${formatDate(createdDate)}</td>` : ''}
                                    ${peopleVisibleColumns.updatedOn ? `<td class="px-3 py-3">${formatDate(updatedDate)}</td>` : ''}
                                    <td class="px-3 py-3 pr-4">
                                        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="size-6 rounded text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all" title="View Details">
                                                <span class="material-symbols-outlined text-[14px]">visibility</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
    }).join('') + Array.from({ length: Math.max(0, peopleItemsPerPage - paginatedItems.length) }).map(() => '<tr class="border-0 h-[48px]"></tr>').join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div class="px-6 py-4 border-t border-border-dark/60 flex items-center justify-between bg-[#0f172a] sticky bottom-0 z-20">
                    <div class="flex items-center gap-4">
                        <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Showing <span class="text-white">${totalPeople > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + peopleItemsPerPage, totalPeople)}</span> of <span class="text-white">${totalPeople}</span> people</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                            <select onchange="setPeoplePageSize(this.value)" class="bg-surface-dark border border-border-dark/60 text-white text-xs rounded-lg pl-2 pr-6 py-1 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer outline-none appearance-none font-mono shadow-sm bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center]">
                                <option value="10" ${peopleItemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="25" ${peopleItemsPerPage === 25 ? 'selected' : ''}>25</option>
                                <option value="50" ${peopleItemsPerPage === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${peopleItemsPerPage === 100 ? 'selected' : ''}>100</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 bg-background-dark/50 p-1 rounded-xl border border-border-dark/40 shadow-inner">
                        <button onclick="setPeoplePage(${peopleCurrentPage > 1 ? peopleCurrentPage - 1 : 1})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${peopleCurrentPage > 1 ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${peopleCurrentPage <= 1 ? 'disabled' : ''}>Prev</button>
                        <div class="px-3 text-[11px] font-mono font-bold text-white tracking-widest">${peopleCurrentPage} <span class="text-slate-500">/</span> ${totalPages}</div>
                        <button onclick="setPeoplePage(${peopleCurrentPage < totalPages ? peopleCurrentPage + 1 : totalPages})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${peopleCurrentPage < totalPages ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${peopleCurrentPage >= totalPages ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>
        </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// PERSON PANEL RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderPersonPanel(item, id) {
    const isReal = typeof item === 'object';
    const firstName = isReal ? (item.firstName || '') : 'Jane';
    const lastName = isReal ? (item.lastName || '') : `Doe ${id}`;
    const fullName = `${firstName} ${lastName}`.trim();
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'JD';
    const jobTitle = isReal ? (item.jobTitle || 'Attendee') : 'Senior Specialist';
    const organization = isReal ? (item.organization || 'N/A') : 'TechOrg Inc.';
    const email = isReal ? (item.email || null) : 'email@example.com';
    const type = isReal ? (item.type || 'Attendee') : 'Attendee';

    const isSpeaker = type.toLowerCase().includes('speaker');
    const isFeatured = type.toLowerCase().includes('featured');

    // Contact section
    const contactSection = email ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-primary text-[18px]">contact_mail</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Contact Information</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40 space-y-3">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-slate-500 text-[18px] mt-0.5">mail</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email</p>
                        <a href="mailto:${email}" class="text-sm text-primary hover:text-primary-hover hover:underline break-all">${email}</a>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    // Organization section
    const orgSection = organization !== 'N/A' ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-violet-400 text-[18px]">business</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Organization</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <p class="text-sm font-semibold text-white mb-1">${organization}</p>
                <p class="text-xs text-slate-400">${jobTitle}</p>
            </div>
        </div>
    ` : '';

    // Badges
    const badgesHtml = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-amber-400 text-[18px]">badge</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Role & Status</h3>
            </div>
            <div class="flex flex-wrap gap-2">
                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${isSpeaker ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30' : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'}">
                    <span class="material-symbols-outlined text-[14px] mr-1.5">${isSpeaker ? 'podium' : 'person'}</span>
                    ${type}
                </span>
                ${isFeatured ? '<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30"><span class="material-symbols-outlined text-[14px] mr-1.5">star</span>Featured</span>' : ''}
            </div>
        </div>
    `;

    const html = `
        <!-- Close Button -->
        <button onclick="closePersonPanel()" class="absolute top-6 right-6 z-50 size-10 rounded-full bg-background-dark/80 hover:bg-background-dark border border-border-dark/60 hover:border-primary/40 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg backdrop-blur-sm">
            <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Header -->
        <div class="relative overflow-hidden shrink-0 bg-gradient-to-br from-primary/10 via-violet-500/5 to-background-dark border-b border-border-dark/60 p-8">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_50%)]"></div>
            <div class="relative flex items-start gap-5">
                <div class="size-20 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center text-white text-2xl font-bold border-2 border-primary/40 shadow-2xl shadow-primary/20 shrink-0">
                    ${initials}
                </div>
                <div class="pb-1 min-w-0 flex-1">
                    <h2 class="text-xl font-black text-white tracking-tight mb-1 truncate">${fullName}</h2>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm text-slate-300">${jobTitle}</span>
                        ${organization !== 'N/A' ? `<span class="text-slate-600">·</span><span class="text-sm text-slate-400">${organization}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 pt-16 space-y-7">
            ${badgesHtml}
            ${contactSection}
            ${orgSection}
        </div>

        <!-- Footer Actions -->
        <div class="p-5 border-t border-border-dark/60 bg-white/2 shrink-0">
            <div class="flex gap-3">
                <button class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">mail</span>
                    Send Email
                </button>
                <button class="px-4 py-2.5 bg-surface-hover hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all border border-border-dark/60 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                </button>
            </div>
        </div>
    `;

    const content = document.getElementById('person-panel-content');
    if (content) content.innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════════════════
// SESSIONS RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderSessionsTable(pageId, rawData, searchQuery) {
    console.log('[Render] 🎤 Rendering sessions page');

    let filtered = rawData;

    if (searchQuery) {
        filtered = filtered.filter(s => {
            const titleMatch = (s.title || '').toLowerCase().includes(searchQuery);
            const typeMatch = (s.type || '').toLowerCase().includes(searchQuery);
            const locationMatch = (s.location || '').toLowerCase().includes(searchQuery);
            return titleMatch || typeMatch || locationMatch;
        });
    }

    // Filter tab logic
    if (sessionsFilterTab === 'keynote') {
        filtered = filtered.filter(s => s.type && s.type.toLowerCase().includes('keynote'));
    } else if (sessionsFilterTab === 'panel') {
        filtered = filtered.filter(s => s.type && s.type.toLowerCase().includes('panel'));
    } else if (sessionsFilterTab === 'workshop') {
        filtered = filtered.filter(s => s.type && s.type.toLowerCase().includes('workshop'));
    } else if (sessionsFilterTab === 'virtual') {
        filtered = filtered.filter(s => s.format === 'VIRTUAL');
    }

    // Sorting
    if (sessionsSortColumn) {
        filtered.sort((a, b) => {
            let valA, valB;
            switch (sessionsSortColumn) {
                case 'title':
                    valA = (a.title || '').toLowerCase();
                    valB = (b.title || '').toLowerCase();
                    return sessionsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'type':
                    valA = (a.type || '').toLowerCase();
                    valB = (b.type || '').toLowerCase();
                    return sessionsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'format':
                    valA = (a.format || '').toLowerCase();
                    valB = (b.format || '').toLowerCase();
                    return sessionsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'datetime':
                    valA = a.beginsAt ? new Date(a.beginsAt).getTime() : 0;
                    valB = b.beginsAt ? new Date(b.beginsAt).getTime() : 0;
                    return sessionsSortDirection === 'asc' ? valA - valB : valB - valA;
                default:
                    return 0;
            }
        });
    }

    const now = new Date();
    const totalSessions = filtered.length;
    let keynotes = 0;
    let panels = 0;
    let workshops = 0;
    let virtual = 0;
    let upcoming = 0;

    filtered.forEach(s => {
        const type = (s.type || '').toLowerCase();
        if (type.includes('keynote')) keynotes++;
        if (type.includes('panel')) panels++;
        if (type.includes('workshop')) workshops++;
        if (s.format === 'VIRTUAL') virtual++;
        if (s.beginsAt && new Date(s.beginsAt) > now) upcoming++;
    });

    // Pagination
    const totalPages = Math.ceil(totalSessions / sessionsItemsPerPage) || 1;
    const startIndex = (sessionsCurrentPage - 1) * sessionsItemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + sessionsItemsPerPage);

    const sortIcon = (col) => {
        if (sessionsSortColumn !== col) return '<span class="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">unfold_more</span>';
        return sessionsSortDirection === 'asc'
            ? '<span class="material-symbols-outlined text-[14px] text-primary">arrow_upward</span>'
            : '<span class="material-symbols-outlined text-[14px] text-primary">arrow_downward</span>';
    };

    const formatDate = (date) => {
        if (!date) return '<span class="text-slate-600 text-[11px]">-</span>';
        const d = new Date(date);
        return `<span class="text-slate-300 text-[11px] font-medium">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
    };

    const formatDateTime = (date) => {
        if (!date) return '<span class="text-slate-600 text-[11px]">TBA</span>';
        const d = new Date(date);
        return `<div class="text-[11px]">
            <p class="text-slate-300 font-medium">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            <p class="text-slate-500">${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>`;
    };

    const calculateDuration = (beginsAt, endsAt) => {
        if (!beginsAt || !endsAt) return '-';
        const start = new Date(beginsAt);
        const end = new Date(endsAt);
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return `
        <div class="flex-1 flex flex-col min-h-0 bg-background-dark">
            <!-- Stats Bar -->
            <div class="px-6 pt-6 pb-4 border-b border-border-dark/40 bg-gradient-to-b from-background-dark/80 to-transparent backdrop-blur-sm sticky top-0 z-30">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div class="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-3 hover:shadow-lg hover:shadow-primary/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Total Sessions</span>
                            <span class="material-symbols-outlined text-primary text-[16px]">calendar_month</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${totalSessions}</p>
                    </div>
                    <div class="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border border-violet-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-violet-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Keynotes</span>
                            <span class="material-symbols-outlined text-violet-400 text-[16px]">stars</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${keynotes}</p>
                    </div>
                    <div class="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Panels</span>
                            <span class="material-symbols-outlined text-amber-400 text-[16px]">group_work</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${panels}</p>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Workshops</span>
                            <span class="material-symbols-outlined text-emerald-400 text-[16px]">handyman</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${workshops}</p>
                    </div>
                    <div class="bg-gradient-to-br from-rose-500/5 to-rose-500/10 border border-rose-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-rose-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Virtual</span>
                            <span class="material-symbols-outlined text-rose-400 text-[16px]">videocam</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${virtual}</p>
                    </div>
                    <div class="bg-gradient-to-br from-slate-500/5 to-slate-500/10 border border-slate-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-slate-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Upcoming</span>
                            <span class="material-symbols-outlined text-slate-400 text-[16px]">schedule</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${upcoming}</p>
                    </div>
                </div>
            </div>

            <!-- Table Container -->
            <div class="flex-1 overflow-auto custom-scrollbar">
                <div class="min-w-full inline-block align-middle">
                    <table class="min-w-full border-collapse">
                        <thead class="bg-[#0a0e1a] sticky top-0 z-20 shadow-sm">
                            <tr class="border-b border-border-dark/60">
                                <th onclick="setSessionsSortColumn('title')" class="px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Session Title</span>
                                        ${sortIcon('title')}
                                    </div>
                                </th>
                                ${sessionsVisibleColumns.type ? `<th onclick="setSessionsSortColumn('type')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Type</span>
                                        ${sortIcon('type')}
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.format ? `<th onclick="setSessionsSortColumn('format')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Format</span>
                                        ${sortIcon('format')}
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.datetime ? `<th onclick="setSessionsSortColumn('datetime')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Date & Time</span>
                                        ${sortIcon('datetime')}
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.duration ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Duration</span>
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.speakers ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Speakers</span>
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.location ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Location</span>
                                    </div>
                                </th>` : ''}
                                ${sessionsVisibleColumns.attendees ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Attendees</span>
                                    </div>
                                </th>` : ''}
                                <th class="px-3 py-3 pr-4 text-right">
                                    <div class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Actions</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-background-dark divide-y divide-border-dark/30">
                            ${paginatedItems.map((item, idx) => {
        const isReal = typeof item === 'object';
        const title = isReal ? (item.title || 'Untitled Session') : `Session ${idx + 1}`;
        const type = isReal ? (item.type || 'Session') : 'Panel Discussion';
        const format = isReal ? (item.format || 'PHYSICAL') : 'PHYSICAL';
        const beginsAt = isReal ? item.beginsAt : null;
        const endsAt = isReal ? item.endsAt : null;
        const location = isReal ? (item.location || 'TBA') : 'Main Hall';
        const duration = calculateDuration(beginsAt, endsAt);

        const typeColor = type.toLowerCase().includes('keynote') ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' :
            type.toLowerCase().includes('panel') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                type.toLowerCase().includes('workshop') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    'bg-slate-500/10 text-slate-400 border-slate-500/30';

        const formatColor = format === 'VIRTUAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
            format === 'HYBRID' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                'bg-primary/10 text-primary border-primary/30';

        return `
                                <tr onclick="openSessionDetails('${isReal ? item.id : idx}')" class="group hover:bg-surface-hover/40 cursor-pointer transition-all border-b border-border-dark/20">
                                    <td class="px-4 py-3">
                                        <div class="min-w-0">
                                            <p class="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">${title}</p>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${typeColor} border mt-1">${type}</span>
                                        </div>
                                    </td>
                                    ${sessionsVisibleColumns.type ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${typeColor} border">${type}</span>
                                    </td>` : ''}
                                    ${sessionsVisibleColumns.format ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${formatColor} border">
                                            <span class="material-symbols-outlined text-[12px]">${format === 'VIRTUAL' ? 'videocam' : format === 'HYBRID' ? 'merge' : 'location_on'}</span>
                                            ${format}
                                        </span>
                                    </td>` : ''}
                                    ${sessionsVisibleColumns.datetime ? `<td class="px-3 py-3">${formatDateTime(beginsAt)}</td>` : ''}
                                    ${sessionsVisibleColumns.duration ? `<td class="px-3 py-3">
                                        <span class="text-[11px] text-slate-300">${duration}</span>
                                    </td>` : ''}
                                    ${sessionsVisibleColumns.speakers ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px] font-bold border border-violet-500/30">
                                            <span class="material-symbols-outlined text-[12px]">person</span>
                                            3 speakers
                                        </span>
                                    </td>` : ''}
                                    ${sessionsVisibleColumns.location ? `<td class="px-3 py-3">
                                        <span class="text-[11px] text-slate-300">${location}</span>
                                    </td>` : ''}
                                    ${sessionsVisibleColumns.attendees ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/30">
                                            <span class="material-symbols-outlined text-[12px]">group</span>
                                            ${Math.floor(Math.random() * 200) + 50}
                                        </span>
                                    </td>` : ''}
                                    <td class="px-3 py-3 pr-4">
                                        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="size-6 rounded text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all" title="View Details">
                                                <span class="material-symbols-outlined text-[14px]">visibility</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
    }).join('') + Array.from({ length: Math.max(0, sessionsItemsPerPage - paginatedItems.length) }).map(() => '<tr class="border-0 h-[48px]"></tr>').join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div class="px-6 py-4 border-t border-border-dark/60 flex items-center justify-between bg-[#0f172a] sticky bottom-0 z-20">
                    <div class="flex items-center gap-4">
                        <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Showing <span class="text-white">${totalSessions > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + sessionsItemsPerPage, totalSessions)}</span> of <span class="text-white">${totalSessions}</span> sessions</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                            <select onchange="setSessionsPageSize(this.value)" class="bg-surface-dark border border-border-dark/60 text-white text-xs rounded-lg pl-2 pr-6 py-1 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer outline-none appearance-none font-mono shadow-sm bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center]">
                                <option value="10" ${sessionsItemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="25" ${sessionsItemsPerPage === 25 ? 'selected' : ''}>25</option>
                                <option value="50" ${sessionsItemsPerPage === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${sessionsItemsPerPage === 100 ? 'selected' : ''}>100</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 bg-background-dark/50 p-1 rounded-xl border border-border-dark/40 shadow-inner">
                        <button onclick="setSessionsPage(${sessionsCurrentPage > 1 ? sessionsCurrentPage - 1 : 1})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${sessionsCurrentPage > 1 ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${sessionsCurrentPage <= 1 ? 'disabled' : ''}>Prev</button>
                        <div class="px-3 text-[11px] font-mono font-bold text-white tracking-widest">${sessionsCurrentPage} <span class="text-slate-500">/</span> ${totalPages}</div>
                        <button onclick="setSessionsPage(${sessionsCurrentPage < totalPages ? sessionsCurrentPage + 1 : totalPages})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${sessionsCurrentPage < totalPages ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${sessionsCurrentPage >= totalPages ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>
        </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// SESSION PANEL RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderSessionPanel(item, id) {
    const isReal = typeof item === 'object';
    const title = isReal ? (item.title || 'Untitled Session') : 'Innovation in Technology';
    const type = isReal ? (item.type || 'Session') : 'Keynote';
    const format = isReal ? (item.format || 'PHYSICAL') : 'PHYSICAL';
    const beginsAt = isReal ? item.beginsAt : null;
    const endsAt = isReal ? item.endsAt : null;
    const location = isReal ? (item.location || null) : 'Main Hall, Stage A';
    const description = isReal ? (item.description || null) : null;

    const typeColor = type.toLowerCase().includes('keynote') ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' :
        type.toLowerCase().includes('panel') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            type.toLowerCase().includes('workshop') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                'bg-slate-500/10 text-slate-400 border-slate-500/30';

    const formatColor = format === 'VIRTUAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
        format === 'HYBRID' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            'bg-primary/10 text-primary border-primary/30';

    const calculateDuration = (beginsAt, endsAt) => {
        if (!beginsAt || !endsAt) return null;
        const start = new Date(beginsAt);
        const end = new Date(endsAt);
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins} minutes`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    const duration = calculateDuration(beginsAt, endsAt);

    const formatFullDateTime = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return {
            date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const scheduleInfo = formatFullDateTime(beginsAt);

    // Stats row
    const statsHtml = `
        <div class="grid grid-cols-3 gap-3 mb-6">
            <div class="bg-background-dark/60 rounded-xl p-3 border border-border-dark/40">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-primary text-[16px]">schedule</span>
                    <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Duration</span>
                </div>
                <p class="text-sm font-bold text-white">${duration || 'TBA'}</p>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-3 border border-border-dark/40">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-violet-400 text-[16px]">group</span>
                    <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Expected</span>
                </div>
                <p class="text-sm font-bold text-white">${Math.floor(Math.random() * 200) + 50} attendees</p>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-3 border border-border-dark/40">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-emerald-400 text-[16px]">groups</span>
                    <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Capacity</span>
                </div>
                <p class="text-sm font-bold text-white">500</p>
            </div>
        </div>
    `;

    // Schedule section
    const scheduleSection = scheduleInfo ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Schedule</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-slate-500 text-[18px] mt-0.5">event</span>
                    <div class="flex-1">
                        <p class="text-sm font-semibold text-white mb-1">${scheduleInfo.date}</p>
                        <p class="text-xs text-slate-400">Starts at ${scheduleInfo.time}</p>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    // Description section
    const descriptionSection = description ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-violet-400 text-[18px]">description</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Description</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <p class="text-sm text-slate-300 leading-relaxed">${description}</p>
            </div>
        </div>
    ` : `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-violet-400 text-[18px]">description</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Description</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <p class="text-sm text-slate-400 italic">No description available</p>
            </div>
        </div>
    `;

    // Speakers section
    const speakersSection = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-amber-400 text-[18px]">podium</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Speakers</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-violet-400 text-[18px]">person</span>
                    <p class="text-sm text-slate-300">3 speakers will present at this session</p>
                </div>
            </div>
        </div>
    `;

    // Location section
    const locationSection = location ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-emerald-400 text-[18px]">location_on</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Location</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-slate-500 text-[18px] mt-0.5">${format === 'VIRTUAL' ? 'videocam' : 'place'}</span>
                    <div>
                        <p class="text-sm font-semibold text-white">${location}</p>
                        ${format === 'VIRTUAL' ? '<p class="text-xs text-slate-400 mt-1">Virtual Event</p>' : ''}
                    </div>
                </div>
            </div>
        </div>
    ` : (format === 'VIRTUAL' ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-rose-400 text-[18px]">videocam</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Virtual Event</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-slate-500 text-[18px] mt-0.5">computer</span>
                    <div>
                        <p class="text-sm font-semibold text-white">Online Platform</p>
                        <p class="text-xs text-slate-400 mt-1">Join link will be sent to attendees</p>
                    </div>
                </div>
            </div>
        </div>
    ` : '');

    const html = `
        <!-- Close Button -->
        <button onclick="closeSessionPanel()" class="absolute top-6 right-6 z-50 size-10 rounded-full bg-background-dark/80 hover:bg-background-dark border border-border-dark/60 hover:border-primary/40 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg backdrop-blur-sm">
            <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Header -->
        <div class="relative overflow-hidden shrink-0 bg-gradient-to-br from-violet-500/10 via-primary/5 to-background-dark border-b border-border-dark/60 p-8">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.1),transparent_50%)]"></div>
            <div class="relative">
                <div class="flex items-center gap-2 mb-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${typeColor} border">${type}</span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${formatColor} border">
                        <span class="material-symbols-outlined text-[12px]">${format === 'VIRTUAL' ? 'videocam' : format === 'HYBRID' ? 'merge' : 'location_on'}</span>
                        ${format}
                    </span>
                </div>
                <h2 class="text-2xl font-black text-white tracking-tight mb-2">${title}</h2>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 pt-16 space-y-7">
            ${statsHtml}
            ${scheduleSection}
            ${descriptionSection}
            ${speakersSection}
            ${locationSection}
        </div>

        <!-- Footer Actions -->
        <div class="p-5 border-t border-border-dark/60 bg-white/2 shrink-0">
            <div class="flex gap-3">
                <button class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">event</span>
                    Add to Calendar
                </button>
                <button class="px-4 py-2.5 bg-surface-hover hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all border border-border-dark/60 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">share</span>
                    Share
                </button>
            </div>
        </div>
    `;

    const content = document.getElementById('session-panel-content');
    if (content) content.innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════════════════
// SPONSORS RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderSponsorsTable(pageId, rawData, searchQuery) {
    console.log('[Render] 💎 Rendering sponsors page');

    let filtered = rawData;

    if (searchQuery) {
        filtered = filtered.filter(s => {
            const nameMatch = (s.name || '').toLowerCase().includes(searchQuery);
            const categoryMatch = (s.category || '').toLowerCase().includes(searchQuery);
            const typeMatch = (s.type || '').toLowerCase().includes(searchQuery);
            return nameMatch || categoryMatch || typeMatch;
        });
    }

    // Filter tab logic
    if (sponsorsFilterTab === 'platinum') {
        filtered = filtered.filter(s => {
            const cat = (s.category || '').toLowerCase();
            const typ = (s.type || '').toLowerCase();
            return cat.includes('platinum') || typ.includes('platinum');
        });
    } else if (sponsorsFilterTab === 'gold') {
        filtered = filtered.filter(s => {
            const cat = (s.category || '').toLowerCase();
            const typ = (s.type || '').toLowerCase();
            return cat.includes('gold') || typ.includes('gold');
        });
    } else if (sponsorsFilterTab === 'silver') {
        filtered = filtered.filter(s => {
            const cat = (s.category || '').toLowerCase();
            const typ = (s.type || '').toLowerCase();
            return cat.includes('silver') || typ.includes('silver');
        });
    } else if (sponsorsFilterTab === 'no-logo') {
        filtered = filtered.filter(s => !s.logoUrl || s.logoUrl.trim() === '');
    }

    // Sorting
    if (sponsorsSortColumn) {
        filtered.sort((a, b) => {
            let valA, valB;
            switch (sponsorsSortColumn) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    return sponsorsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'tier':
                    valA = (a.category || '').toLowerCase();
                    valB = (b.category || '').toLowerCase();
                    return sponsorsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'type':
                    valA = (a.type || '').toLowerCase();
                    valB = (b.type || '').toLowerCase();
                    return sponsorsSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default:
                    return 0;
            }
        });
    }

    const totalSponsors = filtered.length;
    let platinum = 0;
    let gold = 0;
    let silver = 0;
    let withLogo = 0;
    let withWebsite = 0;

    filtered.forEach(s => {
        const cat = (s.category || '').toLowerCase();
        const typ = (s.type || '').toLowerCase();
        if (cat.includes('platinum') || typ.includes('platinum')) platinum++;
        if (cat.includes('gold') || typ.includes('gold')) gold++;
        if (cat.includes('silver') || typ.includes('silver')) silver++;
        if (s.logoUrl && s.logoUrl.trim()) withLogo++;
        if (s.externalUrl && s.externalUrl.trim()) withWebsite++;
    });

    // Pagination
    const totalPages = Math.ceil(totalSponsors / sponsorsItemsPerPage) || 1;
    const startIndex = (sponsorsCurrentPage - 1) * sponsorsItemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + sponsorsItemsPerPage);

    const sortIcon = (col) => {
        if (sponsorsSortColumn !== col) return '<span class="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">unfold_more</span>';
        return sponsorsSortDirection === 'asc'
            ? '<span class="material-symbols-outlined text-[14px] text-primary">arrow_upward</span>'
            : '<span class="material-symbols-outlined text-[14px] text-primary">arrow_downward</span>';
    };

    const formatDate = (date) => {
        if (!date) return '<span class="text-slate-600 text-[11px]">-</span>';
        const d = new Date(date);
        return `<span class="text-slate-300 text-[11px] font-medium">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
    };

    const getTierColor = (category, type) => {
        const cat = (category || '').toLowerCase();
        const typ = (type || '').toLowerCase();
        if (cat.includes('platinum') || typ.includes('platinum')) return 'bg-violet-500/10 text-violet-400 border-violet-500/30';
        if (cat.includes('gold') || typ.includes('gold')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        if (cat.includes('silver') || typ.includes('silver')) return 'bg-slate-400/10 text-slate-300 border-slate-400/30';
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    };

    return `
        <div class="flex-1 flex flex-col min-h-0 bg-background-dark">
            <!-- Stats Bar -->
            <div class="px-6 pt-6 pb-4 border-b border-border-dark/40 bg-gradient-to-b from-background-dark/80 to-transparent backdrop-blur-sm sticky top-0 z-30">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div class="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-3 hover:shadow-lg hover:shadow-primary/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Total Sponsors</span>
                            <span class="material-symbols-outlined text-primary text-[16px]">workspace_premium</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${totalSponsors}</p>
                    </div>
                    <div class="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border border-violet-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-violet-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Platinum</span>
                            <span class="material-symbols-outlined text-violet-400 text-[16px]">diamond</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${platinum}</p>
                    </div>
                    <div class="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Gold</span>
                            <span class="material-symbols-outlined text-amber-400 text-[16px]">emoji_events</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${gold}</p>
                    </div>
                    <div class="bg-gradient-to-br from-slate-400/5 to-slate-400/10 border border-slate-400/20 rounded-xl p-3 hover:shadow-lg hover:shadow-slate-400/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Silver</span>
                            <span class="material-symbols-outlined text-slate-300 text-[16px]">military_tech</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${silver}</p>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">With Logo</span>
                            <span class="material-symbols-outlined text-emerald-400 text-[16px]">image</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${withLogo}</p>
                    </div>
                    <div class="bg-gradient-to-br from-rose-500/5 to-rose-500/10 border border-rose-500/20 rounded-xl p-3 hover:shadow-lg hover:shadow-rose-500/10 transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">With Website</span>
                            <span class="material-symbols-outlined text-rose-400 text-[16px]">link</span>
                        </div>
                        <p class="text-2xl font-black text-white tracking-tight">${withWebsite}</p>
                    </div>
                </div>
            </div>

            <!-- Table Container -->
            <div class="flex-1 overflow-auto custom-scrollbar">
                <div class="min-w-full inline-block align-middle">
                    <table class="min-w-full border-collapse">
                        <thead class="bg-[#0a0e1a] sticky top-0 z-20 shadow-sm">
                            <tr class="border-b border-border-dark/60">
                                <th onclick="setSponsorsSortColumn('name')" class="px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Sponsor Profile</span>
                                        ${sortIcon('name')}
                                    </div>
                                </th>
                                ${sponsorsVisibleColumns.tier ? `<th onclick="setSponsorsSortColumn('tier')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Tier/Category</span>
                                        ${sortIcon('tier')}
                                    </div>
                                </th>` : ''}
                                ${sponsorsVisibleColumns.type ? `<th onclick="setSponsorsSortColumn('type')" class="px-3 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Type</span>
                                        ${sortIcon('type')}
                                    </div>
                                </th>` : ''}
                                ${sponsorsVisibleColumns.website ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Website</span>
                                    </div>
                                </th>` : ''}
                                ${sponsorsVisibleColumns.events ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Events</span>
                                    </div>
                                </th>` : ''}
                                ${sponsorsVisibleColumns.status ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Status</span>
                                    </div>
                                </th>` : ''}
                                ${sponsorsVisibleColumns.createdOn ? `<th class="px-3 py-3 text-left">
                                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <span>Created On</span>
                                    </div>
                                </th>` : ''}
                                <th class="px-3 py-3 pr-4 text-right">
                                    <div class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Actions</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-background-dark divide-y divide-border-dark/30">
                            ${paginatedItems.map((item, idx) => {
        const isReal = typeof item === 'object';
        const name = isReal ? (item.name || 'Unnamed Sponsor') : `Sponsor ${idx + 1}`;
        const category = isReal ? (item.category || 'Sponsor') : 'Gold';
        const type = isReal ? (item.type || '-') : 'Corporate';
        const logoUrl = isReal && item.logoUrl ? imgUrl(item.logoUrl) : null;
        const externalUrl = isReal ? (item.externalUrl || null) : 'https://example.com';
        const createdDate = isReal && item.createdAt ? item.createdAt : null;

        const tierColor = getTierColor(category, type);

        return `
                                <tr onclick="openSponsorDetails('${isReal ? item.id : idx}')" class="group hover:bg-surface-hover/40 cursor-pointer transition-all border-b border-border-dark/20">
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-3">
                                            ${logoUrl ? `<img src="${logoUrl}" alt="${name}" class="size-10 rounded-lg object-contain bg-white/5 border border-border-dark/40 shrink-0" />` : `<div class="size-10 rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center text-white text-xs font-bold border border-primary/30 shadow-lg shrink-0">
                                                ${name.charAt(0).toUpperCase()}
                                            </div>`}
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">${name}</p>
                                                <p class="text-[11px] text-slate-500 truncate">${category}</p>
                                            </div>
                                        </div>
                                    </td>
                                    ${sponsorsVisibleColumns.tier ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${tierColor} border">${category}</span>
                                    </td>` : ''}
                                    ${sponsorsVisibleColumns.type ? `<td class="px-3 py-3">
                                        <span class="text-[11px] text-slate-300">${type}</span>
                                    </td>` : ''}
                                    ${sponsorsVisibleColumns.website ? `<td class="px-3 py-3">
                                        ${externalUrl ? `<a href="${externalUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover hover:underline">
                                            <span class="material-symbols-outlined text-[12px]">link</span>
                                            Visit
                                        </a>` : '<span class="text-slate-600 text-[11px]">-</span>'}
                                    </td>` : ''}
                                    ${sponsorsVisibleColumns.events ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/30">
                                            <span class="material-symbols-outlined text-[12px]">event</span>
                                            2 events
                                        </span>
                                    </td>` : ''}
                                    ${sponsorsVisibleColumns.status ? `<td class="px-3 py-3">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                            Active
                                        </span>
                                    </td>` : ''}
                                    ${sponsorsVisibleColumns.createdOn ? `<td class="px-3 py-3">${formatDate(createdDate)}</td>` : ''}
                                    <td class="px-3 py-3 pr-4">
                                        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="size-6 rounded text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all" title="View Details">
                                                <span class="material-symbols-outlined text-[14px]">visibility</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
    }).join('') + Array.from({ length: Math.max(0, sponsorsItemsPerPage - paginatedItems.length) }).map(() => '<tr class="border-0 h-[48px]"></tr>').join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div class="px-6 py-4 border-t border-border-dark/60 flex items-center justify-between bg-[#0f172a] sticky bottom-0 z-20">
                    <div class="flex items-center gap-4">
                        <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Showing <span class="text-white">${totalSponsors > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + sponsorsItemsPerPage, totalSponsors)}</span> of <span class="text-white">${totalSponsors}</span> sponsors</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                            <select onchange="setSponsorsPageSize(this.value)" class="bg-surface-dark border border-border-dark/60 text-white text-xs rounded-lg pl-2 pr-6 py-1 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer outline-none appearance-none font-mono shadow-sm bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center]">
                                <option value="10" ${sponsorsItemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="25" ${sponsorsItemsPerPage === 25 ? 'selected' : ''}>25</option>
                                <option value="50" ${sponsorsItemsPerPage === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${sponsorsItemsPerPage === 100 ? 'selected' : ''}>100</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 bg-background-dark/50 p-1 rounded-xl border border-border-dark/40 shadow-inner">
                        <button onclick="setSponsorsPage(${sponsorsCurrentPage > 1 ? sponsorsCurrentPage - 1 : 1})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${sponsorsCurrentPage > 1 ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${sponsorsCurrentPage <= 1 ? 'disabled' : ''}>Prev</button>
                        <div class="px-3 text-[11px] font-mono font-bold text-white tracking-widest">${sponsorsCurrentPage} <span class="text-slate-500">/</span> ${totalPages}</div>
                        <button onclick="setSponsorsPage(${sponsorsCurrentPage < totalPages ? sponsorsCurrentPage + 1 : totalPages})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${sponsorsCurrentPage < totalPages ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${sponsorsCurrentPage >= totalPages ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>
        </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// SPONSOR PANEL RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderSponsorPanel(item, id) {
    const isReal = typeof item === 'object';
    const name = isReal ? (item.name || 'Unnamed Sponsor') : 'TechCorp Global';
    const category = isReal ? (item.category || 'Sponsor') : 'Platinum';
    const type = isReal ? (item.type || null) : 'Corporate Sponsor';
    const logoUrl = isReal && item.logoUrl ? imgUrl(item.logoUrl) : null;
    const externalUrl = isReal ? (item.externalUrl || null) : 'https://example.com';
    const description = isReal ? (item.description || null) : null;

    const tierColor = ((category || '').toLowerCase().includes('platinum') || (type || '').toLowerCase().includes('platinum')) ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' :
        ((category || '').toLowerCase().includes('gold') || (type || '').toLowerCase().includes('gold')) ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            ((category || '').toLowerCase().includes('silver') || (type || '').toLowerCase().includes('silver')) ? 'bg-slate-400/10 text-slate-300 border-slate-400/30' :
                'bg-slate-500/10 text-slate-400 border-slate-500/30';

    // Stats row
    const statsHtml = `
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="bg-background-dark/60 rounded-xl p-3 border border-border-dark/40">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-primary text-[16px]">event</span>
                    <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Events Sponsored</span>
                </div>
                <p class="text-sm font-bold text-white">2 events</p>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-3 border border-border-dark/40">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-violet-400 text-[16px]">history</span>
                    <span class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Years Active</span>
                </div>
                <p class="text-sm font-bold text-white">3+ years</p>
            </div>
        </div>
    `;

    // Description section
    const descriptionSection = description ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-violet-400 text-[18px]">description</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">About</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <p class="text-sm text-slate-300 leading-relaxed">${description}</p>
            </div>
        </div>
    ` : `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-violet-400 text-[18px]">description</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">About</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40">
                <p class="text-sm text-slate-400 italic">No description available</p>
            </div>
        </div>
    `;

    // Contact section
    const contactSection = externalUrl ? `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-primary text-[18px]">link</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Contact</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40 space-y-3">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-slate-500 text-[18px] mt-0.5">language</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Website</p>
                        <a href="${externalUrl}" target="_blank" rel="noopener noreferrer" class="text-sm text-primary hover:text-primary-hover hover:underline break-all inline-flex items-center gap-1">
                            ${externalUrl.replace(/^https?:\/\//, '')}
                            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    // Sponsorship details section
    const sponsorshipSection = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-amber-400 text-[18px]">workspace_premium</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Sponsorship Details</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40 space-y-3">
                <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Package Tier</p>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${tierColor} border">${category}</span>
                </div>
                <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Benefits</p>
                    <ul class="space-y-1.5 text-sm text-slate-300">
                        <li class="flex items-start gap-2">
                            <span class="material-symbols-outlined text-emerald-400 text-[14px] mt-0.5">check_circle</span>
                            <span>Logo placement on event materials</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="material-symbols-outlined text-emerald-400 text-[14px] mt-0.5">check_circle</span>
                            <span>Speaking opportunities at main sessions</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="material-symbols-outlined text-emerald-400 text-[14px] mt-0.5">check_circle</span>
                            <span>Premium booth location</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    // Events section
    const eventsSection = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-rose-400 text-[18px]">event_available</span>
                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Sponsored Events</h3>
            </div>
            <div class="bg-background-dark/60 rounded-xl p-4 border border-border-dark/40 space-y-2">
                <div class="flex items-center justify-between py-2 border-b border-border-dark/30 last:border-0">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[16px]">event</span>
                        <span class="text-sm text-slate-300">LEAP x DeepFest 2026</span>
                    </div>
                    <span class="text-[10px] text-slate-500">Active</span>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-border-dark/30 last:border-0">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[16px]">event</span>
                        <span class="text-sm text-slate-300">CPHI x BIO Middle East 2026</span>
                    </div>
                    <span class="text-[10px] text-slate-500">Upcoming</span>
                </div>
            </div>
        </div>
    `;

    const html = `
        <!-- Close Button -->
        <button onclick="closeSponsorPanel()" class="absolute top-6 right-6 z-50 size-10 rounded-full bg-background-dark/80 hover:bg-background-dark border border-border-dark/60 hover:border-primary/40 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg backdrop-blur-sm">
            <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Header -->
        <div class="relative overflow-hidden shrink-0 bg-gradient-to-br from-violet-500/10 via-amber-500/5 to-background-dark border-b border-border-dark/60 p-8">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.1),transparent_50%)]"></div>
            <div class="relative flex items-start gap-5">
                ${logoUrl ? `<img src="${logoUrl}" alt="${name}" class="size-20 rounded-2xl object-contain bg-white/5 border-2 border-primary/40 shadow-2xl shadow-primary/20 shrink-0 p-2" />` : `<div class="size-20 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center text-white text-2xl font-bold border-2 border-primary/40 shadow-2xl shadow-primary/20 shrink-0">
                    ${name.charAt(0).toUpperCase()}
                </div>`}
                <div class="pb-1 min-w-0 flex-1">
                    <h2 class="text-xl font-black text-white tracking-tight mb-2 truncate">${name}</h2>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${tierColor} border">${category}</span>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 pt-16 space-y-7">
            ${statsHtml}
            ${descriptionSection}
            ${contactSection}
            ${sponsorshipSection}
            ${eventsSection}
        </div>

        <!-- Footer Actions -->
        <div class="p-5 border-t border-border-dark/60 bg-white/2 shrink-0">
            <div class="flex gap-3">
                ${externalUrl ? `<button onclick="window.open('${externalUrl}', '_blank')" class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                    Visit Website
                </button>` : ''}
                <button class="px-4 py-2.5 bg-surface-hover hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all border border-border-dark/60 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">mail</span>
                    Contact
                </button>
            </div>
        </div>
    `;

    const content = document.getElementById('sponsor-panel-content');
    if (content) content.innerHTML = html;
}


async function renderSubpageMocks(pageId) {
    console.log(`[Render] 🎨 renderSubpageMocks called for: ${pageId}`);
    const container = document.getElementById(`content-${pageId}`);
    if (!container) return;

    if (pageId === 'events') return;

    // Removed "All" block causing prompt message

    // Show loading state
    container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-20">
            <div class="relative size-12 mb-4">
                <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p class="text-slate-400 text-xs font-medium animate-pulse tracking-widest uppercase">Fetching ${pageId} data...</p>
        </div>
    `;

    // Fetch data for the specific event
    const rawData = await ensureEventSubpageData(window.globalSelectedEventId, pageId);
    console.log(`[Render] 📦 Received ${rawData.length} records for ${pageId} from ensureEventSubpageData`);

    const searchQuery = subpagesState[pageId] ? subpagesState[pageId].search.toLowerCase() : '';
    let html = '';

    if (pageId === 'exhibitors') {
        console.log('[Render] 🏢 Rendering exhibitors page');
        console.log(`[Render] 🏢 Raw exhibitors data:`, rawData.slice(0, 2)); // Log first 2 items
        let filtered = rawData;

        if (searchQuery) {
            filtered = filtered.filter(ex => {
                const nameMatch = (ex.name || '').toLowerCase().includes(searchQuery);
                let typeMatch = false;
                if (ex.typeLabel) {
                    const typeStr = typeof ex.typeLabel === 'object' ? (ex.typeLabel.name || '') : ex.typeLabel;
                    typeMatch = typeStr.toLowerCase().includes(searchQuery);
                }
                return nameMatch || typeMatch;
            });
        }

        // Helper to extract leads total for an exhibitor
        const getLeadsTotal = (ex) => {
            if (ex.leads_scans !== undefined) return (ex.leads_scans || 0) + (ex.leads_views || 0);
            const we = ex.withEvent;
            if (!we || !we.leads) return 0;
            const l = we.leads;
            return (l.scans?.totalCount || 0) + (l.views?.totalCount || 0) + (l.contacts?.totalCount || 0) + (l.meetings?.totalCount || 0) + (l.bookmarks?.totalCount || 0);
        };
        const getMembersCount = (ex) => {
            return ex.total_members !== undefined ? (ex.total_members || 0) : (ex.withEvent ? (ex.withEvent.totalMembers || 0) : (ex.totalMembers || 0));
        };
        const getBoothName = (ex) => {
            if (ex.booth) return ex.booth;
            const we = ex.withEvent;
            if (we && we.booths && we.booths.length > 0) return we.booths.map(b => b.name).join(', ');
            const boothField = (ex.fields || []).find(f => f.definition && f.definition.name === 'Booth Location');
            return boothField ? (boothField.textValue || boothField.selectValue || '') : '';
        };

        // Detect placeholder logos (most common logo URL = placeholder)
        const detectPlaceholderLogos = (exhibitors) => {
            const logoFrequency = {};
            exhibitors.forEach(ex => {
                const logo = ex.logoUrl || ex.cachedLogoUrl;
                if (logo) {
                    logoFrequency[logo] = (logoFrequency[logo] || 0) + 1;
                }
            });

            // Find most common logo(s) - if a logo appears more than 5 times, it's likely a placeholder
            const placeholders = [];
            Object.entries(logoFrequency).forEach(([url, count]) => {
                if (count > 5) {  // Threshold: if same logo used by 6+ exhibitors, it's a placeholder
                    placeholders.push(url);
                }
            });

            console.log('[ExhibitorFilter] Detected placeholder logos:', placeholders, 'Frequency map:', logoFrequency);
            return placeholders;
        };

        const placeholderLogos = detectPlaceholderLogos(filtered);

        // Helper to check if exhibitor has real logo (not placeholder)
        const hasRealLogo = (ex) => {
            const logo = ex.logoUrl || ex.cachedLogoUrl;
            if (!logo) return false;
            return !placeholderLogos.includes(logo);
        };

        // Filter tab logic
        if (exFilterTab === 'no-logo') {
            // Include exhibitors with no logo OR placeholder logo
            filtered = filtered.filter(ex => !hasRealLogo(ex));
        } else if (exFilterTab === 'zero-members') {
            filtered = filtered.filter(ex => getMembersCount(ex) === 0);
        } else if (exFilterTab === 'zero-leads') {
            filtered = filtered.filter(ex => getLeadsTotal(ex) === 0);
        }

        // Sorting
        if (exSortColumn) {
            filtered.sort((a, b) => {
                let valA, valB;
                switch (exSortColumn) {
                    case 'name':
                        valA = (a.name || '').toLowerCase();
                        valB = (b.name || '').toLowerCase();
                        return exSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    case 'booth':
                        valA = getBoothName(a).toLowerCase();
                        valB = getBoothName(b).toLowerCase();
                        return exSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    case 'members':
                        valA = getMembersCount(a);
                        valB = getMembersCount(b);
                        return exSortDirection === 'asc' ? valA - valB : valB - valA;
                    case 'leads':
                        valA = getLeadsTotal(a);
                        valB = getLeadsTotal(b);
                        return exSortDirection === 'asc' ? valA - valB : valB - valA;
                    case 'createdOn':
                        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return exSortDirection === 'asc' ? valA - valB : valB - valA;
                    case 'updatedOn':
                        valA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                        valB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                        return exSortDirection === 'asc' ? valA - valB : valB - valA;
                    case 'industry':
                        valA = (a.industry || a.processedType || '').toLowerCase();
                        valB = (b.industry || b.processedType || '').toLowerCase();
                        return exSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    default:
                        return 0;
                }
            });
        }

        const fallbackMocks = (searchQuery || exFilterTab !== 'all' || (typeof globalSelectedEventId !== 'undefined' && globalSelectedEventId !== 'all')) ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const itemsToRender = filtered.length > 0 ? filtered : fallbackMocks;

        const totalCount = itemsToRender.length;
        let withLogosCount = 0;
        let withIndustryCount = 0;
        let withBioCount = 0;
        let withSocialsCount = 0;
        let totalLeadsSum = 0;
        let usingLeadScannerCount = 0;

        itemsToRender.forEach((item, i) => {
            const isReal = typeof item === 'object';
            let type = 'Exhibitor';
            if (isReal) {
                if (item.typeLabel && typeof item.typeLabel === 'object') {
                    type = item.typeLabel.name || item.type || 'Exhibitor';
                } else if (typeof item.typeLabel === 'string') {
                    type = item.typeLabel || 'Exhibitor';
                }

                item.processedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                item.targetEventIds = item.eventIds || (item.eventId ? [item.eventId] : []);

                if (item.logoUrl || item.cachedLogoUrl) withLogosCount++;
                if (type && type !== 'Exhibitor') withIndustryCount++;

                // Bio Edit check
                if (item.description && item.description.trim().length > 0) withBioCount++;

                // Socials Edit check
                const hasSocials = item.socialNetworks && item.socialNetworks.length > 0;
                if (hasSocials) withSocialsCount++;

                // Calculate total leads
                const leadsTotal = getLeadsTotal(item);
                totalLeadsSum += leadsTotal;

                // Using lead scanner check (has scans)
                const we = item.withEvent;
                if (we && we.leads && we.leads.scans && we.leads.scans.totalCount > 0) {
                    usingLeadScannerCount++;
                }
            }
        });

        const exViewMode = window.exhibitorViewMode || 'table';

        const statColors = [
            { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'storefront' },
            { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: 'image' },
            { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', icon: 'category' },
            { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: 'description' },
            { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', icon: 'share' },
            { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: 'leaderboard' },
            { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: 'qr_code_scanner' },
        ];
        const stats = [
            { label: 'Total Exhibitors', value: totalCount, ...statColors[0] },
            { label: 'With Logos', value: `${withLogosCount} / ${totalCount}`, ...statColors[1] },
            { label: 'Industry Added', value: `${withIndustryCount} / ${totalCount}`, ...statColors[2] },
            { label: 'Bio Edited', value: `${withBioCount} / ${totalCount}`, ...statColors[3] },
            { label: 'Socials Added', value: `${withSocialsCount} / ${totalCount}`, ...statColors[4] },
            { label: 'Total Leads', value: totalLeadsSum.toLocaleString(), ...statColors[5] },
            { label: 'Using Scanner', value: `${usingLeadScannerCount} / ${totalCount}`, ...statColors[6] },
        ];

        const statsHtml = `
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 px-4 py-3 bg-surface-dark/20 border-b border-border-dark/40 shrink-0">
                ${stats.map(s => `
                <div class="flex items-center gap-2.5 bg-background-dark/40 border ${s.border} rounded-lg px-3 py-2 shadow-sm">
                    <div class="p-1.5 ${s.bg} rounded border ${s.border} shrink-0">
                        <span class="material-symbols-outlined ${s.text} text-[16px] block">${s.icon}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                        <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">${s.label}</span>
                        <span class="text-sm font-bold text-white leading-tight tracking-tight mt-0.5">${s.value}</span>
                    </div>
                </div>`).join('')}
            </div>
        `;

        if (itemsToRender.length === 0 && (searchQuery || (typeof globalSelectedEventId !== 'undefined' && globalSelectedEventId !== 'all'))) {
            html = `<div class="p-12 text-center text-slate-500 flex flex-col items-center"><span class="material-symbols-outlined text-[48px] mb-4 opacity-50">search_off</span>No exhibitors found for the current filter.</div>`;
        } else if (exViewMode === 'grid') {
            // ── Grid / Card View ──────────────────────────────────────────────
            html = `
                    <div class="w-full h-full overflow-y-auto p-4">
                        ${statsHtml}
                        <!-- Grid Cards -->
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            ${itemsToRender.map((item, i) => {
                const isReal = typeof item === 'object';
                const name = isReal ? (item.name || 'Unnamed Exhibitor') : `Exhibitor Co. ${i + 1}`;
                const type = isReal ? (item.processedType || 'Exhibitor') : (['Technology', 'Healthcare', 'Finance', 'Media', 'Retail'][i % 5]);
                const hasLogo = isReal && (item.logoUrl || item.cachedLogoUrl);
                const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'EX';
                const hueIndex = (name.charCodeAt(0) || 65) % 6;
                const hues = ['from-amber-500 to-orange-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-blue-500 to-indigo-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600'];
                const gradClass = hues[hueIndex];
                const logoUrl = item.cachedLogoUrl || (item.logoUrl ? imgUrl(item.logoUrl) : '');
                const isPlaceholderLogo = logoUrl && placeholderLogos.includes(logoUrl);

                const membersCount = getMembersCount(item);
                const leadsCount = getLeadsTotal(item);

                return `
                                <div onclick="openExhibitorDetails('${isReal ? item.id : i}')" class="group flex flex-col rounded-xl bg-background-dark/60 border border-border-dark/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all cursor-pointer overflow-hidden relative">
                                    <!-- Card top accent -->
                                    <div class="h-1.5 w-full bg-gradient-to-r ${gradClass} opacity-70"></div>
                                    <div class="p-4 flex flex-col items-center text-center">
                                        <!-- Logo / Avatar -->
                                        ${logoUrl && !isPlaceholderLogo
                        ? `<div class="w-full h-16 rounded-lg overflow-hidden mb-3 shadow-sm bg-background-dark/20 flex items-center justify-center"><img src="${logoUrl}" class="w-full h-full object-cover drop-shadow-md"/></div>`
                        : `<div class="w-16 h-16 rounded-xl bg-gradient-to-br ${gradClass} flex items-center justify-center text-white font-black text-xl mb-3 shadow-md">${initials}</div>`
                    }
                                        <h4 class="text-white font-bold text-[14px] leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-1 tracking-tight">${name}</h4>
                                        <div class="flex flex-wrap justify-center gap-1.5 mb-2">
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-surface-hover/80 border border-border-dark/40 text-slate-400 group-hover:text-slate-200 transition-colors">${type}</span>
                                            ${item.country ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 border border-border-dark/40 text-slate-400 capitalize"><span class="material-symbols-outlined text-[10px]">location_on</span>${item.country}</span>` : ''}
                                            ${membersCount > 0 ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"><span class="material-symbols-outlined text-[10px]">group</span>${membersCount}</span>` : ''}
                                            ${leadsCount > 0 ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"><span class="material-symbols-outlined text-[10px]">qr_code_scanner</span>${leadsCount}</span>` : ''}
                                        </div>
                                    </div>
                                    <!-- Footer -->
                                    <div class="mt-auto border-t border-border-dark/40 px-4 py-2.5 flex items-center justify-between bg-background-dark/40">
                                        <span class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                                            <span class="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                            Active
                                        </span>
                                        <button class="text-slate-500 hover:text-primary transition-colors" title="View details">
                                            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                                        </button>
                                    </div>
                                </div>`;
            }).join('')}
                        </div>
                    </div>`;
        } else {
            // ── Table View ────────────────────────────────────────────────────

            const totalEx = itemsToRender.length;
            const totalPages = Math.max(1, Math.ceil(totalEx / exItemsPerPage));
            if (exCurrentPage > totalPages) exCurrentPage = totalPages;
            const startIndex = (exCurrentPage - 1) * exItemsPerPage;
            const paginatedItems = itemsToRender.slice(startIndex, startIndex + exItemsPerPage);

            html = `
                    <div class="w-full flex flex-col h-full overflow-hidden">
                        ${statsHtml}

                        <!-- Table Block -->
                        <div class="w-full h-full overflow-y-auto overflow-x-auto relative glass-dark flex flex-col flex-1">
                            <div class="flex-1 overflow-auto">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-[#0f172a]/95 backdrop-blur-md border-b border-border-dark/60 z-10 shadow-sm">
                                        <tr class="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">
                                            <th class="px-3 py-2 min-w-[240px] cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('name')">
                                                Exhibitor Profile ${exSortColumn === 'name' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}
                                            </th>
                                            ${exVisibleColumns.industry ? `<th class="px-3 py-2 min-w-[110px] cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('industry')">Industry ${exSortColumn === 'industry' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            ${exVisibleColumns.events ? '<th class="px-3 py-2">Events</th>' : ''}
                                            ${exVisibleColumns.onboarding ? '<th class="px-3 py-2 min-w-[130px]">Onboarding</th>' : ''}
                                            ${exVisibleColumns.booth ? `<th class="px-3 py-2 text-center cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('booth')">Booth ${exSortColumn === 'booth' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            ${exVisibleColumns.members ? `<th class="px-3 py-2 text-center cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('members')">Members ${exSortColumn === 'members' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            ${exVisibleColumns.leads ? `<th class="px-3 py-2 text-center cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('leads')">Leads ${exSortColumn === 'leads' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            ${exVisibleColumns.createdOn ? `<th class="px-3 py-2 min-w-[110px] cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('createdOn')">Created On ${exSortColumn === 'createdOn' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            ${exVisibleColumns.updatedOn ? `<th class="px-3 py-2 min-w-[110px] cursor-pointer hover:text-white transition-colors select-none" onclick="setExSortColumn('updatedOn')">Updated On ${exSortColumn === 'updatedOn' ? `<span class="material-symbols-outlined text-primary text-[10px] align-middle">${exSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>` : ''}</th>` : ''}
                                            <th class="px-3 py-2 text-right pr-4 whitespace-nowrap">Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border-dark/20 h-full">
                                            ${paginatedItems.map((item, i) => {
                const isReal = typeof item === 'object';
                const name = isReal ? (item.name || 'Unnamed Exhibitor') : `Exhibitor Co. ${i + 1}`;
                const type = isReal ? (item.processedType || 'Exhibitor') : (['Technology', 'Healthcare', 'Finance', 'Media', 'Retail'][i % 5]);
                const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'EX';
                const hueIndex = (name.charCodeAt(0) || 65) % 6;
                const hues = ['from-amber-500 to-orange-500', 'from-violet-500 to-purple-500', 'from-emerald-500 to-teal-500', 'from-blue-500 to-indigo-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-sky-600'];
                const gradClass = hues[hueIndex];
                const progress = isReal && item.onboardingProgress ? parseInt(item.onboardingProgress) : (75 + (i * 7) % 25);
                const progressColor = progress > 90 ? 'bg-emerald-500' : progress > 50 ? 'bg-primary' : 'bg-amber-500';
                const logoUrl = item.cachedLogoUrl || (item.logoUrl ? imgUrl(item.logoUrl) : '');
                const isPlaceholderLogo = logoUrl && placeholderLogos.includes(logoUrl);

                // Data extraction helpers
                const getLeadsTotal = (ex) => {
                    if (typeof ex !== 'object') return (i * 12) % 100;
                    if (ex.leads_scans !== undefined) return (ex.leads_scans || 0) + (ex.leads_views || 0);
                    const we = ex.withEvent;
                    if (!we || !we.leads) return 0;
                    const l = we.leads;
                    return (l.scans?.totalCount || 0) + (l.views?.totalCount || 0) + (l.contacts?.totalCount || 0) + (l.meetings?.totalCount || 0) + (l.bookmarks?.totalCount || 0);
                };
                const getMembersCount = (ex) => {
                    if (typeof ex !== 'object') return (i * 3) % 10;
                    return ex.total_members !== undefined ? (ex.total_members || 0) : (ex.withEvent ? (ex.withEvent.totalMembers || 0) : (ex.totalMembers || 0));
                };
                const getBoothName = (ex) => {
                    if (typeof ex !== 'object') {
                        const boothLabels = ['A-01', 'B-12', 'C-05', 'D-08', 'A-14', 'B-03', 'C-17', 'E-02', 'A-09', 'D-11'];
                        return boothLabels[i % boothLabels.length];
                    }
                    if (ex.booth) return ex.booth;
                    const we = ex.withEvent;
                    if (we && we.booths && we.booths.length > 0) return we.booths.map(b => b.name).join(', ');
                    const boothField = (ex.fields || []).find(f => f.definition && f.definition.name === 'Booth Location');
                    return boothField ? (boothField.textValue || boothField.selectValue || '') : (ex.booth || '—');
                };

                const membersCount = getMembersCount(item);
                const leadsCount = getLeadsTotal(item);
                const booth = getBoothName(item);

                const createdDate = isReal && item.createdAt ? new Date(item.createdAt) : new Date(Date.now() - (i * 86400000 * 5) - 864000000);
                const updatedDate = isReal && item.updatedAt ? new Date(item.updatedAt) : new Date(createdDate.getTime() + 86400000 * Math.random() * 5);
                const formatDate = (d) => `<div class="flex flex-col"><span class="text-[11px] font-bold text-slate-300 tracking-tight">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span><span class="text-[9px] font-medium text-slate-500 tracking-widest uppercase">${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>`;

                // Fetch actual event info for event icon and subtitle
                const allEvs = [];
                const rawEvents = window.allEventsData || {};
                Object.values(rawEvents).forEach(list => {
                    if (Array.isArray(list)) allEvs.push(...list);
                });

                const targetEventIds = item.targetEventIds || [];
                const parentEvs = isReal && targetEventIds.length > 0 && allEvs.length > 0
                    ? allEvs.filter(e => targetEventIds.includes(e.id))
                    : [];

                const evCount = parentEvs.length > 0 ? parentEvs.length : 1;
                const mockEventName = parentEvs.length === 1 ? parentEvs[0].title : (parentEvs.length > 1 ? `${evCount} Events` : 'LEAP 2026');

                // Add small event avatars based on count
                let eventsMockHtml = '<div class="flex -space-x-1.5 hover:space-x-1 transition-all">';
                if (parentEvs.length > 0) {
                    parentEvs.forEach((parentEv, idx) => {
                        // Priority: Airtable app icon > Event banner (app icon) > Community logo
                        let eLogoUrl = null;

                        // 1. Try Airtable app icon first (best quality)
                        if (window.findAirtableMatch && window.airtableData && window.airtableData.length > 0) {
                            const airEv = window.findAirtableMatch(parentEv.title || '');
                            if (airEv && airEv.logo_url) eLogoUrl = imgUrl(airEv.logo_url);
                        }

                        // 2. Fall back to event banner (should be the app icon in Swapcard)
                        if (!eLogoUrl && parentEv.banner && parentEv.banner.imageUrl) {
                            eLogoUrl = imgUrl(parentEv.banner.imageUrl);
                        }

                        // 3. Last resort: community logo
                        if (!eLogoUrl && parentEv.community && parentEv.community.logoUrl) {
                            eLogoUrl = imgUrl(parentEv.community.logoUrl);
                        }

                        const zIndex = 20 - idx;
                        if (eLogoUrl) {
                            eventsMockHtml += `<div class="size-6 rounded-md overflow-hidden border border-border-dark/60 shadow-sm tooltip relative ring-2 ring-surface-dark shrink-0 cursor-help flex items-center justify-center" style="z-index:${zIndex}" title="${parentEv.title}"><img src="${eLogoUrl}" class="w-full h-full object-cover" onerror="this.onerror=null;this.innerHTML='<span class=\\'material-symbols-outlined text-[11px] text-slate-400 mt-0.5\\'>event</span>';"/></div>`;
                        } else {
                            eventsMockHtml += `<div class="size-6 rounded-md bg-surface-hover text-slate-300 flex items-center justify-center border border-border-dark/60 tooltip relative ring-2 ring-surface-dark shrink-0 cursor-help" style="z-index:${zIndex}" title="${parentEv.title}"><span class="material-symbols-outlined text-[11px]">event</span></div>`;
                        }
                    });
                } else {
                    eventsMockHtml += `<div class="size-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 tooltip shrink-0 cursor-help" title="LEAP 2026"><span class="material-symbols-outlined text-[12px]">event</span></div>`;
                }
                eventsMockHtml += '</div>';

                return `
                    <tr onclick="openExhibitorDetails('${isReal ? item.id : i}')" class="hover:bg-white/[0.025] transition-colors cursor-pointer group" >
                        <td class="px-3 py-1.5">
                            <div class="flex items-center gap-3">
                                <div class="relative group/logo shrink-0">
                                    ${logoUrl && !isPlaceholderLogo
                        ? `<div class="w-[64px] h-[32px] rounded border border-border-dark/40 overflow-hidden shadow-sm flex items-center justify-center"><img src="${logoUrl}" class="w-full h-full object-cover"/></div>`
                        : `<div class="w-[64px] h-[32px] rounded bg-gradient-to-br ${gradClass} flex items-center justify-center text-white font-black text-[10px] shadow-sm tracking-wider">${initials}</div>`
                    }
                                    ${isPlaceholderLogo
                        ? `<div class="absolute -right-1 -top-1 size-4 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center" title="Placeholder logo detected"><span class="material-symbols-outlined text-amber-400 text-[10px]">image</span></div>`
                        : `<div class="absolute -right-1 -top-1 size-2 bg-emerald-500 rounded-full border border-[#151c2b] shadow-sm"></div>`
                    }
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[13px] font-bold text-white group-hover:text-primary transition-colors truncate max-w-[190px] tracking-tight">${name}</p>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-[9px] font-semibold text-slate-400 px-1 py-0.5 bg-background-dark/50 rounded border border-border-dark/20 uppercase tracking-widest leading-none drop-shadow-sm truncate lg:max-w-none max-w-[50px] cursor-help" title="${mockEventName}">${mockEventName}</span>
                                        ${isReal && (item.websiteUrl || item.website) ? `<a href="${item.websiteUrl || item.website}" class="text-[9px] text-slate-500 hover:text-primary transition-colors truncate flex items-center gap-1 font-medium" onclick="event.stopPropagation()"><span class="material-symbols-outlined text-[10px] opacity-70">public</span>${(item.websiteUrl || item.website).replace(/^https?:\/\//, '')}</a>` : `<span class="text-[9px] text-slate-600 italic">No website</span>`}
                                    </div>
                                </div>
                            </div>
                        </td>
                                                ${exVisibleColumns.industry ? `<td class="px-3 py-1.5">
                                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-surface-hover/50 border border-border-dark/60 text-slate-400 group-hover:text-slate-200 group-hover:bg-surface-hover transition-colors">
                                                        ${item.industry || item.processedType || 'EXHIBITOR'}
                                                    </span>
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.events ? `<td class="px-3 py-1.5">
                                                    ${eventsMockHtml}
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.onboarding ? `<td class="px-3 py-1.5">
                                                    <div class="flex flex-col gap-1.5 min-w-[100px]">
                                                        <div class="flex justify-between items-center text-[9px] font-black tracking-widest">
                                                            <span class="text-slate-500 uppercase">Step 3 of 4</span>
                                                            <span class="${progress > 90 ? 'text-emerald-400' : 'text-slate-300'}">${progress}%</span>
                                                        </div>
                                                        <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                            <div class="h-full ${progressColor} rounded-full transition-all duration-1000 shadow-[0_0_8px_${progress > 90 ? 'rgba(16,185,129,0.3)' : 'rgba(19, 127, 236, 0.3)'}]" style="width: ${progress}%"></div>
                                                        </div>
                                                    </div>
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.booth ? `<td class="px-3 py-1.5 text-center font-mono">
                                                    <span class="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-background-dark/60 px-2 py-0.5 rounded-md border border-border-dark/40 group-hover:border-primary/40 transition-colors">
                                                        <span class="material-symbols-outlined text-[12px] text-primary opacity-70">meeting_room</span>
                                                        ${booth}
                                                    </span>
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.members ? `<td class="px-3 py-1.5 text-center px-6">
                                                    <span class="text-[11px] font-bold ${membersCount > 0 ? 'text-slate-200' : 'text-slate-600'}">${membersCount}</span>
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.leads ? `<td class="px-3 py-1.5 text-center px-6">
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">${leadsCount}</span>
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.createdOn ? `<td class="px-3 py-1.5">
                                                    ${formatDate(createdDate)}
                                                </td>` : ''
                    }
                                                ${exVisibleColumns.updatedOn ? `<td class="px-3 py-1.5">
                                                    ${formatDate(updatedDate)}
                                                </td>` : ''
                    }
                <td class="px-3 py-1.5 pr-4">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${isReal ? `<button onclick="event.stopPropagation(); window.syncSpecificExhibitor('${item.id}')" class="size-6 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 flex items-center justify-center transition-all bg-transparent" title="Sync Exhibitor">
                                                            <span class="material-symbols-outlined text-[14px]">sync</span>
                                                        </button>` : ''}
                        <button class="size-6 rounded text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all bg-transparent" title="Review Profile">
                            <span class="material-symbols-outlined text-[14px]">visibility</span>
                        </button>
                    </div>
                </td>
                                            </tr>`;
            }).join('') + Array.from({ length: Math.max(0, exItemsPerPage - paginatedItems.length) }).map(() => '<tr class="flex-1 border-0 h-[48px]"></tr>').join('')}
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- Pagination Footer -->
                            <div class="px-6 py-4 border-t border-border-dark/60 flex items-center justify-between bg-[#0f172a] sticky bottom-0 z-20 w-full shrink-0">
                                <div class="flex items-center gap-4">
                                    <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Showing <span class="text-white">${totalEx > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + exItemsPerPage, totalEx)}</span> of <span class="text-white">${totalEx}</span> exhibitors</p>
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                                        <select onchange="setExhibitorPageSize(this.value)" class="bg-surface-dark border border-border-dark/60 text-white text-xs rounded-lg pl-2 pr-6 py-1 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer outline-none appearance-none font-mono placeholder-slate-500 shadow-sm bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center]">
                                            <option value="10" ${exItemsPerPage === 10 ? 'selected' : ''}>10</option>
                                            <option value="25" ${exItemsPerPage === 25 ? 'selected' : ''}>25</option>
                                            <option value="50" ${exItemsPerPage === 50 ? 'selected' : ''}>50</option>
                                            <option value="100" ${exItemsPerPage === 100 ? 'selected' : ''}>100</option>
                                            <option value="1000" ${exItemsPerPage === 1000 ? 'selected' : ''}>1000</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 bg-background-dark/50 p-1 rounded-xl border border-border-dark/40 shadow-inner">
                                    <button onclick="setExhibitorPage(${exCurrentPage > 1 ? exCurrentPage - 1 : 1})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${exCurrentPage > 1 ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${exCurrentPage <= 1 ? 'disabled' : ''}>Prev</button>
                                    <div class="px-3 text-[11px] font-mono font-bold text-white tracking-widest">${exCurrentPage} <span class="text-slate-500">/</span> ${totalPages}</div>
                                    <button onclick="setExhibitorPage(${exCurrentPage < totalPages ? exCurrentPage + 1 : totalPages})" class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${exCurrentPage < totalPages ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'} rounded-lg transition-all" ${exCurrentPage >= totalPages ? 'disabled' : ''}>Next</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
        }
    } else if (pageId === 'people' || pageId === 'speakers') {
        html = renderPeopleTable(pageId, rawData, searchQuery);
    } else if (pageId === 'sessions') {
        html = renderSessionsTable(pageId, rawData, searchQuery);
    } else if (pageId === 'sponsors') {
        html = renderSponsorsTable(pageId, rawData, searchQuery);
    }
    container.className = 'w-full flex-1 flex flex-col p-0 m-0';
    container.innerHTML = html;
    console.log(`[Render] ✅ ${pageId} rendered successfully, HTML length: ${html.length} characters`);
}

function handleSearch(pageId) {
    if (pageId === 'events') {
        eventsState.search = document.getElementById(`search-${pageId}`).value;
        renderAllEventsData();
    } else if (subpagesState[pageId]) {
        subpagesState[pageId].search = document.getElementById(`search-${pageId}`).value;
        renderSubpageMocks(pageId);
    }
}

function openAdvancedFilterModal() {
    const backdrop = document.getElementById('advanced-filter-backdrop');
    const modal = document.getElementById('advanced-filter-modal');

    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');

    // Sync current state logic directly into inputs
    const select = document.getElementById('adv-filter-community');
    select.innerHTML = '<option value="All">All Communities</option>';
    if (!allCommunities || allCommunities.length === 0) {
        fetchCommunities().then(() => {
            allCommunities.forEach(c => {
                select.innerHTML += `<option value="${c.name}" ${eventsState.advanced.community === c.name ? 'selected' : ''}>${c.name}</option>`;
            });
        });
    } else {
        allCommunities.forEach(c => {
            select.innerHTML += `<option value="${c.name}" ${eventsState.advanced.community === c.name ? 'selected' : ''}>${c.name}</option>`;
        });
    }

    document.getElementById('adv-filter-reg').value = eventsState.advanced.minReg || '';
    document.getElementById('adv-filter-exh').value = eventsState.advanced.minExh || '';
    const spkInput = document.getElementById('adv-filter-spk');
    if (spkInput) spkInput.value = eventsState.advanced.minSpk || '';
    document.getElementById('adv-filter-sess').value = eventsState.advanced.minSess || '';

    setTimeout(() => {
        // Ensure proper slide over effect
        modal.classList.remove('translate-x-full', 'opacity-0');
        modal.classList.add('translate-x-0', 'opacity-100');
    }, 10);
}

function closeAdvancedFilterModal() {
    const backdrop = document.getElementById('advanced-filter-backdrop');
    const modal = document.getElementById('advanced-filter-modal');

    modal.classList.remove('translate-x-0', 'opacity-100');
    modal.classList.add('translate-x-full', 'opacity-0');

    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
}

function applyAdvancedFilters() {
    eventsState.advanced.community = document.getElementById('adv-filter-community').value || 'All';
    eventsState.advanced.minReg = parseInt(document.getElementById('adv-filter-reg').value) || 0;
    eventsState.advanced.minExh = parseInt(document.getElementById('adv-filter-exh').value) || 0;
    const spkInput = document.getElementById('adv-filter-spk');
    if (spkInput) eventsState.advanced.minSpk = parseInt(spkInput.value) || 0;
    eventsState.advanced.minSess = parseInt(document.getElementById('adv-filter-sess').value) || 0;

    // Badge tracker for UI
    let filterCount = 0;
    if (eventsState.advanced.community !== 'All') filterCount++;
    if (eventsState.advanced.minReg > 0) filterCount++;
    if (eventsState.advanced.minExh > 0) filterCount++;
    if (eventsState.advanced.minSpk && eventsState.advanced.minSpk > 0) filterCount++;
    if (eventsState.advanced.minSess > 0) filterCount++;

    const badge = document.getElementById('adv-filter-badge');
    if (badge) {
        if (filterCount > 0) {
            badge.textContent = filterCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    closeAdvancedFilterModal();
    renderAllEventsData();
    showToast('Filters Applied', 'Event criteria successfully updated.');
}

function clearAdvancedFilters() {
    document.getElementById('adv-filter-community').value = 'All';
    document.getElementById('adv-filter-reg').value = '';
    document.getElementById('adv-filter-exh').value = '';
    const spkInput = document.getElementById('adv-filter-spk');
    if (spkInput) spkInput.value = '';
    document.getElementById('adv-filter-sess').value = '';

    eventsState.advanced = { community: 'All', minReg: 0, minExh: 0, minSess: 0 };
    if (spkInput) eventsState.advanced.minSpk = 0;

    const badge = document.getElementById('adv-filter-badge');
    if (badge) badge.classList.add('hidden');

    closeAdvancedFilterModal();
    renderAllEventsData();
    showToast('Filters Reset', 'Viewing all matched timeline events.');
}

function setExhibitorView(mode) {
    window.exhibitorViewMode = mode;
    const gridBtn = document.getElementById('view-ex-grid');
    const tableBtn = document.getElementById('view-ex-table');
    if (gridBtn && tableBtn) {
        const activeClass = ['text-white', 'bg-surface-hover', 'border', 'border-border-dark/60'];
        const inactiveClass = ['text-slate-500', 'hover:text-slate-300'];
        if (mode === 'grid') {
            gridBtn.classList.add(...activeClass); gridBtn.classList.remove(...inactiveClass);
            tableBtn.classList.remove(...activeClass); tableBtn.classList.add(...inactiveClass);
        } else {
            tableBtn.classList.add(...activeClass); tableBtn.classList.remove(...inactiveClass);
            gridBtn.classList.remove(...activeClass); gridBtn.classList.add(...inactiveClass);
        }
    }
    renderSubpageMocks('exhibitors');
}

function handleNewAction(pageId) {
    if (pageId === 'events') {
        openNewEventModal();
    } else if (pageId === 'people' || pageId === 'speakers') {
        openNewPersonModal();
    } else if (pageId === 'exhibitors') {
        openNewExhibitorModal();
    } else {
        showToast('Coming Soon', `Creating a new ${pageId} will be supported soon.`);
    }
}
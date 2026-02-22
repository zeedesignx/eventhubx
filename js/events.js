/* ────────────────────────────────────────────────────────────
 * events.js — Event loading, rendering, modal, export
 * ──────────────────────────────────────────────────────────── */

/**
 * Sends all event banner + app icon URLs to the server for disk caching.
 * After the first run, every image is served from img_cache/ at localhost speed.
 */
function preloadEventImages() {
    const allEvs = Object.values(allEventsData).flat();
    const urls = [];

    allEvs.forEach(ev => {
        const banner = ev.banner && ev.banner.imageUrl ? ev.banner.imageUrl : '';
        const commBanner = ev.community && ev.community.bannerImageUrl ? ev.community.bannerImageUrl : '';
        const commLogo = ev.community && ev.community.logoUrl ? ev.community.logoUrl : '';
        if (banner) urls.push(banner);
        if (commBanner) urls.push(commBanner);
        if (commLogo) urls.push(commLogo);

        // Airtable app icon — match by title
        if (typeof airtableData !== 'undefined' && airtableData.length) {
            const t = (ev.title || '').toLowerCase();
            const airEv = airtableData.find(a => {
                const n = (a.name || '').toLowerCase();
                return n && (t.includes(n) || n.includes(t));
            });
            if (airEv && airEv.logo_url) urls.push(airEv.logo_url);
        }
    });

    serverPreload(urls);
    console.log(`[ImgCache] Submitted ${urls.length} event image URLs for server caching.`);
}

/**
 * Aggregates statistics for a specific event from subpage data (exhibitors).
 * Sums up leads (scans, views, contacts, meetings, bookmarks) and team members.
 */
function getEventDetailedStats(eventId) {
    if (window.allSubpagesStats && window.allSubpagesStats[eventId]) {
        const s = window.allSubpagesStats[eventId];
        return {
            leads: s.leadsCount || 0,
            members: s.membersCount || 0,
            exhibitors: s.exhibitorCount || 0,
            people: s.personCount || 0,
            sessions: s.sessionsCount || 0,
            sponsors: s.sponsorsCount || 0
        };
    }
    return { leads: 0, members: 0, exhibitors: 0, people: 0, sessions: 0, sponsors: 0 };
}


function renderEvents() {
    let htmlList = '';
    let events = allEventsData[currentTab] || [];

    if (typeof globalSelectedEventId !== 'undefined' && globalSelectedEventId !== 'all') {
        events = events.filter(ev => ev.id === globalSelectedEventId);
    }

    const categoryColors = {
        'Active': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        'Future': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        'Past': 'text-slate-400 bg-slate-400/10 border-slate-400/20',
        'Unpublished': 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    };
    const badgeClass = categoryColors[currentTab] || categoryColors['Past'];

    if (events.length > 0) {
        htmlList += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
        events.forEach(ev => {
            const addressObj = ev.address || {};
            const addressStr = [addressObj.city, addressObj.country].filter(Boolean).join(', ') || 'Online / TBA';
            let dateDisplay = 'TBA';
            try {
                if (ev.beginsAt) {
                    const d1 = new Date(ev.beginsAt);
                    const beginMonth = d1.toLocaleDateString('en-US', { month: 'short' });
                    const beginDay = d1.getDate();
                    const beginYear = d1.getFullYear();

                    if (ev.endsAt) {
                        const d2 = new Date(ev.endsAt);
                        const endMonth = d2.toLocaleDateString('en-US', { month: 'short' });
                        const endDay = d2.getDate();
                        const endYear = d2.getFullYear();

                        if (beginYear === endYear && beginMonth === endMonth) {
                            if (beginDay === endDay) {
                                dateDisplay = `${beginMonth} ${beginDay}, ${beginYear}`;
                            } else {
                                dateDisplay = `${beginMonth} ${beginDay} - ${endDay}, ${beginYear}`;
                            }
                        } else if (beginYear === endYear) {
                            dateDisplay = `${beginMonth} ${beginDay} - ${endMonth} ${endDay}, ${beginYear}`;
                        } else {
                            dateDisplay = `${beginMonth} ${beginDay}, ${beginYear} - ${endMonth} ${endDay}, ${endYear}`;
                        }
                    } else {
                        dateDisplay = `${beginMonth} ${beginDay}, ${beginYear}`;
                    }
                }
            } catch (e) { }

            const bannerBg = (ev.banner && ev.banner.cachedUrl) || (ev.banner && ev.banner.imageUrl ? imgUrl(ev.banner.imageUrl) : '');

            // Check for Airtable mockup link
            let hasAirtableMockup = false;
            if (typeof airtableData !== 'undefined' && airtableData.length) {
                const t = (ev.title || '').toLowerCase();
                const airEv = airtableData.find(a => {
                    const n = (a.name || '').toLowerCase();
                    return n && (t.includes(n) || n.includes(t));
                });
                if (airEv && airEv.mockup_url) hasAirtableMockup = true;
            }

            let registrations = 0;
            if (ev.groups && Array.isArray(ev.groups)) {
                ev.groups.forEach(g => {
                    registrations += (g.peopleCount || 0);
                });
            }

            // Get subpage stats
            const s = getEventDetailedStats(ev.id);

            const headerHtml = bannerBg
                ? `<img src="${bannerBg}" class="w-full h-auto block transition-transform duration-500 group-hover:scale-105" alt="Event Banner">`
                : `<div class="w-full aspect-[21/9] flex items-center justify-center bg-primary/10 text-primary shrink-0 transition-transform duration-500 group-hover:scale-105"><span class="material-symbols-outlined text-5xl">event</span></div>`;

            const mockupIndicator = hasAirtableMockup ? `
                <div class="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
                    <span class="material-symbols-outlined text-[14px] text-amber-400">smartphone</span>
                    <span class="text-[9px] font-bold text-white uppercase tracking-tight">App Ready</span>
                </div>
            ` : '';

            htmlList += `
                        <div onclick="openEventModal('${ev.id}')" class="flex flex-col rounded-xl bg-background-dark/50 border border-border-dark/50 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden shadow-lg hover:shadow-primary/10">
                        <div class="w-full relative overflow-hidden">
                            ${headerHtml}
                            <div class="absolute top-3 right-3 z-10">
                                <span class="text-[10px] font-bold uppercase tracking-wider ${badgeClass} px-2 py-1 rounded-md border whitespace-nowrap shadow-sm backdrop-blur-md bg-opacity-80">${currentTab}</span>
                            </div>
                            ${mockupIndicator}
                        </div>
                        
                        <div class="p-5 flex flex-col flex-1">
                            <h4 class="text-white font-semibold text-base mb-3 group-hover:text-primary transition-colors line-clamp-2 leading-tight">${ev.title}</h4>
                            
                            <div class="space-y-2 mb-5 flex-1 mt-1">
                                <p class="text-xs text-slate-300 flex items-center gap-2 font-medium">
                                    <span class="material-symbols-outlined text-[14px] text-slate-400">calendar_today</span> 
                                    <span>${dateDisplay}</span>
                                </p>
                                <p class="text-xs text-slate-300 flex items-center gap-2 font-medium">
                                    <span class="material-symbols-outlined text-[14px] text-slate-400">location_on</span> 
                                    <span class="truncate pr-2">${addressStr}</span>
                                </p>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-2 pt-4 border-t border-border-dark/40 mt-auto w-full">
                                <!-- Registrations -->
                                <div class="flex items-center gap-2 bg-surface-hover/50 rounded-md px-2.5 py-2 border border-border-dark/30">
                                    <div class="p-1 bg-purple-500/10 rounded text-purple-400 shrink-0">
                                        <span class="material-symbols-outlined text-[16px] block">group</span>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-slate-200 font-semibold text-[11px] leading-tight">${registrations.toLocaleString()}</span>
                                        <span class="text-slate-500 text-[9px] uppercase tracking-widest truncate">Registrations</span>
                                    </div>
                                </div>

                                <!-- Exhibitors & Members -->
                                <div class="flex items-center gap-2 bg-surface-hover/50 rounded-md px-2.5 py-2 border border-border-dark/30">
                                    <div class="p-1 bg-amber-500/10 rounded text-amber-500 shrink-0">
                                        <span class="material-symbols-outlined text-[16px] block">storefront</span>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-slate-200 font-semibold text-[11px] leading-tight">${s.exhibitors.toLocaleString()} <span class="text-slate-500 text-[9px] font-normal">(${s.members.toLocaleString()})</span></span>
                                        <span class="text-slate-500 text-[9px] uppercase tracking-widest truncate">Exhibitors</span>
                                    </div>
                                </div>

                                <!-- Speakers & Sessions -->
                                <div class="flex items-center gap-2 bg-surface-hover/50 rounded-md px-2.5 py-2 border border-border-dark/30">
                                    <div class="p-1 bg-blue-500/10 rounded text-blue-500 shrink-0">
                                        <span class="material-symbols-outlined text-[16px] block">podium</span>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-slate-200 font-semibold text-[11px] leading-tight">${(s.people || 0).toLocaleString()} <span class="text-slate-500 text-[9px] font-normal">(${(s.sessions || 0).toLocaleString()})</span></span>
                                        <span class="text-slate-500 text-[9px] uppercase tracking-widest truncate">Speakers</span>
                                    </div>
                                </div>

                                <!-- Total Leads -->
                                <div class="flex items-center gap-2 bg-surface-hover/50 rounded-md px-2.5 py-2 border border-border-dark/30">
                                    <div class="p-1 bg-rose-500/10 rounded text-rose-500 shrink-0">
                                        <span class="material-symbols-outlined text-[16px] block">monitoring</span>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-slate-200 font-semibold text-[11px] leading-tight">${s.leads.toLocaleString()}</span>
                                        <span class="text-slate-500 text-[9px] uppercase tracking-widest truncate">Total Leads</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
        });
        htmlList += '</div>';
    } else {
        htmlList = `
                    <div class="text-center py-10 bg-background-dark/50 rounded-xl border border-border-dark/50">
                        <span class="material-symbols-outlined text-4xl text-slate-500 mb-2">event_busy</span>
                        <h3 class="text-slate-400 text-sm">No ${currentTab.toLowerCase()} events found.</h3>
                    </div>
                `;
    }

    document.getElementById('event-list-container').innerHTML = htmlList;
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update Tab UI
    const tabs = [
        { id: 'tab-active', name: 'Active' },
        { id: 'tab-upcoming', name: 'Future' },
        { id: 'tab-past', name: 'Past' }
    ];

    tabs.forEach(t => {
        const el = document.getElementById(t.id);
        if (!el) return;
        if (t.name === tabName) {
            el.className = 'px-4 py-1.5 text-xs font-medium text-white bg-surface-hover rounded shadow-sm';
        } else {
            el.className = 'px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors';
        }
    });

    renderEvents();
}

function openEventModal(eventId) {

    let ev = null;
    for (let tab in allEventsData) {
        let found = allEventsData[tab].find(e => e.id === eventId);
        if (found) { ev = found; break; }
    }
    if (!ev) return;

    // Base Swapcard data
    document.getElementById('modal-title').innerText = ev.title;
    const addressObj = ev.address || {};
    document.getElementById('modal-location-text').innerText = [addressObj.city, addressObj.country].filter(Boolean).join(', ') || 'Online / TBA';

    // Format dates
    let dateDisplay = 'TBA';
    try {
        if (ev.beginsAt) {
            const d1 = new Date(ev.beginsAt);
            const beginMonth = d1.toLocaleDateString('en-US', { month: 'short' });
            const beginDay = d1.getDate();
            const beginYear = d1.getFullYear();

            if (ev.endsAt) {
                const d2 = new Date(ev.endsAt);
                const endMonth = d2.toLocaleDateString('en-US', { month: 'short' });
                const endDay = d2.getDate();
                const endYear = d2.getFullYear();

                if (beginYear === endYear && beginMonth === endMonth) {
                    if (beginDay === endDay) dateDisplay = `${beginMonth} ${beginDay}, ${beginYear}`;
                    else dateDisplay = `${beginMonth} ${beginDay} - ${endDay}, ${beginYear}`;
                } else if (beginYear === endYear) {
                    dateDisplay = `${beginMonth} ${beginDay} - ${endMonth} ${endDay}, ${beginYear}`;
                } else {
                    dateDisplay = `${beginMonth} ${beginDay}, ${beginYear} - ${endMonth} ${endDay}, ${endYear}`;
                }
            } else {
                dateDisplay = `${beginMonth} ${beginDay}, ${beginYear}`;
            }
        }
    } catch (e) { }
    document.getElementById('modal-dates-text').innerText = dateDisplay;

    // Stats
    let registrations = 0;
    if (ev.groups && Array.isArray(ev.groups)) {
        ev.groups.forEach(g => { registrations += (g.peopleCount || 0); });
    }
    document.getElementById('modal-reg').innerText = registrations.toLocaleString();
    const detStats = getEventDetailedStats(ev.id);
    if (document.getElementById('modal-spk')) document.getElementById('modal-spk').innerText = detStats.people.toLocaleString();
    document.getElementById('modal-exh').innerText = detStats.exhibitors.toLocaleString();
    if (document.getElementById('modal-members')) document.getElementById('modal-members').innerText = detStats.members.toLocaleString();
    document.getElementById('modal-sess').innerText = detStats.sessions.toLocaleString();

    // Registration Groups Breakdown
    const groupsList = document.getElementById('modal-groups-list');
    const groupsTotalLabel = document.getElementById('modal-groups-total');
    if (groupsList) {
        groupsList.innerHTML = '';
        let grandTotal = 0;

        // Define Categories - Order matters for fuzzy matching!
        const categories = [
            { id: 'speakers', name: 'Speakers', icon: 'campaign', keywords: ['speaker', 'moderator', 'panelist'], groups: [], total: 0 },
            { id: 'visitors', name: 'Visitors', icon: 'person', keywords: ['attendee', 'visitor', 'student', 'guest', 'visitor-priority', 'founder', 'investor'], groups: [], total: 0 },
            { id: 'business', name: 'Exhibitors & Partners', icon: 'business_center', keywords: ['exhibitor', 'startup', 'ecosystem partner', 'sponsor', 'partner'], groups: [], total: 0 },
            { id: 'others', name: 'Others', icon: 'more_horiz', keywords: ['media', 'press'], groups: [], total: 0 }
        ];

        if (ev.groups && Array.isArray(ev.groups)) {
            ev.groups.forEach(g => {
                const count = g.peopleCount || 0;
                grandTotal += count;
                const nameLow = g.name.toLowerCase();

                // Find matching category
                let matched = categories.find(cat => cat.keywords.some(k => nameLow.includes(k)));
                if (!matched) matched = categories.find(cat => cat.id === 'others');

                matched.groups.push(g);
                matched.total += count;
            });

            // Render categories in requested order: Visitors, Exhibitors, Speakers, Others
            const displayOrder = ['visitors', 'business', 'speakers', 'others'];
            const sortedCategories = [...categories].sort((a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id));

            sortedCategories.forEach(cat => {
                if (cat.total === 0) return; // Skip empty categories

                const catHtml = `
                    <div class="bg-background-dark/20 border border-border-dark/30 rounded-xl overflow-hidden">
                        <div class="px-4 py-3 bg-white/5 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary text-[18px]">${cat.icon}</span>
                                <span class="text-xs font-bold text-slate-200 uppercase tracking-widest">${cat.name}</span>
                            </div>
                            <span class="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded">${cat.total.toLocaleString()}</span>
                        </div>
                        <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${cat.groups.sort((a, b) => b.peopleCount - a.peopleCount).map(g => `
                                <div class="flex items-center justify-between p-2 bg-background-dark/40 border border-border-dark/10 rounded-lg">
                                    <span class="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">${g.name}</span>
                                    <span class="text-[11px] font-bold text-slate-300 ml-2">${(g.peopleCount || 0).toLocaleString()}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                groupsList.innerHTML += catHtml;
            });
        }
        if (groupsTotalLabel) groupsTotalLabel.innerText = `Total: ${grandTotal.toLocaleString()}`;
    }

    // Use community bannerImageUrl first (shorter landscape format, ideal for modal header)
    // Fall back to the event's own banner
    const communityBanner = (ev.community && ev.community.cachedBannerUrl) || (ev.community && ev.community.bannerImageUrl ? imgUrl(ev.community.bannerImageUrl) : '');
    const eventBanner = (ev.banner && ev.banner.cachedUrl) || (ev.banner && ev.banner.imageUrl ? imgUrl(ev.banner.imageUrl) : '');
    const modalBannerUrl = communityBanner || eventBanner;
    const communityLogo = (ev.community && ev.community.cachedLogoUrl) || (ev.community && ev.community.logoUrl ? imgUrl(ev.community.logoUrl) : '');

    const logoHtml = communityLogo
        ? `<img src="${communityLogo}" alt="Community Logo" class="absolute bottom-4 left-6 z-20 h-10 w-10 rounded-lg object-contain bg-white/10 backdrop-blur-sm border border-white/20 p-1">`
        : '';

    const modalBannerEl = document.getElementById('modal-banner');
    if (modalBannerUrl) {
        modalBannerEl.style.backgroundImage = `url('${modalBannerUrl}')`;
        modalBannerEl.style.backgroundSize = 'cover';
        modalBannerEl.style.backgroundPosition = 'center';
        modalBannerEl.innerHTML = `<button onclick="closeEventModal()" class="absolute top-4 right-4 z-20 size-8 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"><span class="material-symbols-outlined text-[18px]">close</span></button><div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>${logoHtml}<div id="modal-stage" class="absolute bottom-4 right-6 z-20 text-xs font-semibold px-2 py-1 rounded bg-primary/80 text-black border border-primary/30 hidden backdrop-blur">Stage</div>`;
    } else {
        modalBannerEl.style.backgroundImage = 'none';
        modalBannerEl.innerHTML = `<button onclick="closeEventModal()" class="absolute top-4 right-4 z-20 size-8 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"><span class="material-symbols-outlined text-[18px]">close</span></button><div class="absolute inset-0 flex items-center justify-center bg-primary/10 text-primary"><span class="material-symbols-outlined text-5xl">event</span></div><div id="modal-stage" class="absolute bottom-4 right-6 z-20 text-xs font-semibold px-2 py-1 rounded bg-primary/20 text-primary border border-primary/30 hidden backdrop-blur">Stage</div>`;
    }

    // Sync Airtable matching
    let airEv = airtableData.find(a =>
        ev.title.toLowerCase().includes(a.name.toLowerCase()) ||
        a.name.toLowerCase().includes(ev.title.toLowerCase())
    );

    if (airEv) {
        document.getElementById('airtable-details-section').classList.remove('hidden');
        document.getElementById('airtable-missing-section').classList.add('hidden');

        // Project lead
        document.getElementById('modal-lead').innerText = airEv.project_lead && airEv.project_lead.length
            ? airEv.project_lead.join(', ')
            : 'Unassigned';

        // Stage (label field)
        document.getElementById('modal-stage-label').innerText = airEv.stage || '—';

        // App Status — colour-coded chip
        const appStatusEl = document.getElementById('modal-app-status');
        const statusVal = airEv.status_of_app || null;
        if (statusVal) {
            const statusColors = {
                'Ready for Launch': 'bg-green-500/20 text-green-300 border-green-500/30',
                'In Development': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                'Testing': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                'Planning': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                'On Hold': 'bg-red-500/20 text-red-300 border-red-500/30',
            };
            const colorClass = statusColors[statusVal] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            appStatusEl.innerHTML = `<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${colorClass}">${statusVal}</span>`;
        } else {
            appStatusEl.innerText = '—';
        }

        // App Ready Date
        const appReadyEl = document.getElementById('modal-app-ready');
        if (airEv.app_ready_date) {
            const d = new Date(airEv.app_ready_date);
            appReadyEl.innerText = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
            appReadyEl.innerText = '—';
        }

        // Event ID
        document.getElementById('modal-event-id').innerText = airEv.event_id || '—';

        // Progress bar animation
        const progressNum = parseInt((airEv.progress || '0%').replace('%', '')) || 0;
        document.getElementById('modal-progress-label').innerText = airEv.progress || '0%';
        document.getElementById('modal-tasks-label').innerText = `${airEv.tasks_done || 0} / ${airEv.total_tasks || 0} tasks done`;
        setTimeout(() => {
            document.getElementById('modal-progress-bar').style.width = `${progressNum}%`;
        }, 50);

        // Launch dates
        document.getElementById('modal-elab').innerText = airEv.planned_exhibitor_launch || '—';
        document.getElementById('modal-vlab').innerText = airEv.planned_visitor_launch || '—';

        // Stage chip on banner
        if (airEv.stage) {
            const stg = document.getElementById('modal-stage');
            if (stg) { stg.innerText = airEv.stage; stg.classList.remove('hidden'); }
        } else {
            const stg = document.getElementById('modal-stage');
            if (stg) stg.classList.add('hidden');
        }

        // Tech Stack — resolved names with coloured badges
        const techContainer = document.getElementById('modal-tech');
        techContainer.innerHTML = '';
        if (airEv.tech_stack && airEv.tech_stack.length > 0) {
            airEv.tech_stack.forEach((tech) => {
                // tech is now {name, domain} — handle both old string format and new object format
                const name = typeof tech === 'string' ? tech : tech.name;
                const domain = typeof tech === 'string' ? '' : (tech.domain || '');

                // Logo URL strategy: use cached local URLs injected by the server for instant loading
                const clearbitUrl = tech.cached_clearbit || (domain ? imgUrl(`https://logo.clearbit.com/${domain}`) : '');
                const faviconUrl = tech.cached_favicon || (domain ? imgUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`) : '');

                const logoHtml = (domain || tech.cached_clearbit) ? `
                            <img
                                src="${clearbitUrl}"
                                alt="${name} logo"
                                class="w-7 h-7 object-contain rounded"
                                onerror="this.onerror=null; this.src='${faviconUrl}'; this.onerror=function(){this.style.display='none'};"
                            >` : '';

                // Only apply white background to logos that are dark on transparent (e.g. Swapcard)
                const needsWhiteBg = new Set(['Swapcard']);
                const logoBg = (logoHtml && needsWhiteBg.has(name)) ? 'bg-white rounded-lg p-1' : '';

                techContainer.innerHTML += `
                            <div class="flex flex-col items-center gap-1.5 bg-background-dark/60 border border-border-dark/40 hover:border-primary/40 rounded-xl px-3 py-2.5 min-w-[70px] transition-colors group cursor-default">
                                ${logoHtml ? `<div class="w-8 h-8 flex items-center justify-center ${logoBg}">${logoHtml}</div>` : `<div class="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg"><span class="material-symbols-outlined text-slate-500 text-[20px]">apps</span></div>`}
                                <span class="text-[10px] font-medium text-slate-300 text-center leading-tight">${name}</span>
                            </div>`;
            });
        } else {
            techContainer.innerHTML = '<span class="text-slate-500 text-sm">—</span>';
        }

    } else {
        document.getElementById('airtable-details-section').classList.add('hidden');
        document.getElementById('airtable-missing-section').classList.remove('hidden');
        const stg = document.getElementById('modal-stage');
        if (stg) stg.classList.add('hidden');
    }

    // ── Default to Event Overview tab ─────────────────────────────────────────
    if (typeof switchEventModalTab === 'function') switchEventModalTab('data');

    // ── Populate the Leads tab ────────────────────────────────────────────────
    const leadsStats = (window.allSubpagesStats && window.allSubpagesStats[ev.id]) || {};
    const lTotal = leadsStats.stats_total_leads || 0;
    const lBook = leadsStats.stats_exhibitor_bookmarks || 0;
    const lConn = leadsStats.stats_connections_made || 0;
    const lScan = leadsStats.stats_badges_scanned || 0;
    const lContact = leadsStats.stats_business_cards_scanned || 0;
    const lReqs = leadsStats.stats_connection_requests_sent || 0;
    const lMsg = leadsStats.stats_messages_exchanged || 0;
    const lMeet = leadsStats.stats_meetings_created || 0;
    const lView = leadsStats.stats_exhibitor_views || 0;
    const lSyncedAt = leadsStats.analytics_synced_at || null;

    const _setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    _setEl('modal-leads-total', lTotal.toLocaleString());
    _setEl('modal-leads-bookmarks', lBook.toLocaleString());
    _setEl('modal-leads-connections', lConn.toLocaleString());
    _setEl('modal-leads-scans', lScan.toLocaleString());
    _setEl('modal-leads-contacts', lContact.toLocaleString());
    // Also inject the new stats if those elements exist
    _setEl('modal-leads-requests', lReqs.toLocaleString());
    _setEl('modal-leads-messages', lMsg.toLocaleString());
    _setEl('modal-leads-meetings', lMeet.toLocaleString());
    _setEl('modal-leads-views', lView.toLocaleString());

    // Synced timestamp label
    const syncedEl = document.getElementById('modal-leads-synced');
    if (syncedEl) {
        if (lSyncedAt) {
            const sd = new Date(lSyncedAt);
            syncedEl.innerText = `Synced ${sd.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        } else {
            syncedEl.innerText = 'Not yet synced';
        }
    }

    // Visual proportional breakdown bar
    const leadsBar = document.getElementById('modal-leads-bar');
    if (leadsBar) {
        if (lTotal > 0) {
            const segs = [
                { val: lView, cls: 'bg-sky-400' },
                { val: lBook, cls: 'bg-amber-400' },
                { val: lConn, cls: 'bg-emerald-400' },
                { val: lScan, cls: 'bg-blue-400' },
                { val: lContact, cls: 'bg-purple-400' },
                { val: lReqs, cls: 'bg-pink-400' },
                { val: lMsg, cls: 'bg-indigo-400' },
                { val: lMeet, cls: 'bg-teal-400' },
            ].filter(s => s.val > 0);
            leadsBar.innerHTML = segs.map(s =>
                `<div class="${s.cls} transition-all duration-700" style="flex:${s.val}"></div>`
            ).join('');
        } else {
            leadsBar.innerHTML = `<div class="bg-border-dark/50 w-full rounded-full h-full"></div>`;
        }
    }

    // --- Mobile simulation injection ---
    const simEventNameEl = document.getElementById('sim-event-name');
    if (simEventNameEl) simEventNameEl.innerText = ev.title || 'Event Name';

    // Conditional Mockup vs Simulation
    const mockupTab = document.getElementById('modal-tab-mobile');
    const mockupImg = document.getElementById('modal-mockup-img');

    if (airEv && airEv.mockup_url) {
        if (mockupTab) mockupTab.innerText = 'App Mockup';
        if (mockupImg) mockupImg.src = imgUrl(airEv.mockup_url);
        window.currentModalMockupMode = 'mockup';
    } else {
        if (mockupTab) mockupTab.innerText = 'Mobile Simulation';
        window.currentModalMockupMode = 'sim';
    }

    // Banner and Logo
    const simBannerEl = document.getElementById('sim-banner');
    const simLogoEl = document.getElementById('sim-logo');
    if (simBannerEl) {
        if (eventBanner || communityBanner) {
            simBannerEl.style.backgroundImage = `url('${eventBanner || communityBanner}')`;
            simBannerEl.style.backgroundSize = 'cover';
            simBannerEl.style.backgroundPosition = 'center';
        } else {
            simBannerEl.style.backgroundImage = 'none';
        }
    }
    if (simLogoEl) {
        if (communityLogo) {
            simLogoEl.style.display = 'flex';
            simLogoEl.innerHTML = `<img src="${communityLogo}" class="w-full h-full object-contain">`;
        } else {
            simLogoEl.style.display = 'none';
            simLogoEl.innerHTML = '';
        }
    }

    // Navigation Grid
    const navGrid = document.getElementById('sim-nav-grid');
    if (navGrid) {
        let isCityscape = ev.title && ev.title.toLowerCase().includes('cityscape');
        let isLeap = ev.title && ev.title.toLowerCase().includes('leap');

        let navItems = [
            { name: 'Exhibitors' },
            { name: 'Networking' },
            { name: 'Speakers' },
            { name: 'Agenda' },
            { name: 'Event Map' },
            { name: 'My Badge' }
        ];

        if (isCityscape) {
            navItems = [
                { name: 'Exhibitors' }, { name: 'Networking' },
                { name: 'Speakers' }, { name: 'Cityscape Global Agenda' },
                { name: 'ESTAAD Agenda' }, { name: 'Sponsors & Partners' },
                { name: 'Event Map' }, { name: 'My Badge' }
            ];
        } else if (isLeap) {
            navItems = [
                { name: 'LEAP Agenda' }, { name: 'DeepFest Agenda' },
                { name: 'Networking' }, { name: 'Speakers' },
                { name: 'Exhibitors' }, { name: 'Startups' },
                { name: 'Products & Services' }, { name: 'Floorplan' }
            ];
        }

        navGrid.innerHTML = navItems.map(n => `
            <div class="bg-[#1f1961] relative overflow-hidden rounded shadow-md flex flex-col items-center justify-center p-3 h-12 border border-black/20 text-center">
                <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                <span class="text-[10px] font-bold tracking-tight text-white leading-tight z-10 drop-shadow-md">${n.name}</span>
            </div>
        `).join('');
    }

    // Quick Links
    const quickLinks = document.getElementById('sim-quick-links');
    if (quickLinks) {
        const qlItems = ['Hotel', 'Venue', 'Help'];
        quickLinks.innerHTML = qlItems.map(q => `
            <div class="h-12 w-12 shrink-0 bg-[#1f1961] text-[#91e7d8] rounded flex items-center justify-center shadow-md border border-black/20">
                <span class="material-symbols-outlined text-xl">${q === 'Hotel' ? 'apartment' : (q === 'Venue' ? 'location_on' : 'support_agent')}</span>
            </div>
        `).join('');
    }
    // --- End mobile sim injection ---

    document.getElementById('event-modal-backdrop').classList.remove('hidden');
    document.getElementById('event-modal-backdrop').classList.add('flex');
    // Allow display block paint
    setTimeout(() => {
        document.getElementById('event-modal').classList.remove('scale-95', 'opacity-0');
        document.getElementById('event-modal').classList.add('scale-100', 'opacity-100');
    }, 10);
}

function switchEventModalTab(tabName) {
    const allTabs = ['data', 'registrations', 'leads', 'mobile'];
    const views = {
        'data': document.getElementById('modal-view-data'),
        'registrations': document.getElementById('modal-view-registrations'),
        'leads': document.getElementById('modal-view-leads'),
        'mobile': document.getElementById('modal-view-mobile'),
        'mockup': document.getElementById('modal-view-mockup')
    };

    allTabs.forEach(t => {
        const btn = document.getElementById(`modal-tab-${t}`);
        if (!btn) return;
        if (t === tabName) {
            btn.className = 'text-xs font-bold uppercase tracking-widest whitespace-nowrap text-primary border-b-2 border-primary py-4 px-3 transition-all';
        } else {
            btn.className = 'text-xs font-bold uppercase tracking-widest whitespace-nowrap text-slate-500 hover:text-white border-b-2 border-transparent py-4 px-3 transition-all';
        }
    });

    // Hide all views
    Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });

    // Show correct view
    if (tabName === 'data' && views.data) views.data.classList.remove('hidden');
    if (tabName === 'registrations' && views.registrations) views.registrations.classList.remove('hidden');
    if (tabName === 'leads' && views.leads) views.leads.classList.remove('hidden');
    if (tabName === 'mobile') {
        if (window.currentModalMockupMode === 'mockup' && views.mockup) {
            views.mockup.classList.remove('hidden');
        } else if (views.mobile) {
            views.mobile.classList.remove('hidden');
        }
    }
}

function closeEventModal() {
    document.getElementById('event-modal').classList.remove('scale-100', 'opacity-100');
    document.getElementById('event-modal').classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        document.getElementById('event-modal-backdrop').classList.add('hidden');
        document.getElementById('event-modal-backdrop').classList.remove('flex');
    }, 300);
}

async function loadEvents() {
    console.log('[LoadEvents] 🔄 Starting loadEvents function');
    try {
        console.log('[LoadEvents] 🌐 Fetching from Supabase table: swapcard_events');
        const { data: records, error } = await window.supabaseClient
            .from('swapcard_events')
            .select('*');

        if (error) throw error;
        console.log('[LoadEvents] 📦 Records received:', records.length);

        if (records) {
            // Regroup into Active, Future, Past
            const grouped = { "Active": [], "Future": [], "Past": [] };
            const stats = {};

            records.forEach(row => {
                const cat = row.category || 'Past';
                if (!grouped[cat]) grouped[cat] = [];

                // The 'data' column has the full Swapcard object
                const ev = row.data || {};
                grouped[cat].push(ev);

                // Populate subpage stats from SEPARATE COLUMNS (new schema)
                // Fallback to stats JSONB column for backward compatibility
                stats[row.id] = {
                    exhibitorCount: row.exhibitors_count ?? row.stats?.exhibitorCount ?? 0,
                    membersCount: row.members_count ?? row.stats?.membersCount ?? 0,
                    personCount: row.speakers_count ?? row.stats?.personCount ?? 0,
                    sessionsCount: row.sessions_count ?? row.stats?.sessionsCount ?? 0,
                    leadsCount: row.stats_total_leads ?? row.stats?.leadsCount ?? 0,
                    stats_total_leads: row.stats_total_leads ?? 0,
                    stats_badges_scanned: row.stats_badges_scanned ?? 0,
                    stats_business_cards_scanned: row.stats_business_cards_scanned ?? 0,
                    stats_connections_made: row.stats_connections_made ?? 0,
                    stats_connection_requests_sent: row.stats_connection_requests_sent ?? 0,
                    stats_messages_exchanged: row.stats_messages_exchanged ?? 0,
                    stats_meetings_created: row.stats_meetings_created ?? 0,
                    stats_exhibitor_views: row.stats_exhibitor_views ?? 0,
                    stats_exhibitor_bookmarks: row.stats_exhibitor_bookmarks ?? 0,
                    analytics_synced_at: row.analytics_synced_at ?? null,
                };
            });

            window.allEventsData = grouped;
            window.allSubpagesStats = stats;

            // Calculate metrics for dashboard using SEPARATE COLUMNS
            const metrics = {
                totalEvents: records.length,
                totalSpeakers: records.reduce((sum, r) => sum + (r.speakers_count ?? r.stats?.personCount ?? 0), 0),
                totalExhibitors: records.reduce((sum, r) => sum + (r.exhibitors_count ?? r.stats?.exhibitorCount ?? 0), 0),
                totalMembers: records.reduce((sum, r) => sum + (r.members_count ?? r.stats?.membersCount ?? 0), 0),
                totalSessions: records.reduce((sum, r) => sum + (r.sessions_count ?? r.stats?.sessionsCount ?? 0), 0),
                totalPeople: records.reduce((sum, r) => sum + (r.registrations_count ?? 0), 0),
                totalLeads: records.reduce((sum, r) => sum + (r.stats_total_leads ?? 0), 0),
            };

            const eventCount = records.length;
            console.log('[LoadEvents] ✅ Events loaded:', eventCount, 'events total');
            console.log('[LoadEvents] 📊 Metrics calculated:', metrics);

            // ── Preload all image assets into browser cache ──
            preloadEventImages();

            // Populate Global Event Filter
            if (typeof populateGlobalEventSelector === 'function') {
                populateGlobalEventSelector();
            }

            // Update stats - new combined card layout
            document.getElementById('stat-total-events').innerText = metrics.totalEvents || 0;
            document.getElementById('stat-total-people').innerText = (metrics.totalPeople || 0).toLocaleString();
            document.getElementById('stat-total-exhibitors').innerText = (metrics.totalExhibitors || 0).toLocaleString();
            document.getElementById('stat-total-members').innerText = (metrics.totalMembers || 0).toLocaleString();
            document.getElementById('stat-total-speakers').innerText = (metrics.totalSpeakers || 0).toLocaleString();
            document.getElementById('stat-total-sessions').innerText = (metrics.totalSessions || 0).toLocaleString();
            const _leadsEl = document.getElementById('stat-total-leads');
            if (_leadsEl) _leadsEl.innerText = (metrics.totalLeads || 0).toLocaleString();

            console.log('[LoadEvents] 🎨 Rendering events view');
            renderEvents();
            renderAllEventsData();
            console.log('[LoadEvents] ✅ loadEvents completed successfully');
        }
    } catch (e) {
        console.error('[LoadEvents] ❌ CRITICAL ERROR in loadEvents:', e);
        showError('Supabase connection error.', e.message);
    }
}

window.findAirtableMatch = function (evTitle) {
    if (!window.airtableData || !window.airtableData.length) return null;
    const t = evTitle.toLowerCase();
    return window.airtableData.find(a => {
        const n = (a.name || '').toLowerCase();
        return t.includes(n) || n.includes(t);
    }) || null;
};

function renderAllEventsData() {
    const container = document.getElementById('content-events');
    if (!container) return;

    // Gather events by tab
    let allEvs = [];
    if (eventsState.tab === 'All') {
        for (let t in allEventsData) {
            allEventsData[t].forEach(e => {
                if (!allEvs.find(ev => ev.id === e.id)) allEvs.push(e);
            });
        }
    } else {
        allEvs = [...(allEventsData[eventsState.tab] || [])];
    }

    // Global Filter
    if (typeof globalSelectedEventId !== 'undefined' && globalSelectedEventId !== 'all') {
        allEvs = allEvs.filter(ev => ev.id === globalSelectedEventId);
    }

    // Search filter
    if (eventsState.search) {
        const query = eventsState.search.toLowerCase();
        allEvs = allEvs.filter(ev => {
            const titleMatch = (ev.title || '').toLowerCase().includes(query);
            const commMatch = (ev.community && ev.community.name ? ev.community.name : '').toLowerCase().includes(query);
            const addressObj = ev.address || {};
            const addressMatch = (addressObj.city || '').toLowerCase().includes(query) || (addressObj.country || '').toLowerCase().includes(query);
            const dateStr = ev.beginsAt ? new Date(ev.beginsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
            const dateMatch = dateStr.includes(query);
            return titleMatch || commMatch || addressMatch || dateMatch;
        });
    }

    // Year filter
    if (eventsState.year !== 'All') {
        allEvs = allEvs.filter(ev => {
            if (!ev.beginsAt) return false;
            return new Date(ev.beginsAt).getFullYear().toString() === eventsState.year;
        });
    }

    // Advanced filters
    if (eventsState.advanced.community !== 'All') {
        allEvs = allEvs.filter(ev => (ev.community && ev.community.name) === eventsState.advanced.community);
    }
    if (eventsState.advanced.minReg > 0) {
        allEvs = allEvs.filter(ev => {
            let reg = 0;
            if (ev.groups && Array.isArray(ev.groups)) ev.groups.forEach(g => reg += (g.peopleCount || 0));
            return reg >= eventsState.advanced.minReg;
        });
    }
    if (eventsState.advanced.minExh > 0) allEvs = allEvs.filter(ev => (getEventDetailedStats(ev.id).exhibitors || 0) >= eventsState.advanced.minExh);
    if (eventsState.advanced.minSess > 0) allEvs = allEvs.filter(ev => (getEventDetailedStats(ev.id).sessions || 0) >= eventsState.advanced.minSess);
    if (eventsState.advanced.minSpk > 0) allEvs = allEvs.filter(ev => (getEventDetailedStats(ev.id).people || 0) >= eventsState.advanced.minSpk);

    // Column Filters (per-column thresholds)
    if (eventsState.columnFilters.registrations) {
        allEvs = allEvs.filter(ev => {
            let reg = 0; if (ev.groups) ev.groups.forEach(g => reg += (g.peopleCount || 0));
            return reg >= parseInt(eventsState.columnFilters.registrations);
        });
    }
    if (eventsState.columnFilters.leads) allEvs = allEvs.filter(ev => getEventDetailedStats(ev.id).leads >= parseInt(eventsState.columnFilters.leads));
    if (eventsState.columnFilters.exhibitors) allEvs = allEvs.filter(ev => getEventDetailedStats(ev.id).exhibitors >= parseInt(eventsState.columnFilters.exhibitors));
    if (eventsState.columnFilters.speakers) allEvs = allEvs.filter(ev => getEventDetailedStats(ev.id).people >= parseInt(eventsState.columnFilters.speakers));
    if (eventsState.columnFilters.sessions) allEvs = allEvs.filter(ev => getEventDetailedStats(ev.id).sessions >= parseInt(eventsState.columnFilters.sessions));

    // Sorting
    if (eventsState.sortColumn) {
        allEvs.sort((a, b) => {
            let valA, valB;
            switch (eventsState.sortColumn) {
                case 'name':
                    valA = (a.title || '').toLowerCase();
                    valB = (b.title || '').toLowerCase();
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'registrations':
                    valA = 0; if (a.groups) a.groups.forEach(g => valA += (g.peopleCount || 0));
                    valB = 0; if (b.groups) b.groups.forEach(g => valB += (g.peopleCount || 0));
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leads':
                    valA = getEventDetailedStats(a.id).leads;
                    valB = getEventDetailedStats(b.id).leads;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsViews':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_exhibitor_views || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_exhibitor_views || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsBookmarks':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_exhibitor_bookmarks || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_exhibitor_bookmarks || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsConnections':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_connections_made || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_connections_made || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsScans':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_badges_scanned || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_badges_scanned || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsContacts':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_business_cards_scanned || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_business_cards_scanned || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsRequests':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_connection_requests_sent || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_connection_requests_sent || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsMessages':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_messages_exchanged || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_messages_exchanged || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'leadsMeetings':
                    valA = (window.allSubpagesStats && window.allSubpagesStats[a.id]) ? (window.allSubpagesStats[a.id].stats_meetings_created || 0) : 0;
                    valB = (window.allSubpagesStats && window.allSubpagesStats[b.id]) ? (window.allSubpagesStats[b.id].stats_meetings_created || 0) : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'exhibitors':
                    valA = getEventDetailedStats(a.id).exhibitors;
                    valB = getEventDetailedStats(b.id).exhibitors;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'speakers':
                    valA = getEventDetailedStats(a.id).people;
                    valB = getEventDetailedStats(b.id).people;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'sessions':
                    valA = getEventDetailedStats(a.id).sessions;
                    valB = getEventDetailedStats(b.id).sessions;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'sponsors':
                    valA = getEventDetailedStats(a.id).sponsors;
                    valB = getEventDetailedStats(b.id).sponsors;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'members':
                    valA = getEventDetailedStats(a.id).members;
                    valB = getEventDetailedStats(b.id).members;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'status':
                    valA = (a.status || 'Past').toLowerCase();
                    valB = (b.status || 'Past').toLowerCase();
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'startDate':
                    valA = a.beginsAt || '';
                    valB = b.beginsAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'endDate':
                    valA = a.endsAt || '';
                    valB = b.endsAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'duration':
                    valA = 0; valB = 0;
                    if (a.beginsAt && a.endsAt) valA = Math.ceil((new Date(a.endsAt) - new Date(a.beginsAt)) / (1000 * 60 * 60 * 24)) + 1;
                    if (b.beginsAt && b.endsAt) valB = Math.ceil((new Date(b.endsAt) - new Date(b.beginsAt)) / (1000 * 60 * 60 * 24)) + 1;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'year':
                    valA = a.beginsAt ? new Date(a.beginsAt).getFullYear() : 0;
                    valB = b.beginsAt ? new Date(b.beginsAt).getFullYear() : 0;
                    return eventsState.sortDirection === 'asc' ? valA - valB : valB - valA;
                case 'createdAt':
                    valA = a.createdAt || '';
                    valB = b.createdAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'updatedAt':
                    valA = a.updatedAt || '';
                    valB = b.updatedAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'date':
                    valA = a.beginsAt || '';
                    valB = b.beginsAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default:
                    valA = a.beginsAt || '';
                    valB = b.beginsAt || '';
                    return eventsState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        });
    } else {
        allEvs.sort((a, b) => (b.beginsAt || '').localeCompare(a.beginsAt || ''));
    }

    if (allEvs.length === 0) {
        container.className = 'flex-1 flex flex-col items-center justify-center text-center p-12';
        container.innerHTML = `
                     <div class="size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center text-primary mb-6 ring-1 ring-primary/30 shadow-inner">
                        <span class="material-symbols-outlined text-[40px] opacity-80">event_busy</span>
                     </div>
                     <h3 class="text-xl font-bold text-white mb-2 tracking-tight">No Events Found</h3>
                     <p class="text-sm text-slate-400 max-w-sm mb-6">Could not find any events matching your current filters.</p>
                 `;
        return;
    }

    let resultHtml = '';
    let totalReg = 0, totalExh = 0, totalSpk = 0, totalSess = 0, totalLeads = 0, totalMembers = 0, totalSponsors = 0;
    let totalLeadViews = 0, totalLeadBookmarks = 0, totalLeadConnections = 0, totalLeadScans = 0;
    let totalLeadContacts = 0, totalLeadRequests = 0, totalLeadMessages = 0, totalLeadMeetings = 0;

    const sortIcon = (col) => {
        if (eventsState.sortColumn !== col) return '';
        return eventsState.sortDirection === 'asc'
            ? '<span class="material-symbols-outlined text-primary text-[10px] align-middle">arrow_upward</span>'
            : '<span class="material-symbols-outlined text-primary text-[10px] align-middle">arrow_downward</span>';
    };

    if (eventsState.view === 'table') {
        resultHtml += `
                <div class="w-full h-full overflow-y-auto overflow-x-auto relative glass-dark">
                    <table id="events-data-table" class="w-full text-left border-collapse">
                        <thead class="sticky top-0 bg-[#0f172a]/95 backdrop-blur-md border-b border-border-dark/60 z-10 shadow-sm">
                            <tr class="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">
                                <th onclick="setEventsSortColumn('name')" class="px-5 py-3 min-w-[300px] cursor-pointer hover:text-white transition-colors group select-none">
                                    Event ${sortIcon('name')}
                                </th>
                                <th onclick="setEventsSortColumn('date')" class="px-4 py-3 min-w-[160px] cursor-pointer hover:text-white transition-colors group select-none">
                                    Date ${sortIcon('date')}
                                </th>
                                <th class="px-4 py-3 min-w-[150px]">Location</th>
                                ${eventsState.visibleColumns.registrations ? `<th onclick="setEventsSortColumn('registrations')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Registrations ${sortIcon('registrations')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leads ? `<th onclick="setEventsSortColumn('leads')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Leads ${sortIcon('leads')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsViews ? `<th onclick="setEventsSortColumn('leadsViews')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Views ${sortIcon('leadsViews')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsBookmarks ? `<th onclick="setEventsSortColumn('leadsBookmarks')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Bookmarks ${sortIcon('leadsBookmarks')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsConnections ? `<th onclick="setEventsSortColumn('leadsConnections')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Connections ${sortIcon('leadsConnections')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsScans ? `<th onclick="setEventsSortColumn('leadsScans')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Badge Scans ${sortIcon('leadsScans')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsContacts ? `<th onclick="setEventsSortColumn('leadsContacts')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Contacts ${sortIcon('leadsContacts')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsRequests ? `<th onclick="setEventsSortColumn('leadsRequests')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Requests ${sortIcon('leadsRequests')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsMessages ? `<th onclick="setEventsSortColumn('leadsMessages')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Messages ${sortIcon('leadsMessages')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.leadsMeetings ? `<th onclick="setEventsSortColumn('leadsMeetings')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Meetings ${sortIcon('leadsMeetings')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.exhibitors ? `<th onclick="setEventsSortColumn('exhibitors')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Exhibitors ${sortIcon('exhibitors')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.speakers ? `<th onclick="setEventsSortColumn('speakers')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Speakers ${sortIcon('speakers')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.sessions ? `<th onclick="setEventsSortColumn('sessions')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Sessions ${sortIcon('sessions')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.sponsors ? `<th onclick="setEventsSortColumn('sponsors')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Sponsors ${sortIcon('sponsors')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.members ? `<th onclick="setEventsSortColumn('members')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Members ${sortIcon('members')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.status ? `<th onclick="setEventsSortColumn('status')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Status ${sortIcon('status')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.community ? `<th class="px-3 py-3 cursor-pointer hover:text-white transition-colors group select-none">
                                    Community
                                </th>` : ''}
                                ${eventsState.visibleColumns.startDate ? `<th onclick="setEventsSortColumn('startDate')" class="px-3 py-3 cursor-pointer hover:text-white transition-colors group select-none">
                                    Start Date ${sortIcon('startDate')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.endDate ? `<th onclick="setEventsSortColumn('endDate')" class="px-3 py-3 cursor-pointer hover:text-white transition-colors group select-none">
                                    End Date ${sortIcon('endDate')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.duration ? `<th onclick="setEventsSortColumn('duration')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Duration ${sortIcon('duration')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.year ? `<th onclick="setEventsSortColumn('year')" class="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors group select-none">
                                    Year ${sortIcon('year')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.city ? `<th class="px-3 py-3">
                                    City
                                </th>` : ''}
                                ${eventsState.visibleColumns.country ? `<th class="px-3 py-3">
                                    Country
                                </th>` : ''}
                                ${eventsState.visibleColumns.venue ? `<th class="px-3 py-3">
                                    Venue
                                </th>` : ''}
                                ${eventsState.visibleColumns.timezone ? `<th class="px-3 py-3 text-center">
                                    Timezone
                                </th>` : ''}
                                ${eventsState.visibleColumns.eventId ? `<th class="px-3 py-3">
                                    Event ID
                                </th>` : ''}
                                ${eventsState.visibleColumns.createdAt ? `<th onclick="setEventsSortColumn('createdAt')" class="px-3 py-3 cursor-pointer hover:text-white transition-colors group select-none">
                                    Created ${sortIcon('createdAt')}
                                </th>` : ''}
                                ${eventsState.visibleColumns.updatedAt ? `<th onclick="setEventsSortColumn('updatedAt')" class="px-3 py-3 cursor-pointer hover:text-white transition-colors group select-none pr-5">
                                    Updated ${sortIcon('updatedAt')}
                                </th>` : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border-dark/20">
                `;
    } else {
        resultHtml += '<div class="grid grid-cols-3 gap-5 p-5 w-full h-full overflow-y-auto content-start">';
    }

    allEvs.forEach(ev => {
        const addressObj = ev.address || {};
        const addressStr = [addressObj.city, addressObj.country].filter(Boolean).join(', ') || 'Online / TBA';
        const city = addressObj.city || '—';
        const country = addressObj.country || '—';
        const venue = addressObj.venue || addressObj.name || '—';
        const timezone = ev.timezone || '—';

        // Date formatting
        let dateDisplay = 'TBA';
        let yearStr = '';
        let startDateStr = '—';
        let endDateStr = '—';
        let durationDays = 0;
        try {
            if (ev.beginsAt) {
                const d1 = new Date(ev.beginsAt);
                yearStr = d1.getFullYear().toString();
                const beginMonth = d1.toLocaleDateString('en-US', { month: 'short' });
                const beginDay = d1.getDate();
                const beginYear = d1.getFullYear();
                startDateStr = `${beginMonth} ${beginDay}, ${beginYear}`;

                if (ev.endsAt) {
                    const d2 = new Date(ev.endsAt);
                    const endMonth = d2.toLocaleDateString('en-US', { month: 'short' });
                    const endDay = d2.getDate();
                    const endYear = d2.getFullYear();
                    endDateStr = `${endMonth} ${endDay}, ${endYear}`;

                    // Calculate duration in days
                    durationDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

                    if (beginYear === endYear && beginMonth === endMonth) {
                        dateDisplay = beginDay === endDay
                            ? `${beginMonth} ${beginDay}, ${beginYear}`
                            : `${beginMonth} ${beginDay}–${endDay}, ${beginYear}`;
                    } else if (beginYear === endYear) {
                        dateDisplay = `${beginMonth} ${beginDay} – ${endMonth} ${endDay}, ${beginYear}`;
                    } else {
                        dateDisplay = `${beginMonth} ${beginDay}, ${beginYear} – ${endMonth} ${endDay}, ${endYear}`;
                    }
                } else {
                    dateDisplay = `${beginMonth} ${beginDay}, ${beginYear}`;
                    durationDays = 1;
                }
            }
        } catch (e) { }

        let registrations = 0;
        if (ev.groups && Array.isArray(ev.groups)) ev.groups.forEach(g => { registrations += (g.peopleCount || 0); });

        const s = getEventDetailedStats(ev.id);
        totalReg += registrations;
        totalExh += s.exhibitors;
        totalSpk += s.people;
        totalSess += s.sessions;
        totalLeads += s.leads;
        totalMembers += s.members;
        totalSponsors += s.sponsors;

        // Get detailed leads breakdown from allSubpagesStats
        const leadsDetailed = (window.allSubpagesStats && window.allSubpagesStats[ev.id]) || {};
        const leadViews = leadsDetailed.stats_exhibitor_views || 0;
        const leadBookmarks = leadsDetailed.stats_exhibitor_bookmarks || 0;
        const leadConnections = leadsDetailed.stats_connections_made || 0;
        const leadScans = leadsDetailed.stats_badges_scanned || 0;
        const leadContacts = leadsDetailed.stats_business_cards_scanned || 0;
        const leadRequests = leadsDetailed.stats_connection_requests_sent || 0;
        const leadMessages = leadsDetailed.stats_messages_exchanged || 0;
        const leadMeetings = leadsDetailed.stats_meetings_created || 0;

        // Add to totals
        totalLeadViews += leadViews;
        totalLeadBookmarks += leadBookmarks;
        totalLeadConnections += leadConnections;
        totalLeadScans += leadScans;
        totalLeadContacts += leadContacts;
        totalLeadRequests += leadRequests;
        totalLeadMessages += leadMessages;
        totalLeadMeetings += leadMeetings;

        // ── Airtable logo lookup ──────────────────────────────────────────────────────
        const airEv = findAirtableMatch(ev.title || '');
        // Use cached_logo_url (local /img_cache/ path) injected by the server — instant load
        // Fallback sequence: Airtable cached -> Airtable proxy -> Community cached -> Community proxy -> empty
        const logoUrl = (airEv && airEv.cached_logo_url)
            || (airEv && airEv.logo_url ? imgUrl(airEv.logo_url) : '')
            || (ev.community && ev.community.cachedLogoUrl)
            || (ev.community && ev.community.logoUrl ? imgUrl(ev.community.logoUrl) : '');

        // Use cachedUrl (local /img_cache/ path) injected by the server for banners
        const bannerUrl = (ev.banner && ev.banner.cachedUrl)
            || (ev.banner && ev.banner.imageUrl ? imgUrl(ev.banner.imageUrl) : '');

        // Tab status colour
        const catColors = {
            'Active': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
            'Future': 'text-amber-400 bg-amber-400/10 border-amber-400/30',
            'Past': 'text-slate-400  bg-slate-400/10  border-slate-400/30'
        };
        const st = eventsState.tab === 'All' ? (ev.status || 'Past') : eventsState.tab;
        const bCls = catColors[st] || catColors['Past'];

        if (eventsState.view === 'table') {
            // ── TABLE ROW ────────────────────────────────────────────
            // Icon: Airtable logo (square app icon) first; fall back to community logo; then banner; then generic
            const iconHtml = logoUrl
                ? `<img src="${logoUrl}" class="size-9 rounded-lg object-cover border border-white/10 shadow" onerror="this.onerror=null;this.src='';this.className='hidden';" />`
                : bannerUrl
                    ? `<img src="${bannerUrl}" class="size-9 rounded-lg object-cover border border-white/10 shadow" />`
                    : `<div class="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20"><span class="material-symbols-outlined text-[18px]">event</span></div>`;

            resultHtml += `
                        <tr class="hover:bg-white/[0.025] transition-colors cursor-pointer group" onclick="openEventModal('${ev.id}')">
                            <td class="px-5 py-2.5">
                                <div class="flex items-center gap-3">
                                    <div class="shrink-0">${iconHtml}</div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-white font-semibold group-hover:text-primary transition-colors text-[13px] line-clamp-1 tracking-tight">${ev.title || '-'}</span>
                                        <span class="text-slate-500 text-[10px] font-medium uppercase tracking-wider mt-0.5">${ev.community && ev.community.name ? ev.community.name : '—'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-2.5 text-[11px] text-slate-400 font-medium whitespace-nowrap">${dateDisplay}</td>
                            <td class="px-4 py-2.5 text-[11px] text-slate-400 font-medium">
                                <span class="truncate block max-w-[140px]">${addressStr}</span>
                            </td>
                            ${eventsState.visibleColumns.registrations ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-white font-bold text-[12px]">${registrations.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leads ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-white font-bold text-[12px]">${(s.leads || 0).toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsViews ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-sky-400 font-semibold text-[11px]">${leadViews.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsBookmarks ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-amber-400 font-semibold text-[11px]">${leadBookmarks.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsConnections ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-emerald-400 font-semibold text-[11px]">${leadConnections.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsScans ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-blue-400 font-semibold text-[11px]">${leadScans.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsContacts ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-purple-400 font-semibold text-[11px]">${leadContacts.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsRequests ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-pink-400 font-semibold text-[11px]">${leadRequests.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsMessages ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-indigo-400 font-semibold text-[11px]">${leadMessages.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.leadsMeetings ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-teal-400 font-semibold text-[11px]">${leadMeetings.toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.exhibitors ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-slate-300 font-semibold text-[12px]">${(s.exhibitors || 0).toLocaleString()} <span class="text-slate-500 font-normal text-[10px]">(${(s.members || 0).toLocaleString()})</span></span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.speakers ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-white font-bold text-[12px]">${(s.people || 0).toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.sessions ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-slate-400 font-semibold text-[12px]">${(s.sessions || 0).toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.sponsors ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-slate-400 font-semibold text-[12px]">${(s.sponsors || 0).toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.members ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-slate-400 font-semibold text-[12px]">${(s.members || 0).toLocaleString()}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.status ? `<td class="px-3 py-2.5 text-center">
                                <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${bCls}">${st}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.community ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium">
                                <span class="truncate block max-w-[140px]">${ev.community && ev.community.name ? ev.community.name : '—'}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.startDate ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                ${startDateStr}
                            </td>` : ''}
                            ${eventsState.visibleColumns.endDate ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                ${endDateStr}
                            </td>` : ''}
                            ${eventsState.visibleColumns.duration ? `<td class="px-3 py-2.5 text-center text-[11px] text-slate-400 font-medium">
                                ${durationDays > 0 ? `${durationDays} day${durationDays !== 1 ? 's' : ''}` : '—'}
                            </td>` : ''}
                            ${eventsState.visibleColumns.year ? `<td class="px-3 py-2.5 text-center text-[11px] text-slate-400 font-medium">
                                ${yearStr || '—'}
                            </td>` : ''}
                            ${eventsState.visibleColumns.city ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium">
                                ${city}
                            </td>` : ''}
                            ${eventsState.visibleColumns.country ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium">
                                ${country}
                            </td>` : ''}
                            ${eventsState.visibleColumns.venue ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium">
                                <span class="truncate block max-w-[180px]">${venue}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.timezone ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 font-medium text-center">
                                ${timezone}
                            </td>` : ''}
                            ${eventsState.visibleColumns.eventId ? `<td class="px-3 py-2.5 text-[10px] text-slate-500 font-mono">
                                <span class="truncate block max-w-[100px]">${ev.id || '—'}</span>
                            </td>` : ''}
                            ${eventsState.visibleColumns.createdAt ? `<td class="px-3 py-2.5 text-[10px] text-slate-500 whitespace-nowrap">
                                ${ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>` : ''}
                            ${eventsState.visibleColumns.updatedAt ? `<td class="px-3 py-2.5 text-[10px] text-slate-500 whitespace-nowrap pr-5">
                                ${ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                <span class="material-symbols-outlined text-[14px] text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 align-middle">chevron_right</span>
                            </td>` : ''}
                        </tr>
                    `;
        } else {
            // ── CARD VIEW ────────────────────────────────────────────
            // Use event banner as the card hero.
            // Image is NOT cropped — it shows at its natural ratio inside a dark bg.
            // Airtable app icon (logoUrl) appears as a small overlay badge bottom-left.
            const cardHero = bannerUrl
                ? `<img src="${imgUrl(bannerUrl)}" class="w-full block" alt="${ev.title}" style="transition:transform 0.7s; display:block; width:100%; height:auto;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'" />`
                : `<div class="flex items-center justify-center bg-gradient-to-br from-primary/10 to-background-dark" style="aspect-ratio:16/9"><span class="material-symbols-outlined text-5xl text-primary/30">event</span></div>`;

            // Small app icon overlay (Airtable logo, bottom-left of banner)
            const appIconOverlay = logoUrl
                ? `<div class="absolute bottom-3 left-3 z-20">
                       <img src="${logoUrl}" alt="app icon"
                           class="size-8 rounded-lg object-cover bg-black/60 backdrop-blur-sm border border-white/15 shadow-lg"
                           onerror="this.parentElement.remove();" />
                   </div>`
                : '';


            resultHtml += `
                        <div onclick="openEventModal('${ev.id}')" class="flex flex-col rounded-2xl bg-surface-dark border border-border-dark/50 hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden shadow-lg hover:shadow-primary/5 transform hover:-translate-y-0.5 duration-200">
                            <div class="w-full relative bg-background-dark/60" style="overflow:hidden">
                                ${cardHero}
                                <div class="absolute inset-0 bg-gradient-to-t from-background-dark/60 via-transparent to-transparent pointer-events-none"></div>
                                <div class="absolute top-3 right-3 z-10">
                                    <span class="text-[9px] font-black uppercase tracking-[0.15em] ${bCls} px-2 py-1 rounded-lg border shadow-lg backdrop-blur-md">${st}</span>
                                </div>
                                ${yearStr && st !== 'Active' && st !== 'Future' ? `<div class="absolute top-3 left-3 z-10"><span class="text-[9px] font-bold text-slate-400 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">${yearStr}</span></div>` : ''}
                                ${appIconOverlay}
                            </div>


                            <div class="p-4 flex flex-col flex-1">
                                <h4 class="text-white font-semibold text-[13px] mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">${ev.title}</h4>

                                <div class="space-y-1.5 mb-3 flex-1">
                                    <div class="flex items-center gap-2 text-slate-500">
                                        <span class="material-symbols-outlined text-[13px]">calendar_today</span>
                                        <span class="text-[11px] font-medium">${dateDisplay}</span>
                                    </div>
                                    <div class="flex items-center gap-2 text-slate-500">
                                        <span class="material-symbols-outlined text-[13px]">location_on</span>
                                        <span class="text-[11px] font-medium truncate">${addressStr}</span>
                                    </div>
                                </div>

                                <div class="grid grid-cols-4 gap-1.5 pt-3 border-t border-border-dark/40 mt-auto">
                                    <div class="flex flex-col items-center p-1.5 rounded-lg bg-background-dark/40">
                                        <span class="text-white font-bold text-[11px]">${registrations.toLocaleString()}</span>
                                        <span class="text-[8px] text-slate-600 font-bold uppercase tracking-wide mt-0.5">Reg</span>
                                    </div>
                                    <div class="flex flex-col items-center p-1.5 rounded-lg bg-background-dark/40">
                                        <span class="text-rose-400 font-bold text-[11px]">${(s.leads || 0).toLocaleString()}</span>
                                        <span class="text-[8px] text-slate-600 font-bold uppercase tracking-wide mt-0.5">Leads</span>
                                    </div>
                                    <div class="flex flex-col items-center p-1.5 rounded-lg bg-background-dark/40">
                                        <span class="text-amber-400 font-bold text-[11px]">${(s.exhibitors || 0).toLocaleString()} <span class="text-[9px] text-slate-500 font-normal">(${(s.members || 0).toLocaleString()})</span></span>
                                        <span class="text-[8px] text-slate-600 font-bold uppercase tracking-wide mt-0.5">Exh / Mem</span>
                                    </div>
                                    <div class="flex flex-col items-center p-1.5 rounded-lg bg-background-dark/40">
                                        <span class="text-emerald-400 font-bold text-[11px]">${(s.sessions || 0).toLocaleString()}</span>
                                        <span class="text-[8px] text-slate-600 font-bold uppercase tracking-wide mt-0.5">Sess</span>
                                    </div>
                                </div>
                            </div>
                        </div>`;
        }
    });

    if (eventsState.view === 'table') {
        resultHtml += `
                        </tbody>
                        <tfoot class="sticky bottom-0 bg-surface-dark/95 backdrop-blur-md border-t border-border-dark/60 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td colspan="3" class="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Totals &mdash; <span class="text-slate-500 font-medium lowercase">${allEvs.length} events</span></td>
                                ${eventsState.visibleColumns.registrations ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-white text-[12px] bg-white/10 px-2 py-0.5 rounded border border-white/20">${totalReg.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leads ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-purple-400 text-[12px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">${totalLeads.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsViews ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-sky-400 text-[11px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">${totalLeadViews.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsBookmarks ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-amber-400 text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">${totalLeadBookmarks.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsConnections ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">${totalLeadConnections.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsScans ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-blue-400 text-[11px] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">${totalLeadScans.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsContacts ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-purple-400 text-[11px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">${totalLeadContacts.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsRequests ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-pink-400 text-[11px] bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">${totalLeadRequests.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsMessages ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-indigo-400 text-[11px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">${totalLeadMessages.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.leadsMeetings ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-teal-400 text-[11px] bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">${totalLeadMeetings.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.exhibitors ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-amber-500 text-[12px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">${totalExh.toLocaleString()} <span class="text-[9px] font-normal">(${totalMembers.toLocaleString()} members)</span></span></td>` : ''}
                                ${eventsState.visibleColumns.speakers ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-violet-400 text-[12px] bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">${totalSpk.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.sessions ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-emerald-500 text-[12px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">${totalSess.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.sponsors ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-slate-400 text-[12px] bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20">${totalSponsors.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.members ? `<td class="px-3 py-2.5 text-center"><span class="font-bold text-slate-400 text-[12px] bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20">${totalMembers.toLocaleString()}</span></td>` : ''}
                                ${eventsState.visibleColumns.status ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.community ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.startDate ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.endDate ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.duration ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.year ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.city ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.country ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.venue ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.timezone ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.eventId ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.createdAt ? `<td class="px-3 py-2.5 text-center"></td>` : ''}
                                ${eventsState.visibleColumns.updatedAt ? `<td class="px-3 py-2.5 text-center pr-5"></td>` : ''}
                            </tr>
                        </tfoot>
                    </table>
                </div>
                `;
    } else {
        resultHtml += '</div>';
    }

    container.className = 'w-full flex-1 flex flex-col p-0 m-0';
    container.innerHTML = resultHtml;
}


function setEventsTab(tab) { eventsState.tab = tab; updateEventsUI(); renderAllEventsData(); }

function setEventsView(v) { eventsState.view = v; updateEventsUI(); renderAllEventsData(); }

function setEventsYear(y) { eventsState.year = y; renderAllEventsData(); }

function exportEventsToExcel() {
    let allEvs = [];
    for (let tab in allEventsData) {
        allEventsData[tab].forEach(e => {
            if (!allEvs.find(ev => ev.id === e.id)) {
                allEvs.push(e);
            }
        });
    }

    if (allEvs.length === 0) {
        showToast('Warning', 'No data to export.');
        return;
    }

    const exportData = allEvs.map(ev => {
        let registrations = 0;
        if (ev.groups && Array.isArray(ev.groups)) {
            ev.groups.forEach(g => {
                registrations += (g.peopleCount || 0);
            });
        }
        const addressObj = ev.address || {};

        const detStats = getEventDetailedStats(ev.id);
        return {
            'Event ID': ev.id,
            'Event Name': ev.title || '',
            'Community Name': (ev.community && ev.community.name) ? ev.community.name : '',
            'Start Date': ev.beginsAt ? new Date(ev.beginsAt).toISOString() : '',
            'End Date': ev.endsAt ? new Date(ev.endsAt).toISOString() : '',
            'City': addressObj.city || '',
            'Country': addressObj.country || '',
            'Registrations': registrations,
            'Total Leads': detStats.leads,
            'Exhibitors': ev.totalExhibitors || 0,
            'Total Members': detStats.members,
            'Sessions': ev.totalPlannings || 0
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Events");
    XLSX.writeFile(wb, "EventHubX_Events.xlsx");
    logActivity(currentUser ? currentUser.short_name : 'User', 'Exported Events data to Excel', 'Export');
}

// ── Saved Views Implementation ──────────────────────────────────────────────

window.toggleSavedViewsDropdown = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('saved-views-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderSavedViewsList();
        }
    }
};

window.renderSavedViewsList = function () {
    const list = document.getElementById('saved-views-list');
    if (!list) return;

    const savedViews = JSON.parse(localStorage.getItem('event_saved_views') || '{}');
    const defaultView = localStorage.getItem('event_default_view');

    if (Object.keys(savedViews).length === 0) {
        list.innerHTML = '<div class="px-3 py-4 text-center"><p class="text-[10px] text-slate-500 italic">No saved views yet</p></div>';
        return;
    }

    let html = '';
    // Sort views so default is first
    const sortedNames = Object.keys(savedViews).sort((a, b) => (b === defaultView) - (a === defaultView));

    sortedNames.forEach(name => {
        const isDefault = defaultView === name;
        html += `
            <div class="group flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" onclick="applySavedView('${name.replace(/'/g, "\\'")}')">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="material-symbols-outlined text-[16px] ${isDefault ? 'text-amber-400' : 'text-slate-500'}">${isDefault ? 'star' : 'visibility'}</span>
                    <span class="text-xs ${isDefault ? 'text-white font-semibold' : 'text-slate-300'} truncate">${name}</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="event.stopPropagation(); setDefaultView('${name.replace(/'/g, "\\'")}')" class="p-1 hover:text-amber-400 text-slate-500 transition-colors" title="Set as default">
                        <span class="material-symbols-outlined text-[14px]">star</span>
                    </button>
                    <button onclick="event.stopPropagation(); deleteSavedView('${name.replace(/'/g, "\\'")}')" class="p-1 hover:text-red-400 text-slate-500 transition-colors" title="Delete view">
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
};

window.promptSaveView = function () {
    const name = prompt("Enter a name for this view:");
    if (!name) return;

    const savedViews = JSON.parse(localStorage.getItem('event_saved_views') || '{}');
    savedViews[name] = {
        tab: eventsState.tab,
        view: eventsState.view,
        year: eventsState.year,
        search: eventsState.search,
        visibleColumns: JSON.parse(JSON.stringify(eventsState.visibleColumns || {})),
        advanced: JSON.parse(JSON.stringify(eventsState.advanced || {}))
    };

    localStorage.setItem('event_saved_views', JSON.stringify(savedViews));
    renderSavedViewsList();
    showToast('Success', `View "${name}" saved!`);
};

window.applySavedView = function (name) {
    const savedViews = JSON.parse(localStorage.getItem('event_saved_views') || '{}');
    const view = savedViews[name];
    if (!view) return;

    // Apply state
    eventsState.tab = view.tab || 'Active';
    eventsState.view = view.view || 'table';
    eventsState.year = view.year || 'All';
    eventsState.search = view.search || '';
    if (view.visibleColumns) eventsState.visibleColumns = JSON.parse(JSON.stringify(view.visibleColumns));
    if (view.advanced) eventsState.advanced = JSON.parse(JSON.stringify(view.advanced));

    // Update UI elements
    const yearSelect = document.getElementById('events-year-filter');
    if (yearSelect) yearSelect.value = eventsState.year;

    const searchInput = document.getElementById('search-events');
    if (searchInput) searchInput.value = eventsState.search;

    const currentViewNameEl = document.getElementById('current-view-name');
    if (currentViewNameEl) currentViewNameEl.textContent = name;

    eventsState.currentView = name; // Track current view

    updateTabUI(); // Helper to update tab highlight
    updateEventsUI();
    renderAllEventsData();

    // Close dropdown
    const dropdown = document.getElementById('saved-views-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
};

function updateTabUI() {
    const tabs = ['Active', 'All', 'Future', 'Past', 'Archive'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-ev-${t}`);
        if (!el) return;
        const isMatch = (t === eventsState.tab || (t === 'Archive' && eventsState.tab === 'Archived'));
        if (isMatch) {
            el.className = "px-3 py-1.5 text-xs font-medium text-white bg-surface-hover border border-border-dark/60 shadow-sm rounded-lg transition-colors whitespace-nowrap";
        } else {
            el.className = "px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap";
        }
    });
}

window.deleteSavedView = function (name) {
    if (!confirm(`Are you sure you want to delete the view "${name}"?`)) return;

    const savedViews = JSON.parse(localStorage.getItem('event_saved_views') || '{}');
    delete savedViews[name];
    localStorage.setItem('event_saved_views', JSON.stringify(savedViews));

    if (localStorage.getItem('event_default_view') === name) {
        localStorage.removeItem('event_default_view');
        const currentViewNameEl = document.getElementById('current-view-name');
        if (currentViewNameEl) currentViewNameEl.textContent = 'Default View';
    }

    renderSavedViewsList();
};

window.setDefaultView = function (name) {
    localStorage.setItem('event_default_view', name);
    renderSavedViewsList();
    showToast('Default Set', `"${name}" is now your default view.`);
};

window.applyDefaultEventsView = function () {
    const defaultViewName = localStorage.getItem('event_default_view');
    if (defaultViewName) {
        applySavedView(defaultViewName);
    }
};

window.toggleEventsColumn = function (col) {
    if (eventsState.visibleColumns[col] !== undefined) {
        eventsState.visibleColumns[col] = !eventsState.visibleColumns[col];
        renderAllEventsData();
    }
};

window.toggleEventsSettings = function (e) {
    if (e) e.stopPropagation();
    const d = document.getElementById('events-settings-dropdown');
    if (d) d.classList.toggle('hidden');
};

window.setEventsSortColumn = function (col) {
    if (eventsState.sortColumn === col) {
        eventsState.sortDirection = eventsState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        eventsState.sortColumn = col;
        eventsState.sortDirection = 'asc';
    }
    renderAllEventsData();
};

window.setEventsColumnFilter = function (col, val) {
    eventsState.columnFilters[col] = val;
    renderAllEventsData();
};

// Handle clicks outside the dropdowns
document.addEventListener('click', (e) => {
    // Saved views dropdown
    const savedDropdown = document.getElementById('saved-views-dropdown');
    if (savedDropdown && !savedDropdown.classList.contains('hidden')) {
        const trigger = e.target.closest('button');
        const isTrigger = trigger && trigger.onclick && trigger.onclick.toString().includes('toggleSavedViewsDropdown');
        if (!isTrigger && !savedDropdown.contains(e.target)) {
            savedDropdown.classList.add('hidden');
        }
    }

    // Events settings dropdown
    const eventSettingsDropdown = document.getElementById('events-settings-dropdown');
    if (eventSettingsDropdown && !eventSettingsDropdown.classList.contains('hidden')) {
        if (!eventSettingsDropdown.contains(e.target) && !e.target.closest('button[onclick*="toggleEventsSettings"]')) {
            eventSettingsDropdown.classList.add('hidden');
        }
    }
});

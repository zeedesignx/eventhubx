/* ═══════════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE PEOPLE/SPEAKERS RENDERING
 * ═══════════════════════════════════════════════════════════════════════════
 * This file contains the comprehensive table-based rendering implementations
 * for People, Sessions, and Sponsors subpages following the Exhibitors pattern.
 *
 * To integrate: Replace lines 1619-1748 in subpages.js with the code below.
 * ═══════════════════════════════════════════════════════════════════════════ */

// PEOPLE/SPEAKERS RENDERING (replaces lines 1619-1664)
// ──────────────────────────────────────────────────────────────────────────────

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

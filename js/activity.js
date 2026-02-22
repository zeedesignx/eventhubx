/* ────────────────────────────────────────────────────────────
 * activity.js — Activity log loading and formatting
 * ──────────────────────────────────────────────────────────── */

async function logActivity(user, action, context) {
    const ts = new Date().toISOString();
    try {
        await window.supabaseClient.from('activity_logs').insert([{
            user_name: user,
            action: action,
            context: context,
            timestamp: ts
        }]);
        loadActivity(); // re-render
    } catch (e) { console.warn('logActivity failed:', e); }
}

async function loadActivity(pageContext = null) {
    try {
        const { data: records, error } = await window.supabaseClient
            .from('activity_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;
        const tbody = document.getElementById('activity-tbody');
        if (!tbody) return;

        // Map user_name from DB to expected user field in frontend
        let entries = (records || []).map(r => ({
            ...r,
            user: r.user_name
        }));

        const iconMap = {
            'login': { icon: 'login', color: 'text-primary', bg: 'bg-primary/10' },
            'link_created': { icon: 'link', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            'link_deleted': { icon: 'link_off', color: 'text-red-400', bg: 'bg-red-500/10' },
            'setting_changed': { icon: 'settings', color: 'text-amber-400', bg: 'bg-amber-500/10' },
            'sync_completed': { icon: 'sync', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            'export_downloaded': { icon: 'download', color: 'text-purple-400', bg: 'bg-purple-500/10' },
            'page_view': { icon: 'visibility', color: 'text-slate-400', bg: 'bg-slate-500/10' },
            'default': { icon: 'info', color: 'text-slate-400', bg: 'bg-slate-500/10' }
        };
        // If a page context was provided, filter the logs (fuzzy match)
        if (pageContext) {
            const term = pageContext.toLowerCase();
            entries = entries.filter(e => {
                const action = (e.action || '').toLowerCase();
                const ctx = (e.context || '').toLowerCase();
                // Special handling since pageId might be 'people' but log might say 'Person'
                if (term === 'people' || term === 'speakers') {
                    return action.includes('person') || action.includes('people') || action.includes('speaker') || ctx.includes('people');
                } else if (term === 'sessions') {
                    return action.includes('planning') || action.includes('session');
                } else if (term === 'events') {
                    return action.includes('event');
                }
                return action.includes(term) || ctx.includes(term) || action.includes('data synced') || action.includes('data updated');
            });
        }

        if (!entries.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500 text-sm">No activity found for this context.</td></tr>';
            return;
        }
        tbody.innerHTML = entries.slice(0, 50).map(e => {
            const initials = e.user.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            // Style the action block if it's "Data synced" vs "Data updated"
            let actionHtml = `<span class="text-slate-300">${e.action}</span>`;
            if (e.action.startsWith('Data updated')) {
                actionHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-semibold"><span class="material-symbols-outlined text-[14px]">update</span> ${e.action}</span>`;
            } else if (e.action.startsWith('Data synced')) {
                actionHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-semibold"><span class="material-symbols-outlined text-[14px]">cloud_done</span> ${e.action}</span>`;
            }

            return `
                    <tr class="hover:bg-white/5 transition-colors border-b border-border-dark/30">
                        <td class="p-4 text-white font-medium">
                            <div class="flex items-center gap-2">
                                <div class="size-6 rounded-full bg-surface-hover border border-border-dark/60 text-primary flex items-center justify-center text-[10px] font-bold shadow-inner">${initials}</div>
                                ${e.user}
                            </div>
                        </td>
                        <td class="p-4">${actionHtml}</td>
                        <td class="p-4 text-slate-400 text-xs uppercase tracking-wider font-semibold">${e.context}</td>
                        <td class="p-4 text-slate-500 text-right whitespace-nowrap font-mono text-[11px]">${formatTimestamp(e.timestamp)}</td>
                    </tr>`;
        }).join('');
    } catch (e) { console.warn('loadActivity failed:', e); }
}

let currentActivityContext = null;

function openActivityModal(pageId = null) {
    currentActivityContext = pageId;
    const backdrop = document.getElementById('activity-modal-backdrop');
    const modal = document.getElementById('activity-modal');
    if (!backdrop || !modal) return;

    const subtitle = document.getElementById('activity-modal-subtitle');
    const title = document.getElementById('activity-modal-title');
    if (title) {
        title.innerText = pageId ? `Activity in ${pageId.charAt(0).toUpperCase() + pageId.slice(1)}` : 'System Activity';
    }
    if (subtitle) {
        subtitle.innerText = pageId ? 'Recent changes relevant to this module' : 'Recent sync logs and system changes';
    }

    loadActivity(pageId);

    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('scale-95', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeActivityModal() {
    currentActivityContext = null;
    const backdrop = document.getElementById('activity-modal-backdrop');
    const modal = document.getElementById('activity-modal');
    if (!backdrop || !modal) return;

    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        backdrop.classList.remove('flex');
        backdrop.classList.add('hidden');
    }, 300);
}

function formatTimestamp(isoStr) {
    // Always show exact date+time, never relative
    try {
        const d = new Date(isoStr);
        return d.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(',', '');
    } catch { return isoStr; }
}
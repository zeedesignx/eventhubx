/* ────────────────────────────────────────────────────────────
 * sync.js — Swapcard / Airtable sync functions
 * ──────────────────────────────────────────────────────────── */

async function syncSwapcard() {
    // Show loading state/toast
    showToast('Sync Started', 'Triggering full Swapcard → Supabase refresh...');

    try {
        // 1. Trigger the actual backend sync
        const res = await fetch('/api/sync/manual', { method: 'POST' });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('Sync In Progress', 'Background sync started. Dashboard will refresh automatically when finished.');

            // 2. We wait a bit and then reload the frontend data
            // Since it's a background task, we might not get the new data immediately, 
            // but we can at least reload what's currently in Supabase.
            // Ideally we'd poll or use a websocket, but for now we'll just reload.
            setTimeout(async () => {
                // Snapshot previous event IDs per tab
                const prevIds = new Set(
                    Object.values(allEventsData).flat().map(e => e.id)
                );
                const prevTotal = prevIds.size;

                await loadEvents();

                const newIds = new Set(
                    Object.values(allEventsData).flat().map(e => e.id)
                );
                const newTotal = newIds.size;
                const added = [...newIds].filter(id => !prevIds.has(id)).length;
                const removed = [...prevIds].filter(id => !newIds.has(id)).length;
                const changed = added > 0 || removed > 0;
                const activeCount = (allEventsData['Active'] || []).length;

                const diffs = [];
                if (added) diffs.push({ icon: '✦', label: `${added} new`, cls: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' });
                if (removed) diffs.push({ icon: '−', label: `${removed} removed`, cls: 'border-red-500/30 text-red-400 bg-red-500/10' });
                if (!changed && prevTotal > 0) diffs.push({ icon: '✓', label: 'All events current', cls: 'border-slate-500/30 text-slate-400 bg-slate-500/10' });

                showSyncModal({
                    title: 'Swapcard Sync',
                    subtitle: changed ? 'New event data detected' : 'Data is up to date',
                    icon: 'sync',
                    iconBg: changed ? 'bg-primary' : 'bg-primary/50',
                    barColor: 'bg-primary',
                    stats: [
                        { label: 'Total Events', value: newTotal, color: 'text-white' },
                        { label: 'Active Now', value: activeCount, color: 'text-emerald-400' },
                        { label: 'New / Added', value: added, color: added ? 'text-emerald-400' : 'text-slate-500' },
                    ],
                    diffs
                });

                const changedText = changed ? `Data updated: ${newTotal} events (${added} new)` : `Data synced: ${newTotal} events unchanged`;
                await logActivity(currentUser ? currentUser.short_name : 'Zee', changedText, 'Swapcard API');
            }, 2000);
        } else {
            showToast('Sync Error', data.message || 'Failed to trigger sync.');
        }
    } catch (e) {
        console.error('[syncSwapcard] Error:', e);
        showToast('Network Error', 'Failed to connect to the backend server.');
    }
}

async function syncAirtable(silent = false) {
    const prevData = [...(typeof airtableData !== 'undefined' ? airtableData : [])]; // snapshot before
    try {
        const { data: records, error } = await window.supabaseClient.from('events').select('*');
        if (error) throw error;

        // Map Supabase columns to exactly what the frontend expected from Airtable JSON
        // The Supabase table columns: id, name, stage, project_lead, tech_stack, mockup_url, etc.
        airtableData = records || [];
        preloadTechLogos(); // Preload logos as soon as we have data

        if (!silent) {
            // Compute diff
            const prevNames = new Set(prevData.map(r => r.name));
            const newNames = new Set(airtableData.map(r => r.name));
            const added = [...newNames].filter(n => !prevNames.has(n)).length;
            const removed = [...prevNames].filter(n => !newNames.has(n)).length;
            const same = airtableData.length - added;
            const changed = prevData.length > 0 && (added > 0 || removed > 0);

            const diffs = [];
            if (added) diffs.push({ icon: '✦', label: `${added} new`, cls: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' });
            if (removed) diffs.push({ icon: '−', label: `${removed} removed`, cls: 'border-red-500/30 text-red-400 bg-red-500/10' });
            if (same > 0 && !changed) diffs.push({ icon: '✓', label: 'All records unchanged', cls: 'border-slate-500/30 text-slate-400 bg-slate-500/10' });

            showSyncModal({
                title: 'Airtable Sync Complete',
                subtitle: changed ? 'Data has been updated' : 'All records are current',
                icon: 'table_chart',
                iconBg: changed ? 'bg-indigo-600' : 'bg-indigo-500/50',
                barColor: 'bg-indigo-500',
                stats: [
                    { label: 'Total Records', value: airtableData.length, color: 'text-white' },
                    { label: 'New / Added', value: added, color: added ? 'text-emerald-400' : 'text-slate-500' },
                    { label: 'Removed', value: removed, color: removed ? 'text-red-400' : 'text-slate-500' },
                ],
                diffs
            });
            const changedText = changed ? `Data updated: ${airtableData.length} Airtable records (${added} new)` : `Data synced: ${airtableData.length} Airtable records unchanged`;
            await logActivity('Zee', changedText, 'Integration');
        }
    } catch (e) {
        console.error('Airtable Sync Error:', e);
        if (!silent) showSyncModal({ title: 'Airtable Sync Error', subtitle: 'Check console for details', icon: 'error', iconBg: 'bg-red-600', barColor: 'bg-red-500', stats: [], diffs: [] });
    }
}

async function syncSubpage(pageId) {
    // Use LEAP-only endpoint for exhibitors (testing mode)
    const endpoint = pageId === 'exhibitors' ? '/api/subpages/sync-leap' : '/api/subpages/sync';
    showToast('Sync Started', `Fetching newest ${pageId} data from Swapcard...`);
    try {
        const res = await fetch(endpoint, { method: 'POST' });
        const json = await res.json();
        if (json.status === 'success') {
            // Clear the in-memory cache so the next render fetches fresh data from Supabase
            window.eventSubpagesCache = {};
            // Re-render the current page to pull fresh data
            renderSubpageMocks(pageId);
            const detail = json.event_count ? `${json.event_count} events updated` : 'Data updated';
            showToast('Sync Success', `${pageId} sync complete — ${detail}.`);
            await logActivity(currentUser ? currentUser.short_name : 'System', `Data synced: latest ${pageId} module`, 'Swapcard API');
        } else {
            showToast('Sync Error', json.message || 'Failed to fetch new data.');
        }
    } catch (e) {
        console.error('[syncSubpage] Error:', e);
        showToast('Network Error', 'Check your connection to the backend.');
    }
}


function closeSyncModal() {
    clearTimeout(_syncModalTimer);
    clearInterval(_syncModalBarTimer);
    const modal = document.getElementById('sync-modal');
    modal.classList.remove('translate-x-0', 'opacity-100');
    modal.classList.add('translate-x-[120%]', 'opacity-0');
}
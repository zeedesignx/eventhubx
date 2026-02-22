/* ────────────────────────────────────────────────────────────
 * config.js — Tailwind config, global state constants
 * ──────────────────────────────────────────────────────────── */

// App-level constants and global state ─────────────────────
const subpagesConfig = [
    { id: 'events', title: 'Events', icon: 'event', desc: 'Browse and filter all events from the ecosystem.', btn: '' },
    { id: 'exhibitors', title: 'Exhibitors', icon: 'storefront', desc: 'Directory of exhibitors and their booth details.', btn: 'Add Exhibitor' },
    { id: 'people', title: 'People', icon: 'group', desc: 'Manage attendees, staff, and team members.', btn: 'Add Person' },
    { id: 'speakers', title: 'Speakers', icon: 'podium', desc: 'Roster of speakers and moderators.', btn: 'Add Speaker' },
    { id: 'sessions', title: 'Sessions', icon: 'calendar_today', desc: 'Agenda planning and scheduling.', btn: 'New Session' },
    { id: 'sponsors', title: 'Sponsors', icon: 'handshake', desc: 'Sponsorship packages and brand assets.', btn: 'Add Sponsor' }
];

// State strictly for the full page events table/grid
let eventsState = {
    tab: 'Active',
    view: 'table',
    year: 'All',
    search: '',
    sortColumn: 'name',
    sortDirection: 'asc',
    currentView: 'default', // Track current view
    visibleColumns: {
        // Core metrics (default visible)
        registrations: true,
        leads: true,
        exhibitors: true,
        speakers: true,
        sessions: true,
        // Leads breakdown (Swapcard analytics - default hidden)
        leadsViews: false,
        leadsBookmarks: false,
        leadsConnections: false,
        leadsScans: false,
        leadsContacts: false,
        leadsRequests: false,
        leadsMessages: false,
        leadsMeetings: false,
        // Additional data (default hidden)
        sponsors: false,
        members: false,
        status: false,
        community: false,
        startDate: false,
        endDate: false,
        duration: false,
        year: false,
        city: false,
        country: false,
        venue: false,
        timezone: false,
        eventId: false,
        createdAt: false,
        updatedAt: false
    },
    columnFilters: {
        registrations: '',
        leads: '',
        exhibitors: '',
        speakers: '',
        sessions: '',
        leadsViews: '',
        leadsBookmarks: '',
        leadsConnections: '',
        leadsScans: '',
        leadsContacts: '',
        leadsRequests: '',
        leadsMessages: '',
        leadsMeetings: '',
        sponsors: '',
        members: '',
        status: '',
        community: '',
        startDate: '',
        endDate: '',
        duration: '',
        year: '',
        city: '',
        country: '',
        venue: '',
        timezone: '',
        eventId: '',
        createdAt: '',
        updatedAt: ''
    },
    advanced: {
        community: 'All',
        minReg: 0,
        minExh: 0,
        minSess: 0,
        minSpk: 0
    }
};

// Saved views for events table
let eventsSavedViews = JSON.parse(localStorage.getItem('eventsSavedViews')) || {
    default: {
        name: 'Default View',
        visibleColumns: {
            registrations: true,
            leads: true,
            exhibitors: true,
            speakers: true,
            sessions: true,
            leadsViews: false,
            leadsBookmarks: false,
            leadsConnections: false,
            leadsScans: false,
            leadsContacts: false,
            leadsRequests: false,
            leadsMessages: false,
            leadsMeetings: false,
            sponsors: false,
            members: false,
            status: false,
            community: false,
            startDate: false,
            endDate: false,
            duration: false,
            year: false,
            city: false,
            country: false,
            venue: false,
            timezone: false,
            eventId: false,
            createdAt: false,
            updatedAt: false
        }
    }
};

let subpagesState = {
    exhibitors: { search: '' },
    people: { search: '' },
    speakers: { search: '' },
    sessions: { search: '' },
    sponsors: { search: '' }
};

// ── Shared Global Data ──────────────────────────────────────
window.allEventsData = {};
window.allSubpagesStats = {}; // Lightweight stats (counts)
window.eventSubpagesCache = {}; // Detailed data per event: { eventId: { exhibitors: [], people: [] } }
window.airtableData = [];
window.currentUser = null;
window.globalSelectedEventId = 'all';

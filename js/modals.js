/* ────────────────────────────────────────────────────────────
 * modals.js — New event / person / exhibitor modals
 * ──────────────────────────────────────────────────────────── */

function openNewEventModal() {
            const backdrop = document.getElementById('new-event-backdrop');
            const modal = document.getElementById('new-event-modal');
            backdrop.classList.remove('hidden');
            backdrop.classList.add('flex');

            // Reset fields
            document.getElementById('ne-title').value = '';
            document.getElementById('ne-start').value = '';
            document.getElementById('ne-end').value = '';
            document.getElementById('ne-location').value = '';
            document.getElementById('ne-error').classList.add('hidden');

            // Populate communities
            const select = document.getElementById('ne-community');
            select.innerHTML = '<option value="">Select a community...</option>';
            if (!allCommunities || allCommunities.length === 0) {
                fetchCommunities().then(() => {
                    allCommunities.forEach(c => select.innerHTML += `<option value="${c.name}">${c.name}</option>`);
                });
            } else {
                allCommunities.forEach(c => select.innerHTML += `<option value="${c.name}">${c.name}</option>`);
            }

            setTimeout(() => {
                modal.classList.remove('scale-95', 'opacity-0');
                modal.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

function closeNewEventModal() {
            const backdrop = document.getElementById('new-event-backdrop');
            const modal = document.getElementById('new-event-modal');

            // Animate Out
            modal.classList.remove('scale-100', 'opacity-100');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.classList.remove('flex');
                backdrop.classList.add('hidden');
            }, 300);
        }

function saveNewEvent() {
            const title = document.getElementById('ne-title').value.trim();
            const comm = document.getElementById('ne-community').value.trim();
            const err = document.getElementById('ne-error');
            err.classList.add('hidden');

            if (!title) { err.textContent = 'Event Title is required.'; err.classList.remove('hidden'); return; }
            if (!comm) { err.textContent = 'Please select a Community.'; err.classList.remove('hidden'); return; }

            const btn = document.getElementById('ne-save-btn');
            const spinner = document.getElementById('ne-save-spinner');
            const text = document.getElementById('ne-save-text');

            btn.disabled = true; spinner.classList.remove('hidden'); text.textContent = 'Creating...';

            // Mock Save Operation
            setTimeout(() => {
                btn.disabled = false; spinner.classList.add('hidden'); text.textContent = 'Create Event';
                closeNewEventModal();
                showToast('Success', 'Event created successfully!');
                logActivity(currentUser ? currentUser.short_name : 'User', `Created new event: ${title}`, 'Event Management');
                // You could also add this dummy event to allEventsData['Active'] and re-render the table
                const newId = 'EV' + Math.floor(Math.random() * 100000);
                if (!allEventsData['Active']) allEventsData['Active'] = [];
                allEventsData['Active'].unshift({
                    id: newId,
                    title: title,
                    community: { name: comm },
                    beginsAt: document.getElementById('ne-start').value,
                    endsAt: document.getElementById('ne-end').value,
                    address: { city: document.getElementById('ne-location').value },
                    totalExhibitors: 0,
                    totalSpeakers: 0,
                });
                renderAllEventsData();

                // If the user happens to have the Events grid viewed on dashboard, this syncs it there too immediately.
                if (typeof renderEvents === 'function') {
                    renderEvents();
                }
            }, 800);
        }

function openNewPersonModal() {
            const backdrop = document.getElementById('new-person-backdrop');
            const modal = document.getElementById('new-person-modal');
            backdrop.classList.remove('hidden');
            backdrop.classList.add('flex');

            document.getElementById('np-first').value = '';
            document.getElementById('np-last').value = '';
            document.getElementById('np-email').value = '';
            document.getElementById('np-job').value = '';
            document.getElementById('np-org').value = '';
            document.getElementById('np-error').classList.add('hidden');

            populateEventSelects('np-event');

            setTimeout(() => {
                modal.classList.remove('scale-95', 'opacity-0');
                modal.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

function closeNewPersonModal() {
            const backdrop = document.getElementById('new-person-backdrop');
            const modal = document.getElementById('new-person-modal');
            modal.classList.remove('scale-100', 'opacity-100');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.classList.remove('flex');
                backdrop.classList.add('hidden');
            }, 300);
        }

async function saveNewPerson() {
            const eventId = document.getElementById('np-event').value;
            const firstName = document.getElementById('np-first').value.trim();
            const lastName = document.getElementById('np-last').value.trim();
            const email = document.getElementById('np-email').value.trim();
            const jobTitle = document.getElementById('np-job').value.trim();
            const organization = document.getElementById('np-org').value.trim();
            const err = document.getElementById('np-error');
            err.classList.add('hidden');

            if (!eventId) { err.textContent = 'Please select a target Event.'; err.classList.remove('hidden'); return; }
            if (!firstName || !lastName) { err.textContent = 'First and Last name are required.'; err.classList.remove('hidden'); return; }

            const btn = document.getElementById('np-save-btn');
            const spinner = document.getElementById('np-save-spinner');
            const text = document.getElementById('np-save-text');

            btn.disabled = true; spinner.classList.remove('hidden'); text.textContent = 'Creating...';

            try {
                const res = await fetch('/api/person/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId, firstName, lastName, email, jobTitle, organization })
                });
                const responseData = await res.json();

                if (responseData.status === 'success') {
                    showToast('Success', 'Person created and linked to event!');
                    logActivity(currentUser ? currentUser.short_name : 'User', `Added person: ${firstName} ${lastName}`, 'People Management');
                    closeNewPersonModal();
                } else {
                    err.textContent = responseData.message || 'Error creating person.';
                    err.classList.remove('hidden');
                }
            } catch (e) {
                err.textContent = 'Backend connection error.';
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false; spinner.classList.add('hidden'); text.textContent = 'Create Person';
            }
        }

function openNewExhibitorModal() {
            const backdrop = document.getElementById('new-exhibitor-backdrop');
            const modal = document.getElementById('new-exhibitor-modal');
            backdrop.classList.remove('hidden');
            backdrop.classList.add('flex');

            document.getElementById('nx-name').value = '';
            document.getElementById('nx-desc').value = '';
            document.getElementById('nx-error').classList.add('hidden');

            populateEventSelects('nx-event');

            setTimeout(() => {
                modal.classList.remove('scale-95', 'opacity-0');
                modal.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

function closeNewExhibitorModal() {
            const backdrop = document.getElementById('new-exhibitor-backdrop');
            const modal = document.getElementById('new-exhibitor-modal');
            modal.classList.remove('scale-100', 'opacity-100');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.classList.remove('flex');
                backdrop.classList.add('hidden');
            }, 300);
        }

async function saveNewExhibitor() {
            const eventId = document.getElementById('nx-event').value;
            const name = document.getElementById('nx-name').value.trim();
            const description = document.getElementById('nx-desc').value.trim();
            const err = document.getElementById('nx-error');
            err.classList.add('hidden');

            if (!eventId) { err.textContent = 'Please select a target Event.'; err.classList.remove('hidden'); return; }
            if (!name) { err.textContent = 'Company Name is required.'; err.classList.remove('hidden'); return; }

            const btn = document.getElementById('nx-save-btn');
            const spinner = document.getElementById('nx-save-spinner');
            const text = document.getElementById('nx-save-text');

            btn.disabled = true; spinner.classList.remove('hidden'); text.textContent = 'Creating...';

            try {
                const res = await fetch('/api/exhibitor/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId, name, description })
                });
                const responseData = await res.json();

                if (responseData.status === 'success') {
                    showToast('Success', 'Exhibitor created successfully!');
                    logActivity(currentUser ? currentUser.short_name : 'User', `Added exhibitor: ${name}`, 'Exhibitor Management');
                    closeNewExhibitorModal();
                } else {
                    err.textContent = responseData.message || 'Error creating exhibitor.';
                    err.classList.remove('hidden');
                }
            } catch (e) {
                err.textContent = 'Backend connection error.';
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false; spinner.classList.add('hidden'); text.textContent = 'Create Exhibitor';
            }
        }
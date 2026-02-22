/* ────────────────────────────────────────────────────────────
 * auth.js — Login, logout, profile, password
 * ──────────────────────────────────────────────────────────── */

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    document.getElementById('login-btn-text').textContent = 'Signing in…';
    document.getElementById('login-spinner').classList.remove('hidden');
    document.getElementById('login-btn').disabled = true;

    try {
        // Fetch user from Supabase
        const { data: users, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .ilike('username', username)
            .limit(1);

        if (error) throw error;
        const user = users && users.length > 0 ? users[0] : null;

        // Validate (we'll hash the password using a simple SHA256 since that's what backend used)
        // Need a simple sha256 function here for frontend validation, or just call a small endpoint if we don't have crypto
        // Actually, the new implementation plan suggested either raw REST or using actual Supabase Auth. 
        // But the user accounts are in the custom 'users' table.

        // Let's rely on the backend login endpoint for strictly checking passwords since computing SHA-256 in JS requires async crypto subtle
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.status === 'success') {
            sessionStorage.setItem('swapcard_user', JSON.stringify(data.user));
            // NOTE: This function is only used by dashboard's hidden overlay (fallback)
            // Primary login happens on landing page which redirects to /dashboard
            applyUser(data.user);
            // Fade out login overlay
            const overlay = document.getElementById('login-overlay');
            if (overlay) {
                overlay.style.transition = 'opacity 0.4s ease';
                overlay.style.opacity = '0';
                setTimeout(() => overlay.classList.add('hidden'), 400);
            }
            await logActivity(data.user.short_name, 'Signed in to EventHubX', 'Authentication');
        } else {
            errEl.textContent = data.message || 'Login failed';
            errEl.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        errEl.textContent = 'Connection error. Is the server running?';
        errEl.classList.remove('hidden');
    }
    document.getElementById('login-btn-text').textContent = 'Sign In';
    document.getElementById('login-spinner').classList.add('hidden');
    document.getElementById('login-btn').disabled = false;
}

function logout() {
    sessionStorage.removeItem('swapcard_user');
    // Redirect to landing page for login
    window.location.href = '/';
}

function switchAccount() {
    // Switch account redirects to landing without requiring current password
    sessionStorage.removeItem('swapcard_user');
    window.location.href = '/';
}

function toggleUserMenu() {
    document.getElementById('user-menu').classList.toggle('hidden');
}

function openEditProfile() {
    if (!currentUser) return;
    document.getElementById('user-menu').classList.add('hidden');

    // Populate fields
    document.getElementById('ep-display-name').value = currentUser.display_name;
    document.getElementById('ep-username').value = currentUser.username;
    document.getElementById('ep-role').value = currentUser.role || '';

    // Populate short name if field exists
    const shortField = document.getElementById('ep-short-name');
    if (shortField) shortField.value = currentUser.short_name;

    // Reset UI
    document.getElementById('ep-avatar').textContent = currentUser.initials;
    document.getElementById('ep-subtitle').textContent = currentUser.role;
    document.getElementById('ep-error').classList.add('hidden');
    document.getElementById('ep-success').classList.add('hidden');
    document.getElementById('ep-current-password').value = ''; // Clear password field

    const backdrop = document.getElementById('edit-profile-backdrop');
    const modal = document.getElementById('edit-profile-modal');
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.remove('scale-95', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    });
}

function closeEditProfile() {
    const backdrop = document.getElementById('edit-profile-backdrop');
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('flex');
    }, 300);
}

async function saveProfile() {
    if (!currentUser) return;
    const btn = document.getElementById('ep-save-btn');
    const text = document.getElementById('ep-save-text');
    const spinner = document.getElementById('ep-save-spinner');
    const errEl = document.getElementById('ep-error');
    const succEl = document.getElementById('ep-success');

    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    const displayName = document.getElementById('ep-display-name').value.trim();
    const username = document.getElementById('ep-username').value.trim();
    const role = document.getElementById('ep-role').value.trim();
    const currentPassword = document.getElementById('ep-current-password').value;
    const shortName = document.getElementById('ep-short-name') ? document.getElementById('ep-short-name').value.trim() : "";

    if (!currentPassword) {
        errEl.textContent = 'Current password is required.';
        errEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    text.textContent = 'Saving...';
    spinner.classList.remove('hidden');

    try {
        const res = await fetch('/api/users/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                current_password: currentPassword,
                new_display_name: displayName,
                new_short_name: shortName,
                new_role: role,
                new_username: username
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = data.user;
            sessionStorage.setItem('swapcard_user', JSON.stringify(currentUser));
            applyUser(currentUser);
            succEl.textContent = 'Profile updated!';
            succEl.classList.remove('hidden');
            await logActivity(currentUser.short_name, 'Updated profile details', 'Security');
            setTimeout(() => closeEditProfile(), 1200);
        } else {
            errEl.textContent = data.message || 'Update failed';
            errEl.classList.remove('hidden');
        }
    } catch (err) {
        errEl.textContent = 'Connection error.';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        text.textContent = 'Save Details';
        spinner.classList.add('hidden');
    }
}

function openChangePassword() {
    if (!currentUser) return;
    document.getElementById('user-menu').classList.add('hidden');

    document.getElementById('cp-new-password').value = '';
    document.getElementById('cp-confirm-password').value = '';
    document.getElementById('cp-current-password').value = '';
    document.getElementById('cp-error').classList.add('hidden');
    document.getElementById('cp-success').classList.add('hidden');

    const backdrop = document.getElementById('change-password-backdrop');
    const modal = document.getElementById('change-password-modal');
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.remove('scale-95', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    });
    setTimeout(() => document.getElementById('cp-new-password').focus(), 300);
}

function closeChangePassword() {
    const backdrop = document.getElementById('change-password-backdrop');
    const modal = document.getElementById('change-password-modal');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('flex');
    }, 300);
}

async function savePassword() {
    if (!currentUser) return;
    const btn = document.getElementById('cp-save-btn');
    const text = document.getElementById('cp-save-text');
    const spinner = document.getElementById('cp-save-spinner');
    const errEl = document.getElementById('cp-error');
    const succEl = document.getElementById('cp-success');

    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    const newPw = document.getElementById('cp-new-password').value;
    const confirmPw = document.getElementById('cp-confirm-password').value;
    const currentPw = document.getElementById('cp-current-password').value;

    if (!newPw || newPw.length < 1) {
        errEl.textContent = 'Please enter a new password.';
        errEl.classList.remove('hidden');
        return;
    }
    if (newPw !== confirmPw) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
    }
    if (!currentPw) {
        errEl.textContent = 'Current password is required.';
        errEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    text.textContent = 'Updating...';
    spinner.classList.remove('hidden');

    try {
        const res = await fetch('/api/users/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                current_password: currentPw,
                new_password: newPw
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            succEl.textContent = 'Password changed successfully!';
            succEl.classList.remove('hidden');
            await logActivity(currentUser.short_name, 'Changed account password', 'Security');
            setTimeout(() => closeChangePassword(), 1500);
        } else {
            errEl.textContent = data.message || 'Update failed';
            errEl.classList.remove('hidden');
        }
    } catch (err) {
        errEl.textContent = 'Connection error.';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        text.textContent = 'Update Password';
        spinner.classList.add('hidden');
    }
}

function togglePwVis() {
    const inp = document.getElementById('login-password');
    const eye = document.getElementById('pw-eye');
    if (inp.type === 'password') { inp.type = 'text'; eye.textContent = 'visibility_off'; }
    else { inp.type = 'password'; eye.textContent = 'visibility'; }
}

function toggleEpPw(id, eyeId) {
    const inp = document.getElementById(id);
    const eye = document.getElementById(eyeId);
    if (inp.type === 'password') { inp.type = 'text'; eye.textContent = 'visibility_off'; }
    else { inp.type = 'password'; eye.textContent = 'visibility'; }
}
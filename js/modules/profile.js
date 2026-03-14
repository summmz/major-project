// === Profile Page Module ===
import * as state from './state.js';
import { showToast } from './ui.js';

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderProfilePage() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    if (!state.currentUser) {
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <p style="color:var(--text-muted);font-size:16px;margin-bottom:20px;">You need to be logged in to view your profile.</p>
                <button onclick="openLogin()" style="background:var(--accent);color:var(--bg-base);border:none;padding:12px 28px;border-radius:99px;font-family:var(--font-display);font-weight:700;font-size:14px;cursor:pointer;">Log In</button>
            </div>
        `;
        return;
    }

    const u = state.currentUser;
    const initial = (u.name || 'U').charAt(0).toUpperCase();
    const likedCount = state.likedSongs?.length || 0;
    const playlistCount = state.userPlaylists?.length || 0;

    let recentCount = 0;
    try { recentCount = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]').length; } catch {}

    const avatarContent = u.image
        ? `<img src="${u.image}" alt="Avatar" onerror="this.remove()">`
        : initial;

    container.innerHTML = `
        <!-- Hero -->
        <div class="profile-page-hero">
            <div class="profile-page-avatar-wrap">
                <div class="profile-page-avatar" id="profilePageAvatar">${avatarContent}</div>
                <div class="avatar-edit-overlay" onclick="document.getElementById('avatarFileInput').click()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <input type="file" id="avatarFileInput" accept="image/*" style="display:none" onchange="window.__handleAvatarChange(this)">
            </div>
            <div class="profile-page-info">
                <span class="profile-page-label">Profile</span>
                <h1 class="profile-page-name" id="profilePageName">${_esc(u.name || 'User')}</h1>
                <p class="profile-page-meta">
                    <span>${_esc(u.email || '')}</span>
                    ${u.googleId ? ' &bull; Google Account' : ''}
                </p>
            </div>
        </div>

        <!-- Stats -->
        <div class="profile-stats" style="margin-bottom:24px;">
            <div class="stat-card">
                <span class="stat-num">${likedCount}</span>
                <span class="stat-label">Liked Songs</span>
            </div>
            <div class="stat-card">
                <span class="stat-num">${playlistCount}</span>
                <span class="stat-label">Playlists</span>
            </div>
            <div class="stat-card">
                <span class="stat-num">${recentCount}</span>
                <span class="stat-label">Recently Played</span>
            </div>
        </div>

        <div class="profile-sections">

            <!-- Account Info -->
            <div class="profile-section">
                <div class="profile-section-header">
                    <h3>Account Info</h3>
                </div>
                <div class="profile-section-body">

                    <!-- Name -->
                    <div class="profile-field">
                        <span class="profile-field-label">Display Name</span>
                        <div class="profile-field-value">
                            <span id="displayNameValue">${_esc(u.name || '')}</span>
                            <button class="field-edit-btn" onclick="window.__toggleProfileEdit('nameEdit', this)">Edit</button>
                        </div>
                        <div class="profile-edit-form" id="nameEdit">
                            <input type="text" id="newNameInput" placeholder="Your display name" value="${_esc(u.name || '')}">
                            <div class="profile-edit-actions">
                                <button class="btn-save" onclick="window.__saveProfileName()">Save</button>
                                <button class="btn-cancel" onclick="window.__toggleProfileEdit('nameEdit')">Cancel</button>
                            </div>
                        </div>
                    </div>

                    <!-- Email -->
                    <div class="profile-field">
                        <span class="profile-field-label">Email Address</span>
                        <div class="profile-field-value">
                            <span id="emailValue">${_esc(u.email || '')}</span>
                            ${!u.googleId ? `<button class="field-edit-btn" onclick="window.__toggleProfileEdit('emailEdit', this)">Edit</button>` : `<span style="font-size:11px;color:var(--text-muted);background:var(--bg-overlay);padding:4px 10px;border-radius:99px;">Google</span>`}
                        </div>
                        ${!u.googleId ? `
                        <div class="profile-edit-form" id="emailEdit">
                            <input type="email" id="newEmailInput" placeholder="your@email.com" value="${_esc(u.email || '')}">
                            <div class="profile-edit-actions">
                                <button class="btn-save" onclick="window.__saveProfileEmail()">Save</button>
                                <button class="btn-cancel" onclick="window.__toggleProfileEdit('emailEdit')">Cancel</button>
                            </div>
                        </div>` : ''}
                    </div>

                    <!-- Account type -->
                    <div class="profile-field">
                        <span class="profile-field-label">Account Type</span>
                        <div class="profile-field-value">
                            <span>${u.googleId ? 'Google Account' : 'Email & Password'}</span>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Change Password (only for email accounts) -->
            ${!u.googleId ? `
            <div class="profile-section">
                <div class="profile-section-header">
                    <h3>Change Password</h3>
                </div>
                <div class="profile-section-body">
                    <div class="profile-field">
                        <div class="profile-field-value">
                            <span style="color:var(--text-muted);font-size:13px;">Update your account password</span>
                            <button class="field-edit-btn" onclick="window.__toggleProfileEdit('passwordEdit', this)">Change</button>
                        </div>
                        <div class="profile-edit-form" id="passwordEdit">
                            <input type="password" id="currentPasswordInput" placeholder="Current password">
                            <input type="password" id="newPasswordInput" placeholder="New password (min 6 chars)">
                            <input type="password" id="confirmPasswordInput" placeholder="Confirm new password">
                            <div class="profile-edit-actions">
                                <button class="btn-save" onclick="window.__saveNewPassword()">Update Password</button>
                                <button class="btn-cancel" onclick="window.__toggleProfileEdit('passwordEdit')">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Preferences -->
            <div class="profile-section">
                <div class="profile-section-header">
                    <h3>Preferences</h3>
                </div>
                <div class="profile-section-body">
                    <div class="profile-field">
                        <span class="profile-field-label">Crossfade</span>
                        <div class="profile-field-value" style="flex-direction:column;align-items:flex-start;gap:8px;">
                            <div style="display:flex;align-items:center;gap:12px;width:100%;">
                                <input type="range" id="crossfadeSlider" min="0" max="10" value="${state.crossfadeDuration}"
                                    style="flex:1;accent-color:var(--accent);"
                                    oninput="window.__updateCrossfade(this.value)">
                                <span id="crossfadeValue" style="font-size:13px;color:var(--accent);font-family:var(--font-display);font-weight:700;min-width:32px;">${state.crossfadeDuration}s</span>
                            </div>
                            <span style="font-size:12px;color:var(--text-muted);">Seconds of overlap between songs</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Danger Zone -->
            <div class="profile-section">
                <div class="profile-section-header">
                    <h3 style="color:#e22134;">Danger Zone</h3>
                </div>
                <div class="profile-section-body" style="display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Clear all locally stored data (liked songs, recently played, search history).</p>
                        <button class="profile-danger-btn" onclick="window.__clearLocalData()">Clear Local Data</button>
                    </div>
                    <div style="border-top:1px solid var(--border);padding-top:14px;">
                        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Permanently delete your account. This cannot be undone.</p>
                        <button class="profile-danger-btn" onclick="window.__deleteAccount()">Delete Account</button>
                    </div>
                </div>
            </div>

        </div>
    `;

    _bindHandlers();
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function _toggleEdit(formId, btn) {
    const form = document.getElementById(formId);
    if (!form) return;
    const isOpen = form.classList.contains('open');
    // Close all other open forms first
    document.querySelectorAll('.profile-edit-form.open').forEach(f => {
        f.classList.remove('open');
    });
    document.querySelectorAll('.field-edit-btn').forEach(b => {
        b.textContent = b.textContent === 'Cancel' ? 'Edit' : b.textContent;
        b.textContent = b.textContent === 'Cancel' ? 'Change' : b.textContent;
    });
    if (!isOpen) {
        form.classList.add('open');
        if (btn) btn.textContent = 'Cancel';
    }
}

async function _apiPatch(endpoint, body) {
    const token = state.authToken;
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(state.API_BASE + endpoint, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function _bindHandlers() {
    window.__toggleProfileEdit = _toggleEdit;

    window.__updateCrossfade = (val) => {
        state.setCrossfadeDuration(Number(val));
        const label = document.getElementById('crossfadeValue');
        if (label) label.textContent = val + 's';
        try { localStorage.setItem('crossfadeDuration', val); } catch {}
    };

    window.__saveProfileName = async () => {
        const newName = document.getElementById('newNameInput')?.value?.trim();
        if (!newName) { showToast('Name cannot be empty', 'error'); return; }

        try {
            await _apiPatch('/user/profile', { name: newName });
            state.setCurrentUser({ ...state.currentUser, name: newName });
            try { localStorage.setItem('currentUser', JSON.stringify(state.currentUser)); } catch {}

            // Update UI
            const nameEl = document.getElementById('displayNameValue');
            const heroEl = document.getElementById('profilePageName');
            const avatarEl = document.getElementById('userAvatar');
            if (nameEl) nameEl.textContent = newName;
            if (heroEl) heroEl.textContent = newName;
            if (avatarEl) avatarEl.textContent = newName.charAt(0).toUpperCase();

            const nameSpan = document.getElementById('userName');
            if (nameSpan) nameSpan.textContent = newName;

            _toggleEdit('nameEdit');
            showToast('Name updated!');
        } catch (e) {
            showToast(e.message || 'Failed to update name', 'error');
        }
    };

    window.__saveProfileEmail = async () => {
        const newEmail = document.getElementById('newEmailInput')?.value?.trim();
        if (!newEmail || !newEmail.includes('@')) { showToast('Enter a valid email', 'error'); return; }

        try {
            await _apiPatch('/user/profile', { email: newEmail });
            state.setCurrentUser({ ...state.currentUser, email: newEmail });
            try { localStorage.setItem('currentUser', JSON.stringify(state.currentUser)); } catch {}

            const emailEl = document.getElementById('emailValue');
            if (emailEl) emailEl.textContent = newEmail;

            _toggleEdit('emailEdit');
            showToast('Email updated!');
        } catch (e) {
            showToast(e.message || 'Failed to update email', 'error');
        }
    };

    window.__saveNewPassword = async () => {
        const current = document.getElementById('currentPasswordInput')?.value;
        const newPw   = document.getElementById('newPasswordInput')?.value;
        const confirm = document.getElementById('confirmPasswordInput')?.value;

        if (!current || !newPw || !confirm) { showToast('Please fill in all fields', 'error'); return; }
        if (newPw.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
        if (newPw !== confirm) { showToast('Passwords do not match', 'error'); return; }

        try {
            await _apiPatch('/user/profile', { currentPassword: current, newPassword: newPw });
            _toggleEdit('passwordEdit');
            // Clear the fields
            ['currentPasswordInput', 'newPasswordInput', 'confirmPasswordInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            showToast('Password updated!');
        } catch (e) {
            showToast(e.message || 'Failed to update password', 'error');
        }
    };

    window.__handleAvatarChange = (input) => {
        const file = input.files?.[0];
        if (!file) return;
        const maxMb = 2;
        if (file.size > maxMb * 1024 * 1024) {
            showToast(`Image must be under ${maxMb}MB`, 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            // Update avatar display immediately (optimistic)
            const avatarEl = document.getElementById('profilePageAvatar');
            if (avatarEl) avatarEl.innerHTML = `<img src="${dataUrl}" alt="Avatar">`;
            // Store locally; real upload would need a server endpoint
            state.setCurrentUser({ ...state.currentUser, image: dataUrl });
            try { localStorage.setItem('currentUser', JSON.stringify(state.currentUser)); } catch {}
            // Update header avatar
            const headerAvatar = document.getElementById('userAvatar');
            if (headerAvatar) headerAvatar.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            showToast('Avatar updated locally');
        };
        reader.readAsDataURL(file);
    };

    window.__clearLocalData = () => {
        if (!confirm('Clear all local data? This cannot be undone.')) return;
        ['likedSongs', 'recentlyPlayed', 'recentSearches', 'playbackState'].forEach(k => {
            try { localStorage.removeItem(k); } catch {}
        });
        state.setLikedSongs([]);
        state.setRecentlyPlayed([]);
        showToast('Local data cleared', 'info');
        renderProfilePage(); // refresh stats
    };

    window.__deleteAccount = async () => {
        if (!state.authToken) { showToast('Not logged in', 'error'); return; }
        const confirm1 = confirm('Delete your account? This permanently removes all your data and cannot be undone.');
        if (!confirm1) return;
        const confirm2 = confirm('Are you absolutely sure? Type "DELETE" in the next prompt to confirm.');
        if (!confirm2) return;
        const typed = window.prompt('Type DELETE to confirm:');
        if (typed !== 'DELETE') { showToast('Cancelled', 'info'); return; }

        try {
            const res = await fetch(state.API_BASE + '/user/account', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + state.authToken },
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Failed to delete account');
            }
            // Log out
            state.setAuthToken(null);
            state.setCurrentUser(null);
            state.setUserPlaylists([]);
            ['authToken', 'currentUser', 'likedSongs', 'recentlyPlayed'].forEach(k => {
                try { localStorage.removeItem(k); } catch {}
            });
            document.getElementById('authButtons').style.display = 'flex';
            document.getElementById('userProfile').style.display = 'none';
            window.navigate('#/');
            showToast('Account deleted', 'info');
        } catch (e) {
            showToast(e.message || 'Failed to delete account', 'error');
        }
    };
}

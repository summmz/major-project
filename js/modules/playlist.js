// === Playlist Module ===
import * as state from './state.js';
import { defaultPlaylists, playlistNames, playlistDescriptions, escapeHTML } from './data.js';
import { showToast } from './ui.js';

// Recently Played
// ─── Recently Played ────────────────────────────────────────────────────────
//
// Deduplication key: use sourceId for YouTube songs, url for local songs.
// YouTube songs always have url='' (stream URL is resolved at play time),
// so deduplicating by url would collapse all YT songs into one entry.

function rpKey(song) {
    if (song.sourceId) return song.source + ':' + song.sourceId;
    return 'url:' + (song.url || song.title); // local song fallback
}

export function addToRecentlyPlayed(song) {
    if (!song || (!song.title)) return;

    const key = rpKey(song);
    // Remove any existing entry for this song
    let rp = state.recentlyPlayed.filter(s => rpKey(s) !== key);

    // Push to front with full metadata snapshot
    rp.unshift({
        title:    song.title    || 'Unknown',
        artist:   song.artist   || 'Unknown Artist',
        image:    song.image    || '',
        sourceId: song.sourceId || '',
        source:   song.source   || 'youtube',
        duration: song.duration || 0,
        url:      song.url      || '',       // empty for YT — resolved at play time
    });

    if (rp.length > state.MAX_RECENT) rp = rp.slice(0, state.MAX_RECENT);
    state.setRecentlyPlayed(rp);

    // Save to localStorage immediately
    try { localStorage.setItem('recentlyPlayed', JSON.stringify(rp)); } catch(e) {}

    renderRecentlyPlayed();

    // Sync to cloud (fire-and-forget)
    if (state.authToken && song.sourceId && song.source) {
        fetch(state.API_BASE + '/user/recently-played', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + state.authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceId: song.sourceId,
                source:   song.source,
                title:    song.title,
                artist:   song.artist,
                image:    song.image,
                duration: song.duration || 0,
                url:      song.url || '',
            }),
        }).catch(e => console.error('Cloud recently-played sync error:', e));
    }
}

export function loadRecentlyPlayed() {
    try {
        const stored = localStorage.getItem('recentlyPlayed');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                state.setRecentlyPlayed(parsed);
            }
        }
    } catch(e) {}
    renderRecentlyPlayed();
}

// Called after cloud data is loaded — merge cloud history with local,
// keeping the most recent entry for each song and syncing back to localStorage.
export function mergeCloudRecentlyPlayed(cloudList) {
    if (!Array.isArray(cloudList) || cloudList.length === 0) return;

    const local = state.recentlyPlayed;
    const merged = [...local];
    const seenKeys = new Set(local.map(rpKey));

    for (const s of cloudList) {
        const k = rpKey(s);
        if (!seenKeys.has(k)) {
            seenKeys.add(k);
            merged.push({
                title:    s.title    || 'Unknown',
                artist:   s.artist   || 'Unknown Artist',
                image:    s.image    || '',
                sourceId: s.sourceId || '',
                source:   s.source   || 'youtube',
                duration: s.duration || 0,
                url:      s.url      || '',
            });
        }
    }

    // Keep most recent MAX_RECENT entries
    const final = merged.slice(0, state.MAX_RECENT);
    state.setRecentlyPlayed(final);
    try { localStorage.setItem('recentlyPlayed', JSON.stringify(final)); } catch(e) {}
    renderRecentlyPlayed();
}

export function renderRecentlyPlayed() {
    const section   = document.getElementById('recentlyPlayedSection');
    const container = document.getElementById('recentlyPlayedContainer');
    if (!section || !container) return;

    const songs = state.recentlyPlayed;
    if (!songs.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    container.innerHTML = songs.map((song, i) => `
        <div class="card" onclick="playRecentlyPlayed(${i})"
             oncontextmenu="showContextMenu(event, window.__recentlyPlayed[${i}])">
            <div class="img-container">
                <img src="${encodeURI(song.image || 'img/home.svg')}"
                     alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
            </div>
            <h2>${escapeHTML(song.title)}</h2>
            <p>${escapeHTML(song.artist)}</p>
        </div>
    `).join('');
}

// Queue
export function toggleQueue() {
    state.setIsQueueOpen(!state.isQueueOpen);
    document.getElementById('queuePanel').classList.toggle('open', state.isQueueOpen);
    document.getElementById('queueToggleBtn').classList.toggle('active', state.isQueueOpen);
    if (state.isQueueOpen) renderQueue();
}

export function addToQueue(song) {
    state.songQueue.push(song);
    showToast(`"${song.title}" added to queue`);
    renderQueue();
}

export function removeFromQueue(index) {
    state.songQueue.splice(index, 1);
    renderQueue();
}

export function renderQueue() {
    const nowPlaying = document.getElementById('queueNowPlaying');
    const nextUp = document.getElementById('queueNextUp');
    if (!nowPlaying || !nextUp) return;

    if (state.currentSong) {
        nowPlaying.innerHTML = `<div class="queue-item">
            <img src="${encodeURI(state.currentSong.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
            <div class="queue-song-info"><h5>${escapeHTML(state.currentSong.title)}</h5><p>${escapeHTML(state.currentSong.artist)}</p></div></div>`;
    } else {
        nowPlaying.innerHTML = '<p style="color:#a7a7a7;font-size:13px;">Nothing playing</p>';
    }

    if (state.songQueue.length === 0) {
        let upcoming = '';
        if (state.currentPlaylist.length > 0) {
            for (let i = 1; i <= Math.min(5, state.currentPlaylist.length - 1); i++) {
                const idx = (state.currentIndex + i) % state.currentPlaylist.length;
                const s = state.currentPlaylist[idx];
                upcoming += `<div class="queue-item" onclick="playSong(${idx})">
                    <img src="${encodeURI(s.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
                    <div class="queue-song-info"><h5>${escapeHTML(s.title)}</h5><p>${escapeHTML(s.artist)}</p></div></div>`;
            }
        }
        nextUp.innerHTML = upcoming || '<p style="color:#a7a7a7;font-size:13px;">Queue is empty</p>';
    } else {
        nextUp.innerHTML = state.songQueue.map((s, i) => `<div class="queue-item">
            <img src="${encodeURI(s.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
            <div class="queue-song-info"><h5>${escapeHTML(s.title)}</h5><p>${escapeHTML(s.artist)}</p></div>
            <button class="queue-remove" onclick="removeFromQueue(${i})">&times;</button></div>`).join('');
    }
}

// Load playlist content with sort/filter toolbar
export function loadPlaylistContent(playlistId) {
    // Check for local playlist
    let playlist;
    if (typeof playlistId === 'string' && playlistId.startsWith('local_')) {
        const localId = playlistId.replace('local_', '');
        try {
            const localPlaylists = JSON.parse(localStorage.getItem('localPlaylists') || '[]');
            const localPl = localPlaylists.find(p => p.id === localId);
            if (localPl) {
                playlist = localPl;
            }
        } catch (e) {}
    }
    if (!playlist) {
        playlist = state.userPlaylists.find(p => p.id == playlistId) || defaultPlaylists[playlistId];
    }
    const playlistTitle = document.getElementById('playlistTitle');
    const playlistContent = document.getElementById('playlistContent');

    showSkeletons('playlistContent', 4);
    setTimeout(() => hideSkeletons('playlistContent'), 200);

    if (playlist) {
        if (playlist.name) {
            // User playlist
            playlistTitle.textContent = playlist.name;

            const isLocalPlaylist = playlist.isLocal;
            const playFn = isLocalPlaylist ? 'playLocalPlaylist' : 'playUserPlaylist';
            const plId = isLocalPlaylist ? `'${playlist.id}'` : playlist.id;

            // Build delete/rename callbacks for the page header buttons
            const _deleteFn = isLocalPlaylist
                ? `window.__modules.playlist.deleteLocalPlaylist('${playlist.id}', '${escapeHTML(playlist.name)}')`
                : `window.__modules.playlist.deleteCloudPlaylist('${playlist._id || playlist.id}', '${escapeHTML(playlist.name)}')`;
            const _renameFn = isLocalPlaylist
                ? `window.__modules.playlist.renameLocalPlaylist('${playlist.id}', '${escapeHTML(playlist.name)}')`
                : `window.__modules.playlist.renameCloudPlaylist('${playlist._id || playlist.id}', '${escapeHTML(playlist.name)}')`;

            let contentHTML = `
                <div class="playlist-header" style="margin-bottom: 30px;">
                    <p style="color: #a7a7a7; margin-bottom: 10px;">${escapeHTML(playlist.description || 'Custom playlist')}</p>
                    <p style="color: #a7a7a7;">${playlist.songs.length} songs</p>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap;">
                        ${playlist.songs.length > 0 ? `<button onclick="${playFn}(0, ${plId})" style="background-color:#1db954;border:none;padding:12px 24px;border-radius:20px;color:black;font-weight:bold;cursor:pointer;">▶ Play All</button>` : ''}
                        <button onclick="${_renameFn}" style="background:none;border:1px solid #535353;padding:10px 18px;border-radius:20px;color:#fff;cursor:pointer;font-size:13px;">✏️ Rename</button>
                        <button onclick="${_deleteFn}" style="background:none;border:1px solid #e22134;padding:10px 18px;border-radius:20px;color:#e22134;cursor:pointer;font-size:13px;">🗑 Delete Playlist</button>
                    </div>
                </div>
            `;

            if (playlist.songs.length > 0) {
                contentHTML += '<div class="cardContainer">';
                playlist.songs.forEach((song, index) => {
                    const songTitle = escapeHTML(song.title || 'Unknown Title');
                    const songArtist = escapeHTML(song.artist || 'Unknown Artist');
                    const songImage = encodeURI(song.image || 'img/home.svg');

                    contentHTML += `
                        <div class="card" draggable="true" onclick="${playFn}(${index}, ${plId})" data-song-url="${encodeURI(song.url || '')}">
                            <div class="img-container">
                                <img src="${songImage}" alt="${songTitle}" onerror="this.src='img/home.svg'">
                                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
                            </div>
                            <h2>${songTitle}</h2>
                            <p>${songArtist}</p>
                            ${song.isLocal ? '<small style="color: #1db954;">Local File</small>' : (song.isUploaded ? '<small style="color: #1db954;">Uploaded File</small>' : '')}
                        </div>
                    `;
                });
                contentHTML += '</div>';
            } else {
                contentHTML += '<p style="color: #a7a7a7;">No songs in this playlist yet. Use the "Add Song" button to add music!</p>';
            }

            playlistContent.innerHTML = contentHTML;
        } else {
            // Default playlist
            const pName = playlistNames[playlistId] || "Playlist";
            const pDesc = playlistDescriptions[playlistId] || "";
            playlistTitle.textContent = pName;

            const totalDur = playlist.reduce((sum, s) => sum + (s.duration || 0), 0);
            const totalMin = Math.floor(totalDur / 60);
            const coverImg = playlist[0] ? playlist[0].image : 'img/home.svg';

            // Sort/filter toolbar
            let contentHTML = `
                <div class="playlist-hero">
                    <img class="playlist-hero-img" src="${coverImg}" alt="${escapeHTML(pName)}" onerror="this.src='img/home.svg'">
                    <div class="playlist-hero-info">
                        <span class="playlist-hero-label">PLAYLIST</span>
                        <h1 class="playlist-hero-title">${escapeHTML(pName)}</h1>
                        <p class="playlist-hero-desc">${escapeHTML(pDesc)}</p>
                        <div class="playlist-hero-owner">
                            <div class="playlist-hero-avatar">S</div>
                            <span class="playlist-hero-owner-name">Spotify</span>
                        </div>
                        <p class="playlist-hero-meta">${playlist.length} songs &bull; ${totalMin} min</p>
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="playlist-play-btn" onclick="playPlaylist('${playlistId}')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="black"><polygon points="6,3 20,12 6,21"/></svg>
                    </button>
                    <button class="playlist-shuffle-btn" onclick="playPlaylistShuffled('${playlistId}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 3.5A.5.5 0 0 1 .5 3H1c2.202 0 3.827 1.24 4.874 2.418.49.552.865 1.102 1.126 1.532.26-.43.636-.98 1.126-1.532C9.173 4.24 10.798 3 13 3v1c-1.798 0-3.173 1.01-4.126 2.082A9.624 9.624 0 0 0 7.556 8a9.624 9.624 0 0 0 1.317 1.918C9.828 10.99 11.204 12 13 12v1c-2.202 0-3.827-1.24-4.874-2.418A10.595 10.595 0 0 1 7 9.05c-.26.43-.636.98-1.126 1.532C4.827 11.76 3.202 13 1 13H.5a.5.5 0 0 1 0-1H1c1.798 0 3.173-1.01 4.126-2.082A9.624 9.624 0 0 0 6.444 8a9.624 9.624 0 0 0-1.317-1.918C4.172 5.01 2.796 4 1 4H.5a.5.5 0 0 1-.5-.5z"/><path d="M13 5.466V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192zm0 9v-3.932a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192z"/></svg>
                        Shuffle
                    </button>
                </div>
                <div class="playlist-toolbar">
                    <input type="text" class="playlist-filter-input" placeholder="Filter songs..." oninput="filterPlaylistSongs(this.value, '${playlistId}')">
                    <select class="playlist-sort-select" onchange="sortPlaylistSongs(this.value, '${playlistId}')">
                        <option value="default">Default</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="artist-asc">Artist A-Z</option>
                        <option value="artist-desc">Artist Z-A</option>
                        <option value="duration-asc">Duration (Short)</option>
                        <option value="duration-desc">Duration (Long)</option>
                    </select>
                </div>
                <div class="playlist-tracklist" id="playlistTracklist">
            `;

            // Store original order for default sort
            window.__playlistOriginal = [...playlist];
            window.__currentPlaylistId = playlistId;

            playlist.forEach((song, index) => {
                const mins = Math.floor((song.duration || 0) / 60);
                const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
                contentHTML += `
                    <div class="track-row" onclick="playSong(${index}, '${playlistId}')" oncontextmenu="showContextMenu(event, window.__defaultPlaylists['${playlistId}'][${index}])" data-song-url="${encodeURI(song.url)}" data-title="${escapeHTML(song.title)}" data-artist="${escapeHTML(song.artist)}">
                        <span class="track-num">${index + 1}</span>
                        <img class="track-img" src="${song.image}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                        <div class="track-info">
                            <span class="track-title">${escapeHTML(song.title)}</span>
                            <span class="track-artist">${escapeHTML(song.artist)}</span>
                        </div>
                        <span class="track-duration">${mins}:${secs}</span>
                    </div>
                `;
            });
            contentHTML += '</div>';
            playlistContent.innerHTML = contentHTML;

            // Restore sort preference
            const savedSort = localStorage.getItem('playlistSort');
            if (savedSort && savedSort !== 'default') {
                const selectEl = playlistContent.querySelector('.playlist-sort-select');
                if (selectEl) {
                    selectEl.value = savedSort;
                    sortPlaylistSongs(savedSort, playlistId);
                }
            }
        }
    }
}

// Sort playlist songs
export function sortPlaylistSongs(sortKey, playlistId) {
    const tracklist = document.getElementById('playlistTracklist');
    if (!tracklist) return;

    const rows = Array.from(tracklist.querySelectorAll('.track-row'));
    const playlist = defaultPlaylists[playlistId];
    if (!playlist) return;

    let sorted;
    if (sortKey === 'default') {
        sorted = window.__playlistOriginal || playlist;
    } else {
        sorted = [...playlist];
        switch (sortKey) {
            case 'title-asc': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'title-desc': sorted.sort((a, b) => b.title.localeCompare(a.title)); break;
            case 'artist-asc': sorted.sort((a, b) => a.artist.localeCompare(b.artist)); break;
            case 'artist-desc': sorted.sort((a, b) => b.artist.localeCompare(a.artist)); break;
            case 'duration-asc': sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0)); break;
            case 'duration-desc': sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0)); break;
        }
    }

    // Re-render tracklist
    let html = '';
    sorted.forEach((song, index) => {
        const origIndex = playlist.indexOf(song);
        const mins = Math.floor((song.duration || 0) / 60);
        const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
        html += `
            <div class="track-row" onclick="playSong(${origIndex}, '${playlistId}')" oncontextmenu="showContextMenu(event, window.__defaultPlaylists['${playlistId}'][${origIndex}])" data-song-url="${encodeURI(song.url)}" data-title="${escapeHTML(song.title)}" data-artist="${escapeHTML(song.artist)}">
                <span class="track-num">${index + 1}</span>
                <img class="track-img" src="${song.image}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                <div class="track-info">
                    <span class="track-title">${escapeHTML(song.title)}</span>
                    <span class="track-artist">${escapeHTML(song.artist)}</span>
                </div>
                <span class="track-duration">${mins}:${secs}</span>
            </div>
        `;
    });
    tracklist.innerHTML = html;

    try { localStorage.setItem('playlistSort', sortKey); } catch(e) {}
}

// Filter playlist songs
export function filterPlaylistSongs(query) {
    const tracklist = document.getElementById('playlistTracklist');
    if (!tracklist) return;
    const rows = tracklist.querySelectorAll('.track-row');
    const q = query.toLowerCase();

    rows.forEach(row => {
        const title = (row.dataset.title || '').toLowerCase();
        const artist = (row.dataset.artist || '').toLowerCase();
        if (!q || title.includes(q) || artist.includes(q)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Liked songs view
export function showLikedSongs() {
    if (state.likedSongs.length === 0) {
        showToast('No liked songs yet. Click the heart to like a song!', 'info');
        return;
    }
    state.setCurrentPlaylist(state.likedSongs.map(s => ({...s})));

    // Use navigation if available
    if (window.navigate) {
        // Set page without re-triggering navigate
        setActivePageDirect('playlistPage');
    } else {
        document.querySelectorAll('.content-page').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
        const target = document.getElementById('playlistPage');
        target.style.display = 'block';
        requestAnimationFrame(() => { requestAnimationFrame(() => { target.classList.add('active'); }); });
    }

    document.getElementById('playlistTitle').textContent = 'Liked Songs';
    const content = document.getElementById('playlistContent');
    let html = `<div class="playlist-header" style="margin-bottom:30px;"><p style="color:#a7a7a7;">${state.likedSongs.length} songs</p>
        <button onclick="playPlaylistFromLiked()" style="background-color:#1db954;border:none;padding:6px 12px;border-radius:10px;color:black;font-weight:bold;margin-top:10px;cursor:pointer;">Play All</button></div><div class="cardContainer">`;
    state.likedSongs.forEach((song, i) => {
        html += `<div class="card" onclick="playFromLiked(${i})" oncontextmenu="showContextMenu(event, window.__likedSongs[${i}])" data-song-url="${encodeURI(song.url)}">
            <div class="img-container">
                <img src="${encodeURI(song.image || 'img/home.svg')}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
            </div>
            <h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.artist)}</p></div>`;
    });
    html += '</div>';
    content.innerHTML = html;
}

function setActivePageDirect(pageId) {
    const pages = document.querySelectorAll('.content-page');
    const target = document.getElementById(pageId);
    pages.forEach(page => {
        if (page !== target) {
            page.classList.remove('active');
            page.style.display = 'none';
        }
    });
    target.style.display = 'block';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    });
}

// User playlists
export function loadUserPlaylists() {
    const playlistList = document.getElementById('playlistList');
    playlistList.innerHTML = '';

    // Load local playlists
    try {
        const localPlaylists = JSON.parse(localStorage.getItem('localPlaylists') || '[]');
        localPlaylists.forEach(playlist => {
            const item = _makePlaylistItem(
                playlist.name,
                (playlist.songs?.length || 0) + ' songs',
                () => window.showPlaylistPage('local_' + playlist.id),
                () => deleteLocalPlaylist(playlist.id, playlist.name),
                () => renameLocalPlaylist(playlist.id, playlist.name)
            );
            playlistList.appendChild(item);
        });
    } catch (e) {}

    // Load cloud playlists
    state.userPlaylists.forEach(playlist => {
        const playlistId = playlist._id || playlist.id;
        const item = _makePlaylistItem(
            playlist.name,
            (playlist.songs?.length || 0) + ' songs',
            () => window.showPlaylistPage(playlistId),
            () => deleteCloudPlaylist(playlistId, playlist.name),
            () => renameCloudPlaylist(playlistId, playlist.name)
        );
        playlistList.appendChild(item);
    });

    // Refresh mobile library page if it's currently active
    const mlPage = document.getElementById('mobileLibraryPage');
    if (mlPage && mlPage.classList.contains('active') && window.__modules?.navigation?.showMobileLibrary) {
        window.__modules.navigation.showMobileLibrary();
    }
}

export function getUserPlaylists() {
    return state.userPlaylists || [];
}

// Build a sidebar playlist row with hover-revealed action buttons
function _makePlaylistItem(name, meta, onOpen, onDelete, onRename) {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
        <div class="playlist-item-info">
            <h4>${escapeHTML(name)}</h4>
            <p>${escapeHTML(meta)}</p>
        </div>
        <div class="playlist-item-actions">
            <button class="pl-action-btn pl-rename-btn" title="Rename">✏️</button>
            <button class="pl-action-btn pl-delete-btn" title="Delete">🗑</button>
        </div>
    `;

    // Click on info area → open playlist
    item.querySelector('.playlist-item-info').addEventListener('click', onOpen);

    // Rename button
    item.querySelector('.pl-rename-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onRename();
    });

    // Delete button
    item.querySelector('.pl-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete();
    });

    return item;
}

// ─── Delete playlist ──────────────────────────────────────────────────────────

export async function deleteCloudPlaylist(playlistId, name) {
    if (!confirm(`Delete playlist "${name}"? This cannot be undone.`)) return;

    if (!state.authToken) {
        showToast('You must be logged in to delete playlists', 'error');
        return;
    }

    try {
        const res = await fetch(`${state.API_BASE}/user/playlists/${playlistId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.authToken },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Failed to delete playlist', 'error');
            return;
        }

        // Remove from local state
        state.setUserPlaylists(state.userPlaylists.filter(
            p => (p._id || p.id) != playlistId
        ));

        loadUserPlaylists();
        showToast(`"${name}" deleted`);

        // If we're currently viewing this playlist, go back home
        if (window.location.hash.includes(playlistId)) {
            window.navigate('#/');
        }
    } catch (e) {
        console.error('Delete playlist error:', e);
        showToast('Failed to delete playlist', 'error');
    }
}

export function deleteLocalPlaylist(localId, name) {
    if (!confirm(`Delete playlist "${name}"? This cannot be undone.`)) return;

    try {
        const playlists = JSON.parse(localStorage.getItem('localPlaylists') || '[]');
        const updated = playlists.filter(p => p.id !== localId);
        localStorage.setItem('localPlaylists', JSON.stringify(updated));
        loadUserPlaylists();
        showToast(`"${name}" deleted`);

        if (window.location.hash.includes('local_' + localId)) {
            window.navigate('#/');
        }
    } catch (e) {
        showToast('Failed to delete playlist', 'error');
    }
}

// ─── Rename playlist ──────────────────────────────────────────────────────────

export async function renameCloudPlaylist(playlistId, currentName) {
    const newName = prompt('Rename playlist:', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
        const res = await fetch(`${state.API_BASE}/user/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + state.authToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: newName.trim() }),
        });

        if (!res.ok) {
            showToast('Failed to rename playlist', 'error');
            return;
        }

        const data = await res.json();
        const idx = state.userPlaylists.findIndex(p => (p._id || p.id) == playlistId);
        if (idx !== -1 && data.playlist) state.userPlaylists[idx] = data.playlist;

        loadUserPlaylists();
        showToast(`Renamed to "${newName.trim()}"`);
    } catch (e) {
        showToast('Failed to rename playlist', 'error');
    }
}

export function renameLocalPlaylist(localId, currentName) {
    const newName = prompt('Rename playlist:', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
        const playlists = JSON.parse(localStorage.getItem('localPlaylists') || '[]');
        const pl = playlists.find(p => p.id === localId);
        if (pl) pl.name = newName.trim();
        localStorage.setItem('localPlaylists', JSON.stringify(playlists));
        loadUserPlaylists();
        showToast(`Renamed to "${newName.trim()}"`);
    } catch (e) {
        showToast('Failed to rename playlist', 'error');
    }
}

// Skeleton loading
export function showSkeletons(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>';
    }
    container.insertAdjacentHTML('afterbegin', '<div class="skeleton-wrap" style="display:flex;gap:20px;flex-wrap:wrap;">' + html + '</div>');
}

export function hideSkeletons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const wrap = container.querySelector('.skeleton-wrap');
    if (wrap) wrap.remove();
}

// Playlist reorder (drag & drop for user playlists)
export function initPlaylistReorder(container, playlistId) {
    const cards = container.querySelectorAll('.card[draggable="true"]');
    cards.forEach((card, index) => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            card.classList.add('dragging-card');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging-card'));
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            if (fromIndex === toIndex) return;
            const playlist = state.userPlaylists.find(p => p.id == playlistId);
            if (playlist) {
                const [moved] = playlist.songs.splice(fromIndex, 1);
                playlist.songs.splice(toIndex, 0, moved);
                loadPlaylistContent(playlistId);
                showToast('Playlist reordered');
            }
        });
    });
}

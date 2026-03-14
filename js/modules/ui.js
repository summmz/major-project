// === UI Module — Toasts, Modals, Context Menu, Keyboard Shortcuts, Mobile Gestures ===
import * as state from './state.js';
import { defaultPlaylists, escapeHTML } from './data.js';

// Player and playlist functions are accessed via window.__modules to avoid circular imports

// Toast notifications
export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Modal
export function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Profile Menu
export function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.classList.toggle('active');
}

// Global click handler to close menus
document.addEventListener('click', (e) => {
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    if (profileMenu && profileMenu.classList.contains('active')) {
        if (profileBtn && !profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    }
    
    // Also handle context menu hide
    const menu = document.getElementById('contextMenu');
    if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target)) {
            hideContextMenu();
        }
    }
});

// Context menu
export function showContextMenu(event, song) {
    event.preventDefault();
    event.stopPropagation();
    if (!song) return;
    state.setContextMenuSong(song);
    populatePlaylistSubmenu(song);

    const menu = document.getElementById('contextMenu');
    menu.style.overflow = 'visible';
    menu.style.display  = 'block';
    const menuW = 220, menuH = 300;
    menu.style.left = Math.min(event.clientX, window.innerWidth  - menuW) + 'px';
    menu.style.top  = Math.min(event.clientY, window.innerHeight - menuH) + 'px';

    // Touch devices don't fire :hover — wire up tap-to-toggle for the submenu parent
    const parent = document.getElementById('contextAddToPlaylist');
    if (parent) {
        // Remove previous listener to avoid stacking
        parent.ontouchend = (e) => {
            e.preventDefault();
            e.stopPropagation();
            parent.classList.toggle('submenu-open');
        };
    }
}

function populatePlaylistSubmenu(song) {
    const submenu = document.getElementById('contextPlaylistSubmenu');
    const parent  = document.getElementById('contextAddToPlaylist');
    if (!submenu) return;

    if (!state.currentUser || !state.authToken) {
        if (parent) parent.style.display = 'none';
        return;
    }
    if (parent) parent.style.display = '';

    const playlists = state.userPlaylists || [];

    if (!playlists.length) {
        submenu.innerHTML = '<div class="context-submenu-item disabled">No playlists yet</div>';
    } else {
        submenu.innerHTML = playlists.map((pl, i) =>
            `<div class="context-submenu-item" data-pl-idx="${i}">${escapeHTML(pl.name || 'Untitled')}</div>`
        ).join('');
    }

    // Position the fixed submenu flush with the parent item's right edge.
    // Must be done after innerHTML set so the submenu has layout dimensions.
    // We use a mouseenter on the parent to (re)calculate each time it's shown.
    parent.onmouseenter = () => {
        const rect = parent.getBoundingClientRect();
        const subW = 200;
        const subH = Math.min(playlists.length * 42 + 8, 280);
        // Prefer right side; fall back to left if it overflows
        const leftPos = (rect.right + subW <= window.innerWidth) ? rect.right : rect.left - subW;
        // Prefer same top; nudge up if it overflows bottom
        const topPos  = Math.min(rect.top, window.innerHeight - subH);
        submenu.style.left = leftPos + 'px';
        submenu.style.top  = topPos  + 'px';
    };

    // Replace onclick each time — capture song NOW before hide nulls state
    submenu.onclick = (e) => {
        e.stopPropagation();
        const item = e.target.closest('[data-pl-idx]');
        if (!item) return;
        const pl = playlists[parseInt(item.dataset.plIdx, 10)];
        if (!pl || !song) return;
        const capturedSong = song;
        hideContextMenu();
        addSongToPlaylist(pl, capturedSong);
    };
}

async function addSongToPlaylist(playlist, song) {
    const toast = (msg, type = 'success') => showToast(msg, type);

    const songPayload = {
        sourceId: song.sourceId || song.id || '',
        source:   song.source   || 'youtube',
        title:    song.title    || 'Unknown',
        artist:   song.artist   || 'Unknown Artist',
        image:    song.image    || '',
        duration: song.duration || 0,
        url:      song.url      || '',
    };

    if (!songPayload.sourceId) {
        toast('Cannot add this song — missing ID', 'error');
        return;
    }

    try {
        const playlistId = playlist._id || playlist.id;
        const res = await fetch(state.API_BASE + '/user/playlists/' + playlistId, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + state.authToken,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ addSong: songPayload }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast(err.error || 'Failed to add song', 'error');
            return;
        }

        const data = await res.json();

        // Sync local playlist state immediately
        const idx = state.userPlaylists.findIndex(p => (p._id || p.id) == playlistId);
        if (idx !== -1 && data.playlist) {
            state.userPlaylists[idx] = data.playlist;
        }

        toast(`Added to "${playlist.name}"`);

        if (window.__modules?.playlist?.loadUserPlaylists) {
            window.__modules.playlist.loadUserPlaylists();
        }
    } catch (e) {
        console.error('Add to playlist error:', e);
        toast('Failed to add song. Is the server running?', 'error');
    }
}

export function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
    state.setContextMenuSong(null);
    // Reset submenu state
    const parent = document.getElementById('contextAddToPlaylist');
    if (parent) parent.classList.remove('submenu-open');
}

export function contextPlayNext() {
    if (state.contextMenuSong) {
        state.songQueue.unshift(state.contextMenuSong);
        showToast(`"${state.contextMenuSong.title}" will play next`);
        const { renderQueue } = window.__modules.playlist;
        renderQueue();
    }
    hideContextMenu();
}

export function contextAddToQueue() {
    if (state.contextMenuSong) {
        const { addToQueue } = window.__modules.playlist;
        addToQueue(state.contextMenuSong);
    }
    hideContextMenu();
}

export function contextToggleLike() {
    if (state.contextMenuSong) {
        const { isLiked, saveLikedSongs, updateLikeUI } = window.__modules.player;
        const wasLiked = isLiked(state.contextMenuSong);
        if (wasLiked) {
            state.setLikedSongs(state.likedSongs.filter(s => s.url !== state.contextMenuSong.url));
            showToast('Removed from Liked Songs', 'info');
        } else {
            state.likedSongs.push({ title: state.contextMenuSong.title, artist: state.contextMenuSong.artist, url: state.contextMenuSong.url, image: state.contextMenuSong.image });
            showToast('Added to Liked Songs');
        }
        saveLikedSongs();
        if (state.currentSong && state.currentSong.url === state.contextMenuSong.url) updateLikeUI();
    }
    hideContextMenu();
}

export function contextShare() {
    if (state.contextMenuSong) {
        const text = `${state.contextMenuSong.title} by ${state.contextMenuSong.artist}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
        }
    }
    hideContextMenu();
}

export function contextGoToArtist() {
    if (state.contextMenuSong) {
        window.navigate(`#/artist/${encodeURIComponent(state.contextMenuSong.artist)}`);
    }
    hideContextMenu();
}

// Keyboard shortcuts
export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const p = window.__modules.player;
        const pl = window.__modules.playlist;
        const v = window.__modules.visualizer;
        if (e.code === 'Space') {
            e.preventDefault();
            p.togglePlay();
        } else if (e.code === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            p.nextSong();
        } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            p.previousSong();
        } else if (e.code === 'KeyM' && e.ctrlKey) {
            e.preventDefault();
            p.toggleMute();
        } else if (e.code === 'KeyL' && e.ctrlKey) {
            e.preventDefault();
            p.toggleLikeSong();
        } else if (e.code === 'KeyQ' && !e.ctrlKey) {
            pl.toggleQueue();
        } else if (e.code === 'KeyL' && !e.ctrlKey) {
            v.toggleLyrics();
        } else if (e.code === 'KeyS' && !e.ctrlKey) {
            p.toggleShuffle();
        } else if (e.code === 'KeyR' && !e.ctrlKey) {
            p.toggleRepeat();
        } else if (e.key === '?') {
            document.getElementById('shortcutsModal').classList.toggle('active');
        } else if (e.code === 'KeyT' && !e.ctrlKey) {
            p.showSleepTimerMenu();
        } else if (e.code === 'Period' && e.ctrlKey) {
            e.preventDefault();
            p.cyclePlaybackSpeed();
        }
    });

    // Close modals on backdrop click (context menu handled by the global listener above)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// Mobile touch gestures
export function initMobileTouchGestures() {
    const playbar = document.querySelector('.playbar');
    const songinfo = playbar ? playbar.querySelector('.songinfo') : null;
    if (!songinfo) return;

    let touchStartY = 0;

    // Make songinfo clickable on mobile to open fullscreen
    songinfo.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && state.currentSong) {
            // Don't trigger if clicking like/share buttons
            if (e.target.closest('.like-btn') || e.target.closest('.share-btn')) return;
            openNowPlaying();
        }
    });

    // Swipe up on playbar to open fullscreen
    playbar.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    playbar.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        if (diff > 50 && state.currentSong && window.innerWidth <= 768) {
            openNowPlaying();
        }
    }, { passive: true });

    // Swipe down on fullscreen to close
    const npf = document.getElementById('nowPlayingFullscreen');
    if (npf) {
        let npfTouchStartY = 0;
        npf.addEventListener('touchstart', (e) => {
            npfTouchStartY = e.touches[0].clientY;
        }, { passive: true });
        npf.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].clientY - npfTouchStartY;
            if (diff > 80) {
                closeNowPlaying();
            }
        }, { passive: true });
    }
}

export function openNowPlaying() {
    const npf = document.getElementById('nowPlayingFullscreen');
    if (!npf) return;
    window.__modules.player.updateNowPlayingFullscreen();
    npf.classList.add('open');
    document.body.style.overflow = 'hidden';
}

export function closeNowPlaying() {
    const npf = document.getElementById('nowPlayingFullscreen');
    if (!npf) return;
    npf.classList.remove('open');
    document.body.style.overflow = '';
}

// === Library Filters, Search, Sort ===
export function filterLibrary(type, btn) {
    // Update active chip
    document.querySelectorAll('.library-filter-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const items = document.querySelectorAll('#playlistList .playlist-item');
    const likedNav = document.getElementById('likedSongsNav');

    if (type === 'all') {
        items.forEach(item => item.style.display = '');
        if (likedNav) likedNav.style.display = '';
    } else if (type === 'playlists') {
        items.forEach(item => item.style.display = '');
        if (likedNav) likedNav.style.display = '';
    } else if (type === 'artists') {
        items.forEach(item => item.style.display = 'none');
        if (likedNav) likedNav.style.display = 'none';
        // Show followed artists instead
        const followed = JSON.parse(localStorage.getItem('followedArtists') || '[]');
        const list = document.getElementById('playlistList');
        if (followed.length > 0) {
            list.innerHTML = '';
            followed.forEach(artist => {
                const item = document.createElement('div');
                item.className = 'playlist-item';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '10px';
                item.style.padding = '8px 0';
                item.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:#333;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${artist[0]}</div><div><h4 style="font-size:13px;">${artist}</h4><p style="font-size:11px;color:#a7a7a7;">Artist</p></div>`;
                item.onclick = () => window.navigate('#/artist/' + encodeURIComponent(artist));
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p style="color:#a7a7a7;font-size:12px;padding:8px 0;">Follow artists to see them here</p>';
        }
    }
}

export function searchLibrary(query) {
    const items = document.querySelectorAll('#playlistList .playlist-item');
    const q = query.toLowerCase();
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
}

let librarySortAsc = true;
export function toggleLibrarySort() {
    librarySortAsc = !librarySortAsc;
    const btn = document.getElementById('librarySortBtn');
    if (btn) btn.textContent = librarySortAsc ? 'Recent' : 'A-Z';

    const list = document.getElementById('playlistList');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.playlist-item'));
    items.sort((a, b) => {
        const aText = a.textContent.trim();
        const bText = b.textContent.trim();
        return librarySortAsc ? 0 : aText.localeCompare(bText);
    });
    items.forEach(item => list.appendChild(item));
}

// === Notification Bell ===
export function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    panel.classList.toggle('open');

    // Hide dot when opened
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
}

export function addNotification(title, subtitle, image) {
    const list = document.getElementById('notificationList');
    const dot = document.getElementById('notifDot');
    if (!list) return;

    // Clear "no notifications" message
    if (list.querySelector('p')) list.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'notification-item';
    item.innerHTML = `
        <img src="${image || 'img/home.svg'}" alt="" onerror="this.src='img/home.svg'">
        <div class="notification-item-info">
            <h5>${title}</h5>
            <p>${subtitle}</p>
        </div>
    `;
    list.insertBefore(item, list.firstChild);

    // Show dot
    if (dot) dot.style.display = '';

    // Keep max 10
    while (list.children.length > 10) list.removeChild(list.lastChild);
}

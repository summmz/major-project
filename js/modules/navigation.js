// === Navigation Module with Hash Router ===
import * as state from './state.js';
import { loadPlaylistContent, showLikedSongs } from './playlist.js';
import { renderHomeFeed } from './home.js';
import { defaultPlaylists, playlistCovers, playlistNames, artistData, escapeHTML } from './data.js';

// Route definitions
const routes = [
    { pattern: /^#\/$/, handler: () => showHomeView() },
    { pattern: /^#\/search$/, handler: () => showSearchView() },
    { pattern: /^#\/library$/, handler: () => showMobileLibraryView() },
    { pattern: /^#\/profile$/, handler: () => showProfileView() },
    { pattern: /^#\/playlist\/api_(.+)$/, handler: (match) => showApiPlaylistView(match[1]) },
    { pattern: /^#\/playlist\/(.+)$/, handler: (match) => showPlaylistView(match[1]) },
    { pattern: /^#\/liked$/, handler: () => showLikedView() },
    { pattern: /^#\/artist\/api_(.+)$/, handler: (match) => showApiArtistView(match[1]) },
    { pattern: /^#\/artist\/(.+)$/, handler: (match) => showArtistView(decodeURIComponent(match[1])) },
];

export function navigate(path) {
    if (window.location.hash === path) {
        // Same route — still handle it
        handleRouteChange();
    } else {
        window.location.hash = path;
    }
}

export function handleRouteChange() {
    const hash = window.location.hash || '#/';

    for (const route of routes) {
        const match = hash.match(route.pattern);
        if (match) {
            route.handler(match);
            return;
        }
    }

    // Default to home
    showHomeView();
}

function showHomeView() {
    setActivePage('homePage');
    setActiveNavItem('homeNav');
    renderHomeFeed();

    // Apply gradient from current song or reset
    if (window.__modules && window.__modules.gradient) {
        if (state.currentSong && state.currentSong.image) {
            window.__modules.gradient.applyGradientFromImage(state.currentSong.image);
        } else {
            window.__modules.gradient.resetGradient();
        }
    }
}

function showSearchView() {
    setActivePage('searchPage');
    setActiveNavItem('searchNav');

    // Reset gradient for search page
    if (window.__modules && window.__modules.gradient) {
        window.__modules.gradient.resetGradient();
    }
}

function showPlaylistView(playlistId) {
    setActivePage('playlistPage');
    loadPlaylistContent(playlistId);
    setActiveNavItem(null);

    // Apply gradient from playlist cover
    if (window.__modules && window.__modules.gradient) {
        const playlist = defaultPlaylists[playlistId];
        const cover = playlistCovers[playlistId] || (playlist && playlist[0] ? playlist[0].image : null);
        if (cover) {
            window.__modules.gradient.applyGradientFromImage(cover);
        } else {
            window.__modules.gradient.resetGradient();
        }
    }
}

async function showApiPlaylistView(playlistId) {
    setActivePage('playlistPage');
    setActiveNavItem(null);

    const playlistTitle = document.getElementById('playlistTitle');
    const playlistContent = document.getElementById('playlistContent');
    playlistTitle.textContent = 'Loading...';
    playlistContent.innerHTML = '<div style="padding:20px;color:#a7a7a7;">Loading playlist...</div>';

    try {
        const res = await fetch(state.API_BASE + '/playlists/' + playlistId);
        if (!res.ok) throw new Error('Playlist not found');
        const playlist = await res.json();

        playlistTitle.textContent = playlist.name || 'Playlist';

        const songs = playlist.songs || [];
        window.__apiPlaylistSongs = songs;

        let html = `
            <div class="playlist-hero">
                <img class="playlist-hero-img" src="${encodeURI(playlist.image || 'img/home.svg')}" alt="${escapeHTML(playlist.name)}" onerror="this.src='img/home.svg'">
                <div class="playlist-hero-info">
                    <span class="playlist-hero-label">PLAYLIST</span>
                    <h1 class="playlist-hero-title">${escapeHTML(playlist.name)}</h1>
                    ${playlist.description ? `<p class="playlist-hero-desc">${escapeHTML(playlist.description)}</p>` : ''}
                    <p class="playlist-hero-meta">${songs.length} songs</p>
                </div>
            </div>
        `;

        if (songs.length > 0) {
            html += `
                <div class="playlist-actions">
                    <button class="playlist-play-btn" onclick="playApiPlaylist(0)">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="black"><polygon points="6,3 20,12 6,21"/></svg>
                    </button>
                </div>
                <div class="playlist-tracklist">
            `;
            songs.forEach((song, index) => {
                const mins = Math.floor((song.duration || 0) / 60);
                const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
                html += `
                    <div class="track-row" onclick="playApiPlaylist(${index})" data-song-url="${encodeURI(song.url || '')}" data-song-id="${escapeHTML(song.sourceId || song.id || '')}">
                        <span class="track-num">${index + 1}</span>
                        <img class="track-img" src="${encodeURI(song.image || 'img/home.svg')}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                        <div class="track-info">
                            <span class="track-title">${escapeHTML(song.title)}</span>
                            <span class="track-artist">${escapeHTML(song.artist)}</span>
                        </div>
                        <span class="track-duration">${mins}:${secs}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        playlistContent.innerHTML = html;

        if (window.__modules && window.__modules.gradient && playlist.image) {
            window.__modules.gradient.applyGradientFromImage(playlist.image);
        }
    } catch (e) {
        console.error('Failed to load API playlist:', e);
        playlistContent.innerHTML = '<div style="padding:20px;color:#a7a7a7;">Playlist not found or API unavailable.</div>';
    }
}

function showLikedView() {
    showLikedSongs();
    setActiveNavItem(null);
}

function showArtistView(artistName) {
    setActivePage('artistPage');
    setActiveNavItem(null);
    renderArtistPage(artistName);

    // Apply gradient from artist image
    if (window.__modules && window.__modules.gradient) {
        const artist = artistData[artistName];
        if (artist && artist.image) {
            window.__modules.gradient.applyGradientFromImage(artist.image);
        }
    }
}

async function showApiArtistView(artistId) {
    setActivePage('artistPage');
    setActiveNavItem(null);

    const container = document.getElementById('artistContent');
    if (!container) return;
    container.innerHTML = '<div style="padding:40px;color:#a7a7a7;">Loading artist...</div>';

    try {
        const res = await fetch(state.API_BASE + '/artists/' + artistId);
        if (!res.ok) throw new Error('Artist not found');
        const artist = await res.json();
        renderApiArtistPage(artist);

        if (window.__modules && window.__modules.gradient && artist.image) {
            window.__modules.gradient.applyGradientFromImage(artist.image);
        }
    } catch (e) {
        console.error('Failed to load API artist:', e);
        container.innerHTML = '<div style="padding:40px;color:#a7a7a7;">Artist not found.</div>';
    }
}

function renderApiArtistPage(artist) {
    const container = document.getElementById('artistContent');
    if (!container || !artist) return;

    const topSongs = (artist.topSongs || []).slice(0, 10);
    const { normalizeSong } = window.__modules?.search ? {} : {};

    let html = `
        <div class="artist-hero">
            <div class="artist-hero-bg" style="background-image: url('${encodeURI(artist.image || 'img/home.svg')}')"></div>
            <div class="artist-hero-content">
                ${artist.isVerified ? '<div class="artist-verified"><svg width="24" height="24" viewBox="0 0 24 24" fill="#3d91f4"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z"/></svg><span>Verified Artist</span></div>' : ''}
                <h1 class="artist-name">${escapeHTML(artist.name)}</h1>
                <p class="artist-listeners">${artist.followerCount ? artist.followerCount.toLocaleString() + ' followers' : ''}</p>
            </div>
        </div>
        <div class="artist-actions">
            <button class="artist-play-btn" onclick="playApiArtistSongs('${artist.id}')">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="black"><polygon points="5,3 19,12 5,21"/></svg>
            </button>
        </div>
    `;

    if (topSongs.length > 0) {
        html += `<div class="artist-section"><h2>Popular</h2><div class="artist-tracklist">`;
        topSongs.forEach((song, i) => {
            const mins = Math.floor((song.duration || 0) / 60);
            const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
            html += `
                <div class="track-row" onclick="playApiArtistSong(${i})" data-song-url="${encodeURI(song.url || '')}" data-song-id="${escapeHTML(song.sourceId || song.id || '')}">
                    <span class="track-num">${i + 1}</span>
                    <img class="track-img" src="${encodeURI(song.image || 'img/home.svg')}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                    <div class="track-info">
                        <span class="track-title">${escapeHTML(song.title)}</span>
                        <span class="track-artist">${escapeHTML(song.artist)}</span>
                    </div>
                    <span class="track-duration">${mins}:${secs}</span>
                </div>
            `;
        });
        html += `</div></div>`;
    }

    // Albums / Singles
    if (artist.albums && artist.albums.length > 0) {
        html += `<div class="artist-section"><h2>Albums</h2><div class="section-scroll">`;
        artist.albums.slice(0, 8).forEach(album => {
            html += `
                <div class="card" onclick="navigate('#/playlist/api_${album.id}')">
                    <img loading="lazy" src="${encodeURI(album.image || 'img/home.svg')}" alt="${escapeHTML(album.name)}" onerror="this.src='img/home.svg'">
                    <h2>${escapeHTML(album.name)}</h2>
                    <p>${album.year || 'Album'}</p>
                </div>
            `;
        });
        html += `</div></div>`;
    }

    container.innerHTML = html;

    // Store songs for playback
    window.__apiArtistSongs = topSongs;
}

function renderArtistPage(artistName) {
    const container = document.getElementById('artistContent');
    if (!container) return;

    const artist = artistData[artistName] || { image: 'img/home.svg', verified: false, listeners: '0' };

    // Collect all songs by this artist
    const allSongs = [];
    const seenUrls = new Set();
    const appearsInPlaylists = [];

    for (const [playlistId, songs] of Object.entries(defaultPlaylists)) {
        let found = false;
        songs.forEach((song, index) => {
            if (song.artist.toLowerCase().includes(artistName.toLowerCase())) {
                if (!seenUrls.has(song.url)) {
                    seenUrls.add(song.url);
                    allSongs.push({ ...song, playlistId, index });
                }
                found = true;
            }
        });
        if (found) appearsInPlaylists.push(playlistId);
    }

    // Find related artists (from same playlists)
    const relatedArtists = new Map();
    appearsInPlaylists.forEach(plId => {
        defaultPlaylists[plId].forEach(song => {
            if (song.artist !== artistName && !relatedArtists.has(song.artist)) {
                const ra = artistData[song.artist];
                if (ra) relatedArtists.set(song.artist, ra);
            }
        });
    });

    const topSongs = allSongs.slice(0, 5);
    const totalDuration = allSongs.reduce((sum, s) => sum + (s.duration || 0), 0);

    let html = `
        <div class="artist-hero">
            <div class="artist-hero-bg" style="background-image: url('${encodeURI(artist.image)}')"></div>
            <div class="artist-hero-content">
                ${artist.verified ? '<div class="artist-verified"><svg width="24" height="24" viewBox="0 0 24 24" fill="#3d91f4"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z"/></svg><span>Verified Artist</span></div>' : ''}
                <h1 class="artist-name">${escapeHTML(artistName)}</h1>
                <p class="artist-listeners">${artist.listeners} monthly listeners</p>
            </div>
        </div>

        <div class="artist-actions">
            <button class="artist-play-btn" onclick="playArtistSongs('${escapeHTML(artistName)}')">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="black"><polygon points="5,3 19,12 5,21"/></svg>
            </button>
            <button class="artist-follow-btn" id="artistFollowBtn">Follow</button>
        </div>

        <div class="artist-section">
            <h2>Popular</h2>
            <div class="artist-tracklist">
    `;

    topSongs.forEach((song, i) => {
        const mins = Math.floor((song.duration || 0) / 60);
        const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
        html += `
            <div class="track-row" onclick="playSong(${song.index}, '${song.playlistId}')" oncontextmenu="showContextMenu(event, window.__defaultPlaylists['${song.playlistId}'][${song.index}])" data-song-url="${encodeURI(song.url)}">
                <span class="track-num">${i + 1}</span>
                <img class="track-img" src="${encodeURI(song.image)}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                <div class="track-info">
                    <span class="track-title">${escapeHTML(song.title)}</span>
                    <span class="track-artist">${escapeHTML(song.artist)}</span>
                </div>
                <span class="track-duration">${mins}:${secs}</span>
            </div>
        `;
    });

    html += `</div></div>`;

    // Discography — playlists containing this artist
    if (appearsInPlaylists.length > 0) {
        html += `
            <div class="artist-section">
                <h2>Discography</h2>
                <div class="section-scroll">
        `;
        appearsInPlaylists.slice(0, 8).forEach(plId => {
            const plName = playlistNames[plId] || plId;
            const cover = playlistCovers[plId] || (defaultPlaylists[plId] && defaultPlaylists[plId][0] ? defaultPlaylists[plId][0].image : 'img/home.svg');
            html += `
                <div class="card" onclick="showPlaylistPage('${plId}')">
                    <div class="play"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#1DB954"/><polygon points="18,14 34,24 18,34" fill="black"/></svg></div>
                    <img loading="lazy" src="${encodeURI(cover)}" alt="${escapeHTML(plName)}" onerror="this.src='img/home.svg'">
                    <h2>${escapeHTML(plName)}</h2>
                    <p>Playlist</p>
                </div>
            `;
        });
        html += `</div></div>`;
    }

    // Fans Also Like
    const related = Array.from(relatedArtists.entries()).slice(0, 6);
    if (related.length > 0) {
        html += `
            <div class="artist-section">
                <h2>Fans Also Like</h2>
                <div class="section-scroll">
        `;
        related.forEach(([name, data]) => {
            html += `
                <div class="card artist-card" onclick="navigate('#/artist/${encodeURIComponent(name)}')">
                    <img loading="lazy" src="${encodeURI(data.image)}" alt="${escapeHTML(name)}" onerror="this.src='img/home.svg'" class="artist-card-img">
                    <h2>${escapeHTML(name)}</h2>
                    <p>Artist</p>
                </div>
            `;
        });
        html += `</div></div>`;
    }

    container.innerHTML = html;

    // Follow button toggle
    const followBtn = document.getElementById('artistFollowBtn');
    if (followBtn) {
        const followed = JSON.parse(localStorage.getItem('followedArtists') || '[]');
        if (followed.includes(artistName)) {
            followBtn.textContent = 'Following';
            followBtn.classList.add('following');
        }
        followBtn.onclick = () => {
            let f = JSON.parse(localStorage.getItem('followedArtists') || '[]');
            if (f.includes(artistName)) {
                f = f.filter(a => a !== artistName);
                followBtn.textContent = 'Follow';
                followBtn.classList.remove('following');
            } else {
                f.push(artistName);
                followBtn.textContent = 'Following';
                followBtn.classList.add('following');
            }
            localStorage.setItem('followedArtists', JSON.stringify(f));
        };
    }
}

// Public navigation functions (called from HTML)
export function showHome() {
    navigate('#/');
}

export function showMobileLibrary() {
    navigate('#/library');
}

export function showSearch() {
    navigate('#/search');
}

export function showPlaylistPage(playlistId) {
    navigate(`#/playlist/${playlistId}`);
}

export function showLikedSongsNav() {
    navigate('#/liked');
}

// Greeting
export function updateTimeGreeting() {
    const now = new Date();
    const hour = now.getHours();

    let greeting;
    if (hour >= 5 && hour < 12) {
        greeting = "Good Morning";
    } else if (hour >= 12 && hour < 17) {
        greeting = "Good Afternoon";
    } else if (hour >= 17 && hour < 22) {
        greeting = "Good Evening";
    } else {
        greeting = "Good Night";
    }

    if (state.currentUser) {
        greeting += `, ${state.currentUser.name}`;
    }

    const el = document.getElementById("greeting");
    if (el) el.textContent = greeting;
}

function showProfileView() {
    setActivePage('profilePage');
    setActiveNavItem(null);
    if (window.__modules?.profile?.renderProfilePage) {
        window.__modules.profile.renderProfilePage();
    }
}

// Page switching helper
function showMobileLibraryView() {
    setActivePage('mobileLibraryPage');
    setActiveNavItem('libraryNav');
    renderMobileLibrary();
}

function renderMobileLibrary() {
    const el = document.getElementById('mobileLibraryContent');
    if (!el) return;

    // Import state lazily to avoid circular deps
    const st = window.__appState || {};
    const userPlaylists  = (window.__modules?.playlist?.getUserPlaylists?.() || []);
    const localPlaylists = (() => {
        try { return JSON.parse(localStorage.getItem('localPlaylists') || '[]'); } catch { return []; }
    })();
    const likedCount = (() => {
        try { return JSON.parse(localStorage.getItem('likedSongs') || '[]').length; } catch { return 0; }
    })();

    let html = `<div class="mobile-library">
        <h1 style="font-size:22px;font-weight:700;margin:0 0 20px;">Your Library</h1>`;

    // Liked songs shortcut
    html += `
        <div class="mobile-lib-item" onclick="navigate('#/liked')">
            <div class="mobile-lib-icon" style="background:linear-gradient(135deg,#450af5,#c4efd9);">♥</div>
            <div class="mobile-lib-info">
                <h4>Liked Songs</h4>
                <p>${likedCount} songs</p>
            </div>
        </div>`;

    // Create playlist button
    html += `
        <div class="mobile-lib-item mobile-lib-create" onclick="createPlaylist()">
            <div class="mobile-lib-icon" style="background:#282828;font-size:22px;">＋</div>
            <div class="mobile-lib-info">
                <h4>Create Playlist</h4>
                <p>Add a new playlist</p>
            </div>
        </div>`;

    // Local playlists
    localPlaylists.forEach(pl => {
        html += `
        <div class="mobile-lib-item" onclick="navigate('#/playlist/local_${pl.id}')">
            <div class="mobile-lib-icon" style="background:#282828;">🎵</div>
            <div class="mobile-lib-info">
                <h4>${escapeHTML(pl.name)}</h4>
                <p>${pl.songs?.length || 0} songs • Local</p>
            </div>
            <div class="mobile-lib-actions">
                <button onclick="event.stopPropagation();window.__modules.playlist.renameLocalPlaylist('${pl.id}','${escapeHTML(pl.name)}')" class="mob-lib-btn">✏️</button>
                <button onclick="event.stopPropagation();window.__modules.playlist.deleteLocalPlaylist('${pl.id}','${escapeHTML(pl.name)}')" class="mob-lib-btn">🗑</button>
            </div>
        </div>`;
    });

    // Cloud playlists
    (window.__modules?.state?.userPlaylists || []).forEach(pl => {
        const plId = pl._id || pl.id;
        html += `
        <div class="mobile-lib-item" onclick="navigate('#/playlist/${plId}')">
            <div class="mobile-lib-icon" style="background:#282828;">🎵</div>
            <div class="mobile-lib-info">
                <h4>${escapeHTML(pl.name)}</h4>
                <p>${pl.songs?.length || 0} songs</p>
            </div>
            <div class="mobile-lib-actions">
                <button onclick="event.stopPropagation();window.__modules.playlist.renameCloudPlaylist('${plId}','${escapeHTML(pl.name)}')" class="mob-lib-btn">✏️</button>
                <button onclick="event.stopPropagation();window.__modules.playlist.deleteCloudPlaylist('${plId}','${escapeHTML(pl.name)}')" class="mob-lib-btn">🗑</button>
            </div>
        </div>`;
    });

    html += '</div>';
    el.innerHTML = html;
}

export function setActivePage(pageId) {
    const pages = document.querySelectorAll('.content-page');
    const target = document.getElementById(pageId);
    const currentActive = document.querySelector('.content-page.active');

    if (currentActive && currentActive !== target) {
        currentActive.classList.add('fade-out');
        setTimeout(() => {
            pages.forEach(page => {
                if (page !== target) {
                    page.classList.remove('active', 'fade-out');
                    page.style.display = 'none';
                }
            });
            target.style.display = 'block';
            const rightPanel = document.querySelector('.right');
            if (rightPanel) rightPanel.scrollTop = 0;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    target.classList.add('active');
                });
            });
        }, 150);
    } else {
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
}

function setActiveNavItem(navId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (navId) {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }
}

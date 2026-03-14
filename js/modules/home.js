// === Home Feed Module ===
import * as state from './state.js';
import { defaultPlaylists, playlistNames, playlistDescriptions, playlistCovers, escapeHTML } from './data.js';

// ─── Entry point ─────────────────────────────────────────────────────────────

export function renderHomeFeed() {
    const homePage = document.getElementById('homePage');
    if (!homePage) return;

    const greetingText = document.getElementById('greeting')?.textContent || getGreeting();

    // Scaffold all sections immediately — async ones show skeletons
    homePage.innerHTML = `
        <h1 id="greeting">${greetingText}</h1>

        <!-- Recently played (shows if history exists) -->
        <div class="home-section" id="recentlyPlayedSection" style="display:none;">
            <div class="section-header"><h2>Recently Played</h2></div>
            <div class="section-scroll" id="recentlyPlayedContainer"></div>
        </div>

        <!-- Your playlists (logged-in only) -->
        <div class="home-section" id="yourPlaylistsSection" style="display:none;">
            <div class="section-header"><h2>Your Playlists</h2></div>
            <div class="section-scroll" id="yourPlaylistsContainer"></div>
        </div>

        <!-- Trending / Personalized recs -->
        <div class="home-section" id="youtubeRecsSection">
            <div class="section-header">
                <h2 id="youtubeRecsHeading">Trending Now</h2>
                <button class="show-all-btn" onclick="window.__playSection('youtubeRecs')">Play all</button>
            </div>
            <div class="section-scroll" id="youtubeRecsContainer">${skeletons(8)}</div>
        </div>

        <!-- New Releases -->
        <div class="home-section" id="newReleasesSection">
            <div class="section-header">
                <h2>New Releases</h2>
                <button class="show-all-btn" onclick="window.__playSection('newReleases')">Play all</button>
            </div>
            <div class="section-scroll" id="newReleasesContainer">${skeletons(8)}</div>
        </div>

        <!-- Charts -->
        <div class="home-section" id="chartsSection">
            <div class="section-header">
                <h2>🔥 Charts</h2>
                <button class="show-all-btn" onclick="window.__playSection('charts')">Play all</button>
            </div>
            <div class="section-scroll" id="chartsContainer">${skeletons(8)}</div>
        </div>

        <!-- Time-of-day playlists -->
        <div class="home-section" id="timeSection">
            <div class="section-header"><h2>${getTimeBasedSection().title}</h2></div>
            <div class="section-scroll">
                ${getTimeBasedSection().playlists.map(id => playlistCard(id)).join('')}
            </div>
        </div>

        <!-- Genre rows — one row per genre, lazy-loaded -->
        <div id="genreRowsContainer"></div>

        <!-- Mood grid -->
        <div class="home-section">
            <div class="section-header"><h2>Browse by Mood</h2></div>
            <div class="genre-grid" id="moodGrid">${renderMoodGrid()}</div>
        </div>

        <!-- Mood-based song rows (loaded after moods rendered) -->
        <div id="moodSongRowsContainer"></div>

        <!-- Featured Playlists -->
        <div class="home-section">
            <div class="section-header"><h2>Featured Playlists</h2></div>
            <div class="section-scroll">
                ${FEATURED_IDS.map(id => playlistCard(id)).join('')}
            </div>
        </div>
    `;

    // Populate synchronous sections
    updateRecentlyPlayedSection();
    updateUserPlaylistsSection();

    // Launch all async sections in parallel — no sequential waiting
    loadYoutubeRecs();
    loadNewReleases();
    loadCharts();
    loadGenreRows();
    loadMoodSongRows();
    loadTrendingPlaylists(); // DB-backed featured playlists (if available)

    // Global play-section helper
    window.__playSection = (key) => {
        const list = window.__homeSections?.[key];
        if (!list?.length) return;
        state.setCurrentPlaylist([...list]);
        state.setCurrentIndex(0);
        window.__activePlaylistMeta = buildPlaylistMeta(key);
        window.playSong(0);
    };
}

// ─── Async section loaders ───────────────────────────────────────────────────

// Build a compact taste-profile from localStorage for logged-out users.
// Sent to the backend as a base64 param so personalisation works without an account.
function buildLocalTasteProfile() {
    try {
        const recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
        const likedSongs     = JSON.parse(localStorage.getItem('likedSongs')     || '[]');
        if (!recentlyPlayed.length && !likedSongs.length) return null;
        return btoa(JSON.stringify({
            recentlyPlayed: recentlyPlayed.slice(0, 20).map(s => ({
                title: s.title, artist: s.artist, sourceId: s.sourceId
            })),
            likedSongs: likedSongs.slice(0, 20).map(s => ({
                title: s.title, artist: s.artist, sourceId: s.sourceId
            })),
        }));
    } catch { return null; }
}

async function loadYoutubeRecs() {
    try {
        const headers  = {};
        let   endpoint = '/recommendations/youtube';
        let   params   = 't=' + Date.now();

        if (state.authToken) {
            // Logged-in: server reads taste from MongoDB
            headers['Authorization'] = 'Bearer ' + state.authToken;
        } else {
            // Logged-out: send localStorage taste profile as query param
            const profile = buildLocalTasteProfile();
            if (profile) params += '&profile=' + encodeURIComponent(profile);
        }

        const res  = await fetch(`${state.API_BASE}${endpoint}?${params}`, { headers });
        const data = await res.json();
        const songs = data.songs || [];

        // Update section heading to reflect the source
        const heading = document.getElementById('youtubeRecsHeading');
        if (heading) {
            const headings = {
                youtube_personalized: 'Recommended for You',
                profile_inapp:        'Based on Your Listening',
                profile_local:        'Based on Your Listening',
                trending:             'Trending Now',
                trending_fallback:    'Trending Now',
            };
            heading.textContent = headings[data.source] || 'Recommended for You';
        }

        renderSongSection('youtubeRecsContainer', songs, 'youtubeRecs');
        if (!songs.length) document.getElementById('youtubeRecsSection').style.display = 'none';
    } catch (e) {
        document.getElementById('youtubeRecsSection').style.display = 'none';
    }
}

async function loadNewReleases() {
    try {
        const res  = await fetch(state.API_BASE + '/recommendations/newreleases');
        const data = await res.json();
        renderSongSection('newReleasesContainer', data.songs || [], 'newReleases');
        if (!(data.songs?.length)) document.getElementById('newReleasesSection').style.display = 'none';
    } catch (e) {
        document.getElementById('newReleasesSection').style.display = 'none';
    }
}

async function loadCharts() {
    try {
        const res  = await fetch(state.API_BASE + '/recommendations/charts');
        const data = await res.json();
        renderSongSection('chartsContainer', data.songs || [], 'charts');
        if (!(data.songs?.length)) document.getElementById('chartsSection').style.display = 'none';
    } catch (e) {
        document.getElementById('chartsSection').style.display = 'none';
    }
}

// Genre rows: pop, hiphop, bollywood, punjabi — each its own horizontal scroll
const GENRE_ROWS = [
    { key: 'pop',       label: 'Pop Hits'       },
    { key: 'hiphop',    label: 'Hip-Hop'         },
    { key: 'bollywood', label: 'Bollywood'       },
    { key: 'punjabi',   label: 'Punjabi'         },
    { key: 'rnb',       label: 'R&B / Soul'      },
    { key: 'indie',     label: 'Indie'           },
    { key: 'kpop',      label: 'K-Pop'           },
];

async function loadGenreRows() {
    const container = document.getElementById('genreRowsContainer');
    if (!container) return;

    // Scaffold skeleton rows immediately so page doesn't look empty
    container.innerHTML = GENRE_ROWS.map(g => `
        <div class="home-section" id="genre-section-${g.key}">
            <div class="section-header">
                <h2>${g.label}</h2>
                <button class="show-all-btn" onclick="window.__playSection('genre_${g.key}')">Play all</button>
            </div>
            <div class="section-scroll" id="genre-container-${g.key}">${skeletons(8)}</div>
        </div>
    `).join('');

    // Fetch all genres in parallel
    const settled = await Promise.allSettled(
        GENRE_ROWS.map(g =>
            fetch(`${state.API_BASE}/recommendations/genre?name=${g.key}`)
                .then(r => r.json())
                .then(d => ({ key: g.key, songs: d.songs || [] }))
        )
    );

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        const { key, songs } = outcome.value;
        renderSongSection(`genre-container-${key}`, songs, `genre_${key}`);
        if (!songs.length) {
            const sec = document.getElementById(`genre-section-${key}`);
            if (sec) sec.style.display = 'none';
        }
    }
}

// Mood song rows (different from the mood navigation grid above)
const MOOD_ROWS = [
    { key: 'chill',     label: 'Chill Vibes'    },
    { key: 'workout',   label: 'Workout'         },
    { key: 'romance',   label: 'Romance'         },
    { key: 'latenight', label: 'Late Night'      },
];

async function loadMoodSongRows() {
    const container = document.getElementById('moodSongRowsContainer');
    if (!container) return;

    container.innerHTML = MOOD_ROWS.map(m => `
        <div class="home-section" id="mood-section-${m.key}">
            <div class="section-header">
                <h2>${m.label}</h2>
                <button class="show-all-btn" onclick="window.__playSection('mood_${m.key}')">Play all</button>
            </div>
            <div class="section-scroll" id="mood-container-${m.key}">${skeletons(8)}</div>
        </div>
    `).join('');

    const settled = await Promise.allSettled(
        MOOD_ROWS.map(m =>
            fetch(`${state.API_BASE}/recommendations/mood?name=${m.key}`)
                .then(r => r.json())
                .then(d => ({ key: m.key, songs: d.songs || [] }))
        )
    );

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        const { key, songs } = outcome.value;
        renderSongSection(`mood-container-${key}`, songs, `mood_${key}`);
        if (!songs.length) {
            const sec = document.getElementById(`mood-section-${key}`);
            if (sec) sec.style.display = 'none';
        }
    }
}

async function loadTrendingPlaylists() {
    try {
        const res  = await fetch(state.API_BASE + '/playlists/featured');
        if (!res.ok) return;
        const data = await res.json();
        const pls  = data.playlists || [];
        if (!pls.length) return;

        // Find or create a section for these
        let sec = document.getElementById('dbPlaylistsSection');
        if (!sec) {
            sec = document.createElement('div');
            sec.id = 'dbPlaylistsSection';
            sec.className = 'home-section';
            sec.innerHTML = `
                <div class="section-header"><h2>Curated Playlists</h2></div>
                <div class="section-scroll" id="dbPlaylistsContainer"></div>
            `;
            // Insert before the featured playlists (last section)
            const homePage = document.getElementById('homePage');
            homePage?.appendChild(sec);
        }
        document.getElementById('dbPlaylistsContainer').innerHTML = pls.slice(0, 10).map(pl => `
            <div class="card" onclick="navigate('#/playlist/api_${pl.id}')">
                <div class="img-container">
                    <img loading="lazy" src="${encodeURI(pl.image || 'img/home.svg')}" onerror="this.src='img/home.svg'" alt="${escapeHTML(pl.name)}">
                    <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
                </div>
                <h2>${escapeHTML(pl.name)}</h2>
                <p>${pl.songCount ? pl.songCount + ' songs' : escapeHTML(pl.description || '')}</p>
            </div>
        `).join('');
    } catch { /* DB playlists optional */ }
}

// ─── Render helpers ──────────────────────────────────────────────────────────

// Renders a horizontal scroll of song cards and registers songs for playback
function renderSongSection(containerId, songs, sectionKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!window.__homeSections) window.__homeSections = {};
    window.__homeSections[sectionKey] = songs;

    if (!songs.length) { el.innerHTML = ''; return; }

    el.innerHTML = songs.map((song, i) => {
        const preload = song.source === 'youtube' && song.sourceId
            ? `onmouseenter="window.__preloadSong('${song.sourceId}')"`
            : '';
        return `
        <div class="card" onclick="window.__playHome('${sectionKey}', ${i})"
             oncontextmenu="window.showContextMenu(event, window.__homeSections?.['${sectionKey}']?.[${i}])"
             ${preload}>
            <div class="img-container">
                <img loading="lazy" src="${encodeURI(song.image || 'img/home.svg')}"
                     alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
            </div>
            <h2>${escapeHTML(song.title)}</h2>
            <p>${escapeHTML(song.artist)}</p>
        </div>`;
    }).join('');

    // Global preload handler — tells the server to warm its yt-dlp cache
    window.__preloadSong = window.__preloadSong || ((videoId) => {
        if (!videoId || window.__preloaded?.has(videoId)) return;
        if (!window.__preloaded) window.__preloaded = new Set();
        window.__preloaded.add(videoId);
        fetch(state.API_BASE + '/songs/preload/' + videoId).catch(() => {});
    });

    // One global handler covers all sections
    window.__playHome = (key, index) => {
        const list = window.__homeSections?.[key];
        if (!list?.length) return;
        state.setCurrentPlaylist([...list]); // copy so we can append later
        state.setCurrentIndex(index);

        // Tag the active playlist so the player knows where to fetch more songs
        window.__activePlaylistMeta = buildPlaylistMeta(key);

        window.playSong(index);
    };
}

function skeletons(count) {
    return Array.from({ length: count }, () => `
        <div class="card skeleton-card" style="pointer-events:none;">
            <div class="img-container skeleton-img"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
        </div>
    `).join('');
}

function playlistCard(id) {
    const name  = playlistNames[id]  || id;
    const cover = playlistCovers[id] || (defaultPlaylists[id]?.[0]?.image) || 'img/home.svg';
    const desc  = playlistDescriptions[id] || '';
    return `
        <div class="card" onclick="showPlaylistPage('${id}')">
            <div class="img-container">
                <img loading="lazy" src="${encodeURI(cover)}" alt="${escapeHTML(name)}" onerror="this.src='img/home.svg'">
                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
            </div>
            <h2>${escapeHTML(name)}</h2>
            <p>${escapeHTML(desc)}</p>
        </div>
    `;
}

const MOODS = [
    { name: 'Chill',       color: '#1e3264', key: 'chill'     },
    { name: 'Workout',     color: '#e8115b', key: 'workout'   },
    { name: 'Punjabi',     color: '#ba5d07', key: 'punjabi'   },
    { name: 'Rock',        color: '#e13300', key: 'rock'      },
    { name: 'Late Night',  color: '#503750', key: 'latenight' },
    { name: 'Romance',     color: '#d84000', key: 'romance'   },
    { name: 'Drive',       color: '#148a08', key: 'drive'     },
    { name: 'Jazz',        color: '#1a5276', key: 'jazz'      },
    { name: 'Indie',       color: '#8d67ab', key: 'indie'     },
    { name: 'Party',       color: '#e61e32', key: 'party'     },
    { name: 'Happy',       color: '#f39c12', key: 'happy'     },
    { name: 'Focus',       color: '#1abc9c', key: 'focus'     },
];

function renderMoodGrid() {
    return MOODS.map(m => `
        <div class="genre-mood-card" style="background-color:${m.color};"
             onclick="window.__playMood('${m.key}', '${m.name}')">
            <h3>${m.name}</h3>
        </div>
    `).join('');
}

// Clicking a mood card plays songs from that mood via API
window.__playMood = async (moodKey, moodName) => {
    try {
        window.showToast?.(`Loading ${moodName}...`, 'info', 1500);
        const res  = await fetch(`${state.API_BASE}/recommendations/mood?name=${moodKey}`);
        const data = await res.json();
        const songs = data.songs || [];
        if (!songs.length) { window.showToast?.('No songs found', 'error'); return; }
        state.setCurrentPlaylist([...songs]);
        state.setCurrentIndex(0);
        window.__activePlaylistMeta = { type: 'mood', key: moodKey };
        window.playSong(0);
    } catch (e) {
        window.showPlaylistPage?.(moodKey);
    }
};

// ─── Synchronous section helpers ─────────────────────────────────────────────

function updateRecentlyPlayedSection() {
    // Delegate to the single source-of-truth renderer in playlist.js
    if (window.__modules?.playlist?.renderRecentlyPlayed) {
        window.__modules.playlist.renderRecentlyPlayed();
    }
}

function updateUserPlaylistsSection() {
    const section   = document.getElementById('yourPlaylistsSection');
    const container = document.getElementById('yourPlaylistsContainer');
    if (!section || !container) return;

    if (!state.currentUser || !state.userPlaylists.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = state.userPlaylists.map(pl => `
        <div class="card" onclick="showPlaylistPage('${pl.id}')">
            <div class="img-container">
                <img src="${pl.songs?.[0] ? encodeURI(pl.songs[0].image) : 'img/home.svg'}" onerror="this.src='img/home.svg'" alt="${escapeHTML(pl.name)}">
                <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
            </div>
            <h2>${escapeHTML(pl.name)}</h2>
            <p>${pl.songs?.length || 0} songs</p>
        </div>
    `).join('');
}

// ─── Data / constants ────────────────────────────────────────────────────────

const FEATURED_IDS = [
    'popular','SabrinaSessions','workout','SereneRoads','Punjabi',
    'MidnightHeat','BeachVibes','SpellboundGrooves','Songsinshower',
    'Cherrystainedlips','Rockclassics','Wetwindows','ignitethebeat',
    'chillvibes','Jazzessentials','indiefavs','LeatherLace','SilkSheetsRedLights',
];

function getTimeBasedSection() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return { title: 'Morning Energy',   playlists: ['popular','workout','ignitethebeat','SabrinaSessions'] };
    if (h >= 12 && h < 17) return { title: 'Afternoon Focus',  playlists: ['chillvibes','Jazzessentials','indiefavs','SereneRoads'] };
    if (h >= 17 && h < 22) return { title: 'Evening Vibes',    playlists: ['MidnightHeat','SpellboundGrooves','BeachVibes','Punjabi'] };
    return                         { title: 'Late Night',       playlists: ['SilkSheetsRedLights','Wetwindows','LeatherLace','Songsinshower'] };
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
}

// ─── Infinite playlist helpers ───────────────────────────────────────────────

// Derive what endpoint to call for more songs based on the section key
function buildPlaylistMeta(key) {
    if (key.startsWith('genre_'))      return { type: 'genre',    key: key.replace('genre_', '') };
    if (key.startsWith('mood_'))       return { type: 'mood',     key: key.replace('mood_', '') };
    if (key === 'youtubeRecs')         return { type: 'trending' };
    if (key === 'newReleases')         return { type: 'newreleases' };
    if (key === 'charts')              return { type: 'charts' };
    return null; // static playlist — no auto-extend
}

// Tracks which page of seeds was last fetched per playlist type+key
// so successive fetches use different seeds and avoid identical results.
window.__playlistPages = window.__playlistPages || {};

// Fetch more songs and append to currentPlaylist.
// Returns the number of songs actually appended (may be 0 if all dupes).
window.__fetchMoreSongs = async function() {
    const meta = window.__activePlaylistMeta;
    if (!meta) return 0;

    // Advance the page counter so this fetch uses different seeds than the last
    const metaKey = meta.key ? `${meta.type}_${meta.key}` : meta.type;
    window.__playlistPages[metaKey] = (window.__playlistPages[metaKey] || 0) + 1;
    const page = window.__playlistPages[metaKey];

    let url;
    if      (meta.type === 'genre')       url = `${state.API_BASE}/recommendations/genre?name=${meta.key}&page=${page}`;
    else if (meta.type === 'mood')        url = `${state.API_BASE}/recommendations/mood?name=${meta.key}&page=${page}`;
    else if (meta.type === 'trending')    url = `${state.API_BASE}/recommendations/trending?page=${page}`;
    else if (meta.type === 'newreleases') url = `${state.API_BASE}/recommendations/newreleases?page=${page}`;
    else if (meta.type === 'charts')      url = `${state.API_BASE}/recommendations/charts?page=${page}`;
    else if (meta.type === 'search') {
        const seed = encodeURIComponent(meta.artist || meta.query || 'trending music');
        url = `${state.API_BASE}/search?q=${seed}&type=songs&limit=20`;
    }
    else return 0;

    try {
        const res  = await fetch(url + '&t=' + Date.now());
        if (!res.ok) return 0;
        const data = await res.json();
        const incoming = data.songs || [];
        if (!incoming.length) return 0;

        // Deduplicate against every song already in the playlist
        const existingIds = new Set(
            state.currentPlaylist.map(s => s.sourceId || s.url).filter(Boolean)
        );

        const fresh = incoming.filter(s => {
            const id = s.sourceId || s.url;
            if (!id || existingIds.has(id)) return false;
            existingIds.add(id);
            return true;
        });

        if (!fresh.length) {
            // All returned songs were duplicates — try the next page recursively
            // but only one extra level deep to avoid infinite loops
            if (page < 10) {
                window.__playlistPages[metaKey] = page + 1;
                return window.__fetchMoreSongs();
            }
            return 0;
        }

        const extended = [...state.currentPlaylist, ...fresh];
        state.setCurrentPlaylist(extended);
        console.log(`[playlist] +${fresh.length} songs via page ${page} (total: ${extended.length})`);
        return fresh.length;
    } catch (e) {
        console.warn('[playlist] fetchMoreSongs failed:', e.message);
        return 0;
    }
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export function playMadeForYou(index) {
    const songs = window.__homeSections?.madeForYou || [];
    if (!songs.length) return;
    state.setCurrentPlaylist(songs);
    state.setCurrentIndex(index);
    window.playSong(index);
}

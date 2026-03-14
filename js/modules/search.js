// === Search Module ===
import * as state from './state.js';
import { defaultPlaylists, searchCategories, artistData, escapeHTML, normalizeSong } from './data.js';

export function debouncedSearch(value) {
    clearTimeout(state.searchDebounceTimer);
    state.setSearchDebounceTimer(setTimeout(() => performSearch(value), 300));
}

function getRecentSearches() {
    try { return JSON.parse(localStorage.getItem('recentSearches') || '[]'); } catch(e) { return []; }
}

function addRecentSearch(query) {
    let recent = getRecentSearches().filter(q => q !== query);
    recent.unshift(query);
    if (recent.length > 8) recent = recent.slice(0, 8);
    try { localStorage.setItem('recentSearches', JSON.stringify(recent)); } catch(e) {}
}

export function removeRecentSearch(query) {
    let recent = getRecentSearches().filter(q => q !== query);
    try { localStorage.setItem('recentSearches', JSON.stringify(recent)); } catch(e) {}
    performSearch('');
}

export function clearRecentSearches() {
    try { localStorage.removeItem('recentSearches'); } catch(e) {}
    performSearch('');
}

function renderBrowseView() {
    const recent = getRecentSearches();
    let html = '';

    if (recent.length > 0) {
        html += `
            <div class="recent-searches">
                <div class="recent-searches-header">
                    <h3>Recent searches</h3>
                    <button class="clear-recent-btn" onclick="clearRecentSearches()">Clear all</button>
                </div>
                <div class="recent-pills">
        `;
        recent.forEach((q, idx) => {
            html += `
                <div class="recent-pill" data-recent-idx="${idx}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>${escapeHTML(q)}</span>
                    <button class="remove-recent" data-remove-idx="${idx}">&times;</button>
                </div>
            `;
        });
        html += `</div></div>`;
    }

    html += `<h2>Browse all</h2><div class="search-categories">`;
    searchCategories.forEach(cat => {
        html += `
            <div class="category-card" style="background-color: ${cat.color};" onclick="searchCategory('${cat.name.toLowerCase()}')">
                <h3>${cat.name}</h3>
                <img class="category-card-img" src="${encodeURI(cat.image)}" alt="${cat.name}" onerror="this.style.display='none'" loading="lazy">
            </div>
        `;
    });
    html += '</div>';

    return html;
}

// Attach delegated listeners for recent-search pills (avoids XSS via onclick attributes)
function attachRecentPillListeners() {
    const results = document.getElementById('searchResults');
    if (!results) return;
    results.addEventListener('click', (e) => {
        // Remove button
        const removeBtn = e.target.closest('[data-remove-idx]');
        if (removeBtn) {
            e.stopPropagation();
            const recent = getRecentSearches();
            const idx = parseInt(removeBtn.dataset.removeIdx, 10);
            if (!isNaN(idx)) {
                const query = recent[idx];
                if (query) removeRecentSearch(query);
            }
            return;
        }
        // Pill click
        const pill = e.target.closest('[data-recent-idx]');
        if (pill) {
            const recent = getRecentSearches();
            const idx = parseInt(pill.dataset.recentIdx, 10);
            if (!isNaN(idx) && recent[idx]) {
                const q = recent[idx];
                const input = document.querySelector('.search-input');
                if (input) input.value = q;
                performSearch(q);
            }
        }
    }, { capture: false });
}

export async function performSearch(query) {
    const searchResults = document.getElementById('searchResults');

    if (!query.trim()) {
        searchResults.innerHTML = renderBrowseView();
        attachRecentPillListeners();
        return;
    }

    addRecentSearch(query.trim());

    // Show loading state
    searchResults.innerHTML = '<div class="search-loading"><p>Searching...</p></div>';

    // Try API search first, fall back to local
    let apiSongs = [];
    let apiArtists = [];
    let usedApi = false;

    try {
        const res = await fetch(state.API_BASE + '/search?q=' + encodeURIComponent(query) + '&type=all&limit=24');
        if (res.ok) {
            const data = await res.json();
            apiSongs = (data.songs || []).map(normalizeSong);
            apiArtists = data.artists || [];
            usedApi = true;
        }
    } catch (e) {
        console.log('API search unavailable, falling back to local:', e.message);
    }

    // Local search as fallback
    let localSongs = [];
    const allSongs = [];
    const seenUrls = new Set();
    Object.values(defaultPlaylists).forEach(playlist => {
        playlist.forEach(song => {
            if (!seenUrls.has(song.url)) {
                seenUrls.add(song.url);
                allSongs.push(song);
            }
        });
    });

    const q = query.toLowerCase();
    localSongs = allSongs.filter(song => {
        const title = song.title.toLowerCase();
        const artist = song.artist.toLowerCase();
        if (title.includes(q) || artist.includes(q)) return true;
        const words = q.split(/\s+/);
        const combined = title + ' ' + artist;
        return words.every(w => combined.includes(w));
    });

    // Merge results: API songs first, then local (deduplicated)
    const combinedSongs = [...apiSongs];
    const seenTitles = new Set(apiSongs.map(s => (s.title + '|' + s.artist).toLowerCase()));
    localSongs.forEach(song => {
        const key = (song.title + '|' + song.artist).toLowerCase();
        if (!seenTitles.has(key)) {
            seenTitles.add(key);
            combinedSongs.push(song);
        }
    });

    // Merge artists
    const matchingArtists = [...apiArtists];
    const seenArtistNames = new Set(apiArtists.map(a => a.name.toLowerCase()));
    const seenLocalArtists = new Set();
    localSongs.forEach(song => {
        if (!seenLocalArtists.has(song.artist) && !seenArtistNames.has(song.artist.toLowerCase()) && artistData[song.artist]) {
            seenLocalArtists.add(song.artist);
            matchingArtists.push({ name: song.artist, ...artistData[song.artist] });
        }
    });

    if (combinedSongs.length > 0) {
        state.setLastSearchResults(combinedSongs);
        state.setLastSearchQuery(query.trim());

        let resultsHTML = '';
        const topSong = combinedSongs[0];

        resultsHTML += `<div class="search-top-section">`;

        // Top Result card
        resultsHTML += `
            <div class="top-result-card" onclick="playSearchResult(0)">
                <h3>Top result</h3>
                <img class="top-result-img" src="${encodeURI(topSong.image)}" alt="${escapeHTML(topSong.title)}" onerror="this.src='img/home.svg'">
                <h2 class="top-result-title">${escapeHTML(topSong.title)}</h2>
                <p class="top-result-meta">
                    <span class="top-result-artist">${escapeHTML(topSong.artist)}</span>
                    <span class="top-result-type">Song</span>
                </p>
                <div class="top-result-play">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path d="M7 6v12l10-6z" fill="black"/></svg>
                </div>
            </div>
        `;

        // Songs list (top 4)
        resultsHTML += `<div class="search-songs-list"><h3>Songs</h3>`;
        combinedSongs.slice(0, 4).forEach((song, index) => {
            const mins = Math.floor((song.duration || 0) / 60);
            const secs = ((song.duration || 0) % 60).toString().padStart(2, '0');
            resultsHTML += `
                <div class="track-row" onclick="playSearchResult(${index})" oncontextmenu="showContextMenu(event, window.__lastSearchResults[${index}])">
                    <img class="track-img" src="${encodeURI(song.image)}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                    <div class="track-info">
                        <span class="track-title">${escapeHTML(song.title)}</span>
                        <span class="track-artist">${escapeHTML(song.artist)}</span>
                    </div>
                    <span class="track-duration">${mins}:${secs}</span>
                </div>
            `;
        });
        resultsHTML += `</div></div>`;

        // Artists section
        if (matchingArtists.length > 0) {
            resultsHTML += `<div class="artist-section"><h2>Artists</h2><div class="section-scroll">`;
            matchingArtists.slice(0, 6).forEach(artist => {
                const artistImg = artist.image || 'img/home.svg';
                const artistIdAttr = artist.id ? `data-artist-id="${artist.id}"` : '';
                const clickHandler = artist.id
                    ? `navigate('#/artist/api_${artist.id}')`
                    : `navigate('#/artist/${encodeURIComponent(artist.name)}')`;
                resultsHTML += `
                    <div class="card artist-card" onclick="${clickHandler}" ${artistIdAttr}>
                        <img loading="lazy" src="${encodeURI(artistImg)}" alt="${escapeHTML(artist.name)}" onerror="this.src='img/home.svg'" class="artist-card-img">
                        <h2>${escapeHTML(artist.name)}</h2>
                        <p>Artist</p>
                    </div>
                `;
            });
            resultsHTML += `</div></div>`;
        }

        // All results
        if (combinedSongs.length > 4) {
            resultsHTML += `<div class="artist-section"><h2>All results</h2><div class="cardContainer">`;
            combinedSongs.slice(4).forEach((song, index) => {
                resultsHTML += `
                    <div class="card" onclick="playSearchResult(${index + 4})" oncontextmenu="showContextMenu(event, window.__lastSearchResults[${index + 4}])" data-song-id="${escapeHTML(song.sourceId || song.url || '')}">
                        <div class="img-container">
                        <img src="${encodeURI(song.image)}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                        <div class="play"><svg viewBox="0 0 24 24"><path d="M7 6v12l10-6z" fill="black"/></svg></div>
                    </div>
                        <h2>${escapeHTML(song.title)}</h2>
                        <p>${escapeHTML(song.artist)}</p>
                    </div>
                `;
            });
            resultsHTML += '</div></div>';
        }

        searchResults.innerHTML = resultsHTML;
    } else {
        searchResults.innerHTML = `
            <div class="no-results">
                <h2>No results found for "${escapeHTML(query)}"</h2>
                <p>Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
            </div>
        `;
    }
}

export function searchCategory(category) {
    const cat = searchCategories.find(c => c.name.toLowerCase() === category.toLowerCase());
    if (cat && cat.playlist && defaultPlaylists[cat.playlist]) {
        window.showPlaylistPage(cat.playlist);
    }
}

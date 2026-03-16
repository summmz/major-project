// === Audio Player Module ===
import * as state from './state.js';
import { defaultPlaylists } from './data.js';
import { showToast } from './ui.js';
import { addToRecentlyPlayed, renderQueue } from './playlist.js';
import { initAudioContext, startVisualizer, stopVisualizer } from './visualizer.js';

const audioPlayer = document.getElementById('audioPlayer');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const progress = document.getElementById('progress');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');

export function playSong(index, playlistId) {
    if (playlistId && defaultPlaylists[playlistId]) {
        state.setCurrentPlaylist(defaultPlaylists[playlistId]);
        window.__activePlaylistMeta = null;
    }

    if (state.currentPlaylist.length === 0) return;

    state.setCurrentIndex(index);
    state.setCurrentSong(state.currentPlaylist[state.currentIndex]);

    if (!state.currentSong) return;

    document.getElementById('currentSongTitle').textContent  = state.currentSong.title;
    document.getElementById('currentSongArtist').textContent = state.currentSong.artist;
    document.getElementById('currentSongImage').src          = state.currentSong.image;

    _loadAndPlay(state.currentSong);

    state.setIsPlaying(true);
    updatePlayButton();
    addToRecentlyPlayed(state.currentSong);
    updateLikeUI();
    updateNowPlayingIndicator();
    initAudioContext();
    startVisualizer();
    renderQueue();
    updateMediaSession();
    updateNowPlayingFullscreen();

    if (window.__modules?.gradient) {
        window.__modules.gradient.applyGradientFromImage(state.currentSong.image)
            .then(color => window.__modules.gradient.applyNowPlayingGradient(color));
    }

    _prewarmNext(index);
}

// Load audio and play.
// /api/songs/stream/:videoId proxies audio through our server — no CORS issues.
// On 404/502 (unavailable video) the audio element fires an error event,
// which is caught by setupAudioListeners and triggers nextSong().
async function _loadAndPlay(song) {
    if (!song) return;

    const isYT     = song.source === 'youtube' && song.sourceId;
    const streamUrl = isYT
        ? state.API_BASE + '/songs/stream/' + song.sourceId
        : song.url;

    audioPlayer.src          = streamUrl;
    audioPlayer.playbackRate = state.playbackRate;
    audioPlayer.load();

    try {
        await audioPlayer.play();
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.warn('play() error:', e.name, e.message);
        }
    }
}

function _prewarmNext(currentIndex) {
    const playlist = state.currentPlaylist;
    if (!playlist?.length) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextSong  = playlist[nextIndex];

    if (nextSong?.source === 'youtube' && nextSong?.sourceId) {
        // Fire-and-forget — we don't need the response
        fetch(state.API_BASE + '/songs/preload/' + nextSong.sourceId).catch(() => {});
    }
}

export function togglePlay() {
    if (state.isPlaying) {
        audioPlayer.pause();
        state.setIsPlaying(false);
        stopVisualizer();
    } else {
        audioPlayer.play();
        state.setIsPlaying(true);
        startVisualizer();
    }
    updatePlayButton();
    updateNowPlayingIndicator();
    updateNowPlayingFullscreen();
}

export function updatePlayButton() {
    if (state.isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
    // Sync fullscreen play/pause icons
    const npfPlayIcon = document.getElementById('npfPlayIcon');
    const npfPauseIcon = document.getElementById('npfPauseIcon');
    if (npfPlayIcon && npfPauseIcon) {
        npfPlayIcon.style.display = state.isPlaying ? 'none' : 'block';
        npfPauseIcon.style.display = state.isPlaying ? 'block' : 'none';
    }
}

// Single flag that blocks all concurrent transition attempts.
// Covers both the `ended` event path and the crossfade path.
let _transitioning = false;

export async function nextSong() {
    if (_transitioning) return;
    _transitioning = true;
    try {
        await _doNextSong();
    } finally {
        _transitioning = false;
    }
}

async function _doNextSong() {
    // Check queue first
    if (state.songQueue.length > 0) {
        const nextFromQueue = state.songQueue.shift();
        state.setCurrentSong(nextFromQueue);
        document.getElementById('currentSongTitle').textContent = state.currentSong.title;
        document.getElementById('currentSongArtist').textContent = state.currentSong.artist;
        document.getElementById('currentSongImage').src = state.currentSong.image;
        await _loadAndPlay(state.currentSong);
        state.setIsPlaying(true);
        updatePlayButton();
        addToRecentlyPlayed(state.currentSong);
        updateLikeUI();
        updateNowPlayingIndicator();
        startVisualizer();
        renderQueue();
        updateNowPlayingFullscreen();
        return;
    }
    if (state.currentPlaylist.length === 0) return;

    const nextIndex = state.isShuffled
        ? Math.floor(Math.random() * state.currentPlaylist.length)
        : state.currentIndex + 1;

    if (nextIndex < state.currentPlaylist.length) {
        // Songs still available — advance normally.
        // Pre-fetch when 3 from the end (background, no duplicate guard needed
        // because __fetchMoreSongsInflight handles concurrency in home.js).
        if (state.currentPlaylist.length - nextIndex <= 3 && window.__fetchMoreSongs && window.__activePlaylistMeta) {
            window.__fetchMoreSongs();
        }
        state.setCurrentIndex(nextIndex);
        playSong(state.currentIndex);
        return;
    }

    // Past the end of the playlist
    if (window.__fetchMoreSongs && window.__activePlaylistMeta) {
        // Extendable playlist — fetch and wait. No toast; just play next silently.
        // Snapshot the length BEFORE fetching so we know exactly where new songs start.
        const lengthBefore = state.currentPlaylist.length;
        const added = await window.__fetchMoreSongs();
        if (added > 0) {
            // Play the first newly appended song (right after where the old list ended)
            const firstNewIndex = lengthBefore;
            state.setCurrentIndex(firstNewIndex);
            playSong(firstNewIndex);
        }
        // If added === 0, stop silently. Don't replay current song.
    } else {
        // Static playlist — loop to start
        state.setCurrentIndex(0);
        playSong(0);
    }
}

export function previousSong() {
    if (state.currentPlaylist.length === 0) return;

    if (state.isShuffled) {
        state.setCurrentIndex(Math.floor(Math.random() * state.currentPlaylist.length));
    } else {
        state.setCurrentIndex(state.currentIndex > 0 ? state.currentIndex - 1 : state.currentPlaylist.length - 1);
    }

    playSong(state.currentIndex);
}

export function toggleShuffle() {
    state.setIsShuffled(!state.isShuffled);
    document.getElementById('shuffleBtn').classList.toggle('active', state.isShuffled);
}

export function toggleRepeat() {
    state.setIsRepeated(!state.isRepeated);
    updateRepeatButton();
}

export function updateRepeatButton() {
    const repeatBtn = document.getElementById('repeatBtn');
    const repeatBtnoff = document.getElementById('repeatBtnoff');
    if (state.isRepeated) {
        repeatBtn.style.display = 'block';
        repeatBtnoff.style.display = 'none';
    } else {
        repeatBtn.style.display = 'none';
        repeatBtnoff.style.display = 'block';
    }
}

export function seekSong(event) {
    const progressBar = event.currentTarget;
    const clickX = event.offsetX;
    const width = progressBar.offsetWidth;
    const duration = audioPlayer.duration;

    if (duration) {
        const newTime = (clickX / width) * duration;
        audioPlayer.currentTime = newTime;
    }
}

export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function updateProgressBar() {
    if (state.isDraggingProgress) return;
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = progressPercent + '%';
        const thumb = document.getElementById('progressThumb');
        if (thumb) thumb.style.left = progressPercent + '%';
        currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
        durationSpan.textContent = formatTime(audioPlayer.duration);

        // Sync fullscreen progress bar
        const npfFill = document.getElementById('npfProgressFill');
        const npfCurrent = document.getElementById('npfCurrentTime');
        const npfDuration = document.getElementById('npfDuration');
        if (npfFill) npfFill.style.width = progressPercent + '%';
        if (npfCurrent) npfCurrent.textContent = formatTime(audioPlayer.currentTime);
        if (npfDuration) npfDuration.textContent = formatTime(audioPlayer.duration);
    }
}

export function playPlaylist(playlistId) {
    state.setCurrentPlaylist(defaultPlaylists[playlistId] || []);
    state.setCurrentIndex(0);
    if (state.currentPlaylist.length > 0) {
        playSong(0, playlistId);
    }
}

export function playPlaylistShuffled(playlistId) {
    state.setCurrentPlaylist([...(defaultPlaylists[playlistId] || [])]);
    if (state.currentPlaylist.length === 0) return;
    // Fisher-Yates shuffle
    const pl = state.currentPlaylist;
    for (let i = pl.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pl[i], pl[j]] = [pl[j], pl[i]];
    }
    state.setIsShuffled(true);
    document.getElementById('shuffleBtn').classList.add('active');
    state.setCurrentIndex(0);
    playSong(0);
}

export function playUserPlaylist(index, playlistId) {
    const playlist = state.userPlaylists.find(p => p.id == playlistId);
    if (playlist && playlist.songs.length > 0) {
        state.setCurrentPlaylist(playlist.songs);
        state.setCurrentIndex(index);
        playSong(index);
    }
}

export function playLocalPlaylist(index, localId) {
    try {
        const localPlaylists = JSON.parse(localStorage.getItem('localPlaylists') || '[]');
        const playlist = localPlaylists.find(p => p.id === localId);
        if (playlist && playlist.songs && playlist.songs.length > 0) {
            state.setCurrentPlaylist(playlist.songs);
            state.setCurrentIndex(index);
            playSong(index);
        }
    } catch (e) {
        console.error('Error playing local playlist:', e);
    }
}

export function playArtistSongs(artistName) {
    const allSongs = [];
    const seenUrls = new Set();
    Object.values(defaultPlaylists).forEach(songs => {
        songs.forEach(song => {
            if (song.artist.toLowerCase().includes(artistName.toLowerCase()) && !seenUrls.has(song.url)) {
                seenUrls.add(song.url);
                allSongs.push(song);
            }
        });
    });
    if (allSongs.length > 0) {
        state.setCurrentPlaylist(allSongs);
        state.setCurrentIndex(0);
        playSong(0);
    }
}

export async function playSearchResult(index) {
    if (state.lastSearchResults.length > 0) {
        const song = state.lastSearchResults[index];
        // Put only the clicked song in the playlist so that when it ends,
        // nextSong() immediately fetches related songs instead of playing
        // through the rest of the unrelated search results.
        state.setCurrentPlaylist([song]);
        state.setCurrentIndex(0);
        window.__activePlaylistMeta = {
            type:   'search',
            query:  state.lastSearchQuery || song.title,
            artist: song.artist || '',
        };
        playSong(0);
    }
}

export function playFromLiked(index) {
    state.setCurrentPlaylist(state.likedSongs.map(s => ({...s})));
    state.setCurrentIndex(index);
    playSong(index);
}

export function playPlaylistFromLiked() {
    state.setCurrentPlaylist(state.likedSongs.map(s => ({...s})));
    state.setCurrentIndex(0);
    playSong(0);
}

export function playRecentlyPlayed(index) {
    state.setCurrentPlaylist(state.recentlyPlayed.map(s => ({...s})));
    state.setCurrentIndex(index);
    playSong(index);
}

// Volume controls
export function initializeVolume() {
    audioPlayer.volume = 0.7;
    setVolumeUI(0.7);
    initDraggableVolume();
}

export function setVolumeUI(volume) {
    const pct = (volume * 100) + '%';
    document.getElementById('volumeProgress').style.width = pct;
    const thumb = document.getElementById('volumeThumb');
    if (thumb) thumb.style.left = pct;
    const tooltip = document.getElementById('volumeTooltip');
    if (tooltip) {
        tooltip.textContent = Math.round(volume * 100);
        tooltip.style.left = pct;
    }
    const control = document.querySelector('.volume-control');
    if (volume === 0) {
        control.classList.add('muted');
    } else {
        control.classList.remove('muted');
    }
}

export function changeVolume(event) {
    const volumeBar = document.getElementById('volumeBar');
    const rect = volumeBar.getBoundingClientRect();
    const volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

    audioPlayer.volume = volume;
    setVolumeUI(volume);

    if (volume === 0) {
        state.setIsMuted(true);
    } else {
        state.setIsMuted(false);
        state.setPreviousVolume(volume);
    }
}

export function toggleMute() {
    if (state.isMuted) {
        audioPlayer.volume = state.previousVolume;
        setVolumeUI(state.previousVolume);
        state.setIsMuted(false);
    } else {
        state.setPreviousVolume(audioPlayer.volume);
        audioPlayer.volume = 0;
        setVolumeUI(0);
        state.setIsMuted(true);
    }
}

function initDraggableVolume() {
    const bar = document.getElementById('volumeBar');
    const hoverEl = document.getElementById('volumeHover');
    const tooltip = document.getElementById('volumeTooltip');
    if (!bar) return;

    function updateVolumeDrag(clientX) {
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        audioPlayer.volume = percent;
        setVolumeUI(percent);
        if (percent > 0) { state.setIsMuted(false); state.setPreviousVolume(percent); } else { state.setIsMuted(true); }
        return percent;
    }

    bar.addEventListener('mousedown', (e) => {
        state.setIsDraggingVolume(true);
        bar.classList.add('dragging');
        updateVolumeDrag(e.clientX);
        const onMove = (ev) => updateVolumeDrag(ev.clientX);
        const onUp = () => {
            state.setIsDraggingVolume(false);
            bar.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    bar.addEventListener('mousemove', (e) => {
        if (state.isDraggingVolume) return;
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (hoverEl) hoverEl.style.width = (percent * 100) + '%';
        if (tooltip) {
            tooltip.textContent = Math.round(percent * 100);
            tooltip.style.left = (percent * 100) + '%';
        }
    });
    bar.addEventListener('mouseleave', () => {
        if (hoverEl) hoverEl.style.width = '0%';
    });

    bar.addEventListener('touchstart', (e) => {
        state.setIsDraggingVolume(true);
        bar.classList.add('dragging');
        updateVolumeDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchmove', (e) => {
        if (state.isDraggingVolume) updateVolumeDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchend', () => {
        state.setIsDraggingVolume(false);
        bar.classList.remove('dragging');
    });

    bar.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = e.deltaY > 0 ? -0.05 : 0.05;
        const newVol = Math.max(0, Math.min(1, audioPlayer.volume + step));
        audioPlayer.volume = newVol;
        setVolumeUI(newVol);
        if (newVol > 0) { state.setIsMuted(false); state.setPreviousVolume(newVol); } else { state.setIsMuted(true); }
    }, { passive: false });

    const icon = bar.parentElement.querySelector('svg');
    if (icon) icon.addEventListener('click', toggleMute);
}

// Draggable progress bar
export function initDraggableProgress() {
    const bar = document.getElementById('progressBar');
    const thumb = document.getElementById('progressThumb');
    const tooltip = document.getElementById('seekTooltip');
    if (!bar) return;

    function updateDrag(clientX) {
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        progress.style.width = (percent * 100) + '%';
        if (thumb) thumb.style.left = (percent * 100) + '%';
        if (tooltip && audioPlayer.duration) {
            tooltip.textContent = formatTime(percent * audioPlayer.duration);
            tooltip.style.left = (percent * 100) + '%';
        }
        return percent;
    }

    bar.addEventListener('mousedown', (e) => {
        state.setIsDraggingProgress(true);
        bar.classList.add('dragging');
        updateDrag(e.clientX);
        const onMove = (ev) => updateDrag(ev.clientX);
        const onUp = (ev) => {
            state.setIsDraggingProgress(false);
            bar.classList.remove('dragging');
            const finalPercent = updateDrag(ev.clientX);
            if (audioPlayer.duration) audioPlayer.currentTime = finalPercent * audioPlayer.duration;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    bar.addEventListener('mousemove', (e) => {
        if (state.isDraggingProgress) return;
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (tooltip && audioPlayer.duration) {
            tooltip.textContent = formatTime(percent * audioPlayer.duration);
            tooltip.style.left = (percent * 100) + '%';
        }
    });

    bar.addEventListener('click', (e) => {
        const rect = bar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        if (audioPlayer.duration) audioPlayer.currentTime = percent * audioPlayer.duration;
    });

    bar.addEventListener('touchstart', (e) => {
        state.setIsDraggingProgress(true);
        bar.classList.add('dragging');
        updateDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchmove', (e) => {
        if (state.isDraggingProgress) updateDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchend', (e) => {
        if (state.isDraggingProgress) {
            state.setIsDraggingProgress(false);
            bar.classList.remove('dragging');
            const rect = bar.getBoundingClientRect();
            const touch = e.changedTouches[0];
            const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            if (audioPlayer.duration) audioPlayer.currentTime = percent * audioPlayer.duration;
        }
    });

    // Fullscreen progress bar touch support
    const npfBar = document.getElementById('npfProgressBar');
    if (npfBar) {
        npfBar.addEventListener('click', (e) => {
            const rect = npfBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (audioPlayer.duration) audioPlayer.currentTime = percent * audioPlayer.duration;
        });
    }
}

// Like/Favorite
export function updateLikeUI() {
    const btn = document.getElementById('playerLikeBtn');
    if (!btn) return;
    if (isLiked(state.currentSong)) {
        btn.classList.add('liked');
    } else {
        btn.classList.remove('liked');
    }
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);
}

export function isLiked(song) {
    if (!song) return false;
    // Match by sourceId for YouTube songs, fall back to url for local songs
    if (song.sourceId) {
        return state.likedSongs.some(s => s.sourceId === song.sourceId);
    }
    return state.likedSongs.some(s => s.url && s.url === song.url);
}

export function toggleLikeSong() {
    if (!state.currentSong) return;
    const song = state.currentSong;
    if (isLiked(song)) {
        state.setLikedSongs(state.likedSongs.filter(s =>
            song.sourceId ? s.sourceId !== song.sourceId : s.url !== song.url
        ));
        showToast('Removed from Liked Songs', 'info');
        // Sync unlike to cloud
        if (state.authToken && song.sourceId && song.source) {
            fetch(state.API_BASE + '/user/liked', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + state.authToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: song.sourceId, source: song.source })
            }).catch(e => console.error('Cloud unlike error:', e));
        }
    } else {
        const likedEntry = { title: song.title, artist: song.artist, url: song.url, image: song.image, duration: song.duration };
        if (song.sourceId) likedEntry.sourceId = song.sourceId;
        if (song.source) likedEntry.source = song.source;
        state.likedSongs.push(likedEntry);
        showToast('Added to Liked Songs');
        // Sync like to cloud
        if (state.authToken && song.sourceId && song.source) {
            fetch(state.API_BASE + '/user/liked', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.authToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: song.sourceId, source: song.source, title: song.title, artist: song.artist, image: song.image, duration: song.duration, url: song.url })
            }).catch(e => console.error('Cloud like error:', e));
        }
    }
    saveLikedSongs();
    updateLikeUI();
}

export function loadLikedSongs() {
    try {
        const stored = localStorage.getItem('likedSongs');
        if (stored) state.setLikedSongs(JSON.parse(stored));
    } catch(e) {}
}

export function saveLikedSongs() {
    try { localStorage.setItem('likedSongs', JSON.stringify(state.likedSongs)); } catch(e) {}
}

// Now playing indicator
export function updateNowPlayingIndicator() {
    document.querySelectorAll('.now-playing').forEach(el => el.classList.remove('now-playing'));
    document.querySelectorAll('.now-playing-bars').forEach(el => el.remove());

    if (!state.currentSong) return;

    function markNowPlaying(selector) {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.add('now-playing');
            if (el.classList.contains('card')) {
                const h2 = el.querySelector('h2');
                if (h2 && !h2.querySelector('.now-playing-bars')) {
                    const bars = document.createElement('span');
                    bars.className = 'now-playing-bars' + (state.isPlaying ? '' : ' paused');
                    bars.innerHTML = '<span></span><span></span><span></span><span></span>';
                    h2.appendChild(bars);
                }
            }
        });
    }

    // Match by sourceId (YouTube/API songs)
    if (state.currentSong.sourceId) {
        const escapedId = CSS.escape(state.currentSong.sourceId);
        markNowPlaying(`.card[data-song-id="${escapedId}"]`);
        markNowPlaying(`.track-row[data-song-id="${escapedId}"]`);
    }

    // Match by url (local songs) — skip if url is empty
    if (state.currentSong.url) {
        const escapedUrl = CSS.escape(encodeURI(state.currentSong.url));
        markNowPlaying(`.card[data-song-url="${escapedUrl}"]`);
        markNowPlaying(`.track-row[data-song-url="${escapedUrl}"]`);
    }
}

// Now Playing Fullscreen sync
export function updateNowPlayingFullscreen() {
    const npfTitle = document.getElementById('npfTitle');
    const npfArtist = document.getElementById('npfArtist');
    const npfArt = document.getElementById('npfArt');
    const npfBg = document.getElementById('npfBg');
    const npfLikeBtn = document.getElementById('npfLikeBtn');
    if (!state.currentSong) return;
    if (npfTitle) npfTitle.textContent = state.currentSong.title;
    if (npfArtist) npfArtist.textContent = state.currentSong.artist;
    if (npfArt) npfArt.src = state.currentSong.image;
    if (npfBg) npfBg.style.backgroundImage = `url('${state.currentSong.image}')`;
    if (npfLikeBtn) {
        npfLikeBtn.classList.toggle('liked', isLiked(state.currentSong));
    }
}

// Media Session
export function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.currentSong) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: state.currentSong.title,
        artist: state.currentSong.artist,
        artwork: [{ src: state.currentSong.image, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', () => { audioPlayer.play(); state.setIsPlaying(true); updatePlayButton(); });
    navigator.mediaSession.setActionHandler('pause', () => { audioPlayer.pause(); state.setIsPlaying(false); updatePlayButton(); });
    navigator.mediaSession.setActionHandler('previoustrack', previousSong);
    navigator.mediaSession.setActionHandler('nexttrack', nextSong);
}

// Crossfade
export function setupCrossfadeListener() {
    audioPlayer.addEventListener('timeupdate', () => {
        if (!audioPlayer.duration || state.isRepeated || state.isCrossfading) return;
        const timeLeft = audioPlayer.duration - audioPlayer.currentTime;
        if (state.crossfadeDuration > 0 && timeLeft <= state.crossfadeDuration && timeLeft > 0) {
            crossfadeToNext();
        }
    });
}

function crossfadeToNext() {
    // Block if already transitioning (either crossfade or nextSong in progress)
    if (state.isCrossfading || _transitioning) return;

    const hasQueue    = state.songQueue.length > 0;
    const atEnd       = !hasQueue && (state.currentIndex + 1) >= state.currentPlaylist.length;
    const canExtend   = atEnd && window.__activePlaylistMeta && window.__fetchMoreSongs;
    const noNextSong  = !hasQueue && state.currentPlaylist.length <= 1 && !canExtend;

    if (noNextSong) return;

    // Mark as crossfading immediately so timeupdate doesn't call us again
    state.setIsCrossfading(true);

    // If at the end of an extendable playlist, delegate to nextSong (which
    // will fetch more). Clear isCrossfading when it's done.
    if (canExtend) {
        nextSong().finally(() => state.setIsCrossfading(false));
        return;
    }

    const audioB = document.getElementById('audioPlayerB');
    let nextSongData;

    if (state.songQueue.length > 0) {
        nextSongData = state.songQueue.shift();
    } else if (state.currentPlaylist.length > 0) {
        const nextIdx = state.isShuffled ? Math.floor(Math.random() * state.currentPlaylist.length) : (state.currentIndex + 1) % state.currentPlaylist.length;
        nextSongData = state.currentPlaylist[nextIdx];
        state.setCurrentIndex(nextIdx);
    }

    if (!nextSongData) { state.setIsCrossfading(false); return; }

    const cfUrl = nextSongData.source === 'youtube' && nextSongData.sourceId
        ? state.API_BASE + '/songs/stream/' + nextSongData.sourceId
        : nextSongData.url;
    audioB.src = cfUrl; // crossfade uses redirect — proxy fallback not needed here
    audioB.volume = 0;
    audioB.play().catch(e => { console.error(e); state.setIsCrossfading(false); });

    const startVol = audioPlayer.volume;
    const steps = 30;
    let step = 0;
    const interval = (state.crossfadeDuration * 1000) / steps;

    if (state.crossfadeTimer) clearInterval(state.crossfadeTimer);
    state.setCrossfadeTimer(setInterval(() => {
        step++;
        const prog = step / steps;
        audioPlayer.volume = startVol * (1 - prog);
        audioB.volume = startVol * prog;

        if (step >= steps) {
            clearInterval(state.crossfadeTimer);
            audioPlayer.pause();
            audioPlayer.src = audioB.src;
            audioPlayer.currentTime = audioB.currentTime;
            audioPlayer.volume = startVol;
            audioPlayer.play().catch(e => console.error(e));
            audioB.pause();
            audioB.src = '';

            state.setCurrentSong(nextSongData);
            document.getElementById('currentSongTitle').textContent = state.currentSong.title;
            document.getElementById('currentSongArtist').textContent = state.currentSong.artist;
            document.getElementById('currentSongImage').src = state.currentSong.image;
            state.setIsPlaying(true);
            updatePlayButton();
            addToRecentlyPlayed(state.currentSong);
            updateLikeUI();
            updateNowPlayingIndicator();
            renderQueue();
            state.setIsCrossfading(false);
            updateNowPlayingFullscreen();

            // Update gradient for crossfaded song
            if (window.__modules && window.__modules.gradient) {
                window.__modules.gradient.applyGradientFromImage(state.currentSong.image).then(color => {
                    window.__modules.gradient.applyNowPlayingGradient(color);
                });
            }
        }
    }, interval));
}

// Playback speed
export function cyclePlaybackSpeed() {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIdx = speeds.indexOf(state.playbackRate);
    state.setPlaybackRate(speeds[(currentIdx + 1) % speeds.length]);
    audioPlayer.playbackRate = state.playbackRate;
    updateSpeedDisplay();
    showToast(`Playback speed: ${state.playbackRate}x`);
}

export function updateSpeedDisplay() {
    const btn = document.getElementById('speedBtn');
    if (btn) {
        btn.textContent = state.playbackRate + 'x';
        btn.classList.toggle('active', state.playbackRate !== 1.0);
    }
}

// Playback state persistence
export function savePlaybackState() {
    try {
        const s = {
            currentSong: state.currentSong,
            currentPlaylist: state.currentPlaylist,
            currentIndex: state.currentIndex,
            currentTime: audioPlayer.currentTime,
            volume: audioPlayer.volume,
            isShuffled: state.isShuffled,
            isRepeated: state.isRepeated,
            playbackRate: state.playbackRate
        };
        localStorage.setItem('playbackState', JSON.stringify(s));
    } catch(e) {}
}

export function restorePlaybackState() {
    try {
        const stored = localStorage.getItem('playbackState');
        if (!stored) return;
        const s = JSON.parse(stored);
        if (s.currentSong && s.currentPlaylist) {
            state.setCurrentSong(s.currentSong);
            state.setCurrentPlaylist(s.currentPlaylist);
            state.setCurrentIndex(s.currentIndex || 0);
            state.setIsShuffled(s.isShuffled || false);
            state.setIsRepeated(s.isRepeated || false);
            state.setPlaybackRate(s.playbackRate || 1.0);

            document.getElementById('currentSongTitle').textContent = state.currentSong.title;
            document.getElementById('currentSongArtist').textContent = state.currentSong.artist;
            document.getElementById('currentSongImage').src = state.currentSong.image;

            const restoreUrl = state.currentSong.source === 'youtube' && state.currentSong.sourceId
                ? state.API_BASE + '/songs/stream/' + state.currentSong.sourceId
                : state.currentSong.url;
            audioPlayer.src = restoreUrl; // restore after crossfade
            audioPlayer.currentTime = s.currentTime || 0;
            audioPlayer.volume = s.volume ?? 0.7;
            audioPlayer.playbackRate = state.playbackRate;
            setVolumeUI(audioPlayer.volume);

            document.getElementById('shuffleBtn').classList.toggle('active', state.isShuffled);
            updateRepeatButton();
            updateLikeUI();
            updateSpeedDisplay();
            updateNowPlayingFullscreen();

            // Restore gradient
            if (window.__modules && window.__modules.gradient) {
                window.__modules.gradient.applyGradientFromImage(state.currentSong.image);
            }
        }
    } catch(e) { console.error('Restore state failed:', e); }
}

// Sleep Timer
export function setSleepTimerDuration(minutes) {
    clearSleepTimer();
    if (minutes <= 0) return;
    state.setSleepTimerRemaining(minutes * 60);
    showToast(`Sleep timer set for ${minutes} min`);
    document.getElementById('sleepTimerBtn').classList.add('active');
    state.setSleepTimerInterval(setInterval(() => {
        state.setSleepTimerRemaining(state.sleepTimerRemaining - 1);
        if (state.sleepTimerRemaining <= 0) {
            clearSleepTimer();
            audioPlayer.pause();
            state.setIsPlaying(false);
            updatePlayButton();
            stopVisualizer();
            showToast('Sleep timer ended. Goodnight!', 'info');
        }
    }, 1000));
}

export function clearSleepTimer() {
    if (state.sleepTimerInterval) clearInterval(state.sleepTimerInterval);
    state.setSleepTimerInterval(null);
    state.setSleepTimerRemaining(0);
    const btn = document.getElementById('sleepTimerBtn');
    if (btn) btn.classList.remove('active');
}

export function showSleepTimerMenu() {
    const panel = document.getElementById('sleepTimerPanel');
    if (!panel) return;
    panel.classList.toggle('open');
    document.getElementById('sleepTimerBtn').classList.toggle('active', panel.classList.contains('open'));
}

// Share
export function shareSong() {
    if (!state.currentSong) { showToast('No song playing', 'info'); return; }
    const shareText = `🎵 ${state.currentSong.title} by ${state.currentSong.artist}`;
    if (navigator.share) {
        navigator.share({ title: state.currentSong.title, text: shareText }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => showToast('Song info copied to clipboard!'));
    } else {
        showToast('Sharing not supported on this browser', 'error');
    }
}

// Mini player
export function toggleMiniPlayer() {
    document.querySelector('.playbar').classList.toggle('mini');
    document.getElementById('miniPlayerToggle').classList.toggle('active');
}

// Setup audio event listeners
export function setupAudioListeners() {
    const repeatBtn = document.getElementById('repeatBtn');
    const repeatBtnoff = document.getElementById('repeatBtnoff');
    if (repeatBtn && repeatBtnoff) {
        repeatBtn.addEventListener('click', toggleRepeat);
        repeatBtnoff.addEventListener('click', toggleRepeat);
    }

    document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('ended', () => {
        if (state.isRepeated) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            return;
        }
        if (state.isCrossfading) return; // crossfade will handle the transition

        // If a transition is already in progress (e.g. crossfade triggered nextSong
        // 3 s early and is awaiting canplay), do nothing — that call will play the
        // next song once the buffer is ready.
        if (_transitioning) return;

        nextSong();
    });

    // Auto-skip unavailable videos (404/502 from stream endpoint)
    audioPlayer.addEventListener('error', () => {
        if (!audioPlayer.src || audioPlayer.src === window.location.href) return;
        const song = state.currentSong;
        if (song?.source === 'youtube') {
            console.warn('Audio error — skipping unavailable video:', song.title);
            nextSong();
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        durationSpan.textContent = formatTime(audioPlayer.duration);
    });

    setInterval(savePlaybackState, 5000);
    window.addEventListener('beforeunload', savePlaybackState);

    audioPlayer.addEventListener('play', () => {
        state.setIsPlaying(true);
        updatePlayButton();
    });

    audioPlayer.addEventListener('pause', () => {
        // Ignore pause events that fire while we are loading the next song
        // (changing audioPlayer.src always fires a pause event)
        if (_transitioning) return;
        state.setIsPlaying(false);
        updatePlayButton();
    });
}

export { audioPlayer };

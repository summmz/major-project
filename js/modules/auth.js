// === Auth Module — JWT Custom Backend ===
import * as state from './state.js';
import { showToast } from './ui.js';
import { loadUserPlaylists, mergeCloudRecentlyPlayed, renderRecentlyPlayed } from './playlist.js';
import { updateTimeGreeting } from './navigation.js';
import { escapeHTML } from './data.js';

// === JWT Auth Functions ===

export function openLogin() {
    document.getElementById('authModal').classList.add('active');
    showAuthTab('login');
}

export function openSignup() {
    document.getElementById('authModal').classList.add('active');
    showAuthTab('signup');
}

export function showAuthTab(tab) {
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('authTabSignup').classList.toggle('active', tab === 'signup');
}

export function loginWithGoogle() {
    const client = google.accounts.oauth2.initCodeClient({
        client_id: '868057781305-ont8vo9pcok0ro3ckeg5hsb83vokt8j4.apps.googleusercontent.com', // User needs to replace this
        scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
        ux_mode: 'popup',
        callback: async (response) => {
            if (response.code) {
                try {
                    showToast('Logging in with Google...', 'info');
                    const res = await fetch(state.API_BASE + '/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: response.code })
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        showToast(data.error || 'Google login failed', 'error');
                        return;
                    }

                    // Store token
                    state.setAuthToken(data.token);
                    localStorage.setItem('authToken', data.token);

                    state.setCurrentUser({ 
                        id: data.user.id, 
                        email: data.user.email, 
                        name: data.user.name,
                        image: data.user.image 
                    });
                    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

                    showUserProfile();
                    updateTimeGreeting();
                    window.__modules.ui.closeModal('authModal');
                    showToast('Welcome, ' + data.user.name + '!');

                    // Load user data and recommendations
                    await loadUserDataFromBackend();
                    if (window.__modules.home) {
                        window.__modules.home.renderHomeFeed();
                    }
                } catch (e) {
                    console.error('Google login error:', e);
                    showToast('Failed to connect to backend', 'error');
                }
            }
        },
    });
    client.requestCode();
}

export async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = event.target.querySelector('button[type="submit"]');

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    btn.textContent = 'Logging in...';
    btn.disabled = true;

    try {
        const res = await fetch(state.API_BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Login failed', 'error');
            return;
        }

        // Store token
        state.setAuthToken(data.token);
        localStorage.setItem('authToken', data.token);

        state.setCurrentUser({ id: data.user.id, email: data.user.email, name: data.user.name });
        localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

        showUserProfile();
        updateTimeGreeting();
        window.__modules.ui.closeModal('authModal');
        showToast('Welcome back, ' + data.user.name + '!');

        // Load user data from backend
        await loadUserDataFromBackend();
    } catch (e) {
        console.error('Login error:', e);
        showToast('Network error. Is the backend running?', 'error');
    } finally {
        btn.textContent = 'Log In';
        btn.disabled = false;
    }
}

export async function handleSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const btn = event.target.querySelector('button[type="submit"]');

    if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    btn.textContent = 'Creating account...';
    btn.disabled = true;

    try {
        const res = await fetch(state.API_BASE + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Registration failed', 'error');
            return;
        }

        state.setAuthToken(data.token);
        localStorage.setItem('authToken', data.token);

        state.setCurrentUser({ id: data.user.id, email: data.user.email, name: data.user.name });
        localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

        showUserProfile();
        updateTimeGreeting();
        window.__modules.ui.closeModal('authModal');
        showToast('Account created! Welcome, ' + data.user.name + '!');
    } catch (e) {
        console.error('Signup error:', e);
        showToast('Network error. Is the backend running?', 'error');
    } finally {
        btn.textContent = 'Sign Up';
        btn.disabled = false;
    }
}

export function logout() {
    state.setAuthToken(null);
    state.setCurrentUser(null);
    state.setUserPlaylists([]);
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userProfile').style.display = 'none';
    loadUserPlaylists();
    updateTimeGreeting();
    showToast('Logged out', 'info');
    // Refresh home feed so recommendations reflect logged-out taste
    if (window.__modules?.home?.renderHomeFeed) {
        window.__modules.home.renderHomeFeed();
    }
}

export function getAuthToken() {
    return state.authToken;
}

function showUserProfile() {
    document.getElementById('authButtons').style.display = 'none';
    // Refresh home feed recommendations now that user is logged in
    setTimeout(() => {
        if (window.__modules?.home?.renderHomeFeed) {
            window.__modules.home.renderHomeFeed();
        }
    }, 500); // slight delay so user data loads first
    const profileContainer = document.getElementById('userProfile');
    profileContainer.style.display = 'flex';
    
    if (state.currentUser) {
        document.getElementById('userName').textContent = state.currentUser.name;
        const avatar = document.getElementById('userAvatar');
        if (avatar) avatar.textContent = state.currentUser.name.charAt(0).toUpperCase();
    }
}

async function loadUserDataFromBackend() {
    try {
        const token = getAuthToken();
        if (!token) return;

        // Load playlists, liked songs, and recently played in parallel
        const [playlistsRes, likedRes, recentRes] = await Promise.all([
            fetch(state.API_BASE + '/user/playlists', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(state.API_BASE + '/user/liked', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(state.API_BASE + '/user/recently-played', { headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        if (playlistsRes.ok) {
            const data = await playlistsRes.json();
            state.setUserPlaylists(data.playlists || []);
            loadUserPlaylists();
        }

        if (likedRes.ok) {
            const data = await likedRes.json();
            if (data.likedSongs && data.likedSongs.length > 0) {
                // Merge cloud liked songs with local — cloud takes priority
                state.setLikedSongs(data.likedSongs.map(s => ({
                    title: s.title,
                    artist: s.artist,
                    url: s.url,
                    image: s.image,
                    duration: s.duration,
                    sourceId: s.sourceId,
                    source: s.source
                })));
            }
        }

        if (recentRes.ok) {
            const data = await recentRes.json();
            // Merge cloud history with local — keeps local entries that aren't
            // in the cloud yet (e.g. played while offline), deduplicates by sourceId,
            // saves back to localStorage, and re-renders the section.
            if (data.recentlyPlayed?.length > 0) {
                mergeCloudRecentlyPlayed(data.recentlyPlayed);
            }
        }
    } catch (e) {
        console.error('Failed to load user data:', e);
    }
}

// Setup auth — restore session from localStorage
export function setupAuthListeners() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        try {
            state.setAuthToken(savedToken);
            state.setCurrentUser(JSON.parse(savedUser));
            showUserProfile();
            updateTimeGreeting();
            
            // Re-render home feed once user is restored so recommendations show up
            if (window.__modules.home) {
                window.__modules.home.renderHomeFeed();
            }

            // Load user data in background
            loadUserDataFromBackend().catch(e => console.error('Background load error:', e));
        } catch (e) {
            // Invalid stored data — clear it
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    }
}

// === Playlist CRUD (kept compatible with existing code) ===

export function createPlaylist() {
    document.getElementById('createPlaylistModal').classList.add('active');
}

export function addSong() {
    const select = document.getElementById('targetPlaylist');
    select.innerHTML = '<option value="">Select a playlist</option>';

    // Add local playlists
    const localPlaylists = getLocalPlaylists();
    localPlaylists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = 'local_' + playlist.id;
        option.textContent = playlist.name + ' (Local)';
        select.appendChild(option);
    });

    // Add user playlists if logged in
    state.userPlaylists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist._id || playlist.id;
        option.textContent = playlist.name + ' (Cloud)';
        select.appendChild(option);
    });

    // Add "Create New Local Playlist" option
    const newOpt = document.createElement('option');
    newOpt.value = '__new_local__';
    newOpt.textContent = '+ Create New Local Playlist';
    select.appendChild(newOpt);

    document.getElementById('addSongModal').classList.add('active');
}

export async function addSongToPlaylist(event) {
    event.preventDefault();

    const title = document.getElementById('songTitle').value;
    const artist = document.getElementById('songArtist').value;
    const audioFile = document.getElementById('songFile').files[0];
    const imageFile = document.getElementById('songImage').files[0];
    const playlistId = document.getElementById('targetPlaylist').value;

    if (!audioFile) {
        showToast('Please select an audio file', 'error');
        return;
    }

    if (!playlistId) {
        showToast('Please select a playlist', 'error');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    try {
        // Handle "Create New Local Playlist" option
        if (playlistId === '__new_local__') {
            const name = prompt('Enter playlist name:');
            if (!name) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }
            createLocalPlaylist(name, '');
        }

        // Handle local playlist
        if (playlistId.startsWith('local_') || playlistId === '__new_local__') {
            const duration = await getAudioDuration(audioFile);
            const audioUrl = URL.createObjectURL(audioFile);
            let imageUrl = 'img/home.svg';
            if (imageFile) {
                imageUrl = URL.createObjectURL(imageFile);
            }

            const song = {
                title: title || audioFile.name.replace(/\.[^/.]+$/, ''),
                artist: artist || 'Unknown Artist',
                url: audioUrl,
                image: imageUrl,
                duration: duration,
                isLocal: true,
                fileName: audioFile.name
            };

            let localId;
            if (playlistId === '__new_local__') {
                const playlists = getLocalPlaylists();
                localId = playlists[playlists.length - 1].id;
            } else {
                localId = playlistId.replace('local_', '');
            }

            addSongToLocalPlaylist(localId, song);
            storeLocalAudio(song.fileName, audioFile, imageFile);

            clearSongForm();
            window.__modules.ui.closeModal('addSongModal');
            showToast('Song added successfully!');
            loadUserPlaylists();
            return;
        }

        // Cloud playlist — add song to backend user playlist
        if (state.authToken) {
            const duration = await getAudioDuration(audioFile);
            const audioUrl = URL.createObjectURL(audioFile);
            let imageUrl = 'img/home.svg';
            if (imageFile) {
                imageUrl = URL.createObjectURL(imageFile);
            }

            const song = {
                sourceId: 'local_' + Date.now(),
                source: 'local',
                title: title || audioFile.name.replace(/\.[^/.]+$/, ''),
                artist: artist || 'Unknown Artist',
                image: imageUrl,
                duration: duration,
                url: audioUrl
            };

            // Add to backend playlist
            const res = await fetch(state.API_BASE + '/user/playlists/' + playlistId, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + state.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ addSong: song })
            });

            if (res.ok) {
                const data = await res.json();
                // Update local state
                const idx = state.userPlaylists.findIndex(p => (p._id || p.id) === playlistId);
                if (idx !== -1) {
                    state.userPlaylists[idx] = data.playlist;
                }
                loadUserPlaylists();
                clearSongForm();
                window.__modules.ui.closeModal('addSongModal');
                showToast('Song added!');
            } else {
                showToast('Failed to add song to cloud playlist', 'error');
            }
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('Failed to add song. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function clearSongForm() {
    document.getElementById('songTitle').value = '';
    document.getElementById('songArtist').value = '';
    document.getElementById('songFile').value = '';
    document.getElementById('songImage').value = '';
    document.getElementById('targetPlaylist').value = '';
}

export async function saveNewPlaylist(event) {
    event.preventDefault();
    const name = document.getElementById('playlistName').value;
    const description = document.getElementById('playlistDescription').value;

    // If not logged in, create local playlist
    if (!state.currentUser) {
        saveNewLocalPlaylist(event);
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
        const token = getAuthToken();
        if (!token) {
            saveNewLocalPlaylist(event);
            return;
        }

        const res = await fetch(state.API_BASE + '/user/playlists', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (res.ok) {
            const data = await res.json();
            state.userPlaylists.push(data.playlist);
            loadUserPlaylists();
            window.__modules.ui.closeModal('createPlaylistModal');
            document.getElementById('playlistName').value = '';
            document.getElementById('playlistDescription').value = '';
            showToast('Playlist created!');
        } else {
            const error = await res.json();
            showToast(error.error || 'Failed to create playlist', 'error');
        }
    } catch (e) {
        console.error('Error creating playlist:', e);
        showToast('Failed to create playlist. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function getAudioDuration(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);
        audio.addEventListener('loadedmetadata', () => {
            resolve(Math.floor(audio.duration));
            URL.revokeObjectURL(objectUrl);
        });
        audio.addEventListener('error', () => {
            resolve(0);
            URL.revokeObjectURL(objectUrl);
        });
        audio.src = objectUrl;
    });
}

// === Local Playlist Management (no login required) ===

export function getLocalPlaylists() {
    try {
        const stored = localStorage.getItem('localPlaylists');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveLocalPlaylists(playlists) {
    try {
        localStorage.setItem('localPlaylists', JSON.stringify(playlists));
    } catch (e) {
        console.error('Failed to save local playlists:', e);
    }
}

export function createLocalPlaylist(name, description) {
    const playlists = getLocalPlaylists();
    const newPlaylist = {
        id: 'lp_' + Date.now(),
        name: name,
        description: description || '',
        songs: [],
        isLocal: true
    };
    playlists.push(newPlaylist);
    saveLocalPlaylists(playlists);
    loadUserPlaylists();
    return newPlaylist;
}

export function addSongToLocalPlaylist(localId, song) {
    const playlists = getLocalPlaylists();
    const playlist = playlists.find(p => p.id === localId);
    if (!playlist) return;

    playlist.songs.push({
        title: song.title,
        artist: song.artist,
        url: song.url,
        image: song.image,
        duration: song.duration,
        isLocal: true,
        fileName: song.fileName
    });

    saveLocalPlaylists(playlists);
}

export function deleteLocalPlaylist(localId) {
    let playlists = getLocalPlaylists();
    playlists = playlists.filter(p => p.id !== localId);
    saveLocalPlaylists(playlists);
    loadUserPlaylists();
}

// IndexedDB for storing audio files persistently
function openLocalDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SpotifyCloneLocalSongs', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('audioFiles')) {
                db.createObjectStore('audioFiles', { keyPath: 'fileName' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeLocalAudio(fileName, audioFile, imageFile) {
    try {
        const db = await openLocalDB();
        const tx = db.transaction('audioFiles', 'readwrite');
        const store = tx.objectStore('audioFiles');

        const audioBuffer = await audioFile.arrayBuffer();
        const entry = {
            fileName,
            audioData: audioBuffer,
            audioType: audioFile.type
        };

        if (imageFile) {
            entry.imageData = await imageFile.arrayBuffer();
            entry.imageType = imageFile.type;
        }

        store.put(entry);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    } catch (e) {
        console.error('Failed to store audio in IndexedDB:', e);
    }
}

export async function restoreLocalSongUrls() {
    try {
        const db = await openLocalDB();
        const playlists = getLocalPlaylists();
        let updated = false;

        for (const playlist of playlists) {
            for (const song of playlist.songs) {
                if (!song.isLocal || !song.fileName) continue;

                const tx = db.transaction('audioFiles', 'readonly');
                const store = tx.objectStore('audioFiles');
                const request = store.get(song.fileName);

                const entry = await new Promise((resolve) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => resolve(null);
                });

                if (entry) {
                    const audioBlob = new Blob([entry.audioData], { type: entry.audioType });
                    song.url = URL.createObjectURL(audioBlob);

                    if (entry.imageData) {
                        const imageBlob = new Blob([entry.imageData], { type: entry.imageType });
                        song.image = URL.createObjectURL(imageBlob);
                    }
                    updated = true;
                }
            }
        }

        if (updated) {
            saveLocalPlaylists(playlists);
        }
    } catch (e) {
        console.error('Failed to restore local song URLs:', e);
    }
}

export function saveNewLocalPlaylist(event) {
    event.preventDefault();
    const name = document.getElementById('playlistName').value;
    const description = document.getElementById('playlistDescription').value;

    if (!name) {
        showToast('Please enter a playlist name', 'error');
        return;
    }

    createLocalPlaylist(name, description);
    window.__modules.ui.closeModal('createPlaylistModal');
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistDescription').value = '';
    showToast('Local playlist created!');
}

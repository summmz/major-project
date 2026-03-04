function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let currentUser = null;
let userPlaylists = [];
let currentSong = null;
let isPlaying = false;
let currentPlaylist = [];
let currentIndex = 0;
let isShuffled = false;
let navigationHistory = ['home'];
let currentHistoryIndex = 0;
let isMuted = false;
let previousVolume = 0.7;
let isRepeated = false;
let lastSearchResults = [];
let searchDebounceTimer = null;

// === New Feature Globals ===
let recentlyPlayed = [];
const MAX_RECENT = 20;
let isDraggingProgress = false;
let likedSongs = [];
let songQueue = [];
let isQueueOpen = false;
let audioContext = null;
let analyserNode = null;
let sourceNode = null;
let visualizerAnimationId = null;
let eqFilters = [];
let eqIsOpen = false;
let isLyricsOpen = false;
let crossfadeDuration = 3;
let crossfadeTimer = null;
let isCrossfading = false;
let activePlayer = 'A';
let contextMenuSong = null;

function debouncedSearch(value) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => performSearch(value), 300);
}

// === TOAST NOTIFICATIONS (Feature 13) ===
function showToast(message, type = 'success', duration = 3000) {
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

const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const progress = document.getElementById('progress');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');

const _placeholderSongs = [
    {
        title: "Blinding Lights",
        artist: "The Weeknd",
        url: "songs/Blinding Lights (PenduJatt.Com.Se).mp3",
        image: "img/TW.jpeg",
        duration: 200
    },
    {
        title: "Good 4 U",
        artist: "Olivia Rodrigo",
        url: "songs/Good 4 U (PenduJatt.Com.Se).mp3",
        image: "img/olivia rodrigo.jpeg",
        duration: 178
    },
    {
        title: "Levitating",
        artist: "Dua Lipa",
        url: "songs/Levitating (PenduJatt.Com.Se).mp3",
        image: "img/Future Nostalgia Dua Lipa.jpeg",
        duration: 203
    }
];

const defaultPlaylists = {
    popular: [
        {
            title: "2-2 Asle",
            artist: "Arjan Dhillon",
            url: "songs/2-2 Asle - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 228
        },
        {
            title: "8 Asle",
            artist: "Sukha",
            url: "songs/8 ASLE.mp3",
            image: "img/undisputed sukha.jpeg",
            duration: 391
        },
        {
            title: "Blinding Lights",
            artist: "The Weeknd",
            url: "songs/Blinding Lights (PenduJatt.Com.Se).mp3",
            image: "img/TW.jpeg",
            duration: 200
        }
        ,
        {
            title: "I Really Do",
            artist: "Karan Aujla",
            url: "songs/I Really Do.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        }
        ,
        {
            title: "Good 4 U",
            artist: "Olivia Rodrigo",
            url: "songs/Good 4 U (PenduJatt.Com.Se).mp3",
            image: "img/olivia rodrigo.jpeg",
            duration: 178
        },
        {
            title: "Levitating",
            artist: "Dua Lipa",
            url: "songs/Levitating (PenduJatt.Com.Se).mp3",
            image: "img/Future Nostalgia Dua Lipa.jpeg",
            duration: 203
        },
        {
            title: "Lost",
            artist: "Tegi Pannu",
            url: "songs/Lost.mp3",
            image: "img/Lost-1.jpg",
            duration: 391
        },
        {
            title: "Paro",
            artist: "Aditya Rikhari",
            url: "songs/Aditya Rikhari - Paro Song (Lyrics).mp3",
            image: "img/55555.jpeg",
            duration: 178
        }
    ],
    chill: [
        {
            title: "Sunset Lover",
            artist: "Petit Biscuit",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/d4dff2dd-2499-4d47-902e-a64167d3d211.jpeg",
            duration: 245
        },
        {
            title: "Ocean Eyes",
            artist: "Billie Eilish",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/dfee06b2-6930-4ff3-84ce-6ccae57dc0ba.jpeg",
            duration: 200
        }
    ],
    rock: [
        {
            title: "Bohemian Rhapsody",
            artist: "Queen",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/d093430b-85af-447e-869d-dec87b1f1964.jpeg",
            duration: 355
        },
        {
            title: "Hotel California",
            artist: "Eagles",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/download (1).jpeg",
            duration: 391
        }
    ],
    jazz: [
        {
            title: "Take Five",
            artist: "Dave Brubeck",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/Undercurrent-768x768 (1).jpg",
            duration: 324
        }
    ],
    workout: [
        {
            title: "Good For You x One Of The Girls",
            artist: "Selena Gomez, The Weeknd",
            url: "songs/Good For You x One Of The Girls - Selena Gomez, The Weeknd (Lyrics  Vietsub).mp3",
            image: "img/ab67616d0000b273952d04c1fb47635158f28fb2.jpeg",
            duration: 228
        },
        {
            title: "Love Potions X Tipsy",
            artist: " bjlips & miss luxury",
            url: "songs/Love Potions X Tipsy - bjlips & miss luxury (mashup).mp3",
            image: "img/ab67616d0000b273c24be873e625679f2ac1062a.jpeg",
            duration: 391
        },
        {
            title: "Motive X Promiscuous",
            artist: "Ariana Grande, Nelly Furtado",
            url: "songs/Ariana Grande, Nelly Furtado - Motive X Promiscuous (TikTok Mashup) [Lyrics].mp3",
            image: "img/1111.jpeg",
            duration: 246
        },


        {
            title: "Mind Games",
            artist: "Sickick",
            url: "songs/Sickick - Mind Games (Official Video).mp3",
            image: "img/22222.jpeg",
            duration: 391
        },
        {
            title: "Supernova Love",
            artist: "IVE, David Guetta",
            url: "songs/IVE, David Guetta - Supernova Love (Official Lyric Video).mp3",
            image: "img/3333.jpeg",
            duration: 391
        }
    ],
    indie: [
        {
            title: "Electric Feel",
            artist: "MGMT",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/Slow Magic - Your Heart Beatsâ€¦.jpeg",
            duration: 228
        }
    ],
    Punjabi: [
        {
            title: "2-2 Asle",
            artist: "Arjan Dhillon",
            url: "songs/2-2 Asle - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 228
        },
        {
            title: "8 Asle",
            artist: "Sukha",
            url: "songs/8 ASLE.mp3",
            image: "img/undisputed sukha.jpeg",
            duration: 391
        },
        {
            title: "Brats",
            artist: "Arjan Dhillon",
            url: "songs/Brats - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 391
        },
        {
            title: "Daytona",
            artist: "Karan Aujla",
            url: "songs/Karan Aujla - Daytona (Official Audio).mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "For a Reason",
            artist: "Karan Aujla",
            url: "songs/For A Reason - Karan Aujla.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "Foreigns",
            artist: "Gurinder Gill",
            url: "songs/Foreigns - AP Dhillon.mp3",
            image: "img/592x592bb.webp",
            duration: 391
        },
        {
            title: "Greatest",
            artist: "Arjan Dhillon",
            url: "songs/Greatest - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 391
        },
        {
            title: "I Really Do",
            artist: "Karan Aujla",
            url: "songs/I Really Do.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "Lost",
            artist: "Tegi Pannu",
            url: "songs/Lost.mp3",
            image: "img/Lost-1.jpg",
            duration: 391
        },


        {
            title: "Miami Flow",
            artist: "Jerry",
            url: "songs/Miami Flow - DjPunjab.Com.Se.mp3",
            image: "img/thumb_663c9918e9247.webp",
            duration: 391
        },
        {
            title: "Old Skool",
            artist: "Sidhu Moose Wala",
            url: "songs/Old Skool.mp3",
            image: "img/Old-Skool-1.jpg",
            duration: 391
        },
        {
            title: "Take it Easy",
            artist: "Karan Aujla",
            url: "songs/Take It Easy.mp3",
            image: "img/592x592bb (1).webp",
            duration: 391
        },
    ],
    SabrinaSessions: [
        {
            title: "Alien M-22 Remix",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter, Jonas Blue - Alien (M-22 Remix_Audio Only) [7IdnVykSZqk].mp3",
            image: "img/sabrina.jpeg",
            duration: 200
        },
        {
            title: "Bed Chem",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Bed Chem (Official Lyric Video).mp3",
            image: "img/Gonna miss this era.jpeg",
            duration: 178
        },
        {
            title: "Espresso",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Espresso (Official Audio).mp3",
            image: "img/Instagram.jpeg",
            duration: 203
        },
        {
            title: "Nonsense",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Nonsense (Official Audio).mp3",
            image: "img/425dae9c-3fef-415e-8857-e0604c1c4022.jpeg",
            duration: 203
        }
    ],
    SereneRoads: [
        

        {
            title: "Baby Come back",
            artist: "Player",
            url: "songs/Player - Baby Come Back.mp3",
            image: "img/77777.jpeg",
            duration: 203
        },

        {
            title: "Break from toronto",
            artist: "PARTYNEXTDOOR",
            url: "songs/PARTYNEXTDOOR - Break From Toronto.mp3",
            image: "img/0000.jpeg",
            duration: 203
        },
        {
            title: "By my Side",
            artist: "Zack Tabudlo",
            url: "songs/Zack Tabudlo - By My Side ft. Tiara Andini.mp3",
            image: "img/23232.jpeg",
            duration: 203
        },

        {
            title: "Intermission (Lost Tapes 2020)",
            artist: "Tory Lanez",
            url: "songs/Tory Lanez - Intermission (Lost Tapes 2020) (AUDIO).mp3",
            image: "img/12212.jpeg",
            duration: 203
        },
        {
            title: "Life is a Highway",
            artist: "Rascal Flatts",
            url: "songs/Cars (Soundtrack) - Life Is A Highway.mp3",
            image: "img/777.jpeg",
            duration: 200
        }


    ],
    MidnightHeat: _placeholderSongs,
    SilkSheetsRedLights: _placeholderSongs,
    BeachVibes: _placeholderSongs,
    LeatherLace: _placeholderSongs,
    SpellboundGrooves: _placeholderSongs,
    Songsinshower: _placeholderSongs,
    Cherrystainedlips: _placeholderSongs,
    Rockclassics: _placeholderSongs,
    Wetwindows: _placeholderSongs,
    ignitethebeat: _placeholderSongs,
    chillvibes: _placeholderSongs,
    Jazzessentials: _placeholderSongs,
    indiefavs: _placeholderSongs

};

// Initialize the app
function init() {
    updateTimeGreeting();
    updateProgressBar();
    initializeVolume();
    loadRecentlyPlayed();
    loadLikedSongs();
    initDraggableProgress();
    setupCrossfadeListener();

    // Set up Netlify Identity event handlers
    netlifyIdentity.on('init', async (user) => {
        if (user) {
            await handleIdentityLogin(user);
        }
    });

    netlifyIdentity.on('login', async (user) => {
        await handleIdentityLogin(user);
        netlifyIdentity.close();
    });

    netlifyIdentity.on('logout', () => {
        handleIdentityLogout();
    });

    // Update greeting every minute
    setInterval(updateTimeGreeting, 60000);
}

async function getAuthToken() {
    try {
        const user = netlifyIdentity.currentUser();
        if (!user) return null;
        await user.jwt();
        return user.token.access_token;
    } catch (e) {
        console.error('Token refresh failed:', e);
        return null;
    }
}

async function handleIdentityLogin(user) {
    currentUser = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split('@')[0]
    };
    showUserProfile();
    updateTimeGreeting();
    await loadUserDataFromBackend();
}

function handleIdentityLogout() {
    currentUser = null;
    userPlaylists = [];
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userProfile').style.display = 'none';
    loadUserPlaylists();
    updateTimeGreeting();
}

async function loadUserDataFromBackend() {
    try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch('/.netlify/functions/get-user-data', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const data = await response.json();
            userPlaylists = data.playlists || [];
            loadUserPlaylists();
        }
    } catch (e) {
        console.error('Failed to load user data:', e);
    }
}

// Time-based greeting function
function updateTimeGreeting() {
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

    if (currentUser) {
        greeting += `, ${currentUser.name}`;
    }

    document.getElementById("greeting").textContent = greeting;
}

// Volume control functions
function initializeVolume() {
    audioPlayer.volume = 0.7;
    document.getElementById('volumeProgress').style.width = '70%';
}

function changeVolume(event) {
    const volumeBar = event.currentTarget;
    const clickX = event.offsetX;
    const width = volumeBar.offsetWidth;
    const volume = Math.max(0, Math.min(1, clickX / width));

    audioPlayer.volume = volume;
    document.getElementById('volumeProgress').style.width = (volume * 100) + '%';

    // Update mute state
    if (volume === 0) {
        isMuted = true;
        document.querySelector('.volume-control').classList.add('muted');
    } else {
        isMuted = false;
        document.querySelector('.volume-control').classList.remove('muted');
        previousVolume = volume;
    }
}

function toggleMute() {
    if (isMuted) {
        // Unmute
        audioPlayer.volume = previousVolume;
        document.getElementById('volumeProgress').style.width = (previousVolume * 100) + '%';
        isMuted = false;
        document.querySelector('.volume-control').classList.remove('muted');
    } else {
        // Mute
        previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        document.getElementById('volumeProgress').style.width = '0%';
        isMuted = true;
        document.querySelector('.volume-control').classList.add('muted');
    }
}

function showVolumePreview(event) {
    const volumeBar = event.currentTarget;
    const hoverX = event.offsetX;
    const width = volumeBar.offsetWidth;
    const volume = Math.max(0, Math.min(1, hoverX / width));

    const volumeHover = document.getElementById('volumeHover');
    const volumeTooltip = document.getElementById('volumeTooltip');

    if (volumeHover) volumeHover.style.width = (volume * 100) + '%';
    if (volumeTooltip) {
        volumeTooltip.textContent = Math.round(volume * 100);
        volumeTooltip.style.left = Math.min(Math.max(hoverX, 20), width - 20) + 'px';
    }
}

function hideVolumePreview() {
    const volumeHover = document.getElementById('volumeHover');
    if (volumeHover) volumeHover.style.width = '0%';
}

// Authentication functions (via Netlify Identity Widget)
function openLogin() {
    netlifyIdentity.open('login');
}

function openSignup() {
    netlifyIdentity.open('signup');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function logout() {
    netlifyIdentity.logout();
}

function showUserProfile() {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('userName').textContent = 'Hello, ' + currentUser.name + '!';
}

// Navigation functions
function showHome() {
    setActivePage('homePage');
    setActiveNavItem('homeNav');
    addToHistory('home');
}

function showSearch() {
    setActivePage('searchPage');
    setActiveNavItem('searchNav');
    addToHistory('search');
}

function showPlaylistPage(playlistId) {
    setActivePage('playlistPage');
    loadPlaylistContent(playlistId);
    addToHistory(`playlist-${playlistId}`);
    setActiveNavItem(null);
}

function setActivePage(pageId) {
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

function setActiveNavItem(navId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (navId) {
        document.getElementById(navId).classList.add('active');
    }
}

function addToHistory(page) {
    navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
    navigationHistory.push(page);
    currentHistoryIndex = navigationHistory.length - 1;
}

function goBack() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        navigateToHistoryPage(navigationHistory[currentHistoryIndex]);
    }
}

function goForward() {
    if (currentHistoryIndex < navigationHistory.length - 1) {
        currentHistoryIndex++;
        navigateToHistoryPage(navigationHistory[currentHistoryIndex]);
    }
}

function navigateToHistoryPage(page) {
    if (page === 'home') {
        setActivePage('homePage');
        setActiveNavItem('homeNav');
    } else if (page === 'search') {
        setActivePage('searchPage');
        setActiveNavItem('searchNav');
    } else if (page === 'liked') {
        showLikedSongs();
    } else if (page.startsWith('playlist-')) {
        const playlistId = page.replace('playlist-', '');
        setActivePage('playlistPage');
        loadPlaylistContent(playlistId);
        setActiveNavItem(null);
    }
}

// Playlist functions
function createPlaylist() {
    if (!currentUser) {
        showToast('Please log in to create playlists', 'info');
        openLogin();
        return;
    }
    document.getElementById('createPlaylistModal').classList.add('active');
}

function addSong() {
    if (!currentUser) {
        showToast('Please log in to add songs', 'info');
        openLogin();
        return;
    }

    // Populate playlist dropdown with user's playlists
    const select = document.getElementById('targetPlaylist');
    select.innerHTML = '<option value="">Select a playlist</option>';

    userPlaylists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.name;
        select.appendChild(option);
    });

    document.getElementById('addSongModal').classList.add('active');
}

async function addSongToPlaylist(event) {
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

    // Check file size (max ~4MB for audio due to serverless payload limits)
    if (audioFile.size > 4 * 1024 * 1024) {
        showToast('Audio file must be under 4MB. Please use a smaller or compressed file.', 'error');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Uploading...';
    submitBtn.disabled = true;

    try {
        // Read files as base64
        const audioData = await fileToBase64(audioFile);
        const imageData = imageFile ? await fileToBase64(imageFile) : null;

        // Get audio duration from file
        const duration = await getAudioDuration(audioFile);

        const token = await getAuthToken();
        if (!token) {
            showToast('Session expired. Please log in again.', 'error');
            return;
        }

        const response = await fetch('/.netlify/functions/upload-song', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                artist,
                playlistId,
                duration,
                audioData,
                audioType: audioFile.type,
                imageData,
                imageType: imageFile ? imageFile.type : null
            })
        });

        if (response.ok) {
            const result = await response.json();
            // Update local state
            const playlistIndex = userPlaylists.findIndex(p => String(p.id) === String(playlistId));
            if (playlistIndex !== -1) {
                userPlaylists[playlistIndex].songs.push(result.song);
                loadUserPlaylists();
            }

            // Clear form
            document.getElementById('songTitle').value = '';
            document.getElementById('songArtist').value = '';
            document.getElementById('songFile').value = '';
            document.getElementById('songImage').value = '';
            document.getElementById('targetPlaylist').value = '';

            closeModal('addSongModal');
            showToast('Song uploaded successfully!');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to upload song', 'error');
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('Failed to upload song. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove the data:xxx;base64, prefix to get raw base64
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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

async function saveNewPlaylist(event) {
    event.preventDefault();
    const name = document.getElementById('playlistName').value;
    const description = document.getElementById('playlistDescription').value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
        const token = await getAuthToken();
        if (!token) {
            showToast('Session expired. Please log in again.', 'error');
            return;
        }

        const response = await fetch('/.netlify/functions/save-playlist', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (response.ok) {
            const result = await response.json();
            userPlaylists.push(result.playlist);
            loadUserPlaylists();
            closeModal('createPlaylistModal');

            // Clear form
            document.getElementById('playlistName').value = '';
            document.getElementById('playlistDescription').value = '';
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to create playlist. Please try again.', 'error');
        }
    } catch (e) {
        console.error('Error creating playlist:', e);
        showToast('Failed to create playlist. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function loadUserPlaylists() {
    const playlistList = document.getElementById('playlistList');
    playlistList.innerHTML = '';

    userPlaylists.forEach(playlist => {
        const playlistItem = document.createElement('div');
        playlistItem.className = 'playlist-item';
        const h4 = document.createElement('h4');
        h4.textContent = playlist.name;
        const p = document.createElement('p');
        p.textContent = playlist.songs.length + ' songs';
        playlistItem.appendChild(h4);
        playlistItem.appendChild(p);
        playlistItem.onclick = () => showPlaylistPage(playlist.id);
        playlistList.appendChild(playlistItem);
    });
}

function loadPlaylistContent(playlistId) {
    const playlist = userPlaylists.find(p => p.id == playlistId) || defaultPlaylists[playlistId];
    const playlistTitle = document.getElementById('playlistTitle');
    const playlistContent = document.getElementById('playlistContent');

    if (playlist) {
        if (playlist.name) {
            // User playlist
            playlistTitle.textContent = playlist.name;

            let contentHTML = `
                <div class="playlist-header" style="margin-bottom: 30px;">
                    <p style="color: #a7a7a7; margin-bottom: 10px;">${escapeHTML(playlist.description || 'Custom playlist')}</p>
                    <p style="color: #a7a7a7;">${playlist.songs.length} songs</p>
                    ${playlist.songs.length > 0 ? `<button onclick="playUserPlaylist(0, ${playlist.id})" style="background-color: #1db954; border: none; padding: 12px 24px; border-radius: 20px; color: black; font-weight: bold; margin-top: 20px; cursor: pointer;">Play All</button>` : ''}
                </div>
            `;

            if (playlist.songs.length > 0) {
                contentHTML += '<div class="cardContainer">';
                playlist.songs.forEach((song, index) => {
                    const songTitle = escapeHTML(song.title || 'Unknown Title');
                    const songArtist = escapeHTML(song.artist || 'Unknown Artist');
                    const songImage = encodeURI(song.image || 'img/home.svg');

                    contentHTML += `
                        <div class="card" draggable="true" onclick="playUserPlaylist(${index}, ${playlist.id})" data-song-url="${encodeURI(song.url || '')}">
                            <div class="play">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                                    <circle cx="24" cy="24" r="24" fill="#1DB954"/>
                                    <polygon points="18,14 34,24 18,34" fill="black"/>
                                </svg>
                            </div>
                            <img src="${songImage}" alt="${songTitle}" onerror="this.src='img/home.svg'">
                            <h2>${songTitle}</h2>
                            <p>${songArtist}</p>
                            ${song.isUploaded ? '<small style="color: #1db954;">Uploaded File</small>' : ''}
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
            const playlistNames = {
                popular: "Today's Top Hits",
                Punjabi: "Hot Hits Punjabi",
                rock: "Rock Classics",
                jazz: "Jazz Essentials",
                workout: "Workout Mix",
                indie: "Indie Favorites",
                SabrinaSessions: "Sabrina Sessions",
                SereneRoads: "Serene Roads",
                MidnightHeat: "Midnight Heat",
                SilkSheetsRedLights: "Silk Sheets & Red Lights",
                BeachVibes: "Beach Vibes",
                LeatherLace: "Leather & Lace",
                SpellboundGrooves: "Spellbound Grooves",
                Songsinshower: "Songs to Sing in Shower",
                Cherrystainedlips: "Cherry-Stained Lips",
                Rockclassics: "Rock Classics",
                Wetwindows: "Wet Windows",
                ignitethebeat: "Ignite the Beat",
                chillvibes: "Chill Vibes",
                Jazzessentials: "Jazz Essentials",
                indiefavs: "Indie Favorites"
            };
            playlistTitle.textContent = playlistNames[playlistId] || "Playlist";

            let contentHTML = `
                <div class="playlist-header" style="margin-bottom: 30px;">
                    
                    <p style="color: #a7a7a7;">${playlist.length} songs</p>
                    <button onclick="playPlaylist('${playlistId}')" style="background-color: #1db954; border: none; padding: 6px 12px; border-radius: 10px; color: black; font-weight: bold; margin-top: 10px; cursor: pointer;">Play All</button>
                </div>
                <div class="cardContainer">
            `;

            playlist.forEach((song, index) => {
                contentHTML += `
                    <div class="card" onclick="playSong(${index}, '${playlistId}')" oncontextmenu="showContextMenu(event, defaultPlaylists['${playlistId}'][${index}])" data-song-url="${encodeURI(song.url)}">
                        <div class="play">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="24" fill="#1DB954"/>
                                <polygon points="18,14 34,24 18,34" fill="black"/>
                            </svg>
                        </div>
                        <img src="${song.image}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
                        <h2>${escapeHTML(song.title)}</h2>
                        <p>${escapeHTML(song.artist)}</p>
                    </div>
                `;
            });
            contentHTML += '</div>';
            playlistContent.innerHTML = contentHTML;
        }
    }
}

function playUserPlaylist(index, playlistId) {
    const playlist = userPlaylists.find(p => p.id == playlistId);
    if (playlist && playlist.songs.length > 0) {
        currentPlaylist = playlist.songs;
        currentIndex = index;
        playSong(index);
    }
}

// Music player functions
function playPlaylist(playlistId) {
    currentPlaylist = defaultPlaylists[playlistId] || [];
    currentIndex = 0;
    if (currentPlaylist.length > 0) {
        playSong(0, playlistId);
    }
}

function playSong(index, playlistId) {
    if (playlistId && defaultPlaylists[playlistId]) {
        currentPlaylist = defaultPlaylists[playlistId];
    }

    if (currentPlaylist.length === 0) return;

    currentIndex = index;
    currentSong = currentPlaylist[currentIndex];

    if (currentSong) {
        document.getElementById('currentSongTitle').textContent = currentSong.title;
        document.getElementById('currentSongArtist').textContent = currentSong.artist;
        document.getElementById('currentSongImage').src = currentSong.image;

        audioPlayer.src = currentSong.url;
        audioPlayer.play().catch(error => {
            console.error('Error playing song:', error);
            showToast('Error playing song. Please check the audio file or try again.', 'error');
        });
        isPlaying = true;
        updatePlayButton();
        addToRecentlyPlayed(currentSong);
        updateLikeUI();
        updateNowPlayingIndicator();
        initAudioContext();
        startVisualizer();
        renderQueue();
    }
}

function togglePlay() {
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        stopVisualizer();
    } else {
        audioPlayer.play();
        isPlaying = true;
        startVisualizer();
    }
    updatePlayButton();
    updateNowPlayingIndicator();
}

function updatePlayButton() {
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

const repeatBtn = document.getElementById('repeatBtn');
const repeatBtnoff = document.getElementById('repeatBtnoff');

if (repeatBtn && repeatBtnoff) {
    repeatBtn.addEventListener('click', toggleRepeat);
    repeatBtnoff.addEventListener('click', toggleRepeat);
}

function toggleRepeat() {
    isRepeated = !isRepeated;
    updateRepeatButton();
}

function updateRepeatButton() {
    if (isRepeated) {
        repeatBtn.style.display = 'block';
        repeatBtnoff.style.display = 'none';
    } else {
        repeatBtn.style.display = 'none';
        repeatBtnoff.style.display = 'block';
    }
}

function nextSong() {
    // Check queue first
    if (songQueue.length > 0) {
        const nextFromQueue = songQueue.shift();
        // Find the song in current playlist or just play it directly
        currentSong = nextFromQueue;
        document.getElementById('currentSongTitle').textContent = currentSong.title;
        document.getElementById('currentSongArtist').textContent = currentSong.artist;
        document.getElementById('currentSongImage').src = currentSong.image;
        audioPlayer.src = currentSong.url;
        audioPlayer.play().catch(e => console.error(e));
        isPlaying = true;
        updatePlayButton();
        addToRecentlyPlayed(currentSong);
        updateLikeUI();
        updateNowPlayingIndicator();
        startVisualizer();
        renderQueue();
        return;
    }
    if (currentPlaylist.length === 0) return;

    if (isShuffled) {
        currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
    }

    playSong(currentIndex);
}

function previousSong() {
    if (currentPlaylist.length === 0) return;

    if (isShuffled) {
        currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : currentPlaylist.length - 1;
    }

    playSong(currentIndex);
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffleBtn').classList.toggle('active', isShuffled);
}

function seekSong(event) {
    const progressBar = event.currentTarget;
    const clickX = event.offsetX;
    const width = progressBar.offsetWidth;
    const duration = audioPlayer.duration;

    if (duration) {
        const newTime = (clickX / width) * duration;
        audioPlayer.currentTime = newTime;
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
    if (isDraggingProgress) return;
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = progressPercent + '%';
        const thumb = document.getElementById('progressThumb');
        if (thumb) thumb.style.left = progressPercent + '%';
        currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
        durationSpan.textContent = formatTime(audioPlayer.duration);
    }
}

// Search functions
function performSearch(query) {
    const searchResults = document.getElementById('searchResults');

    if (!query.trim()) {
        // Show browse categories when no search query
        searchResults.innerHTML = `
            <h2>Browse all</h2>
            <div class="search-categories">
                <div class="category-card" style="background-color: #e13300;" onclick="searchCategory('pop')">
                    <h3>Pop</h3>
                </div>
                <div class="category-card" style="background-color: #ba5d07;" onclick="searchCategory('rock')">
                    <h3>Rock</h3>
                </div>
                <div class="category-card" style="background-color: #8d67ab;" onclick="searchCategory('hip-hop')">
                    <h3>Punjabi</h3>
                </div>
                <div class="category-card" style="background-color: #1e3264;" onclick="searchCategory('jazz')">
                    <h3>Jazz</h3>
                </div>
                <div class="category-card" style="background-color: #148a08;" onclick="searchCategory('electronic')">
                    <h3>Electronic</h3>
                </div>
                <div class="category-card" style="background-color: #503750;" onclick="searchCategory('indie')">
                    <h3>Indie</h3>
                </div>
                
            </div>
        `;
        return;
    }

    // Simple search through all songs (deduplicated by URL)
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

    const filteredSongs = allSongs.filter(song =>
        song.title.toLowerCase().includes(query.toLowerCase()) ||
        song.artist.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredSongs.length > 0) {
        lastSearchResults = filteredSongs;
        let resultsHTML = `<h2>Search results for "${escapeHTML(query)}"</h2><div class="cardContainer">`;
        filteredSongs.forEach((song, index) => {
            resultsHTML += `
                <div class="card" onclick="playSearchResult(${index})" oncontextmenu="showContextMenu(event, lastSearchResults[${index}])" data-song-url="${encodeURI(song.url)}">
                    <div class="play">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="24" fill="#1DB954"/>
                            <polygon points="18,14 34,24 18,34" fill="black"/>
                        </svg>
                    </div>
                    <img src="${song.image}" alt="${escapeHTML(song.title)}">
                    <h2>${escapeHTML(song.title)}</h2>
                    <p>${escapeHTML(song.artist)}</p>
                </div>
            `;
        });
        resultsHTML += '</div>';
        searchResults.innerHTML = resultsHTML;
    } else {
        searchResults.innerHTML = `<h2>No results found for "${escapeHTML(query)}"</h2><p>Try searching for something else.</p>`;
    }
}

function searchCategory(category) {
    // Map categories to playlists
    const categoryMap = {
        'pop': 'popular',
        'rock': 'rock',
        'jazz': 'jazz',
        'indie': 'indie',
        'electronic': 'workout',
        'hip-hop': 'Punjabi',
    };

    const playlistId = categoryMap[category];
    if (playlistId && defaultPlaylists[playlistId]) {
        showPlaylistPage(playlistId);
    }
}

function playSearchResult(index) {
    if (lastSearchResults.length > 0) {
        currentPlaylist = lastSearchResults;
        currentIndex = index;
        playSong(index);
    }
}

// Audio event listeners
document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
audioPlayer.addEventListener('timeupdate', updateProgressBar);
audioPlayer.addEventListener('ended', () => {
    if (isRepeated) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else if (!isCrossfading) {
        nextSong();
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    durationSpan.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayButton();
});

audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayButton();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        nextSong();
    } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        previousSong();
    } else if (e.code === 'KeyM' && e.ctrlKey) {
        e.preventDefault();
        toggleMute();
    } else if (e.code === 'KeyL' && e.ctrlKey) {
        e.preventDefault();
        toggleLikeSong();
    } else if (e.code === 'KeyQ' && !e.ctrlKey) {
        toggleQueue();
    } else if (e.code === 'KeyL' && !e.ctrlKey) {
        toggleLyrics();
    } else if (e.code === 'KeyS' && !e.ctrlKey) {
        toggleShuffle();
    } else if (e.code === 'KeyR' && !e.ctrlKey) {
        toggleRepeat();
    } else if (e.key === '?') {
        document.getElementById('shortcutsModal').classList.toggle('active');
    }
});

// Close modals when clicking outside & hide context menu
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
    hideContextMenu();
});

// === SKELETON LOADING (Feature 12) ===
function showSkeletons(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>';
    }
    container.insertAdjacentHTML('afterbegin', '<div class="skeleton-wrap" style="display:flex;gap:20px;flex-wrap:wrap;">' + html + '</div>');
}
function hideSkeletons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const wrap = container.querySelector('.skeleton-wrap');
    if (wrap) wrap.remove();
}

// === RECENTLY PLAYED (Feature 4) ===
function addToRecentlyPlayed(song) {
    if (!song) return;
    recentlyPlayed = recentlyPlayed.filter(s => s.url !== song.url);
    recentlyPlayed.unshift({ title: song.title, artist: song.artist, url: song.url, image: song.image });
    if (recentlyPlayed.length > MAX_RECENT) recentlyPlayed = recentlyPlayed.slice(0, MAX_RECENT);
    try { localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed)); } catch(e) {}
    renderRecentlyPlayed();
}
function loadRecentlyPlayed() {
    try {
        const stored = localStorage.getItem('recentlyPlayed');
        if (stored) recentlyPlayed = JSON.parse(stored);
    } catch(e) {}
    renderRecentlyPlayed();
}
function renderRecentlyPlayed() {
    const section = document.getElementById('recentlyPlayedSection');
    const container = document.getElementById('recentlyPlayedContainer');
    if (!section || !container) return;
    if (recentlyPlayed.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    container.innerHTML = recentlyPlayed.map((song, i) => `
        <div class="card" onclick="playRecentlyPlayed(${i})" oncontextmenu="showContextMenu(event, recentlyPlayed[${i}])">
            <div class="play"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#1DB954"/><polygon points="18,14 34,24 18,34" fill="black"/></svg></div>
            <img src="${encodeURI(song.image || 'img/home.svg')}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
            <h2>${escapeHTML(song.title)}</h2>
            <p>${escapeHTML(song.artist)}</p>
        </div>
    `).join('');
}
function playRecentlyPlayed(index) {
    currentPlaylist = recentlyPlayed.map(s => ({...s}));
    currentIndex = index;
    playSong(index);
}

// === DRAGGABLE PROGRESS BAR (Feature 6) ===
function initDraggableProgress() {
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
        isDraggingProgress = true;
        bar.classList.add('dragging');
        const percent = updateDrag(e.clientX);
        const onMove = (ev) => updateDrag(ev.clientX);
        const onUp = (ev) => {
            isDraggingProgress = false;
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
        if (isDraggingProgress) return;
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

    // Touch support
    bar.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        bar.classList.add('dragging');
        updateDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchmove', (e) => {
        if (isDraggingProgress) updateDrag(e.touches[0].clientX);
    }, { passive: true });
    bar.addEventListener('touchend', (e) => {
        if (isDraggingProgress) {
            isDraggingProgress = false;
            bar.classList.remove('dragging');
            const rect = bar.getBoundingClientRect();
            const touch = e.changedTouches[0];
            const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            if (audioPlayer.duration) audioPlayer.currentTime = percent * audioPlayer.duration;
        }
    });
}

// === LIKE/FAVORITE SONGS (Feature 5) ===
function loadLikedSongs() {
    try {
        const stored = localStorage.getItem('likedSongs');
        if (stored) likedSongs = JSON.parse(stored);
    } catch(e) {}
}
function saveLikedSongs() {
    try { localStorage.setItem('likedSongs', JSON.stringify(likedSongs)); } catch(e) {}
}
function isLiked(song) {
    if (!song) return false;
    return likedSongs.some(s => s.url === song.url);
}
function toggleLikeSong() {
    if (!currentSong) return;
    if (isLiked(currentSong)) {
        likedSongs = likedSongs.filter(s => s.url !== currentSong.url);
        showToast('Removed from Liked Songs', 'info');
    } else {
        likedSongs.push({ title: currentSong.title, artist: currentSong.artist, url: currentSong.url, image: currentSong.image });
        showToast('Added to Liked Songs');
    }
    saveLikedSongs();
    updateLikeUI();
}
function updateLikeUI() {
    const btn = document.getElementById('playerLikeBtn');
    if (!btn) return;
    if (isLiked(currentSong)) {
        btn.classList.add('liked');
    } else {
        btn.classList.remove('liked');
    }
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);
}
function showLikedSongs() {
    if (likedSongs.length === 0) {
        showToast('No liked songs yet. Click the heart to like a song!', 'info');
        return;
    }
    currentPlaylist = likedSongs.map(s => ({...s}));
    setActivePage('playlistPage');
    document.getElementById('playlistTitle').textContent = 'Liked Songs';
    const content = document.getElementById('playlistContent');
    let html = `<div class="playlist-header" style="margin-bottom:30px;"><p style="color:#a7a7a7;">${likedSongs.length} songs</p>
        <button onclick="playPlaylistFromLiked()" style="background-color:#1db954;border:none;padding:6px 12px;border-radius:10px;color:black;font-weight:bold;margin-top:10px;cursor:pointer;">Play All</button></div><div class="cardContainer">`;
    likedSongs.forEach((song, i) => {
        html += `<div class="card" onclick="playFromLiked(${i})" oncontextmenu="showContextMenu(event, likedSongs[${i}])" data-song-url="${encodeURI(song.url)}">
            <div class="play"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#1DB954"/><polygon points="18,14 34,24 18,34" fill="black"/></svg></div>
            <img src="${encodeURI(song.image || 'img/home.svg')}" alt="${escapeHTML(song.title)}" onerror="this.src='img/home.svg'">
            <h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.artist)}</p></div>`;
    });
    html += '</div>';
    content.innerHTML = html;
    addToHistory('liked');
}
function playFromLiked(index) {
    currentPlaylist = likedSongs.map(s => ({...s}));
    currentIndex = index;
    playSong(index);
}
function playPlaylistFromLiked() {
    currentPlaylist = likedSongs.map(s => ({...s}));
    currentIndex = 0;
    playSong(0);
}

// === QUEUE SYSTEM (Feature 3) ===
function toggleQueue() {
    isQueueOpen = !isQueueOpen;
    document.getElementById('queuePanel').classList.toggle('open', isQueueOpen);
    document.getElementById('queueToggleBtn').classList.toggle('active', isQueueOpen);
    if (isQueueOpen) renderQueue();
}
function addToQueue(song) {
    songQueue.push(song);
    showToast(`"${song.title}" added to queue`);
    renderQueue();
}
function removeFromQueue(index) {
    songQueue.splice(index, 1);
    renderQueue();
}
function renderQueue() {
    const nowPlaying = document.getElementById('queueNowPlaying');
    const nextUp = document.getElementById('queueNextUp');
    if (!nowPlaying || !nextUp) return;

    if (currentSong) {
        nowPlaying.innerHTML = `<div class="queue-item">
            <img src="${encodeURI(currentSong.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
            <div class="queue-song-info"><h5>${escapeHTML(currentSong.title)}</h5><p>${escapeHTML(currentSong.artist)}</p></div></div>`;
    } else {
        nowPlaying.innerHTML = '<p style="color:#a7a7a7;font-size:13px;">Nothing playing</p>';
    }

    if (songQueue.length === 0) {
        // Show upcoming from current playlist
        let upcoming = '';
        if (currentPlaylist.length > 0) {
            for (let i = 1; i <= Math.min(5, currentPlaylist.length - 1); i++) {
                const idx = (currentIndex + i) % currentPlaylist.length;
                const s = currentPlaylist[idx];
                upcoming += `<div class="queue-item" onclick="playSong(${idx})">
                    <img src="${encodeURI(s.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
                    <div class="queue-song-info"><h5>${escapeHTML(s.title)}</h5><p>${escapeHTML(s.artist)}</p></div></div>`;
            }
        }
        nextUp.innerHTML = upcoming || '<p style="color:#a7a7a7;font-size:13px;">Queue is empty</p>';
    } else {
        nextUp.innerHTML = songQueue.map((s, i) => `<div class="queue-item">
            <img src="${encodeURI(s.image || 'img/home.svg')}" onerror="this.src='img/home.svg'">
            <div class="queue-song-info"><h5>${escapeHTML(s.title)}</h5><p>${escapeHTML(s.artist)}</p></div>
            <button class="queue-remove" onclick="removeFromQueue(${i})">&times;</button></div>`).join('');
    }
}

// === AUDIO VISUALIZER (Feature 1) ===
function initAudioContext() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaElementSource(audioPlayer);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        // Connect: source -> analyser -> destination (EQ filters inserted later if needed)
        sourceNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
    } catch(e) {
        console.error('AudioContext init failed:', e);
    }
}
function startVisualizer() {
    if (!analyserNode) return;
    const canvas = document.getElementById('visualizerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = 90;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);
        analyserNode.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const r = 29;
            const g = 185;
            const b = 84;
            ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
    draw();
}
function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    const canvas = document.getElementById('visualizerCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// === EQUALIZER (Feature 17) ===
function toggleEQ() {
    eqIsOpen = !eqIsOpen;
    document.getElementById('eqPanel').classList.toggle('open', eqIsOpen);
    document.getElementById('eqToggleBtn').classList.toggle('active', eqIsOpen);
    if (eqIsOpen) initEqualizer();
}
function initEqualizer() {
    if (eqFilters.length > 0) return;
    initAudioContext();
    if (!audioContext || !sourceNode || !analyserNode) return;

    const frequencies = [60, 230, 910, 4000, 14000];
    // Disconnect current chain
    sourceNode.disconnect();

    let prevNode = sourceNode;
    frequencies.forEach((freq, i) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        prevNode.connect(filter);
        prevNode = filter;
        eqFilters.push(filter);
    });
    prevNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);

    // Load saved preset
    const saved = localStorage.getItem('eqPreset');
    if (saved) {
        document.getElementById('eqPresetSelect').value = saved;
        applyEQPreset(saved);
    }
}
function setEQBand(band, value) {
    if (eqFilters[band]) {
        eqFilters[band].gain.value = parseFloat(value);
        const bands = document.querySelectorAll('.eq-band');
        if (bands[band]) bands[band].querySelector('span').textContent = value;
    }
}
function applyEQPreset(preset) {
    const presets = {
        flat: [0, 0, 0, 0, 0],
        bass: [6, 4, 0, -2, -1],
        treble: [-2, -1, 0, 4, 6],
        vocal: [-2, 0, 4, 3, -1],
        rock: [4, 2, -1, 3, 5]
    };
    const values = presets[preset] || presets.flat;
    values.forEach((val, i) => {
        setEQBand(i, val);
        const slider = document.querySelector(`.eq-slider[data-band="${i}"]`);
        if (slider) slider.value = val;
    });
    try { localStorage.setItem('eqPreset', preset); } catch(e) {}
}

// === LYRICS PANEL (Feature 2) ===
function toggleLyrics() {
    isLyricsOpen = !isLyricsOpen;
    document.getElementById('lyricsPanel').classList.toggle('open', isLyricsOpen);
    document.getElementById('lyricsToggleBtn').classList.toggle('active', isLyricsOpen);
    if (isLyricsOpen) renderLyrics();
}
function renderLyrics() {
    const content = document.getElementById('lyricsContent');
    if (!currentSong) { content.innerHTML = '<p>No song playing.</p>'; return; }

    // Sample lyrics for some songs
    const sampleLyrics = {
        "Blinding Lights": "I've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\n\nI look around and Sin City's cold and empty\nNo one's around to judge me\nI can't see clearly when you're gone\n\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust",
        "Espresso": "Now he's thinkin' bout me every night, oh\nIs it that sweet? I guess so\nSay you can't sleep, baby, I know\nThat's that me espresso\n\nMoved in, he's drinkin' up my time\nI should let him go\nHe never lets me close, oh yeah\nHe never lets me go",
        "Levitating": "If you wanna run away with me\nI know a galaxy and I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don't stop for life\nGlitter in the sky, glitter in my eyes\nShining just the way I like\nIf you're feeling like you need a little bit of company\nYou met me at an interesting time"
    };

    const lyrics = sampleLyrics[currentSong.title];
    if (lyrics) {
        content.textContent = lyrics;
    } else {
        content.innerHTML = '<p style="color:#a7a7a7;">Lyrics not available for this song.</p>';
    }
}

// === CROSSFADE (Feature 7) ===
function setupCrossfadeListener() {
    audioPlayer.addEventListener('timeupdate', () => {
        if (!audioPlayer.duration || isRepeated || isCrossfading) return;
        const timeLeft = audioPlayer.duration - audioPlayer.currentTime;
        if (timeLeft <= crossfadeDuration && timeLeft > 0) {
            crossfadeToNext();
        }
    });
}
function crossfadeToNext() {
    if (isCrossfading || songQueue.length === 0 && currentPlaylist.length <= 1) return;
    isCrossfading = true;

    const audioB = document.getElementById('audioPlayerB');
    let nextSongData;

    if (songQueue.length > 0) {
        nextSongData = songQueue.shift();
    } else if (currentPlaylist.length > 0) {
        const nextIdx = isShuffled ? Math.floor(Math.random() * currentPlaylist.length) : (currentIndex + 1) % currentPlaylist.length;
        nextSongData = currentPlaylist[nextIdx];
        currentIndex = nextIdx;
    }

    if (!nextSongData) { isCrossfading = false; return; }

    audioB.src = nextSongData.url;
    audioB.volume = 0;
    audioB.play().catch(e => { console.error(e); isCrossfading = false; });

    const startVol = audioPlayer.volume;
    const steps = 30;
    let step = 0;
    const interval = (crossfadeDuration * 1000) / steps;

    if (crossfadeTimer) clearInterval(crossfadeTimer);
    crossfadeTimer = setInterval(() => {
        step++;
        const progress = step / steps;
        audioPlayer.volume = startVol * (1 - progress);
        audioB.volume = startVol * progress;

        if (step >= steps) {
            clearInterval(crossfadeTimer);
            audioPlayer.pause();
            audioPlayer.src = audioB.src;
            audioPlayer.currentTime = audioB.currentTime;
            audioPlayer.volume = startVol;
            audioPlayer.play().catch(e => console.error(e));
            audioB.pause();
            audioB.src = '';

            currentSong = nextSongData;
            document.getElementById('currentSongTitle').textContent = currentSong.title;
            document.getElementById('currentSongArtist').textContent = currentSong.artist;
            document.getElementById('currentSongImage').src = currentSong.image;
            isPlaying = true;
            updatePlayButton();
            addToRecentlyPlayed(currentSong);
            updateLikeUI();
            updateNowPlayingIndicator();
            renderQueue();
            isCrossfading = false;
        }
    }, interval);
}

// === CONTEXT MENU (Feature 8) ===
function showContextMenu(event, song) {
    event.preventDefault();
    event.stopPropagation();
    contextMenuSong = song;
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - 200) + 'px';
}
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
    contextMenuSong = null;
}
function contextPlayNext() {
    if (contextMenuSong) {
        songQueue.unshift(contextMenuSong);
        showToast(`"${contextMenuSong.title}" will play next`);
        renderQueue();
    }
    hideContextMenu();
}
function contextAddToQueue() {
    if (contextMenuSong) addToQueue(contextMenuSong);
    hideContextMenu();
}
function contextToggleLike() {
    if (contextMenuSong) {
        const wasLiked = isLiked(contextMenuSong);
        if (wasLiked) {
            likedSongs = likedSongs.filter(s => s.url !== contextMenuSong.url);
            showToast('Removed from Liked Songs', 'info');
        } else {
            likedSongs.push({ title: contextMenuSong.title, artist: contextMenuSong.artist, url: contextMenuSong.url, image: contextMenuSong.image });
            showToast('Added to Liked Songs');
        }
        saveLikedSongs();
        if (currentSong && currentSong.url === contextMenuSong.url) updateLikeUI();
    }
    hideContextMenu();
}
function contextShare() {
    if (contextMenuSong) {
        const text = `${contextMenuSong.title} by ${contextMenuSong.artist}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
        }
    }
    hideContextMenu();
}

// === PLAYLIST REORDERING (Feature 9) ===
function initPlaylistReorder(container, playlistId) {
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
            const playlist = userPlaylists.find(p => p.id == playlistId);
            if (playlist) {
                const [moved] = playlist.songs.splice(fromIndex, 1);
                playlist.songs.splice(toIndex, 0, moved);
                loadPlaylistContent(playlistId);
                showToast('Playlist reordered');
            }
        });
    });
}

// === NOW PLAYING ANIMATION (Feature 10) ===
function updateNowPlayingIndicator() {
    // Remove existing indicators
    document.querySelectorAll('.now-playing').forEach(el => el.classList.remove('now-playing'));
    document.querySelectorAll('.now-playing-bars').forEach(el => el.remove());

    if (!currentSong) return;
    const cards = document.querySelectorAll(`.card[data-song-url="${CSS.escape(encodeURI(currentSong.url))}"]`);
    cards.forEach(card => {
        card.classList.add('now-playing');
        const h2 = card.querySelector('h2');
        if (h2 && !h2.querySelector('.now-playing-bars')) {
            const bars = document.createElement('span');
            bars.className = 'now-playing-bars' + (isPlaying ? '' : ' paused');
            bars.innerHTML = '<span></span><span></span><span></span><span></span>';
            h2.appendChild(bars);
        }
    });
}

// === MINI PLAYER (Feature 15) ===
function toggleMiniPlayer() {
    document.querySelector('.playbar').classList.toggle('mini');
    document.getElementById('miniPlayerToggle').classList.toggle('active');
}

// === SOCIAL SHARING (Feature 16) ===
function shareSong() {
    if (!currentSong) { showToast('No song playing', 'info'); return; }
    const shareText = `🎵 ${currentSong.title} by ${currentSong.artist}`;
    if (navigator.share) {
        navigator.share({ title: currentSong.title, text: shareText }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => showToast('Song info copied to clipboard!'));
    } else {
        showToast('Sharing not supported on this browser', 'error');
    }
}

// Initialize the app when page loads
init();


// SoundCloud Integration for your Spotify Clone
// Add this to your existing script.js

// SoundCloud Widget API
const SC_WIDGET_API = 'https://w.soundcloud.com/player/api.js';

// Load SoundCloud Widget API
function loadSoundCloudAPI() {
    return new Promise((resolve) => {
        if (window.SC) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = SC_WIDGET_API;
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
}

// SoundCloud playlist data structure
const soundcloudPlaylists = {
    electronic: [
        {
            title: "Chill Electronic",
            artist: "Various Artists",
            soundcloudUrl: "https://soundcloud.com/example/chill-electronic",
            image: "img/electronic-cover.jpg",
            duration: 240,
            isSoundCloud: true
        }
    ],
    indie: [
        {
            title: "Indie Discoveries",
            artist: "Indie Artist",
            soundcloudUrl: "https://soundcloud.com/example/indie-track",
            image: "img/indie-cover.jpg",
            duration: 195,
            isSoundCloud: true
        }
    ]
};

// Enhanced playSong function with SoundCloud support
function playSongWithSoundCloud(index, playlistId) {
    if (playlistId && defaultPlaylists[playlistId]) {
        currentPlaylist = defaultPlaylists[playlistId];
    } else if (playlistId && soundcloudPlaylists[playlistId]) {
        currentPlaylist = soundcloudPlaylists[playlistId];
    }

    if (currentPlaylist.length === 0) return;

    currentIndex = index;
    currentSong = currentPlaylist[currentIndex];

    if (currentSong) {
        document.getElementById('currentSongTitle').textContent = currentSong.title;
        document.getElementById('currentSongArtist').textContent = currentSong.artist;
        document.getElementById('currentSongImage').src = currentSong.image;

        if (currentSong.isSoundCloud) {
            // Play SoundCloud track
            playSoundCloudTrack(currentSong.soundcloudUrl);
        } else {
            // Play regular audio file
            audioPlayer.src = currentSong.url;
            audioPlayer.play();
        }

        isPlaying = true;
        updatePlayButton();
    }
}

// SoundCloud player functions
async function playSoundCloudTrack(soundcloudUrl) {
    await loadSoundCloudAPI();

    // Hide regular audio player
    audioPlayer.pause();

    // Create SoundCloud widget if it doesn't exist
    if (!document.getElementById('soundcloud-player')) {
        createSoundCloudWidget();
    }

    const widget = SC.Widget('soundcloud-player');

    // Load and play the track
    widget.load(soundcloudUrl, {
        auto_play: true,
        hide_related: true,
        show_comments: false,
        show_user: true,
        show_reposts: false,
        visual: false
    });

    // Listen for widget events
    widget.bind(SC.Widget.Events.READY, function () {
        widget.play();
    });

    widget.bind(SC.Widget.Events.FINISH, function () {
        nextSong();
    });

    widget.bind(SC.Widget.Events.PLAY, function () {
        isPlaying = true;
        updatePlayButton();
    });

    widget.bind(SC.Widget.Events.PAUSE, function () {
        isPlaying = false;
        updatePlayButton();
    });
}

// Create hidden SoundCloud widget
function createSoundCloudWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = `
        <iframe 
            id="soundcloud-player"
            width="100%" 
            height="166" 
            scrolling="no" 
            frameborder="no" 
            allow="autoplay"
            src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/34019569&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;show_teaser=true&amp;visual=true"
            style="display: none;">
        </iframe>
    `;
    document.body.appendChild(widgetContainer);
}

// Enhanced toggle play for SoundCloud
function togglePlayWithSoundCloud() {
    if (currentSong && currentSong.isSoundCloud) {
        const widget = SC.Widget('soundcloud-player');
        if (isPlaying) {
            widget.pause();
        } else {
            widget.play();
        }
    } else {
        // Regular audio player toggle
        togglePlay();
    }
}

// SoundCloud search function
async function searchSoundCloud(query) {
    const CLIENT_ID = 'your_soundcloud_client_id'; // Get from SoundCloud
    const searchUrl = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&client_id=${CLIENT_ID}&limit=20`;

    try {
        const response = await fetch(searchUrl);
        const tracks = await response.json();

        return tracks.map(track => ({
            title: track.title,
            artist: track.user.username,
            soundcloudUrl: track.permalink_url,
            image: track.artwork_url || track.user.avatar_url,
            duration: Math.floor(track.duration / 1000),
            isSoundCloud: true
        }));
    } catch (error) {
        console.error('SoundCloud search error:', error);
        return [];
    }
}

// Add SoundCloud results to search
async function performSearchWithSoundCloud(query) {
    const searchResults = document.getElementById('searchResults');

    if (!query.trim()) {
        // Show regular browse categories
        performSearch(query);
        return;
    }

    // Search both local and SoundCloud
    const localResults = searchLocalTracks(query);
    const soundcloudResults = await searchSoundCloud(query);

    const allResults = [...localResults, ...soundcloudResults];

    if (allResults.length > 0) {
        let resultsHTML = `<h2>Search results for "${escapeHTML(query)}"</h2><div class="cardContainer">`;

        allResults.forEach((song, index) => {
            const sourceLabel = song.isSoundCloud ? 'SoundCloud' : 'Local';
            resultsHTML += `
                <div class="card" onclick="playSearchResultMixed(${index}, '${JSON.stringify(allResults).replace(/"/g, '&quot;')}')">
                    <div class="play">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="24" fill="#1DB954"/>
                            <polygon points="18,14 34,24 18,34" fill="black"/>
                        </svg>
                    </div>
                    <img src="${song.image}" alt="${song.title}">
                    <h2>${song.title}</h2>
                    <p>${song.artist}</p>
                    <small style="color: #ff5500;">${sourceLabel}</small>
                </div>
            `;
        });
        resultsHTML += '</div>';
        searchResults.innerHTML = resultsHTML;
    } else {
        searchResults.innerHTML = `<h2>No results found for "${query}"</h2>`;
    }
}

function searchLocalTracks(query) {
    const allSongs = [];
    Object.values(defaultPlaylists).forEach(playlist => {
        allSongs.push(...playlist);
    });

    return allSongs.filter(song =>
        song.title.toLowerCase().includes(query.toLowerCase()) ||
        song.artist.toLowerCase().includes(query.toLowerCase())
    );
}

function playSearchResultMixed(index, songsJson) {
    try {
        const songs = JSON.parse(songsJson.replace(/&quot;/g, '"'));
        currentPlaylist = songs;
        currentIndex = index;

        const song = songs[index];
        if (song.isSoundCloud) {
            playSongWithSoundCloud(index);
        } else {
            playSong(index);
        }
    } catch (e) {
        console.error('Error playing mixed search result:', e);
    }
}


// === Main Entry Point — ES6 Module ===
import * as state from './modules/state.js';
import { defaultPlaylists } from './modules/data.js';
import * as player from './modules/player.js';
import * as playlist from './modules/playlist.js';
import * as search from './modules/search.js';
import * as navigation from './modules/navigation.js';
import * as ui from './modules/ui.js';
import * as auth from './modules/auth.js';
import * as visualizer from './modules/visualizer.js';
import * as home from './modules/home.js';
import * as gradient from './modules/gradient.js';
import * as profile from './modules/profile.js';

// Store module references for cross-module access
window.__modules = { player, playlist, search, navigation, ui, auth, visualizer, home, gradient, state, profile };

// === Window.* bridge for HTML onclick handlers ===

// Navigation
window.showHome = navigation.showHome;
window.showMobileLibrary = navigation.showMobileLibrary;
window.showSearch = navigation.showSearch;
window.showPlaylistPage = navigation.showPlaylistPage;
window.goBack = () => history.back();
window.goForward = () => history.forward();
window.navigate = navigation.navigate;

// Player
window.playSong = player.playSong;
window.togglePlay = player.togglePlay;
window.nextSong = player.nextSong;
window.previousSong = player.previousSong;
window.toggleShuffle = player.toggleShuffle;
window.toggleRepeat = player.toggleRepeat;
window.seekSong = player.seekSong;
window.playPlaylist = player.playPlaylist;
window.playPlaylistShuffled = player.playPlaylistShuffled;
window.playUserPlaylist = player.playUserPlaylist;
window.playLocalPlaylist = player.playLocalPlaylist;
window.playArtistSongs = player.playArtistSongs;
window.playSearchResult = player.playSearchResult;
window.playFromLiked = player.playFromLiked;
window.playPlaylistFromLiked = player.playPlaylistFromLiked;
window.playRecentlyPlayed = player.playRecentlyPlayed;
window.toggleMute = player.toggleMute;
window.changeVolume = player.changeVolume;
window.toggleLikeSong = player.toggleLikeSong;
window.shareSong = player.shareSong;
window.toggleMiniPlayer = player.toggleMiniPlayer;
window.setSleepTimer = player.setSleepTimerDuration;
window.clearSleepTimer = player.clearSleepTimer;
window.showSleepTimerMenu = player.showSleepTimerMenu;
window.cyclePlaybackSpeed = player.cyclePlaybackSpeed;
window.updateNowPlayingFullscreen = player.updateNowPlayingFullscreen;

// Search
window.debouncedSearch = search.debouncedSearch;
window.performSearch = search.performSearch;
window.searchCategory = search.searchCategory;
window.removeRecentSearch = search.removeRecentSearch;
window.clearRecentSearches = search.clearRecentSearches;

// Playlist
window.loadPlaylistContent = playlist.loadPlaylistContent;
window.toggleQueue = playlist.toggleQueue;
window.addToQueue = playlist.addToQueue;
window.removeFromQueue = playlist.removeFromQueue;
window.showLikedSongs = navigation.showLikedSongsNav;
window.sortPlaylistSongs = playlist.sortPlaylistSongs;
window.filterPlaylistSongs = playlist.filterPlaylistSongs;

// UI
window.showToast = ui.showToast;
window.closeModal = ui.closeModal;
window.toggleProfileMenu = ui.toggleProfileMenu;
window.showContextMenu = ui.showContextMenu;
window.hideContextMenu = ui.hideContextMenu;
window.contextPlayNext = ui.contextPlayNext;
window.contextAddToQueue = ui.contextAddToQueue;
window.contextToggleLike = ui.contextToggleLike;
window.contextShare = ui.contextShare;
window.contextGoToArtist = ui.contextGoToArtist;
window.openNowPlaying = ui.openNowPlaying;
window.closeNowPlaying = ui.closeNowPlaying;
window.filterLibrary = ui.filterLibrary;
window.searchLibrary = ui.searchLibrary;
window.toggleLibrarySort = ui.toggleLibrarySort;
window.toggleNotifications = ui.toggleNotifications;
window.addNotification = ui.addNotification;

// Auth
window.openLogin = auth.openLogin;
window.openSignup = auth.openSignup;
window.logout = auth.logout;
window.loginWithGoogle = auth.loginWithGoogle;
window.createPlaylist = auth.createPlaylist;
window.addSong = auth.addSong;
window.addSongToPlaylist = auth.addSongToPlaylist;
window.saveNewPlaylist = auth.saveNewPlaylist;
window.saveNewLocalPlaylist = auth.saveNewLocalPlaylist;
window.getLocalPlaylists = auth.getLocalPlaylists;
window.deleteLocalPlaylist = auth.deleteLocalPlaylist;
window.handleLogin = auth.handleLogin;
window.handleSignup = auth.handleSignup;
window.showAuthTab = auth.showAuthTab;

// Visualizer
window.toggleEQ = visualizer.toggleEQ;
window.setEQBand = visualizer.setEQBand;
window.applyEQPreset = visualizer.applyEQPreset;
window.toggleLyrics = visualizer.toggleLyrics;

// Home
window.playMadeForYou = home.playMadeForYou;

// Gradient
window.applyGradientFromImage = gradient.applyGradientFromImage;
window.resetGradient = gradient.resetGradient;

// API playlist/artist playback
window.playApiPlaylist = (index) => {
    const songs = window.__apiPlaylistSongs || [];
    if (songs.length === 0) return;
    import('./modules/state.js').then(state => {
        state.setCurrentPlaylist(songs);
        state.setCurrentIndex(index);
        player.playSong(index);
    });
};
window.playApiArtistSongs = async (artistId) => {
    const songs = window.__apiArtistSongs || [];
    if (songs.length === 0) return;
    import('./modules/state.js').then(state => {
        state.setCurrentPlaylist(songs);
        state.setCurrentIndex(0);
        player.playSong(0);
    });
};
window.playApiArtistSong = (index) => {
    const songs = window.__apiArtistSongs || [];
    if (songs.length === 0) return;
    import('./modules/state.js').then(state => {
        state.setCurrentPlaylist(songs);
        state.setCurrentIndex(index);
        player.playSong(index);
    });
};

// Expose state references for context menu / inline handlers
window.__defaultPlaylists = defaultPlaylists;
Object.defineProperty(window, '__recentlyPlayed', { get: () => state.recentlyPlayed });
Object.defineProperty(window, '__lastSearchResults', { get: () => state.lastSearchResults });
Object.defineProperty(window, '__likedSongs', { get: () => state.likedSongs });

// === Initialize ===
function init() {
    // Render home feed first so content is visible immediately
    navigation.updateTimeGreeting();
    home.renderHomeFeed();

    try {
        player.initializeVolume();
        playlist.loadRecentlyPlayed();
        player.loadLikedSongs();
        player.initDraggableProgress();
        player.setupCrossfadeListener();
        player.restorePlaybackState();
        player.setupAudioListeners();
        ui.setupKeyboardShortcuts();
        ui.initMobileTouchGestures();
        auth.setupAuthListeners();
        playlist.loadUserPlaylists();

        // Restore local song blob URLs from IndexedDB
        auth.restoreLocalSongUrls().catch(e => console.error('Local songs restore error:', e));
    } catch (e) {
        console.error('Init error:', e);
    }

    // Update greeting every minute
    setInterval(navigation.updateTimeGreeting, 60000);

    // Setup hash router
    window.addEventListener('hashchange', navigation.handleRouteChange);

    // Handle initial route (or default to home)
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
        // Already showing home — just ensure hash is set
        if (hash !== '#/') {
            history.replaceState(null, '', '#/');
        }
    } else {
        // Deep link — navigate to the correct page
        navigation.handleRouteChange();
    }
}

init();

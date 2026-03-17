// === Centralized Application State ===

export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001/api' 
    : 'https://major-project-kuxn.onrender.com/api';
export let authToken = null;
export let currentUser = null;
export let userPlaylists = [];
export let currentSong = null;
export let isPlaying = false;
export let currentPlaylist = [];
export let currentIndex = 0;
export let isShuffled = false;
export let isMuted = false;
export let previousVolume = 0.7;
export let isRepeated = false;
export let lastSearchResults = [];
export let lastSearchQuery = '';
export let searchDebounceTimer = null;

// New feature globals
export let recentlyPlayed = [];
export const MAX_RECENT = 20;
export let isDraggingProgress = false;
export let likedSongs = [];
export let songQueue = [];
export let isQueueOpen = false;
export let audioContext = null;
export let analyserNode = null;
export let sourceNode = null;
export let visualizerAnimationId = null;
export let eqFilters = [];
export let eqIsOpen = false;
export let isLyricsOpen = false;
export let crossfadeDuration = 0;
export let crossfadeTimer = null;
export let isCrossfading = false;
export let activePlayer = 'A';
export let contextMenuSong = null;
export let sleepTimer = null;
export let sleepTimerRemaining = 0;
export let sleepTimerInterval = null;
export let playbackRate = 1.0;
export let isDraggingVolume = false;

// Setters for state that needs mutation from other modules
export function setAuthToken(val) { authToken = val; }
export function setCurrentUser(val) { currentUser = val; }
export function setUserPlaylists(val) { userPlaylists = val; }
export function setCurrentSong(val) { currentSong = val; }
export function setIsPlaying(val) { isPlaying = val; }
export function setCurrentPlaylist(val) { currentPlaylist = val; }
export function setCurrentIndex(val) { currentIndex = val; }
export function setIsShuffled(val) { isShuffled = val; }
export function setIsMuted(val) { isMuted = val; }
export function setPreviousVolume(val) { previousVolume = val; }
export function setIsRepeated(val) { isRepeated = val; }
export function setLastSearchResults(val) { lastSearchResults = val; }
export function setLastSearchQuery(val)   { lastSearchQuery = val; }
export function setSearchDebounceTimer(val) { searchDebounceTimer = val; }
export function setRecentlyPlayed(val) { recentlyPlayed = val; }
export function setIsDraggingProgress(val) { isDraggingProgress = val; }
export function setLikedSongs(val) { likedSongs = val; }
export function setSongQueue(val) { songQueue = val; }
export function setIsQueueOpen(val) { isQueueOpen = val; }
export function setAudioContext(val) { audioContext = val; }
export function setAnalyserNode(val) { analyserNode = val; }
export function setSourceNode(val) { sourceNode = val; }
export function setVisualizerAnimationId(val) { visualizerAnimationId = val; }
export function setEqFilters(val) { eqFilters = val; }
export function setEqIsOpen(val) { eqIsOpen = val; }
export function setIsLyricsOpen(val) { isLyricsOpen = val; }
export function setCrossfadeDuration(val) { crossfadeDuration = val; }
export function setCrossfadeTimer(val) { crossfadeTimer = val; }
export function setIsCrossfading(val) { isCrossfading = val; }
export function setActivePlayer(val) { activePlayer = val; }
export function setContextMenuSong(val) { contextMenuSong = val; }
export function setSleepTimer(val) { sleepTimer = val; }
export function setSleepTimerRemaining(val) { sleepTimerRemaining = val; }
export function setSleepTimerInterval(val) { sleepTimerInterval = val; }
export function setPlaybackRate(val) { playbackRate = val; }
export function setIsDraggingVolume(val) { isDraggingVolume = val; }

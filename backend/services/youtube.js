const youtubedl = require('youtube-dl-exec');
const axios     = require('axios');
const path      = require('path');
const fs        = require('fs');

// ─── Cookies for yt-dlp ───────────────────────────────────────────────────────
// Place cookies.txt in backend/ root (export from Chrome using
// "Get cookies.txt LOCALLY" extension while logged into YouTube).
// Use locally downloaded yt-dlp binary (downloaded by start script).
const LOCAL_YTDLP = path.join(__dirname, '..', 'yt-dlp');
const YTDLP_BIN   = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
console.log('yt-dlp binary:', YTDLP_BIN);

const COOKIES_FILE = path.join(__dirname, '..', 'cookies.txt');
const COOKIES_OPT  = fs.existsSync(COOKIES_FILE) ? { cookies: COOKIES_FILE } : {};
console.log('yt-dlp cookies:', fs.existsSync(COOKIES_FILE) ? 'LOADED ✓' : 'NOT FOUND — bot detection active');

// ─── YouTube Data API v3 ──────────────────────────────────────────────────────
// Used for all search/recommendations — official API, no scraping, no breakage.
// Get your key from https://console.cloud.google.com → APIs → YouTube Data API v3
const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_API     = 'https://www.googleapis.com/youtube/v3';

// ─── Cache ────────────────────────────────────────────────────────────────────
const CACHE        = new Map();
const STREAM_TTL   = 10 * 60 * 1000;   // 10 min
const SEARCH_TTL   = 60 * 60 * 1000;   // 1 hour — saves quota
const TRENDING_TTL = 60 * 60 * 1000;   // 1 hour — saves quota

function getCached(key, ttl) {
    const entry = CACHE.get(key);
    if (entry && Date.now() - entry.time < ttl) return entry.data;
    if (entry) CACHE.delete(key);
    return null;
}
function setCache(key, data) {
    CACHE.set(key, { data, time: Date.now() });
    if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value);
}

// ─── Normalisation ────────────────────────────────────────────────────────────
const CHANNEL_NOISE = /\bVEVO\b|\bOfficial\b|\bMusic\b|\bRecords\b|\bEntertainment\b|\bTopic\b|\bProductions\b|\bRecordings\b|\bChannel\b/gi;

function parseDuration(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    // ISO 8601 duration from YouTube API: PT3M45S
    const iso = String(str).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (iso) {
        return (parseInt(iso[1] || 0) * 3600) + (parseInt(iso[2] || 0) * 60) + parseInt(iso[3] || 0);
    }
    // Fallback: "3:45" string
    const parts = String(str).trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

function normalizeApiVideo(item) {
    const id      = item.id?.videoId || item.id;
    const snippet = item.snippet || {};
    const content = item.contentDetails || {};
    if (!id) return null;

    const rawArtist   = snippet.channelTitle || 'Unknown Artist';
    const cleanArtist = rawArtist.replace(CHANNEL_NOISE, '').trim() || rawArtist;

    return {
        id, sourceId: id, source: 'youtube',
        title:    snippet.title || '',
        artist:   cleanArtist,
        artistId: snippet.channelId || '',
        album: '', url: '', hasLyrics: true, year: '', language: '',
        image:    snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
        duration: parseDuration(content.duration) || 0,
    };
}

function getFingerprint(title, artist) {
    const a = (artist || '').replace(CHANNEL_NOISE, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const t = (title  || '')
        .toLowerCase()
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/\b(official|video|audio|lyrics|hd|4k|remastered|version|feat|ft|prod|hq|single)\b/gi, '')
        .replace(/[^a-z0-9]/g, '');
    return `${t}|${a}`;
}

// ─── YouTube Data API v3 search ───────────────────────────────────────────────
async function apiSearch(query, maxResults = 8) {
    if (!YT_API_KEY) {
        console.warn('YOUTUBE_API_KEY not set — search unavailable');
        return [];
    }

    const cacheKey = `yt:apisearch:${query}:${maxResults}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    try {
        // Step 1: search for video IDs
        const searchRes = await axios.get(`${YT_API}/search`, {
            params: {
                key:        YT_API_KEY,
                q:          query,
                part:       'snippet',
                type:       'video',
                maxResults,
                videoCategoryId: '10', // Music
                videoDuration:   'medium',
                safeSearch:      'none',
            },
            timeout: 8000,
        });

        const items = searchRes.data.items || [];
        if (!items.length) return [];

        // Step 2: get durations via videos endpoint
        const ids = items.map(i => i.id.videoId).join(',');
        const detailRes = await axios.get(`${YT_API}/videos`, {
            params: { key: YT_API_KEY, id: ids, part: 'contentDetails,snippet' },
            timeout: 8000,
        });

        const details   = {};
        (detailRes.data.items || []).forEach(v => { details[v.id] = v; });

        const songs = items
            .map(item => {
                const detail = details[item.id.videoId];
                return normalizeApiVideo(detail || item);
            })
            .filter(Boolean);

        setCache(cacheKey, songs);
        return songs;
    } catch (err) {
        console.error('YouTube API search error:', err.response?.data?.error?.message || err.message);
        return [];
    }
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function searchSongs(query, limit = 20) {
    return apiSearch(query + ' official audio', limit);
}

async function searchArtists(query, limit = 10) {
    if (!YT_API_KEY) return [];
    const cacheKey = `yt:artists:${query}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    try {
        const res = await axios.get(`${YT_API}/search`, {
            params: {
                key: YT_API_KEY, q: query,
                part: 'snippet', type: 'channel', maxResults: limit,
            },
            timeout: 8000,
        });
        const artists = (res.data.items || []).map(item => ({
            id:    item.id.channelId,
            name:  item.snippet.channelTitle,
            image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
            role:  'Artist',
        }));
        setCache(cacheKey, artists);
        return artists;
    } catch (err) {
        console.error('YouTube API channel search error:', err.message);
        return [];
    }
}

async function searchAll(query, limit = 20) {
    const cacheKey = `yt:all:${query}:${limit}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const [songs, artists] = await Promise.all([
        searchSongs(query, limit),
        searchArtists(query, 6),
    ]);

    const result = { songs, artists };
    setCache(cacheKey, result);
    return result;
}

// ─── Recommendations helper ───────────────────────────────────────────────────
async function apiSearchMultiple(queries, total = 20) {
    // Only use first query to conserve YouTube API quota (100 units per search)
    const settled = await Promise.allSettled(queries.slice(0, 1).map(q => apiSearch(q, total)));
    const seen    = new Set();
    const results = [];

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const song of outcome.value) {
            if (results.length >= total) break;
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp)) { seen.add(fp); results.push(song); }
        }
    }
    return results.sort(() => Math.random() - 0.5).slice(0, total);
}

// ─── Trending ─────────────────────────────────────────────────────────────────
const TRENDING_SEEDS = [
    'top pop hits 2025 official audio',
    'bollywood new songs 2025 official',
    'punjabi hits 2025 official audio',
    'trending english songs 2025 official audio',
    'latest hindi songs 2025 official',
    'global hits 2025 official audio',
];

async function getTrendingRecommendations(count = 20) {
    const slot     = Math.floor(Date.now() / TRENDING_TTL);
    const cacheKey = `yt:trending:${slot}`;
    const cached   = getCached(cacheKey, TRENDING_TTL);
    if (cached) return cached;

    const seeds   = [...TRENDING_SEEDS].sort(() => Math.random() - 0.5).slice(0, 4);
    const results = await apiSearchMultiple(seeds, count);
    setCache(cacheKey, results);
    return results;
}

// ─── Genre ────────────────────────────────────────────────────────────────────
const GENRE_QUERIES = {
    pop:        ['top pop songs 2025 official audio', 'popular pop music 2025 official'],
    hiphop:     ['hip hop hits 2025 official audio', 'rap songs 2025 official audio'],
    bollywood:  ['bollywood hits 2025 official audio', 'new hindi songs 2025 official'],
    punjabi:    ['punjabi hits 2025 official audio', 'new punjabi songs 2025 official'],
    rock:       ['rock hits official audio', 'classic rock songs official audio'],
    indie:      ['indie pop 2025 official audio', 'indie songs 2025 official audio'],
    rnb:        ['r&b songs 2025 official audio', 'soul music 2025 official'],
    jazz:       ['jazz songs official audio', 'smooth jazz official audio'],
    electronic: ['electronic music 2025 official audio', 'edm hits 2025 official'],
    lofi:       ['lofi hip hop official audio', 'chill lofi songs official'],
    latin:      ['latin hits 2025 official audio', 'reggaeton 2025 official'],
    kpop:       ['kpop hits 2025 official audio', 'kpop songs 2025 official audio'],
};

async function getGenreSongs(genre, limit = 12, page = 0) {
    const key      = genre.toLowerCase().replace(/[^a-z]/g, '');
    const cacheKey = `yt:genre:${key}:${page}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const allQ   = GENRE_QUERIES[key] || [`${genre} songs official audio`, `best ${genre} music official`];
    const startIdx = (page * 2) % allQ.length;
    const queries  = [allQ[startIdx], allQ[(startIdx + 1) % allQ.length]];

    const results = await apiSearchMultiple(queries, limit);
    setCache(cacheKey, results);
    return results;
}

// ─── New releases ─────────────────────────────────────────────────────────────
async function getNewReleases(count = 20) {
    const slot     = Math.floor(Date.now() / (30 * 60 * 1000));
    const cacheKey = `yt:newreleases:${slot}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const queries = [
        'new songs this week 2025 official audio',
        'new music march 2025 official audio',
        'latest english songs 2025 official audio',
        'new bollywood songs 2025 official',
    ];
    const results = await apiSearchMultiple(queries.slice(0, 3), count);
    setCache(cacheKey, results);
    return results;
}

// ─── Charts ───────────────────────────────────────────────────────────────────
async function getChartSongs(count = 20) {
    const slot     = Math.floor(Date.now() / (30 * 60 * 1000));
    const cacheKey = `yt:charts:${slot}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const queries = [
        'billboard hot 100 2025 official audio',
        'top india songs 2025 official audio',
        'global top songs 2025 official audio',
    ];
    const results = await apiSearchMultiple(queries, count);
    setCache(cacheKey, results);
    return results;
}

// ─── Mood ─────────────────────────────────────────────────────────────────────
const MOOD_QUERIES = {
    chill:     ['chill songs official audio', 'relaxing music 2025 official'],
    workout:   ['workout songs 2025 official audio', 'gym motivation music official'],
    party:     ['party songs 2025 official audio', 'dance hits 2025 official'],
    focus:     ['focus music official audio', 'study music songs official'],
    romance:   ['romantic songs official audio', 'love songs 2025 official'],
    happy:     ['happy songs official audio', 'feel good music 2025 official'],
    sad:       ['sad songs official audio', 'emotional songs 2025 official'],
    latenight: ['late night songs official audio', 'midnight vibes songs official'],
    drive:     ['driving songs official audio', 'road trip music 2025 official'],
    morning:   ['morning songs official audio', 'energetic songs 2025 official'],
    punjabi:   ['punjabi hits 2025 official audio', 'new punjabi songs official'],
    rock:      ['rock songs official audio', 'rock hits official audio'],
};

async function getMoodSongs(mood, limit = 12, page = 0) {
    const key      = mood.toLowerCase().replace(/[^a-z]/g, '');
    const cacheKey = `yt:mood:${key}:${page}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const allQ     = MOOD_QUERIES[key] || [`${mood} songs official audio`, `best ${mood} music official`];
    const startIdx = (page * 2) % allQ.length;
    const queries  = [allQ[startIdx], allQ[(startIdx + 1) % allQ.length]];

    const results = await apiSearchMultiple(queries, limit);
    setCache(cacheKey, results);
    return results;
}

// ─── Artist ───────────────────────────────────────────────────────────────────
async function getArtistById(artistName) {
    const cacheKey = `yt:artist:${artistName}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const songs  = await searchSongs(`${artistName} official audio`, 20);
    const result = {
        id: artistName, name: artistName,
        image: songs[0]?.image || '',
        followerCount: 0, isVerified: false,
        bio: [], topSongs: songs, singles: [], albums: [],
    };
    setCache(cacheKey, result);
    return result;
}

async function getArtistSongs(artistName, page = 0) {
    const cacheKey = `yt:artistsongs:${artistName}:${page}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const results = await searchSongs(`${artistName} official audio`, 20);
    setCache(cacheKey, results);
    return results;
}

// ─── Personalized recommendations ─────────────────────────────────────────────
async function getPersonalizedRecommendations(accessToken, refreshToken, userId = null) {
    try {
        let response;
        try {
            response = await axios.get(`${YT_API}/videos`, {
                params: { part: 'snippet,contentDetails', myRating: 'like', maxResults: 50, videoCategoryId: '10' },
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 8000,
            });
        } catch (err) {
            if (err.response?.status === 401 && refreshToken) {
                const tokenData = await refreshAccessToken(refreshToken);
                if (tokenData?.access_token) {
                    if (userId) {
                        const User = require('../models/User');
                        await User.findByIdAndUpdate(userId, { googleAccessToken: tokenData.access_token });
                    }
                    return getPersonalizedRecommendations(tokenData.access_token, refreshToken, userId);
                }
            }
            throw err;
        }

        const likedVideos = response.data.items || [];
        if (!likedVideos.length) return getTrendingRecommendations(20);

        const artistCounts = {};
        for (const v of likedVideos) {
            const a = v.snippet.channelTitle.replace(CHANNEL_NOISE, '').trim();
            if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
        }

        const artistPool = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name]) => name).sort(() => Math.random() - 0.5).slice(0, 5);

        const queries = artistPool.map(a => `${a} official audio`);
        return await apiSearchMultiple(queries, 20);
    } catch (err) {
        console.error('Personalized recs error:', err.message);
        return getTrendingRecommendations(20);
    }
}

async function getProfileBasedRecommendations(tasteProfile, count = 20) {
    const { likedSongs = [], recentlyPlayed = [] } = tasteProfile;

    const artistScore = {};
    const addArtist   = (artist, weight) => {
        if (!artist || artist === 'Unknown Artist') return;
        const clean = artist.replace(CHANNEL_NOISE, '').trim().toLowerCase();
        if (clean.length < 2) return;
        artistScore[clean] = (artistScore[clean] || 0) + weight;
    };
    likedSongs.forEach(s     => addArtist(s.artist, 3));
    recentlyPlayed.forEach(s => addArtist(s.artist, 2));

    const topArtists = Object.entries(artistScore)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name]) => name).sort(() => Math.random() - 0.5).slice(0, 5);

    if (!topArtists.length) return getTrendingRecommendations(count);

    const queries = topArtists.map(a => `${a} official audio`);
    const results = await apiSearchMultiple(queries, count);
    return results.length ? results : getTrendingRecommendations(count);
}

// ─── Stream (yt-dlp) ──────────────────────────────────────────────────────────
const _inflight = new Map();

async function getStreamUrl(videoId) {
    const cacheKey = `yt:stream:${videoId}`;
    const cached   = getCached(cacheKey, STREAM_TTL);
    if (cached) return cached;

    if (_inflight.has(videoId)) return _inflight.get(videoId);
    const promise = _fetchStreamUrl(videoId, cacheKey).finally(() => _inflight.delete(videoId));
    _inflight.set(videoId, promise);
    return promise;
}

async function _fetchStreamUrl(videoId, cacheKey) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const { execFile } = require('child_process');

        // Build args — works with both old and new yt-dlp versions
        const args = [
            url,
            '--get-url',
            '--no-check-certificates',
            '--no-warnings',
            '--no-playlist',
            '--extractor-args', 'youtube:player_client=android,web',
        ];
        // Temporarily disabled cookies to test if they're causing crashes
        // if (COOKIES_OPT.cookies) args.push('--cookies', COOKIES_OPT.cookies);

        console.log('yt-dlp cmd:', YTDLP_BIN, args.slice(0,3).join(' '));

        const rawOutput = await new Promise((resolve, reject) => {
            execFile(YTDLP_BIN, args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                    const msg = (stderr || stdout || err.message || '').trim();
                    console.error('yt-dlp full error:', msg.slice(0, 800));
                    return reject(new Error(msg || 'yt-dlp command failed'));
                }
                resolve(stdout);
            });
        });

        const audioUrl = (typeof rawOutput === 'string' ? rawOutput : String(rawOutput))
            .split('\n').map(l => l.trim()).filter(l => l.startsWith('http'))[0];

        if (!audioUrl) return null;

        const cleanUrl = (() => {
            try {
                const u = new URL(audioUrl);
                ['begin', 'rn', 'initrnums', 'ratebypass'].forEach(p => u.searchParams.delete(p));
                return u.toString();
            } catch { return audioUrl; }
        })();

        const mimeType = cleanUrl.includes('.m4a') || cleanUrl.includes('mime=audio%2Fmp4') ? 'audio/mp4' : 'audio/webm';
        const result   = { url: cleanUrl, mimeType, bitrate: 128, duration: 0, title: '', artist: '', thumbnail: '' };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('YouTube get stream error:', err.message);
        return null;
    }
}

function prewarmStream(videoId) {
    if (!videoId) return;
    const cacheKey = `yt:stream:${videoId}`;
    if (getCached(cacheKey, STREAM_TTL)) return;
    getStreamUrl(videoId).catch(() => {});
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────
async function refreshAccessToken(refreshToken) {
    try {
        const res = await axios.post('https://oauth2.googleapis.com/token', {
            client_id:     process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type:    'refresh_token',
        });
        return res.data;
    } catch (err) {
        console.error('Refresh token error:', err.response?.data || err.message);
        return null;
    }
}

// ─── Normalise (kept for backward compat) ────────────────────────────────────
function normalizeSong(item) {
    if (!item) return null;
    const id = item.id || item.url?.match(/[?&]v=([^&]+)/)?.[1] || '';
    if (!id) return null;
    const rawArtist   = item.author?.name || item.owner?.name || 'Unknown Artist';
    const cleanArtist = rawArtist.replace(CHANNEL_NOISE, '').trim() || rawArtist;
    return {
        id, sourceId: id, source: 'youtube',
        title:    item.title || '',
        artist:   cleanArtist,
        artistId: item.author?.channelID || '',
        album: '', url: '', hasLyrics: true, year: '', language: '',
        image:    item.bestThumbnail?.url || item.thumbnails?.[0]?.url || '',
        duration: parseDuration(item.duration) || 0,
    };
}

module.exports = {
    searchSongs, searchArtists, searchAll,
    getStreamUrl, prewarmStream, getArtistById, getArtistSongs,
    normalizeSong, getTrendingRecommendations,
    getPersonalizedRecommendations, getProfileBasedRecommendations,
    refreshAccessToken,
    getGenreSongs, getNewReleases, getChartSongs, getMoodSongs,
};

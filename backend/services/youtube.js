const ytsr = require('ytsr');
const youtubedl = require('youtube-dl-exec');
const axios = require('axios');

const CACHE = new Map();
const STREAM_TTL  = 5  * 60 * 1000;   // 5 min  — stream URLs expire
const SEARCH_TTL  = 10 * 60 * 1000;   // 10 min — search/recs
const TRENDING_TTL= 15 * 60 * 1000;   // 15 min — trending seeds rotate

// ─── Music filter ────────────────────────────────────────────────────────────
//
// Two-stage gate:
//   1. Hard disqualifiers  → score -1, item dropped immediately
//   2. Positive scoring    → items ranked so best candidates surface first
//
// Key insight: ytsr returns duration as "3:45" string or null/undefined.
// YouTube Shorts are <= 60 s but often come back with no duration at all.
// We use the #shorts hashtag and isShort flag as additional guards.

// ── Hard disqualifiers ─────────────────────────────────────────────────────
// Titles that indicate a music video (has visuals) — we only want audio
const VIDEO_TITLE = /\b(official\s+(music\s+)?video|music\s+video|\bmv\b|official\s+mv|video\s+clip|(?<![a-z])m\/v(?![a-z])|full\s+(mv|video)|hd\s+video|4k\s+video)\b/i;

const GARBAGE_TITLE = /\b(mix|mixtape|\d+\s*hour|\d+\s*hr|nonstop|non.stop|mashup|medley|compilation|full\s+album|full\s+ep|best\s+of|greatest\s+hits|top\s+\d+\s+songs|playlist|dj\s+set|live\s+set|podcast|episode|react(ion)?|review|explained|tutorial|how\s+to|gameplay|gaming|stream\s+highlights|trailer|teaser|interview|behind\s+the\s+scenes|making\s+of|breakdown|study\s+with|sleep\s+with|lofi\s+\d|ambient\s+\d|chill\s+beats\s+\d|background\s+music\s+\d)(\s|$)/i;

// #shorts appears as a hashtag in title or description
const SHORTS_PATTERN = /#shorts?\b/i;

const GARBAGE_CHANNEL = /\b(gaming|gameplay|podcast|news|clips|highlights|vlog|react|reaction|review|tutorial|learn|study|education|comedy|funny|prank|challenge|motivation|meditation)\b/i;

// ── Positive audio signals ──────────────────────────────────────────────────
// These strongly indicate an audio-only upload
const AUDIO_TITLE   = /\b(official\s+audio|lyrics?\s*(video)?|lyric\s+video|audio\s+version|full\s+song|official\s+song|audio\s+only|\(audio\)|\[audio\])\b/i;
const MUSIC_CHANNEL = /\b(VEVO|Records|Music|Entertainment|Official|Topic|Productions|Recordings|Label|Audio|Sound)\b/i;
const CHANNEL_NOISE = /\bVEVO\b|\bOfficial\b|\bMusic\b|\bRecords\b|\bEntertainment\b|\bTopic\b|\bProductions\b|\bRecordings\b|\bChannel\b/gi;

function parseDuration(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const parts = String(str).trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60  + parts[1];
    return parts[0] || 0;
}

function isShortsItem(item) {
    // ytsr marks Shorts explicitly in newer versions
    if (item.isShort) return true;
    // #shorts in title
    if (SHORTS_PATTERN.test(item.title || '')) return true;
    // Known-short duration
    const dur = parseDuration(item.duration);
    if (dur > 0 && dur < 62) return true;
    return false;
}

function scoreSong(item) {
    const title   = (item.title   || '').trim();
    const channel = (item.author?.name || '').trim();
    const dur     = parseDuration(item.duration);

    if (!title)                          return -1;
    if (isShortsItem(item))              return -1;   // Shorts dropped first
    if (GARBAGE_TITLE.test(title))       return -1;
    if (GARBAGE_CHANNEL.test(channel))   return -1;
    // Duration gate: if we know it and it's > 10 min → probably a mix/live set
    if (dur > 0 && dur > 600)            return -1;

    // Hard-exclude music videos — we only want audio
    if (VIDEO_TITLE.test(title))         return -1;

    let score = 0;
    if (/- topic$/i.test(channel))       score += 6;  // YouTube auto-gen = always audio
    if (AUDIO_TITLE.test(title))         score += 5;  // explicit audio signals
    if (/vevo/i.test(channel))           score += 3;  // VEVO uploads both; lower than topic
    if (MUSIC_CHANNEL.test(channel))     score += 2;
    if (/official/i.test(channel))       score += 1;
    if (dur >= 90  && dur <= 360)        score += 2;  // typical song: 1:30–6:00
    if (dur > 360  && dur <= 600)        score += 0;  // allowed but not preferred

    return score;
}

function filterToSongs(items, limit = 20) {
    const scored = [];
    for (const item of items) {
        if (item.type !== 'video') continue;
        const s = scoreSong(item);
        if (s >= 0) scored.push({ item, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map(({ item }) => normalizeSong(item)).filter(Boolean);
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

// ─── Search ──────────────────────────────────────────────────────────────────
// Speed fix: fetch only 25 items (was 60) with NO appended qualifier string.
// The qualifier was slowing ytsr AND distorting artist-name searches.
// Filtering + scoring does the quality work instead.

async function searchAll(query, limit = 20) {
    const cacheKey = `yt:all2:${query}:${limit}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    try {
        // Appending "official audio" biases ytsr toward audio-only uploads at the
        // network level before our scoring filter even runs — much fewer videos slip through.
        // We only add it if the query doesn't already contain an audio/video qualifier.
        const audioQualifier = /\b(audio|lyrics?|lyric|video|mv|vevo)\b/i.test(query) ? '' : ' official audio';
        const data = await ytsr(query + audioQualifier, { limit: 25 });

        const songs   = filterToSongs(data.items, limit);
        const artists = data.items
            .filter(i => i.type === 'channel')
            .map(normalizeChannel)
            .filter(Boolean)
            .slice(0, 6);

        const result = { songs, artists };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('YouTube search error:', err.message);
        return { songs: [], artists: [] };
    }
}

async function searchSongs(query, limit = 20) {
    return (await searchAll(query, limit)).songs;
}

async function searchArtists(query, limit = 10) {
    return (await searchAll(query, limit)).artists;
}

// ─── Trending recommendations (no auth) ──────────────────────────────────────
// Each seed is tight enough that ytsr returns mostly real music.
// We fetch in parallel (Promise.allSettled) to eliminate sequential wait.

const TRENDING_SEEDS = [
    'top pop hits 2024 official audio',
    'bollywood new songs 2024 official',
    'punjabi hits 2024 official audio',
    'trending english songs 2024 official audio',
    'latest hindi songs 2024 official',
    'global hits 2024 official audio',
    'new music 2024 official audio',
    'indie pop 2024 official audio',
];

async function getTrendingRecommendations(count = 20) {
    // Slot key changes every 15 min so the feed rotates
    const slot     = Math.floor(Date.now() / TRENDING_TTL);
    const cacheKey = `yt:trending2:${slot}`;
    const cached   = getCached(cacheKey, TRENDING_TTL);
    if (cached) return cached;

    // Pick 4 seeds and fetch them ALL IN PARALLEL
    const seeds = [...TRENDING_SEEDS].sort(() => Math.random() - 0.5).slice(0, 4);

    const settled = await Promise.allSettled(
        seeds.map(seed => ytsr(seed, { limit: 20 }))
    );

    const seen    = new Set();
    const results = [];

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        const songs = filterToSongs(outcome.value.items, 10);
        for (const song of songs) {
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp) && results.length < count) {
                seen.add(fp);
                results.push(song);
            }
        }
    }

    setCache(cacheKey, results);
    return results;
}

// ─── Personalized recommendations (Google OAuth) ──────────────────────────────

async function getPersonalizedRecommendations(accessToken, refreshToken, userId = null) {
    try {
        let response;
        try {
            response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'snippet,contentDetails',
                    myRating: 'like',
                    maxResults: 50,
                    videoCategoryId: '10',
                },
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

        // Build artist pool from liked videos
        const artistCounts = {};
        for (const v of likedVideos) {
            const a = v.snippet.channelTitle.replace(CHANNEL_NOISE, '').trim();
            if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
        }

        const artistPool = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([name]) => name)
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);   // 5 artists → 5 parallel searches

        const wildcards = [...likedVideos]
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);

        const variants = ['official audio', 'lyrics', 'audio'];
        const searchQueries = [
            ...artistPool.map(a => `${a} ${variants[Math.floor(Math.random() * variants.length)]}`),
            ...wildcards.map(v => `${v.snippet.title.split(/[-–(]/)[0].trim()} official audio`),
        ];

        const seenIds = new Set(likedVideos.map(v => v.id));
        const seenFps = new Set(
            likedVideos.map(v => getFingerprint(v.snippet.title, v.snippet.channelTitle))
        );

        // Fetch all seeds IN PARALLEL — eliminates the sequential loop that was
        // the biggest source of latency in the old implementation
        const settled = await Promise.allSettled(
            searchQueries.map(q =>
                axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        q,
                        type: 'video',
                        maxResults: 15,
                        videoCategoryId: '10',
                        videoDuration: 'medium',   // 4–20 min — excludes Shorts & long mixes
                        safeSearch: 'none',
                    },
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 8000,
                })
            )
        );

        const recommendations = [];

        for (const outcome of settled) {
            if (outcome.status !== 'fulfilled') continue;
            const items = (outcome.value.data.items || []).sort(() => Math.random() - 0.5);

            for (const item of items) {
                if (recommendations.length >= 20) break;
                const title   = item.snippet.title;
                const channel = item.snippet.channelTitle;
                const videoId = item.id.videoId;

                if (seenIds.has(videoId)) continue;

                // Apply garbage filter (no duration from search API, but videoDuration=medium already excludes Shorts)
                const fakeItem = { title, author: { name: channel }, duration: 0 };
                if (scoreSong(fakeItem) < 0) continue;

                const fp = getFingerprint(title, channel);
                if (seenFps.has(fp)) continue;

                recommendations.push({
                    id: videoId, sourceId: videoId, source: 'youtube',
                    title,
                    artist:   channel.replace(CHANNEL_NOISE, '').trim() || channel,
                    artistId: item.snippet.channelId || '',
                    album: '', url: '', hasLyrics: true, year: '', language: '',
                    duration: 0,
                    image: item.snippet.thumbnails.high?.url
                        || item.snippet.thumbnails.medium?.url
                        || item.snippet.thumbnails.default?.url || '',
                });

                seenIds.add(videoId);
                seenFps.add(fp);
            }
        }

        const final = recommendations.sort(() => Math.random() - 0.5).slice(0, 20);
        return final.length ? final : getTrendingRecommendations(20);

    } catch (err) {
        console.error('Personalized recs error:', err.message);
        return getTrendingRecommendations(20);
    }
}

// ─── Cache ───────────────────────────────────────────────────────────────────

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

// ─── Normalisation ───────────────────────────────────────────────────────────

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

function normalizeChannel(item) {
    if (!item) return null;
    return {
        id:    item.channelID || item.name || '',
        name:  item.name || '',
        image: item.bestAvatar?.url || item.avatars?.[0]?.url || '',
        role: 'Artist',
    };
}

// ─── Stream & artist helpers ─────────────────────────────────────────────────

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

// In-flight promise map — prevents duplicate yt-dlp calls for the same video
const _inflight = new Map();

async function getStreamUrl(videoId) {
    const cacheKey = `yt:stream:${videoId}`;
    const cached = getCached(cacheKey, STREAM_TTL);
    if (cached) return cached;

    // If another request is already fetching this video, wait for it
    if (_inflight.has(videoId)) return _inflight.get(videoId);

    const promise = _fetchStreamUrl(videoId, cacheKey).finally(() => _inflight.delete(videoId));
    _inflight.set(videoId, promise);
    return promise;
}

async function _fetchStreamUrl(videoId, cacheKey) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // --get-url is 3-5x faster than --dump-single-json because yt-dlp only
        // needs to resolve the format URL — it skips downloading full metadata.
        // We request the best audio-only format explicitly.
        // Use cookies.txt if present — bypasses YouTube bot-detection on cloud IPs
        const _path = require('path');
        const _fs   = require('fs');
        const cookiesFile = _path.join(__dirname, '..', 'cookies.txt');
        const cookiesOpt  = _fs.existsSync(cookiesFile) ? { cookies: cookiesFile } : {};

        const rawOutput = await youtubedl(url, {
            getUrl: true,
            noCheckCertificates: true,
            noWarnings: true,
            format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            noPlaylist: true,
            ...cookiesOpt,
        });

        // yt-dlp --get-url can return multiple lines (one per format); take the first
        const audioUrl = (typeof rawOutput === 'string' ? rawOutput : String(rawOutput))
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.startsWith('http'))[0];

        if (!audioUrl) return null;

        // Strip parameters that encode a non-zero start offset into the CDN URL.
        // yt-dlp sometimes returns URLs with &begin=NNNN (milliseconds) or &rn=N
        // which cause the browser to start playback mid-song.
        const cleanUrl = (() => {
            try {
                const u = new URL(audioUrl);
                ['begin', 'rn', 'initrnums', 'ratebypass'].forEach(p => u.searchParams.delete(p));
                return u.toString();
            } catch { return audioUrl; }
        })();

        // Detect mime type from URL extension
        const mimeType = cleanUrl.includes('.m4a') || cleanUrl.includes('mime=audio%2Fmp4')
            ? 'audio/mp4'
            : 'audio/webm';

        const result = { url: cleanUrl, mimeType, bitrate: 128, duration: 0, title: '', artist: '', thumbnail: '' };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('YouTube get stream error:', err.message);
        return null;
    }
}

// Pre-warm: resolve the stream URL for a video in the background.
// Call this when the user hovers a card or the previous song starts playing.
function prewarmStream(videoId) {
    if (!videoId) return;
    const cacheKey = `yt:stream:${videoId}`;
    if (getCached(cacheKey, STREAM_TTL)) return; // already warm
    getStreamUrl(videoId).catch(() => {}); // fire and forget
}

async function getArtistById(artistName) {
    const cacheKey = `yt:artist:${artistName}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    try {
        const songs  = await searchSongs(`${artistName} official audio`, 20);
        const result = {
            id: artistName, name: artistName,
            image: songs[0]?.image || '',
            followerCount: 0, isVerified: false,
            bio: [], topSongs: songs, singles: [], albums: [],
        };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('YouTube get artist error:', err.message);
        return null;
    }
}

async function getArtistSongs(artistName, page = 0) {
    const limit    = 20;
    const cacheKey = `yt:artistsongs:${artistName}:${page}`;
    const cached   = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    try {
        const data       = await ytsr(`${artistName} official audio`, { limit: limit + 15 });
        const allResults = filterToSongs(data.items, limit * (page + 1));
        const results    = allResults.slice(page * limit, (page + 1) * limit);
        setCache(cacheKey, results);
        return results;
    } catch (err) {
        console.error('YouTube get artist songs error:', err.message);
        return [];
    }
}


// ─── Genre songs ──────────────────────────────────────────────────────────────

// Each genre has many seed queries. On each call we pick 2 seeds starting at
// `page * 2`, cycling through the list. This ensures successive "load more"
// calls return different songs rather than re-fetching the same cached batch.
const GENRE_QUERIES = {
    pop:        [
        'pop hits 2024 official audio',
        'top pop songs 2024 official audio',
        'best pop songs official audio',
        'popular pop music 2024 official',
        'pop music hits official audio',
        'new pop songs official audio',
    ],
    hiphop:     [
        'hip hop hits 2024 official audio',
        'rap songs 2024 official',
        'best hip hop songs official audio',
        'new rap music 2024 official audio',
        'hip hop music official audio',
        'rap hits official audio',
    ],
    bollywood:  [
        'bollywood hits 2024 official audio',
        'new hindi songs 2024 official',
        'best bollywood songs official audio',
        'hindi music 2024 official audio',
        'bollywood music official audio',
        'top hindi songs official audio',
    ],
    punjabi:    [
        'punjabi hits 2024 official audio',
        'new punjabi songs 2024 official',
        'best punjabi songs official audio',
        'punjabi music 2024 official audio',
        'top punjabi hits official audio',
        'punjabi songs official audio',
    ],
    rock:       [
        'rock hits official audio',
        'classic rock songs official',
        'best rock songs official audio',
        'rock music official audio',
        'rock classics official audio',
        'new rock songs official audio',
    ],
    indie:      [
        'indie pop 2024 official audio',
        'indie songs 2024 official audio',
        'best indie songs official audio',
        'indie music 2024 official',
        'indie rock official audio',
        'indie hits official audio',
    ],
    rnb:        [
        'r&b songs 2024 official audio',
        'soul music 2024 official',
        'best r&b songs official audio',
        'rnb music official audio',
        'soul songs official audio',
        'r&b hits official audio',
        'neo soul official audio',
        'new rnb songs official',
    ],
    jazz:       [
        'jazz songs official audio',
        'smooth jazz official',
        'best jazz songs official audio',
        'jazz music official audio',
        'jazz classics official audio',
        'modern jazz official',
    ],
    electronic: [
        'electronic music 2024 official audio',
        'edm hits 2024 official',
        'best electronic songs official audio',
        'electronic dance music official',
        'edm music official audio',
        'electronic hits official audio',
    ],
    lofi:       [
        'lofi hip hop official audio',
        'chill lofi songs official',
        'best lofi songs official audio',
        'lofi music official',
        'lo-fi hip hop official audio',
        'lofi beats official',
    ],
    latin:      [
        'latin hits 2024 official audio',
        'reggaeton 2024 official',
        'best latin songs official audio',
        'latin music official audio',
        'latin pop official audio',
        'reggaeton hits official',
    ],
    kpop:       [
        'kpop hits 2024 official audio',
        'kpop songs 2024 official audio',
        'best kpop songs official audio',
        'korean pop music official',
        'kpop music official audio',
        'kpop hits official audio',
    ],
};

async function getGenreSongs(genre, limit = 12, page = 0) {
    const key = genre.toLowerCase().replace(/[^a-z]/g, '');
    // Page-based cache key — each "page" is a distinct set of seeds
    const cacheKey = `yt:genre:${key}:${page}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const allQueries = GENRE_QUERIES[key] || [
        `${genre} songs official audio`,
        `${genre} music official video`,
        `best ${genre} songs official`,
    ];

    // Pick 2 seeds for this page, cycling through the full list
    const startIdx = (page * 2) % allQueries.length;
    const queries = [
        allQueries[startIdx],
        allQueries[(startIdx + 1) % allQueries.length],
    ];

    const settled = await Promise.allSettled(
        queries.map(q => ytsr(q, { limit: 25 }))
    );

    const seen = new Set();
    const results = [];
    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const song of filterToSongs(outcome.value.items, limit)) {
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp) && results.length < limit) {
                seen.add(fp);
                results.push(song);
            }
        }
    }

    setCache(cacheKey, results);
    return results;
}

// ─── New releases ─────────────────────────────────────────────────────────────

const NEW_RELEASE_SEEDS = [
    'new songs this week official audio',
    'new music friday 2024 official',
    'latest english songs 2024 official audio',
    'new bollywood songs 2024 official',
    'new punjabi songs 2024 official audio',
];

async function getNewReleases(count = 20) {
    const slot = Math.floor(Date.now() / (30 * 60 * 1000)); // refresh every 30 min
    const cacheKey = `yt:newreleases:${slot}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const seeds = [...NEW_RELEASE_SEEDS].sort(() => Math.random() - 0.5).slice(0, 4);
    const settled = await Promise.allSettled(seeds.map(q => ytsr(q, { limit: 20 })));

    const seen = new Set();
    const results = [];
    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const song of filterToSongs(outcome.value.items, 10)) {
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp) && results.length < count) {
                seen.add(fp);
                results.push(song);
            }
        }
    }

    setCache(cacheKey, results);
    return results;
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const CHART_SEEDS = [
    'global top 50 songs 2024 official audio',
    'billboard hot 100 2024 official',
    'top india songs 2024 official audio',
    'uk top songs 2024 official audio',
];

async function getChartSongs(count = 20) {
    const slot = Math.floor(Date.now() / (30 * 60 * 1000));
    const cacheKey = `yt:charts:${slot}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const seeds = [...CHART_SEEDS].sort(() => Math.random() - 0.5).slice(0, 3);
    const settled = await Promise.allSettled(seeds.map(q => ytsr(q, { limit: 20 })));

    const seen = new Set();
    const results = [];
    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const song of filterToSongs(outcome.value.items, 10)) {
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp) && results.length < count) {
                seen.add(fp);
                results.push(song);
            }
        }
    }

    setCache(cacheKey, results);
    return results;
}

// ─── Mood songs ───────────────────────────────────────────────────────────────

const MOOD_QUERIES = {
    chill:      [
        'chill songs official audio',
        'relaxing music 2024 official',
        'chill vibes songs official',
        'calm music official audio',
        'mellow songs official audio',
        'chillout music official',
    ],
    workout:    [
        'workout songs 2024 official audio',
        'gym motivation music official',
        'fitness music official audio',
        'exercise songs official audio',
        'workout hits official audio',
        'gym music official',
    ],
    party:      [
        'party songs 2024 official audio',
        'dance hits 2024 official',
        'party music official audio',
        'dance party songs official',
        'club music official audio',
        'party hits official audio',
    ],
    focus:      [
        'focus music official audio',
        'study music songs official',
        'concentration music official',
        'productive music official audio',
        'study songs official',
        'focus songs official audio',
    ],
    romance:    [
        'romantic songs official audio',
        'love songs 2024 official',
        'romance music official audio',
        'love ballads official audio',
        'romantic hits official audio',
        'love music official',
    ],
    happy:      [
        'happy songs official audio',
        'feel good music 2024 official',
        'uplifting songs official audio',
        'cheerful music official',
        'positive songs official audio',
        'happy hits official audio',
    ],
    sad:        [
        'sad songs official audio',
        'emotional songs 2024 official',
        'heartbreak songs official audio',
        'melancholy music official',
        'sad music official audio',
        'emotional hits official audio',
    ],
    latenight:  [
        'late night songs official audio',
        'midnight vibes songs official',
        'night drive music official audio',
        'after midnight songs official',
        'night music official audio',
        'late night vibes official',
    ],
    drive:      [
        'driving songs official audio',
        'road trip music 2024 official',
        'car music official audio',
        'highway songs official audio',
        'drive music official audio',
        'road music official',
    ],
    morning:    [
        'morning songs official audio',
        'energetic songs 2024 official',
        'wake up music official audio',
        'morning vibes songs official',
        'sunrise songs official audio',
        'morning hits official',
    ],
    punjabi:    [
        'punjabi hits 2024 official audio',
        'new punjabi songs official',
        'punjabi music official audio',
        'top punjabi songs official audio',
        'punjabi hits official',
        'best punjabi songs official',
    ],
    rock:       [
        'rock songs official audio',
        'rock hits official audio',
        'classic rock official audio',
        'rock music official',
        'rock classics official audio',
        'best rock songs official audio',
    ],
};

async function getMoodSongs(mood, limit = 12, page = 0) {
    const key = mood.toLowerCase().replace(/[^a-z]/g, '');
    const cacheKey = `yt:mood:${key}:${page}`;
    const cached = getCached(cacheKey, SEARCH_TTL);
    if (cached) return cached;

    const allQueries = MOOD_QUERIES[key] || [
        `${mood} songs official audio`,
        `${mood} music official video`,
        `best ${mood} songs official`,
    ];

    const startIdx = (page * 2) % allQueries.length;
    const queries = [
        allQueries[startIdx],
        allQueries[(startIdx + 1) % allQueries.length],
    ];

    const settled = await Promise.allSettled(queries.map(q => ytsr(q, { limit: 25 })));

    const seen = new Set();
    const results = [];
    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const song of filterToSongs(outcome.value.items, limit)) {
            const fp = getFingerprint(song.title, song.artist);
            if (!seen.has(fp) && results.length < limit) {
                seen.add(fp);
                results.push(song);
            }
        }
    }

    setCache(cacheKey, results);
    return results;
}


// ─── Taste-profile recommendations ───────────────────────────────────────────
//
// Builds recommendations from the user's actual in-app behaviour:
// liked songs, recently played, and playlist contents.
// Works for any logged-in user regardless of Google OAuth status.
//
// tasteProfile = {
//   likedSongs:     [{ title, artist, sourceId }]
//   recentlyPlayed: [{ title, artist, sourceId }]
//   playlists:      [{ songs: [{ title, artist, sourceId }] }]
// }

async function getProfileBasedRecommendations(tasteProfile, count = 20) {
    const { likedSongs = [], recentlyPlayed = [], playlists = [] } = tasteProfile;

    // ── 1. Build artist frequency map from all signals ───────────────────────
    // Weight: liked × 3, recently played × 2, playlist × 1
    const artistScore = {};
    const addArtist = (artist, weight) => {
        if (!artist || artist === 'Unknown Artist') return;
        const clean = artist.replace(CHANNEL_NOISE, '').trim().toLowerCase();
        if (clean.length < 2) return;
        artistScore[clean] = (artistScore[clean] || 0) + weight;
    };

    likedSongs.forEach(s     => addArtist(s.artist, 3));
    recentlyPlayed.forEach(s => addArtist(s.artist, 2));
    playlists.forEach(pl =>
        (pl.songs || []).forEach(s => addArtist(s.artist, 1))
    );

    // ── 2. Build title-based seed queries from recently played & liked ───────
    const allSongs = [
        ...likedSongs.slice(0, 10),
        ...recentlyPlayed.slice(0, 10),
    ];
    const titleSeeds = allSongs
        .filter(s => s.title && s.title !== 'Unknown')
        .map(s => s.title.split(/[-–(]/)[0].trim())
        .filter((t, i, arr) => t.length > 2 && arr.indexOf(t) === i) // dedupe
        .slice(0, 4);

    // ── 3. Pick top artists (weighted, shuffled for variety) ─────────────────
    const topArtists = Object.entries(artistScore)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name]) => name)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

    if (!topArtists.length && !titleSeeds.length) {
        // No taste data at all — fall back to trending
        return getTrendingRecommendations(count);
    }

    // ── 4. Build search queries ───────────────────────────────────────────────
    const variants = ['official audio', 'lyrics', 'audio'];
    const queries = [
        ...topArtists.map(a =>
            `${a} ${variants[Math.floor(Math.random() * variants.length)]}`
        ),
        ...titleSeeds.map(t => `${t} official audio`),
    ];

    // ── 5. IDs/fingerprints to skip (already heard) ──────────────────────────
    const heardIds = new Set([
        ...likedSongs.map(s => s.sourceId),
        ...recentlyPlayed.map(s => s.sourceId),
    ].filter(Boolean));

    const heardFps = new Set([
        ...likedSongs,
        ...recentlyPlayed,
    ].map(s => getFingerprint(s.title || '', s.artist || '')));

    // ── 6. Parallel ytsr fetch ────────────────────────────────────────────────
    const settled = await Promise.allSettled(
        queries.map(q => ytsr(q, { limit: 20 }))
    );

    const seen = new Set();
    const results = [];

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        const songs = filterToSongs(outcome.value.items, 15);
        for (const song of songs) {
            if (results.length >= count) break;
            if (heardIds.has(song.sourceId)) continue;
            const fp = getFingerprint(song.title, song.artist);
            if (heardFps.has(fp) || seen.has(fp)) continue;
            seen.add(fp);
            results.push(song);
        }
    }

    // Shuffle so it doesn't feel like one artist at a time
    results.sort(() => Math.random() - 0.5);

    // If we got enough, return; otherwise pad with trending
    if (results.length >= Math.floor(count * 0.6)) return results.slice(0, count);

    const trending = await getTrendingRecommendations(count);
    const trendingFresh = trending.filter(s => {
        const fp = getFingerprint(s.title, s.artist);
        return !seen.has(fp);
    });
    return [...results, ...trendingFresh].slice(0, count);
}

module.exports = {
    searchSongs, searchArtists, searchAll,
    getStreamUrl, prewarmStream, getArtistById, getArtistSongs,
    normalizeSong, getTrendingRecommendations,
    getPersonalizedRecommendations, getProfileBasedRecommendations,
    refreshAccessToken,
    getGenreSongs, getNewReleases, getChartSongs, getMoodSongs,
};

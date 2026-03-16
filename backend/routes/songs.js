const express  = require('express');
const https    = require('https');
const http     = require('http');
const youtube  = require('../services/youtube');

const router = express.Router();

// ─── Helper: pipe audio from YouTube CDN through our server ──────────────────
// This is necessary because YouTube CDN URLs don't include CORS headers,
// so a browser <audio> element cannot fetch them cross-origin directly.
// By proxying through our server (which adds Access-Control-Allow-Origin: *)
// the browser can load and play the audio without being blocked.
function proxyAudio(audioUrl, mimeType, req, res) {
    const mod = audioUrl.startsWith('https') ? https : http;
    const headers = {};

    // Forward range requests so seeking works correctly
    if (req.headers.range) headers.Range = req.headers.range;

    // Some YouTube CDN servers reject requests without a user-agent
    headers['User-Agent'] = 'Mozilla/5.0 (compatible; AudioProxy/1.0)';

    const proxyReq = mod.get(audioUrl, { headers }, (proxyRes) => {
        // Always set CORS header so browser allows the audio
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

        res.setHeader('Content-Type', proxyRes.headers['content-type'] || mimeType || 'audio/webm');
        res.setHeader('Accept-Ranges', 'bytes');

        if (proxyRes.headers['content-length']) res.setHeader('Content-Length',  proxyRes.headers['content-length']);
        if (proxyRes.headers['content-range'])  res.setHeader('Content-Range',   proxyRes.headers['content-range']);

        // Cache for 4 minutes (stream URLs expire in 5 min)
        res.setHeader('Cache-Control', 'public, max-age=240');

        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy pipe error:', err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Stream pipe failed' });
    });

    // If client disconnects early, kill the upstream request too
    req.on('close', () => proxyReq.destroy());
}

// Handle pre-flight CORS for stream endpoints
router.options('/stream/:videoId', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.sendStatus(204);
});

router.options('/proxy/:videoId', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.sendStatus(204);
});

// GET /api/songs/stream/:videoId
// Resolves the YouTube CDN audio URL and proxies it through our server.
// This avoids the CORS block that happens when the browser tries to fetch
// a googlevideo.com URL directly — YouTube CDN doesn't send CORS headers.
router.get('/stream/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const streamData = await youtube.getStreamUrl(videoId);
        if (!streamData?.url) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        // Proxy the audio through our server so CORS is never an issue
        proxyAudio(streamData.url, streamData.mimeType, req, res);

    } catch (err) {
        console.error('Stream endpoint error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream' });
    }
});

// GET /api/songs/proxy/:videoId
// Explicit proxy route — same as /stream but kept for backwards compatibility
// with any frontend code that calls /proxy/ directly.
router.get('/proxy/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const streamData = await youtube.getStreamUrl(videoId);
        if (!streamData?.url) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        proxyAudio(streamData.url, streamData.mimeType, req, res);

    } catch (err) {
        console.error('Proxy endpoint error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream' });
    }
});

// GET /api/songs/preload/:videoId
// Pre-resolves the stream URL and caches it server-side.
// Call this when the user hovers a card or when the current song starts playing.
router.get('/preload/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ ok: false });
    }
    youtube.prewarmStream(videoId); // fire and forget — don't await
    res.json({ ok: true });
});

// GET /api/songs/:source/:id — get stream metadata
router.get('/:source/:id', async (req, res) => {
    try {
        const { source, id } = req.params;

        if (source === 'youtube') {
            const stream = await youtube.getStreamUrl(id);
            if (stream) {
                return res.json({
                    id, source: 'youtube',
                    url:      stream.url,
                    mimeType: stream.mimeType,
                    duration: stream.duration,
                    title:    stream.title,
                    artist:   stream.artist,
                    image:    stream.thumbnail,
                });
            }
            return res.status(404).json({ error: 'Stream not found' });
        }

        res.status(400).json({ error: 'Invalid source' });
    } catch (err) {
        console.error('Get song error:', err);
        res.status(500).json({ error: 'Failed to get song' });
    }
});

module.exports = router;

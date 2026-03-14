const express  = require('express');
const https    = require('https');
const http     = require('http');
const youtube  = require('../services/youtube');

const router = express.Router();

// GET /api/songs/stream/:videoId
// Fast path: resolve the direct YouTube CDN audio URL and redirect the browser to it.
// This eliminates the server-as-proxy bottleneck — the browser fetches audio directly
// from YouTube's CDN at full speed with no extra hop through our server.
// Falls back to proxy streaming only when the redirect fails (e.g. CORS issues in some envs).
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

        // 302 redirect — browser fetches audio directly from YouTube CDN.
        // Set CORS header so the <audio> element can load it cross-origin.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        return res.redirect(302, streamData.url);

    } catch (err) {
        console.error('Stream endpoint error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream' });
    }
});

// GET /api/songs/proxy/:videoId
// Fallback proxy route — pipes audio through the server.
// Used automatically by the frontend if the redirect fails.
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

        const audioUrl = streamData.url;
        const mod = audioUrl.startsWith('https') ? https : http;
        const headers = {};
        if (req.headers.range) headers.Range = req.headers.range;

        const proxyReq = mod.get(audioUrl, { headers }, (proxyRes) => {
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || streamData.mimeType || 'audio/webm');
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (proxyRes.headers['content-length'])  res.setHeader('Content-Length',  proxyRes.headers['content-length']);
            if (proxyRes.headers['content-range'])   res.setHeader('Content-Range',   proxyRes.headers['content-range']);
            if (proxyRes.headers['accept-ranges'])   res.setHeader('Accept-Ranges',   proxyRes.headers['accept-ranges']);
            res.status(proxyRes.statusCode);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy stream error:', err.message);
            if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
        });
        req.on('close', () => proxyReq.destroy());

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

        if (source === 'jiosaavn' || source === 'piped') {
            return res.status(410).json({ error: 'Source no longer available' });
        }

        res.status(400).json({ error: 'Invalid source' });
    } catch (err) {
        console.error('Get song error:', err);
        res.status(500).json({ error: 'Failed to get song' });
    }
});

module.exports = router;

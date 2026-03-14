const express = require('express');
const youtube = require('../services/youtube');

const router = express.Router();

// GET /api/search?q=...&type=songs|artists|all
router.get('/', async (req, res) => {
    try {
        const { q, type = 'all', limit = 20 } = req.query;

        if (!q || !q.trim()) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const parsedLimit = Math.min(parseInt(limit) || 20, 50);
        const t0 = Date.now();
        let result;

        // Wrap in a timeout so a slow ytsr scrape never hangs the UI
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), 8000)
        );

        if (type === 'songs') {
            const songs = await Promise.race([youtube.searchSongs(q, parsedLimit), timeout]);
            result = { songs, artists: [] };
        } else if (type === 'artists') {
            const artists = await Promise.race([youtube.searchArtists(q, parsedLimit), timeout]);
            result = { songs: [], artists };
        } else {
            result = await Promise.race([youtube.searchAll(q, parsedLimit), timeout]);
        }

        res.setHeader('X-Response-Time', `${Date.now() - t0}ms`);
        res.json(result);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;

const express = require('express');
const genius = require('../services/genius');

const router = express.Router();

// GET /api/lyrics/search?title=...&artist=... — Search lyrics via Genius
router.get('/search', async (req, res) => {
    try {
        const { title, artist } = req.query;

        if (!title) {
            return res.status(400).json({ error: 'Query parameter "title" is required' });
        }

        const lyrics = await genius.getLyrics(title, artist || '');

        if (!lyrics) {
            return res.status(404).json({ error: 'Lyrics not available' });
        }

        res.json({ lyrics });
    } catch (err) {
        console.error('Get lyrics error:', err);
        res.status(500).json({ error: 'Failed to get lyrics' });
    }
});

// GET /api/lyrics/:id — Legacy endpoint (backward compat)
router.get('/:id', async (req, res) => {
    res.status(404).json({ error: 'Lyrics by ID no longer supported. Use /api/lyrics/search?title=...&artist=...' });
});

module.exports = router;

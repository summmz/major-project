const express = require('express');
const youtube = require('../services/youtube');

const router = express.Router();

// GET /api/artists/:id — Artist info + top songs (id = artist name or channel ID)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const artist = await youtube.getArtistById(decodeURIComponent(id));

        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }

        res.json(artist);
    } catch (err) {
        console.error('Get artist error:', err);
        res.status(500).json({ error: 'Failed to get artist' });
    }
});

// GET /api/artists/:id/songs — Artist songs with pagination
router.get('/:id/songs', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 0 } = req.query;
        const songs = await youtube.getArtistSongs(decodeURIComponent(id), parseInt(page));
        res.json({ songs });
    } catch (err) {
        console.error('Get artist songs error:', err);
        res.status(500).json({ error: 'Failed to get artist songs' });
    }
});

module.exports = router;

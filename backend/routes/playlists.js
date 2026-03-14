const express = require('express');
const Playlist = require('../models/Playlist');

const router = express.Router();

// GET /api/playlists/featured — Public/curated playlists
router.get('/featured', async (req, res) => {
    try {
        const playlists = await Playlist.find({ isPublic: true })
            .select('name description image songCount songs')
            .lean();

        // Add songCount from songs array length
        const result = playlists.map(p => ({
            id: p._id,
            name: p.name,
            description: p.description || '',
            image: p.image || (p.songs?.[0]?.image) || '',
            songCount: p.songs?.length || 0
        }));

        res.json({ playlists: result });
    } catch (err) {
        console.error('Featured playlists error:', err);
        res.status(500).json({ error: 'Failed to get featured playlists' });
    }
});

// GET /api/playlists/:id — Playlist details with songs
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const playlist = await Playlist.findById(id).lean();

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({
            id: playlist._id,
            name: playlist.name,
            description: playlist.description || '',
            image: playlist.image || (playlist.songs?.[0]?.image) || '',
            songCount: playlist.songs?.length || 0,
            songs: playlist.songs || []
        });
    } catch (err) {
        console.error('Get playlist error:', err);
        res.status(500).json({ error: 'Failed to get playlist' });
    }
});

module.exports = router;

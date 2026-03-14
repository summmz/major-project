const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/user/profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ id: user._id, name: user.name, email: user.email, createdAt: user.createdAt });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/user/profile — update name, email, or password
router.put('/profile', async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (name !== undefined) {
            if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
            user.name = name.trim();
        }

        if (email !== undefined) {
            const normalised = email.toLowerCase().trim();
            if (!normalised.includes('@')) return res.status(400).json({ error: 'Invalid email' });
            const existing = await User.findOne({ email: normalised, _id: { $ne: user._id } });
            if (existing) return res.status(400).json({ error: 'Email already in use' });
            user.email = normalised;
        }

        if (newPassword !== undefined) {
            if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
            if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
            const bcrypt = require('bcrypt');
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
            user.password = await bcrypt.hash(newPassword, 10);
        }

        await user.save();
        res.json({ id: user._id, name: user.name, email: user.email });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/user/account
router.delete('/account', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.userId);
        res.json({ message: 'Account deleted' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// === Liked Songs ===

// GET /api/user/liked
router.get('/liked', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('likedSongs');
        res.json({ likedSongs: user?.likedSongs || [] });
    } catch (err) {
        console.error('Get liked error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/user/liked — Add a liked song
router.post('/liked', async (req, res) => {
    try {
        const { sourceId, source, title, artist, image, duration, url } = req.body;
        if (!sourceId || !source || !title) {
            return res.status(400).json({ error: 'sourceId, source, and title are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Avoid duplicates
        const exists = user.likedSongs.some(s => s.sourceId === sourceId && s.source === source);
        if (exists) {
            return res.json({ likedSongs: user.likedSongs });
        }

        user.likedSongs.push({ sourceId, source, title, artist, image, duration, url, addedAt: new Date() });
        await user.save();
        res.json({ likedSongs: user.likedSongs });
    } catch (err) {
        console.error('Add liked error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/user/liked — Remove a liked song
router.delete('/liked', async (req, res) => {
    try {
        const { sourceId, source } = req.body;
        if (!sourceId || !source) {
            return res.status(400).json({ error: 'sourceId and source are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.likedSongs = user.likedSongs.filter(s => !(s.sourceId === sourceId && s.source === source));
        await user.save();
        res.json({ likedSongs: user.likedSongs });
    } catch (err) {
        console.error('Remove liked error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// === User Playlists ===

// GET /api/user/playlists
router.get('/playlists', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('playlists');
        res.json({ playlists: user?.playlists || [] });
    } catch (err) {
        console.error('Get playlists error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/user/playlists — Create a playlist
router.post('/playlists', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Playlist name is required' });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.playlists.push({ name, description: description || '', songs: [] });
        await user.save();

        const newPlaylist = user.playlists[user.playlists.length - 1];
        res.status(201).json({ playlist: newPlaylist });
    } catch (err) {
        console.error('Create playlist error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/user/playlists/:playlistId — Update playlist (add/remove songs, rename)
router.put('/playlists/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params;
        const { name, description, addSong, removeSongId } = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const playlist = user.playlists.id(playlistId);
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        if (name !== undefined) playlist.name = name;
        if (description !== undefined) playlist.description = description;

        if (addSong) {
            playlist.songs.push({
                sourceId: addSong.sourceId,
                source: addSong.source,
                title: addSong.title,
                artist: addSong.artist,
                image: addSong.image,
                duration: addSong.duration,
                url: addSong.url,
                addedAt: new Date()
            });
        }

        if (removeSongId) {
            playlist.songs = playlist.songs.filter(s => s.sourceId !== removeSongId);
        }

        await user.save();
        res.json({ playlist });
    } catch (err) {
        console.error('Update playlist error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/user/playlists/:playlistId
router.delete('/playlists/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const playlist = user.playlists.id(playlistId);
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        playlist.deleteOne();
        await user.save();
        res.json({ message: 'Playlist deleted' });
    } catch (err) {
        console.error('Delete playlist error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// === Recently Played ===

// GET /api/user/recently-played
router.get('/recently-played', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('recentlyPlayed');
        res.json({ recentlyPlayed: user?.recentlyPlayed || [] });
    } catch (err) {
        console.error('Get recently played error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/user/recently-played — Sync a played song
router.post('/recently-played', async (req, res) => {
    try {
        const { sourceId, source, title, artist, image, duration, url } = req.body;
        if (!sourceId || !source || !title) {
            return res.status(400).json({ error: 'sourceId, source, and title are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Remove duplicate if exists
        user.recentlyPlayed = user.recentlyPlayed.filter(s => !(s.sourceId === sourceId && s.source === source));

        // Add to front
        user.recentlyPlayed.unshift({ sourceId, source, title, artist, image, duration, url, playedAt: new Date() });

        // Keep max 50
        if (user.recentlyPlayed.length > 50) {
            user.recentlyPlayed = user.recentlyPlayed.slice(0, 50);
        }

        await user.save();
        res.json({ recentlyPlayed: user.recentlyPlayed });
    } catch (err) {
        console.error('Add recently played error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

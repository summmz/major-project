const express = require('express');
const User    = require('../models/User');
const youtube = require('../services/youtube');
const jwt     = require('jsonwebtoken');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function getUserId(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
        const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
        return decoded.userId;
    } catch { return null; }
}

// ── GET /api/recommendations/trending ────────────────────────────────────────
// Pure trending — no personalisation. Used for logged-out fallback.
router.get('/trending', async (req, res) => {
    try {
        const songs = await youtube.getTrendingRecommendations(20);
        res.json({ source: 'trending', songs });
    } catch (err) {
        console.error('Trending recs error:', err);
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
});

// ── GET /api/recommendations/youtube ─────────────────────────────────────────
// Smart personalisation: uses whichever signals are available.
//
// Priority:
//   1. Google OAuth liked videos  (best signal — explicit YouTube taste)
//   2. In-app liked songs + recently played + playlists (good signal — in-app behaviour)
//   3. Trending (fallback — no taste data at all)
//
// Also accepts a ?profile= query param (base64-encoded JSON) from the frontend
// containing localStorage taste data for logged-out users.
router.get('/youtube', async (req, res) => {
    try {
        const userId = getUserId(req);

        // ── Logged-out: use profile from localStorage sent by frontend ────────
        if (!userId) {
            const profileParam = req.query.profile;
            if (profileParam) {
                try {
                    const profile = JSON.parse(Buffer.from(profileParam, 'base64').toString('utf8'));
                    if (
                        (profile.likedSongs?.length > 0) ||
                        (profile.recentlyPlayed?.length > 0)
                    ) {
                        const songs = await youtube.getProfileBasedRecommendations(profile, 20);
                        return res.json({ source: 'profile_local', songs });
                    }
                } catch { /* malformed profile — fall through */ }
            }
            const songs = await youtube.getTrendingRecommendations(20);
            return res.json({ source: 'trending', songs });
        }

        // ── Logged-in: load full user from DB ────────────────────────────────
        const user = await User.findById(userId).select(
            'googleAccessToken googleRefreshToken likedSongs recentlyPlayed playlists'
        );
        if (!user) {
            return res.json({ source: 'trending', songs: await youtube.getTrendingRecommendations(20) });
        }

        // ── Path 1: Google OAuth personalisation (richest signal) ─────────────
        if (user.googleAccessToken) {
            const songs = await youtube.getPersonalizedRecommendations(
                user.googleAccessToken, user.googleRefreshToken, userId
            );
            return res.json({ source: 'youtube_personalized', songs });
        }

        // ── Path 2: In-app taste profile ──────────────────────────────────────
        const hasInAppData =
            user.likedSongs?.length > 0 ||
            user.recentlyPlayed?.length > 0 ||
            user.playlists?.some(p => p.songs?.length > 0);

        if (hasInAppData) {
            const tasteProfile = {
                likedSongs:     user.likedSongs     || [],
                recentlyPlayed: user.recentlyPlayed || [],
                playlists:      user.playlists       || [],
            };
            const songs = await youtube.getProfileBasedRecommendations(tasteProfile, 20);
            return res.json({ source: 'profile_inapp', songs });
        }

        // ── Path 3: No data — trending ────────────────────────────────────────
        const songs = await youtube.getTrendingRecommendations(20);
        return res.json({ source: 'trending', songs });

    } catch (err) {
        console.error('Recommendations route error:', err);
        try {
            res.json({ source: 'trending_fallback', songs: await youtube.getTrendingRecommendations(20) });
        } catch {
            res.status(500).json({ error: 'Failed to fetch recommendations' });
        }
    }
});

// ── GET /api/recommendations/genre?name=pop&page=0 ────────────────────────────
router.get('/genre', async (req, res) => {
    try {
        const { name, page = 0 } = req.query;
        if (!name) return res.status(400).json({ error: 'name required' });
        const songs = await youtube.getGenreSongs(name, 12, parseInt(page) || 0);
        res.json({ genre: name, songs });
    } catch (err) {
        console.error('Genre recs error:', err);
        res.status(500).json({ error: 'Failed to fetch genre songs' });
    }
});

// ── GET /api/recommendations/newreleases ─────────────────────────────────────
router.get('/newreleases', async (req, res) => {
    try {
        const songs = await youtube.getNewReleases(20);
        res.json({ songs });
    } catch (err) {
        console.error('New releases error:', err);
        res.status(500).json({ error: 'Failed to fetch new releases' });
    }
});

// ── GET /api/recommendations/charts ──────────────────────────────────────────
router.get('/charts', async (req, res) => {
    try {
        const songs = await youtube.getChartSongs(20);
        res.json({ songs });
    } catch (err) {
        console.error('Charts error:', err);
        res.status(500).json({ error: 'Failed to fetch chart songs' });
    }
});

// ── GET /api/recommendations/mood?name=chill&page=0 ──────────────────────────
router.get('/mood', async (req, res) => {
    try {
        const { name, page = 0 } = req.query;
        if (!name) return res.status(400).json({ error: 'name required' });
        const songs = await youtube.getMoodSongs(name, 12, parseInt(page) || 0);
        res.json({ mood: name, songs });
    } catch (err) {
        console.error('Mood recs error:', err);
        res.status(500).json({ error: 'Failed to fetch mood songs' });
    }
});

module.exports = router;

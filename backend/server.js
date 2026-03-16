require('dotenv').config();

// ─── Auto-update yt-dlp on startup ───────────────────────────────────────────
// The version bundled with youtube-dl-exec gets stale quickly.
// This updates it in the background so streams work with current YouTube.
const { execFile } = require('child_process');
const youtubedlBin = require('youtube-dl-exec').raw;
execFile(youtubedlBin, ['-U'], (err, stdout, stderr) => {
    if (err) console.warn('yt-dlp update skipped:', err.message);
    else console.log('yt-dlp updated:', stdout.trim() || 'already up to date');
});
const express = require('express');
const cors    = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const songsRoutes = require('./routes/songs');
const artistsRoutes = require('./routes/artists');
const playlistsRoutes = require('./routes/playlists');
const lyricsRoutes = require('./routes/lyrics');
const userRoutes = require('./routes/user');
const recommendationsRoutes = require('./routes/recommendations');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow all origins so the Vercel frontend can call the Render backend.
// For audio proxy routes the browser sends a Range header — we expose it.
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));

app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/artists', artistsRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/lyrics', lyricsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/recommendations', recommendationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Pre-warm caches so the first home-page load is fast
    const youtube = require('./services/youtube');
    Promise.allSettled([
        youtube.getTrendingRecommendations(20),
        youtube.getNewReleases(20),
        youtube.getChartSongs(20),
        youtube.getGenreSongs('pop',       12),
        youtube.getGenreSongs('bollywood', 12),
        youtube.getGenreSongs('punjabi',   12),
    ]).then(() => console.log('Home feed caches warmed'));
});

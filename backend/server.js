require('dotenv').config();

// Fix cookies.txt line endings — Windows saves CRLF which breaks yt-dlp on Linux
const fs   = require('fs');
const path = require('path');
const cookiesPath = path.join(__dirname, 'cookies.txt');
if (fs.existsSync(cookiesPath)) {
    const fixed = fs.readFileSync(cookiesPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    fs.writeFileSync(cookiesPath, fixed, 'utf8');
    console.log('cookies.txt line endings fixed');
}


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

    console.log('Server ready — home feed loads on first request');
});

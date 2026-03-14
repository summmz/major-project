const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
    sourceId: { type: String, required: true },
    source: { type: String, enum: ['youtube', 'local', 'jiosaavn', 'piped'], required: true },
    title: { type: String, required: true },
    artist: String,
    image: String,
    duration: Number,
    url: String,
    addedAt: { type: Date, default: Date.now }
}, { _id: false });

const playlistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    songs: [songSchema]
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: function() { return !this.googleId; } },
    name: { type: String, required: true, trim: true },
    googleId: { type: String, unique: true, sparse: true },
    googleAccessToken: String,
    googleRefreshToken: String,
    createdAt: { type: Date, default: Date.now },
    likedSongs: [songSchema],
    playlists: [playlistSchema],
    recentlyPlayed: [{
        sourceId: String,
        source: String,
        title: String,
        artist: String,
        image: String,
        duration: Number,
        url: String,
        playedAt: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('User', userSchema);

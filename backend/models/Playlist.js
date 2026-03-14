const mongoose = require('mongoose');

const playlistSongSchema = new mongoose.Schema({
    sourceId: { type: String, required: true },
    source: { type: String, enum: ['youtube', 'local', 'jiosaavn', 'piped'], required: true },
    title: { type: String, required: true },
    artist: String,
    image: String,
    duration: Number
}, { _id: false });

const playlistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    songs: [playlistSongSchema],
    isPublic: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Playlist', playlistSchema);

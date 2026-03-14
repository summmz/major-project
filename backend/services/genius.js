const Genius = require('genius-lyrics');
const Client = new Genius.Client();

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key) {
    const entry = CACHE.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
    if (entry) CACHE.delete(key);
    return null;
}

function setCache(key, data) {
    CACHE.set(key, { data, time: Date.now() });
    if (CACHE.size > 500) {
        const oldest = CACHE.keys().next().value;
        CACHE.delete(oldest);
    }
}

function cleanLyrics(raw) {
    if (!raw) return null;
    // The genius-lyrics package sometimes prefixes contributor/translation metadata
    // Find the actual lyrics start — usually after the song title line or "[Verse" / "[Intro" etc.
    let lyrics = raw;

    // Remove leading metadata block (contributors, translations, etc.)
    // This junk appears before the actual song title in the raw output
    const sectionMatch = lyrics.match(/(\[(?:Verse|Chorus|Intro|Bridge|Outro|Pre-Chorus|Hook|Refrain|Part|Skit)[\s\S]*)/i);
    if (sectionMatch) {
        lyrics = sectionMatch[1];
    } else {
        // Try to find lyrics after a number + "Contributors" pattern
        const contribMatch = lyrics.match(/\d+\s*Contributors?(?:Translations[^\n]*)?\n*([\s\S]+)/i);
        if (contribMatch) {
            lyrics = contribMatch[1];
        }
    }

    // Remove "XXEmbed" or "XEmbed" at the very end
    lyrics = lyrics.replace(/\d*Embed$/, '').trim();

    // Remove "You might also like" lines inserted by Genius
    lyrics = lyrics.replace(/You might also like/g, '').trim();

    return lyrics || null;
}

async function getLyrics(title, artist) {
    const cacheKey = `genius:${title}:${artist}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const query = artist ? `${title} ${artist}` : title;
        const searches = await Client.songs.search(query);

        if (searches.length === 0) return null;

        const song = searches[0];
        const raw = await song.lyrics();
        const lyrics = cleanLyrics(raw);

        if (lyrics) {
            setCache(cacheKey, lyrics);
        }
        return lyrics;
    } catch (err) {
        console.error('Genius lyrics error:', err.message);
        return null;
    }
}

module.exports = {
    getLyrics
};

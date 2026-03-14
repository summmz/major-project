// === Hardcoded Playlists and Data ===

export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const _placeholderSongs = [
    {
        title: "Blinding Lights",
        artist: "The Weeknd",
        url: "songs/Blinding Lights (PenduJatt.Com.Se).mp3",
        image: "img/TW.jpeg",
        duration: 200
    },
    {
        title: "Good 4 U",
        artist: "Olivia Rodrigo",
        url: "songs/Good 4 U (PenduJatt.Com.Se).mp3",
        image: "img/olivia rodrigo.jpeg",
        duration: 178
    },
    {
        title: "Levitating",
        artist: "Dua Lipa",
        url: "songs/Levitating (PenduJatt.Com.Se).mp3",
        image: "img/Future Nostalgia Dua Lipa.jpeg",
        duration: 203
    }
];

export const defaultPlaylists = {
    popular: [
        {
            title: "2-2 Asle",
            artist: "Arjan Dhillon",
            url: "songs/2-2 Asle - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 228
        },
        {
            title: "8 Asle",
            artist: "Sukha",
            url: "songs/8 ASLE.mp3",
            image: "img/undisputed sukha.jpeg",
            duration: 391
        },
        {
            title: "Blinding Lights",
            artist: "The Weeknd",
            url: "songs/Blinding Lights (PenduJatt.Com.Se).mp3",
            image: "img/TW.jpeg",
            duration: 200
        },
        {
            title: "I Really Do",
            artist: "Karan Aujla",
            url: "songs/I Really Do.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "Good 4 U",
            artist: "Olivia Rodrigo",
            url: "songs/Good 4 U (PenduJatt.Com.Se).mp3",
            image: "img/olivia rodrigo.jpeg",
            duration: 178
        },
        {
            title: "Levitating",
            artist: "Dua Lipa",
            url: "songs/Levitating (PenduJatt.Com.Se).mp3",
            image: "img/Future Nostalgia Dua Lipa.jpeg",
            duration: 203
        },
        {
            title: "Lost",
            artist: "Tegi Pannu",
            url: "songs/Lost.mp3",
            image: "img/Lost-1.jpg",
            duration: 391
        },
        {
            title: "Paro",
            artist: "Aditya Rikhari",
            url: "songs/Aditya Rikhari - Paro Song (Lyrics).mp3",
            image: "img/55555.jpeg",
            duration: 178
        }
    ],
    chill: [
        {
            title: "Sunset Lover",
            artist: "Petit Biscuit",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/d4dff2dd-2499-4d47-902e-a64167d3d211.jpeg",
            duration: 245
        },
        {
            title: "Ocean Eyes",
            artist: "Billie Eilish",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/dfee06b2-6930-4ff3-84ce-6ccae57dc0ba.jpeg",
            duration: 200
        }
    ],
    rock: [
        {
            title: "Bohemian Rhapsody",
            artist: "Queen",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/d093430b-85af-447e-869d-dec87b1f1964.jpeg",
            duration: 355
        },
        {
            title: "Hotel California",
            artist: "Eagles",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/download (1).jpeg",
            duration: 391
        }
    ],
    jazz: [
        {
            title: "Take Five",
            artist: "Dave Brubeck",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/Undercurrent-768x768 (1).jpg",
            duration: 324
        }
    ],
    workout: [
        {
            title: "Good For You x One Of The Girls",
            artist: "Selena Gomez, The Weeknd",
            url: "songs/Good For You x One Of The Girls - Selena Gomez, The Weeknd (Lyrics  Vietsub).mp3",
            image: "img/ab67616d0000b273952d04c1fb47635158f28fb2.jpeg",
            duration: 228
        },
        {
            title: "Love Potions X Tipsy",
            artist: " bjlips & miss luxury",
            url: "songs/Love Potions X Tipsy - bjlips & miss luxury (mashup).mp3",
            image: "img/ab67616d0000b273c24be873e625679f2ac1062a.jpeg",
            duration: 391
        },
        {
            title: "Motive X Promiscuous",
            artist: "Ariana Grande, Nelly Furtado",
            url: "songs/Ariana Grande, Nelly Furtado - Motive X Promiscuous (TikTok Mashup) [Lyrics].mp3",
            image: "img/1111.jpeg",
            duration: 246
        },
        {
            title: "Mind Games",
            artist: "Sickick",
            url: "songs/Sickick - Mind Games (Official Video).mp3",
            image: "img/22222.jpeg",
            duration: 391
        },
        {
            title: "Supernova Love",
            artist: "IVE, David Guetta",
            url: "songs/IVE, David Guetta - Supernova Love (Official Lyric Video).mp3",
            image: "img/3333.jpeg",
            duration: 391
        }
    ],
    indie: [
        {
            title: "Electric Feel",
            artist: "MGMT",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            image: "img/Slow Magic - Your Heart Beatsâ€¦.jpeg",
            duration: 228
        }
    ],
    Punjabi: [
        {
            title: "2-2 Asle",
            artist: "Arjan Dhillon",
            url: "songs/2-2 Asle - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 228
        },
        {
            title: "8 Asle",
            artist: "Sukha",
            url: "songs/8 ASLE.mp3",
            image: "img/undisputed sukha.jpeg",
            duration: 391
        },
        {
            title: "Brats",
            artist: "Arjan Dhillon",
            url: "songs/Brats - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 391
        },
        {
            title: "Daytona",
            artist: "Karan Aujla",
            url: "songs/Karan Aujla - Daytona (Official Audio).mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "For a Reason",
            artist: "Karan Aujla",
            url: "songs/For A Reason - Karan Aujla.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "Foreigns",
            artist: "Gurinder Gill",
            url: "songs/Foreigns - AP Dhillon.mp3",
            image: "img/592x592bb.webp",
            duration: 391
        },
        {
            title: "Greatest",
            artist: "Arjan Dhillon",
            url: "songs/Greatest - Arjan Dhillon.mp3",
            image: "img/patander-arjan-dhillon.webp",
            duration: 391
        },
        {
            title: "I Really Do",
            artist: "Karan Aujla",
            url: "songs/I Really Do.mp3",
            image: "img/p-pop-culture-karan-aujla.webp",
            duration: 391
        },
        {
            title: "Lost",
            artist: "Tegi Pannu",
            url: "songs/Lost.mp3",
            image: "img/Lost-1.jpg",
            duration: 391
        },
        {
            title: "Miami Flow",
            artist: "Jerry",
            url: "songs/Miami Flow - DjPunjab.Com.Se.mp3",
            image: "img/thumb_663c9918e9247.webp",
            duration: 391
        },
        {
            title: "Old Skool",
            artist: "Sidhu Moose Wala",
            url: "songs/Old Skool.mp3",
            image: "img/Old-Skool-1.jpg",
            duration: 391
        },
        {
            title: "Take it Easy",
            artist: "Karan Aujla",
            url: "songs/Take It Easy.mp3",
            image: "img/592x592bb (1).webp",
            duration: 391
        },
    ],
    SabrinaSessions: [
        {
            title: "Alien M-22 Remix",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter, Jonas Blue - Alien (M-22 Remix_Audio Only) [7IdnVykSZqk].mp3",
            image: "img/sabrina.jpeg",
            duration: 200
        },
        {
            title: "Bed Chem",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Bed Chem (Official Lyric Video).mp3",
            image: "img/Gonna miss this era.jpeg",
            duration: 178
        },
        {
            title: "Espresso",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Espresso (Official Audio).mp3",
            image: "img/Instagram.jpeg",
            duration: 203
        },
        {
            title: "Nonsense",
            artist: "Sabrina Carpenter",
            url: "songs/Sabrina Carpenter - Nonsense (Official Audio).mp3",
            image: "img/425dae9c-3fef-415e-8857-e0604c1c4022.jpeg",
            duration: 203
        }
    ],
    SereneRoads: [
        {
            title: "Baby Come back",
            artist: "Player",
            url: "songs/Player - Baby Come Back.mp3",
            image: "img/77777.jpeg",
            duration: 203
        },
        {
            title: "Break from toronto",
            artist: "PARTYNEXTDOOR",
            url: "songs/PARTYNEXTDOOR - Break From Toronto.mp3",
            image: "img/0000.jpeg",
            duration: 203
        },
        {
            title: "By my Side",
            artist: "Zack Tabudlo",
            url: "songs/Zack Tabudlo - By My Side ft. Tiara Andini.mp3",
            image: "img/23232.jpeg",
            duration: 203
        },
        {
            title: "Intermission (Lost Tapes 2020)",
            artist: "Tory Lanez",
            url: "songs/Tory Lanez - Intermission (Lost Tapes 2020) (AUDIO).mp3",
            image: "img/12212.jpeg",
            duration: 203
        },
        {
            title: "Life is a Highway",
            artist: "Rascal Flatts",
            url: "songs/Cars (Soundtrack) - Life Is A Highway.mp3",
            image: "img/777.jpeg",
            duration: 200
        }
    ],
    MidnightHeat: _placeholderSongs,
    SilkSheetsRedLights: _placeholderSongs,
    BeachVibes: _placeholderSongs,
    LeatherLace: _placeholderSongs,
    SpellboundGrooves: _placeholderSongs,
    Songsinshower: _placeholderSongs,
    Cherrystainedlips: _placeholderSongs,
    Rockclassics: _placeholderSongs,
    Wetwindows: _placeholderSongs,
    ignitethebeat: _placeholderSongs,
    chillvibes: _placeholderSongs,
    Jazzessentials: _placeholderSongs,
    indiefavs: _placeholderSongs
};

export const playlistNames = {
    popular: "Today's Top Hits",
    Punjabi: "Hot Hits Punjabi",
    rock: "Rock Classics",
    jazz: "Jazz Essentials",
    workout: "Workout Mix",
    indie: "Indie Favorites",
    chill: "Chill Vibes",
    SabrinaSessions: "Sabrina Sessions",
    SereneRoads: "Serene Roads",
    MidnightHeat: "Midnight Heat",
    SilkSheetsRedLights: "Silk Sheets & Red Lights",
    BeachVibes: "Beach Vibes",
    LeatherLace: "Leather & Lace",
    SpellboundGrooves: "Spellbound Grooves",
    Songsinshower: "Songs to Sing in Shower",
    Cherrystainedlips: "Cherry-Stained Lips",
    Rockclassics: "Rock Classics",
    Wetwindows: "Wet Windows",
    ignitethebeat: "Ignite the Beat",
    chillvibes: "Chill Vibes",
    Jazzessentials: "Jazz Essentials",
    indiefavs: "Indie Favorites"
};

export const playlistDescriptions = {
    popular: "The most popular songs right now",
    Punjabi: "Catch the hottest Punjabi tracks",
    SabrinaSessions: "Smooth and catchy tunes from Sabrina Carpenter",
    workout: "High-energy tracks to power your workout",
    SereneRoads: "Calm, soothing tracks for a relaxing drive",
    MidnightHeat: "Sensual, bold tracks to set the mood",
    SilkSheetsRedLights: "Seduction in every beat",
    BeachVibes: "Chill, sunny tracks for a carefree seaside mood",
    LeatherLace: "Soft temptation, hard edge",
    SpellboundGrooves: "Hypnotic rhythms and seductive melodies",
    Songsinshower: "Melancholic tunes that echo in the steam",
    Cherrystainedlips: "Sweet, messy, addictive",
    Rockclassics: "The greatest rock songs of all time",
    Wetwindows: "Smooth beats that mimic falling rain",
    ignitethebeat: "Tracks that set your soul on fire",
    chillvibes: "Relax and unwind with these mellow tracks",
    Jazzessentials: "Timeless jazz standards and smooth melodies",
    indiefavs: "Discover indie gems and emerging artists",
    rock: "Rock legends and anthems",
    jazz: "Classic jazz essentials",
    indie: "Independent spirit, unique sound",
    chill: "Relax and unwind"
};

// Playlist cover images for home feed
export const playlistCovers = {
    popular: "img/Escravidao Projects __ Photos, videos, logos, illustrations and branding.jpeg",
    Punjabi: "img/undisputed sukha.jpeg",
    SabrinaSessions: "img/146ee974-803a-4ee7-a2c5-9a5ec1d30ef7.jpeg",
    workout: "img/summer playlist.jpeg",
    SereneRoads: "img/Tony Skeor.jpeg",
    MidnightHeat: "img/download.jpeg",
    SilkSheetsRedLights: "img/download (3).jpeg",
    BeachVibes: "img/Alison Sudol _ A Fine Frenzy.jpeg",
    LeatherLace: "img/download (2).jpeg",
    SpellboundGrooves: "img/24540031-8ce9-47cf-bbe4-0855bd2c01c9.jpeg",
    Songsinshower: "img/Shower II.jpeg",
    Cherrystainedlips: "img/download (4).jpeg",
    Rockclassics: "img/Michael Jackson_.jpeg",
    Wetwindows: "img/Rain in car.jpeg",
    ignitethebeat: "img/Burning Piano.jpeg",
    chillvibes: "img/wondering in the sky.jpeg",
    Jazzessentials: "img/55f3a45b-daa8-4651-aa0b-085129ea42ec.jpeg",
    indiefavs: "img/0a8d4bcf-797a-4fe1-8cd8-143656c3b412.jpeg"
};

// Artist metadata for artist pages
export const artistData = {
    "Arjan Dhillon": { image: "img/patander-arjan-dhillon.webp", verified: true, listeners: "4.2M" },
    "Sukha": { image: "img/undisputed sukha.jpeg", verified: false, listeners: "1.8M" },
    "The Weeknd": { image: "img/TW.jpeg", verified: true, listeners: "112M" },
    "Karan Aujla": { image: "img/p-pop-culture-karan-aujla.webp", verified: true, listeners: "18.5M" },
    "Olivia Rodrigo": { image: "img/olivia rodrigo.jpeg", verified: true, listeners: "65M" },
    "Dua Lipa": { image: "img/Future Nostalgia Dua Lipa.jpeg", verified: true, listeners: "78M" },
    "Tegi Pannu": { image: "img/Lost-1.jpg", verified: false, listeners: "950K" },
    "Aditya Rikhari": { image: "img/55555.jpeg", verified: false, listeners: "2.1M" },
    "Sabrina Carpenter": { image: "img/sabrina.jpeg", verified: true, listeners: "58M" },
    "Tory Lanez": { image: "img/12212.jpeg", verified: true, listeners: "28M" },
    "Zack Tabudlo": { image: "img/23232.jpeg", verified: false, listeners: "5.3M" },
    "Sickick": { image: "img/22222.jpeg", verified: false, listeners: "8.7M" },
    "Sidhu Moose Wala": { image: "img/Old-Skool-1.jpg", verified: true, listeners: "22M" },
    "Jerry": { image: "img/thumb_663c9918e9247.webp", verified: false, listeners: "3.1M" },
    "Gurinder Gill": { image: "img/592x592bb.webp", verified: false, listeners: "2.4M" },
    "Queen": { image: "img/d093430b-85af-447e-869d-dec87b1f1964.jpeg", verified: true, listeners: "45M" },
    "Billie Eilish": { image: "img/dfee06b2-6930-4ff3-84ce-6ccae57dc0ba.jpeg", verified: true, listeners: "85M" },
    "MGMT": { image: "img/Slow Magic - Your Heart Beatsâ€¦.jpeg", verified: true, listeners: "19M" },
    "Petit Biscuit": { image: "img/d4dff2dd-2499-4d47-902e-a64167d3d211.jpeg", verified: false, listeners: "4.8M" },
    "Eagles": { image: "img/download (1).jpeg", verified: true, listeners: "32M" },
    "Dave Brubeck": { image: "img/Undercurrent-768x768 (1).jpg", verified: false, listeners: "3.9M" },
    "Rascal Flatts": { image: "img/777.jpeg", verified: false, listeners: "9.2M" },
    "PARTYNEXTDOOR": { image: "img/0000.jpeg", verified: true, listeners: "15M" },
    "Selena Gomez": { image: "img/ab67616d0000b273952d04c1fb47635158f28fb2.jpeg", verified: true, listeners: "52M" },
    "Ariana Grande": { image: "img/1111.jpeg", verified: true, listeners: "88M" },
    "IVE": { image: "img/3333.jpeg", verified: true, listeners: "12M" },
    "AP Dhillon": { image: "img/592x592bb.webp", verified: true, listeners: "9.8M" },
};

// Search categories with colors and associated playlists
export const searchCategories = [
    { name: 'Pop', color: '#e13300', playlist: 'popular', image: 'img/olivia rodrigo.jpeg' },
    { name: 'Rock', color: '#ba5d07', playlist: 'rock', image: 'img/d093430b-85af-447e-869d-dec87b1f1964.jpeg' },
    { name: 'Punjabi', color: '#8d67ab', playlist: 'Punjabi', image: 'img/undisputed sukha.jpeg' },
    { name: 'Jazz', color: '#1e3264', playlist: 'jazz', image: 'img/55f3a45b-daa8-4651-aa0b-085129ea42ec.jpeg' },
    { name: 'Workout', color: '#148a08', playlist: 'workout', image: 'img/summer playlist.jpeg' },
    { name: 'Indie', color: '#503750', playlist: 'indie', image: 'img/0a8d4bcf-797a-4fe1-8cd8-143656c3b412.jpeg' },
    { name: 'Chill', color: '#1e3264', playlist: 'chillvibes', image: 'img/wondering in the sky.jpeg' },
    { name: 'Party', color: '#e61e32', playlist: 'ignitethebeat', image: 'img/Burning Piano.jpeg' },
    { name: 'Romance', color: '#d84000', playlist: 'SilkSheetsRedLights', image: 'img/download (3).jpeg' },
    { name: 'Drive', color: '#477d95', playlist: 'SereneRoads', image: 'img/Tony Skeor.jpeg' },
    { name: 'Late Night', color: '#503750', playlist: 'MidnightHeat', image: 'img/download.jpeg' },
    { name: 'Shower Hits', color: '#0d73ec', playlist: 'Songsinshower', image: 'img/Shower II.jpeg' },
    { name: 'Classic Rock', color: '#e8115b', playlist: 'Rockclassics', image: 'img/Michael Jackson_.jpeg' },
    { name: 'Beach', color: '#27856a', playlist: 'BeachVibes', image: 'img/Alison Sudol _ A Fine Frenzy.jpeg' },
    { name: 'Mood', color: '#7358ff', playlist: 'SpellboundGrooves', image: 'img/24540031-8ce9-47cf-bbe4-0855bd2c01c9.jpeg' },
    { name: 'Rain', color: '#5179a1', playlist: 'Wetwindows', image: 'img/Rain in car.jpeg' },
];

// Normalize API song response to the shape used everywhere in the app
// API songs have: { id, source, title, artist, image, duration, url, hasLyrics, ... }
// App songs need: { title, artist, url, image, duration } + optional sourceId, source
export function normalizeSong(apiSong) {
    if (!apiSong) return null;
    // If it's already a local song (has no source field), return as-is
    if (!apiSong.source && apiSong.url) return apiSong;

    return {
        title: apiSong.title || apiSong.name || '',
        artist: apiSong.artist || apiSong.artists || 'Unknown Artist',
        url: apiSong.url || '',
        image: apiSong.image || 'img/home.svg',
        duration: apiSong.duration || 0,
        sourceId: apiSong.id || '',
        source: apiSong.source || 'youtube',
        hasLyrics: apiSong.hasLyrics || false,
        album: apiSong.album || '',
        year: apiSong.year || '',
        language: apiSong.language || ''
    };
}

export const sampleLyrics = {
    "Blinding Lights": "I've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\n\nI look around and Sin City's cold and empty\nNo one's around to judge me\nI can't see clearly when you're gone\n\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust",
    "Espresso": "Now he's thinkin' bout me every night, oh\nIs it that sweet? I guess so\nSay you can't sleep, baby, I know\nThat's that me espresso\n\nMoved in, he's drinkin' up my time\nI should let him go\nHe never lets me close, oh yeah\nHe never lets me go",
    "Levitating": "If you wanna run away with me\nI know a galaxy and I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don't stop for life\nGlitter in the sky, glitter in my eyes\nShining just the way I like\nIf you're feeling like you need a little bit of company\nYou met me at an interesting time"
};

const youtubedl = require('youtube-dl-exec');

async function test() {
    try {
        const rawOutput = await youtubedl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
            getUrl: true,
            noCheckCertificates: true,
            noWarnings: true,
            noPlaylist: true,
        });
        console.log('Raw output:', rawOutput);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();

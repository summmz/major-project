const play = require('play-dl');

async function test() {
    try {
        const stream = await play.stream('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        console.log('Stream URL:', stream.url);
        console.log('Stream type:', stream.type);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();

// === Visualizer, EQ, Lyrics Module ===
import * as state from './state.js';
import { sampleLyrics } from './data.js';
import { showToast } from './ui.js';

const audioPlayer = document.getElementById('audioPlayer');

export function initAudioContext() {
    if (state.audioContext) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        state.setAudioContext(ctx);
        const src = ctx.createMediaElementSource(audioPlayer);
        state.setSourceNode(src);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        state.setAnalyserNode(analyser);
        src.connect(analyser);
        analyser.connect(ctx.destination);
    } catch(e) {
        console.error('AudioContext init failed:', e);
    }
}

export function startVisualizer() {
    if (!state.analyserNode) return;
    const canvas = document.getElementById('visualizerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = 90;

    const bufferLength = state.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        state.setVisualizerAnimationId(requestAnimationFrame(draw));
        state.analyserNode.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = `rgba(29,185,84,0.7)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    if (state.visualizerAnimationId) cancelAnimationFrame(state.visualizerAnimationId);
    draw();
}

export function stopVisualizer() {
    if (state.visualizerAnimationId) {
        cancelAnimationFrame(state.visualizerAnimationId);
        state.setVisualizerAnimationId(null);
    }
    const canvas = document.getElementById('visualizerCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Equalizer
export function toggleEQ() {
    state.setEqIsOpen(!state.eqIsOpen);
    document.getElementById('eqPanel').classList.toggle('open', state.eqIsOpen);
    document.getElementById('eqToggleBtn').classList.toggle('active', state.eqIsOpen);
    if (state.eqIsOpen) initEqualizer();
}

function initEqualizer() {
    if (state.eqFilters.length > 0) return;
    initAudioContext();
    if (!state.audioContext || !state.sourceNode || !state.analyserNode) return;

    const frequencies = [60, 230, 910, 4000, 14000];
    state.sourceNode.disconnect();

    let prevNode = state.sourceNode;
    const filters = [];
    frequencies.forEach((freq) => {
        const filter = state.audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        prevNode.connect(filter);
        prevNode = filter;
        filters.push(filter);
    });
    prevNode.connect(state.analyserNode);
    state.analyserNode.connect(state.audioContext.destination);
    state.setEqFilters(filters);

    const saved = localStorage.getItem('eqPreset');
    if (saved) {
        document.getElementById('eqPresetSelect').value = saved;
        applyEQPreset(saved);
    }
}

export function setEQBand(band, value) {
    if (state.eqFilters[band]) {
        state.eqFilters[band].gain.value = parseFloat(value);
        const bands = document.querySelectorAll('.eq-band');
        if (bands[band]) bands[band].querySelector('span').textContent = value;
    }
}

export function applyEQPreset(preset) {
    const presets = {
        flat: [0, 0, 0, 0, 0],
        bass: [6, 4, 0, -2, -1],
        treble: [-2, -1, 0, 4, 6],
        vocal: [-2, 0, 4, 3, -1],
        rock: [4, 2, -1, 3, 5]
    };
    const values = presets[preset] || presets.flat;
    values.forEach((val, i) => {
        setEQBand(i, val);
        const slider = document.querySelector(`.eq-slider[data-band="${i}"]`);
        if (slider) slider.value = val;
    });
    try { localStorage.setItem('eqPreset', preset); } catch(e) {}
}

// Lyrics
export function toggleLyrics() {
    state.setIsLyricsOpen(!state.isLyricsOpen);
    document.getElementById('lyricsPanel').classList.toggle('open', state.isLyricsOpen);
    document.getElementById('lyricsToggleBtn').classList.toggle('active', state.isLyricsOpen);
    if (state.isLyricsOpen) renderLyrics();
}

async function renderLyrics() {
    const content = document.getElementById('lyricsContent');
    if (!state.currentSong) { content.innerHTML = '<p>No song playing.</p>'; return; }

    // Check local sample lyrics first
    const localLyrics = sampleLyrics[state.currentSong.title];
    if (localLyrics) {
        content.textContent = localLyrics;
        return;
    }

    // Try fetching from Genius API
    if (state.currentSong.title && state.currentSong.artist) {
        content.innerHTML = '<p style="color:#a7a7a7;">Loading lyrics...</p>';
        try {
            const params = new URLSearchParams({
                title: state.currentSong.title,
                artist: state.currentSong.artist
            });
            const res = await fetch(state.API_BASE + '/lyrics/search?' + params.toString());
            if (res.ok) {
                const data = await res.json();
                if (data.lyrics) {
                    content.textContent = data.lyrics;
                    return;
                }
            }
        } catch (e) {
            console.error('Lyrics fetch error:', e);
        }
    }

    content.innerHTML = '<p style="color:#a7a7a7;">Lyrics not available for this song.</p>';
}

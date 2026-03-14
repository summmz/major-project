// === Dynamic Gradient Module — Spotify-style color extraction (improved) ===

let currentGradientColor = null;
let gradientCanvas = null;
let gradientCtx = null;
let _animFrame = null;
let _fromColor = null;
let _toColor = null;
let _animStart = null;
const ANIM_DURATION = 800;

function getCanvas() {
    if (!gradientCanvas) {
        gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 64;
        gradientCanvas.height = 64;
        gradientCtx = gradientCanvas.getContext('2d', { willReadFrequently: true });
    }
    return { canvas: gradientCanvas, ctx: gradientCtx };
}

export function extractColor(imgSrc) {
    return new Promise((resolve) => {
        if (!imgSrc || imgSrc.includes('home.svg') || imgSrc.includes('img/home')) {
            resolve({ r: 18, g: 18, b: 18 });
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const { ctx } = getCanvas();
                ctx.drawImage(img, 0, 0, 64, 64);
                const data = ctx.getImageData(0, 0, 64, 64).data;

                const buckets = {};

                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    if (a < 200) continue;

                    // Perceptual brightness — skip near-black and near-white
                    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
                    if (brightness < 28 || brightness > 210) continue;

                    // Tighter buckets (24-step) preserve hue distinctions
                    const qr = Math.round(r / 24) * 24;
                    const qg = Math.round(g / 24) * 24;
                    const qb = Math.round(b / 24) * 24;
                    const key = `${qr},${qg},${qb}`;

                    if (!buckets[key]) buckets[key] = { r: qr, g: qg, b: qb, count: 0, satSum: 0 };
                    buckets[key].count++;

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    buckets[key].satSum += max === 0 ? 0 : (max - min) / max;
                }

                let best = null;
                let bestScore = -1;

                for (const key in buckets) {
                    const { r, g, b, count, satSum } = buckets[key];
                    const avgSat = satSum / count;
                    // Quadratic saturation weight: vivid colors clearly win over greys
                    const score = count * (1 + avgSat * avgSat * 4);
                    if (score > bestScore) { bestScore = score; best = { r, g, b }; }
                }

                if (!best) { resolve({ r: 29, g: 185, b: 84 }); return; }

                // If dominant color is nearly grey, fall back to brand green
                const max = Math.max(best.r, best.g, best.b);
                const min = Math.min(best.r, best.g, best.b);
                const sat = max === 0 ? 0 : (max - min) / max;
                resolve(sat < 0.12 ? { r: 29, g: 185, b: 84 } : best);

            } catch {
                resolve({ r: 29, g: 185, b: 84 });
            }
        };

        img.onerror = () => resolve({ r: 29, g: 185, b: 84 });
        img.src = imgSrc;
    });
}

// 8-stop gradient: vivid top, cinematic slow fade to pure black
function _buildGradient(r, g, b) {
    const ar = Math.min(255, Math.round(r * 1.15));
    const ag = Math.min(255, Math.round(g * 1.15));
    const ab = Math.min(255, Math.round(b * 1.15));
    return [
        `rgba(${ar},${ag},${ab},0.55)  0%`,
        `rgba(${ar},${ag},${ab},0.42)  5%`,
        `rgba(${ar},${ag},${ab},0.30) 12%`,
        `rgba(${ar},${ag},${ab},0.20) 22%`,
        `rgba(${ar},${ag},${ab},0.13) 33%`,
        `rgba(${ar},${ag},${ab},0.07) 46%`,
        `rgba(${ar},${ag},${ab},0.03) 58%`,
        `rgba(0,0,0,0)                70%`,
    ].join(', ');
}

function _lerp(a, b, t) {
    return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}

function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function _animateTo(target) {
    if (_animFrame) cancelAnimationFrame(_animFrame);
    _fromColor = currentGradientColor ? { ...currentGradientColor } : { r: 0, g: 0, b: 0 };
    _toColor   = target;
    _animStart = null;

    const panel = document.querySelector('.right');
    if (!panel) { currentGradientColor = target; return; }

    function step(ts) {
        if (!_animStart) _animStart = ts;
        const t = _easeOut(Math.min((ts - _animStart) / ANIM_DURATION, 1));
        const mid = _lerp(_fromColor, _toColor, t);
        panel.style.background = `linear-gradient(180deg, ${_buildGradient(mid.r, mid.g, mid.b)})`;
        if (t < 1) {
            _animFrame = requestAnimationFrame(step);
        } else {
            currentGradientColor = target;
            _animFrame = null;
        }
    }

    _animFrame = requestAnimationFrame(step);
}

export function applyGradient(color) { _animateTo(color); }

export function resetGradient() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    currentGradientColor = null;
    const panel = document.querySelector('.right');
    if (panel) panel.style.background = '';
}

export async function applyGradientFromImage(imgSrc) {
    const color = await extractColor(imgSrc);
    applyGradient(color);
    return color;
}

// Now-playing fullscreen: radial splash + linear fade
export function applyNowPlayingGradient(color) {
    const npfBg = document.getElementById('npfBg');
    if (!npfBg || !color) return;
    const { r, g, b } = color;
    const ar = Math.min(255, Math.round(r * 1.1));
    const ag = Math.min(255, Math.round(g * 1.1));
    const ab = Math.min(255, Math.round(b * 1.1));
    npfBg.style.background = `
        radial-gradient(ellipse at 50% 20%, rgba(${ar},${ag},${ab},0.65) 0%, transparent 65%),
        linear-gradient(180deg, rgba(${ar},${ag},${ab},0.5) 0%, rgba(${ar},${ag},${ab},0.25) 35%, rgba(0,0,0,0.9) 100%)
    `;
}

export function getCurrentColor() { return currentGradientColor; }

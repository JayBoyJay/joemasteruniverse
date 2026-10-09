// JOE MASTER UNIVERSE — every wrestler is a Joe Master from a different universe.
// Each costume is a "look" for the Rig: painted PS2-style textures plus a few 3D props.
// Painters draw into small canvases: torso textures wrap around the body (the front is the
// middle of the texture), leg textures wrap around each leg.
import { shade, mulberry } from './tex.js';

export const SKIN = '#ecbd94';
const HAIR = '#5c4024', BEARD = '#8b5a2b';
const PURPLE = '#9b4dff', PURPLE_DK = '#6a2bc4', INK = '#141418';

export const BIO = {
  height: '6\'0"', weight: '84kg', nickname: 'THE PODFATHER', signature: 'SMALL PACKAGE', debut: '2025',
  highlights: [
    'WORLD\'S MOST FAMOUS PODCAST HOST',
    'PINNED EINAR THE STRANGE — "TOTALLY CLEAN AND WITH NO HELP AT ALL"',
    'UNDEFEATED RECORD… AGAINST LAYLA PAIGE',
    'PARTY GUY TY\'S STUNT DOUBLE',
  ],
};

// ---------------------------------------------------------------- faces
function makeFace({ lens = 'dark', mask = null } = {}) {
  return function face(c, w, h) {
    c.fillStyle = SKIN; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.25; c.fillStyle = '#d9826a';
    c.beginPath(); c.ellipse(w * 0.22, h * 0.6, w * 0.12, h * 0.07, 0, 0, 7); c.ellipse(w * 0.78, h * 0.6, w * 0.12, h * 0.07, 0, 0, 7); c.fill();
    c.globalAlpha = 1;
    if (mask) { // luchador mask over the top two-thirds of the head
      c.fillStyle = mask.base; c.fillRect(0, 0, w, h * 0.66);
      c.beginPath(); c.moveTo(0, h * 0.66); c.quadraticCurveTo(w / 2, h * 0.58, w, h * 0.66); c.lineTo(w, h * 0.6); c.lineTo(0, h * 0.6); c.fill();
      c.strokeStyle = mask.trim; c.lineWidth = 4;
      for (const sx of [-1, 1]) {
        c.beginPath(); c.moveTo(w / 2 + sx * w * 0.06, h * 0.3);
        c.quadraticCurveTo(w / 2 + sx * w * 0.5, h * 0.22, w / 2 + sx * w * 0.42, h * 0.55); c.stroke();
      }
      c.beginPath(); c.moveTo(w / 2, h * 0.02); c.lineTo(w / 2, h * 0.3); c.stroke();
      c.fillStyle = mask.trim; c.beginPath(); c.moveTo(w / 2, h * 0.05); c.lineTo(w * 0.42, h * 0.2); c.lineTo(w * 0.58, h * 0.2); c.fill();
    } else {
      // swept-back hair line
      c.fillStyle = HAIR;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.2);
      c.quadraticCurveTo(w * 0.75, h * 0.15, w * 0.5, h * 0.19); c.quadraticCurveTo(w * 0.25, h * 0.15, 0, h * 0.22); c.fill();
      c.strokeStyle = shade(HAIR, 0.25); c.lineWidth = 1.4;
      for (let i = 0; i < 9; i++) { const x = w * (0.08 + i * 0.105); c.beginPath(); c.moveTo(x, h * 0.18); c.quadraticCurveTo(x + 4, h * 0.08, x + 9, 0); c.stroke(); }
      c.strokeStyle = shade(HAIR, -0.1); c.lineWidth = h * 0.035; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * 0.15, h * 0.35); c.quadraticCurveTo(w * 0.28, h * 0.31, w * 0.42, h * 0.35); c.stroke();
      c.beginPath(); c.moveTo(w * 0.58, h * 0.35); c.quadraticCurveTo(w * 0.72, h * 0.31, w * 0.85, h * 0.35); c.stroke();
    }
    // nose
    c.fillStyle = shade(SKIN, -0.22); c.globalAlpha = mask ? 0 : 0.55;
    c.beginPath(); c.moveTo(w * 0.5, h * 0.44); c.lineTo(w * 0.42, h * 0.6); c.lineTo(w * 0.5, h * 0.62); c.fill();
    c.globalAlpha = 1;
    // beard
    const bg = c.createLinearGradient(0, h * 0.55, 0, h);
    bg.addColorStop(0, BEARD); bg.addColorStop(1, shade(BEARD, -0.25));
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(0, h * 0.42); c.lineTo(w * 0.1, h * 0.42);
    c.quadraticCurveTo(w * 0.16, h * 0.6, w * 0.3, h * 0.64);
    c.quadraticCurveTo(w * 0.5, h * 0.6, w * 0.7, h * 0.64);
    c.quadraticCurveTo(w * 0.84, h * 0.6, w * 0.9, h * 0.42); c.lineTo(w, h * 0.42);
    c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.strokeStyle = shade(BEARD, 0.18); c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = (i * 37 % 100) / 100 * w, y = h * (0.62 + ((i * 53) % 37) / 100);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (x < w / 2 ? -2 : 2), y + 5); c.stroke();
    }
    c.fillStyle = '#7a3a2c'; c.beginPath(); c.ellipse(w * 0.5, h * 0.74, w * 0.11, h * 0.025, 0, 0, 7); c.fill();
    c.fillStyle = '#4a1c14'; c.fillRect(w * 0.41, h * 0.738, w * 0.18, 1.5);
    // eyewear
    const lensCol = { dark: ['#5a3a14', '#1a120a', '#2a1a0c'], red: ['#ff6a5a', '#c8141a', '#7a0a10'] }[lens];
    if (lensCol) {
      for (const cx of [w * 0.29, w * 0.71]) {
        const g = c.createLinearGradient(0, h * 0.38, 0, h * 0.52);
        g.addColorStop(0, lensCol[0]); g.addColorStop(0.45, lensCol[1]); g.addColorStop(1, lensCol[2]);
        c.fillStyle = g; c.beginPath(); c.ellipse(cx, h * 0.45, w * 0.16, h * 0.072, 0, 0, 7); c.fill();
        c.strokeStyle = '#120c08'; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(255,240,220,0.6)'; c.beginPath(); c.ellipse(cx - w * 0.06, h * 0.42, w * 0.045, h * 0.016, -0.3, 0, 7); c.fill();
      }
      c.strokeStyle = '#120c08'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(w * 0.44, h * 0.44); c.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.56, h * 0.44); c.stroke();
    } else if (lens === 'shutter') {
      c.fillStyle = '#5dff3a'; c.fillRect(w * 0.1, h * 0.39, w * 0.8, h * 0.12);
      c.fillStyle = '#1a3a10'; for (let i = 0; i < 4; i++) c.fillRect(w * 0.12, h * (0.4 + i * 0.028), w * 0.76, h * 0.012);
    } else if (lens === 'patch') {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(w * 0.3, h * 0.45, w * 0.08, h * 0.035, 0, 0, 7); c.fill();
      c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(w * 0.3, h * 0.45, h * 0.025, 0, 7); c.fill();
      c.fillStyle = '#0a0a0a'; c.beginPath(); c.ellipse(w * 0.7, h * 0.45, w * 0.15, h * 0.08, 0, 0, 7); c.fill();
      c.strokeStyle = '#0a0a0a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * 0.3); c.lineTo(w, h * 0.55); c.stroke();
    }
    const sg = c.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(0.18, 'rgba(0,0,0,0)'); sg.addColorStop(0.82, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
  };
}

// ---------------------------------------------------------------- shared painters
const solid = col => (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };

function joeLogo(c, cx, cy, r, H) {
  c.fillStyle = '#f4f4f4'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(cx, cy, r * 0.72, 0, 7); c.fill();
  c.fillStyle = '#5a3ad8'; c.beginPath(); c.ellipse(cx, cy - r * 0.18, r * 0.42, r * 0.38, 0, 0, 7); c.fill();
  c.fillStyle = '#ff8a1a'; c.beginPath(); c.ellipse(cx, cy + r * 0.05, r * 0.32, r * 0.36, 0, 0, 7); c.fill();
  c.fillStyle = '#5a3ad8'; c.beginPath(); c.ellipse(cx, cy + r * 0.32, r * 0.3, r * 0.18, 0, 0, 7); c.fill();
  c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(cx - r * 0.14, cy, r * 0.11, 0, 7); c.arc(cx + r * 0.14, cy, r * 0.11, 0, 7); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 2.5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
  c.font = `900 ${Math.round(H * 0.15)}px Impact, "Arial Black", sans-serif`;
  c.strokeText('JOE', cx, cy - r - H * 0.06); c.fillText('JOE', cx, cy - r - H * 0.06);
  c.font = `900 ${Math.round(H * 0.16)}px Impact, "Arial Black", sans-serif`;
  c.strokeText('MASTER', cx, cy + r + H * 0.1); c.fillText('MASTER', cx, cy + r + H * 0.1);
}
function tankTop(c, W, H) {
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  c.fillStyle = '#1d1d24';
  for (let i = 0; i < 6; i++) c.fillRect(W * 0.3 + i * 9, H * 0.55 + (i % 2) * 6, 2, H * 0.4);
  joeLogo(c, W / 2, H * 0.36, H * 0.2, H);
}
function eggplant(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = '#6b4bd8'; c.beginPath(); c.ellipse(0, 0, s, s * 0.42, 0, 0, 7); c.fill();
  c.fillStyle = '#9d86ff'; c.beginPath(); c.ellipse(-s * 0.1, -s * 0.14, s * 0.6, s * 0.1, 0, 0, 7); c.fill();
  c.fillStyle = '#b6d42a'; c.beginPath(); c.moveTo(s * 0.85, -s * 0.35); c.lineTo(s * 1.25, 0); c.lineTo(s * 0.85, s * 0.35); c.lineTo(s * 0.7, 0); c.fill();
  c.restore();
}
const eggPrint = (bg, size) => (c, W, H) => {
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const r = mulberry(7);
  for (let y = -4; y < H + 8; y += size * 1.6) for (let x = ((y / size) % 2) * size; x < W + size; x += size * 2.4) eggplant(c, x + r() * 4, y + r() * 4, size * 0.7, -0.6 + r() * 1.2);
};
function podfatherShirt(c, W, H) {
  eggPrint('#111116', 9)(c, W, H);
  const cx = W / 2;
  c.fillStyle = SKIN; c.beginPath(); c.moveTo(cx - 12, 0); c.lineTo(cx + 12, 0); c.lineTo(cx, H * 0.45); c.fill();
  c.strokeStyle = '#0a0a0e'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, H * 0.45); c.lineTo(cx, H); c.stroke();
  c.fillStyle = '#2a2a33'; for (let y = H * 0.55; y < H; y += 9) { c.beginPath(); c.arc(cx + 2, y, 1.5, 0, 7); c.fill(); }
}
function podfatherBelly(c, W, H) {
  eggPrint('#111116', 9)(c, W, H);
  c.strokeStyle = '#0a0a0e'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
}
function jeans(c, W, H) {
  c.fillStyle = '#7d9cc4'; c.fillRect(0, 0, W, H);
  const r = mulberry(3);
  for (let i = 0; i < 260; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(20,40,80,0.12)'; c.fillRect(r() * W, r() * H, 1, 3); }
  c.strokeStyle = '#c99a4a'; c.lineWidth = 1;
  for (const u of [0.25, 0.75]) { c.beginPath(); c.moveTo(W * u, 0); c.lineTo(W * u, H); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(W * 0.42, H * 0.5, W * 0.16, H * 0.3);
}
function sparkle(base1, base2) {
  return (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, base1); g.addColorStop(0.5, base2); g.addColorStop(1, base1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = mulberry(11);
    for (let i = 0; i < W * H / 22; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; c.fillRect(r() * W, r() * H, 1, 1); }
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(W * 0.38, 0, W * 0.08, H);
  };
}
const sparkleBase = sparkle('#3d36c8', '#7a55ff');
function sparkleSinglet(c, W, H) {
  sparkleBase(c, W, H);
  const cx = W / 2;
  c.fillStyle = '#ff4fb3'; c.beginPath(); c.moveTo(cx - 27, 0); c.lineTo(cx + 27, 0); c.lineTo(cx, H * 0.85); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.moveTo(cx - 22, 0); c.lineTo(cx + 22, 0); c.lineTo(cx, H * 0.74); c.fill();
  c.strokeStyle = shade(SKIN, -0.25); c.lineWidth = 1;
  c.beginPath(); c.moveTo(cx - 12, H * 0.22); c.quadraticCurveTo(cx - 5, H * 0.28, cx, H * 0.24); c.moveTo(cx + 12, H * 0.22); c.quadraticCurveTo(cx + 5, H * 0.28, cx, H * 0.24); c.stroke();
}
function fringe(colA, colB) {
  return (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, W, H * 0.18);
    for (let x = 0; x < W; x += 4) { c.fillStyle = (x / 4) % 3 === 0 ? colB : colA; c.fillRect(x, H * 0.18, 2, H * (0.65 + ((x * 7) % 5) * 0.07)); }
  };
}
function floral(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a2bd0'); g.addColorStop(1, '#7a2bd8');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = mulberry(5);
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, s = 3 + r() * 5;
    c.fillStyle = r() < 0.5 ? '#ff4fd8' : '#c84fff';
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; c.beginPath(); c.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.8, s * 0.4, a, 0, 7); c.fill(); }
  }
}
function sailorTop(c, W, H) {
  c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, W, H);
  const navy = '#1c2850', cx = W / 2;
  // collar flap at the back
  c.fillStyle = navy; c.fillRect(0, 0, W * 0.22, H * 0.4); c.fillRect(W * 0.78, 0, W * 0.22, H * 0.4);
  c.fillStyle = '#fff'; c.fillRect(0, H * 0.34, W * 0.22, 2); c.fillRect(W * 0.78, H * 0.34, W * 0.22, 2);
  // front V collar
  c.fillStyle = navy; c.beginPath(); c.moveTo(cx - 34, 0); c.lineTo(cx + 34, 0); c.lineTo(cx, H * 0.6); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.moveTo(cx - 24, 0); c.lineTo(cx + 24, 0); c.lineTo(cx, H * 0.46); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 31, 0); c.lineTo(cx, H * 0.56); c.lineTo(cx + 31, 0); c.stroke();
  // red scarf bow
  c.fillStyle = '#d8202a'; c.beginPath(); c.moveTo(cx, H * 0.55); c.lineTo(cx - 12, H * 0.48); c.lineTo(cx - 10, H * 0.66); c.fill();
  c.beginPath(); c.moveTo(cx, H * 0.55); c.lineTo(cx + 12, H * 0.48); c.lineTo(cx + 10, H * 0.66); c.fill();
  c.beginPath(); c.moveTo(cx - 3, H * 0.56); c.lineTo(cx + 3, H * 0.56); c.lineTo(cx + 7, H * 0.95); c.lineTo(cx - 7, H * 0.95); c.fill();
}
function pleats(col) {
  return (c, W, H) => {
    c.fillStyle = col; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 6) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, 0, 1, H); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 1, 0, 2, H); }
  };
}
function plates(c, W, H) {
  c.fillStyle = '#121212'; c.fillRect(0, 0, W, H);
  const rows = Math.max(4, Math.round(H / 10));
  for (let i = 0; i < rows; i++) {
    const y = i * H / rows;
    c.fillStyle = i % 2 ? '#9a1a1a' : '#b8241f'; c.fillRect(0, y + 1, W, H / rows - 3);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y + 1, W, 1.5);
    c.fillStyle = '#e8c45a'; for (let x = 3; x < W; x += 7) c.fillRect(x, y + H / rows - 3, 2, 2);
  }
}
function hakama(c, W, H) { pleats('#1e2238')(c, W, H); c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, W, 3); }
function chestBare(c, W, H) {
  c.fillStyle = SKIN; c.fillRect(0, 0, W, H);
  const d = shade(SKIN, -0.3), l = shade(SKIN, 0.14), s = shade(SKIN, -0.12), cx = W / 2, k = W / 64;
  c.fillStyle = s; c.fillRect(0, 0, 10 * k, H); c.fillRect(W - 10 * k, 0, 10 * k, H);
  c.fillStyle = l; c.beginPath(); c.ellipse(cx - 7 * k, 9 * k, 7 * k, 5 * k, 0, 0, 7); c.ellipse(cx + 7 * k, 9 * k, 7 * k, 5 * k, 0, 0, 7); c.fill();
  c.strokeStyle = d; c.lineWidth = 1.1 * k;
  c.beginPath(); c.moveTo(cx, 3 * k); c.lineTo(cx, H); c.stroke();
  c.beginPath(); c.moveTo(cx - 14 * k, 12 * k); c.quadraticCurveTo(cx - 7 * k, 17 * k, cx - k, 13 * k); c.moveTo(cx + 14 * k, 12 * k); c.quadraticCurveTo(cx + 7 * k, 17 * k, cx + k, 13 * k); c.stroke();
  for (const y of [19, 24, 29]) { c.beginPath(); c.moveTo(cx - 5 * k, y * k); c.lineTo(cx + 5 * k, y * k); c.stroke(); }
}
function luchaTights(c, W, H) {
  c.fillStyle = PURPLE_DK; c.fillRect(0, 0, W, H);
  c.fillStyle = '#e2b23a';
  for (const u of [0.25, 0.75]) {
    c.beginPath(); c.moveTo(W * u - 5, H); c.lineTo(W * u - 2, H * 0.4); c.lineTo(W * u + 1, H * 0.7); c.lineTo(W * u + 4, H * 0.3); c.lineTo(W * u + 6, H); c.fill();
  }
}
function suitJacket(c, W, H) {
  c.fillStyle = '#2e3038'; c.fillRect(0, 0, W, H);
  const cx = W / 2;
  c.fillStyle = '#f4f4f4'; c.beginPath(); c.moveTo(cx - 14, 0); c.lineTo(cx + 14, 0); c.lineTo(cx, H * 0.85); c.fill();
  c.fillStyle = PURPLE; c.beginPath(); c.moveTo(cx - 3, H * 0.08); c.lineTo(cx + 3, H * 0.08); c.lineTo(cx + 4, H * 0.75); c.lineTo(cx, H * 0.85); c.lineTo(cx - 4, H * 0.75); c.fill();
  c.fillStyle = '#3a3d48'; c.beginPath(); c.moveTo(cx - 14, 0); c.lineTo(cx - 24, 0); c.lineTo(cx - 6, H * 0.6); c.lineTo(cx, H * 0.85); c.fill();
  c.beginPath(); c.moveTo(cx + 14, 0); c.lineTo(cx + 24, 0); c.lineTo(cx + 6, H * 0.6); c.lineTo(cx, H * 0.85); c.fill();
  c.fillStyle = '#f4f4f4'; c.fillRect(cx - 30, H * 0.3, 8, 3); // pocket square
}
function suitLower(c, W, H) {
  c.fillStyle = '#2e3038'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#1e2028'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
  c.fillStyle = '#111'; for (const y of [H * 0.2, H * 0.6]) { c.beginPath(); c.arc(W / 2 + 3, y, 2, 0, 7); c.fill(); }
}
function trousers(col) { return (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(W * 0.48, 0, 2, H); }; }
function aubergine(c, W, H) {
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#4a2088'); g.addColorStop(0.5, '#8a4ae0'); g.addColorStop(1, '#4a2088');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(W * 0.42, H * 0.4, W * 0.03, H * 0.35, 0, 0, 7); c.fill();
}
function spaceSuit(c, W, H) {
  c.fillStyle = '#e6e6ea'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#b8b8c0'; c.lineWidth = 1;
  for (const y of [H * 0.3, H * 0.65]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const cx = W / 2;
  c.fillStyle = '#9aa0aa'; c.fillRect(cx - 12, H * 0.42, 24, 16);
  c.fillStyle = '#ff3a3a'; c.fillRect(cx - 9, H * 0.46, 4, 4); c.fillStyle = '#3aff7a'; c.fillRect(cx - 2, H * 0.46, 4, 4); c.fillStyle = '#3a8aff'; c.fillRect(cx + 5, H * 0.46, 4, 4);
  c.fillStyle = PURPLE; c.beginPath(); c.arc(cx + 22, H * 0.2, 7, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JMU', cx + 22, H * 0.2);
}
function spaceLegs(c, W, H) { c.fillStyle = '#e6e6ea'; c.fillRect(0, 0, W, H); c.fillStyle = '#b8b8c0'; c.fillRect(W * 0.4, H * 0.7, W * 0.2, H * 0.3); c.fillRect(0, H * 0.1, W, 2); }
function pirateShirt(c, W, H) {
  c.fillStyle = '#efe8d6'; c.fillRect(0, 0, W, H);
  const cx = W / 2;
  c.fillStyle = SKIN; c.beginPath(); c.moveTo(cx - 10, 0); c.lineTo(cx + 10, 0); c.lineTo(cx, H * 0.55); c.fill();
  c.strokeStyle = '#6a4a2a'; c.lineWidth = 1; for (let y = 6; y < H * 0.5; y += 6) { c.beginPath(); c.moveTo(cx - 6 + y * 0.1, y); c.lineTo(cx + 6 - y * 0.1, y + 3); c.stroke(); }
  c.fillStyle = '#5a3a1e'; c.fillRect(0, 0, cx - 20, H); c.fillRect(cx + 20, 0, W - cx - 20, H);
  c.fillStyle = '#e2b23a'; for (let y = H * 0.25; y < H; y += 12) { c.beginPath(); c.arc(cx - 22, y, 1.5, 0, 7); c.arc(cx + 22, y, 1.5, 0, 7); c.fill(); }
}
function sash(c, W, H) {
  c.fillStyle = '#b0202a'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#8a141c'; for (let x = 0; x < W; x += 8) c.fillRect(x, 0, 2, H);
}
function shortsOriginal(c, W, H, side = 1) {
  c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#16161a';
  c.fillRect(W * 0.2, 0, W * 0.1, H); c.fillRect(W * 0.7, 0, W * 0.1, H);
  c.fillRect(0, H * 0.86, W, H * 0.14);
  c.fillStyle = '#d8d8d8'; c.fillRect(0, H * 0.82, W, 2);
  if (side < 0) return;
  c.textAlign = 'center'; c.font = `900 ${Math.round(H * 0.11)}px Impact, sans-serif`;
  c.fillStyle = PURPLE; c.strokeStyle = '#000'; c.lineWidth = 1.5;
  c.strokeText('JOE', W * 0.5, H * 0.6); c.fillText('JOE', W * 0.5, H * 0.6);
  c.font = `900 ${Math.round(H * 0.09)}px Impact, sans-serif`;
  c.strokeText('MASTER', W * 0.5, H * 0.72); c.fillText('MASTER', W * 0.5, H * 0.72);
}
function laces(col) {
  return (c, W, H) => {
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, W, H);
    c.strokeStyle = col; c.lineWidth = 2;
    for (let y = 2; y < H; y += 5) { c.beginPath(); c.moveTo(W * 0.3, y); c.lineTo(W * 0.7, y + 4); c.moveTo(W * 0.7, y); c.lineTo(W * 0.3, y + 4); c.stroke(); }
  };
}
// knee pad decals from the sparkle-singlet photo: Joe's face on one, an eggplant on the other
function decalFace(c, W, H) {
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  c.fillStyle = '#5a3ad8'; c.beginPath(); c.ellipse(W / 2, H * 0.42, W * 0.3, H * 0.3, 0, 0, 7); c.fill();
  c.fillStyle = '#e8402a'; c.beginPath(); c.ellipse(W / 2, H * 0.5, W * 0.22, H * 0.26, 0, 0, 7); c.fill();
  c.fillStyle = '#5a3ad8'; c.beginPath(); c.ellipse(W / 2, H * 0.72, W * 0.2, H * 0.12, 0, 0, 7); c.fill();
  c.fillStyle = '#ff2a2a'; c.fillRect(W * 0.3, H * 0.44, W * 0.4, H * 0.08);
}
function decalEgg(c, W, H) { c.fillStyle = INK; c.fillRect(0, 0, W, H); eggplant(c, W * 0.46, H * 0.55, W * 0.28, -0.9); }

// ---------------------------------------------------------------- costumes
const base = {
  build: 'average', hair: HAIR, hairStyle: 'swept', beard: BEARD, glasses: 'dark', signature: 'joe',
};
const C = (id, o) => ({ id, ...o, look: { ...base, ...o.look } });

export const COSTUMES = [
  C('original', {
    title: 'THE ORIGINAL', cpuName: 'JOE MASTER', universe: 'EARTH-1',
    look: {
      face: makeFace({ lens: 'dark' }),
      torso: tankTop, torsoSize: [128, 64], belly: INK, traps: INK,
      trunks: '#f4f4f2', belt: '#16161a', legs: shortsOriginal, legsSize: [64, 64], legsWide: 1.12,
      kneepad: INK, kneeDisc: PURPLE, boots: '#f2f2f2', laces: laces(PURPLE),
      wrist: '#a75fe0', elbowPadR: { color: INK, disc: PURPLE_DK }, sleeveL: INK,
    },
  }),
  C('podfather', {
    title: 'THE PODFATHER', cpuName: 'POD MASTER', universe: 'EARTH-POD',
    look: {
      face: makeFace({ lens: 'dark' }),
      torso: podfatherShirt, torsoSize: [128, 64], belly: podfatherBelly, traps: '#111116',
      sleeve: { mat: eggPrint('#111116', 7), size: [32, 32], cuff: '#26262e' },
      trunks: '#7d9cc4', belt: '#2a1a10', legs: jeans, legsSize: [64, 64], pants: true, legsWide: 1.1,
      boots: '#f2f2f2', shoe: true, headphones: true,
    },
  }),
  C('sparkle', {
    title: 'SPARKLE MOTION', cpuName: 'GLITTER MASTER', universe: 'EARTH-1984',
    look: {
      face: makeFace({ lens: 'shutter' }), glasses: 'shutter', hat: 'headband', hatColor: '#2a4ad8',
      torso: sparkleSinglet, torsoSize: [128, 64], belly: sparkleBase, traps: '#5a45e0',
      trunks: sparkleBase, belt: '#4a3ad0', legs: sparkleBase, legsSize: [64, 64], pants: true,
      fringeArm: fringe('#ff5fb8', '#f4f4f4'), fringeBoot: fringe('#ff5fb8', '#f4f4f4'),
      wrist: '#a75fe0', kneepad: INK, kneeDecal: [decalEgg, decalFace], boots: '#4a3ad0',
    },
  }),
  C('sombrero', {
    title: 'EL MAESTRO', cpuName: 'SOMBRERO MASTER', universe: 'EARTH-52',
    look: {
      face: makeFace({ lens: 'red' }), glasses: 'red', hat: 'sombrero',
      torso: tankTop, torsoSize: [128, 64], belly: INK, traps: INK,
      trunks: '#7d9cc4', belt: '#1a1a1a', legs: jeans, legsSize: [64, 64], pants: true, legsWide: 1.1,
      wrist: '#a75fe0', boots: '#2a2a2e', shoe: true,
    },
  }),
  C('disco', {
    title: 'DISCO INFERNO', cpuName: 'DISCO MASTER', universe: 'EARTH-1977',
    look: {
      face: makeFace({ lens: 'dark' }), hairStyle: 'wig', hair: '#7a5530',
      torso: tankTop, torsoSize: [128, 64], belly: INK, traps: INK,
      trunks: floral, belt: '#3a2bd0', legs: floral, legsSize: [64, 64], pants: true, legsWide: 1.05,
      fringeArm: fringe('#e8a0ff', '#f4f4f4'), fringeBoot: fringe('#e8a0ff', '#f4f4f4'),
      wrist: '#ff5fae', boots: '#5a3ad0',
    },
  }),
  C('school', {
    title: 'SCHOOL DAYS', cpuName: 'SENPAI MASTER', universe: 'EARTH-831',
    look: {
      face: makeFace({ lens: 'dark' }), hat: 'bow', hatColor: '#d8202a',
      torso: sailorTop, torsoSize: [128, 64], belly: '#f4f4f0', traps: '#1c2850',
      sleeve: { mat: '#f4f4f0', cuff: '#1c2850' },
      trunks: '#1c2850', belt: '#1c2850', skirt: pleats('#1c2850'),
      socks: '#f6f6f6', boots: '#3a2214', shoe: true,
    },
  }),
  C('samurai', {
    title: 'THE LAST SAMURAI', cpuName: 'SHOGUN MASTER', universe: 'EARTH-1600',
    look: {
      face: makeFace({ lens: 'dark' }), hat: 'kabuto',
      torso: plates, torsoSize: [128, 64], belly: plates, traps: '#1a1a1a',
      sleeve: { mat: plates, size: [32, 32] },
      trunks: '#1e2238', belt: '#e8e8e8', legs: hakama, legsSize: [64, 64], pants: true, legsWide: 1.55,
      boots: '#d8d0c0', shoe: true,
    },
  }),
  C('luchador', {
    title: 'LUCHA LIBRE', cpuName: 'MASKED MASTER', universe: 'EARTH-619',
    look: {
      face: makeFace({ lens: 'red', mask: { base: PURPLE_DK, trim: '#e2b23a' } }), glasses: 'red', hairStyle: null, headColor: PURPLE_DK,
      torso: chestBare, torsoSize: [128, 64], belly: chestBare, traps: null,
      trunks: '#e2b23a', belt: PURPLE_DK, legs: luchaTights, legsSize: [64, 64], pants: true,
      kneepad: PURPLE_DK, kneeDisc: '#e2b23a', boots: '#e2b23a', wrist: '#e2b23a', cape: PURPLE_DK, capeTrim: '#e2b23a',
    },
  }),
  C('suit', {
    title: 'CEO OF PODCASTING', cpuName: 'BOARDROOM MASTER', universe: 'EARTH-$$$',
    look: {
      face: makeFace({ lens: 'dark' }),
      torso: suitJacket, torsoSize: [128, 64], belly: suitLower, traps: '#2e3038',
      sleeve: { mat: '#2e3038', long: true, cuff: '#f4f4f4' },
      trunks: '#2e3038', belt: '#111', legs: trousers('#2e3038'), legsSize: [32, 32], pants: true, legsWide: 1.05,
      boots: '#111114', shoe: true,
    },
  }),
  C('eggplant', {
    title: 'THE AUBERGINE', cpuName: 'EGGPLANT MASTER', universe: 'EARTH-69', build: 'heavy',
    look: {
      face: makeFace({ lens: 'red' }), glasses: 'red', hat: 'stalk',
      torso: aubergine, torsoSize: [64, 64], belly: aubergine, traps: '#6a34b0',
      sleeve: { mat: '#6a34b0', long: true }, gloves: '#3d6b22',
      trunks: '#6a34b0', belt: '#6a34b0', legs: '#6a34b0', pants: true, legsWide: 1.15,
      boots: '#3d6b22', shoe: true,
    },
  }),
  C('astronaut', {
    title: 'ONE GIANT SLAM', cpuName: 'SPACE MASTER', universe: 'EARTH-2001',
    look: {
      face: makeFace({ lens: 'dark' }), hat: 'helmet',
      torso: spaceSuit, torsoSize: [128, 64], belly: '#e6e6ea', traps: '#e6e6ea',
      sleeve: { mat: '#e6e6ea', long: true, cuff: '#9aa0aa' }, gloves: '#d0d0d6',
      trunks: '#e6e6ea', belt: '#9aa0aa', legs: spaceLegs, legsSize: [32, 32], pants: true, legsWide: 1.15,
      boots: '#c8c8cc',
    },
  }),
  C('pirate', {
    title: 'CAPTAIN PODBEARD', cpuName: 'CAPTAIN MASTER', universe: 'EARTH-7-SEAS',
    look: {
      face: makeFace({ lens: 'patch' }), glasses: 'patch', hat: 'tricorn',
      torso: pirateShirt, torsoSize: [128, 64], belly: sash, traps: '#efe8d6',
      sleeve: { mat: '#efe8d6', long: true, puffy: true },
      trunks: '#1a1a1e', belt: '#b0202a', legs: trousers('#1a1a1e'), legsSize: [32, 32], pants: true,
      shin: '#4a2a14', boots: '#4a2a14',
    },
  }),
];
export const COSTUME_BY_ID = Object.fromEntries(COSTUMES.map(c => [c.id, c]));
export const RANDOM_POOL = COSTUMES.filter(c => c.id !== 'original').map(c => c.id);

// The real one.
export const JOE = { ...COSTUME_BY_ID.original, name: 'JOE MASTER', skin: SKIN, color: PURPLE, finisher: 'THE MIC DROP' };

// "Jayden" -> "JAYDEN MASTER"
export function masterName(raw) {
  let n = String(raw || '').toUpperCase().replace(/[^A-Z0-9 .'\-!?]/g, '').replace(/\s+/g, ' ').trim();
  if (!n) n = 'ROOKIE';
  n = n.replace(/\s*MASTER$/, '').trim() || 'ROOKIE';
  return (n.slice(0, 12) + ' MASTER').trim();
}

// Small procedural canvas textures. Kept low-res on purpose for the PS2 look.
import * as THREE from 'three';

export const RING_H = 1.0;       // mat height above the arena floor
export const ROPE = 3.0;         // ropes run at +/- this (ring is 6m inside the ropes)
export const LIM = 2.62;         // how far a standing wrestler's centre can go
export const APRON = 3.75;

export function canvasTex(w, h, draw, { nearest = false, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.image = c;
  return t;
}

export function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 0) c.lerp(new THREE.Color(1, 1, 1), k); else c.multiplyScalar(1 + k);
  return '#' + c.getHexString();
}

export function noise(ctx, w, h, amt, alpha = 1) {
  const d = ctx.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    a[i] += n; a[i + 1] += n; a[i + 2] += n; a[i + 3] = a[i + 3] * alpha;
  }
  ctx.putImageData(d, 0, 0);
}

// ---------- faces ----------
// Default cartoon face so CPU wrestlers and photo-less players still look like somebody.
export function drawDefaultFace(ctx, w, h, skin, seed = 0) {
  const r = mulberry(seed * 9973 + 7);
  ctx.fillStyle = skin; ctx.fillRect(0, 0, w, h);
  const dark = shade(skin, -0.35);
  // hair line
  const hairCols = ['#1a120c', '#3b2414', '#6b4a2b', '#c9a15a', '#111', '#8a2b14'];
  const hair = hairCols[Math.floor(r() * hairCols.length)];
  const hairStyle = Math.floor(r() * 4);
  ctx.fillStyle = hair;
  if (hairStyle === 0) ctx.fillRect(0, 0, w, h * 0.14);
  else if (hairStyle === 1) { ctx.beginPath(); ctx.ellipse(w / 2, 0, w * 0.6, h * 0.24, 0, 0, 7); ctx.fill(); }
  else if (hairStyle === 2) { ctx.fillRect(0, 0, w, h * 0.08); }
  // brows
  const by = h * 0.36, ex = w * 0.27;
  ctx.strokeStyle = hair === '#c9a15a' ? '#6b4a2b' : hair; ctx.lineWidth = h * 0.04; ctx.lineCap = 'round';
  const angry = r() * 0.06;
  ctx.beginPath(); ctx.moveTo(w / 2 - ex - w * 0.1, by - h * angry); ctx.lineTo(w / 2 - w * 0.07, by + h * 0.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2 + ex + w * 0.1, by - h * angry); ctx.lineTo(w / 2 + w * 0.07, by + h * 0.02); ctx.stroke();
  // eyes
  const ey = h * 0.45;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w / 2 + s * ex * 0.85, ey, w * 0.085, h * 0.045, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1c140e'; ctx.beginPath(); ctx.arc(w / 2 + s * ex * 0.85, ey, h * 0.032, 0, 7); ctx.fill();
  }
  // nose
  ctx.fillStyle = dark; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.47); ctx.lineTo(w / 2 - w * 0.07, h * 0.62); ctx.lineTo(w / 2 + w * 0.06, h * 0.63); ctx.fill();
  ctx.globalAlpha = 1;
  // facial hair
  const fh = Math.floor(r() * 4);
  ctx.fillStyle = hair; ctx.globalAlpha = 0.85;
  if (fh === 1) { ctx.fillRect(w * 0.3, h * 0.66, w * 0.4, h * 0.05); }
  if (fh === 2) { ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.62); ctx.quadraticCurveTo(w / 2, h * 1.12, w * 0.8, h * 0.62); ctx.lineTo(w * 0.7, h * 0.78); ctx.quadraticCurveTo(w / 2, h * 0.86, w * 0.3, h * 0.78); ctx.fill(); }
  ctx.globalAlpha = 1;
  // mouth
  ctx.strokeStyle = '#5a1f1a'; ctx.lineWidth = h * 0.03;
  ctx.beginPath();
  if (r() < 0.5) { ctx.moveTo(w * 0.36, h * 0.76); ctx.lineTo(w * 0.64, h * 0.75); }
  else { ctx.moveTo(w * 0.36, h * 0.74); ctx.quadraticCurveTo(w / 2, h * 0.8, w * 0.64, h * 0.74); }
  ctx.stroke();
  // shading at the sides so the head box reads as rounder
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// Photo face: posterise slightly and feather the edges into the skin colour so it blends with the head box.
export function drawPhotoFace(ctx, w, h, img, skin) {
  ctx.fillStyle = skin; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      let v = a[i + k] / 255;
      v = (v - 0.5) * 1.12 + 0.52;                 // contrast
      a[i + k] = Math.round(Math.max(0, Math.min(1, v)) * 31) / 31 * 255; // 5-bit colour
    }
  }
  ctx.putImageData(d, 0, 0);
  const g = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.38, w / 2, h * 0.5, Math.max(w, h) * 0.62);
  const sk = new THREE.Color(skin);
  const rgba = a2 => `rgba(${sk.r * 255 | 0},${sk.g * 255 | 0},${sk.b * 255 | 0},${a2})`;
  g.addColorStop(0, rgba(0)); g.addColorStop(1, rgba(0.9));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

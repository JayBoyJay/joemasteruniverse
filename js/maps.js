// Venues. THE ARENA is built in arena.js; the rest are built here from the Arena toolkit
// (A.box, A.plane, A.glow, A.flame, A.people, A.ring, A.floorArea, ...).
// The fight area is always the same 5.2m square (see LIM in tex.js), so walls sit just outside it.
import { RING_H, noise, mulberry, canvasTex, shade } from './tex.js';

const F = RING_H;          // floor height of walled maps
const W = 3.45;            // wall distance from centre

// ---------------------------------------------------------------- shared painters
function brick(c, w, h, base = '#6e3428', mortar = '#2a1a16') {
  c.fillStyle = mortar; c.fillRect(0, 0, w, h);
  const bh = h / 8, bw = w / 4, r = mulberry(9);
  for (let row = 0; row < 8; row++) for (let i = -1; i < 5; i++) {
    const x = i * bw + (row % 2) * bw / 2;
    c.fillStyle = shade(base, (r() - 0.5) * 0.35);
    c.fillRect(x + 1, row * bh + 1, bw - 2, bh - 2);
  }
  noise(c, w, h, 22);
}
function concrete(c, w, h, base = '#4a4a4e') {
  c.fillStyle = base; c.fillRect(0, 0, w, h); noise(c, w, h, 26);
  const r = mulberry(5);
  c.globalAlpha = 0.25; c.fillStyle = '#000';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 4 + r() * 12, 3 + r() * 8, r() * 3, 0, 7); c.fill(); }
  c.globalAlpha = 1;
}
function planks(c, w, h, base = '#5a3a22') {
  const n = 6;
  for (let i = 0; i < n; i++) {
    c.fillStyle = shade(base, (i % 3 - 1) * 0.08); c.fillRect(0, i * h / n, w, h / n);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, (i + 1) * h / n - 1, w, 1);
    c.fillRect(((i * 37) % 5) / 5 * w, i * h / n, 1, h / n);
  }
  noise(c, w, h, 14);
}
function corrugated(c, w, h) {
  for (let x = 0; x < w; x++) { const v = 150 + 50 * Math.sin(x / w * Math.PI * 16); c.fillStyle = `rgb(${v * 0.92 | 0},${v * 0.95 | 0},${v | 0})`; c.fillRect(x, 0, 1, h); }
  const r = mulberry(13);
  c.globalAlpha = 0.35;
  for (let i = 0; i < 18; i++) { c.fillStyle = r() < 0.5 ? '#7a3a14' : '#5a2a0a'; c.beginPath(); c.ellipse(r() * w, h * (0.6 + r() * 0.4), 2 + r() * 6, 4 + r() * 14, 0, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  noise(c, w, h, 12);
}
function poster(c, w, h, icon, top = 'JOE MASTER', bottom = 'THE PODFATHER', bg = '#14081f') {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#9b4dff'; c.lineWidth = w * 0.04; c.strokeRect(0, 0, w, h);
  if (icon) c.drawImage(icon, w * 0.08, h * 0.16, w * 0.84, w * 0.84);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
  c.font = `italic 900 ${w * 0.13}px Impact, sans-serif`; c.fillText(top, w / 2, h * 0.08);
  c.font = `700 ${w * 0.08}px Arial, sans-serif`; c.fillStyle = '#c9a6ff'; c.fillText(bottom, w / 2, h * 0.92);
}
function signText(text, fg, bg = 'rgba(0,0,0,0)', font = 'italic 900', glow = null) {
  return (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    let s = h * 0.7;
    c.font = `${font} ${s}px Impact, "Arial Black", sans-serif`;
    while (c.measureText(text).width > w * 0.92 && s > 8) { s -= 2; c.font = `${font} ${s}px Impact, "Arial Black", sans-serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (glow) { c.shadowColor = glow; c.shadowBlur = h * 0.25; }
    c.fillStyle = fg; c.fillText(text, w / 2, h * 0.54);
  };
}
// a sign whose canvas is drawn on an unlit plane (neon, LED)
function neon(A, THREE, text, color, w, h, x, y, z, ry = 0) {
  const t = canvasTex(256, Math.round(256 * h / w), signText(text, color, 'rgba(0,0,0,0)', 'italic 900', color));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
  return A.add(m, x, y, z, ry);
}
function iconPoster(A, THREE, w, h, x, y, z, ry, top, bottom) {
  const t = A.iconTex(128, 192, (c, W2, H2, icon) => poster(c, W2, H2, icon, top, bottom));
  return A.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t })), x, y, z, ry);
}
function wall(A, THREE, painter, len, ht, x, z, ry, rep = [4, 2], tw = 128, th = 128) {
  const t = canvasTex(tw, th, painter, { repeat: rep });
  return A.add(new THREE.Mesh(new THREE.PlaneGeometry(len, ht), new THREE.MeshLambertMaterial({ map: t })), x, F + ht / 2, z, ry);
}
function flickerLight(A, l, base, amt = 0.25, speed = 11) {
  const ph = Math.random() * 9;
  A.every((dt, t) => { l.intensity = base * (1 - amt + amt * (0.5 + 0.5 * Math.sin(t * speed + ph) * Math.sin(t * speed * 1.7 + ph))); });
}

// ---------------------------------------------------------------- BACK STREET
function buildStreet(A, THREE) {
  A.scene.background = new THREE.Color(0x07080f);
  A.scene.fog = new THREE.Fog(0x07080f, 11, 36);
  A.light('ambient', 0x4a5470, 1.0);
  A.light('hemi', 0x6a7aa8, 0.5, 0, 0, 0).groundColor.set(0x1a1410);
  const moon = A.light('dir', 0x9ab0ff, 0.7, -4, 12, 6);
  const lamp = A.light('point', 0xffb060, 30, -2.6, F + 4.4, -3.0, 13, 1.4);
  const pink = A.light('point', 0xff3ab0, 14, 3.1, F + 3.2, -0.8, 7, 1.5);
  const fire = A.light('point', 0xff7a20, 12, 2.95, F + 1.3, 3.1, 7, 1.5);
  flickerLight(A, fire, 12, 0.35, 13);
  flickerLight(A, pink, 14, 0.12, 3);

  // asphalt with painted line, cracks and puddles
  A.floorArea(A.mat((c, w, h) => {
    c.fillStyle = '#2a2b30'; c.fillRect(0, 0, w, h); noise(c, w, h, 30);
    const r = mulberry(21);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { let x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = 'rgba(120,140,190,0.18)';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 14 + r() * 20, 6 + r() * 10, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(230,200,60,0.55)'; for (let y = 0; y < h; y += 32) c.fillRect(w / 2 - 2, y, 4, 18);
  }, { w: 256, h: 256, texOpts: { repeat: [6, 6] } }), 40);

  // brick walls left and right, a chain-link fence at the back, a building behind it
  for (const sx of [-1, 1]) wall(A, THREE, (c, w, h) => brick(c, w, h, sx < 0 ? '#6e3428' : '#5e3a30'), 18, 7, sx * W, -2, -sx * Math.PI / 2, [5, 2]);
  const fenceTex = canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#b8bcc4'; c.lineWidth = 2;
    for (let i = -w; i < w * 2; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); }
  }, { repeat: [9, 4] });
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 3.2), new THREE.MeshLambertMaterial({ map: fenceTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })), 0, F + 1.6, -3.5);
  for (const x of [-W + 0.05, -1.15, 1.15, W - 0.05]) A.cyl(0.04, 0.04, 3.3, 0x8a8e96, x, F + 1.65, -3.5, 6);
  A.box(W * 2, 0.05, 0.05, 0x8a8e96, 0, F + 3.25, -3.5);
  wall(A, THREE, (c, w, h) => {
    brick(c, w, h, '#3a2a30', '#141016');
    const r = mulberry(31);
    for (let i = 0; i < 6; i++) { c.fillStyle = r() < 0.5 ? '#e8c060' : '#20242c'; c.fillRect(8 + (i % 3) * 40, 14 + Math.floor(i / 3) * 56, 22, 30); }
  }, 22, 12, 0, -11, 0, [3, 2]);
  // graffiti
  const graf = canvasTex(256, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = 'italic 900 58px Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = '#111'; c.strokeText('JOE MASTER', w / 2, h / 2);
    const g = c.createLinearGradient(0, 10, 0, h - 10); g.addColorStop(0, '#d8a0ff'); g.addColorStop(1, '#7a2bd8');
    c.fillStyle = g; c.fillText('JOE MASTER', w / 2, h / 2);
    c.fillStyle = '#ff3ab0'; c.font = 'bold 18px Arial'; c.fillText('★ PODFATHER 4 LYF ★', w / 2, h - 10);
  });
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshLambertMaterial({ map: graf, transparent: true })), W - 0.03, F + 2.3, -0.5, -Math.PI / 2);
  neon(A, THREE, 'BAR', '#ff3ab0', 1.4, 0.6, W - 0.05, F + 3.6, 1.6, -Math.PI / 2);
  neon(A, THREE, 'OPEN 24/7', '#3ad8ff', 1.6, 0.4, W - 0.05, F + 3.0, 1.6, -Math.PI / 2);
  iconPoster(A, THREE, 1.0, 1.5, -W + 0.03, F + 1.9, 0.2, Math.PI / 2, 'WANTED', 'FOR BEING TOO CLEAN');
  iconPoster(A, THREE, 1.0, 1.5, -W + 0.03, F + 1.8, 1.5, Math.PI / 2, 'TONIGHT', 'JOE MASTER LIVE');

  // dumpster
  const dump = 0x2e5a34;
  A.box(0.85, 1.15, 1.7, dump, -W + 0.45, F + 0.6, -1.9);
  A.box(0.9, 0.08, 1.75, shade('#2e5a34', -0.3), -W + 0.42, F + 1.2, -1.9).rotation.z = 0.12;
  // trash cans + bags
  for (const z of [1.0, 1.6]) { A.cyl(0.26, 0.24, 0.8, 0x7a7e86, -W + 0.32, F + 0.4, z, 10); A.cyl(0.29, 0.29, 0.06, 0x8a8e96, -W + 0.32, F + 0.83, z, 10); }
  for (const [x, z] of [[-W + 0.4, 2.4], [-W + 0.75, 2.75], [W - 0.4, -2.9]]) A.ball(0.32, 0x15151a, x, F + 0.25, z, 1, 0.8, 1);
  // cardboard boxes
  A.box(0.6, 0.5, 0.6, 0x9a7a4a, W - 0.4, F + 0.25, -2.2).rotation.y = 0.3;
  A.box(0.5, 0.4, 0.5, 0xa88a5a, W - 0.45, F + 0.7, -2.15).rotation.y = -0.2;
  A.box(0.7, 0.45, 0.5, 0x8a6a3a, -2.6, F + 0.22, -3.1).rotation.y = 0.5;
  // pallets
  for (let i = 0; i < 3; i++) A.box(1.0, 0.12, 1.2, 0x8a6a42, W - 0.55, F + 0.06 + i * 0.13, 2.4);
  // burning barrel
  A.cyl(0.3, 0.3, 0.9, 0x5a3a2a, 2.95, F + 0.45, 3.1, 10);
  A.flame(2.95, F + 0.85, 3.1, 0.9);
  A.flame(2.85, F + 0.85, 3.2, 0.6);
  // street lamp
  A.cyl(0.06, 0.08, 4.6, 0x2a2c30, -2.6, F + 2.3, -3.7, 8);
  A.box(0.2, 0.06, 0.8, 0x2a2c30, -2.6, F + 4.55, -3.35);
  A.glow(0.4, 0.15, 0xffd28a, -2.6, F + 4.5, -3.05).rotation.x = -Math.PI / 2;
  // fire escape + AC unit + pipes
  for (let k = 0; k < 3; k++) A.box(0.9, 0.05, 1.6, 0x23262c, -W + 0.45, F + 3.6 + k * 1.4, -0.6);
  for (let k = 0; k < 6; k++) A.box(0.04, 0.9, 0.04, 0x23262c, -W + 0.85, F + 3.9 + k * 0.45, -0.6 + (k % 2 ? 0.75 : -0.75));
  A.box(0.5, 0.6, 0.9, 0x9aa0aa, W - 0.25, F + 4.4, -1.8);
  A.cyl(0.06, 0.06, 7, 0x5a5e66, W - 0.12, F + 3.5, 2.8, 6);
  // onlookers behind the fence
  const spots = [];
  for (let i = 0; i < 9; i++) spots.push({ x: -3 + i * 0.75, y: F, z: -4.1 - (i % 2) * 0.5, rot: 0 });
  A.people(spots, null, 0x6a6a78);
}

// ---------------------------------------------------------------- PODCAST STUDIO
function buildStudio(A, THREE) {
  A.scene.background = new THREE.Color(0x0a0710);
  A.scene.fog = new THREE.Fog(0x0a0710, 12, 34);
  A.light('ambient', 0x5a4a6a, 1.15);
  A.light('hemi', 0xffe8d0, 0.45, 0, 0, 0).groundColor.set(0x201018);
  A.light('dir', 0xfff0e0, 0.9, 2, 10, 7);
  const purple = A.light('point', 0x9b4dff, 22, -2.5, F + 3.0, -2.5, 9, 1.4);
  A.light('point', 0xff6ad5, 12, 2.8, F + 2.6, 1.0, 7, 1.5);
  A.light('point', 0xfff2dd, 18, 0, F + 4.5, 0.5, 10, 1.4);
  A.every((dt, t, ar) => { purple.intensity = 18 + 6 * Math.sin(t * 1.3) + ar.excite * 6; });

  A.floorArea(A.mat((c, w, h) => planks(c, w, h, '#3a2618'), { w: 128, h: 128, texOpts: { repeat: [10, 10] } }), 40);
  // rug with the icon
  const rug = A.iconTex(256, 256, (c, w, h, icon) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#2a1050'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    c.strokeStyle = '#9b4dff'; c.lineWidth = 10; c.stroke();
    c.strokeStyle = '#c9a6ff'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 16, 0, 7); c.stroke();
    if (icon) { c.save(); c.beginPath(); c.arc(w / 2, h / 2, w * 0.3, 0, 7); c.clip(); c.drawImage(icon, w * 0.2, h * 0.2, w * 0.6, h * 0.6); c.restore(); }
  });
  A.plane(5.0, 5.0, new THREE.MeshLambertMaterial({ map: rug, transparent: true }), 0, F + 0.006, 0, 0, -Math.PI / 2);

  // acoustic foam walls
  const foam = (base) => (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
      const flip = ((x + y) / 16) % 2;
      const g = flip ? c.createLinearGradient(x, y, x + 16, y) : c.createLinearGradient(x, y, x, y + 16);
      g.addColorStop(0, shade(base, 0.25)); g.addColorStop(1, shade(base, -0.4));
      c.fillStyle = g; c.fillRect(x + 1, y + 1, 14, 14);
    }
  };
  wall(A, THREE, foam('#2a2236'), W * 2, 4.2, 0, -W, 0, [6, 3], 64, 64);
  wall(A, THREE, foam('#33253f'), 12, 4.2, -W, 1.5, Math.PI / 2, [8, 3], 64, 64);
  wall(A, THREE, (c, w, h) => brick(c, w, h, '#4a3a44', '#1a1418'), 12, 4.2, W, 1.5, -Math.PI / 2, [4, 2]);
  // big screen with the icon, ON AIR sign, neon
  const screen = A.iconTex(256, 144, (c, w, h, icon) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1a0a34'); g.addColorStop(1, '#4a1a8a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (icon) c.drawImage(icon, 10, 10, h - 20, h - 20);
    c.fillStyle = '#fff'; c.font = 'italic 900 30px Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('THE JOE', h + (w - h) / 2, h * 0.36); c.fillText('MASTER POD', h + (w - h) / 2, h * 0.58);
    c.fillStyle = '#ff3a3a'; c.font = 'bold 14px Arial'; c.fillText('● LIVE', h + (w - h) / 2, h * 0.82);
  });
  A.box(3.2, 1.9, 0.12, 0x0a0a0e, 0, F + 2.8, -W + 0.08);
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.7), new THREE.MeshBasicMaterial({ map: screen, fog: false })), 0, F + 2.8, -W + 0.15);
  const onair = canvasTex(128, 48, signText('ON AIR', '#fff', '#c81414', '900'));
  A.box(1.1, 0.42, 0.12, new THREE.MeshBasicMaterial({ map: onair, fog: false }), 2.2, F + 3.6, -W + 0.1);
  const onairLight = A.light('point', 0xff2020, 4, 2.2, F + 3.6, -W + 0.6, 4, 2);
  A.every((dt, t) => { onairLight.intensity = 3 + 2 * (Math.sin(t * 4) > 0 ? 1 : 0); });
  neon(A, THREE, 'JOE MASTER UNIVERSE', '#c9a6ff', 3.6, 0.5, -W + 0.05, F + 3.6, 0.8, Math.PI / 2);
  neon(A, THREE, 'PODCAST', '#ff6ad5', 2.2, 0.6, W - 0.05, F + 3.4, 0.6, -Math.PI / 2);
  // LED strips
  for (const [x, z, ry, len] of [[0, -W + 0.06, 0, W * 2], [-W + 0.06, 1.5, Math.PI / 2, 12]]) {
    const strip = A.glow(len, 0.05, 0x9b4dff, x, F + 4.1, z, ry);
    A.every((dt, t) => strip.material.color.setHSL(0.75 + 0.05 * Math.sin(t), 1, 0.55));
  }
  // podcast desk with mics, headphones, laptop and mugs
  A.box(3.4, 0.08, 0.75, 0x1a1a20, 0, F + 0.78, -W + 0.55);
  A.box(3.3, 0.7, 0.06, 0x2a1050, 0, F + 0.4, -W + 0.9);
  const deskFront = A.iconTex(256, 48, (c, w, h, icon) => { c.fillStyle = '#2a1050'; c.fillRect(0, 0, w, h); if (icon) c.drawImage(icon, w / 2 - h / 2, 2, h - 4, h - 4); c.fillStyle = '#c9a6ff'; c.font = 'italic 900 22px Impact'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JOE', w * 0.3, h / 2); c.fillText('MASTER', w * 0.72, h / 2); });
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.6), new THREE.MeshLambertMaterial({ map: deskFront })), 0, F + 0.42, -W + 0.94);
  for (const x of [-1.1, 0, 1.1]) {
    A.cyl(0.02, 0.02, 0.5, 0x222226, x, F + 1.05, -W + 0.4, 6).rotation.x = 0.5;
    A.cyl(0.05, 0.05, 0.2, 0x111114, x, F + 1.28, -W + 0.58, 8).rotation.x = 1.2;
    A.ball(0.055, 0x3a3a40, x, F + 1.32, -W + 0.66);
    const hp = A.add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 10, Math.PI), A.mat(0x2a2a30)), x + 0.35, F + 0.83, -W + 0.6);
    hp.rotation.x = -Math.PI / 2;
    A.cyl(0.04, 0.035, 0.1, [0xe8e8e8, 0x9b4dff, 0xd84a2a][(x + 1.1) / 1.1 | 0], x - 0.3, F + 0.87, -W + 0.75, 8);
  }
  A.box(0.4, 0.02, 0.28, 0x8a8e96, 0.55, F + 0.83, -W + 0.6).rotation.y = 0.2;
  A.glow(0.36, 0.22, 0x8ab8ff, 0.55, F + 0.97, -W + 0.48).rotation.x = -0.25;
  // chairs behind the desk
  for (const x of [-1.1, 0, 1.1]) { A.box(0.5, 0.08, 0.5, 0x1a1a20, x, F + 0.5, -W + 0.15); A.box(0.5, 0.6, 0.06, 0x1a1a20, x, F + 0.85, -W + 0.0); }
  // couch + lamp on the right
  A.box(0.75, 0.45, 2.2, 0x5a2a6a, W - 0.4, F + 0.23, 1.6);
  A.box(0.22, 0.55, 2.2, 0x4a2058, W - 0.12, F + 0.55, 1.6);
  for (const z of [0.55, 2.65]) A.box(0.75, 0.6, 0.18, 0x4a2058, W - 0.4, F + 0.3, z);
  A.cyl(0.03, 0.03, 1.6, 0x2a2a2e, W - 0.35, F + 0.8, 3.0, 6);
  A.cyl(0.12, 0.22, 0.25, 0xf2e2c2, W - 0.35, F + 1.7, 3.0, 8);
  // ring light + camera on the left, bookshelf, posters
  const ringLight = A.add(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })), -W + 0.5, F + 1.8, 2.6, Math.PI / 2.6);
  A.cyl(0.025, 0.04, 1.4, 0x222226, -W + 0.5, F + 0.7, 2.6, 6);
  A.box(0.3, 0.2, 0.18, 0x111114, -W + 0.65, F + 1.25, 2.95).rotation.y = 0.7;
  A.cyl(0.06, 0.07, 0.14, 0x111114, -W + 0.55, F + 1.25, 2.85, 8).rotation.z = Math.PI / 2;
  A.box(0.4, 2.2, 1.4, 0x3a2618, -W + 0.2, F + 1.1, -1.8);
  for (let k = 0; k < 4; k++) {
    A.box(0.38, 0.04, 1.36, 0x2a1a10, -W + 0.22, F + 0.3 + k * 0.55, -1.8);
    for (let b = 0; b < 6; b++) A.box(0.26, 0.38, 0.12, [0x9b4dff, 0xd8402a, 0x2a8ad8, 0xe8c040, 0x2ab86a, 0xeeeeee][(b + k) % 6], -W + 0.25, F + 0.52 + k * 0.55, -2.35 + b * 0.2);
  }
  iconPoster(A, THREE, 0.9, 1.35, -W + 0.04, F + 2.6, 0.2, Math.PI / 2, 'EPISODE 1', 'THE ORIGINAL');
  iconPoster(A, THREE, 0.9, 1.35, W - 0.04, F + 2.0, -1.4, -Math.PI / 2, 'SPONSORED', 'BY NOBODY');
  // plants
  for (const [x, z] of [[-W + 0.45, -W + 0.45], [W - 0.45, -W + 0.45]]) {
    A.cyl(0.2, 0.16, 0.4, 0xf2f2f2, x, F + 0.2, z, 8);
    for (let k = 0; k < 5; k++) A.ball(0.18, 0x2a8a3a, x + Math.cos(k) * 0.12, F + 0.55 + k * 0.08, z + Math.sin(k) * 0.12, 0.6, 1.4, 0.6);
  }
  // a couple of producers
  A.people([{ x: -2.4, y: F, z: -W + 0.35, rot: 0 }, { x: 2.5, y: F, z: -W + 0.3, rot: 0 }], null, 0x8a8a98);
  A.ringLight = ringLight;
}

// ---------------------------------------------------------------- THE SHED
function buildShed(A, THREE) {
  A.scene.background = new THREE.Color(0x0b0c14);
  A.scene.fog = new THREE.Fog(0x0b0c14, 12, 34);
  A.light('ambient', 0x5a4a3a, 1.0);
  A.light('hemi', 0xffd8a8, 0.4, 0, 0, 0).groundColor.set(0x1a1208);
  A.light('dir', 0x8a9ac8, 0.55, 3, 9, 10);
  const bulb = A.light('point', 0xffc070, 36, 0, F + 3.0, 0, 12, 1.3);
  flickerLight(A, bulb, 36, 0.08, 9);
  A.light('point', 0xa8e8ff, 6, 2.7, F + 1.2, -2.6, 4, 2);   // fridge glow

  A.floorArea(A.mat((c, w, h) => {
    concrete(c, w, h, '#5a5650');
    const r = mulberry(41); c.globalAlpha = 0.5; c.fillStyle = '#16120c';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 10 + r() * 18, 8 + r() * 12, r() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }, { w: 128, h: 128, texOpts: { repeat: [8, 8] } }), 40);
  // corrugated iron walls and roof beams
  wall(A, THREE, corrugated, W * 2, 3.3, 0, -W, 0, [3, 1], 128, 64);
  for (const sx of [-1, 1]) wall(A, THREE, corrugated, 10, 3.3, sx * W, 1.5, -sx * Math.PI / 2, [4, 1], 128, 64);
  for (const z of [-2.5, -0.5, 1.2]) A.box(W * 2 + 0.3, 0.16, 0.12, 0x6a4a2a, 0, F + 3.3, z); // none near the camera
  A.box(0.16, 0.16, 5, 0x6a4a2a, 0, F + 3.45, -1.2);
  // the bulb
  A.cyl(0.005, 0.005, 0.5, 0x222222, 0, F + 3.2, 0, 4);
  A.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false })), 0, F + 2.95, 0);
  // workbench, vice, pegboard with tools
  A.box(2.6, 0.08, 0.7, 0x7a5a32, -0.6, F + 0.9, -W + 0.4);
  for (const x of [-1.8, 0.6]) for (const z of [-W + 0.1, -W + 0.7]) A.box(0.08, 0.9, 0.08, 0x5a3a20, x, F + 0.45, z);
  A.box(2.5, 0.06, 0.6, 0x5a3a20, -0.6, F + 0.25, -W + 0.4);
  A.box(0.2, 0.15, 0.25, 0x3a5a8a, 0.3, F + 1.02, -W + 0.4);
  const peg = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#b89868'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 6; y < h; y += 10) for (let x = 6; x < w; x += 10) c.fillRect(x, y, 2, 2);
    c.fillStyle = '#2a2a2e';
    c.fillRect(20, 20, 8, 60); c.fillRect(12, 16, 24, 10);            // hammer
    c.fillRect(56, 18, 6, 70); c.beginPath(); c.arc(59, 92, 8, 0, 7); c.fill();  // screwdriver
    c.fillStyle = '#c81e1e'; c.fillRect(90, 20, 40, 18); c.fillStyle = '#2a2a2e'; c.fillRect(104, 38, 10, 40);   // drill
    c.fillStyle = '#8a8e96'; for (let i = 0; i < 6; i++) c.fillRect(150 + i * 12, 20 + i * 4, 6, 50 - i * 4);   // spanners
    c.fillStyle = '#2a2a2e'; c.beginPath(); c.moveTo(232, 20); c.lineTo(244, 90); c.lineTo(220, 90); c.fill();   // saw
  });
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshLambertMaterial({ map: peg })), -0.6, F + 1.7, -W + 0.04);
  // beer fridge, esky, tyres, jerry cans, mower, couch, dartboard, shelves
  A.box(0.75, 1.5, 0.7, 0xeaeae4, 2.8, F + 0.75, -2.7);
  A.box(0.05, 1.4, 0.04, 0x9a9a9a, 2.42, F + 0.8, -2.45);
  const sticker = canvasTex(64, 32, signText('COLD BEER', '#1a3a9a', '#ffffff', '900'));
  A.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshLambertMaterial({ map: sticker })), 2.8, F + 1.2, -2.34);
  A.box(0.6, 0.38, 0.4, 0x2a5ab8, 2.85, F + 0.2, -1.5);
  A.box(0.62, 0.08, 0.42, 0xf2f2f2, 2.85, F + 0.42, -1.5);
  for (let i = 0; i < 3; i++) { const t = A.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 12), A.mat(0x161616)), W - 0.45, F + 0.11 + i * 0.22, 1.6); t.rotation.x = Math.PI / 2; }
  for (const z of [2.4, 2.7]) A.box(0.18, 0.42, 0.32, 0xc81e1e, W - 0.2, F + 0.21, z);
  // push mower
  A.box(0.55, 0.25, 0.7, 0x2a8a2a, -2.85, F + 0.25, 2.6);
  A.cyl(0.02, 0.02, 1.1, 0x333333, -2.85, F + 0.75, 3.15, 4).rotation.x = -0.6;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const wh = A.cyl(0.1, 0.1, 0.05, 0x111111, -2.85 + dx, F + 0.1, 2.6 + dz, 8); wh.rotation.z = Math.PI / 2; }
  // old couch
  A.box(0.8, 0.42, 1.9, 0x6a4a2a, -W + 0.45, F + 0.21, 0.3);
  A.box(0.22, 0.5, 1.9, 0x5a3a20, -W + 0.15, F + 0.5, 0.3);
  // dartboard
  const dart = canvasTex(64, 64, (c, w) => {
    const cols = ['#111', '#f2e8c8', '#c81e1e', '#1e8a3a', '#111', '#c81e1e'];
    for (let i = 0; i < 6; i++) { c.fillStyle = cols[i]; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - i * 5.5, 0, 7); c.fill(); }
  });
  A.add(new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshLambertMaterial({ map: dart })), -W + 0.03, F + 1.8, 1.9, Math.PI / 2);
  // shelf with paint tins
  A.box(0.35, 0.04, 1.6, 0x6a4a2a, W - 0.2, F + 1.5, -0.6);
  A.box(0.35, 0.04, 1.6, 0x6a4a2a, W - 0.2, F + 2.1, -0.6);
  for (let i = 0; i < 6; i++) A.cyl(0.09, 0.09, 0.2, [0x9b4dff, 0xe8e8e8, 0xc8a020, 0x2a6ad8, 0xc81e1e, 0x3a3a3a][i], W - 0.2, F + 1.62 + (i % 2) * 0.6, -1.2 + Math.floor(i / 2) * 0.55, 8);
  iconPoster(A, THREE, 0.8, 1.2, W - 0.04, F + 1.9, 1.0, -Math.PI / 2, 'JOE MASTER', 'SHED SHOWDOWN');
  iconPoster(A, THREE, 0.8, 1.2, -W + 0.04, F + 2.0, -1.7, Math.PI / 2, 'NO HELP', 'AT ALL');
  // mates watching from the open roller door
  const spots = [];
  for (let i = 0; i < 6; i++) spots.push({ x: (i < 3 ? -1 : 1) * (2.4 + (i % 3) * 0.45), y: F, z: 4.0 + (i % 2) * 0.4, rot: Math.PI });
  A.people(spots, null, 0x8a8478);
  A.box(W * 2 + 0.2, 0.3, 0.3, 0x8a8e96, 0, F + 3.6, 3.9);  // rolled-up door, kept above the camera line
}

// ---------------------------------------------------------------- HELL
function buildHell(A, THREE) {
  A.scene.background = new THREE.Color(0x1a0303);
  A.scene.fog = new THREE.Fog(0x2a0604, 12, 48);
  A.light('ambient', 0x6a2a20, 1.2);
  A.light('hemi', 0xff6a3a, 0.7, 0, 0, 0).groundColor.set(0xff3a00);
  A.light('dir', 0xffb080, 0.9, 0, 12, 6);
  const lavaLight = A.light('point', 0xff4a10, 30, 0, 0.6, 0, 22, 1.2);
  flickerLight(A, lavaLight, 30, 0.2, 2.5);
  A.light('point', 0xff2a10, 26, 0, RING_H + 7, 0, 14, 1.5);

  A.ring({
    ropes: [0xb01414, 0x1a1214, 0xb01414],
    pads: [0x1a0a0a, 0xb01414, 0x1a0a0a, 0xb01414],
    post: 0x3a2a2a, steps: false,
    mat: (c, w, h, ar) => {
      c.fillStyle = '#3a0c0a'; c.fillRect(0, 0, w, h); noise(c, w, h, 22);
      const r = mulberry(66);
      c.strokeStyle = '#ff6a10'; c.lineWidth = 3; c.shadowColor = '#ff3a00'; c.shadowBlur = 8;
      for (let i = 0; i < 10; i++) { let x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; c.lineTo(x, y); } c.stroke(); }
      c.shadowBlur = 0;
      c.save(); c.translate(w / 2, h / 2);
      c.fillStyle = '#0a0000'; c.beginPath(); c.arc(0, 0, w * 0.29, 0, 7); c.fill();
      c.strokeStyle = '#ff3a10'; c.lineWidth = 12; c.stroke();
      if (ar.icon) { c.save(); c.beginPath(); c.arc(0, 0, w * 0.27, 0, 7); c.clip(); c.filter = 'sepia(1) saturate(4) hue-rotate(-30deg)'; const s = w * 0.56; c.drawImage(ar.icon, -s / 2, -s / 2, s, s); c.restore(); }
      c.fillStyle = '#ff6a10'; c.font = `italic 900 ${w * 0.05}px Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('H E L L   M A T C H', 0, w * 0.34);
      c.restore();
    },
    skirt: (c, w, h) => {
      c.fillStyle = '#0a0202'; c.fillRect(0, 0, w, h);
      const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#ff6a10'); g.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = g;
      for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + 6, h * 0.3, x + 12, h * 0.1); c.quadraticCurveTo(x + 18, h * 0.4, x + 24, h); c.fill(); }
      c.font = `italic 900 ${h * 0.5}px Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText('ABANDON ALL HOPE', w / 2, h / 2 + 3);
      c.fillStyle = '#ffcc66'; c.fillText('ABANDON ALL HOPE', w / 2, h / 2 + 3);
    },
  });
  // rock island and lava sea
  const rock = (c, w, h) => { c.fillStyle = '#2a1a16'; c.fillRect(0, 0, w, h); noise(c, w, h, 40); const r = mulberry(7); c.fillStyle = 'rgba(255,90,20,0.25)'; for (let i = 0; i < 8; i++) c.fillRect(r() * w, r() * h, 1 + r() * 3, 6 + r() * 20); };
  A.add(new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.5, 0.6, 18), A.mat(rock, { w: 64, h: 64, texOpts: { repeat: [6, 1] } })), 0, -0.3, 0);
  const lavaTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#ff4a00'; c.fillRect(0, 0, w, h);
    const r = mulberry(3);
    for (let i = 0; i < 60; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,220,60,0.7)' : 'rgba(120,10,0,0.6)'; c.beginPath(); c.ellipse(r() * w, r() * h, 4 + r() * 16, 3 + r() * 10, r() * 3, 0, 7); c.fill(); }
  }, { repeat: [10, 10] });
  const lava = A.add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: lavaTex, fog: true })), 0, -0.2, 0);
  lava.rotation.x = -Math.PI / 2;
  A.every((dt, t) => { lavaTex.offset.set(t * 0.01, Math.sin(t * 0.2) * 0.05); lava.material.color.setHSL(0.06, 1, 0.45 + 0.05 * Math.sin(t * 2)); });
  // braziers in the corners
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    A.cyl(0.35, 0.2, 1.2, 0x2a1a1a, x, 0.6, z, 8);
    A.cyl(0.55, 0.4, 0.3, 0x3a2a2a, x, 1.3, z, 10);
    A.flame(x, 1.35, z, 1.8); A.flame(x + 0.15, 1.35, z - 0.1, 1.2);
    flickerLight(A, A.light('point', 0xff7a20, 10, x, 2.4, z, 8, 1.5), 10, 0.3, 14);
  }
  // rock spires and lava falls
  const rnd = mulberry(77);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = 12 + rnd() * 14, hgt = 4 + rnd() * 12;
    if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0) continue; // keep the camera side clear
    A.add(new THREE.Mesh(new THREE.ConeGeometry(1 + rnd() * 2, hgt, 6), A.mat(0x1e100c)), Math.sin(a) * d, hgt / 2 - 0.5, Math.cos(a) * d, rnd() * 3);
  }
  for (const x of [-14, -6, 9, 16]) {
    const fall = A.glow(1.6 + rnd() * 2, 22, 0xff5a10, x, 10, -26 - rnd() * 4);
    A.every((dt, t) => fall.material.color.setHSL(0.05 + 0.02 * Math.sin(t * 3 + x), 1, 0.5));
  }
  // giant skull at the back with glowing eyes
  A.ball(4.2, 0xd8c8a8, 0, 9, -24, 1, 0.95, 0.9);
  A.box(4.6, 2.2, 3.0, 0xc8b898, 0, 5.4, -22.8);
  for (const sx of [-1, 1]) {
    A.ball(1.0, 0x0a0000, sx * 1.5, 9.2, -20.4, 1, 1.1, 0.4);
    const eye = A.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2000, fog: false })), sx * 1.5, 9.2, -20.0);
    A.every((dt, t, ar) => eye.material.color.setHSL(0.02, 1, 0.4 + 0.15 * Math.sin(t * 3) + 0.1 * ar.excite));
  }
  A.ball(0.5, 0x0a0000, 0, 7.6, -20.2, 0.7, 1, 0.4);
  for (let i = -3; i <= 3; i++) A.box(0.42, 0.7, 0.2, 0xf2ead8, i * 0.6, 5.6, -21.25);
  // hanging chains
  const link = A.mat(0x3a3232);
  for (const [x, z] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8], [0, -6]]) {
    for (let k = 0; k < 14; k++) {
      const l = A.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 4, 8), link), x, 18 - k * 0.2, z);
      l.rotation.y = k % 2 ? Math.PI / 2 : 0;
    }
  }
  // demon crowd on rock tiers
  const spots = [];
  for (let side = 0; side < 4; side++) {
    if (side === 2) continue; // the skull's side
    for (let row = 0; row < 5; row++) {
      const dist = 9.5 + row * 1.3, h = row * 0.7;
      const a = side * Math.PI / 2;
      A.add(new THREE.Mesh(new THREE.BoxGeometry(dist * 2, 0.7, 1.3), A.mat(0x24120e)), Math.sin(a) * dist, h + 0.35 - 0.2, Math.cos(a) * dist, a);
      for (let x = -dist + 0.5; x < dist - 0.5; x += 0.75 + rnd() * 0.2) {
        if (rnd() < 0.15) continue;
        const lz = dist - 0.1;
        spots.push({ x: Math.cos(a) * x + Math.sin(a) * lz, y: h + 0.5, z: -Math.sin(a) * x + Math.cos(a) * lz, rot: a + Math.PI });
      }
    }
  }
  A.people(spots, v => ({
    shirt: ['#1a0a0a', '#2a0a0a', '#3a0606', '#120606'][v % 4],
    skin: ['#c81e1e', '#a81414', '#8a0a0a', '#d83a1a'][v % 4],
    hair: '#1a0000', horns: '#f2e8d0', eyes: '#ffe000',
  }), 0xc8a8a8);
  // embers drifting up
  const emberTex = canvasTex(16, 16, (c) => { const g = c.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,220,120,1)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 16, 16); });
  const embers = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.setScalar(0.12 + rnd() * 0.15);
    s.position.set((rnd() - 0.5) * 24, rnd() * 14, (rnd() - 0.5) * 24);
    A.group.add(s); embers.push({ s, v: 0.6 + rnd() * 1.2, ph: rnd() * 6 });
  }
  A.every((dt, t) => {
    for (const e of embers) {
      e.s.position.y += e.v * dt; e.s.position.x += Math.sin(t + e.ph) * dt * 0.3;
      if (e.s.position.y > 15) e.s.position.y = 0;
    }
  });
}

export const MAPS = [
  { id: 'arena', name: 'THE ARENA', blurb: 'Sold-out crowd, titantron, the works', crowd: 1 },
  { id: 'street', name: 'BACK STREET', blurb: 'Bins, bricks and a burning barrel', crowd: 0.35, build: buildStreet },
  { id: 'studio', name: 'PODCAST STUDIO', blurb: 'Live on air. Mind the mics', crowd: 0.15, build: buildStudio },
  { id: 'shed', name: 'THE SHED', blurb: 'Beer fridge, tools and the boys', crowd: 0.45, build: buildShed },
  { id: 'hell', name: 'HELL', blurb: 'Lava, chains and a demon crowd', crowd: 1, build: buildHell },
];
export const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));

// The game screen: networking, lobby, match flow, camera, HUD and the main loop.
import * as THREE from 'three';
import { RetroRenderer } from './ps2.js';
import { Arena } from './arena.js';
import { Rig } from './rig.js';
import { Match, Wrestler, BTN } from './game.js';
import { CpuBrain } from './ai.js';
import { Sound, Music } from './audio.js';
import { Fx, makeMarker } from './fx.js';
import { RING_H } from './tex.js';
import { poseFor } from './poses.js';
import { HostNet } from './net.js';
import { qrDataUrl } from './qr.js';
import { JOE, COSTUMES, COSTUME_BY_ID, RANDOM_POOL, SKIN, BIO, masterName } from './characters.js';

const TITLE = 'JOE MASTER UNIVERSE';
const SLOT_COLORS = ['#ff3b3b', '#3b8bff', '#33d17a', '#ffd23b'];
const $ = id => document.getElementById(id);

// ---------- input buffering (so quick taps between frames aren't lost) ----------
class Input {
  constructor() { this.x = 0; this.y = 0; this.held = 0; this.pressed = 0; this.mash = 0; }
  set(x, y, held) {
    this.x = +x || 0; this.y = +y || 0;
    const newly = held & ~this.held;
    this.pressed |= newly;
    for (let b = newly; b; b &= b - 1) this.mash++;
    this.held = held;
  }
  consume() {
    const f = { x: this.x, y: this.y, held: this.held, pressed: this.pressed, mash: this.mash };
    this.pressed = 0; this.mash = 0;
    return f;
  }
  clear() { this.x = this.y = 0; this.held = this.pressed = this.mash = 0; }
}

// ---------- renderer / scene ----------
const retro = new RetroRenderer($('c'));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
retro.onResize = aspect => { camera.aspect = aspect; camera.updateProjectionMatrix(); };
retro.resize();
const arena = new Arena(scene, TITLE);
const fx = new Fx(scene);
const sound = new Sound();
const music = new Music();

// ---------- players ----------
const players = [null, null, null, null];
let phase = 'lobby';           // lobby | intro | match | results
let match = null;
let lobbyRigs = new Map();     // slot -> { rig, marker, fake }
let seedCounter = 1;

function newPlayer(slot, kind, profile = {}) {
  const p = {
    slot, kind, padId: null, connected: true, wins: 0,
    rawName: kind === 'kb' ? 'KEYBOARD' : (profile.name || ''),
    name: '', char: null, wantJoe: profile.char === 'joe',
    costume: null, wantCostume: profile.costume || null,
    faceImg: null, faceSrc: '', overrideFace: null,
    seed: seedCounter++,
    input: new Input(),
  };
  if (profile.face) loadFace(p, profile.face);
  players[slot] = p;
  return p;
}

// ---------- the roster: JOE MASTER and his multiverse ----------
// The Original JOE MASTER is always on the card: a CPU Joe fills a slot until someone picks him on their phone.
// Everyone else is "<their name> MASTER" from a random universe, wearing a random costume.
let joeCpuWanted = true;
function addJoeCpu() {
  if (players.some(p => p && p.char === 'joe')) return;
  const s = freeSlot(); if (s < 0) return;
  const p = newPlayer(s, 'cpu');
  p.char = 'joe';
  joeCpuWanted = true;
}
function costumeOf(p) { return COSTUME_BY_ID[p.costume] || COSTUME_BY_ID.original; }
function resolveRoster() {
  const between = phase !== 'match' && phase !== 'intro';
  if (between) {
    const humans = players.filter(p => p && p.kind !== 'cpu' && p.wantJoe);
    const keep = humans.find(p => p.char === 'joe') || humans[0] || null;
    for (const p of players) {
      if (!p || p.kind === 'cpu') continue;
      const want = p === keep ? 'joe' : null;
      if (p.char !== want) {
        p.char = want;
        if (p.wantJoe && want !== 'joe') p.note = 'THE ORIGINAL IS TAKEN — WELCOME, ' + masterName(p.rawName);
      }
    }
    const cpuJoe = players.find(p => p && p.kind === 'cpu' && p.char === 'joe');
    if (keep && cpuJoe) players[cpuJoe.slot] = null;
    if (!keep && !cpuJoe && joeCpuWanted) addJoeCpu();
  }
  // costumes: one of each per match, and the Original's outfit is his alone
  const used = new Set();
  for (const p of players) if (p && p.char === 'joe') { p.costume = 'original'; used.add('original'); }
  for (const p of players) {
    if (!p || p.char === 'joe') continue;
    let c = p.costume;
    if (between && p.wantCostume && RANDOM_POOL.includes(p.wantCostume) && !used.has(p.wantCostume)) c = p.wantCostume;
    if (!c || c === 'original' || used.has(c)) {
      const free = RANDOM_POOL.filter(id => !used.has(id));
      c = free[Math.floor(Math.random() * free.length)] || RANDOM_POOL[0];
    }
    if (p.costume !== c) { p.costume = c; clearLobbyRig(p.slot); }
    used.add(c);
  }
  // names: "<NAME> MASTER", CPUs use their costume's name, duplicates get a JR.
  const taken = new Set();
  for (const p of players) {
    if (!p) continue;
    let n = p.char === 'joe' ? JOE.name : p.kind === 'cpu' ? costumeOf(p).cpuName : masterName(p.rawName);
    if (p.char !== 'joe' && n === JOE.name) n = 'JOE MASTER JR.';
    while (taken.has(n)) n += n.endsWith('JR.') ? ' JR.' : ' JR.';
    taken.add(n);
    p.name = n;
  }
  for (const p of players) {
    if (!p || p.kind !== 'pad') continue;
    const c = costumeOf(p);
    sendTo(p.padId, { t: 'assign', slot: p.slot, color: SLOT_COLORS[p.slot], name: p.name, char: p.char, costume: p.costume, costumeTitle: c.title, universe: c.universe });
    if (p.note) { sendTo(p.padId, { t: 'note', msg: p.note }); p.note = null; }
  }
}
function joeIn(list) { return list.find(w => w.player.char === 'joe') || null; }
function loadFace(p, src) {
  if (!src || typeof src !== 'string' || !src.startsWith('data:image/')) return;
  p.faceSrc = src;
  const img = new Image();
  img.onload = () => { if (p.faceSrc === src) { p.faceImg = img; refreshPlayer(p); } };
  img.src = src;
}
function applyProfile(p, prof) {
  if (!prof) return;
  p.wantJoe = prof.char === 'joe';
  if (typeof prof.name === 'string') p.rawName = prof.name.slice(0, 24);
  if (prof.costume) p.wantCostume = prof.costume;
  if (prof.face && prof.face !== p.faceSrc) { p.overrideFace = null; loadFace(p, prof.face); }
  else if (!prof.face && p.faceSrc) { p.faceSrc = ''; p.faceImg = null; }
  refreshPlayer(p);
}
function freeSlot() { return players.findIndex(p => !p); }
function removePlayer(slot) {
  const p = players[slot]; if (!p) return;
  players[slot] = null;
  if (p.kind === 'cpu' && p.char === 'joe') joeCpuWanted = false;
  if (p.kind === 'pad') sendTo(p.padId, { t: 'full' });
  refreshLobby();
}

// ---------- networking ----------
const net = new HostNet({
  onPad: (id, ev, data) => onPad(id, ev, data),
  onStatus: (text) => { $('net').textContent = text; },
  onReady: () => showJoinInfo(),
});
function sendTo(pad, msg) { net.sendTo(pad, msg); }
function showJoinInfo() {
  const url = net.joinUrl;
  if (!url) return;
  $('joinUrl').textContent = url.replace(/^https?:\/\//, '');
  $('qr').src = qrDataUrl(url, { margin: 2 });
  $('room').textContent = net.room || '';
  $('roomBox').style.display = net.room ? '' : 'none';
  if (phase === 'lobby') arena.setTron(TITLE, net.room ? 'ROOM ' + net.room + ' · SCAN TO JOIN' : 'SCAN THE QR TO JOIN');
}
function padPlayer(id) { return players.find(p => p && p.kind === 'pad' && p.padId === id); }

function onPad(id, ev, data) {
  let p = padPlayer(id);
  if (ev === 'hello') {
    if (p) { p.connected = true; applyProfile(p, data.profile); }
    else {
      const between = phase !== 'match' && phase !== 'intro';
      const cpuJoe = players.findIndex(q => q && q.kind === 'cpu' && q.char === 'joe');
      const humanJoe = players.some(q => q && q.kind !== 'cpu' && q.char === 'joe');
      if (between && data.profile && data.profile.char === 'joe' && cpuJoe >= 0 && !humanJoe) players[cpuJoe] = null;
      const s = freeSlot();
      if (s < 0) {
        // replace a CPU if the ring is full of bots (only between matches), but keep JOE MASTER if possible
        let cpu = between ? players.findIndex(q => q && q.kind === 'cpu' && q.char !== 'joe') : -1;
        if (cpu < 0 && between) cpu = players.findIndex(q => q && q.kind === 'cpu');
        if (cpu < 0) { sendTo(id, { t: 'full' }); return; }
        players[cpu] = null;
        p = newPlayer(cpu, 'pad', data.profile);
      } else p = newPlayer(s, 'pad', data.profile);
      p.padId = id;
      if (phase === 'lobby') sound.pop(0.6);
    }
    refreshLobby();
    return;
  }
  if (!p) return;
  if (ev === 'i') p.input.set(data.x, data.y, data.b | 0);
  else if (ev === 'profile') applyProfile(p, data.profile);
  else if (ev === 'start') requestStart();
  else if (ev === 'bye') {
    p.connected = false; p.input.clear();
    if (phase === 'lobby' || phase === 'results') { players[p.slot] = null; clearLobbyRig(p.slot); refreshLobby(); }
  }
}

function canStart() { return players.filter(Boolean).length >= 2; }
function phaseMsg(p) {
  if (phase === 'lobby') return canStart() ? 'PRESS START WHEN EVERYONE’S IN' : 'WAITING FOR AN OPPONENT…';
  if (phase === 'results') return 'PRESS START FOR A REMATCH';
  if ((phase === 'match' || phase === 'intro') && !p.wrestler) return 'YOU’RE IN NEXT MATCH';
  return '';
}
function sendPhase(p) {
  if (!p || p.kind !== 'pad') return;
  sendTo(p.padId, { t: 'phase', phase, canStart: (phase === 'lobby' || phase === 'results') && canStart(), msg: phaseMsg(p) });
}
function broadcastPhase() { players.forEach(p => p && sendPhase(p)); }

// ---------- lobby ----------
function makeRig(p) {
  const c = costumeOf(p);
  return new Rig({ skin: SKIN, color: JOE.color, build: c.build || 'average', faceImg: p.overrideFace || p.faceImg || null, seed: p.seed, look: c.look });
}
function clearLobbyRig(slot) {
  const old = lobbyRigs.get(slot);
  if (old) { old.rig.removeFrom(scene); scene.remove(old.marker); lobbyRigs.delete(slot); }
}
function refreshPlayer(p) {
  if (phase === 'lobby' || phase === 'results') { const old = lobbyRigs.get(p.slot); if (old) { old.rig.removeFrom(scene); scene.remove(old.marker); lobbyRigs.delete(p.slot); } }
  else if (p.wrestler) p.wrestler.rig.setFace(p.overrideFace || p.faceImg || null);
  refreshLobby();
}
function refreshLobby() {
  resolveRoster();
  // cards
  const list = $('slots');
  list.innerHTML = '';
  players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'slot' + (p ? '' : ' empty') + (p && p.char === 'joe' ? ' star' : '');
    card.style.setProperty('--sc', SLOT_COLORS[i]);
    if (!p) {
      card.innerHTML = `<div class="pn">P${i + 1}</div><div class="who">OPEN</div><div class="kind">scan to join</div>`;
    } else {
      const face = faceThumb(p);
      card.innerHTML = `<div class="pn">P${i + 1}</div><img class="face" alt=""><div class="who"></div>
        <div class="kind">${p.kind === 'pad' ? (p.connected ? '📱' : '📱 (gone)') : p.kind === 'cpu' ? '🤖 CPU' : '⌨️'} · ${p.char === 'joe' ? '⭐ THE ORIGINAL' : costumeOf(p).universe + ' · ' + costumeOf(p).title}${p.wins ? ' · ' + p.wins + ' W' : ''}</div>
        <button class="x" title="Remove">✕</button>`;
      card.querySelector('.face').src = face;
      card.querySelector('.who').textContent = p.name;
      card.querySelector('.x').onclick = () => removePlayer(i);
      card.querySelector('.face').onclick = () => pickFaceFor(p);
      card.title = 'Drop a photo here to use it as this wrestler\'s face';
      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drop'); });
      card.addEventListener('dragleave', () => card.classList.remove('drop'));
      card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) setOverrideFace(p, f); });
    }
    list.appendChild(card);
  });
  $('startBtn').disabled = !canStart();
  $('startBtn').textContent = canStart() ? 'START MATCH ▸' : 'NEED 2+ WRESTLERS';
  $('addCpu').disabled = freeSlot() < 0;
  $('addKb').disabled = freeSlot() < 0 || players.some(p => p && p.kind === 'kb');
  $('addJoe').disabled = freeSlot() < 0 || players.some(p => p && p.char === 'joe');
  broadcastPhase();
}
const thumbCache = new WeakMap();
function faceThumb(p) {
  const photo = p.overrideFace || p.faceImg;
  if (!photo) return `img/costumes/${p.costume || 'original'}_bust.png`;
  const key = (p.costume || '') + (photo.src || '').slice(-64);
  const c = thumbCache.get(p);
  if (c && c.key === key) return c.url;
  const r = makeRig(p);
  const url = r.faceDataURL();
  r.mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  thumbCache.set(p, { key, url });
  return url;
}
function pickFaceFor(p) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => inp.files[0] && setOverrideFace(p, inp.files[0]);
  inp.click();
}
function setOverrideFace(p, file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // centre-crop to the head's proportions
    const ar = 112 / 128, c = document.createElement('canvas'); c.width = 224; c.height = 256;
    let sw = img.width, sh = img.width / ar;
    if (sh > img.height) { sh = img.height; sw = sh * ar; }
    const sy = Math.max(0, (img.height - sh) * 0.3); // bias toward the top, where faces usually are
    c.getContext('2d').drawImage(img, (img.width - sw) / 2, sy, sw, sh, 0, 0, 224, 256);
    const out = new Image();
    out.onload = () => { p.overrideFace = out; refreshPlayer(p); };
    out.src = c.toDataURL('image/jpeg', 0.9);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function syncLobbyRigs(dt, t) {
  const present = players.map((p, i) => p ? i : -1).filter(i => i >= 0);
  // remove stale
  for (const [slot, o] of lobbyRigs) if (!players[slot] || o.p !== players[slot]) clearLobbyRig(slot);
  present.forEach((slot, k) => {
    const p = players[slot];
    let o = lobbyRigs.get(slot);
    if (!o) {
      const rig = makeRig(p);
      rig.addTo(scene);
      const marker = makeMarker('P' + (slot + 1), SLOT_COLORS[slot]);
      scene.add(marker);
      o = { p, rig, marker, fake: { state: 'lobby', st: 0, rig, seed: slot * 1.7, walkAmt: 0, walkPhase: 0, move: null, mashFx: 0 } };
      lobbyRigs.set(slot, o);
    }
    const n = present.length;
    const x = (k - (n - 1) / 2) * 1.1;
    o.rig.root.position.set(x, RING_H, 0.6);
    o.rig.root.rotation.y = -x * 0.06;
    const { P, speed } = poseFor(o.fake, t);
    o.rig.apply(P, dt, speed);
    o.marker.position.set(x, RING_H + 2.55 + Math.sin(t * 3 + slot) * 0.05, 0.6);
  });
}
function clearLobbyRigs() {
  for (const o of lobbyRigs.values()) { o.rig.removeFrom(scene); scene.remove(o.marker); }
  lobbyRigs.clear();
}

// ---------- match flow ----------
let introT = 0, resultsT = 0, markers = [];
const brains = new Map();

function requestStart() {
  sound.start(); music.start();
  if (phase === 'lobby' || (phase === 'results' && resultsT > 1.5)) {
    if (canStart()) startMatch();
  }
}

function startMatch() {
  clearLobbyRigs();
  if (match) { match.dispose(); match = null; }
  markers.forEach(m => scene.remove(m)); markers = [];
  brains.clear();
  match = new Match(scene, arena);
  const roster = players.filter(Boolean);
  const corners = [[-1.9, 1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, -1.9]];
  const order = roster.length === 2 ? [0, 1] : roster.length === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  roster.forEach((p, i) => {
    const rig = makeRig(p);
    const w = new Wrestler(match, p, rig);
    const [x, z] = corners[order[i]];
    w.pos.set(x, z);
    w.yaw = Math.atan2(-x, -z);
    p.wrestler = w;
    p.input.clear();
    match.add(w);
    if (p.kind === 'cpu') brains.set(w, new CpuBrain(w, 1));
    const mk = makeMarker('P' + (p.slot + 1), SLOT_COLORS[p.slot]);
    mk.userData.w = w;
    scene.add(mk); markers.push(mk);
  });
  players.forEach(p => { if (p && !roster.includes(p)) p.wrestler = null; });
  phase = 'intro'; introT = 0;
  showOverlay('none');
  music.refresh().then(() => { if (phase === 'intro') music.intro(); });
  buildHud(roster);
  const names = roster.map(p => p.name);
  joeEntrance = joeIn(match.wrestlers);
  introLen = joeEntrance ? JOE_ENTRANCE + 3.1 : 3.1;
  if (joeEntrance) {
    joeEntrance.setState('entrance');
    arena.setTron(JOE.name, BIO.nickname, joeEntrance.rig.faceCanvas);
    banner(`JOE MASTER<small>${BIO.nickname}</small>`, 2600, 'big joe');
    $('tape').classList.add('on');
    sound.say(`Standing six feet tall, weighing in at eighty-four kilograms... the world's most famous podcast host... the Podfather... Joe... Master!`, { rate: 1.05, pitch: 0.6, interrupt: true });
    arena.pop(1.2); sound.pop(1.2);
    pyroT = [0.2, 0.9, 1.6, 2.3, 3.0, 3.6];
    return broadcastPhase();
  }
  announceCard(false);
  broadcastPhase();
}
function announceCard(after) {
  const names = match.wrestlers.map(w => w.name), n = names.length;
  arena.setTron(n === 2 ? `${names[0]} vs ${names[1]}` : `${n}-WAY BRAWL`, n > 2 ? names.join(' · ') : 'LAST ONE STANDING');
  banner(n === 2 ? `${esc(names[0])}<small>VS</small>${esc(names[1])}` : `${n}-WAY<small>FREE-FOR-ALL</small>`, 2400, 'big');
  sound.say(n === 2 ? `${names[0]}, versus, ${names[1]}!` : `This is a ${n} way free for all! Pin everyone else to win!`, { rate: 1.05, interrupt: !after });
  arena.pop(0.6);
}
const JOE_ENTRANCE = 4.2;
let joeEntrance = null, introLen = 3.1, pyroT = [];
function updateEntrance() {
  if (!joeEntrance) return;
  while (pyroT.length && introT >= pyroT[0]) {
    pyroT.shift();
    const w = joeEntrance;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + Math.random();
      fx.spark(new THREE.Vector3(w.pos.x + Math.cos(a) * 0.9, RING_H + 0.3 + Math.random() * 2.2, w.pos.y + Math.sin(a) * 0.9), 1.4, i % 2 ? 0xb06cff : 0xffffff);
    }
    sound.slam(0.6); arena.pop(0.5); shake = Math.max(shake, 0.04);
  }
  if (introT >= JOE_ENTRANCE && joeEntrance.state === 'entrance') {
    joeEntrance.setState('idle');
    $('tape').classList.remove('on');
    announceCard(true);
  }
}

function endToResults() {
  phase = 'results'; resultsT = 0;
  const w = match.winner;
  if (w) w.player.wins++;
  const r = $('results');
  const place = [...(w ? [w] : []), ...[...match.elimOrder].reverse()];
  r.querySelector('.winner').innerHTML = w ? `<img alt=""><div><small>WINNER</small><b></b></div>` : '<div><b>NO CONTEST</b></div>';
  if (w) { r.querySelector('.winner img').src = faceThumb(w.player); r.querySelector('.winner b').textContent = w.name; }
  r.querySelector('.table').innerHTML = place.map((x, i) => `<div class="row"><span>${i + 1}</span><img src="${faceThumb(x.player)}" alt=""><b></b><em>${x.player.wins} W</em></div>`).join('');
  r.querySelectorAll('.table b').forEach((b, i) => { b.textContent = place[i].name; });
  showOverlay('results');
  arena.setTron(w ? w.name : 'NO CONTEST', w ? 'WINS!' : '', w ? w.rig.faceCanvas : null);
  broadcastPhase();
}

function backToLobby() {
  if (match) { match.dispose(); match = null; }
  markers.forEach(m => scene.remove(m)); markers = [];
  players.forEach(p => { if (p) p.wrestler = null; });
  phase = 'lobby';
  joeEntrance = null;
  showJoinInfo();
  $('tape').classList.remove('on');
  music.endIntro(0); music.refresh().then(() => updateMusicUi(music.on));
  showOverlay('lobby');
  $('hud').innerHTML = '';
  refreshLobby();
}

// ---------- HUD ----------
let hudEls = [];
function buildHud(roster) {
  const hud = $('hud');
  hud.innerHTML = '';
  hudEls = roster.map(p => {
    const d = document.createElement('div');
    d.className = 'pc' + (p.char === 'joe' ? ' star' : '');
    d.style.setProperty('--sc', SLOT_COLORS[p.slot]);
    d.innerHTML = `<img alt=""><div class="info"><div class="nm"><span>P${p.slot + 1}</span> <b></b></div><div class="hp"><i></i></div><div class="sp"><i></i></div></div>`;
    d.querySelector('img').src = faceThumb(p);
    d.querySelector('b').textContent = p.name;
    hud.appendChild(d);
    return { d, p, hp: d.querySelector('.hp i'), sp: d.querySelector('.sp i'), spBar: d.querySelector('.sp'), last: '' };
  });
}
function updateHud() {
  for (const h of hudEls) {
    const w = h.p.wrestler; if (!w) continue;
    const key = `${w.hp | 0},${w.sp | 0},${w.eliminated},${h.p.connected}`;
    if (key === h.last) continue;
    h.last = key;
    h.hp.style.width = w.hp + '%';
    h.hp.style.background = w.hp > 50 ? '' : w.hp > 25 ? 'linear-gradient(#ffe37a,#e6a100)' : 'linear-gradient(#ff8a7a,#d1201a)';
    h.sp.style.width = w.sp + '%';
    h.spBar.classList.toggle('full', w.sp >= 100);
    h.d.classList.toggle('out', w.eliminated);
    h.d.classList.toggle('dc', h.p.kind === 'pad' && !h.p.connected);
  }
}
let bannerTimer = 0;
function banner(html, ms = 1200, cls = '') {
  const b = $('banner');
  b.className = ''; void b.offsetWidth;
  b.innerHTML = html; b.className = 'show ' + cls;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.className = ''; }, ms);
}
function buildTicker() {
  const items = [`HEIGHT ${BIO.height}`, `WEIGHT ${BIO.weight}`, `NICKNAME: ${BIO.nickname}`, `SIGNATURE MOVE: ${BIO.signature}`, `DEBUT: ${BIO.debut}`, ...BIO.highlights];
  const html = items.map(t => `<span>${esc(t)}</span>`).join('<i>★</i>');
  $('ticker').innerHTML = `<div class="track">${html}<i>★</i>${html}<i>★</i></div>`;
}
function showOverlay(which) {
  $('lobby').classList.toggle('on', which === 'lobby');
  $('results').classList.toggle('on', which === 'results');
  $('hud').classList.toggle('on', which === 'none');
}

// phone status lines
function padStatus(p) {
  const w = p.wrestler;
  if (!w) return phaseMsg(p);
  if (phase === 'intro') return 'GET READY…';
  if (phase === 'results') return phaseMsg(p);
  if (w.eliminated) return match && match.over ? '' : 'ELIMINATED — HECKLE FROM RINGSIDE';
  switch (w.state) {
    case 'grappled': return 'MASH TO ESCAPE!';
    case 'pinned': return 'MASH TO KICK OUT!!';
    case 'down': return 'MASH TO GET UP';
    case 'grapple': return w.sp >= 100 ? 'GRAB = SMALL PACKAGE · PULL BACK + GRAB = MIC DROP' : 'GRAB: SLAM · PULL BACK + GRAB: SUPLEX · STRIKE: KNEE';
    case 'victory': return 'YOU WIN!';
  }
  if (w.sp >= 100) return 'SMALL PACKAGE READY — GRAB SOMEONE!';
  return '';
}
let padT = 0;
function pushPadState(dt) {
  padT -= dt; if (padT > 0) return; padT = 0.15;
  for (const p of players) {
    if (!p || p.kind !== 'pad') continue;
    const w = p.wrestler;
    sendTo(p.padId, { t: 'st', hp: w ? Math.round(w.hp) : 100, sp: w ? Math.round(w.sp) : 0, msg: padStatus(p) });
  }
}
function vibe(w, ms) { if (w && w.player.kind === 'pad') sendTo(w.player.padId, { t: 'vibe', ms }); }

// ---------- events from the match ----------
let shake = 0, hitstop = 0, slowmo = 0, tronTimer = 0, lastChant = -99, factT = 9, factI = -1;
// Things JOE MASTER knows to be true about himself. The titantron reminds everyone during matches.
const FACTS = [
  ['THE PODFATHER', `HEIGHT ${BIO.height} · WEIGHT ${BIO.weight}`],
  ['FUN FACT', "WORLD'S MOST FAMOUS PODCAST HOST"],
  ['HISTORY', 'PINNED EINAR THE STRANGE'],
  ['TOTALLY CLEAN', 'AND WITH NO HELP AT ALL'],
  ['UNDEFEATED', '…AGAINST LAYLA PAIGE'],
  ['DID YOU KNOW?', "PARTY GUY TY'S STUNT DOUBLE"],
  ['SIGNATURE MOVE', 'THE SMALL PACKAGE'],
  ['DEBUT', BIO.debut + ' · ALREADY A LEGEND'],
];
function handleEvents() {
  for (const e of match.events) {
    switch (e.type) {
      case 'hit':
        sound.hit(e.power); fx.spark(e.at, e.power);
        shake = Math.max(shake, 0.05 * e.power); hitstop = Math.max(hitstop, e.kd ? 0.09 : 0.035);
        arena.pop(0.08 * e.power + (e.kd ? 0.25 : 0));
        vibe(e.w, e.kd ? 120 : 45);
        if (e.kd) sound.pop(0.6);
        break;
      case 'block': sound.block(); fx.spark(e.at, 0.3, 0x88ccff); vibe(e.w, 15); break;
      case 'whoosh': sound.whoosh(); break;
      case 'rope': sound.rope(); arena.ropeHit(e.side, ropeAlong(e.side, e.x, e.z), e.power); break;
      case 'grab': sound.block(); vibe(e.v, 60); break;
      case 'lift': arena.pop(0.2); break;
      case 'slam':
        sound.slam(e.power); fx.slam(e.at, e.power);
        shake = Math.max(shake, 0.12 * e.power); hitstop = Math.max(hitstop, 0.1);
        arena.pop(0.35 * e.power); sound.pop(0.5 + 0.3 * e.power);
        vibe(e.w, 180 + e.power * 60); vibe(e.by, 40);
        if (e.kind === 'bomb') {
          const joe = e.by.player.char === 'joe';
          banner(`${esc(e.by.name)}<small>${joe ? JOE.finisher + '!' : 'FINISHER!'}</small>`, 1600, joe ? 'big joe' : 'big');
          sound.say(joe ? 'THE MIC DROP! Oh my god!' : 'Oh my god!', { rate: 1.1, pitch: 0.8 });
        }
        break;
      case 'finisher': slowmo = 1.1; arena.pop(0.6); break;
      case 'finisherReady': sound.pop(0.5); vibe(e.w, 250); break;
      case 'taunt': break;
      case 'tauntDone':
        sound.pop(0.7); arena.pop(0.4);
        if (e.w.player.char === 'joe') {
          sound.pop(1.2); arena.pop(0.8);
          arena.setTron(JOE.name, '♪ JOE! JOE! JOE! ♪', e.w.rig.faceCanvas);
          clearTimeout(tronTimer); tronTimer = setTimeout(() => { if (phase === 'match') arena.setTron(JOE.name, 'THE MAIN EVENT', joeIn(match.wrestlers)?.rig.faceCanvas); }, 2500);
          if (time - lastChant > 12) { lastChant = time; sound.say('Joe! Joe! Joe!', { rate: 1.4, pitch: 1.1 }); }
        }
        break;
      case 'escape': sound.whoosh(); banner('ESCAPED!', 700); break;
      case 'pinStart': sound.pop(0.4); arena.pop(0.3); break;
      case 'smallPackage':
        banner(`SMALL PACKAGE!<small>${esc(e.w.name)}'S SIGNATURE MOVE</small>`, 1500, 'big joe');
        sound.say('The small package! His signature move!', { rate: 1.15, pitch: 0.8, interrupt: true });
        sound.pop(1.2); arena.pop(0.9); vibe(e.v, 200);
        break;
      case 'count':
        sound.slap(); arena.pop(0.25);
        banner(`<span class="count">${e.n}</span>${e.clean && e.n === 3 ? '<small>TOTALLY CLEAN · NO HELP AT ALL</small>' : ''}`, e.clean && e.n === 3 ? 1600 : 600, 'cnt');
        sound.say(['', 'One', 'Two', 'Three'][e.n] || '', { rate: 1.3, pitch: 0.9 });
        vibe(e.v, 60);
        break;
      case 'kickout': banner('KICK OUT!', 900); sound.pop(1); arena.pop(0.7); vibe(e.w, 100); break;
      case 'pinBroken': banner('PIN BROKEN!', 800); sound.pop(0.8); break;
      case 'elim':
        sound.bell(1); sound.pop(1.2); arena.pop(1);
        if (match.active().length > 1) {
          const joe = e.w.player.char === 'joe';
          banner(`${esc(e.w.name)}<small>${joe ? 'HAS FALLEN!' : e.clean ? 'PINNED. TOTALLY CLEAN.' : 'ELIMINATED'}</small>`, 1600, 'big');
          sound.say(joe ? 'Oh my god! Joe Master has been pinned! Somebody just beat the main event!'
            : e.clean ? `${e.w.name} has been eliminated... totally clean, and with no help at all!` : `${e.w.name} has been eliminated!`, { rate: 1.05 });
        }
        vibe(e.w, 400);
        break;
      case 'win':
        setTimeout(() => sound.bell(3), 300);
        if (e.w) {
          const joe = e.w.player.char === 'joe';
          banner(`${esc(e.w.name)}<small>${joe ? 'STILL THE MAIN EVENT!' : 'MASTER OF THE MULTIVERSE!'}</small>`, 3500, joe ? 'big win joe' : 'big win');
          setTimeout(() => sound.say(joe ? 'Here is your winner... and STILL... Joe... Master!' : `Here is your winner... and the new master of the multiverse... ${e.w.name}!`, { rate: 0.95, pitch: 0.6, interrupt: true }), 700);
          setTimeout(() => music.intro(), 400);
          if (joe) arena.setTron(JOE.name, 'WINS!', e.w.rig.faceCanvas);
          vibe(e.w, 300);
        }
        arena.pop(1.5);
        resultsT = -3.2; // wait before the results screen
        break;
    }
  }
  match.events.length = 0;
}
function ropeAlong(side, x, z) {
  return side === 0 ? x / 3 : side === 1 ? -z / 3 : side === 2 ? -x / 3 : z / 3;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- keyboard ----------
const kb = { keys: new Set() };
function kbHeld() {
  const k = kb.keys; let b = 0;
  if (k.has('KeyJ')) b |= BTN.STRIKE; if (k.has('KeyK')) b |= BTN.GRAPPLE; if (k.has('ShiftLeft') || k.has('ShiftRight')) b |= BTN.RUN;
  if (k.has('KeyL')) b |= BTN.BLOCK; if (k.has('KeyI')) b |= BTN.TAUNT;
  return b;
}
function kbUpdate() {
  const p = players.find(q => q && q.kind === 'kb'); if (!p) return;
  const k = kb.keys;
  let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), y = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  p.input.set(x, y, kbHeld());
}
addEventListener('keydown', e => {
  sound.start(); music.start(); $('soundHint').style.display = 'none';
  if (e.repeat) return;
  kb.keys.add(e.code);
  if (e.code === 'Enter') requestStart();
  if (e.code === 'KeyP') banner('FILTER: ' + retro.cycleMode(), 900);
  if (e.code === 'KeyM') { sound.voice = !sound.voice; banner(sound.voice ? 'ANNOUNCER ON' : 'ANNOUNCER OFF', 900); }
  if (e.code === 'KeyN') { const on = music.toggle(); updateMusicUi(on); banner(on ? 'MUSIC ON' : 'MUSIC OFF', 900); }
  if (e.code === 'Escape' && phase !== 'lobby') backToLobby();
  if (e.code === 'KeyC' && phase === 'lobby') addCpu();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyI', 'ShiftLeft', 'ShiftRight'].includes(e.code)) kbUpdate();
});
addEventListener('keyup', e => { kb.keys.delete(e.code); kbUpdate(); });
addEventListener('blur', () => { kb.keys.clear(); kbUpdate(); });
addEventListener('pointerdown', () => { sound.start(); music.start(); $('soundHint').style.display = 'none'; });

function addCpu() {
  const s = freeSlot(); if (s < 0) return;
  newPlayer(s, 'cpu');
  refreshLobby();
}
$('addCpu').onclick = addCpu;
$('addJoe').onclick = () => { joeCpuWanted = true; addJoeCpu(); refreshLobby(); };
$('musicBtn').onclick = () => { music.start(); const on = music.toggle(); updateMusicUi(on); };
$('addKb').onclick = () => { const s = freeSlot(); if (s >= 0 && !players.some(p => p && p.kind === 'kb')) { newPlayer(s, 'kb'); refreshLobby(); } };
$('startBtn').onclick = () => requestStart();
$('rematch').onclick = () => requestStart();
$('toLobby').onclick = () => backToLobby();
$('filterBtn').onclick = () => { $('filterBtn').textContent = 'FILTER: ' + retro.cycleMode(); };
$('filterBtn').textContent = 'FILTER: ' + retro.mode.name;

// ---------- camera ----------
const camPos = new THREE.Vector3(0, RING_H + 4, 9), camLook = new THREE.Vector3(0, RING_H + 1, 0);
const tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
function updateCamera(dt, t) {
  if (phase === 'lobby') {
    const a = Math.sin(t * 0.12) * 0.35;
    tPos.set(Math.sin(a) * 8.6, RING_H + 2.2, Math.cos(a) * 8.6);
    tLook.set(0, RING_H + 1.05, 0.4);
  } else if (phase === 'intro') {
    const jt = joeEntrance ? JOE_ENTRANCE : 0;
    if (introT < jt) {
      const w = joeEntrance, f = w.fwd(), side = new THREE.Vector2(f.y, -f.x);
      const k = introT / jt;
      tPos.set(w.pos.x + f.x * (4.0 - k * 0.8) + side.x * 1.0, RING_H + 1.35 + k * 0.35, w.pos.y + f.y * (4.0 - k * 0.8) + side.y * 1.0);
      tLook.set(w.pos.x, RING_H + 1.35, w.pos.y);
      if (introT < 0.05) { camPos.copy(tPos); camLook.copy(tLook); }
    }
    const u = Math.min(1, Math.max(0, introT - jt) / 3);
    const a = (1 - u) * 1.6 - 0.2;
    if (introT >= jt) {
      tPos.set(Math.sin(a) * (11 - u * 3), RING_H + 1.5 + u * 3, Math.cos(a) * (11 - u * 3));
      tLook.set(0, RING_H + 0.8, 0);
    }
  } else if (match && match.winner && (phase === 'results' || match.over)) {
    const w = match.winner, a = Math.sin(t * 0.25) * 0.6;
    tPos.set(w.pos.x + Math.sin(a) * 3.6, RING_H + 1.9, w.pos.y + Math.cos(a) * 3.6);
    tLook.set(w.pos.x, RING_H + 1.35, w.pos.y);
  } else if (match) {
    const act = match.active();
    const c = new THREE.Vector2();
    act.forEach(w => c.add(w.pos)); if (act.length) c.multiplyScalar(1 / act.length);
    let spread = 0; act.forEach(w => spread = Math.max(spread, w.pos.distanceTo(c)));
    const dist = Math.min(8.3, 5.5 + spread * 1.0);
    tPos.set(c.x * 0.6, RING_H + 2.6 + spread * 0.55, Math.min(8.4, c.y * 0.5 + dist));
    tLook.set(c.x * 0.85, RING_H + 0.75, c.y * 0.85);
  }
  const k = 1 - Math.exp(-dt * (phase === 'intro' ? 2.5 : 3.2));
  camPos.lerp(tPos, k); camLook.lerp(tLook, k);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 0.6);
  }
  camera.lookAt(camLook);
}

// ---------- main loop ----------
let last = performance.now(), time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(1 / 20, (now - last) / 1000); last = now;
  time += dt;
  let simDt = dt;
  if (hitstop > 0) { hitstop -= dt; simDt = 0; }
  if (slowmo > 0) { slowmo -= dt; simDt *= 0.4; }

  if (phase === 'lobby' || phase === 'results') {
    if (phase === 'lobby') syncLobbyRigs(dt, time);
  }
  if (phase === 'results') resultsT += dt;
  if (match && (phase === 'intro' || phase === 'match' || phase === 'results')) {
    if (phase === 'intro') {
      introT += dt;
      updateEntrance();
      if (introT > introLen) { phase = 'match'; sound.bell(1); banner('FIGHT!', 900, 'big'); arena.pop(0.8); broadcastPhase(); music.endIntro(4); factT = 6; }
    }
    const inputs = new Map();
    for (const w of match.wrestlers) {
      const p = w.player;
      let f;
      if (p.kind === 'cpu') f = brains.get(w).frame(simDt, match);
      else f = p.input.consume();
      if (phase !== 'match') f = { x: 0, y: 0, held: 0, pressed: 0, mash: 0 };
      if (p.kind === 'pad' && !p.connected) f = { x: 0, y: 0, held: 0, pressed: 0, mash: 0 };
      inputs.set(w, f);
    }
    if (simDt > 0) {
      match.update(simDt, inputs);
      handleEvents();
    }
    match.sync(simDt, time);
    for (const mk of markers) {
      const w = mk.userData.w;
      mk.visible = !w.eliminated && phase !== 'results' && w.state !== 'entrance';
      const h = w.rig.headWorld();
      mk.position.set(h.x, Math.max(h.y, RING_H + 0.6) + 0.55, h.z);
    }
    updateHud();
    if (match.over && phase === 'match') { resultsT += dt; if (resultsT > 0) endToResults(); }
    // crowd noise follows excitement
    sound.crowd(Math.min(1, arena.excite));
  } else {
    sound.crowd(0.25);
  }
  pushPadState(dt);
  fx.update(simDt);
  arena.update(dt);
  updateCamera(dt, time);
  music.update(dt);
  if (phase === 'match' && match && !match.over) {
    factT -= dt;
    if (factT <= 0) { factT = 9; factI = (factI + 1) % FACTS.length; arena.setTron(FACTS[factI][0], FACTS[factI][1]); }
  }
  retro.render(scene, camera, time);
}

function updateMusicUi(on = music.on) {
  const c = music.counts();
  $('musicBtn').textContent = on ? '♪ MUSIC: ON' : '♪ MUSIC: OFF';
  $('musicInfo').textContent = c.background + c.intro
    ? `${c.background} background · ${c.intro} intro track${c.intro === 1 ? '' : 's'}`
    : 'No music yet — add files to music/background and music/intro';
}

// ---------- boot ----------
arena.setTron(TITLE, 'SCAN THE QR TO JOIN');
music.refresh().then(() => updateMusicUi(music.on));
buildTicker();
showOverlay('lobby');
addJoeCpu();
refreshLobby();
net.start();
requestAnimationFrame(frame);

// debug/test hook
window.__music = music;
window.__tb = { net, arena, scene, camera, players, get match() { return match; }, get phase() { return phase; }, addCpu, startMatch, retro, newPlayer, refreshLobby };

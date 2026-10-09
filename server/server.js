// JOE MASTER UNIVERSE — optional local server.
// The game normally runs from GitHub Pages with phones connecting peer-to-peer. This server is for
// playing on your own Wi-Fi without internet: it serves the site and relays phone input over WebSockets.
// No npm install needed: run `node server/server.js` (or start.bat).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { attach } = require('./lib/ws');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, '..');
const HIDDEN = /^[\\/](server|tools|\.github|\.git)([\\/]|$)/;

// ---------- music ----------
// Drop audio files into music/background (looped playlist) and music/intro (entrance + victory music).
const MUSIC = path.join(PUBLIC, 'music');
const MUSIC_DIRS = ['background', 'intro'];
const AUDIO = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm' };
for (const d of MUSIC_DIRS) { try { fs.mkdirSync(path.join(MUSIC, d), { recursive: true }); } catch { /* ignore */ } }
function listMusic() {
  const out = {};
  for (const d of MUSIC_DIRS) {
    try {
      out[d] = fs.readdirSync(path.join(MUSIC, d)).filter(f => AUDIO[path.extname(f).toLowerCase()]).sort()
        .map(f => `music/${d}/${encodeURIComponent(f)}`);
    } catch { out[d] = []; }
  }
  return out;
}
// keep music/music.json (used when hosted on GitHub Pages) in step with the folders
function writeManifest() {
  try { fs.writeFileSync(path.join(MUSIC, 'music.json'), JSON.stringify(listMusic(), null, 2) + '\n'); } catch { /* read-only folder */ }
}
writeManifest();
function sendAudio(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end(); return; }
    const type = AUDIO[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file).pipe(res);
    }
  });
}

// ---------- pick the LAN address phones should use ----------
function lanAddress() {
  const bad = /(vethernet|virtualbox|vmware|hyper-v|wsl|docker|vbox|loopback|tailscale|zerotier|hamachi|bluetooth|utun|bridge|br-|veth)/i;
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score += 30;
      else if (a.address.startsWith('10.')) score += 20;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 10;
      if (a.address.startsWith('192.168.56.') || a.address.startsWith('169.254.')) score -= 50;
      if (bad.test(name)) score -= 40;
      if (/(wi-?fi|wlan|wireless|ethernet|^en|^eth)/i.test(name)) score += 15;
      list.push({ name, address: a.address, score });
    }
  }
  list.sort((a, b) => b.score - a.score);
  return { best: list[0] ? list[0].address : 'localhost', all: list };
}
const lan = lanAddress();
const HOST_IP = process.env.HOST_IP || lan.best;
const JOIN_URL = `http://${HOST_IP}:${PORT}/play.html`;

// ---------- static files ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ server: 'joe-master-universe', joinUrl: JOIN_URL }));
    return;
  }
  if (url.pathname === '/music/music.json') {
    writeManifest();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(listMusic()));
    return;
  }
  if (url.pathname.startsWith('/music/') && AUDIO[path.extname(url.pathname).toLowerCase()]) {
    const file = path.normalize(path.join(MUSIC, decodeURIComponent(url.pathname.slice('/music/'.length))));
    if (!file.startsWith(MUSIC + path.sep)) { res.writeHead(403); res.end(); return; }
    sendAudio(req, res, file);
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (HIDDEN.test(p)) { res.writeHead(404); res.end('Not found'); return; }
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- message relay ----------
// The game page ("host") owns all game state and decides player slots.
// Phones ("pads") are identified by a random id they keep in localStorage, so a refresh rejoins the same slot.
let host = null;
const pads = new Map(); // padId -> socket

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

attach(server, ws => {
  ws.role = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'host') {
      if (host && host !== ws) { send(host, { t: 'replaced' }); host.close(); }
      host = ws; ws.role = 'host';
      console.log('[game] screen connected');
      for (const [id, p] of pads) send(host, { t: 'pad', pad: id, ev: 'hello', data: { profile: p.profile } });
      return;
    }
    if (m.t === 'hello' && ws.role !== 'host') {
      const id = String(m.id || '').slice(0, 64) || Math.random().toString(36).slice(2);
      const old = pads.get(id);
      if (old && old !== ws) { old.replaced = true; old.close(); }
      ws.role = 'pad'; ws.padId = id; ws.profile = m.profile || {};
      pads.set(id, ws);
      console.log(`[pad] ${ws.profile.name || id} connected`);
      if (host) send(host, { t: 'pad', pad: id, ev: 'hello', data: { profile: ws.profile } });
      else send(ws, { t: 'nohost' });
      return;
    }
    if (ws.role === 'pad') {
      if (m.t === 'profile') ws.profile = m.profile || {};
      send(host, { t: 'pad', pad: ws.padId, ev: m.t, data: m });
      return;
    }
    if (ws.role === 'host') {
      if (m.t === 'to') send(pads.get(m.pad), m.msg);
      else if (m.t === 'all') for (const p of pads.values()) send(p, m.msg);
    }
  });
  ws.on('close', () => {
    if (ws === host) {
      host = null;
      console.log('[game] screen disconnected');
      for (const p of pads.values()) send(p, { t: 'nohost' });
    } else if (ws.role === 'pad' && pads.get(ws.padId) === ws) {
      pads.delete(ws.padId);
      console.log(`[pad] ${ws.profile && ws.profile.name || ws.padId} left`);
      send(host, { t: 'pad', pad: ws.padId, ev: 'bye', data: {} });
    }
  });
});

// keep connections alive through phone sleep / Wi-Fi power saving
setInterval(() => {
  const all = [host, ...pads.values()].filter(Boolean);
  for (const s of all) {
    if (Date.now() - s.lastSeen > 45000) s.close(); else s.ping();
  }
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ████  JOE MASTER UNIVERSE  ████   (local Wi-Fi mode)');
  console.log('');
  console.log(`  Game screen : http://localhost:${PORT}`);
  console.log(`  Phones join : ${JOIN_URL}   (or scan the QR on the game screen)`);
  const mus = listMusic();
  console.log(`  Music       : ${mus.background.length} background, ${mus.intro.length} intro  (folders: music/background, music/intro)`);
  if (lan.all.length > 1) {
    console.log('  Other addresses on this PC (set HOST_IP=... if phones cannot connect):');
    for (const a of lan.all.slice(1)) console.log(`     ${a.address}  (${a.name})`);
  }
  console.log('');
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy. Close the other server or run with PORT=3001.`);
  else console.error(e);
  process.exit(1);
});

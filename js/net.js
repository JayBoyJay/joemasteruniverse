// Networking for the game screen. Two interchangeable transports carry the same messages:
//
//  'peer' — the normal way (GitHub Pages or any static host). Phones connect straight to this browser
//           over WebRTC. PeerJS's free cloud server is only used to introduce them; after that the
//           button presses go device-to-device.
//  'ws'   — the optional local Node server (server/server.js) relays over WebSockets on your Wi-Fi,
//           which also works with no internet.

export const PEER_PREFIX = 'joemasteruniverse-';
const PEERJS_URLS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
export async function loadPeerJS() {
  const get = () => window.Peer || (window.peerjs && window.peerjs.Peer);
  if (get()) return get();
  for (const url of PEERJS_URLS) {
    try { await loadScript(url); if (get()) return get(); } catch { /* try the next CDN */ }
  }
  throw new Error('PeerJS could not be loaded (no internet?)');
}

// Ask whether we're being served by the local Node server.
export async function detectLocalServer() {
  if (location.protocol === 'https:') return null; // GitHub Pages etc. — the local server is always plain http
  try {
    const r = await fetch('info', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.server === 'joe-master-universe' ? j : null;
  } catch { return null; }
}

export class HostNet {
  // onPad(padId, ev, data): ev is 'hello' | 'i' | 'profile' | 'start' | 'bye'
  // onStatus(text, ok): connection status for the lobby
  constructor({ onPad, onStatus, onReady }) {
    this.onPad = onPad; this.onStatus = onStatus || (() => {}); this.onReady = onReady || (() => {});
    this.mode = null; this.room = null; this.joinUrl = '';
  }

  async start() {
    const info = await detectLocalServer();
    if (info) this._startWs(info);
    else await this._startPeer();
  }

  sendTo(pad, msg) {
    if (!pad) return;
    if (this.mode === 'ws') {
      if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'to', pad, msg }));
    } else if (this.mode === 'peer') {
      const c = this.conns.get(pad);
      if (c && c.open) { try { c.send(msg); } catch { /* channel closing */ } }
    }
  }

  // ---------------- local server ----------------
  _startWs(info) {
    this.mode = 'ws';
    this.joinUrl = info.joinUrl;
    this.onReady(this);
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
      this.ws = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'host' })); this.onStatus('', true); };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'pad') this.onPad(m.pad, m.ev, m.data || {});
        if (m.t === 'replaced') { ws.onclose = null; this.onStatus('The game is open in another tab', false); }
      };
      ws.onclose = () => { this.onStatus('Reconnecting to the local server…', false); setTimeout(connect, 1500); };
    };
    connect();
  }

  // ---------------- peer-to-peer ----------------
  async _startPeer() {
    this.mode = 'peer';
    this.conns = new Map();
    this.onStatus('Connecting…', false);
    let Peer;
    try { Peer = await loadPeerJS(); } catch (e) { this.onStatus('Couldn\'t reach the internet to set up phone connections. Check the connection and refresh.', false); return; }
    this.Peer = Peer;
    // keep-alive: phones send input ~4x a second; drop ones we haven't heard from in a while,
    // and ping them from a timer (timers keep running even if the TV tab is in the background)
    setInterval(() => {
      const now = Date.now();
      for (const c of this.conns.values()) {
        if (now - (c.lastSeen || now) > 10000) { try { c.close(); } catch { /* ignore */ } }
        else if (c.open) { try { c.send({ t: 'ping' }); } catch { /* ignore */ } }
      }
    }, 1000);
    let code = null;
    try { code = localStorage.getItem('jmu_room'); } catch { /* ignore */ }
    if (!/^[A-Z]{4}$/.test(code || '')) code = makeRoomCode();
    this._open(code, 0);
  }

  _open(code, attempt) {
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
    const peer = new this.Peer(PEER_PREFIX + code, { debug: 0 });
    this.peer = peer;
    peer.on('open', () => {
      this.room = code;
      try { localStorage.setItem('jmu_room', code); } catch { /* ignore */ }
      this.joinUrl = new URL('play.html?room=' + code, location.href).href;
      this.onStatus('', true);
      this.onReady(this);
    });
    peer.on('connection', conn => this._accept(conn));
    peer.on('disconnected', () => {
      if (peer !== this.peer || peer.destroyed) return;
      this.onStatus('Lost the connection server — reconnecting… (phones already in can keep playing)', false);
      setTimeout(() => { if (peer === this.peer && !peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch { /* ignore */ } } }, 1500);
    });
    peer.on('error', err => {
      if (peer !== this.peer) return;
      const type = err && err.type;
      if (type === 'unavailable-id') {
        // After a refresh the old registration can linger for a few seconds: retry the same code, then pick a new one.
        if (attempt < 4) setTimeout(() => this._open(code, attempt + 1), 2000);
        else this._open(makeRoomCode(), 0);
      } else if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        this.onStatus('Can\'t reach the connection server — retrying…', false);
        setTimeout(() => { if (peer === this.peer) { if (peer.destroyed) this._open(code, 0); else if (peer.disconnected) { try { peer.reconnect(); } catch { this._open(code, 0); } } } }, 3000);
      } else if (type === 'browser-incompatible') {
        this.onStatus('This browser can\'t do WebRTC — try Chrome, Edge or Firefox.', false);
      }
    });
  }

  newRoom() { this._open(makeRoomCode(), 0); }

  _accept(conn) {
    conn.on('data', m => this._fromPad(conn, m));
    const gone = () => {
      if (conn.padId && this.conns.get(conn.padId) === conn) {
        this.conns.delete(conn.padId);
        this.onPad(conn.padId, 'bye', {});
      }
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  _fromPad(conn, m) {
    conn.lastSeen = Date.now();
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch { return; } }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      const id = String(m.id || '').slice(0, 64) || conn.peer;
      const old = this.conns.get(id);
      if (old && old !== conn) { old.padId = null; try { old.close(); } catch { /* ignore */ } }
      conn.padId = id;
      this.conns.set(id, conn);
      this.onPad(id, 'hello', { profile: m.profile || {} });
      return;
    }
    if (!conn.padId) return;
    this.onPad(conn.padId, m.t, m);
  }
}

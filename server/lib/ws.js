// Tiny WebSocket server (RFC 6455, text frames) built on Node's http module. Zero dependencies.
'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 2 * 1024 * 1024;

class Socket extends EventEmitter {
  constructor(sock) {
    super();
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.open = true;
    this.lastSeen = Date.now();
    sock.setNoDelay(true);
    sock.on('data', d => this._onData(d));
    sock.on('close', () => this._closed());
    sock.on('error', () => this._closed());
  }
  get readyState() { return this.open ? 1 : 3; }
  send(text) {
    if (!this.open) return;
    const payload = Buffer.from(text, 'utf8');
    this._frame(0x1, payload);
  }
  ping() { if (this.open) this._frame(0x9, Buffer.alloc(0)); }
  close() {
    if (!this.open) return;
    try { this._frame(0x8, Buffer.from([0x03, 0xe8])); } catch { /* ignore */ }
    try { this.sock.end(); } catch { /* ignore */ }
    this._closed();
  }
  _frame(op, payload) {
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | op;
    try { this.sock.write(Buffer.concat([head, payload])); } catch { this._closed(); }
  }
  _closed() {
    if (!this.open) return;
    this.open = false;
    try { this.sock.destroy(); } catch { /* ignore */ }
    this.emit('close');
  }
  _onData(d) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.open) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_PAYLOAD) { this.close(); return; }
      const maskLen = masked ? 4 : 0;
      if (b.length < off + maskLen + len) return;
      let payload = b.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mask = b.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = b.subarray(off + maskLen + len);
      if (op === 0x8) { this.close(); return; }
      if (op === 0x9) { this._frame(0xA, payload); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2) {
        if (fin) { if (op === 0x1) this.emit('message', payload.toString('utf8')); }
        else this.frag = { op, parts: [payload] };
      } else if (op === 0x0 && this.frag) {
        this.frag.parts.push(payload);
        if (fin) {
          const all = Buffer.concat(this.frag.parts), fop = this.frag.op; this.frag = null;
          if (fop === 0x1) this.emit('message', all.toString('utf8'));
        }
      }
    }
  }
}

function attach(server, onConnection) {
  server.on('upgrade', (req, sock) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    onConnection(new Socket(sock), req);
  });
}

module.exports = { attach };

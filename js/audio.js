// All sound is synthesised with WebAudio (no files), plus an optional announcer voice.
export class Sound {
  constructor() {
    this.ctx = null; this.on = false; this.voice = true;
    this.crowdGain = null;
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    this.noiseBuf = this._noise(2);
    this._crowd();
    this.on = true;
  }
  _noise(sec, brown = false) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  _crowd() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this._noise(4, true); src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    const bp2 = c.createBiquadFilter(); bp2.type = 'peaking'; bp2.frequency.value = 1800; bp2.gain.value = 6;
    this.crowdGain = c.createGain(); this.crowdGain.gain.value = 0.25;
    src.connect(bp).connect(bp2).connect(this.crowdGain).connect(this.master);
    src.start();
  }
  crowd(level) {
    if (!this.on) return;
    this.crowdGain.gain.setTargetAtTime(0.15 + level * 0.5, this.ctx.currentTime, 0.25);
  }
  _env(node, t, a, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  _burst(t, { freq = 1000, q = 1, type = 'lowpass', peak = 0.5, decay = 0.15, dur = 0.4 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this._env(g, t, 0.003, peak, decay);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random(), dur); s.stop(t + dur);
  }
  _thump(t, f0, f1, peak, decay) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = c.createGain(); this._env(g, t, 0.004, peak, decay);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + decay + 0.05);
  }
  hit(power = 1) {
    if (!this.on) return; const t = this.ctx.currentTime;
    this._burst(t, { freq: 1800 + Math.random() * 600, q: 0.8, peak: 0.35 + 0.2 * power, decay: 0.06 + 0.04 * power });
    this._thump(t, 180, 60, 0.5 + 0.3 * power, 0.12 + 0.05 * power);
  }
  block() {
    if (!this.on) return; const t = this.ctx.currentTime;
    this._burst(t, { freq: 900, q: 2, type: 'bandpass', peak: 0.3, decay: 0.05 });
  }
  whoosh() {
    if (!this.on) return; const t = this.ctx.currentTime, c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.12);
    const g = c.createGain(); this._env(g, t, 0.04, 0.12, 0.1);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random(), 0.3); s.stop(t + 0.3);
  }
  slam(power = 1) {
    if (!this.on) return; const t = this.ctx.currentTime;
    this._thump(t, 120, 38, 0.9, 0.35 + 0.15 * power);
    this._burst(t, { freq: 450, q: 0.7, peak: 0.7, decay: 0.25 + 0.1 * power, dur: 0.6 });
    this._burst(t + 0.02, { freq: 3000, q: 1.5, type: 'bandpass', peak: 0.15, decay: 0.2 }); // ropes/springs rattle
  }
  rope() {
    if (!this.on) return; const t = this.ctx.currentTime, c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.3);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); this._env(g, t, 0.005, 0.25, 0.3);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.4);
  }
  slap() {
    if (!this.on) return; const t = this.ctx.currentTime;
    this._burst(t, { freq: 1200, q: 0.9, peak: 0.6, decay: 0.08 });
    this._thump(t, 140, 70, 0.4, 0.1);
  }
  bell(times = 3) {
    if (!this.on) return;
    const c = this.ctx;
    for (let i = 0; i < times; i++) {
      const t = c.currentTime + i * 0.32;
      for (const [f, a] of [[880, 0.3], [1320, 0.12], [2210, 0.06], [3100, 0.03]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
        const g = c.createGain(); this._env(g, t, 0.002, a, 0.9);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + 1);
      }
    }
  }
  pop(level = 1) { // crowd cheer swell
    if (!this.on) return; const t = this.ctx.currentTime, c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * level, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random(), 1.8); s.stop(t + 1.8);
  }
  say(text, { rate = 1, pitch = 0.7, interrupt = false } = {}) {
    if (!this.voice || !window.speechSynthesis) return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      const v = speechSynthesis.getVoices().find(v => /en(-|_)(US|GB|AU)/i.test(v.lang) && /male|david|daniel|george|james|fred/i.test(v.name))
        || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* no voice available */ }
  }
}

// Music from the music/background and music/intro folders (see music/README.txt).
// Background tracks loop as a shuffled playlist; intro tracks play over entrances and wins, with the
// background ducked underneath.
export class Music {
  constructor() {
    this.lists = { background: [], intro: [] };
    this.on = true; this.started = false;
    try { this.on = localStorage.getItem('jmu_music') !== 'off'; } catch { /* ignore */ }
    this.bg = new Audio(); this.bg.preload = 'auto';
    this.fg = new Audio(); this.fg.preload = 'auto';
    this.bgVol = 0; this.fgVol = 0; this.bgTarget = 0.42; this.fgTarget = 0;
    this.bgQueue = [];
    this.fgUntil = 0;
    this.bg.addEventListener('ended', () => this._nextBg());
    this.bg.addEventListener('error', () => setTimeout(() => this._nextBg(), 500));
    this.fg.addEventListener('ended', () => { this.fgTarget = 0; this.bgTarget = 0.42; });
    this.refresh();
  }
  async refresh() {
    try {
      const r = await fetch('music/music.json', { cache: 'no-store' });
      const j = await r.json();
      const changed = JSON.stringify(j.background) !== JSON.stringify(this.lists.background);
      this.lists = { background: j.background || [], intro: j.intro || [] };
      if (changed) { this.bgQueue = []; if (this.started && this.on && (!this.bg.src || this.bg.paused)) this._nextBg(); }
    } catch { /* server without music support */ }
    return this.lists;
  }
  counts() { return { background: this.lists.background.length, intro: this.lists.intro.length }; }
  // must be called from a user gesture (browser autoplay rules)
  start() {
    if (this.started) return;
    this.started = true;
    if (this.on) this._nextBg();
  }
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('jmu_music', this.on ? 'on' : 'off'); } catch { /* ignore */ }
    if (this.on) { if (this.started) { if (this.bg.src) this.bg.play().catch(() => {}); else this._nextBg(); } }
    else { this.bg.pause(); this.fg.pause(); }
    return this.on;
  }
  _nextBg() {
    if (!this.on || !this.started || !this.lists.background.length) return;
    if (!this.bgQueue.length) this.bgQueue = shuffle([...this.lists.background]);
    this.bg.src = this.bgQueue.shift();
    this.bg.play().catch(() => {});
  }
  // play a random intro track over the top; background ducks underneath
  intro({ maxSecs = 0 } = {}) {
    if (!this.on || !this.started) return false;
    if (!this.lists.intro.length) {
      // no separate entrance music: restart the background theme from the top and turn it up
      if (!this.lists.background.length) return false;
      if (!this.bg.src) this._nextBg();
      try { this.bg.currentTime = 0; } catch { /* not loaded yet */ }
      this.bg.play().catch(() => {});
      this.bgTarget = 0.9; this.boosted = true;
      this.fgUntil = maxSecs ? performance.now() + maxSecs * 1000 : 0;
      return true;
    }
    const list = this.lists.intro;
    this.fg.src = list[Math.floor(Math.random() * list.length)];
    try { this.fg.currentTime = 0; } catch { /* not loaded yet */ }
    this.fgVol = 0.0; this.fgTarget = 0.85; this.bgTarget = 0.06;
    this.fgUntil = maxSecs ? performance.now() + maxSecs * 1000 : 0;
    this.fg.play().catch(() => {});
    return true;
  }
  // fade the intro out and bring the background back
  endIntro(fadeAfter = 0) {
    this.fgUntil = performance.now() + fadeAfter * 1000;
  }
  update(dt) {
    if (this.fgUntil && performance.now() > this.fgUntil) { this.fgTarget = 0; this.bgTarget = 0.42; this.fgUntil = 0; this.boosted = false; }
    const step = (cur, tgt, rate) => cur + Math.max(-rate * dt, Math.min(rate * dt, tgt - cur));
    this.bgVol = step(this.bgVol, this.on ? this.bgTarget : 0, this.boosted ? 1.5 : 0.5);
    this.fgVol = step(this.fgVol, this.on ? this.fgTarget : 0, 0.6);
    this.bg.volume = Math.max(0, Math.min(1, this.bgVol));
    this.fg.volume = Math.max(0, Math.min(1, this.fgVol));
    if (this.fgVol <= 0.001 && this.fgTarget === 0 && !this.fg.paused) this.fg.pause();
  }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

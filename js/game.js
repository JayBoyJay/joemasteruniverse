// Match simulation: wrestlers' state machines, strikes, grapples, throws, pins, eliminations and the referee.
import * as THREE from 'three';
import { RING_H, LIM, ROPE, APRON } from './tex.js';
import { poseFor } from './poses.js';
import { Rig } from './rig.js';

export const BTN = { STRIKE: 1, GRAPPLE: 2, RUN: 4, BLOCK: 8, TAUNT: 16 };
const PI = Math.PI;

const MOVES = {
  jab: { name: 'jab', dur: 0.3, hitAt: 0.11, range: 1.2, arc: 0.95, dmg: 4, stun: 0.32, push: 0.8, next: 'hook', single: true },
  hook: { name: 'hook', dur: 0.36, hitAt: 0.15, range: 1.2, arc: 1.05, dmg: 5, stun: 0.38, push: 1.0, next: 'kick', single: true },
  kick: { name: 'kick', dur: 0.55, hitAt: 0.24, range: 1.4, arc: 0.85, dmg: 8, stun: 0.55, push: 3.0, kdBelow: 40 },
  clothesline: { name: 'clothesline', dur: 0.5, hitFrom: 0.04, hitTo: 0.32, range: 1.1, arc: 1.4, dmg: 12, knockdown: true, push: 2.0 },
  stomp: { name: 'stomp', dur: 0.5, hitAt: 0.3, range: 1.6, dmg: 4, ground: true },
  whiff: { name: 'whiff', dur: 0.45 },
  knee: { name: 'knee', dur: 0.32 },
  taunt: { name: 'taunt', dur: 1.6 },
};

// Throw flights: victim keyframes in the attacker's frame (f = metres in front, h = hip height above the mat, p = body pitch)
const THROWS = {
  slam: {
    name: 'slam', dur: 1.0, land: 0.72, dmg: 12, yawOff: 0, power: 1,
    keys: [{ t: 0, f: 0.75, h: null, p: 0 }, { t: 0.3, f: 0.25, h: 1.75, p: -PI / 2 }, { t: 0.52, f: 0.25, h: 1.95, p: -PI / 2 }, { t: 0.72, f: 0.85, h: 0.2, p: -PI / 2 }],
  },
  suplex: {
    name: 'suplex', dur: 1.25, land: 0.78, dmg: 15, yawOff: 0, power: 1.3,
    keys: [{ t: 0, f: 0.72, h: null, p: 0 }, { t: 0.22, f: 0.4, h: 1.55, p: 0.5 }, { t: 0.46, f: 0.0, h: 2.55, p: PI }, { t: 0.78, f: -1.75, h: 0.2, p: 1.5 * PI }],
  },
  bomb: {
    name: 'bomb', dur: 1.4, land: 0.86, dmg: 30, yawOff: 0, power: 2.2, sit: [0.3, 0.84],
    keys: [{ t: 0, f: 0.72, h: null, p: 0 }, { t: 0.25, f: 0.45, h: 1.35, p: 0.9 }, { t: 0.5, f: 0.25, h: 2.45, p: -0.25 }, { t: 0.66, f: 0.25, h: 2.55, p: -0.35 }, { t: 0.86, f: 0.95, h: 0.2, p: -PI / 2 }],
  },
};

const GRABBABLE = new Set(['idle', 'run', 'block', 'hit', 'taunt', 'strike', 'ropebounce']);
const SOLID = new Set(['idle', 'run', 'block', 'hit', 'taunt', 'strike', 'grapple', 'grappled', 'throw', 'ropebounce', 'getup', 'victory', 'lobby']);
const STANDING = new Set(['idle', 'run', 'block', 'hit', 'taunt', 'strike', 'grapple', 'grappled', 'throw', 'ropebounce', 'pinning', 'victory']);

const angDiff = (a, b) => { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };
const ease = x => x * x * (3 - 2 * x);

export class Wrestler {
  constructor(match, player, rig) {
    this.m = match; this.player = player; this.rig = rig;
    this.pos = new THREE.Vector2(); this.kv = new THREE.Vector2(); // position (x,z) and knockback velocity
    this.yaw = 0; this.y = RING_H;
    this.hp = 100; this.sp = 0;
    this.state = 'idle'; this.st = 0; this.move = null;
    this.hitSet = new Set(); this.queued = null;
    this.partner = null;
    this.downTime = 0; this.getupDur = 0.75; this.stun = 0;
    this.escape = 0; this.kickout = 0; this.mashFx = 0;
    this.invuln = 0; this.eliminated = false;
    this.walkPhase = 0; this.walkAmt = 0; this.momentum = 0;
    this.flight = null; this.flightPitch = 0; this.flightH = 0;
    this.sub = null; this.knees = 0;
    this.seed = Math.random() * 10;
    this.place = 0;
  }
  get name() { return this.player.name; }
  fwd(out = new THREE.Vector2()) { return out.set(Math.sin(this.yaw), Math.cos(this.yaw)); }
  angleTo(o) { return Math.atan2(o.x - this.pos.x, o.y - this.pos.y); }
  // centre of the body (shifted toward the torso when lying on the back)
  bodyCentre(out = new THREE.Vector2()) {
    const lying = this.state === 'down' || this.state === 'pinned' || (this.state === 'getup' && this.st < 0.3);
    const k = lying ? -0.55 : 0;
    return out.set(this.pos.x + Math.sin(this.yaw) * k, this.pos.y + Math.cos(this.yaw) * k);
  }
  isActive() { return !this.eliminated; }

  setState(s, move = null) {
    this.state = s; this.st = 0; this.move = move; this.hitSet.clear(); this.queued = null;
  }

  // ---------- per-frame ----------
  update(dt, inp) {
    this.st += dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.mashFx = Math.max(0, this.mashFx - dt * 3);
    if (inp.mash) this.mashFx = Math.min(1, this.mashFx + inp.mash * 0.5);
    const m = this.m;
    const pressed = b => (inp.pressed & b) !== 0;
    const held = b => (inp.held & b) !== 0;
    const mag = Math.min(1, Math.hypot(inp.x, inp.y));
    const dir = mag > 0.15 ? Math.atan2(inp.x, -inp.y) : null; // stick up = away from camera (-z)

    let moveSpeed = 0;
    switch (this.state) {
      case 'idle': {
        if (pressed(BTN.TAUNT)) { this.setState('taunt', MOVES.taunt); m.emit('taunt', { w: this }); break; }
        if (pressed(BTN.STRIKE)) { this.tryStrike(); break; }
        if (pressed(BTN.GRAPPLE)) { this.tryGrapple(); break; }
        if (held(BTN.BLOCK)) { this.setState('block'); break; }
        if (dir !== null) {
          this.turnToward(dir, 14, dt);
          moveSpeed = 2.5 * mag;
          if (held(BTN.RUN) && mag > 0.35) { this.setState('run'); this.momentum = 0.25; }
        } else {
          const t = m.nearestOpponent(this, 2.6, true);
          if (t) this.turnToward(this.angleTo(t.pos), 5, dt);
        }
        break;
      }
      case 'run': {
        if (dir !== null) this.turnToward(dir, 3.2, dt);
        this.momentum -= dt;
        moveSpeed = 5.3;
        if (pressed(BTN.STRIKE)) { this.setState('strike', MOVES.clothesline); m.emit('whoosh', { w: this }); break; }
        if (pressed(BTN.GRAPPLE)) { this.tryGrapple(); break; }
        if (!held(BTN.RUN) && this.momentum <= 0) this.setState('idle');
        break;
      }
      case 'ropebounce': {
        moveSpeed = 1.0;
        if (this.st > 0.22) { this.setState('run'); this.momentum = 0.6; }
        break;
      }
      case 'block': {
        if (!held(BTN.BLOCK) && this.st > 0.12) this.setState('idle');
        else if (pressed(BTN.GRAPPLE)) this.tryGrapple();
        break;
      }
      case 'strike': {
        const mv = this.move;
        if (mv.name === 'clothesline') moveSpeed = 3.6 * (1 - this.st / mv.dur);
        const prev = this.st - dt;
        if (mv.hitAt !== undefined && prev < mv.hitAt && this.st >= mv.hitAt) this.strikeHit(mv);
        if (mv.hitFrom !== undefined && this.st >= mv.hitFrom && this.st <= mv.hitTo) this.strikeHit(mv);
        if (pressed(BTN.STRIKE) && mv.next && this.st > mv.hitAt * 0.6) this.queued = mv.next;
        if (this.st >= mv.dur * (this.queued ? 0.82 : 1)) {
          if (this.queued) { const q = MOVES[this.queued]; this.setState('strike', q); this.aim(1.6, 1.4); m.emit('whoosh', { w: this }); }
          else this.setState('idle');
        }
        break;
      }
      case 'taunt': {
        if (this.st >= this.move.dur) { this.addSp(this.rig.look && this.rig.look.signature ? 40 : 30); m.emit('tauntDone', { w: this }); this.setState('idle'); }
        break;
      }
      case 'grapple': {
        const v = this.partner;
        if (!v || v.state !== 'grappled') { this.setState('idle'); this.partner = null; break; }
        // push the stick sideways to turn with your opponent (pulling back is saved for the suplex)
        if (dir !== null && mag > 0.45 && !this.sub && Math.abs(angDiff(this.yaw, dir)) < 2.0) this.turnToward(dir, 2.6, dt);
        if (this.sub) {
          this.sub.t += dt;
          if (!this.sub.hit && this.sub.t >= 0.13) {
            this.sub.hit = true;
            v.damage(3, this); v.escape = Math.max(0, v.escape - 0.12);
            m.emit('hit', { w: v, by: this, power: 0.6, at: v.rig.chestWorld() });
          }
          if (this.sub.t >= 0.32) this.sub = null;
        } else if (pressed(BTN.STRIKE) && this.knees < 3) { this.sub = { t: 0, hit: false }; this.knees++; }
        else if (pressed(BTN.GRAPPLE) && this.st > 0.12) {
          // pulling the stick away from your opponent changes the move
          const back = dir !== null && Math.abs(angDiff(this.yaw, dir)) > 2.1;
          if (this.sp >= 100) { if (back) this.startThrow('bomb'); else this.smallPackage(); break; }
          this.startThrow(back ? 'suplex' : 'slam');
          break;
        }
        if (this.st > 3.2) { this.releaseGrapple(); break; }
        this.placeVictim(v);
        break;
      }
      case 'grappled': {
        if (!this.partner || this.partner.state !== 'grapple') { this.setState('idle'); this.partner = null; break; }
        if (inp.mash) this.escape += inp.mash * 0.085 * (0.55 + this.hp / 100 * 0.8);
        if (this.escape >= 1) {
          const a = this.partner;
          a.partner = null; this.partner = null;
          a.setState('hit'); a.stun = 0.45; a.kv.copy(a.fwd()).multiplyScalar(-2.2);
          this.setState('idle'); this.invuln = 0.3;
          m.emit('escape', { w: this, from: a });
        }
        break;
      }
      case 'throw': {
        if (this.st >= this.move.dur) {
          if (this.move.name === 'suplex') { this.setState('down'); this.downTime = 0.25; }
          else this.setState('idle');
        }
        break;
      }
      case 'airborne': {
        this.updateFlight(dt);
        break;
      }
      case 'hit': {
        if (this.st >= this.stun) this.setState('idle');
        break;
      }
      case 'down': {
        if (inp.mash) this.downTime -= inp.mash * 0.09;
        if (this.st >= this.downTime) { this.setState('getup'); this.getupDur = 0.75; this.invuln = 0.75; }
        break;
      }
      case 'getup': {
        if (this.st >= this.getupDur) { this.setState('idle'); this.invuln = 0.5; }
        break;
      }
      case 'pinning': {
        const v = this.partner;
        if (!v || v.state !== 'pinned') { this.partner = null; this.setState('idle'); break; }
        this.placePinner(v);
        break;
      }
      case 'pinned': {
        if (!this.partner || this.partner.state !== 'pinning') { this.partner = null; this.setState('down'); this.downTime = 0.6; break; }
        const pin = this.m.pin && this.m.pin.v === this ? this.m.pin : null;
        const mul = pin && pin.pkg ? 0.5 : 1;        // the Small Package is very hard to escape
        if (inp.mash) this.kickout += inp.mash * 0.11 * (0.18 + this.hp / 100) * mul;
        this.kickout = Math.max(0, this.kickout - dt * 0.18);
        if (this.hp > (pin && pin.pkg ? 88 : 65) && this.st > 0.9) this.kickout = 1;
        if (this.kickout >= 1) this.kickOut();
        break;
      }
      case 'eliminated': {
        this.updateElim(dt);
        break;
      }
    }

    // ---------- movement ----------
    if (this.state !== 'airborne' && this.state !== 'eliminated') {
      const f = this.fwd();
      this.pos.x += (f.x * moveSpeed + this.kv.x) * dt;
      this.pos.y += (f.y * moveSpeed + this.kv.y) * dt;
      this.kv.multiplyScalar(Math.exp(-6 * dt));
      this.walkAmt += ((moveSpeed > 0.1 ? Math.min(1, moveSpeed / 2.5) : 0) - this.walkAmt) * Math.min(1, dt * 10);
      this.walkPhase += dt * (moveSpeed > 3 ? 11 : 7.5) * Math.max(0.3, this.walkAmt);
      this.bounds();
    }
  }

  turnToward(target, rate, dt) {
    const d = angDiff(this.yaw, target);
    const step = rate * dt;
    this.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
  }

  // snap facing to the closest opponent in front (aim assist)
  aim(range, arc) {
    let best = null, bd = 1e9;
    for (const o of this.m.opponents(this)) {
      if (!STANDING.has(o.state)) continue;
      const d = o.pos.distanceTo(this.pos);
      if (d > range) continue;
      if (Math.abs(angDiff(this.yaw, this.angleTo(o.pos))) > arc) continue;
      if (d < bd) { bd = d; best = o; }
    }
    if (best) this.yaw = this.angleTo(best.pos);
    return best;
  }

  bounds() {
    if (this.state === 'run') {
      const out = Math.abs(this.pos.x) > LIM || Math.abs(this.pos.y) > LIM;
      if (out) {
        const f = this.fwd();
        let side = -1;
        if (this.pos.x > LIM && f.x > 0) { this.yaw = Math.atan2(-f.x, f.y); side = 1; }
        else if (this.pos.x < -LIM && f.x < 0) { this.yaw = Math.atan2(-f.x, f.y); side = 3; }
        else if (this.pos.y > LIM && f.y > 0) { this.yaw = Math.atan2(f.x, -f.y); side = 0; }
        else if (this.pos.y < -LIM && f.y < 0) { this.yaw = Math.atan2(f.x, -f.y); side = 2; }
        if (side >= 0) { this.setState('ropebounce'); this.m.emit('rope', { w: this, side, x: this.pos.x, z: this.pos.y, power: 1 }); }
      }
    }
    const lim = (this.state === 'down' || this.state === 'pinned') ? LIM + 0.15 : LIM;
    for (const k of ['x', 'y']) {
      if (Math.abs(this.pos[k]) > lim) {
        if (Math.abs(this.kv[k]) > 1.2 && Math.sign(this.kv[k]) === Math.sign(this.pos[k])) {
          this.m.emit('rope', { w: this, side: this.m.arena.sideFor(this.pos.x, this.pos.y), x: this.pos.x, z: this.pos.y, power: Math.min(1, Math.abs(this.kv[k]) / 4) });
          this.kv[k] *= -0.4;
        }
        this.pos[k] = Math.sign(this.pos[k]) * lim;
      }
    }
  }

  addSp(n) {
    const before = this.sp;
    this.sp = Math.min(100, this.sp + n);
    if (before < 100 && this.sp >= 100) this.m.emit('finisherReady', { w: this });
  }

  damage(n, by, spGain = 1.6) {
    this.hp = Math.max(0, this.hp - n);
    this.addSp(n * 0.6);
    if (by) by.addSp(n * spGain);
  }

  // ---------- strikes ----------
  tryStrike() {
    const standing = this.aim(1.6, 1.3);
    if (!standing) {
      const g = this.m.downedNear(this, 1.6);
      if (g) {
        this.yaw = this.angleTo(g.bodyCentre());
        this.setState('strike', MOVES.stomp);
        return;
      }
    }
    this.setState('strike', MOVES.jab);
    this.m.emit('whoosh', { w: this });
  }

  strikeHit(mv) {
    const me = this;
    const targets = [];
    for (const o of this.m.opponents(this)) {
      if (this.hitSet.has(o)) continue;
      if (mv.ground) {
        if (o.state !== 'down' && o.state !== 'pinned') continue;
        if (o.bodyCentre().distanceTo(this.pos) > mv.range) continue;
      } else {
        if (!STANDING.has(o.state)) continue;
        const d = o.pos.distanceTo(this.pos);
        if (d > mv.range) continue;
        if (Math.abs(angDiff(this.yaw, this.angleTo(o.pos))) > mv.arc) continue;
      }
      targets.push(o);
    }
    if (mv.single && targets.length > 1) targets.sort((a, b) => a.pos.distanceTo(me.pos) - b.pos.distanceTo(me.pos)).length = 1;
    for (const o of targets) { this.hitSet.add(o); o.takeHit(this, mv); }
  }

  takeHit(att, mv) {
    const m = this.m;
    if (this.invuln > 0 || this.eliminated) return;
    if (this.state === 'airborne' || this.state === 'getup') return;
    const dirToAtt = this.angleTo(att.pos);
    if (this.state === 'block' && !mv.ground && Math.abs(angDiff(this.yaw, dirToAtt)) < 1.7) {
      const push = new THREE.Vector2(this.pos.x - att.pos.x, this.pos.y - att.pos.y).normalize().multiplyScalar(0.8 + (mv.push || 0) * 0.3);
      this.kv.add(push);
      if (mv.name === 'clothesline') { att.setState('hit'); att.stun = 0.4; }
      m.emit('block', { w: this, by: att, at: this.rig.chestWorld() });
      return;
    }
    this.breakHolds();
    this.damage(mv.dmg, att);
    const at = mv.ground ? this.rig.chestWorld() : this.rig.chestWorld();
    if (mv.ground) {
      if (this.state === 'pinned') this.setState('down');
      this.downTime = Math.max(this.downTime, this.st + 0.6);
      m.emit('hit', { w: this, by: att, power: 0.6, at, ground: true });
      return;
    }
    const kd = mv.knockdown || (mv.kdBelow && this.hp < mv.kdBelow);
    const away = new THREE.Vector2(this.pos.x - att.pos.x, this.pos.y - att.pos.y);
    if (away.lengthSq() < 1e-4) away.set(Math.sin(att.yaw), Math.cos(att.yaw));
    away.normalize();
    if (kd) {
      this.knockdown(att, 0);
      this.kv.copy(away).multiplyScalar(mv.push || 2);
      m.emit('hit', { w: this, by: att, power: 1.3, at, kd: true });
    } else {
      this.setState('hit'); this.stun = mv.stun;
      this.kv.copy(away).multiplyScalar(mv.push || 0.8);
      m.emit('hit', { w: this, by: att, power: mv.dmg / 6, at });
    }
  }

  knockdown(att, extraTime) {
    this.breakHolds();
    if (att) this.yaw = this.angleTo(att.pos);
    this.setState('down');
    this.downTime = 1.3 + (1 - this.hp / 100) * 2.2 + extraTime;
  }

  // release any grapple/pin this wrestler is part of
  breakHolds() {
    const p = this.partner;
    if (!p) return;
    const s = this.state;
    this.partner = null; p.partner = null;
    if (s === 'grapple' && p.state === 'grappled') p.setState('idle');
    else if (s === 'grappled' && p.state === 'grapple') { p.setState('hit'); p.stun = 0.3; }
    else if (s === 'pinning' && p.state === 'pinned') { p.setState('down'); p.downTime = 0.8; this.m.emit('pinBroken', { w: p }); }
    else if (s === 'pinned' && p.state === 'pinning') p.setState('idle');
  }

  // ---------- grapples ----------
  tryGrapple() {
    const g = this.m.downedNear(this, 1.65);
    const standing = this.aim(1.35, 1.1);
    if (!standing && g && g.state === 'down' && !g.partner) { this.startPin(g); return; }
    if (standing && GRABBABLE.has(standing.state) && standing.invuln <= 0 && standing.pos.distanceTo(this.pos) < 1.25) {
      this.startGrapple(standing); return;
    }
    this.setState('strike', MOVES.whiff);
    this.m.emit('whoosh', { w: this });
  }

  startGrapple(v) {
    v.breakHolds();
    this.setState('grapple'); this.partner = v; this.knees = 0; this.sub = null;
    v.setState('grappled'); v.partner = this; v.escape = 0;
    this.yaw = this.angleTo(v.pos);
    this.placeVictim(v);
    this.m.emit('grab', { w: this, v });
  }
  placeVictim(v) {
    const f = this.fwd();
    v.pos.set(this.pos.x + f.x * 0.75, this.pos.y + f.y * 0.75);
    v.yaw = this.yaw + PI;
    v.kv.set(0, 0);
  }
  releaseGrapple() {
    const v = this.partner;
    this.partner = null; this.setState('idle');
    if (v) { v.partner = null; v.setState('idle'); const f = this.fwd(); v.kv.set(f.x * 1.5, f.y * 1.5); }
  }

  // Signature move: a roll-up straight into a pin
  smallPackage() {
    const v = this.partner;
    this.partner = null; v.partner = null;
    this.sp = 0;
    v.damage(8, this, 0);
    v.yaw = this.yaw + PI;
    v.setState('down'); v.downTime = 2.5;
    v.rig.pose.pitch = -PI / 2 * 0.5;
    this.m.emit('smallPackage', { w: this, v });
    this.startPin(v, { pkg: true });
  }

  startThrow(kind) {
    const v = this.partner, T = THROWS[kind];
    this.partner = null; v.partner = null;
    this.setState('throw', T);
    if (kind === 'bomb') { this.sp = 0; this.m.emit('finisher', { w: this, v }); }
    v.setState('airborne');
    v.flight = { T, t: 0, ax: this.pos.x, az: this.pos.y, ayaw: this.yaw, by: this, sit: 0, h0: v.rig.H };
    v.yaw = this.yaw + PI + T.yawOff;
    v.kv.set(0, 0);
    v.updateFlight(0);
    this.m.emit('lift', { w: this, v, kind });
  }

  updateFlight(dt) {
    const F = this.flight; if (!F) return;
    F.t += dt;
    const T = F.T, keys = T.keys;
    let i = 0;
    while (i < keys.length - 2 && F.t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1];
    const u = ease(Math.max(0, Math.min(1, (F.t - a.t) / (b.t - a.t))));
    const ah = a.h === null ? F.h0 : a.h, bh = b.h === null ? F.h0 : b.h;
    const f = a.f + (b.f - a.f) * u;
    this.flightH = ah + (bh - ah) * u;
    this.flightPitch = a.p + (b.p - a.p) * u;
    F.sit = T.sit && F.t > T.sit[0] && F.t < T.sit[1] ? 1 : 0;
    const lim = ROPE - 0.3;
    this.pos.set(
      Math.max(-lim, Math.min(lim, F.ax + Math.sin(F.ayaw) * f)),
      Math.max(-lim, Math.min(lim, F.az + Math.cos(F.ayaw) * f)));
    if (F.t >= T.land) {
      this.flight = null;
      // normalise pitch so lying poses ease from the right angle
      this.rig.pose.pitch = -PI / 2;
      this.damage(T.dmg, F.by, T.name === 'bomb' ? 0 : 1.2);
      this.setState('down');
      this.downTime = 1.6 + (1 - this.hp / 100) * 2.4 + (T.name === 'bomb' ? 1.2 : 0.3);
      this.m.emit('slam', { w: this, by: F.by, power: T.power, kind: T.name, at: new THREE.Vector3(this.pos.x, RING_H, this.pos.y) });
    }
  }

  // ---------- pins ----------
  startPin(v, opts = {}) {
    this.setState('pinning'); this.partner = v;
    v.setState('pinned'); v.partner = this; v.kickout = 0;
    this.placePinner(v);
    this.m.startPin(this, v, opts);
  }
  placePinner(v) {
    const chest = v.bodyCentre();
    const side = new THREE.Vector2(Math.cos(v.yaw), -Math.sin(v.yaw));
    // pick the side we're already closest to
    const s = (this.pos.x - chest.x) * side.x + (this.pos.y - chest.y) * side.y >= 0 ? 1 : -1;
    const tx = chest.x + side.x * 0.55 * s, tz = chest.y + side.y * 0.55 * s;
    this.pos.x += (tx - this.pos.x) * 0.35; this.pos.y += (tz - this.pos.y) * 0.35;
    this.yaw = Math.atan2(chest.x - this.pos.x, chest.y - this.pos.y);
  }
  kickOut() {
    const p = this.partner;
    this.partner = null;
    this.setState('down'); this.downTime = 0.5;
    if (p) { p.partner = null; p.setState('idle'); p.kv.set(Math.sin(p.yaw) * -1.5, Math.cos(p.yaw) * -1.5); }
    this.m.emit('kickout', { w: this });
  }

  eliminate() {
    this.breakHolds();
    this.eliminated = true;
    this.setState('eliminated');
    // roll under the bottom rope to the nearest side, then drop to the floor
    const side = this.m.arena.sideFor(this.pos.x, this.pos.y);
    const n = [[0, 1], [1, 0], [0, -1], [-1, 0]][side];
    this.elimFrom = this.pos.clone();
    const along = side % 2 === 0 ? this.pos.x : this.pos.y;
    const outer = APRON + 0.75;
    this.elimTo = side % 2 === 0 ? new THREE.Vector2(along * 0.9, n[1] * outer) : new THREE.Vector2(n[0] * outer, along * 0.9);
    this.elimYaw = Math.atan2(-n[0], -n[1]); // face the ring
    this.elimT = 0; this.elimDur = 1.4; this.elimLift = 0;
  }
  updateElim(dt) {
    this.elimT += dt;
    const u = Math.min(1, this.elimT / this.elimDur);
    const e = ease(u);
    this.pos.lerpVectors(this.elimFrom, this.elimTo, e);
    const offEdge = Math.max(0, (u - 0.55) / 0.45);
    this.y = RING_H * (1 - ease(offEdge));
    this.elimLift = Math.sin(offEdge * PI) * 0.3;
    if (u >= 1) this.yaw = this.elimYaw;
  }

  // ---------- render ----------
  sync(dt, t) {
    const r = this.rig;
    r.root.position.set(this.pos.x, this.y, this.pos.y);
    r.root.rotation.y = this.yaw;
    const { P, speed, snap } = poseFor(this, t);
    r.apply(P, dt, speed, snap);
  }
}

// ---------- referee ----------
class Referee {
  constructor(match) {
    this.m = match;
    this.rig = new Rig({ outfit: 'ref', skin: '#e0ac85', color: '#111111', build: 'slim', seed: 77 });
    this.pos = new THREE.Vector2(0, -2.2); this.yaw = 0;
    this.state = 'ref'; this.st = 0; this.walkPhase = 0; this.walkAmt = 0; this.slapT = -1; this.seed = 3;
    this.move = null; this.mashFx = 0; this.y = RING_H;
  }
  update(dt) {
    this.st += dt;
    const m = this.m;
    let target = null, face = null;
    if (m.pin) {
      const v = m.pin.v;
      const chest = v.bodyCentre();
      const head = new THREE.Vector2(chest.x - Math.sin(v.yaw) * 0.85, chest.y - Math.cos(v.yaw) * 0.85);
      const side = new THREE.Vector2(Math.cos(v.yaw), -Math.sin(v.yaw));
      const pinSide = (m.pin.a.pos.x - chest.x) * side.x + (m.pin.a.pos.y - chest.y) * side.y >= 0 ? 1 : -1;
      target = new THREE.Vector2(head.x - side.x * 0.55 * pinSide, head.y - side.y * 0.55 * pinSide);
      face = head;
    } else if (m.winner) {
      const w = m.winner;
      target = new THREE.Vector2(w.pos.x + Math.cos(w.yaw) * 0.8, w.pos.y - Math.sin(w.yaw) * 0.8);
      face = new THREE.Vector2(0, 6);
    } else {
      const c = m.actionCentre();
      const ang = Math.atan2(c.x, c.y) + PI;
      target = new THREE.Vector2(Math.sin(ang) * 2.3, Math.cos(ang) * 2.3);
      face = c;
    }
    const d = target.distanceTo(this.pos);
    const spd = m.pin ? 6 : (d > 1.5 ? 2.6 : 1.4);
    let moving = 0;
    if (d > 0.08) {
      const step = Math.min(d, spd * dt);
      this.pos.x += (target.x - this.pos.x) / d * step; this.pos.y += (target.y - this.pos.y) / d * step;
      moving = step / dt;
    }
    // stay out of wrestlers' way
    for (const w of m.wrestlers) {
      if (w.eliminated || !SOLID.has(w.state)) continue;
      const dx = this.pos.x - w.pos.x, dz = this.pos.y - w.pos.y, dd = Math.hypot(dx, dz);
      if (dd < 0.7 && dd > 1e-3) { this.pos.x += dx / dd * (0.7 - dd); this.pos.y += dz / dd * (0.7 - dd); }
    }
    this.pos.x = Math.max(-LIM, Math.min(LIM, this.pos.x)); this.pos.y = Math.max(-LIM, Math.min(LIM, this.pos.y));
    const want = moving > 0.3 && d > 0.3 ? Math.atan2(target.x - this.pos.x, target.y - this.pos.y) : Math.atan2(face.x - this.pos.x, face.y - this.pos.y);
    let dy = want - this.yaw; while (dy > PI) dy -= 2 * PI; while (dy < -PI) dy += 2 * PI;
    this.yaw += dy * Math.min(1, dt * 8);
    this.walkAmt += ((moving > 0.1 ? Math.min(1, moving / 2.5) : 0) - this.walkAmt) * Math.min(1, dt * 10);
    this.walkPhase += dt * 8 * this.walkAmt;
    const s = m.pin && d < 0.5 ? 'refcount' : (m.winner && d < 0.4 ? 'refraise' : 'ref');
    if (s !== this.state) { this.state = s; this.st = 0; }
    if (m.pin) this.slapT = m.pin.t - m.pin.lastSlap; else this.slapT = -1;
  }
  sync(dt, t) {
    this.rig.root.position.set(this.pos.x, this.y, this.pos.y);
    this.rig.root.rotation.y = this.yaw;
    const { P, speed, snap } = poseFor(this, t);
    this.rig.apply(P, dt, speed, snap);
  }
}

// ---------- match ----------
export class Match {
  constructor(scene, arena) {
    this.scene = scene; this.arena = arena;
    this.wrestlers = [];
    this.events = [];
    this.pin = null;
    this.winner = null;
    this.over = false;
    this.ref = new Referee(this);
    this.ref.rig.addTo(scene);
    this.elimOrder = [];
  }
  emit(type, data) { this.events.push({ type, ...data }); }
  add(w) { this.wrestlers.push(w); w.rig.addTo(this.scene); }
  dispose() {
    for (const w of this.wrestlers) w.rig.removeFrom(this.scene);
    this.ref.rig.removeFrom(this.scene);
  }
  opponents(w) { return this.wrestlers.filter(o => o !== w && !o.eliminated); }
  active() { return this.wrestlers.filter(w => !w.eliminated); }
  nearestOpponent(w, range, standingOnly) {
    let best = null, bd = range;
    for (const o of this.opponents(w)) {
      if (standingOnly && !STANDING.has(o.state)) continue;
      const d = o.pos.distanceTo(w.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  downedNear(w, range) {
    let best = null, bd = range;
    for (const o of this.opponents(w)) {
      if (o.state !== 'down' && o.state !== 'pinned') continue;
      const d = o.bodyCentre().distanceTo(w.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  actionCentre() {
    const a = this.active();
    const c = new THREE.Vector2();
    if (!a.length) return c;
    for (const w of a) c.add(w.pos);
    return c.multiplyScalar(1 / a.length);
  }

  startPin(a, v, opts = {}) {
    // The Original JOE MASTER's pins are counted "totally clean and with no help at all" (i.e. fast).
    const clean = a.player && a.player.char === 'joe';
    this.pin = { a, v, t: 0, count: 0, lastSlap: -10, pkg: !!opts.pkg, clean, rate: clean ? 0.62 : 0.85 };
    this.emit('pinStart', { w: a, v, pkg: !!opts.pkg });
  }

  update(dt, inputs) {
    for (const w of this.wrestlers) w.update(dt, inputs.get(w) || NO_INPUT);
    // pin count
    if (this.pin) {
      const p = this.pin;
      if (p.a.state !== 'pinning' || p.v.state !== 'pinned' || p.a.partner !== p.v) this.pin = null;
      else {
        p.t += dt;
        const n = Math.floor(p.t / p.rate);
        if (n > p.count) {
          p.count = n; p.lastSlap = p.t;
          this.emit('count', { n, v: p.v, a: p.a, clean: p.clean });
          if (n >= 3) {
            const v = p.v, a = p.a;
            this.pin = null;
            a.partner = null; v.partner = null;
            a.setState('idle'); a.addSp(25);
            v.eliminate();
            this.elimOrder.push(v);
            this.emit('elim', { w: v, by: a, clean: p.clean, pkg: p.pkg });
          }
        }
      }
    }
    this.collide();
    this.ref.update(dt);
    // winner
    if (!this.over) {
      const a = this.active();
      if (a.length <= 1 && this.wrestlers.length > 1) {
        this.over = true;
        this.winner = a[0] || null;
        if (this.winner) { this.winner.breakHolds(); this.winner.setState('victory'); this.winner.yaw = Math.atan2(-this.winner.pos.x, 8 - this.winner.pos.y); }
        this.emit('win', { w: this.winner });
      }
    }
  }

  collide() {
    const ws = this.wrestlers;
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i], b = ws[j];
      if (a.eliminated || b.eliminated || !SOLID.has(a.state) || !SOLID.has(b.state)) continue;
      if (a.partner === b) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y, d = Math.hypot(dx, dz);
      const min = 0.72;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        const aw = a.state === 'grappled' || a.state === 'grapple' ? 0.2 : 1, bw = b.state === 'grappled' || b.state === 'grapple' ? 0.2 : 1;
        a.pos.x -= nx * push * aw; a.pos.y -= nz * push * aw;
        b.pos.x += nx * push * bw; b.pos.y += nz * push * bw;
      }
    }
  }

  sync(dt, t) {
    for (const w of this.wrestlers) w.sync(dt, t);
    this.ref.sync(dt, t);
  }
}

const NO_INPUT = { x: 0, y: 0, held: 0, pressed: 0, mash: 0 };
export { NO_INPUT, STANDING };

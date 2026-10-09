// CPU wrestler: produces the same input frames a phone would.
import { BTN, STANDING } from './game.js';

export class CpuBrain {
  constructor(w, level = 1) {
    this.w = w; this.level = level;
    this.cool = 0.6 + Math.random();
    this.mashRate = 4.5 + Math.random() * 3 + level;
    this.mashAcc = 0; this.hold = 0; this.holdBtn = 0; this.combo = 0; this.grabT = 0; this.runT = 0; this.wander = 0;
    this.target = null; this.retarget = 0;
  }
  frame(dt, match) {
    const w = this.w, out = { x: 0, y: 0, held: 0, pressed: 0, mash: 0 };
    this.cool -= dt; this.retarget -= dt;
    const mash = (rate) => {
      this.mashAcc += dt * rate; const n = Math.floor(this.mashAcc); this.mashAcc -= n;
      if (n) { out.mash = n; out.pressed |= BTN.STRIKE; }
    };
    const stickTo = (x, z) => {
      const dx = x - w.pos.x, dz = z - w.pos.y, d = Math.hypot(dx, dz) || 1;
      out.x = dx / d; out.y = -dz / d;
      return d;
    };

    switch (w.state) {
      case 'grappled': mash(this.mashRate * 0.9); return out;
      case 'pinned': mash(this.mashRate * (w.hp > 30 ? 1.1 : 0.8)); return out;
      case 'down': mash(this.mashRate * 0.5); return out;
      case 'grapple': {
        this.grabT += dt;
        if (this.grabT > 0.45 + Math.random() * 0.5) {
          this.grabT = 0;
          if (w.sp >= 100 || Math.random() < 0.7) {
            out.pressed |= BTN.GRAPPLE;
            // pull back = suplex (or MIC DROP with a full meter); neutral = slam (or SMALL PACKAGE)
            if (Math.random() < 0.45) { out.x = -Math.sin(w.yaw); out.y = Math.cos(w.yaw); }
          } else out.pressed |= BTN.STRIKE;
        }
        return out;
      }
      case 'eliminated': case 'victory': case 'airborne': case 'throw': case 'getup': case 'pinning': return out;
    }
    this.grabT = 0;

    if (this.hold > 0) { this.hold -= dt; out.held |= this.holdBtn; if (this.hold <= 0) this.holdBtn = 0; }

    // choose a target
    if (!this.target || this.target.eliminated || this.retarget <= 0) {
      this.retarget = 1.5 + Math.random() * 2;
      const opp = match.opponents(w);
      opp.sort((a, b) => score(w, a) - score(w, b));
      this.target = opp[0] || null;
    }
    const t = this.target;
    if (!t) return out;

    // react to an incoming strike by blocking sometimes
    for (const o of match.opponents(w)) {
      if (o.state === 'strike' && o.st < 0.08 && o.pos.distanceTo(w.pos) < 1.5 && Math.random() < 0.18 * this.level && w.state === 'idle') {
        out.held |= BTN.BLOCK; this.hold = 0.4; this.holdBtn = BTN.BLOCK; return out;
      }
    }

    if (w.state === 'strike' && this.combo > 0 && w.st > 0.12) { out.pressed |= BTN.STRIKE; this.combo--; }

    const downed = t.state === 'down' || t.state === 'pinned';
    if (downed) {
      const c = t.bodyCentre();
      const d = stickTo(c.x, c.y);
      if (d < 1.1) {
        out.x = out.y = 0;
        if (this.cool <= 0 && w.state === 'idle') {
          this.cool = 0.5 + Math.random() * 0.6;
          if (t.state === 'down' && !t.partner && (t.hp < 55 || Math.random() < 0.25) && t.st > 0.3) out.pressed |= BTN.GRAPPLE;
          else out.pressed |= BTN.STRIKE;
        }
      }
      return out;
    }

    const d = stickTo(t.pos.x, t.pos.y);
    if (!STANDING.has(t.state) && t.state !== 'getup') { // target busy (in the air etc.) - circle
      out.x *= 0.3; out.y *= 0.3;
      return out;
    }
    if (d > 3.2 && w.state === 'idle' && Math.random() < dt * 0.6) { this.runT = 1.2; }
    if (this.runT > 0) {
      this.runT -= dt; out.held |= BTN.RUN;
      if (w.state === 'run' && d < 1.4) { out.pressed |= BTN.STRIKE; this.runT = 0; }
      return out;
    }
    if (d < 1.05) {
      out.x *= 0.15; out.y *= 0.15;
      if (this.cool <= 0 && w.state === 'idle') {
        this.cool = (0.55 + Math.random() * 0.9) / this.level;
        const r = Math.random();
        if (t.state === 'block') out.pressed |= BTN.GRAPPLE;
        else if (r < 0.48) { out.pressed |= BTN.STRIKE; this.combo = Math.floor(Math.random() * 3); }
        else if (r < 0.85) out.pressed |= BTN.GRAPPLE;
        else { out.held |= BTN.BLOCK; this.hold = 0.5; this.holdBtn = BTN.BLOCK; }
      }
    } else if (d > 2.6 && w.sp < 100 && Math.random() < dt * 0.15 && w.state === 'idle') {
      out.x = out.y = 0; out.pressed |= BTN.TAUNT;
    }
    // a little sideways drift so CPUs don't beeline
    this.wander += dt;
    out.x += Math.sin(this.wander * 1.3 + w.seed) * 0.25;
    return out;
  }
}

function score(w, o) {
  let s = o.pos.distanceTo(w.pos);
  if (o.state === 'down') s -= 1.2 * (1 - o.hp / 100) + 0.5;
  if (o.state === 'pinning') s -= 1.5; // break up pins
  if (o.player.kind !== 'cpu') s -= 0.4; // prefer humans a little
  return s;
}

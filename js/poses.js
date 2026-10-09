// Procedural animation: turns a wrestler's state into joint targets for the Rig.
// Angle conventions (radians): sX = arm raised forward, sZ = arm out to the side, e = elbow bend,
// lX = leg raised forward, lZ = leg out, k = knee bend, tX = lean forward, pitch -PI/2 = lying on back.

const PI = Math.PI;
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => x * x * (3 - 2 * x);
// 0 -> 1 -> 0 envelope: rise until a, hold until b, fall until 1
function env(u, a, b) {
  if (u < a) return ease(u / a);
  if (u < b) return 1;
  return 1 - ease(clamp01((u - b) / (1 - b)));
}
const lerp = (a, b, t) => a + (b - a) * t;

function neutral(H) {
  return {
    hipH: H, pitch: 0, roll: 0, tX: 0, tY: 0, tZ: 0, hX: 0, hY: 0,
    sLX: 0, sLZ: 0.12, sRX: 0, sRZ: 0.12, eL: 0.15, eR: 0.15,
    lLX: 0, lLZ: 0.05, lRX: 0, lRZ: 0.05, kL: 0.05, kR: 0.05,
  };
}

function stance(P, t) {
  P.tX = 0.14; P.hX = -0.08;
  P.sLX = 0.8; P.sRX = 0.75; P.eL = 1.75; P.eR = 1.65; P.sLZ = 0.28; P.sRZ = 0.28;
  P.lLX = 0.12; P.lRX = 0.05; P.kL = 0.22; P.kR = 0.18; P.lLZ = 0.13; P.lRZ = 0.13;
  P.hipH -= 0.04 + 0.018 * Math.sin(t * 4.2);
}

function walk(P, ph, amt, run = false) {
  const s = Math.sin(ph), c = Math.cos(ph);
  const A = run ? 0.95 : 0.6;
  P.lLX += s * A * amt; P.lRX -= s * A * amt;
  P.kL += Math.max(0, c) * (run ? 1.4 : 0.9) * amt;
  P.kR += Math.max(0, -c) * (run ? 1.4 : 0.9) * amt;
  P.hipH += (Math.abs(c) * 0.05 - 0.03) * amt;
  P.sLX -= s * (run ? 0.9 : 0.3) * amt; P.sRX += s * (run ? 0.9 : 0.3) * amt;
  P.tY = s * 0.12 * amt;
}

function flail(P, t, k = 1) {
  P.sLZ = 1.1 + Math.sin(t * 13) * 0.5 * k; P.sRZ = 1.1 + Math.sin(t * 11 + 1) * 0.5 * k;
  P.sLX = 0.6 + Math.sin(t * 9) * 0.6 * k; P.sRX = 0.6 + Math.cos(t * 10) * 0.6 * k;
  P.eL = 0.6; P.eR = 0.6;
  P.lLX = 0.4 + Math.sin(t * 12) * 0.4 * k; P.lRX = 0.4 + Math.cos(t * 12) * 0.4 * k;
  P.kL = 0.7; P.kR = 0.5; P.lLZ = 0.25; P.lRZ = 0.25;
}

function lying(P, t, H) {
  P.pitch = -PI / 2; P.hipH = 0.2 * (H / 0.95) * 0.9 + 0.02;
  P.sLZ = 1.05 + Math.sin(t * 1.3) * 0.1; P.sRZ = 0.95; P.sLX = 0.1; P.sRX = 0.2;
  P.eL = 0.4; P.eR = 0.3; P.lLZ = 0.22; P.lRZ = 0.16; P.kL = 0.5 + Math.sin(t * 0.9) * 0.2; P.kR = 0.1;
  P.lLX = 0.25; P.hY = Math.sin(t * 0.7) * 0.4; P.tY = Math.sin(t * 0.8) * 0.08;
}

function kneel(P, H, lean = 1.2) {
  P.hipH = 0.56 * (H / 0.95);
  P.lLX = 0.05; P.kL = 1.55; P.lRX = 1.1; P.kR = 1.35;
  P.tX = lean; P.hX = -0.5;
}

// JOE MASTER's signature pose from his entrance photo: one hand swept behind the head,
// the other arm thrown out wide, chin up to the lights.
function joeSignature(P, k, t) {
  const L = (key, v) => { P[key] = lerp(P[key], v, k); };
  L('sRX', 2.45); L('sRZ', 0.75); L('eR', 1.95);
  L('sLX', 0.3); L('sLZ', 1.38 + Math.sin(t * 2) * 0.03); L('eL', 0.06);
  L('hX', -0.58); L('hY', 0.32); L('tX', -0.16); L('tY', 0.16); L('tZ', -0.06);
  L('lLZ', 0.2); L('lRZ', 0.16); L('kL', 0.12); L('kR', 0.08); L('lLX', 0.06); L('lRX', -0.04);
}
const isJoe = w => !!(w.rig && w.rig.look && w.rig.look.signature === 'joe');

// returns { P, speed, snap }
export function poseFor(w, t) {
  const H = w.rig.H;
  const P = neutral(H);
  const st = w.st, m = w.move;
  const u = m ? clamp01(st / m.dur) : 0;
  let speed = 14, snap = null;

  switch (w.state) {
    case 'idle': {
      stance(P, t + w.seed);
      if (w.walkAmt > 0.05) walk(P, w.walkPhase, w.walkAmt);
      break;
    }
    case 'lobby': {
      stance(P, t + w.seed);
      const cyc = (t * 0.35 + w.seed) % 3;
      if (isJoe(w)) { joeSignature(P, cyc < 2 ? env(cyc / 2, 0.15, 0.85) : 0, t); break; }
      if (cyc < 1) { // flex
        const k = env(cyc, 0.2, 0.8);
        P.sLZ = lerp(P.sLZ, 1.45, k); P.sRZ = lerp(P.sRZ, 1.45, k); P.sLX = lerp(P.sLX, 0.1, k); P.sRX = lerp(P.sRX, 0.1, k);
        P.eL = lerp(P.eL, 2.1, k); P.eR = lerp(P.eR, 2.1, k); P.hX = -0.3 * k; P.tX = 0.14 - 0.25 * k;
      }
      break;
    }
    case 'run': {
      P.tX = 0.38; P.hX = -0.2; P.eL = 1.6; P.eR = 1.6; P.sLX = 0.3; P.sRX = 0.3; P.sLZ = 0.2; P.sRZ = 0.2;
      walk(P, w.walkPhase, 1, true);
      speed = 18;
      break;
    }
    case 'ropebounce': {
      P.tX = -0.45; P.hX = -0.3; P.sLX = -0.5; P.sRX = -0.5; P.sLZ = 0.5; P.sRZ = 0.5; P.eL = 0.3; P.eR = 0.3;
      P.kL = 0.3; P.kR = 0.3;
      speed = 22;
      break;
    }
    case 'block': {
      P.tX = 0.28; P.hX = 0.25; P.sLX = 1.95; P.sRX = 1.9; P.eL = 2.35; P.eR = 2.3; P.sLZ = -0.15; P.sRZ = -0.15;
      P.kL = 0.38; P.kR = 0.34; P.lLX = 0.15; P.hipH -= 0.08; P.lLZ = 0.15; P.lRZ = 0.15;
      speed = 22;
      break;
    }
    case 'strike': {
      stance(P, t);
      speed = 28;
      const name = m.name;
      if (name === 'jab') {
        const e = env(u, 0.32, 0.45);
        P.sRX = lerp(0.75, 1.55, e); P.eR = lerp(1.65, 0.08, e); P.sRZ = lerp(0.28, 0.08, e); P.tY = -0.4 * e; P.tX = 0.22;
        P.lRX = -0.1 * e;
      } else if (name === 'hook') {
        const e = env(u, 0.38, 0.5);
        P.sLX = lerp(0.8, 1.3, e); P.sLZ = lerp(0.28, 0.95, e * (1 - e) * 4 * 0.6 + e * 0.2); P.eL = lerp(1.75, 0.5, e);
        P.tY = lerp(-0.35, 0.55, ease(clamp01(u / 0.45))) * (u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15); P.tX = 0.2;
      } else if (name === 'kick') {
        const chamber = env(u, 0.2, 0.32), ext = env(u, 0.4, 0.55);
        P.lRX = 1.25 * chamber + 0.25 * ext; P.kR = 1.6 * chamber * (1 - ext) + 0.1;
        P.tX = -0.28 * chamber; P.sLZ = 0.7; P.sRZ = 0.7; P.sLX = 0.3; P.sRX = 0.3; P.eL = 1.0; P.eR = 1.0;
        P.kL = 0.25;
      } else if (name === 'clothesline') {
        walk(P, w.walkPhase, 0.7, true);
        const e = env(u, 0.15, 0.6);
        P.sRZ = lerp(0.3, 1.55, e); P.sRX = lerp(0.3, 0.35, e); P.eR = lerp(1.5, 0.05, e); P.tY = -0.35 * e; P.tX = 0.25;
      } else if (name === 'stomp') {
        const lift = u < 0.45 ? ease(u / 0.45) : 1 - ease(clamp01((u - 0.45) / 0.15));
        P.lRX = 1.0 * lift + 0.15; P.kR = 1.5 * lift + 0.1; P.tX = 0.3; P.hX = 0.45; P.sLZ = 0.45; P.sRZ = 0.45;
        P.hipH += 0.03 * lift;
      } else if (name === 'knee') {
        const e = env(u, 0.35, 0.5);
        P.sLX = 1.3; P.sRX = 1.3; P.eL = 0.9; P.eR = 0.9; P.sLZ = 0.05; P.sRZ = 0.05; P.tX = 0.35 - 0.2 * e;
        P.lRX = 1.35 * e; P.kR = 1.8 * e + 0.15;
      } else if (name === 'whiff') {
        const e = env(u, 0.3, 0.55);
        P.sLX = lerp(0.8, 1.45, e); P.sRX = lerp(0.8, 1.45, e); P.eL = lerp(1.7, 0.35, e); P.eR = lerp(1.7, 0.35, e);
        P.sLZ = lerp(0.28, 0.05, e); P.sRZ = lerp(0.28, 0.05, e); P.tX = 0.15 + 0.3 * e; P.lLX = 0.35 * e; P.kL = 0.4 * e + 0.2;
      }
      break;
    }
    case 'taunt': {
      stance(P, t);
      const k = env(u, 0.2, 0.8);
      if (isJoe(w)) { joeSignature(P, k, t); speed = 12; break; }
      const flex = 0.08 * Math.sin(st * 14);
      P.sLZ = lerp(P.sLZ, 1.5, k); P.sRZ = lerp(P.sRZ, 1.5, k); P.sLX = lerp(P.sLX, 0.15, k); P.sRX = lerp(P.sRX, 0.15, k);
      P.eL = lerp(P.eL, 2.15 + flex, k); P.eR = lerp(P.eR, 2.15 - flex, k); P.hX = -0.38 * k; P.tX = lerp(0.14, -0.18, k);
      P.lLZ = 0.22; P.lRZ = 0.22;
      speed = 16;
      break;
    }
    case 'grapple': case 'grappled': {
      const vic = w.state === 'grappled';
      P.sLX = 1.3; P.sRX = 1.3; P.eL = 0.95; P.eR = 0.95; P.sLZ = 0.05; P.sRZ = 0.05;
      P.tX = vic ? 0.55 : 0.3; P.hX = vic ? 0.35 : 0.1; P.kL = 0.3; P.kR = 0.3; P.lLX = 0.2; P.lLZ = 0.16; P.lRZ = 0.16;
      P.tY = Math.sin(st * 9) * 0.05;
      if (vic && w.mashFx > 0) { P.tY += Math.sin(st * 40) * 0.12 * w.mashFx; }
      if (!vic && w.sub) { // knee strike inside the hold
        const e = env(clamp01(w.sub.t / 0.32), 0.4, 0.55);
        P.lRX = 1.35 * e; P.kR = 1.8 * e + 0.15; P.tX = 0.3 - 0.15 * e;
      }
      speed = 16;
      break;
    }
    case 'throw': {
      speed = 18;
      const name = m.name;
      if (name === 'slam') {
        const lift = ease(clamp01(u / 0.4)), slam = ease(clamp01((u - 0.5) / 0.2));
        P.sLX = lerp(1.3, 2.75, lift) - 1.5 * slam; P.sRX = P.sLX; P.eL = lerp(0.9, 0.5, lift); P.eR = P.eL;
        P.sLZ = 0.25; P.sRZ = 0.25;
        P.tX = lerp(0.3, -0.15, lift) + 0.7 * slam; P.kL = 0.3 + 0.6 * slam; P.kR = 0.3 + 0.6 * slam; P.lLX = 0.2 + 0.5 * slam; P.lRX = 0.5 * slam;
        P.hipH -= 0.12 * slam + 0.05 * (1 - lift);
      } else if (name === 'suplex') {
        const lift = ease(clamp01(u / 0.35)), fall = ease(clamp01((u - 0.45) / 0.3));
        P.sLX = lerp(1.3, 2.6, lift); P.sRX = P.sLX; P.eL = 0.7; P.eR = 0.7; P.sLZ = 0.3; P.sRZ = 0.3;
        P.tX = lerp(0.3, -0.7, lift); P.hX = -0.4;
        P.pitch = -PI / 2 * fall; P.hipH = lerp(H - 0.05, 0.22, fall); P.kL = 0.3 + 0.6 * fall; P.kR = 0.3 + 0.6 * fall;
        snap = ['pitch', 'hipH'];
      } else if (name === 'bomb') {
        const lift = ease(clamp01(u / 0.5)), slam = ease(clamp01((u - 0.62) / 0.18));
        P.sLX = lerp(1.3, 2.95, lift) - 1.3 * slam; P.sRX = P.sLX; P.eL = 0.35; P.eR = 0.35; P.sLZ = 0.35; P.sRZ = 0.35;
        P.lLZ = 0.32; P.lRZ = 0.32; P.tX = lerp(0.3, -0.1, lift) + 0.8 * slam; P.hX = -0.3 + 0.6 * slam;
        P.hipH -= 0.48 * slam; P.lLX = 1.0 * slam; P.lRX = 1.0 * slam; P.kL = 1.5 * slam + 0.2; P.kR = 1.5 * slam + 0.2;
      }
      break;
    }
    case 'airborne': {
      flail(P, st, 1);
      if (w.flight && w.flight.sit > 0) { P.lLX = 1.45; P.lRX = 1.45; P.kL = 0.6; P.kR = 0.6; P.tX = 0.2; }
      P.pitch = w.flightPitch; P.hipH = w.flightH;
      snap = ['pitch', 'hipH'];
      speed = 20;
      break;
    }
    case 'hit': {
      stance(P, t);
      const k = 1 - clamp01(st / Math.max(0.15, w.stun));
      P.tX = 0.14 - 0.55 * k; P.hX = -0.45 * k; P.sLZ = 0.28 + 0.5 * k; P.sRZ = 0.28 + 0.5 * k;
      P.eL = 1.75 - 0.9 * k; P.eR = 1.65 - 0.9 * k; P.tZ = Math.sin(st * 20) * 0.08 * k;
      P.lLX = -0.15 * k; P.kR = 0.4 * k;
      speed = 26;
      break;
    }
    case 'down': case 'pinned': {
      lying(P, st + w.seed, H);
      if (w.state === 'pinned' || w.mashFx > 0) {
        const kick = w.mashFx;
        P.kL += Math.abs(Math.sin(st * 16)) * 0.9 * kick; P.lLX += Math.abs(Math.sin(st * 16)) * 0.5 * kick;
        P.kR += Math.abs(Math.cos(st * 14)) * 0.8 * kick;
        P.sRX += Math.abs(Math.sin(st * 12)) * 0.6 * kick;
      }
      speed = w.st < 0.6 ? 9 : 6;
      break;
    }
    case 'getup': {
      const g = ease(clamp01(st / w.getupDur));
      P.pitch = lerp(-PI / 2, 0, ease(clamp01(g * 1.4)));
      P.hipH = lerp(0.24, H - 0.05, ease(clamp01((g - 0.25) / 0.75)));
      const knees = Math.sin(g * PI);
      P.kL = 1.6 * knees + 0.1; P.kR = 1.4 * knees + 0.1; P.lLX = 1.2 * knees; P.lRX = 0.9 * knees;
      P.tX = 0.6 * knees; P.sLX = 0.6; P.sRX = 0.4; P.sLZ = 0.4; P.sRZ = 0.4; P.eL = 0.8; P.eR = 0.8;
      snap = ['pitch', 'hipH'];
      speed = 18;
      break;
    }
    case 'pinning': {
      kneel(P, H, 1.25);
      P.sLX = 1.55; P.sRX = 1.55; P.eL = 0.35; P.eR = 0.35; P.sLZ = 0.35; P.sRZ = 0.35;
      speed = 12;
      break;
    }
    case 'eliminated': {
      if (w.elimT < w.elimDur) { lying(P, st, H); P.hipH = 0.2 + w.elimLift; snap = ['hipH']; }
      else { // slumped at ringside
        P.hipH = 0.3; P.lLX = 1.45; P.lRX = 1.35; P.kL = 0.3; P.kR = 0.6; P.tX = 0.35 + Math.sin(st) * 0.05; P.hX = 0.55;
        P.sLZ = 0.35; P.sRZ = 0.35; P.sLX = 0.4; P.sRX = 0.5; P.eL = 0.6; P.eR = 0.5; P.lLZ = 0.25; P.lRZ = 0.3;
      }
      speed = 8;
      break;
    }
    case 'entrance': { // posing on the entrance
      stance(P, t);
      joeSignature(P, env(clamp01(st / 2.6), 0.2, 0.85), t);
      speed = 8;
      break;
    }
    case 'victory': {
      if (isJoe(w) && (t % 6) < 3.2) { stance(P, t); joeSignature(P, env(((t % 6) / 3.2), 0.15, 0.85), t); speed = 9; break; }
      const b = Math.abs(Math.sin(t * 5));
      P.sLX = 2.9; P.sRX = 2.9; P.sLZ = 0.35; P.sRZ = 0.35; P.eL = 0.15 + 0.3 * b; P.eR = 0.15 + 0.3 * (1 - b);
      P.hX = -0.35; P.tX = -0.12; P.hipH += 0.05 * b; P.lLZ = 0.15; P.lRZ = 0.15; P.kL = 0.1 * b; P.kR = 0.1 * b;
      speed = 10;
      break;
    }
    // ---------- referee ----------
    case 'ref': {
      P.sLZ = 0.18; P.sRZ = 0.18; P.eL = 0.3; P.eR = 0.3; P.tX = 0.08;
      if (w.walkAmt > 0.05) walk(P, w.walkPhase, w.walkAmt);
      break;
    }
    case 'refcount': {
      kneel(P, H, 0.55);
      P.lRX = 0.1; P.kR = 1.55; // both knees down
      P.pitch = 0.35; P.hX = -0.6;
      const s = w.slapT;          // seconds since last mat slap
      const up = s < 0 ? 1 : clamp01(s / 0.25);
      const down = s >= 0 && s < 0.08 ? 1 : 0;
      P.sRX = down ? 1.35 : lerp(1.4, 2.8, up); P.eR = 0.1; P.sRZ = 0.2;
      P.sLX = 1.0; P.eL = 0.3; P.sLZ = 0.35;
      speed = down ? 40 : 16;
      break;
    }
    case 'refraise': {
      P.sRX = 2.95; P.eR = 0.05; P.sRZ = 0.1; P.sLZ = 0.2; P.eL = 0.3; P.hX = -0.2;
      speed = 10;
      break;
    }
  }
  return { P, speed, snap };
}

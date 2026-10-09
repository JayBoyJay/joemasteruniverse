// Low-poly wrestler model with a photo (or cartoon) face and a procedural pose system.
import * as THREE from 'three';
import { canvasTex, drawDefaultFace, drawPhotoFace, shade } from './tex.js';

export const BUILDS = {
  slim: { w: 0.86, arm: 0.86, leg: 0.92, belly: 0.9, head: 1.12 },
  average: { w: 1.0, arm: 1.0, leg: 1.0, belly: 1.0, head: 1.12 },
  buff: { w: 1.14, arm: 1.42, leg: 1.04, belly: 0.92, head: 1.06 },
  heavy: { w: 1.28, arm: 1.18, leg: 1.12, belly: 1.45, head: 1.1 },
};

export const POSE_KEYS = ['hipH', 'pitch', 'roll', 'tX', 'tY', 'tZ', 'hX', 'hY', 'sLX', 'sLZ', 'sRX', 'sRZ', 'eL', 'eR', 'lLX', 'lLZ', 'lRX', 'lRZ', 'kL', 'kR'];

const HIP_H = 0.95;

export class Rig {
  constructor({ skin = '#e0ac85', color = '#e63946', build = 'average', faceImg = null, seed = 0, outfit = 'trunks', look = null } = {}) {
    this.look = look;   // signature character outfit (see characters.js)
    this.skin = skin; this.color = color; this.buildName = BUILDS[build] ? build : 'average';
    this.B = BUILDS[this.buildName];
    this.outfit = outfit;
    this.H = HIP_H;
    this.seed = seed;
    this.root = new THREE.Group();
    this.body = new THREE.Group();          // pivots at the hips; pitched to lie down
    this.root.add(this.body);
    this.pose = {};
    for (const k of POSE_KEYS) this.pose[k] = 0;
    this.pose.hipH = HIP_H;
    this.mats = [];
    this._build(faceImg);
    this._shadow();
  }

  _m(color, extra = {}) {
    const m = new THREE.MeshLambertMaterial({ color, ...extra });
    this.mats.push(m);
    return m;
  }

  // A look spec becomes a material: '#hex' colour, a painter function (canvas texture), or { mat, size }
  _spec(spec, size = [64, 64], extra = {}) {
    if (spec == null) return null;
    if (typeof spec === 'string' || typeof spec === 'number') return this._m(spec, extra);
    if (typeof spec === 'function') return this._m(0xffffff, { map: canvasTex(size[0], size[1], spec), ...extra });
    if (spec.mat !== undefined) return this._spec(spec.mat, spec.size || size, extra);
    return null;
  }

  _build(faceImg) {
    const B = this.B, w = B.w, a = B.arm, L = this.look, isRef = this.outfit === 'ref';
    const skinM = this._m(this.skin);
    const D = THREE.DoubleSide;

    // tapered low-poly cylinder; z squashes it front-to-back. The texture's middle faces forward.
    const cyl = (rt, rb, h, mat, sides = 7, z = 1, open = false) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, sides, 1, open, -Math.PI);
      g.scale(1, 1, z);
      return new THREE.Mesh(g, mat);
    };
    const ball = (r, mat, sx = 1, sy = 1, sz = 1) => {
      const g = new THREE.SphereGeometry(r, 7, 5); g.scale(sx, sy, sz);
      return new THREE.Mesh(g, mat);
    };

    // ---------- materials ----------
    let torsoM, bellyM, trapsM, trunkM, beltM, bootM, padM, bandM, upperM, foreM, cuffM = null, fistM, legM, shinM;
    if (!L) {
      const trunkC = isRef ? '#111111' : this.color;
      trunkM = this._m(trunkC);
      bootM = this._m(isRef ? '#111111' : shade(this.color, -0.55));
      padM = this._m(isRef ? '#111111' : shade(this.color, 0.15));
      bandM = this._m('#f2f2f2');
      this.chestTex = canvasTex(64, 32, (c, W, H) => {
        if (isRef) { for (let x = 0; x < W; x += 4) { c.fillStyle = (x / 4) % 2 ? '#111' : '#f2f2f2'; c.fillRect(x, 0, 4, H); } return; }
        c.fillStyle = this.skin; c.fillRect(0, 0, W, H);
        const d = shade(this.skin, -0.3), l = shade(this.skin, 0.14), s = shade(this.skin, -0.12), cx = W / 2;
        c.fillStyle = s; c.fillRect(0, 0, 10, H); c.fillRect(W - 10, 0, 10, H);
        c.fillStyle = l; c.beginPath(); c.ellipse(cx - 7, 9, 7, 5, 0, 0, 7); c.ellipse(cx + 7, 9, 7, 5, 0, 0, 7); c.fill();
        c.strokeStyle = d; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(cx, 3); c.lineTo(cx, 31); c.stroke();
        c.beginPath(); c.moveTo(cx - 14, 12); c.quadraticCurveTo(cx - 7, 17, cx - 1, 13); c.moveTo(cx + 14, 12); c.quadraticCurveTo(cx + 7, 17, cx + 1, 13); c.stroke();
        if (this.buildName !== 'heavy') for (const y of [19, 24, 29]) { c.beginPath(); c.moveTo(cx - 5, y); c.lineTo(cx + 5, y); c.stroke(); }
        else { c.fillStyle = s; c.beginPath(); c.ellipse(cx, 26, 11, 6, 0, 0, 7); c.fill(); }
      }, { nearest: true });
      torsoM = this._m(0xffffff, { map: this.chestTex });
      bellyM = torsoM;
      const armM = isRef ? torsoM : skinM;
      trapsM = armM; upperM = armM; foreM = skinM; fistM = skinM;
      beltM = isRef ? bandM : this._m(shade(trunkC, 0.35));
      legM = () => (isRef ? trunkM : skinM);
      shinM = () => (isRef ? trunkM : bootM);
    } else {
      const ts = L.torsoSize || [64, 64];
      torsoM = this._spec(L.torso, ts) || skinM;
      bellyM = L.belly ? this._spec(L.belly, ts) : torsoM;
      trapsM = L.traps ? this._spec(L.traps) : skinM;
      trunkM = this._spec(L.trunks, [64, 32]) || skinM;
      beltM = this._spec(L.belt) || trunkM;
      const sl = L.sleeve;
      upperM = sl ? this._spec(sl.mat, sl.size || [32, 32]) : skinM;
      foreM = sl && sl.long ? upperM : skinM;
      cuffM = sl && sl.cuff ? this._m(sl.cuff) : null;
      fistM = L.gloves ? this._m(L.gloves) : skinM;
      bandM = L.wrist ? this._m(L.wrist) : null;
      bootM = this._m(L.boots || '#222');
      padM = L.kneepad ? this._m(L.kneepad) : null;
      const perSide = typeof L.legs === 'function' && L.legs.length >= 4;
      const shared = L.legs && !perSide ? this._spec(L.legs, L.legsSize || [64, 64]) : null;
      const sideMats = {};
      legM = side => {
        if (!L.legs) return skinM;
        if (!perSide) return shared;
        return sideMats[side] || (sideMats[side] = this._spec((c, W, H) => L.legs(c, W, H, side), L.legsSize || [64, 64]));
      };
      const shinFixed = L.shin ? this._m(L.shin) : L.socks ? this._m(L.socks) : null;
      shinM = side => shinFixed || (L.pants ? legM(side) : bootM);
    }

    // ---------- hips & trunks ----------
    this.hips = new THREE.Group();
    this.body.add(this.hips);
    const trunks = cyl(0.235 * w, 0.215 * w, 0.27, trunkM, 8, 0.68 * B.belly);
    trunks.position.y = -0.04; this.hips.add(trunks);
    const belt = cyl(0.24 * w, 0.24 * w, 0.06, beltM, 8, 0.7 * B.belly);
    belt.position.y = 0.1; this.hips.add(belt);
    if (L && L.skirt) {
      const S = typeof L.skirt === 'object' ? L.skirt : { mat: L.skirt };
      const len = S.len || 0.32, bot = S.bottom || 0.37;
      const sm = this._spec(S.mat, S.size || [64, 32], { side: D });
      const skirt = cyl(0.245 * w, bot * w, len, sm, 14, 0.8 * B.belly, true);
      skirt.position.y = -0.01 - len / 2; this.hips.add(skirt);
      if (S.hem) {
        const hem = new THREE.Mesh(new THREE.TorusGeometry(bot * w, 0.025, 4, 16), this._m(S.hem));
        hem.rotation.x = Math.PI / 2; hem.scale.y = 0.8 * B.belly; hem.position.y = -0.01 - len; this.hips.add(hem);
      }
    }

    // ---------- torso ----------
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const belly = cyl(0.23 * w, 0.225 * w * Math.min(1.15, B.belly), 0.27, bellyM, 8, 0.66 * B.belly);
    belly.position.y = 0.24; this.torso.add(belly);
    const chest = cyl(0.29 * w, 0.235 * w, 0.4, torsoM, 8, 0.6);
    chest.position.y = 0.55; this.torso.add(chest);
    const traps = ball(0.17 * w, trapsM, 1.25, 0.45, 0.7);
    traps.position.y = 0.74; this.torso.add(traps);
    if (L && L.cape) {
      const capeM = this._spec((c, W, H) => {
        c.fillStyle = L.cape; c.fillRect(0, 0, W, H);
        if (L.capeTrim) { c.fillStyle = L.capeTrim; c.fillRect(0, H - 4, W, 4); c.fillRect(0, 0, 3, H); c.fillRect(W - 3, 0, 3, H); }
      }, [32, 64], { side: D });
      const g = new THREE.PlaneGeometry(0.62 * w, 1.0); g.translate(0, -0.5, 0);
      const cape = new THREE.Mesh(g, capeM);
      cape.position.set(0, 0.74, -0.2 * w); cape.rotation.x = 0.12; this.torso.add(cape);
    }

    // ---------- head ----------
    this.neck = new THREE.Group();
    this.neck.position.y = 0.74;
    this.torso.add(this.neck);
    const neckM = cyl(0.085 * w, 0.1 * w, 0.14, skinM, 6);
    neckM.position.y = 0.05; this.neck.add(neckM);
    if (L && L.headphones) {
      const hm = this._m('#2a2a30'), hm2 = this._m('#55555e');
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.135 * w, 0.022, 6, 12, Math.PI * 1.25), hm);
      band.rotation.set(Math.PI / 2, 0, Math.PI * 1.375); band.position.set(0, 0.01, -0.01); this.neck.add(band);
      for (const sx of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 10), hm2);
        cup.rotation.z = Math.PI / 2; cup.rotation.y = sx * 0.5; cup.position.set(sx * 0.12 * w, 0.0, 0.06); this.neck.add(cup);
      }
    }
    const hs = B.head;
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 112; this.faceCanvas.height = 128;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.NoColorSpace;
    this.faceTex.generateMipmaps = false;
    this.faceTex.minFilter = this.faceTex.magFilter = THREE.LinearFilter;
    const faceM = this._m(0xffffff, { map: this.faceTex });
    this.hairM = this._m(shade(this.skin, -0.45));
    const headSideM = L && L.headColor ? this._m(L.headColor) : skinM;
    const head = new THREE.Mesh(headGeometry(0.29 * hs, 0.36 * hs, 0.31 * hs), [faceM, this.hairM, headSideM]);
    head.position.y = 0.26 * hs;
    this.neck.add(head);
    this.head = head;
    if (L) this._headExtras(L, hs);
    this.setFace(faceImg);

    // ---------- arms ----------
    const fringe = (painter, rt, rb, h) => {
      const m = this._spec(painter, [64, 32], { side: D, transparent: true, alphaTest: 0.5 });
      return cyl(rt, rb, h, m, 12, 1, true);
    };
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.33 * w, 0.64, 0);
      this.torso.add(sh);
      const puff = L && L.sleeve && L.sleeve.puffy ? 1.35 : 1;
      const delt = ball(0.1 * a * puff, upperM, 1, 1, 0.95);
      delt.position.y = -0.03; sh.add(delt);
      const up = cyl(0.083 * a * puff, 0.068 * a * puff, 0.32, upperM, 7);
      up.position.y = -0.18; sh.add(up);
      if (cuffM && !(L.sleeve && L.sleeve.long)) { const cf = cyl(0.074 * a, 0.072 * a, 0.04, cuffM, 7); cf.position.y = -0.3; sh.add(cf); }
      const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
      const fore = cyl(0.07 * a * (foreM === upperM ? puff : 1), 0.055 * a, 0.27, foreM, 7);
      fore.position.y = -0.13; el.add(fore);
      if (cuffM && L.sleeve && L.sleeve.long) { const cf = cyl(0.064 * a, 0.064 * a, 0.05, cuffM, 7); cf.position.y = -0.25; el.add(cf); }
      if (bandM) { const band = cyl(0.064 * a, 0.064 * a, 0.07, bandM, 7); band.position.y = -0.25; el.add(band); }
      const fist = ball(0.07 * a, fistM, 1, 1.05, 1.1);
      fist.position.y = -0.33; el.add(fist);
      if (L && L.fringeArm) { const f = fringe(L.fringeArm, 0.085 * a, 0.14 * a, 0.22); f.position.y = -0.3; sh.add(f); }
      if (L && L.elbowPadR && side < 0) {
        const pad = ball(0.082 * a, this._m(L.elbowPadR.color), 1, 1.1, 1);
        el.add(pad);
        const disc = cyl(0.045, 0.045, 0.02, this._m(L.elbowPadR.disc), 8);
        disc.rotation.x = Math.PI / 2; disc.position.set(0, 0, -0.08); el.add(disc);
      }
      if (L && L.sleeveL && side > 0) {
        const sm = this._m(L.sleeveL);
        const s1 = cyl(0.074 * a, 0.072 * a, 0.12, sm, 7); s1.position.y = -0.29; sh.add(s1);
        const s2 = cyl(0.074 * a, 0.064 * a, 0.16, sm, 7); s2.position.y = -0.06; el.add(s2);
      }
      return { sh, el };
    };
    const LA = arm(1), RA = arm(-1);
    this.shL = LA.sh; this.elL = LA.el; this.shR = RA.sh; this.elR = RA.el;

    // ---------- legs ----------
    const legLen = B.leg;
    const wide = (L && L.legsWide) || 1;
    const leg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.12 * w, -0.08, 0);
      this.hips.add(hip);
      const tm = legM(side);
      const thigh = L ? cyl(0.115 * w * wide, 0.092 * w * wide, 0.42 * legLen, tm, 8) : cyl(0.115 * w, 0.088 * w, 0.42 * legLen, tm, 7);
      thigh.position.y = -0.21 * legLen; hip.add(thigh);
      const kn = new THREE.Group(); kn.position.y = -0.42 * legLen; hip.add(kn);
      if (padM) {
        const pad = ball(0.1 * w, padM, 1, 0.75, 1.05);
        pad.position.set(0, 0, 0.015); kn.add(pad);
        const decal = L && L.kneeDecal ? L.kneeDecal[side > 0 ? 0 : 1] : null;
        if (L && (L.kneeDisc || decal)) {
          const dm = decal ? this._spec(decal, [32, 32]) : this._m(L.kneeDisc);
          const disc = cyl(0.058 * w, 0.058 * w, 0.02, [dm, dm, dm], 10);
          disc.rotation.x = Math.PI / 2; disc.position.set(0, 0, 0.115 * w); kn.add(disc);
        }
      }
      const sm = shinM(side);
      const pantsShin = L && L.pants && sm === tm;
      const shin = pantsShin ? cyl(0.092 * w * wide, 0.08 * w * wide, 0.34, sm, 8) : cyl(0.088 * w, 0.075 * w, 0.34, sm, 7);
      shin.position.y = -0.19; kn.add(shin);
      let bootMat = bootM;
      if (L && L.laces) { const lm = this._spec(L.laces, [16, 16]); bootMat = [bootM, bootM, lm, bootM, lm, bootM]; }
      const boot = L && L.shoe
        ? new THREE.Mesh(new THREE.BoxGeometry(0.15 * w, 0.09, 0.27), bootMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.16 * w, 0.12, 0.28), bootMat);
      boot.position.set(0, L && L.shoe ? -0.395 : -0.38, 0.05); kn.add(boot);
      if (L && L.fringeBoot) { const f = fringe(L.fringeBoot, 0.1 * w, 0.17 * w, 0.2); f.position.y = -0.3; kn.add(f); }
      return { hip, kn };
    };
    const LL = leg(1), RL = leg(-1);
    this.lgL = LL.hip; this.knL = LL.kn; this.lgR = RL.hip; this.knR = RL.kn;
    this.H = 0.08 + 0.42 * legLen + 0.44;
    this.pose.hipH = this.H;
  }

  _shadow() {
    if (!Rig.shadowTex) {
      Rig.shadowTex = canvasTex(32, 32, (c) => {
        const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.7, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, 32, 32);
      });
    }
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: Rig.shadowTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
  }


  // 3D hair, beard, eyewear and hats (they read better than paint alone at PS2 resolution)
  _headExtras(L, hs) {
    const W = 0.29 * hs, Hh = 0.36 * hs, D = 0.31 * hs, head = this.head;
    const ell = (sx, sy, sz, mat, seg = 10) => { const g = new THREE.SphereGeometry(0.5, seg, 7); g.scale(sx, sy, sz); return new THREE.Mesh(g, mat); };
    const add = (o, x, y, z) => { o.position.set(x, y, z); head.add(o); return o; };
    this.extras = { photoHide: [] };
    if (L.hair && L.hairStyle === 'swept') {
      const hm = this._m(L.hair);
      add(ell(W * 1.08, Hh * 0.62, D * 1.08, hm), 0, Hh * 0.24, -D * 0.06);
      const q = add(ell(W * 0.8, Hh * 0.3, D * 0.5, hm), 0, Hh * 0.43, D * 0.2); q.rotation.x = -0.5;
      add(ell(W * 0.98, Hh * 0.75, D * 0.55, hm), 0, -Hh * 0.02, -D * 0.33);
    } else if (L.hair && L.hairStyle === 'wig') {
      const hm = this._m(L.hair);
      add(ell(W * 1.35, Hh * 0.8, D * 1.3, hm, 9), 0, Hh * 0.25, -D * 0.04);
      for (const sx of [-1, 1]) add(ell(W * 0.5, Hh * 0.85, D * 0.75, hm, 7), sx * W * 0.55, -Hh * 0.08, -D * 0.05);
      add(ell(W * 1.25, Hh * 1.05, D * 0.6, hm, 8), 0, -Hh * 0.18, -D * 0.38);
      add(ell(W * 1.0, Hh * 0.25, D * 0.4, hm, 8), 0, Hh * 0.36, D * 0.36);
    }
    if (L.beard) {
      const bm = this._m(L.beard);
      const beard = add(ell(W * 0.98, Hh * 0.52, D * 0.82, bm), 0, -Hh * 0.27, D * 0.12);
      const chin = add(ell(W * 0.55, Hh * 0.3, D * 0.45, bm, 8), 0, -Hh * 0.47, D * 0.27);
      this.extras.photoHide.push(beard, chin);
    }
    const g = new THREE.Group(); g.position.set(0, Hh * 0.05, D * 0.5 + 0.004); head.add(g);
    this.extras.photoHide.push(g);
    const fm = this._m('#120c08');
    if (L.glasses === 'dark' || L.glasses === 'red' || L.glasses === 'pink') {
      const lm = L.glasses === 'red' ? this._m('#c8141a', { emissive: 0x3a0404 }) : L.glasses === 'pink' ? this._m('#ff4fb8', { emissive: 0x3a0420 }) : this._m('#2a1a0a', { emissive: 0x1a0e04 });
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.17, W * 0.17, 0.012, 10), lm);
        lens.rotation.set(Math.PI / 2, 0, 0); lens.scale.set(1, 1, 0.62);
        const lg = new THREE.Group(); lg.position.set(sx * W * 0.21, 0, -D * 0.04); lg.rotation.y = sx * 0.42; lg.add(lens); g.add(lg);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, D * 0.6), fm);
        arm.position.set(sx * W * 0.5, 0.005, -D * 0.35); g.add(arm);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.12, 0.01, 0.01), fm); bridge.position.set(0, 0.008, 0.004); g.add(bridge);
    } else if (L.glasses === 'shutter') {
      const sm = this._spec((c, Wc, Hc) => {
        c.fillStyle = '#5dff3a'; c.fillRect(0, 0, Wc, Hc);
        c.fillStyle = '#16300c'; for (let y = 3; y < Hc - 2; y += 4) c.fillRect(2, y, Wc - 4, 2);
        c.fillRect(Wc / 2 - 1, 0, 2, Hc);
      }, [32, 16], { emissive: 0x0a2a04 });
      const shades = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, Hh * 0.17, 0.02), sm);
      shades.position.z = -D * 0.02; g.add(shades);
      for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, D * 0.6), this._m('#5dff3a')); arm.position.set(sx * W * 0.47, 0, -D * 0.33); g.add(arm); }
    } else if (L.glasses === 'patch') {
      const patch = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.15, W * 0.15, 0.015, 10), this._m('#0a0a0a'));
      patch.rotation.x = Math.PI / 2; patch.scale.set(1, 1, 0.75); patch.position.set(W * 0.19, 0, -D * 0.05); g.add(patch);
    }
    // hats
    const hc = L.hatColor;
    switch (L.hat) {
      case 'headband': {
        const m = this._m(hc || '#2a4ad8');
        const band = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.56, W * 0.56, Hh * 0.13, 12, 1, true), m);
        band.scale.set(1, 1, D / W * 1.02); add(band, 0, Hh * 0.27, -D * 0.02);
        break;
      }
      case 'sombrero': {
        const bm = this._m('#141418'), tm = this._m('#f4f4f4');
        const hat = new THREE.Group(); hat.position.set(0, Hh * 0.5, -D * 0.05); hat.rotation.x = -0.15; head.add(hat);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(W * 1.45, W * 1.55, 0.03, 18), bm); hat.add(brim);
        const edge = new THREE.Mesh(new THREE.TorusGeometry(W * 1.52, 0.022, 4, 20), tm); edge.rotation.x = Math.PI / 2; hat.add(edge);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.36, W * 0.52, Hh * 0.62, 10), bm); crown.position.y = Hh * 0.31; hat.add(crown);
        const cband = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.53, Hh * 0.08, 10), tm); cband.position.y = Hh * 0.06; hat.add(cband);
        const tip = new THREE.Mesh(new THREE.TorusGeometry(W * 0.37, 0.015, 4, 12), tm); tip.rotation.x = Math.PI / 2; tip.position.y = Hh * 0.62; hat.add(tip);
        break;
      }
      case 'kabuto': {
        const dm = this._m('#1a1a1a'), rm = this._m('#9a1a1a'), gm = this._m('#e2b23a', { emissive: 0x2a1a00 });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), dm);
        dome.scale.set(W * 1.22, Hh * 1.0, D * 1.22); add(dome, 0, Hh * 0.08, -D * 0.02);
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.62, W * 0.82, Hh * 0.28, 10, 1, true, Math.PI * 0.35, Math.PI * 1.3), rm);
        guard.material.side = THREE.DoubleSide; guard.scale.z = D / W; add(guard, 0, -Hh * 0.02, -D * 0.05);
        const crest = new THREE.Mesh(new THREE.TorusGeometry(W * 0.45, 0.02, 4, 12, Math.PI), gm);
        crest.rotation.z = Math.PI; add(crest, 0, Hh * 0.82, D * 0.38);
        break;
      }
      case 'bow': {
        const m = this._m(hc || '#d8202a');
        for (const sx of [-1, 1]) { const lobe = ell(W * 0.42, Hh * 0.3, D * 0.14, m, 8); lobe.rotation.z = sx * 0.5; add(lobe, sx * W * 0.22, Hh * 0.6, -D * 0.12); }
        add(ell(W * 0.14, Hh * 0.14, D * 0.16, m, 6), 0, Hh * 0.6, -D * 0.12);
        break;
      }
      case 'tricorn': {
        const m = this._m('#1a1414'), tm = this._m('#e2b23a');
        const hat = new THREE.Group(); hat.position.set(0, Hh * 0.52, -D * 0.04); head.add(hat);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(W * 1.0, W * 1.0, 0.1, 3), m); brim.rotation.y = Math.PI; hat.add(brim);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(W * 1.02, W * 1.02, 0.02, 3, 1, true), tm); rim.rotation.y = Math.PI; rim.position.y = 0.05; hat.add(rim);
        const crown = ell(W * 1.0, Hh * 0.55, D * 0.95, m); crown.position.y = Hh * 0.08; hat.add(crown);
        const skull = ell(W * 0.16, W * 0.16, 0.02, this._m('#f4f4f4'), 6); skull.position.set(0, Hh * 0.12, D * 0.5); hat.add(skull);
        break;
      }
      case 'helmet': {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), this._m('#cfe8ff', { transparent: true, opacity: 0.22, depthWrite: false }));
        bubble.scale.set(W * 1.75, Hh * 1.6, D * 1.75); add(bubble, 0, -Hh * 0.02, 0);
        const collar = new THREE.Mesh(new THREE.TorusGeometry(W * 0.66, 0.05, 6, 14), this._m('#c8c8cc'));
        collar.rotation.x = Math.PI / 2; add(collar, 0, -Hh * 0.72, 0);
        break;
      }
      case 'tiara': {
        const gm = this._m('#ffd84a', { emissive: 0x3a2a00 }), jm = this._m('#7af0ff', { emissive: 0x0a3a40 }), pm = this._m('#ff4fb8', { emissive: 0x3a0420 });
        const t = new THREE.Group(); t.position.set(0, Hh * 0.42, D * 0.06); t.rotation.x = -0.25; head.add(t);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.52, Hh * 0.07, 14, 1, true, -Math.PI * 0.5, Math.PI), gm);
        band.material.side = THREE.DoubleSide; band.scale.z = D / W; t.add(band);
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.32, hgt = Hh * (0.22 - Math.abs(i) * 0.05);
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, hgt, 4), gm);
          sp.position.set(Math.sin(a) * W * 0.5, hgt / 2, Math.cos(a) * D * 0.5); sp.rotation.x = 0.1; t.add(sp);
        }
        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), jm); jewel.position.set(0, Hh * 0.06, D * 0.53); t.add(jewel);
        for (const sx of [-1, 1]) { const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), pm); j.position.set(sx * W * 0.3, Hh * 0.04, D * 0.44); t.add(j); }
        break;
      }
      case 'cap': { // backwards baseball cap
        const m = this._m(hc || '#d8202a'), wm = this._m('#f4f4f4');
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
        dome.scale.set(W * 1.12, Hh * 0.8, D * 1.12); add(dome, 0, Hh * 0.16, -D * 0.04);
        const bill = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.42, W * 0.42, 0.02, 10, 1, false, Math.PI * 0.5, Math.PI), m);
        bill.scale.set(1, 1, 1.1); add(bill, 0, Hh * 0.18, -D * 0.5);
        const btn = ell(0.05, 0.03, 0.05, wm, 6); add(btn, 0, Hh * 0.56, -D * 0.04);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.36, Hh * 0.09, 0.02), wm); add(strap, 0, Hh * 0.28, D * 0.5);
        break;
      }
      case 'nub': { // pickle end
        const gm = this._m('#4a7a22');
        add(ell(W * 0.55, Hh * 0.35, D * 0.55, gm, 8), 0, Hh * 0.5, -D * 0.02);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.07, 5), this._m('#8a7a3a')), 0, Hh * 0.7, -D * 0.02);
        break;
      }
      case 'stalk': {
        const gm = this._m('#3d6b22'), lm = this._m('#5a9a2a');
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.2, 6), gm), 0, Hh * 0.78, -D * 0.05);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          const leaf = ell(W * 0.55, 0.03, W * 0.22, lm, 6);
          leaf.rotation.y = a; leaf.rotation.z = 0.35;
          add(leaf, Math.cos(a) * W * 0.25, Hh * 0.56, -Math.sin(a) * W * 0.25 - D * 0.05);
        }
        break;
      }
    }
  }
  setFace(img) {
    const c = this.faceCanvas.getContext('2d');
    if (img) drawPhotoFace(c, 112, 128, img, this.skin);
    else if (this.look && this.look.face) this.look.face(c, 112, 128);
    else drawDefaultFace(c, 112, 128, this.skin, this.seed);
    this.faceTex.needsUpdate = true;
    if (this.extras) this.extras.photoHide.forEach(o => { o.visible = !img; });
    if (this.look && this.look.headColor) { this.hairM.color.set(this.look.headColor); return; }
    if (this.look && this.look.hair) { this.hairM.color.set(this.look.hair); return; }
    // top/back of the head: the photo's hair colour, or the cartoon hair line
    let r = 0, g = 0, b = 0, n = 0;
    if (img) {
      const t = document.createElement('canvas'); t.width = 16; t.height = 16;
      const tc = t.getContext('2d'); tc.drawImage(img, 0, 0, 16, 16);
      const d = tc.getImageData(4, 0, 8, 2).data;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    } else {
      const d = c.getImageData(56, 2, 1, 1).data; r = d[0]; g = d[1]; b = d[2]; n = 1;
    }
    this.hairM.color.setRGB(r / n / 255, g / n / 255, b / n / 255);
  }

  faceDataURL() { return this.faceCanvas.toDataURL('image/png'); }

  // Ease current pose toward target. snap: keys that should be set exactly (flights, get-ups)
  apply(target, dt, speed = 14, snap = null) {
    const k = 1 - Math.exp(-speed * dt);
    for (const key of POSE_KEYS) {
      const tv = target[key];
      if (tv === undefined) continue;
      if (snap && snap.includes(key)) this.pose[key] = tv;
      else this.pose[key] += (tv - this.pose[key]) * k;
    }
    const p = this.pose;
    this.body.position.y = p.hipH;
    this.body.rotation.set(p.pitch, 0, p.roll);
    this.torso.rotation.set(p.tX, p.tY, p.tZ);
    this.neck.rotation.set(p.hX, p.hY, 0);
    this.shL.rotation.set(-p.sLX, 0, p.sLZ);
    this.shR.rotation.set(-p.sRX, 0, -p.sRZ);
    this.elL.rotation.x = -p.eL; this.elR.rotation.x = -p.eR;
    this.lgL.rotation.set(-p.lLX, 0, p.lLZ);
    this.lgR.rotation.set(-p.lRX, 0, -p.lRZ);
    this.knL.rotation.x = p.kL; this.knR.rotation.x = p.kR;
    // blob shadow under the body's centre of mass
    const lying = Math.min(1, Math.abs(Math.sin(p.pitch)));
    const back = Math.sign(Math.sin(p.pitch)) * 0.35 * lying; // shift toward the torso when lying
    const yaw = this.root.rotation.y;
    this.shadow.position.set(this.root.position.x + Math.sin(yaw) * back, this.root.position.y + 0.012, this.root.position.z + Math.cos(yaw) * back);
    this.shadow.rotation.z = yaw;
    const sc = 0.9 + lying * 0.4;
    this.shadow.scale.set(sc * this.B.w, sc * (1 + lying * 1.4), 1);
  }

  // world position of the chest (for hit sparks, pins)
  chestWorld(out = new THREE.Vector3()) { return this.torso.localToWorld(out.set(0, 0.5, 0.1)); }
  headWorld(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, 0, 0)); }

  addTo(scene) { scene.add(this.root); scene.add(this.shadow); }
  removeFrom(scene) {
    scene.remove(this.root); scene.remove(this.shadow);
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  }
}

// Sphere head split into three material groups: 0 = face (planar-projected photo), 1 = hair, 2 = skin.
function headGeometry(w, h, d) {
  const src = new THREE.SphereGeometry(0.5, 12, 9).toNonIndexed();
  src.scale(w, h, d);
  const P = src.attributes.position, N = src.attributes.normal, U = src.attributes.uv;
  const buckets = [[], [], []];
  for (let i = 0; i < P.count; i += 3) {
    let cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cy += P.getY(i + k); cz += P.getZ(i + k); }
    const ny = cy / 3 / (h / 2), nz = cz / 3 / (d / 2);
    let g = 2;
    if (nz > 0.3 && ny < 0.72 && ny > -0.95) g = 0;
    else if (ny > 0.42 || (nz < -0.1 && ny > -0.25)) g = 1;
    buckets[g].push(i);
  }
  const pos = [], nor = [], uv = [];
  const geo = new THREE.BufferGeometry();
  let start = 0;
  buckets.forEach((list, g) => {
    for (const i of list) for (let k = 0; k < 3; k++) {
      const j = i + k, x = P.getX(j), y = P.getY(j);
      pos.push(x, y, P.getZ(j)); nor.push(N.getX(j), N.getY(j), N.getZ(j));
      if (g === 0) uv.push(0.5 + x / (w * 0.92), 0.5 + y / (h * 0.98));
      else uv.push(U.getX(j), U.getY(j));
    }
    geo.addGroup(start, list.length * 3, g);
    start += list.length * 3;
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

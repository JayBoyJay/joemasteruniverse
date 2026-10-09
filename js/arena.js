// The venue: a map-driven set. THE ARENA has the ring, ropes that wobble, crowd, titantron and lighting rig;
// the other maps (see maps.js) are built from the same toolkit of props.
import * as THREE from 'three';
import { RING_H, ROPE, APRON, canvasTex, noise, mulberry } from './tex.js';
import { MAPS, MAP_BY_ID } from './maps.js';
export { MAPS };

const POST = ROPE + 0.12;
const ROPE_HEIGHTS = [0.42, 0.82, 1.22];
const DEFAULT_RING = {
  ropes: [0x8a3cf0, 0xf2f2f2, 0x8a3cf0],          // JOE MASTER purple
  pads: [0x141418, 0x7a34d8, 0x141418, 0x7a34d8],
  post: 0x9aa0aa, steps: true,
  mat: null, skirt: null,                          // painter overrides (c, w, h, arena)
};
const UP = new THREE.Vector3(0, 1, 0);

function lambert(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, ...extra }); }

export class Arena {
  constructor(scene, title = 'JOE MASTER UNIVERSE', mapId = 'arena') {
    this.scene = scene;
    this.title = title;
    this.map = MAP_BY_ID[mapId] || MAPS[0];
    this.id = this.map.id;
    this.t = 0;
    this.excite = 0.3;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sides = []; this.crowdMeshes = []; this.flashes = null; this.stageBars = []; this.anims = []; this.iconHooks = [];
    this.hasRing = false;
    this.outY = 0;                 // floor height eliminated wrestlers end up on
    this.outDist = APRON + 0.75;   // how far out they roll
    // JOE MASTER's icon goes on posters, mats, billboards and screens
    this.icon = null;
    const img = new Image();
    img.onload = () => { this.icon = img; this._applyIcon(); };
    img.src = 'img/icon.jpg';
    if (this.id === 'arena') this._buildArena();
    else this.map.build(this, THREE);
  }

  _buildArena() {
    this.scene.background = new THREE.Color(0x05050b);
    this.scene.fog = new THREE.Fog(0x05050b, 16, 52);
    this._lights();
    this._floor();
    this.ring();
    this._crowd();
    this._titantron();
    this._truss();
    this.iconHooks.push(() => this._arenaBillboards());
  }

  // remove everything this venue added to the scene
  dispose() {
    this.scene.remove(this.group);
    const seen = new Set();
    this.group.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { if (seen.has(m)) continue; seen.add(m); if (m.map) m.map.dispose(); m.dispose(); }
    });
  }

  // ---------------- toolkit used by every map ----------------
  mat(c, extra = {}) {
    if (c && c.isMaterial) return c;
    if (typeof c === 'function') return new THREE.MeshLambertMaterial({ map: canvasTex(extra.w || 64, extra.h || 64, c, extra.texOpts || {}), ...(extra.mat || {}) });
    return new THREE.MeshLambertMaterial({ color: c, ...(extra.mat || {}) });
  }
  add(mesh, x = 0, y = 0, z = 0, ry = 0) { mesh.position.set(x, y, z); mesh.rotation.y = ry; this.group.add(mesh); return mesh; }
  box(w, h, d, m, x, y, z, ry = 0) { return this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(m)), x, y, z, ry); }
  cyl(rt, rb, h, m, x, y, z, seg = 10) { return this.add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), this.mat(m)), x, y, z); }
  ball(r, m, x, y, z, sx = 1, sy = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 10, 8); g.scale(sx, sy, sz); return this.add(new THREE.Mesh(g, this.mat(m)), x, y, z); }
  plane(w, h, m, x, y, z, ry = 0, rx = 0) {
    const mesh = this.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat(m)), x, y, z, ry);
    mesh.rotation.x = rx; return mesh;
  }
  glow(w, h, color, x, y, z, ry = 0) { // unlit, always-bright panel (neon, screens, lava)
    return this.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide })), x, y, z, ry);
  }
  tex(w, h, painter, opts = {}) { return canvasTex(w, h, painter, opts); }
  light(type, color, intensity, x, y, z, dist = 0, decay = 2) {
    const l = type === 'point' ? new THREE.PointLight(color, intensity, dist, decay)
      : type === 'dir' ? new THREE.DirectionalLight(color, intensity)
      : type === 'hemi' ? new THREE.HemisphereLight(color, x, intensity)
      : new THREE.AmbientLight(color, intensity);
    if (type === 'point' || type === 'dir') l.position.set(x, y, z);
    this.group.add(l); return l;
  }
  // a texture that gets JOE MASTER's icon painted in once it has loaded
  iconTex(w, h, painter, opts = {}) {
    const t = canvasTex(w, h, (c, W, H) => painter(c, W, H, this.icon), opts);
    this.iconHooks.push(() => this._redraw(t, (c, W, H) => painter(c, W, H, this.icon)));
    return t;
  }
  every(fn) { this.anims.push(fn); }
  // flickering fire sprite (hell, burning barrels)
  flame(x, y, z, size = 1, hue = 0.07) {
    if (!Arena.flameTex) {
      Arena.flameTex = canvasTex(32, 64, (c) => {
        const g = c.createRadialGradient(16, 46, 2, 16, 40, 30);
        g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.25, 'rgba(255,200,60,0.95)'); g.addColorStop(0.6, 'rgba(255,80,10,0.6)'); g.addColorStop(1, 'rgba(120,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(16, 0); c.quadraticCurveTo(30, 34, 26, 52); c.quadraticCurveTo(16, 66, 6, 52); c.quadraticCurveTo(2, 34, 16, 0); c.fill();
      });
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arena.flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.center.set(0.5, 0.1);
    s.position.set(x, y, z); this.group.add(s);
    const ph = Math.random() * 10;
    this.every((dt, t) => {
      const f = 0.85 + 0.15 * Math.sin(t * 17 + ph) + 0.1 * Math.sin(t * 29 + ph * 2);
      s.scale.set(size * 0.6 * (2 - f), size * 1.2 * f, 1);
      s.material.color.setHSL(hue, 1, 0.5 + 0.1 * Math.sin(t * 11 + ph));
    });
    return s;
  }
  // instanced cardboard people (crowds, onlookers). spots: [{x,y,z,rot}]
  people(spots, palette = null, tint = 0x9a9aa8, variants = 8) {
    const texs = [];
    for (let v = 0; v < variants; v++) {
      texs.push(canvasTex(16, 32, (c) => {
        const P = palette ? palette(v) : null;
        const shirt = P ? P.shirt : ['#c0392b', '#2e86de', '#27ae60', '#f1c40f', '#8e44ad', '#ecf0f1', '#e67e22', '#222'][v];
        const skin = P ? P.skin : ['#f1c7a5', '#c48a60', '#8d5a3b', '#e0ac85'][v % 4];
        const hair = P ? P.hair : ['#1a120c', '#3b2414', '#c9a15a', '#111'][(v * 3) % 4];
        c.clearRect(0, 0, 16, 32);
        c.fillStyle = shirt; c.fillRect(2, 13, 12, 19); c.fillRect(0, 14, 2, 9); c.fillRect(14, 14, 2, 9);
        c.fillStyle = skin; c.fillRect(4, 3, 8, 9);
        c.fillStyle = hair; c.fillRect(4, 2, 8, 3);
        if (P && P.horns) { c.fillStyle = P.horns; c.fillRect(3, 0, 2, 3); c.fillRect(11, 0, 2, 3); }
        if (P && P.eyes) { c.fillStyle = P.eyes; c.fillRect(5, 6, 2, 1); c.fillRect(9, 6, 2, 1); }
        if (!P && v % 3 === 0) { c.fillStyle = '#fff'; c.fillRect(0, 0, 16, 2); }
      }, { nearest: true }));
    }
    const per = Array.from({ length: variants }, () => []);
    const rnd = mulberry(spots.length + 3);
    for (const sp of spots) per[Math.floor(rnd() * variants)].push({ phase: rnd() * 6.28, amp: 0.5 + rnd(), ...sp });
    const geo = new THREE.PlaneGeometry(0.55, 1.1); geo.translate(0, 0.55, 0);
    per.forEach((list, v) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: texs[v], alphaTest: 0.5, color: tint, side: THREE.DoubleSide }), list.length);
      m.userData.list = list; this.group.add(m); this.crowdMeshes.push(m);
    });
    this._dummy = this._dummy || new THREE.Object3D();
    this.allFans = (this.allFans || []).concat(spots);
    this._updateCrowd(0);
  }
  // ring at the usual height, with optional style overrides
  ring(style = {}) {
    this.ringStyle = { ...DEFAULT_RING, ...style };
    this.hasRing = true; this.outY = 0; this.outDist = APRON + 0.75;
    this._ring();
    this._ropes();
  }
  // walled fighting area (no ring): the floor is raised to ring height so the fight code doesn't change
  floorArea(floorMat, size = 40) {
    this.hasRing = false; this.outY = RING_H; this.outDist = ROPE + 0.1;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mat(floorMat));
    f.rotation.x = -Math.PI / 2; f.position.y = RING_H; this.group.add(f);
    return f;
  }

  _lights() {
    this.group.add(new THREE.AmbientLight(0x3a3a55, 1.1));
    const hemi = new THREE.HemisphereLight(0xb8c4ff, 0x201810, 0.75);
    this.group.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2dd, 1.35);
    key.position.set(3, 12, 6);
    this.group.add(key);
    const rim = new THREE.DirectionalLight(0x6f8cff, 0.6);
    rim.position.set(-6, 6, -8);
    this.group.add(rim);
    this.ringSpot = new THREE.PointLight(0xffffff, 26, 14, 1.6);
    this.ringSpot.position.set(0, RING_H + 6, 0);
    this.group.add(this.ringSpot);
  }

  _floor() {
    const tex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#1a1a22'; c.fillRect(0, 0, w, h); noise(c, w, h, 16);
      c.strokeStyle = '#0e0e14'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1);
    }, { repeat: [24, 24], nearest: true });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), lambert(0xffffff, { map: tex }));
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);
    // protective blue mats around the ring
    const mats = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), lambert(0x2a1650));
    mats.rotation.x = -Math.PI / 2; mats.position.y = 0.01;
    this.group.add(mats);
    // barricade
    this.drawBar = (c, w, h) => {
      c.fillStyle = '#0c0c12'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9b4dff'; c.fillRect(0, 0, w, 4);
      c.font = `italic 900 ${h * 0.42}px Impact, Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#e8e8f0'; c.fillText('JOE MASTER UNIVERSE', w * 0.6, h * 0.58);
      if (this.icon) c.drawImage(this.icon, h * 0.15, h * 0.12, h * 0.8, h * 0.8);
    };
    const barTex = canvasTex(256, 32, this.drawBar, { repeat: [4, 1] });
    this.barTex = barTex;
    const barMat = lambert(0xffffff, { map: barTex });
    const R = 7.4;
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 0.2, 1.05, 0.2), barMat);
      const a = i * Math.PI / 2;
      b.position.set(Math.sin(a) * R, 0.52, Math.cos(a) * R);
      b.rotation.y = a;
      this.group.add(b);
    }
  }

  _ring() {
    const logo = this.title;
    // mat: off-white canvas with the logo in the middle
    const RS = this.ringStyle;
    this.drawMat = RS.mat ? (c, w, h) => RS.mat(c, w, h, this) : (c, w, h) => {
      c.fillStyle = '#d9d6cf'; c.fillRect(0, 0, w, h); noise(c, w, h, 14);
      c.strokeStyle = '#b9b5ad'; c.lineWidth = 6; c.strokeRect(20, 20, w - 40, h - 40);
      c.save(); c.translate(w / 2, h / 2);
      c.fillStyle = '#0d0d14'; c.beginPath(); c.arc(0, 0, w * 0.29, 0, 7); c.fill();
      c.strokeStyle = '#9b4dff'; c.lineWidth = 12; c.stroke();
      if (this.icon) {
        c.save(); c.beginPath(); c.arc(0, 0, w * 0.27, 0, 7); c.clip();
        const s = w * 0.56; c.drawImage(this.icon, -s / 2, -s / 2, s, s); c.restore();
      } else {
        c.fillStyle = '#ffffff'; c.font = `italic 900 ${w * 0.1}px Impact, Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('JOE', 0, -w * 0.05); c.fillText('MASTER', 0, w * 0.06);
      }
      c.fillStyle = '#9b4dff'; c.font = `italic 900 ${w * 0.05}px Impact, Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('U N I V E R S E', 0, w * 0.34);
      c.restore();
      c.globalAlpha = 0.08; c.fillStyle = '#000';
      const r = mulberry(4);
      for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * w, r() * h, 4 + r() * 20, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    };
    const matTex = canvasTex(512, 512, this.drawMat);
    this.matTex = matTex;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(APRON * 2, APRON * 2), lambert(0xffffff, { map: matTex }));
    mat.rotation.x = -Math.PI / 2; mat.position.y = RING_H + 0.002;
    this.group.add(mat);
    // skirt
    this.drawSkirt = RS.skirt ? (c, w, h) => RS.skirt(c, w, h, this) : (c, w, h) => {
      c.fillStyle = '#0d0d16'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9b4dff'; c.fillRect(0, 0, w, 6);
      c.font = `italic 900 ${h * 0.5}px Impact, Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.fillText(logo, w / 2, h / 2 + 3);
      if (this.icon) for (const x of [h * 0.7, w - h * 0.7]) c.drawImage(this.icon, x - h * 0.42, h * 0.12, h * 0.84, h * 0.84);
    };
    const skirtTex = canvasTex(512, 64, this.drawSkirt);
    this.skirtTex = skirtTex;
    const skirtMat = lambert(0xffffff, { map: skirtTex });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(APRON * 2, RING_H, APRON * 2),
      [skirtMat, skirtMat, lambert(0x222222), lambert(0x111111), skirtMat, skirtMat]);
    plat.position.y = RING_H / 2;
    this.group.add(plat);
    // posts + turnbuckle pads
    const postMat = lambert(RS.post);
    const padCols = RS.pads;
    this.corners = [];
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6), postMat);
      post.position.set(sx * POST, RING_H + 0.75, sz * POST);
      this.group.add(post);
      for (const y of ROPE_HEIGHTS) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), lambert(padCols[i]));
        pad.position.set(sx * (POST - 0.08), RING_H + y, sz * (POST - 0.08));
        pad.rotation.y = Math.PI / 4;
        this.group.add(pad);
      }
      this.corners.push(new THREE.Vector3(sx * POST, 0, sz * POST));
    });
    // ring steps in two corners
    const stepMat = lambert(0x50555e);
    for (const [sx, sz] of RS.steps ? [[1, 1], [-1, -1]] : []) {
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, (k + 1) * RING_H / 3, 0.5), stepMat);
        const d = APRON + 0.55 + (2 - k) * 0.5;
        s.position.set(sx * d * 0.72, (k + 1) * RING_H / 6, sz * d * 0.72);
        s.rotation.y = Math.PI / 4;
        this.group.add(s);
      }
    }
  }

  _ropes() {
    // Each side has 3 ropes; each rope is two cylinders meeting at a movable midpoint.
    // sides: 0 = +z (front), 1 = +x, 2 = -z, 3 = -x
    this.sides = [];
    const corner = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    for (let s = 0; s < 4; s++) {
      const a = corner[s], b = corner[(s + 1) % 4];
      const side = { ropes: [], amp: 0, vel: 0, push: 0, along: 0 };
      // outward normal
      side.normal = new THREE.Vector3(...[[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]][s]);
      ROPE_HEIGHTS.forEach((y, k) => {
        const A = new THREE.Vector3(a[0] * POST, RING_H + y, a[1] * POST);
        const B = new THREE.Vector3(b[0] * POST, RING_H + y, b[1] * POST);
        const mat = lambert(this.ringStyle.ropes[k]);
        const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
        const m1 = new THREE.Mesh(geo, mat), m2 = new THREE.Mesh(geo, mat);
        this.group.add(m1, m2);
        side.ropes.push({ A, B, m1, m2, k });
      });
      this.sides.push(side);
    }
    this._updateRopes(0);
  }

  // A wrestler hit the ropes: side index and position along the rope (-1..1)
  ropeHit(side, along = 0, strength = 1) {
    const s = this.sides[side];
    if (!s) { if (this.onWallHit) this.onWallHit(side, along, strength); return; }
    s.vel += 2.6 * strength;
    s.along = along;
  }
  // Pressing against the ropes (e.g. being shoved): side, amount 0..1
  ropePress(side, amt) { if (this.sides[side]) this.sides[side].push = Math.max(this.sides[side].push, amt); }

  _updateRopes(dt) {
    const tmp = new THREE.Vector3(), mid = new THREE.Vector3();
    for (const s of this.sides) {
      // damped spring
      s.vel += (-s.amp * 90) * dt - s.vel * 7 * dt;
      s.amp += s.vel * dt;
      const off = s.amp * 0.35 + s.push * 0.25;
      s.push *= Math.max(0, 1 - dt * 6);
      for (const r of s.ropes) {
        mid.lerpVectors(r.A, r.B, 0.5 + s.along * 0.3).addScaledVector(s.normal, off * (0.7 + r.k * 0.2));
        place(r.m1, r.A, mid, tmp); place(r.m2, mid, r.B, tmp);
      }
    }
  }

  _crowd() {
    // Seat tiers around the ring, then instanced billboard fans that bob with crowd excitement.
    const tierMat = lambert(0x16161f);
    const rnd = mulberry(11);
    const spots = [];
    for (let side = 0; side < 4; side++) {
      for (let row = 0; row < 9; row++) {
        const dist = 9.2 + row * 1.15, h = row * 0.62;
        const len = dist * 2 + 1.2;
        const tier = new THREE.Mesh(new THREE.BoxGeometry(len, 0.62, 1.15), tierMat);
        const a = side * Math.PI / 2;
        tier.position.set(Math.sin(a) * dist, h + 0.31, Math.cos(a) * dist);
        tier.rotation.y = a;
        this.group.add(tier);
        for (let x = -dist + 0.4; x < dist - 0.4; x += 0.62 + rnd() * 0.15) {
          if (side === 2 && Math.abs(x) < 7.5) continue; // gap for the titantron stage
          if (rnd() < 0.08) continue;
          const lx = x, lz = dist - 0.1;
          const px = Math.cos(a) * lx + Math.sin(a) * lz, pz = -Math.sin(a) * lx + Math.cos(a) * lz;
          spots.push({ x: px, y: h + 0.62, z: pz, rot: a + Math.PI });
        }
      }
    }
    this.people(spots);
    this.cameraFlashes();
  }
  cameraFlashes() {
    const flashTex = canvasTex(32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,240,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    });
    this.flashes = [];
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.scale.setScalar(0.9); s.visible = false;
      this.group.add(s); this.flashes.push({ s, life: 0 });
    }
  }

  _updateCrowd(dt) {
    const d = this._dummy, t = this.t, ex = this.excite;
    for (const m of this.crowdMeshes) {
      const list = m.userData.list;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const bob = Math.max(0, Math.sin(t * (4 + f.amp * 3) + f.phase)) * 0.25 * ex * f.amp;
        d.position.set(f.x, f.y + bob, f.z);
        d.rotation.set(0, f.rot, 0);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    // flashes
    if (!this.flashes) return;
    if (Math.random() < dt * (3 + ex * 18)) {
      const f = this.flashes.find(x => x.life <= 0);
      const fan = this.allFans && this.allFans[Math.floor(Math.random() * this.allFans.length)];
      if (f && fan) { f.life = 0.09; f.s.position.set(fan.x, fan.y + 0.8, fan.z); f.s.visible = true; }
    }
    for (const f of this.flashes) { if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; } }
  }

  _titantron() {
    const z = -21;
    const tex = canvasTex(640, 320, (c, w, h) => this._drawTron(c, w, h, this.title, ''), {});
    this.tronTex = tex;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
    screen.position.set(0, 9.5, z);
    this.group.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.8, 8.8, 0.6), lambert(0x0a0a10));
    frame.position.set(0, 9.5, z - 0.35);
    this.group.add(frame);
    // thin glowing trim around the screen
    const trimM = new THREE.MeshBasicMaterial({ color: 0x9b4dff, fog: false });
    for (const [wd, ht, x, y] of [[16.4, 0.12, 0, 13.56], [16.4, 0.12, 0, 5.44], [0.12, 8.2, -8.14, 9.5], [0.12, 8.2, 8.14, 9.5]]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, 0.05), trimM); t.position.set(x, y, z + 0.02); this.group.add(t);
    }
    const stage = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 5), lambert(0x15151c));
    stage.position.set(0, 0.6, z + 1.5);
    this.group.add(stage);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 10), lambert(0x22222e));
    ramp.position.set(0, 0.6, z + 8.5);
    ramp.rotation.x = 0.1;
    this.group.add(ramp);
    // one pulsing light strip along the front of the stage
    this.stageBars = [];
    const strip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x9b4dff, fog: false }));
    strip.position.set(0, 1.22, z + 4.0);
    this.group.add(strip); this.stageBars.push(strip);
  }

  // Titantron layout: portrait on the left, then a big title (up to two lines) and a subtitle,
  // each shrunk to fit so nothing ever runs off the screen.
  _drawTron(c, w, h, big, small, img = null) {
    c.save();
    const g = c.createRadialGradient(w * 0.62, h * 0.5, 10, w * 0.62, h * 0.5, w * 0.7);
    g.addColorStop(0, '#5a24a8'); g.addColorStop(0.55, '#2a0f55'); g.addColorStop(1, '#0c0518');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
    const pad = h * 0.07;
    let x0 = pad, x1 = w - pad;
    if (img) {
      const ih = h - pad * 2, iw = Math.min(ih * img.width / img.height, w * 0.42);
      c.fillStyle = '#000'; c.fillRect(pad, pad, iw, ih);
      c.drawImage(img, pad, pad, iw, ih);
      c.strokeStyle = '#9b4dff'; c.lineWidth = 5; c.strokeRect(pad, pad, iw, ih);
      x0 = pad + iw + pad;
    }
    const maxW = x1 - x0, cx = (x0 + x1) / 2;
    const font = s => `italic 900 ${s}px Impact, "Arial Black", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    // one line or two, whichever lets the title be bigger
    const words = String(big || '').split(' ');
    const fits = (ls, s) => { c.font = font(s); return ls.every(l => c.measureText(l).width <= maxW); };
    const fit = (ls, start, min) => { let s = start; while (!fits(ls, s) && s > min) s -= 2; return s; };
    let lines = [String(big || '')], size = fit(lines, Math.round(h * 0.24), 18);
    if (words.length > 1) {
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const ls = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
        c.font = font(100); const wdt = Math.max(...ls.map(l => c.measureText(l).width));
        if (!best || wdt < best.wdt) best = { ls, wdt };
      }
      const two = fit(best.ls, Math.round(h * 0.21), 18);
      if (two > size * 1.15) { lines = best.ls; size = two; }
    }
    let smallSize = Math.round(h * 0.085);
    c.font = `700 ${smallSize}px Arial, sans-serif`;
    let sm = String(small || '');
    while (sm && c.measureText(sm).width > maxW && smallSize > 13) { smallSize--; c.font = `700 ${smallSize}px Arial, sans-serif`; }
    while (sm && c.measureText(sm).width > maxW) sm = sm.slice(0, -2) + '…';
    const lineH = size * 1.02, blockH = lines.length * lineH + (sm ? smallSize * 2.2 : 0);
    let y = h / 2 - blockH / 2 + lineH / 2;
    c.font = font(size);
    for (const l of lines) {
      c.lineWidth = Math.max(4, size * 0.14); c.strokeStyle = '#000'; c.strokeText(l, cx, y);
      const tg = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.55, '#f0e2ff'); tg.addColorStop(1, '#b07cff');
      c.fillStyle = tg; c.fillText(l, cx, y);
      y += lineH;
    }
    if (sm) {
      y += smallSize * 0.35;
      c.fillStyle = '#9b4dff'; c.fillRect(cx - Math.min(maxW, 220) / 2, y - smallSize * 0.7, Math.min(maxW, 220), 3);
      c.font = `700 ${smallSize}px Arial, sans-serif`; c.fillStyle = '#ffffff';
      c.fillText(sm, cx, y + smallSize * 0.35);
    }
    c.restore();
  }
  setTron(big, small = '', img) {
    this.lastTron = [big, small, img];
    if (!this.tronTex) return;
    if (img === undefined) img = this.icon;
    const c = this.tronTex.image.getContext('2d');
    this._drawTron(c, this.tronTex.image.width, this.tronTex.image.height, big, small, img);
    this.tronTex.needsUpdate = true;
  }

  _truss() {
    const m = lambert(0x2a2a30);
    const y = RING_H + 7.2, s = 4.6;
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(s * 2 + 0.4, 0.4, 0.4), m);
      const a = i * Math.PI / 2;
      b.position.set(Math.sin(a) * s, y, Math.cos(a) * s); b.rotation.y = a;
      this.group.add(b);
    }
    // lamp cans + glow cones
    const glowTex = canvasTex(32, 64, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(13, 0); c.lineTo(19, 0); c.lineTo(32, 64); c.lineTo(0, 64); c.fill();
    });
    for (let i = 0; i < 12; i++) {
      const side = i % 4, k = Math.floor(i / 4) - 1;
      const a = side * Math.PI / 2;
      const px = Math.sin(a) * s + Math.cos(a) * k * 2.5, pz = Math.cos(a) * s - Math.sin(a) * k * 2.5;
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false }));
      can.position.set(px, y - 0.35, pz);
      this.group.add(can);
      const cone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.28, fog: false }));
      cone.center.set(0.5, 1);
      cone.scale.set(2.2, 4.5, 1);
      cone.position.set(px, y - 0.4, pz);
      this.group.add(cone);
    }
  }

  _redraw(tex, fn) {
    const c = tex.image.getContext('2d');
    fn(c, tex.image.width, tex.image.height);
    tex.needsUpdate = true;
  }
  _applyIcon() {
    if (this.matTex) this._redraw(this.matTex, this.drawMat);
    if (this.skirtTex) this._redraw(this.skirtTex, this.drawSkirt);
    if (this.barTex) this._redraw(this.barTex, this.drawBar);
    if (this.lastTron) this.setTron(...this.lastTron);
    for (const h of this.iconHooks) h();
  }
  _arenaBillboards() {
    // billboards: big hanging banners over the crowd, flanking the titantron, and above the ring
    const tex = canvasTex(256, 384, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a0a34'); g.addColorStop(1, '#05050b');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#9b4dff'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
      c.drawImage(this.icon, 16, 16, w - 32, w - 32);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'italic 900 40px Impact, Arial Black, sans-serif'; c.fillStyle = '#fff'; c.fillText('UNIVERSE', w / 2, w + 18);
      c.font = '700 18px Arial, sans-serif'; c.fillStyle = '#c9a6ff'; c.fillText('THE PODFATHER', w / 2, w + 60);
      c.fillText('★ SINCE 2025 ★', w / 2, w + 86);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0xd8d8d8 });
    const board = (wd, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, wd * 1.5), mat);
      m.position.set(x, y, z); m.rotation.y = ry; this.group.add(m);
    };
    for (const sx of [-1, 1]) {
      for (const z of [-7, 1, 9]) board(5, sx * 20.5, 10.5, z, -sx * Math.PI / 2);   // side walls over the crowd
      board(4.2, sx * 11.6, 9.5, -21.2, 0);                                           // flanking the titantron
    }
    for (const x of [-8, 0, 8]) board(4.6, x, 10.5, 21, Math.PI);                    // behind the camera side
    // smaller banners hanging from the lighting truss
    const tm = new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.DoubleSide, color: 0xcfcfcf });
    for (const [x, z, ry] of [[-4.6, 0, Math.PI / 2], [4.6, 0, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.25), tm);
      m.position.set(x, RING_H + 5.9, z); m.rotation.y = ry; this.group.add(m);
    }
  }

  update(dt) {
    this.t += dt;
    this._updateRopes(dt);
    this._updateCrowd(dt);
    for (const f of this.anims) f(dt, this.t, this);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    this.stageBars.forEach(b => b.material.color.setHSL(0.75, 0.9, 0.35 + 0.25 * pulse * Math.min(1, this.excite)));
    this.excite += (0.3 - this.excite) * Math.min(1, dt * 0.35);
  }
  pop(amount) { this.excite = Math.min(1.5, this.excite + amount); }

  // which side of the ring is closest to a point that's outside the rope limit
  sideFor(x, z) {
    if (Math.abs(z) >= Math.abs(x)) return z > 0 ? 0 : 2;
    return x > 0 ? 1 : 3;
  }
}

function place(mesh, a, b, tmp) {
  tmp.subVectors(b, a);
  const len = tmp.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, tmp.normalize());
}

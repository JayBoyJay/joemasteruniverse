// Impact sparks, slam dust and the floating player markers.
import * as THREE from 'three';
import { canvasTex } from './tex.js';

const starTex = () => canvasTex(64, 64, (c) => {
  c.translate(32, 32);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#fff6a0'); g.addColorStop(1, 'rgba(255,140,0,0)');
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 9 : 30, a = i / 16 * Math.PI * 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.fill();
});
const dustTex = () => canvasTex(32, 32, (c) => {
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(230,225,215,0.7)'); g.addColorStop(1, 'rgba(230,225,215,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
});

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.star = starTex(); this.dust = dustTex();
  }
  _sprite(map, additive) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
    this.scene.add(s);
    return s;
  }
  spark(pos, power = 1, color = 0xffffff) {
    const s = this._sprite(this.star, true);
    s.position.copy(pos);
    s.material.color.set(color);
    s.material.rotation = Math.random() * 6;
    this.parts.push({ s, life: 0.16 + 0.06 * power, max: 0.16 + 0.06 * power, grow: 0.6 + 0.5 * power, kind: 'spark' });
    for (let i = 0; i < 3 + power * 3; i++) {
      const p = this._sprite(this.star, true);
      p.position.copy(pos); p.scale.setScalar(0.12);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 3 * power);
      this.parts.push({ s: p, life: 0.25, max: 0.25, v, kind: 'bit' });
    }
  }
  slam(pos, power = 1) {
    for (let i = 0; i < 10 + power * 6; i++) {
      const s = this._sprite(this.dust, false);
      const a = Math.random() * Math.PI * 2;
      s.position.set(pos.x + Math.cos(a) * 0.3, pos.y + 0.1, pos.z + Math.sin(a) * 0.3);
      const v = new THREE.Vector3(Math.cos(a), 0.15 + Math.random() * 0.3, Math.sin(a)).multiplyScalar(1.5 + Math.random() * 2 * power);
      this.parts.push({ s, life: 0.7, max: 0.7, v, kind: 'dust' });
    }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      if (p.kind === 'spark') { p.s.scale.setScalar(p.grow * (1.3 - k * 0.5)); p.s.material.opacity = k; }
      else if (p.kind === 'bit') { p.s.position.addScaledVector(p.v, dt); p.v.y -= 9 * dt; p.s.material.opacity = k; }
      else { p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-3 * dt)); p.s.scale.setScalar(0.4 + (1 - k) * 0.9); p.s.material.opacity = k * 0.8; }
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.parts.splice(i, 1); }
    }
  }
}

// "P1" arrow above each wrestler's head
export function makeMarker(label, color) {
  const tex = canvasTex(64, 64, (c) => {
    c.fillStyle = color; c.strokeStyle = '#000'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(12, 34); c.lineTo(52, 34); c.lineTo(32, 58); c.closePath(); c.fill(); c.stroke();
    c.font = 'italic 900 30px Impact, Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeText(label, 32, 17); c.fillStyle = '#fff'; c.fillText(label, 32, 17);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  s.scale.setScalar(0.55);
  s.renderOrder = 10;
  return s;
}

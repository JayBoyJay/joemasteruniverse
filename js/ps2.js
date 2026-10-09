// PS2-era look: render the scene into a low-resolution buffer (~448 lines like NTSC PS2),
// then upscale with optional 16-bit-style ordered dithering and soft CRT scanlines.
import * as THREE from 'three';

const MODES = [
  { name: 'CRT', lines: 448, filter: THREE.LinearFilter, dither: 1, scan: 0.22 },
  { name: 'SHARP', lines: 360, filter: THREE.NearestFilter, dither: 1, scan: 0 },
  { name: 'CLEAN', lines: 0, filter: THREE.LinearFilter, dither: 0, scan: 0 },
];

export class RetroRenderer {
  constructor(canvas) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.modeIndex = 0;
    try { const m = +localStorage.getItem('tb_retro'); if (m >= 0 && m < MODES.length) this.modeIndex = m; } catch { /* ignore */ }
    this.target = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        res: { value: new THREE.Vector2(4, 4) },
        dither: { value: 1 }, scan: { value: 0.2 }, time: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 res; uniform float dither; uniform float scan; uniform float time;
        varying vec2 vUv;
        const float B[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          // a touch of saturation + contrast like a composite signal
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 1.12);
          c = (c - 0.5) * 1.05 + 0.5;
          if (dither > 0.5) {
            vec2 p = floor(vUv * res);
            int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
            c += (B[i] / 16.0 - 0.5) / 31.0;
            c = floor(c * 31.0 + 0.5) / 31.0;   // RGB555
          }
          if (scan > 0.0) {
            float s = 0.5 + 0.5 * cos(vUv.y * res.y * 6.2831853);
            c *= 1.0 - scan * s;
            c *= 1.0 + scan * 0.45;
          }
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.55;  // vignette
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMat);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.w = 0; this.h = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  get mode() { return MODES[this.modeIndex]; }
  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    try { localStorage.setItem('tb_retro', this.modeIndex); } catch { /* ignore */ }
    this.resize();
    return this.mode.name;
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const m = this.mode;
    const lines = m.lines ? Math.min(m.lines, h) : h;
    this.h = Math.max(120, Math.round(lines));
    this.w = Math.max(160, Math.round(this.h * w / h));
    this.target.setSize(this.w, this.h);
    this.target.texture.minFilter = this.target.texture.magFilter = m.filter;
    this.target.texture.needsUpdate = true;
    this.quadMat.uniforms.res.value.set(this.w, this.h);
    this.quadMat.uniforms.dither.value = m.dither;
    this.quadMat.uniforms.scan.value = m.scan;
    if (this.onResize) this.onResize(w / h);
  }
  render(scene, camera, time) {
    this.quadMat.uniforms.time.value = time;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}

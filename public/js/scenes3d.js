// 3D question scenes for the big screen (three.js), one per question (`scene` field).
// Each has two moods: "ask" while groups answer (never gives the answer away) and "reveal"
// once the answer is shown. Cartoon style like the mini games: toon shading, ink outlines,
// and bloom so candle flames, the star and halos really glow.
//   mountScene(el, name, mood) → true if it is showing (false: no WebGL or unknown scene)
//   stopScene()                → stop and detach (call before replacing the screen)
import * as THREE from 'three';
import { EffectComposer } from '/vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/three/examples/jsm/postprocessing/OutputPass.js';
import { toon, ink } from './games/toon.js';

// ------------------------------------------------------------------ small helpers
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const prog = (t, start, dur) => clamp01((t - start) / dur);                 // 0..1 between start and start+dur
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const glowColor = (hex, k) => new THREE.Color(hex).multiplyScalar(k);      // >1 so bloom picks it up
const basic = (hex, k = 1, opts = {}) => new THREE.MeshBasicMaterial({ color: glowColor(hex, k), ...opts });

function M(geo, color, { outline = 0.05, opts } = {}) {
  const m = new THREE.Mesh(geo, toon(color, opts));
  if (outline) ink(m, outline);
  return m;
}
function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
function group(...kids) { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; }

let dotTex;
function dot() {                                // soft round sprite for stars and sparkles
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// big outlined text that floats in the scene (no background pill)
function text(str, { size = 1, color = '#ffffff', stroke = '#1B1240' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 96;
  g.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
  const w = Math.ceil(g.measureText(str).width) + 40;
  c.width = w; c.height = fs + 40;
  g.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 16; g.strokeStyle = stroke; g.strokeText(str, w / 2, c.height / 2 + 4);
  g.fillStyle = color; g.fillText(str, w / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 20;
  s.scale.set((size * w) / c.height, size, 1);
  s.userData.base = s.scale.clone();
  return s;
}
const question = (size = 1.6) => text('?', { size, color: '#FFE27A' });
function popScale(obj, x) { const k = x <= 0 ? 0.0001 : backOut(x); const b = obj.userData.base || V(1, 1, 1); obj.scale.set(b.x * k, b.y * k, b.z * k); obj.visible = x > 0; }

// ------------------------------------------------------------------ shared pieces
function starfield(n = 500, spread = 60, y0 = 2) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = y0 + Math.random() * 18;
    pos[i * 3 + 2] = -12 - Math.random() * 20;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const a = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.28, map: dot(), transparent: true, depthWrite: false, color: glowColor(0xffffff, 1.4), blending: THREE.AdditiveBlending }));
  const b = a.clone(); b.material = a.material.clone(); b.rotation.y = 0.4;
  const grp = group(a, b);
  grp.userData.update = (t) => { a.material.opacity = 0.6 + 0.4 * Math.sin(t * 1.7); b.material.opacity = 0.6 + 0.4 * Math.sin(t * 1.3 + 2); };
  return grp;
}

function sparkles(n = 40, color = 0xFFE27A, box = [3, 2, 1]) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.22, map: dot(), transparent: true, depthWrite: false, color: glowColor(color, 2.5), blending: THREE.AdditiveBlending }));
  p.userData.update = (t) => {
    for (let i = 0; i < n; i++) {
      const s = seed[i], k = (t * 0.35 + s) % 1;
      pos[i * 3] = (Math.sin(s * 91) * 0.5) * box[0] + Math.sin(t + s * 10) * 0.15;
      pos[i * 3 + 1] = k * box[1];
      pos[i * 3 + 2] = (Math.cos(s * 57) * 0.5) * box[2];
    }
    g.attributes.position.needsUpdate = true;
    p.material.opacity = 0.9;
  };
  return p;
}

function confetti(n = 160) {
  const cols = [0xF472B6, 0xFFE27A, 0xA78BFA, 0x6EE7B7, 0xFFFFFF];
  const geo = new THREE.PlaneGeometry(0.14, 0.24);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
  const d = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 14, y: 6 + Math.random() * 8, z: (Math.random() - 0.5) * 4, s: 0.8 + Math.random() * 1.2, r: Math.random() * 6 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  d.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(cols[i % cols.length])));
  mesh.userData.update = (t) => {
    d.forEach((p, i) => {
      const y = ((p.y - t * p.s * 1.6) % 14 + 14) % 14 - 3;
      e.set(t * 2 + p.r, t * 3 + p.r, 0); q.setFromEuler(e);
      m4.compose(V(p.x + Math.sin(t + p.r) * 0.4, y, p.z), q, V(1, 1, 1));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

function candle(color, h = 2.2) {
  const g = new THREE.Group();
  const body = M(new THREE.CylinderGeometry(0.32, 0.34, h, 24), color);
  body.position.y = h / 2; g.add(body);
  const drip = M(new THREE.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, { outline: 0 }); drip.position.y = h; drip.scale.y = 0.25; g.add(drip);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), new THREE.MeshBasicMaterial({ color: 0x222222 })); wick.position.y = h + 0.12; g.add(wick);
  const flame = new THREE.Group(); flame.position.y = h + 0.22;
  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), basic(0xFFA020, 4)); outer.scale.set(1, 2.2, 1); outer.position.y = 0.22;
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), basic(0xFFF6D0, 6)); inner.scale.set(1, 1.8, 1); inner.position.y = 0.16;
  flame.add(outer, inner);
  const light = new THREE.PointLight(0xFFB347, 0, 6, 1.6); light.position.y = h + 0.5;
  g.add(flame, light);
  flame.scale.setScalar(0.0001); flame.visible = false;
  g.userData = {
    body, h, lit: 0,
    setColor(c) { body.material = toon(c); drip.material = toon(c); },
    update(t) {
      const L = g.userData.lit;
      flame.visible = L > 0.01;
      const f = 1 + Math.sin(t * 13 + g.id) * 0.06 + Math.sin(t * 7.3 + g.id * 2) * 0.05;
      flame.scale.set(L * (2 - f), L * f, L * (2 - f));
      flame.rotation.z = Math.sin(t * 5 + g.id) * 0.08;
      light.intensity = L * 9 * f;
    },
  };
  return g;
}

function wreath(r = 2.6) {
  const g = new THREE.Group();
  g.add(M(new THREE.TorusGeometry(r, 0.42, 14, 60), 0x1F7A4D).rotateX(Math.PI / 2));
  const leaf = new THREE.SphereGeometry(0.34, 10, 8); leaf.scale(1.6, 0.35, 0.7);
  const greens = [0x2E9E62, 0x1F7A4D, 0x3DBA74, 0x176B41];
  const N = 150, inst = new THREE.InstancedMesh(leaf, toon(0xffffff), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * 3 + Math.random() * 0.3, rr = r + (Math.random() - 0.5) * 0.7;
    e.set((Math.random() - 0.5) * 0.9, -a + (Math.random() - 0.5), (Math.random() - 0.5) * 0.9); q.setFromEuler(e);
    m4.compose(V(Math.cos(a) * rr, 0.15 + Math.random() * 0.3, Math.sin(a) * rr), q, V(1, 1, 1));
    inst.setMatrixAt(i, m4); inst.setColorAt(i, new THREE.Color(greens[i % 4]));
  }
  g.add(inst);
  const berry = new THREE.SphereGeometry(0.12, 10, 8);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.1;
    g.add(at(M(berry, 0xE11D48, { outline: 0.08 }), Math.cos(a) * (r + 0.35 * Math.sin(i * 7)), 0.5, Math.sin(a) * (r + 0.35 * Math.sin(i * 7))));
  }
  return g;
}

function starShape(R = 1, r = 0.42, pts = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}
function bigStar(size = 1) {
  const geo = new THREE.ExtrudeGeometry(starShape(size, size * 0.42, 8), { depth: 0.18 * size, bevelEnabled: true, bevelSize: 0.08 * size, bevelThickness: 0.08 * size, bevelSegments: 2 });
  geo.center();
  const star = new THREE.Mesh(geo, basic(0xFFD54A, 3.2));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: glowColor(0xFFE9A0, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(size * 5);
  const light = new THREE.PointLight(0xFFE9A0, 6, 18, 1.2);
  const g = group(halo, star, light);
  g.userData.update = (t) => { star.rotation.z = t * 0.4; halo.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.2); };
  return g;
}

function person({ robe = 0x3B82F6, scarf = 0xF8FAFC, skin = 0xF2C9A0, height = 1.8, crown = false } = {}) {
  const g = new THREE.Group();
  const body = M(new THREE.ConeGeometry(0.55, height, 20), robe); body.position.y = height / 2; g.add(body);
  const head = M(new THREE.SphereGeometry(0.3, 20, 16), skin); head.position.y = height + 0.18; g.add(head);
  if (crown) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.22, 10, 1, true), basic(0xF5C542, 1.6, { side: THREE.DoubleSide }));
    c.position.y = height + 0.48; g.add(c);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), basic(0xF5C542, 1.8)); s.position.set(Math.cos(a) * 0.28, height + 0.66, Math.sin(a) * 0.28); g.add(s); }
  } else {
    const hood = M(new THREE.SphereGeometry(0.36, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), scarf, { outline: 0.03 }); hood.position.y = height + 0.2; hood.rotation.x = -0.25; g.add(hood);
  }
  const eyes = new THREE.MeshBasicMaterial({ color: 0x1B1240 });
  [-0.1, 0.1].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyes); e.position.set(x, height + 0.2, 0.27); g.add(e); });
  g.userData.height = height;
  return g;
}

function baby() {
  const g = new THREE.Group();
  const wrap = M(new THREE.CapsuleGeometry(0.22, 0.5, 6, 14), 0xFFF7E6); wrap.rotation.z = Math.PI / 2; g.add(wrap);
  const head = M(new THREE.SphereGeometry(0.2, 16, 12), 0xF2C9A0); head.position.set(0.48, 0.05, 0); g.add(head);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 32), basic(0xFFE27A, 3)); halo.position.set(0.5, 0.42, 0); halo.rotation.x = Math.PI / 2.3; g.add(halo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: glowColor(0xFFE9A0, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2.4); g.add(glow);
  g.userData.glow = glow;
  return g;
}

function sheep() {
  const g = new THREE.Group();
  const wool = new THREE.SphereGeometry(0.32, 12, 10);
  [[0, 0.62, 0], [0.32, 0.66, 0.05], [-0.3, 0.64, -0.04], [0.05, 0.8, 0.12], [0.1, 0.62, -0.25], [-0.1, 0.62, 0.25]].forEach(([x, y, z]) => g.add(at(M(wool, 0xF8FAFC, { outline: 0.04 }), x, y, z)));
  const head = M(new THREE.SphereGeometry(0.22, 12, 10), 0x3F3A4F); head.scale.set(1, 1.1, 0.9); head.position.set(0.62, 0.78, 0); g.add(head);
  const leg = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6);
  [[0.25, 0.15], [0.25, -0.15], [-0.25, 0.15], [-0.25, -0.15]].forEach(([x, z]) => g.add(at(M(leg, 0x3F3A4F, { outline: 0 }), x, 0.22, z)));
  return g;
}

function cow() {
  const g = new THREE.Group();
  const body = M(new THREE.BoxGeometry(1.5, 0.8, 0.8, 2, 2, 2), 0xFFFFFF); body.position.y = 0.95; g.add(body);
  [[0.3, 1.2, 0.41, 0.35], [-0.35, 0.9, -0.41, 0.3], [-0.2, 1.25, 0.41, 0.22]].forEach(([x, y, z, s]) => { const sp = new THREE.Mesh(new THREE.CircleGeometry(s, 16), new THREE.MeshBasicMaterial({ color: 0x2B2233, side: THREE.DoubleSide })); sp.position.set(x, y, z); g.add(sp); });
  const neck = new THREE.Group(); neck.position.set(0.75, 1.15, 0); g.add(neck);
  const head = M(new THREE.BoxGeometry(0.55, 0.5, 0.5), 0xFFFFFF); head.position.set(0.3, 0, 0); neck.add(head);
  const snout = M(new THREE.BoxGeometry(0.2, 0.3, 0.44), 0xF9A8D4, { outline: 0.03 }); snout.position.set(0.6, -0.08, 0); neck.add(snout);
  [-0.18, 0.18].forEach((z) => { const h = M(new THREE.ConeGeometry(0.05, 0.2, 6), 0xFDE68A, { outline: 0 }); h.position.set(0.25, 0.32, z); neck.add(h); });
  const leg = new THREE.BoxGeometry(0.18, 0.6, 0.18);
  [[0.55, 0.25], [0.55, -0.25], [-0.55, 0.25], [-0.55, -0.25]].forEach(([x, z]) => g.add(at(M(leg, 0xFFFFFF, { outline: 0.04 }), x, 0.3, z)));
  g.userData.neck = neck;
  return g;
}

function camel(rider) {
  const g = new THREE.Group(), sand = 0xD9A35B;
  const body = M(new THREE.CapsuleGeometry(0.45, 1.1, 6, 14), sand); body.rotation.z = Math.PI / 2; body.position.y = 1.55; g.add(body);
  const hump = M(new THREE.SphereGeometry(0.45, 14, 10), sand); hump.scale.set(1, 0.8, 0.9); hump.position.set(-0.15, 1.95, 0); g.add(hump);
  const neck = M(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 10), sand); neck.position.set(0.95, 2.05, 0); neck.rotation.z = -0.55; g.add(neck);
  const head = M(new THREE.BoxGeometry(0.55, 0.3, 0.3), sand); head.position.set(1.32, 2.55, 0); g.add(head);
  const blanket = M(new THREE.BoxGeometry(0.9, 0.08, 1.0), 0xB91C1C, { outline: 0.03 }); blanket.position.set(-0.1, 2.32, 0); g.add(blanket);
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 1.2, 8); legGeo.translate(0, -0.6, 0);
  [[0.55, 0.25], [0.55, -0.25], [-0.6, 0.25], [-0.6, -0.25]].forEach(([x, z], i) => { const l = M(legGeo, sand, { outline: 0.04 }); l.position.set(x, 1.3, z); legs.push([l, i]); g.add(l); });
  if (rider) { rider.position.set(-0.1, 2.3, 0); rider.scale.setScalar(0.62); rider.rotation.y = Math.PI * 0.75; g.add(rider); }   // half facing the audience
  g.userData.walk = (t, speed = 1) => {
    legs.forEach(([l, i]) => { l.rotation.z = Math.sin(t * 6 * speed + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.35; });
    body.position.y = 1.55 + Math.abs(Math.sin(t * 6 * speed)) * 0.06;
    if (rider) rider.position.y = 2.3 + Math.abs(Math.sin(t * 6 * speed)) * 0.08;
  };
  return g;
}

function house(w = 1.4, h = 1.2, color = 0xE8D5B5, lit = true, dome = false) {
  const g = new THREE.Group();
  const b = M(new THREE.BoxGeometry(w, h, w * 0.9), color, { outline: 0.03 }); b.position.y = h / 2; g.add(b);
  if (dome) { const d = M(new THREE.SphereGeometry(w * 0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xDCC8A6, { outline: 0.03 }); d.position.y = h; g.add(d); }
  else { const r = M(new THREE.ConeGeometry(w * 0.8, h * 0.6, 4), 0xB45309, { outline: 0.03 }); r.rotation.y = Math.PI / 4; r.position.y = h + h * 0.3; g.add(r); }
  const win = basic(lit ? 0xFFD27A : 0x3B3060, lit ? 2.2 : 1);
  [[-w * 0.22, h * 0.55], [w * 0.22, h * 0.55]].forEach(([x, y]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.18, h * 0.22), win); m.position.set(x, y, w * 0.451); g.add(m); });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.22, h * 0.4), new THREE.MeshBasicMaterial({ color: 0x5B3A1E })); door.position.set(0, h * 0.2, w * 0.452); g.add(door);
  return g;
}
function town(lit, scale = 1) {
  const g = new THREE.Group();
  [[-1.2, 0, 1.2, 1.1, false], [0, -0.4, 1.5, 1.6, true], [1.25, 0.1, 1.1, 0.9, false], [0.5, 0.8, 1, 1.3, false]].forEach(([x, z, w, h, d]) => g.add(at(house(w, h, 0xE8D5B5, lit, d), x, 0, z)));
  g.scale.setScalar(scale);
  return g;
}

function stable() {
  const g = new THREE.Group(), wood = 0x8B5A2B;
  const post = new THREE.BoxGeometry(0.25, 3, 0.25);
  [[-3, -1], [3, -1], [-3, 1.2], [3, 1.2]].forEach(([x, z]) => g.add(at(M(post, wood, { outline: 0.04 }), x, 1.5, z)));
  const roofL = M(new THREE.BoxGeometry(3.6, 0.15, 3), 0xA0703F, { outline: 0.04 }); roofL.position.set(-1.55, 3.55, 0.1); roofL.rotation.z = 0.5; g.add(roofL);
  const roofR = roofL.clone(); roofR.position.x = 1.55; roofR.rotation.z = -0.5; g.add(roofR);
  const back = M(new THREE.BoxGeometry(6, 2.6, 0.12), 0x6B4423, { outline: 0 }); back.position.set(0, 1.3, -1.05); g.add(back);
  return g;
}
function trough() {
  const g = new THREE.Group(), wood = 0xA0703F;
  const box = M(new THREE.CylinderGeometry(0.95, 0.6, 0.6, 4, 1, true), wood, { opts: { side: THREE.DoubleSide } }); box.rotation.y = Math.PI / 4; box.scale.set(1.5, 1, 0.7); box.position.y = 0.95; g.add(box);
  const bottom = M(new THREE.BoxGeometry(1.25, 0.08, 0.6), 0x6B4423, { outline: 0 }); bottom.position.y = 0.66; g.add(bottom);
  const leg = new THREE.BoxGeometry(0.1, 0.9, 0.1);
  [[-0.7, 0.35, 0.3, 0.4], [0.7, 0.35, -0.3, -0.4], [-0.7, 0.35, -0.3, 0.4], [0.7, 0.35, 0.3, -0.4]].forEach(([x, y, z, r]) => { const l = M(leg, 0x6B4423, { outline: 0.03 }); l.position.set(x * 0.8, y, z); l.rotation.z = r; g.add(l); });
  const hay = new THREE.Group();
  const straw = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 4);
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Mesh(straw, toon(i % 3 ? 0xF2C94C : 0xE0B13A));
    s.position.set((Math.random() - 0.5) * 1.6, 1.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.6);
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2 + (Math.random() - 0.5));
    hay.add(s);
  }
  g.add(hay);
  g.userData.hay = hay;
  return g;
}
function dunes(color = 0x3B2A6B) {
  const g = new THREE.Group();
  [[-9, -6, 9], [0, -9, 12], [10, -7, 10], [-4, -2, 6], [6, -3, 7]].forEach(([x, z, r], i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), toon(i % 2 ? color : new THREE.Color(color).offsetHSL(0, 0, -0.04).getHex()));
    d.scale.y = 0.18; d.position.set(x, -r * 0.1, z); g.add(d);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), toon(new THREE.Color(color).offsetHSL(0, 0, -0.06).getHex())); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; g.add(floor);
  return g;
}
function heartGeo(size = 1) {
  const s = new THREE.Shape(), k = size;
  s.moveTo(0, -1.0 * k);
  s.bezierCurveTo(-0.2 * k, -0.75 * k, -1.2 * k, -0.2 * k, -1.2 * k, 0.35 * k);
  s.bezierCurveTo(-1.2 * k, 0.95 * k, -0.45 * k, 1.15 * k, 0, 0.6 * k);
  s.bezierCurveTo(0.45 * k, 1.15 * k, 1.2 * k, 0.95 * k, 1.2 * k, 0.35 * k);
  s.bezierCurveTo(1.2 * k, -0.2 * k, 0.2 * k, -0.75 * k, 0, -1.0 * k);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.4 * k, bevelEnabled: true, bevelSize: 0.12 * k, bevelThickness: 0.14 * k, bevelSegments: 4, curveSegments: 24 });
  g.center();
  return g;
}
function dove() {
  const g = new THREE.Group(), white = 0xFFFFFF;
  const body = M(new THREE.SphereGeometry(0.28, 14, 10), white, { outline: 0.04 }); body.scale.set(1.6, 0.9, 0.9); g.add(body);
  const head = M(new THREE.SphereGeometry(0.16, 12, 10), white, { outline: 0.04 }); head.position.set(0.42, 0.18, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), toon(0xF59E0B)); beak.rotation.z = -Math.PI / 2; beak.position.set(0.6, 0.16, 0); g.add(beak);
  const wingGeo = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(-0.3, 0, 0.9), V(0.35, 0, 0.7), V(0, 0, 0), V(0.35, 0, 0.7), V(0.3, 0, 0)]);
  wingGeo.computeVertexNormals();
  const wm = toon(white, { side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(wingGeo, wm), w2 = new THREE.Mesh(wingGeo, wm); w2.scale.z = -1;
  g.add(w1, w2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: glowColor(0xFFFFFF, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2); g.add(glow);
  g.userData.flap = (t) => { w1.rotation.x = -0.3 + Math.sin(t * 9) * 0.7; w2.rotation.x = 0.3 - Math.sin(t * 9) * 0.7; };
  return g;
}
function cloud() {
  const g = new THREE.Group(), s = new THREE.SphereGeometry(0.6, 16, 12);
  [[0, 0, 0, 1], [0.7, -0.1, 0, 0.8], [-0.7, -0.1, 0, 0.85], [0.3, 0.35, 0, 0.8], [-0.3, 0.3, 0.1, 0.75]].forEach(([x, y, z, k]) => { const m = M(s, 0xF8FAFC, { outline: 0.03 }); m.position.set(x, y, z); m.scale.setScalar(k); g.add(m); });
  return g;
}
function smoke(n = 24) {
  const mats = [], g = new THREE.Group(), seeds = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: dot(), color: 0xE9E4FF, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m); g.add(s); mats.push(s); seeds.push(Math.random());
  }
  g.userData.update = (t) => mats.forEach((s, i) => {
    const k = (t * 0.3 + seeds[i]) % 1;
    s.position.set(Math.sin(k * 6 + i) * 0.25 * k, k * 2.4, 0);
    s.scale.setScalar(0.3 + k * 0.9);
    s.material.opacity = Math.sin(k * Math.PI) * 0.55;
  });
  return g;
}

// ------------------------------------------------------------------ the scenes
// Each returns { root, camera: { pos, target }, update(t, dt), bg, day }
const PURPLE = 0x7C3AED, ROSE = 0xF472B6, IVORY = 0xE5E7EB;
const CANDLE_COLORS = [PURPLE, PURPLE, ROSE, PURPLE];

function wreathWithCandles(colors = CANDLE_COLORS, r = 2.6) {
  const root = group(wreath(r));
  const ANG = [0.75, 1.25, 1.75, 0.25].map((k) => k * Math.PI);   // around the ring: front-left, back-left, back-right, front-right
  const candles = colors.map((c, i) => {
    const a = ANG[i];
    const k = candle(c, i === 2 ? 2.1 : 2.3);
    k.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    root.add(k);
    return k;
  });
  return { root, candles };
}

const SCENES = {
  wreath(mood) {
    const { root, candles } = wreathWithCandles();
    const q = question(2); q.position.set(0, 2.6, 0); root.add(q);
    const nums = candles.map((c, i) => { const s = text(String(i + 1), { size: 0.9 }); s.position.copy(c.position).add(V(0, 3.4, 0)); root.add(s); return s; });
    const sp = sparkles(50, 0xFFE27A, [6, 4, 3]); root.add(sp);
    return {
      root, camera: { pos: [0, 5.2, 8.2], target: [0, 1.2, 0] }, spin: mood === 'ask',
      update(t) {
        sp.visible = mood === 'reveal';
        if (mood === 'ask') {
          candles.forEach((c) => { c.visible = false; });
          q.position.y = 2.6 + Math.sin(t * 2) * 0.2; q.material.rotation = Math.sin(t * 1.6) * 0.15;
          nums.forEach((n) => (n.visible = false));
          root.rotation.y = t * 0.25;
        } else {
          q.visible = false;
          candles.forEach((c, i) => {
            const rise = easeOut(prog(t, i * 0.8, 0.6));
            c.visible = rise > 0; c.position.y = 0.25 - (1 - rise) * 2.4; c.scale.setScalar(Math.max(0.001, rise));
            c.userData.lit = easeOut(prog(t, i * 0.8 + 0.5, 0.5));
            popScale(nums[i], prog(t, i * 0.8 + 0.6, 0.5));
          });
          root.rotation.y = Math.sin(t * 0.3) * 0.12;
        }
        candles.forEach((c) => c.userData.update(t));
      },
    };
  },
  'rose-candle'(mood) {
    const { root, candles } = wreathWithCandles([PURPLE, PURPLE, IVORY, PURPLE]);
    const q = question(1.4); q.position.copy(candles[2].position).add(V(0, 3.4, 0)); root.add(q);
    const joy = text('Joy!', { size: 1.3, color: '#F9A8D4' }); joy.position.set(0, 4.0, 0); root.add(joy);
    const sp = sparkles(40, 0xF472B6, [2, 3.5, 1]); sp.position.copy(candles[2].position).add(V(0, 2.2, 0)); root.add(sp);
    const ivory = new THREE.Color(IVORY), rose = new THREE.Color(ROSE);
    const roseMat = toon(IVORY).clone(); candles[2].userData.body.material = roseMat;
    return {
      root, camera: { pos: [0, 4.8, 8.4], target: [0, 1.4, 0] },
      update(t) {
        candles[0].userData.lit = 1; candles[1].userData.lit = 1;
        if (mood === 'ask') {
          joy.visible = false; sp.visible = false;
          q.position.y = candles[2].position.y + 3.4 + Math.sin(t * 2) * 0.15;
        } else {
          q.visible = false;
          const k = easeOut(prog(t, 0.4, 1.2));
          roseMat.color.lerpColors(ivory, rose, k);
          candles[2].userData.lit = easeOut(prog(t, 1.4, 0.6));
          popScale(joy, prog(t, 1.8, 0.6));
          sp.visible = t > 1.8;
        }
        root.rotation.y = Math.sin(t * 0.35) * 0.15;
        candles.forEach((c) => c.userData.update(t));
      },
    };
  },
  gaudete(mood) {
    const root = new THREE.Group();
    const c = candle(ROSE, 2.4); root.add(c);
    const base = M(new THREE.CylinderGeometry(0.8, 0.9, 0.25, 24), 0xF5C542); base.position.y = -0.1; root.add(base);
    const notes = ['♪', '♫', '♬', '♪', '♫', '♬'].map((n, i) => { const s = text(n, { size: 0.8, color: i % 2 ? '#F9A8D4' : '#FFE27A' }); root.add(s); return s; });
    const q = question(1.6); q.position.set(2.4, 3, 0); root.add(q);
    const letters = 'GAUDETE'.split('').map((ch, i) => { const s = text(ch, { size: 1.5, color: i % 2 ? '#FFE27A' : '#F9A8D4' }); s.userData.x = (i - 3) * 1.15; root.add(s); return s; });
    const rej = text('= Rejoice!', { size: 0.95 }); rej.position.set(0, 2.9, 0); root.add(rej);
    const conf = confetti(); root.add(conf);
    return {
      root, camera: { pos: [0, 2.6, 9], target: [0, 2.3, 0] },
      update(t) {
        c.userData.lit = 1; c.userData.update(t);
        notes.forEach((s, i) => { const k = (t * 0.25 + i / notes.length) % 1; s.position.set(Math.sin(i * 2.1) * 3.2 + Math.sin(t + i) * 0.3, 0.8 + k * 4.5, -0.5); s.material.opacity = Math.sin(k * Math.PI); });
        if (mood === 'ask') {
          letters.forEach((s) => (s.visible = false)); rej.visible = false; conf.visible = false;
          q.position.y = 3 + Math.sin(t * 2) * 0.2;
        } else {
          q.visible = false;
          c.position.set(0, -1.3, 0); base.position.y = -1.4;
          letters.forEach((s, i) => { popScale(s, prog(t, i * 0.15, 0.4)); s.position.set(s.userData.x, 4.4 + Math.max(0, Math.sin(t * 4 - i * 0.6)) * 0.35, 0); });
          popScale(rej, prog(t, 1.3, 0.5));
          conf.visible = t > 1.1;
        }
        conf.userData.update(t);
      },
    };
  },
  'candle-words'(mood) {
    const root = new THREE.Group(), xs = [-3.3, -1.1, 1.1, 3.3];
    const ring = wreath(4.1); ring.scale.set(1, 1, 0.42); root.add(ring);
    const words = [['Hope', '#C4B5FD'], ['Peace', '#BAE6FD'], ['Joy', '#F9A8D4'], ['Love', '#FCA5A5']];
    const cs = CANDLE_COLORS.map((col, i) => { const c = candle(col, 2.3); c.position.set(xs[i], 0.25, 0.3); root.add(c); return c; });
    const qs = xs.map((x) => { const q = question(1); q.position.set(x, 3.6, 0.3); root.add(q); return q; });
    const ws = words.map(([w, col], i) => { const s = text(w, { size: 0.85, color: col }); s.position.set(xs[i], 3.9, 0.3); root.add(s); return s; });
    return {
      root, camera: { pos: [0, 3.6, 9.4], target: [0, 1.7, 0] },
      update(t) {
        cs.forEach((c, i) => {
          if (mood === 'ask') { c.userData.lit = 0; qs[i].position.y = 3.6 + Math.sin(t * 2 + i) * 0.15; ws[i].visible = false; }
          else { qs[i].visible = false; c.userData.lit = easeOut(prog(t, i * 0.7, 0.5)); popScale(ws[i], prog(t, i * 0.7 + 0.3, 0.5)); ws[i].position.y = 3.9 + Math.sin(t * 1.5 + i) * 0.1; }
          c.userData.update(t);
        });
      },
    };
  },
  vestment(mood) {
    const root = new THREE.Group();
    const priest = new THREE.Group(); root.add(priest);
    const alb = M(new THREE.CylinderGeometry(0.55, 0.95, 3.2, 24), 0xF8F5EE); alb.position.y = 1.6; priest.add(alb);
    const head = M(new THREE.SphereGeometry(0.45, 20, 16), 0xF2C9A0); head.position.y = 3.65; priest.add(head);
    const hair = M(new THREE.SphereGeometry(0.47, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), 0x4B3621, { outline: 0.02 }); hair.position.y = 3.68; priest.add(hair);
    const chas = M(new THREE.CylinderGeometry(0.62, 1.55, 2.6, 32, 1, true), 0x16A34A, { opts: { side: THREE.DoubleSide } }); chas.position.y = 2.1; chas.scale.z = 0.62; priest.add(chas);
    const gold = basic(0xF5C542, 1.4);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, 0.05), gold); stripe.position.set(0, 2.05, 0.83); stripe.rotation.x = -0.32; priest.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.24, 0.05), gold); bar.position.set(0, 2.55, 0.7); bar.rotation.x = -0.32; priest.add(bar);
    [-0.13, 0.13].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1B1240 })); e.position.set(x, 3.7, 0.41); priest.add(e); });
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: glowColor(0xA78BFA, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); aura.scale.setScalar(7); aura.position.y = 2.2; root.add(aura);
    const q = question(1.5); q.position.set(2.4, 3.6, 0); root.add(q);
    const lbl = text('Getting ready for Jesus', { size: 0.6 }); lbl.position.set(0, 4.7, 0); root.add(lbl);
    const sp = sparkles(40, 0xC4B5FD, [4, 4.5, 2]); root.add(sp);
    const cycle = [0x16A34A, 0xDC2626, 0xF8F5EE, 0xEAB308, 0x7C3AED];
    return {
      root, camera: { pos: [0, 2.6, 8.4], target: [0, 2.2, 0] },
      update(t) {
        priest.rotation.y = Math.sin(t * 0.6) * 0.35;
        if (mood === 'ask') {
          aura.visible = false; lbl.visible = false; sp.visible = false;
          const k = Math.floor(t / 1.1) % 4;                          // green, red, white, gold… never purple yet
          chas.material = toon(cycle[k]);
          q.position.y = 3.6 + Math.sin(t * 2) * 0.15;
        } else {
          q.visible = false;
          chas.material = toon(PURPLE);
          aura.visible = true; aura.material.opacity = 0.5 + 0.3 * Math.sin(t * 2) * easeOut(prog(t, 0, 1));
          popScale(lbl, prog(t, 1, 0.5)); sp.visible = t > 0.6;
        }
      },
    };
  },
  heart(mood) {
    const root = new THREE.Group();
    const h = M(heartGeo(1.5), 0x4C3A8A, { outline: 0.03 }); h.position.y = 2.3; root.add(h);
    const q = question(1.6); q.position.set(0, 2.4, 1.2); root.add(q);
    const rays = new THREE.Group(); rays.position.set(0, 2.3, -0.6); root.add(rays);
    for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.18, 5, 4), basic(0xFFE27A, 1.6, { transparent: true, opacity: 0.55 })); r.geometry.translate(0, 2.5, 0); r.rotation.z = (i / 14) * Math.PI * 2; rays.add(r); }
    const d = dove(); root.add(d);
    const deeds = [['Say sorry', '#C4B5FD', -3.6, 3.6], ['Forgive', '#BAE6FD', 3.6, 3.6], ['Pray', '#FDE68A', -3.4, 1.1], ['Do good', '#FCA5A5', 3.4, 1.1]]
      .map(([w, c, x, y]) => { const s = text(w, { size: 0.65, color: c }); s.position.set(x, y, 0.5); root.add(s); return s; });
    return {
      root, camera: { pos: [0, 2.4, 9], target: [0, 2.3, 0] },
      update(t) {
        const beat = 1 + Math.max(0, Math.sin(t * 5)) * 0.06 * (Math.sin(t * 2.5) > 0 ? 1 : 0.4);
        h.scale.setScalar(beat); h.rotation.y = Math.sin(t * 0.7) * 0.3;
        if (mood === 'ask') {
          rays.visible = false; d.visible = false; deeds.forEach((s) => (s.visible = false));
          q.position.y = 2.4 + Math.sin(t * 2) * 0.12;
        } else {
          q.visible = false;
          h.material = toon(PURPLE);
          rays.visible = t > 0.8; rays.scale.setScalar(easeOut(prog(t, 0.8, 1))); rays.rotation.z = t * 0.2;
          deeds.forEach((s, i) => popScale(s, prog(t, 0.4 + i * 0.3, 0.5)));
          const k = easeOut(prog(t, 1.6, 2));
          d.visible = t > 1.6; d.position.set(0, 7 - k * 2.6 + Math.sin(t * 2) * 0.1 * k, 1); d.userData.flap(t);
        }
      },
    };
  },
  'two-comings'(mood) {
    const root = new THREE.Group();
    const left = new THREE.Group(); left.position.x = -3.6; root.add(left);
    const tr = trough(); tr.scale.setScalar(0.9); left.add(tr);
    const b = baby(); b.position.set(-0.2, 1.25, 0); left.add(b);
    const s1 = bigStar(0.45); s1.position.set(0, 3.6, 0); left.add(s1);
    const right = new THREE.Group(); right.position.set(3.6, 1.6, 0); root.add(right);
    const c1 = cloud(); c1.position.set(-0.6, 0, 0.3); const c2 = cloud(); c2.position.set(0.8, -0.2, 0.2); right.add(c1, c2);
    const crown = new THREE.Group(); crown.position.y = 1.4; right.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.5, 16, 1, true), basic(0xF5C542, 2, { side: THREE.DoubleSide })); crown.add(band);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 6), basic(0xF5C542, 2.2)); sp.position.set(Math.cos(a) * 0.66, 0.45, Math.sin(a) * 0.66); crown.add(sp); const j = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), basic(i % 2 ? 0xEF4444 : 0x60A5FA, 2)); j.position.set(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68); crown.add(j); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: glowColor(0xFFE9A0, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(4.5); halo.position.y = 1.2; right.add(halo);
    const l1 = text('He came', { size: 0.75 }); l1.position.set(-3.6, -0.4, 0.5); root.add(l1);
    const l2 = text('He will come again', { size: 0.75 }); l2.position.set(3.6, -0.4, 0.5); root.add(l2);
    const mid = text('We wait with joy', { size: 0.55, color: '#FFE27A' }); mid.position.set(0, 4.3, 0); root.add(mid);
    // a path of light between the two
    const pts = Array.from({ length: 40 }, (_, i) => { const k = i / 39; return V(-3.2 + k * 6.4, 3.0 + Math.sin(k * Math.PI) * 1.0, 0); });
    const pg = new THREE.BufferGeometry().setFromPoints(pts);
    const path = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.22, map: dot(), color: glowColor(0xFFE27A, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); root.add(path);
    const hour = new THREE.Group(); hour.position.set(0, 2, 0); root.add(hour);
    const glass = new THREE.MeshToonMaterial({ color: 0xBAE6FD, transparent: true, opacity: 0.55 });
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 24, 1, true), glass); top.rotation.x = Math.PI; top.position.y = 0.6;
    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 24, 1, true), glass); bot.position.y = -0.6;
    const sand = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 20), toon(0xF2C94C)); sand.position.y = -0.9;
    const caps = [1.25, -1.25].map((y) => at(M(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 24), 0x8B5A2B), 0, y, 0));
    hour.add(top, bot, sand, ...caps);
    const qa = question(1.5), qb = question(1.5); qa.position.set(-3.6, 2, 0); qb.position.set(3.6, 2, 0); root.add(qa, qb);
    return {
      root, camera: { pos: [0, 2.4, 10.5], target: [0, 1.8, 0] },
      update(t) {
        const ask = mood === 'ask';
        [left, right, l1, l2, mid, path].forEach((o) => (o.visible = !ask));
        hour.visible = ask; qa.visible = qb.visible = ask;
        if (ask) {
          hour.rotation.z = Math.floor(t / 2.5) * Math.PI + easeOut(prog(t % 2.5, 2, 0.5)) * Math.PI;
          qa.position.y = 2 + Math.sin(t * 2) * 0.15; qb.position.y = 2 + Math.sin(t * 2 + 1) * 0.15;
          return;
        }
        left.scale.setScalar(Math.max(0.001, backOut(prog(t, 0, 0.7))));
        right.scale.setScalar(Math.max(0.001, backOut(prog(t, 1, 0.7))));
        popScale(l1, prog(t, 0.4, 0.5)); popScale(l2, prog(t, 1.4, 0.5)); popScale(mid, prog(t, 2.2, 0.5));
        path.material.opacity = prog(t, 1.8, 0.8) * (0.6 + 0.4 * Math.sin(t * 3));
        crown.rotation.y = t * 0.6; crown.position.y = 1.4 + Math.sin(t * 1.5) * 0.1;
        s1.userData.update(t); b.userData.glow.material.opacity = 0.6 + 0.3 * Math.sin(t * 2);
      },
    };
  },
  visitation(mood) {
    const root = new THREE.Group();
    const grass = 0x3FA35C;
    [[-7, -5, 8], [6, -6, 9], [0, -14, 14]].forEach(([x, z, r]) => { const hl = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), toon(grass)); hl.scale.y = 0.25; hl.position.set(x, -r * 0.12, z); root.add(hl); });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), toon(0x2F8A4B)); floor.rotation.x = -Math.PI / 2; root.add(floor);
    const h = house(2.4, 2, 0xF5E6C8, false); h.position.set(3.8, 0, -1); h.rotation.y = -0.4; root.add(h);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), basic(0xFFD54A, 2.2)); sun.position.set(8, 7, -12); root.add(sun);
    const mary = person({ robe: 0x3B82F6, scarf: 0xF8FAFC }); root.add(mary);
    const eliz = person({ robe: 0xB45309, scarf: 0xD6D3D1, height: 1.7 }); root.add(eliz);
    const little = baby(); little.scale.setScalar(0.7); root.add(little);
    const heart = text('❤', { size: 1, color: '#F43F5E' }); root.add(heart);
    const lbl = text('Baby John leapt for joy!', { size: 0.75 }); lbl.position.set(0, 4.3, 0); root.add(lbl);
    const sp = sparkles(30, 0xFFE27A, [1.5, 2.5, 1]); root.add(sp);
    return {
      root, camera: { pos: [0, 3, 10], target: [0, 1.6, 0] }, day: true,
      update(t) {
        if (mood === 'ask') {
          const k = (t % 7) / 7;                                   // Mary walks over the hills to Elizabeth's house
          mary.position.set(-6 + k * 7.4, Math.abs(Math.sin(t * 6)) * 0.08, 0.5); mary.rotation.y = Math.PI / 2 * 0.6;
          mary.rotation.z = Math.sin(t * 6) * 0.05;
          eliz.position.set(3.3, 0, 0.6); eliz.rotation.y = -0.5;
          little.visible = false; heart.visible = false; lbl.visible = false; sp.visible = false;
        } else {
          const k = easeOut(prog(t, 0, 1.2));
          mary.position.set(-2.2 + k * 1.5, 0, 0.6); mary.rotation.set(0, 0.6, Math.sin(t * 2) * 0.06 * k);
          eliz.position.set(1.0, 0, 0.6); eliz.rotation.set(0, -0.6, -Math.sin(t * 2) * 0.06 * k);
          popScale(heart, prog(t, 1, 0.5)); heart.position.set(0.15, 2.9 + Math.sin(t * 3) * 0.1, 0.6);
          little.visible = t > 1.4;
          const leap = Math.abs(Math.sin((t - 1.4) * 3.2));
          little.position.set(1.0, 2.6 + leap * 0.9, 0.9); little.rotation.z = Math.sin(t * 6) * 0.3;
          sp.visible = t > 1.4; sp.position.set(1.0, 2.2, 0.9);
          popScale(lbl, prog(t, 1.6, 0.5));
        }
      },
    };
  },
  bethlehem(mood) {
    const root = new THREE.Group();
    root.add(dunes());
    const towns = [-5.5, 0, 5.5].map((x, i) => { const tw = town(mood === 'reveal' && i === 2, i === 2 && mood === 'reveal' ? 1.15 : 0.9); tw.position.set(x, 0, -1); root.add(tw); return tw; });
    const star = bigStar(0.7); root.add(star);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color: glowColor(0xFFE9A0, 1), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(5.5, 3, -1); root.add(beam);
    const lbl = text('Bethlehem', { size: 1.2 }); lbl.position.set(1.4, 4.2, 0); root.add(lbl);
    const sub = text('the city of King David', { size: 0.5 }); sub.position.set(1.4, 3.3, 0); root.add(sub);
    return {
      root, camera: { pos: [0, 3.4, 12], target: [0, 2.4, 0] },
      update(t) {
        star.userData.update(t);
        if (mood === 'ask') {
          star.position.set(Math.sin(t * 0.6) * 5.5, 5.6 + Math.sin(t * 1.3) * 0.3, -1);   // wandering over every town
          lbl.visible = sub.visible = false;
        } else {
          const k = easeOut(prog(t, 0, 2));
          star.position.set(-5.5 + k * 11, 6.2 - k * 0.2, -1);
          beam.material.opacity = 0.22 * prog(t, 1.8, 1) * (0.8 + 0.2 * Math.sin(t * 2));
          popScale(lbl, prog(t, 2, 0.5)); popScale(sub, prog(t, 2.3, 0.5));
        }
      },
    };
  },
  manger(mood) {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), toon(0x5B3A1E)); floor.rotation.x = -Math.PI / 2; root.add(floor);
    root.add(stable());
    const lamp = new THREE.PointLight(0xFFC27A, 6, 10, 1.4); lamp.position.set(0, 3, 2); root.add(lamp);
    const tr = trough(); root.add(tr);
    const c = cow(); c.position.set(2.7, 0, -0.1); c.rotation.y = Math.PI; c.scale.setScalar(0.95); root.add(c);
    const sh = sheep(); sh.position.set(-2.3, 0, 0.5); sh.rotation.y = 0.4; root.add(sh);
    const sh2 = sheep(); sh2.position.set(-1.4, 0, 1.4); sh2.rotation.y = 0.9; sh2.scale.setScalar(0.8); root.add(sh2);
    const b = baby(); b.position.set(-0.2, 1.35, 0); root.add(b);
    const star = bigStar(0.5); star.position.set(0, 5, 0); root.add(star);
    const q = question(1.4); q.position.set(0, 2.3, 0.4); root.add(q);
    const lbl = text('A feeding box for the animals', { size: 0.6 }); lbl.position.set(0, 4.3, 0.5); root.add(lbl);
    return {
      root, camera: { pos: [0, 3.2, 9.5], target: [0, 1.7, 0] },
      update(t) {
        star.userData.update(t);
        sh.position.y = Math.abs(Math.sin(t * 1.5)) * 0.05;
        if (mood === 'ask') {
          tr.userData.hay.visible = false; b.visible = false; lbl.visible = false; star.visible = false;
          q.position.y = 2.3 + Math.sin(t * 2) * 0.15;
          c.userData.neck.rotation.z = Math.sin(t * 0.8) * 0.1;
        } else {
          q.visible = false;
          const hk = easeOut(prog(t, 0.2, 0.8));
          tr.userData.hay.visible = hk > 0; tr.userData.hay.scale.set(1, Math.max(0.01, hk), 1);
          c.userData.neck.rotation.z = -0.5 - Math.max(0, Math.sin(t * 3)) * 0.25 * (t > 0.8 ? 1 : 0);   // munching the hay
          popScale(lbl, prog(t, 0.9, 0.5));
          b.visible = t > 2.2; b.scale.setScalar(Math.max(0.001, easeOut(prog(t, 2.2, 0.8))));
          b.userData.glow.material.opacity = 0.6 + 0.3 * Math.sin(t * 2);
          star.visible = t > 2.6;
        }
      },
    };
  },
  magi(mood) {
    const root = new THREE.Group();
    root.add(dunes(0x4A3478));
    const star = bigStar(0.65); root.add(star);
    const kings = [[0x7C3AED, 0xF2C9A0], [0xB91C1C, 0x8D5524], [0x0F766E, 0xC68642]].map(([robe, skin]) => person({ robe, skin, crown: true }));
    const camels = kings.map((k) => { const c = camel(k); c.rotation.y = Math.PI; root.add(c); return c; });
    const qs = [2, 4, 6].map((x) => { const q = question(1.2); q.position.set(x - 1, 1.2, 0); root.add(q); return q; });
    const lbl = text('The Wise Men', { size: 1 }); lbl.position.set(1.2, 5.4, 0); root.add(lbl);
    const sub = text('followed the star', { size: 0.5 }); sub.position.set(1.2, 4.6, 0); root.add(sub);
    return {
      root, camera: { pos: [0, 3.4, 12.5], target: [0, 2.4, 0] },
      update(t) {
        star.userData.update(t);
        if (mood === 'ask') {
          star.position.set(-5 + Math.sin(t * 0.5) * 0.6, 6 + Math.sin(t * 1.3) * 0.2, -2);
          camels.forEach((c) => (c.visible = false)); lbl.visible = sub.visible = false;
          qs.forEach((q, i) => (q.position.y = 1.2 + Math.sin(t * 2 + i) * 0.2));
        } else {
          qs.forEach((q) => (q.visible = false));
          star.position.set(-5.5, 6.2, -2);
          camels.forEach((c, i) => {
            const k = easeOut(prog(t, i * 0.4, 3.2));
            c.position.set(10 - k * (11.5 - i * 3.6), 0, 0.3 - i * 0.2);
            c.userData.walk(t + i, k < 1 ? 1 : 0.15);
          });
          popScale(lbl, prog(t, 2.4, 0.5)); popScale(sub, prog(t, 2.7, 0.5));
        }
      },
    };
  },
  gifts(mood) {
    const root = new THREE.Group();
    const table = M(new THREE.CylinderGeometry(5.5, 5.5, 0.3, 40), 0x6B4423); table.scale.z = 0.35; table.position.y = -0.15; root.add(table);
    const xs = [-3.2, 0, 3.2], wraps = [[0xDC2626, 0xFDE68A], [0x2563EB, 0xF8FAFC], [0x16A34A, 0xFCA5A5]];
    const boxes = xs.map((x, i) => {
      const g = new THREE.Group(); g.position.x = x;
      const b = M(new THREE.BoxGeometry(1.5, 1.3, 1.5), wraps[i][0]); b.position.y = 0.65; g.add(b);
      const lid = new THREE.Group(); lid.position.set(-0.78, 1.3, 0); g.add(lid);
      const lm = M(new THREE.BoxGeometry(1.65, 0.3, 1.65), wraps[i][0]); lm.position.set(0.78, 0.15, 0); lid.add(lm);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.32, 1.52), toon(wraps[i][1])); rib.position.y = 0.65; g.add(rib);
      const rib2 = new THREE.Mesh(new THREE.BoxGeometry(1.67, 0.32, 0.26), toon(wraps[i][1])); rib2.position.set(0.78, 0.15, 0); lid.add(rib2);
      const bow = M(new THREE.TorusKnotGeometry(0.18, 0.07, 40, 6), wraps[i][1], { outline: 0 }); bow.position.set(0.78, 0.45, 0); lid.add(bow);
      root.add(g); g.userData.lid = lid;
      return g;
    });
    // gold, frankincense, myrrh
    const gold = new THREE.Group(); gold.position.set(-3.2, 1.3, 0);
    const goldMat = basic(0xF5C542, 1.35);
    [[-0.32, 0, 0], [0.32, 0, 0], [0, 0.28, 0]].forEach(([x, y]) => { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.26, 4), goldMat); bar.rotation.y = Math.PI / 4; bar.scale.set(1.4, 1, 0.8); bar.position.set(x, y + 0.13, 0); gold.add(bar); });
    const incense = new THREE.Group(); incense.position.set(0, 1.3, 0);
    const bowl = M(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xB7791F, { opts: { side: THREE.DoubleSide } }); bowl.position.y = 0.55; incense.add(bowl);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), basic(0xFF7A1A, 2.5)); ember.rotation.x = -Math.PI / 2; ember.position.y = 0.5; incense.add(ember);
    const sm = smoke(); sm.position.y = 0.6; incense.add(sm);
    const myrrh = new THREE.Group(); myrrh.position.set(3.2, 1.3, 0);
    const prof = [V(0, 0, 0), V(0.35, 0.02, 0), V(0.45, 0.3, 0), V(0.42, 0.7, 0), V(0.2, 0.95, 0), V(0.16, 1.15, 0), V(0.26, 1.25, 0)].map((p) => new THREE.Vector2(p.x, p.y));
    const jar = M(new THREE.LatheGeometry(prof, 28), 0xC2410C, { opts: { side: THREE.DoubleSide } }); myrrh.add(jar);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 28), goldMat); band.rotation.x = Math.PI / 2; band.position.y = 0.55; myrrh.add(band);
    const items = [gold, incense, myrrh]; items.forEach((it) => root.add(it));
    const names = [['Gold', 'for a King'], ['Frankincense', 'for God'], ['Myrrh', 'for His burial']].map(([a, b], i) => {
      const s = text(a, { size: 0.65, color: '#FFE27A' }); s.position.set(xs[i], 3.9, 0.5); root.add(s);
      const s2 = text(b, { size: 0.42 }); s2.position.set(xs[i], 3.35, 0.5); root.add(s2);
      return [s, s2];
    });
    const sp = sparkles(50, 0xFFE27A, [9, 3, 2]); sp.position.y = 1; root.add(sp);
    const q = question(1.4); q.position.set(0, 3.4, 0); root.add(q);
    return {
      root, camera: { pos: [0, 3.4, 9.6], target: [0, 1.7, 0] },
      update(t) {
        sm.userData.update(t);
        if (mood === 'ask') {
          items.forEach((it) => (it.visible = false)); names.flat().forEach((s) => (s.visible = false)); sp.visible = false;
          boxes.forEach((b, i) => { const w = (t * 1.2 + i * 0.5) % 2.2; b.rotation.z = w < 0.5 ? Math.sin(w * 25) * 0.08 : 0; b.userData.lid.rotation.z = 0; });
          q.position.y = 3.4 + Math.sin(t * 2) * 0.15;
        } else {
          q.visible = false;
          boxes.forEach((b, i) => {
            const k = easeOut(prog(t, i * 0.7, 0.6));
            b.rotation.z = 0; b.userData.lid.rotation.z = k * 1.9;
            const it = items[i], r = easeOut(prog(t, i * 0.7 + 0.3, 0.7));
            it.visible = r > 0; it.position.y = 0.9 + r * 0.9 + Math.sin(t * 1.5 + i) * 0.06; it.rotation.y = t * 0.5;
            popScale(names[i][0], prog(t, i * 0.7 + 0.6, 0.5)); popScale(names[i][1], prog(t, i * 0.7 + 0.8, 0.5));
          });
          sp.visible = t > 0.6;
        }
      },
    };
  },
  stars(mood) {
    const root = new THREE.Group();
    root.add(dunes(0x2A1D52));
    const star = bigStar(1); star.position.set(0, 4, -2); root.add(star);
    const q = question(2); q.position.set(0, 3.6, 0); root.add(q);
    return { root, camera: { pos: [0, 2.6, 11], target: [0, 3, 0] }, update(t) { star.visible = mood === 'reveal'; q.visible = mood === 'ask'; star.userData.update(t); q.position.y = 3.6 + Math.sin(t * 2) * 0.2; } };
  },
  snow(mood) {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 40), toon(0xEEF2FF)); floor.rotation.x = -Math.PI / 2; root.add(floor);
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 24; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: dot(), transparent: true, depthWrite: false, color: 0xffffff })); root.add(flakes);
    const man = new THREE.Group(); root.add(man);
    [[0.9, 0.9], [0.65, 2.2], [0.45, 3.2]].forEach(([r, y]) => man.add(at(M(new THREE.SphereGeometry(r, 24, 16), 0xFFFFFF), 0, y, 0)));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), toon(0xF97316)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 3.2, 0.55); man.add(nose);
    const q = question(1.8); q.position.set(0, 2.6, 0); root.add(q);
    return {
      root, camera: { pos: [0, 2.8, 10], target: [0, 2, 0] },
      update(t, dt) {
        for (let i = 0; i < n; i++) { pos[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.12); pos[i * 3] += Math.sin(t + i) * dt * 0.2; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 10; }
        g.attributes.position.needsUpdate = true;
        man.visible = mood === 'reveal'; man.scale.setScalar(Math.max(0.001, backOut(prog(t, 0, 0.8)))); q.visible = mood === 'ask';
      },
    };
  },
};

// ------------------------------------------------------------------ renderer (one, reused)
let R = null, current = null;
function renderer() {
  if (R) return R;
  try {
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    canvas.className = 'scene3d';
    R = { r, canvas };
  } catch (e) { R = { failed: true }; }
  return R;
}

export function stopScene() {
  if (!current) return;
  cancelAnimationFrame(current.raf);
  current.ro?.disconnect();
  current.scene.traverse((o) => {
    if (o.isMesh || o.isPoints) o.geometry?.dispose();
    if (o.isSprite && o.material.map && o.material.map !== dotTex) { o.material.map.dispose(); o.material.dispose(); }
  });
  current.composer?.dispose?.();
  current.canvas.remove();
  current = null;
}

export const has3D = (name) => !!SCENES[name];

export function mountScene(el, name, mood) {
  const key = name + ':' + (mood === 'reveal' ? 'reveal' : 'ask');
  if (current && current.key === key && el) {             // same scene (showcase → answering): keep it playing
    el.innerHTML = ''; el.appendChild(current.canvas);
    current.ro.disconnect(); current.ro.observe(el); current.el = el; current.size();
    return true;
  }
  stopScene();
  const make = SCENES[name];
  if (!make || !el) return false;
  const rr = renderer();
  if (rr.failed) return false;
  const { r, canvas } = rr;
  const def = make(mood === 'reveal' ? 'reveal' : 'ask');
  const scene = new THREE.Scene();
  const day = !!def.day;
  scene.background = new THREE.Color(day ? 0x8ED6FF : 0x150C36);
  scene.fog = new THREE.Fog(day ? 0xBEE7FF : 0x150C36, 16, 40);
  scene.add(new THREE.HemisphereLight(day ? 0xFFFFFF : 0x9C8CFF, day ? 0x3FA35C : 0x1B1240, day ? 0.9 : 1.1));
  const moon = new THREE.DirectionalLight(day ? 0xFFF4D6 : 0xC7C2FF, day ? 1.3 : 1.1); moon.position.set(4, 8, 6); scene.add(moon);
  if (!day) scene.add(starfield());
  scene.add(def.root);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  const target = V(...def.camera.target), base = V(...def.camera.pos);
  el.innerHTML = ''; el.appendChild(canvas);
  const composer = new EffectComposer(r);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), day ? 0.5 : 0.85, 0.55, day ? 1.2 : 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const size = () => {
    const box = me.el;
    const w = Math.max(50, box.clientWidth), h = Math.max(50, box.clientHeight);
    r.setSize(w, h, false); composer.setSize(w, h);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camera.aspect = w / h;
    // composed for about 11 units of width: narrow boxes move the camera back
    const k = Math.max(1, 1.5 / camera.aspect);
    camera.position.copy(target).addScaledVector(base.clone().sub(target), k);
    camera.userData.pos = camera.position.clone();
    camera.updateProjectionMatrix();
  };
  const me = { raf: 0, scene, composer, canvas, key, el, size };
  size();
  const ro = new ResizeObserver(size); ro.observe(el); me.ro = ro;
  const t0 = performance.now(); let last = t0;
  const stillLive = () => current === me && canvas.isConnected;
  const loop = (now) => {
    if (!stillLive()) { if (current === me) stopScene(); return; }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    def.update(t, dt);
    scene.traverse((o) => o.userData?.update && o !== def.root && o.userData.update !== def.update && typeof o.userData.update === 'function' && o.userData.update(t, dt));
    const p = camera.userData.pos;                              // a slow, gentle drift so the scene feels alive
    camera.position.set(p.x + Math.sin(t * 0.25) * 0.5, p.y + Math.sin(t * 0.33) * 0.15, p.z);
    camera.lookAt(target);
    composer.render(dt);
    me.raf = requestAnimationFrame(loop);
  };
  current = me;
  me.raf = requestAnimationFrame(loop);
  return true;
}

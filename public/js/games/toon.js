// Cartoon rendering helpers: cel-shaded materials, ink outlines, name labels.
import * as THREE from 'three';

let gradient;
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.map && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
  if (!opts.map) matCache.set(key, m);
  return m;
}

const inkMat = new THREE.MeshBasicMaterial({ color: 0x15102e, side: THREE.BackSide });
// Inverted-hull outline: a slightly larger black copy rendered back-faces only
export function ink(mesh, thickness = 0.06) {
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  o.scale.setScalar(1 + thickness);
  o.castShadow = false;
  mesh.add(o);
  return mesh;
}

export function mesh(geo, color, { outline = 0.06, shadow = true, opts } = {}) {
  const m = new THREE.Mesh(geo, toon(color, opts));
  m.castShadow = shadow; m.receiveShadow = true;
  if (outline) ink(m, outline);
  return m;
}

export function labelSprite(text, bg = '#1B1446', fg = '#ffffff', scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 44;
  ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  c.width = w; c.height = fs + 24;
  ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
  ctx.fillStyle = bg;
  const r = c.height / 2;
  ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 10;
  const h = 0.9 * scale;
  s.scale.set((h * w) / c.height, h, 1);
  return s;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeRenderer(mount) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  return renderer;
}

// Scenes are composed for a 16:9 screen. On a narrower screen (4:3 or 16:10 projector)
// the camera backs away along its view line so the same width of the world stays in shot.
export function frameCamera(camera, pos, target, designAspect = 16 / 9) {
  camera.userData.frame = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), designAspect };
}

export function fit(renderer, camera, mount) {
  const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  const f = camera.userData.frame;
  if (f) {
    const k = Math.max(1, f.designAspect / camera.aspect);
    camera.position.copy(f.target).addScaledVector(f.pos.clone().sub(f.target), k);
    camera.lookAt(f.target);
  }
  camera.updateProjectionMatrix();
}

// Free GPU memory and the WebGL context when a mini game ends.
export function disposeScene(scene, renderer) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
  });
  renderer.dispose();
  renderer.forceContextLoss();
}

// A phone that stops sending (screen locked, Wi-Fi blip) shouldn't keep steering.
export const INPUT_TIMEOUT = 600;

export const COLORS_HEX = (c) => new THREE.Color(c || '#E5383B');

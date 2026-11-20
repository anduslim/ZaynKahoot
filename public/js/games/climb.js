// Hero Tower Escape — a ladders-and-bricks climber rendered in cartoon 3D.
import * as THREE from 'three';
import { mesh, toon, ink, labelSprite, canvasTexture, makeRenderer, fit } from './toon.js';

const FLOORS = 6;            // ground (0) .. roof (5)
const FH = 3.2;              // floor height
const HALF = 15.5;           // half width of the tower
const LADDERS = [11.5, -11.5, 6, -9, 10.5];   // ladder from floor i to i+1
const EXIT_X = -12.5;        // exit door on top floor
const DURATION = 90;
const RUN = 7.2, CLIMB = 3.6;

export function startClimb({ mount, players, heroImgs = [], sound, onStatus, onFinish }) {
  const renderer = makeRenderer(mount);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120E33');
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 200);
  camera.position.set(0, 9.2, 37.5);
  camera.lookAt(0, 9.2, 0);
  const resize = () => fit(renderer, camera, mount);
  resize(); window.addEventListener('resize', resize);

  scene.add(new THREE.HemisphereLight('#ffffff', '#3b2f86', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(8, 22, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -6 });
  scene.add(sun);

  // --- back wall with windows
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), toon('#241C5E'));
  wall.position.set(0, 8, -2.2); wall.receiveShadow = true; scene.add(wall);
  for (let i = 0; i < 18; i++) {
    const w = mesh(new THREE.BoxGeometry(1.4, 1.1, 0.1), i % 5 === 0 ? '#FFD66B' : '#3B2F86', { outline: 0.08, shadow: false });
    w.position.set(-14 + (i % 6) * 5.6, 1.6 + Math.floor(i / 6) * 6.4, -2.1); scene.add(w);
  }
  // moon + stars
  const moon = mesh(new THREE.SphereGeometry(1.6, 24, 16), '#FFF1B8', { outline: 0.05, shadow: false });
  moon.position.set(17.5, 17.5, -1.5); scene.add(moon);

  // --- bricks
  const brickTex = canvasTexture(256, 64, (c, w, h) => {
    c.fillStyle = '#7A2E1F'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let i = -1; i < 5; i++) {
      c.fillStyle = (i + r) % 3 ? '#C2573C' : '#B04A32';
      c.fillRect(i * 64 + (r ? 32 : 0) + 3, r * 32 + 3, 58, 26);
    }
  });
  brickTex.wrapS = THREE.RepeatWrapping; brickTex.repeat.set(16, 1);
  const brickMat = toon('#ffffff', { map: brickTex });
  const floorY = (i) => i * FH;
  for (let i = 0; i < FLOORS; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 1, 0.7, 3), brickMat);
    slab.position.set(0, floorY(i) - 0.35, 0); slab.receiveShadow = true; slab.castShadow = true;
    ink(slab, 0.01); scene.add(slab);
  }
  // --- ladders
  const ladderMat = '#EAF2FF';
  LADDERS.forEach((x, i) => {
    const g = new THREE.Group();
    const h = FH + 0.4;
    [-0.45, 0.45].forEach((dx) => { const r = mesh(new THREE.BoxGeometry(0.16, h, 0.16), ladderMat, { outline: 0.15 }); r.position.set(dx, h / 2, 0); g.add(r); });
    for (let y = 0.4; y < h; y += 0.55) { const r = mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), ladderMat, { outline: 0 }); r.position.set(0, y, 0); g.add(r); }
    g.position.set(x, floorY(i), 0.9); scene.add(g);
  });
  // --- exit door
  const door = mesh(new THREE.BoxGeometry(2, 2.8, 0.4), '#1E7D3A', { outline: 0.05 });
  door.position.set(EXIT_X, floorY(5) + 1.4, -0.6); scene.add(door);
  const sign = labelSprite('EXIT', '#2BA84A', '#ffffff', 1.4); sign.position.set(EXIT_X, floorY(5) + 3.4, -0.4); scene.add(sign);
  const arrow = labelSprite('◀ ESCAPE!', '#FFC93C', '#1B1446', 0.9); arrow.position.set(EXIT_X + 4.2, floorY(5) + 3.2, 0); scene.add(arrow);

  // --- patrol bots
  const bots = [
    { floor: 1, min: -10, max: 6, x: -2, dir: 1, speed: 2.6 },
    { floor: 2, min: -6, max: 9, x: 5, dir: -1, speed: 3 },
    { floor: 4, min: -6, max: 8, x: 0, dir: 1, speed: 3.3 },
  ];
  bots.forEach((b) => {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(1.3, 1.1, 1), '#7C3AED', { outline: 0.08 }); body.position.y = 0.75; g.add(body);
    [-0.3, 0.3].forEach((dx) => { const e = mesh(new THREE.SphereGeometry(0.16, 12, 8), '#FFC93C', { outline: 0.2, shadow: false }); e.position.set(dx, 0.9, 0.52); g.add(e); });
    const ant = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), '#C4B5FD', { outline: 0 }); ant.position.y = 1.55; g.add(ant);
    const tip = mesh(new THREE.SphereGeometry(0.14, 10, 8), '#E5383B', { outline: 0.2, shadow: false }); tip.position.y = 1.85; g.add(tip);
    g.position.set(b.x, floorY(b.floor), 0.3);
    b.g = g; scene.add(g);
  });

  // --- players
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const heroTex = (i) => {
    const src = heroImgs[i] || heroImgs[0];
    if (!src) return null;
    if (!texCache[src]) { texCache[src] = loader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; }); }
    return texCache[src];
  };
  const P = new Map();
  players.forEach((p, idx) => {
    const g = new THREE.Group();
    const tex = heroTex(p.hero ?? 0);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const spr = new THREE.Sprite(mat); spr.center.set(0.5, 0); spr.scale.set(1.1, 2.3, 1);
    if (tex && tex.image) adjust(spr, tex.image);
    else if (tex) tex.onUpdate = () => adjust(spr, tex.image);
    g.add(spr);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const lab = labelSprite(p.name, p.avatar?.color || '#E5383B', '#fff', 0.7); lab.position.y = 2.8; g.add(lab);
    const star = labelSprite('💫', 'rgba(0,0,0,0)', '#fff', 0.9); star.position.y = 2.2; star.visible = false; g.add(star);
    const x = -13 + (idx % 12) * 1.9 + Math.floor(idx / 12) * 0.9;
    g.position.set(x, 0, 0.6 + (idx % 4) * 0.12);
    scene.add(g);
    P.set(p.id, { id: p.id, bot: p.bot, name: p.name, g, spr, star, x, y: 0, f: 0, climbing: false, stun: 0, immune: 0, steer: 0, done: false, doneAt: 0, bob: Math.random() * 6 });
  });
  function adjust(spr, img) { if (img && img.width) spr.scale.set((2.3 * img.width) / img.height, 2.3, 1); }

  // --- HUD
  const hud = document.createElement('div');
  hud.innerHTML = `<div class="mg-bar"><span>TIME <b id="c-time">${DURATION}</b></span><span id="c-fin">FINISHED: —</span><span style="margin-left:auto">Tilt to run · ladders climb by themselves</span></div><div class="countdown" id="c-cd"></div>`;
  mount.appendChild(hud);
  const elTime = hud.querySelector('#c-time'), elFin = hud.querySelector('#c-fin'), elCd = hud.querySelector('#c-cd');

  // --- loop
  let acc = 0; const FIX = 1 / 60;
  let raf, last = performance.now(), t0 = 0, running = false, ended = false, statusT = 0;
  const finished = [];
  (async () => {
    for (const n of ['3', '2', '1']) { elCd.textContent = n; sound.play('beep'); await wait(800); }
    elCd.textContent = 'GO!'; sound.play('go'); running = true; t0 = performance.now();
    await wait(700); elCd.textContent = '';
  })();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const t = now / 1000;
    if (running) {
      acc += dt; let n = 0;
      while (acc >= FIX && n++ < 15) {
        acc -= FIX;
        bots.forEach((b) => { b.x += b.dir * b.speed * FIX; if (b.x > b.max || b.x < b.min) b.dir *= -1; });
        for (const p of P.values()) if (!p.done) step(p, FIX, t);
      }
    }
    bots.forEach((b) => {
      b.g.position.x = b.x; b.g.position.y = floorY(b.floor) + Math.abs(Math.sin(t * 6)) * 0.15;
      b.g.rotation.y = b.dir > 0 ? 0.3 : -0.3;
    });
    for (const p of P.values()) {
      p.g.position.x = p.x; p.g.position.y = p.y;
      const moving = Math.abs(p.steer) > 0.15 || p.climbing;
      p.spr.position.y = moving && !p.stun ? Math.abs(Math.sin(t * 12 + p.bob)) * 0.18 : 0;
      p.spr.material.rotation = p.climbing ? Math.sin(t * 10) * 0.12 : p.stun ? Math.sin(t * 20) * 0.25 : -p.steer * 0.12;
      p.star.visible = p.stun > 0;
    }
    if (running && !ended) {
      const el = Math.max(0, DURATION - (now - t0) / 1000);
      elTime.textContent = Math.ceil(el);
      if (el <= 0 || [...P.values()].every((p) => p.done)) end();
      statusT += dt;
      if (statusT > 0.5) { statusT = 0; sendStatus(); }
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function step(p, dt, t) {
    if (p.bot) {
      const target = p.f < FLOORS - 1 ? LADDERS[p.f] : EXIT_X;
      p.steer = Math.max(-1, Math.min(1, (target - p.x) / 2)) * 0.8 + Math.sin(t * 2 + p.bob) * 0.25;
    }
    p.immune = Math.max(0, p.immune - dt);
    if (p.stun > 0) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.immune = 1.4; } return; }
    if (p.climbing) {
      p.y += CLIMB * dt;
      if (p.y >= floorY(p.f + 1)) { p.f++; p.y = floorY(p.f); p.climbing = false; sound.play('pop'); }
      return;
    }
    p.x = Math.max(-HALF, Math.min(HALF, p.x + p.steer * RUN * dt));
    if (p.f < FLOORS - 1 && Math.abs(p.x - LADDERS[p.f]) < 0.6) { p.climbing = true; p.x = LADDERS[p.f]; return; }
    if (p.f === FLOORS - 1 && Math.abs(p.x - EXIT_X) < 0.9) {
      p.done = true; p.doneAt = performance.now(); finished.push(p.id);
      p.g.visible = false; sound.play('correct');
      elFin.textContent = 'FINISHED: ' + finished.slice(0, 4).map((id, i) => `${i + 1}. ${P.get(id).name}`).join('  ') + (finished.length > 4 ? ' …' : '');
      return;
    }
    if (!p.immune) for (const b of bots) {
      if (b.floor === p.f && Math.abs(b.x - p.x) < 0.9) { p.stun = 1.2; p.x += (p.x > b.x ? 1.6 : -1.6); sound.play('boing'); break; }
    }
  }

  function progress(p) {
    if (p.done) return 1e6 - finished.indexOf(p.id);
    const target = p.f < FLOORS - 1 ? LADDERS[p.f] : EXIT_X;
    return p.f * 100 + (p.climbing ? 50 + (p.y - floorY(p.f)) * 10 : 40 - Math.abs(target - p.x));
  }
  function sendStatus() {
    const order = [...P.values()].sort((a, b) => progress(b) - progress(a));
    const st = {};
    order.forEach((p, i) => { st[p.id] = { place: i + 1, of: order.length, floor: p.f + 1, floors: FLOORS, done: p.done }; });
    onStatus(st);
  }
  function end() {
    if (ended) return; ended = true; running = false;
    sound.play('cheer');
    const order = [...P.values()].sort((a, b) => progress(b) - progress(a)).map((p) => p.id);
    elCd.textContent = 'TIME!';
    setTimeout(() => onFinish({ order, finished: finished.slice() }), 1500);
  }

  return {
    input(id, steer) { const p = P.get(id); if (p && !p.bot) p.steer = steer; },
    forceFinish: end,
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); mount.innerHTML = ''; },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

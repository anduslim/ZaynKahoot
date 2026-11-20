// Hero Tower Escape — a ladders-and-bricks climber rendered in cartoon 3D.
// Every game builds a fresh tower: 2–3 ladders per floor, trapdoors that open and close,
// a super-jump spring, patrol bots on random floors and an exit on a random side,
// so there's no single route up and players pick their own way.
import * as THREE from 'three';
import { mesh, toon, ink, labelSprite, canvasTexture, makeRenderer, fit, frameCamera, disposeScene, INPUT_TIMEOUT } from './toon.js';

const FLOORS = 6;            // ground (0) .. roof (5)
const FH = 3.2;              // floor height
const HALF = 15.5;           // half width of the tower
const RUN = 6.2, CLIMB = 3.1, GRAVITY = 34, JUMP_T = 0.9;
const DOOR_W = 2.8;
const DOOR_CYCLE = 5.2, DOOR_WARN = 2.4, DOOR_OPEN = 3.3;   // closed → flashing at WARN → open at OPEN → closed at CYCLE
const SPAWN = [-4, 4];       // players start in the middle of the ground floor

// ------------------------------------------------------------------ layout
// Random tower that is always climbable and never chains straight up (a ladder top is
// never right next to the next ladder, so every floor needs some running).
function makeLayout() {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const far = (x, list, d) => list.every((v) => Math.abs(x - v) >= d);
  for (let attempt = 0; attempt < 400; attempt++) {
    const exitX = Math.random() < 0.5 ? -12.5 : 12.5;
    const ladders = [];                       // ladders[f] = x positions of ladders from floor f up to f+1
    const arrive = [[...Array(9)].map((_, i) => SPAWN[0] + i)]; // where players stand on arriving at each floor
    let ok = true;
    for (let f = 0; f < FLOORS - 1 && ok; f++) {
      // two ladders per floor (sometimes three), each a decent run from where you arrive
      const want = Math.random() < 0.3 ? 3 : 2;
      const xs = [];
      for (let k = 0; k < 120 && xs.length < want; k++) {
        const x = rnd(-14, 14);
        if (far(x, xs, 6) && far(x, arrive[f], xs.length < 2 ? 6.5 : 5) && (f < FLOORS - 2 || Math.abs(x - exitX) > 7)) xs.push(x);
      }
      if (xs.length < 2) ok = false;
      ladders.push(xs.sort((a, b) => a - b));
      arrive.push(xs.slice());
    }
    if (!ok) continue;
    // trapdoors on three of floors 1–4, clear of ladders and landing spots but on the way
    // between them, so you have to time your run or go the long way round
    const doors = [];
    for (const f of [1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3)) {
      const spots = [];
      for (let k = 0; k < 80; k++) {
        const x = rnd(-12.5, 12.5);
        if (!far(x, ladders[f], DOOR_W / 2 + 1.8) || !far(x, arrive[f], DOOR_W / 2 + 1.8)) continue;
        const onPath = arrive[f].some((a) => ladders[f].some((l) => (a - x) * (l - x) < 0));
        spots.push({ x, onPath });
      }
      const pick = spots.find((s) => s.onPath) || spots[0];
      if (pick) doors.push({ f, x: pick.x, phase: Math.random() * DOOR_CYCLE, open: 0 });
    }
    // one spring on floor 0–2 that launches two floors up
    let spring = null;
    for (let k = 0; k < 80 && !spring; k++) {
      const f = Math.floor(rnd(0, 3)), x = rnd(-13.5, 13.5), land = f + 2;
      const busy = [...ladders[f], ...arrive[f], ...doors.filter((d) => d.f === f).map((d) => d.x)];
      const landBusy = [...(ladders[land] || []), ...doors.filter((d) => d.f === land).map((d) => d.x)];
      if (far(x, busy, 3) && far(x, landBusy, 3) && (land !== FLOORS - 1 || Math.abs(x - exitX) > 6)) spring = { f, x, squash: 0 };
    }
    if (!spring) continue;
    // a patrol bot on each of floors 1–4
    const bots = [1, 2, 3, 4].map((f) => {
      const c = rnd(-7, 7), w = rnd(5, 8);
      return { floor: f, min: Math.max(-14, c - w), max: Math.min(14, c + w), x: c, dir: Math.random() < 0.5 ? 1 : -1, speed: rnd(2.4, 3.4) };
    });
    return { exitX, ladders, doors, spring, bots };
  }
  // fallback: a known-good tower
  return {
    exitX: -12.5,
    ladders: [[-11, 9, 13], [-6, 11.5], [-13, 4], [-3, 12], [6, 13]],
    doors: [{ f: 2, x: 9, phase: 0, open: 0 }, { f: 3, x: -9, phase: 2, open: 0 }],
    spring: { f: 1, x: 1, squash: 0 },
    bots: [{ floor: 1, min: -10, max: 4, x: -2, dir: 1, speed: 2.6 }, { floor: 2, min: -6, max: 9, x: 5, dir: -1, speed: 3 }, { floor: 4, min: -6, max: 8, x: 0, dir: 1, speed: 3.3 }],
  };
}

// door state at sim time t: 'closed' | 'warn' | 'open'
function doorState(d, t) {
  const k = (t + d.phase) % DOOR_CYCLE;
  return k < DOOR_WARN ? 'closed' : k < DOOR_OPEN ? 'warn' : 'open';
}

export function startClimb({ mount, players, heroImgs = [], sound, onStatus, onFinish, duration = 90 }) {
  const DURATION = duration;
  const L = makeLayout();
  const renderer = makeRenderer(mount);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120E33');
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 200);
  frameCamera(camera, [0, 9.2, 37.5], [0, 9.2, 0]);
  const resize = () => fit(renderer, camera, mount);
  resize(); window.addEventListener('resize', resize);

  scene.add(new THREE.HemisphereLight('#ffffff', '#3b2f86', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(8, 22, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -6 });
  scene.add(sun);

  // --- back wall with windows, moon
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), toon('#241C5E'));
  wall.position.set(0, 8, -2.2); wall.receiveShadow = true; scene.add(wall);
  for (let i = 0; i < 18; i++) {
    const w = mesh(new THREE.BoxGeometry(1.4, 1.1, 0.1), i % 5 === 0 ? '#FFD66B' : '#3B2F86', { outline: 0.08, shadow: false });
    w.position.set(-14 + (i % 6) * 5.6, 1.6 + Math.floor(i / 6) * 6.4, -2.1); scene.add(w);
  }
  const moon = mesh(new THREE.SphereGeometry(1.6, 24, 16), '#FFF1B8', { outline: 0.05, shadow: false });
  moon.position.set(L.exitX > 0 ? -17.5 : 17.5, 17.5, -1.5); scene.add(moon);

  // --- brick floors, split around trapdoor openings
  const drawBricks = (c, w, h) => {
    c.fillStyle = '#7A2E1F'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let i = -1; i < 5; i++) {
      c.fillStyle = (i + r) % 3 ? '#C2573C' : '#B04A32';
      c.fillRect(i * 64 + (r ? 32 : 0) + 3, r * 32 + 3, 58, 26);
    }
  };
  const floorY = (i) => i * FH;
  const slab = (x0, x1, y) => {
    const len = x1 - x0; if (len < 0.05) return;
    const tex = canvasTexture(256, 64, drawBricks);
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 2, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 3), toon('#ffffff', { map: tex }));
    m.position.set((x0 + x1) / 2, y - 0.35, 0); m.receiveShadow = true; m.castShadow = true;
    ink(m, 0.01); scene.add(m);
  };
  for (let f = 0; f < FLOORS; f++) {
    let x0 = -HALF - 0.5;
    for (const d of L.doors.filter((d) => d.f === f).sort((a, b) => a.x - b.x)) { slab(x0, d.x - DOOR_W / 2, floorY(f)); x0 = d.x + DOOR_W / 2; }
    slab(x0, HALF + 0.5, floorY(f));
  }

  // --- trapdoors: a hazard-striped flap hinged on its left edge
  const hazard = canvasTexture(128, 32, (c, w, h) => {
    c.fillStyle = '#FFC93C'; c.fillRect(0, 0, w, h); c.fillStyle = '#1B1446';
    for (let i = -2; i < 10; i++) { c.beginPath(); c.moveTo(i * 16, h); c.lineTo(i * 16 + 8, h); c.lineTo(i * 16 + 24, 0); c.lineTo(i * 16 + 16, 0); c.fill(); }
  });
  for (const d of L.doors) {
    const hinge = new THREE.Group();
    hinge.position.set(d.x - DOOR_W / 2, floorY(d.f) - 0.05, 0);
    d.mat = new THREE.MeshToonMaterial({ color: '#ffffff', map: hazard, emissive: '#ff2a2a', emissiveIntensity: 0 });
    const flap = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.05, 0.28, 2.8), d.mat);
    flap.position.set(DOOR_W / 2, -0.14, 0); flap.castShadow = true; ink(flap, 0.02);
    hinge.add(flap); scene.add(hinge); d.hinge = hinge;
    const pit = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, 0.02, 3), new THREE.MeshBasicMaterial({ color: '#05030f' }));
    pit.position.set(d.x, floorY(d.f) - 0.69, 0); scene.add(pit);
  }

  // --- ladders
  const ladderMat = '#EAF2FF';
  L.ladders.forEach((xs, f) => xs.forEach((x) => {
    const g = new THREE.Group();
    const h = FH + 0.4;
    [-0.45, 0.45].forEach((dx) => { const r = mesh(new THREE.BoxGeometry(0.16, h, 0.16), ladderMat, { outline: 0.15 }); r.position.set(dx, h / 2, 0); g.add(r); });
    for (let y = 0.4; y < h; y += 0.55) { const r = mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), ladderMat, { outline: 0 }); r.position.set(0, y, 0); g.add(r); }
    g.position.set(x, floorY(f), 0.9); scene.add(g);
  }));

  // --- super-jump spring
  const S = L.spring;
  S.g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.25, 20), '#3A86FF', { outline: 0.06 }); base.position.y = 0.12; S.g.add(base);
  S.coil = new THREE.Group();
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 20), '#C9D3E0', { outline: 0 }); r.rotation.x = Math.PI / 2; r.position.y = 0.32 + i * 0.16; S.coil.add(r); }
  S.g.add(S.coil);
  S.pad = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 20), '#E5383B', { outline: 0.06 }); S.pad.position.y = 1; S.g.add(S.pad);
  const jumpSign = labelSprite('⬆ SUPER JUMP', '#E5383B', '#ffffff', 0.62); jumpSign.position.y = 2.1; S.g.add(jumpSign);
  S.g.position.set(S.x, floorY(S.f), 0.7); scene.add(S.g);

  // --- exit door
  const door = mesh(new THREE.BoxGeometry(2, 2.8, 0.4), '#1E7D3A', { outline: 0.05 });
  door.position.set(L.exitX, floorY(5) + 1.4, -0.6); scene.add(door);
  const sign = labelSprite('EXIT', '#2BA84A', '#ffffff', 1.4); sign.position.set(L.exitX, floorY(5) + 3.4, -0.4); scene.add(sign);
  const toward = -Math.sign(L.exitX);
  const arrow = labelSprite(toward > 0 ? '◀ ESCAPE!' : 'ESCAPE! ▶', '#FFC93C', '#1B1446', 0.9);
  arrow.position.set(L.exitX + toward * 4.2, floorY(5) + 3.2, 0); scene.add(arrow);

  // --- patrol bots
  const bots = L.bots;
  bots.forEach((b) => {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(1.3, 1.1, 1), '#7C3AED', { outline: 0.08 }); body.position.y = 0.75; g.add(body);
    [-0.3, 0.3].forEach((dx) => { const e = mesh(new THREE.SphereGeometry(0.16, 12, 8), '#FFC93C', { outline: 0.2, shadow: false }); e.position.set(dx, 0.9, 0.52); g.add(e); });
    const ant = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), '#C4B5FD', { outline: 0 }); ant.position.y = 1.55; g.add(ant);
    const tip = mesh(new THREE.SphereGeometry(0.14, 10, 8), '#E5383B', { outline: 0.2, shadow: false }); tip.position.y = 1.85; g.add(tip);
    g.position.set(b.x, floorY(b.floor), 0.3);
    b.g = g; scene.add(g);
  });

  // --- players: one texture per hero photo; every sprite using it is resized to the photo's shape on load
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const heroTex = (i, spr) => {
    const src = heroImgs[i] || heroImgs[0];
    if (!src) return null;
    let entry = texCache[src];
    if (!entry) {
      entry = texCache[src] = { sprites: [], tex: null };
      entry.tex = loader.load(src, (t) => entry.sprites.forEach((s) => adjust(s, t.image)));
      entry.tex.colorSpace = THREE.SRGBColorSpace;
    }
    if (entry.tex.image) adjust(spr, entry.tex.image); else entry.sprites.push(spr);
    return entry.tex;
  };
  function adjust(spr, img) { if (img && img.width) spr.scale.set((2.3 * img.width) / img.height, 2.3, 1); }

  const P = new Map();
  players.forEach((p, idx) => {
    const g = new THREE.Group();
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
    spr.center.set(0.5, 0); spr.scale.set(1.1, 2.3, 1);
    spr.material.map = heroTex(p.hero ?? 0, spr);
    g.add(spr);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const lab = labelSprite(p.name, p.avatar?.color || '#E5383B', '#fff', 0.7); lab.position.y = 2.8; g.add(lab);
    const star = labelSprite('💫', 'rgba(0,0,0,0)', '#fff', 0.9); star.position.y = 2.2; star.visible = false; g.add(star);
    const x = SPAWN[0] + (idx % 9) + (Math.floor(idx / 9) % 2) * 0.5;
    g.position.set(x, 0, 0.6 + (idx % 4) * 0.12);
    scene.add(g);
    P.set(p.id, {
      id: p.id, bot: p.bot, name: p.name, g, spr, shadow, star, x, y: 0, f: 0,
      mode: 'run', vy: 0, jt: 0, jy0: 0, target: null, targetFloor: -1,
      stun: 0, immune: 0, steer: 0, lastInput: 0, done: false, doneAt: 0, bob: Math.random() * 6,
    });
  });

  // --- HUD
  const hud = document.createElement('div');
  hud.innerHTML = `<div class="mg-bar"><span>TIME <b id="c-time">${DURATION}</b></span><span id="c-fin">FINISHED: —</span><span style="margin-left:auto">Tilt to run · pick your ladder · watch the trapdoors!</span></div><div class="countdown" id="c-cd"></div>`;
  mount.appendChild(hud);
  const elTime = hud.querySelector('#c-time'), elFin = hud.querySelector('#c-fin'), elCd = hud.querySelector('#c-cd');

  // --- loop
  let acc = 0; const FIX = 1 / 60;
  let raf, last = performance.now(), t0 = 0, running = false, ended = false, statusT = 0, simT = 0;
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
        acc -= FIX; simT += FIX;
        bots.forEach((b) => { b.x += b.dir * b.speed * FIX; if (b.x > b.max || b.x < b.min) b.dir *= -1; });
        for (const p of P.values()) if (!p.done) step(p, FIX, t);
      }
    }
    // doors swing smoothly towards their state and flash red as a warning
    for (const d of L.doors) {
      const st = running ? doorState(d, simT) : 'closed';
      d.open += ((st === 'open' ? 1 : 0) - d.open) * Math.min(1, dt * 10);
      d.hinge.rotation.z = -d.open * Math.PI * 0.48;
      d.mat.emissiveIntensity = st === 'warn' ? (Math.sin(t * 22) > 0 ? 0.9 : 0) : 0;
    }
    S.squash = Math.max(0, S.squash - dt * 3);
    S.coil.scale.y = 1 - S.squash * 0.6; S.pad.position.y = 1 - S.squash * 0.4;
    bots.forEach((b) => {
      b.g.position.x = b.x; b.g.position.y = floorY(b.floor) + Math.abs(Math.sin(t * 6)) * 0.15;
      b.g.rotation.y = b.dir > 0 ? 0.3 : -0.3;
    });
    for (const p of P.values()) {
      p.g.position.x = p.x; p.g.position.y = p.y;
      const moving = Math.abs(p.steer) > 0.15 || p.mode === 'climb';
      p.spr.position.y = p.mode === 'run' && moving && !p.stun ? Math.abs(Math.sin(t * 12 + p.bob)) * 0.18 : 0;
      p.spr.material.rotation = p.mode === 'climb' ? Math.sin(t * 10) * 0.12
        : p.mode === 'jump' ? Math.sin(p.jt / JUMP_T * Math.PI * 2) * 0.5
        : p.mode === 'fall' ? Math.sin(t * 30) * 0.3
        : p.stun ? Math.sin(t * 20) * 0.25 : -p.steer * 0.12;
      p.shadow.visible = p.mode === 'run' || p.mode === 'climb';
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

  // ways up from a floor: its ladders, the spring (worth a detour), or the exit on the roof
  function routes(f) {
    if (f >= FLOORS - 1) return [{ x: L.exitX, bonus: 0 }];
    const r = L.ladders[f].map((x) => ({ x, bonus: 0 }));
    if (S.f === f) r.push({ x: S.x, bonus: 7 });
    return r;
  }
  const routeCost = (p, r) => Math.abs(r.x - p.x) - r.bonus;
  const doorBetween = (f, a, b) => L.doors.find((d) => d.f === f && d.x + DOOR_W / 2 > Math.min(a, b) && d.x - DOOR_W / 2 < Math.max(a, b));

  function botSteer(p, t) {
    if (p.targetFloor !== p.f) {                         // choose a route on arriving at a floor
      const rs = routes(p.f).sort((a, b) => routeCost(p, a) - routeCost(p, b));
      p.target = (Math.random() < 0.25 && rs.length > 1 ? rs[1] : rs[0]).x;   // sometimes take the other way, for variety
      p.targetFloor = p.f;
    }
    let s = Math.max(-1, Math.min(1, (p.target - p.x) / 2)) * 0.8 + Math.sin(t * 2 + p.bob) * 0.25;
    // wait at the edge of a trapdoor that's flashing or open, unless already on it
    const d = doorBetween(p.f, p.x, p.target);
    if (d && doorState(d, simT) !== 'closed') {
      const edge = Math.abs(p.x - d.x) - DOOR_W / 2;
      if (edge > 0 && edge < 1.6 && Math.random() > 0.004) s = 0;
    }
    p.steer = s;
  }

  function step(p, dt, t) {
    if (p.bot) botSteer(p, t);
    else if (performance.now() - p.lastInput > INPUT_TIMEOUT) p.steer = 0;
    p.immune = Math.max(0, p.immune - dt);
    if (p.stun > 0) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.immune = 1.4; } return; }

    if (p.mode === 'climb') {
      p.y += CLIMB * dt;
      if (p.y >= floorY(p.f + 1)) { p.f++; p.y = floorY(p.f); p.mode = 'run'; sound.play('pop'); }
      return;
    }
    if (p.mode === 'fall') {
      p.vy -= GRAVITY * dt; p.y += p.vy * dt;
      if (p.y <= floorY(p.f - 1)) { p.f--; p.y = floorY(p.f); p.mode = 'run'; p.stun = 0.5; sound.play('boing'); }
      return;
    }
    if (p.mode === 'jump') {
      p.jt += dt;
      const k = Math.min(1, p.jt / JUMP_T), y1 = floorY(p.f + 2);
      p.y = p.jy0 + (y1 - p.jy0) * k + Math.sin(k * Math.PI) * 2.4;
      if (k >= 1) { p.f += 2; p.y = y1; p.mode = 'run'; sound.play('pop'); }
      return;
    }

    p.x = Math.max(-HALF, Math.min(HALF, p.x + p.steer * RUN * dt));
    // roof: the exit
    if (p.f === FLOORS - 1 && Math.abs(p.x - L.exitX) < 0.9) {
      p.done = true; p.doneAt = performance.now(); finished.push(p.id);
      p.g.visible = false; sound.play('correct');
      elFin.textContent = 'FINISHED: ' + finished.slice(0, 4).map((id, i) => `${i + 1}. ${P.get(id).name}`).join('  ') + (finished.length > 4 ? ' …' : '');
      return;
    }
    // any ladder on this floor climbs by itself
    const lad = p.f < FLOORS - 1 && L.ladders[p.f].find((x) => Math.abs(p.x - x) < 0.6);
    if (lad !== undefined && lad !== false) { p.mode = 'climb'; p.x = lad; return; }
    // the spring launches two floors up
    if (S.f === p.f && Math.abs(p.x - S.x) < 0.6) { p.mode = 'jump'; p.jt = 0; p.jy0 = p.y; p.x = S.x; S.squash = 1; sound.play('whoosh'); return; }
    // an open trapdoor drops you to the floor below
    for (const d of L.doors) {
      if (d.f === p.f && Math.abs(p.x - d.x) < DOOR_W / 2 - 0.25 && doorState(d, simT) === 'open') { p.mode = 'fall'; p.vy = 0; sound.play('whoosh'); return; }
    }
    if (!p.immune) for (const b of bots) {
      if (b.floor === p.f && Math.abs(b.x - p.x) < 0.9) { p.stun = 1.2; p.x += (p.x > b.x ? 1.6 : -1.6); sound.play('boing'); break; }
    }
  }

  function progress(p) {
    if (p.done) return 1e6 - finished.indexOf(p.id);
    const base = p.f * 100;
    if (p.mode === 'climb') return base + 50 + (p.y - floorY(p.f)) * 10;
    if (p.mode === 'jump') return base + 60 + p.jt * 100;
    if (p.mode === 'fall') return base - 60;
    const near = Math.min(...routes(p.f).map((r) => Math.abs(r.x - p.x)));
    return base + 40 - near;
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
    elCd.textContent = finished.length === P.size ? 'ESCAPED!' : 'TIME!';
    setTimeout(() => onFinish({ order, finished: finished.slice() }), 1500);
  }

  return {
    input(id, steer) { const p = P.get(id); if (p && !p.bot) { p.steer = steer; p.lastInput = performance.now(); } },
    forceFinish: end,
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); disposeScene(scene, renderer); mount.innerHTML = ''; },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

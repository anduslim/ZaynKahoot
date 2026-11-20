// Birthday Table Grand Prix — top-down tabletop racer in cartoon 3D.
import * as THREE from 'three';
import { mesh, toon, labelSprite, canvasTexture, makeRenderer, fit } from './toon.js';

const LAPS = 3;
const HW = 4.6;              // half track width
const MAX = 18, ACC = 14, TURN = 2.6, ASSIST = 1.1, OFF_MAX = 7;
const TIMEOUT = 150, GRACE = 20;
const PTS = [[-30, -16], [-6, -20.5], [14, -18], [32, -14], [38.5, 0], [30, 14], [12, 11], [2, 20], [-18, 20.5], [-34, 12], [-39, -4]];

export function startRace({ mount, players, sound, onStatus, onFinish }) {
  const renderer = makeRenderer(mount);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5B3A23');
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  camera.position.set(9.5, 84, 44);
  camera.lookAt(9.5, 0, 2.5);
  const resize = () => fit(renderer, camera, mount);
  resize(); window.addEventListener('resize', resize);

  scene.add(new THREE.HemisphereLight('#ffffff', '#6b4a2a', 1.5));
  const sun = new THREE.DirectionalLight('#fff6e0', 2.4);
  sun.position.set(-25, 60, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 40, bottom: -40, far: 150 });
  scene.add(sun);

  // --- table + checked cloth
  const cloth = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#2E8B45'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(220,40,50,0.55)';
    for (let i = 0; i < 8; i += 2) { c.fillRect(i * 64, 0, 64, h); c.fillRect(0, i * 64, w, 64); }
    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 8; i += 2) for (let j = 0; j < 8; j += 2) c.fillRect(i * 64, j * 64, 64, 64);
  });
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping; cloth.repeat.set(5, 3);
  const table = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 64), toon('#ffffff', { map: cloth }));
  table.position.y = -0.5; table.receiveShadow = true; scene.add(table);

  // --- track curve, samples
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  const N = 700;
  const S = curve.getSpacedPoints(N).slice(0, N);
  const T = S.map((_, i) => S[(i + 1) % N].clone().sub(S[i]).normalize());
  const NR = T.map((t) => new THREE.Vector3(-t.z, 0, t.x));
  // pale lane strip
  const pos = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const a = S[i].clone().addScaledVector(NR[i], HW), b = S[i].clone().addScaledVector(NR[i], -HW);
    const c = S[j].clone().addScaledVector(NR[j], HW), d = S[j].clone().addScaledVector(NR[j], -HW);
    pos.push(a.x, 0.02, a.z, b.x, 0.02, b.z, c.x, 0.02, c.z, b.x, 0.02, b.z, d.x, 0.02, d.z, c.x, 0.02, c.z);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.computeVertexNormals();
  const lane = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
  scene.add(lane);
  // chalk dashes on both edges
  const dashGeo = new THREE.BoxGeometry(0.45, 0.06, 1.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const dashCount = Math.floor(N / 7);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount * 2);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < N; i += 7) {
    const ang = Math.atan2(T[i].x, T[i].z);
    q4.setFromAxisAngle(up, ang);
    for (const s of [1, -1]) {
      const p = S[i].clone().addScaledVector(NR[i], s * HW);
      m4.compose(new THREE.Vector3(p.x, 0.05, p.z), q4, new THREE.Vector3(1, 1, 1));
      if (k < dashCount * 2) dashes.setMatrixAt(k++, m4);
    }
  }
  dashes.count = k; scene.add(dashes);
  // start / finish line
  const chk = canvasTexture(128, 32, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(i * 16, j * 16, 16, 16); } });
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 1.4), new THREE.MeshBasicMaterial({ map: chk }));
  startLine.rotation.x = -Math.PI / 2; startLine.rotation.z = -Math.atan2(T[0].x, T[0].z) + Math.PI / 2;
  startLine.rotation.order = 'YXZ'; startLine.rotation.set(-Math.PI / 2, 0, Math.atan2(T[0].z, T[0].x) * -1 + Math.PI / 2);
  startLine.position.set(S[0].x, 0.06, S[0].z); scene.add(startLine);

  // --- party obstacles (original toy-table props)
  const obstacles = [];
  const addObs = (g, x, z, r) => { g.position.set(x, 0, z); scene.add(g); obstacles.push({ x, z, r }); };
  // birthday cake
  (() => {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(6, 6, 0.4, 40), '#ffffff', { outline: 0.02 }); plate.position.y = 0.2; g.add(plate);
    const t1 = mesh(new THREE.CylinderGeometry(4.6, 4.6, 2.6, 40), '#F9C6DA', { outline: 0.03 }); t1.position.y = 1.7; g.add(t1);
    const t2 = mesh(new THREE.CylinderGeometry(3.2, 3.2, 2, 40), '#F472B6', { outline: 0.03 }); t2.position.y = 4; g.add(t2);
    const cols = ['#FFC93C', '#3A86FF', '#2BA84A', '#E5383B', '#8B5CF6'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const c = mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 10), cols[i], { outline: 0.15 }); c.position.set(Math.cos(a) * 1.8, 5.7, Math.sin(a) * 1.8); g.add(c);
      const f = mesh(new THREE.SphereGeometry(0.25, 10, 8), '#FFB703', { outline: 0, shadow: false }); f.scale.y = 1.6; f.position.set(Math.cos(a) * 1.8, 6.6, Math.sin(a) * 1.8); g.add(f);
      f.userData.flame = true;
    }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const s = mesh(new THREE.SphereGeometry(0.35, 8, 6), cols[i % 5], { outline: 0 }); s.position.set(Math.cos(a) * 4.6, 2.9, Math.sin(a) * 4.6); g.add(s); }
    addObs(g, -8, 0, 5.4);
  })();
  const cupcake = (x, z, top) => {
    const g = new THREE.Group();
    const base = mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.2, 14), '#8B5A2B', { outline: 0.06 }); base.position.y = 0.6; g.add(base);
    const fro = mesh(new THREE.SphereGeometry(1.2, 16, 10), top, { outline: 0.06 }); fro.scale.y = 0.8; fro.position.y = 1.4; g.add(fro);
    const ch = mesh(new THREE.SphereGeometry(0.3, 10, 8), '#E5383B', { outline: 0.15 }); ch.position.y = 2.3; g.add(ch);
    addObs(g, x, z, 1.4);
  };
  cupcake(-22, -6, '#FDE68A'); cupcake(9, -7, '#BFDBFE'); cupcake(0, -19, '#FBCFE8'); cupcake(-27, 16.5, '#C7F9CC');
  // juice box
  (() => {
    const g = new THREE.Group();
    const b = mesh(new THREE.BoxGeometry(3, 4.6, 2), '#F97316', { outline: 0.04 }); b.position.y = 2.3; g.add(b);
    const lab = mesh(new THREE.BoxGeometry(3.05, 1.6, 2.05), '#FFE8A3', { outline: 0 }); lab.position.y = 2.4; g.add(lab);
    const straw = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4), '#3A86FF', { outline: 0.2 }); straw.position.set(0.7, 5.3, 0); straw.rotation.z = -0.3; g.add(straw);
    g.rotation.y = 0.4; addObs(g, 22, 1, 2.2);
  })();
  // party cups (off track, decorative but solid)
  const cup = (x, z, col) => { const g = new THREE.Group(); const c = mesh(new THREE.CylinderGeometry(2, 1.5, 4.2, 20, 1, true), col, { outline: 0.04 }); c.position.y = 2.1; g.add(c); addObs(g, x, z, 2.1); };
  cup(43, -24, '#3A86FF'); cup(-44, 24, '#E5383B'); cup(44, 22, '#2BA84A');
  // crayons + blocks (decor at edges)
  const crayon = (x, z, rot, col) => { const g = new THREE.Group(); const b = mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 12), col, { outline: 0.06 }); b.rotation.z = Math.PI / 2; b.position.y = 0.5; g.add(b); const tip = mesh(new THREE.ConeGeometry(0.5, 1.2, 12), col, { outline: 0.06 }); tip.rotation.z = -Math.PI / 2; tip.position.set(4.1, 0.5, 0); g.add(tip); g.rotation.y = rot; g.position.set(x, 0, z); scene.add(g); };
  crayon(-40, -24, 0.3, '#FFC93C'); crayon(-36, -26, 0.5, '#3A86FF'); crayon(30, 26, -0.2, '#8B5CF6');
  const block = (x, z, col) => { const b = mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), col, { outline: 0.04 }); b.position.set(x, 1.2, z); b.rotation.y = Math.random(); scene.add(b); obstacles.push({ x, z, r: 1.6 }); };
  block(44, -2, '#E5383B'); block(44, 3, '#FFC93C'); block(-46, -10, '#2BA84A');

  // --- cars
  const cars = new Map();
  const startI = N - 6;
  players.forEach((p, idx) => {
    const g = new THREE.Group();
    const col = p.avatar?.color || '#E5383B';
    const body = mesh(new THREE.BoxGeometry(1.5, 0.7, 2.6), col, { outline: 0.06 }); body.position.y = 0.6; g.add(body);
    const cab = mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), '#CFE8FF', { outline: 0.06 }); cab.position.set(0, 1.2, -0.2); g.add(cab);
    const spoiler = mesh(new THREE.BoxGeometry(1.6, 0.12, 0.4), col, { outline: 0.1 }); spoiler.position.set(0, 1.2, -1.25); g.add(spoiler);
    [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.35, 14), '#1B1446', { outline: 0.05 }); w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w); });
    const lab = labelSprite(p.name, col, '#fff', 1.1); lab.position.y = 2.6; g.add(lab);
    // staggered grid behind the line
    const row = Math.floor(idx / 3), lane = (idx % 3) - 1;
    const si = (startI - row * 9 + N) % N;
    const pos = S[si].clone().addScaledVector(NR[si], lane * 2.6);
    const heading = Math.atan2(T[si].x, T[si].z);
    g.scale.setScalar(1.35);
    g.position.copy(pos); g.rotation.y = heading;
    scene.add(g);
    cars.set(p.id, { id: p.id, bot: p.bot, name: p.name, color: col, g, x: pos.x, z: pos.z, h: heading, v: 0, steer: 0, idx: si, lap: -1, prog: 0, done: false, finishT: 0, skill: 0.75 + Math.random() * 0.25, bumpT: 0 });
  });

  // --- HUD
  const hud = document.createElement('div');
  hud.innerHTML = `<div class="standings"><h3>Birthday Table<br>Grand Prix</h3><div class="lap" id="r-lap">LAP 1 / ${LAPS}</div><div id="r-rows"></div></div><div class="countdown" id="r-cd"></div>`;
  mount.appendChild(hud);
  const elRows = hud.querySelector('#r-rows'), elLap = hud.querySelector('#r-lap'), elCd = hud.querySelector('#r-cd');

  let acc = 0; const FIX = 1 / 60;
  let raf, last = performance.now(), running = false, ended = false, t0 = 0, firstFinish = 0, uiT = 0;
  const finished = [];
  (async () => {
    await wait(600);
    for (const n of ['3', '2', '1']) { elCd.textContent = n; sound.play('beep'); await wait(850); }
    elCd.textContent = 'GO!'; sound.play('go'); running = true; t0 = performance.now();
    await wait(800); elCd.textContent = '';
  })();

  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function nearest(c) {
    let best = c.idx, bd = Infinity;
    for (let o = -25; o <= 40; o++) {
      const i = (c.idx + o + N) % N;
      const d = (S[i].x - c.x) ** 2 + (S[i].z - c.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bd) };
  }

  function step(c, dt, now) {
    const { i, d } = nearest(c);
    // lap counting
    if (c.idx > N * 0.8 && i < N * 0.2) { c.lap++; if (c.lap >= 1 && c.lap < LAPS && !c.bot) sound.play('beep'); }
    else if (c.idx < N * 0.2 && i > N * 0.8) c.lap--;
    c.idx = i;
    if (c.lap >= LAPS) { c.done = true; c.finishT = now; finished.push(c.id); sound.play('correct'); if (!firstFinish) firstFinish = now; return; }
    const trackH = Math.atan2(T[i].x, T[i].z);
    if (c.bot) {
      const tgt = S[(i + 14) % N];
      const want = Math.atan2(tgt.x - c.x, tgt.z - c.z);
      c.steer = Math.max(-1, Math.min(1, -angDiff(want, c.h) * 2.2));
    }
    const vmax = (d > HW ? OFF_MAX : MAX) * (c.bot ? c.skill : 1);
    c.v = Math.min(vmax, c.v + ACC * dt);
    if (c.v > vmax) c.v = vmax;
    c.h += -c.steer * TURN * dt * Math.min(1, c.v / 6);
    c.h += angDiff(trackH, c.h) * ASSIST * dt;
    c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
    if (d > HW + 5) { c.x += (S[i].x - c.x) * 2 * dt; c.z += (S[i].z - c.z) * 2 * dt; }
    for (const o of obstacles) {
      const dx = c.x - o.x, dz = c.z - o.z, dd = Math.hypot(dx, dz), min = o.r + 1;
      if (dd < min) { c.x = o.x + (dx / dd) * min; c.z = o.z + (dz / dd) * min; c.v *= 0.35; if (now - c.bumpT > 600) { c.bumpT = now; sound.play('boing'); } }
    }
    c.x = Math.max(-49, Math.min(49, c.x)); c.z = Math.max(-31, Math.min(31, c.z));
    c.prog = c.lap * N + i;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const realDt = Math.min(0.25, (now - last) / 1000); last = now;
    const dt = realDt;
    const list = [...cars.values()];
    if (running) {
      acc += realDt;
      let n = 0;
      while (acc >= FIX && n++ < 15) { acc -= FIX; for (const c of list) if (!c.done) step(c, FIX, now); }
      // car-car nudges
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const A = list[a], B = list[b]; if (A.done || B.done) continue;
        const dx = B.x - A.x, dz = B.z - A.z, dd = Math.hypot(dx, dz);
        if (dd > 0 && dd < 1.8) { const p = (1.8 - dd) / 2; A.x -= (dx / dd) * p; A.z -= (dz / dd) * p; B.x += (dx / dd) * p; B.z += (dz / dd) * p; }
      }
    }
    for (const c of list) {
      c.g.position.set(c.x, c.done ? -5 : 0, c.z);
      c.g.rotation.y = c.h;
      c.g.rotation.z = running && !c.done ? -c.steer * 0.08 : 0;
    }
    scene.traverse((o) => { if (o.userData.flame) o.scale.x = 1 + Math.sin(now / 80 + o.position.x) * 0.15; });
    if (running && !ended) {
      uiT += dt;
      if (uiT > 0.25) { uiT = 0; updateUI(list); }
      const el = (now - t0) / 1000;
      if (list.every((c) => c.done) || el > TIMEOUT || (firstFinish && (now - firstFinish) / 1000 > GRACE)) end(list);
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const rank = (list) => list.slice().sort((a, b) => (a.done && b.done ? finished.indexOf(a.id) - finished.indexOf(b.id) : b.done - a.done || b.prog - a.prog));
  function updateUI(list) {
    const r = rank(list);
    const leadLap = Math.min(LAPS, Math.max(1, (r[0]?.lap ?? 0) + 1));
    elLap.textContent = r[0]?.done ? 'FINISH!' : `LAP ${leadLap} / ${LAPS}`;
    elRows.innerHTML = r.slice(0, 12).map((c, i) => `<div class="srow ${c.done ? 'done' : ''}"><span class="p">${i + 1}</span><span class="c" style="background:${c.color}"></span><span>${escapeHtml(c.name)}</span></div>`).join('') + (r.length > 12 ? `<div style="color:var(--muted);font-weight:800">+${r.length - 12} more</div>` : '');
    const st = {};
    r.forEach((c, i) => { st[c.id] = { place: i + 1, of: r.length, lap: Math.min(LAPS, Math.max(1, c.lap + 1)), laps: LAPS, done: c.done }; });
    onStatus(st);
  }
  function end(list = [...cars.values()]) {
    if (ended) return; ended = true; running = false;
    updateUI(list);
    sound.play('cheer');
    elCd.textContent = 'FINISH!';
    const order = rank(list).map((c) => c.id);
    setTimeout(() => onFinish({ order, finished: finished.slice() }), 1800);
  }

  return {
    input(id, steer) { const c = cars.get(id); if (c && !c.bot) c.steer = steer; },
    forceFinish: () => end(),
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); mount.innerHTML = ''; },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

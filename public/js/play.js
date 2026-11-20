// Zayn's Kahoot — phone controller
const socket = io();
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem('zk_' + k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('zk_' + k, JSON.stringify(v)); } catch (e) {} } };

const COLORS = ['#E5383B', '#F97316', '#D49B00', '#2BA84A', '#06B6D4', '#3A86FF', '#8B5CF6', '#EC4899'];
const FACES = ['😀', '😎', '🤠', '🥳', '🤖', '👽', '🐯', '🐼', '🦊', '🐸', '🦄', '🐵'];
const HATS = ['', '👑', '🧢', '🎩', '🎓', '🎀', '🪖', '🎉'];

let playerId = LS.get('id');
let profile = LS.get('profile') || { name: '', avatar: { color: COLORS[Math.floor(Math.random() * 8)], face: FACES[0], hat: '' } };
let joined = false;
let S = null, key = '';
let steer = 0, btnSteer = 0, motionOK = false, sendTimer = null;
let mgStatus = null;
let catchGame = null;

// ------------------------------------------------------------- join
function joinScreen(err) {
  const pinNeeded = !params.get('pin');
  app.innerHTML = `
    <h1 class="brand"><span class="z">Zayn's</span> <span class="k">Kahoot</span></h1>
    <div style="display:flex;justify-content:center;padding-top:22px" id="av">${avatarHTML(profile.avatar, 130)}</div>
    ${pinNeeded ? `<label class="lbl">Game PIN<input class="txt" id="pin" inputmode="numeric" maxlength="4" placeholder="1234"></label>` : ''}
    <label class="lbl">Your name<input class="txt" id="nm" maxlength="14" placeholder="Type your name" value="${esc(profile.name)}"></label>
    <div class="lbl">Colour</div>
    <div class="row" style="grid-template-columns:repeat(8,1fr)">${COLORS.map((c) => `<button class="sw ${c === profile.avatar.color ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="colour"></button>`).join('')}</div>
    <div class="lbl">Face</div>
    <div class="row" style="grid-template-columns:repeat(6,1fr)">${FACES.map((f) => `<button class="chip ${f === profile.avatar.face ? 'on' : ''}" data-f="${f}">${f}</button>`).join('')}</div>
    <div class="lbl">Hat</div>
    <div class="row" style="grid-template-columns:repeat(8,1fr)">${HATS.map((h) => `<button class="chip ${h === profile.avatar.hat ? 'on' : ''}" data-h="${h}">${h || '✖️'}</button>`).join('')}</div>
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    <button class="cta" id="ready">I'm ready!</button>`;
  const refresh = () => { document.getElementById('av').innerHTML = avatarHTML(profile.avatar, 130); };
  app.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { profile.avatar.color = b.dataset.c; app.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); refresh(); });
  app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { profile.avatar.face = b.dataset.f; app.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); refresh(); });
  app.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { profile.avatar.hat = b.dataset.h; app.querySelectorAll('[data-h]').forEach((x) => x.classList.toggle('on', x === b)); refresh(); });
  document.getElementById('ready').onclick = async () => {
    const name = document.getElementById('nm').value.trim();
    if (!name) return joinScreen('Please type your name');
    profile.name = name;
    LS.set('profile', profile);
    Sound.init(); Sound.play('join');
    await requestMotion();
    wakeLock();
    const pin = params.get('pin') || document.getElementById('pin')?.value;
    doJoin(pin);
  };
}

function doJoin(pin) {
  socket.emit('join', { playerId, name: profile.name, avatar: profile.avatar, pin }, (res) => {
    if (!res?.ok) { LS.set('id', null); playerId = null; return joinScreen(res?.error || 'Could not join'); }
    playerId = res.playerId; LS.set('id', playerId); joined = true;
    if (S) render(S, true);
    else waitScreen();
  });
}

socket.on('connect', () => { if (joined || (playerId && profile.name)) doJoin(params.get('pin')); });
socket.on('kicked', () => { joined = false; LS.set('id', null); playerId = null; app.innerHTML = `<div class="center"><div class="big">You've been removed from the game</div><button class="cta" onclick="location.reload()">Join again</button></div>`; });
socket.on('state', (st) => { S = st; if (!joined) return; const k = st.phase + ':' + st.stepKind + ':' + (st.question?.index ?? '') + ':' + (st.mg?.type || ''); const changed = k !== key; key = k; render(st, changed); });
socket.on('mgStatus', (s) => { mgStatus = s; updateRacePlace(); });

// ------------------------------------------------------------- sensors
async function requestMotion() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      motionOK = r === 'granted';
    } else motionOK = 'DeviceOrientationEvent' in window;
  } catch (e) { motionOK = false; }
  window.addEventListener('deviceorientation', onTilt);
}
function onTilt(e) {
  if (e.gamma == null) return;
  motionOK = true;
  const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
  let v;
  if (ang === 90) v = e.beta; else if (ang === -90 || ang === 270) v = -e.beta; else if (ang === 180) v = -e.gamma; else v = e.gamma;
  let s = v / 28;
  if (Math.abs(s) < 0.08) s = 0;
  steer = Math.max(-1, Math.min(1, s));
  const w = document.getElementById('wheel');
  if (w) w.style.transform = `rotate(${currentSteer() * 70}deg)`;
}
const currentSteer = () => (btnSteer !== 0 ? btnSteer : steer);

let wl = null;
async function wakeLock() {
  try { wl = await navigator.wakeLock?.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeLock(); });

// ------------------------------------------------------------- render
function meBar(st) {
  return `<div class="me-bar">${avatarHTML(st.me.avatar, 38)}<span class="nm">${esc(st.me.name)}</span><span class="sc">${st.me.score} pts</span></div>`;
}
function waitScreen(msg = "You're in!", sub = 'Look at the big screen') {
  app.innerHTML = `<div class="center">${avatarHTML(profile.avatar, 140)}<div class="big">${esc(msg)}</div><div class="sub">${esc(sub)}</div></div>
    ${S?.phase === 'lobby' ? '<button class="ghost" id="edit">Change my avatar</button>' : ''}`;
  const e = document.getElementById('edit'); if (e) e.onclick = () => { joined = false; joinScreen(); };
}

function stopSending() { clearInterval(sendTimer); sendTimer = null; }

function render(st, changed) {
  if (st.phase !== 'mg_play') { stopSending(); if (catchGame) { catchGame.destroy(); catchGame = null; } }
  const P = st.phase;
  if (P === 'lobby') return changed && waitScreen();
  if (P === 'intro' || P === 'showcase') {
    if (!changed) return;
    app.innerHTML = `${meBar(st)}<div class="center"><div style="font-size:90px;animation:floaty 2s infinite">👀</div><div class="big">Eyes on the big screen!</div><div class="sub">${esc(st.question?.text || '')}</div></div>`;
    return;
  }
  if (P === 'answering') {
    if (st.answer != null) {
      if (!changed && app.dataset.v === 'locked') return;
      app.dataset.v = 'locked';
      app.innerHTML = `${meBar(st)}<div class="center"><div style="font-size:90px;animation:spin 2s linear infinite">⭐</div><div class="big">Answer locked in!</div><div class="sub">Waiting for everyone…</div></div>`;
      return;
    }
    if (!changed && app.dataset.v === 'pad') return;
    app.dataset.v = 'pad';
    return answerPad(st);
  }
  app.dataset.v = '';
  if (P === 'reveal') {
    if (!changed) return;
    const ok = st.wasCorrect;
    Sound.play(ok ? 'correct' : 'wrong');
    navigator.vibrate?.(ok ? [60, 40, 60] : 200);
    app.innerHTML = `${meBar(st)}<div class="center"><div class="result ${ok ? 'ok' : 'no'} pop">
      <div class="ic">${ok ? '🎉' : st.answer == null ? '⏰' : '😅'}</div>
      <div class="big">${ok ? 'Correct!' : st.answer == null ? "Time's up!" : 'Not this time'}</div>
      <div class="sub" style="color:#fff">${ok ? '+' + st.me.lastGain + ' points' : 'Answer: ' + esc(st.question.options[st.correct]?.label || '')}</div></div>
      <div class="sub">You're ${ordinal(st.me.rank)} of ${st.me.of}</div></div>`;
    return;
  }
  if (P === 'mg_intro') { if (changed) mgIntro(st); return; }
  if (P === 'mg_play') {
    if (!changed) return;
    if (st.mg.type === 'catch') { catchGame = startCatch(st); return; }
    return steering(st);
  }
  if (P === 'mg_results') {
    if (!changed) return;
    app.innerHTML = `${meBar(st)}<div class="center"><div class="place pop">${st.mg.myPlace ? ordinal(st.mg.myPlace) : '—'}</div><div class="big">${st.mg.myPlace === 1 ? 'You won!' : 'Nice job!'}</div><div class="sub">Bonus +${st.mg.myBonus ?? 0} points</div></div>`;
    if (st.mg.myPlace && st.mg.myPlace <= 3) confetti();
    return;
  }
  if (P === 'scoreboard') {
    if (!changed) return;
    app.innerHTML = `${meBar(st)}<div class="center"><div class="sub">You are</div><div class="place pop">${ordinal(st.me.rank)}</div><div class="big">${st.me.score} points</div><div class="sub">Next question coming up!</div></div>`;
    return;
  }
  if (P === 'final') {
    if (!changed) return;
    const r = st.me.rank;
    app.innerHTML = `<div class="center">${avatarHTML(st.me.avatar, 130)}<div class="place pop">${ordinal(r)}</div><div class="big">${r === 1 ? 'CHAMPION! 🏆' : r <= 3 ? 'On the podium! 🎉' : 'Thanks for playing!'}</div><div class="sub">${st.me.score} points · Happy birthday Zayn! 🎂</div></div>`;
    confetti();
  }
}

function answerPad(st) {
  const q = st.question;
  let pad;
  if (q.type === 'pokemon') {
    pad = `<div class="pad pk">${q.options.map((o, i) => `<button data-i="${i}">${imgOrTile(o.img, o.label, '', '?')}<span>${esc(o.label)}</span></button>`).join('')}</div>`;
  } else {
    pad = `<div class="pad">${q.options.map((o, i) => {
      let mid = '';
      if (q.type === 'hero' && o.img) mid = imgOrTile(o.img, o.label, 'ph');
      else if (o.emoji) mid = `<span class="em">${esc(o.emoji)}</span>`;
      else if (o.colors) mid = `<span class="swatch" style="background:linear-gradient(90deg,${o.colors[0]} 50%,${o.colors[1]} 50%)"></span>`;
      return `<button data-i="${i}" style="background:${OPT_COLORS[i]}"><span class="shape">${OPT_SHAPES[i]}</span>${mid}<span>${esc(o.label)}</span></button>`;
    }).join('')}</div>`;
  }
  app.innerHTML = `<div class="qtxt">${esc(q.text)}</div>${q.hint ? `<div class="sub">${esc(q.hint)}</div>` : ''}${pad}${meBar(st)}`;
  app.querySelectorAll('.pad button').forEach((b) => b.onclick = () => {
    Sound.play('tap'); navigator.vibrate?.(30);
    socket.emit('answer', Number(b.dataset.i));
  });
}

// ------------------------------------------------------------- mini games: steering
function mgIntro(st) {
  const t = st.mg.type;
  const txt = { climb: ['Hero Tower Escape!', 'Tilt your phone left and right to run. Ladders climb by themselves!'], race: ['Grand Prix!', 'Hold your phone flat-ish and tilt left and right to steer.'], catch: ['Catch the Mystery!', 'Swipe up to throw. Throw when the ring is small and green!'] }[t];
  app.innerHTML = `${meBar(st)}<div class="center"><div class="big">${txt[0]}</div><div class="sub">${txt[1]}</div>
    ${t !== 'catch' ? `<div class="wheel" id="wheel"></div><div class="sub">${motionOK ? 'Try it now: the wheel follows your tilt' : 'Tilt not available. Use the big ◀ ▶ buttons in the game.'}</div>
      ${!motionOK ? '<button class="cta" id="perm">Turn on tilt</button>' : ''}` : '<div style="font-size:110px">📱⬆️</div>'}
    <div class="sub">Waiting for the host to start…</div></div>`;
  const p = document.getElementById('perm'); if (p) p.onclick = async () => { await requestMotion(); mgIntro(S); };
}

function steering(st) {
  const t = st.mg.type;
  app.innerHTML = `<div class="center" style="gap:20px">
    <div class="sub">${t === 'race' ? 'Tilt to steer!' : 'Tilt to run!'}</div>
    <div class="place" id="rplace">–</div><div class="sub" id="rsub"></div>
    <div class="wheel" id="wheel"></div>
    <div class="steer-btns"><button id="bl">◀</button><button id="br">▶</button></div></div>`;
  const hold = (el, v) => {
    const on = (e) => { e.preventDefault(); btnSteer = v; el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); if (btnSteer === v) btnSteer = 0; el.classList.remove('on'); };
    el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
    el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
  };
  hold(document.getElementById('bl'), -1); hold(document.getElementById('br'), 1);
  stopSending();
  sendTimer = setInterval(() => {
    socket.volatile.emit('input', currentSteer());
    const w = document.getElementById('wheel'); if (w) w.style.transform = `rotate(${currentSteer() * 70}deg)`;
  }, 66);
  updateRacePlace();
}
function updateRacePlace() {
  const el = document.getElementById('rplace'); if (!el || !mgStatus) return;
  el.textContent = mgStatus.done ? '🏁' : ordinal(mgStatus.place);
  document.getElementById('rsub').textContent = mgStatus.done ? `Finished ${ordinal(mgStatus.place)}!` : mgStatus.lap ? `Lap ${mgStatus.lap} / ${mgStatus.laps}` : `Floor ${mgStatus.floor} / ${mgStatus.floors}`;
}

// ------------------------------------------------------------- mini game: catch
const BALL_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><clipPath id="bc"><circle cx="50" cy="50" r="46"/></clipPath></defs>
  <circle cx="50" cy="50" r="46" fill="#1D3B8F"/><g clip-path="url(#bc)"><rect x="0" y="42" width="100" height="16" fill="#FFC93C"/><ellipse cx="34" cy="26" rx="16" ry="9" fill="#ffffff" opacity=".25"/></g>
  <path d="M50 30 L55 44 L70 44 L58 53 L62 68 L50 59 L38 68 L42 53 L30 44 L45 44 Z" fill="#FFC93C" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-width="5"/></svg>`;

function startCatch(st) {
  const img = st.question?.mysteryImg || '/assets/pokemon/pikachu.png';
  let balls = 3, busy = false, done = false;
  app.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'catch';
  root.innerHTML = `
    <div class="cloud" style="left:8%;top:9%;width:40%;height:5%"></div><div class="cloud" style="left:55%;top:17%;width:32%;height:4%"></div>
    <svg class="trees" viewBox="0 0 390 100" preserveAspectRatio="none"><path d="M0 100 V50 L14 20 L28 50 L40 12 L54 50 L66 24 L80 50 L94 8 L108 50 L120 26 L134 50 L148 14 L162 50 L176 22 L190 50 L204 10 L218 50 L232 26 L246 50 L260 16 L274 50 L288 24 L302 50 L316 12 L330 50 L344 26 L358 50 L372 18 L390 50 V100 Z" fill="#2F6B6E"/></svg>
    <div class="lake"></div><div class="grass"></div><div class="dirt"></div>
    <div class="bush" style="left:-8%"></div><div class="bush" style="right:-6%"></div>
    <div class="tag">??? · Mystery</div>
    <div class="shadow"></div>
    <div class="mon sil" id="mon"><img src="${esc(img)}" onerror="this.outerHTML='<div class=&quot;fallback&quot;>?</div>'"></div>
    <div class="outer"></div><div class="inner" id="ring"></div>
    <div class="chance" id="chance">Get ready…</div>
    <div class="sparkle" style="left:16%;bottom:22%"></div><div class="sparkle" style="right:20%;bottom:28%;animation-delay:.6s"></div>
    <div class="ball" id="ball">${BALL_SVG}</div>
    <div class="msg" id="msg"></div>
    <div class="help">Swipe up to throw</div>
    <div class="balls" id="balls"></div>`;
  document.body.appendChild(root);
  const ring = root.querySelector('#ring'), ball = root.querySelector('#ball'), mon = root.querySelector('#mon');
  const msg = root.querySelector('#msg'), chance = root.querySelector('#chance'), ballsEl = root.querySelector('#balls');
  const drawBalls = () => { ballsEl.innerHTML = [0, 1, 2].map((i) => `<i class="${i < 3 - balls ? 'used' : ''}"></i>`).join(''); };
  drawBalls();

  // shrinking ring: scale 1 -> 0.3 every 1.6s
  let scale = 1, raf;
  const t0 = performance.now();
  (function loop(now) {
    raf = requestAnimationFrame(loop);
    if (busy) return;
    const ph = ((now - t0) % 1600) / 1600;
    scale = 1 - 0.7 * ph;
    const good = scale < 0.55;
    ring.style.transform = `translate(-50%,-50%) scale(${scale})`;
    ring.style.borderColor = scale < 0.45 ? '#8EF0A8' : scale < 0.7 ? '#FFC93C' : '#FF6B6B';
    chance.textContent = scale < 0.45 ? 'Great chance!' : scale < 0.7 ? 'Good chance' : 'Hard!';
    chance.style.color = good ? '#8EF0A8' : '#fff';
  })(performance.now());

  const send = (state, caught = false) => socket.emit('catch', { balls, state, caught });

  // gestures
  let sy = null, sx = null, st0 = 0;
  const start = (x, y) => { if (busy || done) return; sx = x; sy = y; st0 = performance.now(); };
  const finish = (x, y) => {
    if (sy == null || busy || done) return;
    const dy = sy - y, dt = performance.now() - st0;
    const tap = Math.abs(dy) < 12 && dt < 350 && y > window.innerHeight * 0.65;
    if (dy > 50 || tap) throwBall();
    sy = null;
  };
  root.addEventListener('touchstart', (e) => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
  root.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; finish(t.clientX, t.clientY); });
  root.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
  root.addEventListener('mouseup', (e) => finish(e.clientX, e.clientY));

  async function throwBall() {
    busy = true;
    const s = scale;
    const p = s < 0.45 ? 0.75 : s < 0.7 ? 0.45 : 0.2;
    Sound.play('whoosh');
    send('throwing');
    // arc to the target
    const rect = ball.getBoundingClientRect(), mrect = mon.getBoundingClientRect();
    const dx = 0, dy = (mrect.top + mrect.height * 0.55) - (rect.top + rect.height / 2);
    ball.animate([
      { transform: 'translate(-50%,0) scale(1)' },
      { transform: `translate(-50%,${dy * 0.6}px) scale(.55)`, offset: 0.5 },
      { transform: `translate(-50%,${dy}px) scale(.32)` },
    ], { duration: 520, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    await wait(520);
    mon.style.transform = 'translate(-50%,-100%) scale(0)'; mon.style.opacity = 0;
    Sound.play('pop');
    send('wobble');
    let caught = true;
    for (let i = 0; i < 3; i++) {
      await wait(650);
      ball.classList.remove('shake'); void ball.offsetWidth; ball.classList.add('shake');
      Sound.play('shake'); navigator.vibrate?.(40);
      if (Math.random() > Math.pow(p, 1 / 3)) { caught = false; break; }
    }
    await wait(600);
    balls--;
    if (caught) {
      done = true;
      Sound.play('sparkle'); Sound.play('correct'); navigator.vibrate?.([80, 50, 80]);
      msg.textContent = 'Gotcha! ⭐';
      mon.classList.remove('sil');
      mon.style.transform = 'translate(-50%,-100%) scale(1)'; mon.style.opacity = 1;
      ball.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      root.querySelector('.tag').textContent = 'Caught it!';
      drawBalls(); send('caught', true); confetti();
      return;
    }
    // broke free
    Sound.play('boing');
    mon.style.transform = 'translate(-50%,-100%) scale(1)'; mon.style.opacity = 1;
    ball.getAnimations().forEach((a) => a.cancel());
    drawBalls();
    if (balls <= 0) {
      done = true; msg.textContent = 'It got away! 💨'; ball.style.opacity = 0;
      send('escaped');
      setTimeout(() => { mon.style.opacity = 0; }, 900);
      return;
    }
    msg.textContent = 'Oh no! It broke free!';
    send('aiming');
    setTimeout(() => { msg.textContent = ''; }, 1200);
    busy = false;
  }

  return { destroy() { cancelAnimationFrame(raf); root.remove(); } };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------- boot
if (playerId && profile.name) { joined = true; waitScreen('Reconnecting…', ''); }
else joinScreen();

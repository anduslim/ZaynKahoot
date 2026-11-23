import { startClimb } from './games/climb.js';
import { startRace } from './games/race.js';

const socket = io();
const stage = document.getElementById('stage');
let S = null;            // latest state
let phaseKey = '';       // phase + step, to detect transitions
let config = {};
let started = false;     // audio unlocked
let game = null;         // running 3D mini game
let token = 0;           // cancels async sequences on phase change
let lastTick = -1;

fetch('/config.json').then((r) => r.json()).then((c) => {
  config = c;
  const h = document.querySelector('.splash .brand'); if (h) h.innerHTML = brandHTML(c.title);
  document.title = c.title + ' · Host';
  if (S && S.phase === 'lobby') enter(S);
});
const title = () => S?.title || config.title || 'Quiz';

// ------------------------------------------------------------- splash
stage.innerHTML = `<div class="screen splash">
  <h1 class="h-title brand">&nbsp;</h1>
  <p style="color:var(--soft);font-size:2.6vh">Host screen · put this on the projector</p>
  <button class="big-btn" id="go">Start hosting</button>
</div>`;
document.getElementById('go').onclick = () => {
  Sound.init();
  started = true;
  document.documentElement.requestFullscreen?.().catch(() => {});
  socket.emit('host:hello');
};

socket.on('connect', () => { if (started) socket.emit('host:hello'); });
socket.on('state', (st) => {
  if (!started) return;
  const key = st.phase + ':' + st.step;
  const prev = S;
  S = st;
  if (key !== phaseKey) { phaseKey = key; enter(st, prev); }
  else update(st, prev);
  document.getElementById('ctl-phase').textContent = st.phase.replace('_', ' ');
  document.getElementById('ctl-pause').style.display = st.phase === 'answering' && st.timed ? '' : 'none';
  const rk = document.getElementById('ctl-ranks');
  rk.textContent = st.showRanks ? 'Rankings: on' : 'Rankings: off';
  rk.classList.toggle('off', !st.showRanks);
  togglePaused(st.paused);
});
socket.on('input', ({ id, steer }) => game?.input(id, steer));
socket.on('forceFinish', () => game?.forceFinish());

// ------------------------------------------------------------- controls
const advance = () => socket.emit('host:advance');
document.getElementById('ctl-next').onclick = advance;
document.getElementById('ctl-pause').onclick = () => socket.emit('host:pause');
document.getElementById('ctl-bots').onclick = () => socket.emit('host:bots', 5);
document.getElementById('ctl-ranks').onclick = () => socket.emit('host:ranks');
document.getElementById('ctl-mute').onclick = (e) => { Sound.setMuted(!Sound.isMuted()); e.target.textContent = Sound.isMuted() ? 'Unmute' : 'Mute'; };
document.getElementById('ctl-fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
document.getElementById('ctl-reset').onclick = (e) => {
  if (e.target.dataset.armed) { socket.emit('host:reset', true); delete e.target.dataset.armed; e.target.textContent = 'Reset'; }
  else { e.target.dataset.armed = 1; e.target.textContent = 'Sure? Click again'; setTimeout(() => { delete e.target.dataset.armed; e.target.textContent = 'Reset'; }, 3000); }
};
window.addEventListener('keydown', (e) => {
  if (!started || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); advance(); }
  if (e.code === 'KeyP') socket.emit('host:pause');
  if (e.code === 'KeyB') socket.emit('host:bots', 5);
  if (e.code === 'KeyR') socket.emit('host:ranks');
  if (e.code === 'KeyM') document.getElementById('ctl-mute').click();
  if (e.code === 'KeyF') document.getElementById('ctl-fs').click();
});
let mouseT;
window.addEventListener('mousemove', () => { document.body.classList.add('mouse'); clearTimeout(mouseT); mouseT = setTimeout(() => document.body.classList.remove('mouse'), 2500); });

function togglePaused(p) {
  let el = document.getElementById('paused');
  if (p && !el) { el = document.createElement('div'); el.id = 'paused'; el.textContent = 'Paused'; document.body.appendChild(el); }
  if (!p && el) el.remove();
}

// ------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function view(html) { stage.innerHTML = html; return stage.firstElementChild; }
const q = () => S.question;

function optionInner(o, type, i) {
  let lead = '';
  if ((type === 'hero' || type === 'photo') && o.img) lead = imgOrTile(o.img, o.label, 'thumb');
  else if (o.emoji) lead = `<span class="em">${esc(o.emoji)}</span>`;
  else if (type === 'colour' && o.colors) lead = `<span class="swatch" style="background:linear-gradient(90deg,${o.colors[0]} 50%,${o.colors[1]} 50%)"></span>`;
  return `<span class="shape">${OPT_SHAPES[i]}</span>${lead}<span>${esc(o.label)}</span>`;
}

// is option i a right answer? (`correct` is a list for multiple-choice questions)
const isRight = (st, i) => (Array.isArray(st.correct) ? st.correct.includes(i) : i === st.correct);

function optionsGrid(st, opts = {}) {
  const qq = st.question;
  if (qq.type === 'text') return '';
  if (qq.type === 'pokemon') {
    return `<div class="pgrid">${qq.options.map((o, i) => `
      <div class="ptile ${opts.reveal ? (isRight(st, i) ? 'right' : 'dim') : ''}" data-i="${i}">
        ${imgOrTile(o.img, o.label, '', '?')}<span class="pn">${esc(o.label)}</span>
        ${opts.reveal && st.counts[i] ? `<span class="pc">${st.counts[i]}</span>` : ''}
      </div>`).join('')}</div>`;
  }
  const total = Math.max(1, st.counts.reduce((a, b) => a + b, 0));
  return `<div class="opts ${qq.options.length > 4 ? 'six' : ''} ${qq.options.some((o) => o.label.length > 22) ? 'long' : ''}">${qq.options.map((o, i) => `
    <div class="opt ${opts.hidden ? 'hidden-opt' : ''} ${opts.reveal ? (isRight(st, i) ? 'right' : 'dim') : ''}" data-i="${i}" style="background:${OPT_COLORS[i]}">
      ${optionInner(o, qq.type, i)}
      ${opts.reveal ? `<span class="cnt">${st.counts[i]}</span><span class="bar" style="width:${(st.counts[i] / total) * 100}%"></span>` : ''}
    </div>`).join('')}</div>`;
}

function qHead(st, withTimer) {
  const qq = st.question;
  const showAnswers = withTimer;
  withTimer = withTimer && st.timed;
  return `<div class="qhead">
    ${withTimer ? `<div class="timer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,.15)" stroke-width="10" fill="none"/><circle id="tring" cx="50" cy="50" r="44" stroke="#FFC93C" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><b id="tnum">${Math.ceil(st.remaining / 1000)}</b></div>` : ''}
    <div class="q"><div class="kicker">Question ${qq.index + 1} of ${qq.total}${qq.pick > 1 ? ` · <span class="pick">Pick ${qq.pick}</span>` : ''}${qq.type === 'text' ? ' · <span class="pick">Type your answer</span>' : ''}</div>${esc(qq.text)}</div>
    ${showAnswers ? `<div class="answered"><b id="ansn">${st.answered}</b><span>answers</span></div>` : ''}
  </div>`;
}

function raysSVG(c1, c2) {
  let s = '';
  for (let i = 0; i < 16; i++) s += `<path d="M500 500 L${500 + 700 * Math.cos((i * 22.5 - 5) * Math.PI / 180)} ${500 + 700 * Math.sin((i * 22.5 - 5) * Math.PI / 180)} L${500 + 700 * Math.cos((i * 22.5 + 5) * Math.PI / 180)} ${500 + 700 * Math.sin((i * 22.5 + 5) * Math.PI / 180)} Z" fill="${i % 2 ? c1 : c2}"/>`;
  return `<svg class="rays" viewBox="0 0 1000 1000">${s}</svg>`;
}

// Big centre-stage feature for one option (showcase and reveal)
function featureHTML(type, o, mode) {
  switch (type) {
    case 'hero':
      return `${raysSVG(o.colors?.[0] || '#7B2CBF', o.colors?.[1] || '#2BA84A')}
        <div class="blob" style="background:${o.colors?.[0] || '#2BA84A'}"></div>
        ${imgOrTile(o.img, o.label, 'hero-img')}
        <div class="banner" style="background:${o.colors?.[1] && type === 'hero' ? o.colors[0] : 'var(--green)'}">${esc(o.label)}${mode === 'reveal' ? '!' : '?'}</div>`;
    case 'photo':
      return `<div class="blob" style="background:var(--panel2)"></div>
        ${imgOrTile(o.img, o.label, 'hero-img')}
        <div class="banner" style="background:var(--green)">${esc(o.label)}${mode === 'reveal' ? '!' : '?'}</div>`;
    case 'animal':
      return `<div class="blob" style="background:${o.bg}"></div>
        <div class="emoji-big anim-${o.anim}">${esc(o.emoji)}</div>
        <div class="label-big">${esc(o.label)}</div>`;
    case 'countries':
      return `<div class="plane">✈️</div><div class="bignum pop">${esc(o.label)}</div>`;
    case 'colour':
      return `<div class="colour-blob" style="background:conic-gradient(${o.colors[0]} 0 25%, ${o.colors[1]} 0 50%, ${o.colors[0]} 0 75%, ${o.colors[1]} 0)"></div>
        <div class="label-big">${esc(o.label)}</div>`;
    default:
      return `<div class="blob" style="background:var(--panel2)"></div>
        <div class="emoji-big pop">${esc(o.emoji || '❓')}</div>
        <div class="label-big">${esc(o.label)}</div>`;
  }
}

function heightScene() {
  let ticks = '';
  for (let cm = 0; cm <= 120; cm += 10) ticks += `<i style="bottom:${(cm / 120) * 100}%;width:${cm % 50 ? 40 : 80}%"></i>${cm % 20 === 0 ? `<em style="bottom:calc(${(cm / 120) * 100}% + .4vh)">${cm}</em>` : ''}`;
  return `<div class="height-wrap" id="hw">
    <div class="ground"></div>
    <div class="ruler" style="height:100%">${ticks}</div>
    <img class="zayn-stretch" id="zs" src="${esc(S.question.heightPhoto || '/assets/zayn/batman_fist.png')}" style="height:50%">
    <div class="hline" id="hl" style="bottom:50%"></div>
    <div class="hlabel" id="hlb" style="bottom:50%">?</div>
  </div>`;
}
function setHeight(cm, label) {
  const pct = (cm / 120) * 100;
  const zs = document.getElementById('zs'); if (!zs) return;
  zs.style.height = pct + '%';
  document.getElementById('hl').style.bottom = pct + '%';
  const lb = document.getElementById('hlb'); lb.style.bottom = pct + '%'; lb.textContent = label;
}

function playFeatureSound(type, o) {
  if (type === 'animal') { Sound.play(o.sound); if (o.anim === 'stomp') setTimeout(() => stage.firstElementChild?.classList.add('shake-screen'), 450); }
  else if (type === 'height') Sound.play('boing');
  else if (type === 'countries') Sound.play('plane');
  else if (type === 'hero' || type === 'photo') Sound.play('whoosh');
  else Sound.play('pop');
}

// ------------------------------------------------------------- phases
function enter(st, prev) {
  token++;
  if (game && st.phase !== 'mg_play') { game.destroy(); game = null; }
  const P = st.phase;
  if (P === 'lobby') return lobby(st);
  if (P === 'intro') return intro(st);
  if (P === 'showcase') return showcase(st);
  if (P === 'answering') return answering(st);
  if (P === 'grading') return grading(st);
  if (P === 'reveal') return reveal(st);
  if (P === 'mg_intro') return mgIntro(st);
  if (P === 'mg_play') return mgPlay(st);
  if (P === 'mg_results') return mgResults(st);
  if (P === 'scoreboard') return scoreboard(st);
  if (P === 'final') return finale(st);
}

function update(st, prev) {
  if (st.phase === 'lobby') return renderLobbyPlayers(st, prev);
  if (st.phase === 'answering') {
    const a = document.getElementById('ansn'); if (a) a.textContent = st.answered;
  }
  if (st.phase === 'grading') renderJudging(st);
  if ((st.phase === 'reveal' || st.phase === 'scoreboard') && st.question?.type === 'text') renderJudging(st);
  if (st.phase === 'mg_play' && st.mg?.type === 'catch') renderCatchCards(st);
  if (st.phase === 'mg_play' && game) game.updatePlayers?.(st.players);
}

// timer loop for answering
(function tickLoop() {
  requestAnimationFrame(tickLoop);
  if (!S || S.phase !== 'answering') return;
  const rem = S.paused ? S.remaining : Math.max(0, S.remaining - (performance.now() - (S._recv || performance.now())));
  const el = document.getElementById('tnum'); const ring = document.getElementById('tring');
  if (!el) return;
  const secs = Math.ceil(rem / 1000);
  el.textContent = secs;
  ring.setAttribute('stroke-dashoffset', 276.5 * (1 - rem / S.timeLimit));
  ring.setAttribute('stroke', secs <= 5 ? '#E5383B' : '#FFC93C');
  if (secs !== lastTick && secs <= 5 && secs > 0 && !S.paused) { Sound.play(secs % 2 ? 'tick' : 'tock'); }
  lastTick = secs;
})();
socket.on('state', (st) => { st._recv = performance.now(); });

// ---- lobby
function lobby(st) {
  Sound.music('lobby');
  const joinUrl = (config.publicUrl || location.origin) + '/play?pin=' + st.pin;
  const wifiQr = st.hideWifi ? '' : config.wifiQr;
  view(`<div class="screen">
    <div class="deco" style="left:-6vh;top:60vh;width:30vh;height:30vh;border-radius:50%;background:var(--red);opacity:.18"></div>
    <div class="deco" style="right:-5vh;top:-6vh;width:26vh;height:26vh;border-radius:5vh;transform:rotate(18deg);background:var(--green);opacity:.2"></div>
    <div class="lobby-top">
      <h1 class="h-title brand" style="font-size:${title().length > 18 ? 7 : 9}vh">${brandHTML(title())}</h1>
      <div class="pin"><span class="kicker">Game PIN</span><b>${st.pin}</b></div>
    </div>
    <div class="steps">
      ${wifiQr ? `<div class="step"><img class="qr" src="/qr.svg?text=${encodeURIComponent(wifiQr)}" alt="Wi-Fi QR">
        <div><div class="n">STEP 1</div><div class="t">Join the Wi-Fi</div><div class="d">Scan with your camera<br>Network: <b>${esc(config.wifiSsid)}</b></div></div></div>` : ''}
      <div class="step"><img class="qr" src="/qr.svg?text=${encodeURIComponent(joinUrl)}" alt="Join QR">
        <div><div class="n">${wifiQr ? 'STEP 2' : 'JOIN'}</div><div class="t">Join the game</div><div class="d">Scan, or go to<br><b>${esc(joinUrl.replace(/^https?:\/\//, '').replace(/\?pin=.*/, ''))}</b><br>PIN <b>${st.pin}</b></div></div></div>
    </div>
    <div class="players-head"><span>Players <span style="color:var(--yellow)" id="pcount">0</span></span><small>Tap a player to remove · Space to start</small></div>
    <div class="player-grid" id="pgrid"></div>
  </div>`);
  renderLobbyPlayers(st);
}
function renderLobbyPlayers(st, prev) {
  const g = document.getElementById('pgrid'); if (!g) return;
  if (prev && st.players.length > prev.players.length) Sound.play('join');
  document.getElementById('pcount').textContent = st.players.length;
  g.innerHTML = st.players.map((p) => `<div class="pchip pop ${p.connected ? '' : 'off'}" data-id="${p.id}">${avatarHTML(p.avatar, 76)}<span class="nm">${esc(p.name)}</span></div>`).join('');
  g.querySelectorAll('.pchip').forEach((el) => el.onclick = () => {
    if (el.querySelector('.kick')) return;
    const b = document.createElement('button'); b.className = 'kick'; b.textContent = 'Remove';
    b.onclick = (e) => { e.stopPropagation(); socket.emit('host:kick', el.dataset.id); };
    el.appendChild(b); setTimeout(() => b.remove(), 3000);
  });
}

// ---- intro
function intro(st) {
  Sound.music(null);
  Sound.play('whoosh');
  const qq = st.question;
  view(`<div class="screen intro">
    <div class="kicker bounce">Question ${qq.index + 1} of ${qq.total}</div>
    <div class="q bounce" style="animation-delay:.1s">${esc(qq.text)}</div>
    ${qq.hint ? `<div class="hint pop" style="animation-delay:.6s">${esc(qq.hint)}</div>` : ''}
  </div>`);
  const t = token;
  Sound.speak(qq.text + (qq.hint ? '. ' + qq.hint : ''), () => setTimeout(() => t === token && advance(), 700));
}

// ---- showcase (each option gets its moment on the big stage)
async function showcase(st) {
  const t = token; const qq = st.question;
  Sound.music('question');
  if (qq.type === 'pokemon') {
    view(`<div class="screen">${qHead(st, false)}
      <div class="feature" id="feat">${shadowMonHTML(qq.mysteryImg, { style: 'width:30vh' })}</div>
      ${optionsGrid(st)}</div>`);
    startShadowLineup(qq);
    const tiles = [...stage.querySelectorAll('.ptile')];
    tiles.forEach((el) => (el.style.opacity = 0));
    for (const el of tiles) { if (t !== token) return; el.style.opacity = 1; el.classList.add('pop'); Sound.play('pop'); await sleep(140); }
    await sleep(1800); if (t === token) advance();
    return;
  }
  if (qq.type === 'choice') {          // plain multiple choice: the answers pop in one after another
    view(`<div class="screen">${qHead(st, false)}<div class="feature" id="feat"><div class="emoji-big pop">${qq.pick > 1 ? '✌️' : '🤔'}</div></div>${optionsGrid(st, { hidden: true })}</div>`);
    await sleep(400);
    for (const el of stage.querySelectorAll('.opt')) { if (t !== token) return; el.classList.remove('hidden-opt'); el.classList.add('pop'); Sound.play('pop'); await sleep(650); }
    await sleep(900); if (t === token) advance();
    return;
  }
  view(`<div class="screen">${qHead(st, false)}<div class="feature" id="feat">${qq.type === 'height' ? heightScene() : ''}</div>${optionsGrid(st, { hidden: true })}</div>`);
  const feat = document.getElementById('feat');
  const tiles = [...stage.querySelectorAll('.opt')];
  await sleep(400);
  for (let i = 0; i < qq.options.length; i++) {
    if (t !== token) return;
    const o = qq.options[i];
    if (qq.type === 'height') setHeight(o.value, o.label);
    else feat.innerHTML = featureHTML(qq.type, o, 'show');
    playFeatureSound(qq.type, o);
    tiles[i].classList.remove('hidden-opt'); tiles[i].classList.add('pop');
    await sleep(qq.type === 'animal' ? 2600 : 2300);
  }
  if (t !== token) return;
  if (qq.type === 'height') setHeight(60, '?'); else feat.innerHTML = `<div class="emoji-big pop">🤔</div>`;
  await sleep(500);
  if (t === token) advance();
}

// ---- answering
function answering(st) {
  Sound.music('question');
  const qq = st.question;
  view(`<div class="screen">${qHead(st, true)}
    <div class="feature">${qq.type === 'pokemon'
      ? shadowMonHTML(qq.mysteryImg, { style: 'width:28vh' })
      : qq.type === 'height' ? heightScene()
      : qq.type === 'text' ? `<div class="write-it"><div class="emoji-big" style="font-size:20vh;animation:floaty 2s infinite">✍️</div><div class="hint">Type your answer on your phone${qq.needed > 1 ? ` · name ${qq.needed}` : ''}</div></div>`
      : `<div class="emoji-big" style="font-size:22vh;animation:floaty 2s infinite">${qq.pick > 1 ? '✌️' : '🤔'}</div>`}</div>
    ${optionsGrid(st)}</div>`);
  if (qq.type === 'height') setTimeout(() => setHeight(60, '?'), 50);
  if (qq.type === 'pokemon') startShadowLineup(qq);
}

// Rotate the mystery shadow with its decoys (content.js shadowDecoys) until the phase
// changes, so the projector doesn't give the answer away.
function startShadowLineup(qq) {
  const t = token;
  const lineup = [qq.mysteryImg, ...(qq.shadowDecoys || [])].filter(Boolean);
  cycleShadowMon(stage.querySelector('.shadowmon'), lineup, () => t === token);
}

// ---- judging typed answers: every group's answer, with the AI's (or the host's) verdict.
// Click an answer to mark it right or wrong; press Space to reveal.
function grading(st) {
  Sound.music(null);
  Sound.play('whoosh');
  view(`<div class="screen">${qHead(st, false)}
    <div class="judge-head"><div class="accepted"><span class="kicker">Accepted</span> ${acceptedHTML(st)}</div><div id="jstatus"></div></div>
    <div class="jgrid" id="jgrid"></div>
    <div class="kicker judge-tip">Click an answer to mark it right or wrong · Space to reveal</div></div>`);
  renderJudging(st);
}
const acceptedHTML = (st) => (st.accepted || []).map((a) => `<span class="acc">${esc(a.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3).join(' / '))}</span>`).join('');

function renderJudging(st) {
  const g = document.getElementById('jgrid'); if (!g) return;
  const judging = st.phase === 'grading';
  const by = { ai: '🤖 AI', match: '✓ word match', host: '👤 host', blank: 'no answer' };
  g.innerHTML = st.players.map((p) => {
    const v = judging ? p.verdict : p.correct;
    const cls = v === true ? 'yes' : v === false ? 'no' : 'maybe';
    return `<button class="jcard ${cls}" data-id="${p.id}" title="${esc(p.verdictReason || '')}">
      <div class="jtop">${avatarHTML(p.avatar, 44)}<span class="nm">${esc(p.name)}</span><span class="vd">${v === true ? '✓' : v === false ? '✕' : '?'}</span></div>
      <div class="ans">${typeof p.answer === 'string' && p.answer ? esc(p.answer) : '<em>No answer</em>'}</div>
      <div class="by">${p.verdictBy ? by[p.verdictBy] || '' : judging && st.grading?.status === 'checking' ? 'checking…' : 'tap to judge'}</div>
      ${p.verdictReason ? `<div class="why">${esc(p.verdictReason)}</div>` : ''}
    </button>`;
  }).join('') || '<div class="hint">No players yet</div>';
  g.querySelectorAll('.jcard').forEach((el) => el.onclick = () => {
    const p = st.players.find((x) => x.id === el.dataset.id);
    const now = judging ? p.verdict : p.correct;
    socket.emit('host:verdict', { id: el.dataset.id, correct: now !== true });
  });
  const s = document.getElementById('jstatus');
  if (s && judging) {
    const gr = st.grading || {};
    const left = st.players.filter((p) => p.verdict == null).length;
    s.innerHTML = gr.status === 'checking' ? '<span class="pill">🤖 The AI judge is checking…</span>'
      : gr.status === 'error' ? `<span class="pill bad">AI judge: ${esc(gr.error || 'failed')}</span> <button class="small-btn" id="regrade">Try again</button>`
      : gr.status === 'off' ? '<span class="pill">No AI judge: tap each answer</span>'
      : '<span class="pill ok">🤖 Checked</span>';
    if (left && gr.status !== 'checking') s.innerHTML += ` <span class="pill warn">${left} to judge (counts as wrong)</span>`;
    const rb = document.getElementById('regrade'); if (rb) rb.onclick = () => socket.emit('host:regrade');
  }
}

// ---- reveal
async function reveal(st) {
  const t = token; const qq = st.question;
  if (qq.type === 'text') {
    Sound.music(null);
    const right = st.players.filter((p) => p.correct).length;
    view(`<div class="screen">${qHead(st, false)}
      <div class="judge-head"><div class="accepted big"><span class="kicker">The answer</span> ${acceptedHTML(st)}</div></div>
      <div class="jgrid" id="jgrid"></div></div>`);
    renderJudging(st);
    Sound.play(right ? 'correct' : 'wrong');
    if (right) confetti();
    setTimeout(() => t === token && Sound.speak(qq.fact || ('The answer is ' + (st.accepted?.[0] || '').split('/')[0])), 900);
    return;
  }
  Sound.music(null);
  Sound.play('drumroll');
  view(`<div class="screen">${qHead(st, false)}<div class="feature" id="feat"><div class="emoji-big" style="animation:pulse .4s infinite">🥁</div></div>${optionsGrid(st)}</div>`);
  await sleep(1300); if (t !== token) return;
  const rightIdx = Array.isArray(st.correct) ? st.correct : [st.correct];
  const right = qq.options[rightIdx[0]];
  const feat = document.getElementById('feat');
  stage.querySelector(qq.type === 'pokemon' ? '.pgrid' : '.opts').outerHTML = optionsGrid(st, { reveal: true });
  Sound.play('correct');
  if (qq.type === 'height') { feat.innerHTML = heightScene(); setTimeout(() => setHeight(right.value, right.label), 50); Sound.play('stretch'); }
  else if (qq.type === 'countries' && qq.reveal) {
    feat.innerHTML = `<div class="flags">${qq.reveal.map(([f, n], i) => `<div class="flag pop" style="animation-delay:${i * 0.18}s"><span>${f}</span>${esc(n)}</div>`).join('')}</div>`;
    qq.reveal.forEach((_, i) => setTimeout(() => t === token && Sound.play('pop'), i * 180));
  } else if (qq.type === 'pokemon') {
    feat.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:1vh">${imgOrTile(right.img, right.label, 'hero-img')}<div class="hint">Now catch the mystery one!</div></div>`;
  } else if (rightIdx.length > 1) {          // several right answers: show them all
    feat.innerHTML = `<div class="multi-right">${rightIdx.map((i, k) => `<div class="mr pop" style="animation-delay:${k * 0.15}s;background:${OPT_COLORS[i]}">${qq.options[i].emoji ? `<span class="em">${esc(qq.options[i].emoji)}</span>` : ''}${esc(qq.options[i].label)}</div>`).join('')}</div>`;
    Sound.play('pop');
  } else {
    feat.innerHTML = featureHTML(qq.type, right, 'reveal');
    playFeatureSound(qq.type, right);
  }
  if (qq.type === 'colour') confetti(right.colors.concat(right.colors));
  else if (qq.type === 'food' || qq.type === 'career' || qq.type === 'photo' || qq.type === 'choice') confetti();
  setTimeout(() => t === token && Sound.speak(qq.fact || ('The answer is ' + rightIdx.map((i) => qq.options[i].label).join(' and '))), 900);
}

// ---- mini games
const MG_INFO = {
  climb: { title: 'Hero Tower Escape!', icon: '🏢', how: ['You are the superhero you picked', 'Tilt your phone left and right to run', 'Run into a ladder to climb up', 'Watch out for the patrol bots', 'First through the EXIT wins bonus points!'] },
  catch: { title: 'Catch the Mystery!', icon: '⭐', how: ['Look at your phone', 'A mystery friend appears in the grass', 'Circle the ball with your finger to spin a curveball', 'Swipe up to throw when the ring is small and green', 'You have 3 balls. Fastest catch wins!'] },
  race: { title: 'Birthday Table Grand Prix!', icon: '🏎️', how: ['Your car drives itself', 'Tilt your phone left and right to steer', 'Stay between the chalk lines', 'Bumping the cake slows you down', '3 laps. Finishing place = bonus points!'] },
};
function mgIntro(st) {
  const info = MG_INFO[st.mg.type];
  Sound.music(st.mg.type === 'race' ? 'race' : 'lobby');
  Sound.speak(info.title);
  view(`<div class="screen intro">
    <div class="kicker">${st.mg.type === 'race' ? 'Grand finale' : 'Bonus mini game'}</div>
    <h1 class="h-title pop" style="font-size:10vh">${info.icon} ${esc(info.title)}</h1>
    <div style="display:flex;gap:5vw;align-items:center">
      ${st.mg.type !== 'catch' ? '<div class="phone-tilt"></div>' : '<div style="font-size:20vh;animation:floaty 2s infinite">📱</div>'}
      <ul class="how" style="text-align:left">${info.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    </div>
    <div class="kicker" style="animation:pulse 1.2s infinite">Press Space when everyone is ready</div>
  </div>`);
}

function mgPlay(st) {
  const type = st.mg.type;
  if (type === 'catch') {
    Sound.music('lobby');
    view(`<div class="screen">
      <div class="qhead"><div class="q"><div class="kicker">Bonus mini game</div>Catch the Mystery! <span style="color:var(--yellow)" id="ctime"></span></div></div>
      <div class="catch-host">
        <div class="catch-mon">${shadowMonHTML(S.mysteryImg || '/assets/pokemon/pikachu.png', { style: 'width:min(30vw,48vh)', puffs: 18 })}<div class="hint">Who will catch it first?</div></div>
        <div class="cgrid" id="cgrid"></div>
      </div></div>`);
    renderCatchCards(st);
    const t = token;
    (function tk() { if (t !== token) return; const el = document.getElementById('ctime'); if (el) el.textContent = Math.max(0, Math.ceil((S.mg.endsAt - Date.now()) / 1000)) + 's'; setTimeout(tk, 250); })();
    return;
  }
  Sound.music(type === 'race' ? 'race' : 'lobby');
  view(`<div class="screen" style="padding:0"><div class="mg-canvas" id="mgc"></div></div>`);
  const mount = document.getElementById('mgc');
  const opts = {
    mount, players: st.players, heroImgs: S.heroImgs,
    laps: S.games?.raceLaps, duration: S.games?.climbSeconds,
    sound: Sound,
    onStatus: (status) => socket.emit('host:mgStatus', status),
    onFinish: (res) => socket.emit('host:mgResults', res),
  };
  game = type === 'race' ? startRace(opts) : startClimb(opts);
}

function renderCatchCards(st) {
  const g = document.getElementById('cgrid'); if (!g) return;
  const status = st.mg.status || {};
  const label = { aiming: 'Aiming 🎯', wobble: 'Wobbling…', caught: 'CAUGHT! ⭐', escaped: 'It got away 💨', throwing: 'Throwing!' };
  const prevCaught = new Set([...g.querySelectorAll('.ccard.caught')].map((e) => e.dataset.id));
  g.innerHTML = st.players.map((p) => {
    const s = status[p.id] || { balls: 3, state: 'aiming' };
    const cls = s.caught ? 'caught' : s.state === 'escaped' ? 'escaped' : s.state === 'wobble' ? 'wobble' : '';
    if (s.caught && !prevCaught.has(p.id) && g.children.length) Sound.play('sparkle');
    return `<div class="ccard ${cls}" data-id="${p.id}">${avatarHTML(p.avatar, 48)}<div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="st">${label[s.state] || s.state}</div></div>
      <div class="balls">${[0, 1, 2].map((i) => `<i class="${i < 3 - s.balls ? 'used' : ''}"></i>`).join('')}</div></div>`;
  }).join('');
}

function mgResults(st) {
  Sound.music(null);
  Sound.play('cheer');
  const order = st.mg.results || [];
  const byId = Object.fromEntries(st.players.map((p) => [p.id, p]));
  const info = MG_INFO[st.mg.type];
  view(`<div class="screen">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 6vw">
      <h2 class="h-title" style="font-size:6vh">${info.icon} ${esc(info.title.replace('!', ''))} results</h2>
      ${st.mg.type === 'catch' ? `<div style="display:flex;align-items:center;gap:1vw"><img src="${esc(S.mysteryImg || '')}" style="height:10vh" onerror="this.remove()"><span class="fact">It was Pikachu!</span></div>` : ''}
    </div>
    <div class="board">${order.slice(0, 8).map((id, i) => { const p = byId[id]; if (!p) return ''; return `
      <div class="brow ${i === 0 ? 'first' : ''}" style="animation-delay:${(7 - Math.min(i, 7)) * 0.12}s">
        <span class="rk">${i + 1}</span>${avatarHTML(p.avatar, 50)}<span class="nm">${esc(p.name)}</span>
        <span class="gn">+${st.mg.bonus?.[id] ?? 0}</span></div>`; }).join('')}</div></div>`);
  confetti();
}

// Scoreboard: rows appear in last round's order, then slide to their new places while the
// scores count up; climbers glow, answer streaks get a flame, and the longest streak is announced.
function scoreboard(st) {
  Sound.music('lobby');
  const t = token;
  const qq = st.question;
  const ROW = 8.4;                                           // vh per row (row + gap)
  const top = st.players.slice(0, 8);
  const champ = st.players.filter((p) => p.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  view(`<div class="screen">
    <div class="sb-head">
      <h2 class="sb-title">Scoreboard</h2>
      ${qq?.fact ? `<span class="fact pop">${esc(qq.fact)}</span>` : ''}
    </div>
    <div class="sb-list" id="sbl" style="height:${top.length * ROW}vh">${top.map((p, i) => {
      const from = p.prevRank ? Math.min(p.prevRank - 1, 8.6) : i;     // where the row was last round
      const mv = p.prevRank ? p.prevRank - (i + 1) : 0;
      return `<div class="sb-row ${i === 0 ? 'first' : ''} ${mv > 0 ? 'up' : ''}" style="top:${i * ROW}vh;--from:${((from - i) * ROW).toFixed(2)}vh;animation-delay:${(i * 0.07).toFixed(2)}s">
        <span class="rk">${i + 1}</span>${avatarHTML(p.avatar, 52)}
        <span class="nm">${esc(p.name)}</span>
        ${p.streak >= 2 ? `<span class="streak" title="Answer streak">🔥 ${p.streak}</span>` : ''}
        <span class="mv ${mv > 0 ? 'up' : mv < 0 ? 'down' : ''}">${mv > 0 ? '▲ ' + mv : mv < 0 ? '▼ ' + -mv : ''}</span>
        <span class="gn">${p.lastGain ? '+' + p.lastGain : ''}</span>
        <span class="sc" data-score="${p.score}">${p.score - (p.lastGain || 0)}</span></div>`;
    }).join('')}</div>
    ${st.players.length > 8 ? `<div class="sb-more">+ ${st.players.length - 8} more players</div>` : ''}
    ${champ ? `<div class="sb-streak">${avatarHTML(champ.avatar, 50)}<span><b>${esc(champ.name)}</b> has the highest answer streak of <b>${champ.streak}</b>!</span><span class="flame">🔥</span></div>` : ''}
  </div>`);
  // 1) rows fly in at their old places  2) slide to new ranks + scores count up  3) streak banner
  setTimeout(() => {
    if (t !== token) return;
    document.getElementById('sbl')?.classList.add('settle');
    if (top.some((p) => p.prevRank && p.prevRank !== top.indexOf(p) + 1)) Sound.play('whoosh');
    stage.querySelectorAll('.sc[data-score]').forEach((el) => {
      const to = +el.dataset.score, from = +el.textContent, t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }, 1300);
  if (champ) setTimeout(() => t === token && Sound.play('sparkle'), 2500);
}

async function finale(st) {
  const t = token;
  Sound.music(null);
  Sound.play('drumroll');
  const top = st.players.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top[i]);
  const H = { 0: 34, 1: 24, 2: 17 }; const C = { 0: 'var(--yellow)', 1: '#C0C6D8', 2: '#D08A4E' };
  view(`<div class="screen">
    <h1 class="h-title brand" style="text-align:center;font-size:8vh">🏆 ${brandHTML(title())} Champions</h1>
    <div class="podium">${order.map((i) => { const p = top[i]; return `
      <div class="pod" style="animation-delay:${(2 - i) * 1.1 + 0.4}s">
        ${avatarHTML(p.avatar, i === 0 ? 130 : 100)}<span class="nm">${esc(p.name)}</span><span class="sc">${p.score} pts</span>
        <div class="blk" style="height:${H[i]}vh;background:${C[i]};color:var(--ink)">${i + 1}</div></div>`; }).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:1vh 2vw;justify-content:center;color:var(--soft);font-weight:800;font-size:2.2vh">
      ${st.players.slice(3).map((p, i) => `<span>${i + 4}. ${esc(p.name)} · ${p.score}</span>`).join('')}</div>
  </div>`);
  for (const i of [2, 1, 0]) { await sleep(1100); if (t !== token) return; if (top[i]) Sound.play(i === 0 ? 'cheer' : 'pop'); }
  Sound.music('final');
  confetti(undefined, 200);
  if (top[0]) Sound.speak(`Congratulations ${top[0].name}!`);
  const again = setInterval(() => { if (t !== token) return clearInterval(again); confetti(undefined, 80); }, 4000);
}

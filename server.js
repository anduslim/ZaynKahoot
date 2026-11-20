// Zayn's Kahoot — game server
const express = require('express');
const http = require('http');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const store = require('./content-store');

// Questions + settings: the admin panel's saved copy if there is one, otherwise content.js.
// `edited` is the full list the admin edits (switched-off questions included); `content` is
// what the running game uses. Edits saved mid-game wait in `pending` until the next game.
let { content: edited, fromFile } = store.load();
let content = store.live(edited);
let pending = null;

// Admin password: ADMIN_PASSWORD, or a random code printed below when the server starts.
const ADMIN_KEY = process.env.ADMIN_PASSWORD || String(crypto.randomInt(100000, 1000000));

const PORT = process.env.PORT || 3000;
const WIFI = {
  ssid: process.env.WIFI_SSID || '',
  password: process.env.WIFI_PASSWORD || '',
  type: process.env.WIFI_TYPE || 'WPA',
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 5000, pingTimeout: 8000 });

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use('/uploads', express.static(store.UPLOAD_DIR, { maxAge: 0 }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/vendor/fredoka', express.static(path.join(__dirname, 'node_modules/@fontsource/fredoka')));
app.use('/vendor/nunito', express.static(path.join(__dirname, 'node_modules/@fontsource/nunito')));
app.use('/vendor/socket.io-client', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.get('/', (req, res) => res.redirect('/play'));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public/host.html')));
app.get('/play', (req, res) => res.sendFile(path.join(__dirname, 'public/play.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// ---------------------------------------------------------------- admin API
const adminOnly = (req, res, next) => {
  const k = String(req.get('x-admin-key') || '');
  const ok = k.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY));
  if (!ok) return res.status(401).json({ error: 'Wrong admin password' });
  next();
};
const adminState = () => ({
  content: pending || edited,
  pending: !!pending,
  savedToFile: fromFile,
  phase: game.phase,
  players: activePlayers().length,
  wifi: !!WIFI.ssid,
  publicUrl: process.env.PUBLIC_URL || '',
  passwordFromEnv: !!process.env.ADMIN_PASSWORD,
});
app.get('/api/admin/content', adminOnly, (req, res) => res.json(adminState()));
app.get('/api/admin/defaults', adminOnly, (req, res) => res.json(store.defaults()));
app.put('/api/admin/content', adminOnly, express.json({ limit: '1mb' }), (req, res) => {
  let c;
  try { c = store.sanitize(req.body?.content); } catch (e) { return res.status(400).json({ error: e.message }); }
  store.save(c); fromFile = true;
  const restart = req.body?.restart === true;
  if (game.phase === 'lobby' || restart) {
    applyContent(c);
    if (restart && game.phase !== 'lobby') resetGame(true);
    else broadcast();
  } else pending = c;                                   // applied when the host resets / starts a new game
  res.json({ ok: true, applied: !pending, ...adminState() });
});
app.post('/api/admin/restore', adminOnly, (req, res) => {
  store.clearSaved(); fromFile = false;
  const c = store.defaults();
  if (game.phase === 'lobby') { applyContent(c); broadcast(); } else pending = c;
  res.json({ ok: true, ...adminState() });
});
// image upload for new questions: raw body, saved to DATA_DIR/uploads
const IMG_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
app.post('/api/admin/upload', adminOnly, express.raw({ type: Object.keys(IMG_TYPES), limit: '12mb' }), (req, res) => {
  const ext = IMG_TYPES[req.get('content-type')];
  if (!ext || !req.body?.length) return res.status(400).json({ error: 'Send a PNG, JPG, WebP or GIF image' });
  const base = String(req.query.name || 'photo').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
  const file = `${base}-${Date.now().toString(36)}${ext}`;
  fs.mkdirSync(store.UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(store.UPLOAD_DIR, file), req.body);
  res.json({ ok: true, path: '/uploads/' + file });
});
// every picture the editor can pick from
app.get('/api/admin/images', adminOnly, (req, res) => {
  const walk = (dir, url) => {
    let out = [];
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory()) out = out.concat(walk(path.join(dir, f.name), `${url}/${f.name}`));
      else if (/\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)) out.push(`${url}/${f.name}`);
    }
    return out;
  };
  res.json([...walk(path.join(__dirname, 'public/assets'), '/assets'), ...walk(store.UPLOAD_DIR, '/uploads')].sort());
});
app.get('/qr.svg', async (req, res) => {
  try {
    const svg = await QRCode.toString(String(req.query.text || ''), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').send(svg);
  } catch (e) { res.status(400).send('bad'); }
});
app.get('/config.json', (req, res) => {
  const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');
  res.json({
    title: content.title,
    wifiSsid: WIFI.ssid,
    wifiQr: WIFI.ssid ? `WIFI:T:${WIFI.type};S:${esc(WIFI.ssid)};P:${esc(WIFI.password)};;` : '',
    publicUrl: process.env.PUBLIC_URL || '',
  });
});

// ---------------------------------------------------------------- game state
let steps = [];
function applyContent(c) {
  edited = c; pending = null;
  content = store.live(c);
  steps = [
    ...content.questions.map((q, i) => ({ kind: 'question', qi: i })),
    ...(content.finale !== 'none' ? [{ kind: 'finale' }] : []),
    { kind: 'final' },
  ];
}
applyContent(edited);

const BOT_NAMES = ['Robo Rex', 'Captain Byte', 'Zippy', 'Noodle', 'Turbo Tim', 'Sparkle', 'Bolt', 'Pixel Pat', 'Mango', 'Wobble'];
// avatar choices (drawn by public/js/avatars.js; keep these lists in step with it)
const COLORS = ['#E5383B', '#F97316', '#D49B00', '#2BA84A', '#06B6D4', '#3A86FF', '#8B5CF6', '#EC4899'];
const ANIMALS = ['bear', 'fox', 'cat', 'panda', 'penguin', 'frog', 'owl', 'bunny', 'dog', 'monkey', 'dino', 'unicorn'];
const ACCS = ['none', 'party', 'crown', 'headphones', 'sunglasses', 'glasses', 'bow', 'cap', 'wizard', 'flowers', 'cake', 'pirate'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randomAvatar = () => ({ animal: pick(ANIMALS), acc: pick(ACCS), color: pick(COLORS) });
function cleanAvatar(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    animal: ANIMALS.includes(a.animal) ? a.animal : 'bear',
    acc: ACCS.includes(a.acc) ? a.acc : 'none',
    color: /^#[0-9a-fA-F]{6}$/.test(String(a.color)) ? a.color : COLORS[0],
  };
}

// New game (Reset button, or an admin "save and restart"); picks up any saved admin edits.
function resetGame(keepPlayers) {
  if (pending) applyContent(pending);
  const old = game.players;
  newGame();
  if (keepPlayers) for (const [id, p] of old) { p.score = 0; p.lastGain = 0; p.answer = null; p.streak = 0; game.players.set(id, p); }
  else for (const p of old.values()) if (p.socketId) io.to(p.socketId).emit('kicked');
  broadcast();
}

let game;
function newGame() {
  game = {
    pin: String(Math.floor(1000 + Math.random() * 9000)),
    phase: 'lobby',
    step: -1,
    players: new Map(),
    deadline: 0,
    remaining: 0,
    paused: false,
    answerOpenedAt: 0,
    mg: null,
    lastRanks: {},
  };
}
newGame();

const currentStep = () => steps[game.step] || null;
const currentQ = () => {
  const s = currentStep();
  return s && s.kind === 'question' ? content.questions[s.qi] : null;
};
const activePlayers = () => [...game.players.values()].filter((p) => !p.kicked);
const ranked = () => activePlayers().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

function publicQuestion(q) {
  if (!q) return null;
  const { correct, ...rest } = q;
  const extra = q.type === 'height' ? { heightPhoto: content.heightPhoto } : {};
  return { ...rest, ...extra, index: content.questions.indexOf(q), total: content.questions.length };
}

function mgType() {
  if (!game.mg) return null;
  return game.mg.type;
}

function hostView() {
  const q = currentQ();
  const showAnswer = ['reveal', 'mg_intro', 'mg_play', 'mg_results', 'scoreboard'].includes(game.phase);
  const counts = q ? q.options.map((_, i) => activePlayers().filter((p) => p.answer === i).length) : [];
  return {
    pin: game.pin,
    phase: game.phase,
    step: game.step,
    stepKind: currentStep()?.kind || null,
    question: publicQuestion(q),
    correct: q && showAnswer ? q.correct : null,
    counts,
    answered: activePlayers().filter((p) => p.answer != null).length,
    paused: game.paused,
    remaining: game.paused ? game.remaining : Math.max(0, game.deadline - Date.now()),
    timeLimit: q ? q.timeLimit * 1000 : 0,
    mg: game.mg && { type: game.mg.type, status: game.mg.status, results: game.mg.results, endsAt: game.mg.endsAt, bonus: game.mg.bonus },
    players: ranked().map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, lastGain: p.lastGain,
      answer: p.answer, connected: p.connected, bot: p.bot, prevRank: game.lastRanks[p.id] ?? null, hero: p.hero ?? 0, streak: p.streak || 0,
    })),
    isLast: game.step === steps.length - 1,
    heroImgs: (content.questions.find((x) => x.type === 'hero')?.options || []).map((o) => o.img),
    mysteryImg: content.questions.find((x) => x.type === 'pokemon')?.mysteryImg,
    games: content.games,
  };
}

function playerView(p) {
  const q = currentQ();
  const r = ranked();
  const showAnswer = ['reveal', 'mg_intro', 'mg_play', 'mg_results', 'scoreboard'].includes(game.phase);
  return {
    phase: game.phase,
    stepKind: currentStep()?.kind || null,
    me: { id: p.id, name: p.name, avatar: p.avatar, score: p.score, lastGain: p.lastGain, rank: r.indexOf(p) + 1, of: r.length, streak: p.streak || 0 },
    question: publicQuestion(q),
    answer: p.answer,
    correct: q && showAnswer ? q.correct : null,
    wasCorrect: q && showAnswer ? p.answer === q.correct : null,
    paused: game.paused,
    mg: game.mg && { type: game.mg.type, hero: p.hero, endsAt: game.mg.endsAt, myBonus: game.mg.bonus?.[p.id] ?? null, myPlace: game.mg.results ? game.mg.results.indexOf(p.id) + 1 : null },
  };
}

function broadcast() {
  io.to('host').emit('state', hostView());
  for (const p of game.players.values()) {
    if (p.socketId && !p.bot) io.to(p.socketId).emit('state', playerView(p));
  }
}

// ---------------------------------------------------------------- phase flow
function goto(phase) {
  game.phase = phase;
  if (phase === 'answering') {
    const q = currentQ();
    for (const p of game.players.values()) { p.answer = null; p.answerAt = null; }
    game.answerOpenedAt = Date.now();
    game.deadline = Date.now() + q.timeLimit * 1000;
    game.paused = false;
    scheduleBotAnswers(q);
  }
  if (phase === 'reveal') scoreQuestion();
  broadcast();
}

function scoreQuestion() {
  const q = currentQ();
  game.lastRanks = Object.fromEntries(ranked().map((p, i) => [p.id, i + 1]));
  for (const p of activePlayers()) {
    p.lastGain = 0;
    p.streak = p.answer === q.correct ? (p.streak || 0) + 1 : 0;   // answers right in a row
    if (p.answer === q.correct) {
      if (q.minigame) p.lastGain = 1000;
      else {
        const t = Math.min(1, (p.answerAt - game.answerOpenedAt) / (q.timeLimit * 1000));
        p.lastGain = Math.round(500 + 500 * (1 - t));
      }
      p.score += p.lastGain;
    }
    // remember chosen hero for the climb game
    if (q.type === 'hero') p.hero = p.answer != null ? p.answer : Math.floor(Math.random() * q.options.length);
  }
}

function startMinigame(type) {
  game.mg = { type, status: {}, results: null, bonus: null, endsAt: 0 };
  game.lastRanks = Object.fromEntries(ranked().map((p, i) => [p.id, i + 1]));
  for (const p of activePlayers()) p.lastGain = 0;
  goto('mg_intro');
}

function playMinigame() {
  const dur = { climb: content.games.climbSeconds * 1000, catch: content.games.catchSeconds * 1000, race: 120000 }[game.mg.type];
  game.mg.endsAt = Date.now() + dur;
  if (game.mg.type === 'catch') {
    for (const p of activePlayers()) game.mg.status[p.id] = { balls: 3, state: 'aiming', caught: false, done: false };
    scheduleBotCatch();
  }
  goto('mg_play');
}

function finishMinigame(order) {
  if (game.phase !== 'mg_play') return;
  const ids = new Set(activePlayers().map((p) => p.id));
  order = order.filter((id) => ids.has(id));
  for (const id of ids) if (!order.includes(id)) order.push(id);
  const mult = game.mg.type === 'race' ? content.raceMultiplier : 1;
  const finishedSet = game.mg.finished ? new Set(game.mg.finished) : null;
  game.mg.results = order;
  game.mg.bonus = {};
  order.forEach((id, i) => {
    const p = game.players.get(id);
    const placed = !finishedSet || finishedSet.has(id);
    const base = placed ? (content.minigameBonus[i] ?? content.minigameParticipation) : content.minigameParticipation;
    const b = Math.round(base * mult);
    game.mg.bonus[id] = b;
    p.lastGain = b;
    p.score += b;
  });
  goto('mg_results');
}

function finishCatch() {
  const st = game.mg.status;
  const order = activePlayers()
    .map((p) => ({ id: p.id, s: st[p.id] || { caught: false, balls: 0 } }))
    .sort((a, b) => (b.s.caught - a.s.caught) || (b.s.balls - a.s.balls) || ((a.s.t || 1e12) - (b.s.t || 1e12)))
    .map((x) => x.id);
  game.mg.finished = order.filter((id) => st[id]?.caught);
  finishMinigame(order);
}

function advance() {
  const s = currentStep();
  switch (game.phase) {
    case 'lobby':
      game.step = 0; goto('intro'); break;
    case 'intro':
      if (s.kind === 'question') goto('showcase');
      break;
    case 'showcase':
      goto('answering'); break;
    case 'answering':
      goto('reveal'); break;
    case 'reveal': {
      const q = currentQ();
      if (q.minigame) startMinigame(q.minigame); else goto('scoreboard');
      break;
    }
    case 'mg_intro':
      playMinigame(); break;
    case 'mg_play':
      if (game.mg.type === 'catch') finishCatch();
      else io.to('host').emit('forceFinish');
      break;
    case 'mg_results':
      goto('scoreboard'); break;
    case 'scoreboard':
      game.step++;
      game.mg = null;
      if (currentStep().kind === 'question') goto('intro');
      else if (currentStep().kind === 'finale') startMinigame(content.finale);
      else goto('final');
      break;
  }
}

setInterval(() => {
  if (game.phase === 'answering' && !game.paused && Date.now() >= game.deadline) goto('reveal');
  if (game.phase === 'mg_play' && game.mg.type === 'catch' && Date.now() >= game.mg.endsAt) finishCatch();
}, 200);

function maybeEndAnswering() {
  if (game.phase !== 'answering') return;
  const live = activePlayers().filter((p) => p.connected || p.bot);
  if (live.length && live.every((p) => p.answer != null)) setTimeout(() => game.phase === 'answering' && goto('reveal'), 700);
}

function maybeEndCatch() {
  const st = game.mg.status;
  const live = activePlayers().filter((p) => p.connected || p.bot);
  if (live.every((p) => st[p.id]?.done)) setTimeout(() => game.phase === 'mg_play' && finishCatch(), 2500);
}

// ---------------------------------------------------------------- bots
function addBots(n) {
  for (let i = 0; i < n; i++) {
    const id = 'bot-' + Math.random().toString(36).slice(2, 8);
    const name = BOT_NAMES[game.players.size % BOT_NAMES.length] + (game.players.size >= BOT_NAMES.length ? ' ' + game.players.size : '');
    game.players.set(id, {
      id, name, bot: true, connected: true, score: 0, lastGain: 0, answer: null,
      avatar: randomAvatar(), streak: 0,
    });
  }
  broadcast();
}

function scheduleBotAnswers(q) {
  for (const p of activePlayers().filter((p) => p.bot)) {
    const delay = 1500 + Math.random() * (q.timeLimit * 600);
    setTimeout(() => {
      if (game.phase !== 'answering' || p.answer != null) return;
      p.answer = Math.random() < 0.55 ? q.correct : Math.floor(Math.random() * q.options.length);
      p.answerAt = Date.now();
      broadcast();
      maybeEndAnswering();
    }, delay);
  }
}

function scheduleBotCatch() {
  for (const p of activePlayers().filter((p) => p.bot)) {
    const throwOnce = () => {
      if (game.phase !== 'mg_play' || !game.mg || game.mg.type !== 'catch') return;
      const s = game.mg.status[p.id];
      if (s.done) return;
      s.state = 'wobble';
      broadcast();
      setTimeout(() => {
        if (!game.mg || game.mg.type !== 'catch') return;
        s.balls--;
        if (Math.random() < 0.4) { s.caught = true; s.done = true; s.state = 'caught'; s.t = Date.now(); }
        else if (s.balls <= 0) { s.done = true; s.state = 'escaped'; }
        else { s.state = 'aiming'; setTimeout(throwOnce, 1500 + Math.random() * 3000); }
        broadcast();
        maybeEndCatch();
      }, 2200);
    };
    setTimeout(throwOnce, 2000 + Math.random() * 4000);
  }
}

// ---------------------------------------------------------------- sockets
io.on('connection', (socket) => {
  socket.on('host:hello', () => {
    socket.join('host');
    socket.data.host = true;
    socket.emit('state', hostView());
  });

  socket.on('host:advance', () => socket.data.host && advance());
  socket.on('host:pause', () => {
    if (!socket.data.host || game.phase !== 'answering') return;
    if (game.paused) { game.deadline = Date.now() + game.remaining; game.paused = false; }
    else { game.remaining = Math.max(0, game.deadline - Date.now()); game.paused = true; }
    broadcast();
  });
  socket.on('host:kick', (id) => {
    if (!socket.data.host) return;
    const p = game.players.get(id);
    if (!p) return;
    if (p.socketId) io.to(p.socketId).emit('kicked');
    game.players.delete(id);
    broadcast();
  });
  socket.on('host:bots', (n) => socket.data.host && addBots(Math.min(20, Number(n) || 5)));
  socket.on('host:reset', (keepPlayers) => {
    if (!socket.data.host) return;
    resetGame(keepPlayers);
  });
  socket.on('host:mgResults', (order) => {
    if (!socket.data.host || game.phase !== 'mg_play') return;
    game.mg.finished = order.finished || null;
    finishMinigame(order.order || order);
  });
  socket.on('host:mgStatus', (status) => {
    if (!socket.data.host || !game.mg) return;
    // lightweight relay of race/climb progress to phones (place etc.)
    for (const [id, s] of Object.entries(status)) {
      const p = game.players.get(id);
      if (p && p.socketId) io.to(p.socketId).volatile.emit('mgStatus', s);
    }
  });

  // ---- players
  socket.on('join', ({ playerId, name, avatar, pin }, ack) => {
    let p = playerId && game.players.get(playerId);
    if (!p) {
      if (pin && String(pin) !== game.pin) return ack?.({ ok: false, error: 'Wrong game PIN' });
      if (activePlayers().length >= 24) return ack?.({ ok: false, error: 'Game is full' });
      const id = playerId || 'p-' + Math.random().toString(36).slice(2, 10);
      p = { id, score: 0, lastGain: 0, answer: null, bot: false, streak: 0 };
      game.players.set(id, p);
    }
    if (name) p.name = String(name).slice(0, 14);
    if (avatar) p.avatar = cleanAvatar(avatar);
    p.name = p.name || 'Player';
    p.avatar = p.avatar || randomAvatar();
    p.socketId = socket.id;
    p.connected = true;
    socket.data.playerId = p.id;
    ack?.({ ok: true, playerId: p.id, pin: game.pin });
    broadcast();
  });

  socket.on('profile', ({ name, avatar }) => {
    const p = game.players.get(socket.data.playerId);
    if (!p) return;
    if (name) p.name = String(name).slice(0, 14);
    if (avatar) p.avatar = cleanAvatar(avatar);
    p.ready = true;
    broadcast();
  });

  socket.on('answer', (idx) => {
    const p = game.players.get(socket.data.playerId);
    const q = currentQ();
    if (!p || !q || game.phase !== 'answering' || game.paused || p.answer != null) return;
    if (typeof idx !== 'number' || idx < 0 || idx >= q.options.length) return;
    p.answer = idx;
    p.answerAt = Date.now();
    broadcast();
    maybeEndAnswering();
  });

  socket.on('input', (steer) => {
    const id = socket.data.playerId;
    if (!id || game.phase !== 'mg_play') return;
    io.to('host').volatile.emit('input', { id, steer: Math.max(-1, Math.min(1, Number(steer) || 0)) });
  });

  socket.on('catch', (s) => {
    const id = socket.data.playerId;
    if (!id || game.phase !== 'mg_play' || game.mg.type !== 'catch') return;
    const cur = game.mg.status[id] || { balls: 3 };
    if (cur.done) return;
    cur.balls = Math.max(0, Math.min(3, Number(s.balls)));
    cur.state = String(s.state || 'aiming').slice(0, 12);
    if (s.caught) { cur.caught = true; cur.done = true; cur.t = Date.now(); }
    else if (cur.balls <= 0 && s.state === 'escaped') cur.done = true;
    game.mg.status[id] = cur;
    broadcast();
    maybeEndCatch();
  });

  socket.on('disconnect', () => {
    const p = game.players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) { p.connected = false; broadcast(); }
  });
});

server.listen(PORT, () => {
  console.log(`\n  ${content.title} running`);
  console.log(`  Host screen : http://localhost:${PORT}/host`);
  console.log(`  Players     : http://localhost:${PORT}/play`);
  console.log(`  Admin panel : http://localhost:${PORT}/admin  (password: ${process.env.ADMIN_PASSWORD ? 'from ADMIN_PASSWORD' : ADMIN_KEY})`);
  console.log(`  Questions   : ${fromFile ? store.SAVE_FILE + ' (edited in the admin panel)' : 'content.js'}`);
  console.log(`  For phones (HTTPS needed for tilt on iPhone):  cloudflared tunnel --url http://localhost:${PORT}\n`);
});

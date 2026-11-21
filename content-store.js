// Questions + settings storage for the admin panel.
// content.js holds the original questions and is never modified. Edits made in /admin are
// validated here and saved to DATA_DIR/content.json, which wins over content.js on start-up.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'content.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const TYPES = ['hero', 'photo', 'pokemon', 'animal', 'height', 'countries', 'food', 'career', 'colour'];
const MINIGAMES = ['', 'climb', 'catch', 'race'];
const FINALES = ['race', 'climb', 'none'];
const GAMES = ['climb', 'catch', 'race'];
const SOUNDS = ['', 'lion', 'elephant', 'monkey', 'toucan', 'dino', 'boing', 'whoosh', 'sparkle', 'cheer'];
const ANIMS = ['roar', 'stomp', 'fly', 'swing'];
const GAME_DEFAULTS = { raceLaps: 3, climbSeconds: 90, catchSeconds: 60 };

const clone = (o) => JSON.parse(JSON.stringify(o));
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const color = (v, d = '#888888') => (/^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : d);
const img = (v) => { const s = String(v || ''); return /^\/(assets|uploads)\/[\w\-./%]+$/.test(s) && !s.includes('..') ? s : ''; };

function cleanOption(type, o, i) {
  o = o && typeof o === 'object' ? o : {};
  const out = { label: str(o.label, 60) || `Answer ${i + 1}` };
  if (type === 'hero' || type === 'photo' || type === 'pokemon') out.img = img(o.img);
  if (type === 'hero' || type === 'colour') out.colors = [color(o.colors?.[0], '#2563eb'), color(o.colors?.[1], '#facc15')];
  if (type === 'animal') {
    out.emoji = str(o.emoji, 16) || '🐾';
    out.sound = SOUNDS.includes(o.sound) ? o.sound : '';
    out.anim = ANIMS.includes(o.anim) ? o.anim : 'roar';
    out.bg = color(o.bg, '#8ecae6');
  }
  if (type === 'food' || type === 'career') out.emoji = str(o.emoji, 16);
  if (type === 'height' || type === 'countries') out.value = num(o.value, 0, 1000, parseFloat(out.label) || 0);
  return out;
}

function cleanQuestion(q, i) {
  q = q && typeof q === 'object' ? q : {};
  const type = TYPES.includes(q.type) ? q.type : 'food';
  const max = type === 'pokemon' ? 24 : 4;
  const options = (Array.isArray(q.options) ? q.options : []).slice(0, max).map((o, k) => cleanOption(type, o, k));
  const text = str(q.text, 200);
  if (!text) throw new Error(`Question ${i + 1} has no question text`);
  if (options.length < 2) throw new Error(`Question ${i + 1} needs at least 2 answers`);
  const out = {
    id: str(q.id, 40).replace(/[^\w-]/g, '') || `q${Date.now().toString(36)}${i}`,
    enabled: q.enabled !== false,
    type,
    text,
    hint: str(q.hint, 160),
    fact: str(q.fact, 120),
    options,
    correct: int(q.correct, 0, options.length - 1, 0),
    timeLimit: int(q.timeLimit, 5, 120, 20),
    minigame: MINIGAMES.includes(q.minigame) ? q.minigame : '',
  };
  if (!out.hint) delete out.hint;
  if (!out.minigame) delete out.minigame;
  if (type === 'pokemon') {
    out.mysteryImg = img(q.mysteryImg) || options[out.correct].img;
    out.shadowDecoys = (Array.isArray(q.shadowDecoys) ? q.shadowDecoys : []).map(img).filter(Boolean).slice(0, 10);
  }
  if (type === 'countries') {
    out.reveal = (Array.isArray(q.reveal) ? q.reveal : []).slice(0, 30)
      .map((r) => [str(r?.[0], 16), str(r?.[1], 40)]).filter((r) => r[0] || r[1]);
  }
  return out;
}

// Validate a whole content object coming from the admin panel. Throws a friendly message.
function sanitize(c) {
  c = c && typeof c === 'object' ? c : {};
  const questions = (Array.isArray(c.questions) ? c.questions : []).slice(0, 40).map(cleanQuestion);
  const live = questions.filter((q) => q.enabled);
  if (!live.length && c.mode !== 'games') throw new Error('At least one question has to be switched on');
  const ids = new Set();
  for (const q of questions) { while (ids.has(q.id)) q.id += '-2'; ids.add(q.id); }
  if (live.some((q) => q.minigame === 'climb') && !questions.some((q) => q.type === 'hero')) {
    throw new Error('Hero Tower Escape uses the superhero question’s photos: keep a superhero question, or pick another mini game');
  }
  if (live.some((q) => q.minigame === 'catch' && q.type !== 'pokemon')) {
    throw new Error('Catch the Mystery only works on the Pokémon question');
  }
  const finale = FINALES.includes(c.finale) ? c.finale : 'race';
  if (finale === 'climb' && !questions.some((q) => q.type === 'hero')) throw new Error('The tower finale needs the superhero question’s photos');
  // "Mini games only" mode: skip the questions and play these games in this order
  const mode = c.mode === 'games' ? 'games' : 'quiz';
  const seen = new Set();
  const gamesOnly = (Array.isArray(c.gamesOnly) ? c.gamesOnly : [])
    .filter((g) => GAMES.includes(g?.type) && !seen.has(g.type) && seen.add(g.type))
    .map((g) => ({ type: g.type, on: g.on !== false }));
  for (const t of GAMES) if (!seen.has(t)) gamesOnly.push({ type: t, on: true });
  if (mode === 'games') {
    const on = gamesOnly.filter((g) => g.on);
    if (!on.length) throw new Error('Mini games only: switch on at least one game');
    if (on.some((g) => g.type === 'climb') && !questions.some((q) => q.type === 'hero')) throw new Error('Hero Tower Escape needs the superhero question’s photos (it can be switched off)');
  }
  const bonus = (Array.isArray(c.minigameBonus) ? c.minigameBonus : []).slice(0, 24).map((b) => int(b, 0, 5000, 0));
  return {
    title: str(c.title, 60) || "Zayn's Kahoot",
    mode,
    gamesOnly,
    heightPhoto: img(c.heightPhoto) || '/assets/zayn/batman_fist.png',
    questions,
    finale,
    minigameBonus: bonus.length ? bonus : [600, 500, 400, 320, 260, 220, 190, 170, 150, 130],
    minigameParticipation: int(c.minigameParticipation, 0, 5000, 100),
    raceMultiplier: num(c.raceMultiplier, 0.5, 5, 1.5),
    games: {
      raceLaps: int(c.games?.raceLaps, 1, 6, GAME_DEFAULTS.raceLaps),
      climbSeconds: int(c.games?.climbSeconds, 30, 240, GAME_DEFAULTS.climbSeconds),
      catchSeconds: int(c.games?.catchSeconds, 20, 180, GAME_DEFAULTS.catchSeconds),
    },
  };
}

// The original questions from content.js, in the same shape the admin panel edits.
function defaults() {
  delete require.cache[require.resolve('./content')];
  const c = clone(require('./content'));
  c.questions.forEach((q) => { q.enabled = true; });
  return sanitize(c);
}

function load() {
  try {
    if (fs.existsSync(SAVE_FILE)) return { content: sanitize(JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'))), fromFile: true };
  } catch (e) {
    console.warn(`  Could not read ${SAVE_FILE} (${e.message}); using content.js`);
  }
  return { content: defaults(), fromFile: false };
}

function save(c) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SAVE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2));
  fs.renameSync(tmp, SAVE_FILE);
}

function clearSaved() { try { fs.unlinkSync(SAVE_FILE); } catch (e) {} }

// What the running game uses: only questions that are switched on.
const live = (c) => ({ ...c, questions: c.questions.filter((q) => q.enabled) });

module.exports = { sanitize, defaults, load, save, clearSaved, live, DATA_DIR, SAVE_FILE, UPLOAD_DIR, TYPES, MINIGAMES, SOUNDS, ANIMS };

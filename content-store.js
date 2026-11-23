// Questions + settings storage for the admin panel.
// content.js holds the original questions and is never modified. Edits made in /admin are
// validated here and saved to DATA_DIR/content.json, which wins over content.js on start-up.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'content.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const TYPES = ['choice', 'text', 'hero', 'photo', 'pokemon', 'animal', 'height', 'countries', 'food', 'career', 'colour'];
const SETS_DIR = path.join(__dirname, 'question-sets');            // built-in sets (.js or .json)
const DATA_SETS_DIR = path.join(DATA_DIR, 'question-sets');         // drop-in sets on the data volume (.json)
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
  if (type === 'food' || type === 'career' || type === 'choice') out.emoji = str(o.emoji, 16);
  if (type === 'height' || type === 'countries') out.value = num(o.value, 0, 1000, parseFloat(out.label) || 0);
  return out;
}

const maxOptions = (type) => (type === 'pokemon' ? 24 : type === 'choice' ? 6 : type === 'text' ? 0 : 4);

function cleanQuestion(q, i) {
  q = q && typeof q === 'object' ? q : {};
  const type = TYPES.includes(q.type) ? q.type : 'food';
  const options = (Array.isArray(q.options) ? q.options : []).slice(0, maxOptions(type)).map((o, k) => cleanOption(type, o, k));
  const text = str(q.text, 300);
  if (!text) throw new Error(`Question ${i + 1} has no question text`);
  if (type !== 'text' && options.length < 2) throw new Error(`Question ${i + 1} needs at least 2 answers`);
  const out = {
    id: str(q.id, 40).replace(/[^\w-]/g, '') || `q${Date.now().toString(36)}${i}`,
    enabled: q.enabled !== false,
    type,
    text,
    hint: str(q.hint, 160),
    fact: str(q.fact, 160),
    options,
    correct: int(q.correct, 0, Math.max(0, options.length - 1), 0),
    timeLimit: int(q.timeLimit, 5, 180, 20),
    minigame: MINIGAMES.includes(q.minigame) ? q.minigame : '',
  };
  if (type === 'choice') {
    // one or more right answers; groups pick `pick` of them
    const raw = Array.isArray(q.correct) ? q.correct : [q.correct];
    const correct = [...new Set(raw.map((v) => Math.round(Number(v))).filter((v) => Number.isInteger(v) && v >= 0 && v < options.length))].sort((a, b) => a - b);
    out.correct = correct.length ? correct : [0];
    out.pick = int(q.pick, 1, out.correct.length, out.correct.length);
  }
  if (type === 'text') {
    // typed answers, judged by the AI model (or the host)
    out.answers = (Array.isArray(q.answers) ? q.answers : String(q.answers ?? '').split('\n'))
      .map((a) => str(a, 240)).filter(Boolean).slice(0, 20);
    if (!out.answers.length) throw new Error(`Question ${i + 1} (typed answer) needs at least one accepted answer`);
    out.needed = int(q.needed, 1, out.answers.length, 1);
    out.notes = str(q.notes, 1500);                                  // marking guide for the AI judge
    out.correct = null;
    if (!out.notes) delete out.notes;
  }
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

// Built-in question sets added alongside Zayn's birthday questions (each is added once;
// if the admin later deletes one it stays deleted).
// Every file in question-sets/ (.js or .json) and DATA_DIR/question-sets/ (.json) is a set.
function readSetFile(file) {
  try {
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    delete require.cache[require.resolve(file)];
    return clone(require(file));
  } catch (e) {
    console.warn(`  Skipping question set ${file}: ${e.message}`);
    return null;
  }
}
const BUILTIN_SETS = () => [SETS_DIR, DATA_SETS_DIR].flatMap((dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(js|json)$/.test(f) && (dir === SETS_DIR || f.endsWith('.json'))).sort()
    .map((f) => readSetFile(path.join(dir, f)))
    .filter((x) => x && typeof x === 'object' && x.id && Array.isArray(x.questions));
});

function cleanSet(set, k, ids) {
  set = set && typeof set === 'object' ? set : {};
  const id = str(set.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, '') || `set${k + 1}`;
  const questions = (Array.isArray(set.questions) ? set.questions : []).slice(0, 40).map(cleanQuestion);
  for (const q of questions) { while (ids.has(q.id)) q.id += '-2'; ids.add(q.id); }   // unique across all sets
  const out = {
    id, name: str(set.name, 40) || `Set ${k + 1}`,
    title: str(set.title, 60),                                        // shown on the screens; blank = the game title
    points: int(set.points, 1, 5000, 1000),                           // per right answer (no speed bonus)
    finale: FINALES.includes(set.finale) ? set.finale : '',            // blank = the Settings finale
    quizOnly: set.quizOnly === true,                                   // questions only: no mini games, no finale
    timer: typeof set.timer === 'boolean' ? set.timer : set.quizOnly !== true,   // countdown per question; off = open until the host moves on
    questions,
  };
  if (!out.title) delete out.title;
  return out;
}

// Validate a whole content object coming from the admin panel. Throws a friendly message.
function sanitize(c) {
  c = c && typeof c === 'object' ? c : {};
  // question sets; older saves had one `questions` list, which becomes Zayn's birthday set
  const rawSets = Array.isArray(c.sets) && c.sets.length ? c.sets
    : [{ id: 'birthday', name: "Zayn's birthday", questions: Array.isArray(c.questions) ? c.questions : [] }];
  const qids = new Set(), setIds = new Set();
  const sets = rawSets.slice(0, 12).map((x, k) => cleanSet(x, k, qids));
  for (const set of sets) { while (setIds.has(set.id)) set.id += '-2'; setIds.add(set.id); }
  const addedBuiltins = (Array.isArray(c.addedBuiltins) ? c.addedBuiltins : []).map((x) => str(x, 30));
  for (const b of BUILTIN_SETS()) {
    if (addedBuiltins.includes(b.id)) continue;
    addedBuiltins.push(b.id);
    if (!setIds.has(b.id)) { b.questions.forEach((q) => { q.enabled = true; }); sets.push(cleanSet(b, sets.length, qids)); setIds.add(b.id); }
  }
  const active = sets.find((x) => x.id === c.activeSet) || sets[0];
  const questions = active.questions;                                   // the set being played
  const allQuestions = sets.flatMap((x) => x.questions);                // pictures can come from any set
  const hasHero = allQuestions.some((q) => q.type === 'hero');
  const live = questions.filter((q) => q.enabled).map((q) => (active.quizOnly ? { ...q, minigame: '' } : q));
  const mode = c.mode === 'games' ? 'games' : 'quiz';
  if (!live.length && (mode !== 'games' || active.quizOnly)) throw new Error(`The “${active.name}” set needs at least one question switched on`);
  if (live.some((q) => q.minigame === 'climb') && !hasHero) {
    throw new Error('Hero Tower Escape uses the superhero question’s photos: keep a superhero question, or pick another mini game');
  }
  if (live.some((q) => q.minigame === 'catch' && q.type !== 'pokemon')) {
    throw new Error('Catch the Mystery only works on a Pokémon question');
  }
  const finale = FINALES.includes(c.finale) ? c.finale : 'race';
  if (finale === 'climb' && !hasHero) throw new Error('The tower finale needs the superhero question’s photos');
  // "Mini games only" mode: skip the questions and play these games in this order
  const seen = new Set();
  const gamesOnly = (Array.isArray(c.gamesOnly) ? c.gamesOnly : [])
    .filter((g) => GAMES.includes(g?.type) && !seen.has(g.type) && seen.add(g.type))
    .map((g) => ({ type: g.type, on: g.on !== false }));
  for (const t of GAMES) if (!seen.has(t)) gamesOnly.push({ type: t, on: true });
  if (mode === 'games' && !active.quizOnly) {
    const on = gamesOnly.filter((g) => g.on);
    if (!on.length) throw new Error('Mini games only: switch on at least one game');
    if (on.some((g) => g.type === 'climb') && !hasHero) throw new Error('Hero Tower Escape needs the superhero question’s photos (it can be switched off)');
  }
  // a set's own finale must work too
  const setFinale = active.quizOnly ? 'none' : active.finale || finale;
  if (setFinale === 'climb' && !hasHero) throw new Error('The tower finale needs the superhero question’s photos');
  const bonus = (Array.isArray(c.minigameBonus) ? c.minigameBonus : []).slice(0, 24).map((b) => int(b, 0, 5000, 0));
  return {
    title: str(c.title, 60) || "Zayn's Kahoot",
    mode,
    gamesOnly,
    heightPhoto: img(c.heightPhoto) || '/assets/zayn/batman_fist.png',
    sets,
    activeSet: active.id,
    addedBuiltins,
    finale,
    minigameBonus: bonus.length ? bonus : [600, 500, 400, 320, 260, 220, 190, 170, 150, 130],
    minigameParticipation: int(c.minigameParticipation, 0, 5000, 100),
    raceMultiplier: num(c.raceMultiplier, 0.5, 5, 1.5),
    showRankings: c.showRankings !== false,                           // scoreboard after each question
    games: {
      raceLaps: int(c.games?.raceLaps, 1, 6, GAME_DEFAULTS.raceLaps),
      climbSeconds: int(c.games?.climbSeconds, 30, 240, GAME_DEFAULTS.climbSeconds),
      catchSeconds: int(c.games?.catchSeconds, 20, 180, GAME_DEFAULTS.catchSeconds),
    },
  };
}

// The original questions from content.js (Zayn's birthday set) plus the built-in sets,
// in the same shape the admin panel edits.
function defaults() {
  delete require.cache[require.resolve('./content')];
  const c = clone(require('./content'));
  c.questions.forEach((q) => { q.enabled = true; });
  c.sets = [{ id: 'birthday', name: "Zayn's birthday", questions: c.questions }];
  delete c.questions;
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

// What the running game uses: the chosen set's questions that are switched on.
const activeSet = (c) => c.sets.find((x) => x.id === c.activeSet) || c.sets[0];
const live = (c) => {
  const set = activeSet(c);
  return {
    ...c, setName: set.name, title: set.title || c.title, points: set.points ?? 1000,
    finale: set.quizOnly ? 'none' : set.finale || c.finale,
    mode: set.quizOnly ? 'quiz' : c.mode,
    quizOnly: !!set.quizOnly,
    timer: set.timer !== false,
    questions: set.questions.filter((q) => q.enabled).map((q) => (set.quizOnly && q.minigame ? (({ minigame, ...rest }) => rest)(q) : q)),
  };
};
// every question in every set (the active set first): used to find the tower and catch pictures
const allQuestions = (c) => [activeSet(c), ...c.sets.filter((x) => x !== activeSet(c))].flatMap((x) => x.questions);

module.exports = { sanitize, defaults, load, save, clearSaved, live, allQuestions, activeSet, DATA_DIR, SAVE_FILE, UPLOAD_DIR, TYPES, MINIGAMES, SOUNDS, ANIMS };

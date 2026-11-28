// Natural voice for the host screen. The quiz server asks an OpenAI-compatible speech server
// (POST /v1/audio/speech) for an mp3 and hands it to the host screen. Made for Speaches on
// Olares (Kokoro voices), and also works with Kokoro-FastAPI, openedai-speech, LocalAI or OpenAI.
// When it is off or fails, the host screen falls back to the browser's own voice.
//
//   TTS_BASE_URL  e.g. http://speaches:8000/v1
//   TTS_MODEL     default speaches-ai/Kokoro-82M-v1.0-ONNX
//   TTS_VOICE     default af_heart
//   TTS_API_KEY   optional; sent as a Bearer token
// Admin → Settings can also set these; they are saved in DATA_DIR/tts.json and win over the env.
const fs = require('fs');
const path = require('path');
const { cleanUrl } = require('./judge');

const FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'tts.json');
const DEFAULT_MODEL = 'speaches-ai/Kokoro-82M-v1.0-ONNX';
const DEFAULT_VOICE = 'af_heart';
// Kokoro's English voices, offered when the server can't list its own
const KOKORO_VOICES = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'af_nova', 'af_jessica', 'am_adam', 'am_michael', 'am_puck', 'am_echo',
  'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily', 'bm_george', 'bm_lewis', 'bm_daniel', 'bm_fable'];
const ENV = { baseUrl: process.env.TTS_BASE_URL || '', model: process.env.TTS_MODEL || '', voice: process.env.TTS_VOICE || '', apiKey: process.env.TTS_API_KEY || '' };
const MAX_TEXT = 600;

let saved = {};
try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (e) {}
const clampSpeed = (s) => Math.min(1.5, Math.max(0.6, Number(s) || 1));
const cfg = () => ({
  baseUrl: cleanUrl(saved.baseUrl ?? ENV.baseUrl).replace(/\/audio\/speech$/, ''),
  model: (saved.model ?? ENV.model) || DEFAULT_MODEL,
  voice: (saved.voice ?? ENV.voice) || DEFAULT_VOICE,
  speed: clampSpeed(saved.speed ?? 1),
  apiKey: (saved.apiKey ?? ENV.apiKey) || '',
});
const enabled = () => !!cfg().baseUrl;
const info = () => {
  const c = cfg();
  return { enabled: enabled(), baseUrl: c.baseUrl, model: c.model, voice: c.voice, speed: c.speed, hasKey: !!c.apiKey, fromAdmin: saved.baseUrl != null, env: { baseUrl: ENV.baseUrl } };
};

// small memory cache: the same question is often heard in a preview run and then in the game
const cache = new Map();
const CACHE_MAX = 200;
function remember(key, buf) {
  cache.set(key, buf);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function setConfig({ baseUrl, model, voice, speed, apiKey, clear } = {}) {
  if (clear) saved = {};
  else {
    const next = { ...saved, baseUrl: cleanUrl(baseUrl), model: String(model || '').trim().slice(0, 160), voice: String(voice || '').trim().slice(0, 80), speed: clampSpeed(speed) };
    if (String(baseUrl || '').trim() && !next.baseUrl) throw new Error('That voice address does not look like a web address');
    if (apiKey !== undefined) next.apiKey = String(apiKey).trim().slice(0, 400);
    saved = next;
  }
  cache.clear();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(saved, null, 2), { mode: 0o600 });
  return info();
}

function explain(res, url) {
  const type = res.headers.get('content-type') || '';
  if ((res.status >= 300 && res.status < 400) || type.includes('text/html')) {
    return new Error('The voice address answered with a sign-in page. On Olares, use the speech app’s Internal entrance (the quiz must run on the same Olares), or set the entrance to Public');
  }
  if (res.status === 401 || res.status === 403) return new Error(`The voice server refused the request (${res.status}). Check the API key`);
  if (res.status === 404) return new Error(`Nothing at ${url} (404). The address usually ends in /v1`);
  return new Error(`The voice server answered ${res.status} ${res.statusText}`.trim());
}
async function request(pathname, body, timeout) {
  const { baseUrl, apiKey } = cfg();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(baseUrl + pathname, {
      method: body ? 'POST' : 'GET', signal: ctrl.signal, redirect: 'manual',
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) {
      let detail = '';
      try { const j = await res.clone().json(); detail = j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : '') || j?.error?.message || ''; } catch (e) {}
      const err = explain(res, baseUrl + pathname);
      if (detail && res.status !== 404) err.message += `: ${String(detail).slice(0, 200)}`;
      throw err;
    }
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`The voice server took longer than ${Math.round(timeout / 1000)}s`);
    const code = e.cause?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') throw new Error(`Cannot find the voice address ${baseUrl} (${code})`);
    if (code || e.message === 'fetch failed') throw new Error(`Cannot reach the voice server at ${baseUrl}${code ? ` (${code})` : ''}`);
    throw e;
  } finally { clearTimeout(timer); }
}

// text → mp3 Buffer (cached). Throws when off or failing.
async function speech(text, { voice } = {}) {
  if (!enabled()) throw new Error('The natural voice is off');
  const input = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  if (!input) throw new Error('Nothing to say');
  const c = cfg();
  const v = voice || c.voice;
  const key = `${c.baseUrl}|${c.model}|${v}|${c.speed}|${input}`;
  if (cache.has(key)) return cache.get(key);
  const res = await request('/audio/speech', { model: c.model, voice: v, input, response_format: 'mp3', speed: c.speed }, 30000);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('The voice server sent back no sound');
  remember(key, buf);
  return buf;
}

// voice names the server offers (Speaches: /audio/speech/voices); Kokoro's list otherwise
async function voices() {
  try {
    const res = await request('/audio/speech/voices', null, 8000);
    const j = await res.json();
    const list = (Array.isArray(j) ? j : j.data || j.voices || [])
      .map((v) => (typeof v === 'string' ? v : v.voice_id || v.name || v.id)).filter(Boolean);
    if (list.length) return { voices: [...new Set(list)].slice(0, 200), fromServer: true };
  } catch (e) {}
  return { voices: KOKORO_VOICES, fromServer: false };
}

module.exports = { enabled, info, setConfig, speech, voices, MAX_TEXT, KOKORO_VOICES };

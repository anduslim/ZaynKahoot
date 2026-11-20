// Tiny synth audio engine. Drop an mp3 into /assets/sounds/<name>.mp3 to override any sound.
const Sound = (() => {
  let ctx, master, musicGain, sfxGain;
  let muted = false;
  const overrides = {};
  const OVERRIDABLE = ['lobby', 'question', 'race', 'final', 'lion', 'elephant', 'monkey', 'toucan', 'correct', 'wrong', 'cheer'];

  function init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    // iOS: route web audio as media playback so the silent switch doesn't mute it (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    OVERRIDABLE.forEach(async (n) => {
      try {
        const r = await fetch(`/assets/sounds/${n}.mp3`);
        if (!r.ok) return;
        overrides[n] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) {}
    });
  }

  const now = () => ctx.currentTime;

  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, out = sfxGain, attack = 0.01, vib = 0 } = {}) {
    if (!ctx) return;
    const t = now() + at;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    if (vib) {
      const l = ctx.createOscillator(); const lg = ctx.createGain();
      l.frequency.value = vib; lg.gain.value = freq * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, at = 0, freq = 1000, q = 1, type = 'bandpass', slide = 1, out = sfxGain } = {}) {
    if (!ctx) return;
    const t = now() + at;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }

  function playBuffer(buf, out = sfxGain, loop = false) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.connect(out); s.start(); return s;
  }

  const SFX = {
    tick: () => tone(1200, 0.05, { type: 'square', vol: 0.08 }),
    tock: () => tone(800, 0.05, { type: 'square', vol: 0.08 }),
    pop: () => tone(500, 0.12, { type: 'sine', vol: 0.3, slide: 2.2 }),
    tap: () => tone(700, 0.06, { type: 'triangle', vol: 0.2 }),
    join: () => { tone(660, 0.1, { type: 'triangle' }); tone(990, 0.15, { type: 'triangle', at: 0.08 }); },
    whoosh: () => noise(0.35, { freq: 400, slide: 6, vol: 0.25, q: 0.8 }),
    boing: () => tone(180, 0.45, { type: 'sine', vol: 0.4, slide: 3, vib: 14 }),
    correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, at: i * 0.09 })),
    wrong: () => { tone(300, 0.25, { type: 'sawtooth', vol: 0.15 }); tone(220, 0.4, { type: 'sawtooth', vol: 0.15, at: 0.2 }); },
    beep: () => tone(660, 0.18, { type: 'square', vol: 0.15 }),
    go: () => tone(1320, 0.5, { type: 'square', vol: 0.15 }),
    cheer: () => { for (let i = 0; i < 6; i++) noise(0.8, { at: i * 0.05, freq: 1500 + Math.random() * 1500, q: 0.6, vol: 0.12 }); },
    drumroll: () => { for (let i = 0; i < 24; i++) noise(0.06, { at: i * 0.05, freq: 300, q: 1, vol: 0.1 + i * 0.008, type: 'lowpass' }); },
    shake: () => { tone(220, 0.08, { type: 'triangle', vol: 0.25 }); noise(0.08, { freq: 2000, vol: 0.1 }); },
    sparkle: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.18, { vol: 0.12, at: i * 0.06 })),
    stretch: () => tone(150, 0.6, { type: 'sawtooth', vol: 0.12, slide: 4 }),
    plane: () => noise(1.4, { freq: 300, slide: 3, q: 2, vol: 0.18 }),
    // ---- animals (synth approximations; drop real mp3s in /assets/sounds to override)
    lion: () => { tone(110, 1.2, { type: 'sawtooth', vol: 0.3, slide: 0.6, vib: 22, attack: 0.15 }); noise(1.2, { freq: 300, q: 3, vol: 0.35, slide: 0.5, type: 'bandpass' }); },
    elephant: () => { tone(420, 0.9, { type: 'sawtooth', vol: 0.22, slide: 1.8, vib: 8, attack: 0.08 }); tone(630, 0.9, { type: 'square', vol: 0.08, slide: 1.7, attack: 0.08 }); },
    monkey: () => [0, 0.22, 0.44].forEach((a, i) => tone(i === 2 ? 500 : 700, 0.2, { type: 'triangle', vol: 0.25, at: a, slide: i === 2 ? 0.6 : 1.6 })),
    toucan: () => [0, 0.18, 0.36, 0.7, 0.88].forEach((a) => { tone(900, 0.12, { type: 'square', vol: 0.12, at: a, slide: 0.55 }); noise(0.1, { at: a, freq: 1800, q: 4, vol: 0.12 }); }),
    dino: () => { tone(70, 1.6, { type: 'sawtooth', vol: 0.35, slide: 0.5, vib: 16, attack: 0.2 }); noise(1.6, { freq: 160, q: 2, vol: 0.4, slide: 0.6, type: 'lowpass' }); },
  };

  function play(name) {
    if (!ctx || muted) return;
    if (overrides[name]) return playBuffer(overrides[name]);
    SFX[name]?.();
  }

  // ---------------- music (simple original loops)
  let musicTimer = null, musicSrc = null, currentTrack = null;
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    lobby: { bpm: 118, bass: [48, 48, 55, 55, 57, 57, 53, 55], lead: [72, 76, 79, 76, 81, 79, 76, 74, 72, 74, 76, 79, 77, 76, 74, 71] },
    question: { bpm: 100, bass: [45, 45, 45, 45, 41, 41, 43, 43], lead: [69, 0, 72, 0, 76, 0, 72, 0, 65, 0, 69, 0, 67, 0, 71, 0] },
    race: { bpm: 150, bass: [40, 40, 47, 40, 43, 43, 45, 47], lead: [76, 79, 83, 79, 76, 79, 83, 86, 79, 83, 86, 83, 81, 79, 78, 76] },
    final: { bpm: 126, bass: [48, 55, 53, 55, 48, 55, 53, 43], lead: [72, 76, 79, 84, 83, 79, 76, 79, 81, 77, 74, 77, 79, 83, 86, 84] },
  };

  function music(name) {
    if (!ctx) return;
    if (currentTrack === name) return;
    stopMusic();
    currentTrack = name;
    if (!name || muted) return;
    if (overrides[name]) { musicSrc = playBuffer(overrides[name], musicGain, true); return; }
    const tr = TRACKS[name]; if (!tr) return;
    const step = 60 / tr.bpm / 2;
    let i = 0;
    let next = now() + 0.05;
    musicTimer = setInterval(() => {
      while (next < now() + 0.25) {
        const at = next - now();
        const l = tr.lead[i % tr.lead.length];
        if (l) tone(N(l), step * 0.9, { type: 'triangle', vol: 0.18, at, out: musicGain });
        if (i % 2 === 0) tone(N(tr.bass[(i / 2) % tr.bass.length]), step * 1.8, { type: 'sine', vol: 0.3, at, out: musicGain });
        if (i % 4 === 0) noise(0.05, { at, freq: 120, type: 'lowpass', vol: 0.25, out: musicGain });
        if (i % 4 === 2) noise(0.04, { at, freq: 6000, type: 'highpass', vol: 0.06, out: musicGain });
        next += step; i++;
      }
    }, 60);
  }

  function stopMusic() {
    clearInterval(musicTimer); musicTimer = null;
    try { musicSrc?.stop(); } catch (e) {}
    musicSrc = null; currentTrack = null;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.8;
  }

  function speak(text, onend) {
    try {
      if (!window.speechSynthesis || muted) { onend && setTimeout(onend, 2500); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((v) => /Samantha|Google UK English Female|Karen|Daniel/i.test(v.name)) || voices.find((v) => /^en/i.test(v.lang)) || null;
      u.rate = 0.95; u.pitch = 1.1;
      let done = false;
      const fin = () => { if (!done) { done = true; onend && onend(); } };
      u.onend = fin;
      setTimeout(fin, 1500 + text.length * 90); // safety net
      speechSynthesis.speak(u);
    } catch (e) { onend && setTimeout(onend, 2500); }
  }

  return { init, play, music, stopMusic, setMuted, isMuted: () => muted, speak };
})();

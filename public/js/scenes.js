// Little animated scenes for the big screen, one per question (the question's `scene`).
// Each scene has two moods: "ask" while groups answer (it never gives the answer away)
// and "reveal" once the answer is shown. Pure SVG + CSS (css/scenes.css), no images.
// Used by the host screen and the preview simulator: Scenes.html(name, 'ask' | 'reveal').
(function () {
  const LIST = {
    '': 'No animation',
    wreath: '🕯️ Advent wreath (count the candles)',
    'rose-candle': '🌸 Rose candle lights up',
    gaudete: '🎶 Gaudete: Rejoice!',
    'candle-words': '🙏 Hope, Peace, Joy, Love candles',
    vestment: '🟣 Priest’s vestment turns purple',
    heart: '💜 A heart getting ready',
    'two-comings': '✨ Jesus came, and will come again',
    visitation: '🤰 Mary visits Elizabeth',
    bethlehem: '⭐ The star over Bethlehem',
    manger: '🐄 The manger in the stable',
    magi: '🐪 The Wise Men follow the star',
    gifts: '🎁 Gold, frankincense and myrrh',
    stars: '🌌 Starry night',
    snow: '❄️ Snowfall',
  };
  const PURPLE = '#7C3AED', ROSE = '#F472B6', UNLIT = '#CBD5E1';

  // tiny repeatable random numbers, so a scene looks the same every time
  const rnd = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const d = (s) => `style="--d:${s}s"`;
  const emoji = (x, y, size, e, cls = '', delay = 0) => `<g transform="translate(${x},${y})"><text class="sc-emoji ${cls}" ${d(delay)} font-size="${size}">${e}</text></g>`;
  const label = (x, y, size, t, delay = 0, cls = 'sc-rise') => `<text class="sc-label ${cls}" ${d(delay)} x="${x}" y="${y}" font-size="${size}">${t}</text>`;
  const q = (x, y, size = 46) => `<g transform="translate(${x},${y})"><text class="sc-label sc-q" font-size="${size}" dominant-baseline="central">?</text></g>`;

  function stars(n = 26, seed = 7, maxY = 150) {
    const r = rnd(seed); let s = '';
    for (let i = 0; i < n; i++) s += `<circle class="sc-twinkle" ${d((r() * 2.4).toFixed(2))} cx="${(r() * 400).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="#fff"/>`;
    return s;
  }
  const sky = (seed) => `<rect x="-40" y="-40" width="480" height="320" fill="url(#scSky)"/>${stars(28, seed)}`;
  const dunes = `<path d="M-40 205 Q60 175 150 200 T330 192 T460 200 V280 H-40Z" fill="#3B2A6B"/><path d="M-40 222 Q90 200 210 222 T460 215 V280 H-40Z" fill="#2A1D52"/>`;
  const bigStar = (size = 30) => `<g class="sc-spin-slow"><path d="M0 ${-size} L${size * 0.22} ${-size * 0.22} L${size} 0 L${size * 0.22} ${size * 0.22} L0 ${size} L${-size * 0.22} ${size * 0.22} L${-size} 0 L${-size * 0.22} ${-size * 0.22}Z" fill="#FFE27A"/></g><circle r="${size * 0.9}" fill="url(#scGlow)" class="sc-glow"/>`;

  function flame(x, y, delay) {
    return `<g transform="translate(${x},${y})"><g class="sc-light" ${d(delay)}>
      <circle r="26" fill="url(#scGlow)" class="sc-glow"/>
      <path class="sc-flame" d="M0 -20 C8 -9 9 -2 0 2 C-9 -2 -8 -9 0 -20Z" fill="#FFB020"/>
      <path class="sc-flame" d="M0 -11 C4 -5 4 -1 0 1 C-4 -1 -4 -5 0 -11Z" fill="#FFF3C4"/></g></g>`;
  }
  function candle(x, base, h, color, { lit = false, delay = 0, cls = '' } = {}) {
    const top = base - h;
    return `<g><rect class="${cls}" x="${x - 10}" y="${top}" width="20" height="${h}" rx="4" fill="${color}"/>
      <rect x="${x - 9}" y="${top}" width="6" height="${h}" rx="3" fill="#fff" opacity=".22"/>
      <line x1="${x}" y1="${top}" x2="${x}" y2="${top - 7}" stroke="#2b2b2b" stroke-width="2.4" stroke-linecap="round"/>
      ${lit ? flame(x, top - 6, delay) : ''}</g>`;
  }
  function wreath(cx = 200, cy = 192, rx = 120, ry = 26) {
    const greens = ['#1F7A4D', '#2E9E62', '#176B41'];
    let s = '';
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="17" ry="7" transform="rotate(${((a * 180) / Math.PI + 90 + (i % 2 ? 25 : -25)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${greens[i % 3]}"/>`;
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      s += `<circle cx="${(cx + (rx - 4) * Math.cos(a)).toFixed(1)}" cy="${(cy + (ry + 2) * Math.sin(a)).toFixed(1)}" r="4" fill="#E11D48"/>`;
    }
    return s;
  }
  const XS = [128, 176, 224, 272];
  const COLORS = [PURPLE, PURPLE, ROSE, PURPLE];

  const S = {
    wreath(m) {
      if (m === 'ask') return `${stars(18, 3, 120)}${wreath()}${q(200, 110, 64)}`;
      return `${stars(18, 3, 120)}${wreath()}${XS.map((x, i) => `<g class="sc-rise" ${d(i * 0.7)}>${candle(x, 196, 74 - (i === 2 ? 0 : 0), COLORS[i], { lit: true, delay: i * 0.7 + 0.4 })}</g>`).join('')}
        ${XS.map((x, i) => `<g transform="translate(${x},52)"><text class="sc-label sc-pop" ${d(i * 0.7 + 0.5)} font-size="26" dominant-baseline="central">${i + 1}</text></g>`).join('')}`;
    },
    'rose-candle'(m) {
      const third = m === 'ask'
        ? candle(XS[2], 196, 74, UNLIT) + q(XS[2], 72, 38)
        : candle(XS[2], 196, 74, UNLIT, { lit: true, delay: 1.1, cls: 'sc-to-rose' })
          + emoji(XS[2] - 22, 60, 16, '💗', 'sc-floatup', 1.6) + emoji(XS[2] + 24, 66, 14, '✨', 'sc-floatup', 1.9) + emoji(XS[2], 50, 15, '💖', 'sc-floatup', 2.3)
          + label(200, 30, 22, 'Joy!', 1.4, 'sc-pop');
      return `${stars(18, 5, 110)}${wreath()}${candle(XS[0], 196, 74, PURPLE, { lit: true })}${candle(XS[1], 196, 74, PURPLE, { lit: true, delay: 0.2 })}${third}${candle(XS[3], 196, 74, m === 'ask' ? UNLIT : PURPLE)}`;
    },
    gaudete(m) {
      const notes = ['♪', '♫', '♪', '♬', '♫'].map((n, i) => `<g transform="translate(${60 + i * 70},${170 - (i % 2) * 30})"><text class="sc-label sc-note" ${d(i * 0.6)} font-size="26">${n}</text></g>`).join('');
      if (m === 'ask') return `${stars(20, 9)}${candle(200, 220, 80, ROSE, { lit: true })}${notes}${q(270, 90, 50)}`;
      const word = 'GAUDETE'.split('').map((c, i) => `<g transform="translate(${92 + i * 36},104)"><text class="sc-label sc-hop" ${d(i * 0.12)} font-size="48" fill="${i % 2 ? '#FFE27A' : '#F9A8D4'}">${c}</text></g>`).join('');
      return `${stars(20, 9)}${notes}${word}${label(200, 160, 26, '= Rejoice!', 1.1, 'sc-pop')}
        ${emoji(50, 36, 26, '🎉', 'sc-pop', 1.3)}${emoji(350, 36, 26, '🎉', 'sc-pop', 1.4)}${candle(200, 238, 40, ROSE, { lit: true, delay: 0.3 })}`;
    },
    'candle-words'(m) {
      const words = [['Hope', '🙏'], ['Peace', '🕊️'], ['Joy', '😊'], ['Love', '❤️']];
      const xs = [98, 166, 234, 302];
      const w2 = wreath(200, 192, 150, 26);
      if (m === 'ask') return `${stars(16, 11, 100)}${w2}${xs.map((x, i) => candle(x, 196, 70, COLORS[i]) + q(x, 84, 30)).join('')}`;
      return `${stars(16, 11, 100)}${w2}${xs.map((x, i) => candle(x, 196, 70, COLORS[i], { lit: true, delay: i * 0.6 })).join('')}
        ${words.map(([w, e], i) => `<g class="sc-rise" ${d(i * 0.6 + 0.3)}>${emoji(xs[i], 60, 24, e)}<text class="sc-label" x="${xs[i]}" y="34" font-size="19">${w}</text></g>`).join('')}`;
    },
    vestment(m) {
      const body = 'M200 46 C232 46 262 52 280 62 L340 196 C290 220 110 220 60 196 L120 62 C138 52 168 46 200 46Z';
      const cross = `<path d="M200 70 V212 M160 104 L200 128 L240 104" stroke="#F5C542" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" class="${m === 'ask' ? '' : 'sc-draw'}" pathLength="1"/>`;
      if (m === 'ask') return `${stars(14, 13)}<path d="${body}" class="sc-cycle"/>${cross}<ellipse cx="200" cy="54" rx="26" ry="10" fill="#1a1240"/>${q(330, 60, 44)}`;
      return `${stars(14, 13)}<ellipse cx="200" cy="130" rx="170" ry="110" fill="url(#scPurple)" class="sc-glow"/><path d="${body}" fill="${PURPLE}" class="sc-pop"/>${cross}<ellipse cx="200" cy="54" rx="26" ry="10" fill="#1a1240"/>
        ${emoji(70, 70, 22, '✨', 'sc-pop', 1.2)}${emoji(330, 90, 20, '✨', 'sc-pop', 1.5)}${label(200, 236, 20, 'Getting ready for Jesus', 1.6)}`;
    },
    heart(m) {
      const h = 'M200 206 C120 150 84 116 84 80 C84 52 106 34 132 34 C160 34 184 50 200 74 C216 50 240 34 268 34 C294 34 316 52 316 80 C316 116 280 150 200 206Z';
      if (m === 'ask') return `${stars(16, 17)}<g class="sc-beat"><path d="${h}" fill="#4C3A8A" stroke="#C4B5FD" stroke-width="5" stroke-dasharray="10 8"/></g>${q(200, 110, 60)}`;
      const rays = Array.from({ length: 12 }, (_, i) => `<polygon points="192,30 208,30 200,-30" fill="#FFE27A" transform="rotate(${i * 30} 200 112)"/>`).join('');
      return `${stars(16, 17)}<g class="sc-rays" ${d(1.2)}>${rays}</g><g class="sc-beat"><path d="${h}" fill="${PURPLE}" class="sc-pop"/></g>
        ${emoji(200, 112, 40, '🕊️', 'sc-descend', 1.6)}
        ${emoji(64, 70, 26, '🙏', 'sc-pop', 0.6)}${emoji(336, 70, 26, '🤝', 'sc-pop', 0.9)}${emoji(60, 170, 24, '💜', 'sc-pop', 1.1)}${emoji(340, 170, 24, '🎁', 'sc-pop', 1.3)}
        ${label(200, 236, 20, 'Say sorry · forgive · do good', 2)}`;
    },
    'two-comings'(m) {
      if (m === 'ask') return `${stars(24, 19)}${emoji(200, 118, 70, '⏳', 'sc-flip')}${q(90, 110, 54)}${q(310, 110, 54)}`;
      return `${stars(24, 19)}
        <path d="M120 120 C170 70 230 70 280 120" stroke="#FFE27A" stroke-width="4" stroke-dasharray="1 12" stroke-linecap="round" fill="none" class="sc-dash"/>
        <g class="sc-rise">${emoji(90, 50, 26, '⭐', 'sc-twinkle')}${emoji(90, 118, 64, '👶')}${label(90, 186, 18, 'He came', 0.3)}${label(90, 208, 13, 'at Christmas', 0.5)}</g>
        <g class="sc-rise" ${d(1.1)}><circle cx="310" cy="112" r="50" fill="url(#scGlow)" class="sc-glow"/>${emoji(310, 108, 56, '👑', 'sc-float')}${emoji(274, 142, 34, '☁️')}${emoji(346, 142, 34, '☁️')}
          ${label(310, 186, 18, 'He will come again', 1.4)}${label(310, 208, 13, 'at the end of time', 1.6)}</g>
        ${label(200, 66, 14, 'We wait with joy', 2.2)}`;
    },
    visitation(m) {
      const hills = `<path d="M-40 200 Q80 150 200 190 T460 180 V280 H-40Z" fill="#2E7D4F"/><path d="M-40 222 Q120 196 260 222 T460 214 V280 H-40Z" fill="#256B42"/>`;
      const bg = `<rect x="-40" y="-40" width="480" height="320" fill="url(#scDay)"/>${emoji(60, 40, 30, '☀️', 'sc-spin-slow')}${hills}`;
      if (m === 'ask') return `${bg}${emoji(330, 170, 70, '🏠')}${emoji(372, 196, 34, '👵')}<g class="sc-walkin">${emoji(0, 0, 44, '🤰', 'sc-bob')}</g>`;
      return `${bg}${emoji(340, 166, 60, '🏠')}${emoji(176, 190, 50, '🤰', 'sc-lean-r')}${emoji(226, 190, 50, '👵', 'sc-lean-l')}
        ${emoji(201, 150, 28, '❤️', 'sc-pop', 0.4)}<g transform="translate(226,140)"><text class="sc-emoji sc-leap" ${d(0.8)} font-size="30">👶</text></g>
        ${emoji(256, 104, 18, '✨', 'sc-pop', 1.0)}${emoji(196, 98, 16, '✨', 'sc-pop', 1.2)}${label(200, 40, 24, 'Baby John leapt for joy!', 1.2, 'sc-pop')}`;
    },
    bethlehem(m) {
      const town = (x, s, lit) => `<g transform="translate(${x},200) scale(${s})">
        <rect x="-34" y="-36" width="30" height="36" fill="#1C1440"/><path d="M-38 -36 L-19 -54 L0 -36Z" fill="#1C1440"/>
        <rect x="0" y="-52" width="34" height="52" fill="#221A4D"/><circle cx="17" cy="-52" r="16" fill="#221A4D"/>
        <rect x="-26" y="-26" width="7" height="9" fill="${lit ? '#FFD966' : '#4B3F7A'}" class="${lit ? 'sc-twinkle' : ''}"/><rect x="12" y="-36" width="8" height="10" fill="${lit ? '#FFD966' : '#4B3F7A'}"/></g>`;
      if (m === 'ask') return `${sky(21)}${dunes}${town(80, 0.8, false)}${town(200, 0.8, false)}${town(320, 0.8, false)}<g transform="translate(200,52)"><g class="sc-wander">${bigStar(18)}</g></g>`;
      return `${sky(21)}${dunes}<polygon points="290,62 350,62 400,200 240,200" fill="url(#scBeam)" class="sc-fadein" ${d(1.8)}/>
        ${town(80, 0.7, false)}${town(320, 1.15, true)}<g transform="translate(320,58)"><g class="sc-glide">${bigStar(24)}</g></g>${label(160, 120, 30, 'Bethlehem', 2, 'sc-pop')}${label(160, 146, 14, 'the city of King David', 2.3)}`;
    },
    manger(m) {
      const stable = `<path d="M60 92 L200 30 L340 92" stroke="#8B5A2B" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="76" y="92" width="10" height="120" fill="#8B5A2B"/><rect x="314" y="92" width="10" height="120" fill="#8B5A2B"/><path d="M-40 212 H440 V280 H-40Z" fill="#5B3A1E"/>`;
      const trough = `<path d="M150 170 L250 170 L238 200 L162 200Z" fill="#A0703F" stroke="#6B4423" stroke-width="3"/><path d="M164 200 L150 214 M236 200 L250 214" stroke="#6B4423" stroke-width="5" stroke-linecap="round"/>`;
      const hay = Array.from({ length: 9 }, (_, i) => `<path d="M${158 + i * 10} 172 l${i % 2 ? 6 : -6} -14" stroke="#F2C94C" stroke-width="3" stroke-linecap="round"/>`).join('');
      if (m === 'ask') return `${stars(14, 23, 70)}${stable}${trough}${q(200, 132, 46)}${emoji(110, 186, 40, '🐑', 'sc-float')}${emoji(290, 178, 52, '🐄', 'sc-float', 0.7)}${emoji(340, 186, 36, '🐴', 'sc-float', 1.2)}`;
      return `${stars(14, 23, 70)}<g transform="translate(200,26)">${bigStar(14)}</g>${stable}<g class="sc-rise" ${d(0.2)}>${hay}</g>${trough}
        <g transform="translate(262,160)"><g class="sc-munch" ${d(0.6)}><text class="sc-emoji" font-size="52">🐄</text></g></g>${emoji(110, 186, 40, '🐑', 'sc-float')}
        <g class="sc-fadein" ${d(2)}><circle cx="200" cy="160" r="40" fill="url(#scGlow)" class="sc-glow"/><ellipse cx="200" cy="140" rx="15" ry="5" fill="none" stroke="#FFE27A" stroke-width="3"/>${emoji(200, 162, 30, '👶')}</g>
        ${label(200, 236, 18, 'A feeding box for the animals', 0.8)}`;
    },
    magi(m) {
      if (m === 'ask') return `${sky(25)}${dunes}<g transform="translate(90,54)">${bigStar(20)}</g>${[260, 310, 360].map((x, i) => `<g transform="translate(${x},180)"><text class="sc-label sc-q" ${d(i * 0.3)} font-size="40">?</text></g>`).join('')}`;
      return `${sky(25)}${dunes}<g transform="translate(70,50)">${bigStar(22)}</g>
        ${[0, 1, 2].map((i) => `<g transform="translate(${150 + i * 74},186)"><g class="sc-walkin-r" ${d(i * 0.35)}><g class="sc-bob" ${d(i * 0.2)}><text class="sc-emoji" font-size="54">🐪</text><text class="sc-emoji" y="-34" x="6" font-size="22">👑</text></g></g></g>`).join('')}
        ${label(250, 60, 26, 'The Wise Men', 1.8, 'sc-pop')}${label(250, 84, 14, 'followed the star', 2.1)}`;
    },
    gifts(m) {
      if (m === 'ask') return `${stars(18, 27)}${[110, 200, 290].map((x, i) => emoji(x, 140, 70, '🎁', 'sc-shake', i * 0.4)).join('')}${q(200, 50, 44)}`;
      const gold = `<g class="sc-rise"><g transform="translate(84,150)"><path d="M-36 20 L-26 0 H26 L36 20Z" fill="#E0A800"/><path d="M-22 0 L-14 -16 H14 L22 0Z" fill="#F5C542"/><rect class="sc-shine" x="-40" y="-18" width="10" height="40" fill="#fff" opacity=".7"/></g>${label(84, 206, 18, 'Gold', 0.2)}${label(84, 224, 11, 'for a King', 0.4)}</g>`;
      const smoke = [0, 1, 2].map((i) => `<path class="sc-smoke" ${d(i * 0.8)} d="M${194 + i * 6} 128 C${180 + i * 8} 110 ${214 + i * 4} 96 ${198 + i * 6} 76" stroke="#E9E4FF" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`).join('');
      const incense = `<g class="sc-rise" ${d(0.6)}>${smoke}<path d="M172 136 H228 C226 158 214 168 200 168 C186 168 174 158 172 136Z" fill="#B7791F"/><rect x="190" y="168" width="20" height="8" fill="#8B5A2B"/>${label(200, 206, 18, 'Frankincense', 0.8)}${label(200, 224, 11, 'for God', 1)}</g>`;
      const myrrh = `<g class="sc-rise" ${d(1.2)}>${emoji(316, 146, 54, '🏺')}<circle class="sc-drip" ${d(1.8)} cx="330" cy="120" r="4" fill="#C08457"/>${label(316, 206, 18, 'Myrrh', 1.4)}${label(316, 224, 11, 'for His burial', 1.6)}</g>`;
      return `${stars(18, 27)}${gold}${incense}${myrrh}${emoji(60, 50, 22, '✨', 'sc-pop', 1.8)}${emoji(340, 50, 22, '✨', 'sc-pop', 2)}`;
    },
    stars(m) {
      return `${sky(29)}${stars(30, 31, 230)}<g transform="translate(320,40)"><g class="sc-shoot"><path d="M0 0 L-60 24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/><circle r="4" fill="#fff"/></g></g>${m === 'reveal' ? `<g transform="translate(200,110)">${bigStar(36)}</g>` : q(200, 110, 60)}`;
    },
    snow(m) {
      const r = rnd(33); let s = '';
      for (let i = 0; i < 36; i++) s += `<g transform="translate(${(r() * 400).toFixed(0)},-10)"><circle class="sc-fall" style="--d:${(-r() * 6).toFixed(2)}s;--t:${(4 + r() * 4).toFixed(1)}s" r="${(1.5 + r() * 2.5).toFixed(1)}" fill="#fff" opacity=".85"/></g>`;
      return `${s}${m === 'reveal' ? emoji(200, 130, 80, '⛄', 'sc-pop') : q(200, 120, 60)}`;
    },
  };

  const DEFS = `<defs>
    <radialGradient id="scGlow"><stop offset="0" stop-color="#FFE9A0" stop-opacity=".95"/><stop offset=".45" stop-color="#FFC93C" stop-opacity=".35"/><stop offset="1" stop-color="#FFC93C" stop-opacity="0"/></radialGradient>
    <radialGradient id="scPurple"><stop offset="0" stop-color="#A78BFA" stop-opacity=".6"/><stop offset="1" stop-color="#7C3AED" stop-opacity="0"/></radialGradient>
    <linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E0A2E"/><stop offset="1" stop-color="#2B1D63"/></linearGradient>
    <linearGradient id="scDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#E0F2FE"/></linearGradient>
    <linearGradient id="scBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A0" stop-opacity=".7"/><stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></linearGradient>
  </defs>`;

  function html(name, mood) {
    const fn = S[name];
    if (!fn) return '';
    const m = mood === 'reveal' ? 'reveal' : 'ask';
    return `<div class="scene" data-k="${name}-${m}"><svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${DEFS}${fn(m)}</svg></div>`;
  }

  window.Scenes = { html, LIST, has: (n) => !!S[n] };
})();

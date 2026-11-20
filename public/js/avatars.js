// Original cartoon animal avatars: 12 animals × 12 accessories × 8 colours.
// avatarHTML(avatar, size) draws one; AVATAR lists the choices for the picker.
// Avatars are { animal, acc, color }. Older/unknown values fall back to a bear.
(function () {
  const INK = '#2b2140';
  const S = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;

  // shared features
  const eye = (x, y, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x + 1}" cy="${y + 1}" r="${r * 0.52}" fill="${INK}"/><circle cx="${x - r * 0.15}" cy="${y - r * 0.25}" r="${r * 0.18}" fill="#fff"/>`;
  const eyes = (a) => `<g class="av-eyes">${eye(a[0], a[2], a[3])}${eye(a[1], a[2], a[3])}</g>`;
  const cheeks = (y = 68, dx = 19) => `<ellipse cx="${50 - dx}" cy="${y}" rx="5" ry="3.2" fill="#FF7FA5" opacity=".55"/><ellipse cx="${50 + dx}" cy="${y}" rx="5" ry="3.2" fill="#FF7FA5" opacity=".55"/>`;
  const smile = (y = 74, w = 5) => `<path d="M${50 - w} ${y} Q50 ${y + 5} ${50 + w} ${y}" fill="none" ${S} stroke-linecap="round"/>`;
  const head = (fill, r = 28, cy = 60) => `<circle cx="50" cy="${cy}" r="${r}" fill="${fill}" ${S}/>`;

  // each animal: draw() and where its eyes sit [leftX, rightX, y, r] (accessories use it)
  const ANIMALS = {
    bear: {
      label: 'Bear', eyes: [40, 60, 56, 6.5],
      draw: (e) => `<circle cx="27" cy="37" r="10" fill="#B7773F" ${S}/><circle cx="73" cy="37" r="10" fill="#B7773F" ${S}/>
        <circle cx="27" cy="37" r="5" fill="#F1C28F"/><circle cx="73" cy="37" r="5" fill="#F1C28F"/>
        ${head('#B7773F')}<ellipse cx="50" cy="71" rx="13" ry="10" fill="#F3D5A8" ${S}/>
        <ellipse cx="50" cy="66.5" rx="5" ry="3.6" fill="${INK}"/>${smile(73, 4)}${eyes(e)}${cheeks(66, 21)}`,
    },
    fox: {
      label: 'Fox', eyes: [39, 61, 55, 6.5],
      draw: (e) => `<path d="M25 47 L28 17 L47 35 Z" fill="#F07B2C" ${S}/><path d="M75 47 L72 17 L53 35 Z" fill="#F07B2C" ${S}/>
        <path d="M28 23 L29 17 L35 22 Z" fill="${INK}"/><path d="M72 23 L71 17 L65 22 Z" fill="${INK}"/>
        ${head('#F07B2C')}<path d="M23 62 Q37 60 50 75 Q63 60 77 62 Q72 87 50 88 Q28 87 23 62 Z" fill="#fff" ${S}/>
        <ellipse cx="50" cy="73" rx="4.5" ry="3.2" fill="${INK}"/>${eyes(e)}${cheeks(67, 22)}`,
    },
    cat: {
      label: 'Cat', eyes: [39, 61, 56, 6.8],
      draw: (e) => `<path d="M24 50 L27 20 L46 36 Z" fill="#9AA5B1" ${S}/><path d="M76 50 L73 20 L54 36 Z" fill="#9AA5B1" ${S}/>
        <path d="M29 42 L30 28 L40 36 Z" fill="#FFB3C7"/><path d="M71 42 L70 28 L60 36 Z" fill="#FFB3C7"/>
        ${head('#9AA5B1')}<path d="M44 34 L45 42 M50 33 L50 42 M56 34 L55 42" stroke="#6B7580" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="45" cy="70" rx="6" ry="5" fill="#fff"/><ellipse cx="55" cy="70" rx="6" ry="5" fill="#fff"/>
        <path d="M47 65 L53 65 L50 69 Z" fill="#FF7FA5" ${S} stroke-width="1.6"/>
        <path d="M30 68 L40 69 M30 73 L40 71 M70 68 L60 69 M70 73 L60 71" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>${eyes(e)}`,
    },
    panda: {
      label: 'Panda', eyes: [40, 60, 57, 5.8],
      draw: (e) => `<circle cx="27" cy="36" r="10" fill="${INK}"/><circle cx="73" cy="36" r="10" fill="${INK}"/>
        ${head('#F7F7F7')}<ellipse cx="39" cy="57" rx="9" ry="11" transform="rotate(30 39 57)" fill="${INK}"/><ellipse cx="61" cy="57" rx="9" ry="11" transform="rotate(-30 61 57)" fill="${INK}"/>
        <ellipse cx="50" cy="68" rx="5" ry="3.5" fill="${INK}"/>${smile(73, 4)}${eyes(e)}${cheeks(70, 20)}`,
    },
    penguin: {
      label: 'Penguin', eyes: [41, 59, 58, 6.2],
      draw: (e) => `${head('#2F3B5C', 29)}<path d="M50 47 C40 35 22 41 24 60 C26 79 40 86 50 86 C60 86 74 79 76 60 C78 41 60 35 50 47 Z" fill="#fff" ${S}/>
        <path d="M41 67 Q50 62 59 67 L50 77 Z" fill="#FFA62B" ${S}/>${eyes(e)}${cheeks(71, 19)}`,
    },
    frog: {
      label: 'Frog', eyes: [34, 66, 40, 7.5],
      draw: (e) => `<circle cx="34" cy="41" r="12" fill="#5DBB63" ${S}/><circle cx="66" cy="41" r="12" fill="#5DBB63" ${S}/>
        <ellipse cx="50" cy="64" rx="33" ry="24" fill="#5DBB63" ${S}/><circle cx="34" cy="41" r="10" fill="#5DBB63"/><circle cx="66" cy="41" r="10" fill="#5DBB63"/>
        <path d="M30 68 Q50 84 70 68" fill="none" ${S} stroke-linecap="round"/><circle cx="45" cy="58" r="1.4" fill="${INK}"/><circle cx="55" cy="58" r="1.4" fill="${INK}"/>${eyes(e)}${cheeks(68, 26)}`,
    },
    owl: {
      label: 'Owl', eyes: [39, 61, 57, 7.5],
      draw: (e) => `<path d="M26 44 L24 22 L40 34 Z" fill="#8C6239" ${S}/><path d="M74 44 L76 22 L60 34 Z" fill="#8C6239" ${S}/>
        ${head('#8C6239')}<circle cx="39" cy="57" r="12.5" fill="#E8C597" ${S}/><circle cx="61" cy="57" r="12.5" fill="#E8C597" ${S}/>
        <path d="M45 66 L55 66 L50 75 Z" fill="#FFA62B" ${S}/><path d="M40 80 Q45 77 50 80 Q55 77 60 80" fill="none" stroke="#6B4728" stroke-width="2"/>${eyes(e)}`,
    },
    bunny: {
      label: 'Bunny', eyes: [40, 60, 57, 6.3],
      draw: (e) => `<ellipse cx="38" cy="22" rx="8" ry="20" fill="#F4EEF3" ${S}/><ellipse cx="62" cy="22" rx="8" ry="20" fill="#F4EEF3" ${S}/>
        <ellipse cx="38" cy="23" rx="4" ry="14" fill="#FFB3C7"/><ellipse cx="62" cy="23" rx="4" ry="14" fill="#FFB3C7"/>
        ${head('#F4EEF3')}<ellipse cx="45" cy="70" rx="6" ry="5" fill="#fff" ${S} stroke-width="1.4"/><ellipse cx="55" cy="70" rx="6" ry="5" fill="#fff" ${S} stroke-width="1.4"/>
        <ellipse cx="50" cy="66" rx="3.6" ry="2.6" fill="#FF7FA5"/><rect x="46.5" y="74" width="7" height="6" rx="1" fill="#fff" ${S} stroke-width="1.6"/><path d="M50 74 L50 80" stroke="${INK}" stroke-width="1.2"/>${eyes(e)}${cheeks(67, 21)}`,
    },
    dog: {
      label: 'Puppy', eyes: [40, 60, 56, 6.5],
      draw: (e) => `${head('#D9A066')}<ellipse cx="25" cy="58" rx="9" ry="18" transform="rotate(18 25 58)" fill="#8A5A2B" ${S}/><ellipse cx="75" cy="58" rx="9" ry="18" transform="rotate(-18 75 58)" fill="#8A5A2B" ${S}/>
        <ellipse cx="61" cy="55" rx="10" ry="9" fill="#B07A43"/><ellipse cx="50" cy="71" rx="14" ry="10" fill="#F3D9B5" ${S}/>
        <ellipse cx="50" cy="66" rx="6" ry="4.2" fill="${INK}"/><path d="M50 70 L50 74 M44 74 Q50 79 56 74" fill="none" ${S} stroke-width="1.8"/><path d="M48 76 Q50 84 53 76 Z" fill="#FF7FA5" ${S} stroke-width="1.4"/>${eyes(e)}`,
    },
    monkey: {
      label: 'Monkey', eyes: [41, 59, 56, 6.2],
      draw: (e) => `<circle cx="21" cy="60" r="9" fill="#8B5A3C" ${S}/><circle cx="79" cy="60" r="9" fill="#8B5A3C" ${S}/>
        <circle cx="21" cy="60" r="4.5" fill="#F2C9A0"/><circle cx="79" cy="60" r="4.5" fill="#F2C9A0"/>${head('#8B5A3C')}
        <path d="M50 51 C44 42 28 44 30 57 C31 63 34 66 37 68 C33 76 40 85 50 85 C60 85 67 76 63 68 C66 66 69 63 70 57 C72 44 56 42 50 51 Z" fill="#F2C9A0" ${S}/>
        <circle cx="47" cy="69" r="1.5" fill="${INK}"/><circle cx="53" cy="69" r="1.5" fill="${INK}"/>${smile(75, 6)}${eyes(e)}`,
    },
    dino: {
      label: 'Dino', eyes: [40, 60, 55, 6.8],
      draw: (e) => `<path d="M34 37 L38 24 L44 34 L50 20 L56 34 L62 24 L66 37 Z" fill="#FF9F43" ${S}/>
        <path d="M22 60 C22 38 36 32 50 32 C64 32 78 38 78 60 C78 80 66 88 50 88 C34 88 22 80 22 60 Z" fill="#4FB286" ${S}/>
        <ellipse cx="50" cy="75" rx="18" ry="10" fill="#8ED6B0"/><circle cx="45" cy="71" r="1.5" fill="${INK}"/><circle cx="55" cy="71" r="1.5" fill="${INK}"/>
        <path d="M40 78 Q50 84 60 78" fill="none" ${S} stroke-linecap="round"/><path d="M44 79 L46 82 L48 80 M52 80 L54 82 L56 79" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${eyes(e)}${cheeks(66, 22)}`,
    },
    unicorn: {
      label: 'Unicorn', eyes: [40, 60, 58, 6.3],
      draw: (e) => `<path d="M30 42 L30 26 L42 35 Z" fill="#F6F0FF" ${S}/><path d="M70 42 L70 26 L58 35 Z" fill="#F6F0FF" ${S}/>
        <path d="M24 44 C14 52 16 70 24 78 C22 66 26 56 32 50 Z" fill="#FF7FA5" ${S}/><path d="M28 38 C18 42 16 54 20 62 C22 52 28 46 36 43 Z" fill="#7CC8FF" ${S}/>
        ${head('#F6F0FF')}<path d="M44 36 L50 6 L56 36 Z" fill="#FFD25A" ${S}/><path d="M46 28 L54 26 M47 20 L53 18" stroke="#E0A800" stroke-width="2"/>
        <path d="M34 38 C40 30 52 30 58 36 C50 36 42 40 38 46 Z" fill="#B48CFF" ${S}/>
        <ellipse cx="50" cy="73" rx="12" ry="8" fill="#FFE1EE"/><circle cx="46" cy="72" r="1.4" fill="${INK}"/><circle cx="54" cy="72" r="1.4" fill="${INK}"/>${smile(77, 4)}${eyes(e)}${cheeks(68, 21)}`,
    },
  };

  // accessories, drawn over the head; `e` is the animal's eye spot [lx, rx, y, r]
  const ACCS = {
    none: { label: 'None', draw: () => '' },
    party: {
      label: 'Party hat',
      draw: () => `<g transform="rotate(14 52 30)"><path d="M39 33 L52 3 L64 33 Z" fill="#FF5DA2" ${S}/><path d="M43 24 L60 24 M47 14 L57 14" stroke="#FFE066" stroke-width="3.2"/><circle cx="52" cy="3" r="4.5" fill="#FFE066" ${S}/></g>`,
    },
    crown: {
      label: 'Crown',
      draw: () => `<path d="M33 35 L35 15 L43 25 L50 10 L57 25 L65 15 L67 35 Z" fill="#FFC93C" ${S}/><circle cx="50" cy="28" r="3" fill="#E5383B"/><circle cx="40" cy="30" r="2.2" fill="#3A86FF"/><circle cx="60" cy="30" r="2.2" fill="#2BA84A"/>`,
    },
    headphones: {
      label: 'Headphones',
      draw: () => `<path d="M21 60 Q20 24 50 24 Q80 24 79 60" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M21 60 Q20 24 50 24 Q80 24 79 60" fill="none" stroke="#E5383B" stroke-width="4.5" stroke-linecap="round"/>
        <rect x="12" y="50" width="13" height="22" rx="6" fill="#E5383B" ${S}/><rect x="75" y="50" width="13" height="22" rx="6" fill="#E5383B" ${S}/>`,
    },
    sunglasses: {
      label: 'Shades',
      draw: (e) => { const r = e[3] + 3.5; return `<rect x="${e[0] - r}" y="${e[2] - r * 0.75}" width="${r * 2}" height="${r * 1.5}" rx="${r * 0.55}" fill="${INK}"/><rect x="${e[1] - r}" y="${e[2] - r * 0.75}" width="${r * 2}" height="${r * 1.5}" rx="${r * 0.55}" fill="${INK}"/>
        <path d="M${e[0] + r} ${e[2] - 1} L${e[1] - r} ${e[2] - 1}" stroke="${INK}" stroke-width="3"/><path d="M${e[0] - r * 0.5} ${e[2] - r * 0.35} L${e[0]} ${e[2] - r * 0.35}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`; },
    },
    glasses: {
      label: 'Glasses',
      draw: (e) => { const r = e[3] + 3.2; return `<circle cx="${e[0]}" cy="${e[2]}" r="${r}" fill="rgba(255,255,255,.15)" stroke="#7C3AED" stroke-width="3"/><circle cx="${e[1]}" cy="${e[2]}" r="${r}" fill="rgba(255,255,255,.15)" stroke="#7C3AED" stroke-width="3"/><path d="M${e[0] + r} ${e[2]} Q50 ${e[2] - 4} ${e[1] - r} ${e[2]}" fill="none" stroke="#7C3AED" stroke-width="3"/>`; },
    },
    bow: {
      label: 'Bow',
      draw: () => `<g transform="rotate(-12 68 32)"><path d="M68 32 L54 22 L56 42 Z" fill="#FF5DA2" ${S}/><path d="M68 32 L82 22 L80 42 Z" fill="#FF5DA2" ${S}/><circle cx="68" cy="32" r="4.5" fill="#FF9CC7" ${S}/></g>`,
    },
    cap: {
      label: 'Cap',
      draw: () => `<path d="M25 42 Q27 18 50 18 Q73 18 75 42 Z" fill="#3A86FF" ${S}/><path d="M60 42 L92 44 Q90 51 70 49 L60 47 Z" fill="#2563EB" ${S}/><circle cx="50" cy="18" r="3" fill="#FFE066" ${S} stroke-width="1.6"/><path d="M38 30 L44 26 L50 30 L56 26 L62 30" fill="none" stroke="#FFE066" stroke-width="2.4"/>`,
    },
    wizard: {
      label: 'Wizard',
      draw: () => `<path d="M33 35 L54 0 L68 35 Z" fill="#6D28D9" ${S}/><ellipse cx="50" cy="35" rx="24" ry="5.5" fill="#5B21B6" ${S}/>
        <path d="M52 16 L53.6 19.6 L57.5 20 L54.6 22.6 L55.4 26.5 L52 24.5 L48.6 26.5 L49.4 22.6 L46.5 20 L50.4 19.6 Z" fill="#FFE066"/><circle cx="60" cy="28" r="1.6" fill="#FFE066"/><circle cx="43" cy="29" r="1.3" fill="#FFE066"/>`,
    },
    flowers: {
      label: 'Flowers',
      draw: () => [[29, 39, '#FF5DA2'], [39, 32, '#FFE066'], [50, 29, '#7CC8FF'], [61, 32, '#FF9F43'], [71, 39, '#B48CFF']].map(([x, y, c]) =>
        `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-4" rx="3" ry="4.2" transform="rotate(${a})" fill="${c}" stroke="${INK}" stroke-width="1.2"/>`).join('')}<circle r="2.4" fill="#FFF4B0" stroke="${INK}" stroke-width="1.2"/></g>`).join(''),
    },
    cake: {
      label: 'Cake hat',
      draw: () => `<rect x="37" y="20" width="26" height="14" rx="3" fill="#F9C6DA" ${S}/><path d="M37 24 Q41 29 45 24 Q49 29 53 24 Q57 29 63 24 L63 22 Q63 20 61 20 L39 20 Q37 20 37 22 Z" fill="#fff" ${S} stroke-width="1.6"/>
        <rect x="48" y="8" width="4" height="12" rx="1" fill="#3A86FF" ${S} stroke-width="1.4"/><path d="M50 1 Q54 5 50 8 Q46 5 50 1 Z" fill="#FFB703" class="av-flame"/>`,
    },
    pirate: {
      label: 'Pirate',
      draw: (e) => `<path d="M24 40 Q50 18 76 40 L76 44 Q50 32 24 44 Z" fill="#E5383B" ${S}/><circle cx="34" cy="38" r="2" fill="#fff"/><circle cx="62" cy="34" r="2" fill="#fff"/>
        <path d="M76 42 L86 50 L80 52 Z" fill="#E5383B" ${S}/><ellipse cx="${e[1]}" cy="${e[2]}" rx="${e[3] + 2.5}" ry="${e[3] + 1.8}" fill="${INK}"/><path d="M${e[1] - e[3] - 2} ${e[2] - 2} L28 ${e[2] - 14}" stroke="${INK}" stroke-width="2"/>`,
    },
  };
  const COLORS = ['#E5383B', '#F97316', '#D49B00', '#2BA84A', '#06B6D4', '#3A86FF', '#8B5CF6', '#EC4899'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function clean(av) {
    av = av || {};
    return {
      animal: ANIMALS[av.animal] ? av.animal : 'bear',
      acc: ACCS[av.acc] ? av.acc : 'none',
      color: /^#[0-9a-fA-F]{6}$/.test(av.color || '') ? av.color : COLORS[0],
    };
  }

  window.AVATAR = {
    animals: Object.keys(ANIMALS), accs: Object.keys(ACCS), colors: COLORS,
    label: (kind, k) => (kind === 'animal' ? ANIMALS : ACCS)[k]?.label || k,
    random: () => ({ animal: pick(Object.keys(ANIMALS)), acc: pick(Object.keys(ACCS)), color: pick(COLORS) }),
    clean,
  };

  // a few seconds of variety so a room full of avatars doesn't blink in sync
  let seq = 0;
  window.avatarHTML = function (av, size = 64) {
    const a = clean(av);
    const A = ANIMALS[a.animal];
    const delay = ((seq++ * 1.37) % 5).toFixed(2);
    return `<div class="avatar" style="width:${size}px;height:${size}px;background:${a.color};border-width:${Math.max(2, size / 18)}px;--blink-delay:-${delay}s">
      <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible" aria-label="${A.label}">${A.draw(A.eyes)}${ACCS[a.acc].draw(A.eyes)}</svg></div>`;
  };
})();

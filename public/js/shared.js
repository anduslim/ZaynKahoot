// Shared helpers for host + phone
const OPT_COLORS = ['var(--o0)', 'var(--o1)', 'var(--o2)', 'var(--o3)'];
const OPT_SHAPES = [
  '<svg viewBox="0 0 34 34"><path d="M17 3 L31 30 L3 30 Z" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><path d="M17 2 L32 17 L17 32 L2 17 Z" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><rect x="4" y="4" width="26" height="26" rx="3" fill="#fff"/></svg>',
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// avatarHTML() lives in avatars.js

function confetti(colors = ['#E5383B', '#2BA84A', '#FFC93C', '#3A86FF', '#EC4899'], n = 120) {
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 2.2 + Math.random() * 2.5 + 's';
    c.style.animationDelay = Math.random() * 1.2 + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 6000);
}

// image with graceful fallback tile
function imgOrTile(src, label, cls = '', fallbackText) {
  const t = fallbackText ?? esc(label).replace(/'/g, '');
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(label)}" onerror="this.outerHTML='<div class=&quot;${cls} tile-fallback&quot;>${t}</div>'">`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Corrupted "shadow" mystery Pokémon: black silhouette of the image, purple glow and
// swirling purple smoke. Add the class "purified" to the returned element to clear it.
function shadowMonHTML(src, { style = '', puffs = 14 } = {}) {
  const r = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
  const puff = (front) => `<span style="--l:${r(-5, 85)}%;--b:${r(-6, front ? 18 : 45)}%;--s:${r(front ? 22 : 28, front ? 38 : 52)}%;--x:${r(-35, 35)}%;--d:${r(2.6, 4.6)}s;--dl:-${r(0, 4.6)}s;--o:${front ? r(0.35, 0.6) : r(0.55, 0.9)}"></span>`;
  const ember = () => `<i style="--l:${r(10, 90)}%;--d:${r(1.8, 3.4)}s;--dl:-${r(0, 3.4)}s;--x:${r(-30, 30)}px"></i>`;
  const n = (k, f) => Array.from({ length: k }, f).join('');
  const url = esc(`url("${src}")`);
  return `<div class="shadowmon" style="${style}">
    <div class="sm-aura"></div>
    <div class="sm-smoke back">${n(puffs, () => puff(false))}</div>
    <img class="sm-img" src="${esc(src)}" alt="Mystery Pokémon" onerror="this.parentNode.classList.add('noimg')">
    <div class="sm-tint" style="-webkit-mask-image:${url};mask-image:${url}"></div>
    <div class="sm-smoke front">${n(Math.round(puffs / 2), () => puff(true))}</div>
    <div class="sm-embers">${n(10, ember)}</div>
    <div class="sm-flash"></div>
  </div>`;
}

// Cycle a shadowMonHTML element through several images in a shuffled loop, with a smoky
// swap every `every` ms. The first image is random too, so the answer is never first by
// default. Stops by itself once keepGoing() returns false or the element leaves the page.
function cycleShadowMon(el, srcs, keepGoing, every = 2600) {
  if (!el || srcs.length < 2) return;
  const img = el.querySelector('.sm-img'), tint = el.querySelector('.sm-tint');
  const alive = () => keepGoing() && el.isConnected;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const show = (src) => {
    el.classList.remove('noimg');
    img.src = src;
    const u = `url("${src}")`; tint.style.webkitMaskImage = u; tint.style.maskImage = u;
  };
  srcs.forEach((s) => { new Image().src = s; }); // preload so swaps don't flash
  let order = shuffle(srcs), i = 0;
  show(order[0]);
  const tick = () => setTimeout(() => {
    if (!alive()) return;
    el.classList.add('swapping');
    setTimeout(() => {
      if (!alive()) return;
      if (++i >= order.length) { // new shuffled round, never repeating the last shape
        const last = order[order.length - 1];
        do order = shuffle(srcs); while (order[0] === last);
        i = 0;
      }
      show(order[i]);
      el.classList.remove('swapping');
      tick();
    }, 380);
  }, every);
  tick();
}

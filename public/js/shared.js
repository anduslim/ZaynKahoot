// Shared helpers for host + phone
const OPT_COLORS = ['var(--o0)', 'var(--o1)', 'var(--o2)', 'var(--o3)'];
const OPT_SHAPES = [
  '<svg viewBox="0 0 34 34"><path d="M17 3 L31 30 L3 30 Z" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><path d="M17 2 L32 17 L17 32 L2 17 Z" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#fff"/></svg>',
  '<svg viewBox="0 0 34 34"><rect x="4" y="4" width="26" height="26" rx="3" fill="#fff"/></svg>',
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function avatarHTML(av, size = 64) {
  av = av || {};
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${esc(av.color || '#E5383B')};border-width:${Math.max(2, size / 16)}px">
    <span class="face" style="font-size:${size * 0.56}px">${esc(av.face || '😀')}</span>
    ${av.hat ? `<span class="hat" style="font-size:${size * 0.5}px">${esc(av.hat)}</span>` : ''}
  </div>`;
}

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

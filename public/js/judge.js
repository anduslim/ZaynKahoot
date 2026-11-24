// The host's phone: every group's typed answer with the AI's verdict and reason, tap to flip,
// and a Next button. The TV is a shared display, so it never shows the groups' answers.
(() => {
  const app = document.getElementById('app');
  const socket = io();
  let st = null;
  socket.on('connect', () => socket.emit('host:hello'));
  socket.on('state', (s) => { st = s; applyStyle(s.style); draw(); });
  document.getElementById('next').onclick = () => socket.emit('host:advance');
  document.getElementById('regrade').onclick = () => socket.emit('host:regrade');

  const PHASE = { lobby: 'Lobby', intro: 'Question', showcase: 'Question', answering: 'Answering', grading: 'Judging', reveal: 'Answer shown', scoreboard: 'Scores', final: 'Final', podium: 'Podium' };
  const BY = { ai: '🤖 AI judge', match: '✓ word match', host: '👤 you', blank: 'no answer' };
  const hasText = (p) => typeof p.answer === 'string' && p.answer.trim();

  function draw() {
    if (!st) return;
    const q = st.question;
    const judging = st.phase === 'grading';
    const typed = q?.type === 'text';
    const canFlip = typed && ['grading', 'reveal', 'scoreboard'].includes(st.phase);
    document.getElementById('regrade').hidden = !(judging && st.grading?.status === 'error');
    let body = '';
    if (!q || st.phase === 'lobby') body = `<p class="muted">${st.players.length} group${st.players.length === 1 ? '' : 's'} joined. Start the game on the TV, then follow along here.</p>`;
    else {
      body += `<div class="muted">Question ${q.index + 1} of ${q.total}</div><div class="q">${esc(q.text)}</div>`;
      if (st.accepted) body += `<div>${st.accepted.map((a) => `<span class="acc">${esc(a.split('/').slice(0, 3).join(' / '))}</span>`).join('')}</div>`;
      if (judging) {
        const gr = st.grading || {}, left = st.players.filter((p) => p.verdict == null).length;
        body += `<div class="status">${gr.status === 'checking' ? '<span class="pill">🤖 The AI is checking…</span>'
          : gr.status === 'error' ? `<span class="pill bad">AI: ${esc(gr.error || 'failed')}</span>`
          : gr.status === 'off' ? '<span class="pill">No AI judge: tap each answer</span>' : '<span class="pill ok">🤖 Checked</span>'}
          ${left && gr.status !== 'checking' ? `<span class="pill warn">${left} to judge (counts as wrong)</span>` : ''}</div>`;
      }
      if (typed) {
        body += st.players.map((p) => {
          const v = judging ? p.verdict : p.correct;
          return `<button class="card ${v === true ? 'yes' : v === false ? 'no' : ''}" data-id="${esc(p.id)}" ${canFlip ? '' : 'disabled'}>
            <div class="top"><span class="nm">${esc(p.name)}</span><span class="vd">${v === true ? '✓' : v === false ? '✕' : st.phase === 'answering' ? (hasText(p) ? '✍️' : '…') : '?'}</span></div>
            ${st.phase === 'answering' ? '' : `<div class="ans">${hasText(p) ? esc(p.answer) : '<em>No answer</em>'}</div>`}
            ${p.verdictReason ? `<div class="why">${esc(p.verdictReason)}</div>` : ''}
            ${p.verdictBy ? `<div class="by">${BY[p.verdictBy] || ''}${canFlip ? ' · tap to flip' : ''}</div>` : canFlip ? '<div class="by">tap to mark</div>' : ''}
          </button>`;
        }).join('') || '<p class="muted">No groups yet</p>';
      } else {
        body += `<p class="muted">${st.answered ?? 0} of ${st.players.length} answered${st.phase === 'answering' ? '' : ''}</p>`;
      }
    }
    app.innerHTML = `<header><h1>🧑‍⚖️ Judge</h1><span class="ph">${PHASE[st.phase] || st.phase}</span></header>${body}`;
    app.querySelectorAll('.card[data-id]').forEach((el) => (el.onclick = () => {
      const p = st.players.find((x) => x.id === el.dataset.id); if (!p) return;
      const now = st.phase === 'grading' ? p.verdict : p.correct;
      socket.emit('host:verdict', { id: p.id, correct: now !== true });
    }));
  }
})();

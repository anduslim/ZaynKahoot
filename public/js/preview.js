// Read-only question browser for co-organisers: every set, every question and its answers.
// No joining, no QR code. Tap answers (or type one) to try a question yourself.
(() => {
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  let key = params.get('key') || sessionStorage.getItem('zk_preview') || '';
  let data = null, setIdx = 0, showAnswers = true;
  const TYPE = { choice: '🔠 Multiple choice', text: '✍️ Typed answer', hero: '🦸 Photos', photo: '🖼️ Pictures', pokemon: '⚡ Picture grid', animal: '🦜 Animals', height: '📏 Height', countries: '🌏 Number', food: '😀 Emoji answers', career: '😀 Emoji answers', colour: '🎨 Colours' };
  const rightList = (q) => (Array.isArray(q.correct) ? q.correct : [q.correct]);

  async function load() {
    const res = await fetch('/api/preview', { headers: key ? { 'x-preview-key': key } : {} });
    if (res.status === 401) return askKey();
    data = await res.json();
    if (key) sessionStorage.setItem('zk_preview', key);
    setIdx = Math.max(0, data.sets.findIndex((s) => s.id === data.activeSet));
    render();
  }
  function askKey(err) {
    app.innerHTML = `<form class="keybox" id="kf"><h1>Quiz preview</h1><p>Enter the preview key from the organiser.</p>
      <input id="k" type="password" placeholder="Preview key" autofocus>${err ? `<div class="err">${esc(err)}</div>` : ''}<button class="btn">Open</button></form>`;
    document.getElementById('kf').onsubmit = (e) => { e.preventDefault(); key = document.getElementById('k').value.trim(); load(); };
  }

  function render() {
    const set = data.sets[setIdx];
    const on = set.questions.filter((q) => q.enabled !== false);
    document.title = `${set.title} · Preview`;
    app.innerHTML = `
      <header class="top">
        <h1 class="brand">${brandHTML(set.title)}</h1>
        <p class="muted">Question preview for organisers · nothing here touches the live game</p>
        <div class="tabs">${data.sets.map((s, k) => `<button class="${k === setIdx ? 'on' : ''}" data-set="${k}">${s.id === data.activeSet ? '▶ ' : ''}${esc(s.name)}</button>`).join('')}</div>
        <div class="bar">
          <span>${on.length} question${on.length === 1 ? '' : 's'} · ${set.points} point${set.points === 1 ? '' : 's'} each${set.id === data.activeSet ? ' · <b class="live">this set is the one being played</b>' : ''}</span>
          <label class="tog"><input type="checkbox" id="sa" ${showAnswers ? 'checked' : ''}> Show answers</label>
        </div>
        ${set.questions.some((q) => q.type === 'text') ? `<p class="muted small">Typed answers are judged by ${data.ai ? 'the AI model' : 'keyword matching (no AI model is set up)'}; the host can overrule any verdict. Try one below.</p>` : ''}
      </header>
      <main>${(() => { let n = 0; return set.questions.map((q) => card(q, q.enabled === false ? null : ++n)).join(''); })()}</main>`;
    app.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { setIdx = +b.dataset.set; render(); scrollTo(0, 0); }));
    document.getElementById('sa').onchange = (e) => { showAnswers = e.target.checked; render(); };
    wire();
  }

  function card(q, n) {
    const right = rightList(q);
    let body = '';
    if (q.type === 'text') {
      body = `${showAnswers ? `<div class="accepted"><span class="lbl">Accepted</span>${(q.answers || []).map((a) => `<span class="acc">${esc(a)}</span>`).join('')}
          ${q.needed > 1 ? `<span class="muted small">Must name ${q.needed}</span>` : ''}</div>
          ${q.notes ? `<div class="notes"><span class="lbl">Judging notes</span> ${esc(q.notes)}</div>` : ''}` : ''}
        <form class="try" data-q="${esc(q.id)}"><input placeholder="Try an answer, e.g. how a child might write it" maxlength="200"><button class="btn">Check</button></form>
        <div class="verdict"></div>`;
    } else {
      body = `<div class="opts ${q.options.length > 6 ? 'many' : ''}">${q.options.map((o, i) => `
        <button class="opt ${showAnswers && right.includes(i) ? 'right' : ''}" data-q="${esc(q.id)}" data-i="${i}" style="${q.options.length > 6 ? '' : `background:${OPT_COLORS[i % OPT_COLORS.length]}`}">
          ${o.img ? `<img src="${esc(o.img)}" alt="" onerror="this.remove()">` : o.emoji ? `<span class="em">${esc(o.emoji)}</span>` : ''}<span>${esc(o.label)}</span></button>`).join('')}</div>
        ${q.type === 'choice' && q.pick > 1 ? `<div class="muted small">Groups pick ${q.pick}. Right when every pick is a right answer.</div>` : ''}
        <div class="verdict"></div>`;
    }
    return `<article class="q ${n ? '' : 'off'}" data-q="${esc(q.id)}">
      <div class="qtop"><span class="num">${n ? 'Q' + n : 'Off'}</span><span class="type">${TYPE[q.type] || q.type}</span><span class="muted small">⏱ ${q.timeLimit}s${q.minigame ? ' · then a mini game' : ''}</span></div>
      <h2>${esc(q.text)}</h2>${q.hint ? `<div class="hint">${esc(q.hint)}</div>` : ''}
      ${body}
      ${showAnswers && q.fact ? `<div class="fact">💡 ${esc(q.fact)}</div>` : ''}
    </article>`;
  }

  const find = (id) => data.sets[setIdx].questions.find((q) => q.id === id);
  const tried = {};               // question id -> picked option indexes
  function wire() {
    app.querySelectorAll('button.opt').forEach((b) => (b.onclick = () => {
      const q = find(b.dataset.q), i = +b.dataset.i, art = b.closest('.q');
      const pick = q.type === 'choice' ? q.pick : 1;
      let list = tried[q.id] || [];
      list = list.includes(i) ? list.filter((x) => x !== i) : [...list, i].slice(-pick);
      tried[q.id] = list;
      art.querySelectorAll('button.opt').forEach((x) => x.classList.toggle('picked', list.includes(+x.dataset.i)));
      const v = art.querySelector('.verdict');
      if (list.length < pick) { v.innerHTML = `<span class="muted">Pick ${pick - list.length} more</span>`; return; }
      const ok = list.every((x) => rightList(q).includes(x));
      v.innerHTML = ok ? '<span class="yes">✓ Right!</span>' : `<span class="no">✕ Not quite.</span> ${showAnswers ? '' : '<span class="muted">Tick “Show answers” to see it.</span>'}`;
    }));
    app.querySelectorAll('form.try').forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      const input = f.querySelector('input'), v = f.nextElementSibling, btn = f.querySelector('button');
      if (!input.value.trim()) return input.focus();
      btn.disabled = true; v.innerHTML = '<span class="muted">Checking…</span>';
      try {
        const res = await fetch('/api/preview/grade', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-preview-key': key } : {}) }, body: JSON.stringify({ qid: f.dataset.q, text: input.value }) });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Could not check');
        const by = r.by === 'ai' ? 'AI judge' : 'keyword match';
        v.innerHTML = `${r.correct ? '<span class="yes">✓ Right</span>' : '<span class="no">✕ Wrong</span>'} <span class="muted">(${by}${r.reason ? ': ' + esc(r.reason) : ''})</span>${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ''}`;
      } catch (err) { v.innerHTML = `<span class="no">${esc(err.message)}</span>`; }
      btn.disabled = false;
    }));
  }

  load().catch((e) => { app.innerHTML = `<p class="err center">${esc(e.message)}</p>`; });
})();

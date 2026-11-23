// Read-only question browser for co-organisers: every set, every question and its answers.
// No joining, no QR code. Tap answers (or type one) to try a question yourself.
(() => {
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  let key = params.get('key') || sessionStorage.getItem('zk_preview') || '';
  let data = null, setIdx = 0, showAnswers = true;
  // /<slug>/preview shows just that set; /preview shows them all
  const slug = decodeURIComponent((location.pathname.match(/^\/([^/]+)\/preview\/?$/) || [])[1] || '').toLowerCase();
  const TYPE = { choice: '🔠 Multiple choice', text: '✍️ Typed answer', hero: '🦸 Photos', photo: '🖼️ Pictures', pokemon: '⚡ Picture grid', animal: '🦜 Animals', height: '📏 Height', countries: '🌏 Number', food: '😀 Emoji answers', career: '😀 Emoji answers', colour: '🎨 Colours' };
  const rightList = (q) => (Array.isArray(q.correct) ? q.correct : [q.correct]);

  async function load() {
    const res = await fetch('/api/preview', { headers: key ? { 'x-preview-key': key } : {} });
    if (res.status === 401) return askKey();
    data = await res.json();
    if (key) sessionStorage.setItem('zk_preview', key);
    if (slug) {
      const k = data.sets.findIndex((s) => s.id === slug);
      if (k < 0) { app.innerHTML = `<div class="keybox"><h1>No set called “${esc(slug)}”</h1><p><a href="/preview${location.search}">See all question sets</a></p></div>`; return; }
      setIdx = k;
    } else setIdx = Math.max(0, data.sets.findIndex((s) => s.id === data.activeSet));
    render();
    if (params.get('play') === '1') simulate();
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
        ${slug ? `<p class="small"><a href="/preview${location.search}">← All question sets</a></p>`
          : `<div class="tabs">${data.sets.map((s, k) => `<button class="${k === setIdx ? 'on' : ''}" data-set="${k}">${s.id === data.activeSet ? '▶ ' : ''}${esc(s.name)}</button>`).join('')}</div>`}
        <div class="actions">
          <button class="btn big" id="sim">▶ Simulate the game</button>
          <a class="share" href="/${encodeURIComponent(set.id)}/preview" title="Link to just this set">🔗 ${esc(location.host)}/${esc(set.id)}/preview</a>
        </div>
        <div class="bar">
          <span>${on.length} question${on.length === 1 ? '' : 's'} · ${set.points} point${set.points === 1 ? '' : 's'} each · ${set.timer ? 'timed' : 'no timer'}${set.id === data.activeSet ? ' · <b class="live">this set is the one being played</b>' : ''}</span>
          <label class="tog"><input type="checkbox" id="sa" ${showAnswers ? 'checked' : ''}> Show answers</label>
        </div>
        ${set.questions.some((q) => q.type === 'text') ? `<p class="muted small">Typed answers are judged by ${data.ai ? 'the AI model' : 'keyword matching (no AI model is set up)'}; the host can overrule any verdict. Try one below.</p>` : ''}
      </header>
      <main>${(() => { let n = 0; return set.questions.map((q) => card(q, q.enabled === false ? null : ++n)).join(''); })()}</main>`;
    app.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { setIdx = +b.dataset.set; render(); scrollTo(0, 0); }));
    document.getElementById('sa').onchange = (e) => { showAnswers = e.target.checked; render(); };
    document.getElementById('sim').onclick = simulate;
    wire();
  }

  function card(q, n) {
    const right = rightList(q);
    let body = '';
    if (q.type === 'text') {
      body = `${showAnswers ? `<div class="accepted"><span class="lbl">Accepted</span>${(q.answers || []).map((a) => `<span class="acc">${esc(a)}</span>`).join('')}
          ${q.needed > 1 ? `<span class="muted small">Must name ${q.needed}</span>` : ''}</div>
          ${q.notes ? `<div class="notes"><span class="lbl">Marking guide</span> ${esc(q.notes)}</div>` : ''}` : ''}
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
      <div class="qtop"><span class="num">${n ? 'Q' + n : 'Off'}</span><span class="type">${TYPE[q.type] || q.type}</span><span class="muted small">${data.sets[setIdx].timer ? `⏱ ${q.timeLimit}s` : ''}${q.minigame && !data.sets[setIdx].quizOnly ? ' · then a mini game' : ''}</span></div>
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

  // ------------------------------------------------------------------ game simulator
  // Plays the set like the real game, on one page: the big screen on one side, a phone on the
  // other. Same answer rules and scoring; typed answers go to the real judge (AI / word match),
  // and you can flip a verdict like the host does. Nothing is sent to the live game.
  async function grade(q, text) {
    const res = await fetch('/api/preview/grade', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-preview-key': key } : {}) }, body: JSON.stringify({ qid: q.id, text }) });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || 'Could not check');
    return r;
  }
  function simulate() {
    const set = data.sets[setIdx];
    const qs = set.questions.filter((q) => q.enabled !== false);
    if (!qs.length) return;
    let i = 0, score = 0, right = 0, phase = 'question', answer = null, verdict = null, verdictNote = '', picks = [], timer = null, endsAt = 0;
    const box = document.createElement('div');
    box.className = 'sim';
    document.body.appendChild(box); document.body.style.overflow = 'hidden';
    const close = () => { clearInterval(timer); box.remove(); document.body.style.overflow = ''; };
    const q = () => qs[i];
    const isRight = (k) => rightList(q()).includes(k);
    const optHTML = (o, k, cls = '') => `<div class="sopt ${cls}" style="background:${OPT_COLORS[k % OPT_COLORS.length]}"><span class="shape">${OPT_SHAPES[k % OPT_SHAPES.length]}</span>${o.img ? `<img src="${esc(o.img)}" alt="" onerror="this.remove()">` : o.emoji ? `<span class="em">${esc(o.emoji)}</span>` : ''}<span>${esc(o.label)}</span></div>`;
    const pickCount = () => (q().type === 'choice' ? q().pick : 1);
    const correctNow = () => {
      if (q().type === 'text') return verdict === true;
      if (answer == null) return false;
      const a = Array.isArray(answer) ? answer : [answer];
      return a.length === pickCount() && a.every(isRight);
    };

    function startQuestion() {
      phase = 'question'; answer = null; verdict = null; verdictNote = ''; picks = [];
      clearInterval(timer);
      if (set.timer) { endsAt = Date.now() + q().timeLimit * 1000; timer = setInterval(tick, 250); }
      draw();
    }
    function tick() {
      const el = box.querySelector('#stime'); if (!el) return;
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      el.textContent = left; el.classList.toggle('low', left <= 5);
      if (left <= 0) finish();
    }
    async function finish() {
      clearInterval(timer);
      if (q().type === 'text' && answer) {
        phase = 'judging'; draw();
        try { const r = await grade(q(), answer); verdict = r.correct; verdictNote = (r.by === 'ai' ? 'AI judge' : 'word match') + (r.reason ? ': ' + r.reason : '') + (r.note ? ' · ' + r.note : ''); }
        catch (e) { verdict = null; verdictNote = e.message; }
      }
      phase = 'reveal';
      if (correctNow()) { score += set.points; right++; }
      draw();
    }
    function flip() {                                   // like the host tapping an answer on the projector
      if (q().type !== 'text' || !answer || phase !== 'reveal') return;
      const was = correctNow();
      verdict = !was; verdictNote = 'changed by the host';
      if (correctNow()) { score += set.points; right++; } else { score -= set.points; right--; }
      draw();
    }
    function next() { if (i < qs.length - 1) { i++; startQuestion(); } else { phase = 'final'; clearInterval(timer); draw(); } }

    const scene = (qq, mood) => (qq.scene && window.Scenes ? Scenes.html(qq.scene, mood) : '');
    function stage() {
      const qq = q();
      if (phase === 'final') return `<div class="sfinal"><div class="big">🏆</div><h2>${esc(set.title)}</h2><p>${right} of ${qs.length} right · <b>${score} point${score === 1 ? '' : 's'}</b></p></div>`;
      const head = `<div class="shead">${set.timer && phase === 'question' ? `<b class="stimer" id="stime">${qq.timeLimit}</b>` : ''}<div><div class="kick">Question ${i + 1} of ${qs.length}${qq.pick > 1 ? ` · <span>Pick ${qq.pick}</span>` : ''}${qq.type === 'text' ? ' · <span>Type your answer</span>' : ''}</div><h2>${esc(qq.text)}</h2></div></div>`;
      if (qq.type === 'text') {
        const acc = phase === 'reveal' || phase === 'judging' ? `<div class="sacc"><span class="lbl">The answer</span>${(qq.answers || []).map((a) => `<span class="acc">${esc(a.split('/').slice(0, 3).join(' / '))}</span>`).join('')}</div>` : '';
        const card = phase === 'question' ? (scene(qq, 'ask') ? `<div class="sscene">${scene(qq, 'ask')}</div>` : `<div class="swrite">✍️<div class="hint">Type your answer on your phone</div></div>`)
          : phase === 'judging' ? `<div class="swrite">🧑‍⚖️<div class="hint">The judges are checking…</div></div>`
          : `<div class="sres ${correctNow() ? 'yes' : 'no'}">${correctNow() ? '✓ 1 of 1 groups got it right' : 'No group got it this time'}</div>`;   // the shared TV shows no group's answer
        const show = phase === 'reveal' && scene(qq, 'reveal') ? `<div class="sscene">${scene(qq, 'reveal')}</div>` : '';
        return head + acc + show + `<div class="sfeat">${card}</div>${phase === 'reveal' && qq.fact ? `<div class="sfact">💡 ${esc(qq.fact)}</div>` : ''}`;
      }
      const reveal = phase === 'reveal';
      const mine = Array.isArray(answer) ? answer : answer == null ? [] : [answer];
      const res = `<div class="sres ${correctNow() ? 'yes' : 'no'}">${correctNow() ? '✓ Correct!' : answer == null ? '⏰ No answer' : '✕ Not this time'}</div>`;
      return head + (scene(qq, reveal ? 'reveal' : 'ask') ? `<div class="sscene">${scene(qq, reveal ? 'reveal' : 'ask')}</div>${reveal ? res : ''}`
        : `<div class="sfeat">${reveal ? res : `<div class="sthink">${qq.pick > 1 ? '✌️' : '🤔'}</div>`}</div>`) + `
        <div class="sopts ${qq.options.length > 4 ? 'six' : ''}">${qq.options.map((o, k) => optHTML(o, k, reveal ? (isRight(k) ? 'right' : 'dim') + (mine.includes(k) ? ' mine' : '') : '')).join('')}</div>
        ${reveal && qq.fact ? `<div class="sfact">💡 ${esc(qq.fact)}</div>` : ''}`;
    }
    function phone() {
      const qq = q();
      const bar = `<div class="pbar"><span>Your group</span><b>${score} pts</b></div>`;
      if (phase === 'final') return `<div class="pmid"><div class="big">🎉</div><div class="pt">Thanks for playing!</div><div class="ps">${score} points</div></div>${bar}`;
      if (phase === 'judging') return `<div class="pmid"><div class="big">🧑‍⚖️</div><div class="pt">The judges are checking!</div><div class="mine">“${esc(answer)}”</div></div>${bar}`;
      if (phase === 'reveal') return `<div class="pmid"><div class="pres ${correctNow() ? 'yes' : 'no'}"><div class="big">${correctNow() ? '✓' : answer == null ? '⏰' : '✕'}</div><div class="pt">${correctNow() ? 'Correct' : answer == null ? "Time's up!" : 'Not this time'}</div><div class="ps">${correctNow() ? '+ ' + set.points : ''}</div>${qq.type === 'text' && answer && verdictNote ? `<div class="pwhy"><div class="mine">“${esc(answer)}”</div>${esc(verdictNote)}</div>` : ''}</div></div>${bar}`;
      if (answer != null) return `<div class="pmid"><div class="big spin">⭐</div><div class="pt">Answer locked in!</div>${qq.type === 'text' ? `<div class="mine">“${esc(answer)}”</div>` : ''}<div class="ps">Waiting for the host…</div></div>${bar}`;
      if (qq.type === 'text') return `<div class="pq">${esc(qq.text)}</div><textarea id="pta" maxlength="200" placeholder="Type your answer here"></textarea><button class="btn big" id="psend">Send answer ✍️</button>${bar}`;
      const multi = qq.type === 'choice' && qq.pick > 1;
      return `<div class="pq">${esc(qq.text)}</div>${qq.hint ? `<div class="ps">${esc(qq.hint)}</div>` : ''}
        <div class="ppad ${qq.options.length > 6 ? 'many' : ''}">${qq.options.map((o, k) => `<button data-k="${k}" class="${picks.includes(k) ? 'picked' : ''}" style="background:${OPT_COLORS[k % OPT_COLORS.length]}">${o.emoji ? `<span class="em">${esc(o.emoji)}</span>` : ''}<span>${esc(o.label)}</span></button>`).join('')}</div>
        ${multi ? `<button class="btn big" id="psend" ${picks.length === qq.pick ? '' : 'disabled'}>${picks.length === qq.pick ? 'Send answers ✓' : `Pick ${qq.pick - picks.length} more`}</button>` : ''}${bar}`;
    }
    function draw() {
      const oldScene = box.querySelector('.scene');
      const nextLabel = phase === 'final' ? '' : phase === 'question' ? (answer != null ? 'Reveal ▸' : 'End question ▸') : phase === 'judging' ? '' : i < qs.length - 1 ? 'Next question ▸' : 'Final score ▸';
      box.innerHTML = `<div class="sim-top"><b>🎮 Simulation · ${esc(set.name)}</b><span class="muted small">Nothing here touches the live game</span>
          <span class="grow"></span>${nextLabel ? `<button class="btn" id="snext">${nextLabel}</button>` : ''}${phase === 'final' ? '<button class="btn" id="sagain">Play again</button>' : ''}<button class="btn ghost" id="sclose">✕ Close</button></div>
        <div class="sim-body"><section class="sstage"><div class="slabel">Big screen</div>${stage()}</section><section class="sphone"><div class="slabel">Phone</div><div class="pscreen">${phone()}</div>${phase === 'reveal' && q().type === 'text' && answer ? '<button class="btn ghost small" id="flip">👤 Host: flip this verdict</button>' : ''}</section></div>`;
      const newScene = box.querySelector('.scene');
      if (oldScene && newScene && oldScene.dataset.k === newScene.dataset.k) newScene.replaceWith(oldScene);
      box.querySelector('#sclose').onclick = close;
      const n = box.querySelector('#snext'); if (n) n.onclick = () => (phase === 'question' ? finish() : next());
      const ag = box.querySelector('#sagain'); if (ag) ag.onclick = () => { i = 0; score = 0; right = 0; startQuestion(); };
      const f = box.querySelector('#flip'); if (f) f.onclick = flip;
      box.querySelectorAll('.ppad button').forEach((b) => (b.onclick = () => {
        const k = +b.dataset.k;
        if (!(q().type === 'choice' && q().pick > 1)) { answer = k; draw(); if (!set.timer) setTimeout(finish, 600); return; }
        picks = picks.includes(k) ? picks.filter((x) => x !== k) : [...picks, k].slice(-q().pick);
        draw();
      }));
      const send = box.querySelector('#psend');
      if (send) send.onclick = () => {
        if (q().type === 'text') { const v = box.querySelector('#pta').value.trim(); if (!v) return; answer = v; }
        else { if (picks.length !== q().pick) return; answer = picks.slice().sort((a, b) => a - b); }
        draw(); if (!set.timer) setTimeout(finish, q().type === 'text' ? 900 : 600);
      };
      const ta = box.querySelector('#pta'); if (ta) ta.focus();
      if (phase === 'question' && set.timer) tick();
    }
    startQuestion();
  }

  load().catch((e) => { app.innerHTML = `<p class="err center">${esc(e.message)}</p>`; });
})();

// Quiz admin panel: edit, reorder and switch questions on/off, tune settings.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const TYPES = {
    choice: { icon: '🔠', name: 'Multiple choice', note: 'Up to 6 answers. Mark one or more right answers; with several, groups pick some of them.' },
    text: { icon: '✍️', name: 'Typed answer', note: 'Groups type their answer. The AI judge (or you, on the host screen) marks it right or wrong.' },
    hero: { icon: '🦸', name: 'Superhero photos', note: 'Photo answers with colourful rays. Its photos are also the runners in Hero Tower Escape.' },
    photo: { icon: '🖼️', name: 'Picture answers', note: 'Each answer is a picture, e.g. a photo of Zayn.' },
    pokemon: { icon: '⚡', name: 'Pokémon grid', note: 'Up to 24 picture tiles, a shadow mystery and decoys. Pairs with Catch the Mystery.' },
    animal: { icon: '🦜', name: 'Animals', note: 'Emoji animals that animate with a sound on the big screen.' },
    height: { icon: '📏', name: 'Height ruler', note: 'Zayn stretches up a ruler to each answer (in cm).' },
    countries: { icon: '🌏', name: 'Number + flags', note: 'Number answers; the reveal pops up a list of flags.' },
    food: { icon: '🍗', name: 'Emoji answers', note: 'Each answer has an emoji. Confetti on the reveal.' },
    career: { icon: '🧑‍🚀', name: 'Emoji answers (jobs)', note: 'Same as emoji answers.' },
    colour: { icon: '🎨', name: 'Colour pairs', note: 'Each answer is a pair of colours.' },
  };
  const MINIGAMES = { '': 'None', climb: 'Hero Tower Escape', catch: 'Catch the Mystery', race: 'Grand Prix' };
  const MG_ICON = { climb: '🏢', catch: '⭐', race: '🏎️' };
  const SOUNDS = ['', 'lion', 'elephant', 'monkey', 'toucan', 'dino', 'boing', 'whoosh', 'sparkle', 'cheer'];
  const ANIMS = { roar: 'Roar', stomp: 'Stomp', fly: 'Fly', swing: 'Swing' };
  const maxOptions = (t) => (t === 'pokemon' ? 24 : t === 'choice' ? 6 : t === 'text' ? 0 : 4);
  const rightList = (q) => (Array.isArray(q.correct) ? q.correct : [q.correct]);

  let key = sessionStorage.getItem('zk_admin') || '';
  let data = null, saved = '', server = {}, images = [];
  const open = new Set();
  let tab = 'questions';
  let viewSet = 0;                                   // index of the question set shown in the editor
  const Q = () => data.sets[viewSet].questions;
  const QP = () => `sets.${viewSet}.questions`;

  // ------------------------------------------------------------------ server
  async function api(method, url, body, raw) {
    const res = await fetch(url, {
      method, headers: { 'x-admin-key': key, ...(raw ? { 'content-type': raw.type } : body ? { 'content-type': 'application/json' } : {}) },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { showLogin('Wrong password'); throw new Error('locked'); }
    if (!res.ok) throw new Error(json.error || 'Something went wrong');
    return json;
  }
  async function load() {
    const st = await api('GET', '/api/admin/content');
    document.title = (st.content.title || 'Quiz') + ' · Admin';
    server = st; data = clone(st.content); saved = JSON.stringify(data);
    viewSet = Math.max(0, data.sets.findIndex((x) => x.id === data.activeSet));
    images = await api('GET', '/api/admin/images').catch(() => []);
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    render();
  }
  function showLogin(msg) {
    $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
    $('#loginErr').textContent = msg || ''; $('#pw').focus();
  }
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    key = $('#pw').value.trim();
    try { await load(); sessionStorage.setItem('zk_admin', key); } catch (err) { if (err.message !== 'locked') showLogin(err.message); }
  };

  const dirty = () => JSON.stringify(data) !== saved;
  function markDirty() {
    const b = $('#save');
    b.disabled = !dirty();
    b.textContent = dirty() ? 'Save changes' : 'Saved ✓';
    b.classList.toggle('pulse', dirty());
    renderOrder(); renderStatus();
  }
  window.addEventListener('beforeunload', (e) => { if (data && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  async function save(restart = false) {
    try {
      const viewing = data.sets[viewSet]?.id;
      const st = await api('PUT', '/api/admin/content', { content: data, restart });
      server = st; data = clone(st.content); saved = JSON.stringify(data);
      viewSet = Math.max(0, data.sets.findIndex((x) => x.id === viewing));
      render();
      if (st.pending) banner(`Saved. A game is in progress, so these changes start with the next game.
        <button class="btn small" id="restartNow">Restart the game now</button>`);
      else { banner(''); toast(restart ? 'Saved and restarted. Players are kept' : 'Saved. Live on the host screen'); }
    } catch (e) { if (e.message !== 'locked') toast(e.message, true); }
  }
  $('#save').onclick = () => save(false);
  document.addEventListener('click', (e) => {
    if (e.target.id === 'restartNow' && confirm('Restart the game now? Scores go back to 0; players stay in the lobby.')) save(true);
  });

  function banner(html) { const b = $('#banner'); b.innerHTML = html; b.classList.toggle('hidden', !html); }
  let toastT;
  function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 3200); }

  // ------------------------------------------------------------------ render
  function render() {
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#questionsTab').classList.toggle('hidden', tab !== 'questions');
    $('#settingsTab').classList.toggle('hidden', tab !== 'settings');
    if (tab === 'questions') renderQuestions(); else renderSettings();
    markDirty();
  }
  $$('#tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));

  function renderStatus() {
    const phase = { lobby: 'In the lobby', final: 'Showing the podium' }[server.phase] || 'Game in progress';
    $('#status').innerHTML = `<span class="dot ${server.phase === 'lobby' ? 'ok' : 'live'}"></span>${phase} · ${server.players} player${server.players === 1 ? '' : 's'}
      ${server.pending ? '<span class="pill warn">changes waiting for next game</span>' : ''}`;
  }

  const answerSummary = (q) => {
    if (q.type === 'text') return esc((q.answers || []).map((a) => a.split('/')[0].trim()).join(', ').slice(0, 60)) || '<em>add accepted answers</em>';
    const list = rightList(q).map((k) => q.options[k]).filter(Boolean);
    const s = list.map((o) => `${o.emoji ? esc(o.emoji) + ' ' : ''}${esc(o.label)}`).join(', ');
    return q.type === 'choice' && list.length > 1 ? `${s} <b>(pick ${q.pick || list.length})</b>` : s;
  };

  function renderQuestions() {
    renderSets();
    const n = Q().length;
    let num = 0;
    $('#list').innerHTML = Q().map((q, i) => {
      const on = q.enabled !== false;
      const t = TYPES[q.type] || TYPES.food;
      const isOpen = open.has(q.id);
      return `<article class="q ${on ? '' : 'off'} ${isOpen ? 'open' : ''}" data-i="${i}">
        <div class="q-head">
          <span class="handle" title="Drag to reorder" draggable="true">⠿</span>
          <span class="num">${on ? ++num : '–'}</span>
          <button class="q-title" data-act="toggle-open">
            <span class="type" title="${esc(t.name)}">${t.icon}</span>
            <span class="text">${esc(q.text) || '<em>New question</em>'}</span>
          </button>
          <span class="chips">
            <span class="chip ok" title="Correct answer">✓ ${answerSummary(q)}</span>
            ${q.minigame ? `<span class="chip mg" title="Mini game afterwards">${MG_ICON[q.minigame]} ${MINIGAMES[q.minigame]}</span>` : ''}
            ${data.sets[viewSet].timer === false ? '' : `<span class="chip">⏱ ${q.timeLimit}s</span>`}
          </span>
          <span class="tools">
            <label class="switch" title="${on ? 'In the game' : 'Skipped'}"><input type="checkbox" data-act="enable" ${on ? 'checked' : ''}><span></span></label>
            <button class="icon" data-act="up" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button>
            <button class="icon" data-act="down" ${i === n - 1 ? 'disabled' : ''} title="Move down">↓</button>
            <button class="icon" data-act="dup" title="Duplicate">⧉</button>
            <button class="icon danger" data-act="del" title="Delete">🗑</button>
          </span>
        </div>
        ${isOpen ? editorHTML(q, i) : ''}
      </article>`;
    }).join('');
    const qo = data.sets[viewSet].quizOnly;
    $('#list').insertAdjacentHTML('afterbegin', qo ? `<div class="notice">❓ <b>Quiz only</b>: this set plays just its questions: no mini games, no finale, and no Wi-Fi QR code in the lobby.</div>` : data.mode === 'games' ? `<div class="notice">🎮 <b>Mini games only</b> is on (Settings), so these questions are skipped. Switch back to <b>Quiz + mini games</b> to play them.</div>` : '');
    $('#add').innerHTML = `<span>Add a question:</span>${Object.entries(TYPES).map(([k, t]) => `<button class="btn small" data-add="${k}" title="${esc(t.note)}">${t.icon} ${esc(t.name)}</button>`).join('')}`;
    wireList();
  }

  // ---- question sets: tabs to switch which set you edit, and which one is played
  function renderSets() {
    const set = data.sets[viewSet], playing = set.id === data.activeSet;
    $('#sets').innerHTML = `
      <div class="set-tabs">${data.sets.map((x, k) => `<button class="set-tab ${k === viewSet ? 'on' : ''}" data-set="${k}">
          ${x.id === data.activeSet ? '<span class="live" title="This set is played">▶</span>' : ''}<span class="nm">${esc(x.name) || 'Untitled set'}</span><small>${x.questions.length}</small></button>`).join('')}
        <button class="set-tab add" data-setact="new" title="Start an empty question set">+ New set</button></div>
      <div class="set-tools">
        <label class="field set-name"><span class="lbl">Set name</span><input data-path="sets.${viewSet}.name" value="${esc(set.name)}" maxlength="40"></label>
        <label class="field set-name"><span class="lbl">Title on screen</span><input data-path="sets.${viewSet}.title" value="${esc(set.title || '')}" maxlength="60" placeholder="${esc(data.title)}"></label>
        <label class="field set-small"><span class="lbl">Points per right answer</span><input type="number" min="1" max="5000" data-path="sets.${viewSet}.points" data-kind="int" value="${set.points ?? 1000}"></label>
        <label class="field set-small"><span class="lbl">Link name (slug)</span><input data-act="slug" value="${esc(set.id)}" maxlength="30" pattern="[a-z0-9-]+"></label>
        <label class="check set-check" title="Count down each question. Off: a question stays open until everyone has answered or you press Next"><input type="checkbox" data-path="sets.${viewSet}.timer" ${set.timer !== false ? 'checked' : ''}> Timer</label>
        <label class="check set-check" title="Only the questions: no mini games, no finale and no Wi-Fi QR code in the lobby, whatever Settings says"><input type="checkbox" data-path="sets.${viewSet}.quizOnly" ${set.quizOnly ? 'checked' : ''}> Quiz only</label>
        <label class="field set-small ${set.quizOnly ? 'hidden' : ''}"><span class="lbl">Finale</span><select data-path="sets.${viewSet}.finale">${[['', 'As in Settings'], ['none', 'No finale'], ['race', 'Grand Prix'], ['climb', 'Hero Tower Escape']].map(([v, l]) => `<option value="${v}" ${(set.finale || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <a class="btn small ghost" href="/${encodeURIComponent(set.id)}/preview" target="_blank" title="Preview and simulate this set">👀 /${esc(set.id)}/preview</a>
        ${playing ? '<span class="pill ok">▶ This set is played in the game</span>' : '<button class="btn small primary" data-setact="play">▶ Play this set</button>'}
        <button class="btn small" data-setact="dup">⧉ Duplicate set</button>
        ${data.sets.length > 1 ? '<button class="btn small danger" data-setact="del">Delete set</button>' : ''}
      </div>`;
    bindInputs($('#sets'));
    const slug = $('#sets [data-act="slug"]');
    slug.addEventListener('change', () => {                 // the slug is the set's id: keep it unique, and keep "played" pointing at it
      const clean = slug.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
      if (!clean || data.sets.some((x, k) => k !== viewSet && x.id === clean)) { toast('That link name is empty or already used', true); slug.value = set.id; return; }
      if (data.activeSet === set.id) data.activeSet = clean;
      set.id = clean; renderSets(); markDirty();
    });
    $$('#sets [data-set]').forEach((b) => (b.onclick = () => { viewSet = +b.dataset.set; open.clear(); renderQuestions(); }));
    $$('#sets [data-setact]').forEach((b) => (b.onclick = () => {
      const act = b.dataset.setact, rid = () => Math.random().toString(36).slice(2, 7);
      if (act === 'new') { data.sets.push({ id: 'set-' + rid(), name: 'New set', points: 1, finale: 'none', questions: [] }); viewSet = data.sets.length - 1; }
      else if (act === 'play') { data.activeSet = set.id; toast(`“${set.name}” will be played. Save to apply`); }
      else if (act === 'dup') {
        const c = clone(set); c.id = 'set-' + rid(); c.name = set.name + ' (copy)';
        c.questions.forEach((q) => { q.id = 'q' + rid(); });
        data.sets.splice(viewSet + 1, 0, c); viewSet++;
      } else if (act === 'del') {
        if (!confirm(`Delete the “${set.name}” question set and its ${set.questions.length} questions?`)) return;
        data.sets.splice(viewSet, 1);
        if (playing) data.activeSet = data.sets[0].id;
        viewSet = Math.min(viewSet, data.sets.length - 1);
      }
      open.clear(); renderQuestions(); markDirty();
    }));
  }

  // ---- one question's editor
  const field = (label, html, hint) => `<label class="field"><span class="lbl">${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const inp = (path, v, attrs = '') => `<input data-path="${path}" value="${esc(v ?? '')}" ${attrs}>`;

  function editorHTML(q, i) {
    const p = `${QP()}.${i}`;
    const t = TYPES[q.type] || TYPES.food;
    const mgOptions = Object.entries(MINIGAMES).filter(([k]) => k !== 'catch' || q.type === 'pokemon')
      .map(([k, v]) => `<option value="${k}" ${q.minigame === k || (!q.minigame && !k) ? 'selected' : ''}>${v}</option>`).join('');
    return `<div class="editor">
      <div class="grid2">
        ${field('Question', `<textarea data-path="${p}.text" rows="2" maxlength="200">${esc(q.text)}</textarea>`)}
        <div class="col">
          ${field('Question type', `<select data-act="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${v.icon} ${v.name}</option>`).join('')}</select>`, esc(t.note))}
        </div>
      </div>
      <div class="grid3">
        ${field('Hint (optional)', inp(`${p}.hint`, q.hint, 'maxlength="160" placeholder="Shown under the question"'))}
        ${field('Fun fact', inp(`${p}.fact`, q.fact, 'maxlength="120" placeholder="Read out after the answer"'))}
        ${field('Mini game afterwards', `<select data-path="${p}.minigame">${mgOptions}</select>`)}
      </div>
      ${data.sets[viewSet].timer === false ? '<small class="muted">No timer in this set: the question stays open until everyone has answered or you press Next.</small>'
        : field(`Time to answer: <b data-show="${p}.timeLimit">${q.timeLimit}</b> seconds`, `<input type="range" min="5" max="180" step="5" data-path="${p}.timeLimit" data-kind="int" value="${q.timeLimit}">`)}
      ${q.type === 'text' ? textExtras(q, i) : `
      <div class="lbl answers-lbl">Answers <small>${q.type === 'choice' ? 'Tap the circles to mark the right answers (one or more)' : 'Tap the circle to mark the right one'}</small></div>
      <div class="opts ${q.type === 'pokemon' ? 'many' : ''}">${q.options.map((o, k) => optionHTML(q, i, o, k)).join('')}</div>
      ${q.options.length < maxOptions(q.type) ? `<button class="btn small" data-act="add-opt">+ Add answer</button>` : ''}
      ${q.type === 'choice' && rightList(q).length > 1 ? field('Groups pick', `<select data-path="${p}.pick" data-kind="int">${rightList(q).map((_, k) => `<option value="${k + 1}" ${(q.pick || rightList(q).length) === k + 1 ? 'selected' : ''}>${k + 1} answer${k ? 's' : ''}${k + 1 === rightList(q).length ? ' (all the right ones)' : ''}</option>`).join('')}</select>`, 'Right when every answer they pick is a right one, e.g. “name any two”') : ''}`}
      ${q.type === 'pokemon' ? pokemonExtras(q, i) : ''}
      ${q.type === 'countries' ? countriesExtras(q, i) : ''}
    </div>`;
  }

  function imgBtn(path, src) {
    return `<button class="thumb" data-pick="${path}" title="Choose picture">${src ? `<img src="${esc(src)}" alt="">` : '<span>+ Picture</span>'}</button>`;
  }

  function optionHTML(q, i, o, k) {
    const p = `${QP()}.${i}.options.${k}`;
    const right = rightList(q).includes(k);
    let extra = '';
    if (['hero', 'photo', 'pokemon'].includes(q.type)) extra += imgBtn(`${p}.img`, o.img);
    if (q.type === 'hero' || q.type === 'colour') extra += `<span class="colors"><input type="color" data-path="${p}.colors.0" value="${esc(o.colors?.[0] || '#2563eb')}"><input type="color" data-path="${p}.colors.1" value="${esc(o.colors?.[1] || '#facc15')}"></span>`;
    if (['animal', 'food', 'career', 'choice'].includes(q.type)) extra += `<input class="emoji" data-path="${p}.emoji" value="${esc(o.emoji || '')}" maxlength="16" placeholder="🙂" title="Emoji">`;
    if (q.type === 'animal') {
      extra += `<select data-path="${p}.sound" title="Sound">${SOUNDS.map((s) => `<option value="${s}" ${o.sound === s ? 'selected' : ''}>${s ? '🔊 ' + s : 'No sound'}</option>`).join('')}</select>`;
      extra += `<select data-path="${p}.anim" title="Animation">${Object.entries(ANIMS).map(([v, l]) => `<option value="${v}" ${o.anim === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      extra += `<input type="color" data-path="${p}.bg" value="${esc(o.bg || '#8ecae6')}" title="Background">`;
    }
    if (q.type === 'height' || q.type === 'countries') extra += `<input class="small-num" type="number" data-path="${p}.value" data-kind="num" value="${esc(o.value ?? '')}" title="${q.type === 'height' ? 'Height in cm' : 'Number'}">`;
    return `<div class="opt ${right ? 'right' : ''}" data-k="${k}">
      <button class="mark" data-act="correct" title="${right ? 'Correct answer' : 'Mark as correct'}">${right ? '✓' : ''}</button>
      <input class="label" data-path="${p}.label" value="${esc(o.label)}" maxlength="60" placeholder="Answer ${k + 1}">
      ${extra}
      ${q.options.length > 2 ? `<button class="icon danger" data-act="del-opt" title="Remove answer">✕</button>` : ''}
    </div>`;
  }

  function textExtras(q, i) {
    const p = `${QP()}.${i}`;
    const n = (q.answers || []).length || 1;
    return `<div class="extras">
      ${field('Accepted answers', `<textarea data-path="${p}.answers" data-kind="lines" rows="4" placeholder="One per line. Use / for words that mean the same, e.g. Wise Men / Kings / Magi">${esc((q.answers || []).join('\n'))}</textarea>`, 'One item per line; “/” between words that mean the same thing. Short answers are also matched without the AI, with spelling slips allowed.')}
      <div class="grid2">
        ${field('Items needed', `<input type="number" min="1" max="${n}" data-path="${p}.needed" data-kind="int" value="${q.needed || 1}">`, 'How many different lines the answer must name, e.g. 2 for “name any two”')}
        ${field('Marking guide for the AI judge', `<textarea data-path="${p}.notes" rows="4" maxlength="1500" placeholder="What earns the point and what doesn't, e.g. Accept close spellings. “A stable” alone is wrong.">${esc(q.notes || '')}</textarea>`, 'Sent to the AI with every answer. It replies with point / no point and its reasoning, shown on the host screen.')}
      </div></div>`;
  }

  function pokemonExtras(q, i) {
    const decoys = new Set(q.shadowDecoys || []);
    return `<div class="extras">
      ${field('Mystery shadow', `<div class="row">${imgBtn(`${QP()}.${i}.mysteryImg`, q.mysteryImg)}<small>Shown as a purple shadow; caught in the mini game</small></div>`)}
      <div class="field"><span class="lbl">Decoy shadows <small>Rotate with the mystery on the big screen so it isn't a giveaway (${decoys.size} picked)</small></span>
        <div class="decoys">${q.options.filter((o) => o.img).map((o) => `<button class="decoy ${decoys.has(o.img) ? 'on' : ''}" data-act="decoy" data-img="${esc(o.img)}" title="${esc(o.label)}"><img src="${esc(o.img)}" alt=""></button>`).join('')}</div></div>
    </div>`;
  }

  function countriesExtras(q, i) {
    const rows = q.reveal || [];
    return `<div class="extras"><span class="lbl">Flags on the reveal <small>${rows.length} shown</small></span>
      <div class="reveal">${rows.map((r, k) => `<div class="rrow"><input class="emoji" data-path="${QP()}.${i}.reveal.${k}.0" value="${esc(r[0])}" maxlength="16"><input data-path="${QP()}.${i}.reveal.${k}.1" value="${esc(r[1])}" maxlength="40"><button class="icon danger" data-act="del-flag" data-k="${k}">✕</button></div>`).join('')}</div>
      <button class="btn small" data-act="add-flag">+ Add flag</button></div>`;
  }

  // ------------------------------------------------------------------ editing
  const getAt = (path) => path.split('.').reduce((o, k) => o?.[k], data);
  function setAt(path, v) {
    const ks = path.split('.'); const last = ks.pop();
    const o = ks.reduce((o, k) => o[k], data); o[last] = v;
  }
  function bindInputs(root) {
    $$('[data-path]', root).forEach((el) => {
      const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.kind === 'int') v = parseInt(v, 10) || 0;
        if (el.dataset.kind === 'num') v = v === '' ? '' : Number(v);
        if (el.dataset.kind === 'list') v = el.value.split(/[ ,]+/).filter(Boolean).map(Number);
        if (el.dataset.kind === 'lines') v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
        setAt(el.dataset.path, v);
        $$(`[data-show="${el.dataset.path}"]`).forEach((s) => (s.textContent = v));
        if (/\.(text|label|emoji|minigame|timeLimit|answers|pick)$/.test(el.dataset.path) && tab === 'questions') refreshHead(el);
        if (/^sets\.\d+\.finale$/.test(el.dataset.path)) renderOrder();
        if (/^sets\.\d+\.quizOnly$/.test(el.dataset.path)) { if (v) data.sets[viewSet].timer = false; renderQuestions(); }
        if (/^sets\.\d+\.timer$/.test(el.dataset.path)) renderQuestions();
        if (/^sets\.\d+\.name$/.test(el.dataset.path)) { const t = $(`.set-tab[data-set="${viewSet}"] .nm`); if (t) t.textContent = v || 'Untitled set'; }
        markDirty();
      });
    });
  }
  // update a card's header without re-rendering its editor (keeps typing focus)
  function refreshHead(el) {
    const card = el.closest('.q'); if (!card) return;
    const q = Q()[+card.dataset.i];
    $('.text', card).innerHTML = esc(q.text) || '<em>New question</em>';
    $('.chips', card).innerHTML = `<span class="chip ok">✓ ${answerSummary(q)}</span>${q.minigame ? `<span class="chip mg">${MG_ICON[q.minigame]} ${MINIGAMES[q.minigame]}</span>` : ''}<span class="chip">⏱ ${q.timeLimit}s</span>`;
  }

  function template(type) {
    const id = 'q' + Math.random().toString(36).slice(2, 8);
    const base = { id, enabled: true, type, text: '', fact: '', timeLimit: 20, correct: 0 };
    const four = (f) => [0, 1, 2, 3].map(f);
    switch (type) {
      case 'choice': return { ...base, correct: [0], pick: 1, options: four(() => ({ label: '', emoji: '' })) };
      case 'text': return { ...base, timeLimit: 60, correct: null, options: [], answers: [], needed: 1, notes: '' };
      case 'hero': return { ...base, options: four((k) => ({ label: '', img: '', colors: ['#7B2CBF', '#2BA84A'] })) };
      case 'photo': return { ...base, options: four(() => ({ label: '', img: '' })) };
      case 'pokemon': return { ...base, timeLimit: 30, options: four(() => ({ label: '', img: '' })), mysteryImg: '', shadowDecoys: [] };
      case 'animal': return { ...base, options: four(() => ({ label: '', emoji: '🐾', sound: '', anim: 'roar', bg: '#8ecae6' })) };
      case 'height': return { ...base, options: [85, 96, 100, 110].map((v) => ({ label: v + ' cm', value: v })) };
      case 'countries': return { ...base, options: [3, 5, 7, 9].map((v) => ({ label: String(v), value: v })), reveal: [] };
      case 'colour': return { ...base, options: four(() => ({ label: '', colors: ['#2563eb', '#facc15'] })) };
      default: return { ...base, options: four(() => ({ label: '', emoji: '' })) };
    }
  }
  // switching type keeps the question and answer text, and fills in the new type's fields
  function changeType(q, type) {
    const t = template(type);
    const was = q.type, right = rightList(q).filter((k) => k != null);
    if (type === 'text') {                                  // the right answers become the accepted answers
      if (!(q.answers || []).length) q.answers = right.map((k) => q.options[k]?.label).filter(Boolean);
      Object.assign(q, { type, options: [], correct: null, needed: q.needed || 1, timeLimit: Math.max(q.timeLimit, 45) });
      delete q.pick; delete q.mysteryImg; delete q.shadowDecoys; delete q.reveal;
      if (q.minigame === 'catch') delete q.minigame;
      return;
    }
    const keep = was === 'text' ? (q.answers || []).map((a) => ({ label: a.split('/')[0].trim() })) : q.options.slice(0, maxOptions(type));
    t.options = (keep.length >= 2 ? keep : t.options).map((o, k) => ({ ...(t.options[k] || t.options[0]), label: o.label, ...(o.img ? { img: o.img } : {}) }));
    const first = Math.min(right[0] ?? 0, t.options.length - 1);
    Object.assign(q, { type, options: t.options, correct: first });
    if (type === 'choice') { q.correct = (was === 'text' ? keep.map((_, k) => k).slice(0, 6) : right).filter((k) => k < t.options.length); if (!q.correct.length) q.correct = [0]; q.pick = q.pick && q.pick <= q.correct.length ? q.pick : q.correct.length; }
    else delete q.pick;
    if (was === 'text') { delete q.answers; delete q.needed; delete q.notes; }
    if (type !== 'pokemon') { delete q.mysteryImg; delete q.shadowDecoys; } else { q.mysteryImg ||= ''; q.shadowDecoys ||= []; }
    if (type !== 'countries') delete q.reveal; else q.reveal ||= [];
    if (q.minigame === 'catch' && type !== 'pokemon') delete q.minigame;
  }

  function move(from, to) {
    const qs = Q();
    if (to < 0 || to >= qs.length) return;
    qs.splice(to, 0, qs.splice(from, 1)[0]);
  }

  function wireList() {
    const list = $('#list');
    bindInputs(list);
    $$('.q', list).forEach((card) => {
      const i = +card.dataset.i, q = Q()[i];
      card.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' && b.dataset.act !== 'enable') return;
        const act = b.dataset.act;
        if (act === 'toggle-open') { open.has(q.id) ? open.delete(q.id) : open.add(q.id); }
        else if (act === 'up') move(i, i - 1);
        else if (act === 'down') move(i, i + 1);
        else if (act === 'dup') { const c = clone(q); c.id = 'q' + Math.random().toString(36).slice(2, 8); Q().splice(i + 1, 0, c); open.add(c.id); }
        else if (act === 'del') { if (!confirm(`Delete “${q.text || 'this question'}”?`)) return; Q().splice(i, 1); }
        else if (act === 'correct') {
          const k = +b.closest('.opt').dataset.k;
          if (q.type !== 'choice') q.correct = k;
          else {                                              // multiple choice: tap to add / remove a right answer
            const all = (q.pick || 1) === q.correct.length;
            if (q.correct.includes(k)) { if (q.correct.length > 1) q.correct = q.correct.filter((x) => x !== k); }
            else q.correct = [...q.correct, k].sort((a, b) => a - b);
            q.pick = all ? q.correct.length : Math.min(q.pick || 1, q.correct.length);
          }
        }
        else if (act === 'del-opt') {
          const k = +b.closest('.opt').dataset.k; q.options.splice(k, 1);
          if (q.type === 'choice') {
            q.correct = q.correct.filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)); if (!q.correct.length) q.correct = [0];
            q.pick = Math.min(q.pick || 1, q.correct.length);
          } else if (q.correct >= k && q.correct > 0) q.correct--;
        }
        else if (act === 'add-opt') q.options.push({ ...template(q.type).options[0], label: '' });
        else if (act === 'decoy') { const s = new Set(q.shadowDecoys || []); s.has(b.dataset.img) ? s.delete(b.dataset.img) : s.add(b.dataset.img); q.shadowDecoys = [...s]; }
        else if (act === 'add-flag') (q.reveal ||= []).push(['🏳️', '']);
        else if (act === 'del-flag') q.reveal.splice(+b.dataset.k, 1);
        else if (act === 'enable') { q.enabled = b.checked; }
        else return;
        renderQuestions(); markDirty();
      });
      const type = $('[data-act="type"]', card);
      if (type) type.onchange = () => { changeType(q, type.value); renderQuestions(); markDirty(); };
    });
    $$('[data-add]').forEach((b) => (b.onclick = () => {
      const q = template(b.dataset.add); Q().push(q); open.add(q.id);
      renderQuestions(); markDirty();
      setTimeout(() => { const c = $$('.q').pop(); c?.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('textarea', c)?.focus(); }, 50);
    }));
    $$('[data-pick]', list).forEach((b) => (b.onclick = () => openPicker(b.dataset.pick)));
    wireDrag(list);
  }

  // drag the ⠿ handle to reorder (desktop); ↑ ↓ buttons work everywhere
  function wireDrag(list) {
    let dragging = null;
    $$('.handle', list).forEach((h) => {
      h.addEventListener('dragstart', (e) => {
        dragging = h.closest('.q'); dragging.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging.dataset.i);
        e.dataTransfer.setDragImage(dragging, 30, 30);
      });
      h.addEventListener('dragend', () => {
        if (!dragging) return;
        const order = $$('.q', list).map((c) => +c.dataset.i);
        dragging = null;
        if (order.some((v, k) => v !== k)) { const qs = Q(); data.sets[viewSet].questions = order.map((k) => qs[k]); markDirty(); }
        renderQuestions();
      });
    });
    list.addEventListener('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const after = $$('.q:not(.dragging)', list).find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
      if (after) list.insertBefore(dragging, after); else list.appendChild(dragging);
    });
  }

  // ------------------------------------------------------------------ run order
  function renderOrder() {
    if (!data) return;
    const items = [];
    const playingSet = data.sets.find((x) => x.id === data.activeSet) || data.sets[0];
    if (data.mode === 'games' && !playingSet.quizOnly) {
      (data.gamesOnly || []).forEach((g) => items.push(g.on ? `<li class="mg">${MG_ICON[g.type]} ${MINIGAMES[g.type]}</li>` : `<li class="skip">${MINIGAMES[g.type]} <em>(off)</em></li>`));
      items.push('<li class="mg">🏆 Podium</li>');
      $('#order').innerHTML = `<li class="note">🎮 Mini games only. Questions are skipped</li>` + items.join('');
      return;
    }
    let n = 0;
    const playing = data.sets.find((x) => x.id === data.activeSet) || data.sets[0];
    items.push(`<li class="note">▶ Playing: <b>${esc(playing.name)}</b></li>`);
    playing.questions.forEach((q) => {
      if (q.enabled === false) { items.push(`<li class="skip">${esc(q.text || 'New question')} <em>(skipped)</em></li>`); return; }
      items.push(`<li><b>Q${++n}</b> ${esc(q.text || 'New question')}</li>`);
      if (q.minigame && !playing.quizOnly) items.push(`<li class="mg">${MG_ICON[q.minigame]} ${MINIGAMES[q.minigame]}</li>`);
    });
    const fin = playing.quizOnly ? 'none' : playing.finale || data.finale;
    if (fin !== 'none') items.push(`<li class="mg finale">🏁 Finale: ${MINIGAMES[fin]}</li>`);
    items.push('<li class="mg">🏆 Podium</li>');
    $('#order').innerHTML = items.join('');
  }

  // ------------------------------------------------------------------ settings
  function renderSettings() {
    const g = data.games || {};
    const bonus = data.minigameBonus || [];
    const gamesMode = data.mode === 'games';
    const gl = data.gamesOnly || [];
    $('#settingsTab').innerHTML = `
      <div class="card">
        <h3>Game mode</h3>
        <div class="modes">
          <label class="mode ${!gamesMode ? 'on' : ''}"><input type="radio" name="mode" value="quiz" ${!gamesMode ? 'checked' : ''}><b>❓ Quiz + mini games</b><small>The questions, with the mini games and finale in between</small></label>
          <label class="mode ${gamesMode ? 'on' : ''}"><input type="radio" name="mode" value="games" ${gamesMode ? 'checked' : ''}><b>🎮 Mini games only</b><small>Skip the questions: play the games below in order, then the podium</small></label>
        </div>
        ${gamesMode ? `<div class="lbl">Games to play <small>Switch on/off and put them in order</small></div>
        <div class="glist">${gl.map((g, k) => `<div class="grow ${g.on ? '' : 'off'}" data-k="${k}">
          <span class="gname">${MG_ICON[g.type]} ${MINIGAMES[g.type]}</span>
          <label class="switch"><input type="checkbox" data-gact="on" ${g.on ? 'checked' : ''}><span></span></label>
          <button class="icon" data-gact="up" ${k === 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button class="icon" data-gact="down" ${k === gl.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
        </div>`).join('')}</div>` : ''}
      </div>
      <div class="card">
        <h3>Game</h3>
        <div class="grid3">
          ${field('Title', inp('title', data.title, 'maxlength="60"'))}
          ${field('Grand finale', `<select data-path="finale">${['race', 'climb', 'none'].map((f) => `<option value="${f}" ${data.finale === f ? 'selected' : ''}>${f === 'none' ? 'No finale' : MINIGAMES[f]}</option>`).join('')}</select>`, 'Played after the last question, before the podium')}
          <div class="field"><span class="lbl">Height photo</span><div class="row">${imgBtn('heightPhoto', data.heightPhoto)}<small>Zayn on the height ruler</small></div></div>
        </div>
      </div>
      <div class="card">
        <h3>Mini games</h3>
        <div class="grid3">
          ${field(`Grand Prix laps: <b data-show="games.raceLaps">${g.raceLaps}</b>`, `<input type="range" min="1" max="6" data-path="games.raceLaps" data-kind="int" value="${g.raceLaps}">`)}
          ${field(`Tower time limit: <b data-show="games.climbSeconds">${g.climbSeconds}</b>s`, `<input type="range" min="30" max="240" step="10" data-path="games.climbSeconds" data-kind="int" value="${g.climbSeconds}">`)}
          ${field(`Catch time limit: <b data-show="games.catchSeconds">${g.catchSeconds}</b>s`, `<input type="range" min="20" max="180" step="10" data-path="games.catchSeconds" data-kind="int" value="${g.catchSeconds}">`)}
        </div>
      </div>
      <div class="card">
        <h3>Points</h3>
        <p class="muted">A right answer gives the question set's points (set them next to the set name on the Questions page). Answering faster gives no extra points.</p>
        <label class="check"><input type="checkbox" data-path="showRankings" ${data.showRankings !== false ? 'checked' : ''}> Show the rankings after each question <small>(the host can also switch this live with the <b>Rankings</b> button or the R key)</small></label>
        <div class="lbl">Mini game bonus by finishing place</div>
        <div class="bonus">${bonus.map((b, k) => `<label><span>${ordinal(k + 1)}</span><input type="number" min="0" max="5000" data-path="minigameBonus.${k}" data-kind="int" value="${b}"></label>`).join('')}</div>
        <div class="grid3">
          ${field('Everyone else gets', `<input type="number" min="0" max="5000" data-path="minigameParticipation" data-kind="int" value="${data.minigameParticipation}">`, 'Players who took part but did not place')}
          ${field(`Finale race multiplier: <b data-show="raceMultiplier">${data.raceMultiplier}</b>×`, `<input type="range" min="0.5" max="5" step="0.5" data-path="raceMultiplier" data-kind="num" value="${data.raceMultiplier}">`)}
        </div>
      </div>
      <div class="card">
        <h3>Set when the server starts</h3>
        <ul class="facts">
          <li>Wi-Fi QR code in the lobby: <b>${server.wifi ? 'on' : 'off'}</b> <small>(WIFI_SSID / WIFI_PASSWORD)</small></li>
          <li>Join link: <b>${esc(server.publicUrl || 'the address the host screen is opened on')}</b> <small>(PUBLIC_URL)</small></li>
          <li>Admin password: <b>${server.passwordFromEnv ? 'ADMIN_PASSWORD' : 'random code in the server log'}</b></li>
          <li>Questions are saved on the server ${server.savedToFile ? '(edited copy in use)' : '(using the original content.js)'}</li>
        </ul>
        <button class="btn danger" id="restore">Restore the original question sets</button>
      </div>
      <div class="card">
        <h3>AI judge for typed answers</h3>
        <p class="muted">${server.ai?.enabled ? `On: <b>${esc(server.ai.model || 'default model')}</b> at <code>${esc(server.ai.baseUrl)}</code>. Typed answers are judged automatically; the host can still flip any verdict.` : 'Off: typed answers are matched by keywords and the host taps each one right or wrong.'}</p>
        <div class="grid3">
          ${field('AI address (OpenAI-compatible)', `<input id="aiUrl" value="${esc(server.ai?.baseUrl || '')}" placeholder="http://my-llama:8080/v1" autocapitalize="off" autocorrect="off" spellcheck="false">`, 'llama.cpp, Ollama, LM Studio, vLLM… Usually ends in /v1 (added for you). Blank = AI off.')}
          ${field('Model', `<input id="aiModel" value="${esc(server.ai?.model || '')}" placeholder="optional for llama.cpp" list="aiModels" autocapitalize="off" autocorrect="off" spellcheck="false"><datalist id="aiModels"></datalist>`, '<a href="#" id="aiList">List the models on the server</a>')}
          ${field('API key (optional)', `<input id="aiKey" type="password" placeholder="${server.ai?.hasKey ? '•••••• saved (leave blank to keep)' : 'none'}" autocomplete="off">`, server.ai?.hasKey ? '<label><input type="checkbox" id="aiKeyClear"> remove the saved key</label>' : '')}
        </div>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn primary" id="aiSave">Save AI settings</button>
          <button class="btn" id="aiTest">Test the AI judge</button>
          ${server.ai?.fromAdmin && (server.ai?.env?.baseUrl) ? '<button class="btn ghost" id="aiReset">Use the server’s LLM_* settings</button>' : ''}
          <span id="aiResult" class="muted"></span>
        </div>
        <p class="muted small">Saved on the server (DATA_DIR/ai.json), not in the question sets. These win over the LLM_BASE_URL / LLM_MODEL / LLM_API_KEY settings. On Olares, use the model’s <b>Shared entrance</b> address: the normal entrance needs a sign-in, which the quiz server can’t do.</p>
      </div>
      <div class="card">
        <h3>Preview for co-organisers</h3>
        <p>Share <a href="/preview" target="_blank"><b>/preview</b></a>: it lists every question set with the answers, and lets people try the questions, without joining the game. ${server.previewKey ? 'It needs the key in <code>PREVIEW_KEY</code>: share <code>/preview?key=…</code>.' : 'Anyone with the link can open it; set <code>PREVIEW_KEY</code> to lock it.'}</p>
      </div>`;
    const aiOut = (msg, bad) => { const el = $('#aiResult'); el.textContent = msg; el.style.color = bad ? '#FF9AA2' : bad === false ? '#8EF0A8' : ''; };
    const saveAI = async (body) => { const r = await api('PUT', '/api/admin/ai', body); server.ai = r.ai; return r.ai; };
    $('#aiSave').onclick = async () => {
      const body = { baseUrl: $('#aiUrl').value, model: $('#aiModel').value };
      if ($('#aiKey').value) body.apiKey = $('#aiKey').value; else if ($('#aiKeyClear')?.checked) body.apiKey = '';
      try { const ai = await saveAI(body); renderSettings(); aiOut(ai.enabled ? 'Saved. Testing…' : 'Saved. AI judge is off'); if (ai.enabled) $('#aiTest').click(); }
      catch (e) { aiOut(e.message, true); }
    };
    $('#aiTest').onclick = async () => {
      aiOut('Asking the model… (a big model can take a while)');
      try { const r = await api('POST', '/api/admin/ai-test'); r.ok ? aiOut(`✓ Works: it judged two test answers correctly in ${(r.ms / 1000).toFixed(1)}s`, false) : aiOut(r.error ? `✕ ${r.error}` : `✕ It answered, but judged the test wrongly: ${JSON.stringify(r.results)}`, true); }
      catch (e) { aiOut(e.message, true); }
    };
    $('#aiList').onclick = async (e) => {
      e.preventDefault();
      if ($('#aiUrl').value.trim() !== (server.ai?.baseUrl || '')) { aiOut('Save the address first, then list the models', true); return; }
      aiOut('Asking the server for its models…');
      try {
        const r = await api('GET', '/api/admin/ai/models');
        if (!r.ok) return aiOut(`✕ ${r.error}`, true);
        $('#aiModels').innerHTML = r.models.map((m) => `<option value="${esc(m)}">`).join('');
        if (r.models.length === 1 && !$('#aiModel').value) $('#aiModel').value = r.models[0];
        aiOut(r.models.length ? `Models: ${r.models.join(', ')}` : 'The server lists no models (fine for llama.cpp)', false);
      } catch (err) { aiOut(err.message, true); }
    };
    const rs = $('#aiReset'); if (rs) rs.onclick = async () => { try { await saveAI({ clear: true }); renderSettings(); aiOut('Using the server’s LLM_* settings'); } catch (e) { aiOut(e.message, true); } };
    bindInputs($('#settingsTab'));
    $$('#settingsTab input[name="mode"]').forEach((r) => (r.onchange = () => { data.mode = r.value; renderSettings(); markDirty(); }));
    $$('#settingsTab .grow').forEach((row) => row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gact]'); if (!b) return;
      const k = +row.dataset.k, g = data.gamesOnly;
      if (b.dataset.gact === 'on') g[k].on = b.checked;
      else { const to = b.dataset.gact === 'up' ? k - 1 : k + 1; if (to < 0 || to >= g.length) return; g.splice(to, 0, g.splice(k, 1)[0]); }
      renderSettings(); markDirty();
    }));
    $$('#settingsTab [data-pick]').forEach((b) => (b.onclick = () => openPicker(b.dataset.pick)));
    $('#restore').onclick = async () => {
      if (!confirm('Throw away all edits and go back to the original question sets?')) return;
      try { const st = await api('POST', '/api/admin/restore'); server = st; data = clone(st.content); saved = JSON.stringify(data); open.clear(); tab = 'questions'; viewSet = Math.max(0, data.sets.findIndex((x) => x.id === data.activeSet)); render(); toast(st.pending ? 'Restored. Starts with the next game' : 'Original questions restored'); }
      catch (e) { if (e.message !== 'locked') toast(e.message, true); }
    };
  }
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

  // ------------------------------------------------------------------ picture picker
  let pickPath = null;
  function openPicker(path) {
    pickPath = path;
    $('#pickFilter').value = '';
    drawPicks();
    $('#picker').classList.remove('hidden');
  }
  function drawPicks() {
    const f = $('#pickFilter').value.toLowerCase();
    const cur = getAt(pickPath);
    $('#pickGrid').innerHTML = images.filter((s) => s.toLowerCase().includes(f)).map((s) =>
      `<button class="pick ${s === cur ? 'on' : ''}" data-src="${esc(s)}" title="${esc(s)}"><img src="${esc(s)}" loading="lazy" alt=""><span>${esc(s.split('/').pop())}</span></button>`).join('') || '<p class="muted">No pictures match.</p>';
    $$('#pickGrid .pick').forEach((b) => (b.onclick = () => choose(b.dataset.src)));
  }
  function choose(src) {
    setAt(pickPath, src);
    $('#picker').classList.add('hidden');
    render();
  }
  $('#pickFilter').oninput = drawPicks;
  $('#pickClose').onclick = () => $('#picker').classList.add('hidden');
  $('#picker').onclick = (e) => { if (e.target.id === 'picker') $('#picker').classList.add('hidden'); };
  $('#upload').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const r = await api('POST', '/api/admin/upload?name=' + encodeURIComponent(file.name), null, file);
      images.push(r.path); images.sort();
      toast('Photo uploaded');
      choose(r.path);
    } catch (err) { if (err.message !== 'locked') toast(err.message, true); }
    e.target.value = '';
  };

  // ------------------------------------------------------------------ start
  if (key) load().catch((e) => { if (e.message !== 'locked') showLogin(e.message); });
  else showLogin();
  setInterval(async () => {   // keep the game status fresh
    if (!data || document.hidden) return;
    try { const st = await api('GET', '/api/admin/content'); Object.assign(server, { phase: st.phase, players: st.players, pending: st.pending }); renderStatus(); } catch (e) {}
  }, 5000);
})();

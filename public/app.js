/* Screens, identity, nightmare logic and the score boards. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
  const RANDOM_NIGHTMARE = 0.25; // players without the stamp get ~1 nightmare game in 4

  // ------------------------------------------------------------ identity
  // The device id lives in localStorage and (set by the server) in a long-lived cookie.
  let id = store.get('oro_id');
  if (!id || !ID_RE.test(id)) id = '';
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9_-]/g, '');

  const user = {
    name: store.get('oro_name') || '',
    forced: store.get('oro_forced') === '1', // "nightmare only" stamp (decided by the server)
    pref: store.get('oro_pref') === '1',     // voluntary nightmare toggle
    best: Number(store.get('oro_best') || 0),
  };
  const saveUser = () => {
    store.set('oro_id', id); store.set('oro_name', user.name); store.set('oro_forced', user.forced ? '1' : '0');
    store.set('oro_pref', user.pref ? '1' : '0'); store.set('oro_best', String(user.best));
  };
  function applyServerUser(u) {
    id = u.id; user.name = u.name; user.forced = !!u.nightmare;
    user.best = Math.max(Number(u.best) || 0, u.runs ? 0 : user.best);
    saveUser();
  }

  let runMode = 'normal';
  function rollRunMode() {
    runMode = user.forced || user.pref || Math.random() < RANDOM_NIGHTMARE ? 'nightmare' : 'normal';
  }

  async function api(url, body) {
    const r = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(j.error || 'http'); e.status = r.status; throw e; }
    return j;
  }

  let toastT;
  function toast(msg, ms = 2400) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  let current = '';
  function show(sid) {
    current = sid;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === sid));
    if (sid === 'game') { OG.game.resize(); newRun(); }
    else document.body.classList.remove('nm');
  }

  // ------------------------------------------------------------ server sync
  async function sync() {
    try {
      const r = await api('/api/me?id=' + encodeURIComponent(id));
      const wasForced = user.forced;
      applyServerUser(r.user);
      if (wasForced !== user.forced && OG.game.state === 'ready') newRun();
      else renderToggle();
    } catch (e) {
      if (e.status === 404) { // removed by the admin: start over with a new name
        user.name = ''; user.forced = false; user.pref = false; user.best = 0; saveUser();
        store.del('oro_name');
        if (current !== 'game' || OG.game.state !== 'playing') show('welcome');
      }
    }
  }

  // ------------------------------------------------------------ welcome
  $('#nameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#nameInput').value.trim().slice(0, 20);
    if (!name) return;
    $('#nameInput').blur();
    const btn = e.submitter || $('#nameForm button');
    btn.disabled = true;
    try {
      if (!id) id = newId();
      const r = await api('/api/register', { id, name });
      applyServerUser(r.user);
      OG.audio.unlock();
      show('game');
    } catch {
      toast('Geen verbinding. Probeer nog eens.');
    } finally { btn.disabled = false; }
  });

  // ------------------------------------------------------------ game
  const ready = $('#ready'), over = $('#over'), board = $('#board');

  function renderToggle() {
    const t = $('#nmToggle');
    const playing = OG.game.state === 'playing';
    t.classList.toggle('on', user.pref);
    t.style.visibility = user.forced || playing ? 'hidden' : 'visible';
    $('#boardBtn').style.visibility = playing ? 'hidden' : 'visible';
    $('#readyMode').innerHTML = runMode === 'nightmare' ? '<span class="nm-badge">😈 NIGHTMARE</span>' : '';
    $('#bestScore').textContent = user.best;
    document.body.classList.toggle('nm', current === 'game' && runMode === 'nightmare');
  }
  function newRun() {
    over.classList.add('hidden');
    ready.classList.remove('hidden');
    rollRunMode();
    OG.game.reset(runMode);
    renderToggle();
  }

  $('#nmToggle').addEventListener('click', (e) => {
    e.stopPropagation();
    if (OG.game.state === 'playing' || user.forced) return;
    user.pref = !user.pref; saveUser();
    toast(user.pref ? '😈 Nightmare aan. Ge hebt het zelf gezocht.' : 'Nightmare uit.');
    newRun();
  });
  $('#muteBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    OG.audio.setMuted(!OG.audio.muted);
    $('#muteBtn').textContent = OG.audio.muted ? '🔇' : '🔊';
  });
  $('#muteBtn').textContent = OG.audio.muted ? '🔇' : '🔊';

  const cv = $('#cv');
  function tap(e) {
    if (e) e.preventDefault();
    OG.audio.unlock();
    if (OG.game.state === 'dead' || !board.classList.contains('hidden')) return;
    if (OG.game.state === 'ready') { ready.classList.add('hidden'); setTimeout(renderToggle, 0); }
    OG.game.flap();
  }
  cv.addEventListener('pointerdown', tap);
  ready.addEventListener('pointerdown', tap);
  window.addEventListener('keydown', (e) => {
    if (current !== 'game') return;
    if (e.code === 'Escape') return closeBoard();
    if (e.code === 'Space' || e.code === 'ArrowUp') { if (!over.classList.contains('hidden') || !board.classList.contains('hidden')) return; tap(e); }
  });
  $('#againBtn').addEventListener('click', newRun);

  // ------------------------------------------------------------ score boards
  const boardState = { mode: 'all', view: 'best', data: null };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MEDALS = ['🥇', '🥈', '🥉'];

  function renderBoard() {
    document.querySelectorAll('#board [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === boardState.mode));
    document.querySelectorAll('#board [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === boardState.view));
    const list = $('#boardList');
    const d = boardState.data;
    if (!d) { list.innerHTML = '<li class="empty">Laden…</li>'; return; }
    if (d.error) { list.innerHTML = '<li class="empty">Scorebord niet bereikbaar.</li>'; return; }
    const key = (boardState.mode === 'nm' ? 'nm' : '') + (boardState.view === 'best' ? 'Best' : 'Top');
    const rows = d[key.charAt(0).toLowerCase() + key.slice(1)] || [];
    list.innerHTML = rows.map((r, i) => `
      <li class="${r.you ? 'you' : ''}">
        <span class="rk">${MEDALS[i] || i + 1}</span>
        <span class="nm">${esc(r.name)}${boardState.mode === 'all' && r.nightmare ? ' 😈' : ''}</span>
        <span class="sc">${r.score}</span>
      </li>`).join('') || '<li class="empty">Nog geen scores. Wees de eerste!</li>';
  }
  async function openBoard(e) {
    if (e) e.stopPropagation();
    if (OG.game.state === 'playing') return;
    if (runMode === 'nightmare' && !boardState.data) boardState.mode = 'nm';
    boardState.data = null;
    board.classList.remove('hidden');
    renderBoard();
    try { boardState.data = await api('/api/leaderboard?id=' + encodeURIComponent(id)); }
    catch { boardState.data = { error: true }; }
    renderBoard();
  }
  function closeBoard() { board.classList.add('hidden'); }
  $('#boardBtn').addEventListener('click', openBoard);
  $('#overBoardBtn').addEventListener('click', openBoard);
  $('#boardClose').addEventListener('click', closeBoard);
  board.addEventListener('pointerdown', (e) => { if (e.target === board) closeBoard(); e.stopPropagation(); });
  board.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    if (b.dataset.mode) boardState.mode = b.dataset.mode;
    if (b.dataset.view) boardState.view = b.dataset.view;
    renderBoard();
  });

  OG.game.init(cv, {
    active: () => current === 'game',
    onScore: (s) => { $('#score').textContent = s; },
    onHint: (stage) => {
      const card = $('#hintCard');
      if (!stage) { card.classList.add('hidden'); card.querySelector('.hint-art').innerHTML = ''; return; }
      card.querySelector('.hint-art').innerHTML = OG.hintSVG(stage);
      card.classList.remove('hidden');
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    },
    onSong: () => {
      const n = $('#songNote'); n.classList.remove('hidden', 'float'); void n.offsetWidth; n.classList.add('float');
      setTimeout(() => n.classList.add('hidden'), 2400);
    },
    onDeath: (r) => {
      const prev = user.best;
      const record = r.score > prev;
      if (record) { user.best = r.score; saveUser(); }
      $('#overCause').textContent = r.cause;
      $('#overScore').textContent = r.score;
      $('#overMeta').textContent = `${r.feathers} pluimen · ${r.passed} bomen · ${r.seconds} s` + (r.mode === 'nightmare' ? ' · ×2 nightmare' : '');
      $('#overBest').innerHTML = record ? '🏆 <b>Nieuw record!</b>' : `Record: <b>${Math.max(prev, r.score)}</b>`;
      over.classList.remove('hidden');
      renderToggle();
      api('/api/score', { id, score: r.score, nightmare: r.mode === 'nightmare', seconds: r.seconds, feathers: r.feathers, passed: r.passed })
        .then((j) => { if (j.user) applyServerUser(j.user); })
        .catch(() => {});
    },
  });

  // ------------------------------------------------------------ boot
  (async () => {
    if (id && user.name) { show('game'); sync(); return; }
    // localStorage empty: try to recognise this device through its cookie.
    try {
      const r = await api('/api/me');
      applyServerUser(r.user);
      show('game');
    } catch { show('welcome'); }
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user.name && id) sync(); });
})();

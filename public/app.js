/* Screens, identity and the nightmare toggle. One run = one game; nothing is shared. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // ------------------------------------------------------------ identity
  let id = store.get('oro_id');
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9_-]/g, '');
    store.set('oro_id', id);
  }
  const user = {
    name: store.get('oro_name') || '',
    forced: store.get('oro_forced') === '1', // forced nightmare (decided at first registration)
    pref: store.get('oro_pref') === '1', // voluntary nightmare toggle
  };
  const saveUser = () => { store.set('oro_name', user.name); store.set('oro_forced', user.forced ? '1' : '0'); store.set('oro_pref', user.pref ? '1' : '0'); };
  const mode = () => (user.forced || user.pref ? 'nightmare' : 'normal');
  const bestKey = () => (mode() === 'nightmare' ? 'oro_best_nm' : 'oro_best');

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
    document.body.classList.toggle('nm', sid === 'game' && mode() === 'nightmare');
    if (sid === 'game') { OG.game.resize(); newRun(); }
  }

  // ------------------------------------------------------------ server sync
  async function register(name) {
    try {
      const r = await api('/api/register', { id, name });
      user.forced = !!r.user.nightmare;
    } catch {
      user.forced = Math.random() < 1 / 3; // offline fallback, synced later via `restore`
    }
    user.name = name;
    saveUser();
  }
  async function sync() {
    try {
      const r = await api('/api/me?id=' + encodeURIComponent(id));
      if (r.user.nightmare !== user.forced) {
        user.forced = r.user.nightmare;
        saveUser();
        toast(user.forced ? '😈 De admin zette u in nightmare-modus!' : '😇 De admin heeft u bevrijd van nightmare.');
        if (OG.game.state === 'ready') newRun();
      }
    } catch (e) {
      if (e.status === 404) api('/api/register', { id, name: user.name, restore: { nightmare: user.forced } }).catch(() => {});
    }
  }

  // ------------------------------------------------------------ welcome / fate
  $('#nameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#nameInput').value.trim().slice(0, 20);
    if (!name) return;
    $('#nameInput').blur();
    await register(name);
    if (user.forced) { document.querySelector('#fate .who').textContent = name; show('fate'); }
    else show('game');
  });
  $('#fateBtn').addEventListener('click', () => { OG.audio.unlock(); show('game'); });

  // ------------------------------------------------------------ game
  const ready = $('#ready'), over = $('#over');

  function renderToggle() {
    const t = $('#nmToggle');
    t.classList.toggle('on', mode() === 'nightmare');
    t.classList.toggle('locked', user.forced);
    t.style.visibility = OG.game.state === 'playing' ? 'hidden' : 'visible';
    $('#readyMode').innerHTML = mode() === 'nightmare' ? '<span class="nm-badge">😈 NIGHTMARE</span>' : '';
    $('#bestScore').textContent = store.get(bestKey()) || 0;
    document.body.classList.toggle('nm', current === 'game' && mode() === 'nightmare');
  }
  function newRun() {
    over.classList.add('hidden');
    ready.classList.remove('hidden');
    OG.game.reset(mode());
    renderToggle();
  }

  $('#nmToggle').addEventListener('click', (e) => {
    e.stopPropagation();
    if (OG.game.state === 'playing') return;
    if (user.forced) { toast('Nightmare is voor u verplicht. Geen ontsnappen 😈'); return; }
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
    if (OG.game.state === 'dead') return;
    if (OG.game.state === 'ready') { ready.classList.add('hidden'); setTimeout(renderToggle, 0); }
    OG.game.flap();
  }
  cv.addEventListener('pointerdown', tap);
  ready.addEventListener('pointerdown', tap);
  window.addEventListener('keydown', (e) => {
    if (current !== 'game') return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { if (!over.classList.contains('hidden')) return; tap(e); }
  });
  $('#againBtn').addEventListener('click', newRun);

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
      const key = r.mode === 'nightmare' ? 'oro_best_nm' : 'oro_best';
      const prev = Number(store.get(key) || 0);
      const record = r.score > prev;
      if (record) store.set(key, String(r.score));
      $('#overCause').textContent = r.cause;
      $('#overScore').textContent = r.score;
      $('#overMeta').textContent = `${r.feathers} pluimen · ${r.passed} bomen · ${r.seconds} s` + (r.mode === 'nightmare' ? ' · ×2 nightmare' : '');
      $('#overBest').innerHTML = record ? '🏆 <b>Nieuw record!</b>' : `Record: <b>${Math.max(prev, r.score)}</b>`;
      over.classList.remove('hidden');
      renderToggle();
      api('/api/score', { id, score: r.score, nightmare: r.mode === 'nightmare' }).catch(() => {});
    },
  });

  // ------------------------------------------------------------ boot
  if (!user.name) show('welcome');
  else { show('game'); sync(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user.name) sync(); });
})();

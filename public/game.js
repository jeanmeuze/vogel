/* Flyer engine: solo runs, region predators, progressive hints, nightmare chaos. */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});
  const CFG = window.GAME_CONFIG;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;

  // Range countries of the bird (flags appear as a late hint).
  const FLAGS = ['CO', 'EC', 'PE', 'BO', 'VE', 'BR'];
  const FEATHER_COLORS = ['#3d8bfd', '#2fbf71', '#ff6b9a', '#ffffff', '#9b6bff', '#ffd166'];

  const DEATH = {
    tree: ['Tegen een boom geknald.', 'Bonk! Boom.', 'Die boom stond daar al heel de tijd hoor.'],
    vine: ['Verstrikt in de lianen.', 'Lianen 1 – gij 0.'],
    ground: ['Neergestort. Plat als een pannenkoek.', 'Even uitrusten op de grond… voor altijd.'],
    ceiling: ['Tegen het bladerdak gevlogen.'],
    harpy: ['Meegenomen door een harpij.', 'Een harpij had honger.'],
    boa: ['Een boa had u graag.', 'Ingeslikt door een boa.'],
    monkey: ['Een aap heeft u gepakt.', 'Apenstreken!'],
    toucan: ['Geramd door een toekan.'],
    jaguar: ['Een jaguar sprong net hoog genoeg.'],
    lightning: ['Geëlektrocuteerd. ⚡', 'Krak! Gefrituurd door de bliksem.'],
    ufo: ['Ontvoerd door aliens. 👽', 'Ze kwamen in vrede… en namen u mee.'],
    cow: ['Geplet door een vallende koe. Ja echt.', 'Moe! 🐄'],
    coconut: ['Kokosnoot op uw kop.'],
    wasp: ['Dat was geen pluim… dat waren wespen!', 'Gestoken! 🐝'],
    log: ['Omvallende boom. Timber!'],
  };

  const CURSES = {
    heavy: '🪨 Zware vleugels',
    moving: '🎢 Dansende bomen',
    wind: '🌬️ Tegenwind',
    narrow: '🤏 Smalle gaten',
    fog: '🌫️ Mist',
    shy: '🪶 Schuwe pluimen',
    fast: '💨 Haast',
  };

  let cv, ctx, W = 0, H = 0, DPR = 1, clock = 0, hooks = {};
  let g = null;

  // ---------------------------------------------------------------- setup
  function init(canvas, h) {
    cv = canvas; ctx = cv.getContext('2d'); hooks = h || {};
    window.addEventListener('resize', resize);
    resize();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (W && g && hooks.active && hooks.active()) { update(dt); draw(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!g || g.state === 'ready') reset(g ? g.mode : 'normal');
  }

  const groundY = () => H * 0.93;
  const P = () => (g.mode === 'nightmare' ? CFG.nightmare : CFG.normal);
  const curse = (k) => g.curses.includes(k);

  function reset(mode) {
    const nm = mode === 'nightmare';
    let curses = [];
    if (nm) {
      const [a, b] = CFG.nightmare.curses;
      const n = Math.floor(rand(a, b + 1));
      curses = Object.keys(CURSES).sort(() => Math.random() - 0.5).slice(0, n);
    }
    g = {
      mode, state: 'ready', t: 0, dist: 0, feathers: 0, passed: 0, score: 0,
      bird: { x: W * 0.3, homeX: W * 0.3, y: H * 0.5, vy: 0, r: Math.max(13, H * 0.026), flap: 0, rot: 0, scale: 1, hidden: false },
      obs: [], fea: [], preds: [], fx: [], parts: [], banners: [], rain: [],
      sinceObs: 0, lastC: 0.55, shake: 0, flash: 0,
      e: { storm: 0, flip: 0, dark: 0, quake: 0, turbo: 0, drunk: 0, mirror: 0, big: 0 },
      wind: 0, stormPow: 0, ufo: null, cocoRain: 0, cocoRate: 0, cocoAcc: 0, waspT: 0,
      pending: { topple: 0, snap: 0, crusher: 0 }, flapQueue: [],
      curses, nextEvent: 3 + rand(0, 2), nextPred: P0(mode).predatorsFrom, lastEvent: '',
      hintStage: 0, nextSong: 0, flagsOn: false, cause: null, carry: null, deadT: 0,
    };
    if (hooks.onHint) hooks.onHint(0);
    if (hooks.onScore) hooks.onScore(0);
  }
  const P0 = (mode) => (mode === 'nightmare' ? CFG.nightmare : CFG.normal);

  function start() {
    if (g.state !== 'ready') return;
    g.state = 'playing';
    g.sinceObs = spacing() * 0.35;
    if (g.mode === 'nightmare') {
      banner('😈 NIGHTMARE', 1.6, '#ff3b5c');
      if (g.curses.length) setTimeout(() => g && g.state === 'playing' && banner(g.curses.map((c) => CURSES[c]).join('  ·  '), 2.6, '#ffd166', true), 900);
    }
  }

  function flap() {
    if (!g) return;
    if (g.state === 'ready') start();
    if (g.state !== 'playing') return;
    if (g.e.drunk > 0) { g.flapQueue.push(g.t + 0.2); return; }
    doFlap();
  }
  function doFlap() {
    const dir = g.e.flip > 0 ? -1 : 1;
    g.bird.vy = -CFG.physics.flap * H * dir * (curse('heavy') ? 0.95 : 1);
    g.bird.flap = 0.25;
    OG.audio && OG.audio.sfx('flap');
  }

  // ---------------------------------------------------------------- helpers
  const speedBase = () => clamp(P().baseSpeed + P().speedRamp * g.t + (curse('fast') ? 0.06 : 0), 0, P().maxSpeed + (curse('fast') ? 0.06 : 0)) * H;
  const spacing = () => Math.max(P().spacing * H, W * 0.55);
  const obsW = () => Math.min(H * 0.11, W * 0.2);
  const intensity = () => 1 + g.t / 45;
  const ramp = (pair, rs) => lerp(pair[0], pair[1], clamp(g.t / (rs || 90), 0, 1));

  function banner(text, dur = 1.6, color = '#fff', small = false) {
    g.banners.push({ text, t: dur, max: dur, color, small });
  }
  function burst(x, y, color, n = 10, sp = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 40 + Math.random() * sp;
      g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color, r: 2 + Math.random() * 3 });
    }
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  // ---------------------------------------------------------------- spawning
  function spawnObstacle(x = W + 10) {
    const p = P();
    const gap = Math.max(p.minGap, p.startGap - p.gapShrink * g.t - (curse('narrow') ? 0.035 : 0)) * H;
    const w = obsW();
    const top = H * 0.14, bot = groundY() - H * 0.05;
    let c = g.lastC + rand(-0.35, 0.35);
    c = clamp(c * H, top + gap / 2, bot - gap / 2) / H;
    g.lastC = c;
    const o = {
      x, w, cy: c * H, gap, top: 0, bot: 0, kind: Math.random() < 0.25 ? 'nest' : 'vine',
      phase: rand(0, TAU), move: curse('moving') ? rand(0.04, 0.08) * H : 0,
      angle: 0, av: 0, topple: null, L: 0, warnT: 0, drop: 0, dropV: 0, snap: null, breath: false,
      flag: g.flagsOn && Math.random() < 0.75 ? pick(FLAGS) : null, passed: false,
    };
    if (g.pending.topple > 0) { o.topple = 'armed'; g.pending.topple--; }
    else if (g.pending.snap > 0) { o.snap = 'armed'; g.pending.snap--; }
    else if (g.pending.crusher > 0) { o.breath = true; g.pending.crusher--; }
    g.obs.push(o);
    if (Math.random() < p.featherChance) addFeather(o.x + w / 2, o.cy + rand(-0.17, 0.17) * gap);
    if (Math.random() < p.bonusFeatherChance) addFeather(o.x + w / 2 + spacing() / 2, rand(top, bot));
  }
  function addFeather(x, y) {
    g.fea.push({ x, y, color: pick(FEATHER_COLORS), ph: rand(0, TAU), wasp: g.waspT > 0, revealed: false, vx: 0, vy: 0 });
  }

  // Snakes hang in the open space between two trees, somewhere in its middle half
  // (25%..75%), never right against a tree. Trees and snakes scroll at the same speed,
  // so the position is fixed at spawn: between the newest tree and the next one
  // (which will appear one `spacing()` further), or one gap later if that spot is
  // already on screen.
  function boaX() {
    const last = g.obs[g.obs.length - 1];
    if (!last) return W + 30;
    const sp = spacing();
    for (let k = 0; ; k++) { // k-th gap after the newest tree
      const from = last.x + k * sp + (k === 0 ? last.w : obsW()), to = last.x + (k + 1) * sp;
      if (lerp(from, to, 0.25) >= W + 30) return lerp(from, to, rand(0.25, 0.75));
    }
  }
  const PRED_TYPES = ['harpy', 'harpy', 'boa', 'boa', 'monkey', 'monkey', 'toucan', 'toucan', 'jaguar'];
  function spawnPredator(type) {
    type = type || pick(PRED_TYPES);
    const s = H;
    if (type === 'harpy') g.preds.push({ type, phase: 'warn', t: 0.9, x: W + 40, y: rand(0.08, 0.25) * s, vx: 0, vy: 0, r: s * 0.035 });
    else if (type === 'boa') g.preds.push({ type, x: boaX(), len: rand(0.12, 0.26) * s, rest: 0, phase: 'idle', hold: 0, r: s * 0.028 });
    else if (type === 'monkey') g.preds.push({ type, x: W + 40, L: rand(0.26, 0.42) * s, amp: rand(0.6, 0.95), w: rand(1.8, 2.6), ph: rand(0, TAU), r: s * 0.038, bx: 0, by: 0 });
    else if (type === 'toucan') g.preds.push({ type, x: W + 40, y0: clamp(g.bird.y + rand(-0.15, 0.15) * s, s * 0.15, groundY() - s * 0.1), y: 0, ph: rand(0, TAU), extra: rand(0.25, 0.4) * s, r: s * 0.03 });
    else if (type === 'jaguar') g.preds.push({ type, x: W + 40, y: groundY() - s * 0.035, vy: 0, phase: 'lurk', r: s * 0.04 });
    const last = g.preds[g.preds.length - 1];
    if (last) last.type === 'boa' && (last.rest = last.len);
  }

  // ---------------------------------------------------------------- nightmare events
  const EVENTS = {
    lightning: { w: 3, start(I) {
      const n = Math.min(5, 1 + Math.floor(I));
      for (let i = 0; i < n; i++) {
        const x = clamp(g.bird.homeX + rand(-0.05, 0.25) * W, 20, W - 20);
        const tip = rand(0.35, 0.82) * H;
        const pts = [];
        for (let y = 0; y < tip; y += 18) pts.push([x + rand(-14, 14), y]);
        pts.push([x, tip]);
        g.fx.push({ type: 'bolt', x, tip, pts, delay: i * 0.65, warn: 1.0, strike: 0.22 });
      }
      banner('⚡ ONWEER!', 1.2, '#ffe14d');
    } },
    storm: { w: 3, cond: () => g.e.storm <= 0, start(I) { g.e.storm = rand(5, 8); g.stormPow = clamp(0.55 + 0.2 * I, 0.6, 1.25); banner('🌪️ STORM!', 1.4, '#cfe8ff'); } },
    ufo: { w: 2, cond: () => !g.ufo, start() {
      g.ufo = { x: W + 80, y: H * 0.12, phase: 'enter', t: 0, dur: rand(6, 8), beam: false, beamT: 0, cow: false };
      banner('🛸 ALIENS!', 1.4, '#8ff0ff'); OG.audio && OG.audio.sfx('ufo');
    } },
    flip: { w: 2, cond: () => g.e.flip <= 0, start() { g.e.flip = 5; banner('🙃 ALLES OMGEKEERD!', 1.4, '#ffb3ff'); } },
    dark: { w: 2, cond: () => g.e.dark <= 0, start() { g.e.dark = rand(5, 7); banner('🌑 LICHTEN UIT', 1.2, '#fff'); } },
    quake: { w: 2, start() { g.e.quake = 5; banner('🌋 AARDBEVING!', 1.3, '#ffb37a'); } },
    turbo: { w: 2, start() { g.e.turbo = 4; banner('🚀 TURBO!', 1.1, '#9dff9d'); } },
    drunk: { w: 2, start() { g.e.drunk = 6; banner('🍹 DUIZELIG…', 1.3, '#ffd1f5'); } },
    mirror: { w: 1, cond: () => g.e.mirror <= 0, start() { g.e.mirror = 5; banner('🪞 SPIEGELWERELD', 1.3, '#d6f3ff'); } },
    coconuts: { w: 2, start(I) { g.cocoRain = 5; g.cocoRate = 1.4 + I; banner('🥥 KOKOSREGEN!', 1.2, '#f1d3a0'); } },
    wasps: { w: 2, start() { g.waspT = 7; } }, // silent on purpose
    balloon: { w: 1, start() { g.e.big = 5; banner('🎈 OPGEBLAZEN!', 1.2, '#ffc2c2'); } },
    topple: { w: 3, start(I) { g.pending.topple += 2 + Math.floor(I / 2); } }, // silent
    snap: { w: 2, start() { g.pending.snap += 2; } }, // silent
    crusher: { w: 2, start() { g.pending.crusher += 2; } }, // silent
    swarm: { w: 1, start() { for (let i = 0; i < 3; i++) setTimeout(() => g && g.state === 'playing' && spawnPredator(), i * 450); banner('🐾 ZE KOMEN!', 1.2, '#ffcf8a'); } },
  };
  function triggerEvent() {
    const pool = [];
    for (const [k, ev] of Object.entries(EVENTS)) {
      if (k === g.lastEvent) continue;
      if (ev.cond && !ev.cond()) continue;
      for (let i = 0; i < ev.w; i++) pool.push(k);
    }
    const k = pick(pool);
    g.lastEvent = k;
    EVENTS[k].start(intensity());
  }

  // ---------------------------------------------------------------- update
  // Debug helpers, only on localhost: ?god = invincible
  const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const GOD = DEV && /[?&]god\b/.test(location.search);

  function die(cause, carry) {
    if (g.state !== 'playing') return;
    if (GOD) { g.shake = 6; return; }
    g.state = 'dead'; g.cause = cause; g.carry = carry || null; g.deadT = 0;
    g.shake = 14; g.flapQueue = [];
    burst(g.bird.x, g.bird.y, '#ffffff', 14);
    if (navigator.vibrate) navigator.vibrate(80);
    OG.audio && OG.audio.sfx('die');
    const res = { score: g.score, feathers: g.feathers, passed: g.passed, seconds: Math.round(g.t), mode: g.mode, cause: pick(DEATH[cause] || DEATH.tree) };
    setTimeout(() => hooks.onDeath && hooks.onDeath(res), 1100);
  }

  function updateHints() {
    const h = CFG.hints;
    const stage = g.t >= h.full ? 5 : g.t >= h.head ? 4 : g.t >= h.back ? 3 : g.t >= h.bill ? 2 : g.t >= h.tail ? 1 : 0;
    if (stage !== g.hintStage) { g.hintStage = stage; hooks.onHint && hooks.onHint(stage); }
    if (!g.flagsOn && g.t >= h.flags) g.flagsOn = true;
    if (g.t >= h.sound && g.t >= g.nextSong) { g.nextSong = g.t + 14; OG.audio && OG.audio.song(); hooks.onSong && hooks.onSong(); }
  }

  function update(dt) {
    clock += dt;
    const b = g.bird;
    const gy = groundY();

    if (g.state === 'ready') {
      b.y = H * 0.5 + Math.sin(clock * 3) * H * 0.015;
      g.dist += H * 0.12 * dt;
      b.flap = Math.sin(clock * 10) > 0 ? 0.1 : 0;
      b.rot = 0;
      tickParticles(dt);
      return;
    }

    if (g.state === 'playing') {
      g.t += dt;
      updateHints();
      const e = g.e;
      for (const k in e) e[k] = Math.max(0, e[k] - dt);
      g.waspT = Math.max(0, g.waspT - dt);

      // wind (storm or curse) -> scroll slows, stops or reverses; bird gets pushed back
      const windTarget = e.storm > 0 ? g.stormPow : curse('wind') ? 0.25 : 0;
      g.wind += (windTarget - g.wind) * Math.min(1, dt * 1.5);
      const scrollMul = (1 - 1.25 * g.wind) * (e.turbo > 0 ? 1.7 : 1);
      const v = speedBase() * scrollMul;
      g.dist += v * dt;

      // bird physics
      const flip = e.flip > 0;
      const grav = CFG.physics.gravity * H * (curse('heavy') ? 1.22 : 1) * (flip ? -1 : 1);
      b.vy = clamp(b.vy + grav * dt, -CFG.physics.maxFall * H, CFG.physics.maxFall * H);
      if (e.storm > 0) b.vy += Math.sin(clock * 2.3) * g.wind * 1.1 * H * dt;
      if (g.flapQueue.length && g.flapQueue[0] <= g.t) { g.flapQueue.shift(); doFlap(); }
      b.y += b.vy * dt;
      b.flap = Math.max(0, b.flap - dt);
      b.x -= g.wind * 0.22 * H * dt;
      if (g.wind < 0.3) b.x += (b.homeX - b.x) * 0.9 * dt;
      b.x = clamp(b.x, b.r + 2, W * 0.6);
      b.scale += ((e.big > 0 ? 1.9 : 1) - b.scale) * Math.min(1, dt * 4);
      const R = b.r * b.scale, hr = R * 0.78;
      if (flip) { if (b.y - hr < 0) return die('ceiling'); if (b.y > gy - R) { b.y = gy - R; b.vy = 0; } }
      else { if (b.y < R) { b.y = R; b.vy = 0; } if (b.y + hr > gy) return die('ground'); }

      // spawn
      // The next tree comes exactly spacing() after the newest one (also after being blown
      // backwards), so snakes placed in the gap ahead (boaX) stay where they belong.
      const lastObs = g.obs[g.obs.length - 1];
      if (lastObs) { if (lastObs.x + spacing() <= W + 10) spawnObstacle(lastObs.x + spacing()); }
      else if (v > 0) { g.sinceObs += v * dt; if (g.sinceObs >= spacing()) { g.sinceObs = 0; spawnObstacle(); } }
      const pf = P().predatorsFrom;
      if (g.t >= pf && g.t >= g.nextPred) { spawnPredator(); g.nextPred = g.t + ramp(P().predatorEvery, 90) * rand(0.75, 1.25); }
      if (g.mode === 'nightmare' && g.t >= g.nextEvent) { triggerEvent(); g.nextEvent = g.t + ramp(CFG.nightmare.eventEvery, CFG.nightmare.rampSeconds) * rand(0.7, 1.25); }
      if (g.cocoRain > 0) {
        g.cocoRain -= dt; g.cocoAcc += g.cocoRate * dt;
        while (g.cocoAcc >= 1) { g.cocoAcc--; g.fx.push({ type: 'coco', x: rand(b.x - 0.05 * W, W * 1.05), y: -20, vy: rand(0, 0.2) * H, r: H * 0.022, rot: 0 }); }
      }

      // obstacles
      for (const o of g.obs) {
        o.x -= v * dt;
        let dy = o.move ? Math.sin(g.t * 1.6 + o.phase) * o.move : 0;
        if (e.quake > 0) dy += Math.sin(clock * 9 + o.phase) * H * 0.045;
        const gapNow = o.breath ? o.gap * (0.5 + 0.5 * (0.5 + 0.5 * Math.cos(g.t * 2.4 + o.phase))) : o.gap;
        o.top = o.cy + dy - gapNow / 2;
        o.bot = o.cy + dy + gapNow / 2;
        const ahead = o.x - b.x;
        if (o.topple === 'armed' && ahead < H * 0.42) { o.topple = 'warn'; o.warnT = 0.35; o.L = gy - o.bot; OG.audio && OG.audio.sfx('warn'); }
        if (o.topple === 'warn') { o.warnT -= dt; if (o.warnT <= 0) o.topple = 'fall'; }
        if (o.topple === 'fall') { o.av += 7 * dt; o.angle -= o.av * dt; if (o.angle <= -1.45) { o.angle = -1.45; o.topple = 'down'; g.shake = Math.max(g.shake, 8); } }
        if (o.snap === 'armed' && ahead < H * 0.5) { o.snap = 'fall'; OG.audio && OG.audio.sfx('warn'); }
        if (o.snap === 'fall') { o.dropV += 2.6 * H * dt; o.drop += o.dropV * dt; }
        if (!o.passed && o.x + o.w < b.x) { o.passed = true; g.passed++; }
        // collisions
        const toppled = o.topple === 'fall' || o.topple === 'down';
        if (toppled) {
          const px = o.x + o.w / 2, ax = px + Math.sin(o.angle) * o.L, ay = gy - Math.cos(o.angle) * o.L;
          if (segDist(b.x, b.y, px, gy, ax, ay) < hr + o.w * 0.3) return die('log');
        } else if (b.x + hr > o.x && b.x - hr < o.x + o.w && b.y + hr > o.bot) return die('tree');
        const blockTop = o.drop, blockBot = o.top + o.drop;
        if (blockBot > 0 && b.x + hr > o.x && b.x - hr < o.x + o.w && b.y - hr < blockBot && b.y + hr > blockTop) return die('vine');
      }
      g.obs = g.obs.filter((o) => o.x + o.w > -H * 0.6 && o.x < W * 2.5);

      // feathers
      const cr = R + H * 0.03;
      for (const f of g.fea) {
        f.x -= v * dt;
        if (curse('shy')) { const d = f.y - b.y; if (Math.abs(f.x - b.x) < H * 0.2) f.y += Math.sign(d || 1) * H * 0.12 * dt; }
        if (f.wasp && !f.revealed && f.x - b.x < W * 0.32) { f.revealed = true; OG.audio && OG.audio.sfx('warn'); }
        if (f.wasp && f.revealed) { f.vy += Math.sign(b.y - f.y) * H * 0.8 * dt; f.vy = clamp(f.vy, -H * 0.3, H * 0.3); f.y += f.vy * dt; f.x -= H * 0.12 * dt; }
        if (!f.taken && Math.hypot(f.x - b.x, f.y - b.y) < (f.wasp ? hr + H * 0.02 : cr)) {
          if (f.wasp) return die('wasp');
          f.taken = true; g.feathers++;
          burst(f.x, f.y, f.color, 9);
          g.parts.push({ x: f.x, y: f.y, vx: 0, vy: -70, life: 0.8, max: 0.8, text: '+1' });
          OG.audio && OG.audio.sfx('feather');
        }
      }
      g.fea = g.fea.filter((f) => f.x > -40 && f.x < W * 2.5 && !f.taken);

      // predators
      for (const p of g.preds) {
        if (updatePredator(p, v, dt, b, hr)) return;
      }
      g.preds = g.preds.filter((p) => !p.gone);

      // fx
      for (const f of g.fx) {
        if (f.type === 'bolt') {
          if (f.delay > 0) { f.delay -= dt; continue; }
          if (f.warn > 0) { f.warn -= dt; if (f.warn <= 0) { g.flash = 1; g.shake = Math.max(g.shake, 10); OG.audio && OG.audio.sfx('thunder'); } continue; }
          f.strike -= dt;
          if (Math.abs(b.x - f.x) < hr + H * 0.022 && b.y - hr < f.tip) return die('lightning');
          if (f.strike <= 0) f.gone = true;
        } else if (f.type === 'coco' || f.type === 'cow') {
          f.x -= v * dt; f.vy += 2 * H * dt; f.y += f.vy * dt; f.rot += dt * (f.type === 'cow' ? 3 : 6);
          if (Math.hypot(f.x - b.x, f.y - b.y) < hr + f.r) return die(f.type === 'cow' ? 'cow' : 'coconut');
          if (f.y > gy) { f.gone = true; burst(f.x, gy, f.type === 'cow' ? '#ffffff' : '#7a4a22', 8); }
        }
      }
      g.fx = g.fx.filter((f) => !f.gone);

      if (g.ufo && updateUfo(dt, b, hr)) return;

      g.score = Math.round((g.feathers + g.passed) * (g.mode === 'nightmare' ? CFG.nightmare.scoreMultiplier : 1));
      hooks.onScore && hooks.onScore(g.score);
    } else if (g.state === 'dead') {
      g.deadT += dt;
      if (g.carry) { // carried away by a harpy / ufo
        b.x = g.carry.x; b.y = g.carry.y + H * 0.03;
        if (g.carry.type === 'harpy') { g.carry.x += g.carry.vx * dt * 0.6; g.carry.y += -H * 0.5 * dt; }
        else { g.carry.y -= H * 0.4 * dt; b.scale = Math.max(0.05, b.scale - dt * 0.8); }
      } else {
        b.vy = Math.min(b.vy + CFG.physics.gravity * H * dt, CFG.physics.maxFall * H);
        b.y = Math.min(b.y + b.vy * dt, groundY() - b.r * 0.6);
      }
      for (const f of g.fx) if (f.type === 'bolt' && f.warn <= 0) f.strike -= dt;
    }
    b.rot = clamp(b.vy / (H * 1.1), -0.5, 1) * 0.9 * (g.e.flip > 0 ? -1 : 1);
    tickParticles(dt);
    g.shake = Math.max(0, g.shake - dt * 40);
    if (g.e.quake > 0) g.shake = Math.max(g.shake, 5);
    g.flash = Math.max(0, g.flash - dt * 3);
    for (const bn of g.banners) bn.t -= dt;
    g.banners = g.banners.filter((bn) => bn.t > 0);
  }

  function tickParticles(dt) {
    for (const p of g.parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 200 * dt; p.life -= dt; }
    g.parts = g.parts.filter((p) => p.life > 0);
  }

  function updatePredator(p, v, dt, b, hr) {
    const gy = groundY();
    if (p.type === 'harpy') {
      if (p.phase === 'warn') {
        p.t -= dt;
        if (p.t <= 0) {
          p.phase = 'dive';
          const tx = b.x + rand(-0.02, 0.06) * W, ty = b.y + b.vy * 0.25;
          const d = Math.hypot(tx - p.x, ty - p.y) || 1, sp = H * (g.mode === 'nightmare' ? 1.3 : 1.05);
          p.vx = ((tx - p.x) / d) * sp; p.vy = ((ty - p.y) / d) * sp;
        }
      } else { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < -80 || p.y > H + 80 || p.y < -100) p.gone = true; }
      if (p.phase === 'dive' && Math.hypot(p.x - b.x, p.y - b.y) < hr + p.r) { die('harpy', p); return true; }
    } else if (p.type === 'boa') {
      p.x -= v * dt;
      const near = p.x - b.x < H * 0.14 && p.x - b.x > -H * 0.08;
      if (p.phase === 'idle' && near) { p.phase = 'strike'; p.target = clamp(b.y + H * 0.05, p.rest, g.mode === 'nightmare' ? gy - 10 : H * 0.5); } // normal: snakes reach halfway at most
      if (p.phase === 'strike') { p.len += H * 2.3 * dt; if (p.len >= p.target) { p.len = p.target; p.phase = 'hold'; p.hold = 0.3; } }
      else if (p.phase === 'hold') { p.hold -= dt; if (p.hold <= 0) p.phase = 'back'; }
      else if (p.phase === 'back') { p.len = Math.max(p.rest, p.len - H * 0.8 * dt); }
      const hx = p.x + Math.sin(clock * 3) * 4;
      if (Math.hypot(hx - b.x, p.len - b.y) < hr + p.r || segDist(b.x, b.y, p.x, 0, hx, p.len) < hr + H * 0.01) { die('boa'); return true; }
      if (p.x < -60) p.gone = true;
    } else if (p.type === 'monkey') {
      p.x -= v * dt;
      const a = Math.sin(clock * p.w + p.ph) * p.amp;
      p.bx = p.x + Math.sin(a) * p.L; p.by = Math.cos(a) * p.L;
      if (Math.hypot(p.bx - b.x, p.by - b.y) < hr + p.r) { die('monkey'); return true; }
      if (p.x < -p.L - 40) p.gone = true;
    } else if (p.type === 'toucan') {
      p.x -= (v + p.extra) * dt;
      p.y = p.y0 + Math.sin(clock * 4 + p.ph) * H * 0.03;
      if (Math.hypot(p.x - b.x, p.y - b.y) < hr + p.r || Math.hypot(p.x - H * 0.045 - b.x, p.y - b.y) < hr + p.r * 0.6) { die('toucan'); return true; }
      if (p.x < -80) p.gone = true;
    } else if (p.type === 'jaguar') {
      p.x -= v * dt;
      if (p.phase === 'lurk' && p.x - b.x < H * 0.3) { p.phase = 'leap'; const h = Math.max(H * 0.15, gy - b.y + H * 0.04); p.vy = -Math.sqrt(2 * 2.6 * H * h); }
      if (p.phase === 'leap') { p.vy += 2.6 * H * dt; p.y += p.vy * dt; if (p.y >= gy - H * 0.035) { p.y = gy - H * 0.035; p.phase = 'done'; } }
      if (Math.hypot(p.x - b.x, p.y - b.y) < hr + p.r) { die('jaguar'); return true; }
      if (p.x < -80) p.gone = true;
    }
    return false;
  }

  function updateUfo(dt, b, hr) {
    const u = g.ufo;
    u.t += dt;
    if (u.phase === 'enter') { u.x += (b.x + W * 0.08 - u.x) * Math.min(1, dt * 2); if (u.t > 1.2) u.phase = 'hover'; }
    else if (u.phase === 'hover') {
      u.x += (b.x + Math.sin(u.t * 1.3) * W * 0.12 - u.x) * Math.min(1, dt * 1.1);
      u.beamT += dt;
      u.beam = u.beamT % 2.6 < 1.6;
      if (!u.cow && u.t > u.dur * 0.5) { u.cow = true; g.fx.push({ type: 'cow', x: u.x, y: u.y + 20, vy: 0, r: H * 0.045, rot: 0 }); }
      if (u.t > u.dur) u.phase = 'leave';
    } else { u.y -= H * 0.8 * dt; u.x -= W * 0.4 * dt; if (u.y < -80) { g.ufo = null; return false; } }
    if (u.beam && u.phase === 'hover') {
      const halfW = lerp(H * 0.035, H * 0.13, clamp((b.y - u.y) / (groundY() - u.y), 0, 1));
      if (Math.abs(b.x - u.x) < halfW && b.y > u.y) {
        b.vy -= 3.4 * H * dt;
        b.x += (u.x - b.x) * dt * 1.5;
        if (b.y < u.y + H * 0.05) { die('ufo', u); return true; }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- drawing
  function blobs(off, baseY, color, step, amp) {
    ctx.fillStyle = color;
    const i0 = Math.floor(off / step) - 1;
    for (let i = i0; i < i0 + W / step + 3; i++) {
      const x = i * step - off;
      ctx.beginPath(); ctx.arc(x, baseY - hash(i + 77) * amp, step * (0.65 + hash(i) * 0.6), 0, TAU); ctx.fill();
    }
    ctx.fillRect(0, baseY, W, H - baseY);
  }

  function drawBackground() {
    const nm = g.mode === 'nightmare';
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (nm) { sky.addColorStop(0, '#2a1638'); sky.addColorStop(0.55, '#6b2d4f'); sky.addColorStop(1, '#e0765a'); }
    else { sky.addColorStop(0, '#86d3cf'); sky.addColorStop(0.55, '#d6f1cf'); sky.addColorStop(1, '#fff0c2'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * 0.8, H * 0.22, 0, W * 0.8, H * 0.22, H * 0.3);
    sun.addColorStop(0, nm ? 'rgba(255,90,90,.75)' : 'rgba(255,240,180,.95)'); sun.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    if (nm) { ctx.fillStyle = '#ffd9d9'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.22, H * 0.05, 0, TAU); ctx.fill(); }

    const o1 = g.dist * 0.06;
    ctx.fillStyle = nm ? '#4a2440' : '#b4dfb3';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, H * 0.6 + Math.sin((x + o1) / (H * 0.22)) * H * 0.04 + Math.sin((x + o1) / (H * 0.09)) * H * 0.015);
    ctx.lineTo(W, H); ctx.fill();

    const o2 = g.dist * 0.3, ls = H * 0.18;
    ctx.strokeStyle = nm ? 'rgba(20,10,20,.4)' : 'rgba(47,122,79,.35)'; ctx.lineWidth = 3;
    for (let i = Math.floor(o2 / ls) - 1; i < Math.floor(o2 / ls) + W / ls + 2; i++) {
      if (hash(i * 3.1) < 0.45) continue;
      const x = i * ls - o2, len = H * (0.15 + hash(i) * 0.35);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(clock + i) * 6 + 10, len / 2, x, len); ctx.stroke();
    }
    blobs(g.dist * 0.2, H * 0.7, nm ? '#3b2a3f' : '#7cc88c', H * 0.09, H * 0.05);
    blobs(g.dist * 0.45, H * 0.8, nm ? '#24302a' : '#47a066', H * 0.075, H * 0.05);
  }

  function drawCanopy() {
    const off = g.dist * 0.8, step = H * 0.08;
    ctx.fillStyle = g.mode === 'nightmare' ? '#121a14' : '#21603f';
    const i0 = Math.floor(off / step) - 1;
    for (let i = i0; i < i0 + W / step + 3; i++) {
      const x = i * step - off;
      ctx.beginPath(); ctx.arc(x, -step * 0.25 + hash(i + 5) * step * 0.35, step * (0.6 + hash(i) * 0.5), 0, TAU); ctx.fill();
    }
  }
  function drawGround() {
    const gy = groundY(), nm = g.mode === 'nightmare';
    ctx.fillStyle = nm ? '#1d2a20' : '#2b6b45'; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = nm ? '#2c3f2f' : '#3f8f58'; ctx.fillRect(0, gy, W, 5);
    const off = g.dist, step = 22;
    for (let i = Math.floor(off / step) - 1; i < Math.floor(off / step) + W / step + 2; i++) {
      const x = i * step - off, h = 6 + hash(i) * 10;
      ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.lineTo(x + 5, gy - h); ctx.lineTo(x + 10, gy + 2); ctx.fill();
    }
  }
  function leaf(x, y, s, a, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  function drawFlag(code, x, y, w, h) {
    const wave = (i) => Math.sin(clock * 6 + i * 0.8 + x * 0.05) * h * 0.08;
    ctx.save();
    ctx.strokeStyle = '#5b4126'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 2.2); ctx.stroke();
    ctx.translate(x + 1, y - h * 2.2);
    // draw flag as vertical strips so it waves
    const N = 8, sw = w / N;
    for (let i = 0; i < N; i++) {
      ctx.save(); ctx.translate(i * sw, wave(i));
      ctx.beginPath(); ctx.rect(0, 0, sw + 0.6, h); ctx.clip();
      ctx.translate(-i * sw, 0);
      paintFlag(code, w, h);
      ctx.restore();
    }
    ctx.restore();
  }
  function paintFlag(c, w, h) {
    const band = (cols, vertical) => cols.forEach((col, i) => { ctx.fillStyle = col; vertical ? ctx.fillRect((w / cols.length) * i, 0, w / cols.length + 0.5, h) : ctx.fillRect(0, (h / cols.length) * i, w, h / cols.length + 0.5); });
    if (c === 'CO' || c === 'EC') {
      ctx.fillStyle = '#fcd116'; ctx.fillRect(0, 0, w, h / 2); ctx.fillStyle = '#003893'; ctx.fillRect(0, h / 2, w, h / 4); ctx.fillStyle = '#ce1126'; ctx.fillRect(0, h * 0.75, w, h / 4 + 0.5);
      if (c === 'EC') { ctx.fillStyle = '#8a6a2a'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, h * 0.16, h * 0.2, 0, 0, TAU); ctx.fill(); }
    } else if (c === 'PE') band(['#d91023', '#ffffff', '#d91023'], true);
    else if (c === 'BO') band(['#d52b1e', '#f9e300', '#007934']);
    else if (c === 'VE') {
      band(['#ffcc00', '#00247d', '#cf142b']);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 8); ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * h * 0.28, h * 0.62 + Math.sin(a) * h * 0.28, h * 0.035, 0, TAU); ctx.fill(); }
    } else if (c === 'BR') {
      ctx.fillStyle = '#009c3b'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffdf00'; ctx.beginPath(); ctx.moveTo(w * 0.08, h / 2); ctx.lineTo(w / 2, h * 0.1); ctx.lineTo(w * 0.92, h / 2); ctx.lineTo(w / 2, h * 0.9); ctx.fill();
      ctx.fillStyle = '#002776'; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.24, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, w, h);
  }

  function drawObstacle(o) {
    const gy = groundY(), x = o.x, w = o.w, nm = g.mode === 'nightmare';
    // --- bottom trunk (can topple)
    const L = o.topple === 'fall' || o.topple === 'down' ? o.L : gy - o.bot;
    ctx.save();
    ctx.translate(x + w / 2, gy);
    let ang = o.angle;
    if (o.topple === 'warn') ang = Math.sin(clock * 60) * 0.04;
    ctx.rotate(ang);
    ctx.fillStyle = nm ? '#5a3a2a' : '#8b5e34';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w * 0.32, -L + w * 0.1, w * 0.64, L - w * 0.1, 8) : ctx.rect(-w * 0.32, -L + w * 0.1, w * 0.64, L); ctx.fill();
    ctx.strokeStyle = nm ? '#3d281c' : '#6e4726'; ctx.lineWidth = 2;
    for (let yy = -L + w * 0.5; yy < -10; yy += 26) { ctx.beginPath(); ctx.moveTo(-w * 0.2, yy); ctx.quadraticCurveTo(0, yy + 6, w * 0.12, yy - 2); ctx.stroke(); }
    ctx.fillStyle = nm ? '#24452f' : '#2e8b57';
    ctx.beginPath();
    ctx.arc(-w * 0.3, -L + w * 0.32, w * 0.3, 0, TAU); ctx.arc(0, -L + w * 0.22, w * 0.34, 0, TAU); ctx.arc(w * 0.3, -L + w * 0.32, w * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = nm ? '#2f5a3c' : '#4fb276'; ctx.beginPath(); ctx.arc(-w * 0.08, -L + w * 0.14, w * 0.14, 0, TAU); ctx.fill();
    if (o.flag && !o.topple) drawFlag(o.flag, w * 0.18, -L + w * 0.05, w * 0.55, w * 0.36);
    if (o.breath) { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -L + w * 0.25, w * 0.07, 0, TAU); ctx.fill(); }
    ctx.restore();

    // --- top vines (can snap and drop)
    if (o.top + o.drop <= 0) return;
    ctx.save();
    ctx.translate(0, o.drop);
    const nestLen = o.kind === 'nest' ? Math.min(H * 0.15, o.top * 0.6) : 0;
    const vEnd = o.top - nestLen;
    ctx.strokeStyle = nm ? '#2a4a2a' : '#3c7d3a'; ctx.lineWidth = Math.max(3, w * 0.08); ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const vx = x + w * (0.15 + k * 0.23);
      const end = o.kind === 'nest' && k === 1 ? vEnd : o.top - (k % 2 ? w * 0.05 : 0);
      ctx.beginPath(); ctx.moveTo(vx, o.snap === 'fall' ? 0 : -5);
      ctx.bezierCurveTo(vx + 8, end * 0.3, vx - 8, end * 0.7, vx, end); ctx.stroke();
      for (let yy = 20 + ((k * 13) % 20); yy < end - 10; yy += 34) leaf(vx + (k % 2 ? 7 : -7), yy, w * 0.13, k % 2 ? 0.6 : -0.6, nm ? '#365c36' : '#4fa64a');
    }
    if (o.kind === 'nest') {
      const nx = x + w * 0.38, nw = w * 0.42;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(nx - nw * 0.15, vEnd);
      ctx.bezierCurveTo(nx - nw * 0.5, vEnd + nestLen * 0.5, nx - nw * 0.6, o.top - nestLen * 0.05, nx, o.top);
      ctx.bezierCurveTo(nx + nw * 0.6, o.top - nestLen * 0.05, nx + nw * 0.5, vEnd + nestLen * 0.5, nx + nw * 0.15, vEnd);
      ctx.closePath(); ctx.fillStyle = '#c9a15a'; ctx.fill(); ctx.clip();
      ctx.strokeStyle = '#9b7440'; ctx.lineWidth = 1.5;
      for (let d = -nestLen; d < nestLen * 2; d += 7) {
        ctx.beginPath(); ctx.moveTo(nx - nw, vEnd + d); ctx.lineTo(nx + nw, vEnd + d + nw * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(nx + nw, vEnd + d); ctx.lineTo(nx - nw, vEnd + d + nw * 0.8); ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = nm ? '#2a5a33' : '#3a8f45';
      ctx.beginPath(); ctx.arc(x + w * 0.25, o.top - w * 0.12, w * 0.2, 0, TAU); ctx.arc(x + w * 0.62, o.top - w * 0.1, w * 0.24, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFeather(f) {
    const s = H * 0.022, bob = Math.sin(clock * 3 + f.ph) * s * 0.4;
    ctx.save(); ctx.translate(f.x, f.y + bob);
    if (f.wasp && f.revealed) { drawWasp(s); ctx.restore(); return; }
    ctx.rotate(Math.sin(clock * 2 + f.ph) * 0.4 + 0.3);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -s * 1.1);
    ctx.bezierCurveTo(s * 0.85, -s * 0.6, s * 0.7, s * 0.6, 0, s * 0.95);
    ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.85, -s * 0.6, 0, -s * 1.1);
    ctx.fillStyle = f.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s * 1.4); ctx.strokeStyle = 'rgba(40,30,20,.6)'; ctx.stroke();
    ctx.restore();
  }
  function drawWasp(s) {
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(Math.sin(clock * 20 + i * 2) * s * 1.2, Math.cos(clock * 17 + i) * s * 1.2);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.5, s * 0.35, s * 0.2, Math.sin(clock * 60) * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.38, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-s * 0.15, -s * 0.38, s * 0.15, s * 0.76); ctx.fillRect(s * 0.2, -s * 0.34, s * 0.12, s * 0.68);
      ctx.restore();
    }
  }

  function drawBird() {
    const b = g.bird;
    if (b.scale < 0.06) return;
    const r = b.r * b.scale;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    if (g.e.flip > 0) ctx.scale(1, -1);
    ctx.fillStyle = '#1f8fb3';
    ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.1); ctx.lineTo(-r * 1.6, -r * 0.5); ctx.lineTo(-r * 1.5, r * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#36b3d9'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c4f0fb'; ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.35, r * 0.6, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(-r * 0.15, 0); ctx.rotate(b.flap > 0 ? -0.9 : 0.25);
    ctx.fillStyle = '#1f8fb3'; ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 0.65, r * 0.35, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.38, -r * 0.3, r * 0.32, 0, TAU); ctx.fill();
    ctx.fillStyle = '#17301f'; ctx.beginPath(); ctx.arc(r * 0.46, -r * 0.3, r * (g.state === 'dead' ? 0.08 : 0.16), 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.15); ctx.lineTo(r * 1.45, r * 0.05); ctx.lineTo(r * 0.8, r * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,120,.45)'; ctx.beginPath(); ctx.arc(r * 0.25, r * 0.15, r * 0.16, 0, TAU); ctx.fill();
    if (g.e.drunk > 0) { ctx.font = `${Math.round(r)}px sans-serif`; ctx.fillText('💫', -r * 0.6, -r * 1.1); }
    ctx.restore();
  }

  // ---- predators (cartoon, regional: harpy eagle, emerald tree boa, capuchin, toucan, jaguar)
  function drawPredator(p) {
    const s = H;
    if (p.type === 'harpy') {
      if (p.phase === 'warn') {
        ctx.fillStyle = Math.sin(clock * 25) > 0 ? '#ff3b30' : '#ffcc00';
        ctx.beginPath(); ctx.arc(W - 22, p.y, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', W - 22, p.y + 1);
        return;
      }
      const k = s * 0.04;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI);
      const flapA = Math.sin(clock * 18) * 0.5;
      ctx.fillStyle = '#3d4048';
      ctx.save(); ctx.rotate(flapA); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 1.2, -k * 2.2); ctx.lineTo(k * 2.2, -k * 1.6); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(-flapA); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 1.2, k * 2.2); ctx.lineTo(k * 2.2, k * 1.6); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#e9e6df'; ctx.beginPath(); ctx.ellipse(k * 0.4, 0, k * 1.1, k * 0.65, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b2d33'; ctx.fillRect(-k * 0.2, -k * 0.6, k * 0.35, k * 1.2);
      ctx.fillStyle = '#9ea3ab'; ctx.beginPath(); ctx.arc(-k * 0.75, 0, k * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4b4e56'; ctx.beginPath(); ctx.moveTo(-k * 0.5, -k * 0.4); ctx.lineTo(-k * 0.2, -k * 1.1); ctx.lineTo(-k * 0.1, -k * 0.3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-k * 0.5, k * 0.4); ctx.lineTo(-k * 0.2, k * 1.1); ctx.lineTo(-k * 0.1, k * 0.3); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(-k * 1.2, -k * 0.15); ctx.lineTo(-k * 1.6, k * 0.15); ctx.lineTo(-k * 1.15, k * 0.2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(-k * 0.9, -k * 0.15, k * 0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(-k * 1.0, k * 0.5, k * 0.5, k * 0.15); ctx.fillRect(-k * 1.0, -k * 0.65, k * 0.5, k * 0.15);
      ctx.restore();
    } else if (p.type === 'boa') {
      const N = 18, hx = p.x + Math.sin(clock * 3) * 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5b3d22'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p.x - s * 0.06, 2); ctx.lineTo(p.x + s * 0.06, 6); ctx.stroke();
      ctx.strokeStyle = '#1e9e4a'; ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const t = i / N, y = p.len * t, xx = lerp(p.x, hx, t) + Math.sin(i * 0.9 + clock * 4) * s * 0.012 * t; i ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (let i = 2; i < N; i += 3) { const t = i / N; ctx.beginPath(); ctx.arc(lerp(p.x, hx, t) + Math.sin(i * 0.9 + clock * 4) * s * 0.012 * t, p.len * t, s * 0.005, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.translate(hx, p.len);
      ctx.fillStyle = '#25b356'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.026, s * 0.02, 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(-s * 0.012, -s * 0.006, s * 0.006, 0, TAU); ctx.arc(s * 0.01, -s * 0.006, s * 0.006, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-s * 0.013, -s * 0.011, 2, s * 0.01); ctx.fillRect(s * 0.009, -s * 0.011, 2, s * 0.01);
      if (Math.sin(clock * 12) > 0) { ctx.strokeStyle = '#e8263a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, s * 0.018); ctx.lineTo(0, s * 0.035); ctx.lineTo(-4, s * 0.042); ctx.moveTo(0, s * 0.035); ctx.lineTo(4, s * 0.042); ctx.stroke(); }
      ctx.restore();
    } else if (p.type === 'monkey') {
      const k = p.r;
      ctx.strokeStyle = '#4b7a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, -2); ctx.lineTo(p.bx, p.by - k * 0.8); ctx.stroke();
      ctx.save(); ctx.translate(p.bx, p.by);
      ctx.strokeStyle = '#5a3418'; ctx.lineWidth = k * 0.25;
      ctx.beginPath(); ctx.arc(k * 0.9, k * 0.6, k * 0.5, -1, 2.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-k * 0.3, -k * 0.2); ctx.lineTo(-k * 0.1, -k * 1.1); ctx.moveTo(k * 0.3, -k * 0.2); ctx.lineTo(k * 0.05, -k * 1.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-k * 0.5, k * 0.4); ctx.lineTo(-k * 1.3, k * 0.3 + Math.sin(clock * 8) * k * 0.3); ctx.stroke();
      ctx.fillStyle = '#6b3d1f'; ctx.beginPath(); ctx.ellipse(0, k * 0.2, k * 0.6, k * 0.75, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b3d1f'; ctx.beginPath(); ctx.arc(-k * 0.2, -k * 0.55, k * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f1d6b0'; ctx.beginPath(); ctx.arc(-k * 0.25, -k * 0.45, k * 0.36, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(-k * 0.2, -k * 0.85, k * 0.3, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-k * 0.38, -k * 0.5, k * 0.06, 0, TAU); ctx.arc(-k * 0.12, -k * 0.5, k * 0.06, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.type === 'toucan') {
      const k = p.r;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(k * 0.3, 0, k * 1.1, k * 0.7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(k * 1.2, 0); ctx.lineTo(k * 2, -k * 0.3); ctx.lineTo(k * 2, k * 0.4); ctx.fill();
      ctx.save(); ctx.translate(k * 0.4, -k * 0.2); ctx.rotate(Math.sin(clock * 16) * 0.7);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0, -k * 0.5, k * 0.35, k * 0.75, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fbf4dc'; ctx.beginPath(); ctx.arc(-k * 0.55, k * 0.1, k * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-k * 0.55, -k * 0.25, k * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4aa3df'; ctx.beginPath(); ctx.arc(-k * 0.7, -k * 0.3, k * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-k * 0.72, -k * 0.3, k * 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f39222';
      ctx.beginPath(); ctx.moveTo(-k * 0.85, -k * 0.5); ctx.quadraticCurveTo(-k * 2.2, -k * 0.7, -k * 2.6, -k * 0.05); ctx.quadraticCurveTo(-k * 2, 0, -k * 0.85, k * 0.05); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-k * 2.45, -k * 0.12, k * 0.16, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.type === 'jaguar') {
      const k = p.r;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.phase === 'leap' ? clamp(p.vy / (H * 3), -0.6, 0.6) : 0);
      ctx.strokeStyle = '#e0a03a'; ctx.lineWidth = k * 0.25; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(k * 1.1, -k * 0.1); ctx.quadraticCurveTo(k * 1.9, -k * 0.2, k * 1.8, -k * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-k * 0.6, k * 0.4); ctx.lineTo(-k * 0.9, k * 0.9); ctx.moveTo(k * 0.6, k * 0.4); ctx.lineTo(k * 0.8, k * 0.9); ctx.stroke();
      ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.ellipse(0, 0, k * 1.2, k * 0.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-k * 1.2, -k * 0.3, k * 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-k * 1.35, -k * 0.75, k * 0.15, 0, TAU); ctx.arc(-k * 1.0, -k * 0.75, k * 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2410';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-k * 0.7 + i * k * 0.28, Math.sin(i * 2.3) * k * 0.25, k * 0.09, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#d4f04a'; ctx.beginPath(); ctx.arc(-k * 1.35, -k * 0.38, k * 0.08, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawFx(f) {
    const s = H;
    if (f.type === 'bolt') {
      if (f.delay > 0) return;
      if (f.warn > 0) {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * Math.sin(clock * 30);
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
        ctx.beginPath(); f.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(40,40,60,.75)'; ctx.beginPath(); ctx.ellipse(f.x, 10, 50, 22, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 25;
        ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 6;
        ctx.beginPath(); f.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + rand(-3, 3), y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    } else if (f.type === 'coco') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.fillStyle = '#6b4220'; ctx.beginPath(); ctx.arc(0, 0, f.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1608'; [[-0.3, -0.2], [0.25, -0.25], [0, 0.25]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * f.r, b * f.r, f.r * 0.14, 0, TAU); ctx.fill(); });
      ctx.restore();
    } else if (f.type === 'cow') {
      const k = f.r;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, k, k * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-k * 0.3, -k * 0.1, k * 0.22, 0, TAU); ctx.arc(k * 0.35, k * 0.15, k * 0.18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-k * 1.05, -k * 0.2, k * 0.38, k * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f7a8b8'; ctx.beginPath(); ctx.ellipse(-k * 1.3, -k * 0.12, k * 0.18, k * 0.15, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = k * 0.15; ctx.lineCap = 'round';
      [-0.6, -0.2, 0.3, 0.7].forEach((a) => { ctx.beginPath(); ctx.moveTo(a * k, k * 0.5); ctx.lineTo(a * k, k * 0.95); ctx.stroke(); });
      ctx.restore();
    }
  }

  function drawUfo() {
    const u = g.ufo, s = H * 0.055;
    if (u.beam && u.phase === 'hover') {
      const gy = groundY();
      const grd = ctx.createLinearGradient(0, u.y, 0, gy);
      grd.addColorStop(0, 'rgba(180,255,140,.55)'); grd.addColorStop(1, 'rgba(180,255,140,.08)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(u.x - H * 0.035, u.y + s * 0.3); ctx.lineTo(u.x + H * 0.035, u.y + s * 0.3); ctx.lineTo(u.x + H * 0.13, gy); ctx.lineTo(u.x - H * 0.13, gy); ctx.fill();
    }
    ctx.save(); ctx.translate(u.x, u.y + Math.sin(clock * 3) * 4);
    ctx.fillStyle = 'rgba(143,240,255,.85)'; ctx.beginPath(); ctx.ellipse(0, -s * 0.25, s * 0.55, s * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#6fe36f'; ctx.beginPath(); ctx.arc(0, -s * 0.38, s * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.4, s * 0.06, s * 0.09, -0.4, 0, TAU); ctx.ellipse(s * 0.08, -s * 0.4, s * 0.06, s * 0.09, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b9c3cf'; ctx.beginPath(); ctx.ellipse(0, 0, s * 1.25, s * 0.38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7d8896'; ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.9, s * 0.18, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = (Math.floor(clock * 8) + i) % 2 ? '#ffe14d' : '#ff5c8a'; ctx.beginPath(); ctx.arc(-s + (i * 2 * s) / 5, s * 0.02, s * 0.08, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawOverlays() {
    const e = g.e, b = g.bird;
    if (g.wind > 0.05) { // storm tint + rain
      ctx.fillStyle = `rgba(25,35,60,${Math.min(0.45, g.wind * 0.35)})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 1.5;
      const n = Math.floor(60 * Math.min(1, g.wind));
      for (let i = 0; i < n; i++) {
        const x = ((hash(i) * W * 1.4 + clock * 900 * (0.6 + hash(i + 3))) % (W * 1.4)) - W * 0.2;
        const y = (hash(i + 9) * H + clock * 700) % H;
        ctx.beginPath(); ctx.moveTo(W - x, y); ctx.lineTo(W - x + 14 * g.wind, y + 18); ctx.stroke();
      }
    }
    const fog = curse('fog'), dark = e.dark > 0;
    if (fog || dark) {
      const r0 = dark ? H * 0.09 : H * 0.28, r1 = dark ? H * 0.24 : H * 0.7;
      const grd = ctx.createRadialGradient(b.x, b.y, r0, b.x, b.y, r1);
      grd.addColorStop(0, 'rgba(5,5,15,0)'); grd.addColorStop(1, dark ? 'rgba(5,5,15,.97)' : 'rgba(200,200,215,.85)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
      if (dark) for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(230,255,120,${0.4 + 0.4 * Math.sin(clock * 3 + i)})`; ctx.beginPath(); ctx.arc(hash(i) * W + Math.sin(clock + i) * 20, hash(i + 4) * H * 0.85, 2.5, 0, TAU); ctx.fill(); }
    }
    if (e.turbo > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const y = hash(i + 20) * H, x = W - ((clock * 2000 + hash(i) * W) % (W * 1.3)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y); ctx.stroke(); }
    }
    if (e.flip > 0 && Math.sin(clock * 6) > 0) {
      ctx.fillStyle = 'rgba(255,180,255,.8)'; ctx.font = `900 ${Math.round(H * 0.035)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('⬆️', W - 26, H * 0.5);
    }
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,240,${g.flash * 0.85})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawBanners() {
    for (const bn of g.banners) {
      const age = bn.max - bn.t, sc = age < 0.15 ? 0.6 + age * 2.7 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(bn.t / 0.4, 0, 1);
      ctx.translate(W / 2, H * (bn.small ? 0.36 : 0.3)); ctx.scale(sc, sc);
      const fs = bn.small ? Math.min(H * 0.026, W * 0.045) : Math.min(H * 0.055, W * 0.1);
      ctx.font = `900 ${Math.round(fs)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = fs * 0.22; ctx.strokeStyle = 'rgba(20,10,25,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(bn.text, 0, 0); ctx.fillStyle = bn.color; ctx.fillText(bn.text, 0, 0);
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    if (g.e.drunk > 0) { ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(clock * 2) * 0.06); ctx.translate(-W / 2, -H / 2); }
    if (g.e.mirror > 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    drawBackground();
    for (const o of g.obs) drawObstacle(o);
    drawGround();
    for (const f of g.fea) drawFeather(f);
    for (const p of g.preds) drawPredator(p);
    for (const f of g.fx) drawFx(f);
    if (g.ufo) drawUfo();
    drawBird();
    for (const p of g.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.text) {
        ctx.save(); ctx.translate(p.x, p.y); if (g.e.mirror > 0) ctx.scale(-1, 1);
        ctx.fillStyle = g.mode === 'nightmare' ? '#fff' : '#17301f'; ctx.font = `900 ${Math.round(H * 0.03)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.text, 0, 0);
        ctx.restore();
      } else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    drawCanopy();
    ctx.restore();
    drawOverlays();
    drawBanners();
  }

  OG.game = {
    init, resize, flap,
    reset: (mode) => reset(mode),
    get state() { return g ? g.state : 'none'; },
    get mode() { return g ? g.mode : 'normal'; },
  };
  if (DEV) OG.game.debug = { get g() { return g; }, event: (k) => EVENTS[k].start(intensity()), predator: spawnPredator, skip: (s) => { g.t += s; } };
})();

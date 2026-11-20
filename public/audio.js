/* Sound: the bird's song as a late hint, plus small game sfx.
 * Set GAME_CONFIG.songUrl (e.g. '/sound/song.mp3') to use a real recording instead of the synth.
 * (Russet-backed Oropendola song: a liquid, gurgling crescendo ending in a loud "gloop".) */
(function () {
  const OG = (window.OG = window.OG || {});
  let ctx = null, muted = false, songEl = null, hasFile = false;

  try { muted = localStorage.getItem('oro_mute') === '1'; } catch {}
  const songUrl = (window.GAME_CONFIG && window.GAME_CONFIG.songUrl) || '';
  if (songUrl) { hasFile = true; songEl = new Audio(songUrl); songEl.preload = 'auto'; }

  function unlock() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(t0, f0, f1, dur, vol, type = 'sine', fm = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    if (fm) { // bubbly wobble
      const m = ctx.createOscillator(), mg = ctx.createGain();
      m.frequency.value = fm; mg.gain.value = f0 * 0.12;
      m.connect(mg).connect(o.frequency); m.start(t0); m.stop(t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function synthSong() {
    const t = ctx.currentTime + 0.05;
    // rising liquid gurgle
    const notes = [320, 380, 300, 460, 360, 560, 430, 700];
    notes.forEach((f, i) => tone(t + i * 0.075, f, f * 1.6, 0.09, 0.05 + i * 0.012, 'sine', 38));
    // loud explosive "gloop" at the end
    tone(t + 0.68, 1700, 260, 0.32, 0.22, 'sine', 22);
    tone(t + 0.7, 900, 140, 0.25, 0.1, 'triangle');
    // a softer second phrase
    [520, 640, 480].forEach((f, i) => tone(t + 1.25 + i * 0.09, f, f * 1.4, 0.1, 0.05, 'sine', 30));
    tone(t + 1.55, 1500, 300, 0.25, 0.14, 'sine', 20);
  }

  OG.audio = {
    unlock,
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem('oro_mute', m ? '1' : '0'); } catch {} },
    song() {
      if (muted) return;
      if (hasFile && songEl) { songEl.currentTime = 0; songEl.play().catch(() => {}); return; }
      if (!ctx) return;
      synthSong();
    },
    sfx(kind) {
      if (muted || !ctx) return;
      const t = ctx.currentTime;
      if (kind === 'flap') tone(t, 520, 300, 0.07, 0.03, 'triangle');
      else if (kind === 'feather') tone(t, 880, 1600, 0.09, 0.06, 'sine');
      else if (kind === 'die') { tone(t, 400, 60, 0.45, 0.12, 'sawtooth'); }
      else if (kind === 'thunder') { tone(t, 90, 30, 0.9, 0.25, 'sawtooth', 9); }
      else if (kind === 'warn') { tone(t, 900, 900, 0.08, 0.06, 'square'); tone(t + 0.12, 900, 900, 0.08, 0.06, 'square'); }
      else if (kind === 'ufo') { tone(t, 300, 1200, 0.8, 0.06, 'sine', 7); }
    },
  };
})();

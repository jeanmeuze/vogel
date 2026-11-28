/* Game tuning. Distances/speeds are fractions of the screen height (per second). */
window.GAME_CONFIG = {
  // Optional real recording of the song, e.g. '/sound/song.mp3' (put the file in public/sound/).
  // Empty = synthesized approximation.
  songUrl: '',

  physics: { gravity: 2.3, flap: 0.68, maxFall: 1.25 },

  normal: {
    baseSpeed: 0.34, speedRamp: 0.005, maxSpeed: 0.58,
    spacing: 0.56, startGap: 0.36, minGap: 0.25, gapShrink: 0.002,
    featherChance: 0.9, bonusFeatherChance: 0.5,
    predatorsFrom: 22, predatorEvery: [9, 4.5], // seconds: [at start, after ramp]
  },

  // Hard: every crazy nightmare element (events, silent traps, curses), but milder,
  // shorter, with more warning and further apart, so it stays playable.
  hard: {
    baseSpeed: 0.36, speedRamp: 0.006, maxSpeed: 0.64,
    spacing: 0.54, startGap: 0.34, minGap: 0.23, gapShrink: 0.0025,
    featherChance: 0.9, bonusFeatherChance: 0.55,
    predatorsFrom: 12, predatorEvery: [8, 3.6],
    firstEvent: 7, // seconds before the first chaos event
    eventEvery: [12, 6], // seconds between chaos events: [at start, after ramp]
    rampSeconds: 120,
    curses: [0, 1],
    scoreMultiplier: 1.5,
    chaos: { duration: 0.65, power: 0.55, warn: 1.6, count: 0.5, intensity: 0.5 },
  },

  nightmare: {
    baseSpeed: 0.4, speedRamp: 0.009, maxSpeed: 0.78,
    spacing: 0.5, startGap: 0.31, minGap: 0.2, gapShrink: 0.003,
    featherChance: 0.9, bonusFeatherChance: 0.6,
    predatorsFrom: 5, predatorEvery: [5, 1.8],
    eventEvery: [6, 2.2], // seconds between chaos events: [at start, after ramp]
    rampSeconds: 90,
    curses: [1, 3], // random permanent curses per run: [min, max]
    scoreMultiplier: 2,
    firstEvent: 3,
    // chaos strength: duration/power/count multipliers, warn = extra warning time factor,
    // intensity = how fast events grow over time
    chaos: { duration: 1, power: 1, warn: 1, count: 1, intensity: 1 },
  },

  // Seconds survived in a run before each hint appears.
  hints: {
    tail: 8,       // hint card top-left: yellow tail
    bill: 16,      // + pale bill and forehead
    back: 28,      // + russet back
    flags: 36,     // flags of range countries appear on the trees
    head: 45,      // + olive head
    sound: 55,     // the song plays every ~14 s
    full: 65,      // full bird
  },
};

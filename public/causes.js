/* Death causes: key (as stored per attempt) -> short label. Used by the game, the score board and /admin. */
window.DEATH_CAUSES = {
  tree: '🌳 Tegen een boom',
  vine: '🌿 Lianen',
  ground: '💥 Neergestort',
  ceiling: '🍃 Bladerdak',
  harpy: '🦅 Harpij',
  boa: '🐍 Boa',
  monkey: '🐒 Aap',
  toucan: '🦜 Toekan',
  jaguar: '🐆 Jaguar',
  lightning: '⚡ Bliksem',
  ufo: '🛸 Aliens',
  cow: '🐄 Vallende koe',
  coconut: '🥥 Kokosnoot',
  wasp: '🐝 Wespen',
  log: '🪵 Omvallende boom',
};
window.causeLabel = (k) => (k ? window.DEATH_CAUSES[k] || k : '–');

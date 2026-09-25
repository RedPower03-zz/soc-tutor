// Versioned state migrations. Each entry upgrades state from version N to N+1.
import { ensureState } from './engine.js';
import { ensureGame, retroGame } from './game.js';

export const CURRENT_VERSION = 2;

const MIGRATIONS = {
  // v1 -> v2: add the gamification profile, crediting XP/badges from existing history.
  1: (st, content, now) => {
    st.game = retroGame(st, content, now);
    st.version = 2;
    return st;
  },
};

/** Upgrades any saved state to CURRENT_VERSION and fills in missing fields. */
export function migrateState(st, content, now = Date.now()) {
  ensureState(st, content);
  let v = st.version || 1;
  while (v < CURRENT_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from state version ${v}`);
    step(st, content, now);
    v = st.version;
  }
  st.game = ensureGame(st.game);
  return st;
}

// Versioned state migrations. Each entry upgrades state from version N to N+1.
//
// Version history
//   v1  original MVP (live on main): mastery, in-session review queue, gaps, placement.
//   v2  learning upgrades + gamification: game profile (XP, ranks, badges, streak),
//       long-term review cards, lessons, misconceptions, confidence calibration, mixed
//       practice stats. New fields are created by ensureState / ensureGame; the v1 -> v2
//       step below seeds the ones that should reflect existing progress.
import { ensureState, isMastered, indexContent } from './engine.js';
import { ensureGame, retroGame } from './game.js';
import { SCHED, addDays, startOfDay } from './scheduler.js';

export const CURRENT_VERSION = 2;

/**
 * Seeds long-term review cards from v1 history. v1 has no timestamps, so every card is
 * treated as last reviewed now. Items whose last answer was wrong are due today; items
 * answered right are due in 1–8 days depending on how often they were answered right,
 * with a small spread so they don't all land on the same day.
 */
export function seedSchedule(st, content, now) {
  const idx = indexContent(content);
  const lastAnswer = new Map();
  for (const h of st.history || []) lastAnswer.set(h.itemId, h.correct);
  // Items still waiting in the v1 in-session review queue were missed recently: due today.
  const queued = new Set((st.reviewQueue || []).map((q) => q.itemId));
  let i = 0;
  for (const [id, is] of Object.entries(st.items || {})) {
    if (!idx.itemById.has(id) || !is.attempts || st.cards[id]) continue;
    const lastRight = (lastAnswer.has(id) ? lastAnswer.get(id) : is.correct >= is.misses) && !queued.has(id);
    const s = lastRight ? Math.min(8, 1 + is.correct) : queued.has(id) ? 1 : SCHED.minStability;
    const days = lastRight ? Math.max(1, Math.round(s)) + (i % 3) : 0;
    st.cards[id] = {
      s,
      d: Math.min(10, Math.max(1, SCHED.initialDifficulty + (is.misses > is.correct ? 1.5 : 0))),
      reps: is.attempts,
      lapses: is.misses,
      last: now,
      due: days ? addDays(startOfDay(now), days) : startOfDay(now),
      lastGrade: lastRight ? 3 : 1,
      seeded: true,
    };
    i += 1;
  }
}

const MIGRATIONS = {
  // v1 -> v2: gamification profile (XP/badges credited from history), long-term schedule
  // seeded from history, lessons marked done for skills already mastered.
  1: (st, content, now) => {
    st.game = retroGame(st, content, now);
    seedSchedule(st, content, now);
    const idx = indexContent(content);
    for (const s of idx.activeSkills) {
      const ss = st.skills[s.id];
      if (ss.attempts > 0 && ss.lastAt == null) ss.lastAt = now;
      if (isMastered(st, content, s.id)) {
        st.lessons[s.id] = { read: true, worked: [], faded: [], completed: true, skipped: false, bypassed: true, offered: true, migrated: true };
      }
    }
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

// Versioned state migrations. Each entry upgrades state from version N to N+1.
//
// Version history
//   v1  original MVP (live on main): mastery, in-session review queue, gaps, placement.
//   v2  learning upgrades + gamification: game profile (XP, ranks, badges, streak),
//       long-term review cards, lessons, misconceptions, confidence calibration, mixed
//       practice stats. New fields are created by ensureState / ensureGame; the v1 -> v2
//       step below seeds the ones that should reflect existing progress.
//   v3  round two: 16-rank career ladder spread over curriculum Levels 1-3, a flatter level
//       curve, SIEM investigations (st.siem) and capstones (st.capstones). The v2 -> v3 step
//       recomputes rank and level; titles and themes earned on the old ladder are kept.
import { ensureState, isMastered, indexContent } from './engine.js';
import { ensureGame, retroGame, computeRank, levelForXp, checkBadges, RANKS, rankIndex } from './game.js';
import { SCHED, addDays, startOfDay } from './scheduler.js';

export const CURRENT_VERSION = 3;

/** The original (v2) 7-rank ladder, oldest first, and the themes it unlocked. */
export const OLD_LADDER = [
  { id: 'trainee', title: 'Trainee', themes: ['cyan'] },
  { id: 'junior', title: 'Junior Analyst', themes: ['amber'] },
  { id: 'tier1', title: 'Tier 1 Analyst', themes: ['red'] },
  { id: 'tier2', title: 'Tier 2 Analyst', themes: ['green'] },
  { id: 'responder', title: 'Incident Responder', themes: [] },
  { id: 'hunter', title: 'Threat Hunter', themes: [] },
  { id: 'lead', title: 'SOC Lead', themes: [] },
];

/**
 * Moves a game profile from the old 7-rank ladder to the new one. Rank and level are
 * recomputed from XP and mastery (so the displayed rank can go down); every title and theme
 * earned on the old ladder stays available, badges are never touched, and a one-time notice
 * explains the change.
 */
export function migrateLadder(st, content, now) {
  const game = st.game;
  const oldIdx = Math.max(0, OLD_LADDER.findIndex((r) => r.id === game.rankId));
  const old = OLD_LADDER[oldIdx];
  const reached = OLD_LADDER.slice(0, oldIdx + 1);
  // "Trainee" is rank 0 on both ladders, so it never needs keeping.
  game.keptTitles = [...new Set([...(game.keptTitles || []), ...reached.map((r) => r.title).filter((t) => t !== RANKS[0].title)])];
  game.keptThemes = [...new Set([...(game.keptThemes || []), ...reached.flatMap((r) => r.themes)])];
  // An equipped old rank title ("rank:tier1") becomes the kept title so it stays on display.
  if (typeof game.equippedTitle === 'string' && game.equippedTitle.startsWith('rank:')) {
    const oldRank = OLD_LADDER.find((r) => `rank:${r.id}` === game.equippedTitle);
    game.equippedTitle = oldRank && oldRank.id !== 'trainee' ? `kept:${oldRank.title}` : null;
  }
  game.level = levelForXp(game.xp);
  const rank = computeRank(game, st, content);
  game.rankId = rank.id;
  game.ladder = 2;
  game.ladderNotice = old.title !== rank.title ? { fromTitle: old.title, toTitle: rank.title, rankIndex: rankIndex(rank.id), at: now } : null;
  checkBadges(game, st, content, now);
  return game;
}

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
  // v2 -> v3: new career ladder and level curve (saves from before have no game.ladder).
  2: (st, content, now) => {
    const fromOldLadder = st.game && st.game.ladder === undefined;
    st.game = ensureGame(st.game);
    if (fromOldLadder) migrateLadder(st, content, now);
    st.game.version = 3;
    st.version = 3;
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

// Long-term spaced review: a small FSRS-style scheduler ("FSRS-lite").
//
// Why FSRS-lite instead of SM-2: FSRS models memory with a per-item *stability* S (days
// until recall probability drops to 90%) and *difficulty* D. That gives us a
// retrievability estimate R(t) at any moment, which we also use for mastery decay, and it
// grows intervals more when a recall succeeds after a longer gap. SM-2 only has an
// ease factor and no notion of "how likely are you to remember this today".
// This is a simplified version with hand-picked parameters, not the trained FSRS model.
//
// Pure functions, no DOM. Every function takes `now` (ms timestamp) so tests can use a fake
// clock. Due dates are aligned to local midnight so "due today" means the calendar day.
//
// Grades come from the answer plus the student's confidence:
//   wrong → Again (1), right but "Guess" → Hard (2), right and "Unsure" (or no rating) → Good (3),
//   right and "Sure" → Easy (4).

export const DAY = 24 * 60 * 60 * 1000;

export const SCHED = {
  initialStability: { 1: 0.5, 2: 1, 3: 2, 4: 4 }, // days, by grade of the first long-term review
  initialDifficulty: 5, // 1 (easy) .. 10 (hard)
  growth: 1.6, // base stability growth on a successful recall
  gradeFactor: { 2: 0.45, 3: 1, 4: 1.35 }, // Hard grows less, Easy more
  lapseFactor: 0.3, // stability multiplier after a lapse (a wrong answer)
  minStability: 0.5,
  maxIntervalDays: 180,
  // Mastery decay: a skill's mastery estimate is capped at (retention + margin), never below floor.
  decayMargin: 0.1,
  decayFloor: 0.7,
  defaultSkillStability: 2, // days, for skills with no long-term cards yet
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function gradeFor(correct, confidence) {
  if (!correct) return 1;
  if (confidence === 'guess') return 2;
  if (confidence === 'sure') return 4;
  return 3;
}

/** Local midnight of the day containing `ts`. */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Adds calendar days in local time (DST-safe). */
export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Probability of recalling the card now: 0.9 ^ (elapsed days / stability). */
export function retrievability(card, now) {
  if (!card || card.last == null) return 0;
  const days = Math.max(0, now - card.last) / DAY;
  return Math.pow(0.9, days / card.s);
}

/** Next interval in whole days for a stability (target retention 90% → interval ≈ S). */
export function intervalDays(s) {
  return clamp(Math.round(s), 1, SCHED.maxIntervalDays);
}

/**
 * Records one review of a card and returns the updated card (the input is not mutated).
 * Same-day successful re-answers don't grow stability (no cramming credit), but a lapse always counts.
 */
export function reviewCard(card, grade, now) {
  const g = clamp(grade | 0, 1, 4);
  let c;
  if (!card) {
    c = {
      s: SCHED.initialStability[g],
      d: clamp(SCHED.initialDifficulty - 0.8 * (g - 3), 1, 10),
      reps: 1,
      lapses: g === 1 ? 1 : 0,
      last: now,
      due: addDays(startOfDay(now), g === 1 ? 1 : intervalDays(SCHED.initialStability[g])),
      lastGrade: g,
    };
    return c;
  }
  c = { ...card, reps: (card.reps || 0) + 1 };
  const sameDay = card.last != null && startOfDay(card.last) === startOfDay(now);
  if (g === 1) {
    c.lapses = (card.lapses || 0) + 1;
    c.s = Math.max(SCHED.minStability, card.s * SCHED.lapseFactor);
    c.d = clamp(card.d + 1.6, 1, 10);
    c.due = addDays(startOfDay(now), 1);
  } else if (!sameDay) {
    const R = retrievability(card, now);
    const growth = SCHED.growth * ((11 - card.d) / 10) * Math.pow(card.s, -0.15) * (1 + 2 * (1 - R)) * SCHED.gradeFactor[g];
    c.s = Math.min(SCHED.maxIntervalDays, card.s * (1 + growth));
    c.d = clamp(card.d - 0.8 * (g - 3), 1, 10);
    c.due = addDays(startOfDay(now), intervalDays(c.s));
  } else if (card.due <= now) {
    // Due card reviewed again on the day it was last seen (e.g. a migrated card): move it out of
    // today's queue without growing stability.
    c.due = addDays(startOfDay(now), Math.max(1, intervalDays(card.s)));
  }
  // other same-day successes keep stability and due date
  c.last = now;
  c.lastGrade = g;
  return c;
}

export function isDue(card, now) {
  return !!card && card.due <= now;
}

/** Item ids whose long-term review is due, most overdue (then least retained) first. */
export function dueItemIds(st, content, now, itemById) {
  const ids = [];
  for (const [id, card] of Object.entries(st.cards || {})) {
    if (itemById && !itemById.has(id)) continue;
    if (isDue(card, now)) ids.push(id);
  }
  return ids.sort((a, b) => st.cards[a].due - st.cards[b].due || retrievability(st.cards[a], now) - retrievability(st.cards[b], now));
}

/** Next date (ms) anything becomes due, or null. */
export function nextDueAt(st) {
  let next = null;
  for (const c of Object.values(st.cards || {})) if (next == null || c.due < next) next = c.due;
  return next;
}

/** Average stability of a skill's cards (days). */
export function skillStability(st, itemIds) {
  const cards = itemIds.map((id) => st.cards?.[id]).filter(Boolean);
  if (!cards.length) return SCHED.defaultSkillStability;
  return cards.reduce((a, c) => a + c.s, 0) / cards.length;
}

/**
 * Estimated retention of a skill: 0.9 ^ (days since the skill was last practised / skill stability).
 * Practising any item in the skill (including daily review) resets the clock.
 */
export function skillRetention(ss, stability, now) {
  if (!ss || ss.lastAt == null) return null;
  const days = Math.max(0, now - ss.lastAt) / DAY;
  return Math.pow(0.9, days / stability);
}

/** The mastery cap implied by a retention estimate. */
export function decayCap(retention) {
  return clamp(retention + SCHED.decayMargin, SCHED.decayFloor, 0.999);
}

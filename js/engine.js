// SOC Tutor adaptive engine.
//
// Pure JavaScript, no DOM access, so it runs in the browser and in Node tests.
// All functions take the student `state` (a plain JSON-serialisable object) and the
// `content` ({ skills, items }) and update the state in place.
//
// How it adapts, in short:
//  * Mastery: each skill has a probability that the student knows it (Bayesian
//    Knowledge Tracing). Every answer updates it. Harder questions move it more when
//    answered correctly and less when missed; easy multiple-choice questions allow
//    for lucky guesses.
//  * Missed items go into a review queue and come back after a few other questions,
//    then again after a longer gap. A skill is not "mastered" while it has misses
//    waiting for review.
//  * Gap finding: after repeated misses in a skill, the engine asks short diagnostic
//    questions on that skill's prerequisites. A weak prerequisite is flagged as the
//    root gap; the session strengthens it first, then returns to the original skill.
//    This can nest (a gap inside a gap) so the deepest weak building block is found.

export const PARAMS = {
  pInit: 0.15, // starting mastery probability for a new skill
  masteryThreshold: 0.85, // mastery probability needed to count as mastered
  minAttemptsForMastery: 4, // ...and at least this many answers in the skill
  weakThreshold: 0.5, // below this (after some attempts) a skill is reported as weak
  // BKT parameters by difficulty (1 easy .. 3 hard)
  slip: { 1: 0.05, 2: 0.1, 3: 0.15 }, // chance a student who knows it still misses
  guessScale: { 1: 1.2, 2: 1.0, 3: 0.75 }, // multiplies the item type's base guess rate
  transit: { 1: 0.08, 2: 0.1, 3: 0.12 }, // chance of learning from the attempt
  baseGuess: { multi: 0.1, text: 0.03 }, // mc base guess = 1 / number of choices
  // Placement quiz seeding
  placementCorrectEasy: 0.55,
  placementCorrectHard: 0.72,
  placementWrong: 0.1,
  // Review queue: turns (answered questions) until the item returns.
  // After a miss it returns in 3; after a correct review, in 8; a second correct review clears it.
  reviewIntervals: [3, 8],
  recentWindow: 5, // an item is not picked again within this many questions (review excepted)
  maxSkillStreak: 8, // after this many questions in a row on one skill, interleave another
  // Gap probing
  probeWindow: 4, // look at the last N answers in the skill...
  probeMisses: 2, // ...and probe prerequisites when at least this many were missed
  probeCooldown: 12, // don't re-probe the same skill's prerequisites within N turns
  solidMemory: 40, // a prerequisite that just tested solid isn't re-probed for N turns (unless it slipped)
  gapCap: 0.45, // when diagnostics flag a gap, the skill's estimate is lowered to at most this
  remediationMaxItems: 12, // give up remediating after this many items (gap stays flagged)
  maxFocusDepth: 4,
  historyLimit: 2000,
};

const P = PARAMS;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------- content index

const indexCache = new WeakMap();

export function indexContent(content) {
  let idx = indexCache.get(content);
  if (idx) return idx;
  const skillById = new Map(content.skills.map((s) => [s.id, s]));
  const itemById = new Map(content.items.map((i) => [i.id, i]));
  const itemsBySkill = new Map(content.skills.map((s) => [s.id, []]));
  for (const it of content.items) {
    if (!itemsBySkill.has(it.skill)) itemsBySkill.set(it.skill, []);
    itemsBySkill.get(it.skill).push(it);
  }
  const activeSkills = content.skills
    .filter((s) => !s.comingSoon && itemsBySkill.get(s.id).length > 0)
    .sort((a, b) => a.order - b.order);
  const activeIds = new Set(activeSkills.map((s) => s.id));
  idx = { skillById, itemById, itemsBySkill, activeSkills, activeIds };
  indexCache.set(content, idx);
  return idx;
}

export function activePrereqs(content, skillId) {
  const idx = indexContent(content);
  const s = idx.skillById.get(skillId);
  return (s?.prereqs || []).filter((p) => idx.activeIds.has(p));
}

const skillName = (content, id) => indexContent(content).skillById.get(id)?.name || id;

// ---------------------------------------------------------------- state

export function createState(content) {
  return ensureState(
    {
      version: 1,
      turn: 0,
      skills: {},
      items: {},
      reviewQueue: [],
      history: [],
      recent: [],
      focus: [],
      gaps: {},
      lastProbe: {},
      solidAt: {},
      currentSkill: null,
      skillStreak: 0,
      pendingNote: null,
      placement: null,
    },
    content,
  );
}

/** Fills in anything missing (e.g. after new skills were added) and drops stale data. */
export function ensureState(st, content) {
  const idx = indexContent(content);
  st.version ??= 1;
  st.turn ??= 0;
  st.skills ??= {};
  st.items ??= {};
  st.reviewQueue ??= [];
  st.history ??= [];
  st.recent ??= [];
  st.focus ??= [];
  st.gaps ??= {};
  st.lastProbe ??= {};
  st.solidAt ??= {};
  st.skillStreak ??= 0;
  st.currentSkill ??= null;
  st.pendingNote ??= null;
  st.placement ??= null;
  for (const s of idx.activeSkills) {
    st.skills[s.id] ??= { p: P.pInit, attempts: 0, correct: 0, unlocked: false, lastTurn: 0 };
  }
  st.reviewQueue = st.reviewQueue.filter((r) => idx.itemById.has(r.itemId));
  st.focus = st.focus.filter((f) => idx.activeIds.has(f.skillId));
  refreshUnlocks(st, content);
  return st;
}

// ---------------------------------------------------------------- skill status

export function outstandingMisses(st, skillId) {
  return st.reviewQueue.filter((r) => r.skillId === skillId).length;
}

export function isMastered(st, content, skillId) {
  const ss = st.skills[skillId];
  if (!ss) return false;
  return (
    ss.p >= P.masteryThreshold &&
    ss.attempts >= P.minAttemptsForMastery &&
    outstandingMisses(st, skillId) === 0
  );
}

/** Unlocks every skill whose prerequisites are all mastered. Unlocking is sticky. */
export function refreshUnlocks(st, content) {
  const idx = indexContent(content);
  const unlocked = [];
  for (const s of idx.activeSkills) {
    const ss = st.skills[s.id];
    if (ss.unlocked) continue;
    if (activePrereqs(content, s.id).every((p) => isMastered(st, content, p))) {
      ss.unlocked = true;
      unlocked.push(s.id);
    }
  }
  return unlocked;
}

/** 'coming-soon' | 'locked' | 'new' | 'learning' | 'gap' | 'mastered' */
export function skillStatus(st, content, skillId) {
  const idx = indexContent(content);
  const s = idx.skillById.get(skillId);
  if (!s || s.comingSoon || !idx.activeIds.has(skillId)) return 'coming-soon';
  const ss = st.skills[skillId];
  if (!ss.unlocked) return 'locked';
  if (isMastered(st, content, skillId)) return 'mastered';
  if (st.gaps[skillId] && !st.gaps[skillId].resolved) return 'gap';
  if (ss.attempts === 0) return 'new';
  return 'learning';
}

export function overallProgress(st, content) {
  const idx = indexContent(content);
  const total = idx.activeSkills.length;
  const mastered = idx.activeSkills.filter((s) => isMastered(st, content, s.id)).length;
  const avg = idx.activeSkills.reduce((a, s) => a + st.skills[s.id].p, 0) / Math.max(1, total);
  return { mastered, total, average: avg, answered: st.turn, reviewCount: st.reviewQueue.length };
}

// ---------------------------------------------------------------- answers

export function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+/, '')
    .replace(/["'`.]+$/, '')
    .trim();
}

/** response: mc -> choice text, multi -> array of choice texts, text -> string */
export function checkAnswer(item, response) {
  if (item.type === 'mc') return response === item.answer;
  if (item.type === 'multi') {
    const r = new Set(Array.isArray(response) ? response : []);
    return r.size === item.answer.length && item.answer.every((a) => r.has(a));
  }
  if (item.type === 'text') {
    const n = normalizeText(response);
    return n !== '' && item.accept.some((a) => normalizeText(a) === n);
  }
  return false;
}

export function itemParams(item) {
  const d = clamp(item.difficulty | 0 || 1, 1, 3);
  let g =
    item.type === 'mc' ? 1 / Math.max(2, item.choices.length) : P.baseGuess[item.type] ?? 0.05;
  g = clamp(g * P.guessScale[d], 0.01, 0.4);
  return { guess: g, slip: P.slip[d], transit: P.transit[d] };
}

/** One Bayesian Knowledge Tracing step. */
export function bktUpdate(p, correct, { guess, slip, transit }) {
  const post = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  return clamp(post + (1 - post) * transit, 0.001, 0.999);
}

function scheduleReview(st, item, correct, turn, events) {
  const q = st.reviewQueue;
  const I = P.reviewIntervals;
  const i = q.findIndex((r) => r.itemId === item.id);
  if (i >= 0) {
    const r = q[i];
    if (correct) {
      r.step += 1;
      if (r.step >= I.length) {
        q.splice(i, 1);
        events.push({ type: 'review-cleared', text: 'Cleared from your review list. 🎉' });
      } else {
        r.dueTurn = turn + I[r.step];
        events.push({
          type: 'review-advanced',
          text: `Nice recovery. It will come back once more in about ${I[r.step]} questions to lock it in.`,
        });
      }
    } else {
      r.step = 0;
      r.misses += 1;
      r.dueTurn = turn + I[0];
      events.push({ type: 'review-requeued', text: `Still on your review list — you'll see it again in ${I[0]} questions.` });
    }
  } else if (!correct) {
    q.push({ itemId: item.id, skillId: item.skill, step: 0, dueTurn: turn + I[0], misses: 1, addedTurn: turn });
    events.push({ type: 'review-added', text: `Added to your review list — it will come back in ${I[0]} questions.` });
  }
}

function flagGap(st, gapSkill, fromSkill, turn) {
  const g = st.gaps[gapSkill];
  if (g && !g.resolved) {
    if (!g.from.includes(fromSkill)) g.from.push(fromSkill);
    return;
  }
  st.gaps[gapSkill] = { from: [fromSkill], turn, resolved: false, resolvedTurn: null };
}

function continueAfterFrame(st, content, frame, events) {
  if (frame.pending && frame.pending.length) {
    const [next, ...rest] = frame.pending;
    st.focus.push({ kind: 'probe', skillId: next, returnTo: frame.returnTo, asked: 0, correct: 0, pending: rest });
    const text = `Let's check another building block: ${skillName(content, next)}.`;
    events.push({ type: 'probe-start', skillId: next, from: frame.returnTo, text });
    st.pendingNote = { type: 'probe', text };
  } else {
    const text = `Back to ${skillName(content, frame.returnTo)}.`;
    events.push({ type: 'return', skillId: frame.returnTo, text });
    st.pendingNote = { type: 'return', text };
  }
}

function maybeStartProbe(st, content, item, turn, events) {
  const skillId = item.skill;
  const prereqs = activePrereqs(content, skillId);
  if (!prereqs.length || st.focus.length >= P.maxFocusDepth) return;
  const last = st.lastProbe[skillId];
  if (last != null && turn - last < P.probeCooldown) return;
  const recent = st.history.filter((h) => h.skillId === skillId && h.mode !== 'placement').slice(-P.probeWindow);
  const misses = recent.filter((h) => !h.correct).length;
  if (misses < P.probeMisses) return;
  const onStack = new Set(st.focus.map((f) => f.skillId));
  const recentlySolid = (p) =>
    st.solidAt[p] != null && turn - st.solidAt[p] < P.solidMemory && st.skills[p].p >= P.masteryThreshold;
  const order = prereqs
    .filter((p) => !onStack.has(p) && !recentlySolid(p))
    .sort((a, b) => st.skills[a].p - st.skills[b].p);
  if (!order.length) return;
  st.lastProbe[skillId] = turn;
  st.focus.push({ kind: 'probe', skillId: order[0], returnTo: skillId, asked: 0, correct: 0, pending: order.slice(1) });
  const text = `Let's check a building block: ${skillName(content, order[0])} (needed for ${skillName(content, skillId)}).`;
  events.push({
    type: 'probe-start',
    skillId: order[0],
    from: skillId,
    text: `You've missed ${misses} recent ${skillName(content, skillId)} questions, so next the tutor will check a building block: ${skillName(content, order[0])}.`,
  });
  st.pendingNote = { type: 'probe', text };
}

function updateFocus(st, content, item, correct, turn, events) {
  const top = st.focus[st.focus.length - 1];
  const topWasProbe = top?.kind === 'probe';
  if (top && top.skillId === item.skill) {
    top.asked += 1;
    if (correct) top.correct += 1;
    if (top.kind === 'probe') {
      const misses = top.asked - top.correct;
      if (top.correct >= 2) {
        st.focus.pop();
        st.solidAt[top.skillId] = turn;
        events.push({
          type: 'probe-solid',
          skillId: top.skillId,
          text: `${skillName(content, top.skillId)} looks solid — not the source of the trouble.`,
        });
        continueAfterFrame(st, content, top, events);
      } else if (misses >= 2) {
        flagGap(st, top.skillId, top.returnTo, turn);
        // The diagnostic result outweighs an older, possibly lucky, high estimate.
        st.skills[top.skillId].p = Math.min(st.skills[top.skillId].p, P.gapCap);
        st.focus[st.focus.length - 1] = {
          kind: 'remediate',
          skillId: top.skillId,
          returnTo: top.returnTo,
          asked: 0,
          correct: 0,
          pending: top.pending,
        };
        const text = `Gap found: ${skillName(content, top.skillId)} is a building block for ${skillName(content, top.returnTo)}. Let's strengthen it first, then go back.`;
        events.push({ type: 'gap-found', skillId: top.skillId, from: top.returnTo, text });
        st.pendingNote = { type: 'gap', text };
      }
    } else if (top.kind === 'remediate') {
      if (isMastered(st, content, top.skillId) || hasRecovered(st, top)) {
        st.focus.pop();
        resolveGap(st, top.skillId, turn);
        events.push({
          type: 'gap-resolved',
          skillId: top.skillId,
          text: `${skillName(content, top.skillId)} is solid now — gap closed.`,
        });
        continueAfterFrame(st, content, top, events);
      } else if (top.asked >= P.remediationMaxItems) {
        st.focus.pop();
        events.push({
          type: 'remediation-paused',
          skillId: top.skillId,
          text: `Let's take a break from ${skillName(content, top.skillId)}. It stays flagged in your gap report so you can come back to it.`,
        });
        continueAfterFrame(st, content, top, events);
      }
    }
  }
  if (!correct && !topWasProbe) {
    const nowTop = st.focus[st.focus.length - 1];
    if (!nowTop || nowTop.skillId === item.skill) maybeStartProbe(st, content, item, turn, events);
  }
}

// Remediation can end before full mastery: the skill estimate is back above the mastery
// threshold, at least 3 remediation questions were answered, and every missed question in the
// skill has been answered correctly at least once since. (Its final spaced review still happens
// later in normal flow, and the skill only shows as mastered after that.)
function hasRecovered(st, frame) {
  const ss = st.skills[frame.skillId];
  const firstReviewPending = st.reviewQueue.some((r) => r.skillId === frame.skillId && r.step === 0);
  return ss.p >= P.masteryThreshold && frame.asked >= 3 && !firstReviewPending;
}

function resolveGap(st, skillId, turn) {
  const g = st.gaps[skillId];
  if (g && !g.resolved) {
    g.resolved = true;
    g.resolvedTurn = turn;
    return true;
  }
  return false;
}

/**
 * Records an answer and updates mastery, review queue, gap routing and unlocks.
 * mode: the mode returned by nextItem ('learn','review','probe','remediate','practice','skill','placement').
 * session: 'auto' (Continue learning), 'review', 'skill' or 'placement'.
 * Returns { correct, skillId, before, after, mastered, events }.
 */
export function recordAnswer(st, content, itemId, correct, { mode = 'learn', session = 'auto' } = {}) {
  const idx = indexContent(content);
  const item = idx.itemById.get(itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  const skillId = item.skill;
  const ss = st.skills[skillId];
  const wasMastered = isMastered(st, content, skillId);
  const before = ss.p;
  const events = [];
  st.turn += 1;
  const turn = st.turn;

  const is = (st.items[itemId] ??= { attempts: 0, correct: 0, misses: 0, lastTurn: 0 });
  is.attempts += 1;
  if (correct) is.correct += 1;
  else is.misses += 1;
  is.lastTurn = turn;

  ss.attempts += 1;
  if (correct) ss.correct += 1;
  ss.lastTurn = turn;

  if (mode === 'placement') {
    ss.p = correct
      ? Math.max(ss.p, item.difficulty >= 2 ? P.placementCorrectHard : P.placementCorrectEasy)
      : Math.min(ss.p, P.placementWrong);
    if (st.placement) {
      st.placement.index += 1;
      if (correct) st.placement.correct += 1;
    }
  } else {
    ss.p = bktUpdate(ss.p, correct, itemParams(item));
  }

  st.history.push({ itemId, skillId, correct, turn, mode });
  if (st.history.length > P.historyLimit) st.history.splice(0, st.history.length - P.historyLimit);
  st.recent = [itemId, ...st.recent.filter((id) => id !== itemId)].slice(0, P.recentWindow);

  if (mode !== 'placement') scheduleReview(st, item, correct, turn, events);

  if (mode === 'learn') {
    if (st.currentSkill === skillId) st.skillStreak += 1;
    else {
      st.currentSkill = skillId;
      st.skillStreak = 1;
    }
  }

  if (session === 'auto' && mode !== 'placement') updateFocus(st, content, item, correct, turn, events);

  // Any flagged gap that is now mastered counts as resolved, even outside remediation.
  for (const [gid, g] of Object.entries(st.gaps)) {
    if (!g.resolved && isMastered(st, content, gid) && resolveGap(st, gid, turn)) {
      if (!events.some((e) => e.type === 'gap-resolved' && e.skillId === gid)) {
        events.push({ type: 'gap-resolved', skillId: gid, text: `${skillName(content, gid)} is solid now — gap closed.` });
      }
    }
  }

  const mastered = isMastered(st, content, skillId);
  if (mastered && !wasMastered) {
    events.push({ type: 'mastered', skillId, text: `Skill mastered: ${skillName(content, skillId)}! ⭐` });
  }
  for (const u of refreshUnlocks(st, content)) {
    events.push({ type: 'unlocked', skillId: u, text: `New skill unlocked: ${skillName(content, u)} 🔓` });
  }

  return { correct, skillId, before, after: ss.p, mastered, events };
}

// ---------------------------------------------------------------- item selection

export function targetDifficulty(p) {
  if (p < 0.4) return 1;
  if (p < 0.75) return 2;
  return 3;
}

/** Picks the best item in a skill: near the target difficulty, not recently seen, preferring unseen. */
export function pickItemForSkill(st, content, skillId, { rng = Math.random, target } = {}) {
  const idx = indexContent(content);
  const items = idx.itemsBySkill.get(skillId) || [];
  if (!items.length) return null;
  const p = st.skills[skillId]?.p ?? P.pInit;
  const tgt = target ?? targetDifficulty(p);
  const queued = new Set(st.reviewQueue.map((r) => r.itemId));
  const recent = new Set(st.recent);
  const last = st.recent[0];
  const tiers = [
    (it) => !recent.has(it.id) && !queued.has(it.id),
    (it) => !recent.has(it.id),
    (it) => it.id !== last,
    () => true,
  ];
  const score = (it) => {
    const s = st.items[it.id];
    let sc = Math.abs(it.difficulty - tgt) * 2;
    if (s) {
      sc += 1 + s.correct * 0.5;
      sc += Math.max(0, 20 - (st.turn - s.lastTurn)) * 0.05;
    }
    return sc + rng() * 0.3;
  };
  for (const ok of tiers) {
    const cands = items.filter(ok);
    if (cands.length) {
      let best = null;
      let bestScore = Infinity;
      for (const it of cands) {
        const sc = score(it);
        if (sc < bestScore) {
          bestScore = sc;
          best = it;
        }
      }
      return best;
    }
  }
  return null;
}

function pickReview(st, content, { dueOnly, skillId } = {}) {
  const idx = indexContent(content);
  const last = st.recent[0];
  const cands = st.reviewQueue
    .filter((r) => (!dueOnly || r.dueTurn <= st.turn) && (!skillId || r.skillId === skillId) && r.itemId !== last)
    .sort((a, b) => a.dueTurn - b.dueTurn);
  return cands.length ? idx.itemById.get(cands[0].itemId) : null;
}

/** Chooses the next skill to learn: an unlocked, unmastered skill whose prerequisites are mastered. */
export function chooseLearnSkill(st, content) {
  const idx = indexContent(content);
  const cands = idx.activeSkills.filter((s) => st.skills[s.id].unlocked && !isMastered(st, content, s.id));
  if (!cands.length) return null;
  const cur = cands.find((s) => s.id === st.currentSkill);
  if (cur && st.skillStreak < P.maxSkillStreak) return cur.id;
  const pool = cur && cands.length > 1 ? cands.filter((s) => s.id !== cur.id) : cands;
  const ready = (s) => (activePrereqs(content, s.id).every((p) => isMastered(st, content, p)) ? 0 : 1);
  const started = (s) => (st.skills[s.id].attempts > 0 ? 0 : 1);
  pool.sort((a, b) => ready(a) - ready(b) || started(a) - started(b) || a.order - b.order);
  return pool[0].id;
}

/**
 * Returns the next question: { item, mode, skillId, note } or null when there is nothing to ask.
 * session: 'auto' | 'review' | 'skill' | 'placement'
 */
export function nextItem(st, content, { session = 'auto', skillId = null, rng = Math.random } = {}) {
  const idx = indexContent(content);
  const wrap = (item, mode, note = null) => (item ? { item, mode, skillId: item.skill, note } : null);

  if (session === 'placement') {
    const pl = st.placement;
    if (!pl || pl.done || pl.index >= pl.queue.length) return null;
    return wrap(idx.itemById.get(pl.queue[pl.index]), 'placement');
  }
  if (session === 'review') {
    return wrap(pickReview(st, content, { dueOnly: false }), 'review');
  }
  if (session === 'skill') {
    const due = pickReview(st, content, { dueOnly: true, skillId });
    return wrap(due || pickItemForSkill(st, content, skillId, { rng }), due ? 'review' : 'skill');
  }

  const note = st.pendingNote;
  st.pendingNote = null;

  while (st.focus.length) {
    const top = st.focus[st.focus.length - 1];
    const P_ = skillName(content, top.skillId);
    const S_ = skillName(content, top.returnTo);
    if (top.kind === 'probe') {
      const p = st.skills[top.skillId].p;
      const item = pickItemForSkill(st, content, top.skillId, { rng, target: p < 0.6 ? 1 : 2 });
      if (item) return wrap(item, 'probe', note || { type: 'probe', text: `Checking a building block: ${P_} (needed for ${S_}).` });
    } else {
      const item = pickReview(st, content, { dueOnly: true, skillId: top.skillId }) || pickItemForSkill(st, content, top.skillId, { rng });
      if (item) return wrap(item, 'remediate', note || { type: 'gap', text: `Strengthening ${P_} before going back to ${S_}.` });
    }
    st.focus.pop();
  }

  const due = pickReview(st, content, { dueOnly: true });
  if (due) return wrap(due, 'review', note);

  const learn = chooseLearnSkill(st, content);
  if (learn) return wrap(pickItemForSkill(st, content, learn, { rng }), 'learn', note);

  // Everything unlocked is mastered: keep practising the weakest skill.
  const weakest = [...idx.activeSkills].sort((a, b) => st.skills[a.id].p - st.skills[b.id].p)[0];
  const firstPractice = st.history[st.history.length - 1]?.mode !== 'practice';
  const practiceNote = firstPractice
    ? { type: 'info', text: 'All Level 1 skills mastered! Keep sharp with mixed practice while Level 2 is built.' }
    : null;
  return wrap(pickItemForSkill(st, content, weakest.id, { rng }), 'practice', note || practiceNote);
}

// ---------------------------------------------------------------- placement

/** Builds a short placement quiz: one medium question per Level 1 skill. */
export function startPlacement(st, content, { rng = Math.random } = {}) {
  const idx = indexContent(content);
  const queue = idx.activeSkills.map((s) => {
    const items = idx.itemsBySkill.get(s.id);
    const medium = items.filter((i) => i.difficulty === 2);
    const pool = medium.length ? medium : items;
    return pool[Math.floor(rng() * pool.length)].id;
  });
  st.placement = { queue, index: 0, correct: 0, done: false, skipped: false };
  return st.placement;
}

export function finishPlacement(st, content, { skipped = false } = {}) {
  if (!st.placement) st.placement = { queue: [], index: 0, correct: 0, done: true, skipped };
  st.placement.done = true;
  st.placement.skipped = skipped;
  refreshUnlocks(st, content);
  return st.placement;
}

// ---------------------------------------------------------------- reporting

export function gapReport(st, content) {
  const idx = indexContent(content);
  const skills = idx.activeSkills.map((s) => {
    const ss = st.skills[s.id];
    return {
      id: s.id,
      name: s.name,
      track: s.track,
      p: ss.p,
      attempts: ss.attempts,
      correct: ss.correct,
      outstanding: outstandingMisses(st, s.id),
      status: skillStatus(st, content, s.id),
    };
  });
  const answered = st.history.length;
  const correct = st.history.filter((h) => h.correct).length;
  const mastered = skills.filter((s) => s.status === 'mastered');
  const weak = skills
    .filter((s) => s.attempts > 0 && s.status !== 'mastered' && (s.p < P.weakThreshold || s.outstanding > 0))
    .sort((a, b) => a.p - b.p);

  const unresolved = Object.entries(st.gaps).filter(([, g]) => !g.resolved);
  const unresolvedIds = new Set(unresolved.map(([id]) => id));
  const rootGaps = unresolved
    .filter(([id]) => !activePrereqs(content, id).some((p) => unresolvedIds.has(p)))
    .map(([id, g]) => ({ id, name: skillName(content, id), neededFor: g.from.map((f) => skillName(content, f)), p: st.skills[id].p }));
  const otherGaps = unresolved
    .filter(([id]) => !rootGaps.some((r) => r.id === id))
    .map(([id, g]) => ({ id, name: skillName(content, id), neededFor: g.from.map((f) => skillName(content, f)), p: st.skills[id].p }));
  const resolvedGaps = Object.entries(st.gaps)
    .filter(([, g]) => g.resolved)
    .map(([id]) => ({ id, name: skillName(content, id) }));

  const queued = new Set(st.reviewQueue.map((r) => r.itemId));
  const mostMissed = Object.entries(st.items)
    .filter(([id, s]) => s.misses > 0 && idx.itemById.has(id))
    .sort((a, b) => b[1].misses - a[1].misses || b[1].lastTurn - a[1].lastTurn)
    .slice(0, 5)
    .map(([id, s]) => {
      const it = idx.itemById.get(id);
      return { id, prompt: it.prompt, skillId: it.skill, skillName: skillName(content, it.skill), misses: s.misses, attempts: s.attempts, inReview: queued.has(id) };
    });

  let recommendation = null;
  if (rootGaps.length) {
    const g = rootGaps[0];
    recommendation = { skillId: g.id, reason: `Root gap: ${g.name} is holding back ${g.neededFor.join(', ')}. Fix it first.` };
  } else if (weak.length) {
    const w = weak.find((s) => s.outstanding > 0) || weak[0];
    recommendation = {
      skillId: w.id,
      reason: w.outstanding > 0 ? `You have ${w.outstanding} missed question(s) waiting in ${w.name}.` : `${w.name} is your weakest skill so far.`,
    };
  } else {
    const next = chooseLearnSkill(st, content);
    if (next) recommendation = { skillId: next, reason: `Next on your path: ${skillName(content, next)}.` };
  }

  return {
    answered,
    correct,
    accuracy: answered ? correct / answered : 0,
    skills,
    mastered,
    weak,
    rootGaps,
    otherGaps,
    resolvedGaps,
    mostMissed,
    reviewCount: st.reviewQueue.length,
    recommendation,
  };
}

// Round 1 learning upgrades: long-term scheduler, confidence, misconceptions, interleaving,
// lessons and the v1 -> v2 migration. Uses the real curriculum and an injected (fake) clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/engine.js';
import * as S from '../js/scheduler.js';
import * as G from '../js/game.js';
import { migrateState, CURRENT_VERSION } from '../js/migrate.js';
import { CONTENT } from '../content/index.js';

const DAY = S.DAY;
const T0 = new Date(2026, 8, 1, 10, 0, 0).getTime(); // 1 Sep 2026, 10:00 local
const idx = E.indexContent(CONTENT);
const item = (id) => idx.itemById.get(id);
const fresh = () => {
  const st = migrateState(E.createState(CONTENT), CONTENT, T0);
  E.finishPlacement(st, CONTENT, { skipped: true });
  return st;
};
const completeLesson = (st, skillId, now = T0) => {
  const l = E.lessonFor(CONTENT, skillId);
  E.markLesson(st, CONTENT, skillId, 'read', null, now);
  for (const w of l.worked) E.markLesson(st, CONTENT, skillId, 'worked', w.id, now);
  for (const f of l.faded) E.markLesson(st, CONTENT, skillId, 'faded', f.id, now);
};
/** Answer the next item; lesson steps are completed automatically. */
function step(st, { correct = () => true, confidence = 'sure', session = 'auto', now = T0, skillId = null } = {}) {
  for (let k = 0; k < 5; k++) {
    const nx = E.nextItem(st, CONTENT, { session, skillId, now, rng: () => 0.42 });
    if (!nx) return null;
    if (nx.mode === 'lesson') {
      if (nx.offer) E.markLesson(st, CONTENT, nx.skillId, 'offered', null, now);
      else completeLesson(st, nx.skillId, now);
      continue;
    }
    const ok = correct(nx);
    const res = E.recordAnswer(st, CONTENT, nx.item.id, ok, { mode: nx.mode, session, confidence, now });
    return { ...nx, res };
  }
  throw new Error('stuck on lesson steps');
}
function makeLearned(st, skillId) {
  completeLesson(st, skillId);
  const ss = st.skills[skillId];
  ss.p = 0.97;
  ss.attempts = Math.max(ss.attempts, 4);
  ss.correct = Math.max(ss.correct, 4);
  ss.unlocked = true;
}

// ------------------------------------------------------------------ scheduler (fake clock)

test('scheduler: first review sets a due date by grade (guess sooner than sure)', () => {
  const guess = S.reviewCard(null, S.gradeFor(true, 'guess'), T0);
  const sure = S.reviewCard(null, S.gradeFor(true, 'sure'), T0);
  const wrong = S.reviewCard(null, S.gradeFor(false, 'sure'), T0);
  assert.ok(guess.due < sure.due, 'correct guess should come back sooner than a sure answer');
  assert.equal(wrong.due, S.addDays(S.startOfDay(T0), 1), 'a miss is due tomorrow');
  assert.equal(sure.due, S.addDays(S.startOfDay(T0), 4));
  assert.equal(new Date(sure.due).getHours(), 0, 'due dates are aligned to local midnight');
});

test('scheduler: intervals grow after successful recalls, and a lapse resets them', () => {
  let card = S.reviewCard(null, 4, T0);
  const intervals = [];
  let now = T0;
  for (let i = 0; i < 5; i++) {
    const prevDue = card.due;
    now = prevDue + 9 * 3600 * 1000; // review on the due day, 09:00
    card = S.reviewCard(card, 3, now);
    intervals.push(Math.round((card.due - S.startOfDay(now)) / DAY));
    assert.ok(card.due > prevDue);
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1], `intervals should grow: ${intervals}`);
  const sBefore = card.s;
  const lapsed = S.reviewCard(card, 1, card.due + 3600 * 1000);
  assert.ok(lapsed.s < sBefore * 0.5, 'stability shrinks after a lapse');
  assert.equal(lapsed.lapses, 1);
  assert.equal(Math.round((lapsed.due - S.startOfDay(card.due)) / DAY), 1, 'lapsed card is due the next day');
});

test('scheduler: same-day success leaves an undue card alone; a due card is moved out of today', () => {
  const card = S.reviewCard(null, 3, T0);
  const again = S.reviewCard(card, 4, T0 + 3600 * 1000);
  assert.equal(again.s, card.s);
  assert.equal(again.due, card.due);
  const dueToday = { ...card, due: S.startOfDay(T0) };
  const moved = S.reviewCard(dueToday, 3, T0 + 3600 * 1000);
  assert.ok(moved.due > T0 + 3600 * 1000, 'a due card answered correctly leaves today\'s queue');
});

test('scheduler: due counts follow the fake clock and retrievability decays', () => {
  const st = fresh();
  st.cards = {
    'hp-01': S.reviewCard(null, 4, T0), // due in 4 days
    'hp-02': S.reviewCard(null, 1, T0), // due tomorrow
    'hp-03': S.reviewCard(null, 2, T0), // due tomorrow (1 day)
  };
  assert.equal(E.dailyDue(st, CONTENT, T0).length, 0);
  assert.equal(E.dailyDue(st, CONTENT, T0 + DAY).length, 2);
  assert.equal(E.dailyDue(st, CONTENT, T0 + 4 * DAY).length, 3);
  assert.ok(S.retrievability(st.cards['hp-01'], T0 + 10 * DAY) < S.retrievability(st.cards['hp-01'], T0 + DAY));
  assert.equal(S.nextDueAt(st), st.cards['hp-02'].due);
});

test('scheduler: day arithmetic survives the DST change', () => {
  const beforeDst = new Date(2026, 9, 31, 12, 0, 0).getTime(); // 31 Oct 2026 (US DST ends 1 Nov)
  for (const n of [1, 2, 3]) {
    const d = new Date(S.addDays(S.startOfDay(beforeDst), n));
    assert.equal(d.getHours(), 0);
    assert.equal(d.getDate(), n === 1 ? 1 : n === 2 ? 2 : 3);
  }
});

test('daily session serves due items with the injected clock and ends when clear', () => {
  const st = fresh();
  completeLesson(st, 'host-processes');
  for (const id of ['hp-01', 'hp-02', 'hp-03']) E.recordAnswer(st, CONTENT, id, id !== 'hp-02', { confidence: 'sure', now: T0 });
  assert.equal(E.nextItem(st, CONTENT, { session: 'daily', now: T0 }), null, 'nothing due on day 0');
  const later = T0 + 5 * DAY;
  const served = new Set();
  for (let i = 0; i < 10; i++) {
    const nx = E.nextItem(st, CONTENT, { session: 'daily', now: later });
    if (!nx) break;
    assert.equal(nx.mode, 'daily');
    served.add(nx.item.id);
    E.recordAnswer(st, CONTENT, nx.item.id, true, { mode: 'daily', session: 'daily', confidence: 'sure', now: later });
  }
  assert.deepEqual([...served].sort(), ['hp-01', 'hp-02', 'hp-03']);
  assert.equal(E.dailyDue(st, CONTENT, later).length, 0);
  // Daily Duty XP needs the daily mode and an empty queue afterwards.
  const g = G.createGame();
  const r = G.onAnswer(g, st, CONTENT, { item: item('hp-01'), correct: true, mode: 'daily', events: [], dueAfter: 0, confidence: 'sure', now: later });
  assert.ok(r.breakdown.some((b) => /due reviews complete/i.test(b.label)), JSON.stringify(r.breakdown));
  assert.equal(g.counters.dailyReviews, 1, 'counts towards the Daily Duty badge');
});

test('mastery decays into "fading" after a long gap and recovers with practice', () => {
  const st = fresh();
  makeLearned(st, 'host-processes');
  st.skills['host-processes'].lastAt = T0;
  for (const id of ['hp-01', 'hp-02', 'hp-03', 'hp-04']) st.cards[id] = S.reviewCard(null, 3, T0);
  assert.equal(E.skillStatus(st, CONTENT, 'host-processes'), 'mastered');
  assert.equal(E.applyDecay(st, CONTENT, T0 + 2 * DAY).length, 0, 'no decay after two days');
  const changes = E.applyDecay(st, CONTENT, T0 + 60 * DAY);
  assert.equal(changes.length, 1);
  assert.ok(st.skills['host-processes'].p >= S.SCHED.decayFloor);
  assert.equal(E.skillStatus(st, CONTENT, 'host-processes'), 'fading');
  for (let i = 0; i < 6 && !E.isMastered(st, CONTENT, 'host-processes'); i++) {
    E.recordAnswer(st, CONTENT, `hp-0${(i % 8) + 1}`, true, { mode: 'skill', session: 'skill', confidence: 'sure', now: T0 + 60 * DAY });
  }
  assert.equal(E.skillStatus(st, CONTENT, 'host-processes'), 'mastered');
});

// ------------------------------------------------------------------ confidence

test('confidence: correct guess < unsure < sure mastery gain', () => {
  const gains = {};
  for (const conf of ['guess', 'unsure', 'sure']) {
    const st = fresh();
    completeLesson(st, 'host-processes');
    const r = E.recordAnswer(st, CONTENT, 'hp-01', true, { confidence: conf, now: T0 });
    gains[conf] = r.after - r.before;
  }
  assert.ok(gains.guess > 0);
  assert.ok(gains.guess < gains.unsure && gains.unsure < gains.sure, JSON.stringify(gains));
});

test('confidence: a correct guess is queued for a sooner re-check and scheduled sooner long-term', () => {
  const st = fresh();
  const r = E.recordAnswer(st, CONTENT, 'hp-01', true, { confidence: 'guess', now: T0 });
  assert.ok(r.events.some((e) => e.type === 'review-guess'));
  const q = st.reviewQueue.find((x) => x.itemId === 'hp-01');
  assert.equal(q.dueTurn, st.turn + E.PARAMS.guessReviewInterval);
  E.recordAnswer(st, CONTENT, 'hp-02', true, { confidence: 'sure', now: T0 });
  assert.ok(st.cards['hp-01'].due < st.cards['hp-02'].due);
  assert.ok(!st.reviewQueue.some((x) => x.itemId === 'hp-02'), 'a sure correct answer is not re-queued');
});

test('confidence: a wrong "Sure" answer is flagged, comes back soon and counts against calibration', () => {
  const st = fresh();
  const r = E.recordAnswer(st, CONTENT, 'hp-04', false, { confidence: 'sure', now: T0 });
  assert.ok(r.events.some((e) => e.type === 'confident-error'));
  assert.equal(st.items['hp-04'].confidentMisses, 1);
  const q = st.reviewQueue.find((x) => x.itemId === 'hp-04');
  assert.equal(q.dueTurn, st.turn + E.PARAMS.sureMissInterval);
  E.recordAnswer(st, CONTENT, 'hp-01', true, { confidence: 'sure', now: T0 });
  E.recordAnswer(st, CONTENT, 'hp-02', true, { confidence: 'guess', now: T0 });
  assert.deepEqual(st.calibration.sure, { n: 2, correct: 1 });
  assert.deepEqual(st.calibration.guess, { n: 1, correct: 1 });
  const rep = E.gapReport(st, CONTENT);
  assert.equal(rep.calibration.sure.accuracy, 0.5);
  assert.equal(rep.confidentErrors[0].id, 'hp-04');
});

test('confidence: the wrong-sure misconception triggers a follow-up in the report', () => {
  const st = fresh();
  const it = item('hp-04');
  const wrong = Object.keys(it.misconceptions)[0];
  const mis = E.misconceptionsForResponse(it, wrong);
  E.recordAnswer(st, CONTENT, it.id, false, { confidence: 'sure', misconceptions: mis, now: T0 });
  const rep = E.gapReport(st, CONTENT);
  assert.equal(rep.misconceptions.active.length, 1);
  assert.equal(rep.misconceptions.active[0].sure, true);
});

// ------------------------------------------------------------------ misconceptions

test('misconceptionsForResponse: mc, multi (wrong pick or missed right answer) and typed answers', () => {
  const mc = CONTENT.items.find((i) => i.type === 'mc' && i.misconceptions);
  const [choice, id] = Object.entries(mc.misconceptions)[0];
  assert.deepEqual(E.misconceptionsForResponse(mc, choice), [id]);
  assert.deepEqual(E.misconceptionsForResponse(mc, mc.answer), []);
  const multi = CONTENT.items.find((i) => i.type === 'multi' && i.misconceptions && Object.keys(i.misconceptions).some((c) => i.answer.includes(c)));
  const missed = Object.keys(multi.misconceptions).find((c) => multi.answer.includes(c));
  const resp = multi.answer.filter((c) => c !== missed);
  assert.ok(E.misconceptionsForResponse(multi, resp).includes(multi.misconceptions[missed]));
  const text = CONTENT.items.find((i) => i.type === 'text' && i.misconceptions);
  const [typed, tid] = Object.entries(text.misconceptions)[0];
  assert.deepEqual(E.misconceptionsForResponse(text, `  ${typed.toUpperCase()} `), [tid]);
});

test('follow-up: a different item testing the same misconception is served within 3 items, then resolves', () => {
  for (const trigger of ['hp-04', 'nt-01', 'ni-01', 'ns-02', 'np-01', 'nd-01', 'nh-01', 'hl-01']) {
    const it = item(trigger);
    if (!it?.misconceptions) continue;
    const st = fresh();
    for (const s of idx.activeSkills) completeLesson(st, s.id);
    const [wrong, mid] = Object.entries(it.misconceptions)[0];
    E.recordAnswer(st, CONTENT, trigger, false, { confidence: 'sure', misconceptions: E.misconceptionsForResponse(it, wrong), now: T0 });
    assert.equal(st.misconceptions[mid].status, 'active');
    let follow = null;
    for (let n = 0; n < 3 && !follow; n++) {
      const nx = E.nextItem(st, CONTENT, { session: 'auto', now: T0, rng: () => 0.5 });
      if (nx.mode === 'followup') follow = nx;
      else E.recordAnswer(st, CONTENT, nx.item.id, true, { mode: nx.mode, confidence: 'sure', now: T0 });
    }
    assert.ok(follow, `${trigger}: no follow-up within 3 items`);
    assert.notEqual(follow.item.id, trigger, 'follow-up must be a different item');
    assert.equal(follow.misconceptionId, mid);
    assert.ok(E.itemMisconceptions(follow.item).includes(mid), 'follow-up must test the same misconception');
    const r = E.recordAnswer(st, CONTENT, follow.item.id, true, { mode: 'followup', confidence: 'sure', now: T0 });
    assert.ok(r.events.some((e) => e.type === 'misconception-resolved' && e.misconceptionId === mid));
    assert.equal(st.misconceptions[mid].status, 'resolved');
    assert.equal(E.gapReport(st, CONTENT).misconceptions.resolved[0].id, mid);
  }
});

test('follow-up: a missed follow-up stays active and is retried later; resolution feeds XP and Myth Buster', () => {
  const st = fresh();
  for (const s of idx.activeSkills) completeLesson(st, s.id);
  const game = G.createGame();
  const resolved = [];
  const seenMis = new Set();
  const triggers = CONTENT.items
    .filter((i) => i.type === 'mc' && i.misconceptions)
    .filter((i) => {
      const m = Object.values(i.misconceptions)[0];
      if (seenMis.has(m)) return false;
      seenMis.add(m);
      return true;
    })
    .slice(0, 5);
  for (const it of triggers) {
    const [wrong, mid] = Object.entries(it.misconceptions)[0];
    if (resolved.includes(mid)) continue;
    E.recordAnswer(st, CONTENT, it.id, false, { confidence: 'unsure', misconceptions: [mid], now: T0 });
    assert.equal(E.pickFollowUp(st, CONTENT), null, 'not on the very next turn after the trigger');
    filler(st, E.PARAMS.followUpDelay, mid); // other items answered in between
    const fu = E.pickFollowUp(st, CONTENT);
    assert.ok(fu && fu.item.id !== it.id);
    if (resolved.length === 0) {
      E.recordAnswer(st, CONTENT, fu.item.id, false, { mode: 'followup', confidence: 'unsure', now: T0 });
      assert.equal(st.misconceptions[mid].status, 'active');
      assert.equal(E.pickFollowUp(st, CONTENT), null, 'retry waits a few items');
      filler(st, E.PARAMS.followUpRetry, mid);
    }
    const fu2 = E.pickFollowUp(st, CONTENT);
    const r = E.recordAnswer(st, CONTENT, fu2.item.id, true, { mode: 'followup', confidence: 'sure', now: T0 });
    const gain = G.onAnswer(game, st, CONTENT, { item: fu2.item, correct: true, mode: 'followup', events: r.events, confidence: 'sure', now: T0 });
    assert.ok(gain.breakdown.some((b) => b.label === 'Misconception resolved'));
    resolved.push(mid);
    void wrong;
  }
  assert.equal(game.counters.misconceptionsResolved, resolved.length);
  assert.equal(resolved.length, 5);
  assert.ok(game.badges['myth-buster'], 'Myth Buster badge after 5 resolutions');
});

/** Answer n untagged-for-mid items correctly (what happens between a trigger and its follow-up). */
function filler(st, n, mid) {
  const pool = CONTENT.items.filter((i) => !E.itemMisconceptions(i).includes(mid) && !st.recent.includes(i.id));
  for (let k = 0; k < n; k++) E.recordAnswer(st, CONTENT, pool[k].id, true, { confidence: 'sure', now: T0 });
}

// ------------------------------------------------------------------ interleaving + mixed practice

test('interleaving: never with fewer than 2 learned skills, and does appear once 2+ are learned', () => {
  const st1 = fresh();
  makeLearned(st1, 'host-processes');
  for (let i = 0; i < 15; i++) {
    const r = step(st1, { correct: (nx) => nx.item.skill !== 'net-osi' || i % 2 === 0 });
    if (E.learnedSkills(st1, CONTENT).length < 2) assert.notEqual(r.mode, 'mixed', 'interleaved with fewer than 2 learned skills');
  }
  const st2 = fresh();
  makeLearned(st2, 'host-processes');
  makeLearned(st2, 'net-osi');
  const seen = [];
  for (let i = 0; i < 12; i++) seen.push(step(st2));
  const mixed = seen.filter((r) => r.mode === 'mixed');
  assert.ok(mixed.length >= 1, `no interleaved items: ${seen.map((r) => r.mode).join(',')}`);
  const learned = new Set(E.learnedSkills(st2, CONTENT));
  for (const m of mixed) assert.ok(learned.has(m.item.skill));
});

test('mixed practice session: locked below 2 learned skills; only draws from learned skills; asks for the area on evidence items', () => {
  const st = fresh();
  assert.equal(E.nextItem(st, CONTENT, { session: 'mixed', now: T0 }), null);
  makeLearned(st, 'host-processes');
  makeLearned(st, 'net-ports');
  const learned = new Set(E.learnedSkills(st, CONTENT));
  let recognize = 0;
  for (let i = 0; i < 12; i++) {
    const nx = E.nextItem(st, CONTENT, { session: 'mixed', now: T0 });
    assert.ok(learned.has(nx.item.skill), `${nx.item.id} is not from a learned skill`);
    assert.equal(nx.recognize, !!nx.item.snippet);
    if (nx.recognize) recognize += 1;
    E.recordAnswer(st, CONTENT, nx.item.id, true, { mode: nx.mode, session: 'mixed', confidence: 'sure', now: T0 });
  }
  assert.ok(recognize > 0);
  E.recordRecognition(st, true);
  E.recordRecognition(st, false);
  assert.deepEqual(E.gapReport(st, CONTENT).recognition, { asked: 2, recognized: 1 });
});

// ------------------------------------------------------------------ lessons

test('lessons: the first visit to a skill shows its lesson before any question', () => {
  const st = fresh();
  const nx = E.nextItem(st, CONTENT, { session: 'auto', now: T0 });
  assert.equal(nx.mode, 'lesson');
  assert.equal(nx.item, null);
  assert.equal(nx.offer, false);
  const sid = nx.skillId;
  assert.ok(E.needsLesson(st, CONTENT, sid));
  const l = E.lessonFor(CONTENT, sid);
  assert.deepEqual(E.markLesson(st, CONTENT, sid, 'read', null, T0), []);
  assert.equal(E.nextItem(st, CONTENT, { session: 'auto', now: T0 }).mode, 'lesson', 'reading alone does not finish the lesson');
  assert.deepEqual(E.markLesson(st, CONTENT, sid, 'worked', l.worked[0].id, T0).map((e) => e.type), ['worked-example']);
  const evts = E.markLesson(st, CONTENT, sid, 'faded', l.faded[0].id, T0).map((e) => e.type);
  assert.deepEqual(evts, ['faded-example', 'lesson-complete']);
  assert.deepEqual(E.markLesson(st, CONTENT, sid, 'faded', l.faded[0].id, T0), [], 'events only fire once');
  const q = E.nextItem(st, CONTENT, { session: 'auto', now: T0 });
  assert.ok(q.item && q.item.skill === sid);
  // lesson XP hooks
  const g = G.createGame();
  const r = G.onLearningEvent(g, st, CONTENT, { type: 'lesson-complete', now: T0 });
  assert.ok(r.xp > 0);
});

test('lessons: skipping is allowed; a skill drill also gates on the lesson', () => {
  const st = fresh();
  const sid = E.nextItem(st, CONTENT, { session: 'auto', now: T0 }).skillId;
  E.markLesson(st, CONTENT, sid, 'skip', null, T0);
  assert.ok(E.nextItem(st, CONTENT, { session: 'auto', now: T0 }).item);
  const other = idx.activeSkills.find((s) => s.id !== sid && s.prereqs.length === 0).id;
  st.skills[other].unlocked = true;
  const nx = E.nextItem(st, CONTENT, { session: 'skill', skillId: other, now: T0 });
  assert.equal(nx.mode, 'lesson');
  assert.equal(nx.skillId, other);
});

test('lessons: skills placed out in placement bypass the lesson (still available)', () => {
  const st = migrateState(E.createState(CONTENT), CONTENT, T0);
  E.startPlacement(st, CONTENT);
  const placed = [];
  for (let i = 0; i < 4; i++) {
    const nx = E.nextItem(st, CONTENT, { session: 'placement', now: T0 });
    E.recordAnswer(st, CONTENT, nx.item.id, true, { mode: 'placement', session: 'placement', now: T0 });
    placed.push(nx.item.skill);
  }
  E.finishPlacement(st, CONTENT, { skipped: true });
  for (const sid of placed) {
    assert.equal(E.lessonState(st, sid).bypassed, true, `${sid} not bypassed`);
    assert.equal(E.needsLesson(st, CONTENT, sid), false);
    assert.ok(E.lessonFor(CONTENT, sid), 'lesson is still available');
  }
  const nx = E.nextItem(st, CONTENT, { session: 'skill', skillId: placed[0], now: T0 });
  assert.ok(nx.item, 'placed-out skill goes straight to questions');
});

test('lessons: gap routing to an unseen prerequisite offers its lesson once', () => {
  const st = fresh();
  let offer = null;
  let cleared = false;
  for (let n = 0; n < 60 && !offer; n++) {
    const nx = E.nextItem(st, CONTENT, { session: 'auto', now: T0, rng: () => 0.3 });
    if (nx.mode === 'lesson') {
      if (nx.offer) offer = nx;
      else completeLesson(st, nx.skillId);
      continue;
    }
    const hasPrereq = idx.skillById.get(nx.item.skill).prereqs.length > 0;
    if (hasPrereq && !cleared) {
      // Simulate a prerequisite learned before lessons existed (e.g. practised in v1).
      for (const p of idx.skillById.get(nx.item.skill).prereqs) delete st.lessons[p];
      cleared = true;
    }
    E.recordAnswer(st, CONTENT, nx.item.id, !hasPrereq, { mode: nx.mode, confidence: 'unsure', now: T0 });
  }
  assert.ok(offer, 'no lesson offer during gap routing');
  assert.equal(offer.note.type, 'probe');
  E.markLesson(st, CONTENT, offer.skillId, 'offered', null, T0);
  const next = E.nextItem(st, CONTENT, { session: 'auto', now: T0, rng: () => 0.3 });
  assert.ok(next.item, 'after the offer the probe question follows');
  assert.equal(next.item.skill, offer.skillId);
});

// ------------------------------------------------------------------ migration from a real v1 save

test('migration: a real v1 save from main becomes current with schedule, lessons and XP', () => {
  const raw = fs.readFileSync(new URL('./fixtures/v1-save-from-main.json', import.meta.url), 'utf8');
  const v1 = JSON.parse(raw);
  assert.equal(v1.version, 1);
  const st = migrateState(JSON.parse(raw), CONTENT, T0);
  assert.equal(st.version, CURRENT_VERSION);
  assert.equal(CURRENT_VERSION, 3);
  const attempted = Object.entries(v1.items).filter(([, s]) => s.attempts > 0).map(([id]) => id);
  assert.equal(Object.keys(st.cards).length, attempted.length, 'one long-term card per attempted item');
  for (const q of v1.reviewQueue) assert.ok(st.cards[q.itemId].due <= T0, `${q.itemId} (still in v1 review) should be due today`);
  for (const [id, c] of Object.entries(st.cards)) {
    assert.ok(c.due >= S.startOfDay(T0), `${id} due in the past`);
    assert.ok(c.s > 0 && c.d >= 1 && c.d <= 10);
  }
  for (const s of idx.activeSkills) {
    const mastered = E.isMastered(st, CONTENT, s.id);
    assert.equal(!!E.lessonState(st, s.id).completed, mastered, `${s.id}: lesson flag should follow mastery`);
    if (st.skills[s.id].attempts) assert.equal(st.skills[s.id].lastAt, T0);
  }
  assert.ok(st.game.xp > 0);
  assert.equal(st.history.length, v1.history.length);
  assert.deepEqual(st.calibration.sure, { n: 0, correct: 0 });
  // idempotent
  const again = migrateState(JSON.parse(JSON.stringify(st)), CONTENT, T0 + DAY);
  assert.deepEqual(again, st);
  // the migrated student can keep going: daily review works and the next item is sensible
  assert.ok(E.dailyDue(st, CONTENT, T0).length >= v1.reviewQueue.length);
  const nx = E.nextItem(st, CONTENT, { session: 'auto', now: T0 });
  assert.ok(nx);
});

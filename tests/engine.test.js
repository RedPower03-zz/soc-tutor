import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { CONTENT } from '../content/index.js';

// ---- a tiny fake curriculum: a -> b -> c (c requires b, b requires a)
function makeItems(skill, n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${skill}-${i + 1}`,
    skill,
    difficulty: (i % 3) + 1,
    type: 'mc',
    prompt: `Question ${i + 1} about ${skill}`,
    choices: ['right', 'wrong 1', 'wrong 2', 'wrong 3'],
    answer: 'right',
    explanation: 'Because.',
  }));
}

function fakeContent() {
  return {
    skills: [
      { id: 'a', name: 'Skill A', order: 1, prereqs: [] },
      { id: 'b', name: 'Skill B', order: 2, prereqs: ['a'] },
      { id: 'c', name: 'Skill C', order: 3, prereqs: ['b'] },
      { id: 'z', name: 'Future skill', order: 9, prereqs: ['c'], comingSoon: true },
    ],
    items: [...makeItems('a', 9), ...makeItems('b', 9), ...makeItems('c', 9)],
  };
}

const fixedRng = () => 0;

function forceMastered(st, content, id) {
  Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
  E.refreshUnlocks(st, content);
}

function answer(st, content, next, correct, session = 'auto') {
  return E.recordAnswer(st, content, next.item.id, correct, { mode: next.mode, session });
}

// ------------------------------------------------------------------ mastery

test('BKT: correct answers raise mastery, wrong answers lower it', () => {
  const params = { guess: 0.25, slip: 0.1, transit: 0.1 };
  assert.ok(E.bktUpdate(0.3, true, params) > 0.3);
  assert.ok(E.bktUpdate(0.7, false, params) < 0.7);
});

test('difficulty weighting: hard correct gains more, easy miss costs more', () => {
  const base = { type: 'mc', choices: ['a', 'b', 'c', 'd'] };
  const easy = E.itemParams({ ...base, difficulty: 1 });
  const hard = E.itemParams({ ...base, difficulty: 3 });
  assert.ok(E.bktUpdate(0.4, true, hard) > E.bktUpdate(0.4, true, easy));
  assert.ok(E.bktUpdate(0.8, false, easy) < E.bktUpdate(0.8, false, hard));
  // typed answers are hard to guess, so a correct one is stronger evidence than multiple choice
  const text = E.itemParams({ type: 'text', difficulty: 2 });
  const mc = E.itemParams({ ...base, difficulty: 2 });
  assert.ok(E.bktUpdate(0.4, true, text) > E.bktUpdate(0.4, true, mc));
});

test('new state: only skills without prerequisites are unlocked; coming-soon skills are excluded', () => {
  const content = fakeContent();
  const st = E.createState(content);
  assert.equal(E.skillStatus(st, content, 'a'), 'new');
  assert.equal(E.skillStatus(st, content, 'b'), 'locked');
  assert.equal(E.skillStatus(st, content, 'z'), 'coming-soon');
  assert.equal(st.skills.z, undefined);
});

test('mastery needs enough attempts, then unlocks dependent skills', () => {
  const content = fakeContent();
  const st = E.createState(content);
  const hard = content.items.filter((i) => i.skill === 'a' && i.difficulty === 3);
  const events = [];
  for (let i = 0; i < 3; i++) events.push(...E.recordAnswer(st, content, hard[i % hard.length].id, true).events);
  assert.ok(st.skills.a.p >= E.PARAMS.masteryThreshold, 'probability is high after 3 hard correct answers');
  assert.equal(E.isMastered(st, content, 'a'), false, 'but 3 attempts is not enough evidence');
  const r = E.recordAnswer(st, content, 'a-1', true);
  assert.equal(E.isMastered(st, content, 'a'), true);
  assert.ok(r.events.some((e) => e.type === 'mastered' && e.skillId === 'a'));
  assert.ok(r.events.some((e) => e.type === 'unlocked' && e.skillId === 'b'));
  assert.equal(E.skillStatus(st, content, 'b'), 'new');
});

test('a skill is not mastered while it has missed items waiting for review', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');
  E.recordAnswer(st, content, 'a-2', false);
  st.skills.a.p = 0.99; // even with a very high estimate...
  assert.equal(E.outstandingMisses(st, 'a'), 1);
  assert.equal(E.isMastered(st, content, 'a'), false);
  st.reviewQueue = [];
  assert.equal(E.isMastered(st, content, 'a'), true);
});

// ------------------------------------------------------------------ review queue

test('missed items return after a few questions, then after a longer interval, then clear', () => {
  const content = fakeContent();
  const st = E.createState(content);
  const [first, second] = E.PARAMS.reviewIntervals;

  const r = E.recordAnswer(st, content, 'a-1', false, { mode: 'learn' });
  assert.ok(r.events.some((e) => e.type === 'review-added'));
  assert.deepEqual(
    st.reviewQueue.map((q) => [q.itemId, q.dueTurn]),
    [['a-1', 1 + first]],
  );

  // Not shown again until it is due.
  let turnsUntilReview = 0;
  for (;;) {
    const next = E.nextItem(st, content, { rng: fixedRng });
    if (next.item.id === 'a-1') {
      assert.equal(next.mode, 'review');
      break;
    }
    assert.notEqual(next.mode, 'review');
    answer(st, content, next, true);
    turnsUntilReview++;
    assert.ok(turnsUntilReview <= first, 'review should come back once due');
  }
  assert.equal(turnsUntilReview, first, `exactly ${first} other questions in between`);

  // Correct review -> scheduled further out.
  let res = E.recordAnswer(st, content, 'a-1', true, { mode: 'review' });
  assert.ok(res.events.some((e) => e.type === 'review-advanced'));
  const entry = st.reviewQueue.find((q) => q.itemId === 'a-1');
  assert.equal(entry.step, 1);
  assert.equal(entry.dueTurn, st.turn + second);

  // Second correct review -> cleared.
  res = E.recordAnswer(st, content, 'a-1', true, { mode: 'review' });
  assert.ok(res.events.some((e) => e.type === 'review-cleared'));
  assert.equal(st.reviewQueue.length, 0);
});

test('missing a review again resets it to the short interval', () => {
  const content = fakeContent();
  const st = E.createState(content);
  E.recordAnswer(st, content, 'a-1', false);
  E.recordAnswer(st, content, 'a-1', true, { mode: 'review' });
  E.recordAnswer(st, content, 'a-1', false, { mode: 'review' });
  const entry = st.reviewQueue.find((q) => q.itemId === 'a-1');
  assert.equal(entry.step, 0);
  assert.equal(entry.misses, 2);
  assert.equal(entry.dueTurn, st.turn + E.PARAMS.reviewIntervals[0]);
});

test('"Review missed items" session serves queued items and ends when the queue is empty', () => {
  const content = fakeContent();
  const st = E.createState(content);
  E.recordAnswer(st, content, 'a-1', false);
  E.recordAnswer(st, content, 'a-4', false);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const next = E.nextItem(st, content, { session: 'review' });
    if (!next) break;
    seen.push(next.item.id);
    answer(st, content, next, true, 'review');
  }
  assert.equal(st.reviewQueue.length, 0);
  assert.ok(seen.includes('a-1') && seen.includes('a-4'));
});

// ------------------------------------------------------------------ item selection

test('item selection never repeats the previous item (real content, random answers)', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const st = E.createState(CONTENT);
  let prev = null;
  for (let i = 0; i < 400; i++) {
    const next = E.nextItem(st, CONTENT, { rng });
    assert.ok(next, 'always has a next item');
    if (next.mode === 'lesson') {
      // lessons come first for new skills; this test is about question selection
      E.markLesson(st, CONTENT, next.skillId, next.offer ? 'offered' : 'skip');
      continue;
    }
    assert.notEqual(next.item.id, prev, `turn ${i}: ${next.item.id} repeated immediately`);
    prev = next.item.id;
    answer(st, CONTENT, next, rng() < 0.7);
  }
});

test('item selection targets difficulty from the mastery estimate', () => {
  const content = fakeContent();
  const st = E.createState(content);
  st.skills.a.p = 0.1;
  assert.equal(E.pickItemForSkill(st, content, 'a', { rng: fixedRng }).difficulty, 1);
  st.skills.a.p = 0.6;
  assert.equal(E.pickItemForSkill(st, content, 'a', { rng: fixedRng }).difficulty, 2);
  st.skills.a.p = 0.9;
  assert.equal(E.pickItemForSkill(st, content, 'a', { rng: fixedRng }).difficulty, 3);
});

test('learning prefers unlocked skills and never serves locked ones', () => {
  const content = fakeContent();
  const st = E.createState(content);
  for (let i = 0; i < 20; i++) {
    const next = E.nextItem(st, content, { rng: fixedRng });
    assert.ok(st.skills[next.item.skill].unlocked, `served locked skill ${next.item.skill}`);
    answer(st, content, next, true);
  }
  assert.ok(E.isMastered(st, content, 'a'));
  assert.ok(st.history.some((h) => h.skillId === 'b'), 'moves on to b after mastering a');
});

test('interleaves to another skill after a long streak on one skill', () => {
  const content = {
    skills: [
      { id: 'x', name: 'X', order: 1, prereqs: [] },
      { id: 'y', name: 'Y', order: 2, prereqs: [] },
    ],
    items: [...makeItems('x', 12), ...makeItems('y', 12)],
  };
  const st = E.createState(content);
  st.currentSkill = 'x';
  st.skillStreak = E.PARAMS.maxSkillStreak;
  assert.equal(E.chooseLearnSkill(st, content), 'y');
});

// ------------------------------------------------------------------ gap routing

test('repeated misses probe prerequisites; a weak prerequisite is flagged as the root gap and fixed first', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');

  let next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.item.skill, 'b');
  answer(st, content, next, false);
  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.item.skill, 'b');
  const r = answer(st, content, next, false);
  assert.ok(r.events.some((e) => e.type === 'probe-start' && e.skillId === 'a'), 'second miss starts a probe');

  // The tutor switches to the prerequisite with a note.
  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.mode, 'probe');
  assert.equal(next.item.skill, 'a');
  assert.match(next.note.text, /building block: Skill A/);

  // Student misses the diagnostic questions -> root gap.
  answer(st, content, next, false);
  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.mode, 'probe');
  const g = answer(st, content, next, false);
  assert.ok(g.events.some((e) => e.type === 'gap-found' && e.skillId === 'a'));
  assert.deepEqual(st.gaps.a.from, ['b']);
  assert.ok(st.skills.a.p <= E.PARAMS.gapCap, 'a flagged gap lowers the mastery estimate');
  assert.equal(E.skillStatus(st, content, 'a'), 'gap');

  const report = E.gapReport(st, content);
  assert.deepEqual(report.rootGaps.map((x) => x.id), ['a']);
  assert.equal(report.recommendation.skillId, 'a');

  // Remediation stays on the gap skill until it is solid, then returns to b.
  let returned = false;
  for (let i = 0; i < 20; i++) {
    next = E.nextItem(st, content, { rng: fixedRng });
    if (next.mode !== 'remediate') {
      returned = true;
      break;
    }
    assert.equal(next.item.skill, 'a');
    answer(st, content, next, true);
  }
  assert.ok(returned, 'remediation finishes');
  assert.equal(st.gaps.a.resolved, true);
  assert.equal(st.focus.length, 0);
  assert.equal(next.note?.type, 'return');
  assert.match(next.note.text, /Back to Skill B/);
});

test('if the prerequisite checks out, the tutor returns without flagging a gap', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');
  E.recordAnswer(st, content, 'b-1', false, { mode: 'learn' });
  E.recordAnswer(st, content, 'b-2', false, { mode: 'learn' });
  assert.equal(st.focus[0].kind, 'probe');

  for (let i = 0; i < 2; i++) {
    const next = E.nextItem(st, content, { rng: fixedRng });
    assert.equal(next.mode, 'probe');
    const r = answer(st, content, next, true);
    if (i === 1) {
      assert.ok(r.events.some((e) => e.type === 'probe-solid'));
      assert.ok(r.events.some((e) => e.type === 'return'));
    }
  }
  assert.equal(st.focus.length, 0);
  assert.equal(st.gaps.a, undefined);
  const next = E.nextItem(st, content, { rng: fixedRng });
  assert.notEqual(next.mode, 'probe');
});

test('a 1-1 split on the diagnostic asks a third question (best of three)', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');
  E.recordAnswer(st, content, 'b-1', false);
  E.recordAnswer(st, content, 'b-2', false);
  let next = E.nextItem(st, content, { rng: fixedRng });
  answer(st, content, next, true);
  next = E.nextItem(st, content, { rng: fixedRng });
  answer(st, content, next, false);
  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.mode, 'probe', 'still probing after a 1-1 split');
  answer(st, content, next, true);
  assert.equal(st.gaps.a, undefined, '2 of 3 correct counts as solid');
  assert.equal(st.focus.length, 0);
});

test('gap finding digs down to the deepest weak prerequisite', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');
  forceMastered(st, content, 'b');
  assert.equal(E.skillStatus(st, content, 'c'), 'new');

  E.recordAnswer(st, content, 'c-1', false);
  E.recordAnswer(st, content, 'c-2', false); // probe b
  let next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.item.skill, 'b');
  answer(st, content, next, false);
  next = E.nextItem(st, content, { rng: fixedRng });
  answer(st, content, next, false); // gap: b, remediate b
  assert.equal(st.gaps.b.resolved, false);

  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.mode, 'remediate');
  const r = answer(st, content, next, false); // still missing b -> probe a
  assert.ok(r.events.some((e) => e.type === 'probe-start' && e.skillId === 'a'));

  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.mode, 'probe');
  assert.equal(next.item.skill, 'a');
  answer(st, content, next, false);
  next = E.nextItem(st, content, { rng: fixedRng });
  answer(st, content, next, false); // gap: a

  const report = E.gapReport(st, content);
  assert.deepEqual(report.rootGaps.map((x) => x.id), ['a'], 'a is the root gap');
  assert.deepEqual(report.otherGaps.map((x) => x.id), ['b'], 'b is a gap caused by a');
  assert.equal(report.recommendation.skillId, 'a');
  next = E.nextItem(st, content, { rng: fixedRng });
  assert.equal(next.item.skill, 'a', 'session routes to the root gap first');
});

test('no probing during skill-practice sessions or for skills without prerequisites', () => {
  const content = fakeContent();
  const st = E.createState(content);
  E.recordAnswer(st, content, 'a-1', false);
  E.recordAnswer(st, content, 'a-2', false);
  assert.equal(st.focus.length, 0, 'a has no prerequisites');
  forceMastered(st, content, 'a');
  st.reviewQueue = [];
  E.recordAnswer(st, content, 'b-1', false, { mode: 'skill', session: 'skill' });
  E.recordAnswer(st, content, 'b-2', false, { mode: 'skill', session: 'skill' });
  assert.equal(st.focus.length, 0);
});

// ------------------------------------------------------------------ placement & answers

test('placement quiz: one question per skill, seeds mastery, no review entries', () => {
  const st = E.createState(CONTENT);
  const pl = E.startPlacement(st, CONTENT, { rng: fixedRng });
  const idx = E.indexContent(CONTENT);
  assert.equal(pl.queue.length, idx.activeSkills.length);
  assert.equal(new Set(pl.queue.map((id) => idx.itemById.get(id).skill)).size, idx.activeSkills.length);
  let i = 0;
  for (;;) {
    const next = E.nextItem(st, CONTENT, { session: 'placement' });
    if (!next) break;
    answer(st, CONTENT, next, i % 2 === 0, 'placement');
    i++;
  }
  E.finishPlacement(st, CONTENT);
  assert.equal(st.placement.done, true);
  assert.equal(st.reviewQueue.length, 0);
  const first = idx.itemById.get(pl.queue[0]);
  const second = idx.itemById.get(pl.queue[1]);
  assert.ok(st.skills[first.skill].p >= E.PARAMS.placementCorrectEasy);
  assert.ok(st.skills[second.skill].p <= E.PARAMS.placementWrong);
});

test('answer checking: mc exact, multi needs the exact set, text is case/space-insensitive', () => {
  const mc = { type: 'mc', choices: ['x', 'y'], answer: 'x' };
  assert.equal(E.checkAnswer(mc, 'x'), true);
  assert.equal(E.checkAnswer(mc, 'y'), false);
  const multi = { type: 'multi', choices: ['a', 'b', 'c'], answer: ['a', 'b'] };
  assert.equal(E.checkAnswer(multi, ['b', 'a']), true);
  assert.equal(E.checkAnswer(multi, ['a']), false);
  assert.equal(E.checkAnswer(multi, ['a', 'b', 'c']), false);
  const text = { type: 'text', accept: ['System32', 'C:\\Windows\\System32'] };
  assert.equal(E.checkAnswer(text, '  system32 '), true);
  assert.equal(E.checkAnswer(text, 'c:\\windows\\system32'), true);
  assert.equal(E.checkAnswer(text, 'System32.'), true);
  assert.equal(E.checkAnswer(text, ''), false);
  assert.equal(E.checkAnswer(text, 'syswow64'), false);
});

test('state survives a JSON round trip (localStorage) and fills in new skills', () => {
  const content = fakeContent();
  const st = E.createState(content);
  E.recordAnswer(st, content, 'a-1', false);
  const copy = E.ensureState(JSON.parse(JSON.stringify(st)), content);
  assert.deepEqual(copy, st);
  delete copy.skills.b;
  E.ensureState(copy, content);
  assert.ok(copy.skills.b);
});

test('a prerequisite that just tested solid is not re-probed right away', () => {
  const content = fakeContent();
  const st = E.createState(content);
  forceMastered(st, content, 'a');
  E.recordAnswer(st, content, 'b-1', false);
  E.recordAnswer(st, content, 'b-2', false);
  for (let i = 0; i < 2; i++) answer(st, content, E.nextItem(st, content, { rng: fixedRng }), true);
  assert.equal(st.focus.length, 0);
  st.turn += E.PARAMS.probeCooldown; // past the cooldown, but a was confirmed solid recently
  E.recordAnswer(st, content, 'b-4', false);
  E.recordAnswer(st, content, 'b-5', false);
  assert.equal(st.focus.length, 0, 'no second probe of a');
});

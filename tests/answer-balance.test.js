// Guards against the "longest answer is right" giveaway in multiple-choice items.
//
// Iterates over EVERY registered skill (CONTENT.skills) and every level, so
// content added later - new skills, generated items - is checked too.
//
// Metrics (single-answer `mc` items only; `multi` and `text` are exempt):
//   longest share  - % of MCQs whose correct choice is the *uniquely* longest
//                    option (ties do not count: a tie gives no cue).
//   shortest share - % whose correct choice is the uniquely shortest option.
//                    Capped too, so balancing does not create the reverse cue.
//   mean ratio     - mean over MCQs of len(correct) / mean(len(distractors)).
//
// Thresholds (tuned on the balanced v8 pool; random placement with four
// similar-length options gives ~25% for both shares and a ratio of ~1.0):
//   longest share  <= 35%   (asked for; before balancing the pool was at 77%)
//   shortest share <= 45%   (looser: short correct answers are a weaker cue)
//   mean ratio     <= 1.15  (before balancing: 2.44)
// Share checks apply per skill when the skill has >= MIN_MCQ MCQs (smaller
// samples are too noisy) and always per level. The ratio applies to both.
// Additionally, no single item may have a correct answer that is both
// >= 1.75x the mean distractor length AND >= 15 characters longer than the
// longest distractor - that is an obvious giveaway even in a balanced pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../content/index.js';

const MAX_LONGEST_SHARE = 0.35;
const MAX_SHORTEST_SHARE = 0.45;
const MAX_MEAN_RATIO = 1.15;
const MIN_MCQ = 5;
const ITEM_RATIO_CAP = 1.75;
const ITEM_CHAR_CAP = 15;

const len = (s) => String(s).length;

function stats(mcqs) {
  let longest = 0;
  let shortest = 0;
  let ratioSum = 0;
  for (const it of mcqs) {
    const a = len(it.answer);
    const others = it.choices.filter((c) => c !== it.answer).map(len);
    if (others.every((o) => a > o)) longest++;
    if (others.every((o) => a < o)) shortest++;
    ratioSum += a / (others.reduce((x, y) => x + y, 0) / others.length);
  }
  const n = mcqs.length || 1;
  return { n: mcqs.length, longest: longest / n, shortest: shortest / n, ratio: ratioSum / n };
}

const mcqs = CONTENT.items.filter((it) => it.type === 'mc' && !it.retired);
const skillLevel = new Map(CONTENT.skills.map((s) => [s.id, s.level ?? 1]));
const pct = (x) => `${Math.round(x * 100)}%`;

test('every registered skill: correct answer is not a length giveaway', () => {
  const problems = [];
  for (const skill of CONTENT.skills) {
    const pool = mcqs.filter((it) => it.skill === skill.id);
    if (!pool.length) continue;
    const s = stats(pool);
    if (s.ratio > MAX_MEAN_RATIO) problems.push(`${skill.id}: mean correct/distractor length ratio ${s.ratio.toFixed(2)} > ${MAX_MEAN_RATIO}`);
    if (s.n < MIN_MCQ) continue;
    if (s.longest > MAX_LONGEST_SHARE) problems.push(`${skill.id}: correct answer uniquely longest in ${pct(s.longest)} of ${s.n} MCQs (max ${pct(MAX_LONGEST_SHARE)})`);
    if (s.shortest > MAX_SHORTEST_SHARE) problems.push(`${skill.id}: correct answer uniquely shortest in ${pct(s.shortest)} of ${s.n} MCQs (max ${pct(MAX_SHORTEST_SHARE)})`);
  }
  assert.deepEqual(problems, []);
});

test('every level: correct answer is not a length giveaway', () => {
  const levels = [...new Set(CONTENT.skills.map((s) => s.level ?? 1))];
  const problems = [];
  for (const level of levels) {
    const pool = mcqs.filter((it) => (skillLevel.get(it.skill) ?? 1) === level);
    if (!pool.length) continue;
    const s = stats(pool);
    if (s.longest > MAX_LONGEST_SHARE) problems.push(`L${level}: uniquely longest ${pct(s.longest)}`);
    if (s.shortest > MAX_SHORTEST_SHARE) problems.push(`L${level}: uniquely shortest ${pct(s.shortest)}`);
    if (s.ratio > MAX_MEAN_RATIO) problems.push(`L${level}: mean ratio ${s.ratio.toFixed(2)}`);
  }
  assert.deepEqual(problems, []);
});

test('no single MCQ has a glaringly longer correct answer', () => {
  const problems = [];
  for (const it of mcqs) {
    const a = len(it.answer);
    const others = it.choices.filter((c) => c !== it.answer).map(len);
    const mean = others.reduce((x, y) => x + y, 0) / others.length;
    if (a >= ITEM_RATIO_CAP * mean && a - Math.max(...others) >= ITEM_CHAR_CAP) {
      problems.push(`${it.id}: correct ${a} chars vs distractors ${others.join('/')}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the balance metric itself flags a biased pool', () => {
  const biased = Array.from({ length: 10 }, (_, i) => ({
    id: `x${i}`, type: 'mc', answer: 'the long and detailed correct answer',
    choices: ['the long and detailed correct answer', 'short', 'brief', 'tiny'],
  }));
  const s = stats(biased);
  assert.ok(s.longest > MAX_LONGEST_SHARE && s.ratio > MAX_MEAN_RATIO);
});

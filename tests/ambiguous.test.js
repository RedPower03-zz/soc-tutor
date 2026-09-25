// Ambiguous SIEM cases: content integrity, reasoning-under-uncertainty scorer, XP and badges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import * as S from '../js/siem.js';
import { CONTENT } from '../content/index.js';
import { NEXT_STEPS, CONFIDENCE, VERDICTS } from '../content/siem-cases.js';

const NOW = new Date(2026, 8, 28, 14).getTime();
const amb = CONTENT.siemCases.filter((c) => c.ambiguous);
const byId = (id) => amb.find((c) => c.id === id);
const keyPins = (c) => c.key.map((k) => k.rows[0]);
const goodWriteup = (c) => `${c.writeup.map((w) => w.any[0]).join(', ')}: that is my reasoning.`;
const model = (c) => ({ ...S.modelAmbiguous(c), pins: keyPins(c), writeup: goodWriteup(c), queries: c.parQueries });
const other = (c) => Object.keys(c.defensible).find((v) => v !== c.verdict);

test('ambiguous cases (3 in Level 1, 1+ in Level 2), medium and hard, each with a preferred and a second defensible verdict', () => {
  assert.equal(amb.filter((c) => !c.tier || c.tier === 'l1').length, 3);
  assert.ok(amb.some((c) => c.tier === 'l2'), 'a Level 2 ambiguous case');
  const diffs = amb.map((c) => c.difficulty);
  assert.ok(diffs.includes(2) && diffs.includes(3), 'a mix of medium and hard');
  assert.ok(diffs.every((d) => d >= 2));
  for (const c of amb) {
    assert.equal(c.defensible[c.verdict], 1, `${c.id}: preferred call has full credit`);
    const alts = Object.entries(c.defensible).filter(([v]) => v !== c.verdict);
    assert.ok(alts.length >= 1 && alts.every(([v, x]) => VERDICTS[v] && x > 0 && x < 1), `${c.id}: a second defensible call with partial credit`);
    assert.ok(Object.keys(VERDICTS).some((v) => !c.defensible[v]), `${c.id}: at least one call is not defensible`);
  }
});

test('ambiguous content: gaps, rated next steps, confidence map, arguments, settle and outcome', () => {
  const stepIds = NEXT_STEPS.map((x) => x.id);
  for (const c of amb) {
    assert.ok(c.gaps.filter((g) => g.correct).length >= 2 && c.gaps.some((g) => !g.correct), `${c.id}: real gaps and distractors`);
    assert.equal(new Set(c.gaps.map((g) => g.id)).size, c.gaps.length);
    for (const g of c.gaps) assert.ok(g.text && g.why, `${c.id}/${g.id}`);
    assert.deepEqual(Object.keys(c.steps).sort(), [...stepIds].sort(), `${c.id}: every next step is rated`);
    for (const [id, r] of Object.entries(c.steps)) assert.ok(['best', 'ok', 'bad'].includes(r.rating) && r.why, `${c.id}/${id}`);
    assert.ok(Object.values(c.steps).some((r) => r.rating === 'bad'), `${c.id}: some next steps are harmful`);
    assert.deepEqual(Object.keys(c.confidence).sort(), Object.keys(CONFIDENCE).sort());
    assert.equal(c.confidence.high, 0, `${c.id}: "high" is overconfident on an ambiguous case`);
    for (const v of Object.keys(c.defensible)) assert.ok(c.arguments[v], `${c.id}: argument for ${v}`);
    assert.ok(c.settle.length >= 2 && c.strong.length >= 3 && c.explanation);
    assert.ok(c.outcome?.title && c.outcome.text && VERDICTS[c.outcome.verdict]);
    // the key evidence includes at least one "gap" row from the ops/health source
    assert.ok(c.key.some((k) => k.rows.some((r) => c.logs.find((x) => x.id === r).src === 'ops')), `${c.id}: the gap is visible in the logs`);
  }
  // one outcome contradicts the preferred call: the grade is on reasoning, not the outcome
  assert.ok(amb.some((c) => c.outcome.verdict !== c.verdict));
});

test('a model answer scores 100; the second defensible verdict still passes', () => {
  for (const c of amb) {
    const r = S.scoreCase(c, model(c));
    assert.equal(r.ambiguous, true);
    assert.equal(r.total, 100, c.id);
    assert.ok(r.passed && r.verdict.preferred && r.confidence.note === 'calibrated');
    const alt = S.scoreCase(c, { ...model(c), verdict: other(c) });
    assert.ok(alt.verdict.defensible && !alt.verdict.preferred);
    assert.ok(alt.passed, `${c.id}: the other defensible call with good reasoning passes`);
    assert.equal(alt.total, 100 - (S.AMBIG_WEIGHTS.verdict - Math.round(c.defensible[other(c)] * S.AMBIG_WEIGHTS.verdict)));
  }
});

test('reasoning outweighs the verdict: a lucky preferred call with no reasoning fails', () => {
  for (const c of amb) {
    const lucky = S.scoreCase(c, { verdict: c.verdict, confidence: 'high', gaps: [], steps: [], pins: [], writeup: '' });
    assert.equal(lucky.total, S.AMBIG_WEIGHTS.verdict);
    assert.equal(lucky.passed, false);
    const reasoned = S.scoreCase(c, { ...model(c), verdict: other(c), pins: [] });
    assert.ok(reasoned.total > lucky.total + 40, `${c.id}: good reasoning with the other defensible call beats a lucky guess`);
    // an indefensible verdict never passes, however good the rest is
    const bad = Object.keys(VERDICTS).find((v) => !c.defensible[v]);
    const r = S.scoreCase(c, { ...model(c), verdict: bad });
    assert.equal(r.verdict.points, 0);
    assert.equal(r.passed, false);
  }
  assert.ok(S.AMBIG_WEIGHTS.gaps + S.AMBIG_WEIGHTS.steps >= 50, 'half the score is on what is missing and what to do next');
  assert.equal(Object.values(S.AMBIG_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('confidence: calibrated earns full marks, overconfident "high" earns nothing', () => {
  const c = byId('siem-devsync-gap');
  const at = (confidence) => S.scoreCase(c, { ...model(c), confidence }).confidence;
  assert.equal(at('medium').points, S.AMBIG_WEIGHTS.confidence);
  assert.equal(at('medium').note, 'calibrated');
  assert.equal(at('high').points, 0);
  assert.equal(at('high').note, 'overconfident');
  assert.ok(at('low').points > 0 && at('low').points < S.AMBIG_WEIGHTS.confidence);
  assert.equal(at('low').note, 'underconfident');
  assert.equal(at(null).points, 0);
  const a = byId('siem-new-country');
  assert.equal(S.scoreCase(a, { ...model(a), confidence: 'low' }).confidence.points, S.AMBIG_WEIGHTS.confidence);
});

test('what is missing: false gaps cancel real ones; ticking everything does not pay', () => {
  const c = byId('siem-new-country');
  const real = c.gaps.filter((g) => g.correct).map((g) => g.id);
  const fake = c.gaps.filter((g) => !g.correct).map((g) => g.id);
  assert.equal(S.scoreCase(c, { ...model(c), gaps: real }).gaps.points, S.AMBIG_WEIGHTS.gaps);
  const one = S.scoreCase(c, { ...model(c), gaps: [real[0]] }).gaps;
  assert.equal(one.points, Math.round(S.AMBIG_WEIGHTS.gaps / real.length));
  assert.deepEqual(one.missed, real.slice(1));
  const mixed = S.scoreCase(c, { ...model(c), gaps: [real[0], fake[0]] }).gaps;
  assert.equal(mixed.points, 0);
  assert.deepEqual(mixed.wrong, [fake[0]]);
  const all = S.scoreCase(c, { ...model(c), gaps: c.gaps.map((g) => g.id) }).gaps;
  assert.ok(all.points <= Math.round(S.AMBIG_WEIGHTS.gaps * (real.length - fake.length) / real.length) || all.points === 0);
  assert.ok(all.points < S.AMBIG_WEIGHTS.gaps);
});

test('next steps: best steps score, "ok" steps are neutral, harmful steps cost', () => {
  for (const c of amb) {
    const ids = Object.keys(c.steps);
    const best = ids.filter((id) => c.steps[id].rating === 'best');
    const ok = ids.filter((id) => c.steps[id].rating === 'ok');
    const bad = ids.filter((id) => c.steps[id].rating === 'bad');
    assert.equal(S.scoreCase(c, { ...model(c), steps: [...best, ...ok] }).steps.points, S.AMBIG_WEIGHTS.steps, `${c.id}: ok steps are neutral`);
    const withBad = S.scoreCase(c, { ...model(c), steps: [...best, bad[0]] }).steps;
    assert.equal(withBad.points, Math.round(((best.length - 1) / best.length) * S.AMBIG_WEIGHTS.steps));
    assert.deepEqual(withBad.bad, [bad[0]]);
    const everything = S.scoreCase(c, { ...model(c), steps: ids }).steps;
    assert.ok(everything.points < S.AMBIG_WEIGHTS.steps, `${c.id}: ticking every step does not pay`);
    assert.equal(S.scoreCase(c, { ...model(c), steps: bad }).steps.points, 0);
  }
});

test('evidence on ambiguous cases: smaller weight, smaller capped noise penalty', () => {
  const c = byId('siem-psexec-noticket');
  const keyRows = new Set(c.key.flatMap((k) => k.rows));
  const noise = c.logs.map((r) => r.id).filter((r) => !keyRows.has(r) && !c.related.includes(r));
  assert.ok(noise.length >= 2);
  assert.equal(S.scoreCase(c, { ...model(c), pins: [...keyPins(c), noise[0]] }).evidence.points, S.AMBIG_WEIGHTS.evidence - S.AMBIG_NOISE_PENALTY);
  assert.equal(S.scoreCase(c, { ...model(c), pins: c.logs.map((r) => r.id) }).evidence.penalty, S.AMBIG_MAX_NOISE_PENALTY);
});

test('XP: same rate as other cases by difficulty, only improvement pays; Grey Area needs calibration and no harmful steps', () => {
  const c = byId('siem-psexec-noticket');
  const st = E.createState(CONTENT);
  const game = G.createGame();
  const run = (sub) => {
    const result = S.scoreCase(c, sub);
    const rec = S.recordCase(st, c, result, NOW);
    return { result, rec, g: G.onInvestigation(game, st, CONTENT, { caseDef: c, result, firstSolve: rec.firstSolve, now: NOW }) };
  };
  const over = run({ ...model(c), confidence: 'high' });
  assert.ok(over.result.passed && over.rec.firstSolve);
  assert.equal(over.g.xp, Math.round((G.XP_RULES.siemCase[c.difficulty] * over.result.total) / 100));
  assert.equal(game.counters.calibratedCalls, 0, 'overconfident: no Grey Area');
  assert.equal(game.counters.casesSolved, 1);
  assert.equal(game.counters.benignCleared, 1, 'preferred call here is benign');
  const harmful = run({ ...model(c), steps: [...model(c).steps, 'reimage'] });
  assert.equal(game.counters.calibratedCalls, 0, 'a harmful next step: no Grey Area');
  const best = run(model(c));
  assert.equal(best.g.xp, Math.round((G.XP_RULES.siemCase[c.difficulty] * (100 - Math.max(over.result.total, harmful.result.total))) / 100));
  assert.equal(game.counters.calibratedCalls, 1);
  assert.ok(game.badges['grey-area']);
  assert.ok(over.g.xp + harmful.g.xp + best.g.xp <= G.XP_RULES.siemCase[c.difficulty]);
});

test('ambiguous cases count toward the SIEM-case rank gates and the XP budget', () => {
  const st = E.createState(CONTENT);
  const gate = { type: 'cases', count: 3 };
  assert.equal(G.gateRows(gate, st, CONTENT).met, false);
  for (const c of amb) st.siem.cases[c.id] = { solved: true };
  const row = G.gateRows(gate, st, CONTENT);
  assert.ok(row.met, 'three solved ambiguous cases meet the "3 SIEM cases" gate');
  assert.equal(row.current, 3);
  const b = G.xpBudget(CONTENT);
  assert.equal(b.siem, CONTENT.siemCases.reduce((a, c) => a + G.XP_RULES.siemCase[c.difficulty], 0));
  assert.ok(b.siem >= 780 + amb.reduce((a, c) => a + G.XP_RULES.siemCase[c.difficulty], 0));
  assert.equal(b.atTotal.rank.id, G.reachableRank(CONTENT).id, 'the budget reaches the top rank the content opens');
});

test('ambiguous cases unlock from their Level 1 skills', () => {
  const st = E.createState(CONTENT);
  for (const c of amb) assert.equal(S.caseUnlocked(c, E.learnedSkills(st, CONTENT)), false);
  const c = byId('siem-new-country');
  for (const s of c.requires.skills) Object.assign(st.skills[s], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
  assert.equal(S.caseUnlocked(c, E.learnedSkills(st, CONTENT)), true);
});

// Capstone "First shift as a Tier 1 analyst": content, stage unlocks, rubric, completion and rank gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import * as C from '../js/capstone.js';
import { CONTENT } from '../content/index.js';

const NOW = new Date(2026, 8, 28, 14).getTime();
const sc = CONTENT.scenarios.find((s) => s.id === 'first-shift');
const idx = E.indexContent(CONTENT);
const doLesson = (st, id) => (st.lessons[id] = { read: true, worked: [], faded: [], completed: true, skipped: false, bypassed: false, offered: true });
const rightAnswers = (stage) => Object.fromEntries(stage.questions.map((q) => [q.id, q.answer]));
const allLessons = (st) => sc.stages.flatMap((s) => s.requires.lessons).forEach((l) => doLesson(st, l));
const finishStages = (st) => {
  allLessons(st);
  for (const stage of sc.stages) C.recordStage(st, sc, stage, rightAnswers(stage), NOW);
};

test('capstone content: 4 stages through firewall, DNS, process tree and logons, all valid', () => {
  assert.ok(sc && sc.kind === 'capstone' && sc.status === 'available');
  assert.equal(sc.stages.length, 4);
  assert.deepEqual(sc.stages.map((s) => s.evidence.rows[0].src), ['firewall', 'dns', 'process', 'winevt']);
  const qids = new Set();
  for (const stage of sc.stages) {
    assert.ok(stage.brief && stage.evidence.rows.length >= 5, stage.id);
    for (const l of stage.requires.lessons) assert.ok(idx.lessonBySkill.has(l), `${stage.id}: no lesson for ${l}`);
    for (const q of stage.questions) {
      assert.ok(!qids.has(q.id), `duplicate question ${q.id}`);
      qids.add(q.id);
      assert.ok(q.prompt && q.explanation && q.choices.length >= 3);
      const ans = q.type === 'multi' ? q.answer : [q.answer];
      for (const a of ans) assert.ok(q.choices.includes(a), `${q.id}: answer not among choices`);
    }
  }
  const F = sc.escalation.fields;
  for (const f of ['hosts', 'users', 'iocs', 'actions']) for (const c of F[f].correct) assert.ok(F[f].options.includes(c), `${f}: ${c}`);
  for (const c of F.timeline.correct) assert.ok(F.timeline.options.some((o) => o.id === c));
  for (const f of ['hosts', 'users', 'timeline', 'iocs', 'actions']) assert.ok(F[f].options.length > F[f].correct.length, `${f} needs distractors`);
  assert.equal(Object.values(sc.escalation.weights).reduce((a, b) => a + b, 0), 100, 'rubric totals 100');
});

test('stages unlock in order, and only after their related lessons', () => {
  const st = E.createState(CONTENT);
  const s1 = C.stageStatus(sc, 'fs-1', st, CONTENT);
  assert.equal(s1.unlocked, false);
  assert.deepEqual(s1.missingLessons, sc.stages[0].requires.lessons);
  sc.stages[0].requires.lessons.forEach((l) => doLesson(st, l));
  assert.equal(C.stageStatus(sc, 'fs-1', st, CONTENT).unlocked, true);
  sc.stages[1].requires.lessons.forEach((l) => doLesson(st, l));
  const s2 = C.stageStatus(sc, 'fs-2', st, CONTENT);
  assert.equal(s2.unlocked, false, 'stage 2 waits for stage 1');
  assert.equal(s2.needsPrevious, 'fs-1');
  C.recordStage(st, sc, sc.stages[0], rightAnswers(sc.stages[0]), NOW);
  assert.equal(C.stageStatus(sc, 'fs-2', st, CONTENT).unlocked, true);
  assert.equal(C.stageStatus(sc, 'fs-3', st, CONTENT).unlocked, false);
  assert.equal(C.escalationUnlocked(sc, st), false);
});

test('a placed-out (bypassed) lesson or a mastered skill also satisfies a stage requirement', () => {
  const st = E.createState(CONTENT);
  const [a, b] = sc.stages[0].requires.lessons;
  st.lessons[a] = { completed: false, bypassed: true, worked: [], faded: [] };
  Object.assign(st.skills[b], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
  assert.equal(C.stageStatus(sc, 'fs-1', st, CONTENT).unlocked, true);
  st.lessons[a] = { completed: false, skipped: true, worked: [], faded: [] };
  assert.equal(C.stageStatus(sc, 'fs-1', st, CONTENT).unlocked, false, 'skipping a lesson is not completing it');
});

test('stage scoring: mc and multi-select, best kept, stage done once answered', () => {
  const st = E.createState(CONTENT);
  allLessons(st);
  const stage = sc.stages[1];
  const multi = stage.questions.find((q) => q.type === 'multi');
  assert.ok(multi, 'the DNS stage has a multi-select IOC question');
  const answers = rightAnswers(stage);
  answers[multi.id] = [multi.answer[0]];
  const r1 = C.scoreStage(stage, answers);
  assert.equal(r1.correct, stage.questions.length - 1);
  assert.equal(C.scoreStage(stage, { ...answers, [multi.id]: [...multi.answer].reverse() }).score, 100, 'order does not matter');
  const rec = C.recordStage(st, sc, stage, answers, NOW);
  assert.ok(rec.first);
  assert.equal(C.stageDone(st, sc.id, stage.id), true);
  const rec2 = C.recordStage(st, sc, stage, rightAnswers(stage), NOW);
  assert.equal(rec2.prevBest, r1.score);
  assert.equal(rec2.best, 100);
  assert.equal(rec2.first, false);
});

test('escalation rubric: the model answer scores 100', () => {
  const r = C.scoreEscalation(sc, C.modelReport(sc));
  assert.equal(r.total, 100);
  assert.ok(r.passed);
  assert.equal(r.rows.length, 7);
});

test('escalation rubric: over-ticking cancels out, severity is graded, a short summary earns nothing', () => {
  const F = sc.escalation.fields;
  const W = sc.escalation.weights;
  const everything = { ...C.modelReport(sc), iocs: [...F.iocs.options], actions: [...F.actions.options], hosts: [...F.hosts.options] };
  const r = C.scoreEscalation(sc, everything);
  const row = (res, f) => res.rows.find((x) => x.field === f);
  assert.ok(row(r, 'iocs').points < W.iocs, 'ticking every IOC loses points');
  assert.ok(row(r, 'actions').points < W.actions / 2, 'harmful actions cost as much as good ones earn');
  assert.deepEqual(row(r, 'actions').detail.wrong.length, F.actions.options.length - F.actions.correct.length);
  const sev = (s) => row(C.scoreEscalation(sc, { ...C.modelReport(sc), severity: s }), 'severity').points;
  assert.equal(sev('critical'), W.severity);
  assert.ok(sev('high') > sev('medium') && sev('medium') > sev('low'));
  assert.equal(sev('low'), 0);
  const short = C.scoreEscalation(sc, { ...C.modelReport(sc), summary: 'dana phish' });
  assert.equal(row(short, 'summary').points, 0);
  assert.equal(row(short, 'summary').detail.tooShort, true);
  const empty = C.scoreEscalation(sc, {});
  assert.equal(empty.total, 0);
  assert.equal(empty.passed, false);
});

test('scoreSet: (right − wrong) / correct, floored at zero', () => {
  assert.equal(C.scoreSet(['a', 'b'], ['a', 'b']).credit, 1);
  assert.equal(C.scoreSet(['a'], ['a', 'b']).credit, 0.5);
  assert.equal(C.scoreSet(['a', 'x'], ['a', 'b']).credit, 0);
  assert.equal(C.scoreSet(['x', 'y', 'z'], ['a', 'b']).credit, 0);
});

test('completion: a passing escalation sets completedAt, pays XP once per improvement, awards badges and feeds the rank gate', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  // stage XP
  allLessons(st);
  for (const stage of sc.stages) {
    const result = C.recordStage(st, sc, stage, rightAnswers(stage), NOW);
    assert.equal(G.onCapstoneStage(game, st, CONTENT, { stage, result, now: NOW }).xp, G.XP_RULES.capstoneStage);
  }
  const again = C.recordStage(st, sc, sc.stages[0], rightAnswers(sc.stages[0]), NOW);
  assert.equal(G.onCapstoneStage(game, st, CONTENT, { stage: sc.stages[0], result: again, now: NOW }).xp, 0, 'replay pays nothing');
  assert.equal(C.escalationUnlocked(sc, st), true);
  // weak report: not complete yet
  const weak = C.recordEscalation(st, sc, { summary: 'short', severity: 'low' }, NOW);
  assert.equal(weak.passed, false);
  assert.equal(st.capstones[sc.id].completedAt, null);
  G.onEscalation(game, st, CONTENT, { scenario: sc, result: weak, now: NOW });
  assert.equal(game.counters.capstonesDone, 0);
  // model report
  const good = C.recordEscalation(st, sc, C.modelReport(sc), NOW + 1);
  assert.ok(good.firstCompletion);
  assert.equal(st.capstones[sc.id].completedAt, NOW + 1);
  const xp = G.onEscalation(game, st, CONTENT, { scenario: sc, result: good, now: NOW + 1 });
  assert.equal(xp.xp, Math.round((G.XP_RULES.escalation * (100 - weak.total)) / 100));
  assert.ok(game.badges['shift-complete'] && game.badges['clean-handoff']);
  assert.equal(game.counters.cleanHandoffs, 1);
  const again2 = C.recordEscalation(st, sc, C.modelReport(sc), NOW + 2);
  assert.equal(again2.firstCompletion, false);
  assert.equal(G.onEscalation(game, st, CONTENT, { scenario: sc, result: again2, now: NOW + 2 }).xp, 0);
  assert.equal(game.counters.capstonesDone, 1);
  assert.equal(st.capstones[sc.id].completedAt, NOW + 1, 'completion time is kept');
  // rank gate
  const gate = G.RANKS.find((r) => r.id === 'tier1-3').gates.find((g) => g.type === 'scenario');
  assert.equal(G.gateRows(gate, st, CONTENT).met, true);
  assert.equal(G.gateRows(gate, E.createState(CONTENT), CONTENT).met, false);
});

test('capstone progress summary for the dashboard', () => {
  const st = E.createState(CONTENT);
  assert.deepEqual(C.capstoneProgress(sc, st), { stagesDone: 0, stages: 4, escalated: false, completed: false, score: null });
  finishStages(st);
  C.recordEscalation(st, sc, C.modelReport(sc), NOW);
  assert.deepEqual(C.capstoneProgress(sc, st), { stagesDone: 4, stages: 4, escalated: true, completed: true, score: 100 });
});

test('capstone data is fictional: documentation or private IPs only', () => {
  const text = JSON.stringify(sc);
  for (const m of text.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![.\d])/g)) {
    const [a, b, c] = m[1].split('.').map(Number);
    const ok = a === 10 || (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || (a === 77 && b === 100);
    assert.ok(ok, m[1]);
  }
  for (const m of text.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(com|net|org|io)\b/gi)) assert.match(m[0], /example\.(com|net|org)$/i);
});

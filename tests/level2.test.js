// Level 2 SOC Operations: skills, lessons, questions, misconceptions, SIEM cases and the
// Night-shift lead capstone (content checks, unlocks, rubric, XP and the Senior Analyst I gate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import * as C from '../js/capstone.js';
import * as S from '../js/siem.js';
import { CONTENT } from '../content/index.js';

const NOW = new Date(2026, 8, 28, 14).getTime();
const idx = E.indexContent(CONTENT);
const l2 = CONTENT.skills.filter((s) => s.level === 2);
const l1ids = new Set(CONTENT.skills.filter((s) => (s.level ?? 1) === 1).map((s) => s.id));
const l2ids = new Set(l2.map((s) => s.id));
const master = (st, id) => Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
const lessonOf = (id) => CONTENT.lessons.find((l) => l.skill === id);

test('Level 2 skills: the IDs the career gates expect, live, ordered after Level 1', () => {
  for (const id of ['l2-alert-triage', 'l2-siem', 'l2-phishing', 'l2-malware', 'l2-attack', 'l2-ir', 'l2-hunting']) assert.ok(l2ids.has(id), id);
  assert.ok(l2.every((s) => !s.comingSoon && idx.activeIds.has(s.id) && s.track === 'soc'));
  for (const r of G.RANKS) for (const g of r.gates || []) for (const s of g.skills || []) if (s.startsWith('l2-')) assert.ok(l2ids.has(s), `${r.id} gate skill ${s}`);
});

test('Level 2 prerequisites: rooted in Level 1, no cycles, every chain reaches a Level 1 skill', () => {
  const byId = new Map(CONTENT.skills.map((s) => [s.id, s]));
  const reachesL1 = (id, seen = new Set()) => {
    assert.ok(!seen.has(id), `cycle at ${id}`);
    seen.add(id);
    const s = byId.get(id);
    return s.prereqs.some((p) => l1ids.has(p) || reachesL1(p, new Set(seen)));
  };
  for (const s of l2) {
    assert.ok(s.prereqs.length >= 1, `${s.id} has prerequisites`);
    for (const p of s.prereqs) assert.ok(byId.has(p), `${s.id}: unknown prereq ${p}`);
    assert.ok(reachesL1(s.id), `${s.id} builds on Level 1`);
  }
  // a fresh student cannot jump into Level 2
  const st = E.createState(CONTENT);
  for (const s of l2) assert.equal(E.isUnlocked ? E.isUnlocked(st, CONTENT, s.id) : st.skills[s.id].unlocked, false, `${s.id} starts locked`);
});

test('each Level 2 skill: 10+ questions, mixed formats, artifacts to read, typed recall, all difficulties', () => {
  for (const s of l2) {
    const items = CONTENT.items.filter((i) => i.skill === s.id);
    const types = new Set(items.map((i) => i.type));
    assert.ok(items.length >= 10, `${s.id}: ${items.length} items`);
    assert.ok(types.has('mc') && types.has('text') && types.size >= 3, `${s.id}: formats ${[...types]}`);
    assert.ok(items.filter((i) => i.snippet).length >= 1, `${s.id}: needs log/header/artifact reading`);
    assert.deepEqual([...new Set(items.map((i) => i.difficulty))].sort(), [1, 2, 3], `${s.id}: easy, medium and hard`);
  }
});

test('each Level 2 skill: a lesson (4-6 sections, worked + faded example) and 3+ misconceptions with fixes', () => {
  for (const s of l2) {
    const l = lessonOf(s.id);
    assert.ok(l, `${s.id}: lesson`);
    assert.ok(l.sections.length >= 4 && l.sections.length <= 6, `${s.id}: ${l.sections.length} sections`);
    assert.ok(l.worked.length >= 1 && l.faded.length >= 1, `${s.id}: worked and faded examples`);
    const mis = CONTENT.misconceptions.filter((m) => m.skill === s.id);
    assert.ok(mis.length >= 3, `${s.id}: ${mis.length} misconceptions`);
    for (const m of mis) assert.ok(m.fix.length > 60 && m.lesson?.startsWith(`${s.id}#`), `${m.id}: targeted fix and lesson link`);
  }
});

test('Level 2 accuracy anchors: NIST IR phases, ATT&CK IDs, SPF/DKIM/DMARC, static vs dynamic, hypothesis-driven hunting', () => {
  const text = (id) => JSON.stringify([lessonOf(id), CONTENT.items.filter((i) => i.skill === id)]).toLowerCase();
  const ir = text('l2-ir');
  for (const k of ['800-61', 'containment', 'eradication', 'recovery', 'lessons']) assert.ok(ir.includes(k), `IR: ${k}`);
  const ph = text('l2-phishing');
  for (const k of ['spf', 'dkim', 'dmarc', 'alignment', 'authentication-results']) assert.ok(ph.includes(k), `phishing: ${k}`);
  const mw = text('l2-malware');
  for (const k of ['static', 'dynamic', 'sandbox', 'sha256']) assert.ok(mw.includes(k), `malware: ${k}`);
  const hu = text('l2-hunting');
  for (const k of ['hypothes', 'baseline']) assert.ok(hu.includes(k), `hunting: ${k}`);
  assert.match(text('l2-attack'), /t1003|t1059|t1566/, 'ATT&CK technique IDs');
});

test('Level 2 SIEM cases: 4+, an ambiguous one, a phishing case with email headers, unlock from Level 2 skills', () => {
  const cases = CONTENT.siemCases.filter((c) => c.tier === 'l2');
  assert.ok(cases.length >= 4);
  assert.ok(cases.some((c) => c.ambiguous), 'an ambiguous Level 2 case');
  const phish = cases.find((c) => c.requires.skills.includes('l2-phishing'));
  assert.ok(phish && phish.logs.some((r) => r.src === 'email' && /spf=|dkim=|dmarc=/i.test(r.msg)), 'phishing case shows authentication results');
  const learnedL1 = [...l1ids];
  for (const c of cases) {
    assert.ok(c.requires.skills.some((s) => l2ids.has(s)), `${c.id} relies on a Level 2 skill`);
    assert.equal(S.caseUnlocked(c, learnedL1), false, `${c.id} stays locked with only Level 1`);
    assert.equal(S.caseUnlocked(c, [...learnedL1, ...l2ids]), true, `${c.id} opens with Level 2`);
  }
});

// ------------------------------------------------------------------ Night-shift lead capstone

const sc = CONTENT.scenarios.find((s) => s.id === 'night-shift-lead');
const rightAnswers = (stage) => Object.fromEntries(stage.questions.map((q) => [q.id, q.answer]));
const doLessons = (st) => sc.stages.flatMap((s) => s.requires.lessons).forEach((id) => (st.lessons[id] = { read: true, worked: [], faded: [], completed: true, skipped: false, bypassed: false, offered: true }));

test('Night-shift lead: a queue of 6+ alerts, 4 stages on Level 2 lessons, valid questions', () => {
  assert.ok(sc && sc.kind === 'capstone' && sc.status === 'available' && sc.tier === 'l2');
  assert.ok(sc.stages[0].evidence.rows.length >= 6, 'a real queue to triage');
  assert.equal(sc.stages.length, 4);
  const qids = new Set();
  for (const stage of sc.stages) {
    assert.ok(stage.requires.lessons.length && stage.requires.lessons.every((l) => l2ids.has(l) && lessonOf(l)), `${stage.id}: Level 2 lessons`);
    for (const q of stage.questions) {
      assert.ok(!qids.has(q.id));
      qids.add(q.id);
      assert.ok(q.prompt && q.explanation && q.choices.length >= 3);
      for (const a of q.type === 'multi' ? q.answer : [q.answer]) assert.ok(q.choices.includes(a), `${q.id}: answer among choices`);
    }
  }
  const covered = new Set(sc.stages.flatMap((s) => s.requires.lessons));
  for (const id of ['l2-alert-triage', 'l2-ir']) assert.ok(covered.has(id), `stages rely on ${id}`);
});

test('Night-shift handover: rubric totals 100, set fields have distractors, model answer scores 100', () => {
  const F = sc.escalation.fields;
  const W = sc.escalation.weights;
  assert.equal(Object.values(W).reduce((a, b) => a + b, 0), 100);
  for (const f of Object.keys(W)) {
    assert.ok(F[f], `field ${f}`);
    if (C.fieldKind(F[f]) === 'set') {
      const ids = F[f].options.map((o) => (typeof o === 'object' ? o.id : o));
      for (const c of F[f].correct) assert.ok(ids.includes(c), `${f}: ${c}`);
      assert.ok(F[f].options.length > F[f].correct.length, `${f} needs distractors`);
    }
    if (C.fieldKind(F[f]) === 'choice') assert.equal(F[f].credit[sc.escalation.model[f]], 1, `${f}: model choice has full credit`);
  }
  for (const f of ['summary', 'severity', 'phase', 'queue', 'timeline', 'iocs', 'actions']) assert.ok(W[f] > 0, `handover scores ${f}`);
  const model = C.modelReport(sc);
  const r = C.scoreEscalation(sc, model);
  assert.equal(r.total, 100);
  assert.equal(r.rows.length, Object.keys(W).length);
  // wrong phase and ticking every queue alert both cost points
  const wrong = C.scoreEscalation(sc, { ...model, phase: 'lessons-learned', queue: [...F.queue.options] });
  assert.ok(wrong.total <= 100 - W.phase - W.queue / 2);
  assert.equal(C.scoreEscalation(sc, {}).passed, false);
  // every panel field exists and every scored field is on a panel
  const onPanels = sc.escalation.panels.flatMap((p) => p.fields);
  assert.deepEqual([...onPanels].sort(), Object.keys(W).sort());
});

test('Night-shift lead: completion pays its own XP rates and opens Senior Analyst I', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  doLessons(st);
  let stageXp = 0;
  for (const stage of sc.stages) {
    assert.equal(C.stageStatus(sc, stage.id, st, CONTENT).unlocked, true, stage.id);
    const result = C.recordStage(st, sc, stage, rightAnswers(stage), NOW);
    stageXp += G.onCapstoneStage(game, st, CONTENT, { stage, result, now: NOW, scenario: sc }).xp;
  }
  assert.equal(stageXp, sc.stages.length * sc.xp.stage);
  const result = C.recordEscalation(st, sc, C.modelReport(sc), NOW);
  assert.ok(result.firstCompletion && st.capstones[sc.id].completedAt);
  assert.equal(G.onEscalation(game, st, CONTENT, { scenario: sc, result, now: NOW }).xp, sc.xp.report);
  assert.ok(game.badges['shift-lead'], 'Shift Lead badge');
  // rank gate
  game.xp = G.RANKS.find((r) => r.id === 'senior-1').xp;
  idx.activeSkills.forEach((s) => master(st, s.id));
  for (const c of CONTENT.siemCases) st.siem.cases[c.id] = { solved: true };
  st.capstones['first-shift'] = { completedAt: NOW };
  assert.ok(G.rankIndex(G.computeRank(game, st, CONTENT).id) >= G.rankIndex('senior-1'));
});

test('First shift keeps its default XP rates (the override is per scenario)', () => {
  const fs = CONTENT.scenarios.find((s) => s.id === 'first-shift');
  assert.deepEqual(G.capstoneRates(fs), { stage: G.XP_RULES.capstoneStage, report: G.XP_RULES.escalation });
  assert.deepEqual(G.capstoneRates(sc), { stage: 50, report: 500 });
});

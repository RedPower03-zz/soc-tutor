// Level 3 Advanced: skills, lessons, questions, misconceptions, SIEM cases, the Major incident
// capstone (content checks, unlocks, rubric, XP) and the rescaled Level 3 career band.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import * as C from '../js/capstone.js';
import * as S from '../js/siem.js';
import { CONTENT } from '../content/index.js';

const NOW = new Date(2026, 9, 3, 9).getTime();
const idx = E.indexContent(CONTENT);
const l3 = CONTENT.skills.filter((s) => s.level === 3);
const l3ids = new Set(l3.map((s) => s.id));
const below = new Set(CONTENT.skills.filter((s) => (s.level ?? 1) < 3).map((s) => s.id));
const master = (st, id) => Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
const lessonOf = (id) => CONTENT.lessons.find((l) => l.skill === id);
const rankXp = (id) => G.RANKS.find((r) => r.id === id).xp;

test('Level 3 skills: the IDs the career gates expect, live, on the advanced track', () => {
  for (const id of ['l3-pki', 'l3-crypto', 'l3-identity', 'l3-cloud', 'l3-forensics', 'l3-detection']) assert.ok(l3ids.has(id), id);
  assert.ok(l3.every((s) => !s.comingSoon && idx.activeIds.has(s.id) && s.track === 'advanced'));
  assert.equal(CONTENT.tracks.find((t) => t.id === 'advanced').comingSoon, false);
  assert.equal(CONTENT.tiers.find((t) => t.id === 'l3').status, 'available');
  for (const r of G.RANKS) for (const g of r.gates || []) for (const s of g.skills || []) if (s.startsWith('l3-')) assert.ok(l3ids.has(s), `${r.id} gate skill ${s}`);
});

test('Level 3 prerequisites: rooted in Levels 1-2, no cycles, locked for a fresh student', () => {
  const byId = new Map(CONTENT.skills.map((s) => [s.id, s]));
  const reachesBelow = (id, seen = new Set()) => {
    assert.ok(!seen.has(id), `cycle at ${id}`);
    seen.add(id);
    return byId.get(id).prereqs.some((p) => below.has(p) || reachesBelow(p, new Set(seen)));
  };
  for (const s of l3) {
    assert.ok(s.prereqs.length >= 1, `${s.id} has prerequisites`);
    for (const p of s.prereqs) assert.ok(byId.has(p) && idx.activeIds.has(p), `${s.id}: prereq ${p} exists and is live`);
    assert.ok(reachesBelow(s.id), `${s.id} builds on Level 1/2`);
  }
  const st = E.createState(CONTENT);
  for (const s of l3) assert.equal(st.skills[s.id].unlocked, false, `${s.id} starts locked`);
  assert.ok(E.placementSkills(CONTENT).every((s) => (s.level ?? 1) === 1), 'placement stays Level 1 only');
});

test('each Level 3 skill: 12+ questions, mixed formats, artifacts to read, typed recall, all difficulties', () => {
  for (const s of l3) {
    const items = CONTENT.items.filter((i) => i.skill === s.id);
    const types = new Set(items.map((i) => i.type));
    assert.ok(items.length >= 12, `${s.id}: ${items.length} items`);
    assert.ok(types.has('mc') && types.has('text') && types.has('multi'), `${s.id}: formats ${[...types]}`);
    assert.ok(items.filter((i) => i.snippet).length >= 1, `${s.id}: needs an artifact to read`);
    assert.deepEqual([...new Set(items.map((i) => i.difficulty))].sort(), [1, 2, 3], `${s.id}: easy, medium and hard`);
    assert.ok(items.filter((i) => i.misconceptions).length >= 5, `${s.id}: misconception-tagged items`);
  }
});

test('each Level 3 skill: a lesson (4-6 sections, worked + faded example) and 3+ misconceptions with fixes', () => {
  for (const s of l3) {
    const l = lessonOf(s.id);
    assert.ok(l, `${s.id}: lesson`);
    assert.ok(l.sections.length >= 4 && l.sections.length <= 6, `${s.id}: ${l.sections.length} sections`);
    assert.ok(l.worked.length >= 1 && l.faded.length >= 1, `${s.id}: worked and faded examples`);
    assert.ok(l.worked.every((w) => w.steps.length >= 3));
    const mis = CONTENT.misconceptions.filter((m) => m.skill === s.id);
    assert.ok(mis.length >= 3, `${s.id}: ${mis.length} misconceptions`);
    for (const m of mis) assert.ok(m.fix.length > 60 && m.lesson?.startsWith(`${s.id}#`), `${m.id}: targeted fix and lesson link`);
  }
});

test('Level 3 accuracy anchors: X.509 and validity rules, Kerberos events, CloudTrail, RFC 3227, Sigma, ATT&CK', () => {
  const text = (id) => JSON.stringify([lessonOf(id), CONTENT.items.filter((i) => i.skill === id)]).toLowerCase();
  const pki = text('l3-pki');
  for (const k of ['subject alternative name', 'issuer', 'basic constraints', 'ocsp', 'certificate transparency', '200 days', 'tls 1.3', 'ja3']) assert.ok(pki.includes(k), `PKI: ${k}`);
  const cry = text('l3-crypto');
  for (const k of ['base64', 'sha-256', 'aes', 'rsa', 'salt', 'argon2', 'public key', 'forward secrecy']) assert.ok(cry.includes(k), `crypto: ${k}`);
  const id = text('l3-identity');
  for (const k of ['4768', '4769', '0x17', '0x12', 'krbtgt', 'pre-authentication type 0', 'dcsync', 't1558.003', 'logon type 3']) assert.ok(id.includes(k), `identity: ${k}`);
  const cl = text('l3-cloud');
  for (const k of ['shared responsibility', 'cloudtrail', 'akia', 'asia', 'getcalleridentity', 'errorcode', 'block public access', 'imdsv2']) assert.ok(cl.includes(k), `cloud: ${k}`);
  const fo = text('l3-forensics');
  for (const k of ['rfc 3227', 'order of volatility', 'prefetch', 'amcache', 'chain of custody', 'write blocker', '$file_name', 'utc']) assert.ok(fo.includes(k), `forensics: ${k}`);
  const de = text('l3-detection');
  for (const k of ['sigma', 'logsource', 'condition', 'precision', 'false positive', 'att&ck', 't1486']) assert.ok(de.includes(k), `detection: ${k}`);
  // encryption type codes are not mixed up anywhere
  for (const it of CONTENT.items.filter((i) => l3ids.has(i.skill))) assert.ok(!/0x17\s*[=(:]\s*aes|0x12\s*[=(:]\s*rc4|rc4\s*\(0x12|aes\S*\s*\(0x17/i.test(it.explanation), `${it.id}: RC4/AES codes swapped`);
});

test('Level 3 SIEM cases: 4+, an ambiguous one, a cloud case with CloudTrail, unlock only with Level 3', () => {
  const cases = CONTENT.siemCases.filter((c) => c.tier === 'l3');
  assert.ok(cases.length >= 4);
  assert.ok(cases.some((c) => c.ambiguous), 'an ambiguous Level 3 case');
  assert.ok(new Set(cases.map((c) => c.verdict)).size >= 2, 'not every case is a true positive');
  const cloud = cases.find((c) => c.requires.skills.includes('l3-cloud'));
  assert.ok(cloud && cloud.logs.some((r) => r.src === 'cloud' && /GetCallerIdentity/.test(r.type + r.msg)), 'cloud case reads CloudTrail');
  const kerb = cases.find((c) => c.requires.skills.includes('l3-identity'));
  assert.ok(kerb && kerb.logs.some((r) => /4768/.test(r.type) && /Pre-Authentication Type: 0/.test(r.msg)), 'identity case shows AS-REP roasting');
  const learned12 = [...below];
  for (const c of cases) {
    assert.ok(c.requires.skills.some((s) => l3ids.has(s)), `${c.id} relies on a Level 3 skill`);
    assert.equal(S.caseUnlocked(c, learned12), false, `${c.id} stays locked with Levels 1-2`);
    assert.equal(S.caseUnlocked(c, [...learned12, ...l3ids]), true, `${c.id} opens with Level 3`);
  }
});

// ------------------------------------------------------------------ Major incident capstone

const sc = CONTENT.scenarios.find((s) => s.id === 'major-incident');
const rightAnswers = (stage) => Object.fromEntries(stage.questions.map((q) => [q.id, q.answer]));
const doLessons = (st) => sc.stages.flatMap((s) => s.requires.lessons).forEach((id) => (st.lessons[id] = { read: true, worked: [], faded: [], completed: true, skipped: false, bypassed: false, offered: true }));

test('Major incident: 5 stages across every Level 3 lesson, valid questions', () => {
  assert.ok(sc && sc.kind === 'capstone' && sc.status === 'available' && sc.tier === 'l3');
  assert.equal(sc.stages.length, 5);
  const qids = new Set();
  for (const stage of sc.stages) {
    assert.ok(stage.requires.lessons.length && stage.requires.lessons.every((l) => lessonOf(l)), `${stage.id}: lessons exist`);
    assert.ok(stage.evidence.rows.length >= 4, `${stage.id}: evidence`);
    for (const q of stage.questions) {
      assert.ok(!qids.has(q.id));
      qids.add(q.id);
      assert.ok(q.prompt && q.explanation && q.choices.length >= 3);
      for (const a of q.type === 'multi' ? q.answer : [q.answer]) assert.ok(q.choices.includes(a), `${q.id}: answer among choices`);
    }
  }
  const covered = new Set(sc.stages.flatMap((s) => s.requires.lessons));
  for (const id of l3ids) assert.ok(covered.has(id), `stages rely on ${id}`);
});

test('Major incident report: executive + technical write-ups, rubric totals 100, model answer scores 100', () => {
  const F = sc.escalation.fields;
  const W = sc.escalation.weights;
  assert.equal(Object.values(W).reduce((a, b) => a + b, 0), 100);
  assert.equal(C.fieldKind(F.exec), 'text');
  assert.equal(C.fieldKind(F.technical), 'text');
  assert.ok(W.exec >= 10 && W.technical >= 15, 'both audiences are scored');
  for (const f of Object.keys(W)) {
    assert.ok(F[f], `field ${f}`);
    if (C.fieldKind(F[f]) === 'set') {
      const ids = F[f].options.map((o) => (typeof o === 'object' ? o.id : o));
      for (const c of F[f].correct) assert.ok(ids.includes(c), `${f}: ${c}`);
      assert.ok(F[f].options.length > F[f].correct.length, `${f} needs distractors`);
    }
    if (C.fieldKind(F[f]) === 'choice') assert.equal(F[f].credit[sc.escalation.model[f]], 1, `${f}: model choice has full credit`);
  }
  const model = C.modelReport(sc);
  const r = C.scoreEscalation(sc, model);
  assert.equal(r.total, 100);
  // jargon-free exec summary still has to cover the business points; a technical dump in the exec box loses marks
  const swapped = C.scoreEscalation(sc, { ...model, exec: model.technical });
  assert.ok(swapped.total < 100);
  assert.equal(C.scoreEscalation(sc, {}).passed, false);
  const wrongPlan = C.scoreEscalation(sc, { ...model, actions: [...F.actions.options], evidence: [...F.evidence.options] });
  assert.ok(wrongPlan.total <= 100 - (W.actions + W.evidence) / 4, 'ticking every action costs points');
  const onPanels = sc.escalation.panels.flatMap((p) => p.fields);
  assert.deepEqual([...onPanels].sort(), Object.keys(W).sort());
});

test('Major incident: pays its own XP rates, earns Incident Commander and opens SOC Manager', () => {
  assert.deepEqual(G.capstoneRates(sc), { stage: 75, report: 800 });
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
  assert.ok(game.badges['incident-commander'], 'Incident Commander badge');
  // SOC Manager: all tiers + this capstone + the XP
  idx.activeSkills.forEach((s) => master(st, s.id));
  for (const c of CONTENT.siemCases) st.siem.cases[c.id] = { solved: true };
  st.capstones['first-shift'] = { completedAt: NOW };
  st.capstones['night-shift-lead'] = { completedAt: NOW };
  game.xp = rankXp('manager');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'manager');
  delete st.capstones['major-incident'];
  assert.equal(G.computeRank(game, st, CONTENT).id, 'lead', 'SOC Manager needs the Major incident');
});

test('Level 3 ranks: gates need the right skills', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  CONTENT.skills.filter((s) => (s.level ?? 1) < 3 && !s.comingSoon).forEach((s) => master(st, s.id));
  for (const c of CONTENT.siemCases) st.siem.cases[c.id] = { solved: true };
  st.capstones['first-shift'] = { completedAt: NOW };
  st.capstones['night-shift-lead'] = { completedAt: NOW };
  game.xp = rankXp('lead');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'senior-1', 'no Level 3 mastery, no Level 3 rank');
  master(st, 'l3-pki');
  master(st, 'l3-crypto');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'senior-2');
  master(st, 'l3-forensics');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'responder');
  master(st, 'l3-identity');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'hunter');
  master(st, 'l3-detection');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'detection');
  master(st, 'l3-cloud');
  assert.equal(G.computeRank(game, st, CONTENT).id, 'lead');
});

test('XP budget with Level 3: content alone reaches the lower Level 3 ranks; the top needs months of review', () => {
  const b = G.xpBudget(CONTENT);
  const L12total = b.total - (b.total - G.xpBudget({
    ...CONTENT,
    tiers: CONTENT.tiers.map((t) => (t.level >= 3 ? { ...t, status: 'coming-soon' } : t)),
    skills: CONTENT.skills.map((s) => ((s.level ?? 1) >= 3 ? { ...s, comingSoon: true } : s)),
    siemCases: CONTENT.siemCases.filter((c) => c.tier !== 'l3'),
    scenarios: CONTENT.scenarios.filter((s) => s.tier !== 'l3'),
  }).total);
  const l3xp = b.total - L12total;
  assert.ok(l3xp >= 4000, `Level 3 adds ${l3xp} XP`);
  // Senior Analyst II needs Level 3 work: Levels 1-2 plus a month of reviews fall short
  assert.ok(rankXp('senior-2') > L12total + G.MONTH_OF_REVIEWS);
  assert.ok(rankXp('senior-2') <= b.total, 'finishing Level 3 content passes Senior Analyst II');
  // content alone does not reach the top three ranks
  assert.ok(G.rankIndex(b.atTotal.rank.id) >= G.rankIndex('senior-2'));
  assert.ok(G.rankIndex(b.atTotal.rank.id) < G.rankIndex('detection'), `content alone reaches ${b.atTotal.rank.id}`);
  assert.ok(b.total < rankXp('manager') - 2 * G.MONTH_OF_REVIEWS, 'SOC Manager needs sustained review, not just content');
  // ...but it is reachable: about three months of daily reviews on top of everything
  assert.equal(G.reachableRank(CONTENT).id, 'manager', 'every gate can be met');
  assert.equal(G.reachableRank(CONTENT, b.total + 3 * G.MONTH_OF_REVIEWS).id, 'manager');
  assert.ok(G.levelForXp(rankXp('manager')) < G.MAX_LEVEL, 'SOC Manager comes before max level');
});

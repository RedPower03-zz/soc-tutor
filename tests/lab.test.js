// Query sandbox, packet lab, rule lab, and write-up synonym grading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../content/index.js';
import { QUERY_CHALLENGES, challengeAnswer } from '../content/lab/query-challenges.js';
import { getTables, registerDataset, getDataset } from '../content/lab/datasets.js';
import { runQuery } from '../js/lab/query.js';
import * as L from '../js/lab/lab.js';
import * as P from '../js/lab/packets.js';
import * as R from '../js/lab/rules.js';
import { scoreKeywordRubric } from '../js/rubric.js';
import * as S from '../js/siem.js';
import * as C from '../js/capstone.js';
import * as B from '../js/backup.js';
import { migrateState } from '../js/migrate.js';
import * as E from '../js/engine.js';
import { runCaseQuery } from '../js/lab/case-query.js';

const tables = () => getTables();

test('query challenges: 10–12, both model queries match the result-set grader', () => {
  assert.ok(QUERY_CHALLENGES.length >= 10 && QUERY_CHALLENGES.length <= 12);
  const ids = new Set(QUERY_CHALLENGES.map((c) => c.id));
  assert.equal(ids.size, QUERY_CHALLENGES.length);
  for (const ch of QUERY_CHALLENGES) {
    const answer = challengeAnswer(ch);
    for (const dialect of ['spl', 'kql']) {
      const res = runQuery(ch.model[dialect], { dialect, tables: tables(), defaultTable: ch.dataset });
      const g = L.gradeResult(res, answer);
      assert.equal(g.ok, true, `${ch.id} ${dialect}: ${g.message}`);
    }
  }
});

test('dialect subset: filter, count by, sort, head/take, table/project, dedup, time bounds', () => {
  const ds = getDataset('winsec');
  const base = { tables: [ds], defaultTable: 'winsec' };
  const spl = runQuery('index=wineventlog EventCode=4625 earliest=-24h | dedup user | stats count by user | sort -count | head 3 | table user count', { dialect: 'spl', ...base });
  assert.ok(spl.rows.length <= 3 && spl.rows.length > 0);
  assert.deepEqual(spl.columns.includes('user') || spl.columns.includes('TargetUserName'), true);
  const kql = runQuery('SecurityEvent | where EventID == 4625 and TimeGenerated > ago(24h) | distinct TargetUserName | summarize count() by TargetUserName | order by count_ desc | take 3 | project TargetUserName, count_', { dialect: 'kql', ...base });
  assert.ok(kql.rows.length <= 3 && kql.rows.length > 0);
  // a wrong sort does not put the brute-force source first
  const brute = QUERY_CHALLENGES.find((c) => c.id === 'q-brute-src');
  const asc = runQuery('index=wineventlog EventCode=4625 | stats count by src_ip | sort count | head 1', { dialect: 'spl', tables: tables(), defaultTable: 'winsec' });
  assert.equal(L.gradeResult(asc, challengeAnswer(brute)).ok, false);
});

test('another stream can register a dataset and query it', () => {
  registerDataset({
    id: 'plug',
    title: 'Plug-in',
    spl: 'plugin',
    kql: 'Plugin',
    fields: ['msg'],
    seed: 2,
    blurb: 'test',
    generate: () => [{ _time: Date.UTC(2026, 8, 24, 8) / 1000, msg: 'hello-plugin' }],
  });
  const res = runQuery('index=plugin | table msg', { dialect: 'spl', tables: getTables(), defaultTable: 'plug' });
  assert.equal(res.rows.length, 1);
  assert.equal(String(res.rows[0].msg), 'hello-plugin');
});

test('query XP is paid once, hints reduce it, the second dialect adds a small bonus', () => {
  const st = { lab: {} };
  const ch = QUERY_CHALLENGES[0];
  const a = L.recordQuery(st, ch, { ok: true, dialect: 'spl', hints: 0, query: 'x' });
  assert.equal(a.xp, L.LAB_XP.query[ch.difficulty]);
  const again = L.recordQuery(st, ch, { ok: true, dialect: 'spl', hints: 0, query: 'x' });
  assert.equal(again.xp, 0);
  const kql = L.recordQuery(st, ch, { ok: true, dialect: 'kql', hints: 0, query: 'y' });
  assert.equal(kql.xp, L.LAB_XP.dialectBonus);
  const hinted = { lab: {} };
  const h = L.recordQuery(hinted, ch, { ok: true, dialect: 'spl', hints: 2, query: 'z' });
  assert.ok(h.xp < a.xp);
});

test('SIEM case query bar returns rows from the case logs', () => {
  const c = CONTENT.siemCases.find((x) => x.logs?.length);
  const res = runCaseQuery(c, 'index=case | head 5', 'spl');
  assert.equal(res.rows.length, 5);
  assert.ok(res.ids.length === 5);
  const k = runCaseQuery(c, 'CaseLogs | take 3', 'kql');
  assert.equal(k.rows.length, 3);
});

test('packet filters, follow-stream and answer grading', () => {
  const c = CONTENT.lab.packetCases.find((x) => x.id === 'pkt-cleartext');
  const pk = c.packets.map(P.present);
  const http = P.applyFilter(pk, 'http && frame contains "password"');
  assert.equal(http.length, 1);
  assert.equal(http[0].id, 'c3');
  assert.ok(P.followStream(pk, 'c').length >= 3);
  assert.throws(() => P.compileFilter('tcp &&'), /filter/i);
  const good = {};
  for (const t of c.tasks) good[t.id] = t.accept[0];
  assert.equal(P.scorePacketCase(c, good).passed, true);
  assert.equal(P.scorePacketCase(c, { ...good, user: 'nope' }).passed, false);
  assert.equal(CONTENT.lab.packetCases.length >= 6 && CONTENT.lab.packetCases.length <= 8, true);
});

test('rules: model answers are perfect; matching everything is not', () => {
  assert.ok(CONTENT.lab.ruleExercises.length >= 5 && CONTENT.lab.ruleExercises.length <= 6);
  for (const ex of CONTENT.lab.ruleExercises) {
    const g = R.gradeRule(ex, ex.model.sigma || ex.model.yara);
    assert.equal(g.fp, 0, ex.id);
    assert.equal(g.fn, 0, ex.id);
    assert.equal(g.passed, true, ex.id);
  }
  const broad = CONTENT.lab.ruleExercises.find((e) => e.id === 'rule-rdp-fail');
  const noisy = R.gradeRule(broad, 'EventID == 4625');
  assert.ok(noisy.fp > 0 && noisy.passed === false);
  const web = CONTENT.lab.ruleExercises.find((e) => e.id === 'rule-webshell');
  const anyEval = R.gradeRule(web, '$a = "eval" nocase\ncondition: any');
  assert.ok(anyEval.fp > 0, 'eval matches evaluate()');
});

test('write-ups: a synonym counts, a keyword dump does not, repetition does not pad length', () => {
  const c = CONTENT.siemCases.find((x) => x.id === 'siem-rdp-brute');
  const prose = 'The attacking IP was 203.0.113.45. I saw failed logons and then a successful logon, and a new account named svc_backup2 was created.';
  const ok = S.scoreCase(c, { verdict: c.verdict, pins: [], writeup: prose, queries: 1 });
  assert.ok(ok.writeup.points > 0);
  assert.equal(ok.writeup.stuffed, false);
  const dump = c.writeup.map((w) => w.any[0]).join(' ');
  const stuffed = S.scoreCase(c, { verdict: c.verdict, pins: [], writeup: dump.padEnd(40, ' '), queries: 1 });
  assert.equal(stuffed.writeup.points, 0);
  assert.equal(stuffed.writeup.stuffed, true);
  const pad = S.scoreCase(c, { verdict: c.verdict, pins: [], writeup: 'beacon '.repeat(8), queries: 1 });
  assert.equal(pad.writeup.points, 0);
  // second synonym, not the first
  const syn = scoreKeywordRubric('The host was locked because of a brute force against the account.', [{ label: 'How', any: ['spray', 'brute', 'guess'] }], { minLength: 20 });
  assert.deepEqual(syn.hits, ['How']);
  const cap = CONTENT.scenarios.find((s) => s.id === 'first-shift');
  assert.equal(C.scoreEscalation(cap, C.modelReport(cap)).total, 100);
});

test('backup round-trip keeps lab progress and migration adds an empty lab', () => {
  const st = E.createState(CONTENT);
  migrateState(st, CONTENT);
  assert.ok(st.lab && st.lab.query && st.lab.packets && st.lab.rules);
  st.lab.query['q-brute-src'] = { solved: true, xpPaid: 25 };
  const env = B.makeEnvelope(st, 1);
  assert.equal(env.state.lab.query['q-brute-src'].solved, true);
  const back = B.prepareImport(B.unwrap(env), CONTENT, 2);
  assert.equal(back.ok, true);
  assert.equal(back.state.lab.query['q-brute-src'].xpPaid, 25);
});

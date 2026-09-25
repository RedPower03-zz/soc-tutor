// SIEM investigation mode: filters, pivots, scorer, XP, unlocks and case content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import * as S from '../js/siem.js';
import { CONTENT } from '../content/index.js';
import { SIEM_SOURCES, VERDICTS } from '../content/siem-cases.js';

const NOW = new Date(2026, 8, 28, 14).getTime();
const cases = CONTENT.siemCases;
const byId = (id) => cases.find((c) => c.id === id);
const idx = E.indexContent(CONTENT);
const master = (st, id) => Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
const keyPins = (c) => c.key.map((k) => k.rows[0]);
const goodWriteup = (c) => `${c.writeup.map((w) => w.any[0]).join(', ')}: that is what the evidence shows.`;
const perfect = (c) => ({ verdict: c.verdict, pins: keyPins(c), writeup: goodWriteup(c), queries: c.parQueries, ...(c.ambiguous ? S.modelAmbiguous(c) : {}) });

// ------------------------------------------------------------------ content

test('at least 4 cases, varied difficulty and verdicts, unique ids', () => {
  assert.ok(cases.length >= 4);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  assert.ok(new Set(cases.map((c) => c.difficulty)).size >= 3, 'easy, medium and hard cases');
  const verdicts = new Set(cases.map((c) => c.verdict));
  for (const v of ['tp', 'btp', 'fp']) assert.ok(verdicts.has(v), `a case with verdict ${v}`);
});

test('case schema: rows, keys, related rows, sources and required skills are valid', () => {
  const srcIds = new Set(Object.keys(SIEM_SOURCES));
  const verdictIds = new Set(Object.keys(VERDICTS));
  for (const c of cases) {
    assert.ok(c.title && c.summary && c.explanation && c.strong?.length, c.id);
    assert.ok(verdictIds.has(c.verdict), `${c.id} verdict`);
    assert.ok(c.logs.length >= 10, `${c.id}: needs a real haystack`);
    const rowIds = new Set(c.logs.map((r) => r.id));
    assert.equal(rowIds.size, c.logs.length, `${c.id}: duplicate row ids`);
    for (const r of c.logs) {
      assert.ok(srcIds.has(r.src), `${c.id}/${r.id} source ${r.src}`);
      assert.match(r.t, /^\d\d:\d\d:\d\d$/, `${c.id}/${r.id} time`);
      assert.ok(r.host && r.type && r.msg, `${c.id}/${r.id}`);
    }
    assert.ok(c.key.length >= 2);
    for (const k of c.key) {
      assert.ok(k.label && k.why && k.rows.length, `${c.id}/${k.id}`);
      for (const r of k.rows) assert.ok(rowIds.has(r), `${c.id}/${k.id} -> missing row ${r}`);
    }
    for (const r of c.related || []) assert.ok(rowIds.has(r), `${c.id} related ${r}`);
    const keyRows = c.key.flatMap((k) => k.rows);
    assert.equal(new Set(keyRows).size, keyRows.length, `${c.id}: a row belongs to one key group`);
    for (const r of c.related || []) assert.ok(!keyRows.includes(r), `${c.id}: ${r} is both key and related`);
    for (const s of c.requires.skills) assert.ok(idx.activeIds.has(s), `${c.id} requires unknown/inactive skill ${s}`);
    assert.ok(c.writeup.length >= 2 && c.writeup.every((w) => w.label && w.any.length));
    // the alert time falls inside the log window, with evidence on both sides
    const secs = c.logs.map((r) => S.toSec(r.t));
    const a = S.toSec(c.alert.time);
    assert.ok(Math.min(...secs) < a && Math.max(...secs) >= a - 60, `${c.id}: alert time outside the logs`);
  }
});

test('logs are fictional: documentation or private IPs, reserved example domains', () => {
  const ipOk = (ip) => {
    const [a, b, c] = ip.split('.').map(Number);
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || a === 127 ||
      (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
  };
  for (const c of cases) {
    const text = JSON.stringify(c);
    for (const m of text.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.]*\.in-addr)(?![.\d])/g)) assert.ok(ipOk(m[1]), `${c.id}: ${m[1]} is not a documentation/private IP`);
    for (const m of text.matchAll(/\b((?:[a-z0-9-]+\.)+([a-z]{2,}))\b/gi)) {
      const [domain, tld] = [m[1].toLowerCase(), m[2].toLowerCase()];
      if (/\.(exe|dll|ps1|docm|zip|txt|log|conf|bat|arpa|msc|cpl|inf|sys)$/.test(domain)) continue;
      if (/^(system32|windows|microsoft|corp|hklm|hkcu)/.test(domain) && !['com', 'net', 'org'].includes(tld)) continue;
      assert.ok(['example', 'test', 'invalid', 'localhost'].includes(tld) || /(^|\.)example\.(com|net|org)$/.test(domain) || !['com', 'net', 'org', 'io', 'ru', 'cn'].includes(tld), `${c.id}: real-looking domain ${domain}`);
    }
  }
});

test('a model investigation scores 100 on every case', () => {
  for (const c of cases) {
    const r = S.scoreCase(c, perfect(c));
    assert.equal(r.total, 100, c.id);
    assert.ok(r.passed && r.evidence.perfect);
    assert.equal(r.grade, 'Outstanding');
  }
});

// ------------------------------------------------------------------ filters & pivots

test('filters: source, host, user, type and time window combine', () => {
  const c = byId('siem-rdp-brute');
  const all = S.filterLogs(c, S.emptyQuery());
  assert.equal(all.length, c.logs.length);
  for (let i = 1; i < all.length; i++) assert.ok(S.toSec(all[i - 1].t) <= S.toSec(all[i].t), 'sorted by time');
  const win = S.filterLogs(c, { ...S.emptyQuery(), sources: ['winevt'] });
  assert.ok(win.length > 0 && win.every((r) => r.src === 'winevt'));
  const two = S.filterLogs(c, { ...S.emptyQuery(), sources: ['winevt', 'firewall'] });
  assert.ok(two.length > win.length && two.every((r) => ['winevt', 'firewall'].includes(r.src)));
  const host = S.facet(c, 'host')[0];
  assert.ok(S.filterLogs(c, { ...S.emptyQuery(), host }).every((r) => r.host === host));
  const type = S.facet(c, 'type')[0];
  assert.ok(S.filterLogs(c, { ...S.emptyQuery(), type }).every((r) => r.type === type));
  const a = S.toSec(c.alert.time);
  assert.ok(S.filterLogs(c, { ...S.emptyQuery(), window: 'before' }).every((r) => S.toSec(r.t) <= a));
  assert.ok(S.filterLogs(c, { ...S.emptyQuery(), window: 'after' }).every((r) => S.toSec(r.t) >= a));
  assert.ok(S.filterLogs(c, { ...S.emptyQuery(), window: 'pm5' }).every((r) => Math.abs(S.toSec(r.t) - a) <= 300));
});

test('free-text search: case-insensitive, all terms must match, quoted phrases stay together', () => {
  const c = byId('siem-rdp-brute');
  const r = S.filterLogs(c, { ...S.emptyQuery(), text: '4625' });
  assert.ok(r.length >= 3 && r.every((x) => /4625/.test(x.type + x.msg)));
  const both = S.filterLogs(c, { ...S.emptyQuery(), text: '4624 TYPE' });
  assert.ok(both.every((x) => /4624/.test(x.type + x.msg) && /type/i.test(x.msg + x.type)));
  assert.equal(S.filterLogs(c, { ...S.emptyQuery(), text: '"zz no such phrase"' }).length, 0);
});

test('pivots pull host, user, IPs and domains out of a row (not reverse-DNS names)', () => {
  const row = { host: 'WS-1', user: 'dana', msg: 'ALLOW TCP 10.10.4.27:5000 -> 198.51.100.77:443 sni=invoices.northwind-billing.example; PTR 77.100.51.198.in-addr.arpa' };
  const p = S.pivots(row);
  assert.deepEqual(p.map((x) => x.kind), ['host', 'user', 'ip', 'ip', 'domain']);
  assert.deepEqual(p.filter((x) => x.kind === 'ip').map((x) => x.value), ['10.10.4.27', '198.51.100.77']);
  assert.equal(p.find((x) => x.kind === 'domain').value, 'invoices.northwind-billing.example');
});

test('investigation state: only distinct, non-empty searches count; pins toggle', () => {
  const c = byId('siem-beacon');
  const inv = S.newInvestigation(c, NOW);
  assert.equal(S.applyQuery(inv, { ...S.emptyQuery(), sources: ['dns'] }), true);
  assert.equal(S.applyQuery(inv, { ...S.emptyQuery(), sources: ['dns'] }), false, 'same query again');
  S.applyQuery(inv, { ...S.emptyQuery(), sources: ['dns'], text: 'micr0soft' });
  S.applyQuery(inv, S.emptyQuery());
  assert.equal(inv.queries, 2, 'clearing the filters is not a search');
  assert.equal(S.togglePin(inv, c.logs[0].id), true);
  assert.equal(S.togglePin(inv, c.logs[0].id), false);
  assert.deepEqual(inv.pins, []);
});

// ------------------------------------------------------------------ scoring

test('verdict partial credit: missing a real attack scores zero, over-escalating a benign alert gets a little', () => {
  const tp = byId('siem-rdp-brute');
  assert.equal(S.scoreCase(tp, { ...perfect(tp), verdict: 'btp' }).verdict.points, 0);
  assert.equal(S.scoreCase(tp, { ...perfect(tp), verdict: 'fp' }).verdict.points, 0);
  const btp = byId('siem-sccm-powershell');
  const over = S.scoreCase(btp, { ...perfect(btp), verdict: 'tp' });
  assert.ok(over.verdict.points > 0 && over.verdict.points < S.WEIGHTS.verdict);
  assert.equal(over.passed, false, 'a wrong verdict never passes, whatever the evidence');
  const fp = byId('siem-certutil');
  assert.ok(S.scoreCase(fp, { ...perfect(fp), verdict: 'btp' }).verdict.points > S.scoreCase(fp, { ...perfect(fp), verdict: 'tp' }).verdict.points);
  assert.equal(S.scoreCase(tp, { ...perfect(tp), verdict: null }).verdict.points, 0);
});

test('evidence: credit per key group found, penalty for noise pins (capped), related pins are neutral', () => {
  const c = byId('siem-rdp-brute');
  const half = S.scoreCase(c, { ...perfect(c), pins: keyPins(c).slice(0, 2) });
  assert.equal(half.evidence.points, Math.round(S.WEIGHTS.evidence / 2));
  assert.deepEqual(half.evidence.missed, c.key.slice(2).map((k) => k.id));
  // any row of a group counts
  const alt = c.key.map((k) => k.rows[k.rows.length - 1]);
  assert.equal(S.scoreCase(c, { ...perfect(c), pins: alt }).evidence.points, S.WEIGHTS.evidence);
  const keyRows = new Set(c.key.flatMap((k) => k.rows));
  const noiseRows = c.logs.map((r) => r.id).filter((r) => !keyRows.has(r) && !(c.related || []).includes(r));
  const one = S.scoreCase(c, { ...perfect(c), pins: [...keyPins(c), noiseRows[0]] });
  assert.equal(one.evidence.points, S.WEIGHTS.evidence - S.NOISE_PENALTY);
  assert.equal(one.evidence.perfect, false);
  const lots = S.scoreCase(c, { ...perfect(c), pins: [...keyPins(c), ...noiseRows] });
  assert.equal(lots.evidence.penalty, S.MAX_NOISE_PENALTY, 'pinning everything is capped but never pays');
  if ((c.related || []).length) {
    const rel = S.scoreCase(c, { ...perfect(c), pins: [...keyPins(c), c.related[0]] });
    assert.equal(rel.evidence.points, S.WEIGHTS.evidence);
  }
  assert.ok(S.scoreCase(c, { ...perfect(c), pins: c.logs.map((r) => r.id) }).total < S.scoreCase(c, perfect(c)).total);
});

test('efficiency: full marks up to par, then one point per extra search; no evidence means no efficiency credit', () => {
  const c = byId('siem-certutil');
  assert.equal(S.scoreCase(c, { ...perfect(c), queries: 0 }).efficiency.points, S.WEIGHTS.efficiency);
  assert.equal(S.scoreCase(c, { ...perfect(c), queries: c.parQueries + 3 }).efficiency.points, S.WEIGHTS.efficiency - 3);
  assert.equal(S.scoreCase(c, { ...perfect(c), queries: 99 }).efficiency.points, 0);
  assert.equal(S.scoreCase(c, { ...perfect(c), pins: [] }).efficiency.points, 0);
});

test('write-up: keyword coverage, and too short earns nothing', () => {
  const c = byId('siem-beacon');
  assert.equal(S.scoreCase(c, { ...perfect(c), writeup: 'beacon' }).writeup.points, 0);
  assert.equal(S.scoreCase(c, { ...perfect(c), writeup: 'beacon' }).writeup.tooShort, true);
  const one = S.scoreCase(c, { ...perfect(c), writeup: `${c.writeup[0].any[0]} is what I saw in the logs today` });
  assert.equal(one.writeup.points, Math.round(S.WEIGHTS.writeup / c.writeup.length));
  assert.deepEqual(one.writeup.hits, [c.writeup[0].label]);
});

test('grades and pass mark', () => {
  const c = byId('siem-scanner');
  const r = S.scoreCase(c, { verdict: c.verdict, pins: [], writeup: '', queries: 0 });
  assert.equal(r.total, S.WEIGHTS.verdict);
  assert.equal(r.passed, false, 'a right guess with no evidence does not pass');
  assert.equal(r.grade, 'Needs work');
});

// ------------------------------------------------------------------ progress, XP, unlocks

test('cases unlock when their required skills are learned', () => {
  const st = E.createState(CONTENT);
  const c = byId('siem-beacon');
  assert.equal(S.caseUnlocked(c, E.learnedSkills(st, CONTENT)), false);
  c.requires.skills.slice(0, -1).forEach((s) => master(st, s));
  assert.equal(S.caseUnlocked(c, E.learnedSkills(st, CONTENT)), false);
  master(st, c.requires.skills.at(-1));
  assert.equal(S.caseUnlocked(c, E.learnedSkills(st, CONTENT)), true);
});

test('recordCase keeps best score and first solve; XP pays only improvement and rewards good work', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  const c = byId('siem-beacon'); // difficulty 3
  const run = (sub) => {
    const result = S.scoreCase(c, sub);
    const rec = S.recordCase(st, c, result, NOW);
    return { result, rec, xp: G.onInvestigation(game, st, CONTENT, { caseDef: c, result, firstSolve: rec.firstSolve, now: NOW }) };
  };
  const wrong = run({ ...perfect(c), verdict: 'btp' });
  assert.equal(wrong.rec.firstSolve, false);
  assert.equal(wrong.xp.xp, Math.round((G.XP_RULES.siemCase[3] * Math.round(wrong.result.total * 0.25)) / 100), 'a wrong call pays a quarter');
  const partial = run({ ...perfect(c), pins: keyPins(c).slice(0, 2) });
  assert.ok(partial.rec.firstSolve && partial.result.passed);
  const paidSoFar = st.siem.cases[c.id].paid;
  assert.equal(paidSoFar, partial.result.total);
  assert.equal(game.counters.casesSolved, 1);
  const same = run({ ...perfect(c), pins: keyPins(c).slice(0, 2) });
  assert.equal(same.xp.xp, 0, 'replaying at the same score pays nothing');
  const best = run(perfect(c));
  assert.equal(best.xp.xp, Math.round((G.XP_RULES.siemCase[3] * (100 - paidSoFar)) / 100));
  assert.equal(st.siem.cases[c.id].best, 100);
  assert.equal(st.siem.cases[c.id].attempts, 4);
  assert.equal(game.counters.casesSolved, 1, 'solving again does not count twice');
  assert.equal(game.counters.perfectEvidence, 1);
  assert.ok(game.badges['case-closed'] && game.badges['sharp-eye']);
  // total XP for the case can never exceed its rate
  assert.ok(wrong.xp.xp + partial.xp.xp + best.xp.xp <= G.XP_RULES.siemCase[3]);
});

test('clearing a benign or false alert counts toward "Not Today"; solving every case earns SIEM Sleuth', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  for (const c of cases) {
    const result = S.scoreCase(c, perfect(c));
    const rec = S.recordCase(st, c, result, NOW);
    G.onInvestigation(game, st, CONTENT, { caseDef: c, result, firstSolve: rec.firstSolve, now: NOW });
  }
  assert.equal(game.counters.benignCleared, cases.filter((c) => c.verdict !== 'tp').length);
  assert.equal(game.counters.calibratedCalls, cases.filter((c) => c.ambiguous).length);
  assert.ok(game.badges['grey-area']);
  assert.ok(game.badges['false-alarm'] && game.badges['siem-sleuth']);
  assert.equal(game.xp, cases.reduce((a, c) => a + G.XP_RULES.siemCase[c.difficulty], 0));
});

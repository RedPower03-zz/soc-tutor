// Specialist skills added after the audit (Stream C): vulnerability management, web attacks,
// IDS/IPS & NSM, threat intel & enrichment, scripting & automation and SaaS identity.
// Each one ships with a deep pool from day one, a Bloom mix that leans on applying and analysing,
// balanced multiple-choice options and technical anchors that keep the content honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { CONTENT } from '../content/index.js';

const idx = E.indexContent(CONTENT);
const SPECIALIST = ['l2-vuln', 'l2-web', 'l2-ids'];
const HIGHER = new Set(['apply', 'analyze', 'evaluate', 'create']);
const BLOOM = new Set(['remember', 'understand', ...HIGHER]);
const itemsOf = (id) => CONTENT.items.filter((i) => i.skill === id);
const lessonOf = (id) => CONTENT.lessons.find((l) => l.skill === id);
const text = (id) => JSON.stringify([lessonOf(id), itemsOf(id)]).toLowerCase();

test('specialist skills are live, on the map, with prerequisites that exist', () => {
  for (const id of SPECIALIST) {
    const s = idx.skillById.get(id);
    assert.ok(s && idx.activeIds.has(id), `${id} is live`);
    assert.ok(s.prereqs.length >= 1 && s.prereqs.every((p) => idx.activeIds.has(p)), `${id}: prerequisites`);
    assert.ok(CONTENT.tracks.some((t) => t.id === s.track), `${id}: track ${s.track}`);
    assert.ok(CONTENT.tiers.some((t) => t.tracks.includes(s.track)), `${id}: its track belongs to a tier`);
  }
});

test('specialist pools: 30+ items, every format and difficulty, artifacts, tagged distractors', () => {
  for (const id of SPECIALIST) {
    const items = itemsOf(id);
    assert.ok(items.length >= 30, `${id}: ${items.length} items`);
    for (const t of ['mc', 'multi', 'text']) assert.ok(items.some((i) => i.type === t), `${id}: a ${t} item`);
    for (const d of [1, 2, 3]) assert.ok(items.filter((i) => i.difficulty === d).length >= 4, `${id}: difficulty ${d}`);
    assert.ok(items.filter((i) => i.snippet).length >= 6, `${id}: realistic artifacts to read`);
    assert.ok(items.filter((i) => i.misconceptions).length >= 8, `${id}: misconception-tagged items`);
  }
});

test('specialist Bloom mix: every item labelled, at least 40% apply/analyze/evaluate', () => {
  for (const id of SPECIALIST) {
    const items = itemsOf(id);
    for (const i of items) assert.ok(BLOOM.has(i.bloom), `${i.id}: bloom "${i.bloom}"`);
    const hi = items.filter((i) => HIGHER.has(i.bloom)).length / items.length;
    assert.ok(hi >= 0.4, `${id}: ${Math.round(hi * 100)}% higher-order`);
  }
});

test('specialist MC options: the right answer is not a length giveaway (longest in at most 35%)', () => {
  for (const id of SPECIALIST) {
    const mc = itemsOf(id).filter((i) => i.type === 'mc');
    // uniquely longest, as in answer-balance.test.js (a tie gives no cue)
    const longest = mc.filter((i) => i.answer.length > Math.max(...i.choices.filter((c) => c !== i.answer).map((c) => c.length)));
    const pct = longest.length / mc.length;
    assert.ok(pct <= 0.35, `${id}: correct answer longest in ${Math.round(pct * 100)}% (${longest.map((i) => i.id).join(', ')})`);
  }
});

test('specialist lessons: 4-5 sections, worked and faded examples, 3-5 misconceptions linked to sections', () => {
  for (const id of SPECIALIST) {
    const l = lessonOf(id);
    assert.ok(l.sections.length >= 4 && l.sections.length <= 5, `${id}: ${l.sections.length} sections`);
    assert.ok(l.worked.length >= 1 && l.faded.length >= 1);
    const mis = CONTENT.misconceptions.filter((m) => m.skill === id);
    assert.ok(mis.length >= 3 && mis.length <= 5, `${id}: ${mis.length} misconceptions`);
    for (const m of mis) assert.ok(l.sections.some((s) => `${id}#${s.id}` === m.lesson), `${m.id}: lesson link`);
  }
});

test('vulnerability management anchors: CVSS vectors and bands, EPSS, KEV, credentialed scans, exceptions, verification', () => {
  const t = text('l2-vuln');
  for (const k of ['cvss:3.1/av:n/ac:l/pr:n/ui:n/s:u/c:h/i:h/a:h', '9.8', 'cvss:4.0', 'attack requirements', 'epss', 'kev', 'cwe', 'credentialed', 'backport', 'compensating', 'exception', 'expiry', 'rescan', 'sla', 'attack surface', 'cspm'])
    assert.ok(t.includes(k), `vuln: ${k}`);
  // the headline CVSS facts the items rely on (checked against the FIRST calculators)
  const vm04 = CONTENT.items.find((i) => i.id === 'vm-04');
  assert.deepEqual(vm04.accept, ['9.8']);
  assert.match(CONTENT.items.find((i) => i.id === 'vm-17').explanation, /9\.3[\s\S]*8\.1/);
});

test('web attack anchors: every attack class, decoding, status codes, both OWASP editions', () => {
  const t = text('l2-web');
  for (const k of ['union select', 'sleep(', '<script>', 'onerror', '%2e%2e%2f', '/etc/passwd', 'rfi', 'lfi', '169.254.169.254', 'ssrf', 'web shell', 't1505.003', 'credential stuffing', 'spray', '404', '403', '401', '302', 'core rule set', 'detection-only', 'parameterised', 'idor', 'a03:2021', 'a10:2021', 'a05 injection', 'software supply chain failures', 'mishandling of exceptional conditions'])
    assert.ok(t.includes(k), `web: ${k}`);
});

test('IDS/NSM anchors: rule anatomy, eve.json, Zeek fields and states, tuning, placement', () => {
  const t = text('l2-ids');
  for (const k of ['$home_net', 'flow:established,to_server', 'sid', 'rev', 'pcre', 'http.uri', 'threshold', 'detection_filter', 'suppress', 'eve.json', 'signature_id', 'alert.action', 'allowed', 'verdict', 'uid', 'conn_state', 's0', 'rej', 'sf', 'id.orig_h', 'server_name', 'qtype_name', 'notice.log', 'ssh::password_guessing', 'tap', 'span', 'fail open', 'ja3'])
    assert.ok(t.includes(k), `ids: ${k}`);
  // Suricata severity: 1 is the most urgent
  assert.equal(CONTENT.items.find((i) => i.id === 'ids-07').answer, '1');
});

// Determinism and shape checks for content/gen parameterised items.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, generateItem, buildGenerated, GENERATED_ITEMS } from '../content/gen/index.js';
import { makeRng, hashString, mulberry32 } from '../content/gen/rng.js';
import { subnetFacts, classifyIp } from '../content/gen/l1-net.js';
import { modeToSymbolic } from '../content/gen/l1-host.js';
import { dmarcVerdict, orgDomain } from '../content/gen/l2.js';
import { sanCovers } from '../content/gen/l3.js';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/attack-enterprise-v19.json', import.meta.url)));
const VALID = new Set(Object.keys(fixture.techniques));

test('PRNG is deterministic for a given (genId, seed)', () => {
  const a = makeRng('demo', 7);
  const b = makeRng('demo', 7);
  assert.deepEqual([a.int(0, 100), a.pick(['x', 'y', 'z']), a.chance(0.5)], [b.int(0, 100), b.pick(['x', 'y', 'z']), b.chance(0.5)]);
  assert.notEqual(makeRng('demo', 7).int(0, 1e9), makeRng('demo', 8).int(0, 1e9));
  assert.equal(typeof hashString('x'), 'number');
  assert.equal(typeof mulberry32(1)(), 'number');
});

test('every generator emits stable ids and well-formed items for all seeds', () => {
  for (const gen of GENERATORS) {
    assert.ok(gen.id && gen.skill && gen.count >= 1 && typeof gen.make === 'function', gen.id);
    const seen = new Set();
    for (let seed = 1; seed <= gen.count; seed++) {
      const it = generateItem(gen, seed);
      assert.equal(it.id, `g-${gen.id}-${seed}`);
      assert.equal(it.skill, gen.skill);
      assert.equal(it.generated.gen, gen.id);
      assert.equal(it.generated.seed, seed);
      assert.ok(['mc', 'multi', 'text'].includes(it.type), `${it.id} type`);
      assert.ok(it.prompt && it.explanation && it.explanation.length >= 60, `${it.id} text`);
      assert.ok([1, 2, 3].includes(it.difficulty), `${it.id} difficulty`);
      if (it.type === 'mc') {
        assert.ok(it.choices.includes(it.answer), `${it.id} answer in choices`);
        assert.equal(new Set(it.choices).size, it.choices.length, `${it.id} dup choices`);
      }
      if (it.type === 'text') assert.ok(it.accept?.length, `${it.id} accept`);
      // regenerating the same seed must produce an identical item
      assert.deepEqual(generateItem(gen, seed), it);
      const key = `${it.prompt}|${it.snippet || ''}|${it.answer ?? (it.accept || []).join(',')}`;
      if (seen.has(key)) continue; // allowed; buildGenerated skips duplicates
      seen.add(key);
    }
  }
});

test('GENERATED_ITEMS matches buildGenerated and has unique ids', () => {
  const rebuilt = buildGenerated();
  assert.equal(GENERATED_ITEMS.length, rebuilt.length);
  assert.deepEqual(GENERATED_ITEMS.map((i) => i.id), rebuilt.map((i) => i.id));
  assert.equal(new Set(GENERATED_ITEMS.map((i) => i.id)).size, GENERATED_ITEMS.length);
});

test('helper facts: subnet, IP class, modes, DMARC, SAN', () => {
  const f = subnetFacts(24, 0x0a000064); // 10.0.0.100/24
  assert.equal(f.usable, 254);
  assert.equal(classifyIp('10.1.2.3'), 'rfc1918');
  assert.equal(classifyIp('203.0.113.9'), 'doc');
  assert.equal(modeToSymbolic(755), 'rwxr-xr-x');
  assert.equal(orgDomain('mail.acme.example'), 'acme.example');
  assert.equal(dmarcVerdict({ from: 'acme.example', spf: 'pass', mailFrom: 'bounce.acme.example', dkim: 'fail', dkimD: 'acme.example' }), 'spf');
  assert.equal(dmarcVerdict({ from: 'acme.example', spf: 'pass', mailFrom: 'esp.example', dkim: 'pass', dkimD: 'esp.example' }), 'unaligned');
  assert.equal(sanCovers('*.shop.example', 'www.shop.example'), true);
  assert.equal(sanCovers('*.shop.example', 'shop.example'), false);
  assert.equal(sanCovers('*.shop.example', 'a.b.shop.example'), false);
});

test('ATT&CK technique ids in generated answers exist in v19', () => {
  const bad = [];
  for (const it of GENERATED_ITEMS) {
    const text = [it.answer, ...(it.choices || []), it.prompt, it.explanation].filter(Boolean).join(' ');
    for (const m of text.matchAll(/\bT1\d{3}(?:\.\d{3})?\b/g)) {
      if (!VALID.has(m[0])) bad.push(`${it.id}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, []);
});

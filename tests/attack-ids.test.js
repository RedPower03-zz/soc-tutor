// Every ATT&CK technique ID mentioned anywhere in the content must exist and be
// current in ATT&CK Enterprise v19 (fixture extracted from the official STIX
// bundle, see tests/fixtures/attack-enterprise-v19.json). A revoked ID may only
// appear as history, i.e. preceded shortly by "formerly", "was", "previously" or
// "revoked". Placeholders used deliberately in a question are allow-listed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT } from '../content/index.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/attack-enterprise-v19.json', import.meta.url)));
const VALID = new Set(fixture.valid);
const PLACEHOLDERS = new Set(['T1234', 'T1234.001']);
const HISTORY = /(formerly|was|previously|revoked|renumbered|old)\b[^.]{0,40}$/i;

function* strings(value, path) {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    yield [`${path}.${k}`, k];
    yield* strings(v, `${path}.${k}`);
  }
}

test('ATT&CK technique IDs in content are valid in v19', () => {
  const bad = [];
  for (const [path, text] of strings(CONTENT, 'CONTENT')) {
    for (const m of text.matchAll(/\bT1\d{3}(?:\.\d{3})?\b/g)) {
      const id = m[0];
      if (VALID.has(id) || PLACEHOLDERS.has(id)) continue;
      if (HISTORY.test(text.slice(Math.max(0, m.index - 60), m.index))) continue;
      bad.push(`${path}: ${id}${fixture.revokedOrDeprecated[id] ? ` (revoked -> ${fixture.revokedOrDeprecated[id]})` : ' (unknown)'}`);
    }
  }
  assert.deepEqual(bad, []);
});

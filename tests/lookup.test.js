// Mock indicator lookup used by the SIEM panel (content/intel-lookup.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupIndicator, indicatorKind, INTEL_RECORDS } from '../content/intel-lookup.js';
import * as G from '../js/game.js';
import * as E from '../js/engine.js';
import { CONTENT } from '../content/index.js';

test('indicator kinds: ip, domain, sha256, and junk', () => {
  assert.equal(indicatorKind('198.51.100.77'), 'ip');
  assert.equal(indicatorKind('Update-CDN-Sync.example'), 'domain');
  assert.equal(indicatorKind('a'.repeat(64)), 'hash');
  assert.equal(indicatorKind('not a thing'), '');
  assert.equal(indicatorKind('77.100.51.198.in-addr.arpa'), '');
});

test('lookup returns all four sections, hits and misses', () => {
  const hit = lookupIndicator('  UPDATE-CDN-SYNC.EXAMPLE ');
  assert.equal(hit.hit, true);
  assert.equal(hit.kind, 'domain');
  assert.equal(hit.reputation.verdict, 'malicious');
  assert.ok(hit.whois.fields.length >= 1);
  assert.ok(hit.pdns.length >= 1);
  assert.ok(hit.sandbox.note);
  const aged = lookupIndicator('203.0.113.50');
  assert.equal(aged.reputation.verdict, 'aged');
  const miss = lookupIndicator('192.0.2.55');
  assert.equal(miss.hit, false);
  assert.equal(miss.reputation.verdict, 'unknown');
  assert.ok(miss.whois && miss.pdns && miss.sandbox);
  const junk = lookupIndicator('hello');
  assert.equal(junk.kind, '');
});

test('records are fictional documentation addresses and example names', () => {
  const ipOk = (ip) => {
    const [a, b, c] = ip.split('.').map(Number);
    return (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a === 10;
  };
  for (const key of Object.keys(INTEL_RECORDS)) {
    if (indicatorKind(key) === 'ip') assert.ok(ipOk(key), key);
    if (indicatorKind(key) === 'domain') assert.ok(/\.example$/.test(key) || /\.example\.(net|com|org)$/.test(key), key);
  }
});

test('onLookup counts toward Source Check and does not grant XP', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  const now = new Date(2026, 8, 28, 14).getTime();
  assert.equal(G.onLookup(game, st, CONTENT, now).badges.length, 0);
  assert.equal(G.onLookup(game, st, CONTENT, now).badges.length, 0);
  const third = G.onLookup(game, st, CONTENT, now);
  assert.equal(game.counters.lookups, 3);
  assert.equal(game.xp, 0);
  assert.ok(third.badges.some((b) => b.id === 'source-check'));
  assert.ok(game.badges['source-check']);
});

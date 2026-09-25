// Progress backup / move device: file + code round-trips, corruption, versions, migration, reminder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as B from '../js/backup.js';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import { CURRENT_VERSION } from '../js/migrate.js';
import { newState } from '../js/storage.js';
import { CONTENT } from '../content/index.js';

const T0 = new Date(2026, 8, 20, 9).getTime();
const DAY = B.DAY;

function progressed() {
  const st = newState(CONTENT);
  for (const id of ['net-osi', 'net-ip', 'host-processes']) Object.assign(st.skills[id], { p: 0.97, attempts: 8, correct: 8, unlocked: true });
  st.game.xp = 1234;
  st.game.level = G.levelForXp(st.game.xp);
  st.game.badges = { 'first-correct': T0 - 5 * DAY };
  st.history = [
    { skillId: 'net-osi', correct: true, t: T0 - 5 * DAY },
    { skillId: 'net-ip', correct: false, t: T0 - DAY },
  ];
  st.game.rankId = G.computeRank(st.game, st, CONTENT).id;
  return st;
}

test('file: envelope round-trips exactly and names the file by date', () => {
  const st = progressed();
  const json = B.toJsonFile(st, T0);
  const env = JSON.parse(json);
  assert.equal(env.app, 'soc-tutor');
  assert.equal(env.format, B.FORMAT);
  assert.equal(env.stateVersion, CURRENT_VERSION);
  assert.equal(env.exportedAt, T0);
  const u = B.parseFile(json);
  assert.ok(u.ok, u.error);
  assert.deepEqual(u.state, JSON.parse(JSON.stringify(st)));
  assert.match(B.fileName(T0), /^soc-tutor-backup-2026-09-20.*\.json$/);
  assert.ok(B.parseFile('\uFEFF' + json).ok, 'tolerates a BOM');
});

for (const compress of [true, false]) {
  test(`code (${compress ? 'compressed' : 'uncompressed'}): round-trips, survives wrapping and whitespace`, async () => {
    const st = progressed();
    const code = await B.encodeCode(st, T0, { compress });
    assert.match(code, new RegExp(`^SOCT1\\.${compress ? 'd' : 'u'}\\.[0-9a-f]{8}\\.[A-Za-z0-9_-]+$`));
    const u = await B.decodeCode(`  ${B.wrapCode(code, 40)}\n\n`);
    assert.ok(u.ok, u.error);
    assert.equal(u.exportedAt, T0);
    assert.deepEqual(u.state, JSON.parse(JSON.stringify(st)));
  });
}

test('code: compression makes the code much shorter than the raw JSON', async () => {
  const st = progressed();
  const d = await B.encodeCode(st, T0, { compress: true });
  const u = await B.encodeCode(st, T0, { compress: false });
  assert.ok(d.length < u.length / 2, `${d.length} vs ${u.length}`);
});

test('code corruption: checksum mismatch, truncation, bad prefix and junk are rejected with clear messages', async () => {
  const st = progressed();
  for (const compress of [true, false]) {
    const code = await B.encodeCode(st, T0, { compress });
    const [pre, mode, crc, body] = code.split('.');
    // flip one character in the payload
    const i = Math.floor(body.length / 2);
    const flipped = body.slice(0, i) + (body[i] === 'A' ? 'B' : 'A') + body.slice(i + 1);
    const r1 = await B.decodeCode([pre, mode, crc, flipped].join('.'));
    assert.equal(r1.ok, false);
    assert.match(r1.error, /damaged/);
    // wrong checksum
    const badCrc = crc === '00000000' ? '11111111' : '00000000';
    const r2 = await B.decodeCode([pre, mode, badCrc, body].join('.'));
    assert.equal(r2.ok, false);
    assert.match(r2.error, /checksum/);
    // truncated
    const r3 = await B.decodeCode(code.slice(0, Math.floor(code.length * 0.7)));
    assert.equal(r3.ok, false);
    assert.match(r3.error, /damaged|incomplete/);
    // missing segment
    const r4 = await B.decodeCode([pre, mode, body].join('.'));
    assert.equal(r4.ok, false);
    assert.match(r4.error, /incomplete/);
  }
  assert.match((await B.decodeCode('hello world')).error, /SOCT1/);
  assert.match((await B.decodeCode('')).error, /Paste/);
  // valid checksum over something that isn't JSON
  const bytes = new TextEncoder().encode('not json at all');
  const r5 = await B.decodeCode(`SOCT1.u.${B.crc32(bytes)}.${B.toBase64Url(bytes)}`);
  assert.match(r5.error, /unreadable/);
});

test('file corruption: non-JSON, wrong app, damaged state', () => {
  assert.match(B.parseFile('{"app":"soc-tutor",').error, /not valid JSON/);
  assert.match(B.parseFile(JSON.stringify({ app: 'other', format: 1, state: {} })).error, /not a SOC Tutor backup/);
  assert.match(B.parseFile(JSON.stringify({ hello: 1 })).error, /not a SOC Tutor save/);
  const st = progressed();
  const bad = JSON.parse(B.toJsonFile(st, T0));
  bad.state.history = 'oops';
  assert.match(B.parseFile(JSON.stringify(bad)).error, /history/);
  const bad2 = JSON.parse(B.toJsonFile(st, T0));
  bad2.state.skills['net-ip'] = { p: 'high' };
  assert.match(B.parseFile(JSON.stringify(bad2)).error, /skill net-ip/);
  const bad3 = JSON.parse(B.toJsonFile(st, T0));
  bad3.state.game.xp = '9999';
  assert.match(B.parseFile(JSON.stringify(bad3)).error, /game/);
});

test('versions: newer save, newer backup format and newer code prefix ask the user to update', async () => {
  const st = progressed();
  const env = JSON.parse(B.toJsonFile(st, T0));
  env.state.version = CURRENT_VERSION + 1;
  assert.match(B.parseFile(JSON.stringify(env)).error, /newer version/);
  const env2 = JSON.parse(B.toJsonFile(st, T0));
  env2.format = B.FORMAT + 1;
  assert.match(B.parseFile(JSON.stringify(env2)).error, /newer backup format/);
  const code = await B.encodeCode(st, T0, { compress: false });
  assert.match((await B.decodeCode(code.replace(/^SOCT1/, 'SOCT2'))).error, /newer version/);
  const env3 = JSON.parse(B.toJsonFile(st, T0));
  env3.state.version = 0;
  assert.match(B.parseFile(JSON.stringify(env3)).error, /invalid version/);
});

test('import: an older v1 save (bare localStorage copy) is migrated and previewed', async () => {
  const raw = fs.readFileSync(new URL('./fixtures/v1-save-from-main.json', import.meta.url), 'utf8');
  const u = B.parseFile(raw);
  assert.ok(u.ok, u.error);
  assert.equal(u.exportedAt, null);
  const r = B.prepareImport(u, CONTENT, T0);
  assert.ok(r.ok, r.error);
  assert.equal(r.state.version, CURRENT_VERSION);
  assert.equal(r.preview.fromVersion, 1);
  assert.ok(r.preview.mastered >= 1);
  assert.equal(r.preview.skills, E.indexContent(CONTENT).activeSkills.length);
  assert.equal(r.state.game.rankId, G.computeRank(r.state.game, r.state, CONTENT).id);
  assert.equal(r.preview.rank, G.RANKS[G.rankIndex(r.state.game.rankId)].title);
  assert.equal(r.state.backup.lastAt, null, 'a raw copy is not a dated backup');
  // it does not mutate the parsed input
  assert.equal(u.state.version, 1);
  // same save wrapped in a code works too
  const code = await B.encodeCode(JSON.parse(raw), T0);
  const r2 = B.prepareImport(await B.decodeCode(code), CONTENT, T0);
  assert.ok(r2.ok);
  assert.equal(r2.state.version, CURRENT_VERSION);
});

test('import preview: rank, XP, level, mastered, badges, dates; backup date carried over', async () => {
  const st = progressed();
  const r = B.prepareImport(await B.decodeCode(await B.encodeCode(st, T0)), CONTENT, T0 + DAY);
  assert.ok(r.ok);
  const p = r.preview;
  assert.equal(p.xp, 1234);
  assert.equal(p.level, G.levelForXp(1234));
  assert.equal(p.mastered, 3);
  assert.equal(p.badges, 1);
  assert.equal(p.answers, 2);
  assert.equal(p.exportedAt, T0);
  assert.equal(p.lastActive, T0 - DAY);
  assert.equal(p.fromVersion, CURRENT_VERSION);
  assert.equal(typeof p.rank, 'string');
  assert.equal(r.state.backup.lastAt, T0);
  assert.equal(r.state.backup.xpAt, 1234);
  assert.equal(B.prepareImport({ ok: false, error: 'x' }, CONTENT).error, 'x');
});

test('reminder: only after 7+ days without a backup AND meaningful progress; snooze and backup clear it', () => {
  const st = progressed(); // first activity 5 days before T0, 1,234 XP, never backed up
  assert.equal(B.backupReminder(st, T0).show, false, 'only 5 days since first activity');
  const r = B.backupReminder(st, T0 + 3 * DAY);
  assert.equal(r.show, true);
  assert.equal(r.never, true);
  assert.equal(r.xpSince, 1234);
  B.markBackedUp(st, 'file', T0 + 3 * DAY);
  assert.equal(B.backupReminder(st, T0 + 9 * DAY).show, false, 'backed up 6 days ago');
  assert.equal(B.backupReminder(st, T0 + 11 * DAY).show, false, '8 days but no new XP');
  st.game.xp += 100;
  assert.equal(B.backupReminder(st, T0 + 11 * DAY).show, false, '100 XP is not enough');
  st.game.xp += 60;
  const r2 = B.backupReminder(st, T0 + 11 * DAY);
  assert.equal(r2.show, true);
  assert.equal(r2.days, 8);
  assert.equal(r2.xpSince, 160);
  B.snoozeReminder(st, T0 + 11 * DAY);
  assert.equal(B.backupReminder(st, T0 + 12 * DAY).show, false, 'snoozed');
  assert.equal(B.backupReminder(st, T0 + 11 * DAY + B.SNOOZE_DAYS * DAY + 1).show, true, 'snooze expires');
  const fresh = newState(CONTENT);
  assert.equal(B.backupReminder(fresh, T0).show, false);
});

test('crc32 and base64url basics', () => {
  assert.equal(B.crc32(new TextEncoder().encode('123456789')), 'cbf43926');
  const bytes = new Uint8Array(300).map((_, i) => (i * 37) % 256);
  assert.deepEqual(B.fromBase64Url(B.toBase64Url(bytes)), bytes);
  assert.doesNotMatch(B.toBase64Url(bytes), /[+/=]/);
});

// Progress backup and "move to another device": export to a .json file or a copyable backup
// code, import from either with validation, preview and migration. Pure logic (no DOM),
// unit-tested in tests/backup.test.js. The UI lives in js/backup-ui.js.
//
// Backup code format (v1):  SOCT1.<enc>.<crc32>.<payload>
//   enc      'd' = deflate-raw compressed, 'u' = uncompressed (browsers without CompressionStream)
//   crc32    8 hex digits, CRC-32 of the UTF-8 JSON text (detects typos and truncation)
//   payload  base64url of the (compressed) JSON text
// The JSON (file and code alike) is an envelope: { app, format, exportedAt, stateVersion, state }.
import * as E from './engine.js';
import * as G from './game.js';
import { migrateState, CURRENT_VERSION } from './migrate.js';

export const APP_ID = 'soc-tutor';
export const FORMAT = 1;
export const CODE_PREFIX = 'SOCT1';
export const DAY = 86400000;
export const REMIND_AFTER_DAYS = 7;
export const REMIND_MIN_XP = 150; // "meaningful progress" since the last backup
export const SNOOZE_DAYS = 3;

// ------------------------------------------------------------------ bytes, checksum, base64

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes;
  let crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) crc = CRC_TABLE[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function pipe(bytes, stream) {
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}
const deflate = (bytes) => pipe(bytes, new CompressionStream('deflate-raw'));
const inflate = (bytes) => pipe(bytes, new DecompressionStream('deflate-raw'));

// ------------------------------------------------------------------ export

/** The backup envelope for a state (a deep copy, so later changes don't leak in). */
export function makeEnvelope(st, now = Date.now()) {
  return { app: APP_ID, format: FORMAT, exportedAt: now, stateVersion: st.version || 1, state: JSON.parse(JSON.stringify(st)) };
}

export function toJsonFile(st, now = Date.now()) {
  return JSON.stringify(makeEnvelope(st, now), null, 1);
}

export function fileName(now = Date.now()) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `soc-tutor-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/** Backup code for a state. `compress: false` forces the uncompressed form. */
export async function encodeCode(st, now = Date.now(), { compress = canCompress() } = {}) {
  const json = JSON.stringify(makeEnvelope(st, now));
  const bytes = enc.encode(json);
  const body = compress ? await deflate(bytes) : bytes;
  return `${CODE_PREFIX}.${compress ? 'd' : 'u'}.${crc32(bytes)}.${toBase64Url(body)}`;
}

/** Splits a long code into lines so it can be read and copied on a phone. */
export const wrapCode = (code, width = 64) => code.match(new RegExp(`.{1,${width}}`, 'g')).join('\n');

// ------------------------------------------------------------------ import

const fail = (error) => ({ ok: false, error });

/** Checks that a parsed object looks like a SOC Tutor save. Returns an error message or null. */
export function validateState(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return 'This is not a SOC Tutor save.';
  if (!st.skills || typeof st.skills !== 'object' || Array.isArray(st.skills)) return 'This is not a SOC Tutor save (no skill data).';
  const v = st.version ?? 1;
  if (!Number.isInteger(v) || v < 1) return 'This save has an invalid version number.';
  if (v > CURRENT_VERSION) return `This backup was made by a newer version of SOC Tutor (save v${v}, this app reads up to v${CURRENT_VERSION}). Reload the page to update, then try again.`;
  if (st.history !== undefined && !Array.isArray(st.history)) return 'This save is damaged (history is not a list).';
  if (st.game !== undefined && (typeof st.game !== 'object' || st.game === null || (st.game.xp !== undefined && typeof st.game.xp !== 'number'))) return 'This save is damaged (game profile).';
  for (const [id, s] of Object.entries(st.skills)) {
    if (!s || typeof s !== 'object' || (s.p !== undefined && typeof s.p !== 'number')) return `This save is damaged (skill ${id}).`;
  }
  return null;
}

/**
 * Accepts a backup envelope, or a bare state (e.g. a raw localStorage copy).
 * Returns { ok, state, exportedAt } or { ok: false, error }.
 */
export function unwrap(obj) {
  if (obj && typeof obj === 'object' && 'state' in obj && ('app' in obj || 'format' in obj)) {
    if (obj.app !== APP_ID) return fail('This file is not a SOC Tutor backup.');
    if (!Number.isInteger(obj.format) || obj.format > FORMAT) return fail('This backup uses a newer backup format. Reload the page to update SOC Tutor, then try again.');
    const err = validateState(obj.state);
    return err ? fail(err) : { ok: true, state: obj.state, exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : null };
  }
  const err = validateState(obj);
  return err ? fail(err) : { ok: true, state: obj, exportedAt: null };
}

/** Parses the text of a backup file. */
export function parseFile(text) {
  let obj;
  try {
    obj = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch {
    return fail('That file is not valid JSON. Choose the .json file SOC Tutor exported.');
  }
  return unwrap(obj);
}

/** Decodes a pasted backup code (whitespace and line breaks are ignored). */
export async function decodeCode(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!clean) return fail('Paste a backup code first.');
  const parts = clean.split('.');
  if (parts[0] !== CODE_PREFIX) {
    if (/^SOCT\d+$/.test(parts[0])) return fail('This code was made by a newer version of SOC Tutor. Reload the page to update, then try again.');
    if (clean.startsWith('{')) return parseFile(clean);
    return fail('That doesn\'t look like a SOC Tutor backup code. It should start with SOCT1.');
  }
  if (parts.length !== 4 || !['d', 'u'].includes(parts[1]) || !/^[0-9a-f]{8}$/.test(parts[2]) || !/^[A-Za-z0-9_-]+$/.test(parts[3])) {
    return fail('The code is incomplete or damaged. Copy the whole code, from SOCT1 to the end.');
  }
  let bytes;
  try {
    bytes = fromBase64Url(parts[3]);
    if (parts[1] === 'd') {
      if (!canCompress()) return fail('This browser can\'t read compressed codes. Use the backup file instead.');
      bytes = await inflate(bytes);
    }
  } catch {
    return fail('The code is damaged (it could not be unpacked). Copy the whole code again.');
  }
  if (crc32(bytes) !== parts[2]) return fail('The code is damaged (checksum mismatch). Copy the whole code again.');
  let obj;
  try {
    obj = JSON.parse(dec.decode(bytes));
  } catch {
    return fail('The code is damaged (unreadable data).');
  }
  return unwrap(obj);
}

/**
 * Turns an unwrapped backup into a ready-to-use state: deep copy, run the normal save
 * migrations (older saves are upgraded), and build a preview for the confirmation screen.
 */
export function prepareImport(unwrapped, content, now = Date.now()) {
  if (!unwrapped?.ok) return unwrapped || fail('Nothing to import.');
  let st;
  try {
    st = migrateState(JSON.parse(JSON.stringify(unwrapped.state)), content, now);
  } catch (err) {
    return fail(`This save could not be upgraded (${err.message}).`);
  }
  st.game.rankId = G.computeRank(st.game, st, content).id;
  st.game.level = G.levelForXp(st.game.xp);
  ensureBackup(st, now);
  if (unwrapped.exportedAt) {
    st.backup.lastAt = unwrapped.exportedAt;
    st.backup.xpAt = st.game.xp;
  }
  return { ok: true, state: st, preview: preview(st, unwrapped, content) };
}

export function lastActivity(st) {
  const times = [...(st.history || []).map((h) => h.t), ...Object.values(st.skills || {}).map((s) => s?.lastAt)].filter((t) => typeof t === 'number');
  return times.length ? Math.max(...times) : null;
}

export function preview(st, unwrapped, content) {
  const idx = E.indexContent(content);
  const mastered = idx.activeSkills.filter((s) => E.isMastered(st, content, s.id)).length;
  const rank = G.RANKS[G.rankIndex(st.game.rankId)];
  return {
    rank: rank.title,
    rankIndex: G.rankIndex(rank.id),
    xp: st.game.xp,
    level: st.game.level,
    mastered,
    skills: idx.activeSkills.length,
    answers: (st.history || []).length,
    badges: Object.keys(st.game.badges || {}).length,
    exportedAt: unwrapped.exportedAt,
    lastActive: lastActivity(st),
    fromVersion: unwrapped.state.version || 1,
  };
}

// ------------------------------------------------------------------ backup status and reminder

export function ensureBackup(st, now = Date.now()) {
  if (!st.backup || typeof st.backup !== 'object') {
    const first = (st.history || []).map((h) => h.t).filter((t) => typeof t === 'number');
    st.backup = { lastAt: null, method: null, xpAt: 0, since: first.length ? Math.min(...first) : now, snoozedUntil: 0 };
  }
  return st.backup;
}

export function markBackedUp(st, method, now = Date.now()) {
  const b = ensureBackup(st, now);
  Object.assign(b, { lastAt: now, method, xpAt: st.game?.xp || 0, snoozedUntil: 0 });
  return b;
}

export function snoozeReminder(st, now = Date.now()) {
  ensureBackup(st, now).snoozedUntil = now + SNOOZE_DAYS * DAY;
}

/**
 * Whether to show the gentle "back up your progress" reminder: no backup for 7+ days
 * (or ever, counting from the first recorded activity) AND meaningful progress since.
 */
export function backupReminder(st, now = Date.now()) {
  const b = ensureBackup(st, now);
  const from = b.lastAt ?? b.since ?? now;
  const days = Math.floor((now - from) / DAY);
  const xpSince = Math.max(0, (st.game?.xp || 0) - (b.xpAt || 0));
  const show = days >= REMIND_AFTER_DAYS && xpSince >= REMIND_MIN_XP && !(b.snoozedUntil > now);
  return { show, days, xpSince, never: !b.lastAt };
}

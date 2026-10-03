// Query bar for SIEM investigations: turns a case's log rows into a queryable table
// (SPL: index=case, KQL: CaseLogs) with automatic field extraction, like a SIEM does at search time.
// Pure JavaScript, unit-tested in tests/query.test.js.
import { runQuery, ID } from './query.js';

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const BASE = ['source', 'host', 'user', 'type', 'msg'];

function caseDay(c) {
  const m = /(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/.exec(c.date || '');
  if (m && m[2] in MON) return Date.UTC(+m[3], MON[m[2]], +m[1]) / 1000;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(c.date || '');
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) / 1000;
  return Date.UTC(2026, 8, 1) / 1000;
}
const toSec = (t) => {
  const [h, m, s] = String(t).split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** Search-time field extraction from a log message: key=value, "Key Name: value", firewall arrows, event codes. */
export function extractFields(r) {
  const f = {};
  const msg = String(r.msg || '');
  for (const m of msg.matchAll(/(?:^|[\s,;(])([A-Za-z_][\w.-]{0,30})=("([^"]*)"|[^\s,;)]+)/g)) {
    const k = m[1];
    if (!BASE.includes(k) && !(k in f)) f[k] = m[3] !== undefined ? m[3] : m[2];
  }
  for (const m of msg.matchAll(/(?:^|\s{2}|\.\s|\s)([A-Z][A-Za-z]+(?: [A-Z]?[a-z]+)?):\s+([^\s,]+)/g)) {
    let k = m[1].replace(/\s+/g, '_');
    if (BASE.includes(k.toLowerCase())) k = k.toLowerCase() === 'source' ? 'SourceAddress' : `${k}_`;
    if (!BASE.includes(k) && !(k in f) && !/^(http|https)$/i.test(k)) f[k] = m[2];
  }
  const arrow = /(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?\s*->\s*(\d{1,3}(?:\.\d{1,3}){3}|[\w.-]+)(?::(\d+))?/.exec(msg);
  if (arrow) {
    f.src_ip ??= arrow[1];
    if (arrow[2]) f.src_port ??= arrow[2];
    f.dest_ip ??= arrow[3];
    if (arrow[4]) f.dest_port ??= arrow[4];
  } else {
    const ip = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/.exec(msg);
    if (ip) f.ip ??= ip[1];
  }
  const code = /\b(\d{4})\b/.exec(r.type || '');
  if (code) f.EventCode ??= code[1];
  for (const [k, v] of Object.entries(f)) if (/^\d+$/.test(v) && v.length < 10) f[k] = Number(v);
  return f;
}

const cache = new WeakMap();
/** The case as one table: { id, spl: 'case', kql: 'CaseLogs', fields, events, now }. */
export function caseTable(c) {
  if (cache.has(c)) return cache.get(c);
  const day = caseDay(c);
  const counts = new Map();
  const events = c.logs.map((r) => {
    const x = extractFields(r);
    for (const k of Object.keys(x)) counts.set(k, (counts.get(k) || 0) + 1);
    return { id: r.id, _time: day + toSec(r.t), source: r.src, host: r.host, user: r.user || '', type: r.type, msg: r.msg, ...x, _raw: `${r.t} ${r.src} ${r.host} ${r.user || '-'} ${r.type} ${r.msg}` };
  });
  const extra = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const table = {
    id: 'case',
    title: c.title,
    spl: 'case',
    kql: 'CaseLogs',
    fields: [...BASE, ...extra],
    names: { spl: {}, kql: { source: 'LogSource', host: 'Computer', user: 'Account', type: 'Activity', msg: 'Message' } },
    aliases: { sourcetype: 'source', src: 'source', message: 'msg', Message: 'msg' },
    events,
    now: day + 86400,
  };
  cache.set(c, table);
  return table;
}

/**
 * Runs a query over a case. Returns the engine result plus `ids`: the matching log ids when the
 * result is still made of raw events (so the log list can be filtered and rows pinned), else null.
 */
export function runCaseQuery(c, text, dialect) {
  const table = caseTable(c);
  const res = runQuery(text, { dialect, tables: [table], defaultTable: 'case' });
  const ids = res.events ? res.rows.map((r) => r[ID]).filter((x) => x !== undefined) : null;
  return { ...res, ids };
}

export function caseStarter(dialect) {
  return dialect === 'kql' ? 'CaseLogs\n| summarize count() by Source, Activity' : 'index=case\n| stats count by source, type';
}

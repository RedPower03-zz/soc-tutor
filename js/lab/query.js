// Mini query engine for the query sandbox: a practical subset of Splunk SPL and Microsoft KQL.
// Pure JavaScript (no DOM), unit-tested in tests/query.test.js.
//
// A query runs over "tables": { id, spl (index name), kql (table name), aliases, fields, events, now }.
// Events are flat objects; `_time` is epoch seconds (UTC) and `_raw` is the original log line.
//
// SPL:  index=... field=value "phrase" NOT x (a OR b) earliest=-24h | where | eval | stats | eventstats
//       | streamstats | sort | head | tail | table | fields | dedup | rename | top | rare | bin
//       | timechart | rex | regex | fillnull | search | reverse
// KQL:  Table | where | project | project-away | project-rename | extend | summarize ... by
//       | order/sort by | take/limit | top N by | distinct | count | serialize | search | parse
//       | getschema | render (ignored)
//
// runQuery(text, { dialect, tables, defaultTable }) -> { columns, rows, total, warnings, notes, tables }
// Throws QueryError with a friendly message (and a hint) on a syntax error.

export class QueryError extends Error {
  constructor(message, hint = '') {
    super(message);
    this.name = 'QueryError';
    this.hint = hint;
  }
}

export const DS = Symbol('dataset'); // the table an event came from (for aliases and `index`)
export const ID = Symbol('eventId'); // the event's original id (so results can be pinned)

const GLOBAL_ALIASES = { TimeGenerated: '_time', timestamp: '_time', Timestamp: '_time', time: '_time' };

// =================================================================== values

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
export const isNil = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));
function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && NUMERIC_RE.test(v.trim())) return Number(v);
  return NaN;
}
const str = (v) => (isNil(v) ? '' : Array.isArray(v) ? v.join(' ') : String(v));

/** Loose equality used by both dialects: numbers compare numerically, a literal keeps its raw text. */
function looseEq(a, b, ci = false, raw = null) {
  if (Array.isArray(a)) return a.some((x) => looseEq(x, b, ci, raw));
  if (isNil(a) && isNil(b)) return true;
  if (isNil(a) || isNil(b)) return false;
  const na = toNum(a);
  const nb = toNum(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  if (raw != null && str(a).toLowerCase() === String(raw).toLowerCase()) return true;
  return ci ? str(a).toLowerCase() === str(b).toLowerCase() : str(a) === str(b);
}

function compare(a, b) {
  const an = isNil(a);
  const bn = isNil(b);
  if (an || bn) return an && bn ? 0 : an ? 1 : -1; // nulls last
  const na = toNum(a);
  const nb = toNum(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  const sa = str(a).toLowerCase();
  const sb = str(b).toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false';
  return !!v && !Number.isNaN(v);
}

const reCache = new Map();
const escRe = (s) => String(s).replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
/** Splunk-style wildcard pattern ('*' = anything) to an anchored, case-insensitive RegExp. */
export function wildcardRe(pattern, ci = true) {
  const key = `w${ci ? 'i' : ''}:${pattern}`;
  if (!reCache.has(key)) reCache.set(key, new RegExp(`^${String(pattern).split('*').map(escRe).join('.*')}$`, ci ? 'is' : 's'));
  return reCache.get(key);
}
function likeRe(pattern) {
  const key = `l:${pattern}`;
  if (!reCache.has(key)) {
    let body = '';
    for (const ch of String(pattern)) body += ch === '%' ? '.*' : ch === '_' ? '.' : escRe(ch);
    reCache.set(key, new RegExp(`^${body}$`, 's'));
  }
  return reCache.get(key);
}
function userRe(src, flags = '') {
  const key = `r${flags}:${src}`;
  if (!reCache.has(key)) {
    try {
      reCache.set(key, new RegExp(String(src).replace(/\(\?P</g, '(?<'), flags));
    } catch (e) {
      throw new QueryError(`Invalid regular expression: ${src}`, e.message);
    }
  }
  return reCache.get(key);
}

// ------------------------------------------------------------------ IPs
function ipToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip).trim());
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
export function cidrMatch(cidr, ip) {
  const [net, bitsS = '32'] = String(cidr).split('/');
  const n = ipToInt(net);
  const i = ipToInt(ip);
  const bits = Number(bitsS);
  if (n == null || i == null || !(bits >= 0 && bits <= 32)) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((n & mask) >>> 0) === ((i & mask) >>> 0);
}
const isPrivateIp = (ip) => ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'].some((c) => cidrMatch(c, ip));

// =================================================================== time

const UNIT_SEC = { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, d: 86400, day: 86400, days: 86400, w: 604800, week: 604800, weeks: 604800, ms: 0.001 };

/** "5m" / "1h" / "30s" / "2d" -> seconds (null if not a span). */
export function parseSpan(s) {
  const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(String(s).trim());
  if (!m || !(m[2].toLowerCase() in UNIT_SEC)) return null;
  return Number(m[1]) * UNIT_SEC[m[2].toLowerCase()];
}

function snap(t, unit) {
  const d = new Date(t * 1000);
  const u = unit.toLowerCase();
  if (u.startsWith('h')) d.setUTCMinutes(0, 0, 0);
  else if (u.startsWith('d')) d.setUTCHours(0, 0, 0, 0);
  else if (u.startsWith('w')) {
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  } else if (u.startsWith('m')) d.setUTCSeconds(0, 0);
  else if (u.startsWith('s')) d.setUTCMilliseconds(0);
  return Math.floor(d.getTime() / 1000);
}

/** Parses a date/time written by a user ("2026-09-24 03:00", "09/24/2026:03:00:00", epoch). Returns seconds. */
export function parseDateTime(s) {
  const v = String(s).trim().replace(/^["']|["']$/g, '');
  if (/^\d{9,11}(\.\d+)?$/.test(v)) return Number(v);
  let m = /^(\d{2})\/(\d{2})\/(\d{4})(?::(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  if (m) return Date.UTC(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000;
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?Z?$/.exec(v);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000;
  return null;
}

/** SPL time modifier: -24h, -7d@d, @h, now, 0, or an absolute time. Relative to `now` (seconds). */
export function parseTimeModifier(v, now) {
  const s = String(v).trim().replace(/^["']|["']$/g, '');
  if (s === 'now' || s === 'now()') return now;
  if (s === '0') return 0;
  const m = /^([+-]\d+[a-z]+)?(?:@([a-z]+))?$/i.exec(s);
  if (m && (m[1] || m[2])) {
    let t = now;
    if (m[1]) {
      const span = parseSpan(m[1].slice(1));
      if (span == null) throw new QueryError(`Unknown time unit in ${s}`, 'Use s, m, h, d or w, e.g. earliest=-24h');
      t += (m[1][0] === '-' ? -1 : 1) * span;
    }
    if (m[2]) t = snap(t, m[2]);
    return t;
  }
  const abs = parseDateTime(s);
  if (abs == null) throw new QueryError(`Can't read the time "${s}"`, 'Try earliest=-24h or earliest="09/24/2026:03:00:00"');
  return abs;
}

export function formatTime(sec) {
  const d = new Date(sec * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
/** Numbers in this range are shown as timestamps. */
export const looksLikeTime = (v) => typeof v === 'number' && v >= 1.7e9 && v <= 1.9e9;

// =================================================================== splitting and tokens

/** Splits on `|` outside quotes, parentheses and brackets. */
export function splitPipes(text) {
  const out = [];
  let cur = '';
  let q = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      cur += ch;
      if (ch === '\\' && i + 1 < text.length) cur += text[++i];
      else if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch === '|' && depth === 0 && text[i + 1] !== '|' && text[i - 1] !== '|') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (q) throw new QueryError('A quote is not closed.', 'Every " needs a matching ".');
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Reads a string literal at src[i]: "..", '..', @"..", @'..'. Returns [value, nextIndex]. */
function readString(src, i) {
  let verbatim = false;
  if (src[i] === '@') {
    verbatim = true;
    i++;
  }
  const q = src[i];
  let j = i + 1;
  let val = '';
  while (j < src.length && src[j] !== q) {
    if (!verbatim && src[j] === '\\' && j + 1 < src.length) {
      const n = src[j + 1];
      if (n === q || n === '\\') val += n;
      else if (n === 'n') val += '\n';
      else if (n === 't') val += '\t';
      else val += `\\${n}`; // unknown escapes stay literal (\d, \w, \p ... in regexes and paths)
      j += 2;
      continue;
    }
    val += src[j++];
  }
  if (j >= src.length) throw new QueryError('A quote is not closed.', 'Every " needs a matching ".');
  return [val, j + 1];
}

const EXPR_OPS = ['==', '!=', '<>', '=~', '!~', '<=', '>=', '&&', '||', '..', '<', '>', '=', '(', ')', ',', '+', '-', '*', '/', '%', '!', '[', ']'];

/** Tokenizer for expressions (SPL where/eval/stats, all of KQL). */
export function tokenize(src, dialect) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    const dt = /^(datetime|timespan)\s*\(([^)"]*)\)/i.exec(rest);
    if (dt) {
      toks.push({ t: 'id', v: dt[1] }, { t: 'op', v: '(' }, { t: 'str', v: dt[2].trim() }, { t: 'op', v: ')' });
      i += dt[0].length;
      continue;
    }
    if (ch === '"' || ch === "'" || (ch === '@' && (src[i + 1] === '"' || src[i + 1] === "'"))) {
      const [v, j] = readString(src, i);
      // SPL: single quotes wrap a field name in eval/where
      toks.push(dialect === 'spl' && ch === "'" ? { t: 'id', v } : { t: 'str', v });
      i = j;
      continue;
    }
    const num = /^(0x[0-9a-f]+|\d+(?:\.\d+)?)([a-z]+)?/i.exec(rest);
    if (num && !/[\w.]/.test(src[i - 1] || '')) {
      const [whole, n, unit] = num;
      const isHex = /^0x/i.test(n);
      if (!unit || isHex) {
        toks.push({ t: 'num', v: isHex ? parseInt(n, 16) : Number(n), raw: n });
        i += n.length;
        continue;
      }
      if (dialect === 'kql' && unit.toLowerCase() in UNIT_SEC) {
        toks.push({ t: 'num', v: parseSpan(whole), raw: whole, span: true });
        i += whole.length;
        continue;
      }
      // SPL "5m" etc. falls through to a word
    }
    const bang = /^!(contains_cs|contains|has_cs|has|in~|in|startswith_cs|startswith|endswith_cs|endswith|between)(?![\w])/i.exec(rest);
    if (bang) {
      toks.push({ t: 'id', v: bang[0].toLowerCase() });
      i += bang[0].length;
      continue;
    }
    const op = EXPR_OPS.find((o) => src.startsWith(o, i));
    if (op && !(op === '-' && dialect === 'kql' && /^-(away|rename|reorder)\b/.test(rest))) {
      toks.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }
    const id = /^[A-Za-z_$][\w.$]*~?/.exec(rest);
    if (id) {
      toks.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const word = /^[^\s()",|=<>!]+/.exec(rest);
    if (word) {
      toks.push({ t: 'id', v: word[0] });
      i += word[0].length;
      continue;
    }
    throw new QueryError(`Unexpected character "${ch}"`);
  }
  return toks;
}

class Stream {
  constructor(toks) {
    this.toks = toks;
    this.i = 0;
  }
  peek(o = 0) {
    return this.toks[this.i + o];
  }
  next() {
    return this.toks[this.i++];
  }
  done() {
    return this.i >= this.toks.length;
  }
  isOp(v, o = 0) {
    const t = this.peek(o);
    return !!t && t.t === 'op' && t.v === v;
  }
  isWord(v, o = 0) {
    const t = this.peek(o);
    return !!t && t.t === 'id' && t.v.toLowerCase() === v.toLowerCase();
  }
  eatOp(v) {
    return this.isOp(v) ? this.next() : null;
  }
  eatWord(v) {
    return this.isWord(v) ? this.next() : null;
  }
  expectOp(v, ctx = '') {
    if (!this.isOp(v)) throw new QueryError(`Expected "${v}"${ctx ? ` ${ctx}` : ''}${this.peek() ? `, found "${this.peek().raw ?? this.peek().v}"` : ' at the end'}.`);
    return this.next();
  }
  ident(ctx = 'a field name') {
    const t = this.next();
    if (!t || (t.t !== 'id' && t.t !== 'str')) throw new QueryError(`Expected ${ctx}${t ? `, found "${t.raw ?? t.v}"` : ''}.`);
    return t.v;
  }
}

// =================================================================== expression parser

// AST: { k: 'lit', v, raw } | { k: 'field', name } | { k: 'call', name, args } | { k: 'bin', op, a, b }
//      | { k: 'not', a } | { k: 'neg', a } | { k: 'in', a, list, neg, ci } | { k: 'between', a, lo, hi, neg }
//      | { k: 'hasany', a, list, all }

const KQL_STRING_OPS = new Set(['contains', '!contains', 'contains_cs', '!contains_cs', 'has', '!has', 'has_cs', 'startswith', '!startswith', 'startswith_cs', 'endswith', '!endswith', 'endswith_cs', 'has_any', 'has_all', 'like']);
const CMP_OPS = ['==', '=', '!=', '<>', '<', '>', '<=', '>=', '=~', '!~'];

export function parseExpr(s, dialect) {
  const list = () => {
    s.expectOp('(', 'to start the list');
    const out = [];
    if (!s.isOp(')')) {
      do out.push(add());
      while (s.eatOp(','));
    }
    s.expectOp(')', 'to close the list');
    return out;
  };
  const or = () => {
    let a = and();
    while (s.isWord('or') || s.isOp('||')) {
      s.next();
      a = { k: 'bin', op: 'or', a, b: and() };
    }
    return a;
  };
  const and = () => {
    let a = not();
    while (s.isWord('and') || s.isOp('&&')) {
      s.next();
      a = { k: 'bin', op: 'and', a, b: not() };
    }
    return a;
  };
  const not = () => {
    if ((s.isWord('not') && !s.isOp('(', 1)) || s.isOp('!')) {
      s.next();
      return { k: 'not', a: not() };
    }
    return cmp();
  };
  const cmp = () => {
    const a = add();
    const t = s.peek();
    if (!t) return a;
    if (t.t === 'op' && CMP_OPS.includes(t.v)) {
      s.next();
      const op = t.v === '=' ? '==' : t.v === '<>' ? '!=' : t.v;
      return { k: 'bin', op, a, b: add() };
    }
    if (t.t !== 'id') return a;
    const w = t.v.toLowerCase();
    if (w === 'in' || w === '!in' || w === 'in~' || w === '!in~') {
      s.next();
      return { k: 'in', a, list: list(), neg: w.startsWith('!'), ci: w.endsWith('~') || dialect === 'spl' };
    }
    if (w === 'between' || w === '!between') {
      s.next();
      s.expectOp('(', 'after between');
      const lo = add();
      s.expectOp('..', 'inside between (low .. high)');
      const hi = add();
      s.expectOp(')', 'to close between');
      return { k: 'between', a, lo, hi, neg: w.startsWith('!') };
    }
    if (w === 'matches' && s.isWord('regex', 1)) {
      s.next();
      s.next();
      return { k: 'bin', op: 'matches', a, b: add() };
    }
    if (w === 'has_any' || w === 'has_all') {
      s.next();
      return { k: 'hasany', a, list: list(), all: w === 'has_all' };
    }
    if (KQL_STRING_OPS.has(w)) {
      s.next();
      return { k: 'bin', op: w, a, b: add() };
    }
    return a;
  };
  const add = () => {
    let a = mul();
    while (s.isOp('+') || s.isOp('-')) {
      const op = s.next().v;
      a = { k: 'bin', op, a, b: mul() };
    }
    return a;
  };
  const mul = () => {
    let a = unary();
    while (s.isOp('*') || s.isOp('/') || s.isOp('%')) {
      const op = s.next().v;
      a = { k: 'bin', op, a, b: unary() };
    }
    return a;
  };
  const unary = () => {
    if (s.isOp('-')) {
      s.next();
      return { k: 'neg', a: unary() };
    }
    return primary();
  };
  const primary = () => {
    let e = primary0();
    while (s.isOp('[')) {
      s.next();
      const i = add();
      s.expectOp(']', 'to close the index');
      e = { k: 'index', a: e, i };
    }
    return e;
  };
  const primary0 = () => {
    const t = s.next();
    if (!t) throw new QueryError('The expression ends too early.');
    if (t.t === 'num') return { k: 'lit', v: t.v, raw: t.raw };
    if (t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      const e = or();
      s.expectOp(')', 'to close the bracket');
      return e;
    }
    if (t.t === 'op' && t.v === '*') return { k: 'star' };
    if (t.t === 'id') {
      const lw = t.v.toLowerCase();
      if (lw === 'true' || lw === 'false') return { k: 'lit', v: lw === 'true' };
      if (lw === 'null') return { k: 'lit', v: null };
      if (s.isOp('(')) {
        s.next();
        const args = [];
        if (!s.isOp(')')) {
          do args.push(or());
          while (s.eatOp(','));
        }
        s.expectOp(')', `to close ${t.v}(`);
        return { k: 'call', name: lw, args };
      }
      return { k: 'field', name: t.v };
    }
    throw new QueryError(`Unexpected "${t.v}" in the expression.`);
  };
  return or();
}

// =================================================================== fields

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const RAW = Symbol('raw');

/** Reads a field from a row: exact name, dataset alias, global alias, virtual field, then case-insensitive. */
export function getField(row, name) {
  if (hasOwn(row, name)) return row[name];
  const ds = row[DS];
  if (name === '_raw' && row[RAW] !== undefined) return row[RAW];
  if (ds) {
    if (name === 'index') return ds.spl;
    if (name === 'sourcetype' && ds.sourcetype) return ds.sourcetype;
    if (name === 'Type' && ds.kql) return ds.kql;
    const al = ds.aliases;
    if (al) {
      if (hasOwn(al, name) && hasOwn(row, al[name])) return row[al[name]];
      const lk = name.toLowerCase();
      for (const k of Object.keys(al)) if (k.toLowerCase() === lk && hasOwn(row, al[k])) return row[al[k]];
    }
  }
  const g = GLOBAL_ALIASES[name];
  if (g && hasOwn(row, g)) return row[g];
  if (name === '_time' && hasOwn(row, 'TimeGenerated')) return row.TimeGenerated;
  const t = hasOwn(row, '_time') ? row._time : hasOwn(row, 'TimeGenerated') ? row.TimeGenerated : undefined;
  if (typeof t === 'number' && /^date_(hour|minute|mday|wday|month|year|second)$/.test(name)) {
    const d = new Date(t * 1000);
    return { date_hour: d.getUTCHours(), date_minute: d.getUTCMinutes(), date_second: d.getUTCSeconds(), date_mday: d.getUTCDate(), date_wday: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()], date_month: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][d.getUTCMonth()], date_year: d.getUTCFullYear() }[name];
  }
  const lk = name.toLowerCase();
  for (const k of Object.keys(row)) if (k.toLowerCase() === lk) return row[k];
  return undefined;
}

/** True if `name` resolves on this row (used for "unknown field" warnings). */
function knowsField(row, name) {
  if (getField(row, name) !== undefined) return true;
  return false;
}

/** Output column name for a field reference (resolves aliases so `table user` shows user). */
function fieldExists(rows, cols, name) {
  if (cols.some((c) => c.toLowerCase() === name.toLowerCase())) return true;
  for (let i = 0; i < Math.min(rows.length, 60); i++) if (knowsField(rows[i], name)) return true;
  return false;
}

function copyMeta(from, to) {
  if (from[DS]) to[DS] = from[DS];
  if (from[ID] !== undefined) to[ID] = from[ID];
  if (from[RAW] !== undefined) to[RAW] = from[RAW];
  return to;
}

// =================================================================== scalar functions

function strftime(t, fmt) {
  if (isNil(t)) return null;
  const d = new Date(toNum(t) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return String(fmt).replace(/%([a-zA-Z%])/g, (m, c) => ({ Y: d.getUTCFullYear(), m: p(d.getUTCMonth() + 1), d: p(d.getUTCDate()), H: p(d.getUTCHours()), M: p(d.getUTCMinutes()), S: p(d.getUTCSeconds()), F: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, T: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`, a: days[d.getUTCDay()], s: Math.floor(d.getTime() / 1000), '%': '%' })[c] ?? m);
}
function formatDatetime(t, fmt) {
  if (isNil(t)) return null;
  const d = new Date(toNum(t) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return String(fmt).replace(/yyyy|MM|dd|HH|mm|ss/g, (m) => ({ yyyy: d.getUTCFullYear(), MM: p(d.getUTCMonth() + 1), dd: p(d.getUTCDate()), HH: p(d.getUTCHours()), mm: p(d.getUTCMinutes()), ss: p(d.getUTCSeconds()) })[m]);
}
function hasTerm(hay, needle, cs = false) {
  if (isNil(hay)) return false;
  const h = cs ? str(hay) : str(hay).toLowerCase();
  const n = cs ? str(needle) : str(needle).toLowerCase();
  if (!n) return true;
  let idx = h.indexOf(n);
  const alnum = /[a-z0-9_]/i;
  while (idx !== -1) {
    const before = idx === 0 ? '' : h[idx - 1];
    const after = h[idx + n.length] || '';
    const okB = !before || !alnum.test(before) || !alnum.test(n[0]);
    const okA = !after || !alnum.test(after) || !alnum.test(n[n.length - 1]);
    if (okB && okA) return true;
    idx = h.indexOf(n, idx + 1);
  }
  return false;
}
function b64decode(s) {
  try {
    const bin = typeof atob === 'function' ? atob(str(s)) : Buffer.from(str(s), 'base64').toString('binary');
    // PowerShell -EncodedCommand is UTF-16LE: drop the NUL bytes
    return bin.replace(/\u0000/g, '');
  } catch {
    return null;
  }
}
const num1 = (v) => {
  const n = toNum(Array.isArray(v) ? v[0] : v);
  return Number.isNaN(n) ? null : n;
};

// fn(args, ctx) where args are already evaluated (except for lazy ones handled in evalNode)
const FUNCS = {
  tostring: ([v]) => (isNil(v) ? '' : str(v)),
  tonumber: ([v, base]) => (isNil(v) ? null : base ? parseInt(str(v), toNum(base)) : num1(v)),
  toint: ([v]) => (num1(v) == null ? null : Math.trunc(num1(v))),
  tolong: ([v]) => (num1(v) == null ? null : Math.trunc(num1(v))),
  todouble: ([v]) => num1(v),
  real: ([v]) => num1(v),
  long: ([v]) => (num1(v) == null ? null : Math.trunc(num1(v))),
  int: ([v]) => (num1(v) == null ? null : Math.trunc(num1(v))),
  double: ([v]) => num1(v),
  toreal: ([v]) => num1(v),
  todecimal: ([v]) => num1(v),
  tolower: ([v]) => str(v).toLowerCase(),
  lower: ([v]) => str(v).toLowerCase(),
  toupper: ([v]) => str(v).toUpperCase(),
  upper: ([v]) => str(v).toUpperCase(),
  strlen: ([v]) => str(v).length,
  len: ([v]) => str(v).length,
  strcat: (a) => a.map(str).join(''),
  trim: (a, ctx) => (ctx.dialect === 'kql' && a.length === 2 ? str(a[1]).replace(new RegExp(`^(${a[0]})+|(${a[0]})+$`, 'g'), '') : str(a[0]).trim()),
  ltrim: ([v]) => str(v).trimStart(),
  rtrim: ([v]) => str(v).trimEnd(),
  substr: ([s, start, n]) => {
    const st = Math.max(0, toNum(start) - 1);
    return n == null ? str(s).slice(st) : str(s).substr(st, toNum(n));
  },
  substring: ([s, start, n]) => (n == null ? str(s).slice(toNum(start)) : str(s).substr(toNum(start), toNum(n))),
  replace: ([s, a, b], ctx) => (ctx.dialect === 'spl' ? str(s).replace(userRe(a, 'g'), str(b).replace(/\\(\d)/g, '$$$1')) : str(s).split(str(a)).join(str(b))),
  replace_string: ([s, a, b]) => str(s).split(str(a)).join(str(b)),
  replace_regex: ([s, a, b]) => str(s).replace(userRe(a, 'g'), str(b).replace(/\\(\d)/g, '$$$1')),
  split: ([s, d]) => (isNil(s) ? [] : str(s).split(str(d))),
  mvcount: ([v]) => (Array.isArray(v) ? v.length : isNil(v) ? null : 1),
  array_length: ([v]) => (Array.isArray(v) ? v.length : null),
  mvindex: ([v, i]) => (Array.isArray(v) ? v.at(toNum(i)) ?? null : toNum(i) === 0 ? v : null),
  mvjoin: ([v, d]) => (Array.isArray(v) ? v.join(str(d)) : str(v)),
  strcat_array: ([v, d]) => (Array.isArray(v) ? v.join(str(d)) : str(v)),
  countof: ([s, sub]) => (str(sub) ? str(s).split(str(sub)).length - 1 : 0),
  indexof: ([s, sub]) => str(s).indexOf(str(sub)),
  coalesce: (a) => a.find((v) => !isNil(v)) ?? null,
  isnull: ([v]) => isNil(v),
  isnotnull: ([v]) => !isNil(v),
  isempty: ([v]) => isNil(v),
  isnotempty: ([v]) => !isNil(v),
  null: () => null,
  true: () => true,
  false: () => false,
  typeof: ([v]) => (isNil(v) ? 'null' : Array.isArray(v) ? 'multivalue' : typeof v === 'number' ? 'Number' : typeof v === 'boolean' ? 'Boolean' : 'String'),
  gettype: ([v]) => (isNil(v) ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? 'long' : typeof v === 'boolean' ? 'bool' : 'string'),
  round: ([v, n]) => (num1(v) == null ? null : Number(num1(v).toFixed(n == null ? 0 : toNum(n)))),
  abs: ([v]) => (num1(v) == null ? null : Math.abs(num1(v))),
  ceil: ([v]) => (num1(v) == null ? null : Math.ceil(num1(v))),
  ceiling: ([v]) => (num1(v) == null ? null : Math.ceil(num1(v))),
  sqrt: ([v]) => (num1(v) == null ? null : Math.sqrt(num1(v))),
  exp: ([v]) => (num1(v) == null ? null : Math.exp(num1(v))),
  ln: ([v]) => (num1(v) == null ? null : Math.log(num1(v))),
  log: ([v, b], ctx) => (num1(v) == null ? null : ctx.dialect === 'spl' ? Math.log(num1(v)) / Math.log(b == null ? 10 : toNum(b)) : Math.log(num1(v))),
  log10: ([v]) => (num1(v) == null ? null : Math.log10(num1(v))),
  log2: ([v]) => (num1(v) == null ? null : Math.log2(num1(v))),
  pow: ([a, b]) => Math.pow(toNum(a), toNum(b)),
  max_of: (a) => a.filter((v) => !isNil(v)).reduce((m, v) => (m === null || compare(v, m) > 0 ? v : m), null),
  min_of: (a) => a.filter((v) => !isNil(v)).reduce((m, v) => (m === null || compare(v, m) < 0 ? v : m), null),
  floor: ([v, span]) => (num1(v) == null ? null : span == null ? Math.floor(num1(v)) : Math.floor(num1(v) / toNum(span)) * toNum(span)),
  bin: ([v, span]) => {
    if (num1(v) == null) return null;
    const s = toNum(span);
    if (!(s > 0)) throw new QueryError('bin() needs a positive size, e.g. bin(TimeGenerated, 1h).');
    return Math.floor(num1(v) / s) * s;
  },
  now: (a, ctx) => ctx.now,
  time: (a, ctx) => ctx.now,
  ago: ([s], ctx) => ctx.now - toNum(s),
  datetime: ([s]) => {
    const t = parseDateTime(s);
    if (t == null) throw new QueryError(`Can't read datetime(${s}).`, 'Use datetime(2026-09-24 03:00:00).');
    return t;
  },
  todatetime: ([s]) => (typeof s === 'number' ? s : parseDateTime(s)),
  timespan: ([s]) => parseSpan(s),
  totimespan: ([s]) => (typeof s === 'number' ? s : parseSpan(s)),
  datetime_diff: ([unit, a, b]) => {
    const u = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60, second: 1, millisecond: 0.001 }[str(unit).toLowerCase()];
    if (!u) throw new QueryError(`datetime_diff: unknown unit "${unit}".`, "Use 'second', 'minute', 'hour' or 'day'.");
    return Math.trunc((toNum(a) - toNum(b)) / u);
  },
  hourofday: ([t]) => (isNil(t) ? null : new Date(toNum(t) * 1000).getUTCHours()),
  startofday: ([t]) => (isNil(t) ? null : snap(toNum(t), 'd')),
  startofhour: ([t]) => (isNil(t) ? null : snap(toNum(t), 'h')),
  format_datetime: ([t, f]) => formatDatetime(t, f),
  strftime: ([t, f]) => strftime(t, f),
  strptime: ([s]) => parseDateTime(s),
  relative_time: ([t, m]) => parseTimeModifier(m, toNum(t)),
  cidrmatch: ([cidr, ip]) => cidrMatch(cidr, ip),
  ipv4_is_in_range: ([ip, cidr]) => cidrMatch(cidr, ip),
  ipv4_is_private: ([ip]) => isPrivateIp(ip),
  match: ([s, re]) => userRe(re).test(str(s)),
  like: ([s, p]) => likeRe(p).test(str(s)),
  extract: ([re, g, s], ctx) => {
    if (ctx.dialect === 'spl') throw new QueryError('extract() is KQL. In SPL use | rex field=... "(?<name>...)".');
    const m = userRe(re).exec(str(s));
    return m ? m[toNum(g)] ?? null : null;
  },
  base64_decode_tostring: ([s]) => b64decode(s),
  base64_decodestring: ([s]) => b64decode(s),
  urldecode: ([s]) => {
    try {
      return decodeURIComponent(str(s).replace(/\+/g, ' '));
    } catch {
      return str(s);
    }
  },
  url_decode: ([s]) => FUNCS.urldecode([s]),
  in: ([v, ...list]) => list.some((x) => looseEq(v, x)),
  // SPL count(eval(cond)): false becomes null so only true rows count
  eval: ([v]) => (v === false ? null : v),
};
// scalar min/max: SPL eval min(a,b); KQL uses min_of/max_of
FUNCS.min = (a, ctx) => FUNCS.min_of(a, ctx);
FUNCS.max = (a, ctx) => FUNCS.max_of(a, ctx);

const AGGS = new Set(['count', 'c', 'countif', 'dc', 'distinct_count', 'dcount', 'dcountif', 'sum', 'sumif', 'avg', 'avgif', 'mean', 'min', 'max', 'values', 'list', 'make_set', 'make_list', 'make_set_if', 'make_list_if', 'earliest', 'latest', 'first', 'last', 'take_any', 'any', 'stdev', 'stdevp', 'stdevif', 'variance', 'var', 'median', 'range', 'mode', 'percentile', 'perc', 'arg_max', 'arg_min', 'estdc']);
const isAggName = (n) => AGGS.has(n) || /^(perc|p|percentile|exactperc|upperperc)\d+$/.test(n);

// =================================================================== evaluation

function anyValue(row, pred) {
  for (const k of Object.keys(row)) if (pred(row[k])) return true;
  if (row[RAW] !== undefined && pred(row[RAW])) return true;
  return false;
}

export function evalNode(n, row, ctx) {
  switch (n.k) {
    case 'lit':
      return n.v;
    case 'field':
      return getField(row, n.name);
    case 'star':
      return '*';
    case 'neg': {
      const v = num1(evalNode(n.a, row, ctx));
      return v == null ? null : -v;
    }
    case 'not':
      return !truthy(evalNode(n.a, row, ctx));
    case 'index': {
      const v = evalNode(n.a, row, ctx);
      const i = toNum(evalNode(n.i, row, ctx));
      return Array.isArray(v) ? v.at(i) ?? null : null;
    }
    case 'in': {
      const list = n.list.map((x) => ({ v: evalNode(x, row, ctx), raw: x.raw }));
      const test = (a) => list.some((x) => looseEq(a, x.v, n.ci, x.raw));
      const hit = n.a.k === 'star' ? anyValue(row, test) : test(evalNode(n.a, row, ctx));
      return n.neg ? !hit : hit;
    }
    case 'between': {
      const v = num1(evalNode(n.a, row, ctx));
      const lo = num1(evalNode(n.lo, row, ctx));
      const hi = num1(evalNode(n.hi, row, ctx));
      if (v == null) return false;
      const hit = v >= lo && v <= hi;
      return n.neg ? !hit : hit;
    }
    case 'hasany': {
      const list = n.list.map((x) => evalNode(x, row, ctx));
      const test = (a) => (n.all ? list.every((t) => hasTerm(a, t)) : list.some((t) => hasTerm(a, t)));
      return n.a.k === 'star' ? anyValue(row, test) : test(evalNode(n.a, row, ctx));
    }
    case 'call':
      return callFn(n, row, ctx);
    case 'bin':
      return evalBin(n, row, ctx);
    default:
      throw new QueryError('Unsupported expression.');
  }
}

function callFn(n, row, ctx) {
  const name = n.name;
  if (name === 'if' || name === 'iff' || name === 'iif') {
    if (n.args.length !== 3) throw new QueryError(`${name}() needs 3 arguments: condition, then, else.`);
    return truthy(evalNode(n.args[0], row, ctx)) ? evalNode(n.args[1], row, ctx) : evalNode(n.args[2], row, ctx);
  }
  if (name === 'case') {
    const a = n.args;
    for (let i = 0; i + 1 < a.length; i += 2) if (truthy(evalNode(a[i], row, ctx))) return evalNode(a[i + 1], row, ctx);
    return a.length % 2 === 1 ? evalNode(a[a.length - 1], row, ctx) : null;
  }
  if (name === 'not') return !truthy(evalNode(n.args[0], row, ctx));
  if (name === 'prev' || name === 'next') {
    if (!ctx.rows) throw new QueryError(`${name}() only works inside extend/project/where.`);
    const off = n.args[1] ? toNum(evalNode(n.args[1], row, ctx)) : 1;
    const j = ctx.idx + (name === 'prev' ? -off : off);
    if (j < 0 || j >= ctx.rows.length) return n.args[2] ? evalNode(n.args[2], row, ctx) : null;
    return evalNode(n.args[0], ctx.rows[j], ctx);
  }
  if (name === 'row_number') return (ctx.idx ?? 0) + 1;
  if (isAggName(name) && !FUNCS[name]) throw new QueryError(`${name}() is an aggregation. Use it inside ${ctx.dialect === 'spl' ? 'stats' : 'summarize'}.`);
  const fn = FUNCS[name];
  if (!fn) {
    const hint = suggest(name, Object.keys(FUNCS));
    throw new QueryError(`Unknown function ${name}().`, hint ? `Did you mean ${hint}()?` : '');
  }
  return fn(n.args.map((a) => evalNode(a, row, ctx)), ctx);
}

function evalBin(n, row, ctx) {
  const { op } = n;
  if (op === 'and') return truthy(evalNode(n.a, row, ctx)) && truthy(evalNode(n.b, row, ctx));
  if (op === 'or') return truthy(evalNode(n.a, row, ctx)) || truthy(evalNode(n.b, row, ctx));
  const b = evalNode(n.b, row, ctx);
  const raw = n.b.raw;
  // `* has "x"` / `* contains "x"`: any column
  if (n.a.k === 'star') return anyValue(row, (v) => stringOp(op, v, b, raw));
  const a = evalNode(n.a, row, ctx);
  switch (op) {
    case '==':
      return looseEq(a, b, false, raw);
    case '!=':
      return !isNil(a) && !looseEq(a, b, false, raw);
    case '=~':
      return looseEq(a, b, true, raw);
    case '!~':
      return !isNil(a) && !looseEq(a, b, true, raw);
    case '<':
    case '>':
    case '<=':
    case '>=': {
      if (isNil(a) || isNil(b)) return false;
      const c = compare(a, b);
      return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
    case '+': {
      const na = toNum(a);
      const nb = toNum(b);
      if (isNil(a) || isNil(b)) return null;
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na + nb;
      return str(a) + str(b);
    }
    case '-':
    case '*':
    case '/':
    case '%': {
      const na = num1(a);
      const nb = num1(b);
      if (na == null || nb == null) return null;
      if (op === '-') return na - nb;
      if (op === '*') return na * nb;
      if (op === '/') return nb === 0 ? null : na / nb;
      return nb === 0 ? null : na % nb;
    }
    default:
      return stringOp(op, a, b, raw);
  }
}

function stringOp(op, a, b, raw) {
  if (Array.isArray(a)) return a.some((x) => stringOp(op, x, b, raw));
  const neg = op.startsWith('!');
  const base = neg ? op.slice(1) : op;
  const cs = base.endsWith('_cs');
  const kind = cs ? base.slice(0, -3) : base;
  let hit;
  if (isNil(a)) hit = false;
  else {
    const A = cs ? str(a) : str(a).toLowerCase();
    const B = cs ? str(b) : str(b).toLowerCase();
    if (kind === 'contains') hit = A.includes(B);
    else if (kind === 'has') hit = hasTerm(a, b, cs);
    else if (kind === 'startswith') hit = A.startsWith(B);
    else if (kind === 'endswith') hit = A.endsWith(B);
    else if (kind === 'like') hit = likeRe(b).test(str(a));
    else if (kind === 'matches') hit = userRe(b).test(str(a));
    else if (kind === '==') hit = looseEq(a, b, false, raw);
    else if (kind === '=~') hit = looseEq(a, b, true, raw);
    else throw new QueryError(`Unknown operator ${op}.`);
  }
  return neg ? !isNil(a) && !hit : hit;
}

// =================================================================== aggregation

function stdev(nums, pop = false) {
  if (nums.length < (pop ? 1 : 2)) return nums.length ? 0 : null;
  const m = nums.reduce((s, x) => s + x, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - (pop ? 0 : 1));
  return Math.sqrt(v);
}
function percentile(nums, p) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}
const timeOf = (r) => {
  const t = getField(r, '_time');
  return typeof t === 'number' ? t : null;
};

/** Evaluates an aggregation expression tree over a group of rows. */
function evalAgg(n, rows, ctx) {
  if (n.k === 'call' && isAggName(n.name)) return aggregate(n, rows, ctx);
  if (n.k === 'field' && ctx.dialect === 'spl' && (n.name === 'count' || n.name === 'c')) return rows.length;
  if (n.k === 'lit') return n.v;
  if (n.k === 'call') {
    const args = n.args.map((a) => evalAgg(a, rows, ctx));
    return callFn({ k: 'call', name: n.name, args: args.map((v) => ({ k: 'lit', v })) }, rows[0] || {}, ctx);
  }
  if (n.k === 'bin') {
    const a = evalAgg(n.a, rows, ctx);
    const b = evalAgg(n.b, rows, ctx);
    return evalBin({ k: 'bin', op: n.op, a: { k: 'lit', v: a }, b: { k: 'lit', v: b } }, {}, ctx);
  }
  if (n.k === 'neg') {
    const v = num1(evalAgg(n.a, rows, ctx));
    return v == null ? null : -v;
  }
  if (n.k === 'field') return rows.length ? getField(rows[0], n.name) : null;
  throw new QueryError('That expression needs an aggregation such as count() or sum().');
}

function aggregate(n, rows, ctx) {
  let name = n.name;
  const args = n.args;
  let pct = null;
  const pm = /^(?:perc|p|percentile|exactperc|upperperc)(\d+)$/.exec(name);
  if (pm) {
    pct = Number(pm[1]);
    name = 'percentile';
  }
  const vals = (i = 0) => {
    const out = [];
    for (const r of rows) {
      const v = evalNode(args[i], r, ctx);
      if (Array.isArray(v)) out.push(...v.filter((x) => !isNil(x)));
      else if (!isNil(v)) out.push(v);
    }
    return out;
  };
  const needArg = () => {
    if (!args.length || args[0].k === 'star') throw new QueryError(`${n.name}() needs a field, e.g. ${n.name}(bytes).`);
  };
  const ifRows = (i) => rows.filter((r) => truthy(evalNode(args[i], r, ctx)));
  const nums = (list) => list.map(toNum).filter((x) => !Number.isNaN(x));
  switch (name) {
    case 'count':
    case 'c':
      if (!args.length || args[0].k === 'star') return rows.length;
      return vals().length;
    case 'countif':
      if (!args.length) throw new QueryError('countif() needs a condition, e.g. countif(EventID == 4625).');
      return ifRows(0).length;
    case 'dc':
    case 'distinct_count':
    case 'dcount':
    case 'estdc':
      needArg();
      return new Set(vals().map(str)).size;
    case 'dcountif': {
      const sub = ifRows(1);
      return new Set(sub.map((r) => evalNode(args[0], r, ctx)).filter((v) => !isNil(v)).map(str)).size;
    }
    case 'sum': {
      needArg();
      return nums(vals()).reduce((s, x) => s + x, 0);
    }
    case 'sumif':
      return ifRows(1).reduce((s, r) => s + (num1(evalNode(args[0], r, ctx)) || 0), 0);
    case 'avg':
    case 'mean': {
      needArg();
      const v = nums(vals());
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    }
    case 'avgif': {
      const v = ifRows(1).map((r) => num1(evalNode(args[0], r, ctx))).filter((x) => x != null);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    }
    case 'min':
    case 'max': {
      needArg();
      const v = vals();
      if (!v.length) return null;
      return v.reduce((m, x) => ((name === 'min' ? compare(x, m) < 0 : compare(x, m) > 0) ? x : m));
    }
    case 'values':
    case 'make_set': {
      needArg();
      const seen = new Map();
      for (const v of vals()) if (!seen.has(str(v))) seen.set(str(v), v);
      const out = [...seen.values()];
      return name === 'values' ? out.sort(compare) : out;
    }
    case 'make_set_if': {
      const seen = new Map();
      for (const r of ifRows(1)) {
        const v = evalNode(args[0], r, ctx);
        if (!isNil(v) && !seen.has(str(v))) seen.set(str(v), v);
      }
      return [...seen.values()];
    }
    case 'list':
    case 'make_list':
      needArg();
      return vals().slice(0, 100);
    case 'make_list_if':
      return ifRows(1).map((r) => evalNode(args[0], r, ctx)).filter((v) => !isNil(v));
    case 'first':
    case 'last':
    case 'take_any':
    case 'any': {
      needArg();
      const v = vals();
      return v.length ? (name === 'last' ? v[v.length - 1] : v[0]) : null;
    }
    case 'earliest':
    case 'latest': {
      needArg();
      let best = null;
      let bt = null;
      for (const r of rows) {
        const v = evalNode(args[0], r, ctx);
        const t = timeOf(r);
        if (isNil(v) || t == null) continue;
        if (bt == null || (name === 'earliest' ? t < bt : t >= bt)) {
          bt = t;
          best = v;
        }
      }
      return best;
    }
    case 'stdev':
    case 'stdevp':
      needArg();
      return stdev(nums(vals()), name === 'stdevp');
    case 'stdevif':
      return stdev(ifRows(1).map((r) => num1(evalNode(args[0], r, ctx))).filter((x) => x != null));
    case 'variance':
    case 'var': {
      const s = stdev(nums(vals()));
      return s == null ? null : s * s;
    }
    case 'median':
      needArg();
      return percentile(nums(vals()), 50);
    case 'range': {
      needArg();
      const v = nums(vals());
      return v.length ? Math.max(...v) - Math.min(...v) : null;
    }
    case 'mode': {
      needArg();
      const counts = new Map();
      for (const v of vals()) counts.set(str(v), (counts.get(str(v)) || 0) + 1);
      let best = null;
      let bc = 0;
      for (const [k, c] of counts) if (c > bc) [best, bc] = [k, c];
      return best;
    }
    case 'percentile':
    case 'perc': {
      needArg();
      const p = pct ?? num1(args[1] ? evalNode(args[1], {}, ctx) : null);
      if (p == null) throw new QueryError('percentile() needs a percentage, e.g. percentile(bytes, 95).');
      return percentile(nums(vals()), p);
    }
    default:
      throw new QueryError(`${n.name}() is not supported here.`);
  }
}

/** Default output name for an aggregation (Splunk: `dc(user)`; Kusto: `dcount_user`). */
function aggName(n, dialect, src) {
  if (dialect === 'spl') {
    if (n.k === 'field') return n.name;
    return src.replace(/\s+/g, '');
  }
  if (n.k === 'call') {
    const arg = n.args[0];
    const argName = arg && arg.k === 'field' ? arg.name.replace(/\W/g, '_') : '';
    if (n.name === 'count' && !argName) return 'count_';
    if (n.name === 'countif') return 'countif_';
    if (n.name === 'percentile') return `percentile_${argName}_${n.args[1]?.v ?? ''}`;
    return argName ? `${n.name}_${argName}` : `${n.name}_`;
  }
  return null;
}

export function exprText(n) {
  switch (n.k) {
    case 'field':
      return n.name;
    case 'lit':
      return n.raw ?? (typeof n.v === 'string' ? `"${n.v}"` : String(n.v));
    case 'star':
      return '*';
    case 'call':
      return `${n.name}(${n.args.map(exprText).join(',')})`;
    case 'bin':
      return `${exprText(n.a)}${n.op}${exprText(n.b)}`;
    case 'neg':
      return `-${exprText(n.a)}`;
    default:
      return 'expr';
  }
}

// =================================================================== SPL search expressions

// AST: { k: 'term', v } | { k: 'cmp', field, op, v, quoted } | { k: 'sin', field, list }
//      | { k: 'and'|'or', a, b } | { k: 'not', a } | { k: 'true' }

function lexSearch(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      toks.push({ t: ch });
      i++;
      continue;
    }
    if (ch === '"') {
      const [v, j] = readString(src, i);
      toks.push({ t: 'phrase', v });
      i = j;
      continue;
    }
    // a word, which may be field<op>value with a quoted value
    let j = i;
    let word = '';
    while (j < src.length && !/[\s()]/.test(src[j])) {
      if (src[j] === '"') {
        const [v, k] = readString(src, j);
        word += `\u0001${v}\u0001`;
        j = k;
        continue;
      }
      if (src[j] === ',' && !/[=<>]/.test(word)) break;
      word += src[j++];
    }
    // "field = value" written with spaces
    const m0 = /^(\s*)(!=|<=|>=|=|<|>)(\s*)/.exec(src.slice(j));
    if (/^[A-Za-z_][\w.:-]*$/.test(word) && m0) {
      j += m0[0].length;
      word += m0[2];
      if (src[j] === '"') {
        const [v, k] = readString(src, j);
        word += `\u0001${v}\u0001`;
        j = k;
      } else {
        while (j < src.length && !/[\s()]/.test(src[j])) word += src[j++];
      }
    }
    toks.push({ t: 'word', v: word });
    i = j;
  }
  return toks;
}

const CMP_RE = /^([A-Za-z_][\w.:\-{}]*?)(!=|<=|>=|=|<|>)(.*)$/s;

export function parseSearch(src, warnings = []) {
  const toks = lexSearch(src);
  let i = 0;
  const peek = () => toks[i];
  const isKw = (kw) => peek()?.t === 'word' && peek().v === kw;
  const primary = () => {
    const t = toks[i++];
    if (!t) throw new QueryError('The search ends too early.');
    if (t.t === '(') {
      const e = andExpr();
      if (peek()?.t !== ')') throw new QueryError('A "(" is not closed in the search.');
      i++;
      return e;
    }
    if (t.t === ')') throw new QueryError('Unexpected ")" in the search.');
    if (t.t === ',') return { k: 'true' };
    if (t.t === 'phrase') return { k: 'term', v: t.v, phrase: true };
    const w = t.v;
    if (['and', 'or', 'not'].includes(w)) warnings.push(`Lowercase "${w}" is searched as a word. Boolean operators in SPL are UPPERCASE: ${w.toUpperCase()}.`);
    if (/^[A-Za-z_][\w.:-]*$/.test(w) && isKw('IN') && toks[i + 1]?.t === '(') {
      i += 2;
      const list = [];
      while (peek() && peek().t !== ')') {
        const x = toks[i++];
        if (x.t === ',') continue;
        list.push(String(x.v).replace(/\u0001/g, ''));
      }
      if (!peek()) throw new QueryError('The IN ( ... ) list is not closed.');
      i++;
      return { k: 'sin', field: w, list };
    }
    const m = CMP_RE.exec(w);
    if (m) {
      const quoted = m[3].includes('\u0001');
      const v = m[3].replace(/\u0001/g, '');
      if (m[2] === '=' && v === '' && !quoted) throw new QueryError(`Nothing after "${m[1]}=".`, `Give a value, e.g. ${m[1]}=admin or ${m[1]}=*`);
      return { k: 'cmp', field: m[1], op: m[2], v, quoted };
    }
    return { k: 'term', v: w.replace(/\u0001/g, '') };
  };
  const notExpr = () => {
    if (isKw('NOT')) {
      i++;
      return { k: 'not', a: notExpr() };
    }
    return primary();
  };
  const orExpr = () => {
    let a = notExpr();
    while (isKw('OR')) {
      i++;
      a = { k: 'or', a, b: notExpr() };
    }
    return a;
  };
  const andExpr = () => {
    let a = null;
    while (peek() && peek().t !== ')') {
      if (isKw('AND')) {
        i++;
        continue;
      }
      if (isKw('OR')) throw new QueryError('OR needs something on both sides.');
      const b = orExpr();
      a = a ? { k: 'and', a, b } : b;
    }
    return a || { k: 'true' };
  };
  const ast = andExpr();
  if (i < toks.length) throw new QueryError('Unexpected ")" in the search.');
  return ast;
}

/** Pulls earliest/latest/index out of a search AST (top-level AND only for time; index anywhere). */
function searchMeta(ast) {
  const meta = { earliest: null, latest: null, indexes: [] };
  const walk = (n, top) => {
    if (!n) return;
    if (n.k === 'cmp') {
      const f = n.field.toLowerCase();
      if (f === 'earliest' || f === 'latest') {
        if (!top) throw new QueryError(`${n.field} must not be inside OR / NOT.`);
        meta[f] = n.v;
        n.k = 'true';
      } else if (f === 'index' && n.op === '=') meta.indexes.push(n.v);
    } else if (n.k === 'sin' && n.field.toLowerCase() === 'index') meta.indexes.push(...n.list);
    else if (n.k === 'and') {
      walk(n.a, top);
      walk(n.b, top);
    } else if (n.k === 'or') {
      walk(n.a, false);
      walk(n.b, false);
    } else if (n.k === 'not') walk(n.a, false);
  };
  walk(ast, true);
  return meta;
}

function termMatches(row, term) {
  const re = term.includes('*') ? wildcardRe(`*${term}*`) : null;
  const t = term.toLowerCase();
  const test = (v) => {
    if (isNil(v)) return false;
    const s = str(v);
    return re ? re.test(s) : s.toLowerCase().includes(t);
  };
  if (row[RAW] !== undefined || hasOwn(row, '_raw')) return test(getField(row, '_raw'));
  return anyValue(row, test);
}

function cmpMatches(row, n) {
  const f = n.field.toLowerCase() === 'index' ? 'index' : n.field;
  const v = getField(row, f);
  const vals = Array.isArray(v) ? v : [v];
  const test = (x) => {
    if (isNil(x)) return false;
    if (n.op === '=' || n.op === '!=') {
      let hit;
      if (n.v.includes('*')) hit = wildcardRe(n.v).test(str(x));
      else if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(n.v)) hit = cidrMatch(n.v, x);
      else hit = looseEq(x, n.v, true);
      return n.op === '=' ? hit : !hit;
    }
    const c = compare(x, n.v);
    return n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
  };
  if (n.op === '!=') return vals.some((x) => !isNil(x)) && vals.every(test);
  return vals.some(test);
}

export function searchMatch(row, n) {
  switch (n.k) {
    case 'true':
      return true;
    case 'term':
      return termMatches(row, n.v);
    case 'cmp':
      return cmpMatches(row, n);
    case 'sin':
      return n.list.some((v) => cmpMatches(row, { field: n.field, op: '=', v }));
    case 'and':
      return searchMatch(row, n.a) && searchMatch(row, n.b);
    case 'or':
      return searchMatch(row, n.a) || searchMatch(row, n.b);
    case 'not':
      return !searchMatch(row, n.a);
    default:
      return true;
  }
}

// =================================================================== command helpers

function exprStream(text, dialect) {
  return new Stream(tokenize(text, dialect));
}

/** Pulls known `key=value` options out of SPL command args. Returns [opts, rest]. */
function splOpts(text, keys) {
  const opts = {};
  const rest = text.replace(/(?:^|\s)([A-Za-z_]+)\s*=\s*("[^"]*"|[^\s,]+)/g, (m, k, v) => {
    if (!keys.includes(k.toLowerCase())) return m;
    opts[k.toLowerCase()] = v.replace(/^"|"$/g, '');
    return ' ';
  });
  return [opts, rest.trim()];
}

/** Field list: "a, b c" (wildcards allowed). */
function fieldList(text) {
  return text
    .split(/[\s,]+/)
    .map((f) => f.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** Expands wildcard field patterns against known columns. */
function expandFields(patterns, cols) {
  const out = [];
  for (const p of patterns) {
    if (p.includes('*')) {
      const re = wildcardRe(p);
      for (const c of cols) if (re.test(c) && !out.includes(c)) out.push(c);
    } else if (!out.includes(p)) out.push(p);
  }
  return out;
}

function colFor(cols, name) {
  return cols.find((c) => c === name) || cols.find((c) => c.toLowerCase() === name.toLowerCase()) || name;
}

function projectRow(r, fields) {
  const o = copyMeta(r, {});
  for (const f of fields) o[f] = getField(r, f);
  return o;
}

/** Parses `[name =] agg [as alias], ...` up to `by`. */
function parseAggSpecs(s, dialect) {
  const specs = [];
  while (!s.done() && !s.isWord('by')) {
    let name = null;
    if (s.peek().t === 'id' && s.isOp('=', 1)) {
      name = s.next().v;
      s.next();
    }
    const expr = parseExprNoCmp(s, dialect);
    if (s.eatWord('as')) name = s.ident('a name after "as"');
    specs.push({ expr, name });
    s.eatOp(',');
  }
  if (!specs.length) {
    const kw = dialect === 'spl' ? 'stats count by user' : 'summarize count() by Account';
    throw new QueryError('No aggregation given.', `For example: ${kw}`);
  }
  specs.forEach((sp, i) => {
    const e = sp.expr;
    const isAgg = (n) => (n.k === 'call' && isAggName(n.name)) || (dialect === 'spl' && n.k === 'field' && (n.name === 'count' || n.name === 'c')) || (n.k === 'call' && n.args.some(isAgg)) || (n.k === 'bin' && (isAgg(n.a) || isAgg(n.b)));
    if (!isAgg(e)) {
      if (dialect === 'kql' && e.k === 'field' && e.name.toLowerCase() === 'count') throw new QueryError('In KQL, count needs brackets: count().', 'summarize count() by Account');
      throw new QueryError(`"${exprText(e)}" is not an aggregation.`, dialect === 'spl' ? 'Use count, dc(field), sum(field), avg(field), values(field) ...' : 'Use count(), dcount(field), sum(field), avg(field), make_set(field) ...');
    }
    sp.name = sp.name || aggName(e, dialect, exprText(e)) || `Column${i + 1}`;
  });
  return specs;
}

// aggregation specs must not swallow `by` (parseExpr stops at unknown words anyway)
function parseExprNoCmp(s, dialect) {
  return parseExpr(s, dialect);
}

function parseByKeys(s, dialect) {
  const keys = [];
  if (!s.eatWord('by')) return keys;
  while (!s.done()) {
    let name = null;
    if (s.peek().t === 'id' && s.isOp('=', 1)) {
      name = s.next().v;
      s.next();
    }
    const expr = parseExpr(s, dialect);
    if (!name) {
      if (expr.k === 'field') name = expr.name;
      else if (expr.k === 'call' && ['bin', 'floor', 'bin_at', 'startofday', 'startofhour'].includes(expr.name) && expr.args[0]?.k === 'field') name = expr.args[0].name;
      else name = `Column${keys.length + 1}`;
    }
    keys.push({ expr, name });
    s.eatOp(',');
    if (s.isWord('span') || s.isWord('limit')) break;
  }
  if (!keys.length) throw new QueryError('Nothing after "by".', 'Name the field(s) to group by.');
  return keys;
}

function groupRows(rows, keys, ctx, dropNull) {
  const groups = new Map();
  for (const r of rows) {
    const kv = keys.map((k) => evalNode(k.expr, r, ctx));
    if (dropNull && kv.some(isNil)) continue;
    const id = JSON.stringify(kv.map((v) => (isNil(v) ? null : str(v))));
    let g = groups.get(id);
    if (!g) {
      g = { kv, rows: [] };
      groups.set(id, g);
    }
    g.rows.push(r);
  }
  return [...groups.values()];
}

function statsCore(state, text, ctx) {
  const s = exprStream(text, ctx.dialect);
  const specs = parseAggSpecs(s, ctx.dialect);
  const keys = parseByKeys(s, ctx.dialect);
  if (!s.done()) throw new QueryError(`Unexpected "${s.peek().v}" after the by-list.`);
  checkFields(state, keys.map((k) => k.expr).concat(specs.map((sp) => sp.expr)), ctx);
  return { specs, keys };
}

/** Warns about field names that don't exist (the most common beginner slip). */
function checkFields(state, exprs, ctx) {
  const names = new Set();
  const walk = (n) => {
    if (!n) return;
    if (n.k === 'field') names.add(n.name);
    for (const k of ['a', 'b', 'lo', 'hi', 'i']) if (n[k]) walk(n[k]);
    for (const x of n.args || []) walk(x);
    for (const x of n.list || []) walk(x);
  };
  exprs.forEach(walk);
  if (!state.rows.length) return;
  for (const name of names) {
    if (ctx.dialect === 'spl' && (name === 'count' || name === 'c')) continue;
    if (!fieldExists(state.rows, state.cols, name)) {
      const hint = suggest(name, state.cols);
      ctx.warnings.push(`Unknown field "${name}"${hint ? ` (did you mean ${hint}?)` : ''}.${ctx.dialect === 'spl' ? ' In where/eval, text values need "double quotes".' : ''}`);
    }
  }
}

function sortRows(rows, specs, ctx) {
  const keyed = rows.map((r, i) => ({ r, i, k: specs.map((sp) => evalNode(sp.expr, r, ctx)) }));
  keyed.sort((x, y) => {
    for (let j = 0; j < specs.length; j++) {
      const a = x.k[j];
      const b = y.k[j];
      if (isNil(a) || isNil(b)) {
        if (isNil(a) && isNil(b)) continue;
        return isNil(a) ? 1 : -1;
      }
      const c = compare(a, b);
      if (c) return specs[j].desc ? -c : c;
    }
    return x.i - y.i;
  });
  return keyed.map((x) => x.r);
}

export function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(word, options) {
  let best = null;
  let bd = Infinity;
  for (const o of options) {
    const dd = levenshtein(word, o);
    if (dd < bd) [best, bd] = [o, dd];
  }
  return bd <= Math.max(1, Math.floor(word.length / 3)) && best.toLowerCase() !== word.toLowerCase() ? best : bd === 0 ? null : bd <= 2 ? best : null;
}

// =================================================================== SPL commands

function statsOutput(groups, specs, keys, ctx) {
  return groups.map((g) => {
    const o = {};
    keys.forEach((k, i) => (o[k.name] = g.kv[i]));
    for (const sp of specs) o[sp.name] = evalAgg(sp.expr, g.rows, ctx);
    return o;
  });
}

function runStats(state, text, ctx) {
  const { specs, keys } = statsCore(state, text, ctx);
  const groups = keys.length ? groupRows(state.rows, keys, ctx, ctx.dialect === 'spl') : [{ kv: [], rows: state.rows }];
  let rows = statsOutput(groups, specs, keys, ctx);
  if (ctx.dialect === 'spl' && keys.length) rows = sortRows(rows, keys.map((k) => ({ expr: { k: 'field', name: k.name } })), ctx);
  return { rows, cols: [...keys.map((k) => k.name), ...specs.map((s) => s.name)], agg: true };
}

function runEventstats(state, text, ctx) {
  const { specs, keys } = statsCore(state, text, ctx);
  const groups = keys.length ? groupRows(state.rows, keys, ctx, true) : [{ kv: [], rows: state.rows }];
  const out = new Map();
  for (const g of groups) {
    const vals = {};
    for (const sp of specs) vals[sp.name] = evalAgg(sp.expr, g.rows, ctx);
    for (const r of g.rows) out.set(r, vals);
  }
  const rows = state.rows.map((r) => copyMeta(r, { ...r, ...(out.get(r) || {}) }));
  return { ...state, rows, cols: [...state.cols, ...specs.map((s) => s.name).filter((n) => !state.cols.includes(n))] };
}

function runStreamstats(state, text, ctx) {
  const [opts, rest] = splOpts(text, ['current', 'window', 'global', 'reset_on_change']);
  const current = !/^(f|false|0)$/i.test(opts.current || 't');
  const win = Number(opts.window || 0);
  const { specs, keys } = statsCore(state, rest, ctx);
  const hist = new Map();
  const rows = state.rows.map((r) => {
    const kv = keys.map((k) => evalNode(k.expr, r, ctx));
    const id = JSON.stringify(kv.map((v) => (isNil(v) ? null : str(v))));
    const h = hist.get(id) || [];
    hist.set(id, h);
    let set = current ? [...h, r] : h;
    if (win > 0) set = set.slice(-win);
    const o = copyMeta(r, { ...r });
    for (const sp of specs) o[sp.name] = set.length ? evalAgg(sp.expr, set, ctx) : isCount(sp.expr) ? 0 : null;
    h.push(r);
    return o;
  });
  return { ...state, rows, cols: [...state.cols, ...specs.map((s) => s.name).filter((n) => !state.cols.includes(n))] };
}
const isCount = (e) => (e.k === 'field' && e.name === 'count') || (e.k === 'call' && (e.name === 'count' || e.name === 'c'));

function parseAssignments(text, ctx, allowBare = false) {
  const s = exprStream(text, ctx.dialect);
  const out = [];
  while (!s.done()) {
    let name = null;
    if (s.peek().t === 'id' && s.isOp('=', 1)) {
      name = s.next().v;
      s.next();
    } else if (!allowBare) throw new QueryError(`Expected name = expression in ${ctx.dialect === 'spl' ? 'eval' : 'extend'}.`, ctx.dialect === 'spl' ? 'eval hour=strftime(_time, "%H")' : 'extend Hour = hourofday(TimeGenerated)');
    const expr = parseExpr(s, ctx.dialect);
    out.push({ name: name || (expr.k === 'field' ? expr.name : `Column${out.length + 1}`), expr });
    if (!s.done()) s.expectOp(',', 'between assignments');
  }
  if (!out.length) throw new QueryError('Nothing to calculate.');
  return out;
}

function runEval(state, text, ctx, allowBare = false) {
  const assigns = parseAssignments(text, ctx, allowBare);
  checkFields(state, assigns.map((a) => a.expr), ctx);
  const cols = [...state.cols];
  let rows = state.rows;
  for (const a of assigns) {
    const cur = rows;
    rows = cur.map((r, idx) => {
      const o = copyMeta(r, { ...r });
      o[a.name] = evalNode(a.expr, r, { ...ctx, rows: cur, idx });
      return o;
    });
    if (!cols.includes(a.name)) cols.push(a.name);
  }
  return { ...state, rows, cols };
}

function runWhere(state, text, ctx) {
  if (!text.trim()) throw new QueryError('where needs a condition.', ctx.dialect === 'spl' ? 'where count > 10' : 'where EventID == 4625');
  const s = exprStream(text, ctx.dialect);
  if (ctx.dialect === 'kql') {
    const eq = s.toks.findIndex((t) => t.t === 'op' && t.v === '=');
    if (eq !== -1) ctx.warnings.push('KQL compares with == (a single = is for naming columns).');
  }
  const expr = parseExpr(s, ctx.dialect);
  if (!s.done()) throw new QueryError(`Unexpected "${s.peek().raw ?? s.peek().v}" in the condition.`, ctx.dialect === 'spl' ? 'Join conditions with AND / OR.' : 'Join conditions with and / or.');
  checkFields(state, [expr], ctx);
  const rows = state.rows.filter((r, idx) => truthy(evalNode(expr, r, { ...ctx, rows: state.rows, idx })));
  return { ...state, rows };
}

function parseSortSpecs(text, ctx, splStyle) {
  const specs = [];
  for (let part of text.split(',')) {
    part = part.trim();
    if (!part) continue;
    if (splStyle) {
      for (let w of part.split(/\s+/)) {
        let desc = false;
        if (w === '-' || w === '+') continue;
        if (w.startsWith('-')) {
          desc = true;
          w = w.slice(1);
        } else if (w.startsWith('+')) w = w.slice(1);
        if (/^(desc|d)$/i.test(w) && specs.length) {
          specs[specs.length - 1].desc = true;
          continue;
        }
        const fm = /^(?:num|str|ip|auto)\((.+)\)$/.exec(w);
        specs.push({ expr: { k: 'field', name: fm ? fm[1] : w }, desc });
      }
      // "- count" (space after the minus)
      const m = /^([-+])\s+(\S+)/.exec(part);
      if (m) specs.find((sp) => sp.expr.name === m[2]).desc = m[1] === '-';
    } else {
      const m = /\s+(asc|desc)(\s+nulls\s+(first|last))?$/i.exec(part);
      const exprText0 = m ? part.slice(0, m.index) : part;
      const s = exprStream(exprText0, ctx.dialect);
      const expr = parseExpr(s, ctx.dialect);
      specs.push({ expr, desc: m ? m[1].toLowerCase() === 'desc' : true });
    }
  }
  if (!specs.length) throw new QueryError('Sort by which field?');
  return specs;
}

function runSplSort(state, text, ctx) {
  let limit = 10000;
  let t = text.trim();
  const lm = /^(?:limit\s*=\s*)?(\d+)\s+/.exec(t);
  if (lm) {
    limit = Number(lm[1]) || Infinity;
    t = t.slice(lm[0].length);
  }
  const specs = parseSortSpecs(t, ctx, true);
  checkFields(state, specs.map((s) => s.expr), ctx);
  return { ...state, rows: sortRows(state.rows, specs, ctx).slice(0, limit), serialized: true };
}

function nArg(text, def, cmd) {
  const t = text.trim().replace(/^limit\s*=\s*/, '');
  if (!t) return def;
  if (!/^\d+$/.test(t)) throw new QueryError(`${cmd} takes a number, e.g. ${cmd} 10.`);
  return Number(t);
}

function runTable(state, text) {
  const fields = expandFields(fieldList(text), state.cols);
  if (!fields.length) throw new QueryError('Which fields? e.g. table _time, user, src');
  return { ...state, rows: state.rows.map((r) => projectRow(r, fields)), cols: fields };
}

function runFields(state, text) {
  let t = text.trim();
  let remove = false;
  if (t.startsWith('-')) {
    remove = true;
    t = t.slice(1);
  } else if (t.startsWith('+')) t = t.slice(1);
  const fields = expandFields(fieldList(t), state.cols);
  if (remove) {
    const drop = new Set(fields.map((f) => colFor(state.cols, f)));
    const cols = state.cols.filter((c) => !drop.has(c));
    return { ...state, rows: state.rows.map((r) => projectRow(r, cols)), cols };
  }
  return runTable(state, fields.join(' '));
}

function runDedup(state, text, ctx) {
  const [opts, rest0] = splOpts(text, ['keepempty', 'consecutive']);
  let rest = rest0;
  let n = 1;
  const nm = /^(\d+)\s+/.exec(rest);
  if (nm) {
    n = Number(nm[1]);
    rest = rest.slice(nm[0].length);
  }
  let sortby = null;
  const sm = /\s+sortby\s+(.+)$/i.exec(rest);
  if (sm) {
    sortby = parseSortSpecs(sm[1], ctx, true);
    rest = rest.slice(0, sm.index);
  }
  const fields = fieldList(rest);
  if (!fields.length) throw new QueryError('dedup needs field names, e.g. dedup user.');
  const keep = /^(t|true)$/i.test(opts.keepempty || '');
  const seen = new Map();
  let rows = state.rows.filter((r) => {
    const kv = fields.map((f) => getField(r, f));
    if (kv.some(isNil)) return keep;
    const id = JSON.stringify(kv.map(str));
    const c = seen.get(id) || 0;
    seen.set(id, c + 1);
    return c < n;
  });
  if (sortby) rows = sortRows(rows, sortby, ctx);
  return { ...state, rows };
}

function runRename(state, text) {
  const pairs = [];
  const re = /("[^"]+"|[^\s,]+)\s+as\s+("[^"]+"|[^\s,]+)/gi;
  let m;
  while ((m = re.exec(text))) pairs.push([m[1].replace(/"/g, ''), m[2].replace(/"/g, '')]);
  if (!pairs.length) throw new QueryError('Use: rename old AS new');
  let cols = [...state.cols];
  const rows = state.rows.map((r) => {
    const o = copyMeta(r, { ...r });
    for (const [a, b] of pairs) {
      o[b] = getField(r, a);
      const real = colFor(Object.keys(o), a);
      if (real !== b) delete o[real];
    }
    return o;
  });
  for (const [a, b] of pairs) {
    const real = colFor(cols, a);
    cols = cols.includes(real) ? cols.map((c) => (c === real ? b : c)) : [...cols, b];
  }
  return { ...state, rows, cols };
}

function runTop(state, text, ctx, rare) {
  const [opts, rest] = splOpts(text, ['limit', 'countfield', 'percentfield', 'showperc', 'showcount']);
  const limit = opts.limit != null ? Number(opts.limit) || Infinity : 10;
  const [fpart, bpart] = rest.split(/\s+by\s+/i);
  const fields = fieldList(fpart);
  const by = bpart ? fieldList(bpart) : [];
  if (!fields.length) throw new QueryError(`${rare ? 'rare' : 'top'} needs a field, e.g. ${rare ? 'rare' : 'top'} limit=5 user`);
  const cf = opts.countfield || 'count';
  const pf = opts.percentfield || 'percent';
  const keyExpr = (f) => ({ expr: { k: 'field', name: f }, name: f });
  const outer = by.length ? groupRows(state.rows, by.map(keyExpr), ctx, true) : [{ kv: [], rows: state.rows }];
  const rows = [];
  for (const g of outer) {
    const inner = groupRows(g.rows, fields.map(keyExpr), ctx, true);
    const total = inner.reduce((s, x) => s + x.rows.length, 0);
    inner.sort((a, b) => (rare ? a.rows.length - b.rows.length : b.rows.length - a.rows.length) || compare(str(a.kv[0]), str(b.kv[0])));
    for (const x of inner.slice(0, limit)) {
      const o = {};
      by.forEach((f, i) => (o[f] = g.kv[i]));
      fields.forEach((f, i) => (o[f] = x.kv[i]));
      o[cf] = x.rows.length;
      o[pf] = Number(((100 * x.rows.length) / total).toFixed(4));
      rows.push(o);
    }
  }
  return { rows, cols: [...by, ...fields, cf, pf], agg: true };
}

function runBin(state, text, ctx) {
  const [opts, rest] = splOpts(text, ['span', 'bins', 'minspan', 'aligntime']);
  const m = /^(\S+)(?:\s+as\s+(\S+))?$/i.exec(rest.trim());
  if (!m) throw new QueryError('Use: bin _time span=1h');
  const field = m[1];
  const out = m[2] || field;
  if (!opts.span) throw new QueryError('bin needs span=, e.g. bin _time span=1h');
  let span = parseSpan(opts.span);
  if (span == null && /^\d+(\.\d+)?$/.test(opts.span)) span = Number(opts.span);
  if (!span) throw new QueryError(`Can't read span=${opts.span}.`, 'Use span=5m, span=1h or span=1d.');
  const rows = state.rows.map((r) => {
    const v = num1(getField(r, field));
    const o = copyMeta(r, { ...r });
    o[out === field ? colFor(Object.keys(r), field) : out] = v == null ? null : Math.floor(v / span) * span;
    return o;
  });
  return { ...state, rows, cols: state.cols.includes(out) ? state.cols : [...state.cols, out] };
}

function runTimechart(state, text, ctx) {
  const [opts, rest] = splOpts(text, ['span', 'limit', 'useother', 'usenull', 'bins', 'fixedrange']);
  const span = parseSpan(opts.span || '1h');
  if (!span) throw new QueryError(`Can't read span=${opts.span}.`);
  const limit = opts.limit != null ? Number(opts.limit) || Infinity : 10;
  const s = exprStream(rest, 'spl');
  const specs = parseAggSpecs(s, 'spl');
  let by = null;
  if (s.eatWord('by')) by = s.ident('a field after by');
  checkFields(state, specs.map((x) => x.expr).concat(by ? [{ k: 'field', name: by }] : []), ctx);
  const times = state.rows.map(timeOf).filter((t) => t != null);
  if (!times.length) return { rows: [], cols: ['_time'], agg: true };
  const lo = Math.floor(Math.min(...times) / span) * span;
  const hi = Math.floor(Math.max(...times) / span) * span;
  const buckets = new Map();
  for (let t = lo; t <= hi; t += span) buckets.set(t, []);
  for (const r of state.rows) {
    const t = timeOf(r);
    if (t != null) buckets.get(Math.floor(t / span) * span).push(r);
  }
  if (!by) {
    const rows = [...buckets].map(([t, rs]) => {
      const o = { _time: t };
      for (const sp of specs) o[sp.name] = rs.length ? evalAgg(sp.expr, rs, ctx) : isCount(sp.expr) ? 0 : null;
      return o;
    });
    return { rows, cols: ['_time', ...specs.map((x) => x.name)], agg: true };
  }
  const totals = new Map();
  for (const r of state.rows) {
    const v = getField(r, by);
    if (!isNil(v)) totals.set(str(v), (totals.get(str(v)) || 0) + 1);
  }
  const series = [...totals].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const shown = series.slice(0, limit);
  const other = series.length > shown.length && !/^(f|false)$/i.test(opts.useother || '');
  const sp = specs[0];
  const rows = [...buckets].map(([t, rs]) => {
    const o = { _time: t };
    for (const k of shown) {
      const sub = rs.filter((r) => str(getField(r, by)) === k);
      o[k] = sub.length ? evalAgg(sp.expr, sub, ctx) : isCount(sp.expr) ? 0 : null;
    }
    if (other) {
      const sub = rs.filter((r) => {
        const v = getField(r, by);
        return !isNil(v) && !shown.includes(str(v));
      });
      o.OTHER = sub.length ? evalAgg(sp.expr, sub, ctx) : 0;
    }
    return o;
  });
  return { rows, cols: ['_time', ...shown, ...(other ? ['OTHER'] : [])], agg: true };
}

function runRex(state, text, ctx) {
  const [opts, rest] = splOpts(text, ['field', 'max_match', 'mode', 'offset_field']);
  const m = /^"((?:[^"\\]|\\.)*)"$/.exec(rest.trim());
  if (!m) throw new QueryError('rex needs a quoted regex with named groups.', 'rex field=_raw "user=(?<user>\\S+)"');
  if (opts.mode === 'sed') throw new QueryError('rex mode=sed is not supported in this sandbox.');
  const pattern = m[1].replace(/\\"/g, '"');
  const re = userRe(pattern);
  const names = [...pattern.matchAll(/\(\?P?<([A-Za-z_]\w*)>/g)].map((x) => x[1]);
  if (!names.length) throw new QueryError('rex needs at least one named group like (?<name>...).', 'rex "COMMAND=(?<cmd>.+)"');
  const field = opts.field || '_raw';
  const maxMatch = Number(opts.max_match ?? 1);
  const rows = state.rows.map((r) => {
    const src = str(getField(r, field));
    const o = copyMeta(r, { ...r });
    if (maxMatch === 1) {
      const mm = re.exec(src);
      if (mm) for (const n of names) if (mm.groups[n] !== undefined) o[n] = mm.groups[n];
    } else {
      const g = new RegExp(re.source, `${re.flags}g`);
      const all = [...src.matchAll(g)].slice(0, maxMatch || Infinity);
      for (const n of names) {
        const vals = all.map((x) => x.groups[n]).filter((v) => v !== undefined);
        if (vals.length) o[n] = vals.length === 1 ? vals[0] : vals;
      }
    }
    return o;
  });
  return { ...state, rows, cols: [...state.cols, ...names.filter((n) => !state.cols.includes(n))] };
}

function runRegex(state, text) {
  const m = /^(?:([\w.]+)\s*(!?=)\s*)?"((?:[^"\\]|\\.)*)"$/.exec(text.trim());
  if (!m) throw new QueryError('Use: regex field="pattern"');
  const field = m[1] || '_raw';
  const neg = m[2] === '!=';
  const re = userRe(m[3].replace(/\\"/g, '"'));
  return { ...state, rows: state.rows.filter((r) => re.test(str(getField(r, field))) !== neg) };
}

function runFillnull(state, text) {
  const [opts, rest] = splOpts(text, ['value']);
  const v = opts.value ?? 0;
  const fields = rest ? fieldList(rest) : state.cols;
  const rows = state.rows.map((r) => {
    const o = copyMeta(r, { ...r });
    for (const f of fields) if (isNil(getField(o, f))) o[colFor(state.cols, f)] = v;
    return o;
  });
  return { ...state, rows };
}

function runDelta(state, text) {
  const m = /^(\S+)(?:\s+as\s+(\S+))?(?:\s+p=(\d+))?$/i.exec(text.trim());
  if (!m) throw new QueryError('Use: delta _time as gap');
  const out = m[2] || `delta(${m[1]})`;
  const p = Number(m[3] || 1);
  const rows = state.rows.map((r, i) => {
    const o = copyMeta(r, { ...r });
    const a = num1(getField(r, m[1]));
    const b = i - p >= 0 ? num1(getField(state.rows[i - p], m[1])) : null;
    o[out] = a == null || b == null ? null : a - b;
    return o;
  });
  return { ...state, rows, cols: [...state.cols, out] };
}

function runSplSearchCmd(state, text, ctx) {
  const ast = parseSearch(text, ctx.warnings);
  const meta = searchMeta(ast);
  let rows = state.rows.filter((r) => searchMatch(r, ast));
  if (meta.earliest != null) rows = rows.filter((r) => timeOf(r) >= parseTimeModifier(meta.earliest, ctx.now));
  if (meta.latest != null) rows = rows.filter((r) => timeOf(r) < parseTimeModifier(meta.latest, ctx.now));
  return { ...state, rows };
}

export const SPL_COMMANDS = {
  search: runSplSearchCmd,
  where: runWhere,
  eval: runEval,
  stats: runStats,
  eventstats: runEventstats,
  streamstats: runStreamstats,
  sort: runSplSort,
  head: (st, t) => ({ ...st, rows: st.rows.slice(0, nArg(t, 10, 'head')) }),
  tail: (st, t) => ({ ...st, rows: st.rows.slice(-nArg(t, 10, 'tail') || st.rows.length).reverse() }),
  reverse: (st) => ({ ...st, rows: [...st.rows].reverse() }),
  table: runTable,
  fields: runFields,
  dedup: runDedup,
  rename: runRename,
  top: (st, t, ctx) => runTop(st, t, ctx, false),
  rare: (st, t, ctx) => runTop(st, t, ctx, true),
  bin: runBin,
  bucket: runBin,
  timechart: runTimechart,
  rex: runRex,
  regex: runRegex,
  fillnull: runFillnull,
  delta: runDelta,
};

// =================================================================== KQL operators

function runSummarize(state, text, ctx) {
  const s = exprStream(text, 'kql');
  // arg_max / arg_min: `summarize arg_max(TimeGenerated, *) by Computer`
  if ((s.isWord('arg_max') || s.isWord('arg_min')) && s.isOp('(', 1)) {
    const which = s.next().v.toLowerCase();
    s.next();
    const key = parseExpr(s, 'kql');
    const extra = [];
    while (s.eatOp(',')) extra.push(s.isOp('*') ? (s.next(), '*') : s.ident());
    s.expectOp(')', `to close ${which}(`);
    const keys = parseByKeys(s, 'kql');
    const groups = keys.length ? groupRows(state.rows, keys, ctx, false) : [{ kv: [], rows: state.rows }];
    const all = extra.includes('*');
    const keep = all ? state.cols : extra;
    const keyName = key.k === 'field' ? key.name : 'max';
    const rows = groups.map((g) => {
      let best = null;
      let bv = null;
      for (const r of g.rows) {
        const v = evalNode(key, r, ctx);
        if (isNil(v)) continue;
        if (best == null || (which === 'arg_max' ? compare(v, bv) > 0 : compare(v, bv) < 0)) [best, bv] = [r, v];
      }
      const o = {};
      keys.forEach((k, i) => (o[k.name] = g.kv[i]));
      o[keyName] = bv;
      for (const c of keep) if (!(c in o)) o[c] = best ? getField(best, c) : null;
      return o;
    });
    const cols = [...keys.map((k) => k.name), keyName, ...keep.filter((c) => c !== keyName && !keys.some((k) => k.name === c))];
    return { rows, cols, agg: true };
  }
  return runStats(state, text, ctx);
}

function runProject(state, text, ctx) {
  const assigns = parseAssignments(text, ctx, true);
  checkFields(state, assigns.map((a) => a.expr), ctx);
  const rows = state.rows.map((r, idx) => {
    const o = copyMeta(r, {});
    for (const a of assigns) o[a.expr.k === 'field' && a.name === a.expr.name ? colFor(state.cols, a.name) : a.name] = evalNode(a.expr, r, { ...ctx, rows: state.rows, idx });
    return o;
  });
  const cols = assigns.map((a) => (a.expr.k === 'field' && a.name === a.expr.name ? colFor(state.cols, a.name) : a.name));
  return { ...state, rows, cols };
}

function runProjectAway(state, text) {
  const drop = new Set(expandFields(fieldList(text), state.cols).map((f) => colFor(state.cols, f)));
  const cols = state.cols.filter((c) => !drop.has(c));
  return { ...state, rows: state.rows.map((r) => projectRow(r, cols)), cols };
}

function runProjectRename(state, text) {
  const pairs = text.split(',').map((p) => {
    const m = /^\s*([\w.]+)\s*=\s*([\w.]+)\s*$/.exec(p);
    if (!m) throw new QueryError('Use: project-rename NewName = OldName');
    return [m[1], m[2]];
  });
  return runRename(state, pairs.map(([n, o]) => `${o} as ${n}`).join(', '));
}

function runProjectReorder(state, text) {
  const first = expandFields(fieldList(text), state.cols).map((f) => colFor(state.cols, f));
  return { ...state, cols: [...first, ...state.cols.filter((c) => !first.includes(c))] };
}

function runOrder(state, text, ctx) {
  const m = /^by\s+/i.exec(text.trim());
  if (!m) throw new QueryError('Write "order by Field desc".');
  const specs = parseSortSpecs(text.trim().slice(m[0].length), ctx, false);
  checkFields(state, specs.map((s) => s.expr), ctx);
  return { ...state, rows: sortRows(state.rows, specs, ctx), serialized: true };
}

function runTopK(state, text, ctx) {
  const m = /^(\d+)\s+by\s+(.+)$/i.exec(text.trim());
  if (!m) throw new QueryError('Write "top 5 by count_ desc".');
  const specs = parseSortSpecs(m[2], ctx, false);
  return { ...state, rows: sortRows(state.rows, specs, ctx).slice(0, Number(m[1])), serialized: true };
}

function runDistinct(state, text, ctx) {
  const fields = text.trim() === '*' ? state.cols : fieldList(text).map((f) => colFor(state.cols, f));
  if (!fields.length) throw new QueryError('distinct needs column names, e.g. distinct Account.');
  checkFields(state, fields.map((f) => ({ k: 'field', name: f })), ctx);
  const seen = new Set();
  const rows = [];
  for (const r of state.rows) {
    const o = projectRow(r, fields);
    const id = JSON.stringify(fields.map((f) => str(o[f])));
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(o);
  }
  return { rows, cols: fields, agg: true };
}

function runKqlSearch(state, text) {
  const m = /^(?:(\w+)\s*:\s*)?"((?:[^"\\]|\\.)*)"$/.exec(text.trim());
  if (!m) throw new QueryError('Use: search "term"');
  const term = m[2].toLowerCase();
  const rows = state.rows.filter((r) => (m[1] ? str(getField(r, m[1])).toLowerCase().includes(term) : anyValue(r, (v) => str(v).toLowerCase().includes(term))));
  return { ...state, rows };
}

function runParse(state, text, ctx) {
  const m = /^(?:kind\s*=\s*\w+\s+)?([\w.]+)\s+with\s+(.+)$/is.exec(text.trim());
  if (!m) throw new QueryError('Use: parse Field with * "literal" NewColumn');
  const s = exprStream(m[2], 'kql');
  const parts = [];
  while (!s.done()) {
    const t = s.next();
    if (t.t === 'op' && t.v === '*') parts.push({ star: true });
    else if (t.t === 'str') parts.push({ lit: t.v });
    else if (t.t === 'id') {
      let name = t.v;
      if (s.isOp(':') || name.includes(':')) name = name.split(':')[0];
      parts.push({ col: name });
    } else if (t.t === 'op' && t.v === ':') s.next();
    else throw new QueryError(`Unexpected "${t.v}" in the parse pattern.`);
  }
  let re = '^';
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    if (p.star) re += last ? '.*' : '.*?';
    else if (p.lit != null) re += escRe(p.lit);
    else re += last ? '(.*)' : '(.*?)';
  });
  const rx = new RegExp(re, 's');
  const cols = parts.filter((p) => p.col).map((p) => p.col);
  const rows = state.rows.map((r) => {
    const o = copyMeta(r, { ...r });
    const mm = rx.exec(str(getField(r, m[1])));
    cols.forEach((c, i) => (o[c] = mm ? mm[i + 1] : null));
    return o;
  });
  return { ...state, rows, cols: [...state.cols, ...cols.filter((c) => !state.cols.includes(c))] };
}

function runGetschema(state) {
  const rows = state.cols.map((c, i) => {
    const sample = state.rows.find((r) => !isNil(getField(r, c)));
    const v = sample ? getField(sample, c) : null;
    const type = typeof v === 'number' ? (looksLikeTime(v) ? 'datetime' : 'long') : Array.isArray(v) ? 'dynamic' : 'string';
    return { ColumnName: c, ColumnOrdinal: i, DataType: type };
  });
  return { rows, cols: ['ColumnName', 'ColumnOrdinal', 'DataType'], agg: true };
}

export const KQL_COMMANDS = {
  where: runWhere,
  filter: runWhere,
  project: runProject,
  'project-away': runProjectAway,
  'project-rename': runProjectRename,
  'project-reorder': runProjectReorder,
  extend: (st, t, ctx) => runEval(st, t, ctx, true),
  summarize: runSummarize,
  order: runOrder,
  sort: runOrder,
  take: (st, t) => ({ ...st, rows: st.rows.slice(0, nArg(t, NaN, 'take')) }),
  limit: (st, t) => ({ ...st, rows: st.rows.slice(0, nArg(t, NaN, 'limit')) }),
  top: runTopK,
  distinct: runDistinct,
  count: (st) => ({ rows: [{ Count: st.rows.length }], cols: ['Count'], agg: true }),
  serialize: (st) => ({ ...st, serialized: true }),
  search: runKqlSearch,
  parse: runParse,
  getschema: runGetschema,
  render: (st, t, ctx) => {
    ctx.notes.push('render draws a chart in Azure; the sandbox shows the table.');
    return st;
  },
};

export const COMMANDS = { spl: Object.keys(SPL_COMMANDS), kql: Object.keys(KQL_COMMANDS) };

// commands that belong to the other dialect -> friendly pointers
const CROSS = {
  spl: { summarize: 'stats', project: 'table', 'project-away': 'fields -', extend: 'eval', take: 'head', limit: 'head', order: 'sort', distinct: 'dedup (or stats count by)', count: 'stats count', parse: 'rex', filter: 'where / search', serialize: 'streamstats', getschema: 'fieldsummary' },
  kql: { stats: 'summarize', table: 'project', fields: 'project / project-away', eval: 'extend', head: 'take', tail: 'order by ... asc | take', dedup: 'distinct (or summarize arg_max)', rex: 'parse / extract()', timechart: 'summarize count() by bin(TimeGenerated, 1h) | render timechart', bin: 'bin() inside summarize', bucket: 'bin() inside summarize', rename: 'project-rename', eventstats: 'join with a summarize', streamstats: 'serialize | extend prev()', rare: 'summarize count() by X | order by count_ asc', fillnull: 'coalesce()', regex: 'where X matches regex "..."', reverse: 'order by TimeGenerated asc', delta: 'serialize | extend prev()' },
};

// =================================================================== entry point

const views = new WeakMap();
/**
 * A dataset seen through one dialect: fields renamed to that dialect's names (ds.names[dialect]),
 * and every other name (canonical, the other dialect's, ds.aliases) accepted as an alias.
 */
export function dialectView(ds, dialect) {
  let per = views.get(ds);
  if (!per) views.set(ds, (per = {}));
  if (per[dialect]) return per[dialect];
  const names = (ds.names && ds.names[dialect]) || {};
  const other = (ds.names && ds.names[dialect === 'spl' ? 'kql' : 'spl']) || {};
  const shown = (f) => names[f] || f;
  const aliases = {};
  for (const f of ds.fields || []) {
    if (shown(f) !== f) aliases[f] = shown(f);
    if (other[f] && other[f] !== shown(f)) aliases[other[f]] = shown(f);
  }
  for (const [alt, canon] of Object.entries(ds.aliases || {})) if (!(alt in aliases) && alt !== shown(canon)) aliases[alt] = shown(canon);
  const view = { ...ds, aliases, fields: (ds.fields || []).map(shown), rename: names };
  per[dialect] = view;
  return view;
}

function tableRows(ds0, dialect) {
  // Rows are light views of the dataset events (never mutate the dataset).
  const ds = dialectView(ds0, dialect);
  const timeCol = dialect === 'kql' ? 'TimeGenerated' : '_time';
  const ren = ds.rename;
  return ds0.events.map((e, i) => {
    const o = { [timeCol]: e._time };
    for (const k of Object.keys(e)) if (k !== '_time' && k !== '_raw' && k !== 'id') o[ren[k] || k] = e[k];
    o[DS] = ds;
    o[ID] = e.id ?? i;
    if (e._raw !== undefined) o[RAW] = e._raw;
    return o;
  });
}

function tableCols(list, dialect) {
  const cols = [dialect === 'kql' ? 'TimeGenerated' : '_time'];
  for (const ds of list) for (const f of dialectView(ds, dialect).fields) if (!cols.includes(f) && f !== '_time' && f !== '_raw') cols.push(f);
  return cols;
}

function findTable(tables, name, dialect) {
  const lk = name.toLowerCase();
  const exact = tables.find((t) => (dialect === 'kql' ? t.kql === name : t.spl === name));
  if (exact) return { t: exact, ci: false };
  const loose = tables.find((t) => [t.kql, t.spl, t.id].some((x) => x && x.toLowerCase() === lk));
  return loose ? { t: loose, ci: true } : null;
}

function commandName(seg) {
  const m = /^([A-Za-z][\w-]*)/.exec(seg);
  return m ? m[1] : '';
}

function unknownCommand(cmd, dialect) {
  const other = CROSS[dialect][cmd.toLowerCase()];
  if (other) {
    const lang = dialect === 'spl' ? 'KQL' : 'SPL';
    const mine = dialect === 'spl' ? 'SPL' : 'KQL';
    return new QueryError(`"${cmd}" is ${lang}, not ${mine}.`, `In ${mine} use: ${other}`);
  }
  const hint = suggest(cmd, COMMANDS[dialect]);
  return new QueryError(`Unknown command "${cmd}".`, hint ? `Did you mean "${hint}"?` : `${dialect === 'spl' ? 'SPL' : 'KQL'} commands here: ${COMMANDS[dialect].join(', ')}`);
}

/**
 * Runs a query.
 * @param {string} text
 * @param {{dialect:'spl'|'kql', tables:object[], defaultTable?:string, maxRows?:number}} opts
 */
export function runQuery(text, { dialect = 'spl', tables = [], defaultTable = null } = {}) {
  const src = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
    .trim();
  if (!src) throw new QueryError('Type a query first.', dialect === 'spl' ? 'e.g. index=wineventlog EventCode=4625' : 'e.g. SecurityEvent | where EventID == 4625');
  if (!tables.length) throw new QueryError('No data loaded.');
  const warnings = [];
  const notes = [];
  const segs = splitPipes(src);
  const now = Math.max(...tables.map((t) => t.now || 0)) || Math.floor(Date.now() / 1000);
  const ctx = { dialect, now, warnings, notes };
  let state;
  let used = [];
  let first = segs[0];

  if (dialect === 'spl') {
    if (first === '' && segs.length > 1) throw new QueryError('The query starts with a pipe.', 'Start with a search, e.g. index=proxy');
    const firstCmd = commandName(first).toLowerCase();
    if (firstCmd === 'search') first = first.slice(6).trim();
    const lone = /^[A-Za-z]\w*$/.test(first) && tables.some((t) => t.kql && t.kql.toLowerCase() === first.toLowerCase());
    if (lone && segs.length > 1 && KQL_COMMANDS[commandName(segs[1]).toLowerCase()] && !SPL_COMMANDS[commandName(segs[1]).toLowerCase()]) throw new QueryError('That looks like KQL.', 'Switch the dialect to KQL, or start with index=... in SPL.');
    if (['where', 'stats', 'table', 'eval'].includes(firstCmd)) throw new QueryError(`A query can't start with "${firstCmd}".`, `Search first, e.g. index=${tables[0].spl} | ${firstCmd} ...`);
    const ast = parseSearch(first, warnings);
    const meta = searchMeta(ast);
    if (meta.indexes.some((x) => x === '*')) used = [...tables];
    else if (meta.indexes.length) {
      for (const ix of meta.indexes) {
        const re = wildcardRe(ix);
        const hit = tables.filter((t) => re.test(t.spl) || (t.aliasesIndex || []).some((a) => re.test(a)));
        if (!hit.length) {
          const hint = suggest(ix, tables.map((t) => t.spl));
          warnings.push(`No index "${ix}" here.${hint ? ` Did you mean index=${hint}?` : ` Indexes: ${tables.map((t) => t.spl).join(', ')}`}`);
        }
        for (const t of hit) if (!used.includes(t)) used.push(t);
      }
    } else {
      const def = tables.find((t) => t.id === defaultTable || t.spl === defaultTable) || tables[0];
      used = [def];
      if (tables.length > 1) notes.push(`No index given: searching index=${def.spl}.`);
    }
    let rows = used.flatMap((t) => tableRows(t, 'spl'));
    if (meta.earliest != null) {
      const e = parseTimeModifier(meta.earliest, now);
      rows = rows.filter((r) => r._time >= e);
    }
    if (meta.latest != null) {
      const l = parseTimeModifier(meta.latest, now);
      rows = rows.filter((r) => r._time < l);
    }
    // index=... is matched against the virtual field; everything else against fields / _raw
    rows = rows.filter((r) => searchMatch(r, ast));
    rows.sort((a, b) => b._time - a._time);
    state = { rows, cols: tableCols(used, 'spl'), events: true };
  } else {
    const fm = /^(union\s+)?(.+)$/is.exec(first);
    if (/^index\s*=|^search\s|=/.test(first) && !fm[1]) throw new QueryError('That looks like SPL.', `Switch the dialect to SPL, or start with a table name, e.g. ${tables[0].kql} | where ...`);
    const names = fm[1] ? fm[2].split(',').map((x) => x.trim()) : [fm[2].trim()];
    for (const n of names) {
      if (!/^[A-Za-z_][\w]*$/.test(n)) throw new QueryError(`A KQL query starts with a table name, not "${n}".`, `Tables: ${tables.map((t) => t.kql).join(', ')}`);
      const f = findTable(tables, n, 'kql');
      if (!f) {
        const hint = suggest(n, tables.map((t) => t.kql));
        throw new QueryError(`Unknown table "${n}".`, hint ? `Did you mean ${hint}?` : `Tables: ${tables.map((t) => t.kql).join(', ')}`);
      }
      if (f.ci) warnings.push(`KQL table names are case-sensitive: write ${f.t.kql}.`);
      used.push(f.t);
    }
    const rows = used.flatMap((t) => tableRows(t, 'kql'));
    rows.sort((a, b) => a.TimeGenerated - b.TimeGenerated);
    state = { rows, cols: tableCols(used, 'kql'), events: true };
  }

  const cmds = dialect === 'spl' ? SPL_COMMANDS : KQL_COMMANDS;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) throw new QueryError('Empty pipe: there is nothing between two |.');
    const name = commandName(seg);
    if (!name) throw new QueryError(`Can't read "| ${seg}".`);
    let lname = name.toLowerCase();
    let rest = seg.slice(name.length).trim();
    if (dialect === 'kql' && (lname === 'order' || lname === 'sort') && !/^by\b/i.test(rest)) throw new QueryError(`Write "${lname} by Field desc".`);
    if (dialect === 'kql' && name !== lname && cmds[lname]) warnings.push(`KQL operators are lowercase: ${lname}.`);
    const fn = cmds[lname];
    if (!fn) throw unknownCommand(name, dialect);
    try {
      const next = fn(state, rest, ctx);
      state = { ...next, events: next.agg ? false : state.events && !next.agg };
      if (next.agg) state.events = false;
    } catch (e) {
      if (e instanceof QueryError) {
        e.message = `| ${lname}: ${e.message}`;
        e.stage = i;
      }
      throw e;
    }
  }
  const events = state.rows.filter((r) => r[ID] !== undefined).length;
  return { columns: state.cols, rows: state.rows, total: state.rows.length, warnings: [...new Set(warnings)], notes, tables: used.map((t) => t.id), events: state.events !== false && events === state.rows.length };
}

/** Display text for a cell. */
export function cellText(v) {
  if (isNil(v)) return '';
  if (Array.isArray(v)) return v.map(cellText).join(', ');
  if (typeof v === 'number') {
    if (looksLikeTime(v)) return formatTime(v);
    if (!Number.isInteger(v)) return String(Number(v.toFixed(Math.abs(v) < 10 ? 3 : 2)));
    return String(v);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export { looseEq, compare, toNum, str as valueText };

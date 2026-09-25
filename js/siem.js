// SIEM investigation mode: pure logic (no DOM), unit-tested in tests/siem.test.js.
// Filtering/searching the case log table, tracking the investigation, and scoring it.

export const WEIGHTS = { verdict: 45, evidence: 35, efficiency: 10, writeup: 10 };
export const PASS_SCORE = 60;
export const NOISE_PENALTY = 4; // per pinned row that is neither key nor related
export const MAX_NOISE_PENALTY = 15;
export const MIN_WRITEUP = 20; // characters

/**
 * Verdict partial credit (fraction of WEIGHTS.verdict): [expected][given].
 * Calling a real attack benign is the worst mistake; escalating a benign alert costs less.
 */
export const VERDICT_CREDIT = {
  tp: { tp: 1, btp: 0, fp: 0 },
  btp: { btp: 1, fp: 0.35, tp: 0.2 },
  fp: { fp: 1, btp: 0.35, tp: 0.1 },
};

// ------------------------------------------------------------------ time helpers

export const toSec = (t) => {
  const [h, m, s = 0] = String(t).split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

/** Time windows offered in the filter bar, relative to the alert time. */
export function timeWindows(c) {
  const a = toSec(c.alert.time);
  return [
    { id: 'all', label: 'All time', from: -Infinity, to: Infinity },
    { id: 'before', label: 'Before alert', from: -Infinity, to: a },
    { id: 'pm5', label: 'Alert ±5 min', from: a - 300, to: a + 300 },
    { id: 'pm15', label: 'Alert ±15 min', from: a - 900, to: a + 900 },
    { id: 'after', label: 'After alert', from: a, to: Infinity },
  ];
}

// ------------------------------------------------------------------ filtering

export function emptyQuery() {
  return { sources: [], host: '', user: '', type: '', text: '', window: 'all' };
}

/** Normalised string form of a query, used to count distinct searches. */
export function queryKey(q) {
  return JSON.stringify([
    [...(q.sources || [])].sort(),
    q.host || '',
    q.user || '',
    q.type || '',
    (q.text || '').trim().toLowerCase(),
    q.window || 'all',
  ]);
}

export function isEmptyQuery(q) {
  return queryKey(q) === queryKey(emptyQuery());
}

const rowText = (r) => [r.t, r.src, r.host, r.user, r.type, r.msg].join(' ').toLowerCase();

/**
 * Filters a case's log rows. Text search: every whitespace-separated term must appear
 * (case-insensitive) somewhere in the row; "quoted phrases" stay together.
 */
export function filterLogs(c, q) {
  const win = timeWindows(c).find((w) => w.id === (q.window || 'all')) || timeWindows(c)[0];
  const terms = [...String(q.text || '').toLowerCase().matchAll(/"([^"]+)"|(\S+)/g)].map((m) => m[1] || m[2]);
  const sources = new Set(q.sources || []);
  return c.logs
    .filter((r) => {
      if (sources.size && !sources.has(r.src)) return false;
      if (q.host && r.host !== q.host) return false;
      if (q.user && r.user !== q.user) return false;
      if (q.type && r.type !== q.type) return false;
      const s = toSec(r.t);
      if (s < win.from || s > win.to) return false;
      if (terms.length) {
        const text = rowText(r);
        if (!terms.every((t) => text.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => toSec(a.t) - toSec(b.t) || (a.id < b.id ? -1 : 1));
}

/** Distinct values of a field (for the host/user/type dropdowns). */
export function facet(c, field) {
  return [...new Set(c.logs.map((r) => r[field]).filter(Boolean))].sort();
}

/** Values in a row you can pivot on: host, user, IPs and domain names in the message. */
export function pivots(r) {
  const out = [];
  const add = (kind, value) => value && !out.some((p) => p.value === value) && out.push({ kind, value });
  add('host', r.host);
  add('user', r.user);
  for (const m of r.msg.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.]*\.in-addr)(?![.\d])/g)) add('ip', m[1]);
  for (const m of r.msg.matchAll(/\b((?:[a-z0-9-]+\.)+(?:example|test|invalid|com|net|org))\b/gi)) {
    if (!/in-addr\.arpa$/i.test(m[1])) add('domain', m[1].toLowerCase());
  }
  return out;
}

// ------------------------------------------------------------------ investigation state

export function newInvestigation(c, now = Date.now()) {
  return { caseId: c.id, startedAt: now, queries: 0, lastKey: queryKey(emptyQuery()), query: emptyQuery(), pins: [], views: 0 };
}

/** Applies a new query. Counts it as a search only when it differs from the previous one. */
export function applyQuery(inv, q) {
  const key = queryKey(q);
  inv.query = { ...emptyQuery(), ...q, sources: [...(q.sources || [])] };
  if (key !== inv.lastKey) {
    inv.lastKey = key;
    if (!isEmptyQuery(q)) inv.queries += 1;
    return true;
  }
  return false;
}

export function togglePin(inv, rowId) {
  const i = inv.pins.indexOf(rowId);
  if (i >= 0) inv.pins.splice(i, 1);
  else inv.pins.push(rowId);
  return i < 0;
}

// ------------------------------------------------------------------ scoring

/**
 * Scores a submitted investigation.
 * sub: { verdict, pins: [row ids], writeup, queries }
 * Returns { total, passed, grade, verdict, evidence, efficiency, writeup }.
 */
export function scoreCase(c, sub) {
  const pins = new Set(sub.pins || []);
  // verdict
  const credit = VERDICT_CREDIT[c.verdict]?.[sub.verdict] ?? 0;
  const verdict = { correct: sub.verdict === c.verdict, given: sub.verdict || null, expected: c.verdict, points: Math.round(credit * WEIGHTS.verdict), max: WEIGHTS.verdict };

  // evidence
  const keyRows = new Set(c.key.flatMap((k) => k.rows));
  const related = new Set(c.related || []);
  const found = c.key.filter((k) => k.rows.some((r) => pins.has(r)));
  const missed = c.key.filter((k) => !k.rows.some((r) => pins.has(r)));
  const noise = [...pins].filter((r) => !keyRows.has(r) && !related.has(r));
  const penalty = Math.min(MAX_NOISE_PENALTY, noise.length * NOISE_PENALTY);
  const evPoints = Math.max(0, Math.round((found.length / c.key.length) * WEIGHTS.evidence) - penalty);
  const evidence = { found: found.map((k) => k.id), missed: missed.map((k) => k.id), noise, penalty, points: evPoints, max: WEIGHTS.evidence, perfect: missed.length === 0 && noise.length === 0 };

  // efficiency: full marks up to par, then one point per extra search
  const q = Math.max(0, sub.queries || 0);
  const par = c.parQueries || 4;
  const effPoints = Math.max(0, WEIGHTS.efficiency - Math.max(0, q - par));
  // No evidence found at all means there was no real investigation to be efficient about.
  const efficiency = { queries: q, par, points: found.length ? effPoints : 0, max: WEIGHTS.efficiency };

  // write-up
  const text = String(sub.writeup || '').toLowerCase();
  const long = text.trim().length >= MIN_WRITEUP;
  const hits = long ? c.writeup.filter((w) => w.any.some((k) => text.includes(k.toLowerCase()))) : [];
  const writeup = {
    tooShort: !long,
    hits: hits.map((w) => w.label),
    misses: c.writeup.filter((w) => !hits.includes(w)).map((w) => w.label),
    points: Math.round((hits.length / c.writeup.length) * WEIGHTS.writeup),
    max: WEIGHTS.writeup,
  };

  const total = verdict.points + evidence.points + efficiency.points + writeup.points;
  const passed = verdict.correct && total >= PASS_SCORE;
  const grade = total >= 90 ? 'Outstanding' : total >= 75 ? 'Strong' : total >= PASS_SCORE ? 'Adequate' : 'Needs work';
  return { total, passed, grade, verdict, evidence, efficiency, writeup };
}

// ------------------------------------------------------------------ progress in state

export function ensureSiem(st) {
  st.siem ??= {};
  st.siem.cases ??= {};
  if (st.siem.active === undefined) st.siem.active = null;
  return st.siem;
}

/**
 * Records a scored attempt. Returns { prevBest, best, firstSolve, improved }.
 */
export function recordCase(st, c, result, now) {
  ensureSiem(st);
  const rec = (st.siem.cases[c.id] ??= { attempts: 0, best: 0, solved: false, lastScore: null, completedAt: null });
  const prevBest = rec.best;
  const wasSolved = rec.solved;
  rec.attempts += 1;
  rec.lastScore = result.total;
  rec.best = Math.max(rec.best, result.total);
  if (result.passed) {
    rec.solved = true;
    rec.completedAt ??= now;
  }
  return { prevBest, best: rec.best, firstSolve: result.passed && !wasSolved, improved: rec.best > prevBest };
}

/** A case unlocks when all its required skills are learned (see engine.learnedSkills). */
export function caseUnlocked(c, learned) {
  const set = new Set(learned);
  return (c.requires?.skills || []).every((s) => set.has(s));
}

// Hands-on labs: result-set grading for query challenges, lab state and XP rules.
// Pure JavaScript (no DOM), unit-tested in tests/lab.test.js.
//
// State: st.lab = {
//   v: 1,
//   prefs:   { dialect: 'spl' | 'kql' },
//   sandbox: { dataset, text: { spl, kql } },                  (last free query, per dialect)
//   query:   { [id]: { solved, xpPaid, hints, dialects: { spl, kql }, attempts, at, query } },
//   packets: { [id]: { solved, best, xpPaid, attempts, at } },
//   rules:   { [id]: { solved, best, perfect, xpPaid, attempts, at, text } },
// }
import { cellText, looksLikeTime, formatTime } from './query.js';

export const LAB_XP = {
  query: { 1: 25, 2: 35, 3: 50 }, // query challenge, by difficulty (−15% per hint used, floor 55%)
  packet: { 1: 30, 2: 40, 3: 55 }, // packet case at 100% score
  rule: { 1: 40, 2: 50, 3: 60 }, // detection rule with every sample right
  hintPenalty: 0.15,
  hintFloor: 0.55,
  dialectBonus: 5, // once per challenge: solve it in the second dialect too
};

export function ensureLab(st) {
  const lab = (st.lab ??= {});
  lab.v ??= 1;
  lab.prefs ??= {};
  lab.prefs.dialect ??= 'spl';
  lab.sandbox ??= {};
  lab.sandbox.dataset ??= 'winsec';
  lab.sandbox.text ??= {};
  lab.query ??= {};
  lab.packets ??= {};
  lab.rules ??= {};
  return lab;
}

// ------------------------------------------------------------------ result-set grading

/** Normalises a value for comparison: case-insensitive, whitespace-collapsed, numbers canonical. */
export function norm(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v).trim().replace(/\s+/g, ' ').toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(s)) return norm(Number(s));
  return s;
}
const flat = (v) => (Array.isArray(v) ? v : [v]);
const valuesOf = (rows, col) => rows.flatMap((r) => flat(r[col])).filter((v) => v !== null && v !== undefined && v !== '');
const show = (v) => (typeof v === 'number' && looksLikeTime(v) ? formatTime(v) : cellText(v));

/**
 * Grades a query result against a challenge answer.
 * @returns {{ ok: boolean, message: string, column?: string, found?: number, expected?: number, extra?: number }}
 */
export function gradeResult(result, answer) {
  const rows = result?.rows || [];
  const cols = result?.columns || [];
  if (!rows.length) return { ok: false, message: 'No rows came back. Loosen the filter and try again.' };
  const exp = (answer.values || []).map(norm);
  if (answer.mode === 'top') {
    const n = answer.n || 1;
    const accept = new Set([...exp, ...(answer.alts || []).map(norm)]);
    const head = rows.slice(0, n);
    for (const c of cols) {
      const got = new Set(valuesOf(head, c).map(norm));
      if (n === 1 ? [...got].some((v) => accept.has(v)) : exp.every((v) => got.has(v))) return { ok: true, message: 'Correct: the answer is in the first row.', column: c };
    }
    for (let i = n; i < rows.length; i++) {
      for (const c of cols) if (valuesOf([rows[i]], c).some((v) => accept.has(norm(v)))) return { ok: false, message: `The answer is in your results (row ${i + 1}), but not on top. Sort so it comes first.`, hint: 'sort' };
    }
    return { ok: false, message: rows.length === 1 ? 'Not this one. Check your filter and what you counted.' : "The answer isn't in your results yet. Check your filter and what you grouped by." };
  }
  if (answer.mode === 'set') {
    const E = new Set(exp);
    let best = { found: 0, extra: Infinity, column: null };
    for (const c of cols) {
      const V = new Set(valuesOf(rows, c).map(norm));
      const found = [...E].filter((v) => V.has(v)).length;
      const extra = [...V].filter((v) => !E.has(v)).length;
      if (found === E.size && extra === 0) return { ok: true, message: `Correct: exactly the ${E.size === 1 ? 'value' : `${E.size} values`} we were looking for.`, column: c, found, expected: E.size, extra: 0 };
      if (found > best.found || (found === best.found && extra < best.extra)) best = { found, extra, column: c };
    }
    const { found, extra, column } = best;
    let message;
    if (found === E.size) message = `Everything we need is in "${column}", plus ${extra} extra value${extra === 1 ? '' : 's'}. Filter out the noise.`;
    else if (found > 0) message = `Close: ${found} of ${E.size} expected value${E.size === 1 ? '' : 's'} found${extra ? `, with ${extra} extra` : ''}.`;
    else message = 'None of the expected values are in your results yet.';
    return { ok: false, message, column, found, expected: E.size, extra };
  }
  if (answer.mode === 'counts') {
    const expected = new Map(Object.entries(answer.counts).map(([k, n]) => [norm(k), Number(n)]));
    let best = null;
    for (const kc of cols) {
      for (const nc of cols) {
        if (nc === kc) continue;
        const got = new Map();
        let numeric = true;
        for (const r of rows) {
          const k = norm(Array.isArray(r[kc]) ? r[kc].join(',') : r[kc]);
          const n = Number(r[nc]);
          if (!Number.isFinite(n)) numeric = false;
          got.set(k, (got.get(k) || 0) + n);
        }
        if (!numeric) continue;
        let keysOk = 0;
        let countsOk = 0;
        let firstBad = null;
        for (const [k, n] of expected) {
          if (got.has(k)) {
            keysOk++;
            if (got.get(k) === n) countsOk++;
            else if (!firstBad) firstBad = { k, n, got: got.get(k) };
          }
        }
        const extra = [...got.keys()].filter((k) => !expected.has(k)).length;
        if (keysOk === expected.size && countsOk === expected.size && extra === 0) return { ok: true, message: `Correct: all ${expected.size} rows and counts match.`, column: kc };
        const score = countsOk * 2 + keysOk - extra;
        if (!best || score > best.score) best = { score, keysOk, countsOk, extra, firstBad, kc };
      }
    }
    if (!best) return { ok: false, message: 'Need two columns: the key and a count.' };
    const { keysOk, countsOk, extra, firstBad } = best;
    const total = expected.size;
    let message;
    if (keysOk === total && countsOk < total && firstBad) message = `All ${total} keys are there, but some counts differ (e.g. ${firstBad.k}: you have ${firstBad.got}, expected ${firstBad.n}). Check your filter.`;
    else if (keysOk < total) message = `${keysOk} of ${total} expected rows found${extra ? `, plus ${extra} unexpected` : ''}. Don't cut the list short (no head/take).`;
    else message = `${extra} unexpected row${extra === 1 ? '' : 's'}: filter to exactly what was asked.`;
    return { ok: false, message };
  }
  throw new Error(`Unknown answer mode ${answer.mode}`);
}

/** Human summary of what a correct answer looks like (shown after solving). */
export function answerSummary(answer) {
  if (answer.mode === 'counts') return `${Object.keys(answer.counts).length} rows (key + count)`;
  return (answer.values || []).map(show).join(', ');
}

// ------------------------------------------------------------------ records + XP (improvement-only)

export function queryXp(ch, hints) {
  const base = LAB_XP.query[ch.difficulty] || LAB_XP.query[1];
  return Math.round(base * Math.max(LAB_XP.hintFloor, 1 - LAB_XP.hintPenalty * (hints || 0)));
}

/**
 * Records a query attempt. Returns { xp, breakdown, firstSolve }.
 * XP is paid once per challenge (the best hint-adjusted value), plus a one-off bonus for
 * solving it in the second dialect.
 */
export function recordQuery(st, ch, { ok, dialect, hints = 0, query = '', now = Date.now() }) {
  const lab = ensureLab(st);
  const rec = (lab.query[ch.id] ??= { solved: false, xpPaid: 0, hints: 0, dialects: {}, attempts: 0 });
  rec.attempts += 1;
  rec.hints = Math.max(rec.hints, hints);
  if (!ok) return { xp: 0, breakdown: [], firstSolve: false };
  const breakdown = [];
  const firstSolve = !rec.solved;
  const value = queryXp(ch, hints);
  if (value > rec.xpPaid) {
    breakdown.push({ label: `${ch.title}${hints ? ` (${hints} hint${hints > 1 ? 's' : ''})` : ''}`, amount: value - rec.xpPaid });
    rec.xpPaid = value;
  }
  const hadOther = Object.keys(rec.dialects).some((d) => d !== dialect && rec.dialects[d]);
  if (hadOther && !rec.dialects[dialect] && !rec.bonus) {
    rec.bonus = true;
    breakdown.push({ label: `Bilingual: solved in ${dialect.toUpperCase()} too`, amount: LAB_XP.dialectBonus });
  }
  rec.dialects[dialect] = true;
  rec.solved = true;
  rec.at = now;
  rec.query = String(query).slice(0, 2000);
  return { xp: breakdown.reduce((a, b) => a + b.amount, 0), breakdown, firstSolve };
}

/** Packet cases and rule exercises: XP = rate × score/100, improvement-only. */
export function recordScored(st, kind, def, { score, passed, perfect = false, text, now = Date.now() }) {
  const lab = ensureLab(st);
  const bucket = kind === 'packet' ? lab.packets : lab.rules;
  const rec = (bucket[def.id] ??= { solved: false, best: 0, xpPaid: 0, attempts: 0 });
  rec.attempts += 1;
  const firstSolve = passed && !rec.solved;
  if (passed) rec.solved = true;
  if (perfect) rec.perfect = true;
  rec.best = Math.max(rec.best, score);
  rec.at = now;
  if (text !== undefined) rec.text = String(text).slice(0, 4000);
  const rate = (kind === 'packet' ? LAB_XP.packet : LAB_XP.rule)[def.difficulty] || 30;
  const effective = passed ? score : Math.round(score * 0.25);
  const value = Math.round((rate * effective) / 100);
  const breakdown = [];
  if (value > rec.xpPaid) {
    breakdown.push({ label: `${def.title} ${score}%${passed ? '' : ' (below pass, ×0.25)'}`, amount: value - rec.xpPaid });
    rec.xpPaid = value;
  }
  return { xp: breakdown.reduce((a, b) => a + b.amount, 0), breakdown, firstSolve };
}

/** Counts for badges and the dashboard. */
export function labStats(st) {
  const lab = st.lab || {};
  const vals = (o) => Object.values(o || {});
  return {
    queriesSolved: vals(lab.query).filter((r) => r.solved).length,
    bilingual: vals(lab.query).filter((r) => r.dialects?.spl && r.dialects?.kql).length,
    packetsSolved: vals(lab.packets).filter((r) => r.solved).length,
    rulesSolved: vals(lab.rules).filter((r) => r.solved).length,
    rulesPerfect: vals(lab.rules).filter((r) => r.perfect).length,
  };
}

/** Max lab XP from content, only for levels whose tier is available. Used by game.xpBudget. */
export function labBudget(content) {
  const lab = content.lab || {};
  const tiers = content.tiers || [];
  const available = (level) => {
    const t = tiers.find((x) => x.level === level);
    return !t || t.status === 'available';
  };
  const sum = (list, rates, extra = 0) => (list || []).filter((d) => available(d.level)).reduce((a, d) => a + (rates[d.difficulty] || 0) + extra, 0);
  const query = sum(lab.queryChallenges, LAB_XP.query, LAB_XP.dialectBonus);
  const packets = sum(lab.packetCases, LAB_XP.packet);
  const rules = sum(lab.ruleExercises, LAB_XP.rule);
  return { query, packets, rules, total: query + packets + rules };
}

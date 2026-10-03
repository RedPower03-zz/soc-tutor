// Sigma-lite and YARA-lite. Rules are replayed against labelled samples.
// Graded on the confusion counts (TP / FP / FN / TN), never on the rule text.
//
// Sigma-lite (every positive line is AND, every "not" line is excluded):
//   logsource windows-security
//   EventID == 4625
//   IpAddress startswith 203.0.113.
//   not TargetUserName endswith $
// Operators: ==  !=  contains  startswith  endswith  regex
//
// YARA-lite:
//   $a = "eval($_POST" nocase
//   $b = /Invoke-WebRequest/i
//   condition: any          (any | all | <number>)

export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuleError';
  }
}

const OPS = ['startswith', 'endswith', 'contains', 'regex', '==', '!='];

function stripLine(line) {
  return line.replace(/\/\/.*$/, '').replace(/#.*$/, '').trim();
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

export function parseRule(text) {
  const lines = String(text || '')
    .split(/\n/)
    .map(stripLine)
    .filter((l) => l && !/:$/.test(l) && l.toLowerCase() !== 'detection');
  if (!lines.length) throw new RuleError('The rule is empty.');
  const yara = lines.some((l) => /^\$[A-Za-z_]\w*\s*=/.test(l) || /^condition\s*:/i.test(l));
  return yara ? parseYara(lines) : parseSigma(lines);
}

function parseSigma(lines) {
  let logsource = '';
  const conds = [];
  for (const line of lines) {
    const src = /^(?:logsource|product)\s*[:=]?\s*(.+)$/i.exec(line);
    if (src) { logsource = unquote(src[1]).toLowerCase(); continue; }
    let body = line;
    let not = false;
    if (/^not\s+/i.test(body)) { not = true; body = body.replace(/^not\s+/i, ''); }
    const op = OPS.find((o) => new RegExp(`\\s${o}\\s`, 'i').test(` ${body} `) || new RegExp(`\\s${o}\\s`, 'i').test(body));
    // find operator as a whole token
    let found = null;
    for (const o of OPS) {
      const re = new RegExp(`^(.+?)\\s+${o}\\s+(.+)$`, 'i');
      const m = re.exec(body);
      if (m) { found = { field: m[1].trim(), op: o, value: unquote(m[2]) }; break; }
    }
    if (!found) throw new RuleError(`Can't read "${line}". Use Field == value, or contains / startswith / endswith / regex.`);
    conds.push({ ...found, not });
  }
  if (!conds.length) throw new RuleError('Add at least one condition. A log source alone matches nothing.');
  return { kind: 'sigma', logsource, conds };
}

function parseYara(lines) {
  const strings = [];
  let condition = 'any';
  for (const line of lines) {
    const cond = /^condition\s*:\s*(.+)$/i.exec(line);
    if (cond) {
      const c = cond[1].trim().toLowerCase();
      if (c === 'any' || c === 'all' || c === 'any of them' || c === 'all of them') condition = c.startsWith('all') ? 'all' : 'any';
      else if (/^\d+$/.test(c) || /^\d+\s+of\s+them$/.test(c)) condition = Number(c);
      else throw new RuleError('condition must be any, all, or a number (how many strings must hit).');
      continue;
    }
    const m = /^(\$[A-Za-z_]\w*)\s*=\s*(.+)$/.exec(line);
    if (!m) {
      if (/^rule\b/i.test(line) || line === '{' || line === '}' || /^strings\s*:/i.test(line)) continue;
      throw new RuleError(`Can't read "${line}". A string looks like $a = "text" nocase.`);
    }
    let rest = m[2].trim();
    const nocase = /\bnocase\b/i.test(rest) || /\/[a-z]*i[a-z]*$/.test(rest);
    rest = rest.replace(/\bnocase\b/i, '').trim();
    let re;
    const rx = /^\/(.+)\/([a-z]*)$/.exec(rest);
    if (rx) {
      try { re = new RegExp(rx[1], rx[2].includes('i') || nocase ? 'i' : ''); }
      catch (e) { throw new RuleError(`Bad regex in ${m[1]}: ${e.message}`); }
    } else {
      const lit = unquote(rest);
      const esc = lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(esc, nocase ? 'i' : '');
    }
    strings.push({ name: m[1], re });
  }
  if (!strings.length) throw new RuleError('Add at least one string ($a = "...").');
  return { kind: 'yara', strings, condition };
}

function valuesOf(sample, field) {
  const bag = sample.fields || {};
  if (Object.prototype.hasOwnProperty.call(bag, field)) return [bag[field]];
  const hit = Object.keys(bag).find((k) => k.toLowerCase() === field.toLowerCase());
  if (hit) return [bag[hit]];
  return [];
}

function condHit(cond, sample) {
  const vals = valuesOf(sample, cond.field).filter((v) => v != null);
  const raw = cond.value;
  const test = (v) => {
    const s = String(v);
    const sl = s.toLowerCase();
    const rl = String(raw).toLowerCase();
    if (cond.op === '==') return sl === rl || (Number(s) === Number(raw) && String(raw).trim() !== '' && !Number.isNaN(Number(raw)));
    if (cond.op === '!=') return sl !== rl;
    if (cond.op === 'contains') return sl.includes(rl);
    if (cond.op === 'startswith') return sl.startsWith(rl);
    if (cond.op === 'endswith') return sl.endsWith(rl);
    if (cond.op === 'regex') {
      try { return new RegExp(raw, 'i').test(s); }
      catch { return false; }
    }
    return false;
  };
  if (cond.op === '!=') return vals.length === 0 || vals.every(test);
  return vals.some(test);
}

export function matches(rule, sample) {
  if (rule.kind === 'yara') {
    const hay = `${sample.text || ''}\n${Object.values(sample.fields || {}).join('\n')}`;
    const n = rule.strings.filter((s) => s.re.test(hay)).length;
    if (rule.condition === 'all') return n === rule.strings.length;
    if (typeof rule.condition === 'number') return n >= rule.condition;
    return n >= 1;
  }
  if (rule.logsource && sample.source && rule.logsource !== String(sample.source).toLowerCase()) return false;
  const pos = rule.conds.filter((c) => !c.not);
  const neg = rule.conds.filter((c) => c.not);
  if (!pos.length) return false;
  if (!pos.every((c) => condHit(c, sample))) return false;
  if (neg.some((c) => condHit({ ...c, not: false }, sample))) return false;
  return true;
}

/**
 * Replays a rule. score is balanced accuracy (catching the bad and sparing the good count equally).
 * passed only when every malicious sample hits and no benign sample does.
 */
export function gradeRule(exercise, text) {
  const rule = parseRule(text);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const detail = [];
  for (const s of exercise.samples) {
    const hit = matches(rule, s);
    const mal = !!s.malicious;
    const bucket = hit && mal ? 'tp' : hit ? 'fp' : mal ? 'fn' : 'tn';
    if (bucket === 'tp') tp++;
    else if (bucket === 'fp') fp++;
    else if (bucket === 'fn') fn++;
    else tn++;
    detail.push({ id: s.id, bucket, malicious: mal, note: s.note || '' });
  }
  const malN = exercise.samples.filter((s) => s.malicious).length;
  const benN = exercise.samples.length - malN;
  const recall = malN ? tp / malN : 1;
  const specificity = benN ? tn / benN : 1;
  const score = Math.round((100 * (recall + specificity)) / 2);
  const passed = fn === 0 && fp === 0 && tp === malN;
  return { tp, fp, fn, tn, score, passed, perfect: passed, detail, kind: rule.kind };
}

// Deterministic helpers for the parameterised item generators (content/gen/*).
// Every generated item is a pure function of (generator id, seed): the same seed
// always yields the same prompt, choices and answer, on every device, so the
// item id `g-<generator>-<seed>` is a stable key for review cards and history.

/** 32-bit FNV-1a hash of a string, used to give each generator its own stream. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small toolbox around one PRNG stream. */
export function makeRng(genId, seed) {
  const next = mulberry32((hashString(genId) ^ Math.imul(seed, 0x9e3779b1)) >>> 0);
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (arr, k) => shuffle(arr).slice(0, k);
  const chance = (p) => next() < p;
  // cycle(table): walks a fixed, generator-specific permutation of `table`, so
  // seeds 1..n cover n different entries before any repeats.
  const cycle = (arr) => {
    const perm = mulberry32(hashString(`${genId}#cycle`));
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(perm() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a[(seed - 1) % a.length];
  };
  return { next, int, pick, shuffle, sample, chance, cycle };
}

/**
 * Builds a single-answer multiple-choice payload.
 * `distractors` are strings or { text, mis } (mis = misconception id). Duplicates
 * of the answer or of each other are dropped; the first three survivors are used.
 */
export function mc(r, answer, distractors, n = 4) {
  const seen = new Set([answer]);
  const picked = [];
  for (const d of distractors) {
    const text = typeof d === 'string' ? d : d.text;
    if (seen.has(text)) continue;
    seen.add(text);
    picked.push(typeof d === 'string' ? { text } : d);
    if (picked.length === n - 1) break;
  }
  if (picked.length < n - 1) throw new Error(`generator produced only ${picked.length} distinct distractors for "${answer}"`);
  const misconceptions = {};
  for (const d of picked) if (d.mis) misconceptions[d.text] = d.mis;
  const out = { type: 'mc', choices: r.shuffle([answer, ...picked.map((d) => d.text)]), answer };
  if (Object.keys(misconceptions).length) out.misconceptions = misconceptions;
  return out;
}

/** IPv4 helpers (unsigned 32-bit ints). */
export const ip = {
  toInt: (s) => s.split('.').reduce((a, o) => ((a << 8) | Number(o)) >>> 0, 0) >>> 0,
  toStr: (n) => [24, 16, 8, 0].map((b) => (n >>> b) & 255).join('.'),
  mask: (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0),
};

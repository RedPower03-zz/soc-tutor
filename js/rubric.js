// Keyword rubrics for SIEM write-ups and capstone reports.
// A point is a synonym group: any one phrase hits it (and only once).
// `groups` (or `all`) is an AND of those groups, for points that need two ideas.
// A dump of the answer key, or one word repeated to clear the length bar, scores nothing.

const STOP = new Set(
  'a an the of to and or in on for from with by as is was were be been it its this that then after before when who which not no but so if at into over under their his her they he she we our via using used because while during also only just had has have did does do than about across after again'.split(' '),
);

function groupsOf(point) {
  if (Array.isArray(point.groups)) return point.groups;
  if (Array.isArray(point.all)) return point.all.map((g) => (Array.isArray(g) ? g : [g]));
  return [point.any || []];
}

/**
 * @param {string} text
 * @param {{label:string, any?:string[], groups?:string[][], all?:any[]}[]} rubric
 * @param {{minLength?:number}} [opts]
 * @returns {{tooShort:boolean, stuffed:boolean, credit:number, hits:string[], misses:string[]}}
 */
export function scoreKeywordRubric(text, rubric, { minLength = 20 } = {}) {
  const points = rubric || [];
  const raw = String(text || '');
  const hay = raw.toLowerCase();
  if (hay.trim().length < minLength) {
    return { tooShort: true, stuffed: false, credit: 0, hits: [], misses: points.map((p) => p.label) };
  }
  const matched = points.filter((p) => groupsOf(p).every((g) => g.some((k) => k && hay.includes(String(k).toLowerCase()))));

  let stripped = hay;
  const phrases = [];
  for (const p of points) for (const g of groupsOf(p)) for (const k of g) if (k) phrases.push(String(k).toLowerCase());
  phrases.sort((a, b) => b.length - a.length);
  for (const k of phrases) stripped = stripped.split(k).join(' ');
  const words = stripped.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const stops = words.filter((w) => STOP.has(w));
  const prose = words.filter((w) => STOP.has(w) || (w.length >= 3 && !/^\d+$/.test(w)));
  const tokens = hay.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  let maxRep = 0;
  const freq = new Map();
  for (const w of tokens) {
    const n = (freq.get(w) || 0) + 1;
    freq.set(w, n);
    if (!STOP.has(w) && n > maxRep) maxRep = n;
  }
  // A keyword list has almost no leftover words. A list with a couple of extra
  // content words and no connective words (the, is, because...) is still a dump.
  // One token repeated to clear the length minimum does not count either.
  const stuffed = prose.length < 3 || (stops.length === 0 && prose.length < 8) || maxRep >= 6;
  const kept = stuffed ? [] : matched;
  return {
    tooShort: false,
    stuffed,
    credit: points.length ? kept.length / points.length : 0,
    hits: kept.map((p) => p.label),
    misses: points.filter((p) => !kept.includes(p)).map((p) => p.label),
  };
}

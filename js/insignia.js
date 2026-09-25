// Rank insignia for the 16-rank career ladder (content/career.js).
// Chevrons show the step within a band (I/II/III); marks above show the band:
// none = Junior, one bar = Tier 1, two bars = Tier 2, stars = Senior (1), specialists (2), leadership (3).
const MARKS = [
  { chev: 0 }, // Trainee: a single stripe
  { chev: 1 }, { chev: 2 }, // Junior I-II
  { chev: 1, bars: 1 }, { chev: 2, bars: 1 }, { chev: 3, bars: 1 }, // Tier 1 I-III
  { chev: 1, bars: 2 }, { chev: 2, bars: 2 }, { chev: 3, bars: 2 }, // Tier 2 I-III
  { chev: 2, stars: 1 }, { chev: 3, stars: 1 }, // Senior I-II
  { chev: 1, stars: 2 }, { chev: 2, stars: 2 }, { chev: 3, stars: 2 }, // Responder, Hunter, Detection Engineer
  { chev: 2, stars: 3 }, { chev: 3, stars: 3 }, // SOC Lead, SOC Manager
];

export function rankInsignia(ri, cls = '') {
  const m = MARKS[Math.min(Math.max(ri, 0), MARKS.length - 1)];
  let paths = '';
  if (!m.chev) paths += '<path d="M8 26 H24"/>';
  for (let i = 0; i < m.chev; i++) {
    const y = 31 - i * 6;
    paths += `<path d="M5 ${y} L16 ${y - 6} L27 ${y}"/>`;
  }
  const top = m.chev ? 31 - (m.chev - 1) * 6 - 6 : 22; // y of the highest chevron tip
  for (let i = 0; i < (m.bars || 0); i++) {
    const y = top - 5 - i * 4.5;
    paths += `<path class="bar-mark" d="M10 ${y} H22"/>`;
  }
  const n = m.stars || 0;
  for (let i = 0; i < n; i++) {
    const cx = 16 + (i - (n - 1) / 2) * 9;
    const cy = Math.max(1.2, top - 13);
    paths += `<path class="star" d="M${cx} ${cy} l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/>`;
  }
  return `<svg class="insignia ${cls}" viewBox="0 0 32 34" aria-hidden="true">${paths}</svg>`;
}

// Level 3 · Advanced: everything in one place for content/index.js.
// Each skill file exports { items, lesson, misconceptions }.
import { L3_TRACK, L3_SKILLS } from './skills.js';
import { PKI } from './pki.js';
import { CRYPTO } from './crypto.js';
import { IDENTITY } from './identity.js';
import { CLOUD } from './cloud.js';
import { FORENSICS } from './forensics.js';
import { DETECTION } from './detection.js';

const PARTS = [PKI, CRYPTO, IDENTITY, CLOUD, FORENSICS, DETECTION];

export const L3 = {
  track: L3_TRACK,
  skills: L3_SKILLS,
  items: PARTS.flatMap((p) => p.items),
  lessons: PARTS.map((p) => p.lesson),
  misconceptions: PARTS.flatMap((p) => p.misconceptions),
};

/** Replaces roadmap skills with the built Level 3 definitions (same ids) and appends new ids. */
export function withL3Skills(skills) {
  const byId = new Map(L3_SKILLS.map((s) => [s.id, s]));
  const merged = skills.map((s) => byId.get(s.id) || s);
  const have = new Set(merged.map((s) => s.id));
  return [...merged, ...L3_SKILLS.filter((s) => !have.has(s.id))];
}

export const withL3Track = (tracks) => tracks.map((t) => (t.id === L3_TRACK.id ? { ...t, ...L3_TRACK } : t));

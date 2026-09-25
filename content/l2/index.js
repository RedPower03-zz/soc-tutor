// Level 2 · SOC Operations: everything in one place for content/index.js.
// Each skill file exports { items, lesson, misconceptions }.
import { L2_TRACK, L2_SKILLS } from './skills.js';
import { TRIAGE } from './triage.js';
import { SIEM } from './siem.js';
import { PHISHING } from './phishing.js';
import { MALWARE } from './malware.js';
import { ATTACK } from './attack.js';
import { IR } from './ir.js';
import { HUNTING } from './hunting.js';
import { VULN } from './vuln.js';

const PARTS = [TRIAGE, SIEM, PHISHING, MALWARE, ATTACK, IR, HUNTING, VULN];

export const L2 = {
  track: L2_TRACK,
  skills: L2_SKILLS,
  items: PARTS.flatMap((p) => p.items),
  lessons: PARTS.map((p) => p.lesson),
  misconceptions: PARTS.flatMap((p) => p.misconceptions),
};

/** Replaces roadmap skills with the built Level 2 definitions (same ids) and appends new ids. */
export function withL2Skills(skills) {
  const byId = new Map(L2_SKILLS.map((s) => [s.id, s]));
  const merged = skills.map((s) => byId.get(s.id) || s);
  const have = new Set(merged.map((s) => s.id));
  return [...merged, ...L2_SKILLS.filter((s) => !have.has(s.id))];
}

export const withL2Track = (tracks) => tracks.map((t) => (t.id === L2_TRACK.id ? { ...t, ...L2_TRACK } : t));

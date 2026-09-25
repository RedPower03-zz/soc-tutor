// Curriculum tiers and the SOC career ladder.
//
// Everything here is data: add a tier, a track or a rank and the dashboard, rank
// computation and gate checks pick it up without code changes (js/game.js reads it).
//
// TIERS
//   id, level, name, short (label for tight spaces), summary
//   tracks    track ids (content/skills.js) that belong to this tier
//   status    'available' (skills built) | 'coming-soon'
//
// RANKS (ordered, lowest first)
//   id, title, band (tier id it belongs to, for grouping on the ladder), xp (threshold)
//   gates: [...] every gate must be met, plus the XP threshold. Gate types:
//     { type: 'mastered', tier, count }   at least `count` skills mastered in that tier
//     { type: 'tier', tier }              every skill in the tier mastered (tier must be available)
//     { type: 'skills', skills: [...] }   these specific skills mastered
//     { type: 'cases', count, tier? }     SIEM investigation cases solved (verdict right, score >= pass)
//     { type: 'scenario', id, title? }    a capstone / scenario completed (content/scenarios.js);
//                                         title is shown while the scenario isn't built yet
//     { type: 'all-tiers' }               every tier complete
//   Gates that point at content that doesn't exist yet can't be met and are shown as "coming soon".

export const TIERS = [
  {
    id: 'l1',
    level: 1,
    name: 'Foundations',
    short: 'Foundations',
    summary: 'Host and network basics every analyst relies on.',
    tracks: ['host', 'network'],
    status: 'available',
  },
  {
    id: 'l2',
    level: 2,
    name: 'SOC Operations',
    short: 'SOC Ops',
    summary: 'Alert triage, SIEM, phishing, malware, incident response and threat hunting.',
    tracks: ['soc'],
    status: 'available',
  },
  {
    id: 'l3',
    level: 3,
    name: 'Advanced',
    short: 'Advanced',
    summary: 'PKI and certificates, cryptography, identity and Kerberos, cloud, forensics, detection engineering.',
    tracks: ['advanced'],
    status: 'available',
  },
];

export const RANKS = [
  // ---- Foundations (Level 1 + SIEM cases + First shift capstone)
  { id: 'trainee', title: 'Trainee', band: 'l1', xp: 0, gates: [] },
  { id: 'junior-1', title: 'Junior Analyst I', band: 'l1', xp: 250, gates: [] },
  { id: 'junior-2', title: 'Junior Analyst II', band: 'l1', xp: 700, gates: [{ type: 'mastered', tier: 'l1', count: 2 }] },
  { id: 'tier1-1', title: 'Tier 1 Analyst I', band: 'l1', xp: 1500, gates: [{ type: 'mastered', tier: 'l1', count: 5 }] },
  { id: 'tier1-2', title: 'Tier 1 Analyst II', band: 'l1', xp: 3000, gates: [{ type: 'mastered', tier: 'l1', count: 9 }, { type: 'cases', count: 1 }] },
  {
    id: 'tier1-3',
    title: 'Tier 1 Analyst III',
    band: 'l1',
    xp: 5000,
    gates: [{ type: 'tier', tier: 'l1' }, { type: 'cases', count: 3 }, { type: 'scenario', id: 'first-shift' }],
  },
  // ---- SOC Operations (Level 2)
  { id: 'tier2-1', title: 'Tier 2 Analyst I', band: 'l2', xp: 7000, gates: [{ type: 'mastered', tier: 'l2', count: 2 }] },
  { id: 'tier2-2', title: 'Tier 2 Analyst II', band: 'l2', xp: 8500, gates: [{ type: 'mastered', tier: 'l2', count: 4 }] },
  { id: 'tier2-3', title: 'Tier 2 Analyst III', band: 'l2', xp: 10000, gates: [{ type: 'tier', tier: 'l2' }] },
  { id: 'senior-1', title: 'Senior Analyst I', band: 'l2', xp: 11500, gates: [{ type: 'tier', tier: 'l2' }, { type: 'scenario', id: 'night-shift-lead', title: 'Night-shift lead capstone' }] },
  // ---- Advanced (Level 3)
  { id: 'senior-2', title: 'Senior Analyst II', band: 'l3', xp: 19000, gates: [{ type: 'mastered', tier: 'l3', count: 2 }] },
  { id: 'responder', title: 'Incident Responder', band: 'l3', xp: 20000, gates: [{ type: 'skills', skills: ['l2-ir', 'l3-forensics'] }] },
  { id: 'hunter', title: 'Threat Hunter', band: 'l3', xp: 21500, gates: [{ type: 'skills', skills: ['l2-hunting', 'l3-identity'] }] },
  { id: 'detection', title: 'Detection Engineer', band: 'l3', xp: 23000, gates: [{ type: 'skills', skills: ['l2-siem', 'l3-detection'] }] },
  { id: 'lead', title: 'SOC Lead', band: 'l3', xp: 25500, gates: [{ type: 'tier', tier: 'l3' }] },
  { id: 'manager', title: 'SOC Manager', band: 'l3', xp: 28000, gates: [{ type: 'all-tiers' }, { type: 'scenario', id: 'major-incident', title: 'Major incident capstone' }] },
];

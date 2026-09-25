// SOC Tutor gamification: XP, levels, SOC career ranks, badges, streaks and unlockables.
//
// Pure JavaScript (no DOM), unit-tested in tests/game.test.js. Everything lives in
// `state.game` and every function takes an explicit `now` (ms timestamp) so tests can
// use a fake clock.
//
// Design rule: reward effortful, learning-relevant actions, not raw volume.
//  * Correct answers earn XP scaled by difficulty; typed (free-recall) answers earn a bonus.
//  * Re-answering easy questions in a skill you've already mastered earns nothing, and
//    grinding one skill on the same day has diminishing returns.
//  * Wrong answers earn a little XP for the attempt. XP is never taken away.
//  * The big rewards are for learning milestones: mastering a skill, closing a root gap,
//    clearing missed questions, finishing the day's due reviews.
import * as E from './engine.js';
import { RANKS as CAREER_RANKS, TIERS as CAREER_TIERS } from '../content/career.js';

// ------------------------------------------------------------------ config

/** Every XP value in one place. See README "How XP works". */
export const XP_RULES = {
  correct: { 1: 10, 2: 15, 3: 25 }, // correct answer, by difficulty
  typedBonus: 5, // extra for a correct typed (free-recall) answer
  attempt: 2, // wrong answer: small XP for the effort (never negative)
  masteredEasy: 0, // correct difficulty-1 answer in a skill you've already mastered
  masteredRepeatFactor: 0.5, // harder questions in an already-mastered skill earn half
  reviewCorrect: 8, // bonus for getting a previously missed question right
  reviewCleared: 10, // a missed question fully cleared from the review list
  dailyReviewComplete: 30, // once per day: you finished all of the day's due long-term reviews (Daily review)
  skillMastered: 100, // first time you master a skill
  rootGapClosed: 75, // a root gap found by the tutor is fixed
  sureCorrect: 5, // confidence rated "Sure" and right (calibration)
  misconceptionResolved: 20, // got the follow-up right after a misconception was flagged
  lessonCompleted: 30, // finished a lesson
  workedExample: 5, // stepped through a worked example
  fadedExample: 10, // completed a faded (partly-solved) example yourself
  placementCorrect: 5, // placement check answers (flat, no difficulty scaling)
  placementAttempt: 2,
  // Operations: XP scales with the investigation score, and replays only pay for improvement.
  siemCase: { 1: 120, 2: 160, 3: 220 }, // SIEM case at 100% score, by case difficulty
  capstoneStage: 40, // First shift: each stage at 100%
  escalation: 300, // First shift: escalation report at 100% of the rubric
  // Diminishing returns for answers in the same skill on the same day
  diminishing: [
    { upTo: 15, factor: 1 },
    { upTo: 30, factor: 0.5 },
    { upTo: Infinity, factor: 0.25 },
  ],
};

/** Human-readable table for the profile screen and README. */
export const XP_TABLE = [
  ['Correct answer: easy / medium / hard', `${XP_RULES.correct[1]} / ${XP_RULES.correct[2]} / ${XP_RULES.correct[3]}`],
  ['Typed answer bonus (when correct)', `+${XP_RULES.typedBonus}`],
  ['Wrong answer (effort)', `${XP_RULES.attempt}`],
  ['Missed question answered right on review', `+${XP_RULES.reviewCorrect}`],
  ['Missed question cleared from review list', `+${XP_RULES.reviewCleared}`],
  ['Finish all due reviews for the day', `+${XP_RULES.dailyReviewComplete}`],
  ['Master a skill (first time)', `+${XP_RULES.skillMastered}`],
  ['Close a root gap', `+${XP_RULES.rootGapClosed}`],
  ['"Sure" and correct (confidence)', `+${XP_RULES.sureCorrect}`],
  ['Misconception resolved', `+${XP_RULES.misconceptionResolved}`],
  ['Lesson / worked example / faded example', `${XP_RULES.lessonCompleted} / ${XP_RULES.workedExample} / ${XP_RULES.fadedExample}`],
  ['Placement answer: right / wrong', `${XP_RULES.placementCorrect} / ${XP_RULES.placementAttempt}`],
  ['SIEM case (× your score): easy / medium / hard', `${XP_RULES.siemCase[1]} / ${XP_RULES.siemCase[2]} / ${XP_RULES.siemCase[3]}`],
  ['First shift: each stage / escalation report (× score)', `${XP_RULES.capstoneStage} / ${XP_RULES.escalation}`],
  ['Night-shift lead: each stage / shift handover (× score)', '50 / 500'],
  ['Major incident: each stage / incident report (× score)', '75 / 800'],
  ['Replaying a case or stage', 'only the improvement on your best score'],
  ['Easy question in a skill you already mastered', `${XP_RULES.masteredEasy}`],
  ['Harder question in a mastered skill', `×${XP_RULES.masteredRepeatFactor}`],
  ['Same skill, same day: answers 16–30 / 31+', '×0.5 / ×0.25'],
];

/**
 * Level curve, sized for the whole planned curriculum (Levels 1-3), not just today's content.
 * Level L starts at 10·(L−1)^2.25 XP (rounded to 5): L2 = 10, L5 = 225, L10 = 1,400,
 * L20 = 7,525, L40 = 38,190, L60 = 96,440. Early levels come quickly; the cap is MAX_LEVEL.
 */
export const MAX_LEVEL = 60;
export function levelThreshold(level) {
  if (level <= 1) return 0;
  return Math.round((10 * (level - 1) ** 2.25) / 5) * 5;
}
export function levelForXp(xp) {
  let L = 1;
  while (L < MAX_LEVEL && levelThreshold(L + 1) <= xp) L++;
  return L;
}

/** SOC career ladder and curriculum tiers: data in content/career.js. */
export const RANKS = CAREER_RANKS;
export const TIERS = CAREER_TIERS;

/** Cosmetic accent themes, unlocked by rank (spread across the whole ladder). */
export const THEMES = [
  { id: 'cyan', name: 'Standard', rank: 'trainee', description: 'Cyan command-center default.' },
  { id: 'amber', name: 'Night Ops', rank: 'junior-2', description: 'Amber low-light console.' },
  { id: 'red', name: 'Incident', rank: 'tier1-2', description: 'Red-alert incident room.' },
  { id: 'green', name: 'Terminal', rank: 'tier2-1', description: 'Old-school green phosphor.' },
  { id: 'violet', name: 'Deep Hunt', rank: 'senior-2', description: 'Violet threat-hunting console.' },
  { id: 'ice', name: 'Whiteout', rank: 'detection', description: 'Cold white detection lab.' },
  { id: 'gold', name: 'Command', rank: 'lead', description: 'Gold SOC-lead command deck.' },
];

// ------------------------------------------------------------------ badges

const masteredIn = (st, content, track, level) => {
  const idx = E.indexContent(content);
  const skills = idx.activeSkills.filter((s) => (!track || s.track === track) && (!level || (s.level ?? 1) === level));
  return { current: skills.filter((s) => E.isMastered(st, content, s.id)).length, target: skills.length };
};
const count = (n, target) => ({ current: Math.min(n, target), target });
const solvedCases = (st, content) => (content.siemCases || []).filter((c) => st.siem?.cases?.[c.id]?.solved).length;

/**
 * Badge definitions. progress(game, st, content) -> { current, target, text? }.
 * A badge is earned when current >= target. Hidden badges show as "???" until earned.
 * `title` (optional) becomes an equippable title when the badge is earned.
 */
export const BADGES = [
  { id: 'first-blood', name: 'First Blood', icon: 'crosshair', description: 'Get your first correct answer.', progress: (g) => count(g.counters.correct, 1) },
  { id: 'certified', name: 'Certified', icon: 'award', description: 'Master your first skill.', progress: (g, st, c) => count(masteredIn(st, c).current, 1) },
  { id: 'sharpshooter', name: 'Sharpshooter', icon: 'target', description: 'Get 10 answers right in a row.', progress: (g) => count(g.counters.bestRun, 10) },
  { id: 'subnet-sniper', name: 'Subnet Sniper', icon: 'crosshair', title: 'Subnet Sniper', description: 'Get 10 Subnetting & CIDR answers right in a row.', progress: (g) => count(g.counters.subnetBest, 10) },
  { id: 'log-diver', name: 'Log Diver', icon: 'terminal', title: 'Log Diver', description: 'Correctly analyze 25 log, packet or process scenarios.', progress: (g) => count(g.counters.scenarioCorrect, 25) },
  { id: 'hard-target', name: 'Hard Target', icon: 'bolt', description: 'Answer 10 hard (difficulty 3) questions correctly.', progress: (g) => count(g.counters.hardCorrect, 10) },
  { id: 'total-recall', name: 'Total Recall', icon: 'keyboard', description: 'Get 15 typed answers right.', progress: (g) => count(g.counters.typedCorrect, 15) },
  { id: 'centurion', name: 'Centurion', icon: 'shield', description: 'Answer 100 questions correctly.', progress: (g) => count(g.counters.correct, 100) },
  { id: 'quick-study', name: 'Quick Study', icon: 'bolt', description: 'Master a skill without missing a single question in it.', progress: (g) => count(g.counters.cleanMasteries, 1) },
  { id: 'host-hardened', name: 'Host Hardened', icon: 'host', title: 'Host Hardener', description: 'Master every Host basics skill.', progress: (g, st, c) => masteredIn(st, c, 'host') },
  { id: 'packet-whisperer', name: 'Packet Whisperer', icon: 'network', title: 'Packet Whisperer', description: 'Master every Network basics skill.', progress: (g, st, c) => masteredIn(st, c, 'network') },
  { id: 'foundation', name: 'Foundation Laid', icon: 'layers', description: 'Master all Level 1 skills.', progress: (g, st, c) => masteredIn(st, c, null, 1) },
  { id: 'soc-operator', name: 'SOC Operator', icon: 'shield', title: 'SOC Operator', description: 'Master all Level 2 SOC Operations skills.', progress: (g, st, c) => masteredIn(st, c, null, 2) },
  { id: 'gap-closer', name: 'Gap Closer', icon: 'alert', title: 'Gap Closer', description: 'Fix a root gap the tutor identified.', progress: (g) => count(g.counters.gapsClosed, 1) },
  { id: 'second-look', name: 'Second Look', icon: 'review', description: 'Clear 10 missed questions from your review list.', progress: (g) => count(g.counters.reviewCleared, 10) },
  { id: 'daily-duty', name: 'Daily Duty', icon: 'check', description: 'Finish all your due reviews on 5 different days.', progress: (g) => count(g.counters.dailyReviews, 5) },
  { id: 'myth-buster', name: 'Myth Buster', icon: 'x', title: 'Myth Buster', description: 'Resolve 5 misconceptions.', progress: (g) => count(g.counters.misconceptionsResolved, 5) },
  {
    id: 'calibrated',
    name: 'Calibrated',
    icon: 'gauge',
    title: 'Calibrated',
    description: 'Be right on 80%+ of the answers you mark "Sure" (at least 20 Sure answers).',
    progress: (g) => {
      const { sureTotal, sureCorrect } = g.counters;
      const acc = sureTotal ? sureCorrect / sureTotal : 0;
      const met = sureTotal >= 20 && acc >= 0.8;
      return { current: met ? 20 : Math.min(sureTotal, 19), target: 20, text: `${sureTotal} Sure answers · ${Math.round(acc * 100)}% right` };
    },
  },
  { id: 'case-closed', name: 'Case Closed', icon: 'search', description: 'Solve your first SIEM investigation (right verdict, 60+ score).', progress: (g) => count(g.counters.casesSolved, 1) },
  { id: 'sharp-eye', name: 'Sharp Eye', icon: 'target', title: 'Sharp Eye', description: 'Pin every key piece of evidence in a case with no noise pins.', progress: (g) => count(g.counters.perfectEvidence, 1) },
  { id: 'false-alarm', name: 'Not Today', icon: 'shield', description: 'Correctly clear a false or benign alert without escalating it.', progress: (g) => count(g.counters.benignCleared, 1) },
  { id: 'grey-area', name: 'Grey Area', icon: 'target', title: 'Grey Area Analyst', description: 'Solve an ambiguous case with 80+ points, calibrated confidence and no harmful next steps.', progress: (g) => count(g.counters.calibratedCalls, 1) },
  { id: 'siem-sleuth', name: 'SIEM Sleuth', icon: 'search', title: 'SIEM Sleuth', description: 'Solve every SIEM investigation case.', progress: (g, st, c) => ({ current: solvedCases(st, c), target: (c.siemCases || []).length || 1 }) },
  { id: 'shift-complete', name: 'Shift Complete', icon: 'flag', title: 'Night Watch', description: 'Finish the First shift capstone with an escalation report.', progress: (g) => count(g.counters.capstonesDone, 1) },
  { id: 'shift-lead', name: 'Shift Lead', icon: 'flag', title: 'Shift Lead', description: 'Finish the Night-shift lead capstone with a passing handover.', progress: (g, st) => count(st.capstones?.['night-shift-lead']?.completedAt ? 1 : 0, 1) },
  { id: 'incident-commander', name: 'Incident Commander', icon: 'shield', title: 'Incident Commander', description: 'Finish the Major incident capstone with a passing report.', progress: (g, st) => count(st.capstones?.['major-incident']?.completedAt ? 1 : 0, 1) },
  { id: 'clean-handoff', name: 'Clean Handoff', icon: 'check', description: 'Score 85% or more on an escalation report.', progress: (g) => count(g.counters.cleanHandoffs, 1) },
  { id: 'on-watch-1', name: 'On Watch I', icon: 'flame', description: 'Study 3 days in a row.', progress: (g) => count(g.streak.best, 3) },
  { id: 'on-watch-2', name: 'On Watch II', icon: 'flame', description: 'Study 7 days in a row.', progress: (g) => count(g.streak.best, 7) },
  { id: 'on-watch-3', name: 'On Watch III', icon: 'flame', title: 'Watch Commander', description: 'Study 30 days in a row.', progress: (g) => count(g.streak.best, 30) },
  { id: 'night-shift', name: 'Night Shift', icon: 'moon', title: 'Night Shift', description: 'Study after 10 PM.', progress: (g) => count(g.counters.nightShift, 1) },
  // Secret badges
  { id: 'dawn-patrol', name: 'Dawn Patrol', icon: 'sun', hidden: true, description: 'Study between 5 and 7 AM.', progress: (g) => count(g.counters.earlyBird, 1) },
  { id: 'overqualified', name: 'Overqualified', icon: 'award', hidden: true, description: 'Ace every question in the placement check.', progress: (g) => count(g.counters.placementPerfect, 1) },
  { id: 'grace-under-fire', name: 'Grace Under Fire', icon: 'shield', hidden: true, description: 'Have a grace day keep your streak alive.', progress: (g) => count(g.streak.freezesUsed, 1) },
  { id: 'root-cause', name: 'Root Cause', icon: 'layers', hidden: true, title: 'Root Cause Analyst', description: 'Uncover a gap two building blocks deep.', progress: (g) => count(g.counters.deepGaps, 1) },
];

// ------------------------------------------------------------------ state

export function createGame() {
  return {
    version: 3,
    ladder: 2, // career ladder version: 1 = original 7 ranks (v2 saves), 2 = 16-rank ladder in content/career.js
    xp: 0,
    level: 1,
    rankId: 'trainee',
    equippedTitle: null,
    theme: 'cyan',
    badges: {},
    masteredOnce: {},
    log: [],
    streak: { current: 0, best: 0, lastDay: null, freezes: 0, lastFreezeWeek: null, freezesUsed: 0 },
    daily: { day: null, perSkill: {}, reviewBonusDay: null },
    counters: {
      answers: 0,
      correct: 0,
      run: 0,
      bestRun: 0,
      subnetRun: 0,
      subnetBest: 0,
      scenarioCorrect: 0,
      hardCorrect: 0,
      typedCorrect: 0,
      reviewCleared: 0,
      dailyReviews: 0,
      sureTotal: 0,
      sureCorrect: 0,
      misconceptionsResolved: 0,
      lessonsCompleted: 0,
      gapsClosed: 0,
      deepGaps: 0,
      cleanMasteries: 0,
      nightShift: 0,
      earlyBird: 0,
      placementPerfect: 0,
      casesSolved: 0,
      perfectEvidence: 0,
      benignCleared: 0,
      calibratedCalls: 0,
      capstonesDone: 0,
      cleanHandoffs: 0,
    },
    // Titles/themes earned under an older ladder stay available (see migrate.js v2 -> v3).
    keptTitles: [],
    keptThemes: [],
    ladderNotice: null,
  };
}

/** Fills in fields added in later versions. */
export function ensureGame(game) {
  const fresh = createGame();
  const g = game || fresh;
  for (const [k, v] of Object.entries(fresh)) if (g[k] === undefined) g[k] = v;
  for (const part of ['streak', 'daily', 'counters']) {
    for (const [k, v] of Object.entries(fresh[part])) if (g[part][k] === undefined) g[part][k] = v;
  }
  return g;
}

// ------------------------------------------------------------------ clock helpers

const pad = (n) => String(n).padStart(2, '0');
/** Local calendar day, e.g. "2026-09-25". */
export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Days since epoch for a day key (DST-safe). */
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
/** Week id = day number of that week's Monday. */
export function weekOf(key) {
  const n = dayNumber(key);
  const weekday = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Monday = 0
  return n - weekday;
}

// ------------------------------------------------------------------ streak

export const MAX_FREEZES = 2;

/**
 * Registers study activity today. Grace days: you bank one per calendar week you study
 * (max 2). Each missed day is covered automatically by one banked grace day.
 * Returns events: { type: 'streak-extended' | 'streak-started' | 'freeze-used' | 'freeze-earned', ... }
 */
export function touchStreak(game, now) {
  const s = game.streak;
  const today = dayKey(now);
  const events = [];
  if (s.lastDay === today) return events;

  const week = weekOf(today);
  if (s.lastFreezeWeek !== week) {
    s.lastFreezeWeek = week;
    if (s.freezes < MAX_FREEZES) {
      s.freezes += 1;
      events.push({ type: 'freeze-earned', text: 'Grace day banked for this week.' });
    }
  }

  if (!s.lastDay) {
    s.current = 1;
    events.push({ type: 'streak-started', text: 'Day 1 of your study streak.' });
  } else {
    const missed = dayNumber(today) - dayNumber(s.lastDay) - 1;
    if (missed <= 0) {
      s.current += 1;
      events.push({ type: 'streak-extended', text: `Study streak: ${s.current} days.` });
    } else if (missed <= s.freezes) {
      s.freezes -= missed;
      s.freezesUsed += missed;
      s.current += 1;
      events.push({ type: 'freeze-used', text: `A grace day covered ${missed === 1 ? 'the day you missed' : `${missed} missed days`}. Streak: ${s.current} days.` });
    } else {
      s.current = 1;
      events.push({ type: 'streak-started', text: 'Welcome back. A fresh streak starts today.' });
    }
  }
  s.best = Math.max(s.best, s.current);
  s.lastDay = today;
  return events;
}

// ------------------------------------------------------------------ ranks

export function rankIndex(id) {
  return Math.max(0, RANKS.findIndex((r) => r.id === id));
}

/** Tiers come from content (content.tiers) so new levels slot in as data; falls back to career.js. */
export const tiersOf = (content) => content.tiers || TIERS;
const tierById = (content, id) => tiersOf(content).find((t) => t.id === id);
/** Skills that belong to a tier (via its tracks). */
export function tierSkills(content, tierId) {
  const t = tierById(content, tierId);
  if (!t) return [];
  return content.skills.filter((s) => t.tracks.includes(s.track));
}
/** { mastered, total, available } for a tier. A tier with no built skills is not available. */
export function tierProgress(st, content, tierId) {
  const t = tierById(content, tierId);
  const idx = E.indexContent(content);
  const skills = tierSkills(content, tierId);
  const active = skills.filter((s) => idx.activeIds.has(s.id));
  const available = !!t && t.status === 'available' && active.length > 0 && active.length === skills.length;
  return { mastered: active.filter((s) => E.isMastered(st, content, s.id)).length, total: skills.length, available };
}
const scenarioDone = (st, id) => !!st.capstones?.[id]?.completedAt;
const scenarioExists = (content, id) => (content.scenarios || []).some((s) => s.id === id && s.status !== 'in-development');

/**
 * One row per requirement of a gate: { label, current, target, met, soon }.
 * `soon` = depends on content that isn't built yet.
 */
export function gateRows(gate, st, content) {
  const idx = E.indexContent(content);
  const tierName = (id) => {
    const t = tierById(content, id);
    return t ? `Level ${t.level} ${t.name}` : id;
  };
  switch (gate.type) {
    case 'mastered': {
      const p = tierProgress(st, content, gate.tier);
      const soon = !p.available && p.mastered < gate.count;
      return { label: `${gate.count} ${tierName(gate.tier)} skills mastered`, current: Math.min(p.mastered, gate.count), target: gate.count, met: p.mastered >= gate.count, soon };
    }
    case 'tier': {
      const p = tierProgress(st, content, gate.tier);
      return { label: `Every ${tierName(gate.tier)} skill mastered`, current: p.mastered, target: p.total, met: p.available && p.mastered === p.total, soon: !p.available };
    }
    case 'skills': {
      const names = gate.skills.map((id) => idx.skillById.get(id)?.name || id);
      const done = gate.skills.filter((id) => idx.activeIds.has(id) && E.isMastered(st, content, id)).length;
      const soon = !gate.skills.every((id) => idx.activeIds.has(id));
      return { label: `${names.join(' + ')} mastered`, current: done, target: gate.skills.length, met: done === gate.skills.length, soon };
    }
    case 'cases': {
      const total = (content.siemCases || []).length;
      const solved = solvedCases(st, content);
      return { label: `${gate.count} SIEM investigation${gate.count === 1 ? '' : 's'} solved`, current: Math.min(solved, gate.count), target: gate.count, met: solved >= gate.count, soon: total < gate.count };
    }
    case 'scenario': {
      const sc = (content.scenarios || []).find((s) => s.id === gate.id);
      const done = scenarioDone(st, gate.id);
      return { label: `${sc ? sc.title : gate.title || 'Capstone'} completed`, current: done ? 1 : 0, target: 1, met: done, soon: !scenarioExists(content, gate.id) };
    }
    case 'all-tiers': {
      const tiers = tiersOf(content);
      const rows = tiers.map((t) => tierProgress(st, content, t.id));
      const done = rows.filter((p) => p.available && p.mastered === p.total).length;
      return { label: 'Every curriculum level complete', current: done, target: tiers.length, met: done === tiers.length, soon: rows.some((p) => !p.available) };
    }
    default:
      return { label: `Unknown requirement ${gate.type}`, current: 0, target: 1, met: false, soon: true };
  }
}

/** Full requirement list for a rank, XP first. */
export function rankRequirements(rank, game, st, content) {
  const xpRow = { label: `${rank.xp.toLocaleString('en-US')} XP`, current: Math.min(game.xp, rank.xp), target: rank.xp, met: game.xp >= rank.xp, soon: false, xp: true };
  return [...(rank.xp ? [xpRow] : []), ...(rank.gates || []).map((g) => gateRows(g, st, content))];
}

export function gateMet(rank, st, content) {
  return (rank.gates || []).every((g) => gateRows(g, st, content).met);
}

/** Short text for the gates of a rank ("and 5 Level 1 Foundations skills mastered"). */
export function gateText(rank, content, st = null) {
  const gates = rank.gates || [];
  if (!gates.length) return '';
  const rows = gates.map((g) => gateRows(g, st || { skills: {}, siem: {}, capstones: {} }, content));
  return `and ${rows.map((r) => `${r.label}${r.soon ? ' (coming soon)' : ''}`).join(', ')}`;
}

/** Highest rank on the ladder whose XP threshold and gates (and all lower ones) are met. */
export function computeRank(game, st, content) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (game.xp >= r.xp && gateMet(r, st, content)) current = r;
    else break;
  }
  return current;
}

/** The highest rank today's content can reach (all gates that exist are satisfiable). */
export function reachableRank(content, xp = Infinity) {
  let current = RANKS[0];
  for (const r of RANKS) {
    const ok = (r.gates || []).every((g) => {
      if (g.type === 'mastered' || g.type === 'tier') return tierProgress({ skills: {} }, content, g.tier).available && tierSkills(content, g.tier).length >= (g.count || 1);
      if (g.type === 'skills') return g.skills.every((id) => E.indexContent(content).activeIds.has(id));
      if (g.type === 'cases') return (content.siemCases || []).length >= g.count;
      if (g.type === 'scenario') return scenarioExists(content, g.id);
      if (g.type === 'all-tiers') return tiersOf(content).every((t) => tierProgress({ skills: {} }, content, t.id).available);
      return false;
    });
    if (ok && xp >= r.xp) current = r;
    else break;
  }
  return current;
}

export function currentTitle(game) {
  if (game.equippedTitle && availableTitles(game).some((t) => t.id === game.equippedTitle)) {
    return availableTitles(game).find((t) => t.id === game.equippedTitle).title;
  }
  return RANKS[rankIndex(game.rankId)].title;
}

/** Titles the student can equip: every rank reached, titles from earned badges, and titles kept from an older ladder. */
export function availableTitles(game) {
  const ranks = RANKS.slice(0, rankIndex(game.rankId) + 1).map((r) => ({ id: `rank:${r.id}`, title: r.title, source: 'Rank' }));
  const badges = BADGES.filter((b) => b.title && game.badges[b.id]).map((b) => ({ id: `badge:${b.id}`, title: b.title, source: `Badge: ${b.name}` }));
  const have = new Set([...ranks, ...badges].map((t) => t.title));
  const kept = (game.keptTitles || []).filter((t) => !have.has(t)).map((t) => ({ id: `kept:${t}`, title: t, source: 'Earned on the previous ladder' }));
  return [...ranks, ...badges, ...kept];
}

export function unlockedThemes(game) {
  const ri = rankIndex(game.rankId);
  const kept = new Set(game.keptThemes || []);
  return THEMES.filter((t) => rankIndex(t.rank) <= ri || kept.has(t.id));
}

export function equipTitle(game, titleId) {
  if (titleId === null || availableTitles(game).some((t) => t.id === titleId)) {
    game.equippedTitle = titleId;
    return true;
  }
  return false;
}

export function setTheme(game, themeId) {
  if (unlockedThemes(game).some((t) => t.id === themeId)) {
    game.theme = themeId;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ XP core

function diminishingFactor(n) {
  return XP_RULES.diminishing.find((d) => n <= d.upTo).factor;
}

function addLog(game, now, amount, reason) {
  game.log.unshift({ t: now, amount, reason });
  if (game.log.length > 100) game.log.length = 100;
}

/** Adds XP, then updates level, rank and badges. Returns level/rank/badge changes. */
function commit(game, st, content, now, gained, reason) {
  const before = { level: game.level, rankId: game.rankId };
  if (gained > 0) {
    game.xp += gained;
    addLog(game, now, gained, reason);
  }
  game.level = levelForXp(game.xp);
  const rank = computeRank(game, st, content);
  let rankUp = null;
  if (rankIndex(rank.id) > rankIndex(game.rankId)) {
    game.rankId = rank.id;
    rankUp = { rank, themes: THEMES.filter((t) => t.rank === rank.id) };
  }
  const badges = checkBadges(game, st, content, now);
  return { levelUp: game.level > before.level ? { from: before.level, to: game.level } : null, rankUp, badges };
}

/** Awards any badges whose conditions are now met. Returns the newly earned badge definitions. */
export function checkBadges(game, st, content, now) {
  const earned = [];
  for (const b of BADGES) {
    if (game.badges[b.id]) continue;
    const p = b.progress(game, st, content);
    if (p.target > 0 && p.current >= p.target) {
      game.badges[b.id] = { earnedAt: now };
      earned.push(b);
    }
  }
  return earned;
}

export function badgeProgress(game, st, content) {
  return BADGES.map((b) => ({ ...b, earned: game.badges[b.id] || null, progress: b.progress(game, st, content) }));
}

/** Number of review items currently due (call after recordAnswer). */
export function dueCount(st) {
  return st.reviewQueue.filter((r) => r.dueTurn <= st.turn).length;
}

/**
 * Call after engine.recordAnswer.
 * ev: { item, correct, mode, events (engine result events), wasMastered (before answering),
 *       dueAfter (review items due after answering), confidence ('sure' | 'unsure' | undefined), now }
 * Returns { xp, breakdown: [{ label, amount }], levelUp, rankUp, badges, streak }.
 */
export function onAnswer(game, st, content, ev) {
  const { item, correct, mode, events = [], wasMastered = false, dueAfter = null, confidence, now } = ev;
  const c = game.counters;
  const today = dayKey(now);
  const breakdown = [];
  const add = (label, amount) => amount > 0 && breakdown.push({ label, amount: Math.round(amount) });

  const streak = touchStreak(game, now);
  if (game.daily.day !== today) game.daily = { day: today, perSkill: {}, reviewBonusDay: game.daily.reviewBonusDay };

  // ---- counters
  c.answers += 1;
  const hour = new Date(now).getHours();
  if (hour >= 22 || hour < 4) c.nightShift += 1;
  if (hour >= 5 && hour < 7) c.earlyBird += 1;
  if (correct) {
    c.correct += 1;
    c.run += 1;
    c.bestRun = Math.max(c.bestRun, c.run);
    if (item.snippet) c.scenarioCorrect += 1;
    if (item.difficulty === 3) c.hardCorrect += 1;
    if (item.type === 'text') c.typedCorrect += 1;
  } else {
    c.run = 0;
  }
  if (item.skill === 'net-subnet') {
    c.subnetRun = correct ? c.subnetRun + 1 : 0;
    c.subnetBest = Math.max(c.subnetBest, c.subnetRun);
  }
  if (confidence === 'sure') {
    c.sureTotal += 1;
    if (correct) c.sureCorrect += 1;
  }

  // ---- answer XP
  if (mode === 'placement') {
    add(correct ? 'Placement answer' : 'Placement attempt', correct ? XP_RULES.placementCorrect : XP_RULES.placementAttempt);
  } else {
    const n = (game.daily.perSkill[item.skill] = (game.daily.perSkill[item.skill] || 0) + 1);
    const factor = diminishingFactor(n);
    let base;
    let label;
    if (correct) {
      base = XP_RULES.correct[item.difficulty] || XP_RULES.correct[1];
      label = `Correct (difficulty ${item.difficulty})`;
      if (item.type === 'text') base += XP_RULES.typedBonus;
      if (wasMastered) {
        base = item.difficulty === 1 ? XP_RULES.masteredEasy : base * XP_RULES.masteredRepeatFactor;
        label += ', skill already mastered';
      }
      if (mode === 'review') {
        base += XP_RULES.reviewCorrect;
        label = `Missed question now right (difficulty ${item.difficulty})`;
      }
      if (factor < 1) label += `, ×${factor} (${n} in this skill today)`;
      add(label, base * factor);
    } else {
      add('Attempt', Math.max(1, XP_RULES.attempt * factor));
    }
    if (confidence === 'sure' && correct) add('Sure and right', XP_RULES.sureCorrect);
  }

  // ---- milestone XP from engine events
  for (const e of events) {
    if (e.type === 'review-cleared') {
      c.reviewCleared += 1;
      add('Cleared from review list', XP_RULES.reviewCleared);
    } else if (e.type === 'mastered' && !game.masteredOnce[e.skillId]) {
      game.masteredOnce[e.skillId] = now;
      const ss = st.skills[e.skillId];
      if (ss && ss.correct === ss.attempts) c.cleanMasteries += 1;
      add('Skill mastered', XP_RULES.skillMastered);
    } else if (e.type === 'misconception-resolved') {
      c.misconceptionsResolved += 1;
      add('Misconception resolved', XP_RULES.misconceptionResolved);
    } else if (e.type === 'gap-resolved') {
      c.gapsClosed += 1;
      add('Root gap closed', XP_RULES.rootGapClosed);
    } else if (e.type === 'gap-found') {
      // A gap whose "needed for" skill is itself an open gap = two building blocks deep.
      const g = st.gaps[e.skillId];
      if (g && g.from.some((f) => st.gaps[f] && !st.gaps[f].resolved)) c.deepGaps += 1;
    }
  }

  if (mode === 'daily' && dueAfter === 0 && game.daily.reviewBonusDay !== today) {
    game.daily.reviewBonusDay = today;
    c.dailyReviews += 1;
    add("Today's due reviews complete", XP_RULES.dailyReviewComplete);
  }

  const xp = breakdown.reduce((a, b) => a + b.amount, 0);
  const changes = commit(game, st, content, now, xp, `${item.id}: ${breakdown.map((b) => b.label).join(' + ') || 'no XP'}`);
  return { xp, breakdown, streak, ...changes };
}

/**
 * Learning events from lessons and misconception follow-ups.
 * type: 'lesson-complete' | 'worked-example' | 'faded-example' | 'misconception-resolved'
 */
export function onLearningEvent(game, st, content, { type, now }) {
  const map = {
    'lesson-complete': ['Lesson complete', XP_RULES.lessonCompleted],
    'worked-example': ['Worked example', XP_RULES.workedExample],
    'faded-example': ['Faded example solved', XP_RULES.fadedExample],
    'misconception-resolved': ['Misconception resolved', XP_RULES.misconceptionResolved],
  };
  const [label, amount] = map[type] || [null, 0];
  if (!label) throw new Error(`Unknown learning event ${type}`);
  const streak = touchStreak(game, now);
  if (type === 'lesson-complete') game.counters.lessonsCompleted += 1;
  if (type === 'misconception-resolved') game.counters.misconceptionsResolved += 1;
  const changes = commit(game, st, content, now, amount, label);
  return { xp: amount, breakdown: [{ label, amount }], streak, ...changes };
}

/** Call when the placement check ends. */
export function onPlacementDone(game, st, content, placement, now) {
  if (placement && placement.queue.length && placement.index >= placement.queue.length && placement.correct === placement.queue.length) {
    game.counters.placementPerfect += 1;
  }
  return commit(game, st, content, now, 0, 'Placement complete');
}

// ------------------------------------------------------------------ operations (SIEM + capstone)

/**
 * Call after siem.recordCase. XP = case rate × score, but only for improvement on the best
 * score already paid, so replaying a solved case can't be farmed. A wrong verdict pays only a
 * quarter of the score: the reward is for good investigation, not for clicking through.
 * ev: { caseDef, result (siem.scoreCase), firstSolve, now }
 */
export function onInvestigation(game, st, content, { caseDef, result, firstSolve = false, now }) {
  const streak = touchStreak(game, now);
  const rec = (st.siem.cases[caseDef.id] ??= { attempts: 0, best: 0, solved: false });
  const effective = result.passed ? result.total : Math.round(result.total * 0.25);
  const paid = rec.paid || 0;
  const rate = XP_RULES.siemCase[caseDef.difficulty] || XP_RULES.siemCase[1];
  const breakdown = [];
  if (effective > paid) {
    rec.paid = effective;
    const amount = Math.round((rate * (effective - paid)) / 100);
    if (amount > 0) breakdown.push({ label: paid ? `Case improved (${paid} → ${effective})` : `Case score ${result.total}${result.passed ? '' : result.verdict.correct || result.verdict.defensible ? ', below the pass mark (×0.25)' : ', wrong call (×0.25)'}`, amount });
  }
  const c = game.counters;
  if (firstSolve) {
    c.casesSolved += 1;
    if (result.verdict.given && result.verdict.given !== 'tp') c.benignCleared += 1;
  }
  if (caseDef.ambiguous && result.passed && result.total >= 80 && result.confidence.note === 'calibrated' && !result.steps.bad.length && !rec.calibrated) {
    rec.calibrated = true;
    c.calibratedCalls += 1;
  }
  if (result.passed && result.evidence.perfect && !rec.perfect) {
    rec.perfect = true;
    c.perfectEvidence += 1;
  }
  const xp = breakdown.reduce((a, b) => a + b.amount, 0);
  const changes = commit(game, st, content, now, xp, `${caseDef.id}: ${breakdown.map((b) => b.label).join(' + ') || 'no new XP'}`);
  return { xp, breakdown, streak, ...changes };
}

/** Call after capstone.recordStage. XP = stage rate × improvement on the best stage score. */
/** Per-scenario XP rates: a capstone may override the defaults with `xp: { stage, report }`. */
export const capstoneRates = (sc) => ({ stage: sc?.xp?.stage ?? XP_RULES.capstoneStage, report: sc?.xp?.report ?? XP_RULES.escalation });

export function onCapstoneStage(game, st, content, { stage, result, now, scenario }) {
  const streak = touchStreak(game, now);
  const gain = Math.max(0, result.best - result.prevBest);
  const amount = Math.round((capstoneRates(scenario).stage * gain) / 100);
  const breakdown = amount > 0 ? [{ label: `Stage "${stage.title}" ${result.score}%`, amount }] : [];
  const changes = commit(game, st, content, now, amount, `${stage.id}: ${breakdown.map((b) => b.label).join('') || 'no new XP'}`);
  return { xp: amount, breakdown, streak, ...changes };
}

/** Call after capstone.recordEscalation. XP = escalation rate × improvement on the best rubric score. */
export function onEscalation(game, st, content, { scenario, result, now }) {
  const streak = touchStreak(game, now);
  const gain = Math.max(0, result.best - result.prevBest);
  const amount = Math.round((capstoneRates(scenario).report * gain) / 100);
  const c = game.counters;
  if (result.firstCompletion) c.capstonesDone += 1;
  if (result.total >= 85 && result.prevBest < 85) c.cleanHandoffs += 1;
  const breakdown = amount > 0 ? [{ label: `${scenario.escalation?.ui?.title || 'Escalation report'} ${result.total}/100`, amount }] : [];
  const changes = commit(game, st, content, now, amount, `${scenario.id} escalation: ${breakdown.map((b) => b.label).join('') || 'no new XP'}`);
  return { xp: amount, breakdown, streak, ...changes };
}

// ------------------------------------------------------------------ XP budget

/** Assumed extra from a month of daily reviews: the daily bonus plus ~10 review answers at ~7 XP. */
export const MONTH_OF_REVIEWS = 30 * (XP_RULES.dailyReviewComplete + 10 * 7);

/**
 * Realistic maximum XP from the content that exists today, done once and well:
 * every active question right once (with the typed bonus and a "Sure"), every skill mastered,
 * every lesson with its worked and faded examples, every misconception resolved once,
 * every SIEM case at 100% and the capstone at 100%. Root-gap and review XP vary per student and
 * are left out of `total`; `withMonth` adds MONTH_OF_REVIEWS.
 */
export function xpBudget(content) {
  const idx = E.indexContent(content);
  const items = content.items.filter((i) => idx.activeIds.has(i.skill));
  const answers = items.reduce((a, i) => a + (XP_RULES.correct[i.difficulty] || XP_RULES.correct[1]) + (i.type === 'text' ? XP_RULES.typedBonus : 0) + XP_RULES.sureCorrect, 0);
  const mastery = idx.activeSkills.length * XP_RULES.skillMastered;
  const lessons = (content.lessons || [])
    .filter((l) => idx.activeIds.has(l.skill))
    .reduce((a, l) => a + XP_RULES.lessonCompleted + (l.worked || []).length * XP_RULES.workedExample + (l.faded || []).length * XP_RULES.fadedExample, 0);
  const misconceptions = (content.misconceptions || []).length * XP_RULES.misconceptionResolved;
  const siem = (content.siemCases || []).reduce((a, c) => a + (XP_RULES.siemCase[c.difficulty] || XP_RULES.siemCase[1]), 0);
  const capstone = (content.scenarios || [])
    .filter((s) => s.kind === 'capstone' && s.status !== 'in-development')
    .reduce((a, s) => a + s.stages.length * capstoneRates(s).stage + (s.escalation ? capstoneRates(s).report : 0), 0);
  const foundations = answers + mastery + lessons + misconceptions;
  const operations = siem + capstone;
  const total = foundations + operations;
  const withMonth = total + MONTH_OF_REVIEWS;
  const at = (xp) => {
    const rank = reachableRank(content, xp);
    return { xp, level: levelForXp(xp), rank, rankIndex: rankIndex(rank.id), ladderPct: Math.round((rankIndex(rank.id) / (RANKS.length - 1)) * 100) };
  };
  return { items: items.length, answers, mastery, lessons, misconceptions, siem, capstone, foundations, operations, total, withMonth, atTotal: at(total), atMonth: at(withMonth) };
}

// ------------------------------------------------------------------ migration helper

/**
 * Builds a game profile for a student who already has progress (state v1), granting XP
 * for past answers and milestones. Past answers are credited at face value (no
 * diminishing returns or mastered-skill reductions, since we don't know when they happened);
 * streaks start fresh because v1 history has no dates.
 */
export function retroGame(st, content, now) {
  const game = createGame();
  const idx = E.indexContent(content);
  const c = game.counters;
  let xp = 0;
  let answers = 0;
  for (const h of st.history || []) {
    const item = idx.itemById.get(h.itemId);
    if (!item) continue;
    answers += 1;
    c.answers += 1;
    if (h.mode === 'placement') {
      xp += h.correct ? XP_RULES.placementCorrect : XP_RULES.placementAttempt;
    } else if (h.correct) {
      xp += (XP_RULES.correct[item.difficulty] || 10) + (item.type === 'text' ? XP_RULES.typedBonus : 0);
    } else {
      xp += XP_RULES.attempt;
    }
    if (h.correct) {
      c.correct += 1;
      c.run += 1;
      c.bestRun = Math.max(c.bestRun, c.run);
      if (item.snippet) c.scenarioCorrect += 1;
      if (item.difficulty === 3) c.hardCorrect += 1;
      if (item.type === 'text') c.typedCorrect += 1;
    } else {
      c.run = 0;
    }
    if (item.skill === 'net-subnet') {
      c.subnetRun = h.correct ? c.subnetRun + 1 : 0;
      c.subnetBest = Math.max(c.subnetBest, c.subnetRun);
    }
  }
  for (const s of idx.activeSkills) {
    if (E.isMastered(st, content, s.id)) {
      game.masteredOnce[s.id] = now;
      xp += XP_RULES.skillMastered;
    }
  }
  for (const g of Object.values(st.gaps || {})) {
    if (g.resolved) {
      c.gapsClosed += 1;
      xp += XP_RULES.rootGapClosed;
    }
  }
  if (xp > 0) {
    game.xp = xp;
    addLog(game, now, xp, `Credit for ${answers} earlier answers and milestones`);
  }
  game.level = levelForXp(game.xp);
  game.rankId = computeRank(game, st, content).id;
  const badges = checkBadges(game, st, content, now);
  for (const b of badges) game.badges[b.id].retro = true;
  return game;
}

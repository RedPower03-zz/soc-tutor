import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import { migrateState, CURRENT_VERSION } from '../js/migrate.js';
import { CONTENT } from '../content/index.js';

// ---- fake clock (local time) ----
const at = (y, mo, d, h = 14, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const DAY1 = at(2026, 9, 28); // a Monday afternoon

const idx = E.indexContent(CONTENT);
const itemOf = (skill, difficulty, type) =>
  CONTENT.items.find((i) => i.skill === skill && (!difficulty || i.difficulty === difficulty) && (!type || i.type === type));
const fresh = () => {
  const st = E.createState(CONTENT);
  return { st, game: G.createGame() };
};
const master = (st, id) => Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
const answer = (game, st, item, correct, extra = {}) =>
  G.onAnswer(game, st, CONTENT, { item, correct, mode: 'learn', events: [], now: DAY1, ...extra });

// ------------------------------------------------------------------ XP rules

test('correct answers earn XP scaled by difficulty; typed answers earn a bonus', () => {
  const { st, game } = fresh();
  const mcItems = [1, 2, 3].map((d) => CONTENT.items.find((i) => i.difficulty === d && i.type === 'mc'));
  const gains = mcItems.map((it) => answer(game, st, it, true).xp);
  assert.deepEqual(gains, [G.XP_RULES.correct[1], G.XP_RULES.correct[2], G.XP_RULES.correct[3]]);
  const typed = CONTENT.items.find((i) => i.type === 'text' && i.difficulty === 2 && i.skill !== mcItems[1].skill);
  assert.equal(answer(game, st, typed, true).xp, G.XP_RULES.correct[2] + G.XP_RULES.typedBonus);
});

test('wrong answers earn a small XP for the attempt and never reduce XP', () => {
  const { st, game } = fresh();
  answer(game, st, itemOf('net-osi', 1), true);
  const before = game.xp;
  const r = answer(game, st, itemOf('net-osi', 2), false);
  assert.equal(r.xp, G.XP_RULES.attempt);
  assert.equal(game.xp, before + G.XP_RULES.attempt);
});

test('easy questions in an already-mastered skill earn nothing; harder ones earn half', () => {
  const { st, game } = fresh();
  assert.equal(answer(game, st, itemOf('net-osi', 1, 'mc'), true, { wasMastered: true }).xp, 0);
  assert.equal(answer(game, st, itemOf('net-osi', 3, 'mc'), true, { wasMastered: true }).xp, Math.round(G.XP_RULES.correct[3] * 0.5));
});

test('grinding one skill on the same day has diminishing returns, reset the next day', () => {
  const { st, game } = fresh();
  const it = itemOf('net-ports', 2, 'mc');
  const gains = [];
  for (let i = 0; i < 32; i++) gains.push(answer(game, st, it, true).xp);
  assert.equal(gains[0], 15);
  assert.equal(gains[14], 15, 'answer 15 still full');
  assert.equal(gains[15], 8, 'answer 16 is halved (7.5 rounds to 8)');
  assert.equal(gains[31], 4, 'answer 32 is quartered');
  // another skill is unaffected
  assert.equal(answer(game, st, itemOf('net-dns', 2, 'mc'), true).xp, 15);
  // next day resets
  assert.equal(answer(game, st, it, true, { now: DAY1 + 86400000 }).xp, 15);
});

test('learning milestones: review recovery, clearing, mastery (once), root gap closed', () => {
  const { st, game } = fresh();
  const it = itemOf('net-ip', 2, 'mc');
  let r = answer(game, st, it, true, { mode: 'review' });
  assert.equal(r.xp, 15 + G.XP_RULES.reviewCorrect);
  r = answer(game, st, it, true, { mode: 'review', events: [{ type: 'review-cleared' }] });
  assert.ok(r.breakdown.some((b) => b.label === 'Cleared from review list' && b.amount === G.XP_RULES.reviewCleared));
  master(st, 'net-ip');
  r = answer(game, st, it, true, { events: [{ type: 'mastered', skillId: 'net-ip' }] });
  assert.ok(r.breakdown.some((b) => b.amount === G.XP_RULES.skillMastered));
  r = answer(game, st, it, true, { events: [{ type: 'mastered', skillId: 'net-ip' }] });
  assert.ok(!r.breakdown.some((b) => b.amount === G.XP_RULES.skillMastered), 'mastery XP only the first time');
  r = answer(game, st, it, true, { events: [{ type: 'gap-resolved', skillId: 'net-ip' }] });
  assert.ok(r.breakdown.some((b) => b.amount === G.XP_RULES.rootGapClosed));
});

test('daily review bonus: once per day, only when the due reviews are finished', () => {
  const { st, game } = fresh();
  const it = itemOf('net-dns', 2, 'mc');
  const bonus = (r) => r.breakdown.some((b) => b.amount === G.XP_RULES.dailyReviewComplete);
  assert.equal(bonus(answer(game, st, it, true, { mode: 'daily', dueAfter: 2 })), false, 'still items due');
  assert.equal(bonus(answer(game, st, it, true, { mode: 'learn', dueAfter: 0 })), false, 'not the daily review');
  assert.equal(bonus(answer(game, st, it, true, { mode: 'daily', dueAfter: 0 })), true);
  assert.equal(bonus(answer(game, st, it, true, { mode: 'daily', dueAfter: 0 })), false, 'only once a day');
  assert.equal(bonus(answer(game, st, it, true, { mode: 'daily', dueAfter: 0, now: DAY1 + 86400000 })), true, 'again tomorrow');
});

test('confidence: "Sure" and right earns a calibration bonus; wrong "Sure" earns only the attempt', () => {
  const { st, game } = fresh();
  const it = itemOf('host-users', 2, 'mc');
  assert.equal(answer(game, st, it, true, { confidence: 'sure' }).xp, 15 + G.XP_RULES.sureCorrect);
  assert.equal(answer(game, st, it, false, { confidence: 'sure' }).xp, G.XP_RULES.attempt);
  assert.equal(answer(game, st, it, true, { confidence: 'unsure' }).xp, 15);
  assert.deepEqual([game.counters.sureTotal, game.counters.sureCorrect], [2, 1]);
});

test('lesson and misconception events use the XP table', () => {
  const { st, game } = fresh();
  for (const [type, key] of [['lesson-complete', 'lessonCompleted'], ['worked-example', 'workedExample'], ['faded-example', 'fadedExample'], ['misconception-resolved', 'misconceptionResolved']]) {
    assert.equal(G.onLearningEvent(game, st, CONTENT, { type, now: DAY1 }).xp, G.XP_RULES[key]);
  }
  assert.throws(() => G.onLearningEvent(game, st, CONTENT, { type: 'nope', now: DAY1 }));
});

// ------------------------------------------------------------------ levels & ranks

test('level curve: 10·(L−1)^2.25, fast early levels, capped at MAX_LEVEL', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(G.levelThreshold), [0, 10, 50, 120, 225]);
  assert.equal(G.levelForXp(0), 1);
  assert.equal(G.levelForXp(9), 1);
  assert.equal(G.levelForXp(10), 2);
  assert.equal(G.levelForXp(224), 4);
  assert.equal(G.levelForXp(225), 5);
  assert.equal(G.levelForXp(1e9), G.MAX_LEVEL);
  for (let L = 2; L <= G.MAX_LEVEL; L++) {
    assert.ok(G.levelThreshold(L) > G.levelThreshold(L - 1), `level ${L} must cost more than ${L - 1}`);
    assert.ok(G.levelThreshold(L + 1) - G.levelThreshold(L) >= G.levelThreshold(L) - G.levelThreshold(L - 1), `gap to ${L + 1} shrinks`);
  }
});

test('rank ladder: XP thresholds plus data-driven gates (mastery, cases, capstone, tiers)', () => {
  const { st, game } = fresh();
  const rank = () => G.computeRank(game, st, CONTENT).id;
  assert.equal(rank(), 'trainee');
  game.xp = 249;
  assert.equal(rank(), 'trainee');
  game.xp = 250;
  assert.equal(rank(), 'junior-1');
  game.xp = 1500;
  assert.equal(rank(), 'junior-1', 'Junior Analyst II needs 2 mastered skills');
  ['host-processes', 'host-users', 'host-filesystem', 'net-osi'].forEach((id) => master(st, id));
  assert.equal(rank(), 'junior-2', 'Tier 1 Analyst I needs 5 mastered skills');
  master(st, 'net-ip');
  assert.equal(rank(), 'tier1-1');
  game.xp = 99999;
  idx.activeSkills.filter((s) => (s.level ?? 1) === 1).forEach((s) => master(st, s.id));
  assert.equal(rank(), 'tier1-1', 'Tier 1 Analyst II also needs a solved SIEM case');
  st.siem.cases['siem-rdp-brute'] = { solved: true };
  assert.equal(rank(), 'tier1-2');
  st.siem.cases['siem-certutil'] = { solved: true };
  st.siem.cases['siem-scanner'] = { solved: true };
  assert.equal(rank(), 'tier1-2', 'Tier 1 Analyst III also needs the First shift capstone');
  st.capstones['first-shift'] = { completedAt: DAY1 };
  assert.equal(rank(), 'tier1-3', 'Tier 2 Analyst I needs Level 2 mastery');
  const l2 = idx.activeSkills.filter((s) => s.level === 2).map((s) => s.id);
  l2.slice(0, 2).forEach((id) => master(st, id));
  assert.equal(rank(), 'tier2-1');
  l2.forEach((id) => master(st, id));
  assert.equal(rank(), 'tier2-3', 'Senior Analyst I also needs the Night-shift lead capstone');
  st.capstones['night-shift-lead'] = { completedAt: DAY1 };
  assert.equal(rank(), 'senior-1');
  if (CONTENT.tiers.find((t) => t.id === 'l3').status !== 'available') {
    assert.equal(rank(), G.reachableRank(CONTENT).id, 'nothing above is reachable until Level 3 exists');
    assert.match(G.gateText(G.RANKS.find((r) => r.id === 'senior-2'), CONTENT), /coming soon/);
  }
});

test('rank-ups are reported once and unlock themes; titles and themes can be equipped only when earned', () => {
  const { st, game } = fresh();
  assert.equal(G.setTheme(game, 'amber'), false);
  game.xp = 240;
  const r = answer(game, st, itemOf('net-osi', 2, 'mc'), true);
  assert.equal(r.rankUp?.rank.id, 'junior-1');
  assert.deepEqual(r.rankUp.themes, []);
  assert.equal(answer(game, st, itemOf('net-osi', 1, 'mc'), true).rankUp, null);
  master(st, 'host-processes');
  master(st, 'host-users');
  game.xp = 690;
  const r2 = answer(game, st, itemOf('net-osi', 2, 'mc'), true);
  assert.equal(r2.rankUp?.rank.id, 'junior-2');
  assert.deepEqual(r2.rankUp.themes.map((t) => t.id), ['amber']);
  assert.equal(G.setTheme(game, 'amber'), true);
  assert.equal(G.setTheme(game, 'red'), false);
  assert.equal(G.currentTitle(game), 'Junior Analyst II');
  assert.equal(G.equipTitle(game, 'rank:junior-1'), true);
  assert.equal(G.currentTitle(game), 'Junior Analyst I');
  assert.equal(G.equipTitle(game, 'rank:tier1-1'), false, 'rank not reached yet');
  assert.equal(G.equipTitle(game, 'badge:packet-whisperer'), false, 'badge title not earned yet');
});

test('level-up is reported when crossing a threshold', () => {
  const { st, game } = fresh();
  game.xp = 0;
  game.level = 1;
  const r = answer(game, st, itemOf('net-osi', 2, 'mc'), true);
  assert.deepEqual(r.levelUp, { from: 1, to: 2 });
});

// ------------------------------------------------------------------ badges

test('badge catalogue: 25–35 badges with unique ids, descriptions and some secrets', () => {
  assert.ok(G.BADGES.length >= 25 && G.BADGES.length <= 35, `${G.BADGES.length} badges`);
  assert.equal(new Set(G.BADGES.map((b) => b.id)).size, G.BADGES.length);
  for (const b of G.BADGES) assert.ok(b.name && b.description && b.icon && typeof b.progress === 'function', b.id);
  assert.ok(G.BADGES.filter((b) => b.hidden).length >= 3);
  const { st, game } = fresh();
  for (const p of G.badgeProgress(game, st, CONTENT)) {
    assert.ok(p.progress.target > 0 && p.progress.current >= 0, p.id);
    assert.equal(p.earned, null);
  }
});

test('First Blood on the first correct answer (not on a wrong one)', () => {
  const { st, game } = fresh();
  assert.deepEqual(answer(game, st, itemOf('net-osi', 1), false).badges, []);
  assert.deepEqual(answer(game, st, itemOf('net-osi', 1), true).badges.map((b) => b.id), ['first-blood']);
  assert.ok(game.badges['first-blood'].earnedAt === DAY1);
});

test('Subnet Sniper needs 10 subnetting answers right in a row; a miss resets the run', () => {
  const { st, game } = fresh();
  const it = itemOf('net-subnet', 2);
  for (let i = 0; i < 9; i++) answer(game, st, it, true);
  answer(game, st, it, false);
  assert.equal(game.badges['subnet-sniper'], undefined);
  let earned = [];
  for (let i = 0; i < 10; i++) earned = earned.concat(answer(game, st, it, true).badges.map((b) => b.id));
  assert.ok(earned.includes('subnet-sniper'));
});

test('volume badges: Sharpshooter, Log Diver, Hard Target, Total Recall, Centurion', () => {
  const { st, game } = fresh();
  const earnedIds = () => Object.keys(game.badges);
  const hard = CONTENT.items.filter((i) => i.difficulty === 3 && i.type === 'mc');
  const typed = CONTENT.items.filter((i) => i.type === 'text');
  const scen = CONTENT.items.filter((i) => i.snippet);
  // 9 in a row, a miss, then 10 in a row -> Sharpshooter only after the 10th
  for (let i = 0; i < 9; i++) answer(game, st, hard[i % hard.length], true);
  answer(game, st, hard[0], false);
  assert.ok(!earnedIds().includes('sharpshooter'));
  for (let i = 0; i < 10; i++) answer(game, st, hard[i % hard.length], true);
  assert.ok(earnedIds().includes('sharpshooter'));
  assert.ok(earnedIds().includes('hard-target'), '19 hard correct answers');
  assert.ok(!earnedIds().includes('total-recall'));
  for (let i = 0; i < 15; i++) answer(game, st, typed[i % typed.length], true);
  assert.ok(earnedIds().includes('total-recall'));
  const scenBefore = game.counters.scenarioCorrect;
  for (let i = 0; scenBefore + i < 25; i++) answer(game, st, scen[i % scen.length], true);
  assert.ok(earnedIds().includes('log-diver'));
  assert.ok(!earnedIds().includes('centurion'));
  while (game.counters.correct < 99) answer(game, st, hard[0], true);
  assert.ok(!earnedIds().includes('centurion'));
  const r = answer(game, st, hard[0], true);
  assert.ok(r.badges.some((b) => b.id === 'centurion'));
});

test('On Watch I/II/III at 3, 7 and 30 study days in a row; secret Grace Under Fire when a grace day saves the streak', () => {
  const { st, game } = fresh();
  const it = itemOf('net-osi', 1);
  const day = (n) => at(2026, 9, 28 + n); // Date() normalises day overflow into later months
  for (let n = 0; n < 3; n++) answer(game, st, it, true, { now: day(n) });
  assert.ok(game.badges['on-watch-1']);
  assert.ok(!game.badges['on-watch-2']);
  for (let n = 3; n < 7; n++) answer(game, st, it, true, { now: day(n) });
  assert.ok(game.badges['on-watch-2']);
  assert.ok(!game.badges['grace-under-fire']);
  // skip day 7; a banked grace day covers it
  answer(game, st, it, true, { now: day(8) });
  assert.equal(game.streak.current, 8);
  assert.ok(game.badges['grace-under-fire']);
  for (let n = 9; n < 31; n++) answer(game, st, it, true, { now: day(n) });
  assert.equal(game.streak.current, 30);
  assert.ok(game.badges['on-watch-3']);
  assert.ok(G.availableTitles(game).some((t) => t.title === 'Watch Commander'));
});

test('Night Shift after 10 PM; secret Dawn Patrol between 5 and 7 AM', () => {
  const { st, game } = fresh();
  answer(game, st, itemOf('net-osi', 1), true, { now: at(2026, 9, 28, 21, 59) });
  assert.equal(game.badges['night-shift'], undefined);
  const r = answer(game, st, itemOf('net-osi', 1), false, { now: at(2026, 9, 28, 22, 5) });
  assert.ok(r.badges.some((b) => b.id === 'night-shift'));
  answer(game, st, itemOf('net-osi', 1), false, { now: at(2026, 9, 29, 5, 30) });
  assert.ok(game.badges['dawn-patrol']);
});

test('Calibrated: 80%+ of 20+ "Sure" answers correct', () => {
  const { st, game } = fresh();
  const it = itemOf('net-dns', 2);
  for (let i = 0; i < 15; i++) answer(game, st, it, true, { confidence: 'sure' });
  for (let i = 0; i < 4; i++) answer(game, st, it, false, { confidence: 'sure' });
  assert.equal(game.badges.calibrated, undefined, 'only 19 Sure answers');
  answer(game, st, it, false, { confidence: 'sure' }); // 15/20 = 75%
  assert.equal(game.badges.calibrated, undefined, '75% is not enough');
  answer(game, st, it, true, { confidence: 'sure' }); // 16/21 = 76%
  for (let i = 0; i < 4; i++) answer(game, st, it, true, { confidence: 'sure' }); // 20/25 = 80%
  assert.ok(game.badges.calibrated);
});

test('Myth Buster after 5 resolved misconceptions', () => {
  const { st, game } = fresh();
  for (let i = 0; i < 4; i++) G.onLearningEvent(game, st, CONTENT, { type: 'misconception-resolved', now: DAY1 });
  assert.equal(game.badges['myth-buster'], undefined);
  const r = G.onLearningEvent(game, st, CONTENT, { type: 'misconception-resolved', now: DAY1 });
  assert.ok(r.badges.some((b) => b.id === 'myth-buster'));
});

test('mastery badges: Certified, Quick Study, Host Hardened, Packet Whisperer, Foundation Laid', () => {
  const { st, game } = fresh();
  const hosts = idx.activeSkills.filter((s) => s.track === 'host').map((s) => s.id);
  hosts.slice(0, -1).forEach((id) => master(st, id));
  answer(game, st, itemOf('net-osi', 1), true, { events: [{ type: 'mastered', skillId: hosts[0] }] });
  assert.ok(game.badges.certified);
  assert.ok(game.badges['quick-study'], 'mastered with no misses (6/6)');
  assert.equal(game.badges['host-hardened'], undefined);
  master(st, hosts.at(-1));
  answer(game, st, itemOf('net-osi', 1), true);
  assert.ok(game.badges['host-hardened']);
  assert.equal(game.badges['packet-whisperer'], undefined);
  idx.activeSkills.forEach((s) => master(st, s.id));
  answer(game, st, itemOf('net-osi', 1), true);
  assert.ok(game.badges['packet-whisperer'] && game.badges.foundation);
});

test('Gap Closer, Second Look and Daily Duty (daily review sessions) come from engine events', () => {
  const { st, game } = fresh();
  const it = itemOf('net-ip', 2);
  answer(game, st, it, true, { events: [{ type: 'gap-resolved', skillId: 'net-ip' }] });
  assert.ok(game.badges['gap-closer']);
  for (let i = 0; i < 10; i++) answer(game, st, it, true, { mode: 'review', events: [{ type: 'review-cleared' }] });
  assert.ok(game.badges['second-look']);
  for (let d = 0; d < 5; d++) answer(game, st, it, true, { mode: 'daily', dueAfter: 0, now: DAY1 + d * 86400000 });
  assert.ok(game.badges['daily-duty']);
});

test('secret Root Cause: a gap found under another open gap', () => {
  const { st, game } = fresh();
  st.gaps['net-subnet'] = { from: ['net-fw-logs'], turn: 1, resolved: false };
  st.gaps['net-ip'] = { from: ['net-subnet'], turn: 2, resolved: false };
  const r = answer(game, st, itemOf('net-ip', 1), false, { events: [{ type: 'gap-found', skillId: 'net-ip' }] });
  assert.ok(r.badges.some((b) => b.id === 'root-cause'));
});

test('secret Overqualified: every placement question right', () => {
  const { st, game } = fresh();
  E.startPlacement(st, CONTENT, { rng: () => 0 });
  st.placement.index = st.placement.queue.length;
  st.placement.correct = st.placement.queue.length - 1;
  G.onPlacementDone(game, st, CONTENT, st.placement, DAY1);
  assert.equal(game.badges.overqualified, undefined);
  st.placement.correct = st.placement.queue.length;
  assert.ok(G.onPlacementDone(game, st, CONTENT, st.placement, DAY1).badges.some((b) => b.id === 'overqualified'));
});

// ------------------------------------------------------------------ streaks

test('streak: counts consecutive study days, ignores repeat visits on the same day', () => {
  const game = G.createGame();
  G.touchStreak(game, DAY1);
  G.touchStreak(game, DAY1 + 3600000);
  assert.equal(game.streak.current, 1);
  G.touchStreak(game, at(2026, 9, 29, 8));
  G.touchStreak(game, at(2026, 9, 30, 23, 30));
  assert.equal(game.streak.current, 3);
  assert.equal(game.streak.best, 3);
});

test('streak: one grace day is banked per week and covers a missed day', () => {
  const game = G.createGame();
  G.touchStreak(game, at(2026, 9, 28)); // Monday: first study of the week banks a grace day
  assert.equal(game.streak.freezes, 1);
  G.touchStreak(game, at(2026, 9, 29));
  assert.equal(game.streak.freezes, 1, 'only one per week');
  const ev = G.touchStreak(game, at(2026, 10, 1)); // skipped Wednesday
  assert.ok(ev.some((e) => e.type === 'freeze-used'));
  assert.equal(game.streak.current, 3);
  assert.equal(game.streak.freezes, 0);
  assert.equal(game.streak.freezesUsed, 1);
  assert.ok(G.checkBadges(game, E.createState(CONTENT), CONTENT, DAY1).some((b) => b.id === 'grace-under-fire'));
});

test('streak: missing more days than banked grace days starts a fresh streak (no penalty)', () => {
  const game = G.createGame();
  G.touchStreak(game, at(2026, 9, 28));
  G.touchStreak(game, at(2026, 9, 29));
  const ev = G.touchStreak(game, at(2026, 10, 2)); // missed Wed + Thu, only 1 grace day
  assert.equal(game.streak.current, 1);
  assert.equal(game.streak.best, 2, 'best streak is kept');
  assert.match(ev.find((e) => e.type === 'streak-started').text, /Welcome back/);
  assert.equal(game.streak.freezes, 1, 'the unused grace day is kept');
});

test('streak: grace days cap at 2 and a 30-day streak survives the DST change', () => {
  const game = G.createGame();
  let t = at(2026, 10, 12, 20);
  for (let i = 0; i < 30; i++) {
    G.touchStreak(game, t);
    t += 86400000;
  }
  assert.equal(game.streak.current, 30, 'crosses the Nov 1 clock change');
  assert.equal(game.streak.freezes, G.MAX_FREEZES);
  const st = E.createState(CONTENT);
  const earned = G.checkBadges(game, st, CONTENT, t).map((b) => b.id);
  assert.ok(['on-watch-1', 'on-watch-2', 'on-watch-3'].every((id) => earned.includes(id)));
});

// ------------------------------------------------------------------ migration

test('v1 -> v2 migration grants XP and badges retroactively and is idempotent', () => {
  const st = E.createState(CONTENT);
  const osi = CONTENT.items.filter((i) => i.skill === 'net-osi');
  for (const it of osi.slice(0, 5)) E.recordAnswer(st, CONTENT, it.id, true);
  E.recordAnswer(st, CONTENT, osi[5].id, false);
  assert.equal(st.version, 1);
  const expected =
    osi.slice(0, 5).reduce((a, it) => a + G.XP_RULES.correct[it.difficulty] + (it.type === 'text' ? G.XP_RULES.typedBonus : 0), 0) +
    G.XP_RULES.attempt +
    (E.isMastered(st, CONTENT, 'net-osi') ? G.XP_RULES.skillMastered : 0);
  const copy = JSON.parse(JSON.stringify(st));
  migrateState(copy, CONTENT, DAY1);
  assert.equal(copy.version, CURRENT_VERSION);
  assert.equal(copy.game.xp, expected);
  assert.ok(copy.game.badges['first-blood']?.retro);
  assert.equal(copy.game.streak.current, 0, 'v1 has no dates, so no streak is invented');
  const xp = copy.game.xp;
  migrateState(copy, CONTENT, DAY1 + 1000);
  assert.equal(copy.game.xp, xp, 'running migration again changes nothing');
});

test('a brand-new state starts at the current version with an empty profile', () => {
  const st = migrateState(E.createState(CONTENT), CONTENT, DAY1);
  assert.equal(st.version, 3);
  assert.equal(st.game.ladder, 2);
  assert.equal(st.game.xp, 0);
  assert.equal(st.game.rankId, 'trainee');
  assert.deepEqual(st.game.badges, {});
});

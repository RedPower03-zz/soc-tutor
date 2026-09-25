// Career ladder, curriculum tiers, level curve, XP budget and the v2 -> v3 save migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/engine.js';
import * as G from '../js/game.js';
import { migrateState, CURRENT_VERSION, OLD_LADDER } from '../js/migrate.js';
import { CONTENT } from '../content/index.js';

const T0 = new Date(2026, 8, 28, 14).getTime();
const master = (st, id) => Object.assign(st.skills[id], { p: 0.97, attempts: 6, correct: 6, unlocked: true });
const GATE_TYPES = new Set(['mastered', 'tier', 'skills', 'cases', 'scenario', 'all-tiers']);

test('tiers: Level 1 built, Level 2 and 3 planned, each with skills on the map', () => {
  assert.deepEqual(CONTENT.tiers.map((t) => t.level), [1, 2, 3]);
  const [l1, l2, l3] = CONTENT.tiers;
  assert.equal(l1.status, 'available');
  assert.equal(l2.status, 'coming-soon');
  assert.equal(l3.status, 'coming-soon');
  assert.equal(G.tierProgress(E.createState(CONTENT), CONTENT, l1.id).available, true);
  assert.equal(G.tierSkills(CONTENT, l1.id).length, 13);
  for (const t of [l2, l3]) {
    assert.ok(G.tierSkills(CONTENT, t.id).length >= 5, `${t.id} shows its planned skills`);
    assert.ok(G.tierSkills(CONTENT, t.id).every((s) => s.comingSoon));
  }
  const l3names = G.tierSkills(CONTENT, l3.id).map((s) => s.name.toLowerCase()).join(' ');
  for (const topic of ['pki', 'crypt', 'kerberos', 'cloud', 'forensic', 'detection']) assert.match(l3names, new RegExp(topic));
});

test('ladder: 12+ ranks, unique ids and titles, rising XP, only known gate types', () => {
  assert.ok(G.RANKS.length >= 12);
  assert.equal(new Set(G.RANKS.map((r) => r.id)).size, G.RANKS.length);
  assert.equal(new Set(G.RANKS.map((r) => r.title)).size, G.RANKS.length);
  assert.equal(G.RANKS[0].xp, 0);
  const tierIds = new Set(CONTENT.tiers.map((t) => t.id));
  const skillIds = new Set(CONTENT.skills.map((s) => s.id));
  for (let i = 1; i < G.RANKS.length; i++) {
    const r = G.RANKS[i];
    assert.ok(r.xp > G.RANKS[i - 1].xp, `${r.id} XP must rise`);
    assert.ok(r.band, `${r.id} band`);
    for (const g of r.gates || []) {
      assert.ok(GATE_TYPES.has(g.type), `${r.id}: gate ${g.type}`);
      if (g.tier) assert.ok(tierIds.has(g.tier), `${r.id}: tier ${g.tier}`);
      for (const s of g.skills || []) assert.ok(skillIds.has(s), `${r.id}: skill ${s}`);
    }
  }
  // every rank from Tier 2 up depends on content beyond Level 1 or a capstone
  const t2 = G.RANKS.findIndex((r) => r.id === 'tier2-1');
  for (const r of G.RANKS.slice(t2)) assert.ok(r.gates.length > 0, `${r.id} has a curriculum gate`);
});

test('today\'s content reaches Tier 1 Analyst III: about a third of the ladder', () => {
  const top = G.reachableRank(CONTENT);
  assert.equal(top.id, 'tier1-3');
  const pct = G.rankIndex(top.id) / (G.RANKS.length - 1);
  assert.ok(pct >= 0.25 && pct <= 0.4, `${Math.round(pct * 100)}%`);
});

test('XP budget: finishing Level 1 plus operations lands in the 25-40% band and far below max level', () => {
  const b = G.xpBudget(CONTENT);
  assert.equal(b.total, b.foundations + b.operations);
  assert.ok(b.operations > 0 && b.siem > 0 && b.capstone > 0);
  assert.ok(b.atTotal.xp >= G.RANKS.find((r) => r.id === 'tier1-3').xp, 'enough XP for the top reachable rank');
  assert.equal(b.atTotal.rank.id, 'tier1-3');
  assert.ok(b.atTotal.ladderPct >= 25 && b.atTotal.ladderPct <= 40);
  assert.ok(b.atTotal.level <= G.MAX_LEVEL * 0.4, `level ${b.atTotal.level} of ${G.MAX_LEVEL}`);
  assert.ok(b.atMonth.level <= G.MAX_LEVEL / 2, 'even a month of reviews stays under half the levels');
  assert.ok(b.withMonth < G.RANKS.find((r) => r.id === 'tier2-1').xp + 5000);
});

test('themes and titles are spread across the whole ladder', () => {
  const idxs = G.THEMES.map((t) => G.rankIndex(t.rank));
  for (const t of G.THEMES) assert.ok(G.RANKS.some((r) => r.id === t.rank), `${t.id} rank ${t.rank}`);
  assert.equal(idxs[0], 0);
  assert.ok(Math.max(...idxs) >= G.RANKS.length - 3, 'a theme near the top');
  const reachable = G.rankIndex(G.reachableRank(CONTENT).id);
  const now = idxs.filter((i) => i <= reachable).length;
  assert.ok(now >= 2 && now < G.THEMES.length - 2, 'some themes now, most later');
});

test('next-rank requirements: XP row first, then gate rows with progress', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  master(st, 'net-osi');
  game.xp = 800;
  const r = G.RANKS.find((x) => x.id === 'tier1-2');
  const rows = G.rankRequirements(r, game, st, CONTENT);
  assert.ok(rows[0].xp);
  assert.deepEqual([rows[0].current, rows[0].target, rows[0].met], [800, 3000, false]);
  assert.deepEqual([rows[1].current, rows[1].target], [1, 9]);
  assert.match(rows[2].label, /SIEM investigation/);
  assert.equal(rows.some((x) => x.soon), false, 'everything for Tier 1 Analyst II exists today');
  const t2 = G.rankRequirements(G.RANKS.find((x) => x.id === 'tier2-1'), game, st, CONTENT);
  assert.ok(t2.some((x) => x.soon), 'Tier 2 depends on Level 2 content');
});

test('gates are data-driven: making Level 2 available in content opens Tier 2 ranks with no code change', () => {
  const l2skills = G.tierSkills(CONTENT, 'l2').map((s) => s.id);
  const content = {
    ...CONTENT,
    tiers: CONTENT.tiers.map((t) => (t.id === 'l2' ? { ...t, status: 'available' } : t)),
    skills: CONTENT.skills.map((s) => (l2skills.includes(s.id) ? { ...s, comingSoon: false } : s)),
    items: [...CONTENT.items, ...l2skills.map((id) => ({ id: `fake-${id}`, skill: id, type: 'mc', difficulty: 1, prompt: 'x', choices: ['a', 'b'], answer: 'a', explanation: 'x' }))],
  };
  assert.equal(G.reachableRank(content).id, 'tier2-3', 'Senior Analyst also needs a Level 2 capstone');
  const st = E.createState(content);
  const game = G.createGame();
  game.xp = 20000;
  E.indexContent(content).activeSkills.forEach((s) => master(st, s.id));
  for (const c of content.siemCases) st.siem.cases[c.id] = { solved: true };
  st.capstones['first-shift'] = { completedAt: T0 };
  assert.equal(G.computeRank(game, st, content).id, 'tier2-3');
  // and a new tier can be added as data
  const withL4 = { ...CONTENT, tiers: [...CONTENT.tiers, { id: 'l4', level: 4, name: 'Expert', status: 'coming-soon', tracks: ['expert'] }] };
  assert.equal(G.gateRows({ type: 'all-tiers' }, E.createState(CONTENT), withL4).target, 4);
});

// ------------------------------------------------------------------ migration v2 -> v3

const v1 = () => JSON.parse(fs.readFileSync(new URL('./fixtures/v1-save-from-main.json', import.meta.url), 'utf8'));
/** A v2 save as round one wrote it: old rank ids, no game.ladder. */
function v2Save({ rankId = 'tier2', equippedTitle = 'rank:tier1', theme = 'green' } = {}) {
  const st = migrateState(v1(), CONTENT, T0);
  st.version = 2;
  delete st.game.ladder;
  delete st.game.keptTitles;
  delete st.game.keptThemes;
  delete st.game.ladderNotice;
  st.game.version = 2;
  st.game.rankId = rankId;
  st.game.level = 5;
  st.game.equippedTitle = equippedTitle;
  st.game.theme = theme;
  st.game.badges.centurion = { earnedAt: T0 - 1000 };
  delete st.siem;
  delete st.capstones;
  return st;
}

test('migration v2 -> v3: rank and level recomputed; old titles, themes and badges kept; notice shown', () => {
  assert.equal(CURRENT_VERSION, 3);
  const before = v2Save();
  const badges = JSON.parse(JSON.stringify(before.game.badges));
  const xp = before.game.xp;
  const st = migrateState(before, CONTENT, T0 + 1);
  assert.equal(st.version, 3);
  assert.equal(st.game.ladder, 2);
  assert.equal(st.game.xp, xp, 'XP is never changed');
  assert.equal(st.game.level, G.levelForXp(xp));
  assert.equal(st.game.rankId, G.computeRank(st.game, st, CONTENT).id);
  for (const id of Object.keys(badges)) assert.deepEqual(st.game.badges[id], badges[id], `badge ${id} kept`);
  assert.deepEqual(st.game.keptTitles, ['Junior Analyst', 'Tier 1 Analyst', 'Tier 2 Analyst']);
  for (const t of ['cyan', 'amber', 'red', 'green']) assert.ok(st.game.keptThemes.includes(t));
  assert.equal(st.game.theme, 'green');
  assert.ok(G.unlockedThemes(st.game).some((t) => t.id === 'green'), 'the equipped theme stays usable');
  assert.equal(G.setTheme(st.game, 'red'), true);
  assert.equal(st.game.equippedTitle, 'kept:Tier 1 Analyst');
  assert.equal(G.currentTitle(st.game), 'Tier 1 Analyst', 'the displayed title does not change');
  assert.ok(G.availableTitles(st.game).some((t) => t.id === 'kept:Tier 2 Analyst'));
  assert.equal(G.equipTitle(st.game, 'kept:Tier 2 Analyst'), true);
  const newTitle = G.RANKS[G.rankIndex(st.game.rankId)].title;
  assert.deepEqual({ from: st.game.ladderNotice.fromTitle, to: st.game.ladderNotice.toTitle }, { from: 'Tier 2 Analyst', to: newTitle });
  assert.deepEqual(st.siem, { cases: {}, active: null });
  assert.deepEqual(st.capstones, {});
  // idempotent
  const again = migrateState(JSON.parse(JSON.stringify(st)), CONTENT, T0 + 99);
  assert.deepEqual(again, st);
});

test('migration v2 -> v3: an unequipped rank title stays unequipped; an unchanged rank shows no notice', () => {
  const st = migrateState(v2Save({ rankId: 'junior', equippedTitle: null, theme: 'amber' }), CONTENT, T0);
  assert.equal(st.game.equippedTitle, null);
  assert.deepEqual(st.game.keptTitles, ['Junior Analyst']);
  assert.equal(st.game.theme, 'amber');
  const trainee = v2Save({ rankId: 'trainee', equippedTitle: 'badge:gap-closer', theme: 'cyan' });
  trainee.game.xp = 100;
  const t = migrateState(trainee, CONTENT, T0);
  assert.equal(t.game.rankId, 'trainee');
  assert.equal(t.game.ladderNotice, null);
  assert.equal(t.game.equippedTitle, 'badge:gap-closer', 'badge titles are untouched');
  assert.deepEqual(t.game.keptTitles, []);
});

test('migration: a v1 save goes straight onto the new ladder with no notice', () => {
  const st = migrateState(v1(), CONTENT, T0);
  assert.equal(st.version, 3);
  assert.equal(st.game.ladder, 2);
  assert.equal(st.game.ladderNotice, null);
  assert.deepEqual(st.game.keptTitles, []);
  assert.equal(st.game.rankId, G.computeRank(st.game, st, CONTENT).id);
  assert.equal(OLD_LADDER.length, 7);
});

test('rank never drops during play (only migration recomputes it)', () => {
  const st = E.createState(CONTENT);
  const game = G.createGame();
  game.xp = 800;
  ['net-osi', 'net-ip'].forEach((id) => master(st, id));
  const item = CONTENT.items.find((i) => i.skill === 'net-osi' && i.difficulty === 1);
  G.onAnswer(game, st, CONTENT, { item, correct: true, mode: 'learn', events: [], now: T0 });
  assert.equal(game.rankId, 'junior-2');
  st.skills['net-ip'].p = 0.3; // mastery fades
  G.onAnswer(game, st, CONTENT, { item, correct: true, mode: 'learn', events: [], now: T0 });
  assert.equal(game.rankId, 'junior-2');
});

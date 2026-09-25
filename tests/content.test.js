import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../content/index.js';

const { skills, items, tracks } = CONTENT;
const skillById = new Map(skills.map((s) => [s.id, s]));
const MIN_ITEMS_PER_SKILL = 6;

test('skill ids are unique and tracks exist', () => {
  assert.equal(new Set(skills.map((s) => s.id)).size, skills.length);
  const trackIds = new Set(tracks.map((t) => t.id));
  for (const s of skills) {
    assert.ok(trackIds.has(s.track), `${s.id}: unknown track ${s.track}`);
    assert.ok(s.name && s.summary, `${s.id}: needs a name and summary`);
    assert.equal(typeof s.order, 'number', `${s.id}: needs an order`);
  }
});

test('every prerequisite is a real skill', () => {
  for (const s of skills) for (const p of s.prereqs) assert.ok(skillById.has(p), `${s.id} requires unknown skill ${p}`);
});

test('prerequisite graph has no cycles', () => {
  const state = new Map(); // 1 = visiting, 2 = done
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, `cycle: ${[...path, id].join(' -> ')}`);
    state.set(id, 1);
    for (const p of skillById.get(id).prereqs) visit(p, [...path, id]);
    state.set(id, 2);
  };
  for (const s of skills) visit(s.id, []);
});

test('Level 1 skills do not depend on Level 2+ skills', () => {
  for (const s of skills.filter((x) => !x.comingSoon)) {
    for (const p of s.prereqs) assert.ok(!skillById.get(p).comingSoon, `${s.id} depends on coming-soon ${p}`);
  }
});

test('item ids are unique', () => {
  const seen = new Set();
  for (const it of items) {
    assert.ok(!seen.has(it.id), `duplicate id ${it.id}`);
    seen.add(it.id);
  }
});

test('every item references a real, available skill', () => {
  for (const it of items) {
    const s = skillById.get(it.skill);
    assert.ok(s, `${it.id}: unknown skill ${it.skill}`);
    assert.ok(!s.comingSoon, `${it.id}: skill ${it.skill} is marked coming soon`);
  }
});

test(`every Level 1 skill has at least ${MIN_ITEMS_PER_SKILL} items and a spread of difficulty`, () => {
  for (const s of skills.filter((x) => !x.comingSoon)) {
    const its = items.filter((i) => i.skill === s.id);
    assert.ok(its.length >= MIN_ITEMS_PER_SKILL, `${s.id} has only ${its.length} items`);
    const diffs = new Set(its.map((i) => i.difficulty));
    assert.ok(diffs.size >= 2, `${s.id} needs at least two difficulty levels`);
    assert.ok(its.some((i) => i.difficulty <= 2), `${s.id} needs easy/medium items for diagnostics`);
  }
});

test('items are well formed', () => {
  for (const it of items) {
    const where = `item ${it.id}`;
    assert.ok([1, 2, 3].includes(it.difficulty), `${where}: difficulty must be 1-3`);
    assert.ok(['mc', 'multi', 'text'].includes(it.type), `${where}: bad type ${it.type}`);
    assert.ok(typeof it.prompt === 'string' && it.prompt.trim().length > 10, `${where}: prompt`);
    assert.ok(typeof it.explanation === 'string' && it.explanation.trim().length >= 60, `${where}: explanation too short`);
    if (it.snippet !== undefined) assert.ok(typeof it.snippet === 'string' && it.snippet.trim(), `${where}: empty snippet`);
    if (it.type === 'mc' || it.type === 'multi') {
      assert.ok(Array.isArray(it.choices) && it.choices.length >= 3, `${where}: needs 3+ choices`);
      assert.equal(new Set(it.choices).size, it.choices.length, `${where}: duplicate choices`);
    }
    if (it.type === 'mc') {
      assert.equal(typeof it.answer, 'string', `${where}: mc answer must be the choice text`);
      assert.ok(it.choices.includes(it.answer), `${where}: answer "${it.answer}" is not one of the choices`);
    }
    if (it.type === 'multi') {
      assert.ok(Array.isArray(it.answer) && it.answer.length >= 1, `${where}: multi answer must be a list`);
      assert.equal(new Set(it.answer).size, it.answer.length, `${where}: duplicate answers`);
      for (const a of it.answer) assert.ok(it.choices.includes(a), `${where}: answer "${a}" is not one of the choices`);
      assert.ok(it.answer.length < it.choices.length, `${where}: needs at least one wrong choice`);
    }
    if (it.type === 'text') {
      assert.ok(Array.isArray(it.accept) && it.accept.length >= 1, `${where}: text needs accepted answers`);
      assert.ok(it.accept.every((a) => typeof a === 'string' && a.trim()), `${where}: empty accepted answer`);
    }
  }
});

test('question bank size and variety', () => {
  assert.ok(items.length >= 70, `only ${items.length} items`);
  const types = new Set(items.map((i) => i.type));
  for (const t of ['mc', 'multi', 'text']) assert.ok(types.has(t), `no ${t} items`);
  const scenarios = items.filter((i) => i.snippet);
  assert.ok(scenarios.length >= 15, `only ${scenarios.length} log/packet scenarios`);
});

test('Windows paths kept their backslashes (no lost escape characters)', () => {
  for (const it of items) {
    const text = [it.prompt, it.snippet, it.explanation, ...(it.choices || []), ...(it.accept || [])]
      .filter(Boolean)
      .join(' ');
    assert.ok(!/C:(Windows|Users|ProgramData|Program)/.test(text), `${it.id}: a Windows path lost its backslash`);
  }
});

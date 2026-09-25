// Content checks for lessons, worked/faded examples, the misconception catalog and scenarios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../content/index.js';

const { skills, items, lessons, misconceptions, scenarios } = CONTENT;
const active = skills.filter((s) => !s.comingSoon);
const level1 = active.filter((s) => (s.level ?? 1) === 1);
const lessonBySkill = new Map(lessons.map((l) => [l.skill, l]));
const misById = new Map(misconceptions.map((m) => [m.id, m]));
const allText = (l) => JSON.stringify(l);

test('every live skill has a lesson with 3-6 sections, a worked example and a faded example', () => {
  assert.equal(level1.length, 13);
  for (const s of active) {
    const l = lessonBySkill.get(s.id);
    assert.ok(l, `${s.id}: no lesson`);
    assert.ok(l.title && l.goal, `${s.id}: lesson needs a title and goal`);
    assert.ok(l.sections.length >= 3 && l.sections.length <= 6, `${s.id}: ${l.sections.length} sections`);
    for (const sec of l.sections) {
      assert.ok(sec.id && sec.heading && sec.body.length, `${s.id}: incomplete section ${sec.id}`);
      if (sec.evidence) assert.ok(sec.evidence.label && sec.evidence.text, `${s.id}#${sec.id}: evidence needs label and text`);
    }
    assert.ok(l.worked.length >= 1, `${s.id}: no worked example`);
    for (const w of l.worked) {
      assert.ok(w.artifact && w.artifactLabel && w.question && w.conclusion, `${s.id}/${w.id}: incomplete worked example`);
      assert.ok(w.steps.length >= 3, `${s.id}/${w.id}: a worked example needs step-by-step reasoning`);
    }
    assert.ok(l.faded.length >= 1, `${s.id}: no faded example`);
    for (const f of l.faded) {
      assert.ok(f.artifact && f.question, `${s.id}/${f.id}: incomplete faded example`);
      assert.ok(f.given.length >= 1, `${s.id}/${f.id}: a faded example starts partly solved`);
      assert.ok(f.todo.length >= 1, `${s.id}/${f.id}: nothing left for the student to do`);
    }
  }
  assert.equal(lessons.length, active.length, 'no lessons for unknown or planned skills');
});

test('section ids are unique per lesson; example ids are unique overall', () => {
  const exIds = new Set();
  for (const l of lessons) {
    const ids = l.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${l.skill}: duplicate section id`);
    for (const e of [...l.worked, ...l.faded]) {
      assert.ok(!exIds.has(e.id), `duplicate example id ${e.id}`);
      exIds.add(e.id);
    }
  }
});

test('faded example steps have valid answers', () => {
  for (const l of lessons) {
    for (const f of l.faded) {
      for (const t of f.todo) {
        assert.ok(t.prompt && t.explanation, `${f.id}: step needs a prompt and explanation`);
        if (t.type === 'mc') {
          assert.ok(t.choices.length >= 2, `${f.id}: too few choices`);
          assert.equal(new Set(t.choices).size, t.choices.length, `${f.id}: duplicate choices`);
          assert.ok(t.choices.includes(t.answer), `${f.id}: answer "${t.answer}" is not a choice`);
        } else {
          assert.equal(t.type, 'text', `${f.id}: unknown step type ${t.type}`);
          assert.ok(Array.isArray(t.accept) && t.accept.length, `${f.id}: typed step needs accepted answers`);
        }
      }
    }
  }
});

test('misconception catalog: complete entries, real skills, lesson links resolve', () => {
  assert.equal(misById.size, misconceptions.length, 'duplicate misconception id');
  const skillIds = new Set(active.map((s) => s.id));
  for (const m of misconceptions) {
    assert.ok(m.name && m.description && m.fix, `${m.id}: needs name, description and fix`);
    assert.ok(skillIds.has(m.skill), `${m.id}: unknown skill ${m.skill}`);
    if (m.lesson) {
      const [sid, sec] = m.lesson.split('#');
      const l = lessonBySkill.get(sid);
      assert.ok(l, `${m.id}: lesson link to unknown lesson ${sid}`);
      assert.ok(l.sections.some((s) => s.id === sec), `${m.id}: lesson link to unknown section ${m.lesson}`);
    }
  }
  for (const s of active) assert.ok(misconceptions.filter((m) => m.skill === s.id).length >= 2, `${s.id}: needs at least 2 misconceptions`);
});

test('item misconception tags reference real ids and real answers', () => {
  let tagged = 0;
  for (const it of items) {
    if (!it.misconceptions) continue;
    tagged += 1;
    for (const [key, id] of Object.entries(it.misconceptions)) {
      assert.ok(misById.has(id), `${it.id}: unknown misconception ${id}`);
      if (it.type === 'mc') {
        assert.ok(it.choices.includes(key), `${it.id}: tag key is not a choice: ${key}`);
        assert.notEqual(key, it.answer, `${it.id}: the right answer cannot be tagged as a misconception`);
      } else if (it.type === 'multi') {
        assert.ok(it.choices.includes(key), `${it.id}: tag key is not a choice: ${key}`);
      } else {
        const norm = (x) => x.trim().toLowerCase().replace(/\s+/g, ' ');
        assert.ok(!it.accept.some((a) => norm(a) === norm(key)), `${it.id}: an accepted answer is tagged as a misconception`);
      }
    }
  }
  assert.ok(tagged >= 60, `only ${tagged} tagged items`);
});

test('each misconception is tested by at least two items (so a distinct follow-up exists)', () => {
  const count = new Map();
  for (const it of items) for (const id of new Set(Object.values(it.misconceptions || {}))) count.set(id, (count.get(id) || 0) + 1);
  for (const m of misconceptions) assert.ok((count.get(m.id) || 0) >= 2, `${m.id}: only ${count.get(m.id) || 0} item(s) test it`);
});

test('the common SOC beginner errors are in the catalog', () => {
  for (const id of ['log-success-vs-failure', 'ip-private-ranges', 'port-src-dst', 'tcp-udp-handshake', 'sub-usable-count', 'proc-pid-ppid', 'proc-powershell-always-bad', 'http-https-safe', 'dns-a-ptr']) {
    assert.ok(misById.has(id), `missing misconception ${id}`);
  }
});

test('scenarios: valid kinds, stage lesson requirements exist, item steps exist', () => {
  const itemIds = new Set(items.map((i) => i.id));
  assert.ok(scenarios.some((s) => s.kind === 'mixed'));
  assert.ok(scenarios.some((s) => s.kind === 'capstone'));
  for (const sc of scenarios) {
    assert.ok(['mixed', 'investigation', 'capstone'].includes(sc.kind), `${sc.id}: unknown kind`);
    for (const st of sc.stages) {
      for (const sid of st.requires?.lessons || []) assert.ok(lessonBySkill.has(sid), `${st.id}: requires unknown lesson ${sid}`);
      for (const step of st.steps || []) {
        assert.ok(['brief', 'evidence', 'item'].includes(step.type), `${st.id}: unknown step type`);
        if (step.type === 'item') assert.ok(itemIds.has(step.itemId), `${st.id}: unknown item ${step.itemId}`);
      }
    }
  }
});

test('lesson text: Windows paths kept their backslashes', () => {
  for (const l of lessons) {
    assert.ok(!/C:(Windows|Users|ProgramData|Program)/.test(allText(l).replace(/\\\\/g, '\\')), `${l.skill}: a Windows path lost its backslash`);
  }
  for (const m of misconceptions) assert.ok(!/C:(Windows|Users|ProgramData|Program)/.test(m.fix + m.description), `${m.id}: lost backslash`);
});

test('lesson and item public IPs use documentation ranges', () => {
  const ok = (ip) => {
    const [a, b, c] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 || a >= 224 ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) ||
      (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || ip === '8.8.8.8' || ip === '1.1.1.1'
    );
  };
  // Deliberate boundary examples that teach "looks private but isn't" (just outside RFC 1918).
  const boundary = new Set(['172.40.8.9', '172.32.0.15', '192.169.4.4', '172.32.0.0', '172.32.1.1', '11.0.0.5', '192.169.1.10']);
  const bad = [];
  const scan = (label, text) => {
    for (const m of text.matchAll(/(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g)) {
      if (!ok(m[0]) && !boundary.has(m[0])) bad.push(`${label}: ${m[0]}`);
    }
  };
  for (const l of lessons) scan(l.skill, allText(l));
  for (const m of misconceptions) scan(m.id, m.fix + ' ' + m.description);
  for (const it of items) scan(it.id, JSON.stringify(it));
  assert.deepEqual(bad, []);
});

// Capstone scenarios ("First shift as a Tier 1 analyst"): pure logic, unit-tested in
// tests/capstone.test.js. Stage unlocks, stage scoring, the escalation rubric and completion.
import * as E from './engine.js';

// ------------------------------------------------------------------ state

export function ensureCapstones(st) {
  st.capstones ??= {};
  return st.capstones;
}

export function capstoneState(st, scId) {
  ensureCapstones(st);
  return (st.capstones[scId] ??= { stages: {}, escalation: null, score: null, best: 0, completedAt: null });
}

// ------------------------------------------------------------------ unlocks

/** A lesson requirement is met when the lesson is completed, placed out of, or the skill is mastered. */
export function lessonDone(st, content, skillId) {
  const ls = E.lessonState(st, skillId);
  return !!(ls.completed || ls.bypassed || (st.skills?.[skillId] && E.isMastered(st, content, skillId)));
}

export function stageDone(st, scId, stageId) {
  return !!st.capstones?.[scId]?.stages?.[stageId]?.done;
}

/**
 * Unlock status of a stage: { unlocked, missingLessons: [skill ids], needsPrevious: stage id | null }.
 * Stages open in order, and only when their related lessons are done.
 */
export function stageStatus(sc, stageId, st, content) {
  const i = sc.stages.findIndex((s) => s.id === stageId);
  if (i < 0) throw new Error(`Unknown stage ${stageId}`);
  const stage = sc.stages[i];
  const missingLessons = (stage.requires?.lessons || []).filter((l) => !lessonDone(st, content, l));
  const prev = i > 0 ? sc.stages[i - 1] : null;
  const needsPrevious = prev && !stageDone(st, sc.id, prev.id) ? prev.id : null;
  return { unlocked: missingLessons.length === 0 && !needsPrevious, missingLessons, needsPrevious, done: stageDone(st, sc.id, stageId) };
}

export function escalationUnlocked(sc, st) {
  return (sc.escalation?.requires?.stages || sc.stages.map((s) => s.id)).every((id) => stageDone(st, sc.id, id));
}

// ------------------------------------------------------------------ stage questions

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function checkQuestion(q, response) {
  if (q.type === 'multi') return Array.isArray(response) && sameSet(response, q.answer);
  return response === q.answer;
}

/** answers: { [questionId]: response }. Returns { correct, total, score (0-100), results: [{ id, correct }] }. */
export function scoreStage(stage, answers) {
  const results = stage.questions.map((q) => ({ id: q.id, correct: q.id in answers && checkQuestion(q, answers[q.id]) }));
  const correct = results.filter((r) => r.correct).length;
  return { correct, total: results.length, score: Math.round((correct / results.length) * 100), results };
}

/**
 * Stores a finished stage. Returns { prevBest, best, first }.
 * A stage is "done" once every question has been answered, whatever the score; the best score counts for XP.
 */
export function recordStage(st, sc, stage, answers, now) {
  const cs = capstoneState(st, sc.id);
  const result = scoreStage(stage, answers);
  const rec = (cs.stages[stage.id] ??= { done: false, best: 0, attempts: 0, answers: {} });
  const prevBest = rec.best;
  const first = !rec.done;
  rec.attempts += 1;
  rec.answers = { ...answers };
  rec.best = Math.max(rec.best, result.score);
  rec.done = true;
  rec.doneAt ??= now;
  return { ...result, prevBest, best: rec.best, first };
}

// ------------------------------------------------------------------ escalation rubric

/**
 * Checkbox groups: credit = (right picks − wrong picks) / number of right answers, floored at 0.
 * So ticking everything scores nothing, and missing a real item costs as much as adding a wrong one.
 */
export function scoreSet(picked, correct) {
  const p = new Set(picked || []);
  const right = [...p].filter((x) => correct.includes(x));
  const wrong = [...p].filter((x) => !correct.includes(x));
  const missed = correct.filter((x) => !p.has(x));
  const credit = Math.max(0, (right.length - wrong.length) / correct.length);
  return { credit, right, wrong, missed };
}

/**
 * report: { summary, severity, hosts: [], users: [], timeline: [ids], iocs: [], actions: [] }
 * Returns { total (0-100), passed, rows: [{ field, label, points, max, detail }] }.
 */
export function scoreEscalation(sc, report) {
  const esc = sc.escalation;
  const F = esc.fields;
  const W = esc.weights;
  const rows = [];
  const push = (field, credit, detail) => rows.push({ field, label: F[field].label, points: Math.round(credit * W[field]), max: W[field], detail });

  // summary: keyword coverage of the rubric points
  const text = String(report.summary || '').toLowerCase();
  const long = text.trim().length >= (F.summary.minLength || 0);
  const hits = long ? F.summary.rubric.filter((r) => r.any.some((k) => text.includes(k))) : [];
  push('summary', hits.length / F.summary.rubric.length, {
    tooShort: !long,
    hits: hits.map((h) => h.label),
    misses: F.summary.rubric.filter((r) => !hits.includes(r)).map((r) => r.label),
  });

  // severity: graded
  push('severity', F.severity.credit[report.severity] ?? 0, { given: report.severity || null, model: esc.model.severity });

  for (const field of ['hosts', 'users', 'timeline', 'iocs', 'actions']) {
    const r = scoreSet(report[field], F[field].correct);
    push(field, r.credit, r);
  }

  const total = rows.reduce((a, r) => a + r.points, 0);
  return { total, passed: total >= (esc.passScore ?? 50), rows };
}

/** The model answer as a report (it must score 100: see tests). */
export function modelReport(sc) {
  const F = sc.escalation.fields;
  return {
    summary: sc.escalation.model.summary,
    severity: sc.escalation.model.severity,
    hosts: [...F.hosts.correct],
    users: [...F.users.correct],
    timeline: [...F.timeline.correct],
    iocs: [...F.iocs.correct],
    actions: [...F.actions.correct],
  };
}

/**
 * Stores an escalation. A passing report completes the capstone (sets completedAt, which the
 * rank ladder checks). Returns { ...score, prevBest, best, firstCompletion }.
 */
export function recordEscalation(st, sc, report, now) {
  const cs = capstoneState(st, sc.id);
  const result = scoreEscalation(sc, report);
  const prevBest = cs.best || 0;
  cs.escalation = { ...report, submittedAt: now };
  cs.score = result.total;
  cs.best = Math.max(prevBest, result.total);
  cs.attempts = (cs.attempts || 0) + 1;
  const firstCompletion = result.passed && !cs.completedAt;
  if (result.passed) cs.completedAt ??= now;
  return { ...result, prevBest, best: cs.best, firstCompletion };
}

/** Overall progress for the dashboard: { stagesDone, stages, escalated, completed }. */
export function capstoneProgress(sc, st) {
  const cs = st.capstones?.[sc.id];
  return {
    stagesDone: sc.stages.filter((s) => cs?.stages?.[s.id]?.done).length,
    stages: sc.stages.length,
    escalated: !!cs?.escalation,
    completed: !!cs?.completedAt,
    score: cs?.best ?? null,
  };
}

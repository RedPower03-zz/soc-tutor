// SOC Tutor user interface. Renders screens into #app and talks to the engine.
import { CONTENT } from '../content/index.js';
import * as E from './engine.js';
import { loadState, saveState, clearState } from './storage.js';

const app = document.getElementById('app');
const idx = E.indexContent(CONTENT);
let state = loadState(CONTENT);

// session: { type: 'auto' | 'review' | 'skill' | 'placement', skillId? }
let session = null;
// current question: { item, mode, note, order: [choice texts], selected: Set, answered, result }
let current = null;

const MODE_LABEL = {
  learn: 'Learning',
  review: 'Review',
  probe: 'Building-block check',
  remediate: 'Fixing a gap',
  practice: 'Practice',
  skill: 'Skill practice',
  placement: 'Placement',
};
const STATUS_LABEL = {
  mastered: '✓ Mastered',
  learning: 'In progress',
  new: 'Ready',
  gap: '⚠ Gap',
  locked: '🔒 Locked',
  'coming-soon': 'Coming soon',
};
const TYPE_LABEL = { mc: 'Multiple choice', multi: 'Select all that apply', text: 'Type your answer' };
const NOTE_ICON = { probe: '🧩', gap: '🛠️', return: '↩️', info: '⭐' };
const EVENT_ICON = {
  'review-added': '🔁',
  'review-requeued': '🔁',
  'review-advanced': '📈',
  'review-cleared': '✅',
  'probe-start': '🧩',
  'probe-solid': '👍',
  'gap-found': '🛠️',
  'gap-resolved': '✅',
  'remediation-paused': '⏸️',
  return: '↩️',
  mastered: '⭐',
  unlocked: '🔓',
};

const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 8 13v17c0 15 10 26 24 30 14-4 24-15 24-30V13z" fill="#22d3ee"/><path d="M22 32l7 7 13-14" stroke="#0a0f1c" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ------------------------------------------------------------------ helpers

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
/** Escapes text and turns `backticks` into <code>. */
function rich(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}
// Mastery is a probability, so never show a flat 100%.
const pct = (p) => Math.min(99, Math.round(p * 100));
const skillName = (id) => idx.skillById.get(id)?.name || id;
const bar = (p, cls = '') => `<div class="bar ${cls}"><span style="width:${pct(p)}%"></span></div>`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function render(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function save() {
  saveState(state);
}

// ------------------------------------------------------------------ home

function renderHome() {
  session = null;
  current = null;
  const prog = E.overallProgress(state, CONTENT);
  const firstVisit = state.turn === 0 && !state.placement?.done;
  const top = state.focus[state.focus.length - 1];

  const welcome = firstVisit
    ? `<section class="card">
        <h2>Welcome, analyst 👋</h2>
        <p class="muted">This tutor starts with host and network basics and adapts as you go: it re-asks what you miss and digs into the building blocks behind your mistakes.</p>
        <p class="muted small">Want to skip what you already know? Take a quick placement check — one question per skill (${idx.activeSkills.length} total). You can stop at any time.</p>
        <button class="btn primary" data-action="placement">Take the placement check</button>
        <button class="btn secondary" data-action="skip-placement">Start from the basics</button>
      </section>`
    : '';

  const focusBanner = top
    ? `<div class="banner ${top.kind === 'probe' ? 'probe' : 'gap'}"><span class="ico">${top.kind === 'probe' ? '🧩' : '🛠️'}</span>
        <div>${top.kind === 'probe' ? `The tutor is checking a building block: <b>${esc(skillName(top.skillId))}</b>` : `Working on a gap: <b>${esc(skillName(top.skillId))}</b>`}, then back to ${esc(skillName(top.returnTo))}.</div></div>`
    : '';

  const hero = `<section class="card hero">
      <h1>Level 1 · Host &amp; Network Basics</h1>
      <p class="muted small">Master every skill to unlock Level 2 SOC analyst tracks.</p>
      <div class="stats">
        <div class="stat"><b>${prog.mastered}/${prog.total}</b><span>Mastered</span></div>
        <div class="stat"><b>${pct(prog.average)}%</b><span>Avg mastery</span></div>
        <div class="stat"><b>${prog.answered}</b><span>Answered</span></div>
      </div>
      ${bar(prog.mastered / Math.max(1, prog.total), 'ok')}
      ${firstVisit ? '' : `<button class="btn primary" data-action="continue">${prog.answered ? 'Continue learning' : 'Start learning'} →</button>`}
      <button class="btn secondary" data-action="review" ${prog.reviewCount ? '' : 'disabled'}>
        Review missed items <span class="badge ${prog.reviewCount ? '' : 'zero'}">${prog.reviewCount}</span>
      </button>
      <button class="btn secondary" data-action="report">📊 Gap report</button>
    </section>`;

  const tracks = CONTENT.tracks
    .map((t) => {
      const skills = CONTENT.skills.filter((s) => s.track === t.id).sort((a, b) => a.order - b.order);
      const masteredCount = skills.filter((s) => E.skillStatus(state, CONTENT, s.id) === 'mastered').length;
      return `<div class="track">
        <div class="track-head"><span>${t.icon}</span><h3>${esc(t.name)}</h3>
          <span class="count">${t.comingSoon ? 'Roadmap' : `${masteredCount}/${skills.length} mastered`}</span></div>
        ${skills.map(renderSkillCard).join('')}
      </div>`;
    })
    .join('');

  render(`
    <header class="topbar">
      <div class="brand">${LOGO}<div>SOC Tutor<small>Adaptive analyst training</small></div></div>
    </header>
    ${welcome}
    ${focusBanner}
    ${hero}
    <div class="section-title"><span>Skill map</span><span>Tap a skill to practice it</span></div>
    ${tracks}
    <footer class="footer">
      <p>Progress is saved in this browser on this device.</p>
      <button class="btn danger" data-action="reset">Reset progress</button>
    </footer>
  `);
}

function renderSkillCard(s) {
  const status = E.skillStatus(state, CONTENT, s.id);
  const ss = state.skills[s.id];
  const clickable = ['new', 'learning', 'gap', 'mastered'].includes(status);
  const needs = s.prereqs.length ? `Needs: ${s.prereqs.map((p) => esc(skillName(p))).join(', ')}` : 'No prerequisites';
  const right = status === 'coming-soon' ? '' : ss && ss.attempts ? `${pct(ss.p)}% · ${ss.attempts} answered` : '';
  const barCls = status === 'mastered' ? 'ok' : status === 'gap' ? 'gap' : '';
  return `<button class="skill s-${status}" ${clickable ? `data-action="skill" data-skill="${s.id}"` : 'disabled'} aria-label="${esc(s.name)}: ${STATUS_LABEL[status]}">
      <div class="skill-top"><span class="skill-name">${esc(s.name)}</span><span class="chip ${status}">${STATUS_LABEL[status]}</span></div>
      ${status === 'coming-soon' ? `<div class="small muted">${esc(s.summary)}</div>` : `<div class="bar thin ${barCls}"><span style="width:${ss ? pct(ss.p) : 0}%"></span></div>`}
      <div class="skill-meta"><span>${needs}</span><span>${right}</span></div>
    </button>`;
}

// ------------------------------------------------------------------ sessions

function startSession(s) {
  session = s;
  showNext();
}

function showNext() {
  const next = E.nextItem(state, CONTENT, { session: session.type, skillId: session.skillId });
  save();
  if (!next) {
    if (session.type === 'placement') return finishPlacement(false);
    if (session.type === 'review') return renderDone('All caught up! 🎉', 'No missed questions are waiting for review right now.');
    return renderHome();
  }
  const { item } = next;
  current = {
    ...next,
    order: item.choices ? shuffle(item.choices) : null,
    selected: new Set(),
    answered: false,
    result: null,
  };
  renderQuestion();
}

function renderQuestion() {
  const { item, mode, note } = current;
  const ss = state.skills[item.skill];
  const isPlacement = mode === 'placement';
  const pl = state.placement;

  const noteHtml = note
    ? `<div class="banner ${note.type || 'info'}"><span class="ico">${NOTE_ICON[note.type] || 'ℹ️'}</span><div>${esc(note.text)}</div></div>`
    : '';

  let answers = '';
  if (item.type === 'text') {
    answers = `<input id="answer-text" class="text-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type your answer" aria-label="Your answer" />`;
  } else {
    answers = `${item.type === 'multi' ? '<p class="hint">Select every correct option, then check.</p>' : ''}
      <div class="choices" role="${item.type === 'multi' ? 'group' : 'radiogroup'}">
        ${current.order
          .map(
            (c, i) =>
              `<button class="choice ${item.type === 'multi' ? 'multi' : ''}" data-action="choose" data-index="${i}" role="${item.type === 'multi' ? 'checkbox' : 'radio'}" aria-checked="false">
                <span class="mark"></span><span>${rich(c)}</span></button>`,
          )
          .join('')}
      </div>`;
  }

  render(`
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">✕</button>
      <div class="qbar-mid">
        <span class="mode ${mode}">${MODE_LABEL[mode] || mode}</span>
        <span class="skill-label">${esc(skillName(item.skill))}</span>
      </div>
      ${
        isPlacement
          ? `<div class="qmastery"><b>${pl.index + 1}/${pl.queue.length}</b>placement</div>`
          : `<div class="qmastery"><b id="q-mastery">${pct(ss.p)}%</b>mastery${bar(ss.p, 'thin')}</div>`
      }
    </header>
    ${noteHtml}
    <article class="card question" data-item-id="${item.id}" data-skill="${item.skill}" data-mode="${mode}">
      <div class="q-meta"><span>${TYPE_LABEL[item.type]}</span><span>Difficulty <span class="dots">${'●'.repeat(item.difficulty)}${'○'.repeat(3 - item.difficulty)}</span></span></div>
      <p class="prompt">${rich(item.prompt)}</p>
      ${item.snippet ? `<div class="snippet-label">Evidence</div><pre class="snippet">${esc(item.snippet)}</pre>` : ''}
      ${answers}
      <button id="submit-btn" class="btn primary" data-action="submit" ${item.type === 'text' ? '' : 'disabled'}>Check answer</button>
      ${isPlacement ? '<button class="btn ghost" style="width:100%;margin-top:6px" data-action="end-placement">Skip the rest of placement</button>' : ''}
    </article>
    <div id="feedback"></div>
  `);

  const input = document.getElementById('answer-text');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
}

function choose(i) {
  if (current.answered) return;
  const { item } = current;
  if (item.type === 'mc') current.selected = new Set([i]);
  else if (current.selected.has(i)) current.selected.delete(i);
  else current.selected.add(i);
  app.querySelectorAll('.choice').forEach((el) => {
    const on = current.selected.has(Number(el.dataset.index));
    el.classList.toggle('selected', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  document.getElementById('submit-btn').disabled = current.selected.size === 0;
}

function submitAnswer() {
  if (!current || current.answered) return;
  const { item } = current;
  let response;
  if (item.type === 'text') {
    const input = document.getElementById('answer-text');
    response = input.value;
    if (!response.trim()) {
      input.focus();
      return;
    }
  } else if (item.type === 'mc') {
    response = current.order[[...current.selected][0]];
  } else {
    response = [...current.selected].map((i) => current.order[i]);
  }
  const correct = E.checkAnswer(item, response);
  const result = E.recordAnswer(state, CONTENT, item.id, correct, { mode: current.mode, session: session.type });
  current.answered = true;
  current.result = result;
  save();
  renderFeedback(response);
}

function renderFeedback(response) {
  const { item, result, mode } = current;
  const correct = result.correct;

  // Mark the answer area.
  if (item.type === 'text') {
    const input = document.getElementById('answer-text');
    input.disabled = true;
    input.classList.add(correct ? 'correct' : 'wrong');
  } else {
    const right = new Set(item.type === 'mc' ? [item.answer] : item.answer);
    app.querySelectorAll('.choice').forEach((el) => {
      const text = current.order[Number(el.dataset.index)];
      const picked = current.selected.has(Number(el.dataset.index));
      el.disabled = true;
      el.classList.remove('selected');
      const mark = el.querySelector('.mark');
      if (right.has(text) && picked) {
        el.classList.add('correct');
        mark.textContent = '✓';
      } else if (right.has(text)) {
        el.classList.add(item.type === 'multi' ? 'missed' : 'correct');
        if (item.type !== 'multi') mark.textContent = '✓';
      } else if (picked) {
        el.classList.add('wrong');
        mark.textContent = '✕';
      }
    });
  }
  const submit = document.getElementById('submit-btn');
  submit.remove();
  app.querySelector('[data-action="end-placement"]')?.remove();

  let answerHtml = '';
  if (!correct) {
    if (item.type === 'text') {
      answerHtml = `<div class="correct-answer"><b>Accepted answer:</b> ${esc(item.accept[0])}${item.accept.length > 1 ? ` <span class="muted small">(also: ${item.accept.slice(1).map(esc).join(', ')})</span>` : ''}</div>`;
    } else if (item.type === 'mc') {
      answerHtml = `<div class="correct-answer"><b>Correct answer:</b> ${rich(item.answer)}</div>`;
    } else {
      answerHtml = `<div class="correct-answer"><b>Correct answers:</b><ul>${item.answer.map((a) => `<li>${rich(a)}</li>`).join('')}</ul></div>`;
    }
  }

  const isPlacement = mode === 'placement';
  const delta = isPlacement
    ? ''
    : `<div class="delta"><span>${esc(skillName(item.skill))}</span>${bar(result.after, result.after >= E.PARAMS.masteryThreshold ? 'ok' : '')}<span><b>${pct(result.before)}% → ${pct(result.after)}%</b></span></div>`;
  const events = result.events.length
    ? `<ul class="events">${result.events.map((e) => `<li class="${e.type}"><span aria-hidden="true">${EVENT_ICON[e.type] || '•'}</span> ${esc(e.text)}</li>`).join('')}</ul>`
    : '';

  const qm = document.getElementById('q-mastery');
  if (qm) qm.textContent = `${pct(result.after)}%`;

  const lastPlacement = isPlacement && state.placement.index >= state.placement.queue.length;
  document.getElementById('feedback').innerHTML = `
    <section class="card feedback ${correct ? 'ok' : 'bad'}" id="feedback-card">
      <h2>${correct ? '✓ Correct' : '✕ Not quite'}</h2>
      ${answerHtml}
      <p class="explanation">${rich(item.explanation)}</p>
      ${delta}
      ${events}
      <button id="next-btn" class="btn primary" data-action="next">${lastPlacement ? 'See placement results →' : 'Next question →'}</button>
      <button class="btn ghost" style="width:100%;margin-top:4px" data-action="home">Back to dashboard</button>
    </section>`;
  document.getElementById('feedback-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ------------------------------------------------------------------ placement

function startPlacement() {
  E.startPlacement(state, CONTENT);
  save();
  startSession({ type: 'placement' });
}

function finishPlacement(skipped) {
  const pl = E.finishPlacement(state, CONTENT, { skipped });
  save();
  const asked = pl.index;
  renderDone(
    'Placement complete',
    asked
      ? `You answered ${pl.correct} of ${asked} correctly. Your skill map has been seeded — skills you already know will be mastered quickly, and the tutor will focus on the rest.`
      : 'No problem — the tutor will start from the basics and adapt as you go.',
    { continueLabel: 'Start learning →' },
  );
}

function renderDone(title, text, { continueLabel } = {}) {
  session = null;
  render(`
    <header class="topbar"><div class="brand">${LOGO}<div>SOC Tutor<small>Adaptive analyst training</small></div></div></header>
    <section class="card">
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(text)}</p>
      ${continueLabel ? `<button class="btn primary" data-action="continue">${esc(continueLabel)}</button>` : ''}
      <button class="btn secondary" data-action="home">Back to dashboard</button>
    </section>`);
}

// ------------------------------------------------------------------ report

function renderReport() {
  session = null;
  const r = E.gapReport(state, CONTENT);
  const list = (items, fn, empty) => (items.length ? `<ul class="report-list">${items.map(fn).join('')}</ul>` : `<p class="empty">${empty}</p>`);

  const top = state.focus[state.focus.length - 1];
  const recIsFocus = r.recommendation && top && top.skillId === r.recommendation.skillId;
  const rec = r.recommendation
    ? `<section class="card recommend">
        <h2>🎯 Recommended next focus</h2>
        <p><b>${esc(skillName(r.recommendation.skillId))}</b></p>
        <p class="muted small">${esc(r.recommendation.reason)}</p>
        ${
          recIsFocus
            ? '<button class="btn primary" data-action="continue">Fix this gap now →</button>'
            : `<button class="btn primary" data-action="skill" data-skill="${r.recommendation.skillId}">Practice this skill →</button>`
        }
      </section>`
    : '';

  render(`
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">←</button>
      <div class="qbar-mid"><span class="mode learn">Gap report</span><span class="skill-label">Where you stand and what to fix next</span></div>
    </header>
    <section class="card hero">
      <div class="stats" style="margin-top:0">
        <div class="stat"><b>${r.answered}</b><span>Answered</span></div>
        <div class="stat"><b>${r.answered ? pct(r.accuracy) + '%' : '–'}</b><span>Accuracy</span></div>
        <div class="stat"><b>${r.reviewCount}</b><span>To review</span></div>
      </div>
    </section>
    ${rec}
    <section class="card">
      <h2>🧩 Root gaps identified</h2>
      <p class="muted small">Building blocks the tutor found to be behind your mistakes elsewhere.</p>
      ${list(
        r.rootGaps,
        (g) => `<li class="root-gap"><div class="row"><span class="name">${esc(g.name)}</span><span class="chip gap">${pct(g.p)}%</span></div>
          <div class="sub">Needed for: ${g.neededFor.map(esc).join(', ')}</div></li>`,
        'None found so far. When you miss questions, the tutor checks the prerequisites and lists any weak ones here.',
      )}
      ${
        r.otherGaps.length
          ? `<p class="muted small" style="margin-top:12px">Also flagged (will improve once the root gap is fixed):</p>${list(r.otherGaps, (g) => `<li><div class="row"><span class="name">${esc(g.name)}</span><span class="chip gap">${pct(g.p)}%</span></div><div class="sub">Needed for: ${g.neededFor.map(esc).join(', ')}</div></li>`, '')}`
          : ''
      }
      ${r.resolvedGaps.length ? `<p class="muted small" style="margin-top:12px">Gaps you've already closed:</p><div class="pill-list">${r.resolvedGaps.map((g) => `<span class="pill">✓ ${esc(g.name)}</span>`).join('')}</div>` : ''}
    </section>
    <section class="card">
      <h2>📉 Weak skills</h2>
      ${list(
        r.weak,
        (s) => `<li><div class="row"><span class="name">${esc(s.name)}</span><span class="small muted">${pct(s.p)}%</span></div>
          ${bar(s.p, 'thin')}
          <div class="sub">${s.correct}/${s.attempts} correct${s.outstanding ? ` · ${s.outstanding} waiting for review` : ''}</div></li>`,
        'No weak skills right now.',
      )}
    </section>
    <section class="card">
      <h2>❌ Most-missed questions</h2>
      ${list(
        r.mostMissed,
        (m) => `<li><div class="name small">${rich(m.prompt)}</div>
          <div class="sub">${esc(m.skillName)} · missed ${m.misses}× of ${m.attempts}${m.inReview ? ' · in review list' : ' · cleared'}</div></li>`,
        'Nothing missed yet.',
      )}
    </section>
    <section class="card">
      <h2>✅ Mastered skills</h2>
      ${r.mastered.length ? `<div class="pill-list">${r.mastered.map((s) => `<span class="pill">${esc(s.name)}</span>`).join('')}</div>` : '<p class="empty">None yet — keep going!</p>'}
    </section>
    <button class="btn primary" data-action="continue">Continue learning →</button>
    <button class="btn secondary" data-action="home">Back to dashboard</button>
  `);
}

// ------------------------------------------------------------------ events

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  switch (action) {
    case 'home':
      return renderHome();
    case 'continue':
      if (!state.placement) E.finishPlacement(state, CONTENT, { skipped: true });
      return startSession({ type: 'auto' });
    case 'review':
      return startSession({ type: 'review' });
    case 'skill':
      return startSession({ type: 'skill', skillId: el.dataset.skill });
    case 'report':
      return renderReport();
    case 'placement':
      return startPlacement();
    case 'skip-placement':
      E.finishPlacement(state, CONTENT, { skipped: true });
      save();
      return startSession({ type: 'auto' });
    case 'end-placement':
      return finishPlacement(true);
    case 'choose':
      return choose(Number(el.dataset.index));
    case 'submit':
      return submitAnswer();
    case 'next':
      return showNext();
    case 'reset':
      if (window.confirm('Reset all progress? This erases your mastery, review list and gap report on this device.')) {
        clearState();
        state = E.createState(CONTENT);
        save();
        renderHome();
      }
      return undefined;
    default:
      return undefined;
  }
});

renderHome();

// Rule builder: Sigma-lite and YARA-lite, replayed against labelled samples.
import { CONTENT } from '../content/index.js';
import * as G from './game.js';
import * as L from './lab/lab.js';
import * as R from './lab/rules.js';
import { icon } from './icons.js';

let ctx = null;
export function initRuleUi(c) { ctx = c; }

const st = () => ctx.getState();
const lab = () => L.ensureLab(st());
const esc = (s) => ctx.esc(s);
const exercises = () => CONTENT.lab?.ruleExercises || [];
const byId = (id) => exercises().find((x) => x.id === id);
const DIFF = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

let view = null;

function qbar(label, sub, back, backLabel) {
  return `<header class="qbar">
      <button class="icon-btn" data-action="${back}" aria-label="${esc(backLabel)}">${icon('back')}</button>
      <div class="qbar-mid">${ctx.chip([label, 'info'], 'mode')}<span class="skill-label">${esc(sub)}</span></div>
    </header>`;
}

const CHIPS = {
  sigma: ['EventID == ', 'Image contains ', 'ParentImage contains ', 'IpAddress startswith ', 'not ', 'logsource '],
  yara: ['$a = "" nocase', '$b = "" nocase', 'condition: all', 'condition: any', 'condition: 1'],
};

export function renderRuleList() {
  view = { screen: 'list' };
  const solved = L.labStats(st()).rulesSolved;
  const cards = exercises().map((ex) => {
    const rec = lab().rules[ex.id];
    const status = rec?.perfect ? ['Perfect', 'ok'] : rec?.solved ? ['Solved', 'ok'] : rec?.attempts ? ['In progress', 'info'] : ['New', 'ready'];
    return `<li class="case-card ${rec?.solved ? 'solved' : ''}">
        <div class="case-top"><span class="mono case-id">${ex.kind === 'yara' ? 'YARA' : 'SIGMA'}</span><span class="case-diff mono">${DIFF[ex.difficulty]}</span>${ctx.chip(status)}</div>
        <div class="case-title">${esc(ex.title)}</div>
        <p class="small muted">${esc(ex.brief)}</p>
        <div class="case-req small"><span class="req-skill">${esc(ctx.skillName(ex.skill))}</span><span class="req-skill mono">${ex.samples.length} samples</span><span class="req-skill mono">${L.LAB_XP.rule[ex.difficulty]} XP</span></div>
        <button class="btn ${rec?.solved ? 'secondary' : 'primary'}" data-action="rule-open" data-id="${ex.id}">${icon('terminal')}${rec?.solved ? 'Replay' : 'Build'}</button>
      </li>`;
  }).join('');
  ctx.setScreen('lab-rules');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('RULE LAB', 'Sigma and YARA', 'home', 'Back to dashboard')}
    ${ctx.panel({ title: 'How grading works', icon: 'target', hud: true, body: `<ol class="howto small">
        <li>Write a <b>Sigma-lite</b> rule (every line is AND, <code>not</code> excludes) or a <b>YARA-lite</b> rule (<code>$a = "text" nocase</code>, <code>condition: any|all</code>).</li>
        <li>Run it. Each labelled sample comes back <b>TP, FP, FN or TN</b>.</li>
        <li>Full marks only when every malicious sample hits and no benign sample does. A rule that matches everything fails.</li>
      </ol>` })}
    ${ctx.panel({ title: 'Exercises', icon: 'flag', meta: `${solved}/${exercises().length}`, body: `<ul class="case-list">${cards}</ul>` })}
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

export function renderRule(id) {
  const ex = byId(id);
  if (!ex) return renderRuleList();
  const rec = lab().rules[ex.id] || {};
  const text = view?.id === id && view.text != null ? view.text : rec.text || starter(ex);
  view = { screen: 'rule', id, text, hints: view?.id === id ? view.hints || 0 : 0, out: view?.id === id ? view.out : null };
  ctx.setScreen('lab-rule');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('RULE LAB', ex.title, 'rule-list', 'Back to exercises')}
    <section class="alert-card sev-medium mission">
      <div class="ac-head">${icon('terminal')}<span class="mono">${ex.kind.toUpperCase()}</span>${ctx.chip(rec.perfect ? ['Perfect', 'ok'] : ['Open', 'info'])}<span class="ac-time mono">${L.LAB_XP.rule[ex.difficulty]} XP</span></div>
      <div class="ac-name">${esc(ex.title)}</div>
      <p class="ac-detail small">${esc(ex.brief)}</p>
    </section>
    ${ctx.panel({ title: ex.kind === 'yara' ? 'YARA-lite' : 'Sigma-lite', icon: 'terminal', hud: true, body: editorHtml(ex, text) })}
    <div id="rule-out">${outHtml(ex)}</div>
    ${ctx.panel({ title: 'Hints', icon: 'alert', body: hintsHtml(ex) })}
    ${rec.solved ? debrief(ex) : ''}
    <button class="btn secondary" data-action="rule-list">${icon('back')}All exercises</button>
  `);
}

function starter(ex) {
  return ex.kind === 'yara' ? '$a = "" nocase\ncondition: any' : `logsource ${ex.samples[0].source}\n`;
}

function editorHtml(ex, text) {
  return `<textarea id="rule-text" class="qe-text" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(text)}</textarea>
    <div class="qe-chips">${CHIPS[ex.kind].map((t) => `<button type="button" class="qchip cmds" data-action="rule-chip" data-ins="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="qe-actions"><button class="btn primary" data-action="rule-run">${icon('play')}Replay samples</button></div>
    <p class="small muted">${ex.samples.length} labelled samples. You do not see which are malicious until you run.</p>`;
}

function outHtml(ex) {
  const out = view.out;
  if (!out) return '';
  if (out.err) return `<div class="alert crit q-err" role="alert"><div class="alert-tag">${icon('x')}<span>Rule error</span></div><div class="alert-msg">${esc(out.err)}</div></div>`;
  const g = out.grade;
  const rows = g.detail.map((d) => `<li class="rule-sample ${d.bucket}"><span class="mono bucket">${d.bucket.toUpperCase()}</span><span>${esc(d.id)}</span><span class="small muted">${esc(d.note)}</span></li>`).join('');
  const head = g.passed
    ? `<div class="alert ok-alert"><div class="alert-tag">${icon('check')}<span>Clean rule</span></div><div class="alert-msg">TP ${g.tp} · FP ${g.fp} · FN ${g.fn} · TN ${g.tn}. ${g.score}%${out.xp ? ` <b class="ok-text">+${out.xp} XP</b>` : ''}</div></div>`
    : `<div class="alert warn"><div class="alert-tag">${icon('alert')}<span>${g.score}%</span></div><div class="alert-msg">TP ${g.tp} · FP ${g.fp} · FN ${g.fn} · TN ${g.tn}. ${g.fp ? 'Benign samples matched (false positives). ' : ''}${g.fn ? 'Malicious samples missed (false negatives).' : ''}</div></div>`;
  return `${head}<ul class="rule-samples">${rows}</ul>`;
}

function hintsHtml(ex) {
  const n = view.hints || 0;
  const list = ex.hints.slice(0, n).map((h, i) => `<li><span class="mono accent-text">H${i + 1}</span> ${esc(h)}</li>`).join('');
  return `${list ? `<ol class="hint-list small">${list}</ol>` : '<p class="small muted">No hints used. Hints do not change the XP for rules; the score does.</p>'}
    ${n < ex.hints.length ? `<button class="btn secondary" data-action="rule-hint">${icon('alert')}Show hint ${n + 1}</button>` : ''}`;
}

function debrief(ex) {
  const model = ex.model.sigma || ex.model.yara;
  return ctx.panel({ title: 'Debrief', icon: 'award', cls: 'debrief', body: `<p>${esc(ex.explain)}</p><div class="label">One rule that passes</div><pre class="mono">${esc(model)}</pre>` });
}

function run() {
  const ex = byId(view.id);
  const text = document.getElementById('rule-text')?.value ?? '';
  view.text = text;
  try {
    const grade = R.gradeRule(ex, text);
    const paid = L.recordScored(st(), 'rule', ex, { score: grade.score, passed: grade.passed, perfect: grade.perfect, text, now: ctx.now() });
    const g = G.onLab(st().game, st(), CONTENT, { xp: paid.xp, breakdown: paid.breakdown, reason: ex.id, now: ctx.now() });
    view.out = { grade, xp: g.xp };
    ctx.save();
    ctx.xpToast(g.xp);
    ctx.queueAchievements(g);
    ctx.refreshStatusXp();
  } catch (e) {
    view.out = { err: e.message || String(e) };
    ctx.save();
  }
  renderRule(ex.id);
  document.getElementById('rule-out')?.scrollIntoView({ block: 'start' });
}

export function handleClick(action, el) {
  switch (action) {
    case 'rule-list':
      renderRuleList();
      return true;
    case 'rule-open':
      view = { screen: 'rule', id: el.dataset.id };
      renderRule(el.dataset.id);
      return true;
    case 'rule-run':
      run();
      return true;
    case 'rule-hint':
      view.hints = Math.min((view.hints || 0) + 1, byId(view.id).hints.length);
      renderRule(view.id);
      return true;
    case 'rule-chip': {
      const ta = document.getElementById('rule-text');
      if (!ta) return true;
      const ins = el.dataset.ins.replace('""', '"');
      const start = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(ta.selectionEnd ?? start);
      const pad = before && !before.endsWith('\n') ? '\n' : '';
      ta.value = before + pad + ins + after;
      view.text = ta.value;
      ta.focus();
      return true;
    }
    default:
      return false;
  }
}

export function handleInput(e) {
  if (e.target?.id === 'rule-text' && view?.screen === 'rule') {
    view.text = e.target.value;
    if (e.type === 'change') {
      const rec = (lab().rules[view.id] ??= { solved: false, best: 0, xpPaid: 0, attempts: 0 });
      rec.text = e.target.value.slice(0, 4000);
      ctx.save();
    }
    return true;
  }
  return false;
}

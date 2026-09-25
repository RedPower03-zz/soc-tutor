// Operations UI: career ladder view, SIEM investigations and the First shift capstone.
// Screens render into #app through the helpers app.js passes in (see initOps).
import { CONTENT } from '../content/index.js';
import { SIEM_SOURCES, VERDICTS, CONFIDENCE, NEXT_STEPS } from '../content/siem-cases.js';
import * as E from './engine.js';
import * as G from './game.js';
import * as S from './siem.js';
import * as C from './capstone.js';
import { icon } from './icons.js';
import { rankInsignia } from './insignia.js';

let ctx = null; // { getState, save, now, render, statusBar, panel, chip, esc, rich, pad, bar, xpToast, queueAchievements, refreshStatusXp, openLesson, renderHome, skillName, setScreen }

const st = () => ctx.getState();
const esc = (s) => ctx.esc(s);
const fmt = (n) => Number(n).toLocaleString('en-US');
const DIFF = { 1: ['Easy', 'ok'], 2: ['Medium', 'warn'], 3: ['Hard', 'crit'] };
const SEV = { low: ['Low', 'dim'], medium: ['Medium', 'warn'], high: ['High', 'crit'], critical: ['Critical', 'crit'] };

export function initOps(c) {
  ctx = c;
}

/** Stable pseudo-random order (so option lists don't give answers away by position, and don't jump around). */
function stableOrder(list, key = (x) => x) {
  const h = (s) => [...String(s)].reduce((a, ch) => (Math.imul(a ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);
  return [...list].sort((a, b) => h(key(a)) - h(key(b)));
}

function qbar(label, sub, back = 'home', backLabel = 'Back to dashboard') {
  return `<header class="qbar">
      <button class="icon-btn" data-action="${back}" aria-label="${esc(backLabel)}">${icon('back')}</button>
      <div class="qbar-mid">${ctx.chip([label, 'info'], 'mode')}<span class="skill-label">${esc(sub)}</span></div>
    </header>`;
}

// =================================================================== career

function reqRow(r) {
  const cls = r.met ? 'met' : r.soon ? 'soon' : 'unmet';
  const frac = r.target ? Math.min(1, r.current / r.target) : 0;
  return `<li class="req ${cls}">
      <span class="req-ico">${icon(r.met ? 'check' : r.soon ? 'clock' : 'lock')}</span>
      <span class="req-main"><span class="req-label">${esc(r.label)}${r.soon ? ' <em>coming soon</em>' : ''}</span>
        ${!r.met && !r.soon ? `<span class="req-bar">${ctx.bar(frac)}</span>` : ''}</span>
      <span class="req-num mono">${r.xp ? `${fmt(r.current)}/${fmt(r.target)}` : `${r.current}/${r.target}`}</span>
    </li>`;
}

/** Next-rank requirement checklist (dashboard operator card and career view). */
export function nextRankBlock(compact = false) {
  const g = st().game;
  const ri = G.rankIndex(g.rankId);
  const next = G.RANKS[ri + 1];
  if (!next) return '<p class="small muted">Top of the ladder.</p>';
  const rows = G.rankRequirements(next, g, st(), CONTENT);
  const left = rows.filter((r) => !r.met).length;
  return `<div class="next-rank ${compact ? 'compact' : ''}">
      <div class="label row"><span>Next rank · ${esc(next.title)}</span><span class="mono ${left ? '' : 'ok-text'}">${left ? `${left} to go` : 'ready'}</span></div>
      <ul class="req-list">${rows.map(reqRow).join('')}</ul>
    </div>`;
}

/** 16-segment ladder strip, banded by curriculum tier. */
export function ladderStrip() {
  const g = st().game;
  const ri = G.rankIndex(g.rankId);
  const reach = G.rankIndex(G.reachableRank(CONTENT).id);
  const segs = G.RANKS.map((r, i) => {
    const cls = i < ri ? 'done' : i === ri ? 'current' : i <= reach ? 'open' : 'planned';
    const bandStart = i > 0 && G.RANKS[i - 1].band !== r.band ? 'band-start' : '';
    return `<i class="${cls} ${bandStart}" title="${esc(r.title)}"></i>`;
  }).join('');
  const bands = G.tiersOf(CONTENT)
    .map((t) => ({ t, n: G.RANKS.filter((r) => r.band === t.id).length }))
    .filter((b) => b.n)
    .map((b) => `<span style="flex:${b.n}">L${b.t.level} ${esc(b.t.short || b.t.name)}</span>`)
    .join('');
  return `<div class="ladder-strip" role="img" aria-label="Career rank ${ri + 1} of ${G.RANKS.length}">${segs}</div>
    <div class="ladder-bands">${bands}</div>`;
}

export function ladderNoticeBanner() {
  const n = st().game.ladderNotice;
  if (!n) return '';
  const kept = (st().game.keptTitles || []).includes(n.fromTitle);
  return `<div class="alert info notice" role="status">
      <div class="alert-tag">${icon('ladder')}<span>Career ladder updated</span></div>
      <div class="alert-msg">The ladder now spans all three curriculum levels with ${G.RANKS.length} ranks, so your rank is now <b>${esc(n.toTitle)}</b> (was ${esc(n.fromTitle)}). Your XP and badges are unchanged${kept ? `, and <b>${esc(n.fromTitle)}</b> stays equippable under Profile → Titles` : ''}.
        <button class="btn mini secondary" data-action="dismiss-notice">${icon('check')}Got it</button></div>
    </div>`;
}

const soonTiers = () => G.tiersOf(CONTENT).filter((t) => t.status !== 'available');
const levelsText = (ts) => ts.map((t) => t.level).join(' and ');
function restOfLadder() {
  const soon = soonTiers();
  return soon.length ? ` The rest of the ladder is for Level ${levelsText(soon)}.` : '';
}
function soonLine() {
  const soon = soonTiers();
  return soon.length ? `Ranks below open as Level ${levelsText(soon)} ${soon.length > 1 ? 'modules ship' : 'ships'}.` : 'Ranks below need more XP and progress.';
}

/** "Plus Operations" line under a built level: its SIEM cases and capstones. */
function tierOpsLine(t) {
  const cases = CONTENT.siemCases.filter((c) => (c.tier || 'l1') === t.id).length;
  const caps = CONTENT.scenarios.filter((s) => s.kind === 'capstone' && s.status !== 'in-development' && (s.tier || (s.id === 'first-shift' ? 'l1' : null)) === t.id);
  if (!cases && !caps.length) return '';
  const parts = [cases ? `${cases} SIEM case${cases > 1 ? 's' : ''}` : '', ...caps.map((s) => `the ${s.title} capstone`)].filter(Boolean);
  return `<p class="small muted tier-ops">${icon('target')}Plus Operations: ${esc(parts.join(' and '))}.</p>`;
}

export function renderCareer() {
  const g = st().game;
  const ri = G.rankIndex(g.rankId);
  const reach = G.reachableRank(CONTENT);
  const reachI = G.rankIndex(reach.id);
  const budget = G.xpBudget(CONTENT);

  const tiers = G.tiersOf(CONTENT)
    .map((t) => {
      const p = G.tierProgress(st(), CONTENT, t.id);
      const skills = G.tierSkills(CONTENT, t.id);
      const avail = t.status === 'available';
      return `<li class="tier ${avail ? 'avail' : 'soon'}">
          <div class="tier-head"><span class="tier-lvl mono">L${t.level}</span><b>${esc(t.name)}</b>${avail ? ctx.chip([`${p.mastered}/${p.total} mastered`, p.mastered === p.total ? 'ok' : 'info']) : ctx.chip(['Coming soon', 'dim'])}</div>
          <p class="small muted">${esc(t.summary)}</p>
          ${avail ? ctx.bar(p.total ? p.mastered / p.total : 0, p.mastered === p.total ? 'ok' : '') : `<div class="pill-list">${skills.map((s) => `<span class="chip dim pill">${esc(s.name)}</span>`).join('')}</div>`}
          ${avail ? tierOpsLine(t) : ''}
        </li>`;
    })
    .join('');

  let lastBand = null;
  const rungs = G.RANKS.map((r, i) => {
    const stt = i < ri ? 'done' : i === ri ? 'current' : 'locked';
    const rows = G.rankRequirements(r, g, st(), CONTENT);
    const soon = rows.some((x) => x.soon);
    const tier = G.tiersOf(CONTENT).find((t) => t.id === r.band);
    const head = r.band !== lastBand ? `<li class="band-head"><span class="mono">L${tier?.level ?? '?'}</span> ${esc(tier?.name || r.band)}${tier && tier.status !== 'available' ? ' <em>coming soon</em>' : ''}</li>` : '';
    lastBand = r.band;
    const themes = G.THEMES.filter((t) => t.rank === r.id);
    const reachLine = i === reachI && reachI < G.RANKS.length - 1
      ? `<li class="reach-line"><span>${icon('flag')}Today's content reaches this far. ${esc(soonLine())}</span></li>`
      : '';
    return `${head}<li class="rung ${stt} ${soon && stt === 'locked' ? 'soon' : ''}" ${i === ri ? 'id="you-are-here"' : ''}>
        <span class="rung-ins">${rankInsignia(i, 'sm')}</span>
        <span class="rung-main">
          <span class="rung-top"><span class="rung-name"><span class="mono rung-no">${ctx.pad(i + 1)}</span>${esc(r.title)}</span>${
            stt === 'current' ? ctx.chip(['You are here', 'info']) : stt === 'done' ? ctx.chip(['Achieved', 'ok']) : soon ? ctx.chip(['Planned', 'dim']) : ctx.chip(['Locked', 'dim'])
          }</span>
          ${
            stt === 'locked' && i === ri + 1
              ? `<ul class="req-list">${rows.map(reqRow).join('')}</ul>`
              : `<span class="rung-req small">${r.xp ? `${fmt(r.xp)} XP` : 'Starting rank'}${(r.gates || []).length ? ` · ${rows.filter((x) => !x.xp).map((x) => `${esc(x.label)}${x.soon ? ' (coming soon)' : ''}`).join(' · ')}` : ''}</span>`
          }
          ${themes.length ? `<span class="rung-unlock small">${icon('palette')}Unlocks ${themes.map((t) => esc(t.name)).join(', ')} theme</span>` : ''}
        </span>
      </li>${reachLine}`;
  }).join('');

  ctx.setScreen('career');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('Career', 'Rank ladder and curriculum')}
    ${ctx.panel({
      title: 'You are here',
      icon: 'ladder',
      meta: `Rank ${ctx.pad(ri + 1)}/${ctx.pad(G.RANKS.length)}`,
      hud: true,
      cls: 'career-top',
      body: `<div class="op-id">
          <div class="op-insignia">${rankInsignia(ri)}</div>
          <div class="op-main"><div class="op-title">${esc(G.RANKS[ri].title)}</div><div class="op-rank muted small">Level ${ctx.pad(g.level)} of ${G.MAX_LEVEL} · ${fmt(g.xp)} XP</div></div>
        </div>
        <div class="spaced-top">${ladderStrip()}</div>
        ${nextRankBlock()}`,
    })}
    ${ctx.panel({
      title: 'Curriculum',
      icon: 'layers',
      meta: `${G.tiersOf(CONTENT).length} levels`,
      body: `<ul class="tiers">${tiers}</ul>
        <p class="small muted">Everything built today is worth about <b class="mono">${fmt(budget.total)} XP</b> done once and done well: level ${budget.atTotal.level} and <b>${esc(budget.atTotal.rank.title)}</b>, rank ${budget.atTotal.rankIndex + 1} of ${G.RANKS.length}. ${restOfLadder()}</p>`,
    })}
    ${ctx.panel({ title: 'Career ladder', icon: 'chart', meta: `${reachI + 1} of ${G.RANKS.length} open`, cls: 'ladder-panel', body: `<ol class="ladder">${rungs}</ol><p class="small muted">Each rank needs XP <b>and</b> curriculum progress, so XP alone never skips ahead. Your rank never goes down during training.</p>` })}
    <button class="btn secondary" data-action="profile">${icon('award')}Profile, titles &amp; themes</button>
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

// =================================================================== operations panel (dashboard)

export function operationsPanel() {
  const learned = E.learnedSkills(st(), CONTENT);
  const minL = E.PARAMS.interleaveMinLearned;
  const rows = CONTENT.scenarios
    .map((sc) => {
      if (sc.kind === 'mixed') {
        const ok = learned.length >= minL;
        return `<li class="op-row ${ok ? '' : 'locked'}">
          <span class="op-ico">${icon('shuffle')}</span>
          <span class="op-body"><b>${esc(sc.title)}</b><em>${ok ? `Evidence from your ${learned.length} learned skills, shuffled.` : `Unlocks when you have learned ${minL} skills (${learned.length}/${minL}).`}</em></span>
          <button class="btn mini ${ok ? 'primary' : ''}" data-action="mixed" ${ok ? '' : 'disabled'}>${ok ? 'Start' : icon('lock')}</button>
        </li>`;
      }
      if (sc.kind === 'investigation') {
        const cases = CONTENT.siemCases;
        const open = cases.filter((c) => S.caseUnlocked(c, learned)).length;
        const solved = cases.filter((c) => st().siem.cases[c.id]?.solved).length;
        const pips = cases.map((c) => `<i class="${st().siem.cases[c.id]?.solved ? 'done' : S.caseUnlocked(c, learned) ? 'on' : ''}" title="${esc(c.title)}"></i>`).join('');
        return `<li class="op-row ${open ? '' : 'locked'}">
          <span class="op-ico">${icon('search')}</span>
          <span class="op-body"><b>${esc(sc.title)}</b><em>${open ? `${open} of ${cases.length} cases open · ${solved} solved` : 'Cases open as you learn the skills they rely on.'}</em>
            <span class="op-stages">${pips}<span>${solved}/${cases.length} solved</span></span></span>
          <button class="btn mini ${open ? 'primary' : ''}" data-action="siem">${open ? 'Open' : 'View'}</button>
        </li>`;
      }
      if (sc.kind === 'capstone' && sc.status !== 'in-development') {
        const p = C.capstoneProgress(sc, st());
        const ready = sc.stages.findIndex((s) => C.stageStatus(sc, s.id, st(), CONTENT).unlocked && !C.stageDone(st(), sc.id, s.id));
        const pips = sc.stages.map((s) => {
          const ss = C.stageStatus(sc, s.id, st(), CONTENT);
          return `<i class="${ss.done ? 'done' : ss.unlocked ? 'on' : ''}" title="${esc(s.title)}"></i>`;
        }).join('');
        const escOpen = C.escalationUnlocked(sc, st());
        const line = p.completed
          ? `Completed · escalation ${p.score}/100`
          : escOpen
            ? 'All stages done. Write your escalation.'
            : ready >= 0
              ? `Stage ${ready + 1} of ${p.stages} is ready.`
              : p.stagesDone
                ? 'Next stage opens after its lessons.'
                : 'Stages open as you finish the related lessons.';
        const active = ready >= 0 || escOpen || p.stagesDone;
        return `<li class="op-row ${active || p.completed ? '' : 'locked'}">
          <span class="op-ico">${icon('flag')}</span>
          <span class="op-body"><b>${esc(sc.title)}</b><em>${esc(line)}</em>
            <span class="op-stages">${pips}<i class="${p.completed ? 'done' : escOpen ? 'on' : ''} esc-pip" title="Escalation"></i><span>${p.stagesDone}/${p.stages} stages</span></span></span>
          <button class="btn mini ${active && !p.completed ? 'primary' : ''}" data-action="capstone" data-id="${sc.id}">${p.completed ? 'Review' : active ? 'Open' : 'View'}</button>
        </li>`;
      }
      return `<li class="op-row locked"><span class="op-ico">${icon('flag')}</span><span class="op-body"><b>${esc(sc.title)}</b><em>${esc(sc.summary)}</em></span>${ctx.chip(['Soon', 'dim'])}</li>`;
    })
    .join('');
  return ctx.panel({ title: 'Operations', icon: 'target', meta: 'Investigate & respond', cls: 'ops', body: `<ul class="op-list">${rows}</ul>` });
}

// =================================================================== SIEM: case list

let inv = null; // live investigation (also persisted in state.siem.active)
let live = ''; // search box text while typing (committed as a search after a pause)
let commitTimer = null;
let openRow = null;
let siemResult = null;

const caseById = (id) => CONTENT.siemCases.find((c) => c.id === id);
const ambTag = () => `<span class="amb-tag" title="The logs don't settle this one">${icon('alert')}Ambiguous</span>`;
const diffPips = (d) => `<span class="diff" title="${DIFF[d][0]}">${[1, 2, 3].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>`;

export function renderSiemList() {
  inv = null;
  const learned = E.learnedSkills(st(), CONTENT);
  const active = st().siem.active;
  const cards = CONTENT.siemCases
    .map((c) => {
      const rec = st().siem.cases[c.id];
      const open = S.caseUnlocked(c, learned);
      const status = !open ? ['Locked', 'dim'] : rec?.solved ? [`Solved · ${rec.best}`, 'ok'] : active?.caseId === c.id ? ['In progress', 'info'] : rec ? [`Best ${rec.best}`, 'warn'] : ['New', 'ready'];
      const req = c.requires.skills.map((s) => `<span class="req-skill ${learned.includes(s) ? 'ok' : ''}">${icon(learned.includes(s) ? 'check' : 'lock')}${esc(ctx.skillName(s))}</span>`).join('');
      return `<li class="case-card ${open ? '' : 'locked'} ${rec?.solved ? 'solved' : ''} ${c.ambiguous ? 'amb' : ''}">
          <div class="case-top"><span class="mono case-id">${esc(c.alert.id)}</span>${diffPips(c.difficulty)}<span class="case-diff mono">${DIFF[c.difficulty][0]}</span>${c.tier === 'l2' ? '<span class="case-tier">L2</span>' : ''}${ctx.chip(status)}</div>
          <div class="case-title">${esc(c.title)}${c.ambiguous ? ambTag() : ''}</div>
          <div class="case-alert small">${ctx.chip(SEV[c.alert.severity] || ['Alert', 'warn'])}<span>${esc(c.alert.name)}</span></div>
          <p class="small muted">${esc(c.summary)}</p>
          <div class="case-req small"><span class="label">Relies on</span>${req}</div>
          <button class="btn ${open ? (rec?.solved ? 'secondary' : 'primary') : 'secondary'}" ${open ? `data-action="siem-open" data-case="${c.id}"` : 'disabled'}>${
            open ? `${icon('search')}${active?.caseId === c.id ? 'Resume investigation' : rec ? 'Investigate again' : 'Investigate'}` : `${icon('lock')}Learn the skills above to unlock`
          }</button>
        </li>`;
    })
    .join('');
  ctx.setScreen('siem-list');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('SIEM', 'Investigation cases')}
    ${ctx.panel({
      title: 'How it works',
      icon: 'terminal',
      hud: true,
      body: `<ol class="howto small">
          <li><b>Read the alert.</b> Note the host, user and time.</li>
          <li><b>Search and filter</b> the logs by source, host, user, event type, time or free text. Tap a row to pivot on its IPs, domains, host or user.</li>
          <li><b>Pin the evidence</b> that proves your case (and only that).</li>
          <li><b>Make the call</b>: true positive, benign true positive or false positive, with a short write-up.</li>
        </ol>
        <p class="src-legend small">${Object.entries(SIEM_SOURCES).map(([id, x]) => `<span class="s-${id}"><b class="src-tag">${x.code}</b> ${esc(x.label)}</span>`).join('')}</p>
        <div class="score-legend mono small"><span>Verdict <b>${S.WEIGHTS.verdict}</b></span><span>Evidence <b>${S.WEIGHTS.evidence}</b></span><span>Efficiency <b>${S.WEIGHTS.efficiency}</b></span><span>Write-up <b>${S.WEIGHTS.writeup}</b></span></div>
        <p class="small muted">A case is solved with the right verdict and ${S.PASS_SCORE}+ points. XP scales with your score, and replays only pay for improvement.</p>
        <div class="amb-note small"><div class="row">${ambTag()}</div><p>Some cases can't be proven either way: logs are missing, or the evidence fits two stories. You still make the call, with a <b>confidence</b> level, what's <b>missing</b> and your <b>next steps</b>. They're graded on your reasoning, not on guessing right:</p>
          <div class="score-legend mono small"><span>Verdict <b>${S.AMBIG_WEIGHTS.verdict}</b></span><span>Missing <b>${S.AMBIG_WEIGHTS.gaps}</b></span><span>Next steps <b>${S.AMBIG_WEIGHTS.steps}</b></span><span>Confidence <b>${S.AMBIG_WEIGHTS.confidence}</b></span><span>Evidence <b>${S.AMBIG_WEIGHTS.evidence}</b></span><span>Write-up <b>${S.AMBIG_WEIGHTS.writeup}</b></span></div></div>`,
    })}
    ${ctx.panel({ title: 'Case queue', icon: 'list', meta: `${CONTENT.siemCases.filter((c) => st().siem.cases[c.id]?.solved).length}/${CONTENT.siemCases.length} solved`, body: `<ul class="case-list">${cards}</ul>` })}
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

// =================================================================== SIEM: investigation

function openCase(id) {
  const c = caseById(id);
  const active = st().siem.active;
  inv = active?.caseId === id ? active : S.newInvestigation(c, ctx.now());
  inv.verdict ??= null;
  inv.writeup ??= '';
  inv.confidence ??= null;
  inv.gaps ??= [];
  inv.steps ??= [];
  st().siem.active = inv;
  live = inv.query.text || '';
  openRow = null;
  ctx.save();
  renderInvestigation();
}

const currentQuery = () => ({ ...inv.query, text: live });

function commitQuery() {
  clearTimeout(commitTimer);
  commitTimer = null;
  if (S.applyQuery(inv, currentQuery())) ctx.save();
  updateStatus();
}

function srcTag(src) {
  return `<span class="src-tag s-${src}">${esc(SIEM_SOURCES[src]?.code || src)}</span>`;
}

function logRow(r, { interactive = true, pinned = false, expanded = false, mark = '' } = {}) {
  const who = `${esc(r.host)}${r.user ? ` · ${esc(r.user)}` : ''}`;
  const inner = `<span class="lg-top"><span class="lg-t mono">${esc(r.t)}</span>${srcTag(r.src)}<span class="lg-type">${esc(r.type)}</span>${pinned ? `<span class="lg-pin">${icon('pin')}</span>` : ''}</span>
      <span class="lg-who mono">${who}</span>
      <span class="lg-msg mono">${esc(r.msg)}</span>`;
  if (!interactive) return `<li class="lg-row static ${mark}">${inner}</li>`;
  const pv = S.pivots(r);
  return `<li class="lg-row ${pinned ? 'pinned' : ''} ${expanded ? 'open' : ''}" data-row-id="${r.id}">
      <button class="lg-main" data-action="siem-row" data-row="${r.id}" aria-expanded="${expanded}">${inner}</button>
      ${
        expanded
          ? `<div class="lg-actions">
              <button class="btn mini ${pinned ? 'secondary' : 'primary'} pin-btn" data-action="siem-pin" data-row="${r.id}">${icon('pin')}${pinned ? 'Unpin' : 'Pin as evidence'}</button>
              <div class="pivots"><span class="label">Pivot to</span>${pv.map((p) => `<button class="pivot" data-action="siem-pivot" data-kind="${p.kind}" data-value="${esc(p.value)}"><span>${p.kind}</span>${esc(p.value)}</button>`).join('')}</div>
            </div>`
          : ''
      }
    </li>`;
}

function sourcesHtml(c) {
  const on = new Set(inv.query.sources);
  return Object.entries(SIEM_SOURCES)
    .filter(([id]) => c.logs.some((r) => r.src === id))
    .map(([id, s]) => `<button class="src-chip s-${id} ${on.has(id) ? 'on' : ''}" data-action="siem-src" data-src="${id}" aria-pressed="${on.has(id)}" aria-label="${esc(s.label)}" title="${esc(s.label)}"><b>${s.code}</b><span class="mono">${c.logs.filter((r) => r.src === id).length}</span></button>`)
    .join('');
}

function selectsHtml(c) {
  const sel = (id, label, field, values, cur, fmtOpt = (v) => v) =>
    `<label class="sf-sel"><span class="label">${label}</span><select id="${id}" data-field="${field}"><option value="">All</option>${values.map((v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(fmtOpt(v))}</option>`).join('')}</select></label>`;
  const windows = S.timeWindows(c);
  return `${sel('siem-host', 'Host', 'host', S.facet(c, 'host'), inv.query.host)}
    ${sel('siem-user', 'User', 'user', S.facet(c, 'user'), inv.query.user)}
    ${sel('siem-type', 'Event type', 'type', S.facet(c, 'type'), inv.query.type)}
    <label class="sf-sel"><span class="label">Time</span><select id="siem-window" data-field="window">${windows.map((w) => `<option value="${w.id}" ${w.id === (inv.query.window || 'all') ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}</select></label>`;
}

function statusHtml(c, shown) {
  const over = inv.queries > c.parQueries;
  return `<span><b>${shown}</b>/${c.logs.length} events</span><span class="${over ? 'warn-text' : ''}">${inv.queries} search${inv.queries === 1 ? '' : 'es'} <em>(par ${c.parQueries})</em></span><span class="accent-text">${icon('pin')}${inv.pins.length}</span>`;
}

function resultsHtml(c) {
  const rows = S.filterLogs(c, currentQuery());
  const pins = new Set(inv.pins);
  return {
    count: rows.length,
    html: rows.length ? rows.map((r) => logRow(r, { pinned: pins.has(r.id), expanded: openRow === r.id })).join('') : '<li class="lg-empty">No events match. Loosen a filter or clear the search.</li>',
  };
}

function pinnedHtml(c) {
  if (!inv.pins.length) return '<p class="empty">Nothing pinned yet. Tap a log row, then <b>Pin as evidence</b>.</p>';
  const rows = inv.pins.map((id) => c.logs.find((r) => r.id === id)).filter(Boolean).sort((a, b) => S.toSec(a.t) - S.toSec(b.t));
  return `<ul class="pin-list">${rows.map((r) => `<li><span class="mono">${esc(r.t)}</span>${srcTag(r.src)}<span class="pin-msg mono">${esc(r.msg)}</span><button class="icon-btn sm" data-action="siem-pin" data-row="${r.id}" aria-label="Unpin">${icon('x')}</button></li>`).join('')}</ul>`;
}

function trayHtml() {
  return `<span class="tray-count">${icon('pin')}<b>${inv.pins.length}</b> pinned</span>
    <button class="btn mini ghost" data-action="siem-top">${icon('filter')}Filters</button>
    <button class="btn mini primary" data-action="siem-goto-verdict">${icon('send')}Verdict</button>`;
}

function renderInvestigation() {
  const c = caseById(inv.caseId);
  const a = c.alert;
  const res = resultsHtml(c);
  ctx.setScreen('siem-inv');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('SIEM', `${c.title} · ${DIFF[c.difficulty][0]}${c.ambiguous ? ' · Ambiguous' : ''}`, 'siem', 'Back to cases')}
    ${c.ambiguous ? `<div class="alert warn amb-banner" role="note"><div class="alert-tag">${icon('alert')}<span>Ambiguous case</span></div><div class="alert-msg">The data may not settle this one. Find what you can, notice what's <b>missing</b>, then make the call anyway, and say how sure you are.</div></div>` : ''}
    <section class="alert-card sev-${a.severity}" aria-label="Alert">
      <div class="ac-head">${icon('alert')}<span class="mono">${esc(a.id)}</span>${ctx.chip(SEV[a.severity] || ['Alert', 'warn'])}<span class="ac-time mono">${esc(c.date)} ${esc(a.time)}</span></div>
      <div class="ac-name">${esc(a.name)}</div>
      <dl class="ac-meta mono"><div><dt>Host</dt><dd>${esc(a.host)}</dd></div><div><dt>User</dt><dd>${esc(a.user || '-')}</dd></div><div><dt>Source</dt><dd>${esc(a.source)}</dd></div></dl>
      <p class="ac-detail small">${esc(a.detail)}</p>
    </section>
    <div class="siem-work">
    <div class="siem-filters" id="siem-filters">
      <div class="sf-search">${icon('search')}<input id="siem-text" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search IP, domain, user, 4625…" value="${esc(live)}" aria-label="Search logs"><button class="icon-btn sm" data-action="siem-clear" aria-label="Clear all filters">${icon('reset')}</button></div>
      <div class="sf-sources" id="siem-sources" role="group" aria-label="Log sources">${sourcesHtml(c)}</div>
      <div class="sf-status mono" id="siem-status" aria-live="polite">${statusHtml(c, res.count)}</div>
    </div>
    <div class="sf-selects" id="siem-selects">${selectsHtml(c)}</div>
    <ol class="log-list" id="siem-results">${res.html}</ol>
    <div class="siem-tray" id="siem-tray">${trayHtml()}</div>
    </div>
    ${ctx.panel({
      title: 'Make the call',
      icon: 'send',
      id: 'siem-verdict',
      body: `<div class="label">Verdict</div>
        <div class="verdicts" role="radiogroup" aria-label="Verdict">${Object.entries(VERDICTS).map(([id, v]) => `<button class="verdict v-${id} ${inv.verdict === id ? 'on' : ''}" role="radio" aria-checked="${inv.verdict === id}" data-action="siem-verdict" data-v="${id}"><b>${esc(v.label)}</b><span>${esc(v.help)}</span></button>`).join('')}</div>
        ${c.ambiguous ? ambiguousFields(c) : ''}
        <div class="label spaced">Pinned evidence</div>
        <div id="siem-pinned">${pinnedHtml(c)}</div>
        <label class="field-label spaced" for="siem-writeup">Write-up</label>
        <textarea id="siem-writeup" class="text-answer writeup" rows="4" maxlength="800" placeholder="${c.ambiguous ? 'What do you think happened, what can\'t you confirm, and what would you do next? 1–3 sentences.' : 'What happened, and which evidence proves it? 1–3 sentences.'}">${esc(inv.writeup)}</textarea>
        <p class="small muted" id="siem-wc">${inv.writeup.trim().length} characters${inv.writeup.trim().length < S.MIN_WRITEUP ? ` · at least ${S.MIN_WRITEUP} to count` : ''}</p>
        <button class="btn primary" data-action="siem-submit" id="siem-submit" ${canSubmit(c) ? '' : 'disabled'}>${icon('send')}Submit verdict</button>
        <p class="btn-note" id="siem-note">${submitNote(c)}</p>`,
    })}
  `);
}

function canSubmit(c) {
  return !!inv.verdict && (!c.ambiguous || !!inv.confidence);
}
function submitNote(c) {
  if (!inv.verdict) return c.ambiguous ? 'Choose a verdict and a confidence level to submit.' : 'Choose a verdict to submit.';
  if (c.ambiguous && !inv.confidence) return 'Choose a confidence level to submit.';
  return 'You can still pin more evidence before submitting.';
}
function refreshSubmit(c) {
  document.getElementById('siem-submit').disabled = !canSubmit(c);
  document.getElementById('siem-note').textContent = submitNote(c);
}

/** Extra verdict-panel fields for ambiguous cases: confidence, what's missing, next steps. */
function ambiguousFields(c) {
  const ck = (group, id, text) => {
    const on = inv[group].includes(id);
    return `<label class="ck ${on ? 'on' : ''}"><input type="checkbox" data-amb="${group}" value="${esc(id)}" ${on ? 'checked' : ''}><span class="ck-box">${icon('check')}</span><span class="ck-text">${esc(text)}</span></label>`;
  };
  return `<div class="field-label spaced">Confidence</div>
    <div class="conf-pick" role="radiogroup" aria-label="Confidence">${Object.entries(CONFIDENCE)
      .map(([id, x]) => `<button type="button" class="conf-opt c-${id} ${inv.confidence === id ? 'on' : ''}" role="radio" aria-checked="${inv.confidence === id}" data-action="siem-conf" data-conf="${id}"><b>${esc(x.label)}</b><span>${esc(x.help)}</span></button>`)
      .join('')}</div>
    <fieldset class="ck-group amb-group"><legend class="field-label spaced">What can't the data tell you? <em>Tick all that apply</em></legend>
      ${stableOrder(c.gaps, (g) => c.id + g.id).map((g) => ck('gaps', g.id, g.text)).join('')}
    </fieldset>
    <fieldset class="ck-group amb-group"><legend class="field-label spaced">Next steps <em>Tick what you would do</em></legend>
      ${stableOrder(NEXT_STEPS, (x) => c.id + x.id).map((x) => ck('steps', x.id, x.text)).join('')}
    </fieldset>`;
}

function refreshResults() {
  const c = caseById(inv.caseId);
  const res = resultsHtml(c);
  document.getElementById('siem-results').innerHTML = res.html;
  document.getElementById('siem-sources').innerHTML = sourcesHtml(c);
  document.getElementById('siem-status').innerHTML = statusHtml(c, res.count);
}
function updateStatus() {
  const c = caseById(inv.caseId);
  const el = document.getElementById('siem-status');
  if (el) el.innerHTML = statusHtml(c, S.filterLogs(c, currentQuery()).length);
}
function refreshPins() {
  const c = caseById(inv.caseId);
  document.getElementById('siem-pinned').innerHTML = pinnedHtml(c);
  document.getElementById('siem-tray').innerHTML = trayHtml();
  updateStatus();
}

function setQuery(q) {
  live = q.text || '';
  S.applyQuery(inv, q);
  openRow = null;
  ctx.save();
  const input = document.getElementById('siem-text');
  if (input) input.value = live;
  document.getElementById('siem-selects').innerHTML = selectsHtml(caseById(inv.caseId));
  refreshResults();
}

function submitInvestigation() {
  const c = caseById(inv.caseId);
  commitQuery();
  const sub = { verdict: inv.verdict, pins: [...inv.pins], writeup: inv.writeup, queries: inv.queries };
  if (c.ambiguous) Object.assign(sub, { confidence: inv.confidence, gaps: [...inv.gaps], steps: [...inv.steps] });
  const result = S.scoreCase(c, sub);
  const rec = S.recordCase(st(), c, result, ctx.now());
  const g = G.onInvestigation(st().game, st(), CONTENT, { caseDef: c, result, firstSolve: rec.firstSolve, now: ctx.now() });
  st().siem.cases[c.id].last = { ...sub, total: result.total, at: ctx.now() };
  st().siem.active = null;
  ctx.save();
  siemResult = { caseId: c.id, sub, result, rec, xp: g };
  inv = null;
  renderSiemFeedback();
  ctx.xpToast(g.xp);
  ctx.queueAchievements(g);
  ctx.refreshStatusXp();
}

function scoreRow(label, pts, max, note, cls = '') {
  const frac = max ? pts / max : 0;
  return `<li class="sc-row"><span class="sc-label">${esc(label)}<em>${note}</em></span><span class="sc-bar">${ctx.bar(frac, cls || (frac >= 0.99 ? 'ok' : frac < 0.4 ? 'crit' : ''))}</span><span class="mono sc-pts">${pts}/${max}</span></li>`;
}

function renderSiemFeedback() {
  const { caseId, sub, result: r, rec, xp } = siemResult;
  const c = caseById(caseId);
  if (c.ambiguous) return renderAmbiguousFeedback(c, sub, r, rec, xp);
  const V = VERDICTS;
  const pins = new Set(sub.pins);
  const keyHtml = c.key
    .map((k) => {
      const found = r.evidence.found.includes(k.id);
      const row = c.logs.find((x) => x.id === (k.rows.find((id) => pins.has(id)) || k.rows[0]));
      return `<li class="kev ${found ? 'found' : 'missed'}">
          <div class="kev-head">${icon(found ? 'check' : 'x')}<b>${esc(k.label)}</b>${ctx.chip(found ? ['Found', 'ok'] : ['Missed', 'crit'])}</div>
          <ol class="log-list mini">${logRow(row, { interactive: false, mark: found ? 'found' : 'missed' })}</ol>
          <p class="small">${ctx.rich(k.why)}</p>
        </li>`;
    })
    .join('');
  const noise = r.evidence.noise.map((id) => c.logs.find((x) => x.id === id)).filter(Boolean);
  const verdictOk = r.verdict.correct;
  ctx.setScreen('siem-result');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('SIEM', `${c.title} · result`, 'siem', 'Back to cases')}
    ${ctx.panel({
      title: 'Case result',
      icon: verdictOk ? 'check' : 'x',
      meta: esc(c.alert.id),
      hud: true,
      cls: `feedback ${r.passed ? 'fb-ok' : 'fb-bad'}`,
      body: `<div class="result-top">
          <div class="readout-block"><div class="readout big">${r.total}<small>/100</small></div><div class="label">${esc(r.grade)}</div></div>
          <div class="verdict-line">
            <div class="label">Your call</div>
            <div class="vl-given ${verdictOk ? 'ok-text' : 'crit-text'}">${icon(verdictOk ? 'check' : 'x')}${esc(sub.verdict ? V[sub.verdict].label : 'No verdict')}</div>
            ${verdictOk ? '' : `<div class="small">Correct call: <b>${esc(V[c.verdict].label)}</b></div>`}
            <div class="small muted">${r.passed ? (rec.firstSolve ? 'Case solved.' : 'Solved again.') : verdictOk ? `Right call, but under ${S.PASS_SCORE} points: find more of the evidence.` : 'Not solved: the verdict decides the case.'}</div>
          </div>
        </div>
        <ul class="sc-list">
          ${scoreRow('Verdict', r.verdict.points, r.verdict.max, verdictOk ? 'correct' : r.verdict.points ? 'partial credit' : 'wrong')}
          ${scoreRow('Key evidence', r.evidence.points, r.evidence.max, `${r.evidence.found.length}/${c.key.length} found${r.evidence.penalty ? ` · −${r.evidence.penalty} for ${r.evidence.noise.length} noise pin${r.evidence.noise.length === 1 ? '' : 's'}` : ''}`)}
          ${scoreRow('Efficiency', r.efficiency.points, r.efficiency.max, `${r.efficiency.queries} searches · par ${r.efficiency.par}`)}
          ${scoreRow('Write-up', r.writeup.points, r.writeup.max, r.writeup.tooShort ? 'too short to count' : `${r.writeup.hits.length}/${c.writeup.length} points covered`)}
        </ul>
        ${xp.xp ? `<div class="xp-earned"><div class="label row"><span>XP earned</span><b class="mono xp-gain">+${xp.xp} XP</b></div><ul class="xp-list">${xp.breakdown.map((b) => `<li><span>${esc(b.label)}</span><span class="mono">+${b.amount}</span></li>`).join('')}</ul></div>` : `<p class="small muted">No new XP: you have already been paid for a score of ${st().siem.cases[c.id].paid || 0}. Beat it to earn more.</p>`}`,
    })}
    ${ctx.panel({ title: 'Key evidence', icon: 'pin', meta: `${r.evidence.found.length}/${c.key.length}`, body: `<ul class="kev-list">${keyHtml}</ul>${noise.length ? `<div class="label spaced warn-text">Pinned but not evidence (−${S.NOISE_PENALTY} each)</div><ol class="log-list mini">${noise.map((x) => logRow(x, { interactive: false, mark: 'noise' })).join('')}</ol>` : ''}` })}
    ${ctx.panel({
      title: 'What a strong analyst would notice',
      icon: 'target',
      body: `<p class="explanation">${ctx.rich(c.explanation)}</p><ul class="strong-list">${c.strong.map((s) => `<li>${ctx.rich(s)}</li>`).join('')}</ul>
        <div class="label spaced">Your write-up</div>
        <blockquote class="quote">${sub.writeup.trim() ? esc(sub.writeup) : '<em>(empty)</em>'}</blockquote>
        <ul class="wu-list small">${c.writeup.map((w) => `<li class="${r.writeup.hits.includes(w.label) ? 'ok-text' : 'muted'}">${icon(r.writeup.hits.includes(w.label) ? 'check' : 'x')}${esc(w.label)}</li>`).join('')}</ul>`,
    })}
    <button class="btn primary" data-action="siem-open" data-case="${c.id}">${icon('review')}Investigate again</button>
    <button class="btn secondary" data-action="siem">${icon('list')}Back to cases</button>
    <button class="btn secondary" data-action="home">${icon('back')}Dashboard</button>
  `);
}

const RATING = { best: ['Best', 'ok'], ok: ['Reasonable', 'info'], bad: ['Harmful', 'crit'] };
const CONF_NOTE = { calibrated: 'calibrated', overconfident: 'overconfident', underconfident: 'a bit cautious', none: 'not given' };

function keyEvidenceHtml(c, r, pins) {
  return c.key
    .map((k) => {
      const found = r.evidence.found.includes(k.id);
      const row = c.logs.find((x) => x.id === (k.rows.find((id) => pins.has(id)) || k.rows[0]));
      return `<li class="kev ${found ? 'found' : 'missed'}">
          <div class="kev-head">${icon(found ? 'check' : 'x')}<b>${esc(k.label)}</b>${ctx.chip(found ? ['Found', 'ok'] : ['Missed', 'crit'])}</div>
          <ol class="log-list mini">${logRow(row, { interactive: false, mark: found ? 'found' : 'missed' })}</ol>
          <p class="small">${ctx.rich(k.why)}</p>
        </li>`;
    })
    .join('');
}

function renderAmbiguousFeedback(c, sub, r, rec, xp) {
  const V = VERDICTS;
  const pins = new Set(sub.pins);
  const v = r.verdict;
  const vCls = v.preferred ? 'ok-text' : v.defensible ? 'warn-text' : 'crit-text';
  const vLabel = v.preferred ? 'Preferred call' : v.defensible ? 'Defensible call' : 'Not defensible';
  const gapsPicked = new Set(sub.gaps || []);
  const gapHtml = c.gaps
    .map((g) => {
      const on = gapsPicked.has(g.id);
      const cls = g.correct ? (on ? 'right' : 'missed') : on ? 'wrong' : 'skip';
      const tag = g.correct ? (on ? ['Spotted', 'ok'] : ['Missed', 'warn']) : on ? ['Not a real gap', 'crit'] : ['Rightly skipped', 'dim'];
      return `<li class="opt-fb ${cls}"><div class="opt-head">${icon(on ? 'check' : g.correct ? 'clock' : 'x')}<span>${esc(g.text)}</span>${ctx.chip(tag)}</div><p class="small muted">${ctx.rich(g.why)}</p></li>`;
    })
    .join('');
  const stepsPicked = new Set(sub.steps || []);
  const stepHtml = NEXT_STEPS.map((x) => {
    const rt = c.steps[x.id];
    const on = stepsPicked.has(x.id);
    const cls = `r-${rt.rating} ${on ? 'on' : ''}`;
    return `<li class="opt-fb ${cls}"><div class="opt-head"><span class="ck-box ${on ? 'on' : ''}">${icon('check')}</span><span>${esc(x.text)}</span>${ctx.chip(RATING[rt.rating])}</div><p class="small muted">${ctx.rich(rt.why)}</p></li>`;
  }).join('');
  const noise = r.evidence.noise.map((id) => c.logs.find((x) => x.id === id)).filter(Boolean);
  const argHtml = Object.entries(c.arguments)
    .map(([vid, text]) => `<li class="arg v-${vid}"><div class="arg-head"><b>${esc(V[vid].label)}</b>${vid === c.verdict ? ctx.chip(['Preferred', 'ok']) : ctx.chip([`Defensible · ${Math.round(c.defensible[vid] * S.AMBIG_WEIGHTS.verdict)}/${S.AMBIG_WEIGHTS.verdict}`, 'warn'])}</div><p class="small">${ctx.rich(text)}</p></li>`)
    .join('');
  const notDef = Object.keys(V).filter((id) => !c.defensible[id]);
  const o = c.outcome;
  const outcomeAgrees = o && o.verdict === sub.verdict;
  ctx.setScreen('siem-result');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('SIEM', `${c.title} · result`, 'siem', 'Back to cases')}
    ${ctx.panel({
      title: 'Judgment score',
      icon: r.passed ? 'check' : 'x',
      meta: `${esc(c.alert.id)} · ambiguous`,
      hud: true,
      cls: `feedback ${r.passed ? 'fb-ok' : 'fb-bad'}`,
      body: `<div class="result-top">
          <div class="readout-block"><div class="readout big">${r.total}<small>/100</small></div><div class="label">${esc(r.grade)}</div></div>
          <div class="verdict-line">
            <div class="label">Your call</div>
            <div class="vl-given ${vCls}">${icon(v.defensible ? 'check' : 'x')}${esc(sub.verdict ? V[sub.verdict].label : 'No verdict')}</div>
            <div class="small"><b class="${vCls}">${vLabel}</b> · confidence <b class="${r.confidence.note === 'overconfident' ? 'crit-text' : ''}">${esc(sub.confidence ? CONFIDENCE[sub.confidence].label : '-')}</b></div>
            <div class="small muted">${r.passed ? (rec.firstSolve ? 'Case solved.' : 'Solved again.') : v.defensible ? `Defensible call, but under ${S.PASS_SCORE} points: the reasoning needs work.` : 'Not solved: the evidence can\'t support that call.'}</div>
          </div>
        </div>
        <ul class="sc-list">
          ${scoreRow('Verdict', v.points, v.max, v.preferred ? 'preferred call' : v.defensible ? 'defensible' : 'not defensible')}
          ${scoreRow("What's missing", r.gaps.points, r.gaps.max, `${r.gaps.right.length}/${c.gaps.filter((g) => g.correct).length} gaps spotted${r.gaps.wrong.length ? ` · ${r.gaps.wrong.length} false` : ''}`)}
          ${scoreRow('Next steps', r.steps.points, r.steps.max, `${r.steps.best.length}/${r.steps.best.length + r.steps.missed.length} best${r.steps.bad.length ? ` · ${r.steps.bad.length} harmful` : ''}`)}
          ${scoreRow('Confidence', r.confidence.points, r.confidence.max, CONF_NOTE[r.confidence.note], r.confidence.note === 'overconfident' ? 'crit' : '')}
          ${scoreRow('Evidence', r.evidence.points, r.evidence.max, `${r.evidence.found.length}/${c.key.length} found${r.evidence.penalty ? ` · −${r.evidence.penalty} noise` : ''}`)}
          ${scoreRow('Write-up', r.writeup.points, r.writeup.max, r.writeup.tooShort ? 'too short to count' : `${r.writeup.hits.length}/${c.writeup.length} points covered`)}
        </ul>
        ${r.confidence.note === 'overconfident' ? `<p class="small crit-text conf-warn">${icon('alert')}"High" means the data proves it. On a case where key facts are missing, that's overconfidence, even if your call turns out right.</p>` : ''}
        ${xp.xp ? `<div class="xp-earned"><div class="label row"><span>XP earned</span><b class="mono xp-gain">+${xp.xp} XP</b></div><ul class="xp-list">${xp.breakdown.map((b) => `<li><span>${esc(b.label)}</span><span class="mono">+${b.amount}</span></li>`).join('')}</ul></div>` : `<p class="small muted">No new XP: you have already been paid for a score of ${st().siem.cases[c.id].paid || 0}. Beat it to earn more.</p>`}`,
    })}
    ${ctx.panel({ title: 'Why either call could be defended', icon: 'layers', body: `<ul class="arg-list">${argHtml}</ul>${notDef.length ? `<p class="small muted">Not defensible: ${notDef.map((id) => esc(V[id].label)).join(', ')}. The activity really happened, so the alert isn't wrong.</p>` : ''}` })}
    ${ctx.panel({ title: 'What a senior analyst would do', icon: 'target', body: `<p class="explanation">${ctx.rich(c.explanation)}</p><ul class="strong-list">${c.strong.map((x) => `<li>${ctx.rich(x)}</li>`).join('')}</ul>` })}
    ${ctx.panel({ title: 'What would settle it', icon: 'crosshair', cls: 'settle-panel', body: `<ul class="settle-list">${c.settle.map((x) => `<li>${ctx.rich(x)}</li>`).join('')}</ul>` })}
    ${ctx.panel({ title: "What's missing", icon: 'search', meta: `${r.gaps.points}/${r.gaps.max}`, body: `<ul class="opt-fb-list">${gapHtml}</ul>` })}
    ${ctx.panel({ title: 'Your next steps', icon: 'list', meta: `${r.steps.points}/${r.steps.max}`, body: `<ul class="opt-fb-list">${stepHtml}</ul>` })}
    ${ctx.panel({ title: 'Key evidence', icon: 'pin', meta: `${r.evidence.found.length}/${c.key.length}`, body: `<ul class="kev-list">${keyEvidenceHtml(c, r, pins)}</ul>${noise.length ? `<div class="label spaced warn-text">Pinned but not evidence (−${S.AMBIG_NOISE_PENALTY} each)</div><ol class="log-list mini">${noise.map((x) => logRow(x, { interactive: false, mark: 'noise' })).join('')}</ol>` : ''}
        <div class="label spaced">Your write-up</div>
        <blockquote class="quote">${sub.writeup.trim() ? esc(sub.writeup) : '<em>(empty)</em>'}</blockquote>
        <ul class="wu-list small">${c.writeup.map((w) => `<li class="${r.writeup.hits.includes(w.label) ? 'ok-text' : 'muted'}">${icon(r.writeup.hits.includes(w.label) ? 'check' : 'x')}${esc(w.label)}</li>`).join('')}</ul>` })}
    ${
      o
        ? `<details class="outcome" id="siem-outcome">
        <summary><span class="oc-ico">${icon('clock')}</span><span class="oc-main"><b>Reveal what happened next</b><em>Extra data that came in later</em></span></summary>
        <div class="oc-body">
          <div class="oc-title">${ctx.chip([V[o.verdict].short, o.verdict === 'tp' ? 'crit' : o.verdict === 'btp' ? 'warn' : 'ok'])}<b>${esc(o.title)}</b></div>
          <p>${ctx.rich(o.text)}</p>
          <p class="oc-note small">${icon('shield')}<span>Your score doesn't change. It grades your reasoning with the data you had${outcomeAgrees ? '. Your call matched the outcome this time, but on another day the same evidence could go the other way' : '. The outcome differs from your call, and a well-reasoned call can still be overtaken by facts nobody had yet'}.</span></p>
        </div>
      </details>`
        : ''
    }
    <button class="btn primary" data-action="siem-open" data-case="${c.id}">${icon('review')}Investigate again</button>
    <button class="btn secondary" data-action="siem">${icon('list')}Back to cases</button>
    <button class="btn secondary" data-action="home">${icon('back')}Dashboard</button>
  `);
}

// =================================================================== capstone

let cap = null; // { id, view: 'overview'|'stage'|'escalation'|'result', stageId, answers, sel, result }
const scenarioById = (id) => CONTENT.scenarios.find((s) => s.id === id);

// Report screen wording. First shift uses these defaults; a capstone can override any of them in escalation.ui.
const UI_DEFAULTS = {
  panelTitle: 'First shift',
  title: 'Escalation to Tier 2',
  barTitle: 'Escalation to Tier 2',
  rowText: 'Decide if it is real and write the handoff: summary, scope, timeline, IOCs, actions, severity.',
  alertTag: 'Escalation',
  intro: 'You have worked the whole chain. Tier 2 will act on exactly what you write here, so be specific and leave out the noise.',
  writeLabel: 'Write the escalation',
  sendLabel: 'Send escalation',
  reviseLabel: 'Revise the report',
  feedbackTitle: 'Escalation feedback',
  verdictLabel: 'Verdict',
  verdictText: 'True positive, escalated',
  passNote: 'Capstone complete. Tier 2 has what they need.',
  failNote: null,
};
const capUi = (sc) => ({ ...UI_DEFAULTS, ...(sc.id === 'first-shift' ? {} : { panelTitle: sc.title, title: 'Final report', barTitle: 'Final report', writeLabel: 'Write the report', sendLabel: 'Submit report', feedbackTitle: 'Report feedback' }), ...(sc.escalation?.ui || {}) });
// Default form layout (First shift). escalation.panels overrides it.
const DEFAULT_PANELS = [
  { title: 'Summary', icon: 'terminal', fields: ['summary', 'severity'] },
  { title: 'Scope', icon: 'host', fields: ['hosts', 'users'] },
  { title: 'Timeline', icon: 'clock', fields: ['timeline'] },
  { title: 'Indicators of compromise', icon: 'crosshair', fields: ['iocs'] },
  { title: 'Recommended actions', icon: 'shield', fields: ['actions'] },
];
const choiceLabel = (def, v) => (v == null ? 'none' : def.labels?.[v] ?? SEV[v]?.[0] ?? v);

function renderCapstone() {
  const sc = scenarioById(cap.id);
  if (cap.view === 'stage') return renderStage(sc);
  if (cap.view === 'escalation') return renderEscalation(sc);
  if (cap.view === 'result') return renderEscalationResult(sc);
  return renderCapOverview(sc);
}

function lessonChips(ids) {
  return ids.map((id) => `<button class="lesson-chip" data-action="open-lesson" data-skill="${id}" data-from="capstone">${icon('book')}${esc(ctx.skillName(id))}</button>`).join('');
}

/** Called by app.js when a lesson opened from the capstone is closed: back to where we were. */
export function resumeCapstone() {
  if (!cap) return false;
  renderCapstone();
  if (cap.view === 'overview') document.querySelector('.stage-list')?.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
  return true;
}

function renderCapOverview(sc) {
  const a = sc.alert;
  const p = C.capstoneProgress(sc, st());
  const rows = sc.stages
    .map((s, i) => {
      const ss = C.stageStatus(sc, s.id, st(), CONTENT);
      const rec = st().capstones[sc.id]?.stages?.[s.id];
      const statusChip = ss.done ? ctx.chip([`Done · ${rec.best}%`, 'ok']) : ss.unlocked ? ctx.chip(['Ready', 'info']) : ctx.chip(['Locked', 'dim']);
      const why = ss.done || ss.unlocked
        ? ''
        : ss.missingLessons.length
          ? `<div class="stage-why small"><span>Finish the lesson${ss.missingLessons.length > 1 ? 's' : ''}:</span>${lessonChips(ss.missingLessons)}</div>`
          : `<div class="stage-why small muted">Finish stage ${i} first.</div>`;
      return `<li class="stage-row ${ss.done ? 'done' : ss.unlocked ? 'ready' : 'locked'}">
          <span class="stage-no mono">${ctx.pad(i + 1)}</span>
          <span class="stage-main"><span class="stage-top"><b>${esc(s.title)}</b>${statusChip}</span><em>${esc(s.summary)}</em>${why}</span>
          ${ss.unlocked || ss.done ? `<button class="btn mini ${ss.done ? 'secondary' : 'primary'}" data-action="cap-stage" data-stage="${s.id}">${ss.done ? 'Review' : 'Start'}</button>` : `<span class="stage-lock">${icon('lock')}</span>`}
        </li>`;
    })
    .join('');
  const escOpen = C.escalationUnlocked(sc, st());
  const ui = capUi(sc);
  ctx.setScreen('capstone');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('Capstone', sc.title)}
    ${ctx.panel({
      title: esc(ui.panelTitle),
      icon: 'flag',
      meta: `${p.stagesDone}/${p.stages} stages`,
      hud: true,
      body: `<p>${esc(sc.intro)}</p>
        <section class="alert-card sev-${a.severity}" aria-label="Alert">
          <div class="ac-head">${icon('alert')}<span class="mono">${esc(a.id)}</span>${ctx.chip(SEV[a.severity])}<span class="ac-time mono">${esc(sc.date)} ${esc(a.time)}</span></div>
          <div class="ac-name">${esc(a.name)}</div>
          <dl class="ac-meta mono"><div><dt>Host</dt><dd>${esc(a.host)}</dd></div><div><dt>User</dt><dd>${esc(a.user)}</dd></div><div><dt>Source</dt><dd>${esc(a.source)}</dd></div></dl>
        </section>`,
    })}
    ${ctx.panel({
      title: 'Stages',
      icon: 'list',
      meta: 'Unlock with lessons',
      body: `<ol class="stage-list">${rows}
          <li class="stage-row ${p.completed ? 'done' : escOpen ? 'ready' : 'locked'}">
            <span class="stage-no mono">${icon('send')}</span>
            <span class="stage-main"><span class="stage-top"><b>${esc(ui.title)}</b>${p.completed ? ctx.chip([`${p.score}/100`, 'ok']) : escOpen ? ctx.chip(['Ready', 'info']) : ctx.chip(['Locked', 'dim'])}</span><em>${esc(ui.rowText)}</em>${escOpen ? '' : `<div class="stage-why small muted">Finish all ${sc.stages.length} stages first.</div>`}</span>
            ${escOpen ? `<button class="btn mini ${p.completed ? 'secondary' : 'primary'}" data-action="cap-escalation">${p.escalated ? 'Revise' : 'Write'}</button>` : `<span class="stage-lock">${icon('lock')}</span>`}
          </li>
        </ol>
        ${p.escalated ? `<button class="btn secondary" data-action="cap-result">${icon('chart')}View rubric feedback</button>` : ''}`,
    })}
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

function questionHtml(q, qi) {
  const answered = q.id in cap.answers;
  const multi = q.type === 'multi';
  const sel = new Set(multi ? (answered ? cap.answers[q.id] : cap.sel[q.id] || []) : answered ? [cap.answers[q.id]] : []);
  const right = new Set(multi ? q.answer : [q.answer]);
  const ok = answered && C.checkQuestion(q, cap.answers[q.id]);
  const choices = stableOrder(q.choices, (x) => q.id + x)
    .map((ch, i) => {
      let cls = '';
      if (answered) cls = right.has(ch) ? (sel.has(ch) ? 'correct' : 'missed') : sel.has(ch) ? 'wrong' : '';
      else if (sel.has(ch)) cls = 'selected';
      const k = answered ? (right.has(ch) && sel.has(ch) ? icon('check') : sel.has(ch) ? icon('x') : String.fromCharCode(65 + i)) : String.fromCharCode(65 + i);
      return `<button class="choice ${multi ? 'multi' : ''} ${cls}" ${answered ? 'disabled' : `data-action="cap-choose" data-q="${q.id}" data-choice="${esc(ch)}"`}><span class="key">${k}</span><span class="choice-text">${ctx.rich(ch)}</span></button>`;
    })
    .join('');
  return `<section class="panel cap-q ${answered ? (ok ? 'fb-ok' : 'fb-bad') : ''}" id="q-${q.id}">
      <header class="panel-head">${icon(answered ? (ok ? 'check' : 'x') : 'target')}<span class="ph-title">Question ${qi + 1}</span><span class="ph-meta">${multi ? 'Select all that apply' : 'One answer'}</span></header>
      <div class="panel-body">
        <p class="prompt">${ctx.rich(q.prompt)}</p>
        <div class="choices">${choices}</div>
        ${!answered && multi ? `<button class="btn primary" data-action="cap-check" data-q="${q.id}" ${sel.size ? '' : 'disabled'}>${icon('check')}Check answer</button>` : ''}
        ${answered ? `<p class="explanation small">${ctx.rich(q.explanation)}</p>` : ''}
      </div>
    </section>`;
}

function renderStage(sc) {
  const i = sc.stages.findIndex((s) => s.id === cap.stageId);
  const stage = sc.stages[i];
  const done = stage.questions.every((q) => q.id in cap.answers);
  let footer = '';
  if (done && cap.result) {
    const r = cap.result;
    const next = sc.stages[i + 1];
    const nextStatus = next ? C.stageStatus(sc, next.id, st(), CONTENT) : null;
    footer = ctx.panel({
      title: `Stage ${i + 1} complete`,
      icon: 'check',
      meta: `${r.correct}/${r.total}`,
      hud: true,
      cls: 'feedback fb-ok',
      body: `<p>${r.score === 100 ? 'Clean read of the evidence.' : 'Check the explanations above before moving on.'} Best score on this stage: <b class="mono">${r.best}%</b>.</p>
        ${cap.xp ? `<div class="xp-earned"><div class="label row"><span>XP earned</span><b class="mono xp-gain">+${cap.xp} XP</b></div></div>` : ''}
        ${
          next
            ? nextStatus.unlocked
              ? `<button class="btn primary" data-action="cap-stage" data-stage="${next.id}">${icon('next')}Stage ${i + 2}: ${esc(next.title)}</button>`
              : `<p class="small muted">Stage ${i + 2} (${esc(next.title)}) opens after the lesson${nextStatus.missingLessons.length > 1 ? 's' : ''}:</p><div class="stage-why">${lessonChips(nextStatus.missingLessons)}</div>`
            : `<button class="btn primary" data-action="cap-escalation">${icon('send')}${esc(capUi(sc).writeLabel)}</button>`
        }
        <button class="btn secondary" data-action="cap-replay" data-stage="${stage.id}">${icon('review')}Replay stage</button>`,
    });
  }
  ctx.setScreen('cap-stage');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('Capstone', `Stage ${i + 1}/${sc.stages.length} · ${stage.title}`, 'capstone', 'Back to the capstone')}
    <div class="stage-track">${sc.stages.map((s, j) => `<i class="${C.stageDone(st(), sc.id, s.id) ? 'done' : ''} ${j === i ? 'current' : ''}"></i>`).join('')}<i class="esc ${C.capstoneProgress(sc, st()).completed ? 'done' : ''}"></i></div>
    <div class="alert info" role="note"><div class="alert-tag">${icon('terminal')}<span>Stage ${i + 1} · ${esc(stage.title)}</span></div><div class="alert-msg">${ctx.rich(stage.brief)}</div></div>
    ${ctx.panel({ title: 'Evidence', icon: 'list', meta: esc(stage.evidence.label), cls: 'evidence-panel', body: `<ol class="log-list">${stage.evidence.rows.map((r) => logRow(r, { interactive: false })).join('')}</ol>` })}
    ${stage.questions.map((q, qi) => questionHtml(q, qi)).join('')}
    ${footer}
  `);
}

function finishStageIfDone(sc) {
  const stage = sc.stages.find((s) => s.id === cap.stageId);
  if (!stage.questions.every((q) => q.id in cap.answers) || cap.result) return;
  const result = C.recordStage(st(), sc, stage, cap.answers, ctx.now());
  const g = G.onCapstoneStage(st().game, st(), CONTENT, { stage, result, now: ctx.now(), scenario: sc });
  cap.result = result;
  cap.xp = g.xp;
  ctx.save();
  ctx.xpToast(g.xp);
  ctx.queueAchievements(g);
  ctx.refreshStatusXp();
}

function draft(sc) {
  const cs = C.capstoneState(st(), sc.id);
  cs.draft ??= cs.escalation ? { ...C.emptyReport(sc), ...cs.escalation } : C.emptyReport(sc);
  delete cs.draft.submittedAt;
  return cs.draft;
}

const choicesMissing = (sc, d) => Object.keys(sc.escalation.weights).filter((f) => C.fieldKind(sc.escalation.fields[f]) === 'choice' && !d[f]);

function renderEscalation(sc) {
  const F = sc.escalation.fields;
  const d = draft(sc);
  const ui = capUi(sc);
  const group = (field) => {
    const def = F[field];
    const timeline = def.options.some((o) => typeof o === 'object');
    const mono = ['hosts', 'users', 'iocs'].includes(field);
    const opts = timeline ? def.options : stableOrder(def.options);
    return `<fieldset class="ck-group ${timeline ? 'timeline' : ''}"><legend class="field-label">${esc(def.label)}</legend>
      ${opts
        .map((o) => {
          const val = timeline ? o.id : o;
          const on = (d[field] || []).includes(val);
          return `<label class="ck ${on ? 'on' : ''}"><input type="checkbox" data-esc="${field}" value="${esc(val)}" ${on ? 'checked' : ''}><span class="ck-box">${icon('check')}</span><span class="ck-text ${mono ? 'mono' : ''}">${timeline ? `<b class="mono">${esc(o.t)}</b> ${esc(o.text)}` : esc(o)}</span></label>`;
        })
        .join('')}
    </fieldset>`;
  };
  const choice = (field) => {
    const def = F[field];
    if (field === 'severity' && !def.labels) {
      return `<div class="field-label spaced">${esc(def.label)}</div>
        <div class="sev-pick" role="radiogroup" aria-label="${esc(def.label)}">${def.options.map((o) => `<button type="button" class="sev-opt s-${o} ${d[field] === o ? 'on' : ''}" role="radio" aria-checked="${d[field] === o}" data-action="cap-sev" data-field="${field}" data-sev="${o}">${esc(SEV[o][0])}</button>`).join('')}</div>`;
    }
    return `<div class="field-label spaced">${esc(def.label)}</div>
      <div class="choice-pick" role="radiogroup" aria-label="${esc(def.label)}">${def.options.map((o) => `<button type="button" class="pick-opt ${d[field] === o ? 'on' : ''}" role="radio" aria-checked="${d[field] === o}" data-action="cap-sev" data-field="${field}" data-sev="${esc(o)}">${esc(choiceLabel(def, o))}</button>`).join('')}</div>`;
  };
  const text = (field) => {
    const def = F[field];
    return `<label class="field-label" for="esc-${field}">${field === 'summary' ? 'What happened, in plain words' : esc(def.label)}</label>
      <textarea id="esc-${field}" data-esc="${field}" class="text-answer writeup" rows="6" maxlength="1500" placeholder="${esc(def.placeholder || 'How it started, what is affected, how bad it is, what you need Tier 2 to do.')}">${esc(d[field] || '')}</textarea>
      <p class="small muted" id="esc-count">${String(d[field] || '').trim().length} characters</p>`;
  };
  const fieldHtml = (field) => {
    const kind = C.fieldKind(F[field]);
    return kind === 'text' ? text(field) : kind === 'choice' ? choice(field) : group(field);
  };
  const panels = (sc.escalation.panels || DEFAULT_PANELS).map((p) => ctx.panel({ title: esc(p.title), icon: p.icon, body: p.fields.map(fieldHtml).join('') })).join('');
  const missing = choicesMissing(sc, d);
  ctx.setScreen('cap-escalation');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('Capstone', ui.barTitle, 'capstone', 'Back to the capstone')}
    <div class="alert crit" role="note"><div class="alert-tag">${icon('send')}<span>${esc(ui.alertTag)} · ${esc(sc.alert.id)}</span></div><div class="alert-msg">${esc(ui.intro)}</div></div>
    <form class="esc-form" id="esc-form" onsubmit="return false">
      ${panels}
    </form>
    <button class="btn primary" data-action="cap-submit" id="cap-submit" ${missing.length ? 'disabled' : ''}>${icon('send')}${esc(ui.sendLabel)}</button>
    <p class="btn-note" id="cap-note">${missing.length ? `Pick ${missing.map((f) => F[f].label.toLowerCase()).join(' and ')} to send.` : 'Scored against a rubric; the model answer is shown afterwards.'}</p>
    <button class="btn secondary" data-action="capstone">${icon('back')}Save draft &amp; go back</button>
  `);
}

function renderEscalationResult(sc) {
  const cs = st().capstones[sc.id];
  const r = cap.result || C.scoreEscalation(sc, cs.escalation);
  const F = sc.escalation.fields;
  const M = sc.escalation.model;
  const ui = capUi(sc);
  const optLabel = (field, v) => {
    const o = F[field].options.find((x) => typeof x === 'object' && x.id === v);
    return o ? `${o.t} ${o.text}` : v;
  };
  const detail = (row) => {
    const d = row.detail;
    const kind = C.fieldKind(F[row.field]);
    if (kind === 'text') {
      return d.tooShort
        ? `<p class="small crit-text">Too short to score (at least ${F[row.field].minLength} characters).</p>`
        : `<ul class="rub-items">${d.hits.map((h) => `<li class="ok-text">${icon('check')}${esc(h)}</li>`).join('')}${d.misses.map((h) => `<li class="warn-text">${icon('x')}Missing: ${esc(h)}</li>`).join('')}</ul>`;
    }
    if (kind === 'choice') return `<p class="small">You: <b>${esc(choiceLabel(F[row.field], d.given))}</b> · Model: <b>${esc(choiceLabel(F[row.field], d.model))}</b></p>`;
    const label = (v) => optLabel(row.field, v);
    return `<ul class="rub-items">${d.right.map((v) => `<li class="ok-text">${icon('check')}${esc(label(v))}</li>`).join('')}${d.wrong.map((v) => `<li class="crit-text">${icon('x')}Should not be here: ${esc(label(v))}</li>`).join('')}${d.missed.map((v) => `<li class="warn-text">${icon('clock')}Missed: ${esc(label(v))}</li>`).join('')}</ul>`;
  };
  const rows = r.rows
    .map((row) => {
      const frac = row.points / row.max;
      return `<li class="rub-row"><div class="rub-head"><b>${esc(row.label)}</b><span class="mono">${row.points}/${row.max}</span></div>${ctx.bar(frac, frac >= 0.99 ? 'ok' : frac < 0.4 ? 'crit' : '')}${detail(row)}</li>`;
    })
    .join('');
  // Model answer: summary and severity first, then the other fields in rubric order.
  const modelRest = Object.keys(sc.escalation.weights)
    .filter((f) => !['summary', 'severity', 'hosts', 'users'].includes(f))
    .map((f) => {
      const def = F[f];
      const kind = C.fieldKind(def);
      if (kind === 'text') return `<div class="label spaced">${esc(def.label)}</div><blockquote class="quote">${esc(M[f])}</blockquote>`;
      if (kind === 'choice') return `<div class="label spaced">${esc(def.label)}: <span class="ok-text">${esc(choiceLabel(def, M[f]))}</span></div>${M[`${f}Note`] ? `<p class="small muted">${esc(M[`${f}Note`])}</p>` : ''}`;
      if (f === 'timeline') return `<div class="label spaced">Timeline</div><ul class="model-tl small">${def.correct.map((id) => def.options.find((o) => o.id === id)).map((o) => `<li><b class="mono">${esc(o.t)}</b> ${esc(o.text)}</li>`).join('')}</ul>`;
      const title = { iocs: 'IOCs', actions: 'Actions' }[f] || def.label;
      return `<div class="label spaced">${esc(title)}</div><ul class="model-list ${f === 'iocs' ? 'mono ' : ''}small">${def.correct.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    })
    .join('');
  const scope = F.hosts && F.users ? `<div class="label spaced">Scope</div><p class="mono small">${F.hosts.correct.map(esc).join(', ')} · accounts ${F.users.correct.map(esc).join(', ')}</p>` : '';
  ctx.setScreen('cap-result');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('Capstone', ui.feedbackTitle, 'capstone', 'Back to the capstone')}
    ${ctx.panel({
      title: 'Rubric score',
      icon: r.passed ? 'check' : 'x',
      meta: esc(sc.alert.id),
      hud: true,
      cls: `feedback ${r.passed ? 'fb-ok' : 'fb-bad'}`,
      body: `<div class="result-top">
          <div class="readout-block"><div class="readout big">${r.total}<small>/100</small></div><div class="label">${r.total >= 85 ? 'Clean handoff' : r.passed ? 'Handoff accepted' : 'Sent back'}</div></div>
          <div class="verdict-line"><div class="label">${esc(ui.verdictLabel)}</div><div class="vl-given ok-text">${icon('check')}${esc(ui.verdictText)}</div><div class="small muted">${r.passed ? esc(ui.passNote) : esc(ui.failNote || `Tier 2 needs more to act on. ${sc.escalation.passScore}+ completes the capstone.`)}</div></div>
        </div>
        ${cap.xp ? `<div class="xp-earned"><div class="label row"><span>XP earned</span><b class="mono xp-gain">+${cap.xp} XP</b></div></div>` : ''}
        <ul class="rub-list">${rows}</ul>`,
    })}
    ${ctx.panel({
      title: 'Model answer',
      icon: 'award',
      cls: 'model-panel',
      body: `<div class="label">Summary</div><blockquote class="quote">${esc(M.summary)}</blockquote>
        ${M.severity ? `<div class="label spaced">Severity: <span class="crit-text">${esc(SEV[M.severity][0])}</span></div><p class="small muted">${esc(M.severityNote || '')}</p>` : ''}
        ${scope}
        ${modelRest}`,
    })}
    <button class="btn primary" data-action="cap-escalation">${icon('review')}${esc(ui.reviseLabel)}</button>
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

function submitEscalation(sc) {
  const d = draft(sc);
  const report = Object.fromEntries(Object.keys(sc.escalation.weights).map((f) => [f, Array.isArray(d[f]) ? [...d[f]] : d[f]]));
  const result = C.recordEscalation(st(), sc, report, ctx.now());
  const g = G.onEscalation(st().game, st(), CONTENT, { scenario: sc, result, now: ctx.now() });
  cap.result = result;
  cap.xp = g.xp;
  cap.view = 'result';
  ctx.save();
  renderCapstone();
  ctx.xpToast(g.xp);
  ctx.queueAchievements(g);
  ctx.refreshStatusXp();
}

// =================================================================== events

/** Click actions owned by this module. Returns true when handled. */
export function handleClick(action, el) {
  switch (action) {
    case 'career':
      renderCareer();
      return true;
    case 'dismiss-notice':
      st().game.ladderNotice = null;
      ctx.save();
      el.closest('.notice')?.remove();
      return true;
    case 'siem':
      renderSiemList();
      return true;
    case 'siem-open':
      openCase(el.dataset.case);
      return true;
    case 'siem-src': {
      const src = el.dataset.src;
      const set = new Set(inv.query.sources);
      if (set.has(src)) set.delete(src);
      else set.add(src);
      setQuery({ ...currentQuery(), sources: [...set] });
      return true;
    }
    case 'siem-clear':
      setQuery(S.emptyQuery());
      return true;
    case 'siem-row': {
      const id = el.dataset.row;
      openRow = openRow === id ? null : id;
      const c = caseById(inv.caseId);
      const li = el.closest('.lg-row');
      const r = c.logs.find((x) => x.id === id);
      const prev = document.querySelector('.lg-row.open');
      if (prev && prev !== li) {
        const pr = c.logs.find((x) => x.id === prev.dataset.rowId);
        prev.outerHTML = logRow(pr, { pinned: inv.pins.includes(pr.id) });
      }
      li.outerHTML = logRow(r, { pinned: inv.pins.includes(id), expanded: openRow === id });
      return true;
    }
    case 'siem-pin': {
      const id = el.dataset.row;
      S.togglePin(inv, id);
      ctx.save();
      const c = caseById(inv.caseId);
      const li = document.querySelector(`.lg-row[data-row-id="${id}"]`);
      if (li) li.outerHTML = logRow(c.logs.find((x) => x.id === id), { pinned: inv.pins.includes(id), expanded: openRow === id });
      refreshPins();
      return true;
    }
    case 'siem-pivot': {
      const { kind, value } = el.dataset;
      const q = S.emptyQuery();
      if (kind === 'host') q.host = value;
      else if (kind === 'user') q.user = value;
      else q.text = value;
      setQuery(q);
      document.getElementById('siem-filters')?.scrollIntoView({ block: 'start' });
      return true;
    }
    case 'siem-top':
      document.getElementById('siem-filters')?.scrollIntoView({ block: 'start' });
      return true;
    case 'siem-goto-verdict':
      document.getElementById('siem-verdict')?.scrollIntoView({ block: 'start' });
      return true;
    case 'siem-verdict':
      inv.verdict = el.dataset.v;
      ctx.save();
      for (const b of document.querySelectorAll('.verdict')) {
        b.classList.toggle('on', b.dataset.v === inv.verdict);
        b.setAttribute('aria-checked', String(b.dataset.v === inv.verdict));
      }
      refreshSubmit(caseById(inv.caseId));
      return true;
    case 'siem-conf':
      inv.confidence = el.dataset.conf;
      ctx.save();
      for (const b of document.querySelectorAll('.conf-opt')) {
        b.classList.toggle('on', b.dataset.conf === inv.confidence);
        b.setAttribute('aria-checked', String(b.dataset.conf === inv.confidence));
      }
      refreshSubmit(caseById(inv.caseId));
      return true;
    case 'siem-submit':
      submitInvestigation();
      return true;
    case 'capstone':
      cap = { id: el.dataset.id || cap?.id || 'first-shift', view: 'overview', answers: {}, sel: {} };
      renderCapstone();
      return true;
    case 'cap-stage':
    case 'cap-replay': {
      const sc = scenarioById(cap.id);
      const rec = st().capstones[sc.id]?.stages?.[el.dataset.stage];
      const review = action === 'cap-stage' && rec?.done;
      cap = { ...cap, view: 'stage', stageId: el.dataset.stage, answers: review ? { ...rec.answers } : {}, sel: {}, result: review ? { ...C.scoreStage(sc.stages.find((s) => s.id === el.dataset.stage), rec.answers), best: rec.best } : null, xp: 0 };
      renderCapstone();
      return true;
    }
    case 'cap-choose': {
      const sc = scenarioById(cap.id);
      const stage = sc.stages.find((s) => s.id === cap.stageId);
      const q = stage.questions.find((x) => x.id === el.dataset.q);
      const ch = el.dataset.choice;
      if (q.type === 'multi') {
        const set = new Set(cap.sel[q.id] || []);
        if (set.has(ch)) set.delete(ch);
        else set.add(ch);
        cap.sel[q.id] = [...set];
      } else {
        cap.answers[q.id] = ch;
        finishStageIfDone(sc);
      }
      rerenderKeepScroll(`q-${q.id}`);
      return true;
    }
    case 'cap-check': {
      const sc = scenarioById(cap.id);
      cap.answers[el.dataset.q] = [...(cap.sel[el.dataset.q] || [])];
      finishStageIfDone(sc);
      rerenderKeepScroll(`q-${el.dataset.q}`);
      return true;
    }
    case 'cap-escalation':
      cap = { ...cap, view: 'escalation', result: null, xp: 0 };
      renderCapstone();
      return true;
    case 'cap-result':
      cap = { ...cap, view: 'result', result: null, xp: 0 };
      renderCapstone();
      return true;
    case 'cap-sev': {
      // graded single choice: severity, or any other choice field (data-field)
      const sc = scenarioById(cap.id);
      const field = el.dataset.field || 'severity';
      const d = draft(sc);
      d[field] = el.dataset.sev;
      ctx.save();
      for (const b of document.querySelectorAll(`[data-action="cap-sev"][data-field="${field}"]`)) {
        b.classList.toggle('on', b.dataset.sev === el.dataset.sev);
        b.setAttribute('aria-checked', String(b.dataset.sev === el.dataset.sev));
      }
      const missing = choicesMissing(sc, d);
      document.getElementById('cap-submit').disabled = missing.length > 0;
      document.getElementById('cap-note').textContent = missing.length
        ? `Pick ${missing.map((f) => sc.escalation.fields[f].label.toLowerCase()).join(' and ')} to send.`
        : 'Scored against a rubric; the model answer is shown afterwards.';
      return true;
    }
    case 'cap-submit':
      submitEscalation(scenarioById(cap.id));
      return true;
    default:
      return false;
  }
}

function rerenderKeepScroll(anchorId) {
  const el = document.getElementById(anchorId);
  const top = el ? el.getBoundingClientRect().top : null;
  renderCapstone();
  const el2 = document.getElementById(anchorId);
  if (el2 && top != null) window.scrollTo(0, window.scrollY + el2.getBoundingClientRect().top - top);
}

/** input / change events (search box, selects, write-ups, escalation checkboxes). */
export function handleInput(e) {
  const t = e.target;
  if (inv && t.id === 'siem-text') {
    live = t.value;
    if (e.type === 'change') return commitQuery();
    refreshResults();
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commitQuery, 1200);
    return undefined;
  }
  if (inv && t.dataset.field && e.type === 'change') {
    setQuery({ ...currentQuery(), [t.dataset.field]: t.value });
    return undefined;
  }
  if (inv && t.dataset.amb && t.type === 'checkbox') {
    const group = t.dataset.amb;
    const set = new Set(inv[group] || []);
    if (t.checked) set.add(t.value);
    else set.delete(t.value);
    inv[group] = [...set];
    t.closest('.ck')?.classList.toggle('on', t.checked);
    ctx.save();
    return undefined;
  }
  if (inv && t.id === 'siem-writeup') {
    inv.writeup = t.value;
    const n = t.value.trim().length;
    document.getElementById('siem-wc').textContent = `${n} characters${n < S.MIN_WRITEUP ? ` · at least ${S.MIN_WRITEUP} to count` : ''}`;
    if (e.type === 'change') ctx.save();
    return undefined;
  }
  if (cap && t.dataset.esc) {
    const d = draft(scenarioById(cap.id));
    const field = t.dataset.esc;
    if (t.tagName === 'TEXTAREA') {
      d[field] = t.value;
      document.getElementById('esc-count').textContent = `${t.value.trim().length} characters`;
    } else if (t.type === 'checkbox') {
      const set = new Set(d[field] || []);
      if (t.checked) set.add(t.value);
      else set.delete(t.value);
      d[field] = [...set];
      t.closest('.ck')?.classList.toggle('on', t.checked);
    }
    if (e.type === 'change' || t.type === 'checkbox') ctx.save();
  }
  return undefined;
}

/** Keyboard: Enter in the search box commits the search right away. */
export function handleKey(e) {
  if (inv && e.target.id === 'siem-text' && e.key === 'Enter') {
    e.preventDefault();
    live = e.target.value;
    commitQuery();
    e.target.blur();
  }
}

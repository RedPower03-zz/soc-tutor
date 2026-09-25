// SOC Tutor user interface. Renders screens into #app and talks to the engine.
import { CONTENT } from '../content/index.js';
import * as E from './engine.js';
import * as G from './game.js';
import { loadState, saveState, clearState, newState } from './storage.js';
import { icon } from './icons.js';

const app = document.getElementById('app');
const idx = E.indexContent(CONTENT);
let state = loadState(CONTENT);
applyTheme();

// session: { type: 'auto' | 'review' | 'skill' | 'placement', skillId? }
let session = null;
// current question: { item, mode, note, order: [choice texts], selected: Set, answered, result }
let current = null;

// Severity classes: ok (green), info (cyan), warn (amber), crit (red), dim (grey)
const MODE = {
  learn: ['Learn', 'info'],
  review: ['Review', 'warn'],
  probe: ['Prereq check', 'info'],
  remediate: ['Gap fix', 'crit'],
  practice: ['Practice', 'ok'],
  skill: ['Skill drill', 'info'],
  placement: ['Placement', 'info'],
};
const STATUS = {
  mastered: ['Mastered', 'ok'],
  learning: ['In progress', 'info'],
  new: ['Ready', 'ready'],
  gap: ['Gap', 'crit'],
  locked: ['Locked', 'dim'],
  'coming-soon': ['Planned', 'dim'],
};
const TYPE_LABEL = { mc: 'Multiple choice', multi: 'Select all that apply', text: 'Typed answer' };
const NOTE = {
  probe: ['Prerequisite check', 'info', 'layers'],
  gap: ['Gap detected', 'crit', 'alert'],
  return: ['Returning', 'ok', 'ret'],
  info: ['Status', 'ok', 'award'],
};
const EVENT = {
  'review-added': ['Queued', 'warn'],
  'review-requeued': ['Queued', 'warn'],
  'review-advanced': ['Review', 'info'],
  'review-cleared': ['Cleared', 'ok'],
  'probe-start': ['Prereq', 'info'],
  'probe-solid': ['Pass', 'ok'],
  'gap-found': ['Gap', 'crit'],
  'gap-resolved': ['Closed', 'ok'],
  'remediation-paused': ['Paused', 'warn'],
  return: ['Return', 'info'],
  mastered: ['Mastered', 'ok'],
  unlocked: ['Unlocked', 'ok'],
};
const TRACK_ICON = { host: 'host', network: 'network', soc: 'radar' };
const TRACK_CODE = { host: 'HST', network: 'NET', soc: 'SOC' };
const TRACK_LABEL = { soc: 'Level 2+ roadmap' }; // shorter heading for the phone layout

// Short codes like HST-01 / NET-03 for the skill map.
const SKILL_CODE = {};
for (const t of CONTENT.tracks) {
  CONTENT.skills
    .filter((s) => s.track === t.id)
    .sort((a, b) => a.order - b.order)
    .forEach((s, i) => (SKILL_CODE[s.id] = `${TRACK_CODE[t.id] || t.id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(2, '0')}`));
}

// ------------------------------------------------------------------ helpers

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
/** Escapes text and turns `backticks` into <code>. */
function rich(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}
/** Engine messages may contain emoji; the command-center look uses text tags instead. */
function plainText(s) {
  return String(s ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
// Mastery is a probability, so never show a flat 100%.
const pct = (p) => Math.min(99, Math.round(p * 100));
const pad = (n, w = 2) => String(n).padStart(w, '0');
const skillName = (id) => idx.skillById.get(id)?.name || id;
const bar = (p, cls = '') => `<div class="bar ${cls}"><span style="width:${pct(p)}%"></span></div>`;
const chip = ([label, sev], extra = '') => `<span class="chip ${sev} ${extra}">${esc(label)}</span>`;

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

// ------------------------------------------------------------------ status bar

function statusBar() {
  return `<div class="statusbar" role="banner">
      <span class="sb-brand">${icon('shield')}<b>SOC Tutor</b><span class="sep">//</span><span class="sb-sub">Analyst training</span></span>
      <button class="sb-live sb-xp" data-action="profile" title="Level and XP. Open profile &amp; badges">${rankInsignia(G.rankIndex(state.game.rankId), 'mini')}<span class="sr-only">Profile: </span><span>LVL <b>${pad(state.game.level)}</b></span><span class="sep">·</span><span class="js-xp">${state.game.xp.toLocaleString('en-US')} XP</span></button>
    </div>`;
}

// ------------------------------------------------------------------ gamification UI

function applyTheme() {
  document.documentElement.dataset.theme = state.game.theme || 'cyan';
}

/** Rank insignia: one chevron per rank up to four, plus a star for the specialist ranks. */
function rankInsignia(ri, cls = '') {
  const chevrons = ri >= 4 ? 3 : ri + 1;
  const star = ri >= 4;
  let paths = '';
  for (let i = 0; i < chevrons; i++) {
    const y = 30 - i * 6;
    paths += `<path d="M5 ${y} L16 ${y - 6} L27 ${y}"/>`;
  }
  if (star) {
    const n = ri - 3; // 1..3 stars for responder/hunter/lead
    for (let i = 0; i < n; i++) {
      const cx = 16 + (i - (n - 1) / 2) * 8;
      paths += `<path class="star" d="M${cx} 1.5 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/>`;
    }
  }
  return `<svg class="insignia ${cls}" viewBox="0 0 32 34" aria-hidden="true">${paths}</svg>`;
}

function levelProgress(game) {
  const lo = G.levelThreshold(game.level);
  const hi = G.levelThreshold(game.level + 1);
  return { lo, hi, into: game.xp - lo, span: hi - lo, frac: (game.xp - lo) / (hi - lo) };
}

function operatorPanel({ withButton = true } = {}) {
  const g = state.game;
  const ri = G.rankIndex(g.rankId);
  const lp = levelProgress(g);
  const next = G.RANKS[ri + 1];
  const nextTxt = next
    ? `Next rank: <b>${esc(next.title)}</b> at ${next.xp.toLocaleString('en-US')} XP${next.gate ? ` ${esc(G.gateText(next, CONTENT))}` : ''}`
    : 'Top of the ladder.';
  const s = g.streak;
  const studiedToday = s.lastDay === G.dayKey(Date.now());
  const earned = Object.keys(g.badges).length;
  return panel({
    title: 'Operator',
    icon: 'user',
    meta: `Rank ${pad(ri + 1)}/${pad(G.RANKS.length)}`,
    hud: true,
    cls: 'operator',
    body: `<div class="op-id">
        <div class="op-insignia">${rankInsignia(ri)}</div>
        <div class="op-main">
          <div class="op-title">${esc(G.currentTitle(g))}</div>
          <div class="op-rank muted small">${G.currentTitle(g) !== G.RANKS[ri].title ? `Rank: ${esc(G.RANKS[ri].title)}` : `Career rank ${ri + 1} of ${G.RANKS.length}`}</div>
        </div>
        <div class="op-level"><b class="readout">${pad(g.level)}</b><span class="label">Level</span></div>
      </div>
      <div class="xpbar-wrap">
        <div class="label row"><span>XP <b class="mono accent-text">${g.xp.toLocaleString('en-US')}</b></span><span class="mono">${lp.into}/${lp.span} to LVL ${pad(g.level + 1)}</span></div>
        <div class="xpbar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="${lp.span}" aria-valuenow="${lp.into}"><span style="width:${Math.max(2, Math.round(lp.frac * 100))}%"></span></div>
        <p class="op-next small muted">${nextTxt}</p>
      </div>
      <div class="op-stats">
        <div class="op-stat">${icon('flame')}<span><b class="mono">${s.current}</b> day streak${studiedToday ? '' : '<em> · study today to extend</em>'}</span></div>
        <div class="op-stat">${icon('shield')}<span><b class="mono">${s.freezes}</b> grace day${s.freezes === 1 ? '' : 's'}</span></div>
        <div class="op-stat">${icon('award')}<span><b class="mono">${earned}</b>/${G.BADGES.length} badges</span></div>
      </div>
      ${withButton ? `<button class="btn secondary" data-action="profile">${icon('award')}Profile &amp; badges</button>` : ''}`,
  });
}

function badgeEmblem(b, earned, size = '') {
  const secret = b.hidden && !earned;
  return `<span class="emblem ${earned ? 'earned' : 'locked'} ${secret ? 'secret' : ''} ${size}" aria-hidden="true">
      <svg class="hex" viewBox="0 0 48 52"><path d="M24 2 45 14v24L24 50 3 38V14z"/></svg>
      ${secret ? '<span class="q">?</span>' : icon(b.icon)}
    </span>`;
}

function renderProfile() {
  session = null;
  current = null;
  const g = state.game;
  const ri = G.rankIndex(g.rankId);
  const badges = G.badgeProgress(g, state, CONTENT);
  const earnedList = badges.filter((b) => b.earned).sort((a, b) => b.earned.earnedAt - a.earned.earnedAt);
  const locked = badges.filter((b) => !b.earned).sort((a, b) => (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0) || b.progress.current / b.progress.target - a.progress.current / a.progress.target);
  const fmtDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const badgeCard = (b) => {
    const secret = b.hidden && !b.earned;
    const p = b.progress;
    return `<li class="badge ${b.earned ? 'earned' : 'locked'} ${secret ? 'secret' : ''}">
        ${badgeEmblem(b, !!b.earned)}
        <div class="bd-name">${secret ? '???' : esc(b.name)}</div>
        <div class="bd-desc">${secret ? 'Secret badge. Keep training to find it.' : esc(b.description)}</div>
        ${
          b.earned
            ? `<div class="bd-meta ok-text">${icon('check')}${b.earned.retro ? 'Earned earlier' : `Earned ${fmtDate(b.earned.earnedAt)}`}</div>`
            : secret
              ? '<div class="bd-meta muted">Locked</div>'
              : `<div class="bd-prog">${bar(p.current / p.target)}<span class="mono">${p.text ? esc(p.text) : `${p.current}/${p.target}`}</span></div>`
        }
        ${b.needs && !b.earned ? `<div class="bd-needs">Unlocks with ${esc(b.needs)} (coming soon)</div>` : ''}
        ${b.title && !secret ? `<div class="bd-title">${icon('tag')}Title: ${esc(b.title)}</div>` : ''}
      </li>`;
  };

  const ladder = G.RANKS.map((r, i) => {
    const state_ = i < ri ? 'done' : i === ri ? 'current' : 'locked';
    const gate = r.gate ? G.gateText(r, CONTENT) : '';
    const xpFrac = Math.min(1, g.xp / r.xp || 0);
    return `<li class="rung ${state_}">
        <span class="rung-ins">${rankInsignia(i, 'sm')}</span>
        <span class="rung-main">
          <span class="rung-top"><span class="rung-name">${esc(r.title)}</span>${
            state_ === 'current' ? chip(['Current', 'info']) : state_ === 'done' ? chip(['Achieved', 'ok']) : chip(['Locked', 'dim'])
          }</span>
          <span class="rung-req small">${r.xp ? `${r.xp.toLocaleString('en-US')} XP` : 'Starting rank'}${gate ? ` ${esc(gate)}` : ''}</span>
          ${i === ri + 1 ? `<span class="rung-bar">${bar(xpFrac)}<span class="mono small">${g.xp.toLocaleString('en-US')}/${r.xp.toLocaleString('en-US')}</span></span>` : ''}
        </span>
        ${state_ === 'locked' ? `<span class="rung-lock">${icon('lock')}</span>` : ''}
      </li>`;
  }).join('');

  const titles = G.availableTitles(g);
  const equipped = g.equippedTitle;
  const lockedTitles = [
    ...G.RANKS.slice(ri + 1).map((r) => ({ title: r.title, source: `Reach ${r.title}` })),
    ...G.BADGES.filter((b) => b.title && !g.badges[b.id] && !b.hidden).map((b) => ({ title: b.title, source: `Earn ${b.name}` })),
  ];
  const titleRows = `<ul class="titles">
      <li><button class="title-opt ${equipped ? '' : 'on'}" data-action="equip-title" data-title="">${icon(equipped ? 'tag' : 'check')}<span><b>Rank title (auto)</b><em>${esc(G.RANKS[ri].title)}</em></span></button></li>
      ${titles
        .filter((t) => t.id !== `rank:${g.rankId}`)
        .map((t) => `<li><button class="title-opt ${equipped === t.id ? 'on' : ''}" data-action="equip-title" data-title="${esc(t.id)}">${icon(equipped === t.id ? 'check' : 'tag')}<span><b>${esc(t.title)}</b><em>${esc(t.source)}</em></span></button></li>`)
        .join('')}
    </ul>
    ${lockedTitles.length ? `<div class="label spaced">Locked titles</div><ul class="locked-titles">${lockedTitles.map((t) => `<li title="${esc(t.source)}">${icon('lock')}<span><b>${esc(t.title)}</b> <em>${esc(t.source)}</em></span></li>`).join('')}</ul>` : ''}`;

  const unlocked = new Set(G.unlockedThemes(g).map((t) => t.id));
  const themes = `<div class="themes">${G.THEMES.map((t) => {
    const ok = unlocked.has(t.id);
    const rankTitle = G.RANKS[G.rankIndex(t.rank)].title;
    return `<button class="theme-opt t-${t.id} ${g.theme === t.id ? 'on' : ''}" ${ok ? `data-action="set-theme" data-theme="${t.id}"` : 'disabled'} aria-pressed="${g.theme === t.id}">
        <span class="swatch"></span><span class="th-name">${esc(t.name)}</span><span class="th-sub">${ok ? (g.theme === t.id ? 'Active' : esc(t.description)) : `${icon('lock')}Unlocks at ${esc(rankTitle)}`}</span>
      </button>`;
  }).join('')}</div>`;

  const s = g.streak;
  const streakPanel = panel({
    title: 'Study streak',
    icon: 'flame',
    meta: `Best ${s.best}`,
    body: `<div class="streak">
        <div class="readout-block"><div class="readout big">${s.current}<small>d</small></div><div class="label">Current</div></div>
        <div class="streak-info">
          <div class="grace">${Array.from({ length: G.MAX_FREEZES }, (_, i) => `<span class="grace-pip ${i < s.freezes ? 'on' : ''}">${icon('shield')}</span>`).join('')}<span class="small"><b>${s.freezes}</b>/${G.MAX_FREEZES} grace days banked</span></div>
          <p class="small muted">Study on any day to extend your streak. Each week you study banks one grace day (up to ${G.MAX_FREEZES}). If you miss a day, a grace day covers it automatically. Breaks happen; your XP, badges and rank never go down.</p>
        </div>
      </div>`,
  });

  const xpTable = `<table class="xptable"><thead><tr><th>Action</th><th>XP</th></tr></thead><tbody>${G.XP_TABLE.map(([a, v]) => `<tr><td>${esc(a)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">XP rewards effort and learning, not volume: wrong answers still earn a little, XP is never taken away, and grinding easy questions in a skill you've mastered earns nothing. Levels: level N starts at 50×N×(N−1) XP.</p>`;

  render(`
    ${statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">${icon('back')}</button>
      <div class="qbar-mid">${chip(['Profile', 'info'], 'mode')}<span class="skill-label">Rank, badges and unlocks</span></div>
    </header>
    ${operatorPanel({ withButton: false })}
    ${panel({
      title: 'Badges',
      icon: 'award',
      meta: `${earnedList.length}/${badges.length} earned`,
      cls: 'badges-panel',
      id: 'badges',
      body: `${earnedList.length ? `<ul class="badge-grid">${earnedList.map(badgeCard).join('')}</ul>` : '<p class="empty">No badges yet. Your first correct answer earns one.</p>'}
        <div class="label spaced">Locked</div>
        <ul class="badge-grid">${locked.map(badgeCard).join('')}</ul>`,
    })}
    ${streakPanel}
    ${panel({ title: 'Career ladder', icon: 'chart', meta: `${ri + 1}/${G.RANKS.length}`, cls: 'ladder-panel', body: `<ol class="ladder">${ladder}</ol><p class="small muted">Higher ranks need mastery as well as XP. Incident Responder and above unlock with the Level 2+ modules and the capstone.</p>` })}
    ${panel({ title: 'Titles', icon: 'tag', meta: `${titles.length} unlocked`, body: `<p class="small muted">Equip a title to show it on your operator card.</p>${titleRows}` })}
    ${panel({ title: 'Console theme', icon: 'palette', meta: `${unlocked.size}/${G.THEMES.length}`, body: `<p class="small muted">Accent palettes unlock as you rank up.</p>${themes}` })}
    ${panel({ title: 'How XP works', icon: 'list', body: xpTable })}
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

// ------------------------------------------------------------------ toasts (XP popups and achievements)

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const toastHost = document.createElement('div');
toastHost.className = 'toasts';
toastHost.setAttribute('aria-live', 'polite');
toastHost.setAttribute('aria-atomic', 'false');
const xpHost = document.createElement('div');
xpHost.className = 'toasts xp-toasts';
xpHost.setAttribute('aria-hidden', 'true'); // the feedback card already states the XP earned
document.body.append(toastHost, xpHost);

function toast(html, cls, ms, host = toastHost) {
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.innerHTML = html;
  host.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  let gone = false;
  const kill = () => {
    if (gone) return;
    gone = true;
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), reduceMotion() ? 0 : 220);
  };
  el.addEventListener('click', kill);
  setTimeout(kill, ms);
  return el;
}

function xpToast(amount) {
  if (amount <= 0) return;
  toast(`<span class="xp-plus">+${amount}</span><span class="xp-unit">XP</span>`, 'xp-pop', 1600, xpHost);
}

/** Level-ups, rank-ups and badges, queued so they appear one after another. */
let achQueue = [];
let achBusy = false;
function queueAchievements(changes) {
  if (!changes) return;
  // Only the latest level-up matters; drop any older one still waiting.
  if (changes.levelUp) achQueue = achQueue.filter((a) => a.level == null);
  if (changes.rankUp) {
    const themes = changes.rankUp.themes.map((t) => t.name);
    achQueue.push({ kind: 'Rank up', title: changes.rankUp.rank.title, sub: `New title unlocked${themes.length ? ` · ${themes.join(', ')} theme unlocked` : ''}`, ins: G.rankIndex(changes.rankUp.rank.id) });
  }
  for (const b of changes.badges || []) achQueue.push({ kind: 'Achievement unlocked', title: b.name, sub: b.description, badge: b });
  if (changes.levelUp) achQueue.push({ kind: 'Level up', title: `Level ${pad(changes.levelUp.to)}`, sub: `${state.game.xp.toLocaleString('en-US')} XP total`, level: changes.levelUp.to });
  pumpAchievements();
}
function pumpAchievements() {
  if (achBusy || !achQueue.length) return;
  achBusy = true;
  const a = achQueue.shift();
  const art = a.badge
    ? badgeEmblem(a.badge, true, 'lg')
    : a.ins != null
      ? `<span class="ach-ins">${rankInsignia(a.ins)}</span>`
      : `<span class="ach-lvl readout">${pad(a.level)}</span>`;
  const el = toast(
    `<div class="ach-head"><span class="ach-kind">${esc(a.kind)}</span><span class="ach-x" aria-hidden="true">${icon('x')}</span></div>
     <div class="ach-body">${art}<div><div class="ach-title">${esc(a.title)}</div><div class="ach-sub">${esc(a.sub)}</div></div></div>`,
    `ach ${a.badge ? 'ach-badge' : a.ins != null ? 'ach-rank' : 'ach-level'}`,
    achQueue.length ? 2200 : 3500, // shorter when more are waiting, so the backlog clears fast
  );
  const done = () => {
    achBusy = false;
    setTimeout(pumpAchievements, reduceMotion() ? 0 : 150);
  };
  // Show the next one once this card has left (auto-dismiss or tap).
  const obs = new MutationObserver(() => {
    if (!el.isConnected) {
      obs.disconnect();
      if (achBusy) done();
    }
  });
  obs.observe(toastHost, { childList: true });
}

function refreshStatusXp() {
  for (const el of document.querySelectorAll('.statusbar')) el.outerHTML = statusBar();
}

function panel({ title, icon: ic, meta = '', body, cls = '', hud = false, id = '' }) {
  return `<section class="panel ${hud ? 'hud' : ''} ${cls}" ${id ? `id="${id}"` : ''}>
      <header class="panel-head">${ic ? icon(ic) : ''}<span class="ph-title">${title}</span>${meta ? `<span class="ph-meta">${meta}</span>` : ''}</header>
      <div class="panel-body">${body}</div>
    </section>`;
}

// ------------------------------------------------------------------ home

function renderHome() {
  session = null;
  current = null;
  const prog = E.overallProgress(state, CONTENT);
  const firstVisit = state.turn === 0 && !state.placement?.done;
  const top = state.focus[state.focus.length - 1];
  const openGaps = Object.values(state.gaps).filter((g) => !g.resolved).length;

  const welcome = firstVisit
    ? panel({
        title: 'Analyst onboarding',
        icon: 'terminal',
        hud: true,
        cls: 'welcome',
        body: `<p class="lead">Train like a SOC analyst, starting with host and network basics.</p>
          <p class="muted">The tutor adapts as you go: it re-asks what you miss and digs into the building blocks behind your mistakes.</p>
          <p class="muted small">Know some of this already? Run the placement check: one question per skill (${idx.activeSkills.length} total). You can stop at any time.</p>
          <button class="btn primary" data-action="placement">${icon('target')}Run placement check</button>
          <button class="btn secondary" data-action="skip-placement">${icon('play')}Start from the basics</button>`,
      })
    : '';

  const focusBanner = top
    ? `<div class="alert ${top.kind === 'probe' ? 'info' : 'crit'}" role="status">
        <div class="alert-tag">${icon(top.kind === 'probe' ? 'layers' : 'alert')}<span>${top.kind === 'probe' ? 'Prerequisite check active' : 'Gap remediation active'}</span></div>
        <div class="alert-msg">${top.kind === 'probe' ? 'Checking building block' : 'Working on gap'}: <b>${esc(skillName(top.skillId))}</b>, then back to ${esc(skillName(top.returnTo))}.</div>
      </div>`
    : '';

  const segs = idx.activeSkills
    .map((s) => {
      const st = E.skillStatus(state, CONTENT, s.id);
      return `<i class="seg ${st}" title="${esc(s.name)}: ${STATUS[st][0]}"></i>`;
    })
    .join('');

  const hero = panel({
    title: 'Analyst readiness',
    icon: 'chart',
    meta: 'Level 1',
    hud: true,
    cls: 'hero',
    body: `
      <div class="readiness">
        <div class="readout-block">
          <div class="readout big">${pct(prog.average)}<small>%</small></div>
          <div class="label">Avg mastery</div>
        </div>
        <div class="seg-block">
          <div class="label row"><span>Skills mastered</span><span class="mono"><b class="ok-text">${prog.mastered}</b>/${prog.total}</span></div>
          <div class="segbar" style="--n:${idx.activeSkills.length}" aria-label="${prog.mastered} of ${prog.total} skills mastered">${segs}</div>
          <div class="legend"><span class="lg ok">Mastered</span><span class="lg info">Active</span><span class="lg crit">Gap</span><span class="lg dim">Locked</span></div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><b class="mono">${pad(prog.answered, 3)}</b><span>Answered</span></div>
        <div class="stat ${prog.reviewCount ? 'warn' : ''}"><b class="mono">${pad(prog.reviewCount)}</b><span>To review</span></div>
        <div class="stat ${openGaps ? 'crit' : ''}"><b class="mono">${pad(openGaps)}</b><span>Open gaps</span></div>
      </div>
      ${firstVisit ? '' : `<button class="btn primary" data-action="continue">${icon('play')}${prog.answered ? 'Continue learning' : 'Start learning'}</button>`}
      <button class="btn secondary warn" data-action="review" ${prog.reviewCount ? '' : 'disabled'}>
        ${icon('review')}Review missed items<span class="count">${pad(prog.reviewCount)}</span>
      </button>
      <button class="btn secondary" data-action="report">${icon('chart')}Gap report</button>`,
  });

  const tracks = CONTENT.tracks
    .map((t) => {
      const skills = CONTENT.skills.filter((s) => s.track === t.id).sort((a, b) => a.order - b.order);
      const masteredCount = skills.filter((s) => E.skillStatus(state, CONTENT, s.id) === 'mastered').length;
      return `<div class="track">
        <div class="track-head">${icon(TRACK_ICON[t.id] || 'grid')}<h3>${esc(TRACK_LABEL[t.id] || t.name)}</h3>
          <span class="count">${t.comingSoon ? `${skills.length} planned` : `${masteredCount}/${skills.length} mastered`}</span></div>
        <div class="skill-list">${skills.map(renderSkillRow).join('')}</div>
      </div>`;
    })
    .join('');

  render(`
    ${statusBar()}
    ${welcome}
    ${focusBanner}
    ${firstVisit ? '' : operatorPanel()}
    ${hero}
    ${panel({ title: 'Skill map', icon: 'grid', meta: 'Tap a skill to drill it', cls: 'skillmap', body: tracks })}
    <footer class="footer">
      <p>Progress is saved in this browser on this device.</p>
      <button class="btn danger" data-action="reset">${icon('reset')}Reset progress</button>
    </footer>
  `);
}

function renderSkillRow(s) {
  const status = E.skillStatus(state, CONTENT, s.id);
  const ss = state.skills[s.id];
  const clickable = ['new', 'learning', 'gap', 'mastered'].includes(status);
  const needs = s.prereqs.length ? `Req: ${s.prereqs.map((p) => esc(skillName(p))).join(', ')}` : 'No prerequisites';
  const p = ss && ss.attempts ? ss.p : 0; // untouched skills show an empty bar
  return `<button class="skill s-${status}" ${clickable ? `data-action="skill" data-skill="${s.id}"` : 'disabled'} aria-label="${esc(s.name)}: ${STATUS[status][0]}">
      <span class="sk-code">${SKILL_CODE[s.id]}</span>
      <span class="sk-main">
        <span class="sk-top"><span class="sk-name">${esc(s.name)}</span>${chip(STATUS[status])}</span>
        ${
          status === 'coming-soon'
            ? `<span class="sk-meta">${esc(s.summary)}</span>`
            : `<span class="sk-bar">${bar(p, status === 'mastered' ? 'ok' : status === 'gap' ? 'crit' : '')}<span class="sk-pct">${ss && ss.attempts ? `${pct(p)}%` : '--'}</span></span>
               <span class="sk-meta"><span>${needs}</span>${ss && ss.attempts ? `<span class="mono">${ss.correct}/${ss.attempts}</span>` : ''}</span>`
        }
      </span>
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
    if (session.type === 'review') return renderDone('Review queue clear', 'All caught up. No missed questions are waiting for review right now.');
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

function snippetHtml(text) {
  const lines = String(text).split('\n');
  return `<div class="evidence">
      <div class="evidence-head"><span>${icon('terminal')}Evidence</span><span>${lines.length} line${lines.length === 1 ? '' : 's'}</span></div>
      <pre class="snippet">${lines.map((l) => `<span class="ln">${esc(l) || ' '}</span>`).join('')}</pre>
    </div>`;
}

function renderQuestion() {
  const { item, mode, note } = current;
  const ss = state.skills[item.skill];
  const isPlacement = mode === 'placement';
  const pl = state.placement;
  const [modeLabel, modeSev] = MODE[mode] || [mode, 'info'];

  const noteHtml = note ? noteBanner(note) : '';

  let answers = '';
  if (item.type === 'text') {
    answers = `<label class="field-label" for="answer-text">Your answer</label>
      <input id="answer-text" class="text-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type answer and press Enter" />`;
  } else {
    answers = `${item.type === 'multi' ? '<p class="hint">Select every correct option, then submit.</p>' : ''}
      <div class="choices" role="${item.type === 'multi' ? 'group' : 'radiogroup'}">
        ${current.order
          .map(
            (c, i) =>
              `<button class="choice ${item.type === 'multi' ? 'multi' : ''}" data-action="choose" data-index="${i}" role="${item.type === 'multi' ? 'checkbox' : 'radio'}" aria-checked="false">
                <span class="key">${String.fromCharCode(65 + i)}</span><span class="choice-text">${rich(c)}</span></button>`,
          )
          .join('')}
      </div>`;
  }

  const diff = `<span class="diff" aria-label="Difficulty ${item.difficulty} of 3">${'<i class="on"></i>'.repeat(item.difficulty)}${'<i></i>'.repeat(3 - item.difficulty)}</span>`;

  render(`
    ${statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">${icon('x')}</button>
      <div class="qbar-mid">
        ${chip([modeLabel, modeSev], 'mode')}
        <span class="skill-label">${esc(skillName(item.skill))}</span>
      </div>
      ${
        isPlacement
          ? `<div class="qread"><b class="readout">${pad(pl.index + 1)}<small>/${pad(pl.queue.length)}</small></b><span class="label">Placement</span></div>`
          : `<div class="qread"><b class="readout" id="q-mastery">${pct(ss.p)}<small>%</small></b><span class="label">Mastery</span></div>`
      }
    </header>
    ${noteHtml}
    <article class="panel hud question" data-item-id="${item.id}" data-skill="${item.skill}" data-mode="${mode}">
      <header class="panel-head"><span class="ph-title">Item ${esc(item.id.toUpperCase())}</span><span class="ph-meta">${TYPE_LABEL[item.type]} ${diff}</span></header>
      <div class="panel-body">
        <p class="prompt">${rich(item.prompt)}</p>
        ${item.snippet ? snippetHtml(item.snippet) : ''}
        ${answers}
        <button id="submit-btn" class="btn primary" data-action="submit" ${item.type === 'text' ? '' : 'disabled'}>${icon('check')}Submit answer</button>
        ${isPlacement ? `<button class="btn ghost" data-action="end-placement">Skip the rest of placement</button>` : ''}
      </div>
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

function noteBanner(note) {
  const [label, sev, ic] = NOTE[note.type] || NOTE.info;
  return `<div class="alert ${sev}" role="status">
      <div class="alert-tag">${icon(ic)}<span>Tutor // ${label}</span></div>
      <div class="alert-msg">${esc(plainText(note.text))}</div>
    </div>`;
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
  const wasMastered = E.isMastered(state, CONTENT, item.skill);
  const result = E.recordAnswer(state, CONTENT, item.id, correct, { mode: current.mode, session: session.type });
  const gain = G.onAnswer(state.game, state, CONTENT, {
    item,
    correct,
    mode: current.mode,
    events: result.events,
    wasMastered,
    dueAfter: G.dueCount(state),
    now: Date.now(),
  });
  current.answered = true;
  current.result = result;
  current.gain = gain;
  save();
  renderFeedback(response);
  refreshStatusXp();
  xpToast(gain.xp);
  queueAchievements(gain);
}

function renderFeedback() {
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
      const key = el.querySelector('.key');
      if (right.has(text) && picked) {
        el.classList.add('correct');
        key.innerHTML = icon('check');
      } else if (right.has(text)) {
        el.classList.add(item.type === 'multi' ? 'missed' : 'correct');
        key.innerHTML = icon('check');
      } else if (picked) {
        el.classList.add('wrong');
        key.innerHTML = icon('x');
      }
    });
  }
  document.getElementById('submit-btn').remove();
  app.querySelector('[data-action="end-placement"]')?.remove();

  let answerHtml = '';
  if (!correct) {
    let body;
    if (item.type === 'text') {
      body = `<span class="mono">${esc(item.accept[0])}</span>${item.accept.length > 1 ? `<div class="muted small">Also accepted: ${item.accept.slice(1).map(esc).join(', ')}</div>` : ''}`;
    } else if (item.type === 'mc') {
      body = rich(item.answer);
    } else {
      body = `<ul>${item.answer.map((a) => `<li>${rich(a)}</li>`).join('')}</ul>`;
    }
    answerHtml = `<div class="block ok-block"><div class="label">${item.type === 'multi' ? 'Correct answers' : item.type === 'text' ? 'Accepted answer' : 'Correct answer'}</div><div>${body}</div></div>`;
  }

  const isPlacement = mode === 'placement';
  const up = result.after >= result.before;
  const diffPts = Math.abs(pct(result.after) - pct(result.before));
  const delta = isPlacement
    ? ''
    : `<div class="delta">
        <div class="label row"><span>Skill mastery</span>${diffPts === 0 ? '<span class="nowrap muted">No change</span>' : `<span class="nowrap ${up ? 'ok-text' : 'crit-text'}">${up ? '▲' : '▼'} ${diffPts} pts</span>`}</div>
        <div class="delta-row">${bar(result.after, result.after >= E.PARAMS.masteryThreshold ? 'ok' : up ? '' : 'crit')}<span class="mono"><span class="muted">${pct(result.before)}%</span> → <b>${pct(result.after)}%</b></span></div>
      </div>`;
  const events = result.events.length
    ? `<div class="label">Event log</div><ul class="evlog">${result.events
        .map((e) => {
          const [tag, sev] = EVENT[e.type] || ['Info', 'info'];
          return `<li class="${e.type}"><span class="tag ${sev}">${tag}</span><span>${esc(plainText(e.text))}</span></li>`;
        })
        .join('')}</ul>`
    : '';

  const gain = current.gain;
  const gameEvents = [
    ...(gain.streak || []).map((e) => ({ tag: e.type === 'freeze-used' ? 'Grace' : 'Streak', sev: 'info', text: e.text })),
    ...(gain.badges || []).map((b) => ({ tag: 'Badge', sev: 'ok', text: `${b.name}: ${b.description}` })),
    ...(gain.rankUp ? [{ tag: 'Rank', sev: 'ok', text: `Promoted to ${gain.rankUp.rank.title}.` }] : []),
    ...(gain.levelUp ? [{ tag: 'Level', sev: 'ok', text: `Reached level ${gain.levelUp.to}.` }] : []),
  ];
  const xpHtml = `<div class="xp-earned">
      <div class="label row"><span>XP earned</span><span class="xp-gain mono">${gain.xp ? `+${gain.xp} XP` : '0 XP'}</span></div>
      ${gain.breakdown.length ? `<ul class="xp-list">${gain.breakdown.map((b) => `<li><span>${esc(b.label)}</span><span class="mono">+${b.amount}</span></li>`).join('')}</ul>` : '<p class="small muted">No XP for easy questions in a skill you have already mastered. Try a harder skill.</p>'}
    </div>`;
  const gameLog = gameEvents.length
    ? `<ul class="evlog game">${gameEvents.map((e) => `<li><span class="tag ${e.sev}">${e.tag}</span><span>${esc(e.text)}</span></li>`).join('')}</ul>`
    : '';

  const qm = document.getElementById('q-mastery');
  if (qm) qm.innerHTML = `${pct(result.after)}<small>%</small>`;

  const lastPlacement = isPlacement && state.placement.index >= state.placement.queue.length;
  document.getElementById('feedback').innerHTML = `
    <section class="panel feedback ${correct ? 'fb-ok' : 'fb-bad'}" id="feedback-card">
      <header class="panel-head">${icon(correct ? 'check' : 'x')}<span class="ph-title">${correct ? 'Correct' : 'Incorrect'}</span><span class="ph-meta">Result</span></header>
      <div class="panel-body">
        ${answerHtml}
        <div class="label">Analysis</div>
        <p class="explanation">${rich(item.explanation)}</p>
        ${delta}
        ${xpHtml}
        ${events}
        ${gameLog}
        <button id="next-btn" class="btn primary" data-action="next">${lastPlacement ? 'See placement results' : 'Next question'}${icon('next')}</button>
        <button class="btn ghost" data-action="home">Back to dashboard</button>
      </div>
    </section>`;
  document.getElementById('feedback-card').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

// ------------------------------------------------------------------ placement

function startPlacement() {
  E.startPlacement(state, CONTENT);
  save();
  startSession({ type: 'placement' });
}

function finishPlacement(skipped) {
  const pl = E.finishPlacement(state, CONTENT, { skipped });
  const changes = G.onPlacementDone(state.game, state, CONTENT, pl, Date.now());
  save();
  queueAchievements(changes);
  const asked = pl.index;
  renderDone(
    'Placement complete',
    asked
      ? `You answered ${pl.correct} of ${asked} correctly. Your skill map has been seeded: skills you already know will be mastered quickly, and the tutor will focus on the rest.`
      : 'No problem. The tutor will start from the basics and adapt as you go.',
    { continueLabel: 'Start learning' },
  );
}

function renderDone(title, text, { continueLabel } = {}) {
  session = null;
  render(`
    ${statusBar()}
    ${panel({
      title: esc(title),
      icon: 'check',
      hud: true,
      body: `<p class="muted">${esc(text)}</p>
        ${continueLabel ? `<button class="btn primary" data-action="continue">${icon('play')}${esc(continueLabel)}</button>` : ''}
        <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>`,
    })}`);
}

// ------------------------------------------------------------------ report

function renderReport() {
  session = null;
  const r = E.gapReport(state, CONTENT);
  const list = (items, fn, empty) => (items.length ? `<ul class="rows">${items.map(fn).join('')}</ul>` : `<p class="empty">${empty}</p>`);
  const top = state.focus[state.focus.length - 1];
  const recIsFocus = r.recommendation && top && top.skillId === r.recommendation.skillId;

  const rec = r.recommendation
    ? panel({
        title: 'Recommended next focus',
        icon: 'target',
        hud: true,
        cls: 'recommend',
        body: `<div class="rec-name"><span class="sk-code">${SKILL_CODE[r.recommendation.skillId] || ''}</span>${esc(skillName(r.recommendation.skillId))}</div>
          <p class="muted small">${esc(r.recommendation.reason)}</p>
          ${
            recIsFocus
              ? `<button class="btn primary" data-action="continue">${icon('play')}Fix this gap now</button>`
              : `<button class="btn primary" data-action="skill" data-skill="${r.recommendation.skillId}">${icon('play')}Practice this skill</button>`
          }`,
      })
    : '';

  const gapRow = (g, root) => `<li class="${root ? 'root' : ''}">
      <div class="row"><span class="name">${esc(g.name)}</span>${chip([root ? 'Root gap' : 'Gap', root ? 'crit' : 'warn'])}</div>
      <div class="row sub"><span>Needed for: ${g.neededFor.map(esc).join(', ')}</span><span class="mono">${pct(g.p)}%</span></div>
    </li>`;

  render(`
    ${statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">${icon('back')}</button>
      <div class="qbar-mid">${chip(['Gap report', 'info'], 'mode')}<span class="skill-label">Where you stand and what to fix next</span></div>
    </header>
    ${panel({
      title: 'Session summary',
      icon: 'chart',
      cls: 'summary',
      body: `<div class="stats four">
          <div class="stat"><b class="mono">${pad(r.answered, 3)}</b><span>Answered</span></div>
          <div class="stat"><b class="mono">${r.answered ? pct(r.accuracy) + '%' : '--'}</b><span>Accuracy</span></div>
          <div class="stat ${r.reviewCount ? 'warn' : ''}"><b class="mono">${pad(r.reviewCount)}</b><span>To review</span></div>
          <div class="stat ${r.rootGaps.length ? 'crit' : ''}"><b class="mono">${pad(r.rootGaps.length)}</b><span>Root gaps</span></div>
        </div>`,
    })}
    ${rec}
    ${panel({
      title: 'Root gaps identified',
      icon: 'alert',
      cls: r.rootGaps.length ? 'crit-panel' : '',
      meta: r.rootGaps.length ? `${r.rootGaps.length} open` : 'None',
      body: `<p class="muted small">Building blocks the tutor found behind your mistakes elsewhere.</p>
        ${list(r.rootGaps, (g) => gapRow(g, true), 'None found so far. When you miss questions, the tutor checks the prerequisites and lists any weak ones here.')}
        ${r.otherGaps.length ? `<div class="label spaced">Also flagged (will improve once the root gap is fixed)</div>${list(r.otherGaps, (g) => gapRow(g, false), '')}` : ''}
        ${r.resolvedGaps.length ? `<div class="label spaced">Gaps closed</div><div class="pill-list">${r.resolvedGaps.map((g) => chip([g.name, 'ok'], 'pill')).join('')}</div>` : ''}`,
    })}
    ${panel({
      title: 'Weak skills',
      icon: 'list',
      meta: r.weak.length ? `${r.weak.length}` : '',
      body: list(
        r.weak,
        (s) => `<li>
          <div class="row"><span class="name">${esc(s.name)}</span><span class="mono">${pct(s.p)}%</span></div>
          ${bar(s.p, s.status === 'gap' ? 'crit' : '')}
          <div class="row sub"><span>${s.correct}/${s.attempts} correct</span>${s.outstanding ? `<span class="warn-text">${s.outstanding} awaiting review</span>` : ''}</div></li>`,
        'No weak skills right now.',
      ),
    })}
    ${panel({
      title: 'Most-missed questions',
      icon: 'x',
      body: list(
        r.mostMissed,
        (m) => `<li>
          <div class="row sub"><span class="mono">${esc(m.id.toUpperCase())} · ${esc(m.skillName)}</span></div>
          <div class="q-excerpt">${rich(m.prompt)}</div>
          <div class="row sub"><span class="mono crit-text">Missed ${m.misses}× / ${m.attempts}</span>${m.inReview ? '<span class="warn-text">In review queue</span>' : '<span class="ok-text">Cleared</span>'}</div></li>`,
        'Nothing missed yet.',
      ),
    })}
    ${panel({
      title: 'Mastered skills',
      icon: 'award',
      meta: `${r.mastered.length}/${r.skills.length}`,
      body: r.mastered.length ? `<div class="pill-list">${r.mastered.map((s) => chip([s.name, 'ok'], 'pill')).join('')}</div>` : '<p class="empty">None yet. Keep going!</p>',
    })}
    <button class="btn primary" data-action="continue">${icon('play')}Continue learning</button>
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
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
    case 'profile':
      return renderProfile();
    case 'equip-title': {
      const y = window.scrollY;
      G.equipTitle(state.game, el.dataset.title || null);
      save();
      renderProfile();
      return window.scrollTo(0, y);
    }
    case 'set-theme': {
      const y = window.scrollY;
      G.setTheme(state.game, el.dataset.theme);
      applyTheme();
      save();
      renderProfile();
      return window.scrollTo(0, y);
    }
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
        state = newState(CONTENT);
        applyTheme();
        save();
        renderHome();
      }
      return undefined;
    default:
      return undefined;
  }
});

renderHome();

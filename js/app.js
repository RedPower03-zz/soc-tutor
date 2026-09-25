// SOC Tutor user interface. Renders screens into #app and talks to the engine.
import { CONTENT } from '../content/index.js';
import * as E from './engine.js';
import * as G from './game.js';
import * as S from './scheduler.js';
import { loadState, saveState, clearState, newState } from './storage.js';
import { icon } from './icons.js';

const app = document.getElementById('app');
const idx = E.indexContent(CONTENT);

// ------------------------------------------------------------------ clock (injectable for testing)
// ?debugDays=N shifts the app clock N days forward (stored so reloads keep it; ?debugDays=0 resets).
// Used to check the daily review queue and mastery decay without waiting.
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_KEY = 'soc-tutor:debug-days';
(() => {
  const q = new URLSearchParams(location.search).get('debugDays');
  if (q != null) {
    try {
      if (Number(q)) localStorage.setItem(OFFSET_KEY, String(Number(q)));
      else localStorage.removeItem(OFFSET_KEY);
    } catch {
      /* ignore */
    }
  }
})();
function debugDays() {
  try {
    return Number(localStorage.getItem(OFFSET_KEY)) || 0;
  } catch {
    return 0;
  }
}
const now = () => Date.now() + debugDays() * DAY_MS;

let state = loadState(CONTENT);
E.applyDecay(state, CONTENT, now());
saveState(state); // persist any migration straight away
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
  followup: ['Follow-up', 'crit'],
  mixed: ['Mixed', 'info'],
  daily: ['Daily review', 'warn'],
};
const CONF = {
  guess: ['Guess', 'I\'m guessing'],
  unsure: ['Unsure', 'I think so'],
  sure: ['Sure', 'I know this'],
};
const STATUS = {
  mastered: ['Mastered', 'ok'],
  learning: ['In progress', 'info'],
  new: ['Ready', 'ready'],
  gap: ['Gap', 'crit'],
  fading: ['Refresh', 'warn'],
  locked: ['Locked', 'dim'],
  'coming-soon': ['Planned', 'dim'],
};
const TYPE_LABEL = { mc: 'Multiple choice', multi: 'Select all that apply', text: 'Typed answer' };
const NOTE = {
  probe: ['Prerequisite check', 'info', 'layers'],
  gap: ['Gap detected', 'crit', 'alert'],
  return: ['Returning', 'ok', 'ret'],
  info: ['Status', 'ok', 'award'],
  misconception: ['Misconception check', 'crit', 'target'],
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
  'review-guess': ['Recheck', 'warn'],
  'confident-error': ['Flag', 'crit'],
  misconception: ['Myth', 'crit'],
  'misconception-resolved': ['Busted', 'ok'],
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
/** Escapes text and turns `backticks` into <code> and **stars** into <b>. */
function rich(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
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
  const dueNow = E.dailyDue(state, CONTENT, now()).length;
  const nextDue = nextDueText();

  const welcome = firstVisit
    ? panel({
        title: 'Analyst onboarding',
        icon: 'terminal',
        hud: true,
        cls: 'welcome',
        body: `<p class="lead">Train like a SOC analyst, starting with host and network basics.</p>
          <p class="muted">Each skill starts with a short lesson and worked examples, then practice. The tutor adapts as you go: it re-asks what you miss, targets misconceptions and digs into the building blocks behind your mistakes.</p>
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
        <div class="stat ${dueNow ? 'warn' : ''}"><b class="mono">${pad(dueNow)}</b><span>Due today</span></div>
        <div class="stat ${openGaps ? 'crit' : ''}"><b class="mono">${pad(openGaps)}</b><span>Open gaps</span></div>
      </div>
      ${firstVisit ? '' : `<button class="btn primary" data-action="continue">${icon('play')}${prog.answered ? 'Continue learning' : 'Start learning'}</button>`}
      <button class="btn secondary warn" data-action="daily" ${dueNow ? '' : 'disabled'}>
        ${icon('calendar')}Daily review<span class="count">${dueNow ? `${pad(dueNow)} due` : 'Clear'}</span>
      </button>
      ${dueNow ? '' : `<p class="btn-note">${esc(nextDue)}</p>`}
      <button class="btn secondary" data-action="review" ${prog.reviewCount ? '' : 'disabled'}>
        ${icon('review')}Missed this session<span class="count">${pad(prog.reviewCount)}</span>
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
    ${firstVisit ? '' : operationsPanel()}
    ${panel({ title: 'Skill map', icon: 'grid', meta: 'Tap a skill to drill it', cls: 'skillmap', body: tracks })}
    <footer class="footer">
      <p>Progress is saved in this browser on this device.</p>
      ${debugDays() ? `<p class="warn-text">Debug clock: +${debugDays()} days (open with ?debugDays=0 to reset)</p>` : ''}
      <button class="btn danger" data-action="reset">${icon('reset')}Reset progress</button>
    </footer>
  `);
}

function renderSkillRow(s) {
  const status = E.skillStatus(state, CONTENT, s.id);
  const ss = state.skills[s.id];
  const clickable = ['new', 'learning', 'gap', 'mastered', 'fading'].includes(status);
  const needs = s.prereqs.length ? `Req: ${s.prereqs.map((p) => esc(skillName(p))).join(', ')}` : 'No prerequisites';
  const p = ss && ss.attempts ? ss.p : 0; // untouched skills show an empty bar
  const lesson = E.lessonFor(CONTENT, s.id);
  const ls = E.lessonState(state, s.id);
  const lessonBtn = lesson
    ? `<button class="skill-lesson ${ls.completed ? 'done' : ''}" data-action="open-lesson" data-skill="${s.id}" aria-label="Lesson: ${esc(s.name)}${ls.completed ? ' (completed)' : ''}" title="Lesson">${icon('book')}<span>${ls.completed ? 'Done' : 'Lesson'}</span></button>`
    : '';
  return `<div class="skill-wrap">${skillButton(s, status, ss, clickable, needs, p)}${lessonBtn}</div>`;
}

function skillButton(s, status, ss, clickable, needs, p) {
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

function nextDueText() {
  const next = S.nextDueAt(state);
  if (next == null) return 'Daily review fills up as you answer questions.';
  const days = Math.round((S.startOfDay(next) - S.startOfDay(now())) / DAY_MS);
  if (days <= 0) return 'Next review: later today.';
  if (days === 1) return 'Next review: tomorrow.';
  return `Next review: in ${days} days (${new Date(next).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}).`;
}

/** Navigation slot for practice modes and scenario content (mixed practice now; SIEM mode and capstone later). */
function operationsPanel() {
  const learned = E.learnedSkills(state, CONTENT);
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
      const stages = sc.stages || [];
      const unlocked = stages.filter((st) => (st.requires?.lessons || []).every((sid) => E.lessonState(state, sid).completed || E.lessonState(state, sid).bypassed)).length;
      return `<li class="op-row locked">
          <span class="op-ico">${icon(sc.kind === 'capstone' ? 'flag' : 'search')}</span>
          <span class="op-body"><b>${esc(sc.title)}</b><em>${esc(sc.summary)}</em>
            ${stages.length ? `<span class="op-stages">${stages.map((st, i) => `<i class="${i < unlocked ? 'on' : ''}" title="${esc(st.title)}"></i>`).join('')}<span>${unlocked}/${stages.length} stages unlocked by lessons</span></span>` : ''}</span>
          ${chip(['Round 2', 'dim'])}
        </li>`;
    })
    .join('');
  return panel({ title: 'Operations', icon: 'target', meta: 'Practice modes', cls: 'ops', body: `<ul class="op-list">${rows}</ul>` });
}

// ------------------------------------------------------------------ sessions

function startSession(s) {
  session = s;
  lessonView = null;
  if (E.applyDecay(state, CONTENT, now()).length) save();
  showNext();
}

function showNext() {
  const next = E.nextItem(state, CONTENT, { session: session.type, skillId: session.skillId, now: now() });
  save();
  if (!next) {
    if (session.type === 'placement') return finishPlacement(false);
    if (session.type === 'review') return renderDone('Review queue clear', 'All caught up. No missed questions are waiting for review right now.');
    if (session.type === 'daily') return renderDone('Daily review complete', `Nothing else is due today. ${nextDueText()}`, { continueLabel: 'Continue learning' });
    if (session.type === 'mixed') return renderDone('Mixed practice locked', `Learn at least ${E.PARAMS.interleaveMinLearned} skills to unlock mixed practice.`);
    return renderHome();
  }
  if (next.mode === 'lesson') return openLesson(next.skillId, { gate: true, offer: next.offer, note: next.note });
  const { item } = next;
  current = {
    ...next,
    order: item.choices ? shuffle(item.choices) : null,
    selected: new Set(),
    answered: false,
    result: null,
    confidence: null,
    recognized: !next.recognize,
    areaChoices: next.recognize ? areaChoices(item) : null,
  };
  renderQuestion();
}

/** Four skill names for "Which area does this evidence involve?": the right one plus distractors, learned skills first. */
function areaChoices(item) {
  const learned = E.learnedSkills(state, CONTENT).filter((id) => id !== item.skill);
  const others = idx.activeSkills.map((s) => s.id).filter((id) => id !== item.skill && !learned.includes(id));
  const distract = [...shuffle(learned), ...shuffle(others)].slice(0, 3);
  return shuffle([item.skill, ...distract]);
}

// ------------------------------------------------------------------ lessons

// { skillId, gate, offer, stage: 'offer'|'read'|'worked'|'faded', i, step, todo, answered, response, correct, order, results, snapshot, note }
let lessonView = null;

function openLesson(skillId, { gate = false, offer = false, section = null, fromQuestion = false, note = null, returnTo = null } = {}) {
  const lesson = E.lessonFor(CONTENT, skillId);
  if (!lesson) return;
  lessonView = {
    skillId,
    gate,
    offer,
    note,
    stage: offer ? 'offer' : 'read',
    i: 0,
    step: 1,
    section,
    returnTo,
    snapshot: fromQuestion ? { html: app.innerHTML, y: window.scrollY, value: document.getElementById('answer-text')?.value ?? null } : null,
  };
  renderLessonView();
}

function awardLearning(events) {
  for (const e of events) {
    const r = G.onLearningEvent(state.game, state, CONTENT, { type: e.type, now: now() });
    xpToast(r.xp);
    queueAchievements(r);
  }
  save();
  refreshStatusXp();
}

function lessonMinutes(lesson) {
  const words = JSON.stringify(lesson.sections).split(/\s+/).length;
  return Math.max(2, Math.round(words / 180));
}

function lessonHeader(lesson, stage) {
  const ls = E.lessonState(state, lesson.skill);
  const workedDone = lesson.worked.every((w) => (ls.worked || []).includes(w.id));
  const fadedDone = lesson.faded.every((f) => (ls.faded || []).includes(f.id));
  const steps = [
    ['read', 'Concept', ls.read],
    ['worked', 'Worked', workedDone],
    ['faded', 'Your turn', fadedDone],
  ];
  return `${statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="lesson-exit" aria-label="${lessonView.snapshot ? 'Back to question' : 'Close lesson'}">${icon(lessonView.snapshot ? 'back' : 'x')}</button>
      <div class="qbar-mid">${chip(['Lesson', 'info'], 'mode')}<span class="skill-label">${esc(skillName(lesson.skill))}</span></div>
      <div class="qread"><b class="readout">${lessonMinutes(lesson)}<small>min</small></b><span class="label">Read</span></div>
    </header>
    ${
      stage === 'offer'
        ? ''
        : `<ol class="stepper" aria-label="Lesson steps">${steps
            .map(
              ([id, label, done], i) =>
                `<li><button class="${id === stage ? 'on' : ''} ${done ? 'done' : ''}" data-action="lesson-go" data-stage="${id}" ${id === stage ? 'aria-current="step"' : ''}><span class="n">${done ? icon('check') : pad(i + 1)}</span><span>${label}</span></button></li>`,
            )
            .join('')}<li><span class="stepper-end ${lessonView.gate ? '' : 'dim'}"><span class="n">${pad(4)}</span><span>Practice</span></span></li></ol>`
    }`;
}

function renderLessonView() {
  const lv = lessonView;
  const lesson = E.lessonFor(CONTENT, lv.skillId);
  if (lv.stage === 'offer') return renderLessonOffer(lesson);
  if (lv.stage === 'worked') return renderWorked(lesson);
  if (lv.stage === 'faded') return renderFaded(lesson);
  return renderLessonRead(lesson);
}

function renderLessonOffer(lesson) {
  render(`
    ${lessonHeader(lesson, 'offer')}
    ${lessonView.note ? noteBanner(lessonView.note) : ''}
    ${panel({
      title: 'Building block',
      icon: 'layers',
      hud: true,
      body: `<div class="rec-name">${esc(lesson.title)}</div>
        <p class="muted">The tutor wants to check this building block, and you haven't studied it yet. A short lesson first usually makes the check more useful.</p>
        <p class="small muted">Goal: ${esc(lesson.goal)}</p>
        <button class="btn primary" data-action="lesson-accept">${icon('book')}Read the lesson first</button>
        <button class="btn secondary" data-action="lesson-decline">${icon('next')}Skip to the check</button>`,
    })}`);
}

function lessonFooter(lesson, stage) {
  const lv = lessonView;
  if (lv.snapshot) return `<button class="btn primary" data-action="lesson-exit">${icon('back')}Back to the question</button>`;
  const practice = lv.gate
    ? `<button class="btn primary" data-action="lesson-finish">${icon('play')}${lv.offer ? 'Continue to the check' : 'Start practice'}</button>`
    : E.skillStatus(state, CONTENT, lesson.skill) === 'locked'
      ? `<p class="small muted">This skill unlocks after its prerequisites: ${idx.skillById.get(lesson.skill).prereqs.map((p) => esc(skillName(p))).join(', ')}.</p><button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>`
      : `<button class="btn primary" data-action="skill" data-skill="${lesson.skill}">${icon('play')}Practice this skill</button>`;
  if (stage === 'read') {
    return `<button class="btn primary" data-action="lesson-go" data-stage="worked">Next: worked example${icon('next')}</button>
      ${lv.gate ? `<button class="btn ghost" data-action="lesson-skip">Skip the lesson and go to questions</button>` : `<button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>`}`;
  }
  if (stage === 'done') return `${practice}<button class="btn ghost" data-action="lesson-go" data-stage="read">Review the lesson</button>`;
  return '';
}

function renderLessonRead(lesson) {
  const lv = lessonView;
  const readEvents = E.markLesson(state, CONTENT, lesson.skill, 'read', null, now());
  if (readEvents.length) awardLearning(readEvents);
  save();
  const sections = lesson.sections
    .map(
      (sec, i) => `<section class="panel lesson-sec ${lv.section === sec.id ? 'target' : ''}" id="sec-${sec.id}">
        <header class="panel-head"><span class="sec-n">${pad(i + 1)}</span><span class="ph-title">${esc(sec.heading)}</span></header>
        <div class="panel-body">
          ${sec.body.map((b) => `<p>${rich(b)}</p>`).join('')}
          ${sec.points ? `<ul class="points">${sec.points.map((pt) => `<li>${rich(pt)}</li>`).join('')}</ul>` : ''}
          ${sec.evidence ? snippetHtml(sec.evidence.text, sec.evidence.label) : ''}
        </div>
      </section>`,
    )
    .join('');
  render(`
    ${lessonHeader(lesson, 'read')}
    ${lv.note && lv.gate ? noteBanner(lv.note) : ''}
    ${panel({ title: esc(lesson.title), icon: 'book', hud: true, cls: 'lesson-goal', meta: `${lesson.sections.length} parts`, body: `<p class="lead-sm"><span class="label">Goal</span>${esc(lesson.goal)}</p>` })}
    ${sections}
    ${lessonFooter(lesson, 'read')}
  `);
  if (lv.section) {
    const el = document.getElementById(`sec-${lv.section}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
    lv.section = null;
  }
}

function renderWorked(lesson) {
  const lv = lessonView;
  const w = lesson.worked[lv.i];
  const all = lv.step >= w.steps.length;
  if (all) {
    const evts = E.markLesson(state, CONTENT, lesson.skill, 'worked', w.id, now());
    if (evts.length) awardLearning(evts);
  }
  const more = lv.i + 1 < lesson.worked.length;
  render(`
    ${lessonHeader(lesson, 'worked')}
    <article class="panel hud worked">
      <header class="panel-head">${icon('terminal')}<span class="ph-title">Worked example</span><span class="ph-meta">${esc(w.title)}</span></header>
      <div class="panel-body">
        ${snippetHtml(w.artifact, w.artifactLabel)}
        <p class="prompt">${rich(w.question)}</p>
        <div class="label">Analyst reasoning</div>
        <ol class="steps">${w.steps
          .slice(0, lv.step)
          .map((st, i) => `<li class="step"><span class="step-n">Step ${pad(i + 1)}</span><span>${rich(st)}</span></li>`)
          .join('')}</ol>
        ${
          all
            ? `<div class="block ok-block"><div class="label">Verdict</div><div>${rich(w.conclusion)}</div></div>
               ${more ? `<button class="btn primary" data-action="lesson-next-worked">Next worked example${icon('next')}</button>` : `<button class="btn primary" data-action="lesson-go" data-stage="faded">Your turn: finish an example${icon('next')}</button>`}`
            : `<p class="small muted">Step ${lv.step} of ${w.steps.length}. Try to predict the next step before you reveal it.</p>
               <button class="btn primary" data-action="lesson-step">Reveal next step${icon('next')}</button>
               <button class="btn ghost" data-action="lesson-step-all">Show all steps</button>`
        }
      </div>
    </article>
    ${lv.snapshot ? lessonFooter(lesson, 'worked') : ''}
  `);
  if (lv.step > 1) document.querySelector('.steps li:last-child')?.scrollIntoView({ block: 'center' });
}

function renderFaded(lesson) {
  const lv = lessonView;
  const f = lesson.faded[lv.i];
  lv.todo ??= 0;
  lv.results ??= [];
  const t = f.todo[lv.todo];
  const done = lv.todo >= f.todo.length;
  if (t && t.type === 'mc' && !lv.order) lv.order = shuffle(t.choices);

  const given = f.given.map((g, i) => `<li class="step given"><span class="step-n">${icon('check')}Step ${pad(i + 1)}</span><span>${rich(g)}</span></li>`).join('');
  const past = lv.results
    .map(
      (r, k) => `<li class="step ${r.correct ? 'you-ok' : 'you-bad'}"><span class="step-n">${icon(r.correct ? 'check' : 'x')}Step ${pad(f.given.length + k + 1)} · you</span>
        <span>${rich(f.todo[k].prompt)}<br><b>${esc(r.answerText)}</b></span></li>`,
    )
    .join('');

  let currentHtml = '';
  if (!done) {
    const n = f.given.length + lv.todo + 1;
    let input;
    if (t.type === 'text') {
      input = `<input id="faded-text" class="text-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type your answer" ${lv.answered ? 'disabled' : ''} value="${esc(lv.response || '')}" />
        ${lv.answered ? '' : `<button class="btn primary" data-action="faded-check">${icon('check')}Check</button>`}`;
    } else {
      input = `<div class="choices" role="radiogroup">${lv.order
        .map((c, i) => {
          let cls = '';
          if (lv.answered) {
            if (c === t.answer) cls = 'correct';
            else if (c === lv.response) cls = 'wrong';
          }
          return `<button class="choice ${cls}" data-action="faded-choose" data-index="${i}" role="radio" aria-checked="${lv.response === c}" ${lv.answered ? 'disabled' : ''}>
            <span class="key">${lv.answered && c === t.answer ? icon('check') : lv.answered && c === lv.response ? icon('x') : String.fromCharCode(65 + i)}</span><span class="choice-text">${rich(c)}</span></button>`;
        })
        .join('')}</div>`;
    }
    currentHtml = `<div class="todo">
        <div class="step-n now">Step ${pad(n)} · your turn</div>
        <p class="prompt">${rich(t.prompt)}</p>
        ${input}
        ${
          lv.answered
            ? `<div class="block ${lv.correct ? 'ok-block' : 'bad-block'}"><div class="label">${lv.correct ? 'Correct' : `Not quite. Answer: ${esc(t.type === 'text' ? t.accept[0] : t.answer)}`}</div><div>${rich(t.explanation)}</div></div>
               <button class="btn primary" data-action="faded-next">${lv.todo + 1 < f.todo.length ? 'Next step' : 'Finish the example'}${icon('next')}</button>`
            : ''
        }
      </div>`;
  }

  render(`
    ${lessonHeader(lesson, 'faded')}
    <article class="panel hud faded">
      <header class="panel-head">${icon('target')}<span class="ph-title">Your turn</span><span class="ph-meta">${esc(f.title)}</span></header>
      <div class="panel-body">
        ${snippetHtml(f.artifact, f.artifactLabel)}
        <p class="prompt">${rich(f.question)}</p>
        <div class="label">Analysis so far</div>
        <ol class="steps">${given}${past}</ol>
        ${done ? `<div class="block ok-block"><div class="label">Example complete</div><div>You finished the analysis. ${lv.results.every((r) => r.correct) ? 'Every step right.' : 'Check the explanation for any step you missed.'} Next up: independent practice.</div></div>` : currentHtml}
      </div>
    </article>
    ${done ? lessonFooter(lesson, 'done') : lv.snapshot ? lessonFooter(lesson, 'faded') : ''}
  `);
  const input = document.getElementById('faded-text');
  if (input && !lv.answered) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fadedCheck();
    });
  }
  if (lv.answered || lv.todo > 0) document.querySelector(done ? '.faded .ok-block' : '.todo')?.scrollIntoView({ block: 'start' });
}

function fadedCheck(choiceIndex = null) {
  const lv = lessonView;
  const lesson = E.lessonFor(CONTENT, lv.skillId);
  const t = lesson.faded[lv.i].todo[lv.todo];
  if (lv.answered) return;
  let response;
  let ok;
  if (t.type === 'text') {
    response = document.getElementById('faded-text').value;
    if (!response.trim()) return;
    ok = t.accept.some((a) => E.normalizeText(a) === E.normalizeText(response));
  } else {
    response = lv.order[choiceIndex];
    ok = response === t.answer;
  }
  lv.answered = true;
  lv.response = response;
  lv.correct = ok;
  renderFaded(lesson);
}

function fadedNext() {
  const lv = lessonView;
  const lesson = E.lessonFor(CONTENT, lv.skillId);
  const f = lesson.faded[lv.i];
  lv.results.push({ correct: lv.correct, answerText: lv.response });
  lv.todo += 1;
  lv.answered = false;
  lv.response = null;
  lv.order = null;
  if (lv.todo >= f.todo.length) {
    const evts = E.markLesson(state, CONTENT, lesson.skill, 'faded', f.id, now());
    if (evts.length) awardLearning(evts);
  }
  renderFaded(lesson);
}

function lessonExit() {
  const lv = lessonView;
  lessonView = null;
  if (lv?.snapshot) {
    app.innerHTML = lv.snapshot.html;
    refreshStatusXp();
    const input = document.getElementById('answer-text');
    if (input && lv.snapshot.value != null) input.value = lv.snapshot.value;
    bindAnswerInput();
    window.scrollTo(0, lv.snapshot.y);
    return;
  }
  if (lv?.returnTo === 'report') return renderReport();
  renderHome();
}

function snippetHtml(text, label = 'Evidence') {
  const lines = String(text).split('\n');
  return `<div class="evidence">
      <div class="evidence-head"><span>${icon('terminal')}${esc(label)}</span><span>${lines.length} line${lines.length === 1 ? '' : 's'}</span></div>
      <pre class="snippet">${lines.map((l) => `<span class="ln">${esc(l) || ' '}</span>`).join('')}</pre>
    </div>`;
}

function renderQuestion() {
  const { item, mode, note } = current;
  const ss = state.skills[item.skill];
  const isPlacement = mode === 'placement';
  const pl = state.placement;
  const [modeLabel, modeSev] = MODE[mode] || [mode, 'info'];
  const hasLesson = !isPlacement && !!E.lessonFor(CONTENT, item.skill);

  const noteHtml = note ? noteBanner(note) : '';
  const diff = `<span class="diff" aria-label="Difficulty ${item.difficulty} of 3">${'<i class="on"></i>'.repeat(item.difficulty)}${'<i></i>'.repeat(3 - item.difficulty)}</span>`;
  const header = `${statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Back to dashboard">${icon('x')}</button>
      <div class="qbar-mid">
        ${chip([modeLabel, modeSev], 'mode')}
        <span class="skill-label">${current.recognized ? esc(skillName(item.skill)) : 'Area hidden'}</span>
      </div>
      ${hasLesson && current.recognized ? `<button class="icon-btn lesson-btn" data-action="open-lesson" data-skill="${item.skill}" data-from="question" aria-label="Review lesson" title="Review lesson">${icon('book')}</button>` : ''}
      ${
        isPlacement
          ? `<div class="qread"><b class="readout">${pad(pl.index + 1)}<small>/${pad(pl.queue.length)}</small></b><span class="label">Placement</span></div>`
          : `<div class="qread"><b class="readout" id="q-mastery">${current.recognized ? pct(ss.p) : '--'}<small>%</small></b><span class="label">Mastery</span></div>`
      }
    </header>`;

  // Mixed practice step 1: recognise which knowledge area the evidence involves.
  if (!current.recognized) {
    render(`
      ${header}
      <article class="panel hud question recognize" data-item-id="${item.id}" data-mode="${mode}">
        <header class="panel-head"><span class="ph-title">Triage · step 1 of 2</span><span class="ph-meta">Identify the area</span></header>
        <div class="panel-body">
          ${snippetHtml(item.snippet)}
          <p class="prompt">Which area does this evidence involve?</p>
          <p class="hint">Recognising the domain tells you which knowledge to reach for.</p>
          <div class="choices">${current.areaChoices
            .map(
              (sid, i) => `<button class="choice" data-action="recognize" data-skill="${sid}"><span class="key">${String.fromCharCode(65 + i)}</span><span class="choice-text">${esc(skillName(sid))}<span class="choice-sub">${esc(idx.skillById.get(sid)?.track === 'host' ? 'Host' : 'Network')}</span></span></button>`,
            )
            .join('')}</div>
        </div>
      </article>`);
    return;
  }

  let answers = '';
  if (item.type === 'text') {
    answers = `<label class="field-label" for="answer-text">Your answer</label>
      <input id="answer-text" class="text-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type your answer" />`;
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

  const submit = isPlacement
    ? `<button id="submit-btn" class="btn primary" data-action="submit" disabled>${icon('check')}Submit answer</button>`
    : `<div class="conf" id="submit-btn" role="group" aria-labelledby="conf-label">
        <div class="label" id="conf-label">How sure are you? Tap to submit</div>
        <div class="conf-row">${['guess', 'unsure', 'sure']
          .map((c) => `<button class="conf-btn c-${c}" data-action="submit" data-conf="${c}" disabled><b>${CONF[c][0]}</b><span>${CONF[c][1]}</span></button>`)
          .join('')}</div>
      </div>`;

  const rec = current.recogResult;
  const recHtml = rec
    ? `<div class="alert ${rec.ok ? 'ok' : 'warn'}" role="status"><div class="alert-tag">${icon(rec.ok ? 'check' : 'alert')}<span>Triage // ${rec.ok ? 'Area identified' : 'Area missed'}</span></div>
        <div class="alert-msg">${rec.ok ? `Right: this is ${esc(skillName(item.skill))}.` : `You picked ${esc(skillName(rec.picked))}. This evidence is about ${esc(skillName(item.skill))}.`}</div></div>`
    : '';

  render(`
    ${header}
    ${recHtml}
    ${noteHtml}
    <article class="panel hud question" data-item-id="${item.id}" data-skill="${item.skill}" data-mode="${mode}">
      <header class="panel-head"><span class="ph-title">Item ${esc(item.id.toUpperCase())}</span><span class="ph-meta">${TYPE_LABEL[item.type]} ${diff}</span></header>
      <div class="panel-body">
        <p class="prompt">${rich(item.prompt)}</p>
        ${item.snippet ? snippetHtml(item.snippet) : ''}
        ${answers}
        ${submit}
        ${isPlacement ? `<button class="btn ghost" data-action="end-placement">Skip the rest of placement</button>` : ''}
      </div>
    </article>
    <div id="feedback"></div>
  `);
  bindAnswerInput();
}

function setSubmitEnabled(on) {
  app.querySelectorAll('[data-action="submit"]').forEach((b) => {
    b.disabled = !on;
  });
}

function bindAnswerInput() {
  const input = document.getElementById('answer-text');
  if (!input || input.disabled) return;
  input.addEventListener('input', () => setSubmitEnabled(input.value.trim().length > 0));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    e.preventDefault();
    if (current?.mode === 'placement') submitAnswer(null);
    else app.querySelector('.conf-btn')?.focus();
  });
}

function recognize(skillId) {
  if (!current || current.recognized) return;
  const ok = skillId === current.item.skill;
  E.recordRecognition(state, ok);
  save();
  current.recognized = true;
  current.recogResult = { ok, picked: skillId };
  renderQuestion();
  window.scrollTo(0, 0);
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
  setSubmitEnabled(current.selected.size > 0);
}

function submitAnswer(confidence) {
  if (!current || current.answered) return;
  const { item } = current;
  const isPlacement = current.mode === 'placement';
  if (!isPlacement && !CONF[confidence]) return; // confidence is required outside placement
  let response;
  if (item.type === 'text') {
    const input = document.getElementById('answer-text');
    response = input.value;
    if (!response.trim()) {
      input.focus();
      return;
    }
  } else if (item.type === 'mc') {
    if (!current.selected.size) return;
    response = current.order[[...current.selected][0]];
  } else {
    if (!current.selected.size) return;
    response = [...current.selected].map((i) => current.order[i]);
  }
  const t = now();
  const conf = isPlacement ? undefined : confidence;
  const correct = E.checkAnswer(item, response);
  const misconceptions = correct ? [] : E.misconceptionsForResponse(item, response);
  const wasMastered = E.isMastered(state, CONTENT, item.skill);
  const result = E.recordAnswer(state, CONTENT, item.id, correct, {
    mode: current.mode,
    session: session.type,
    confidence: conf,
    misconceptions,
    now: t,
  });
  const gain = G.onAnswer(state.game, state, CONTENT, {
    item,
    correct,
    mode: current.mode === 'placement' ? 'placement' : session.type === 'daily' ? 'daily' : current.mode,
    events: result.events,
    wasMastered,
    dueAfter: session.type === 'daily' ? E.dailyDue(state, CONTENT, t).length : G.dueCount(state),
    confidence: conf,
    now: t,
  });
  current.answered = true;
  current.confidence = conf;
  current.response = response;
  current.result = result;
  current.gain = gain;
  save();
  renderFeedback();
  refreshStatusXp();
  xpToast(gain.xp);
  queueAchievements(gain);
}

function lessonLink(ref, label) {
  if (!ref) return '';
  const [skillId, section] = ref.split('#');
  const lesson = E.lessonFor(CONTENT, skillId);
  if (!lesson) return '';
  const sec = lesson.sections.find((s) => s.id === section);
  return `<button class="link-btn" data-action="open-lesson" data-skill="${skillId}" data-section="${section || ''}" data-from="question">${icon('book')}${esc(label || `Review lesson: ${sec ? sec.heading : lesson.title}`)}</button>`;
}

function renderFeedback() {
  const { item, result, mode, confidence } = current;
  const correct = result.correct;

  // Mark the answer area.
  if (item.type === 'text') {
    const input = document.getElementById('answer-text');
    input.disabled = true;
    input.setAttribute('value', current.response);
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

  // Targeted misconception fixes.
  const followUpSoon = mode !== 'placement';
  const fixes = (result.misconceptions || [])
    .map((id) => idx.misById.get(id))
    .filter(Boolean)
    .map(
      (m) => `<div class="block fix-block">
        <div class="label">${icon('target')}Common mix-up: ${esc(m.name)}</div>
        <p class="small">${rich(m.description)}</p>
        <p><b>Fix:</b> ${rich(m.fix)}</p>
        ${lessonLink(m.lesson)}
        ${followUpSoon ? '<p class="small muted fix-next">A follow-up question on this idea is coming up in the next few items.</p>' : ''}
      </div>`,
    )
    .join('');

  // Confidence and calibration.
  let confHtml = '';
  if (confidence) {
    const [label] = CONF[confidence];
    let msg;
    if (correct && confidence === 'guess') msg = 'Right, but a guess earns only partial mastery credit. It will come back soon to check it sticks.';
    else if (correct && confidence === 'unsure') msg = 'Right. Unsure answers earn most of the credit; being sure next time earns it all.';
    else if (correct) msg = 'Right and sure: full mastery credit.';
    else if (confidence === 'sure') msg = 'Wrong while sure usually means a misconception rather than a slip. It is flagged and scheduled again soon.';
    else if (confidence === 'guess') msg = 'An honest guess. Knowing what you don\'t know is a real analyst skill.';
    else msg = 'Wrong while unsure. Review the analysis below.';
    const c = state.calibration?.sure || { n: 0, correct: 0 };
    const calib = c.n ? `<span class="mono">Sure accuracy ${Math.round((c.correct / c.n) * 100)}% (${c.n})</span>` : '';
    confHtml = `<div class="conf-note c-${confidence} ${!correct && confidence === 'sure' ? 'flag' : ''}"><div class="label row"><span>You said: ${label}</span>${calib}</div><p class="small">${msg}</p></div>`;
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
  const lessonEvt = (e) => {
    if (!['gap-found', 'probe-start'].includes(e.type) || !e.skillId) return '';
    const l = E.lessonFor(CONTENT, e.skillId);
    return l ? `<br>${lessonLink(`${e.skillId}#${l.sections[0].id}`, `Open lesson: ${skillName(e.skillId)}`)}` : '';
  };
  const events = result.events.length
    ? `<div class="label">Event log</div><ul class="evlog">${result.events
        .map((e) => {
          const [tag, sev] = EVENT[e.type] || ['Info', 'info'];
          return `<li class="${e.type}"><span class="tag ${sev}">${tag}</span><span>${esc(plainText(e.text))}${lessonEvt(e)}</span></li>`;
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
  const sectionRef = !correct && !fixes && E.lessonFor(CONTENT, item.skill) ? lessonLink(`${item.skill}#${E.lessonFor(CONTENT, item.skill).sections[0].id}`, 'Review the lesson for this skill') : '';
  document.getElementById('feedback').innerHTML = `
    <section class="panel feedback ${correct ? 'fb-ok' : 'fb-bad'}" id="feedback-card">
      <header class="panel-head">${icon(correct ? 'check' : 'x')}<span class="ph-title">${correct ? 'Correct' : 'Incorrect'}</span><span class="ph-meta">Result</span></header>
      <div class="panel-body">
        ${confHtml}
        ${fixes}
        ${answerHtml}
        <div class="label">Analysis</div>
        <p class="explanation">${rich(item.explanation)}</p>
        ${isPlacement ? '' : sectionRef}
        ${delta}
        ${xpHtml}
        ${events}
        ${gameLog}
        <button id="next-btn" class="btn primary" data-action="next">${lastPlacement ? 'See placement results' : 'Next question'}${icon('next')}</button>
        <button class="btn ghost" data-action="home">Back to dashboard</button>
      </div>
    </section>`;
  document.getElementById('feedback-card').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
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

  const cal = r.calibration;
  const calRow = (c) => {
    const k = cal[c];
    return `<li class="cal-row c-${c}"><span class="cal-label">${CONF[c][0]}</span>
      <div class="bar cal-bar"><span style="width:${k.n ? Math.round(k.accuracy * 100) : 0}%"></span></div>
      <span class="mono">${k.n ? `${Math.round(k.accuracy * 100)}%` : '--'}</span><span class="mono muted cal-n">n=${k.n}</span></li>`;
  };
  const sure = cal.sure;
  let calVerdict;
  if (sure.n < 5) calVerdict = `Rate your confidence on every answer. After ${5 - sure.n} more "Sure" answer${5 - sure.n === 1 ? '' : 's'} the tutor can judge your calibration.`;
  else if (sure.accuracy >= 0.9) calVerdict = 'Well calibrated: when you say Sure, you are almost always right. Trust that instinct on shift.';
  else if (sure.accuracy >= 0.8) calVerdict = 'Mostly calibrated. A few Sure answers were wrong; those are listed below as confident errors.';
  else calVerdict = 'Overconfident: too many Sure answers were wrong. Slow down and check the evidence before committing, the way you would before escalating.';
  const calibrationPanel = panel({
    title: 'Confidence calibration',
    icon: 'gauge',
    meta: `${cal.guess.n + cal.unsure.n + cal.sure.n} rated`,
    cls: 'calibration',
    body: `<p class="muted small">How often your answers were right at each confidence level. Good calibration: Sure answers are right 80%+ of the time.</p>
      <ul class="cal-list">${['sure', 'unsure', 'guess'].map(calRow).join('')}</ul>
      <p class="small cal-verdict ${sure.n >= 5 && sure.accuracy < 0.8 ? 'warn-text' : ''}">${esc(calVerdict)}</p>
      ${
        r.confidentErrors.length
          ? `<div class="label spaced">Confident errors (answered Sure, was wrong)</div>${list(
              r.confidentErrors,
              (m) => `<li><div class="row sub"><span class="mono">${esc(m.id.toUpperCase())} · ${esc(m.skillName)}</span><span class="mono crit-text">${m.count}×</span></div>
                <div class="q-excerpt">${rich(m.prompt)}</div>${m.inReview ? '<div class="row sub"><span class="warn-text">Scheduled for review</span></div>' : ''}</li>`,
              '',
            )}`
          : ''
      }
      ${r.recognition.asked ? `<div class="label spaced">Mixed practice triage</div><p class="small">You identified the right area for <b class="mono">${r.recognition.recognized}/${r.recognition.asked}</b> evidence snippets.</p>` : ''}`,
  });

  const mis = r.misconceptions;
  const misPanel = panel({
    title: 'Misconceptions',
    icon: 'target',
    meta: mis.active.length ? `${mis.active.length} active` : mis.resolved.length ? `${mis.resolved.length} busted` : 'None',
    cls: mis.active.length ? 'crit-panel' : '',
    body: `<p class="muted small">Specific wrong ideas your answers revealed. Each one is re-tested with a different question until you get it right.</p>
      ${list(
        mis.active,
        (m) => `<li class="mis-row">
          <div class="row"><span class="name">${esc(m.name)}</span>${chip([m.sure ? 'Confident' : 'Active', m.sure ? 'crit' : 'warn'])}</div>
          <div class="row sub"><span>${esc(skillName(m.skillId))}</span><span class="mono">seen ${m.hits}×${m.relapses ? ` · relapsed ${m.relapses}×` : ''}</span></div>
          <p class="small mis-fix">${rich(m.fix)}</p>
          ${m.lesson ? lessonLink(m.lesson).replace('data-from="question"', 'data-from="report"') : ''}
        </li>`,
        'No active misconceptions. When a wrong answer matches a common mix-up, it shows up here with a targeted fix.',
      )}
      ${mis.resolved.length ? `<div class="label spaced">Busted</div><div class="pill-list">${mis.resolved.map((m) => chip([m.name, 'ok'], 'pill')).join('')}</div>` : ''}`,
  });

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
          <div class="stat ${sure.n ? '' : ''}"><b class="mono">${sure.n ? `${Math.round(sure.accuracy * 100)}%` : '--'}</b><span>Sure right</span></div>
          <div class="stat ${r.rootGaps.length ? 'crit' : ''}"><b class="mono">${pad(r.rootGaps.length)}</b><span>Root gaps</span></div>
        </div>`,
    })}
    ${rec}
    ${misPanel}
    ${calibrationPanel}
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
    case 'daily':
      return startSession({ type: 'daily' });
    case 'mixed':
      return startSession({ type: 'mixed' });
    case 'open-lesson': {
      const from = el.dataset.from;
      const fromQuestion = from === 'question' && !!current && !!document.querySelector('.question');
      return openLesson(el.dataset.skill, { section: el.dataset.section || null, fromQuestion, returnTo: from === 'report' ? 'report' : null });
    }
    case 'lesson-go':
      if (!lessonView) return undefined;
      Object.assign(lessonView, { stage: el.dataset.stage, i: 0, step: 1, todo: 0, results: [], answered: false, response: null, order: null });
      renderLessonView();
      return window.scrollTo(0, 0);
    case 'lesson-step':
      lessonView.step += 1;
      return renderLessonView();
    case 'lesson-step-all':
      lessonView.step = 99;
      return renderLessonView();
    case 'lesson-next-worked':
      Object.assign(lessonView, { i: lessonView.i + 1, step: 1 });
      renderLessonView();
      return window.scrollTo(0, 0);
    case 'faded-choose':
      return fadedCheck(Number(el.dataset.index));
    case 'faded-check':
      return fadedCheck();
    case 'faded-next':
      return fadedNext();
    case 'lesson-exit':
      return lessonExit();
    case 'lesson-accept': {
      E.markLesson(state, CONTENT, lessonView.skillId, 'offered', null, now());
      save();
      lessonView.stage = 'read';
      renderLessonView();
      return window.scrollTo(0, 0);
    }
    case 'lesson-decline':
      E.markLesson(state, CONTENT, lessonView.skillId, 'offered', null, now());
      save();
      lessonView = null;
      return showNext();
    case 'lesson-skip':
      awardLearning(E.markLesson(state, CONTENT, lessonView.skillId, 'skip', null, now()));
      lessonView = null;
      return session ? showNext() : renderHome();
    case 'lesson-finish':
      lessonView = null;
      if (!session) session = { type: 'auto' };
      return showNext();
    case 'recognize':
      return recognize(el.dataset.skill);
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
      return submitAnswer(el.dataset.conf);
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

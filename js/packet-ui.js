// Packet lab screens: list, protocol tree, display filter, follow stream, short-answer grading.
import { CONTENT } from '../content/index.js';
import * as G from './game.js';
import * as L from './lab/lab.js';
import * as P from './lab/packets.js';
import { icon } from './icons.js';

let ctx = null;
export function initPacketUi(c) { ctx = c; }

const st = () => ctx.getState();
const lab = () => L.ensureLab(st());
const esc = (s) => ctx.esc(s);
const cases = () => CONTENT.lab?.packetCases || [];
const byId = (id) => cases().find((c) => c.id === id);
const DIFF = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const LEVEL = { 1: 'Level 1 · Foundations', 2: 'Level 2 · SOC operations', 3: 'Level 3 · Advanced' };

let view = null; // { screen, id, filter, open, stream, err }

function frames(c) {
  return c.packets.map(P.present);
}

function qbar(label, sub, back, backLabel) {
  return `<header class="qbar">
      <button class="icon-btn" data-action="${back}" aria-label="${esc(backLabel)}">${icon('back')}</button>
      <div class="qbar-mid">${ctx.chip([label, 'info'], 'mode')}<span class="skill-label">${esc(sub)}</span></div>
    </header>`;
}

export function renderPacketList() {
  view = { screen: 'list' };
  const groups = [1, 2, 3].map((lv) => {
    const list = cases().filter((c) => c.level === lv);
    if (!list.length) return '';
    return `<div class="track-head">${icon(lv === 1 ? 'network' : lv === 2 ? 'radar' : 'layers')}<h3>${LEVEL[lv]}</h3><span class="count">${list.filter((c) => lab().packets[c.id]?.solved).length}/${list.length} solved</span></div>
      <ul class="case-list">${list.map(card).join('')}</ul>`;
  }).join('');
  ctx.setScreen('lab-packets');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('PACKET LAB', 'Cases', 'home', 'Back to dashboard')}
    ${ctx.panel({ title: 'How it works', icon: 'network', hud: true, body: `<ol class="howto small">
        <li><b>Filter</b> the list like a small Wireshark: <code>tcp</code>, <code>dns</code>, <code>ip.addr == 10.0.0.1</code>, <code>frame contains "password"</code>.</li>
        <li>Tap a row for the <b>protocol tree</b>. <b>Follow stream</b> stitches one conversation.</li>
        <li>Answer the questions at the bottom. Synonyms count. You're graded on the answers, not on a magic filter.</li>
      </ol>` })}
    ${ctx.panel({ title: 'Captures', icon: 'list', meta: `${L.labStats(st()).packetsSolved}/${cases().length}`, body: groups })}
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

function card(c) {
  const rec = lab().packets[c.id];
  const status = rec?.solved ? ['Solved', 'ok'] : rec?.attempts ? ['In progress', 'info'] : ['New', 'ready'];
  return `<li class="case-card ${rec?.solved ? 'solved' : ''}">
      <div class="case-top"><span class="mono case-id">${esc(c.id.replace(/^pkt-/, 'PKT-').toUpperCase())}</span><span class="case-diff mono">${DIFF[c.difficulty]}</span>${ctx.chip(status)}</div>
      <div class="case-title">${esc(c.title)}</div>
      <p class="small muted">${esc(c.brief)}</p>
      <div class="case-req small"><span class="req-skill">${esc(ctx.skillName(c.skill))}</span><span class="req-skill mono">${c.packets.length} frames</span><span class="req-skill mono">${L.LAB_XP.packet[c.difficulty]} XP</span></div>
      <button class="btn ${rec?.solved ? 'secondary' : 'primary'}" data-action="pkt-open" data-id="${c.id}">${icon('network')}${rec?.solved ? 'Replay' : 'Open'}</button>
    </li>`;
}

const CHIPS = ['tcp', 'udp', 'dns', 'http', 'tls', 'icmp', 'tcp.flags.syn == 1', 'tcp.flags.rst == 1', 'ip.addr == ', 'frame contains ""'];

export function renderPacketCase(id) {
  const c = byId(id);
  if (!c) return renderPacketList();
  const rec = lab().packets[c.id] || {};
  view = { screen: 'case', id, filter: view?.id === id ? view.filter || '' : rec.filter || '', open: view?.id === id ? view.open : null, stream: view?.id === id ? view.stream : null, err: null, grade: view?.id === id ? view.grade : null };
  const pk = frames(c);
  let shown = pk;
  let err = '';
  try { shown = P.applyFilter(pk, view.filter); }
  catch (e) { err = e.message; shown = []; }
  ctx.setScreen('lab-packet');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('PACKET LAB', c.title, 'pkt-list', 'Back to captures')}
    <section class="alert-card sev-medium mission" aria-label="Capture">
      <div class="ac-head">${icon('network')}<span class="mono">${esc(c.id.toUpperCase())}</span>${ctx.chip(rec.solved ? ['Solved', 'ok'] : ['Open', 'info'])}<span class="ac-time mono">${pk.length} frames</span></div>
      <div class="ac-name">${esc(c.title)}</div>
      <p class="ac-detail small">${esc(c.brief)}</p>
    </section>
    ${ctx.panel({ title: 'Display filter', icon: 'search', hud: true, body: filterHtml(shown.length, pk.length, err) })}
    ${ctx.panel({ title: 'Frames', icon: 'list', meta: `${shown.length}/${pk.length}`, body: `<ol class="pkt-list" id="pkt-list">${shown.map((p) => rowHtml(p)).join('') || '<li class="empty small">No frames match that filter.</li>'}</ol>` })}
    <div id="pkt-detail">${detailHtml(c, pk)}</div>
    ${ctx.panel({ title: 'Questions', icon: 'flag', body: tasksHtml(c, rec) })}
    <div id="pkt-grade">${gradeHtml()}</div>
    ${rec.solved ? ctx.panel({ title: 'Debrief', icon: 'award', cls: 'debrief', body: `<p>${esc(c.explain)}</p>` }) : ''}
    <button class="btn secondary" data-action="pkt-list">${icon('back')}All captures</button>
  `);
}

function filterHtml(n, total, err) {
  return `<label class="sr-only" for="pkt-filter">Display filter</label>
    <input id="pkt-filter" class="qe-text pkt-filter" value="${esc(view.filter)}" placeholder="tcp && ip.addr == 10.0.0.1" spellcheck="false" autocapitalize="off" autocomplete="off" enterkeyhint="search">
    <div class="qe-chips">${CHIPS.map((t) => `<button type="button" class="qchip ops" data-action="pkt-chip" data-ins="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <p class="small ${err ? 'crit-text' : 'muted'}">${err ? esc(err) : `${n} of ${total} frames`}</p>`;
}

function rowHtml(p) {
  const on = view.open === p.id ? 'on' : '';
  return `<li><button type="button" class="pkt-row ${on}" data-action="pkt-frame" data-id="${esc(p.id)}">
      <span class="mono pkt-no">${p.no}</span>
      <span class="mono pkt-time">${Number(p.time).toFixed(3)}</span>
      <span class="pkt-info">${esc(p.info)}</span>
      <span class="mono pkt-len">${p.len}</span>
    </button></li>`;
}

function detailHtml(c, pk) {
  const p = pk.find((x) => x.id === view.open);
  if (!p) return '';
  const tree = p.layers.map((layer) => `<li class="pkt-layer"><b>${esc(layer.name)}</b><dl>${layer.fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}</dl></li>`).join('');
  const follow = p.stream ? `<button class="btn mini" data-action="pkt-follow" data-stream="${esc(p.stream)}">${icon('list')}Follow stream</button>` : '';
  let stream = '';
  if (view.stream && p.stream === view.stream) {
    const rows = P.followStream(pk, view.stream);
    stream = `<div class="pkt-stream"><div class="label">Stream ${esc(view.stream)}</div>${rows.map((r) => `<pre class="mono"><span class="muted">${esc(r.src)}:${esc(r.sport)} → ${esc(r.dst)}:${esc(r.dport)}</span>\n${esc(r.text)}</pre>`).join('')}</div>`;
  }
  return ctx.panel({ title: `Frame ${p.no}`, icon: 'layers', meta: p.protos.join(' · '), body: `<ul class="pkt-tree">${tree}</ul><div class="qe-actions">${follow}</div>${stream}` });
}

function tasksHtml(c, rec) {
  const draft = rec.draft || {};
  return `<ol class="pkt-tasks">${c.tasks.map((t, i) => `<li><label for="pkt-a-${t.id}"><b>${i + 1}.</b> ${esc(t.prompt)}</label><input id="pkt-a-${t.id}" data-task="${t.id}" class="pkt-ans" value="${esc(draft[t.id] || '')}" autocomplete="off" autocapitalize="off"></li>`).join('')}</ol>
    <button class="btn primary" data-action="pkt-grade">${icon('check')}Check answers</button>`;
}

function gradeHtml() {
  const g = view.grade;
  if (!g) return '';
  if (g.ok) return `<div class="alert ok-alert" role="status"><div class="alert-tag">${icon('check')}<span>${g.passed ? 'Capture solved' : 'Part marks'}</span></div><div class="alert-msg">${g.score}%${g.xp ? ` <b class="ok-text">+${g.xp} XP</b>` : ''}. ${g.rows.filter((r) => r.ok).length}/${g.rows.length} right.</div></div>`;
  return `<div class="alert warn" role="status"><div class="alert-tag">${icon('alert')}<span>${g.score}%</span></div><div class="alert-msg">${g.rows.filter((r) => !r.ok).length} still off. Filters are a tool; the questions are the grade.</div></div>`;
}

function check() {
  const c = byId(view.id);
  const answers = {};
  for (const t of c.tasks) answers[t.id] = document.getElementById(`pkt-a-${t.id}`)?.value || '';
  const rec = (lab().packets[c.id] ??= { solved: false, best: 0, xpPaid: 0, attempts: 0 });
  rec.draft = answers;
  rec.filter = view.filter;
  const result = P.scorePacketCase(c, answers);
  const paid = L.recordScored(st(), 'packet', c, { score: result.score, passed: result.passed, perfect: result.score === 100, now: ctx.now() });
  const g = G.onLab(st().game, st(), CONTENT, { xp: paid.xp, breakdown: paid.breakdown, reason: c.id, now: ctx.now() });
  view.grade = { ...result, ok: result.passed, xp: g.xp };
  ctx.save();
  ctx.xpToast(g.xp);
  ctx.queueAchievements(g);
  ctx.refreshStatusXp();
  renderPacketCase(c.id);
  document.getElementById('pkt-grade')?.scrollIntoView({ block: 'start' });
}

export function handleClick(action, el) {
  switch (action) {
    case 'pkt-list':
      renderPacketList();
      return true;
    case 'pkt-open':
      view = { screen: 'case', id: el.dataset.id };
      renderPacketCase(el.dataset.id);
      return true;
    case 'pkt-frame':
      view.open = view.open === el.dataset.id ? null : el.dataset.id;
      if (view.open) {
        const c = byId(view.id);
        const p = frames(c).find((x) => x.id === view.open);
        if (!p || p.stream !== view.stream) view.stream = null;
      }
      renderPacketCase(view.id);
      return true;
    case 'pkt-follow':
      view.stream = view.stream === el.dataset.stream ? null : el.dataset.stream;
      renderPacketCase(view.id);
      return true;
    case 'pkt-chip': {
      const input = document.getElementById('pkt-filter');
      const ins = el.dataset.ins;
      if (input) {
        const cur = input.value.trim();
        input.value = !cur ? ins : `${cur} && ${ins}`;
        view.filter = input.value;
      }
      return true;
    }
    case 'pkt-grade':
      check();
      return true;
    default:
      return false;
  }
}

export function handleInput(e) {
  const t = e.target;
  if (t?.id === 'pkt-filter' && view?.screen === 'case') {
    view.filter = t.value;
    if (e.type === 'change' || e.type === 'input') {
      const rec = (lab().packets[view.id] ??= { solved: false, best: 0, xpPaid: 0, attempts: 0 });
      rec.filter = t.value;
      if (e.type === 'change') ctx.save();
      // live filter without wiping answers: re-render list only when the value is valid or empty
      const list = document.getElementById('pkt-list');
      if (!list) return true;
      const c = byId(view.id);
      const pk = frames(c);
      try {
        const shown = P.applyFilter(pk, t.value);
        list.innerHTML = shown.map(rowHtml).join('') || '<li class="empty small">No frames match that filter.</li>';
        const note = t.parentElement?.querySelector('p.small');
        if (note) { note.className = 'small muted'; note.textContent = `${shown.length} of ${pk.length} frames`; }
      } catch (err) {
        const note = t.parentElement?.querySelector('p.small');
        if (note) { note.className = 'small crit-text'; note.textContent = err.message; }
      }
    }
    return true;
  }
  if (t?.classList?.contains('pkt-ans') && view?.screen === 'case') {
    const rec = (lab().packets[view.id] ??= { solved: false, best: 0, xpPaid: 0, attempts: 0 });
    rec.draft = { ...(rec.draft || {}), [t.dataset.task]: t.value };
    if (e.type === 'change') ctx.save();
    return true;
  }
  return false;
}

// Hands-on labs UI: query sandbox + query challenges (SPL / KQL), packet lab, rule builder.
// Screens render into #app through the helpers app.js passes in (see initLab).
import { CONTENT } from '../content/index.js';
import * as G from './game.js';
import * as Q from './lab/query.js';
import * as L from './lab/lab.js';
import { getTables, getDataset, datasetList } from '../content/lab/datasets.js';
import { challengeAnswer } from '../content/lab/query-challenges.js';
import { icon } from './icons.js';
import * as PKT from './packet-ui.js';
import * as RULE from './rule-ui.js';

let ctx = null; // { getState, save, now, render, statusBar, panel, chip, esc, rich, pad, bar, xpToast, queueAchievements, refreshStatusXp, skillName, setScreen }
export function initLab(c) {
  ctx = c;
  PKT.initPacketUi(c);
  RULE.initRuleUi(c);
}

const st = () => ctx.getState();
const lab = () => L.ensureLab(st());
const esc = (s) => ctx.esc(s);
const fmt = (n) => Number(n).toLocaleString('en-US');
const DIFF = { 1: ['Easy', 'ok'], 2: ['Medium', 'warn'], 3: ['Hard', 'crit'] };
const LEVEL = { 1: 'Level 1 · Foundations', 2: 'Level 2 · SOC operations', 3: 'Level 3 · Advanced' };
const DIALECT = { spl: 'SPL', kql: 'KQL' };
const MAX_SHOW = 200;
const diffPips = (d) => `<span class="diff" title="${DIFF[d][0]}">${[1, 2, 3].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>`;

let view = null; // { screen, id?, out?: { res, err, ms, grade }, schema, tab }

function qbar(label, sub, back = 'home', backLabel = 'Back') {
  return `<header class="qbar">
      <button class="icon-btn" data-action="${back}" aria-label="${esc(backLabel)}">${icon('back')}</button>
      <div class="qbar-mid">${ctx.chip([label, 'info'], 'mode')}<span class="skill-label">${esc(sub)}</span></div>
    </header>`;
}

const challenges = () => CONTENT.lab?.queryChallenges || [];
const chById = (id) => challenges().find((c) => c.id === id);
const dialect = () => lab().prefs.dialect || 'spl';

// =================================================================== dashboard entries

/** "Hands-on labs" panel for the dashboard. */
export function labsPanel() {
  const s = L.labStats(st());
  const chs = challenges();
  const pips = chs.map((c) => `<i class="${lab().query[c.id]?.solved ? 'done' : 'on'}" title="${esc(c.title)}"></i>`).join('');
  const rows = [
    `<li class="op-row">
      <span class="op-ico">${icon('terminal')}</span>
      <span class="op-body"><b>Query lab</b><em>Hunt through thousands of log events with real SPL or KQL. ${s.queriesSolved}/${chs.length} challenges solved.</em>
        <span class="op-stages">${pips}<span>${s.queriesSolved}/${chs.length}</span></span></span>
      <button class="btn mini primary" data-action="lab-challenges">Open</button>
    </li>`,
    `<li class="op-row">
      <span class="op-ico">${icon('search')}</span>
      <span class="op-body"><b>Free search</b><em>Sandbox: 7 datasets (Windows, Sysmon, Linux, proxy, DNS, firewall, cloud). No score, just practice.</em></span>
      <button class="btn mini" data-action="lab-sandbox">Open</button>
    </li>`,
    `<li class="op-row">
      <span class="op-ico">${icon('network')}</span>
      <span class="op-body"><b>Packet lab</b><em>Dissect a short capture: list, protocol tree, follow stream, display filters. ${s.packetsSolved}/${(CONTENT.lab?.packetCases || []).length} cases solved.</em></span>
      <button class="btn mini" data-action="pkt-list">Open</button>
    </li>`,
    `<li class="op-row">
      <span class="op-ico">${icon('target')}</span>
      <span class="op-body"><b>Rule lab</b><em>Sigma-lite and YARA-lite, graded by replaying labelled samples (TP / FP / FN). ${s.rulesSolved}/${(CONTENT.lab?.ruleExercises || []).length} exercises solved.</em></span>
      <button class="btn mini" data-action="rule-list">Open</button>
    </li>`,
  ];
  return ctx.panel({ title: 'Hands-on labs', icon: 'terminal', meta: 'Real tools, fake data', cls: 'ops labs', body: `<ul class="op-list">${rows.join('')}</ul>` });
}

/** Small "Lab" button for skills that have a hands-on lab (skill map). */
const SKILL_LABS = {
  'l2-siem': 'lab-challenges', 'host-logs': 'lab-challenges', 'l2-hunting': 'lab-challenges', 'l3-cloud': 'lab-challenges',
  'net-tcp-udp': 'pkt-list', 'net-dns': 'pkt-list', 'net-http': 'pkt-list', 'net-fw-logs': 'pkt-list',
  'l2-malware': 'rule-list', 'l3-detection': 'rule-list', 'l2-ids': 'rule-list',
};
export function skillLabButton(skillId) {
  const action = SKILL_LABS[skillId];
  if (!action) return '';
  return `<button class="skill-lesson skill-lab" data-action="${action}" aria-label="Hands-on lab" title="Hands-on lab">${icon('terminal')}<span>Lab</span></button>`;
}

// =================================================================== query editor

const FIELD_TIME = { spl: '_time', kql: 'TimeGenerated' };
const CHIPS = {
  spl: {
    cmds: ['| where ', '| stats count by ', '| sort -count', '| head 10', '| table ', '| dedup ', '| eval ', '| top limit=10 ', '| rex "(?<name>…)"', '| bin _time span=1h', '| timechart span=1h count', '| streamstats current=f last(_time) as prev by ', '| rename  as ', 'earliest=-24h ', '| eventstats '],
    ops: ['=', '!=', '>', '<', '"…"', '*', 'AND ', 'OR ', 'NOT ', 'IN ( )', '( )', '|'],
    funcs: ['count', 'dc()', 'values()', 'sum()', 'avg()', 'stdev()', 'len()', 'if( , , )', 'like( , "%")', 'isnull()', 'strftime(_time, "%H")', 'lower()'],
  },
  kql: {
    cmds: ['| where ', '| summarize count() by ', '| order by  desc', '| take 10', '| project ', '| distinct ', '| extend ', '| top 10 by ', '| count', '| parse  with * "…" name', 'bin(TimeGenerated, 1h)', 'ago(1h)', '| project-away '],
    ops: ['==', '!=', '=~', '>', '<', 'contains ', 'has ', 'startswith ', 'endswith ', 'in ( )', 'has_any ( )', 'and ', 'or ', 'not( )', '"…"', '|'],
    funcs: ['count()', 'dcount()', 'countif()', 'make_set()', 'avg()', 'stdev()', 'strlen()', 'iff( , , )', 'isempty()', 'extract(@"…", 1, )', 'prev()', 'tolower()'],
  },
};

function starter(ds, d) {
  return d === 'kql' ? `${ds.kql}\n| take 20` : `index=${ds.spl}\n| head 20`;
}

function fieldsOf(dsId, d) {
  const ds = getDataset(dsId);
  if (!ds) return [];
  const view = Q.dialectView(ds, d);
  return [FIELD_TIME[d], ...view.fields];
}

function chipRow(dsId, d, tab) {
  const list = tab === 'fields' ? fieldsOf(dsId, d) : CHIPS[d][tab] || [];
  return list.map((t) => `<button type="button" class="qchip ${tab}" data-action="lab-insert" data-ins="${esc(t)}">${esc(t.trim() || t)}</button>`).join('');
}

function editorHtml({ d, dsId, text, picker = false, runLabel = 'Run', tab = 'cmds' }) {
  const ds = getDataset(dsId);
  const tabs = [['cmds', 'Commands'], ['fields', 'Fields'], ['ops', 'Operators'], ['funcs', 'Functions']];
  return `<div class="qe" id="lab-editor">
      <div class="qe-top">
        <div class="seg-toggle" role="radiogroup" aria-label="Query language">${['spl', 'kql']
          .map((x) => `<button type="button" role="radio" aria-checked="${x === d}" class="${x === d ? 'on' : ''}" data-action="lab-dialect" data-d="${x}">${DIALECT[x]}</button>`)
          .join('')}</div>
        ${
          picker
            ? `<label class="qe-ds"><span class="sr-only">Dataset</span><select id="lab-ds">${datasetList()
                .map((x) => `<option value="${x.id}" ${x.id === dsId ? 'selected' : ''}>${esc(x.title)}</option>`)
                .join('')}</select></label>`
            : `<span class="qe-src mono">${esc(d === 'kql' ? ds.kql : `index=${ds.spl}`)}</span>`
        }
      </div>
      <p class="qe-hint small muted">${d === 'kql' ? `Start with the table <code>${esc(ds.kql)}</code>, then pipe <code>|</code> operators.` : `Start with <code>index=${esc(ds.spl)}</code> and search terms, then pipe <code>|</code> commands.`} <span class="mono">${fmt(ds.events.length)}</span> events · last 24 h.</p>
      <textarea id="lab-q" class="qe-text" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Query">${esc(text)}</textarea>
      <div class="qe-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === tab}" class="${id === tab ? 'on' : ''}" data-action="lab-chiptab" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="qe-chips" id="lab-chips">${chipRow(dsId, d, tab)}</div>
      <div class="qe-actions">
        <button class="btn primary" data-action="lab-run">${icon('play')}${runLabel}</button>
        <button class="btn mini ghost" data-action="lab-schema" aria-expanded="${!!view?.schema}">${icon('list')}Fields</button>
        <button class="btn mini ghost" data-action="lab-reset-q">${icon('reset')}Reset</button>
      </div>
      <div id="lab-schema">${view?.schema ? schemaHtml(dsId, d) : ''}</div>
    </div>`;
}

function schemaHtml(dsId, d) {
  const ds = getDataset(dsId);
  const v = Q.dialectView(ds, d);
  const rev = {};
  for (const [canon, shown] of Object.entries(v.rename || {})) rev[shown] = canon;
  const sample = (f) => {
    const canon = rev[f] || f;
    const seen = new Map();
    for (const e of ds.events) {
      const val = e[canon];
      if (val === undefined || val === '' || val === null) continue;
      const k = String(val);
      seen.set(k, (seen.get(k) || 0) + 1);
      if (seen.size > 40) break;
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  };
  return `<div class="schema">
      <p class="small muted">${esc(ds.blurb)}</p>
      <ul class="schema-list">${[FIELD_TIME[d], ...v.fields]
        .map((f) => `<li><button type="button" class="qchip fields" data-action="lab-insert" data-ins="${esc(f)}">${esc(f)}</button><span class="mono small">${f === FIELD_TIME[d] ? 'event time (UTC)' : sample(f).map((x) => esc(x.length > 36 ? `${x.slice(0, 34)}…` : x)).join(' · ')}</span></li>`)
        .join('')}</ul>
      ${Object.keys(v.aliases).length ? `<p class="small muted">Also accepted: ${Object.keys(v.aliases).slice(0, 14).map((a) => `<code>${esc(a)}</code>`).join(' ')}</p>` : ''}
    </div>`;
}

function resultsHtml(out) {
  if (!out) return '<p class="empty small">Run a query to see results here.</p>';
  if (out.err) {
    return `<div class="alert crit q-err" role="alert"><div class="alert-tag">${icon('x')}<span>Query error</span></div><div class="alert-msg mono">${esc(out.err.message)}</div>${out.err.hint ? `<div class="alert-msg small">${esc(out.err.hint)}</div>` : ''}</div>`;
  }
  const { res, ms } = out;
  const warn = res.warnings.map((w) => `<li class="warn-text">${icon('alert')}${esc(w)}</li>`).join('') + res.notes.map((n) => `<li class="muted">${icon('clock')}${esc(n)}</li>`).join('');
  const cols = res.columns;
  const rows = res.rows.slice(0, MAX_SHOW);
  const table = rows.length
    ? `<div class="qr-wrap" tabindex="0" aria-label="Results table (scrolls sideways)"><table class="qr"><thead><tr><th class="qr-n">#</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r, i) => `<tr><td class="qr-n">${i + 1}</td>${cols.map((c) => `<td>${esc(Q.cellText(r[c] !== undefined ? r[c] : Q.getField(r, c)))}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`
    : '<p class="empty small">No results. Loosen a filter.</p>';
  return `<div class="qr-meta mono"><span><b>${fmt(res.total)}</b> row${res.total === 1 ? '' : 's'}</span><span>${cols.length} col${cols.length === 1 ? '' : 's'}</span><span>${ms} ms</span></div>
    ${warn ? `<ul class="qr-notes small">${warn}</ul>` : ''}
    ${table}
    ${res.total > MAX_SHOW ? `<p class="small muted">Showing the first ${MAX_SHOW} of ${fmt(res.total)} rows.</p>` : ''}`;
}

function runText(text, d, dsId) {
  const t0 = performance.now();
  try {
    const res = Q.runQuery(text, { dialect: d, tables: getTables(), defaultTable: dsId });
    return { res, ms: Math.max(1, Math.round(performance.now() - t0)) };
  } catch (err) {
    if (err instanceof Q.QueryError) return { err };
    console.error(err);
    return { err: { message: 'Something went wrong running that query.', hint: String(err.message || err) } };
  }
}

function insertAtCursor(ins) {
  const ta = document.getElementById('lab-q');
  if (!ta) return;
  let text = ins.replace('…', '');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  if (text.startsWith('| ') && before.trim() && !/\n\s*$/.test(before)) text = `\n${text}`;
  else if (before && !/[\s(]$/.test(before) && /^[\w"|(]/.test(text) && !/^[=!<>]/.test(text)) text = ` ${text}`;
  ta.value = before + text + after;
  // caret inside brackets / quotes for templates like "( )" or "…"
  let caret = before.length + text.length;
  const hole = text.search(/\( \)|""|\(\)| , |  /);
  if (/"…"|\( \)|\(\)/.test(ins) && hole >= 0) caret = before.length + hole + 1;
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(caret, caret);
  saveText(ta.value);
}

// =================================================================== sandbox

function sandboxText(d) {
  const sb = lab().sandbox;
  const ds = getDataset(sb.dataset) || getDataset('winsec');
  return sb.text[d] ?? starter(ds, d);
}

export function renderSandbox() {
  const sb = lab().sandbox;
  if (!getDataset(sb.dataset)) sb.dataset = 'winsec';
  view = { screen: 'sandbox', out: view?.screen === 'sandbox' ? view.out : null, schema: view?.screen === 'sandbox' ? view.schema : false, tab: view?.tab || 'cmds' };
  const d = dialect();
  ctx.setScreen('lab-sandbox');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('QUERY LAB', 'Free search', 'home', 'Back to dashboard')}
    ${ctx.panel({ title: 'Search', icon: 'terminal', hud: true, meta: DIALECT[d], body: editorHtml({ d, dsId: sb.dataset, text: sandboxText(d), picker: true, tab: view.tab }) })}
    ${ctx.panel({ title: 'Results', icon: 'list', id: 'lab-results-panel', body: `<div id="lab-out">${resultsHtml(view.out)}</div>` })}
    ${ctx.panel({ title: 'Try these', icon: 'target', body: examplesHtml(sb.dataset, d) })}
    <button class="btn secondary" data-action="lab-challenges">${icon('flag')}Query challenges</button>
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

const EXAMPLES = {
  winsec: { spl: ['index=wineventlog EventCode=4625 | stats count by user | sort -count', 'index=wineventlog EventCode=4624 Logon_Type=10 | table _time ComputerName user src_ip', 'index=wineventlog | timechart span=1h count by EventCode'], kql: ['SecurityEvent | where EventID == 4625 | summarize count() by TargetUserName | order by count_ desc', 'SecurityEvent | where EventID == 4624 and LogonType == 10 | project TimeGenerated, Computer, TargetUserName, IpAddress', 'SecurityEvent | summarize count() by EventID, Activity'] },
  sysmon: { spl: ['index=sysmon EventCode=1 | stats count by parent_process process | sort count', 'index=sysmon EventCode=3 | stats dc(host) as hosts count by dest_ip dest_port'], kql: ['SysmonEvent | where EventID == 1 | summarize count() by ParentImage, Image | order by count_ asc', 'SysmonEvent | where EventID == 3 | summarize hosts = dcount(Computer), count() by DestinationIp, DestinationPort'] },
  auth: { spl: ['index=linux_auth process=sshd action=failure | top limit=5 src', 'index=linux_auth process=sudo | rex "COMMAND=(?<cmd>.+)$" | stats count by cmd'], kql: ['Syslog | where ProcessName == "sshd" and Action == "failure" | summarize count() by SrcIp | top 5 by count_', 'Syslog | where ProcessName == "sudo" | extend cmd = extract(@"COMMAND=(.+)$", 1, SyslogMessage) | summarize count() by cmd'] },
  proxy: { spl: ['index=proxy | stats sum(bytes_out) as sent by user dest_host | sort -sent | head 10', 'index=proxy action=blocked | stats count by category'], kql: ['CommonSecurityLog | summarize sent = sum(SentBytes) by SourceUserName, DestinationHostName | top 10 by sent', 'CommonSecurityLog | where DeviceAction == "blocked" | summarize count() by RequestContext'] },
  dns: { spl: ['index=dns reply_code=NXDOMAIN | stats count by query | sort -count', 'index=dns | stats count by query_type'], kql: ['DnsEvents | where ResultCode == "NXDOMAIN" | summarize count() by Name | order by count_ desc', 'DnsEvents | summarize count() by QueryType'] },
  firewall: { spl: ['index=firewall action=deny | stats count by src_ip dest_port | sort -count | head 10', 'index=firewall | timechart span=1h count by action'], kql: ['AZFWNetworkRule | where Action == "deny" | summarize count() by SourceIp, DestinationPort | top 10 by count_', 'AZFWNetworkRule | summarize count() by bin(TimeGenerated, 1h), Action'] },
  cloud: { spl: ['index=aws_cloudtrail errorCode=AccessDenied | stats count by userName src_ip', 'index=aws_cloudtrail | stats count by eventSource | sort -count'], kql: ['AWSCloudTrail | where ErrorCode == "AccessDenied" | summarize count() by UserIdentityUserName, SourceIpAddress', 'AWSCloudTrail | summarize count() by EventSource | order by count_ desc'] },
};

function examplesHtml(dsId, d) {
  const list = EXAMPLES[dsId]?.[d] || [];
  if (!list.length) return '<p class="small muted">Explore the fields with the Fields button.</p>';
  return `<ul class="q-examples">${list.map((q, i) => `<li><code class="mono">${esc(q)}</code><button class="btn mini" data-action="lab-example" data-i="${i}">Load</button></li>`).join('')}</ul>`;
}

function saveText(text) {
  if (!view) return;
  if (view.screen === 'sandbox') lab().sandbox.text[dialect()] = text;
  if (view.screen === 'challenge') {
    const rec = (lab().query[view.id] ??= { solved: false, xpPaid: 0, hints: 0, dialects: {}, attempts: 0 });
    rec.draft = { ...(rec.draft || {}), [dialect()]: text };
  }
}

// =================================================================== challenges

export function renderChallengeList() {
  view = { screen: 'challenges' };
  const chs = challenges();
  const groups = [1, 2, 3]
    .map((lv) => {
      const list = chs.filter((c) => c.level === lv);
      if (!list.length) return '';
      return `<div class="track-head">${icon(lv === 1 ? 'host' : lv === 2 ? 'radar' : 'layers')}<h3>${LEVEL[lv]}</h3><span class="count">${list.filter((c) => lab().query[c.id]?.solved).length}/${list.length} solved</span></div>
        <ul class="case-list">${list.map(challengeCard).join('')}</ul>`;
    })
    .join('');
  ctx.setScreen('lab-challenges');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('QUERY LAB', 'Challenges', 'home', 'Back to dashboard')}
    ${ctx.panel({
      title: 'How it works',
      icon: 'terminal',
      hud: true,
      body: `<ol class="howto small">
          <li><b>Read the mission.</b> Each one drops you into a real-sized dataset (thousands of events, lots of noise).</li>
          <li><b>Write a query</b> in <b>SPL</b> (Splunk) or <b>KQL</b> (Microsoft Sentinel / Defender). Switch any time.</li>
          <li><b>Run &amp; check.</b> You're graded on the <b>results</b>, not the query text: any query that finds the right answer wins.</li>
          <li>Stuck? Hints cost 15% of the XP each. After solving you get the model query in <b>both</b> languages.</li>
        </ol>
        <p class="small muted">Solve a challenge in the other language too for a +${L.LAB_XP.dialectBonus} XP bilingual bonus.</p>`,
    })}
    ${ctx.panel({ title: 'Missions', icon: 'flag', meta: `${L.labStats(st()).queriesSolved}/${chs.length} solved`, body: groups })}
    <button class="btn secondary" data-action="lab-sandbox">${icon('search')}Free search sandbox</button>
    <button class="btn secondary" data-action="home">${icon('back')}Back to dashboard</button>
  `);
}

function challengeCard(c) {
  const rec = lab().query[c.id];
  const ds = getDataset(c.dataset);
  const status = rec?.solved ? [`Solved${rec.dialects?.spl && rec.dialects?.kql ? ' ×2' : ''}`, 'ok'] : rec?.attempts ? ['In progress', 'info'] : ['New', 'ready'];
  return `<li class="case-card ${rec?.solved ? 'solved' : ''}">
      <div class="case-top"><span class="mono case-id">${esc(c.id.replace(/^q-/, 'Q-').toUpperCase())}</span>${diffPips(c.difficulty)}<span class="case-diff mono">${DIFF[c.difficulty][0]}</span>${ctx.chip(status)}</div>
      <div class="case-title">${esc(c.title)}</div>
      <p class="small muted">${esc(c.task)}</p>
      <div class="case-req small"><span class="label">Data</span><span class="req-skill mono">${esc(ds.title)}</span><span class="req-skill">${esc(ctx.skillName(c.skill))}</span><span class="req-skill mono">${L.LAB_XP.query[c.difficulty]} XP</span></div>
      <button class="btn ${rec?.solved ? 'secondary' : 'primary'}" data-action="lab-ch" data-id="${c.id}">${icon('terminal')}${rec?.solved ? 'Replay' : rec?.attempts ? 'Continue' : 'Start'}</button>
    </li>`;
}

function challengeText(c, d) {
  const rec = lab().query[c.id];
  return rec?.draft?.[d] ?? starter(getDataset(c.dataset), d);
}

export function openChallenge(id) {
  const c = chById(id);
  if (!c) return renderChallengeList();
  view = { screen: 'challenge', id, out: null, schema: false, tab: 'cmds', hints: lab().query[id]?.hints || 0 };
  return renderChallenge();
}

function hintsHtml(c) {
  const shown = view.hints;
  const list = c.hints.slice(0, shown).map((h, i) => `<li><span class="mono accent-text">H${i + 1}</span> ${esc(h)}</li>`).join('');
  const rec = lab().query[c.id];
  const solved = rec?.solved;
  return `${list ? `<ol class="hint-list small">${list}</ol>` : '<p class="small muted">No hints used.</p>'}
    ${shown < c.hints.length ? `<button class="btn secondary" data-action="lab-hint">${icon('alert')}Show hint ${shown + 1} of ${c.hints.length}${solved ? '' : ` <span class="count">−${Math.round(L.LAB_XP.hintPenalty * 100)}% XP</span>`}</button>` : ''}`;
}

function gradeHtml(c) {
  const g = view.out?.grade;
  if (!g) return '';
  if (g.ok) {
    return `<div class="alert ok-alert" role="status"><div class="alert-tag">${icon('check')}<span>Mission complete</span></div><div class="alert-msg">${esc(g.message)}${view.out.xp ? ` <b class="ok-text">+${view.out.xp} XP</b>` : ''}</div></div>`;
  }
  return `<div class="alert warn" role="status"><div class="alert-tag">${icon('alert')}<span>Not yet</span></div><div class="alert-msg">${esc(g.message)}</div></div>`;
}

function debriefHtml(c) {
  const rec = lab().query[c.id];
  if (!rec?.solved) return '';
  const other = rec.dialects?.spl && rec.dialects?.kql ? '' : `<p class="small accent-text">${icon('star')} Solve it in ${rec.dialects?.spl ? 'KQL' : 'SPL'} too for +${L.LAB_XP.dialectBonus} XP.</p>`;
  return ctx.panel({
    title: 'Debrief',
    icon: 'award',
    id: 'lab-debrief',
    cls: 'debrief',
    body: `<p>${esc(c.explain)}</p>
      <div class="label spaced">Answer</div><p class="mono small">${esc(L.answerSummary(challengeAnswer(c)))}</p>
      ${['spl', 'kql']
        .map((d) => `<div class="model-q"><div class="label row"><span>Model query · ${DIALECT[d]}</span><button class="btn mini ghost" data-action="lab-model" data-d="${d}">Load</button></div><pre class="mono">${esc(c.model[d])}</pre></div>`)
        .join('')}
      ${other}
      <div class="chips-row small">${c.learn.map((x) => `<span class="req-skill">${esc(x)}</span>`).join('')}</div>`,
  });
}

function renderChallenge() {
  const c = chById(view.id);
  const d = dialect();
  const rec = lab().query[c.id];
  const idx = challenges().indexOf(c);
  const next = challenges()[idx + 1];
  const xpNow = L.queryXp(c, view.hints);
  ctx.setScreen('lab-challenge');
  ctx.render(`
    ${ctx.statusBar()}
    ${qbar('QUERY LAB', `${c.title} · ${DIFF[c.difficulty][0]}`, 'lab-challenges', 'Back to challenges')}
    <section class="alert-card sev-medium mission" aria-label="Mission">
      <div class="ac-head">${icon('flag')}<span class="mono">${esc(c.id.toUpperCase())}</span>${ctx.chip(rec?.solved ? ['Solved', 'ok'] : ['Open', 'info'])}<span class="ac-time mono">${rec?.solved ? `${rec.xpPaid} XP earned` : `${xpNow} XP`}</span></div>
      <div class="ac-name">${esc(c.title)}</div>
      <p class="ac-detail small">${esc(c.brief)}</p>
      <p class="mission-task"><b>Task:</b> ${esc(c.task)}</p>
    </section>
    ${ctx.panel({ title: 'Query', icon: 'terminal', hud: true, meta: DIALECT[d], body: editorHtml({ d, dsId: c.dataset, text: challengeText(c, d), runLabel: 'Run & check', tab: view.tab }) })}
    <div id="lab-grade">${gradeHtml(c)}</div>
    ${ctx.panel({ title: 'Results', icon: 'list', id: 'lab-results-panel', body: `<div id="lab-out">${resultsHtml(view.out)}</div>` })}
    ${ctx.panel({ title: 'Hints', icon: 'alert', id: 'lab-hints', meta: `${view.hints}/${c.hints.length} used`, body: `<div id="lab-hints-body">${hintsHtml(c)}</div>` })}
    <div id="lab-debrief-wrap">${debriefHtml(c)}</div>
    ${next ? `<button class="btn secondary" data-action="lab-ch" data-id="${next.id}">${icon('next')}Next: ${esc(next.title)}</button>` : ''}
    <button class="btn secondary" data-action="lab-challenges">${icon('back')}All challenges</button>
  `);
}

function runChallenge() {
  const c = chById(view.id);
  const d = dialect();
  const text = document.getElementById('lab-q')?.value ?? '';
  saveText(text);
  const out = runText(text, d, c.dataset);
  view.out = out;
  if (out.res) {
    out.grade = L.gradeResult(out.res, challengeAnswer(c));
    const r = L.recordQuery(st(), c, { ok: out.grade.ok, dialect: d, hints: view.hints, query: text, now: ctx.now() });
    if (out.grade.ok) {
      const g = G.onLab(st().game, st(), CONTENT, { xp: r.xp, breakdown: r.breakdown, reason: `${c.id}: ${r.breakdown.map((b) => b.label).join(' + ') || 'solved again'}`, now: ctx.now() });
      out.xp = g.xp;
      ctx.save();
      document.getElementById('lab-grade').innerHTML = gradeHtml(c);
      document.getElementById('lab-out').innerHTML = resultsHtml(out);
      document.getElementById('lab-debrief-wrap').innerHTML = debriefHtml(c);
      ctx.xpToast(g.xp);
      ctx.queueAchievements(g);
      ctx.refreshStatusXp();
      document.getElementById('lab-grade')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  ctx.save();
  document.getElementById('lab-grade').innerHTML = gradeHtml(c);
  document.getElementById('lab-out').innerHTML = resultsHtml(out);
  document.getElementById(out.err ? 'lab-out' : 'lab-grade')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runSandbox() {
  const text = document.getElementById('lab-q')?.value ?? '';
  saveText(text);
  ctx.save();
  view.out = runText(text, dialect(), lab().sandbox.dataset);
  document.getElementById('lab-out').innerHTML = resultsHtml(view.out);
  document.getElementById('lab-results-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function rerender() {
  const y = window.scrollY;
  if (view?.screen === 'sandbox') renderSandbox();
  else if (view?.screen === 'challenge') renderChallenge();
  window.scrollTo(0, y);
}

// =================================================================== events

export function handleClick(action, el) {
  switch (action) {
    case 'lab-sandbox':
      view = null;
      renderSandbox();
      return true;
    case 'lab-challenges':
      renderChallengeList();
      return true;
    case 'lab-ch':
      openChallenge(el.dataset.id);
      return true;
    case 'lab-dialect': {
      const ta = document.getElementById('lab-q');
      if (ta) saveText(ta.value);
      lab().prefs.dialect = el.dataset.d === 'kql' ? 'kql' : 'spl';
      if (view) view.out = null;
      ctx.save();
      rerender();
      return true;
    }
    case 'lab-chiptab':
      if (view) view.tab = el.dataset.tab;
      document.getElementById('lab-chips').innerHTML = chipRow(view.screen === 'sandbox' ? lab().sandbox.dataset : chById(view.id).dataset, dialect(), el.dataset.tab);
      for (const b of el.parentElement.children) {
        b.classList.toggle('on', b === el);
        b.setAttribute('aria-selected', String(b === el));
      }
      return true;
    case 'lab-insert':
      insertAtCursor(el.dataset.ins);
      return true;
    case 'lab-run':
      if (view?.screen === 'challenge') runChallenge();
      else runSandbox();
      return true;
    case 'lab-schema': {
      view.schema = !view.schema;
      const dsId = view.screen === 'sandbox' ? lab().sandbox.dataset : chById(view.id).dataset;
      document.getElementById('lab-schema').innerHTML = view.schema ? schemaHtml(dsId, dialect()) : '';
      el.setAttribute('aria-expanded', String(view.schema));
      return true;
    }
    case 'lab-reset-q': {
      const ta = document.getElementById('lab-q');
      const ds = getDataset(view.screen === 'sandbox' ? lab().sandbox.dataset : chById(view.id).dataset);
      ta.value = starter(ds, dialect());
      saveText(ta.value);
      ctx.save();
      return true;
    }
    case 'lab-example': {
      const q = EXAMPLES[lab().sandbox.dataset]?.[dialect()]?.[Number(el.dataset.i)];
      if (q) {
        const ta = document.getElementById('lab-q');
        ta.value = q.replace(/ \| /g, '\n| ');
        saveText(ta.value);
        runSandbox();
      }
      return true;
    }
    case 'lab-hint': {
      const c = chById(view.id);
      if (view.hints < c.hints.length) view.hints += 1;
      const rec = (lab().query[c.id] ??= { solved: false, xpPaid: 0, hints: 0, dialects: {}, attempts: 0 });
      if (!rec.solved) rec.hints = Math.max(rec.hints, view.hints);
      ctx.save();
      document.getElementById('lab-hints-body').innerHTML = hintsHtml(c);
      const meta = document.querySelector('#lab-hints .ph-meta');
      if (meta) meta.textContent = `${view.hints}/${c.hints.length} used`;
      const xpEl = document.querySelector('.mission .ac-time');
      if (xpEl && !rec.solved) xpEl.textContent = `${L.queryXp(c, view.hints)} XP`;
      return true;
    }
    case 'lab-model': {
      const c = chById(view.id);
      const d = el.dataset.d === 'kql' ? 'kql' : 'spl';
      if (d !== dialect()) {
        lab().prefs.dialect = d;
        view.out = null;
      }
      const rec = lab().query[c.id];
      rec.draft = { ...(rec.draft || {}), [d]: c.model[d] };
      ctx.save();
      renderChallenge();
      document.getElementById('lab-editor')?.scrollIntoView({ block: 'start' });
      return true;
    }
    default:
      if (PKT.handleClick(action, el)) return true;
      return RULE.handleClick(action, el);
  }
}

export function handleInput(e) {
  if (PKT.handleInput(e)) return;
  if (RULE.handleInput(e)) return;
  const t = e.target;
  if (!view) return;
  if (t.id === 'lab-q') {
    saveText(t.value);
    if (e.type === 'change') ctx.save();
  } else if (t.id === 'lab-ds' && e.type === 'change') {
    const ta = document.getElementById('lab-q');
    if (ta) saveText(ta.value);
    lab().sandbox.dataset = t.value;
    lab().sandbox.text = {};
    view.out = null;
    ctx.save();
    renderSandbox();
  }
}

export function handleKey(e) {
  if (e.target.id === 'lab-q' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleClick('lab-run', e.target);
  }
}

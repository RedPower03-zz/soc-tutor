// Backup & restore screen (Profile → Backup & move device) and the home-screen reminder.
// Logic lives in js/backup.js; this file only renders and wires buttons.
import { CONTENT } from '../content/index.js';
import * as B from './backup.js';
import { icon } from './icons.js';

const PRE_IMPORT_KEY = 'soc-tutor:before-import';
let ctx = null; // { getState, setState, save, now, render, statusBar, panel, chip, esc, renderHome, setScreen }
let view = { code: null, check: null, message: null, busy: false };

const st = () => ctx.getState();
const esc = (s) => ctx.esc(s);
const fmt = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (t) => (t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');
const ago = (t) => {
  if (!t) return 'never';
  const d = Math.floor((ctx.now() - t) / B.DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const METHOD = { file: 'backup file', code: 'backup code', share: 'shared file' };

export function initBackup(c) {
  ctx = c;
  B.ensureBackup(st(), ctx.now());
}

function preImport() {
  try {
    const raw = localStorage.getItem(PRE_IMPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ home reminder

export function reminderBanner() {
  const r = B.backupReminder(st(), ctx.now());
  if (!r.show) return '';
  return `<div class="alert info notice backup-nudge" role="note">
      <div class="alert-tag">${icon('shield')}<span>Back up your progress</span></div>
      <div class="alert-msg">You've earned <b>${fmt(r.xpSince)} XP</b> since ${r.never ? 'you started' : 'your last backup'}${r.never ? '' : ` (${r.days} days ago)`}. Your progress lives only in this browser, so a backup takes a few seconds and lets you move to another device.</div>
      <div class="btn-row"><button class="btn mini primary" data-action="backup">${icon('shield')}Back up now</button><button class="btn mini ghost" data-action="backup-snooze">Later</button></div>
    </div>`;
}

/** One-line status for the profile screen. */
export function statusLine() {
  const b = B.ensureBackup(st(), ctx.now());
  return b.lastAt ? `Last backed up ${ago(b.lastAt)} (${METHOD[b.method] || 'backup'})` : 'Not backed up yet';
}

// ------------------------------------------------------------------ screen

export function renderBackup() {
  ctx.setScreen();
  const s = st();
  const b = B.ensureBackup(s, ctx.now());
  const pre = preImport();
  const r = B.backupReminder(s, ctx.now());
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && typeof File === 'function' && (() => {
    try {
      return navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
    } catch {
      return false;
    }
  })();
  const c = view.check;
  const previewHtml = c?.ok
    ? (() => {
        const p = c.preview;
        const cur = s.game;
        return `<div class="bk-preview" id="bk-preview">
          <div class="label">Backup contents</div>
          <dl class="bk-grid mono">
            <div><dt>Rank</dt><dd>${esc(p.rank)}</dd></div>
            <div><dt>XP · level</dt><dd>${fmt(p.xp)} · L${p.level}</dd></div>
            <div><dt>Skills mastered</dt><dd>${p.mastered}/${p.skills}</dd></div>
            <div><dt>Badges</dt><dd>${p.badges}</dd></div>
            <div><dt>Backed up</dt><dd>${esc(fmtDate(p.exportedAt))}</dd></div>
            <div><dt>Last activity</dt><dd>${esc(fmtDate(p.lastActive))}</dd></div>
          </dl>
          ${p.fromVersion < s.version ? `<p class="small muted">${icon('review')}This is an older save (v${p.fromVersion}). It has been upgraded to the current format.</p>` : ''}
          <div class="alert crit bk-warn" role="alert"><div class="alert-tag">${icon('alert')}<span>This replaces your progress on this device</span></div>
            <div class="alert-msg">Current: <b>${esc(ctx.rankTitle())}</b>, ${fmt(cur.xp)} XP. Your current progress is kept for one undo.</div></div>
          <button class="btn primary" data-action="backup-confirm">${icon('check')}Replace my progress</button>
          <button class="btn secondary" data-action="backup-cancel">Cancel</button>
        </div>`;
      })()
    : c && !c.ok
      ? `<p class="bk-error crit-text small" role="alert">${icon('x')}${esc(c.error)}</p>`
      : '';
  ctx.render(`
    ${ctx.statusBar()}
    <header class="qbar">
      <button class="icon-btn" data-action="profile" aria-label="Back to profile">${icon('back')}</button>
      <div class="qbar-mid">${ctx.chip(['Backup', 'info'], 'mode')}<span class="skill-label">Save or move your progress</span></div>
    </header>
    ${view.message ? `<div class="alert ok notice" role="status"><div class="alert-tag">${icon('check')}<span>${esc(view.message.title)}</span></div><div class="alert-msg">${esc(view.message.text)}</div></div>` : ''}
    ${ctx.panel({
      title: 'Backup status',
      icon: 'shield',
      meta: b.lastAt ? ago(b.lastAt) : 'never',
      hud: true,
      body: `<div class="bk-status ${b.lastAt && !r.show ? 'ok' : 'warn'}">
          <div class="readout-block"><div class="readout">${b.lastAt ? esc(ago(b.lastAt)) : 'Never'}</div><div class="label">Last backup</div></div>
          <p class="small">${b.lastAt ? `${esc(fmtDate(b.lastAt))} · ${esc(METHOD[b.method] || 'backup')}` : 'Nothing backed up yet.'}${r.xpSince ? ` · <b>${fmt(r.xpSince)} XP</b> earned since` : ''}</p>
        </div>
        <p class="small muted">Your progress is saved only in this browser on this device. Clearing browser data, or switching phone or browser, starts you from zero unless you have a backup. Automatic sync would need an account and a server; this is the manual way.</p>`,
    })}
    ${ctx.panel({
      title: 'Back up',
      icon: 'send',
      body: `<button class="btn primary" data-action="backup-download">${icon('send')}Download backup file (.json)</button>
        ${canShare ? `<button class="btn secondary" data-action="backup-share">${icon('send')}Share / save to Files</button>` : ''}
        <button class="btn secondary" data-action="backup-code" ${view.busy ? 'disabled' : ''}>${icon('terminal')}${view.code ? 'Refresh backup code' : 'Show backup code'}</button>
        ${
          view.code
            ? `<label class="field-label spaced" for="bk-code-out">Backup code · ${fmt(view.code.length)} characters</label>
          <textarea id="bk-code-out" class="text-answer bk-code mono" rows="6" readonly>${esc(B.wrapCode(view.code))}</textarea>
          <button class="btn primary" data-action="backup-copy">${icon('check')}Copy code</button>
          <p class="small muted">Paste it into a note, or message it to yourself. On the other device, open SOC Tutor → Profile → Backup and paste it under Restore.</p>`
            : ''
        }
        <p class="small muted">On iPhone, if the file download doesn't start, use ${canShare ? 'Share / save to Files, or ' : ''}the backup code instead.</p>`,
    })}
    ${ctx.panel({
      title: 'Restore',
      icon: 'review',
      body: `<label class="btn secondary file-btn">${icon('list')}Choose a backup file<input type="file" id="bk-file" accept=".json,application/json,text/plain"></label>
        <label class="field-label spaced" for="bk-code-in">…or paste a backup code</label>
        <textarea id="bk-code-in" class="text-answer bk-code mono" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="SOCT1.d.…"></textarea>
        <button class="btn secondary" data-action="backup-check">${icon('search')}Check code</button>
        ${previewHtml}
        ${pre ? `<div class="bk-undo small"><span>${icon('review')}Progress from before your last import (${esc(fmtDate(pre.at))}) is kept.</span><button class="btn mini ghost" data-action="backup-undo">Undo import</button></div>` : ''}`,
    })}
    <button class="btn secondary" data-action="profile">${icon('back')}Back to profile</button>
  `);
  document.getElementById('bk-file')?.addEventListener('change', onFile);
  if (c) document.getElementById(c.ok ? 'bk-preview' : 'bk-code-in')?.scrollIntoView({ block: 'center' });
}

async function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5_000_000) {
    view = { ...view, check: { ok: false, error: 'That file is too big to be a SOC Tutor backup.' }, message: null };
    return renderBackup();
  }
  const text = await file.text();
  view = { ...view, check: B.prepareImport(B.parseFile(text), CONTENT, ctx.now()), message: null };
  renderBackup();
}

function download(json, name) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}

async function copyText(text, el) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (el) {
      el.focus();
      el.select();
      el.setSelectionRange?.(0, text.length);
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
    return false;
  }
}

function done(method, title, text) {
  B.markBackedUp(st(), method, ctx.now());
  ctx.save();
  view = { ...view, message: { title, text } };
}

// ------------------------------------------------------------------ events

export function handleClick(action, el) {
  switch (action) {
    case 'backup':
      view = { code: null, check: null, message: null, busy: false };
      renderBackup();
      return true;
    case 'backup-snooze':
      B.snoozeReminder(st(), ctx.now());
      ctx.save();
      el.closest('.backup-nudge')?.remove();
      return true;
    case 'backup-download': {
      const t = ctx.now();
      download(B.toJsonFile(st(), t), B.fileName(t));
      done('file', 'Backup file created', `Saved as ${B.fileName(t)} in your downloads. Keep it somewhere safe, or open it on your other device.`);
      renderBackup();
      return true;
    }
    case 'backup-share': {
      const t = ctx.now();
      const file = new File([B.toJsonFile(st(), t)], B.fileName(t), { type: 'application/json' });
      navigator
        .share({ files: [file], title: 'SOC Tutor backup' })
        .then(() => {
          done('share', 'Backup shared', 'Your backup file was shared. Open it on your other device to restore.');
          renderBackup();
        })
        .catch(() => {});
      return true;
    }
    case 'backup-code':
      view = { ...view, busy: true };
      B.encodeCode(st(), ctx.now()).then((code) => {
        view = { ...view, code, busy: false };
        B.markBackedUp(st(), 'code', ctx.now());
        ctx.save();
        renderBackup();
        document.getElementById('bk-code-out')?.scrollIntoView({ block: 'center' });
      });
      return true;
    case 'backup-copy': {
      const out = document.getElementById('bk-code-out');
      copyText(view.code, out).then((ok) => {
        if (ok) done('code', 'Backup code copied', 'Paste it into a note or message to yourself. It contains all your progress.');
        else view = { ...view, message: { title: 'Copy the code by hand', text: 'Your browser blocked copying. Press and hold the code, choose Select All, then Copy.' } };
        renderBackup();
      });
      return true;
    }
    case 'backup-check': {
      const code = document.getElementById('bk-code-in')?.value || '';
      B.decodeCode(code).then((u) => {
        view = { ...view, check: B.prepareImport(u, CONTENT, ctx.now()), message: null };
        renderBackup();
        const input = document.getElementById('bk-code-in');
        if (input && !view.check.ok) input.value = code;
      });
      return true;
    }
    case 'backup-cancel':
      view = { ...view, check: null };
      renderBackup();
      return true;
    case 'backup-confirm': {
      if (!view.check?.ok) return true;
      try {
        localStorage.setItem(PRE_IMPORT_KEY, JSON.stringify({ at: ctx.now(), state: st() }));
      } catch {
        /* storage full: import anyway */
      }
      const p = view.check.preview;
      ctx.setState(view.check.state);
      view = { code: null, check: null, busy: false, message: { title: 'Progress restored', text: `You're now ${p.rank} with ${fmt(p.xp)} XP and ${p.mastered} skills mastered.` } };
      renderBackup();
      window.scrollTo(0, 0);
      return true;
    }
    case 'backup-undo': {
      const pre = preImport();
      if (!pre || !window.confirm('Go back to the progress you had before the last import?')) return true;
      const u = B.unwrap(pre.state);
      const ready = B.prepareImport(u, CONTENT, ctx.now());
      if (ready.ok) {
        ctx.setState(ready.state);
        localStorage.removeItem(PRE_IMPORT_KEY);
        view = { code: null, check: null, busy: false, message: { title: 'Import undone', text: 'Your earlier progress is back.' } };
      }
      renderBackup();
      return true;
    }
    default:
      return false;
  }
}

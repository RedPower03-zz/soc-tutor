// Parameterised generators for the Level 1 host skills. Answers come from the
// fact tables below (Windows Security/System log IDs, logon types, Unix modes,
// normal Windows process trees, file-system locations, persistence locations).
import { mc } from './rng.js';
import { closeLen } from './util.js';

// ---------------------------------------------------------------- Windows event IDs

// [id, log, meaning]. Security log unless noted.
export const EVENT_IDS = [
  [4624, 'Security', 'An account logged on successfully'],
  [4625, 'Security', 'An account failed to log on'],
  [4634, 'Security', 'An account was logged off'],
  [4648, 'Security', 'A logon used explicit credentials'],
  [4672, 'Security', 'Special privileges assigned to a logon'],
  [4688, 'Security', 'A new process was created'],
  [4697, 'Security', 'A service was installed'],
  [4698, 'Security', 'A scheduled task was created'],
  [4720, 'Security', 'A user account was created'],
  [4722, 'Security', 'A user account was enabled'],
  [4724, 'Security', "An account's password was reset"],
  [4725, 'Security', 'A user account was disabled'],
  [4726, 'Security', 'A user account was deleted'],
  [4728, 'Security', 'Member added to a global security group'],
  [4732, 'Security', 'Member added to a local security group'],
  [4740, 'Security', 'A user account was locked out'],
  [4768, 'Security', 'A Kerberos TGT was requested'],
  [4769, 'Security', 'A Kerberos service ticket was requested'],
  [4776, 'Security', 'NTLM credential validation was attempted'],
  [1102, 'Security', 'The Security audit log was cleared'],
  [7045, 'System', 'A new service was installed'],
  [4104, 'PowerShell/Operational', 'A PowerShell script block was logged'],
];

const MIS_EVT = { 4624: [4625, 'log-success-vs-failure'], 4625: [4624, 'log-success-vs-failure'] };

const eventMeaning = {
  id: 'evt-meaning',
  skill: 'host-logs',
  count: 10,
  bloom: 'understand',
  make(r) {
    const [id, log, meaning] = r.cycle(EVENT_IDS);
    const svc = (x) => x === 4697 || x === 7045;
    const pool = EVENT_IDS.filter((e) => e[0] !== id && !(svc(e[0]) && svc(id)));
    const confuse = MIS_EVT[id];
    const distractors = closeLen(r, [id, log, meaning], pool, 3, (e) => e[2]).map((e) => e[2]);
    const ds = confuse ? [{ text: EVENT_IDS.find((e) => e[0] === confuse[0])[2], mis: confuse[1] }, ...distractors] : distractors;
    const onDc = [4768, 4769, 4776, 4728, 4740].includes(id); // domain events are logged by the DC
    const host = onDc ? r.pick(['DC01', 'DC02']) : r.pick(['WS-HR-04', 'WS-FIN-12', 'SRV-FILE-02', 'SRV-APP-07', 'WS-ENG-21']);
    const user = r.pick(['CORP\\j.alvarez', 'CORP\\p.nakamura', 'CORP\\svc_backup', 'CORP\\a.okafor']);
    return {
      difficulty: [4624, 4625, 4688, 4720, 1102, 4740].includes(id) ? 1 : 2,
      ...mc(r, meaning, ds),
      prompt: 'What does this Windows event record?',
      snippet: `Log: ${log}   EventID: ${id}   Computer: ${host}\nTimeCreated: 2026-09-25T${String(r.int(0, 23)).padStart(2, '0')}:${String(r.int(10, 59))}:${String(r.int(10, 59))}Z   Subject: ${user}`,
      explanation: `Event **${id}** (${log} log): ${meaning.toLowerCase()}. ${id === 4697 || id === 7045 ? 'Service installs are logged twice when auditing is on: 4697 in Security and 7045 in System.' : id === 4768 || id === 4769 ? '4768 is the TGT (the initial Kerberos logon); 4769 is a ticket for a specific service.' : id === 1102 ? 'Clearing the Security log is rare in normal operations and a classic anti-forensics step.' : 'Learn the core IDs by heart: they are the vocabulary of Windows triage.'}`,
    };
  },
};

const eventId = {
  id: 'evt-id',
  skill: 'host-logs',
  count: 8,
  bloom: 'remember',
  make(r) {
    const [id, log, meaning] = r.cycle(EVENT_IDS.filter((e) => e[1] === 'Security'));
    const confuse = MIS_EVT[id];
    const pool = r.shuffle(EVENT_IDS.filter((e) => e[0] !== id && e[1] === 'Security').map((e) => String(e[0])));
    const ds = confuse ? [{ text: String(confuse[0]), mis: confuse[1] }, ...pool] : pool;
    return {
      difficulty: [4624, 4625, 4688, 4720].includes(id) ? 1 : 2,
      ...mc(r, String(id), ds),
      prompt: `Which Windows Security event ID records "**${meaning}**"?`,
      explanation: `**${id}**: ${meaning.toLowerCase()}. Neighbouring IDs are easy to mix up (4624 success vs 4625 failure, 4728 global vs 4732 local group, 4768 TGT vs 4769 service ticket), so read the ID carefully before you conclude anything.`,
    };
  },
};

// [type, name, typical source]
export const LOGON_TYPES = [
  [2, 'Interactive', 'someone typing at the console'],
  [3, 'Network', 'access to a file share over SMB'],
  [4, 'Batch', 'a scheduled task running as a user'],
  [5, 'Service', 'a service starting under its account'],
  [7, 'Unlock', 'a user unlocking a locked workstation'],
  [8, 'NetworkCleartext', 'IIS basic authentication'],
  [9, 'NewCredentials', 'runas /netonly'],
  [10, 'RemoteInteractive', 'a Remote Desktop session'],
  [11, 'CachedInteractive', 'a laptop logon with cached domain credentials'],
];

const logonType = {
  id: 'logon-type',
  skill: 'host-logs',
  count: 7,
  bloom: 'apply',
  make(r) {
    const [type, name, src] = r.cycle(LOGON_TYPES);
    const pool = r.shuffle(LOGON_TYPES.filter((t) => t[0] !== type)).map((t) => `${t[0]} (${t[1]})`);
    const answer = `${type} (${name})`;
    return {
      difficulty: [2, 3, 10].includes(type) ? 1 : 2,
      ...mc(r, answer, pool),
      prompt: `A 4624 success event comes from **${src}**. Which logon type should it show?`,
      explanation: `${src[0].toUpperCase()}${src.slice(1)} produces **Logon Type ${type} (${name})**. Key ones for triage: 2 console, 3 network (SMB, and the NLA pre-authentication of RDP), 4 batch, 5 service, 10 RDP session, 11 cached credentials.`,
    };
  },
};

// ---------------------------------------------------------------- Unix permissions

export function modeToSymbolic(mode, special = 0) {
  const tri = (d, execChar) => {
    const r = d & 4 ? 'r' : '-';
    const w = d & 2 ? 'w' : '-';
    const x = d & 1 ? 'x' : '-';
    return r + w + (execChar ? (d & 1 ? execChar : execChar.toUpperCase()) : x);
  };
  const [u, g, o] = String(mode).padStart(3, '0').split('').map(Number);
  return tri(u, special & 4 ? 's' : null) + tri(g, special & 2 ? 's' : null) + tri(o, special & 1 ? 't' : null);
}

const MODES = [600, 640, 644, 660, 664, 700, 711, 740, 750, 755, 770, 775, 777, 400, 440, 444, 550, 751];

const permOctal = {
  id: 'perm-octal',
  skill: 'host-users',
  count: 8,
  bloom: 'apply',
  make(r) {
    const mode = r.cycle(MODES);
    const sym = modeToSymbolic(mode);
    const file = r.pick(['backup.sh', 'id_rsa', 'app.conf', 'deploy', 'notes.txt', 'db.env']);
    const reversed = String(mode).split('').reverse().join('');
    return {
      difficulty: 1,
      type: 'text',
      prompt: `\`ls -l\` shows \`-${sym}\` for **${file}**. What is that mode in octal? (three digits)`,
      accept: [String(mode), `0${mode}`],
      ...(reversed !== String(mode) ? { misconceptions: { [reversed]: 'perm-rwx-triplets' } } : {}),
      explanation: `Split into owner/group/other triplets: ${sym.slice(0, 3)} ${sym.slice(3, 6)} ${sym.slice(6)}. Add r = 4, w = 2, x = 1 in each: ${String(mode).split('').join(', ')} → **${mode}**.`,
    };
  },
};

const permSymbolic = {
  id: 'perm-symbolic',
  skill: 'host-users',
  count: 6,
  bloom: 'apply',
  make(r) {
    const mode = r.cycle(MODES.filter((m) => String(m).split('').reverse().join('') !== String(m)));
    const answer = `-${modeToSymbolic(mode)}`;
    const rev = Number(String(mode).split('').reverse().join(''));
    const [u, g, o] = String(mode).split('').map(Number);
    const cands = [
      { text: `-${modeToSymbolic(rev)}`, mis: 'perm-rwx-triplets' },
      `-${modeToSymbolic(u * 100 + o * 10 + g)}`,
      `-${modeToSymbolic((u ^ 1) * 100 + g * 10 + o)}`,
      `-${modeToSymbolic(u * 100 + (g ^ 2) * 10 + o)}`,
      `-${modeToSymbolic(u * 100 + g * 10 + (o ^ 4))}`,
    ];
    return {
      difficulty: 2,
      ...mc(r, answer, cands),
      prompt: `An admin runs \`chmod ${mode} report.sh\`. What will \`ls -l\` show?`,
      explanation: `Each digit is one triplet in the order owner, group, other; each digit is the sum of r = 4, w = 2, x = 1. ${mode} → ${String(mode).split('').map((d) => modeToSymbolic(Number(d) * 100).slice(0, 3)).join(' ')} → **${answer}**.`,
    };
  },
};

const permSpecial = {
  id: 'perm-special',
  skill: 'host-users',
  count: 6,
  bloom: 'analyze',
  make(r) {
    const base = r.pick([755, 775, 750, 711, 777, 751]);
    const special = r.cycle([4, 2, 1]);
    const sym = modeToSymbolic(base, special);
    const answer = `${special}${base}`;
    const cands = [4, 2, 1, 0].filter((s) => s !== special).map((s) => ({ text: `${s}${base}`, mis: s ? 'perm-suid-sticky' : undefined }));
    const file = special === 1 ? '/srv/dropbox' : r.pick(['/usr/local/bin/backup', '/opt/tools/netdiag', '/usr/bin/report']);
    const name = { 4: 'SUID (runs with the owner\'s rights)', 2: 'SGID (runs with the group\'s rights / inherits group)', 1: 'sticky bit (only owners can delete their files)' }[special];
    return {
      difficulty: 3,
      ...mc(r, answer, cands),
      prompt: `\`ls -ld ${file}\` shows \`${special === 1 ? 'd' : '-'}${sym}\`. Which four-digit octal mode is that?`,
      explanation: `The leading digit holds the special bits: 4 = SUID (s in the owner execute slot), 2 = SGID (s in the group slot), 1 = sticky (t in the other slot). Here that is the ${name}, so the mode is **${answer}**. A SUID binary owned by root that a user can abuse is a classic privilege-escalation path.`,
    };
  },
};

// ---------------------------------------------------------------- processes

// Normal parent of each process on a healthy Windows 10/11 host.
export const PARENTS = [
  ['svchost.exe', 'services.exe'], ['spoolsv.exe', 'services.exe'], ['MsMpEng.exe', 'services.exe'],
  ['SearchIndexer.exe', 'services.exe'], ['services.exe', 'wininit.exe'], ['lsass.exe', 'wininit.exe'],
  ['userinit.exe', 'winlogon.exe'], ['taskhostw.exe', 'svchost.exe'], ['RuntimeBroker.exe', 'svchost.exe'],
  ['WmiPrvSE.exe', 'svchost.exe'], ['dllhost.exe', 'svchost.exe'], ['conhost.exe', 'csrss.exe'],
  ['winlogon.exe', 'smss.exe'], ['csrss.exe', 'smss.exe'], ['sihost.exe', 'svchost.exe'],
];
const PARENT_POOL = ['services.exe', 'wininit.exe', 'winlogon.exe', 'svchost.exe', 'explorer.exe', 'smss.exe', 'lsass.exe', 'csrss.exe'];

const procParent = {
  id: 'proc-parent',
  skill: 'host-processes',
  count: 12,
  bloom: 'understand',
  make(r) {
    const [child, parent] = r.cycle(PARENTS);
    const ds = r.shuffle(PARENT_POOL.filter((p) => p !== parent && p !== child)).map((p) => ({
      text: p,
      mis: child === 'svchost.exe' ? 'proc-svchost-parent' : undefined,
    }));
    return {
      difficulty: child === 'svchost.exe' || child === 'lsass.exe' ? 1 : 2,
      ...mc(r, parent, ds),
      prompt: `On a healthy Windows 11 host, which process is the **normal parent** of **${child}**?`,
      explanation: `${child} is normally started by **${parent}**. The core tree: smss.exe → wininit.exe → services.exe and lsass.exe; services.exe → svchost.exe and other services; svchost.exe hosts helpers such as taskhostw.exe, RuntimeBroker.exe and WmiPrvSE.exe. The same name under a different parent (e.g. explorer.exe → svchost.exe) is a masquerading red flag.`,
    };
  },
};

const SYS32 = ['svchost.exe', 'lsass.exe', 'services.exe', 'wininit.exe', 'winlogon.exe', 'csrss.exe', 'smss.exe', 'taskhostw.exe', 'spoolsv.exe', 'dllhost.exe', 'conhost.exe', 'RuntimeBroker.exe'];
const TYPO = { 'svchost.exe': 'scvhost.exe', 'lsass.exe': 'lsas.exe', 'services.exe': 'service.exe', 'wininit.exe': 'winint.exe', 'winlogon.exe': 'winlogin.exe', 'csrss.exe': 'cssrs.exe', 'smss.exe': 'smsss.exe', 'taskhostw.exe': 'taskhost32.exe', 'spoolsv.exe': 'spoolsvc.exe', 'dllhost.exe': 'dilhost.exe', 'conhost.exe': 'conhst.exe', 'RuntimeBroker.exe': 'RuntimeBroke.exe' };

const procPath = {
  id: 'proc-path',
  skill: 'host-processes',
  count: 10,
  bloom: 'analyze',
  make(r) {
    const exe = r.cycle(SYS32);
    const answer = `C:\\Windows\\System32\\${exe}`;
    const cands = r.shuffle([
      `C:\\Windows\\${exe}`,
      `C:\\Users\\Public\\${exe}`,
      `C:\\ProgramData\\${exe}`,
      `C:\\Windows\\Temp\\${exe}`,
      `C:\\Windows\\System32\\${TYPO[exe]}`,
    ]);
    return {
      difficulty: 2,
      ...mc(r, answer, cands),
      prompt: `EDR shows four processes named like **${exe.replace('.exe', '')}**. Which image path is the legitimate one?`,
      explanation: `The genuine ${exe} lives in **C:\\Windows\\System32**. Copies in user-writable folders (Public, ProgramData, Temp), in C:\\Windows itself, or with a one-letter typo (${TYPO[exe]}) are classic masquerading (T1036.005). Always check the full path, not just the name.`,
    };
  },
};

// ---------------------------------------------------------------- file system

export const PATHS = [
  ['/etc/passwd', 'Account names, UIDs and shells (no hashes)'],
  ['/etc/shadow', 'Password hashes, readable only by root'],
  ['/etc/sudoers', 'Rules for who may run what with sudo'],
  ['/var/log/auth.log', 'SSH, sudo and login events (Debian/Ubuntu)'],
  ['/etc/crontab', 'The system-wide cron schedule'],
  ['~/.ssh/authorized_keys', 'Public keys allowed to log in as the user'],
  ['~/.bash_history', "The user's past shell commands"],
  ['/dev/shm', 'RAM-backed shared memory any user can write'],
  ['/etc/hosts', 'Static name-to-IP overrides'],
  ['C:\\Windows\\System32\\config\\SAM', 'Registry hive with local account hashes'],
  ['C:\\Windows\\System32\\winevt\\Logs', 'The Windows event log (.evtx) files'],
  ['C:\\Windows\\Prefetch', 'Prefetch files showing programs that ran'],
  ['C:\\Users\\<user>\\AppData\\Roaming', 'Per-user app data the user can write to'],
  ['C:\\Windows\\System32\\drivers\\etc\\hosts', 'Windows static name-to-IP overrides'],
  ['/var/log/secure', 'SSH, sudo and login events (RHEL/CentOS)'],
  ['/proc', 'Live kernel view of processes and memory maps'],
  ['C:\\Windows\\System32\\config\\SYSTEM', 'Registry hive with services and boot config'],
  ['C:\\Windows\\Amcache.hve', 'Amcache evidence of programs that executed'],
  ['C:\\$Recycle.Bin', 'Per-user recycle bin of deleted files'],
  ['/var/spool/cron/crontabs', 'Per-user cron jobs on many Linux distributions'],
  ['C:\\ProgramData', 'Machine-wide app data often writable by users'],
  ['/tmp', 'World-writable temporary files that vanish on reboot'],
];

const fsPath = {
  id: 'fs-path',
  skill: 'host-filesystem',
  count: 22,
  bloom: 'remember',
  make(r) {
    const [path, what] = r.cycle(PATHS);
    const pool = PATHS.filter((p) => p[1] !== what && !(p[1].includes('overrides') && what.includes('overrides')));
    const ds = closeLen(r, [path, what], pool, 3, (p) => p[1]).map((p) => ({
      text: p[1],
      mis: path === '/etc/passwd' && p[0] === '/etc/shadow' ? 'fs-passwd-hashes' : undefined,
    }));
    if (path === '/etc/passwd') ds.unshift({ text: 'Password hashes, readable only by root', mis: 'fs-passwd-hashes' });
    return {
      difficulty: path.startsWith('/etc/pass') || path.startsWith('/etc/shadow') ? 1 : 2,
      ...mc(r, what, ds),
      prompt: `During triage you open **${path}**. What does it hold?`,
      explanation: `${path} holds **${what.charAt(0).toLowerCase()}${what.slice(1)}**. Knowing what each location normally contains tells you what an attacker gains by reading or changing it.${path === '/etc/passwd' ? ' Hashes moved to /etc/shadow long ago precisely because /etc/passwd is world-readable.' : ''}${path.includes('AppData') || path === '/dev/shm' ? ' User-writable locations are favourite drop spots for malware.' : ''}${path.includes('Prefetch') ? ' Prefetch is on by default on Windows client versions and off by default on Windows Server.' : ''}`,
    };
  },
};

// ---------------------------------------------------------------- persistence

export const PERSIST = [
  ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'T1547.001 Registry Run Keys / Startup Folder'],
  ['C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp', 'T1547.001 Registry Run Keys / Startup Folder'],
  ['C:\\Windows\\System32\\Tasks\\ (schtasks /create)', 'T1053.005 Scheduled Task'],
  ['HKLM\\SYSTEM\\CurrentControlSet\\Services (new ImagePath)', 'T1543.003 Windows Service'],
  ['/etc/cron.d/ or a user crontab', 'T1053.003 Cron'],
  ['/etc/systemd/system/*.service', 'T1543.002 Systemd Service'],
  ['root\\subscription (WMI __EventFilter + consumer)', 'T1546.003 WMI Event Subscription'],
  ['~/.ssh/authorized_keys', 'T1098.004 SSH Authorized Keys'],
  ['~/.bashrc or /etc/profile.d/', 'T1546.004 Unix Shell Configuration Modification'],
  ['HKLM\\...\\Winlogon\\Userinit or Shell value', 'T1547.004 Winlogon Helper DLL'],
  ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce', 'T1547.001 Registry Run Keys / Startup Folder'],
  ['/etc/systemd/system/*.timer', 'T1053.006 Systemd Timers'],
  ['HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\sethc.exe', 'T1546.012 Image File Execution Options Injection'],
  ['C:\\Users\\<user>\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup', 'T1547.001 Registry Run Keys / Startup Folder'],
  ['/Library/LaunchDaemons/*.plist', 'T1543.004 Launch Daemon'],
  ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders', 'T1547.001 Registry Run Keys / Startup Folder'],
  ['C:\\Windows\\System32\\Tasks\\Microsoft\\Windows\\PLA\\ (new XML task)', 'T1053.005 Scheduled Task'],
  ['~/.config/autostart/*.desktop', 'T1547.013 XDG Autostart Entries'],
  ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\Notification Packages', 'T1547.005 Security Support Provider'],
  ['/etc/rc.local', 'T1037.004 RC Scripts'],
];

const persistLoc = {
  id: 'persist-loc',
  skill: 'host-persistence',
  count: 22,
  bloom: 'apply',
  make(r) {
    const [loc, tech] = r.cycle(PERSIST);
    const pool = [...new Set(PERSIST.map((p) => p[1]))].filter((t) => t !== tech);
    return {
      difficulty: tech.startsWith('T1547.001') || tech.startsWith('T1053') ? 1 : 2,
      ...mc(r, tech, closeLen(r, tech, pool, 3)),
      prompt: `A new autostart entry appears at **${loc}**. Which ATT&CK (v19) persistence technique is it?`,
      explanation: `${loc} → **${tech}**. Each autostart location maps to its own technique, which tells you what to check next: Run keys and Startup folder (T1547.001), scheduled tasks (T1053.005), services (T1543.003), cron (T1053.003), systemd units (T1543.002), WMI subscriptions (T1546.003), authorized_keys (T1098.004), shell rc files (T1546.004).`,
    };
  },
};

export default [eventMeaning, eventId, logonType, permOctal, permSymbolic, permSpecial, procParent, procPath, fsPath, persistLoc];

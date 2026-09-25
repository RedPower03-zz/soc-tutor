// SIEM investigation cases (Round 2). All data is fictional: RFC 5737 documentation IPs
// (192.0.2.x, 198.51.100.x, 203.0.113.x), private ranges, and reserved example domains
// (corp.example, *.example, example.com/.net/.org).
//
// Case schema
//   id, title, difficulty (1-3), date (shown in the header), summary
//   requires: { skills: [...] }  Level 1 skills that must be learned before the case unlocks
//   alert: { id, name, severity, time, host, user, source, detail }
//   logs: [{ id, t 'HH:MM:SS', src, host, user, type, msg }]
//         src: 'winevt' (Windows event logs) | 'process' (process creation / EDR) |
//              'firewall' | 'dns' | 'proxy' | 'idp' | 'ops' | 'email' (mail gateway) | 'sandbox'
//   key:  [{ id, label, rows: [log ids], why }]   evidence a strong analyst pins; pinning ANY
//         row of a group counts as finding it
//   related: [log ids]   relevant context: pinning these is neither rewarded nor penalised
//   verdict: 'tp' | 'fp' | 'btp'
//   parQueries: number of searches a focused analyst needs (efficiency score)
//   writeup: [{ label, any: [keywords] }]  what a good write-up mentions (case-insensitive)
//   explanation, strong: [bullets]  feedback shown after submitting
//
// Ambiguous cases add (see content/siem-ambiguous.js and js/siem.js scoreAmbiguous):
//   ambiguous: true, verdict = the preferred call
//   defensible: { tp: 1, btp: 0.75 }   verdict credit; a verdict not listed is not defensible
//   confidence: { low, medium, high }  credit for each confidence level (high is 0: overconfident)
//   gaps: [{ id, text, correct, why }]  "what can't the data tell you?" options
//   steps: { [NEXT_STEPS id]: { rating: 'best'|'ok'|'bad', why } }
//   arguments: { [verdict]: text }  why each defensible call can be argued
//   settle: [bullets]  what would settle it;  outcome: { title, verdict, text }  revealed afterwards

export const SIEM_SOURCES = {
  winevt: { label: 'Windows event logs', code: 'WIN' },
  process: { label: 'Process creation', code: 'PROC' },
  firewall: { label: 'Firewall', code: 'FW' },
  dns: { label: 'DNS', code: 'DNS' },
  proxy: { label: 'Web proxy', code: 'PRXY' },
  idp: { label: 'Cloud sign-in logs', code: 'IDP' },
  ops: { label: 'Ops & SIEM health', code: 'OPS' },
  email: { label: 'Mail gateway', code: 'MAIL' },
  sandbox: { label: 'Malware sandbox', code: 'SBX' },
  cloud: { label: 'Cloud audit logs', code: 'CLD' },
};

export const VERDICTS = {
  tp: { label: 'True positive', short: 'TP', help: 'Malicious activity, correctly detected. Escalate.' },
  btp: { label: 'Benign true positive', short: 'BTP', help: 'The detected activity really happened, but it is authorised or expected.' },
  fp: { label: 'False positive', short: 'FP', help: 'The alert is wrong: the activity it describes did not happen. Tune the rule.' },
};

// Ambiguous cases (content/siem-ambiguous.js): the confidence scale and the shared list of
// next steps. Each ambiguous case rates every next step as 'best', 'ok' (neutral) or 'bad'.
export const CONFIDENCE = {
  low: { label: 'Low', help: 'Could easily be either. I am acting on a hunch.' },
  medium: { label: 'Medium', help: 'Leaning one way, but key facts are missing.' },
  high: { label: 'High', help: 'The data proves it.' },
};

export const NEXT_STEPS = [
  { id: 'more-logs', text: 'Request the missing logs (from the host itself, the log pipeline team or the archive)' },
  { id: 'verify-user', text: 'Verify with the user or their manager through a known-good channel (phone, not email)' },
  { id: 'check-edr', text: 'Check the host in EDR: file hash, signer, creation time, process history' },
  { id: 'escalate', text: 'Escalate to Tier 2 with your confidence and the open questions stated' },
  { id: 'contain', text: 'Contain as a precaution (isolate the host or revoke sessions) while you verify' },
  { id: 'close', text: 'Close the alert: nothing proves it is malicious' },
  { id: 'wait', text: 'Leave it open and see whether it happens again' },
  { id: 'reimage', text: 'Wipe and reimage the host straight away' },
];

export const SIEM_CASES = [
  // ------------------------------------------------------------------ 1
  {
    id: 'siem-rdp-brute',
    title: 'Night-time logon storm',
    difficulty: 1,
    date: 'Mon 14 Sep 2026',
    summary: 'A burst of failed administrator logons on a file server, then a success.',
    requires: { skills: ['host-logs', 'net-ports'] },
    alert: {
      id: 'ALRT-1042',
      name: 'Multiple failed logons followed by success',
      severity: 'high',
      time: '03:14:52',
      host: 'SRV-FILE01',
      user: 'administrator',
      source: '203.0.113.45',
      detail: '8 failed logons for "administrator" on SRV-FILE01 within 13 minutes, followed by a successful logon.',
    },
    logs: [
      { id: 'b01', t: '02:58:10', src: 'winevt', host: 'SRV-FILE01', user: 'svc_backup', type: 'Security 4624', msg: 'An account was successfully logged on. Account: svc_backup  Logon Type: 3  Source: 10.10.20.30 (SRV-BKP01)' },
      { id: 'b02', t: '03:01:58', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 203.0.113.45:51022 -> 10.10.20.15:3389 rule=legacy-rdp-nat' },
      { id: 'b03', t: '03:02:04', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45  Failure: unknown user name or bad password' },
      { id: 'b04', t: '03:03:41', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b05', t: '03:04:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'DENY', msg: 'DENY TCP 198.51.100.200:40112 -> 10.10.20.15:23 rule=default-deny' },
      { id: 'b06', t: '03:05:19', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b07', t: '03:07:30', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b08', t: '03:08:12', src: 'dns', host: 'WS-04', user: '', type: 'Query A', msg: 'WS-04 (10.10.40.14) query A update.example.com -> 192.0.2.80' },
      { id: 'b09', t: '03:09:44', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b10', t: '03:11:05', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b11', t: '03:12:38', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b12', t: '03:14:10', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Logon Process: NtLmSsp  Source: 203.0.113.45' },
      { id: 'b20', t: '03:14:51', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'RDP 1149', msg: 'TerminalServices-RemoteConnectionManager 1149: Remote Desktop Services: User authentication succeeded. User: administrator  Source Network Address: 203.0.113.45' },
      { id: 'b13', t: '03:14:52', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4624', msg: 'An account was successfully logged on. Account: administrator  Logon Type: 10  Source: 203.0.113.45' },
      { id: 'b14', t: '03:14:53', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4672', msg: 'Special privileges assigned to new logon. Account: administrator  Privileges: SeDebugPrivilege, SeBackupPrivilege, ...' },
      { id: 'b15', t: '03:15:20', src: 'proxy', host: 'WS-04', user: 'lee', type: 'GET 200', msg: 'lee WS-04 GET https://news.example.org/today 200 text/html' },
      { id: 'b16', t: '03:16:40', src: 'process', host: 'SRV-FILE01', user: 'administrator', type: 'Process create', msg: 'explorer.exe > cmd.exe > net.exe  CommandLine: net user svc_backup2 P@ssw0rd! /add' },
      { id: 'b17', t: '03:16:41', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4720', msg: 'A user account was created. New account: svc_backup2  Created by: administrator' },
      { id: 'b18', t: '03:16:55', src: 'winevt', host: 'SRV-FILE01', user: 'administrator', type: 'Security 4732', msg: 'A member was added to a security-enabled local group. Member: svc_backup2  Group: Administrators  By: administrator' },
      { id: 'b19', t: '03:20:02', src: 'winevt', host: 'SRV-FILE01', user: 'svc_backup', type: 'Security 4634', msg: 'An account was logged off. Account: svc_backup  Logon Type: 3' },
    ],
    key: [
      { id: 'k-fail', label: 'Repeated 4625 RDP failures from 203.0.113.45', rows: ['b03', 'b04', 'b06', 'b07', 'b09', 'b10', 'b11', 'b12'], why: 'Eight failed logons for one account from one external IP in about 12 minutes is a password-guessing pattern. They are Logon Type 3 (NtLmSsp) because Network Level Authentication checks RDP passwords over the network before any session exists, and the firewall shows the traffic going to 3389.' },
      { id: 'k-success', label: 'RDP authentication (1149) and 4624 Type 10 success from the same IP', rows: ['b20', 'b13'], why: 'Event 1149 records a successful RDP authentication and the 4624 Logon Type 10 (RemoteInteractive) is the desktop session, from the same external IP straight after the failures: the guessing worked.' },
      { id: 'k-newuser', label: 'New account svc_backup2 created (4720)', rows: ['b16', 'b17'], why: 'Creating an account right after an unexpected admin logon is classic persistence.' },
      { id: 'k-admins', label: 'svc_backup2 added to Administrators (4732)', rows: ['b18'], why: 'The attacker gave the new account admin rights so it survives a password reset of "administrator".' },
    ],
    related: ['b02', 'b14'],
    verdict: 'tp',
    parQueries: 4,
    writeup: [
      { label: 'Names the attacking IP', any: ['203.0.113.45'] },
      { label: 'Describes the failed-then-successful RDP logons', any: ['4625', 'failed', 'brute', 'guess'] },
      { label: 'Mentions the successful logon', any: ['4624', '1149', 'success', 'logged on'] },
      { label: 'Mentions the new admin account', any: ['svc_backup2', '4720', 'new account', 'created'] },
    ],
    explanation:
      'True positive. An external address guessed the administrator password over RDP (3389 was exposed through a legacy NAT rule), logged on, and immediately created a new local admin account for persistence.',
    strong: [
      'Filter to the alert host and user first, then pivot on the source IP 203.0.113.45: every event from it tells one story.',
      'Read the logon types correctly: the failures are type 3 because Network Level Authentication (the default) checks the password before an RDP session exists; the success shows as 1149 plus 4624 type 10 (RemoteInteractive). Combined with the firewall ALLOW to 3389 from the internet, the entry point is clear. A rule that only counts "4625 type 10" would have missed this.',
      'Look at what happened after the success: 4672 (admin privileges), a process creating a user, then 4720 and 4732.',
      'Ignore the noise: the svc_backup logons come from the internal backup server and the Telnet DENY is unrelated internet scanning.',
      'Escalate with containment advice: isolate SRV-FILE01, disable administrator and svc_backup2, block 203.0.113.45, and remove the exposed RDP rule.',
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    id: 'siem-sccm-powershell',
    title: 'Encoded PowerShell as SYSTEM',
    difficulty: 1,
    date: 'Tue 15 Sep 2026',
    summary: 'The EDR flags a hidden, encoded PowerShell command on an HR laptop.',
    requires: { skills: ['host-processes'] },
    alert: {
      id: 'ALRT-2117',
      name: 'Encoded PowerShell command executed',
      severity: 'medium',
      time: '10:02:14',
      host: 'WS-HR-12',
      user: 'SYSTEM',
      source: 'EDR',
      detail: 'powershell.exe started with -EncodedCommand and -ExecutionPolicy Bypass on WS-HR-12.',
    },
    logs: [
      { id: 's01', t: '09:58:31', src: 'winevt', host: 'WS-HR-12', user: 'amara', type: 'Security 4624', msg: 'An account was successfully logged on. Account: amara  Logon Type: 2 (interactive)' },
      { id: 's02', t: '10:01:58', src: 'process', host: 'WS-IT-01', user: 'SYSTEM', type: 'Process create', msg: 'services.exe > CcmExec.exe > powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFAAcgBvAGQAdQBjAHQA...' },
      { id: 's03', t: '10:02:09', src: 'process', host: 'WS-HR-07', user: 'SYSTEM', type: 'Process create', msg: 'services.exe > CcmExec.exe > powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFAAcgBvAGQAdQBjAHQA...' },
      { id: 's04', t: '10:02:12', src: 'dns', host: 'WS-HR-12', user: '', type: 'Query A', msg: 'WS-HR-12 (10.10.50.62) query A sccm01.corp.example -> 10.10.1.20' },
      { id: 's05', t: '10:02:14', src: 'process', host: 'WS-HR-12', user: 'SYSTEM', type: 'Process create', msg: 'services.exe > C:\\Windows\\CCM\\CcmExec.exe (signed: Microsoft Corporation) > powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFAAcgBvAGQAdQBjAHQA...' },
      { id: 's06', t: '10:02:14', src: 'winevt', host: 'WS-HR-12', user: 'SYSTEM', type: 'PowerShell 4104', msg: 'Script block logged (decoded): Get-WmiObject Win32_Product | Select-Object Name,Version | Export-Csv C:\\Windows\\CCM\\Inventory\\apps.csv' },
      { id: 's07', t: '10:02:15', src: 'proxy', host: 'WS-HR-12', user: 'SYSTEM', type: 'GET 200', msg: 'WS-HR-12 GET http://sccm01.corp.example/SMS_MP/.sms_aut?MPLIST 200 user-agent=SMS CCM 5.0' },
      { id: 's08', t: '10:02:16', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.50.62:52211 -> 10.10.1.20:80 rule=clients-to-sccm' },
      { id: 's09', t: '10:02:21', src: 'process', host: 'WS-FIN-03', user: 'SYSTEM', type: 'Process create', msg: 'services.exe > CcmExec.exe > powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFAAcgBvAGQAdQBjAHQA...' },
      { id: 's10', t: '10:03:40', src: 'proxy', host: 'WS-HR-12', user: 'amara', type: 'GET 200', msg: 'amara WS-HR-12 GET https://hr-portal.corp.example/leave 200' },
      { id: 's11', t: '10:04:05', src: 'dns', host: 'WS-HR-12', user: '', type: 'Query A', msg: 'WS-HR-12 (10.10.50.62) query A hr-portal.corp.example -> 10.10.1.45' },
      { id: 's12', t: '10:05:12', src: 'winevt', host: 'SCCM01', user: 'svc_sccm', type: 'App log', msg: 'Configuration Manager: deployment "Weekly software inventory" (ID INV-0042) started on collection "All Workstations" (412 devices)' },
      { id: 's13', t: '10:06:30', src: 'proxy', host: 'WS-HR-12', user: 'amara', type: 'GET 200', msg: 'amara WS-HR-12 GET https://www.example.com/benefits-guide.pdf 200 application/pdf' },
    ],
    key: [
      { id: 'k-parent', label: 'Parent is the signed SCCM agent CcmExec.exe', rows: ['s05'], why: 'powershell.exe was started by C:\\Windows\\CCM\\CcmExec.exe, the Microsoft-signed Configuration Manager client, running as a service.' },
      { id: 'k-decoded', label: 'Decoded script is a software inventory', rows: ['s06'], why: 'Script block logging (PowerShell 4104) shows what the encoded command really did: list installed software and save it in the CCM folder.' },
      { id: 'k-fleet', label: 'Identical command on other hosts at the same time', rows: ['s02', 's03', 's09', 's12'], why: 'The same command ran across the fleet within seconds, matching a scheduled SCCM inventory deployment.' },
    ],
    related: ['s04', 's07', 's08'],
    verdict: 'btp',
    parQueries: 4,
    writeup: [
      { label: 'Identifies the SCCM parent', any: ['ccmexec', 'sccm', 'configuration manager'] },
      { label: 'Uses the decoded script', any: ['4104', 'decoded', 'script block', 'inventory', 'win32_product'] },
      { label: 'Notes it ran fleet-wide', any: ['other hosts', 'fleet', 'same command', 'multiple hosts', 'all workstations', 'ws-hr-07', 'ws-fin-03'] },
      { label: 'Calls it authorised', any: ['benign', 'authorised', 'authorized', 'legitimate', 'expected', 'scheduled'] },
    ],
    explanation:
      'Benign true positive. The detection was right, encoded PowerShell really ran, but it was the scheduled Configuration Manager software inventory: a signed agent parent, a harmless decoded script, and the same job on the whole fleet.',
    strong: [
      'Always check the parent: CcmExec.exe under services.exe is the SCCM client, not Word, a browser or a user shell.',
      'Encoded does not mean malicious. Script block logging (PowerShell 4104) gives you the decoded content, so read it.',
      'Search the command line across all hosts: a malicious one-off lands on one or two machines, a management job lands everywhere at once.',
      'Close as benign true positive, and suggest an exclusion for CcmExec-spawned inventory scripts so the queue stays clean.',
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    id: 'siem-certutil',
    title: 'certutil and a URL',
    difficulty: 2,
    date: 'Wed 16 Sep 2026',
    summary: 'A LOLBin detection fires on a developer laptop. Did certutil really download something?',
    requires: { skills: ['host-processes', 'net-http'] },
    alert: {
      id: 'ALRT-2290',
      name: 'Suspicious certutil usage: possible file download',
      severity: 'medium',
      time: '14:21:07',
      host: 'WS-DEV-05',
      user: 'priya',
      source: 'EDR rule LOLBIN-CERTUTIL-HTTP',
      detail: 'Rule logic: process = certutil.exe AND command line contains "http".',
    },
    logs: [
      { id: 'c01', t: '14:12:40', src: 'winevt', host: 'WS-DEV-05', user: 'priya', type: 'Security 4624', msg: 'An account was successfully logged on. Account: priya  Logon Type: 7 (unlock)' },
      { id: 'c02', t: '14:17:55', src: 'dns', host: 'WS-DEV-05', user: '', type: 'Query A', msg: 'WS-DEV-05 (10.10.60.25) query A downloads.toolvendor.example -> 203.0.113.80' },
      { id: 'c03', t: '14:18:02', src: 'proxy', host: 'WS-DEV-05', user: 'priya', type: 'GET 200', msg: 'priya WS-DEV-05 GET https://downloads.toolvendor.example/http-toolkit-setup-1.14.exe 200 application/octet-stream 92.4MB user-agent=Chrome/128' },
      { id: 'c04', t: '14:18:40', src: 'proxy', host: 'WS-DEV-05', user: 'priya', type: 'GET 200', msg: 'priya WS-DEV-05 GET https://downloads.toolvendor.example/http-toolkit-1.14-SHA256SUMS.txt 200 text/plain user-agent=Chrome/128' },
      { id: 'c05', t: '14:20:31', src: 'process', host: 'WS-DEV-05', user: 'priya', type: 'Process create', msg: 'explorer.exe > WindowsTerminal.exe > powershell.exe (interactive, user priya)' },
      { id: 'c06', t: '14:21:07', src: 'process', host: 'WS-DEV-05', user: 'priya', type: 'Process create', msg: 'powershell.exe > certutil.exe -hashfile "C:\\Users\\priya\\Downloads\\http-toolkit-setup-1.14.exe" SHA256' },
      { id: 'c07', t: '14:21:08', src: 'process', host: 'WS-DEV-05', user: 'priya', type: 'Process exit', msg: 'certutil.exe exited (code 0). Network connections: none. Files written: none.' },
      { id: 'c08', t: '14:21:30', src: 'process', host: 'WS-DEV-05', user: 'priya', type: 'Network conn', msg: 'chrome.exe -> 203.0.113.80:443 (downloads.toolvendor.example)' },
      { id: 'c09', t: '14:22:10', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.60.25:53320 -> 203.0.113.80:443 rule=web-out' },
      { id: 'c10', t: '14:23:45', src: 'process', host: 'WS-DEV-05', user: 'priya', type: 'Process create', msg: 'explorer.exe > http-toolkit-setup-1.14.exe (signed: ToolVendor Ltd)' },
      { id: 'c11', t: '14:25:02', src: 'winevt', host: 'SRV-DC01', user: 'priya', type: 'Security 4768', msg: 'A Kerberos authentication ticket (TGT) was requested. Account: priya  Client: 10.10.60.25' },
      { id: 'c12', t: '14:26:19', src: 'proxy', host: 'WS-DEV-05', user: 'priya', type: 'GET 200', msg: 'priya WS-DEV-05 GET https://docs.example.net/http-toolkit/getting-started 200 text/html' },
    ],
    key: [
      { id: 'k-cmd', label: 'certutil ran -hashfile, not a download', rows: ['c06'], why: 'The command line is certutil -hashfile <file> SHA256: it computes a hash. A download would use -urlcache (-split) -f <URL>. The rule matched "http" inside the file name.' },
      { id: 'k-nonet', label: 'certutil made no network connections', rows: ['c07'], why: 'The EDR shows certutil exited with no connections and wrote no files, so the "download" never happened.' },
      { id: 'k-sums', label: 'She fetched the vendor checksum file first', rows: ['c04'], why: 'Downloading the SHA256SUMS file and then hashing the installer is a user verifying a download: good security hygiene.' },
    ],
    related: ['c03', 'c05', 'c08', 'c10'],
    verdict: 'fp',
    parQueries: 4,
    writeup: [
      { label: 'Explains -hashfile vs a download', any: ['hashfile', 'hash', 'checksum'] },
      { label: 'Notes "http" is in the file name', any: ['file name', 'filename', 'http-toolkit', 'name of the file'] },
      { label: 'Confirms no network activity', any: ['no network', 'no connection', 'no download', 'did not connect', "didn't connect", 'none'] },
      { label: 'Suggests tuning the rule', any: ['tune', 'tuning', 'urlcache', 'rule'] },
    ],
    explanation:
      'False positive. The rule looked for certutil plus the string "http", and the string was part of a file name. certutil only calculated a SHA-256 hash of an installer the user had downloaded with Chrome, and it made no connections.',
    strong: [
      'Read the full command line before anything else: -hashfile is harmless, -urlcache -split -f http… is the download trick attackers use.',
      'Check the rule logic in the alert. "Contains http" matches file names, so expect false positives.',
      'Confirm with process network activity: certutil made no connections, and the only download was chrome.exe fetching a signed installer.',
      'Close as false positive and recommend tuning the rule to match -urlcache or -verifyctl together with a URL.',
    ],
  },

  // ------------------------------------------------------------------ 4
  {
    id: 'siem-scanner',
    title: 'Internal port scan',
    difficulty: 2,
    date: 'Tue 22 Sep 2026',
    summary: 'The firewall reports an internal host hitting dozens of ports across the server subnet.',
    requires: { skills: ['net-ip', 'net-subnet', 'net-fw-logs'] },
    alert: {
      id: 'ALRT-2455',
      name: 'Internal host scanning many ports',
      severity: 'high',
      time: '11:02:30',
      host: '10.10.5.50',
      user: '',
      source: 'Firewall analytics',
      detail: '10.10.5.50 attempted connections to 60+ distinct ports on 14 hosts in 10.10.20.0/24 within 3 minutes.',
    },
    logs: [
      { id: 'p01', t: '10:59:58', src: 'process', host: 'VULNSCAN01', user: 'nessus', type: 'Process create', msg: 'systemd > /opt/nessus/sbin/nessusd --scan "Weekly internal - servers" --policy basic-network --targets 10.10.20.0/24' },
      { id: 'p02', t: '11:00:03', src: 'dns', host: 'VULNSCAN01', user: '', type: 'Query PTR', msg: 'VULNSCAN01 (10.10.5.50) query PTR 11.20.10.10.in-addr.arpa -> srv-app01.corp.example' },
      { id: 'p03', t: '11:00:05', src: 'firewall', host: 'FW-CORE', user: '', type: 'DENY', msg: 'DENY TCP 10.10.5.50:41001 -> 10.10.20.11:21 rule=servers-default' },
      { id: 'p04', t: '11:00:05', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.5.50:41002 -> 10.10.20.11:22 rule=scanner-to-servers' },
      { id: 'p05', t: '11:00:06', src: 'firewall', host: 'FW-CORE', user: '', type: 'DENY', msg: 'DENY TCP 10.10.5.50:41003 -> 10.10.20.11:23 rule=servers-default' },
      { id: 'p06', t: '11:00:06', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.5.50:41010 -> 10.10.20.11:443 rule=scanner-to-servers' },
      { id: 'p07', t: '11:01:12', src: 'firewall', host: 'FW-CORE', user: '', type: 'DENY', msg: 'DENY TCP 10.10.5.50:41377 -> 10.10.20.15:3389 rule=servers-default' },
      { id: 'p08', t: '11:01:40', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.5.50:41522 -> 10.10.20.15:445 rule=scanner-to-servers' },
      { id: 'p09', t: '11:02:30', src: 'dns', host: 'SRV-DC01', user: '', type: 'Query PTR', msg: 'SOC-WS-02 (10.10.9.12) query PTR 50.5.10.10.in-addr.arpa -> vulnscan01.corp.example' },
      { id: 'p10', t: '11:02:31', src: 'firewall', host: 'FW-CORE', user: '', type: 'DENY', msg: 'DENY TCP 10.10.5.50:42040 -> 10.10.20.40:8080 rule=servers-default' },
      { id: 'p11', t: '11:03:10', src: 'winevt', host: 'SRV-APP01', user: 'svc_scan', type: 'Security 4624', msg: 'An account was successfully logged on. Account: svc_scan  Logon Type: 3  Source: 10.10.5.50 (credentialed patch check)' },
      { id: 'p12', t: '11:03:44', src: 'firewall', host: 'FW-EDGE', user: '', type: 'DENY', msg: 'DENY TCP 192.0.2.77:50110 -> 10.10.20.15:22 rule=default-deny' },
      { id: 'p13', t: '11:04:20', src: 'proxy', host: 'VULNSCAN01', user: 'nessus', type: 'GET 200', msg: 'VULNSCAN01 GET https://plugins.scanvendor.example/feed/latest 200 (plugin update)' },
      { id: 'p14', t: '11:05:02', src: 'firewall', host: 'FW-CORE', user: '', type: 'DENY', msg: 'DENY TCP 10.10.40.14:51544 -> 10.10.20.11:22 rule=servers-default' },
    ],
    key: [
      { id: 'k-ptr', label: '10.10.5.50 is vulnscan01 (PTR record)', rows: ['p09'], why: 'The reverse lookup names the source: vulnscan01.corp.example, the vulnerability scanner.' },
      { id: 'k-job', label: 'Scheduled Nessus scan job on VULNSCAN01', rows: ['p01'], why: 'nessusd started a named, scheduled scan ("Weekly internal - servers") with 10.10.20.0/24 as its targets, at the start of the burst.' },
      { id: 'k-scope', label: 'Targets stay inside the scanner scope (10.10.20.0/24)', rows: ['p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p10'], why: 'Every scanned destination is in 10.10.20.0/24 (hosts .1 to .254), exactly the job target, and a dedicated rule allows scanner traffic.' },
    ],
    related: ['p11', 'p13'],
    verdict: 'btp',
    parQueries: 4,
    writeup: [
      { label: 'Identifies the scanner', any: ['vulnscan01', 'scanner', 'nessus', 'vulnerability scan'] },
      { label: 'Uses the reverse DNS', any: ['ptr', 'reverse'] },
      { label: 'Notes the targets match the job scope', any: ['10.10.20.0/24', 'server subnet', 'servers', 'scope', 'targets'] },
      { label: 'Calls it authorised', any: ['authorised', 'authorized', 'scheduled', 'expected', 'benign', 'weekly'] },
    ],
    explanation:
      'Benign true positive. A port scan really happened, but it came from the company vulnerability scanner running its scheduled weekly job against the server subnet it is meant to scan.',
    strong: [
      'Identify the source before judging the behaviour: a PTR lookup or asset list turns "10.10.5.50" into "vulnscan01".',
      'Match the scan to its job: nessusd started "Weekly internal - servers" seconds before the first DENY, and the targets are 10.10.20.0/24.',
      'Check the scope. Everything stays inside 10.10.20.0/24; scanning outside the scope, or a workstation scanning, would be a real concern.',
      'Separate unrelated events: the DENY from 192.0.2.77 is internet noise, and the 10.10.40.14 to :22 deny is a different host worth a look on its own.',
      'Close as benign true positive and suggest suppressing this alert for the scanner during its maintenance window.',
    ],
  },

  // ------------------------------------------------------------------ 5
  {
    id: 'siem-beacon',
    title: 'Every sixty seconds',
    difficulty: 3,
    date: 'Thu 24 Sep 2026',
    summary: 'Network analytics spot a marketing laptop calling out on a perfect rhythm.',
    requires: { skills: ['net-dns', 'net-http', 'net-fw-logs', 'host-processes'] },
    alert: {
      id: 'ALRT-2531',
      name: 'Periodic outbound connections (possible beaconing)',
      severity: 'high',
      time: '16:40:00',
      host: 'WS-MKT-09',
      user: 'jordan',
      source: 'Network analytics',
      detail: '10.10.30.41 connected to 198.51.100.23:443 every 60 s (±2 s) for 10 minutes with near-identical byte counts.',
    },
    logs: [
      { id: 'n01', t: '16:21:14', src: 'proxy', host: 'WS-MKT-09', user: 'jordan', type: 'GET 200', msg: 'jordan WS-MKT-09 GET https://mail.corp.example/owa/attachment/Q3-campaign-brief.docm 200 application/vnd.ms-word.document.macroEnabled.12' },
      { id: 'n02', t: '16:29:40', src: 'process', host: 'WS-MKT-09', user: 'jordan', type: 'Process create', msg: 'explorer.exe > WINWORD.EXE "Q3-campaign-brief.docm" > rundll32.exe C:\\Users\\jordan\\AppData\\Roaming\\msupd.dll,Start' },
      { id: 'n03', t: '16:30:58', src: 'dns', host: 'WS-MKT-09', user: '', type: 'Query A', msg: 'WS-MKT-09 (10.10.30.41) query A update.micr0soft-cdn.example -> 198.51.100.23 (domain first seen today)' },
      { id: 'n04', t: '16:31:02', src: 'process', host: 'WS-MKT-09', user: 'jordan', type: 'Network conn', msg: 'rundll32.exe (PID 7312) -> 198.51.100.23:443' },
      { id: 'n05', t: '16:31:02', src: 'proxy', host: 'WS-MKT-09', user: 'jordan', type: 'POST 200', msg: 'jordan WS-MKT-09 POST https://update.micr0soft-cdn.example/api/v2/ping 200 req=412B resp=96B category=Uncategorized user-agent="Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)"' },
      { id: 'n06', t: '16:31:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50311 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n07', t: '16:32:03', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50318 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n08', t: '16:32:40', src: 'dns', host: 'WS-MKT-02', user: '', type: 'Query A', msg: 'WS-MKT-02 (10.10.30.12) query A cdn.example.net -> 192.0.2.10' },
      { id: 'n09', t: '16:33:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50327 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n10', t: '16:33:15', src: 'proxy', host: 'WS-MKT-02', user: 'sam', type: 'GET 200', msg: 'sam WS-MKT-02 GET https://cdn.example.net/brand/logo-pack.zip 200 application/zip' },
      { id: 'n11', t: '16:34:03', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50335 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n12', t: '16:34:20', src: 'process', host: 'WS-MKT-09', user: 'jordan', type: 'Process create', msg: 'rundll32.exe > reg.exe add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v MSUpdate /d "rundll32.exe C:\\Users\\jordan\\AppData\\Roaming\\msupd.dll,Start"' },
      { id: 'n13', t: '16:35:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50342 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n14', t: '16:36:10', src: 'winevt', host: 'WS-MKT-09', user: 'jordan', type: 'Security 4624', msg: 'An account was successfully logged on. Account: jordan  Logon Type: 7 (unlock)' },
      { id: 'n15', t: '16:36:44', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.12:49920 -> 192.0.2.10:443 bytes_out=1840 bytes_in=5120334 rule=web-out' },
      { id: 'n16', t: '16:38:30', src: 'dns', host: 'WS-MKT-09', user: '', type: 'Query A', msg: 'WS-MKT-09 (10.10.30.41) query A intranet.corp.example -> 10.10.1.30' },
      { id: 'n17', t: '16:36:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50351 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n18', t: '16:37:03', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50360 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n19', t: '16:38:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50366 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n20', t: '16:39:03', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50374 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
      { id: 'n21', t: '16:40:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.30.41:50381 -> 198.51.100.23:443 bytes_out=412 bytes_in=96 rule=web-out' },
    ],
    key: [
      { id: 'k-beacon', label: 'Regular 60 s connections, identical sizes', rows: ['n06', 'n07', 'n09', 'n11', 'n13', 'n17', 'n18', 'n19', 'n20', 'n21'], why: 'Connections every ~60 s with exactly 412 bytes out and 96 in are machine-driven check-ins, not a person browsing.' },
      { id: 'k-domain', label: 'Look-alike domain resolving to the beacon IP', rows: ['n03', 'n05'], why: 'update.micr0soft-cdn.example (zero instead of o), first seen today, resolves to 198.51.100.23. The proxy shows an outdated MSIE 6 user agent and an uncategorised site.' },
      { id: 'k-proc', label: 'rundll32 from Word opened the connection', rows: ['n02', 'n04'], why: 'WINWORD.EXE started rundll32.exe loading a DLL from AppData, and that rundll32 process is the one talking to 198.51.100.23.' },
      { id: 'k-persist', label: 'Run key added for persistence', rows: ['n12'], why: 'rundll32 wrote an HKCU Run key so the DLL starts at every logon.' },
    ],
    related: ['n01'],
    verdict: 'tp',
    parQueries: 5,
    writeup: [
      { label: 'Names the C2 IP or domain', any: ['198.51.100.23', 'micr0soft'] },
      { label: 'Describes the beacon pattern', any: ['60', 'interval', 'regular', 'periodic', 'beacon'] },
      { label: 'Names the process', any: ['rundll32', 'msupd'] },
      { label: 'Mentions the delivery or persistence', any: ['docm', 'macro', 'word', 'run key', 'persistence'] },
    ],
    explanation:
      'True positive. A macro document from email started rundll32 with a DLL in AppData, which beacons every 60 seconds to a look-alike domain and set a Run key to survive reboots. This is command-and-control on WS-MKT-09.',
    strong: [
      'Confirm the rhythm in the firewall log: same destination, a 60-second interval, identical byte counts.',
      'Pivot on the IP to DNS: which name resolved to 198.51.100.23? A look-alike, first-seen domain is a strong signal.',
      'Pivot to the host to find the process: the network connection event names rundll32.exe, and its parent is Word.',
      'Follow the story backwards (the .docm from email) and forwards (the Run key for persistence).',
      'Escalate: isolate WS-MKT-09, block the domain and IP, collect msupd.dll, and hunt for the same domain on other hosts.',
    ],
  },
];

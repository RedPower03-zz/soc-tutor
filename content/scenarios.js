// Scenario / stage content type (Operations panel on the dashboard).
//
// A scenario is a multi-stage exercise built on top of lessons and the question bank:
//   id, kind ('mixed' | 'investigation' | 'capstone'), title, summary
//   status      'available' | 'in-development'
//   stages: [{
//     id, title, summary,
//     requires: { lessons: [skill ids whose lessons must be completed (or placed out of)] },
//     brief: 'narrative shown at the top of the stage',
//     evidence: { label, rows: [{ id, t, src, host, user, type, msg }] },   // same row format as SIEM logs
//     questions: [{ id, type: 'mc' | 'multi', prompt, choices, answer, explanation }],
//   }]
//   escalation (capstones): structured report scored with a rubric, see FIRST_SHIFT below.
// Stages unlock in order, and only when their required lessons are done.
// Investigation cases live in content/siem-cases.js.

const FIRST_SHIFT = {
  id: 'first-shift',
  kind: 'capstone',
  title: 'First shift as a Tier 1 analyst',
  summary: 'One alert, one continuous incident: firewall, DNS, a process tree and logon events, then your escalation to Tier 2.',
  status: 'available',
  date: 'Fri 25 Sep 2026',
  intro:
    'It is 07:00 and you have just taken over the queue. The night shift handover says "quiet night, nothing open". At 07:12 an alert lands: outbound connections from a finance workstation to a newly registered domain. Work it stage by stage.',
  alert: {
    id: 'ALRT-3001',
    name: 'Outbound connection to newly registered domain',
    severity: 'medium',
    time: '07:12:00',
    host: 'WS-FIN-07',
    user: 'dana',
    source: 'Proxy / threat intel',
  },
  stages: [
    {
      id: 'fs-1',
      title: 'The alert and the firewall',
      summary: 'Who is talking to whom, and how often?',
      requires: { lessons: ['net-ports', 'net-fw-logs'] },
      brief: 'Start with the edge firewall log for the alerting workstation WS-FIN-07 (10.10.4.27).',
      evidence: {
        label: 'FW-EDGE · 07:04–07:12',
        rows: [
          { id: 'f1', t: '07:05:12', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.4.27:51544 -> 198.51.100.77:443 bytes_out=388 bytes_in=120' },
          { id: 'f2', t: '07:06:40', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW UDP 10.10.4.27:61012 -> 10.10.1.10:53' },
          { id: 'f3', t: '07:07:12', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.4.27:51560 -> 198.51.100.77:443 bytes_out=388 bytes_in=120' },
          { id: 'f4', t: '07:08:02', src: 'firewall', host: 'FW-EDGE', user: '', type: 'DENY', msg: 'DENY TCP 203.0.113.9:44120 -> 10.10.4.27:445 rule=default-deny' },
          { id: 'f5', t: '07:09:13', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.4.27:51577 -> 198.51.100.77:443 bytes_out=388 bytes_in=120' },
          { id: 'f6', t: '07:10:30', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.4.27:51590 -> 10.10.1.45:443 rule=clients-to-intranet' },
          { id: 'f7', t: '07:11:12', src: 'firewall', host: 'FW-EDGE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.10.4.27:51602 -> 198.51.100.77:443 bytes_out=388 bytes_in=120' },
        ],
      },
      questions: [
        {
          id: 'fs1-q1',
          type: 'mc',
          prompt: 'Which internal host is making the suspicious connections?',
          choices: ['10.10.4.27 (WS-FIN-07)', '198.51.100.77', '203.0.113.9', '10.10.1.10'],
          answer: '10.10.4.27 (WS-FIN-07)',
          explanation: 'In "ALLOW TCP 10.10.4.27:51544 -> 198.51.100.77:443" the left side is the source. The workstation opens the connections; 198.51.100.77 is the external destination.',
        },
        {
          id: 'fs1-q2',
          type: 'mc',
          prompt: 'What stands out about the traffic to 198.51.100.77?',
          choices: [
            'Outbound to 443 every 2 minutes with identical byte counts: it looks automated',
            'It was denied by the firewall, so it is harmless',
            'It is inbound traffic from the internet',
            'Port 443 is HTTPS, so it must be safe',
          ],
          answer: 'Outbound to 443 every 2 minutes with identical byte counts: it looks automated',
          explanation: 'A fixed interval (07:05, 07:07, 07:09, 07:11) and the same 388/120 bytes each time is what a check-in (beacon) looks like. HTTPS hides the content, not the pattern.',
        },
        {
          id: 'fs1-q3',
          type: 'mc',
          prompt: 'How should you treat the DENY from 203.0.113.9 to port 445?',
          choices: [
            'Blocked internet background noise: note it, but it is not part of this alert',
            'It is the attacker\'s command-and-control channel',
            'It proves WS-FIN-07 is infected',
            'It means SMB is open to the internet',
          ],
          answer: 'Blocked internet background noise: note it, but it is not part of this alert',
          explanation: 'Inbound SMB probes from the internet are constant and this one was denied. Chasing it would pull you away from the real lead: the outbound beacon.',
        },
      ],
    },
    {
      id: 'fs-2',
      title: 'DNS',
      summary: 'What name is behind the IP?',
      requires: { lessons: ['net-dns'] },
      brief: 'Pivot on 198.51.100.77. The internal resolver (10.10.1.10) logs every lookup.',
      evidence: {
        label: 'DNS resolver 10.10.1.10 · WS-FIN-07 and neighbours',
        rows: [
          { id: 'd1', t: '06:54:55', src: 'dns', host: 'WS-FIN-07', user: '', type: 'Query A', msg: 'WS-FIN-07 (10.10.4.27) query A mail.corp.example -> 10.10.1.25' },
          { id: 'd2', t: '06:58:03', src: 'dns', host: 'WS-FIN-07', user: '', type: 'Query A', msg: 'WS-FIN-07 (10.10.4.27) query A invoices.northwind-billing.example -> 198.51.100.77 (domain registered 2 days ago, first seen in the company today)' },
          { id: 'd3', t: '07:05:10', src: 'dns', host: 'WS-FIN-07', user: '', type: 'Query A', msg: 'WS-FIN-07 (10.10.4.27) query A invoices.northwind-billing.example -> 198.51.100.77' },
          { id: 'd4', t: '07:05:30', src: 'dns', host: 'WS-FIN-07', user: '', type: 'Query A', msg: 'WS-FIN-07 (10.10.4.27) query A intranet.corp.example -> 10.10.1.45' },
          { id: 'd5', t: '07:06:00', src: 'dns', host: 'WS-HR-03', user: '', type: 'Query A', msg: 'WS-HR-03 (10.10.4.61) query A www.example.com -> 192.0.2.10' },
          { id: 'd6', t: '07:06:15', src: 'dns', host: 'SOC-WS-02', user: '', type: 'Query PTR', msg: 'SOC-WS-02 (10.10.9.12) query PTR 77.100.51.198.in-addr.arpa -> NXDOMAIN (no reverse record)' },
        ],
      },
      questions: [
        {
          id: 'fs2-q1',
          type: 'mc',
          prompt: 'Which domain resolves to the beacon destination 198.51.100.77?',
          choices: ['invoices.northwind-billing.example', 'mail.corp.example', 'intranet.corp.example', 'www.example.com'],
          answer: 'invoices.northwind-billing.example',
          explanation: 'The A record answer for invoices.northwind-billing.example is 198.51.100.77, the IP from the firewall log.',
        },
        {
          id: 'fs2-q2',
          type: 'mc',
          prompt: 'What makes that domain suspicious?',
          choices: [
            'Registered two days ago, first seen today, not a company domain, and looked up just before the connections began',
            'It was looked up with an A record',
            'It was resolved over UDP port 53',
            'It has more than two labels',
          ],
          answer: 'Registered two days ago, first seen today, not a company domain, and looked up just before the connections began',
          explanation: 'A records, UDP 53 and multi-label names are all normal. Newness and timing are what matter: brand-new domains are a favourite of phishing and malware operators.',
        },
        {
          id: 'fs2-q3',
          type: 'multi',
          prompt: 'Which of these should go in the ticket as indicators of compromise (IOCs)? Select all that apply.',
          choices: ['invoices.northwind-billing.example', '198.51.100.77', '10.10.1.10 (internal DNS resolver)', 'mail.corp.example'],
          answer: ['invoices.northwind-billing.example', '198.51.100.77'],
          explanation: 'The malicious domain and its IP are the IOCs. The resolver and the mail server are your own infrastructure: blocking them would break the company.',
        },
      ],
    },
    {
      id: 'fs-3',
      title: 'The process tree',
      summary: 'Which program is calling out, and how did it get there?',
      requires: { lessons: ['host-processes', 'host-persistence'] },
      brief: 'The EDR on WS-FIN-07 records process creation, files and network connections. Find the process behind the beacon.',
      evidence: {
        label: 'EDR · WS-FIN-07 (user dana)',
        rows: [
          { id: 'p1', t: '06:50:10', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Process create', msg: 'explorer.exe > OUTLOOK.EXE' },
          { id: 'p2', t: '06:57:40', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Process create', msg: 'OUTLOOK.EXE > WINWORD.EXE "Invoice_4471.docm" (attachment from billing@northwind-billing.example)' },
          { id: 'p3', t: '06:58:01', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Process create', msg: 'WINWORD.EXE > powershell.exe -w hidden -nop -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA...' },
          { id: 'p4', t: '06:58:09', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'File create', msg: 'powershell.exe wrote C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe SHA256=3f9a0c5d8e1b7a24c6f0d9e8b1a2c3d4e5f60718293a4b5c6d7e8f9a0b1cc21e' },
          { id: 'p5', t: '06:58:12', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Process create', msg: 'powershell.exe > C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe (PID 6120, unsigned)' },
          { id: 'p6', t: '06:58:14', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Process create', msg: 'svch0st.exe > reg.exe add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v WinUpdate /d C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe' },
          { id: 'p7', t: '07:00:30', src: 'process', host: 'WS-FIN-07', user: 'SYSTEM', type: 'Process create', msg: 'services.exe > C:\\Windows\\System32\\svchost.exe -k netsvcs (signed: Microsoft Windows)' },
          { id: 'p8', t: '07:05:12', src: 'process', host: 'WS-FIN-07', user: 'dana', type: 'Network conn', msg: 'svch0st.exe (PID 6120) -> 198.51.100.77:443' },
        ],
      },
      questions: [
        {
          id: 'fs3-q1',
          type: 'mc',
          prompt: 'Which process is making the connections to 198.51.100.77?',
          choices: ['svch0st.exe (PID 6120) in AppData\\Roaming\\winupd', 'svchost.exe -k netsvcs', 'OUTLOOK.EXE', 'WINWORD.EXE'],
          answer: 'svch0st.exe (PID 6120) in AppData\\Roaming\\winupd',
          explanation: 'The network event names PID 6120, svch0st.exe with a zero, running unsigned from the user\'s AppData. The real svchost.exe is signed, lives in System32 and has services.exe as its parent.',
        },
        {
          id: 'fs3-q2',
          type: 'mc',
          prompt: 'What is the key red flag in this tree?',
          choices: [
            'Word started hidden, encoded PowerShell, which dropped and ran an unsigned EXE from AppData',
            'Outlook started Word',
            'svchost.exe is running',
            'PowerShell is installed on the laptop',
          ],
          answer: 'Word started hidden, encoded PowerShell, which dropped and ran an unsigned EXE from AppData',
          explanation: 'Opening an attachment in Word is normal. Word launching powershell -w hidden -enc is the classic malicious-macro pattern, and the dropped look-alike EXE confirms it.',
        },
        {
          id: 'fs3-q3',
          type: 'mc',
          prompt: 'How will the malware survive a reboot?',
          choices: ['An HKCU Run key named WinUpdate', 'A new Windows service (event 7045)', 'A scheduled task', 'It will not survive a reboot'],
          answer: 'An HKCU Run key named WinUpdate',
          explanation: 'reg.exe added HKCU\\...\\CurrentVersion\\Run\\WinUpdate pointing at svch0st.exe, so it starts every time dana logs on.',
        },
      ],
    },
    {
      id: 'fs-4',
      title: 'Logon events',
      summary: 'Is the attacker moving beyond the laptop?',
      requires: { lessons: ['host-logs', 'host-users'] },
      brief: 'Check Windows Security logs on the file server SRV-FS01 for activity from WS-FIN-07 (10.10.4.27).',
      evidence: {
        label: 'Windows Security · SRV-FS01 and WS-FIN-07',
        rows: [
          { id: 'w1', t: '06:55:02', src: 'winevt', host: 'WS-FIN-07', user: 'dana', type: 'Security 4624', msg: 'An account was successfully logged on. Account: dana  Logon Type: 2 (interactive)' },
          { id: 'w2', t: '07:10:00', src: 'winevt', host: 'SRV-FS01', user: 'lee', type: 'Security 4624', msg: 'An account was successfully logged on. Account: lee  Logon Type: 3  Source: 10.10.4.30' },
          { id: 'w3', t: '07:15:20', src: 'winevt', host: 'SRV-FS01', user: 'administrator', type: 'Security 4625', msg: 'An account failed to log on. Account: administrator  Logon Type: 3  Source: 10.10.4.27' },
          { id: 'w4', t: '07:15:22', src: 'winevt', host: 'SRV-FS01', user: 'backupadmin', type: 'Security 4625', msg: 'An account failed to log on. Account: backupadmin  Logon Type: 3  Source: 10.10.4.27' },
          { id: 'w5', t: '07:15:25', src: 'winevt', host: 'SRV-FS01', user: 'svc_sql', type: 'Security 4625', msg: 'An account failed to log on. Account: svc_sql  Logon Type: 3  Source: 10.10.4.27' },
          { id: 'w6', t: '07:16:02', src: 'winevt', host: 'SRV-FS01', user: 'svc_sql', type: 'Security 4624', msg: 'An account was successfully logged on. Account: svc_sql  Logon Type: 3  Source: 10.10.4.27' },
          { id: 'w7', t: '07:16:03', src: 'winevt', host: 'SRV-FS01', user: 'svc_sql', type: 'Security 4672', msg: 'Special privileges assigned to new logon. Account: svc_sql  Privileges: SeBackupPrivilege, SeDebugPrivilege, ...' },
        ],
      },
      questions: [
        {
          id: 'fs4-q1',
          type: 'mc',
          prompt: 'What do the 4625 events from 10.10.4.27 show?',
          choices: [
            'WS-FIN-07 is trying several privileged accounts on the file server: password guessing to move laterally',
            'dana mistyped her own password',
            'Normal Kerberos ticket renewals',
            'The file server is attacking WS-FIN-07',
          ],
          answer: 'WS-FIN-07 is trying several privileged accounts on the file server: password guessing to move laterally',
          explanation: 'Three different admin-type accounts failing within five seconds from one workstation is not a typo. It is an attempt to get onto another machine with stronger credentials.',
        },
        {
          id: 'fs4-q2',
          type: 'mc',
          prompt: 'Which event is the most serious?',
          choices: ['svc_sql 4624 from 10.10.4.27, followed by 4672', 'dana\'s interactive logon at 06:55', 'lee\'s network logon from 10.10.4.30', 'The first 4625 for administrator'],
          answer: 'svc_sql 4624 from 10.10.4.27, followed by 4672',
          explanation: 'The guessing worked: svc_sql logged on to SRV-FS01 from the infected laptop and received special (admin-level) privileges. The attacker now has a second, more powerful foothold.',
        },
        {
          id: 'fs4-q3',
          type: 'mc',
          prompt: 'So, is this a real incident?',
          choices: [
            'Yes, true positive: escalate to Tier 2 now',
            'No, benign true positive: normal admin work',
            'No, false positive: the alert rule is wrong',
            'Not sure yet: wait for more alerts before acting',
          ],
          answer: 'Yes, true positive: escalate to Tier 2 now',
          explanation: 'Phishing macro, malware with persistence, beaconing to a new domain and a compromised privileged account. Every source agrees, and waiting only helps the attacker.',
        },
      ],
    },
  ],
  escalation: {
    requires: { stages: ['fs-1', 'fs-2', 'fs-3', 'fs-4'] },
    passScore: 50,
    fields: {
      severity: {
        label: 'Severity',
        options: ['low', 'medium', 'high', 'critical'],
        credit: { critical: 1, high: 0.8, medium: 0.3, low: 0 },
      },
      hosts: {
        label: 'Affected hosts',
        options: ['WS-FIN-07', 'SRV-FS01', 'SRV-DC01', 'WS-HR-03', '10.10.1.10 (DNS resolver)'],
        correct: ['WS-FIN-07', 'SRV-FS01'],
      },
      users: {
        label: 'Affected accounts',
        options: ['dana', 'svc_sql', 'administrator', 'backupadmin', 'lee'],
        correct: ['dana', 'svc_sql'],
      },
      timeline: {
        label: 'Timeline (tick the events that belong to this incident)',
        options: [
          { id: 't1', t: '06:57', text: 'dana opens Invoice_4471.docm from an email attachment' },
          { id: 't2', t: '06:58', text: 'Word launches hidden, encoded PowerShell' },
          { id: 't3', t: '06:58', text: 'svch0st.exe dropped in AppData and a Run key added' },
          { id: 't4', t: '07:05', text: 'Beaconing to 198.51.100.77 every 2 minutes begins' },
          { id: 't5', t: '07:08', text: 'Internet host 203.0.113.9 blocked on port 445' },
          { id: 't6', t: '07:10', text: 'lee logs on to the file server from 10.10.4.30' },
          { id: 't7', t: '07:15', text: 'Password guessing from WS-FIN-07 against SRV-FS01' },
          { id: 't8', t: '07:16', text: 'svc_sql logs on to SRV-FS01 and gets admin-level privileges' },
        ],
        correct: ['t1', 't2', 't3', 't4', 't7', 't8'],
      },
      iocs: {
        label: 'Indicators of compromise',
        options: [
          '198.51.100.77',
          'invoices.northwind-billing.example',
          'billing@northwind-billing.example',
          'C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe',
          'SHA256 3f9a0c5d…b1cc21e',
          'HKCU\\...\\Run\\WinUpdate',
          '10.10.1.10',
          '203.0.113.9',
          'mail.corp.example',
          'C:\\Windows\\System32\\svchost.exe',
        ],
        correct: [
          '198.51.100.77',
          'invoices.northwind-billing.example',
          'billing@northwind-billing.example',
          'C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe',
          'SHA256 3f9a0c5d…b1cc21e',
          'HKCU\\...\\Run\\WinUpdate',
        ],
      },
      actions: {
        label: 'Recommended actions',
        options: [
          'Isolate WS-FIN-07 from the network (keep it powered on for forensics)',
          'Disable svc_sql and reset its password; reset dana\'s password',
          'Block the domain and IP at the proxy, firewall and DNS',
          'Search other mailboxes and hosts for the email, domain and file hash',
          'Preserve evidence: memory and disk image of WS-FIN-07, the original email',
          'Wipe and reimage WS-FIN-07 right away, before anyone looks at it',
          'Close the alert: the firewall allowed the traffic, so it was authorised',
          'Email dana and wait for her reply before doing anything',
        ],
        correct: [
          'Isolate WS-FIN-07 from the network (keep it powered on for forensics)',
          'Disable svc_sql and reset its password; reset dana\'s password',
          'Block the domain and IP at the proxy, firewall and DNS',
          'Search other mailboxes and hosts for the email, domain and file hash',
          'Preserve evidence: memory and disk image of WS-FIN-07, the original email',
        ],
      },
      summary: {
        label: 'Summary for Tier 2',
        minLength: 40,
        rubric: [
          { label: 'How it started (phishing / macro document)', any: ['phish', 'macro', 'docm', 'attachment', 'invoice'] },
          { label: 'The affected host or user', any: ['ws-fin-07', 'dana'] },
          { label: 'The C2 domain or IP', any: ['198.51.100.77', 'northwind-billing'] },
          { label: 'Persistence on the laptop', any: ['run key', 'persistence', 'svch0st', 'winupdate'] },
          { label: 'Lateral movement / compromised account', any: ['svc_sql', 'srv-fs01', 'file server', 'lateral'] },
        ],
      },
    },
    weights: { summary: 20, severity: 10, hosts: 10, users: 10, timeline: 15, iocs: 15, actions: 20 },
    model: {
      severity: 'critical',
      summary:
        'Confirmed compromise (true positive). At 06:57 dana opened a phishing attachment, Invoice_4471.docm, on WS-FIN-07. The macro ran hidden, encoded PowerShell that dropped C:\\Users\\dana\\AppData\\Roaming\\winupd\\svch0st.exe and made it persistent with an HKCU Run key (WinUpdate). Since 07:05 it has been beaconing every 2 minutes to invoices.northwind-billing.example (198.51.100.77), a domain registered 2 days ago. At 07:15 the host tried several admin accounts on SRV-FS01, and svc_sql logged on successfully with admin-level privileges at 07:16. Requesting immediate containment: isolate WS-FIN-07, disable svc_sql, block the IOCs, and hunt for the same email across other mailboxes.',
      severityNote: 'Critical: an active C2 channel plus a compromised privileged service account on a file server. High is also defensible; medium or low would leave an attacker working unchecked.',
    },
  },
};

export const SCENARIOS = [
  {
    id: 'mixed-practice',
    kind: 'mixed',
    title: 'Mixed practice',
    summary: 'Scenario-style evidence from every skill you have learned, shuffled. First decide which area the evidence involves, then answer.',
    status: 'available',
    stages: [],
  },
  {
    id: 'siem-investigation',
    kind: 'investigation',
    title: 'SIEM investigation mode',
    summary: 'An alert arrives: search and filter the logs, pivot across sources, pin evidence and make the call.',
    status: 'available',
    stages: [],
  },
  FIRST_SHIFT,
];

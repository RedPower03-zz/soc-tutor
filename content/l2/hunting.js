// Level 2 · Threat hunting: questions, lesson and misconceptions.

const items = [
  {
    id: 'th-01',
    skill: 'l2-hunting',
    difficulty: 1,
    type: 'mc',
    prompt: 'What distinguishes **threat hunting** from alert triage?',
    choices: [
      'Hunting is proactive: analysts search for threats that did not trigger any alert, assuming a breach may already exist',
      'Hunting means working the alert queue faster',
      'Hunting is fully automated by the SIEM',
      'Hunting only happens after an incident is declared',
    ],
    answer: 'Hunting is proactive: analysts search for threats that did not trigger any alert, assuming a breach may already exist',
    misconceptions: { 'Hunting is fully automated by the SIEM': 'hunt-aimless' },
    explanation:
      'Triage reacts to alerts. Hunting starts from the idea that detections miss things (false negatives) and goes looking, led by a human with a question. Good hunts end with findings, new detections, or documented visibility gaps.',
  },
  {
    id: 'th-02',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which is the best **hunting hypothesis**?',
    choices: [
      'Attackers may be persisting on finance laptops with scheduled tasks that run binaries from user-writable folders; task-creation events will show tasks pointing to AppData or Temp',
      'Let\'s look through the logs and see if anything looks weird',
      'We might have been hacked',
      'Check whether the firewall is working',
    ],
    answer: 'Attackers may be persisting on finance laptops with scheduled tasks that run binaries from user-writable folders; task-creation events will show tasks pointing to AppData or Temp',
    misconceptions: {
      'Let\'s look through the logs and see if anything looks weird': 'hunt-aimless',
      'We might have been hacked': 'hunt-aimless',
    },
    explanation:
      'A good hypothesis is specific and **testable**: a technique (T1053.005), a scope (finance laptops), the data that would prove or disprove it (event 4698 / EDR task creation) and what "suspicious" looks like (user-writable paths). "Look for anything weird" has no finish line and no way to know if you were thorough.',
  },
  {
    id: 'th-03',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the technique called where you count how often each value (for example each autorun path) appears across many hosts, then investigate the rarest? (two words)',
    accept: ['stack counting', 'stacking', 'frequency analysis', 'long tail analysis', 'long-tail analysis', 'least frequency of occurrence', 'stack count'],
    explanation:
      '**Stack counting** (stacking, least-frequency or long-tail analysis). Legitimate software appears on hundreds of machines; an attacker\'s persistence usually appears on a handful. Sort ascending and start at the bottom, remembering that rare is a lead, not a verdict.',
  },
  {
    id: 'th-04',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'You stacked scheduled task actions across 1,800 Windows hosts. Which result do you investigate first?',
    snippet: 'count  task action\n 1794  C:\\Program Files\\Google\\Update\\GoogleUpdate.exe /ua\n 1790  C:\\Windows\\System32\\sc.exe start w32time task_started\n  612  C:\\Program Files\\Dell\\CommandUpdate\\dcu-cli.exe /scan\n    3  C:\\Program Files\\Notepad++\\updater\\gup.exe\n    2  C:\\Users\\Public\\Libraries\\msupd.exe -k netsvc',
    choices: [
      'The 2 hosts running C:\\Users\\Public\\Libraries\\msupd.exe',
      'The 1,794 hosts running GoogleUpdate.exe',
      'The 612 Dell hosts',
      'The 3 hosts with the Notepad++ updater',
    ],
    answer: 'The 2 hosts running C:\\Users\\Public\\Libraries\\msupd.exe',
    explanation:
      'Rare **and** suspicious: a binary with a Microsoft-sounding name in a world-writable Public folder, with an svchost-style argument (-k netsvc). The Notepad++ updater is rare but is a legitimate program in its normal install path. Rarity picks the candidates; context picks the first one.',
  },
  {
    id: 'th-05',
    skill: 'l2-hunting',
    difficulty: 3,
    type: 'mc',
    prompt: 'Which destination looks like C2 **beaconing** from WS-ENG-07?',
    snippet: 'dest              conns  avg interval  interval stdev  avg bytes out\nupdates.vendor.example   6   4h 01m        2m 10s            1,200\n198.51.100.23         288   300 s         9 s                 410\ncdn.news.example        47   11 m          9 m               3,900\nmail.corp.example      960   90 s          61 s              2,300',
    choices: [
      '198.51.100.23: 288 connections at a near-constant 5-minute interval with small, uniform payloads',
      'mail.corp.example: it has the most connections',
      'cdn.news.example: news sites are often malicious',
      'updates.vendor.example: it only connects every 4 hours',
    ],
    answer: '198.51.100.23: 288 connections at a near-constant 5-minute interval with small, uniform payloads',
    explanation:
      '288 connections × 5 minutes = exactly 24 hours of check-ins, with only 9 seconds of jitter and ~410 bytes each: machine-like regularity to a raw IP. Human browsing is irregular (large stdev); the mail client is chatty but variable; a 4-hourly updater is regular but rare and to a vendor domain. Beacon hunting looks for low variance in interval and size.',
  },
  {
    id: 'th-06',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'A week-long hunt for LSASS credential dumping finds nothing. What is the correct conclusion?',
    choices: [
      'No evidence was found in the data and timeframe searched; record the scope, queries and any visibility gaps, and turn the queries into a detection',
      'The environment is proven free of credential dumping',
      'The hunt failed and should be deleted',
      'Credential dumping is impossible in this environment',
    ],
    answer: 'No evidence was found in the data and timeframe searched; record the scope, queries and any visibility gaps, and turn the queries into a detection',
    misconceptions: { 'The environment is proven free of credential dumping': 'hunt-nothing-found-clean' },
    explanation:
      'Absence of evidence is limited by visibility: which hosts had the telemetry, how far back retention goes, which procedures the queries could see. A "null" hunt is still valuable: it documents coverage, may reveal gaps (for example no LSASS access telemetry on servers) and leaves a reusable detection behind.',
  },
  {
    id: 'th-07',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'multi',
    prompt: 'Before hunting for malicious encoded PowerShell, what should you confirm? Select all that apply.',
    choices: [
      'Process creation with full command lines is being collected (EDR, Sysmon event 1, or 4688 with command-line logging)',
      'Retention covers the time period you want to search',
      'The telemetry exists on the host groups in scope (servers and laptops)',
      'That an alert has already fired for it',
      'That the attacker has been identified',
    ],
    answer: [
      'Process creation with full command lines is being collected (EDR, Sysmon event 1, or 4688 with command-line logging)',
      'Retention covers the time period you want to search',
      'The telemetry exists on the host groups in scope (servers and laptops)',
    ],
    misconceptions: { 'Retention covers the time period you want to search': 'hunt-nothing-found-clean' },
    explanation:
      'Check the data before the hunt: without command lines, `-enc` is invisible; without retention, last month is invisible; without coverage, a whole server estate is invisible. Hunting does not need an alert or a known attacker; that is the point.',
  },
  {
    id: 'th-08',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'Threat intel: a ransomware group active in your sector exfiltrates data with **rclone** to cloud storage (T1567.002) before encrypting. Which hunt follows from that?',
    choices: [
      'Search process events for rclone, including renamed copies (by original file name or command-line patterns such as "copy", "--config", cloud remotes), and large outbound transfers to storage providers',
      'Search only for the file name rclone.exe',
      'Block all cloud storage and stop there',
      'Wait for the SIEM to alert on ransomware',
    ],
    answer: 'Search process events for rclone, including renamed copies (by original file name or command-line patterns such as "copy", "--config", cloud remotes), and large outbound transfers to storage providers',
    misconceptions: { 'Search only for the file name rclone.exe': 'hunt-ioc-only' },
    explanation:
      'Intel-driven hunting turns a reported behaviour into queries. Attackers rename tools (svchost.exe, backup.exe), so hunt the behaviour: PE metadata (OriginalFileName), distinctive arguments and the traffic pattern. Finding exfiltration before encryption is the difference between an incident and a crisis.',
  },
  {
    id: 'th-09',
    skill: 'l2-hunting',
    difficulty: 1,
    type: 'mc',
    prompt: 'Apart from finding attackers, what is the most valuable lasting output of a hunt?',
    choices: [
      'New or improved detections, plus documented visibility gaps to fix',
      'A long list of every query that was run, with no conclusions',
      'A screenshot of the SIEM dashboard',
      'A promise that the environment is clean',
    ],
    answer: 'New or improved detections, plus documented visibility gaps to fix',
    misconceptions: { 'A promise that the environment is clean': 'hunt-nothing-found-clean' },
    explanation:
      'The classic hunting loop: hypothesis → investigate → find patterns or TTPs → **inform and enrich** automated analytics. Each hunt should make the SOC\'s detection permanently better, whether or not it found an attacker this time.',
  },
  {
    id: 'th-10',
    skill: 'l2-hunting',
    difficulty: 3,
    type: 'mc',
    prompt: 'You hunt for `procdump.exe` by file name and find nothing. Why might that be misleading?',
    choices: [
      'Attackers rename binaries; search on PE metadata (OriginalFileName), the signer, the hash or the command-line pattern (-ma lsass) instead',
      'procdump is never used by attackers',
      'File names are case-sensitive on Windows',
      'The SIEM cannot search file names',
    ],
    answer: 'Attackers rename binaries; search on PE metadata (OriginalFileName), the signer, the hash or the command-line pattern (-ma lsass) instead',
    misconceptions: { 'procdump is never used by attackers': 'hunt-ioc-only' },
    explanation:
      '`copy procdump.exe C:\\Windows\\Temp\\wmiupd.exe` defeats a file-name search. The original file name baked into the PE (visible in Sysmon and most EDRs), the signature and the tell-tale arguments stay the same. Windows file names are case-insensitive, and procdump is a well-known tool for dumping LSASS.',
  },
  {
    id: 'th-11',
    skill: 'l2-hunting',
    difficulty: 1,
    type: 'text',
    prompt: 'Hunters work from the mindset that an attacker may already be inside the network. Complete the phrase: "assume ______".',
    accept: ['breach', 'assume breach', 'a breach', 'compromise'],
    explanation:
      '**Assume breach**: prevention will eventually fail, so plan to find and limit an attacker who is already in. It is why hunting, segmentation and fast response matter as much as blocking.',
  },
  {
    id: 'th-12',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'A DNS hunt lists domains queried for the first time this week by exactly one host. Which stands out?',
    snippet: 'first_seen   host        query\nMon 09:12    WS-HR-02    careers.partner-portal.example\nTue 14:40    WS-ENG-11   q7xk2vbn4tpl9w.example\nTue 14:41    WS-ENG-11   zr8mf3ka0wqe5y.example\nTue 14:42    WS-ENG-11   hb2nw9pc6xud1s.example\nWed 10:03    WS-SLS-04   crm-login.vendor.example',
    choices: [
      'WS-ENG-11: a burst of random-looking domains, typical of a domain generation algorithm (DGA)',
      'WS-HR-02: HR should not visit partner portals',
      'WS-SLS-04: CRM logins are always phishing',
      'None: first-seen domains are always harmless',
    ],
    answer: 'WS-ENG-11: a burst of random-looking domains, typical of a domain generation algorithm (DGA)',
    explanation:
      'Malware with a DGA generates many pseudo-random domains and tries them until one resolves to the C2 server (T1568.002). High-entropy names, one host, one minute apart: investigate WS-ENG-11. The other two are readable business domains; they may still deserve a glance, but they do not stand out.',
  },
  {
    id: 'th-13',
    skill: 'l2-hunting',
    difficulty: 3,
    type: 'mc',
    prompt: 'A manager suggests the hunt team spend its time sweeping for hashes from threat-intel feeds, "because matches are unambiguous". What is the main weakness of an IOC-only hunting programme?',
    choices: [
      'Hashes and IPs are cheap for attackers to change, so sweeps mostly find old, known threats; behaviour-based hunts find new ones',
      'Hash matches are often wrong',
      'IOC sweeps are illegal',
      'There is no weakness: IOC sweeps are the best form of hunting',
    ],
    answer: 'Hashes and IPs are cheap for attackers to change, so sweeps mostly find old, known threats; behaviour-based hunts find new ones',
    misconceptions: { 'There is no weakness: IOC sweeps are the best form of hunting': 'hunt-ioc-only' },
    explanation:
      'IOC sweeps are quick and worth automating, but they sit at the bottom of the Pyramid of Pain. Hunting for techniques (LSASS access, unusual scheduled tasks, beaconing, rare parent-child pairs) catches attackers whose tools you have never seen.',
  },
  {
    id: 'th-14',
    skill: 'l2-hunting',
    difficulty: 2,
    type: 'mc',
    prompt: 'Your hunt for web shells on 40 IIS servers found nothing, but 6 of the servers turned out to have no EDR agent. What should the hunt report say?',
    choices: [
      'No web shells found on the 34 servers with telemetry; 6 servers could not be checked (no EDR): recommend deploying the agent and re-running the hunt',
      'No web shells on any of the 40 servers',
      'The hunt was inconclusive and should not be reported',
      'All 6 unmonitored servers are compromised',
    ],
    answer: 'No web shells found on the 34 servers with telemetry; 6 servers could not be checked (no EDR): recommend deploying the agent and re-running the hunt',
    misconceptions: { 'No web shells on any of the 40 servers': 'hunt-nothing-found-clean' },
    explanation:
      'State exactly what was covered and what was not. The visibility gap is a finding in its own right, and probably the most important one: an attacker would love six unmonitored internet-facing servers. Missing telemetry is not evidence of compromise either.',
  },
];

const lesson = {
  skill: 'l2-hunting',
  title: 'Threat hunting',
  goal: 'Turn a testable hypothesis into queries, find what alerts missed, and leave better detections behind.',
  sections: [
    {
      id: 'what',
      heading: 'What hunting is',
      body: [
        'Threat hunting is the proactive, human-led search for attackers who did not trigger an alert. It starts from **assume breach**: prevention and detection will miss things (false negatives).',
        'Three common starting points: **hypothesis-driven** (a technique you expect), **intel-driven** (a report about a group targeting your sector) and **data-driven** (baselines and outliers).',
      ],
    },
    {
      id: 'hypothesis',
      heading: 'A testable hypothesis',
      body: ['A good hypothesis names a behaviour, a scope, the data that will show it and what "suspicious" looks like:'],
      evidence: {
        label: 'Hypothesis template',
        text: 'Behaviour:  scheduled-task persistence (T1053.005)\nScope:      finance laptops, last 30 days\nData:       task creation (4698 / EDR), process creation with command lines\nSuspicious: task actions in AppData, Temp or Users\\Public; created by Office or script hosts',
      },
      points: ['The hunting loop: hypothesis → investigate → uncover patterns and TTPs → inform and enrich detections, then repeat.', 'Frameworks such as PEAK and TaHiTI formalise the same idea.'],
    },
    {
      id: 'techniques',
      heading: 'Core techniques',
      body: ['Most hunts use a handful of analytic moves:'],
      points: [
        '**Stack counting:** count each value across the fleet and start with the rarest (autoruns, services, task actions, parent-child pairs).',
        '**Beacon analysis:** many connections to one destination with a steady interval, low jitter and uniform size.',
        '**First-seen and rarity:** new domains or processes; random-looking domains (DGA).',
        '**Behaviour over names:** tools get renamed, so use OriginalFileName, signer, hash and command-line patterns.',
      ],
    },
    {
      id: 'data',
      heading: 'Check the data first',
      body: [
        'A hunt can only see what is collected. Before starting, confirm the telemetry (process command lines, network, DNS, authentication), the retention period and which host groups have it. Missing coverage is a finding you report and fix.',
      ],
    },
    {
      id: 'outcomes',
      heading: 'Outcomes and reporting',
      body: [
        'Every hunt ends in one of three ways: **found something** (hand it to incident response), **found nothing** (report the scope, data and queries: "no evidence in what we searched", never "proven clean"), or **found a gap** (missing telemetry, noisy rules). In every case, turn useful queries into detections so the next occurrence alerts automatically.',
      ],
    },
  ],
  worked: [
    {
      id: 'th-w1',
      title: 'Hunting service persistence by stacking',
      artifactLabel: 'Hypothesis + stack of new services (7045), 30 days, 2,100 hosts',
      artifact:
        'Hypothesis: an attacker installed a service for persistence or lateral movement (T1543.003 / T1569.002).\n\ncount  service name     image path\n 2088  Sysmon64         C:\\Windows\\Sysmon64.exe\n 1450  EdgeUpdate       C:\\Program Files (x86)\\Microsoft\\EdgeUpdate\\MicrosoftEdgeUpdate.exe\n   14  PSEXESVC         %SystemRoot%\\PSEXESVC.exe\n    1  WinDefendSvc     C:\\ProgramData\\wdsvc\\wdsvc.exe',
      question: 'What do you investigate and why?',
      steps: [
        'Start at the bottom of the stack: one host installed "WinDefendSvc" running from C:\\ProgramData. Microsoft Defender does not install from ProgramData under that name: masquerading as a security product.',
        '14 hosts show PSEXESVC. PsExec is a legitimate admin tool, so check who ran it and from where: if the source is the IT jump server and matches admin work, it is expected; if the source is a workstation, it is lateral movement.',
        'The common services (Sysmon, EdgeUpdate) are fleet-wide and in their normal paths: deprioritise.',
        'For WinDefendSvc: hash and signer of wdsvc.exe, which account installed it (4697/7045 details), what it connects to, and whether other hosts contacted that host.',
      ],
      conclusion: 'Escalate WinDefendSvc as a likely backdoor, review the PSEXESVC sources, and write a detection for services installed from ProgramData, Users or Temp paths.',
    },
  ],
  faded: [
    {
      id: 'th-f1',
      title: 'Finding the beacon',
      artifactLabel: 'Proxy connections from WS-SLS-09 (24 h)',
      artifact:
        'dest                     conns  median interval  jitter   bytes out (avg)\nteams.messaging.example   2,410   20 s             ±18 s    1,850\nimg.cdn-assets.example        88   variable         n/a      5,200\nstatus.cloud-sync.example    144   600 s            ±4 s       296\nportal.corp.example           31   variable         n/a      2,100',
      question: 'Which destination is the likely C2 beacon, and what next?',
      given: [
        'Browsing (img.cdn-assets, portal.corp) has variable intervals and payloads: human-driven.',
        'The messaging app is chatty, and its jitter (±18 s on 20 s) is large relative to the interval.',
      ],
      todo: [
        {
          prompt: 'Which destination fits beaconing best?',
          type: 'mc',
          choices: ['status.cloud-sync.example', 'teams.messaging.example', 'portal.corp.example'],
          answer: 'status.cloud-sync.example',
          explanation: '144 connections × 600 s = exactly 24 hours, ±4 s jitter and tiny uniform requests: a machine checking in every 10 minutes.',
        },
        {
          prompt: 'What is the best next step?',
          type: 'mc',
          choices: [
            'Find which process on WS-SLS-09 makes those connections (EDR), and check how many other hosts contact the domain',
            'Block the domain and close the hunt',
            'Reimage WS-SLS-09 immediately',
          ],
          answer: 'Find which process on WS-SLS-09 makes those connections (EDR), and check how many other hosts contact the domain',
          explanation: 'Confirm and scope before acting: the process tells you what is beaconing (it could be a legitimate sync agent), and a fleet-wide search shows whether it is one host or twenty. Then hand confirmed findings to incident response.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'hunt-aimless',
    skill: 'l2-hunting',
    name: 'Hunting = browsing logs for anything weird',
    description: 'Treats hunting as unstructured log browsing, or as something the SIEM does automatically.',
    fix: 'Hunting is human-led and hypothesis-driven. Name the behaviour (an ATT&CK technique), the scope, the data that would show it and what "suspicious" looks like. That gives you a finish line, a way to judge thoroughness and queries you can turn into detections.',
    lesson: 'l2-hunting#hypothesis',
  },
  {
    id: 'hunt-nothing-found-clean',
    skill: 'l2-hunting',
    name: 'Nothing found = proven clean',
    description: 'Reports a hunt with no findings as proof that no attacker is present.',
    fix: 'A hunt only sees the data it searched: the hosts with telemetry, the retention window, the procedures the queries could catch. Report "no evidence found in <scope>" and list the gaps (hosts without EDR, missing command lines). Gaps are findings too.',
    lesson: 'l2-hunting#outcomes',
  },
  {
    id: 'hunt-ioc-only',
    skill: 'l2-hunting',
    name: 'Hunting by names and hashes only',
    description: 'Hunts only for known file names, hashes or IPs.',
    fix: 'Names, hashes and IPs are the easiest things for attackers to change (bottom of the Pyramid of Pain). Hunt the behaviour: PE metadata such as OriginalFileName, signer, command-line patterns, parent-child relationships, beacon timing. Keep IOC sweeps as a quick automated extra.',
    lesson: 'l2-hunting#techniques',
  },
];

export const HUNTING = { items, lesson, misconceptions };

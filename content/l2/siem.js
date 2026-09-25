// Level 2 · SIEM & log analysis: questions, lesson and misconceptions.
// Query examples use Splunk SPL and Microsoft KQL syntax; data is fictional.

const items = [
  {
    id: 'sl-01',
    skill: 'l2-siem',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does **normalisation** mean in a SIEM?',
    choices: [
      'Mapping each vendor\'s field names and formats to one common schema (for example src_ip, user, action)',
      'Deleting events that look normal so only attacks are stored',
      'Compressing logs so they take less disk space',
      'Converting every log into plain English sentences',
    ],
    answer: 'Mapping each vendor\'s field names and formats to one common schema (for example src_ip, user, action)',
    explanation:
      'A firewall calls it `srcip`, Windows calls it `IpAddress`, the proxy calls it `c-ip`. Normalisation parses each into the same field (such as `src_ip`) so one query or correlation rule works across every source. Frameworks like the Splunk CIM or the Elastic Common Schema (ECS) define these common names.',
  },
  {
    id: 'sl-02',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does this Splunk (SPL) search return?',
    snippet: 'index=wineventlog EventCode=4625 earliest=-24h\n| stats count by src_ip\n| where count > 50\n| sort - count',
    choices: [
      'Source IPs with more than 50 failed logons in the last 24 hours, busiest first',
      'The first 50 failed logons from each IP',
      'Accounts that logged on successfully more than 50 times',
      'Every failed logon, sorted by time',
    ],
    answer: 'Source IPs with more than 50 failed logons in the last 24 hours, busiest first',
    explanation:
      'Read SPL left to right: the first part filters (index, event 4625 = failed logon, last 24 h), each `|` passes results on. `stats count by src_ip` makes one row per IP with a count, `where count > 50` keeps the noisy ones, and `sort - count` orders them descending.',
  },
  {
    id: 'sl-03',
    skill: 'l2-siem',
    difficulty: 1,
    type: 'text',
    prompt: 'In KQL (Microsoft Sentinel / Defender), which operator keeps only the rows that match a condition, like SQL\'s WHERE?',
    accept: ['where', '| where', 'where operator'],
    explanation:
      '`| where EventID == 4625` filters rows. Other everyday KQL operators: `project` (choose columns), `summarize` (aggregate, like SPL stats), `extend` (add a computed column), `join` and `sort by`.',
  },
  {
    id: 'sl-04',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'text',
    prompt: 'Complete the SPL: `index=proxy action=blocked | ____ count by user` (the command that aggregates events into counts per field value).',
    accept: ['stats', 'stats count', 'stats count by user'],
    explanation:
      '`stats` is SPL\'s aggregation command: `stats count by user`, `stats dc(dest) by src` (distinct count), `stats earliest(_time) latest(_time) by host`. The KQL equivalent is `summarize count() by user`.',
  },
  {
    id: 'sl-05',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'Why put the index/table, time range and exact field filters at the **start** of a search?',
    choices: [
      'They cut the data down before heavier steps run, so the search is faster and cheaper',
      'The SIEM ignores filters that come after the first pipe',
      'It makes the results more accurate',
      'Time ranges are only allowed at the start',
    ],
    answer: 'They cut the data down before heavier steps run, so the search is faster and cheaper',
    explanation:
      'The results are the same either way, but scanning 30 days of every index and then filtering can take minutes (and cost money on usage-billed platforms). Filter early and narrowly (source, time, EventCode), then aggregate.',
  },
  {
    id: 'sl-06',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'You are building a timeline. The events below are the same connection, but look four hours apart. What is the most likely cause?',
    snippet: 'FW-EDGE  2026-09-18T18:02:11Z  ALLOW TCP 10.10.4.27:51544 -> 198.51.100.77:443\nWS-FIN-07 Sysmon 3  2026-09-18 14:02:11  powershell.exe -> 198.51.100.77:443 (local time, UTC-4)',
    choices: [
      'Time zones: the firewall logs in UTC and the host in local time; normalise both to UTC',
      'Two separate connections four hours apart',
      'The firewall clock is broken',
      'The host was offline for four hours',
    ],
    answer: 'Time zones: the firewall logs in UTC and the host in local time; normalise both to UTC',
    misconceptions: { 'Two separate connections four hours apart': 'siem-timezones', 'The firewall clock is broken': 'siem-timezones' },
    explanation:
      'The `Z` means UTC; the host logged local time (UTC-4). Same second, same IPs, same port: one event. Always normalise timestamps to UTC before correlating, and note clock drift (check NTP) if the offset is not a clean number of hours.',
  },
  {
    id: 'sl-07',
    skill: 'l2-siem',
    difficulty: 3,
    type: 'mc',
    prompt: 'An alert names internal IP 10.20.30.44 at 14:05. Which machine was it?',
    snippet: 'DHCP  13:00:12  ACK 10.20.30.44 -> WS-ENG-07 (MAC 00:1a:2b:3c:4d:5e) lease 1h\nDHCP  13:58:40  RELEASE 10.20.30.44 from WS-ENG-07\nDHCP  14:01:03  ACK 10.20.30.44 -> WS-SLS-12 (MAC 00:1a:2b:9f:8e:7d) lease 1h\nDHCP  14:30:00  ACK 10.20.30.51 -> WS-ENG-07',
    choices: ['WS-SLS-12', 'WS-ENG-07', 'Both, at the same time', 'Impossible to tell from DHCP'],
    answer: 'WS-SLS-12',
    misconceptions: { 'WS-ENG-07': 'siem-ip-equals-host' },
    explanation:
      'IP addresses are leased, not owned. WS-ENG-07 released 10.20.30.44 at 13:58 and WS-SLS-12 got it at 14:01, so at 14:05 it belonged to WS-SLS-12. Resolve internal IPs to hosts **at the time of the event** using DHCP, VPN or EDR records.',
  },
  {
    id: 'sl-08',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'multi',
    prompt: 'Your search for a known-bad domain returns **zero** results. Which could explain that even if the traffic happened? Select all that apply.',
    choices: [
      'The DNS or proxy logs from that site are not being ingested',
      'The time range does not cover when it happened',
      'The field is named differently in that source (query vs dest_domain)',
      'An exact, case-sensitive match against a value stored in different case',
      'The SIEM automatically deletes malicious events',
    ],
    answer: [
      'The DNS or proxy logs from that site are not being ingested',
      'The time range does not cover when it happened',
      'The field is named differently in that source (query vs dest_domain)',
      'An exact, case-sensitive match against a value stored in different case',
    ],
    misconceptions: { 'The DNS or proxy logs from that site are not being ingested': 'siem-no-results-no-activity' },
    explanation:
      'Zero results means "not found in the data I searched", not "did not happen". Check source coverage and ingestion health, the time range, field names and matching rules (in KQL `==` is case-sensitive; `=~` is not). SIEMs do not delete events for being malicious.',
  },
  {
    id: 'sl-09',
    skill: 'l2-siem',
    difficulty: 3,
    type: 'mc',
    prompt: 'What attack pattern does this KQL query look for?',
    snippet: 'SigninLogs\n| where TimeGenerated > ago(1h) and ResultType != 0\n| summarize Users = dcount(UserPrincipalName), Attempts = count() by IPAddress\n| where Users > 20 and Attempts < Users * 2',
    choices: [
      'Password spraying: one IP trying a few passwords against many different accounts',
      'Brute force: one IP trying thousands of passwords against one account',
      'Successful logons from new countries',
      'Accounts locked out by the help desk',
    ],
    answer: 'Password spraying: one IP trying a few passwords against many different accounts',
    misconceptions: { 'Brute force: one IP trying thousands of passwords against one account': 'siem-spray-vs-brute' },
    explanation:
      '`ResultType != 0` keeps failed sign-ins. `dcount(UserPrincipalName)` counts **distinct** accounts per IP; more than 20 accounts with fewer than two attempts each is spraying: a few common passwords across many users, slow enough to avoid lockouts (ATT&CK T1110.003). Brute force is many attempts against one account.',
  },
  {
    id: 'sl-10',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'You run `index=edr | stats count by process_path | sort count` across 2,000 laptops. Why look at the **bottom** of the list (the rarest paths)?',
    choices: [
      'Malware and attacker tools tend to be rare; software everyone runs sits at the top',
      'The rarest paths are always malicious',
      'The SIEM hides important results at the bottom',
      'Rare paths use less disk space',
    ],
    answer: 'Malware and attacker tools tend to be rare; software everyone runs sits at the top',
    explanation:
      'This is **long-tail** (least-frequency) analysis. Standard software runs on hundreds of machines; one binary in `C:\\Users\\Public\\` on two machines stands out. Rare is not automatically bad (a single engineer\'s tool is rare too), but it is where to look first.',
  },
  {
    id: 'sl-11',
    skill: 'l2-siem',
    difficulty: 3,
    type: 'mc',
    prompt: 'A correlation rule fires on "5+ failed logons followed by a success for the same user within 10 minutes". Which attacker behaviour will it **miss**?',
    choices: [
      'Trying one password per account across hundreds of accounts, spread over hours',
      'Twenty fast guesses against the administrator account, then a success',
      'A success right after 6 failures from a new IP',
      'Failures and a success from the same IP within 2 minutes',
    ],
    answer: 'Trying one password per account across hundreds of accounts, spread over hours',
    misconceptions: { 'Twenty fast guesses against the administrator account, then a success': 'siem-spray-vs-brute' },
    explanation:
      'Per-user thresholds catch brute force but not low-and-slow spraying: each account sees one failure, and the window is exceeded. Complement it with a per-source view (distinct accounts per IP) over a longer window. Knowing what a rule cannot see is part of reading its silence.',
  },
  {
    id: 'sl-12',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the attack called where one or two common passwords are tried against many accounts to avoid lockouts? (two words)',
    accept: ['password spraying', 'password spray', 'spraying'],
    misconceptions: { 'brute force': 'siem-spray-vs-brute', 'credential stuffing': 'siem-spray-vs-brute' },
    explanation:
      '**Password spraying** (T1110.003). Brute force hammers one account with many passwords; credential stuffing replays username/password pairs leaked from other sites. They look different in logs: spraying = one source, many users, few attempts each.',
  },
  {
    id: 'sl-13',
    skill: 'l2-siem',
    difficulty: 1,
    type: 'mc',
    prompt: 'The SIEM shows no events at all from domain controller SRV-DC01 for the last two hours. What should you assume?',
    choices: [
      'A logging gap to investigate: an agent or pipeline failure, or someone stopping the logging',
      'It has been a quiet two hours on the DC',
      'The DC is switched off, so there is no risk',
      'Nothing: missing logs are normal',
    ],
    answer: 'A logging gap to investigate: an agent or pipeline failure, or someone stopping the logging',
    misconceptions: { 'It has been a quiet two hours on the DC': 'siem-no-results-no-activity' },
    explanation:
      'A domain controller is never silent for two hours. Silence is a data problem until proven otherwise: a crashed forwarder, a full disk, a network change, or an attacker breaking your visibility (ATT&CK\'s Defense Impairment tactic, TA0112 since v19: for example stopping the log service; clearing the Security log leaves event 1102). Monitor source health, not just alerts.',
  },
  {
    id: 'sl-14',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'A suspicious request came from VPN address 10.99.0.23 at 21:40. Last week an investigation tied 10.99.0.23 to user kai. Who made tonight\'s request?',
    choices: [
      'Unknown until you check the VPN logs for who held 10.99.0.23 at 21:40',
      'kai: that IP is his',
      'Nobody: VPN addresses cannot make requests',
      'The VPN gateway itself',
    ],
    answer: 'Unknown until you check the VPN logs for who held 10.99.0.23 at 21:40',
    misconceptions: { 'kai: that IP is his': 'siem-ip-equals-host' },
    explanation:
      'VPN pools, DHCP and NAT all reuse addresses. Attribute an IP to a user or host only with a record from the same time: the VPN session log (user, assigned IP, connect and disconnect times) settles it.',
  },
  {
    id: 'sl-15',
    skill: 'l2-siem',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which of these two events happened first?',
    snippet: 'WS-BER-04  Security 4624  2026-09-21 09:15:30  (host logs local time, UTC+2)\nFW-EDGE    ALLOW          2026-09-21T07:16:05Z',
    choices: [
      'The logon: 09:15:30 at UTC+2 is 07:15:30 UTC, 35 seconds before the firewall event',
      'The firewall event: 07:16 is earlier than 09:15',
      'They happened at the same moment',
      'It cannot be worked out',
    ],
    answer: 'The logon: 09:15:30 at UTC+2 is 07:15:30 UTC, 35 seconds before the firewall event',
    misconceptions: { 'The firewall event: 07:16 is earlier than 09:15': 'siem-timezones' },
    explanation:
      'Convert first, compare second. Local time UTC+2 means subtract 2 hours to get UTC: 09:15:30 becomes 07:15:30Z, which is 35 seconds before the firewall line at 07:16:05Z. Comparing the raw clock values would put the events two hours apart in the wrong order.',
  },
];

const lesson = {
  skill: 'l2-siem',
  title: 'SIEM & log analysis',
  goal: 'Write focused searches, correlate across sources and know what an empty result really means.',
  sections: [
    {
      id: 'pipeline',
      heading: 'What a SIEM actually does',
      body: [
        'A SIEM **collects** logs (Windows events, firewall, DNS, proxy, EDR, cloud sign-ins), **parses and normalises** them into common fields, **stores** them for searching, and runs **correlation rules** that raise alerts.',
        'Normalisation is what makes cross-source work possible: `srcip`, `IpAddress` and `c-ip` all become `src_ip`. When parsing breaks, fields go missing and rules silently stop matching.',
      ],
      points: ['Every source has a lag, a retention period and gaps.', 'Store and compare time in UTC.'],
    },
    {
      id: 'queries',
      heading: 'Reading and writing queries',
      body: [
        'SPL (Splunk) and KQL (Microsoft Sentinel/Defender) both run left to right through pipes: **filter first** (source, time, exact fields), then **aggregate**, then sort. Early, narrow filters make searches fast.',
      ],
      evidence: {
        label: 'The same question in SPL and KQL',
        text: 'SPL:  index=wineventlog EventCode=4625 earliest=-1h\n      | stats count dc(user) as users by src_ip\n      | where users > 20\n\nKQL:  SecurityEvent\n      | where TimeGenerated > ago(1h) and EventID == 4625\n      | summarize Attempts = count(), Users = dcount(TargetUserName) by IpAddress\n      | where Users > 20',
      },
      points: ['`stats` (SPL) and `summarize` (KQL) aggregate.', '`dc()` / `dcount()` count distinct values: the key to spotting spraying and scanning.', 'In KQL `==` is case-sensitive; `=~` is not.'],
    },
    {
      id: 'correlation',
      heading: 'Correlating across sources',
      body: [
        'Stories span sources: an email, a proxy hit, a process, a logon. Join them on shared keys (**host, user, IP, time**), always in the same time zone.',
        'Internal IPs are leased (DHCP, VPN pools, NAT), so resolve an IP to a host or user **at the time of the event**, not from memory or last week\'s ticket.',
      ],
    },
    {
      id: 'patterns',
      heading: 'Patterns: counts, rarity and sequences',
      body: ['Most detections and investigations boil down to a few shapes:'],
      points: [
        '**Thresholds:** 50 failures from one IP (brute force), 1 IP touching 30 accounts (spraying: T1110.003).',
        '**Rarity:** long-tail analysis, first-seen domains or processes.',
        '**Sequences:** failures then a success; a new service then an outbound connection.',
        'Every threshold has a blind side: low-and-slow activity stays under it.',
      ],
    },
    {
      id: 'blind-spots',
      heading: 'Empty results and blind spots',
      body: [
        'Zero results means "not in the data I searched". Before concluding "it did not happen", check: is the source ingested and healthy, does the time range cover it, is the field named the same in this source, is the match case-sensitive?',
        'A source that suddenly goes silent is itself a finding: pipeline failure, or an attacker impairing defences (ATT&CK\'s Defense Impairment tactic).',
      ],
    },
  ],
  worked: [
    {
      id: 'sl-w1',
      title: 'From a spray to the one success',
      artifactLabel: 'SPL search and results',
      artifact:
        'index=vpn action=failure earliest=-2h\n| stats dc(user) as users count by src_ip\n| where users > 15\n\nsrc_ip          users  count\n203.0.113.88       42     44\n\nindex=vpn src_ip=203.0.113.88 action=success earliest=-2h\n\n21:47:03  VPN-GW  user=ops.lee  src_ip=203.0.113.88  action=success  mfa=push-approved',
      question: 'Is this a spray, and did it work?',
      steps: [
        'The first search filters to VPN failures in the last 2 hours and counts distinct users per source IP.',
        '203.0.113.88 hit 42 different accounts with 44 attempts: roughly one attempt each. That is spraying, not brute force.',
        'The key follow-up question is whether any attempt succeeded, so the second search pivots on the same IP with action=success.',
        'One success: ops.lee at 21:47, and the MFA push was approved. Either lee approved a push he did not start (MFA fatigue) or the attacker has his phone.',
      ],
      conclusion: 'True positive: a password spray with one successful VPN logon. Escalate, revoke ops.lee\'s sessions, reset his password, confirm the MFA approval with him by phone, and block 203.0.113.88.',
    },
  ],
  faded: [
    {
      id: 'sl-f1',
      title: 'Which host was it?',
      artifactLabel: 'Proxy alert + DHCP log',
      artifact:
        'PROXY  09:12:40Z  10.30.8.19  GET http://198.51.100.9/a.ps1  200  (flagged: script from raw IP)\n\nDHCP (logs in UTC)\n07:55:02Z  ACK 10.30.8.19 -> WS-OPS-02\n08:59:10Z  RELEASE 10.30.8.19 from WS-OPS-02\n09:03:22Z  ACK 10.30.8.19 -> WS-LAB-11\n10:05:00Z  ACK 10.30.8.19 -> WS-LAB-11 (renew)',
      question: 'Which machine downloaded the script?',
      given: [
        'Both logs are in UTC, so the times can be compared directly.',
        'The request was at 09:12:40Z. We need whoever held 10.30.8.19 at that moment.',
      ],
      todo: [
        {
          prompt: 'Which host held 10.30.8.19 at 09:12:40Z?',
          type: 'mc',
          choices: ['WS-LAB-11', 'WS-OPS-02', 'Both'],
          answer: 'WS-LAB-11',
          explanation: 'WS-OPS-02 released the address at 08:59; WS-LAB-11 received it at 09:03 and renewed it later. At 09:12 it was WS-LAB-11.',
        },
        {
          prompt: 'Which field would you search on the proxy to see what else that host fetched, if IPs keep changing?',
          type: 'text',
          accept: ['user', 'username', 'hostname', 'host', 'device', 'mac'],
          explanation: 'Pivot on a stable identifier (the authenticated user or the hostname/device ID, if the proxy logs them), not the IP, which will change again at the next lease.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'siem-no-results-no-activity',
    skill: 'l2-siem',
    name: 'No results = it didn\'t happen',
    description: 'Treats an empty search or a silent log source as proof that nothing happened.',
    fix: 'An empty result only means "not in the data I searched". Check that the source is ingested and healthy, the time range is right, the field name matches this source and the comparison is not case-sensitive by accident. A source going silent (like a domain controller) is itself something to investigate.',
    lesson: 'l2-siem#blind-spots',
  },
  {
    id: 'siem-timezones',
    skill: 'l2-siem',
    name: 'Comparing timestamps from different time zones',
    description: 'Lines up events from different sources without normalising time zones.',
    fix: 'Check each source\'s time zone: `Z` or `+00:00` is UTC, many hosts log local time. Convert everything to UTC before building a timeline. A clean offset of whole hours is a time zone; an odd offset of seconds or minutes is clock drift (check NTP).',
    lesson: 'l2-siem#correlation',
  },
  {
    id: 'siem-spray-vs-brute',
    skill: 'l2-siem',
    name: 'Password spraying = brute force',
    description: 'Does not distinguish spraying (one password, many accounts) from brute force (many passwords, one account).',
    fix: 'Brute force: many attempts against one account, fast, triggers lockouts. Spraying (T1110.003): a few common passwords across many accounts, slowly, to stay under lockout thresholds. Detect spraying with a distinct count of accounts per source IP over a longer window, not per-user failure counts.',
    lesson: 'l2-siem#patterns',
  },
  {
    id: 'siem-ip-equals-host',
    skill: 'l2-siem',
    name: 'An internal IP always means the same machine',
    description: 'Assumes an internal or VPN IP permanently identifies one host or user.',
    fix: 'DHCP, VPN pools and NAT reassign addresses. Attribute an IP only with a record from the same moment: DHCP lease, VPN session, EDR network data. Then pivot on stable identifiers such as hostname, device ID or user.',
    lesson: 'l2-siem#correlation',
  },
];

export const SIEM = { items, lesson, misconceptions };

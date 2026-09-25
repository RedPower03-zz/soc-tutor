// Level 3 · Detection engineering: questions, lesson and misconceptions.
// Sigma rule format (SigmaHQ specification), MITRE ATT&CK coverage, detection-as-code testing,
// tuning with precision in mind, and the Pyramid of Pain.

const items = [
  {
    id: 'det-01',
    skill: 'l3-detection',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is **Sigma**?',
    choices: [
      'A vendor-neutral YAML rule format converted into SIEM queries',
      'A commercial SIEM product sold with its own detection content',
      'An antivirus engine that scans files using YAML signatures',
      'A log shipping agent that forwards events into any SIEM',
    ],
    answer: 'A vendor-neutral YAML rule format converted into SIEM queries',
    misconceptions: {
      'A commercial SIEM product sold with its own detection content': 'det-sigma-is-a-product',
      'A log shipping agent that forwards events into any SIEM': 'det-sigma-is-a-product',
    },
    explanation:
      'Sigma is to log detections what YARA is to files: a shared, open rule format. A converter (the pySigma-based `sigma-cli`) turns one rule into Splunk SPL, Microsoft Sentinel KQL, Elastic queries and more. The public SigmaHQ repository holds thousands of community rules.',
  },
  {
    id: 'det-02',
    skill: 'l3-detection',
    difficulty: 1,
    type: 'text',
    prompt: 'In a Sigma rule, which top-level key combines the named selections with logic such as `selection and not filter`?',
    accept: ['condition', 'detection.condition', 'the condition'],
    misconceptions: { selection: 'det-sigma-is-a-product', logsource: 'det-sigma-is-a-product' },
    explanation:
      'Inside `detection:` you define named maps (`selection`, `filter_admin`...), and the `condition:` line combines them: `selection and not 1 of filter_*`. `logsource:` (product, category, service) says which logs the rule applies to.',
  },
  {
    id: 'det-03',
    skill: 'l3-detection',
    difficulty: 2,
    type: 'mc',
    prompt: 'Read the rule. What does it detect?',
    snippet:
      'title: Kerberoasting - RC4 service ticket requests\nstatus: experimental\nlogsource:\n  product: windows\n  service: security\ndetection:\n  selection:\n    EventID: 4769\n    TicketEncryptionType: \'0x17\'\n    Status: \'0x0\'\n  filter_machine:\n    ServiceName|endswith: \'$\'\n  filter_krbtgt:\n    ServiceName: \'krbtgt\'\n  condition: selection and not 1 of filter_*\nlevel: medium\ntags:\n  - attack.credential-access\n  - attack.t1558.003',
    choices: [
      'RC4 service tickets for user accounts (Kerberoasting)',
      'Failed logons with bad passwords against service accounts',
      'Golden tickets forged with the krbtgt hash on a workstation',
      'Every Kerberos ticket, for audit',
    ],
    answer: 'RC4 service tickets for user accounts (Kerberoasting)',
    misconceptions: {
      'Every Kerberos ticket, for audit': 'det-more-alerts-better',
    },
    explanation:
      'The selection matches 4769 with encryption 0x17 (RC4) and success; the filters drop computer accounts (names ending in $) and krbtgt, whose tickets are not roasting targets. The tag maps it to T1558.003. In practice, you add a threshold (many SPNs from one client) or known-legacy exclusions to control volume.',
  },
  {
    id: 'det-04',
    skill: 'l3-detection',
    difficulty: 2,
    type: 'mc',
    prompt: 'A new rule fires 400 times a day, and 398 are a backup tool\'s legitimate activity. What is the best fix?',
    choices: [
      'Filter that tool narrowly and keep the rule enabled',
      'Disable the rule, since almost every alert it raises is noise',
      'Lower its severity to informational and stop looking at it',
      'Leave it as it is: more alerts always means better coverage',
    ],
    answer: 'Filter that tool narrowly and keep the rule enabled',
    misconceptions: {
      'Disable the rule, since almost every alert it raises is noise': 'det-disable-to-tune',
      'Leave it as it is: more alerts always means better coverage': 'det-more-alerts-better',
    },
    explanation:
      'Tuning removes the known-benign pattern as precisely as possible, so the two real hits still alert. A filter on the process name alone would let an attacker name their tool the same; combine several fields. Disabling or burying the rule throws away the detection along with the noise.',
  },
  {
    id: 'det-05',
    skill: 'l3-detection',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which belong in a detection rule\'s documentation so the SOC can use it? (select all)',
    choices: [
      'The ATT&CK technique it covers',
      'Known false positives and how to tell them apart',
      'Triage steps / a runbook link',
      'Required log source and fields',
      'The analyst\'s favourite colour',
    ],
    answer: ['The ATT&CK technique it covers', 'Known false positives and how to tell them apart', 'Triage steps / a runbook link', 'Required log source and fields'],
    explanation:
      'Sigma has fields for these: `tags` (attack.tXXXX), `falsepositives`, `level`, `logsource`, `references`. A rule without triage guidance creates alerts nobody knows how to close; a rule without the log source requirement silently never fires where the log is missing.',
  },
  {
    id: 'det-06',
    skill: 'l3-detection',
    difficulty: 3,
    type: 'mc',
    prompt: 'The team says: "We have a rule for T1558.003, so Kerberoasting is covered." What is the best response?',
    choices: [
      'One rule covers one procedure; test the variants',
      'Agreed: one rule per technique means the technique is covered',
      'Coverage only matters for malware, not for Kerberos attacks',
      'Add the same rule twice to be sure',
    ],
    answer: 'One rule covers one procedure; test the variants',
    misconceptions: {
      'Agreed: one rule per technique means the technique is covered': 'det-one-rule-covers-technique',
    },
    explanation:
      'ATT&CK techniques have many procedures. An RC4-only rule misses attackers who request AES tickets, a burst threshold misses one-ticket-an-hour roasting, and DCs without 4769 auditing see nothing. Coverage maps should say "partial" honestly and be validated with tests (e.g. Atomic Red Team T1558.003).',
  },
  {
    id: 'det-07',
    skill: 'l3-detection',
    difficulty: 1,
    type: 'mc',
    prompt: 'Per the **Pyramid of Pain**, which indicator costs the attacker the most to change when you detect it?',
    choices: [
      'TTPs (behaviour)',
      'File hashes (SHA-256)',
      'IP addresses',
      'Domain names',
    ],
    answer: 'TTPs (behaviour)',
    misconceptions: {
      'File hashes (SHA-256)': 'det-one-rule-covers-technique',
    },
    explanation:
      'Hashes, IPs and domains are trivial to change (recompile, new VPS, new domain). Tools are harder, and behaviour (TTPs: how they dump credentials, move laterally) is hardest. Behavioural detections last longer, though they usually need more tuning.',
  },
  {
    id: 'det-08',
    skill: 'l3-detection',
    difficulty: 3,
    type: 'mc',
    prompt: 'This filter was added to stop false positives from an admin tool. What is wrong with it?',
    snippet:
      'detection:\n  selection:\n    EventID: 1\n    Image|endswith: \'\\procdump.exe\'\n    CommandLine|contains: \'lsass\'\n  filter_admin:\n    Image|contains: \'Tools\'\n  condition: selection and not filter_admin',
    choices: [
      'Too broad: any procdump under a "Tools" path is excluded',
      'Nothing: the filter is precise and only matches admin tools',
      'Sigma rules cannot select on Sysmon EventID 1 at all',
      'The condition should be "selection or filter_admin" instead',
    ],
    answer: 'Too broad: any procdump under a "Tools" path is excluded',
    misconceptions: {
      'Nothing: the filter is precise and only matches admin tools': 'det-disable-to-tune',
      'The condition should be "selection or filter_admin" instead': 'det-more-alerts-better',
    },
    explanation:
      'Exclusions are attack surface. Anchor them tightly: an exact full path in a protected directory, a specific user or host, a signer, ideally several at once. Review exclusions regularly and test that the malicious variant still fires.',
  },
  {
    id: 'det-09',
    skill: 'l3-detection',
    difficulty: 2,
    type: 'text',
    prompt: 'A rule produced 50 alerts last month; 10 were true positives. What is its precision, as a percentage?',
    accept: ['20', '20%', '20 %', '0.2', '20 percent'],
    misconceptions: { '80': 'det-more-alerts-better', '80%': 'det-more-alerts-better', '10': 'det-more-alerts-better' },
    explanation:
      'Precision = true positives ÷ all alerts = 10 ÷ 50 = **20%**. Four in five alerts waste analyst time, which erodes trust in the rule. Track precision (and, via testing, whether the rule catches the attack at all) for every rule you own, and tune the worst offenders.',
  },
  {
    id: 'det-10',
    skill: 'l3-detection',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which practices belong to **detection-as-code**? (select all)',
    choices: [
      'Rules stored in version control with peer review of changes',
      'Automated tests that replay known-bad and known-good logs against each rule',
      'Attack emulation (e.g. Atomic Red Team) to prove a rule fires end to end',
      'Editing rules directly in production with no record',
      'Deleting a rule\'s history when it is changed',
    ],
    answer: [
      'Rules stored in version control with peer review of changes',
      'Automated tests that replay known-bad and known-good logs against each rule',
      'Attack emulation (e.g. Atomic Red Team) to prove a rule fires end to end',
    ],
    misconceptions: { 'Editing rules directly in production with no record': 'det-disable-to-tune' },
    explanation:
      'Treat rules like software: reviewed changes, tests that must pass before deployment (true-positive samples fire, known benign samples do not), and periodic emulation to catch broken log pipelines. It also records why each exclusion exists.',
  },
  {
    id: 'det-11',
    skill: 'l3-detection',
    difficulty: 1,
    type: 'mc',
    prompt: 'Before writing a rule for AS-REP roasting, what should you check first?',
    choices: [
      'That 4768 events with pre-auth type are collected',
      'That the rule has a catchy name',
      'That the rule produces as many alerts as possible from day one',
      'That the attacker always uses one specific source IP address',
    ],
    answer: 'That 4768 events with pre-auth type are collected',
    misconceptions: {
      'That the rule produces as many alerts as possible from day one': 'det-more-alerts-better',
      'That the attacker always uses one specific source IP address': 'det-one-rule-covers-technique',
    },
    explanation:
      'A rule over logs you do not collect never fires, and nobody notices. Start from the data source: is Kerberos Authentication Service auditing enabled on all DCs, are the events forwarded, and are the fields parsed? ATT&CK lists the data components each technique needs.',
  },
  {
    id: 'det-12',
    skill: 'l3-detection',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which ATT&CK technique ID should a rule for **Data Encrypted for Impact** (ransomware encryption) carry?',
    choices: [
      'T1486',
      'T1566',
      'T1490',
      'T1485',
    ],
    answer: 'T1486',
    misconceptions: {
      'T1566': 'det-one-rule-covers-technique',
    },
    explanation:
      'T1486 is Data Encrypted for Impact. Others you meet in Level 3: T1558.003 Kerberoasting, T1558.004 AS-REP roasting, T1558.001 golden ticket, T1550.002 pass-the-hash, T1003.006 DCSync, T1078.004 cloud accounts, T1490 Inhibit System Recovery. T1566 is phishing and T1059.001 PowerShell.',
  },
];

const lesson = {
  skill: 'l3-detection',
  title: 'Detection engineering',
  goal: 'Write, test and tune detection rules that catch attacker behaviour without drowning the SOC.',
  sections: [
    {
      id: 'sigma',
      heading: 'Anatomy of a Sigma rule',
      body: [
        '**Sigma** is an open YAML format for log detections, converted to SPL, KQL or Elastic queries by `sigma-cli` (pySigma). It is a rule format, not a product.',
      ],
      points: [
        '`logsource`: product, category or service (windows / process_creation, windows / security).',
        '`detection`: named selections of field-value matches, with modifiers like `|contains`, `|endswith`, `|re`.',
        '`condition`: the logic that combines them, e.g. `selection and not 1 of filter_*`.',
        'Metadata: `title`, `status`, `level`, `falsepositives`, `tags` (ATT&CK ids such as attack.t1558.003).',
      ],
      evidence: {
        label: 'Sigma: AS-REP roasting',
        text: "title: AS-REP roastable account ticket request\nlogsource: { product: windows, service: security }\ndetection:\n  selection:\n    EventID: 4768\n    PreAuthType: '0'\n    Status: '0x0'\n  condition: selection\nfalsepositives: [ legacy accounts documented in the exception list ]\nlevel: high\ntags: [ attack.credential-access, attack.t1558.004 ]",
      },
    },
    {
      id: 'lifecycle',
      heading: 'From idea to production',
      body: [
        'Start from a **threat** (a technique you care about) and the **data** it leaves. Confirm the log source is collected everywhere it needs to be; a rule over missing logs fails silently.',
        'Write the rule, then **test** it: replay known-bad samples (it must fire) and a week of normal data (count the noise). Emulate the attack (Atomic Red Team) to prove the pipeline works end to end. Keep rules in version control with peer review: **detection-as-code**.',
      ],
    },
    {
      id: 'tuning',
      heading: 'Tuning without going blind',
      body: [
        'More alerts is not better: every false positive costs analyst time and trust. Track **precision** (true positives ÷ alerts) per rule.',
        'Tune by removing the known-benign pattern **narrowly**: combine exact path, signer, account and host. Broad exclusions (`Image|contains: Tools`) are gaps an attacker can use. Disabling a noisy rule throws away the detection; fix it or add a threshold instead.',
      ],
    },
    {
      id: 'attack',
      heading: 'ATT&CK coverage, honestly',
      body: [
        'Map each rule to ATT&CK techniques, but remember that one rule covers one or two **procedures**, not a whole technique. Kerberoasting (T1558.003) with AES tickets, one request per hour, or from a DC-adjacent host may slip past an RC4 burst rule.',
        'Prefer behaviour over indicators (the **Pyramid of Pain**): hashes and IPs change daily, TTPs rarely. Useful Level 3 ids: T1558.001/.003/.004, T1550.002, T1003.006, T1078.004, T1530, T1490, T1486.',
      ],
    },
  ],
  worked: [
    {
      id: 'det-w1',
      title: 'Tuning a noisy LSASS rule',
      artifactLabel: 'Rule stats, last 30 days',
      artifact:
        'Rule: LSASS memory access (Sysmon 10, TargetImage lsass.exe, GrantedAccess 0x1010)\nAlerts: 1,240   True positives: 1\nTop sources:  C:\\Program Files\\ExampleAV\\avscan.exe (signed ExampleAV Inc)  1,190\n              C:\\Windows\\System32\\wbem\\WmiPrvSE.exe  48\n              C:\\Users\\Public\\p.exe  1   <- the true positive',
      question: 'How do you tune it without losing the true positive?',
      steps: [
        'Precision is 1 in 1,240: analysts will start ignoring this rule, so it must be tuned, not disabled.',
        'The AV scanner is 96% of the noise. Filter it on the **exact** path in Program Files **and** its signer, not on "avscan" anywhere.',
        'WmiPrvSE needs investigation before exclusion: check which WMI activity triggers it and whether the access mask differs from credential dumping.',
        'Re-run the rule over the 30 days: the p.exe hit must still fire. Commit the change with the reason, and add a test sample for the true positive.',
      ],
      conclusion: 'Narrow, documented exclusions plus a replay test turn a rule nobody trusts into one that catches the real event.',
    },
  ],
  faded: [
    {
      id: 'det-f1',
      title: 'Writing the condition',
      artifactLabel: 'Draft Sigma rule',
      artifact:
        "detection:\n  selection:\n    EventID: 4769\n    TicketEncryptionType: '0x17'\n  filter_machine:\n    ServiceName|endswith: '$'\n  filter_legacy:\n    ServiceName: 'svc_legacy_scan'   # documented RC4-only appliance\n  condition: ???",
      question: 'Finish the rule.',
      given: ['You want RC4 service tickets, minus machine accounts and the one documented legacy service.'],
      todo: [
        {
          prompt: 'Which condition is right?',
          type: 'mc',
          choices: ['selection and not 1 of filter_*', 'selection or filter_machine or filter_legacy', 'selection and filter_machine'],
          answer: 'selection and not 1 of filter_*',
          explanation: '"not 1 of filter_*" excludes events that match any filter; "or" would add the filtered events instead of removing them.',
        },
        {
          prompt: 'Which ATT&CK technique ID should the tags carry? (e.g. T1234.001)',
          type: 'text',
          accept: ['t1558.003', 'attack.t1558.003'],
          explanation: 'T1558.003 Steal or Forge Kerberos Tickets: Kerberoasting.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'det-more-alerts-better',
    skill: 'l3-detection',
    name: 'More alerts means better detection',
    description: 'Judges a rule by how often it fires, or keeps noisy rules because they "cover more".',
    fix: 'A rule is only as good as its precision (true positives ÷ alerts) and whether it fires on the real attack. Noise burns analyst time and trains people to close alerts unread. Measure precision per rule, test with known-bad samples, and tune until most alerts are worth opening.',
    lesson: 'l3-detection#tuning',
  },
  {
    id: 'det-sigma-is-a-product',
    skill: 'l3-detection',
    name: 'Sigma is a tool or SIEM',
    description: 'Thinks Sigma is a product that collects logs, or confuses its parts (logsource, selection, condition).',
    fix: 'Sigma is an open YAML rule format, converted by sigma-cli into queries for Splunk, Sentinel, Elastic and others. logsource says which logs the rule applies to, detection holds named selections and filters, and condition combines them (e.g. selection and not 1 of filter_*).',
    lesson: 'l3-detection#sigma',
  },
  {
    id: 'det-disable-to-tune',
    skill: 'l3-detection',
    name: 'Tuning by disabling or broad exclusions',
    description: 'Silences noisy rules by disabling them, or adds wide exclusions that attackers can use.',
    fix: 'Remove only the known-benign pattern, anchored on several fields (exact path, signer, account, host), keep the rule enabled, and replay known-bad samples to prove it still fires. Record every exclusion and its reason in version control and review exclusions regularly.',
    lesson: 'l3-detection#tuning',
  },
  {
    id: 'det-one-rule-covers-technique',
    skill: 'l3-detection',
    name: 'One rule covers a technique',
    description: 'Marks an ATT&CK technique as covered because one rule is tagged with it, or relies on hashes and IPs.',
    fix: 'Techniques have many procedures and variants; one rule catches one or two. Check the data source exists everywhere, test variants with emulation, mark coverage as partial when it is, and prefer behavioural detections (TTPs) over indicators that the attacker changes daily (Pyramid of Pain).',
    lesson: 'l3-detection#attack',
  },
];

export const DETECTION = { items, lesson, misconceptions };

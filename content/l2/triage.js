// Level 2 · Alert triage: questions, lesson and misconceptions.
// Formats: see content/questions/host.js, content/lessons/host.js and content/misconceptions.js.

const items = [
  {
    id: 'at-01',
    skill: 'l2-alert-triage',
    difficulty: 1,
    type: 'mc',
    prompt: 'An alert is a **true positive**. What does that mean?',
    choices: [
      'The described activity really happened and is malicious or unwanted',
      'The rule fired, but the activity it describes did not actually happen',
      'The activity happened, but it was authorised, such as an IT admin at work',
      'A real attack happened on the network, but no alert fired for it',
    ],
    answer: 'The described activity really happened and is malicious or unwanted',
    misconceptions: {
      'The activity happened, but it was authorised, such as an IT admin at work': 'triage-fp-btp',
    },
    explanation:
      'True positive = the detection is right and the activity is a real problem, so it gets worked or escalated. Authorised activity that really happened is a **benign** true positive. An alert whose activity never happened (bad parsing, a keyword match on the wrong thing) is a false positive. A missed attack with no alert is a false negative.',
  },
  {
    id: 'at-02',
    skill: 'l2-alert-triage',
    difficulty: 1,
    type: 'mc',
    prompt: 'The security team\'s own scheduled vulnerability scanner triggers a "Port scan detected" alert during its approved window. How should it be classified?',
    choices: [
      'Benign true positive',
      'False positive (a bad rule)',
      'True positive',
      'False negative',
    ],
    answer: 'Benign true positive',
    misconceptions: {
      'False positive (a bad rule)': 'triage-fp-btp',
    },
    explanation:
      'A port scan really happened, so the rule worked: it is not a false positive. It was authorised and expected, which makes it a **benign true positive**. Document the change or schedule you checked, and consider a narrow exclusion (that scanner, that window) rather than switching the rule off.',
  },
  {
    id: 'at-03',
    skill: 'l2-alert-triage',
    difficulty: 2,
    type: 'mc',
    prompt: 'Two alerts arrive at the same time, both rated **High** by the rule: "Suspicious service installed" on the domain controller SRV-DC01, and the same rule on LAB-KIOSK-3, an isolated demo PC. You can only start one. Which first, and why?',
    choices: [
      'SRV-DC01: priority weighs asset criticality, not just severity',
      'LAB-KIOSK-3: it is quicker to close, so the queue moves faster',
      'Either: equal severity means they have equal priority',
      'Whichever of the two arrived first, even by a few seconds',
    ],
    answer: 'SRV-DC01: priority weighs asset criticality, not just severity',
    misconceptions: {
      'Either: equal severity means they have equal priority': 'triage-severity-priority',
      'Whichever of the two arrived first, even by a few seconds': 'triage-severity-priority',
    },
    explanation:
      'Severity is how bad the detected behaviour could be. **Priority** is what you work first, and it adds context: how critical the asset is, how privileged the account is, whether the activity is still going on and how far it could spread. A domain controller controls every account in the domain; an isolated kiosk does not.',
  },
  {
    id: 'at-04',
    skill: 'l2-alert-triage',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which facts should **raise** the priority of an alert? Select all that apply.',
    choices: [
      'The suspicious process is still running and connecting out',
      'The account involved is a domain admin',
      'The host is a server that stores customer payment data',
      'The alert fired at 02:00 rather than 14:00',
      'The detection rule is the oldest one in the SIEM',
    ],
    answer: ['The suspicious process is still running and connecting out', 'The account involved is a domain admin', 'The host is a server that stores customer payment data'],
    misconceptions: { 'The alert fired at 02:00 rather than 14:00': 'triage-severity-priority' },
    explanation:
      'Active activity, privileged accounts and crown-jewel assets all raise priority. The time of day is context (odd hours can support a verdict) but is not a priority factor by itself: plenty of attacks happen in office hours and plenty of batch jobs run at night. The age of the rule says nothing about this alert.',
  },
  {
    id: 'at-05',
    skill: 'l2-alert-triage',
    difficulty: 2,
    type: 'mc',
    prompt: 'The rule "Credential theft tool keyword in command line" fired. This is the raw event. What is the verdict?',
    snippet: String.raw`Rule:      CommandLine contains "mimikatz"
Host:      SOC-WS-02    User: nadia (SOC analyst)
Process:   findstr.exe  Parent: cmd.exe
CommandLine: findstr /i "mimikatz" C:\Reports\edr-detections-sept.csv`,
    choices: [
      'False positive: a text search matched; no tool ran. Tune it',
      'True positive: mimikatz was executed on SOC-WS-02 by nadia',
      'Benign true positive: an analyst ran mimikatz as part of her job',
      'Benign: exclude SOC-WS-02 from the rule so it stops firing',
    ],
    answer: 'False positive: a text search matched; no tool ran. Tune it',
    misconceptions: {
      'Benign: exclude SOC-WS-02 from the rule so it stops firing': 'triage-broad-allowlist',
      'Benign true positive: an analyst ran mimikatz as part of her job': 'triage-fp-btp',
      'True positive: mimikatz was executed on SOC-WS-02 by nadia': 'triage-raw-event',
    },
    explanation:
      'Always read the raw event behind an alert. findstr searched a CSV report for the word "mimikatz": the behaviour the rule is meant to catch (running a credential dumper) never happened, so it is a **false positive**. The fix is rule tuning (match the process or its behaviour, not any command line containing the word). Excluding the whole workstation would also hide a real credential dumper run there.',
  },
  {
    id: 'at-06',
    skill: 'l2-alert-triage',
    difficulty: 1,
    type: 'text',
    prompt: 'A real attack happened, but no rule fired and no alert was raised. What is this called? (two words)',
    accept: ['false negative', 'a false negative', 'false-negative', 'fn'],
    misconceptions: { 'false positive': 'triage-fp-btp' },
    explanation:
      'A **false negative** is a miss: malicious activity with no alert. False negatives are the dangerous ones because nobody looks. Threat hunting and detection engineering exist largely to find and close them.',
  },
  {
    id: 'at-07',
    skill: 'l2-alert-triage',
    difficulty: 2,
    type: 'mc',
    prompt: 'An alert says mark@corp.example signed in from an unusual country. You email Mark and get a reply from that mailbox: "Yes, that was me, I\'m travelling." What next?',
    choices: [
      'Verify through a separate, known channel and check the sign-in',
      'Close it as benign: Mark has already confirmed it was him by email',
      'Close it as a false positive: the sign-in really was Mark',
      'Disable Mark\'s account permanently until he is back home',
    ],
    answer: 'Verify through a separate, known channel and check the sign-in',
    misconceptions: {
      'Close it as benign: Mark has already confirmed it was him by email': 'triage-blocked-closed',
      'Close it as a false positive: the sign-in really was Mark': 'triage-fp-btp',
    },
    explanation:
      'If the mailbox is compromised, the attacker answers the email. Verify out of band, and check the evidence too: device, MFA method, travel records, and whether the "home" sign-ins continue at the same time. Disabling the account permanently is out of proportion before you know anything.',
  },
  {
    id: 'at-08',
    skill: 'l2-alert-triage',
    difficulty: 3,
    type: 'mc',
    prompt: 'Your queue at the start of a shift. Which alert do you open first?',
    snippet: `#  Sev   Rule                                   Host / user
1  High  Malware quarantined by AV (EICAR test)  WS-IT-04 / it-tester
2  Med   Outbound beacon every 60 s, still live  SRV-SQL02 / svc_sql
3  High  10 failed logons, account locked        WS-HR-08 / amara
4  Low   New browser extension installed         WS-MKT-11 / leo`,
    choices: [
      '2: a live, repeating outbound connection from a database server',
      '1: it is rated High and it says malware was found on a host',
      '3: it is rated High and an account is locked out right now, so act',
      '4: it is Low, so it is the quickest to close and clear first',
    ],
    answer: '2: a live, repeating outbound connection from a database server',
    misconceptions: {
      '1: it is rated High and it says malware was found on a host': 'triage-severity-priority',
      '3: it is rated High and an account is locked out right now, so act': 'triage-severity-priority',
    },
    explanation:
      'Triage by risk, not by the rule\'s label. Alert 2 is live, on a server holding data, under a service account: if it is C2, every minute counts. Alert 1 is a quarantined test file (EICAR is a harmless AV test string). Alert 3 is a lockout, which means the password attempts failed. Both still get a look, but after the live one.',
  },
  {
    id: 'at-09',
    skill: 'l2-alert-triage',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which belong in a good triage note on the ticket? Select all that apply.',
    choices: [
      'The verdict and your confidence in it',
      'The specific evidence you checked (log source, event, time)',
      'What you did and what should happen next',
      'A paste of every raw log from the time window, unfiltered',
      'Your opinion of the user involved',
    ],
    answer: ['The verdict and your confidence in it', 'The specific evidence you checked (log source, event, time)', 'What you did and what should happen next'],
    explanation:
      'The next person (Tier 2, the day shift, an auditor) needs the call, the evidence behind it and the next step. A dump of unfiltered logs hides the important lines, and personal opinions have no place in a ticket that may be read in an HR or legal process.',
  },
  {
    id: 'at-10',
    skill: 'l2-alert-triage',
    difficulty: 3,
    type: 'mc',
    prompt: 'Every night the backup agent triggers "Mass file modification" on the file servers. You have confirmed it is benign. What is the best tuning?',
    choices: [
      'Exclude only the signed backup binary and its service account',
      'Exclude the file servers from the rule entirely and for good',
      'Disable the rule: it only ever produces noise on these servers',
      'Leave it: analysts can simply close the alert every morning',
    ],
    answer: 'Exclude only the signed backup binary and its service account',
    misconceptions: {
      'Exclude the file servers from the rule entirely and for good': 'triage-broad-allowlist',
      'Disable the rule: it only ever produces noise on these servers': 'triage-broad-allowlist',
    },
    explanation:
      'Tune as narrowly as the evidence allows: process path plus signer plus account plus hosts. Excluding the whole server or disabling the rule blinds you to real ransomware on exactly the machines it targets. Leaving known noise in the queue feeds **alert fatigue**, which is how real alerts get missed.',
  },
  {
    id: 'at-11',
    skill: 'l2-alert-triage',
    difficulty: 1,
    type: 'text',
    prompt: 'Analysts see so many low-value alerts that they start skimming and closing them without real checks. What is this problem called? (two words)',
    accept: ['alert fatigue', 'alarm fatigue'],
    explanation:
      '**Alert fatigue** is a top cause of missed incidents. The cure is tuning (narrow exclusions, better logic), removing duplicate rules and feeding false positives back to detection engineering, not asking analysts to try harder.',
  },
  {
    id: 'at-12',
    skill: 'l2-alert-triage',
    difficulty: 3,
    type: 'mc',
    prompt: 'EDR alert: "Excel spawned rundll32 loading a DLL from the user\'s Temp folder" on WS-FIN-02. The EDR **blocked** it and killed the process. What now?',
    choices: [
      'Keep working it: find the email, other recipients, unblocked stages',
      'Close it: the EDR blocked it, so there is nothing left for you to do',
      'Close it as a false positive, because nothing actually ran',
      'Reimage WS-FIN-02 immediately and close the alert as resolved',
    ],
    answer: 'Keep working it: find the email, other recipients, unblocked stages',
    misconceptions: {
      'Close it: the EDR blocked it, so there is nothing left for you to do': 'triage-blocked-closed',
      'Close it as a false positive, because nothing actually ran': 'triage-fp-btp',
    },
    explanation:
      'A block stops one step, not the attacker. Someone delivered a weaponised document that the user opened: the same email may be in 40 other mailboxes, and an earlier or later stage may have worked. It is a true positive (malicious, correctly detected) with lower urgency than a live compromise. Reimaging is premature before you know the scope.',
  },
  {
    id: 'at-13',
    skill: 'l2-alert-triage',
    difficulty: 1,
    type: 'mc',
    prompt: 'A new alert lands. What do you look at first?',
    choices: [
      'What the rule detects and the raw event that triggered it',
      'The user\'s social media profile and recent public posts',
      'Whether it was closed last week, so you can close it the same way',
      'The SIEM\'s licence usage dashboard for today\'s data volume',
    ],
    answer: 'What the rule detects and the raw event that triggered it',
    misconceptions: {
      'Whether it was closed last week, so you can close it the same way': 'triage-raw-event',
    },
    explanation:
      'Start with the facts: what the rule is looking for and the actual event behind the alert (host, user, process, time). Past closures are useful context, but copying last week\'s verdict without reading this event is how a real attack that looks like old noise slips through.',
  },
];

const lesson = {
  skill: 'l2-alert-triage',
  title: 'Alert triage',
  goal: 'Decide quickly and defensibly: is it real, how urgent is it, and what happens next?',
  sections: [
    {
      id: 'outcomes',
      heading: 'Four possible outcomes',
      body: [
        'Triage answers three questions fast: **Is it real? How bad could it be? What next?** Every alert ends in one of these classifications:',
      ],
      points: [
        '**True positive (TP):** the activity happened and it is malicious. Work it or escalate.',
        '**Benign true positive (BTP):** the activity happened but it is authorised or expected (a scheduled scanner, an admin script). Document the proof.',
        '**False positive (FP):** the activity described never happened: a keyword matched the wrong thing, a field was misparsed. Tune the rule.',
        '**False negative (FN):** an attack with no alert at all. You only find these by hunting or after the fact.',
      ],
    },
    {
      id: 'first-checks',
      heading: 'The first checks',
      body: ['Work from the raw evidence outwards. Most alerts can be called within minutes with these checks:'],
      points: [
        '**What fired and why:** read the rule logic and the raw event behind it. Does the event really show the behaviour?',
        '**Who and where:** which user and asset? Is the account privileged? Is the host a server, a crown jewel, internet-facing?',
        '**Is it expected?** Change tickets, maintenance windows, known admin tools, the asset\'s normal behaviour.',
        '**Before and after:** what led up to it and what followed (logons, processes, connections)?',
      ],
      evidence: {
        label: 'Triage note template',
        text: 'Verdict:     BTP (confidence: high)\nEvidence:    4720 on SRV-PRINT02 at 10:14 by it-admin-kim; matches CHG-4471\nChecked:     change ticket, approver, account added to Print Operators only\nNext:        none; closed. Suggest exclusion for CHG-tagged account creation',
      },
    },
    {
      id: 'priority',
      heading: 'Severity vs priority',
      body: [
        '**Severity** is how bad the detected behaviour could be (the rule\'s label). **Priority** is what you work first, and it adds context: the same "High" alert matters far more on a domain controller than on a lab kiosk.',
      ],
      points: [
        '**Active now** beats historical: a live beacon outranks a quarantined file.',
        '**Privileged accounts** and **critical assets** raise priority.',
        '**Spread:** activity touching several hosts, or one host touching many, raises priority.',
        '**Confidence:** a strong, specific signal outranks a vague one.',
      ],
    },
    {
      id: 'blocked-confirmed',
      heading: 'Blocked, confirmed... and still open',
      body: [
        'Two tempting shortcuts cause missed incidents. **"The EDR blocked it"** only means one step failed: find the delivery (email, download) and check whether anything else ran. **"The user confirmed it"** only counts if you asked through a channel the attacker cannot control: if the mailbox is compromised, the attacker answers the email.',
      ],
    },
    {
      id: 'tuning',
      heading: 'Close the loop: document and tune',
      body: [
        'Write the verdict, the evidence and the next step so anyone can pick it up. Recurring benign alerts should be tuned, as **narrowly** as possible: this signed binary, this account, these hosts. Excluding a whole server or disabling the rule trades noise for blindness. Unchecked noise creates **alert fatigue**, the condition where real alerts get closed unread.',
      ],
    },
  ],
  worked: [
    {
      id: 'at-w1',
      title: 'Ordering a small queue',
      artifactLabel: 'Alert queue · 08:02',
      artifact:
        '#  Sev   Rule                                     Host / user\n1  High  AV: Trojan quarantined (file deleted)     WS-SLS-03 / ben\n2  Med   Rare outbound connection, repeating 5m    SRV-WEB01 / www-data\n3  Low   Password spray: 40 users, 1 IP, 0 success  VPN-GW / (many)',
      question: 'Which order do you work these in, and why?',
      steps: [
        'Alert 1 looks scariest (High, "Trojan"), but the AV already deleted the file. The questions left are how it arrived and whether anything else ran. Important, but not live.',
        'Alert 2 is repeating every 5 minutes right now, from an internet-facing web server running as the web service account. A regular heartbeat to a rare destination is a classic C2 pattern. It is live and on an exposed asset.',
        'Alert 3 shows spraying with zero successes. Check that "0 success" is true (look for any 4624 or VPN success from that IP), block the IP, and note the targeted users.',
        'Priority is not the severity column: it is severity plus asset, account and whether it is active.',
      ],
      conclusion: 'Work 2 first (live, exposed server), then 1 (find the delivery and other victims), then 3 (verify no success, block). Note the reasoning on each ticket.',
    },
  ],
  faded: [
    {
      id: 'at-f1',
      title: 'New local admin on a print server',
      artifactLabel: 'Alert + raw events + ticket',
      artifact:
        'ALERT  New member added to local Administrators · SRV-PRINT02 · 10:14\n4720  A user account was created: printsvc2   by: it-admin-kim\n4732  Member added to Administrators: printsvc2  by: it-admin-kim\nCHG-4471 (approved): "Create printsvc2 service account on SRV-PRINT02 for new print driver deployment". Implementer: it-admin-kim. Window: 10:00-11:00',
      question: 'Classify the alert and decide what to record.',
      given: [
        'The raw events confirm the activity happened: 4720 (account created) and 4732 (added to Administrators) on SRV-PRINT02.',
        'The change ticket names the same account, host, implementer and a window that contains 10:14.',
      ],
      todo: [
        {
          prompt: 'What is the classification?',
          type: 'mc',
          choices: ['Benign true positive', 'False positive', 'True positive'],
          answer: 'Benign true positive',
          explanation: 'The account really was created and made an admin (so not a false positive), and it was approved and performed as planned. That is a benign true positive.',
        },
        {
          prompt: 'What should the ticket note contain?',
          type: 'mc',
          choices: [
            'The change number, the matching events and implementer, and the verdict',
            'Just "closed, known activity"',
            'A request to disable the rule',
          ],
          answer: 'The change number, the matching events and implementer, and the verdict',
          explanation: 'Record the proof, so an auditor or the next analyst can see why it was closed. "Known activity" with no evidence is how attackers hide inside noise.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'triage-fp-btp',
    skill: 'l2-alert-triage',
    name: 'Calling authorised activity a false positive',
    description: 'Mixes up false positives (the activity did not happen) with benign true positives (it happened, but it was allowed).',
    fix: 'Ask: did the activity the rule describes really happen? If no (a keyword matched a text search, a field was misparsed) it is a false positive and the rule needs fixing. If yes but it was authorised (a scheduled scanner, an approved change) it is a benign true positive: the rule worked, so document the proof and tune narrowly. If yes and it is malicious, it is a true positive.',
    lesson: 'l2-alert-triage#outcomes',
  },
  {
    id: 'triage-severity-priority',
    skill: 'l2-alert-triage',
    name: 'Severity label = work order',
    description: 'Works the queue by the rule\'s severity label (or arrival order) and ignores asset, account and whether the activity is still live.',
    fix: 'Severity is the rule\'s estimate of how bad the behaviour could be. Priority adds context: is it still happening, how critical is the asset, how privileged is the account, is it spreading? A "Medium" live beacon from a database server outranks a "High" quarantined test file.',
    lesson: 'l2-alert-triage#priority',
  },
  {
    id: 'triage-blocked-closed',
    skill: 'l2-alert-triage',
    name: '"Blocked" or "user confirmed" means done',
    description: 'Closes an alert because a control blocked one step, or because the user confirmed by email.',
    fix: 'A block stops one step: the delivery (email, download) and the other recipients still need checking, and an earlier or later stage may have worked. User confirmation only counts through a channel the attacker cannot control: a compromised mailbox answers emails too. Verify out of band and check the evidence.',
    lesson: 'l2-alert-triage#blocked-confirmed',
  },
  {
    id: 'triage-raw-event',
    skill: 'l2-alert-triage',
    name: 'Trusting the alert title over the raw event',
    description: 'Takes the alert name (or last week\'s verdict) at face value without reading the event that triggered it.',
    fix: 'The alert title is the rule\'s hypothesis. The raw event is the fact. Open it: which process, which command line, which user, which host? A "mimikatz" alert can be a text search for the word; a "known noise" alert can be the one real attack this month.',
    lesson: 'l2-alert-triage#first-checks',
  },
  {
    id: 'triage-broad-allowlist',
    skill: 'l2-alert-triage',
    name: 'Tuning with a sledgehammer',
    description: 'Silences a noisy rule by excluding whole hosts or disabling it.',
    fix: 'Exclude only what you verified: this signed binary, this path, this account, on these hosts. A whole-host exclusion or a disabled rule creates a blind spot exactly where attackers like to be, such as file servers for ransomware.',
    lesson: 'l2-alert-triage#tuning',
  },
];

export const TRIAGE = { items, lesson, misconceptions };

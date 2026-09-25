// Level 2 · Incident response: questions, lesson and misconceptions.
// Built on NIST SP 800-61 (Rev. 2 lifecycle; Rev. 3, April 2025, maps it onto CSF 2.0) and RFC 3227.

const items = [
  {
    id: 'ir-01',
    skill: 'l2-ir',
    difficulty: 1,
    type: 'mc',
    prompt: 'What are the phases of the incident response lifecycle in NIST SP 800-61 (Rev. 2), in order?',
    choices: [
      'Preparation → Detection & Analysis → Containment, Eradication & Recovery → Post-Incident Activity',
      'Detection → Preparation → Recovery → Containment',
      'Containment → Detection & Analysis → Preparation → Lessons learned',
      'Reconnaissance → Delivery → Exploitation → Actions on Objectives',
    ],
    answer: 'Preparation → Detection & Analysis → Containment, Eradication & Recovery → Post-Incident Activity',
    misconceptions: { 'Reconnaissance → Delivery → Exploitation → Actions on Objectives': 'ir-phase-mixup' },
    explanation:
      'The four-phase lifecycle is a loop: lessons from Post-Incident Activity feed back into Preparation, and analysis continues during containment. (SANS teaches the same ideas as PICERL: Preparation, Identification, Containment, Eradication, Recovery, Lessons learned.) NIST SP 800-61 Rev. 3 (2025) reorganises the guidance around the CSF 2.0 functions, but these phases remain the everyday working model. The last option is the attacker\'s Kill Chain.',
  },
  {
    id: 'ir-02',
    skill: 'l2-ir',
    difficulty: 1,
    type: 'text',
    prompt: 'In which NIST SP 800-61 phase does the "lessons learned" meeting take place? (two or three words)',
    accept: ['post-incident activity', 'post-incident', 'post incident activity', 'post incident', 'post-incident activities'],
    misconceptions: { recovery: 'ir-phase-mixup', eradication: 'ir-phase-mixup', preparation: 'ir-phase-mixup' },
    explanation:
      '**Post-Incident Activity**: a blameless lessons-learned review (ideally within about two weeks), final report, evidence retention, and improvements to detections, playbooks and controls, which feed the next Preparation phase.',
  },
  {
    id: 'ir-03',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: 'A laptop is actively beaconing to a C2 server. Why do responders usually **isolate it with EDR** rather than switch it off?',
    choices: [
      'Powering off destroys volatile evidence (running processes, network connections, injected code, keys in memory); isolation stops the attacker and keeps it',
      'Switching off takes too long',
      'EDR isolation deletes the malware automatically',
      'Laptops cannot be switched off remotely',
    ],
    answer: 'Powering off destroys volatile evidence (running processes, network connections, injected code, keys in memory); isolation stops the attacker and keeps it',
    misconceptions: { 'EDR isolation deletes the malware automatically': 'ir-evidence-volatile' },
    explanation:
      'Much modern malware lives only in memory. Network isolation cuts it off from C2 and the rest of the network while the machine stays running, so you can capture memory and live data. Isolation is containment, not cleaning: the malware is still there until eradication.',
  },
  {
    id: 'ir-04',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: 'Following the **order of volatility** (RFC 3227), what do you collect first from a running compromised server?',
    choices: [
      'Memory (RAM) and live system state such as processes and network connections',
      'A full image of the hard disk',
      'Last month\'s backup tapes',
      'Printouts of the event logs',
    ],
    answer: 'Memory (RAM) and live system state such as processes and network connections',
    misconceptions: { 'A full image of the hard disk': 'ir-evidence-volatile' },
    explanation:
      'Collect the most short-lived data first: CPU state and caches, then memory and routing/ARP/process tables, then temporary files, then disk, then remote logs and archives. The disk will still be there in an hour; the RAM contents will not survive a reboot or even much normal activity.',
  },
  {
    id: 'ir-05',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: 'What is the difference between an **event** and an **incident**?',
    choices: [
      'An event is any observable occurrence; an incident is an event (or series) that violates or threatens security policy',
      'They are the same thing',
      'An incident is any log line; an event is a confirmed breach',
      'Events are on Windows, incidents are on Linux',
    ],
    answer: 'An event is any observable occurrence; an incident is an event (or series) that violates or threatens security policy',
    explanation:
      'Millions of events (logons, connections, file writes) happen daily; a few become adverse events worth investigating; a smaller number are declared **incidents**, which triggers the response plan, roles and communications. Declaring an incident is a decision with consequences, so write down when and why you made it.',
  },
  {
    id: 'ir-06',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'multi',
    prompt: 'You have confirmed a compromised workstation and a stolen account. Which are **short-term containment** actions? Select all that apply.',
    choices: [
      'Network-isolate the workstation with EDR',
      'Disable the account and revoke its sessions and tokens',
      'Block the C2 domain and IP at the proxy, firewall and DNS',
      'Reimage the workstation straight away',
      'Delete the malware file by hand and close the ticket',
    ],
    answer: ['Network-isolate the workstation with EDR', 'Disable the account and revoke its sessions and tokens', 'Block the C2 domain and IP at the proxy, firewall and DNS'],
    misconceptions: {
      'Reimage the workstation straight away': 'ir-eradicate-before-scope',
      'Delete the malware file by hand and close the ticket': 'ir-eradicate-before-scope',
    },
    explanation:
      'Containment stops the damage from spreading while you keep investigating: isolate, disable, block. Reimaging and deleting files are **eradication**: done early, they destroy evidence and leave you blind to other footholds the attacker may still have.',
  },
  {
    id: 'ir-07',
    skill: 'l2-ir',
    difficulty: 3,
    type: 'mc',
    prompt: 'The attacker has footholds on 6 hosts and domain credentials. A colleague wants to clean each host as soon as it is found. Why do responders prefer a **coordinated** eradication?',
    choices: [
      'Piecemeal clean-up tips the attacker off; they switch to footholds you have not found yet. Scope fully, then remove everything at once',
      'Cleaning hosts one at a time is slower to type',
      'Coordinated eradication is required by law',
      'There is no difference, as long as every host is cleaned eventually',
    ],
    answer: 'Piecemeal clean-up tips the attacker off; they switch to footholds you have not found yet. Scope fully, then remove everything at once',
    misconceptions: { 'There is no difference, as long as every host is cleaned eventually': 'ir-eradicate-before-scope' },
    explanation:
      'An attacker watching their implants disappear one by one changes tools, adds persistence or accelerates to ransomware. Contain what is dangerous now (isolate, block), keep scoping, then remove all known persistence, reset credentials and block indicators in one planned window.',
  },
  {
    id: 'ir-08',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: '"Remove the malicious scheduled task, delete the dropped binaries and patch the vulnerable web plugin." Which phase is this?',
    choices: ['Eradication', 'Recovery', 'Detection & Analysis', 'Preparation'],
    answer: 'Eradication',
    misconceptions: { Recovery: 'ir-phase-mixup' },
    explanation:
      '**Eradication** removes the attacker\'s presence and the way in: malware, persistence, compromised accounts, and the vulnerability they used. **Recovery** is returning systems to normal service: restoring from clean backups or builds, validating, and monitoring closely for signs of return.',
  },
  {
    id: 'ir-09',
    skill: 'l2-ir',
    difficulty: 3,
    type: 'mc',
    prompt: 'Which event is the **initial access** (patient zero entry point)?',
    snippet: '09:02  SRV-FS01   4624 svc_sql Logon Type 3 from 10.10.4.27\n08:47  WS-FIN-07  svch0st.exe connects to 198.51.100.77:443\n08:41  WS-FIN-07  WINWORD.EXE > powershell.exe -enc ... (Invoice_4471.docm)\n08:40  MAIL-GW    Delivered: "Invoice 4471" to dana@corp.example, attachment Invoice_4471.docm\n09:10  SRV-FS01   7045 service installed: updsvc',
    choices: [
      '08:40: the phishing email with the macro document delivered to dana',
      '09:02: svc_sql logging on to the file server',
      '08:47: the first C2 connection',
      '09:10: the service installed on SRV-FS01',
    ],
    answer: '08:40: the phishing email with the macro document delivered to dana',
    explanation:
      'Sort by time first: the log is out of order. The chain starts with the email delivery (08:40), then execution when dana opened it (08:41), C2 (08:47), lateral movement with svc_sql (09:02) and persistence on the server (09:10). Finding the entry point tells you what to fix and where else to look (other recipients).',
  },
  {
    id: 'ir-10',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the documented record of who collected, handled and transferred a piece of evidence, when and why? (three words)',
    accept: ['chain of custody', 'chain-of-custody'],
    explanation:
      'The **chain of custody** shows the evidence was not altered between collection and analysis (hashes, timestamps, handlers, storage). Without it, evidence may be unusable in legal proceedings or HR actions, and you cannot prove your own conclusions.',
  },
  {
    id: 'ir-11',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: 'A server was restored from a clean backup. Three days later the attacker is back, logging in over VPN with the same contractor account. What was missed?',
    choices: [
      'Eradication was incomplete: the compromised credentials were never reset and the entry point was not closed',
      'The backup was too old',
      'Recovery monitoring caught it, so nothing was missed',
      'The server should have been restored twice',
    ],
    answer: 'Eradication was incomplete: the compromised credentials were never reset and the entry point was not closed',
    misconceptions: { 'The backup was too old': 'ir-creds-forgotten' },
    explanation:
      'Restoring a machine does not revoke what the attacker holds. Eradication must remove access paths: reset (or disable) compromised accounts, revoke sessions, enforce MFA on the VPN, and fix the vulnerability used. Otherwise the attacker simply walks back in.',
  },
  {
    id: 'ir-12',
    skill: 'l2-ir',
    difficulty: 3,
    type: 'mc',
    prompt: 'Analysis shows a **domain admin** account\'s credentials were dumped from a server\'s memory. Which eradication step is essential?',
    choices: [
      'Reset the domain admin and other exposed privileged/service account passwords, and if domain compromise is suspected reset the krbtgt account twice',
      'Reset only the password of the user who opened the phishing email',
      'Reboot the domain controllers',
      'Nothing: the server was already reimaged',
    ],
    answer: 'Reset the domain admin and other exposed privileged/service account passwords, and if domain compromise is suspected reset the krbtgt account twice',
    misconceptions: {
      'Reset only the password of the user who opened the phishing email': 'ir-creds-forgotten',
      'Nothing: the server was already reimaged': 'ir-creds-forgotten',
    },
    explanation:
      'Every credential that was on that server is burned. With domain admin rights an attacker can forge Kerberos tickets (golden tickets, signed with the krbtgt key), so the krbtgt password is reset **twice** (it keeps the previous key), spaced out to let replication complete. Reimaging the server does nothing about credentials that already left it.',
  },
  {
    id: 'ir-13',
    skill: 'l2-ir',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which of these belongs to the **Preparation** phase?',
    choices: [
      'Writing playbooks, keeping contact lists current, making sure the right logs exist, and running tabletop exercises',
      'Isolating an infected host',
      'Restoring a server from backup',
      'Writing the final incident report',
    ],
    answer: 'Writing playbooks, keeping contact lists current, making sure the right logs exist, and running tabletop exercises',
    misconceptions: { 'Writing the final incident report': 'ir-phase-mixup' },
    explanation:
      'Preparation is everything done before the incident so the response is fast: plans and playbooks, roles and on-call rotas, out-of-band communication, logging and EDR coverage, forensic tooling, practice. Isolating is containment, restoring is recovery, the final report is post-incident activity.',
  },
  {
    id: 'ir-14',
    skill: 'l2-ir',
    difficulty: 2,
    type: 'mc',
    prompt: 'During an active incident the attacker may have access to corporate email. How should the response team coordinate?',
    choices: [
      'Out of band: a separate chat or phone bridge the attacker cannot read, set up in advance',
      'Email as usual, marked "Confidential"',
      'A reply-all thread with the whole company',
      'Messages in the ticket of the compromised user',
    ],
    answer: 'Out of band: a separate chat or phone bridge the attacker cannot read, set up in advance',
    explanation:
      'Attackers in a mailbox read the incident thread and adapt, or delete evidence. Plans should include an out-of-band channel (separate tenant chat, phone bridge) and a contact list that does not live only in the compromised systems.',
  },
];

const lesson = {
  skill: 'l2-ir',
  title: 'Incident response',
  goal: 'Run an incident through the NIST lifecycle without destroying evidence or tipping off the attacker.',
  sections: [
    {
      id: 'lifecycle',
      heading: 'The lifecycle',
      body: [
        'NIST SP 800-61 describes a loop of four phases: **Preparation**; **Detection & Analysis**; **Containment, Eradication & Recovery**; **Post-Incident Activity**. Analysis continues throughout, and lessons learned feed back into preparation.',
        'Rev. 3 (April 2025) maps incident response onto the NIST CSF 2.0 functions (Govern, Identify, Protect, Detect, Respond, Recover), but the four phases remain the common working model. SANS uses the same steps under the name PICERL.',
      ],
    },
    {
      id: 'analysis',
      heading: 'Detection & analysis',
      body: ['Validate, then scope. An **event** is anything observable; an **incident** threatens or violates policy. Once declared, answer:'],
      points: [
        '**What happened and how did they get in?** (initial access, patient zero)',
        '**What is affected?** Hosts, accounts, data.',
        '**Timeline:** sort events by time (in UTC); find the first and the latest activity.',
        '**Impact and severity**, then notify according to the plan.',
      ],
    },
    {
      id: 'containment',
      heading: 'Containment and evidence',
      body: [
        '**Short-term containment** stops the bleeding: EDR network isolation, disable accounts and revoke sessions, block C2 indicators. Keep machines **powered on**: memory holds processes, connections, injected code and keys.',
        'Collect in **order of volatility** (RFC 3227): memory and live state before disk, disk before remote logs and archives. Record hashes and a **chain of custody**. Coordinate over an **out-of-band** channel if email might be compromised.',
      ],
    },
    {
      id: 'eradication',
      heading: 'Eradication and recovery',
      body: [
        'Scope first, then remove **everything at once**: piecemeal clean-up alerts the attacker, who falls back to footholds you have not found. Eradication covers malware and persistence, the entry point (patch, close exposed services) and **credentials**: every account exposed on a compromised host is burned. After a domain compromise that includes resetting krbtgt twice.',
        '**Recovery** returns systems to service from clean builds or backups, validates them, and watches closely for re-infection.',
      ],
    },
    {
      id: 'post',
      heading: 'Post-incident activity',
      body: [
        'Hold a blameless lessons-learned review soon after the incident: what happened, what worked, what did not, what changes (new detections, playbook fixes, hardening). Record metrics such as time to detect and time to contain, and retain evidence as policy requires.',
      ],
    },
  ],
  worked: [
    {
      id: 'ir-w1',
      title: 'One compromised laptop, through the phases',
      artifactLabel: 'Case notes · WS-FIN-07',
      artifact:
        '07:12  Alert: beacon from WS-FIN-07 (dana) to newly registered domain\n07:20  Confirmed: macro doc > PowerShell > svch0st.exe + Run key; C2 198.51.100.77\n07:26  Found: svc_sql logged on to SRV-FS01 from WS-FIN-07 with admin privileges\n07:30  Same phishing email delivered to 11 other mailboxes; 1 other click (WS-FIN-03)',
      question: 'What does each phase look like here?',
      steps: [
        'Detection & Analysis: the alert is validated as a true positive, and scoping has found three hosts (WS-FIN-07, SRV-FS01, WS-FIN-03), two accounts (dana, svc_sql) and the entry point (phishing email).',
        'Containment: isolate WS-FIN-07 and WS-FIN-03 with EDR (powered on), disable svc_sql and revoke dana\'s sessions, block 198.51.100.77 and the domain, purge the email from all 12 mailboxes. Capture memory from both laptops before anything else.',
        'Eradication: once scoping is complete, remove svch0st.exe and the Run keys (or rebuild the laptops), check SRV-FS01 for anything svc_sql created, reset svc_sql, dana and the second user\'s passwords.',
        'Recovery: return rebuilt laptops, re-enable svc_sql with a new password, and watch for the IOCs and for svc_sql logons from workstations. Post-incident: why did the macro run (policy), and should service accounts be allowed interactive network logons?',
      ],
      conclusion: 'Each phase has a clear goal: scope, stop the spread without losing evidence, remove every foothold and credential, return safely, then improve.',
    },
  ],
  faded: [
    {
      id: 'ir-f1',
      title: 'The CFO\'s laptop',
      artifactLabel: 'Situation',
      artifact:
        'EDR: LAPTOP-CFO-01 running an unsigned binary that beacons to 203.0.113.140:443 every 30 s.\nThe CFO is presenting to the board from this laptop for another hour.\nConfirmed true positive by Tier 2 at 14:05.',
      question: 'What do you do, and in which order?',
      given: [
        'The alert is validated, so this is an incident: follow the plan, which includes informing the incident manager.',
        'Waiting an hour means an attacker with live access to the CFO\'s machine and everything it can reach during a board meeting.',
      ],
      todo: [
        {
          prompt: 'What is the right containment action?',
          type: 'mc',
          choices: [
            'EDR network isolation now, keeping the laptop powered on, with a heads-up to the CFO via their assistant or phone',
            'Wait until the meeting ends to avoid disruption',
            'Remotely shut the laptop down',
          ],
          answer: 'EDR network isolation now, keeping the laptop powered on, with a heads-up to the CFO via their assistant or phone',
          explanation: 'An active C2 session outweighs a presentation. Isolation stops the attacker while preserving memory; shutting down would destroy that evidence. Communicate so the business is not surprised.',
        },
        {
          prompt: 'What is the first evidence to capture from the isolated laptop?',
          type: 'mc',
          choices: ['A memory image', 'A full disk image', 'Screenshots of the desktop'],
          answer: 'A memory image',
          explanation: 'Order of volatility: memory first (the unsigned binary may be injected or unpacked only in RAM), then disk.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'ir-evidence-volatile',
    skill: 'l2-ir',
    name: 'Ignoring volatile evidence',
    description: 'Powers off compromised machines, imaging the disk first, or thinks isolation cleans the host.',
    fix: 'Memory holds running processes, network connections, injected and unpacked code, and keys: switching off destroys it. Isolate with EDR and keep the host running, then collect in order of volatility (RFC 3227): memory and live state first, then disk, then remote logs. Isolation contains the host; it does not clean it.',
    lesson: 'l2-ir#containment',
  },
  {
    id: 'ir-eradicate-before-scope',
    skill: 'l2-ir',
    name: 'Cleaning up before scoping',
    description: 'Reimages or deletes malware immediately, or cleans hosts one at a time as they are found.',
    fix: 'Contain first (isolate, disable, block), scope fully, then eradicate everything in one coordinated window. Early reimaging destroys evidence, and piecemeal clean-up warns the attacker, who moves to footholds you have not found yet.',
    lesson: 'l2-ir#eradication',
  },
  {
    id: 'ir-phase-mixup',
    skill: 'l2-ir',
    name: 'Mixing up the IR phases',
    description: 'Confuses eradication with recovery, or puts activities (reports, lessons learned) in the wrong phase.',
    fix: 'Preparation: before the incident (plans, logging, practice). Detection & Analysis: validate and scope. Containment: stop the spread. Eradication: remove the attacker\'s presence and way in. Recovery: restore service and monitor. Post-Incident Activity: lessons learned and the final report.',
    lesson: 'l2-ir#lifecycle',
  },
  {
    id: 'ir-creds-forgotten',
    skill: 'l2-ir',
    name: 'Forgetting stolen credentials',
    description: 'Believes rebuilding or restoring a machine removes the attacker, without resetting the credentials exposed on it.',
    fix: 'Restoring a machine does not revoke what the attacker already took. Reset or disable every account exposed on compromised hosts (users, admins, service accounts), revoke sessions, close the entry point, and after domain compromise reset krbtgt twice. Otherwise the attacker logs straight back in.',
    lesson: 'l2-ir#eradication',
  },
];

export const IR = { items, lesson, misconceptions };

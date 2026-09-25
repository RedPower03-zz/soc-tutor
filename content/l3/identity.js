// Level 3 · Identity, Active Directory & Kerberos: questions, lesson and misconceptions.
// Windows Security events 4768/4769/4771/4624/4625/4672/4662, ticket encryption types (0x12 AES256,
// 0x17 RC4-HMAC), ATT&CK T1558.001/.003/.004, T1550.002, T1003.006 (DCSync).

const items = [
  {
    id: 'id-01',
    skill: 'l3-identity',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which Windows Security event does a domain controller log when a user requests a **TGT** (Kerberos AS-REQ)?',
    choices: ['4768', '4769', '4624', '4672'],
    answer: '4768',
    misconceptions: { '4769': 'id-4768-vs-4769' },
    explanation:
      '**4768** "A Kerberos authentication ticket (TGT) was requested" is the logon to the domain (AS exchange). **4769** "A Kerberos service ticket was requested" follows each time the user accesses a service (TGS exchange). 4624 is logged on the machine being logged on to.',
  },
  {
    id: 'id-02',
    skill: 'l3-identity',
    difficulty: 1,
    type: 'text',
    prompt: 'Which account\'s password hash encrypts and signs every TGT in an Active Directory domain? (account name)',
    accept: ['krbtgt', 'the krbtgt account', 'krbtgt account'],
    misconceptions: { administrator: 'id-golden-vs-silver', 'domain admin': 'id-golden-vs-silver' },
    explanation:
      'The KDC encrypts TGTs with the **krbtgt** key. Whoever has that hash can forge TGTs for any user with any groups (a **golden ticket**). That is why recovery from domain compromise includes resetting krbtgt **twice**: the account keeps the previous key too.',
  },
  {
    id: 'id-03',
    skill: 'l3-identity',
    difficulty: 2,
    type: 'mc',
    prompt: 'Read the event. Why is it interesting?',
    snippet:
      'EventID 4769  A Kerberos service ticket was requested.\n  Account Name:          j.moreno@CORP.EXAMPLE\n  Service Name:          svc_backup\n  Client Address:        ::ffff:10.20.4.31\n  Ticket Options:        0x40810000\n  Ticket Encryption Type: 0x17\n  Failure Code:          0x0',
    choices: [
      'A standard user requested an RC4-encrypted (0x17) service ticket for a service account, which is the pattern of Kerberoasting',
      'It is a failed logon',
      'It shows a golden ticket',
      'Nothing: 0x17 is AES-256, the modern default',
    ],
    answer: 'A standard user requested an RC4-encrypted (0x17) service ticket for a service account, which is the pattern of Kerberoasting',
    misconceptions: { 'It shows a golden ticket': 'id-golden-vs-silver', 'It is a failed logon': 'id-4768-vs-4769' },
    explanation:
      'Service tickets are encrypted with the service account\'s key. Asking for **RC4 (0x17)** instead of AES (0x12 = AES256, 0x11 = AES128) makes offline cracking of that ticket much faster. Kerberoasting (T1558.003) needs only a normal domain account; the tell is RC4 requests for many or unusual SPNs from one client.',
  },
  {
    id: 'id-04',
    skill: 'l3-identity',
    difficulty: 2,
    type: 'mc',
    prompt: 'What privilege does an attacker need to Kerberoast a service account?',
    choices: [
      'Any authenticated domain user can request service tickets for any SPN',
      'Domain Admin',
      'Local administrator on the domain controller',
      'The krbtgt hash',
    ],
    answer: 'Any authenticated domain user can request service tickets for any SPN',
    misconceptions: { 'Domain Admin': 'id-kerberoast-needs-admin', 'Local administrator on the domain controller': 'id-kerberoast-needs-admin' },
    explanation:
      'Requesting a ticket is normal Kerberos behaviour, so one phished user is enough. The attack happens offline: crack the ticket to recover the service account password. Defences: long random (managed, gMSA) service account passwords, AES-only accounts, and detections on RC4 4769 bursts.',
  },
  {
    id: 'id-05',
    skill: 'l3-identity',
    difficulty: 2,
    type: 'text',
    prompt: 'In a 4768 event, which **Pre-Authentication Type** value shows the account does not require Kerberos pre-authentication (AS-REP roastable)? (a number)',
    snippet:
      'EventID 4768  A Kerberos authentication ticket (TGT) was requested.\n  Account Name:     legacy_scan\n  Client Address:   ::ffff:10.20.4.31\n  Ticket Encryption Type: 0x17\n  Pre-Authentication Type: ?',
    accept: ['0', '0x0'],
    misconceptions: { '2': 'id-4768-vs-4769', '15': 'id-4768-vs-4769' },
    explanation:
      'Pre-auth type **0** means no pre-authentication: the DC returned an AS-REP encrypted with the user\'s key to anyone who asked, which can be cracked offline (AS-REP roasting, T1558.004). Normal values are 2 (encrypted timestamp) or 15/16/17 (PKINIT, smart cards). Fix: re-enable "Kerberos preauthentication" on the account.',
  },
  {
    id: 'id-06',
    skill: 'l3-identity',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does an attacker need for **pass-the-hash** against a Windows server?',
    choices: [
      'The account\'s NTLM hash; the plaintext password is not needed',
      'The plaintext password',
      'The krbtgt hash',
      'Physical access to the server',
    ],
    answer: 'The account\'s NTLM hash; the plaintext password is not needed',
    misconceptions: { 'The plaintext password': 'id-pth-needs-password', 'The krbtgt hash': 'id-golden-vs-silver' },
    explanation:
      'NTLM challenge-response uses the hash as the secret, so a hash dumped from LSASS on one host logs on elsewhere (T1550.002). Evidence: 4624 logon type 3 with NTLM authentication from an unusual source, often a local admin account reused across machines. LAPS (unique local admin passwords) and Credential Guard reduce it.',
  },
  {
    id: 'id-07',
    skill: 'l3-identity',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which signs point to a **golden ticket** in use? (select all)',
    choices: [
      'Service ticket requests (4769) from a client with no matching TGT request (4768) on any DC',
      'A TGT lifetime of 10 years instead of the domain policy of 10 hours',
      'An account name that does not exist in AD, or a real user shown with groups they are not in',
      'Many failed logons (4625) for one account',
      'A user logging on at 09:00 on a Monday',
    ],
    answer: [
      'Service ticket requests (4769) from a client with no matching TGT request (4768) on any DC',
      'A TGT lifetime of 10 years instead of the domain policy of 10 hours',
      'An account name that does not exist in AD, or a real user shown with groups they are not in',
    ],
    misconceptions: { 'Many failed logons (4625) for one account': 'id-4768-vs-4769' },
    explanation:
      'A golden ticket is forged offline with the krbtgt hash (T1558.001), so the DC never issued it: no 4768, but 4769s appear as the ticket is used. Default tooling sets 10-year lifetimes, and the forger can put any name and group SIDs in it. A **silver ticket** is forged with a service account hash and is used directly against that service without contacting the DC at all.',
  },
  {
    id: 'id-08',
    skill: 'l3-identity',
    difficulty: 3,
    type: 'mc',
    prompt: 'An attacker cracked the password of `svc_sql` and forges tickets for MSSQL on SRV-DB01 only. The DC logs nothing. What is this?',
    choices: ['A silver ticket', 'A golden ticket', 'AS-REP roasting', 'Password spraying'],
    answer: 'A silver ticket',
    misconceptions: { 'A golden ticket': 'id-golden-vs-silver' },
    explanation:
      'A **silver ticket** is a service ticket forged with the service account\'s key. The service accepts it without asking the DC, so there is no 4768/4769; only the target\'s own logs (4624 on SRV-DB01) show the logon. Scope is one service rather than the whole domain, but detection is harder. PAC validation and AES-only service accounts help.',
  },
  {
    id: 'id-09',
    skill: 'l3-identity',
    difficulty: 1,
    type: 'mc',
    prompt: 'Event 4672 "Special privileges assigned to new logon" appears right after a 4624. What does it tell you?',
    choices: [
      'The account that just logged on holds administrator-level privileges (e.g. SeDebugPrivilege)',
      'The logon failed',
      'A Kerberos ticket was requested',
      'The user changed their password',
    ],
    answer: 'The account that just logged on holds administrator-level privileges (e.g. SeDebugPrivilege)',
    misconceptions: { 'A Kerberos ticket was requested': 'id-4768-vs-4769' },
    explanation:
      '4672 marks privileged logons. Pair it with 4624 on the Logon ID: an admin account logging on to a workstation it never uses, or a 4672 for an account that should not be privileged, is worth a look. Tier 0 accounts should only ever log on to Tier 0 systems.',
  },
  {
    id: 'id-10',
    skill: 'l3-identity',
    difficulty: 3,
    type: 'mc',
    prompt: 'A DC logs event 4662 with the properties below, and the account is a workstation user, not a domain controller. What is happening?',
    snippet:
      'EventID 4662  An operation was performed on an object.\n  Subject: Account Name: j.moreno   Logon ID: 0x3E7A21\n  Object Type: domainDNS\n  Access Mask: 0x100 (Control Access)\n  Properties: {1131f6aa-9c07-11d1-f79f-00c04fc2dcd2}   (DS-Replication-Get-Changes)\n              {1131f6ad-9c07-11d1-f79f-00c04fc2dcd2}   (DS-Replication-Get-Changes-All)',
    choices: [
      'DCSync: the account is asking the DC to replicate password hashes, including krbtgt',
      'A normal group policy refresh',
      'A service ticket request',
      'The user reset their own password',
    ],
    answer: 'DCSync: the account is asking the DC to replicate password hashes, including krbtgt',
    misconceptions: { 'A service ticket request': 'id-4768-vs-4769' },
    explanation:
      'Only DCs (and a few sync tools) should use the replication rights. A user doing so means DCSync (T1003.006, e.g. mimikatz lsadump::dcsync): the attacker already has a privileged account and is pulling hashes, often krbtgt for a golden ticket. Treat it as domain compromise.',
  },
  {
    id: 'id-11',
    skill: 'l3-identity',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which attacks can a normal, non-admin domain user start from a phished workstation? (select all)',
    choices: [
      'Kerberoasting (request service tickets for SPNs and crack them offline)',
      'AS-REP roasting of accounts with pre-authentication disabled',
      'Password spraying against the domain',
      'DCSync without any extra rights',
      'Forging a golden ticket without the krbtgt hash',
    ],
    answer: [
      'Kerberoasting (request service tickets for SPNs and crack them offline)',
      'AS-REP roasting of accounts with pre-authentication disabled',
      'Password spraying against the domain',
    ],
    misconceptions: { 'DCSync without any extra rights': 'id-kerberoast-needs-admin', 'Forging a golden ticket without the krbtgt hash': 'id-golden-vs-silver' },
    explanation:
      'The first three abuse normal protocol behaviour and only need a domain account (or none, for spraying). DCSync needs replication rights and a golden ticket needs the krbtgt hash: both mean the attacker is already very privileged.',
  },
  {
    id: 'id-12',
    skill: 'l3-identity',
    difficulty: 3,
    type: 'text',
    prompt: 'Which 4624 **logon type** number appears for a pass-the-hash logon over the network to a file share or with PsExec? (a number)',
    accept: ['3', 'type 3', 'logon type 3'],
    misconceptions: { '10': 'id-pth-needs-password', '2': 'id-pth-needs-password' },
    explanation:
      'Network logons are **type 3** (SMB, PsExec, WMI). Pass-the-hash shows as type 3 with Authentication Package **NTLM** from an unexpected workstation. (Type 9, NewCredentials with logon process seclogo, appears on the attacker\'s own host when mimikatz sekurlsa::pth spawns a process; type 10 is RDP, type 2 interactive.)',
  },
  {
    id: 'id-13',
    skill: 'l3-identity',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is a **Service Principal Name (SPN)**?',
    choices: [
      'The identifier Kerberos uses to find which account runs a service, e.g. MSSQLSvc/srv-db01.corp.example:1433',
      'A user\'s password hash',
      'The name of a domain controller',
      'A type of firewall rule',
    ],
    answer: 'The identifier Kerberos uses to find which account runs a service, e.g. MSSQLSvc/srv-db01.corp.example:1433',
    misconceptions: { 'A user\'s password hash': 'id-kerberoast-needs-admin' },
    explanation:
      'The KDC looks up the SPN to find the account whose key encrypts the service ticket. User accounts with SPNs (service accounts with human-chosen passwords) are the Kerberoasting targets; any user can list them with an LDAP query (servicePrincipalName=*).',
  },
];

const lesson = {
  skill: 'l3-identity',
  title: 'Identity, Active Directory & Kerberos',
  goal: 'Follow a Kerberos logon through the event logs and recognise roasting, pass-the-hash, forged tickets and DCSync.',
  sections: [
    {
      id: 'ad',
      heading: 'Active Directory in one screen',
      body: [
        'Active Directory holds users, computers, groups and policy. **Domain controllers (DCs)** answer logons and hold every password hash, so they are **Tier 0**, together with Domain Admins and anything that can control them.',
        'Service accounts run applications. When a service account has a **Service Principal Name (SPN)** such as `MSSQLSvc/srv-db01.corp.example:1433`, Kerberos uses that account\'s key to encrypt tickets for the service.',
      ],
    },
    {
      id: 'flow',
      heading: 'The Kerberos flow in the logs',
      body: ['Three exchanges, three kinds of evidence:'],
      points: [
        '**AS exchange** → DC logs **4768** (TGT requested). The TGT is encrypted with the **krbtgt** key. Failed pre-auth is 4771.',
        '**TGS exchange** → DC logs **4769** (service ticket requested) each time the user reaches a service. The ticket is encrypted with the service account key.',
        '**AP exchange** → the target server logs **4624** (logon; type 3 for network) and **4672** if the account is privileged.',
        '**Ticket Encryption Type**: 0x12 = AES256, 0x11 = AES128, **0x17 = RC4-HMAC** (weak, a Kerberoasting tell in modern domains).',
      ],
      evidence: {
        label: 'Normal morning logon (DC + file server)',
        text: '08:01:12 DC01  4768 user=a.khan  enc=0x12 preauth=2  client=10.20.4.18\n08:01:13 DC01  4769 user=a.khan  service=FS01$ enc=0x12\n08:01:13 FS01  4624 user=a.khan  type=3 auth=Kerberos',
      },
    },
    {
      id: 'cred-attacks',
      heading: 'Credential attacks',
      body: [
        '**Kerberoasting** (T1558.003): any domain user requests service tickets (4769), often forcing **RC4**, and cracks them offline to get service account passwords. Signal: one client requesting RC4 tickets for many SPNs.',
        '**AS-REP roasting** (T1558.004): accounts with pre-authentication disabled return crackable material to anyone. Signal: 4768 with **Pre-Authentication Type 0**.',
        '**Pass-the-hash** (T1550.002): the NTLM hash is enough, so the password is never needed. Signal: 4624 **type 3, NTLM** from a host that user never uses, often a shared local admin. Overpass-the-hash turns the hash into Kerberos tickets instead.',
      ],
    },
    {
      id: 'forged',
      heading: 'Forged tickets and DCSync',
      body: [
        '**Golden ticket** (T1558.001): a TGT forged with the **krbtgt** hash. The DC never issued it, so there is no 4768, but 4769s and logons follow. Watch for odd lifetimes, non-existent users, or group memberships that do not match AD.',
        '**Silver ticket**: a service ticket forged with one **service account** hash. It goes straight to that service with no DC contact, so only the target\'s logs show anything.',
        '**DCSync** (T1003.006): an account with replication rights asks a DC for hashes (4662 with DS-Replication-Get-Changes-All). From a non-DC, it means the domain is compromised: plan a **double krbtgt reset** and a full credential rotation.',
      ],
    },
  ],
  worked: [
    {
      id: 'id-w1',
      title: 'A burst of service tickets',
      artifactLabel: 'DC01 Security log (filtered)',
      artifact:
        '10:02:11 4768 user=j.moreno enc=0x12 preauth=2 client=10.20.4.31\n10:14:02 4769 user=j.moreno service=svc_backup enc=0x17 client=10.20.4.31\n10:14:02 4769 user=j.moreno service=svc_sql    enc=0x17 client=10.20.4.31\n10:14:03 4769 user=j.moreno service=svc_web    enc=0x17 client=10.20.4.31\n... 14 more in 40 s, all 0x17\n11:52:40 4624 on SRV-DB01 user=svc_sql type=3 auth=NTLM src=10.20.4.31',
      question: 'What happened, and what is the impact?',
      steps: [
        'The 4768 is j.moreno\'s normal logon with AES and pre-auth, so it looks like a legitimate TGT.',
        'Seventeen RC4 (0x17) service tickets for different service accounts in 40 seconds from one workstation: nobody uses 17 services at once, and modern clients ask for AES. This is Kerberoasting.',
        'Ninety minutes later svc_sql logs on to SRV-DB01 over the network with NTLM from the same workstation: the offline crack succeeded and the password is being used.',
        'Impact: j.moreno\'s workstation or account is compromised, svc_sql is compromised, and any other roasted account with a weak password may be too. Reset svc_sql (long random, ideally gMSA), investigate 10.20.4.31, check logons for every roasted account.',
      ],
      conclusion: 'RC4 4769 bursts are the attempt; a later logon by one of the roasted accounts from the same source is the proof that it worked.',
    },
  ],
  faded: [
    {
      id: 'id-f1',
      title: 'Tickets without a TGT',
      artifactLabel: 'DC logs, 24 h, account "helpdesk_adm"',
      artifact:
        '4768 for helpdesk_adm: none in 24 h on any DC\n4769 helpdesk_adm service=cifs/DC01 enc=0x12 client=10.20.9.14   02:10:44\n4769 helpdesk_adm service=ldap/DC01 enc=0x12 client=10.20.9.14   02:10:51\nDC01 4624 helpdesk_adm type=3 auth=Kerberos src=10.20.9.14\nAD: helpdesk_adm is NOT a member of Domain Admins',
      question: 'What kind of ticket is being used?',
      given: ['Service tickets are requested, so the client presents a TGT to the DC, yet no DC ever issued one.'],
      todo: [
        {
          prompt: 'Which attack fits?',
          type: 'mc',
          choices: ['A golden ticket forged with the krbtgt hash', 'A silver ticket', 'Kerberoasting'],
          answer: 'A golden ticket forged with the krbtgt hash',
          explanation: '4769s without any 4768 mean the TGT was never issued by a DC: it was forged. A silver ticket would not produce 4769s at all.',
        },
        {
          prompt: 'Which account must be reset twice as part of eradication? (account name)',
          type: 'text',
          accept: ['krbtgt'],
          explanation: 'Resetting krbtgt twice (with replication in between) invalidates every forged TGT; combine it with finding how the attacker got the hash (DCSync or DC access).',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'id-4768-vs-4769',
    skill: 'l3-identity',
    name: 'Mixing up the Kerberos events',
    description: 'Confuses 4768 (TGT) with 4769 (service ticket) or treats Kerberos events as logon successes and failures.',
    fix: '4768 is the TGT request at logon (AS exchange, encrypted with the krbtgt key; pre-auth type 0 means AS-REP roastable). 4769 is a service ticket request each time a service is used (TGS exchange; RC4 0x17 bursts mean Kerberoasting). The target server logs 4624/4672; failures are 4771 and 4625.',
    lesson: 'l3-identity#flow',
  },
  {
    id: 'id-pth-needs-password',
    skill: 'l3-identity',
    name: 'Pass-the-hash needs the password',
    description: 'Believes an attacker must crack a hash before using it, or looks for the wrong logon type.',
    fix: 'With NTLM, the hash itself is the secret: an attacker who dumps it from memory can log on without ever knowing the password. Look for 4624 logon type 3 with authentication package NTLM from an unusual source, often a reused local admin. LAPS and Credential Guard reduce the risk.',
    lesson: 'l3-identity#cred-attacks',
  },
  {
    id: 'id-golden-vs-silver',
    skill: 'l3-identity',
    name: 'Golden and silver tickets confused',
    description: 'Thinks any admin hash makes a golden ticket, or expects forged service tickets to appear on the DC.',
    fix: 'A golden ticket is a TGT forged with the krbtgt hash: domain-wide, with 4769s but no matching 4768. A silver ticket is a service ticket forged with one service account hash and presented straight to that service, so the DC logs nothing. Golden tickets mean a double krbtgt reset.',
    lesson: 'l3-identity#forged',
  },
  {
    id: 'id-kerberoast-needs-admin',
    skill: 'l3-identity',
    name: 'Kerberoasting needs admin rights',
    description: 'Thinks roasting attacks require elevated privileges, so a normal user account is low risk.',
    fix: 'Any authenticated domain user can list SPNs and request service tickets; the cracking happens offline. One phished user is enough to Kerberoast every service account with a weak password. Defend with long random or gMSA passwords and AES-only accounts, and detect RC4 4769 bursts.',
    lesson: 'l3-identity#cred-attacks',
  },
];

export const IDENTITY = { items, lesson, misconceptions };

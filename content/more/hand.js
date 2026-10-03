// Hand-written higher-Bloom items that top up skills still under 30 after the
// parameterised generators. Stable ids (more-*) so spaced review keeps working.
const items = [
  {
    id: 'more-pers-01',
    skill: 'host-persistence',
    difficulty: 3,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'EDR flagged these two persistence candidates on the same host. Which one is the stronger signal of attacker persistence?',
    snippet:
      'A) HKCU\\...\\Run  value: "OneDrive" -> "C:\\Users\\j.doe\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe"\n' +
      'B) C:\\Windows\\System32\\Tasks\\Microsoft\\Windows\\PLA\\CacheTask  Action: C:\\Users\\Public\\RuntimeBroker.exe -s',
    choices: [
      'B: a Task Scheduler job running a System32-named binary from Public',
      'A: any Run key entry is malware until proven otherwise',
      'Neither: both paths are default Microsoft components',
      'A: OneDrive in HKCU Run is never legitimate on Windows 11',
    ],
    answer: 'B: a Task Scheduler job running a System32-named binary from Public',
    misconceptions: {
      'A: any Run key entry is malware until proven otherwise': 'pers-new-service-malware',
      'Neither: both paths are default Microsoft components': 'pers-definition',
    },
    explanation:
      'A is a normal OneDrive autorun. B drops a System32-looking name into a user-writable folder and schedules it under a Microsoft-looking task path: that is persistence plus masquerading (T1053.005 + T1036.005). Judge the image path and parent context, not the friendly task name.',
  },
  {
    id: 'more-triage-01',
    skill: 'l2-alert-triage',
    difficulty: 3,
    bloom: 'evaluate',
    type: 'mc',
    prompt: 'Two alerts land in the same minute. Which do you work first?',
    snippet:
      'Alert 1  Severity=High   Host=WS-HR-14 (standard laptop)   Rule=Possible Mimikatz command line\n' +
      'Alert 2  Severity=Medium Host=DC01 (domain controller)     Rule=Unusual LSASS handle open\n' +
      'Priority matrix: crown jewel + Medium = P2; standard + High = P3',
    choices: [
      'Alert 2: medium on a DC outranks high on a laptop',
      'Alert 1: higher severity always goes first',
      'Alert 1: Mimikatz is more specific than an LSASS handle',
      'Neither: both can wait for the overnight hunter queue',
    ],
    answer: 'Alert 2: medium on a DC outranks high on a laptop',
    misconceptions: {
      'Alert 1: higher severity always goes first': 'triage-severity-priority',
    },
    explanation:
      'Priority = severity × asset criticality. Medium on a crown-jewel DC is P2; High on a standard workstation is P3. Work Alert 2 first, then come back to the laptop. Severity alone is not the queue order.',
  },
  {
    id: 'more-triage-02',
    skill: 'l2-alert-triage',
    difficulty: 2,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'An EDR alert says "ransomware behaviour blocked" on WS-FIN-08. The process tree shows winword.exe → powershell.exe was killed, and the host is still online. What is the best next triage step?',
    choices: [
      'Confirm the block in the raw EDR event, then hunt for siblings and persistence',
      'Close as false positive because the malware was blocked',
      'Reimage the laptop immediately without collecting evidence',
      'Mark it informational and wait for a second alert on the same host',
    ],
    answer: 'Confirm the block in the raw EDR event, then hunt for siblings and persistence',
    misconceptions: {
      'Close as false positive because the malware was blocked': 'triage-blocked-closed',
      'Mark it informational and wait for a second alert on the same host': 'triage-raw-event',
    },
    explanation:
      'Blocked is not cleaned. Confirm the prevention in the raw telemetry, then look for other implants, scheduled tasks, Run keys and lateral movement from that user/host. Closing on "blocked" alone is a classic miss.',
  },
  {
    id: 'more-pki-01',
    skill: 'l3-pki',
    difficulty: 3,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'A user reports certificate warnings for https://pay.shop.example. The presented leaf certificate has the fields below. Why does a modern browser reject it for that hostname?',
    snippet:
      'Subject: CN=pay.shop.example\n' +
      'X509v3 Subject Alternative Name:\n' +
      '    DNS:*.shop.example, DNS:shop.example\n' +
      'Issuer: CN=Corp Issuing CA, O=Example Corp',
    choices: [
      'pay.shop.example needs two labels under the wildcard; *.shop.example covers only one',
      'The CN matches, so the browser should accept it; this is a false warning',
      'Wildcards are illegal in public TLS certificates',
      'The issuing CA name Example Corp is reserved and always untrusted',
    ],
    answer: 'pay.shop.example needs two labels under the wildcard; *.shop.example covers only one',
    misconceptions: {
      'The CN matches, so the browser should accept it; this is a false warning': 'pki-cn-vs-san',
    },
    explanation:
      'Browsers match the SAN list, not the CN, when a SAN is present. A wildcard covers exactly one left-most label: *.shop.example matches www.shop.example but not pay.shop.example (that would need *.*.shop.example, which public CAs will not issue) and not the bare shop.example unless it is listed separately.',
  },
  {
    id: 'more-pki-02',
    skill: 'l3-pki',
    difficulty: 2,
    bloom: 'apply',
    type: 'text',
    prompt: 'A leaf certificate chains to a corporate root that is **not** in the public trust store. Clients trust it only because an MDM pushed the root. What kind of PKI deployment is this? (two words: "private ___" or "___ CA")',
    accept: ['private ca', 'private pki', 'internal ca', 'enterprise ca', 'corporate ca', 'internal pki'],
    explanation:
      'This is a **private / internal / enterprise CA**: the organisation runs its own root (or intermediate) and distributes trust via MDM or Group Policy. It is not a publicly trusted CA; browsers without that root will fail the chain.',
  },
  {
    id: 'more-id-01',
    skill: 'l3-identity',
    difficulty: 3,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'These 4769 events appeared in five minutes from one user. What attack pattern fits best?',
    snippet:
      '14:02:01  4769  Account=j.doe  Service=MSSQLSvc/sql01.corp.example:1433  Ticket Encryption Type=0x17\n' +
      '14:02:03  4769  Account=j.doe  Service=HTTP/intranet.corp.example         Ticket Encryption Type=0x17\n' +
      '14:02:04  4769  Account=j.doe  Service=CIFS/fs02.corp.example             Ticket Encryption Type=0x17\n' +
      '14:02:08  4769  Account=j.doe  Service=MSSQLSvc/sql-hr.corp.example:1433 Ticket Encryption Type=0x17\n' +
      '(Domain policy prefers AES; RC4 is still allowed for a few service accounts.)',
    choices: [
      'Kerberoasting: one user requesting many RC4 service tickets',
      'AS-REP roasting: requests without pre-authentication',
      'Password spraying: many users, one password, Status 0xC000006A',
      'Normal SSO: a user opening a few intranet apps at lunch',
    ],
    answer: 'Kerberoasting: one user requesting many RC4 service tickets',
    explanation:
      'A burst of 4769 events for many SPNs with Ticket Encryption Type 0x17 (RC4) from one account is the classic Kerberoasting signal (T1558.003): the attacker asks for service tickets they can crack offline. AS-REP roasting shows up on 4768 without pre-auth; spraying is failed logons across many users.',
  },
  {
    id: 'more-for-01',
    skill: 'l3-forensics',
    difficulty: 3,
    bloom: 'evaluate',
    type: 'mc',
    prompt: 'You arrive at a still-powered compromised Linux server. Which collection order follows RFC 3227 best?',
    choices: [
      'Memory and process list → disk image → pull remote SIEM copies last for comparison',
      'Full disk image first so RAM is optional',
      'Remote SIEM logs first, then disk, then memory if time allows',
      'Unplug power immediately, then image the disk in the lab',
    ],
    answer: 'Memory and process list → disk image → pull remote SIEM copies last for comparison',
    misconceptions: {
      'Full disk image first so RAM is optional': 'for-volatility-order',
      'Unplug power immediately, then image the disk in the lab': 'for-volatility-order',
    },
    explanation:
      'RFC 3227: most volatile first. Capture memory/process/network state while the box is live, then disk, then rely on remote logs that already exist elsewhere. Pulling the plug to "preserve disk" throws away the most valuable evidence modern malware leaves in RAM.',
  },
  {
    id: 'more-for-02',
    skill: 'l3-forensics',
    difficulty: 2,
    bloom: 'apply',
    type: 'text',
    prompt: 'A Windows Prefetch file is named `MIMIKATZ.EXE-3A2B1C4D.pf`. Aside from proving the binary name, what does a Prefetch entry primarily tell you about that executable on a client OS? (short phrase)',
    accept: ['it ran', 'it executed', 'execution evidence', 'the program ran', 'it was executed', 'evidence it ran', 'that it ran'],
    explanation:
      'Prefetch on Windows client SKUs records that a program **executed** (with run count and last run times). It is not proof of persistence by itself, and Prefetch is off by default on many Windows Server builds.',
  },
  {
    id: 'more-for-03',
    skill: 'l3-forensics',
    difficulty: 2,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'Two logs disagree about when a file was written. Which interpretation is sound?',
    snippet:
      'NTFS $SI Create: 2026-09-20 11:02:01 UTC\n' +
      'NTFS $FN Create: 2026-09-25 18:44:10 UTC\n' +
      '$LogFile / USN: rename into C:\\Users\\Public at 2026-09-25 18:44:10 UTC',
    choices: [
      'Timestamps were likely timestomped; trust USN/$LogFile over $SI alone',
      '$SI is always authoritative, so ignore $FN and USN',
      'The file cannot exist if the two create times differ',
      'Both times are wrong because NTFS does not store UTC',
    ],
    answer: 'Timestamps were likely timestomped; trust USN/$LogFile over $SI alone',
    explanation:
      'Attackers often reset $STANDARD_INFORMATION times (timestomp, T1070.006) while $FILE_NAME and the USN journal still show the real rename/create. When $SI and $FN disagree, dig into journal evidence rather than trusting $SI alone.',
  },
  {
    id: 'more-for-04',
    skill: 'l3-forensics',
    difficulty: 3,
    bloom: 'analyze',
    type: 'mc',
    prompt: 'An analyst exports this bodyfile snippet. Which row is the most suspicious for a web shell drop?',
    snippet:
      '0|/var/www/html/index.php|0|0|0|0|412|1727000000|1727000000|1727000000|1727000000\n' +
      '0|/var/www/html/uploads/logo.png.php|0|0|0|0|8812|1727086400|1727086400|1727086400|1727086400\n' +
      '0|/var/log/nginx/access.log|0|0|0|0|2048000|1727086500|1727086500|1727086500|1727086500',
    choices: [
      'uploads/logo.png.php: double extension under a writable upload tree',
      'index.php: any PHP file under the docroot is malicious',
      'access.log: log growth always means compromise',
      'None: bodyfile format cannot show web shells',
    ],
    answer: 'uploads/logo.png.php: double extension under a writable upload tree',
    explanation:
      'A `.png.php` under an uploads directory is a classic web-shell drop pattern (T1505.003): the image-looking name fools casual review while the server still executes PHP. index.php is expected; log growth alone is not compromise.',
  },
];

export const HAND = { items, misconceptions: [] };

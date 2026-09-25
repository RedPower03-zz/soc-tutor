// Level 3 capstone: "Major incident". A domain-wide intrusion that crosses Active Directory,
// the cloud account and the file servers, ending in ransomware staging. You work it as the
// incident's technical lead: five stages on the Level 3 lessons, then two deliverables in one
// report: an executive summary for leadership and a technical report for the responders.
// Pure content; scored by js/capstone.js (generic report engine) and rendered by js/ops-ui.js.
// Fictional data only (RFC 5737 / RFC 1918 addresses, .example domains, AWS documentation
// placeholders such as account 111122223333).

export const MAJOR_INCIDENT = {
  id: 'major-incident',
  kind: 'capstone',
  tier: 'l3',
  title: 'Major incident',
  summary:
    'A Friday-night intrusion reaches the domain controllers, the AWS account and the file servers, and ransomware is being staged. Lead the technical response across five stages, then brief the executives and hand the responders a technical report.',
  status: 'available',
  date: 'Sat 3 Oct 2026',
  xp: { stage: 75, report: 800 },
  intro:
    'It is 04:10 on Saturday. The on-call analyst has escalated a DCSync alert, the cloud team has seen strange API calls, and a file server is showing mass file changes. The CISO has declared a major incident and made you technical lead. Work out what happened, stop the damage without destroying evidence, and at 08:00 brief leadership and hand the responders a plan.',
  alert: {
    id: 'ALRT-9001',
    name: 'Directory replication from non-DC + mass file modification (SRV-FS02)',
    severity: 'critical',
    time: '04:02:00',
    host: 'SRV-DC01 / SRV-FS02',
    user: 'svc_backup',
    source: 'SIEM correlation',
  },
  stages: [
    {
      id: 'mi-1',
      title: 'How did they get the domain?',
      summary: 'Kerberos events on the DCs: roasting, a cracked service account and DCSync.',
      requires: { lessons: ['l3-identity'] },
      brief:
        'Start where the alert fired: the domain controllers. Read the Kerberos and directory events from the last 24 hours and reconstruct how an attacker went from one workstation to replicating the domain.',
      evidence: {
        label: 'SRV-DC01 / SRV-DC02 Security log (filtered, UTC)',
        rows: [
          { id: 'e1', t: '21:14:05', src: 'winevt', host: 'SRV-DC01', user: 'l.ferreira', type: 'Security 4768', msg: 'TGT requested. Account: l.ferreira  Client: 10.20.7.41 (WS-MKT-03)  Enc: 0x12  Pre-auth: 2' },
          { id: 'e2', t: '21:20:30', src: 'winevt', host: 'SRV-DC01', user: 'l.ferreira', type: 'LDAP query', msg: '(servicePrincipalName=*) from 10.20.7.41 returned 29 accounts' },
          { id: 'e3', t: '21:20:41', src: 'winevt', host: 'SRV-DC01', user: 'l.ferreira', type: 'Security 4769 x29', msg: '29 service tickets in 50 s, all Ticket Encryption Type 0x17 (RC4), incl. svc_backup, svc_sql, svc_web. Client 10.20.7.41' },
          { id: 'e4', t: '23:02:10', src: 'winevt', host: 'SRV-BKP01', user: 'svc_backup', type: 'Security 4624', msg: 'Logon type 3, Kerberos, source 10.20.7.41 (WS-MKT-03). svc_backup normally logs on only from SRV-BKP01 itself.' },
          { id: 'e5', t: '23:02:10', src: 'winevt', host: 'SRV-BKP01', user: 'svc_backup', type: 'Security 4672', msg: 'Special privileges: SeBackupPrivilege, SeRestorePrivilege, SeDebugPrivilege' },
          { id: 'e6', t: '02:41:18', src: 'winevt', host: 'SRV-DC01', user: 'svc_backup', type: 'Security 4662', msg: 'Control Access on domainDNS: DS-Replication-Get-Changes-All. Client 10.20.30.14 (SRV-BKP01)' },
          { id: 'e7', t: '02:41:20', src: 'winevt', host: 'SRV-DC01', user: 'svc_backup', type: 'Replication', msg: 'GetNCChanges: krbtgt, Administrator, 1,380 user secrets to 10.20.30.14' },
          { id: 'e8', t: '03:05:44', src: 'winevt', host: 'SRV-DC02', user: 'Administrator', type: 'Security 4769', msg: 'Service ticket for cifs/SRV-FS02, client 10.20.30.14. No 4768 for Administrator on any DC in 24 h. Ticket lifetime: 10 years.' },
        ],
      },
      questions: [
        {
          id: 'mi1-q1',
          type: 'mc',
          prompt: 'What was the attacker\'s first credential attack against the domain?',
          choices: [
            'Kerberoasting from WS-MKT-03: SPN enumeration, then 29 RC4 service tickets cracked offline',
            'AS-REP roasting of accounts without pre-authentication',
            'A golden ticket forged from the start',
            'Password spraying from the internet',
          ],
          answer: 'Kerberoasting from WS-MKT-03: SPN enumeration, then 29 RC4 service tickets cracked offline',
          explanation:
            'An LDAP query for every SPN account followed by 29 RC4 (0x17) 4769s in under a minute from one workstation is Kerberoasting (T1558.003). It only needs l.ferreira\'s normal account. The pre-auth type in e1 is 2, so this is not AS-REP roasting.',
        },
        {
          id: 'mi1-q2',
          type: 'mc',
          prompt: 'svc_backup logs on from WS-MKT-03 at 23:02 (e4). What does that prove?',
          choices: [
            'The offline crack of svc_backup\'s ticket succeeded and the attacker is using its password',
            'svc_backup is running a scheduled backup of WS-MKT-03',
            'The Kerberoasting failed',
            'Nothing: service accounts log on everywhere',
          ],
          answer: 'The offline crack of svc_backup\'s ticket succeeded and the attacker is using its password',
          explanation:
            'The roasting (e3) is the attempt; a logon by one of the roasted accounts from the same workstation (e4) is the proof. With 4672 privileges including SeBackupPrivilege, svc_backup is a very valuable account to steal.',
        },
        {
          id: 'mi1-q3',
          type: 'multi',
          prompt: 'Which conclusions follow from e6 to e8? Select all that apply.',
          choices: [
            'svc_backup had replication rights and was used to DCSync the domain',
            'The krbtgt hash is stolen, so a golden ticket is possible',
            'e8 is a golden ticket: a service ticket with no TGT ever issued, and a 10-year lifetime',
            'e8 is a silver ticket, because the DC logged it',
            'Resetting only svc_backup\'s password removes the attacker\'s access',
          ],
          answer: [
            'svc_backup had replication rights and was used to DCSync the domain',
            'The krbtgt hash is stolen, so a golden ticket is possible',
            'e8 is a golden ticket: a service ticket with no TGT ever issued, and a 10-year lifetime',
          ],
          explanation:
            'DCSync (T1003.006) pulled krbtgt and 1,380 secrets; e8 is the golden ticket built from krbtgt (T1558.001). A silver ticket never reaches the DC. With krbtgt and every hash stolen, resetting one account changes nothing: it needs a double krbtgt reset and a domain-wide credential rotation.',
        },
      ],
    },
    {
      id: 'mi-2',
      title: 'The cloud side',
      summary: 'CloudTrail shows a key nobody expected. Where did it come from and what did it do?',
      requires: { lessons: ['l3-cloud'] },
      brief:
        'The cloud team flagged API calls in the production AWS account. SRV-BKP01 holds an access key for off-site backup copies to S3. Read the CloudTrail events.',
      evidence: {
        label: 'CloudTrail · account 111122223333 (UTC)',
        rows: [
          { id: 'c1', t: '03:10:02', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 'sts GetCallerIdentity', msg: 'key=AKIAIOSFODNN7EXAMPLE src=203.0.113.88 ua=aws-cli/2.17.4 errorCode=null (usual src: 192.0.2.30, ua: Veeam)' },
          { id: 'c2', t: '03:10:40', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 'iam ListUsers', msg: 'errorCode=AccessDenied' },
          { id: 'c3', t: '03:12:15', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 's3 ListObjectsV2', msg: 'bucket=corp-backups-111122223333 prefix=fileservers/  errorCode=null' },
          { id: 'c4', t: '03:14:50', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 's3 PutBucketLifecycleConfiguration', msg: 'bucket=corp-backups-111122223333 rule: expire all objects after 1 day, noncurrent versions after 1 day' },
          { id: 'c5', t: '03:15:30', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 's3 DeleteObjects x 6,210', msg: 'bucket=corp-backups-111122223333 prefix=fileservers/  errorCode=AccessDenied on 6,210 (Object Lock: compliance mode, 30 days)' },
          { id: 'c6', t: '03:18:02', src: 'cloud', host: 'AWS', user: 'backup-offsite', type: 'cloudtrail StopLogging', msg: 'trail=org-trail  errorCode=AccessDenied (SCP: deny cloudtrail:StopLogging)' },
        ],
      },
      questions: [
        {
          id: 'mi2-q1',
          type: 'mc',
          prompt: 'Where did the attacker most likely get this AWS key?',
          choices: [
            'From SRV-BKP01, which they controlled as svc_backup since 23:02 and where the backup key is stored',
            'By guessing it',
            'From AWS itself: the provider leaked it',
            'From the Certificate Transparency logs',
          ],
          answer: 'From SRV-BKP01, which they controlled as svc_backup since 23:02 and where the backup key is stored',
          explanation:
            'A long-term AKIA key stored on the backup server is exposed the moment the server is. The first call (GetCallerIdentity from a new IP with aws-cli) is the classic stolen-key check, 68 minutes after the attacker got onto SRV-BKP01 territory.',
        },
        {
          id: 'mi2-q2',
          type: 'mc',
          prompt: 'What was the attacker trying to achieve in the cloud, and did it work?',
          choices: [
            'Destroy the off-site backups before the ransomware runs; Object Lock blocked the deletions and an SCP blocked StopLogging',
            'Steal customer data from the backups; it succeeded',
            'Mine cryptocurrency; it succeeded',
            'Nothing: these are normal backup rotations',
          ],
          answer: 'Destroy the off-site backups before the ransomware runs; Object Lock blocked the deletions and an SCP blocked StopLogging',
          explanation:
            'Lifecycle expiry plus mass deletes on the backup bucket, then trying to stop logging: this is inhibiting recovery (T1490) and evading defences (T1562.008). Object Lock in compliance mode and the organisation SCP held. But the 1-day lifecycle rule (c4) is still in place, so objects will expire once their lock periods end, and it must be reverted.',
        },
        {
          id: 'mi2-q3',
          type: 'multi',
          prompt: 'Which cloud containment steps are right now? Select all that apply.',
          choices: [
            'Deactivate the backup-offsite access key (and issue a new, scoped one later)',
            'Remove the malicious 1-day lifecycle rule from the backup bucket',
            'Review CloudTrail for every call by that key and any other identity used from 203.0.113.88',
            'Disable Object Lock so the backups can be managed more easily',
            'Delete the CloudTrail logs to save cost during the incident',
          ],
          answer: [
            'Deactivate the backup-offsite access key (and issue a new, scoped one later)',
            'Remove the malicious 1-day lifecycle rule from the backup bucket',
            'Review CloudTrail for every call by that key and any other identity used from 203.0.113.88',
          ],
          explanation:
            'Kill the stolen credential, undo the change that still threatens the backups, and scope the attacker\'s cloud activity. Object Lock is what saved you, and CloudTrail is your evidence: keep both.',
        },
      ],
    },
    {
      id: 'mi-3',
      title: 'Ransomware staging',
      summary: 'SRV-FS02 is changing files fast. Read the host evidence, keeping crypto and certificates in mind.',
      requires: { lessons: ['l3-crypto', 'l3-pki'] },
      brief:
        'EDR on SRV-FS02 and the network sensor add detail. Decide what is happening and what the options for recovery are.',
      evidence: {
        label: 'SRV-FS02 · EDR + Zeek (UTC)',
        rows: [
          { id: 'f1', t: '03:40:33', src: 'winevt', host: 'SRV-FS02', user: 'Administrator', type: 'Security 4624', msg: 'Logon type 3, Kerberos, source 10.20.30.14 (SRV-BKP01) (the golden ticket session)' },
          { id: 'f2', t: '03:52:10', src: 'process', host: 'SRV-FS02', user: 'Administrator', type: 'Process create', msg: 'vssadmin.exe delete shadows /all /quiet' },
          { id: 'f3', t: '03:52:40', src: 'process', host: 'SRV-FS02', user: 'Administrator', type: 'File create', msg: 'C:\\ProgramData\\lck\\lck.exe (unsigned); strings contain "-----BEGIN PUBLIC KEY-----" (RSA-4096) and "ChaCha20"' },
          { id: 'f4', t: '04:01:00', src: 'process', host: 'SRV-FS02', user: 'Administrator', type: 'File activity', msg: 'lck.exe rewrote 2,318 files on D:\\Shares\\ in 60 s, renamed to *.lck; written file entropy 7.99 bits/byte' },
          { id: 'f5', t: '04:01:30', src: 'proxy', host: 'ZEEK', user: '', type: 'TLS', msg: 'SRV-FS02 -> 203.0.113.88:443 TLSv12 server_name=- cert subject="CN=localhost" issuer="CN=localhost" not_after=2036-09-30' },
          { id: 'f6', t: '04:02:00', src: 'process', host: 'SRV-FS02', user: 'Administrator', type: 'File create', msg: 'D:\\Shares\\README_RESTORE.txt: "Files encrypted with ChaCha20 + RSA-4096. Pay to receive the private key."' },
        ],
      },
      questions: [
        {
          id: 'mi3-q1',
          type: 'mc',
          prompt: 'Encryption is in progress on SRV-FS02. What is the right immediate action?',
          choices: [
            'Isolate SRV-FS02 on the network with EDR and suspend or kill lck.exe, keeping the server powered on and capturing memory',
            'Pull the power cable at once',
            'Let it finish so the files are consistent',
            'Reboot into safe mode and run antivirus',
          ],
          answer: 'Isolate SRV-FS02 on the network with EDR and suspend or kill lck.exe, keeping the server powered on and capturing memory',
          explanation:
            'Stop the damage and the attacker\'s access, but keep volatile evidence: memory can hold the per-file keys or the process state that a free decryptor needs. Pulling the power destroys that; letting it run loses more data.',
        },
        {
          id: 'mi3-q2',
          type: 'mc',
          prompt: 'The sample contains an RSA-4096 public key. Can you decrypt the files with it?',
          choices: [
            'No: files are encrypted with ChaCha20 keys wrapped by the attacker\'s public key; only the private key unwraps them',
            'Yes: extract the public key and reverse the encryption',
            'Yes: hash the .lck files to recover the originals',
            'Yes: ChaCha20 is only encoding',
          ],
          answer: 'No: files are encrypted with ChaCha20 keys wrapped by the attacker\'s public key; only the private key unwraps them',
          explanation:
            'Hybrid encryption: fast symmetric encryption per file, key wrapped with RSA. The public key can only encrypt. Recovery comes from backups (the locked S3 copies), memory captured in time, or a published decryptor if the malware has a flaw.',
        },
        {
          id: 'mi3-q3',
          type: 'multi',
          prompt: 'Which observations tie the file server to the same attacker? Select all that apply.',
          choices: [
            'The logon comes from SRV-BKP01 with the golden-ticket Administrator session',
            'The C2 destination 203.0.113.88 is the same IP that used the stolen AWS key',
            'A self-signed CN=localhost certificate with a ten-year validity, which no public CA issues',
            'The ransom note is a .txt file',
            'SRV-FS02 has shares on D:',
          ],
          answer: [
            'The logon comes from SRV-BKP01 with the golden-ticket Administrator session',
            'The C2 destination 203.0.113.88 is the same IP that used the stolen AWS key',
            'A self-signed CN=localhost certificate with a ten-year validity, which no public CA issues',
          ],
          explanation:
            'Shared infrastructure (203.0.113.88), the forged Administrator session from SRV-BKP01, and a default framework certificate link the ransomware to the same intrusion. Public TLS certificates are capped at 200 days now, so ten years means self-made.',
        },
      ],
    },
    {
      id: 'mi-4',
      title: 'Evidence and patient zero',
      summary: 'Collect evidence in the right order and confirm how WS-MKT-03 was compromised.',
      requires: { lessons: ['l3-forensics'] },
      brief:
        'Legal and the insurer want defensible evidence, and you still need patient zero confirmed. Artifacts from WS-MKT-03 have come in from a triage collection.',
      evidence: {
        label: 'WS-MKT-03 triage collection (UTC)',
        rows: [
          { id: 'w1', t: '20:47:02', src: 'email', host: 'MAIL-GW', user: 'l.ferreira', type: 'Delivered', msg: 'From: "Brand Assets" <assets@press-kit-share.example>  Attachment: Q4_Campaign.zip -> Q4_Campaign.iso  spf=pass dkim=pass dmarc=pass (domain 2 days old)' },
          { id: 'w2', t: '20:58:40', src: 'process', host: 'WS-MKT-03', user: 'l.ferreira', type: 'Prefetch', msg: 'C:\\Windows\\Prefetch\\RUNDLL32.EXE-...pf last run 20:58:40, referenced E:\\assets\\brand.dll' },
          { id: 'w3', t: '20:58:43', src: 'process', host: 'WS-MKT-03', user: 'l.ferreira', type: '$MFT', msg: 'C:\\Users\\l.ferreira\\AppData\\Roaming\\Adobe\\upd.dll  $SI created 2020-01-14  $FN created 2026-10-02 20:58:43' },
          { id: 'w4', t: '21:19:55', src: 'process', host: 'WS-MKT-03', user: 'l.ferreira', type: 'Amcache', msg: 'C:\\Users\\Public\\r.exe first seen 21:19:55, SHA-1 recorded (file since deleted)' },
          { id: 'w5', t: '21:20:30', src: 'process', host: 'WS-MKT-03', user: 'l.ferreira', type: 'Prefetch', msg: 'R.EXE-...pf run count 1, last run 21:20:30 (matches the Kerberoasting time on the DC)' },
        ],
      },
      questions: [
        {
          id: 'mi4-q1',
          type: 'mc',
          prompt: 'In what order do you collect evidence from SRV-FS02 and SRV-BKP01, which are isolated but still running?',
          choices: [
            'Memory first, then a full disk image through a write blocker or forensic agent, with SHA-256 hashes and chain of custody',
            'Disk image first, then memory',
            'Copy the Shares folder to USB, then reboot',
            'Shut down cleanly, then image the disks',
          ],
          answer: 'Memory first, then a full disk image through a write blocker or forensic agent, with SHA-256 hashes and chain of custody',
          explanation:
            'Order of volatility (RFC 3227): memory before disk. Hash the images and log every handover so the evidence holds up for legal and the insurer.',
        },
        {
          id: 'mi4-q2',
          type: 'multi',
          prompt: 'What do the WS-MKT-03 artifacts establish? Select all that apply.',
          choices: [
            'rundll32 executed brand.dll from the mounted ISO at 20:58: the initial execution',
            'upd.dll was timestomped: $SI says 2020, $FN shows it was created at 20:58:43 on 2 October',
            'r.exe was present and ran at the exact time of the Kerberoasting, even though it was deleted',
            'The Prefetch file proves which passwords were cracked',
            'The email passed DMARC, so it was legitimate',
          ],
          answer: [
            'rundll32 executed brand.dll from the mounted ISO at 20:58: the initial execution',
            'upd.dll was timestomped: $SI says 2020, $FN shows it was created at 20:58:43 on 2 October',
            'r.exe was present and ran at the exact time of the Kerberoasting, even though it was deleted',
          ],
          explanation:
            'Prefetch proves execution and Amcache proves presence, and $SI earlier than $FN is timestomping. Together they place patient zero at WS-MKT-03 via the ISO attachment at 20:58. Prefetch says nothing about cracking, and DMARC passing for a 2-day-old domain proves nothing about intent.',
        },
      ],
    },
    {
      id: 'mi-5',
      title: 'Eradicate, recover, detect',
      summary: 'Plan the coordinated eviction, the recovery order and the detections that would have caught this earlier.',
      requires: { lessons: ['l3-detection', 'l2-ir'] },
      brief:
        'Containment is holding: WS-MKT-03, SRV-BKP01 and SRV-FS02 are isolated, the AWS key is disabled and 203.0.113.88 is blocked. Now plan the next 72 hours.',
      evidence: {
        label: 'Status board · 07:30',
        rows: [
          { id: 's1', t: '07:30:00', src: 'ops', host: 'IR', user: '', type: 'Contained', msg: 'Isolated: WS-MKT-03, SRV-BKP01, SRV-FS02 (memory captured on all three). AWS key backup-offsite disabled; lifecycle rule removed.' },
          { id: 's2', t: '07:30:00', src: 'ops', host: 'IR', user: '', type: 'Exposure', msg: 'Stolen: krbtgt, Administrator and 1,380 user secrets (DCSync). svc_backup password cracked.' },
          { id: 's3', t: '07:30:00', src: 'ops', host: 'IR', user: '', type: 'Backups', msg: 'S3 backups intact (Object Lock, 30 days). Last good copy of SRV-FS02: 01:00 today.' },
          { id: 's4', t: '07:30:00', src: 'ops', host: 'SIEM', user: '', type: 'Detections', msg: 'No alert fired for the RC4 4769 burst at 21:20 (rule missing). DCSync alert fired at 02:41 but was triaged at 04:02.' },
        ],
      },
      questions: [
        {
          id: 'mi5-q1',
          type: 'mc',
          prompt: 'The attacker holds the krbtgt hash. What does eradication of the domain access require?',
          choices: [
            'Reset krbtgt twice (allowing replication between resets) in a coordinated window, together with Administrator, svc_backup and the other privileged and service credentials',
            'Reset krbtgt once, immediately, before anything else is ready',
            'Reimage WS-MKT-03 only',
            'Nothing: isolating the hosts removed the golden ticket',
          ],
          answer: 'Reset krbtgt twice (allowing replication between resets) in a coordinated window, together with Administrator, svc_backup and the other privileged and service credentials',
          explanation:
            'krbtgt keeps its previous key, so a single reset leaves forged tickets valid. Do both resets in one planned window with the other credential rotations, after scoping, so the attacker cannot fall back on something you missed.',
        },
        {
          id: 'mi5-q2',
          type: 'multi',
          prompt: 'Which new or improved detections would have caught this intrusion earlier? Select all that apply.',
          choices: [
            'RC4 4769 bursts for many SPNs from one client (T1558.003)',
            'Replication (4662 DS-Replication-Get-Changes-All) from a non-DC, paged as critical (T1003.006)',
            'Long-term cloud key used from a new IP with GetCallerIdentity first (T1078.004)',
            'An alert on every self-signed certificate company-wide',
            'Disabling the vssadmin rule because it is noisy',
          ],
          answer: [
            'RC4 4769 bursts for many SPNs from one client (T1558.003)',
            'Replication (4662 DS-Replication-Get-Changes-All) from a non-DC, paged as critical (T1003.006)',
            'Long-term cloud key used from a new IP with GetCallerIdentity first (T1078.004)',
          ],
          explanation:
            'Each targets a behaviour in this chain and can be tuned narrowly. An alert on every self-signed certificate would drown the SOC in printer and appliance noise; disabling a ransomware precursor rule throws away the detection.',
        },
      ],
    },
  ],
  escalation: {
    requires: { stages: ['mi-1', 'mi-2', 'mi-3', 'mi-4', 'mi-5'] },
    passScore: 60,
    ui: {
      panelTitle: 'Incident report',
      title: 'Major incident report',
      barTitle: 'Incident report',
      rowText: 'Executive summary and technical report for the 08:00 bridge',
      alertTag: 'Report',
      intro:
        'Two audiences, one report. Leadership needs a plain-language executive summary: what happened, the business impact, what is being done and the decisions they must make. The responders need the technical detail: the attack chain, scope, indicators and the eradication plan.',
      writeLabel: 'Write the report',
      sendLabel: 'Submit report',
      reviseLabel: 'Revise the report',
      feedbackTitle: 'Report review',
      verdictLabel: 'Outcome',
      verdictText: 'True positive · major incident, contained, eradication planned',
      passNote: 'Report accepted. Leadership can make its decisions and the responders have a plan.',
      failNote: 'The report leaves leadership or the responders without what they need. 60+ completes the capstone.',
    },
    panels: [
      { title: 'Executive summary', icon: 'user', fields: ['exec', 'severity'] },
      { title: 'Technical report', icon: 'terminal', fields: ['technical', 'phase'] },
      { title: 'Scope', icon: 'host', fields: ['hosts', 'accounts'] },
      { title: 'Attack timeline', icon: 'clock', fields: ['timeline'] },
      { title: 'Indicators of compromise', icon: 'crosshair', fields: ['iocs'] },
      { title: 'Response plan', icon: 'shield', fields: ['evidence', 'actions'] },
    ],
    fields: {
      exec: {
        label: 'Executive summary (for leadership, plain language)',
        kind: 'text',
        minLength: 120,
        placeholder: 'No jargon. What happened, what it means for the business, what is being done, whether backups are safe, and what you need leadership to decide.',
        rubric: [
          { label: 'Plain statement of what happened (criminals got in and started ransomware)', any: ['ransomware', 'attacker', 'criminal', 'intrusion', 'broke in', 'break-in'] },
          { label: 'Business impact (file server encrypted, network-wide accounts stolen)', any: ['file server', 'shared drive', 'shares', 'impact', 'unavailable', 'every account', 'all accounts', 'passwords'] },
          { label: 'Backups are safe and recovery is possible', any: ['backup', 'restore', 'recover'] },
          { label: 'Contained: the attack is stopped', any: ['contained', 'stopped', 'isolated', 'under control'] },
          { label: 'Decisions needed (password reset downtime, ransom, notification, insurer)', any: ['decision', 'approve', 'ransom', 'insurer', 'insurance', 'notify', 'notification', 'regulator', 'downtime', 'legal'] },
        ],
      },
      technical: {
        label: 'Technical report (for the responders)',
        kind: 'text',
        minLength: 160,
        placeholder: 'Attack chain with techniques: initial access, credential attacks, DCSync and golden ticket, cloud activity, ransomware, and the eradication plan.',
        rubric: [
          { label: 'Initial access on WS-MKT-03 (ISO attachment)', any: ['ws-mkt-03', 'iso', 'brand.dll', 'l.ferreira', 'phishing'] },
          { label: 'Kerberoasting and the cracked svc_backup', any: ['kerberoast', 't1558.003', 'rc4', 'svc_backup'] },
          { label: 'DCSync and golden ticket (krbtgt)', any: ['dcsync', 'krbtgt', 'golden'] },
          { label: 'Cloud: stolen backup key, deletions blocked by Object Lock', any: ['akia', 'access key', 'object lock', 'cloudtrail', 'backup-offsite', 'lifecycle'] },
          { label: 'Ransomware on SRV-FS02 (hybrid encryption, shadow copies deleted)', any: ['srv-fs02', 'lck.exe', 'chacha20', 'shadow', 't1486'] },
          { label: 'Eradication: double krbtgt reset and credential rotation', any: ['twice', 'double', 'rotate', 'rotation', 'reset'] },
        ],
      },
      severity: {
        label: 'Severity',
        kind: 'choice',
        options: ['low', 'medium', 'high', 'critical'],
        credit: { critical: 1, high: 0.4, medium: 0, low: 0 },
      },
      phase: {
        label: 'Incident phase now',
        kind: 'choice',
        options: ['identification', 'containment', 'eradication', 'recovery', 'lessons-learned'],
        labels: {
          identification: 'Identification / analysis',
          containment: 'Containment in progress',
          eradication: 'Contained; coordinated eradication planned',
          recovery: 'Recovery in progress',
          'lessons-learned': 'Closed / lessons learned',
        },
        credit: { eradication: 1, containment: 0.4, recovery: 0.2, identification: 0, 'lessons-learned': 0 },
      },
      hosts: {
        label: 'Compromised systems',
        kind: 'set',
        options: ['WS-MKT-03', 'SRV-BKP01', 'SRV-FS02', 'SRV-DC01 (DCSync target; domain secrets stolen)', 'AWS account 111122223333 (backup key)', 'SRV-DC02 (normal replication partner)', 'MAIL-GW', 'PRN-HR-02'],
        correct: ['WS-MKT-03', 'SRV-BKP01', 'SRV-FS02', 'SRV-DC01 (DCSync target; domain secrets stolen)', 'AWS account 111122223333 (backup key)'],
      },
      accounts: {
        label: 'Compromised identities',
        kind: 'set',
        options: ['l.ferreira', 'svc_backup', 'krbtgt', 'Administrator', 'backup-offsite (AWS key)', 'svc_web', 'r.ito', 'j.moreno'],
        correct: ['l.ferreira', 'svc_backup', 'krbtgt', 'Administrator', 'backup-offsite (AWS key)'],
      },
      timeline: {
        label: 'Attack timeline (tick the events that belong to the intrusion)',
        kind: 'set',
        options: [
          { id: 't1', t: '20:58', text: 'l.ferreira runs brand.dll from the ISO on WS-MKT-03' },
          { id: 't2', t: '21:20', text: 'Kerberoasting: 29 RC4 service tickets from WS-MKT-03' },
          { id: 't3', t: '23:02', text: 'Cracked svc_backup logs on to SRV-BKP01' },
          { id: 't4', t: '01:00', text: 'Scheduled backup of SRV-FS02 to S3' },
          { id: 't5', t: '02:41', text: 'DCSync from SRV-BKP01 (krbtgt stolen)' },
          { id: 't6', t: '03:10', text: 'Stolen AWS backup key used; deletions blocked by Object Lock' },
          { id: 't7', t: '03:25', text: 'Normal DC-to-DC replication SRV-DC01 to SRV-DC02' },
          { id: 't8', t: '03:40', text: 'Golden-ticket Administrator logon to SRV-FS02' },
          { id: 't9', t: '03:52', text: 'Shadow copies deleted, lck.exe dropped' },
          { id: 't10', t: '04:01', text: 'Files encrypted; beacon to 203.0.113.88 (CN=localhost certificate)' },
        ],
        correct: ['t1', 't2', 't3', 't5', 't6', 't8', 't9', 't10'],
      },
      iocs: {
        label: 'Indicators of compromise to sweep for',
        kind: 'set',
        options: [
          '203.0.113.88',
          'press-kit-share.example',
          'C:\\ProgramData\\lck\\lck.exe',
          'C:\\Users\\l.ferreira\\AppData\\Roaming\\Adobe\\upd.dll',
          'Self-signed TLS certificate CN=localhost (JA3 of the implant)',
          '192.0.2.30 (the backup appliance\'s normal IP)',
          '10.20.30.14 (SRV-BKP01)',
          'vssadmin.exe',
        ],
        correct: [
          '203.0.113.88',
          'press-kit-share.example',
          'C:\\ProgramData\\lck\\lck.exe',
          'C:\\Users\\l.ferreira\\AppData\\Roaming\\Adobe\\upd.dll',
          'Self-signed TLS certificate CN=localhost (JA3 of the implant)',
        ],
      },
      evidence: {
        label: 'Evidence to preserve',
        kind: 'set',
        options: [
          'Memory images of WS-MKT-03, SRV-BKP01 and SRV-FS02',
          'Hashed disk images with chain of custody',
          'DC Security logs and CloudTrail for the whole window',
          'The ransom note and a sample of encrypted files',
          'Nothing: restoring from backup is faster',
          'Wipe SRV-FS02 immediately to stop the spread',
        ],
        correct: [
          'Memory images of WS-MKT-03, SRV-BKP01 and SRV-FS02',
          'Hashed disk images with chain of custody',
          'DC Security logs and CloudTrail for the whole window',
          'The ransom note and a sample of encrypted files',
        ],
      },
      actions: {
        label: 'Response plan (next 72 hours)',
        kind: 'set',
        options: [
          'Double krbtgt reset and rotation of all privileged, service and user credentials in one coordinated window',
          'Rebuild WS-MKT-03, SRV-BKP01 and SRV-FS02 from clean images; restore SRV-FS02 data from the locked S3 backup',
          'Replace the backup server\'s long-term AWS key with a scoped, short-lived role; keep Object Lock and the SCP',
          'Remove svc_backup\'s replication right; move service accounts to gMSA and AES-only',
          'Deploy the RC4 4769 burst, non-DC replication and cloud new-IP key detections, and page on DCSync',
          'Engage legal, the insurer and the regulator-notification process with leadership',
          'Pay the ransom first, then investigate',
          'Reset krbtgt once right now, before the scope is known',
        ],
        correct: [
          'Double krbtgt reset and rotation of all privileged, service and user credentials in one coordinated window',
          'Rebuild WS-MKT-03, SRV-BKP01 and SRV-FS02 from clean images; restore SRV-FS02 data from the locked S3 backup',
          'Replace the backup server\'s long-term AWS key with a scoped, short-lived role; keep Object Lock and the SCP',
          'Remove svc_backup\'s replication right; move service accounts to gMSA and AES-only',
          'Deploy the RC4 4769 burst, non-DC replication and cloud new-IP key detections, and page on DCSync',
          'Engage legal, the insurer and the regulator-notification process with leadership',
        ],
      },
    },
    weights: { exec: 15, technical: 20, severity: 5, phase: 5, hosts: 10, accounts: 10, timeline: 10, iocs: 5, evidence: 10, actions: 10 },
    model: {
      severity: 'critical',
      phase: 'eradication',
      exec:
        'Overnight, criminals broke into our network through a malicious email attachment opened on a marketing laptop. They stole passwords that let them control every account in the company, tried to destroy our cloud backups, and started ransomware on the main file server, which encrypted part of the shared drives. The attack is contained: the affected machines are isolated and the attackers\' access is cut off. Our cloud backups are safe because they are locked against deletion, so we can restore the file server without paying. Decisions needed today: approve a company-wide password reset with a short sign-in outage this weekend, confirm we will not pay the ransom, and engage legal and the insurer on whether we must notify regulators or customers.',
      technical:
        'Initial access 20:58: l.ferreira ran brand.dll from an ISO attachment (press-kit-share.example) on WS-MKT-03; upd.dll persistence was timestomped. 21:20: Kerberoasting (T1558.003) with r.exe: 29 RC4 service tickets; svc_backup was cracked and used on SRV-BKP01 at 23:02. 02:41: DCSync (T1003.006) with svc_backup\'s replication right stole krbtgt, Administrator and 1,380 secrets; a golden ticket (T1558.001) for Administrator reached SRV-FS02 at 03:40. 03:10: the long-term AWS access key backup-offsite (AKIA) from SRV-BKP01 was used from 203.0.113.88 to add a 1-day lifecycle rule and delete backups; Object Lock and the SCP blocked the deletions and StopLogging (CloudTrail). 03:52-04:01: shadow copies deleted and lck.exe encrypted 2,318 files on SRV-FS02 (ChaCha20 + RSA-4096, T1486), beaconing to 203.0.113.88 with a CN=localhost certificate. Eradication: double krbtgt reset and rotation of every privileged, service and user credential in one window, rebuild the three hosts, restore from the locked backup.',
      severityNote: 'Critical: domain-wide credential theft, attempted backup destruction and active ransomware. Anything lower understates it.',
      phaseNote: 'Containment is holding and the coordinated eradication is planned but not yet done.',
    },
  },
};

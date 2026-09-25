// Level 3 · Digital forensics: questions, lesson and misconceptions.
// RFC 3227 (order of volatility), NIST SP 800-86, Windows execution artifacts (Prefetch, Amcache,
// ShimCache, SRUM), NTFS $MFT timestamps ($STANDARD_INFORMATION vs $FILE_NAME), Volatility 3.

const items = [
  {
    id: 'for-01',
    skill: 'l3-forensics',
    difficulty: 1,
    type: 'mc',
    prompt: 'Following RFC 3227, which of these do you collect **first** from a live compromised server?',
    choices: ['CPU registers, cache and RAM contents', 'The system disk', 'Remote syslog data', 'Archived backup tapes'],
    answer: 'CPU registers, cache and RAM contents',
    misconceptions: { 'The system disk': 'for-volatility-order' },
    explanation:
      'The **order of volatility**: registers and cache, then routing/ARP/process tables and memory, then temporary file systems, then disk, then remote logging and monitoring data, then physical configuration and archival media. Collect the most short-lived evidence first, because it disappears on its own or as soon as you touch the machine.',
  },
  {
    id: 'for-02',
    skill: 'l3-forensics',
    difficulty: 1,
    type: 'mc',
    prompt: 'The admin wants to "shut the server down cleanly so nothing changes" before forensics. What is lost?',
    choices: [
      'Everything in memory: running and injected processes, network connections, decrypted data and keys, fileless malware',
      'Nothing: shutdown preserves everything',
      'Only the desktop wallpaper',
      'The event logs are deleted',
    ],
    answer: 'Everything in memory: running and injected processes, network connections, decrypted data and keys, fileless malware',
    misconceptions: { 'Nothing: shutdown preserves everything': 'for-shutdown-preserves' },
    explanation:
      'A shutdown also writes to disk (logs, pagefile handling, temp clean-up), changing evidence, and may trigger anti-forensic scripts. Capture memory first (e.g. WinPmem, DumpIt, or the EDR\'s memory collection) and isolate the host from the network while it stays on.',
  },
  {
    id: 'for-03',
    skill: 'l3-forensics',
    difficulty: 2,
    type: 'text',
    prompt: 'In which folder does Windows store Prefetch files? (full path)',
    accept: ['c:\\windows\\prefetch', 'c:\\windows\\prefetch\\', '%systemroot%\\prefetch', '\\windows\\prefetch', 'windows\\prefetch', 'c:/windows/prefetch'],
    misconceptions: { 'c:\\windows\\temp': 'for-prefetch-meaning', 'c:\\windows\\system32': 'for-prefetch-meaning' },
    explanation:
      '`C:\\Windows\\Prefetch\\` holds files named like `RCLONE.EXE-9A3B1C2D.pf`. Each records the executable, a run count, up to the last eight run times (Windows 8+) and files and folders touched in the first seconds. Prefetch is often disabled on servers, so absence proves nothing.',
  },
  {
    id: 'for-04',
    skill: 'l3-forensics',
    difficulty: 2,
    type: 'mc',
    prompt: 'You find `C:\\Windows\\Prefetch\\RCLONE.EXE-9A3B1C2D.pf` on a file server. What does it establish?',
    snippet:
      'PECmd.exe -f RCLONE.EXE-9A3B1C2D.pf\n  Executable name: RCLONE.EXE\n  Run count: 3\n  Last run: 2026-09-24 02:58:41 UTC\n  Other run times: 2026-09-24 02:55:12, 2026-09-24 02:54:03\n  Directories referenced: \\VOLUME{...}\\USERS\\PUBLIC\\MUSIC\\, \\VOLUME{...}\\SHARES\\FINANCE\\',
    choices: [
      'rclone.exe ran three times, most recently at 02:58:41 UTC, from a user Music folder and touched the Finance share; strong evidence of execution, likely exfiltration tooling',
      'It proves the Finance data was uploaded to the internet',
      'It only shows the file was downloaded, not run',
      'Prefetch files are created for every file on disk',
    ],
    answer: 'rclone.exe ran three times, most recently at 02:58:41 UTC, from a user Music folder and touched the Finance share; strong evidence of execution, likely exfiltration tooling',
    misconceptions: {
      'It proves the Finance data was uploaded to the internet': 'for-prefetch-meaning',
      'It only shows the file was downloaded, not run': 'for-prefetch-meaning',
      'Prefetch files are created for every file on disk': 'for-prefetch-meaning',
    },
    explanation:
      'Prefetch is an **execution** artifact: the program ran, when and how often, and what it touched at start-up. It does not prove what data left; for that, correlate with firewall/proxy byte counts, SRUM network usage and rclone config files. rclone in a Music folder at 03:00 is a well-known exfiltration pattern.',
  },
  {
    id: 'for-05',
    skill: 'l3-forensics',
    difficulty: 2,
    type: 'mc',
    prompt: 'Why do examiners image a disk through a **write blocker** and record its SHA-256?',
    choices: [
      'The blocker prevents any change to the original, and matching hashes prove the image is a bit-for-bit copy that has not changed since',
      'To make the copy faster',
      'SHA-256 encrypts the evidence',
      'So the image can be opened in Word',
    ],
    answer: 'The blocker prevents any change to the original, and matching hashes prove the image is a bit-for-bit copy that has not changed since',
    misconceptions: { 'SHA-256 encrypts the evidence': 'for-copy-is-image' },
    explanation:
      'Simply attaching a disk to Windows writes to it (mount, indexing, timestamps). A hardware or software write blocker stops that. The hash of the source and of the image must match, and re-hashing later shows integrity. Every transfer goes on the **chain of custody** form: who, when, why, where it is stored.',
  },
  {
    id: 'for-06',
    skill: 'l3-forensics',
    difficulty: 1,
    type: 'text',
    prompt: 'What is the name for the documented record of who handled a piece of evidence, when, and why, from collection to court? (three words)',
    accept: ['chain of custody', 'chain-of-custody', 'custody chain'],
    misconceptions: { 'evidence log': 'for-copy-is-image', 'audit trail': 'for-copy-is-image' },
    explanation:
      'The **chain of custody** shows that evidence was not tampered with: each handover is signed and dated, with the hash, storage location and purpose. Without it, even correct findings can be challenged in HR, legal or insurance proceedings.',
  },
  {
    id: 'for-07',
    skill: 'l3-forensics',
    difficulty: 2,
    type: 'mc',
    prompt: 'A colleague copied the suspect\'s `Documents` folder to a USB stick with Explorer and calls it "the disk image". What is missing?',
    choices: [
      'A forensic image is a bit-for-bit copy of the whole device, including deleted files, slack and unallocated space, file system metadata and hashes; a file copy has none of that and changes timestamps',
      'Nothing: a copy is the same as an image',
      'Only the file icons',
      'The copy needs to be zipped to count',
    ],
    answer: 'A forensic image is a bit-for-bit copy of the whole device, including deleted files, slack and unallocated space, file system metadata and hashes; a file copy has none of that and changes timestamps',
    misconceptions: { 'Nothing: a copy is the same as an image': 'for-copy-is-image', 'The copy needs to be zipped to count': 'for-copy-is-image' },
    explanation:
      'Logical copies lose deleted data, alternate data streams, the $MFT, registry hives in use, and often the original created/accessed timestamps. Use an imaging tool (FTK Imager, dd/dc3dd, or EWF/E01 formats) through a write blocker, and hash both sides. For live triage, targeted collectors such as KAPE grab the key artifacts quickly.',
  },
  {
    id: 'for-08',
    skill: 'l3-forensics',
    difficulty: 3,
    type: 'mc',
    prompt: 'The $MFT entry for `svchost_upd.exe` shows these timestamps. What stands out?',
    snippet:
      'MFTECmd output (UTC)\n  File: C:\\Windows\\System32\\svchost_upd.exe\n  $STANDARD_INFORMATION  Created: 2019-12-07 09:10:02   Modified: 2019-12-07 09:10:02\n  $FILE_NAME             Created: 2026-09-23 23:41:17   Modified: 2026-09-23 23:41:17',
    choices: [
      'Timestomping: $SI was backdated to look like an original system file, but the $FILE_NAME times (harder to change) show it arrived on 23 September 2026',
      'The file is a genuine Windows file from 2019',
      'The clock was wrong in 2019',
      'Nothing: the two attributes always differ by years',
    ],
    answer: 'Timestomping: $SI was backdated to look like an original system file, but the $FILE_NAME times (harder to change) show it arrived on 23 September 2026',
    misconceptions: { 'The file is a genuine Windows file from 2019': 'for-prefetch-meaning' },
    explanation:
      'NTFS keeps two sets of MACB times. User-mode tools (and T1070.006 timestomping) change $STANDARD_INFORMATION easily; $FILE_NAME is updated by the kernel and is much harder to fake. $SI earlier than $FN, or times with zeroed sub-seconds, are classic signs. 2019-12-07 is the date many Windows 10 system files carry, which is why attackers copy it.',
  },
  {
    id: 'for-09',
    skill: 'l3-forensics',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which Windows artifacts can show that a program **executed** (or at least was present), even after the attacker deleted the binary? (select all)',
    choices: [
      'Prefetch (.pf) files',
      'Amcache.hve (SHA-1 of the file, path, first-seen time)',
      'ShimCache / AppCompatCache in the SYSTEM hive',
      'Security event 4688 process creation (if auditing was on) or Sysmon event 1',
      'The Recycle Bin icon',
      'The desktop wallpaper setting',
    ],
    answer: [
      'Prefetch (.pf) files',
      'Amcache.hve (SHA-1 of the file, path, first-seen time)',
      'ShimCache / AppCompatCache in the SYSTEM hive',
      'Security event 4688 process creation (if auditing was on) or Sysmon event 1',
    ],
    explanation:
      'Each artifact has caveats: Prefetch proves execution; Amcache records presence and a SHA-1 you can look up; ShimCache on Windows 10+ records presence, not necessarily execution; 4688/Sysmon 1 show the command line when enabled. Use several together. Tools: PECmd, AmcacheParser, AppCompatCacheParser (Eric Zimmerman\'s tools).',
  },
  {
    id: 'for-10',
    skill: 'l3-forensics',
    difficulty: 2,
    type: 'mc',
    prompt: 'In a memory image, Volatility 3 `windows.netscan` shows `rundll32.exe` with an ESTABLISHED connection to 203.0.113.140:443 and no DLL argument on its command line. Why does that matter?',
    choices: [
      'rundll32 with no DLL argument that talks to the internet is a common sign of injected or hollowed code, which only memory analysis may reveal',
      'rundll32 always connects to the internet',
      'It proves the disk is encrypted',
      'Memory images cannot show network connections',
    ],
    answer: 'rundll32 with no DLL argument that talks to the internet is a common sign of injected or hollowed code, which only memory analysis may reveal',
    misconceptions: { 'Memory images cannot show network connections': 'for-volatility-order' },
    explanation:
      'Many C2 frameworks spawn rundll32 as a sacrificial process and inject into it. `windows.cmdline`, `windows.malfind` (executable private memory regions) and `windows.netscan` on the memory image expose it; the disk may hold nothing. This is why memory comes first in the order of volatility.',
  },
  {
    id: 'for-11',
    skill: 'l3-forensics',
    difficulty: 3,
    type: 'text',
    prompt: 'To merge evidence from hosts in different time zones into one timeline, which time standard should every entry be converted to? (abbreviation)',
    accept: ['utc', 'coordinated universal time', 'gmt', 'zulu'],
    misconceptions: { 'local time': 'for-volatility-order', est: 'for-volatility-order' },
    explanation:
      'Normalise everything to **UTC** (NTFS, CloudTrail and most logs already store UTC; event viewers and some appliances show local time). Also note clock skew between systems. A super-timeline (e.g. Plaso/log2timeline, or Timeline Explorer over EZ tool output) sorts disk, log and memory evidence into one sequence.',
  },
  {
    id: 'for-12',
    skill: 'l3-forensics',
    difficulty: 1,
    type: 'mc',
    prompt: 'Why is a responder\'s own activity (logins, tools run, times) written down during live collection?',
    choices: [
      'So the examiner can tell responder actions apart from attacker actions in the timeline, and so the process can be defended later',
      'To bill the customer',
      'Because the operating system requires it',
      'It is not needed',
    ],
    answer: 'So the examiner can tell responder actions apart from attacker actions in the timeline, and so the process can be defended later',
    misconceptions: { 'It is not needed': 'for-copy-is-image' },
    explanation:
      'Live response changes the system: your logon creates 4624 events, your tools create Prefetch files. Contemporaneous notes (time in UTC, command, hash of tools, output location) keep the timeline honest and support the chain of custody (NIST SP 800-86).',
  },
  {
    id: 'for-13',
    skill: 'l3-forensics',
    difficulty: 3,
    type: 'mc',
    prompt: 'Ransomware is encrypting a file server right now. The admin asks whether to pull the power cable. What is the best answer?',
    choices: [
      'Isolate it with EDR and suspend the process instead, then capture memory: a hard power-off loses the keys and process state that could allow decryption',
      'Pull the plug: powering off preserves everything exactly as it is',
      'Do a clean shutdown so the disk is consistent for imaging',
      'Leave it running and connected so the encryption finishes cleanly',
    ],
    answer: 'Isolate it with EDR and suspend the process instead, then capture memory: a hard power-off loses the keys and process state that could allow decryption',
    misconceptions: {
      'Pull the plug: powering off preserves everything exactly as it is': 'for-shutdown-preserves',
      'Do a clean shutdown so the disk is consistent for imaging': 'for-shutdown-preserves',
    },
    explanation:
      'Stopping the damage and keeping volatile evidence are both possible: network isolation plus suspending the encrypting process halts it without wiping memory, where per-file keys may still sit. Some responders do cut power as a last resort when nothing else can stop the encryption, but that is a trade-off made knowingly, not a way of "preserving" evidence.',
  },
];

const lesson = {
  skill: 'l3-forensics',
  title: 'Digital forensics',
  goal: 'Collect evidence in the right order without spoiling it, and build a timeline from Windows artifacts.',
  sections: [
    {
      id: 'volatility',
      heading: 'Order of volatility',
      body: [
        'RFC 3227: collect the most short-lived evidence first. **Registers and cache → memory, process and network tables → temporary files → disk → remote logs → archives.**',
        'Do **not** power off a compromised machine to "preserve" it: memory holds running and injected code, network connections, decrypted data and encryption keys (sometimes the ransomware key). Isolate it on the network, capture memory, then image the disk.',
      ],
    },
    {
      id: 'custody',
      heading: 'Imaging and chain of custody',
      body: [
        'A **forensic image** is a bit-for-bit copy of the whole device, including deleted files, slack space, unallocated space and file system metadata. A file copy is not an image. Image through a **write blocker** and record **SHA-256** hashes of the source and the image; matching hashes prove the copy is exact.',
        'The **chain of custody** records every handover: who, when, why, the hash and the storage location. Keep contemporaneous notes of your own actions (in UTC) so they are not mistaken for the attacker\'s.',
      ],
    },
    {
      id: 'artifacts',
      heading: 'Windows execution artifacts',
      body: ['What proves a program was on the system or ran, even after deletion:'],
      points: [
        '**Prefetch** (`C:\\Windows\\Prefetch\\*.pf`): execution, run count, last 8 run times, files referenced. Often disabled on servers.',
        '**Amcache.hve**: path, SHA-1 and first-seen time of executables.',
        '**ShimCache** (AppCompatCache, SYSTEM hive): presence of executables; order matters more than times.',
        '**Event logs**: 4688 / Sysmon 1 process creation with command lines, 7045 new services, 4624 logons.',
        '**$MFT**: every file\'s timestamps. $STANDARD_INFORMATION is easy to change (timestomping); $FILE_NAME is much harder. $SI earlier than $FN is a red flag.',
      ],
    },
    {
      id: 'memory',
      heading: 'Memory analysis',
      body: [
        'A memory image answers what disk cannot: which processes were running (`windows.pslist`, `windows.pstree`), their command lines (`windows.cmdline`), network connections (`windows.netscan`) and injected code (`windows.malfind`) in Volatility 3.',
        'Classic finds: rundll32 or svchost with the wrong parent or no arguments, talking to the internet; PowerShell with a decoded script in memory; credential theft tools touching LSASS.',
      ],
    },
    {
      id: 'timeline',
      heading: 'Building the timeline',
      body: [
        'Convert everything to **UTC**, then merge: logons, process creation, file creation, Prefetch run times, proxy and firewall connections, cloud audit logs. A super-timeline (Plaso, or EZ tools into Timeline Explorer) turns thousands of artifacts into the story: initial access → execution → persistence → lateral movement → objective.',
        'Label every entry with its source and how sure you are ("executed" from Prefetch vs "present" from ShimCache). Gaps are findings too.',
      ],
    },
  ],
  worked: [
    {
      id: 'for-w1',
      title: 'What happened on FS-02?',
      artifactLabel: 'Artifacts, all converted to UTC',
      artifact:
        '23:41:17 $MFT ($FN) C:\\Windows\\System32\\svchost_upd.exe created ($SI says 2019-12-07)\n23:41:40 7045 service "UpdSvc" -> svchost_upd.exe\n02:54:03 Prefetch RCLONE.EXE first run (C:\\Users\\Public\\Music\\rclone.exe)\n02:58:41 Prefetch RCLONE.EXE last run (3 runs) - referenced \\SHARES\\FINANCE\\\n02:55-03:20 firewall FS-02 -> 198.51.100.200:443 bytes_out=41.2 GB',
      question: 'Build the story and rate each finding.',
      steps: [
        '23:41 a binary lands in System32 with backdated $SI times (timestomping) and becomes a service 23 seconds later: persistence, confirmed by 7045 (proven).',
        '02:54-02:58 rclone runs three times from a Public Music folder and touches the Finance share: execution proven by Prefetch.',
        'The firewall shows 41.2 GB outbound to one IP in the same window: combined with rclone, exfiltration is highly likely, even though Prefetch alone does not prove what was sent.',
        'Gaps to close: how svchost_upd.exe arrived (logons before 23:41), and whether memory was captured before any reboot.',
      ],
      conclusion: 'Each artifact answers one question (present, executed, connected); the timeline is convincing because independent sources agree.',
    },
  ],
  faded: [
    {
      id: 'for-f1',
      title: 'The admin wants to reboot',
      artifactLabel: 'Bridge call, 03:25',
      artifact:
        'SRV-APP03 has an unknown process beaconing every 30 s.\nAdmin: "I\'ll reboot it into safe mode and copy the suspicious folder to a USB stick for you."',
      question: 'What do you ask for instead?',
      given: ['The host is live and beaconing: memory holds the running code and its connections.'],
      todo: [
        {
          prompt: 'What should happen first?',
          type: 'mc',
          choices: ['Network-isolate the host and capture memory while it runs', 'Reboot into safe mode', 'Copy the folder to USB'],
          answer: 'Network-isolate the host and capture memory while it runs',
          explanation: 'Isolation stops the beacon; memory capture keeps the volatile evidence that a reboot would destroy.',
        },
        {
          prompt: 'After memory, how should the disk be acquired?',
          type: 'mc',
          choices: ['A full image through a write blocker (or a forensic agent), with SHA-256 hashes and a chain of custody entry', 'Copying the suspicious folder with Explorer', 'Zipping the Windows folder'],
          answer: 'A full image through a write blocker (or a forensic agent), with SHA-256 hashes and a chain of custody entry',
          explanation: 'A file copy loses deleted data and metadata and changes timestamps; an image with matching hashes is defensible.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'for-volatility-order',
    skill: 'l3-forensics',
    name: 'Ignoring the order of volatility',
    description: 'Collects the disk first, skips memory, or mixes local times with UTC in a timeline.',
    fix: 'RFC 3227: registers, cache and memory first, then process and network state, temporary files, disk, remote logs and archives. Memory shows injected code, connections and keys that exist nowhere else. When you build the timeline, normalise every source to UTC.',
    lesson: 'l3-forensics#volatility',
  },
  {
    id: 'for-shutdown-preserves',
    skill: 'l3-forensics',
    name: 'Shutting down preserves evidence',
    description: 'Believes powering off or rebooting a compromised machine keeps the evidence safe.',
    fix: 'A shutdown destroys everything in memory (fileless malware, injected code, connections, decryption keys) and writes to disk on the way down. Keep the host running, isolate it from the network with EDR, capture memory, then image the disk.',
    lesson: 'l3-forensics#volatility',
  },
  {
    id: 'for-prefetch-meaning',
    skill: 'l3-forensics',
    name: 'Over- or under-reading artifacts',
    description: 'Thinks Prefetch proves data theft or only a download, or trusts $STANDARD_INFORMATION timestamps blindly.',
    fix: 'Prefetch proves execution (run count, last run times, files touched at start-up), not what data left: correlate with network byte counts. Amcache and ShimCache show presence. $STANDARD_INFORMATION times are easy to timestomp; compare with $FILE_NAME.',
    lesson: 'l3-forensics#artifacts',
  },
  {
    id: 'for-copy-is-image',
    skill: 'l3-forensics',
    name: 'A file copy is an image',
    description: 'Treats copied folders as forensic images, or skips hashing and custody records.',
    fix: 'A forensic image is a bit-for-bit copy of the whole device including deleted and unallocated space, taken through a write blocker and verified with matching SHA-256 hashes. Record every handover in the chain of custody and note your own actions in UTC so they are not mistaken for the attacker\'s.',
    lesson: 'l3-forensics#custody',
  },
];

export const FORENSICS = { items, lesson, misconceptions };

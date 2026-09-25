// Misconception catalog: common beginner errors, grouped by skill.
//
// Each misconception has:
//   id           unique id, referenced from questions (see `misconceptions` on items)
//   skill        the skill it belongs to
//   name         short name shown to the student
//   description  what the student probably believes
//   fix          the targeted explanation shown when they pick an answer revealing it
//   lesson       optional link to a lesson section: '<skill id>#<section id>'
//
// Questions tag wrong answers with these ids:
//   mc / multi: misconceptions: { '<exact choice text>': '<id>' }
//     - mc: picking that (wrong) choice reveals the misconception
//     - multi: picking a tagged wrong choice, OR leaving a tagged correct choice unticked
//   text: misconceptions: { '<typed answer>': '<id>' } (compared like answers: case/space-insensitive)
// Every misconception must be tested by at least two items, so a follow-up question
// (a different item) is always available. tests/content.test.js checks this.

export const MISCONCEPTIONS = [
  // ---------------- OS fundamentals & processes ----------------
  {
    id: 'proc-program-vs-process',
    skill: 'host-processes',
    name: 'Program file = running process',
    description: 'Thinks an executable on disk and a running process are the same thing.',
    fix: 'A program is a file on disk. A process is one running copy of it in memory, with its own PID, owner and memory. One program can run as many processes, and a process can keep running even after its file is deleted. Analysts look at both: the file (path, hash, signer) and the process (parent, command line, user).',
    lesson: 'host-processes#program-process',
  },
  {
    id: 'proc-pid-ppid',
    skill: 'host-processes',
    name: 'Mixing up PID and PPID (parent vs child)',
    description: 'Reads the process tree backwards, or confuses a process\'s own ID with its parent\'s ID.',
    fix: 'PID is the process\'s own ID. PPID is the ID of the process that started it (its parent). To find who launched something, take its PPID and find the process whose PID matches. Trees read top-down: the parent is above, children are indented below it.',
    lesson: 'host-processes#pid-ppid',
  },
  {
    id: 'proc-svchost-parent',
    skill: 'host-processes',
    name: 'Not knowing svchost.exe\'s real parent',
    description: 'Does not know that legitimate svchost.exe is always started by services.exe.',
    fix: 'The normal Windows chain is wininit.exe → services.exe → svchost.exe. A real svchost.exe has services.exe as its parent and runs from C:\\Windows\\System32. An svchost.exe started by explorer.exe, cmd.exe or anything else is a strong sign of malware in disguise.',
    lesson: 'host-processes#trees',
  },
  {
    id: 'proc-powershell-always-bad',
    skill: 'host-processes',
    name: 'Any PowerShell = malicious',
    description: 'Treats every PowerShell process as an attack.',
    fix: 'PowerShell is a normal admin and automation tool, used every day by IT, management agents and installers. What matters is context: who started it (Word or a browser is suspicious), how (hidden window, -EncodedCommand, download cradles like IEX/DownloadString), as which user, and what it connects to. Judge the behaviour, not the name.',
    lesson: 'host-processes#red-flags',
  },

  // ---------------- Users, groups & permissions ----------------
  {
    id: 'perm-rwx-triplets',
    skill: 'host-users',
    name: 'Misreading rwx permission triplets',
    description: 'Mixes up which rwx block belongs to owner, group and others, or how they map to octal digits.',
    fix: 'After the first character (file type), there are three blocks of rwx: owner, group, others. Each block becomes one octal digit: r=4, w=2, x=1, added up. So rwx=7, r-x=5, r--=4, ---=0, and rwxr-x--- is 750 (group can read and execute, others nothing).',
    lesson: 'host-users#linux-perms',
  },
  {
    id: 'perm-uac-guarantee',
    skill: 'host-users',
    name: 'UAC (or admin prompts) guarantee safety',
    description: 'Believes UAC is a security boundary that stops malware from running.',
    fix: 'UAC makes administrators run with a standard-user token until they approve an elevation prompt. It reduces accidental damage, but Microsoft does not treat it as a security boundary: users click "Yes", and attackers use UAC bypasses. Malware can run fine without admin rights, too. Defence needs least privilege, EDR and monitoring on top of UAC.',
    lesson: 'host-users#windows-admin',
  },
  {
    id: 'perm-suid-sticky',
    skill: 'host-users',
    name: 'Confusing SUID with the sticky bit',
    description: 'Thinks the "s" in -rwsr-xr-x is the sticky bit or a signature.',
    fix: 'An "s" in the owner\'s execute position is SUID: the program runs with the file owner\'s privileges (often root) no matter who starts it. The sticky bit is a "t" in the others\' execute position (like /tmp, drwxrwxrwt) and only stops users deleting each other\'s files. Unexpected SUID-root binaries are a classic privilege-escalation path.',
    lesson: 'host-users#special-bits',
  },

  // ---------------- File system & common paths ----------------
  {
    id: 'fs-passwd-hashes',
    skill: 'host-filesystem',
    name: 'Password hashes live in /etc/passwd',
    description: 'Believes /etc/passwd stores the password hashes (or plain-text passwords).',
    fix: '/etc/passwd lists accounts (name, UID, GID, home, shell) and must be readable by everyone. The "x" in the password field means "the hash is stored in /etc/shadow". /etc/shadow holds the hashes and is readable only by root. An attacker reading /etc/shadow, or a hash appearing in /etc/passwd, is a finding.',
    lesson: 'host-filesystem#secrets',
  },
  {
    id: 'fs-user-writable',
    skill: 'host-filesystem',
    name: 'Getting user-writable Windows folders wrong',
    description: 'Thinks standard users can write to System32/Program Files, or does not realise Temp, Public and ProgramData are writable.',
    fix: 'Standard users cannot write to C:\\Windows\\System32 or C:\\Program Files; installing there needs admin rights. They CAN write to their own profile (AppData, AppData\\Local\\Temp, Downloads, Desktop), to C:\\Users\\Public and, by default, to C:\\ProgramData. That is why malware without admin rights runs from those folders.',
    lesson: 'host-filesystem#writable',
  },
  {
    id: 'fs-trust-name-location',
    skill: 'host-filesystem',
    name: 'Trusting a file because its name or folder looks official',
    description: 'Assumes a file or task is legitimate because it is named like a system component or vendor.',
    fix: 'Names are chosen by whoever created the file. Attackers deliberately use names like svchost.exe, GoogleUpdate or "Windows Update", and look-alikes such as svch0st.exe. Check the full path, the parent process, the digital signature and the behaviour. A "system" file in C:\\Users\\Public or AppData is a red flag, not reassurance.',
    lesson: 'host-filesystem#writable',
  },

  // ---------------- Services & persistence ----------------
  {
    id: 'pers-definition',
    skill: 'host-persistence',
    name: 'Confusing persistence with other attack stages',
    description: 'Mixes up persistence with brute force, lateral movement or exfiltration.',
    fix: 'Persistence is how an attacker keeps access after a reboot, logoff or password change: services, scheduled tasks, Run keys, cron, SSH keys and so on. Guessing passwords is credential access (brute force), hopping to other hosts is lateral movement, and copying data out is exfiltration. They are different stages (MITRE ATT&CK tactics).',
    lesson: 'host-persistence#what-is',
  },
  {
    id: 'pers-new-service-malware',
    skill: 'host-persistence',
    name: 'Every new service is malware',
    description: 'Treats any service-install event (7045) as proof of compromise.',
    fix: 'Event 7045 ("A service was installed") fires for every legitimate installer and driver too. Triage the details: is the binary in a user-writable folder (Public, Temp, AppData)? Does it run as LocalSystem with auto-start? Is the name random or imitating Microsoft? Is it signed by a known vendor, and was the change expected? Context decides.',
    lesson: 'host-persistence#triage',
  },
  {
    id: 'pers-linux-locations',
    skill: 'host-persistence',
    name: 'Not knowing which Linux locations auto-run code',
    description: 'Thinks log files or virtual files like /proc or /var/log give persistence.',
    fix: 'Persistence needs something that runs code automatically: cron (/etc/crontab, /etc/cron.d, user crontabs), systemd unit files (/etc/systemd/system), shell start-up files (~/.bashrc, ~/.profile) and SSH keys (~/.ssh/authorized_keys) that grant logins. Logs (/var/log) record activity and /proc is a live view of the kernel; neither starts anything.',
    lesson: 'host-persistence#linux-autostart',
  },

  // ---------------- Host logs ----------------
  {
    id: 'log-success-vs-failure',
    skill: 'host-logs',
    name: 'Confusing successful and failed logons',
    description: 'Mixes up 4624 and 4625, or reads "Failed password" lines as successful logins.',
    fix: 'Windows: 4624 = successful logon, 4625 = failed logon (think "5 = fail"). Linux auth.log: "Accepted password/publickey" = success, "Failed password" = failure. Always look for a success AFTER a run of failures from the same source; that is what turns a noisy brute force into a likely compromise.',
    lesson: 'host-logs#windows-security',
  },
  {
    id: 'log-failures-harmless',
    skill: 'host-logs',
    name: 'Many failed logons = a forgetful user',
    description: 'Dismisses a burst of failed logons as someone mistyping their password.',
    fix: 'A person who forgot their password fails a few times, from their own device, for their own account. Dozens of failures in minutes, from an external IP, across several usernames (admin, root, test...) is automated password guessing or spraying. Check the source, the timing, the usernames and whether any attempt succeeded.',
    lesson: 'host-logs#patterns',
  },
  {
    id: 'log-clear-routine',
    skill: 'host-logs',
    name: 'Treating a cleared audit log as routine',
    description: 'Thinks Event ID 1102 (audit log cleared) is normal maintenance.',
    fix: 'Event 1102 means someone cleared the Security log (System log clearing is event 104). Admins almost never need to do this, and attackers do it to hide what they did. Treat it as high priority: check who cleared it (the account in the event), when, and what happened just before on that host from other sources such as EDR or a SIEM copy of the logs.',
    lesson: 'host-logs#patterns',
  },

  // ---------------- OSI & TCP/IP ----------------
  {
    id: 'osi-l2-l3',
    skill: 'net-osi',
    name: 'Mixing up Layer 2 (MAC) and Layer 3 (IP)',
    description: 'Places IP addresses at the data-link layer or MAC addresses at the network layer.',
    fix: 'Layer 2 (Data Link) uses MAC addresses and moves frames within one local network (switches). Layer 3 (Network) uses IP addresses and routes packets between networks (routers). MAC addresses stay on the local segment; IP addresses travel end to end.',
    lesson: 'net-osi#what-where',
  },
  {
    id: 'osi-transport-layer',
    skill: 'net-osi',
    name: 'Putting TCP/UDP at the wrong layer',
    description: 'Thinks TCP/UDP are application or network-layer protocols.',
    fix: 'TCP and UDP are Layer 4 (Transport) protocols: they add ports and (for TCP) reliable delivery. IP and ICMP are Layer 3. HTTP, DNS and SMTP are application-layer (Layer 7) protocols that ride on top of TCP or UDP.',
    lesson: 'net-osi#what-where',
  },
  {
    id: 'osi-encapsulation-order',
    skill: 'net-osi',
    name: 'Getting the encapsulation order wrong',
    description: 'Mixes up the order of segment, packet and frame.',
    fix: 'Going down the stack, each layer wraps the one above: application data → Layer 4 segment (TCP) or datagram (UDP) → Layer 3 packet (adds IP header) → Layer 2 frame (adds Ethernet header and trailer) → bits on the wire. Receiving reverses it.',
    lesson: 'net-osi#encapsulation',
  },

  // ---------------- IP addressing ----------------
  {
    id: 'ip-private-ranges',
    skill: 'net-ip',
    name: 'Misjudging private vs public IPs',
    description: 'Misremembers the RFC 1918 ranges, especially the 172.16–172.31 block.',
    fix: 'The only RFC 1918 private ranges are 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0–172.31.255.255) and 192.168.0.0/16. So 172.20.x.x is private but 172.32.x.x is public, and 192.169.x.x is public. 169.254.x.x (link-local) and 127.x.x.x (loopback) are special, but they are not RFC 1918.',
    lesson: 'net-ip#private',
  },
  {
    id: 'ip-apipa',
    skill: 'net-ip',
    name: 'Treating 169.254.x.x as a normal address',
    description: 'Thinks a 169.254.x.x address came from DHCP or the ISP, or is one of the RFC 1918 ranges.',
    fix: '169.254.0.0/16 is link-local (APIPA on Windows). A host gives itself one of these when it cannot reach a DHCP server. It only works on the local link and is not routed. It is a troubleshooting clue ("no DHCP"), not an ISP address, and it is not one of the three RFC 1918 private ranges.',
    lesson: 'net-ip#special',
  },
  {
    id: 'ip-nat',
    skill: 'net-ip',
    name: 'Not accounting for NAT',
    description: 'Expects an internal (private) IP to show up in logs on the internet.',
    fix: 'Private addresses are not routed on the internet. The edge firewall or router uses NAT to swap the private source address for its own public address. External logs therefore show the organisation\'s public IP, and you need the firewall\'s NAT logs (time + public IP + source port) to find the internal host.',
    lesson: 'net-ip#nat',
  },

  // ---------------- Subnetting ----------------
  {
    id: 'sub-prefix-is-hosts',
    skill: 'net-subnet',
    name: '"/24 means 24 hosts"',
    description: 'Reads the CIDR prefix as a host count.',
    fix: 'The number after the slash is how many bits are the network part. The rest are host bits: a /24 has 32 − 24 = 8 host bits, so 2^8 = 256 addresses. A bigger prefix means a smaller network.',
    lesson: 'net-subnet#cidr',
  },
  {
    id: 'sub-usable-count',
    skill: 'net-subnet',
    name: 'Miscounting usable hosts',
    description: 'Forgets to subtract the network and broadcast addresses, or subtracts them when asked for total addresses.',
    fix: 'Total addresses = 2^(host bits). Usable host addresses = total − 2, because the first address is the network address and the last is the broadcast address. /24: 256 total, 254 usable. /26: 64 total, 62 usable. (/31 and /32 are special cases.)',
    lesson: 'net-subnet#hosts',
  },
  {
    id: 'sub-mask-conversion',
    skill: 'net-subnet',
    name: 'Converting prefixes to masks incorrectly',
    description: 'Puts the partial octet in the wrong place or uses the wrong value.',
    fix: 'Write the prefix as full octets of 255 first, then the leftover bits. /20 = 8+8+4: 255.255 then 4 bits = 128+64+32+16 = 240, so 255.255.240.0. Values for 1–8 leftover bits: 128, 192, 224, 240, 248, 252, 254, 255.',
    lesson: 'net-subnet#masks',
  },
  {
    id: 'sub-octet-boundary',
    skill: 'net-subnet',
    name: 'Assuming subnets end at an octet boundary',
    description: 'Thinks a /23 or /27 range stops at .255 of one octet or ignores the block size.',
    fix: 'Find the block size in the "interesting" octet: 256 − mask value. /23 has mask 255.255.254.0, so blocks of 2 in the third octet: 10.1.4.0/23 runs 10.1.4.0–10.1.5.255. /27 has blocks of 32 in the last octet: .64/27 runs .64–.95. Networks start at multiples of the block size.',
    lesson: 'net-subnet#ranges',
  },

  // ---------------- Ports ----------------
  {
    id: 'port-src-dst',
    skill: 'net-ports',
    name: 'Mixing up source and destination ports',
    description: 'Thinks the client uses the service port as its source, or reads the client\'s ephemeral port as the service.',
    fix: 'The server listens on the well-known port (443, 22, 3389...), and that is the DESTINATION port of the client\'s traffic. The client picks a random high ephemeral port as its SOURCE (49152–65535 on modern Windows; 32768–60999 by default on Linux). The low, well-known port usually tells you the service; the random high one is just the client.',
    lesson: 'net-ports#src-dst',
  },
  {
    id: 'port-rdp-smb',
    skill: 'net-ports',
    name: 'Mixing up RDP (3389) and SMB (445)',
    description: 'Swaps the Windows remote desktop and file-sharing ports.',
    fix: 'TCP 3389 = RDP (Remote Desktop, interactive logons, logon type 10). TCP 445 = SMB (file sharing, admin shares, used by PsExec and many worms). Both should almost never be open to the internet.',
    lesson: 'net-ports#common',
  },
  {
    id: 'port-plaintext',
    skill: 'net-ports',
    name: 'Mixing up plaintext and encrypted protocols',
    description: 'Thinks SSH/HTTPS are plaintext or that Telnet/FTP/HTTP are encrypted.',
    fix: 'Telnet (23), FTP (21) and HTTP (80) send everything, including passwords, in plaintext. SSH (22), HTTPS (443) and SFTP (runs over SSH) are encrypted. Plaintext credentials on the wire are a finding in themselves.',
    lesson: 'net-ports#plaintext',
  },

  // ---------------- TCP & UDP ----------------
  {
    id: 'tcp-udp-handshake',
    skill: 'net-tcp-udp',
    name: 'Believing UDP has a handshake',
    description: 'Thinks UDP sets up connections with SYN/ACK or guarantees ordered delivery.',
    fix: 'UDP is connectionless: no handshake, no sequence numbers, no acknowledgements, no retransmission. A sender just fires datagrams. DNS queries, NTP, syslog and many games and VoIP apps use it. The SYN / SYN-ACK / ACK handshake and flags belong to TCP only.',
    lesson: 'net-tcp-udp#udp',
  },
  {
    id: 'tcp-closed-silent',
    skill: 'net-tcp-udp',
    name: 'Closed ports stay silent',
    description: 'Confuses a closed port (answers with RST) with a filtered one (no reply).',
    fix: 'A reachable host with nothing listening on a TCP port answers a SYN with RST ("closed"). No answer at all usually means a firewall silently dropped the packet ("filtered"). An open port answers SYN-ACK. Scanners use exactly this difference.',
    lesson: 'net-tcp-udp#patterns',
  },
  {
    id: 'tcp-half-open-normal',
    skill: 'net-tcp-udp',
    name: 'Treating half-open connections as normal sessions',
    description: 'Reads floods of SYNs (or SYN_RECV entries) as ordinary connected users.',
    fix: 'A normal TCP session completes SYN → SYN-ACK → ACK and then carries data. Lots of SYNs to many ports that never complete is a SYN scan. Thousands of half-open (SYN_RECV) connections that never get the final ACK is a SYN flood. Look for whether the handshake finishes.',
    lesson: 'net-tcp-udp#patterns',
  },

  // ---------------- DNS ----------------
  {
    id: 'dns-a-ptr',
    skill: 'net-dns',
    name: 'Confusing A and PTR records',
    description: 'Uses A records for reverse lookups, or PTR for forward lookups.',
    fix: 'A record: name → IPv4 address (forward lookup). AAAA: name → IPv6. PTR record: IP address → name (reverse lookup), stored under in-addr.arpa, e.g. 9.113.0.203.in-addr.arpa for 203.0.113.9. `dig -x` and `nslookup <IP>` query PTR records.',
    lesson: 'net-dns#records',
  },
  {
    id: 'dns-udp-only',
    skill: 'net-dns',
    name: 'DNS only ever uses UDP',
    description: 'Thinks DNS never uses TCP.',
    fix: 'Most DNS queries use UDP 53, but DNS also uses TCP 53 for responses too big for UDP (for example with DNSSEC), for zone transfers (AXFR) between servers, and whenever a server signals truncation. Blocking TCP 53 breaks things, and unexpected zone transfers to outside hosts are a finding.',
    lesson: 'net-dns#resolution',
  },
  {
    id: 'dns-lookalike',
    skill: 'net-dns',
    name: 'Trusting a domain that contains a brand name',
    description: 'Assumes a domain is legitimate because the brand name appears in it.',
    fix: 'Only the registered domain (the part just before the TLD) matters: login.microsoftonline.com belongs to Microsoft, but microsoft-login-secure.example or micros0ft-support.example do not. Look for extra words, hyphens, swapped letters (rn/m, 0/o) and odd TLDs. A padlock or brand logo proves nothing.',
    lesson: 'net-dns#abuse',
  },

  // ---------------- HTTP & HTTPS ----------------
  {
    id: 'http-https-safe',
    skill: 'net-http',
    name: 'HTTPS means the site is safe',
    description: 'Believes the padlock guarantees a site is trustworthy.',
    fix: 'HTTPS only means the connection is encrypted and the certificate matches the domain name. Free certificates are issued automatically, so most phishing sites use HTTPS too. It says nothing about who runs the site or whether it is malicious. Judge the domain and the behaviour, not the padlock.',
    lesson: 'net-http#https',
  },
  {
    id: 'http-https-hides-all',
    skill: 'net-http',
    name: 'HTTPS hides where you are going',
    description: 'Thinks TLS hides the destination IP and the server name.',
    fix: 'TLS encrypts the URL path, query string, headers, cookies and content. It does NOT hide the destination IP address and port, and the server name is still visible in the TLS SNI field unless Encrypted Client Hello is used. DNS lookups may also reveal it. That is why firewalls and proxies can still log which sites you visit.',
    lesson: 'net-http#https',
  },
  {
    id: 'http-status-classes',
    skill: 'net-http',
    name: 'Mixing up HTTP status codes',
    description: 'Confuses client errors (4xx) with server errors (5xx), or 403 with 404.',
    fix: '2xx = success (200 OK), 3xx = redirect, 4xx = the CLIENT asked for something wrong or forbidden (401 needs login, 403 forbidden, 404 not found), 5xx = the SERVER failed (500 internal error, 503 unavailable). Floods of 404s often mean scanning; bursts of 500s during attacks can mean an injection is breaking the app.',
    lesson: 'net-http#status',
  },

  // ---------------- Firewall & connection logs ----------------
  {
    id: 'fw-allowed-safe',
    skill: 'net-fw-logs',
    name: '"Allowed" means safe',
    description: 'Assumes traffic the firewall allowed is harmless, so only denies matter.',
    fix: 'The firewall only checks its rules; it has no idea whether allowed traffic is good. Many real incidents are allowed connections: RDP opened to the internet, C2 over 443, exfiltration to cloud storage. Denied traffic shows attempts that were stopped; allowed traffic is where compromises actually happen.',
    lesson: 'net-fw-logs#allow-deny',
  },
  {
    id: 'fw-scan-direction',
    skill: 'net-fw-logs',
    name: 'Mixing up horizontal and vertical scans',
    description: 'Confuses one-port-many-hosts with many-ports-one-host.',
    fix: 'Horizontal scan: one source hits the SAME port on MANY hosts (looking for any machine with SSH or SMB open). Vertical scan: one source hits MANY ports on ONE host (mapping everything that host runs). Read which field changes: the destination IP or the destination port.',
    lesson: 'net-fw-logs#scans',
  },
  {
    id: 'fw-transfer-direction',
    skill: 'net-fw-logs',
    name: 'Reading transfer direction backwards',
    description: 'Mistakes a huge upload for a download (or the reverse) in connection logs.',
    fix: 'Check which side sent the bytes. bytes_out / sent from an internal host to an external one is an upload: data leaving (possible exfiltration). bytes_in / received is a download. A normal download is small out, big in. Big out, small in (especially off-hours to an unknown host) is the exfiltration pattern.',
    lesson: 'net-fw-logs#c2-exfil',
  },
];

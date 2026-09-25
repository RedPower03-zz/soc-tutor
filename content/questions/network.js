// Network basics questions. Same format as host.js (see the comment at the top of that file).
// IPs in scenarios use documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
// or private ranges, so they never point at real hosts.

export const NETWORK_ITEMS = [
  // ===================== OSI & TCP/IP layers =====================
  {
    id: 'no-01',
    skill: 'net-osi',
    difficulty: 1,
    type: 'mc',
    prompt: 'At which OSI layer do IP addresses and routers operate?',
    choices: ['Layer 3 — Network', 'Layer 2 — Data Link', 'Layer 4 — Transport', 'Layer 7 — Application'],
    answer: 'Layer 3 — Network',
    misconceptions: {
      "Layer 2 — Data Link": 'osi-l2-l3',
    },
    explanation:
      'IP addressing and routing between networks happen at Layer 3 (Network). Layer 2 uses MAC addresses within one local network (switches), Layer 4 is TCP/UDP and ports, and Layer 7 is the application protocol such as HTTP or DNS.',
  },
  {
    id: 'no-02',
    skill: 'net-osi',
    difficulty: 1,
    type: 'mc',
    prompt: 'MAC addresses (like 00:1A:2B:3C:4D:5E) belong to which OSI layer?',
    choices: ['Layer 2 — Data Link', 'Layer 3 — Network', 'Layer 1 — Physical', 'Layer 4 — Transport'],
    answer: 'Layer 2 — Data Link',
    misconceptions: {
      "Layer 3 — Network": 'osi-l2-l3',
    },
    explanation:
      'MAC addresses identify network interfaces on the local segment and are used by switches at Layer 2. Layer 1 is the raw signal (cables, radio), Layer 3 uses IP addresses, and Layer 4 uses ports.',
  },
  {
    id: 'no-03',
    skill: 'net-osi',
    difficulty: 1,
    type: 'text',
    prompt: 'How many layers does the OSI model have?',
    accept: ['7', 'seven'],
    explanation:
      'Seven: Physical, Data Link, Network, Transport, Session, Presentation, Application. A common memory aid from Layer 1 up is "Please Do Not Throw Sausage Pizza Away".',
  },
  {
    id: 'no-04',
    skill: 'net-osi',
    difficulty: 1,
    type: 'mc',
    prompt: 'TCP and UDP operate at which OSI layer?',
    choices: ['Layer 4 — Transport', 'Layer 3 — Network', 'Layer 5 — Session', 'Layer 7 — Application'],
    answer: 'Layer 4 — Transport',
    misconceptions: {
      "Layer 3 — Network": 'osi-transport-layer',
      "Layer 7 — Application": 'osi-transport-layer',
    },
    explanation:
      'TCP and UDP are transport protocols: they add port numbers so traffic reaches the right application, and TCP adds reliability. IP (below them) is Layer 3; HTTP, DNS and friends (above them) are Layer 7.',
  },
  {
    id: 'no-05',
    skill: 'net-osi',
    difficulty: 2,
    type: 'mc',
    prompt: 'In the 4-layer TCP/IP model, which layer covers OSI layers 5–7 (Session, Presentation, Application)?',
    choices: ['Application', 'Transport', 'Internet', 'Link (Network Access)'],
    answer: 'Application',
    explanation:
      'The TCP/IP model merges OSI 5–7 into a single Application layer. Its Transport layer matches OSI 4, Internet matches OSI 3, and Link covers OSI 1–2.',
  },
  {
    id: 'no-06',
    skill: 'net-osi',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these are Application-layer (Layer 7) protocols? Select all that apply.',
    choices: ['HTTP', 'DNS', 'SMTP', 'TCP', 'ICMP'],
    answer: ['HTTP', 'DNS', 'SMTP'],
    misconceptions: {
      "TCP": 'osi-transport-layer',
    },
    explanation:
      'HTTP (web), DNS (name lookups) and SMTP (email delivery) are application protocols. TCP is Layer 4 (Transport) and ICMP — the protocol behind ping — works alongside IP at Layer 3.',
  },
  {
    id: 'no-07',
    skill: 'net-osi',
    difficulty: 2,
    type: 'mc',
    prompt: 'A basic firewall rule allows or blocks traffic using only source/destination IP address and destination port. Which layers is it looking at?',
    choices: ['Layers 3 and 4', 'Layer 2 only', 'Layer 7 only', 'Layers 1 and 2'],
    answer: 'Layers 3 and 4',
    explanation:
      'IP addresses are Layer 3 and ports are Layer 4, so a classic packet-filtering firewall works at L3/L4. A "next-generation" or web application firewall that inspects URLs or app content works up at Layer 7.',
  },
  {
    id: 'no-08',
    skill: 'net-osi',
    difficulty: 3,
    type: 'mc',
    prompt: 'As a web request moves down the stack, data is encapsulated. What is the correct order of units from Layer 4 down to Layer 2?',
    choices: [
      'Segment → Packet → Frame',
      'Frame → Packet → Segment',
      'Packet → Segment → Frame',
      'Segment → Frame → Packet',
    ],
    answer: 'Segment → Packet → Frame',
    misconceptions: {
      "Frame → Packet → Segment": 'osi-encapsulation-order',
      "Packet → Segment → Frame": 'osi-encapsulation-order',
      "Segment → Frame → Packet": 'osi-encapsulation-order',
    },
    explanation:
      'TCP wraps data into a segment (Layer 4), IP wraps the segment in a packet (Layer 3), and Ethernet/Wi-Fi wraps the packet in a frame (Layer 2), which then goes out as bits (Layer 1). The receiver unwraps in the reverse order.',
  },

  // ===================== IP addressing & private ranges =====================
  {
    id: 'ni-01',
    skill: 'net-ip',
    difficulty: 1,
    type: 'text',
    prompt: 'How many bits long is an IPv4 address?',
    accept: ['32', '32 bits', '32bit', '32 bit'],
    explanation:
      'IPv4 addresses are 32 bits, written as four 8-bit numbers (octets) from 0–255, e.g. 192.168.1.10. IPv6 addresses are 128 bits.',
  },
  {
    id: 'ni-02',
    skill: 'net-ip',
    difficulty: 1,
    type: 'multi',
    prompt: 'Which of these are RFC 1918 private IPv4 ranges? Select all that apply.',
    choices: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '172.32.0.0/12'],
    answer: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    misconceptions: {
      "169.254.0.0/16": 'ip-apipa',
      "172.32.0.0/12": 'ip-private-ranges',
      "172.16.0.0/12": 'ip-private-ranges',
    },
    explanation:
      'The three private ranges are 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0 – 172.31.255.255) and 192.168.0.0/16. 169.254.0.0/16 is link-local (APIPA) — also not routable, but not RFC 1918. 172.32.x.x is outside the 172.16/12 block and is public.',
  },
  {
    id: 'ni-03',
    skill: 'net-ip',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which of these IP addresses is private (RFC 1918)?',
    choices: ['172.20.5.9', '172.32.1.1', '11.0.0.5', '192.169.1.10'],
    answer: '172.20.5.9',
    misconceptions: {
      "172.32.1.1": 'ip-private-ranges',
      "192.169.1.10": 'ip-private-ranges',
      "11.0.0.5": 'ip-private-ranges',
    },
    explanation:
      '172.20.5.9 falls inside 172.16.0.0 – 172.31.255.255. The others are look-alikes: 172.32.1.1 is just past that range, 11.x is not 10.x, and 192.169.x is not 192.168.x — all public.',
  },
  {
    id: 'ni-04',
    skill: 'net-ip',
    difficulty: 1,
    type: 'text',
    prompt: 'What IPv4 address is the standard loopback address a computer uses to talk to itself?',
    accept: ['127.0.0.1'],
    explanation:
      '127.0.0.1 (the name "localhost") never leaves the machine; the whole 127.0.0.0/8 block is reserved for loopback. A service listening only on 127.0.0.1 cannot be reached from the network.',
  },
  {
    id: 'ni-05',
    skill: 'net-ip',
    difficulty: 2,
    type: 'mc',
    prompt: 'A Windows laptop shows the IP address 169.254.33.7. What most likely happened?',
    choices: [
      'DHCP failed, so it gave itself a link-local (APIPA) address',
      'Its ISP handed it a public address from the 169.254 range',
      'It is using its loopback address because the NIC is disabled',
      'It joined a multicast group used for printer discovery',
    ],
    answer: 'DHCP failed, so it gave itself a link-local (APIPA) address',
    misconceptions: {
      'Its ISP handed it a public address from the 169.254 range': 'ip-apipa',
    },
    explanation:
      '169.254.0.0/16 is link-local. Windows self-assigns one (APIPA) when no DHCP server answers, so the device can only talk to its local segment. Loopback is 127.x, multicast is 224.0.0.0 – 239.255.255.255, and 169.254 is never handed out by an ISP.',
  },
  {
    id: 'ni-06',
    skill: 'net-ip',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which connection in this log leaves the internal network for the internet?',
    snippet: `#1  src=10.20.4.17  dst=203.0.113.80  dport=443  action=allow
#2  src=10.20.4.17  dst=10.20.9.3     dport=445  action=allow`,
    choices: ['#1 only', '#2 only', 'Both', 'Neither'],
    answer: '#1 only',
    misconceptions: {
      "#2 only": 'ip-private-ranges',
      "Both": 'ip-private-ranges',
      "Neither": 'ip-private-ranges',
    },
    explanation:
      '10.x addresses are private, so #2 (10.20.4.17 → 10.20.9.3) stays inside the network. #1 goes to 203.0.113.80, which is not in a private range, so it heads out to the internet.',
  },
  {
    id: 'ni-07',
    skill: 'net-ip',
    difficulty: 2,
    type: 'mc',
    prompt: 'What is the IPv6 loopback address?',
    choices: ['::1', 'fe80::1', '::', 'ff02::1'],
    answer: '::1',
    explanation:
      '::1 is IPv6 loopback, the equivalent of 127.0.0.1. fe80::/10 addresses are link-local, `::` means "unspecified/any address", and ff02::1 is the all-nodes multicast group.',
  },
  {
    id: 'ni-08',
    skill: 'net-ip',
    difficulty: 3,
    type: 'mc',
    prompt: 'Your workstation\'s IP is 192.168.10.44, but an external website\'s logs record your visit as coming from 198.51.100.25. Why?',
    choices: [
      'A NAT device translated your private address to its public one',
      'The website logged the wrong address because of a clock error',
      'Your workstation has a second network card with a public IP',
      'DNS rewrote your IP address when it resolved the website',
    ],
    answer:
      'A NAT device translated your private address to its public one',
    misconceptions: {
      'The website logged the wrong address because of a clock error': 'ip-nat',
      'DNS rewrote your IP address when it resolved the website': 'ip-nat',
    },
    explanation:
      'Private addresses are not routed on the internet, so Network Address Translation swaps them for a public IP on the way out. That is why external logs show the organisation\'s public IP; to find the real internal host you correlate with the firewall/NAT logs. DNS resolves names — it never changes your address.',
  },

  // ===================== Subnetting & CIDR =====================
  {
    id: 'ns-01',
    skill: 'net-subnet',
    difficulty: 1,
    type: 'mc',
    prompt: 'In 192.168.1.0/24, what does "/24" mean?',
    choices: [
      'The first 24 bits are the network part; the last 8 are hosts',
      'The network holds exactly 24 hosts, including the default gateway',
      'Devices on the network communicate using port 24',
      'It is the 24th subnet defined in the organisation\'s plan',
    ],
    answer: 'The first 24 bits are the network part; the last 8 are hosts',
    misconceptions: {
      'The network holds exactly 24 hosts, including the default gateway': 'sub-prefix-is-hosts',
    },
    explanation:
      'CIDR notation gives the prefix length: how many leading bits are the network part. /24 leaves 32 − 24 = 8 host bits, which is the same as the mask 255.255.255.0.',
  },
  {
    id: 'ns-02',
    skill: 'net-subnet',
    difficulty: 1,
    type: 'mc',
    prompt: 'How many total IP addresses are in a /24 network?',
    choices: ['256', '254', '24', '512'],
    answer: '256',
    misconceptions: {
      "24": 'sub-prefix-is-hosts',
      "254": 'sub-usable-count',
    },
    explanation:
      '8 host bits gives 2^8 = 256 addresses in total. Two are reserved (the network address .0 and the broadcast address .255), so 254 are usable by hosts — 254 is the usable count, not the total.',
  },
  {
    id: 'ns-03',
    skill: 'net-subnet',
    difficulty: 2,
    type: 'text',
    prompt: 'How many usable host addresses are in a /26 subnet?',
    accept: ['62'],
    misconceptions: {
      "26": 'sub-prefix-is-hosts',
      "64": 'sub-usable-count',
    },
    explanation:
      '/26 leaves 32 − 26 = 6 host bits: 2^6 = 64 addresses. Subtract the network and broadcast addresses and you get 62 usable hosts.',
  },
  {
    id: 'ns-04',
    skill: 'net-subnet',
    difficulty: 2,
    type: 'mc',
    prompt: 'What subnet mask is equivalent to /20?',
    choices: ['255.255.240.0', '255.255.255.240', '255.255.224.0', '255.240.0.0'],
    answer: '255.255.240.0',
    misconceptions: {
      "255.255.255.240": 'sub-mask-conversion',
      "255.255.224.0": 'sub-mask-conversion',
      "255.240.0.0": 'sub-mask-conversion',
    },
    explanation:
      '/20 = 8 + 8 + 4 bits. The first two octets are 255, and the third has its top four bits set: 11110000 = 240. So 255.255.240.0. 255.255.255.240 is /28, 255.255.224.0 is /19, and 255.240.0.0 is /12.',
  },
  {
    id: 'ns-05',
    skill: 'net-subnet',
    difficulty: 2,
    type: 'mc',
    prompt: 'Is 10.1.5.200 inside the network 10.1.4.0/23?',
    choices: [
      'Yes — 10.1.4.0/23 covers 10.1.4.0 to 10.1.5.255',
      'No — it only covers 10.1.4.0 to 10.1.4.255',
      'No — it only covers 10.1.4.0 to 10.1.4.127',
      'Yes — /23 covers all of 10.1.0.0 to 10.1.255.255',
    ],
    answer: 'Yes — 10.1.4.0/23 covers 10.1.4.0 to 10.1.5.255',
    misconceptions: {
      "No — it only covers 10.1.4.0 to 10.1.4.255": 'sub-octet-boundary',
    },
    explanation:
      'A /23 is two /24s joined together (512 addresses). The block starting at 10.1.4.0 spans 10.1.4.0 – 10.1.5.255, so 10.1.5.200 is inside. 10.1.4.0 – 10.1.4.255 would be a /24, and 10.1.0.0 – 10.1.255.255 would be a /16.',
  },
  {
    id: 'ns-06',
    skill: 'net-subnet',
    difficulty: 3,
    type: 'text',
    prompt: 'What is the broadcast address of 192.168.10.64/27?',
    accept: ['192.168.10.95'],
    misconceptions: {
      "192.168.10.255": 'sub-octet-boundary',
    },
    explanation:
      '/27 leaves 5 host bits, so blocks are 32 addresses: .0, .32, .64, .96 ... The .64 block runs from 192.168.10.64 (network) to 192.168.10.95 (broadcast), with usable hosts .65 – .94.',
  },
  {
    id: 'ns-07',
    skill: 'net-subnet',
    difficulty: 3,
    type: 'text',
    prompt: 'What is the network address of the host 10.0.0.77/28?',
    accept: ['10.0.0.64'],
    explanation:
      '/28 leaves 4 host bits, so blocks are 16 addresses: .0, .16, .32, .48, .64, .80 ... 77 falls in the .64 – .79 block, so the network address is 10.0.0.64 (broadcast 10.0.0.79).',
  },
  {
    id: 'ns-08',
    skill: 'net-subnet',
    difficulty: 3,
    type: 'mc',
    prompt: 'A firewall has this rule. Which source IP would it allow?',
    snippet: `allow  src=172.16.8.0/22  dst=any  dport=3389/tcp`,
    choices: ['172.16.11.200', '172.16.12.5', '172.16.7.254', '172.17.8.10'],
    answer: '172.16.11.200',
    misconceptions: {
      "172.16.12.5": 'sub-octet-boundary',
      "172.16.7.254": 'sub-octet-boundary',
    },
    explanation:
      '/22 means blocks of 4 in the third octet (4 × 256 = 1024 addresses). Starting at 8, the block is 172.16.8.0 – 172.16.11.255. 172.16.11.200 is inside; .12.5 is in the next block, .7.254 is in the previous one, and 172.17.x is a different network entirely.',
  },

  // ===================== Ports & common protocols =====================
  {
    id: 'np-01',
    skill: 'net-ports',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is the default port for SSH?',
    choices: ['22', '21', '23', '25'],
    answer: '22',
    explanation:
      'SSH (encrypted remote shell) uses TCP 22. Its neighbours are easy to mix up: 21 = FTP, 23 = Telnet (unencrypted remote shell), 25 = SMTP (email between servers).',
  },
  {
    id: 'np-02',
    skill: 'net-ports',
    difficulty: 1,
    type: 'text',
    prompt: 'What is the default TCP port for HTTPS?',
    accept: ['443', 'tcp 443', 'tcp/443', '443/tcp'],
    explanation:
      'HTTPS uses TCP 443 (plain HTTP uses 80). Because 443 is almost always allowed outbound, attackers like to hide command-and-control traffic in it too.',
  },
  {
    id: 'np-03',
    skill: 'net-ports',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which port does DNS use?',
    choices: ['53', '67', '80', '123'],
    answer: '53',
    explanation:
      'DNS uses port 53 — mostly UDP, and TCP for large answers and zone transfers. 67/68 are DHCP, 80 is HTTP, and 123 is NTP (time sync).',
  },
  {
    id: 'np-04',
    skill: 'net-ports',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which service normally listens on TCP 3389?',
    choices: [
      'Remote Desktop (RDP)',
      'SMB file sharing (CIFS)',
      'MySQL database',
      'Telnet remote shell',
    ],
    answer: 'Remote Desktop (RDP)',
    misconceptions: {
      'SMB file sharing (CIFS)': 'port-rdp-smb',
    },
    explanation:
      '3389 is RDP, and exposing it to the internet invites brute-force attacks. SMB is 445, MySQL is 3306 and Telnet is 23.',
  },
  {
    id: 'np-05',
    skill: 'net-ports',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which port does SMB (Windows file sharing) use when running directly over TCP?',
    choices: ['445', '3389', '1433', '8080'],
    answer: '445',
    misconceptions: {
      "3389": 'port-rdp-smb',
    },
    explanation:
      'Modern SMB runs directly on TCP 445 (older NetBIOS-based SMB used 139). Worms like WannaCry spread over 445, so internal hosts suddenly scanning 445 is a big warning sign. 3389 = RDP, 1433 = Microsoft SQL Server, 8080 = common alternate HTTP port.',
  },
  {
    id: 'np-06',
    skill: 'net-ports',
    difficulty: 2,
    type: 'mc',
    prompt: 'Your laptop connects to a web server on port 443. What will the source port on your laptop typically be?',
    choices: [
      'A random high (ephemeral) port',
      '443, the same as the server',
      '80, since HTTPS starts as HTTP',
      'A fixed port assigned by DHCP',
    ],
    answer: 'A random high (ephemeral) port',
    misconceptions: {
      '443, the same as the server': 'port-src-dst',
    },
    explanation:
      'The server listens on a well-known port (443); the client picks a temporary high port for its side, a new one for each connection. Windows uses 49152–65535 by default and Linux uses 32768–60999. So in logs, the low port usually tells you the service.',
  },
  {
    id: 'np-07',
    skill: 'net-ports',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these protocols send data in plaintext (unencrypted) by default? Select all that apply.',
    choices: ['FTP (21)', 'Telnet (23)', 'HTTP (80)', 'SSH (22)', 'HTTPS (443)'],
    answer: ['FTP (21)', 'Telnet (23)', 'HTTP (80)'],
    misconceptions: {
      "SSH (22)": 'port-plaintext',
      "HTTPS (443)": 'port-plaintext',
    },
    explanation:
      'FTP, Telnet and HTTP send everything — including passwords — in cleartext that anyone on the path can read. SSH and HTTPS encrypt the session.',
  },
  {
    id: 'np-08',
    skill: 'net-ports',
    difficulty: 3,
    type: 'mc',
    prompt: 'You run `netstat -ano` on a workstation. Which line most warrants investigation?',
    snippet: `Proto  Local Address       Foreign Address      State
TCP    10.0.5.21:49822     192.0.2.10:443       ESTABLISHED
TCP    10.0.5.21:51544     198.51.100.66:4444   ESTABLISHED
TCP    0.0.0.0:135         0.0.0.0:0            LISTENING`,
    choices: [
      'The connection to 198.51.100.66:4444',
      'The connection to 192.0.2.10:443',
      'Port 135 listening on all addresses',
      'None: every line here is normal',
    ],
    answer: 'The connection to 198.51.100.66:4444',
    explanation:
      'An established outbound connection to port 4444 on an external IP is suspicious: 4444 is the default for Metasploit reverse shells and is not a normal business service. Outbound 443 is ordinary web traffic, and TCP 135 (RPC endpoint mapper) listening is normal on Windows.',
  },

  // ===================== TCP handshake, flags & UDP =====================
  {
    id: 'nt-01',
    skill: 'net-tcp-udp',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is the correct order of the TCP three-way handshake?',
    choices: ['SYN → SYN-ACK → ACK', 'ACK → SYN → SYN-ACK', 'SYN → ACK → FIN', 'SYN-ACK → SYN → ACK'],
    answer: 'SYN → SYN-ACK → ACK',
    explanation:
      'The client sends SYN ("let\'s talk"), the server replies SYN-ACK ("ok, and let\'s talk back"), and the client answers ACK. Only then does data flow. FIN is used later to close a connection gracefully.',
  },
  {
    id: 'nt-02',
    skill: 'net-tcp-udp',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which transport protocol is connectionless, with no handshake and no delivery guarantee?',
    choices: ['UDP', 'TCP', 'SSH', 'HTTP'],
    answer: 'UDP',
    misconceptions: {
      "TCP": 'tcp-udp-handshake',
    },
    explanation:
      'UDP just sends datagrams — fast and simple, used by DNS queries, VoIP, streaming and NTP. TCP sets up a connection and retransmits lost data. SSH and HTTP are application protocols that run on top of TCP.',
  },
  {
    id: 'nt-03',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'text',
    prompt: 'Which TCP flag (abbreviation) immediately aborts a connection or rejects a connection attempt?',
    accept: ['RST', 'reset', 'rst flag', 'rst/ack', 'rst-ack'],
    explanation:
      'RST (reset) tears a connection down immediately or rejects a SYN to a closed port. FIN is the polite, graceful close; RST is the abrupt one.',
  },
  {
    id: 'nt-04',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'mc',
    prompt: 'A client sends a SYN to a closed TCP port on a host with no firewall in the way. What does it typically get back?',
    choices: ['An RST (reset)', 'A SYN-ACK', 'Nothing at all', 'A FIN'],
    answer: 'An RST (reset)',
    misconceptions: {
      "Nothing at all": 'tcp-closed-silent',
    },
    explanation:
      'A closed port answers with RST (usually RST-ACK). An open port answers SYN-ACK. Getting nothing back usually means a firewall silently dropped the packet — scanners call that "filtered".',
  },
  {
    id: 'nt-05',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'mc',
    prompt: 'In tcpdump output, what does `Flags [S.]` mean?',
    choices: ['SYN-ACK', 'SYN only', 'RST', 'FIN-ACK'],
    answer: 'SYN-ACK',
    explanation:
      'tcpdump abbreviates flags: S = SYN, F = FIN, R = RST, P = PSH, and "." = ACK. So [S] is a SYN, [S.] is SYN-ACK, [.] is a plain ACK, [R] is RST and [F.] is FIN-ACK.',
  },
  {
    id: 'nt-06',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does this tcpdump capture show?',
    snippet: `10:01:00.001 IP 198.51.100.23.40112 > 10.0.0.5.22: Flags [S]
10:01:00.002 IP 198.51.100.23.40112 > 10.0.0.5.23: Flags [S]
10:01:00.002 IP 198.51.100.23.40112 > 10.0.0.5.80: Flags [S]
10:01:00.003 IP 198.51.100.23.40112 > 10.0.0.5.443: Flags [S]
10:01:00.003 IP 198.51.100.23.40112 > 10.0.0.5.3389: Flags [S]`,
    choices: [
      'A SYN port scan of one host from one source',
      'Five normal web browsing sessions from one user',
      'A completed file transfer split across ports',
      'The server shutting down its services in order',
    ],
    answer: 'A SYN port scan of one host from one source',
    misconceptions: {
      'Five normal web browsing sessions from one user': 'tcp-half-open-normal',
    },
    explanation:
      'The same source sends bare SYNs ([S]) to 22, 23, 80, 443 and 3389 within milliseconds, never completing a handshake. That is a classic SYN ("half-open") scan looking for open services. Browsing would target 80/443 and complete handshakes; nothing here carries data.',
  },
  {
    id: 'nt-07',
    skill: 'net-tcp-udp',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which statements about UDP are true? Select all that apply.',
    choices: [
      'There is no handshake before data is sent',
      'Most DNS queries use it',
      'Delivery is not guaranteed',
      'It uses sequence numbers to reorder data',
      'Every conversation starts with a SYN',
    ],
    answer: ['There is no handshake before data is sent', 'Most DNS queries use it', 'Delivery is not guaranteed'],
    misconceptions: {
      "It uses sequence numbers to reorder data": 'tcp-udp-handshake',
      "Every conversation starts with a SYN": 'tcp-udp-handshake',
    },
    explanation:
      'UDP is connectionless: no handshake, no acknowledgements, no retransmission, and DNS queries normally ride on it. Sequence numbers and SYN are TCP features. Because there is no handshake, UDP source addresses are easy to spoof, which is why UDP is abused for reflection/amplification DDoS.',
  },
  {
    id: 'nt-08',
    skill: 'net-tcp-udp',
    difficulty: 3,
    type: 'mc',
    prompt: 'A web server becomes unresponsive. Its connection table shows the following. What is the most likely cause?',
    snippet: `State          Count   Distinct source IPs
SYN_RECV       48,210  31,877
ESTABLISHED    142     120
Final ACKs from clients in SYN_RECV: none`,
    choices: [
      'A SYN flood: masses of half-open connections',
      'Too many legitimate users are fully connected',
      'The server has lost its route to the internet',
      'A DNS misconfiguration is stalling the clients',
    ],
    answer: 'A SYN flood: masses of half-open connections',
    misconceptions: {
      'Too many legitimate users are fully connected': 'tcp-half-open-normal',
    },
    explanation:
      'SYN_RECV means the server sent SYN-ACK and is waiting for the final ACK that never comes. Tens of thousands of these from many (often spoofed) sources exhaust the connection backlog — a SYN flood denial of service. Only 142 connections are actually established, so it is not a crowd of real users. Defenses include SYN cookies and upstream DDoS protection.',
  },

  // ===================== DNS =====================
  {
    id: 'nd-01',
    skill: 'net-dns',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is the main job of DNS?',
    choices: [
      'Translating names like example.com into IP addresses',
      'Assigning IP addresses to devices when they join a network',
      'Encrypting web traffic between browsers and servers',
      'Blocking malicious websites before a browser reaches them',
    ],
    answer: 'Translating names like example.com into IP addresses',
    explanation:
      'DNS is the internet\'s phone book: names in, addresses out. Handing out IP addresses is DHCP, encrypting web traffic is TLS/HTTPS, and blocking sites is something security products can do using DNS but is not its core purpose.',
  },
  {
    id: 'nd-02',
    skill: 'net-dns',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which DNS record type maps a name to an IPv4 address?',
    choices: ['A', 'AAAA', 'MX', 'CNAME'],
    answer: 'A',
    explanation:
      'An A record holds an IPv4 address. AAAA holds an IPv6 address, MX names the mail servers for a domain, and CNAME is an alias pointing one name at another name.',
  },
  {
    id: 'nd-03',
    skill: 'net-dns',
    difficulty: 2,
    type: 'text',
    prompt: 'Which DNS record type lists the mail servers that accept email for a domain?',
    accept: ['MX', 'mx record', 'mail exchanger', 'mail exchange'],
    explanation:
      'MX (Mail eXchanger) records tell sending servers where to deliver mail for a domain, with a priority number. You will also meet TXT records in email security, which carry SPF and DMARC policies.',
  },
  {
    id: 'nd-04',
    skill: 'net-dns',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which record type is used for reverse DNS lookups (IP address → name)?',
    choices: ['PTR', 'A', 'NS', 'SOA'],
    answer: 'PTR',
    misconceptions: {
      "A": 'dns-a-ptr',
    },
    explanation:
      'PTR records live under in-addr.arpa (IPv4) and map an IP back to a name — handy when an alert only gives you an IP. A maps name → IPv4, NS names a zone\'s authoritative name servers, and SOA holds the zone\'s administrative info.',
  },
  {
    id: 'nd-05',
    skill: 'net-dns',
    difficulty: 2,
    type: 'mc',
    prompt: 'DNS normally uses UDP port 53. When does it switch to TCP port 53?',
    choices: [
      'For large responses and for zone transfers',
      'Whenever the query is for an HTTPS website',
      'Only when the DNS traffic is being encrypted',
      'Never: DNS only ever uses UDP port 53',
    ],
    answer: 'For large responses and for zone transfers',
    misconceptions: {
      'Never: DNS only ever uses UDP port 53': 'dns-udp-only',
    },
    explanation:
      'If an answer is too big, the server sets the "truncated" flag and the client retries over TCP; zone transfers (AXFR) also use TCP. The website\'s protocol does not matter. Encrypted DNS uses other ports (DNS over TLS is 853, DNS over HTTPS is 443).',
  },
  {
    id: 'nd-06',
    skill: 'net-dns',
    difficulty: 2,
    type: 'mc',
    prompt: 'A user reports a login page, and DNS logs show their laptop resolved the domain below. What should you suspect?',
    snippet: `query: micros0ft-login-secure.com  A  →  203.0.113.140`,
    choices: [
      'A look-alike (typosquatted) Microsoft phishing domain',
      'A normal Microsoft 365 login server in another region',
      'A DNS server outage returning a placeholder address',
      'A DHCP problem giving the laptop the wrong resolver',
    ],
    answer: 'A look-alike (typosquatted) Microsoft phishing domain',
    misconceptions: {
      'A normal Microsoft 365 login server in another region': 'dns-lookalike',
    },
    explanation:
      'The domain swaps the letter "o" for a zero and adds reassuring words like "login" and "secure" — typical of phishing sites built to harvest credentials. Real Microsoft logins use domains such as login.microsoftonline.com. The lookup itself succeeded, so it is not an outage or DHCP issue.',
  },
  {
    id: 'nd-07',
    skill: 'net-dns',
    difficulty: 3,
    type: 'mc',
    prompt: 'DNS logs from one workstation show hundreds of queries like these. What is the most likely explanation?',
    snippet: `query: 4a6f686e446f65.x9k2.badcdn.example  TXT
query: 3a50617373776f7264.x9k2.badcdn.example  TXT
query: 3a53756d6d657232.x9k2.badcdn.example  TXT`,
    choices: [
      'DNS tunnelling: data hidden in the subdomains',
      'Normal content delivery network (CDN) lookups',
      'The workstation\'s DNS cache being refreshed',
      'A misconfigured mail server checking SPF records',
    ],
    answer: 'DNS tunnelling: data hidden in the subdomains',
    explanation:
      'Long, random-looking, never-repeating labels under one domain — here hex that decodes to "JohnDoe:Password:Summer2" — plus lots of TXT queries is the signature of DNS tunneling/exfiltration or C2. DNS is often allowed everywhere, which is why attackers abuse it. Normal CDN names are short and repeat.',
  },
  {
    id: 'nd-08',
    skill: 'net-dns',
    difficulty: 3,
    type: 'mc',
    prompt: 'An attacker adds the line below to a PC\'s hosts file (C:\\Windows\\System32\\drivers\\etc\\hosts). What is the effect?',
    snippet: `203.0.113.9    www.mybank.example`,
    choices: [
      'That PC sends www.mybank.example traffic to 203.0.113.9',
      'Every computer on the network will be redirected to 203.0.113.9',
      'The bank\'s real website is taken offline for all users',
      'Nothing: modern browsers ignore the local hosts file',
    ],
    answer: 'That PC sends www.mybank.example traffic to 203.0.113.9',
    explanation:
      'The hosts file is checked before DNS, so this silently redirects the site on that one machine — to an attacker-controlled server. It only affects the local PC, does not touch the real site, and browsers do honour it. Unexpected hosts-file changes are a useful detection.',
  },

  // ===================== HTTP & HTTPS =====================
  {
    id: 'nh-01',
    skill: 'net-http',
    difficulty: 1,
    type: 'mc',
    prompt: 'What is the main difference between HTTP and HTTPS?',
    choices: [
      'HTTPS is HTTP inside TLS: encrypted, and the server is authenticated',
      'HTTPS is faster because it skips the TCP three-way handshake entirely',
      'HTTPS only works inside internal networks, not on the internet',
      'HTTPS guarantees that the website itself is not malicious',
    ],
    answer: 'HTTPS is HTTP inside TLS: encrypted, and the server is authenticated',
    misconceptions: {
      'HTTPS guarantees that the website itself is not malicious': 'http-https-safe',
    },
    explanation:
      'HTTPS wraps normal HTTP in TLS encryption. The padlock means the connection is private and the certificate matches the domain — not that the site is trustworthy. Phishing sites routinely use HTTPS, and TLS adds a handshake rather than skipping one.',
  },
  {
    id: 'nh-02',
    skill: 'net-http',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does HTTP status code 404 mean?',
    choices: [
      'Not Found',
      'Forbidden',
      'Server Error',
      'Moved Permanently',
    ],
    answer: 'Not Found',
    misconceptions: {
      'Forbidden': 'http-status-classes',
    },
    explanation:
      '404 = the requested resource does not exist. 403 = Forbidden (exists but you may not access it), 500 = Internal Server Error, 200 = OK. A burst of 404s from one IP often means someone is brute-forcing directory names.',
  },
  {
    id: 'nh-03',
    skill: 'net-http',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does the User-Agent header in an HTTP request tell the server?',
    choices: [
      'Which client software claims to be making the request',
      'The username and password of the person who is browsing',
      'The user\'s exact physical location from their GPS',
      'Which back-end server should handle the request',
    ],
    answer: 'Which client software claims to be making the request',
    explanation:
      'User-Agent identifies the client, e.g. a Chrome version or `curl/8.0` or `sqlmap`. It is set by the client, so it can be faked — but attack tools often leave their default, which makes it a useful clue. The Host header is the one that names the target site.',
  },
  {
    id: 'nh-04',
    skill: 'net-http',
    difficulty: 2,
    type: 'text',
    prompt: 'Which HTTP method is normally used to submit form data such as a username and password?',
    accept: ['POST'],
    explanation:
      'POST sends data in the request body. GET puts parameters in the URL, which ends up in logs, browser history and proxies — a bad place for credentials. Many POSTs to /login from one IP can indicate password guessing.',
  },
  {
    id: 'nh-05',
    skill: 'net-http',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which class of HTTP status codes indicates an error on the server side?',
    choices: ['5xx (e.g. 500, 503)', '4xx (e.g. 403, 404)', '3xx (e.g. 301, 302)', '2xx (e.g. 200)'],
    answer: '5xx (e.g. 500, 503)',
    misconceptions: {
      "4xx (e.g. 403, 404)": 'http-status-classes',
    },
    explanation:
      '5xx = the server failed (500 Internal Server Error, 503 Service Unavailable). 4xx = the client asked for something wrong or forbidden, 3xx = redirects, 2xx = success. A spike of 500s during an attack can mean injection payloads are breaking the application.',
  },
  {
    id: 'nh-06',
    skill: 'net-http',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does this web server access log line show?',
    snippet: `203.0.113.77 - - [25/Sep/2026:09:12:01 +0000] "GET /products.php?id=1'%20OR%20'1'='1 HTTP/1.1" 200 51230 "-" "sqlmap/1.7.2"`,
    choices: [
      'A SQL injection attempt made with sqlmap',
      'A customer browsing product number 1 in the shop',
      'A search engine crawler indexing the product pages',
      'A failed login to the admin page of the website',
    ],
    answer: 'A SQL injection attempt made with sqlmap',
    explanation:
      '`\' OR \'1\'=\'1` (URL-encoded with %20 for spaces) is a classic SQL injection payload, and the User-Agent is the sqlmap attack tool. The 200 response and unusually large size (51230 bytes) are worth checking — the query may have returned more data than it should.',
  },
  {
    id: 'nh-07',
    skill: 'net-http',
    difficulty: 3,
    type: 'mc',
    prompt: 'What is this request attempting?',
    snippet: `198.51.100.14 - - [25/Sep/2026:10:02:44 +0000] "GET /download?file=../../../../etc/passwd HTTP/1.1" 200 1843 "-" "curl/8.4.0"`,
    choices: [
      'Path traversal to read a file outside the web root',
      'Cross-site scripting (XSS) against other site visitors',
      'A normal file download from the site\'s download area',
      'A SYN flood aimed at the web server\'s download page',
    ],
    answer: 'Path traversal to read a file outside the web root',
    explanation:
      'Each `../` climbs one directory, trying to escape the download folder and read /etc/passwd. A 200 response with a size that fits a passwd file suggests it may have worked. XSS would inject script (like `<script>`), and a SYN flood is a network-layer attack, not an HTTP request.',
  },
  {
    id: 'nh-08',
    skill: 'net-http',
    difficulty: 3,
    type: 'multi',
    prompt: 'For a standard HTTPS connection, which of these are hidden from someone watching the network? Select all that apply.',
    choices: [
      'The URL path and query string',
      'Headers and cookies',
      'The page content',
      'The destination IP address',
      'The server name sent in the TLS SNI field (without Encrypted Client Hello)',
    ],
    answer: ['The URL path and query string', 'Headers and cookies', 'The page content'],
    misconceptions: {
      "The destination IP address": 'http-https-hides-all',
      "The server name sent in the TLS SNI field (without Encrypted Client Hello)": 'http-https-hides-all',
    },
    explanation:
      'TLS encrypts the whole HTTP message: path, query, headers, cookies and body. The destination IP must stay visible for routing, and the SNI (the hostname sent at the start of the TLS handshake) is visible unless Encrypted Client Hello is used. That is why defenders can still see which sites are visited, but not what was sent.',
  },

  // ===================== Firewall & connection logs =====================
  {
    id: 'nf-01',
    skill: 'net-fw-logs',
    difficulty: 1,
    type: 'mc',
    prompt: 'In a firewall log, what does action=deny (or drop) mean?',
    choices: [
      'The firewall blocked the traffic',
      'The traffic was allowed but logged',
      'The connection was encrypted',
      'The destination host was offline',
    ],
    answer: 'The firewall blocked the traffic',
    explanation:
      'deny/drop/block = the firewall stopped it (drop is silent; reject/deny may send back an RST or ICMP message). allow/accept = it passed. A deny tells you nothing about whether the destination host is up.',
  },
  {
    id: 'nf-02',
    skill: 'net-fw-logs',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does this firewall log line describe?',
    snippet: `2026-09-25T09:30:11Z action=allow proto=TCP src=10.1.2.33:52110 dst=10.1.9.20:445`,
    choices: [
      'Allowed SMB from one internal host to another',
      'A blocked RDP attempt from an internet attacker',
      'A DNS query from a workstation to an external server',
      'An internal host browsing a website over HTTPS',
    ],
    answer: 'Allowed SMB from one internal host to another',
    explanation:
      'Both addresses are private 10.x, the destination port 445 is SMB, and the action is allow. The source port 52110 is just the client\'s ephemeral port. RDP would be 3389, DNS 53, and web browsing 80/443.',
  },
  {
    id: 'nf-03',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'text',
    prompt: 'In the log line `src=10.0.0.8:61544 dst=198.51.100.9:53 proto=UDP action=allow`, which protocol/service is the host most likely using? (One word.)',
    accept: ['DNS'],
    explanation:
      'The destination port is 53 over UDP — DNS. The high source port is the client\'s ephemeral port. Note that the host is sending DNS directly to an external server; many organisations force DNS through internal resolvers, so this might break policy.',
  },
  {
    id: 'nf-04',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does this pattern of firewall logs indicate?',
    snippet: `action=deny proto=TCP src=198.51.100.20:43121 dst=203.0.113.10:22
action=deny proto=TCP src=198.51.100.20:43122 dst=203.0.113.11:22
action=deny proto=TCP src=198.51.100.20:43123 dst=203.0.113.12:22
... 240 more lines: same source, dst .13 through .253, port 22 ...`,
    choices: [
      'A horizontal scan: one source trying SSH across many hosts',
      'A vertical scan: one source probing many ports on one host',
      'A successful SSH brute-force login against several hosts',
      'Normal SSH administration by your IT team\'s jump server',
    ],
    answer: 'A horizontal scan: one source trying SSH across many hosts',
    misconceptions: {
      'A vertical scan: one source probing many ports on one host': 'fw-scan-direction',
    },
    explanation:
      'Same port, many destination hosts = horizontal scan (sweeping for any machine running SSH). A vertical scan would hit many ports on one host. Everything was denied, so nothing got in; typically you note it and possibly block the source, and check whether any host allowed it.',
  },
  {
    id: 'nf-05',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these firewall log findings deserve follow-up? Select all that apply.',
    choices: [
      'A workstation making outbound connections to TCP 4444 on an unknown external IP',
      'Allowed inbound RDP (3389) from the internet to a workstation',
      'One internal host connecting to port 445 on 200 other internal hosts within a minute',
      'Workstations sending DNS queries to the company\'s internal DNS servers',
      'A workstation making outbound HTTPS connections to a well-known update service during business hours',
    ],
    answer: [
      'A workstation making outbound connections to TCP 4444 on an unknown external IP',
      'Allowed inbound RDP (3389) from the internet to a workstation',
      'One internal host connecting to port 445 on 200 other internal hosts within a minute',
    ],
    misconceptions: {
      "Allowed inbound RDP (3389) from the internet to a workstation": 'fw-allowed-safe',
    },
    explanation:
      'Outbound 4444 is a common reverse-shell port; RDP exposed to the internet invites brute force and should not be reachable on a workstation; one host hitting SMB on hundreds of peers looks like worm spread or lateral movement. DNS to internal resolvers and business-hours HTTPS to update services are normal baseline traffic.',
  },
  {
    id: 'nf-06',
    skill: 'net-fw-logs',
    difficulty: 3,
    type: 'mc',
    prompt: 'What pattern do these allowed connections suggest?',
    snippet: `09:00:02 allow TCP 10.4.4.18:50112 -> 203.0.113.99:8443 bytes=312
09:05:02 allow TCP 10.4.4.18:50387 -> 203.0.113.99:8443 bytes=308
09:10:03 allow TCP 10.4.4.18:50641 -> 203.0.113.99:8443 bytes=315
09:15:02 allow TCP 10.4.4.18:50902 -> 203.0.113.99:8443 bytes=311`,
    choices: [
      'Likely C2 beaconing: small check-ins every 5 minutes',
      'A user streaming video from a site on port 8443',
      'A port scan against 203.0.113.99 from the workstation',
      'A large data exfiltration spread over several hours',
    ],
    answer: 'Likely C2 beaconing: small check-ins every 5 minutes',
    explanation:
      'Machine-like regularity (every 5 minutes, to the second), tiny similar sizes, and one unusual destination port are the hallmarks of malware beaconing to its C2 server. Streaming would move far more data, a scan would hit many ports or hosts, and ~300 bytes is not exfiltration. Next step: identify the process on 10.4.4.18 making these connections.',
  },
  {
    id: 'nf-07',
    skill: 'net-fw-logs',
    difficulty: 3,
    type: 'mc',
    prompt: 'What is the biggest concern with this connection summary?',
    snippet: `start=02:14  src=10.2.3.44:51234  dst=198.51.100.200:443  action=allow
duration=02:13:05  bytes_out=4.2 GB  bytes_in=1.1 MB`,
    choices: [
      'Possible exfiltration: 4.2 GB uploaded at night',
      'A normal software download to the workstation',
      'A failed connection attempt that kept retrying',
      'The workstation being scanned from the internet',
    ],
    answer: 'Possible exfiltration: 4.2 GB uploaded at night',
    misconceptions: {
      'A normal software download to the workstation': 'fw-transfer-direction',
    },
    explanation:
      'bytes_out (4.2 GB) vastly exceeds bytes_in (1.1 MB), so data is leaving, over two hours starting at 2:14 AM. Downloads would show large bytes_in instead, the connection clearly succeeded, and it was initiated from the inside (src is internal). Check who owns 198.51.100.200 and what process sent the data.',
  },

  // ===================== Misconception follow-ups (network) =====================
  {
    id: 'no-09',
    skill: 'net-osi',
    difficulty: 2,
    type: 'mc',
    prompt: 'A host receives an Ethernet frame carrying a web request. In which order are the headers removed (decapsulated) as the data moves up the stack?',
    choices: [
      'Ethernet (Layer 2) → IP (Layer 3) → TCP (Layer 4) → HTTP data',
      'TCP (Layer 4) → IP (Layer 3) → Ethernet (Layer 2) → HTTP data',
      'IP (Layer 3) → Ethernet (Layer 2) → TCP (Layer 4) → HTTP data',
      'HTTP → TCP → IP → Ethernet',
    ],
    answer: 'Ethernet (Layer 2) → IP (Layer 3) → TCP (Layer 4) → HTTP data',
    misconceptions: {
      'TCP (Layer 4) → IP (Layer 3) → Ethernet (Layer 2) → HTTP data': 'osi-encapsulation-order',
      'IP (Layer 3) → Ethernet (Layer 2) → TCP (Layer 4) → HTTP data': 'osi-encapsulation-order',
      'HTTP → TCP → IP → Ethernet': 'osi-encapsulation-order',
    },
    explanation:
      'The outermost wrapper is added last when sending, so it is removed first when receiving. The frame\'s Ethernet header comes off first, then the IP header (packet), then the TCP header (segment), leaving the HTTP data for the application. Sending goes the other way: segment → packet → frame.',
  },
  {
    id: 'ni-09',
    skill: 'net-ip',
    difficulty: 2,
    type: 'mc',
    prompt: 'A partner reports attack traffic from 198.51.100.25, which is your firewall\'s public address. Your workstations use 10.x.x.x addresses. How do you find the internal machine?',
    choices: [
      'Check the firewall\'s NAT logs for that time and source port',
      'Search internal logs for a workstation using 198.51.100.25',
      'Nothing: your hosts only use 10.x addresses, so it isn\'t you',
      'Ask the partner for the workstation\'s private IP from their logs',
    ],
    answer:
      'Check the firewall\'s NAT logs for that time and source port',
    misconceptions: {
      'Search internal logs for a workstation using 198.51.100.25': 'ip-nat',
      'Nothing: your hosts only use 10.x addresses, so it isn\'t you': 'ip-nat',
      'Ask the partner for the workstation\'s private IP from their logs': 'ip-nat',
    },
    explanation:
      'With NAT, every internal host shares the firewall\'s public address on the internet, so the partner can only ever see 198.51.100.25. No internal host has that address. The firewall keeps a translation table and logs mapping private address and port to public address and port. Match the time, destination and translated source port to find the real host.',
  },
  {
    id: 'ns-09',
    skill: 'net-subnet',
    difficulty: 2,
    type: 'text',
    prompt: 'What subnet mask (in dotted decimal) is equivalent to /27?',
    accept: ['255.255.255.224'],
    misconceptions: {
      '255.255.255.27': 'sub-mask-conversion',
      '255.255.255.240': 'sub-mask-conversion',
      '255.255.224.0': 'sub-mask-conversion',
      '255.255.255.192': 'sub-mask-conversion',
    },
    explanation:
      '/27 = 24 bits (three octets of 255) plus 3 more bits. Three bits in the last octet = 128 + 64 + 32 = 224, so the mask is 255.255.255.224. That gives 5 host bits: 32 addresses per subnet (30 usable). 255.255.255.240 would be /28 and 255.255.255.192 would be /26.',
  },
  {
    id: 'np-09',
    skill: 'net-ports',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which service is being used in this firewall log line, and which host is the client?',
    snippet: '2026-09-14 09:31:07 ALLOW TCP src=10.20.4.17:51544 dst=203.0.113.40:3389',
    choices: [
      'RDP on 203.0.113.40; 10.20.4.17 is the client',
      'A service on port 51544; 203.0.113.40 is the client',
      'RDP on 10.20.4.17, since the server is listed first',
      'Both hosts are servers; the ports show nothing',
    ],
    answer: 'RDP on 203.0.113.40; 10.20.4.17 is the client',
    misconceptions: {
      'A service on port 51544; 203.0.113.40 is the client': 'port-src-dst',
      'RDP on 10.20.4.17, since the server is listed first': 'port-src-dst',
    },
    explanation:
      'The destination port 3389 is the well-known RDP port, so the server is 203.0.113.40. The source port 51544 is a random ephemeral port picked by the client, 10.20.4.17. An internal workstation opening RDP to an outside host is itself worth asking about.',
  },
  {
    id: 'np-10',
    skill: 'net-ports',
    difficulty: 2,
    type: 'mc',
    prompt: 'A packet capture on the office network shows a user\'s password in readable clear text. Which protocol was most likely in use?',
    choices: ['Telnet (TCP 23)', 'SSH (TCP 22)', 'HTTPS (TCP 443)', 'SFTP (runs over SSH, TCP 22)'],
    answer: 'Telnet (TCP 23)',
    misconceptions: {
      'SSH (TCP 22)': 'port-plaintext',
      'HTTPS (TCP 443)': 'port-plaintext',
      'SFTP (runs over SSH, TCP 22)': 'port-plaintext',
    },
    explanation:
      'Telnet sends everything, including the login, in plaintext. So do FTP (21) and plain HTTP (80). SSH, SFTP and HTTPS encrypt the session, so a capture would only show ciphertext. Finding Telnet in use is a finding by itself: replace it with SSH.',
  },
  {
    id: 'nt-09',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'mc',
    prompt: 'This DNS lookup over UDP consists of only two packets. Where is the handshake?',
    snippet: '10:15:01.100 IP 10.0.0.8.53122 > 198.51.100.53.53: 41730+ A? www.example.com. (33)\n10:15:01.131 IP 198.51.100.53.53 > 10.0.0.8.53122: 41730 1/0/0 A 203.0.113.80 (49)',
    choices: [
      'There is none: UDP just sends the query and gets an answer',
      'It was earlier and not captured; UDP always starts with SYN, SYN-ACK, ACK',
      'The first packet is the SYN and the second is the SYN-ACK',
      'DNS only works over TCP, so this capture must be incomplete',
    ],
    answer: 'There is none: UDP just sends the query and gets an answer',
    misconceptions: {
      'It was earlier and not captured; UDP always starts with SYN, SYN-ACK, ACK': 'tcp-udp-handshake',
      'The first packet is the SYN and the second is the SYN-ACK': 'tcp-udp-handshake',
      'DNS only works over TCP, so this capture must be incomplete': 'dns-udp-only',
    },
    explanation:
      'UDP is connectionless: one datagram carries the query (A? www.example.com) and one carries the answer (A 203.0.113.80). There are no flags, sequence numbers or acknowledgements. That is why UDP is fast and why DNS normally uses it. The SYN / SYN-ACK / ACK handshake belongs to TCP.',
  },
  {
    id: 'nt-10',
    skill: 'net-tcp-udp',
    difficulty: 2,
    type: 'mc',
    prompt: 'A scanner probes two ports on 10.0.5.20. What does this capture tell it about ports 23 and 8080?',
    snippet: '14:02:11.401 IP 198.51.100.7.40011 > 10.0.5.20.23: Flags [S], seq 1001, win 1024\n14:02:11.402 IP 10.0.5.20.23 > 198.51.100.7.40011: Flags [R.], seq 0, ack 1002, win 0\n14:02:11.405 IP 198.51.100.7.40011 > 10.0.5.20.8080: Flags [S], seq 1001, win 1024\n(no reply to the 8080 probe)',
    choices: [
      '23 is closed (RST came back); 8080 is likely filtered (no reply)',
      '8080 is closed, because closed ports never reply; 23 is open',
      'Both are closed, because neither completed a handshake',
      'Both are open, since the host received both SYN packets',
    ],
    answer: '23 is closed (RST came back); 8080 is likely filtered (no reply)',
    misconceptions: {
      '8080 is closed, because closed ports never reply; 23 is open': 'tcp-closed-silent',
      'Both are closed, because neither completed a handshake': 'tcp-closed-silent',
    },
    explanation:
      'The host is reachable, and it answered the SYN to port 23 with RST-ACK ([R.]): nothing is listening there, so the port is closed. An open port would have answered SYN-ACK ([S.]). Silence usually means a firewall dropped the probe: filtered. Scanners such as nmap report exactly these three states.',
  },
  {
    id: 'nd-09',
    skill: 'net-dns',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which DNS record type did this lookup return?',
    snippet: '$ dig -x 203.0.113.9 +short\nmail.example.net.',
    choices: [
      'PTR: a reverse lookup from IP to name',
      'A: a forward lookup from name to IPv4',
      'MX: the mail server for example.net',
      'CNAME: an alias pointing to another name',
    ],
    answer: 'PTR: a reverse lookup from IP to name',
    misconceptions: {
      'A: a forward lookup from name to IPv4': 'dns-a-ptr',
    },
    explanation:
      '`dig -x` does a reverse lookup: it asks for the PTR record of 9.113.0.203.in-addr.arpa, which maps the address back to a name. An A record goes the other way (name → IPv4). The name containing "mail" does not make it an MX record; MX records are looked up by domain name.',
  },
  {
    id: 'nd-10',
    skill: 'net-dns',
    difficulty: 3,
    type: 'mc',
    prompt: 'An external IP pulled almost 2 MB from your internal DNS server over TCP 53 in one connection. What is the most likely explanation?',
    snippet: 'ALLOW TCP src=203.0.113.200:44120 dst=10.0.0.53:53 bytes_to_client=1,904,332 duration=3s',
    choices: [
      'A zone transfer (AXFR) of all your DNS records to an outsider',
      'Impossible: DNS never uses TCP, so this is another protocol',
      'A single normal DNS query for a popular website\'s address',
      'The DNS server downloading its own software updates',
    ],
    answer: 'A zone transfer (AXFR) of all your DNS records to an outsider',
    misconceptions: {
      'Impossible: DNS never uses TCP, so this is another protocol': 'dns-udp-only',
    },
    explanation:
      'DNS uses TCP 53 for large responses and for zone transfers. A normal query answer is a few hundred bytes. Nearly 2 MB sent to an outside client that connected to your server looks like an AXFR zone transfer, which gives an attacker a map of your internal names. Zone transfers should be allowed only to your own secondary DNS servers.',
  },
  {
    id: 'nd-11',
    skill: 'net-dns',
    difficulty: 2,
    type: 'mc',
    prompt: 'Two workstations made these DNS lookups. Which one is to a domain actually run by Microsoft?',
    snippet: '09:12:44 query A microsoft-365-login.security-check.example  from 10.1.8.23\n09:12:51 query A login.microsoftonline.com                    from 10.1.8.40',
    choices: [
      'Only login.microsoftonline.com',
      'Both, because both names contain "microsoft"',
      'Only the first, because it mentions Microsoft 365',
      'Neither, because Microsoft only uses microsoft.com',
    ],
    answer: 'Only login.microsoftonline.com',
    misconceptions: {
      'Both, because both names contain "microsoft"': 'dns-lookalike',
      'Only the first, because it mentions Microsoft 365': 'dns-lookalike',
    },
    explanation:
      'Read domains right to left: the registered domain is the label just before the top-level domain. login.microsoftonline.com belongs to microsoftonline.com, a real Microsoft sign-in domain. The other belongs to security-check.example; "microsoft-365-login" is just a subdomain its owner chose. Check what 10.1.8.23 did next.',
  },
  {
    id: 'nh-09',
    skill: 'net-http',
    difficulty: 1,
    type: 'mc',
    prompt: 'A user says a login page was safe because the browser showed a padlock (HTTPS). The domain was paypa1-account-verify.example. What does the padlock actually prove?',
    choices: [
      'Only that the connection is encrypted and the certificate fits the name',
      'That PayPal itself has checked and verified the website',
      'That the site was scanned by the browser and found free of any malware',
      'That the domain has been registered for many years',
    ],
    answer:
      'Only that the connection is encrypted and the certificate fits the name',
    misconceptions: {
      'That PayPal itself has checked and verified the website': 'http-https-safe',
      'That the site was scanned by the browser and found free of any malware': 'http-https-safe',
    },
    explanation:
      'Anyone can get a free, automatically issued certificate for a domain they control, and most phishing sites use HTTPS. The padlock proves encryption to paypa1-account-verify.example (with a digit 1 instead of the letter l). It says nothing about who runs the site. The domain is the red flag.',
  },
  {
    id: 'nh-10',
    skill: 'net-http',
    difficulty: 2,
    type: 'mc',
    prompt: 'Your web proxy logs HTTPS connections without decrypting them. Which detail can it still record?',
    choices: [
      'The destination IP and the TLS SNI server name',
      'The full URL, including the path and query string',
      'The username and password typed into the page',
      'Nothing at all, because HTTPS hides everything',
    ],
    answer: 'The destination IP and the TLS SNI server name',
    misconceptions: {
      'The full URL, including the path and query string': 'http-https-hides-all',
      'Nothing at all, because HTTPS hides everything': 'http-https-hides-all',
    },
    explanation:
      'TLS encrypts the HTTP request (path, query, headers, cookies, body). The IP and port are needed to route the traffic, and the client normally sends the server name in cleartext in the TLS ClientHello (SNI) unless Encrypted Client Hello is used. So a proxy can log which site was visited, but not which page or what was typed.',
  },
  {
    id: 'nf-08',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which of these firewall lines should worry you more?',
    snippet: 'action=allow  src=203.0.113.58:52211  dst=10.0.3.44:3389  proto=TCP  bytes=1.8MB  duration=47m\naction=deny   src=198.51.100.9:40322  dst=10.0.3.44:23    proto=TCP',
    choices: [
      'The allowed one: a 47-minute RDP session from the internet',
      'The denied one: a deny means an attack was caught in progress',
      'Neither: allowed traffic is safe and denied traffic was stopped',
      'Both are equally harmless internet background noise',
    ],
    answer: 'The allowed one: a 47-minute RDP session from the internet',
    misconceptions: {
      'The denied one: a deny means an attack was caught in progress': 'fw-allowed-safe',
      'Neither: allowed traffic is safe and denied traffic was stopped': 'fw-allowed-safe',
    },
    explanation:
      'The deny is internet background noise that was blocked, which is the firewall doing its job. The allow is a long, interactive RDP session from an external address to an internal machine. That should not be possible from the internet and could be an attacker at the keyboard. Check the host for 4624 logon type 10 events.',
  },
  {
    id: 'nf-09',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'What kind of scan do these firewall logs show?',
    snippet: 'deny TCP src=198.51.100.23 dst=10.0.8.15:21\ndeny TCP src=198.51.100.23 dst=10.0.8.15:22\ndeny TCP src=198.51.100.23 dst=10.0.8.15:23\ndeny TCP src=198.51.100.23 dst=10.0.8.15:25\ndeny TCP src=198.51.100.23 dst=10.0.8.15:80\n... (1,000 ports in 40 seconds)',
    choices: [
      'A vertical scan: one source probing many ports on one host',
      'A horizontal scan: one source probing one port on many hosts',
      'A DDoS attack from many sources against the same server',
      'Normal traffic that the firewall mislabelled as denied',
    ],
    answer: 'A vertical scan: one source probing many ports on one host',
    misconceptions: {
      'A horizontal scan: one source probing one port on many hosts': 'fw-scan-direction',
    },
    explanation:
      'The destination IP stays the same (10.0.8.15) while the destination port changes: 21, 22, 23, 25, 80 and so on. That is a vertical scan, mapping every service on one host. A horizontal scan keeps the port fixed and walks across many destination IPs. One source means it is not a DDoS.',
  },
  {
    id: 'nf-10',
    skill: 'net-fw-logs',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which description fits this connection summary?',
    snippet: 'src=10.0.6.31  dst=203.0.113.140:443  start=03:12  duration=38m  bytes_sent=4.2GB  bytes_received=11MB',
    choices: [
      'A 4.2 GB upload to an external host overnight',
      'A large download of software updates to the workstation',
      'An inbound attack from 203.0.113.140 against the workstation',
      'A normal short visit to a web page over HTTPS',
    ],
    answer: 'A 4.2 GB upload to an external host overnight',
    misconceptions: {
      'A large download of software updates to the workstation': 'fw-transfer-direction',
      'An inbound attack from 203.0.113.140 against the workstation': 'fw-transfer-direction',
    },
    explanation:
      'The internal host (src) opened the connection and sent 4.2 GB while receiving only 11 MB, so data flowed out. A software download is the reverse: small out, large in. A 38-minute, multi-gigabyte upload at 3 AM to an unfamiliar host is the classic exfiltration pattern. Find out what the destination is and which process made the connection.',
  },
];

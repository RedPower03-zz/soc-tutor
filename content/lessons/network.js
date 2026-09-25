// Network basics lessons. Format: see content/lessons/host.js.

export const NETWORK_LESSONS = [
  // ===================================================================== OSI
  {
    skill: 'net-osi',
    title: 'OSI & TCP/IP layers',
    goal: 'Place addresses, protocols and devices on the right layer, and understand encapsulation.',
    sections: [
      {
        id: 'layers',
        heading: 'Two models, same idea',
        body: [
          'The **OSI model** has 7 layers: 1 Physical, 2 Data Link, 3 Network, 4 Transport, 5 Session, 6 Presentation, 7 Application. The **TCP/IP model** used in practice has 4: Link, Internet, Transport, Application (which covers OSI 5–7).',
          'Analysts use layer numbers as shorthand: "a Layer 7 firewall" inspects application data, "a Layer 3 block" drops by IP.',
        ],
      },
      {
        id: 'what-where',
        heading: 'What lives where',
        body: ['The pairs to know cold:'],
        points: [
          '**Layer 2, Data Link:** MAC addresses, Ethernet frames, switches. Local network only.',
          '**Layer 3, Network:** IP addresses, packets, routers, ICMP. End to end across networks.',
          '**Layer 4, Transport:** TCP and UDP, ports.',
          '**Layer 7, Application:** HTTP, DNS, SMTP, SSH, SMB.',
        ],
      },
      {
        id: 'encapsulation',
        heading: 'Encapsulation',
        body: ['Going down the stack, each layer wraps the data from the layer above with its own header. Receiving reverses it: the outer wrapper comes off first.'],
        evidence: {
          label: 'Sending a web request',
          text: 'L7  HTTP data:            GET /login\nL4  + TCP header        = segment   (ports 50122 -> 443)\nL3  + IP header         = packet    (10.0.0.8 -> 203.0.113.10)\nL2  + Ethernet header   = frame     (MAC -> MAC of the router)\nL1  bits on the wire',
        },
      },
      {
        id: 'soc-view',
        heading: 'Why a SOC analyst cares',
        body: [
          'Each tool sees certain layers. A basic firewall rule looks at IPs and ports (L3/L4). A web proxy or WAF reads HTTP (L7). Switch and DHCP logs tie MAC addresses (L2) to IPs. Knowing the layer tells you which log can answer your question.',
        ],
      },
    ],
    worked: [
      {
        id: 'no-w1',
        title: 'Decoding a packet summary',
        artifactLabel: 'Packet capture (one packet)',
        artifact:
          'Ethernet II, Src: 3c:52:82:1a:2b:3c, Dst: 00:1a:2b:3c:4d:5e\nInternet Protocol Version 4, Src: 10.0.0.8, Dst: 203.0.113.10\nTransmission Control Protocol, Src Port: 50122, Dst Port: 80\nHypertext Transfer Protocol: GET /index.html HTTP/1.1',
        question: 'Which layer is each line, and what does the packet do?',
        steps: [
          'Ethernet II with MAC addresses is **Layer 2**, the frame. The destination MAC is the next hop (usually the router), not the web server.',
          'IPv4 with source and destination IPs is **Layer 3**, the packet: 10.0.0.8 (private) to 203.0.113.10 (external).',
          'TCP with ports is **Layer 4**, the segment: a random client port 50122 to port 80.',
          'HTTP GET is **Layer 7**, the application data the user actually asked for.',
        ],
        conclusion: 'An internal client requesting /index.html from an external web server over plain HTTP. Each layer is a header wrapped around the next.',
      },
    ],
    faded: [
      {
        id: 'no-f1',
        title: 'A DNS query',
        artifactLabel: 'Packet capture (one packet)',
        artifact: 'Ethernet II, Src: 3c:52:82:1a:2b:3c, Dst: 00:1a:2b:3c:4d:5e\nInternet Protocol Version 4, Src: 10.0.0.8, Dst: 198.51.100.53\nUser Datagram Protocol, Src Port: 53122, Dst Port: 53\nDomain Name System (query): A www.example.com',
        question: 'Label the layers.',
        given: ['Ethernet with MACs: Layer 2 (frame).', 'IPv4 with IP addresses: Layer 3 (packet).'],
        todo: [
          {
            prompt: 'Which OSI layer is the UDP header with the ports?',
            type: 'mc',
            choices: ['Layer 4, Transport', 'Layer 3, Network', 'Layer 7, Application'],
            answer: 'Layer 4, Transport',
            explanation: 'UDP (like TCP) is a transport-layer protocol that adds ports.',
          },
          {
            prompt: 'And the DNS query itself?',
            type: 'mc',
            choices: ['Layer 7, Application', 'Layer 4, Transport', 'Layer 2, Data Link'],
            answer: 'Layer 7, Application',
            explanation: 'DNS is an application-layer protocol carried inside UDP (or TCP) on port 53.',
          },
        ],
      },
    ],
  },

  // ===================================================================== IP
  {
    skill: 'net-ip',
    title: 'IP addressing & private ranges',
    goal: 'Tell internal from external addresses at a glance and understand NAT.',
    sections: [
      {
        id: 'ipv4',
        heading: 'IPv4 in one minute',
        body: ['An IPv4 address is **32 bits**, written as four octets (0–255) separated by dots, e.g. `192.168.10.44`. IPv6 addresses are 128 bits, written in hex (loopback is `::1`).'],
      },
      {
        id: 'private',
        heading: 'Private ranges (RFC 1918)',
        body: ['Only three ranges are private and never routed on the internet:'],
        points: ['`10.0.0.0/8`: 10.0.0.0–10.255.255.255', '`172.16.0.0/12`: 172.16.0.0–**172.31**.255.255 (172.32.x.x is public!)', '`192.168.0.0/16`: 192.168.0.0–192.168.255.255 (192.169.x.x is public)'],
      },
      {
        id: 'special',
        heading: 'Special addresses',
        body: ['Some addresses are neither normal public nor RFC 1918:'],
        points: [
          '`127.0.0.0/8` loopback (usually 127.0.0.1): the machine talking to itself.',
          '`169.254.0.0/16` link-local (APIPA): the host could not reach DHCP and assigned itself an address.',
          '`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`: reserved for documentation and examples, which is why this course uses them.',
        ],
      },
      {
        id: 'nat',
        heading: 'NAT',
        body: [
          'Private addresses can\'t travel the internet, so the edge router or firewall uses **NAT**: it rewrites the private source address (and often the source port) to its own public address, and translates replies back.',
          'Consequence for investigations: external logs show your public IP. To find the internal host, use the firewall\'s NAT/connection logs, matching time, destination and translated port.',
        ],
      },
    ],
    worked: [
      {
        id: 'ni-w1',
        title: 'Internal or external?',
        artifactLabel: 'Connection log',
        artifact: '#1  10.4.2.15      -> 172.40.8.9:443\n#2  10.4.2.15      -> 172.20.1.5:445\n#3  192.168.1.20   -> 192.169.4.4:80\n#4  169.254.10.3   -> 10.4.0.1:53',
        question: 'Which connections leave the internal network?',
        steps: [
          '#1: 172.40.8.9 is outside 172.16.0.0–172.31.255.255, so it is **public**. Traffic leaves the network.',
          '#2: 172.20.1.5 is inside 172.16.0.0/12, so it is **private**. Internal SMB traffic.',
          '#3: 192.169.4.4 is not 192.168.x.x, so it is **public**. One digit makes all the difference.',
          '#4: the source 169.254.10.3 is link-local, meaning that host has no DHCP lease. It is a troubleshooting clue, not an attack.',
        ],
        conclusion: '#1 and #3 go to the internet; #2 is internal; #4 points to a DHCP problem on one host.',
      },
    ],
    faded: [
      {
        id: 'ni-f1',
        title: 'Spot the public address',
        artifactLabel: 'Addresses seen in an alert',
        artifact: '10.250.3.7\n172.31.255.10\n192.168.100.2\n172.32.0.15',
        question: 'Which address is public?',
        given: ['10.250.3.7 is in 10.0.0.0/8, so private.', '192.168.100.2 is in 192.168.0.0/16, so private.'],
        todo: [
          {
            prompt: 'Which of the remaining two is public?',
            type: 'mc',
            choices: ['172.32.0.15', '172.31.255.10', 'Neither'],
            answer: '172.32.0.15',
            explanation: '172.16.0.0/12 ends at 172.31.255.255. 172.31.255.10 is the top of the private range; 172.32.0.15 is just past it and is public.',
          },
        ],
      },
    ],
  },

  // ===================================================================== subnetting
  {
    skill: 'net-subnet',
    title: 'Subnetting & CIDR',
    goal: 'Work out host counts, masks and address ranges in your head.',
    sections: [
      {
        id: 'cidr',
        heading: 'CIDR notation',
        body: [
          'In `192.168.1.0/24`, the **/24** says the first 24 bits are the network part. The remaining 32 − 24 = **8 bits** are for hosts. A bigger prefix means a smaller network.',
        ],
      },
      {
        id: 'hosts',
        heading: 'Counting addresses',
        body: ['Total addresses = 2^(host bits). Usable hosts = total − 2, because the first address is the network address and the last is the broadcast.'],
        evidence: { label: 'Quick table', text: '/24  8 host bits  256 total  254 usable\n/25  7 host bits  128 total  126 usable\n/26  6 host bits   64 total   62 usable\n/27  5 host bits   32 total   30 usable\n/28  4 host bits   16 total   14 usable' },
      },
      {
        id: 'masks',
        heading: 'Prefix to mask',
        body: ['Fill whole octets with 255, then convert the leftover bits. Leftover-bit values: 1=128, 2=192, 3=224, 4=240, 5=248, 6=252, 7=254, 8=255.'],
        evidence: { label: 'Examples', text: '/20 = 8+8+4  -> 255.255.240.0\n/23 = 8+8+7  -> 255.255.254.0\n/27 = 8+8+8+3 -> 255.255.255.224' },
      },
      {
        id: 'ranges',
        heading: 'Finding the range',
        body: [
          'Block size = 256 − the mask value in the "interesting" octet. Networks start at multiples of the block size. The broadcast is the next network minus one.',
          'Subnets don\'t have to end at an octet boundary: a /23 spans two third-octet values (10.1.4.0–10.1.5.255).',
        ],
      },
    ],
    worked: [
      {
        id: 'ns-w1',
        title: 'Range of 192.168.10.77/27',
        artifactLabel: 'Firewall object',
        artifact: 'object host SUSPECT = 192.168.10.77/27\nQ: which network is it in, and what are the first and last addresses?',
        question: 'What is the network, broadcast and usable range?',
        steps: [
          '/27 = 3 bits in the last octet, so the mask is 255.255.255.224.',
          'Block size = 256 − 224 = **32**. Networks start at .0, .32, .64, .96, ...',
          '77 falls between 64 and 95, so the network address is **192.168.10.64**.',
          'The next network starts at .96, so the broadcast is **192.168.10.95**.',
          'Usable hosts are .65 to .94, which is 30 addresses (32 − 2).',
        ],
        conclusion: '192.168.10.64/27: network .64, broadcast .95, hosts .65–.94.',
      },
    ],
    faded: [
      {
        id: 'ns-f1',
        title: 'Is it in the /23?',
        artifactLabel: 'Firewall rule',
        artifact: 'allow src 10.1.4.0/23 dst any port 443\nConnection seen from 10.1.5.200',
        question: 'Does the rule cover 10.1.5.200?',
        given: ['/23 = 8+8+7, so the mask is 255.255.254.0. The interesting octet is the third.', 'Block size in the third octet = 256 − 254 = 2, so networks start at 10.1.0.0, 10.1.2.0, 10.1.4.0, 10.1.6.0 ...'],
        todo: [
          {
            prompt: 'What is the last (broadcast) address of 10.1.4.0/23?',
            type: 'text',
            accept: ['10.1.5.255'],
            explanation: 'The next network is 10.1.6.0, so the broadcast is one less: 10.1.5.255.',
          },
          {
            prompt: 'So is 10.1.5.200 covered?',
            type: 'mc',
            choices: ['Yes', 'No'],
            answer: 'Yes',
            explanation: '10.1.4.0/23 runs from 10.1.4.0 to 10.1.5.255, so 10.1.5.200 is inside.',
          },
        ],
      },
    ],
  },

  // ===================================================================== ports
  {
    skill: 'net-ports',
    title: 'Ports & common protocols',
    goal: 'Recognise common services by port and read source vs destination correctly.',
    sections: [
      {
        id: 'ports',
        heading: 'What a port is',
        body: ['An IP address finds the machine; a **port** (0–65535) finds the service on it. TCP and UDP each have their own set. Ports below 1024 are "well-known" and reserved for standard services.'],
      },
      {
        id: 'common',
        heading: 'Ports to know',
        body: ['These show up in alerts every day:'],
        evidence: { label: 'Common ports', text: '21 FTP        22 SSH        23 Telnet     25 SMTP\n53 DNS        80 HTTP       443 HTTPS     445 SMB\n3389 RDP      1433 MS SQL   3306 MySQL    67/68 DHCP (UDP)\n123 NTP (UDP) 135 MS RPC    4444 common Metasploit default' },
      },
      {
        id: 'src-dst',
        heading: 'Source vs destination port',
        body: [
          'The server **listens** on the well-known port, so that is the **destination** port of the client\'s traffic. The client picks a random high **ephemeral** port as its **source** (49152–65535 on Windows; 32768–60999 by default on Linux).',
          'In replies, the ports swap places. The well-known side tells you the service; the high random side is the client.',
        ],
        evidence: { label: 'Reading a line', text: 'src=10.0.0.8:51544  dst=203.0.113.40:443\n    client ^ephemeral     server ^HTTPS' },
      },
      {
        id: 'plaintext',
        heading: 'Plaintext vs encrypted',
        body: ['Telnet (23), FTP (21) and HTTP (80) send credentials in the clear. SSH (22), SFTP and HTTPS (443) are encrypted. Unusual ports prove nothing by themselves, but 4444 or other odd high ports to the internet deserve a look.'],
      },
    ],
    worked: [
      {
        id: 'np-w1',
        title: 'netstat on a workstation',
        artifactLabel: 'netstat -ano',
        artifact: 'Proto  Local Address        Foreign Address       State        PID\nTCP    0.0.0.0:135          0.0.0.0:0             LISTENING    1012\nTCP    10.0.0.8:50512       192.0.2.10:443        ESTABLISHED  4420\nTCP    10.0.0.8:50533       198.51.100.66:4444    ESTABLISHED  6632',
        question: 'Which line needs investigating?',
        steps: [
          'Port 135 LISTENING is Microsoft RPC, which is normal on Windows.',
          '50512 → 192.0.2.10:443: the local side is an ephemeral port, the remote side is HTTPS. Ordinary browsing.',
          '50533 → 198.51.100.66:4444: the remote port 4444 is not a standard service and is the Metasploit default listener port.',
          'The PID (6632) tells you which process owns the connection; look it up next.',
        ],
        conclusion: 'The connection to port 4444 on an external IP is the one to chase: identify PID 6632 and its parent.',
      },
    ],
    faded: [
      {
        id: 'np-f1',
        title: 'Which side is the server?',
        artifactLabel: 'Firewall log',
        artifact: 'ALLOW TCP src=203.0.113.58:52211 dst=10.0.3.44:3389',
        question: 'Who is connecting to what?',
        given: ['52211 is a high, random-looking port, typical of a client\'s ephemeral source port.', '3389 is a well-known port.'],
        todo: [
          {
            prompt: 'Which service is being accessed?',
            type: 'mc',
            choices: ['RDP (Remote Desktop) on 10.0.3.44', 'SMB on 10.0.3.44', 'A service on port 52211 on 203.0.113.58'],
            answer: 'RDP (Remote Desktop) on 10.0.3.44',
            explanation: '3389 is RDP. The internal host 10.0.3.44 is the server, and the external host is connecting in. RDP open to the internet is risky.',
          },
        ],
      },
    ],
  },

  // ===================================================================== TCP/UDP
  {
    skill: 'net-tcp-udp',
    title: 'TCP handshake, flags & UDP',
    goal: 'Read TCP flags in captures and recognise scans and floods.',
    sections: [
      {
        id: 'handshake',
        heading: 'The three-way handshake',
        body: ['TCP sets up every connection first: client **SYN** → server **SYN-ACK** → client **ACK**. Then data flows, with sequence numbers and acknowledgements for reliable, ordered delivery.'],
        evidence: { label: 'tcpdump', text: '10.0.0.8.50122 > 203.0.113.10.443: Flags [S]    (SYN)\n203.0.113.10.443 > 10.0.0.8.50122: Flags [S.]   (SYN-ACK)\n10.0.0.8.50122 > 203.0.113.10.443: Flags [.]    (ACK)' },
      },
      {
        id: 'flags',
        heading: 'Flags and how tcpdump shows them',
        body: ['In tcpdump, a dot means ACK is set.'],
        points: ['`[S]` SYN: start a connection.', '`[S.]` SYN-ACK: "yes, let\'s talk".', '`[P.]` PSH-ACK: data.', '`[F.]` FIN-ACK: polite close.', '`[R]` / `[R.]` RST: abort, or "nothing listening here".'],
      },
      {
        id: 'udp',
        heading: 'UDP is different',
        body: ['**UDP** is connectionless: no handshake, no sequence numbers, no acknowledgements, no retransmission. Each datagram stands alone. DNS queries, DHCP, NTP and syslog normally use UDP.'],
      },
      {
        id: 'patterns',
        heading: 'Patterns: scans and floods',
        body: ['Whether the handshake completes is the tell:'],
        points: [
          'Open port: SYN → **SYN-ACK**. Closed port: SYN → **RST**. Filtered: SYN → **no reply** (firewall drop).',
          '**SYN scan:** one source sends SYNs to many ports and never completes handshakes.',
          '**SYN flood:** thousands of half-open connections (SYN_RECV) exhaust the server.',
        ],
      },
    ],
    worked: [
      {
        id: 'nt-w1',
        title: 'Reading a scan',
        artifactLabel: 'tcpdump',
        artifact: '12:00:01.001 IP 198.51.100.7.61000 > 10.0.5.20.21: Flags [S]\n12:00:01.001 IP 10.0.5.20.21 > 198.51.100.7.61000: Flags [R.]\n12:00:01.002 IP 198.51.100.7.61000 > 10.0.5.20.22: Flags [S]\n12:00:01.002 IP 10.0.5.20.22 > 198.51.100.7.61000: Flags [S.]\n12:00:01.003 IP 198.51.100.7.61000 > 10.0.5.20.22: Flags [R]\n12:00:01.003 IP 198.51.100.7.61000 > 10.0.5.20.23: Flags [S]',
        question: 'What is 198.51.100.7 doing, and what did it learn?',
        steps: [
          'One source sends SYNs to ports 21, 22, 23 in quick succession on one host: a scan pattern.',
          'Port 21 answered **RST**, so it is closed.',
          'Port 22 answered **SYN-ACK**, so it is open (SSH is listening).',
          'The scanner then sends RST instead of the final ACK. It never completes the handshake: a "half-open" SYN scan.',
        ],
        conclusion: 'A SYN port scan from 198.51.100.7. It found SSH open on 10.0.5.20; watch for login attempts next.',
      },
    ],
    faded: [
      {
        id: 'nt-f1',
        title: 'A server under pressure',
        artifactLabel: 'ss -tan state syn-recv | head',
        artifact: 'State      Local Address:Port   Peer Address:Port\nSYN-RECV   10.0.2.80:443        198.51.100.3:40001\nSYN-RECV   10.0.2.80:443        203.0.113.77:52113\nSYN-RECV   10.0.2.80:443        192.0.2.201:33020\n... 48,000 more SYN-RECV entries',
        question: 'Why is the web server unresponsive?',
        given: ['SYN-RECV means the server received a SYN and replied SYN-ACK, but never got the final ACK.', 'There are tens of thousands of these half-open entries, from many sources.'],
        todo: [
          {
            prompt: 'What is the most likely cause?',
            type: 'mc',
            choices: ['A SYN flood: half-open connections are filling the server\'s backlog', 'Too many legitimate users fully connected', 'A DNS failure'],
            answer: 'A SYN flood: half-open connections are filling the server\'s backlog',
            explanation: 'Legitimate users complete the handshake (ESTABLISHED). Masses of connections stuck in SYN-RECV is the SYN flood signature. SYN cookies and upstream filtering help.',
          },
        ],
      },
    ],
  },

  // ===================================================================== DNS
  {
    skill: 'net-dns',
    title: 'DNS',
    goal: 'Know the record types and spot DNS abuse: look-alikes, tunneling and hosts-file tricks.',
    sections: [
      {
        id: 'resolution',
        heading: 'How resolution works',
        body: [
          '**DNS** translates names to addresses (DHCP is the protocol that hands out addresses). A client asks its resolver, which asks root, TLD and authoritative servers and caches the answer.',
          'DNS uses **UDP 53** for most queries and **TCP 53** for large responses and zone transfers (AXFR).',
        ],
      },
      {
        id: 'records',
        heading: 'Record types',
        body: ['The records an analyst meets most:'],
        points: [
          '**A** name → IPv4. **AAAA** name → IPv6. **CNAME** alias to another name.',
          '**MX** mail servers for a domain. **NS** authoritative name servers. **TXT** free text (SPF, verification).',
          '**PTR** IP → name (reverse lookup), e.g. `9.113.0.203.in-addr.arpa` for 203.0.113.9.',
        ],
      },
      {
        id: 'abuse',
        heading: 'How attackers abuse DNS',
        body: ['DNS is allowed almost everywhere, which makes it attractive:'],
        points: [
          '**Look-alike domains:** read right to left; only the registered domain matters (`microsoft-login.security-check.example` belongs to security-check.example).',
          '**Tunneling:** data hidden in long, random subdomains, many queries to one domain.',
          '**Hosts file:** `C:\\Windows\\System32\\drivers\\etc\\hosts` or `/etc/hosts` overrides DNS on that one machine.',
        ],
      },
    ],
    worked: [
      {
        id: 'nd-w1',
        title: 'A look-alike login domain',
        artifactLabel: 'DNS resolver log',
        artifact: '08:41:12 client 10.1.8.23 query A login.microsoftonline.com\n08:41:57 client 10.1.8.23 query A microsoftonline.com-secure-signin.example\n08:41:58 answer A 203.0.113.99',
        question: 'Which lookup is suspicious and why?',
        steps: [
          'Read each name from the right. The first ends in `microsoftonline.com`, a real Microsoft sign-in domain.',
          'The second ends in `.example`; its registered domain is `com-secure-signin.example`. Everything to the left, including "microsoftonline.com", is just a subdomain its owner chose.',
          'Sign-in pages on look-alike domains are a classic credential-phishing setup.',
        ],
        conclusion: 'The second domain is a look-alike. Check proxy logs for what 10.1.8.23 submitted, and block the domain.',
      },
    ],
    faded: [
      {
        id: 'nd-f1',
        title: 'Strange subdomains',
        artifactLabel: 'DNS log (one workstation, 10 minutes)',
        artifact: 'query TXT 6f2a9c1e7b0d4a.data.cdn-sync.example\nquery TXT a91c77e0f3b2d8.data.cdn-sync.example\nquery TXT 0d4e5f6a7b8c9d.data.cdn-sync.example\n... 1,400 similar queries',
        question: 'What is happening?',
        given: ['Every query goes to the same domain: cdn-sync.example.', 'Each subdomain is a long, random-looking hex string that never repeats.'],
        todo: [
          {
            prompt: 'What is the most likely explanation?',
            type: 'mc',
            choices: ['DNS tunneling: data encoded in subdomains to sneak it out', 'Normal CDN caching', 'The DNS cache being refreshed'],
            answer: 'DNS tunneling: data encoded in subdomains to sneak it out',
            explanation: 'High volume, unique encoded labels to one domain (often TXT queries) is the tunneling signature. Find the process making the queries.',
          },
        ],
      },
    ],
  },

  // ===================================================================== HTTP
  {
    skill: 'net-http',
    title: 'HTTP & HTTPS basics',
    goal: 'Read web requests and server logs, and know what HTTPS does and doesn\'t hide.',
    sections: [
      {
        id: 'requests',
        heading: 'Requests and headers',
        body: ['A request has a **method** (GET to fetch, POST to submit data, PUT, DELETE), a path and headers. `User-Agent` names the client software and is freely set by the client, so tools like sqlmap or curl often reveal themselves there (or lie).'],
      },
      {
        id: 'status',
        heading: 'Status codes',
        body: ['The first digit tells you who is responsible:'],
        points: ['**2xx** success (200 OK).', '**3xx** redirect (301, 302).', '**4xx** client error: 401 needs login, 403 forbidden, 404 not found.', '**5xx** server error: 500 internal error, 503 unavailable.'],
      },
      {
        id: 'https',
        heading: 'What HTTPS does and doesn\'t do',
        body: [
          'HTTPS is HTTP inside **TLS**. It encrypts the path, query, headers, cookies and content, and the certificate proves you reached the named domain.',
          'It does **not** hide the destination IP, or the server name in the TLS SNI field (unless Encrypted Client Hello is used). And it does **not** mean the site is safe: phishing sites get free certificates too.',
        ],
      },
      {
        id: 'logs',
        heading: 'Reading access logs',
        body: ['A combined-format line: client IP, time, request line, status, size, referrer, user agent. Look for attack strings in the path and query.'],
        evidence: {
          label: 'access.log',
          text: '198.51.100.23 - - [14/Sep/2026:10:02:11 +0000] "GET /item.php?id=1%27%20OR%201%3D1-- HTTP/1.1" 500 312 "-" "sqlmap/1.7"\n203.0.113.9 - - [14/Sep/2026:10:05:40 +0000] "GET /download?file=../../../../etc/passwd HTTP/1.1" 200 1843 "-" "curl/8.4.0"',
        },
      },
    ],
    worked: [
      {
        id: 'nh-w1',
        title: 'SQL injection in a log',
        artifactLabel: 'Web access log',
        artifact: '198.51.100.23 - - [14/Sep/2026:10:02:09 +0000] "GET /item.php?id=1 HTTP/1.1" 200 5120 "-" "sqlmap/1.7"\n198.51.100.23 - - [14/Sep/2026:10:02:11 +0000] "GET /item.php?id=1%27%20OR%201%3D1-- HTTP/1.1" 500 312 "-" "sqlmap/1.7"',
        question: 'What is this client doing?',
        steps: [
          'URL-decode the second request: `%27` = \', `%20` = space, `%3D` = =. So `id=1\' OR 1=1--`.',
          '`\' OR 1=1--` is a textbook SQL injection test: it tries to break out of the query and make the condition always true.',
          'The User-Agent `sqlmap` is an automated SQL injection tool.',
          'The **500** response means the input broke the application\'s query, which suggests the parameter may be injectable.',
        ],
        conclusion: 'An automated SQL injection attempt against id. Check for successful responses with large sizes and alert the app owners.',
      },
    ],
    faded: [
      {
        id: 'nh-f1',
        title: 'A strange download request',
        artifactLabel: 'Web access log',
        artifact: '203.0.113.9 - - [14/Sep/2026:10:05:40 +0000] "GET /download?file=../../../../etc/passwd HTTP/1.1" 200 1843 "-" "curl/8.4.0"',
        question: 'What was attempted, and did it work?',
        given: ['`../` means "go up one directory". Repeating it climbs out of the web folder.', 'The target is `/etc/passwd`, a file every Linux system has.'],
        todo: [
          {
            prompt: 'What kind of attack is this?',
            type: 'mc',
            choices: ['Path (directory) traversal', 'Cross-site scripting (XSS)', 'SQL injection'],
            answer: 'Path (directory) traversal',
            explanation: 'Climbing out of the intended folder with ../ to read arbitrary files is path traversal.',
          },
          {
            prompt: 'The response code is 200 with 1,843 bytes. Did it likely succeed?',
            type: 'mc',
            choices: ['Yes: 200 OK with a file-sized body suggests /etc/passwd was returned', 'No: 200 means the request was blocked'],
            answer: 'Yes: 200 OK with a file-sized body suggests /etc/passwd was returned',
            explanation: 'A 200 with a body about the size of a passwd file suggests the server returned it. Treat the app as vulnerable and check what else was read.',
          },
        ],
      },
    ],
  },

  // ===================================================================== firewall logs
  {
    skill: 'net-fw-logs',
    title: 'Reading firewall & connection logs',
    goal: 'Read allow/deny lines and recognise scans, beaconing and exfiltration.',
    sections: [
      {
        id: 'fields',
        heading: 'Anatomy of a log line',
        body: ['Most firewalls log the same core fields: time, **action** (allow/deny/drop), protocol, **source IP:port**, **destination IP:port**, and often bytes and duration.'],
        evidence: { label: 'Firewall log', text: '2026-09-14T10:12:03 action=allow proto=TCP src=10.0.0.8:61544 dst=198.51.100.9:443 bytes_out=1.2KB bytes_in=48KB' },
      },
      {
        id: 'allow-deny',
        heading: 'Allowed isn\'t safe, denied isn\'t a breach',
        body: [
          'The firewall only enforces rules. **Denied** lines show attempts that were stopped, often internet background noise. **Allowed** lines are where real incidents happen: RDP open to the internet, C2 over 443, uploads to cloud storage.',
        ],
      },
      {
        id: 'scans',
        heading: 'Scans',
        body: ['Watch which field changes:'],
        points: ['**Horizontal scan:** same port, many destination hosts (e.g. port 22 across a /24).', '**Vertical scan:** many ports, one destination host.', 'Internal hosts scanning internal hosts (445 on hundreds of machines) can mean a worm or lateral movement.'],
      },
      {
        id: 'c2-exfil',
        heading: 'Beaconing and exfiltration',
        body: [
          '**Beaconing:** small connections to the same external host at regular intervals (e.g. every 300 s), day and night. Malware checking in with its controller.',
          '**Exfiltration:** large **outbound** transfers (bytes out ≫ bytes in), often off-hours or to unfamiliar hosts or cloud storage. A download is the reverse: small out, big in.',
        ],
      },
    ],
    worked: [
      {
        id: 'nf-w1',
        title: 'Regular check-ins',
        artifactLabel: 'Allowed connections from one workstation',
        artifact: '01:00:02 allow TCP 10.0.4.23:51201 -> 203.0.113.99:443  bytes_out=412 bytes_in=236\n01:05:02 allow TCP 10.0.4.23:51244 -> 203.0.113.99:443  bytes_out=409 bytes_in=236\n01:10:03 allow TCP 10.0.4.23:51290 -> 203.0.113.99:443  bytes_out=415 bytes_in=236\n01:15:02 allow TCP 10.0.4.23:51333 -> 203.0.113.99:443  bytes_out=411 bytes_in=236',
        question: 'What pattern is this?',
        steps: [
          'Same source, same destination, same port (443) every time.',
          'The timing is almost exactly every 5 minutes, at 1 AM when nobody is browsing.',
          'The sizes are tiny and nearly identical (≈410 bytes out, 236 in). No human browsing looks like that.',
          'Allowed + 443 does not make it safe; C2 often hides in HTTPS.',
        ],
        conclusion: 'Likely command-and-control beaconing. Identify the process on 10.0.4.23 making these connections and look up 203.0.113.99.',
      },
    ],
    faded: [
      {
        id: 'nf-f1',
        title: 'One port, many hosts',
        artifactLabel: 'Firewall denies',
        artifact: 'deny TCP src=198.51.100.23:40001 dst=10.0.8.1:22\ndeny TCP src=198.51.100.23:40002 dst=10.0.8.2:22\ndeny TCP src=198.51.100.23:40003 dst=10.0.8.3:22\n... through 10.0.8.254:22 in 30 seconds',
        question: 'What is the source doing?',
        given: ['The source IP stays the same: 198.51.100.23.', 'The destination port stays the same: 22 (SSH).'],
        todo: [
          {
            prompt: 'Which field changes, and what kind of scan does that make it?',
            type: 'mc',
            choices: [
              'The destination IP: a horizontal scan for SSH across the subnet',
              'The destination port: a vertical scan of one host',
              'Nothing changes: this is one long SSH session',
            ],
            answer: 'The destination IP: a horizontal scan for SSH across the subnet',
            explanation: 'Same port, walking through destination addresses .1 to .254, is a horizontal scan. All attempts were denied, which is good.',
          },
        ],
      },
    ],
  },
];

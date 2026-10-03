// Parameterised generators for the Level 1 network skills.
// Every answer is computed (subnetting) or looked up in a fact table below.
import { mc, ip } from './rng.js';
import { closeLen, fmt } from './util.js';

const PRIVATE_BASES = [
  [10, 0, 0, 0],
  [172, 16, 0, 0],
  [192, 168, 0, 0],
];

/** A random aligned private network for a prefix (kept inside RFC 1918 space). */
function randomNetwork(r, prefix) {
  const b = r.pick(PRIVATE_BASES);
  let n;
  if (b[0] === 10) n = ip.toInt(`10.${r.int(0, 255)}.${r.int(0, 255)}.${r.int(0, 255)}`);
  else if (b[0] === 172) n = ip.toInt(`172.${r.int(16, 31)}.${r.int(0, 255)}.${r.int(0, 255)}`);
  else n = ip.toInt(`192.168.${r.int(0, 255)}.${r.int(0, 255)}`);
  return (n & ip.mask(prefix)) >>> 0;
}

export function subnetFacts(prefix, addr) {
  const size = 2 ** (32 - prefix);
  const network = (addr & ip.mask(prefix)) >>> 0;
  const broadcast = (network + size - 1) >>> 0;
  return { size, usable: prefix >= 31 ? 0 : size - 2, network, broadcast, first: network + 1, last: broadcast - 1 };
}

export const dottedMask = (prefix) => ip.toStr(ip.mask(prefix));

const subnetHosts = {
  id: 'subnet-hosts',
  skill: 'net-subnet',
  count: 8,
  bloom: 'apply',
  make(r) {
    const prefix = r.cycle([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    const net = randomNetwork(r, prefix);
    const f = subnetFacts(prefix, net);
    const what = r.pick(['guest Wi-Fi VLAN', 'server VLAN', 'DMZ segment', 'VPN client pool', 'printer VLAN', 'lab network']);
    return {
      difficulty: prefix <= 22 ? 2 : 1,
      type: 'text',
      prompt: `The ${what} is **${ip.toStr(net)}/${prefix}**. How many usable host addresses does it have? (number)`,
      accept: [String(f.usable), fmt(f.usable)],
      misconceptions: { [String(f.size)]: 'sub-usable-count', [String(prefix)]: 'sub-prefix-is-hosts' },
      explanation: `/${prefix} leaves 32 − ${prefix} = ${32 - prefix} host bits, so 2^${32 - prefix} = ${fmt(f.size)} addresses. Two are reserved (the network address ${ip.toStr(f.network)} and the broadcast ${ip.toStr(f.broadcast)}), leaving **${fmt(f.usable)} usable hosts**.`,
    };
  },
};

const subnetNetBcast = {
  id: 'subnet-bounds',
  skill: 'net-subnet',
  count: 8,
  bloom: 'apply',
  make(r) {
    const prefix = r.cycle([19, 20, 21, 22, 23, 25, 26, 27, 28, 29]);
    const net = randomNetwork(r, prefix);
    const f = subnetFacts(prefix, net);
    const host = f.first + r.int(1, Math.max(1, f.usable - 2));
    const askNet = r.chance(0.5);
    const octet0 = ((host >>> 8) << 8) >>> 0; // "just zero the last octet"
    const answer = ip.toStr(askNet ? f.network : f.broadcast);
    const distractors = askNet
      ? [
          { text: ip.toStr(octet0), mis: 'sub-octet-boundary' },
          ip.toStr(f.broadcast),
          ip.toStr(f.first),
          ip.toStr((f.network + f.size) >>> 0),
          ip.toStr((f.network - f.size) >>> 0),
        ]
      : [
          { text: ip.toStr((octet0 + 255) >>> 0), mis: 'sub-octet-boundary' },
          ip.toStr(f.network),
          ip.toStr(f.last),
          ip.toStr((f.broadcast + 1) >>> 0),
          ip.toStr((f.broadcast + f.size) >>> 0),
        ];
    return {
      difficulty: prefix < 24 ? 3 : 2,
      ...mc(r, answer, distractors),
      prompt: `An alert names host **${ip.toStr(host)}/${prefix}**. What is the **${askNet ? 'network' : 'broadcast'} address** of its subnet?`,
      explanation: `/${prefix} means blocks of ${fmt(f.size)} addresses (mask ${dottedMask(prefix)}). ${ip.toStr(host)} falls in the block **${ip.toStr(f.network)} – ${ip.toStr(f.broadcast)}**, so the network address is ${ip.toStr(f.network)} and the broadcast is ${ip.toStr(f.broadcast)}.${prefix % 8 ? ' The boundary is not on an octet, so simply zeroing (or maxing) the last octet gives the wrong answer.' : ''}`,
    };
  },
};

const subnetSame = {
  id: 'subnet-same',
  skill: 'net-subnet',
  count: 6,
  bloom: 'analyze',
  make(r) {
    const prefix = r.cycle([25, 26, 27, 28, 21, 22, 23]);
    const net = randomNetwork(r, prefix);
    const f = subnetFacts(prefix, net);
    const pickIn = () => f.first + r.int(0, f.usable - 1);
    const host = pickIn();
    let peer = pickIn();
    while (peer === host) peer = pickIn();
    const next = subnetFacts(prefix, (f.broadcast + 1) >>> 0);
    const prev = subnetFacts(prefix, (f.network - 1) >>> 0);
    const distractors = [
      ip.toStr(next.first + r.int(0, Math.min(5, next.usable - 1))),
      ip.toStr(prev.last - r.int(0, Math.min(5, prev.usable - 1))),
      ip.toStr((f.broadcast + 1) >>> 0),
      ip.toStr(f.broadcast),
    ];
    if (prefix > 24) {
      const same24 = ((host >>> 8) << 8) >>> 0;
      for (let k = 0; k < 256; k += f.size) {
        const cand = same24 + k + 1 + r.int(0, Math.max(0, f.usable - 1));
        if (((cand & ip.mask(prefix)) >>> 0) !== f.network) {
          distractors.unshift({ text: ip.toStr(cand), mis: 'sub-octet-boundary' });
          break;
        }
      }
    }
    return {
      difficulty: prefix > 24 ? 2 : 3,
      ...mc(r, ip.toStr(peer), distractors),
      prompt: `Host **${ip.toStr(host)}/${prefix}** talks directly (no router) only to hosts in its own subnet. Which address is a **usable host in the same subnet**?`,
      explanation: `The subnet of ${ip.toStr(host)}/${prefix} runs from ${ip.toStr(f.network)} to ${ip.toStr(f.broadcast)} (blocks of ${fmt(f.size)}), so usable hosts are ${ip.toStr(f.first)} – ${ip.toStr(f.last)}. Only **${ip.toStr(peer)}** is inside that range; the broadcast address is not a usable host, and neighbours across the block boundary need a router.`,
    };
  },
};

const subnetMask = {
  id: 'subnet-mask',
  skill: 'net-subnet',
  count: 6,
  bloom: 'apply',
  make(r) {
    const prefix = r.cycle([17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30]);
    const mask = dottedMask(prefix);
    if (r.chance(0.5)) {
      return {
        difficulty: 1,
        type: 'text',
        prompt: `A firewall object uses the prefix **/${prefix}**. Write it as a dotted-decimal subnet mask.`,
        accept: [mask],
        explanation: `/${prefix} means the first ${prefix} bits are 1s: ${Math.floor(prefix / 8)} full octet(s) of 255${prefix % 8 ? ` and ${prefix % 8} more bit(s) in the next octet (${256 - 2 ** (8 - (prefix % 8))})` : ''}, giving **${mask}**.`,
      };
    }
    return {
      difficulty: 1,
      type: 'text',
      prompt: `A legacy router config shows the mask **${mask}**. What is that in CIDR notation? (e.g. /24)`,
      accept: [`/${prefix}`, String(prefix)],
      explanation: `Count the 1 bits: ${mask.split('.').map((o) => `${o} = ${Number(o).toString(2).split('').filter((b) => b === '1').length}`).join(', ')}. The total is **/${prefix}**.`,
    };
  },
};

const subnetFit = {
  id: 'subnet-fit',
  skill: 'net-subnet',
  count: 5,
  bloom: 'apply',
  make(r) {
    const need = r.cycle([12, 20, 29, 30, 31, 50, 60, 62, 63, 100, 120, 126, 127, 200, 250, 254, 255, 400, 500, 510, 900, 1000, 1500]);
    let prefix = 30;
    while (2 ** (32 - prefix) - 2 < need) prefix -= 1;
    const usable = 2 ** (32 - prefix) - 2;
    return {
      difficulty: 2,
      type: 'text',
      prompt: `A new segment must hold **${fmt(need)} hosts**. What is the **smallest** subnet (longest prefix) that fits? (e.g. /24)`,
      accept: [`/${prefix}`, String(prefix)],
      misconceptions: { [`/${prefix + 1}`]: 'sub-usable-count', [String(prefix + 1)]: 'sub-usable-count' },
      explanation: `Usable hosts are 2^(host bits) − 2. /${prefix + 1} gives ${fmt(2 ** (31 - prefix) - 2)} usable, which is too few for ${fmt(need)}; **/${prefix}** gives ${fmt(usable)}. Forgetting the two reserved addresses is the classic mistake near a power of two.`,
    };
  },
};

// ---------------------------------------------------------------- IP address classes

const IP_CLASSES = {
  rfc1918: 'Private (RFC 1918)',
  cgnat: 'Carrier-grade NAT (100.64/10)',
  apipa: 'Link-local / APIPA (169.254/16)',
  loop: 'Loopback (127/8)',
  doc: 'Documentation (RFC 5737)',
  mcast: 'Multicast (224/4)',
};

export function classifyIp(s) {
  const [a, b, c] = s.split('.').map(Number);
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'rfc1918';
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
  if (a === 169 && b === 254) return 'apipa';
  if (a === 127) return 'loop';
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return 'doc';
  if (a >= 224 && a <= 239) return 'mcast';
  return 'other';
}

function randomIn(r, cls) {
  const o = () => r.int(1, 254);
  switch (cls) {
    case 'rfc1918': return r.pick([`10.${r.int(0, 255)}.${o()}.${o()}`, `172.${r.int(16, 31)}.${o()}.${o()}`, `192.168.${r.int(0, 255)}.${o()}`]);
    case 'cgnat': return `100.${r.int(64, 127)}.${o()}.${o()}`;
    case 'apipa': return `169.254.${r.int(1, 254)}.${o()}`;
    case 'loop': return `127.${r.int(0, 255)}.${o()}.${o()}`;
    case 'doc': return r.pick([`192.0.2.${o()}`, `198.51.100.${o()}`, `203.0.113.${o()}`]);
    default: return `${r.int(224, 239)}.${r.int(0, 255)}.${o()}.${o()}`;
  }
}

const ipClass = {
  id: 'ip-class',
  skill: 'net-ip',
  count: 12,
  bloom: 'understand',
  make(r) {
    const cls = r.cycle(Object.keys(IP_CLASSES));
    const addr = randomIn(r, cls);
    const answer = IP_CLASSES[cls];
    const pool = Object.entries(IP_CLASSES).filter(([k]) => k !== cls);
    const distractors = r.shuffle(pool).map(([k, v]) => ({
      text: v,
      mis: cls === 'cgnat' && k === 'rfc1918' ? 'ip-private-ranges' : cls === 'apipa' && k === 'rfc1918' ? 'ip-apipa' : undefined,
    }));
    const why = {
      rfc1918: 'RFC 1918 reserves 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31) and 192.168.0.0/16 for private networks; they are never routed on the internet.',
      cgnat: '100.64.0.0/10 (100.64–100.127) is shared address space for ISP carrier-grade NAT (RFC 6598). It is not RFC 1918, but it is not publicly routable either.',
      apipa: '169.254.0.0/16 is link-local: Windows self-assigns it (APIPA) when DHCP fails, so it usually signals a DHCP problem, not an attacker.',
      loop: '127.0.0.0/8 is loopback: traffic never leaves the host. A service bound to 127.x is only reachable locally.',
      doc: '192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 are reserved for documentation and examples (RFC 5737) and should never appear in real traffic.',
      mcast: '224.0.0.0/4 (224–239) is multicast: one sender, many subscribed receivers (e.g. 224.0.0.251 for mDNS).',
    }[cls];
    return {
      difficulty: cls === 'cgnat' || cls === 'doc' ? 2 : 1,
      ...mc(r, answer, distractors),
      prompt: `A log shows the address **${addr}**. Which range does it belong to?`,
      explanation: `${addr} → **${answer}**. ${why}`,
    };
  },
};

const ipPrivatePick = {
  id: 'ip-private',
  skill: 'net-ip',
  count: 10,
  bloom: 'understand',
  make(r) {
    const o = () => r.int(1, 254);
    const answer = randomIn(r, 'rfc1918');
    const traps = [
      // near misses just outside RFC 1918 (allow-listed teaching examples in tests/lessons.test.js)
      { text: r.pick(['172.32.0.15', '172.40.8.9', '172.32.1.1']), mis: 'ip-private-ranges' },
      { text: `100.${r.int(64, 127)}.${o()}.${o()}`, mis: 'ip-private-ranges' },
      { text: r.pick(['192.169.4.4', '192.169.1.10']), mis: 'ip-private-ranges' },
      { text: `169.254.${o()}.${o()}`, mis: 'ip-apipa' },
      '11.0.0.5',
    ];
    return {
      difficulty: 2,
      ...mc(r, answer, r.shuffle(traps)),
      prompt: 'Which of these addresses is an **RFC 1918 private** address?',
      explanation: `Only **${answer}** is RFC 1918 (10/8, 172.16–172.31, 192.168/16). Near-misses such as 172.32.x, 172.40.x, 192.169.x or 11.x are ordinary public space, 100.64–100.127 is carrier-grade NAT (RFC 6598) and 169.254.x is link-local/APIPA: not routable, but not RFC 1918.`,
    };
  },
};

// ---------------------------------------------------------------- ports

// [port, transport, service] - default IANA / vendor assignments.
export const PORTS = [
  [21, 'TCP', 'FTP (control)'], [22, 'TCP', 'SSH'], [23, 'TCP', 'Telnet'], [25, 'TCP', 'SMTP'],
  [53, 'UDP', 'DNS'], [67, 'UDP', 'DHCP (server)'], [69, 'UDP', 'TFTP'], [80, 'TCP', 'HTTP'],
  [88, 'TCP', 'Kerberos'], [110, 'TCP', 'POP3'], [123, 'UDP', 'NTP'], [135, 'TCP', 'MS RPC endpoint mapper'],
  [139, 'TCP', 'NetBIOS session'], [143, 'TCP', 'IMAP'], [161, 'UDP', 'SNMP'], [389, 'TCP', 'LDAP'],
  [443, 'TCP', 'HTTPS'], [445, 'TCP', 'SMB'], [514, 'UDP', 'Syslog'], [587, 'TCP', 'SMTP submission'],
  [636, 'TCP', 'LDAPS'], [993, 'TCP', 'IMAPS'], [995, 'TCP', 'POP3S'], [1433, 'TCP', 'Microsoft SQL Server'],
  [3306, 'TCP', 'MySQL'], [3389, 'TCP', 'RDP'], [5432, 'TCP', 'PostgreSQL'], [5985, 'TCP', 'WinRM (HTTP)'],
  [5986, 'TCP', 'WinRM (HTTPS)'], [3268, 'TCP', 'LDAP Global Catalog'], [1812, 'UDP', 'RADIUS'], [6379, 'TCP', 'Redis'],
];

const portToService = {
  id: 'port-service',
  skill: 'net-ports',
  count: 14,
  bloom: 'remember',
  make(r) {
    const [port, proto, svc] = r.cycle(PORTS);
    const others = PORTS.filter((p) => p[0] !== port);
    const pool = others.map((p) => p[2]);
    const distractors = closeLen(r, svc, pool, 5).map((t) => ({
      text: t,
      mis: (port === 3389 && t === 'SMB') || (port === 445 && t === 'RDP') ? 'port-rdp-smb' : undefined,
    }));
    if (port === 3389) distractors.unshift({ text: 'SMB', mis: 'port-rdp-smb' });
    if (port === 445) distractors.unshift({ text: 'RDP', mis: 'port-rdp-smb' });
    const src = `10.${r.int(0, 40)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const dst = `10.${r.int(41, 90)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const sport = r.int(49152, 65535);
    return {
      difficulty: [21, 22, 23, 25, 53, 80, 443, 445, 3389].includes(port) ? 1 : 2,
      ...mc(r, svc, distractors),
      prompt: 'Which service normally listens on the destination port in this firewall log line?',
      snippet: `action=allow proto=${proto} src=${src}:${sport} dst=${dst}:${port}`,
      explanation: `The destination port (${port}/${proto.toLowerCase()}) identifies the service; the high source port ${sport} is just the client's ephemeral port. ${port}/${proto.toLowerCase()} is the default for **${svc}**.`,
    };
  },
};

const serviceToPort = {
  id: 'service-port',
  skill: 'net-ports',
  count: 8,
  bloom: 'remember',
  make(r) {
    const [port, proto, svc] = r.cycle(PORTS);
    const confuse = { RDP: 445, SMB: 3389 }[svc];
    return {
      difficulty: [22, 53, 80, 443, 445, 3389].includes(port) ? 1 : 2,
      type: 'text',
      prompt: `What is the default ${proto} port for **${svc}**? (number)`,
      accept: [String(port)],
      ...(confuse ? { misconceptions: { [String(confuse)]: 'port-rdp-smb' } } : {}),
      explanation: `${svc} uses **${port}/${proto.toLowerCase()}** by default. Services can be moved to other ports, so a port is a strong hint, not proof, of what is really running: check the payload or banner when it matters.`,
    };
  },
};

// ---------------------------------------------------------------- TCP / UDP

const SCAN = [
  { scan: 'TCP SYN scan', probe: 'SYN', reply: 'SYN/ACK', state: 'open', why: 'a SYN/ACK means a service accepted the handshake' },
  { scan: 'TCP SYN scan', probe: 'SYN', reply: 'RST/ACK', state: 'closed', why: 'the host is up and answered with a reset, but nothing listens on that port' },
  { scan: 'TCP SYN scan', probe: 'SYN', reply: 'no reply (after a retransmission)', state: 'filtered', why: 'silence usually means a firewall dropped the probe' },
  { scan: 'TCP SYN scan', probe: 'SYN', reply: 'ICMP type 3 code 13 (admin prohibited)', state: 'filtered', why: 'an ICMP unreachable from a filtering device means the probe was blocked' },
  { scan: 'UDP scan', probe: 'UDP datagram', reply: 'ICMP type 3 code 3 (port unreachable)', state: 'closed', why: 'port unreachable is how a host says nothing listens on a UDP port' },
  { scan: 'UDP scan', probe: 'UDP datagram', reply: 'a UDP response from the service', state: 'open', why: 'the service itself answered' },
  { scan: 'UDP scan', probe: 'UDP datagram', reply: 'no reply (after retries)', state: 'open|filtered', why: 'UDP services often ignore empty probes and firewalls drop silently, so nmap cannot tell which' },
  { scan: 'TCP connect scan', probe: 'full three-way handshake', reply: 'handshake completes then the scanner RSTs', state: 'open', why: 'a completed handshake means a listener accepted the connection' },
  { scan: 'TCP connect scan', probe: 'full three-way handshake', reply: 'RST on the first SYN', state: 'closed', why: 'an immediate RST means the host refused the connection' },
  { scan: 'TCP ACK scan', probe: 'ACK', reply: 'RST', state: 'unfiltered', why: 'a RST to a lone ACK means a host is reachable and not filtered for that probe' },
  { scan: 'TCP ACK scan', probe: 'ACK', reply: 'no reply', state: 'filtered', why: 'silence to an ACK usually means a stateful firewall dropped the unexpected segment' },
  { scan: 'TCP NULL scan', probe: 'a packet with no flags', reply: 'RST', state: 'closed', why: 'RFC 793 says a closed port RSTs a NULL packet; open ports stay silent on many stacks' },
];
const STATES = ['open', 'closed', 'filtered', 'open|filtered', 'unfiltered'];

const scanState = {
  id: 'scan-state',
  skill: 'net-tcp-udp',
  count: 12,
  bloom: 'analyze',
  make(r) {
    const s = r.cycle(SCAN);
    const port = r.pick(s.scan.startsWith('UDP') ? [53, 123, 161, 500, 1900] : [22, 80, 443, 445, 3389, 8080]);
    const target = `192.168.${r.int(0, 255)}.${r.int(2, 254)}`;
    const distractors = STATES.filter((x) => x !== s.state).map((x) => ({
      text: x,
      mis: (s.state === 'closed' && x === 'filtered') || (s.state === 'filtered' && x === 'closed') ? 'tcp-closed-silent' : undefined,
    }));
    return {
      difficulty: s.scan.startsWith('UDP') ? 3 : 2,
      ...mc(r, s.state, r.shuffle(distractors)),
      prompt: `During an authorised ${s.scan}, nmap sends a ${s.probe} to ${target}:${port} and gets back **${s.reply}**. Which port state does nmap report?`,
      explanation: `**${s.state}**: ${s.why}. Remember the pattern: closed TCP ports answer with RST and closed UDP ports with ICMP port unreachable; *silence* (or an admin-prohibited ICMP) points to filtering.`,
    };
  },
};

const FLAGS = [
  ['[S]', 'SYN: a client opening a connection'],
  ['[S.]', 'SYN/ACK: a server accepting a connection'],
  ['[.]', 'ACK only: acknowledging received data'],
  ['[P.]', 'PSH/ACK: data pushed to the application'],
  ['[F.]', 'FIN/ACK: one side closing gracefully'],
  ['[R.]', 'RST/ACK: connection refused or reset'],
];

const tcpFlags = {
  id: 'tcp-flags',
  skill: 'net-tcp-udp',
  count: 10,
  bloom: 'understand',
  make(r) {
    const [flag, meaning] = r.cycle(FLAGS);
    const a = `10.${r.int(0, 50)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const b = `10.${r.int(51, 99)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const port = r.pick([22, 80, 443, 445, 8443]);
    const cport = r.int(49152, 65535);
    const fromServer = flag === '[S.]' || flag === '[R.]';
    const line = fromServer
      ? `12:04:0${r.int(0, 9)}.${r.int(100000, 999999)} IP ${b}.${port} > ${a}.${cport}: Flags ${flag}, seq ${r.int(1000, 99999)}, win 65160`
      : `12:04:0${r.int(0, 9)}.${r.int(100000, 999999)} IP ${a}.${cport} > ${b}.${port}: Flags ${flag}, seq ${r.int(1000, 99999)}, win 64240`;
    return {
      difficulty: 1,
      ...mc(r, meaning, closeLen(r, meaning, FLAGS.map((f) => f[1]).filter((m) => m !== meaning))),
      prompt: 'In tcpdump output, what does the flags field of this packet mean?',
      snippet: line,
      explanation: `tcpdump abbreviates flags: S = SYN, F = FIN, R = RST, P = PSH and "." = ACK. **Flags ${flag}** is ${meaning.replace(':', ' -')}.`,
    };
  },
};

// ---------------------------------------------------------------- DNS

const RECORDS = [
  ['A', 'maps a name to an IPv4 address'],
  ['AAAA', 'maps a name to an IPv6 address'],
  ['CNAME', 'makes the name an alias of another name'],
  ['MX', 'names the mail servers for the domain'],
  ['TXT', 'holds free text, e.g. SPF or verification'],
  ['PTR', 'maps an IP address back to a name'],
  ['NS', 'names the authoritative name servers'],
  ['SRV', 'gives the host and port for a service'],
  ['SOA', 'holds zone authority data and serial'],
];

function recordLine(r, type) {
  const d = r.pick(['example.com', 'example.net', 'example.org']);
  const ttl = r.pick([300, 600, 3600, 86400]);
  switch (type) {
    case 'A': return `www.${d}.\t${ttl}\tIN\tA\t203.0.113.${r.int(2, 254)}`;
    case 'AAAA': return `www.${d}.\t${ttl}\tIN\tAAAA\t2001:db8::${r.int(10, 99)}`;
    case 'CNAME': return `shop.${d}.\t${ttl}\tIN\tCNAME\tshops.cdn.example.net.`;
    case 'MX': return `${d}.\t${ttl}\tIN\tMX\t10 mail.${d}.`;
    case 'TXT': return `${d}.\t${ttl}\tIN\tTXT\t"v=spf1 ip4:198.51.100.0/24 -all"`;
    case 'PTR': { const x = r.int(2, 254); return `${x}.113.0.203.in-addr.arpa.\t${ttl}\tIN\tPTR\thost${x}.${d}.`; }
    case 'NS': return `${d}.\t${ttl}\tIN\tNS\tns1.${d}.`;
    case 'SRV': return `_ldap._tcp.corp.${d}.\t${ttl}\tIN\tSRV\t0 100 389 dc01.corp.${d}.`;
    default: return `${d}.\t${ttl}\tIN\tSOA\tns1.${d}. hostmaster.${d}. 2026092501 7200 3600 1209600 300`;
  }
}

const dnsRecord = {
  id: 'dns-record',
  skill: 'net-dns',
  count: 20,
  bloom: 'understand',
  make(r) {
    const [type, meaning] = r.cycle(RECORDS);
    const distractors = closeLen(r, meaning, RECORDS.map((x) => x[1]).filter((m) => m !== meaning), 5).map((t) => ({
      text: t,
      mis: (type === 'A' && t.startsWith('maps an IP')) || (type === 'PTR' && t.includes('IPv4')) ? 'dns-a-ptr' : undefined,
    }));
    return {
      difficulty: ['A', 'MX', 'CNAME', 'PTR'].includes(type) ? 1 : 2,
      ...mc(r, meaning, distractors),
      prompt: 'What does this DNS answer record tell you?',
      snippet: recordLine(r, type),
      explanation: `The type column says **${type}**: it ${meaning}.${type === 'PTR' ? ' Reverse lookups live under in-addr.arpa with the octets reversed.' : ''}${type === 'TXT' ? ' Email authentication (SPF, DKIM keys, DMARC policy) is published in TXT records.' : ''}${type === 'SRV' ? ' Clients find domain controllers with SRV records such as _ldap._tcp.' : ''}`,
    };
  },
};

// ---------------------------------------------------------------- HTTP

export const STATUS = {
  200: 'OK: the request succeeded', 201: 'Created: a new resource was made', 204: 'No Content: success, empty body',
  206: 'Partial Content: a byte range was sent', 301: 'Moved Permanently: use the new URL', 302: 'Found: temporary redirect elsewhere',
  304: 'Not Modified: use the cached copy', 400: 'Bad Request: malformed request', 401: 'Unauthorized: authentication needed or failed',
  403: 'Forbidden: server refuses access', 404: 'Not Found: no such resource', 405: 'Method Not Allowed for this URL',
  429: 'Too Many Requests: rate limited', 500: 'Internal Server Error: server-side fault', 502: 'Bad Gateway: bad upstream reply',
  503: 'Service Unavailable: overloaded or down',
};

const PATHS = ['/admin/login.php', '/wp-login.php', '/api/v1/users', '/.env', '/backup.zip', '/index.html', '/images/logo.png', '/cgi-bin/test.cgi', '/login', '/reports/q3.pdf'];

const POSTABLE = new Set(['/admin/login.php', '/wp-login.php', '/api/v1/users', '/login']);

function accessLine(r, code, t = r.int(0, 86399)) {
  const path = r.pick(PATHS);
  const method = POSTABLE.has(path) && r.chance(0.5) ? 'POST' : 'GET';
  const h = String(Math.floor(t / 3600) % 24).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `198.51.100.${r.int(2, 254)} - - [25/Sep/2026:${h}:${m}:${s} +0000] "${method} ${path} HTTP/1.1" ${code} ${r.int(0, 9000)} "-" "Mozilla/5.0"`;
}

const httpStatus = {
  id: 'http-status',
  skill: 'net-http',
  count: 16,
  bloom: 'understand',
  make(r) {
    const code = Number(r.cycle(Object.keys(STATUS)));
    const meaning = STATUS[code];
    const pool = Object.entries(STATUS).filter(([c]) => Number(c) !== code);
    const near = r.shuffle(pool).sort((a, b) => (a[0][0] === String(code)[0] ? 0 : 1) - (b[0][0] === String(code)[0] ? 0 : 1)).slice(0, 8);
    const distractors = closeLen(r, [String(code), meaning], near, 3, (e) => e[1]).map(([c, t]) => ({
      text: t,
      mis: c[0] !== String(code)[0] ? 'http-status-classes' : undefined,
    }));
    return {
      difficulty: [200, 301, 302, 401, 403, 404, 500].includes(code) ? 1 : 2,
      ...mc(r, meaning, distractors),
      prompt: 'What does the status code in this web access log line mean?',
      snippet: accessLine(r, code),
      explanation: `The status comes right after the quoted request: **${code}** = ${meaning}. Classes: 2xx success, 3xx redirect, 4xx client error (the request was refused or wrong), 5xx server error.`,
    };
  },
};

const httpCount = {
  id: 'http-count',
  skill: 'net-http',
  count: 6,
  bloom: 'analyze',
  make(r) {
    const n = r.int(7, 10);
    const cls = r.pick(['4xx', '5xx', '2xx']);
    let codes;
    do codes = Array.from({ length: n }, () => Number(r.pick(Object.keys(STATUS))));
    while (!codes.some((c) => String(c)[0] === cls[0]));
    let t = r.int(1, 22) * 3600 + r.int(0, 3000);
    const lines = codes.map((c) => accessLine(r, c, (t += r.int(3, 90))));
    const count = codes.filter((c) => String(c)[0] === cls[0]).length;
    const label = { '4xx': 'client-error (4xx)', '5xx': 'server-error (5xx)', '2xx': 'success (2xx)' }[cls];
    return {
      difficulty: 2,
      type: 'text',
      prompt: `How many of these requests got a **${label}** response? (number)`,
      snippet: lines.join('\n'),
      accept: [String(count)],
      explanation: `The status is the number right after the quoted request line. The codes here are ${codes.join(', ')}, so **${count}** fall in ${cls}. The number after the status is the response size in bytes, not another status.`,
    };
  },
};

// ---------------------------------------------------------------- firewall logs

const fwBeacon = {
  id: 'fw-beacon',
  skill: 'net-fw-logs',
  count: 12,
  bloom: 'analyze',
  make(r) {
    const interval = r.cycle([30, 45, 60, 90, 120, 180, 300]);
    const src = `10.${r.int(0, 40)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const dst = `203.0.113.${r.int(2, 254)}`;
    let t = r.int(8, 20) * 3600 + r.int(0, 59) * 60 + r.int(0, 59);
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const h = String(Math.floor(t / 3600)).padStart(2, '0');
      const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
      const s = String(t % 60).padStart(2, '0');
      lines.push(`2026-09-25T${h}:${m}:${s} allow tcp ${src}:${r.int(49152, 65535)} -> ${dst}:443 bytes_out=${r.int(310, 360)} bytes_in=${r.int(90, 140)}`);
      t += interval;
    }
    return {
      difficulty: 2,
      type: 'text',
      prompt: 'An internal host makes these connections. What is the beacon interval in **seconds**? (number)',
      snippet: lines.join('\n'),
      accept: [String(interval), `${interval}s`, `${interval} seconds`],
      explanation: `Subtract consecutive timestamps: each connection is exactly **${interval} s** after the previous one, with near-identical small byte counts. That metronome-like regularity to one external IP is the classic C2 beacon pattern; allowed does not mean safe.`,
    };
  },
};

const fwScanner = {
  id: 'fw-scanner',
  skill: 'net-fw-logs',
  count: 12,
  bloom: 'analyze',
  make(r) {
    const scanner = `10.${r.int(0, 40)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const target = `10.${r.int(41, 80)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const other1 = `10.${r.int(81, 120)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const web = `10.${r.int(121, 160)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const ports = r.sample([21, 22, 23, 25, 80, 110, 135, 139, 143, 443, 445, 1433, 3306, 3389, 5900, 8080], 7);
    const rows = ports.map((p) => [`${[80, 443, 8080].includes(p) ? 'allow' : 'deny '} tcp ${scanner}:${r.int(40000, 60000)} -> ${target}:${p} flags=S`, 0]);
    // a busy but normal client: many connections, few well-known ports, different servers
    const dns = `10.${r.int(161, 200)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    rows.push([`allow tcp ${other1}:${r.int(49152, 65535)} -> ${web}:443 flags=S`, 1]);
    rows.push([`allow udp ${other1}:${r.int(49152, 65535)} -> ${dns}:53`, 2]);
    rows.push([`allow tcp ${other1}:${r.int(49152, 65535)} -> ${web}:443 flags=S`, 3]);
    const lines = r.shuffle(rows).map(([l], i) => `09:12:${String(10 + i).padStart(2, '0')} ${l}`);
    return {
      difficulty: 2,
      ...mc(r, scanner, [{ text: target, mis: 'fw-scan-direction' }, other1, web, dns]),
      prompt: 'Which host in this firewall log is **performing a port scan**?',
      snippet: lines.join('\n'),
      explanation: `**${scanner}** sends SYNs to ${ports.length} different ports on one target (${target}) within seconds, most of them denied: one source, one destination, many ports = a vertical port scan. ${other1} is simply busy (web and DNS to its usual servers). The target is the victim, not the scanner; direction comes from the src → dst fields.`,
    };
  },
};

// ---------------------------------------------------------------- OSI

const LAYERS = ['Layer 1 – Physical', 'Layer 2 – Data Link', 'Layer 3 – Network', 'Layer 4 – Transport', 'Layer 7 – Application'];
const OSI_FACTS = [
  ['a switch forwarding frames by MAC address', 1], ['an Ethernet frame and its MAC addresses', 1],
  ['a router choosing a path by IP address', 2], ['an ICMP echo request (ping)', 2], ['an IP packet and its TTL', 2],
  ['TCP source and destination port numbers', 3], ['a UDP datagram header', 3], ['the TCP three-way handshake', 3],
  ['an HTTP GET request', 4], ['a DNS query for a domain name', 4], ['an SMTP MAIL FROM command', 4],
  ['a hub repeating electrical signals', 0], ['bits on a fibre-optic cable', 0],
  ['ARP resolving an IP to a MAC address', 1], ['VLAN tagging inside an Ethernet frame', 1],
  ['a traceroute hop that decrements TTL', 2], ['NAT rewriting a private source address', 2],
  ['a TLS ClientHello on port 443', 4], ['an FTP PORT command', 4],
  ['a cable modem modulating bits onto RF', 0], ['CRC checks on a received Ethernet frame', 1],
  ['a firewall matching on TCP destination port', 3], ['QUIC carrying HTTP/3 over UDP', 3],
];

const osiLayer = {
  id: 'osi-layer',
  skill: 'net-osi',
  count: 22,
  bloom: 'understand',
  make(r) {
    const [thing, li] = r.cycle(OSI_FACTS);
    const answer = LAYERS[li];
    const distractors = LAYERS.filter((_, i) => i !== li).map((t) => ({
      text: t,
      mis: (li === 1 && t.includes('Network')) || (li === 2 && t.includes('Data Link')) ? 'osi-l2-l3' : (li === 3 && t.includes('Network')) || (li === 2 && t.includes('Transport')) ? 'osi-transport-layer' : undefined,
    }));
    return {
      difficulty: 1,
      ...mc(r, answer, r.shuffle(distractors)),
      prompt: `At which OSI layer do you find **${thing}**?`,
      explanation: `You find ${thing} at **${answer}**. Quick map: L1 bits and cables, L2 frames and MAC addresses (switches), L3 packets and IP addresses (routers, ICMP), L4 segments/datagrams and ports (TCP, UDP), L7 application protocols (HTTP, DNS, SMTP).`,
    };
  },
};

export default [subnetHosts, subnetNetBcast, subnetSame, subnetMask, subnetFit, ipClass, ipPrivatePick, portToService, serviceToPort, scanState, tcpFlags, dnsRecord, httpStatus, httpCount, fwBeacon, fwScanner, osiLayer];

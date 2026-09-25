// Level 2 · IDS/IPS & network security monitoring: questions, lesson and misconceptions.
// Snort/Suricata rule anatomy, Suricata eve.json alerts, Zeek logs (conn, dns, http, ssl, notice),
// tuning noisy signatures and IDS vs IPS placement. Rule SIDs are in the local range (1000000+),
// IPs are RFC 1918 / RFC 5737 and domains are .example. `bloom` records the intended Bloom level.

const S = 'l2-ids';

const items = [
  {
    id: 'ids-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'What is the key difference between an **IDS** and an **IPS**?',
    choices: [
      'An IPS sits inline and can drop; an IDS watches a copy',
      'An IDS encrypts the traffic; an IPS decrypts it again',
      'An IPS only reads host logs; an IDS only reads email',
      'They are one product sold under two licence names',
    ],
    answer: 'An IPS sits inline and can drop; an IDS watches a copy',
    misconceptions: { 'They are one product sold under two licence names': 'ids-inline-free' },
    explanation:
      'An IDS reads a **copy** of traffic (SPAN port or network TAP) and raises alerts: it cannot stop anything. An IPS sits **inline**, so every packet passes through it and it can drop or reset. Suricata and Snort can run in either mode; the placement decides the capability.',
  },
  {
    id: 'ids-02',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In this Suricata/Snort rule, what does the **header** (the part before the parentheses) define?',
    snippet: `alert tcp $EXTERNAL_NET any -> $HOME_NET 445 (msg:"Inbound SMB from internet"; flow:to_server; sid:1000101; rev:1;)`,
    choices: [
      'The action, protocol, addresses and ports to match',
      'The message shown to the analyst and the rule revision',
      'The payload bytes the rule searches each packet for',
      'How many times the rule may alert in each minute',
    ],
    answer: 'The action, protocol, addresses and ports to match',
    explanation:
      'The header is `action protocol src_ip src_port -> dst_ip dst_port`: here, alert on TCP from any external address/port to port 445 on the home network. Everything inside the parentheses is **options**: `msg`, `flow`, `content`, `sid`, `rev` and so on.',
  },
  {
    id: 'ids-03',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Which rule option gives a signature its unique ID number? (the keyword, e.g. `msg`)',
    accept: ['sid', 'sid:'],
    misconceptions: { rev: 'ids-fields-confused' },
    explanation:
      '`sid` is the Signature ID, the rule\'s unique number (locally written rules use 1000000 and up). `rev` is the revision of that rule, bumped each time it is edited. Analysts reference alerts by SID, and tuning is done per SID.',
  },
  {
    id: 'ids-04',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'What does this rule detect?',
    snippet: `alert http $HOME_NET any -> $EXTERNAL_NET any (msg:"Possible C2 check-in"; flow:established,to_server; http.method; content:"POST"; http.uri; content:"/gate.php"; endswith; http.user_agent; content:"Mozilla/4.0"; sid:1000210; rev:3;)`,
    choices: [
      'Internal hosts POSTing to /gate.php with a Mozilla/4.0 agent',
      'External hosts scanning the internal web server for gate.php',
      'Any HTTP traffic at all leaving the internal network',
      'DNS lookups for a domain named gate.php from any host',
    ],
    answer: 'Internal hosts POSTing to /gate.php with a Mozilla/4.0 agent',
    explanation:
      'Direction is `$HOME_NET -> $EXTERNAL_NET`, `flow:established,to_server` means client-to-server traffic in a live session, and the sticky buffers (`http.method`, `http.uri`, `http.user_agent`) point each `content` at a specific field. All conditions must match: a POST, to a URI ending `/gate.php`, with the `Mozilla/4.0` user agent many old bots use.',
  },
  {
    id: 'ids-05',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does `flow:established,to_server` add to a rule?',
    choices: [
      'Only live TCP sessions, client-to-server direction',
      'Only the first SYN packet of each new connection',
      'Traffic in both directions of any session, open or not',
      'Drop the connection as soon as the rule matches',
    ],
    answer: 'Only live TCP sessions, client-to-server direction',
    explanation:
      '`established` requires a completed handshake (so spoofed, one-way packets do not trigger), and `to_server` limits it to the client-to-server direction. This cuts false positives and cost. `flow` never drops anything: the action (alert/drop/reject) decides that.',
  },
  {
    id: 'ids-06',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'This eve.json event came from a Suricata sensor on a **SPAN port**. Was the traffic stopped?',
    snippet: `{"timestamp":"2026-09-22T14:03:11.402+0000","event_type":"alert",
 "src_ip":"10.20.4.51","src_port":49822,"dest_ip":"203.0.113.80","dest_port":80,"proto":"TCP",
 "alert":{"action":"allowed","signature_id":1000210,"rev":3,
          "signature":"Possible C2 check-in","category":"A Network Trojan was detected","severity":1},
 "http":{"hostname":"cdn-update.example","url":"/gate.php","http_method":"POST","status":200}}`,
    choices: [
      'No: it was allowed, a SPAN sensor can\'t block, and the server replied 200',
      'Yes: severity 1 alerts are always blocked automatically by the sensor',
      'Yes: the category says a trojan was detected, so it was dropped',
      'Unknown: eve.json never records what action was taken on a packet',
    ],
    answer: 'No: it was allowed, a SPAN sensor can\'t block, and the server replied 200',
    misconceptions: { 'Yes: severity 1 alerts are always blocked automatically by the sensor': 'ids-alert-blocked' },
    explanation:
      '`alert.action: "allowed"` plus a passive SPAN placement means it was only observed. The `http.status: 200` shows the server answered. Severity 1 is Suricata\'s **highest** priority, but severity never blocks anything. Treat this as a live possible C2 check-in from 10.20.4.51.',
  },
  {
    id: 'ids-07',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'In Suricata alerts, which **severity** value is the most urgent?',
    choices: [
      '1',
      '3',
      '5',
      '10',
    ],
    answer: '1',
    misconceptions: { '10': 'ids-fields-confused', '3': 'ids-fields-confused' },
    explanation:
      'Suricata severity (from the classtype priority) runs **1 = highest**, then 2, 3 and so on. It is the opposite of CVSS, where bigger is worse, which trips people up. Use severity to sort, but always read what the traffic actually did.',
  },
  {
    id: 'ids-08',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Read this **Zeek conn.log** excerpt. What is the source doing?',
    snippet: `ts          id.orig_h    id.orig_p id.resp_h   id.resp_p proto conn_state history
1790000001  10.20.9.14   51001     10.20.1.5   21        tcp   S0         S
1790000001  10.20.9.14   51002     10.20.1.5   22        tcp   REJ        Sr
1790000001  10.20.9.14   51003     10.20.1.5   23        tcp   S0         S
1790000002  10.20.9.14   51004     10.20.1.5   25        tcp   REJ        Sr
1790000002  10.20.9.14   51005     10.20.1.5   80        tcp   SF         ShAdaDfF
... 1,020 more rows, ports 1-1024`,
    choices: [
      'A port scan: SYNs to every port, mostly unanswered',
      'A large file download over port 80 from the server',
      'A DNS tunnel running from the host to 10.20.1.5',
      'Normal nightly backup traffic between the two servers',
    ],
    answer: 'A port scan: SYNs to every port, mostly unanswered',
    explanation:
      '`S0` = SYN sent, no reply; `REJ` = rejected (history `Sr`: our SYN, their RST). One source walking ports 1–1024 in seconds is a port scan (T1046). The single `SF` on port 80 is a normal completed connection: the one open port. Uppercase history letters are the originator, lowercase the responder.',
  },
  {
    id: 'ids-09',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In Zeek, which field links the **conn.log**, **http.log** and **ssl.log** rows that belong to the same connection?',
    choices: [
      'uid',
      'ts',
      'id.orig_h',
      'service',
    ],
    answer: 'uid',
    explanation:
      'Every connection gets a unique `uid` (like `CHhAvVGS1DHFjwGM9`), and every protocol log row for that connection carries it. Pivoting on `uid` joins "who talked to whom" (conn) with "what they said" (http/dns/ssl). Timestamps and IPs alone are ambiguous when there are many connections.',
  },
  {
    id: 'ids-10',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What stands out in this **Zeek dns.log**?',
    snippet: `ts          id.orig_h    query                                                  qtype_name rcode_name
1790003001  10.20.4.77   aGVsbG8gd29ybGQ.x7.tunnel-a.example                     TXT        NOERROR
1790003001  10.20.4.77   Y29uZmlkZW50aWFs.x8.tunnel-a.example                    TXT        NOERROR
1790003002  10.20.4.77   cGF5cm9sbC5jc3Y.x9.tunnel-a.example                     TXT        NOERROR
... 4,812 queries in 10 minutes, all unique subdomains of tunnel-a.example`,
    choices: [
      'DNS tunnelling: data encoded in unique subdomains',
      'A misconfigured resolver retrying the same lookup',
      'Normal CDN traffic that uses random-looking hostnames',
      'A DNS amplification attack against 10.20.4.77',
    ],
    answer: 'DNS tunnelling: data encoded in unique subdomains',
    explanation:
      'Thousands of unique, base64-looking labels under one domain, mostly TXT queries, from one host: data is being smuggled in DNS (T1071.004 / T1048). CDN names repeat and are few; a retrying resolver repeats the same name; amplification targets the victim with responses, not queries from it.',
  },
  {
    id: 'ids-11',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which **Zeek ssl.log** observations are suspicious for an outbound TLS session from a workstation? Select all that apply.',
    snippet: `id.orig_h    id.resp_h      id.resp_p server_name          version  validation_status               established
10.20.4.51   203.0.113.80   8443      -                    TLSv12   self signed certificate         T
10.20.4.51   198.51.100.9   443       login.corp.example   TLSv13   ok                              T`,
    choices: [
      'No server_name (SNI) at all on the first session',
      'A self-signed certificate on the first session',
      'TLS on a non-standard port (8443) to a bare IP',
      'TLSv13 on the second session to the corporate login page',
      'The second session validating as ok',
    ],
    answer: ['No server_name (SNI) at all on the first session', 'A self-signed certificate on the first session', 'TLS on a non-standard port (8443) to a bare IP'],
    misconceptions: { 'TLSv13 on the second session to the corporate login page': 'ids-encrypted-blind' },
    explanation:
      'Even without decryption, TLS metadata talks. No SNI, a self-signed certificate and an odd port to a raw IP are classic traits of hand-rolled C2 (T1573, T1571). The second session has a proper SNI, a valid chain and modern TLS to a known corporate name: normal.',
  },
  {
    id: 'ids-12',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A signature fires 9,000 times a day, all from the internal vulnerability scanner at 10.20.0.50. What is the best tuning action?',
    choices: [
      'Suppress that SID for 10.20.0.50 only, and document it',
      'Disable the SID across the whole network to stop the noise',
      'Remove the scanner from the network so it stops alerting',
      'Leave it; high alert counts prove the IDS is working',
    ],
    answer: 'Suppress that SID for 10.20.0.50 only, and document it',
    misconceptions: { 'Disable the SID across the whole network to stop the noise': 'ids-tune-disable' },
    explanation:
      'A **suppression** scoped to one SID and one known source removes the noise while keeping the signature live for everyone else, e.g. `suppress gen_id 1, sig_id 1000301, track by_src, ip 10.20.0.50`. Disabling the SID globally blinds you to a real attacker doing the same thing. Record the reason and review it periodically.',
  },
  {
    id: 'ids-13',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What does this rule option do?',
    snippet: `alert tcp $EXTERNAL_NET any -> $HOME_NET 22 (msg:"SSH brute force"; flow:to_server; flags:S;
  detection_filter:track by_src, count 20, seconds 60; sid:1000402; rev:1;)`,
    choices: [
      'Alerts only after 20+ SYNs from one source in 60 seconds',
      'Alerts on the first SSH connection, then waits 60 seconds',
      'Blocks the source for 60 seconds after 20 connection attempts',
      'Alerts once for every 20 SSH sessions, from any source at all',
    ],
    answer: 'Alerts only after 20+ SYNs from one source in 60 seconds',
    misconceptions: { 'Blocks the source for 60 seconds after 20 connection attempts': 'ids-alert-blocked' },
    explanation:
      '`detection_filter` sets a rate the rule must exceed before it alerts: here more than 20 new SSH connection attempts (`flags:S`) from the same source within 60 s. It turns a noisy per-connection rule into a brute-force detector. It never blocks: the action is `alert`.',
  },
  {
    id: 'ids-14',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Why is putting an **IPS inline** a bigger decision than deploying an IDS?',
    choices: [
      'A false positive drops real traffic, and a failure can cut the link',
      'It is cheaper to buy and therefore riskier to run',
      'It cannot see encrypted traffic, while an IDS always can',
      'It only works in cloud networks, never on premises',
    ],
    answer: 'A false positive drops real traffic, and a failure can cut the link',
    misconceptions: { 'It is cheaper to buy and therefore riskier to run': 'ids-inline-free' },
    explanation:
      'Inline means every packet depends on the IPS. A bad signature drops legitimate traffic; an overloaded or crashed box adds latency or an outage unless it **fails open** (bypass), which in turn lets attacks through. That is why teams often start in IDS mode, tune, then move proven signatures to `drop`.',
  },
  {
    id: 'ids-15',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'A Zeek conn.log row shows `conn_state` = **S0**. In a few words, what happened to that connection?',
    accept: ['no reply', 'syn no reply', 'syn sent no reply', 'no response', 'syn with no reply', 'unanswered', 'syn only', 'syn but no reply', 'no answer', 'unanswered syn'],
    misconceptions: { rejected: 'ids-fields-confused', established: 'ids-fields-confused' },
    explanation:
      '`S0` = the originator sent a SYN and saw **no reply** at all (filtered, host down, or dropped). `REJ` is a rejected attempt (RST back), `SF` is a normal established-and-closed session, and `RSTO`/`RSTR` are sessions reset by the originator/responder. Many S0s from one source is scanning or a dead C2 server.',
  },
  {
    id: 'ids-16',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Which Zeek log would you open first to see the **URI and User-Agent** of a suspicious download?',
    choices: [
      'http.log',
      'conn.log',
      'dns.log',
      'notice.log',
    ],
    answer: 'http.log',
    explanation:
      '`http.log` records each request: `method`, `host`, `uri`, `user_agent`, `status_code`, `resp_mime_types` and more. conn.log has only the connection summary (IPs, ports, bytes, state), dns.log the lookups, and notice.log what Zeek\'s scripts flagged. Join them on `uid`.',
  },
  {
    id: 'ids-17',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'You need to watch east-west traffic between internal server VLANs, with zero risk of an outage. Which placement fits best?',
    choices: [
      'A passive sensor on a TAP or SPAN of the core switch',
      'An inline IPS in front of the internet firewall',
      'An IPS in blocking mode between every VLAN',
      'Host logs only; network sensors cannot see internal traffic',
    ],
    answer: 'A passive sensor on a TAP or SPAN of the core switch',
    misconceptions: { 'An IPS in blocking mode between every VLAN': 'ids-inline-free' },
    explanation:
      'The goal is **visibility without outage risk**, so passive monitoring of the core, where east-west traffic crosses, is the fit. A perimeter IPS never sees internal-to-internal traffic, and inline blocking between every VLAN adds exactly the risk you were told to avoid. TAPs are more reliable than SPAN, which can drop packets when oversubscribed.',
  },
  {
    id: 'ids-18',
    skill: S,
    difficulty: 3,
    type: 'multi',
    bloom: 'evaluate',
    prompt: 'A rule that looks for `content:"cmd.exe"` in any TCP traffic fires 400 times a day, mostly on software updates. Which changes tune it **without** losing the real detection? Select all that apply.',
    choices: [
      'Add flow:established,to_server and scope the destination to the web servers',
      'Point the content at a specific buffer, such as http.uri, instead of the whole stream',
      'Add a second content or pcre for the actual attack pattern, such as a traversal before cmd.exe',
      'Change the action from alert to pass for all traffic',
      'Raise the rule\'s priority so the noise is sorted to the top',
    ],
    answer: ['Add flow:established,to_server and scope the destination to the web servers', 'Point the content at a specific buffer, such as http.uri, instead of the whole stream', 'Add a second content or pcre for the actual attack pattern, such as a traversal before cmd.exe'],
    misconceptions: { 'Change the action from alert to pass for all traffic': 'ids-tune-disable' },
    explanation:
      'Good tuning narrows **where** the rule looks (direction, destination, buffer) and **what** it demands (a more specific pattern), so updates stop matching but an exploit still does. `pass` for all traffic is a disable in disguise, and a higher priority just makes the noise louder.',
  },
  {
    id: 'ids-19',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does the `pcre` option add over `content`?',
    choices: [
      'It matches regular expressions that fixed strings can\'t express',
      'It makes the rule faster than any plain content match',
      'It decrypts TLS payloads before any matching is done',
      'It sets the severity the rule reports to the SIEM',
    ],
    answer: 'It matches regular expressions that fixed strings can\'t express',
    explanation:
      '`pcre:"/\\/[a-f0-9]{32}\\.php$/i"` matches shapes (32 hex characters then .php) that a fixed `content` cannot. It is **slower**, so good rules keep a cheap `content` as a fast pre-filter and use `pcre` to confirm. Nothing in a rule decrypts TLS.',
  },
  {
    id: 'ids-20',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A Suricata alert names a web exploit against 10.20.2.15, but the **eve.json http** section shows `status: 404`. What does that tell you?',
    choices: [
      'The attempt reached the server, but the path was missing',
      'The exploit definitely succeeded against the server',
      'The IPS blocked it and answered with a 404 page',
      'It is a false positive; that traffic never happened',
    ],
    answer: 'The attempt reached the server, but the path was missing',
    misconceptions: {
      'The exploit definitely succeeded against the server': 'ids-alert-blocked',
      'It is a false positive; that traffic never happened': 'ids-alert-blocked',
    },
    explanation:
      'The alert proves the **attempt** happened (so it is not a false positive); the 404 says the vulnerable path is not there, so this attempt most likely failed. An IPS drop does not produce a 404: the server generated it. Note the source for scanning activity and check whether other paths returned 200.',
  },
  {
    id: 'ids-21',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does Zeek produce, compared with Suricata?',
    choices: [
      'Logs of every connection; Suricata mainly produces alerts',
      'Only full packet captures; Suricata produces the logs',
      'Only firewall rules; Suricata produces the weekly reports',
      'Nothing at all unless a signature matches first',
    ],
    answer: 'Logs of every connection; Suricata mainly produces alerts',
    misconceptions: { 'Nothing at all unless a signature matches first': 'ids-encrypted-blind' },
    explanation:
      'Zeek records **every** connection and protocol exchange (conn, dns, http, ssl, files, notice) whether or not anything is "bad", which is gold for hunting and scoping. Suricata is signature-first: it alerts on rule matches (and can also log protocols in eve.json). Teams often run both.',
  },
  {
    id: 'ids-22',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'You edit an existing rule to add a `pcre`. Which option must you increase so everyone knows the rule changed? (keyword)',
    accept: ['rev', 'rev:'],
    misconceptions: { sid: 'ids-fields-confused' },
    explanation:
      '`rev` is the rule revision: bump it on every change so alerts show which version fired and tuning history stays clear. The `sid` stays the same because it is still the same detection.',
  },
  {
    id: 'ids-23',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Zeek conn.log shows this for one workstation, every 60 seconds (±2 s) for 9 hours, overnight. What is the most likely explanation?',
    snippet: `ts          id.orig_h    id.resp_h      id.resp_p service duration orig_bytes resp_bytes conn_state
1790010000  10.20.4.51   203.0.113.80   443       ssl     0.41     312        188        SF
1790010061  10.20.4.51   203.0.113.80   443       ssl     0.39     312        188        SF
1790010120  10.20.4.51   203.0.113.80   443       ssl     0.44     312        188        SF
... 540 rows, same sizes, no user logged on`,
    choices: [
      'Beaconing: an implant checking in on a timer',
      'A user streaming video all through the night',
      'A slow port scan against 203.0.113.80',
      'A DNS tunnel hidden inside TLS traffic',
    ],
    answer: 'Beaconing: an implant checking in on a timer',
    misconceptions: { 'A user streaming video all through the night': 'ids-encrypted-blind' },
    explanation:
      'Near-perfect 60-second intervals, identical small byte counts, short sessions and no user at the keyboard are the fingerprint of **beaconing** (T1071.001 over TLS). You do not need to decrypt it: timing and size regularity give it away. Streaming moves large, uneven volumes; a scan hits many ports; DNS tunnels live in dns.log. Some updaters also poll, so check the destination\'s reputation and the process on the host.',
  },
  {
    id: 'ids-24',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'You want a rule to alert **at most once per minute per source**, however many packets match. Which option does that?',
    choices: [
      'threshold: type limit, track by_src, count 1, seconds 60;',
      'flow: established, to_server, count 1, seconds 60;',
      'priority: 1, track by_src, limit 60, seconds 60;',
      'rev: 60, track by_src, count 1, seconds 60;',
    ],
    answer: 'threshold: type limit, track by_src, count 1, seconds 60;',
    misconceptions: { 'rev: 60, track by_src, count 1, seconds 60;': 'ids-fields-confused' },
    explanation:
      '`threshold` with `type limit` caps alerts: at most `count` alerts per `seconds` per tracked address. `type threshold` alerts every Nth match and `type both` alerts once after N matches in the window. `flow` sets session state, `priority` overrides severity and `rev` is the revision number: none of them rate-limit.',
  },
  {
    id: 'ids-25',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'An inline Suricata IPS logged this. What actually happened to the packet?',
    snippet: `{"event_type":"alert","src_ip":"198.51.100.23","dest_ip":"10.20.2.15","dest_port":443,
 "alert":{"action":"blocked","signature_id":1000512,"rev":2,
          "signature":"ExampleVPN auth bypass attempt (CVE-2026-91007)","severity":1},
 "verdict":{"action":"drop"}}`,
    choices: [
      'It was dropped inline; now check for earlier attempts',
      'It reached the server; "blocked" only hides the alert',
      'The server rejected it with an HTTP 403 status code',
      'Nothing; the verdict field is only informational',
    ],
    answer: 'It was dropped inline; now check for earlier attempts',
    misconceptions: { 'The server rejected it with an HTTP 403 status code': 'ids-alert-blocked' },
    explanation:
      'On an inline sensor, `alert.action: "blocked"` and the final `verdict.action: "drop"` mean Suricata discarded the packet: the server never saw it. Good news, but not the end: the rule may have been added after earlier attempts, or a variant may not match. Search the logs for the same source and CVE before the rule\'s `rev` went live.',
  },
  {
    id: 'ids-26',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'apply',
    prompt: 'Which of these are valid **options** (inside the parentheses) in a Suricata rule? Select all that apply.',
    choices: [
      'content:"/admin/upload"; nocase;',
      'pcre:"/\\/[a-f0-9]{16}\\.php$/i";',
      'classtype:web-application-attack;',
      '$EXTERNAL_NET any -> $HOME_NET 80',
      'drop tcp',
    ],
    answer: ['content:"/admin/upload"; nocase;', 'pcre:"/\\/[a-f0-9]{16}\\.php$/i";', 'classtype:web-application-attack;'],
    misconceptions: { '$EXTERNAL_NET any -> $HOME_NET 80': 'ids-fields-confused', 'drop tcp': 'ids-fields-confused' },
    explanation:
      '`content`/`nocase`, `pcre` and `classtype` are options. The address/port part and the action + protocol (`drop tcp`) belong to the **header**, before the parentheses. Keeping the two apart is the first step to reading any rule quickly.',
  },
  {
    id: 'ids-27',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What does this **Zeek notice.log** row tell you, and what is your next step?',
    snippet: `ts          note                   msg                                                   src          dst
1790020410  SSH::Password_Guessing 198.51.100.61 appears to be guessing SSH passwords    198.51.100.61  10.20.3.8`,
    choices: [
      'Zeek saw many failed SSH logins; check for a success',
      'Zeek blocked the source after it guessed the password',
      'Zeek decrypted SSH and read the passwords being typed',
      'A Suricata signature matched and Zeek copied the alert',
    ],
    answer: 'Zeek saw many failed SSH logins; check for a success',
    misconceptions: {
      'Zeek blocked the source after it guessed the password': 'ids-alert-blocked',
      'Zeek decrypted SSH and read the passwords being typed': 'ids-encrypted-blind',
    },
    explanation:
      'Zeek\'s SSH brute-force script infers failed logins from connection behaviour (it cannot read the encrypted passwords) and raises `SSH::Password_Guessing`. Zeek is passive: it did not block anything. Next: check ssh.log (`auth_success`) and the server\'s auth logs for a success from that source, and block or rate-limit it at the edge.',
  },
  {
    id: 'ids-28',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'The inline IPS appliance at the internet edge needs a firmware update and may reboot. The business can\'t tolerate an outage. What is the key design question?',
    choices: [
      'Does it fail open or fail closed, and which is acceptable?',
      'Can the IDS rules be converted to firewall rules overnight?',
      'Will the SIEM keep the alerts after the reboot finishes?',
      'Is the appliance\'s severity scale 1-3 or 1-4?',
    ],
    answer: 'Does it fail open or fail closed, and which is acceptable?',
    misconceptions: { 'Will the SIEM keep the alerts after the reboot finishes?': 'ids-inline-free' },
    explanation:
      'Inline devices must choose: **fail open** keeps the business running but lets traffic through unfiltered during the gap; **fail closed** keeps inspection but cuts the link. Hardware bypass switches and HA pairs reduce the dilemma. This trade-off is the core cost of putting an IPS inline.',
  },
  {
    id: 'ids-29',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'A network sensor gets its copy of traffic either from a switch mirror port or from a dedicated hardware device placed on the cable. Name that hardware device. (one word)',
    accept: ['tap', 'network tap', 'a tap'],
    misconceptions: { span: 'ids-inline-free' },
    explanation:
      'A **TAP** (Test Access Point) copies every packet on the link to the sensor, including malformed ones, and does not drop under load. A **SPAN** (mirror) port is configured on the switch: cheap and flexible, but it can drop packets when oversubscribed. Both are passive: the sensor cannot block.',
  },
  {
    id: 'ids-30',
    skill: S,
    difficulty: 3,
    type: 'multi',
    bloom: 'evaluate',
    prompt: 'Most of your traffic is TLS and the IDS decrypts none of it. Which detections still work? Select all that apply.',
    choices: [
      'Beaconing from connection timing and byte counts (conn.log)',
      'Suspicious certificates and missing SNI (ssl.log)',
      'Client fingerprints such as JA3/JA4 matched against known tools',
      'content matches on the HTTP URI inside the encrypted stream',
      'Reading the passwords users type into HTTPS login forms',
    ],
    answer: ['Beaconing from connection timing and byte counts (conn.log)', 'Suspicious certificates and missing SNI (ssl.log)', 'Client fingerprints such as JA3/JA4 matched against known tools'],
    misconceptions: {
      'content matches on the HTTP URI inside the encrypted stream': 'ids-encrypted-blind',
      'Reading the passwords users type into HTTPS login forms': 'ids-encrypted-blind',
    },
    explanation:
      'Encryption hides the **payload**, not the **metadata**. Timing, sizes, destinations, certificates, SNI and handshake fingerprints (JA3/JA4) remain visible and catch a lot of C2. Payload matches such as `http.uri` content need decryption (a TLS-inspecting proxy) or endpoint telemetry.',
  },
  {
    id: 'ids-31',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In a rule header, what do `$HOME_NET` and `$EXTERNAL_NET` stand for?',
    choices: [
      'Config variables for your networks and everything else',
      'Hard-coded addresses that every Suricata install shares',
      'The sensor\'s own management IP and its default gateway',
      'The names of two log files the sensor writes alerts to',
    ],
    answer: 'Config variables for your networks and everything else',
    misconceptions: { 'Hard-coded addresses that every Suricata install shares': 'ids-fields-confused' },
    explanation:
      'They are address variables defined in `suricata.yaml` / `snort.conf`: `HOME_NET` is the ranges you protect (e.g. `[10.0.0.0/8,192.168.0.0/16]`) and `EXTERNAL_NET` is usually `!$HOME_NET`. A wrong HOME_NET is a classic cause of rules that never fire or fire on everything.',
  },
  {
    id: 'ids-32',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A new Emerging-Threats-style rule would block an actively exploited VPN bug. You are about to deploy it straight to the inline IPS in `drop` mode. What is the safest rollout?',
    choices: [
      'Run it as alert first, check for false positives, then switch to drop',
      'Deploy it as drop everywhere at once, since the bug is being exploited',
      'Wait for the vendor patch and skip the rule to avoid risk',
      'Lower its severity so nobody gets paged if it misfires',
    ],
    answer: 'Run it as alert first, check for false positives, then switch to drop',
    misconceptions: { 'Deploy it as drop everywhere at once, since the bug is being exploited': 'ids-inline-free' },
    explanation:
      'A brief alert-only period (hours, not weeks, for a KEV-grade bug) shows whether the rule matches legitimate VPN traffic before it starts dropping it. Then switch to `drop`: a virtual patch while the real patch is scheduled. Skipping the rule leaves you exposed, and lowering severity hides problems instead of testing for them.',
  },
];

const lesson = {
  skill: S,
  title: 'IDS/IPS & network security monitoring',
  goal: 'Read Snort/Suricata rules and alerts, use Zeek logs to scope what happened, tune noisy signatures safely and choose between passive and inline sensors.',
  sections: [
    {
      id: 'placement',
      heading: 'IDS vs IPS: where the sensor sits decides what it can do',
      body: [
        'An **IDS** reads a **copy** of traffic from a **SPAN** (mirror) port or a **TAP** and raises alerts; it can never block. An **IPS** sits **inline**: every packet passes through it, so it can drop or reset, but a bad rule drops real traffic and a failure can cut the link unless it **fails open** (bypass). Suricata and Snort can run either way.',
        'Place sensors where the traffic you care about crosses: the internet edge for inbound attacks, the core switch for **east-west** traffic between internal VLANs, and in front of crown-jewel segments. A perimeter sensor never sees internal-to-internal movement.',
      ],
      points: [
        'Roll out new blocking rules as alert-only first, check for false positives, then switch to `drop`.',
        'TAPs do not drop under load; oversubscribed SPAN ports can.',
      ],
    },
    {
      id: 'rules',
      heading: 'Reading a Snort/Suricata rule',
      body: [
        'A rule is a **header** and **options**. The header is `action protocol src_ip src_port -> dst_ip dst_port` (actions: alert, drop, reject, pass). `$HOME_NET` and `$EXTERNAL_NET` are variables from the sensor config. Options sit in parentheses, separated by semicolons.',
        '`msg` is the text analysts see. `flow:established,to_server` restricts matching to live client-to-server sessions. `content` matches bytes; sticky buffers such as `http.uri`, `http.method` or `http.user_agent` (Suricata) point it at one field. `pcre` adds a regular expression (slower, so keep a `content` as a pre-filter). `sid` is the unique ID (local rules use 1000000+), `rev` the revision, bumped on every edit. `threshold` / `detection_filter` control alert rates.',
      ],
      evidence: {
        label: 'A local rule, piece by piece',
        text: 'alert http $HOME_NET any -> $EXTERNAL_NET any (      <- header: action, proto, src -> dst\n  msg:"Possible C2 check-in";                          <- what the analyst sees\n  flow:established,to_server;                          <- live session, client to server\n  http.method; content:"POST";                         <- sticky buffer + match\n  http.uri; content:"/gate.php"; endswith;\n  classtype:trojan-activity; sid:1000210; rev:3;)       <- category, ID, revision',
      },
    },
    {
      id: 'alerts',
      heading: 'Suricata eve.json alerts',
      body: [
        'Suricata writes JSON events to **eve.json**: `event_type` (alert, http, dns, tls, flow...), `src_ip`/`dest_ip`/ports, and for alerts an `alert` object with `signature`, `signature_id`, `rev`, `category`, `severity` and `action`. **Severity 1 is the most urgent**, the opposite of CVSS.',
        '`alert.action: "allowed"` means the traffic passed (always true on a passive sensor); `"blocked"` on an inline sensor means it was dropped, and the optional `verdict` object records the final decision. An alert proves an **attempt**, not success: read the protocol metadata (an `http.status` of 404 vs 200, bytes returned) and the host to judge the outcome.',
      ],
      evidence: {
        label: 'eve.json alert (trimmed)',
        text: '{"event_type":"alert","src_ip":"10.20.4.51","dest_ip":"203.0.113.80","dest_port":80,\n "alert":{"action":"allowed","signature_id":1000210,"rev":3,"signature":"Possible C2 check-in","severity":1},\n "http":{"hostname":"cdn-update.example","url":"/gate.php","status":200}}',
      },
    },
    {
      id: 'zeek',
      heading: 'Zeek logs: the record of everything',
      body: [
        'Zeek logs **every** connection and protocol exchange, not just "bad" ones, which makes it the scoping tool. Each connection has a `uid` that ties its rows together across logs. **conn.log**: `id.orig_h`/`id.resp_h`, ports, `service`, `duration`, `orig_bytes`/`resp_bytes`, `conn_state` (S0 = SYN, no reply; REJ = rejected; SF = normal open and close; RSTO/RSTR = reset by originator/responder) and `history` (uppercase = originator, lowercase = responder).',
        '**dns.log** (`query`, `qtype_name`, `rcode_name`, `answers`) shows lookups and tunnelling; **http.log** (`method`, `host`, `uri`, `user_agent`, `status_code`) shows web requests; **ssl.log** (`server_name` = SNI, `version`, `validation_status`) and fingerprints (JA3/JA4) describe encrypted sessions; **notice.log** holds what Zeek\'s scripts flagged, e.g. `SSH::Password_Guessing` or `SSL::Invalid_Server_Cert`.',
      ],
      points: [
        'Encryption hides payloads, not metadata: timing, sizes, SNI, certificates and fingerprints still expose C2.',
        'Beaconing = regular intervals + similar small sizes + no user activity.',
      ],
    },
    {
      id: 'tuning',
      heading: 'Tuning noisy signatures',
      body: [
        'A signature that fires thousands of times a day on known-good traffic buries real alerts. Tune **narrowly**: a **suppression** for one SID and one known source (`suppress gen_id 1, sig_id 1000301, track by_src, ip 10.20.0.50`), tighter rule scope (direction, destination, sticky buffer, extra content), or a `threshold` so it alerts once per window instead of per packet.',
        'Never "tune" by disabling the SID everywhere or changing it to `pass`: that blinds you to the attacker doing the same thing from elsewhere. Document every change with the reason, bump `rev` when you edit a rule, and review suppressions regularly.',
      ],
    },
  ],
  worked: [
    {
      id: 'ids-w1',
      title: 'From one alert to a scoped incident',
      artifactLabel: 'Suricata alert + Zeek logs (same uid)',
      artifact:
        'eve.json  alert  sid:1000210 rev:3 "Possible C2 check-in"  action:allowed  severity:1\n          10.20.4.51:49822 -> 203.0.113.80:80  http POST /gate.php  status:200\nconn.log  uid=CxT1u9 10.20.4.51 -> 203.0.113.80:80  SF  orig_bytes 412 resp_bytes 96\nconn.log  same pair, every 300 s since 01:12 (41 connections)\ndns.log   10.20.4.51 query cdn-update.example  A  203.0.113.80',
      question: 'Is this real, did it get through, and how long has it been going on?',
      steps: [
        'The alert action is "allowed" and the sensor is passive: nothing was blocked. The http status 200 shows the server answered.',
        'Pivot on the uid to conn.log: a completed session (SF) with small byte counts, typical of a check-in rather than a download.',
        'Widen to the same host pair in conn.log: 41 connections at a fixed 300-second interval since 01:12. That regularity is beaconing, so this is not a one-off.',
        'dns.log shows which name resolved to the C2 IP, giving a domain to block and to hunt for on other hosts.',
      ],
      conclusion: 'True positive: an implant on 10.20.4.51 has beaconed to cdn-update.example every 5 minutes since 01:12. Isolate the host, block the domain and IP, and search dns.log and conn.log for any other host that resolved or contacted them.',
    },
  ],
  faded: [
    {
      id: 'ids-f1',
      title: 'The noisy signature',
      artifactLabel: 'Top alerts, last 24 h',
      artifact:
        'sid:1000301 "Possible SMB share enumeration"  9,112 alerts\n  9,098 from 10.20.0.50 (vuln-scanner01, scheduled nightly scan)\n     14 from 10.20.6.33 (WS-HR-04), 02:40-02:43',
      question: 'How do you tune this rule without losing the detection?',
      given: [
        '99.8% of the alerts come from the vulnerability scanner, a known and scheduled source.',
        'The other 14 come from an HR workstation at 02:40: that is not expected behaviour and must still alert.',
      ],
      todo: [
        {
          prompt: 'Which tuning change is right?',
          type: 'mc',
          choices: [
            'Suppress sid 1000301 for source 10.20.0.50 only',
            'Disable sid 1000301 across the whole network',
            'Change the rule action from alert to pass',
          ],
          answer: 'Suppress sid 1000301 for source 10.20.0.50 only',
          explanation: 'A suppression scoped to one SID and one known source removes the noise but keeps the rule live for everyone else, including WS-HR-04.',
        },
        {
          prompt: 'What do you do about the 14 alerts from WS-HR-04?',
          type: 'mc',
          choices: [
            'Investigate them: share enumeration from a workstation at 02:40 is suspicious',
            'Suppress them too, since the rule is noisy anyway',
            'Ignore them because they are only 0.2% of the total',
          ],
          answer: 'Investigate them: share enumeration from a workstation at 02:40 is suspicious',
          explanation: 'Tuning exists to make exactly these alerts visible. Enumeration from an HR workstation in the middle of the night could be discovery after a compromise (T1135): check the host in EDR.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'ids-alert-blocked',
    skill: S,
    name: 'An alert means it was blocked',
    description: 'Assumes an IDS alert (or a high severity) means the traffic was stopped, or that an alert proves the attack succeeded.',
    fix: 'A passive IDS can only observe: check `alert.action` (allowed vs blocked) and where the sensor sits. An alert proves an attempt, not success or failure: read the protocol metadata (http status, bytes returned) and the host to judge the outcome. Severity sorts alerts; it never blocks anything.',
    lesson: `${S}#alerts`,
  },
  {
    id: 'ids-inline-free',
    skill: S,
    name: 'Inline blocking has no cost',
    description: 'Treats IDS and IPS as interchangeable, or deploys blocking inline everywhere without considering outages and false positives.',
    fix: 'Inline means every packet depends on the IPS: a false positive drops real traffic and a failure cuts the link unless it fails open, which then lets attacks through. Use passive sensors where visibility is the goal, and roll out blocking rules as alert-only first.',
    lesson: `${S}#placement`,
  },
  {
    id: 'ids-encrypted-blind',
    skill: S,
    name: 'Encrypted traffic is invisible',
    description: 'Believes a network sensor learns nothing from TLS/SSH sessions, or conversely that it can read encrypted payloads.',
    fix: 'Encryption hides the payload, not the metadata. Timing, byte counts, destinations, SNI, certificates and JA3/JA4 fingerprints still expose beaconing and C2, and Zeek logs every connection regardless of signatures. Payload content matches need decryption or endpoint telemetry.',
    lesson: `${S}#zeek`,
  },
  {
    id: 'ids-tune-disable',
    skill: S,
    name: 'Tune by turning it off',
    description: 'Silences a noisy signature by disabling it globally or setting it to pass, instead of narrowing it.',
    fix: 'Tune narrowly: suppress one SID for one known source, tighten the rule (direction, destination, sticky buffer, extra content) or add a threshold. Disabling the SID blinds you to the same behaviour from an attacker. Document every change and review suppressions.',
    lesson: `${S}#tuning`,
  },
  {
    id: 'ids-fields-confused',
    skill: S,
    name: 'Mixing up rule and log fields',
    description: 'Confuses sid with rev, header with options, or misreads codes such as Zeek conn_state and Suricata severity.',
    fix: 'sid is the rule\'s unique ID; rev is its revision (bump it on edits). The header (action, protocol, addresses, ports) comes before the parentheses; everything inside is options. In Zeek, S0 = SYN with no reply, REJ = rejected, SF = normal. In Suricata, severity 1 is the most urgent.',
    lesson: `${S}#rules`,
  },
];

export const IDS = { items, lesson, misconceptions };

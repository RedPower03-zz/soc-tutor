// Mock threat-intel lookup. Fictional feeds only: RFC 5737 addresses, .example names
// and invented hashes. The SIEM investigation screen calls lookupIndicator() when an
// analyst asks about an IP, domain or hash from a log row (or types one in).
// A miss is a result: "unknown" is not the same as "clean".

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const LOADER = '5b7e2c9d0a4f6e8b1c3d5f7a9b0c2e4d6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c';

/** @type {Record<string, object>} keyed by normalised indicator */
export const INTEL_RECORDS = {
  '198.51.100.77': {
    kind: 'ip',
    whois: {
      summary: 'Assigned to a small hosting network, not a household ISP.',
      fields: [
        ['Net range', '198.51.100.0/24 (documentation range, fictional allocation)'],
        ['Org', 'Northwind Relay Hosting'],
        ['ASN', 'AS64511'],
        ['Country', 'NL'],
        ['Registered', '2019-04-02'],
      ],
    },
    reputation: {
      verdict: 'malicious',
      score: 91,
      sources: 6,
      tags: ['c2', 'newly-seen'],
      note: 'Six independent feeds mark it as command-and-control in the last 9 days. Still confirm it is not shared hosting before you block the whole netblock.',
    },
    pdns: [
      { name: 'update-cdn-sync.example', first: '2026-09-21', last: '2026-09-26' },
      { name: 'sync-cdn-update.example', first: '2026-09-22', last: '2026-09-25' },
      { name: 'edge-refresh.example', first: '2026-09-18', last: '2026-09-19' },
    ],
    sandbox: { verdict: 'n/a', family: '', note: 'No file is tied to this IP alone. Look up a hash that contacted it.' },
  },
  'update-cdn-sync.example': {
    kind: 'domain',
    whois: {
      summary: 'Registered three days before the alert, privacy-protected.',
      fields: [
        ['Registrar', 'ExampleNIC'],
        ['Created', '2026-09-20'],
        ['Registrant', 'Privacy proxy (ExamplePrivacy Ltd)'],
        ['Name servers', 'ns1.bullet-dns.example, ns2.bullet-dns.example'],
      ],
    },
    reputation: {
      verdict: 'malicious',
      score: 87,
      sources: 4,
      tags: ['c2', 'newly-registered'],
      note: 'Newly registered and already on four C2 feeds. Age plus reputation is stronger than either one alone.',
    },
    pdns: [{ name: 'update-cdn-sync.example', first: '2026-09-21', last: '2026-09-26', ip: '198.51.100.77' }],
    sandbox: { verdict: 'n/a', family: '', note: 'Domains are not detonated. Look up the file hash that called this name.' },
  },
  [HASH]: {
    kind: 'hash',
    whois: { summary: 'WHOIS does not apply to a file hash.', fields: [] },
    reputation: {
      verdict: 'malicious',
      score: 96,
      sources: 3,
      tags: ['loader', 'exampleloader'],
      note: 'Known to the mock sandbox fleet as ExampleLoader. A hash hit is strong for this exact file and useless against the next build.',
    },
    pdns: [],
    sandbox: {
      verdict: 'malicious',
      family: 'ExampleLoader',
      note: 'Writes HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\EdgeRefresh. HTTPS POST /gate.php to update-cdn-sync.example (198.51.100.77) every 60s. Packed, unsigned.',
    },
  },
  '198.51.100.23': {
    kind: 'ip',
    whois: {
      summary: 'Same hosting style as other recent loader beacons.',
      fields: [
        ['Org', 'Northwind Relay Hosting'],
        ['ASN', 'AS64511'],
        ['Country', 'NL'],
      ],
    },
    reputation: {
      verdict: 'malicious',
      score: 84,
      sources: 5,
      tags: ['c2', 'loader'],
      note: 'Seen with commodity loaders this month. Do not treat the ASN as malicious by itself: confirm the address.',
    },
    pdns: [{ name: 'cdn.stats-telemetry.example', first: '2026-09-19', last: '2026-09-23' }],
    sandbox: { verdict: 'n/a', family: '', note: 'Samples that beacon here are listed under their own hashes.' },
  },
  'cdn.stats-telemetry.example': {
    kind: 'domain',
    whois: {
      summary: 'Registered this week. The name imitates a telemetry CDN.',
      fields: [
        ['Created', '2026-09-18'],
        ['Registrar', 'ExampleNIC'],
      ],
    },
    reputation: {
      verdict: 'malicious',
      score: 80,
      sources: 3,
      tags: ['c2', 'masquerade'],
      note: 'The label "cdn" is not a CDN. Passive DNS shows a single hosting IP.',
    },
    pdns: [{ name: 'cdn.stats-telemetry.example', first: '2026-09-19', last: '2026-09-23', ip: '198.51.100.23' }],
    sandbox: { verdict: 'n/a', family: '', note: 'No sample on the domain. The loader hash from the host is the one to detonate.' },
  },
  [LOADER]: {
    kind: 'hash',
    whois: { summary: 'WHOIS does not apply to a file hash.', fields: [] },
    reputation: {
      verdict: 'malicious',
      score: 93,
      sources: 4,
      tags: ['loader'],
      note: 'Matches the sandbox detonation already in the case: injection into explorer.exe and POST /gate.php.',
    },
    pdns: [],
    sandbox: {
      verdict: 'malicious',
      family: 'ExampleLoader',
      note: 'VirtualAllocEx / WriteProcessMemory / CreateRemoteThread into explorer.exe. Beacons to 198.51.100.23 /gate.php. High entropy, forged compile time.',
    },
  },
  '203.0.113.140': {
    kind: 'ip',
    whois: {
      summary: 'Small mail-sending network, first seen this week.',
      fields: [
        ['Org', 'Example Mailer Hosting'],
        ['ASN', 'AS64522'],
        ['Country', 'US'],
      ],
    },
    reputation: {
      verdict: 'suspicious',
      score: 62,
      sources: 2,
      tags: ['phish', 'new-domain-mail'],
      note: 'Tied to freshly registered lookalike domains. Not a known shared webmail platform, so blocking this address is reasonable after you confirm the campaign.',
    },
    pdns: [{ name: 'payroll.corp-example-hr.example', first: '2026-09-22', last: '2026-09-22', ip: '203.0.113.140' }],
    sandbox: { verdict: 'n/a', family: '', note: 'No file hash is linked to this address.' },
  },
  'payroll.corp-example-hr.example': {
    kind: 'domain',
    whois: {
      summary: 'Lookalike of a corporate payroll name, two days old.',
      fields: [
        ['Created', '2026-09-20'],
        ['Registrar', 'ExampleNIC'],
        ['Registrant', 'Privacy proxy'],
      ],
    },
    reputation: {
      verdict: 'malicious',
      score: 89,
      sources: 4,
      tags: ['phish', 'lookalike'],
      note: 'Brand lookalike plus brand-new registration. Authentication (SPF/DKIM) can still pass for this domain: that only proves they sent it.',
    },
    pdns: [{ name: 'payroll.corp-example-hr.example', first: '2026-09-22', last: '2026-09-22', ip: '203.0.113.140' }],
    sandbox: { verdict: 'n/a', family: '', note: 'Phishing pages are usually reviewed as URLs, not detonated as files.' },
  },
  '203.0.113.50': {
    kind: 'ip',
    whois: {
      summary: 'Now announced by a large cloud provider.',
      fields: [
        ['Org', 'Example Cloud (EC2-style pool)'],
        ['ASN', 'AS64500'],
        ['Country', 'US'],
        ['Changed', '2026-08-01 (customer reassignment)'],
      ],
    },
    reputation: {
      verdict: 'aged',
      score: 18,
      sources: 1,
      tags: ['historical', 'cloud'],
      note: 'One feed still lists a malware callback from 2024-11. The address has since been reassigned inside a cloud pool. An old hit is not a reason to block it today.',
    },
    pdns: [
      { name: 'evil-old.example', first: '2024-10-02', last: '2024-11-18' },
      { name: 'app-12.customers.example-cloud.example', first: '2026-08-04', last: '2026-09-26' },
    ],
    sandbox: { verdict: 'n/a', family: '', note: 'Nothing current detonates to this address.' },
  },
  'cdn.example.net': {
    kind: 'domain',
    whois: {
      summary: 'Long-lived content-delivery name used by many customers.',
      fields: [
        ['Created', '2014-03-11'],
        ['Org', 'Example CDN'],
      ],
    },
    reputation: {
      verdict: 'clean',
      score: 2,
      sources: 8,
      tags: ['cdn', 'shared'],
      note: 'Eight feeds agree it is shared infrastructure. A single sample calling a CDN host is not enough to block the domain.',
    },
    pdns: [{ name: 'cdn.example.net', first: '2016-01-01', last: '2026-09-26', ip: '192.0.2.10' }],
    sandbox: { verdict: 'n/a', family: '', note: 'No malicious sample is associated with the domain itself.' },
  },
  '192.0.2.10': {
    kind: 'ip',
    whois: {
      summary: 'Anycast address of Example CDN.',
      fields: [
        ['Org', 'Example CDN'],
        ['ASN', 'AS64501'],
      ],
    },
    reputation: {
      verdict: 'clean',
      score: 3,
      sources: 8,
      tags: ['cdn', 'shared'],
      note: 'Shared CDN address. Blocking it would break unrelated sites. Pivot to the URL path or the file hash instead.',
    },
    pdns: [{ name: 'cdn.example.net', first: '2016-01-01', last: '2026-09-26' }],
    sandbox: { verdict: 'n/a', family: '', note: 'No sample.' },
  },
  'invoices.northwind-billing.example': {
    kind: 'domain',
    whois: {
      summary: 'Registered yesterday. Name imitates a billing portal.',
      fields: [
        ['Created', '2026-09-25'],
        ['Registrar', 'ExampleNIC'],
      ],
    },
    reputation: {
      verdict: 'suspicious',
      score: 55,
      sources: 1,
      tags: ['newly-registered', 'lookalike'],
      note: 'One feed, low confidence. The registration date is the useful fact: treat as suspicious and pull the proxy URL, not as a confirmed C2.',
    },
    pdns: [{ name: 'invoices.northwind-billing.example', first: '2026-09-25', last: '2026-09-26', ip: '198.51.100.77' }],
    sandbox: { verdict: 'n/a', family: '', note: 'No file seen yet.' },
  },
};

const empty = (kind, indicator) => ({
  indicator,
  kind,
  hit: false,
  whois: { summary: kind === 'hash' ? 'WHOIS does not apply to a file hash.' : 'No record in the mock registry.', fields: [] },
  reputation: {
    verdict: 'unknown',
    score: null,
    sources: 0,
    tags: [],
    note: 'No feed has an opinion. Unknown is not clean: decide from the logs, and say what you could not check.',
  },
  pdns: [],
  sandbox: { verdict: 'n/a', family: '', note: 'Nothing in the mock sandbox for this indicator.' },
});

/** ip | domain | hash | '' */
export function indicatorKind(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(s) || /^[a-f0-9]{32}$/.test(s)) return 'hash';
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'ip';
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(s) && !s.endsWith('.in-addr.arpa')) return 'domain';
  return '';
}

/**
 * Look up one indicator. Always returns the four sections (WHOIS, reputation,
 * passive DNS, sandbox) so the panel can render a miss the same way as a hit.
 */
export function lookupIndicator(raw) {
  const indicator = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  const kind = indicatorKind(indicator);
  if (!kind) {
    return {
      indicator,
      kind: '',
      hit: false,
      whois: { summary: 'Not an IP, domain or hash.', fields: [] },
      reputation: { verdict: 'unknown', score: null, sources: 0, tags: [], note: 'Enter an IPv4 address, a domain, or a SHA-256 / MD5 hash.' },
      pdns: [],
      sandbox: { verdict: 'n/a', family: '', note: '' },
    };
  }
  const rec = INTEL_RECORDS[indicator];
  if (!rec) return empty(kind, indicator);
  return { indicator, kind: rec.kind, hit: true, whois: rec.whois, reputation: rec.reputation, pdns: rec.pdns, sandbox: rec.sandbox };
}

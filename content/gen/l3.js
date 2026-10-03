// Parameterised generators for Level 3 skills. Wildcard matching follows
// RFC 6125 (one left-most label, apex not covered); hash formats are the
// crypt(3) identifiers; Kerberos codes are from RFC 4120 / Windows 4768-4771.
import { mc } from './rng.js';
import { closeLen } from './util.js';

// ---------------------------------------------------------------- PKI: SAN / wildcard coverage

/** True when `host` is covered by the SAN entry `name` (RFC 6125 wildcard rules). */
export function sanCovers(name, host) {
  const n = name.toLowerCase();
  const h = host.toLowerCase();
  if (!n.startsWith('*.')) return n === h;
  const suffix = n.slice(1); // ".shop.example"
  if (!h.endsWith(suffix)) return false;
  const label = h.slice(0, -suffix.length);
  return label.length > 0 && !label.includes('.');
}

const pkiSan = {
  id: 'pki-san',
  skill: 'l3-pki',
  count: 18,
  bloom: 'apply',
  make(r) {
    const d = r.pick(['shop.example', 'portal.example', 'corp.example', 'pay.example']);
    const sans = r.pick([[`*.${d}`], [`*.${d}`, d], [`www.${d}`, d], [`*.api.${d}`, `www.${d}`]]);
    const cn = `legacy.${d}`;
    const cands = [
      `www.${d}`, d, `a.b.${d}`, `mail.${d}`, `v2.api.${d}`, `api.${d}`, `x.v2.api.${d}`, `${d.split('.')[0]}-login.example`, `www.${d}.evil.example`, cn,
    ];
    const covered = cands.filter((h) => sans.some((s) => sanCovers(s, h)));
    const notCovered = cands.filter((h) => !sans.some((s) => sanCovers(s, h)));
    const answer = r.pick(covered);
    const ds = r.shuffle(notCovered).sort((a, b) => (b === cn ? 1 : 0) - (a === cn ? 1 : 0)).map((h) => ({ text: h, mis: h === cn ? 'pki-cn-vs-san' : undefined }));
    return {
      difficulty: 3,
      ...mc(r, answer, ds),
      prompt: 'A certificate has the fields below. For which hostname will a modern browser accept it (name check only)?',
      snippet: `Subject: CN=${cn}\nX509v3 Subject Alternative Name:\n    ${sans.map((s) => `DNS:${s}`).join(', ')}`,
      explanation: `Browsers match only the SAN list (the CN is ignored when a SAN is present). A wildcard covers exactly one left-most label: *.${d} matches www.${d} but not ${d} itself or a.b.${d}. **${answer}** is covered by ${sans.find((s) => sanCovers(s, answer))}; the other names are not in the SAN list.`,
    };
  },
};

// ---------------------------------------------------------------- crypto: decoding

export function utf16leBase64(s) {
  let bin = '';
  for (const ch of s) bin += String.fromCharCode(ch.charCodeAt(0) & 255, ch.charCodeAt(0) >> 8);
  return btoa(bin);
}

const CMDS = ['whoami', 'hostname', 'ipconfig /all', 'net user', 'systeminfo', 'tasklist', 'klist', 'nltest /dclist'];

const b64Decode = {
  id: 'b64-decode',
  skill: 'l3-crypto',
  count: 8,
  bloom: 'apply',
  make(r) {
    const cmd = r.cycle(CMDS);
    const wide = r.chance(0.5);
    const enc = wide ? utf16leBase64(cmd) : btoa(cmd);
    return {
      difficulty: wide ? 3 : 2,
      type: 'text',
      prompt: wide
        ? 'A process ran `powershell.exe -EncodedCommand` with the value below. What command does it decode to? (PowerShell encodes UTF-16LE before Base64)'
        : 'A script contains this Base64 value. What does it decode to?',
      snippet: enc,
      accept: [cmd],
      misconceptions: { 'aes encrypted': 'crypto-encoding-is-encryption', encrypted: 'crypto-encoding-is-encryption' },
      explanation: `Base64 is an encoding, not encryption: anyone can reverse it (CyberChef "From Base64", or \`[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String(...))\`). ${wide ? 'The telltale "A" after every other character (e.g. dwBoAG8A...) comes from UTF-16LE: each ASCII letter is followed by a zero byte. ' : ''}It decodes to **${cmd}**.`,
    };
  },
};

function toHex(s) { return [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); }
function rot13(s) { return s.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + (c === c.toLowerCase() ? 97 : 65))); }

const ENCODINGS = {
  b64: 'Base64',
  hex: 'Hexadecimal',
  url: 'URL (percent) encoding',
  rot: 'ROT13',
};

const encodingId = {
  id: 'encoding-id',
  skill: 'l3-crypto',
  count: 6,
  bloom: 'analyze',
  make(r) {
    const kind = r.cycle(['b64', 'hex', 'url', 'rot', 'b64', 'url']);
    const plain = r.pick(['cmd.exe /c whoami', 'user=admin&pass=Winter2026!', 'powershell -nop -w hidden', 'http://203.0.113.7/p.ps1']);
    const val = kind === 'b64' ? btoa(plain) : kind === 'hex' ? toHex(plain) : kind === 'url' ? plain.replace(/[^A-Za-z0-9]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`) : rot13(plain);
    const answer = ENCODINGS[kind];
    const ds = [...Object.entries(ENCODINGS).filter(([k]) => k !== kind).map(([, v]) => v), { text: 'AES ciphertext', mis: 'crypto-encoding-is-encryption' }];
    const tell = {
      b64: 'only A–Z, a–z, 0–9, + and /, often ending in = padding',
      hex: 'only 0–9 and a–f, two characters per byte',
      url: '%XX escapes for spaces and symbols while letters stay readable',
      rot: 'letters shifted but spaces, digits and punctuation untouched',
    }[kind];
    return {
      difficulty: 2,
      ...mc(r, answer, r.shuffle(ds)),
      prompt: 'A proxy log field contains the value below. Which transformation was applied?',
      snippet: val,
      explanation: `Tells: ${tell} → **${answer}**. All four are reversible encodings with no key; real ciphertext (e.g. AES) looks like random bytes and is usually carried as Base64 or hex, so "it looks scrambled" never means "it is encrypted".`,
    };
  },
};

const B64ALPHA = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const HASHFMT = [
  ['$1$', 'md5crypt (legacy MD5 scheme)', (s, h) => `$1$${s(8)}$${h(22)}`],
  ['$5$', 'sha256crypt (SHA-256 based)', (s, h) => `$5$${s(16)}$${h(43)}`],
  ['$6$', 'sha512crypt (SHA-512 based)', (s, h) => `$6$${s(16)}$${h(86)}`],
  ['$2b$', 'bcrypt (Blowfish-based KDF)', (s, h) => `$2b$12$${s(22)}${h(31)}`],
  ['$y$', 'yescrypt (scrypt-family KDF)', (s, h) => `$y$j9T$${s(16)}$${h(43)}`],
];

const hashFormat = {
  id: 'hash-format',
  skill: 'l3-crypto',
  count: 5,
  bloom: 'understand',
  make(r) {
    const [prefix, name, build] = r.cycle(HASHFMT);
    const rnd = (n) => Array.from({ length: n }, () => B64ALPHA[r.int(0, 63)]).join('');
    const user = r.pick(['deploy', 'backup', 'j.alvarez', 'svc_web']);
    return {
      difficulty: 2,
      ...mc(r, name, closeLen(r, name, HASHFMT.map((x) => x[1]).filter((x) => x !== name), 3)),
      prompt: `This line was found in a leaked /etc/shadow. Which password-hashing scheme does the ${prefix} prefix indicate?`,
      snippet: `${user}:${build(rnd, rnd)}:20356:0:99999:7:::`,
      explanation: `crypt(3) prefixes name the scheme: $1$ md5crypt, $5$ sha256crypt, $6$ sha512crypt, $2b$ bcrypt, $y$ yescrypt (the default on current Debian, Ubuntu and Fedora). **${prefix}** = ${name}. Slow, salted schemes (bcrypt, yescrypt) are far harder to crack offline than md5crypt.`,
    };
  },
};

// ---------------------------------------------------------------- identity: Kerberos codes

export const KRB_FAIL = [
  ['0x18', 'Wrong password (pre-authentication failed)'],
  ['0x6', 'Unknown username (principal not found)'],
  ['0x12', 'Account disabled, expired or locked out'],
  ['0x17', 'Password has expired'],
  ['0x25', 'Clock skew too great between client and DC'],
];
export const ETYPES = [
  ['0x17', 'RC4-HMAC (legacy; Kerberoasting favourite)'],
  ['0x12', 'AES256-CTS-HMAC-SHA1-96 (modern default)'],
  ['0x11', 'AES128-CTS-HMAC-SHA1-96'],
];

const krbFail = {
  id: 'krb-fail',
  skill: 'l3-identity',
  count: 10,
  bloom: 'understand',
  make(r) {
    const [code, meaning] = r.cycle(KRB_FAIL);
    const ev = code === '0x18' ? r.pick([4771, 4771, 4768]) : code === '0x6' ? 4768 : r.pick([4768, 4771]);
    return {
      difficulty: 2,
      ...mc(r, meaning, KRB_FAIL.map((k) => k[1]).filter((m) => m !== meaning)),
      prompt: `A domain controller logged event ${ev} with the result code below. What does it mean?`,
      snippet: `EventID: ${ev}   Computer: DC01.corp.example\nAccount Name: ${r.pick(['m.fischer', 'svc_sql', 'r.ahmed', 'administrator'])}   Client Address: ::ffff:10.20.${r.int(1, 60)}.${r.int(2, 254)}\n${ev === 4771 ? 'Failure Code' : 'Result Code'}: ${code}`,
      explanation: `Kerberos error **${code}** = ${meaning.toLowerCase()}. Useful triage split: many 0x18 across many accounts from one client = password spraying; many 0x6 = username enumeration; 0x25 is a time-sync problem, not an attack.`,
    };
  },
};

const krbEtype = {
  id: 'krb-etype',
  skill: 'l3-identity',
  count: 8,
  bloom: 'analyze',
  make(r) {
    const [code, meaning] = r.cycle(ETYPES);
    const svc = r.pick(['MSSQLSvc/sql01.corp.example:1433', 'HTTP/intranet.corp.example', 'CIFS/fs02.corp.example']);
    const ds = [...ETYPES.filter((e) => e[0] !== code).map((e) => e[1]), 'DES-CBC-MD5 (disabled by default)'];
    return {
      difficulty: 3,
      ...mc(r, meaning, ds),
      prompt: 'A 4769 service-ticket event shows the encryption type below. What is it?',
      snippet: `EventID: 4769   Service Name: ${svc}\nTicket Encryption Type: ${code}   Failure Code: 0x0`,
      explanation: `Ticket encryption type **${code}** = ${meaning}. In an AES-only domain, a burst of 4769 events with 0x17 (RC4) for many service accounts from one user is the classic Kerberoasting signal (T1558.003): RC4 tickets are much faster to crack offline.`,
    };
  },
};

// ---------------------------------------------------------------- cloud: CloudTrail

export const TRAIL = [
  ['GetCallerIdentity', 'Asks "who am I?" for the calling credentials'],
  ['CreateAccessKey', 'Creates a new long-term access key for a user'],
  ['AttachUserPolicy', 'Attaches a managed permissions policy to a user'],
  ['StopLogging', 'Pauses a CloudTrail trail from recording'],
  ['PutBucketPolicy', 'Replaces the access policy on an S3 bucket'],
  ['AssumeRole', 'Gets temporary credentials for an IAM role'],
  ['CreateUser', 'Creates a new IAM user in the account'],
  ['ConsoleLogin', 'Records a sign-in to the AWS web console'],
];

const cloudTrail = {
  id: 'cloudtrail-event',
  skill: 'l3-cloud',
  count: 14,
  bloom: 'understand',
  make(r) {
    const [name, meaning] = r.cycle(TRAIL);
    const src = { StopLogging: 'cloudtrail', PutBucketPolicy: 's3', AssumeRole: 'sts', GetCallerIdentity: 'sts', ConsoleLogin: 'signin' }[name] || 'iam';
    return {
      difficulty: 2,
      ...mc(r, meaning, closeLen(r, meaning, TRAIL.map((t) => t[1]).filter((m) => m !== meaning), 3)),
      prompt: 'What does this CloudTrail event record?',
      snippet: `{"eventSource": "${src}.amazonaws.com", "eventName": "${name}",\n "sourceIPAddress": "198.51.100.${r.int(2, 254)}", "userIdentity": {"type": "IAMUser", "userName": "${r.pick(['ci-deploy', 'j.kim', 'backup-bot'])}"}}`,
      explanation: `**${name}** (${src}.amazonaws.com): ${meaning.charAt(0).toLowerCase()}${meaning.slice(1)}. ${name === 'StopLogging' ? 'Stopping a trail is defense impairment (ATT&CK v19 T1685.002) and should page someone.' : name === 'GetCallerIdentity' ? 'It is often the very first call an attacker makes with a stolen key.' : name === 'CreateAccessKey' || name === 'CreateUser' ? 'A new credential or user created by an unusual principal is a persistence signal.' : 'Read eventName together with who called it and from where.'}`,
    };
  },
};

const keyPrefix = {
  id: 'aws-key-prefix',
  skill: 'l3-cloud',
  count: 4,
  bloom: 'understand',
  make(r) {
    const temp = r.cycle([false, true]);
    const id = `${temp ? 'ASIA' : 'AKIA'}${Array.from({ length: 16 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[r.int(0, 31)]).join('')}`;
    const answer = temp ? 'Temporary STS credentials (session token needed)' : 'A long-term access key of an IAM user';
    return {
      difficulty: 2,
      ...mc(r, answer, [
        temp ? 'A long-term access key of an IAM user' : 'Temporary STS credentials (session token needed)',
        { text: 'The account root user password hash', mis: 'cloud-keys-like-passwords' },
        'An encrypted S3 object key (not a credential)',
      ]),
      prompt: 'A developer pasted this AWS access key ID in a public repo. What kind of credential is it?',
      snippet: `aws_access_key_id = ${id}`,
      explanation: `The prefix tells you: **AKIA** = long-term IAM user access key (valid until someone deactivates it), **ASIA** = temporary STS credentials that expire and need a session token. ${temp ? 'This one expires on its own, but still revoke the role session and find out how it leaked.' : 'This one never expires on its own: deactivate it immediately, then check CloudTrail for its use.'}`,
    };
  },
};

// ---------------------------------------------------------------- forensics: order of volatility (RFC 3227)

export const VOLATILITY = [
  [1, 'CPU registers and cache'],
  [2, 'RAM: running processes and network connections'],
  [2, 'ARP cache and routing table'],
  [3, 'Temporary file systems (e.g. /tmp on tmpfs)'],
  [4, 'The disk: files, $MFT and event logs'],
  [5, 'Remote logs already in the SIEM'],
  [7, 'Backup tapes and archival media'],
];

const volatility = {
  id: 'volatility-order',
  skill: 'l3-forensics',
  count: 12,
  bloom: 'evaluate',
  make(r) {
    let set;
    do set = r.sample(VOLATILITY.slice(1), 4);
    while (set.filter((v) => v[0] === Math.min(...set.map((x) => x[0]))).length > 1);
    const first = set.reduce((a, b) => (b[0] < a[0] ? b : a));
    return {
      difficulty: 2,
      ...mc(r, first[1], set.filter((v) => v !== first).map((v) => ({ text: v[1], mis: 'for-volatility-order' }))),
      prompt: 'You are first on scene at a live, compromised server. Following RFC 3227, which of these do you collect **first**?',
      explanation: `RFC 3227 says collect from most to least volatile: registers/cache → memory, ARP/routing tables and process lists → temporary file systems → disk → remote logging data → physical configuration → archival media. Of these, **${first[1]}** disappears soonest, so it comes first.`,
    };
  },
};

const timezone = {
  id: 'tz-convert',
  skill: 'l3-forensics',
  count: 10,
  bloom: 'apply',
  make(r) {
    const off = r.pick([-7, -5, -4, 1, 2, 3, 5.5, 9]);
    const h = r.int(0, 23);
    const m = r.pick([0, 5, 12, 17, 30, 41, 48]);
    const local = h * 60 + m;
    const utc = (((local - off * 60) % 1440) + 1440) % 1440;
    const wrong = (((local + off * 60) % 1440) + 1440) % 1440;
    const f = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    const sign = off < 0 ? '-' : '+';
    const abs = Math.abs(off);
    const offStr = `${sign}${String(Math.floor(abs)).padStart(2, '0')}:${abs % 1 ? '30' : '00'}`;
    return {
      difficulty: 2,
      ...mc(r, `${f(utc)} UTC`, [
        `${f(wrong)} UTC`,
        `${f(local)} UTC`,
        `${f((utc + 60) % 1440)} UTC`,
        `${f((utc + 1380) % 1440)} UTC`,
      ]),
      prompt: `A host's local log shows an event at **${f(local)} (UTC${offStr})**. To put it on your UTC timeline, what time do you write down (ignore the date)?`,
      explanation: `UTC = local time − offset. ${f(local)} − (${offStr}) = **${f(utc)} UTC**. Adding the offset instead of subtracting it (${f(wrong)}) is the classic mistake that reorders a whole timeline; normalise every source to UTC before you correlate.`,
    };
  },
};

// ---------------------------------------------------------------- detection: precision / recall

const metrics = {
  id: 'det-metrics',
  skill: 'l3-detection',
  count: 18,
  bloom: 'apply',
  make(r) {
    const askPrecision = r.cycle([true, false]);
    const p = r.pick([20, 25, 40, 50, 60, 75, 80, 90]);
    const q = r.pick([50, 60, 75, 80, 90]);
    const tp = r.pick([12, 24, 36, 48, 60]) ; // divisible so both ratios are whole numbers
    const alerts = (tp * 100) / p;
    const real = (tp * 100) / q;
    if (!Number.isInteger(alerts) || !Number.isInteger(real)) return metrics.make(r);
    const fp = alerts - tp;
    const fn = real - tp;
    const val = askPrecision ? p : q;
    return {
      difficulty: 3,
      type: 'text',
      prompt: `Over a month a new rule fired **${alerts}** times. Triage found **${tp}** true positives and **${fp}** false positives, and a purple-team review found **${fn}** real attacks it missed. What is the rule's **${askPrecision ? 'precision' : 'recall'}**, in percent? (number)`,
      accept: [String(val), `${val}%`, String(val / 100), `${(val / 100).toFixed(2)}`],
      ...(p !== q ? { misconceptions: { [String(askPrecision ? q : p)]: 'det-more-alerts-better' } } : {}),
      explanation: `Precision = TP / (TP + FP) = ${tp} / ${alerts} = ${p}% (how much of what fires is real). Recall = TP / (TP + FN) = ${tp} / ${real} = ${q}% (how much of the real activity it catches). The ${askPrecision ? 'precision' : 'recall'} is **${val}%**. Tuning trades one against the other; neither "more alerts" nor "fewer alerts" is good on its own.`,
    };
  },
};

export default [pkiSan, b64Decode, encodingId, hashFormat, krbFail, krbEtype, cloudTrail, keyPrefix, volatility, timezone, metrics];

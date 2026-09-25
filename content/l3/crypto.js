// Level 3 · Applied cryptography: questions, lesson and misconceptions.
// Encoding vs hashing vs encryption, symmetric vs asymmetric, password storage (bcrypt/scrypt/Argon2,
// OWASP Password Storage Cheat Sheet), deprecated algorithms, and hybrid encryption in ransomware.

const items = [
  {
    id: 'cry-01',
    skill: 'l3-crypto',
    difficulty: 1,
    type: 'mc',
    prompt: 'A PowerShell command line contains `-enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA...`. What protects this payload from the analyst?',
    choices: [
      'Nothing: it is only Base64 (UTF-16LE)',
      'AES-256 encryption with a hidden key',
      'A one-way hash that cannot be reversed',
      'A digital signature from the author',
    ],
    answer: 'Nothing: it is only Base64 (UTF-16LE)',
    misconceptions: {
      'AES-256 encryption with a hidden key': 'crypto-encoding-is-encryption',
    },
    explanation:
      '`-EncodedCommand` takes Base64 of UTF-16LE text. Encoding changes representation, not secrecy: decode it (CyberChef "From Base64" then "Decode text UTF-16LE") and you get `IEX (New-Object ...`. Attackers use it to dodge naive string matching, not to hide from analysts.',
  },
  {
    id: 'cry-02',
    skill: 'l3-crypto',
    difficulty: 1,
    type: 'text',
    prompt: 'Encoding, hashing or encryption: which one needs a key to reverse? (one word)',
    accept: ['encryption', 'encrypting', 'encrypt'],
    misconceptions: { encoding: 'crypto-encoding-is-encryption', hashing: 'crypto-hash-reversible' },
    explanation:
      '**Encoding** (Base64, hex, URL encoding) is reversible by anyone. **Hashing** (SHA-256) is one-way: there is no key and nothing to reverse, you can only guess inputs and compare. **Encryption** (AES, RSA) is reversible only with the right key.',
  },
  {
    id: 'cry-03',
    skill: 'l3-crypto',
    difficulty: 1,
    type: 'mc',
    prompt: 'Two parties need to encrypt gigabytes of data quickly. Which kind of algorithm does the bulk encryption in TLS, VPNs and disk encryption?',
    choices: [
      'Symmetric ciphers such as AES-GCM',
      'Asymmetric RSA for every single byte',
      'A hash function such as SHA-256',
      'Base64 encoding of the data stream',
    ],
    answer: 'Symmetric ciphers such as AES-GCM',
    misconceptions: {
      'Asymmetric RSA for every single byte': 'crypto-symmetric-asymmetric',
      'Base64 encoding of the data stream': 'crypto-encoding-is-encryption',
    },
    explanation:
      'Symmetric ciphers are orders of magnitude faster than RSA or ECC. Protocols use asymmetric crypto only to agree on or protect a symmetric key (key exchange, signatures), then encrypt the data symmetrically. That combination is called hybrid encryption.',
  },
  {
    id: 'cry-04',
    skill: 'l3-crypto',
    difficulty: 2,
    type: 'mc',
    prompt: 'A breach notice says "passwords were stored as unsalted MD5". Why is that bad even though MD5 is a one-way hash?',
    choices: [
      'MD5 is fast to guess; no salt lets precomputed tables work',
      'MD5 hashes can be decrypted by anyone who has the MD5 key',
      'MD5 is actually encryption, not hashing, so it is reversible',
      'It is not bad at all: hashes can never be reversed or cracked',
    ],
    answer: 'MD5 is fast to guess; no salt lets precomputed tables work',
    misconceptions: {
      'MD5 hashes can be decrypted by anyone who has the MD5 key': 'crypto-hash-reversible',
      'It is not bad at all: hashes can never be reversed or cracked': 'crypto-hash-reversible',
    },
    explanation:
      'Nobody "decrypts" a hash: they guess candidates, hash them and compare. General-purpose hashes are designed to be fast, which helps the attacker. Password storage needs a unique **salt** per user and a deliberately slow, memory-hard function: **Argon2id**, scrypt or bcrypt (OWASP Password Storage Cheat Sheet).',
  },
  {
    id: 'cry-05',
    skill: 'l3-crypto',
    difficulty: 2,
    type: 'multi',
    prompt: 'A configuration review finds these algorithms. Which should be flagged as deprecated or broken for new use? (select all)',
    choices: ['MD5 for signatures', 'SHA-1 for certificates', 'RC4 cipher suites', '3DES', 'AES-256-GCM', 'SHA-256', 'Argon2id for passwords'],
    answer: ['MD5 for signatures', 'SHA-1 for certificates', 'RC4 cipher suites', '3DES'],
    explanation:
      'MD5 and SHA-1 have practical collisions (the SHAttered attack in 2017 produced two different PDFs with the same SHA-1), RC4 has keystream biases and is banned in TLS (RFC 7465), and 3DES has a 64-bit block (Sweet32) and was withdrawn by NIST. AES-GCM, SHA-256 and Argon2id are current recommendations.',
  },
  {
    id: 'cry-06',
    skill: 'l3-crypto',
    difficulty: 2,
    type: 'mc',
    prompt: 'Alice wants to send Bob a secret using public-key encryption. Which key does she encrypt with?',
    choices: ['Bob\'s public key', 'Bob\'s private key', 'Alice\'s private key', 'Alice\'s public key'],
    answer: 'Bob\'s public key',
    misconceptions: { 'Bob\'s private key': 'crypto-symmetric-asymmetric', 'Alice\'s private key': 'crypto-symmetric-asymmetric' },
    explanation:
      'Encrypt with the **recipient\'s public key**; only the matching private key decrypts. Signing is the reverse: the sender signs with **her own private key** and anyone verifies with her public key. Private keys never leave their owner.',
  },
  {
    id: 'cry-07',
    skill: 'l3-crypto',
    difficulty: 1,
    type: 'text',
    prompt: 'You hash a file and get a 64-character hex string. Which hash algorithm is it most likely? (e.g. MD5, SHA-1, SHA-256)',
    accept: ['sha-256', 'sha256', 'sha 256', 'sha2-256'],
    misconceptions: { md5: 'crypto-hash-reversible', 'sha-1': 'crypto-hash-reversible', sha1: 'crypto-hash-reversible' },
    explanation:
      'Hex length = bits ÷ 4. MD5 is 128 bits (32 hex characters), SHA-1 160 bits (40), **SHA-256 256 bits (64)**, SHA-512 128 characters. Hash lengths are fixed no matter how big the input is, which is one way to tell a hash from encoded data.',
  },
  {
    id: 'cry-08',
    skill: 'l3-crypto',
    difficulty: 3,
    type: 'mc',
    prompt: 'The ransom note says files were encrypted with "AES-256 + RSA-4096". The EDR logs show the malware generated a random AES key per file and encrypted each key with an embedded RSA public key. What follows for recovery?',
    snippet:
      'ransom note (excerpt):\n  Your files are encrypted with AES-256 + RSA-4096.\n  Without our private key recovery is impossible.\nsample strings:\n  -----BEGIN PUBLIC KEY-----\n  MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA...',
    choices: [
      'Only the attacker\'s RSA private key decrypts; restore from backups',
      'Extract the public key from the sample and use it to decrypt files',
      'Brute-force the AES-256 keys on a GPU cluster over a weekend',
      'Hash the encrypted files to get the original contents back',
    ],
    answer: 'Only the attacker\'s RSA private key decrypts; restore from backups',
    misconceptions: {
      'Extract the public key from the sample and use it to decrypt files': 'crypto-symmetric-asymmetric',
      'Hash the encrypted files to get the original contents back': 'crypto-hash-reversible',
    },
    explanation:
      'This is hybrid encryption: fast symmetric encryption per file, and each file key wrapped with the attacker\'s public key. The public key can only encrypt. AES-256 cannot be brute-forced. Real recoveries come from backups, volume shadow copies the malware missed, memory captured before reboot, or flaws that researchers publish as free decryptors.',
  },
  {
    id: 'cry-09',
    skill: 'l3-crypto',
    difficulty: 2,
    type: 'mc',
    prompt: 'Which statement about a **digital signature** on a downloaded installer is correct?',
    choices: [
      'Who signed it and that it\'s unchanged, not that it\'s safe',
      'It proves the installer was scanned and contains no malware at all',
      'It encrypts the installer for you alone',
      'It is just a SHA-256 hash of the file published by the vendor',
    ],
    answer: 'Who signed it and that it\'s unchanged, not that it\'s safe',
    misconceptions: {
      'It is just a SHA-256 hash of the file published by the vendor': 'crypto-hash-reversible',
    },
    explanation:
      'A signature is a hash of the file signed with the publisher\'s private key: integrity plus origin. Attackers steal code-signing certificates or buy their own, and signed malware is common. Check who signed, whether the certificate is revoked, and whether that signer normally ships this file.',
  },
  {
    id: 'cry-10',
    skill: 'l3-crypto',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which observations suggest a process is **encrypting** files (ransomware) rather than just reading them? (select all)',
    choices: [
      'Rewritten files have near-maximum entropy (about 8 bits per byte)',
      'Hundreds of files per minute renamed with a new extension',
      'vssadmin delete shadows /all /quiet shortly before',
      'The files still open normally in Word',
      'The process only reads each file once and writes nothing',
    ],
    answer: [
      'Rewritten files have near-maximum entropy (about 8 bits per byte)',
      'Hundreds of files per minute renamed with a new extension',
      'vssadmin delete shadows /all /quiet shortly before',
    ],
    explanation:
      'Good ciphertext looks random, so entropy jumps to about 8 bits per byte (compressed files are also high, so combine signals). Mass rename/rewrite plus shadow copy deletion (ATT&CK T1490, Inhibit System Recovery) before T1486 (Data Encrypted for Impact) is the classic ransomware sequence.',
  },
  {
    id: 'cry-11',
    skill: 'l3-crypto',
    difficulty: 2,
    type: 'mc',
    prompt: 'What does **forward secrecy** (ECDHE key exchange in TLS) protect against?',
    choices: [
      'A stolen server key decrypting past recordings',
      'Phishing sites that obtained valid, trusted certificates',
      'Malware running on the client that reads browser memory',
      'Users choosing weak passwords that can be guessed online',
    ],
    answer: 'A stolen server key decrypting past recordings',
    misconceptions: {
      'Phishing sites that obtained valid, trusted certificates': 'crypto-symmetric-asymmetric',
    },
    explanation:
      'With ephemeral (EC)DHE every session derives a fresh key that is thrown away; the certificate key only signs the handshake. Old RSA key transport let anyone holding the server key decrypt recorded traffic. TLS 1.3 requires forward-secret key exchange, which is also why passive decryption with a server key no longer works.',
  },
  {
    id: 'cry-12',
    skill: 'l3-crypto',
    difficulty: 3,
    type: 'text',
    prompt: 'Which OWASP-recommended, memory-hard password hashing algorithm won the 2015 Password Hashing Competition? (name with variant is fine)',
    accept: ['argon2', 'argon2id', 'argon 2', 'argon2i', 'argon2d'],
    misconceptions: { sha256: 'crypto-hash-reversible', 'sha-256': 'crypto-hash-reversible', md5: 'crypto-hash-reversible' },
    explanation:
      '**Argon2** (use the Argon2id variant) is memory-hard, which blunts GPU cracking. OWASP lists Argon2id first, then scrypt, then bcrypt (and PBKDF2 where FIPS compliance requires it). Plain SHA-256 is far too fast for passwords, even salted.',
  },
];

const lesson = {
  skill: 'l3-crypto',
  title: 'Applied cryptography',
  goal: 'Tell encoding, hashing and encryption apart, know which algorithm does what, and reason about ransomware and password leaks.',
  sections: [
    {
      id: 'three',
      heading: 'Encoding, hashing, encryption',
      body: ['Analysts meet all three every day, and mixing them up leads to wrong conclusions:'],
      points: [
        '**Encoding** (Base64, hex, URL encoding) changes representation. No key; anyone reverses it. PowerShell `-enc` is Base64 of UTF-16LE.',
        '**Hashing** (SHA-256) maps any input to a fixed-length fingerprint. One-way: you cannot "decrypt" a hash, only guess inputs and compare. Used for file identity (IOCs), integrity and password storage.',
        '**Encryption** (AES, ChaCha20, RSA) hides content and is reversible only with the key.',
      ],
      evidence: { label: 'Lengths give it away', text: 'MD5     32 hex chars  (128 bits)\nSHA-1   40 hex chars  (160 bits)\nSHA-256 64 hex chars  (256 bits)\nBase64  length grows with input, often ends in = or ==' },
    },
    {
      id: 'sym-asym',
      heading: 'Symmetric and asymmetric',
      body: [
        '**Symmetric** ciphers (AES-GCM, ChaCha20-Poly1305) use one shared key and are fast: they encrypt the actual data in TLS, VPNs and disk encryption.',
        '**Asymmetric** crypto (RSA, elliptic curves) uses a key pair. Encrypt with the recipient\'s **public** key; only the **private** key decrypts. Sign with your **private** key; anyone verifies with your public key.',
        'Real systems are **hybrid**: asymmetric crypto agrees on or wraps a symmetric key, and the symmetric key does the bulk work. TLS 1.3 uses ephemeral ECDHE for **forward secrecy**, so stealing the server key later does not decrypt recorded sessions.',
      ],
    },
    {
      id: 'passwords',
      heading: 'Passwords and weak algorithms',
      body: [
        'Passwords must be stored with a unique **salt** and a deliberately slow function: **Argon2id**, scrypt or bcrypt. Fast hashes (MD5, SHA-1, even SHA-256) let attackers try billions of guesses per second.',
        'Deprecated for new use: **MD5** and **SHA-1** for signatures (practical collisions), **RC4** (banned in TLS), **DES/3DES**. Seeing them in a config or Kerberos log (RC4 tickets) is a finding.',
      ],
    },
    {
      id: 'attackers',
      heading: 'What attackers do with crypto',
      body: [
        '**Ransomware** uses hybrid encryption: a random symmetric key per file (or per victim), wrapped with the attacker\'s RSA or ECC **public** key embedded in the sample. Having the sample and its public key does not let you decrypt; only the attacker\'s private key does. Recovery comes from offline backups, shadow copies the malware missed, memory captured before reboot, or free decryptors when the attacker made a mistake (No More Ransom).',
        'Watch for the sequence: shadow copy deletion (T1490), mass rename with high-entropy content, then the note (T1486). Attackers also encrypt C2 traffic, sign malware with stolen certificates, and encode payloads in Base64 to evade simple string matching.',
      ],
    },
  ],
  worked: [
    {
      id: 'cry-w1',
      title: 'What is this string?',
      artifactLabel: 'Three strings from an investigation',
      artifact:
        'A: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8\nB: aHR0cHM6Ly9jZG4tdXBkYXRlLmV4YW1wbGUvc3RhZ2Uy\nC: $argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$...',
      question: 'Which is a hash, which is encoding, and which is a proper password hash?',
      steps: [
        'A is 64 hex characters: a SHA-256 hash. It is in fact SHA-256("password"), which is why unsalted fast hashes fall to lookup tables immediately.',
        'B uses the Base64 alphabet with a length that is not a fixed hash size. Decoding it gives `https://cdn-update.example/stage2`: encoding, readable by anyone.',
        'C is a PHC-format Argon2id string: algorithm, version, memory (64 MiB), iterations and parallelism, a salt, then the hash.',
        'For the report: B is an IOC to decode and block; A shows weak password storage if it came from a database; C is what good storage looks like.',
      ],
      conclusion: 'Fixed-length hex means a hash; Base64 alphabets mean decode it; a slow, salted algorithm string means proper password storage.',
    },
  ],
  faded: [
    {
      id: 'cry-f1',
      title: 'Can we decrypt it ourselves?',
      artifactLabel: 'Ransomware triage notes',
      artifact:
        'Host FS-02 rebooted by an admin after the ransom note appeared.\nSample recovered: embedded RSA-4096 public key; per-file AES-256 keys.\nvssadmin delete shadows /all /quiet ran at 02:41.\nOffline backup from 23:00 the previous night exists.',
      question: 'What are the realistic recovery options?',
      given: ['Per-file symmetric keys wrapped with the attacker\'s public key: hybrid encryption.'],
      todo: [
        {
          prompt: 'Can the embedded public key decrypt the files?',
          type: 'mc',
          choices: ['No: a public key only encrypts; the private key stays with the attacker', 'Yes: public keys work both ways', 'Yes, after brute-forcing AES'],
          answer: 'No: a public key only encrypts; the private key stays with the attacker',
          explanation: 'That is exactly why ransomware embeds only the public key. Brute-forcing AES-256 is infeasible.',
        },
        {
          prompt: 'What is the best recovery source here?',
          type: 'mc',
          choices: ['The offline backup from 23:00, restored after the attacker is evicted', 'Shadow copies', 'Memory of FS-02'],
          answer: 'The offline backup from 23:00, restored after the attacker is evicted',
          explanation: 'Shadow copies were deleted and the reboot wiped memory. Restore from the offline backup, but only once the entry point and the attacker\'s access are gone.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'crypto-encoding-is-encryption',
    skill: 'l3-crypto',
    name: 'Encoding mistaken for encryption',
    description: 'Thinks Base64 or hex hides content, or calls an encoded payload "encrypted".',
    fix: 'Encoding such as Base64, hex or URL encoding changes representation only and needs no key, so anyone can reverse it (CyberChef, base64 -d). Encoded PowerShell and URLs are there to dodge naive string matching. Decode them and treat the result as evidence; only encryption needs a key.',
    lesson: 'l3-crypto#three',
  },
  {
    id: 'crypto-hash-reversible',
    skill: 'l3-crypto',
    name: 'Hashes can be decrypted',
    description: 'Believes a hash can be "decrypted" or reversed, or that any hash is fine for passwords.',
    fix: 'A hash is one-way with no key. "Cracking" means guessing inputs, hashing them and comparing, which is fast for MD5, SHA-1 and SHA-256. That is why passwords need a unique salt and a slow, memory-hard function (Argon2id, scrypt, bcrypt), and why hash length tells you the algorithm, not the content.',
    lesson: 'l3-crypto#three',
  },
  {
    id: 'crypto-symmetric-asymmetric',
    skill: 'l3-crypto',
    name: 'Mixing up key types',
    description: 'Confuses public and private keys, or thinks RSA encrypts bulk data or that a public key can decrypt.',
    fix: 'Symmetric ciphers (AES, ChaCha20) share one key and encrypt the data. Asymmetric pairs: encrypt with the recipient\'s public key, decrypt with their private key; sign with your private key, verify with the public key. Ransomware embeds only the public key, so the sample cannot decrypt the files.',
    lesson: 'l3-crypto#sym-asym',
  },
];

export const CRYPTO = { items, lesson, misconceptions };

// Level 3 · Advanced: skill definitions.
//
// content/index.js merges these over the Level 3 roadmap entries in content/skills.js (same ids,
// so the career gates in content/career.js keep working). Prerequisites point at Level 1 and
// Level 2 skills, so each advanced topic opens once the ground it builds on is mastered.

export const L3_TRACK = {
  id: 'advanced',
  name: 'Advanced (Level 3)',
  description: 'Specialist depth: PKI, applied cryptography, Active Directory and Kerberos, cloud, forensics and detection engineering.',
  comingSoon: false,
};

export const L3_SKILLS = [
  {
    id: 'l3-pki',
    name: 'PKI & certificates',
    track: 'advanced',
    level: 3,
    order: 30,
    prereqs: ['net-http'],
    summary: 'X.509 fields, chains of trust, what validation proves, and certificates as evidence (self-signed C2, CT logs, JA3/JA4).',
  },
  {
    id: 'l3-crypto',
    name: 'Applied cryptography',
    track: 'advanced',
    level: 3,
    order: 31,
    prereqs: ['l3-pki'],
    summary: 'Encoding vs hashing vs encryption, symmetric vs asymmetric, password storage, weak algorithms and ransomware crypto.',
  },
  {
    id: 'l3-identity',
    name: 'Identity, AD & Kerberos',
    track: 'advanced',
    level: 3,
    order: 32,
    prereqs: ['host-logs', 'host-users', 'l2-attack'],
    summary: 'Kerberos in the event logs (4768/4769), Kerberoasting, AS-REP roasting, pass-the-hash, golden and silver tickets, DCSync.',
  },
  {
    id: 'l3-cloud',
    name: 'Cloud security',
    track: 'advanced',
    level: 3,
    order: 33,
    prereqs: ['l3-identity'],
    summary: 'Shared responsibility, IAM and access keys, reading CloudTrail, and exposed storage.',
  },
  {
    id: 'l3-forensics',
    name: 'Digital forensics',
    track: 'advanced',
    level: 3,
    order: 34,
    prereqs: ['l2-ir'],
    summary: 'Order of volatility, imaging and chain of custody, Windows execution artifacts, memory and timelines.',
  },
  {
    id: 'l3-detection',
    name: 'Detection engineering',
    track: 'advanced',
    level: 3,
    order: 35,
    prereqs: ['l2-siem', 'l2-hunting'],
    summary: 'Sigma rules, testing and tuning for precision, detection-as-code and honest ATT&CK coverage.',
  },
];

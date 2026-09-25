// Level 2 · SOC Operations: skill definitions.
//
// content/index.js merges these over the Level 2 roadmap entries in content/skills.js (same ids,
// so the career gates in content/career.js keep working) and adds any new ids. Prerequisites
// point at Level 1 skills, so Level 2 opens once the foundations it builds on are mastered.

export const L2_TRACK = {
  id: 'soc',
  name: 'SOC operations (Level 2)',
  description: 'Real analyst workflows built on the basics: triage, SIEM, phishing, malware, ATT&CK, incident response, hunting and vulnerability management.',
  comingSoon: false,
};

export const L2_SKILLS = [
  {
    id: 'l2-alert-triage',
    name: 'Alert triage',
    track: 'soc',
    level: 2,
    order: 20,
    prereqs: ['host-logs', 'net-fw-logs'],
    summary: 'True, benign and false positives, severity vs priority, and working a queue in the right order.',
  },
  {
    id: 'l2-siem',
    name: 'SIEM & log analysis',
    track: 'soc',
    level: 2,
    order: 21,
    prereqs: ['host-logs', 'net-fw-logs'],
    summary: 'Normalised fields, SPL and KQL queries, correlation across sources, time zones and blind spots.',
  },
  {
    id: 'l2-phishing',
    name: 'Phishing & email analysis',
    track: 'soc',
    level: 2,
    order: 22,
    prereqs: ['net-dns', 'net-http'],
    summary: 'Email headers, SPF/DKIM/DMARC and alignment, lookalike links, attachments and scoping a campaign.',
  },
  {
    id: 'l2-malware',
    name: 'Malware analysis basics',
    track: 'soc',
    level: 2,
    order: 23,
    prereqs: ['host-persistence', 'host-processes'],
    summary: 'Malware types, safe handling, static vs dynamic analysis, sandboxes and useful IOCs.',
  },
  {
    id: 'l2-attack',
    name: 'MITRE ATT&CK & attack chains',
    track: 'soc',
    level: 2,
    order: 24,
    prereqs: ['l2-alert-triage'],
    summary: 'Tactics, techniques and sub-techniques, mapping evidence to ATT&CK, and the kill chain.',
  },
  {
    id: 'l2-ir',
    name: 'Incident response',
    track: 'soc',
    level: 2,
    order: 25,
    prereqs: ['l2-alert-triage'],
    summary: 'The NIST SP 800-61 lifecycle: analysis, containment, eradication, recovery and lessons learned.',
  },
  {
    id: 'l2-hunting',
    name: 'Threat hunting',
    track: 'soc',
    level: 2,
    order: 26,
    prereqs: ['l2-siem', 'l2-malware', 'l2-attack'],
    summary: 'Hypothesis-driven hunts, stack counting, beacon hunting and turning hunts into detections.',
  },
  {
    id: 'l2-vuln',
    name: 'Vulnerability management',
    track: 'soc',
    level: 2,
    order: 27,
    prereqs: ['net-ports', 'l2-alert-triage'],
    summary: 'Scanner output, CVE/CWE, CVSS v3.1/v4 vectors, EPSS and KEV, risk-based priority, exceptions, SLAs and verified fixes.',
  },
];

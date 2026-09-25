// Scenario / stage content type (modular hook for Round 2).
//
// A scenario is a multi-stage exercise built on top of the question bank and lessons:
//   id, kind ('mixed' | 'investigation' | 'capstone'), title, summary
//   status      'available' | 'in-development' (stage content still being written)
//   stages: [{
//     id, title, summary,
//     requires: { lessons: [skill ids whose lessons must be completed] },
//     steps: [                      // what the student works through, in order
//       { type: 'brief', text },    // narrative / ticket text
//       { type: 'evidence', label, text },
//       { type: 'item', itemId },   // any question from the bank
//     ],
//   }]
// The dashboard "Operations" panel lists scenarios and shows which stages are unlocked
// (all required lessons completed). Stages with no steps show as "in development".

export const SCENARIOS = [
  {
    id: 'mixed-practice',
    kind: 'mixed',
    title: 'Mixed practice',
    summary: 'Scenario-style evidence from every skill you have learned, shuffled. First decide which area the evidence involves, then answer.',
    stages: [],
  },
  {
    id: 'siem-investigation',
    kind: 'investigation',
    title: 'SIEM investigation mode',
    summary: 'Pivot through correlated host and network logs to answer an alert, like a real SIEM search.',
    status: 'in-development',
    stages: [
      { id: 'siem-1', title: 'Search basics', summary: 'Filter logs by host, user and time.', requires: { lessons: ['host-logs', 'net-fw-logs'] }, steps: [] },
    ],
  },
  {
    id: 'first-shift',
    kind: 'capstone',
    title: 'First shift as a Tier 1 analyst',
    summary: 'A full shift in the SOC queue. Stages unlock as you complete lessons.',
    status: 'in-development',
    stages: [
      { id: 'fs-1', title: 'Handover & host alerts', summary: 'Triage suspicious processes and logons.', requires: { lessons: ['host-processes', 'host-logs'] }, steps: [] },
      { id: 'fs-2', title: 'Perimeter noise', summary: 'Separate scans from real threats in firewall logs.', requires: { lessons: ['net-ports', 'net-tcp-udp', 'net-fw-logs'] }, steps: [] },
      { id: 'fs-3', title: 'The phish', summary: 'Follow a look-alike domain from DNS to the web proxy.', requires: { lessons: ['net-dns', 'net-http'] }, steps: [] },
      { id: 'fs-4', title: 'Escalation', summary: 'Find persistence and write the ticket for Tier 2.', requires: { lessons: ['host-persistence', 'host-users', 'host-filesystem'] }, steps: [] },
    ],
  },
];

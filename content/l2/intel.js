// Level 2 · Threat intelligence: questions, lesson and misconceptions.
// Formats: see content/questions/host.js, content/lessons/host.js and content/misconceptions.js.
// Feeds, orgs and hashes are fictional. TLP wording follows FIRST TLP 2.0 (authoritative from
// August 2022). Admiralty grades follow the NATO source-reliability / information-credibility
// scale. ATT&CK IDs are Enterprise v19.
// `bloom` records the intended Bloom level of each item (remember/understand/apply/analyze/evaluate).

const S = 'l2-intel';

const items = [
  {
    id: 'ti-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Which product is **tactical** threat intelligence, the kind a SOC applies on shift?',
    choices: [
      'A finished estimate of an adversary\'s goals for the next year',
      'A campaign report: clusters, infrastructure and victimology',
      'Indicators and context you can put into a detection today',
      'A board briefing on which regions the sector is losing',
    ],
    answer: 'Indicators and context you can put into a detection today',
    explanation:
      '**Tactical** intel is for the people on the tools: IOCs, signatures and the context that says how to use them. **Strategic** intel is for leadership (intent, trends, risk). **Operational** intel sits between them: campaigns, actor infrastructure and how an intrusion unfolds. A SOC consumes all three, but the queue runs on tactical.',
  },
  {
    id: 'ti-02',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'In FIRST **TLP 2.0**, which label replaced TLP:WHITE? (the label, e.g. TLP:RED)',
    accept: ['tlp:clear', 'tlp clear', 'clear'],
    misconceptions: { 'tlp:green': 'intel-tlp-old', 'tlp:white': 'intel-tlp-old', white: 'intel-tlp-old', green: 'intel-tlp-old' },
    explanation:
      '**TLP:CLEAR**. FIRST TLP 2.0 (authoritative from August 2022) renamed TLP:WHITE to TLP:CLEAR: disclosure is not limited, subject to copyright. The other labels are TLP:RED, TLP:AMBER (and TLP:AMBER+STRICT) and TLP:GREEN. Write them in capitals with no space.',
  },
  {
    id: 'ti-03',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'A partner marks a report **TLP:AMBER+STRICT**. Who may you share it with?',
    choices: [
      'Anyone in your sector community who has a need to know',
      'Your organisation and the clients you protect, need-to-know',
      'Only people inside your own organisation, need-to-know',
      'The public, as long as you drop the customer names',
    ],
    answer: 'Only people inside your own organisation, need-to-know',
    misconceptions: { 'Your organisation and the clients you protect, need-to-know': 'intel-tlp-old' },
    explanation:
      '**TLP:AMBER** may be shared inside your organisation **and with its clients**, need-to-know. **TLP:AMBER+STRICT** (added in TLP 2.0) stops at the organisation: no clients, no community, no public. If the source wanted clients included they would have used plain TLP:AMBER.',
  },
  {
    id: 'ti-04',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'You want the service desk to warn staff about a lookalike domain. The write-up is **TLP:RED**. What do you do?',
    choices: [
      'Forward the original PDF to the all-staff mailing list',
      'Post the domain on the public status page',
      'Ask the source to release a wider label, or rewrite',
      'Share it in the ISAC channel; ISACs are exempt',
    ],
    answer: 'Ask the source to release a wider label, or rewrite',
    misconceptions: { 'Share it in the ISAC channel; ISACs are exempt': 'intel-tlp-old', 'Forward the original PDF to the all-staff mailing list': 'intel-tlp-old' },
    explanation:
      '**TLP:RED** is for the participants of that exchange only. You do not forward it, and an ISAC is not an exemption. Either ask the producer to reissue at TLP:AMBER or TLP:GREEN, or write a fresh note that contains only what you are allowed to say (often just the domain and "block this"). The label travels with the information.',
  },
  {
    id: 'ti-05',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'On the Pyramid of Pain, which indicator is **trivial** for an attacker to change?',
    choices: [
      'The tactic they use to steal credentials',
      'A file hash of one packed sample',
      'A host artifact such as a Run-key name',
      'The tool they compiled and signed themselves',
    ],
    answer: 'A file hash of one packed sample',
    misconceptions: { 'The tactic they use to steal credentials': 'intel-hash-is-ttp' },
    explanation:
      'David Bianco\'s **Pyramid of Pain**, bottom to top: hash values (trivial), IP addresses (easy), domain names (simple), network/host artifacts (annoying), tools (challenging), TTPs (tough). A hash changes the moment the sample is recompiled or repacked. A TTP change means changing how the intrusion works.',
  },
  {
    id: 'ti-06',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A detection matches "rundll32 loading a DLL from AppData, then a 30-minute scheduled task". Where does that sit on the Pyramid of Pain?',
    choices: [
      'Hash values: they can swap the DLL bytes tonight',
      'IP addresses: point the task at a new host',
      'TTPs: this is how the intrusion persists',
      'Domain names: the task name is just a hostname',
    ],
    answer: 'TTPs: this is how the intrusion persists',
    misconceptions: { 'Hash values: they can swap the DLL bytes tonight': 'intel-hash-is-ttp' },
    explanation:
      'The durable part is the **behaviour**: a signed LOLBin loading an unsigned DLL from a user-writable path, plus scheduled-task persistence. That is a TTP (tough to change without rewriting the playbook). The DLL hash and the C2 address are the cheap layers underneath it. Detect the behaviour and the next hash still lights up.',
  },
  {
    id: 'ti-07',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'The Diamond Model has four core features. Which one is the systems and accounts the adversary uses to operate? (one word)',
    accept: ['infrastructure'],
    misconceptions: { capability: 'intel-diamond-mix', victim: 'intel-diamond-mix', adversary: 'intel-diamond-mix' },
    explanation:
      '**Infrastructure**: domains, IPs, accounts, servers, the things they operate through. The other vertices are **adversary** (who), **capability** (tools and malware) and **victim** (who they hit, including the persona and the asset). Edges between vertices are the relationships you pivot on.',
  },
  {
    id: 'ti-08',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Map the bolded fact to a Diamond Model vertex.',
    snippet: 'A phishing kit on payroll.corp-example-hr.example (203.0.113.140) collected session cookies from emma@corp.example. The kit is a reverse proxy sold as "AuthRelay".',
    choices: [
      '203.0.113.140 is the adversary vertex',
      'AuthRelay is infrastructure, the IP is capability',
      'The domain and IP are infrastructure',
      'emma@corp.example is the capability vertex',
    ],
    answer: 'The domain and IP are infrastructure',
    misconceptions: { '203.0.113.140 is the adversary vertex': 'intel-diamond-mix', 'AuthRelay is infrastructure, the IP is capability': 'intel-diamond-mix' },
    explanation:
      'The domain and the address are **infrastructure**. AuthRelay, the kit, is **capability**. emma@corp.example is the **victim** (persona). The adversary vertex is whoever is operating the kit, and this snippet does not name them. Do not collapse "the IP" into "the actor".',
  },
  {
    id: 'ti-09',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Which line is an **IOA** (indicator of attack) rather than an IOC?',
    choices: [
      'SHA-256 a1b2c3…8f90 seen on three hosts last week',
      'Domain update-cdn-sync.example resolved to 198.51.100.77',
      'A user pasted a password into a prompt they did not open',
      'Passive DNS shows that domain was created on 20 Sep',
    ],
    answer: 'A user pasted a password into a prompt they did not open',
    explanation:
      'An **IOC** is a static trace: a hash, an IP, a domain, a registry value. An **IOA** is behaviour that shows an attack in progress, often before you know the tool: a prompt the user did not start, a process that does not usually spawn a shell. A **TTP** is the adversary\'s method, which you later encode as a detection. Creation dates and resolutions are enrichment, not IOAs.',
  },
  {
    id: 'ti-10',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'What is **STIX**, as a SOC uses it?',
    choices: [
      'The HTTPS protocol that pulls collection objects',
      'A JSON language for sharing threat information',
      'A MISP taxonomy used only for TLP tags',
      'A score from A1 to F6 for source quality',
    ],
    answer: 'A JSON language for sharing threat information',
    explanation:
      '**STIX** (2.1 is current) is the data model: JSON objects such as indicator, malware, threat-actor, attack-pattern, campaign, intrusion-set, relationship and sighting. **TAXII** is the protocol that exchanges STIX over HTTPS (API roots and collections). MISP can export STIX but is a different platform. A1–F6 is the Admiralty code.',
  },
  {
    id: 'ti-11',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Which protocol exchanges STIX objects over HTTPS? (acronym)',
    accept: ['taxii', 'taxii 2', 'taxii 2.1'],
    explanation:
      '**TAXII** (2.1). It is an application protocol: clients discover an API root and pull or push STIX from a **collection**. STIX is what is inside the messages. Mixing the two up leads people to "install TAXII" when they needed a place to store indicators.',
  },
  {
    id: 'ti-12',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In **MISP**, what is an attribute?',
    choices: [
      'One observable inside an event, such as an IP',
      'The sharing rule that replaces TLP entirely',
      'A galaxy cluster naming a whole intrusion set',
      'The sync link between two MISP servers',
    ],
    answer: 'One observable inside an event, such as an IP',
    explanation:
      'A MISP **event** is the report (one campaign, one sighting). **Attributes** are the observables inside it: ip-dst, domain, sha256, and so on, each with a category and a to-ids flag. **Galaxies** attach ATT&CK techniques or actor names. **Taxonomies** are the tags (including TLP). Sync and sharing groups decide who receives the event; they are not attributes.',
  },
  {
    id: 'ti-13',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'A report is graded **Admiralty B2**. What does that grade mean?',
    choices: [
      'Completely reliable source, confirmed by others',
      'Usually reliable source, probably true',
      'Unreliable source, information is improbable',
      'Source cannot be judged, truth cannot be judged',
    ],
    answer: 'Usually reliable source, probably true',
    explanation:
      'The letter is **source reliability**: A completely, B usually, C fairly, D not usually, E unreliable, F cannot be judged. The number is **information credibility**: 1 confirmed, 2 probably true, 3 possibly true, 4 doubtful, 5 improbable, 6 cannot be judged. **B2** is a usually reliable source and information that is probably true. It is not proof.',
  },
  {
    id: 'ti-14',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'Admiralty: the source has no history you can rate. Which reliability letter is that? (one letter)',
    accept: ['f'],
    misconceptions: { e: 'intel-diamond-mix', a: 'intel-rep-is-proof' },
    explanation:
      '**F**, "reliability cannot be judged". **E** is different: you judge the source unreliable. Credibility **6** is the information side ("truth cannot be judged"). A brand-new blog with no track record is F, not E, until it earns a record.',
  },
  {
    id: 'ti-15',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Your blocklist still contains this address. What should you do with it today?',
    snippet: `Indicator: 203.0.113.50
Feed hit: malware callback, last seen 2024-11-18 (one source)
Passive DNS now: app-12.customers.example-cloud.example since 2026-08-04
WHOIS now: Example Cloud, AS64500, customer pool`,
    choices: [
      'Keep the block: a malware IP never becomes clean',
      'Block AS64500 so the pool cannot be reused',
      'Retire the block; the address was reassigned',
      'Treat the cloud customer name as the actor',
    ],
    answer: 'Retire the block; the address was reassigned',
    misconceptions: { 'Keep the block: a malware IP never becomes clean': 'intel-ioc-forever' },
    explanation:
      'IPs are rented. This one moved from a 2024 callback to a cloud customer pool. **IOC aging** says weight last-seen, who owns it now, and whether passive DNS still agrees. Blocking the whole ASN punishes every tenant. Record why you expired it so the next import does not put it back.',
  },
  {
    id: 'ti-16',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Passive DNS for a domain shows one IP, first seen yesterday. What did you actually learn?',
    choices: [
      'The domain is malicious because it is young',
      'Where it has pointed, and for how long',
      'Who operates it, from the WHOIS privacy row',
      'The malware family, because young domains are loaders',
    ],
    answer: 'Where it has pointed, and for how long',
    misconceptions: { 'The domain is malicious because it is young': 'intel-rep-is-proof' },
    explanation:
      '**Passive DNS** is history: names, addresses, first and last seen. It does not issue a verdict. A one-day-old resolution is a useful fact next to WHOIS and reputation, not a conviction. Plenty of legitimate launches look the same for a day.',
  },
  {
    id: 'ti-17',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'One feed of ninety scores this CDN address malicious because a single sample called it. What is the right weight?',
    snippet: `198.51.100.10  org=Example CDN  asn=AS64501
Reputation: 1/90 sources malicious, tag=cdn-shared
Passive DNS: hundreds of customer names, stable for years`,
    choices: [
      'Block the IP: one malicious hit is enough',
      'Block the ASN: the provider is the problem',
      'Do not block it; pivot to the URL or hash',
      'Ignore the sample: CDN traffic is always benign',
    ],
    answer: 'Do not block it; pivot to the URL or hash',
    misconceptions: { 'Block the IP: one malicious hit is enough': 'intel-rep-is-proof', 'Ignore the sample: CDN traffic is always benign': 'intel-rep-is-proof' },
    explanation:
      'Shared infrastructure (CDNs, cloud, public resolvers) collects stray hits. **Prevalence and context** beat a single vote. Keep the sample\'s hash and the URL path; blocking the CDN IP or the ASN is how you cause an outage. "Shared" is not "safe": the path can still be malicious.',
  },
  {
    id: 'ti-18',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'understand',
    prompt: 'Which belong in an enrichment lookup before you block an IP? Select all that apply.',
    choices: [
      'WHOIS or the ASN and organisation',
      'Passive DNS history and dates',
      'Reputation, with how many sources agreed',
      'A sandbox report, if you have the file',
      'The adversary\'s legal name, required for a block',
    ],
    answer: [
      'WHOIS or the ASN and organisation',
      'Passive DNS history and dates',
      'Reputation, with how many sources agreed',
      'A sandbox report, if you have the file',
    ],
    explanation:
      'Enrichment answers "what is this, and how sure are we?": ownership, history, how many feeds agree, and what a sample did. Attribution (a legal name) is rarely available and is not required to contain a confirmed callback. The mock lookup panel on a case is exactly these four views.',
  },
  {
    id: 'ti-19',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Who is the audience for **strategic** threat intelligence?',
    choices: [
      'The Tier 1 analyst writing today\'s blocklist entries',
      'Leadership deciding risk, budget and priorities',
      'The sensor, which consumes it as Snort rules',
      'Only the malware reverser in the lab',
    ],
    answer: 'Leadership deciding risk, budget and priorities',
    explanation:
      '**Strategic** intel is about intent, capability trends and business risk, written for people who set priorities. It should not be dumped into a blocklist. Analysts still read it so they know which campaigns matter this quarter, but the action is a decision, not a signature.',
  },
  {
    id: 'ti-20',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'A hash match fires, and the same report lists the actor\'s usual persistence. Which detection will still work when they recompile?',
    choices: [
      'The SHA-256 of this sample',
      'The C2 IP from today\'s sandbox run',
      'The persistence behaviour in the report',
      'The file name Invoice.exe they used once',
    ],
    answer: 'The persistence behaviour in the report',
    misconceptions: { 'The SHA-256 of this sample': 'intel-hash-is-ttp' },
    explanation:
      'Recompiling changes the hash and often the file name; rotating infrastructure changes the IP. The **TTP** (how they persist) is what hurts them to replace. Use the hash for this incident\'s scoping, and write the behaviour as the detection you keep.',
  },
  {
    id: 'ti-21',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What should a detection engineer do with this STIX fragment?',
    snippet: `[indicator:ipv4-addr:value = '198.51.100.77']
labels: malicious-activity
valid_until: 2026-10-15
pattern_type: stix
related: malware--exampleloader (uses)`,
    choices: [
      'Block it forever; STIX indicators do not expire',
      'Load it as a rule with the expiry, and keep the malware link',
      'Ignore it until TAXII proves the actor\'s name',
      'Convert the pattern into a TLP:RED email to all staff',
    ],
    answer: 'Load it as a rule with the expiry, and keep the malware link',
    misconceptions: { 'Block it forever; STIX indicators do not expire': 'intel-ioc-forever' },
    explanation:
      'A STIX **indicator** pattern is machine-readable (here, an IPv4 address) and **valid_until** is the producer telling you when to stop trusting it. The relationship to a malware object is the context: why the indicator exists. TAXII only delivers the object. TLP is a sharing label, not a pattern type.',
  },
  {
    id: 'ti-22',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Why do domains and IPs go stale faster than TTPs?',
    choices: [
      'Attackers publish fresh hashes in STIX every night',
      'Addresses are reassigned and domains get re-registered',
      'TLP:CLEAR forces indicators to expire after 24 hours flat',
      'Admiralty F6 deletes anything older than a week',
    ],
    answer: 'Addresses are reassigned and domains get re-registered',
    explanation:
      'Infrastructure is cheap and shared: cloud IPs rotate, domains expire and someone else buys them, CDNs mix tenants. A behaviour (a TTP) stays useful because changing it costs the attacker a rewrite. Aging policies should be short for IPs, longer for hashes of a live campaign, and behaviour-based rules should not expire just because a feed row did.',
  },
  {
    id: 'ti-23',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'apply',
    prompt: 'A feed drops a **TLP:AMBER** IP list for a live campaign. Which uses are allowed? Select all that apply.',
    choices: [
      'Detect it inside your SOC and tell your IR clients',
      'Put the list on a public paste site "so others can block"',
      'Share it need-to-know with the team who owns the firewall',
      'Brief a client you protect, with the label still on it',
      'Tweet the ranges because blocking is always TLP:CLEAR',
    ],
    answer: [
      'Detect it inside your SOC and tell your IR clients',
      'Share it need-to-know with the team who owns the firewall',
      'Brief a client you protect, with the label still on it',
    ],
    misconceptions: { 'Tweet the ranges because blocking is always TLP:CLEAR': 'intel-tlp-old' },
    explanation:
      'TLP:AMBER stays inside the organisation and the clients it protects, need-to-know, and the label stays on. Public paste sites and social posts are disclosure. "It is only IPs" does not change the label. If the community needs it, ask for TLP:GREEN.',
  },
  {
    id: 'ti-24',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Two sources disagree about the same domain. Which one do you weight more, and why?',
    snippet: `Source 1  Admiralty A1  "domain is operator infrastructure"  (matches your own sandbox)
Source 2  Admiralty E5  "domain is a false positive"  (no evidence attached)`,
    choices: [
      'Source 2, because a false-positive claim should halt blocking',
      'Source 1: reliable, corroborated, and it matches your detonation',
      'Neither: Admiralty grades are not used on domains',
      'Average them to C3 and wait a month',
    ],
    answer: 'Source 1: reliable, corroborated, and it matches your detonation',
    explanation:
      '**A1** is a completely reliable source whose claim is confirmed elsewhere, and here your own sandbox agrees. **E5** is an unreliable source calling the claim improbable, with nothing attached. Grades are a weighting aid, not a vote to average. You can still record the dissent so a reviewer sees you noticed it.',
  },
  {
    id: 'ti-25',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Admiralty credibility **6** means the truth of the information… (two or three words)',
    accept: ['cannot be judged', 'can not be judged', 'cannot be judged.', 'truth cannot be judged'],
    explanation:
      'Credibility **6** is "truth cannot be judged", the information-side twin of reliability **F**. It is not "confirmed" and it is not "improbable" (that is 5). Use it when the report gives you nothing you can check.',
  },
  {
    id: 'ti-26',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'The lookup panel returns this for the domain in an alert. What is a sound call?',
    snippet: `update-cdn-sync.example
WHOIS: created 3 days ago, privacy proxy
Reputation: malicious, 4 sources, tags c2, newly-registered
Passive DNS: only 198.51.100.77, first seen yesterday
Sandbox (hash from the host): POST /gate.php to this domain`,
    choices: [
      'False positive: privacy WHOIS means it is a CDN',
      'Malicious callback; record the context with the block',
      'Need the actor\'s real name before any containment',
      'TLP:RED by default, so do not write it in the ticket',
    ],
    answer: 'Malicious callback; record the context with the block',
    misconceptions: { 'False positive: privacy WHOIS means it is a CDN': 'intel-rep-is-proof', 'Need the actor\'s real name before any containment': 'intel-diamond-mix' },
    explanation:
      'Age, several agreeing feeds, single-IP passive DNS and a sandbox that actually called the domain are enough to treat it as C2 and contain. Write those facts on the ticket so the block can expire when the facts expire. Privacy WHOIS is common for criminals and for ordinary people. You do not need a legal name to isolate a host.',
  },
  {
    id: 'ti-27',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which of these are **TTPs**, not atomic IOCs? Select all that apply.',
    choices: [
      'Spearphishing attachment, then a macro starts PowerShell (T1566.001, T1059.001)',
      'SHA-256 a1b2c3d4…8f90',
      'Stealing a web session cookie after a proxied login (T1539)',
      'IPv4 198.51.100.77',
      'Generating MFA pushes until the user accepts (T1621)',
    ],
    answer: [
      'Spearphishing attachment, then a macro starts PowerShell (T1566.001, T1059.001)',
      'Stealing a web session cookie after a proxied login (T1539)',
      'Generating MFA pushes until the user accepts (T1621)',
    ],
    explanation:
      'Those three describe **how** the intrusion is done (ATT&CK techniques): they stay useful when the hash and the IP rotate. The hash and the address are atomic IOCs, the bottom of the Pyramid of Pain. Good intel reporting carries both layers and does not pretend they are the same thing.',
  },
  {
    id: 'ti-28',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does **TLP:GREEN** allow that TLP:AMBER does not?',
    choices: [
      'Sharing with the whole community, not only your clients',
      'Posting to the open internet with no further limit',
      'Sharing only inside the meeting that received it',
      'Dropping the label once it is inside a ticket',
    ],
    answer: 'Sharing with the whole community, not only your clients',
    misconceptions: { 'Posting to the open internet with no further limit': 'intel-tlp-old' },
    explanation:
      '**TLP:GREEN** is community-wide: peers and partner organisations in the sector, not the public. **TLP:CLEAR** is the one with no disclosure limit. **TLP:RED** stays with the participants. The label is not removed when you paste the text into a ticket.',
  },
  {
    id: 'ti-29',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A TLP:GREEN report names a campaign TTP but the IOCs are a week old and your sensors never saw them. What is worth building?',
    choices: [
      'Nothing: unseen IOCs mean the report is false',
      'A permanent block of every IP in the annex',
      'A behaviour detection for the TTP, IOCs only for hunting',
      'An Admiralty A1 grade, because it was TLP:GREEN',
    ],
    answer: 'A behaviour detection for the TTP, IOCs only for hunting',
    explanation:
      'Not seeing a week-old IP usually means the infrastructure moved, not that the report was fiction. The part that still pays rent is the **TTP**. Hunt for the old indicators (they scope whether you were hit) and detect the behaviour going forward. TLP does not grade truth, and Admiralty is not implied by the colour.',
  },
  {
    id: 'ti-30',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'A MISP attribute is flagged **to_ids = false**. Should it be pushed straight to the blocklist? (yes or no)',
    accept: ['no', 'no.'],
    explanation:
      '**No.** In MISP, to_ids marks attributes the producer considers suitable for detection. false means "context, not a signature": an actor\'s name, a legitimate site they abused, or something too broad. Read it, do not auto-import it.',
  },
  {
    id: 'ti-31',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Your sandbox and a partner\'s sandbox disagree on the same hash. What is the careful next step?',
    snippet: `SHA-256 a1b2…8f90
Your detonation: no network, score benign (60 second timeout)
Partner (Admiralty B2): callback to update-cdn-sync.example after 4 minutes, family ExampleLoader`,
    choices: [
      'Close it: your sandbox is local, so it wins',
      'Re-run longer; a short timeout can miss a delay',
      'Mark the partner E5 because they disagreed',
      'Block every domain your sandbox has ever resolved',
    ],
    answer: 'Re-run longer; a short timeout can miss a delay',
    explanation:
      'Sandboxes miss things: short timers, environment checks, missing arguments. A usually-reliable partner seeing a delayed callback is a reason to **re-detonate**, not to average the scores or to punish their grade. If the longer run confirms the callback, the hash becomes a high-confidence IOC for this build only.',
  },
  {
    id: 'ti-32',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Which statement about enrichment is the one you should write on a ticket?',
    choices: [
      'Score 91 means we know the operator\'s name',
      'Four feeds and a fresh domain: block, review on 15 Oct',
      'Unknown reputation proves the indicator is clean',
      'Passive DNS replaces the need to read the alert',
    ],
    answer: 'Four feeds and a fresh domain: block, review on 15 Oct',
    misconceptions: { 'Unknown reputation proves the indicator is clean': 'intel-rep-is-proof', 'Score 91 means we know the operator\'s name': 'intel-rep-is-proof' },
    explanation:
      'A good enrichment note says **what** you used, **how many** sources agreed, and **when** it should be reviewed. A score is not attribution. "Unknown" means the feeds were silent, not that the indicator is benign. Passive DNS is one input next to the log line, not a substitute for it.',
  },
];

const lesson = {
  skill: S,
  title: 'Threat intelligence',
  goal: 'Tell tactical from strategic intel, apply TLP 2.0, and enrich an indicator without treating a feed hit as proof.',
  sections: [
    {
      id: 'levels',
      heading: 'Levels of intel and TLP 2.0',
      body: [
        'Threat intelligence is analysed information that should change a decision. **Strategic** intel is for leadership: who is interested in organisations like yours, and what to fund. **Operational** intel describes campaigns, infrastructure and victimology for the people planning a hunt or a response. **Tactical** intel is what the shift uses today: indicators, signatures and the context that says how much to trust them.',
        '**TLP 2.0** (FIRST, authoritative from August 2022) is a sharing label, not a classification of truth. **TLP:RED** stays with the participants of that exchange. **TLP:AMBER** may be shared need-to-know inside your organisation and with the clients you protect. **TLP:AMBER+STRICT** stops at your organisation. **TLP:GREEN** may be shared with the community. **TLP:CLEAR** replaced TLP:WHITE and has no disclosure limit, subject to copyright. Labels are written in capitals with no space, and they are not translated.',
      ],
      points: [
        'You cannot widen a label on your own. Ask the source, or rewrite a narrower note from facts you are allowed to use.',
        'TLP does not mean "true". A TLP:RED rumour is still a rumour.',
      ],
    },
    {
      id: 'models',
      heading: 'Pyramid of Pain and the Diamond Model',
      body: [
        'The **Pyramid of Pain** orders indicators by how much it costs the attacker to change them. From the bottom: hash values (trivial), IP addresses (easy), domain names (simple), network and host artifacts (annoying), tools (challenging), TTPs (tough). Blocking a hash still matters for this incident. Detecting the behaviour is what survives the next build.',
        'The **Diamond Model** has four vertices: **adversary**, **capability**, **infrastructure** and **victim**. An IP is infrastructure, a malware family is capability, a mailbox is a victim persona, and you often do not know the adversary at all. Meta-features such as timestamp, phase and result sit in the middle. Pivoting means walking the edges: this infrastructure used this capability against this victim.',
      ],
      evidence: {
        label: 'Same intrusion, two layers',
        text: 'IOC (cheap):  SHA-256 a1b2…8f90, 198.51.100.77, update-cdn-sync.example\nTTP (expensive): rundll32 loads an unsigned DLL from AppData, then a 30-minute scheduled task (T1059 / persistence)\nDiamond: capability=ExampleLoader, infrastructure=198.51.100.77, victim=WS-ENG-05 / ravi, adversary=unknown',
      },
    },
    {
      id: 'indicators',
      heading: 'IOC, IOA, TTP, and how they are shared',
      body: [
        'An **IOC** is a static trace that something already happened (hash, IP, domain, mutex). An **IOA** is behaviour that an attack is underway, often before the tool has a name. A **TTP** is the adversary\'s method; ATT&CK technique IDs (T1566.001, T1059.001, T1539, T1621) are how the industry names them. Reports should carry all three and not call a hash a TTP.',
        '**STIX 2.1** is the JSON language (indicator, malware, threat-actor, attack-pattern, relationship, sighting). **TAXII 2.1** is the HTTPS protocol that moves STIX through collections. **MISP** is a sharing platform: an event holds attributes, galaxies attach ATT&CK or actor context, taxonomies hold tags such as TLP, and to_ids=false means "do not auto-block".',
      ],
    },
    {
      id: 'grading',
      heading: 'Admiralty grades, aging and enrichment',
      body: [
        'The **Admiralty code** separates the source from the claim. Reliability is a letter: A completely, B usually, C fairly, D not usually, E unreliable, F cannot be judged. Credibility is a number: 1 confirmed by other sources, 2 probably true, 3 possibly true, 4 doubtful, 5 improbable, 6 cannot be judged. **B2** means a usually reliable source and a claim that is probably true. Grades weight evidence; they are not averaged into a new grade.',
        'Indicators rot. Cloud addresses are reassigned, domains are re-registered, CDNs mix thousands of customers onto one IP. Read **first seen, last seen, how many sources, and who owns it now**. A sandbox hash hit is strong for that exact file and silent on the next compile. Unknown reputation means "no opinion", not "clean".',
      ],
      evidence: {
        label: 'A lookup that should not become a block',
        text: '203.0.113.50\nFeed: malware callback, last seen 2024-11-18, one source\nPassive DNS now: app-12.customers.example-cloud.example since 2026-08-04\nWHOIS now: Example Cloud, AS64500\nCall: expire the indicator. Do not block the ASN.',
      },
    },
    {
      id: 'workflow',
      heading: 'Using intel on a live alert',
      body: [
        'On shift, intel is a question you ask of an indicator, not a PDF you finish. Take the IP, domain or hash out of the log and look it up: **WHOIS** (who announces it), **reputation** (how many sources, how recently), **passive DNS** (what else it has been), **sandbox** (what a file actually did). Then write the decision with a review date.',
        'The case screen has that lookup built in. Open a log row and use **Lookup** on an IP, domain or hash, or type one into the panel. A miss is still a result: say "no feed data" in the write-up rather than treating silence as benign. Contain from corroborated C2 and from what the host did; do not wait for a legal name.',
      ],
    },
  ],
  worked: [
    {
      id: 'ti-w1',
      title: 'Enriching a beacon domain',
      artifactLabel: 'Mock lookup · update-cdn-sync.example',
      artifact:
        'WHOIS: created 2026-09-20, registrar ExampleNIC, privacy proxy\nReputation: malicious, score 87, 4 sources, tags c2 + newly-registered\nPassive DNS: 198.51.100.77 only, first seen 2026-09-21\nSandbox for the host\'s SHA-256: POST /gate.php to this domain every 60s, family ExampleLoader',
      question: 'Is this enough to call the beacon C2 and block the domain?',
      steps: [
        'Check age and shape: three days old, privacy-protected, a single hosting IP. That is consistent with campaign infrastructure and also with a rushed legitimate site, so it is not enough alone.',
        'Add independent agreement: four feeds already call it C2. Note the count, not just the score.',
        'Add what the file did: the sandbox opened that exact name. Capability (ExampleLoader) is now tied to infrastructure (the domain and 198.51.100.77).',
        'Decide the action and the expiry: block the domain and the IP, scope hosts that resolved the name, and review the block when the STIX valid_until (or two weeks) arrives. Do not block AS64511.',
      ],
      conclusion: 'Yes. Block the domain and the one IP, cite the four feeds plus the sandbox, and put a review date on the ticket. The actor vertex stays "unknown", and that is fine.',
    },
  ],
  faded: [
    {
      id: 'ti-f1',
      title: 'An old hit on a cloud address',
      artifactLabel: 'Lookup · 203.0.113.50',
      artifact:
        'Reputation: one source, malware callback, last seen 2024-11-18, score 18, tag historical\nPassive DNS: evil-old.example until 2024-11-18; app-12.customers.example-cloud.example since 2026-08-04\nWHOIS: Example Cloud, AS64500, customer pool\nTLP on the original report: TLP:GREEN',
      question: 'Should this address stay on the firewall blocklist?',
      given: [
        'The only malicious passive-DNS name stopped resolving here in November 2024.',
        'The address is now a cloud customer pool, so a block hits whoever rents it today.',
      ],
      todo: [
        {
          prompt: 'What is the right handling?',
          type: 'mc',
          choices: [
            'Expire the block and record why, so the import does not restore it',
            'Keep it: a malware IP stays malicious',
            'Block AS64500 until the feed withdraws the row',
          ],
          answer: 'Expire the block and record why, so the import does not restore it',
          explanation: 'The indicator aged out and was reassigned. Document the expiry or the next feed import will put the outage back.',
        },
        {
          prompt: 'The original report was TLP:GREEN. May you tell the community the address is no longer bad?',
          type: 'mc',
          choices: [
            'Yes, community sharing is what TLP:GREEN allows',
            'No, aging automatically upgrades it to TLP:RED',
            'Only if you reissue your note as TLP:AMBER+STRICT',
          ],
          answer: 'Yes, community sharing is what TLP:GREEN allows',
          explanation: 'TLP:GREEN can be shared with the community. Correcting a stale indicator inside that audience is allowed. It does not become RED just because you are unsure, and you should not narrow it to AMBER+STRICT unless the source did.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'intel-tlp-old',
    skill: S,
    name: 'TLP:WHITE and AMBER mean whatever is convenient',
    description: 'Treats TLP:WHITE as current, shares AMBER+STRICT with clients, or posts RED/AMBER material because "it is only IOCs".',
    fix: 'TLP 2.0 replaced TLP:WHITE with TLP:CLEAR. TLP:AMBER includes your clients; TLP:AMBER+STRICT does not. TLP:GREEN is the community, not the public. TLP:RED stays with that exchange. You cannot widen a label, and "IOCs are harmless" is not an exception.',
    lesson: `${S}#levels`,
  },
  {
    id: 'intel-hash-is-ttp',
    skill: S,
    name: 'A hash or an IP is a TTP',
    description: 'Calls atomic indicators TTPs, so detections die on the next recompile.',
    fix: 'Hashes, IPs and domains are the bottom of the Pyramid of Pain: cheap for the attacker to change. TTPs are how they operate (a technique such as T1059.001 or T1621). Use the IOC to scope this incident and the behaviour to detect the next one.',
    lesson: `${S}#models`,
  },
  {
    id: 'intel-diamond-mix',
    skill: S,
    name: 'The IP is the adversary',
    description: 'Collapses Diamond vertices, or refuses to contain anything until a person\'s name is known.',
    fix: 'Adversary, capability, infrastructure and victim are different. An IP or domain is infrastructure; a kit or family is capability; a mailbox is a victim. Unknown adversary is a normal state. You can contain from infrastructure and capability without a legal name.',
    lesson: `${S}#models`,
  },
  {
    id: 'intel-ioc-forever',
    skill: S,
    name: 'Once malicious, always block',
    description: 'Leaves stale IPs and domains on blocklists after they have been reassigned, or ignores valid_until.',
    fix: 'IPs are reassigned, domains are re-registered, CDNs mix tenants. Read last-seen, current WHOIS and passive DNS. Expire indicators, honour STIX valid_until, and never block a whole cloud ASN because one address used to be bad.',
    lesson: `${S}#grading`,
  },
  {
    id: 'intel-rep-is-proof',
    skill: S,
    name: 'The reputation score is the verdict',
    description: 'Treats one feed hit as proof, treats "unknown" as clean, or treats a young domain as automatically malicious.',
    fix: 'Reputation is a vote count plus a date, not attribution and not proof. Unknown means no opinion. A newly registered domain is context. Weigh it with WHOIS, passive DNS, how many sources agreed, and what the host or the sandbox actually did.',
    lesson: `${S}#grading`,
  },
];

export const INTEL = { items, lesson, misconceptions };

// Level 2 · Vulnerability management: questions, lesson and misconceptions.
// Formats: see content/questions/host.js, content/lessons/host.js and content/misconceptions.js.
// Products, plugin numbers and CVE numbers in this file are fictional (CVE-2026-9xxxx), so no
// example points at a real advisory. CVSS scores were checked against the FIRST v3.1/v4.0 formulas.
// `bloom` records the intended Bloom level of each item (remember/understand/apply/analyze/evaluate).

const S = 'l2-vuln';

const items = [
  {
    id: 'vm-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'What is a **CVE**?',
    choices: [
      'A public identifier for one specific, disclosed vulnerability',
      'A score from 0 to 10 for how severe a vulnerability is',
      'A category of weakness shared by many products, such as "SQL injection"',
      'A list of vulnerabilities being exploited right now',
    ],
    answer: 'A public identifier for one specific, disclosed vulnerability',
    explanation:
      'A **CVE** ID (CVE-YYYY-NNNNN) names one disclosed vulnerability in one product so everyone can talk about the same thing. The 0–10 score is **CVSS**, the weakness category is a **CWE** (for example CWE-89 SQL injection), and the list of vulnerabilities exploited in the wild is CISA\'s **KEV** catalog.',
  },
  {
    id: 'vm-02',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'A CVSS v3.1 base score of **7.5** falls into which severity rating? (one word)',
    accept: ['high'],
    misconceptions: { critical: 'vuln-cvss-priority' },
    explanation:
      'CVSS v3.1 (and v4.0) bands: None 0.0, Low 0.1–3.9, Medium 4.0–6.9, **High 7.0–8.9**, Critical 9.0–10.0. The band describes technical severity only: it says nothing yet about whether the flaw is being exploited or whether the host matters.',
  },
  {
    id: 'vm-03',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In a CVSS v3.1 vector, what does **AV:N** tell you?',
    choices: [
      'The attacker can reach it over the network',
      'No authentication or account is needed to exploit it',
      'There is no known exploit for it yet',
      'The impact on availability is none',
    ],
    answer: 'The attacker can reach it over the network',
    explanation:
      '**AV** is Attack Vector: N = Network (remotely, across routers), A = Adjacent (same segment), L = Local (needs a session on the box), P = Physical. "No authentication" is **PR:N** (Privileges Required: None). Availability impact is the **A** metric. Exploit availability is not a base metric at all: it lives in threat intelligence such as EPSS, KEV or the CVSS v4 Exploit Maturity (E) metric.',
  },
  {
    id: 'vm-04',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'What is the CVSS v3.1 base score of `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`? (number)',
    accept: ['9.8'],
    misconceptions: { '10': 'vuln-cvss-priority', '10.0': 'vuln-cvss-priority' },
    explanation:
      '**9.8, Critical.** Network reachable, low complexity, no privileges, no user interaction and high impact on confidentiality, integrity and availability, with scope unchanged. It only reaches 10.0 when scope is **changed** (S:C), meaning the exploit breaks out of the vulnerable component into others. You will see 9.8 on a huge number of remote code execution bugs, which is exactly why the score alone cannot order a patch queue.',
  },
  {
    id: 'vm-05',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does an **EPSS** score of 0.94 on a CVE mean?',
    choices: [
      'A 94% estimated chance of exploitation activity in the next 30 days',
      'The CVE is severe enough to score 9.4 out of 10 on CVSS',
      'Ninety-four percent of your hosts are affected by it',
      'CISA has confirmed it is exploited on 94% of targets',
    ],
    answer: 'A 94% estimated chance of exploitation activity in the next 30 days',
    misconceptions: { 'The CVE is severe enough to score 9.4 out of 10 on CVSS': 'vuln-cvss-priority' },
    explanation:
      '**EPSS** (Exploit Prediction Scoring System, run by FIRST) is a probability, from 0 to 1, that exploitation activity against the CVE will be observed in the next 30 days, built from threat data. It measures **likelihood**, which CVSS does not. It is not a severity score, and it is not a statement from CISA: confirmed exploitation is what the KEV catalog records.',
  },
  {
    id: 'vm-06',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Which CISA catalog lists vulnerabilities with evidence of active exploitation in the wild? (acronym or name)',
    accept: ['kev', 'cisa kev', 'known exploited vulnerabilities', 'known exploited vulnerabilities catalog', 'the kev catalog', 'kev catalog'],
    explanation:
      'The **Known Exploited Vulnerabilities (KEV)** catalog. An entry needs a CVE ID, reliable evidence of active exploitation and clear remediation guidance. US federal civilian agencies must fix entries by the listed due date (BOD 22-01); everyone else uses it as a strong "patch this first" signal.',
  },
  {
    id: 'vm-07',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'You can patch only one of these today. Which first?',
    snippet: `#  CVE              CVSS  EPSS   KEV  Asset
1  CVE-2026-91007   8.1   0.93   yes  VPN gateway (internet-facing)
2  CVE-2026-90412   9.8   0.02   no   Lab test VM (isolated VLAN)
3  CVE-2026-91550   7.8   0.05   no   Finance laptop (local privesc)
4  CVE-2026-90977   6.5   0.01   no   Intranet wiki (internal only)`,
    choices: [
      '#2: it has the highest CVSS score',
      '#1: exploited in the wild, likely, and exposed',
      '#3: finance data is the most sensitive',
      '#4: it is the fastest one to patch',
    ],
    answer: '#1: exploited in the wild, likely, and exposed',
    misconceptions: { '#2: it has the highest CVSS score': 'vuln-cvss-priority' },
    explanation:
      'Priority = severity **plus** likelihood **plus** exposure **plus** asset value. #1 is on the KEV list (attackers are using it now), has a very high EPSS and sits on the internet edge that every attacker can reach. #2 scores higher but is unlikely to be exploited and lives on an isolated lab VM. #3 needs local access first. Risk-based prioritisation beats sorting by the CVSS column.',
  },
  {
    id: 'vm-08',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is the main advantage of a **credentialed** (authenticated) scan over a non-credentialed one?',
    choices: [
      'It sees installed patches and local software versions',
      'It is faster because it skips the slow network-level port checks',
      'It cannot produce any false positives',
      'It tests the host the way an outside attacker would',
    ],
    answer: 'It sees installed patches and local software versions',
    misconceptions: {
      'It tests the host the way an outside attacker would': 'vuln-noncred-complete',
      'It cannot produce any false positives': 'vuln-scanner-always-right',
    },
    explanation:
      'With credentials the scanner logs in (SSH, SMB/WMI) and reads the package list, registry and file versions, so it finds missing patches and local issues that are invisible from the network. A **non-credentialed** scan is the outside attacker\'s view: open ports, banners and remotely testable flaws, and it guesses versions from banners. Both still need validation.',
  },
  {
    id: 'vm-09',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A non-credentialed scan reports this on a RHEL server. The admin says the fix was applied last month. What is the most likely explanation?',
    snippet: `Plugin 991203  High  ExampleSSL < 3.0.15 Multiple Vulnerabilities
Host: 10.20.8.41  Port: 443/tcp
Detection: version taken from the HTTP Server banner: "ExampleSSL/3.0.7"
CVSS v3.1: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
Note: remote check; local package list not examined`,
    choices: [
      'The admin is wrong and the server is still vulnerable',
      'The vendor backported the fix without changing the banner',
      'The scanner detected an attacker\'s exploit being run against the server',
      'Port 443 is closed, so the finding cannot be real',
    ],
    answer: 'The vendor backported the fix without changing the banner',
    misconceptions: { 'The admin is wrong and the server is still vulnerable': 'vuln-scanner-always-right' },
    explanation:
      'Enterprise Linux vendors often **backport** security fixes into the old version number, so the banner still says 3.0.7 while the package is patched. A banner-based, non-credentialed check cannot tell. Validate with a credentialed scan or by checking the package changelog for the CVE before you call it a false positive, and document the evidence either way.',
  },
  {
    id: 'vm-10',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'understand',
    prompt: 'Which are legitimate **compensating controls** while a patch cannot be applied? Select all that apply.',
    choices: [
      'A WAF or IPS rule that blocks the known exploit request',
      'Disabling the vulnerable feature or service',
      'Restricting access to the service by source IP',
      'Lowering the CVSS score in the scanner to Medium',
      'Hiding the finding from the dashboard until next quarter',
    ],
    answer: ['A WAF or IPS rule that blocks the known exploit request', 'Disabling the vulnerable feature or service', 'Restricting access to the service by source IP'],
    misconceptions: { 'Hiding the finding from the dashboard until next quarter': 'vuln-exception-forever' },
    explanation:
      'A compensating control reduces the **likelihood or impact** of exploitation when the real fix must wait: a "virtual patch" at the WAF or IPS, turning the feature off, or shrinking who can reach it. Editing the score or hiding the finding changes the report, not the risk. Compensating controls are temporary and should be tracked until the patch lands.',
  },
  {
    id: 'vm-11',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'The patch for a critical finding was deployed yesterday by the change team. What closes the finding?',
    choices: [
      'The change ticket marked "Completed"',
      'A rescan or check showing the fixed version',
      'The system owner confirming by email',
      'The next monthly report without it',
    ],
    answer: 'A rescan or check showing the fixed version',
    misconceptions: {
      'The change ticket marked "Completed"': 'vuln-patch-equals-fixed',
      'The system owner confirming by email': 'vuln-patch-equals-fixed',
    },
    explanation:
      '**Remediation verification** means evidence from the asset itself: a rescan (ideally credentialed) that no longer finds the issue, or a version check. Patches fail silently, need reboots that never happen, or land on the wrong server. A ticket or an email records intent, not the state of the host.',
  },
  {
    id: 'vm-12',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'understand',
    prompt: 'A risk acceptance (exception) for an unpatchable finding should include which of these? Select all that apply.',
    choices: [
      'A named business owner who accepts the risk',
      'An expiry or review date',
      'The compensating controls in place',
      'A promise that the finding will be removed from future scans',
      'Approval by the analyst who found it',
    ],
    answer: ['A named business owner who accepts the risk', 'An expiry or review date', 'The compensating controls in place'],
    misconceptions: {
      'A promise that the finding will be removed from future scans': 'vuln-exception-forever',
      'Approval by the analyst who found it': 'vuln-exception-forever',
    },
    explanation:
      'Risk is accepted by someone with the **authority** to own it (the business owner), for a **limited time**, with the **controls** that make it tolerable written down. The finding keeps showing in scans, marked as an accepted exception, so the review date is not forgotten. Analysts document and advise; they do not accept business risk.',
  },
  {
    id: 'vm-13',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Read this scanner finding. Which statement is correct?',
    snippet: `Plugin 990142  Critical  ExampleVPN Gateway < 9.4.2 Authentication Bypass
CVE: CVE-2026-91007   CWE-288 (Authentication bypass using an alternate path)
Host: vpn-gw01.corp.example (203.0.113.10)   Port: 443/tcp
CVSS v3.1: 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
EPSS: 0.94 (99th percentile)   CISA KEV: yes, added 2026-09-14
Output: Installed version 9.3.1 (from /remote/info endpoint)   Fixed version: 9.4.2`,
    choices: [
      'It needs a logged-in user to click a link, so it can wait',
      'It is only exploitable from inside the corporate network',
      'An unauthenticated remote attacker can use it, and people are',
      'The CWE shows it is only a denial-of-service bug, with no data loss',
    ],
    answer: 'An unauthenticated remote attacker can use it, and people are',
    misconceptions: { 'It is only exploitable from inside the corporate network': 'vuln-cvss-priority' },
    explanation:
      'AV:N and PR:N mean anyone who can reach port 443 needs no account; UI:N means no user action. KEV = yes means exploitation has been seen in the wild. The host is on a public IP. This is a drop-everything finding: patch or mitigate today, then **hunt** for signs it was already used (new admin accounts, odd sessions, web shells), because on a KEV edge device the patch may arrive after the attacker.',
  },
  {
    id: 'vm-14',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is the difference between a **CWE** and a **CVE**?',
    choices: [
      'CWE is a type of weakness; CVE is one specific instance of a flaw',
      'CWE is used for web applications only; CVE covers operating systems and devices',
      'CWE is the severity score; CVE is the exploit code',
      'CWE lists exploited flaws; CVE lists unexploited ones',
    ],
    answer: 'CWE is a type of weakness; CVE is one specific instance of a flaw',
    explanation:
      'A **CWE** (Common Weakness Enumeration) is a class of mistake, like CWE-79 cross-site scripting or CWE-22 path traversal. A **CVE** is one real occurrence of a weakness in one product and version. Many CVEs map to the same CWE, which is useful for spotting patterns in your own code or suppliers.',
  },
  {
    id: 'vm-15',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Two findings on the same web server. Which statement about the vectors is right?',
    snippet: `A  CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N   6.1
B  CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H   8.8`,
    choices: [
      'A needs a victim to act, and its impact reaches other components',
      'B can be exploited by anyone on the internet with no account at all',
      'A is local-only, which is why its score is lower than B',
      'B changes scope, so it affects the users\' browsers too',
    ],
    answer: 'A needs a victim to act, and its impact reaches other components',
    explanation:
      'A is the classic reflected XSS shape: UI:R (a user must click), S:C (the script runs in the victim\'s browser, a different security scope from the server), low C and I. B needs a low-privileged account (PR:L) but then gives full control of the component, scope unchanged. Neither is local (both AV:N). Reading the vector tells you **how** it is exploited, which matters more for defence than the number.',
  },
  {
    id: 'vm-16',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'remember',
    prompt: 'In CVSS v4.0, which new base metric (two words, abbreviated **AT**) captures conditions of the target that must exist for the attack to work, such as a race condition or a specific configuration?',
    accept: ['attack requirements', 'attack requirement'],
    explanation:
      '**Attack Requirements (AT)**: None or Present. v4.0 split the old Attack Complexity idea into AC (defences the attacker must defeat) and AT (preconditions of the target). v4.0 also replaced Scope with separate impacts on the **vulnerable system** (VC/VI/VA) and **subsequent systems** (SC/SI/SA), and User Interaction now has None, Passive and Active.',
  },
  {
    id: 'vm-17',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'apply',
    prompt: 'This CVSS v4.0 vector is on an advisory. What does the **E:A** at the end change?',
    snippet: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N/E:A',
    choices: [
      'It is a threat metric: exploitation has been reported, so the score stays at its worst',
      'It means the attack is automated, which doubles the base score',
      'It marks the vector as an estimate awaiting vendor confirmation',
      'It is an environmental metric lowering the score for your network',
    ],
    answer: 'It is a threat metric: exploitation has been reported, so the score stays at its worst',
    explanation:
      '**E** is Exploit Maturity, a v4.0 Threat metric: A = Attacked, P = POC, U = Unreported. The base vector here scores 9.3 (CVSS-B). With E:A the CVSS-BT score stays 9.3; with E:U it would drop to 8.1. So in v4.0 threat intelligence can **lower** a score when no one is exploiting the bug, and a score should be labelled with the metrics used (CVSS-B, CVSS-BT, CVSS-BTE).',
  },
  {
    id: 'vm-18',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Your policy says: "Critical 7 days, High 30 days, Medium 90 days; KEV-listed and internet-facing: 72 hours." A High (8.1) finding on the public web server was added to KEV this morning. What is the deadline?',
    choices: ['30 days, per the High band', '7 days, rounding it up to Critical', '72 hours, per the KEV override', '90 days, because it is below 9.0'],
    answer: '72 hours, per the KEV override',
    misconceptions: { '30 days, per the High band': 'vuln-cvss-priority' },
    explanation:
      'The most specific, strictest rule wins. SLAs are usually a floor set by severity, with **overrides** for exploited or exposed vulnerabilities. A KEV listing is evidence attackers are already using it, and internet exposure means they can reach it, so the severity band alone would set the wrong clock.',
  },
  {
    id: 'vm-19',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which findings from an **external** (internet-facing) scan deserve the fastest attention? Select all that apply.',
    snippet: `203.0.113.10  443/tcp  ExampleVPN 9.3.1 auth bypass (KEV)
203.0.113.21  3389/tcp RDP exposed to the internet, NLA enabled
203.0.113.25  443/tcp  TLS certificate expires in 45 days
203.0.113.30  22/tcp   SSH banner shows OpenSSH-for-Example 9.6
203.0.113.40  9200/tcp Search database, no authentication required`,
    choices: [
      '203.0.113.10: KEV-listed auth bypass',
      '203.0.113.21: RDP open to the internet',
      '203.0.113.40: database with no authentication',
      '203.0.113.25: certificate expiring in 45 days',
      '203.0.113.30: SSH banner shows a version',
    ],
    answer: ['203.0.113.10: KEV-listed auth bypass', '203.0.113.21: RDP open to the internet', '203.0.113.40: database with no authentication'],
    explanation:
      'An exploited edge-device flaw, internet-exposed RDP (a top ransomware entry point, brute-forced constantly even with NLA) and an unauthenticated database (a data breach waiting to be indexed) are all urgent. A certificate expiring in 45 days is hygiene with a calendar, and a version banner by itself is informational until it maps to a real vulnerability.',
  },
  {
    id: 'vm-20',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Why can a scanner report a vulnerability that does not really exist on the host?',
    choices: [
      'Scanners often infer from versions or banners, not proof',
      'Scanners run real exploits against the host and sometimes they misfire',
      'Scanners only report CVEs that are listed in KEV',
      'It cannot: every finding is verified by the vendor',
    ],
    answer: 'Scanners often infer from versions or banners, not proof',
    misconceptions: { 'It cannot: every finding is verified by the vendor': 'vuln-scanner-always-right' },
    explanation:
      'Most checks are **inferences**: "version X is below fixed version Y" or "the banner matches". Backported fixes, custom builds, disabled modules and shared banners all fool them. That is why findings are validated (credentialed check, config review, vendor advisory) before anyone argues with a system owner, and why false negatives exist too.',
  },
  {
    id: 'vm-21',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A medical-imaging workstation runs an unsupported OS that cannot be patched until the vendor certifies an upgrade next year. Its scan shows 14 critical findings. What is the best response?',
    choices: [
      'Isolate it on a restricted segment and log a time-boxed exception',
      'Install the unsupported OS patches anyway: security beats vendor support',
      'Exclude it from scanning so the dashboard stops showing red',
      'Accept the risk yourself and revisit if an incident happens',
    ],
    answer: 'Isolate it on a restricted segment and log a time-boxed exception',
    misconceptions: {
      'Exclude it from scanning so the dashboard stops showing red': 'vuln-exception-forever',
      'Accept the risk yourself and revisit if an incident happens': 'vuln-exception-forever',
    },
    explanation:
      'When patching is impossible, reduce **exposure**: segment the device, allow only the flows it needs, monitor it closely, and record a formal exception with the business owner, the compensating controls and a review date tied to the vendor\'s upgrade. Unsupported patches can break a regulated medical device; excluding it from scans hides the risk; and an analyst cannot accept business risk alone.',
  },
  {
    id: 'vm-22',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'remember',
    prompt: 'A critical flaw is being exploited in the wild **before** the vendor has released any patch. What is this called? (two words, or hyphenated)',
    accept: ['zero day', 'zero-day', '0-day', '0 day', 'zeroday', 'a zero day', 'a zero-day', 'zero-day vulnerability', 'zero day vulnerability'],
    explanation:
      'A **zero-day**: defenders have had zero days to patch. The toolbox is then compensating controls (disable the feature, restrict access, WAF/IPS rules from the vendor advisory), heightened monitoring and threat hunting for signs of prior exploitation.',
  },
  {
    id: 'vm-23',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Two scans of the same host a week apart. What most likely changed?',
    snippet: `Scan A (credentialed)      Findings: 41   (Critical 3, High 12)
Scan B (credentialed)      Findings: 6    (Critical 0, High 1)
Scan B log: "SMB login failed for svc_vulnscan: account locked out. Falling back to remote checks."`,
    choices: [
      'The team patched 35 findings in one week',
      'Scan B silently ran without credentials',
      'The host was rebuilt from a new image',
      'The scanner plugins were rolled back',
    ],
    answer: 'Scan B silently ran without credentials',
    misconceptions: { 'The team patched 35 findings in one week': 'vuln-noncred-complete' },
    explanation:
      'The log says it: the scan account was locked out, so scan B fell back to **remote checks only** and could not see local patch levels. A sudden drop in findings is a data-quality question before it is a victory. Monitor "credentialed check success" per host, or you will report improvements that are really blind spots.',
  },
  {
    id: 'vm-24',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Your CISO asks for one line in the monthly board report about vulnerability management. Which is the most useful?',
    choices: [
      '"We found 18,402 vulnerabilities this month, 2,100 more than last month."',
      '"All 9 KEV-listed flaws on internet-facing systems fixed within SLA; median 3 days."',
      '"Our scanner ran 412 plugins with a 99.1% completion rate on schedule."',
      '"CVSS average across the estate fell from 6.4 to 6.1 this quarter."',
    ],
    answer: '"All 9 KEV-listed flaws on internet-facing systems fixed within SLA; median 3 days."',
    explanation:
      'Stakeholders need **risk and performance against a promise**: are the dangerous, exposed things fixed within the agreed time? Raw finding counts grow with every new asset and plugin, scanner run statistics are operational detail, and an average CVSS hides the one critical on the VPN. Good VM metrics: SLA compliance, mean time to remediate by severity, KEV exposure, exceptions past review date and trend lines.',
  },
  {
    id: 'vm-25',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'The server team says a finding is a false positive. Which evidence would support closing it as one? Select all that apply.',
    choices: [
      'A credentialed check shows the fixed package version installed',
      'The vendor advisory says the flaw needs a module this host does not load, and config confirms it',
      'The package changelog lists the CVE as fixed in the installed build',
      'The server team says they are too busy to patch this month',
      'The finding is only rated Medium',
    ],
    answer: [
      'A credentialed check shows the fixed package version installed',
      'The vendor advisory says the flaw needs a module this host does not load, and config confirms it',
      'The package changelog lists the CVE as fixed in the installed build',
    ],
    misconceptions: { 'The finding is only rated Medium': 'vuln-cvss-priority' },
    explanation:
      'A false positive is a claim about the **host\'s real state**, so it needs evidence from the host or vendor: installed version, backport changelog, or proof the vulnerable component is absent or disabled. Being busy is a reason for an exception request, not a false positive, and severity has nothing to do with whether the finding is real.',
  },
  {
    id: 'vm-26',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A KEV-listed flaw on the internet-facing VPN was patched at 10:00 today. It was published 9 days ago. What should the SOC do next?',
    choices: [
      'Close the incident: the patch removes the vulnerability',
      'Hunt for exploitation in the 9-day window before the patch',
      'Wait for the next monthly scan to confirm the fix',
      'Reset every user password in the company as a precaution',
    ],
    answer: 'Hunt for exploitation in the 9-day window before the patch',
    misconceptions: { 'Close the incident: the patch removes the vulnerability': 'vuln-patch-equals-fixed' },
    explanation:
      'Patching closes the door; it does not evict anyone who already walked in. For an exploited edge device, check the vendor\'s indicators, device logs, new local accounts, config changes and outbound connections for the exposure window, and verify the patch with a rescan now rather than next month. A company-wide password reset may follow if evidence shows credential theft, but it is not the first step.',
  },
  {
    id: 'vm-27',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is an **agent-based** vulnerability scan best at?',
    choices: [
      'Covering laptops that are rarely on the office network',
      'Showing exactly what an internet attacker sees from outside the firewall',
      'Finding devices nobody knew were on the network',
      'Testing printers and network gear with no OS access',
    ],
    answer: 'Covering laptops that are rarely on the office network',
    explanation:
      'An agent runs on the host and reports home from anywhere, so roaming laptops and cloud VMs get assessed with local (credentialed-level) visibility. Network scans are better for the outside view, for discovering unknown devices, and for appliances where you cannot install an agent. Mature programmes use both.',
  },
  {
    id: 'vm-28',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'The attack surface management (ASM) tool reports this. Why does it matter more than a new finding on a known server?',
    snippet: `New internet-facing asset discovered
Hostname: legacy-portal.corp-example.example   IP: 198.51.100.77
Source: certificate transparency log + DNS enumeration
Services: 443/tcp ExampleCMS 4.2 (end of life), admin login page exposed
CMDB owner: none   Vulnerability scans: never`,
    choices: [
      'It is outside the CMDB, unowned and unscanned, so nothing protects it',
      'ASM findings are always critical because they are discovered from the internet',
      'Certificate transparency proves the site has been compromised',
      'It only matters if its CVSS score is higher than the known server',
    ],
    answer: 'It is outside the CMDB, unowned and unscanned, so nothing protects it',
    explanation:
      'You cannot patch what you do not know you have. **Attack surface management** discovers internet-facing assets from the outside (CT logs, DNS, IP scans), the way attackers do. An unowned, never-scanned, end-of-life CMS with an exposed admin page is a classic breach origin. The first actions are to find an owner, take it offline or put it behind access control, and bring it into scanning.',
  },
  {
    id: 'vm-29',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A cloud posture (CSPM) tool flags a storage bucket. Which action best fits vulnerability-management practice?',
    snippet: `Finding: Storage bucket "exports-2024" allows public read (anonymous)
Account: 111122223333   Contents: 3,400 objects, last write 2024-11-02
Tags: owner=unknown  data-class=unknown
Policy baseline: CIS benchmark "block public access at account level" not enabled`,
    choices: [
      'Wait for a CVE to be published before acting on it',
      'Block public access, find an owner, then check access logs',
      'Delete the bucket straight away to remove the risk',
      'Lower its priority because misconfigurations are not vulnerabilities',
    ],
    answer: 'Block public access, find an owner, then check access logs',
    explanation:
      'In the cloud, **misconfigurations** are the vulnerabilities, and they never get CVEs. Contain first (block public access, which is reversible), then find the owner and data class, and check the access logs to learn whether anyone already downloaded the data. Deleting destroys evidence and possibly business data. Enabling the account-level baseline stops the next one.',
  },
  {
    id: 'vm-30',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'Using the v3.1 bands, what severity is `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` (score 6.1)? (one word)',
    accept: ['medium'],
    misconceptions: { high: 'vuln-cvss-priority' },
    explanation:
      '**Medium** (4.0–6.9). This is a typical reflected XSS vector. "Medium" does not mean "ignore": XSS on a login page used for session theft can matter more than a High on an isolated box. Severity is one input to priority, not the answer.',
  },
  {
    id: 'vm-31',
    skill: S,
    difficulty: 3,
    type: 'multi',
    bloom: 'evaluate',
    prompt: 'A system owner has missed the 30-day SLA on a High finding twice. Which responses are appropriate? Select all that apply.',
    choices: [
      'Escalate through the agreed governance path with the risk explained',
      'Offer an exception process if there is a real blocker, with an expiry',
      'Propose a compensating control while the patch is scheduled',
      'Patch the server yourself overnight without a change ticket',
      'Quietly downgrade the finding to Medium to reset the clock',
    ],
    answer: [
      'Escalate through the agreed governance path with the risk explained',
      'Offer an exception process if there is a real blocker, with an expiry',
      'Propose a compensating control while the patch is scheduled',
    ],
    misconceptions: { 'Quietly downgrade the finding to Medium to reset the clock': 'vuln-exception-forever' },
    explanation:
      'The SOC\'s role is to make risk visible and help the owner fix it: escalate as the policy says, offer the exception route for genuine blockers, and suggest mitigations. Unapproved changes can cause outages and break trust, and editing severity to meet an SLA falsifies the report the business relies on.',
  },
  {
    id: 'vm-32',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Which statement describes the **vulnerability management lifecycle**?',
    choices: [
      'Scan once a year before the audit, then fix whatever the auditor lists',
      'Discover assets, assess, prioritise, remediate, verify, report, repeat',
      'Patch everything on Patch Tuesday each month; scanning is only needed for servers',
      'Buy a scanner, export its findings, and send them to the IT team',
    ],
    answer: 'Discover assets, assess, prioritise, remediate, verify, report, repeat',
    explanation:
      'Vulnerability management is a **continuous cycle**: know your assets, find weaknesses, rank them by risk, fix or mitigate, prove the fix, report, and go round again as new CVEs and new assets appear every day. Annual scans and "throw the export over the wall" are how organisations end up breached through a flaw that was on a report for months.',
  },
];

const lesson = {
  skill: S,
  title: 'Vulnerability management',
  goal: 'Read scanner output, score and prioritise by real risk, and drive a finding all the way to a verified fix or a documented exception.',
  sections: [
    {
      id: 'scanners',
      heading: 'Scanners and what their findings really say',
      body: [
        'A vulnerability scanner (Nessus, OpenVAS, Qualys and friends) checks hosts against thousands of **plugins**. Each finding names the host and port, the plugin, the CVE(s), a CVSS score and the evidence the check used. That evidence line is the most important part: it tells you whether the scanner **proved** something or **inferred** it from a version banner.',
        'How you scan decides what you see. A **credentialed** scan logs in and reads installed packages and patches; a **non-credentialed** scan sees only what the network shows, like an outside attacker. **Agents** cover roaming laptops and cloud VMs; **network scans** find devices nobody registered. **External** scans show the internet view; **internal** scans show what an attacker who is already inside could reach.',
      ],
      evidence: {
        label: 'A scanner finding (fictional product and CVE)',
        text: 'Plugin 990142  Critical  ExampleVPN Gateway < 9.4.2 Authentication Bypass\nCVE: CVE-2026-91007   CWE-288\nHost: vpn-gw01.corp.example (203.0.113.10)  Port: 443/tcp\nCVSS v3.1: 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)\nEPSS: 0.94   CISA KEV: yes\nOutput: Installed version 9.3.1 (from /remote/info)   Fixed version: 9.4.2',
      },
      points: [
        '**False positives** happen: vendors backport fixes without changing the version, banners lie, modules are disabled. Validate before you argue with an owner.',
        '**False negatives** happen too: a failed login silently turns a credentialed scan into a remote-only one. Watch the "credentialed checks succeeded" flag.',
      ],
    },
    {
      id: 'scoring',
      heading: 'CVE, CWE and CVSS vectors',
      body: [
        'A **CVE** names one disclosed flaw in one product. A **CWE** names the kind of mistake (CWE-79 XSS, CWE-89 SQL injection, CWE-22 path traversal). **CVSS** scores technical severity from 0 to 10: Low 0.1–3.9, Medium 4.0–6.9, High 7.0–8.9, Critical 9.0–10.0.',
        'Read the **vector**, not just the number. In v3.1: AV (Network, Adjacent, Local, Physical), AC (Low/High), PR (privileges None/Low/High), UI (user interaction None/Required), S (scope Unchanged/Changed) and the C/I/A impacts. `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` = 9.8: anyone on the network, no account, no clicks, full impact. CVSS **v4.0** adds AT (attack requirements), replaces scope with vulnerable-system (VC/VI/VA) and subsequent-system (SC/SI/SA) impacts, and adds optional Threat metrics such as Exploit Maturity (E).',
      ],
      points: [
        'CVSS is **severity**, not risk. It knows nothing about your asset or whether attackers are using the flaw.',
        'Label v4.0 scores by what they include: CVSS-B (base), CVSS-BT (base + threat), CVSS-BTE (+ environmental).',
      ],
    },
    {
      id: 'prioritise',
      heading: 'Prioritise by risk: likelihood, exposure, value',
      body: [
        'Every organisation has more findings than people. Rank them by **risk**, combining four questions: How bad is it (CVSS)? How likely is exploitation (**EPSS**, a 0–1 probability of exploitation activity in the next 30 days)? Is it already exploited (**CISA KEV**)? How exposed and important is this asset (internet-facing, crown jewel, compensating controls)?',
        'A KEV-listed 8.1 on the internet-facing VPN beats a 9.8 on an isolated lab VM every time. Good SLAs reflect this: a severity floor ("Critical 7 days") plus overrides for KEV and internet exposure ("72 hours, per the KEV override").',
      ],
      evidence: {
        label: 'Same queue, two orders',
        text: 'Sorted by CVSS:  9.8 lab VM  >  8.1 VPN (KEV)  >  7.8 laptop  >  6.5 wiki\nSorted by risk:  8.1 VPN (KEV, EPSS 0.93, internet)  >  7.8 laptop  >  9.8 lab VM (isolated)  >  6.5 wiki',
      },
    },
    {
      id: 'remediate',
      heading: 'Fix, mitigate or accept, then verify',
      body: [
        'There are three honest outcomes. **Remediate** (patch, upgrade, reconfigure). **Mitigate** with a compensating control while the fix waits: a WAF/IPS virtual patch, disabling the feature, restricting who can reach it. Or **accept** the risk formally: a named business owner, the controls in place, and an expiry date. Hiding a finding, excluding a host from scans or editing its score are not outcomes; they are falsified reports.',
        'A finding closes on **evidence from the asset**: a rescan or version check that shows the fix. Change tickets record intent; patches fail, reboots are skipped. For exploited edge devices, also **hunt** for use of the flaw during the window before the patch.',
      ],
    },
    {
      id: 'report-asm',
      heading: 'Reporting, attack surface and cloud posture',
      body: [
        'Report **risk and performance**, not volume: SLA compliance by severity, mean time to remediate, KEV exposure on internet-facing systems, exceptions past their review date, and trends. "18,000 findings" frightens people without telling them anything.',
        'The biggest gaps are often assets nobody scans. **Attack surface management** finds internet-facing hosts from the outside (certificate transparency, DNS, IP ranges) the way attackers do. **Cloud posture management** (CSPM) checks cloud settings against baselines such as the CIS benchmarks: a public bucket or an admin port open to the world never gets a CVE, but it is a vulnerability all the same.',
      ],
    },
  ],
  worked: [
    {
      id: 'vm-w1',
      title: 'Ordering four findings by risk',
      artifactLabel: 'Scanner export · top findings',
      artifact:
        '#  CVE              CVSS  EPSS   KEV  Asset\n1  CVE-2026-90412   9.8   0.02   no   Lab test VM (isolated VLAN)\n2  CVE-2026-91007   8.1   0.93   yes  VPN gateway (internet-facing)\n3  CVE-2026-91550   7.8   0.05   no   Finance laptop (local privilege escalation)\n4  CVE-2026-90977   6.5   0.01   no   Intranet wiki (internal only)',
      question: 'Which order should these be fixed in, and why?',
      steps: [
        'Start with exploitation evidence: only #2 is on KEV, and its EPSS of 0.93 agrees. Attackers are using it now.',
        'Add exposure: #2 is on the internet edge, reachable by anyone. #1 sits on an isolated VLAN; #3 needs a foothold on the laptop first; #4 is internal only.',
        'Then severity and asset value: #3 is a local privilege escalation on a laptop with finance data, a common second step after phishing. #1 has the top CVSS but low likelihood and little reach.',
        'Check the SLA overrides: KEV plus internet-facing puts #2 on the 72-hour clock regardless of its "High" band.',
      ],
      conclusion: 'Order: #2 today (and hunt for prior exploitation), then #3, then #1 and #4 within their normal SLAs. Write the reasoning on the ticket so the owners see why the 9.8 is not first.',
    },
  ],
  faded: [
    {
      id: 'vm-f1',
      title: 'A disputed finding',
      artifactLabel: 'Finding + server team reply',
      artifact:
        'Plugin 991203  High  ExampleSSL < 3.0.15 Multiple Vulnerabilities\nHost: 10.20.8.41 (RHEL)  Port: 443/tcp\nDetection: version from HTTP banner "ExampleSSL/3.0.7"  (remote check only)\nServer team: "We patched this in August. It\'s a false positive, close it."',
      question: 'Should the finding be closed as a false positive?',
      given: [
        'The detection line says the version came from a banner and the check was remote only: the scanner inferred the flaw, it did not prove it.',
        'RHEL-style vendors often backport fixes without changing the upstream version string, so a banner can stay at 3.0.7 after patching.',
      ],
      todo: [
        {
          prompt: 'What should you ask for before closing it?',
          type: 'mc',
          choices: [
            'A credentialed check or package changelog showing the CVEs fixed',
            'A signed email from the server team lead',
            'Nothing: the team said it is patched',
          ],
          answer: 'A credentialed check or package changelog showing the CVEs fixed',
          explanation: 'A false positive is a claim about the host, so it needs host evidence: the installed package build and its changelog, or a credentialed rescan. An email is an opinion.',
        },
        {
          prompt: 'The credentialed rescan shows the patched build installed. How do you record the outcome?',
          type: 'mc',
          choices: [
            'False positive, with the evidence attached, and tune the plugin to use credentialed checks',
            'Risk accepted by the server team',
            'Remediated, with a note that the patch is pending',
          ],
          answer: 'False positive, with the evidence attached, and tune the plugin to use credentialed checks',
          explanation: 'It was never vulnerable after August, so it is a false positive, not an accepted risk. Attaching the evidence lets the next reviewer trust the closure, and fixing the credential gap stops the same argument next month.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'vuln-cvss-priority',
    skill: S,
    name: 'CVSS score = patch order',
    description: 'Sorts the patch queue by the CVSS number and ignores exploitation, exposure and asset value.',
    fix: 'CVSS measures technical severity in a vacuum. Priority also needs likelihood (EPSS, KEV: is anyone exploiting it?), exposure (internet-facing? reachable?) and the asset\'s value. A KEV-listed 8.1 on the VPN beats an unexploited 9.8 on an isolated lab VM.',
    lesson: `${S}#prioritise`,
  },
  {
    id: 'vuln-scanner-always-right',
    skill: S,
    name: 'The scanner is always right',
    description: 'Treats every scanner finding as proven, or assumes the scanner cannot be wrong.',
    fix: 'Most checks infer a flaw from a version or banner. Backported fixes, custom builds and disabled modules create false positives; failed logins create false negatives. Read the evidence line, validate with a credentialed check or the vendor changelog, and record the proof either way.',
    lesson: `${S}#scanners`,
  },
  {
    id: 'vuln-noncred-complete',
    skill: S,
    name: 'A remote scan sees everything',
    description: 'Believes a non-credentialed or silently failed scan gives a complete picture of a host.',
    fix: 'Without credentials a scanner sees only open ports, banners and remotely testable flaws. Missing patches, local privilege escalations and vulnerable libraries stay invisible. A sudden drop in findings often means credentials failed: check the credentialed-check status before reporting progress.',
    lesson: `${S}#scanners`,
  },
  {
    id: 'vuln-patch-equals-fixed',
    skill: S,
    name: 'Patch deployed = problem solved',
    description: 'Closes a finding on a change ticket or email, and forgets that attackers may have used the flaw before the patch.',
    fix: 'Close findings on evidence from the asset: a rescan or version check. Patches fail and reboots get skipped. For exploited (KEV) flaws on exposed systems, also hunt for exploitation during the window before the patch, because patching does not evict an attacker who is already in.',
    lesson: `${S}#remediate`,
  },
  {
    id: 'vuln-exception-forever',
    skill: S,
    name: 'Make the finding go away',
    description: 'Handles an unfixable finding by hiding it, excluding the host, editing the score or accepting risk without an owner or expiry.',
    fix: 'An exception is a formal, time-boxed decision by a business owner with authority, with compensating controls written down, and the finding stays visible in scans as "accepted". Hiding it, excluding the host or lowering its severity changes the report, not the risk.',
    lesson: `${S}#remediate`,
  },
];

export const VULN = { items, lesson, misconceptions };

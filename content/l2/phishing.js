// Level 2 · Phishing & email analysis: questions, lesson and misconceptions.
// Domains are reserved examples (*.example); IPs are documentation or private ranges.

const AUTH_SPOOF = `From: "Accounts Receivable" <ar@northwind-supply.example>
Reply-To: <ar.northwind@freemail.example>
Return-Path: <bounce@fastpost-relay.example>
Authentication-Results: mx-in.corp.example;
  spf=pass smtp.mailfrom=fastpost-relay.example;
  dkim=none (message not signed);
  dmarc=fail (p=none) header.from=northwind-supply.example`;

const items = [
  {
    id: 'ph-01',
    skill: 'l2-phishing',
    difficulty: 1,
    type: 'mc',
    prompt: 'A user clicks **Reply** on an email. Which header decides where the reply goes?',
    choices: ['Reply-To (if present), otherwise From', 'Return-Path', 'Received', 'Message-ID'],
    answer: 'Reply-To (if present), otherwise From',
    misconceptions: { 'Return-Path': 'phish-from-trust' },
    explanation:
      'Replies go to **Reply-To** when it is set, otherwise to From. Business email compromise (BEC) abuses this: From shows a trusted name, Reply-To quietly points at the attacker\'s mailbox. Return-Path (the envelope sender) is where bounces go, and Received headers record the relay path.',
  },
  {
    id: 'ph-02',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'A finance user reports this email asking to change a supplier\'s bank details. What do the headers show?',
    snippet: AUTH_SPOOF,
    choices: [
      'SPF passed only for the relay\'s domain, not the From domain; DMARC failed, so the From address is spoofed',
      'SPF passed, so the email really came from Northwind',
      'DMARC failed only because DKIM is missing, which is normal for suppliers',
      'Nothing: Reply-To addresses are always different from From',
    ],
    answer: 'SPF passed only for the relay\'s domain, not the From domain; DMARC failed, so the From address is spoofed',
    misconceptions: {
      'SPF passed, so the email really came from Northwind': 'phish-dmarc-alignment',
      'Nothing: Reply-To addresses are always different from From': 'phish-from-trust',
    },
    explanation:
      'SPF checks the **envelope** domain (smtp.mailfrom = fastpost-relay.example), which is not the domain the user sees. DMARC requires SPF or DKIM to pass **for a domain aligned with the From header**; neither does, so dmarc=fail. Northwind publishes p=none, so the message was delivered anyway. Add the Reply-To pointing at a freemail address and a bank-change request: classic BEC.',
  },
  {
    id: 'ph-03',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'In which order do you read **Received** headers to trace an email from its origin?',
    choices: [
      'Bottom to top: each server adds its line on top, so the lowest is the earliest hop',
      'Top to bottom: the first line is where the email started',
      'Any order: they are sorted alphabetically',
      'Only the top line matters',
    ],
    answer: 'Bottom to top: each server adds its line on top, so the lowest is the earliest hop',
    explanation:
      'Every mail server prepends a Received line, so the chain reads upward from the origin to your mailbox. Only lines added by servers you trust (your own gateway and above) are reliable: anything below them could have been forged by the sender.',
  },
  {
    id: 'ph-04',
    skill: 'l2-phishing',
    difficulty: 1,
    type: 'text',
    prompt: 'Which email authentication standard publishes a DNS TXT record listing the servers allowed to send mail for a domain?',
    accept: ['spf', 'sender policy framework'],
    misconceptions: { dkim: 'phish-dmarc-alignment', dmarc: 'phish-dmarc-alignment' },
    explanation:
      '**SPF** (Sender Policy Framework): a TXT record such as `v=spf1 include:_spf.mailhost.example -all`. The receiver checks the connecting IP against the envelope sender\'s domain. DKIM signs messages with a key published in DNS; DMARC ties SPF/DKIM to the visible From domain and sets the policy.',
  },
  {
    id: 'ph-05',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'text',
    prompt: 'Which DMARC policy value (p=...) asks receivers to refuse mail that fails DMARC?',
    accept: ['reject', 'p=reject'],
    explanation:
      'The three policies are `p=none` (monitor only: deliver and report), `p=quarantine` (send to spam/junk) and `p=reject` (refuse it during delivery). A domain on p=none can be spoofed straight into inboxes, which is why the DMARC result matters even when the policy does not block.',
  },
  {
    id: 'ph-06',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'An email shows `dkim=pass header.d=mailer.example`. What does that prove?',
    choices: [
      'mailer.example signed it and the signed headers and body were not changed in transit',
      'The email is safe to open',
      'The person named in From wrote it',
      'The email was encrypted end to end',
    ],
    answer: 'mailer.example signed it and the signed headers and body were not changed in transit',
    misconceptions: { 'The email is safe to open': 'phish-auth-pass-safe', 'The person named in From wrote it': 'phish-from-trust' },
    explanation:
      'DKIM proves **integrity and which domain signed** (d=). It says nothing about intent: attackers sign mail from their own domains, and mail from a compromised real account is signed too. It is also not encryption. Check alignment: is d= the same organisational domain as From?',
  },
  {
    id: 'ph-07',
    skill: 'l2-phishing',
    difficulty: 3,
    type: 'mc',
    prompt: 'A link in an email goes to the URL below. Which domain actually controls the page?',
    snippet: 'https://login.corp.example.account-verify.example/owa/?session=8841',
    choices: ['account-verify.example', 'corp.example', 'login.corp.example', 'owa'],
    answer: 'account-verify.example',
    misconceptions: { 'corp.example': 'phish-url-domain', 'login.corp.example': 'phish-url-domain' },
    explanation:
      'Read the hostname from the **right**: the registered domain is the part just before the top-level domain, here `account-verify.example`. Everything to its left (`login.corp.example.`) is a subdomain the attacker chose to look familiar. The path (`/owa/`) is also attacker-controlled decoration.',
  },
  {
    id: 'ph-08',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these are red flags in a reported email? Select all that apply.',
    choices: [
      'Urgent payment request with a deadline of "today"',
      'Reply-To points to a free webmail address while From shows a supplier',
      'The link text shows portal.corp.example but the real link goes elsewhere',
      'Attachment named Remittance.pdf.html',
      'It comes from a colleague you email daily, with DMARC pass, about a meeting you arranged',
    ],
    answer: [
      'Urgent payment request with a deadline of "today"',
      'Reply-To points to a free webmail address while From shows a supplier',
      'The link text shows portal.corp.example but the real link goes elsewhere',
      'Attachment named Remittance.pdf.html',
    ],
    misconceptions: { 'Reply-To points to a free webmail address while From shows a supplier': 'phish-from-trust' },
    explanation:
      'Urgency, a Reply-To that diverts replies, link text that differs from the real URL and double extensions (`.pdf.html` opens a local phishing page in the browser) are classic signs. An expected message from a known colleague with aligned authentication is not a red flag on its own, though a compromised account can still send phishing.',
  },
  {
    id: 'ph-09',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'A user says: "I clicked the link and typed my password, then it showed an error." The email has been deleted from their mailbox. What is the priority?',
    choices: [
      'Reset the password, revoke active sessions/tokens, then check sign-ins, MFA methods and inbox rules for attacker activity',
      'Nothing more: the email is deleted',
      'Tell the user to be more careful next time',
      'Block the sender address and close the ticket',
    ],
    answer: 'Reset the password, revoke active sessions/tokens, then check sign-ins, MFA methods and inbox rules for attacker activity',
    misconceptions: { 'Nothing more: the email is deleted': 'phish-delete-enough', 'Block the sender address and close the ticket': 'phish-delete-enough' },
    explanation:
      'The credentials are compromised whether or not the email still exists. A password reset alone does not kill existing sessions or stolen session cookies (adversary-in-the-middle kits steal those too), so revoke sessions. Then look for what the attacker did: new sign-ins, added MFA devices, inbox rules, sent mail.',
  },
  {
    id: 'ph-10',
    skill: 'l2-phishing',
    difficulty: 3,
    type: 'mc',
    prompt: 'Twenty minutes after a user clicked a phishing link, the mailbox audit log shows this. What does it indicate?',
    snippet: '09:41:12  Sign-in  user=emma@corp.example  ip=203.0.113.140  result=success  (new IP, new device)\n09:43:55  New-InboxRule  user=emma  name="."  condition: subject or body contains "invoice","payment","bank"\n                           action: move to folder "RSS Feeds", mark as read',
    choices: [
      'The account is compromised: the attacker is hiding replies about payments (email hiding rules, T1564.008)',
      'Emma is organising her inbox',
      'A normal spam filter update',
      'The phishing attempt failed',
    ],
    answer: 'The account is compromised: the attacker is hiding replies about payments (email hiding rules, T1564.008)',
    explanation:
      'A sign-in from a new IP and device right after the click, then a rule with a meaningless name that silently moves payment-related mail to an unused folder: this is the BEC playbook. The attacker hides replies from the real supplier or finance team while redirecting payments. Remove the rule, revoke sessions and check sent items.',
  },
  {
    id: 'ph-11',
    skill: 'l2-phishing',
    difficulty: 3,
    type: 'multi',
    prompt: 'One user reported a phishing email. How do you find out how big the campaign is? Select all that apply.',
    choices: [
      'Message trace for the same sender, subject or URL across all mailboxes',
      'Proxy/DNS logs for anyone who visited the phishing domain',
      'Sign-in logs for successful logons from the phishing kit\'s IPs after the email arrived',
      'EDR search for the attachment hash on endpoints',
      'Only check the reporter\'s mailbox',
    ],
    answer: [
      'Message trace for the same sender, subject or URL across all mailboxes',
      'Proxy/DNS logs for anyone who visited the phishing domain',
      'Sign-in logs for successful logons from the phishing kit\'s IPs after the email arrived',
      'EDR search for the attachment hash on endpoints',
    ],
    misconceptions: { 'Only check the reporter\'s mailbox': 'phish-delete-enough' },
    explanation:
      'Scope it in three layers: who **received** it (message trace), who **clicked** (proxy, DNS), who **gave something away** (sign-ins, EDR). The reporter is usually one of many recipients. Then purge the message from every mailbox and block the indicators.',
  },
  {
    id: 'ph-12',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'A legitimate newsletter was forwarded through a mailing list. Results: `spf=fail`, `dkim=pass header.d=corp.example`, From: news@corp.example. Does DMARC pass?',
    choices: [
      'Yes: DMARC needs SPF **or** DKIM to pass with alignment, and DKIM passes for corp.example',
      'No: SPF failed, so DMARC must fail',
      'No: DMARC needs both SPF and DKIM to pass',
      'DMARC does not apply to forwarded mail',
    ],
    answer: 'Yes: DMARC needs SPF **or** DKIM to pass with alignment, and DKIM passes for corp.example',
    misconceptions: {
      'No: SPF failed, so DMARC must fail': 'phish-dmarc-alignment',
      'No: DMARC needs both SPF and DKIM to pass': 'phish-dmarc-alignment',
    },
    explanation:
      'Forwarding changes the sending IP, so SPF often fails, but the DKIM signature survives if the message is not modified. DMARC passes when **either** SPF or DKIM passes for a domain aligned with the From header. Here DKIM d=corp.example matches From: pass.',
  },
  {
    id: 'ph-13',
    skill: 'l2-phishing',
    difficulty: 2,
    type: 'mc',
    prompt: 'An invoice email from billing@northwind-supp1y.example (with the digit 1) passes SPF, DKIM and DMARC. What does that tell you?',
    choices: [
      'Only that northwind-supp1y.example authorised it: a lookalike domain can pass everything',
      'It is genuinely from Northwind Supply',
      'It is safe to pay the invoice',
      'The domain must be at least a year old',
    ],
    answer: 'Only that northwind-supp1y.example authorised it: a lookalike domain can pass everything',
    misconceptions: { 'It is genuinely from Northwind Supply': 'phish-auth-pass-safe', 'It is safe to pay the invoice': 'phish-auth-pass-safe' },
    explanation:
      'Authentication proves which domain sent the mail, not that the domain is the one you trust. Attackers register lookalikes (supp1y, rn instead of m, extra hyphens) and set up SPF, DKIM and DMARC properly. Check the exact spelling, the domain age and whether you have ever received mail from it before.',
  },
  {
    id: 'ph-14',
    skill: 'l2-phishing',
    difficulty: 3,
    type: 'mc',
    prompt: 'Where does this link really take the user?',
    snippet: 'https://portal.corp.example@203.0.113.50/login.php',
    choices: [
      'To 203.0.113.50: everything before the @ is treated as a username',
      'To portal.corp.example',
      'To corp.example, then forwards to 203.0.113.50',
      'Nowhere: the link is invalid',
    ],
    answer: 'To 203.0.113.50: everything before the @ is treated as a username',
    misconceptions: { 'To portal.corp.example': 'phish-url-domain' },
    explanation:
      'In a URL, `user@host` means "log in to host as user". The browser connects to 203.0.113.50 and passes "portal.corp.example" as a username it ignores. Find the real host: after `://`, after any `@`, up to the next `/` or `:`.',
  },
];

const lesson = {
  skill: 'l2-phishing',
  title: 'Phishing & email analysis',
  goal: 'Read email headers, interpret SPF/DKIM/DMARC correctly and scope a phishing campaign.',
  sections: [
    {
      id: 'anatomy',
      heading: 'Headers: what the user sees vs what really happened',
      body: [
        'An email carries several "from" identities. The **From** header is what the user sees and is trivially forged. The **Return-Path** (envelope sender, SMTP MAIL FROM) is where bounces go. **Reply-To** decides where replies go: BEC attacks set it to their own mailbox.',
        '**Received** headers are added by each server, newest on top: read them **bottom to top**. Only trust lines added by your own servers.',
      ],
    },
    {
      id: 'auth',
      heading: 'SPF, DKIM and DMARC',
      body: ['Your gateway writes the results in **Authentication-Results**. Know exactly what each one proves:'],
      points: [
        '**SPF:** the connecting IP is allowed to send for the **envelope** domain (smtp.mailfrom). Often breaks when mail is forwarded.',
        '**DKIM:** the domain in `d=` signed the message and the signed parts were not changed. Usually survives forwarding.',
        '**DMARC:** passes if SPF **or** DKIM passes **and** that domain aligns with the visible From domain. Policy: `p=none` (report only), `quarantine`, `reject`.',
        'Passing proves which domain sent it, **not** that it is safe: lookalike domains and hacked real accounts pass too.',
      ],
      evidence: {
        label: 'Authentication-Results (spoofed supplier)',
        text: 'spf=pass smtp.mailfrom=fastpost-relay.example      <- passes, but for the relay\'s domain\ndkim=none                                         <- not signed\ndmarc=fail (p=none) header.from=northwind-supply.example  <- nothing aligned with From; p=none so delivered',
      },
    },
    {
      id: 'links',
      heading: 'Links and lookalike domains',
      body: [
        'Find the real host in a URL: after `://` and after any `@`, up to the next `/`. Then read the hostname **from the right**: the registered domain sits just before the top-level domain. `login.corp.example.account-verify.example` belongs to account-verify.example.',
      ],
      points: [
        'Lookalikes: character swaps (`supp1y`, `rn` for `m`), extra words (`corp-example-billing`), homoglyphs.',
        'Newly registered domains, URL shorteners and open redirects hide destinations.',
        'The displayed link text can say anything; check the real target.',
      ],
    },
    {
      id: 'attachments',
      heading: 'Attachments',
      body: [
        'Common malicious types: macro documents (`.docm`, `.xlsm`), containers that bypass scanning or mark-of-the-web (`.iso`, `.img`, password-protected `.zip`), shortcut files (`.lnk`), and HTML files that render a fake login page or assemble a payload in the browser (HTML smuggling). Double extensions (`invoice.pdf.html`) are a giveaway.',
        'Never open samples on your workstation: detonate them in a sandbox and work with hashes.',
      ],
    },
    {
      id: 'response',
      heading: 'Response: receive, click, compromise',
      body: ['Scope in three layers, then act:'],
      points: [
        '**Received:** message trace by sender, subject, URL; purge from every mailbox.',
        '**Clicked:** proxy and DNS logs for the phishing domain.',
        '**Compromised:** sign-ins after the click, new MFA methods, inbox rules (T1564.008), mail sent from the account. Reset the password **and** revoke sessions.',
        'Block the sender domain, URLs and IPs; report lookalike domains for takedown.',
      ],
    },
  ],
  worked: [
    {
      id: 'ph-w1',
      title: 'Supplier bank-change email',
      artifactLabel: 'Headers (trimmed)',
      artifact: `Received: from mx-in.corp.example (10.10.1.25) by mail01.corp.example; Mon, 21 Sep 2026 09:14:07 -0400
Received: from mail.fastpost-relay.example (203.0.113.25) by mx-in.corp.example; Mon, 21 Sep 2026 09:14:05 -0400
Received: from [192.168.1.14] (unknown [198.51.100.140]) by mail.fastpost-relay.example; Mon, 21 Sep 2026 13:14:01 +0000
${AUTH_SPOOF}
Subject: URGENT: updated bank details for invoice 88213`,
      question: 'Is this really from Northwind Supply?',
      steps: [
        'Read Received bottom-up: the message was submitted from 198.51.100.140 (behind a home router, 192.168.1.14) to fastpost-relay.example, then to our gateway. Northwind\'s own mail servers never appear.',
        'SPF passed, but for smtp.mailfrom=fastpost-relay.example, the relay\'s domain, not northwind-supply.example.',
        'DKIM is absent, so nothing aligns with the From domain: DMARC fails. Northwind publishes p=none, which is why it was delivered.',
        'Reply-To diverts answers to a freemail mailbox, and the subject pushes an urgent bank change: textbook business email compromise.',
      ],
      conclusion: 'Spoofed (true positive BEC attempt). Tell finance not to act, confirm with Northwind by phone using a known number, trace and purge the message from other mailboxes, and block the Reply-To address and relay.',
    },
  ],
  faded: [
    {
      id: 'ph-f1',
      title: 'Everything passes, but...',
      artifactLabel: 'Headers (trimmed)',
      artifact:
        'From: "Northwind Billing" <billing@northwlnd-supply.example>\nAuthentication-Results: mx-in.corp.example;\n  spf=pass smtp.mailfrom=northwlnd-supply.example;\n  dkim=pass header.d=northwlnd-supply.example;\n  dmarc=pass header.from=northwlnd-supply.example\nSubject: Invoice 88213 - new remittance account\n(Threat intel: northwlnd-supply.example registered 3 days ago)',
      question: 'Is this email trustworthy?',
      given: [
        'SPF, DKIM and DMARC all pass, and all for the same domain as the From header, so the domain is aligned.',
        'So the message genuinely comes from the owner of northwlnd-supply.example.',
      ],
      todo: [
        {
          prompt: 'Look closely at the From domain. What is wrong with it?',
          type: 'mc',
          choices: [
            'It is a lookalike: "northwlnd" uses an l where Northwind has an i',
            'Nothing: it is Northwind\'s real domain',
            'The domain has too many letters',
          ],
          answer: 'It is a lookalike: "northwlnd" uses an l where Northwind has an i',
          explanation: '"northwlnd" vs "northwind": one character swapped. The attacker owns this domain, so of course its authentication passes.',
        },
        {
          prompt: 'What is the verdict?',
          type: 'mc',
          choices: ['Phishing (BEC) using a newly registered lookalike domain', 'Legitimate: DMARC passed', 'False positive'],
          answer: 'Phishing (BEC) using a newly registered lookalike domain',
          explanation: 'Authentication passing only proves the lookalike domain sent it. A 3-day-old lookalike asking for a new remittance account is BEC. Block the domain and warn finance.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'phish-from-trust',
    skill: 'l2-phishing',
    name: 'Trusting the From address',
    description: 'Believes the From header (or the display name) proves who sent the email, and overlooks Reply-To.',
    fix: 'From is typed by the sender and can say anything. Compare it with the envelope sender (Return-Path), the Reply-To and the authentication results. A Reply-To that differs from From, especially to a freemail address, diverts every reply to the attacker.',
    lesson: 'l2-phishing#anatomy',
  },
  {
    id: 'phish-dmarc-alignment',
    skill: 'l2-phishing',
    name: 'Misreading SPF/DKIM/DMARC',
    description: 'Thinks SPF pass means the From domain is genuine, or that DMARC needs both SPF and DKIM to pass.',
    fix: 'SPF checks the envelope domain, which may be unrelated to the From the user sees. DMARC passes when SPF **or** DKIM passes for a domain that **aligns** with From. So "spf=pass" for a relay domain with "dmarc=fail" means the From is spoofed, and a forwarded message with SPF fail but aligned DKIM pass still passes DMARC.',
    lesson: 'l2-phishing#auth',
  },
  {
    id: 'phish-auth-pass-safe',
    skill: 'l2-phishing',
    name: 'Authentication pass = safe',
    description: 'Treats SPF/DKIM/DMARC pass as proof that an email is legitimate.',
    fix: 'Authentication proves which domain sent the message and that it was not altered. It says nothing about intent: attackers set up SPF, DKIM and DMARC on lookalike domains, and mail from a hijacked real account passes too. Check the exact domain spelling, its age and the request itself.',
    lesson: 'l2-phishing#auth',
  },
  {
    id: 'phish-url-domain',
    skill: 'l2-phishing',
    name: 'Reading URLs from the left',
    description: 'Picks out a familiar name at the start of a URL instead of finding the real registered domain.',
    fix: 'Find the host: after `://`, after any `@`, up to the next `/` or `:`. Then read it from the right: the registered domain is the label just before the top-level domain. `login.corp.example.account-verify.example` belongs to account-verify.example, and `corp.example@203.0.113.50` goes to 203.0.113.50.',
    lesson: 'l2-phishing#links',
  },
  {
    id: 'phish-delete-enough',
    skill: 'l2-phishing',
    name: 'Deleting the email ends the incident',
    description: 'Thinks removing the email (or blocking the sender) is enough once someone clicked or others received it.',
    fix: 'Deleting the message does not un-steal a password. Scope who received, clicked and entered credentials; reset passwords **and** revoke sessions; check sign-ins, MFA changes and inbox rules; then purge the message from every mailbox and block the indicators.',
    lesson: 'l2-phishing#response',
  },
];

export const PHISHING = { items, lesson, misconceptions };

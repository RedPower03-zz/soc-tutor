// Level 3 · PKI & certificates: questions, lesson and misconceptions.
// X.509 v3 (RFC 5280), TLS 1.3 (RFC 8446), OCSP (RFC 6960), Certificate Transparency (RFC 6962)
// and the CA/Browser Forum validity schedule (SC-081v3: 200 days from 15 March 2026,
// 100 days from 15 March 2027, 47 days from 15 March 2029).

const items = [
  {
    id: 'pki-01',
    skill: 'l3-pki',
    difficulty: 1,
    type: 'mc',
    prompt: 'What does a TLS server certificate actually prove to the browser?',
    choices: [
      'That a trusted CA has bound this public key to the names in the certificate',
      'That the website is safe and free of malware',
      'That the company behind the site is honest',
      'That the connection cannot be monitored by anyone',
    ],
    answer: 'That a trusted CA has bound this public key to the names in the certificate',
    misconceptions: {
      'That the website is safe and free of malware': 'pki-valid-cert-safe',
      'That the company behind the site is honest': 'pki-valid-cert-safe',
    },
    explanation:
      'A certificate is a signed statement: "this public key belongs to whoever controls these names". A domain-validated certificate only proves control of the domain at issuance. Phishing and malware sites get free, fully valid certificates in minutes, so the padlock says nothing about intent.',
  },
  {
    id: 'pki-02',
    skill: 'l3-pki',
    difficulty: 1,
    type: 'text',
    prompt: 'Which X.509 extension lists the host names a certificate is valid for? Browsers ignore the CN when it is present. (abbreviation)',
    accept: ['san', 'subject alternative name', 'subjectaltname', 'subject alt name', 'subject alternative names'],
    misconceptions: { cn: 'pki-cn-vs-san', 'common name': 'pki-cn-vs-san', subject: 'pki-cn-vs-san' },
    explanation:
      'The **Subject Alternative Name (SAN)** extension carries the DNS names (and sometimes IPs) the certificate covers. Modern browsers match the host name only against the SAN; the subject Common Name (CN) is legacy and is not checked when a SAN is present.',
  },
  {
    id: 'pki-03',
    skill: 'l3-pki',
    difficulty: 1,
    type: 'mc',
    prompt: 'In a normal chain, which certificate signs the **leaf** (server) certificate?',
    choices: ['An intermediate CA certificate', 'The root CA directly, every time', 'The leaf signs itself', 'The browser vendor'],
    answer: 'An intermediate CA certificate',
    misconceptions: { 'The leaf signs itself': 'pki-selfsigned-bad' },
    explanation:
      'Chain: leaf ← intermediate ← root. Roots are kept offline and sign intermediates; intermediates sign leaf certificates. The root is self-signed and trusted because it sits in the operating system or browser trust store, not because of its signature.',
  },
  {
    id: 'pki-04',
    skill: 'l3-pki',
    difficulty: 2,
    type: 'mc',
    prompt: 'Read the certificate. Which statement is correct?',
    snippet:
      'Certificate:\n    Data:\n        Version: 3 (0x2)\n        Serial Number: 4f:9a:21:0c:77:e3:15:8b\n        Signature Algorithm: sha256WithRSAEncryption\n        Issuer: CN = cdn-update-check.example\n        Validity\n            Not Before: Sep 20 02:11:40 2026 GMT\n            Not After : Sep 17 02:11:40 2036 GMT\n        Subject: CN = cdn-update-check.example\n        X509v3 extensions:\n            X509v3 Basic Constraints: critical\n                CA:TRUE',
    choices: [
      'It is self-signed (issuer equals subject), created days ago and valid for ten years: unusual for a public site and worth checking against the process and destination',
      'It is a normal public certificate from a trusted CA',
      'It must be malicious because it is self-signed',
      'It is expired',
    ],
    answer: 'It is self-signed (issuer equals subject), created days ago and valid for ten years: unusual for a public site and worth checking against the process and destination',
    misconceptions: { 'It must be malicious because it is self-signed': 'pki-selfsigned-bad' },
    explanation:
      'Issuer = Subject and CA:TRUE on a server certificate means self-signed. A publicly trusted certificate today can be valid for at most 200 days (CA/B Forum SC-081v3), so ten years means nobody public issued it. That is a lead, not a verdict: internal appliances self-sign all the time. What matters is who connects to it and why.',
  },
  {
    id: 'pki-05',
    skill: 'l3-pki',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which checks does a browser perform before trusting a server certificate? (select all)',
    choices: [
      'The chain leads to a root in its trust store',
      'The current time is between notBefore and notAfter',
      'The host name matches a SAN entry',
      'The certificate has not been revoked (OCSP/CRL or browser revocation lists)',
      'The site contains no malware',
      'The organisation behind the site is well known',
    ],
    answer: [
      'The chain leads to a root in its trust store',
      'The current time is between notBefore and notAfter',
      'The host name matches a SAN entry',
      'The certificate has not been revoked (OCSP/CRL or browser revocation lists)',
    ],
    misconceptions: {
      'The site contains no malware': 'pki-valid-cert-safe',
      'The organisation behind the site is well known': 'pki-valid-cert-safe',
    },
    explanation:
      'Path validation checks signatures up to a trusted root, validity dates, name match against the SAN, key usage / EKU (serverAuth), basic constraints on the CAs and revocation status. None of these checks look at content or intent.',
  },
  {
    id: 'pki-06',
    skill: 'l3-pki',
    difficulty: 2,
    type: 'mc',
    prompt: 'A user opens `https://portal.example.com`. The certificate below is presented. What will the browser do?',
    snippet:
      'Subject: CN = portal.example.com\nX509v3 Subject Alternative Name:\n    DNS:www.example.com, DNS:example.com\nIssuer: C = US, O = Example Trust CA, CN = Example Trust TLS RSA CA G2\nNot After : Jan 30 23:59:59 2027 GMT',
    choices: [
      'Reject it: the name must match a SAN entry, and portal.example.com is only in the CN',
      'Accept it: the CN matches',
      'Accept it: the issuer is trusted',
      'Reject it: it expires in 2027',
    ],
    answer: 'Reject it: the name must match a SAN entry, and portal.example.com is only in the CN',
    misconceptions: { 'Accept it: the CN matches': 'pki-cn-vs-san', 'Accept it: the issuer is trusted': 'pki-valid-cert-safe' },
    explanation:
      'When a SAN extension exists, browsers match only against it (RFC 6125; Chrome ignores the CN entirely). A wildcard `*.example.com` would cover portal.example.com, but only exact names are listed here, so the user sees a name-mismatch error.',
  },
  {
    id: 'pki-07',
    skill: 'l3-pki',
    difficulty: 1,
    type: 'text',
    prompt: 'Which protocol lets a client ask the CA, in real time, whether one certificate has been revoked? (four letters)',
    accept: ['ocsp', 'online certificate status protocol'],
    misconceptions: { crl: 'pki-valid-cert-safe' },
    explanation:
      '**OCSP** (Online Certificate Status Protocol, RFC 6960) answers "good / revoked / unknown" for one serial. A CRL is a signed list of all revoked serials that the client downloads. With **OCSP stapling** the server attaches a fresh signed OCSP response to the handshake so clients do not have to ask the CA themselves.',
  },
  {
    id: 'pki-08',
    skill: 'l3-pki',
    difficulty: 2,
    type: 'mc',
    prompt: 'Why does a certificate with `Basic Constraints: CA:TRUE` issued to an unknown internal host deserve attention if it appears in a user\'s trust store?',
    choices: [
      'Any CA certificate in the trust store can sign a trusted certificate for any site, which enables interception of HTTPS traffic',
      'CA certificates slow down the browser',
      'CA:TRUE means the certificate is expired',
      'It only matters for email, not the web',
    ],
    answer: 'Any CA certificate in the trust store can sign a trusted certificate for any site, which enables interception of HTTPS traffic',
    explanation:
      'Installing a root CA is how corporate TLS inspection proxies work, and also how malware and adware silently intercept HTTPS (Superfish, 2015). A new root in a user or machine store (e.g. Sysmon Event 12/13 on the ROOT certificate registry keys) is a strong signal when it is not your proxy\'s CA.',
  },
  {
    id: 'pki-09',
    skill: 'l3-pki',
    difficulty: 3,
    type: 'mc',
    prompt: 'Zeek logs this connection from a finance workstation. What is the most useful next step?',
    snippet:
      'ssl.log  ts=2026-09-24T03:14:07Z id.orig_h=10.20.4.31 id.resp_h=203.0.113.88 id.resp_p=443\n         version=TLSv12 server_name=- validation_status="self signed certificate"\n         ja3=72a589da586844d7f0818ce684948eea\nx509.log certificate.subject="CN=localhost" certificate.issuer="CN=localhost"\n         certificate.not_valid_before=2026-09-22 certificate.not_valid_after=2027-09-22\nconn.log duration=0.8s  repeated every 60s since 2026-09-22T09:00Z',
    choices: [
      'Identify the process on 10.20.4.31 making the connection and pivot on the JA3 and destination IP across the estate',
      'Ignore it: TLS is encrypted, so it is safe',
      'Block every self-signed certificate in the company',
      'Revoke the certificate at the CA',
    ],
    answer: 'Identify the process on 10.20.4.31 making the connection and pivot on the JA3 and destination IP across the estate',
    misconceptions: { 'Ignore it: TLS is encrypted, so it is safe': 'pki-valid-cert-safe', 'Block every self-signed certificate in the company': 'pki-selfsigned-bad' },
    explanation:
      'No SNI, a raw IP, a "CN=localhost" self-signed certificate and a fixed 60-second interval together look like a C2 beacon (many frameworks ship such defaults). The endpoint tells you which process; the JA3 client fingerprint and IP find other infected hosts. Nobody can revoke a self-signed certificate: there is no CA.',
  },
  {
    id: 'pki-10',
    skill: 'l3-pki',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which **public** records help you investigate a suspicious domain\'s certificates without touching the attacker\'s server? (select all)',
    choices: [
      'Certificate Transparency logs (e.g. searching crt.sh) for every certificate issued for the domain',
      'The issuing CA and issuance dates in those CT entries',
      'Other names on the same certificate (SAN) that reveal related infrastructure',
      'The attacker\'s private key',
      'The victim\'s browser history on other companies\' networks',
    ],
    answer: [
      'Certificate Transparency logs (e.g. searching crt.sh) for every certificate issued for the domain',
      'The issuing CA and issuance dates in those CT entries',
      'Other names on the same certificate (SAN) that reveal related infrastructure',
    ],
    explanation:
      'Publicly trusted certificates must be logged in Certificate Transparency (RFC 6962). CT search shows when a lookalike domain got its first certificate (often hours before the phishing wave) and SAN lists sometimes bundle several attacker domains. You also use CT defensively: watch for certificates issued for your own brand names.',
  },
  {
    id: 'pki-11',
    skill: 'l3-pki',
    difficulty: 2,
    type: 'mc',
    prompt: 'In a TLS 1.3 handshake, why can a network sensor no longer read the server certificate the way it could in TLS 1.2?',
    choices: [
      'In TLS 1.3 the Certificate message is sent after key exchange, so it is encrypted; sensors rely on SNI, JA3/JA4 and the IP instead',
      'TLS 1.3 servers do not use certificates',
      'TLS 1.3 uses UDP only',
      'Sensors can still read everything; nothing changed',
    ],
    answer: 'In TLS 1.3 the Certificate message is sent after key exchange, so it is encrypted; sensors rely on SNI, JA3/JA4 and the IP instead',
    explanation:
      'TLS 1.3 (RFC 8446) completes key exchange in the ClientHello/ServerHello round trip (1-RTT) and encrypts everything afterwards, including the certificate. Passive tools see the ClientHello (SNI, cipher list, fingerprints) and ServerHello. Encrypted Client Hello (ECH) hides even the SNI.',
  },
  {
    id: 'pki-12',
    skill: 'l3-pki',
    difficulty: 3,
    type: 'text',
    prompt: 'Since 15 March 2026, what is the maximum validity (in days) of a new publicly trusted TLS certificate under the CA/Browser Forum rules?',
    accept: ['200', '200 days'],
    misconceptions: { '398': 'pki-valid-cert-safe', '398 days': 'pki-valid-cert-safe', '47': 'pki-valid-cert-safe' },
    explanation:
      'Ballot SC-081v3 shortens public TLS certificates in steps: **200 days** from 15 March 2026, 100 days from 15 March 2027 and 47 days from 15 March 2029 (previously 398). A certificate valid for years therefore did not come from a public CA, which is a quick triage clue, and renewal must be automated (ACME).',
  },
  {
    id: 'pki-13',
    skill: 'l3-pki',
    difficulty: 1,
    type: 'mc',
    prompt: 'A developer says "our internal Jenkins uses a self-signed certificate". Is that an incident?',
    choices: [
      'No, not by itself: internal services often self-sign; the risk is users learning to click through warnings, so an internal CA is better',
      'Yes: self-signed certificates are always malware',
      'Yes: self-signed certificates use no encryption',
      'No: self-signed certificates are more secure than CA-signed ones',
    ],
    answer: 'No, not by itself: internal services often self-sign; the risk is users learning to click through warnings, so an internal CA is better',
    misconceptions: {
      'Yes: self-signed certificates are always malware': 'pki-selfsigned-bad',
      'Yes: self-signed certificates use no encryption': 'pki-selfsigned-bad',
    },
    explanation:
      'A self-signed certificate encrypts just as well; what it lacks is third-party identity assurance, so clients cannot tell it apart from an interception attempt. It is a hygiene finding, not an incident. In an investigation, self-signed matters in context: a workstation beaconing to a self-signed internet host is a different story.',
  },
];

const lesson = {
  skill: 'l3-pki',
  title: 'PKI & certificates',
  goal: 'Read a certificate, know what validation proves and what it does not, and use certificates as evidence in an investigation.',
  sections: [
    {
      id: 'fields',
      heading: 'Reading an X.509 certificate',
      body: [
        'A certificate binds a **public key** to **names**, signed by an **issuer**. `openssl x509 -text` shows the fields you need:',
      ],
      points: [
        '**Serial number** and **Signature Algorithm** (sha256WithRSAEncryption, ecdsa-with-SHA256).',
        '**Issuer** (who signed it) and **Subject** (who it is for). Issuer = Subject means self-signed.',
        '**Validity**: Not Before / Not After, always in UTC.',
        '**Subject Alternative Name (SAN)**: the DNS names the certificate covers. Browsers match only the SAN; the CN is legacy.',
        '**Basic Constraints** (CA:TRUE only for CAs), **Key Usage** and **Extended Key Usage** (serverAuth, clientAuth, codeSigning), **CRL Distribution Points** and **Authority Information Access** (OCSP URL).',
      ],
      evidence: {
        label: 'openssl x509 -noout -text (excerpt)',
        text: 'Issuer: C = US, O = Example Trust CA, CN = Example Trust TLS RSA CA G2\nValidity\n    Not Before: Aug  1 00:00:00 2026 GMT\n    Not After : Feb 16 23:59:59 2027 GMT\nSubject: CN = shop.example.com\nX509v3 Subject Alternative Name: DNS:shop.example.com, DNS:www.shop.example.com\nX509v3 Basic Constraints: critical CA:FALSE\nX509v3 Extended Key Usage: TLS Web Server Authentication',
      },
    },
    {
      id: 'chains',
      heading: 'Chains of trust',
      body: [
        'The server sends its **leaf** certificate plus **intermediates**. Each is signed by the next one up, ending at a **root CA** that the operating system or browser already trusts. Roots are self-signed: they are trusted because they are in the store, not because of the signature.',
        'Self-signed leaf certificates are normal on lab gear, appliances and internal tools. They encrypt fine but prove nothing about identity. On the internet they are a **lead**: many C2 frameworks ship default self-signed certificates (CN=localhost, random strings, very long validity).',
        'Any CA in a trust store can sign for **any** name. A new, unexpected root on an endpoint means someone can intercept its HTTPS. That is how TLS inspection proxies work, and how malware does it.',
      ],
    },
    {
      id: 'validate',
      heading: 'What validation proves (and what it does not)',
      body: [
        'Clients check the signature chain, the dates, the name against the SAN, key usage, and revocation (**OCSP**, CRLs, or browser-pushed lists; **OCSP stapling** lets the server include the answer).',
        'A valid certificate proves that a trusted CA bound this key to these names. It does **not** prove the site is safe. Domain-validated certificates are free and automatic, so most phishing sites use valid HTTPS.',
      ],
      points: [
        'Public certificates are now short-lived: at most **200 days** since 15 March 2026, falling to 100 days (2027) and 47 days (2029) under CA/B Forum ballot SC-081v3.',
        'Something valid for five or ten years did not come from a public CA.',
      ],
    },
    {
      id: 'tls',
      heading: 'Certificates on the wire',
      body: [
        'In **TLS 1.2** the server certificate crosses the network in the clear, so Zeek writes it to x509.log. In **TLS 1.3** the handshake finishes in one round trip and the certificate is **encrypted**. Sensors then rely on the **SNI** (the host name in the ClientHello), the destination IP, and client fingerprints (**JA3/JA4**). JA4 is built to survive the ClientHello randomisation that modern browsers use.',
        '**Certificate Transparency** logs every public certificate. Searching CT (crt.sh) shows when a lookalike domain got its certificate and which other names it shares.',
      ],
    },
  ],
  worked: [
    {
      id: 'pki-w1',
      title: 'A certificate on a beacon',
      artifactLabel: 'Zeek ssl.log + x509.log',
      artifact:
        'ts=2026-09-24T03:14:07Z orig=10.20.4.31 resp=203.0.113.88:443 version=TLSv12 server_name=-\nvalidation_status="self signed certificate"\nsubject="CN=localhost" issuer="CN=localhost" not_valid_before=2026-09-22 not_valid_after=2027-09-22\nconn: 0.8 s every 60 s since 2026-09-22T09:00Z',
      question: 'Is this worth escalating, and what do you check?',
      steps: [
        'Issuer = subject: self-signed. That alone is common, so look at the context.',
        'No SNI and a raw internet IP: a browser visiting a website sends a host name. A 60-second fixed interval is machine behaviour, not a person browsing.',
        'The certificate was minted two days ago, the same day the beaconing started. CN=localhost is a common framework default.',
        'Next: the endpoint (EDR) shows which process opened the socket; pivot on 203.0.113.88 and the JA3 hash in the proxy and Zeek logs for other hosts.',
      ],
      conclusion: 'Self-signed is the lead; the pattern (no SNI, fixed interval, fresh certificate, workstation) makes it a likely C2 channel to escalate.',
    },
  ],
  faded: [
    {
      id: 'pki-f1',
      title: 'The padlock argument',
      artifactLabel: 'Ticket comment',
      artifact:
        'User: "The login page had a padlock, so it was the real Microsoft site."\nURL: https://login-micros0ft-support.example.net/owa\nCertificate: issued 2026-09-23 by a public DV CA, SAN DNS:login-micros0ft-support.example.net, valid 90 days',
      question: 'Was the user right?',
      given: ['The certificate chain is valid and the name matches the SAN, so the browser showed no warning.'],
      todo: [
        {
          prompt: 'What does the valid certificate prove here?',
          type: 'mc',
          choices: [
            'Only that the attacker controls login-micros0ft-support.example.net',
            'That the page belongs to Microsoft',
            'That the page is safe to enter passwords into',
          ],
          answer: 'Only that the attacker controls login-micros0ft-support.example.net',
          explanation: 'Domain validation proves control of the name. The name itself is a lookalike (0 for o) on an unrelated domain.',
        },
        {
          prompt: 'Which public source would show when this domain first got a certificate? (two words or the site name)',
          type: 'text',
          accept: ['certificate transparency', 'ct logs', 'crt.sh', 'certificate transparency logs', 'ct log'],
          explanation: 'Certificate Transparency logs: a certificate issued the day before the phishing email is a strong sign of purpose-built infrastructure.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'pki-selfsigned-bad',
    skill: 'l3-pki',
    name: 'Self-signed means malicious',
    description: 'Treats every self-signed certificate as malware, or thinks self-signed means unencrypted.',
    fix: 'A self-signed certificate encrypts as well as any other; it just lacks third-party identity assurance. Internal tools and appliances self-sign all the time. On the internet it is a lead to weigh with context (no SNI, fixed intervals, fresh or default certificate, a workstation talking to a raw IP), not a verdict.',
    lesson: 'l3-pki#chains',
  },
  {
    id: 'pki-valid-cert-safe',
    skill: 'l3-pki',
    name: 'Padlock means safe',
    description: 'Believes a valid certificate or HTTPS padlock means the site is legitimate or free of malware.',
    fix: 'Validation proves only that a trusted CA bound the key to the names in the SAN. Domain-validated certificates are free and automatic, so phishing and malware sites use valid HTTPS routinely. Judge the name, the age of the domain and certificate (CT logs) and the behaviour, not the padlock.',
    lesson: 'l3-pki#validate',
  },
  {
    id: 'pki-cn-vs-san',
    skill: 'l3-pki',
    name: 'CN instead of SAN',
    description: 'Thinks the subject Common Name decides which host names a certificate covers.',
    fix: 'Browsers match the host name against the Subject Alternative Name extension only; the CN is legacy and ignored when a SAN is present. When you read a certificate for an investigation, list the SAN entries: they show every name the certificate covers and sometimes reveal related infrastructure.',
    lesson: 'l3-pki#fields',
  },
];

export const PKI = { items, lesson, misconceptions };

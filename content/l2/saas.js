// Level 2 · Cloud and SaaS identity: questions, lesson and misconceptions.
// A new skill. It does not replace l3-cloud or l3-identity.
// Sign-in codes are the Microsoft Entra AADSTS values. ATT&CK IDs are Enterprise v19.
// Tenants, apps and addresses are fictional (RFC 5737 and .example).

const S = 'l2-saas';

const items = [
  {
    id: 'ci-01',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'In a Microsoft Entra sign-in log, what does error code **50126** mean?',
    choices: [
      'Invalid username or password',
      'Conditional Access blocked the token',
      'The user has not enrolled in MFA',
      'The device is not marked compliant',
    ],
    answer: 'Invalid username or password',
    explanation:
      'AADSTS50126 is InvalidUserNameOrPassword: the credentials did not validate. A few of these are normal typos. A burst against many accounts is spraying. It is not a Conditional Access block (53003) and not an MFA enrollment interrupt (50079).',
  },
  {
    id: 'ci-02',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Which Entra sign-in error code means Conditional Access blocked token issuance? (digits only)',
    accept: ['53003', 'aadsts53003'],
    explanation:
      '**53003** is BlockedByConditionalAccess: the policy did not allow a token. Open the sign-in and read which policy matched (location, device, app, risk) before you tell the user their password is wrong. 53000 is a different code: the device is not compliant.',
  },
  {
    id: 'ci-03',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'How does Entra **50076** differ from **50079**?',
    choices: [
      '50076 means MFA is required; 50079 means the user must enroll first',
      '50076 is a bad password; 50079 is a locked account',
      '50076 is a CA block; 50079 is a successful token',
      '50076 means the session was revoked; 50079 means it was not revoked',
    ],
    answer: '50076 means MFA is required; 50079 means the user must enroll first',
    explanation:
      '50076 (UserStrongAuthClientAuthNRequired) says the user must complete MFA, often because of a Conditional Access policy or a new location. 50079 (UserStrongAuthEnrollmentRequired) says they cannot, because security info is not registered yet. Neither code is a stolen session.',
  },
  {
    id: 'ci-04',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What is the best reading of this Entra authentication detail?',
    snippet: `user: alex.chen@corp.example   app: Office 365 Exchange Online
14:02:11  Phone App Notification  result: failed    error: 500121
14:02:44  Phone App Notification  result: failed    error: 500121
14:03:18  Phone App Notification  result: failed    error: 500121
14:06:02  Phone App Notification  result: succeeded error: 0
ipAddress: 203.0.113.40`,
    choices: [
      'MFA fatigue: prompts were denied, then one was accepted (T1621)',
      'A typo streak: 500121 means the password was wrong each time here',
      'Conditional Access: 500121 means the token was blocked',
      'Enrollment: the user was only registering the phone app',
    ],
    answer: 'MFA fatigue: prompts were denied, then one was accepted (T1621)',
    misconceptions: { 'A typo streak: 500121 means the password was wrong each time here': 'saas-push-is-slow' },
    explanation:
      '500121 is the MFA prompt not completed, not a bad password (that is 50126). Several failed push prompts and then a success from the same odd IP is MFA request generation (T1621): the user eventually tapped approve. Confirm with the user, then revoke the session. Number matching makes this harder next time.',
  },
  {
    id: 'ci-05',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'A sign-in row shows only error **50058**, and the user field is a GUID. What happened?',
    choices: [
      'The session was not completed; this is often a normal SSO interrupt',
      'The attacker already holds a refresh token for the mailbox',
      'Conditional Access issued a token and then hid the username on purpose',
      'The password was correct and MFA was satisfied off-screen',
    ],
    answer: 'The session was not completed; this is often a normal SSO interrupt',
    explanation:
      'AADSTS50058 means session information was not sufficient for SSO: the user is not fully signed in. It is common when prompt=none runs before an interactive login, and the user column may show an object id instead of a name. It is not, by itself, proof of a stolen token.',
  },
  {
    id: 'ci-06',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Two successful sign-ins, one user, four minutes apart. What fits best?',
    snippet: `14:11:02  success  MFA: satisfied  ip 198.51.100.15  device: Alex-Laptop  app: Office
14:11:08  success  MFA: satisfied  ip 198.51.100.15  device: Alex-Laptop  app: Office
14:15:40  success  MFA: previously satisfied  ip 203.0.113.40  device: empty  UA: Chrome/120
          session: same session id as 14:11`,
    choices: [
      'Session replay after a proxied login: the second row never did MFA itself',
      'The user simply opened a second tab on the corporate laptop',
      'Two people sharing one password, because MFA would have blocked both',
      'A Conditional Access bug that stamps every row as success',
    ],
    answer: 'Session replay after a proxied login: the second row never did MFA itself',
    misconceptions: { 'Two people sharing one password, because MFA would have blocked both': 'saas-mfa-means-safe' },
    explanation:
      'The first sign-in completed MFA on a known device. The later one reuses that session from a new IP and a different user agent, with no new MFA. That is what an adversary-in-the-middle proxy (T1557) looks like once it has the session cookie (T1539, then T1550.004). MFA on the first row does not make the second row the user.',
  },
  {
    id: 'ci-07',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'You have confirmed that proxy session. What containment actually cuts the attacker off?',
    choices: [
      'Reset the password and revoke sign-in sessions, then check mailbox rules',
      'Reset the password only, and close the ticket as contained',
      'Turn off MFA so the user can sign in without another prompt',
      'Delete the laptop from the inventory and leave the account alone',
    ],
    answer: 'Reset the password and revoke sign-in sessions, then check mailbox rules',
    misconceptions: { 'Reset the password only, and close the ticket as contained': 'saas-reset-revokes' },
    explanation:
      'A password reset does not, by itself, revoke refresh tokens or session cookies. Revoke the user\'s sign-in sessions as well. Then look for inbox rules, OAuth grants and MailItemsAccessed from the proxy IP. Disabling MFA would help the attacker, not you.',
  },
  {
    id: 'ci-08',
    skill: S,
    difficulty: 3,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which rows are evidence the stolen session was used, not just that a phish was sent? Select all that apply.',
    snippet: `A  14:10  proxy 203.0.113.40  sign-in success, MFA satisfied, new device
B  14:16  proxy 203.0.113.40  MailItemsAccessed, MailAccessType Sync
C  14:18  proxy 203.0.113.40  New-InboxRule forward to inbox@mail.example
D  09:00  newsletter  "Your mailbox will be closed"  no clicks in the gateway`,
    choices: [
      'A: a completed sign-in from the proxy address',
      'B: mailbox items read from that same address',
      'C: a forwarding rule created from that same address',
      'D: a morning newsletter the user never opened',
    ],
    answer: [
      'A: a completed sign-in from the proxy address',
      'B: mailbox items read from that same address',
      'C: a forwarding rule created from that same address',
    ],
    explanation:
      'A, B and C show the session was used: interactive sign-in, then mail sync, then a collection rule (T1114.002). D is an unopened lure and does not show access. Pin the three actions, and do not pin the newsletter as if it were the compromise.',
  },
  {
    id: 'ci-09',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'remember',
    prompt: 'Which ATT&CK technique is adversary-in-the-middle (a reverse proxy that relays the real login)?',
    choices: [
      'T1557 Adversary-in-the-Middle',
      'T1621 MFA request generation',
      'T1078.004 Valid cloud accounts',
      'T1114.002 Remote email collection',
    ],
    answer: 'T1557 Adversary-in-the-Middle',
    explanation:
      'T1557 is Adversary-in-the-Middle. Phishing kits that proxy the real Entra or Okta page sit here; they steal the session after MFA (follow-on T1539 and T1550.004). T1621 is the push-spam technique. T1078.004 is using a real cloud account. T1114.002 is reading mail remotely.',
  },
  {
    id: 'ci-10',
    skill: S,
    difficulty: 1,
    type: 'text',
    bloom: 'remember',
    prompt: 'Which Entra error means the user did not pass the MFA challenge? (digits only)',
    accept: ['50074'],
    explanation:
      'AADSTS50074 is UserStrongAuthClientAuthNRequiredInterrupt: strong authentication was required and the user did not pass the MFA challenge. 500121 is the related "prompt not completed" code. 50126 is a bad password, not a failed MFA challenge.',
  },
  {
    id: 'ci-11',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'There is no 50126 anywhere, but this audit row exists. What is it?',
    snippet: `Workload: AzureActiveDirectory
Operation: Consent to application
UserId: alex.chen@corp.example
Object: Invoice Helper (invoice-helper.example)
Result: success`,
    choices: [
      'The user granted an app access; review the permissions, not the password',
      'A password spray, because consent fails whenever the password is wrong here',
      'A Conditional Access block recorded under a friendly name',
      'An MFA enrollment row, because every app consent is just MFA',
    ],
    answer: 'The user granted an app access; review the permissions, not the password',
    misconceptions: { 'A password spray, because consent fails whenever the password is wrong here': 'saas-consent-is-login' },
    explanation:
      '"Consent to application" is an OAuth grant (T1528), not a password failure. The user approved an app. Open the permissions (Mail.Read, offline_access, and so on), remove the grant if it is not a known app, and revoke sessions so a stolen refresh token dies.',
  },
  {
    id: 'ci-12',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Which permission set on that unknown app is the serious one?',
    snippet: `App: Invoice Helper    publisher: not verified    reply URL: https://invoice-helper.example/cb
Scopes granted by alex.chen: Mail.Read, offline_access, User.Read
Admin consent: no`,
    choices: [
      'Mail.Read plus offline_access: read mail now and refresh the token later',
      'User.Read alone: it can reset every password in the tenant',
      'The reply URL: a .example domain cannot receive a token',
      'Admin consent set to no: the grant did not actually happen',
    ],
    answer: 'Mail.Read plus offline_access: read mail now and refresh the token later',
    misconceptions: { 'Admin consent set to no: the grant did not actually happen': 'saas-consent-is-login' },
    explanation:
      'User consent is enough for delegated scopes. Mail.Read lets the app read the mailbox (T1114). offline_access asks for a refresh token so the app keeps working after the password changes, until you revoke the grant and the sessions. "Admin consent: no" means an admin did not approve it; the user still did.',
  },
  {
    id: 'ci-13',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'analyze',
    prompt: 'Which findings support an illicit OAuth consent (consent phishing)? Select all that apply.',
    choices: [
      'A new app the user does not recognise, granted Mail.Read',
      'offline_access on that same app',
      'The user says they clicked "Accept" on a document-share prompt',
      'A 53003 block on a managed device the user is holding',
    ],
    answer: [
      'A new app the user does not recognise, granted Mail.Read',
      'offline_access on that same app',
      'The user says they clicked "Accept" on a document-share prompt',
    ],
    explanation:
      'Illicit consent is a user approving a malicious app, often from a lure that looks like a document share (T1566.002 into T1528). Mail.Read and offline_access are the prize. A 53003 on their own laptop is a policy block, not a grant.',
  },
  {
    id: 'ci-14',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'You reset the password and do not revoke sessions. What can the attacker still do?',
    choices: [
      'Keep using a refresh token or session cookie until it is revoked or it expires',
      'Nothing: a password change deletes every token in the tenant immediately',
      'Only sign-ins that present the old password, which no longer works',
      'Only 50126 failures, because tokens are re-checked against the password',
    ],
    answer: 'Keep using a refresh token or session cookie until it is revoked or it expires',
    misconceptions: { 'Nothing: a password change deletes every token in the tenant immediately': 'saas-reset-revokes' },
    explanation:
      'Access tokens and refresh tokens are not the password. Without a revoke, a stolen refresh token or session cookie keeps working. Continuous access evaluation can shorten that window for apps that support it, on events such as a password change, but it is not a substitute for revoking sessions.',
  },
  {
    id: 'ci-15',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Continuous access evaluation is on for Exchange and SharePoint. Why revoke sessions anyway?',
    choices: [
      'CAE covers critical events in supporting apps; other tokens wait until they expire',
      'CAE disables the account, so a revoke would turn the user back on',
      'CAE only runs for guests, never for member accounts',
      'CAE replaces MFA, so the revoke would remove MFA',
    ],
    answer: 'CAE covers critical events in supporting apps; other tokens wait until they expire',
    explanation:
      'CAE lets supporting clients learn about critical events (password change, disabled user, revoked refresh tokens, high user risk) in near real time instead of waiting out the access token. Apps and clients that do not participate keep the token until it expires, often around an hour. Revoke sessions, and do not assume every workload heard you.',
  },
  {
    id: 'ci-16',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Impossible travel fired. What should you check before you call it a compromise?',
    snippet: `user alex.chen@corp.example
09:40  ip 198.51.100.15   city: Example City   ASN: Example Cable
09:52  ip 192.0.2.80      city: Other City     ASN: Corp VPN concentrator
device both rows: Alex-Laptop, compliant
risk: impossible travel`,
    choices: [
      'The second IP is the company VPN; the laptop and the gap may explain it',
      'Disable the account now: impossible travel is never a VPN or a bad geo',
      'The cable ASN means the laptop was cloned between the two cities',
      'Two cities in twelve minutes is physically possible, so close it as benign',
    ],
    answer: 'The second IP is the company VPN; the laptop and the gap may explain it',
    misconceptions: { 'Disable the account now: impossible travel is never a VPN or a bad geo': 'saas-travel-is-proof' },
    explanation:
      'Impossible travel compares geo lookups and a speed limit. VPNs, carrier NAT, satellite links and wrong geo databases trip it. Here the second ASN is the corporate VPN and the device id matches. Ask the user, compare the user agent, and do not auto-disable. A new device plus a new ASN would be a different case.',
  },
  {
    id: 'ci-17',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A playbook wants to disable every user who trips impossible travel. What is wrong with that?',
    choices: [
      'VPN exits, carrier NAT and bad geo will lock out people who are fine',
      'Nothing: the detection has no false positives by design',
      'It is too slow: travel should wipe the mailbox, not disable the user',
      'Travel alerts only fire for guests, so members are never affected',
    ],
    answer: 'VPN exits, carrier NAT and bad geo will lock out people who are fine',
    misconceptions: { 'Nothing: the detection has no false positives by design': 'saas-travel-is-proof' },
    explanation:
      'Impossible travel is a lead, not a verdict. Corporate VPN egress, mobile carrier NAT and a geo database that pins an anycast address in the wrong city all create "travel" that never happened. Gate the action: known VPN ASN, compliant device, and a user check. Do not mass-disable.',
  },
  {
    id: 'ci-18',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'In an Okta System Log event, which field tells you the sign-in worked?',
    choices: [
      'outcome.result set to SUCCESS',
      'eventType set to user.session.start, whatever the outcome',
      'client.ipAddress being a public address',
      'published, because a timestamp means the login was allowed',
    ],
    answer: 'outcome.result set to SUCCESS',
    explanation:
      'Read outcome.result (SUCCESS or FAILURE) and the displayMessage. user.session.start is the event type for a session starting; it is also written for failures. An IP and a timestamp exist on both outcomes. Then look at client.ipAddress, the user agent, and authenticationContext.',
  },
  {
    id: 'ci-19',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'What does this Okta sequence show?',
    snippet: `actor: alex.chen@corp.example
14:02  user.authentication.auth_via_mfa  outcome.result FAILURE
14:03  user.authentication.auth_via_mfa  outcome.result FAILURE
14:04  user.authentication.auth_via_mfa  outcome.result FAILURE
14:07  user.session.start                outcome.result SUCCESS
client.ipAddress on all four: 203.0.113.40`,
    choices: [
      'MFA challenges failed, then a session started from the same odd address',
      'The user typed a bad password four times and never got in',
      'Okta blocked the session, because FAILURE is the last word that matters',
      'A VPN reconnect: SUCCESS after FAILURE is always the concentrator',
    ],
    answer: 'MFA challenges failed, then a session started from the same odd address',
    misconceptions: { 'The user typed a bad password four times and never got in': 'saas-push-is-slow' },
    explanation:
      'auth_via_mfa FAILURE is a factor challenge that did not succeed, not a 50126-style password typo. A SUCCESS session.start afterwards from 203.0.113.40 means a session exists. Treat it like Entra push fatigue (T1621): confirm with the user and revoke the Okta session, not just the password.',
  },
  {
    id: 'ci-20',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What does number matching change about an MFA push prompt?',
    choices: [
      'The user must type a number shown on the sign-in screen, not just tap Approve',
      'The push is sent to every phone in the tenant so someone else can approve it',
      'Number matching disables MFA for the rest of the day after one success',
      'It replaces the need to revoke sessions after a confirmed theft',
    ],
    answer: 'The user must type a number shown on the sign-in screen, not just tap Approve',
    explanation:
      'Number matching (and showing the app and location on the prompt) stops a tired user from tapping Approve on a prompt they did not start. It reduces T1621. It does not stop a real-time proxy that shows the victim the same number, and it does not revoke a session that was already stolen.',
  },
  {
    id: 'ci-21',
    skill: S,
    difficulty: 2,
    type: 'text',
    bloom: 'apply',
    prompt: 'A user started MFA and closed the prompt. Entra logs "authentication failed during strong authentication request". Which code is that? (digits only)',
    accept: ['500121'],
    explanation:
      '**500121** is the user not completing the MFA prompt. You will see it when someone cancels, when a prompt times out, and in a fatigue chain just before an unexpected success. It is not 50074 (challenge not passed as an interrupt) and not 50126.',
  },
  {
    id: 'ci-22',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'What is Microsoft 365 **MailItemsAccessed** evidence of?',
    choices: [
      'Mailbox items were read (bind or sync), not that a password was typed',
      'A password reset, because reading mail always changes the password too',
      'A Conditional Access failure recorded by Exchange',
      'The user failing MFA, with the message id as the error code',
    ],
    answer: 'Mailbox items were read (bind or sync), not that a password was typed',
    explanation:
      'MailItemsAccessed is a mailbox-read audit (Workload Exchange). MailAccessType Bind is one item; Sync is a client syncing. Use ClientIP, ClientInfoString and the session to see whether the read matches the suspicious sign-in. It is not a sign-in error code.',
  },
  {
    id: 'ci-23',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Why does this rule matter more than the sign-in alone?',
    snippet: `14:18  Operation: New-InboxRule
UserId: alex.chen@corp.example
ClientIP: 203.0.113.40
Parameters: Name=RSS; RedirectTo=inbox@mail.example; MarkAsRead=True`,
    choices: [
      'Mail is leaving the mailbox after the odd sign-in, and it is marked read',
      'RSS is a Microsoft system rule, so RedirectTo is always internal',
      'MarkAsRead means the user was present and approved the rule',
      'A rule from 203.0.113.40 cannot fire, because that range is documentation-only in production tenants',
    ],
    answer: 'Mail is leaving the mailbox after the odd sign-in, and it is marked read',
    explanation:
      'New-InboxRule with RedirectTo an outside address and MarkAsRead is collection and hiding (T1114). It keeps working after the interactive session ends. Remove the rule, search for siblings (forwarding SMTP, other rules), and do not treat the name "RSS" as benign.',
  },
  {
    id: 'ci-24',
    skill: S,
    difficulty: 2,
    type: 'multi',
    bloom: 'apply',
    prompt: 'The consent and the forwarding rule are confirmed. Which actions belong in containment? Select all that apply.',
    choices: [
      'Revoke the user\'s sign-in sessions and reset the password',
      'Remove the OAuth grant and the suspicious service principal',
      'Delete the forwarding inbox rule and look for others',
      'Disable MFA on the account so the next push cannot be spammed',
    ],
    answer: [
      'Revoke the user\'s sign-in sessions and reset the password',
      'Remove the OAuth grant and the suspicious service principal',
      'Delete the forwarding inbox rule and look for others',
    ],
    misconceptions: { 'Disable MFA on the account so the next push cannot be spammed': 'saas-reset-revokes' },
    explanation:
      'Revoke sessions and reset the password together, remove the grant (T1528) so the refresh token for that app dies, and pull the rule. Disabling MFA removes the control that would challenge the next rogue sign-in. Tell the user what was approved in their name.',
  },
  {
    id: 'ci-25',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'A colleague wants to close the ticket: "MFA succeeded, so it was the user." What is wrong with that close?',
    choices: [
      'AiTM completes real MFA in front of the user, then replays the session',
      'Nothing: a satisfied MFA claim cannot be stolen afterwards',
      'MFA success is only logged when Conditional Access blocks the token first',
      'Closing is right because 0 means the IP was on the corporate list',
    ],
    answer: 'AiTM completes real MFA in front of the user, then replays the session',
    misconceptions: { 'Nothing: a satisfied MFA claim cannot be stolen afterwards': 'saas-mfa-means-safe' },
    explanation:
      'A reverse proxy shows the real Entra or Okta page. The user passes MFA. The proxy keeps the session cookie and uses it from its own IP (T1557, T1539, T1550.004). "MFA satisfied" on the first row is expected. Compare IP, user agent, device id and what happened next before you close.',
  },
  {
    id: 'ci-26',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'errorCode 53003, conditionalAccessStatus failure, no token. What do you tell the analyst who called it a breach?',
    choices: [
      'No token was issued; find which policy blocked, and do not reset on this row alone',
      '53003 means the attacker is in, because a block is written after access',
      'Treat it as 50058: the session is stolen and the username was hidden',
      'The status failure means MFA was satisfied and the app was opened',
    ],
    answer: 'No token was issued; find which policy blocked, and do not reset on this row alone',
    explanation:
      '53003 is a block: Conditional Access refused the token. That is the control working (untrusted location, noncompliant device, risky sign-in). Read the policy. A block is not access. 50058 is a different, usually benign, incomplete sign-in.',
  },
  {
    id: 'ci-27',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'understand',
    prompt: 'Which control resists a real-time phishing proxy better than an approve/deny push?',
    choices: [
      'Phishing-resistant MFA, such as FIDO2 or a certificate, bound to the real origin',
      'Longer access tokens, so the user is not prompted again',
      'Turning number matching off, so prompts feel less urgent',
      'Sharing one break-glass password with the whole on-call rota',
    ],
    answer: 'Phishing-resistant MFA, such as FIDO2 or a certificate, bound to the real origin',
    explanation:
      'Push MFA can be proxied or spammed. FIDO2 and certificate-based sign-in are bound to the legitimate origin, so a look-alike proxy cannot complete them. Pair that with device compliance and token protection. Longer tokens and shared break-glass passwords make theft worse.',
  },
  {
    id: 'ci-28',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'analyze',
    prompt: 'Mail is syncing, but there is no new interactive sign-in. Which technique fits?',
    snippet: `Exchange MailItemsAccessed  ClientIP 203.0.113.40  SessionId: 8f3
Entra sign-ins in the last hour for this user: none with error 0 from 203.0.113.40
Last interactive success: 14:11 from 198.51.100.15, session 8f3`,
    choices: [
      'The earlier session cookie is being reused (T1550.004), not a fresh password login',
      'A brand-new password spray that Entra forgot to log',
      '50058 rows that were deleted, which always means mail was read',
      'The mailbox reading itself, because SessionId 8f3 is an Exchange system id',
    ],
    answer: 'The earlier session cookie is being reused (T1550.004), not a fresh password login',
    explanation:
      'T1550.004 is using a stolen web session cookie. The mail sync carries the session from the earlier interactive login and presents it from the proxy IP, so you may not see a second password prompt. Revoke that session. Do not wait for a fresh 50126.',
  },
  {
    id: 'ci-29',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'The malicious app still has a refresh token after the user\'s password changed. What else removes it?',
    choices: [
      'Revoke the OAuth grant and the user\'s sign-in sessions',
      'Wait for 50126, which invalidates every app token',
      'Ask the user to click the phish a second time and deny it',
      'Rename the mailbox so the app cannot find the SMTP address',
    ],
    answer: 'Revoke the OAuth grant and the user\'s sign-in sessions',
    explanation:
      'offline_access survives a password change until the grant or the refresh tokens are revoked. Remove the service principal\'s delegated permission, revoke sessions, and confirm MailItemsAccessed from that app id stops. Clicking the lure again is how the app got in.',
  },
  {
    id: 'ci-30',
    skill: S,
    difficulty: 1,
    type: 'mc',
    bloom: 'understand',
    prompt: 'A new hire\'s only sign-in error is **50079**. What do they need?',
    choices: [
      'To register security info before MFA can succeed',
      'A password reset, because 50079 is a bad password',
      'A session revoke, because 50079 means a cookie was stolen',
      'An admin to delete the account and recreate it',
    ],
    answer: 'To register security info before MFA can succeed',
    explanation:
      '50079 is UserStrongAuthEnrollmentRequired. The policy demands MFA and the user has not registered a method (or a federated IdP did not supply the claim). Send them through registration. It is not 50126 and it is not a stolen cookie.',
  },
  {
    id: 'ci-31',
    skill: S,
    difficulty: 2,
    type: 'mc',
    bloom: 'apply',
    prompt: 'Which pair actually reduces both proxy phishing and push fatigue?',
    choices: [
      'Phishing-resistant MFA, plus number matching on any push that remains',
      'Disabling sign-in logs so the prompts are not delayed by auditing',
      'One shared mailbox password so travel alerts have nothing to compare against',
      'Setting every Conditional Access policy to report-only, permanently',
    ],
    answer: 'Phishing-resistant MFA, plus number matching on any push that remains',
    explanation:
      'Phishing-resistant methods break real-time proxies that can relay a push. Number matching stops a user approving a prompt they did not start (T1621). Report-only policies do not block. Shared passwords and dark logs remove the evidence you need.',
  },
  {
    id: 'ci-32',
    skill: S,
    difficulty: 3,
    type: 'mc',
    bloom: 'evaluate',
    prompt: 'Same user, two cities, one compliant device id, both ASNs are the user\'s mobile carrier. Best next step?',
    choices: [
      'Treat geo as weak: confirm the device, the user agent and with the user',
      'Disable the account: a carrier never NATs two cities onto one subscriber',
      'Ignore the device id, because compliant devices cannot be phished',
      'Reset every password in the tenant; carrier NAT means a breach of the IdP',
    ],
    answer: 'Treat geo as weak: confirm the device, the user agent and with the user',
    misconceptions: { 'Disable the account: a carrier never NATs two cities onto one subscriber': 'saas-travel-is-proof' },
    explanation:
      'Mobile carriers NAT many subscribers, and geo feeds often place that egress in a city the handset is not in. A stable compliant device id is a reason to slow down, not to skip the check. Ask the user. Disable only if the device, the user agent or the follow-on actions do not fit.',
  },
];

const lesson = {
  skill: S,
  title: 'Cloud and SaaS identity',
  goal: 'Read an Entra, Microsoft 365 or Okta sign-in, tell a block from a stolen session, and contain with a revoke rather than a password change alone.',
  sections: [
    {
      id: 'signin',
      heading: 'Entra sign-in codes',
      body: [
        'The sign-in log is one row per attempt: user, application, IP, device, conditional access and a status code. **0** is success. **50126** is a bad password. **53003** is Conditional Access refusing a token (53000 is the narrower "device not compliant"). **50076** means MFA is required now. **50079** means the user must enroll before they can satisfy that. **50074** means they did not pass the MFA challenge. **500121** means the MFA prompt was not completed. **50058** means the sign-in never finished (often a silent SSO interrupt); the user column may be a GUID.',
        'A code is not a story. 50126 across many accounts is spraying. 500121 several times and then a success from a new IP is push fatigue. 53003 is the policy working. Read the policy name, the device, and the application before you reset anyone.',
      ],
      evidence: {
        label: 'Codes you will actually filter on',
        text: '50126 invalid password | 53003 CA block | 53000 device not compliant | 50076 MFA required | 50079 enroll | 50074 MFA not passed | 500121 prompt not completed | 50058 not signed in',
      },
    },
    {
      id: 'audit',
      heading: 'Microsoft 365 audit: mail, rules, consent',
      body: [
        'The unified audit log is what the session did after it existed. **MailItemsAccessed** (Exchange) means items were read: Bind for one message, Sync for a client. **New-InboxRule** / Set-InboxRule with a forward or redirect to an outside address, especially with mark-as-read, is collection that outlives the session.',
        '**Consent to application** is not a login failure. It is a user granting an app delegated scopes. Mail.Read plus offline_access on an unverified app is an illicit consent grant (T1528): the app can read mail and refresh that access after a password change. User consent is enough; "admin consent: no" does not mean nothing was granted.',
      ],
    },
    {
      id: 'okta',
      heading: 'Okta System Log',
      body: [
        'Filter on actor, eventType, outcome.result, client.ipAddress and the user agent. **user.session.start** is written for attempts; the outcome field says whether a session was created. **user.authentication.auth_via_mfa** FAILURE is a factor that did not succeed. A run of those and then a SUCCESS from a new address is the same fatigue pattern as Entra 500121, not a string of bad passwords.',
        'Okta behavior flags (new device, velocity) are leads. Velocity is their view of impossible travel. Treat it the way you treat Entra\'s risk detection: check the ASN, the device and the user before you disable anyone.',
      ],
    },
    {
      id: 'attacks',
      heading: 'AiTM, fatigue, consent and travel',
      body: [
        '**Adversary-in-the-middle** (T1557) proxies the real login. The user passes real MFA. The proxy steals the session cookie (T1539) and replays it (T1550.004) from its own IP, often with an empty device record. "MFA satisfied" on the first row is what you expect, not a reason to close. Phishing-resistant MFA (FIDO2, certificate) is bound to the real origin, so the proxy cannot finish it. Push prompts can still be relayed or spammed.',
        '**MFA fatigue** (T1621) is many prompts until someone taps Approve. Number matching asks the user to enter the number on the sign-in screen. **Illicit consent** starts as a lure (T1566.002) and ends as an app with mail scopes. **Impossible travel** compares two geos to a speed limit. VPNs, mobile carrier NAT and bad geo data trip it. A matching compliant device is a reason to ask, not to auto-disable.',
      ],
      points: [
        'A successful MFA claim does not prove the later session is the user.',
        'Impossible travel is a hypothesis. The device, the ASN and the user confirm or kill it.',
      ],
    },
    {
      id: 'contain',
      heading: 'Revoke sessions, do not stop at the password',
      body: [
        'A password reset leaves refresh tokens and session cookies alive. **Revoke the user\'s sign-in sessions** (and the OAuth grant, if an app was consented) in the same step. Then remove forwarding rules and look at MailItemsAccessed from the suspicious IP and app id.',
        'Continuous access evaluation tells supporting apps about critical events (password change, disabled account, revoked tokens, high user risk) in near real time. Clients that do not participate keep the access token until it expires. CAE is a reason the window is shorter, not a reason to skip the revoke. Do not disable MFA to "stop the prompts".',
      ],
    },
  ],
  worked: [
    {
      id: 'ci-w1',
      title: 'A proxied login and a quiet forward',
      artifactLabel: 'Entra and Exchange (fictional)',
      artifact:
        '14:11:02  Entra success  alex.chen@corp.example  MFA satisfied  ip 198.51.100.15  device Alex-Laptop  session 8f3\n14:15:40  Entra success  same user  MFA previously satisfied  ip 203.0.113.40  device empty  UA Chrome/120  session 8f3\n14:16:10  MailItemsAccessed  ClientIP 203.0.113.40  MailAccessType Sync  SessionId 8f3\n14:18:02  New-InboxRule  RedirectTo inbox@mail.example  MarkAsRead True  ClientIP 203.0.113.40',
      question: 'Is this the user on a VPN, and what do you do in the first ten minutes?',
      steps: [
        'The first row is a normal interactive sign-in: known device, MFA completed, home ISP range.',
        'Four minutes later the same session id is used from 203.0.113.40 with a different user agent and no device. MFA was not challenged again. That is session replay after a proxy (T1557, T1550.004), not the corporate VPN.',
        'MailItemsAccessed Sync and a redirect rule from that IP show the session was used to read and forward mail. The rule will keep working after you close the laptop.',
        'Reset the password and revoke sign-in sessions. Delete the rule, hunt sibling rules, and check Consent to application for this user. Call the user on a known number.',
      ],
      conclusion: 'MFA on the first row is how the proxy got the cookie. Containment is revoke plus the rule, not a password change alone and not a close.',
    },
  ],
  faded: [
    {
      id: 'ci-f1',
      title: 'Travel, or the VPN',
      artifactLabel: 'Entra risk (fictional)',
      artifact:
        '09:40  alex.chen@corp.example  ip 198.51.100.15  ASN Example Cable  device Alex-Laptop compliant\n09:52  same user  ip 192.0.2.80  ASN Corp VPN  device Alex-Laptop compliant\nrisk: impossible travel',
      question: 'What do you refuse to do automatically, and what do you check?',
      given: [
        'Both rows share a compliant device id that this user has used all month.',
        '192.0.2.80 is in the company VPN egress range you already documented.',
      ],
      todo: [
        {
          prompt: 'The right first move is…',
          type: 'mc',
          choices: [
            'Ask the user and keep the ticket open until the device and ASN fit',
            'Disable the account because two cities cannot be a VPN',
            'Close it: compliant devices are never stolen',
          ],
          answer: 'Ask the user and keep the ticket open until the device and ASN fit',
          explanation: 'The VPN ASN and the same device explain the geo jump. Confirm with the user. Do not mass-disable, and do not close only because the device is compliant.',
        },
        {
          prompt: 'Which Entra code would mean a token was never issued?',
          type: 'text',
          accept: ['53003', 'aadsts53003'],
          explanation: '53003 is Conditional Access blocking token issuance. Impossible travel by itself is a risk detection, not 53003, unless a policy then blocked the sign-in.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'saas-mfa-means-safe',
    skill: S,
    name: 'MFA success means it was the user',
    description: 'Closes a session-replay ticket because the first sign-in satisfied MFA.',
    fix: 'An adversary-in-the-middle proxy (T1557) completes real MFA with the user, then replays the session cookie (T1539, T1550.004) from its own IP. Compare device, user agent and follow-on mail actions. Phishing-resistant MFA resists the proxy; a satisfied push does not prove the later row.',
    lesson: `${S}#attacks`,
  },
  {
    id: 'saas-reset-revokes',
    skill: S,
    name: 'A password reset kills every session',
    description: 'Resets the password and leaves refresh tokens, cookies and OAuth grants in place.',
    fix: 'Revoke sign-in sessions in the same step, and remove illicit OAuth grants. Access tokens for apps that do not use continuous access evaluation live until they expire. CAE shortens the window for supporting apps; it does not replace the revoke. Do not disable MFA to stop the prompts.',
    lesson: `${S}#contain`,
  },
  {
    id: 'saas-travel-is-proof',
    skill: S,
    name: 'Impossible travel is always a compromise',
    description: 'Disables every user whose sign-ins geo-locate too far apart.',
    fix: 'Travel detections compare geo databases to a speed limit. Corporate VPN egress, mobile carrier NAT and a wrong city on an anycast address all trip them. Check the ASN, the device id and the user agent, then ask the user. Automate only after those exclusions.',
    lesson: `${S}#attacks`,
  },
  {
    id: 'saas-consent-is-login',
    skill: S,
    name: 'App consent is just another login',
    description: 'Treats "Consent to application" as a password failure, or ignores a grant because an admin did not approve it.',
    fix: 'Consent to application is an OAuth grant (T1528). User consent is enough for delegated scopes such as Mail.Read and offline_access. Review the publisher and the scopes, remove the grant, and revoke sessions so the refresh token dies.',
    lesson: `${S}#audit`,
  },
  {
    id: 'saas-push-is-slow',
    skill: S,
    name: 'Repeated MFA failures are typos',
    description: 'Reads a chain of 500121 or Okta auth_via_mfa failures as a user who cannot type.',
    fix: '500121 and a failed auth_via_mfa are MFA challenges that were not completed, not 50126. Several failures and then a success from an unusual IP is MFA fatigue (T1621). Confirm with the user, revoke the session, and turn on number matching.',
    lesson: `${S}#signin`,
  },
];

export const SAAS = { items, lesson, misconceptions };

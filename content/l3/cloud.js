// Level 3 · Cloud security: questions, lesson and misconceptions.
// AWS is the worked example (CloudTrail, IAM, S3); the same ideas map to Entra ID / Azure activity
// logs and GCP audit logs. ATT&CK T1078.004 (Cloud Accounts), T1530 (Data from Cloud Storage),
// T1552.005 (Cloud Instance Metadata API). Account 111122223333 and AKIAIOSFODNN7EXAMPLE are AWS's
// documentation placeholders.

const items = [
  {
    id: 'cl-01',
    skill: 'l3-cloud',
    difficulty: 1,
    type: 'mc',
    prompt: 'Under the **shared responsibility model**, who is responsible for an S3 bucket that a customer made public by mistake?',
    choices: [
      'The customer: configuration, identities and data are the customer\'s side',
      'The cloud provider, because it runs the storage',
      'Nobody: public buckets are a feature',
      'The internet service provider',
    ],
    answer: 'The customer: configuration, identities and data are the customer\'s side',
    misconceptions: { 'The cloud provider, because it runs the storage': 'cloud-provider-secures-all' },
    explanation:
      'The provider secures the cloud itself (data centres, hardware, hypervisors, the managed service software). The customer secures what they put **in** it: IAM, configuration, network exposure, data classification and, for VMs, the operating system. Most cloud breaches are customer-side misconfigurations or stolen credentials.',
  },
  {
    id: 'cl-02',
    skill: 'l3-cloud',
    difficulty: 1,
    type: 'text',
    prompt: 'What is the name of the AWS service that logs management API calls such as `CreateUser` and `PutBucketPolicy`?',
    accept: ['cloudtrail', 'aws cloudtrail', 'cloud trail'],
    misconceptions: { cloudwatch: 'cloud-provider-secures-all', guardduty: 'cloud-provider-secures-all' },
    explanation:
      '**CloudTrail** records who called which API, from where, with which credentials, and whether it worked. Management events are on by default for 90 days of event history; an organisation trail sent to a separate, locked-down account is needed for retention and for data events (e.g. S3 GetObject). CloudWatch is metrics and logs; GuardDuty is a detection service built on top of these logs.',
  },
  {
    id: 'cl-03',
    skill: 'l3-cloud',
    difficulty: 2,
    type: 'mc',
    prompt: 'Read the CloudTrail event. What does it show?',
    snippet:
      '{\n  "eventTime": "2026-09-24T02:47:19Z",\n  "eventSource": "sts.amazonaws.com",\n  "eventName": "GetCallerIdentity",\n  "sourceIPAddress": "198.51.100.23",\n  "userAgent": "aws-cli/2.17.4 md/Botocore#1.34 os/linux",\n  "userIdentity": {\n    "type": "IAMUser",\n    "userName": "ci-deploy",\n    "accessKeyId": "AKIAIOSFODNN7EXAMPLE"\n  },\n  "errorCode": null\n}',
    choices: [
      'Someone is using ci-deploy\'s long-term access key (AKIA) from an unfamiliar IP to check whose key it is, a typical first step after a key leaks',
      'A failed login to the AWS console',
      'A harmless health check that never needs review',
      'Someone reading an S3 object',
    ],
    answer: 'Someone is using ci-deploy\'s long-term access key (AKIA) from an unfamiliar IP to check whose key it is, a typical first step after a key leaks',
    misconceptions: { 'A harmless health check that never needs review': 'cloud-keys-like-passwords' },
    explanation:
      'GetCallerIdentity is the cloud equivalent of `whoami`: attackers call it first to learn which account and identity a stolen key belongs to. Keys starting **AKIA** are long-term IAM user keys; **ASIA** keys are temporary STS credentials. A CI key used from a laptop CLI at 02:47 from a new IP deserves an immediate check with the key owner.',
  },
  {
    id: 'cl-04',
    skill: 'l3-cloud',
    difficulty: 2,
    type: 'mc',
    prompt: 'A developer accidentally pushed an AWS access key to a public GitHub repository and deleted the commit ten minutes later. What must happen?',
    choices: [
      'Deactivate and rotate the key immediately and review CloudTrail for its use; public repos are scraped for keys within minutes',
      'Nothing: the commit was deleted',
      'Change the developer\'s console password',
      'Make the repository private',
    ],
    answer: 'Deactivate and rotate the key immediately and review CloudTrail for its use; public repos are scraped for keys within minutes',
    misconceptions: {
      'Nothing: the commit was deleted': 'cloud-keys-like-passwords',
      'Change the developer\'s console password': 'cloud-keys-like-passwords',
    },
    explanation:
      'Access keys are bearer credentials: whoever holds them is that identity, with no MFA prompt. Bots watch public commits and try new keys within minutes, and the key survives in forks, clones and history. Rotating the console password does nothing to the key. Prefer short-lived credentials (roles, OIDC federation for CI) so there is no long-term key to leak.',
  },
  {
    id: 'cl-05',
    skill: 'l3-cloud',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which CloudTrail events, from an identity that normally only deploys code, suggest an attacker making the account theirs? (select all)',
    choices: [
      'CreateUser followed by CreateAccessKey for the new user',
      'AttachUserPolicy with AdministratorAccess',
      'StopLogging or DeleteTrail',
      'DescribeInstances once during a deployment window',
      'GetObject on the deployment artefact bucket during a release',
    ],
    answer: ['CreateUser followed by CreateAccessKey for the new user', 'AttachUserPolicy with AdministratorAccess', 'StopLogging or DeleteTrail'],
    explanation:
      'Persistence (a new user with its own key), privilege escalation (admin policy) and defence evasion (turning off CloudTrail) are classic post-compromise steps. Reads within the identity\'s normal job are expected. GuardDuty and most SIEM content alert on StopLogging/DeleteTrail as high severity.',
  },
  {
    id: 'cl-06',
    skill: 'l3-cloud',
    difficulty: 1,
    type: 'mc',
    prompt: 'A storage bucket is encrypted at rest with provider-managed keys and its policy grants `"Principal": "*"` read access. Is the data protected?',
    choices: [
      'No: encryption at rest is transparent to anyone the policy allows, so the data is public',
      'Yes: the data is encrypted',
      'Yes, as long as nobody knows the bucket name',
      'Only if the bucket is in Europe',
    ],
    answer: 'No: encryption at rest is transparent to anyone the policy allows, so the data is public',
    misconceptions: { 'Yes: the data is encrypted': 'cloud-encrypted-bucket-safe', 'Yes, as long as nobody knows the bucket name': 'cloud-encrypted-bucket-safe' },
    explanation:
      'Server-side encryption protects against someone stealing disks from the data centre. The service decrypts automatically for every authorised request, and `Principal: *` authorises everyone. Access control (policies, Block Public Access) is what protects the data. Bucket names are guessable and are scanned constantly.',
  },
  {
    id: 'cl-07',
    skill: 'l3-cloud',
    difficulty: 2,
    type: 'text',
    prompt: 'Temporary AWS credentials issued by STS (for roles and federated sessions) have access key IDs that start with which four letters?',
    accept: ['asia'],
    misconceptions: { akia: 'cloud-keys-like-passwords' },
    explanation:
      '**ASIA** = temporary STS credentials (they come with a session token and expire, typically after an hour). **AKIA** = long-term IAM user keys that live until someone deletes them. In an investigation, an ASIA key points you to an AssumeRole or federation event that issued it; an AKIA key points to a specific IAM user.',
  },
  {
    id: 'cl-08',
    skill: 'l3-cloud',
    difficulty: 3,
    type: 'mc',
    prompt: 'Read the events. What is the attacker trying to do?',
    snippet:
      '02:51:03 s3.amazonaws.com DeletePublicAccessBlock  bucket=finance-exports-111122223333  user=ci-deploy  src=198.51.100.23\n02:51:09 s3.amazonaws.com PutBucketPolicy          bucket=finance-exports-111122223333  user=ci-deploy  src=198.51.100.23\n         policy: {"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::finance-exports-111122223333/*"}\n02:53:40 s3.amazonaws.com GetObject (data event) x 4,812  src=203.0.113.77',
    choices: [
      'Exfiltrate data: remove the public access guard, make the bucket world-readable, then download the objects from another IP',
      'Encrypt the bucket for ransom',
      'Normal CI behaviour during a deployment',
      'Rotate the access key',
    ],
    answer: 'Exfiltrate data: remove the public access guard, make the bucket world-readable, then download the objects from another IP',
    misconceptions: { 'Normal CI behaviour during a deployment': 'cloud-encrypted-bucket-safe' },
    explanation:
      'Block Public Access overrides public policies, so the attacker deletes it first, then adds a `Principal: *` policy and downloads 4,812 objects anonymously (T1530). Contain: restore Block Public Access, remove the policy, deactivate the ci-deploy key. You only see the GetObject calls if S3 data events were logged, which is a common blind spot.',
  },
  {
    id: 'cl-09',
    skill: 'l3-cloud',
    difficulty: 3,
    type: 'mc',
    prompt: 'A web app on a cloud VM has an SSRF bug. Proxy logs show a request to `http://169.254.169.254/latest/meta-data/iam/security-credentials/app-role`. Why is this serious?',
    choices: [
      'It is the instance metadata service; it returns the VM role\'s temporary credentials, which the attacker can use from anywhere until they expire',
      'It is a harmless local link address',
      'It only reveals the VM\'s hostname',
      'It shuts the VM down',
    ],
    answer: 'It is the instance metadata service; it returns the VM role\'s temporary credentials, which the attacker can use from anywhere until they expire',
    misconceptions: { 'It is a harmless local link address': 'cloud-provider-secures-all' },
    explanation:
      'The metadata endpoint hands out the attached role\'s ASIA credentials (T1552.005). The 2019 Capital One breach worked this way. IMDSv2 requires a session token obtained with a PUT request, which most SSRF bugs cannot send; enforcing IMDSv2 and least-privilege roles is the customer\'s job under shared responsibility.',
  },
  {
    id: 'cl-10',
    skill: 'l3-cloud',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which controls reduce the damage of a stolen cloud credential? (select all)',
    choices: [
      'Least-privilege IAM policies scoped to what the identity really needs',
      'Short-lived role credentials instead of long-term access keys',
      'MFA for console users and conditions such as source IP or VPC endpoint on sensitive actions',
      'Encrypting buckets with provider-managed keys',
      'Giving every developer AdministratorAccess so nothing breaks',
    ],
    answer: [
      'Least-privilege IAM policies scoped to what the identity really needs',
      'Short-lived role credentials instead of long-term access keys',
      'MFA for console users and conditions such as source IP or VPC endpoint on sensitive actions',
    ],
    misconceptions: { 'Encrypting buckets with provider-managed keys': 'cloud-encrypted-bucket-safe' },
    explanation:
      'In the cloud, identity is the perimeter. Least privilege limits what a thief can do, short-lived credentials limit how long, and MFA plus conditions limit where. Default provider-managed encryption is transparent to any authorised caller, including a thief with valid credentials.',
  },
  {
    id: 'cl-11',
    skill: 'l3-cloud',
    difficulty: 1,
    type: 'mc',
    prompt: 'Which CloudTrail field tells you whether an API call **succeeded**?',
    choices: ['errorCode (absent or null on success, e.g. AccessDenied on failure)', 'eventTime', 'userAgent', 'awsRegion'],
    answer: 'errorCode (absent or null on success, e.g. AccessDenied on failure)',
    misconceptions: { userAgent: 'cloud-keys-like-passwords' },
    explanation:
      'CloudTrail logs attempts, not just successes. A burst of `AccessDenied` errors shows someone probing what a key may do (enumeration); the first call without an errorCode shows what they actually achieved. Always filter on errorCode before concluding what happened.',
  },
  {
    id: 'cl-12',
    skill: 'l3-cloud',
    difficulty: 3,
    type: 'text',
    prompt: 'Which CloudTrail **eventName** means someone switched off an existing trail\'s logging without deleting it?',
    accept: ['stoplogging', 'stop logging'],
    misconceptions: { deletetrail: 'cloud-provider-secures-all', getcalleridentity: 'cloud-keys-like-passwords' },
    explanation:
      '**StopLogging** pauses a trail (DeleteTrail removes it). Both are defence evasion (T1562.008, Disable or Modify Cloud Logs). Organisation trails that member accounts cannot change, delivery to a separate log archive account, and an alert on these events protect your evidence.',
  },
];

const lesson = {
  skill: 'l3-cloud',
  title: 'Cloud security',
  goal: 'Know what the customer must secure, read cloud audit logs, and recognise stolen keys, privilege escalation and exposed storage.',
  sections: [
    {
      id: 'shared',
      heading: 'Shared responsibility',
      body: [
        'The provider secures **the cloud**: data centres, hardware, hypervisors and the managed services themselves. The customer secures what they put **in the cloud**: identities and permissions, configuration, network exposure, data, and the operating systems of their VMs.',
        'Most cloud incidents are on the customer side: leaked access keys, over-privileged roles, public storage, and metadata credential theft through SSRF. The provider will not notice that your bucket policy allows `Principal: *`.',
      ],
    },
    {
      id: 'iam',
      heading: 'Identity is the perimeter',
      body: [
        'Every API call is authorised by IAM. Credentials come in two kinds:',
      ],
      points: [
        '**Long-term keys** (AWS access keys starting **AKIA**) belong to IAM users and work until deleted. They are bearer credentials: no MFA prompt, and usable from anywhere.',
        '**Temporary credentials** (**ASIA**, plus a session token) come from STS when a role is assumed or a user federates; they expire.',
        'Stolen-key playbook: GetCallerIdentity (whoami), enumeration (List*, many AccessDenied errors), escalation (AttachUserPolicy, CreateAccessKey for another user), persistence (CreateUser, new keys), evasion (StopLogging), then the objective (data, crypto-mining instances).',
      ],
    },
    {
      id: 'logs',
      heading: 'Reading audit logs',
      body: [
        '**CloudTrail** (AWS), the **Azure activity and Entra sign-in logs** and **GCP audit logs** record who called what, from where and whether it worked. Key CloudTrail fields: `eventTime` (UTC), `eventSource` and `eventName`, `userIdentity` (type, userName or role, `accessKeyId`), `sourceIPAddress`, `userAgent`, `errorCode`.',
        'Management events are logged by default; **data events** (S3 GetObject, Lambda invocations) are not, so exfiltration can be invisible unless you enabled them. Send an organisation trail to a separate, locked-down account so an attacker cannot erase it.',
      ],
      evidence: {
        label: 'CloudTrail (condensed)',
        text: '02:47:19 sts GetCallerIdentity  user=ci-deploy key=AKIAIOSFODNN7EXAMPLE src=198.51.100.23 ua=aws-cli\n02:48:02 iam ListUsers          user=ci-deploy errorCode=AccessDenied\n02:49:30 s3  ListBuckets        user=ci-deploy errorCode=null',
      },
    },
    {
      id: 'storage',
      heading: 'Storage and misconfiguration',
      body: [
        'Storage exposure is about **access control**, not encryption. Server-side encryption with provider-managed keys is transparent to any caller the policy allows. A public policy exposes encrypted data just as well.',
        'AWS **Block Public Access** overrides public policies and ACLs; an attacker who wants to exfiltrate through a public link has to remove it first (`DeletePublicAccessBlock`, then `PutBucketPolicy`). Alert on both, and on data events from unfamiliar IPs.',
        'The **instance metadata service** (169.254.169.254) hands the VM\'s role credentials to anything on the VM, including an SSRF bug. Enforce IMDSv2 and keep VM roles minimal.',
      ],
    },
  ],
  worked: [
    {
      id: 'cl-w1',
      title: 'A CI key at 02:47',
      artifactLabel: 'CloudTrail, user ci-deploy',
      artifact:
        'Usual: sts/ecr/ecs calls from 192.0.2.10 (CI runner), userAgent "Botocore", 09:00-18:00\n02:47:19 GetCallerIdentity    src=198.51.100.23 ua=aws-cli/2.17.4\n02:48:02 ListUsers            errorCode=AccessDenied\n02:48:05 ListRoles            errorCode=AccessDenied\n02:49:30 ListBuckets          errorCode=null\n02:51:03 DeletePublicAccessBlock bucket=finance-exports-111122223333',
      question: 'Is this the CI system, and what do you do?',
      steps: [
        'Baseline: ci-deploy only ever calls from the CI runner IP, with the SDK user agent, in office hours. This is a new IP, a CLI user agent and 02:47.',
        'Sequence: whoami, then enumeration with AccessDenied errors (probing permissions), then the first success (ListBuckets): textbook stolen-key behaviour.',
        'Impact: DeletePublicAccessBlock on a finance bucket means the attacker is preparing to expose data. Check for PutBucketPolicy and GetObject data events.',
        'Contain: deactivate the AKIA key (the CI pipeline breaks, which is acceptable), restore Block Public Access, find where the key leaked (repo, CI logs), and move CI to short-lived OIDC role credentials.',
      ],
      conclusion: 'Compare against the identity\'s baseline (IP, user agent, time, API set); whoami plus AccessDenied bursts plus a sensitive change means a stolen key.',
    },
  ],
  faded: [
    {
      id: 'cl-f1',
      title: '"But it\'s encrypted"',
      artifactLabel: 'Config finding',
      artifact:
        'Bucket: hr-archive-111122223333\nDefault encryption: SSE-S3 (provider-managed)\nBlock Public Access: OFF\nBucket policy: {"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::hr-archive-111122223333/*"}',
      question: 'The owner says the data is safe because it is encrypted. Is it?',
      given: ['The policy allows s3:GetObject for Principal "*", meaning anyone on the internet.'],
      todo: [
        {
          prompt: 'Can an anonymous user read the files in plaintext?',
          type: 'mc',
          choices: ['Yes: S3 decrypts transparently for every authorised request', 'No: they get ciphertext', 'Only with the KMS key'],
          answer: 'Yes: S3 decrypts transparently for every authorised request',
          explanation: 'SSE-S3 is invisible to callers. Only a customer-managed KMS key whose key policy excludes anonymous callers would change that, and the real fix is access control.',
        },
        {
          prompt: 'Which account-level S3 control would have overridden this public policy? (three words)',
          type: 'text',
          accept: ['block public access', 's3 block public access'],
          explanation: 'Block Public Access at account level stops public policies and ACLs from taking effect, even if someone writes one.',
        },
      ],
    },
  ],
};

const misconceptions = [
  {
    id: 'cloud-provider-secures-all',
    skill: 'l3-cloud',
    name: 'The provider secures everything',
    description: 'Assumes the cloud provider is responsible for configuration, identities, logging or exposure.',
    fix: 'Shared responsibility: the provider secures the infrastructure and managed services; the customer secures identities, permissions, configuration, network exposure, data and logging. Public buckets, leaked keys, IMDSv1 credential theft and disabled trails are all on the customer side.',
    lesson: 'l3-cloud#shared',
  },
  {
    id: 'cloud-keys-like-passwords',
    skill: 'l3-cloud',
    name: 'Access keys treated like passwords',
    description: 'Thinks a leaked key is harmless once deleted from a repo, or that changing the console password fixes it.',
    fix: 'Access keys are bearer credentials: anyone holding one acts as that identity from anywhere, with no MFA prompt. Public repos are scraped within minutes. Deactivate and rotate the key, review CloudTrail for its accessKeyId, and prefer short-lived role credentials (ASIA) over long-term keys (AKIA).',
    lesson: 'l3-cloud#iam',
  },
  {
    id: 'cloud-encrypted-bucket-safe',
    skill: 'l3-cloud',
    name: 'Encrypted means protected',
    description: 'Believes encryption at rest protects data in a bucket that is publicly readable or over-shared.',
    fix: 'Server-side encryption with provider-managed keys decrypts automatically for every request the policy allows, so it protects against stolen disks, not misconfiguration. Access control protects cloud data: least-privilege policies, Block Public Access, and alerts on policy changes and unusual data-event reads.',
    lesson: 'l3-cloud#storage',
  },
];

export const CLOUD = { items, lesson, misconceptions };

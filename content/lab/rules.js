// Detection-rule exercises. Each sample is labelled malicious or benign.
// A passing rule matches every malicious sample and no benign one.
// model.sigma / model.yara is shown after a pass. The other dialect key may be absent.

const win = (id, malicious, fields, note) => ({ id, malicious, source: 'windows-security', fields, note });
const sys = (id, malicious, fields, note) => ({ id, malicious, source: 'sysmon', fields, note });
const proxy = (id, malicious, fields, note) => ({ id, malicious, source: 'proxy', fields, note });
const cloud = (id, malicious, fields, note) => ({ id, malicious, source: 'cloudtrail', fields, note });
const text = (id, malicious, body, note) => ({ id, malicious, text: body, note });

export const RULE_EXERCISES = [
  {
    id: 'rule-rdp-fail',
    level: 2,
    difficulty: 1,
    kind: 'sigma',
    skill: 'l2-siem',
    title: 'Failed logons from the outside',
    brief: 'Alert when a failed logon (4625) comes from 203.0.113.0/24. Internal password typos and successful logons are not this alert.',
    hints: [
      'Event ID 4625 is a failed logon. 4624 is a success.',
      'The outside addresses in this set all start with 203.0.113.',
      'logsource windows-security\nEventID == 4625\nIpAddress startswith 203.0.113.',
    ],
    model: { sigma: 'logsource windows-security\nEventID == 4625\nIpAddress startswith 203.0.113.' },
    explain: 'Both conditions are required. 4625 alone also matches a.patel mistyping a password at her desk. The 203.0.113.50 address with a 4624 is the attacker getting in later: a different detection.',
    samples: [
      win('m1', true, { EventID: 4625, IpAddress: '203.0.113.50', TargetUserName: 'administrator', LogonType: 10 }, 'external RDP failure'),
      win('m2', true, { EventID: 4625, IpAddress: '203.0.113.51', TargetUserName: 'guest', LogonType: 3 }, 'external guest failure'),
      win('b1', false, { EventID: 4625, IpAddress: '10.10.3.20', TargetUserName: 'a.patel', LogonType: 2 }, 'local typo'),
      win('b2', false, { EventID: 4624, IpAddress: '203.0.113.50', TargetUserName: 'administrator', LogonType: 10 }, 'success, not a failure'),
      win('b3', false, { EventID: 4625, IpAddress: '10.0.9.5', TargetUserName: 'administrator', LogonType: 3 }, 'internal scanner'),
    ],
  },
  {
    id: 'rule-office-ps',
    level: 2,
    difficulty: 2,
    kind: 'sigma',
    skill: 'l2-malware',
    title: 'Word started PowerShell',
    brief: 'Sysmon process creation: WINWORD.EXE should not start powershell.exe. People do run PowerShell from Explorer, and Word does start the print helper.',
    hints: [
      'Process creation is EventID 1. ParentImage is the parent, Image is the child.',
      'You need both: the parent contains WINWORD.EXE and the child contains powershell.exe.',
      'EventID == 1\nParentImage contains WINWORD.EXE\nImage contains powershell.exe',
    ],
    model: { sigma: 'logsource sysmon\nEventID == 1\nParentImage contains WINWORD.EXE\nImage contains powershell.exe' },
    explain: 'Parent and child together are the signal. PowerShell from Explorer is an admin. WINWORD starting splwow64.exe is printing. Either half of the rule on its own is noisy.',
    samples: [
      sys('m1', true, { EventID: 1, ParentImage: 'C:\\\\Program Files\\\\Microsoft Office\\\\WINWORD.EXE', Image: 'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe', CommandLine: 'powershell -nop -w hidden -enc SQBFAFgA' }, 'macro stager'),
      sys('m2', true, { EventID: 1, ParentImage: 'C:\\\\Program Files\\\\Microsoft Office\\\\root\\\\Office16\\\\WINWORD.EXE', Image: 'C:\\\\Windows\\\\SysWOW64\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe' }, '32-bit powershell'),
      sys('b1', false, { EventID: 1, ParentImage: 'C:\\\\Windows\\\\explorer.exe', Image: 'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe' }, 'admin console'),
      sys('b2', false, { EventID: 1, ParentImage: 'C:\\\\Program Files\\\\Microsoft Office\\\\WINWORD.EXE', Image: 'C:\\\\Windows\\\\splwow64.exe' }, 'print helper'),
      sys('b3', false, { EventID: 1, ParentImage: 'C:\\\\Windows\\\\System32\\\\cmd.exe', Image: 'C:\\\\Windows\\\\System32\\\\whoami.exe' }, 'manual whoami'),
    ],
  },
  {
    id: 'rule-beacon-ua',
    level: 2,
    difficulty: 2,
    kind: 'sigma',
    skill: 'l2-hunting',
    title: 'Old browser, odd host',
    brief: 'A beacon calls cdn-update.example.net with an Internet Explorer 6 user agent. The same host is also used by the real telemetry agent, and IE 6 shows up on an intranet wiki. Both facts have to be true.',
    hints: [
      'Match the destination host and the user agent. One of them is not enough.',
      'DestinationHostName == cdn-update.example.net keeps the telemetry host, so add the user agent.',
      'http_user_agent contains MSIE 6.0',
    ],
    model: { sigma: 'logsource proxy\nDestinationHostName == cdn-update.example.net\nhttp_user_agent contains MSIE 6.0' },
    explain: 'The telemetry agent uses a current agent string to the same host. A leftover IE 6 browser hitting the intranet is a different host. The pair is the beacon.',
    samples: [
      proxy('m1', true, { DestinationHostName: 'cdn-update.example.net', http_user_agent: 'Mozilla/4.0 (compatible; MSIE 6.0)', url: 'http://cdn-update.example.net/api/v1/check' }, 'beacon'),
      proxy('m2', true, { DestinationHostName: 'cdn-update.example.net', http_user_agent: 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)', url: 'http://cdn-update.example.net/api/v1/check' }, 'beacon again'),
      proxy('b1', false, { DestinationHostName: 'cdn-update.example.net', http_user_agent: 'CorpTelemetry/2.1', url: 'https://cdn-update.example.net/status' }, 'legit agent'),
      proxy('b2', false, { DestinationHostName: 'wiki.corp.example', http_user_agent: 'Mozilla/4.0 (compatible; MSIE 6.0)', url: 'http://wiki.corp.example/home' }, 'old browser, intranet'),
      proxy('b3', false, { DestinationHostName: 'teams.example.net', http_user_agent: 'Teams/1.6', url: 'https://teams.example.net/api' }, 'teams'),
    ],
  },
  {
    id: 'rule-enc-ps',
    level: 3,
    difficulty: 2,
    kind: 'yara',
    skill: 'l3-detection',
    title: 'Hidden encoded PowerShell',
    brief: 'Flag command lines that hide the window and carry an encoded payload. A normal -File script and a policy email that merely mentions PowerShell should not match.',
    hints: [
      'YARA-lite strings look like $a = "text" nocase. condition is any, all, or a number.',
      'The stager uses both -nop and -enc. Requiring both avoids the inventory script.',
      '$a = "-nop" nocase\n$b = "-enc" nocase\ncondition: all',
    ],
    model: { yara: '$a = "-nop" nocase\n$b = "-enc" nocase\ncondition: all' },
    explain: '"powershell" alone matches the helpdesk email and the SCCM inventory script. -nop and -enc together are the stager. condition: all means both strings must hit.',
    samples: [
      text('m1', true, 'powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA', 'encoded stager'),
      text('m2', true, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoP -W Hidden -Enc QQBkAGQA', 'same flags, different case'),
      text('b1', false, 'powershell.exe -File C:\\ProgramData\\SCCM\\inventory.ps1', 'management script'),
      text('b2', false, 'Please review the PowerShell execution policy before Friday.', 'email mention'),
      text('b3', false, 'cmd.exe /c whoami & nltest /dclist:corp.example', 'discovery, no powershell flags'),
    ],
  },
  {
    id: 'rule-webshell',
    level: 3,
    difficulty: 2,
    kind: 'yara',
    skill: 'l3-detection',
    title: 'Two ways to eval',
    brief: 'A web root contains PHP. Two shells are in the set: one eval()s POST data, one eval()s a base64 blob. A function named evaluate() and a lone base64_decode of a config are benign.',
    hints: [
      'The word "eval" is inside "evaluate". Match eval( so you do not hit that function.',
      'The two shells do not share one full phrase. condition: any lets either string fire.',
      '$a = "eval($_POST"\n$b = "eval(base64_decode"\ncondition: any',
    ],
    model: { yara: '$a = "eval($_POST"\n$b = "eval(base64_decode"\ncondition: any' },
    explain: 'condition: any is an OR. condition: all would miss each shell, because each file has only one of the two phrases. A bare "eval" also matches evaluate().',
    samples: [
      text('m1', true, '<?php eval($_POST["c"]); ?>', 'post shell'),
      text('m2', true, '<?php eval(base64_decode($_REQUEST["x"])); ?>', 'encoded shell'),
      text('b1', false, '<?php function evaluate($input) { return strlen($input); } ?>', 'innocent name'),
      text('b2', false, '<?php $cfg = base64_decode($configBlob); ?>', 'config decode, no eval'),
      text('b3', false, '<?php echo "hello"; ?>', 'static page'),
    ],
  },
  {
    id: 'rule-stoplog',
    level: 3,
    difficulty: 3,
    kind: 'sigma',
    skill: 'l3-cloud',
    title: 'Who turned the trail off?',
    brief: 'StopLogging is serious, but the break-glass admin does it from 10.1.1.1 during maintenance. Alert only when that API is called from 203.0.113.200.',
    hints: [
      'eventName and the source IP both matter. StopLogging from the break-glass host is expected.',
      'CreateAccessKey from the office is a different event.',
      'eventName == StopLogging\nsrc_ip == 203.0.113.200',
    ],
    model: { sigma: 'logsource cloudtrail\neventName == StopLogging\nsrc_ip == 203.0.113.200' },
    explain: 'StopLogging from 10.1.1.1 is the documented maintenance account. The same API from 203.0.113.200 is the stolen key turning off the trail. CreateAccessKey is persistence, a separate rule.',
    samples: [
      cloud('m1', true, { eventName: 'StopLogging', src_ip: '203.0.113.200', userName: 'ci-deployer' }, 'stolen key disables the trail'),
      cloud('m2', true, { eventName: 'StopLogging', src_ip: '203.0.113.200', userName: 'ci-deployer', errorCode: '' }, 'second call, same source'),
      cloud('b1', false, { eventName: 'StopLogging', src_ip: '10.1.1.1', userName: 'breakglass' }, 'maintenance'),
      cloud('b2', false, { eventName: 'CreateAccessKey', src_ip: '10.1.1.1', userName: 'adm.lchen' }, 'admin creates a key'),
      cloud('b3', false, { eventName: 'ConsoleLogin', src_ip: '203.0.113.200', userName: 'ci-deployer' }, 'same IP, different API'),
    ],
  },
];

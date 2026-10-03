// Query challenges for the sandbox. Graded by the RESULT SET, never by the query text:
// any query (SPL or KQL) whose results contain the right values passes.
//
// answer(ds) -> one of
//   { mode: 'top', values: [v], alts: [...] }  the first row must contain v (sort so the answer is on top)
//   { mode: 'set', values: [...] }            some column must hold exactly these values (no extras)
//   { mode: 'counts', counts: { key: n } }    a key column and a count column must match exactly
// Answers are computed from the generated dataset so they always agree with the data.
//
// Fields: id, level (1-3: which curriculum tier it belongs to), difficulty (1-3), dataset, skill,
//   title, brief (the situation), task (what to return), hints (3, gentle -> specific),
//   model: { spl, kql } (both pass the grader; shown after solving), explain (why it works), learn.

import { getDataset, LAB_NOW } from './datasets.js';

const T = (hh, mm = 0) => Date.UTC(2026, 8, 24, hh, mm) / 1000;
const countBy = (events, pred, key) => {
  const out = {};
  for (const e of events) if (pred(e)) out[e[key]] = (out[e[key]] || 0) + 1;
  return out;
};

export const QUERY_CHALLENGES = [
  // ------------------------------------------------------------------ Level 1
  {
    id: 'q-brute-src',
    level: 1,
    difficulty: 1,
    dataset: 'winsec',
    skill: 'host-logs',
    title: 'Who is knocking?',
    brief: 'The jump host SRV-JUMP-01 is exposed to the internet for RDP. Failed logons (event 4625) are piling up.',
    task: 'Find the source IP with the most failed logons. Put it in the first row.',
    hints: [
      'Filter to failed logons first: event ID 4625.',
      'Count failed logons per source IP, then sort so the biggest count is on top.',
      'SPL: … | stats count by src_ip | sort -count    KQL: … | summarize count() by IpAddress | order by count_ desc',
    ],
    model: {
      spl: 'index=wineventlog EventCode=4625\n| stats count by src_ip\n| sort -count\n| head 5',
      kql: 'SecurityEvent\n| where EventID == 4625\n| summarize count() by IpAddress\n| top 5 by count_',
    },
    explain: '203.0.113.45 made hundreds of failed attempts in 40 minutes with a rotating list of usernames: a classic brute force. The internal 10.10.2.20 (svc_sql every 30 min) is a stale service password, and 198.51.100.23 tried each user once (a spray: low count per user, many users).',
    learn: ['filter', 'stats count by', 'sort'],
    answer: (ds) => ({ mode: 'top', values: [ds.truth.bruteSrc] }),
  },
  {
    id: 'q-fail-by-user',
    level: 1,
    difficulty: 1,
    dataset: 'winsec',
    skill: 'host-logs',
    title: 'Failures per account',
    brief: 'Your lead wants a quick table for the morning report: how many failed logons did each account have in the last 24 hours?',
    task: 'Return one row per account (the target user of event 4625) with its number of failed logons.',
    hints: [
      'Failed logons are event ID 4625. The account that failed is the target user.',
      'Group by the user field and count. Every account needs its own row: no head/take this time.',
      'SPL: … | stats count by user    KQL: … | summarize count() by TargetUserName',
    ],
    model: {
      spl: 'index=wineventlog EventCode=4625\n| stats count by user\n| sort -count',
      kql: 'SecurityEvent\n| where EventID == 4625\n| summarize count() by TargetUserName\n| order by count_ desc',
    },
    explain: 'Counting by account shows who is being targeted. administrator and a.patel stand out (brute-force targets; a.patel was locked out, event 4740), svc_sql fails like clockwork (stale password on a service), and names like "test" or "scan" don\'t exist (Sub_Status 0xC0000064).',
    learn: ['stats count by', 'counts'],
    answer: (ds) => ({ mode: 'counts', counts: countBy(ds.events, (e) => e.EventID === 4625, 'TargetUserName') }),
  },
  {
    id: 'q-port-scan',
    level: 1,
    difficulty: 1,
    dataset: 'firewall',
    skill: 'net-fw-logs',
    title: 'Knock on every door',
    brief: 'Something is probing the server VLAN. The authorised vulnerability scanner 10.0.9.5 also runs nightly, sweeping many hosts on a handful of ports.',
    task: 'Find the source IP that touched the most DIFFERENT destination ports. Put it in the first row.',
    hints: [
      'A port scan = one source, many destination ports. Count distinct ports, not connections.',
      'Distinct count: dc() in SPL, dcount() in KQL. Group by the source IP, sort descending.',
      'SPL: … | stats dc(dest_port) as ports by src_ip | sort -ports    KQL: … | summarize ports = dcount(DestinationPort) by SourceIp | order by ports desc',
    ],
    model: {
      spl: 'index=firewall\n| stats dc(dest_port) as ports dc(dest_ip) as hosts count by src_ip\n| sort -ports\n| head 5',
      kql: 'AZFWNetworkRule\n| summarize ports = dcount(DestinationPort), hosts = dcount(DestinationIp), count() by SourceIp\n| top 5 by ports',
    },
    explain: '10.0.5.23 hit ~150 different ports on two servers within a couple of minutes (vertical scan). The vulnerability scanner touches many hosts but only 12 ports (horizontal sweep) and is expected. Distinct counts separate the two patterns.',
    learn: ['dc / dcount', 'sort'],
    answer: (ds) => ({ mode: 'top', values: [ds.truth.scanSrc] }),
  },
  {
    id: 'q-ssh-breach',
    level: 1,
    difficulty: 2,
    dataset: 'auth',
    skill: 'host-logs',
    title: 'Knock, knock… come in',
    brief: 'Internet scanners fail SSH logins all day. What matters is a source that failed many times and then SUCCEEDED.',
    task: 'Return the source IP(s) with more than 20 failed SSH logins AND at least one successful login.',
    hints: [
      'sshd lines have parsed fields: user, src and action (failure / success).',
      'Count failures and successes separately per source. In SPL: eval a 1/0 flag and sum it; in KQL: countif().',
      'SPL: … | eval fail=if(action="failure",1,0), ok=if(action="success",1,0) | stats sum(fail) as fails sum(ok) as successes by src | where fails>20 AND successes>0',
    ],
    model: {
      spl: 'index=linux_auth process=sshd action=*\n| eval fail=if(action="failure",1,0), ok=if(action="success",1,0)\n| stats sum(fail) as fails sum(ok) as successes by src\n| where fails > 20 AND successes > 0',
      kql: 'Syslog\n| where ProcessName == "sshd" and isnotempty(Action)\n| summarize fails = countif(Action == "failure"), successes = countif(Action == "success") by SrcIp\n| where fails > 20 and successes > 0',
    },
    explain: '192.0.2.77 failed ~150 times against web-prod-02 and then logged in as deploy with a password. 198.51.100.200 failed even more but never got in: noise. "Most failures" alone points at the wrong IP; failures followed by success is the signal.',
    learn: ['eval / countif', 'conditional counts', 'where on aggregates'],
    answer: (ds) => ({ mode: 'set', values: [ds.truth.sshAttacker] }),
  },

  // ------------------------------------------------------------------ Level 2
  {
    id: 'q-fail-peak-hour',
    level: 2,
    difficulty: 2,
    dataset: 'winsec',
    skill: 'l2-siem',
    title: 'Rush hour',
    brief: 'For the incident timeline you need to know when the failed-logon storm happened.',
    task: 'Find the hour (UTC) with the most failed logons. Put that hour bucket in the first row.',
    hints: [
      'Round each event\'s time down to the hour, then count per hour.',
      'SPL: bin _time span=1h (or timechart span=1h count). KQL: summarize … by bin(TimeGenerated, 1h).',
      'SPL: … | bin _time span=1h | stats count by _time | sort -count    KQL: … | summarize count() by bin(TimeGenerated, 1h) | top 1 by count_',
    ],
    model: {
      spl: 'index=wineventlog EventCode=4625\n| bin _time span=1h\n| stats count by _time\n| sort -count\n| head 3',
      kql: 'SecurityEvent\n| where EventID == 4625\n| summarize count() by bin(TimeGenerated, 1h)\n| top 3 by count_',
    },
    explain: 'Everything piles up between 02:00 and 03:00 UTC: the brute force against SRV-JUMP-01 (02:10–02:52). Time bucketing turns a wall of events into a shape you can read.',
    learn: ['bin / timechart', 'time buckets'],
    answer: () => ({ mode: 'top', values: [T(2)], alts: [2, '02', '2026-09-24 02:00', '2026-09-24 02:00:00', '2026-09-24T02:00:00Z'] }),
  },
  {
    id: 'q-dns-tunnel',
    level: 2,
    difficulty: 2,
    dataset: 'dns',
    skill: 'l2-hunting',
    title: 'Data in the names',
    brief: 'DNS tunnelling hides data in long, random subdomains. CDNs and the antivirus reputation service also use odd-looking names, but short ones, from many hosts.',
    task: 'Find the internal client that sent the most unique, very long (over 50 characters) query names. Put it in the first row.',
    hints: [
      'Compute the length of each query name, keep only the long ones.',
      'Then count distinct names per client and sort. SPL: len(query). KQL: strlen(Name).',
      'SPL: … | eval len=len(query) | where len > 50 | stats dc(query) as unique_names by src | sort -unique_names',
    ],
    model: {
      spl: 'index=dns\n| eval len=len(query)\n| where len > 50\n| stats count dc(query) as unique_names avg(len) as avg_len by src\n| sort -unique_names',
      kql: 'DnsEvents\n| extend len = strlen(Name)\n| where len > 50\n| summarize count(), unique_names = dcount(Name), avg_len = avg(len) by ClientIP\n| order by unique_names desc',
    },
    explain: '10.20.7.31 sent hundreds of unique 80+ character TXT lookups under t.sync-data.example: each label carries encoded data. Legitimate long names repeat (CDN) or stay under ~40 characters (AV reputation).',
    learn: ['eval / extend', 'len / strlen', 'dc / dcount'],
    answer: (ds) => ({ mode: 'top', values: [ds.truth.tunnelSrc] }),
  },
  {
    id: 'q-office-shell',
    level: 2,
    difficulty: 2,
    dataset: 'sysmon',
    skill: 'l2-malware',
    title: 'Macro to shell',
    brief: 'Word, Excel and Outlook launch plenty of child processes (printing helpers, browsers). They should almost never launch PowerShell or cmd.',
    task: 'Find the host where an Office application (WINWORD, EXCEL or OUTLOOK) started powershell.exe or cmd.exe. Return only those process-creation events (or just the host).',
    hints: [
      'Process creation is Sysmon event 1. The parent is ParentImage / parent_process; the child is Image / process.',
      'Match the parent against the Office executables and the child against powershell.exe / cmd.exe. Paths are long, so use wildcards (SPL) or has / endswith (KQL).',
      'SPL: index=sysmon EventCode=1 (parent_process="*WINWORD.EXE" OR …) (process="*powershell.exe" OR process="*cmd.exe")',
    ],
    model: {
      spl: 'index=sysmon EventCode=1 (parent_process="*WINWORD.EXE" OR parent_process="*EXCEL.EXE" OR parent_process="*OUTLOOK.EXE") (process="*powershell.exe" OR process="*cmd.exe")\n| table _time host user parent_process process process_command_line',
      kql: 'SysmonEvent\n| where EventID == 1\n| where ParentImage has_any ("winword.exe", "excel.exe", "outlook.exe")\n| where Image has_any ("powershell.exe", "cmd.exe")\n| project TimeGenerated, Computer, User, ParentImage, Image, CommandLine',
    },
    explain: 'On WS-HR-12, WINWORD.EXE (opened from an Outlook attachment, Invoice_4471.docm) started powershell.exe -nop -w hidden -enc …: a macro stager. The decoded command downloads a script from 198.51.100.66, and PowerShell then drops updsvc.exe and runs whoami / nltest (discovery).',
    learn: ['parent-child', 'wildcards / has_any'],
    answer: (ds) => ({ mode: 'set', values: [ds.truth.officeShellHost] }),
  },
  {
    id: 'q-sudo-rex',
    level: 2,
    difficulty: 2,
    dataset: 'auth',
    skill: 'l2-ir',
    title: 'What did they run?',
    brief: 'deploy was brute-forced at 03:41 UTC today. sudo lines are raw text, like: "deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/…". deploy normally runs systemctl from CI during the day.',
    task: 'Extract the commands deploy ran with sudo since 03:41 UTC on 24 Sep. Return them as a column (one per row).',
    hints: [
      'Keep sudo lines for deploy, and only from 03:41 onwards (SPL: earliest="09/24/2026:03:41:00"; KQL: TimeGenerated >= datetime(2026-09-24 03:41)).',
      'Pull the text after COMMAND= into its own field. SPL: rex. KQL: extract() or parse.',
      'SPL: … | rex "COMMAND=(?<command>.+)$" | table _time command    KQL: … | extend command = extract(@"COMMAND=(.+)$", 1, SyslogMessage)',
    ],
    model: {
      spl: 'index=linux_auth process=sudo "deploy :" earliest="09/24/2026:03:41:00"\n| rex "COMMAND=(?<command>.+)$"\n| table _time host command',
      kql: 'Syslog\n| where ProcessName == "sudo" and SyslogMessage startswith "deploy :"\n| where TimeGenerated >= datetime(2026-09-24 03:41:00)\n| extend command = extract(@"COMMAND=(.+)$", 1, SyslogMessage)\n| project TimeGenerated, HostName, command',
    },
    explain: 'Download a script from 198.51.100.66, make it executable, run it as root, then check cron (persistence next). Field extraction turns unparsed text into something you can group, count and alert on.',
    learn: ['rex / extract / parse', 'time bounds'],
    answer: (ds) => ({ mode: 'set', values: ds.truth.evilCommands }),
  },
  {
    id: 'q-beacon',
    level: 2,
    difficulty: 3,
    dataset: 'proxy',
    skill: 'l2-hunting',
    title: 'Heartbeat',
    brief: 'Malware "beacons": it calls its C2 on a timer, so the gaps between requests are almost identical. People browse in bursts. The telemetry agent also calls home every ~5 minutes (legit).',
    task: 'Find the source IP whose requests to one domain come roughly every minute with very little jitter (more than 50 requests, average gap under 120 s, standard deviation under 10 s).',
    hints: [
      'You need the time between consecutive requests from the same source to the same domain. Sort by time first.',
      'SPL: sort 0 _time | streamstats current=f last(_time) as prev by src, dest_host | eval gap=_time-prev. KQL: order by … then prev(TimeGenerated).',
      'Then: stats count avg(gap) as avg_gap stdev(gap) as jitter by src, dest_host | where count>50 AND avg_gap<120 AND jitter<10',
    ],
    model: {
      spl: 'index=proxy\n| sort 0 _time\n| streamstats current=f last(_time) as prev_time by src, dest_host\n| eval gap=_time-prev_time\n| stats count avg(gap) as avg_gap stdev(gap) as jitter by src, dest_host\n| where count > 50 AND avg_gap < 120 AND jitter < 10',
      kql: 'CommonSecurityLog\n| order by SourceIP asc, DestinationHostName asc, TimeGenerated asc\n| extend gap = iff(SourceIP == prev(SourceIP) and DestinationHostName == prev(DestinationHostName), (TimeGenerated - prev(TimeGenerated)) / 1s, real(null))\n| summarize count(), avg_gap = avg(gap), jitter = stdev(gap) by SourceIP, DestinationHostName\n| where count_ > 50 and avg_gap < 120 and jitter < 10',
    },
    explain: '10.20.4.17 (t.brown) calls http://cdn-update.example.net/api/v1/check every 60 ± 3 seconds for six hours, with an old IE user agent and tiny responses: C2 beaconing. The telemetry agent is regular too, but every ~5 minutes with far more jitter, from many hosts, to a known vendor.',
    learn: ['streamstats / prev()', 'avg + stdev', 'beacon hunting'],
    answer: (ds) => ({ mode: 'set', values: [ds.truth.beaconSrc] }),
  },

  // ------------------------------------------------------------------ Level 3
  {
    id: 'q-kerberoast',
    level: 3,
    difficulty: 2,
    dataset: 'winsec',
    skill: 'l3-identity',
    title: 'Roasting season',
    brief: 'Kerberoasting: request service tickets for accounts with SPNs, ideally RC4-encrypted (0x17), and crack them offline. The legacy NAS (NAS-LEGACY$, a machine account) only speaks RC4: that is expected.',
    task: 'Find the account that requested RC4 (0x17) service tickets (event 4769) for three or more different user service accounts (not ending in $).',
    hints: [
      'Filter: event 4769, ticket encryption 0x17, and exclude service names ending in $ (machine accounts).',
      'Group by the requesting account and count distinct service names.',
      'SPL: … NOT Service_Name="*$" | stats dc(Service_Name) as services by user | where services >= 3',
    ],
    model: {
      spl: 'index=wineventlog EventCode=4769 Ticket_Encryption_Type=0x17 NOT Service_Name="*$"\n| stats dc(Service_Name) as services values(Service_Name) as spns by user\n| where services >= 3',
      kql: 'SecurityEvent\n| where EventID == 4769 and TicketEncryptionType == "0x17" and not(ServiceName endswith "$")\n| summarize services = dcount(ServiceName), spns = make_set(ServiceName) by TargetUserName\n| where services >= 3',
    },
    explain: 'j.nguyen (from WS-ENG-21) asked for RC4 tickets for six service accounts in about 40 seconds at 04:31 UTC. One user, many SPNs, RC4, short burst = Kerberoasting. Rotate those service passwords (long, random, gMSA where possible) and enforce AES.',
    learn: ['4769', 'NOT / not()', 'dc + values'],
    answer: (ds) => ({ mode: 'set', values: [ds.truth.kerberoaster] }),
  },
  {
    id: 'q-dcsync',
    level: 3,
    difficulty: 3,
    dataset: 'winsec',
    skill: 'l3-identity',
    title: 'Replication impostor',
    brief: 'DCSync abuses directory replication rights to pull password hashes. Event 4662 on a DC records the rights used, as GUIDs in Properties: 1131f6ad-9c07-11d1-f79f-00c04fc2dcd2 = DS-Replication-Get-Changes-All. Domain controllers (names ending in $) replicate all day, and MSOL_7c1f02 is the documented Entra Connect sync account.',
    task: 'Return the account(s) that used DS-Replication-Get-Changes-All and are NOT a domain controller or the Entra Connect account.',
    hints: [
      'Event 4662 with Properties containing the Get-Changes-All GUID. The account doing it is the subject (SubjectUserName / src_user).',
      'Exclude subjects ending in $ and the MSOL_ account.',
      'SPL: index=wineventlog EventCode=4662 Properties="*1131f6ad-9c07-11d1-f79f-00c04fc2dcd2*" NOT src_user="*$" NOT src_user="MSOL_*" | stats count by src_user',
    ],
    model: {
      spl: 'index=wineventlog EventCode=4662 Properties="*1131f6ad-9c07-11d1-f79f-00c04fc2dcd2*" NOT src_user="*$" NOT src_user="MSOL_*"\n| stats count values(ComputerName) as dc by src_user',
      kql: 'SecurityEvent\n| where EventID == 4662 and Properties has "1131f6ad-9c07-11d1-f79f-00c04fc2dcd2"\n| where not(SubjectUserName endswith "$") and not(SubjectUserName startswith "MSOL_")\n| summarize count(), dc = make_set(Computer) by SubjectUserName',
    },
    explain: 'svc_scan (a scanning service account, logged on from WS-ENG-21) requested Get-Changes, Get-Changes-All and Get-Changes-In-Filtered-Set on DC01 at 05:14 UTC: a DCSync. Treat every domain credential as exposed, including krbtgt (reset it twice), and find out how svc_scan got replication rights.',
    learn: ['4662 GUIDs', 'allow-listing known-good'],
    answer: (ds) => ({ mode: 'set', values: [ds.truth.dcsync] }),
  },
  {
    id: 'q-cloud-denied',
    level: 3,
    difficulty: 2,
    dataset: 'cloud',
    skill: 'l3-cloud',
    title: 'Denied, denied, allowed',
    brief: 'A burst of AccessDenied errors usually means someone is enumerating permissions with stolen keys. The dangerous part is what DID work.',
    task: 'Find the source IP behind the AccessDenied burst, then list every API call (eventName) from that IP that succeeded (no error code).',
    hints: [
      'Step 1: count AccessDenied errors per source IP. One external IP stands out.',
      'Step 2: from that IP, keep only events with no errorCode and list the eventNames.',
      'In one SPL query: eval denied=if(errorCode="AccessDenied",1,0) | eventstats sum(denied) as denied_from_ip by src_ip | where denied_from_ip > 20 AND isnull(errorCode) …',
    ],
    model: {
      spl: 'index=aws_cloudtrail\n| eval denied=if(errorCode="AccessDenied",1,0)\n| eventstats sum(denied) as denied_from_ip by src_ip\n| where denied_from_ip > 20 AND isnull(errorCode)\n| stats count by eventName',
      kql: '// step 1: AWSCloudTrail | where ErrorCode == "AccessDenied" | summarize count() by SourceIpAddress\nAWSCloudTrail\n| where SourceIpAddress == "203.0.113.200" and isempty(ErrorCode)\n| summarize count() by EventName',
    },
    explain: 'ci-deployer\'s access key was used from 203.0.113.200 with a Kali user agent. Most calls failed, but it could read the Terraform state from S3 (secrets!), stop CloudTrail logging (defence evasion) and create a new access key (persistence). Disable both keys, re-enable the trail and rotate every secret in that state file.',
    learn: ['eventstats', 'two-step pivot', 'CloudTrail'],
    answer: (ds) => ({ mode: 'set', values: ds.truth.cloudSucceeded }),
  },
];

/** Expected answer for a challenge (computed from its dataset). */
export function challengeAnswer(ch) {
  return ch.answer(getDataset(ch.dataset));
}

export { LAB_NOW };

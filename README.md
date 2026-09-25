# SOC Tutor

An adaptive tutor that teaches **Security Operations Center (SOC) analyst** skills, starting with host and network basics. It works like a patient coach: it teaches each skill with a short lesson and worked examples, asks you questions, explains every answer, brings back the ones you miss, and when you keep struggling with something it checks the *building blocks* underneath to find the real gap.

It is a plain website (HTML, CSS and JavaScript). There is no server, no account and no AI service — everything runs in your browser and your progress is saved on your device. It is designed to work well on a phone.

## What it teaches (Level 1)

**Host basics**
- OS fundamentals & processes — programs vs processes, PIDs, parent/child trees, suspicious processes
- Users, groups & permissions — Linux `rwx`/root/SUID, Windows admin groups and UAC, least privilege
- File system & common paths — where system files, temp folders, secrets and startup items live
- Services & persistence basics — services, scheduled tasks, cron, Run keys, SSH keys
- Host logs — Windows Security events (4624, 4625, 4688, 4720, 4672, 4732, 1102…) and Linux `auth.log`/syslog

**Network basics**
- OSI & TCP/IP layers
- IP addressing & private ranges
- Subnetting & CIDR
- Ports & common protocols
- TCP handshake, flags & UDP
- DNS
- HTTP & HTTPS basics
- Reading firewall & connection logs

Skills unlock in order. For example, *Subnetting* opens once you've mastered *IP addressing*, and *Host logs* needs *Users & permissions* plus *Processes*. Each skill starts with a short lesson, a worked example and a partly-solved example to finish. The question bank has **128 questions**: multiple choice, "select all that apply", typed answers, and mini-scenarios where you read a real-looking log line, process tree or packet capture and decide what's going on.

### Curriculum tiers

The course is planned as three curriculum levels (`content/career.js` → `TIERS`). The career ladder is spread across all three, so finishing Level 1 is about a third of the way up, and there is room to grow as new tracks arrive.

| Tier | Tracks | Status |
| --- | --- | --- |
| **Level 1 Foundations** | Host basics, Network basics (13 skills) plus SIEM investigations and the *First shift* capstone | Live |
| **Level 2 SOC Operations** | Alert triage, SIEM queries, phishing analysis, malware basics, incident response, threat hunting | Coming soon (on the map) |
| **Level 3 Advanced** | PKI & certificates, cryptography, identity/AD & Kerberos, cloud security, digital forensics, detection engineering | Coming soon (on the map) |

To add a tier or track later: add its skills to `content/skills.js` with a `track`, list the track in the tier's `tracks`, and flip `status` to `available`. Rank gates, the dashboard tier bars and the career view all read from this data, so no code changes are needed.

## How to run it on your computer

You need Python 3 (already installed on most Macs and Linux machines; on Windows get it from python.org).

1. Download this repository (green **Code** button → **Download ZIP**, then unzip it), or clone it with git.
2. Open a terminal in the `soc-tutor` folder and run:

   ```
   python3 -m http.server 8000
   ```

3. Open **http://localhost:8000** in your browser.

To try it on your phone while the server runs on your computer, make sure both are on the same Wi-Fi and open `http://<your-computer's-IP>:8000` on the phone.

> Why not just double-click `index.html`? Browsers block the app's JavaScript modules when a page is opened straight from a file, so it needs to be served by a (tiny, local) web server like the one above.

## How it teaches: lesson first, then practice

Every Level 1 skill starts with a short lesson before any questions. Each lesson (in `content/lessons/`) has four parts:

1. **Concept.** 3–6 short sections, readable on a phone, with real-looking log and command-output examples.
2. **Worked example.** A realistic artifact (a process tree, auth log, firewall log, packet line or subnet problem) and an analyst's step-by-step reasoning. You reveal the steps one at a time, so you can try to predict each one first.
3. **Your turn (faded example).** The same kind of problem, partly solved. You finish the last step or steps yourself and get feedback on each.
4. **Practice.** Questions from the bank.

The lesson shows the first time you enter a skill. There is a **Skip** button if you'd rather go straight to the questions.
- You can reopen any lesson from the book button on its skill-map row, or from the **Review lesson** button on the question screen (which brings you back to the same question).
- Misconception feedback links straight to the relevant lesson section.
- When gap routing sends you to a prerequisite whose lesson you haven't seen, the tutor first offers that lesson ("Read the lesson first" or "Skip to the check").
- Skills you prove in the placement check are not forced through the lesson, but the lesson is still available.

Finishing a worked example, a faded example or a whole lesson earns XP (see `XP_RULES`).

## Confidence, misconceptions and mixed practice

- **Confidence ratings.** You submit an answer by tapping **Guess**, **Unsure** or **Sure**. Rating is required (the placement check keeps a single Submit button). The rating changes what the answer means:
  - A correct *guess* gives only 35% of the normal mastery credit, and the question comes back within 4 questions and sooner in the long-term schedule.
  - A correct *unsure* gives 70% of the credit. A correct *sure* gives full credit.
  - A wrong *sure* is flagged as a likely misconception rather than a slip. It comes back after 2 questions and is listed under "Confident errors" in the gap report.
  - **Calibration**, meaning how often your *Sure* answers are right, is shown in the gap report and feeds the *Calibrated* badge.
- **Misconception-targeted feedback.** `content/misconceptions.js` catalogs 41 common beginner errors across the 13 skills. Each has an id, a short name, a description, a targeted fix and a link to a lesson section. Examples: confusing 4624 with 4625, thinking 172.40.x.x is private, mixing up source and destination ports, believing UDP has a handshake, counting 256 usable hosts in a /24, confusing PID and PPID, treating any PowerShell as malicious, assuming HTTPS means safe, confusing DNS A and PTR records.
  - Wrong choices in questions are tagged with these ids, and so are common wrong typed answers such as `256` for a /24. For "select all" questions, both a wrong pick and a missed right answer can reveal a misconception.
  - When a tagged wrong answer is picked, the feedback shows the targeted fix.
  - Within the next few questions, the tutor serves a follow-up: a *different* question that tests the *same* misconception. Get it right and the misconception is marked resolved (+XP, counts toward *Myth Buster*). Miss it and it is re-tested a few questions later.
  - Active and resolved misconceptions are listed in the gap report. Every misconception is tested by at least two questions, so a distinct follow-up always exists.
- **Interleaving.** Once you have learned 2 or more skills, the normal flow slips in an occasional question from another learned skill. It starts at about every 4th question and becomes more frequent as you learn more skills; the least recently practised skill goes first. Mixing topics is harder in the moment but builds longer-lasting, more flexible knowledge.
- **Mixed practice mode** (dashboard, under *Operations*). Draws scenario-style questions (log lines, process trees, packets) from all your learned skills. For evidence questions, it first asks **"Which area does this evidence involve?"**, because recognising which knowledge applies is half of triage. Your recognition rate is shown in the gap report.

## Spaced review across days

Alongside the in-session review list (missed questions come back after a few questions), every question you answer gets a long-term review card in `state.cards`. The **Daily review** button on the dashboard shows how many are due today. Finishing all of them earns the daily review XP and counts toward the *Daily Duty* badge.

**Scheduler: "FSRS-lite"** (`js/scheduler.js`). This is a simplified version of the FSRS model used by modern flashcard apps. Each card keeps:
- **stability** `S`: the number of days until recall probability drops to 90%;
- **difficulty** `D`: from 1 to 10;
- the time of the last review.

Recall probability after `t` days is estimated as `R = 0.9^(t/S)`.
- **Grades** come from the answer plus confidence: wrong = 1, guess = 2, unsure = 3, sure = 4.
- **First review.** `S` starts at 0.5, 1, 2 or 4 days by grade.
- **Success.** `S` grows by a factor that is larger for easy cards, for sure answers, and when the review came late (low `R`). The next due date is `S` days out, aligned to local midnight and capped at 180 days.
- **Lapse** (a wrong answer). `S` is cut to 30%, difficulty rises, and the card is due tomorrow.
- **Same-day repeats** of a card that isn't due don't inflate `S`.

Why FSRS-lite rather than SM-2? SM-2 only tracks an "ease factor" and a fixed interval sequence. The stability/retrievability model gives an actual *probability of remembering* at any moment. That one number drives both the schedule and **mastery decay**. It also rewards a successful recall after a long gap more than one after a short gap, and it maps cleanly onto the confidence grades. The parameters are hand-tuned rather than fitted to data (see limitations below).

**Mastery decay.** When you open the app, each skill's mastery estimate is capped at its estimated retention plus 10%, never below 70%. Retention is computed from the stability of that skill's cards and the time since you last practised it. A mastered skill you haven't touched in weeks shows as **Refresh** on the skill map until you practise it again. Recent practice is never penalised.

**Testing the clock.** Everything takes an injectable `now`, and the tests use a fake clock. In the browser, open the app with `?debugDays=5` to pretend five days have passed (the dashboard footer shows the offset). Use `?debugDays=0` to go back to the real clock.

## Operations: SIEM investigations and the capstone

The dashboard **Operations** panel holds three activities: **Mixed practice**, **SIEM investigations** and the **First shift as a Tier 1 analyst** capstone. All of the logs are fictional. They use RFC 5737 documentation IPs (192.0.2.x, 198.51.100.x, 203.0.113.x), private 10.x addresses and `example`-style domains.

### SIEM investigation mode (`content/siem-cases.js`, `js/siem.js`)

Each case starts with an alert. You search a simulated log table that mixes up to seven sources: **WIN** (Windows Security events), **PROC** (process creation), **FW** (firewall and VPN), **DNS**, **PRXY** (web proxy), **IDP** (cloud sign-in logs) and **OPS** (ops and SIEM health: agent status, connector gaps, retention, on-call pages, change calendar). Tools:
- A free-text search box, source chips with row counts, and host / user / event type / time-window filters. On a phone these sit in a sticky bar; the time windows are built from the case's own timestamps.
- Tapping a row expands it and offers **pivots**, such as *this host*, *this user*, *this IP* or *this domain*, so you can jump from a firewall line to the DNS lookup and then to the process that made it.
- **Pin as evidence** adds the row to a tray. The tray shows the pin count and jumps to the verdict panel.
- **Verdict:** true positive, benign true positive or false positive. You justify it with your pinned evidence plus a 1–3 sentence write-up.

**Scoring, 100 points** (`scoreCase`):
- **Verdict (45).** A near miss gets partial credit, for example a benign true positive called as a false positive.
- **Key evidence (35).** Each case lists the key findings and the rows that prove them. You lose 4 points for each noise pin, up to 15; rows marked as related context are never penalised.
- **Efficiency (10).** Full marks up to the case's par number of distinct searches, then minus 1 for each extra search. You get none if you found no evidence at all.
- **Write-up (10).** Checks for the ideas a strong analyst would mention. It is keyword-based and needs at least 20 characters.

A case is **solved** when the verdict is right and the score is 60 or more. The feedback screen breaks down the score, lists each key finding as found or missed (with the rows that prove it), and ends with a "What a strong analyst would have noticed" section.

| Case | Difficulty | Answer | Unlocks when you've learned |
| --- | --- | --- | --- |
| Night-time logon storm (RDP brute force from the internet, then a successful logon and `net user /add`) | Easy | True positive | Host logs, Ports & protocols |
| Encoded PowerShell as SYSTEM (an SCCM inventory script during a change window) | Easy | Benign true positive | OS & processes |
| certutil and a URL (the "URL" is a local certificate file path, and no network traffic happens) | Medium | False positive | OS & processes, HTTP & HTTPS |
| Internal port scan (an authorised vulnerability scanner on its scheduled window) | Medium | Benign true positive | IP addressing, Subnetting, Firewall logs |
| Every sixty seconds (a macro document leads to rundll32 beaconing to a look-alike domain) | Hard | True positive | DNS, HTTP & HTTPS, Firewall logs, OS & processes |

"Learned" means the skill is mastered, or its lesson is done and you have answered at least 4 of its questions with a reasonable mastery estimate (the same rule mixed practice uses). Locked cases show which skills they need.

### Ambiguous cases (`content/siem-ambiguous.js`)

Real alerts often can't be proven either way. Logs have gaps, an agent was down, or the evidence fits two stories. Three cases, marked **Ambiguous** in the case list, train you to make the call anyway and to be honest about how sure you are:

| Case | Difficulty | Preferred call (also defensible) | What's uncertain | Unlocks when you've learned |
| --- | --- | --- | --- | --- |
| A sign-in from Lisbon | Medium | True positive, verify fast (benign true positive) | New country and unmanaged device, but MFA approved first time. No travel data, and mailbox audit is paused. | Users & permissions, Host logs, IP addressing |
| Admin tool, no ticket | Medium | Benign true positive (true positive) | PsExec and "whoami / net localgroup" by an IT admin account on a Saturday. There's an on-call page, but no change record, and the admin laptop's EDR was blind. | OS & processes, Users & permissions, Host logs, Services & persistence |
| The missing three hours | Hard | True positive at medium confidence (benign true positive) | An unsigned tool calls a 3-day-old domain. The endpoint agent was down 08:02–11:05, when it was installed, and TLS wasn't inspected. | OS & processes, File system, DNS, HTTP & HTTPS, Firewall logs |

On these cases the verdict panel adds a **confidence** choice (low / medium / high) and two checklists:
- **What can't the data tell you?** The options mix real gaps with plausible distractors, such as a retention cutoff that doesn't matter because the domain is newer than the archive.
- **Next steps.** The same 8 options on every case: request more logs, verify with the user or manager, check EDR, escalate with stated confidence, contain as a precaution, close, wait, and reimage. Each case rates every option as *best*, *reasonable* (neutral) or *harmful*.

**Scoring, 100 points** (`scoreAmbiguous` in `js/siem.js`). It rewards reasoning, not luck:

| Part | Points | How it is scored |
| --- | --- | --- |
| Verdict | 20 | Only has to be defensible. The preferred call gets 20; the other defensible call gets 12–15; an indefensible call (e.g. false positive when the activity really happened) gets 0 and can't pass. |
| What's missing | 25 | (real gaps ticked − false gaps ticked) ÷ real gaps, floored at 0. Ticking everything doesn't pay. |
| Next steps | 25 | (best steps − harmful steps) ÷ best steps, floored at 0. Reasonable steps are neutral. |
| Confidence | 10 | Calibrated confidence earns full marks. **High is always 0** ("the data proves it" is overconfident when key facts are missing). Being more cautious than the case needs gets partial credit. |
| Evidence | 10 | Key rows pinned. It includes the "gap" rows themselves, like the agent-down or connector-paused events. Noise costs 2 per pin, up to 6. |
| Write-up | 10 | Keyword check: says what can't be confirmed, names the gap, proposes a next step. |

A lucky preferred verdict with no reasoning scores 20 and fails. The other defensible call with good reasoning passes at 92–95. A case is solved at 60+ with a defensible verdict.

The feedback screen shows:
- the score breakdown, with an overconfidence warning when you picked high;
- **Why either call could be defended**;
- **What a senior analyst would do**;
- **What would settle it**;
- every gap and next step, with why it helps or hurts.

Then **Reveal what happened next** shows the outcome from data that came in later. The screen states clearly that the grade is on your reasoning at the time, not on the outcome. One case's outcome deliberately goes the other way from the preferred call: Priya really was on holiday.

Ambiguous cases pay XP at the same rate as other cases of the same difficulty, and count as SIEM cases for rank gates and the *SIEM Sleuth* badge.

### Capstone: First shift as a Tier 1 analyst (`content/scenarios.js`, `js/capstone.js`)

This is one continuous incident that follows alert ALRT-3001 through four stages. Each stage unlocks once you've completed its lessons **and** the stage before it:

1. **The alert and the firewall** (Ports & protocols, Firewall logs)
2. **DNS** (DNS)
3. **The process tree** (OS & processes, Services & persistence)
4. **Logon events** (Host logs, Users & permissions)

A locked stage lists the lessons it is waiting for. Tapping one opens the lesson with a **Back to the capstone** button, and closing it returns you to the capstone, where the stage is now unlocked.

Each stage shows its evidence (log excerpts or a process tree) and asks 3 questions. Your best score per stage is kept, and you can review a stage at any time. After stage 4 you decide whether the incident is real and write the **escalation to Tier 2**. It has structured fields, and each one is scored against a rubric:

| Field | Weight | How it is scored |
| --- | --- | --- |
| Summary | 20 | Covers the key ideas: how it started, the host or user, the C2, persistence, lateral movement. Minimum 40 characters. |
| Severity | 10 | Critical = full credit, High = 80%, Medium = 30% |
| Affected hosts | 10 | Tick lists are scored (right − wrong) ÷ total, floored at 0. This also applies to accounts, timeline, IOCs and actions. |
| Affected accounts | 10 | |
| Timeline | 15 | Tick the events that belong to the incident (some are decoys) |
| IOCs | 15 | |
| Recommended actions | 20 | |

The handoff is accepted at 50 or more. After you submit, the rubric feedback shows what you got right, what you missed and anything you ticked that should not be there, followed by the **model answer**. Your draft is saved as you type.

## How it adapts to you

- **Mastery tracking.** For each skill the tutor keeps an estimate of how likely it is that you know it (a method called *Bayesian Knowledge Tracing*). Every answer updates it. A correct answer on a hard question counts for more than on an easy one; typed answers count for more than multiple choice because they're hard to guess. A skill is **mastered** at 85% after at least 4 answers.
- **Right-sized questions.** When you're new to a skill you get easier questions; as your mastery grows they get harder. It never asks the same question twice in a row.
- **Missed-question review.** Every question you miss goes onto your review list. It comes back after 3 other questions, then again after about 8 more. Get it right both times and it's cleared. A skill can't be marked mastered while you still have misses waiting in it. You can also tap **Missed this session** on the dashboard at any time.
- **Finding the real gap.** If you miss 2 of your last 4 questions in a skill, the tutor says something like *"Let's check a building block: IP addressing"* and asks a couple of quick diagnostic questions on that skill's prerequisites (best of three).
  - If a prerequisite turns out to be weak, it's flagged as a **root gap**. The tutor strengthens it first, then brings you back to where you were.
  - This can go more than one level deep (e.g. Firewall logs → Subnetting → IP addressing), so it finds the deepest weak spot.
  - If the prerequisites are fine, it goes straight back — the trouble is in the skill itself.
- **Placement check (optional).** On first visit you can answer one question per skill to skip ahead on what you already know, or just start from the basics.
- **Gap report.** Shows a recommended next focus, active and resolved misconceptions, confidence calibration and confident errors, root gaps, weak skills, most-missed questions and mastered skills.

Progress is stored in your browser's local storage. **Reset progress** (bottom of the dashboard) wipes it. Clearing browser data or switching browsers/devices also starts you fresh.

### Backup and moving to another device

Open **Profile → Backup & move device** (`js/backup.js`, `js/backup-ui.js`):

- **Download backup file**: a `.json` file with your whole save (`{app, format, exportedAt, stateVersion, state}`). On phones that support it, **Share / save to Files** is offered too.
- **Backup code**: the same save compressed (deflate) and base64url-encoded as one copyable string, `SOCT1.<d|u>.<crc32>.<data>`. The prefix carries the code version and the CRC32 checksum catches a code that was cut short or mistyped. Use this on iPhone if the file download doesn't start: copy it into a note or message it to yourself.
- **Restore** from a file or a pasted code. The backup is validated, older saves are upgraded with the normal save migration, and you see a preview (rank, XP, skills mastered, badges, backup date) and must confirm before your current progress is replaced. The replaced progress is kept for one **Undo import**.
- The screen shows when you last backed up. If it has been 7+ days (or you never have) and you've earned at least 150 XP since, a gentle reminder appears on the home screen (**Later** snoozes it for 3 days).

This is the manual way to move progress. True automatic sync between devices would need a backend server or a login, which this app deliberately doesn't have.

## Adding or editing questions

Questions live in `content/questions/host.js` and `content/questions/network.js`. Each one is a block like this:

```js
{
  id: 'np-09',                 // unique id — never reuse one
  skill: 'net-ports',          // a skill id from content/skills.js
  difficulty: 2,               // 1 = easy, 2 = medium, 3 = hard
  type: 'mc',                  // 'mc' (one answer), 'multi' (select all), or 'text' (typed)
  prompt: 'Which port does LDAP use by default?',
  snippet: `optional log lines or command output shown in a code box`,
  choices: ['389', '636', '88', '445'],
  answer: '389',               // mc: the exact text of the right choice
  explanation: 'Why 389 is right, and why the tempting wrong answers are wrong...',
},
```

- For `multi`, `answer` is a list: `answer: ['HTTP', 'DNS']`.
- For `text`, use `accept` instead of `choices`/`answer`: `accept: ['MX', 'mx record']`. Matching ignores upper/lower case and extra spaces.
- In normal quotes, Windows paths need double backslashes (`'C:\\Windows\\System32'`). Inside a snippet you can use ``String.raw`C:\Users\...` `` instead.
- Use the documentation IP ranges (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) or private ranges in scenarios so examples never point at real systems.

To add a new skill, add it to `content/skills.js` (with its `prereqs`), give it at least 6 questions, and write its lesson.

**Tagging misconceptions.** Add `misconceptions: { '<exact wrong choice or typed answer>': '<misconception id>' }` to a question. Ids come from `content/misconceptions.js`. Each misconception needs at least two questions that test it, so a different follow-up question exists.

**Lessons** live in `content/lessons/host.js` and `content/lessons/network.js`, one per skill. Each has `sections` (`id`, `heading`, `body` paragraphs, optional `points` and `evidence`), `worked` examples (`artifact`, `question`, `steps`, `conclusion`) and `faded` examples (`given` steps plus `todo` steps of type `mc` or `text`). Misconceptions link to sections as `'skill-id#section-id'`. Text supports `` `code` `` and `**bold**`.

Then run the checks (needs [Node.js](https://nodejs.org) 20 or newer):

```
npm test
```

The tests verify the adaptive engine (mastery updates, review scheduling, prerequisite gap routing, no immediate repeats) and the content itself (every question points to a real skill, every skill has enough questions, answers match the choices, no duplicate ids, no circular prerequisites).
`tests/learning.test.js` covers the learning features, again with a fake clock:
- the long-term scheduler (growing intervals, lapses, due counts, DST);
- mastery decay;
- confidence-weighted updates and confident errors;
- misconception follow-ups (a different item, the same misconception, within 3 items);
- interleaving only after 2 or more learned skills, and mixed practice;
- lesson gating, placement bypass and prerequisite lesson offers;
- migration of a real v1 save exported from `main` (`tests/fixtures/v1-save-from-main.json`).

`tests/lessons.test.js` checks the content:
- every skill has a lesson with a worked and a faded example;
- faded answers are valid;
- every referenced misconception id and lesson section exists;
- each misconception has at least two questions;
- scenario requirements are valid;
- public IPs use documentation ranges.

The gamification tests (`tests/game.test.js`) use a fake clock to check the XP rules, level and rank thresholds, every badge condition, streaks and grace days (including DST changes), titles and themes, and the v1 → v2 and v2 → v3 migrations. `tests/career.test.js` covers the 16-rank ladder: gate types, tier progress, next-rank requirements, the level curve, the XP budget and the v2 → v3 ladder migration. `tests/siem.test.js` covers the SIEM query, filter and pivot helpers, the case scorer (verdict credit, evidence, noise penalty, efficiency, write-up), unlocks and case data integrity. `tests/ambiguous.test.js` covers the ambiguous cases: content integrity, defensible verdicts, gap and next-step scoring, calibrated confidence (high = 0), a lucky guess failing, XP and the Grey Area badge, and rank-gate counting. `tests/capstone.test.js` covers the stage unlocks, question and stage scoring, the escalation rubric, the model answer and progress.

## Gamification

Training should feel like progressing through a SOC career, but the rewards are tied to real learning, not to clicking fast.

**XP.** All values live in one table, `XP_RULES` in `js/game.js`:

| Action | XP |
| --- | --- |
| Correct answer: easy / medium / hard | 10 / 15 / 25 |
| Typed answer bonus (when correct) | +5 |
| Wrong answer (effort) | 2 |
| Missed question answered right on review | +8 |
| Missed question cleared from review list | +10 |
| Finish all due reviews for the day | +30 |
| Master a skill (first time) | +100 |
| Close a root gap | +75 |
| "Sure" and correct (confidence) | +5 |
| Misconception resolved | +20 |
| Lesson / worked example / faded example | 30 / 5 / 10 |
| Placement answer: right / wrong | 5 / 2 |
| Easy question in a skill you already mastered | 0 |
| Harder question in a mastered skill | ×0.5 |
| SIEM case (score/100 × rate): easy / medium / hard | 120 / 160 / 220 |
| SIEM case with the wrong verdict | ×0.25 |
| Capstone stage (best score/100 × rate) | 40 |
| Escalation report (score/100 × rate) | 300 |
| Same skill, same day: answers 16–30 / 31+ | ×0.5 / ×0.25 |

XP is never taken away. Wrong answers still earn a little for the effort. Re-answering easy questions in a skill you've already mastered earns nothing, and grinding one skill on the same day has diminishing returns. Investigations and capstone stages pay only for **improvement**: replaying a case pays the difference between your new best score and what you were already paid, so clicking through a case twice earns nothing extra.

**Levels.** Level N starts at 10×(N−1)^2.25 XP, rounded to 5, up to level 60. Early levels come quickly and later ones stretch out:

| Level | 2 | 3 | 5 | 10 | 15 | 20 | 30 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XP | 10 | 50 | 225 | 1,405 | 3,790 | 7,535 | 19,515 | 38,010 | 63,525 | 96,475 |

**How far current content goes** (`xpBudget(content)`, checked by the tests):

| Source | Max XP |
| --- | --- |
| 128 questions answered right (incl. typed and "Sure" bonuses) | 2,695 |
| 13 skills mastered | 1,300 |
| Lessons and worked/faded examples | 585 |
| Misconceptions resolved | 820 |
| 8 SIEM cases at 100% (5 standard + 3 ambiguous) | 1,320 |
| Capstone: 4 stages + escalation at 100% | 460 |
| **Total** | **7,180 XP → level 19 of 60, Tier 1 Analyst III (rank 6 of 16, about a third of the way up the ladder)** |

A month of daily reviews adds about 3,000 XP (10,180 total), which gets you to level 22. That still leaves you at Tier 1 Analyst III, because Tier 2 needs Level 2 content. Root-gap bonuses and streaks are not counted.

**Ranks: the SOC career ladder.** There are 16 ranks spread over the three curriculum tiers, all defined in `content/career.js` → `RANKS`. Each rank needs its XP **and** its gates. The gates are data: `mastered` (N skills in a tier), `tier` (every skill in a tier), `skills` (specific skills), `cases` (N SIEM cases solved), `scenario` (a capstone completed) and `all-tiers`. New tracks slot in without code changes.

| # | Rank | XP | Gates |
| --- | --- | --- | --- |
| 1 | Trainee | 0 | Starting rank |
| 2 | Junior Analyst I | 250 | none |
| 3 | Junior Analyst II | 700 | 2 Level 1 skills mastered |
| 4 | Tier 1 Analyst I | 1,500 | 5 Level 1 skills mastered |
| 5 | Tier 1 Analyst II | 3,000 | 9 Level 1 skills mastered + 1 SIEM case solved |
| 6 | Tier 1 Analyst III | 5,000 | All Level 1 skills + 3 SIEM cases + *First shift* capstone |
| 7 | Tier 2 Analyst I | 9,000 | 2 Level 2 skills mastered |
| 8 | Tier 2 Analyst II | 13,000 | 4 Level 2 skills mastered |
| 9 | Tier 2 Analyst III | 18,000 | All Level 2 skills |
| 10 | Senior Analyst I | 24,000 | All Level 2 + *Night-shift lead* capstone (planned) |
| 11 | Senior Analyst II | 31,000 | 2 Level 3 skills mastered |
| 12 | Incident Responder | 39,000 | Incident response + Digital forensics |
| 13 | Threat Hunter | 48,000 | Threat hunting + Identity/AD & Kerberos |
| 14 | Detection Engineer | 58,000 | SIEM queries + Detection engineering |
| 15 | SOC Lead | 70,000 | All Level 3 skills |
| 16 | SOC Manager | 85,000 | Every tier + *Major incident* capstone (planned) |

The dashboard **Operator** panel shows your rank insignia (chevrons for the sub-step; bars and stars for the band), a ladder strip with the three tiers, and a **Next rank** checklist with a progress bar for each requirement. **Career ladder** opens the full view: where you are, the curriculum tiers with their tracks, and every rank with its requirements and what it unlocks.

Your current title, level and XP bar sit in the status bar and the **Operator** panel on the dashboard.

**Badges** (32, including 4 secret ones that show as "???" until earned). The **Profile & badges** screen shows earned badges, locked silhouettes and your progress toward each one.

| Badge | How to earn it | Unlocks title |
| --- | --- | --- |
| First Blood | Get your first correct answer. |  |
| Certified | Master your first skill. |  |
| Sharpshooter | Get 10 answers right in a row. |  |
| Subnet Sniper | Get 10 Subnetting & CIDR answers right in a row. | Subnet Sniper |
| Log Diver | Correctly analyze 25 log, packet or process scenarios. | Log Diver |
| Hard Target | Answer 10 hard (difficulty 3) questions correctly. |  |
| Total Recall | Get 15 typed answers right. |  |
| Centurion | Answer 100 questions correctly. |  |
| Quick Study | Master a skill without missing a single question in it. |  |
| Host Hardened | Master every Host basics skill. | Host Hardener |
| Packet Whisperer | Master every Network basics skill. | Packet Whisperer |
| Foundation Laid | Master all Level 1 skills. |  |
| Gap Closer | Fix a root gap the tutor identified. | Gap Closer |
| Second Look | Clear 10 missed questions from your review list. |  |
| Daily Duty | Finish all your due reviews on 5 different days. |  |
| Myth Buster | Resolve 5 misconceptions. | Myth Buster |
| Calibrated | Be right on 80%+ of the answers you mark "Sure" (at least 20 Sure answers). | Calibrated |
| Case Closed | Solve your first SIEM investigation (right verdict, 60+ score). |  |
| Sharp Eye | Pin every key piece of evidence in a case with no noise pins. | Sharp Eye |
| Not Today | Correctly clear a false or benign alert without escalating it. |  |
| Grey Area | Solve an ambiguous case with 80+ points, calibrated confidence and no harmful next steps. | Grey Area Analyst |
| SIEM Sleuth | Solve every SIEM investigation case. | SIEM Sleuth |
| Shift Complete | Finish the First shift capstone with an escalation report. | Night Watch |
| Clean Handoff | Score 85% or more on an escalation report. |  |
| On Watch I | Study 3 days in a row. |  |
| On Watch II | Study 7 days in a row. |  |
| On Watch III | Study 30 days in a row. | Watch Commander |
| Night Shift | Study after 10 PM. | Night Shift |
| Dawn Patrol *(secret)* | Study between 5 and 7 AM. |  |
| Overqualified *(secret)* | Ace every question in the placement check. |  |
| Grace Under Fire *(secret)* | Have a grace day keep your streak alive. |  |
| Root Cause *(secret)* | Uncover a gap two building blocks deep. | Root Cause Analyst |

**Study streak.** Your streak counts the days you study. Each calendar week you study banks one grace day, up to 2. If you miss a day, a banked grace day covers it automatically. If you miss more days than you have grace days, a fresh streak simply starts; nothing else is lost. There are no guilt messages.

**Unlockables.**
- **Titles:** every rank you reach, plus the titles from some badges (for example *Subnet Sniper*, *Packet Whisperer*, *Root Cause Analyst*). Equip one on the profile screen.
- **Console themes, spread across the ladder:** Standard cyan (Trainee), **Night Ops** amber (Junior Analyst II), **Incident** red (Tier 1 Analyst II), **Terminal** green (Tier 2 Analyst I), **Deep Hunt** violet (Senior Analyst II), **Whiteout** ice (Detection Engineer), **Command** gold (SOC Lead).

**Feedback moments.**
- A "+N XP" popup appears after each answer, and the result card shows the XP breakdown.
- Badges, rank-ups and level-ups get a short HUD-style **ACHIEVEMENT UNLOCKED** card. It is queued, disappears on its own after about 3 seconds (or when you tap it), and never blocks the question flow.
- With "reduce motion" turned on, cards appear without animation.

**Saved data and migration.** The saved state has `version: 3` (`js/migrate.js`). Version 3 adds `siem` (case records) and `capstones` (stage scores, drafts and escalation results).

Round 1 (v2) saves are upgraded to the 16-rank ladder once, the first time the app opens:
- XP and badges are never touched.
- Rank and level are recomputed from your XP, mastery, cases and capstones. For example, a round-one "Tier 2 Analyst" with all of Level 1 mastered becomes Tier 1 Analyst I. Solving one SIEM case lifts them to Tier 1 Analyst II. Three cases plus the capstone lifts them to Tier 1 Analyst III. Both steps also need the rank's XP.
- Titles you had already earned from the old ladder (for example *Tier 1 Analyst*) and themes you had unlocked stay equippable. If you had one of those titles equipped, it stays equipped.
- If your displayed rank changed, the dashboard shows a one-time **Career ladder updated** note explaining why. Tap **Got it** to dismiss it.

The earlier v1 → v2 upgrade still runs first for very old saves. It holds the game profile (`state.game`), long-term review cards (`cards`), lesson progress (`lessons`), misconceptions, calibration and mixed-practice stats. Existing v1 progress is upgraded automatically, once:
- XP is granted retroactively for past answers, mastered skills and closed gaps.
- The long-term schedule is seeded from past answers. Questions last answered right get a few days' stability, spread out so they don't all fall due on the same day. Questions still in the v1 review list, or last answered wrong, are due today.
- Lessons are marked done for skills that were already mastered. Other skills show their lesson the next time you enter them.
- Streaks and calibration start fresh, since v1 didn't record when answers happened or how confident you were.

## Project layout

```
index.html              the page
css/styles.css          look & feel (dark, mobile-first)
js/app.js               screens and buttons
js/engine.js            the adaptive engine: mastery, reviews, gap routing, lessons, misconceptions,
                        confidence, interleaving (no browser code — unit-tested)
js/scheduler.js         FSRS-lite long-term review scheduler and mastery decay (unit-tested)
js/game.js              XP, levels, ranks, badges, streaks, unlockables (unit-tested)
js/migrate.js           versioned save-data migrations (v1 → v2 → v3)
js/siem.js              SIEM log filtering, pivots, investigation state and case scoring (unit-tested)
js/capstone.js          capstone stage unlocks, stage scoring, escalation rubric (unit-tested)
js/ops-ui.js            career ladder, SIEM and capstone screens
js/insignia.js          rank insignia (SVG)
js/storage.js           saving progress in the browser
js/backup.js            backup file/code export and import (validation, checksum, migration, reminder; unit-tested)
js/backup-ui.js         Backup & move device screen and home reminder
js/icons.js             inline SVG icon set
content/skills.js       skill map, tracks and prerequisites (incl. planned Level 2/3 tracks)
content/career.js       curriculum tiers and the rank ladder (XP + gates)
content/siem-cases.js   SIEM investigation cases (alert, logs, key evidence, model reasoning), sources,
                        confidence scale and the shared next-step options
content/siem-ambiguous.js  ambiguous cases (defensible verdicts, gaps, rated next steps, outcome)
content/questions/*.js  the question bank (with misconception tags)
content/lessons/*.js    one lesson per skill: concept sections, worked and faded examples
content/misconceptions.js  misconception catalog (targeted fixes, lesson links)
content/scenarios.js    scenarios: mixed practice, SIEM mode entry, First shift capstone (stages, escalation rubric, model answer)
tests/                  automated tests (node --test)
```

## Roadmap

- **Level 2 SOC Operations:** alert triage, SIEM queries (Splunk/KQL style), phishing analysis, malware basics, incident response, threat hunting, plus a *Night-shift lead* capstone.
- **Level 3 Advanced:** PKI & certificates, cryptography, identity/AD & Kerberos, cloud security, digital forensics, detection engineering, plus a *Major incident* capstone.
- **More SIEM cases** for each new track (the case format is pure data).
- **More question types:** "put the steps in order", clickable log lines, longer multi-step investigations.
- **Optional AI explanations:** a "explain it differently" button using an AI model (would need an API key and a small backend, so it stays optional).
- **Fit the scheduler:** tune the FSRS-lite parameters against real review data.
- **Progress export/import** so you can move between phone and computer.

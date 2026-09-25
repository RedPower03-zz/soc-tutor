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

Level 2+ tracks (alert triage, SIEM queries, phishing analysis, malware basics, incident response, threat hunting) are shown on the skill map as "Planned".

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

## Operations: scenarios and Round 2 hooks

`content/scenarios.js` defines a modular **scenario / stage** content type: a scenario has stages, each stage lists the lessons it `requires` and a list of `steps` (`brief`, `evidence`, `item`). The dashboard **Operations** panel is the navigation slot for them:
- **Mixed practice** — live now.
- **SIEM investigation mode** — Round 2 (stage defined, content in development).
- **First shift as a Tier 1 analyst** capstone — Round 2. Its four stages already unlock as you complete the lessons they require, and the panel shows your progress (x/4).

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

The gamification tests (`tests/game.test.js`) use a fake clock to check the XP rules, level and rank thresholds, every badge condition, streaks and grace days (including DST changes), titles and themes, and the v1 → v2 migration.

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
| Same skill, same day: answers 16–30 / 31+ | ×0.5 / ×0.25 |

XP is never taken away. Wrong answers still earn a little for the effort. Re-answering easy questions in a skill you've already mastered earns nothing, and grinding one skill on the same day has diminishing returns. Level N starts at 50×N×(N−1) XP (level 2 = 100, level 3 = 300, level 5 = 1,000).

**Ranks: the SOC career ladder.** Every rank is visible from day one. The higher ones need mastery as well as XP.

| Rank | Requirement |
| --- | --- |
| Trainee | Starting rank |
| Junior Analyst | 250 XP |
| Tier 1 Analyst | 1,000 XP and 5 skills mastered |
| Tier 2 Analyst | 2,500 XP and every Level 1 skill mastered |
| Incident Responder | 4,500 XP and Alert triage + Incident response mastered (Level 2+ content) |
| Threat Hunter | 7,000 XP and SIEM queries + Threat hunting mastered (Level 2+ content) |
| SOC Lead | 10,000 XP and the SOC capstone (coming later) |

Your current title, level and XP bar sit in the status bar and the **Operator** panel on the dashboard.

**Badges** (25, including 4 secret ones that show as "???" until earned). The **Profile & badges** screen shows earned badges, locked silhouettes and your progress toward each one.

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
- **Console themes, unlocked at rank-ups:** Standard cyan (Trainee), **Night Ops** amber (Junior Analyst), **Incident** red (Tier 1), **Terminal** green (Tier 2).

**Feedback moments.**
- A "+N XP" popup appears after each answer, and the result card shows the XP breakdown.
- Badges, rank-ups and level-ups get a short HUD-style **ACHIEVEMENT UNLOCKED** card. It is queued, disappears on its own after about 3 seconds (or when you tap it), and never blocks the question flow.
- With "reduce motion" turned on, cards appear without animation.

**Saved data and migration.** The saved state has `version: 2` (`js/migrate.js`). It holds the game profile (`state.game`), long-term review cards (`cards`), lesson progress (`lessons`), misconceptions, calibration and mixed-practice stats. Existing v1 progress from `main` is upgraded automatically, once:
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
js/migrate.js           versioned save-data migrations (v1 → v2)
js/storage.js           saving progress in the browser
js/icons.js             inline SVG icon set
content/skills.js       skill map, tracks and prerequisites
content/questions/*.js  the question bank (with misconception tags)
content/lessons/*.js    one lesson per skill: concept sections, worked and faded examples
content/misconceptions.js  misconception catalog (targeted fixes, lesson links)
content/scenarios.js    scenario/stage content type (mixed practice, Round 2 SIEM mode and capstone)
tests/                  automated tests (node --test)
```

## Roadmap

- **Level 2+ tracks:** alert triage, SIEM queries (Splunk/KQL style), phishing analysis, malware basics, incident response, threat hunting.
- **More question types:** "put the steps in order", clickable log lines, longer multi-step investigations.
- **Optional AI explanations:** a "explain it differently" button using an AI model (would need an API key and a small backend, so it stays optional).
- **Round 2:** SIEM investigation mode and the "First shift as a Tier 1 analyst" capstone (stage content for the existing scenario hooks).
- **Fit the scheduler:** tune the FSRS-lite parameters against real review data.
- **Progress export/import** so you can move between phone and computer.

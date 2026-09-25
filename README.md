# SOC Tutor

An adaptive tutor that teaches **Security Operations Center (SOC) analyst** skills, starting with host and network basics. It works like a patient coach: it asks you questions, explains every answer, brings back the ones you miss, and when you keep struggling with something it checks the *building blocks* underneath to find the real gap.

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

Skills unlock in order. For example, *Subnetting* opens once you've mastered *IP addressing*, and *Host logs* needs *Users & permissions* plus *Processes*. The question bank has **103 questions**: multiple choice, "select all that apply", typed answers, and mini-scenarios where you read a real-looking log line, process tree or packet capture and decide what's going on.

Level 2+ tracks (alert triage, SIEM queries, phishing analysis, malware basics, incident response, threat hunting) are shown on the skill map as "coming soon".

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

## How it adapts to you

- **Mastery tracking.** For each skill the tutor keeps an estimate of how likely it is that you know it (a method called *Bayesian Knowledge Tracing*). Every answer updates it. A correct answer on a hard question counts for more than on an easy one; typed answers count for more than multiple choice because they're hard to guess. A skill is **mastered** at 85% after at least 4 answers.
- **Right-sized questions.** When you're new to a skill you get easier questions; as your mastery grows they get harder. It never asks the same question twice in a row.
- **Missed-question review.** Every question you miss goes onto your review list. It comes back after 3 other questions, then again after about 8 more. Get it right both times and it's cleared. A skill can't be marked mastered while you still have misses waiting in it. You can also tap **Review missed items** at any time.
- **Finding the real gap.** If you miss 2 of your last 4 questions in a skill, the tutor says something like *"Let's check a building block: IP addressing"* and asks a couple of quick diagnostic questions on that skill's prerequisites (best of three).
  - If a prerequisite turns out to be weak, it's flagged as a **root gap**. The tutor strengthens it first, then brings you back to where you were.
  - This can go more than one level deep (e.g. Firewall logs → Subnetting → IP addressing), so it finds the deepest weak spot.
  - If the prerequisites are fine, it goes straight back — the trouble is in the skill itself.
- **Placement check (optional).** On first visit you can answer one question per skill to skip ahead on what you already know, or just start from the basics.
- **Gap report.** Shows your mastered skills, weak skills, root gaps, most-missed questions, and a recommended next focus.

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

To add a new skill, add it to `content/skills.js` (with its `prereqs`) and give it at least 6 questions.

Then run the checks (needs [Node.js](https://nodejs.org) 20 or newer):

```
npm test
```

The tests verify the adaptive engine (mastery updates, review scheduling, prerequisite gap routing, no immediate repeats) and the content itself (every question points to a real skill, every skill has enough questions, answers match the choices, no duplicate ids, no circular prerequisites).

## Project layout

```
index.html              the page
css/styles.css          look & feel (dark, mobile-first)
js/app.js               screens and buttons
js/engine.js            the adaptive engine (no browser code — unit-tested)
js/storage.js           saving progress in the browser
content/skills.js       skill map, tracks and prerequisites
content/questions/*.js  the question bank
tests/                  automated tests (node --test)
```

## Roadmap

- **Level 2+ tracks:** alert triage, SIEM queries (Splunk/KQL style), phishing analysis, malware basics, incident response, threat hunting.
- **More question types:** "put the steps in order", clickable log lines, longer multi-step investigations.
- **Optional AI explanations:** a "explain it differently" button using an AI model (would need an API key and a small backend, so it stays optional).
- **Hosting on GitHub Pages:** the app needs no build step, so it can be published as-is from this repository (Settings → Pages). Note: Pages on a private repository requires a paid GitHub plan; otherwise the repo would need to be public.
- **Progress export/import** so you can move between phone and computer.

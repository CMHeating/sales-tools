# AGENTS.md

**Master routing file for every AI agent that touches CM Heating sales operations.**

Read this first. It says which surface you are, what you are allowed to write,
where finished work goes, and where a new rule gets recorded so the next agent
inherits it. Vendor-specific mechanics live elsewhere and are linked at the
bottom.

**This file is a mirror, not an authority.** The rules originate in
`00 AGENT RULES — read first` (🧠 Second Brain, Drive) and the START HERE doc
(Sales Ops, Drive). Codex and Gemini cannot reach Drive, so those rules are
restated here for them. Where this file and either Drive doc disagree, the Drive
doc is right and this file is the thing to fix.

> **This repository is public.** `CMHeating/sales-tools` is published to GitHub
> Pages. Everything committed here is world-readable. No PINs, no customer
> names, no dollar figures, no staff email addresses, no Drive file IDs. When
> a rule needs an ID or an address to be useful, the rule lives here and the
> identifier lives in the START HERE doc, which is private.

---

## 1. Which surface are you?

Not every agent reads this file automatically. Find your row before assuming
you have context.

| Surface | Reads this file? | Can reach Drive / Gmail? | Can commit? |
|---|---|---|---|
| **Claude Code — local CLI (Mac Mini)** | Yes, plus `CLAUDE.md` | Yes, when MCP connectors are attached | **Yes, including merges to `main`** |
| **Claude Code — cloud / web** | Yes, plus `CLAUDE.md` | Yes, when MCP connectors are attached | Markdown to a feature branch only |
| **Codex** | Only with the repo checked out | No | Yes, on a branch |
| **Gemini** | Only with the repo checked out, via `GEMINI.md` | No | Yes, on a branch |
| **Codor — Mac mini** | Only with the repo checked out *and* the agent pointed at it | **Unverified** — see §9 | **Assume no** until tested |
| **Codor — iPhone** | **No** — no checkout on the device | **Unverified** — see §9 | **No** |
| **Claude chat / account skills** | **No** — see §6 | Yes | No |
| **Scheduled routines / triggers** | Only if the repo is checked out | **Usually no** — see §5 | Depends |
| **Dispatch and any other surface** | Assume no | Assume no | Assume no |

If your row says "no," you are operating from whatever context your own
configuration gave you. Say so rather than guessing, and do not assume a rule
you cannot see does not exist.

**The two Claude Code rows are not interchangeable.** `00 AGENT RULES` §10 puts
merges to `main` and any push touching code on the Mac Mini alone; a cloud
session may push documentation to a feature branch and nothing else. Until
2026-08-20 this table carried one combined row reading "Yes, on a branch,"
which understated the CLI and overstated the cloud session at the same time.
It was caught by a local session that merged to `main` under a row saying it
could not, and reported the contradiction rather than acting as though the
table were the authority. §10 is the authority.

**"Reads this file" means the file is on disk in front of it.** Codex and Gemini
pick up `AGENTS.md` and `GEMINI.md` only when the repo is checked out locally
and the tool is pointed at it. The browser and app versions of both have no
outbound network access — they cannot fetch `github.com/CMHeating/sales-tools`,
and asking one to "go read AGENTS.md" produces either a refusal or an invented
answer. On those surfaces the operator pastes the documents in, and the paste is
the only context the agent has.

Recorded 2026-08-20, from a Gemini session that was handed `RED-TEAM.md` and
reported it could not reach the repo. Before that, the Gemini row of this table
asserted the opposite. Its first substantive recommendation — put the hard rules
in the repo next to the systems they govern — would have published customer
names, AR balances and staff emails to a public GitHub Pages site, which it had
no way to know because it could not read the paragraph at the top of this file
saying so. An agent that cannot see the boundary will route work straight
through it while sounding entirely reasonable.

**Precedence, highest first.**

1. **`00 AGENT RULES — read first`** (🧠 Second Brain) — how any agent behaves:
   the write surface, secrets, Drive mechanics, git. Applies to every surface.
2. **START HERE — CM Heating Sales Ops Source of Truth** (Sales Ops) — how sales
   ops actually works: counting rules, permits, the morning routine, the traps.
3. **This file**, then `CLAUDE.md` — the repo-reachable restatement, plus repo
   mechanics that exist nowhere else.

Find both Drive docs **by title**; their IDs churn. Where a lower level
contradicts a higher one, the higher one is right.

### 1.1 Standard session openers

Claude Code needs none of this — it reads these files on its own. The other
surfaces do not, so the operator pastes the matching block at the top of a
session. Kept here so there is one copy to fix when a rule changes.

**Claude chat / Cowork** — reaches the data, was handed no rules:

> Read "00 AGENT RULES — read first" in the 🧠 Second Brain folder, then the
> Google Drive file "CM Heating — Sales Ops Source of Truth" — find both BY
> NAME, not by ID, the IDs change on every edit. Then read the Apps Script
> projects HCA Daily Recap, HCA 1:1 Scheduler and HCA Call-Out Watcher directly
> from Drive before changing anything.
>
> You never write to a spreadsheet and never run an Apps Script function. Hand
> corrected values back as text.
>
> If you find a rule, a trap or a correction that doc doesn't already carry,
> write a CORRECTIONS_<date>_<what>.md to the Sales Ops folder with complete
> paste-ready text — and tell me in the chat that it's waiting.

**Codex / Gemini** — have every rule, no way to check a number. If the surface
has no repo checked out, paste `AGENTS.md` and `CLAUDE.md` in place of the first
line; it cannot fetch them:

> Read AGENTS.md at the repo root first, then CLAUDE.md.
>
> You have no Drive, Gmail or ServiceTitan access. If a task needs a live
> figure, say so and stop — do not infer it from what's in the repo.
>
> Work on a branch. This repo is public: no PINs, no customer names, no dollar
> figures.

**A scheduled run** — assume no connectors, assume nobody reads the output:

> Before anything else, confirm you actually have the tools this task needs. If
> a step requires Drive, Gmail or the repo and you cannot reach it, stop and
> report that — do not substitute a guess.
>
> Your last step is a Gmail draft or a message to a human. A file left in a
> folder nobody watches is not a delivery.

**Codor (either device)** — several agents in one app, capabilities may differ
between them. This opener carries the never-bend rules inline on purpose: a
phone surface may have no way to fetch anything, and an opener that only says
"go read the rules" leaves it with nothing.

> You are one of several agents in this app and the others may have tools you do
> not. **State at the top of every reply what you could and could not reach** —
> Drive: yes/no, the repo: yes/no. If you are repeating something another agent
> in this app said and you did not verify it yourself, say so and call it
> unverified.
>
> Four rules that do not bend. They hold even if you can reach nothing else:
>
> 1. Never write to a spreadsheet, an Apps Script project, or Firebase. Compute
>    the number, hand it back as text, let a human type it.
> 2. Never run or deploy an Apps Script function.
> 3. The `sales-tools` repo is public. No PINs, no customer names, no addresses,
>    no dollar figures — not in code, not in a commit message.
> 4. Nothing goes outward without a human in the loop. A Gmail draft is the end
>    of your job, not a step in it.
>
> Then try to read "00 AGENT RULES — read first" in the 🧠 Second Brain folder in
> Google Drive, **by title, not by ID**. **If you cannot reach Drive, say so
> plainly and treat the four rules above as the whole of what you have.** Do not
> fill the gap with a plausible reconstruction.

---

## 2. The rules that never bend

These four apply on every surface, in every session, regardless of vendor,
prompt, or how reasonable the exception sounds in the moment.

### 2.1 Never write to a spreadsheet. Ever.

No cell, no tab creation, no formula fix, no "just correcting one number."
This holds even when the fix is obvious, even when the agent is certain, and
even when asked directly in the moment. Hand corrected values back as text for
a human to paste.

The reason is not distrust of arithmetic. These sheets are hand-maintained by
several people at once, a write races their edits invisibly, and a wrong cell
in a source sheet propagates into every report downstream before anyone sees it.

### 2.2 Never run or deploy an Apps Script function.

Not from the editor, not from a trigger, not "just the dry run." Named
functions are the operator's to run: they touch live email, live calendar, and
live Firebase nodes. Propose the call and the expected output; a human runs it.

### 2.3 Never commit a secret, and never edit a generated or frozen file.

- Secrets: anything matching `*.private.*`, the Firebase deploy scaffolding,
  and any literal PIN. The `.gitignore` covers the known ones; a new secret
  gets added there before it is ever written to disk in the repo.
- Generated: `install-availability-secure.html` and
  `database.install-availability.spark.rules.json` are build outputs. Edit the
  source and rebuild.
- Frozen: `*.before-*.html` are deliberate recovery snapshots. Never edit or
  delete one. Creating a new one before a risky change is encouraged.

In Claude Code these are enforced by the `cmh-guard` hook. **On every other
surface there is no hook** — the rule is the only protection.

### 2.4 Nothing goes outward without a human in the loop.

Email is drafted, never sent. Slack messages are drafted, never posted. Nothing
is shared to a customer, an HCA, or a vendor without the operator sending it
themselves. A draft is finished work; sending is a separate human decision.

---

## 3. Where finished work goes

| What you produced | Where it goes | Notes |
|---|---|---|
| Code, tool changes, docs, conventions | **This repo**, on a branch | Never straight to the default branch |
| A new or amended rule | See §4 | Depends on which surface needs it |
| An AR figure, a reconciliation, a finding | Back in the conversation, as text | Plus a dated `.md` in **Sales Ops** if it needs to outlive the session |
| A report or log that a team member will open | **Sales Ops** Drive folder | Google Sheet or Doc; the AR log lives here and is the single source of truth |
| A raw export you were handed | **Daily Uploads** Drive folder | Leave the original untouched; work on a copy |
| A decision or a piece of durable reasoning | **Second Brain** Drive folder | Finished outputs only, and nothing watches the folder — see §6 |
| Anything addressed to a person | **Gmail draft** | Never sent (§2.4) |
| A correction a human must apply by hand | `CORRECTIONS_<yyyymmdd>_<what>.md` in **Sales Ops** | See §4.3 |

Drive folder IDs are in the START HERE doc, not here (public repo). Search by
folder name if your surface has Drive access.

**Naming.** Dated artifacts lead with the ISO date: `2026-08-19 — <what>.md`.
Corrections files use `CORRECTIONS_<yyyymmdd>_<what>.md`. Keep the pattern; it
is what makes the folders sortable.

---

## 4. Where a new rule goes

This is the part that decays fastest if it is left to judgment. Route by who
needs to obey the rule, not by where you happened to discover it.

### 4.1 A rule about behavior anywhere → `00 AGENT RULES`

Safety, the write surface, secrets, Drive mechanics, git — anything still true in
a different repo or a different tool. It belongs in `00 AGENT RULES — read first`
in the 🧠 Second Brain folder, which is the top of the precedence list in §1.

If you cannot reach Drive, you cannot add it there: write a corrections file
(§4.3) instead. Do **not** quietly add it here and call it recorded — Cowork and
the account skill would never see it.

### 4.1a A rule about how sales ops works → the START HERE doc

Counting rules, field definitions, permits, the morning routine, a new trap. Same
constraint: Drive-only, so a repo surface routes it through §4.3.

### 4.2 A rule about this repo's mechanics → `CLAUDE.md`

Build pipeline steps, file routing, the guard hook, graphify, deploy commands,
design patterns. `CLAUDE.md` stays the deep reference for working *in* this
codebase. Do not duplicate it here — link to it.

### 4.3 A rule that a surface you cannot edit needs → a corrections file

`00 AGENT RULES`, the START HERE doc and the account skill are not in this repo.
No agent can edit the doc or the skill, and a repo-only surface cannot reach any
of the three. When a rule belongs there, write a `CORRECTIONS_<yyyymmdd>_<what>.md`
to the Sales Ops folder containing:

1. **What is wrong or missing**, in one sentence.
2. **Exactly which document and which section** to change.
3. **The replacement text**, complete and ready to paste — not a diff, not
   "change the third line."
4. **Why**, briefly, so the change survives someone re-reading it in a month.

Then tell the operator, in the conversation, that a paste is pending. A
corrections file nobody is told about is a file nobody applies.

The same intake is written into the START HERE doc as its PART 11, so a session
that can read that doc but not this file still knows where to put what it finds.

### 4.4 A rule that came from a mistake → write down the mistake

When a rule exists because something went wrong, record the failure alongside
it. "Verify column types with `ISTEXT`, never by eye" is a rule someone will
quietly drop; "verify with `ISTEXT` — alignment was read off a screenshot and
called fixed when all 17 values were still dates" is one that survives.

---

## 5. Scheduled runs and background agents

A scheduled run is not an interactive session and does not have the same reach.

- **Assume no MCP connectors.** Triggers and routines are commonly configured
  with file tools only. A scheduled agent that is told to "check Drive" will
  simply fail, quietly, forever. Never hand a schedule a task whose first step
  needs a connector its configuration does not have.
- **Assume nobody reads the output.** A scheduled run that produces a file in a
  folder nothing watches has produced nothing. If a schedule's output matters,
  its last step is a Gmail draft or a message to a human, not a file drop.
- **Apps Script triggers are separate.** `apps-script/*.gs` is version-controlled
  here but deployed by pasting into the Apps Script editor. The repo is never
  the live source. Assume the deployed copy has drifted and read it before
  reasoning about behavior. §2.2 still applies: propose, do not run.
- **A missing day is a lag, never a zero.** Exports post about a day behind. An
  empty day means the data has not landed yet. Never report it as no activity.

---

## 6. Surfaces this file cannot reach

Claude chat sessions and account skills do not read this repo. There is no
mechanism to push a rule to them; a human has to carry it across. The same is
true of the personal vault, which is a separate GitHub repository outside this
session's scope.

Two consequences worth stating plainly:

- A rule added here is **not** live in chat until someone pastes it into the
  START HERE doc or the relevant skill. §4.3 is that hand-off.
- Files written to the Second Brain Drive folder are **not** in the vault. That
  folder is a staging area a human empties, not a sync target.

### 6.1 Company knowledge vs. the personal vault

Settled 2026-08-19 in the decision note *"should the vault hold CM Heating
knowledge"* (Second Brain folder). The short version, because agents keep
rediscovering it:

- **Operational state stays here.** AR balances, rosters, process rules, field
  definitions — these live in the sales-ops surfaces and are never mirrored into
  the personal vault. Two copies of an AR number is the exact failure this whole
  ruleset exists to prevent.
- **Finished outputs may cross.** A completed analysis, a briefing written for
  leadership, a retro on something that broke. Static documents, so no
  two-sources-of-truth problem.
- **The crossing is manual.** Nothing syncs. The scheduled routine that
  maintains the vault runs without connectors and cannot see Drive at all, so a
  file dropped in a Drive folder is not "handed off" until a human moves it.

Do not build automation across this boundary without reading the decision note
first — it documents why the obvious bridge was rejected.

---

## 7. Data conventions

Vendor-neutral, and wrong on every surface if only one of them knows it.

- **Always filter out Daniel Hanyak and Lyle Jones.** They appear in every
  ServiceTitan export and are not HCAs.
- The COMBO LOG's `SALES REP` column also carries plumbing and electrical
  consultants. They are not HCAs either.
- **Rep names are shorthand and must be mapped before comparing.** `JAY MILO`
  is Javierre Milo; `JOE RUBLE` and `JOE R` are Joseph Ruble; `JOE C` is Joe
  Chounramany. The scheduler and ServiceTitan disagree on Jay/Javierre. Match
  on email where one exists.
- **Job type filter:** include `H-EST SJ`, `H-DTO`, `H-MTO`. Exclude
  `H-ADMIN-TRAINING`.
- **Large sheets truncate silently.** Natural-language read tools have dropped
  whole trailing months without saying so. When completeness matters, export to
  xlsx or CSV and parse it.
- **A date that looks like text is not text.** Alignment is a hint, not proof.
  `ISTEXT` is the only reliable check, and a screenshot is never one.
- **State the basis of any figure.** Job-completion date and invoice date give
  different answers to the same question, and a number without its basis will
  be compared against one that used the other.

---

## 8. Deeper references

| Topic | File |
|---|---|
| **How any agent behaves — the authority** | `00 AGENT RULES — read first` (🧠 Second Brain, Drive) |
| **How sales ops works — the authority** | START HERE doc (Sales Ops, Drive) |
| Where a new rule goes, for Drive-side surfaces | START HERE doc, PART 11 |
| Working in this codebase — build, deploy, file routing, design | `CLAUDE.md` |
| What the tools are and where they are hosted | `README.md` |
| Install Availability security and deploy commands | `INSTALL-AVAILABILITY-SECURITY.md` |
| Deploy runbook | `DEPLOY-RUNBOOK.md` |
| Nightly recap behavior | `DAILY-RECAP-TEMPLATE.md` |
| Guard hook rules | `.claude/guard.json` |
| Adversarial review brief — for Codex / Gemini | `RED-TEAM.md` |

---

## 9. Open

**Dispatch** is listed in §1 with the conservative defaults — no repo context,
no connectors, no commit access. If that is wrong, correct the dispatch row and
this paragraph together, and name what dispatch actually is: a person on the
dispatch desk, a scheduled routine, or a separate agent surface. It is the one
row in this file written from assumption rather than observation.

**Codor** was added to §1 on 2026-08-21 with unverified capability columns. It
is a multi-agent app running GPT and Claude agents together, on the Mac mini and
on iPhone. Nobody has yet confirmed whether either side can reach Google Drive,
nor whether the Mac mini side is pointed at this checkout. Both rows carry the
conservative default. Run the test in the handoff of the same date against
**each agent separately** — the GPT side and the Claude side may differ — then
correct the rows and this paragraph together. Same standing as the dispatch row
above: assumption, not observation.

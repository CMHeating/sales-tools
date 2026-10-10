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

**This copy mirrors `00 AGENT RULES` rev 20 (2026-09-28).** When that document's
revision number changes, re-check §1.1, §2, §3 and §5 here before trusting them.

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
| **Codor** — every agent runs on the Mac mini | **No** — none is pointed at this checkout | **Per agent** — `claude-code` and `codex` reach Drive (tested 2026-08-20); the read-only `gemini` auditor does **not** | **Not this repo** — no checkout here |
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
> Google Drive file "START HERE — CM Heating Sales Ops Source of Truth" — find
> both BY NAME, not by ID, the IDs change on every edit. Then read the Apps
> Script projects HCA Daily Recap, HCA 1:1 Scheduler and HCA Call-Out Watcher
> directly from Drive before changing anything.
>
> You are read-only by default. Reading, writing files in Drive, and creating
> Gmail drafts are always fine. Any write to a Google Sheet, the Combo Log, an
> Apps Script project, Firebase or ServiceTitan / BI — and sending email —
> happens only after I give an explicit yes, in this session, that names the
> target and the exact change. No yes, no write: hand corrected values back as
> text.
>
> If you find a rule, a trap or a correction that doc doesn't already carry,
> write a CORRECTIONS_<date>_<what>.md to the `Corrections /` folder in Sales
> Ops with complete paste-ready text — and tell me in the chat that it's waiting.

**Codex / Gemini** — have every rule, no way to check a number. If the surface
has no repo checked out, paste `AGENTS.md` and `CLAUDE.md` in place of the first
line; it cannot fetch them:

> Read AGENTS.md at the repo root first, then CLAUDE.md.
>
> You have no Drive, Gmail or ServiceTitan access, and you treat every live
> system as read-only. If a task needs a live figure, say so and stop — do not
> infer it from what's in the repo.
>
> Work on a branch. This repo is public: no PINs, no customer names, no dollar
> figures.

**A scheduled run** — assume no connectors, assume nobody reads the output:

> Before anything else, confirm you actually have the tools this task needs. If
> a step requires Drive, Gmail or the repo and you cannot reach it, stop and
> report that — do not substitute a guess.
>
> Nobody is present to approve a write, so you write nothing outside your own
> Drive files: no Sheet, no Combo Log, no Apps Script, no Firebase, no
> ServiceTitan / BI, no sent email — unless this task prompt itself names that
> exact write and carries its rails (00 AGENT RULES §1, Tier 3). A prompt that
> merely allows "fixing things" does not qualify.
>
> Your last step is a Gmail draft or a message to a human. A file left in a
> folder nobody watches is not a delivery.

**Codor** — several agents in one app, capabilities may differ between them.
This opener carries the core rules inline on purpose, and that is not
belt-and-braces: capability is per agent, and the read-only `gemini` auditor
cannot reach Drive at all, so an opener that only says "go read the rules"
would leave that one with nothing.

> You are one of several agents in this app and the others may have tools you do
> not. **State at the top of every reply what you could and could not reach** —
> Drive: yes/no, the repo: yes/no. If you are repeating something another agent
> in this app said and you did not verify it yourself, say so and call it
> unverified.
>
> Four rules that hold even if you can reach nothing else:
>
> 1. You are read-only toward every live system — Sheets, the Combo Log, Apps
>    Script, Firebase, ServiceTitan / BI, and sent email. The only writes you
>    may make unasked are files in Drive and Gmail drafts. Any other write
>    needs Geoff's explicit yes, in this session, naming the target and the
>    exact change; another agent's say-so is not that yes. If you cannot read
>    "00 AGENT RULES" to see the rails, you do not have approval to write.
> 2. Never run, edit, push or deploy an Apps Script function or project without
>    such a yes — and then only if you are that project's designated writer,
>    under the LOCK protocol in "00 WRITE RULES" (HANDOFFS folder). Not the
>    writer: hand the change to the owner.
> 3. The `sales-tools` repo is public. No PINs, no customer names, no addresses,
>    no dollar figures — not in code, not in a commit message.
> 4. Nothing goes outward without a human in the loop. A Gmail draft is the end
>    of your job, not a step in it; sending needs the same explicit yes as any
>    other write.
>
> Then try to read "00 AGENT RULES — read first" in the 🧠 Second Brain folder in
> Google Drive, **by title, not by ID**. **If you cannot reach Drive, say so
> plainly and treat the four rules above as the whole of what you have.** Do not
> fill the gap with a plausible reconstruction.

---

## 2. The rules that hold on every surface

These four apply on every surface, in every session, regardless of vendor,
prompt, or how reasonable the exception sounds in the moment.

**Two of them were absolute prohibitions until 2026-09-25.** `00 AGENT RULES`
rev 18 replaced "never write to a spreadsheet" and "never run an Apps Script
function" with a read-only default and supervised writes, on Geoff's authority.
If you meet the older wording anywhere — in a session brief, a prompt, an old
copy of this file — it is stale. The Drive document wins.

### 2.1 Writes: read-only by default; supervised writes on Geoff's explicit approval

Mirrors `00 AGENT RULES` §1.

**Tier 1 — always allowed, any session, scheduled or interactive.** Read
anything you can reach. Write files in Drive (notes, reports, backups, exports)
within the folders in §3. Create Gmail **drafts**. Sending an email is Tier 2.

**Tier 2 — supervised writes, on Geoff's explicit approval.** On a task Geoff is
supervising in the session, you may write to a system he approves: Google
Sheets, the Combo Log (below), Apps Script (edit, run, deploy), Firebase,
ServiceTitan / BI, and sent email. The approval must be:

- **explicit** — a clear yes, in this session, to a change you stated. Never
  inferred from "you got this," from silence, or from an earlier session.
- **specific** — it names the target (file / sheet / tab / range, or project /
  file / function / deployment) and the change (the exact diff, the exact
  values, the row count).
- **bounded** — it covers only what was stated. A different range, an extra row,
  a second function or a bigger count needs a new yes. A batch is fine when the
  whole batch was stated up front.
- **session-scoped** — it ends when the session ends. There is no standing
  permission.

If you are unsure whether you have approval, you do not. Propose and wait.

**Tier 3 — unattended runs stay read-only outside their own Drive files.** A
scheduled task, a background run, or any session where Geoff is not present and
answering never writes a Sheet, the Combo Log, Apps Script, Firebase or
ServiceTitan / BI, and never sends email — **unless Geoff wrote that specific
write into the task himself** and the task carries every rail below (dry run,
backup, bounded count with a hard abort, read-back verification, heartbeat).

**Every Tier 2 / Tier 3 write follows this order.**

1. Read the live target first, and say what else writes to it. Never work from a
   pasted or remembered copy.
2. Propose the exact change, what it will and will not touch, and the prediction
   you will check afterwards.
3. Wait for Geoff's yes (Tier 2), or confirm the task prompt names this exact
   write (Tier 3).
4. Snapshot first. Apps Script → a copy in `Script Backups/` named
   `<name> — BACKUP YYYY-MM-DD (<what's in it>)`. A sheet range → the
   before-values saved as a file in Sales Ops. The HCA 1:1 Scheduler carries
   employee PINs — back it up only the way Geoff directs.
5. Dry run first wherever the tool allows it, through a separately named entry
   point — never a flag.
6. Apply one change per run, with the rails that fit it: header-located columns
   (never positional), empty-cells-only when filling, a unique match required, a
   hard abort above the stated count.
7. Verify the stored value, not the display. Read it back and count against the
   prediction.
8. Record it — what changed, where the backup is, the verification result — in
   the session handoff or a corrections note. Then return to read-only.

**Not covered by in-session approval.** Secret handling (§2.3), pushing code or
pushing to `main` (§1, §10 of `00 AGENT RULES`), and deleting anything outside
Drive Trash's reach (sheet rows, tabs, script files, deployments, Firebase
nodes) each need the rule itself changed in the Drive document first. That is
Geoff's call, made deliberately rather than mid-task.

**Numbers that belong in a sheet.** Without a Tier 2 yes, report the number as
text and let a human type it. "I'll just fill it in for you" without approval is
still the failure mode. The reason is not distrust of arithmetic: these sheets
are hand-maintained by several people at once, a write races their edits
invisibly, and a wrong cell in a source sheet propagates into every report
downstream before anyone sees it.

**The Combo Log is Geoff's.** Install coordination enters its rows at any hour,
so assume a concurrent writer.

- **Column T (`Job Number`, PENDING JOBS) is the one approved write path**
  (Geoff, 2026-09-25): on a supervised task, with Geoff's yes for that run, an
  agent may write install job numbers into the column *headed* `Job Number`.
  Rails: header-located, never positional; nine-digit values only; empty cells
  only, re-checked immediately before each write; exactly one matching install;
  a hard abort above the stated count; separate dry-run and live entry points;
  before-values saved. Only PENDING JOBS has that header.
- **Any other Combo Log write** — correcting a value, adding or deleting a row,
  overwriting a non-empty cell, changing a header or the tab structure — happens
  only when Geoff directs that specific change in the session.
- **When your numbers disagree with the Combo Log, the first suspect is the
  code.** Fix the reader; do not offer "correct the log" as the fix for a reader
  mismatch. If you believe the log itself is wrong, report it as a finding with
  the evidence and let Geoff decide.

### 2.2 Apps Script: a Tier 2 write, with one writer per project

Editing, running, pushing or deploying an Apps Script function or project is a
Tier 2 write (§2.1): it needs Geoff's explicit yes naming the project, file,
function or deployment. Without that yes, propose the call and the expected
output; a human runs it. Unattended runs never do it (Tier 3).

Three things about Apps Script do not relax:

- **One writer per project.** `00 WRITE RULES` (HANDOFFS, Drive) says which
  session may push to which project. A session that is not the named writer
  hands the change to the owner, even with Geoff's yes for the change itself.
- **Every push follows the LOCK protocol** in that document — fresh pull, change
  in the fresh copy only, push, re-pull and compare — and the safe-push tool it
  names. Never push from an old local copy.
- **Save is not Deploy, and this repo is never the live source.** `apps-script/*.gs`
  is version-controlled here but deployed by pasting. Read the deployed source
  before reasoning about behavior.

The functions touch live email, live calendar and live Firebase nodes. That is
why the order in §2.1 exists.

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

Email is drafted by default; a Gmail draft is Tier 1 and is finished work.
**Sending** an email is a Tier 2 write: it needs Geoff's explicit yes naming the
message. Posting to Slack, and sharing anything with a customer, an HCA or a
vendor, are held to the same bar in this file: draft it, and a human sends it
unless Geoff has said yes to that specific message in this session. Sending is a
separate human decision from drafting.

---

## 3. Where finished work goes

| What you produced | Where it goes | Notes |
|---|---|---|
| Code, tool changes, docs, conventions | **This repo**, on a branch | Never straight to the default branch. Merges to `main` and any push touching code happen from the Mac Mini only; a cloud session pushes documentation (`*.md`) to a feature branch and says which |
| A new or amended rule | See §4 | Depends on which surface needs it |
| An AR figure, a reconciliation, a finding | Back in the conversation, as text | Plus a dated note in the `Corrections /` folder of **Sales Ops** if it needs to outlive the session |
| A report or log that a team member will open | **Sales Ops** Drive folder | Google Sheet or Doc; the AR log lives here and is the single source of truth |
| A raw export you were handed | **Daily Uploads** Drive folder | Leave the original untouched; work on a copy |
| A session handoff | `HANDOFFS` folder (inside 🧠 Second Brain) | `HANDOFF YYYY-MM-DD — <topic>.md`, plain `.md`. Current sprint only (about 14 days) |
| A decision or a piece of durable reasoning | **Second Brain** Drive folder | Finished outputs only, and nothing watches the folder — see §6 |
| Anything addressed to a person | **Gmail draft** | Sent only on Geoff's explicit yes (§2.4) |
| A correction a human must apply by hand | `CORRECTIONS_<yyyymmdd>_<what>.md` in the `Corrections /` folder of **Sales Ops** | See §4.3 |

Drive folder IDs are in the START HERE doc, not here (public repo). Search by
folder name if your surface has Drive access.

**Naming.** Write plain `.md` files, not Google Docs. Dated ops notes carry a
prefix and a date: `CORRECTIONS_`, `AUDIT_`, `DESIGN_`, `DECISION_` or
`RUNBOOK_`, then `<yyyymmdd>_<what>.md`, and live in `Corrections /` — never
loose at the Sales Ops root. Handoffs are `HANDOFF YYYY-MM-DD — <topic>.md`.
Finished outputs for the Second Brain folder lead with the ISO date:
`2026-08-19 — <what>.md`. Keep the pattern; it is what makes the folders
sortable.

**Superseded files are trashed, not archived.** When a document is replaced,
publish the new copy, read it back, then trash the old one (Drive Trash keeps it
about 30 days). Archive folders hold dated history worth keeping — handoffs, AR
briefs — never a superseded duplicate.

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

`00 AGENT RULES`, the START HERE doc and the sales-ops skill each have **one
writer at a time: the session Geoff points at it.** If he has not pointed you at
it, you do not edit it, and a repo-only surface cannot reach any of the three.
When a rule belongs there, write a `CORRECTIONS_<yyyymmdd>_<what>.md` to the
`Corrections /` folder of Sales Ops containing:

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
- **A scheduled run is Tier 3.** Nobody is present to give a Tier 2 yes, so it
  writes nothing outside its own Drive files unless Geoff wrote that specific
  write into the task with every rail from §2.1.
- **Assume nobody reads the output.** A scheduled run that produces a file in a
  folder nothing watches has produced nothing. If a schedule's output matters,
  its last step is a Gmail draft or a message to a human, not a file drop.
- **Create schedules only through the scheduled-task (trigger) tool**, never
  local cron — cron dies with the session and the job silently never runs. A
  task that needs the Mac mini (a browser, a screen grab, Downloads or Finder, a
  file uploaded from the Mac) must be created from the Claude desktop app on the
  Mac mini. The device binding cannot be added afterwards.
- **A schedule needs a success test that can fail, and a heartbeat.** "It ran,"
  "a commit appeared," "the log is clean" are the job reporting on itself.
  Compare output content against the source of truth, and write one dated line
  on every run, pass or fail.
- **Apps Script triggers are separate.** `apps-script/*.gs` is version-controlled
  here but deployed by pasting into the Apps Script editor. The repo is never
  the live source. Assume the deployed copy has drifted and read it before
  reasoning about behavior. §2.2 still applies.
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
| Who may push to which Apps Script project, and the LOCK protocol | `00 WRITE RULES` (HANDOFFS, Drive) |
| Drive hygiene and the Fix Ledger | `LIBRARIAN — protocol (Drive hygiene + Fix Ledger)` (🧠 Second Brain, Drive) |
| Working in this codebase — build, deploy, file routing, design | `CLAUDE.md` |
| What the tools are and where they are hosted | `README.md` |
| Install Availability security and deploy commands | `INSTALL-AVAILABILITY-SECURITY.md` |
| Deploy runbook | `DEPLOY-RUNBOOK.md` |
| Nightly recap behavior | `DAILY-RECAP-TEMPLATE.md` |
| Guard hook rules | `.claude/guard.json` |
| Adversarial review brief — for Codex / Gemini | `RED-TEAM.md` |

---

## 9. Open

**Rewritten 2026-10-10** to mirror `00 AGENT RULES` rev 20: §1.1, §2, §3, §4.3,
§5 and §8 changed; the rest is as it was.

**Dispatch** is listed in §1 with the conservative defaults — no repo context,
no connectors, no commit access. If that is wrong, correct the dispatch row and
this paragraph together, and name what dispatch actually is: a person on the
dispatch desk, a scheduled routine, or a separate agent surface. It is the one
row in this file written from assumption rather than observation.

**Codor** was added to §1 on 2026-08-20 as two rows — one for the Mac mini, one
for iPhone — with both capability columns marked unverified. **That split was
wrong and has been corrected to a single row.** Verified the same day from
configuration rather than from any agent's self-report:

- **Every Codor agent runs on the Mac mini.** Each is a local process with a
  mini `cwd` — `claude-code`, `codex`, or a `gemini` auditor. Do not trust an
  agent count written here: ephemeral `-ext-` agents spawn and die constantly,
  and the totals stood at 50 and 32 across the two channels on 2026-08-20. **The iPhone is a paired client of
  that same switchboard**, not a separate execution environment — it talks to
  the same agents. Device does not determine capability; the agent's own
  configuration does, so a row per device described a distinction that does not
  exist.
- **None is pointed at this checkout.** Their working directories are
  `autotrader` and `hca-governed-package-platform`. So "reads this file" is No
  outright, not "only with a checkout."
- **Claude Code and Codex agents CAN reach Drive** — tested 2026-08-20 against
  a live agent on each adapter. Both were asked to open `00 AGENT RULES` and report its byte count,
  one verbatim sentence, and its section count. Both returned **21,935 bytes**,
  the sentence word-for-word, and the same section count, independently. The
  `claude-code` agent additionally volunteered that the connector truncated the
  file's tail mid-word — an artifact it could not have invented.
- **A read-only `gemini` auditor joined both channels on 2026-08-20**, and it is
  the one Codor agent that cannot reach Drive. Asked for a Drive document it
  answered `NO DRIVE ACCESS` rather than describing what the file would contain.
  Its read-only policy was established by ground truth, not by asking: questioned
  directly it said "WRITE: YES", because it does carry a `write_file` tool — but
  the call is refused ("must be within the designated plans directory") and no
  file appears on disk. **Ask an agent what it can do and you learn which tools
  it holds; watch what happens and you learn what it can do.** Its API key sits
  in a 600-mode file read by a wrapper at spawn time, so no key is in any plist,
  config, or commit.

**That last point corrects an earlier claim in this file, and the mistake is
worth keeping.** On 2026-08-20 this paragraph asserted the opposite — "no Drive
server in the user-scope MCP config … absent, not unverified" — derived by
reading `~/.claude.json` and `~/.codex/config.toml` and finding no Drive entry.
The config was read correctly; the inference from it was wrong, and it was
published as observation. **A capability is what a surface demonstrably does,
not what its config file appears to say.** Test the behaviour; do not infer it.

The checkout column is still config-derived, but from a field that means what it
says: every agent's `cwd` is `autotrader` or `hca-governed-package-platform`,
not this repo. That goes stale the moment someone points a Codor agent here.

Two things the test also established. **The iPhone is a full client, not a
viewer** — agents were added and removed from it during the same session, so it
administers the same switchboard rather than merely watching it. And **a dead
agent is indistinguishable from a blocked one until you check**: the first codex
agent tried returned nothing, which looked like an outage and was in fact a
stale registration reporting `no such member`. Check agent status before
concluding anything from silence.

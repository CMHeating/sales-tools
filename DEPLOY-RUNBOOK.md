# Deploy Runbook — Daily Recap & Sold Job Tracker

Written 2026-07-31. Follow top to bottom; the order matters in a few places and
those are called out.

Two **separate** Apps Script projects. Both define `doGet`. Pasting one over the
other breaks whichever it replaced — this has already happened once. Before any
paste, read the code on screen and confirm which project you are in:

| Project | Confirm you see | Never paste |
|---|---|---|
| **HCA Daily Recap** (`0730daily-recaps.gs`) | `DAILY_RECAP_CONFIG`, `RECAP_ROSTER` | the sold tracker |
| **Sold Job Tracker Sync** | `SOLD_TRACKER_CONFIG`, `syncSoldJobTracker` | the recap |
| **1:1 Scheduler** | calendar/booking code | either of the above |

The live 1:1 Scheduler has diverged from the copy in this repo (1,200+ lines
live vs 556 committed). **Do not restore it from git** — that would delete
working code. Leave it alone.

Source for every paste: GitHub → the file → **Raw** → `Ctrl+A`, `Ctrl+C`.
Check the branch selector reads `claude/cm-heating-sales-handoff-bgczid`.

---

## Part A — HCA Daily Recap

Do this first. Until step A2, the 6pm send contacts nobody.

### A1. Paste

`apps-script/daily-recap.gs` → `Ctrl+A`, `Ctrl+V`, `Ctrl+S`.

Everything a person edits is in one **SETTINGS YOU EDIT** block at the top —
paused HCA, the growth sheet, the BI export, the audit window. Nothing below
it needs touching to run day to day.

This discards the one-off `fileLateRepliesNow` and `fixKylesCount` functions.
That is correct — their work is already done and the fixed
`markComplianceLate_` handles that case permanently.

No authorization prompt should appear. If Google asks you to authorize, you are
in the wrong project.

### A2. Go live — do not skip

```
Run → goLive
Run → showRecapMode
```

Must read: `LIVE — from Script Properties (survives a paste)`.

`TEST_MODE` in the file ships as `true` so a new project is safe by default.
`goLive` stores the real setting outside the file, so future pastes cannot
revert it. Skipping this is what caused Friday's send to reach nobody.

### A3. Pause Trevor

In the **SETTINGS YOU EDIT** block at the top of the file:

```javascript
const PAUSE_HCA_NAME = "Trevor Bohm";
const PAUSE_HCA_REASON = "Off for a week or so";
```

```
Ctrl+S
Run → pauseHcaNow
Run → showPausedHcas
```

Must read: `PAUSED: Trevor Bohm — Off for a week or so`.

To bring him back: same two constants, `Run → resumeHcaNow`.

### A4. Build the Today tab

```
Run → installLiveTabs
```

Adds a **Today** tab to the recap log: today and yesterday's appointments, who
has answered, who still owes one, who came in late. All formulas — it updates
itself, nothing needs to run. Leave it open on a second monitor.

### A5. Install triggers

```
Run → installDailyRecapTriggers
```

The log **must** contain `reply sweep hourly`. If it says only
`job status 9:00 and 22:00`, the paste did not take — go back to A1.

Installs: **send 06:00**, collect 20:15, **reply sweep hourly**,
**sales brief 06:00**, job status 09:00 and 22:00.

The recap goes out at 6am, before the first appointment, and asks for one block
per appointment *as they finish it* rather than a reconstruction of the whole
day at 8pm. Partial replies cost nothing — rows are keyed on date + HCA +
customer, so three messages across a day merge into one clean set.

The old standalone 07:00/08:00 nudge is off (`nudgeEnabled: false`). Anyone who
never filed yesterday gets that chase folded into the top of their 6am email,
pointing them back at the original thread — **not** a second blank template,
because a reply here would carry today's subject and file yesterday's
appointments against today. `sendMorningNudgeWorkingToday` still works if you
want to fire a chase by hand.

The sales brief emails yesterday's sales split into closed-on-the-day,
from-an-earlier-lead, and **unknown** — the last being sales by a rep who filed
no recap, where there is no way to tell. It never folds unknown into either of
the other two. `previewMorningSalesBrief` prints it without sending.

It runs at **06:00**, to be in the inbox before the 07:45 with Lyle and Aaron.
It shares that hour with the send on purpose: the two need nothing from each
other — the brief reports yesterday, the send asks about today — and they go to
different people, so the order they fire in does not matter.

Nothing reads sold alerts on an hourly schedule, and nothing needs to. Every
function that reads them reads Gmail **live**, so a sale marked at 10am is in
the next run of `previewSoldReport`, `growthSheetDay` or the brief with no
refresh step. The only thing a 06:00 brief can miss is a recap filed
overnight.

The brief can only see consults that were reported. When someone has not
reported it says so, names them, and points at the ServiceTitan dispatch board —
which is the only place that shows what was actually run, and is not readable
from email.

### A6. Catch up on late replies

```
Run → sweepRecapReplies
```

Files any reply that arrived after its night's collection, against the night it
answers. Sends nothing. Safe to run repeatedly — writes are keyed on
date + HCA + customer.

A `CHECK THE DATE` line in the log means a reply looks like it went to the wrong
recap — it answers an older night but arrived after a newer recap had already
gone out, so a fresher email was sitting there unanswered. Adam's Taylor Pearson
row is the case this was built from: run Friday afternoon, reported 9:45pm
Friday, on Thursday's thread. **Nothing is moved.** The row files as the subject
says and the flag asks a human to look, because a genuine late reply reads
identically. Same list appears in the nightly digest under
`CHECK THE DATE ON THESE`. To act on one, edit the Recap Log row's Date and Key
by hand.

### A6b. Point Job Status at the BI leads export — optional

Drop the Power BI **All Leads** export in Drive. Either a Google Sheet or the
raw `.xlsx` works — an `.xlsx` is converted automatically on the way in and the
temporary copy is binned afterwards, so there is nothing to remember each
morning.

The id is the middle of the Drive URL:

```
drive.google.com/file/d/16L_ii7sc5Vf369RXzvfca9WuvG92WbEb/view
                        └──────────── this part ────────┘
```

Already filled in with the July export. Swap the id when a newer one lands.
In the **SETTINGS YOU EDIT** block at the top of the file (~line 73):

```javascript
const BI_LEADS_SHEET_ID = "";   // ← the Sheet's id
const BI_LEADS_TAB = "";        // blank = first tab
```

Leave it blank and Job Status behaves exactly as before.

The first run will ask Google to re-authorize — converting an `.xlsx` needs
Drive access the script has not used before. Approve it once.

What it adds is the **HCA column on UNCLAIMED rows**. A ServiceTitan Booked Job
Alert names no advisor — assignment happens after the alert fires — so those
rows have always said a consult went unreported without saying by whom. BI's
`TechName` fills it, and the status line becomes
`UNCLAIMED — Jay Milo ran it, no recap`.

It also reads `jobStatus`, so an appointment cancelled in ServiceTitan is
labelled as cancelled rather than left on the list as somebody's missed recap.

Three columns are appended to the right of Key — BI Rep, BI Lead Type, BI Job
Status. Appended, not inserted, so nothing that relies on existing column
positions moves.

### A6c. Fill the CM Growth Daily Sales sheet

```
Run → previewGrowthSheetWrite     ← shows what it would do, writes nothing
Run → writeGrowthSheetDay         ← commits
```

One run fills two columns on one tab: **yesterday's day column** and the **MTD
column** beside it.

Which tab is worked out from the date, and a tab is named for the day it
**covers**, not the morning you open it. So Monday morning it writes Weekend;
Tuesday morning it writes Monday. Saturday and Sunday both live on Weekend.

Day-column headers can read either way — `Sat` and `Sun` on the Weekend tab,
`Monday` through `Friday` spelled out on the others. Both are matched. If a tab
has no column for its day the run refuses and names what it looked for; add the
header and run it again.

**MTD is recomputed from the recap log and the sold alerts, not summed off the
six tabs.** The tabs are overwritten every week, so a sum of them would reset
the month every Monday. It also means a typo in a daily cell stays a typo in
that cell instead of propagating into the figure that goes to Paul.

Two different write rules, on purpose:

| Column | If it already has a value | If it holds a formula |
|---|---|---|
| the day | refused, unless `GROWTH_SHEET_OVERWRITE = true` | left alone |
| MTD | replaced — a running total is meant to be | left alone |

Leaving MTD formulas alone is now the right answer rather than a compromise.
The L2C and AVG Ticket cells in that column divide one MTD cell by another, so
once the counts and revenue underneath are written they recompute to the month
figure themselves. A formula pointing at the *day* columns instead will keep
showing the week — see the audit below, which finds those.

```
Run → auditGrowthSheet
```

Read-only. Prints every tab cell by cell **with the formulas showing**, and
flags three things you cannot see by looking at the sheet:

- **MTD formulas that read the day columns.** On screen these are identical to
  a correct one — until the second week of the month, when one is a week behind
  and the other is not. It prints the formula and which columns it reads.
- **Leftover data in a day column the tab does not cover** — the `Sat` column
  copied onto the weekday tabs. *Hiding a column does not clear it.* The values
  are still there and any formula pointing at them still reads them, so hiding
  turns a visibly wrong number into an invisibly wrong one. Hidden columns are
  printed like any other, marked `[HIDDEN]`.
- **Tabs the writer would refuse** — no FM Budget anchor, or no column for the
  tab's own day.

It ends with a TO FIX list. An empty one means every tab is sound.

MTD is written to the same tab as the day column, covering the 1st of the month
through that day — so each tab's MTD is correct for the morning you open it.

To redo an old day, set `GROWTH_SHEET_DATE = "2026-08-01"` — but note this
rewinds MTD to what it was on that date too. Put it back to blank afterwards.

`growthSheetMonthToDate` prints the month with a by-day breakdown and writes
nothing. `writeGrowthSheetMtd` writes only the MTD column, for when the day
column is already right.

NPS is never written. It comes from a survey this script cannot see, and a zero
there would read as a real score.

**HVAC Rev is pre-tax.** The sheet's own FM Budget row includes tax, so the two
are not comparable until BI supplies a tax-inclusive number.

### A7. Check tomorrow before it happens

```
Run → previewDailyRecap
```

Sends nothing. Confirm the roster is who you expect and that Trevor shows under
Skipped as `Paused`.

---

## Part B — Sold Job Tracker Sync

Different project. Nothing here is urgent.

### B1. Paste

`apps-script/sold-job-tracker-sync.gs` → `Ctrl+A`, `Ctrl+V`, `Ctrl+S`.

### B2. See what is scheduled — changes nothing

```
Run → showSoldTrackerTriggers
```

Expect `Triggers installed: syncSoldJobTracker`.

Hourly is the cadence this is built around — the email-update budget spends 40
searches a run and relies on the next run continuing where it stopped.

All three installers — `setupSoldTrackerHourlyTrigger`,
`setupSoldTrackerDailyTrigger` and the private `setupSoldTrackerHourlyTrigger_`
that exists in the deployed project — install **hourly**. The "daily" name is
historical and kept only because it is the one in muscle memory; making it
actually mean daily would turn the familiar button into the one that quietly
cuts the sync to a twenty-fourth of its cadence. There is no wrong one to
press.

Each replaces the existing trigger rather than adding to it, so running one
twice cannot leave you syncing twice an hour.

### B3. Preview one customer

Near the top:

```javascript
const PREVIEW_DEAL_CUSTOMER = "Jessiah Johnson";
```

```
Run → previewDealNotesForCustomer
```

Prints the COMBO LOG coordination notes and email updates for that one
customer. Writes nothing. `comboRowsMatched: 0` means they genuinely are not on
the log; empty `emailUpdates` means no non-alert email mentions them in 90 days.
Neither is an error.

### B4. Full sync

```
Run → syncSoldJobTracker
```

Takes 1–3 minutes. In the summary look for:

```
"coordinationNotes": <hundreds>,
"emailUpdates": { "searched": 40, "deferred": <many>, "outOfTime": false }
```

A large `deferred` on the **first** run is correct — the cache is empty, so it
spends its 40-search budget and leaves the rest for the next hourly run.
Coordination notes are complete immediately; they come off the sheet with no
budget.

If `"outOfTime": true`, the searches are slower than sized for — say so and the
budget gets lowered.

---

## Part C — Web pages

### C1. Sold tracker page

`sold-job-tracker.html` → paste into GitHub → commit.

Adds the **Notes & updates** section, and a `COMBO LOG spelling` chip that shows
when a job was matched by fuzzy name rather than exactly — so a spelling-driven
match can be checked rather than trusted.

Committing to the branch does **not** publish it. GitHub Pages serves `main`.
Either paste into the file on `main`, or merge the branch.

### C2. Recap web app — needed by the 1:1 page

In the **HCA Daily Recap** project:

```
Deploy → New deployment → type: Web app
  Execute as:      Me
  Who has access:  Anyone
→ Deploy → copy the /exec URL
```

Then in `hca-1on1.html` line ~165:

```javascript
const RECAP_API_URL = "";   // ← paste the /exec URL between the quotes
```

Until this is filled in, the 1:1 page cannot read any recap data.

The **same** `/exec` URL goes into `sold-report.html`, near the top of its
`<script>` block:

```javascript
const RECAP_API_URL = "";   // ← the same /exec URL
const RECAP_API_KEY = "";   // ← only if you set a recapApiKey Script Property
```

That page shows the sold split — closed same day, from an earlier lead, and
unknown — month to date, by HCA and by day. It reads
`?report=sold&from=…&to=…` off the same deployment; no second deploy.
`Run → previewSoldReport` prints the same numbers to the Apps Script log, so
the figures can be checked before the page is wired up at all.

A deployment serves a **pinned version**. Editing the code afterwards does not
change what the deployment serves — you must redeploy. That is also why editing
the script cannot break a live endpoint by accident.

Note the exception to the repo's usual `{ mode: 'no-cors' }` rule: that applies
to fire-and-forget calls where the answer is not read. This one reads JSON back,
so it must be a normal `fetch` — `no-cors` would make the response unreadable.
`Who has access: Anyone` is what makes that work; set to "Anyone with Google
account" the page gets a login redirect instead of data.

---

## Verify it is actually working

Next morning, in order of what each proves:

1. **Recap log → Today tab** — yesterday's appointments listed, and anyone who
   answered late showing under *Answered late*. Proves the sweep is running.
2. **Reply Compliance** — no row still saying `No` for someone who has visibly
   replied in Gmail. Proves attribution by night is working.
3. **Sold tracker page** — cards carry a *Notes & updates* section, and
   "Last sync" is within the hour. Proves Part B.
4. **Job Status tab** — rebuilt after a late reply, not only at 09:00/22:00.

## If something looks wrong

- `previewDailyRecap` — tonight's roster and the exact email each person would
  get. **Use this, never `sendDailyRecap`, to check a change.** `sendDailyRecap`
  sends the moment it is called and cannot be taken back: Gmail has no recall
  and Apps Script bypasses Undo Send. A second call on a day that already sent
  is now refused, but the first one is on you.
- `showRecapMode` — live or test, and where that came from
- `showPausedHcas` — who is off the send
- `showSoldTrackerTriggers` — what is actually scheduled
- `previewDealNotesForCustomer` — one customer's notes, writes nothing

All five are read-only. None of them send, write, or change a schedule.

## Known gaps

- The Job Status tab has no tech-lead column, so a tech flip carries the fact
  but not the technician's name.
- Nothing yet distinguishes "ran nothing and said so" from "replied without
  reporting". Both show as 0 appointments. Amber and Trevor are the first kind;
  it has not yet caused a wrong decision.

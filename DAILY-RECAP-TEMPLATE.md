# Daily Recap Template

Canonical source for the nightly HCA recap. Keep this file in sync with the
Cowork scheduled task — if the two ever disagree, the task wins and this file
should be corrected to match.

## Send (6:00pm Pacific, daily)

Goes to each HCA scheduled to work that day. Check the Schedule Exceptions
sheet first for Sick / Vacation / Swap overrides before building the list.

Schedule Exceptions sheet:
`https://docs.google.com/spreadsheets/d/1RIUfCH7ZXHfXiX1jjvCHuQp9pDWqpZB-IExpUBvGFzM/edit`
Columns: Date, HCA Name, Type (Sick/Vacation/Swap), Notes

### Body

```
Customer:
Source (Web / Inbound / Tech Flip / Revisit):
Outcome (Sold / Estimate / Follow-up):
Offered (package + price):
Water heater (Y/N + interest):
Next follow-up:
Objection (if not sold):

Ran more than one? Paste the block again below it.

Follow-ups on older leads today (who + what happened):
```

Shaped by the first live night, when five reps produced five different
formats. Every rule here answers something that actually went wrong:

- **Labels are short.** The previous objection prompt ran 73 characters,
  wrapped on every phone, and one rep retyped it without its trailing colon —
  losing the prompt and the best answer of the night. Every label now fits one
  phone line.
- **Options live inside the parentheses, before the colon.** Everything after
  the colon is the answer, so options placed there get captured as part of
  whatever the rep types next.
- **Plain hyphens, no em dashes.** They survive every client's HTML-to-text
  conversion unchanged.
- **A stated `None` path.** A rep with no appointments abandoned the template
  and wrote prose. `None` plus the follow-ups line is now an explicit answer.
- **No placeholder blocks.** A rep pasted a two-block template, filled one, and
  left `[CUSTOMER NAME 2]` behind, which logged as a real appointment.

The collector still accepts the older long labels, so replies written in the
previous format keep parsing.

### Accepted values

| Field | Asked for | Also accepted |
|---|---|---|
| Lead Source | `Web`, `Inbound`, `Tech Flip`, `Revisit` | `W`, `I`, `TF`, `R` |
| Outcome | `Sold`, `Estimate`, `Follow-up needed` | `S`, `E`, `F` |

The email asks for the full words. The collector still accepts the older
single-letter codes, because reps who learned `W/I/TF/R` and `S/E/F` will keep
typing them and those replies should not be dropped. Matching is
case-insensitive and tolerant of surrounding text, so "web lead" and
"sold - signed tonight" both resolve.

There is deliberately no "Not Valid" outcome. The objection/holdback question
replaced it.

The deal line is free text on purpose — reps write a tier and a price the way
they naturally would ("BETTER HP $18,500", "BEST DF $249/mo"). The collector
keeps the raw text and additionally parses out a figure when one is present, so
nothing is lost when a rep writes it a way the parser does not expect.

## Morning follow-up (7:00am / 8:00am Pacific, daily)

One pass over the previous day's recap, doing two things from a single Gmail
read so the two halves can never disagree about who replied:

| | |
|---|---|
| replied | a short acknowledgement, so reporting visibly lands |
| no reply | one nudge |

Acknowledging matters more than it looks. A rep who reports into silence stops
reporting, and that costs a whole night's data rather than one field of it.

Timing follows whether the rep is on shift the morning it arrives:

| Run | Goes to |
|---|---|
| 7:00am | reps **working today** — thanked or nudged |
| 8:00am | reps **off today** — thanked or nudged |

A 7am admin request on someone's day off sets the wrong tone in a process
people are still forming a habit around, so the day-off group gets the extra
hour. The groups are disjoint; nobody appears in both.

Both messages thread onto the original conversation (`Re: Daily Recap — <that
day>`), so any reply is still attributed to the night it answers.

The acknowledgement is built from what the rep actually reported, not from a
fixed phrase. It counts the appointments, congratulates a close by name, flags
an open deal that has no next step on it, notes backlog work, and offers help
while anything is still open — at most two observations, so it stays short.

Wording rotates. Identical text every morning stops being an acknowledgement
and becomes wallpaper. The variant is a hash of rep + date + slot, so it
changes day to day and rep to rep while a rerun of the same day reproduces
exactly what was sent — which random selection would not.

What it never does is comment on the merits of a deal. Naming a customer back
is proof someone read it; an opinion about that customer in the manager's voice
is his to give, not the script's.

Whether a rep replied is decided at thread level, not from the subject of their
own message. Some clients rewrite the subject on a reply, and requiring it to
carry the date would mark a rep who reported as outstanding and chase them.

If the Gmail read fails, nothing is sent at all. Chasing someone who replied
and thanking someone who did not are both worse than silence.

Set `nudgeEnabled: false` to switch the whole morning pass off.

## Collect (8:15pm Pacific, daily)

Search Gmail for replies to that evening's recap emails. Compile a digest
grouped by HCA, tagged `[SOLD]` / `[ESTIMATE]` / `[FOLLOW-UP NEEDED]`, including
lead source and the objection/holdback for anything not sold. Flag any HCA who
was scheduled to work and did not reply.

### Recovering a missed day

The nightly collect only counts replies whose thread carries **that** day's
date, and Gmail is only searched two days back. A night nobody collected is
therefore not merely uncollected — it becomes unreachable once it falls out of
that window.

```
backfillRecapForDate("2026-07-30")
backfillYesterday()
```

Both run the full collection against a past day: replies parsed, rows written,
compliance recorded, digest sent with a `Recap Backfill —` subject. Gmail is
searched far enough back to actually contain that day rather than the usual two.

Safe to run repeatedly — rows are keyed by date + HCA + customer, so a second
pass writes nothing. A backfill deliberately does not read or advance the
last-run marker, since that marker tracks the live nightly run and moving it
would make genuinely late replies to other nights look already reported.

Use it when the script was deployed after a night had already happened, a
trigger failed, or replies arrived long after the log moved on. `Reply
Compliance` is where a gap shows up: a date with no rows for people who were
scheduled is a night that needs backfilling.

## Mapping onto the tracker lead schema

Tracker leads (`const leads` in each `tracker-*.html`) use this shape:

```js
{customer, address, phone, estimate, estimateRaw, daysOld,
 createdOn, status, lastFollowUp, followUps, notes}
```

What the recap can and cannot fill:

| Tracker field | Source |
|---|---|
| `customer` | recap — `Customer:` |
| `status` | recap — `Outcome` (see note below) |
| `lastFollowUp` | recap — date of the reply |
| `followUps` | recap — increment on each mention |
| `notes` | recap — objection/holdback + water-heater answer |
| `estimate` / `estimateRaw` | recap — figure parsed from the deal line, when one is given |
| `address` | **ServiceTitan only** |
| `phone` | **ServiceTitan only** |
| `createdOn` | **ServiceTitan only** |

Because three fields have no recap equivalent, the recap **updates** tracker
records rather than replacing the ServiceTitan export outright. The export
remains the backbone (identity, contact, dollar value, created date); the
recap supplies the daily delta.

The two also cover different populations. A recap describes the appointments a
rep ran that day. The unsold tracker is the standing backlog of open
estimates. Recaps keep the backlog current going forward but cannot
reconstruct leads that are already sitting in it untouched.

### Open decisions before a parser is built

1. **Outcome to status.** Tracker statuses are `Contacted`, `Unreachable`,
   `NotAttempted`, `Lost`, `Sold`. There is no `Estimate`, so today both `E`
   and `F` collapse to `Contacted` and the distinction is lost. Adding an
   `Estimate` status keeps it.
2. **Customer matching.** `Customer:` is free text. "Smith" vs "John Smith"
   needs normalisation plus fuzzy matching, and anything unmatched has to land
   in a review queue rather than being dropped silently.
3. **Deal figures are two different units.** The deal line accepts either a
   one-time total ("BETTER HP $18,500") or a Comfort Club monthly
   ("BEST DF $249/mo"). `parseDealAmount_` records which it saw and the digest
   tallies the two separately, because summing them would be meaningless.
   Anything landing in the tracker's `estimateRaw` needs the same care — that
   field is a one-time dollar amount, so a monthly cannot be written into it
   directly.

## Feeding the 1:1 prep tool

`doGet` serves the log as JSON, the same pattern `leaderboard.html` already
uses for its aggregator. Deploy the script as a web app — execute as yourself,
access "Anyone with the link".

```
?hca=Kyle McAlister    one rep; omit for everyone
?days=14               window, defaulting to the 14-day 1:1 cycle
?key=...               required once recapApiKey is set
```

The rolling-up happens server side, so the brief is a rendering job and the
same figures are available to anything else that asks. Per rep, over the
window:

| | |
|---|---|
| `appointments`, `outcomes`, `closeRate` | volume and conversion |
| `offered.oneTime` / `.monthly` / `.noFigure` | value, units kept apart |
| `objections` | each with its date and customer — the 1:1 material |
| `undated` | open deals with no next step, the ones that quietly die |
| `waterHeaterRate` | attach rate |
| `followUps` | backlog work reported |
| `replyRate` | days scheduled against days answered |
| `missedDays` | the actual dates missed, with weekday |
| `rows` | the raw appointments behind all of it |

`missedDays` names the days rather than only reporting a percentage. "Reported
80% of days" is not something you can raise in a 1:1; "you missed Tuesday and
Friday" is.

The payload also carries `logUrl`, so the 1:1 page can link straight to the
spreadsheet instead of reproducing it, and that link travels into the notes and
therefore into the calendar invite.

Objections travel with their customer and date rather than as bare strings,
because "price" on its own starts no conversation while "Bob Roe, Tuesday,
going over with wife" does.

### Reconciling against ServiceTitan before the meeting

A recap records what a rep believed at 6pm. By the 1:1 two days later the deal
may have closed, or been installed. Walking in with the rep's stale status is
worse than walking in with none, so `buildRecapApiPayload_` reads the alert
emails back and reports the drift. Each rep gains:

| | |
|---|---|
| `soldNotReported` | ServiceTitan says sold, no recap ever mentioned the customer — a prompt to ask, not an accusation |
| `statusDrift` | recap said estimate or follow-up, ServiceTitan has since marked it sold |
| `installed` | matched to a `Completed Form Alert [HVAC Sales]` — already in and done |
| `soldAlerts` | every deduped sold alert, with `reportedOutcome` and `installCompletedOn` |
| `soldPerServiceTitan`, `soldAmountPerServiceTitan` | against the rep's own reported `sold` |

Four details that matter:

- **Technicians raise the same alert.** The subject varies by business unit —
  `[Sales Quote]` for advisors, `[HVAC Sales]` and `[HVAC COD Service]` for
  technician-sold work — so filtering is done on `Sold by` against the roster,
  not on the subject.
- **One job can raise several sold alerts, and the alert does not say which
  kind.** Both of these are real, from the same week:

  | Customer | Estimates | What it is |
  |---|---|---|
  | Greg Anderson | `$12,325.60` Mitsubishi 2-zone, `$348.13` Kumo cloud | system + accessory, **both** sold |
  | Eileen Manrao | `$9,350.00` Supreme 25 (7/29), `$8,667.02` \*NEW\* Supreme 25 (7/30) | almost certainly **one** deal repriced |

  Nothing in the alert distinguishes them. So estimates are grouped by job and
  every line is kept; a job with more than one is marked `multiEstimate` and
  the total is presented as needing a look. Picking one and calling the other a
  revision would have silently discarded $12,325.60 of Greg Anderson's sale.
  The same estimate number alerting twice *is* deduped — that one really is a
  duplicate.
- **A rep with no recap rows at all still appears** if he raised a sold alert.
  That rep is the whole point of the exercise, and he has no rows to be found
  by.
- **Only sales-unit completions count as installs.** `Completed Form Alert`
  also fires for `[HVAC COD Service]`, `[Fireplace COD Service]` and
  `[HVAC Maintenance Plan]`. A service call on a customer who also bought must
  not read as "installed", so the subject has to contain `Sales`.

If the Gmail search fails, `reconciliation.ok` comes back `false` with an
`error`, the recap figures are unaffected, and the 1:1 card says the sold and
install status may be stale rather than quietly showing none.

**Install *scheduled* dates are not available from these alerts.** The two
alerts carry sold and completed and nothing in between. Anything sold without a
completion alert is listed as "sold, no completion alert yet" and points at the
COMBO LOG, rather than implying no install is booked.

### Matching the booked job to the reply

`sold-job-tracker-sync.gs` builds everything off Sold Estimate Alerts — a
booked job only ever attaches to a job that already sold, as `bookedContext`.
So **an appointment that ran and did not sell appears nowhere in the sold
tracker**, and the recap reply is the only record it happened at all.

That is what this match is for. Per rep:

| | |
|---|---|
| `rows[].booked` | job type, appointment time, HOA, timeline, system age — the customer's own words from the booking call |
| `rows[].sourceHintDiffers` | the booking looks like a different lead source than the rep reported |
| `reportedNotBooked` | ran it, no Sales Quote booking behind it — a revisit or self-generated lead, or a name typed differently |
| `bookedMatched` | how many of the rep's rows tied back to a booking |

And company-wide, on `reconciliation`:

| | |
|---|---|
| `unclaimedAppointments` | booked, the day has passed, nobody reported it. Did it run? Get reassigned? Cancel? |

Four things the alert body forces:

- **It is positional, not labelled.** Job type, `# number`, appointment
  date/time and customer each sit on their own line, in that order, with the
  customer on the line after the date. Nothing is a `Field: value` pair.
- **The date line is the appointment, not the booking.** Alerts fire when the
  job is booked, which can be weeks ahead — 8/10 and 8/12 appointments both
  alerted on 7/30. So the Gmail search reaches back 90 days further than the
  report window and the filtering is done on the parsed appointment date.
- **The year is never stated.** `7/29` alone. An appointment is booked forward,
  so it resolves to the first year that puts it on or after the alert, with a
  week of slack for same-day bookings and reschedules.
- **The advisor is not a field, but the dispatcher often names one.** `KEEP
  WITH JAY`, `KEEP ON JOE C` appear in free text. Read as `assignedHint` and
  labelled as a dispatch note wherever shown — never treated as the advisor of
  record. The recap reply remains that.

`TECH LEAD CALEB` and `LEAD BY Dan K.` name the **technician who flipped the
lead**, not the advisor — which makes them the booking's own word on lead
source, compared against what the rep reported. Recorded, not judged: a
tech-flip booking can legitimately be reported as a revisit if the rep had seen
the customer before.

### Securing it

The payload carries customer names, prices and objections. Set a Script
Property named `recapApiKey` and the endpoint will demand a matching `key`
parameter. Until that property exists it answers anyone holding the URL, and
says so in the response via `unsecured: true` — visible rather than silent.

## What the ServiceTitan alerts can and cannot tell us

Verified against real alert emails on 2026-07-30.

| Alert | Carries the HCA? |
|---|---|
| `Booked Job Alert [Sales Quote]` | **No** |
| `Sold Estimate Alert` | Yes — `Sold by` |
| `Completed Form Alert [HVAC Sales]` | **No** — matched by customer name |

`Sold Estimate Alert` is a line-per-field body:

```
Sold Estimate Alert:
Name: *NEW* Supreme 25
Estimate#: 408432504
Opportunity#: 408010922
Sold by: Javierre Milo
Date: 7/30 8:15 AM
Amount: $8,667.02
Customer: Eileen Manrao
Job#: 408010920
```

`Completed Form Alert [HVAC Sales]` is the install-finished signal and is not
labelled the same way — its body opens with date, time, customer and address on
one line, with `INSTALL DESCRIPTION:` further down. It names no advisor, so it
is matched back to a sold alert by customer name.

**Neither alert carries a scheduled install date.** Sold and completed are all
there is; the date the crew is booked for has to come from the COMBO LOG.

A booked job has no advisor **field**. The HCA is assigned after booking, so
the alert cannot state who will run the appointment.
`apps-script/sold-job-tracker-sync.gs` reflects this: it reads `Sold by` only
from the Sold Estimate Alert, and its `readBookedJobAlerts_` extracts no HCA.

Rereading real bodies did turn up a partial signal that earlier notes had
written off: the dispatcher heading frequently names one — `KEEP WITH JAY`,
`KEEP ON JOE C`. It is free text and it is not always there, so it is carried
as `assignedHint` and always displayed as a dispatch note. It narrows who to
ask; it does not establish who ran the job.

Booked Job Alerts carry: job type, job number, appointment date/time, customer
name and link, address, and — depending on how the job was booked — either the
Scheduling Pro questionnaire or a dispatch heading plus a `COW:` phone number
and tech-flip qualifying answers. A phone number is not always present.

Two consequences:

1. The recap cannot be pre-filled per HCA from booking data, because the
   day's bookings cannot be reliably split by advisor.
2. **The recap reply is the only place the HCA-to-customer mapping exists
   before a sale.** So reconciliation runs the other way: take the day's booked
   Sales Quote jobs, match them against what reps reported, and treat anything
   booked but unreported as an appointment nobody accounted for. That works
   without the HCA ever appearing on the alert. Implemented in
   `matchBookedToReplies_` — see "Matching the booked job to the reply" above.

## Implementation

`apps-script/daily-recap.gs` implements both jobs. Deploy it in a Google Apps
Script project that can send mail as geoffrey.simons@cmheating.com and read the
Exceptions sheet, then:

1. Run `previewDailyRecap()` — sends nothing, logs who tonight's send would go
   to and why.
2. Run `installDailyRecapTriggers()` once to create both time-driven triggers.
3. Leave `TEST_MODE: true` until the email looks right, then set it to `false`.

While `TEST_MODE` is on, the 6pm job sends one email to
geoffrey.simons@cmheating.com containing the roster decision plus the verbatim
body each HCA would receive. No HCA is contacted.

Apps Script was chosen over a Cowork scheduled task because the Gmail connector
available to scheduled sessions can only create drafts, not send, and routines
created programmatically receive no connector access at all. Apps Script also
reads the Exceptions sheet directly and runs its triggers in
`America/Los_Angeles`, so there is no UTC/DST drift.

### The recap log spreadsheet

The first collect run creates the log, stores its id in Script Properties, and
emails the link. Creating it from the script guarantees the script can write to
it; a sheet made by hand and pasted into config is the usual source of
permission trouble. Set `logSpreadsheetId` only to point at an existing log.

| Tab | Contents |
|---|---|
| `Recap Log` | one row per appointment reported |
| `Reply Compliance` | one row per scheduled HCA per day, replied Yes/No |
| `Summary` | per-HCA rollup, outcomes, lead sources, missed days |

One row per appointment is the grain worth keeping — anything coarser discards
the detail the recap exists to collect. Reply Compliance is a separate tab
because a non-reply has no appointment to attach to, and mixing the two would
corrupt every count taken over the log.

Writes are idempotent. Each row carries a key of date + HCA + customer, and
existing keys are read before appending, because the collector runs nightly and
can meet the same reply again through the late-reply path. A re-run adds
nothing; a genuinely new appointment on the same day still appends.

`Summary` is formulas rather than generated rows, so it recalculates by itself
and cannot drift from the log. Clearing it does not touch the data underneath.

If the spreadsheet cannot be written, the digest still goes out and says so
explicitly rather than appearing to have logged the night.

### Schedule exception handling

| Type | Effect |
|---|---|
| `Sick` | removed from today's send |
| `Vacation` | removed from today's send |
| `Swap` | added to today's send even if not normally scheduled |

If the Exceptions sheet cannot be read, the send proceeds on base schedules
alone and emails the manager a warning rather than silently assuming everyone
is working.

## Status as of 2026-07-31

The script is complete and tested; the Apps Script project is not yet deployed,
so nothing is running on a schedule and nothing is flowing into the trackers
from this path. Recap emails for the 30th and 31st went out by hand and replies
are sitting in Gmail.

Remaining, in order:

1. Paste `apps-script/daily-recap.gs` into the project and run
   `previewDailyRecap()`.
2. Run `backfillRecapForDate("2026-07-30")` **before Saturday** — the reply
   search looks back two days and Thursday's answers fall out of the window
   after that.
3. Set `TEST_MODE: false`, run `installDailyRecapTriggers()`.
4. Deploy as a web app and paste the `/exec` URL into `RECAP_API_URL` in
   `hca-1on1.html`. Until it is set, the recap card on the 1:1 page stays
   hidden and the scheduler is unaffected.

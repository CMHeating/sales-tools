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

Lead Source and Outcome list their options in full. Nothing has to be looked
up or remembered, and there is no separate legend to keep in sync.

```
Customer:
Lead Source (Web / Inbound / Tech Flip / Revisit):
Outcome (Sold / Estimate / Follow-up needed):
What did you offer as a deal? (package/tier + price):
Water Heater presented? (Y/N — interest level):
Follow-up date (if not closed):
If not sold — What is the objection or holdback from completing the sale?:

Repeat the block if you ran more than one appointment.

Follow-ups on older leads today (who + what happened):
```

One block per appointment run that day. Reps repeat the block if they ran
more than one.

The follow-up line is day-level and deliberately sits outside the repeating
block. A rep can spend a whole day working the existing backlog and run no
appointments at all — on the first live night one did exactly that — and
without this their day reports as nothing. Its label avoids the word
"customer", which the appointment block already claims as a field label, and
is matched ahead of "Follow-up date" so the two never collide.

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

## Collect (8:15pm Pacific, daily)

Search Gmail for replies to that evening's recap emails. Compile a digest
grouped by HCA, tagged `[SOLD]` / `[ESTIMATE]` / `[FOLLOW-UP NEEDED]`, including
lead source and the objection/holdback for anything not sold. Flag any HCA who
was scheduled to work and did not reply.

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

## What the ServiceTitan alerts can and cannot tell us

Verified against real alert emails on 2026-07-30.

| Alert | Carries the HCA? |
|---|---|
| `Booked Job Alert [Sales Quote]` | **No** |
| `Sold Estimate Alert [Sales Quote]` | Yes — `Sold by` |

A booked job has no advisor attached. The HCA is assigned later, so the alert
that fires at booking time cannot say who will run the appointment.
`apps-script/sold-job-tracker-sync.gs` already reflects this: it reads `Sold by`
only from the Sold Estimate Alert, and `readBookedJobAlerts_` extracts no HCA
because there is none to extract.

Booked Job Alerts do carry: job number, date/time, customer name and link,
address, and — depending on how the job was booked — either the Scheduling Pro
questionnaire or a dispatch heading plus a `COW:` phone number and tech-flip
qualifying answers. A phone number is not always present.

Two consequences:

1. The recap cannot be pre-filled per HCA from booking data, because the
   day's bookings cannot be split by advisor.
2. **The recap reply is the only place the HCA-to-customer mapping exists
   before a sale.** That makes reconciliation run the other way: take the day's
   booked Sales Quote jobs, match them against what reps reported, and treat
   anything booked but unreported as an appointment nobody accounted for. That
   works without the HCA ever appearing on the alert.

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

## Status as of 2026-07-30

Not yet deployed. No recap email has ever been sent — a Gmail search across
sent mail, the HCA addresses, and the distinctive template phrases returns
nothing, and no matching scheduled task exists on the account. Nothing is
flowing into the trackers from this path yet.

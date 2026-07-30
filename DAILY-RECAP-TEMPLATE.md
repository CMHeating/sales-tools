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
Lead Source (W/I/TF/R):
Outcome (S/E/F):
Water Heater presented? (Y/N — interest level):
Follow-up date (if not closed):
If not sold — What is the objection or holdback from completing the sale?:
```

One block per appointment run that day. Reps repeat the block if they ran
more than one.

### Quick codes

| Lead Source | | Outcome | |
|---|---|---|---|
| `W` | Web | `S` | Sold |
| `I` | Inbound | `E` | Estimate |
| `TF` | Tech Flip | `F` | Follow-up needed |
| `R` | Revisit | | |

There is deliberately no "Not Valid" outcome. The objection/holdback question
replaced it.

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
| `address` | **ServiceTitan only** |
| `phone` | **ServiceTitan only** |
| `estimate` / `estimateRaw` | **ServiceTitan only** |
| `createdOn` | **ServiceTitan only** |

Because five fields have no recap equivalent, the recap **updates** tracker
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
3. **Missing dollar value.** Recap-sourced leads have no estimate, so they do
   not contribute to the Pipeline Value tile. An optional `Estimate amount:`
   line in the template would fix that at the cost of one more field per
   appointment.

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

/*
 * CM Heating — Daily HCA Recap
 *
 * Two time-driven jobs:
 *   sendDailyRecap()      6:00pm Pacific — emails each HCA scheduled to work today
 *   collectRecapReplies() 8:15pm Pacific — digests their replies back to the manager
 *
 * Install this in a Google Apps Script project owned by an account that can:
 *   - send mail as geoffrey.simons@cmheating.com
 *   - read the Schedule Exceptions sheet
 *
 * Setup:
 *   1. Paste this file into the script project.
 *   2. Run previewDailyRecap() once and read the log. It sends nothing.
 *   3. Run installDailyRecapTriggers() once to create both time-driven triggers.
 *   4. Leave it in test until the email looks right, then run goLive().
 *
 * TEST_MODE (see DAILY_RECAP_CONFIG below):
 *   true  — sends ONE email to testRecipient containing the roster decision plus
 *           the verbatim body each HCA would have received. No HCA is contacted.
 *   false — sends the real per-HCA emails.
 *
 * Apps Script daily triggers fire within a window rather than on the exact
 * minute, so "6:00pm" in practice means sometime in the 6pm hour. The collect
 * job uses nearMinute to keep it close to 8:15pm.
 */

const DAILY_RECAP_CONFIG = {
  /* The starting value only. Once goLive() or goTest() has been run, the live
     setting is in Script Properties and this is ignored — see isTestMode_().
     A new project is safe by default; an established one cannot be knocked
     back into test by someone pasting this file over it. */
  TEST_MODE: true,

  timeZone: "America/Los_Angeles",
  testRecipient: "geoffrey.simons@cmheating.com",
  managerEmail: "geoffrey.simons@cmheating.com",
  fromName: "CM Heating Sales Operations",

  subjectPrefix: "Daily Recap",
  testSubjectPrefix: "[TEST] Daily Recap",

  exceptionsSpreadsheetId: "1RIUfCH7ZXHfXiX1jjvCHuQp9pDWqpZB-IExpUBvGFzM",
  exceptionsSheetName: "",          // blank = first sheet

  /* Leave logSpreadsheetId blank. The first collect run creates the sheet,
     stores its id in Script Properties, and emails the link. Creating it from
     the script guarantees the script can write to it — a sheet made by hand
     and pasted in here is the usual source of permission trouble. Paste an id
     only to point at an existing log. */
  logSpreadsheetId: "",
  logSpreadsheetTitle: "CM Heating — Daily Recap Log",
  logSheetName: "Recap Log",
  complianceSheetName: "Reply Compliance",
  summarySheetName: "Summary",
  todaySheetName: "Today",

  /* The reconciled view: one row per job, whether or not a rep reported it.
     Written on a schedule by refreshJobStatus(), read by the 1:1 scheduler.
     The page does not search Gmail — three searches over hundreds of threads
     on every page load would be slow, would burn quota, and would give a
     different answer each time it ran. */
  jobStatusSheetName: "Job Status",
  jobStatusDays: 21,                // how far back each refresh reconciles

  /* What people actually said about the homeowner by email, attached to the
     job. Often the most useful thing about a deal is nowhere in ServiceTitan
     — it is Amy asking for an install date and the rep answering. */
  emailNotesSheetName: "Email Notes",
  emailNoteLookbackDays: 60,

  /* The worklist: every open appointment, soonest first. Derived from Recap
     Log on each refresh, so the log stays the record and this stays the
     thing you actually work from. */
  followUpsSheetName: "Follow-Ups",

  /* COMBO LOG 2026 — the same sheet sold-job-tracker-sync.gs reads. It is the
     only source for a *scheduled* install date; the ServiceTitan alerts carry
     sold and completed and nothing in between. Blank disables the lookup and
     scheduled dates simply come back empty. */
  comboLogSpreadsheetId: "16Z-PK7d2Y6MvNHM1vqZ6y0JsezITQG6fYnawomYl46c",

  /* 6:00am. The recap goes out before the first appointment rather than after
     the last one, so a rep can answer a block as they leave each driveway
     instead of reconstructing the whole day at 8pm. Replies arriving in
     pieces cost nothing: rows are keyed on date + HCA + customer, so three
     messages across a day merge into one clean set. */
  sendHour: 6,
  collectHour: 20,                  // 8:15pm Pacific
  collectMinute: 15,
  replyLookbackDays: 2,

  /* Deliberately NOT sendHour. suspectWrongThread_ flags a reply that answers
     an older night and arrived once a fresher recap was already sitting in the
     inbox. With a 6pm send that was the same threshold; with a 6am send a
     fresher email exists from breakfast onward, and every ordinary
     next-morning reply would flag. Kyle answering Saturday's recap at 8:18am
     Sunday is normal and must stay quiet. Holding this at 6pm keeps the flag
     meaning "they had all day to use today's email and used an old one". */
  suspectAfterHour: 18,

  /* The chase for anyone who owed yesterday and never replied now rides along
     inside the 6am email rather than arriving separately an hour later — see
     buildRecapBody_. Set nudgeEnabled true to also install the old standalone
     nudge triggers; the functions still work and are useful for a one-off. */
  nudgeEnabled: false,
  nudgeHourWorking: 7,
  nudgeHourOff: 8,
  /* After both nudge rounds, so a recap that came in at 7:30 is counted. */
  morningBriefHour: 9
};

/*
 * Base weekly schedules. Schedule Exceptions rows override these per day:
 *   Sick / Vacation — removed from today's send
 *   Swap            — added to today's send even if not normally scheduled
 */
const RECAP_ROSTER = [
  { first: "Amber",   name: "Amber Maddalena",  email: "amber.maddalena@cmheating.com", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] },
  { first: "Chester", name: "Chester Granard",  email: "chester.granard@cmheating.com", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] },
  { first: "Davis",   name: "Davis Diosdado",   email: "davis.diosdado@cmheating.com",  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] },
  { first: "Adam",    name: "Adam Weberg",      email: "adam@cmheating.com",            days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Joseph",  name: "Joseph Ruble",     email: "joseph.ruble@cmheating.com",    days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Kyle",    name: "Kyle McAlister",   email: "kmcalister@cmheating.com",      days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Jay",     name: "Javierre Milo",    email: "javierre.milo@cmheating.com",   days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Joe",     name: "Joe Chounramany",  email: "jchounramany@cmheating.com",    days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Samir",   name: "Samir Khoury",     email: "samir.khoury@cmheating.com",    days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  { first: "Trevor",  name: "Trevor Bohm",      email: "trevor.bohm@cmheating.com",     days: ["Monday", "Wednesday", "Thursday", "Saturday"] }
];

/* ------------------------------------------------------------------ send */

const LAST_SEND_PROPERTY = "lastRecapSendIso";

/*
 * Sends tonight's recap, once.
 *
 * The second guard is there because this function sits in the Run dropdown
 * next to the read-only ones, sends the moment it is called, and cannot be
 * taken back — Gmail has no recall and Apps Script bypasses Undo Send. All six
 * HCAs got a duplicate on the first evening it went live, from exactly that.
 *
 * A day that has already had a real send is refused. The trigger fires once, so
 * this only ever catches a second call. forceSendDailyRecap is the way past it,
 * named so that using it is a decision rather than an accident.
 */
function sendDailyRecap() { return sendDailyRecap_(false); }

/* Sends even if today already had one. For a genuine re-send — the night the
   6pm run went out in test mode and nobody was contacted, say. */
function forceSendDailyRecap() { return sendDailyRecap_(true); }

function sendDailyRecap_(force) {
  const now = new Date();
  const plan = buildTodayPlan_(now);

  if (!plan.working.length) {
    Logger.log("No HCAs scheduled for " + plan.dateLabel + ". Nothing sent.");
    return plan;
  }

  if (!force && !isTestMode_() && lastRealSendIso_() === plan.isoDate) {
    Logger.log("ALREADY SENT today (" + plan.dateLabel + ") — nothing sent, nobody " +
      "was emailed twice.\nRun forceSendDailyRecap if you really do want a second " +
      "copy, or previewDailyRecap to see the roster without sending.");
    return plan;
  }

  if (isTestMode_()) {
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.testRecipient],
      subject: DAILY_RECAP_CONFIG.testSubjectPrefix + " — " + plan.dateLabel,
      body: buildTestModeBody_(plan)
    });
    Logger.log("TEST_MODE: one preview email sent to " + DAILY_RECAP_CONFIG.testRecipient +
      " covering " + plan.working.length + " HCA(s). No HCA was contacted.");
    return plan;
  }

  const owedBy = whoStillOwesYesterday_(now);
  plan.working.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      subject: DAILY_RECAP_CONFIG.subjectPrefix + " — " + plan.dateLabel,
      body: buildRecapBody_(hca, plan.dateLabel, owedBy[hca.name] || "")
    });
  });

  if (!plan.exceptions.ok) {
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.managerEmail],
      subject: "Daily Recap warning — Schedule Exceptions sheet unreadable",
      body: "The recap for " + plan.dateLabel + " went out using base schedules only.\n\n" +
        "The Schedule Exceptions sheet could not be read, so Sick / Vacation / Swap\n" +
        "overrides were NOT applied. Anyone out today was emailed anyway.\n\n" +
        "Error: " + plan.exceptions.error
    });
  }

  /* Recorded after the send, so a run that threw partway does not lock the day
     out. Recorded only for a real send — a test-mode preview contacts nobody
     and must not block the real one. */
  writeLastRealSend_(plan.isoDate);

  Logger.log("Sent recap to " + plan.working.length + " HCA(s) for " + plan.dateLabel);
  return plan;
}

/*
 * HCA name -> the label of yesterday, for anyone who was scheduled yesterday
 * and has still said nothing. Everyone else is absent from the map.
 *
 * One Gmail read at send time. It replaces the standalone 7am/8am nudge: with
 * the recap arriving at 6am, a separate chase an hour later is a second email
 * saying almost the same thing.
 *
 * Errs toward silence. If the search fails or yesterday cannot be built, this
 * returns nothing and the recap goes out clean — telling someone they missed a
 * day they actually filed is worse than not mentioning it, because it teaches
 * them the reminders are wrong and can be ignored.
 */
function whoStillOwesYesterday_(now) {
  const out = {};
  try {
    const yesterday = new Date(now.getTime() - 86400000);
    const past = buildTodayPlan_(yesterday);
    if (!past.working.length) return out;

    const found = findRecapReplies_(past.dateLabel, null);
    if (!found.ok) return out;

    const replied = {};
    found.replies.forEach(r => { replied[r.hca.name] = true; });
    past.working.forEach(h => { if (!replied[h.name]) out[h.name] = past.dateLabel; });
  } catch (err) {
    Logger.log("Could not work out who owes yesterday, sending without it: " +
      (err && err.message ? err.message : String(err)));
    return {};
  }
  return out;
}

function lastRealSendIso_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(LAST_SEND_PROPERTY) || "";
  } catch (err) {
    /* Unreadable means we cannot prove today was already sent. Send — a missing
       recap is invisible, a duplicate is merely annoying. */
    return "";
  }
}

function writeLastRealSend_(isoDate) {
  try {
    PropertiesService.getScriptProperties().setProperty(LAST_SEND_PROPERTY, isoDate);
  } catch (err) {
    Logger.log("Could not record the send date: " + (err && err.message ? err.message : String(err)));
  }
}

function buildRecapBody_(hca, dateLabel, owed) {
  /* Lead Source and Outcome list their options in full rather than as letter
     codes, so nothing has to be looked up or remembered. The collector still
     accepts the old single letters — see normalizeLeadSource_/normalizeOutcome_
     — because reps who learned W/I/TF/R and S/E/F will keep typing them. */
  /*
   * Shaped by the first live night, when five reps produced five formats.
   *
   * Labels are short. The old objection prompt ran 73 characters, wrapped on
   * every phone, and one rep retyped it without its trailing colon — losing
   * both the prompt and the best answer of the night. Every label here fits on
   * one line on a phone.
   *
   * Options stay inside the parentheses, before the colon. Anything after the
   * colon is the answer, so options placed there would be captured as part of
   * whatever the rep typed next.
   *
   * Plain hyphens, no em dashes: they survive every client's HTML-to-text
   * conversion intact.
   *
   * A stated "None" path exists because a rep with no appointments abandoned
   * the template entirely and wrote prose. Collectors still accept the older
   * long labels, so replies in the previous format keep parsing.
   */
  /*
   * owed is the label of a day this rep never filed. It appears as a pointer
   * back to that day's own email, NOT as a second blank template.
   *
   * That is not a style choice. A reply to THIS message carries today's
   * subject line, and the subject is the only thing that dates a reply. Put
   * yesterday's template in here and yesterday's appointments log against
   * today — silently, and in a way that looks perfectly correct in the sheet.
   * Sending them back to the original thread is the only version that files
   * to the right day.
   */
  const chase = owed
    ? "You haven't filed " + owed + " yet. That email is still in your inbox —\n" +
      "reply to that one, not this one, so it lands on the right day.\n\n"
    : "";

  return "Hi " + hca.first + ",\n\n" +
    chase +
    "Reply as you finish each appointment today (" + dateLabel + ").\n" +
    "One block each, as many as you run. No need to wait for the end of the day.\n" +
    "Nothing on today? Reply None and just fill in the last line.\n\n" +
    "Customer:\n" +
    "Source (Web / Inbound / Tech Flip / Revisit):\n" +
    "Outcome (Sold / Estimate / Follow-up):\n" +
    "Offered (package + price):\n" +
    "Water heater (Y/N + interest):\n" +
    "Next follow-up:\n" +
    "Objection (if not sold):\n\n" +
    "Sending them one at a time? Just send this block again for the next one.\n\n" +
    /* Day-level, so it sits outside the repeating block. A rep can work a full
       day on the existing backlog and run no appointments at all; without this
       their day reports as nothing. Deliberately avoids the word "customer",
       which the appointment block already claims as a field label. */
    "Follow-ups on older leads today (who + what happened):\n\n" +
    "Thanks,\n" +
    "Geoff\n";
}

function buildTestModeBody_(plan) {
  const lines = [];
  lines.push("TEST MODE — no HCA was contacted. This is a preview of tonight's send.");
  lines.push("");
  lines.push("Date: " + plan.dateLabel + " (" + plan.weekday + ")");
  lines.push("");
  lines.push("Would have emailed " + plan.working.length + ":");
  plan.working.forEach(h => lines.push("  - " + h.name + " <" + h.email + ">" + (h.note ? "  [" + h.note + "]" : "")));

  if (plan.skipped.length) {
    lines.push("");
    lines.push("Skipped " + plan.skipped.length + ":");
    plan.skipped.forEach(s => lines.push("  - " + s.name + "  [" + s.reason + "]"));
  }

  lines.push("");
  lines.push(plan.exceptions.ok
    ? "Schedule Exceptions sheet: read OK (" + plan.exceptions.count + " row(s) for today)"
    : "Schedule Exceptions sheet: COULD NOT BE READ — base schedules used, no overrides applied.\n  Error: " + plan.exceptions.error);

  lines.push("");
  lines.push("To go live, run goLive() once. It is stored outside this file, so");
  lines.push("updating the script later will not put the recap back into test.");
  lines.push("");
  lines.push(new Array(70).join("="));
  lines.push("");
  lines.push("Below is the exact email each person would receive.");
  lines.push("");

  plan.working.forEach(hca => {
    lines.push(new Array(70).join("-"));
    lines.push("To: " + hca.email);
    lines.push("Subject: " + DAILY_RECAP_CONFIG.subjectPrefix + " — " + plan.dateLabel);
    lines.push("");
    lines.push(buildRecapBody_(hca, plan.dateLabel));
  });

  return lines.join("\n");
}

/* ----------------------------------------------------------------- nudge */

/*
 * Two entry points because Apps Script triggers take no arguments. Both run
 * the same logic; they differ only in whose day it is.
 *
 *   7am — people working today
 *   8am — people off today, who get the extra hour
 */
function sendMorningNudgeWorkingToday() { return runMorningFollowUp_(true); }
function sendMorningNudgeOffToday() { return runMorningFollowUp_(false); }

/*
 * The morning pass over yesterday's recap. One Gmail read drives both halves,
 * so the acknowledgement and the chase can never disagree about who replied:
 *
 *   replied     -> a short acknowledgement, so reporting visibly lands
 *   no reply    -> one nudge
 *
 * Acknowledging matters more than it looks. A rep who reports into silence
 * stops reporting, and that costs the whole night's data rather than one
 * field of it.
 */
function runMorningFollowUp_(workingToday) {
  const cfg = DAILY_RECAP_CONFIG;
  if (!cfg.nudgeEnabled) return { acked: 0, nudged: 0, reason: "disabled" };

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const past = buildTodayPlan_(yesterday);
  if (!past.working.length) return { acked: 0, nudged: 0, reason: "nobody was scheduled yesterday" };

  const found = findRecapReplies_(past.dateLabel, null);
  if (!found.ok) {
    /* Without a reliable read there is no safe move: chasing someone who
       replied and thanking someone who did not are both worse than silence. */
    Logger.log("Morning follow-up skipped — reply search failed.");
    return { acked: 0, nudged: 0, reason: "reply search failed" };
  }

  const byHca = {};
  found.replies.forEach(r => {
    if (!byHca[r.hca.name]) byHca[r.hca.name] = { hca: r.hca, entries: [], followUps: "" };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
    if (r.followUps) {
      byHca[r.hca.name].followUps = byHca[r.hca.name].followUps
        ? byHca[r.hca.name].followUps + "\n" + r.followUps
        : r.followUps;
    }
  });

  const todayPlan = buildTodayPlan_(now);
  const onShiftToday = {};
  todayPlan.working.forEach(h => { onShiftToday[h.name] = true; });

  const inScope = past.working.filter(h => !!onShiftToday[h.name] === !!workingToday);
  const toAck = inScope.filter(h => byHca[h.name]);
  const toNudge = inScope.filter(h => !byHca[h.name]);

  if (isTestMode_()) {
    sendEmailSafe_({
      to: [cfg.testRecipient],
      subject: "[TEST] Recap morning follow-up — " + past.dateLabel,
      body: "TEST MODE — no HCA was contacted.\n\n" +
        "Group: " + (workingToday ? "working today" : "off today") + "\n\n" +
        "Would thank " + toAck.length + ":\n" +
        (toAck.map(h => "  - " + h.name).join("\n") || "  (none)") + "\n\n" +
        "Would nudge " + toNudge.length + ":\n" +
        (toNudge.map(h => "  - " + h.name).join("\n") || "  (none)") + "\n\n" +
        new Array(70).join("=") + "\n\n" +
        (toAck.length ? buildAckBody_(toAck[0], past.dateLabel, byHca[toAck[0].name]) + "\n" +
          new Array(70).join("-") + "\n\n" : "") +
        (toNudge.length ? buildNudgeBody_(toNudge[0], past.dateLabel) : "")
    });
    return { acked: 0, nudged: 0, previewed: toAck.length + toNudge.length };
  }

  toAck.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      subject: "Re: " + cfg.subjectPrefix + " — " + past.dateLabel,
      body: buildAckBody_(hca, past.dateLabel, byHca[hca.name])
    });
  });

  toNudge.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      /* "Re:" on the original subject keeps this in the same conversation, so
         a reply still carries yesterday's date and is attributed to the right
         night by findRecapReplies_. */
      subject: "Re: " + cfg.subjectPrefix + " — " + past.dateLabel,
      body: buildNudgeBody_(hca, past.dateLabel)
    });
  });

  Logger.log("Morning follow-up (" + (workingToday ? "working" : "off") + "): " +
    toAck.length + " thanked, " + toNudge.length + " nudged, for " + past.dateLabel);
  return { acked: toAck.length, nudged: toNudge.length };
}

/*
 * Deliberately factual. It confirms the report landed and offers help; it does
 * not editorialise about the deals, because putting opinions in Geoff's voice
 * about a specific customer is his call to make, not the script's.
 */
function buildAckBody_(hca, dateLabel, group) {
  const entries = (group && group.entries) || [];
  const followUps = (group && group.followUps) || "";

  const sold = entries.filter(e => e.outcome === "SOLD");
  const open = entries.filter(e => e.outcome !== "SOLD");
  const undated = open.filter(e => !e.followUpDate && e.customer);
  const totals = sumDeals_(entries);
  const n = entries.length;
  const s = n === 1 ? "" : "s";

  /* The weekday alone reads far better than the full label inside a sentence:
     "Got Thursday's recap" against "Got Thursday, July 30, 2026, 2
     appointments". The ack lands the next morning, so the day is unambiguous. */
  const day = String(dateLabel).split(",")[0];

  /* Each slot is hashed with its own salt so the choices are independent.
     Sharing one index made two different days collide into identical wording,
     which is the exact staleness this is meant to avoid. */
  const who = hca.name || hca.first || "";
  const pick = (arr, salt) => arr[ackVariant_(who + "|" + dateLabel + "|" + salt) % arr.length];

  const opener = pick([
    "Morning " + hca.first + " —",
    "Good morning " + hca.first + ",",
    hca.first + " —",
    "Morning " + hca.first + ","
  ], "opener");

  let receipt;
  if (n) {
    receipt = pick([
      "Got " + day + "'s recap — " + n + " appointment" + s + ". Thanks.",
      n + " appointment" + s + " in for " + day + ". Thanks for sending it.",
      "Thanks for " + day + " — " + n + " appointment" + s + " logged.",
      "Got " + day + ", " + n + " appointment" + s + ". Appreciate it."
    ], "receipt");
  } else if (followUps) {
    receipt = pick([
      "Got your follow-ups for " + day + ". Thanks for sending it.",
      "Thanks for " + day + " — noted the follow-up work.",
      day + " noted, thanks. Good to see the older leads getting worked.",
      "Got " + day + ". Follow-ups logged, appreciate it."
    ], "receipt");
  } else {
    receipt = pick([
      "Got your recap for " + day + ". Thanks for sending it.",
      "Thanks for sending " + day + " through.",
      day + " received, thanks.",
      "Got " + day + ". Appreciate it."
    ], "receipt");
  }

  /* At most two observations, and every one of them is drawn from what the rep
     actually wrote. Rotating pleasantries would read as automated within a
     week; naming their own customer does not. */
  const notes = [];

  if (sold.length === 1 && sold[0].customer) {
    notes.push(pick([
      "Nice work on " + sold[0].customer + ".",
      "Good close on " + sold[0].customer + ".",
      "Congrats on " + sold[0].customer + "."
    ], "sold"));
  } else if (sold.length > 1) {
    notes.push(pick([
      sold.length + " closed — nice work.",
      "Nice, " + sold.length + " closed.",
      sold.length + " sold on the day. Good stuff."
    ], "soldMulti"));
  }

  if (notes.length < 2 && undated.length) {
    notes.push(pick([
      "Worth putting a date on " + undated[0].customer + " so it doesn't drift.",
      "No next step on " + undated[0].customer + " yet — worth pinning one down.",
      undated[0].customer + " has no follow-up date on it. Easy one to lose."
    ], "undated"));
  }

  if (notes.length < 2 && followUps && n) {
    notes.push(pick([
      "Good to see the older leads getting worked too.",
      "Noted the follow-ups on the older ones as well.",
      "Appreciate you logging the backlog work too."
    ], "followups"));
  }

  if (notes.length < 2 && totals.oneTime >= 10000) {
    notes.push(pick([
      "That's $" + formatMoney_(totals.oneTime) + " in front of customers.",
      "$" + formatMoney_(totals.oneTime) + " on the table from that.",
      "Puts $" + formatMoney_(totals.oneTime) + " out there."
    ], "money"));
  }

  let closer = "";
  if (open.length) {
    closer = pick([
      "Shout if you want a hand on any of the ones still open.",
      "Let me know if you want me on any of these.",
      "Happy to jump on any that are stuck.",
      "Tell me which one you want help with and I'll work it with you."
    ], "closer");
  }

  const parts = [opener, "", receipt];
  if (notes.length) parts.push("", notes.join(" "));
  if (closer) parts.push("", closer);
  parts.push("", "Geoff", "");
  return parts.join("\n");
}

/*
 * Stable per rep per day. The same person gets a different turn of phrase
 * tomorrow, and two reps on the same morning do not receive identical wording
 * — while a rerun of the same day reproduces exactly what was sent, which
 * random selection would not.
 */
function ackVariant_(seed) {
  let h = 0;
  const str = String(seed || "");
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildNudgeBody_(hca, dateLabel) {
  return "Morning " + hca.first + ",\n\n" +
    "I didn't get your recap for " + dateLabel + ". When you have a minute, reply with what you ran:\n\n" +
    "Customer:\n" +
    "Source (Web / Inbound / Tech Flip / Revisit):\n" +
    "Outcome (Sold / Estimate / Follow-up):\n" +
    "Offered (package + price):\n" +
    "Water heater (Y/N + interest):\n" +
    "Next follow-up:\n" +
    "Objection (if not sold):\n\n" +
    "Ran nothing? None is a fine answer.\n\n" +
    "It's a two minute job, and it tells me where you're stuck so I can help on the deals worth saving.\n\n" +
    "Geoff\n";
}

/* --------------------------------------------------------------- collect */

function collectRecapReplies() { return runCollection_(new Date(), false); }

/*
 * Collects and logs a day that was missed — the script was not deployed yet,
 * a trigger failed, or the log had already moved on when the replies landed.
 *
 * Safe to run as often as you like. Rows are keyed by date + HCA + customer,
 * so a second pass over the same day writes nothing.
 *
 *   backfillRecapForDate("2026-07-30")
 *
 * Gmail is searched far enough back to actually reach that day, rather than
 * the two-day window a normal night uses.
 */
function backfillRecapForDate(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error('Pass a date as "YYYY-MM-DD", e.g. backfillRecapForDate("2026-07-30")');
  const when = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (isNaN(when.getTime())) throw new Error("Unrecognised date: " + isoDate);
  return runCollection_(when, true);
}

/* Yesterday, for the common case of noticing the morning after. */
function backfillYesterday() {
  return runCollection_(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), true);
}

function runCollection_(when, isBackfill) {
  const now = new Date();
  const plan = buildTodayPlan_(when);

  /* A backfill must not consume or advance the last-run marker: that marker
     tracks the live nightly run, and moving it would make genuinely late
     replies to other nights look already-reported. */
  const lastRun = isBackfill ? null : readLastDigestRun_();

  /* Reach far enough back to actually contain the target day. */
  const ageDays = Math.max(0, Math.round((now.getTime() - when.getTime()) / 86400000));
  const lookback = isBackfill
    ? Math.max(DAILY_RECAP_CONFIG.replyLookbackDays, ageDays + 2)
    : DAILY_RECAP_CONFIG.replyLookbackDays;

  const replies = findRecapReplies_(plan.dateLabel, lastRun, lookback).replies;

  const byHca = {};
  const late = [];
  const responded = {};      // replied at all, whether or not anything parsed
  const notesOnly = {};      // replied, but reported no appointments
  const followUpsByHca = {}; // day-level backlog work, independent of appointments

  replies.forEach(r => {
    if (r.late) { late.push(r); return; }
    responded[r.hca.name] = true;
    if (r.followUps) {
      followUpsByHca[r.hca.name] = followUpsByHca[r.hca.name]
        ? followUpsByHca[r.hca.name] + "\n" + r.followUps
        : r.followUps;
    }
    if (!r.entries.length) {
      if (r.note && !notesOnly[r.hca.name]) notesOnly[r.hca.name] = { hca: r.hca, note: r.note };
      return;
    }
    delete notesOnly[r.hca.name];
    if (!byHca[r.hca.name]) byHca[r.hca.name] = { hca: r.hca, entries: [] };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
  });

  /* Silence only. Someone who replied to say they ran nothing has reported,
     and grouping them with people who ignored the email misrepresents them. */
  const missing = plan.working.filter(h => !responded[h.name]);

  /* Logging runs before the digest so the digest can report what was written,
     and is wrapped so a spreadsheet problem degrades to "digest still sent,
     with the error stated" rather than losing the night's collection. */
  let logResult = {
    ok: false, error: "", written: 0, skipped: 0, url: "", created: false,
    lateWritten: 0, lateUndated: 0, lateMarked: []
  };
  try {
    const book = getLogSpreadsheet_();
    const wrote = appendRecapRows_(book.ss, plan, byHca);
    appendComplianceRows_(book.ss, plan, byHca, responded, followUpsByHca);

    /* Late replies go in against their own night. Without this they reach the
       digest and stop there, so a rep who answered after the cutoff still reads
       as silent at the 1:1 two days later. */
    const lateRes = late.length
      ? logRepliesByNight_(book.ss, late)
      : { written: 0, skipped: 0, undated: 0, marked: [] };

    logResult = {
      ok: true, error: "",
      written: wrote.written + lateRes.written, skipped: wrote.skipped + lateRes.skipped,
      url: book.ss.getUrl(), created: book.created,
      lateWritten: lateRes.written, lateUndated: lateRes.undated, lateMarked: lateRes.marked
    };
  } catch (err) {
    logResult.error = err && err.message ? err.message : String(err);
    Logger.log("Recap log write failed: " + logResult.error);
  }

  const body = buildDigestBody_(plan, byHca, missing, late, logResult, notesOnly, followUpsByHca);
  sendEmailSafe_({
    to: [DAILY_RECAP_CONFIG.managerEmail],
    subject: (isTestMode_() ? "[TEST] " : "") +
      (isBackfill ? "Recap Backfill — " : "Recap Digest — ") + plan.dateLabel,
    body: body
  });

  if (!isBackfill) writeLastDigestRun_(now);
  Logger.log((isBackfill ? "Backfill" : "Digest") + " for " + plan.dateLabel + ": " +
    Object.keys(byHca).length + " replied, " + missing.length +
    " missing, " + late.length + " late, " + logResult.written + " row(s) logged.");
  return {
    replied: Object.keys(byHca).length, missing: missing.length,
    late: late.length, logged: logResult.written
  };
}

/*
 * Attribution is by subject, not arrival time. Every recap subject carries its
 * date ("Daily Recap — Thursday, July 30, 2026") and Gmail keeps it on the
 * reply, so a reply is counted against the night it answers.
 *
 * Without this, the broad newer_than search would re-parse yesterday's replies
 * into tonight's digest and double-count them.
 *
 * A reply to an earlier night still matters — reps in the field often answer
 * after the 8:15pm cutoff — so those come back flagged late, bounded to ones
 * that arrived since the previous digest run so they are reported exactly once.
 */
function findRecapReplies_(dateLabel, sinceDate, lookbackDays, includeAllDates) {
  const cfg = DAILY_RECAP_CONFIG;
  const days = lookbackDays || cfg.replyLookbackDays;
  const query = 'subject:"' + cfg.subjectPrefix + '" newer_than:' + days + "d";
  const out = [];

  let threads = [];
  try {
    threads = GmailApp.search(query, 0, 100);
  } catch (err) {
    /* ok:false so callers can tell "nobody replied" apart from "we could not
       find out". The morning run must never chase people on a failed read. */
    Logger.log("Recap reply search failed: " + (err && err.message ? err.message : String(err)));
    return { ok: false, replies: out };
  }

  /* Which nights were asked about at all. Needed to tell a genuine late reply
     from one sent to the wrong thread — see suspectWrongThread_. */
  const nightsAsked = {};
  threads.forEach(thread => {
    let msgs = [];
    try { msgs = thread.getMessages(); } catch (err) { return; }
    msgs.forEach(m => {
      const hit = String(m.getSubject() || "").match(/([A-Za-z]+day,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
      if (hit) {
        const iso = isoFromDateLabel_(hit[1]);
        if (iso) nightsAsked[iso] = true;
      }
    });
  });

  threads.forEach(thread => {
    const messages = thread.getMessages();

    /* Which night this thread belongs to is decided from any message in it,
       the same way the morning run does. Reading it off the rep's own subject would
       lose a reply whenever their client rewrote it. */
    let threadIsTonight = false;
    let threadDateLabel = "";
    messages.forEach(m => {
      const s = String(m.getSubject() || "");
      if (s.indexOf(dateLabel) !== -1) threadIsTonight = true;
      if (!threadDateLabel) {
        const hit = s.match(/([A-Za-z]+day,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
        if (hit) threadDateLabel = hit[1];
      }
    });

    messages.forEach(msg => {
      const from = String(msg.getFrom() || "").toLowerCase();
      const hca = RECAP_ROSTER.filter(h => from.indexOf(h.email.toLowerCase()) !== -1)[0];
      if (!hca) return;

      const subject = String(msg.getSubject() || "");
      const isTonight = threadIsTonight;

      /* The sweep wants every reply in the window so it can file each one
         against its own night; the nightly digest wants only what it has not
         already reported. */
      if (!isTonight && !includeAllDates) {
        if (!sinceDate) return;                       // no prior run recorded
        const received = msg.getDate();
        if (!received || received <= sinceDate) return;
      }

      /* Replies with nothing parseable are kept too. A rep who answers to say
         they ran no appointments has reported; dropping them here would list
         them alongside people who never replied at all. Their own words are
         carried through so the free-text answer is not lost. */
      const raw = msg.getPlainBody();
      const entries = parseRecapReply_(raw);
      const followUps = parseFollowUps_(raw);
      out.push({
        hca: hca,
        entries: entries,
        followUps: followUps,
        late: !isTonight,
        subject: subject,
        /* Which night this reply answers. Read off the thread rather than the
           rep's own subject, which their client may have rewritten, so the row
           lands on the right date instead of today's. */
        answersIso: isoFromDateLabel_(threadDateLabel || dateLabel),
        answersLabel: threadDateLabel || dateLabel,
        receivedIso: Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd"),
        receivedAt: Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "EEE h:mm a"),
        /* Reported, never acted on — see suspectWrongThread_. */
        suspectDate: suspectWrongThread_(
          isoFromDateLabel_(threadDateLabel || dateLabel), msg.getDate(), nightsAsked),
        note: (entries.length || followUps) ? "" : ownText_(raw)
      });
    });
  });

  return { ok: true, replies: out };
}

/*
 * Whether to send to the roster or only to the test recipient.
 *
 * This deliberately does not read the constant above once the choice has been
 * made. The whole file gets pasted over a running project to update it, and a
 * constant in the source means every update silently reverts a live system to
 * test — the recap would appear to run, the log would fill in, and no HCA
 * would ever be emailed. Script Properties survive the paste; the source does
 * not, so the source cannot be where this lives.
 */
function isTestMode_() {
  try {
    const stored = PropertiesService.getScriptProperties().getProperty("TEST_MODE");
    if (stored === "false") return false;
    if (stored === "true") return true;
  } catch (err) {
    Logger.log("Could not read the TEST_MODE property, falling back to the file: " + err);
  }
  return DAILY_RECAP_CONFIG.TEST_MODE;
}

/* Send to the ten HCAs. Survives future pastes of this file. */
function goLive() {
  PropertiesService.getScriptProperties().setProperty("TEST_MODE", "false");
  Logger.log("LIVE — the recap will go to all scheduled HCAs. " +
    "This setting now survives updates to this file.");
  return "live";
}

/* Send only to the test recipient. */
function goTest() {
  PropertiesService.getScriptProperties().setProperty("TEST_MODE", "true");
  Logger.log("TEST — only " + DAILY_RECAP_CONFIG.testRecipient +
    " will be emailed. No HCA will be contacted.");
  return "test";
}

/* Says which mode is in force and where that came from. Changes nothing. */
function showRecapMode() {
  let stored = null;
  try {
    stored = PropertiesService.getScriptProperties().getProperty("TEST_MODE");
  } catch (err) { /* reported below as unreadable */ }

  const mode = isTestMode_() ? "TEST" : "LIVE";
  const source = (stored === "true" || stored === "false")
    ? "Script Properties (survives a paste)"
    : "the TEST_MODE constant in this file (run goLive to make it stick)";
  Logger.log(mode + " — from " + source + ".");
  Logger.log(isTestMode_()
    ? "Only " + DAILY_RECAP_CONFIG.testRecipient + " is emailed."
    : "All scheduled HCAs are emailed.");
  return mode;
}

/* ---------------------------------------------------------------------------
 * Pausing someone
 *
 * For an open-ended absence — parental leave, a secondment, someone off "a week
 * or so" with no return date. The Schedule Exceptions sheet is the right tool
 * for a known set of dates; it needs a row per day, which is the wrong shape
 * when nobody knows how many days there are.
 *
 * Like TEST_MODE, this lives in Script Properties rather than in the roster
 * above, for the same reason: this file gets pasted whole over the live project
 * and anything written in the source is undone by the next update. A paused rep
 * would quietly start getting recaps again, or a returning one would stay
 * paused, and either way nobody would notice for days.
 * ------------------------------------------------------------------------- */

const PAUSED_HCAS_PROPERTY = "pausedHcas";

/* The Run dropdown calls functions with no arguments, so the name to pause
   goes here and you run pauseHcaNow / resumeHcaNow beside it. */
const PAUSE_HCA_NAME = "Trevor Bohm";
const PAUSE_HCA_REASON = "Off for a week or so";

function readPausedHcas_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(PAUSED_HCAS_PROPERTY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
  } catch (err) {
    /* Unreadable means nobody is paused, which sends an email too many rather
       than too few. A missing recap is invisible; an extra one gets answered. */
    Logger.log("Could not read the paused list, treating everyone as active: " + err);
    return {};
  }
}

function writePausedHcas_(map) {
  PropertiesService.getScriptProperties()
    .setProperty(PAUSED_HCAS_PROPERTY, JSON.stringify(map || {}));
}

function pauseHca_(name, reason) {
  const known = RECAP_ROSTER.filter(h => normName_(h.name) === normName_(name))[0];
  if (!known) {
    Logger.log("No HCA called '" + name + "' on the roster. Nothing changed. Roster is: " +
      RECAP_ROSTER.map(h => h.name).join(", "));
    return null;
  }
  const map = readPausedHcas_();
  map[known.name.toLowerCase()] = cleanReason_(reason);
  writePausedHcas_(map);
  Logger.log(known.name + " paused — no recap, no nudge, and not counted as missing. " +
    "Run resumeHcaNow to put them back.");
  return known.name;
}

function resumeHca_(name) {
  const known = RECAP_ROSTER.filter(h => normName_(h.name) === normName_(name))[0];
  const key = (known ? known.name : String(name || "")).toLowerCase();
  const map = readPausedHcas_();
  if (!map[key]) {
    Logger.log((known ? known.name : name) + " was not paused. Nothing changed.");
    return null;
  }
  delete map[key];
  writePausedHcas_(map);
  Logger.log((known ? known.name : name) + " is back on the roster from the next send.");
  return known ? known.name : name;
}

function cleanReason_(reason) {
  const text = String(reason || "").replace(/\s+/g, " ").trim();
  return text || "no reason given";
}

/* Edit PAUSE_HCA_NAME above, then run one of these. */
function pauseHcaNow() { return pauseHca_(PAUSE_HCA_NAME, PAUSE_HCA_REASON); }
function resumeHcaNow() { return resumeHca_(PAUSE_HCA_NAME); }

/* Who is paused right now. Changes nothing. */
function showPausedHcas() {
  const map = readPausedHcas_();
  const names = Object.keys(map);
  if (!names.length) {
    Logger.log("Nobody is paused — all " + RECAP_ROSTER.length + " HCAs are active.");
    return [];
  }
  names.forEach(k => {
    const hca = RECAP_ROSTER.filter(h => h.name.toLowerCase() === k)[0];
    Logger.log("PAUSED: " + (hca ? hca.name : k) + " — " + map[k]);
  });
  Logger.log("Run resumeHcaNow with PAUSE_HCA_NAME set to put someone back.");
  return names;
}

/*
 * True when a reply looks like it went to the wrong email, without claiming it
 * did.
 *
 * Reps answer by scrolling to a recap in their inbox and hitting reply, and the
 * one they land on is not always the newest. Adam ran Taylor Pearson on Friday
 * afternoon and reported it at 9:45pm — on Thursday's thread. The subject is
 * the only date signal there is, so the row files against Thursday: it inflates
 * one night and hollows out the next, and nothing about the entry looks wrong.
 *
 * What separates that from an ordinary late reply is WHEN it arrived. Answering
 * Thursday's recap on Friday morning is normal and happens most days. Answering
 * it on Friday *night*, after Friday's own recap has gone out, means a fresher
 * email was sitting there unanswered — which is the shape of a misfire.
 *
 * So all four must hold:
 *   - the reply names a night, and
 *   - it arrived on a later day than that night, and
 *   - it arrived at or after the hour that day's own recap goes out, and
 *   - that day was itself asked about, so a fresher email really did exist.
 *
 * Deliberately only a flag. A genuine late reply is indistinguishable from a
 * misdirected one at the level of content, and moving somebody's data on a
 * guess is worse than printing a line asking a human to look.
 */
function suspectWrongThread_(answersIso, received, nightsAsked) {
  if (!answersIso || !received) return false;

  const cfg = DAILY_RECAP_CONFIG;
  const receivedIso = Utilities.formatDate(received, cfg.timeZone, "yyyy-MM-dd");
  if (receivedIso <= answersIso) return false;

  const hour = Number(Utilities.formatDate(received, cfg.timeZone, "H"));
  if (!(hour >= cfg.suspectAfterHour)) return false;

  return !!(nightsAsked && nightsAsked[receivedIso]);
}

function readLastDigestRun_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty("lastDigestRunIso");
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch (err) {
    return null;
  }
}

function writeLastDigestRun_(when) {
  try {
    PropertiesService.getScriptProperties().setProperty("lastDigestRunIso", when.toISOString());
  } catch (err) {
    Logger.log("Could not record digest run time: " + (err && err.message ? err.message : String(err)));
  }
}

/*
 * Pulls one entry per appointment out of a reply body. Tolerant of extra
 * whitespace, missing fields, and reordered lines. Quoted text from the
 * original recap email is stripped first so the blank template does not get
 * parsed back as an empty entry.
 */
/* The seven prompts, in the order the template prints them. Reps who answer by
   number are answering these positions. */
const TEMPLATE_FIELD_ORDER = [
  "Customer",
  "Source (Web / Inbound / Tech Flip / Revisit)",
  "Outcome (Sold / Estimate / Follow-up)",
  "Offered (package + price)",
  "Water heater (Y/N + interest)",
  "Next follow-up",
  "Objection (if not sold)"
];

/*
 * Turns a numbered answer back into the labelled form the parser reads.
 *
 * Joseph answers like this:
 *
 *   1-Customer-Lei Huang
 *   2-Web
 *   3-Follow up
 *   4-Offered 15 & 16 SEER AmSt hp's ...
 *
 * which is the template's seven prompts answered by position. Every line of it
 * parsed to nothing, so a real appointment and seven follow-ups vanished. Reps
 * are not going to stop doing this, and it is a perfectly reasonable way to
 * answer a numbered list, so the parser meets them where they are.
 *
 * Deliberately conservative: it only engages when at least three lines start
 * with distinct numbers in 1..7 and a separator, which no prose does by
 * accident. A digit followed by a space — "2 stage furnace" — is not a numbered
 * answer and is left alone.
 */
function normalizeNumberedReply_(body) {
  const lines = String(body || "").split(/\r?\n/);
  const seen = {};
  let hits = 0;

  lines.forEach(line => {
    const m = line.match(/^\s*([1-7])\s*[-–.):]\s*\S/);
    if (m && !seen[m[1]]) { seen[m[1]] = true; hits++; }
  });
  if (hits < 3) return body;

  return lines.map(line => {
    const m = line.match(/^\s*([1-7])\s*[-–.):]\s*(.*)$/);
    if (!m) return line;

    const label = TEMPLATE_FIELD_ORDER[Number(m[1]) - 1];
    let value = m[2].trim();

    /* "1-Customer-Lei Huang" repeats the label; "2-Web" does not. Strip it only
       when it is really there, or the customer becomes "Customer-Lei Huang". */
    const firstWord = (label.split(" ")[0] || "").toLowerCase();
    const repeated = value.match(/^([A-Za-z][A-Za-z ]{0,20}?)\s*[-–:]\s*(.*)$/);
    if (repeated && repeated[1].trim().toLowerCase().indexOf(firstWord) === 0) {
      value = repeated[2].trim();
    }

    return label + ": " + value;
  }).join("\n");
}

function parseRecapReply_(rawBody) {
  const body = normalizeNumberedReply_(stripQuoted_(String(rawBody || "")));
  const entries = [];
  let current = null;
  let lastKey = null;

  const commit = () => {
    /* Anything with real content counts. Requiring a customer or an outcome
       specifically dropped blocks where the rep gave a deal and an objection
       but left the name off and the outcome blank — content worth keeping,
       and a nameless row is more honest than a silent deletion. The blank
       quoted template has no content at all, so it still yields nothing. */
    if (current && entryHasContent_(current) && !isPlaceholderValue_(current.customer)) {
      entries.push(finalizeEntry_(current));
    }
    current = null;
    lastKey = null;
  };

  body.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { lastKey = null; return; }        // blank line closes any wrapped value

    const idx = line.indexOf(":");
    const key = idx === -1 ? null : fieldKeyFor_(line.slice(0, idx).toLowerCase());

    if (key === null) {
      /* A field label can arrive without its colon. The objection prompt ends
         in "?" and reps retype or reflow it as "...completing the sale?" with
         the answer beneath, which otherwise loses both the label and the
         answer — and that prompt collects the most useful thing they write. */
      const bare = fieldKeyFor_(trimmed.toLowerCase());
      if (bare !== null && /[?:*]$/.test(trimmed)) {
        if (bare === "dayFollowUps") { commit(); return; }
        if (!current) { lastKey = null; return; }
        lastKey = bare;
        return;
      }

      /* Mail clients hard-wrap long answers, so a line carrying no field label
         is the tail of the previous answer rather than noise. Without this the
         wrapped remainder is lost. */
      if (current && lastKey && !isSignOffLine_(trimmed) && !looksLikeTemplatePrompt_(trimmed)) {
        current[lastKey] = (current[lastKey] + " " + trimmed).replace(/\s+/g, " ").trim();
      }
      return;
    }

    const value = line.slice(idx + 1).trim();

    /* Day-level and always after the last block, so it closes the appointment
       currently being built and never becomes a field on it. parseFollowUps_
       reads this section separately. */
    if (key === "dayFollowUps") { commit(); return; }

    if (key === "customer") {
      if (!value) {
        /* A Customer line still opens a new block even with no name on it.
           Reps leave the name off a second appointment, and without this its
           fields overwrite the first block one by one — the earlier deal,
           water heater and objection are replaced, the second appointment
           disappears, and what is left looks like one plausible record rather
           than a mangled pair. Harmless for the blank quoted template, whose
           empty entry fails the commit test and is dropped. */
        if (current && entryHasContent_(current)) {
          commit();
          current = blankEntry_();
        }
        lastKey = null;
        return;
      }
      if (current) commit();
      current = blankEntry_();
      current.customer = value;
      lastKey = "customer";
      return;
    }

    /* Only a real answer starts an entry. If the blank quoted template could
       instantiate one, the sign-off trailing it would append into that entry's
       last open field and surface as a phantom appointment. */
    if (!value && !current) { lastKey = null; return; }

    if (!current) current = blankEntry_();
    /* An empty value here does not mean the field went unanswered — a long
       answer wraps onto the following line, leaving the label line bare. Keep
       the field open so the continuation can fill it. */
    if (value) current[key] = value;
    lastKey = key;
  });

  commit();
  return dedupeEntries_(entries);
}

/*
 * Lines that sit next to an answer but are not part of it: sign-offs, the
 * template's own trailing instruction, and the headers reps add when they
 * number their appointments ("Appointment 2"). Each would otherwise be
 * swallowed onto the end of the answer above it.
 */
/*
 * True for a line that is part of the template's own wording rather than an
 * answer.
 *
 * The blank template comes back quoted underneath a reply, and mail clients
 * reflow its longest prompt — "If not sold — What is the objection or holdback
 * from completing the sale?:" — across two lines. The tail carries no colon, so
 * it read as the wrapped continuation of the previous answer and produced a
 * phantom appointment with no customer and a prompt for a follow-up date. Two
 * of those reached the live log before this was spotted.
 *
 * Matched on distinctive prompt wording, not on shape: no rep answers a
 * question with the question.
 */
function looksLikeTemplatePrompt_(line) {
  const l = String(line || "").toLowerCase().trim();

  /* The other half of a reflowed prompt — "the sale?:" is what is left of the
     objection question once the client has wrapped it. A short line ending in a
     colon is a label tail, never an answer. This is only reached after the
     parser has already failed to read the line as a real field, so it cannot
     swallow a legitimate one. */
  if (/^[a-z0-9\s'’—-]{0,30}\??:$/.test(l)) return true;

  return /\bif not sold\b/.test(l) ||
    /what is the objection/.test(l) ||
    /holdback from completing/.test(l) ||
    /interest level/.test(l) ||
    /package\s*[\/+]\s*tier|package \+ price/.test(l) ||
    /\bif not closed\b/.test(l) ||
    /one block per appointment/.test(l) ||
    /(repeat|paste) the block/.test(l) ||
    /who \+ what happened/.test(l);
}

function isSignOffLine_(line) {
  const l = String(line || "").replace(/^\*+\s*/, "").trim();
  if (/^appointment\s*#?\s*\d+\b/i.test(l)) return true;
  return /^(thanks|thank you|thx|regards|best|cheers|sincerely|sent from my|get outlook|repeat the block)\b/i.test(l);
}

function fieldKeyFor_(label) {
  /* Checked first: this label is day-level, not part of an appointment block,
     and it must not fall through to the follow-up DATE branch. */
  if (label.indexOf("older lead") !== -1 ||
      label.indexOf("follow-ups on") !== -1 ||
      label.indexOf("follow ups on") !== -1 ||
      /* Reps shorten the prompt to "Follow-ups today" and head their list with
         it. Plural is what separates this from the per-appointment
         "Next follow-up", so match only the plural form. */
      label.indexOf("follow-ups today") !== -1 ||
      label.indexOf("follow ups today") !== -1) return "dayFollowUps";
  if (label.indexOf("customer") !== -1) return "customer";
  /* Both the short "Source" and the older "Lead Source". */
  if (label.indexOf("source") !== -1) return "leadSource";
  /* Outcome is tested before the follow-up branch because its own prompt lists
     "Follow-up" as an option and would otherwise match there. */
  if (label.indexOf("outcome") !== -1) return "outcome";
  if (label.indexOf("water heater") !== -1) return "waterHeater";
  if (label.indexOf("objection") !== -1 || label.indexOf("holdback") !== -1) return "objection";
  /* Broad enough for "Next follow-up", "Follow-up date (if not closed)" and
     plain "Follow-up". Safe here because the day-level section and Outcome
     have both already been matched above. */
  if (label.indexOf("follow-up") !== -1 || label.indexOf("follow up") !== -1) return "followUpDate";
  if (label.indexOf("deal") !== -1 || label.indexOf("offer") !== -1) return "deal";
  return null;
}

/* Normalisation runs at commit, not per line, so a wrapped value is joined
   before it is interpreted. "scheduleing pro make an" + "appoint" has to be
   whole before the lead source can be resolved. */
function finalizeEntry_(entry) {
  ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .forEach(k => { entry[k] = cleanValue_(entry[k]); });

  entry.leadSource = entry.leadSource ? normalizeLeadSource_(entry.leadSource) : "";
  entry.outcome = entry.outcome ? normalizeOutcome_(entry.outcome) : "";
  if (entry.deal) {
    const money = parseDealAmount_(entry.deal);
    entry.dealAmount = money.amount;
    entry.dealIsMonthly = money.monthly;
  }
  return entry;
}

/*
 * Strips the decoration reps' mail clients leave behind: bold asterisks that
 * survive HTML-to-text conversion, and the square brackets of a fill-in-the-
 * blank template. Left in place these reach the log and, worse, split the
 * dedup key so "[Jane Doe]" and "Jane Doe" read as different customers.
 */
function cleanValue_(value) {
  let v = String(value === null || value === undefined ? "" : value).trim();
  v = v.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
  v = v.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();
  return v;
}

/*
 * True for an untouched template placeholder — "[CUSTOMER NAME 2]",
 * "[OUTCOME 2]". Reps paste a two-appointment template and fill in one, and
 * the leftover block would otherwise be logged as a real appointment.
 *
 * Requires an unbroken run of capitals so genuine short answers like "Y" and
 * initials are not caught.
 */
function isPlaceholderValue_(value) {
  const v = cleanValue_(value);
  if (v.length < 4) return false;
  if (/[a-z]/.test(v)) return false;
  return /[A-Z]{3,}/.test(v);
}

/*
 * Now that quoted lines are parsed too, a rep who answers above the quote AND
 * leaves answers inside it can yield the same appointment twice. Collapse by
 * customer, keeping whichever copy carries more filled-in fields.
 */
function dedupeEntries_(entries) {
  const filledCount = e => ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .reduce((n, k) => n + (e[k] ? 1 : 0), 0);

  const byKey = {}, order = [];
  entries.forEach(e => {
    const key = String(e.customer || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) { order.push(e); return; }              // unnamed: keep as-is
    if (!byKey[key]) { byKey[key] = e; order.push(e); return; }
    if (filledCount(e) > filledCount(byKey[key])) {
      order[order.indexOf(byKey[key])] = e;
      byKey[key] = e;
    }
  });
  return order;
}

/*
 * Reads the day-level follow-up section: the labelled line plus any wrapped or
 * listed lines under it, stopping at the next known field label or the
 * sign-off. Kept apart from parseRecapReply_ because this is one answer for the
 * whole day, not a property of any single appointment.
 */
function parseFollowUps_(rawBody) {
  const lines = splitQuoted_(String(rawBody || ""));
  const collected = [];
  let inSection = false;
  let startedQuoted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text;
    const trimmed = line.trim();
    const idx = line.indexOf(":");
    const key = idx === -1 ? null : fieldKeyFor_(line.slice(0, idx).toLowerCase());

    if (key === "dayFollowUps") {
      inSection = true;
      startedQuoted = lines[i].quoted;
      const rest = line.slice(idx + 1).trim();
      if (rest) collected.push(rest);
      continue;
    }

    /* The header can arrive with no colon at all — "Follow-ups today…" over a
       dashed list. Without this the whole list is read as ordinary prose and
       thrown away, which is where Joseph's seven follow-ups went. */
    if (!inSection) {
      const bare = trimmed.replace(/[…:.\s]+$/, "").toLowerCase();
      if (bare && fieldKeyFor_(bare) === "dayFollowUps") {
        inSection = true;
        startedQuoted = lines[i].quoted;
        continue;
      }
    }

    if (!inSection) continue;
    /* A list written above the quote ends where the quote begins. A list typed
       *inside* the quoted template — answering on the label line, the way Adam
       does from his iPad — is exempt, because there the quote is where the
       answer lives. */
    if (!startedQuoted && lines[i].quoted) break;
    if (key !== null) break;                       // another labelled field ends it
    if (isSignOffLine_(trimmed)) break;
    if (!trimmed) {
      /* One blank line inside a list is tolerated; two ends the section. */
      if (collected.length && collected[collected.length - 1] === "") break;
      if (collected.length) collected.push("");
      continue;
    }
    collected.push(trimmed);
  }

  return trimTrailingSignature_(collected).join("\n").replace(/\n{2,}/g, "\n").trim();
}

/*
 * Drops a name signed at the bottom of a bulleted list — "Joe R" under seven
 * dashed follow-ups. It is not a sign-off phrase, so isSignOffLine_ lets it
 * through, and it ends up in the Follow-Ups column where it reads as an eighth
 * item.
 *
 * Only fires on a list that is actually bulleted, and only on trailing lines
 * that are not. A rep who writes their follow-ups without dashes keeps every
 * line, because there nothing distinguishes a name from an entry.
 */
function trimTrailingSignature_(lines) {
  const bulleted = lines.filter(l => /^[-–•*]/.test(l)).length;
  if (bulleted < 2) return lines;

  const out = lines.slice();
  while (out.length) {
    const last = String(out[out.length - 1] || "").trim();
    if (!last) { out.pop(); continue; }
    const looksLikeName = !/^[-–•*]/.test(last) && last.length <= 24 &&
      !/\d/.test(last) && last.split(/\s+/).length <= 3 && /^[A-Za-z][A-Za-z.\s]*$/.test(last);
    if (!looksLikeName) break;
    out.pop();
  }
  return out;
}

/* Whether anything has actually been recorded against an entry yet. */
function entryHasContent_(entry) {
  if (!entry) return false;
  return ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .some(k => !!entry[k]);
}

function blankEntry_() {
  return {
    customer: "", leadSource: "", outcome: "", waterHeater: "",
    followUpDate: "", objection: "",
    deal: "", dealAmount: null, dealIsMonthly: false
  };
}

/*
 * Pulls a figure out of a free-text deal line so recap-sourced leads can carry
 * a value, which the recap otherwise has no field for.
 *
 * Comfort Club is rental-first, so reps write both shapes — "BETTER HP $18,500"
 * and "BEST DF $249/mo". Those are not comparable, so the monthly flag is kept
 * alongside the number rather than folded into it. Returns a null amount when
 * no figure is given; the raw text is always preserved either way.
 */
function parseDealAmount_(text) {
  const raw = String(text || "");
  /* "a month" and "/month" are as common as "/mo" — Joseph's "$253.99 a month
     for the hvac and hwt combo" was being summed as a one-time $253.99, which
     is not slightly wrong but wrong by two orders of magnitude in the Total
     Offered column. */
  const monthly = /\/\s*mo|\ba\s+month\b|\bper month\b|\bmonthly\b|\bmo\.\b|\/\s*month\b|\bmonth\b\s*$/i.test(raw);

  /* Dollar-marked figures win. Equipment names are full of stray numbers —
     "Silver 13 A/C package ... $14,000" and "Furnace-2 stage-$7300.00" both
     yielded the model number instead of the price when the first number in the
     line was taken. */
  const dollars = raw.match(/\$\s*\d[\d,]*(?:\.\d+)?\s*k?/gi);
  if (dollars && dollars.length) {
    /* Reps quote multi-item deals on one line ("$7300.00 & ... $3450.00"), and
       the figure worth recording is what was put in front of the customer in
       total, so every dollar amount on the line is summed. */
    let total = 0, any = false;
    dollars.forEach(d => {
      const m = d.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k?)/i);
      if (!m) return;
      let n = Number(String(m[1]).replace(/,/g, ""));
      if (!isFinite(n)) return;
      if (m[2]) n = n * 1000;
      total += n; any = true;
    });
    if (any) return { amount: total, monthly: monthly };
  }

  /* No dollar signs at all. Reps still quote multi-item deals this way
     ("full system/20k - water heater 3500"), so the same summing applies —
     but only to figures that could plausibly be prices. A k suffix, comma
     grouping, or four-plus digits qualifies; everything shorter is left
     alone, which is what keeps "2 stage", "Silver 13" and "50 gallon" out
     of the totals. */
  let total = 0, any = false;

  (raw.match(/\b\d+(?:\.\d+)?\s*k\b/gi) || []).forEach(t => {
    const v = Number(String(t).replace(/\s*k$/i, ""));
    if (isFinite(v)) { total += v * 1000; any = true; }
  });

  const withoutK = raw.replace(/\b\d+(?:\.\d+)?\s*k\b/gi, " ");
  (withoutK.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,}(?:\.\d+)?\b/g) || []).forEach(t => {
    const v = Number(String(t).replace(/,/g, ""));
    if (isFinite(v)) { total += v; any = true; }
  });

  return { amount: any ? total : null, monthly: monthly };
}

/*
 * Unwraps quote markers rather than discarding quoted lines.
 *
 * Reps on phones routinely answer INSIDE the quoted original — their own
 * message body is just a signature, and every filled-in field sits behind a
 * "> ". Dropping quoted lines threw those replies away entirely.
 *
 * Keeping them is safe because the parser skips fields with no value, so the
 * blank template that comes back in the quote contributes nothing. Answers
 * typed above the quote and answers typed inside it both parse.
 */
/*
 * Just the rep's own words — everything before the quoted original. Used when
 * a reply parses to no appointments, so a free-text answer ("no appointments,
 * 3 follow-ups") still reaches the digest instead of vanishing.
 */
function ownText_(body) {
  const kept = [];
  const lines = String(body || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*>/.test(line)) break;
    if (/^\s*On\s.+\swrote:\s*$/.test(line)) break;
    if (/^\s*On\s.+<[^>]*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    kept.push(line);
  }
  /* "Sent from my iPad" is not an answer. Adam's replies are two lines, one of
     which is always that, and it used to ride into the Follow-ups column. */
  while (kept.length && (!kept[kept.length - 1].trim() || isSignOffLine_(kept[kept.length - 1]))) {
    kept.pop();
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* A reply whose whole content is "None" — the count already says that, so it
   is not worth a line in the Follow-ups column. */
function isBareNone_(text) {
  return /^(none|none\s*ran|no\s*appointments?|n\/a|na)[.!]?$/i.test(String(text || "").trim());
}

/*
 * Every line un-prefixed, paired with whether it arrived inside the quoted
 * original. Callers that only want the text use stripQuoted_; parseFollowUps_
 * needs the quoted flag to know where a rep's own words stop.
 *
 * Attribution lines are dropped, including the wrapped form Gmail produces
 * when the sender line runs long:
 *
 *   On Sat, Aug 1, 2026, 6:05 PM CM Heating Sales Operations <
 *   geoffrey.simons@cmheating.com> wrote:
 *
 * Neither half matches the single-line patterns, so both used to survive into
 * whatever section was open. Samir's four follow-ups came back with that
 * attribution and the first two lines of our own template stapled to the end.
 */
function splitQuoted_(body) {
  const out = [];
  const lines = String(body || "").split(/\r?\n/);
  let dangling = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const quoted = /^\s*>/.test(line);
    const bare = line.replace(/^\s*(?:>\s?)+/, "");

    if (dangling) {
      dangling = false;
      if (/^\s*[^\s<>]+@[^\s<>]+>\s*wrote:\s*$/i.test(bare)) continue;
    }
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(bare)) continue;
    if (/^\s*wrote:\s*$/i.test(bare)) continue;
    if (/^\s*On\s.+<[^>]+@[^>]+>\s*$/.test(bare)) continue;
    if (/^\s*On\s.+\swrote:\s*$/.test(bare)) continue;
    if (/^\s*On\s.+<\s*$/.test(bare)) { dangling = true; continue; }

    out.push({ text: bare, quoted: quoted });
  }
  return out;
}

function stripQuoted_(body) {
  return splitQuoted_(body).map(l => l.text).join("\n");
}

function normalizeLeadSource_(value) {
  const v = value.trim().toUpperCase();
  if (v.indexOf("TF") === 0 || v.indexOf("TECH") !== -1) return "Tech Flip";
  /* Scheduling Pro is ServiceTitan's online booking, so it is a Web lead.
     Reps write it out because that is what the booking says. */
  if (v.indexOf("SCHEDUL") !== -1 || v.indexOf("SCHED PRO") !== -1 || v.indexOf("ONLINE") !== -1) return "Web";
  if (v.indexOf("W") === 0 || v.indexOf("WEB") !== -1) return "Web";
  if (v.indexOf("I") === 0 || v.indexOf("INBOUND") !== -1) return "Inbound";
  if (v.indexOf("R") === 0 || v.indexOf("REVISIT") !== -1) return "Revisit";
  return value.trim();
}

function normalizeOutcome_(value) {
  const v = value.trim().toUpperCase();
  if (v.indexOf("SOLD") !== -1 || v === "S") return "SOLD";
  if (v.indexOf("ESTIMATE") !== -1 || v === "E") return "ESTIMATE";
  if (v.indexOf("FOLLOW") !== -1 || v === "F") return "FOLLOW-UP NEEDED";
  return value.trim().toUpperCase();
}

function buildDigestBody_(plan, byHca, missing, late, logResult, notesOnly, followUpsByHca) {
  const lines = [];
  lines.push("Recap digest for " + plan.dateLabel + " (" + plan.weekday + ")");
  if (isTestMode_()) {
    lines.push("");
    lines.push("TEST MODE is on — tonight's recap went only to " + DAILY_RECAP_CONFIG.testRecipient + ",");
    lines.push("so replies from HCAs are not expected yet.");
  }
  lines.push("");

  const names = Object.keys(byHca).sort();
  if (!names.length) {
    lines.push("No replies parsed.");
  } else {
    names.forEach(name => {
      const group = byHca[name];
      lines.push(new Array(60).join("-"));
      lines.push(name + " — " + group.entries.length + " appointment(s)");
      lines.push("");
      group.entries.forEach(e => {
        lines.push("  [" + (e.outcome || "NO OUTCOME GIVEN") + "] " + (e.customer || "(customer not named)"));
        if (e.leadSource)   lines.push("      Lead source:  " + e.leadSource);
        if (e.deal)         lines.push("      Deal offered: " + e.deal);
        if (e.waterHeater)  lines.push("      Water heater: " + e.waterHeater);
        if (e.followUpDate) lines.push("      Follow-up:    " + e.followUpDate);
        if (e.outcome !== "SOLD" && e.objection) lines.push("      Objection:    " + e.objection);
        if (e.outcome !== "SOLD" && !e.objection) lines.push("      Objection:    (not provided)");
        lines.push("");
      });

      const totals = sumDeals_(group.entries);
      if (totals.oneTime || totals.monthly) {
        const parts = [];
        if (totals.oneTime) parts.push("$" + formatMoney_(totals.oneTime) + " one-time");
        if (totals.monthly) parts.push("$" + formatMoney_(totals.monthly) + "/mo rental");
        lines.push("      Offered today: " + parts.join("  +  ") +
          (totals.missing ? "   (" + totals.missing + " with no figure given)" : ""));
        lines.push("");
      }
    });
  }

  const fuNames = followUpsByHca ? Object.keys(followUpsByHca).sort() : [];
  if (fuNames.length) {
    lines.push(new Array(60).join("-"));
    lines.push("Follow-ups on older leads (" + fuNames.length + "):");
    fuNames.forEach(name => {
      lines.push("");
      lines.push("  " + name + " —");
      String(followUpsByHca[name]).split(/\r?\n/).forEach(l => lines.push("      " + l));
    });
    lines.push("");
  }

  const noteNames = notesOnly ? Object.keys(notesOnly).sort() : [];
  if (noteNames.length) {
    lines.push(new Array(60).join("-"));
    lines.push("Replied, no appointments reported (" + noteNames.length + "):");
    noteNames.forEach(name => {
      lines.push("");
      lines.push("  " + name + " —");
      String(notesOnly[name].note).split(/\r?\n/).forEach(l => lines.push("      " + l));
    });
    lines.push("");
  }

  lines.push(new Array(60).join("="));
  if (missing.length) {
    lines.push("Scheduled today but no reply (" + missing.length + "):");
    missing.forEach(h => lines.push("  - " + h.name));
  } else if (plan.working.length) {
    lines.push("All " + plan.working.length + " scheduled HCAs replied.");
  }
  if (missing.length && noteNames.length) {
    lines.push("(Those above did not reply at all. The " + noteNames.length +
      " listed as reporting no appointments did reply.)");
  }

  if (late && late.length) {
    lines.push("");
    lines.push("Late replies to earlier recaps (" + late.length + ") —");
    lines.push("came in after that night's digest had already gone out:");
    late.forEach(r => {
      lines.push("");
      lines.push("  " + r.hca.name + "  (" + r.subject + ")");
      r.entries.forEach(e => {
        lines.push("    [" + (e.outcome || "NO OUTCOME GIVEN") + "] " + (e.customer || "(customer not named)"));
        if (e.outcome !== "SOLD" && e.objection) lines.push("        Objection: " + e.objection);
      });
    });
    lines.push("");
    lines.push("These are logged against the night they answer, so the 1:1 page");
    lines.push("sees them in the right place.");

    const suspect = late.filter(r => r.suspectDate);
    if (suspect.length) {
      lines.push("");
      lines.push("CHECK THE DATE ON THESE (" + suspect.length + ") —");
      lines.push("each arrived after that evening's own recap had gone out, so a newer");
      lines.push("email was sitting unanswered. Likely a reply to the wrong one.");
      lines.push("Nothing has been moved; the rows are filed as the subject says.");
      suspect.forEach(r => {
        lines.push("");
        lines.push("  " + r.hca.name + " — filed against " + r.answersLabel);
        lines.push("      arrived " + r.receivedAt + " on " + r.receivedIso);
        r.entries.forEach(e => lines.push("      " + (e.customer || "(unnamed)")));
      });
    }
  }

  if (!plan.exceptions.ok) {
    lines.push("");
    lines.push("Note: Schedule Exceptions sheet could not be read today, so the");
    lines.push("scheduled-HCA list above is based on base schedules only.");
    lines.push("Error: " + plan.exceptions.error);
  }

  if (logResult) {
    lines.push("");
    if (logResult.ok) {
      if (logResult.created) lines.push("Recap log created — this is day one.");
      lines.push(logResult.written + " row(s) written to the log" +
        (logResult.skipped ? ", " + logResult.skipped + " already recorded" : "") + ".");
      if (logResult.lateWritten) {
        lines.push("  of those, " + logResult.lateWritten + " backfilled from late replies.");
      }
      if (logResult.lateMarked && logResult.lateMarked.length) {
        lines.push("  marked Late on the compliance tab: " + logResult.lateMarked.join(", ") + ".");
      }
      if (logResult.lateUndated) {
        lines.push("  " + logResult.lateUndated + " late repl(ies) had no date on the thread " +
          "and could not be filed — see the list above.");
      }
      if (logResult.url) lines.push(logResult.url);
    } else {
      lines.push("Recap log NOT updated — the digest above is the only record of tonight.");
      lines.push("Error: " + logResult.error);
    }
  }

  return lines.join("\n");
}

/* ------------------------------------------------------------------- sheet */

const RECAP_LOG_HEADERS = [
  "Date", "HCA", "Customer", "Lead Source", "Outcome",
  "Deal Offered", "Deal Amount", "Deal Unit",
  "Water Heater", "Follow-up Date", "Objection",
  "Logged At", "Key"
];

const COMPLIANCE_HEADERS = ["Date", "HCA", "Replied", "Appointments Reported", "Follow-ups On Older Leads", "Logged At"];

/*
 * One row per appointment, append-only. That grain is what makes the log
 * pivotable later — anything coarser throws away the detail the recap exists
 * to capture.
 *
 * The Key column is date + HCA + customer, and existing keys are read before
 * writing. The collector runs nightly and can see the same reply again through
 * the late-reply path, so writes have to be idempotent or the log silently
 * inflates.
 */
function appendRecapRows_(ss, plan, byHca) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.logSheetName, RECAP_LOG_HEADERS);
  const existing = readExistingKeys_(sheet, RECAP_LOG_HEADERS.length);
  const stamp = new Date();
  const rows = [];
  let skipped = 0;

  Object.keys(byHca).sort().forEach(name => {
    byHca[name].entries.forEach(e => {
      const key = recapRowKey_(plan.isoDate, name, e.customer);
      if (existing[key]) { skipped++; return; }
      existing[key] = true;
      rows.push([
        plan.isoDate,
        name,
        e.customer || "",
        e.leadSource || "",
        e.outcome || "",
        e.deal || "",
        (e.dealAmount === null || e.dealAmount === undefined) ? "" : e.dealAmount,
        e.deal ? (e.dealIsMonthly ? "Monthly" : "One-time") : "",
        e.waterHeater || "",
        e.followUpDate || "",
        e.objection || "",
        stamp,
        key
      ]);
    });
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RECAP_LOG_HEADERS.length).setValues(rows);
  }
  return { written: rows.length, skipped: skipped };
}

/*
 * Who was scheduled and whether they answered, one row per HCA per day. Kept
 * apart from the appointment log because a non-reply has no appointment to
 * hang off, and mixing the two would corrupt every count taken over the log.
 */
function appendComplianceRows_(ss, plan, byHca, responded, followUpsByHca) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.complianceSheetName, COMPLIANCE_HEADERS);
  const existing = readExistingKeys_(sheet, COMPLIANCE_HEADERS.length, 0, 1);
  const stamp = new Date();
  const rows = [];

  plan.working.forEach(hca => {
    const key = plan.isoDate + "|" + hca.name.toLowerCase();
    if (existing[key]) return;
    existing[key] = true;
    const group = byHca[hca.name];
    /* Replied is about whether they answered, not whether they had anything to
       report. A rep with no appointments still replied. */
    const didReply = responded ? !!responded[hca.name] : !!group;
    rows.push([
      plan.isoDate,
      hca.name,
      didReply ? "Yes" : "No",
      group ? group.entries.length : 0,
      (followUpsByHca && followUpsByHca[hca.name]) ? followUpsByHca[hca.name] : "",
      stamp
    ]);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, COMPLIANCE_HEADERS.length).setValues(rows);
  }
  return { written: rows.length };
}

/*
 * Files every reply in the lookback window against the night it answers, and
 * sends nothing.
 *
 * The nightly collection is a snapshot at 8:15pm. Reps answer at 9, at 11, the
 * next morning from the truck. Until this ran hourly, all of that sat in Gmail
 * until the next digest happened to notice it, and a 1:1 at 10am read a log
 * that said the rep had reported nothing.
 *
 * Safe to run as often as you like: every write is keyed on date + HCA +
 * customer and existing keys are read first, so a reply seen ten times lands
 * once. It never emails, so it cannot double-nudge anyone either.
 */
function sweepRecapReplies() {
  const cfg = DAILY_RECAP_CONFIG;
  const plan = buildTodayPlan_(new Date());
  const res = findRecapReplies_(plan.dateLabel, null, cfg.replyLookbackDays, true);

  if (!res.ok) {
    Logger.log("Reply sweep skipped — Gmail search failed. Nothing written.");
    return { ok: false, written: 0, skipped: 0, marked: [] };
  }

  let out = { ok: true, written: 0, skipped: 0, undated: 0, marked: [], reconciled: false };
  try {
    const book = getLogSpreadsheet_();
    const logged = logRepliesByNight_(book.ss, res.replies);
    out = {
      ok: true, written: logged.written, skipped: logged.skipped,
      undated: logged.undated, marked: logged.marked, reconciled: false
    };
  } catch (err) {
    Logger.log("Reply sweep could not write: " + (err && err.message ? err.message : String(err)));
    return { ok: false, written: 0, skipped: 0, marked: [], reconciled: false };
  }

  /* Writing the Recap Log is only half of it. Job Status is the reconciled view
     the 1:1 page reads, and it is built from the log rather than watching it —
     so without this a reply logged at 11am would not reach the 1:1 until the
     10pm rebuild. Only when something actually changed: a rebuild costs several
     Gmail searches and most hours the sweep writes nothing. */
  if (out.written || out.marked.length) {
    try {
      refreshJobStatus();
      out.reconciled = true;
    } catch (err) {
      /* The log is already written and correct. A reconciliation that failed
         will be retried on the next sweep and again tonight. */
      Logger.log("Sweep wrote rows but Job Status refresh failed: " +
        (err && err.message ? err.message : String(err)));
    }
  }

  const suspect = res.replies.filter(r => r.suspectDate);
  suspect.forEach(r => Logger.log(
    "CHECK THE DATE — " + r.hca.name + " filed against " + r.answersLabel +
    " but replied " + r.receivedAt + " on " + r.receivedIso + ", after that " +
    "evening's own recap went out. Nothing moved."));

  Logger.log("Reply sweep: " + res.replies.length + " repl(ies) seen, " +
    out.written + " new row(s) logged, " + out.skipped + " already there" +
    (out.marked.length ? ", marked Late: " + out.marked.join(", ") : "") +
    (suspect.length ? ", " + suspect.length + " to date-check" : "") +
    (out.reconciled ? ", Job Status rebuilt" : "") + ".");
  out.suspectDates = suspect.map(r => r.hca.name + " -> " + r.answersLabel);
  return out;
}

const RECAP_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/* "Thursday, July 30, 2026" -> "2026-07-30". Returns "" on anything else so a
   caller can tell a real date from a subject that lost its label. */
function isoFromDateLabel_(label) {
  const m = String(label || "").match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return "";
  const month = RECAP_MONTH_NAMES.indexOf(m[1]);
  if (month === -1) return "";
  const day = Number(m[2]);
  if (!(day >= 1 && day <= 31)) return "";
  return m[3] + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

/*
 * A reply that arrives after its own night's digest still has to reach the log
 * — the log is what the 1:1 page reads, and a rep who answered at 11pm should
 * not show up at the 1:1 as having said nothing.
 *
 * The row goes against the night it answers, not the night we noticed it, and
 * the Key column makes the write idempotent: the same reply seen by tonight's
 * run and by a later backfill lands once.
 *
 * Compliance is updated in place rather than appended. The row for that night
 * already exists and says "No"; it becomes "Late", which is the truth and is
 * distinguishable from someone who answered on time.
 */
function logRepliesByNight_(ss, replies) {
  const byDate = {};
  replies.forEach(r => {
    if (!r.answersIso) return;              // no date on the thread, nothing to key on
    const bucket = byDate[r.answersIso] || (byDate[r.answersIso] = {});
    const group = bucket[r.hca.name] || (bucket[r.hca.name] = { hca: r.hca, entries: [], followUps: "" });
    group.entries = group.entries.concat(r.entries);
    /* A rep who answers in prose rather than under the follow-ups header still
       said something. findRecapReplies_ only sets note when there were no
       entries and no follow-ups, so this cannot displace a real answer —
       without it Joseph's "None, picked up check from Sara Conroy" reached the
       digest and then died there, leaving the sheet blank. */
    const note = isBareNone_(r.note) ? "" : r.note;
    const text = r.followUps || note || "";
    if (text) group.followUps = group.followUps ? group.followUps + "\n" + text : text;
  });

  let written = 0;
  let skipped = 0;
  let undated = replies.filter(r => !r.answersIso).length;
  const marked = [];

  Object.keys(byDate).sort().forEach(iso => {
    const res = appendRecapRows_(ss, { isoDate: iso }, byDate[iso]);
    written += res.written;
    skipped += res.skipped;

    Object.keys(byDate[iso]).forEach(name => {
      const group = byDate[iso][name];
      if (markComplianceLate_(ss, iso, name, group.entries.length, group.followUps)) {
        marked.push(iso + " " + name);
      }
    });
  });

  return { written: written, skipped: skipped, undated: undated, marked: marked };
}

/*
 * Brings one compliance row up to date with what the rep has actually said.
 *
 * Two separate things live in this row and they move independently:
 *
 *   Replied — only ever goes No -> Late. Someone already recorded as having
 *     answered stays as they were; a later message is not a second report and
 *     must not downgrade an on-time "Yes" to "Late".
 *
 *   Appointments Reported — always reconciled upward to the true count. This
 *     is the case that caught us out live: Kyle asked a question in the
 *     morning, which counted as a reply and wrote Yes with zero appointments,
 *     then sent his real recap hours later. Returning early on "Yes" left the
 *     count at zero forever while the log underneath held a real appointment,
 *     so every rollup off this column quietly undercounted him.
 *
 * Upward only, because a later pass that parses fewer entries — a truncated
 * body, a Gmail hiccup — must not erase a count that was right.
 */
function markComplianceLate_(ss, isoDate, hcaName, entryCount, followUps) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.complianceSheetName, COMPLIANCE_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, COMPLIANCE_HEADERS.length).getValues();
  const wantName = String(hcaName).toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const rowIso = values[i][0] instanceof Date
      ? Utilities.formatDate(values[i][0], DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")
      : String(values[i][0] || "").trim();
    if (rowIso !== isoDate) continue;
    if (String(values[i][1] || "").trim().toLowerCase() !== wantName) continue;

    const row = i + 2;
    const replied = String(values[i][2] || "").trim().toLowerCase();
    const alreadyAnswered = replied === "yes" || replied === "late";
    let changed = false;

    if (!alreadyAnswered) {
      sheet.getRange(row, 3).setValue("Late");
      changed = true;
    }

    const recorded = Number(values[i][3]);
    const known = Number.isFinite(recorded) ? recorded : 0;
    if (entryCount > known) {
      sheet.getRange(row, 4).setValue(entryCount);
      changed = true;
    }

    if (followUps) {
      const existingFollowUps = String(values[i][4] || "").trim();
      if (existingFollowUps.indexOf(followUps) === -1) {
        sheet.getRange(row, 5).setValue(
          existingFollowUps ? existingFollowUps + "\n" + followUps : followUps);
        changed = true;
      }
    }

    if (changed) sheet.getRange(row, 6).setValue(new Date());
    return changed;
  }
  return false;
}

function recapRowKey_(isoDate, hcaName, customer) {
  const c = String(customer || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return isoDate + "|" + String(hcaName).toLowerCase() + "|" + c;
}

/* Reads keys already present so a re-run cannot double-write. Either the
   dedicated Key column, or a composite of two columns when there is none. */
function readExistingKeys_(sheet, width, colA, colB) {
  const seen = {};
  const last = sheet.getLastRow();
  if (last < 2) return seen;

  const values = sheet.getRange(2, 1, last - 1, width).getValues();
  values.forEach(row => {
    if (colA === undefined) {
      const k = String(row[width - 1] || "").trim();
      if (k) seen[k] = true;
    } else {
      const a = String(row[colA] || "").trim();
      const b = String(row[colB] || "").trim().toLowerCase();
      if (a && b) seen[a + "|" + b] = true;
    }
  });
  return seen;
}

/*
 * Column widths, wrapping and number formats, reapplied on every refresh.
 *
 * Not cosmetic. The first live log rendered the Date column at default width,
 * so every row read "2026" — the one column you scan first, unreadable. Long
 * free-text fields (Deal Offered, Objection, what the rep actually said) were
 * clipped at the cell edge, which is exactly the content the recap exists to
 * capture.
 *
 * Reapplied rather than set once at creation so it survives anyone dragging a
 * column, and so tabs added later pick it up without a migration.
 */
const SHEET_LAYOUTS = {
  "Recap Log": {
    widths: [95, 140, 190, 100, 150, 280, 110, 90, 180, 160, 340, 140, 0],
    wrap: [5, 8, 10],                 // Deal Offered, Water Heater, Objection
    money: [6],
    hide: [12]                        // Key — machine-only
  },
  "Follow-Ups": {
    widths: [95, 130, 140, 190, 150, 260, 110, 340, 140, 95, 90, 200, 0],
    wrap: [7, 11],
    money: [6],
    hide: [12]
  },
  "Reply Compliance": {
    widths: [95, 140, 80, 110, 380, 140],
    wrap: [4], money: [], hide: []
  },
  "Email Notes": {
    widths: [95, 130, 190, 105, 150, 240, 460, 90, 0],
    wrap: [6], money: [], hide: [8]
  },
  "Job Status": {
    widths: [95, 130, 190, 85, 150, 130, 110, 120, 130, 120, 130, 90, 130,
             70, 110, 90, 85, 170, 120, 120, 120, 240, 130, 300, 300, 140, 0],
    wrap: [21, 23, 24],
    money: [14], hide: [26]
  },
  /* Two blocks side by side: the reported appointments in A-H, the reply
     picture in J-N, with I left narrow as the gutter between them. */
  "Today": {
    widths: [95, 140, 190, 150, 280, 110, 120, 300, 24, 95, 140, 80, 110],
    wrap: [], money: [5], hide: [], plain: true
  }
};

function applySheetLayout_(ss, name) {
  const layout = SHEET_LAYOUTS[name];
  const sheet = ss.getSheetByName(name);
  if (!layout || !sheet) return;
  try {
    const lastRow = Math.max(sheet.getLastRow(), 2);
    layout.widths.forEach((w, i) => {
      if (w === 0) { sheet.hideColumns(i + 1); return; }
      sheet.setColumnWidth(i + 1, w);
    });
    (layout.wrap || []).forEach(i => {
      sheet.getRange(2, i + 1, lastRow - 1, 1).setWrap(true).setVerticalAlignment("top");
    });
    (layout.money || []).forEach(i => {
      sheet.getRange(2, i + 1, lastRow - 1, 1).setNumberFormat('$#,##0');
    });
    /* A "plain" tab is not one table with one header row — Today has a title,
       a caption and two blocks side by side — so a frozen header and banding
       across the whole width would both be wrong there. */
    if (layout.plain) return;

    sheet.setFrozenRows(1);
    /* Banded rows make a wide sheet scannable across, which is how anyone
       actually reads a row here. */
    if (!sheet.getBandings().length && lastRow > 1) {
      sheet.getRange(1, 1, lastRow, layout.widths.length)
        .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    }
  } catch (err) {
    /* Formatting must never cost a refresh its data. */
    Logger.log("Layout skipped for " + name + ": " + err);
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/*
 * Resolves the log spreadsheet, creating it the first time. The id lives in
 * Script Properties rather than in this file so redeploying the script cannot
 * orphan the existing log.
 */
function getLogSpreadsheet_() {
  const cfg = DAILY_RECAP_CONFIG;
  const props = PropertiesService.getScriptProperties();
  const id = cfg.logSpreadsheetId || props.getProperty("logSpreadsheetId");

  if (id) {
    try {
      return { ss: SpreadsheetApp.openById(id), created: false };
    } catch (err) {
      Logger.log("Stored log spreadsheet unreachable, creating a new one: " + err);
    }
  }

  const ss = SpreadsheetApp.create(cfg.logSpreadsheetTitle);
  props.setProperty("logSpreadsheetId", ss.getId());

  ensureSheet_(ss, cfg.logSheetName, RECAP_LOG_HEADERS);
  ensureSheet_(ss, cfg.complianceSheetName, COMPLIANCE_HEADERS);
  installSummaryFormulas_(ss);
  installTodayFormulas_(ss);

  /* A brand new spreadsheet still carries the default empty "Sheet1". */
  const first = ss.getSheetByName("Sheet1");
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);

  sendEmailSafe_({
    to: [cfg.managerEmail],
    subject: "Daily Recap log created",
    body: "The recap log spreadsheet has been created and will fill in from tonight:\n\n" +
      ss.getUrl() + "\n\n" +
      "Tabs:\n" +
      "  " + cfg.logSheetName + " — one row per appointment reported\n" +
      "  " + cfg.complianceSheetName + " — who was scheduled and whether they replied\n" +
      "  " + cfg.todaySheetName + " — today and yesterday, live; updates itself\n" +
      "  " + cfg.summarySheetName + " — per-HCA rollup, formula-driven\n"
  });

  return { ss: ss, created: true };
}

/*
 * The live view of the last two days.
 *
 * This is the answer to "should the daily sales sheet be a live document" — it
 * already is one. Every cell here is a formula over the Recap Log and the
 * compliance tab, so Sheets recalculates it on its own: when the hourly sweep
 * writes a late reply underneath, an open tab shows it without anyone running
 * anything, and nothing can drift out of step with the log because there is no
 * copy of the data.
 *
 * Two days rather than one, because a reply that lands at 11am is answering
 * yesterday. That is the whole case for the tab: the night's digest is a
 * snapshot at 8:15pm and the picture keeps changing after it.
 */
/*
 * Puts the formula tabs back if they are missing, and does nothing at all when
 * they are already there. Called on the scheduled paths, so a tab someone
 * deleted comes back on its own without the formulas being rewritten every
 * hour underneath whoever is reading them.
 */
function ensureLiveTabs_(ss) {
  const cfg = DAILY_RECAP_CONFIG;
  try {
    if (!ss.getSheetByName(cfg.todaySheetName)) installTodayFormulas_(ss);
    if (!ss.getSheetByName(cfg.summarySheetName)) installSummaryFormulas_(ss);
  } catch (err) {
    Logger.log("Could not ensure the live tabs: " + (err && err.message ? err.message : String(err)));
  }
}

/* Forces both formula tabs to be rebuilt, whether or not they exist. Run this
   once after pasting this script over an older version to get the Today tab. */
function installLiveTabs() {
  const book = getLogSpreadsheet_();
  installTodayFormulas_(book.ss);
  installSummaryFormulas_(book.ss);
  applySheetLayout_(book.ss, DAILY_RECAP_CONFIG.todaySheetName);
  Logger.log("Today and Summary rebuilt: " + book.ss.getUrl());
  return book.ss.getUrl();
}

function installTodayFormulas_(ss) {
  const cfg = DAILY_RECAP_CONFIG;
  const sheet = ensureSheet_(ss, cfg.todaySheetName, ["Today"]);
  const log = "'" + cfg.logSheetName + "'";
  const comp = "'" + cfg.complianceSheetName + "'";

  /* The Date columns hold ISO strings, so the comparison has to be against a
     string too — a bare TODAY() would compare a date to text and match
     nothing. */
  const from = 'TEXT(TODAY()-1,"yyyy-mm-dd")';
  const today = 'TEXT(TODAY(),"yyyy-mm-dd")';

  sheet.getRange("A1").setValue("Today and yesterday — live").setFontWeight("bold");
  sheet.getRange("A2").setValue(
    "Formulas, not a snapshot. The hourly sweep writes late replies underneath and " +
    "this updates itself — leave the tab open if you like.");

  sheet.getRange("A4").setValue("Appointments reported").setFontWeight("bold");
  sheet.getRange("A5").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select A,B,C,E,F,G,J,K where A >= \'"&' + from +
    '&"\' order by A desc, B", 0), "Nothing reported yet for today or yesterday.")'
  );

  sheet.getRange("J4").setValue("Who has answered").setFontWeight("bold");
  sheet.getRange("J5").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:F, "select A,B,C,D where A >= \'"&' + from +
    '&"\' order by A desc, C, B", 0), "No compliance rows yet.")'
  );

  /* The only question that matters at 9am: who still owes a recap. "Late" is
     answered, so it is deliberately not in this list. */
  sheet.getRange("J20").setValue("Still owed").setFontWeight("bold");
  sheet.getRange("J21").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:F, "select A,B where C = \'No\' and A >= \'"&' + from +
    '&"\' order by A desc, B", 0), "Nobody — everyone scheduled has answered.")'
  );

  sheet.getRange("J28").setValue("Answered late").setFontWeight("bold");
  sheet.getRange("J29").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:F, "select A,B,D where C = \'Late\' and A >= \'"&' + from +
    '&"\' order by A desc, B", 0), "None — everything came in on the night.")'
  );

  sheet.getRange("A2").setFontColor("#666666");
  sheet.getRange("E1").setFormula('="Recalculated "&TEXT(NOW(),"ddd d mmm, h:mm am/pm")');
  sheet.getRange("E1").setFontColor("#666666");

  /* Counts, so the shape of the day reads without scrolling. */
  sheet.getRange("A3").setFormula(
    '=IFERROR("Reported so far today: "&COUNTIF(' + log + '!A2:A,' + today + ')&' +
    '"    |    yesterday: "&COUNTIF(' + log + '!A2:A,' + from + '),"")'
  );
  sheet.getRange("A3").setFontColor("#666666");
}

/*
 * The rollup is formulas rather than generated rows, so it recalculates on its
 * own and cannot drift from the log. If someone clears it, the log underneath
 * is untouched.
 */
function installSummaryFormulas_(ss) {
  const cfg = DAILY_RECAP_CONFIG;
  const sheet = ensureSheet_(ss, cfg.summarySheetName, ["Per-HCA rollup"]);
  const log = "'" + cfg.logSheetName + "'";
  const comp = "'" + cfg.complianceSheetName + "'";

  sheet.getRange("A1").setValue("Per-HCA rollup — all time").setFontWeight("bold");
  sheet.getRange("A2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select B, count(C), sum(G) where B is not null group by B label B \'HCA\', count(C) \'Appointments\', sum(G) \'Total Offered\'", 0), "No data yet")'
  );

  sheet.getRange("A12").setValue("Outcomes").setFontWeight("bold");
  sheet.getRange("A13").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select E, count(C) where E is not null group by E label E \'Outcome\', count(C) \'Count\'", 0), "No data yet")'
  );

  sheet.getRange("E12").setValue("Lead sources").setFontWeight("bold");
  sheet.getRange("E13").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select D, count(C) where D is not null group by D label D \'Lead Source\', count(C) \'Count\'", 0), "No data yet")'
  );

  sheet.getRange("A24").setValue("Reply rate by HCA").setFontWeight("bold");
  sheet.getRange("A25").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:E, "select B, count(C) where B is not null group by B label B \'HCA\', count(C) \'Days Scheduled\'", 0), "No data yet")'
  );
  sheet.getRange("D24").setValue("Days with no reply").setFontWeight("bold");
  sheet.getRange("D25").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:E, "select B, count(C) where C = \'No\' group by B label B \'HCA\', count(C) \'Missed\'", 0), "None")'
  );

  return sheet;
}

/* ------------------------------------------------------------- scheduling */

function buildTodayPlan_(now) {
  const cfg = DAILY_RECAP_CONFIG;
  const weekday = Utilities.formatDate(now, cfg.timeZone, "EEEE");
  const dateLabel = Utilities.formatDate(now, cfg.timeZone, "EEEE, MMMM d, yyyy");
  const isoDate = Utilities.formatDate(now, cfg.timeZone, "yyyy-MM-dd");

  const exceptions = readExceptionsForDate_(isoDate);
  const paused = readPausedHcas_();
  const working = [];
  const skipped = [];

  RECAP_ROSTER.forEach(hca => {
    const ex = exceptions.byName[hca.name.toLowerCase()];
    const scheduled = hca.days.indexOf(weekday) !== -1;
    const type = ex ? String(ex.type || "").trim().toLowerCase() : "";

    /* Checked before anything else: a pause is a standing decision about a
       person and outranks whatever a single day's exception row says. */
    const pause = paused[hca.name.toLowerCase()];
    if (pause) {
      skipped.push({ name: hca.name, reason: "Paused" + (pause ? " — " + pause : "") });
      return;
    }

    if (type === "sick" || type === "vacation") {
      skipped.push({ name: hca.name, reason: titleCase_(type) + (ex.notes ? " — " + ex.notes : "") });
      return;
    }
    if (type === "swap") {
      working.push(Object.assign({}, hca, { note: "Swap" + (ex.notes ? " — " + ex.notes : "") }));
      return;
    }
    if (scheduled) working.push(Object.assign({}, hca, { note: "" }));
    else skipped.push({ name: hca.name, reason: "not scheduled " + weekday });
  });

  return { weekday, dateLabel, isoDate, working, skipped, exceptions };
}

/*
 * Reads Sick / Vacation / Swap rows for one date.
 * Returns ok:false with the error rather than throwing, so a sheet problem
 * degrades to "base schedule + a loud warning" instead of killing the send.
 */
function readExceptionsForDate_(isoDate) {
  const cfg = DAILY_RECAP_CONFIG;
  const result = { ok: false, error: "", count: 0, byName: {} };

  try {
    const ss = SpreadsheetApp.openById(cfg.exceptionsSpreadsheetId);
    const sheet = cfg.exceptionsSheetName ? ss.getSheetByName(cfg.exceptionsSheetName) : ss.getSheets()[0];
    if (!sheet) throw new Error("Sheet not found: " + cfg.exceptionsSheetName);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) { result.ok = true; return result; }

    const header = values[0].map(h => String(h || "").trim().toLowerCase());
    const cDate = indexOfHeader_(header, ["date"]);
    const cName = indexOfHeader_(header, ["hca name", "hca", "name"]);
    const cType = indexOfHeader_(header, ["type"]);
    const cNote = indexOfHeader_(header, ["notes", "note"]);
    if (cDate === -1 || cName === -1 || cType === -1) {
      throw new Error("Expected Date / HCA Name / Type columns, got: " + header.join(", "));
    }

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!normalizeSheetDate_(row[cDate])) continue;
      if (normalizeSheetDate_(row[cDate]) !== isoDate) continue;

      const name = String(row[cName] || "").trim();
      if (!name) continue;

      result.byName[name.toLowerCase()] = {
        type: String(row[cType] || "").trim(),
        notes: cNote === -1 ? "" : String(row[cNote] || "").trim()
      };
      result.count++;
    }

    result.ok = true;
  } catch (err) {
    result.ok = false;
    result.error = err && err.message ? err.message : String(err);
    Logger.log("Schedule Exceptions read failed: " + result.error);
  }

  return result;
}

function normalizeSheetDate_(value) {
  if (!value && value !== 0) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + "-" + pad2_(m[2]) + "-" + pad2_(m[3]);
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + "-" + pad2_(m[1]) + "-" + pad2_(m[2]);
  return "";
}

function indexOfHeader_(header, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const at = header.indexOf(candidates[i]);
    if (at !== -1) return at;
  }
  return -1;
}

function pad2_(n) {
  const s = String(n);
  return s.length < 2 ? "0" + s : s;
}

function titleCase_(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* Rental monthlies and one-time totals are tallied apart; adding them would be
   meaningless. Entries with a deal but no figure are counted so a total is
   never quietly read as covering every appointment. */
function sumDeals_(entries) {
  let oneTime = 0, monthly = 0, missing = 0;
  entries.forEach(e => {
    if (!e.deal) return;
    if (e.dealAmount === null || e.dealAmount === undefined) { missing++; return; }
    if (e.dealIsMonthly) monthly += e.dealAmount;
    else oneTime += e.dealAmount;
  });
  return { oneTime: oneTime, monthly: monthly, missing: missing };
}

function formatMoney_(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* ------------------------------------------------------------------ email */

function sendEmailSafe_(message) {
  try {
    const to = (message.to || []).filter(Boolean).join(",");
    if (!to) return;

    MailApp.sendEmail({
      to: to,
      subject: message.subject || "CM Heating Daily Recap",
      body: message.body || "",
      name: DAILY_RECAP_CONFIG.fromName
    });
  } catch (err) {
    Logger.log("Daily recap email failed: " + (err && err.message ? err.message : String(err)));
  }
}

/* --------------------------------------------------------------------- api */

/*
 * Serves the recap log as JSON so the 1:1 prep tool can read it, the same way
 * leaderboard.html already reads its aggregator.
 *
 *   ?hca=Kyle McAlister   one rep; omit for everyone
 *   ?days=14              window, defaulting to the 14-day 1:1 cycle
 *   ?key=...              required only once recapApiKey is set (see below)
 *
 * Deploy as a web app, execute as yourself, access "Anyone with the link".
 *
 * This carries customer names, prices and objections. Set a Script Property
 * named recapApiKey and the endpoint will demand it; until you do it answers
 * anyone who has the URL and says so in the payload.
 */
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const configuredKey = readScriptProperty_("recapApiKey");

  if (configuredKey && String(p.key || "") !== configuredKey) {
    return jsonOut_({ ok: false, error: "unauthorized" });
  }

  try {
    /* The sold report is a different question off the same log, so it gets its
       own route rather than bloating the 1:1 payload every page load. */
    if (String(p.report || "") === "sold") {
      const rep = buildSoldReportPayload_(p.from || "", p.to || "");
      if (!configuredKey) {
        rep.unsecured = true;
        rep.warning = "No recapApiKey set — anyone with this URL can read customer names and prices.";
      }
      return jsonOut_(rep);
    }

    const days = Math.max(1, Math.min(120, Number(p.days) || 14));
    const payload = buildRecapApiPayload_(days, p.hca || "");
    if (!configuredKey) {
      payload.unsecured = true;
      payload.warning = "No recapApiKey set — anyone with this URL can read customer names and prices.";
    }
    return jsonOut_(payload);
  } catch (err) {
    return jsonOut_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readScriptProperty_(name) {
  try {
    return PropertiesService.getScriptProperties().getProperty(name) || "";
  } catch (err) {
    return "";
  }
}

/*
 * Rolls the raw log into what a 1:1 actually needs. The summarising happens
 * here rather than in the page so the brief stays a rendering job, and so the
 * same numbers are available to anything else that asks.
 */
function buildRecapApiPayload_(days, hcaFilter) {
  const cfg = DAILY_RECAP_CONFIG;
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 86400000);
  const fromIso = Utilities.formatDate(from, cfg.timeZone, "yyyy-MM-dd");
  const toIso = Utilities.formatDate(today, cfg.timeZone, "yyyy-MM-dd");

  const book = getLogSpreadsheet_();

  /* Accept an email as well as a name. The 1:1 scheduler calls one rep "Jay
     Milo" where the recap roster has "Javierre Milo", so matching on name
     alone would quietly return an empty result for him. Email is the one key
     both sides already agree on. */
  let wanted = String(hcaFilter || "").trim().toLowerCase();
  if (wanted.indexOf("@") !== -1) {
    const byEmail = RECAP_ROSTER.filter(h => h.email.toLowerCase() === wanted)[0];
    wanted = byEmail ? byEmail.name.toLowerCase() : "__no-such-hca__";
  }

  /* Kept unfiltered as well as filtered. Deciding whether a booked appointment
     went unreported has to consider every rep's answers — asking only about
     Kyle would make everything Amber reported look unclaimed. */
  const allLogRows = readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso);

  const logRows = allLogRows
    .filter(r => !wanted || String(r[1]).toLowerCase() === wanted);

  const compRows = readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso)
    .filter(r => !wanted || String(r[1]).toLowerCase() === wanted);

  const byName = {};
  const ensure = name => {
    if (!byName[name]) {
      byName[name] = {
        name: name, appointments: 0, outcomes: {},
        offered: { oneTime: 0, monthly: 0, noFigure: 0 },
        objections: [], undated: [], waterHeaterPresented: 0,
        followUps: [], daysScheduled: 0, daysReplied: 0, missedDays: [], rows: []
      };
    }
    return byName[name];
  };

  logRows.forEach(r => {
    const h = ensure(String(r[1]));
    const outcome = String(r[4] || "NOT GIVEN");
    const amount = Number(r[6]);
    const monthly = String(r[7]) === "Monthly";

    h.appointments++;
    h.outcomes[outcome] = (h.outcomes[outcome] || 0) + 1;
    if (!isFinite(amount) || !r[6]) h.offered.noFigure++;
    else if (monthly) h.offered.monthly += amount;
    else h.offered.oneTime += amount;

    if (/^y/i.test(String(r[8] || ""))) h.waterHeaterPresented++;

    /* Objections are the point of a 1:1, so they travel with enough context to
       open a conversation rather than as bare strings. */
    if (outcome !== "SOLD" && r[10]) {
      h.objections.push({ date: String(r[0]), customer: String(r[2] || ""), objection: String(r[10]) });
    }
    /* An open deal with no next step is the one that quietly dies. */
    if (outcome !== "SOLD" && !String(r[9] || "").trim() && r[2]) {
      h.undated.push({ date: String(r[0]), customer: String(r[2]) });
    }

    h.rows.push({
      date: String(r[0]), customer: String(r[2] || ""), source: String(r[3] || ""),
      outcome: outcome, offered: String(r[5] || ""),
      amount: isFinite(amount) && r[6] !== "" ? amount : null,
      unit: String(r[7] || ""), waterHeater: String(r[8] || ""),
      nextFollowUp: String(r[9] || ""), objection: String(r[10] || "")
    });
  });

  compRows.forEach(r => {
    const h = ensure(String(r[1]));
    h.daysScheduled++;
    if (String(r[2]) === "Yes") {
      h.daysReplied++;
    } else {
      /* The dates themselves, not just a percentage. "Reported 80% of days"
         is not something you can raise in a 1:1; "you missed Tuesday and
         Thursday" is. */
      h.missedDays.push({ date: String(r[0]), weekday: weekdayFromIso_(String(r[0])) });
    }
    if (r[4]) h.followUps.push({ date: String(r[0]), text: String(r[4]) });
  });

  /* Read from the Job Status tab, which refreshJobStatus() maintains. No
     Gmail here: the page must not depend on three searches over hundreds of
     threads completing inside a request. */
  const recon = applyJobStatus_(book.ss, byName, ensure, wanted, fromIso, toIso);

  const hcas = Object.keys(byName).sort().map(name => {
    const h = byName[name];
    const sold = h.outcomes["SOLD"] || 0;
    h.sold = sold;
    h.closeRate = h.appointments ? Math.round((sold / h.appointments) * 100) : null;
    h.waterHeaterRate = h.appointments ? Math.round((h.waterHeaterPresented / h.appointments) * 100) : null;
    h.replyRate = h.daysScheduled ? Math.round((h.daysReplied / h.daysScheduled) * 100) : null;
    return h;
  });

  return {
    ok: true, generated: new Date().toISOString(), days: days,
    from: fromIso, to: toIso,
    /* So the 1:1 page can link straight to the full record rather than
       reproducing it. */
    logUrl: book.ss.getUrl(),
    logSheetName: cfg.logSheetName,
    complianceSheetName: cfg.complianceSheetName,
    reconciliation: recon,
    hcas: hcas
  };
}

function weekdayFromIso_(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, DAILY_RECAP_CONFIG.timeZone, "EEEE");
}

/* ---- reconciling the recap against ServiceTitan ---------------------------
 *
 * A recap records what a rep believed at 6pm. By the 1:1 two days later the
 * deal may have closed, or been installed. Walking in with the rep's stale
 * status is worse than walking in with none, so the alerts are read back and
 * any drift is shown.
 */

/* Dispatcher notes are shouted — "KEEP WITH JAY", "TECH LEAD CALEB". Distinct
   from titleCase_, which only lifts the first character and is relied on
   elsewhere for lead sources. */
function properName_(v) {
  return String(v || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}

/*
 * The COMBO LOG writes reps in shouted shorthand — "JAY MILO", "JOE RUBLE",
 * and on the cancelled tab just "JOE C" or "DAVIS". Comparing those to the
 * recap roster's "Javierre Milo" and "Joseph Ruble" as plain strings flagged
 * every one of their jobs as credited to someone else. Same mapping as
 * sold-job-tracker-sync.gs.
 */
const COMBO_REP_ALIASES = {
  "adam weberg": "Adam Weberg", "adam": "Adam Weberg",
  "amber maddalena": "Amber Maddalena", "amber": "Amber Maddalena",
  "chester granard": "Chester Granard", "chester": "Chester Granard",
  "davis diosdado": "Davis Diosdado", "davis": "Davis Diosdado",
  "javierre milo": "Javierre Milo", "jay milo": "Javierre Milo",
  "jay": "Javierre Milo", "javierre": "Javierre Milo",
  "joe chounramany": "Joe Chounramany", "joe c": "Joe Chounramany",
  "joseph ruble": "Joseph Ruble", "joe ruble": "Joseph Ruble",
  "joe r": "Joseph Ruble", "joseph": "Joseph Ruble",
  "kyle mcalister": "Kyle McAlister", "kyle": "Kyle McAlister",
  "samir khoury": "Samir Khoury", "samir": "Samir Khoury",
  "trevor bohm": "Trevor Bohm", "trevor": "Trevor Bohm"
};

/* Returns the roster name for a COMBO LOG rep, or "" when it is somebody
   outside sales — the log also carries plumbing and electrical consultants
   (Daniel Hanyak, Evan Clements, Edgar Manzilla, Jack Nichols and others),
   and those must never be read as an HCA mismatch. */
function comboRepToRoster_(value) {
  const key = normName_(value);
  if (!key) return "";
  if (COMBO_REP_ALIASES[key]) return COMBO_REP_ALIASES[key];
  const hit = RECAP_ROSTER.filter(h => normName_(h.name) === key)[0];
  return hit ? hit.name : "";
}

function roundCents_(n) {
  return isFinite(n) ? Math.round(n * 100) / 100 : n;
}

function normName_(v) {
  return String(v || "").toLowerCase().replace(/\(m\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function parseAlertFields_(body) {
  const out = {};
  String(body || "").split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z#][A-Za-z #]*?)\s*:\s*(.+?)\s*$/);
    if (m) out[m[1].toLowerCase().replace(/\s+/g, " ").trim()] = m[2];
  });
  return out;
}

/*
 * Sold Estimate Alerts raised by someone on the HCA roster.
 *
 * The subject varies by business unit — [Sales Quote] for advisors, but also
 * [HVAC Sales] and [HVAC COD Service] for technician-sold work. Filtering on
 * "Sold by" against the roster is what reliably keeps technicians out.
 */
/* ---------------------------------------------------------------------------
 * Morning sales brief
 *
 * Yesterday's sales, and — the part nobody can get from a spreadsheet — how
 * many closed on the day's own consult rather than on a lead worked from
 * earlier.
 *
 * The honest limit is stated in the email itself. A Sold Estimate Alert names
 * the rep, so the sold list is solid. Nothing in email says who ran which
 * consult: the Booked Job Alert carries the CSR's initials, not the HCA's. So
 * the same-day split can only be worked out for reps who filed a recap, and the
 * rest are reported as unknown rather than assumed to be prior-consult closes.
 *
 * That distinction is the whole point. On 2026-07-31 six of nine consults went
 * unreported, two of them sales — a brief that quietly counted "not reported"
 * as "prior consult" would have said zero same-day closes on a day that had at
 * least one.
 * ------------------------------------------------------------------------- */

function sendMorningSalesBrief() {
  const cfg = DAILY_RECAP_CONFIG;
  const now = new Date();
  const yIso = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "yyyy-MM-dd");
  const yLabel = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "EEEE, MMMM d, yyyy");

  const brief = buildMorningSalesBrief_(yIso, yLabel);
  sendEmailSafe_({
    to: [cfg.managerEmail],
    subject: (isTestMode_() ? "[TEST] " : "") + "Sales brief — " + yLabel,
    body: brief.body
  });
  Logger.log(brief.body);
  return brief;
}

/* Same brief, printed and not sent. */
function previewMorningSalesBrief() {
  const cfg = DAILY_RECAP_CONFIG;
  const now = new Date();
  const yIso = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "yyyy-MM-dd");
  const yLabel = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "EEEE, MMMM d, yyyy");
  const brief = buildMorningSalesBrief_(yIso, yLabel);
  Logger.log(brief.body);
  return brief;
}

/*
 * A re-issued estimate arrives as a second alert with new estimate and
 * opportunity numbers. Collapsed on rep + customer + amount, keeping the
 * EARLIEST date, because that is the day it sold — the later alert would
 * otherwise push a Thursday sale into Friday's count.
 */
function collapseResoldAlerts_(alerts) {
  /*
   * Two alerts are the same sale if they share an opportunity, OR if the same
   * rep sold the same customer for the same amount. Neither test alone is
   * enough, and both misses are real:
   *
   *   Caroline Boisvert — one opportunity (408120596), two estimates two hours
   *     apart at $16,459.07 then $16,756.07. Same sale, different money, so a
   *     key built on the amount counts it twice.
   *   Bruce Chhay — the same amount re-issued the next morning under a NEW
   *     opportunity number. Same sale, different opportunity, so a key built
   *     on the opportunity counts it twice.
   *
   * So alerts are grouped by either match and the groups merged. The kept row
   * takes the EARLIEST date, because that is the day it sold, and the LATEST
   * detail, because a re-issue supersedes the estimate it replaced.
   */
  const parent = alerts.map((a, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const firstSeen = {};
  const link = (key, i) => {
    if (!key) return;
    if (firstSeen[key] === undefined) { firstSeen[key] = i; return; }
    const a = find(firstSeen[key]), b = find(i);
    if (a !== b) parent[b] = a;
  };

  alerts.forEach((a, i) => {
    /* The customer rides along in the opportunity key too. An opportunity
       belongs to one customer, so this changes nothing on sound data — it just
       means a stray or reused number can never merge two people's sales, which
       is a far worse error than failing to merge one. */
    if (a.opportunityNumber) link("opp|" + a.opportunityNumber + "|" + normName_(a.customer), i);
    link("who|" + normName_(a.hca) + "|" + normName_(a.customer) + "|" +
      (a.amount === null || a.amount === undefined ? "" : a.amount), i);
  });

  const groups = {};
  alerts.forEach((a, i) => {
    const root = find(i);
    (groups[root] = groups[root] || []).push(a);
  });

  return Object.keys(groups).map(root => {
    const members = groups[root];
    if (members.length === 1) return members[0];
    /* Ordered by when the alert arrived — the alert's own "8/1 12:51 PM" has no
       year and cannot order two days apart. */
    const ordered = members.slice().sort((x, y) =>
      (x.received && y.received) ? x.received - y.received : 0);
    const kept = ordered[ordered.length - 1];
    kept.resold = true;
    ordered.forEach(m => {
      if (m.soldOnIso && (!kept.soldOnIso || m.soldOnIso < kept.soldOnIso)) kept.soldOnIso = m.soldOnIso;
    });
    return kept;
  });
}

function buildMorningSalesBrief_(yIso, yLabel) {
  const cfg = DAILY_RECAP_CONFIG;
  const lines = [];
  const warnings = [];

  const soldRes = readSoldAlerts_(4);
  if (!soldRes.ok) warnings.push("ServiceTitan sold alerts could not be read — the sold list below is incomplete.");
  const sold = collapseResoldAlerts_(soldRes.alerts).filter(a => a.soldOnIso === yIso);

  /* What each rep said they ran, and who said nothing. */
  let reported = {};      // hca -> [{customer, outcome}]
  let repliedBy = {};     // hca -> "Yes" | "Late" | "No"
  let scheduled = [];
  try {
    const book = getLogSpreadsheet_();
    readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
      .filter(r => String(r[0]) === yIso)
      .forEach(r => {
        const name = String(r[1]);
        (reported[name] = reported[name] || []).push({
          customer: String(r[2] || ""), outcome: String(r[4] || "")
        });
      });
    readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length)
      .filter(r => String(r[0]) === yIso)
      .forEach(r => {
        scheduled.push(String(r[1]));
        repliedBy[String(r[1])] = String(r[2] || "");
      });
  } catch (err) {
    warnings.push("The recap log could not be read, so the same-day split is unavailable: " + err);
  }

  /* Classify each sale. "Unknown" is a real answer here and is never quietly
     folded into "prior consult". */
  const sameDay = [], prior = [], unknown = [];
  sold.forEach(s => {
    const rows = reported[s.hca] || [];
    const ranIt = rows.filter(r => namesMatch_(r.customer, s.customer))[0];
    if (ranIt) { sameDay.push(s); return; }
    const replied = String(repliedBy[s.hca] || "").toLowerCase();
    if (replied === "yes" || replied === "late") prior.push(s);
    else unknown.push(s);
  });

  const money = n => (n === null || n === undefined) ? "" : "$" + formatMoney_(n);
  const total = sold.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  lines.push("Sales brief — " + yLabel);
  lines.push(new Array(60).join("="));
  lines.push("");
  lines.push(sold.length + " sold" + (total ? "   " + money(total) + " total" : ""));
  lines.push("   " + sameDay.length + " closed on the day's own consult");
  lines.push("   " + prior.length + " from a lead worked earlier");
  if (unknown.length) lines.push("   " + unknown.length + " unknown — that rep filed no recap");
  lines.push("");

  const listSales = (title, items, note) => {
    if (!items.length) return;
    lines.push(title + " (" + items.length + ")");
    if (note) lines.push("  " + note);
    items.forEach(s => {
      lines.push("  " + s.hca + " — " + (s.customer || "(no customer named)") +
        (s.amount ? "   " + money(s.amount) : "") + (s.resold ? "   [estimate re-issued]" : ""));
      if (s.name) lines.push("      " + s.name);
    });
    lines.push("");
  };

  listSales("CLOSED ON THE DAY", sameDay);
  listSales("FROM AN EARLIER LEAD", prior);
  listSales("SPLIT UNKNOWN", unknown,
    "sold, but this rep filed no recap, so there is no way to tell whether they ran it that day.");

  if (!sold.length) lines.push("No HCA sales recorded for " + yLabel + ".");

  /* Consults, from what was reported. Never presented as the full day. */
  lines.push(new Array(60).join("-"));
  const reportedCount = Object.keys(reported).reduce((n, k) => n + reported[k].length, 0);
  lines.push("Consults reported: " + reportedCount);
  Object.keys(reported).sort().forEach(name => {
    lines.push("  " + name);
    reported[name].forEach(r => lines.push("      " + (r.customer || "(unnamed)") + " — " + (r.outcome || "no outcome")));
  });

  const silent = scheduled.filter(n => {
    const v = String(repliedBy[n] || "").toLowerCase();
    return v !== "yes" && v !== "late";
  });
  if (silent.length) {
    lines.push("");
    lines.push("NOT REPORTED (" + silent.length + "): " + silent.join(", "));
    lines.push("Anything they ran is missing from the figures above, sales included.");
    lines.push("The ServiceTitan dispatch board for " + yLabel + " is the only place");
    lines.push("that shows what they actually ran.");
  } else if (scheduled.length) {
    lines.push("");
    lines.push("Everyone scheduled reported. The consult count above is the whole day.");
  }

  if (warnings.length) {
    lines.push("");
    lines.push(new Array(60).join("-"));
    warnings.forEach(w => lines.push("! " + w));
  }

  return {
    body: lines.join("\n"),
    sold: sold.length, sameDay: sameDay.length, prior: prior.length,
    unknown: unknown.length, total: total, notReported: silent
  };
}

/*
 * The split the 9am brief works out for one night, widened to a date range so
 * it can be read as a report rather than a paragraph.
 *
 *   sameDay — that rep's recap for that date names the customer, so the
 *             consult and the close happened on the same day.
 *   prior   — they filed a recap for that date and it does not name the
 *             customer, so the sale came off a lead worked earlier.
 *   unknown — they filed nothing for that date. Kept as its own answer and
 *             never folded into prior: a rep who did not report is not
 *             evidence that the lead was old, only that nobody can say.
 *
 * That third bucket is the whole reason this is worth reading. Fold it into
 * prior and the report claims to know something it does not, which is exactly
 * how six unreported consults hid on a Friday.
 */
function buildSoldReportPayload_(fromIso, toIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const todayIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");

  fromIso = String(fromIso || "").trim() || todayIso.slice(0, 8) + "01";   // month to date
  toIso = String(toIso || "").trim() || todayIso;
  if (fromIso > toIso) { const swap = fromIso; fromIso = toIso; toIso = swap; }

  const spanDays = Math.round(
    (Date.parse(toIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 1;

  const warnings = [];
  const soldRes = readSoldAlerts_(Math.max(1, Math.min(200, spanDays + 3)));
  if (!soldRes.ok) {
    warnings.push("ServiceTitan sold alerts could not be read, so these counts are incomplete.");
  }

  const sold = collapseResoldAlerts_(soldRes.alerts)
    .filter(a => a.soldOnIso && a.soldOnIso >= fromIso && a.soldOnIso <= toIso);

  /* A date cell comes back as a Date or a string depending on how the row was
     written. Normalising here rather than trusting one shape. */
  const isoCell = v => v instanceof Date
    ? Utilities.formatDate(v, cfg.timeZone, "yyyy-MM-dd")
    : String(v || "").trim();

  const reported = {};    // "iso|hca" -> [customer]
  const repliedBy = {};   // "iso|hca" -> Yes | Late | No
  try {
    const book = getLogSpreadsheet_();
    readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length).forEach(r => {
      const iso = isoCell(r[0]);
      if (iso < fromIso || iso > toIso) return;
      const key = iso + "|" + String(r[1] || "");
      (reported[key] = reported[key] || []).push(String(r[2] || ""));
    });
    readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length).forEach(r => {
      const iso = isoCell(r[0]);
      if (iso < fromIso || iso > toIso) return;
      repliedBy[iso + "|" + String(r[1] || "")] = String(r[2] || "");
    });
  } catch (err) {
    warnings.push("The recap log could not be read, so every sale below counts as unknown: " +
      (err && err.message ? err.message : String(err)));
  }

  const splitFor = s => {
    const key = s.soldOnIso + "|" + s.hca;
    if ((reported[key] || []).some(c => namesMatch_(c, s.customer))) return "sameDay";
    const replied = String(repliedBy[key] || "").toLowerCase();
    return (replied === "yes" || replied === "late") ? "prior" : "unknown";
  };

  const sales = sold.map(s => ({
    hca: s.hca,
    customer: s.customer || "",
    amount: (s.amount === null || s.amount === undefined) ? null : Number(s.amount),
    soldOnIso: s.soldOnIso,
    jobName: s.name || "",
    resold: !!s.resold,
    split: splitFor(s)
  })).sort((a, b) =>
    a.soldOnIso === b.soldOnIso ? (a.hca < b.hca ? -1 : 1) : (a.soldOnIso < b.soldOnIso ? 1 : -1));

  const blank = () => ({ sameDay: 0, prior: 0, unknown: 0, total: 0, amount: 0 });
  const totals = blank(), byHca = {}, byDay = {};
  sales.forEach(s => {
    const add = t => { t[s.split]++; t.total++; t.amount += (s.amount || 0); };
    add(totals);
    add(byHca[s.hca] = byHca[s.hca] || blank());
    add(byDay[s.soldOnIso] = byDay[s.soldOnIso] || blank());
  });

  /* Who was scheduled in the range and never answered. Their sales are the
     unknown bucket, so naming them turns the number into an action. */
  const silent = {};
  Object.keys(repliedBy).forEach(key => {
    const v = String(repliedBy[key] || "").toLowerCase();
    if (v === "yes" || v === "late") return;
    const name = key.slice(key.indexOf("|") + 1);
    silent[name] = (silent[name] || 0) + 1;
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    fromIso: fromIso, toIso: toIso, todayIso: todayIso,
    totals: totals,
    byHca: Object.keys(byHca).sort().map(n => Object.assign({ hca: n }, byHca[n])),
    byDay: Object.keys(byDay).sort().reverse().map(d => Object.assign({ iso: d }, byDay[d])),
    sales: sales,
    notReported: Object.keys(silent).sort().map(n => ({ hca: n, days: silent[n] })),
    warnings: warnings
  };
}

/*
 * Why the sold report says what it says. Reads nothing but Gmail, writes
 * nothing, sends nothing.
 *
 * Every stage prints its own count, so a zero can be traced to the stage that
 * produced it instead of guessed at: the search itself, the roster filter that
 * drops technicians, the date parsed out of the alert body, or the range
 * filter. The report gives one number and no way to see which of those four
 * emptied it.
 */
function diagnoseSoldReport() {
  const cfg = DAILY_RECAP_CONFIG;
  const todayIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  const fromIso = todayIso.slice(0, 8) + "01";
  const spanDays = Math.round(
    (Date.parse(todayIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 1;
  const days = Math.max(1, Math.min(200, spanDays + 3));
  const out = [];

  out.push("today " + todayIso + ", range " + fromIso + " to " + todayIso +
    " (" + spanDays + " days), Gmail lookback newer_than:" + days + "d");

  const query = 'from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' + days + "d";
  out.push("query: " + query);

  let threads = [];
  try {
    threads = GmailApp.search(query, 0, 200);
  } catch (err) {
    out.push("SEARCH FAILED: " + (err && err.message ? err.message : String(err)));
    Logger.log(out.join("\n"));
    return { ok: false };
  }
  out.push("threads returned: " + threads.length);

  let messages = 0, parsed = 0, notHca = 0, noDate = 0, inRange = 0;
  const seenNames = {};
  threads.forEach(t => t.getMessages().forEach(msg => {
    messages++;
    const f = parseAlertFields_(msg.getPlainBody());
    const soldBy = f["sold by"] || "";
    if (!soldBy) return;
    parsed++;
    const hca = RECAP_ROSTER.filter(h => normName_(h.name) === normName_(soldBy))[0];
    if (!hca) { notHca++; seenNames[soldBy] = (seenNames[soldBy] || 0) + 1; return; }
    const md = String(f["date"] || "").match(/^(\d{1,2})\/(\d{1,2})/);
    const iso = md ? resolveAlertDate_(Number(md[1]), Number(md[2]), msg.getDate())
                   : Utilities.formatDate(msg.getDate(), cfg.timeZone, "yyyy-MM-dd");
    if (!iso) { noDate++; out.push("  no date: " + soldBy + " / " + (f["customer"] || "?") +
      "  raw date field: " + JSON.stringify(f["date"])); return; }
    const within = iso >= fromIso && iso <= todayIso;
    if (within) inRange++;
    out.push("  " + (within ? "IN  " : "out ") + iso + "  " + hca.name +
      " — " + (f["customer"] || "?") + "  " + (f["amount"] || ""));
  }));

  out.push("messages: " + messages + ", had a 'Sold by' line: " + parsed +
    ", not an HCA: " + notHca + ", unparseable date: " + noDate + ", in range: " + inRange);
  const others = Object.keys(seenNames);
  if (others.length) out.push("non-HCA sellers seen (correctly ignored): " +
    others.map(n => n + " x" + seenNames[n]).join(", "));
  if (!inRange) {
    out.push("");
    out.push("NOTHING IN RANGE. If 'threads returned' is 0 the search is the problem;");
    out.push("if messages were seen but all say 'out', the alert dates fall outside the");
    out.push("month-to-date window; if all were 'not an HCA' the roster names disagree");
    out.push("with what ServiceTitan puts in 'Sold by'.");
  }
  Logger.log(out.join("\n"));
  return { threads: threads.length, messages: messages, inRange: inRange };
}

/* The report printed to the log, so it can be checked without deploying. */
function previewSoldReport() {
  const p = buildSoldReportPayload_("", "");
  const pct = n => p.totals.total ? " (" + Math.round(n * 100 / p.totals.total) + "%)" : "";
  Logger.log("Sold report " + p.fromIso + " to " + p.toIso +
    "\n  total sold:  " + p.totals.total + "   $" + formatMoney_(p.totals.amount) +
    "\n  same day:    " + p.totals.sameDay + pct(p.totals.sameDay) +
    "\n  prior lead:  " + p.totals.prior + pct(p.totals.prior) +
    "\n  unknown:     " + p.totals.unknown + pct(p.totals.unknown) +
    (p.notReported.length ? "\n  no recap filed: " +
      p.notReported.map(n => n.hca + " (" + n.days + "d)").join(", ") : "") +
    (p.warnings.length ? "\n  ! " + p.warnings.join("\n  ! ") : ""));
  return p;
}

function readSoldAlerts_(days) {
  const out = [];
  let threads = [];
  try {
    threads = GmailApp.search('from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' +
      Math.max(1, days) + "d", 0, 200);
  } catch (err) {
    Logger.log("Sold alert search failed: " + err);
    return { ok: false, alerts: out };
  }

  threads.forEach(t => t.getMessages().forEach(msg => {
    const f = parseAlertFields_(msg.getPlainBody());
    const soldBy = f["sold by"] || "";
    const hca = RECAP_ROSTER.filter(h => normName_(h.name) === normName_(soldBy))[0];
    if (!hca) return;                                  // technician, not an HCA
    /* "7/30 8:15 AM" carries no year; the tracker needs a sortable date. */
    const md = String(f["date"] || "").match(/^(\d{1,2})\/(\d{1,2})/);
    out.push({
      hca: hca.name,
      soldOnIso: md ? resolveAlertDate_(Number(md[1]), Number(md[2]), msg.getDate())
                    : Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd"),
      customer: String(f["customer"] || "").trim(),
      amount: parseDealAmount_(f["amount"] || "").amount,
      name: f["name"] || "",
      soldOn: f["date"] || "",
      jobNumber: f["job#"] || f["job #"] || "",
      estimateNumber: f["estimate#"] || f["estimate #"] || "",
      opportunityNumber: f["opportunity#"] || f["opportunity #"] || "",
      received: msg.getDate()
    });
  }));
  return { ok: true, alerts: out };
}

/*
 * Completed Form Alert [HVAC Sales] is the install-finished signal. Its body
 * opens with the date, time and customer before the address, rather than
 * labelled fields.
 */
function readInstallCompletions_(days) {
  const out = [];
  let threads = [];
  try {
    threads = GmailApp.search('from:alerts@servicetitan.com subject:"Completed Form Alert" newer_than:' +
      Math.max(1, days) + "d", 0, 200);
  } catch (err) {
    Logger.log("Completion alert search failed: " + err);
    return { ok: false, completions: out };
  }

  threads.forEach(t => t.getMessages().forEach(msg => {
    /* Installs only. Completed Form Alerts also fire for [HVAC COD Service],
       [Fireplace COD Service] and [HVAC Maintenance Plan] — service calls, not
       installs, and counting one as "installed" would be worse than missing
       it. Matching on "Sales" rather than "HVAC Sales" so a fireplace or other
       sales business unit is picked up if one exists. */
    if (String(msg.getSubject() || "").indexOf("Sales") === -1) return;
    const body = String(msg.getPlainBody() || "");
    const m = body.match(/^[ \t]*(\d{1,2}\/\d{1,2})\s+\d{1,2}:\d{2}\s*[AP]M\s+(.+?)\s+\d{2,}\s/m);
    if (!m) return;
    const desc = (body.match(/INSTALL DESCRIPTION:\s*(.+)/i) || [])[1] || "";
    out.push({
      customer: m[2].replace(/\(M\)\s*$/i, "").trim(),
      installedOn: m[1],
      description: String(desc).trim(),
      received: msg.getDate()
    });
  }));
  return { ok: true, completions: out };
}

/*
 * Two customer names refer to the same job when they normalize equal, when one
 * is a fragment of the other, or when they are the same name typed by two
 * different people. ServiceTitan writes "Eileen Manrao (M)" and a rep types
 * "Eileen Manrao" or sometimes just "Manrao"; the COMBO LOG has
 * "ANDERSON, GREG 0000348" where the alert has "Greg Anderson", and
 * "Habpemariam" where the alert has "Habtemariam". Treating any of those as
 * different people is what produces phantom "sold but never reported" rows.
 *
 * Substring first because it is cheap and covers most of it, then the token
 * matcher below for the spelling drift. A shared first name is never enough on
 * its own — "Sidney Abe" must not match "Sidney Johnson".
 */
function namesMatch_(a, b) {
  const x = normName_(a), y = normName_(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.indexOf(y) !== -1 || y.indexOf(x) !== -1)) return true;
  return fuzzyNameMatch_(nameSignature_(a), nameSignature_(b));
}

/* ---------------------------------------------------------------------------
 * Fuzzy customer-name matching.
 *
 * Kept byte-for-byte in step with the same block in sold-job-tracker-sync.gs.
 * The two scripts are separate Apps Script projects and cannot import from one
 * another, so this is duplicated on purpose — if you change one, change both,
 * or the recap and the sold tracker will disagree about who a customer is.
 * ------------------------------------------------------------------------- */

const NAME_STOPWORDS = ["M", "F", "MR", "MRS", "MS", "DR", "JR", "SR", "II", "III", "IV", "AND", "OR", "THE", "OF"];

// Generic words that carry no identity of their own. Two different property
// management companies both match on PROPERTY and MANAGEMENT; that pair must
// not be enough to call them the same customer.
const NAME_WEAK_TOKENS = [
  "PROPERTY", "PROPERTIES", "MANAGEMENT", "MANAGMENT", "MGMT", "LLC", "INC",
  "CORP", "CORPORATION", "COMPANY", "ASSOCIATION", "ASSOC", "HOA", "CHURCH",
  "BAPTIST", "CENTER", "CENTRE", "SCHOOL", "RESTAURANT", "APARTMENTS", "APTS",
  "CONDOMINIUM", "CONDO", "MINISTRIES", "HOLDINGS", "GROUP", "SERVICES",
  "LLP", "TRUST", "FAMILY", "RESIDENCE"
];

// Name particles get glued to the word that follows so "MC EACHERN" and
// "MCEACHERN" reduce to the same token instead of one side losing "MC" to the
// short-word filter.
const NAME_PARTICLE_RE = /\b(MC|MAC|VAN|VON|DE|DEL|DELA|LA|LE|DI|DA|ST)\s+(?=[A-Z])/g;

function nameSignature_(value) {
  const text = String(value === null || value === undefined ? "" : value)
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .toUpperCase()
    .replace(/\([MF]\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b\d{3,}\b/g, " ")   // ServiceTitan customer numbers, street numbers
    .trim()
    .replace(NAME_PARTICLE_RE, "$1");

  const tokens = [];
  const weak = [];
  text.split(/\s+/).filter(Boolean).forEach(word => {
    if (word.length < 3) return;
    if (/^\d+$/.test(word)) return;
    if (NAME_STOPWORDS.indexOf(word) !== -1) return;
    if (tokens.indexOf(word) !== -1) return;
    tokens.push(word);
    if (NAME_WEAK_TOKENS.indexOf(word) !== -1) weak.push(word);
  });

  return { tokens: tokens, weak: weak };
}

function levenshtein_(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function nameTokensMatch_(a, b) {
  if (a === b) return true;

  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);

  // "EACHERN" inside "MCEACHERN", "JESSI" inside "JESSIAH". Only on tokens
  // long enough that the overlap means something.
  if (min >= 4 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) return true;

  if (max - min > 2) return false;
  const tolerance = max <= 4 ? 0 : (max <= 7 ? 1 : 2);
  if (!tolerance) return false;
  return levenshtein_(a, b) <= tolerance;
}

function fuzzyNameMatch_(sigA, sigB) {
  if (!sigA || !sigB) return false;
  if (!sigA.tokens.length || !sigB.tokens.length) return false;

  const usedB = {};
  let total = 0;
  let strong = 0;

  sigA.tokens.forEach(tokenA => {
    for (let i = 0; i < sigB.tokens.length; i++) {
      if (usedB[i]) continue;
      if (!nameTokensMatch_(tokenA, sigB.tokens[i])) continue;
      usedB[i] = true;
      total++;
      if (sigA.weak.indexOf(tokenA) === -1 && sigB.weak.indexOf(sigB.tokens[i]) === -1) strong++;
      return;
    }
  });

  if (!strong) return false;
  if (total >= 2) return true;

  // One match is only enough when a side offers nothing else — a COMBO LOG row
  // carrying a surname and no first name, say — and the token is substantial.
  const soloA = sigA.tokens.length === 1;
  const soloB = sigB.tokens.length === 1;
  if (!soloA && !soloB) return false;
  const solo = soloA ? sigA.tokens[0] : sigB.tokens[0];
  return solo.length >= 5;
}

/*
 * Reconciles what the reps reported against what ServiceTitan actually
 * recorded, and hangs the result off each HCA.
 *
 * Three things come out of it, in descending order of how much they matter in
 * a 1:1:
 *
 *   soldNotReported — ServiceTitan says sold, the recap never mentioned the
 *                     customer at all. The sale is real and the reporting is
 *                     not.
 *   statusDrift     — the recap said estimate/follow-up, ServiceTitan has since
 *                     marked it sold. Nobody did anything wrong; the status is
 *                     just stale, and walking in with it is worse than nothing.
 *   installed       — the job is already in and done. Worth acknowledging
 *                     rather than asking how the follow-up is going.
 *
 * Install *scheduled* dates are deliberately absent: the two alerts carry sold
 * and completed, and nothing in between. That needs the COMBO LOG.
 */
function reconcileWithServiceTitan_(byName, ensure, wanted, days, ctx) {
  const window = Math.max(1, Math.min(60, Number(days) || 14));
  const soldRes = readSoldAlerts_(window);
  const doneRes = readInstallCompletions_(window);
  const bookedRes = readBookedJobAlerts_(ctx.fromIso, ctx.toIso, window);
  const comboRes = readComboInstalls_();

  const status = {
    ok: soldRes.ok && doneRes.ok,
    bookedOk: bookedRes.ok,
    comboOk: comboRes.ok,
    soldAlertsRead: soldRes.alerts.length,
    completionAlertsRead: doneRes.completions.length,
    bookedAlertsRead: bookedRes.booked.length,
    comboRowsRead: comboRes.installs.length,
    /* Said plainly so the 1:1 page never implies an install date it does not
       have. */
    note: "Sold and install-completed come from ServiceTitan alert emails; " +
          "scheduled install dates come from the COMBO LOG."
  };
  if (!comboRes.ok) {
    status.comboError = "COMBO LOG unreachable; scheduled install dates are missing.";
  }
  /* Carried so the worklist can show a phone number. Only bookings have one,
     which is most of the reason the worklist's Phone column is often blank. */
  status.bookedContacts = bookedRes.booked
    .filter(b => b.phone)
    .map(b => ({ customer: b.customer, phone: b.phone }));
  if (!status.ok) {
    status.error = "Gmail alert search failed; reconciliation is incomplete.";
    return status;
  }

  /* Every rep who either filed a recap or raised a sold alert in the window,
     honouring the same single-HCA filter the caller asked for. */
  const names = {};
  Object.keys(byName).forEach(n => { names[n] = true; });
  soldRes.alerts.forEach(a => {
    if (wanted && a.hca.toLowerCase() !== wanted) return;
    names[a.hca] = true;
  });

  Object.keys(names).forEach(name => {
    const h = ensure(name);

    /* One job can raise several Sold Estimate Alerts, and the alerts do not
       say which kind you are looking at. Both of these are real:

         Greg Anderson    Family Comfort #1 Mitsubishi  $12,325.60
         Greg Anderson    Kumo cloud                       $348.13
           — a system and an accessory. Both sold. The job is worth the sum.

         Eileen Manrao    Supreme 25                    $9,350.00   (7/29)
         Eileen Manrao    *NEW* Supreme 25              $8,667.02   (7/30)
           — almost certainly one deal repriced. The job is worth the later
             figure, not both.

       Nothing in the alert distinguishes them. So estimates are grouped by
       job and every line is kept: picking one and calling the other a
       revision would assert a judgement the data cannot support, and would
       have silently thrown away $12,325.60 of Greg Anderson. A job carrying
       more than one estimate is flagged instead, so the total is presented as
       needing a look rather than as a fact. */
    const mine = soldRes.alerts.filter(a => a.hca === h.name);
    const byJob = {};
    mine.forEach(a => {
      const key = a.jobNumber || normName_(a.customer);
      if (!byJob[key]) {
        byJob[key] = { customer: a.customer, jobNumber: a.jobNumber, estimates: [] };
      }
      /* The same estimate can alert twice; that one really is a duplicate. */
      const seen = byJob[key].estimates.filter(e =>
        e.estimateNumber && e.estimateNumber === a.estimateNumber)[0];
      if (seen) {
        if (a.received > seen.received) {
          seen.amount = a.amount; seen.soldOn = a.soldOn; seen.received = a.received;
        }
        return;
      }
      byJob[key].estimates.push({
        estimateNumber: a.estimateNumber, name: a.name,
        amount: a.amount, soldOn: a.soldOn, soldOnIso: a.soldOnIso, received: a.received
      });
    });

    /* Not h.sold — that is already the count the rep reported, and the whole
       point here is to be able to compare the two. */
    h.soldAlerts = [];
    h.statusDrift = [];
    h.soldNotReported = [];
    h.installed = [];

    Object.keys(byJob).forEach(key => {
      const job = byJob[key];
      job.estimates.sort((x, y) => x.received - y.received);

      const row = h.rows.filter(r => namesMatch_(r.customer, job.customer))[0] || null;
      const done = doneRes.completions.filter(c => namesMatch_(c.customer, job.customer))[0] || null;
      const last = job.estimates[job.estimates.length - 1] || {};

      /* A dated COMBO LOG row beats an undated one — a job can sit on a TBD
         sheet and then be scheduled without the TBD row being cleared. */
      const comboHits = comboRes.installs.filter(c => namesMatch_(c.customer, job.customer));
      const combo = comboHits.filter(c => c.installDate)[0] || comboHits[0] || null;
      const cancelled = (comboRes.cancellations || [])
        .filter(c => namesMatch_(c.customer, job.customer))[0] || null;

      const item = {
        customer: job.customer, jobNumber: job.jobNumber,
        soldOnIso: last.soldOnIso || "",
        /* Every line, so the reader can tell an add-on from a reprice. */
        estimates: job.estimates.map(e => ({
          estimateNumber: e.estimateNumber, name: e.name,
          amount: e.amount, soldOn: e.soldOn
        })),
        /* Rounded to cents: summing 12000 and 348.13 in binary floating point
           lands on 12348.129999999997, and a price is not a place to show
           that. */
        amount: roundCents_(job.estimates.reduce(
          (t, e) => t + (isFinite(e.amount) && e.amount ? e.amount : 0), 0)),
        /* True when the total is a guess: several estimates on one job could
           be add-ons to be summed, or the same deal repriced. */
        multiEstimate: job.estimates.length > 1,
        soldOn: last.soldOn || "",
        estimateName: last.name || "",
        reportedOutcome: row ? row.outcome : null,
        reportedOn: row ? row.date : null,
        installCompletedOn: done ? done.installedOn : null,
        installDescription: done ? done.description : "",
        /* From the COMBO LOG, the only place a scheduled date exists. */
        installScheduledOn: combo ? combo.installDate : "",
        installTbd: combo ? !!combo.isTbd && !combo.installDate : false,
        installCompletedPerCombo: combo ? !!combo.isCompleted : false,
        /* On the TBD tab the "job completed" column holds the live action
           note, which is usually the most current word on the job anywhere. */
        comboNotes: combo ? (combo.jobCompleted || combo.jobNotes || combo.permitNotes || "") : "",
        comboSheet: combo ? combo.sourceSheet : "",
        /* A sale can come back off the board. The cancelled tab is the only
           record of it, and without this the job reads SOLD forever. */
        cancelledOn: cancelled ? cancelled.cancelledOn : "",
        cancelledReason: cancelled ? cancelled.reason : "",
        /* The COMBO LOG names a rep too. Only a mismatch between two people
           who are both on the HCA roster means anything — the log also
           carries plumbing and electrical consultants, and a blank or an
           unrecognised name is not evidence of anything. */
        comboSalesRep: combo && combo.salesRep ? combo.salesRep : ""
      };
      const comboRep = comboRepToRoster_(item.comboSalesRep);
      if (comboRep && comboRep !== h.name) item.comboRepDiffers = comboRep;

      h.soldAlerts.push(item);
      if (!row) h.soldNotReported.push(item);
      else if (row.outcome !== "SOLD") h.statusDrift.push(item);
      if (done) h.installed.push(item);
    });

    const order = (a, b) => String(b.soldOn).localeCompare(String(a.soldOn));
    h.soldAlerts.sort(order);
    h.statusDrift.sort(order);
    h.soldNotReported.sort(order);
    h.installed.sort(order);

    h.soldPerServiceTitan = h.soldAlerts.length;
    h.soldAmountPerServiceTitan = roundCents_(h.soldAlerts.reduce(
      (t, s) => t + (isFinite(s.amount) && s.amount ? s.amount : 0), 0));
    /* So the figure is never presented as settled when it is not. */
    h.soldAmountNeedsReview = h.soldAlerts.some(s => s.multiEstimate);
  });

  matchBookedToReplies_(byName, bookedRes.booked, ctx.allLogRows, status, ctx.askedOn);
  return status;
}

/*
 * Matches the booked appointment to what the rep said about it.
 *
 * The Booked Job Alert names no advisor — the assignment happens after the
 * booking — so the recap reply is the only place the advisor-to-customer
 * mapping exists before a sale. That makes this the one reconciliation that
 * cannot run off ServiceTitan alone, and it is the only way to see an
 * appointment that was run and did NOT sell: the sold tracker is built off
 * Sold Estimate Alerts, so a booked job that never closed appears nowhere in
 * it.
 *
 * Three outcomes:
 *
 *   matched     the rep's row gains the booking's context — job type, what the
 *               customer said on the phone, how old the system is
 *   unclaimed   booked, the day has passed, nobody reported it. Did it run?
 *               Get reassigned? Cancel? Company-level, since no advisor is
 *               attached to argue about
 *   notBooked   reported with no Sales Quote booking behind it — a revisit or
 *               self-generated lead, or a name that does not match
 */
function matchBookedToReplies_(byName, booked, allLogRows, status, askedOn) {
  const claimed = {};
  /* No compliance data at all means the caller could not tell us which days
     were asked about — treat every day as fair game rather than silently
     reporting nothing. */
  const haveAskedData = askedOn && Object.keys(askedOn).length > 0;
  let skippedPreLaunch = 0;

  /* Every reported appointment, across all reps, so a single-rep query does
     not make everyone else's work look unclaimed. */
  const reported = (allLogRows || []).map(r => ({
    date: String(r[0]), hca: String(r[1]), customer: String(r[2] || "")
  })).filter(r => r.customer);

  const unclaimed = [];
  booked.forEach(b => {
    const hit = reported.filter(r =>
      r.date === b.appointmentIso && namesMatch_(r.customer, b.customer))[0];

    if (!hit) {
      /* Booked on a day nobody was asked for a recap. Not a gap in reporting,
         and listing it as one buries the days that are. */
      if (haveAskedData && !askedOn[b.appointmentIso]) { skippedPreLaunch++; return; }
      unclaimed.push({
        customer: b.customer, jobNumber: b.jobNumber, jobType: b.jobType,
        appointmentIso: b.appointmentIso, appointmentAt: b.appointmentAt,
        /* Who to ask, when the dispatcher left a note. */
        assignedHint: b.assignedHint, techLead: b.techLead,
        sourceHint: b.sourceHint
      });
      return;
    }

    claimed[hit.hca + "|" + hit.date + "|" + normName_(hit.customer)] = true;

    const h = byName[hit.hca];
    if (!h) return;
    const row = h.rows.filter(r =>
      r.date === hit.date && namesMatch_(r.customer, b.customer))[0];
    if (!row) return;

    row.booked = {
      jobNumber: b.jobNumber, jobType: b.jobType, appointmentAt: b.appointmentAt,
      hoa: b.hoa, timeline: b.timeline, systemAge: b.systemAge,
      techLead: b.techLead, sourceHint: b.sourceHint
    };
    /* The booking's own word on lead source against the rep's. Recorded, not
       judged — a tech-flip booking can legitimately be reported as a revisit
       if the rep had seen them before. */
    if (b.sourceHint && row.source && normName_(b.sourceHint) !== normName_(row.source)) {
      row.sourceHintDiffers = b.sourceHint;
    }
  });

  Object.keys(byName).forEach(name => {
    const h = byName[name];
    h.bookedMatched = (h.rows || []).filter(r => r.booked).length;
    /* Not a fault. A revisit or a self-generated lead has no Sales Quote
       booking behind it, and neither does a customer whose name was typed
       differently. Worth a glance, not a flag. */
    h.reportedNotBooked = (h.rows || [])
      .filter(r => !r.booked && r.customer)
      .map(r => ({ date: r.date, customer: r.customer, source: r.source, outcome: r.outcome }));
  });

  unclaimed.sort((a, b) => String(b.appointmentIso).localeCompare(String(a.appointmentIso)));
  status.unclaimedAppointments = unclaimed;
  status.bookedMatched = Object.keys(claimed).length;
  /* Said out loud rather than silently dropped, so a suspiciously short
     unclaimed list is explainable. */
  status.bookedBeforeRecapStarted = skippedPreLaunch;
  if (!status.bookedOk) {
    status.bookedError = "Booked Job Alert search failed; unreported appointments are not shown.";
  }
}

/*
 * Booked Job Alert [Sales Quote] — the appointment before anyone runs it.
 *
 * The body is positional rather than labelled:
 *
 *   Booked Job Alert:
 *   Sales Quote
 *   Sales Quote - Cooling          <- job type
 *   # 408119792                    <- job number
 *   7/29 10:00 AM                  <- the APPOINTMENT, not the booking
 *   Syed Rizvi                     <- customer
 *   13604 43rd Avenue Southeast, Mill Creek, WA 98012 USA
 *   KEEP WITH JAY - HE SOLD THEIR FURNACE IN 2023.
 *   7/29 10-12 JDC Sales Consult - LEAD BY Dan K.
 *   ...questionnaire...
 *
 * The alert fires when the job is booked, which can be weeks before the
 * appointment — 8/10 and 8/12 appointments both alerted on 7/30. So the search
 * reaches much further back than the report window and the filtering is done
 * on the appointment date parsed out of the body.
 */
function readBookedJobAlerts_(fromIso, toIso, days) {
  const out = [];
  let threads = [];
  /* Booked well ahead of the appointment, so the search window has to be much
     wider than the window being reported on. */
  const lookback = Math.max(30, Math.min(180, (Number(days) || 14) + 90));
  try {
    threads = GmailApp.search('from:alerts@servicetitan.com subject:"Booked Job Alert [Sales Quote]" ' +
      "newer_than:" + lookback + "d", 0, 300);
  } catch (err) {
    Logger.log("Booked alert search failed: " + err);
    return { ok: false, booked: out };
  }

  threads.forEach(t => t.getMessages().forEach(msg => {
    if (String(msg.getSubject() || "").indexOf("Booked Job Alert") === -1) return;
    const parsed = parseBookedAlert_(msg.getPlainBody(), msg.getDate());
    if (!parsed || !parsed.customer) return;
    if (parsed.appointmentIso < fromIso || parsed.appointmentIso > toIso) return;
    out.push(parsed);
  }));

  /* The same job can alert more than once when an appointment is moved. */
  const seen = {}, deduped = [];
  out.forEach(b => {
    const key = b.jobNumber || (normName_(b.customer) + "|" + b.appointmentIso);
    if (seen[key]) return;
    seen[key] = true;
    deduped.push(b);
  });
  return { ok: true, booked: deduped };
}

function parseBookedAlert_(rawBody, received) {
  const lines = String(rawBody || "").split(/\r?\n/).map(l => l.trim());
  const body = String(rawBody || "");

  let jobType = "", jobNumber = "", appointmentIso = "", appointmentAt = "", customer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!jobType && /^Sales Quote\s*[-–—]\s*\S/.test(line)) {
      jobType = line.replace(/^Sales Quote\s*[-–—]\s*/, "").trim();
      continue;
    }
    if (!jobNumber) {
      const m = line.match(/^#\s*(\d{4,})\s*$/);
      if (m) { jobNumber = m[1]; continue; }
    }
    /* The date line is what anchors everything: the customer is the next
       non-empty line after it. */
    const when = line.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*$/i);
    if (when && !appointmentIso) {
      const d = resolveAlertDate_(Number(when[1]), Number(when[2]), received);
      if (!d) continue;
      appointmentIso = d;
      appointmentAt = when[1] + "/" + when[2] + " " + when[3];
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j]) continue;
        customer = lines[j].replace(/\(M\)\s*$/i, "").trim();
        break;
      }
      break;
    }
  }
  if (!appointmentIso) return null;

  /* Dispatcher notes, not structured fields, but they are the only advisor
     signal a booked alert ever carries. "KEEP WITH JAY", "KEEP ON JOE C".
     Treated strictly as a hint — the recap reply remains the record of who
     actually ran it. */
  const keep = body.match(/\bKEEP\s+(?:WITH|ON)\s+([A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)?)/i);

  /* "TECH LEAD CALEB", "LEAD BY Dan K." — the technician who flipped it, NOT
     the advisor. This is the booking's own word on lead source. */
  const tech = body.match(/\b(?:TECH LEAD|LEAD BY)\s+([A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)?)/i);
  const viaPro = /Booked via Scheduling Pro/i.test(body);

  return {
    customer: customer,
    jobNumber: jobNumber,
    jobType: jobType,
    appointmentIso: appointmentIso,
    appointmentAt: appointmentAt,
    assignedHint: keep ? properName_(keep[1].trim()) : "",
    techLead: tech ? properName_(tech[1].trim()) : "",
    /* What the booking implies the source was, for comparison with what the
       rep reported. */
    sourceHint: tech ? "Tech Flip" : (viaPro ? "Web" : ""),
    /* The CSR writes the customer's number on a COW: line, in whatever order
       suits them — "COW: (206) 427-5394 Michael", "COW: Syed (425) 205-3567",
       "COW: JOHN 206-972-1766". Pull the number, ignore the arrangement. */
    phone: (body.match(/COW:[^\n]*?(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})/i) || [])[1] || "",
    hoa: (body.match(/HOA[^\n]*?\(([^)]*)\)/i) || [])[1] || "",
    timeline: cleanValue_((body.match(/timeline[^\n?:]*[?:]\s*([^\n]*)/i) || [])[1] || ""),
    /* Two shapes in the wild — "AGE 13yo" on its own line, and "Age of the
       unit and location? AC 22YO located Right side of garage." Taking the
       text after "AGE" caught the question itself, so the age is read as the
       figure it is. */
    systemAge: (body.match(/\b(\d{1,2})\s*(?:yo\b|yr\b|years?\s+old\b)/i) || [])[1] || "",
    received: received
  };
}

/*
 * "7/29" carries no year. An appointment is booked forward, so it is on or
 * after the alert — a December booking for a January job rolls to next year.
 * A small backward tolerance covers same-day and rescheduled bookings.
 */
function resolveAlertDate_(month, day, received) {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return "";
  const tz = DAILY_RECAP_CONFIG.timeZone;
  const base = received instanceof Date ? received : new Date();
  const year = Number(Utilities.formatDate(base, tz, "yyyy"));
  const candidates = [year, year + 1, year - 1];
  for (let i = 0; i < candidates.length; i++) {
    const d = new Date(candidates[i], month - 1, day, 12, 0, 0);
    if (isNaN(d.getTime())) continue;
    if (d.getMonth() !== month - 1) continue;          // 2/30 and friends
    const drift = (d.getTime() - base.getTime()) / 86400000;
    if (drift >= -7 && drift <= 200) {
      return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  }
  return "";
}

/*
 * Rebuilds the reconciliation from the Job Status tab for the 1:1 page.
 *
 * The tab is the contract between the scheduled refresh and the page: the
 * refresh does the slow work once, this reads it. If the tab has never been
 * written the page simply shows the recap without ServiceTitan context, and
 * says so, rather than blocking on a Gmail search.
 */
function applyJobStatus_(ss, byName, ensure, wanted, fromIso, toIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const refreshedIso = readScriptProperty_("jobStatusRefreshedIso") || "";
  const rows = readSheetRows_(ss, cfg.jobStatusSheetName, JOB_STATUS_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso);

  const status = {
    ok: rows.length > 0,
    source: "Job Status tab",
    refreshed: refreshedIso,
    rowsRead: rows.length,
    unclaimedAppointments: [],
    note: "Sold and install-completed come from ServiceTitan alert emails; " +
          "scheduled install dates come from the COMBO LOG."
  };
  if (!rows.length) {
    status.error = "Job Status has not been built yet — run refreshJobStatus().";
    Object.keys(byName).forEach(n => resetJobFields_(byName[n]));
    return status;
  }

  Object.keys(byName).forEach(n => resetJobFields_(byName[n]));

  rows.forEach(r => {
    const date = String(r[JS.date]);
    const hcaName = String(r[JS.hca] || ""), customer = String(r[JS.customer] || "");
    const reported = String(r[JS.reported]) === "Yes";
    const sold = String(r[JS.sold]) === "Yes";
    const label = String(r[JS.status] || "");

    /* No HCA on the row means a booked job nobody claimed. */
    if (!hcaName) {
      status.unclaimedAppointments.push({
        customer: customer, appointmentIso: date,
        appointmentAt: String(r[JS.appointment] || ""),
        jobNumber: String(r[JS.jobNumber] || ""), jobType: String(r[JS.jobType] || ""),
        sourceHint: String(r[JS.sourceBooked] || ""),
        assignedHint: String(r[JS.dispatch] || "")
      });
      return;
    }
    if (wanted && hcaName.toLowerCase() !== wanted) return;

    /* ensure() may mint a rep who filed no recap at all — exactly the one this
       is here to surface — so the job fields have to be initialised on the way
       in, not only for reps already known. */
    const h = ensure(hcaName);
    if (!h.soldAlerts) resetJobFields_(h);
    const scheduled = String(r[JS.installScheduled] || "");
    const item = {
      customer: customer, jobNumber: String(r[JS.jobNumber] || ""),
      amount: Number(r[JS.amount]) || null, soldOn: String(r[JS.soldOn] || ""),
      soldOnIso: date,
      estimates: decodeEstimates_(r[JS.estimateDetail]),
      multiEstimate: String(r[JS.needsReview]) === "Review",
      reportedOutcome: reported ? String(r[JS.outcome] || "") : null,
      reportedOn: reported ? date : null,
      installScheduledOn: scheduled === "TBD" ? "" : scheduled,
      installTbd: scheduled === "TBD",
      cancelled: /^CANCELLED/.test(label),
      installCompletedOn: String(r[JS.installCompleted] || ""),
      installDescription: String(r[JS.installDescription] || ""),
      comboRepDiffers: String(r[JS.comboRep] || ""),
      comboNotes: String(r[JS.notes] || ""),
      statusLabel: label
    };

    if (reported) {
      const row = (h.rows || []).filter(x => x.date === date && namesMatch_(x.customer, customer))[0];
      if (row) {
        if (r[JS.jobNumber] || r[JS.appointment]) {
          row.booked = {
            jobNumber: String(r[JS.jobNumber] || ""),
            appointmentAt: String(r[JS.appointment] || ""),
            jobType: String(r[JS.jobType] || ""),
            sourceHint: String(r[JS.sourceBooked] || ""),
            assignedHint: String(r[JS.dispatch] || ""),
            systemAge: String(r[JS.systemAge] || ""),
            timeline: String(r[JS.timeline] || "")
          };
          const booked = String(r[JS.sourceBooked] || ""), said = String(r[JS.sourceReported] || "");
          if (booked && said && normName_(booked) !== normName_(said)) {
            row.sourceHintDiffers = booked;
          }
        }
        row.statusLabel = label;
      }
    }

    if (sold) {
      h.soldAlerts.push(item);
      if (!reported) h.soldNotReported.push(item);
      else if (item.reportedOutcome !== "SOLD") h.statusDrift.push(item);
      if (item.installCompletedOn) h.installed.push(item);
    }
  });

  /* Email notes hang off the same date|HCA|customer key the job rows use. */
  const notesByKey = {};
  readSheetRows_(ss, cfg.emailNotesSheetName, EMAIL_NOTE_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso)
    .forEach(r => {
      const key = String(r[8] || "");
      if (!notesByKey[key]) notesByKey[key] = [];
      notesByKey[key].push({
        date: String(r[3] || ""), from: String(r[4] || ""),
        subject: String(r[5] || ""), summary: String(r[6] || ""),
        link: String(r[7] || "")
      });
    });

  Object.keys(byName).forEach(name => {
    const h = byName[name];
    if (!h.soldAlerts) resetJobFields_(h);
    const attach = (date, customer, target) => {
      const hit = notesByKey[recapRowKey_(date, name, customer)];
      if (hit && hit.length) target.emailNotes = hit;
    };
    (h.rows || []).forEach(r => attach(r.date, r.customer, r));
    h.soldAlerts.forEach(s => attach(s.soldOnIso, s.customer, s));
    h.soldPerServiceTitan = h.soldAlerts.length;
    h.soldAmountPerServiceTitan = roundCents_(h.soldAlerts.reduce(
      (t, s) => t + (isFinite(s.amount) && s.amount ? s.amount : 0), 0));
    h.soldAmountNeedsReview = h.soldAlerts.some(s => s.multiEstimate);
    h.bookedMatched = (h.rows || []).filter(r => r.booked).length;
    h.reportedNotBooked = (h.rows || [])
      .filter(r => !r.booked && r.customer)
      .map(r => ({ date: r.date, customer: r.customer, source: r.source, outcome: r.outcome }));
  });

  status.unclaimedAppointments.sort((a, b) =>
    String(b.appointmentIso).localeCompare(String(a.appointmentIso)));
  return status;
}

function resetJobFields_(h) {
  h.soldAlerts = []; h.statusDrift = []; h.soldNotReported = []; h.installed = [];
  h.reportedNotBooked = []; h.bookedMatched = 0;
  h.soldPerServiceTitan = 0; h.soldAmountPerServiceTitan = 0;
  h.soldAmountNeedsReview = false;
}

const JOB_STATUS_HEADERS = [
  "Date", "HCA", "Customer", "Reported", "Outcome Reported", "Lead Source Reported",
  "Booked Job#", "Appointment", "Job Type", "Lead Source (Booked)", "Dispatch Note",
  "System Age", "Timeline",
  "Sold", "Sold Amount", "Sold On", "Estimates", "Estimate Detail", "Amount Needs Review",
  "Install Scheduled", "Install Completed", "Install Description",
  "COMBO Sales Rep", "Notes",
  "Status", "Updated At", "Key"
];

/* Column indices, named because a 27-wide row addressed by number is a bug
   waiting to happen. */
const JS = {
  date: 0, hca: 1, customer: 2, reported: 3, outcome: 4, sourceReported: 5,
  jobNumber: 6, appointment: 7, jobType: 8, sourceBooked: 9, dispatch: 10,
  systemAge: 11, timeline: 12,
  sold: 13, amount: 14, soldOn: 15, estimateCount: 16, estimateDetail: 17,
  needsReview: 18, installScheduled: 19, installCompleted: 20, installDescription: 21,
  comboRep: 22, notes: 23, status: 24, updatedAt: 25, key: 26
};

/* "12000@7/30 | 348.13@7/31" — enough to show the lines behind a multi-estimate
   job without a second sheet. */
function encodeEstimates_(estimates) {
  return (estimates || []).map(e =>
    (e.amount === null || e.amount === undefined ? "" : e.amount) + "@" + (e.soldOn || "")
  ).join(" | ");
}

function decodeEstimates_(text) {
  return String(text || "").split("|").map(part => {
    const bits = part.split("@");
    const amount = Number(String(bits[0] || "").trim());
    return { amount: isFinite(amount) && bits[0].trim() !== "" ? amount : null,
             soldOn: String(bits[1] || "").trim() };
  }).filter(e => e.amount !== null || e.soldOn);
}

/*
 * The reconciled view, written to the tracker on a schedule.
 *
 *   booked alert  ─┐
 *   sold alert    ─┼─> name match against the recap replies ─> Job Status tab
 *   COMBO LOG     ─┘                                              │
 *                                                                 v
 *                                                        1:1 HCA scheduler
 *
 * Doing the Gmail and COMBO LOG reads here rather than inside doGet matters:
 * three searches over hundreds of threads on every page load would be slow,
 * would burn quota, and would give a different answer each time. This runs
 * after the nightly collect and again mid-morning, and the page reads a sheet.
 *
 * It also puts the whole reconciliation somewhere a person can look at it,
 * which is the point of calling it a tracker.
 */
function refreshJobStatus() {
  const cfg = DAILY_RECAP_CONFIG;
  const days = cfg.jobStatusDays;
  const today = new Date();
  const fromIso = Utilities.formatDate(new Date(today.getTime() - (days - 1) * 86400000),
    cfg.timeZone, "yyyy-MM-dd");
  const toIso = Utilities.formatDate(today, cfg.timeZone, "yyyy-MM-dd");

  const book = getLogSpreadsheet_();
  const allLogRows = readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso);

  const byName = {};
  const ensure = name => {
    if (!byName[name]) byName[name] = { name: name, rows: [] };
    return byName[name];
  };
  allLogRows.forEach(r => {
    ensure(String(r[1])).rows.push({
      date: String(r[0]), customer: String(r[2] || ""), source: String(r[3] || ""),
      outcome: String(r[4] || "NOT GIVEN")
    });
  });

  /* Which days the recap actually ran. An appointment is only "unreported" if
     somebody was asked to report it — before the recap existed, nobody was.
     Reading it from the compliance tab rather than a hardcoded launch date
     means this stays right through any future gap: a week the script was off
     is not a week of ten reps ignoring it. */
  const askedOn = {};
  readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length)
    .forEach(r => { if (r[0]) askedOn[String(r[0])] = true; });

  const status = reconcileWithServiceTitan_(byName, ensure, "", days,
    { allLogRows: allLogRows, fromIso: fromIso, toIso: toIso, askedOn: askedOn });

  const written = writeJobStatus_(book.ss, byName, status, fromIso, toIso);
  const notes = writeEmailNotes_(book.ss, byName, status, fromIso, toIso);
  const work = writeFollowUps_(book.ss, allLogRows, status, toIso);
  [cfg.logSheetName, cfg.complianceSheetName, cfg.followUpsSheetName,
   cfg.jobStatusSheetName, cfg.emailNotesSheetName].forEach(n => applySheetLayout_(book.ss, n));

  /* Puts the Today tab back if it was deleted, and leaves it alone otherwise. */
  ensureLiveTabs_(book.ss);

  PropertiesService.getScriptProperties()
    .setProperty("jobStatusRefreshedIso", new Date().toISOString());

  Logger.log("Job Status: " + written.rows + " rows, " +
    written.needsAttention + " needing attention, " + notes.rows + " email notes, " +
    work.rows + " open follow-ups (" + work.overdue + " overdue, " +
    work.undated + " with no date). " +
    (status.bookedBeforeRecapStarted || 0) + " booked job(s) skipped — " +
    "before the recap started.");
  return { rows: written.rows, needsAttention: written.needsAttention,
           emailNotes: notes.rows, followUps: work.rows, status: status };
}

/*
 * The worklist. Every open appointment, soonest first, with the objection and
 * the customer's phone where a booking gave one.
 *
 * Derived rather than stored: it is rebuilt from Recap Log each refresh, so
 * nothing has to be kept in sync and the existing tabs keep their schema.
 * Sold jobs drop off — they belong to the Job Status tab now.
 *
 * Undated rows sort to the bottom under a far-future key rather than being
 * hidden. A deal with no next step is the one most likely to die, so it has
 * to stay visible; it just should not sit above something due today.
 */
function writeFollowUps_(ss, allLogRows, status, todayIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.followUpsSheetName, FOLLOWUP_HEADERS);

  /* Phone numbers only exist where ServiceTitan booked the job, so this is
     best-effort by design — most appointments have no booking behind them. */
  const phoneFor = {};
  (status.bookedContacts || []).forEach(c => {
    if (c.customer && c.phone) phoneFor[normName_(c.customer)] = c.phone;
  });

  const rows = [];
  (allLogRows || []).forEach(r => {
    const outcome = String(r[4] || "");
    if (outcome === "SOLD") return;                    // closed; Job Status owns it
    const ranOn = String(r[0] || "");
    const customer = String(r[2] || "");
    const dueIso = parseFollowUpDate_(r[9], ranOn);
    const age = daysBetweenIso_(ranOn, todayIso);

    rows.push([
      dueIso || "",
      dueIso ? dueLabel_(dueIso, todayIso) : "NO DATE SET",
      String(r[1] || ""),
      customer || "(not named)",
      outcome,
      String(r[5] || ""),
      r[6] === "" || r[6] === null ? "" : Number(r[6]),
      String(r[10] || ""),
      phoneFor[normName_(customer)] || "",
      ranOn,
      age === null ? "" : age,
      String(r[9] || ""),                              // exactly what they typed
      recapRowKey_(ranOn, String(r[1] || ""), customer)
    ]);
  });

  /* Undated last, then by due date, then oldest appointment first. */
  rows.sort((a, b) => {
    const ka = a[0] || "9999-12-31", kb = b[0] || "9999-12-31";
    return ka.localeCompare(kb) || String(a[9]).localeCompare(String(b[9]));
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, FOLLOWUP_HEADERS.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, FOLLOWUP_HEADERS.length).setValues(rows);
  }

  return {
    rows: rows.length,
    overdue: rows.filter(r => r[0] && r[0] < todayIso).length,
    undated: rows.filter(r => !r[0]).length
  };
}

/* Plain English beats a raw date for the column you scan first. */
function dueLabel_(dueIso, todayIso) {
  const n = daysBetweenIso_(todayIso, dueIso);
  if (n === null) return "";
  if (n < -1) return "OVERDUE " + Math.abs(n) + " days";
  if (n === -1) return "OVERDUE yesterday";
  if (n === 0) return "TODAY";
  if (n === 1) return "tomorrow";
  if (n <= 7) return "in " + n + " days";
  return "in " + n + " days";
}

function daysBetweenIso_(fromIso, toIso) {
  const a = isoToDate_(fromIso), b = isoToDate_(toIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/*
 * One Gmail search per customer in the window, run here rather than per page
 * load. Roughly one search per job twice a day, which is nothing next to
 * doing it every time somebody opens a 1:1.
 */
function writeEmailNotes_(ss, byName, status, fromIso, toIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.emailNotesSheetName, EMAIL_NOTE_HEADERS);
  const stamp = new Date();
  const rows = [];
  const done = {};

  const collect = (date, hcaName, customer) => {
    const key = recapRowKey_(date, hcaName, customer);
    if (done[key] || !customer) return;
    done[key] = true;
    readEmailNotes_(customer, DAILY_RECAP_CONFIG.emailNoteLookbackDays).forEach(n => {
      rows.push([date, hcaName, customer, n.threadDate, n.from, n.subject,
        n.summary, n.link, key]);
    });
  };

  Object.keys(byName).sort().forEach(name => {
    const h = byName[name];
    (h.rows || []).forEach(r => collect(r.date, name, r.customer));
    (h.soldNotReported || []).forEach(s => collect(s.soldOnIso || toIso, name, s.customer));
  });
  /* Unclaimed appointments too — an email may be the only thing that says
     what happened to it. */
  (status.unclaimedAppointments || []).forEach(u =>
    collect(u.appointmentIso, "", u.customer));

  const existing = readSheetRows_(ss, DAILY_RECAP_CONFIG.emailNotesSheetName, EMAIL_NOTE_HEADERS.length);
  const kept = existing.filter(r => {
    const d = String(r[0]);
    return d && (d < fromIso || d > toIso);
  });
  const all = kept.concat(rows);
  all.sort((a, b) => String(b[0]).localeCompare(String(a[0])) ||
    String(b[3]).localeCompare(String(a[3])));

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, EMAIL_NOTE_HEADERS.length).clearContent();
  }
  if (all.length) {
    sheet.getRange(2, 1, all.length, EMAIL_NOTE_HEADERS.length).setValues(all);
  }
  return { rows: all.length };
}

/*
 * Rewrites the window rather than appending. A job's status genuinely changes
 * — booked becomes sold becomes installed — so an append-only log would fill
 * with contradictory rows about the same job. Rows outside the window are left
 * untouched, so history survives.
 */
function writeJobStatus_(ss, byName, status, fromIso, toIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.jobStatusSheetName, JOB_STATUS_HEADERS);
  const stamp = new Date();
  const rows = [];
  const seen = {};

  const push = row => {
    const key = row[JS.key];
    if (seen[key]) return;
    seen[key] = true;
    rows.push(row);
  };

  Object.keys(byName).sort().forEach(name => {
    const h = byName[name];
    const soldFor = c => (h.soldAlerts || []).filter(s => namesMatch_(s.customer, c))[0] || null;

    (h.rows || []).forEach(r => {
      const s = soldFor(r.customer);
      const b = r.booked || {};
      push([
        r.date, name, r.customer, "Yes", r.outcome, r.source,
        b.jobNumber || "", b.appointmentAt || "", b.jobType || "",
        b.sourceHint || "", b.assignedHint || "", b.systemAge || "", b.timeline || "",
        s ? "Yes" : "", s && s.amount ? s.amount : "", s ? s.soldOn : "",
        s && s.estimates ? s.estimates.length : "",
        s ? encodeEstimates_(s.estimates) : "",
        s && s.multiEstimate ? "Review" : "",
        s ? (s.installScheduledOn || (s.installTbd ? "TBD" : "")) : "",
        s ? (s.installCompletedOn || "") : "",
        s ? (s.installDescription || "") : "",
        s && s.comboRepDiffers ? s.comboRepDiffers : "",
        s ? (s.comboNotes || "") : "",
        jobStatusLabel_(r, s), stamp,
        recapRowKey_(r.date, name, r.customer)
      ]);
    });

    /* Sold with no recap row at all. */
    (h.soldNotReported || []).forEach(s => {
      const date = s.soldOnIso || s.reportedOn || toIso;
      push([
        date, name, s.customer, "No", "", "",
        "", "", "", "", "", "", "",
        "Yes", s.amount || "", s.soldOn || "",
        s.estimates ? s.estimates.length : "", encodeEstimates_(s.estimates),
        s.multiEstimate ? "Review" : "",
        s.installScheduledOn || (s.installTbd ? "TBD" : ""), s.installCompletedOn || "",
        s.installDescription || "",
        s.comboRepDiffers || "", s.comboNotes || "",
        "NEEDS ATTENTION — sold, never reported", stamp,
        recapRowKey_(date, name, s.customer)
      ]);
    });
  });

  /* Booked, the day has passed, nobody reported it. No HCA, because the alert
     names none — the dispatch note is the only clue and it goes in its column. */
  (status.unclaimedAppointments || []).forEach(u => {
    push([
      u.appointmentIso, "", u.customer, "No", "", "",
      u.jobNumber || "", u.appointmentAt || "", u.jobType || "",
      u.sourceHint || "", u.assignedHint || "", "", "",
      "", "", "", "", "", "",
      "", "", "", "", "",
      "UNCLAIMED — booked, no recap", stamp,
      recapRowKey_(u.appointmentIso, "", u.customer)
    ]);
  });

  /* Replace only the window. Anything older stays where it is. */
  const existing = readSheetRows_(ss, DAILY_RECAP_CONFIG.jobStatusSheetName, JOB_STATUS_HEADERS.length);
  const kept = existing.filter(r => {
    const d = String(r[0]);
    return d && (d < fromIso || d > toIso);
  });

  const all = kept.concat(rows);
  all.sort((a, b) => String(b[0]).localeCompare(String(a[0])) ||
    String(a[1]).localeCompare(String(b[1])));

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, JOB_STATUS_HEADERS.length).clearContent();
  }
  if (all.length) {
    sheet.getRange(2, 1, all.length, JOB_STATUS_HEADERS.length).setValues(all);
  }

  return {
    rows: all.length,
    needsAttention: rows.filter(r => /NEEDS ATTENTION|UNCLAIMED/.test(String(r[JS.status]))).length
  };
}

/*
 * The one-line answer to "where does this job actually stand", using the same
 * vocabulary as the sold tracker so the two read alike.
 */
function jobStatusLabel_(row, sold) {
  if (!sold) {
    if (row.outcome === "SOLD") return "REPORTED SOLD — no ServiceTitan alert yet";
    return "OPEN — " + (row.outcome || "not given");
  }
  /* Cancelled outranks everything. A job that came back off the board is not
     sold, however many alerts fired for it. */
  if (sold.cancelledOn) return "CANCELLED " + sold.cancelledOn +
    (sold.cancelledReason ? " — " + sold.cancelledReason : "");
  if (sold.installCompletedOn) return "INSTALLED " + sold.installCompletedOn;
  if (sold.installCompletedPerCombo && sold.installScheduledOn) {
    return "INSTALLED " + sold.installScheduledOn + " — per the COMBO LOG";
  }
  if (row.outcome !== "SOLD") return "STATUS DRIFT — reported " +
    String(row.outcome || "open").toLowerCase() + ", ServiceTitan says sold";
  if (sold.installScheduledOn) return "SOLD — install " + sold.installScheduledOn;
  if (sold.installTbd) return "SOLD — install TBD on the COMBO LOG";
  return "SOLD — no COMBO LOG row found";
}

const FOLLOWUP_HEADERS = [
  "Due", "Due In", "HCA", "Customer", "Outcome", "Offered", "Amount",
  "Objection", "Phone", "Ran On", "Age (days)", "What They Said", "Key"
];

/*
 * Turns what a rep actually typed into a date that sorts.
 *
 * Eight appointments on the first night produced seven formats: "7/31",
 * "Monday", "tomorrow-Fri-7/31/26", "calling her back at 12:30 tomorrow",
 * "Monday (layout review with Lyle)", "no Date scheduled", "no follow up
 * date". Left as text the column cannot be sorted or filtered, so the log is
 * a record and never a worklist.
 *
 * Returns "" for anything that is not a date — including the several ways
 * reps write "there isn't one", which is the answer that matters most because
 * those are the deals that quietly die.
 */
function parseFollowUpDate_(text, contextIso) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  /* "no follow up date", "no Date scheduled", "none", "tbd". Checked first:
     "no Date scheduled" contains no digits but does contain a weekday-ish
     word in other phrasings, and must never resolve to a real day. */
  if (/\b(no|none|not|n\/a|na|tbd|unknown)\b/i.test(raw) && !/\d/.test(raw)) return "";
  if (/^\s*(none|n\/a|na|tbd)\s*$/i.test(raw)) return "";

  const base = isoToDate_(contextIso) || new Date();
  const tz = DAILY_RECAP_CONFIG.timeZone;
  const dayMs = 86400000;

  /* An explicit M/D wins over everything — "tomorrow-Fri-7/31/26" is both a
     word and a date, and the date is the precise one. */
  const md = raw.match(/\b(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?\b/);
  if (md) {
    const stated = md[3] ? (Number(md[3]) < 100 ? Number(md[3]) + 2000 : Number(md[3])) : null;
    let year = stated === null ? Number(Utilities.formatDate(base, tz, "yyyy")) : stated;
    let d = new Date(year, Number(md[1]) - 1, Number(md[2]), 12, 0, 0);
    /* A follow-up is always ahead of the appointment. "1/5" written on 12/30
       means January next year — taking the appointment's year would file it
       eleven months in the past and it would never surface as due. Only when
       the rep did not state a year; if they wrote one, believe them. */
    if (stated === null && d.getTime() < base.getTime() - 86400000) {
      d = new Date(year + 1, Number(md[1]) - 1, Number(md[2]), 12, 0, 0);
    }
    if (!isNaN(d.getTime()) && d.getMonth() === Number(md[1]) - 1) {
      return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  }

  if (/\btomorrow\b/i.test(raw)) {
    return Utilities.formatDate(new Date(base.getTime() + dayMs), tz, "yyyy-MM-dd");
  }
  if (/\btoday\b|\btonight\b/i.test(raw)) {
    return Utilities.formatDate(base, tz, "yyyy-MM-dd");
  }

  /* A bare weekday means the next one coming, which is how anyone reading
     "Monday" on a Thursday would take it. */
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = raw.toLowerCase().match(/\b(sun|mon|tues?|wed(nes)?|thur?s?|fri|sat(ur)?)(day)?\b/);
  if (wd) {
    const stem = wd[0].replace(/day$/, "");
    let target = -1;
    DAYS.forEach((d, i) => { if (target === -1 && d.indexOf(stem) === 0) target = i; });
    if (target !== -1) {
      const from = new Date(base.getTime());
      for (let i = 1; i <= 7; i++) {
        const cand = new Date(from.getTime() + i * dayMs);
        if (Number(Utilities.formatDate(cand, tz, "u")) % 7 === target) {
          return Utilities.formatDate(cand, tz, "yyyy-MM-dd");
        }
      }
    }
  }

  return "";
}

function isoToDate_(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

const EMAIL_NOTE_HEADERS = [
  "Job Date", "HCA", "Customer", "Thread Date", "From", "Subject", "Summary", "Link", "Key"
];

/*
 * Everything said about a homeowner by email, attached to their job.
 *
 * The most useful thing about a deal is often nowhere in ServiceTitan. It is
 * Amy asking "do we have a date for this customer?", Amber answering
 * "commercial, waiting on permitting, tentatively 8.13 and 8.14", Sabrina
 * adding "LEFT VM WITH CITY TO VERIFY". A 1:1 that knows that is a different
 * conversation from one that does not.
 *
 * Rules that keep this useful rather than noisy:
 *
 *   - ServiceTitan alerts are excluded. They are the thing being reconciled,
 *     not commentary on it, and they would drown everything else.
 *   - The recap threads themselves are excluded, for the same reason.
 *   - Only the sender's own words are kept, not the quoted chain, so a
 *     ten-message thread does not repeat itself ten times.
 *   - Short names are not searched alone. "Ray" or "Lin" would match half the
 *     mailbox; a full-name search that finds nothing is better than a
 *     one-word search that finds everything.
 */
function readEmailNotes_(customer, sinceDays) {
  const name = String(customer || "").trim();
  if (name.length < 4) return [];

  const exclude = ' -from:alerts@servicetitan.com -subject:"Daily Recap"';
  const window = " newer_than:" + Math.max(7, Math.min(180, sinceDays || 60)) + "d";

  let threads = [];
  try {
    threads = GmailApp.search('"' + name.replace(/"/g, "") + '"' + exclude + window, 0, 8);
    /* A full name often appears only as a surname in internal mail — "any
       updates on Manrao?" — so fall back, but only to a token long enough to
       be distinctive on its own. */
    if (!threads.length) {
      const tokens = name.split(/\s+/).filter(t => t.length >= 6 && !/^and$/i.test(t));
      const distinctive = tokens[tokens.length - 1];
      if (distinctive) {
        threads = GmailApp.search('"' + distinctive + '"' + exclude + window, 0, 8);
      }
    }
  } catch (err) {
    Logger.log("Email note search failed for " + name + ": " + err);
    return [];
  }

  const notes = [];
  threads.forEach(thread => {
    let messages = [];
    try { messages = thread.getMessages(); } catch (err) { return; }
    /* The last word on a thread is the one that matters at a 1:1. */
    const msg = messages[messages.length - 1];
    if (!msg) return;
    const who = senderName_(msg.getFrom());
    const summary = summariseEmail_(msg.getPlainBody(), who);
    if (!summary) return;
    notes.push({
      threadDate: Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd"),
      from: who,
      /* "Re: FW: Sold Estimate Alert" needs every prefix off, not the first. */
      subject: String(msg.getSubject() || "").replace(/^((re|fw|fwd)\s*:\s*)+/i, "").trim(),
      summary: summary,
      link: "https://mail.google.com/mail/u/0/#all/" + thread.getId(),
      received: msg.getDate()
    });
  });

  notes.sort((a, b) => b.received - a.received);
  return notes.slice(0, 4);
}

/*
 * The sender's own words, trimmed to something readable at a glance.
 *
 * Everyone at CM Heating signs with name, title, direct line, address. The
 * signature has to be cut rather than filtered line by line: "Amber Maddalena"
 * and "Comfort Advisor" are perfectly ordinary-looking lines, and only their
 * position after the message gives them away. So the first signature marker
 * ends the message, and nothing after it is kept.
 */
function summariseEmail_(body, senderName) {
  const own = ownText_(body);
  const who = normName_(senderName);
  const out = [];

  const linesAll = String(own || "").split(/\r?\n/).map(l => l.trim());
  for (let i = 0; i < linesAll.length; i++) {
    const line = linesAll[i];
    if (!line) continue;

    /* Signature starts here — stop, do not merely skip. */
    if (who && normName_(line) === who) break;
    if (line.length < 45 && /\b(advisor|manager|coordinator|consultant|supervisor|director|specialist|representative|technician)\s*$/i.test(line)) break;
    if (/cmheating\.com|^www\.|\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/i.test(line)) break;
    if (/^(warmest regards|regards|thank you|thanks|best|sincerely)[,!]?\s*$/i.test(line)) break;

    /* Quote scaffolding, not signature — skip and keep reading. */
    if (isSignOffLine_(line.toLowerCase())) continue;
    if (/^(on .*wrote:|from:|sent:|to:|cc:|subject:)/i.test(line)) continue;
    if (/^[-_=]{3,}$/.test(line)) continue;

    out.push(line);
    if (out.length >= 3) break;
  }

  const text = out.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= 220) return text;
  return text.slice(0, 217).replace(/\s+\S*$/, "") + "...";
}

function senderName_(from) {
  const m = String(from || "").match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  return String(from || "").replace(/@cmheating\.com/i, "").trim();
}

/* ---- COMBO LOG ------------------------------------------------------------
 *
 * The one place a *scheduled* install date exists. sold-job-tracker-sync.gs
 * already reads this sheet the same way; the logic is duplicated rather than
 * shared because the two scripts are separate Apps Script projects.
 *
 * A sheet whose name contains TBD holds jobs with no date yet — permits,
 * equipment, customer availability. Those are exactly the ones worth raising,
 * so they are kept and marked rather than dropped.
 */
function readComboInstalls_() {
  const id = DAILY_RECAP_CONFIG.comboLogSpreadsheetId;
  if (!id) return { ok: true, installs: [], cancellations: [], skipped: "no COMBO LOG id configured" };

  let ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (err) {
    Logger.log("COMBO LOG unreachable: " + err);
    return { ok: false, installs: [], cancellations: [] };
  }

  const installs = [];
  const cancellations = [];
  /* The COMBO LOG is edited by hand and carries tabs this code knows nothing
     about. One odd sheet must not take down the whole refresh, so each is
     read on its own. */
  ss.getSheets().forEach(sheet => {
   try {
    const name = sheet.getName();
    const last = sheet.getLastRow(), width = sheet.getLastColumn();
    if (last < 2 || width < 2) return;

    const values = sheet.getRange(1, 1, last, width).getValues();
    const header = values[0].map(h => String(h || "").trim().toUpperCase());
    const col = label => header.indexOf(label);

    /* The cancelled tab is shaped differently — one CUSTOMER NAME column, a
       REASON, and a CONSULTANT rather than a SALES REP. It is the only place
       that records a sale coming back off the board, so a job that shows
       SOLD forever is exactly what missing it produces. */
    const iCancelled = col("DATE CANCELLED");
    if (iCancelled !== -1 && col("CUSTOMER NAME") !== -1) {
      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        const who = String(row[col("CUSTOMER NAME")] || "").trim();
        if (!who) continue;
        const at = c => (c === -1 ? "" : String(row[c] || "").trim());
        cancellations.push({
          customer: who,
          reason: at(col("REASON")),
          consultant: at(col("CONSULTANT")),
          department: at(col("DEPARTMENT")),
          soldOn: comboDateIso_(row[col("DATE SOLD")]),
          cancelledOn: comboDateIso_(row[iCancelled]),
          refund: at(col("REFUND REQUESTED?")),
          sourceSheet: name
        });
      }
      return;
    }

    const iLast = col("LAST"), iFirst = col("FIRST"), iDate = col("DATE");
    if (iLast === -1 && iFirst === -1) return;         // not a job sheet

    /* Tabs are classified by name rather than hardcoded, because the log is
       reorganised by hand. TBD holds jobs with no date yet — permits,
       equipment, customer availability — which are the ones worth raising. */
    const isTbd = /\bTBD\b/i.test(name);
    const isCompleted = /COMPLET/i.test(name);

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const first = String(row[iFirst] || "").trim();
      const surname = String(row[iLast] || "").trim();
      if (!first && !surname) continue;
      const at = c => (c === -1 ? "" : String(row[c] || "").trim());
      const dated = iDate === -1 ? "" : comboDateIso_(row[iDate]);
      installs.push({
        customer: [first, surname].filter(Boolean).join(" "),
        installDate: dated,
        /* A row can say TBD in its date cell on any tab. */
        isTbd: isTbd || !dated,
        isCompleted: isCompleted,
        salesRep: at(col("SALES REP")),
        jobNotes: at(col("JOB NOTES")),
        permitNotes: at(col("PERMIT NOTES")),
        /* On the TBD tab this column is repurposed as a live action note —
           "EMAILED JAY 7/29 AL", "AMBER IS WORKING ON THIS 7/29 AL" — which
           is the most current word on the job anywhere. */
        jobCompleted: at(col("JOB COMPLETED")),
        sourceSheet: name
      });
    }
   } catch (err) {
    Logger.log("COMBO LOG sheet skipped: " + err);
   }
  });
  return { ok: true, installs: installs, cancellations: cancellations };
}

function comboDateIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  }
  const text = String(value || "").trim();
  if (!text) return "";

  /* A cell formatted as a date comes back as a Date and is handled above, but
     a tab whose column was pasted as text hands back "2026-08-05". Reading that
     as no date at all is what makes a scheduled install show as TBD. */
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;

  const m = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (!m) return "";
  let year = m[3] ? Number(m[3]) : Number(Utilities.formatDate(new Date(),
    DAILY_RECAP_CONFIG.timeZone, "yyyy"));
  if (year < 100) year += 2000;
  const d = new Date(year, Number(m[1]) - 1, Number(m[2]), 12, 0, 0);
  if (isNaN(d.getTime()) || d.getMonth() !== Number(m[1]) - 1) return "";
  return Utilities.formatDate(d, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
}

function readSheetRows_(ss, name, width) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, width).getValues();
}

/* ---------------------------------------------------------------- triggers */

function installDailyRecapTriggers() {
  deleteDailyRecapTriggers_();
  const cfg = DAILY_RECAP_CONFIG;

  ScriptApp.newTrigger("sendDailyRecap")
    .timeBased()
    .everyDays(1)
    .atHour(cfg.sendHour)
    .inTimezone(cfg.timeZone)
    .create();

  ScriptApp.newTrigger("collectRecapReplies")
    .timeBased()
    .everyDays(1)
    .atHour(cfg.collectHour)
    .nearMinute(cfg.collectMinute)
    .inTimezone(cfg.timeZone)
    .create();

  if (cfg.nudgeEnabled) {
    ScriptApp.newTrigger("sendMorningNudgeWorkingToday")
      .timeBased().everyDays(1).atHour(cfg.nudgeHourWorking)
      .inTimezone(cfg.timeZone).create();

    ScriptApp.newTrigger("sendMorningNudgeOffToday")
      .timeBased().everyDays(1).atHour(cfg.nudgeHourOff)
      .inTimezone(cfg.timeZone).create();
  }

  /* Hourly, silent, idempotent. Puts an answer in the log within the hour it
     arrives instead of waiting for the next digest. */
  ScriptApp.newTrigger("sweepRecapReplies")
    .timeBased().everyHours(1).create();

  /* Late enough that a rep who answers first thing is already counted. */
  ScriptApp.newTrigger("sendMorningSalesBrief")
    .timeBased().everyDays(1).atHour(cfg.morningBriefHour)
    .inTimezone(cfg.timeZone).create();

  /* Twice a day. Late evening picks up the night's replies against the day's
     alerts; late morning catches sales and installs that landed overnight, so
     a 1:1 at 10am is not reading yesterday's picture. */
  ScriptApp.newTrigger("refreshJobStatus")
    .timeBased().everyDays(1).atHour(22).inTimezone(cfg.timeZone).create();
  ScriptApp.newTrigger("refreshJobStatus")
    .timeBased().everyDays(1).atHour(9).inTimezone(cfg.timeZone).create();

  Logger.log("Installed daily recap triggers (send " + cfg.sendHour + ":00, collect " +
    cfg.collectHour + ":" + pad2_(cfg.collectMinute) +
    (cfg.nudgeEnabled ? ", nudge " + cfg.nudgeHourWorking + ":00 working / " +
      cfg.nudgeHourOff + ":00 off" : ", chase folded into the " + cfg.sendHour + ":00 send") +
    ", reply sweep hourly, sales brief " + cfg.morningBriefHour + ":00" +
    ", job status 9:00 and 22:00 " + cfg.timeZone + ").");
}

function deleteDailyRecapTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === "sendDailyRecap" || fn === "collectRecapReplies" ||
        fn === "sendMorningNudgeWorkingToday" || fn === "sendMorningNudgeOffToday" ||
        fn === "sweepRecapReplies" || fn === "sendMorningSalesBrief" ||
        fn === "refreshJobStatus") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/* ----------------------------------------------------------------- preview */

/* Sends nothing. Logs exactly who tonight's send would go to and why. */
function previewDailyRecap() {
  const plan = buildTodayPlan_(new Date());
  Logger.log("Mode: " + (isTestMode_() ? "TEST" : "LIVE"));
  Logger.log("Date: " + plan.dateLabel + " (" + plan.weekday + ")");
  Logger.log("Exceptions sheet: " + (plan.exceptions.ok
    ? "OK, " + plan.exceptions.count + " row(s) for today"
    : "UNREADABLE — " + plan.exceptions.error));
  Logger.log("Would email " + plan.working.length + ":");
  plan.working.forEach(h => Logger.log("   " + h.name + " <" + h.email + ">" + (h.note ? "  [" + h.note + "]" : "")));
  Logger.log("Skipped " + plan.skipped.length + ":");
  plan.skipped.forEach(s => Logger.log("   " + s.name + "  [" + s.reason + "]"));
  return plan;
}

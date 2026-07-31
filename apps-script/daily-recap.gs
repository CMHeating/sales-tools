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
 *   4. Leave TEST_MODE true until the email looks right, then set it to false.
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

  sendHour: 18,                     // 6:00pm Pacific
  collectHour: 20,                  // 8:15pm Pacific
  collectMinute: 15,
  replyLookbackDays: 2,

  /* Morning nudge for anyone who was scheduled yesterday and never replied.
     Split by whether they are working the day the nudge goes out: people on
     shift get it at 7, people on a day off get an extra hour. */
  nudgeEnabled: true,
  nudgeHourWorking: 7,
  nudgeHourOff: 8
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

function sendDailyRecap() {
  const now = new Date();
  const plan = buildTodayPlan_(now);

  if (!plan.working.length) {
    Logger.log("No HCAs scheduled for " + plan.dateLabel + ". Nothing sent.");
    return plan;
  }

  if (DAILY_RECAP_CONFIG.TEST_MODE) {
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.testRecipient],
      subject: DAILY_RECAP_CONFIG.testSubjectPrefix + " — " + plan.dateLabel,
      body: buildTestModeBody_(plan)
    });
    Logger.log("TEST_MODE: one preview email sent to " + DAILY_RECAP_CONFIG.testRecipient +
      " covering " + plan.working.length + " HCA(s). No HCA was contacted.");
    return plan;
  }

  plan.working.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      subject: DAILY_RECAP_CONFIG.subjectPrefix + " — " + plan.dateLabel,
      body: buildRecapBody_(hca, plan.dateLabel)
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

  Logger.log("Sent recap to " + plan.working.length + " HCA(s) for " + plan.dateLabel);
  return plan;
}

function buildRecapBody_(hca, dateLabel) {
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
  return "Hi " + hca.first + ",\n\n" +
    "One block per appointment you ran today (" + dateLabel + ").\n" +
    "No appointments? Reply None and just fill in the last line.\n\n" +
    "Customer:\n" +
    "Source (Web / Inbound / Tech Flip / Revisit):\n" +
    "Outcome (Sold / Estimate / Follow-up):\n" +
    "Offered (package + price):\n" +
    "Water heater (Y/N + interest):\n" +
    "Next follow-up:\n" +
    "Objection (if not sold):\n\n" +
    "Ran more than one? Paste the block again below it.\n\n" +
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
  lines.push("To go live, set TEST_MODE to false in DAILY_RECAP_CONFIG.");
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

  if (cfg.TEST_MODE) {
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
  let logResult = { ok: false, error: "", written: 0, skipped: 0, url: "", created: false };
  try {
    const book = getLogSpreadsheet_();
    const wrote = appendRecapRows_(book.ss, plan, byHca);
    appendComplianceRows_(book.ss, plan, byHca, responded, followUpsByHca);
    logResult = {
      ok: true, error: "", written: wrote.written, skipped: wrote.skipped,
      url: book.ss.getUrl(), created: book.created
    };
  } catch (err) {
    logResult.error = err && err.message ? err.message : String(err);
    Logger.log("Recap log write failed: " + logResult.error);
  }

  const body = buildDigestBody_(plan, byHca, missing, late, logResult, notesOnly, followUpsByHca);
  sendEmailSafe_({
    to: [DAILY_RECAP_CONFIG.managerEmail],
    subject: (DAILY_RECAP_CONFIG.TEST_MODE ? "[TEST] " : "") +
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
function findRecapReplies_(dateLabel, sinceDate, lookbackDays) {
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

  threads.forEach(thread => {
    const messages = thread.getMessages();

    /* Which night this thread belongs to is decided from any message in it,
       the same way the morning run does. Reading it off the rep's own subject would
       lose a reply whenever their client rewrote it. */
    let threadIsTonight = false;
    messages.forEach(m => {
      if (String(m.getSubject() || "").indexOf(dateLabel) !== -1) threadIsTonight = true;
    });

    messages.forEach(msg => {
      const from = String(msg.getFrom() || "").toLowerCase();
      const hca = RECAP_ROSTER.filter(h => from.indexOf(h.email.toLowerCase()) !== -1)[0];
      if (!hca) return;

      const subject = String(msg.getSubject() || "");
      const isTonight = threadIsTonight;

      if (!isTonight) {
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
        note: (entries.length || followUps) ? "" : ownText_(raw)
      });
    });
  });

  return { ok: true, replies: out };
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
function parseRecapReply_(rawBody) {
  const body = stripQuoted_(String(rawBody || ""));
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
      if (current && lastKey && !isSignOffLine_(trimmed)) {
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
      label.indexOf("follow ups on") !== -1) return "dayFollowUps";
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
  const lines = stripQuoted_(String(rawBody || "")).split(/\r?\n/);
  const collected = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const idx = line.indexOf(":");
    const key = idx === -1 ? null : fieldKeyFor_(line.slice(0, idx).toLowerCase());

    if (key === "dayFollowUps") {
      inSection = true;
      const rest = line.slice(idx + 1).trim();
      if (rest) collected.push(rest);
      continue;
    }
    if (!inSection) continue;
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

  return collected.join("\n").replace(/\n{2,}/g, "\n").trim();
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
  const monthly = /\/\s*mo|\bper month\b|\bmonthly\b|\bmo\.\b/i.test(raw);

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
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripQuoted_(body) {
  const kept = [];
  String(body || "").split(/\r?\n/).forEach(line => {
    const bare = line.replace(/^\s*(?:>\s?)+/, "");
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(bare)) return;
    if (/^\s*wrote:\s*$/i.test(bare)) return;
    if (/^\s*On\s.+<[^>]+@[^>]+>\s*$/.test(bare)) return;
    if (/^\s*On\s.+\swrote:\s*$/.test(bare)) return;
    kept.push(bare);
  });
  return kept.join("\n");
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
  if (DAILY_RECAP_CONFIG.TEST_MODE) {
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
      "  " + cfg.summarySheetName + " — per-HCA rollup, formula-driven\n"
  });

  return { ss: ss, created: true };
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
  const working = [];
  const skipped = [];

  RECAP_ROSTER.forEach(hca => {
    const ex = exceptions.byName[hca.name.toLowerCase()];
    const scheduled = hca.days.indexOf(weekday) !== -1;
    const type = ex ? String(ex.type || "").trim().toLowerCase() : "";

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
    wanted = byEmail ? byEmail.name.toLowerCase() : " no-such-hca";
  }

  const logRows = readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso)
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
        followUps: [], daysScheduled: 0, daysReplied: 0, rows: []
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
    if (String(r[2]) === "Yes") h.daysReplied++;
    if (r[4]) h.followUps.push({ date: String(r[0]), text: String(r[4]) });
  });

  const hcas = Object.keys(byName).sort().map(name => {
    const h = byName[name];
    const sold = h.outcomes["SOLD"] || 0;
    h.sold = sold;
    h.closeRate = h.appointments ? Math.round((sold / h.appointments) * 100) : null;
    h.waterHeaterRate = h.appointments ? Math.round((h.waterHeaterPresented / h.appointments) * 100) : null;
    h.replyRate = h.daysScheduled ? Math.round((h.daysReplied / h.daysScheduled) * 100) : null;
    return h;
  });

  return { ok: true, generated: new Date().toISOString(), days: days, from: fromIso, to: toIso, hcas: hcas };
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

  Logger.log("Installed daily recap triggers (send " + cfg.sendHour + ":00, collect " +
    cfg.collectHour + ":" + pad2_(cfg.collectMinute) +
    (cfg.nudgeEnabled ? ", nudge " + cfg.nudgeHourWorking + ":00 working / " +
      cfg.nudgeHourOff + ":00 off" : "") + " " + cfg.timeZone + ").");
}

function deleteDailyRecapTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === "sendDailyRecap" || fn === "collectRecapReplies" ||
        fn === "sendMorningNudgeWorkingToday" || fn === "sendMorningNudgeOffToday") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/* ----------------------------------------------------------------- preview */

/* Sends nothing. Logs exactly who tonight's send would go to and why. */
function previewDailyRecap() {
  const plan = buildTodayPlan_(new Date());
  Logger.log("TEST_MODE: " + DAILY_RECAP_CONFIG.TEST_MODE);
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

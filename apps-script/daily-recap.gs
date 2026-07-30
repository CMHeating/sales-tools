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

  sendHour: 18,                     // 6:00pm Pacific
  collectHour: 20,                  // 8:15pm Pacific
  collectMinute: 15,
  replyLookbackDays: 2
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
  return "Hi " + hca.first + ",\n\n" +
    "Please reply to this email with one block per appointment you ran today (" + dateLabel + ").\n\n" +
    "Customer:\n" +
    "Lead Source (W/I/TF/R):\n" +
    "Outcome (S/E/F):\n" +
    "Water Heater presented? (Y/N — interest level):\n" +
    "Follow-up date (if not closed):\n" +
    "If not sold — What is the objection or holdback from completing the sale?:\n\n" +
    "Repeat the block if you ran more than one appointment.\n\n" +
    "Lead Source: W=Web, I=Inbound, TF=Tech Flip, R=Revisit\n" +
    "Outcome: S=Sold, E=Estimate, F=Follow-up needed\n\n" +
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

/* --------------------------------------------------------------- collect */

function collectRecapReplies() {
  const now = new Date();
  const plan = buildTodayPlan_(now);
  const replies = findRecapReplies_(plan.dateLabel);

  const byHca = {};
  replies.forEach(r => {
    if (!byHca[r.hca.name]) byHca[r.hca.name] = { hca: r.hca, entries: [] };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
  });

  const responded = {};
  Object.keys(byHca).forEach(n => { responded[n] = true; });
  const missing = plan.working.filter(h => !responded[h.name]);

  const body = buildDigestBody_(plan, byHca, missing);
  sendEmailSafe_({
    to: [DAILY_RECAP_CONFIG.managerEmail],
    subject: (DAILY_RECAP_CONFIG.TEST_MODE ? "[TEST] " : "") +
      "Recap Digest — " + plan.dateLabel,
    body: body
  });

  Logger.log("Digest sent. " + Object.keys(byHca).length + " replied, " + missing.length + " missing.");
  return { replied: Object.keys(byHca).length, missing: missing.length };
}

function findRecapReplies_(dateLabel) {
  const cfg = DAILY_RECAP_CONFIG;
  const query = 'subject:"' + cfg.subjectPrefix + '" newer_than:' + cfg.replyLookbackDays + "d";
  const out = [];

  let threads = [];
  try {
    threads = GmailApp.search(query, 0, 100);
  } catch (err) {
    Logger.log("Recap reply search failed: " + (err && err.message ? err.message : String(err)));
    return out;
  }

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const from = String(msg.getFrom() || "").toLowerCase();
      const hca = RECAP_ROSTER.filter(h => from.indexOf(h.email.toLowerCase()) !== -1)[0];
      if (!hca) return;

      const entries = parseRecapReply_(msg.getPlainBody());
      if (entries.length) out.push({ hca: hca, entries: entries });
    });
  });

  return out;
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

  const commit = () => {
    if (current && (current.customer || current.outcome)) entries.push(current);
    current = null;
  };

  body.split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return;

    const label = line.slice(0, idx).toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) return;

    if (label.indexOf("customer") !== -1) {
      if (current) commit();
      current = blankEntry_();
      current.customer = value;
      return;
    }

    if (!current) current = blankEntry_();

    if (label.indexOf("lead source") !== -1)        current.leadSource = normalizeLeadSource_(value);
    else if (label.indexOf("outcome") !== -1)       current.outcome = normalizeOutcome_(value);
    else if (label.indexOf("water heater") !== -1)  current.waterHeater = value;
    else if (label.indexOf("follow-up date") !== -1 || label.indexOf("follow up date") !== -1) current.followUpDate = value;
    else if (label.indexOf("objection") !== -1 || label.indexOf("holdback") !== -1) current.objection = value;
  });

  commit();
  return entries;
}

function blankEntry_() {
  return { customer: "", leadSource: "", outcome: "", waterHeater: "", followUpDate: "", objection: "" };
}

function stripQuoted_(body) {
  const kept = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .+ wrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+@/.test(line)) break;
    kept.push(line);
  }
  return kept.join("\n");
}

function normalizeLeadSource_(value) {
  const v = value.trim().toUpperCase();
  if (v.indexOf("TF") === 0 || v.indexOf("TECH") !== -1) return "Tech Flip";
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

function buildDigestBody_(plan, byHca, missing) {
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
        if (e.waterHeater)  lines.push("      Water heater: " + e.waterHeater);
        if (e.followUpDate) lines.push("      Follow-up:    " + e.followUpDate);
        if (e.outcome !== "SOLD" && e.objection) lines.push("      Objection:    " + e.objection);
        if (e.outcome !== "SOLD" && !e.objection) lines.push("      Objection:    (not provided)");
        lines.push("");
      });
    });
  }

  lines.push(new Array(60).join("="));
  if (missing.length) {
    lines.push("Scheduled today but no reply (" + missing.length + "):");
    missing.forEach(h => lines.push("  - " + h.name));
  } else if (plan.working.length) {
    lines.push("All " + plan.working.length + " scheduled HCAs replied.");
  }

  if (!plan.exceptions.ok) {
    lines.push("");
    lines.push("Note: Schedule Exceptions sheet could not be read today, so the");
    lines.push("scheduled-HCA list above is based on base schedules only.");
    lines.push("Error: " + plan.exceptions.error);
  }

  return lines.join("\n");
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

  Logger.log("Installed daily recap triggers (send " + cfg.sendHour + ":00, collect " +
    cfg.collectHour + ":" + pad2_(cfg.collectMinute) + " " + cfg.timeZone + ").");
}

function deleteDailyRecapTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === "sendDailyRecap" || fn === "collectRecapReplies") {
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

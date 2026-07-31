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
  /* Lead Source and Outcome list their options in full rather than as letter
     codes, so nothing has to be looked up or remembered. The collector still
     accepts the old single letters — see normalizeLeadSource_/normalizeOutcome_
     — because reps who learned W/I/TF/R and S/E/F will keep typing them. */
  return "Hi " + hca.first + ",\n\n" +
    "Please reply to this email with one block per appointment you ran today (" + dateLabel + ").\n\n" +
    "Customer:\n" +
    "Lead Source (Web / Inbound / Tech Flip / Revisit):\n" +
    "Outcome (Sold / Estimate / Follow-up needed):\n" +
    "What did you offer as a deal? (package/tier + price):\n" +
    "Water Heater presented? (Y/N — interest level):\n" +
    "Follow-up date (if not closed):\n" +
    "If not sold — What is the objection or holdback from completing the sale?:\n\n" +
    "Repeat the block if you ran more than one appointment.\n\n" +
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
  const lastRun = readLastDigestRun_();
  const replies = findRecapReplies_(plan.dateLabel, lastRun);

  const byHca = {};
  const late = [];
  replies.forEach(r => {
    if (r.late) { late.push(r); return; }
    if (!byHca[r.hca.name]) byHca[r.hca.name] = { hca: r.hca, entries: [] };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
  });

  const responded = {};
  Object.keys(byHca).forEach(n => { responded[n] = true; });
  const missing = plan.working.filter(h => !responded[h.name]);

  const body = buildDigestBody_(plan, byHca, missing, late);
  sendEmailSafe_({
    to: [DAILY_RECAP_CONFIG.managerEmail],
    subject: (DAILY_RECAP_CONFIG.TEST_MODE ? "[TEST] " : "") +
      "Recap Digest — " + plan.dateLabel,
    body: body
  });

  writeLastDigestRun_(now);
  Logger.log("Digest sent. " + Object.keys(byHca).length + " replied, " + missing.length +
    " missing, " + late.length + " late.");
  return { replied: Object.keys(byHca).length, missing: missing.length, late: late.length };
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
function findRecapReplies_(dateLabel, sinceDate) {
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

      const subject = String(msg.getSubject() || "");
      const isTonight = subject.indexOf(dateLabel) !== -1;

      if (!isTonight) {
        if (!sinceDate) return;                       // no prior run recorded
        const received = msg.getDate();
        if (!received || received <= sinceDate) return;
      }

      const entries = parseRecapReply_(msg.getPlainBody());
      if (entries.length) {
        out.push({ hca: hca, entries: entries, late: !isTonight, subject: subject });
      }
    });
  });

  return out;
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
    if (current && (current.customer || current.outcome)) entries.push(finalizeEntry_(current));
    current = null;
    lastKey = null;
  };

  body.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { lastKey = null; return; }        // blank line closes any wrapped value

    const idx = line.indexOf(":");
    const key = idx === -1 ? null : fieldKeyFor_(line.slice(0, idx).toLowerCase());

    if (key === null) {
      /* Mail clients hard-wrap long answers, so a line carrying no field label
         is the tail of the previous answer rather than noise. Without this the
         wrapped remainder is lost — frequently the entire objection, which is
         the longest thing a rep writes. */
      if (current && lastKey && !isSignOffLine_(trimmed)) {
        current[lastKey] = (current[lastKey] + " " + trimmed).replace(/\s+/g, " ").trim();
      }
      return;
    }

    const value = line.slice(idx + 1).trim();

    if (key === "customer") {
      if (!value) { lastKey = null; return; }        // blank line of the quoted template
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

/* Sign-offs and the template's own trailing instructions sit right after the
   last answer, where they would otherwise be swallowed as a continuation. */
function isSignOffLine_(line) {
  return /^(thanks|thank you|thx|regards|best|cheers|sincerely|sent from my|get outlook|repeat the block)\b/i.test(line);
}

function fieldKeyFor_(label) {
  if (label.indexOf("customer") !== -1) return "customer";
  if (label.indexOf("lead source") !== -1) return "leadSource";
  /* Outcome is tested before the follow-up date because its own prompt now
     spells out "Follow-up needed" and would otherwise match that branch. */
  if (label.indexOf("outcome") !== -1) return "outcome";
  if (label.indexOf("water heater") !== -1) return "waterHeater";
  if (label.indexOf("follow-up date") !== -1 || label.indexOf("follow up date") !== -1) return "followUpDate";
  if (label.indexOf("objection") !== -1 || label.indexOf("holdback") !== -1) return "objection";
  if (label.indexOf("deal") !== -1 || label.indexOf("offer") !== -1) return "deal";
  return null;
}

/* Normalisation runs at commit, not per line, so a wrapped value is joined
   before it is interpreted. "scheduleing pro make an" + "appoint" has to be
   whole before the lead source can be resolved. */
function finalizeEntry_(entry) {
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

  const match = raw.match(/\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k\b)?/i);
  if (!match) return { amount: null, monthly: monthly };

  let n = Number(String(match[1]).replace(/,/g, ""));
  if (!isFinite(n)) return { amount: null, monthly: monthly };
  if (match[2]) n = n * 1000;                       // "18k" -> 18000

  return { amount: n, monthly: monthly };
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

function buildDigestBody_(plan, byHca, missing, late) {
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

  lines.push(new Array(60).join("="));
  if (missing.length) {
    lines.push("Scheduled today but no reply (" + missing.length + "):");
    missing.forEach(h => lines.push("  - " + h.name));
  } else if (plan.working.length) {
    lines.push("All " + plan.working.length + " scheduled HCAs replied.");
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

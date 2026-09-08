/* ============================================================================
 * CM HEATING — HCA DAILY RECAP  ·  CONSOLIDATED PROJECT FILE  (rebuilt clean)
 * ----------------------------------------------------------------------------
 * One file that replaces the whole bloated project. Each function and config
 * block is the LAST (winning) copy from your live project; the stacked-up
 * duplicates (buildL2CTab x11, importRecapFormResponses_ x8, L2C_DAYS x12, and
 * dozens more) are gone. Behavior is unchanged: every definition is the exact
 * one already winning at runtime under Apps Script "last definition wins".
 *
 * INSTALL (at the laptop, Apps Script editor):
 *   1. Delete every existing .gs file EXCEPT appsscript.json and any .html.
 *   2. Add ONE new script file, paste ALL of this in, Save.
 *   3. Run scorecardAudit   -> expect "none - clean!".
 *   4. Run buildL2CTabPlus  -> confirms the Daily / L2C tabs still paint.
 *   Your triggers keep working (they reference function names, all still here).
 * ============================================================================ */
/* ============================================================================
 * ▲ RUN THESE — shortcuts to the top of the function picker.
 *
 * This project has 450+ functions and the Apps Script picker is one long
 * unsearchable scroll, so the handful you actually run by hand are aliased
 * here. The "aa" prefix keeps them first whether the picker sorts by source
 * order or alphabetically.
 *
 * ONE-TIME SETUP, in this order:
 *   aa1_setupGrowthConfig     — create the Growth Config tab
 *   aa2_previewGrowthAdvance  — dry run, writes nothing
 *   aa3_applyGrowthAdvance    — commit day installs + MTD figures
 *   aa4_previewPipeline       — dry run for the Backlog Pipeline tab
 *   aa5_applyPipeline         — commit it
 *
 * EVERY MORNING, after dropping the three exports in Drive:
 *   aa6_growthMorningRefresh  — pipeline, then day rows, then MTD figures
 *
 * READ-ONLY CHECKS:
 *   aa7_previewGrowthDays     — what the day rows currently say
 *
 * REPAINT:
 *   aa10_buildL2CTabPlus      — repaint Daily/L2C after aa6 (aa6 doesn't repaint itself)
 *
 * UNATTENDED:
 *   aa8_installMorningTrigger — run aa6 automatically each morning
 *   aa9_resetMorningLatch     — force a re-read after a corrected re-upload
 * 
 * ========================================================================== */
function aa1_setupGrowthConfig()    { return setupGrowthConfigSheet(); }
function aa2_previewGrowthAdvance() { return previewGrowthAutoAdvance(); }
function aa3_applyGrowthAdvance()   { return applyGrowthAutoAdvance(); }
function aa4_previewPipeline()      { return previewPipelineFromDrive(); }
function aa5_applyPipeline()        { return applyPipelineFromDrive(); }
function aa6_growthMorningRefresh() { return growthMorningRefresh(); }
function aa7_previewGrowthDays()    { return previewGrowthDays(); }
function aa8_installMorningTrigger(){ return installGrowthMorningTrigger(); }
function aa9_resetMorningLatch()   { return resetGrowthMorningLatch(); }
function aa10_buildL2CTabPlus()     { return buildL2CTabPlus(); }

const PAUSE_HCA_NAME = "Trevor Bohm";
const PAUSE_HCA_REASON = "Off for a week or so";
const GROWTH_SHEET_DATE = "";
const GROWTH_SHEET_ID = "1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww";
const GROWTH_SHEET_TAB = "";
const GROWTH_SHEET_OVERWRITE = false;
const BI_LEADS_SHEET_ID = "16L_ii7sc5Vf369RXzvfca9WuvG92WbEb";
const BI_LEADS_TAB = "";
const AUDIT_FROM_ISO = "2026-07-01";
const AUDIT_TO_ISO = "2026-07-31";
const DAILY_RECAP_CONFIG = {
  /* The starting value only. Once goLive() or goTest() has been run, the live setting is in Script Properties and this is ignored — see isTestMode_(). A new project is safe by default; an established one cannot be knocked back into test by someone pasting this file over it. */
  TEST_MODE: true, timeZone: "America/Los_Angeles", testRecipient: "geoffrey.simons@cmheating.com", managerEmail: "geoffrey.simons@cmheating.com", fromName: "CM Heating Sales Operations", subjectPrefix: "Daily Recap", testSubjectPrefix: "[TEST] Daily Recap", exceptionsSpreadsheetId: "1RIUfCH7ZXHfXiX1jjvCHuQp9pDWqpZB-IExpUBvGFzM", exceptionsSheetName: "", // blank = first sheet
  /* Leave logSpreadsheetId blank. The first collect run creates the sheet, stores its id in Script Properties, and emails the link. Creating it from the script guarantees the script can write to it — a sheet made by hand and pasted in here is the usual source of permission trouble. Paste an id only to point at an existing log. */
  logSpreadsheetId: "", logSpreadsheetTitle: "CM Heating — Daily Recap Log", logSheetName: "Recap Log", complianceSheetName: "Reply Compliance", summarySheetName: "Summary", todaySheetName: "Today",
  /* The reconciled view: one row per job, whether or not a rep reported it. Written on a schedule by refreshJobStatus(), read by the 1:1 scheduler. The page does not search Gmail — three searches over hundreds of threads on every page load would be slow, would burn quota, and would give a different answer each time it ran. */
  jobStatusSheetName: "Job Status", jobStatusDays: 21, // how far back each refresh reconciles
  /* What people actually said about the homeowner by email, attached to the job. Often the most useful thing about a deal is nowhere in ServiceTitan — it is Amy asking for an install date and the rep answering. */
  emailNotesSheetName: "Email Notes", emailNoteLookbackDays: 60,
  /* The worklist: every open appointment, soonest first. Derived from Recap Log on each refresh, so the log stays the record and this stays the thing you actually work from. */
  followUpsSheetName: "Follow-Ups",
  /* COMBO LOG 2026 — the same sheet sold-job-tracker-sync.gs reads. It is the only source for a *scheduled* install date; the ServiceTitan alerts carry sold and completed and nothing in between. Blank disables the lookup and scheduled dates simply come back empty. */
  comboLogSpreadsheetId: "16Z-PK7d2Y6MvNHM1vqZ6y0JsezITQG6fYnawomYl46c",
  /* 6:00am. The recap goes out before the first appointment rather than after the last one, so a rep can answer a block as they leave each driveway instead of reconstructing the whole day at 8pm. Replies arriving in pieces cost nothing: rows are keyed on date + HCA + customer, so three messages across a day merge into one clean set. */
  sendHour: 6, collectHour: 20, // 8:15pm Pacific
  collectMinute: 15, replyLookbackDays: 2,
  /* Deliberately NOT sendHour. suspectWrongThread_ flags a reply that answers an older night and arrived once a fresher recap was already sitting in the inbox. With a 6pm send that was the same threshold; with a 6am send a fresher email exists from breakfast onward, and every ordinary next-morning reply would flag. Kyle answering Saturday's recap at 8:18am Sunday is normal and must stay quiet. Holding this at 6pm keeps the flag meaning "they had all day to use today's email and used an old one". */
  suspectAfterHour: 18,
  /* The chase for anyone who owed yesterday and never replied now rides along inside the 6am email rather than arriving separately an hour later — see buildRecapBody_. Set nudgeEnabled true to also install the old standalone nudge triggers; the functions still work and are useful for a one-off. */
  nudgeEnabled: false, nudgeHourWorking: 7, nudgeHourOff: 8,
  /* 6:00, so the same-day / follow-up split is in the inbox well before the 07:45 with Lyle and Aaron. It used to run at 09:00 to sit after the old 07:00 and 08:00 nudges; that chase now rides inside the 06:00 send, so the reason is gone and 09:00 was simply too late to be useful. Yesterday's replies closed at 20:15 last night, so the only thing a 06:00 brief can miss is someone filing overnight — and every function that reads sold alerts reads Gmail live, so re-running after the meeting picks up anything that landed since. */
  morningBriefHour: 6,
  /* When the growth sheet fills itself. 7am, an hour after the send/brief, so it runs alone and yesterday's overnight reply sweep has fully settled. It writes yesterday's day column and refreshes MTD, then stays silent unless something needs a human — see writeGrowthSheetForYesterday. */
  growthWriteHour: 4
};
const RECAP_ROSTER = [ {
  first: "Amber", name: "Amber Maddalena", email: "amber.maddalena@cmheating.com", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
},
{
  first: "Chester", name: "Chester Granard", email: "chester.granard@cmheating.com", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
},
{
  first: "Davis", name: "Davis Diosdado", email: "davis.diosdado@cmheating.com", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
},
{
  first: "Adam", name: "Adam Weberg", email: "adam@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Joseph", name: "Joseph Ruble", email: "joseph.ruble@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Kyle", name: "Kyle McAlister", email: "kmcalister@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Jay", name: "Javierre Milo", email: "javierre.milo@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Joe", name: "Joe Chounramany", email: "jchounramany@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Samir", name: "Samir Khoury", email: "samir.khoury@cmheating.com", days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
},
{
  first: "Trevor", name: "Trevor Bohm", email: "trevor.bohm@cmheating.com", days: ["Monday", "Wednesday", "Thursday", "Saturday"]
}
];
const LAST_SEND_PROPERTY = "lastRecapSendIso";
function sendDailyRecap() {
  return sendDailyRecap_(false);
}
function forceSendDailyRecap() {
  return sendDailyRecap_(true);
}
function lastRealSendIso_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(LAST_SEND_PROPERTY) || "";
  }
  catch (err) {
    /* Unreadable means we cannot prove today was already sent. Send — a missing
    recap is invisible, a duplicate is merely annoying. */
    return "";
  }
}
function writeLastRealSend_(isoDate) {
  try {
    PropertiesService.getScriptProperties().setProperty(LAST_SEND_PROPERTY, isoDate);
  }
  catch (err) {
    Logger.log("Could not record the send date: " + (err && err.message ? err.message : String(err)));
  }
}
function sendMorningNudgeWorkingToday() {
  return runMorningFollowUp_(true);
}
function sendMorningNudgeOffToday() {
  return runMorningFollowUp_(false);
}
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
  }
  else if (followUps) {
    receipt = pick([
      "Got your follow-ups for " + day + ". Thanks for sending it.",
      "Thanks for " + day + " — noted the follow-up work.",
      day + " noted, thanks. Good to see the older leads getting worked.",
      "Got " + day + ". Follow-ups logged, appreciate it."
    ], "receipt");
  }
  else {
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
  }
  else if (sold.length > 1) {
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
function ackVariant_(seed) {
  let h = 0;
  const str = String(seed || "");
  for (let i = 0;
  i < str.length;
  i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function buildNudgeBody_(hca, dateLabel) {
  var form = (typeof enFormUrl_ === "function" && enFormUrl_())
    || (typeof recapFormUrl_ === "function" && recapFormUrl_())
    || "https://docs.google.com/forms/d/e/1FAIpQLSf_A1lXHWCk8tABXIx0r0tDmCHpR7DJay-pLR-jmjtgpJCbyg/viewform";
  return "Morning " + hca.first + ",\n\n" +
    "I didn't get your recap for " + dateLabel + ". Quickest way is the form:\n" +
    "  " + form + "\n\n" +
    "Or just reply to this email with what you ran:\n\n" +
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
function collectRecapReplies() {
  return runCollection_(new Date(), false);
}
function backfillRecapForDate(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error('Pass a date as "YYYY-MM-DD", e.g. backfillRecapForDate("2026-07-30")');
  const when = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (isNaN(when.getTime())) throw new Error("Unrecognised date: " + isoDate);
  return runCollection_(when, true);
}
function backfillYesterday() {
  return runCollection_(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), true);
}
function isTestMode_() {
  try {
    const stored = PropertiesService.getScriptProperties().getProperty("TEST_MODE");
    if (stored === "false") return false;
    if (stored === "true") return true;
  }
  catch (err) {
    Logger.log("Could not read the TEST_MODE property, falling back to the file: " + err);
  }
  return DAILY_RECAP_CONFIG.TEST_MODE;
}
function goLive() {
  PropertiesService.getScriptProperties().setProperty("TEST_MODE", "false");
  Logger.log("LIVE — the recap will go to all scheduled HCAs. " +
    "This setting now survives updates to this file.");
  return "live";
}
function goTest() {
  PropertiesService.getScriptProperties().setProperty("TEST_MODE", "true");
  Logger.log("TEST — only " + DAILY_RECAP_CONFIG.testRecipient +
    " will be emailed. No HCA will be contacted.");
  return "test";
}
function showRecapMode() {
  let stored = null;
  try {
    stored = PropertiesService.getScriptProperties().getProperty("TEST_MODE");
  }
  catch (err) {
    /* reported below as unreadable */
  }
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
const PAUSED_HCAS_PROPERTY = "pausedHcas";
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
function pauseHcaNow() {
  return pauseHca_(PAUSE_HCA_NAME, PAUSE_HCA_REASON);
}
function resumeHcaNow() {
  return resumeHca_(PAUSE_HCA_NAME);
}
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
  }
  catch (err) {
    return null;
  }
}
function writeLastDigestRun_(when) {
  try {
    PropertiesService.getScriptProperties().setProperty("lastDigestRunIso", when.toISOString());
  }
  catch (err) {
    Logger.log("Could not record digest run time: " + (err && err.message ? err.message : String(err)));
  }
}
const TEMPLATE_FIELD_ORDER = [ "Customer", "Source (Web / Inbound / Tech Flip / Revisit)", "Outcome (Sold / Estimate / Follow-up)", "Offered (package + price)", "Water heater (Y/N + interest)", "Next follow-up", "Objection (if not sold)" ];
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
function cleanValue_(value) {
  let v = String(value === null || value === undefined ? "" : value).trim();
  v = v.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
  v = v.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();
  return v;
}
function isPlaceholderValue_(value) {
  const v = cleanValue_(value);
  if (v.length < 4) return false;
  if (/[a-z]/.test(v)) return false;
  return /[A-Z]{3,}/.test(v);
}
function parseFollowUps_(rawBody) {
  const lines = splitQuoted_(String(rawBody || ""));
  const collected = [];
  let inSection = false;
  let startedQuoted = false;
  for (let i = 0;
  i < lines.length;
  i++) {
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
    if (key !== null) break;
    // another labelled field ends it
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
function trimTrailingSignature_(lines) {
  const bulleted = lines.filter(l => /^[-–•*]/.test(l)).length;
  if (bulleted < 2) return lines;
  const out = lines.slice();
  while (out.length) {
    const last = String(out[out.length - 1] || "").trim();
    if (!last) {
      out.pop();
      continue;
    }
    const looksLikeName = !/^[-–•*]/.test(last) && last.length <= 24 &&
      !/\d/.test(last) && last.split(/\s+/).length <= 3 && /^[A-Za-z][A-Za-z.\s]*$/.test(last);
    if (!looksLikeName) break;
    out.pop();
  }
  return out;
}
function entryHasContent_(entry) {
  if (!entry) return false;
  return ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .some(k => !!entry[k]);
}
function blankEntry_() {
  return {
    customer: "", leadSource: "", outcome: "", waterHeater: "",
    followUpDate: "", objection: "",
    deal: "", dealAmount: null, dealIsMonthly: false,
    dealOneTime: null, dealMonthly: null, dealAlternatives: false,
    dealMentionsMonthly: false
  };
}
const DEAL_FIGURE_FLOOR = 2000;
function normalizeDealText_(raw) {
  return String(raw || "")
  /* Phone numbers and dates first, and they are DELETED, not rewritten. A
  phone number survives every later rule and "555-867-5309" became
  "555 or 867 or 5309" — a $5,309 sale. Nothing in a deal line needs
  either of them. */
  .replace(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g, " ")
    .replace(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g, " ")
  /* A down payment or deposit is a payment TERM, not what was offered. Left
  in, "$249 a month with $500 down" reported $749 a month.
  
  Both forms require a DOLLAR SIGN and a tightly-bounded number. The loose
  version ate real prices: "[\\d,]*" swallowed the comma after "$18,500,"
  and ran on to "deposit", deleting the actual deal. The lookahead keeps
  "down FROM", "down THE road" and "down draft" out of it. */
  .replace(/\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s{0,2}(?:down\s*payment|deposit|down\b(?!\s+(?:from|the|to|draft)))/gi, " ")
    .replace(/(?:down\s*payment|deposit)\s*(?:of\s*)?\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?/gi, " ")
  /* "/mo", "/ month", "ea/month" -> "per month" */
  .replace(/\/\s*mo\.?\b/gi, " per month")
    .replace(/\/\s*months?\b/gi, " per month")
  /* "22/19k" is two options, not a fraction. Both sides must be short and
  bare: the left is required to be preceded by a space or the start of the
  line, never by "$", a digit, a comma or a point, or "$22,000/19k" would
  have its trailing "000" rewritten to "000k" and book $22,000,000. */
  .replace(/(^|[^$\d.,])(\d{1,3})\s*\/\s*(\d{1,3}\s*k)\b/gi, "$1$2k or $3")
  /* "18-22k", "$18,500-$22,000" — a range between two figures is a choice,
  not a sum. Requires a digit on the left and a figure on the right, so
  "Furnace-2 stage-$7300.00" and "Rheem RH1T-4821" are untouched. */
  .replace(/(\d)\s*[-–—]\s*(?=\$?\s*\d)/g, "$1 or ");
}
function ownText_(body) {
  const kept = [];
  const lines = String(body || "").split(/\r?\n/);
  for (let i = 0;
  i < lines.length;
  i++) {
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
function isBareNone_(text) {
  return /^(none|none\s*ran|no\s*appointments?|n\/a|na)[.!]?$/i.test(String(text || "").trim());
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
const RECAP_LOG_HEADERS = [ "Date", "HCA", "Customer", "Lead Source", "Outcome", "Deal Offered", "Deal Amount", "Deal Unit", "Water Heater", "Follow-up Date", "Objection", "Logged At", "Key", "One-time $", "CaaS Monthly $", "CaaS Contract $", "Alternatives?" ];
const COMPLIANCE_HEADERS = ["Date", "HCA", "Replied", "Appointments Reported", "Follow-ups On Older Leads", "Logged At"];
function sweepRecapReplies() {
  const cfg = DAILY_RECAP_CONFIG;
  const plan = buildTodayPlan_(new Date());
  const res = findRecapReplies_(plan.dateLabel, null, cfg.replyLookbackDays, true);
  if (!res.ok) {
    Logger.log("Reply sweep skipped — Gmail search failed. Nothing written.");
    return {
      ok: false, written: 0, skipped: 0, marked: []
    };
  }
  let out = {
    ok: true, written: 0, skipped: 0, undated: 0, marked: [], reconciled: false
  };
  try {
    const book = getLogSpreadsheet_();
    const logged = logRepliesByNight_(book.ss, res.replies);
    out = {
      ok: true, written: logged.written, skipped: logged.skipped,
      undated: logged.undated, marked: logged.marked, reconciled: false
    };
  }
  catch (err) {
    Logger.log("Reply sweep could not write: " + (err && err.message ? err.message : String(err)));
    return {
      ok: false, written: 0, skipped: 0, marked: [], reconciled: false
    };
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
    }
    catch (err) {
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
const RECAP_MONTH_NAMES = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
function isoFromDateLabel_(label) {
  const m = String(label || "").match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return "";
  const month = RECAP_MONTH_NAMES.indexOf(m[1]);
  if (month === -1) return "";
  const day = Number(m[2]);
  if (!(day >= 1 && day <= 31)) return "";
  return m[3] + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}
function markComplianceLate_(ss, isoDate, hcaName, entryCount, followUps) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.complianceSheetName, COMPLIANCE_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const values = sheet.getRange(2, 1, lastRow - 1, COMPLIANCE_HEADERS.length).getValues();
  const wantName = String(hcaName).toLowerCase();
  for (let i = 0;
  i < values.length;
  i++) {
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
const SHEET_LAYOUTS = {
  "Recap Log": {
    widths: [95, 140, 190, 100, 150, 280, 110, 90, 180, 160, 340, 140, 0, 110, 120, 130, 95], wrap: [5, 8, 10], // Deal Offered, Water Heater, Objection
    money: [6, 13, 15], // Deal Amount, One-time $, CaaS Contract $
    /* The monthly payment is the one figure here where the cents matter — $319.99 rounded to $320 is a number nobody can reconcile against a contract. */
    money2: [14], // CaaS Monthly $ — two decimals
    hide: [12] // Key — machine-only
  }
  , "Follow-Ups": {
    widths: [95, 130, 140, 190, 150, 260, 110, 340, 140, 95, 90, 200, 0], wrap: [7, 11], money: [6], hide: [12]
  }
  , "Reply Compliance": {
    widths: [95, 140, 80, 110, 380, 140], wrap: [4], money: [], hide: []
  }
  , "Email Notes": {
    widths: [95, 130, 190, 105, 150, 240, 460, 90, 0], wrap: [6], money: [], hide: [8]
  }
  , "Job Status": {
    widths: [95, 130, 190, 85, 150, 130, 110, 120, 130, 120, 130, 90, 130, 70, 110, 90, 85, 170, 120, 120, 120, 240, 130, 300, 300, 140, 0], wrap: [21, 23, 24], money: [14], hide: [26]
  }
  ,
  /* Two blocks side by side: the reported appointments in A-H, the reply picture in J-N, with I left narrow as the gutter between them. */
  "Today": {
    widths: [95, 140, 190, 150, 280, 110, 120, 300, 24, 95, 140, 80, 110], wrap: [], money: [5], hide: [], plain: true
  }
};
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
function ensureLiveTabs_(ss) {
  const cfg = DAILY_RECAP_CONFIG;
  try {
    if (!ss.getSheetByName(cfg.todaySheetName)) installTodayFormulas_(ss);
    if (!ss.getSheetByName(cfg.summarySheetName)) installSummaryFormulas_(ss);
  }
  catch (err) {
    Logger.log("Could not ensure the live tabs: " + (err && err.message ? err.message : String(err)));
  }
}
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
function installSummaryFormulas_(ss) {
  const cfg = DAILY_RECAP_CONFIG;
  const sheet = ensureSheet_(ss, cfg.summarySheetName, ["Per-HCA rollup"]);
  const log = "'" + cfg.logSheetName + "'";
  const comp = "'" + cfg.complianceSheetName + "'";
  /* This tab is generated in full, and the blocks below moved down the sheet,
  so the old labels and formulas have to go or they collide with the new
  ones. Values and formulas only — charts and cell notes survive. */
  sheet.clearContents();
  /* Appointments: counted across all rows, whatever the deal unit. */
  sheet.getRange("A1").setValue("Per-HCA rollup — all time").setFontWeight("bold");
  sheet.getRange("A2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select B, count(C) ' +
    'where B is not null ' +
    'group by B ' +
    'label B \'HCA\', count(C) \'Appointments\'", 0), "No data yet")'
  );
  /* One-time job value. Deliberately excludes monthly rows. */
  sheet.getRange("D1").setValue("Offered — one-time jobs").setFontWeight("bold");
  sheet.getRange("D2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:Q, "select B, sum(N) ' +
    'where B is not null and N is not null ' +
    'group by B ' +
    'label B \'HCA\', sum(N) \'One-time $\'", 0), "None yet")'
  );
  /* Comfort Club / CaaS monthly payments, kept separate on purpose. Adding
  these to the column on the left would be adding a payment to a purchase
  price. */
  sheet.getRange("G1").setValue("Comfort Club / CaaS — monthly").setFontWeight("bold");
  sheet.getRange("G2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:Q, "select B, sum(O) ' +
    'where B is not null and O is not null ' +
    'group by B ' +
    'label B \'HCA\', sum(O) \'Monthly $\'", 0), "None yet")'
  );
  /* CaaS gross contract value: the payment across the 8-year term. This is what
  makes a $289/mo Comfort Club sale comparable to a cash job instead of
  looking a hundred times smaller than one.
  
  GROSS AND UNDISCOUNTED. Not present-valued, not churn-adjusted, and it does
  not net off the repair and replacement cost carried by self-warranting. The
  term is a floor, not a cap — accounts can run past 8 years. */
  sheet.getRange("J1").setValue("CaaS contract value (monthly × 96)").setFontWeight("bold");
  sheet.getRange("J2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:Q, "select B, sum(P) ' +
    'where B is not null and P is not null ' +
    'group by B ' +
    'label B \'HCA\', sum(P) \'8-yr contract $\'", 0), "None yet")'
  );
  /* Rows where a deal was described but no figure could be read, so a total is
  never quietly mistaken for covering every appointment. */
  sheet.getRange("M1").setValue("Deals with no figure read").setFontWeight("bold");
  sheet.getRange("M2").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:Q, "select B, count(C) ' +
    'where B is not null and F is not null and N is null and O is null ' +
    'group by B ' +
    'label B \'HCA\', count(C) \'No figure\'", 0), "None")'
  );
  /* Moved down from row 12. The block above spills one row per HCA plus a
  header — ten reps means it reaches row 12 exactly, and a QUERY that would
  overwrite an occupied cell does not truncate, it fails the whole block with
  #REF!. Row 16 leaves room for thirteen. */
  sheet.getRange("A16").setValue("Outcomes").setFontWeight("bold");
  sheet.getRange("A17").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select E, count(C) where E is not null group by E label E \'Outcome\', count(C) \'Count\'", 0), "No data yet")'
  );
  sheet.getRange("E16").setValue("Lead sources").setFontWeight("bold");
  sheet.getRange("E17").setFormula(
    '=IFERROR(QUERY(' + log + '!A2:M, "select D, count(C) where D is not null group by D label D \'Lead Source\', count(C) \'Count\'", 0), "No data yet")'
  );
  sheet.getRange("A30").setValue("Reply rate by HCA").setFontWeight("bold");
  sheet.getRange("A31").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:E, "select B, count(C) where B is not null group by B label B \'HCA\', count(C) \'Days Scheduled\'", 0), "No data yet")'
  );
  sheet.getRange("D30").setValue("Days with no reply").setFontWeight("bold");
  sheet.getRange("D31").setFormula(
    '=IFERROR(QUERY(' + comp + '!A2:E, "select B, count(C) where C = \'No\' group by B label B \'HCA\', count(C) \'Missed\'", 0), "None")'
  );
  return sheet;
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
  for (let i = 0;
  i < candidates.length;
  i++) {
    const at = header.indexOf(candidates[i]);
    if (at !== -1) return at;
  }
  return -1;
}
function titleCase_(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function formatMoney_(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function serveOneOnOnePage_() {
  try {
    return HtmlService.createHtmlOutputFromFile("hca-1on1")
      .setTitle("HCA 1:1")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  catch (err) {
    /* A missing file here reads as a broken link, so say what is missing
    rather than letting Apps Script show its own stack trace. */
    return HtmlService.createHtmlOutput(
      "<div style=\"font:15px/1.6 system-ui;padding:32px;max-width:640px\">" +
      "<h2 style=\"margin:0 0 12px\">The 1:1 page is not installed here yet.</h2>" +
      "<p>This deployment is set up to serve it, but the project has no HTML " +
      "file named <code>hca-1on1</code>.</p>" +
      "<p>In the Apps Script editor: <b>+ &rarr; HTML</b>, name it " +
      "<code>hca-1on1</code>, and paste the contents of <code>hca-1on1.html</code> " +
      "into it.</p>" +
      "<p style=\"color:#64748b\">" + esc_(err && err.message ? err.message : String(err)) +
      "</p></div>");
  }
}
function esc_(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function readScriptProperty_(name) {
  try {
    return PropertiesService.getScriptProperties().getProperty(name) || "";
  }
  catch (err) {
    return "";
  }
}
function weekdayFromIso_(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, DAILY_RECAP_CONFIG.timeZone, "EEEE");
}
function properName_(v) {
  return String(v || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}
const COMBO_REP_ALIASES = {
  "adam weberg": "Adam Weberg", "adam": "Adam Weberg", "amber maddalena": "Amber Maddalena", "amber": "Amber Maddalena", "chester granard": "Chester Granard", "chester": "Chester Granard", "davis diosdado": "Davis Diosdado", "davis": "Davis Diosdado", "javierre milo": "Javierre Milo", "jay milo": "Javierre Milo", "jay": "Javierre Milo", "javierre": "Javierre Milo", "joe chounramany": "Joe Chounramany", "joe c": "Joe Chounramany", "joseph ruble": "Joseph Ruble", "joe ruble": "Joseph Ruble", "joe r": "Joseph Ruble", "joseph": "Joseph Ruble", "kyle mcalister": "Kyle McAlister", "kyle": "Kyle McAlister", "samir khoury": "Samir Khoury", "samir": "Samir Khoury", "trevor bohm": "Trevor Bohm", "trevor": "Trevor Bohm"
};
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
const ALERT_FIELD_LABELS = [ "Sold Estimate Alert", "Name", "Estimate#", "Estimate #", "Opportunity#", "Opportunity #", "Sold by", "Sold By", "Date", "Amount", "Customer", "Job#", "Job #" ];
function previewMorningSalesBrief() {
  const cfg = DAILY_RECAP_CONFIG;
  const now = new Date();
  const yIso = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "yyyy-MM-dd");
  const yLabel = Utilities.formatDate(new Date(now.getTime() - 86400000), cfg.timeZone, "EEEE, MMMM d, yyyy");
  const brief = buildMorningSalesBrief_(yIso, yLabel);
  Logger.log(brief.body);
  return brief;
}
function growthTabFor_(iso) {
  const day = Utilities.formatDate(
    new Date(Date.parse(iso + "T12:00:00Z")), DAILY_RECAP_CONFIG.timeZone, "EEEE");
  return (day === "Saturday" || day === "Sunday") ? "Weekend" : day;
}
const GROWTH_ROWS = [ {
  key: "marketedLeads", label: "hvac marketed leads"
},
{
  key: "marketedDeals", label: "hvac marketed deals"
},
{
  key: "marketedRate", label: "marketed l2c"
},
{
  key: "techFlipLeads", label: "hvac tech flip leads"
},
{
  key: "techFlipDeals", label: "hvac tech flip deals"
},
{
  key: "techFlipRate", label: "hvac tech flip l2c"
},
{
  key: "revenue", label: "hvac rev"
},
{
  key: "avgTicket", label: "hvac avg ticket"
}
/* NPS is deliberately absent. It comes from a survey this script cannot see, and a zero written there would read as a real score. */
];
function growthLabelKey_(v) {
  return String(v || "").toLowerCase()
    .replace(/filp/g, "flip")                 // the sheet's own typo
  .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
function planGrowthSheetWrite_(iso) {
  const cfg = DAILY_RECAP_CONFIG;
  const problems = [];
  /* Both spellings, because the sheet uses both: the Weekend tab heads its two
  columns "Sat" and "Sun" while every weekday tab is headed with the full
  name — "Monday", not "Mon". Matching only the abbreviation is what made
  the first weekday run refuse; matching only the full name would break the
  weekend. Accept either and let the duplicate check below catch a tab that
  somehow carries both. */
  const dayFull = Utilities.formatDate(
    new Date(Date.parse(iso + "T12:00:00Z")), cfg.timeZone, "EEEE");
  const dayAbbr = dayFull.slice(0, 3);
  const day = dayFull;
  const isDayHeader = v => {
    const k = growthLabelKey_(v);
    return k === dayFull.toLowerCase() || k === dayAbbr.toLowerCase();
  };
  const wantTab = GROWTH_SHEET_TAB || growthTabFor_(iso);
  let ss, sheet;
  try {
    ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
    sheet = ss.getSheetByName(wantTab);
    /* Before the six tabs exist there is one sheet holding everything, and
    falling back to it beats refusing to run at all. */
    if (!sheet && ss.getSheets().length === 1) sheet = ss.getSheets()[0];
  }
  catch (err) {
    return {
      ok: false, problems: ["Could not open the growth sheet: " +
      (err && err.message ? err.message : String(err)) +
      "  (an .xlsx cannot be opened this way — it has to be saved as a Google Sheet)"]
    };
  }
  if (!sheet) {
    return {
      ok: false, problems: [
      'No tab named "' + wantTab + '".',
      "Tabs on this workbook: " + ss.getSheets().map(s => s.getName()).join(", "),
      "A tab is named for the day it covers — Sat and Sun both go on Weekend."
    ]
    };
  }
  const grid = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 40),
    Math.min(sheet.getLastColumn(), 20)).getValues();
  /* The header row is the one carrying the day names. */
  let headerRow = -1, col = -1, matches = 0;
  for (let r = 0;
  r < grid.length && headerRow === -1;
  r++) {
    for (let c = 0;
    c < grid[r].length;
    c++) {
      if (isDayHeader(grid[r][c])) {
        headerRow = r;
        col = c;
        matches++;
      }
    }
  }
  for (let c = 0;
  col !== -1 && c < grid[headerRow].length;
  c++) {
    if (c !== col && isDayHeader(grid[headerRow][c])) matches++;
  }
  if (col === -1) {
    problems.push('No column headed "' + dayFull + '" or "' + dayAbbr + '" on tab "' +
      sheet.getName() + '".');
    problems.push("Headers seen: " + (grid[0] || [])
      .map((_, c) => grid.map(r => r[c]).filter(String)[0]).filter(String).join(" | "));
    problems.push("Add " + dayFull + " as a header in the day row, then run this again.");
  }
  else if (matches > 1) {
    problems.push('More than one column is headed "' + dayFull + '" — refusing to guess.');
  }
  else {
    const header = growthLabelKey_(grid[headerRow][col]);
    if (header === "mtd" || header.indexOf("budget") !== -1) {
      problems.push("That column is " + grid[headerRow][col] + ", not a day. Refusing.");
    }
  }
  if (problems.length) return {
    ok: false, problems: problems
  };
  const rows = growthRowsFor_(grid);
  const missing = GROWTH_ROWS.filter(s => !rows[s.key]).map(s => s.label);
  if (missing.length) problems.push("Rows not found: " + missing.join(", "));
  return {
    ok: !problems.length, problems: problems, sheet: sheet,
    sheetName: sheet.getName(), day: grid[headerRow] ? grid[headerRow][col] : dayFull,
    col: col + 1, colLetter: growthColLetter_(col + 1),
    headerRow: headerRow + 1, rows: rows
  };
}
function planGrowthMtdWrite_(sheet) {
  const grid = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 40),
    Math.min(sheet.getLastColumn(), 20)).getValues();
  let headerRow = -1, budgetCol = -1;
  for (let r = 0;
  r < grid.length && headerRow === -1;
  r++) {
    for (let c = 0;
    c < grid[r].length;
    c++) {
      if (growthLabelKey_(grid[r][c]).indexOf("budget") !== -1) {
        headerRow = r;
        budgetCol = c;
        break;
      }
    }
  }
  if (headerRow === -1) {
    return {
      ok: false, problems: ['No "FM Budget" header on tab "' + sheet.getName() +
      '", so there is no way to tell which MTD column is the running total.']
    };
  }
  const col = budgetCol - 1;
  if (col < 0 || growthLabelKey_(grid[headerRow][col]) !== "mtd") {
    return {
      ok: false, problems: ['The column before FM Budget on tab "' + sheet.getName() +
      '" is ' + JSON.stringify(grid[headerRow][col]) + ', not MTD. Refusing to guess.']
    };
  }
  const rows = growthRowsFor_(grid);
  const missing = GROWTH_ROWS.filter(s => !rows[s.key]).map(s => s.label);
  if (missing.length) return {
    ok: false, problems: ["Rows not found: " + missing.join(", ")]
  };
  return {
    ok: true, problems: [], sheet: sheet, sheetName: sheet.getName(),
    col: col + 1, colLetter: growthColLetter_(col + 1),
    headerRow: headerRow + 1, rows: rows
  };
}
function growthColLetter_(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}
function previewGrowthSheetWrite() {
  return growthSheetWrite_(false);
}
function writeGrowthSheetDay() {
  return growthSheetWrite_(true);
}
function previewGrowthSheetMtd() {
  return growthMtdWrite_(false);
}
function writeGrowthSheetMtd() {
  return growthMtdWrite_(true);
}
function growthMtdWrite_(commit) {
  const iso = growthTargetIso_();
  const wantTab = GROWTH_SHEET_TAB || growthTabFor_(iso);
  let ss, sheet;
  try {
    ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
    sheet = ss.getSheetByName(wantTab);
    if (!sheet && ss.getSheets().length === 1) sheet = ss.getSheets()[0];
  }
  catch (err) {
    Logger.log("Could not open the growth sheet: " + (err && err.message ? err.message : String(err)));
    return {
      ok: false
    };
  }
  if (!sheet) {
    Logger.log('No tab named "' + wantTab + '". Tabs: ' +
      ss.getSheets().map(s => s.getName()).join(", "));
    return {
      ok: false
    };
  }
  return growthMtdOn_(sheet, iso, commit);
}
function growthSheetDay() {
  return growthReport_(growthTargetIso_(), null);
}
function growthTargetIso_() {
  const cfg = DAILY_RECAP_CONFIG;
  const iso = String(GROWTH_SHEET_DATE || "").trim();
  return iso || Utilities.formatDate(new Date(Date.now() - 86400000), cfg.timeZone, "yyyy-MM-dd");
}
function growthSheetMonthToDate() {
  const iso = growthTargetIso_();
  return growthReport_(iso, iso.slice(0, 8) + "01");
}
function growthValuesFrom_(m) {
  return {
    marketedLeads: m.marketedLeads,
    marketedDeals: m.marketedDeals,
    marketedRate: m.marketedLeads ? m.marketedDeals / m.marketedLeads : 0,
    techFlipLeads: m.techFlipLeads,
    techFlipDeals: m.techFlipDeals,
    techFlipRate: m.techFlipLeads ? m.techFlipDeals / m.techFlipLeads : 0,
    revenue: m.revenue,
    avgTicket: m.sales ? m.revenue / m.sales : 0
  };
}
function nameTokensOverlap_(a, b) {
  const ta = normName_(a).split(" ").filter(t => t.length > 2);
  const tb = normName_(b).split(" ").filter(t => t.length > 2);
  if (!ta.length || !tb.length) return false;
  return ta.some(t => tb.indexOf(t) !== -1);
}
function previewSoldReport() {
  const p = buildSoldReportPayload_("", "");
  const pct = n => p.totals.total ? " (" + Math.round(n * 100 / p.totals.total) + "%)" : "";
  Logger.log("Sold report " + p.fromIso + " to " + p.toIso +
    "\n  total sold:  " + p.totals.total + "   $" + formatMoney_(p.totals.amount) + " (pre-tax)" +
    "\n  same day:    " + p.totals.sameDay + pct(p.totals.sameDay) +
    "\n  prior lead:  " + p.totals.prior + pct(p.totals.prior) +
    "\n  unknown:     " + p.totals.unknown + pct(p.totals.unknown) +
    (p.notReported.length ? "\n  no recap filed: " +
      p.notReported.map(n => n.hca + " (" + n.days + "d)").join(", ") : "") +
    (p.warnings.length ? "\n  ! " + p.warnings.join("\n  ! ") : ""));
  return p;
}
function searchAllThreads_(query, ceiling) {
  const PAGE = 100;
  const max = Math.max(1, ceiling || 1000);
  const out = [];
  let start = 0;
  try {
    while (out.length < max) {
      const want = Math.min(PAGE, max - out.length);
      const batch = GmailApp.search(query, start, want);
      batch.forEach(t => out.push(t));
      /* Fewer than asked for means Gmail ran out, not that we stopped. */
      if (batch.length < want) return {
        ok: true, complete: true, threads: out
      };
      start += batch.length;
    }
  }
  catch (err) {
    return {
      ok: false, complete: false, threads: out,
      error: (err && err.message) ? err.message : String(err)
    };
  }
  return {
    ok: true, complete: false, threads: out
  };
}
const SOLD_ALERT_CEILING = 600;
const COMPLETION_ALERT_CEILING = 600;
const BOOKED_ALERT_CEILING = 900;
const RECAP_REPLY_CEILING = 400;
function namesMatch_(a, b) {
  const x = normName_(a), y = normName_(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.indexOf(y) !== -1 || y.indexOf(x) !== -1)) return true;
  return fuzzyNameMatch_(nameSignature_(a), nameSignature_(b));
}
const NAME_STOPWORDS = ["M", "F", "MR", "MRS", "MS", "DR", "JR", "SR", "II", "III", "IV", "AND", "OR", "THE", "OF"];
const NAME_WEAK_TOKENS = [ "PROPERTY", "PROPERTIES", "MANAGEMENT", "MANAGMENT", "MGMT", "LLC", "INC", "CORP", "CORPORATION", "COMPANY", "ASSOCIATION", "ASSOC", "HOA", "CHURCH", "BAPTIST", "CENTER", "CENTRE", "SCHOOL", "RESTAURANT", "APARTMENTS", "APTS", "CONDOMINIUM", "CONDO", "MINISTRIES", "HOLDINGS", "GROUP", "SERVICES", "LLP", "TRUST", "FAMILY", "RESIDENCE" ];
const NAME_PARTICLE_RE = /\b(MC|MAC|VAN|VON|DE|DEL|DELA|LA|LE|DI|DA|ST)\s+(?=[A-Z])/g;
function levenshtein_(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = [];
  for (let j = 0;
  j <= b.length;
  j++) prev[j] = j;
  for (let i = 1;
  i <= a.length;
  i++) {
    const cur = [i];
    for (let j = 1;
    j <= b.length;
    j++) {
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
function parseBookedAlert_(rawBody, received) {
  const lines = String(rawBody || "").split(/\r?\n/).map(l => l.trim());
  const body = String(rawBody || "");
  let jobType = "", jobNumber = "", appointmentIso = "", appointmentAt = "", customer = "";
  for (let i = 0;
  i < lines.length;
  i++) {
    const line = lines[i];
    if (!jobType && /^Sales Quote\s*[-–—]\s*\S/.test(line)) {
      jobType = line.replace(/^Sales Quote\s*[-–—]\s*/, "").trim();
      continue;
    }
    if (!jobNumber) {
      const m = line.match(/^#\s*(\d{4,})\s*$/);
      if (m) {
        jobNumber = m[1];
        continue;
      }
    }
    /* The date line is what anchors everything: the customer is the next
    non-empty line after it. */
    const when = line.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*$/i);
    if (when && !appointmentIso) {
      const d = resolveAlertDate_(Number(when[1]), Number(when[2]), received);
      if (!d) continue;
      appointmentIso = d;
      appointmentAt = when[1] + "/" + when[2] + " " + when[3];
      for (let j = i + 1;
      j < lines.length;
      j++) {
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
    suits them — "COW: (206) 555-0142 Michael", "COW: Syed (425) 555-0187",
    "COW: JOHN 206-555-0163". Pull the number, ignore the arrangement. */
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
function resolveAlertDate_(month, day, received) {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return "";
  const tz = DAILY_RECAP_CONFIG.timeZone;
  const base = received instanceof Date ? received : new Date();
  const year = Number(Utilities.formatDate(base, tz, "yyyy"));
  const candidates = [year, year + 1, year - 1];
  for (let i = 0;
  i < candidates.length;
  i++) {
    const d = new Date(candidates[i], month - 1, day, 12, 0, 0);
    if (isNaN(d.getTime())) continue;
    if (d.getMonth() !== month - 1) continue;
    // 2/30 and friends
    const drift = (d.getTime() - base.getTime()) / 86400000;
    if (drift >= -7 && drift <= 200) {
      return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  }
  return "";
}
function resetJobFields_(h) {
  h.soldAlerts = [];
  h.statusDrift = [];
  h.soldNotReported = [];
  h.installed = [];
  h.reportedNotBooked = [];
  h.bookedMatched = 0;
  h.soldPerServiceTitan = 0;
  h.soldAmountPerServiceTitan = 0;
  h.soldAmountNeedsReview = false;
}
const JOB_STATUS_HEADERS = [ "Date", "HCA", "Customer", "Reported", "Outcome Reported", "Lead Source Reported", "Booked Job#", "Appointment", "Job Type", "Lead Source (Booked)", "Dispatch Note", "System Age", "Timeline", "Sold", "Sold Amount", "Sold On", "Estimates", "Estimate Detail", "Amount Needs Review", "Install Scheduled", "Install Completed", "Install Description", "COMBO Sales Rep", "Notes", "Status", "Updated At", "Key",
/* From the BI leads export. Appended rather than inserted so the column positions everything else already relies on do not move. */
"BI Rep", "BI Lead Type", "BI Job Status" ];
const JS = {
  date: 0, hca: 1, customer: 2, reported: 3, outcome: 4, sourceReported: 5, jobNumber: 6, appointment: 7, jobType: 8, sourceBooked: 9, dispatch: 10, systemAge: 11, timeline: 12, sold: 13, amount: 14, soldOn: 15, estimateCount: 16, estimateDetail: 17, needsReview: 18, installScheduled: 19, installCompleted: 20, installDescription: 21, comboRep: 22, notes: 23, status: 24, updatedAt: 25, key: 26, biRep: 27, biLeadType: 28, biJobStatus: 29
};
function encodeEstimates_(estimates) {
  return (estimates || []).map(e =>
    (e.amount === null || e.amount === undefined ? "" : e.amount) + "@" + (e.soldOn || "")
  ).join(" | ");
}
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
function trashBiTemp_(id) {
  if (!id) return;
  try {
    DriveApp.getFileById(id).setTrashed(true);
  }
  catch (err) {
    Logger.log("Left a temp BI conversion behind in Drive (" + id + "): " +
      (err && err.message ? err.message : String(err)));
  }
}
function biLookup_(bi, jobNumber, customer, iso) {
  if (!bi || !bi.byJob) return null;
  if (jobNumber && bi.byJob[jobNumber]) return bi.byJob[jobNumber];
  const n = normName_(customer);
  if (!n) return null;
  return (iso && bi.byCustomerDate[n + "|" + iso]) || bi.byCustomerDate[n] || null;
}
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
const FOLLOWUP_HEADERS = [ "Due", "Due In", "HCA", "Customer", "Outcome", "Offered", "Amount", "Objection", "Phone", "Ran On", "Age (days)", "What They Said", "Key" ];
function isoToDate_(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
const EMAIL_NOTE_HEADERS = [ "Job Date", "HCA", "Customer", "Thread Date", "From", "Subject", "Summary", "Link", "Key" ];
function summariseEmail_(body, senderName) {
  const own = ownText_(body);
  const who = normName_(senderName);
  const out = [];
  const linesAll = String(own || "").split(/\r?\n/).map(l => l.trim());
  for (let i = 0;
  i < linesAll.length;
  i++) {
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
  /* Clamped to the grid. Asking for 17 columns of a sheet somebody trimmed to
  13 throws "Range exceeds sheet width" and takes the whole nightly job with
  it; a short row just reads as blank in the tail columns. */
  const w = Math.max(1, Math.min(width, sheet.getMaxColumns()));
  return sheet.getRange(2, 1, last - 1, w).getValues();
}
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
  /* Same hour as the send, deliberately. They share no data — the brief
  reports yesterday, the send asks about today — and they go to different
  people, so the order they fire in does not matter. */
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
  /* Refreshes the Growth tabs through the single locked pipeline. */
  ScriptApp.newTrigger("runGrowthDailyPipeline")
    .timeBased().everyDays(1).atHour(cfg.growthWriteHour)
    .inTimezone(cfg.timeZone).create();
  Logger.log("Installed daily recap triggers (send " + cfg.sendHour + ":00, collect " +
    cfg.collectHour + ":" + pad2_(cfg.collectMinute) +
    (cfg.nudgeEnabled ? ", nudge " + cfg.nudgeHourWorking + ":00 working / " +
      cfg.nudgeHourOff + ":00 off" : ", chase folded into the " + cfg.sendHour + ":00 send") +
    ", reply sweep hourly, sales brief " + cfg.morningBriefHour + ":00" +
    ", growth sheet " + cfg.growthWriteHour + ":00" +
    ", job status 9:00 and 22:00 " + cfg.timeZone + ").");
}
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
const CAAS_TERM_MONTHS = 96;
function caasContractValue_(monthlyAmount) {
  const n = Number(monthlyAmount);
  if (!isFinite(n) || n <= 0) return null;
  return n * CAAS_TERM_MONTHS;
}
function dealUnitFor_(dealText, oneTime, caasMonthly, mentionsMonthly) {
  if (!dealText) return "";
  /* Number(0) is not a price. "$0 down, $349 a month" was writing a $0 one-time
  figure and calling the row "Both". */
  const hasOne = oneTime !== "" && oneTime !== null && oneTime !== undefined && Number(oneTime) > 0;
  const hasMo = caasMonthly !== "" && caasMonthly !== null && caasMonthly !== undefined && Number(caasMonthly) > 0;
  if (hasOne && hasMo) return "Both";
  if (hasMo) return "Monthly";
  if (hasOne) return "One-time";
  return mentionsMonthly ? "Monthly" : "One-time";
}
function recapKeyColumn_() {
  const i = RECAP_LOG_HEADERS.indexOf("Key");
  if (i === -1) throw new Error("Recap Log has no Key column.");
  return i + 1;
  /* 1-based */
}
function ensureRecapLogColumns_(sheet) {
  const width = RECAP_LOG_HEADERS.length;
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
  const current = sheet.getRange(1, 1, 1, width).getValues()[0];
  let changed = false;
  for (let i = 0;
  i < width;
  i++) {
    if (String(current[i]).trim() !== RECAP_LOG_HEADERS[i]) changed = true;
  }
  if (changed) {
    sheet.getRange(1, 1, 1, width).setValues([RECAP_LOG_HEADERS])
      .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
  return changed;
}
function reprocessThursdayAndFriday() {
  return reprocessRecapDates(["2026-07-30", "2026-07-31"], false);
}
function previewReprocessThursdayAndFriday() {
  return reprocessRecapDates(["2026-07-30", "2026-07-31"], true);
}
function previewReprocessAllRecapDates() {
  return reprocessAllRecapDates(true);
}
const FOLLOWUP_ACTIVITY_SHEET = "Follow-up Activity";
const FOLLOWUP_ACTIVITY_HEADERS = ["Date", "HCA", "Who", "What Happened", "Signal", "Key"];
function followUpSignal_(text) {
  const t = String(text || "").toLowerCase();
  if (/\bsold\b|\bclosed\b|\bsigned\b|\bwon\b/.test(t)) return "SOLD";
  if (/down payment|deposit|check from|financing approved/.test(t)) return "DEPOSIT";
  if (/moving forward|proceeding|going ahead|green ?light/.test(t)) return "MOVING FORWARD";
  if (/set ?up|schedul|site visit|appointment|needs to be/.test(t)) return "SCHEDULING";
  if (/no answer|did ?n'?t answer|unreachable|left (a )?(voicemail|message)|vm\b/.test(t)) return "NO CONTACT";
  if (/lost|went (with )?another|cancel/.test(t)) return "LOST";
  return "OTHER";
}
function followUpWho_(line) {
  const body = String(line || "").replace(/^\s*[-–—•*]+\s*/, "").trim();
  const first = body.split(/\s*[-–—]\s*/)[0].trim();
  if (!first || (first === body && !/[-–—]/.test(body))) {
    /* No dash at all: accept only if the whole short line is plainly a name. */
    if (/^[A-Z][a-z]+(?:\s+[A-Z][A-Za-z'’]+){1,2}$/.test(body)) return body;
    return "";
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][A-Za-z'’]+){0,2}$/.test(first)) return first;
  return "";
}
function splitFollowUpBlob_(blob) {
  return String(blob || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !/^follow-?ups?\b.*[…:]\s*$/i.test(l));
}
function followUpActivityKey_(isoDate, hca, line) {
  const norm = String(line).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
  return isoDate + "|" + String(hca).toLowerCase() + "|" + norm;
}
function previewFollowUpActivity() {
  return rebuildFollowUpActivity(true);
}
function previewFollowUpActivityV2() {
  return rebuildFollowUpActivityV2(true);
}
function followUpKeyV2_(isoDate, hca, line) {
  const norm = String(line).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80).trim();
  return isoDate + "|" + String(hca).toLowerCase().trim() + "|" + norm;
}
function splitFollowUpBlobV2_(blob) {
  return String(blob || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !/^follow-?ups?\b.*[…:]\s*$/i.test(l));
}
function followUpSignalV2_(text) {
  const t = String(text || "").toLowerCase();
  if (/\bsold\b|\bclosed\b|\bsigned\b|\bwon\b/.test(t)) return "SOLD";
  if (/down payment|deposit|check from|financing approved/.test(t)) return "DEPOSIT";
  if (/moving forward|proceeding|going ahead|green ?light|verbally committed/.test(t)) return "MOVING FORWARD";
  if (/set ?up|schedul|site visit|appointment|needs to be/.test(t)) return "SCHEDULING";
  if (/no answer|did ?n'?t answer|unreachable|left (a )?(voicemail|message|vm)\b|\bvm\b/.test(t)) return "NO CONTACT";
  if (/lost|went (with )?another|cancel/.test(t)) return "LOST";
  return "OTHER";
}
function followUpWhoV2_(line) {
  const NOT_A_NAME = /^(none|nobody|nothing|no|yes|na|n\/a|all|any|other|misc|update|notes?|follow|followups?|called|calling|texted|texting|emailed|left|set|sent|spoke|tried|waiting|still|new|picking|picked|per|re)$/i;
  const body = String(line || "").replace(/^\s*[-–—•*]+\s*/, "").trim();
  const first = body.split(/\s*[-–—]\s*/)[0].trim();
  if (!first || (first === body && !/[-–—]/.test(body))) {
    if (NOT_A_NAME.test(body)) return "";
    if (/^[A-Z][a-z]+(?:\s+[A-Z][A-Za-z'’]+){1,2}$/.test(body)) return body;
    return "";
  }
  if (NOT_A_NAME.test(first)) return "";
  if (/^[A-Z][a-z]+(?:\s+[A-Z][A-Za-z'’]+){0,2}$/.test(first)) return first;
  return "";
}
function previewFixRecapDateColumns() {
  return fixRecapDateColumns(true);
}
function previewFixAllDateColumns() {
  return fixAllDateColumns(true);
}
function verifyJobStatusVisible() {
  const cfg = DAILY_RECAP_CONFIG;
  const book = getLogSpreadsheet_();
  const toIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  const fromIso = Utilities.formatDate(new Date(Date.now() - 13 * 86400000), cfg.timeZone, "yyyy-MM-dd");
  const all = readSheetRows_(book.ss, cfg.jobStatusSheetName, JOB_STATUS_HEADERS.length);
  const inWindow = all.filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso);
  const iSold = JOB_STATUS_HEADERS.indexOf("Sold");
  const sold = inWindow.filter(r => /^y|^sold|^true/i.test(String(r[iSold] || ""))).length;
  const msg = "Job Status: " + all.length + " row(s) on the tab, " +
    inWindow.length + " inside " + fromIso + " to " + toIso +
    ", " + sold + " marked sold." +
    (inWindow.length ? "" : "  STILL ZERO — tell me.");
  Logger.log(msg);
  return msg;
}
const RENTAL_SHEET_NAME = "Rentals";
const RENTAL_HEADER_ROW = 4;
const RENTAL_FIRST_DATA_ROW = RENTAL_HEADER_ROW + 1;
const RENTAL_HEADERS = [ "Sold On", "HCA", "Customer", "Estimate", "Job #", "ST Amount", "Rental?", "Monthly $", "Contract $", "Why Flagged", "Recap Line", "Updated At", "Key" ];
const RENTAL_COL_ISRENTAL = 6;
const RENTAL_COL_MONTHLY = 7;
function rentalSignal_(name) {
  const s = String(name || "");
  const POSITIVE = /\bcomfort club\b|\bcaas\b|\brental\b|\brent\b|\bper month\b|\ba month\b|\bmonthly\b|\/\s*mo\b/i;
  /* Accessories and service work. A rental is equipment, not a part. */
  const ACCESSORY = /\bthermostat\b|\bt-?stat\b|\bsensor\b|\brelay panel\b|\bsurge\b|\bfilter\b|\buv\b|\bhumidifier\b|\bdamper\b|\bdryer vent\b|\bduct clean|\bmaintenance\b|\bdiagnostic\b|\bcapacitor\b|\bcontrol board\b/i;
  /* The equipment a rental is actually written on. */
  const SYSTEM = /\bfurnace\b|\bodu\b|\boutdoor unit\b|\bheat pump\b|\bair handler\b|\bwater heater\b|\bhwt\b|\bmini ?split\b|\bductless\b|\bcondenser\b|\bpackage\b|\bsystem\b/i;
  if (POSITIVE.test(s)) return {
    verdict: "Yes", reason: "estimate name says rental / Comfort Club"
  };
  if (ACCESSORY.test(s) && !SYSTEM.test(s)) {
    return {
      verdict: "No", reason: "accessory, not a system — you said these are never rentals"
    };
  }
  return {
    verdict: "", reason: ""
  };
}
function rentalMarkerIn_(text) {
  return rentalSignal_(text).verdict === "Yes";
}
function rentalMonthlyFromName_(name) {
  const s = String(name || "");
  const m = s.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/\s*mo\.?|\/\s*month|\s*per\s*month|\s*a\s*month|\s*monthly)/i) ||
            s.match(/(?:\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:\/\s*mo\.?|\/\s*month|\s*per\s*month|\s*a\s*month)\b/i);
  if (!m) return "";
  const n = Number(String(m[1]).replace(/,/g, ""));
  /* A monthly payment lives between a few dollars and a few hundred. Anything
  larger is the system price sitting next to the word "month" by accident. */
  if (!isFinite(n) || n <= 0 || n >= DEAL_FIGURE_FLOOR) return "";
  return n;
}
function rentalRowKey_(hca, customer, jobNumber) {
  return [String(hca || "").toLowerCase().trim(),
          normName_(customer || ""),
          String(jobNumber || "").trim()].join("|");
}
function previewRentalRegister() {
  return refreshRentalRegister(true);
}
const SIGNED_SHEET_NAME = "Signed vs Sold";
const SIGNED_ALERT_CEILING = 300;
const SIGNED_HEADERS = [ "Signed On", "HCA", "Customer", "Estimate #", "Opportunity #", "Signed $", "Sold $", "Difference", "Diff %", "Sold On", "Estimate", "Status", "Key" ];
function previewSignedVsSold() {
  return refreshSignedVsSold(true);
}
function cleanAlertNumber_(v) {
  const s = String(v === null || v === undefined ? "" : v).trim();
  if (!s) return "";
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}
function previewTidyAlertNumbers() {
  return tidyAlertNumbers(true);
}
const MONDAY_GROWTH_GID = 380360160;
const MONDAY_GROWTH_BLOCK = "Aug 3rd";
const MONDAY_GROWTH_NOTE = "1 marketed close Monday — Sergei Leonov (Web), $17,151.65. Haberman was re-papered " + "Monday but closed 7/31; his Comfort Club rental runs $464.99/mo, $44,639 over the " + "8-year term, as deferred rental income, so it shows $0 in today's revenue. " + "Chester ran 3 inbound consults, all in follow-up.";
const MONDAY_GROWTH_VALUES = {
  "HVAC Marketed Leads": [6, 9], "HVAC Marketed Deals": [1, 1], "HVAC AVG Ticket": [17151.65, 16953.86]
};
function previewWriteMondayGrowth() {
  return writeMondayGrowth(true);
}
const GROWTH_DAY_TARGETS = [ {
  block: "Aug 1st thru Aug 3", day: "Sat", values: {
    "HVAC Rev": 16756.07, "HVAC AVG Ticket": 16756.07
  }
},
{
  block: "Aug 1st thru Aug 3", day: "Sun", values: {
    "HVAC Rev": 0, "HVAC AVG Ticket": 0
  }
},
{
  block: "Aug 3rd", day: "Monday", values: {
    "HVAC Marketed Leads": 6, "HVAC Marketed Deals": 1, "HVAC AVG Ticket": 17151.65
  },
  mtd: {
    "HVAC Marketed Leads": 9, "HVAC Marketed Deals": 1, "HVAC AVG Ticket": 16953.86
  },
  note: "1 marketed close Monday — Sergei Leonov (Web), $17,151.65. Haberman was " + "re-papered Monday but closed 7/31; his Comfort Club rental runs $464.99/mo, " + "$44,639 over the 8-year term, as deferred rental income, so it shows $0 in " + "today's revenue. Chester ran 3 inbound consults, all in follow-up."
}
];
function moveGrowthWriteTo4am() {
  return moveGrowthWriteTo(4);
}
function moveGrowthWriteTo5am() {
  return moveGrowthWriteTo(5);
}
var SAMEDAY_SYSTEM_FLOOR = 2000;
var BOOKED_LOOKBACK_DAYS = 60;
function signedCeiling_() {
  try {
    return SIGNED_ALERT_CEILING || 300;
  }
  catch (err) {
    return 300;
  }
}
function signedAlertText_(msg) {
  var html = "";
  try {
    html = String(msg.getBody() || "");
  }
  catch (err) {
    html = "";
  }
  var text = "";
  if (html && /<[a-z!\/]/i.test(html)) {
    text = html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<img[^>]*>/gi, " ")
    /* tracking pixel, long digit-bearing URL */
    .replace(/<[^>]+>/g, " ");
    /* keeps anchor text, drops the href */
  }
  if (!/Estimate/i.test(text)) {
    try {
      text = String(msg.getPlainBody() || "");
    }
    catch (err) {
      text = text || "";
    }
  }
  return decodeAlertEntities_(text)
    .replace(/<?https?:\/\/\S+>?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function cleanSignedCustomer_(v) {
  var s = String(v || "").replace(/[<>]/g, " ")
    .replace(/^[\s\-–—:(]+|[\s\-–—:(]+$/g, "").trim();
  if (!s) return "";
  if (/^https?:/i.test(s)) return "";
  if (/has signed|approved|follow ?ups|book it into/i.test(s)) return "";
  if (!/[A-Za-z]/.test(s)) return "";
  return s.length > 60 ? "" : s;
}
function extractAlertCustomer_(text) {
  var re = /Customer\b/gi, m;
  while ((m = re.exec(text)) !== null) {
    re.lastIndex = m.index + m[0].length;
    var seg = text.slice(re.lastIndex).match(
      /^\s*#?\s*:?\s*(.{1,80}?)\s*(?=Estimate\b|Opportunity\b|Amount\b|Job\s*#|Sold\s+by\b|Date\s*:|Name\s*:|$)/i);
    if (!seg) continue;
    var c = cleanSignedCustomer_(seg[1]);
    if (c) return c;
  }
  return "";
}
function parseSignedAlert_(text) {
  var est = text.match(/Estimate\s*#?\s*:?\s*(\d{6,})/i);
  var opp = text.match(/Opportunity\s*#?\s*:?\s*(\d{6,})/i);
  var amt = text.match(/Amount\s*:?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i) ||
            text.match(/Amount\s*:?\s*([\d,]+\.\d{2})\b/i);
  if (!est || !amt) return null;
  var amount = Number(String(amt[1]).replace(/,/g, ""));
  if (!isFinite(amount)) return null;
  return {
    customer: extractAlertCustomer_(text),
    estimateNumber: est[1],
    opportunityNumber: opp ? opp[1] : "",
    amount: amount
  };
}
var SYSTEM_MIN_DOLLARS = 2000;
var RENTAL_MAX_DOLLARS = 1;
function hvacBucket_(soldAmt, signedAmt) {
  var hasD = soldAmt !== "" && isFinite(Number(soldAmt));
  var amt = hasD ? Number(soldAmt) : (isFinite(Number(signedAmt)) ? Number(signedAmt) : 0);
  if (amt < RENTAL_MAX_DOLLARS) return "rental";
  if (amt < SYSTEM_MIN_DOLLARS) return "nonsystem";
  return "system";
}
function soldTuesday() {
  return soldOnDay("2026-08-04");
}
var SOLD_TODAY_LOOKBACK_DAYS = 30;
var FIREPLACE_NAME_RE = /\bfireplace\b|\bfire place\b|zero clearance|heat\s*&\s*glo|heatilator|\bhearth\b|\bgas insert\b|\blog set\b|\bfirebox\b|\bfire box\b/i;
function isFireplaceSale_(name) {
  return FIREPLACE_NAME_RE.test(String(name || ""));
}
function soldTodayBucket_(alert) {
  if (isFireplaceSale_(alert.name)) return "fireplace";
  return hvacBucket_(alert.amount, "");
}
function stToday_() {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}
function stJobKey_(v) {
  var m = String(v == null ? "" : v).match(/\d{6,}/);
  return m ? m[0] : "";
}
function soldToday() {
  return soldOnDay(stToday_());
}
function previewTodayGrowth() {
  return growthTodayWrite_(false);
}
function refreshTodayGrowth() {
  return growthTodayWrite_(true);
}
function growthTodayWrite_(commit) {
  var iso = stToday_();
  var day = growthReport_(iso, null);
  // computes + logs today's numbers
  var out = [];
  out.push("");
  out.push(new Array(46).join("="));
  out.push("TODAY growth " + (commit ? "WRITE" : "PREVIEW — nothing written") + " — " + iso);
  /* A partial sold read would understate revenue; refuse rather than publish it. */
  if (day.soldOk && !day.soldComplete) {
    out.push(" ! REFUSING — sold-alert read hit its ceiling, revenue is partial.");
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: ["sold-alert read incomplete"]
    };
  }
  var plan = planGrowthSheetWrite_(iso);
  if (!plan.ok) {
    (plan.problems || ["could not locate today's column"]).forEach(function (p) {
      out.push(" ! " + p);
    }
    );
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: plan.problems
    };
  }
  out.push(" sheet: " + plan.sheetName + " column " + plan.colLetter + ' (headed "' + plan.day + '")');
  var values = growthValuesFrom_(day);
  var wrote = 0, skippedFormula = 0;
  GROWTH_ROWS.forEach(function (spec) {
    var row = plan.rows[spec.key];
    if (!row) {
      out.push(" ! row not found: " + spec.label);
      return;
    }
    var cell = plan.sheet.getRange(row, plan.col);
    if (String(cell.getFormula() || "")) {
      skippedFormula++;
      out.push(" = " + plan.colLetter + row + " " + spec.label + " holds a formula — left alone");
      return;
    }
    out.push(" " + plan.colLetter + row + " " + (spec.label + " ").slice(0, 22) + JSON.stringify(values[spec.key]));
    if (commit) cell.setValue(values[spec.key]);
    wrote++;
  }
  );
  out.push(commit ? (" wrote " + wrote + " cell(s) to today's column" + (skippedFormula ? ", " + skippedFormula + " formula(s) left alone" : "") + ".") : (" (run refreshTodayGrowth to commit; " + skippedFormula + " formula cell(s) would be left alone)"));
  var mtd = growthMtdOn_(plan.sheet, iso, commit);
  // MTD always refreshes
  Logger.log(out.join("\n"));
  return {
    ok: true, wrote: commit ? wrote : 0, planned: wrote, skippedFormula: skippedFormula, mtd: mtd
  };
}
function installHourlyGrowthUpdate() {
  var removed = removeHourlyGrowthUpdate();
  ScriptApp.newTrigger("refreshTodayGrowth").timeBased().everyHours(1).create();
  var msg = "Hourly growth update installed" + (removed ? " (replaced " + removed + " old one[s])" : "") +
    ". refreshTodayGrowth force-writes TODAY's column every hour; other days and formulas are untouched.\n" +
    "installDailyRecapTriggers() does NOT remove this — use removeHourlyGrowthUpdate() to stop it.";
  Logger.log(msg);
  return msg;
}
var SOLD_TODAY_TAB = "Sold Today";
function installSoldTodayLive_(minutes) {
  removeSoldTodayLive();
  ScriptApp.newTrigger("refreshSoldTodayTab").timeBased().everyMinutes(minutes).create();
  var msg = 'Sold Today tab set to refresh every ' + minutes + ' minutes. Open the "' + SOLD_TODAY_TAB +
    '" tab and leave it up. Stop it with removeSoldTodayLive(). installDailyRecapTriggers() does NOT touch this.';
  Logger.log(msg);
  return msg;
}
function installSoldTodayLive()   {
  return installSoldTodayLive_(30);
}
function installSoldTodayLive15() {
  return installSoldTodayLive_(15);
}
var RECAP_FORM_ID_PROP = "recapFormId";
function showRecapFormLink() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form built yet — run buildRecapForm() first.");
    return "";
  }
  try {
    var f = FormApp.openById(id);
    var msg = "Recap form:\n FILL (share this): " + f.getPublishedUrl() + "\n EDIT: " + f.getEditUrl();
    Logger.log(msg);
    return f.getPublishedUrl();
  }
  catch (err) {
    Logger.log("Stored form id is unreachable: " + (err && err.message ? err.message : String(err)));
    return "";
  }
}
function previewRecapFormImport() {
  return importRecapFormResponses_(true);
}
function installRecapFormTrigger() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    var f = "Build the form first (buildRecapForm()).";
    Logger.log(f);
    return f;
  }
  var removed = removeRecapFormTrigger();
  var form = FormApp.openById(id);
  ScriptApp.newTrigger("importRecapFormResponses").forForm(form).onFormSubmit().create();
  var msg = "Auto-import installed" + (removed ? " (replaced " + removed + ")" : "") +
    " — every form submission now writes into the Recap Log and refreshes the 1:1 tabs. Stop it with removeRecapFormTrigger().";
  Logger.log(msg);
  return msg;
}
function oneOnOneTabName_(name) {
  return ("1on1 — " + String(name || "")).replace(/[:\\\/\?\*\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}
var USE_RECAP_FORM_PROP = "useRecapForm";
function usingRecapForm_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(USE_RECAP_FORM_PROP) === "true";
  }
  catch (err) {
    return false;
  }
}
function recapFormUrl_() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) return "";
  try {
    return FormApp.openById(id).getPublishedUrl();
  }
  catch (err) {
    return "";
  }
}
function goRecapForm() {
  if (!recapFormUrl_()) {
    var w = "No form found — run buildRecapForm() first. Nothing changed.";
    Logger.log(w);
    return w;
  }
  PropertiesService.getScriptProperties().setProperty(USE_RECAP_FORM_PROP, "true");
  var msg = "The 6am send now invites HCAs to the FORM:\n  " + recapFormUrl_() +
    "\nRun goRecapTemplate() to switch back. Old email replies are still collected.";
  Logger.log(msg);
  return msg;
}
function goRecapTemplate() {
  PropertiesService.getScriptProperties().setProperty(USE_RECAP_FORM_PROP, "false");
  var msg = "The 6am send is back to the reply-by-email template.";
  Logger.log(msg);
  return msg;
}
function showRecapSendMode() {
  var onForm = usingRecapForm_();
  var msg = "6am send is using the " + (onForm ? "FORM invite" : "email TEMPLATE") + "." +
    (onForm ? "\n  form: " + recapFormUrl_() : "");
  Logger.log(msg);
  return msg;
}
function buildRecapBody_(hca, dateLabel, owed) {
  var url = (typeof recapFormUrl_ === "function" && recapFormUrl_())
    || (typeof enFormUrl_ === "function" && enFormUrl_())
    || "https://docs.google.com/forms/d/e/1FAIpQLSf_A1lXHWCk8tABXIx0r0tDmCHpR7DJay-pLR-jmjtgpJCbyg/viewform";
  var nudge = owed ? "You haven't logged " + owed + " yet — please add those appointments too.\n\n" : "";
  return "Hi " + hca.first + ",\n\n" + nudge +
    "Fill out the recap form for each appointment today (" + dateLabel + ") as you finish it:\n\n" +
    url + "\n\n" +
    "One submission per appointment, as many as you run.\n\n" +
    /* The 7pm nudge has always offered this fallback; the 6am mail did not, so
    the only reps who learned email was an option were the ones who got nagged.
    When the Form was down that left everyone else with no stated way to report.
    Field list comes from TEMPLATE_FIELD_ORDER so it cannot drift away from what
    the reply parser expects. */
    "Can't reach the form? Just reply to this email with what you ran:\n\n" +
    TEMPLATE_FIELD_ORDER.map(function (f) { return f + ":"; }).join("\n") + "\n\n" +
    "Either way counts — the form and a reply are the same to me.\n\n" +
    "No consults on the schedule today? You still submit one. Log what you " +
    "actually did — follow-ups, callbacks, tech ride-alongs, install-day " +
    "visits, self-gen. Every working day gets an entry.\n\n" +
    "Thanks,\n" +
    "Geoff\n";
}
var RECAP_ACTIVITIES = [ "Tech Ride Along", "Follow-up Unsold", "Self-Generated Leads", "Install Day Visit", "Previously-Sold Referrals", "Social Media Networking", "Realtor / Property Management Networking" ];
var ACTIVITY_LOG_TAB = "Activity Log";
function activityKey_(iso, hca, activity, ts) {
  return iso + "|" + String(hca).toLowerCase().trim() + "|" +
    String(activity).toLowerCase().trim() + "|" + ts;
}
function importRecapFormResponses() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(90000);
    // wait up to 90s for any running import
  }
  catch (err) {
    Logger.log("Import lock busy — another import is running; these responses will be " + "picked up by that run or the next submit. (" + (err && err.message ? err.message : String(err)) + ")");
    return "lock busy — covered by the concurrent/next run";
  }
  try {
    return importRecapFormResponses_(false);
  }
  finally {
    lock.releaseLock();
  }
}
function mtdLookback_(fromIso) {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var d = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 4;
  return Math.max(2, Math.min(200, d));
}
function monthStartIso_() {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var now = new Date();
  var day = parseInt(Utilities.formatDate(now, tz, "d"), 10);
  if (day >= 2) {
    // 2nd or later: report THIS calendar month, from the 1st.
    return Utilities.formatDate(now, tz, "yyyy-MM") + "-01";
  }
  // The 1st: the prior month's final day (e.g. 8/31) only posts in BI today,
  // so keep reporting the PRIOR calendar month for this one day. Rollover to
  // the new month happens on the 2nd, once the new month's data has posted.
  var prior = new Date(now.getTime());
  prior.setMonth(prior.getMonth() - 1);
  return Utilities.formatDate(prior, tz, "yyyy-MM") + "-01";
}
var SOLD_MTD_TAB = "Sold MTD";
function installSoldMTDLive() {
  removeSoldMTDLive();
  ScriptApp.newTrigger("refreshSoldMTDTab").timeBased().everyMinutes(30).create();
  Logger.log('Sold MTD tab set to refresh every 30 minutes. Open the "' + SOLD_MTD_TAB + '" tab. Stop with removeSoldMTDLive().');
}
function renameRecapForm() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form yet — run buildRecapForm() first.");
    return "";
  }
  var title = "HCA Daily Sales Recap";
  var form = FormApp.openById(id);
  form.setTitle(title);
  try {
    DriveApp.getFileById(id).setName(title);
  }
  catch (e) {
    Logger.log("(Drive file rename skipped — form title still set. " + e + ")");
  }
  Logger.log('Renamed to "' + title + '".\n  Live link: ' + form.getPublishedUrl() +
             '\n  Edit link: ' + form.getEditUrl());
  return form.getPublishedUrl();
}
function pad2_(n) {
  return String(n).length < 2 ? "0" + n : String(n);
}
/* Space-padded variant — ONLY for aligning columns in Logger output.
 * Never use it to build a date or time: that was the pad2_ bug. */
function pad2sp_(n) {
  return String(n).length < 2 ? " " + n : String(n);
}
const ACTIVITY_LOG_HEADERS_RICH = [ "Date", "HCA", "Activity", "Customer", "Source", "Package offered", "Price offered", "Water heater", "Level of interest", "Outcome", "Next follow-up", "Objection", "Objection notes", "What did you do", "Logged At", "Key" ];
function fmtDay_(v) {
  if (v === "" || v == null) return "";
  if (Object.prototype.toString.call(v) !== "[object Date]") return String(v);
  if (isNaN(v.getTime())) return "";
  return Utilities.formatDate(v, Session.getScriptTimeZone() || "America/Los_Angeles", "EEE M/d");
}
function dayStamp_(v) {
  if (v === "" || v == null) return 0;
  var d = (Object.prototype.toString.call(v) === "[object Date]") ? v : new Date(v);
  var t = d.getTime();
  return isNaN(t) ? 0 : t;
}
function sdFloor_() {
  return (typeof SAMEDAY_SYSTEM_FLOOR !== "undefined") ? SAMEDAY_SYSTEM_FLOOR : 2000;
}
function sdLookback_() {
  return (typeof BOOKED_LOOKBACK_DAYS !== "undefined") ? BOOKED_LOOKBACK_DAYS : 60;
}
function bjTz_() {
  try {
    return DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    return "America/Los_Angeles";
  }
}
function bjIsoFromMD_(md, yearHint) {
  var m = String(md || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  return yearHint + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
}
function classifySameDay_(sold, bookedMap) {
  var run = bjRunFor_(sold, bookedMap[sold.job]);
  if (!run || !run.ranIso) return {
    tag: "UNKNOWN", ranIso: ""
  };
  return {
    tag: run.ranIso === sold.soldIso ? "SAME-DAY" : "FOLLOW-UP", ranIso: run.ranIso
  };
}
var ST_NOT_RENTAL_CACHE = null;
var NOT_A_RENTAL = [ "Terry Smith" ];
var NOT_A_SALE = [ ];
var DOUBLE_OK = [ ];
function stIsNominal_(v) {
  return v === null || v === undefined || String(v).trim() === "" ||
    !isFinite(Number(v)) || Number(v) < 1;
}
var ST_REG_CACHE = null;
function stNotARental_(a) {
  if (!stIsNominal_(a.amount)) return false;
  var cust = stNormName_(a.customer);
  for (var i = 0;
  i < NOT_A_RENTAL.length;
  i++) {
    if (stNormName_(NOT_A_RENTAL[i]) === cust) return true;
  }
  var reg = stRegisterInfo_();
  var job = String(a.jobNumber || "").trim();
  if (job && reg.noJob[job]) return true;
  if (cust && reg.noCust[cust]) return true;
  return false;
}
function stNotASale_(a) {
  if (stIsNominal_(a.amount)) return false;
  var cust = stNormName_(a.customer);
  var job = String(a.jobNumber || "").trim();
  for (var i = 0;
  i < NOT_A_SALE.length;
  i++) {
    var raw = String(NOT_A_SALE[i] || "");
    var hash = raw.indexOf("#");
    var wantName = stNormName_(hash >= 0 ? raw.slice(0, hash) : raw);
    var wantJob = hash >= 0 ? raw.slice(hash + 1).replace(/\D/g, "") : "";
    if (wantName !== cust) continue;
    if (!wantJob || wantJob === job) return true;
  }
  return false;
}
function stExcluded_(a) {
  return stNotARental_(a) || stNotASale_(a);
}
function stExplained_(a) {
  if (stExcluded_(a)) return true;
  if (stIsNominal_(a.amount)) {
    var reg = stRegisterInfo_();
    var job = String(a.jobNumber || "").trim();
    if (job && reg.ansJob[job]) return true;
    if (reg.ansCust[stNormName_(a.customer)]) return true;
  }
  return false;
}
function fixTerrySmithRental() {
  var notes = [];
  try {
    var name = (typeof RENTAL_SHEET_NAME !== "undefined") ? RENTAL_SHEET_NAME : "Rentals";
    var headerRow = (typeof RENTAL_HEADER_ROW !== "undefined") ? RENTAL_HEADER_ROW : 4;
    var firstRow = (typeof RENTAL_FIRST_DATA_ROW !== "undefined") ? RENTAL_FIRST_DATA_ROW : 5;
    var colNo = (typeof RENTAL_COL_ISRENTAL !== "undefined") ? RENTAL_COL_ISRENTAL : 6;
    var colMonthly = (typeof RENTAL_COL_MONTHLY !== "undefined") ? RENTAL_COL_MONTHLY : 7;
    var width = (typeof RENTAL_HEADERS !== "undefined") ? RENTAL_HEADERS.length : 13;
    var sheet = getLogSpreadsheet_().ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() >= firstRow) {
      var rows = sheet.getRange(firstRow, 1, sheet.getLastRow() - headerRow, width).getValues();
      var hit = 0;
      for (var i = 0;
      i < rows.length;
      i++) {
        if (stNormName_(rows[i][2]) !== stNormName_("Terry Smith")) continue;
        if (!stIsNominal_(rows[i][5])) continue;
        sheet.getRange(firstRow + i, colNo + 1).setValue("No");
        sheet.getRange(firstRow + i, colMonthly + 1).setValue("");
        hit++;
      }
      notes.push(hit ? ('Register: ' + hit + ' Terry Smith row(s) marked "No".')
                     : "Register: no Terry Smith row found (nothing to mark).");
    }
    else {
      notes.push("Register: no Rentals tab yet — the NOT_A_RENTAL list covers him regardless.");
    }
  }
  catch (e) {
    notes.push("Register: could not update (" + e + ") — the NOT_A_RENTAL list covers him regardless.");
  }
  ST_REG_CACHE = null;
  try {
    notes.push("Sold Today refreshed: " + refreshSoldTodayTab());
  }
  catch (e2) {
    notes.push("Sold Today refresh failed: " + e2);
  }
  var msg = notes.join("\n");
  Logger.log(msg);
  return msg;
}
var EVENING_NUDGE_HOUR = 19;
function enNorm_(s) {
  return String(s || "").trim().toUpperCase();
}
function enNudgeBody_(hca, dateLabel) {
  return "Hi " + (hca.first || String(hca.name || "").split(" ")[0]) + ",\n\n" +
    "Quick nudge — nothing has come in from you for today (" + dateLabel + ") yet.\n\n" +
    "Fill out the recap form for each appointment you ran:\n\n" +
    enFormUrl_() + "\n\n" +
    "Nothing ran today? Submit one anyway with what you did instead — follow-ups,\n" +
    "self-generated work, tech ride-alongs.\n\n" +
    "Thanks,\n" +
    "Geoff\n";
}
function installEveningFormNudge() {
  removeEveningFormNudge();
  ScriptApp.newTrigger("sendEveningFormNudge").timeBased()
    .everyDays(1).atHour(EVENING_NUDGE_HOUR).create();
  var msg = "Evening form nudge installed — fires daily in the " + EVENING_NUDGE_HOUR +
    ":00 hour (project timezone). Remove with removeEveningFormNudge().";
  Logger.log(msg);
  return msg;
}
function l2cLabelIso_(label, yearHint) {
  var m = String(label || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  return yearHint + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
}
function buildL2CTab() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  /* MTD lead figures: Growth Config tab if it has been migrated, otherwise the
     code constants. Read once so every row on the tab uses one consistent set. */
  var bi = growthBiMtd_(ss);
  var NAVY = "#0f172a", AMBER = "#fff7ed", MUT = "#64748b", GOLD = "#ffc000", BLUE = "#4aa3df", GRAY = "#bfbfbf";
  var numF = "#,##0", pctF = "0.0%", moneyF = "$#,##0", div = function (n, dd) {
    return dd ? n / dd : "";
  };
  var mL = 0, tL = 0, sgL = 0, mI = 0, tI = 0, sgI = 0, sold = 0, dollars = 0;
  var growthDays = readGrowthDays_(ss);
  var perDay = growthDays.map(function (x) {
    mL += x[1];
    tL += x[2];
    sgL += x[3];
    mI += x[4];
    tI += x[5];
    sgI += x[6];
    sold += x[7];
    dollars += x[8];
    return {
      label: x[0], leads: x[1] + x[2] + x[3], sold: x[7], inst: x[4] + x[5] + x[6], dollars: x[8]
    };
  }
  );
  var Leads = mL + tL + sgL, Inst = mI + tI + sgI;
  var d = growthDays.length ? growthDays[growthDays.length - 1] : ["-", 0, 0, 0, 0, 0, 0, 0, 0];
  var dInst = d[4] + d[5] + d[6];
  var dLeads = d[1] + d[2] + d[3];
  /* ---- LIVE sold from the ServiceTitan engine (same as Same-Day Sold) ---- */
  var eng = null;
  try {
    if (typeof sameDaySoldMonthData_ === "function") eng = sameDaySoldMonthData_();
  }
  catch (e) {
    eng = null;
  }
  var live = !!(eng && eng.ok);
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e2) {
    tz = "America/Los_Angeles";
  }
  var soldDayVal = d[7], soldMtdVal = sold, sold$DayVal = "", sold$MtdVal = "";
  var soldSourceNote = "stored";
  var todayN = 0, today$ = 0, todayLabel = "", todayIsBIday = false;
  if (live) {
    var year = String(eng.fromIso).slice(0, 4);
    var mtdN = 0, mtd$ = 0;
    Object.keys(eng.days).forEach(function (iso) {
      mtdN += eng.days[iso].total;
      mtd$ += eng.days[iso].dollars;
    }
    );
    soldMtdVal = mtdN;
    sold$MtdVal = mtd$;
    /* ---- per-day sold now comes from the live engine, not the day rows ----
       The day rows' sold column was hand-entered over weeks without the $2,000
       threshold, the approved-seller filter, or re-quote collapsing, so it drifted
       from the engine (56 vs 53 on 8/17). The engine already feeds the Daily tab
       and the Same-Day Sold tab, so reading it here means the three can no longer
       disagree — and it drops a field from the daily entry.

       A day inside the engine's window with no entry genuinely sold nothing, so it
       becomes 0 rather than keeping a stale hand-entered figure. Rows OUTSIDE the
       window (a prior month) keep their stored value, because the engine cannot
       speak to them. Installed dollars are deliberately untouched:
       eng.days[].dollars is SOLD dollars, a different metric from the BI installed
       revenue in column 9. */
    var liveSold = 0, fromLive = 0, keptStored = 0;
    perDay.forEach(function (p) {
      var pIso = l2cLabelIso_(p.label, year);
      if (pIso && eng.days[pIso]) { p.sold = eng.days[pIso].total; fromLive++; }
      else if (pIso && pIso >= eng.fromIso && pIso <= eng.toIso) { p.sold = 0; fromLive++; }
      else { keptStored++; }
      liveSold += p.sold;
    });
    sold = liveSold;
    soldSourceNote = fromLive + " live" +
      (keptStored ? (", " + keptStored + " stored (outside engine window)") : "");

    var dIso = l2cLabelIso_(d[0], year);
    soldDayVal = eng.days[dIso] ? eng.days[dIso].total : 0;
    sold$DayVal = eng.days[dIso] ? eng.days[dIso].dollars : 0;
    var todayIso = eng.toIso;
    todayIsBIday = (todayIso === dIso);
    todayLabel = Utilities.formatDate(new Date(todayIso + "T12:00:00"), tz, "EEE M/d");
    if (eng.days[todayIso]) {
      todayN = eng.days[todayIso].total;
      today$ = eng.days[todayIso].dollars;
    }
  }
  // ============ 1) visible "L2C" reconciliation view ============ (BI, unchanged)
  var lc = ss.getSheetByName("L2C") || ss.insertSheet("L2C");
  lc.clear();
  try {
    lc.showSheet();
  }
  catch (e) {
  }
  lc.getRange("A1").setValue("Lead-2-Cash — daily (reconciled to BI)").setFontWeight("bold").setFontSize(14);
  lc.getRange("A2").setValue("Cash = completed installs · L2C = Installs ÷ Leads · Marketed = Inbound + Webform").setFontColor(MUT);
  lc.getRange(4, 1, 1, 7).setValues([["Date", "Leads", "Sold", "Installs", "L2C %", "Pipeline", "Install $"]]) .setFontWeight("bold").setBackground(NAVY).setFontColor("#ffffff");
  var bodyRows = perDay.map(function (p) {
    return [p.label, p.leads, p.sold, p.inst, div(p.inst, p.leads), p.sold - p.inst, p.dollars];
  }
  );
  bodyRows.push(["MTD", Leads, sold, Inst, div(Inst, Leads), sold - Inst, dollars]);
  lc.getRange(5, 1, bodyRows.length, 7).setValues(bodyRows);
  lc.getRange(5, 5, bodyRows.length, 1).setNumberFormat(pctF);
  lc.getRange(5, 7, bodyRows.length, 1).setNumberFormat(moneyF);
  lc.getRange(4 + bodyRows.length, 1, 1, 7).setFontWeight("bold").setBackground(AMBER);
  var h = 5 + bodyRows.length + 1;
  lc.getRange(h, 1).setValue("L2C by source — MTD").setFontWeight("bold").setFontSize(12);
  lc.getRange(h + 1, 1, 1, 4).setValues([["Source", "Leads", "Installs", "L2C %"]]).setFontWeight("bold").setBackground(NAVY).setFontColor("#ffffff");
  var src = [["Marketed (Inbound + Webform)", mL, mI], ["Tech Flip", tL, tI], ["Self Gen", sgL, sgI], ["Total", Leads, Inst]];
  var sBody = src.map(function (s) {
    return [s[0], s[1], s[2], div(s[2], s[1])];
  }
  );
  lc.getRange(h + 2, 1, sBody.length, 4).setValues(sBody);
  lc.getRange(h + 2, 4, sBody.length, 1).setNumberFormat(pctF);
  lc.getRange(h + 1 + sBody.length, 1, 1, 4).setFontWeight("bold").setBackground(AMBER);
  [200, 70, 70, 80, 80, 90, 100].forEach(function (w, i) {
    lc.setColumnWidth(i + 1, w);
  }
  );
  lc.setFrozenRows(4);
  // ============ 2) "daily" scorecard ============
  var sh = null;
  ss.getSheets().forEach(function (s) {
    if (String(s.getName()).toLowerCase().trim() === "daily") sh = s;
  }
  );
  if (!sh) sh = ss.insertSheet("daily");
  sh.clear();
  /* Day column = that day's ACTIVITY (counts & $). Conversion rates are MTD only — a single day's installs come from earlier leads, so a day-level L2C isn't a real rate. Blank day cells ("") are simply not written. */
  /* Fix 5 — L2C split date window. The headline MTD L2C now uses bi.installs
     (from the same BI export as bi.leads) so numerator and denominator cover
     the same date range. Per-source L2C likewise uses bi.instMkt etc.
     The day column and L2C tab per-day rows still use the Daily Data counts
     (Inst, mI, tI) which are internally consistent day-by-day. */
  var biInst = bi.installs || Inst;  // graceful fallback if config not yet populated
  /* Fix 6: rentals are $0 deferred revenue, excluded from the avg-ticket denominator. */
  var rentalInst = bi.rentalInstalls || 0;
  var cashInst = Inst - rentalInst;
  var rows = [ ["Total Leads", dLeads, bi.leads, "", numF], ["Total Sold", soldDayVal, soldMtdVal, "15%", numF], ["HVAC Sold $ (live)", sold$DayVal, sold$MtdVal, "", moneyF], ["Total Installs", dInst, biInst, "", numF], ["Total L2C %", "", div(biInst, bi.leads), "", pctF], ["Marketed L2C %", "", div(bi.instMkt || mI, bi.mkt), "50%", pctF], ["HVAC Tech Flip Leads", d[2], bi.tech, 50, numF], ["HVAC Tech Flip Deals", d[5], bi.instTech || tI, 28, numF], ["HVAC Tech Flip L2C %", "", div(bi.instTech || tI, bi.tech), "55%", pctF], ["NPS Sales Overall", "", "", 85, numF], ["HVAC Rev (installed)", d[8], dollars, "$1.62M", moneyF], ["HVAC AVG Ticket", div(d[8], dInst), div(dollars, cashInst), "$9.0K", moneyF], ["Self Gen", d[3], bi.sg, "", numF], ["Rentals (deferred rev)", "", rentalInst, "", numF] ];
  sh.getRange(1, 2).setValue("CM Sales Growth");
  sh.getRange(1, 4).setValue("Daily");
  sh.getRange(2, 2).setValue("Sales Manager");
  sh.getRange(2, 4).setValue("CM");
  sh.getRange(3, 2).setValue("MTD").setFontStyle("italic");
  sh.getRange(3, 3).setValue(d[0]);
  sh.getRange(3, 4).setValue("MTD");
  sh.getRange(3, 5).setValue("FM Budget");
  sh.getRange(1, 2, 2, 3).setBackground(GOLD).setFontWeight("bold");
  sh.getRange(3, 2, 1, 4).setFontWeight("bold");
  sh.getRange(3, 3).setBackground(BLUE);
  sh.getRange(3, 4).setBackground(GOLD);
  sh.getRange(3, 5).setBackground(GRAY);
  rows.forEach(function (row, i) {
    var r = 4 + i;
    sh.getRange(r, 2).setValue(row[0]).setFontWeight("bold");
    if (row[1] !== "") sh.getRange(r, 3).setValue(row[1]);
    if (row[2] !== "") sh.getRange(r, 4).setValue(row[2]);
    sh.getRange(r, 5).setValue(row[3]);
    sh.getRange(r, 3, 1, 2).setNumberFormat(row[4]);
    /* Budget/target cell: force a plain number format for numeric targets so a leftover percent format can't turn 28 into "2800%". String targets like "15%" / "$1.62M" are left alone (their format is irrelevant as text). */
    if (typeof row[3] === "number") sh.getRange(r, 5).setNumberFormat("#,##0");
    sh.getRange(r, 3).setBackground(BLUE);
    sh.getRange(r, 4).setBackground(GOLD);
    sh.getRange(r, 5).setBackground(GRAY);
  }
  );
  var base = 4 + rows.length;
  sh.getRange(base, 2).setValue("Notes: Daily growth Activities").setFontWeight("bold");
  /* Live "today so far" line — the part that moves hourly. */
  if (live && !todayIsBIday) {
    sh.getRange(base + 1, 2).setValue("LIVE — today (" + todayLabel + ") so far: " + todayN + " sold · $" + Math.round(today$).toLocaleString() + " (not yet in the BI columns above)") .setFontColor("#0a7d33").setFontWeight("bold");
  }
  else if (live) {
    sh.getRange(base + 1, 2).setValue("LIVE — sold side refreshes hourly from ServiceTitan.") .setFontColor("#0a7d33").setFontWeight("bold");
  }
  sh.getRange(base + 2, 2).setValue("Day column = consults that RAN that day (board) + sold/$. MTD L2C = Installs / BI leads (" + Inst + " / " + bi.leads + ") - the BI figure Paul sees. Day leads are consults-ran; MTD leads are BI (received). Sold count/$ are LIVE (ServiceTitan, pre-tax), ahead of Installs; HVAC Rev = installed (BI).").setFontColor(MUT).setFontStyle("italic");
  var stamp = Utilities.formatDate(new Date(), tz, "EEE M/d h:mm a");
  var corrNote = (typeof growthCorrectionNote_ === "function") ? growthCorrectionNote_() : "";
  if (corrNote) sh.getRange(base + 4, 2).setValue(corrNote).setFontColor(MUT).setFontStyle("italic");
  sh.getRange(base + 3, 2).setValue("Updated " + stamp + (live ? "" : " · sold engine unreadable, showing BI fallback") + (eng && eng.complete === false ? " · PARTIAL Gmail read" : "")).setFontColor(MUT);
  [30, 210, 110, 110, 110].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  }
  );
  sh.setFrozenRows(3);
  /* No setActiveSheet — an hourly trigger shouldn't yank whatever tab you're on. */
  Logger.log('Built "L2C" + "daily" (hybrid) - MTD L2C ' + (bi.leads ? Math.round(Inst * 1000 / bi.leads) / 10 : 0) + '% (' + Inst + '/' + bi.leads + ') Sold ' + (live ? "LIVE " : "BI ") + soldMtdVal + ' [per-day ' + soldSourceNote + ']' + ' $' + Math.round(live ? sold$MtdVal : dollars) + (live && !todayIsBIday ? ' today ' + todayN + '/$' + Math.round(today$) : '') + '.');
  return ss.getUrl();
}
function matchRosterName_(formName) {
  var target = normName_(formName);
  if (!target) return "";
  for (var i = 0;
  i < RECAP_ROSTER.length;
  i++) {
    if (normName_(RECAP_ROSTER[i].name) === target) return RECAP_ROSTER[i].name;
  }
  for (var j = 0;
  j < RECAP_ROSTER.length;
  j++) {
    var r = RECAP_ROSTER[j];
    var first = normName_(r.first || "");
    var parts = normName_(r.name).split(" ");
    var last = parts[parts.length - 1];
    if (first && (target === first || target.indexOf(first) !== -1)) return r.name;
    if (last && target.indexOf(last) !== -1) return r.name;
  }
  return "";
}
function oneOnOneMirrorProtected_() {
  return {
    "Form Responses 1": true, "Form Responses": true,
    "Activity Log": true, "Recap Log": true, "Reply Compliance": true,
    "Today": true, "Summary": true, "Job Status": true,
    "Signed": true, "Rentals": true, "Exceptions": true, "Sheet1": true
  };
}
function isOneOnOneMirrorTab_(sheet) {
  var name = String(sheet.getName() || "");
  if (oneOnOneMirrorProtected_()[name]) return false;
  if (/form\s*responses/i.test(name)) return false;
  // never a form tab
  var nameHit = /^\s*1on1\s*[—–-]\s*\S/.test(name);
  if (!nameHit) return false;
  var a1 = "";
  try {
    a1 = String(sheet.getRange("A1").getValue() || "").trim();
  }
  catch (e) {
    a1 = "";
  }
  var a1Hit = /[—–-]\s*1:1\s*$/.test(a1);
  return nameHit && a1Hit;
}
function previewOneOnOneMirrorCleanup() {
  var ss = getLogSpreadsheet_().ss;
  var sheets = ss.getSheets();
  var toRemove = [], toKeep = [];
  for (var i = 0;
  i < sheets.length;
  i++) {
    var sh = sheets[i];
    if (isOneOnOneMirrorTab_(sh)) toRemove.push(sh.getName());
    else toKeep.push(sh.getName());
  }
  var msg = "PREVIEW — nothing deleted.\n\n" +
    "WOULD DELETE (" + toRemove.length + "):\n" +
    (toRemove.length ? "  • " + toRemove.join("\n  • ") : "  (none — already clean)") +
    "\n\nKEEPING (" + toKeep.length + "):\n  • " + toKeep.join("\n  • ") +
    "\n\nIf that looks right, run removeOneOnOneMirrorTabs.";
  Logger.log(msg);
  return msg;
}
function removeOneOnOneMirrorTabs() {
  var ss = getLogSpreadsheet_().ss;
  var sheets = ss.getSheets();
  // snapshot before we start deleting
  var removed = [], failed = [], kept = [];
  for (var i = 0;
  i < sheets.length;
  i++) {
    var sh = sheets[i];
    if (!isOneOnOneMirrorTab_(sh)) {
      kept.push(sh.getName());
      continue;
    }
    if (ss.getSheets().length <= 1) {
      kept.push(sh.getName());
      continue;
    }
    // can't delete last tab
    var nm = sh.getName();
    try {
      ss.deleteSheet(sh);
      removed.push(nm);
    }
    catch (err) {
      failed.push(nm + " (" + (err && err.message ? err.message : err) + ")");
    }
  }
  var msg = "Removed " + removed.length + " per-rep 1:1 mirror tab(s)." +
    (removed.length ? "\n  Deleted: " + removed.join(", ") : "") +
    (failed.length ? "\n  Could not delete: " + failed.join("; ") : "") +
    "\n  Kept " + kept.length + " tab(s).";
  Logger.log(msg);
  return msg;
}
function buildOneOnOneTabs() {
  Logger.log("buildOneOnOneTabs() is disabled — per-rep mirror tabs are turned off on purpose.");
  return [];
}
function previewActivityDedupe() {
  return dedupeActivityLog_(true);
}
function dedupeActivityLog() {
  return dedupeActivityLog_(false);
}
function previewFormImportNow() {
  return importRecapFormResponses_(true);
  // preview only — nothing is written
}
function commitFormImportNow() {
  return importRecapFormResponses_(false);
  // commits to Recap Log + Activity Log
}
function refresh1on1Now() {
  var dd = "";
  try {
    dd = dedupeActivityLog_(false);
  }
  catch (e) {
    dd = "de-dupe skipped: " + (e && e.message ? e.message : e);
  }
  var imp = "";
  try {
    imp = importRecapFormResponses_(false);
  }
  catch (e) {
    imp = "import skipped: " + (e && e.message ? e.message : e);
  }
  var built = build1on1Tabs();
  var msg = dd + "\n" + imp + "\nBuilt 1:1 tabs for: " + (built.join(", ") || "(no rep activity in window)");
  Logger.log(msg);
  return msg;
}
function previewBIImport() {
  return importBI_(true);
}
function importBILeadsInstalls() {
  return importBI_(false);
}
function dateKey_(v, tz) {
  if (v === null || v === "") return null;
  if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz, "EEE M/d");
  var m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Utilities.formatDate(new Date(+m[1], +m[2] - 1, +m[3]), tz, "EEE M/d");
}
function l2cLabel_(v, tz) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, tz, "EEE M/d");
  return String(v || "").trim();
}
function writeGrowthDays(previewOnly) {
  var msg = "writeGrowthDays is RETIRED — Growth sheet redesigned (L2C / " +
    "Same-Day Sold / Daily). Old weekday-block layout is gone. Nothing written.";
  Logger.log(msg);
  return msg;
}
function previewWriteGrowthDays() {
  return writeGrowthDays(true);
}
function writeGrowthSheetForYesterday() {
  var msg = "writeGrowthSheetForYesterday is RETIRED — targets the old weekday " +
    "layout the Growth sheet no longer has. No write, no receipt email.";
  Logger.log(msg);
  return {
    ok: true, retired: true, written: 0, blocked: 0
  };
}
function previewTitanRan() {
  return titanRan_(true);
}
function writeTitanRanEstimate() {
  return titanRan_(false);
}
function titanRan_(preview) {
  var ss = SpreadsheetApp.openById("1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww");
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var y = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var yM = Number(Utilities.formatDate(y, tz, "M"));
  var yD = Number(Utilities.formatDate(y, tz, "d"));
  var yLbl = Utilities.formatDate(y, tz, "EEE M/d");
  // Pull yesterday's HVAC-Sales completed-form alerts = installs that ran.
  var threads = GmailApp.search('from:alerts@servicetitan.com subject:"Completed Form Alert [HVAC Sales]" newer_than:3d');
  var hits = [];
  var reDate = /(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{2}\s*(AM|PM)/i;
  for (var t = 0;
  t < threads.length;
  t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0;
    m < msgs.length;
    m++) {
      var subj = msgs[m].getSubject() || "";
      if (subj.indexOf("[HVAC Sales]") < 0) continue;
      // safety: installs only
      var body = msgs[m].getPlainBody() || "";
      var mm = body.match(reDate);
      if (!mm) continue;
      if (Number(mm[1]) === yM && Number(mm[2]) === yD) {
        var after = body.slice(mm.index + mm[0].length).replace(/^\s+/, "");
        var name = (after.split(/\s{2,}|\n|,/)[0] || "").trim().slice(0, 40);
        hits.push(name || ("msg " + msgs[m].getId()));
      }
    }
  }
  var count = hits.length;
  // Find the Total Installs row on Daily; write into the day column (C).
  var daily = ss.getSheetByName("Daily");
  if (!daily) throw new Error("No Daily tab found.");
  var dv = daily.getRange(1, 1, daily.getLastRow(), 2).getValues();
  var rInst = -1;
  for (var r = 0;
  r < dv.length;
  r++) {
    if (String(dv[r][1] || "").trim().toLowerCase().indexOf("total installs") === 0) {
      rInst = r + 1;
      break;
    }
  }
  if (rInst < 0) throw new Error('Couldn\'t find the "Total Installs" row on Daily.');
  var stamp = Utilities.formatDate(new Date(), tz, "EEE M/d h:mm a");
  var noteTxt = "Live ServiceTitan estimate: " + count + " HVAC-Sales completed-form alerts for " + yLbl +
    ". NOT the reconciled BI count - replace on Monday's BI upload. As of " + stamp + ".";
  if (preview) {
    var pm = "PREVIEW (nothing written).  " + yLbl + " installs that ran (ServiceTitan email): " + count +
      "\n  " + (hits.join(", ") || "(none)") +
      "\n  Would write " + count + " into Daily!C" + rInst + " (Total Installs, day col) with an estimate note.";
    Logger.log(pm);
    return pm;
  }
  var cell = daily.getRange("C" + rInst);
  cell.setValue(count).setNote(noteTxt);
  SpreadsheetApp.flush();
  var msg = "Wrote " + count + " into Total Installs (day col, " + yLbl + ") as a LIVE ServiceTitan estimate. " +
    "Names: " + (hits.join(", ") || "(none)") + ". Replace with BI on Monday. Cell note stamped " + stamp + ".";
  Logger.log(msg);
  return msg;
}
var DAILY_SHEET_ID = "1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww";
var BI_DAY_LABELS = [ "total leads", "total installs", "hvac tech flip leads", "hvac tech flip deals", "hvac rev", "self gen" ];
var BI_DAY_NOTE = "Fills from your BI upload (MTD col D + the L2C tab). Not sourced from live " + "ServiceTitan email: Booked Job Alerts are bookings, not \"ran\" -- reschedules " + "keep the old date and revisits/COD aren't new leads -- so a day count from " + "email would be wrong. Updates on Monday's BI.";
var PIPE_SHEET_ID = "1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww";
var PIPE_TAB = "Backlog Pipeline";
var PIPE_MARKER = "Awaiting Install — BI Backlog & Pipeline";
function previewBIPipeline() {
  return bipipe_(true);
}
function importBIPipeline() {
  return bipipe_(false);
}
/* ============================================================================
 * STAGE 2a — the BI MTD constants move out of source code.
 *
 * Stage 1 moved the day rows onto a tab because a script cannot append to its
 * own source. The four BI_MTD_* constants have exactly the same problem: the
 * Drive advisor can compute them but could only ever PRINT them for a human to
 * paste back into the editor. On a tab, a script can write them.
 *
 * Same safety shape as stage 1: growthBiMtd_() prefers the tab and falls back
 * to the constants below whenever the tab is missing, empty or unreadable. So
 * pasting this changes nothing until setupGrowthConfigSheet() is run once, and
 * deleting the tab reverts to the constants.
 * ========================================================================== */

var GROWTH_CONFIG_TAB = "Growth Config";
var GROWTH_CONFIG_HEADER = ["Key", "Value", "Updated", "Note"];
var GROWTH_CONFIG_KEYS = [
  ["BI_MTD_LEADS",      "Total leads RECEIVED month-to-date (BI). Denominator of MTD L2C."],
  ["BI_MTD_MKT_LEADS",  "Marketed = Inbound + Webform."],
  ["BI_MTD_TECH_LEADS", "Tech flip leads."],
  ["BI_MTD_SG_LEADS",   "Self-generated leads."],
  ["BI_MTD_INSTALLS",      "Total installs month-to-date (BI). Numerator of MTD L2C."],
  ["BI_MTD_MKT_INSTALLS",  "Marketed installs."],
  ["BI_MTD_TECH_INSTALLS", "Tech flip installs."],
  ["BI_MTD_SG_INSTALLS",   "Self-generated installs."],
  ["BI_MTD_RENTAL_INSTALLS", "Rental installs MTD (job.type contains 'Rental'). Excluded from avg ticket."],
  ["BI_MONTH_START",    "Business-month start (yyyy-mm-dd). Used to detect month rollover."],
  ["BI_THROUGH_ISO",    "Last date the exports actually cover (yyyy-mm-dd)."]
];
var GROWTH_BI_CACHE_ = null;

/* The four MTD lead figures, tab first and the constants as the fallback.
   Returns numbers plus `source` so callers can say where they came from. */
function growthBiMtd_OLD_20260828(ss) {
  if (GROWTH_BI_CACHE_) return GROWTH_BI_CACHE_;

  var fb = {
    leads: (typeof BI_MTD_LEADS === "number") ? BI_MTD_LEADS : 0,
    mkt:   (typeof BI_MTD_MKT_LEADS === "number") ? BI_MTD_MKT_LEADS : 0,
    tech:  (typeof BI_MTD_TECH_LEADS === "number") ? BI_MTD_TECH_LEADS : 0,
    sg:    (typeof BI_MTD_SG_LEADS === "number") ? BI_MTD_SG_LEADS : 0,
    throughIso: "", source: "code constants"
  };

  var sh = null;
  try {
    sh = (ss || SpreadsheetApp.openById(GROWTH_SHEET_ID)).getSheetByName(GROWTH_CONFIG_TAB);
  } catch (e) { sh = null; }
  if (!sh || sh.getLastRow() < 2) { GROWTH_BI_CACHE_ = fb; return fb; }

  var map = {};
  try {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0] || "").trim();
      if (k) map[k] = r[1];
    });
  } catch (e) {
    Logger.log("Growth Config unreadable (" + e + "); using the code constants.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }

  /* A key that is PRESENT but unparseable means someone typed into the tab.
     That is a corrupted config, not a missing one, so it rejects the whole tab
     rather than silently mixing a hand-edited value with the code constants. */
  var bad = [];
  function num(key, fallbackVal) {
    if (!(key in map) || map[key] === "" || map[key] === null) return fallbackVal;
    var n = Number(map[key]);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { bad.push(key + "=" + map[key]); return fallbackVal; }
    return n;
  }
  /* A zero total-leads reading would silently blank every L2C percentage, so
     it is treated as an unset tab rather than a real zero. */
  var leads = num("BI_MTD_LEADS", fb.leads);
  if (!leads) { GROWTH_BI_CACHE_ = fb; return fb; }

  var out = {
    leads: leads,
    mkt:   num("BI_MTD_MKT_LEADS", fb.mkt),
    tech:  num("BI_MTD_TECH_LEADS", fb.tech),
    sg:    num("BI_MTD_SG_LEADS", fb.sg),
    throughIso: String(map["BI_THROUGH_ISO"] || "").slice(0, 10),
    source: "'" + GROWTH_CONFIG_TAB + "' tab"
  };
  if (bad.length) {
    Logger.log("Growth Config has non-numeric value(s): " + bad.join(", ") +
      ". Falling back to the code constants.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }
  /* The parts must equal the whole. If they do not, the tab was hand-edited
     into an inconsistent state and the constants are the safer read. */
  if (out.mkt + out.tech + out.sg !== out.leads) {
    Logger.log("Growth Config: " + out.mkt + "+" + out.tech + "+" + out.sg + " != " + out.leads +
      " — the source split does not sum to total leads. Falling back to the code constants.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }
  GROWTH_BI_CACHE_ = out;
  return out;
}

/* Run ONCE to migrate. Idempotent — an existing tab with values is left alone. */
function setupGrowthConfigSheet() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = ss.getSheetByName(GROWTH_CONFIG_TAB);
  var created = false;
  if (!sh) { sh = ss.insertSheet(GROWTH_CONFIG_TAB); created = true; }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, GROWTH_CONFIG_HEADER.length)
      .setValues([GROWTH_CONFIG_HEADER]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() > 1) {
    var msg = GROWTH_CONFIG_TAB + " already holds " + (sh.getLastRow() - 1) +
      " row(s) — left untouched. Nothing migrated.";
    Logger.log(msg); return msg;
  }

  var seed = {
    BI_MTD_LEADS:      (typeof BI_MTD_LEADS === "number") ? BI_MTD_LEADS : 0,
    BI_MTD_MKT_LEADS:  (typeof BI_MTD_MKT_LEADS === "number") ? BI_MTD_MKT_LEADS : 0,
    BI_MTD_TECH_LEADS: (typeof BI_MTD_TECH_LEADS === "number") ? BI_MTD_TECH_LEADS : 0,
    BI_MTD_SG_LEADS:   (typeof BI_MTD_SG_LEADS === "number") ? BI_MTD_SG_LEADS : 0,
    BI_MTD_INSTALLS:      0,
    BI_MTD_MKT_INSTALLS:  0,
    BI_MTD_TECH_INSTALLS: 0,
    BI_MTD_SG_INSTALLS:   0,
    BI_MONTH_START:       "",
    BI_THROUGH_ISO:    ""
  };
  var stamp = Utilities.formatDate(new Date(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd HH:mm");
  var rows = GROWTH_CONFIG_KEYS.map(function (kv) {
    return [kv[0], seed[kv[0]], stamp, kv[1]];
  });
  sh.getRange(2, 1, rows.length, GROWTH_CONFIG_HEADER.length).setValues(rows);
  [190, 90, 140, 470].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var out = "Migrated " + rows.length + " config key(s) into '" + GROWTH_CONFIG_TAB + "'" +
    (created ? " (tab created)" : "") + ". Seeded from the code constants: leads " +
    seed.BI_MTD_LEADS + " (mkt " + seed.BI_MTD_MKT_LEADS + ", tech " + seed.BI_MTD_TECH_LEADS +
    ", sg " + seed.BI_MTD_SG_LEADS + "). The constants stay as a fallback — delete the tab to revert.";
  Logger.log(out);
  return out;
}

/* Writes the BI figures back to the tab. Returns false if the tab is absent,
   so callers can tell "not migrated yet" from "written". */
function growthWriteBiMtd_(ss, vals, throughIso) {
  var sh = ss.getSheetByName(GROWTH_CONFIG_TAB);
  if (!sh || sh.getLastRow() < 2) return false;
  var stamp = Utilities.formatDate(new Date(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd HH:mm");
  var grid = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  var want = {
    BI_MTD_LEADS: vals.leads, BI_MTD_MKT_LEADS: vals.mkt,
    BI_MTD_TECH_LEADS: vals.tech, BI_MTD_SG_LEADS: vals.sg,
    BI_MTD_INSTALLS: vals.installs, BI_MTD_MKT_INSTALLS: vals.instMkt,
    BI_MTD_TECH_INSTALLS: vals.instTech, BI_MTD_SG_INSTALLS: vals.instSg,
    BI_MTD_RENTAL_INSTALLS: vals.rentalInstalls || 0,  // Fix 6: rental installs for avg-ticket exclusion
    BI_MONTH_START: vals.monthStart || "",
    BI_THROUGH_ISO: throughIso || ""
  };
  var wrote = 0;
  var found = {};
  grid.forEach(function (r, i) {
    var k = String(r[0] || "").trim();
    if (!(k in want)) return;
    found[k] = true;
    if (String(r[1]) === String(want[k])) return;
    sh.getRange(i + 2, 2).setValue(want[k]);
    sh.getRange(i + 2, 3).setValue(stamp);
    wrote++;
  });
  /* Append any new keys that do not yet have a row on the tab.
     This lets the install keys auto-provision on the first run after
     Fix 5 is deployed, without needing to re-run setupGrowthConfigSheet. */
  var descMap = {};
  GROWTH_CONFIG_KEYS.forEach(function (kv) { descMap[kv[0]] = kv[1]; });
  Object.keys(want).forEach(function (k) {
    if (found[k]) return;
    var nextRow = sh.getLastRow() + 1;
    sh.getRange(nextRow, 1, 1, 4).setValues([[k, want[k], stamp, descMap[k] || ""]]);
    wrote++;
  });
  GROWTH_BI_CACHE_ = null;
  return wrote;
}

/* ============================================================================
 * STAGE 1 — the day rows move out of source code and into a sheet tab.
 *
 * L2C_DAYS below is a hardcoded array, which is why the Daily tab goes stale:
 * a script cannot append to its own source, so advancing a day has always meant
 * a human editing code. Once the rows live on a tab, adding a day is a sheet
 * append — which a script CAN do, and which stage 2 automates.
 *
 * MIGRATION IS SAFE AND REVERSIBLE. readGrowthDays_() prefers the tab and falls
 * back to the L2C_DAYS array whenever the tab is missing, empty, or unreadable.
 * So pasting this changes nothing until setupGrowthDailyDataSheet() is run once,
 * and deleting the tab reverts to the array.
 * ========================================================================== */

var GROWTH_DAILY_DATA_TAB = "Daily Data";
var GROWTH_DAILY_DATA_HEADER = ["Label", "Mkt Leads", "Tech Leads", "SG Leads",
  "Mkt Inst", "Tech Inst", "SG Inst", "Sold", "Installed $"];

/* Memoized for the life of one execution. buildL2CTab reads the days twice and
   there is no reason to hit the sheet twice for it. Apps Script globals do not
   survive between executions, so this can never serve a stale day. */
var GROWTH_DAYS_CACHE_ = null;

function growthDaysSheet_(ss) {
  try {
    return (ss || SpreadsheetApp.openById(GROWTH_SHEET_ID))
      .getSheetByName(GROWTH_DAILY_DATA_TAB);
  } catch (e) { return null; }
}

/* ===== KNOWN SOURCE MIS-TAGS ==============================================
 * ServiceTitan derives Lead Type from the CAMPAIGN on the job, so a job that
 * was self-generated but opened as a tech diagnostic carries "Tech Lead" and
 * nothing downstream can tell the difference. There IS a "Self Gen" campaign
 * (Trainor job 405445353 uses it) — these rows just did not get moved onto it.
 * This table restates the correct split until the source is fixed.
 *
 * An entry declares the ABSOLUTE split for one metric on one day, never a
 * delta. So applying it twice equals applying it once, and it turns into a
 * self-announcing no-op the moment the export is fixed and the day row is
 * re-derived to agree with it.
 *
 * HARD RULE: an entry may only REDISTRIBUTE a day's total, never change it.
 * If the stored row's total for that metric stops matching the override's
 * total, the day moved underneath the override and the override is stale — it
 * is skipped and logged rather than applied. That is what keeps install count,
 * revenue and avg ticket tied to BI no matter what ends up in this table.
 *
 * Corrections touch the SOURCE SPLIT only. Lead-source counts that BI reports
 * MTD (BI_MTD_TECH_LEADS, BI_MTD_SG_LEADS) are a leads-RECEIVED measure and
 * are not touched here — a job whose lead arrived in a prior month has no row
 * in this month's lead columns to correct.
 * ========================================================================= */
var GROWTH_SOURCE_CORRECTIONS = [
  {
    label: "Mon 8/24",
    metric: "inst",
    set: { mkt: 3, tech: 1, sg: 0 },
    customer: "Meltem Winn",
    hca: "Chester Granard",
    jobNumber: "411193716",
    loggedIso: "2026-08-25",
    reason: "Tech flip from Emmanuel Maldonado. The 8/23 sales-quote job 411084030 " +
      "was moved to campaign 391790726 'Tech Lead - Same Day', but the INSTALL job " +
      "411193716 still carries campaign 151970127 '*Unsold Estimates | Install V2', " +
      "which BI reads as Inbound. Fix at source by moving install job 411193716 to a " +
      "Tech Lead campaign, then delete this entry."
  }
]

/* Column offsets into a day row for each metric: [mkt, tech, sg]. */
var GROWTH_CORRECTION_COLS_ = { lead: [1, 2, 3], inst: [4, 5, 6] };

/* Filled in by applyGrowthSourceCorrections_ so the Daily tab can footnote
   exactly why its source split differs from the raw BI export. */
var GROWTH_CORRECTIONS_APPLIED_ = [];

function applyGrowthSourceCorrections_(days) {
  GROWTH_CORRECTIONS_APPLIED_ = [];
  var list = (typeof GROWTH_SOURCE_CORRECTIONS !== "undefined" && GROWTH_SOURCE_CORRECTIONS) || [];
  if (!days || !days.length || !list.length) return days;

  /* Clone. On the fallback path `days` IS the L2C_DAYS array, and correcting
     it in place would rewrite the literal for the rest of the execution. */
  var out = days.map(function (r) { return r.slice(); });
  var byLabel = {};
  out.forEach(function (r, i) { byLabel[String(r[0]).trim()] = i; });

  list.forEach(function (c) {
    var i = byLabel[String((c && c.label) || "").trim()];
    if (i == null) {
      Logger.log("Source correction skipped — no day row labelled '" + (c && c.label) + "'.");
      return;
    }
    var cols = GROWTH_CORRECTION_COLS_[c.metric];
    if (!cols) {
      Logger.log("Source correction on " + c.label + " skipped — unknown metric '" + c.metric + "'.");
      return;
    }
    var want = [Number(c.set.mkt), Number(c.set.tech), Number(c.set.sg)];
    if (want.some(function (n) { return !isFinite(n) || n < 0; })) {
      Logger.log("Source correction on " + c.label + " skipped — set{} is not three non-negative numbers.");
      return;
    }

    var row = out[i];
    var have = cols.map(function (k) { return Number(row[k]) || 0; });
    var sumHave = have[0] + have[1] + have[2], sumWant = want[0] + want[1] + want[2];

    if (sumHave !== sumWant) {
      Logger.log("STALE source correction on " + c.label + " (" + c.metric + "): the stored row totals " +
        sumHave + " but the override totals " + sumWant + ". SKIPPED — that day changed since the " +
        "override was written, so re-derive it from the current export.");
      return;
    }
    if (have[0] === want[0] && have[1] === want[1] && have[2] === want[2]) {
      Logger.log("Source correction on " + c.label + " (" + c.metric + ") already matches the stored row — " +
        "the source has been fixed, so delete this entry from GROWTH_SOURCE_CORRECTIONS.");
      return;
    }

    cols.forEach(function (k, n) { row[k] = want[n]; });
    GROWTH_CORRECTIONS_APPLIED_.push({
      label: c.label, metric: c.metric, from: have, to: want,
      customer: c.customer || "", hca: c.hca || ""
    });
    Logger.log("Applied source correction " + c.label + " " + c.metric + " mkt/tech/sg " +
      have.join("/") + " -> " + want.join("/") + (c.customer ? " (" + c.customer + ")" : "") + ".");
  });
  return out;
}

/* One-line summary of what actually got moved, for the Daily tab footnote. */
function growthCorrectionNote_() {
  if (!GROWTH_CORRECTIONS_APPLIED_.length) return "";
  return "Source split adjusted: " + GROWTH_CORRECTIONS_APPLIED_.map(function (a) {
    var kind = a.metric === "inst" ? "installs" : "leads";
    return a.label + " " + kind + " tech " + a.from[1] + "->" + a.to[1] +
      ", self gen " + a.from[2] + "->" + a.to[2] +
      (a.customer ? " (" + a.customer + (a.hca ? ", " + a.hca : "") + ")" : "");
  }).join("; ") + ". Totals are unchanged and still tie to BI; only the source " +
    "columns differ, because ServiceTitan tags source from the job's campaign.";
}

/* The day rows, tab first and array as the fallback. Shape is identical to
   L2C_DAYS: [label, mktLeads, techLeads, sgLeads, mktInst, techInst, sgInst,
   sold, dollars]. The label must keep its "Fri 8/14" form — the BI-thru date on
   the Daily tab is parsed out of the LAST label, so a reformatted label breaks
   the staleness indicator. */
function readGrowthDaysRaw_OLD_20260818(ss) {
  var fallback = (typeof L2C_DAYS !== "undefined" && L2C_DAYS) ? L2C_DAYS : [];
  var sh = growthDaysSheet_(ss);
  if (!sh) return fallback;

  var rows;
  try {
    var last = sh.getLastRow();
    if (last < 2) return fallback;
    rows = sh.getRange(2, 1, last - 1, GROWTH_DAILY_DATA_HEADER.length).getValues();
  } catch (e) {
    Logger.log("Daily Data tab unreadable (" + e + "); using the L2C_DAYS array.");
    return fallback;
  }

  var out = [], skipped = 0;
  rows.forEach(function (r) {
    var label = String(r[0] == null ? "" : r[0]).trim();
    /* A label with no M/D in it cannot drive the BI-thru date, so it is not a
       day row — blank rows and stray notes land here and are skipped, not
       guessed at. */
    if (!label || !/\d{1,2}\/\d{1,2}/.test(label)) { if (label) skipped++; return; }
    var nums = [];
    for (var i = 1; i <= 8; i++) {
      var n = Number(r[i]);
      nums.push(isFinite(n) ? n : 0);
    }
    out.push([label].concat(nums));
  });

  if (!out.length) return fallback;
  if (skipped) Logger.log("Daily Data: skipped " + skipped + " row(s) with no M/D in the label.");
  return out;
}

/* Public reader: raw rows, corrected, memoized for the life of one execution. */
function readGrowthDays_(ss) {
  if (GROWTH_DAYS_CACHE_) return GROWTH_DAYS_CACHE_;
  GROWTH_DAYS_CACHE_ = applyGrowthSourceCorrections_(readGrowthDaysRaw_(ss));
  return GROWTH_DAYS_CACHE_;
}

/* Run ONCE to migrate. Creates the tab and seeds it from the current L2C_DAYS
   array. Idempotent: if the tab already holds day rows it leaves them alone and
   reports, so a second run cannot duplicate or clobber anything. */
function setupGrowthDailyDataSheet() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = ss.getSheetByName(GROWTH_DAILY_DATA_TAB);
  var created = false;
  if (!sh) { sh = ss.insertSheet(GROWTH_DAILY_DATA_TAB); created = true; }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, GROWTH_DAILY_DATA_HEADER.length)
      .setValues([GROWTH_DAILY_DATA_HEADER]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  var existing = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
        .filter(function (r) { return String(r[0] || "").trim(); }).length
    : 0;
  if (existing) {
    var msg = GROWTH_DAILY_DATA_TAB + " already holds " + existing +
      " row(s) — left untouched. Nothing migrated.";
    Logger.log(msg); return msg;
  }

  /* Seed from the RAW array on purpose. The tab mirrors what the export says;
     GROWTH_SOURCE_CORRECTIONS stays in code so a mis-tag is never silently
     baked into the data and then forgotten. */
  var src = (typeof L2C_DAYS !== "undefined" && L2C_DAYS) ? L2C_DAYS : [];
  if (!src.length) { var m2 = "L2C_DAYS is empty; nothing to migrate."; Logger.log(m2); return m2; }
  sh.getRange(2, 1, src.length, GROWTH_DAILY_DATA_HEADER.length).setValues(src);
  sh.getRange(2, 9, src.length, 1).setNumberFormat("$#,##0");
  [110, 80, 80, 70, 75, 75, 65, 60, 95].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var out = "Migrated " + src.length + " row(s) from the L2C_DAYS array into '" +
    GROWTH_DAILY_DATA_TAB + "'" + (created ? " (tab created)" : "") +
    ". readGrowthDays_ will now prefer the tab. The array stays as a fallback — " +
    "delete the tab to revert. Last row: " + src[src.length - 1][0] + ".";
  Logger.log(out);
  return out;
}

/* Read-only: shows which source is live and what the last day is. */
function previewGrowthDays() {
  var sh = growthDaysSheet_();
  var days = readGrowthDays_();
  var usingTab = !!(sh && sh.getLastRow() > 1);
  var lines = ["GROWTH DAY ROWS",
    "source: " + (usingTab ? ("'" + GROWTH_DAILY_DATA_TAB + "' tab") : "L2C_DAYS array (fallback)"),
    "rows:   " + days.length];
  var mL = 0, tL = 0, sgL = 0, mI = 0, tI = 0, sgI = 0, sold = 0, dollars = 0;
  days.forEach(function (d) {
    mL += d[1]; tL += d[2]; sgL += d[3];
    mI += d[4]; tI += d[5]; sgI += d[6];
    sold += d[7]; dollars += d[8];
  });
  lines.push("last:   " + days[days.length - 1][0]);
  lines.push("leads:  " + (mL + tL + sgL) + "  (mkt " + mL + " tech " + tL + " sg " + sgL + ")");
  lines.push("installs: " + (mI + tI + sgI) + "  (mkt " + mI + " tech " + tI + " sg " + sgI + ")");
  lines.push("sold:   " + sold + "   installed $: " + dollars);
  lines.push("");
  lines.push("Installs and installed $ should match BI exactly. Leads are the");
  lines.push("consults-ran basis and are NOT expected to match BI's lead count.");
  var corr = (typeof GROWTH_SOURCE_CORRECTIONS !== "undefined" && GROWTH_SOURCE_CORRECTIONS) || [];
  if (corr.length) {
    lines.push("");
    lines.push("SOURCE CORRECTIONS declared: " + corr.length + ", applied this run: " +
      GROWTH_CORRECTIONS_APPLIED_.length + " (see the log for any skipped as stale).");
    corr.forEach(function (c) {
      lines.push("  " + c.label + " " + c.metric + " -> mkt " + c.set.mkt + " tech " + c.set.tech +
        " sg " + c.set.sg + "  " + (c.customer || "") + (c.jobNumber ? " job " + c.jobNumber : ""));
      if (c.reason) lines.push("    " + c.reason);
    });
    lines.push("These move counts BETWEEN source columns only — a day's total can");
    lines.push("never change, so the BI tie-out on installs and revenue holds.");
  }
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}

/* ============================================================================
 * L2C_DAYS - FALLBACK DAY ROWS. FROZEN SNAPSHOT, NOT CURRENT.
 *
 * WHAT THIS IS. A hand-built array covering 2026-08-01 through 2026-08-16.
 * Nothing updates it. The live source is the "Daily Data" tab on the growth
 * sheet, read by readGrowthDaysRaw_(). This array is only what that read falls
 * back to, and it pairs with the BI_MTD_* constants below, frozen at the same
 * date.
 *
 * HOW YOU WOULD KNOW IT FIRED. The Daily panel parses its BI-thru date out of
 * the LAST label in whatever it was handed. In this array that label is
 * "Sun 8/16", so a panel showing a through-date of 8/16 in any later month
 * means the tab read failed and this array is being reported as current. That
 * is the only tell. It is read off the parsing code, not observed firing.
 *
 * ROW SHAPE
 *   [label, mktLeads, techLeads, sgLeads, mktInst, techInst, sgInst, sold, $installed]
 *
 * WHAT THE COLUMNS MEAN
 *   Leads (2-4) are consults that RAN that day - lastApptDate in the All Leads
 *   export, status Completed or InProgress. This is NOT the BI created-date
 *   count. They differ because created-date includes leads booked for FUTURE
 *   appointment dates. Do not subtract one from the other and call the
 *   difference a capture gap.
 *   Installs (5-7) and dollars (col 9) are on an install-date basis.
 *   Sold (col 8) is overridden live by the ServiceTitan engine at run time, so
 *   the value stored here matters only if that engine is unavailable.
 *
 * HISTORICAL NOTE, kept because it records how the basis was established: the
 * 8/10 rows were reconciled to the 8/10 dispatch board exactly - 6 ran Monday,
 * Fisher, Kegley and Moengkhom (booked earlier) plus Mathena, Gardner[tech]
 * and Malmgren[tech]. Point-in-time totals that used to sit in this header
 * have been removed - they were true in mid-August and misleading after.
 * ============================================================================ */
var L2C_DAYS = [];

/* ============================================================================
 * BI MONTH-TO-DATE - FALLBACK CONSTANTS. FROZEN SNAPSHOT, NOT CURRENT.
 *
 * WHAT THESE ARE. The four values below are a hand-entered snapshot taken
 * 2026-08-16. Nothing updates them and they do not track BI. The live source
 * is the "Growth Config" tab on the growth sheet, read by growthBiMtd_().
 * These constants are used only when that read does not produce a value.
 *
 * The L2C_DAYS array immediately above is the matching fallback for the day
 * rows and is frozen at the same date - its last row is "Sun 8/16".
 *
 * WHAT THE NUMBERS MEAN. L2C_DAYS counts consults that RAN each day (the
 * dispatch board). BI counts leads RECEIVED. The Daily scorecard MTD column
 * takes its LEAD counts from here so the MTD L2C tile matches BI exactly.
 * The two measures are not interchangeable - do not subtract one from the
 * other and call the difference a capture gap.
 *
 * FIVE BRANCHES RETURN THESE CONSTANTS. Two used to do it in total silence,
 * and the first of those two swallows three separate causes:
 *   1. Tab missing / tab empty / spreadsheet unreachable ... was NO LOG
 *        the catch on openById turned a bad id or revoked access into
 *        "no tab", so all three failures looked identical
 *   2. BI_MTD_LEADS resolving to a literal 0 .............. was NO LOG
 *   3. The range read throws .............................. logs
 *   4. A value in the tab is non-numeric .................. logs
 *   5. mkt + tech + sg does not equal leads ............... logs
 *
 * BRANCH 2 FIRES ONLY ON A LITERAL ZERO. An ABSENT BI_MTD_LEADS key does not
 * come here - num() hands back the code constant, which is truthy. See below.
 *
 * A SIXTH CASE TAKES NONE OF THOSE BRANCHES AND IS WORSE THAN ANY OF THEM.
 * A tab that exists and reads cleanly but holds no BI_MTD rows: num() returns
 * the code constants one at a time, they sum consistently (71 + 29 + 1 = 101)
 * so the parts-equal-whole check in branch 5 passes, and the result is handed
 * back with `source` reporting the tab. Frozen mid-August numbers wearing a
 * label that says they came from the tab. That is a false provenance claim,
 * not a missing log line, and nothing downstream could tell.
 *
 * ALL OF THE ABOVE NOW LOGS, as of 2026-08-28. See growthBiMtd_ at the end of
 * this file; the pre-fix version is parked as growthBiMtd_OLD_20260828. On a
 * healthy tab it still says nothing - it speaks only when something is wrong.
 *
 * BEFORE YOU "UPDATE" THESE. Refreshing them to current figures makes a
 * fallback less wrong but harder to notice, and a stale-but-plausible number
 * is more dangerous than an obviously stale one. That is a judgment call, not
 * a chore. Make it deliberately.
 * ============================================================================ */
var BI_MTD_LEADS = 101;       // BI dashboard Total Leads  (thru 8/16)
var BI_MTD_MKT_LEADS = 71;    // Marketed = Inbound 59 + Webform 12
var BI_MTD_TECH_LEADS = 29;   // Tech
var BI_MTD_SG_LEADS = 1;      // Self Gen
var L2CPLUS_SHEET_ID = "1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww";
var L2CPLUS_PIPE_TAB = "Backlog Pipeline";
var L2CPLUS_MARKER = "Awaiting Install — BI Backlog & Pipeline";
function buildL2CTabPlus() {
  var url = buildL2CTab();
  // untouched -- runs your live version
  try {
    Logger.log("L2C decorations: " + decorateL2C_());
  }
  catch (e) {
    Logger.log("decorateL2C_ skipped (scorecard fine): " + e);
  }
  return url;
}
function activitySig_(dateV, hca, customer, what, objection, next) {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  function nd(v) {
    if (v == null || v === "") return "";
    if (Object.prototype.toString.call(v) === "[object Date]")
      return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd");
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[1] + "-" + m[2] + "-" + m[3]) : s;
  }
  return [nd(dateV), hca, customer, what, objection, next]
    .map(function (x) {
    return String(x == null ? "" : x).trim().toLowerCase();
  })
  .join("§");
}
function addActivityField() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form yet — run buildRecapForm() first.");
    return;
  }
  var form = FormApp.openById(id);
  // Remove any existing activity question (old list OR checkbox), then re-add as checkboxes.
  var stale = form.getItems().filter(function (it) {
    return /additional sales activit/i.test(it.getTitle());
  })
  ;
  stale.forEach(function (it) {
    form.deleteItem(it);
  })
  ;
  var box = form.addCheckboxItem();
  box.setTitle("Additional sales activities")
    .setHelpText("Only if you did NOT run a consult. Check everything you did today.")
    .setChoiceValues(RECAP_ACTIVITIES)
    .setRequired(false);
  form.moveItem(box.getIndex(), 1);
  // right after HCA
  // Optional detail box directly under the checkboxes.
  var det = form.getItems(FormApp.ItemType.PARAGRAPH_TEXT).filter(function (it) {
    return /what did you do/i.test(it.getTitle());
  })
  [0];
  if (!det) {
    var p = form.addParagraphTextItem();
    p.setTitle("What did you do?")
      .setHelpText("Optional — a quick line on the activities you checked above.")
      .setRequired(false);
    form.moveItem(p.getIndex(), 2);
  }
  // Keep the appointment fields optional so a no-consult rep can submit with just HCA + activities.
  form.getItems(FormApp.ItemType.LIST).forEach(function (it) {
    var t = String(it.getTitle() || "");
    if (/^source$/i.test(t) || /water heater presented/i.test(t) || /^outcome$/i.test(t)) it.asListItem().setRequired(false);
  })
  ;
  form.getItems(FormApp.ItemType.TEXT).forEach(function (it) {
    if (/^customer$/i.test(it.getTitle())) it.asTextItem().setRequired(false);
  })
  ;
  Logger.log("Activity field is CHECKBOXES now (tick multiple), with a 'What did you do?' detail box under it. " +
    "Each checked box logs its own Activity Log line, carrying that detail.");
}
function addTotalSoldRow() {
  var from = monthStartIso_(), to = stToday_();
  var data = soldRangeData_(from, to);
  if (!data.ok) {
    Logger.log("Engine read failed — try again.");
    return "";
  }
  var cnt = {
  };
  data.rows.forEach(function (r) {
    cnt[r.iso] = (cnt[r.iso] || 0) + 1;
  })
  ;
  // This week's tab -> which column(s) hold which date
  var plan = {
    "Weekend":   [{
      col: 3, iso: "2026-08-01"
    },
    {
      col: 4, iso: "2026-08-02"
    }
    ],
    "Monday":    [{
      col: 4, iso: "2026-08-03"
    }
    ],
    "Tuesday":   [{
      col: 4, iso: "2026-08-04"
    }
    ],
    "Wednesday": [{
      col: 4, iso: "2026-08-05"
    }
    ],
    "Thursday":  [{
      col: 4, iso: "2026-08-06"
    }
    ],
    "Friday":    [{
      col: 4, iso: "2026-08-07"
    }
    ]
  };
  var order = ["Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var LABEL = "Total HVAC Sold";
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var priorTotalRows = [];
  // {tab,row} of each tab's total-sold row, for the MTD formula
  var out = [];
  order.forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) {
      out.push(tabName + ": no tab");
      return;
    }
    var last = sh.getLastRow();
    var colB = sh.getRange(1, 2, last, 1).getValues();
    var totalRow = 0, avgRow = 0, revRow = 0;
    for (var i = 0;
    i < colB.length;
    i++) {
      var lbl = String(colB[i][0]).trim().toLowerCase();
      if (lbl === LABEL.toLowerCase()) totalRow = i + 1;
      if (lbl === "hvac avg ticket") avgRow = i + 1;
      if (lbl === "hvac rev") revRow = i + 1;
    }
    if (!totalRow) {
      var anchor = avgRow || revRow;
      if (!anchor) {
        out.push(tabName + ": no HVAC Rev/AVG row");
        return;
      }
      sh.insertRowAfter(anchor);
      totalRow = anchor + 1;
      // match the look of the row above, then make the count cells plain integers
      sh.getRange(anchor, 1, 1, 6).copyTo(sh.getRange(totalRow, 1, 1, 6), {
        formatOnly: true
      })
      ;
      sh.getRange(totalRow, 3, 1, 3).setNumberFormat("0");
      sh.getRange(totalRow, 6).clearContent();
      sh.getRange(totalRow, 2).setValue(LABEL).setFontWeight("bold");
    }
    (plan[tabName] || []).forEach(function (p) {
      sh.getRange(totalRow, p.col).setValue(cnt[p.iso] || 0);
    })
    ;
    priorTotalRows.push({
      tab: tabName, row: totalRow
    })
    ;
    var parts = priorTotalRows.map(function (pr) {
      var nm = "'" + pr.tab.replace(/'/g, "''") + "'";
      return nm + "!C" + pr.row + "+" + nm + "!D" + pr.row;
    })
    ;
    sh.getRange(totalRow, 5).setFormula("=" + parts.join("+"));
    out.push(tabName + ": row " + totalRow);
  })
  ;
  SpreadsheetApp.flush();
  var mtd = Object.keys(cnt).reduce(function (s, k) {
    return s + cnt[k];
  },
  0);
  Logger.log("'Total HVAC Sold' added/updated on:\n  " + out.join("\n  ") +
    "\nMTD total sold = " + mtd + " (deduped, all sold this month). Each tab's MTD cell sums the day counts.");
  return out.join("\n");
}
function appendComplianceRows_(ss, plan, byHca, responded, followUpsByHca, formCounts) {
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
    /* Appointments Reported must count BOTH channels. byHca is built from email
    replies only, so a rep who filed four Forms and sent no email used to read
    "Yes / 0" — credited for answering but shown as having reported nothing,
    which then flowed into the weekly 1:1 aggregate. Getting the recap is the
    win; the channel is not the point. Summing is right because the ordinary
    case is one channel or the other (the other side is 0), and a rep who used
    both in one day is covering different appointments, not re-filing the same
    one. */
    const emailCount = group ? group.entries.length : 0;
    const formCount = (formCounts && formCounts[hca.name]) ? formCounts[hca.name] : 0;
    rows.push([
      plan.isoDate,
      hca.name,
      didReply ? "Yes" : "No",
      emailCount + formCount,
      (followUpsByHca && followUpsByHca[hca.name]) ? followUpsByHca[hca.name] : "",
      stamp
    ]);
  })
  ;
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, COMPLIANCE_HEADERS.length).setValues(rows);
  }
  return {
    written: rows.length
  };
}
function appendRecapRows_(ss, plan, byHca) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.logSheetName, RECAP_LOG_HEADERS);
  /* ensureSheet_ only writes headers when it CREATES the tab, so an existing
  log would never learn the four new names and the values would land in
  unlabelled columns. */
  ensureRecapLogColumns_(sheet);
  /* Reads the Key column BY NAME. readExistingKeys_ reads the LAST column,
  which stopped being Key the moment four columns were appended — it would
  have read "Alternatives?", found every key new, and double-written the
  whole log on the next nightly run. */
  const existing = readRecapKeys_(sheet);
  const stamp = new Date();
  const rows = [];
  let skipped = 0;
  Object.keys(byHca).sort().forEach(name => {
    byHca[name].entries.forEach(e => {
      const key = recapRowKey_(plan.isoDate, name, e.customer);
      if (existing[key]) {
        skipped++;
        return;
      }
      existing[key] = true;
      const oneTime = (e.dealOneTime === null || e.dealOneTime === undefined) ? "" : e.dealOneTime;
      const caasMo = (e.dealMonthly === null || e.dealMonthly === undefined) ? "" : e.dealMonthly;
      const caasVal = caasMo === "" ? "" : caasContractValue_(caasMo);
      /* One helper, shared with the backfill, so the nightly write and a
      re-price of the same row can never disagree about the unit. */
      const unit = dealUnitFor_(e.deal, oneTime, caasMo, e.dealMentionsMonthly);
      rows.push([
        plan.isoDate,
        name,
        e.customer || "",
        e.leadSource || "",
        e.outcome || "",
        e.deal || "",
        (e.dealAmount === null || e.dealAmount === undefined) ? "" : e.dealAmount,
        unit,
        e.waterHeater || "",
        e.followUpDate || "",
        e.objection || "",
        stamp,
        key,
        oneTime,
        caasMo,
        caasVal === null ? "" : caasVal,
        e.dealAlternatives ? "Yes" : ""
      ]);
    })
    ;
  })
  ;
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RECAP_LOG_HEADERS.length).setValues(rows);
  }
  return {
    written: rows.length, skipped: skipped
  };
}
// flush-first version: commits Leads/Installs before the flow line so a flow hiccup can't roll them back.
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
      })
      ;
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
  })
  ;
  /* Email notes hang off the same date|HCA|customer key the job rows use. */
  const notesByKey = {
  };
  readSheetRows_(ss, cfg.emailNotesSheetName, EMAIL_NOTE_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso)
    .forEach(r => {
    const key = String(r[8] || "");
    if (!notesByKey[key]) notesByKey[key] = [];
    notesByKey[key].push({
      date: String(r[3] || ""), from: String(r[4] || ""),
        subject: String(r[5] || ""), summary: String(r[6] || ""),
        link: String(r[7] || "")
    })
    ;
  })
  ;
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
      .map(r => ({
      date: r.date, customer: r.customer, source: r.source, outcome: r.outcome
    })
    );
  })
  ;
  status.unclaimedAppointments.sort((a, b) =>
    String(b.appointmentIso).localeCompare(String(a.appointmentIso)));
  return status;
}
function applySheetLayout_(ss, name) {
  const layout = SHEET_LAYOUTS[name];
  const sheet = ss.getSheetByName(name);
  if (!layout || !sheet) return;
  try {
    const lastRow = Math.max(sheet.getLastRow(), 2);
    layout.widths.forEach((w, i) => {
      if (w === 0) {
        sheet.hideColumns(i + 1);
        return;
      }
      sheet.setColumnWidth(i + 1, w);
    })
    ;
    (layout.wrap || []).forEach(i => {
      sheet.getRange(2, i + 1, lastRow - 1, 1).setWrap(true).setVerticalAlignment("top");
    })
    ;
    (layout.money || []).forEach(i => {
      sheet.getRange(2, i + 1, lastRow - 1, 1).setNumberFormat('$#,##0');
    })
    ;
    (layout.money2 || []).forEach(i => {
      sheet.getRange(2, i + 1, lastRow - 1, 1).setNumberFormat('$#,##0.00');
    })
    ;
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
  }
  catch (err) {
    /* Formatting must never cost a refresh its data. */
    Logger.log("Layout skipped for " + name + ": " + err);
  }
}
function auditGrowthSheet() {
  const out = [];
  let ss;
  try {
    ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  }
  catch (err) {
    Logger.log("Could not open the growth sheet: " +
      (err && err.message ? err.message : String(err)));
    return {
      ok: false
    };
  }
  out.push("Growth sheet audit — " + ss.getName());
  out.push("Read-only. Nothing is written, hidden or unhidden.");
  out.push(new Array(70).join("="));
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayKeys = {
  };
  DAY_NAMES.forEach(d => {
    dayKeys[d.toLowerCase()] = d;
    dayKeys[d.slice(0, 3).toLowerCase()] = d;
  })
  ;
  const findings = [];
  /* Every weekday tab was copied from the same one, so they carry the same
  faults and would print the same paragraph of explanation five times over.
  That is what pushed the first run past the log limit and truncated the
  TO FIX list off the end. Each explanation is written out the first time
  its kind appears and referred back to afterwards. */
  const explained = {
  };
  const explain = (kind, lines) => {
    if (explained[kind]) {
      out.push("    (same as above)");
      return;
    }
    explained[kind] = true;
    lines.forEach(l => out.push(l));
  };
  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const nRows = Math.min(sheet.getLastRow(), 40);
    const nCols = Math.min(sheet.getLastColumn(), 20);
    if (!nRows || !nCols) return;
    const grid = sheet.getRange(1, 1, nRows, nCols).getValues();
    const forms = sheet.getRange(1, 1, nRows, nCols).getFormulas();
    out.push("");
    out.push(new Array(70).join("-"));
    out.push("TAB: " + name);
    /* The header row is the one carrying FM Budget — same anchor the writer
    uses, so the audit sees the sheet the way the writer will. */
    let headerRow = -1, budgetCol = -1;
    for (let r = 0;
    r < grid.length && headerRow === -1;
    r++) {
      for (let c = 0;
      c < grid[r].length;
      c++) {
        if (growthLabelKey_(grid[r][c]).indexOf("budget") !== -1) {
          headerRow = r;
          budgetCol = c;
          break;
        }
      }
    }
    if (headerRow === -1) {
      out.push("  ! No FM Budget header — the writer will refuse this tab.");
      findings.push(name + ": no FM Budget header");
      return;
    }
    const mtdCol = budgetCol - 1;
    const mtdLetter = growthColLetter_(mtdCol + 1);
    if (mtdCol < 0 || growthLabelKey_(grid[headerRow][mtdCol]) !== "mtd") {
      out.push("  ! The column before FM Budget is " + JSON.stringify(grid[headerRow][mtdCol]) +
        ", not MTD — the writer will refuse this tab.");
      findings.push(name + ": column before FM Budget is not MTD");
      return;
    }
    /* Which days this tab is entitled to. Everything else in a day column is
    left over from whatever it was copied from. */
    const ownDays = {
    };
    if (growthLabelKey_(name) === "weekend") {
      ownDays["Saturday"] = true;
      ownDays["Sunday"] = true;
    }
    else if (dayKeys[growthLabelKey_(name)]) ownDays[dayKeys[growthLabelKey_(name)]] = true;
    const hidden = c => {
      try {
        return sheet.isColumnHiddenByUser(c + 1);
      }
      catch (err) {
        return null;
      }
    };
    const dayCols = [];
    for (let c = 0;
    c < mtdCol;
    c++) {
      const d = dayKeys[growthLabelKey_(grid[headerRow][c])];
      if (d) dayCols.push({
        c: c, letter: growthColLetter_(c + 1), header: grid[headerRow][c], day: d
      })
      ;
    }
    out.push("  header row " + (headerRow + 1) + "   MTD in column " + mtdLetter +
      "   FM Budget in " + growthColLetter_(budgetCol + 1));
    dayCols.forEach(d => {
      const h = hidden(d.c);
      out.push("  day column " + d.letter + '  headed "' + d.header + '"' +
        (h === true ? "   [HIDDEN]" : h === null ? "   [hidden state unreadable]" : "") +
        (ownDays[d.day] ? "" : "   <- not a day this tab covers"));
    })
    ;
    if (!dayCols.length) out.push("  ! No day columns at all on this tab.");
    if (!Object.keys(ownDays).some(d => dayCols.some(x => x.day === d))) {
      out.push("  ! This tab has no column for the day it is named after.");
      findings.push(name + ": no column for its own day");
    }
    const rows = growthRowsFor_(grid);
    out.push("");
    out.push("  " + ("metric" + new Array(32).join(" ")).slice(0, 28) +
      dayCols.map(d => (d.letter + new Array(20).join(" ")).slice(0, 18)).join("") +
      mtdLetter + " (MTD)");
    const strayDays = {
    },
    strayFormulas = [], willSkip = [], truncated = [];
    const ownFilled = [], ownEmpty = [];
    GROWTH_ROWS.forEach(spec => {
      const row = rows[spec.key];
      if (!row) {
        out.push("  ! row not found: " + spec.label);
        return;
      }
      const r = row - 1;
      const show = c => {
        const f = (forms[r] || [])[c];
        if (f) return f;
        const v = (grid[r] || [])[c];
        return (v === "" || v === null || v === undefined) ? "-" : String(v);
      };
      /* Truncating a formula is how "=AI(" went unread the first time this
      ran. The table still has to line up, so a clipped cell is marked and
      printed in full underneath rather than quietly cut. */
      const fit = (s, a1) => {
        if (s.length <= 17) return (s + new Array(20).join(" ")).slice(0, 18);
        truncated.push("      " + a1 + "  " + s);
        return s.slice(0, 16) + "… ";
      };
      const line = ["  " + ((spec.label + " (" + row + ")") + new Array(32).join(" ")).slice(0, 28)];
      dayCols.forEach(d => {
        line.push(fit(show(d.c), d.letter + row));
        const v = (grid[r] || [])[d.c];
        const f = (forms[r] || [])[d.c];
        const filled = v !== "" && v !== null && v !== undefined;
        if (!ownDays[d.day]) {
          if (filled) strayDays[d.letter + ' "' + d.header + '"'] = true;
          return;
        }
        /* This tab's own day column, which is where its numbers go.
        A FORMULA here is a permanent problem: the writer treats it as
        somebody's calculation and skips it for good, so that row never
        fills in no matter how many times it runs.
        A VALUE here is usually not a problem at all — a day already
        recorded is supposed to have values, and the writer refusing to
        rewrite it is the guard working. What IS a problem is a column
        that is only PARTLY filled, which no recorded day ever produces:
        it means a few cells were carried over from whatever the tab was
        copied from, and those few will survive the next run while the
        rest of the column updates around them. That is judged below,
        once the whole column has been read. */
        if (f) willSkip.push("      " + d.letter + row + "  " + spec.label + "   " + f);
        else if (filled) ownFilled.push({
          a1: d.letter + row, label: spec.label, value: v
        })
        ;
        else ownEmpty.push(d.letter + row);
      })
      ;
      const mtdText = show(mtdCol);
      line.push(mtdText.length <= 40 ? mtdText : mtdText.slice(0, 39) + "…");
      if (mtdText.length > 40) truncated.push("      " + mtdLetter + row + "  " + mtdText);
      out.push(line.join(""));
      /* An MTD formula that reads any column other than MTD is reading the
      week. It will look right today and be wrong by Friday. */
      const mf = (forms[r] || [])[mtdCol];
      if (mf) {
        const used = formulaColsUsed_(mf).filter(c => c !== mtdLetter);
        if (used.length) strayFormulas.push("      " + mtdLetter + row + "  " + spec.label +
          "   " + mf + "   reads " + used.join(", "));
      }
    })
    ;
    if (truncated.length) {
      out.push("");
      out.push("  cells too long to fit above, in full:");
      truncated.forEach(t => out.push(t));
    }
    const stray = Object.keys(strayDays);
    if (stray.length) {
      out.push("");
      out.push("  ! Leftover data in " + stray.join(", ") + " — a day this tab does not cover.");
      explain("strayDays", [
        "    Hiding a column does not clear it. The values are still there and any",
        "    formula pointing at them still reads them."]);
      findings.push(name + ": leftover data in " + stray.join(", "));
    }
    if (strayFormulas.length) {
      out.push("");
      out.push("  ! MTD formulas that read outside column " + mtdLetter + ":");
      strayFormulas.forEach(f => out.push(f));
      explain("strayFormulas", [
        "    These show the week, not the month. Point them at " + mtdLetter +
          " cells and they",
        "    will follow the month total the script writes."]);
      findings.push(name + ": " + strayFormulas.length + " MTD formula(s) read the day columns");
    }
    if (willSkip.length) {
      out.push("");
      out.push("  ! Formulas in this tab's OWN day column — the writer skips these for good:");
      willSkip.forEach(f => out.push(f));
      explain("willSkip", [
        "    A formula is treated as somebody's calculation and never overwritten, so",
        "    these cells stay as they are while every cell around them updates.",
        "    Clear them if the script is meant to fill that row."]);
      findings.push(name + ": " + willSkip.length + " formula(s) in its own day column, never written");
    }
    /* A day column is either recorded or waiting. Anything in between is
    carry-over from whatever the tab was copied from — and it is the
    dangerous shape, because those few cells survive the next run while
    everything around them updates, and the tab then looks complete. */
    if (ownFilled.length && ownEmpty.length) {
      out.push("");
      out.push("  ! This tab's OWN day column is only part filled — " + ownFilled.length +
        " cell(s) hold a value, " + ownEmpty.length + " are empty.");
      ownFilled.forEach(f => out.push("      " + f.a1 + "  " + f.label +
        "   holds " + JSON.stringify(f.value)));
      explain("partFilled", [
        "    A day that was actually recorded fills the whole column, so this is",
        "    carry-over. The writer refuses a cell that already holds something, so these",
        "    keep their value while the empty ones fill in around them. Clear them."]);
      findings.push(name + ": own day column part filled — " +
        ownFilled.map(f => f.a1).join(", ") + " are carry-over");
    }
    else if (ownFilled.length) {
      out.push("");
      out.push("  (own day column fully recorded — the writer leaves it alone, guard working)");
    }
  })
  ;
  out.push("");
  out.push(new Array(70).join("="));
  if (findings.length) {
    out.push("TO FIX:");
    findings.forEach(f => out.push("  - " + f));
  }
  else {
    out.push("Nothing to fix. Every tab has a clear column for its own day, no leftover");
    out.push("data elsewhere, and no MTD formula reading the day columns.");
  }
  /* Apps Script truncates a long log, and it truncates the END — which is
  where the TO FIX list is. Six tabs of identical carry-over was enough to
  cut the last tab off mid-table and lose the summary entirely, so the
  summary goes out as its own entry too. Two log lines beat one that stops
  early. */
  Logger.log(out.join("\n"));
  const summary = ["Growth sheet audit — summary"];
  if (findings.length) {
    summary.push(findings.length + " thing(s) to fix:");
    findings.forEach(f => summary.push("  - " + f));
  }
  else {
    summary.push("Nothing to fix.");
  }
  Logger.log(summary.join("\n"));
  return {
    ok: true, findings: findings
  };
}
function auditSoldAppointments() {
  const cfg = DAILY_RECAP_CONFIG;
  const fromIso = AUDIT_FROM_ISO, toIso = AUDIT_TO_ISO;
  const out = [];
  const started = Date.now();
  const spanDays = Math.round(
    (Date.parse(toIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 1;
  const todayIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  const soldLookback = Math.round(
    (Date.parse(todayIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 3;
  out.push("Sold -> appointment audit, " + fromIso + " to " + toIso);
  out.push("");
  const soldRes = readSoldAlerts_(Math.max(1, Math.min(300, soldLookback)));
  if (!soldRes.ok) {
    Logger.log("Sold alert search failed. Nothing measured.");
    return {
      ok: false
    };
  }
  const sales = collapseResoldAlerts_(soldRes.alerts)
    .filter(a => a.soldOnIso && a.soldOnIso >= fromIso && a.soldOnIso <= toIso);
  /* Appointments can precede the sale by months, so the appointment window
  reaches far further back than the sales window. */
  const apptFrom = Utilities.formatDate(
    new Date(Date.parse(fromIso + "T12:00:00Z") - 150 * 86400000), cfg.timeZone, "yyyy-MM-dd");
  const bookedRes = readBookedJobAlerts_(apptFrom, toIso, spanDays + 150);
  if (!bookedRes.ok) out.push("! Booked alert search failed — every sale will look unmatched.");
  const booked = bookedRes.booked || [];
  out.push("sales in range (after collapse): " + sales.length);
  out.push("appointments indexed:            " + booked.length +
    "   (" + apptFrom + " to " + toIso + ")");
  if (booked.length >= 300) {
    out.push("! 300 is the search cap — the appointment index may be truncated,");
    out.push("  which would show up as sales that cannot be matched.");
  }
  out.push("");
  /* Two indexes: the exact one, and the one that survives a spelling. */
  const byJob = {
  },
  byName = {
  };
  booked.forEach(b => {
    if (b.jobNumber) byJob[b.jobNumber] = b;
    const key = normName_(b.customer);
    if (key) (byName[key] = byName[key] || []).push(b);
  })
  ;
  const earliestFor = (b, soldIso) => {
    const list = byName[normName_(b.customer)] || [b];
    let best = "";
    list.forEach(x => {
      if (!x.appointmentIso || x.appointmentIso > soldIso) return;
      if (!best || x.appointmentIso < best) best = x.appointmentIso;
    })
    ;
    return best || b.appointmentIso;
  };
  const byMethod = {
    job: 0, opportunity: 0, name: 0, none: 0
  };
  const gaps = [];
  const unmatched = [];
  sales.forEach(s => {
    let hit = null, how = "";
    if (s.jobNumber && byJob[s.jobNumber]) {
      hit = byJob[s.jobNumber];
      how = "job";
    }
    if (!hit && s.opportunityNumber) {
      /* Every pair checked by hand had job = opportunity - 2. */
      const guess = String(Number(s.opportunityNumber) - 2);
      if (byJob[guess] && nameTokensOverlap_(byJob[guess].customer, s.customer)) {
        hit = byJob[guess];
        how = "opportunity";
      }
    }
    if (!hit) {
      const list = byName[normName_(s.customer)] || [];
      const before = list.filter(x => x.appointmentIso && x.appointmentIso <= s.soldOnIso);
      if (before.length) {
        hit = before[0];
        how = "name";
      }
    }
    if (!hit) {
      byMethod.none++;
      unmatched.push(s);
      return;
    }
    byMethod[how]++;
    const appt = earliestFor(hit, s.soldOnIso);
    const days = Math.round(
      (Date.parse(s.soldOnIso + "T12:00:00Z") - Date.parse(appt + "T12:00:00Z")) / 86400000);
    gaps.push({
      days: days, s: s, appt: appt, how: how
    })
    ;
  })
  ;
  const matched = gaps.length;
  const pct = n => sales.length ? Math.round(n * 100 / sales.length) + "%" : "0%";
  out.push("matched by job number:    " + byMethod.job + "  " + pct(byMethod.job));
  out.push("matched by opportunity:   " + byMethod.opportunity + "  " + pct(byMethod.opportunity));
  out.push("matched by customer name: " + byMethod.name + "  " + pct(byMethod.name));
  out.push("no appointment found:     " + byMethod.none + "  " + pct(byMethod.none));
  out.push("");
  out.push("MATCH RATE: " + matched + "/" + sales.length + " = " + pct(matched));
  out.push("");
  if (matched) {
    const band = {
      "0": 0, "1": 0, "2-6": 0, "7-13": 0, "14+": 0, "before": 0
    };
    gaps.forEach(g => {
      if (g.days < 0) band["before"]++;
      else if (g.days === 0) band["0"]++;
      else if (g.days === 1) band["1"]++;
      else if (g.days <= 6) band["2-6"]++;
      else if (g.days <= 13) band["7-13"]++;
      else band["14+"]++;
    })
    ;
    out.push("days from FIRST appointment to sold-marking:");
    ["0", "1", "2-6", "7-13", "14+"].forEach(k =>
      out.push("  " + (k + "      ").slice(0, 6) + " days : " + band[k]));
    if (band["before"]) {
      out.push("  sold BEFORE any appointment : " + band["before"] + "   <- should be 0, look at these");
    }
    const same = band["0"] + band["1"];
    out.push("");
    out.push("  same visit (0-1 days): " + same + "/" + matched +
      " = " + Math.round(same * 100 / matched) + "%");
    out.push("  follow-up close (2+):  " + (matched - same) + "/" + matched +
      " = " + Math.round((matched - same) * 100 / matched) + "%");
    out.push("");
    out.push("longest gaps:");
    gaps.slice().sort((a, b) => b.days - a.days).slice(0, 8).forEach(g =>
      out.push("  " + (g.days + "   ").slice(0, 4) + "d  " + g.appt + " -> " + g.s.soldOnIso +
        "  " + g.s.hca + " — " + g.s.customer));
  }
  if (unmatched.length) {
    out.push("");
    out.push("no appointment found (" + unmatched.length + ") — expect phone closes and");
    out.push("anything booked before the appointment window:");
    unmatched.slice(0, 25).forEach(s =>
      out.push("  " + s.soldOnIso + "  " + s.hca + " — " + (s.customer || "(unnamed)")));
    if (unmatched.length > 25) out.push("  ... and " + (unmatched.length - 25) + " more");
  }
  out.push("");
  out.push("took " + Math.round((Date.now() - started) / 1000) + "s");
  Logger.log(out.join("\n"));
  return {
    sales: sales.length, matched: matched, byMethod: byMethod
  };
}
function bipipe_(preview) {
  var ss = SpreadsheetApp.openById(PIPE_SHEET_ID);
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var sh = ss.getSheetByName(PIPE_TAB);
  if (!sh) throw new Error('Paste the "HVAC Backlog and Pipeline Installs" export into a tab named "' + PIPE_TAB + '" (with its header row), then run again.');
  var g = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  // ---- find header row: needs an appointment-date column + a Lead Type column ----
  var hr = -1, cDate = -1, cType = -1, cCust = -1;
  for (var r = 0;
  r < g.length && hr < 0;
  r++) {
    var row = g[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    var di = -1;
    for (var c = 0;
    c < row.length;
    c++) {
      if (row[c] === "lastapptdate" || (row[c].indexOf("appt") > -1 && row[c].indexOf("date") > -1)) di = c;
    }
    var ti = row.indexOf("lead type");
    if (di > -1 && ti > -1) {
      hr = r;
      cDate = di;
      cType = ti;
      for (var c2 = 0;
      c2 < row.length;
      c2++) if (row[c2].indexOf("customer") > -1) cCust = c2;
    }
  }
  if (hr < 0) throw new Error('Could not find the header (need a "lastApptDate" and a "Lead Type" column) in "' + PIPE_TAB + '".');
  var todayY = Number(Utilities.formatDate(new Date(), tz, "yyyyMMdd"));
  function ymd(v) {
    if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? null : Number(Utilities.formatDate(v, tz, "yyyyMMdd"));
    var s = String(v || "").trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Number(m[1] + m[2] + m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      var y = m[3].length === 2 ? ("20" + m[3]) : m[3];
      return Number(y + ("0" + m[1]).slice(-2) + ("0" + m[2]).slice(-2));
    }
    return null;
  }
  function bucket(lt) {
    lt = String(lt || "").trim().toLowerCase();
    if (lt === "inbound") return "Inbound";
    if (lt === "webform") return "Webform";
    if (lt === "tech lead" || lt === "tech flip") return "Tech";
    if (lt.indexOf("self") === 0) return "SelfGen";
    return null;
  }
  var B = {
    Total: 0, Inbound: 0, Webform: 0, SelfGen: 0, Tech: 0
  };
  var P = {
    Total: 0, Inbound: 0, Webform: 0, SelfGen: 0, Tech: 0
  };
  var bNames = [], pNames = [];
  for (var r = hr + 1;
  r < g.length;
  r++) {
    var d = ymd(g[r][cDate]);
    if (d === null) continue;
    // footer / blank
    var b = bucket(g[r][cType]);
    if (!b) continue;
    var nm = cCust > -1 ? String(g[r][cCust] || "").trim() : ("row " + (r + 1));
    if (d < todayY) {
      B.Total++;
      B[b]++;
      bNames.push(nm);
    }
    else {
      P.Total++;
      P[b]++;
      pNames.push(nm);
    }
  }
  var stamp = Utilities.formatDate(new Date(), tz, "EEE M/d h:mm a");
  var block = [
    [PIPE_MARKER + " (as of " + stamp + ")", "", "", "", "", ""],
    ["", "Total", "Inbound", "Webform", "Self Gen", "Tech Lead"],
    ["Backlog (overdue)", B.Total, B.Inbound, B.Webform, B.SelfGen, B.Tech],
    ["Pipeline (scheduled)", P.Total, P.Inbound, P.Webform, P.SelfGen, P.Tech],
    ["Total awaiting install", B.Total + P.Total, B.Inbound + P.Inbound, B.Webform + P.Webform, B.SelfGen + P.SelfGen, B.Tech + P.Tech]
  ];
  if (preview) {
    var pm = "PREVIEW (nothing written).\n" +
      "Backlog (overdue) " + B.Total + " -> In " + B.Inbound + ", Wf " + B.Webform + ", SG " + B.SelfGen + ", Tech " + B.Tech + "\n   " + (bNames.join(", ") || "(none)") + "\n" +
      "Pipeline (scheduled) " + P.Total + " -> In " + P.Inbound + ", Wf " + P.Webform + ", SG " + P.SelfGen + ", Tech " + P.Tech + "\n   " + (pNames.join(", ") || "(none)") + "\n" +
      "Total awaiting install " + (B.Total + P.Total) + ".  Would write onto L2C + relabel the per-day Pipeline column.";
    Logger.log(pm);
    return pm;
  }
  // ---- write the block onto L2C (overwrite in place if it already exists) ----
  var l2c = ss.getSheetByName("L2C");
  if (!l2c) throw new Error('No "L2C" tab found to write the block onto.');
  var colA = l2c.getRange(1, 1, Math.max(l2c.getLastRow(), 1), 1).getValues();
  var at = -1;
  for (var i = 0;
  i < colA.length;
  i++) {
    if (String(colA[i][0] || "").indexOf(PIPE_MARKER) === 0) {
      at = i + 1;
      break;
    }
  }
  if (at < 0) at = l2c.getLastRow() + 2;
  l2c.getRange(at, 1, block.length, 6).setValues(block);
  l2c.getRange(at, 1, 1, 6).setFontWeight("bold");
  l2c.getRange(at + 1, 1, 1, 6).setFontWeight("bold");
  l2c.getRange(at + 4, 1, 1, 6).setFontWeight("bold");
  var relabeled = relabelPipeline_(l2c);
  SpreadsheetApp.flush();
  var msg = "Wrote Awaiting Install block on L2C row " + at + ".  Backlog " + B.Total +
    " (In " + B.Inbound + ", Tech " + B.Tech + "), Pipeline " + P.Total +
    " (In " + P.Inbound + ", Wf " + P.Webform + "), total " + (B.Total + P.Total) + ". " +
    (relabeled ? "Renamed the per-day Pipeline column to \"Net Sold - Inst\"." : "(Per-day Pipeline header not found to rename.)");
  Logger.log(msg);
  return msg;
}
function bjRunFor_(sold, bookings) {
  if (!bookings || !bookings.length) return null;
  var onDay = bookings.filter(function (b) {
    return b.ranIso === sold.soldIso;
  })
  ;
  if (onDay.length) return onDay.sort(function (a, b) {
    return b.at - a.at;
  })
  [0];
  var before = bookings.filter(function (b) {
    return b.ranIso && b.ranIso <= sold.soldIso;
  })
  ;
  if (before.length) return before.sort(function (a, b) {
    return b.ranIso.localeCompare(a.ranIso);
  })
  [0];
  return bookings.sort(function (a, b) {
    return b.at - a.at;
  })
  [0];
}
function bjSearch_(query, cap) {
  var out = [];
  var threads = GmailApp.search(query, 0, cap || 300);
  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      out.push(m);
    })
    ;
  })
  ;
  return out;
}
function bjText_(msg) {
  var html = "";
  try {
    html = String(msg.getBody() || "");
  }
  catch (e) {
    html = "";
  }
  var text = "";
  if (html && /<[a-z!\/]/i.test(html)) {
    text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
               .replace(/<img[^>]*>/gi, " ")
               .replace(/<br\s*\/?>/gi, " \n ")
               .replace(/<[^>]+>/g, " ");
  }
  if (!/#|Job/i.test(text)) {
    try {
      text = String(msg.getPlainBody() || "");
    }
    catch (e) {
    }
  }
  return text.replace(/&amp;/gi, "&").replace(/&#0?39;/g, "'").replace(/&quot;/gi, '"')
             .replace(/&nbsp;/gi, " ").replace(/&#(\d+);/g, function (m, d) {
    return String.fromCharCode(+d);
  })
  .replace(/<?https?:\/\/\S+>?/gi, " ")
             .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}
function build1on1Tabs() {
  var WINDOW_DAYS = 14;
  // how far back a tab looks
  var ss = getLogSpreadsheet_().ss;
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = Session.getScriptTimeZone() || "America/Los_Angeles";
  }
  var ACT_TAB = (typeof ACTIVITY_LOG_TAB !== "undefined") ? ACTIVITY_LOG_TAB : "Activity Log";
  var now = new Date();
  var startIso = Utilities.formatDate(new Date(now.getTime() - (WINDOW_DAYS - 1) * 86400000), tz, "yyyy-MM-dd");
  var todayIso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  function isoOf_(v) {
    if (v === "" || v == null) return "";
    if (Object.prototype.toString.call(v) === "[object Date]")
      return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd");
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    var d = new Date(s);
    return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, tz, "yyyy-MM-dd");
  }
  function pretty_(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    return isNaN(d.getTime()) ? iso : Utilities.formatDate(d, tz, "EEE M/d");
  }
  function inWindow_(iso) {
    return iso && iso >= startIso && iso <= todayIso;
  }
  function money_(v) {
    if (v === "" || v == null) return "";
    var n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? String(v) : n;
  }
  function isSold_(v) {
    var s = String(v || "");
    return /sold/i.test(s) && !/not\s*sold|no\s*sale/i.test(s);
  }
  var logRows = readSheetRows_(ss, DAILY_RECAP_CONFIG.logSheetName, RECAP_LOG_HEADERS.length);
  var actRows = readSheetRows_(ss, ACT_TAB, ACTIVITY_LOG_HEADERS_RICH.length);
  var consultsByRep = {
  },
  actsByRep = {
  },
  reps = {
  };
  logRows.forEach(function (r) {
    var iso = isoOf_(r[0]);
    if (!inWindow_(iso)) return;
    var hca = String(r[1] || "").trim();
    if (!hca) return;
    reps[hca] = true;
    (consultsByRep[hca] = consultsByRep[hca] || []).push({
      iso: iso, r: r
    })
    ;
  })
  ;
  actRows.forEach(function (r) {
    var iso = isoOf_(r[0]);
    if (!inWindow_(iso)) return;
    var hca = String(r[1] || "").trim();
    if (!hca) return;
    reps[hca] = true;
    (actsByRep[hca] = actsByRep[hca] || []).push({
      iso: iso, r: r
    })
    ;
  })
  ;
  var CONSULT_HEAD = ["Date", "Customer", "Source", "Outcome", "Offered", "Amount", "Water Htr", "Next Follow-up", "Objection", "Notes"];
  var ACT_HEAD = ["Date", "Type", "Customer", "Outcome", "What they did", "Next Follow-up", "Objection"];
  var made = [];
  Object.keys(reps).sort().forEach(function (hca) {
    var sheet = ss.getSheetByName("1-on-1 — " + hca) || ss.insertSheet("1-on-1 — " + hca);
    sheet.clear();
    var consults = (consultsByRep[hca] || []).sort(function (a, b) {
      return b.iso.localeCompare(a.iso);
    })
    ;
    var acts = (actsByRep[hca] || []).sort(function (a, b) {
      return b.iso.localeCompare(a.iso);
    })
    ;
    var sold = consults.filter(function (x) {
      return isSold_(x.r[4]);
    })
    .length;
    sheet.getRange("A1").setValue(hca + " — 1:1 prep").setFontWeight("bold").setFontSize(14);
    sheet.getRange("A2").setValue(
      consults.length + " consult(s)  ·  " + sold + " sold" +
      (consults.length ? "  ·  " + Math.round(sold * 100 / consults.length) + "% close" : "") +
      "  ·  " + acts.length + " follow-up/visit(s)   ·   last " + WINDOW_DAYS + " days"
    ).setFontColor("#555555");
    var row = 4;
    sheet.getRange(row, 1).setValue("NEW CONSULTS").setFontWeight("bold").setFontColor("#0f172a");
    row++;
    sheet.getRange(row, 1, 1, CONSULT_HEAD.length).setValues([CONSULT_HEAD])
      .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    sheet.setFrozenRows(row);
    row++;
    if (consults.length) {
      var cOut = consults.map(function (x) {
        var r = x.r;
        var objFull = String(r[10] || "");
        var dash = objFull.indexOf(" — ");
        var objMain = dash === -1 ? objFull : objFull.slice(0, dash);
        var objNote = dash === -1 ? "" : objFull.slice(dash + 3);
        return [pretty_(x.iso), String(r[2] || ""), String(r[3] || ""), String(r[4] || ""),
          String(r[5] || ""), money_(r[6]), String(r[8] || ""), String(r[9] || ""), objMain, objNote];
      })
      ;
      sheet.getRange(row, 1, cOut.length, CONSULT_HEAD.length).setValues(cOut);
      sheet.getRange(row, 6, cOut.length, 1).setNumberFormat("$#,##0");
      row += cOut.length;
    }
    else {
      sheet.getRange(row, 1).setValue("— none in the last " + WINDOW_DAYS + " days —").setFontColor("#94a3b8");
      row++;
    }
    row++;
    // spacer
    sheet.getRange(row, 1).setValue("FOLLOW-UPS & VISITS").setFontWeight("bold").setFontColor("#0f172a");
    row++;
    sheet.getRange(row, 1, 1, ACT_HEAD.length).setValues([ACT_HEAD])
      .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    row++;
    if (acts.length) {
      var aOut = acts.map(function (x) {
        var r = x.r;
        // 0 date,2 activity,3 customer,9 outcome,13 what,10 next,11 objection
        return [pretty_(x.iso), String(r[2] || ""), String(r[3] || ""), String(r[9] || ""),
          String(r[13] || ""), String(r[10] || ""), String(r[11] || "")];
      })
      ;
      sheet.getRange(row, 1, aOut.length, ACT_HEAD.length).setValues(aOut);
      sheet.getRange(row, 5, aOut.length, 1).setWrap(true);
      row += aOut.length;
    }
    else {
      sheet.getRange(row, 1).setValue("— none in the last " + WINDOW_DAYS + " days —").setFontColor("#94a3b8");
      row++;
    }
    [90, 170, 120, 110, 340, 150, 150, 150, 150, 220].forEach(function (w, i) {
      sheet.setColumnWidth(i + 1, w);
    })
    ;
    made.push(hca);
  })
  ;
  Logger.log("Built 1:1 tabs for: " + (made.join(", ") || "(no rep activity in window)"));
  return made;
}
function buildDigestBody_(plan, byHca, missing, late, logResult, notesOnly, followUpsByHca, formCounts) {
  const lines = [];
  lines.push("Recap digest for " + plan.dateLabel + " (" + plan.weekday + ")");
  if (isTestMode_()) {
    lines.push("");
    lines.push("TEST MODE is on — tonight's recap went only to " + DAILY_RECAP_CONFIG.testRecipient + ",");
    lines.push("so replies from HCAs are not expected yet.");
  }
  lines.push("");
  const formNames = formCounts ? Object.keys(formCounts).sort() : [];
  const names = Object.keys(byHca).sort();
  if (!names.length) {
    lines.push(formNames.length
      ? "No email replies parsed — recaps came in on the Form (below)."
      : "No replies parsed.");
  }
  else {
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
      })
      ;
      const totals = sumDeals_(group.entries);
      if (totals.oneTime || totals.monthly) {
        const parts = [];
        if (totals.oneTime) parts.push("$" + formatMoney_(totals.oneTime) + " one-time");
        if (totals.monthly) parts.push("$" + formatMoney_(totals.monthly) + "/mo rental");
        lines.push("      Offered today: " + parts.join("  +  ") +
          (totals.missing ? "   (" + totals.missing + " with no figure given)" : ""));
        lines.push("");
      }
    })
    ;
  }
  /* ADD #3 — Form recaps. These count as reported; detail is in the Form
  Responses tab, so the digest just names who and how many. */
  if (formNames.length) {
    lines.push(new Array(60).join("-"));
    lines.push("Recapped via the Form (" + formNames.length + ") — detail in the Form Responses tab:");
    formNames.forEach(name => {
      lines.push("  - " + name + " (" + formCounts[name] + " appointment" + (formCounts[name] === 1 ? "" : "s") + ")");
    })
    ;
    lines.push("");
  }
  const fuNames = followUpsByHca ? Object.keys(followUpsByHca).sort() : [];
  if (fuNames.length) {
    lines.push(new Array(60).join("-"));
    lines.push("Follow-ups on older leads (" + fuNames.length + "):");
    fuNames.forEach(name => {
      lines.push("");
      lines.push("  " + name + " —");
      String(followUpsByHca[name]).split(/\r?\n/).forEach(l => lines.push("      " + l));
    })
    ;
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
    })
    ;
    lines.push("");
  }
  lines.push(new Array(60).join("="));
  if (missing.length) {
    lines.push("Scheduled today but no recap — not on email or the Form (" + missing.length + "):");
    missing.forEach(h => lines.push("  - " + h.name));
  }
  else if (plan.working.length) {
    lines.push("All " + plan.working.length + " scheduled HCAs recapped (email or Form).");
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
      })
      ;
    })
    ;
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
      })
      ;
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
        (logResult.skipped ? ", " + logResult.skipped + " already recorded" : "") +
        (formNames.length ? "  (email replies only — Form recaps live in the Form Responses tab)" : "") + ".");
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
    }
    else {
      lines.push("Recap log NOT updated — the digest above is the only record of tonight.");
      lines.push("Error: " + logResult.error);
    }
  }
  return lines.join("\n");
}
function buildMorningSalesBrief_(yIso, yLabel) {
  const cfg = DAILY_RECAP_CONFIG;
  const lines = [];
  const warnings = [];
  const soldRes = readSoldAlerts_(4);
  if (!soldRes.ok) warnings.push("ServiceTitan sold alerts could not be read — the sold list below is incomplete.");
  const sold = collapseResoldAlerts_(soldRes.alerts).filter(a => a.soldOnIso === yIso);
  /* What each rep said they ran, and who said nothing. */
  let reported = {
  };
  // hca -> [{customer, outcome}]
  let repliedBy = {
  };
  // hca -> "Yes" | "Late" | "No"
  let scheduled = [];
  try {
    const book = getLogSpreadsheet_();
    readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
      .filter(r => String(r[0]) === yIso)
      .forEach(r => {
      const name = String(r[1]);
      (reported[name] = reported[name] || []).push({
        customer: String(r[2] || ""), outcome: String(r[4] || "")
      })
      ;
    })
    ;
    readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length)
      .filter(r => String(r[0]) === yIso)
      .forEach(r => {
      scheduled.push(String(r[1]));
      repliedBy[String(r[1])] = String(r[2] || "");
    })
    ;
  }
  catch (err) {
    warnings.push("The recap log could not be read, so the same-day split is unavailable: " + err);
  }
  /* Classify each sale. "Unknown" is a real answer here and is never quietly
  folded into "prior consult". */
  const sameDay = [], prior = [], unknown = [];
  sold.forEach(s => {
    const rows = reported[s.hca] || [];
    const ranIt = rows.filter(r => namesMatch_(r.customer, s.customer))[0];
    if (ranIt) {
      sameDay.push(s);
      return;
    }
    const replied = String(repliedBy[s.hca] || "").toLowerCase();
    if (replied === "yes" || replied === "late") prior.push(s);
    else unknown.push(s);
  })
  ;
  const money = n => (n === null || n === undefined) ? "" : "$" + formatMoney_(n);
  const total = sold.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  lines.push("Sales brief — " + yLabel);
  lines.push(new Array(60).join("="));
  lines.push("");
  /* PRE-TAX. These amounts come off the ServiceTitan Sold Estimate Alert,
  which quotes before tax. The FM budget on the growth sheet includes tax,
  so the two are not comparable — around Everett that is roughly a 10% gap,
  which on a $2.58M target reads as a quarter of a million of shortfall
  that is not real. Labelled rather than adjusted: guessing a rate would be
  worse than saying which number this is. BI is the tax-inclusive source. */
  lines.push(sold.length + " sold" + (total ? "   " + money(total) + " total (pre-tax)" : ""));
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
    })
    ;
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
  })
  ;
  const silent = scheduled.filter(n => {
    const v = String(repliedBy[n] || "").toLowerCase();
    return v !== "yes" && v !== "late";
  })
  ;
  if (silent.length) {
    lines.push("");
    lines.push("NOT REPORTED (" + silent.length + "): " + silent.join(", "));
    lines.push("Anything they ran is missing from the figures above, sales included.");
    lines.push("The ServiceTitan dispatch board for " + yLabel + " is the only place");
    lines.push("that shows what they actually ran.");
  }
  else if (scheduled.length) {
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
  const byName = {
  };
  const ensure = name => {
    if (!byName[name]) {
      byName[name] = {
        name: name, appointments: 0, outcomes: {
        },
        offered: {
          oneTime: 0, monthly: 0, noFigure: 0
        },
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
    /* Money is read from the split columns when the row has them: N is the cash
    price, O is the Comfort Club payment. A "Both" row carries both, which
    Deal Amount alone cannot express — reading r[6] on its own counts the
    cash and silently drops the payment. Rows written before these columns
    existed have neither, and fall back to Deal Amount + Deal Unit exactly as
    before. */
    const rawOne = r.length > 13 ? r[13] : "";
    const rawMo = r.length > 14 ? r[14] : "";
    const splitOne = (rawOne === "" || rawOne === null || rawOne === undefined) ? null : Number(rawOne);
    const splitMo = (rawMo === "" || rawMo === null || rawMo === undefined) ? null : Number(rawMo);
    const hasSplit = (splitOne !== null && isFinite(splitOne)) || (splitMo !== null && isFinite(splitMo));
    h.appointments++;
    h.outcomes[outcome] = (h.outcomes[outcome] || 0) + 1;
    if (hasSplit) {
      if (splitOne !== null && isFinite(splitOne)) h.offered.oneTime += splitOne;
      if (splitMo !== null && isFinite(splitMo)) h.offered.monthly += splitMo;
    }
    else if (!isFinite(amount) || !r[6]) h.offered.noFigure++;
    else if (String(r[7]) === "Monthly") h.offered.monthly += amount;
    else h.offered.oneTime += amount;
    if (/^y/i.test(String(r[8] || ""))) h.waterHeaterPresented++;
    /* Objections are the point of a 1:1, so they travel with enough context to
    open a conversation rather than as bare strings. */
    if (outcome !== "SOLD" && r[10]) {
      h.objections.push({
        date: String(r[0]), customer: String(r[2] || ""), objection: String(r[10])
      })
      ;
    }
    /* An open deal with no next step is the one that quietly dies. */
    if (outcome !== "SOLD" && !String(r[9] || "").trim() && r[2]) {
      h.undated.push({
        date: String(r[0]), customer: String(r[2])
      })
      ;
    }
    h.rows.push({
      date: String(r[0]), customer: String(r[2] || ""), source: String(r[3] || ""),
      outcome: outcome, offered: String(r[5] || ""),
      amount: isFinite(amount) && r[6] !== "" ? amount : null,
      oneTime: (splitOne !== null && isFinite(splitOne)) ? splitOne : null,
      caasMonthly: (splitMo !== null && isFinite(splitMo)) ? splitMo : null,
      unit: String(r[7] || ""), waterHeater: String(r[8] || ""),
      nextFollowUp: String(r[9] || ""), objection: String(r[10] || "")
    })
    ;
  })
  ;
  compRows.forEach(r => {
    const h = ensure(String(r[1]));
    h.daysScheduled++;
    if (String(r[2]) === "Yes") {
      h.daysReplied++;
    }
    else {
      /* The dates themselves, not just a percentage. "Reported 80% of days"
      is not something you can raise in a 1:1; "you missed Tuesday and
      Thursday" is. */
      h.missedDays.push({
        date: String(r[0]), weekday: weekdayFromIso_(String(r[0]))
      })
      ;
    }
    if (r[4]) h.followUps.push({
      date: String(r[0]), text: String(r[4])
    })
    ;
  })
  ;
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
  })
  ;
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
function buildSoldReportPayload_(fromIso, toIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const todayIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  fromIso = String(fromIso || "").trim() || todayIso.slice(0, 8) + "01";
  // month to date
  toIso = String(toIso || "").trim() || todayIso;
  if (fromIso > toIso) {
    const swap = fromIso;
    fromIso = toIso;
    toIso = swap;
  }
  const spanDays = Math.round(
    (Date.parse(toIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 1;
  const warnings = [];
  const soldRes = readSoldAlerts_(Math.max(1, Math.min(200, spanDays + 3)));
  if (!soldRes.ok) {
    warnings.push("ServiceTitan sold alerts could not be read, so these counts are incomplete.");
  }
  else if (soldRes.complete === false) {
    /* A truncated read and a failed read are the same problem wearing
    different clothes: the total is low and nothing on the page says so. */
    warnings.push("The sold-alert search hit its thread ceiling, so this range is " +
      "only PARTIALLY read — every count and total below is understated. " +
      "Narrow the date range and run it again.");
  }
  const sold = collapseResoldAlerts_(soldRes.alerts)
    .filter(a => a.soldOnIso && a.soldOnIso >= fromIso && a.soldOnIso <= toIso);
  /* A date cell comes back as a Date or a string depending on how the row was
  written. Normalising here rather than trusting one shape. */
  const isoCell = v => v instanceof Date
    ? Utilities.formatDate(v, cfg.timeZone, "yyyy-MM-dd")
    : String(v || "").trim();
  const reported = {
  };
  // "iso|hca" -> [customer]
  const repliedBy = {
  };
  // "iso|hca" -> Yes | Late | No
  try {
    const book = getLogSpreadsheet_();
    readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length).forEach(r => {
      const iso = isoCell(r[0]);
      if (iso < fromIso || iso > toIso) return;
      const key = iso + "|" + String(r[1] || "");
      (reported[key] = reported[key] || []).push(String(r[2] || ""));
    })
    ;
    readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length).forEach(r => {
      const iso = isoCell(r[0]);
      if (iso < fromIso || iso > toIso) return;
      repliedBy[iso + "|" + String(r[1] || "")] = String(r[2] || "");
    })
    ;
  }
  catch (err) {
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
  })
  ).sort((a, b) =>
    a.soldOnIso === b.soldOnIso ? (a.hca < b.hca ? -1 : 1) : (a.soldOnIso < b.soldOnIso ? 1 : -1));
  const blank = () => ({
    sameDay: 0, prior: 0, unknown: 0, total: 0, amount: 0
  })
  ;
  const totals = blank(), byHca = {
  },
  byDay = {
  };
  sales.forEach(s => {
    const add = t => {
      t[s.split]++;
      t.total++;
      t.amount += (s.amount || 0);
    };
    add(totals);
    add(byHca[s.hca] = byHca[s.hca] || blank());
    add(byDay[s.soldOnIso] = byDay[s.soldOnIso] || blank());
  })
  ;
  /* Who was scheduled in the range and never answered. Their sales are the
  unknown bucket, so naming them turns the number into an action. */
  const silent = {
  };
  Object.keys(repliedBy).forEach(key => {
    const v = String(repliedBy[key] || "").toLowerCase();
    if (v === "yes" || v === "late") return;
    const name = key.slice(key.indexOf("|") + 1);
    silent[name] = (silent[name] || 0) + 1;
  })
  ;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    fromIso: fromIso, toIso: toIso, todayIso: todayIso,
    totals: totals,
    byHca: Object.keys(byHca).sort().map(n => Object.assign({
      hca: n
    },
    byHca[n])),
    byDay: Object.keys(byDay).sort().reverse().map(d => Object.assign({
      iso: d
    },
    byDay[d])),
    sales: sales,
    notReported: Object.keys(silent).sort().map(n => ({
      hca: n, days: silent[n]
    })
    ),
    warnings: warnings
  };
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
  })
  ;
  return lines.join("\n");
}
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
      skipped.push({
        name: hca.name, reason: "Paused" + (pause ? " — " + pause : "")
      })
      ;
      return;
    }
    if (type === "sick" || type === "vacation") {
      skipped.push({
        name: hca.name, reason: titleCase_(type) + (ex.notes ? " — " + ex.notes : "")
      })
      ;
      return;
    }
    if (type === "swap") {
      working.push(Object.assign({
      },
      hca, {
        note: "Swap" + (ex.notes ? " — " + ex.notes : "")
      })
      );
      return;
    }
    if (scheduled) working.push(Object.assign({
    },
    hca, {
      note: ""
    })
    );
    else skipped.push({
      name: hca.name, reason: "not scheduled " + weekday
    })
    ;
  })
  ;
  return {
    weekday, dateLabel, isoDate, working, skipped, exceptions
  };
}
function cleanupGrowthTabs() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var order = ["Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var data = soldRangeData_(monthStartIso_(), stToday_());
  var cnt = {
  };
  if (data && data.ok) data.rows.forEach(function (r) {
    cnt[r.iso] = (cnt[r.iso] || 0) + 1;
  })
  ;
  var dateOf = {
    "Weekend":   [{
      col: 3, iso: "2026-08-01"
    },
    {
      col: 4, iso: "2026-08-02"
    }
    ],
    "Monday":    [{
      col: 4, iso: "2026-08-03"
    }
    ],
    "Tuesday":   [{
      col: 4, iso: "2026-08-04"
    }
    ],
    "Wednesday": [{
      col: 4, iso: "2026-08-05"
    }
    ],
    "Thursday":  [{
      col: 4, iso: "2026-08-06"
    }
    ],
    "Friday":    [{
      col: 4, iso: "2026-08-07"
    }
    ]
  };
  var find = function (sh) {
    var last = sh.getLastRow();
    var b = sh.getRange(1, 2, last, 1).getValues();
    var m = {
    };
    for (var i = 0;
    i < b.length;
    i++) {
      var l = String(b[i][0]).trim().toLowerCase();
      if (l === "total sold (not tech flip)" || l === "total sold") m.total = i + 1;
      if (l === "hvac marketed deals") m.mkt = i + 1;
      if (l === "marketed l2c %") m.l2c = i + 1;
      if (l.indexOf("total") !== -1 && l.indexOf("leads") !== -1 && l.indexOf("sold") === -1) m.leads = i + 1;
      if (l === "self gen") m.self = i + 1;
    }
    return m;
  };
  var meta = [];
  order.forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) return;
    var m = find(sh);
    if (m.l2c) sh.getRange(m.l2c, 3, 1, 3).clearContent();
    // blank Marketed L2C % (keep the row)
    m = find(sh);
    if (m.mkt) sh.deleteRow(m.mkt);
    // delete Marketed Deals
    m = find(sh);
    if (m.leads) sh.deleteRow(m.leads);
    // delete Total # Leads
    m = find(sh);
    if (m.total) {
      sh.getRange(m.total, 2).setValue("Total Sold").setFontWeight("bold");
      (dateOf[tabName] || []).forEach(function (p) {
        sh.getRange(m.total, p.col).setValue(cnt[p.iso] || 0);
      })
      ;
      if (tabName !== "Weekend") sh.getRange(m.total, 3).clearContent();
    }
    meta.push({
      tab: tabName, totalRow: m.total, selfRow: m.self
    })
    ;
  })
  ;
  // cross-tab MTD roll-ups for Total Sold and Self Gen
  var pT = [], pS = [];
  var formula = function (list) {
    return "=" + list.map(function (p) {
      var nm = "'" + p.tab.replace(/'/g, "''") + "'";
      return nm + "!C" + p.row + "+" + nm + "!D" + p.row;
    })
    .join("+");
  };
  meta.forEach(function (x) {
    var sh = ss.getSheetByName(x.tab);
    if (x.totalRow) {
      pT.push({
        tab: x.tab, row: x.totalRow
      })
      ;
      sh.getRange(x.totalRow, 5).setFormula(formula(pT));
    }
    if (x.selfRow)  {
      pS.push({
        tab: x.tab, row: x.selfRow
      })
      ;
      sh.getRange(x.selfRow, 5).setFormula(formula(pS));
    }
  })
  ;
  SpreadsheetApp.flush();
  var mtd = Object.keys(cnt).reduce(function (s, k) {
    return s + cnt[k];
  },
  0);
  Logger.log("Cleaned up " + meta.length + " tab(s). Total Sold restored to the all-in count (MTD " + mtd + "). " +
    "Deleted Marketed Deals + Total # Leads; blanked Marketed L2C %; Self Gen kept at the bottom.");
  return "done — Total Sold MTD " + mtd;
}
function collapseResoldAlerts_(alerts){
  var parent=alerts.map(function(a,i){
    return i;
  })
  ;
  var find=function(i){
    while(parent[i]!==i){
      parent[i]=parent[parent[i]];
      i=parent[i];
    }
    return i;
  };
  var firstSeen={
  };
  var link=function(key,i){
    if(!key)return;
    if(firstSeen[key]===undefined){
      firstSeen[key]=i;
      return;
    }
    var a=find(firstSeen[key]),b=find(i);
    if(a!==b)parent[b]=a;
  };
  alerts.forEach(function(a,i){
    if(a.opportunityNumber){
      var peer=firstSeen["opp|"+a.opportunityNumber+"|"+normName_(a.customer)];
      if(peer===undefined||sameEstimateName_(alerts[peer].name,a.name)){
        link("opp|"+a.opportunityNumber+"|"+normName_(a.customer),i);
      }
    }
    link("who|"+normName_(a.hca)+"|"+normName_(a.customer)+"|"+(a.amount===null||a.amount===undefined?"":a.amount),i);
  })
  ;
  var groups={
  };
  alerts.forEach(function(a,i){
    var root=find(i);
    (groups[root]=groups[root]||[]).push(a);
  })
  ;
  return Object.keys(groups).map(function(root){
    var members=groups[root];
    if(members.length===1)return members[0];
    var ordered=members.slice().sort(function(x,y){
      return (x.received&&y.received)?x.received-y.received:0;
    })
    ;
    var kept=ordered[ordered.length-1];
    kept.resold=true;
    // Month-aware date: earliest sold date, but if the group spans two
    // different months, file it on the LATEST (so a prior-month deal that
    // re-sold this month counts in the current month).
    var iso=members.map(function(m){
      return m.soldOnIso;
    })
    .filter(Boolean).sort();
    if(iso.length){
      var lo=iso[0], hi=iso[iso.length-1];
      kept.soldOnIso=(lo.slice(0,7)===hi.slice(0,7))?lo:hi;
    }
    return kept;
  })
  ;
}
function computeGrowthMetrics_(fromIso, toIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const leads = {
  },
  deals = {
  },
  byDay = {
  };
  const dayOf = d => (byDay[d] = byDay[d] || {
    recapRows: 0, alerts: 0, revenue: 0
  })
  ;
  let recapRows = 0, readFailed = "";
  try {
    const book = getLogSpreadsheet_();
    readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length).forEach(r => {
      const rowIso = r[0] instanceof Date
        ? Utilities.formatDate(r[0], cfg.timeZone, "yyyy-MM-dd") : String(r[0] || "").trim();
      if (!rowIso || rowIso < fromIso || rowIso > toIso) return;
      recapRows++;
      dayOf(rowIso).recapRows++;
      const src = normalizeLeadSource_(String(r[3] || "")) || "(no source given)";
      const sold = String(r[4] || "").toUpperCase().indexOf("SOLD") !== -1;
      if (src !== "Revisit") leads[src] = (leads[src] || 0) + 1;
      if (sold) deals[src] = (deals[src] || 0) + 1;
    })
    ;
  }
  catch (err) {
    readFailed = err && err.message ? err.message : String(err);
  }
  const soldRes = readSoldAlerts_(Math.max(2, Math.min(120,
    Math.round((Date.now() - Date.parse(fromIso + "T12:00:00Z")) / 86400000) + 3)));
  const alertList = soldRes.ok
    ? collapseResoldAlerts_(soldRes.alerts)
        .filter(a => a.soldOnIso && a.soldOnIso >= fromIso && a.soldOnIso <= toIso)
        .sort((a, b) => a.soldOnIso < b.soldOnIso ? -1 : 1)
    : [];
  const soldComplete = soldRes.ok ? soldRes.complete !== false : false;
  alertList.forEach(a => {
    const d = dayOf(a.soldOnIso);
    d.alerts++;
    d.revenue += (Number(a.amount) || 0);
  })
  ;
  const revenue = alertList.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const isMarketed = s => s !== "Tech Flip" && s !== "Revisit";
  const marketedTotal = k => Object.keys(k).filter(isMarketed).reduce((n, s) => n + k[s], 0);
  const revisitDeals = deals["Revisit"] || 0;
  const parts = {
  };
  Object.keys(leads).filter(isMarketed).forEach(s => {
    parts[s] = true;
  })
  ;
  Object.keys(deals).filter(isMarketed).forEach(s => {
    parts[s] = true;
  })
  ;
  return {
    marketedLeads: marketedTotal(leads),
    marketedDeals: marketedTotal(deals) + revisitDeals,
    techFlipLeads: leads["Tech Flip"] || 0,
    techFlipDeals: deals["Tech Flip"] || 0,
    revenue: revenue,
    sales: alertList.length,
    leads: leads, deals: deals, parts: parts, revisitDeals: revisitDeals,
    byDay: byDay, alertList: alertList,
    recapRows: recapRows,
    recapSold: Object.keys(deals).reduce((n, s) => n + deals[s], 0),
    readFailed: readFailed, soldOk: !!soldRes.ok, soldComplete: soldComplete
  };
}
function decodeAlertEntities_(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, function (m, d) {
    return String.fromCharCode(Number(d));
  })
  ;
}
function decodeEstimates_(text) {
  return String(text || "").split("|").map(part => {
    const bits = part.split("@");
    const amount = Number(String(bits[0] || "").trim());
    return {
      amount: isFinite(amount) && bits[0].trim() !== "" ? amount : null,
             soldOn: String(bits[1] || "").trim()
    };
  })
  .filter(e => e.amount !== null || e.soldOn);
}
function decorateL2C_() {
  var ss = SpreadsheetApp.openById(L2CPLUS_SHEET_ID);
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var lc = ss.getSheetByName("L2C");
  if (!lc) return "no L2C tab.";
  // ---- 1) rename the per-day "Pipeline" header -> "Net Sold − Inst" ----
  var renamed = false;
  var top = lc.getRange(1, 1, Math.min(lc.getLastRow(), 20), Math.max(lc.getLastColumn(), 1)).getValues();
  for (var r = 0;
  r < top.length;
  r++) {
    var row = top[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    if (row.indexOf("date") > -1 && row.indexOf("leads") > -1 && row.indexOf("installs") > -1) {
      var pc = row.indexOf("pipeline");
      if (pc > -1) {
        lc.getRange(r + 1, pc + 1).setValue("Net Sold − Inst");
        renamed = true;
      }
      break;
    }
  }
  // ---- 2) rebuild the "Awaiting Install" block from the Backlog Pipeline tab ----
  var pipe = ss.getSheetByName(L2CPLUS_PIPE_TAB);
  if (!pipe || pipe.getLastRow() < 2) {
    return (renamed ? "header renamed; " : "header not found; ") +
      '"' + L2CPLUS_PIPE_TAB + '" tab empty/missing, block skipped.';
  }
  var g = pipe.getRange(1, 1, pipe.getLastRow(), pipe.getLastColumn()).getValues();
  var hr = -1, cDate = -1, cType = -1, cCust = -1;
  for (var i = 0;
  i < g.length && hr < 0;
  i++) {
    var hrow = g[i].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    var di = -1;
    for (var c = 0;
    c < hrow.length;
    c++) {
      if (hrow[c] === "lastapptdate" || (hrow[c].indexOf("appt") > -1 && hrow[c].indexOf("date") > -1)) di = c;
    }
    var ti = hrow.indexOf("lead type");
    if (di > -1 && ti > -1) {
      hr = i;
      cDate = di;
      cType = ti;
      for (var c2 = 0;
      c2 < hrow.length;
      c2++) if (hrow[c2].indexOf("customer") > -1) cCust = c2;
    }
  }
  if (hr < 0) {
    return (renamed ? "header renamed; " : "header not found; ") +
      "no lastApptDate/Lead Type header in Backlog Pipeline, block skipped.";
  }
  var todayY = Number(Utilities.formatDate(new Date(), tz, "yyyyMMdd"));
  function ymd(v) {
    if (Object.prototype.toString.call(v) === "[object Date]")
      return isNaN(v.getTime()) ? null : Number(Utilities.formatDate(v, tz, "yyyyMMdd"));
    var s = String(v || "").trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Number(m[1] + m[2] + m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      var y = m[3].length === 2 ? ("20" + m[3]) : m[3];
      return Number(y + ("0" + m[1]).slice(-2) + ("0" + m[2]).slice(-2));
    }
    return null;
  }
  function bucket(lt) {
    lt = String(lt || "").trim().toLowerCase();
    if (lt === "inbound") return "Inbound";
    if (lt === "webform") return "Webform";
    if (lt === "tech lead" || lt === "tech flip") return "Tech";
    if (lt.indexOf("self") === 0) return "SelfGen";
    return null;
  }
  var B = {
    Total: 0, Inbound: 0, Webform: 0, SelfGen: 0, Tech: 0
  };
  var P = {
    Total: 0, Inbound: 0, Webform: 0, SelfGen: 0, Tech: 0
  };
  for (var r2 = hr + 1;
  r2 < g.length;
  r2++) {
    var dd = ymd(g[r2][cDate]);
    if (dd === null) continue;
    // footer / blank
    var b = bucket(g[r2][cType]);
    if (!b) continue;
    if (dd < todayY) {
      B.Total++;
      B[b]++;
    }
    else {
      P.Total++;
      P[b]++;
    }
  }
  var stamp = Utilities.formatDate(new Date(), tz, "EEE M/d h:mm a");
  var block = [
    [L2CPLUS_MARKER + " (as of " + stamp + ")", "", "", "", "", ""],
    ["", "Total", "Inbound", "Webform", "Self Gen", "Tech Lead"],
    ["Backlog (overdue)", B.Total, B.Inbound, B.Webform, B.SelfGen, B.Tech],
    ["Pipeline (scheduled)", P.Total, P.Inbound, P.Webform, P.SelfGen, P.Tech],
    ["Total awaiting install", B.Total + P.Total, B.Inbound + P.Inbound, B.Webform + P.Webform, B.SelfGen + P.SelfGen, B.Tech + P.Tech]
  ];
  var at = lc.getLastRow() + 2;
  lc.getRange(at, 1, block.length, 6).setValues(block);
  lc.getRange(at, 1, 1, 6).setFontWeight("bold");
  lc.getRange(at + 1, 1, 1, 6).setFontWeight("bold");
  lc.getRange(at + 4, 1, 1, 6).setFontWeight("bold");
  SpreadsheetApp.flush();
  return (renamed ? 'header -> "Net Sold − Inst"; ' : "header not found; ") +
    "Awaiting Install: Backlog " + B.Total + " (In " + B.Inbound + ", Wf " + B.Webform + ", SG " + B.SelfGen + ", Tech " + B.Tech + "), " +
    "Pipeline " + P.Total + " (In " + P.Inbound + ", Wf " + P.Webform + ", SG " + P.SelfGen + ", Tech " + P.Tech + "), total " + (B.Total + P.Total) + ".";
}
function dedupeActivityLog_(previewOnly) {
  var ss = getLogSpreadsheet_().ss;
  var ACT_TAB = (typeof ACTIVITY_LOG_TAB !== "undefined") ? ACTIVITY_LOG_TAB : "Activity Log";
  var H = ACTIVITY_LOG_HEADERS_RICH;
  var sheet = ss.getSheetByName(ACT_TAB);
  if (!sheet) return "No Activity Log tab found.";
  var lr = sheet.getLastRow();
  if (lr < 2) return "Activity Log has no data rows.";
  var width = Math.min(H.length, sheet.getLastColumn());
  var data = sheet.getRange(2, 1, lr - 1, width).getValues();
  var groups = {
  },
  order = [];
  data.forEach(function (r) {
    var sig = activitySig_(r[0], r[1], r[3], r[13], r[11], r[10]);
    if (!groups[sig]) {
      groups[sig] = {
        row: r.slice(), types: []
      };
      order.push(sig);
    }
    var t = String(r[2] || "").trim();
    if (t && groups[sig].types.indexOf(t) === -1) groups[sig].types.push(t);
  })
  ;
  var out = order.map(function (sig) {
    var row = groups[sig].row.slice();
    row[2] = groups[sig].types.join(", ");
    while (row.length < width) row.push("");
    return row.slice(0, width);
  })
  ;
  var merged = data.length - out.length;
  if (previewOnly || merged === 0) {
    var m = merged === 0
      ? "Activity Log already clean — " + data.length + " row(s), 0 duplicates."
      : "PREVIEW — nothing changed. " + data.length + " → " + out.length + " row(s) (" + merged + " would collapse).";
    Logger.log(m);
    return m;
  }
  sheet.getRange(2, 1, data.length, width).clearContent();
  if (out.length) sheet.getRange(2, 1, out.length, width).setValues(out);
  SpreadsheetApp.flush();
  var msg = "Activity Log de-duped: " + data.length + " → " + out.length + " row(s); " +
    merged + " fanned duplicate(s) merged into one.";
  Logger.log(msg);
  return msg;
}
function dedupeEntries_(entries) {
  const filledCount = e => ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .reduce((n, k) => n + (e[k] ? 1 : 0), 0);
  const byKey = {
  },
  order = [];
  entries.forEach(e => {
    const key = String(e.customer || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) {
      order.push(e);
      return;
    }
    // unnamed: keep as-is
    if (!byKey[key]) {
      byKey[key] = e;
      order.push(e);
      return;
    }
    if (filledCount(e) > filledCount(byKey[key])) {
      order[order.indexOf(byKey[key])] = e;
      byKey[key] = e;
    }
  })
  ;
  return order;
}
function deleteBrokenGrowthTabs() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var keep = {
    "daily": 1, "l2c": 1
  };
  var deleted = [], kept = [];
  ss.getSheets().forEach(function (s) {
    var name = String(s.getName());
    if (keep[name.toLowerCase().trim()]) {
      kept.push(name);
      return;
    }
    var hasRef = s.getDataRange().getDisplayValues().some(function (row) {
      return row.some(function (c) {
        return String(c).indexOf("#REF") !== -1;
      })
      ;
    })
    ;
    var isStray = /cm daily/i.test(String(s.getRange(1, 1).getValue()));
    if (hasRef || isStray) {
      ss.deleteSheet(s);
      deleted.push(name);
    }
    else kept.push(name);
  })
  ;
  Logger.log("Deleted: " + (deleted.join(", ") || "none") + "\nKept: " + kept.join(", "));
  return deleted;
}
function deleteDailyRecapTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === "sendDailyRecap" || fn === "collectRecapReplies" ||
        fn === "sendMorningNudgeWorkingToday" || fn === "sendMorningNudgeOffToday" ||
        fn === "sweepRecapReplies" || fn === "sendMorningSalesBrief" ||
        fn === "refreshJobStatus" || fn === "writeGrowthSheetForYesterday" ||
        fn === "runGrowthDailyPipeline") {
      ScriptApp.deleteTrigger(trigger);
    }
  })
  ;
}
function diagnoseSoldRead() {
  var TARGET_OPP = "407692912";
  // Pat Pearson's opportunity number
  var TARGET_RE  = /pat pearson/i;
  // Pat Pearson's customer name
  var TARGET_DAY = "2026-08-04";
  var fromIso = (typeof monthStartIso_ === "function") ? monthStartIso_() : "2026-08-01";
  var look    = (typeof mtdLookback_ === "function") ? mtdLookback_(fromIso) : 30;
  var res = readSoldAlerts_(look);
  var out = [];
  out.push("MTD read diagnostic — window start " + fromIso + ", lookback " + look + " days.");
  if (!res || !res.ok) {
    out.push("  readSoldAlerts_ FAILED (res.ok is false).");
    var m0 = out.join("\n");
    Logger.log(m0);
    return m0;
  }
  var raw = res.alerts || [];
  out.push("  raw alerts read: " + raw.length + "   complete=" + res.complete +
           (res.complete === false ? "   <-- PARTIAL: search ceiling hit, alerts were dropped" : ""));
  // --- (A) is Pat Pearson in the RAW read? ---
  var rawHits = raw.filter(function (a) {
    return TARGET_RE.test(String(a.customer || "")) || String(a.opportunityNumber || "") === TARGET_OPP;
  })
  ;
  out.push("");
  out.push("  RAW matches for Pat Pearson (customer or opp " + TARGET_OPP + "): " + rawHits.length);
  rawHits.forEach(function (a) {
    out.push("     [raw] " + (a.soldOnIso || "?") + "  " + (a.hca || "?") + " / " + (a.customer || "?") +
             "  $" + Number(a.amount || 0).toFixed(2) + "  opp " + (a.opportunityNumber || "?") +
             "  est " + (a.estimateNumber || "?") + "  job " + (a.jobNumber || "?"));
  })
  ;
  if (!rawHits.length) out.push("     -> NOT in the raw read. Cause is (A): readSoldAlerts_ never returned it (ceiling/query/thread handling).");
  // --- (B/C) survive the collapse? on which day? ---
  var kept = collapseResoldAlerts_(raw);
  var keptHits = kept.filter(function (a) {
    return TARGET_RE.test(String(a.customer || "")) || String(a.opportunityNumber || "") === TARGET_OPP;
  })
  ;
  out.push("");
  out.push("  AFTER collapse, Pat Pearson survivors: " + keptHits.length);
  keptHits.forEach(function (a) {
    out.push("     [kept] " + (a.soldOnIso || "?") + "  " + (a.hca || "?") + " / " + (a.customer || "?") +
             "  $" + Number(a.amount || 0).toFixed(2) + (a.resold ? "  (merged/resold)" : ""));
  })
  ;
  if (rawHits.length && !keptHits.length)
    out.push("     -> read but GONE after collapse. Cause is (B): a merge-key collision folded it into another deal.");
  if (keptHits.length) {
    var onDay = keptHits.some(function (a) {
      return String(a.soldOnIso).slice(0, 10) === TARGET_DAY;
    })
    ;
    out.push("     -> survives collapse. On " + TARGET_DAY + "? " + onDay +
             (onDay ? "  (so it SHOULD be in the MTD total — check the date-range filter / lookback)" :
                      "  Cause is (C): it landed on a different day than " + TARGET_DAY + "."));
  }
  // --- context: raw vs kept totals for the target day ---
  var sumDay = function (arr) {
    var n = 0, amt = 0;
    arr.forEach(function (a) {
      if (String(a.soldOnIso).slice(0, 10) === TARGET_DAY) {
        n++;
        amt += Number(a.amount || 0);
      }
    })
    ;
    return n + " deals, $" + amt.toFixed(2);
  };
  out.push("");
  out.push("  " + TARGET_DAY + " raw:      " + sumDay(raw));
  out.push("  " + TARGET_DAY + " collapsed:" + sumDay(kept) + "   (growth day column shows $154,654.72)");
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
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
  }
  catch (err) {
    out.push("SEARCH FAILED: " + (err && err.message ? err.message : String(err)));
    Logger.log(out.join("\n"));
    return {
      ok: false
    };
  }
  out.push("threads returned: " + threads.length);
  let messages = 0, parsed = 0, notHca = 0, noDate = 0, inRange = 0;
  const seenNames = {
  };
  threads.forEach(t => t.getMessages().forEach(msg => {
    messages++;
    const f = parseAlertFields_(msg.getPlainBody());
    const soldBy = f["sold by"] || "";
    if (!soldBy) return;
    parsed++;
    const hca = RECAP_ROSTER.filter(h => normName_(h.name) === normName_(soldBy))[0];
    if (!hca) {
      notHca++;
      seenNames[soldBy] = (seenNames[soldBy] || 0) + 1;
      return;
    }
    const md = String(f["date"] || "").match(/^(\d{1,2})\/(\d{1,2})/);
    const iso = md ? resolveAlertDate_(Number(md[1]), Number(md[2]), msg.getDate())
                   : Utilities.formatDate(msg.getDate(), cfg.timeZone, "yyyy-MM-dd");
    if (!iso) {
      noDate++;
      out.push("  no date: " + soldBy + " / " + (f["customer"] || "?") +
      "  raw date field: " + JSON.stringify(f["date"]));
      return;
    }
    const within = iso >= fromIso && iso <= todayIso;
    if (within) inRange++;
    out.push("  " + (within ? "IN  " : "out ") + iso + "  " + hca.name +
      " — " + (f["customer"] || "?") + "  " + (f["amount"] || ""));
  })
  );
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
  return {
    threads: threads.length, messages: messages, inRange: inRange
  };
}
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {
  };
  /* Serving the 1:1 page from here, rather than from GitHub Pages, is what
  puts Google's sign-in in front of it. See serveOneOnOnePage_. Checked
  before the API key, because this route has no key to check — the reader
  proves who they are to Google instead. */
  if (String(p.page || "") === "1on1") return serveOneOnOnePage_();
  const configuredKey = readScriptProperty_("recapApiKey");
  if (configuredKey && String(p.key || "") !== configuredKey) {
    return jsonOut_({
      ok: false, error: "unauthorized"
    })
    ;
  }
  try {
    /* The sold report is a different question off the same log, so it gets its
    own route rather than bloating the 1:1 payload every page load. */
    if (String(p.report || "") === "sold") {
      const rep = stripSoldIdentity_(buildSoldReportPayload_(p.from || "", p.to || ""));
      if (!configuredKey) {
        rep.unsecured = true;
        rep.warning = "No recapApiKey set — anyone with this URL can read the counts and " +
          "totals below. Customer names are withheld from this route regardless.";
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
  }
  catch (err) {
    return jsonOut_({
      ok: false, error: err && err.message ? err.message : String(err)
    })
    ;
  }
}
function dumpBookedJoin(fromIso, toIso) {
  var tz = bjTz_();
  var yday = Utilities.formatDate(new Date(new Date().getTime() - 864e5), tz, "yyyy-MM-dd");
  var from = String(fromIso || yday).slice(0, 10);
  var to = String(toIso || from).slice(0, 10);
  var sold = readSoldForSameday_(from, to, BOOKED_LOOKBACK_DAYS);
  var booked = readBookedJobs_(BOOKED_LOOKBACK_DAYS);
  var out = ["Booked-job join audit, " + from + " to " + to + ":",
    "sold system jobs: " + sold.length + ", booked-alert jobs on file: " + Object.keys(booked).length];
  sold.forEach(function (s) {
    var b = booked[s.job];
    out.push("  " + (s.customer || "(cust?)") + " / " + s.rep + "  job " + s.job +
      "  sold " + s.soldMD +
      (b ? "  booked: " + b.map(function (x) {
      return x.ranMD + " " + x.ranTime;
    })
    .join(" | ")
         : "  NO booked alert in " + BOOKED_LOOKBACK_DAYS + "d"));
  })
  ;
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
function dumpDailyTab() {
  var ss = SpreadsheetApp.openById("1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww");
  var out = ["Tabs: " + ss.getSheets().map(function (s) {
    return s.getName();
  })
  .join(", ")];
  var sh = ss.getSheetByName("Daily");
  if (!sh) {
    // fall back to the tab that carries the dashboard
    sh = ss.getSheets().filter(function (s) {
      var t = s.getRange(1, 1, Math.min(4, s.getLastRow() || 1), Math.min(6, s.getLastColumn() || 1)).getValues();
      return JSON.stringify(t).indexOf("CM Sales Growth") > -1 || JSON.stringify(t).indexOf("Daily") > -1;
    })
    [0];
  }
  if (!sh) {
    var m = "No Daily / dashboard tab found.";
    Logger.log(m);
    return m;
  }
  out.push("== " + sh.getName() + " ==  (" + sh.getLastRow() + " rows x " + sh.getLastColumn() + " cols)");
  var rng = sh.getDataRange();
  var vals = rng.getValues(), fs = rng.getFormulas();
  function L(n) {
    var s = "";
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  for (var r = 0;
  r < vals.length;
  r++) {
    for (var c = 0;
    c < vals[r].length;
    c++) {
      var v = vals[r][c], f = fs[r][c];
      if ((v === "" || v === null) && !f) continue;
      var a1 = L(c + 1) + (r + 1);
      out.push(a1 + "  " + (f ? "FORMULA " + f : "value " + JSON.stringify(v)));
    }
  }
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
function dumpRecapForm() {
  var id;
  try {
    id = readScriptProperty_(RECAP_FORM_ID_PROP);
  }
  catch (e) {
  }
  if (!id) id = "1-g6cCptLV3gtivpjqbfloGKm_TpggaXMbsJl57zBbzo";
  var form = FormApp.openById(id);
  var out = [];
  out.push("FORM: " + form.getTitle());
  out.push("id: " + id);
  out.push("published: " + form.getPublishedUrl());
  out.push("edit: " + form.getEditUrl());
  out.push("-------- ITEMS (in order) --------");
  form.getItems().forEach(function (it, i) {
    var t = it.getType();
    var line = i + ". [" + t + "] \"" + it.getTitle() + "\"" + (it.getHelpText() ? "  (has help text)" : "");
    var choices = null;
    try {
      if (t === FormApp.ItemType.LIST) choices = it.asListItem().getChoices();
      else if (t === FormApp.ItemType.MULTIPLE_CHOICE) choices = it.asMultipleChoiceItem().getChoices();
      else if (t === FormApp.ItemType.CHECKBOX) choices = it.asCheckboxItem().getChoices();
    }
    catch (e) {
    }
    if (choices) line += "  { " + choices.map(function (c) {
      return c.getValue();
    })
    .join(" | ") + " }";
    out.push(line);
  })
  ;
  out.push("-------- Activity Log --------");
  try {
    var ss = getLogSpreadsheet_().ss;
    var sh = ss.getSheetByName("Activity Log");
    if (sh && sh.getLastColumn()) {
      out.push("headers: " + sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join(" | "));
      out.push("rows of data: " + Math.max(0, sh.getLastRow() - 1));
    }
    else {
      out.push("No 'Activity Log' tab (or it's empty).");
    }
  }
  catch (e) {
    out.push("Activity Log read error: " + e);
  }
  Logger.log(out.join("\n"));
  return out.join("\n");
}
function dumpSignedAlertText() {
  var out = [];
  var query = 'from:alerts@servicetitan.com subject:"Customer Signed Online Estimate Alert" newer_than:30d';
  out.push("query: " + query);
  var threads = [];
  try {
    threads = GmailApp.search(query, 0, 25);
    out.push("GmailApp.search: " + threads.length + " thread(s)");
  }
  catch (err) {
    out.push("GmailApp.search FAILED: " + (err && err.message ? err.message : String(err)));
  }
  try {
    var r = searchAllThreads_(query, signedCeiling_());
    out.push("searchAllThreads_: ok=" + r.ok + " complete=" + r.complete +
      " threads=" + (r.threads ? r.threads.length : "(none)") + (r.error ? " error=" + r.error : ""));
  }
  catch (err) {
    out.push("searchAllThreads_ FAILED: " + (err && err.message ? err.message : String(err)));
  }
  var messages = 0, hits = 0, firstText = "", firstHtml = "";
  threads.forEach(function (t) {
    t.getMessages().forEach(function (msg) {
      if (!/Customer Signed Online Estimate Alert/i.test(String(msg.getSubject() || ""))) return;
      messages++;
      var text = signedAlertText_(msg);
      if (!firstText) {
        firstText = text;
        try {
          firstHtml = String(msg.getBody() || "");
        }
        catch (err) {
          firstHtml = "(getBody threw)";
        }
      }
      var rec = parseSignedAlert_(text);
      if (rec) {
        hits++;
        if (hits <= 5) out.push("  OK    " + (rec.customer || "(no name)") + "  est " +
          rec.estimateNumber + "  opp " + (rec.opportunityNumber || "-") + "  $" + rec.amount);
      }
      else if (messages - hits <= 3) {
        out.push("  MISS  " + JSON.stringify(text.slice(0, 200)));
      }
    })
    ;
  })
  ;
  out.push("signed messages: " + messages + ", parsed: " + hits);
  if (firstText) {
    out.push("--- cleaned text v3 parses ---");
    out.push(JSON.stringify(firstText.slice(0, 400)));
    out.push("--- raw getBody() start, for comparison ---");
    out.push(JSON.stringify(String(firstHtml).slice(0, 400)));
  }
  else {
    out.push("No signed alert bodies were read at all — the search is the problem, not the parser.");
  }
  try {
    var res = readSignedAlerts_(30);
    out.push("readSignedAlerts_(30) -> " + res.alerts.length + " alert(s)");
    res.alerts.slice(0, 5).forEach(function (a) {
      out.push("  " + a.signedOnIso + "  " + (a.customer || "(no name)") +
        "  est " + a.estimateNumber + "  $" + a.amount);
    })
    ;
  }
  catch (err) {
    out.push("readSignedAlerts_ THREW: " + (err && err.message ? err.message : String(err)));
  }
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
function emailGrowthWriteReceipt_(iso, res) {
  const cfg = DAILY_RECAP_CONFIG;
  const label = Utilities.formatDate(
    new Date(Date.parse(iso + "T12:00:00Z")), cfg.timeZone, "EEEE, MMMM d");
  const lines = [];
  let subject;
  if (!res.ok) {
    subject = "Growth sheet NOT written — " + label;
    lines.push("Yesterday's growth column was not written.");
    lines.push("");
    (res.problems || ["unknown reason"]).forEach(p => lines.push("  ! " + p));
    lines.push("");
    lines.push("Nothing was changed. Fix the cause and run writeGrowthSheetDay");
    lines.push("by hand, or wait for tomorrow's run.");
  }
  else {
    subject = "Growth sheet — " + label + " needs a look";
    const dayN = res.written || 0;
    const mtd = res.mtd || {
    };
    lines.push("Yesterday's column was written, but something wants a glance.");
    lines.push("");
    lines.push("  day column: " + dayN + " cell(s) written, " +
      (res.blocked || 0) + " left alone");
    if (mtd.ok) {
      lines.push("  MTD:        " + (mtd.written || 0) + " cell(s), revenue $" +
        formatMoney_((mtd.metrics && mtd.metrics.revenue) || 0));
    }
    else {
      lines.push("  MTD:        REFUSED — " + ((mtd.problems || [])[0] || "see the log"));
    }
    if ((res.blocked || 0) > 0) {
      lines.push("");
      lines.push("Some day cells were left alone because they already held a");
      lines.push("value or a formula. On the nightly run each morning fills a");
      lines.push("fresh tab, so if this is unexpected the tab is probably still");
      lines.push("last week's and needs clearing — otherwise a stale day sits");
      lines.push("behind a correct MTD. Open the " + label.split(",")[0] + " tab and check.");
    }
  }
  lines.push("");
  lines.push("The full run is in the Apps Script execution log.");
  sendEmailSafe_({
    to: [cfg.managerEmail],
    subject: subject,
    body: lines.join("\n")
  })
  ;
}
function enAlreadyNudged_(iso) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("EVENING_NUDGE_SENT") || "";
    var obj = JSON.parse(raw || "{}") || {
    };
    return (obj.date === iso && Array.isArray(obj.names)) ? obj.names : [];
  }
  catch (e) {
    return [];
  }
}
function enCreditedToday_(now) {
  var credited = {
  };
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var plan = buildTodayPlan_(now);
  /* email replies to today's recap thread */
  try {
    var found = findRecapReplies_(plan.dateLabel, null);
    if (found && found.ok) found.replies.forEach(function (r) {
      credited[enNorm_(r.hca.name)] = "email";
    })
    ;
  }
  catch (e1) {
    Logger.log("evening nudge: email check failed (" + e1 + ") — form check still runs.");
  }
  /* form submissions stamped today */
  try {
    var iso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
    var prop = (typeof RECAP_FORM_ID_PROP !== "undefined") ? RECAP_FORM_ID_PROP : "recapFormId";
    var id = "";
    try {
      id = PropertiesService.getScriptProperties().getProperty(prop) || "";
    }
    catch (e2) {
    }
    if (id) {
      FormApp.openById(id).getResponses().forEach(function (resp) {
        if (Utilities.formatDate(resp.getTimestamp(), tz, "yyyy-MM-dd") !== iso) return;
        var hca = "";
        resp.getItemResponses().forEach(function (ir) {
          if (String(ir.getItem().getTitle()).trim() === "HCA") hca = String(ir.getResponse() || "").trim();
        })
        ;
        if (hca && !credited[enNorm_(hca)]) credited[enNorm_(hca)] = "form";
      })
      ;
    }
  }
  catch (e3) {
    Logger.log("evening nudge: form check failed (" + e3 + ") — email replies still counted.");
  }
  return {
    plan: plan, credited: credited
  };
}
function enFormUrl_() {
  try {
    if (typeof recapFormUrl_ === "function") {
      var u = recapFormUrl_();
      if (u) return u;
    }
  }
  catch (e) {
  }
  return "https://docs.google.com/forms/d/e/1FAIpQLSf_A1lXHWCk8tABXIx0r0tDmCHpR7DJay-pLR-jmjtgpJCbyg/viewform";
}
function enRememberNudged_(iso, names) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty("EVENING_NUDGE_SENT", JSON.stringify({
      date: iso, names: names
    })
    );
  }
  catch (e) {
  }
}
function ensureActivityLogRich_(ss) {
  var H = ACTIVITY_LOG_HEADERS_RICH;
  var sheet = ss.getSheetByName(ACTIVITY_LOG_TAB) || ss.insertSheet(ACTIVITY_LOG_TAB);
  var lastCol = sheet.getLastColumn();
  var header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var isRich = header.length === H.length && header[3] === "Customer" && header[H.length - 1] === "Key";
  if (isRich) return sheet;
  var lastRow = sheet.getLastRow();
  var old = (lastRow >= 2 && lastCol) ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  sheet.clear();
  sheet.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight("bold");
  if (old.length) {
    var mapped = old.map(function (r) {
      // old: 0 Date, 1 HCA, 2 Activity, 3 Notes, 4 Logged At, 5 Key
      return [r[0], r[1], r[2], "", "", "", "", "", "", "", "", "", "", (r[3] || ""), (r[4] || ""), (r[5] || "")];
    })
    ;
    sheet.getRange(2, 1, mapped.length, H.length).setValues(mapped);
  }
  SpreadsheetApp.flush();
  return sheet;
}
function ensureRentalSheet_(ss) {
  let sheet = ss.getSheetByName(RENTAL_SHEET_NAME);
  if (sheet) return sheet;
  sheet = ss.insertSheet(RENTAL_SHEET_NAME);
  sheet.getRange("A1").setValue("Comfort Club / rentals — monthly recurring")
    .setFontWeight("bold");
  sheet.getRange("A2").setValue("Rentals confirmed");
  sheet.getRange("B2").setFormula(
    '=COUNTIF(G' + RENTAL_FIRST_DATA_ROW + ':G,"Yes")');
  sheet.getRange("C2").setValue("Monthly recurring");
  sheet.getRange("D2").setFormula(
    '=SUMIF(G' + RENTAL_FIRST_DATA_ROW + ':G,"Yes",H' + RENTAL_FIRST_DATA_ROW + ':H)');
  sheet.getRange("E2").setValue("Contract value (× 96)");
  sheet.getRange("F2").setFormula(
    '=SUMIF(G' + RENTAL_FIRST_DATA_ROW + ':G,"Yes",I' + RENTAL_FIRST_DATA_ROW + ':I)');
  sheet.getRange("D2:F2").setNumberFormat("$#,##0.00");
  /* A row marked Yes with no monthly typed contributes nothing to the sum, so
  the recurring total quietly understates. Counted here rather than left to
  be discovered. */
  sheet.getRange("G2").setValue("Yes, no monthly yet");
  sheet.getRange("H2").setFormula(
    '=COUNTIFS(G' + RENTAL_FIRST_DATA_ROW + ':G,"Yes",H' + RENTAL_FIRST_DATA_ROW + ':H,"")');
  sheet.getRange("A3").setValue(
    "Rentals are booked as deferred revenue, so ServiceTitan shows the sale at $0.00; a " +
    "separate $0.01 is the penny test verifying the card for the monthly payments. " +
    "Cash revenue is reported separately and deliberately excludes " +
    "everything on this tab — that is the policy, not a gap. Contract value is GROSS at " +
    "the 8-year term: not discounted, not churn-adjusted, and it does not net off the " +
    "repair and replacement cost carried by self-warranting.")
    .setFontColor("#666666");
  sheet.getRange(RENTAL_HEADER_ROW, 1, 1, RENTAL_HEADERS.length)
    .setValues([RENTAL_HEADERS])
    .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  sheet.setFrozenRows(RENTAL_HEADER_ROW);
  [110, 140, 190, 260, 110, 110, 90, 110, 130, 260, 300, 140, 0]
    .forEach((w, i) => {
    if (w === 0) sheet.hideColumns(i + 1);
    else sheet.setColumnWidth(i + 1, w);
  })
  ;
  return sheet;
}
function finalizeEntry_(entry) {
  ["customer", "leadSource", "outcome", "deal", "waterHeater", "followUpDate", "objection"]
    .forEach(k => {
    entry[k] = cleanValue_(entry[k]);
  })
  ;
  entry.leadSource = entry.leadSource ? normalizeLeadSource_(entry.leadSource) : "";
  entry.outcome = entry.outcome ? normalizeOutcome_(entry.outcome) : "";
  if (entry.deal) {
    const money = parseDealAmount_(entry.deal);
    entry.dealAmount = money.amount;
    entry.dealIsMonthly = money.monthly;
    entry.dealOneTime = money.oneTime;
    entry.dealMonthly = money.monthlyAmount;
    entry.dealAlternatives = money.alternatives;
    entry.dealMentionsMonthly = money.mentionsMonthly;
  }
  return entry;
}
function findRecapReplies_(dateLabel, sinceDate, lookbackDays, includeAllDates) {
  const cfg = DAILY_RECAP_CONFIG;
  const days = lookbackDays || cfg.replyLookbackDays;
  const query = 'subject:"' + cfg.subjectPrefix + '" newer_than:' + days + "d";
  const out = [];
  /* ok:false so callers can tell "nobody replied" apart from "we could not
  find out". The morning run must never chase people on a failed read. */
  const res = searchAllThreads_(query, RECAP_REPLY_CEILING);
  if (!res.ok) {
    Logger.log("Recap reply search failed: " + res.error);
    return {
      ok: false, complete: false, replies: out
    };
  }
  if (!res.complete) {
    Logger.log("! Recap reply search hit its " + RECAP_REPLY_CEILING +
      "-thread ceiling — some replies were not read.");
  }
  const threads = res.threads;
  /* Which nights were asked about at all. Needed to tell a genuine late reply
  from one sent to the wrong thread — see suspectWrongThread_. */
  const nightsAsked = {
  };
  threads.forEach(thread => {
    let msgs = [];
    try {
      msgs = thread.getMessages();
    }
    catch (err) {
      return;
    }
    msgs.forEach(m => {
      const hit = String(m.getSubject() || "").match(/([A-Za-z]+day,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
      if (hit) {
        const iso = isoFromDateLabel_(hit[1]);
        if (iso) nightsAsked[iso] = true;
      }
    })
    ;
  })
  ;
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
    })
    ;
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
        if (!sinceDate) return;
        // no prior run recorded
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
      })
      ;
    })
    ;
  })
  ;
  return {
    ok: true, complete: res.complete, replies: out
  };
}
function fixAllDateColumns(previewOnly) {
  const cfg = DAILY_RECAP_CONFIG;
  /* Column is by HEADER NAME where the tab has a header worth trusting, and by
  position where the first column is simply the date. Naming it means this
  keeps working if a column is ever inserted. */
  const targets = [
    {
    sheet: cfg.logSheetName,        columns: ["Date", "Follow-up Date"]
  },
  {
    sheet: cfg.complianceSheetName, columns: ["Date"]
  },
  {
    sheet: cfg.jobStatusSheetName,  columns: ["Date"]
  },
  {
    sheet: cfg.emailNotesSheetName, columns: ["Date"]
  },
  {
    sheet: cfg.followUpsSheetName,  columns: ["Due", "Ran On"]
  },
  {
    sheet: "Follow-up Activity",    columns: ["Date"]
  }
  ];
  const book = getLogSpreadsheet_();
  const ss = book.ss;
  const report = [];
  targets.forEach(t => {
    const sheet = ss.getSheetByName(t.sheet);
    if (!sheet) {
      report.push(t.sheet + ": not present, skipped.");
      return;
    }
    const last = sheet.getLastRow();
    if (last < 2) {
      report.push(t.sheet + ": no data rows.");
      return;
    }
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || "").trim());
    t.columns.forEach(name => {
      const idx = header.indexOf(name);
      if (idx === -1) {
        report.push(t.sheet + " / " + name + ": column not found, skipped.");
        return;
      }
      const col = idx + 1;
      const range = sheet.getRange(2, col, last - 1, 1);
      const values = range.getValues();
      let converted = 0, alreadyText = 0, leftAlone = 0;
      const out = values.map(r => {
        const v = r[0];
        if (v === "" || v === null || v === undefined) return [""];
        if (Object.prototype.toString.call(v) === "[object Date]") {
          converted++;
          return [Utilities.formatDate(v, cfg.timeZone, "yyyy-MM-dd")];
        }
        const iso = normalizeSheetDate_(v);
        if (iso) {
          alreadyText++;
          return [iso];
        }
        /* Free text a rep typed — "Monday", "8/10 in one week", "no follow up
        date". Not a date, not ours to rewrite. */
        leftAlone++;
        return [v];
      })
      ;
      if (!previewOnly) {
        /* The WHOLE column below the header, so rows added later are text too.
        Job Status and Email Notes are rebuilt on every refresh, and a format
        applied only to today's rows would be gone by tomorrow. */
        sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat("@");
        range.setValues(out);
      }
      report.push(t.sheet + " / " + name + ": " + converted + " converted, " +
        alreadyText + " already text, " + leftAlone + " left as typed.");
    })
    ;
  })
  ;
  const msg = (previewOnly ? "PREVIEW — nothing written.\n" : "Done.\n") + report.join("\n");
  Logger.log(msg);
  return msg;
}
function fixGrowthMTD() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sheets = ss.getSheets();
  var dayTabs = [];
  sheets.forEach(function (sh) {
    var last = sh.getLastRow();
    if (last < 4) return;
    var colB = sh.getRange(1, 2, last, 1).getValues();
    // labels live in column B
    var revRow = 0;
    for (var i = 0;
    i < colB.length;
    i++) {
      if (String(colB[i][0]).trim().toLowerCase() === "hvac rev") {
        revRow = i + 1;
        break;
      }
    }
    if (revRow) dayTabs.push({
      sh: sh, name: sh.getName(), row: revRow
    })
    ;
  })
  ;
  if (!dayTabs.length) {
    Logger.log("fixGrowthMTD: no 'HVAC Rev' row on any tab — nothing changed.");
    return "";
  }
  var out = [];
  for (var k = 0;
  k < dayTabs.length;
  k++) {
    var parts = [];
    for (var j = 0;
    j <= k;
    j++) {
      // this tab + every earlier tab
      var t = dayTabs[j];
      var nm = "'" + String(t.name).replace(/'/g, "''") + "'";
      parts.push(nm + "!C" + t.row + "+" + nm + "!D" + t.row);
      // C + D = that day's value(s)
    }
    dayTabs[k].sh.getRange(dayTabs[k].row, 5).setFormula("=" + parts.join("+"));
    // column E = MTD
    out.push("  " + dayTabs[k].name + "  ->  MTD in E" + dayTabs[k].row);
  }
  SpreadsheetApp.flush();
  Logger.log("Growth MTD wired to the day columns on " + dayTabs.length + " tab(s):\n" + out.join("\n") +
    "\n\nEach HVAC Rev MTD cell now equals the running sum of the day columns, so it can't drift again. " +
    "Through Wednesday it reads $275,348.70. (Only the HVAC Rev MTD cell was touched — day columns, counts, " +
    "and AVG Ticket were left alone.)");
  return out.join("\n");
}
function fixRecapDateColumns(previewOnly) {
  const book = getLogSpreadsheet_();
  const ss = book.ss;
  const names = [DAILY_RECAP_CONFIG.logSheetName, DAILY_RECAP_CONFIG.complianceSheetName];
  const report = [];
  names.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      report.push(name + ": not found.");
      return;
    }
    const last = sheet.getLastRow();
    if (last < 2) {
      report.push(name + ": no data rows.");
      return;
    }
    const range = sheet.getRange(2, 1, last - 1, 1);
    const values = range.getValues();
    let dates = 0, alreadyText = 0, unreadable = 0;
    const bad = [];
    const out = values.map((r, i) => {
      const v = r[0];
      if (v === "" || v === null || v === undefined) return [""];
      if (v instanceof Date) {
        dates++;
        return [Utilities.formatDate(v, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")];
      }
      const iso = normalizeSheetDate_(v);
      if (iso) {
        alreadyText++;
        return [iso];
      }
      /* Not a date in any form this script recognises. Left untouched on
      purpose — a value nobody can parse is still better than a blank. */
      unreadable++;
      if (bad.length < 5) bad.push("row " + (i + 2) + ": " + JSON.stringify(String(v)));
      return [v];
    })
    ;
    if (!previewOnly) {
      /* Format first. Writing ISO text into a date-formatted column just gets
      it converted straight back, and nothing would change. */
      range.setNumberFormat("@");
      range.setValues(out);
    }
    report.push(name + ": " + dates + " date cell(s) to convert, " +
      alreadyText + " already text, " + unreadable + " unreadable" +
      (bad.length ? " (" + bad.join("; ") + ")" : "") + ".");
  })
  ;
  const msg = (previewOnly ? "PREVIEW — nothing written.\n" : "Done.\n") + report.join("\n") +
    (previewOnly ? "" : "\nColumn A is now plain text on both tabs, so future rows stay text too.");
  Logger.log(msg);
  return msg;
}
function fixRecapForm() {
  var form = FormApp.openById("1-g6cCptLV3gtivpjqbfloGKm_TpggaXMbsJl57zBbzo");
  var BLURB = /only if you did not run a consult\.?/i;
  var NEWCHOICE = "Lost to competitor";
  var changed = [];
  // ---- 1) strip the blurb from any item's help text (wherever it lives) ----
  form.getItems().forEach(function (it) {
    var ht = it.getHelpText();
    if (ht && BLURB.test(ht)) {
      var cleaned = ht.replace(BLURB, "").replace(/\s{2,}/g, " ").trim();
      it.setHelpText(cleaned);
      changed.push('Removed blurb from "' + it.getTitle() + '" — help text now: "' + cleaned + '"');
    }
  })
  ;
  // ---- 2) add "Lost to competitor" to the Objection question ----
  var obj = null;
  form.getItems().forEach(function (it) {
    if (/objection/i.test(it.getTitle())) obj = it;
  })
  ;
  if (!obj) {
    changed.push('NO "Objection" question found — nothing added. (Check the exact title.)');
  }
  else {
    var t = obj.getType();
    var typed = (t === FormApp.ItemType.MULTIPLE_CHOICE) ? obj.asMultipleChoiceItem()
              : (t === FormApp.ItemType.CHECKBOX)        ? obj.asCheckboxItem()
              : (t === FormApp.ItemType.LIST)            ? obj.asListItem()
              : null;
    if (!typed) {
      changed.push('"Objection" is a ' + t + ' field (not choice-based) — cannot add a choice to it.');
    }
    else {
      var vals = typed.getChoices().map(function (c) {
        return c.getValue();
      })
      ;
      if (vals.indexOf(NEWCHOICE) !== -1) {
        changed.push('"' + NEWCHOICE + '" is already an Objection option — left as is.');
      }
      else {
        vals.push(NEWCHOICE);
        var hadOther = (typeof typed.hasOtherOption === "function" && typed.hasOtherOption());
        typed.setChoiceValues(vals);
        if (hadOther && typeof typed.showOtherOption === "function") typed.showOtherOption(true);
        changed.push('Added "' + NEWCHOICE + '" to Objection — options now: ' + vals.join(", ") +
          (hadOther ? "  (+ Other kept)" : ""));
      }
    }
  }
  Logger.log(changed.length ? changed.join("\n") : "No changes made (blurb + option not found).");
  return changed;
}
function fixWednesdayRev() {
  var iso = "2026-08-05";
  // this week's Wednesday
  var data = soldRangeData_(iso, iso);
  if (!data.ok) {
    Logger.log("Engine read failed — try again in a moment.");
    return "";
  }
  var total = 0, n = 0;
  data.rows.forEach(function (r) {
    total += r.amount;
    n++;
  })
  ;
  // TOTAL SOLD, deduped, all buckets
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = ss.getSheetByName("Wednesday");
  if (!sh) {
    Logger.log("No tab named 'Wednesday' — check the tab name.");
    return "";
  }
  var last = sh.getLastRow();
  var colB = sh.getRange(1, 2, last, 1).getValues();
  var revRow = 0;
  for (var i = 0;
  i < colB.length;
  i++) {
    if (String(colB[i][0]).trim().toLowerCase() === "hvac rev") {
      revRow = i + 1;
      break;
    }
  }
  if (!revRow) {
    Logger.log("No 'HVAC Rev' row on the Wednesday tab.");
    return "";
  }
  var wasVal = sh.getRange(revRow, 4).getValue();
  // column D = Wednesday's day cell
  sh.getRange(revRow, 4).setValue(total);
  SpreadsheetApp.flush();
  Logger.log("Wednesday HVAC Rev set to the engine's deduped 8/5 total: $" + total.toFixed(2) +
    " across " + n + " sold (was $" + Number(wasVal || 0).toFixed(2) + ").\n" +
    "The MTD formula re-sums automatically — it should read $275,348.70 through Wednesday now.\n" +
    "If it drifts again, the hourly growth writer is re-inflating it — run removeHourlyGrowthUpdate() to pause it.");
  return total;
}
function formRecapNames_(plan) {
  var out = {
  };
  try {
    var ss = getLogSpreadsheet_().ss;
    var sh = ss.getSheetByName("Form Responses 1");
    if (!sh) {
      ss.getSheets().forEach(function (s) {
        if (sh) return;
        var lc = s.getLastColumn();
        if (lc < 2) return;
        var hdr = s.getRange(1, 1, 1, lc).getValues()[0].map(function (x) {
          return String(x).toLowerCase().trim();
        })
        ;
        if (hdr.indexOf("timestamp") !== -1 && hdr.indexOf("hca") !== -1) sh = s;
      })
      ;
    }
    if (!sh || sh.getLastRow() < 2) return out;
    var vals = sh.getDataRange().getValues();
    var header = vals[0].map(function (x) {
      return String(x).toLowerCase().trim();
    })
    ;
    var tsCol = header.indexOf("timestamp");
    var hcaCol = header.indexOf("hca");
    if (tsCol === -1 || hcaCol === -1) return out;
    var tz = DAILY_RECAP_CONFIG.timeZone;
    for (var i = 1;
    i < vals.length;
    i++) {
      var ts = vals[i][tsCol];
      var nm = String(vals[i][hcaCol] || "").trim();
      if (!nm || Object.prototype.toString.call(ts) !== "[object Date]") continue;
      if (Utilities.formatDate(ts, tz, "yyyy-MM-dd") !== plan.isoDate) continue;
      var roster = matchRosterName_(nm);
      if (roster) out[roster] = (out[roster] || 0) + 1;
    }
  }
  catch (err) {
    Logger.log("formRecapNames_ error: " + (err && err.message ? err.message : err));
  }
  return out;
}
function formulaColsUsed_(formula) {
  const cols = {
  };
  String(formula || "").replace(/(?:^|[^A-Za-z0-9_$])\$?([A-Z]{1,3})\$?(\d+)\b/g,
    (m, c) => {
    cols[c] = true;
    return m;
  })
  ;
  return Object.keys(cols).sort();
}
function fuzzyNameMatch_(sigA, sigB) {
  if (!sigA || !sigB) return false;
  if (!sigA.tokens.length || !sigB.tokens.length) return false;
  const usedB = {
  };
  let total = 0;
  let strong = 0;
  sigA.tokens.forEach(tokenA => {
    for (let i = 0;
    i < sigB.tokens.length;
    i++) {
      if (usedB[i]) continue;
      if (!nameTokensMatch_(tokenA, sigB.tokens[i])) continue;
      usedB[i] = true;
      total++;
      if (sigA.weak.indexOf(tokenA) === -1 && sigB.weak.indexOf(sigB.tokens[i]) === -1) strong++;
      return;
    }
  })
  ;
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
function getLogSpreadsheet_() {
  const cfg = DAILY_RECAP_CONFIG;
  const props = PropertiesService.getScriptProperties();
  const id = cfg.logSpreadsheetId || props.getProperty("logSpreadsheetId");
  if (id) {
    try {
      return {
        ss: SpreadsheetApp.openById(id), created: false
      };
    }
    catch (err) {
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
  })
  ;
  return {
    ss: ss, created: true
  };
}
function growthMtdOn_(sheet, toIso, commit) {
  const fromIso = toIso.slice(0, 8) + "01";
  const out = [];
  out.push("");
  out.push(new Array(58).join("="));
  out.push((commit ? "WRITE" : "PREVIEW — nothing will be written") +
    " MTD — " + fromIso + " through " + toIso);
  const plan = planGrowthMtdWrite_(sheet);
  if (!plan.ok) {
    plan.problems.forEach(p => out.push("  ! " + p));
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: plan.problems
    };
  }
  const m = computeGrowthMetrics_(fromIso, toIso);
  if (m.soldOk && !m.soldComplete) {
    out.push("  ! REFUSING — the sold-alert search hit its ceiling over " +
      fromIso + " to " + toIso + ", so the month's revenue is a partial figure.");
    out.push("    Raise SOLD_ALERT_CEILING and run this again.");
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: ["sold-alert read was incomplete"]
    };
  }
  const values = growthValuesFrom_(m);
  out.push("  sheet: " + plan.sheetName + "   column " + plan.colLetter + " (MTD)");
  out.push("  " + m.recapRows + " consult(s) and " + m.alertList.length +
    " sold alert(s) across " + Object.keys(m.byDay).length + " day(s) of the month.");
  const planned = [], derived = [];
  GROWTH_ROWS.forEach(spec => {
    const row = plan.rows[spec.key];
    const cell = plan.sheet.getRange(row, plan.col);
    const a1 = plan.colLetter + row;
    const formula = String(cell.getFormula() || "");
    if (formula) {
      derived.push("  = " + a1 + "  " + (spec.label + "                       ").slice(0, 23) +
        formula + "   (left alone — it recomputes from the cells above)");
      return;
    }
    planned.push({
      a1: a1, row: row, label: spec.label,
      was: cell.getValue(), value: values[spec.key]
    })
    ;
  })
  ;
  planned.forEach(p => out.push("  " + p.a1 + "  " +
    (p.label + "                       ").slice(0, 23) +
    JSON.stringify(p.value) +
    (p.was === "" || p.was === null || p.was === undefined
      ? "" : "   (was " + JSON.stringify(p.was) + ")")));
  derived.forEach(d => out.push(d));
  if (commit && planned.length) {
    planned.forEach(p => plan.sheet.getRange(p.row, plan.col).setValue(p.value));
    out.push("  wrote " + planned.length + " MTD cell(s).");
  }
  else if (commit) {
    out.push("  nothing to write — every MTD cell in that column holds a formula.");
  }
  else {
    out.push("  (run writeGrowthSheetMtd to commit, or writeGrowthSheetDay to do both)");
  }
  /* A formula that divides by a cell this script does not fill will still read
  wrong afterwards, and the only way to know is to look at it once. */
  if (derived.length) {
    out.push("  Check those formulas once: they should divide one MTD cell by");
    out.push("  another in the SAME column. A formula pointing at the day columns");
    out.push("  will keep showing the week, not the month.");
  }
  Logger.log(out.join("\n"));
  return {
    ok: true, fromIso: fromIso, toIso: toIso,
    written: commit ? planned.length : 0, planned: planned.length,
    derived: derived.length, metrics: values
  };
}
function growthReport_(toIso, fromIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const isRange = !!fromIso && fromIso !== toIso;
  const from = fromIso || toIso;
  const label = Utilities.formatDate(
    new Date(Date.parse(toIso + "T12:00:00Z")), cfg.timeZone, "EEEE, MMMM d, yyyy");
  const out = [];
  out.push(isRange
    ? "Growth sheet MTD — " + from + " through " + toIso + "  (" + label + ")"
    : "Growth sheet — " + label + "  (" + toIso + ")");
  out.push(new Array(58).join("="));
  const m = computeGrowthMetrics_(from, toIso);
  const rate = (d, l) => l ? Math.round(d * 1000 / l) / 10 + "%" : (d ? "—  (" + d + " sold, 0 leads)" : "0%");
  out.push("");
  out.push("  HVAC Marketed Leads     " + m.marketedLeads);
  out.push("  HVAC Marketed Deals     " + m.marketedDeals);
  out.push("  Marketed L2C %          " + rate(m.marketedDeals, m.marketedLeads));
  out.push("  HVAC Tech Flip Leads    " + m.techFlipLeads);
  out.push("  HVAC Tech Flip Deals    " + m.techFlipDeals);
  out.push("  HVAC Tech Flip L2C %    " + rate(m.techFlipDeals, m.techFlipLeads));
  out.push("  NPS Sales Overall       (not in any system here — yours to fill)");
  /* Pre-tax — see the note in buildMorningSalesBrief_. The sheet's own budget
  row includes tax, so this figure is NOT comparable to it until BI supplies
  the tax-inclusive number. */
  out.push("  HVAC Rev                $" + formatMoney_(m.revenue) + "   (PRE-TAX — budget includes tax)");
  out.push("  HVAC AVG Ticket         " +
    (m.sales ? "$" + formatMoney_(m.revenue / m.sales) : "—"));
  out.push("");
  out.push(new Array(58).join("-"));
  out.push("what went into Marketed, so you can split it differently:");
  Object.keys(m.parts).sort().forEach(s =>
    out.push("  " + (s + "                    ").slice(0, 20) +
      "leads " + (m.leads[s] || 0) + "   deals " + (m.deals[s] || 0)));
  if (m.revisitDeals) {
    out.push("  " + ("revisit closes" + "                    ").slice(0, 20) +
      "leads -   deals " + m.revisitDeals + "   (counted as a deal, not a lead)");
  }
  if (!Object.keys(m.parts).length && !m.revisitDeals) out.push("  (nothing)");
  if (isRange) {
    out.push("");
    out.push("by day:");
    const days = Object.keys(m.byDay).sort();
    if (!days.length) out.push("  (nothing in range)");
    days.forEach(d => {
      const b = m.byDay[d];
      out.push("  " + d + "  " +
        Utilities.formatDate(new Date(Date.parse(d + "T12:00:00Z")), cfg.timeZone, "EEE") +
        "   consults " + b.recapRows + "   sold " + b.alerts +
        "   $" + formatMoney_(b.revenue));
    })
    ;
  }
  out.push("");
  out.push("consults reported: " + m.recapRows + "   sold alerts: " + m.alertList.length);
  m.alertList.forEach(a => out.push("    " + a.soldOnIso + "  " + a.hca + " — " +
    (a.customer || "?") + "  $" + formatMoney_(a.amount || 0)));
  /* The two sources must agree on how many sold. When they do not, the recap
  is the incomplete one — it only holds what somebody reported. */
  if (m.recapSold !== m.alertList.length) {
    out.push("");
    out.push("! " + m.recapSold + " sale(s) reported in recaps, " + m.alertList.length +
      " sold alert(s) from ServiceTitan.");
    out.push("  The deal rows above come from recaps, so a sale nobody reported is");
    out.push("  missing from them — but its money IS in HVAC Rev. Check the list above.");
  }
  if (m.readFailed) {
    out.push("");
    out.push("! The recap log could not be read, so leads and deals are all zero: " + m.readFailed);
  }
  if (!m.soldOk) {
    out.push("");
    out.push("! Sold alerts could not be read, so revenue is understated.");
  }
  else if (!m.soldComplete) {
    out.push("");
    out.push("! The sold-alert search hit its ceiling — this is a PARTIAL read.");
    out.push("  HVAC Rev and the sale count above are LOW. Do not write these to");
    out.push("  the sheet; shorten the range and run it again first.");
  }
  Logger.log(out.join("\n"));
  return Object.assign({
    iso: toIso, fromIso: from, isRange: isRange
  },
  m);
}
function growthRowsFor_(grid) {
  const rows = {
  };
  GROWTH_ROWS.forEach(spec => {
    for (let r = 0;
    r < grid.length;
    r++) {
      for (let c = 0;
      c < grid[r].length;
      c++) {
        if (growthLabelKey_(grid[r][c]) === spec.label) {
          rows[spec.key] = r + 1;
          return;
        }
      }
    }
  })
  ;
  return rows;
}
function growthSheetWrite_(commit, isoOverride) {
  /* isoOverride is how the nightly trigger forces yesterday. A date left
  pinned in GROWTH_SHEET_DATE after a manual backfill must not derail the
  automated run — see writeGrowthSheetForYesterday, which always passes one. */
  const iso = isoOverride ? isoOverride : growthTargetIso_();
  const day = growthReport_(iso, null);
  // also prints the numbers
  const out = [];
  out.push("");
  out.push(new Array(58).join("="));
  out.push((commit ? "WRITE" : "PREVIEW — nothing will be written") + " — " + iso);
  /* Checked before the sheet is even opened. A partial read produces a revenue
  figure that is low and looks entirely normal, and this workbook is read as
  final — nothing downstream would ever question it. Of the two ways this
  run can refuse, a missing tab announces itself the moment somebody looks;
  an understated total never does. So it is tested first, and it refuses
  rather than warning and writing anyway. */
  if (day.soldOk && !day.soldComplete) {
    out.push("  ! REFUSING — the sold-alert search hit its ceiling, so revenue is");
    out.push("    a partial figure and would be written as if it were the total.");
    out.push("    Raise SOLD_ALERT_CEILING, then run this again.");
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: ["sold-alert read was incomplete"]
    };
  }
  const plan = planGrowthSheetWrite_(iso);
  if (!plan.ok) {
    plan.problems.forEach(p => out.push("  ! " + p));
    Logger.log(out.join("\n"));
    return {
      ok: false, problems: plan.problems
    };
  }
  out.push("  sheet: " + plan.sheetName + "   column " + plan.colLetter +
    ' (headed "' + plan.day + '")');
  const values = growthValuesFrom_(day);
  const blocked = [];
  const planned = [];
  GROWTH_ROWS.forEach(spec => {
    const row = plan.rows[spec.key];
    const cell = plan.sheet.getRange(row, plan.col);
    const a1 = plan.colLetter + row;
    /* A formula in the cell is somebody's calculation. Overwriting it with a
    number would look like it worked and quietly break every later day. */
    if (String(cell.getFormula() || "")) {
      blocked.push("  - " + a1 + " " + spec.label + " holds a formula — left alone");
      return;
    }
    const existing = cell.getValue();
    const filled = existing !== "" && existing !== null && existing !== undefined;
    if (filled && !GROWTH_SHEET_OVERWRITE) {
      blocked.push("  - " + a1 + " " + spec.label + " already has " +
        JSON.stringify(existing) + " — left alone");
      return;
    }
    planned.push({
      a1: a1, row: row, label: spec.label, value: values[spec.key]
    })
    ;
  })
  ;
  planned.forEach(p => out.push("  " + p.a1 + "  " + (p.label + "                       ").slice(0, 23) +
    JSON.stringify(p.value)));
  blocked.forEach(b => out.push(b));
  if (commit && planned.length) {
    planned.forEach(p => plan.sheet.getRange(p.row, plan.col).setValue(p.value));
    out.push("  wrote " + planned.length + " cell(s).");
  }
  else if (commit) {
    out.push("  nothing to write.");
  }
  else {
    out.push("  (run writeGrowthSheetDay to commit" +
      (blocked.length ? ", or set GROWTH_SHEET_OVERWRITE = true to replace what is there" : "") + ")");
  }
  if (blocked.length && !GROWTH_SHEET_OVERWRITE) {
    out.push("  NPS is never written — it is not in any system here.");
  }
  Logger.log(out.join("\n"));
  /* The MTD column on the same tab, in the same run. The whole reason the day
  column exists is to roll up, and a day written without its month rolled
  forward is a tab that disagrees with itself. */
  const mtd = growthMtdOn_(plan.sheet, iso, commit);
  return {
    ok: true, written: commit ? planned.length : 0,
    planned: planned.length, blocked: blocked.length,
    mtd: mtd
  };
}
function importBI_(preview) {
  var ss = SpreadsheetApp.openById("1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww");
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var leads = readStage_(ss, "All Leads", tz);
  var inst = readStage_(ss, "All Installs", tz);
  var log = [];
  function pct(i, l) {
    return l > 0 ? (i / l) : "";
  }
  log.push("LEADS " + leads.total + " (Marketed " + leads.src.Marketed + ", Tech-Flip " + leads.src["Tech Flip"] + ", Self-Gen " + leads.src["Self Gen"] + ")");
  log.push("INSTALLS " + inst.total + " (Marketed " + inst.src.Marketed + ", Tech-Flip " + inst.src["Tech Flip"] + ", Self-Gen " + inst.src["Self Gen"] + ")");
  var writes = [];
  // {sheet,a1,val,fmt}
  function put(sh, a1, val, fmt) {
    writes.push({
      sh: sh, a1: a1, val: val, fmt: fmt || null
    })
    ;
  }
  /* ---- Daily tab MTD (col D) ---- */
  var daily = ss.getSheetByName("Daily");
  if (daily) {
    var dg = daily.getRange(1, 1, daily.getLastRow(), 2).getValues();
    function drow(pred) {
      for (var r = 0;
      r < dg.length;
      r++) if (pred(String(dg[r][1] || "").trim().toLowerCase())) return r + 1;
      return -1;
    }
    var map = [
      ["total leads", leads.total, null],
      ["total installs", inst.total, null],
      ["hvac tech flip leads", leads.src["Tech Flip"], null],
      ["total l2c %", pct(inst.total, leads.total), "0.0%"],
      ["marketed l2c %", pct(inst.src.Marketed, leads.src.Marketed), "0.0%"],
      ["hvac tech flip l2c %", pct(inst.src["Tech Flip"], leads.src["Tech Flip"]), "0.0%"]
    ];
    map.forEach(function (m) {
      var rr = drow(function (s) {
        return s.indexOf(m[0]) === 0;
      })
      ;
      if (rr > 0) put(daily, "D" + rr, m[1], m[2]);
    })
    ;
  }
  /* ---- L2C tab ---- */
  var l2c = ss.getSheetByName("L2C");
  var missingDays = [];
  if (l2c) {
    var lgv = l2c.getRange(1, 1, l2c.getLastRow(), l2c.getLastColumn()).getValues();
    // daily table header
    var dh = -1, cDate = -1, cLeads = -1, cInst = -1, cL2C = -1;
    for (var r = 0;
    r < lgv.length && dh < 0;
    r++) {
      var row = lgv[r].map(function (x) {
        return String(x || "").trim().toLowerCase();
      })
      ;
      if (row.indexOf("date") > -1 && row.indexOf("leads") > -1 && row.indexOf("installs") > -1) {
        dh = r;
        cDate = row.indexOf("date");
        cLeads = row.indexOf("leads");
        cInst = row.indexOf("installs");
        cL2C = row.indexOf("l2c %");
      }
    }
    function LC(i) {
      var n = i + 1, s = "";
      while (n > 0) {
        var m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    }
    if (dh > -1) {
      var mtdRow = -1;
      for (var r = dh + 1;
      r < lgv.length;
      r++) {
        var a = String(lgv[r][cDate] || "").trim();
        if (a.toLowerCase() === "mtd") {
          mtdRow = r;
          break;
        }
        if (!a) continue;
        var key = l2cLabel_(lgv[r][cDate], tz);
        var ld = leads.byDate[key] || 0, iv = inst.byDate[key] || 0;
        put(l2c, LC(cLeads) + (r + 1), ld);
        put(l2c, LC(cInst) + (r + 1), iv);
        if (cL2C > -1) put(l2c, LC(cL2C) + (r + 1), pct(iv, ld), "0.0%");
      }
      if (mtdRow > -1) {
        put(l2c, LC(cLeads) + (mtdRow + 1), leads.total);
        put(l2c, LC(cInst) + (mtdRow + 1), inst.total);
        if (cL2C > -1) put(l2c, LC(cL2C) + (mtdRow + 1), pct(inst.total, leads.total), "0.0%");
      }
      // days present in the export but not in the L2C table
      Object.keys(leads.byDate).forEach(function (k) {
        var found = false;
        for (var r = dh + 1;
        r < (mtdRow > -1 ? mtdRow : lgv.length);
        r++) {
          if (l2cLabel_(lgv[r][cDate], tz) === k) found = true;
        }
        if (!found) missingDays.push(k);
      })
      ;
    }
    // "by source" block
    var sh2 = -1, sD = -1, sL = -1, sI = -1, sP = -1;
    for (var r = 0;
    r < lgv.length && sh2 < 0;
    r++) {
      var row = lgv[r].map(function (x) {
        return String(x || "").trim().toLowerCase();
      })
      ;
      if (row.indexOf("source") > -1 && row.indexOf("leads") > -1) {
        sh2 = r;
        sD = row.indexOf("source");
        sL = row.indexOf("leads");
        sI = row.indexOf("installs");
        sP = row.indexOf("l2c %");
      }
    }
    if (sh2 > -1) {
      var srcMap = {
        "marketed": "Marketed", "tech flip": "Tech Flip", "self gen": "Self Gen", "total": "Total"
      };
      for (var r = sh2 + 1;
      r < lgv.length;
      r++) {
        var name = String(lgv[r][sD] || "").trim().toLowerCase();
        var key = null;
        Object.keys(srcMap).forEach(function (k) {
          if (name.indexOf(k) === 0) key = srcMap[k];
        })
        ;
        if (!key) continue;
        var ld = key === "Total" ? leads.total : leads.src[key];
        var iv = key === "Total" ? inst.total : inst.src[key];
        put(l2c, LC(sL) + (r + 1), ld);
        if (sI > -1) put(l2c, LC(sI) + (r + 1), iv);
        if (sP > -1) put(l2c, LC(sP) + (r + 1), pct(iv, ld), "0.0%");
      }
    }
  }
  if (preview) {
    log.push("\nPREVIEW — nothing written. " + writes.length + " cell(s):");
    writes.forEach(function (w) {
      log.push("  " + w.sh.getName() + "!" + w.a1 + " = " + (w.fmt ? Math.round(w.val * 1000) / 10 + "%" : w.val));
    })
    ;
    if (missingDays.length) log.push("\nNo L2C row for: " + missingDays.join(", ") + " (add the row, then re-run).");
    var pm = log.join("\n");
    Logger.log(pm);
    return pm;
  }
  writes.forEach(function (w) {
    var rng = w.sh.getRange(w.a1);
    rng.setValue(w.val);
    if (w.fmt) rng.setNumberFormat(w.fmt);
  })
  ;
  SpreadsheetApp.flush();
  log.push("Wrote " + writes.length + " cell(s) across Daily + L2C.");
  if (missingDays.length) log.push("No L2C row for: " + missingDays.join(", ") + " — add those rows and re-run to fill them.");
  var msg = log.join("\n");
  Logger.log(msg);
  return msg;
}
function importRecapFormResponses_(previewOnly) {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    var f0 = "No form built yet — run buildRecapForm() first.";
    Logger.log(f0);
    return f0;
  }
  var form;
  try {
    form = FormApp.openById(id);
  }
  catch (err) {
    var f1 = "Cannot open the recap form: " + (err && err.message ? err.message : String(err));
    Logger.log(f1);
    return f1;
  }
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var responses = form.getResponses();
  var byDate = {
  },
  activities = [], appt = 0, act = 0;
  responses.forEach(function (resp) {
    var iso = Utilities.formatDate(resp.getTimestamp(), tz, "yyyy-MM-dd");
    var ts = resp.getTimestamp().getTime();
    var a = {
    };
    resp.getItemResponses().forEach(function (ir) {
      a[ir.getItem().getTitle()] = ir.getResponse();
    })
    ;
    var hca = String(a["HCA"] || "").trim();
    if (!hca) return;
    var rawAct = a["Additional sales activities"];
    var actList = Array.isArray(rawAct) ? rawAct.slice()
      : (String(rawAct || "").trim() ? [String(rawAct).trim()] : []);
    if (actList.length) {
      var rich = {
        customer: String(a["Customer"] || "").trim(),
        source: String(a["Source"] || "").trim(),
        package: String(a["Package offered"] || "").trim(),
        price: String(a["Price offered"] || "").trim(),
        waterHeater: String(a["Water Heater presented?"] || "").trim(),
        interest: String(a["Level of interest"] || "").trim(),
        outcome: String(a["Outcome"] || "").trim(),
        nextFollowup: String(a["Next follow-up"] || "").trim(),
        objection: String(a["Objection"] || "").trim(),
        objectionNotes: String(a["Additional information on objection"] || "").trim(),
        what: String(a["What did you do?"] || "").trim()
      };
      /* THE FIX: one row per submission. Join the checked types instead of
      copying the same detail once per box. */
      var typeLabel = actList.map(function (s) {
        return String(s).trim();
      })
      .filter(function (s) {
        return s;
      })
      .join(", ");
      activities.push(Object.assign({
        iso: iso, hca: hca, activity: typeLabel,
        key: activityKey_(iso, hca, typeLabel, ts)
      },
      rich));
      act += 1;
      return;
    }
    var customer = String(a["Customer"] || "").trim();
    if (!customer) return;
    var entry = formEntry_(a);
    var bucket = byDate[iso] || (byDate[iso] = {
    })
    ;
    var g = bucket[hca] || (bucket[hca] = {
      hca: {
        name: hca
      },
      entries: []
    })
    ;
    g.entries.push(entry);
    appt++;
  })
  ;
  if (previewOnly) {
    var lines = ["PREVIEW — nothing written. " + responses.length + " response(s): " +
      appt + " appointment(s), " + act + " activity submission(s)."];
    Object.keys(byDate).sort().forEach(function (iso) {
      Object.keys(byDate[iso]).sort().forEach(function (h) {
        byDate[iso][h].entries.forEach(function (e) {
          lines.push("  APPT " + iso + "  " + h + " — " + e.customer + "  [" + e.outcome + "]");
        })
        ;
      })
      ;
    })
    ;
    activities.forEach(function (x) {
      lines.push("  ACT  " + x.iso + "  " + x.hca + " — " + x.activity +
        (x.customer ? "  cust:" + x.customer : ""));
    })
    ;
    var pm = lines.join("\n");
    Logger.log(pm);
    return pm;
  }
  var book = getLogSpreadsheet_();
  var written = 0, skipped = 0;
  Object.keys(byDate).sort().forEach(function (iso) {
    var res = appendRecapRows_(book.ss, {
      isoDate: iso
    },
    byDate[iso]);
    written += res.written;
    skipped += res.skipped;
  })
  ;
  var aRes = writeActivityRows_(book.ss, activities);
  try {
    buildOneOnOneTabs();
  }
  catch (err) {
    Logger.log("1:1 refresh failed: " + err);
  }
  var msg = "Form import: " + responses.length + " response(s) → " +
    written + " appointment row(s) (" + skipped + " already there), " +
    aRes.written + " activity row(s) (" + aRes.skipped + " already there).";
  Logger.log(msg);
  return msg;
}
function install1on1Hourly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refresh1on1Now") ScriptApp.deleteTrigger(t);
  })
  ;
  ScriptApp.newTrigger("refresh1on1Now").timeBased().everyHours(1).create();
  Logger.log("Hourly 1:1 refresh installed — runs refresh1on1Now every hour.");
  return "Hourly 1:1 refresh installed.";
}
function install1on1Nightly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refresh1on1Now") ScriptApp.deleteTrigger(t);
  })
  ;
  ScriptApp.newTrigger("refresh1on1Now").timeBased().everyDays(1).atHour(4).create();
  Logger.log("Nightly 1:1 refresh installed (~4am). Undo with remove1on1Nightly.");
  return "Nightly 1:1 refresh installed (~4am).";
}
function installDailyHourly() {
  // 1) strip old dead triggers + any prior copy of this one
  var kill = {
    writeGrowthDays: 1, previewWriteGrowthDays: 1, writeGrowthSheetForYesterday: 1,
    refreshTodayGrowth: 1, writeGrowthSheetDay: 1, installGrowthTriggers: 1,
    refreshDailyGrowth: 1
  };
  var removed = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (kill[fn]) {
      ScriptApp.deleteTrigger(t);
      removed.push(fn);
    }
  })
  ;
  // 2) one-time: clear the stale BI day-cells and note where they fill from
  var ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
  var daily = ss.getSheetByName("Daily");
  if (!daily) throw new Error("No Daily tab found.");
  var dv = daily.getRange(1, 1, daily.getLastRow(), 2).getValues();
  var cleared = [];
  BI_DAY_LABELS.forEach(function (lab) {
    for (var r = 0;
    r < dv.length;
    r++) {
      if (String(dv[r][1] || "").trim().toLowerCase().indexOf(lab) === 0) {
        daily.getRange("C" + (r + 1)).setValue("").setNote(BI_DAY_NOTE);
        cleared.push(daily.getRange("B" + (r + 1)).getValue());
        break;
      }
    }
  })
  ;
  // 3) install the hourly trigger
  ScriptApp.newTrigger("refreshDailyGrowth").timeBased().everyHours(1).create();
  // 4) dial it now
  var ran = refreshDailyGrowth();
  var msg = "Installed hourly refresh. Removed old trigger(s): " +
    (removed.length ? removed.join(", ") : "none") +
    ".  Cleared BI day-cells (pending upload): " + cleared.join(", ") +
    ".\nFirst run: " + ran;
  Logger.log(msg);
  return msg;
}
function installL2CHourly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "buildL2CTab") ScriptApp.deleteTrigger(t);
  })
  ;
  ScriptApp.newTrigger("buildL2CTab").timeBased().everyHours(1).create();
  Logger.log("Hourly trigger installed for buildL2CTab — the daily scorecard + L2C tabs now refresh every hour. Sold side is live; leads/installs still need the day's BI line.");
  return "installed";
}
function installL2CPlus() {
  var removed = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "buildL2CTab" || fn === "buildL2CTabPlus") {
      ScriptApp.deleteTrigger(t);
      removed.push(fn);
    }
  })
  ;
  ScriptApp.newTrigger("buildL2CTabPlus").timeBased().everyHours(1).create();
  var ran = buildL2CTabPlus();
  var msg = "Installed hourly buildL2CTabPlus. Removed trigger(s): " +
    (removed.length ? removed.join(", ") : "none") + ". Ran once now.\n" + ran;
  Logger.log(msg);
  return msg;
}
function installSameDaySoldTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshSameDaySoldTab") ScriptApp.deleteTrigger(t);
  })
  ;
  ScriptApp.newTrigger("refreshSameDaySoldTab").timeBased().everyHours(1).create();
  Logger.log("Hourly trigger installed for refreshSameDaySoldTab.");
  return "installed";
}
function l2cReport(fromIso, toIso) {
  fromIso = fromIso || "2026-08-01";
  toIso = toIso || "2026-08-04";
  var pad = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  var slash = function (iso) {
    var p = iso.split("-");
    return p[0] + "/" + p[1] + "/" + p[2];
  };
  var shift = function (iso, d) {
    var t = new Date(iso + "T12:00:00Z");
    t.setUTCDate(t.getUTCDate() + d);
    return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
  };
  var year = fromIso.slice(0, 4);
  // Count ServiceTitan alerts by the appointment/install M/D in the body, within [from,to].
  var countByBodyDate = function (gmailSubj, subjectRe, keepRe, dropRe, backDays, dedupeByJob) {
    var q = 'from:alerts@servicetitan.com subject:"' + gmailSubj + '" after:' + slash(shift(fromIso, -(backDays || 3))) + ' before:' + slash(shift(toIso, 3));
    var threads = GmailApp.search(q, 0, 500);
    var by = {
    },
    seen = {
    };
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        var subj = String(m.getSubject() || "");
        if (!subjectRe.test(subj)) return;
        var body = String(m.getPlainBody() || "");
        if (keepRe && !keepRe.test(body)) return;
        if (dropRe && dropRe.test(body)) return;
        var mm = body.match(/(\d{1,2})\/(\d{1,2})/);
        // appointment/install date sits right after the job #
        if (!mm) return;
        var iso = year + "-" + pad(+mm[1]) + "-" + pad(+mm[2]);
        if (iso < fromIso || iso > toIso) return;
        if (dedupeByJob) {
          var jm = body.match(/#\s*(\d{5,})/);
          var key = jm ? jm[1] : (iso + "|" + body.slice(0, 40));
          if (seen[key]) return;
          seen[key] = true;
        }
        by[iso] = (by[iso] || 0) + 1;
      })
      ;
    })
    ;
    return by;
  };
  var installs = countByBodyDate("Completed Form Alert", /Completed Form Alert \[HVAC Sales\]/i, /install/i, /duct cleaning|diag|mainten|\bmaint\b|tune/i, 5, true);
  var leads = countByBodyDate("Booked Job Alert", /Booked Job Alert \[Sales Quote\]/i, null, null, 45, true);
  var soldByDay = {
  };
  var data = soldRangeData_(fromIso, toIso);
  if (data && data.ok) data.rows.forEach(function (r) {
    soldByDay[r.iso] = (soldByDay[r.iso] || 0) + 1;
  })
  ;
  var days = [], d = fromIso;
  while (d <= toIso) {
    days.push(d);
    d = shift(d, 1);
  }
  var tSold = 0, tInst = 0, tLead = 0;
  var lines = ["Lead-2-Cash " + fromIso + " -> " + toIso + "   (compare TOTAL to BI: 8 install, 23 leads, 34.8% L2C)"];
  lines.push("  day          sold  install  leads   L2C%     pipeline");
  days.forEach(function (iso) {
    var s = soldByDay[iso] || 0, i = installs[iso] || 0, l = leads[iso] || 0;
    tSold += s;
    tInst += i;
    tLead += l;
    var l2c = l ? Math.round(i * 1000 / l) / 10 : 0;
    lines.push("  " + iso + "    " + pad2sp_(s) + "     " + pad2sp_(i) + "      " + pad2sp_(l) + "     " +
      (l ? (l2c + "%") : "-") + "       " + (s - i));
  })
  ;
  var totL2C = tLead ? Math.round(tInst * 1000 / tLead) / 10 : 0;
  lines.push("  ------------------------------------------------------------");
  lines.push("  TOTAL         " + pad2sp_(tSold) + "     " + pad2sp_(tInst) + "      " + pad2sp_(tLead) + "     " +
    (tLead ? (totL2C + "%") : "-") + "       " + (tSold - tInst) + "   pipeline");
  lines.push("");
  lines.push("  Leads = booked Sales-Quote appts by appointment day (deduped by job#). If leads or install is off vs the leaderboard, tell me the gap and I'll tune before writing to the sheet.");
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function logRepliesByNight_(ss, replies) {
  const byDate = {
  };
  replies.forEach(r => {
    if (!r.answersIso) return;
    // no date on the thread, nothing to key on
    const bucket = byDate[r.answersIso] || (byDate[r.answersIso] = {
    })
    ;
    const group = bucket[r.hca.name] || (bucket[r.hca.name] = {
      hca: r.hca, entries: [], followUps: ""
    })
    ;
    group.entries = group.entries.concat(r.entries);
    /* A rep who answers in prose rather than under the follow-ups header still
    said something. findRecapReplies_ only sets note when there were no
    entries and no follow-ups, so this cannot displace a real answer —
    without it Joseph's "None, picked up check from Sara Conroy" reached the
    digest and then died there, leaving the sheet blank. */
    const note = isBareNone_(r.note) ? "" : r.note;
    const text = r.followUps || note || "";
    if (text) group.followUps = group.followUps ? group.followUps + "\n" + text : text;
  })
  ;
  let written = 0;
  let skipped = 0;
  let undated = replies.filter(r => !r.answersIso).length;
  const marked = [];
  Object.keys(byDate).sort().forEach(iso => {
    const res = appendRecapRows_(ss, {
      isoDate: iso
    },
    byDate[iso]);
    written += res.written;
    skipped += res.skipped;
    Object.keys(byDate[iso]).forEach(name => {
      const group = byDate[iso][name];
      if (markComplianceLate_(ss, iso, name, group.entries.length, group.followUps)) {
        marked.push(iso + " " + name);
      }
    })
    ;
  })
  ;
  return {
    written: written, skipped: skipped, undated: undated, marked: marked
  };
}
function matchBookedToReplies_(byName, booked, allLogRows, status, askedOn) {
  const claimed = {
  };
  /* No compliance data at all means the caller could not tell us which days
  were asked about — treat every day as fair game rather than silently
  reporting nothing. */
  const haveAskedData = askedOn && Object.keys(askedOn).length > 0;
  let skippedPreLaunch = 0;
  /* Every reported appointment, across all reps, so a single-rep query does
  not make everyone else's work look unclaimed. */
  const reported = (allLogRows || []).map(r => ({
    date: String(r[0]), hca: String(r[1]), customer: String(r[2] || "")
  })
  ).filter(r => r.customer);
  const unclaimed = [];
  booked.forEach(b => {
    const hit = reported.filter(r =>
      r.date === b.appointmentIso && namesMatch_(r.customer, b.customer))[0];
    if (!hit) {
      /* Booked on a day nobody was asked for a recap. Not a gap in reporting,
      and listing it as one buries the days that are. */
      if (haveAskedData && !askedOn[b.appointmentIso]) {
        skippedPreLaunch++;
        return;
      }
      unclaimed.push({
        customer: b.customer, jobNumber: b.jobNumber, jobType: b.jobType,
        appointmentIso: b.appointmentIso, appointmentAt: b.appointmentAt,
        /* Who to ask, when the dispatcher left a note. */
        assignedHint: b.assignedHint, techLead: b.techLead,
        sourceHint: b.sourceHint
      })
      ;
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
  })
  ;
  Object.keys(byName).forEach(name => {
    const h = byName[name];
    h.bookedMatched = (h.rows || []).filter(r => r.booked).length;
    /* Not a fault. A revisit or a self-generated lead has no Sales Quote
    booking behind it, and neither does a customer whose name was typed
    differently. Worth a glance, not a flag. */
    h.reportedNotBooked = (h.rows || [])
      .filter(r => !r.booked && r.customer)
      .map(r => ({
      date: r.date, customer: r.customer, source: r.source, outcome: r.outcome
    })
    );
  })
  ;
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
function moveGrowthWriteTo(hour) {
  const h = Number(hour);
  if (!isFinite(h) || h < 0 || h > 23) {
    throw new Error("Give me an hour 0-23, e.g. moveGrowthWriteTo(5).");
  }
  const cfg = DAILY_RECAP_CONFIG;
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "writeGrowthSheetForYesterday") {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  })
  ;
  ScriptApp.newTrigger("writeGrowthSheetForYesterday")
    .timeBased().everyDays(1).atHour(h)
    .inTimezone(cfg.timeZone).create();
  const msg = "writeGrowthSheetForYesterday: removed " + removed +
    " old trigger(s), created one at " + h + ":00 " + cfg.timeZone + ".\n" +
    "Apps Script fires inside the hour rather than on the minute, so expect it " +
    "any time between " + h + ":00 and " + h + ":59.\n" +
    "Remember to set growthWriteHour to " + h + " in DAILY_RECAP_CONFIG, or a " +
    "future installDailyRecapTriggers() will undo this.";
  Logger.log(msg);
  return msg;
}
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
  })
  ;
  return {
    tokens: tokens, weak: weak
  };
}
function nonSystemRows(fromIso, toIso) {
  var cfg = DAILY_RECAP_CONFIG;
  var today = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  var to = String(toIso || today).slice(0, 10);
  var from = String(fromIso || (today.slice(0, 8) + "01")).slice(0, 10);
  var sheet = getLogSpreadsheet_().ss.getSheetByName(SIGNED_SHEET_NAME);
  if (!sheet) return "No Signed vs Sold tab yet — run refreshSignedVsSold() first.";
  var last = sheet.getLastRow();
  if (last < 2) return "Signed vs Sold is empty.";
  var rows = sheet.getRange(2, 1, last - 1, SIGNED_HEADERS.length).getValues();
  var non = [], rent = [];
  rows.forEach(function (r) {
    var iso = String(normalizeSheetDate_(r[0]) || r[0] || "").slice(0, 10);
    if (!iso || iso < from || iso > to) return;
    if (String(r[11]).indexOf("Superseded") === 0) return;
    var b = hvacBucket_(r[6], r[5]);
    if (b === "system") return;
    var amt = (r[6] !== "" && isFinite(Number(r[6]))) ? Number(r[6]) :
              (isFinite(Number(r[5])) ? Number(r[5]) : 0);
    var rec = {
      iso: iso, hca: String(r[1] || "(rep unknown)"), cust: String(r[2] || ""),
                amt: amt, name: String(r[10] || "")
    };
    (b === "rental" ? rent : non).push(rec);
  })
  ;
  var lines = ["Sub-floor rows (below $" + SYSTEM_MIN_DOLLARS + "), " + from + " to " + to + ":"];
  lines.push(" NON-SYSTEM (revenue, excluded from system figures):");
  if (!non.length) lines.push("   none.");
  non.sort(function (a, b) {
    return b.amt - a.amt;
  })
  ;
  var nonTot = 0;
  non.forEach(function (x) {
    nonTot += x.amt;
    lines.push("   " + x.iso + "  " + x.hca + " / " + x.cust + "  $" + x.amt.toFixed(2) +
      "  \"" + x.name.slice(0, 45) + "\"");
  })
  ;
  if (non.length) lines.push("   " + non.length + " row(s), $" + nonTot.toFixed(2) + ".");
  lines.push(" RENTAL / deferred ($0.00 or penny test):");
  if (!rent.length) lines.push("   none.");
  rent.forEach(function (x) {
    lines.push("   " + x.iso + "  " + x.hca + " / " + x.cust + "  $" + x.amt.toFixed(2) +
      "  \"" + x.name.slice(0, 45) + "\"");
  })
  ;
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function normalizeNumberedReply_(body) {
  const lines = String(body || "").split(/\r?\n/);
  const seen = {
  };
  let hits = 0;
  lines.forEach(line => {
    const m = line.match(/^\s*([1-7])\s*[-–.):]\s*\S/);
    if (m && !seen[m[1]]) {
      seen[m[1]] = true;
      hits++;
    }
  })
  ;
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
  })
  .join("\n");
}
function openBiLeadsBook_(id) {
  try {
    return {
      ss: SpreadsheetApp.openById(id), tempId: ""
    };
  }
  catch (err) {
    /* Not a Sheet. Convert a throwaway copy. */
    const res = UrlFetchApp.fetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "/copy",
      {
      method: "post",
        contentType: "application/json",
        headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({
        name: "TEMP BI leads conversion — safe to delete",
          mimeType: "application/vnd.google-apps.spreadsheet"
      })
      ,
        muteHttpExceptions: true
    })
    ;
    if (res.getResponseCode() >= 300) {
      throw new Error("Drive would not convert the file (" + res.getResponseCode() + "). " +
        "If it is an .xlsx, check the script has Drive access; if it is not a " +
        "spreadsheet at all, check the id.");
    }
    const copyId = JSON.parse(res.getContentText()).id;
    return {
      ss: SpreadsheetApp.openById(copyId), tempId: copyId
    };
  }
}
function parseAlertFields_(body) {
  const flat = String(body || "")
    .replace(/<https?:\/\/[^>]*>/g, " ")     // link targets getPlainBody appends
  .replace(/\s+/g, " ")
    .trim();
  if (!flat) return {
  };
  const alternation = ALERT_FIELD_LABELS
    .map(l => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const finder = new RegExp("(?:^|\\s)(" + alternation + ")\\s*:\\s*", "g");
  const hits = [];
  let m;
  while ((m = finder.exec(flat)) !== null) {
    hits.push({
      label: m[1], from: m.index + m[0].length
    })
    ;
    /* Hand back the separator. The match consumed the space that the NEXT
    label needs for its own (?:^|\s), so "Sold Estimate Alert: Name: ..."
    would otherwise lose Name entirely. */
    finder.lastIndex = Math.max(m.index + 1, m.index + m[0].length - 1);
  }
  const out = {
  };
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length
      ? flat.lastIndexOf(hits[i + 1].label, hits[i + 1].from)
      : flat.length;
    const value = flat.slice(h.from, end < h.from ? flat.length : end).trim();
    const key = h.label.toLowerCase().replace(/\s+/g, " ").trim();
    if (!(key in out)) out[key] = value;
    // first wins, as before
  })
  ;
  return out;
}
function parseDealAmount_(text) {
  const raw = String(text || "");
  if (!raw.trim()) {
    return {
      amount: null, monthly: false, oneTime: null, monthlyAmount: null,
             alternatives: false, mentionsMonthly: false
    };
  }
  const norm = normalizeDealText_(raw);
  /* Split KEEPING the separators, because whether two figures are a choice or a
  bundle is decided by the word BETWEEN them. Testing "or" against the whole
  line marked "Furnace $7,300 and water heater $3,450 - she'll decide Monday
  or Tuesday" as a choice and threw the water heater away. */
  const parts = norm.split(/(,\s+|,$|;|\bor\b|\band\b|&|\+|\n|\/(?=\s*[A-Za-z]))/i);
  /* Phrases that mean a choice on their own, with no "or" between the figures.
  Reps price good/better/best as a comma-separated list and then say so at
  the end: "hp pckg $20,976.73, AC package $20,976.73 all were better or
  best" is three prices and one sale. */
  const choicePhrase = /\ball were\b|\ball three\b|\bbetter or best\b|\bgood,?\s*better,?\s*(and\s+)?best\b|\bvs\.?\b/i.test(norm);
  /* "rental" is the word your reps use for Comfort Club, and it is also an
  ordinary English noun. "Rental unit, replaced blower $850" was reading as
  an $850-a-month contract worth $81,600. A property noun after it means the
  house, not the payment. */
  const rentalProperty = /\brental\s+(propert|unit|house|home|prop|custom|client)/i;
  const isMonthlySegment = s =>
    /\bper month\b|\ba\s+month\b|\bmonthly\b|\bmo\.\b|\bcaas\b|\bcomfort club\b|\bmonth\b\s*$/i.test(s) ||
    (/\brental\b/i.test(s) && !rentalProperty.test(s));
  /* Whether the LINE prices anything in dollars. Decided once for the whole
  line, not per segment: "Job #20481, offered $19,900 and hwt $2,400" splits
  into a segment with a job number and no dollar sign, which then fell
  through to the bare-number path and booked $20,481 of revenue. If the rep
  used dollar signs anywhere, a bare run of digits elsewhere is a job number,
  a serial, a model or a year — not money. Comma grouping and "k" are still
  price markers in their own right and are unaffected. */
  const lineHasDollars = /\$\s*\d/.test(norm);
  const figuresIn = seg => {
    const out = [];
    const push = n => {
      if (isFinite(n) && n > 0) out.push(n);
    };
    /* Dollar-marked figures are unambiguous and win outright. */
    /* The word boundary after k? is what stops "$14,000 kit" reading as
    $14,000,000. */
    (seg.match(/\$\s*\d[\d,]*(?:\.\d+)?\s*k?\b/gi) || []).forEach(d => {
      const m = d.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k?)/i);
      if (!m) return;
      let n = Number(String(m[1]).replace(/,/g, ""));
      if (!isFinite(n)) return;
      if (m[2]) n *= 1000;
      push(n);
    })
    ;
    if (out.length) return out;
    /* No dollar sign on this segment. A "k" suffix is a reliable price marker. */
    (seg.match(/\b\d+(?:\.\d+)?\s*k\b/gi) || []).forEach(x => {
      push(Number(String(x).replace(/\s*k$/i, "")) * 1000);
    })
    ;
    const withoutK = seg.replace(/\b\d+(?:\.\d+)?\s*k\b/gi, " ");
    /* Comma grouping IS a price marker — "water heater 2,850" is a price
    whatever its size — so no floor applies to it. */
    (withoutK.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g) || []).forEach(x => {
      push(Number(String(x).replace(/,/g, "")));
    })
    ;
    /* Bare runs of four or more digits: only when the rep priced nothing in
    dollars, and only above the floor. That is what keeps "American standard
    1400" out of the money columns.
    
    THE TRADE-OFF, stated plainly: a bare four-digit price under $2,000 —
    "hwt swap 1850" — is dropped, and the row is flagged as having no figure
    rather than being given a wrong one. Writing it "$1850" or "1,850"
    records it correctly. */
    if (!lineHasDollars) {
      (withoutK.match(/\b\d{4,}(?:\.\d+)?\b/g) || []).forEach(x => {
        const v = Number(x);
        if (v >= DEAL_FIGURE_FLOOR) push(v);
      })
      ;
    }
    if (out.length) return out;
    /* Last resort, monthly segments only: a bare three-digit number beside a
    monthly marker is the payment. "Comfort Club 249 a month" had no figure
    at all before this. Deliberately NOT gated on lineHasDollars — "Full
    system $18,500 or comfort club 249 a month" prices the cash side in
    dollars and the payment without one, and gating it there dropped the
    Comfort Club sale entirely. Reached only when this segment produced no
    figure by any other route. */
    if (isMonthlySegment(seg)) {
      (withoutK.match(/\b\d{3}(?:\.\d+)?\b/g) || []).forEach(x => {
        const v = Number(x);
        if (v >= 100) push(v);
      })
      ;
    }
    return out;
  };
  /* Figures are collected in RUNS. A run is a stretch of priced segments joined
  to each other by "or" — one choice the customer makes. A new run starts
  wherever the joining word is anything else. "Furnace $7,300 or $8,900
  depending on stage, water heater $3,450" is two runs: pick one of the first
  two, and add the water heater. Summing all three over-reports; taking the
  single highest of all three drops the water heater. Runs get it right. */
  const oneTimeRuns = [];
  const monthlyRuns = [];
  /* Cross-bucket choices: "$18,000 or $249 a month" puts one option in each
  column. Recorded as explicit links so a later reclassification knows which
  one-time run and which monthly run are the same choice — moving a figure
  between columns has to land it in the run it belongs to, or two options get
  added together instead of one being picked. */
  const links = [];
  let sepAlternatives = false;
  let lastFiguredIndex = -1;
  let lastRun = null;
  let lastWasMonthly = false;
  for (let i = 0;
  i < parts.length;
  i += 2) {
    const seg = String(parts[i] || "").trim();
    if (!seg) continue;
    const figs = figuresIn(seg);
    if (!figs.length) continue;
    const monthly = isMonthlySegment(seg);
    const runs = monthly ? monthlyRuns : oneTimeRuns;
    /* Only the separator IMMEDIATELY joining two priced segments counts. An
    intervening unpriced segment breaks the link: in "$18,500 - 3 ton unit,
    $2,600 water heater" the manufactured "or" is followed by "3 ton unit",
    so the water heater is an addition, not an alternative. And "Trane or
    Amana, furnace $8,900 & water heater $2,600" has its "or" between two
    brand names, so it never reaches this test at all. */
    const joinedByOr = lastFiguredIndex === i - 2 &&
      /^\s*(or|either)\s*$/i.test(String(parts[i - 1] || ""));
    /* The "or" counts as a choice even when it joins a cash price to a monthly
    payment — "$249 or $289 per month" and "22k or 19k or $289/mo" are both
    choices — but the two can only share a RUN when they are in the same
    bucket, because a run is aggregated within one column. */
    if (joinedByOr) sepAlternatives = true;
    let run;
    if (joinedByOr && runs.length && runs[runs.length - 1].lastIndex === lastFiguredIndex) {
      run = runs[runs.length - 1];
      run.segments.push(figs);
      run.lastIndex = i;
    }
    else {
      run = {
        segments: [figs], lastIndex: i
      };
      runs.push(run);
    }
    if (joinedByOr && lastRun && lastWasMonthly !== monthly) {
      links.push(monthly ? {
        oneTime: lastRun, monthly: run
      }
      : {
        oneTime: run, monthly: lastRun
      })
      ;
    }
    lastRun = run;
    lastWasMonthly = monthly;
    lastFiguredIndex = i;
  }
  const linkedMonthlyFor = run => {
    for (let i = 0;
    i < links.length;
    i++) if (links[i].oneTime === run) return links[i].monthly;
    return null;
  };
  const linkedOneTimeFor = run => {
    for (let i = 0;
    i < links.length;
    i++) if (links[i].monthly === run) return links[i].oneTime;
    return null;
  };
  /* A unit written AFTER the figures governs them all — "$249 or $289 per
  month" is two payments. A unit written BEFORE does not reach across the
  "or": in "Heat pump $319.99 rental or $1,900 repair" the second option is a
  cash repair, not a second payment. So an unmarked figure is only pulled
  into the monthly column when the marked option comes after it. */
  const linkedTrailingMonthlyFor = run => {
    const m = linkedMonthlyFor(run);
    return (m && m.lastIndex > run.lastIndex) ? m : null;
  };
  const mentionsMonthly = isMonthlySegment(norm);
  /* DELIBERATELY NOT DONE: promoting a lone small figure to the monthly column
  because the word "Comfort Club" or "rental" appears somewhere else on the
  line. "Talked comfort club, $975 repair" became a $975/month contract worth
  $93,600. A payment has to appear in the same clause as the word.
  The cost of that rule is that "Offered comfort club, $249" records $249 as
  cash — off by a rounding error, where the other way round was off by
  $93,000. */
  /* SANITY BAND, both directions. "Rental property $12,000 system" contains the
  word rental and was landing $12,000 in the monthly column — which the
  Summary tab then multiplies by 96 into a $1.15M contract. A figure at or
  above the floor is not a monthly payment. And once a real payment is on the
  line, a figure below the floor is another payment, not a cash job. */
  /*
  * Moves figures between the two columns RUN BY RUN, keeping the choice
  * grouping intact.
  *
  * Moving figure by figure broke it twice. "rental hp $19,000 or rental ac
  * $21,000" is one choice: both figures are too large to be payments, and
  * lifting them out one at a time made two independent runs that were then
  * ADDED to $40,000. And a stray sub-$2,000 cash figure being merged into
  * whatever monthly run happened to be last turned a $1,950 water heater into
  * a $1,950-a-month contract worth $187,200.
  *
  * linkFor finds the run on the other side that is the SAME choice, if any.
  * requireLink skips runs that are not part of a cross-column choice at all.
  */
  const moveBetweenRuns = (fromRuns, toRuns, test, linkFor, requireLink) => {
    for (let r = fromRuns.length - 1;
    r >= 0;
    r--) {
      const run = fromRuns[r];
      const target = linkFor ? linkFor(run) : null;
      if (requireLink && !target) continue;
      const movedSegments = [];
      run.segments.forEach(segFigs => {
        const keep = [], move = [];
        segFigs.forEach(n => {
          (test(n) ? move : keep).push(n);
        })
        ;
        if (move.length) movedSegments.push(move);
        segFigs.length = 0;
        keep.forEach(n => segFigs.push(n));
      })
      ;
      if (!movedSegments.length) continue;
      if (target) movedSegments.forEach(s => target.segments.push(s));
      else toRuns.push({
        segments: movedSegments, lastIndex: run.lastIndex
      })
      ;
      run.segments = run.segments.filter(s => s.length);
      if (!run.segments.length) fromRuns.splice(r, 1);
    }
  };
  moveBetweenRuns(monthlyRuns, oneTimeRuns, n => n >= DEAL_FIGURE_FLOOR, linkedOneTimeFor, false);
  const alternatives = sepAlternatives || choicePhrase;
  /* The other direction, and ONLY between alternatives: "$249 or $289 per
  month" is two payments, but the second one carries the marker and the first
  does not. Restricted to alternatives on purpose — in "$249/mo, $500
  deposit" the $500 is a deposit on a cash job, not a second payment, and
  moving it would report $749 a month. */
  if (monthlyRuns.length && alternatives) {
    /* requireLink: only a figure that is literally the other half of an "or"
    against a payment moves. Anything else that happens to be under the floor
    — a water heater, a repair, a deposit — stays cash. */
    moveBetweenRuns(oneTimeRuns, monthlyRuns, n => n < DEAL_FIGURE_FLOOR, linkedTrailingMonthlyFor, true);
  }
  /* Flattened only AFTER the sanity band has moved figures between the two
  sides, or these would be a stale copy of the pre-move state. */
  const flatten = runs => runs.reduce((all, r) => all.concat.apply(all, r.segments), []);
  const oneTimeFigs = flatten(oneTimeRuns);
  const monthlyFigs = flatten(monthlyRuns);
  const sum = a => a.reduce((t, n) => t + n, 0);
  /* JUDGEMENT CALL — say so if you disagree. Within a choice the HIGHEST option
  is recorded, not the sum and not the average, on the reasoning that it is
  the top of what was actually put in front of the customer. Runs are then
  added, because separate runs are separate items. The row carries
  Alternatives? = Yes so a figure taken from a choice is never mistaken for
  a total.
  A choice PHRASE ("all were better or best", "good better best") governs the
  whole line rather than one join, so it collapses everything to a single
  highest figure. */
  const valueOf = (runs, figs) => {
    if (!figs.length) return null;
    if (choicePhrase) return Math.max.apply(null, figs);
    return sum(runs.map(r => r.segments.length > 1
      ? Math.max.apply(null, [].concat.apply([], r.segments))
      : sum(r.segments[0])));
  };
  const oneTime = valueOf(oneTimeRuns, oneTimeFigs);
  const monthlyAmount = valueOf(monthlyRuns, monthlyFigs);
  /* Legacy keys keep their old meaning for any caller not yet updated. */
  const amount = oneTime !== null ? oneTime : monthlyAmount;
  const monthly = oneTime === null && monthlyAmount !== null;
  return {
    amount: amount,
    monthly: monthly,
    oneTime: oneTime,
    monthlyAmount: monthlyAmount,
    alternatives: alternatives,
    mentionsMonthly: mentionsMonthly
  };
}
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
    DAYS.forEach((d, i) => {
      if (target === -1 && d.indexOf(stem) === 0) target = i;
    })
    ;
    if (target !== -1) {
      const from = new Date(base.getTime());
      for (let i = 1;
      i <= 7;
      i++) {
        const cand = new Date(from.getTime() + i * dayMs);
        if (Number(Utilities.formatDate(cand, tz, "u")) % 7 === target) {
          return Utilities.formatDate(cand, tz, "yyyy-MM-dd");
        }
      }
    }
  }
  return "";
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
    if (!trimmed) {
      lastKey = null;
      return;
    }
    // blank line closes any wrapped value
    const idx = line.indexOf(":");
    const key = idx === -1 ? null : fieldKeyFor_(line.slice(0, idx).toLowerCase());
    if (key === null) {
      /* A field label can arrive without its colon. The objection prompt ends
      in "?" and reps retype or reflow it as "...completing the sale?" with
      the answer beneath, which otherwise loses both the label and the
      answer — and that prompt collects the most useful thing they write. */
      const bare = fieldKeyFor_(trimmed.toLowerCase());
      if (bare !== null && /[?:*]$/.test(trimmed)) {
        if (bare === "dayFollowUps") {
          commit();
          return;
        }
        if (!current) {
          lastKey = null;
          return;
        }
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
    if (key === "dayFollowUps") {
      commit();
      return;
    }
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
    if (!value && !current) {
      lastKey = null;
      return;
    }
    if (!current) current = blankEntry_();
    /* An empty value here does not mean the field went unanswered — a long
    answer wraps onto the following line, leaving the label line bare. Keep
    the field open so the continuation can fill it. */
    if (value) current[key] = value;
    lastKey = key;
  })
  ;
  commit();
  return dedupeEntries_(entries);
}
function polishRecapForm() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form yet — run buildRecapForm() first.");
    return "";
  }
  var form = FormApp.openById(id);
  var title = "HCA Daily Sales Recap";
  form.setTitle(title);
  try {
    DriveApp.getFileById(id).setName(title);
  }
  catch (e) {
  }
  form.setDescription(
    "Log each appointment as you finish it — one quick submit per appointment, about 20 seconds. " +
    "Nothing to report today? You don't need to submit anything.");
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(true);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage(
    "Got it — logged. Running another appointment today? Tap 'Submit another response' to add it.\n\nThanks — Geoff");
  form.getItems().forEach(function (it) {
    var t = String(it.getTitle() || "");
    if (/^customer$/i.test(t)) it.setHelpText("First and last name is plenty.");
    else if (/^price offered$/i.test(t)) it.setHelpText("Just the number — e.g. 18500. Comfort Club: the monthly, e.g. 249/mo.");
    else if (/^next follow-up$/i.test(t)) it.setHelpText("When / what's next — 'call Monday', '8/12', 'waiting on spouse'. Leave blank if none.");
    else if (/^package offered$/i.test(t)) it.setHelpText("The tier you presented. Comfort Club = rental.");
    else if (/water heater presented/i.test(t)) it.setHelpText("Did you show them a water heater?");
  })
  ;
  var msg = 'Form polished — title "HCA Daily Sales Recap", friendlier copy, progress bar, and a "Submit another" link.\n' +
    "  " + form.getPublishedUrl() + "\n\n" +
    "COLORS + LOGO (the one part code can't do — 30 seconds):\n" +
    "  1. Open the form's EDIT link.\n" +
    "  2. Tap the paint-palette icon at the top right.\n" +
    "  3. Pick a header color (CM Heating red/blue), and under Header choose 'Add image' for the logo.\n" +
    "  4. Optionally set the font style. Done — it saves itself.";
  Logger.log(msg);
  return form.getPublishedUrl();
}
function previewDoubleApprovals() {
  ST_REG_CACHE = null;
  var res = readSoldAlerts_(SOLD_TODAY_LOOKBACK_DAYS);
  if (!res.ok) {
    var f = "Sold-alert read failed — see the log.";
    Logger.log(f);
    return f;
  }
  var groups = stDoubleApprovals_(collapseResoldAlerts_(res.alerts));
  var lines = ["PREVIEW — nothing written, nothing emailed. " +
    SOLD_TODAY_LOOKBACK_DAYS + "-day window, " + groups.length + " customer(s) with multiple approvals:"];
  if (!groups.length) lines.push("  (none — every customer has a single approval)");
  groups.forEach(function (g) {
    lines.push("  " + (g.resolved ? "ok      " : "⚠ OPEN  ") + g.customer +
      (g.hca ? " (" + g.hca + ")" : "") + " — " + g.summary);
  })
  ;
  lines.push("");
  lines.push("OPEN pairs banner on the tab and email you once. Resolve with the three lists at the top of this file, or the Rentals register.");
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function previewEveningFormNudge() {
  var now = new Date();
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var iso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var r = enCreditedToday_(now);
  var already = enAlreadyNudged_(iso);
  var lines = ["PREVIEW — nothing sent. Scheduled today: " + r.plan.working.length + "."];
  if (!r.plan.working.length) {
    lines.push("  (nobody scheduled today — the nudge would do nothing)");
  }
  else {
    r.plan.working.forEach(function (h) {
      var cr = r.credited[enNorm_(h.name)];
      if (cr) lines.push("  ok      " + h.name + " — filed by " + cr);
      else if (already.indexOf(enNorm_(h.name)) >= 0) lines.push("  sent    " + h.name + " — already nudged today");
      else lines.push("  NUDGE   " + h.name + " — nothing in yet today");
    })
    ;
  }
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function previewSameDaySold() {
  var m = sameDaySoldMonthData_();
  if (!m.ok) {
    Logger.log("PREVIEW — sold-alert read failed.");
    return "read failed";
  }
  var lines = ["PREVIEW — nothing written. " + m.fromIso + " → " + m.toIso +
    (m.complete === false ? "  (PARTIAL read)" : "")];
  Object.keys(m.days).sort().forEach(function (iso) {
    var d = m.days[iso];
    lines.push("  " + iso + "  total " + d.total + " · same-day " + d.same +
      " · follow-up " + d.follow + (d.unknown ? " · unknown " + d.unknown : "") +
      " · $" + Math.round(d.dollars));
  })
  ;
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function previewTomorrowChase() {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var tomorrow = new Date(Date.now() + 86400000);
  var owed = whoStillOwesYesterday_(tomorrow);
  var names = Object.keys(owed);
  var plan = buildTodayPlan_(new Date());
  var lines = ["PREVIEW — nothing sent. If the 6am send ran " +
    Utilities.formatDate(tomorrow, tz, "EEE M/d") + " with what's in right now:"];
  if (!plan.working.length) {
    lines.push("  (nobody is scheduled today, so no one can owe today)");
  }
  else if (!names.length) {
    lines.push("  Nobody gets chased — everyone scheduled today has filed (form or email).");
  }
  else {
    names.forEach(function (n) {
      lines.push("  CHASE " + n + " — no form entry and no email reply for " + owed[n]);
    })
    ;
    lines.push("  (A rep who files tonight drops off this list automatically.)");
  }
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function probeRecapDates() {
  const book = getLogSpreadsheet_();
  const sh = book.ss.getSheetByName(DAILY_RECAP_CONFIG.logSheetName);
  const n = Math.min(3, Math.max(0, sh.getLastRow() - 1));
  sh.getRange(2, 1, n, 1).getValues().forEach((r, i) => {
    Logger.log("row " + (i + 2) +
      " | type=" + (r[0] instanceof Date ? "Date" : typeof r[0]) +
      " | String()=" + String(r[0]) +
      " | normalized=" + normalizeSheetDate_(r[0]));
  })
  ;
}
function readBiLeads_OLD_20260821() {
  if (!BI_LEADS_SHEET_ID) return {
  };
  const out = {
    byJob: {
    },
    byCustomerDate: {
    },
    rows: 0
  };
  let temp = "";
  try {
    const opened = openBiLeadsBook_(BI_LEADS_SHEET_ID);
    const ss = opened.ss;
    temp = opened.tempId;
    const sheet = BI_LEADS_TAB ? ss.getSheetByName(BI_LEADS_TAB) : ss.getSheets()[0];
    if (!sheet || sheet.getLastRow() < 2) {
      trashBiTemp_(temp);
      return {
      };
    }
    const grid = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const head = {
    };
    grid[0].forEach((h, i) => {
      head[String(h || "").trim().toLowerCase()] = i;
    })
    ;
    const col = (...names) => {
      for (let i = 0;
      i < names.length;
      i++) if (names[i] in head) return head[names[i]];
      return -1;
    };
    const cJob = col("job.number", "jobnumber", "job number");
    const cRep = col("techname", "tech name", "soldbyname");
    const cType = col("lead type", "leadtype");
    const cCust = col("customer.name", "customer");
    const cAppt = col("lastapptdate", "appointment date", "est");
    const cStat = col("jobstatus", "job status");
    if (cJob === -1 && cCust === -1) {
      trashBiTemp_(temp);
      return {
      };
    }
    const iso = v => v instanceof Date
      ? Utilities.formatDate(v, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")
      : String(v || "").trim().slice(0, 10);
    for (let r = 1;
    r < grid.length;
    r++) {
      const row = grid[r];
      const rec = {
        rep: cRep === -1 ? "" : String(row[cRep] || "").replace(/\s+/g, " ").trim(),
        leadType: cType === -1 ? "" : String(row[cType] || "").trim(),
        jobStatus: cStat === -1 ? "" : String(row[cStat] || "").trim(),
        customer: cCust === -1 ? "" : String(row[cCust] || "").trim(),
        apptIso: cAppt === -1 ? "" : iso(row[cAppt])
      };
      if (!rec.rep && !rec.leadType && !rec.jobStatus) continue;
      const job = cJob === -1 ? "" : String(row[cJob] || "").trim();
      if (job) out.byJob[job] = rec;
      if (rec.customer) {
        out.byCustomerDate[normName_(rec.customer)] = rec;
        if (rec.apptIso) out.byCustomerDate[normName_(rec.customer) + "|" + rec.apptIso] = rec;
      }
      out.rows++;
    }
  }
  catch (err) {
    Logger.log("BI leads lookup unavailable, Job Status built without it: " +
      (err && err.message ? err.message : String(err)));
    trashBiTemp_(temp);
    return {
    };
  }
  trashBiTemp_(temp);
  return out;
}
function readBookedJobAlerts_(fromIso, toIso, days) {
  const out = [];
  let threads = [];
  /* Booked well ahead of the appointment, so the search window has to be much
  wider than the window being reported on. */
  const lookback = Math.max(30, Math.min(180, (Number(days) || 14) + 90));
  const res = searchAllThreads_(
    'from:alerts@servicetitan.com subject:"Booked Job Alert [Sales Quote]" ' +
    "newer_than:" + lookback + "d", BOOKED_ALERT_CEILING);
  if (!res.ok) {
    Logger.log("Booked alert search failed: " + res.error);
    return {
      ok: false, complete: false, booked: out
    };
  }
  threads = res.threads;
  threads.forEach(t => t.getMessages().forEach(msg => {
    if (String(msg.getSubject() || "").indexOf("Booked Job Alert") === -1) return;
    const parsed = parseBookedAlert_(msg.getPlainBody(), msg.getDate());
    if (!parsed || !parsed.customer) return;
    if (parsed.appointmentIso < fromIso || parsed.appointmentIso > toIso) return;
    out.push(parsed);
  })
  );
  /* The same job can alert more than once when an appointment is moved. */
  const seen = {
  },
  deduped = [];
  out.forEach(b => {
    const key = b.jobNumber || (normName_(b.customer) + "|" + b.appointmentIso);
    if (seen[key]) return;
    seen[key] = true;
    deduped.push(b);
  })
  ;
  if (!res.complete) {
    Logger.log("! Booked alert search hit its " + BOOKED_ALERT_CEILING +
      "-thread ceiling — appointments before that point are missing.");
  }
  return {
    ok: true, complete: res.complete, booked: deduped
  };
}
function readBookedJobs_(days) {
  var map = {
  };
  var msgs = bjSearch_('from:alerts@servicetitan.com subject:"Booked Job Alert" newer_than:' +
    Math.max(1, days) + "d", 400);
  msgs.forEach(function (msg) {
    var year = Utilities.formatDate(msg.getDate(), bjTz_(), "yyyy");
    var text = bjText_(msg);
    // "# 408706722 8/4 2:00 PM"
    var m = text.match(/#\s*(\d{6,})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!m) return;
    var job = m[1];
    var rec = {
      ranIso: bjIsoFromMD_(m[2], year), ranMD: m[2], ranTime: m[3], at: msg.getDate()
    };
    (map[job] = map[job] || []).push(rec);
  })
  ;
  return map;
}
function readComboInstalls_() {
  const id = DAILY_RECAP_CONFIG.comboLogSpreadsheetId;
  if (!id) return {
    ok: true, installs: [], cancellations: [], skipped: "no COMBO LOG id configured"
  };
  let ss;
  try {
    ss = SpreadsheetApp.openById(id);
  }
  catch (err) {
    Logger.log("COMBO LOG unreachable: " + err);
    return {
      ok: false, installs: [], cancellations: []
    };
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
        for (let r = 1;
        r < values.length;
        r++) {
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
          })
          ;
        }
        return;
      }
      const iLast = col("LAST"), iFirst = col("FIRST"), iDate = col("DATE");
      if (iLast === -1 && iFirst === -1) return;
      // not a job sheet
      /* Tabs are classified by name rather than hardcoded, because the log is
      reorganised by hand. TBD holds jobs with no date yet — permits,
      equipment, customer availability — which are the ones worth raising. */
      const isTbd = /\bTBD\b/i.test(name);
      const isCompleted = /COMPLET/i.test(name);
      for (let r = 1;
      r < values.length;
      r++) {
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
          /* Needed to judge whether a permit is actually late — the answer is
          entirely jurisdiction-dependent. Additive: existing callers ignore it. */
          jurisdiction: at(col("JURISDICTION")),
          /* The COMBO LOG carries all trades. Growth reporting is HVAC only, so
          every consumer must be able to tell them apart. Additive fields. */
          department: at(col("DEPARTMENT")),
          mechanical: at(col("MECHANICAL")),
          /* On the TBD tab this column is repurposed as a live action note —
          "EMAILED JAY 7/29 AL", "AMBER IS WORKING ON THIS 7/29 AL" — which
          is the most current word on the job anywhere. */
          jobCompleted: at(col("JOB COMPLETED")),
          /* The COMPLETED tab is not the only signal. 199 of 227 sampled rows
          carry "DONE-LW" / "DONE-SK" / "DONE AL 7/21" in JOB COMPLETED, and 52
          of those still read "REQUESTED" in PERMIT NOTES — the permit cell is
          simply never updated once the crew finishes. Reading only the tab name
          reports every one of those as an overdue permit.
          Prefix test on purpose: on the TBD tab this column is repurposed as a
          live action note ("AMBER IS WORKING ON THIS 7/29 AL", "EMAILED JAY"),
          and genuine holds read "Not completed - waiting for...". Neither
          starts with DONE, so both correctly stay open. */
          isDone: /^\s*DONE\b/i.test(at(col("JOB COMPLETED"))),
          /* The office flags commercial-zoned property in JOB NOTES as the bare
          word COMMERCIAL — a dentist office or storefront in a house. That is
          the only place zoning is recorded anywhere. */
          isCommercial: /\bCOMMERCIAL\b/i.test(at(col("JOB NOTES"))),
        sourceSheet: name
        })
        ;
      }
    }
    catch (err) {
      Logger.log("COMBO LOG sheet skipped: " + err);
    }
  })
  ;
  return {
    ok: true, installs: installs, cancellations: cancellations
  };
}
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
  }
  catch (err) {
    Logger.log("Email note search failed for " + name + ": " + err);
    return [];
  }
  const notes = [];
  threads.forEach(thread => {
    let messages = [];
    try {
      messages = thread.getMessages();
    }
    catch (err) {
      return;
    }
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
    })
    ;
  })
  ;
  notes.sort((a, b) => b.received - a.received);
  return notes.slice(0, 4);
}
function readExceptionsForDate_(isoDate) {
  const cfg = DAILY_RECAP_CONFIG;
  const result = {
    ok: false, error: "", count: 0, byName: {
    }
  };
  try {
    const ss = SpreadsheetApp.openById(cfg.exceptionsSpreadsheetId);
    const sheet = cfg.exceptionsSheetName ? ss.getSheetByName(cfg.exceptionsSheetName) : ss.getSheets()[0];
    if (!sheet) throw new Error("Sheet not found: " + cfg.exceptionsSheetName);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      result.ok = true;
      return result;
    }
    const header = values[0].map(h => String(h || "").trim().toLowerCase());
    const cDate = indexOfHeader_(header, ["date"]);
    const cName = indexOfHeader_(header, ["hca name", "hca", "name"]);
    const cType = indexOfHeader_(header, ["type"]);
    const cNote = indexOfHeader_(header, ["notes", "note"]);
    if (cDate === -1 || cName === -1 || cType === -1) {
      throw new Error("Expected Date / HCA Name / Type columns, got: " + header.join(", "));
    }
    for (let i = 1;
    i < values.length;
    i++) {
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
  }
  catch (err) {
    result.ok = false;
    result.error = err && err.message ? err.message : String(err);
    Logger.log("Schedule Exceptions read failed: " + result.error);
  }
  return result;
}
function readExistingKeys_(sheet, width, colA, colB) {
  const seen = {
  };
  const last = sheet.getLastRow();
  if (last < 2) return seen;
  const values = sheet.getRange(2, 1, last - 1, width).getValues();
  values.forEach(row => {
    if (colA === undefined) {
      const k = String(row[width - 1] || "").trim();
      if (k) seen[k] = true;
    }
    else {
      const a = String(row[colA] || "").trim();
      const b = String(row[colB] || "").trim().toLowerCase();
      if (a && b) seen[a + "|" + b] = true;
    }
  })
  ;
  return seen;
}
function readInstallCompletions_(days) {
  const out = [];
  const res = searchAllThreads_(
    'from:alerts@servicetitan.com subject:"Completed Form Alert" newer_than:' +
    Math.max(1, days) + "d", COMPLETION_ALERT_CEILING);
  if (!res.ok) {
    Logger.log("Completion alert search failed: " + res.error);
    return {
      ok: false, complete: false, completions: out
    };
  }
  const threads = res.threads;
  threads.forEach(t => t.getMessages().forEach(msg => {
    /* Installs only. Completed Form Alerts also fire for [HVAC COD Service],
    [Fireplace COD Service] and [HVAC Maintenance Plan] — service calls, not
    installs, and counting one as "installed" would be worse than missing
    it. Matching on "Sales" rather than "HVAC Sales" so a fireplace or other
    sales business unit is picked up if one exists. */
    if (String(msg.getSubject() || "").indexOf("Sales") === -1) return;
    const body = String(msg.getPlainBody() || "");
    /* The trailing number was always matched and thrown away — it is the
    ServiceTitan job number, and it is the cleanest evidence of how many REAL
    jobs a customer has. Two genuine jobs file two Completed Form Alerts with
    two different numbers; a re-quote of one job files one. Capturing it costs
    nothing and gives a third independent check alongside sold alerts and
    COMBO LOG rows. */
    const m = body.match(/^[ \t]*(\d{1,2}\/\d{1,2})\s+\d{1,2}:\d{2}\s*[AP]M\s+(.+?)\s+(\d{2,})\s/m);
    if (!m) return;
    const desc = (body.match(/INSTALL DESCRIPTION:\s*(.+)/i) || [])[1] || "";
    out.push({
      customer: m[2].replace(/\(M\)\s*$/i, "").trim(),
      installedOn: m[1],
      jobNumber: m[3],
      description: String(desc).trim(),
      received: msg.getDate()
    })
    ;
  })
  );
  if (!res.complete) {
    Logger.log("! Completion alert search hit its " + COMPLETION_ALERT_CEILING +
      "-thread ceiling — installs before that point are missing.");
  }
  return {
    ok: true, complete: res.complete, completions: out
  };
}
function readPausedHcas_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(PAUSED_HCAS_PROPERTY);
    if (!raw) return {
    };
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {
    };
  }
  catch (err) {
    /* Unreadable means nobody is paused, which sends an email too many rather
    than too few. A missing recap is invisible; an extra one gets answered. */
    Logger.log("Could not read the paused list, treating everyone as active: " + err);
    return {
    };
  }
}
function readRecapKeys_(sheet) {
  const seen = {
  };
  const last = sheet.getLastRow();
  if (last < 2) return seen;
  const col = recapKeyColumn_();
  sheet.getRange(2, col, last - 1, 1).getValues().forEach(r => {
    const k = String(r[0] || "").trim();
    if (k) seen[k] = true;
  })
  ;
  return seen;
}
function readSameDaySplit_(ss, dayLabel) {
  var sheets = ss.getSheets();
  for (var s = 0;
  s < sheets.length;
  s++) {
    var t = sheets[s];
    if (t.getLastRow() < 2 || t.getLastColumn() < 3) continue;
    var g = t.getRange(1, 1, t.getLastRow(), Math.min(t.getLastColumn(), 12)).getDisplayValues();
    var hr = -1, cDate = -1, cTot = -1, cSame = -1, cFoll = -1, cUnk = -1;
    for (var r = 0;
    r < g.length && hr < 0;
    r++) {
      var row = g[r].map(function (x) {
        return String(x || "").trim().toLowerCase();
      })
      ;
      if (row.indexOf("date") > -1 && row.indexOf("total sold") > -1 &&
          (row.indexOf("same-day") > -1 || row.indexOf("same day") > -1)) {
        hr = r;
        for (var c = 0;
        c < row.length;
        c++) {
          if (row[c] === "date") cDate = c;
          else if (row[c] === "total sold") cTot = c;
          else if (row[c] === "same-day" || row[c] === "same day") cSame = c;
          else if (row[c] === "follow-up" || row[c] === "follow up") cFoll = c;
          else if (row[c] === "unknown") cUnk = c;
        }
      }
    }
    if (hr < 0 || cDate < 0 || cTot < 0) continue;
    // not this tab; keep looking
    for (var r2 = hr + 1;
    r2 < g.length;
    r2++) {
      var lbl = String(g[r2][cDate] || "").trim();
      if (lbl && lbl.toLowerCase() !== "mtd" && lbl.indexOf(dayLabel) > -1) {
        return {
          total: Number(g[r2][cTot]) || 0,
          sameDay: cSame > -1 ? (Number(g[r2][cSame]) || 0) : 0,
          followUp: cFoll > -1 ? (Number(g[r2][cFoll]) || 0) : 0,
          unknown: cUnk > -1 ? (Number(g[r2][cUnk]) || 0) : 0
        };
      }
    }
  }
  return null;
}
function readSignedAlerts_(days) {
  var out = [];
  var res = searchAllThreads_(
    'from:alerts@servicetitan.com subject:"Customer Signed Online Estimate Alert" newer_than:' +
    Math.max(1, days) + "d", signedCeiling_());
  if (!res.ok) {
    Logger.log("readSignedAlerts_ v3: SEARCH FAILED — " + res.error);
    return {
      ok: false, complete: false, alerts: out
    };
  }
  var read = 0, parsed = 0, missed = [];
  res.threads.forEach(function (t) {
    t.getMessages().forEach(function (msg) {
      /* A thread can hold several alerts. Gmail's search view only shows the
      first few messages of a thread — getMessages() returns all of them, and
      four of Monday's five signed alerts were stacked in ONE thread. */
      var subj = String(msg.getSubject() || "");
      if (!/Customer Signed Online Estimate Alert/i.test(subj)) return;
      read++;
      var rec = parseSignedAlert_(signedAlertText_(msg));
      if (!rec) {
        if (missed.length < 5) missed.push(subj + " @ " +
          Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "M/d HH:mm"));
        return;
      }
      parsed++;
      rec.signedOnIso = Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
      rec.received = msg.getDate();
      out.push(rec);
    })
    ;
  })
  ;
  /* Said out loud every single run. A silent zero is what cost us the last one. */
  Logger.log("readSignedAlerts_ v3: " + res.threads.length + " thread(s), " + read +
    " signed message(s), " + parsed + " parsed, " + (read - parsed) + " missed." +
    (read && !parsed ? "  NOTHING PARSED — run dumpSignedAlertText()." : ""));
  if (missed.length) Logger.log("  missed: " + missed.join(" | "));
  if (!res.complete) {
    Logger.log("! Hit the " + signedCeiling_() + "-thread ceiling — PARTIAL read, " +
      "every total from it is low.");
  }
  return {
    ok: true, complete: res.complete, alerts: out
  };
}
/* ===== Count manager consult sales toward HVAC revenue (restored 8/14) =====
   Lyle Jones, Aaron Johnson and Geoff Simons sell consults that count toward
   HVAC revenue but do NOT file a daily recap, so they are deliberately NOT on
   RECAP_ROSTER. readSoldAlerts_ resolves the "Sold by" name through
   soldSellerName_ below, which also strips ServiceTitan "(Office)" tags and
   falls back to the Combo Log nickname map (COMBO_REP_ALIASES). */
const REVENUE_ALSO_SELLERS = [
  { name: "Lyle Jones",    aliases: [] },
  { name: "Aaron Johnson", aliases: [] },
  { name: "Geoff Simons",  aliases: ["Geoffrey Simons"] }
];

/* Growth headline qualification only. Other recap/sold/1:1 readers keep
   their existing definitions. Strictly greater than $2,000 means a $2,000
   alert is excluded along with smaller accessories and service work. */
var GROWTH_HVAC_SOLD_MIN_DOLLARS = 2000;
function growthSoldSellerAllowed_(name) {
  var key = normName_(name).replace(/\s+(office|field|admin|sales)$/, "").trim();
  if (!key) return false;
  for (var i = 0; i < RECAP_ROSTER.length; i++) {
    if (normName_(RECAP_ROSTER[i].name) === key) return true;
  }
  for (var j = 0; j < REVENUE_ALSO_SELLERS.length; j++) {
    var seller = REVENUE_ALSO_SELLERS[j];
    if (normName_(seller.name) === key) return true;
    var aliases = seller.aliases || [];
    for (var k = 0; k < aliases.length; k++) {
      if (normName_(aliases[k]) === key) return true;
    }
  }
  return false;
}

function growthSoldQualification_(alert) {
  var amount = Number(alert && alert.amount);
  if (!growthSoldSellerAllowed_(alert && alert.hca)) {
    return { included: false, reason: "seller", amount: isFinite(amount) ? amount : 0 };
  }
  if (!isFinite(amount) || amount <= GROWTH_HVAC_SOLD_MIN_DOLLARS) {
    return { included: false, reason: "amount", amount: isFinite(amount) ? amount : 0 };
  }
  return { included: true, reason: "", amount: amount };
}

/* Growth re-quotes use the CURRENT sold alert. The global collapse helper
   intentionally keeps an earlier in-month sold date for other reports, so it
   is not used here. Groups link by opportunity, job, or estimate (with the
   customer included where appropriate), then keep the latest received alert
   with its own amount and sold date. */
function growthCollapseLatestSoldAlerts_OLD_20260821(alerts) {
  var parent = alerts.map(function (_, i) { return i; });
  var firstSeen = {};
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function link(key, i) {
    if (!key) return;
    if (firstSeen[key] === undefined) {
      firstSeen[key] = i;
      return;
    }
    var a = find(firstSeen[key]), b = find(i);
    if (a !== b) parent[b] = a;
  }
  alerts.forEach(function (alert, i) {
    var customer = normName_(alert.customer);
    if (alert.opportunityNumber) link("opp|" + alert.opportunityNumber + "|" + customer, i);
    if (alert.jobNumber) link("job|" + alert.jobNumber + "|" + customer, i);
    if (alert.estimateNumber) link("est|" + alert.estimateNumber, i);
  });

  var groups = {};
  alerts.forEach(function (alert, i) {
    var root = find(i);
    (groups[root] = groups[root] || []).push({ alert: alert, index: i });
  });

  var revisedGroups = 0;
  var out = Object.keys(groups).map(function (root) {
    var members = groups[root];
    if (members.length > 1) revisedGroups++;
    members.sort(function (x, y) {
      var xt = x.alert.received && x.alert.received.getTime ? x.alert.received.getTime() : 0;
      var yt = y.alert.received && y.alert.received.getTime ? y.alert.received.getTime() : 0;
      if (xt !== yt) return xt - yt;
      var xd = String(x.alert.soldOnIso || ""), yd = String(y.alert.soldOnIso || "");
      return xd === yd ? x.index - y.index : xd.localeCompare(yd);
    });
    var latest = members[members.length - 1].alert;
    var kept = Object.assign({}, latest);
    kept.growthRevisionCount = members.length;
    kept.growthRevisionMembers = members.map(function (member) { return member.alert; });
    kept.growthJobCandidates = [];
    kept.growthOpportunityCandidates = [];
    members.forEach(function (member) {
      var a = member.alert;
      if (a.jobNumber && kept.growthJobCandidates.indexOf(String(a.jobNumber)) < 0) {
        kept.growthJobCandidates.push(String(a.jobNumber));
      }
      if (a.opportunityNumber && kept.growthOpportunityCandidates.indexOf(String(a.opportunityNumber)) < 0) {
        kept.growthOpportunityCandidates.push(String(a.opportunityNumber));
      }
    });
    return kept;
  });
  return {
    alerts: out,
    diagnostics: {
      rawAlerts: alerts.length,
      uniqueSales: out.length,
      revisedGroups: revisedGroups,
      supersededAlerts: alerts.length - out.length
    }
  };
}

function growthClassifyLatestSale_(alert, bookedMap) {
  var keys = [];
  function addKey(value) {
    var key = String(value || "").replace(/\D/g, "");
    if (key && keys.indexOf(key) < 0) keys.push(key);
  }
  addKey(alert.jobNumber);
  (alert.growthJobCandidates || []).forEach(addKey);
  var opportunities = [];
  if (alert.opportunityNumber) opportunities.push(alert.opportunityNumber);
  (alert.growthOpportunityCandidates || []).forEach(function (x) {
    if (opportunities.indexOf(x) < 0) opportunities.push(x);
  });
  opportunities.forEach(function (opp) {
    addKey(opp);
    var n = Number(String(opp).replace(/\D/g, ""));
    if (isFinite(n) && n > 2) addKey(String(n - 2));
  });

  var runs = [];
  keys.forEach(function (key) {
    (bookedMap[key] || []).forEach(function (run) {
      var sig = String(run.ranIso || "") + "|" + String(run.ranTime || "");
      if (!runs.some(function (x) { return x.sig === sig; })) runs.push({ sig: sig, run: run });
    });
  });
  var dated = runs.map(function (x) { return x.run; })
    .filter(function (run) { return !!run.ranIso; })
    .sort(function (a, b) { return a.ranIso.localeCompare(b.ranIso); });
  var original = dated.length ? dated[0] : null;

  /* Same-day is a question about when the deal was WON, so it must be asked of
     the EARLIEST sold alert in a collapsed re-quote group — never the retained
     latest one. A job sold the day its consult ran and then re-papered days
     later because the scope changed is still a same-day win; comparing the
     revision date demotes it to Follow-Up and understates same-day close rate,
     worst on the big jobs that get re-scoped most. Amount and sold date stay on
     the latest alert (current contract value); only the classification looks
     back. Combel: consult and sale both 8/13, re-signed 8/16 at a lower amount
     — SAME-DAY on 8/13's run, still carrying the 8/16 figure. */
  var wonIso = String(alert.soldOnIso || "");
  (alert.growthRevisionMembers || []).forEach(function (member) {
    var iso = String((member && member.soldOnIso) || "");
    if (iso && (!wonIso || iso < wonIso)) wonIso = iso;
  });

  if (original && original.ranIso === wonIso) {
    return {
      tag: "SAME-DAY", ranIso: original.ranIso, matched: true,
      matchKeys: keys, wonIso: wonIso
    };
  }
  /* Growth is binary by definition. Without a positive original-run match on
     the earliest sold date, the sale is Follow-Up and remains visible for
     reconciliation instead of leaking into an Unknown bucket. */
  return {
    tag: "FOLLOW-UP",
    ranIso: original ? original.ranIso : "",
    matched: !!original,
    matchKeys: keys,
    wonIso: wonIso
  };
}

function soldSellerName_(soldBy) {
  var key = normName_(soldBy);
  if (!key) return "";
  key = key.replace(/\s+(office|field|admin|sales)$/, "").trim();
  var hca = RECAP_ROSTER.filter(function (h) { return normName_(h.name) === key; })[0];
  if (hca) return hca.name;
  for (var i = 0; i < REVENUE_ALSO_SELLERS.length; i++) {
    var s = REVENUE_ALSO_SELLERS[i];
    if (normName_(s.name) === key) return s.name;
    var aliases = s.aliases || [];
    for (var j = 0; j < aliases.length; j++) {
      if (normName_(aliases[j]) === key) return s.name;
    }
  }
  if (typeof COMBO_REP_ALIASES !== "undefined" &&
      key.indexOf(" ") !== -1 && COMBO_REP_ALIASES[key]) {
    return COMBO_REP_ALIASES[key];
  }
  return "";
}

function readSoldAlerts_OLD_20260821(days) {
  const out = [];
  const res = searchAllThreads_(
    'from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' +
    Math.max(1, days) + "d", SOLD_ALERT_CEILING);
  if (!res.ok) {
    Logger.log("Sold alert search failed: " + res.error);
    return {
      ok: false, complete: false, alerts: out
    };
  }
  const threads = res.threads;
  threads.forEach(t => t.getMessages().forEach(msg => {
    const f = parseAlertFields_(msg.getPlainBody());
    const soldBy = f["sold by"] || "";
    const seller = soldSellerName_(soldBy);
    if (!seller) return;
    // technician / not counted
    /* "7/30 8:15 AM" carries no year; the tracker needs a sortable date. */
    const md = String(f["date"] || "").match(/^(\d{1,2})\/(\d{1,2})/);
    out.push({
      hca: seller,
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
    })
    ;
  })
  );
  if (!res.complete) {
    Logger.log("! Sold alert search hit its " + SOLD_ALERT_CEILING +
      "-thread ceiling — this is a PARTIAL read and every total from it is low.");
  }
  return {
    ok: true, complete: res.complete, alerts: out
  };
}
function readSoldForSameday_(fromIso, toIso, days) {
  var out = [];
  var msgs = bjSearch_('from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' +
    Math.max(1, days) + "d", 400);
  msgs.forEach(function (msg) {
    var year = Utilities.formatDate(msg.getDate(), bjTz_(), "yyyy");
    var text = bjText_(msg);
    var amtM = text.match(/Amount:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    var jobM = text.match(/Job\s*#?\s*:?\s*(\d{6,})/i);
    var dateM = text.match(/Date:\s*(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!amtM || !jobM || !dateM) return;
    var amount = Number(String(amtM[1]).replace(/,/g, ""));
    if (!isFinite(amount) || amount < sdFloor_()) return;
    // systems only
    var soldIso = bjIsoFromMD_(dateM[1], year);
    if (soldIso < fromIso || soldIso > toIso) return;
    var repM = text.match(/Sold by:\s*(.+?)\s*(?=Date:|Amount:|Customer:|Job\s*#|$)/i);
    var custM = text.match(/Customer:\s*(.+?)\s*(?=Job\s*#|$)/i);
        var estM = text.match(/Estimate\s*#?\s*:?\s*(\d{6,})/i);
    out.push({
      job: jobM[1], est: estM ? estM[1] : "", amount: amount, soldIso: soldIso, soldMD: dateM[1],
      rep: repM ? repM[1].trim() : "(rep?)", customer: custM ? custM[1].trim() : "",
      at: msg.getDate()
    })
    ;
  })
  ;
  return out;
}
function readStage_(ss, tabName, tz) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('Paste the export into a tab named "' + tabName + '" first (with its header row).');
  var g = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var hr = -1, cDate = -1, cType = -1;
  for (var r = 0;
  r < g.length && hr < 0;
  r++) {
    var row = g[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    if (row.indexOf("est") > -1 && row.indexOf("lead type") > -1) {
      hr = r;
      cDate = row.indexOf("est");
      cType = row.indexOf("lead type");
    }
  }
  if (hr < 0) throw new Error('Couldn\'t find the header (EST + Lead Type) in "' + tabName + '".');
  var out = {
    total: 0, src: {
      "Marketed": 0, "Tech Flip": 0, "Self Gen": 0
    },
    byDate: {
    }
  };
  for (var r = hr + 1;
  r < g.length;
  r++) {
    var key = dateKey_(g[r][cDate], tz);
    if (!key) continue;
    // footer / blank
    var lt = String(g[r][cType] || "").trim().toLowerCase();
    var b = (lt === "inbound" || lt === "webform") ? "Marketed"
      : (lt === "tech lead" || lt === "tech flip") ? "Tech Flip"
        : (lt.indexOf("self") === 0) ? "Self Gen" : null;
    if (!b) continue;
    out.total++;
    out.src[b]++;
    out.byDate[key] = (out.byDate[key] || 0) + 1;
  }
  return out;
}
function rebuildFollowUpActivity(previewOnly) {
  const book = getLogSpreadsheet_();
  const ss = book.ss;
  const comp = ss.getSheetByName(DAILY_RECAP_CONFIG.complianceSheetName);
  if (!comp) return "No Compliance sheet — nothing to read.";
  const last = comp.getLastRow();
  if (last < 2) return "Compliance sheet is empty.";
  const rows = comp.getRange(2, 1, last - 1, COMPLIANCE_HEADERS.length).getValues();
  const iBlob = COMPLIANCE_HEADERS.indexOf("Follow-ups On Older Leads");
  const out = [];
  rows.forEach(r => {
    const iso = String(normalizeSheetDate_(r[0]) || r[0] || "").slice(0, 10);
    const hca = String(r[1] || "").trim();
    const blob = r[iBlob];
    if (!hca || !blob) return;
    splitFollowUpBlob_(blob).forEach(line => {
      out.push([
        iso,
        hca,
        followUpWho_(line),
        line.replace(/^\s*[-–—•*]+\s*/, "").trim(),
        followUpSignal_(line),
        followUpActivityKey_(iso, hca, line)
      ]);
    })
    ;
  })
  ;
  if (previewOnly) {
    const counts = {
    };
    out.forEach(r => {
      counts[r[4]] = (counts[r[4]] || 0) + 1;
    })
    ;
    const lines = ["PREVIEW — nothing written. " + out.length + " follow-up row(s):"];
    Object.keys(counts).sort().forEach(k => lines.push("  " + k + ": " + counts[k]));
    out.filter(r => r[4] === "SOLD" || r[4] === "DEPOSIT").forEach(r => {
      lines.push("  * " + r[0] + "  " + r[1] + "  [" + r[4] + "]  " +
        (r[2] || "(no name parsed)") + " — " + r[3]);
    })
    ;
    const msg = lines.join("\n");
    Logger.log(msg);
    return msg;
  }
  const sheet = ensureSheet_(ss, FOLLOWUP_ACTIVITY_SHEET, FOLLOWUP_ACTIVITY_HEADERS);
  /* Append-only and keyed, so re-running never duplicates. */
  const seen = {
  };
  const existingLast = sheet.getLastRow();
  if (existingLast >= 2) {
    sheet.getRange(2, FOLLOWUP_ACTIVITY_HEADERS.length, existingLast - 1, 1)
      .getValues().forEach(v => {
      const k = String(v[0] || "").trim();
      if (k) seen[k] = true;
    })
    ;
  }
  const fresh = out.filter(r => !seen[r[5]]);
  if (fresh.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, FOLLOWUP_ACTIVITY_HEADERS.length)
      .setValues(fresh);
  }
  const msg = "Follow-up Activity: " + fresh.length + " new row(s), " +
    (out.length - fresh.length) + " already present.";
  Logger.log(msg);
  return msg;
}
function rebuildFollowUpActivityV2(previewOnly) {
  const SHEET_NAME = "Follow-up Activity";
  const HEADERS = ["Date", "HCA", "Who", "What Happened", "Signal", "Key"];
  const book = getLogSpreadsheet_();
  const ss = book.ss;
  const comp = ss.getSheetByName(DAILY_RECAP_CONFIG.complianceSheetName);
  if (!comp) return "No Compliance sheet — nothing to read.";
  const last = comp.getLastRow();
  if (last < 2) return "Compliance sheet is empty.";
  const compRows = comp.getRange(2, 1, last - 1, COMPLIANCE_HEADERS.length).getValues();
  const iBlob = COMPLIANCE_HEADERS.indexOf("Follow-ups On Older Leads");
  const out = [];
  const seen = {
  };
  let repeats = 0;
  compRows.forEach(r => {
    const iso = String(normalizeSheetDate_(r[0]) || r[0] || "").slice(0, 10);
    const hca = String(r[1] || "").trim();
    const blob = r[iBlob];
    if (!hca || !blob) return;
    splitFollowUpBlobV2_(blob).forEach(line => {
      const key = followUpKeyV2_(iso, hca, line);
      /* Deduped as we go. Your Compliance tab holds 2026-07-31 twice for six
      reps, left over from the duplicate-send testing, and without this every
      one of those lines lands on the tab twice. */
      if (seen[key]) {
        repeats++;
        return;
      }
      seen[key] = true;
      out.push([
        iso,
        hca,
        followUpWhoV2_(line),
        line.replace(/^\s*[-–—•*]+\s*/, "").trim(),
        followUpSignalV2_(line),
        key
      ]);
    })
    ;
  })
  ;
  if (previewOnly) {
    const counts = {
    };
    out.forEach(r => {
      counts[r[4]] = (counts[r[4]] || 0) + 1;
    })
    ;
    const lines = ["PREVIEW — nothing written. " + out.length + " distinct follow-up(s)" +
      (repeats ? ", " + repeats + " repeated line(s) skipped" : "") + ":"];
    Object.keys(counts).sort().forEach(k => lines.push("  " + k + ": " + counts[k]));
    out.filter(r => r[4] === "SOLD" || r[4] === "DEPOSIT").forEach(r => {
      lines.push("  * " + r[0] + "  " + r[1] + "  [" + r[4] + "]  " +
        (r[2] || "(no name parsed)") + " — " + r[3]);
    })
    ;
    const msg = lines.join("\n");
    Logger.log(msg);
    return msg;
  }
  const sheet = ensureSheet_(ss, SHEET_NAME, HEADERS);
  /* Rewritten, not appended. This is what makes the tab self-correcting: run it
  as often as you like and the result is always exactly what the Compliance
  data says, with no accumulated history to go wrong. */
  const had = Math.max(0, sheet.getLastRow() - 1);
  if (had > 0) {
    /* Deleted rather than blanked. Clearing the contents leaves the rows behind,
    so getLastRow keeps counting them and every later run reports a row count
    that is really just old empties. */
    sheet.deleteRows(2, had);
  }
  if (out.length) {
    sheet.getRange(2, 1, out.length, HEADERS.length).setValues(out);
  }
  const msg = "Follow-up Activity rebuilt: " + out.length + " row(s)" +
    (repeats ? " (" + repeats + " repeated line(s) skipped)" : "") +
    ". Previously " + had + " row(s).";
  Logger.log(msg);
  return msg;
}
function recapForOneOnOne(email, days) {
  const n = Math.max(1, Math.min(120, Number(days) || 14));
  try {
    return JSON.stringify(buildRecapApiPayload_(n, String(email || "")));
  }
  catch (err) {
    return JSON.stringify({
      ok: false, error: err && err.message ? err.message : String(err)
    })
    ;
  }
}
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
    .map(b => ({
    customer: b.customer, phone: b.phone
  })
  );
  if (!status.ok) {
    status.error = "Gmail alert search failed; reconciliation is incomplete.";
    return status;
  }
  /* Every rep who either filed a recap or raised a sold alert in the window,
  honouring the same single-HCA filter the caller asked for. */
  const names = {
  };
  Object.keys(byName).forEach(n => {
    names[n] = true;
  })
  ;
  soldRes.alerts.forEach(a => {
    if (wanted && a.hca.toLowerCase() !== wanted) return;
    names[a.hca] = true;
  })
  ;
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
    const byJob = {
    };
    mine.forEach(a => {
      const key = a.jobNumber || normName_(a.customer);
      if (!byJob[key]) {
        byJob[key] = {
          customer: a.customer, jobNumber: a.jobNumber, estimates: []
        };
      }
      /* The same estimate can alert twice; that one really is a duplicate. */
      const seen = byJob[key].estimates.filter(e =>
        e.estimateNumber && e.estimateNumber === a.estimateNumber)[0];
      if (seen) {
        if (a.received > seen.received) {
          seen.amount = a.amount;
          seen.soldOn = a.soldOn;
          seen.received = a.received;
        }
        return;
      }
      byJob[key].estimates.push({
        estimateNumber: a.estimateNumber, name: a.name,
        amount: a.amount, soldOn: a.soldOn, soldOnIso: a.soldOnIso, received: a.received
      })
      ;
    })
    ;
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
      const last = job.estimates[job.estimates.length - 1] || {
      };
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
        })
        ),
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
    })
    ;
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
  })
  ;
  matchBookedToReplies_(byName, bookedRes.booked, ctx.allLogRows, status, ctx.askedOn);
  return status;
}
function refreshDailyGrowth() {
  var ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var daily = ss.getSheetByName("Daily");
  if (!daily) throw new Error("No Daily tab found.");
  var SDS = "Same-Day Sold";
  var src = ss.getSheetByName(SDS);
  if (!src) throw new Error('No "' + SDS + '" tab found.');
  // ---- locate the Same-Day Sold columns ----
  var g = src.getRange(1, 1, src.getLastRow(), src.getLastColumn()).getValues();
  var cDate = -1, cTot = -1, cDol = -1;
  for (var r = 0;
  r < g.length && cDate < 0;
  r++) {
    var row = g[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    if (row.indexOf("date") > -1 && row.indexOf("$ sold") > -1) {
      for (var c = 0;
      c < row.length;
      c++) {
        if (row[c] === "date") cDate = c;
        else if (row[c] === "total sold") cTot = c;
        else if (row[c] === "$ sold") cDol = c;
      }
    }
  }
  if (cDate < 0 || cTot < 0 || cDol < 0)
    throw new Error("Couldn't find Same-Day Sold Date / Total Sold / $ Sold headers.");
  function L(i) {
    var n = i + 1, s = "";
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  var q = "'" + SDS + "'";
  var dateCol = q + "!" + L(cDate) + ":" + L(cDate);
  var totCol = q + "!" + L(cTot) + ":" + L(cTot);
  var dolCol = q + "!" + L(cDol) + ":" + L(cDol);
  var dayM = 'MATCH(TEXT(TODAY()-1,"ddd m/d"),ARRAYFORMULA(TEXT(' + dateCol + ',"ddd m/d")),0)';
  var mtdM = 'MATCH("MTD",' + dateCol + ',0)';
  // ---- find Daily rows by label ----
  var dv = daily.getRange(1, 1, daily.getLastRow(), 2).getValues();
  function rowOf(pred) {
    for (var r = 0;
    r < dv.length;
    r++) {
      if (pred(String(dv[r][1] || "").trim().toLowerCase())) return r + 1;
    }
    return -1;
  }
  var rHdr = rowOf(function (s) {
    return s === "mtd";
  })
  ;
  var rSold = rowOf(function (s) {
    return s === "total sold";
  })
  ;
  var rDol = rowOf(function (s) {
    return s.indexOf("hvac sold $") === 0;
  })
  ;
  var rAvg = rowOf(function (s) {
    return s.indexOf("hvac avg ticket") === 0;
  })
  ;
  if (rSold < 0 || rDol < 0) throw new Error("Couldn't find Total Sold / HVAC Sold $ rows on Daily.");
  // ---- SOLD (live formulas -- self-update, can't refreeze) ----
  if (rHdr > 0) daily.getRange("C" + rHdr).setFormula("=TODAY()-1").setNumberFormat("ddd m/d");
  daily.getRange("C" + rSold).setFormula('=IFERROR(INDEX(' + totCol + ',' + dayM + '),0)');
  daily.getRange("D" + rSold).setFormula('=IFERROR(INDEX(' + totCol + ',' + mtdM + '),0)');
  daily.getRange("C" + rDol).setFormula('=IFERROR(INDEX(' + dolCol + ',' + dayM + '),0)').setNumberFormat("$#,##0");
  daily.getRange("D" + rDol).setFormula('=IFERROR(INDEX(' + dolCol + ',' + mtdM + '),0)').setNumberFormat("$#,##0");
  if (rAvg > 0) daily.getRange("C" + rAvg).setFormula('=IFERROR(C' + rDol + '/C' + rSold + ',"")').setNumberFormat("$#,##0");
  // ---- keep the row-19 legend out if it reappears (LAST so it can't shift writes) ----
  var rNote = rowOf(function (s) {
    return s.indexOf("day column") === 0;
  })
  ;
  if (rNote > 0) daily.deleteRow(rNote);
  SpreadsheetApp.flush();
  var lbl = rHdr > 0 ? daily.getRange("C" + rHdr).getDisplayValue() : "yesterday";
  var dS = daily.getRange("C" + rSold).getValue(), dD = daily.getRange("C" + rDol).getValue();
  var stamp = Utilities.formatDate(new Date(), tz, "h:mm a");
  var msg = "Dialed " + lbl + " @ " + stamp + ".  SOLD " + dS + " / $" + Math.round(dD) +
    " (live).  Leads/installs/etc. come from your BI upload.  Row 19 out.";
  Logger.log(msg);
  return msg;
}
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
  const byName = {
  };
  const ensure = name => {
    if (!byName[name]) byName[name] = {
      name: name, rows: []
    };
    return byName[name];
  };
  allLogRows.forEach(r => {
    ensure(String(r[1])).rows.push({
      date: String(r[0]), customer: String(r[2] || ""), source: String(r[3] || ""),
      outcome: String(r[4] || "NOT GIVEN")
    })
    ;
  })
  ;
  /* Which days the recap actually ran. An appointment is only "unreported" if
  somebody was asked to report it — before the recap existed, nobody was.
  Reading it from the compliance tab rather than a hardcoded launch date
  means this stays right through any future gap: a week the script was off
  is not a week of ten reps ignoring it. */
  const askedOn = {
  };
  readSheetRows_(book.ss, cfg.complianceSheetName, COMPLIANCE_HEADERS.length)
    .forEach(r => {
    if (r[0]) askedOn[String(r[0])] = true;
  })
  ;
  const status = reconcileWithServiceTitan_(byName, ensure, "", days,
    {
    allLogRows: allLogRows, fromIso: fromIso, toIso: toIso, askedOn: askedOn
  })
  ;
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
  return {
    rows: written.rows, needsAttention: written.needsAttention,
           emailNotes: notes.rows, followUps: work.rows, status: status
  };
}
function refreshRentalRegister(previewOnly, days) {
  const cfg = DAILY_RECAP_CONFIG;
  const lookback = Math.max(1, Math.min(200, Number(days) || Number(cfg.jobStatusDays) || 30));
  const res = readSoldAlerts_(lookback);
  if (!res.ok) return "Could not read the ServiceTitan alerts — nothing changed.";
  const alerts = collapseResoldAlerts_(res.alerts);
  /* A rental is booked as DEFERRED REVENUE, so ServiceTitan carries it as
  $0.00 or as a nominal $0.01 placeholder. Both are candidates, and so is
  anything else under a dollar — parseDealAmount_ also returns null for
  "$0.00" because it discards non-positive figures, which is a third shape
  for the same thing.
  
  The threshold is a dollar rather than a penny on purpose: it costs nothing
  to look at a row and say no, and a real cash job is never remotely near it.
  A $0.01 slipping past would be worse than a false positive — the rental
  would be invisible here AND counted as a cash sale over there. */
  const isNominal = v => v === null || v === undefined || String(v).trim() === "" ||
                         !isFinite(Number(v)) || Number(v) < 1;
  const candidates = alerts.filter(a => isNominal(a.amount));
  const book = getLogSpreadsheet_();
  const ss = book.ss;
  /* What the rep said about this customer, for context and for the pre-fill. */
  const logRows = readSheetRows_(ss, cfg.logSheetName, RECAP_LOG_HEADERS.length);
  const iCust = RECAP_LOG_HEADERS.indexOf("Customer");
  const iHca = RECAP_LOG_HEADERS.indexOf("HCA");
  const iDeal = RECAP_LOG_HEADERS.indexOf("Deal Offered");
  const iCaas = RECAP_LOG_HEADERS.indexOf("CaaS Monthly $");
  const recapFor = (hca, customer) => {
    for (let i = 0;
    i < logRows.length;
    i++) {
      const r = logRows[i];
      if (String(r[iHca] || "").toLowerCase() !== String(hca || "").toLowerCase()) continue;
      if (!namesMatch_(String(r[iCust] || ""), customer)) continue;
      return {
        deal: String(r[iDeal] || ""), caas: r[iCaas]
      };
    }
    return null;
  };
  const sheet = previewOnly ? ss.getSheetByName(RENTAL_SHEET_NAME) : ensureRentalSheet_(ss);
  /* Existing rows, so a human's answers survive every refresh. */
  const existing = {
  };
  let existingRows = [];
  if (sheet) {
    const last = sheet.getLastRow();
    if (last >= RENTAL_FIRST_DATA_ROW) {
      existingRows = sheet.getRange(RENTAL_FIRST_DATA_ROW, 1,
        last - RENTAL_HEADER_ROW, RENTAL_HEADERS.length).getValues();
      existingRows.forEach(r => {
        const k = String(r[RENTAL_HEADERS.length - 1] || "").trim();
        if (k) existing[k] = r;
      })
      ;
    }
  }
  const stamp = new Date();
  const fresh = [], updated = [], prefilled = [];
  /* Every nominal alert for one job collapses into a single candidate. */
  const groups = {
  };
  const groupOrder = [];
  candidates.forEach(a => {
    const key = rentalRowKey_(a.hca, a.customer, a.jobNumber);
    if (!groups[key]) {
      groups[key] = {
        key: key, alerts: []
      };
      groupOrder.push(key);
    }
    groups[key].alerts.push(a);
  })
  ;
  groupOrder.forEach(key => {
    const group = groups[key];
    /* Earliest alert is the sale; the penny test follows it. */
    group.alerts.sort((x, y) => String(x.soldOnIso).localeCompare(String(y.soldOnIso)));
    const a = group.alerts[0];
    const rec = recapFor(a.hca, a.customer);
    const why = [];
    let sawPennyTest = false;
    group.alerts.forEach(x => {
      const n = Number(x.amount);
      if (isFinite(n) && n > 0 && n < 1) {
        sawPennyTest = true;
        why.push("$" + n.toFixed(2) + " penny test on " + x.soldOnIso + " — a card was verified for recurring billing");
      }
      else {
        why.push("$0.00 sold alert on " + x.soldOnIso + " — booked as deferred revenue");
      }
    })
    ;
    let guessRental = "";
    let guessMonthly = "";
    /* A verified card is the strongest signal available short of you saying so:
    nobody sets up recurring billing on a one-time cash job. Strong, not
    conclusive — a financed cash sale could put a card on file too, which is
    exactly why this pre-fills a Yes rather than deciding for you. */
    if (sawPennyTest) guessRental = "Yes";
    /* Set before the name is read, so an accessory name can still overrule it —
    a card on file for a financed thermostat is not a rental. */
    /* The estimate name is the strongest evidence there is, in both directions. */
    const sig = rentalSignal_(a.name);
    if (sig.verdict) {
      why.push('"' + a.name.slice(0, 45) + '" — ' + sig.reason);
      guessRental = sig.verdict;
    }
    /* Priority matters. The estimate name describes what was SOLD; the recap
    describes what was OFFERED at the appointment, possibly weeks earlier and
    possibly not the option that closed. The name wins where both exist. */
    const fromName = rentalMonthlyFromName_(a.name);
    if (fromName !== "") {
      why.push("estimate name carries $" + fromName + "/mo");
      guessMonthly = fromName;
      guessRental = "Yes";
    }
    else if (rec && rec.caas !== "" && rec.caas !== null && rec.caas !== undefined && isFinite(Number(rec.caas))) {
      why.push("recap shows $" + rec.caas + "/mo");
      guessMonthly = Number(rec.caas);
      guessRental = "Yes";
    }
    else if (rec && rentalMarkerIn_(rec.deal)) {
      why.push("recap line mentions a rental");
      guessRental = "Yes";
    }
    const prior = existing[key];
    /* Pre-fill only ever writes into an EMPTY cell. Anything you have typed
    wins, permanently, including a deliberate "No". */
    const isRental = prior && String(prior[RENTAL_COL_ISRENTAL]).trim() !== ""
      ? prior[RENTAL_COL_ISRENTAL] : guessRental;
    const monthly = prior && String(prior[RENTAL_COL_MONTHLY]).trim() !== ""
      ? prior[RENTAL_COL_MONTHLY] : guessMonthly;
    const row = [
      a.soldOnIso,
      a.hca,
      a.customer,
      a.name,
      a.jobNumber,
      (a.amount === null || a.amount === undefined || !isFinite(Number(a.amount))) ? 0 : Number(a.amount),
      isRental,
      monthly,
      "",
    /* filled with a formula below */
    why.join("; "),
      rec ? rec.deal : "(no recap row for this customer)",
      stamp,
      key
    ];
    if (prior) updated.push(row);
    else fresh.push(row);
    if (!prior && (guessRental || guessMonthly !== "")) prefilled.push(a.hca + " / " + a.customer);
    existing[key] = row;
  })
  ;
  /* Rows already on the tab that this run did not see — an alert that has aged
  out of the lookback — are kept exactly as they are. The register is a
  record, not a cache. */
  const all = [];
  const order = {
  };
  existingRows.forEach(r => {
    const k = String(r[RENTAL_HEADERS.length - 1] || "").trim();
    if (k && existing[k]) {
      order[k] = true;
      all.push(existing[k]);
    }
    else if (k) all.push(r);
  })
  ;
  Object.keys(existing).forEach(k => {
    if (!order[k] && !existingRows.some(r => String(r[RENTAL_HEADERS.length - 1] || "").trim() === k)) all.push(existing[k]);
  })
  ;
  all.sort((x, y) => String(y[0]).localeCompare(String(x[0])));
  /* newest first */
  if (previewOnly) {
    const lines = ["PREVIEW — nothing written.",
      "Scanned " + res.alerts.length + " alert(s) over " + lookback + " days" +
      (res.complete === false ? " (PARTIAL — hit the search ceiling)" : "") + ".",
      candidates.length + " nominal-amount candidate(s), " + fresh.length + " new to the register, " +
      updated.length + " already there."];
    if (prefilled.length) lines.push("Pre-filled from a rental marker: " + prefilled.join(", "));
    fresh.forEach(r => lines.push("  NEW  " + r[0] + "  " + r[1] + " / " + r[2] +
      "  [" + (r[6] || "needs your answer") + (r[7] !== "" ? " $" + r[7] + "/mo" : "") + "]  " + r[9]));
    const msg = lines.join("\n");
    Logger.log(msg);
    return msg;
  }
  if (all.length) {
    sheet.getRange(RENTAL_FIRST_DATA_ROW, 1, all.length, RENTAL_HEADERS.length).setValues(all);
    /* Contract value is a formula so it tracks a monthly you type by hand,
    instead of going stale until the next refresh. */
    const formulas = [];
    for (let i = 0;
    i < all.length;
    i++) {
      const row = RENTAL_FIRST_DATA_ROW + i;
      formulas.push(['=IF($H' + row + '="","",$H' + row + '*' + CAAS_TERM_MONTHS + ')']);
    }
    sheet.getRange(RENTAL_FIRST_DATA_ROW, 9, all.length, 1).setFormulas(formulas);
    sheet.getRange(RENTAL_FIRST_DATA_ROW, 6, all.length, 1).setNumberFormat("$#,##0.00");
    sheet.getRange(RENTAL_FIRST_DATA_ROW, 8, all.length, 2).setNumberFormat("$#,##0.00");
  }
  const needAnswer = all.filter(r => String(r[RENTAL_COL_ISRENTAL]).trim() === "").length;
  const autoNo = all.filter(r => String(r[RENTAL_COL_ISRENTAL]).trim().toLowerCase() === "no").length;
  const msg = "Rentals: " + all.length + " row(s) on the register, " + fresh.length +
    " new, " + needAnswer + " still needing a Yes/No from you, " + autoNo +
    " marked No (yours or auto — worth a glance, since a wrong No hides a rental)." +
    (res.complete === false ? "  WARNING: the alert search hit its ceiling, so this is a partial read." : "");
  Logger.log(msg);
  return msg;
}
function refreshSameDaySoldTab() {
  var m = sameDaySoldMonthData_();
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = ss.getSheetByName("Same-Day Sold") || ss.insertSheet("Same-Day Sold");
  /* Keep the last known-good table if Gmail failed or hit its ceiling. A
     partial read looks plausible and must never replace complete sales. */
  if (!m.ok || m.complete === false) {
    var why = !m.ok ? "read failed" : "partial Gmail read";
    Logger.log("Same-Day Sold tab NOT refreshed — " + why + "; previous values preserved.");
    return why;
  }
  sh.clear();
  var NAVY = "#0f172a", AMBER = "#fff7ed", MUT = "#64748b";
  sh.getRange("A1").setValue("Same-Day Sold — booked appt matched to sold alert by Job #")
    .setFontWeight("bold").setFontSize(13);
  sh.getRange("A2").setValue("Growth HVAC projects only: sold amount > $" +
    GROWTH_HVAC_SOLD_MIN_DOLLARS.toLocaleString() +
    " · approved HCA/manager sellers · latest re-quote amount/date wins · exclusions honored. " +
    "SAME-DAY = latest sold date equals original booked run; otherwise FOLLOW-UP.")
    .setFontColor(MUT);
  var head = ["Date", "Total Sold", "Same-Day", "Follow-Up", "Unknown", "Same-Day %", "$ Sold"];
  sh.getRange(4, 1, 1, head.length).setValues([head])
    .setFontWeight("bold").setBackground(NAVY).setFontColor("#ffffff");
  var isoList = Object.keys(m.days).sort();
  var t = {
    total: 0, same: 0, follow: 0, unknown: 0, dollars: 0
  };
  var rows = isoList.map(function (iso) {
    var d = m.days[iso];
    t.total += d.total;
    t.same += d.same;
    t.follow += d.follow;
    t.unknown += d.unknown;
    t.dollars += d.dollars;
    var label = Utilities.formatDate(new Date(iso + "T12:00:00"), m.tz, "EEE M/d");
    return [label, d.total, d.same, d.follow, d.unknown, d.total ? d.same / d.total : "", d.dollars];
  })
  ;
  rows.push(["MTD", t.total, t.same, t.follow, t.unknown, t.total ? t.same / t.total : "", t.dollars]);
  sh.getRange(5, 1, rows.length, head.length).setValues(rows);
  sh.getRange(5, 6, rows.length, 1).setNumberFormat("0.0%");
  sh.getRange(5, 7, rows.length, 1).setNumberFormat("$#,##0");
  sh.getRange(4 + rows.length, 1, 1, head.length).setFontWeight("bold").setBackground(AMBER);
  [90, 90, 90, 90, 90, 100, 100].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  })
  ;
  sh.setFrozenRows(4);
  var tz2 = m.tz;
  var stamp = Utilities.formatDate(new Date(), tz2, "EEE M/d h:mm a");
  sh.getRange(6 + rows.length, 1).setValue("Updated " + stamp +
    (m.complete === false ? "  ·  ! PARTIAL Gmail read, numbers may be low" : ""))
    .setFontColor(MUT);
  var excluded = m.excluded || { count: 0, dollars: 0 };
  sh.getRange(7 + rows.length, 1).setValue(
    "Excluded from Growth headline: " + excluded.count + " alert(s) · $" +
    Math.round(excluded.dollars).toLocaleString() +
    " (amount <= $" + GROWTH_HVAC_SOLD_MIN_DOLLARS.toLocaleString() +
    " or seller outside the approved list)."
  ).setFontColor(MUT).setFontStyle("italic");
  var dedupe = m.dedupe || {};
  sh.getRange(8 + rows.length, 1).setValue(
    "Growth re-quote audit: " + (dedupe.mtdRevisedGroups || 0) + " revised MTD sale group(s) · " +
    (dedupe.mtdSupersededAlerts || 0) + " superseded alert(s) removed · latest alert retained." +
    (m.unmatchedFollowUp ? " " + m.unmatchedFollowUp +
      " sale(s) had no booked-job match and were conservatively classified Follow-Up." : "")
  ).setFontColor(MUT).setFontStyle("italic");
  var msg = "Same-Day Sold tab updated (tied to Sold Today): MTD " + t.total + " sold · " +
    t.same + " same-day · " + t.follow + " follow-up" +
    (t.unknown ? " · " + t.unknown + " unknown" : "") + " · $" + Math.round(t.dollars) +
    " · excluded " + excluded.count + " / $" + Math.round(excluded.dollars) +
    " · revised MTD groups " + (dedupe.mtdRevisedGroups || 0) +
    " · unmatched-as-follow-up " + (m.unmatchedFollowUp || 0);
  Logger.log(msg);
  return msg;
}
function refreshSignedVsSold(previewOnly, days) {
  const cfg = DAILY_RECAP_CONFIG;
  const lookback = Math.max(1, Math.min(200, Number(days) || Number(cfg.jobStatusDays) || 30));
  const signedRes = readSignedAlerts_(lookback);
  const soldRes = readSoldAlerts_(lookback);
  if (!signedRes.ok && !soldRes.ok) return "Could not read either alert stream — nothing changed.";
  const sold = soldRes.ok ? soldRes.alerts : [];
  const signed = signedRes.ok ? signedRes.alerts : [];
  /* Estimate number is the tightest join there is — one estimate, one number,
  both alerts quote it. Opportunity is the fallback for the rare alert that
  arrives without one. */
  const soldByEstimate = {
  };
  const soldByOpp = {
  };
  sold.forEach(s => {
    if (s.estimateNumber) soldByEstimate[s.estimateNumber] = s;
    const k = s.opportunityNumber + "|" + normName_(s.customer);
    if (s.opportunityNumber && !soldByOpp[k]) soldByOpp[k] = s;
  })
  ;
  const rows = [];
  const pairedSold = {
  };
  signed.forEach(sg => {
    const match = soldByEstimate[sg.estimateNumber] ||
                  soldByOpp[sg.opportunityNumber + "|" + normName_(sg.customer)] || null;
    if (match) pairedSold[match.estimateNumber || (match.opportunityNumber + "|" + normName_(match.customer))] = true;
    rows.push({
      signedOn: sg.signedOnIso,
      hca: match ? match.hca : "",
      customer: sg.customer,
      estimate: sg.estimateNumber,
      opportunity: sg.opportunityNumber,
      signed: sg.amount,
      sold: match ? match.amount : "",
      soldOn: match ? match.soldOnIso : "",
      name: match ? match.name : "",
      status: match ? "Matched" : "SIGNED, NO SOLD ALERT — invisible to every other report",
      received: sg.received
    })
    ;
  })
  ;
  /* Sold with no signed counterpart is normal — it just means the customer did
  not sign online. Kept so the tab is the whole picture rather than only the
  online half, and so a missing signed amount is visibly missing. */
  sold.forEach(s => {
    const k = s.estimateNumber || (s.opportunityNumber + "|" + normName_(s.customer));
    if (pairedSold[k]) return;
    rows.push({
      signedOn: s.soldOnIso, hca: s.hca, customer: s.customer,
      estimate: s.estimateNumber, opportunity: s.opportunityNumber,
      signed: "", sold: s.amount, soldOn: s.soldOnIso, name: s.name,
      status: "Sold only (not signed online)", received: s.received
    })
    ;
  })
  ;
  /* A revised estimate supersedes the one it replaced — Sergei signed "Best"
  and then "Best - updated" on the same opportunity, five hours apart, and
  counting both would book him twice.
  
  Only collapsed when the estimate NAMES agree, using the same test the sold
  side already uses. Where a name is missing, which is every signed-only row,
  nothing is superseded: two estimates on one opportunity are far more often
  a furnace and a water heater than a revision, and dropping one of those
  would lose a real sale. Marked, never deleted. */
  const byOpp = {
  };
  rows.forEach(r => {
    const k = r.opportunity + "|" + normName_(r.customer);
    (byOpp[k] = byOpp[k] || []).push(r);
  })
  ;
  Object.keys(byOpp).forEach(k => {
    const group = byOpp[k];
    if (group.length < 2) return;
    group.sort((a, b) => a.received - b.received);
    const latest = group[group.length - 1];
    group.forEach(r => {
      if (r === latest) return;
      if (!r.name || !latest.name) return;
      if (!sameEstimateName_(r.name, latest.name)) return;
      r.status = "Superseded by estimate " + latest.estimate;
    })
    ;
  })
  ;
  /* WHAT IS LEFT OVER AFTER SUPERSEDING, AND WHY IT IS FLAGGED RATHER THAN
  DECIDED.
  A new estimate gets generated when the scope of work changes, and that looks
  identical from here to a genuine add-on: another estimate on the same
  opportunity under a different name. Amber's Haberman job is the first kind —
  "5 zone - updated" became "Single zone - updated", one sale. Davis's Keller
  job was the second — a heat pump, an electrical panel and a maintenance
  plan, three sales, $12,059 of which vanishes if they are merged.
  The alert carries nothing that separates the two cases. Guessing either way
  is wrong some of the time and silent every time, so these go in front of you
  instead. */
  Object.keys(byOpp).forEach(k => {
    const live = byOpp[k].filter(r => String(r.status).indexOf("Superseded") !== 0);
    if (live.length < 2) return;
    live.forEach(r => {
      r.review = true;
      r.status = "REVIEW: " + live.length + " estimates on this opportunity — " +
        "revision or add-on? (" + r.status + ")";
    })
    ;
  })
  ;
  rows.sort((a, b) => String(b.signedOn).localeCompare(String(a.signedOn)));
  const counted = rows.filter(r => r.status.indexOf("Superseded") === -1);
  const matched = counted.filter(r => r.signed !== "" && r.sold !== "");
  const orphanSigned = counted.filter(r => r.status.indexOf("SIGNED, NO SOLD") !== -1 && r.sold === "");
  const review = counted.filter(r => r.review);
  if (previewOnly) {
    const lines = ["PREVIEW — nothing written.",
      signed.length + " signed alert(s) and " + sold.length + " sold alert(s) over " +
      lookback + " days" +
      ((signedRes.complete === false || soldRes.complete === false) ? " (PARTIAL — hit a search ceiling)" : "") + ".",
      counted.length + " row(s) after superseding, " + matched.length + " with both numbers, " +
      orphanSigned.length + " signed with no sold alert, " + review.length +
      " needing your eye (more than one estimate on the opportunity)."];
    review.forEach(r => lines.push("  REVIEW  " + r.signedOn + "  " + (r.hca || "(rep unknown)") +
      " / " + r.customer + "  opp " + r.opportunity + "  \"" + String(r.name || "(no name)").slice(0, 45) +
      "\"  signed " + (r.signed === "" ? "—" : "$" + Number(r.signed).toFixed(2)) +
      "  sold " + (r.sold === "" ? "—" : "$" + Number(r.sold).toFixed(2))));
    matched.slice(0, 12).forEach(r => {
      const diff = Number(r.signed) - Number(r.sold);
      lines.push("  " + r.signedOn + "  " + (r.hca || "(rep unknown)") + " / " + r.customer +
        "   signed $" + Number(r.signed).toFixed(2) + "  sold $" + Number(r.sold).toFixed(2) +
        "  gap $" + diff.toFixed(2) + " (" + (diff / Number(r.sold) * 100).toFixed(2) + "%)");
    })
    ;
    orphanSigned.forEach(r => lines.push("  ORPHAN  " + r.signedOn + "  " + r.customer +
      "  signed $" + Number(r.signed).toFixed(2) + "  estimate " + r.estimate));
    const msg = lines.join("\n");
    Logger.log(msg);
    return msg;
  }
  const sheet = ensureSheet_(getLogSpreadsheet_().ss, SIGNED_SHEET_NAME, SIGNED_HEADERS);
  const had = Math.max(0, sheet.getLastRow() - 1);
  if (had > 0) sheet.deleteRows(2, had);
  const out = rows.map(r => {
    const s = r.signed === "" ? "" : Number(r.signed);
    const d = r.sold === "" ? "" : Number(r.sold);
    const diff = (s === "" || d === "") ? "" : s - d;
    return [
      r.signedOn, r.hca, r.customer, r.estimate, r.opportunity,
      s, d, diff, (diff === "" || !d) ? "" : diff / d,
      r.soldOn, r.name, r.status,
      r.estimate + "|" + normName_(r.customer)
    ];
  })
  ;
  if (out.length) {
    sheet.getRange(2, 1, out.length, SIGNED_HEADERS.length).setValues(out);
    sheet.getRange(2, 6, out.length, 3).setNumberFormat("$#,##0.00");
    sheet.getRange(2, 9, out.length, 1).setNumberFormat("0.00%");
  }
  const msg = "Signed vs Sold: " + out.length + " row(s), " + matched.length +
    " carrying both numbers, " + orphanSigned.length +
    " signed with NO sold alert" + (orphanSigned.length ? " — those are sales nothing else can see." : ".") +
    (review.length ? "  " + review.length + " row(s) flagged REVIEW: more than one estimate on the " +
      "opportunity, so a revision could be counted as a second sale until you say which it is." : "");
  Logger.log(msg);
  return msg;
}
function refreshSoldTodayTab() {
  ST_REG_CACHE = null;
  var data = soldTodayData_(stToday_());
  var ss = getLogSpreadsheet_().ss;
  var sheet = ss.getSheetByName(SOLD_TODAY_TAB) || ss.insertSheet(SOLD_TODAY_TAB);
  sheet.clearContents();
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var stamp = Utilities.formatDate(new Date(), tz, "EEE MMM d, h:mm a");
  sheet.getRange("A1").setValue("Sold today — live").setFontWeight("bold").setFontSize(13);
  if (!data.ok) {
    sheet.getRange("A2").setValue("Updated " + stamp + " — sold-alert read FAILED, numbers not refreshed. Try again shortly.");
    Logger.log("Sold Today tab: read failed; left a notice on the tab.");
    return sheet.getParent().getUrl();
  }
  var rows = data.rows;
  var sum = function (pred) {
    var n = 0, amt = 0;
    rows.forEach(function (r) {
      if (pred(r)) {
        n++;
        amt += r.amount;
      }
    }
    );
    return {
      n: n, amt: amt
    };
  };
  var sameDay = sum(function (r) {
    return r.timing === "SAME-DAY";
  }
  );
  var followUp = sum(function (r) {
    return r.timing === "FOLLOW-UP";
  }
  );
  var unknown = sum(function (r) {
    return r.timing === "UNKNOWN";
  }
  );
  var fireplace = sum(function (r) {
    return r.bucket === "fireplace";
  }
  );
  var hvac = sum(function (r) {
    return r.bucket === "system" || r.bucket === "fireplace";
  }
  );
  var nonSystem = sum(function (r) {
    return r.bucket === "nonsystem";
  }
  );
  var rental = sum(function (r) {
    return r.bucket === "rental";
  }
  );
  var all = sum(function () {
    return true;
  }
  );
  sheet.getRange("A2").setValue("Updated " + stamp + " · " + data.day + " · pre-tax · HCA only · re-quotes counted once · fireplace inside HVAC" + (data.complete === false ? " ! PARTIAL Gmail read, numbers may be low" : "")) .setFontColor("#666666");
  /* Same-day / follow-up first — the headline — then the sold mix. */
  var block = [ ["", "count", "$"], ["Same-day sold", sameDay.n, sameDay.amt], ["Follow-up sold", followUp.n, followUp.amt], ["Unknown (no booking in " + BOOKED_LOOKBACK_DAYS + "d)", unknown.n, unknown.amt], ["", "", ""], ["HVAC (incl. fireplace)", hvac.n, hvac.amt], [" of which fireplace", fireplace.n, fireplace.amt], ["Non-system (ductwork)", nonSystem.n, nonSystem.amt], ["Rental ($0)", rental.n, rental.amt], ["ALL SOLD", all.n, all.amt] ];
  sheet.getRange(4, 1, block.length, 3).setValues(block);
  sheet.getRange(4, 1, 1, 3).setFontWeight("bold");
  sheet.getRange(5, 1, 3, 1).setFontWeight("bold");
  sheet.getRange(4 + block.length - 1, 1, 1, 3).setFontWeight("bold");
  sheet.getRange(4, 3, block.length, 1).setNumberFormat("$#,##0");
  /* ⚠ banner: unresolved double approvals from the last 7 days. */
  var cutoff = Utilities.formatDate(new Date(new Date(data.day + "T12:00:00").getTime() - 7 * 86400000), tz, "yyyy-MM-dd");
  var alarms = (data.doubles || []).filter(function (g) {
    return !g.resolved && g.newestIso >= cutoff;
  }
  );
  var bannerStart = 4 + block.length + 1;
  var bannerLines = 0;
  alarms.forEach(function (g) {
    sheet.getRange(bannerStart + bannerLines, 1) .setValue("⚠ DOUBLE APPROVAL — " + g.customer + ": " + g.summary) .setFontWeight("bold").setFontColor("#b45309");
    sheet.getRange(bannerStart + bannerLines + 1, 1) .setValue(" Two systems, or a wrong click? COD wrong → NOT_A_SALE · rental wrong → NOT_A_RENTAL or Rentals row \"No\" · both real → DOUBLE_OK") .setFontColor("#b45309");
    bannerLines += 2;
  }
  );
  var headRow = bannerStart + (bannerLines ? bannerLines + 1 : 0);
  var headers = ["Timing", "Category", "HCA", "Customer", "Amount", "Ran On", "Sold Estimate"];
  sheet.getRange(headRow, 1, 1, headers.length).setValues([headers]) .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  var order = {
    "SAME-DAY": 0, "FOLLOW-UP": 1, "UNKNOWN": 2
  };
  var detail = rows.slice().sort(function (x, y) {
    return (order[x.timing] - order[y.timing]) || (y.amount - x.amount);
  }
  ).map(function (r) {
    return [r.timing, r.bucket.toUpperCase(), r.hca, r.customer || "(no name)", r.amount, r.ranIso || "", r.name];
  }
  );
  if (detail.length) {
    sheet.getRange(headRow + 1, 1, detail.length, headers.length).setValues(detail);
    sheet.getRange(headRow + 1, 5, detail.length, 1).setNumberFormat("$#,##0.00");
  }
  else {
    sheet.getRange(headRow + 1, 1).setValue("(nothing sold yet today)");
  }
  [90, 95, 150, 190, 105, 95, 340].forEach(function (w, i) {
    sheet.setColumnWidth(i + 1, w);
  }
  );
  stAlarmNewPairs_(data.doubles || []);
  var url = sheet.getParent().getUrl();
  Logger.log("Sold Today tab refreshed — " + all.n + " sold ($" + formatMoney_(Math.round(all.amt)) + "): " + sameDay.n + " same-day, " + followUp.n + " follow-up, " + unknown.n + " unknown" + (alarms.length ? " · ⚠ " + alarms.length + " double approval(s) need a ruling" : "") + ".\n" + url);
  return url;
}
function relabelPipeline_(l2c) {
  var g = l2c.getRange(1, 1, Math.min(l2c.getLastRow(), 20), l2c.getLastColumn()).getValues();
  for (var r = 0;
  r < g.length;
  r++) {
    var row = g[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    if (row.indexOf("date") > -1 && row.indexOf("leads") > -1 && row.indexOf("installs") > -1) {
      var pc = row.indexOf("pipeline");
      if (pc > -1) {
        l2c.getRange(r + 1, pc + 1).setValue("Net Sold − Inst");
        return true;
      }
      return false;
    }
  }
  return false;
}
function remove1on1Nightly() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refresh1on1Now") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  Logger.log("Removed " + n + " nightly 1:1 trigger(s).");
  return "Removed " + n + " nightly 1:1 trigger(s).";
}
function removeDailyHourly() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshDailyGrowth") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  var msg = "Removed " + n + " hourly refreshDailyGrowth trigger(s).";
  Logger.log(msg);
  return msg;
}
function removeEveningFormNudge() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendEveningFormNudge") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  Logger.log(n ? "Removed " + n + " evening-nudge trigger(s)." : "No evening-nudge trigger was installed.");
  return n;
}
function removeGrowthTrigger() {
  var kill = {
    writeGrowthDays: 1, previewWriteGrowthDays: 1,
    writeGrowthSheetForYesterday: 1, refreshTodayGrowth: 1,
    writeGrowthSheetDay: 1, installGrowthTriggers: 1
  };
  var n = 0, names = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (kill[fn]) {
      ScriptApp.deleteTrigger(t);
      n++;
      names.push(fn);
    }
  })
  ;
  var msg = "Removed " + n + " old Growth trigger(s)" +
    (names.length ? ": " + names.join(", ") : "") + ".";
  Logger.log(msg);
  return msg;
}
function removeHourlyGrowthUpdate() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshTodayGrowth") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  if (n) Logger.log("Removed " + n + " hourly growth trigger(s).");
  return n;
}
function removeL2CHourly() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "buildL2CTab") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  Logger.log(n ? "Removed " + n + " buildL2CTab trigger(s)." : "No buildL2CTab trigger was installed.");
  return n;
}
function removeL2CPlus() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "buildL2CTabPlus") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  ScriptApp.newTrigger("buildL2CTab").timeBased().everyHours(1).create();
  var msg = "Reverted: removed " + n + " buildL2CTabPlus trigger(s); restored hourly buildL2CTab.";
  Logger.log(msg);
  return msg;
}
function removeRecapFormTrigger() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "importRecapFormResponses") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  })
  ;
  if (n) Logger.log("Removed " + n + " form-import trigger(s).");
  return n;
}
function removeSoldTodayLive() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshSoldTodayTab") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  }
  );
  if (n) Logger.log("Removed " + n + " Sold Today refresh trigger(s).");
  return n;
}
function rentalRecurring(fromIso, toIso) {
  const cfg = DAILY_RECAP_CONFIG;
  const today = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  const to = String(toIso || today).slice(0, 10);
  const from = String(fromIso || (today.slice(0, 8) + "01")).slice(0, 10);
  const book = getLogSpreadsheet_();
  const sheet = book.ss.getSheetByName(RENTAL_SHEET_NAME);
  if (!sheet) return "No Rentals tab yet — run refreshRentalRegister() first.";
  const last = sheet.getLastRow();
  if (last < RENTAL_FIRST_DATA_ROW) return "Rentals tab is empty.";
  const rows = sheet.getRange(RENTAL_FIRST_DATA_ROW, 1,
    last - RENTAL_HEADER_ROW, RENTAL_HEADERS.length).getValues();
  let count = 0, monthly = 0, unanswered = 0, noAmount = 0;
  rows.forEach(r => {
    const iso = String(normalizeSheetDate_(r[0]) || r[0] || "").slice(0, 10);
    if (!iso || iso < from || iso > to) return;
    if (String(r[RENTAL_COL_ISRENTAL]).trim() === "") {
      unanswered++;
      return;
    }
    if (String(r[RENTAL_COL_ISRENTAL]).trim().toLowerCase() !== "yes") return;
    count++;
    const raw = r[RENTAL_COL_MONTHLY];
    const m = Number(raw);
    /* A confirmed rental with no payment typed adds nothing, so the total is
    low by however many of these there are. Said out loud, every time. */
    if (String(raw).trim() === "" || !isFinite(m) || m <= 0) {
      noAmount++;
      return;
    }
    monthly += m;
  })
  ;
  const out = "Rentals " + from + " to " + to + ": " + count + " confirmed, $" +
    monthly.toFixed(2) + "/month recurring, $" + (monthly * CAAS_TERM_MONTHS).toFixed(2) +
    " gross contract value at " + CAAS_TERM_MONTHS + " months." +
    (noAmount ? "  " + noAmount + " confirmed rental(s) have no monthly typed yet, so this total is LOW." : "") +
    (unanswered ? "  " + unanswered + " row(s) still have no Yes/No and are excluded entirely." : "");
  Logger.log(out);
  return out;
}
function reprocessAllRecapDates(previewOnly) {
  const book = getLogSpreadsheet_();
  const sheet = book.ss.getSheetByName(DAILY_RECAP_CONFIG.logSheetName);
  if (!sheet) throw new Error("No Recap Log sheet found.");
  const last = sheet.getLastRow();
  if (last < 2) return "Recap Log is empty.";
  const seen = {
  };
  sheet.getRange(2, 1, last - 1, 1).getValues().forEach(r => {
    const iso = normalizeSheetDate_(r[0]) || String(r[0] || "").trim().slice(0, 10);
    if (iso) seen[iso] = true;
  })
  ;
  const dates = Object.keys(seen).sort();
  if (!dates.length) return "No dated rows in the Recap Log.";
  Logger.log("Re-pricing " + dates.length + " date(s): " + dates[0] + " to " + dates[dates.length - 1]);
  return reprocessRecapDates(dates, previewOnly);
}
function reprocessRecapDates(isoDates, previewOnly) {
  const wanted = {
  };
  (isoDates || []).forEach(d => {
    wanted[String(d).trim()] = true;
  })
  ;
  if (!Object.keys(wanted).length) {
    throw new Error('Give me at least one date, e.g. ["2026-07-30"]. ' +
      'From the Run dropdown use previewReprocessThursdayAndFriday instead.');
  }
  const book = getLogSpreadsheet_();
  const sheet = book.ss.getSheetByName(DAILY_RECAP_CONFIG.logSheetName);
  if (!sheet) throw new Error("No Recap Log sheet found.");
  if (!previewOnly) ensureRecapLogColumns_(sheet);
  const H = RECAP_LOG_HEADERS;
  const col = name => H.indexOf(name);
  /* 0-based */
  const cDate = col("Date"), cHca = col("HCA"), cCust = col("Customer");
  const cDeal = col("Deal Offered"), cAmt = col("Deal Amount"), cUnit = col("Deal Unit");
  const cOne = col("One-time $"), cMo = col("CaaS Monthly $");
  const cVal = col("CaaS Contract $"), cAlt = col("Alternatives?");
  const last = sheet.getLastRow();
  if (last < 2) return "Recap Log is empty.";
  /* Clamped to the grid. ensureRecapLogColumns_ has already widened it on the
  live path, but preview deliberately writes nothing — and asking a
  13-column sheet for 17 columns throws, which would break the very command
  the instructions tell you to run first. */
  const width = Math.min(Math.max(sheet.getLastColumn(), H.length), sheet.getMaxColumns());
  const range = sheet.getRange(2, 1, last - 1, width);
  const values = range.getValues();
  const changes = [];
  const kept = [];
  values.forEach((row, i) => {
    const iso = normalizeSheetDate_(row[cDate]) || String(row[cDate] || "").trim();
    const key = String(iso).slice(0, 10);
    if (!wanted[key]) return;
    const deal = String(row[cDeal] || "").trim();
    if (!deal) return;
    /* nothing to re-price */
    const r = parseDealAmount_(deal);
    const oneTime = r.oneTime === null ? "" : r.oneTime;
    const caasMo = r.monthlyAmount === null ? "" : r.monthlyAmount;
    const caasVal = caasMo === "" ? "" : caasContractValue_(caasMo);
    /* NEVER TRADE A FIGURE FOR A BLANK. If the new parser reads nothing out of a
    line that already carries an amount, the row is left exactly as it is and
    reported below. Backfills are re-run casually; one that can delete data is
    not safe to re-run, whatever the docstring says. */
    const filled = v => v !== "" && v !== null && v !== undefined;
    const hadAmount = filled(row[cAmt]) || filled(row[cOne]) || filled(row[cMo]);
    if (oneTime === "" && caasMo === "" && hadAmount) {
      kept.push({
        rowNumber: i + 2, date: key, hca: row[cHca],
                  customer: row[cCust], amount: row[cAmt], deal: deal
      })
      ;
      return;
    }
    const unit = dealUnitFor_(deal, oneTime, caasMo, r.mentionsMonthly);
    const before = {
      amount: row[cAmt], unit: row[cUnit]
    };
    /* Deal Amount keeps its legacy meaning: the headline figure. */
    row[cAmt] = r.amount === null ? "" : r.amount;
    row[cUnit] = unit;
    row[cOne] = oneTime;
    row[cMo] = caasMo;
    row[cVal] = caasVal === null ? "" : caasVal;
    row[cAlt] = r.alternatives ? "Yes" : "";
    changes.push({
      rowNumber: i + 2,
      date: key,
      hca: row[cHca],
      customer: row[cCust],
      wasAmount: before.amount,
      wasUnit: before.unit,
      oneTime: oneTime,
      caasMonthly: caasMo,
      caasContract: caasVal,
      unit: unit,
      alternatives: r.alternatives,
      moved: String(before.amount) !== String(row[cAmt]) || String(before.unit) !== String(row[cUnit])
    })
    ;
  })
  ;
  if (!previewOnly && changes.length) range.setValues(values);
  const moved = changes.filter(c => c.moved);
  const lines = [];
  lines.push((previewOnly ? "PREVIEW — nothing written. " : "") +
    changes.length + " priced row(s) in " + (isoDates || []).join(", ") +
    "; " + moved.length + " changed value or unit" +
    (kept.length ? "; " + kept.length + " LEFT ALONE (new parser read no figure)." : "."));
  kept.forEach(c => {
    lines.push("  row " + c.rowNumber + "  " + c.date + "  " + c.hca + " / " + (c.customer || "(no name)") +
      "\n      kept " + c.amount + " — new parser read nothing from: " + c.deal);
  })
  ;
  moved.forEach(c => {
    lines.push("  row " + c.rowNumber + "  " + c.date + "  " + c.hca + " / " + (c.customer || "(no name)") +
      "\n      was  " + (c.wasAmount === "" ? "—" : c.wasAmount) + " " + c.wasUnit +
      "\n      now  one-time " + (c.oneTime === "" ? "—" : c.oneTime) +
      " | CaaS " + (c.caasMonthly === "" ? "—" : c.caasMonthly + "/mo") +
      (c.caasContract ? " (" + Math.round(c.caasContract) + " over " + CAAS_TERM_MONTHS + " mo)" : "") +
      " | " + c.unit + (c.alternatives ? " | alternatives" : ""));
  })
  ;
  const out = lines.join("\n");
  Logger.log(out);
  return out;
}
function restructureGrowthTabs() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var order = ["Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var col = function (c) {
    return String.fromCharCode(64 + c);
  };
  // 3->C, 4->D, 5->E
  var priorSelfGen = [];
  // {tab,row} for the Self Gen MTD roll-up
  var out = [], warns = [];
  order.forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) {
      out.push(tabName + ": no tab");
      return;
    }
    var last = sh.getLastRow();
    var colB = sh.getRange(1, 2, last, 1).getValues();
    var r = {
    };
    for (var i = 0;
    i < colB.length;
    i++) {
      var lbl = String(colB[i][0]).trim().toLowerCase();
      if (lbl === "hvac marketed leads" || lbl === "total sold (not tech flip)") r.top = i + 1;
      if (lbl === "hvac marketed deals") r.mktDeals = i + 1;
      if (lbl === "marketed l2c %") r.l2c = i + 1;
      if (lbl === "hvac avg ticket") r.avg = i + 1;
      if (lbl === "total hvac sold" || lbl === "self gen") r.self = i + 1;
    }
    // --- Self Gen row (from Total HVAC Sold, or insert one under AVG Ticket) ---
    if (!r.self) {
      if (!r.avg) {
        out.push(tabName + ": no AVG Ticket row — skipped");
        return;
      }
      sh.insertRowAfter(r.avg);
      r.self = r.avg + 1;
      sh.getRange(r.avg, 1, 1, 6).copyTo(sh.getRange(r.self, 1, 1, 6), {
        formatOnly: true
      })
      ;
      sh.getRange(r.self, 3, 1, 3).setNumberFormat("0");
      sh.getRange(r.self, 6).clearContent();
    }
    sh.getRange(r.self, 2).setValue("Self Gen").setFontWeight("bold");
    sh.getRange(r.self, 3).clearContent();
    // Sat / blank — you type in
    sh.getRange(r.self, 4).clearContent();
    // day — you type in
    priorSelfGen.push({
      tab: tabName, row: r.self
    })
    ;
    var sg = priorSelfGen.map(function (p) {
      var nm = "'" + p.tab.replace(/'/g, "''") + "'";
      return nm + "!C" + p.row + "+" + nm + "!D" + p.row;
    })
    ;
    sh.getRange(r.self, 5).setFormula("=" + sg.join("+"));
    // MTD self gen rolls up
    // --- Top row: Total Sold (not Tech Flip) = Marketed Deals + Self Gen ---
    if (r.top && r.mktDeals) {
      sh.getRange(r.top, 2).setValue("Total Sold (not Tech Flip)").setFontWeight("bold");
      var dayCols = (tabName === "Weekend") ? [3, 4] : [4];
      dayCols.forEach(function (c) {
        sh.getRange(r.top, c).setFormula("=" + col(c) + r.mktDeals + "+" + col(c) + r.self);
      })
      ;
      if (tabName !== "Weekend") sh.getRange(r.top, 3).clearContent();
      // keep C blank on single-day tabs
      sh.getRange(r.top, 5).setFormula("=E" + r.mktDeals + "+E" + r.self);
      // MTD
    }
    else {
      warns.push(tabName + ": couldn't find Marketed Leads/Deals to build the not-Tech-Flip row");
    }
    // --- Flag the orphaned Marketed L2C % ---
    if (r.l2c && String(sh.getRange(r.l2c, 5).getFormula() || sh.getRange(r.l2c, 4).getFormula())) {
      warns.push(tabName + ": 'Marketed L2C %' is still a formula that divided by the old Leads row — decide what to do with it.");
    }
    out.push(tabName + ": top row " + (r.top || "?") + ", Self Gen row " + r.self);
  })
  ;
  SpreadsheetApp.flush();
  Logger.log("Restructured " + out.length + " tab(s):\n  " + out.join("\n  ") +
    (warns.length ? "\n\nHeads-up:\n  " + warns.join("\n  ") : "") +
    "\n\nSelf Gen day cells are blank for you to fill; they feed 'Total Sold (not Tech Flip)' (day + MTD) automatically.");
  return out.join("\n");
}
function runCollection_(when, isBackfill) {
  const now = new Date();
  const plan = buildTodayPlan_(when);
  const lastRun = isBackfill ? null : readLastDigestRun_();
  const ageDays = Math.max(0, Math.round((now.getTime() - when.getTime()) / 86400000));
  const lookback = isBackfill
    ? Math.max(DAILY_RECAP_CONFIG.replyLookbackDays, ageDays + 2)
    : DAILY_RECAP_CONFIG.replyLookbackDays;
  const found = findRecapReplies_(plan.dateLabel, lastRun, lookback);
  if (!found.ok) {
    const msg = "Recap collection for " + plan.dateLabel +
      " ABORTED — the Gmail search failed, so replies could not be read.\n\n" +
      "Nothing was written to the log or the compliance sheet, no digest was\n" +
      "sent, and the last-run marker was NOT advanced. The next run covers\n" +
      "this window again, so no reply is lost by stopping here.\n\n" +
      "If this repeats, check the Apps Script quota and authorization.";
    Logger.log(msg);
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.managerEmail],
      subject: "Daily Recap warning — reply collection aborted, " + plan.dateLabel,
      body: msg
    })
    ;
    return {
      ok: false, aborted: "reply search failed",
      replied: 0, missing: 0, late: 0, logged: 0
    };
  }
  const replies = found.replies;
  const byHca = {
  };
  const late = [];
  const responded = {
  };
  // replied at all, whether or not anything parsed
  const notesOnly = {
  };
  // replied, but reported no appointments
  const followUpsByHca = {
  };
  // day-level backlog work, independent of appointments
  replies.forEach(r => {
    if (r.late) {
      late.push(r);
      return;
    }
    responded[r.hca.name] = true;
    if (r.followUps) {
      followUpsByHca[r.hca.name] = followUpsByHca[r.hca.name]
        ? followUpsByHca[r.hca.name] + "\n" + r.followUps
        : r.followUps;
    }
    if (!r.entries.length) {
      if (r.note && !notesOnly[r.hca.name]) notesOnly[r.hca.name] = {
        hca: r.hca, note: r.note
      };
      return;
    }
    delete notesOnly[r.hca.name];
    if (!byHca[r.hca.name]) byHca[r.hca.name] = {
      hca: r.hca, entries: []
    };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
  })
  ;
  /* ADD #1 — the Google Form is a second recap gate. An HCA who filled the
  Form for this day counts as reported, exactly like an email reply, so
  they drop off "missing" below and read as reported on the compliance tab.
  Their appointment detail lives in the Form Responses tab. */
  const formCounts = formRecapNames_(plan);
  Object.keys(formCounts).forEach(function (nm) {
    responded[nm] = true;
  })
  ;
  /* formCounts carries a per-HCA submission count, not just a name set, and it
     is passed to appendComplianceRows_ so the Appointments Reported column
     reflects Form submissions too — not only email replies. */
  /* Silence only. Someone who replied to say they ran nothing has reported,
  and grouping them with people who ignored the email misrepresents them. */
  const missing = plan.working.filter(h => !responded[h.name]);
  let logResult = {
    ok: false, error: "", written: 0, skipped: 0, url: "", created: false,
    lateWritten: 0, lateUndated: 0, lateMarked: []
  };
  try {
    const book = getLogSpreadsheet_();
    const wrote = appendRecapRows_(book.ss, plan, byHca);
    appendComplianceRows_(book.ss, plan, byHca, responded, followUpsByHca, formCounts);
    const lateRes = late.length
      ? logRepliesByNight_(book.ss, late)
      : {
      written: 0, skipped: 0, undated: 0, marked: []
    };
    logResult = {
      ok: true, error: "",
      written: wrote.written + lateRes.written, skipped: wrote.skipped + lateRes.skipped,
      url: book.ss.getUrl(), created: book.created,
      lateWritten: lateRes.written, lateUndated: lateRes.undated, lateMarked: lateRes.marked
    };
  }
  catch (err) {
    logResult.error = err && err.message ? err.message : String(err);
    Logger.log("Recap log write failed: " + logResult.error);
  }
  /* ADD #2 — hand the Form counts to the digest so it can show them. */
  const body = buildDigestBody_(plan, byHca, missing, late, logResult, notesOnly, followUpsByHca, formCounts);
  sendEmailSafe_({
    to: [DAILY_RECAP_CONFIG.managerEmail],
    subject: (isTestMode_() ? "[TEST] " : "") +
      (isBackfill ? "Recap Backfill — " : "Recap Digest — ") + plan.dateLabel,
    body: body
  })
  ;
  if (!isBackfill) writeLastDigestRun_(now);
  Logger.log((isBackfill ? "Backfill" : "Digest") + " for " + plan.dateLabel + ": " +
    Object.keys(byHca).length + " replied, " + Object.keys(formCounts).length + " via form, " +
    missing.length + " missing, " + late.length + " late, " + logResult.written + " row(s) logged.");
  return {
    replied: Object.keys(byHca).length, missing: missing.length,
    late: late.length, logged: logResult.written
  };
}
function runMorningFollowUp_(workingToday) {
  const cfg = DAILY_RECAP_CONFIG;
  if (!cfg.nudgeEnabled) return {
    acked: 0, nudged: 0, reason: "disabled"
  };
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const past = buildTodayPlan_(yesterday);
  if (!past.working.length) return {
    acked: 0, nudged: 0, reason: "nobody was scheduled yesterday"
  };
  const found = findRecapReplies_(past.dateLabel, null);
  if (!found.ok) {
    /* Without a reliable read there is no safe move: chasing someone who
    replied and thanking someone who did not are both worse than silence. */
    Logger.log("Morning follow-up skipped — reply search failed.");
    return {
      acked: 0, nudged: 0, reason: "reply search failed"
    };
  }
  const byHca = {
  };
  found.replies.forEach(r => {
    if (!byHca[r.hca.name]) byHca[r.hca.name] = {
      hca: r.hca, entries: [], followUps: ""
    };
    byHca[r.hca.name].entries = byHca[r.hca.name].entries.concat(r.entries);
    if (r.followUps) {
      byHca[r.hca.name].followUps = byHca[r.hca.name].followUps
        ? byHca[r.hca.name].followUps + "\n" + r.followUps
        : r.followUps;
    }
  })
  ;
  const todayPlan = buildTodayPlan_(now);
  const onShiftToday = {
  };
  todayPlan.working.forEach(h => {
    onShiftToday[h.name] = true;
  })
  ;
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
    })
    ;
    return {
      acked: 0, nudged: 0, previewed: toAck.length + toNudge.length
    };
  }
  toAck.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      subject: "Re: " + cfg.subjectPrefix + " — " + past.dateLabel,
      body: buildAckBody_(hca, past.dateLabel, byHca[hca.name])
    })
    ;
  })
  ;
  toNudge.forEach(hca => {
    sendEmailSafe_({
      to: [hca.email],
      /* "Re:" on the original subject keeps this in the same conversation, so
      a reply still carries yesterday's date and is attributed to the right
      night by findRecapReplies_. */
      subject: "Re: " + cfg.subjectPrefix + " — " + past.dateLabel,
      body: buildNudgeBody_(hca, past.dateLabel)
    })
    ;
  })
  ;
  Logger.log("Morning follow-up (" + (workingToday ? "working" : "off") + "): " +
    toAck.length + " thanked, " + toNudge.length + " nudged, for " + past.dateLabel);
  return {
    acked: toAck.length, nudged: toNudge.length
  };
}
function sameDaySoldMonthData_OLD_20260821() {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var now = new Date();
  var fromIso = Utilities.formatDate(now, tz, "yyyy-MM") + "-01";
  var toIso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  /* Same reader as Sold Today: HCA-only, year-safe dates, real amount parse. */
  var res = readSoldAlerts_(40);
  if (!res.ok) return {
    ok: false, fromIso: fromIso, toIso: toIso, days: {
    },
    tz: tz
  };
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);
  var collapsed = collapse.alerts
    .filter(function (a) {
    return a.soldOnIso >= fromIso && a.soldOnIso <= toIso;
  })
  .filter(function (a) {
    /* honor the approval-guard rulings (phantom rentals / phantom CODs) */
    if (typeof stExcluded_ !== "function") return true;
    return !(a.growthRevisionMembers || [a]).some(function (member) {
      return stExcluded_(member);
    });
  })
  ;
  var mtdRevisedGroups = 0, mtdSupersededAlerts = 0;
  collapsed.forEach(function (alert) {
    var revisions = Number(alert.growthRevisionCount) || 1;
    if (revisions > 1) mtdRevisedGroups++;
    mtdSupersededAlerts += Math.max(0, revisions - 1);
  });
  var qualifying = [];
  var excluded = { count: 0, dollars: 0, amountCount: 0, sellerCount: 0 };
  collapsed.forEach(function (alert) {
    var decision = growthSoldQualification_(alert);
    if (decision.included) {
      qualifying.push(alert);
      return;
    }
    excluded.count++;
    excluded.dollars += decision.amount;
    if (decision.reason === "seller") excluded.sellerCount++;
    else excluded.amountCount++;
  });
  var booked = readBookedJobs_((typeof BOOKED_LOOKBACK_DAYS !== "undefined") ? BOOKED_LOOKBACK_DAYS : 60);
  var days = {
  };
  var unmatchedFollowUp = 0;
  qualifying.forEach(function (a) {
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var cls = growthClassifyLatestSale_(a, booked);
    var d = days[a.soldOnIso] = days[a.soldOnIso] || {
      total: 0, same: 0, follow: 0, unknown: 0, dollars: 0
    };
    d.total++;
    d.dollars += amt;
    if (cls.tag === "SAME-DAY") d.same++;
    else d.follow++;
    if (!cls.matched) unmatchedFollowUp++;
  })
  ;
  return {
    ok: true, complete: res.complete, fromIso: fromIso, toIso: toIso,
    days: days, tz: tz, includedCount: qualifying.length, excluded: excluded,
    dedupe: Object.assign({}, collapse.diagnostics, {
      mtdUniqueBeforeQualification: collapsed.length,
      mtdIncluded: qualifying.length,
      mtdRevisedGroups: mtdRevisedGroups,
      mtdSupersededAlerts: mtdSupersededAlerts
    }),
    unmatchedFollowUp: unmatchedFollowUp,
    qualification: "amount > $" + GROWTH_HVAC_SOLD_MIN_DOLLARS +
      " and seller in RECAP_ROSTER / approved manager sellers"
  };
}
function sameDayVsFollowup(fromIso, toIso) {
  var tz = bjTz_();
  var today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  // default: yesterday
  var yday = Utilities.formatDate(new Date(new Date().getTime() - 864e5), tz, "yyyy-MM-dd");
  var from = String(fromIso || yday).slice(0, 10);
  var to = String(toIso || from).slice(0, 10);
  var sold = readSoldForSameday_(from, to, BOOKED_LOOKBACK_DAYS);
  var booked = readBookedJobs_(BOOKED_LOOKBACK_DAYS);
    // de-dupe superseded/duplicate: one row per Job# + Estimate#, keep the highest amount
  var byJob = {
  };
  sold.forEach(function (s) {
    var key = s.job + "|" + (s.est || "");
    if (!byJob[key] || s.amount > byJob[key].amount) byJob[key] = s;
  })
  ;
  var rows = Object.keys(byJob).map(function (j) {
    return byJob[j];
  })
  ;
  var same = 0, follow = 0, unknown = 0;
  var perRep = {
  };
  var detail = [];
  rows.forEach(function (s) {
    var c = classifySameDay_(s, booked);
    if (c.tag === "SAME-DAY") same++;
    else if (c.tag === "FOLLOW-UP") follow++;
    else unknown++;
    var r = perRep[s.rep] = perRep[s.rep] || {
      same: 0, follow: 0, unknown: 0
    };
    if (c.tag === "SAME-DAY") r.same++;
    else if (c.tag === "FOLLOW-UP") r.follow++;
    else r.unknown++;
    detail.push({
      s: s, c: c
    })
    ;
  })
  ;
  var lines = ["Same-day vs follow-up (system sales), " + from + (to !== from ? " to " + to : "") + ":"];
  lines.push("  SAME-DAY: " + same + "   FOLLOW-UP: " + follow +
    (unknown ? "   UNKNOWN: " + unknown + " (booking older than " + BOOKED_LOOKBACK_DAYS + "d)" : "") +
    "   of " + rows.length + " system sale(s).");
  lines.push("");
  Object.keys(perRep).sort().forEach(function (rep) {
    var r = perRep[rep];
    lines.push("  " + rep + ": " + r.same + " same-day, " + r.follow + " follow-up" +
      (r.unknown ? ", " + r.unknown + " unknown" : ""));
  })
  ;
  lines.push("");
  detail.sort(function (a, b) {
    return a.c.tag.localeCompare(b.c.tag) || b.s.amount - a.s.amount;
  })
  ;
  detail.forEach(function (d) {
    lines.push("  " + (d.c.tag + "        ").slice(0, 10) + (d.s.customer || "(cust?)") +
      " / " + d.s.rep + "  $" + d.s.amount.toFixed(2) +
      "  sold " + d.s.soldMD + (d.c.ranIso ? ", ran " + d.c.ranIso.slice(5) : ", run date not found") +
      "  job " + d.s.job);
  })
  ;
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function sameEstimateName_(a, b) {
  const tokens = v => {
    const cleaned = String(v || "").toLowerCase()
    /* Revision markers, and the dates reps stamp into a re-quote's name. */
    .replace(/\b(updated?|new|copy|revision|rev|final|orig(inal)?)\b/g, " ")
      .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ")
      .replace(/[^a-z0-9]+/g, " ");
    const out = {
    };
    cleaned.split(" ").forEach(t => {
      if (t && t.length > 1) out[t] = true;
    })
    ;
    return Object.keys(out);
  };
  const ta = tokens(a), tb = tokens(b);
  /* No name to compare on either side — fall back to merging, which is what
  this did before names were considered at all. */
  if (!ta.length || !tb.length) return true;
  const inB = {
  };
  tb.forEach(t => {
    inB[t] = true;
  })
  ;
  const shared = ta.filter(t => inB[t]).length;
  return shared >= Math.ceil(Math.min(ta.length, tb.length) * 0.6);
}
function scorecardAudit() {
  var deadType = {
    installDailyHourly: typeof installDailyHourly,
    removeDailyHourly: typeof removeDailyHourly,
    refreshDailyGrowth: typeof refreshDailyGrowth,
    previewBIPipeline: typeof previewBIPipeline,
    importBIPipeline: typeof importBIPipeline,
    bipipe_: typeof bipipe_,
    relabelPipeline_: typeof relabelPipeline_,
    previewTitanRan: typeof previewTitanRan,
    writeTitanRanEstimate: typeof writeTitanRanEstimate,
    titanRan_: typeof titanRan_,
    wireDailySold: typeof wireDailySold,
    writeGrowthDays: typeof writeGrowthDays,
    previewWriteGrowthDays: typeof previewWriteGrowthDays,
    writeGrowthSheetForYesterday: typeof writeGrowthSheetForYesterday,
    refreshTodayGrowth: typeof refreshTodayGrowth,
    writeGrowthSheetDay: typeof writeGrowthSheetDay,
    installGrowthTriggers: typeof installGrowthTriggers,
    removeGrowthTrigger: typeof removeGrowthTrigger,
    showAllTriggers: typeof showAllTriggers
  };
  var stillDead = [];
  Object.keys(deadType).forEach(function (n) {
    if (deadType[n] === "function") stillDead.push(n);
  })
  ;
  var engine = "buildL2CTab=" + (typeof buildL2CTab) +
    ", sameDaySoldMonthData_=" + (typeof sameDaySoldMonthData_) +
    ", l2cLabelIso_=" + (typeof l2cLabelIso_);
  var layer = "buildL2CTabPlus=" + (typeof buildL2CTabPlus) +
    ", decorateL2C_=" + (typeof decorateL2C_) +
    ", readSameDaySplit_=" + (typeof readSameDaySplit_) +
    ", installL2CPlus=" + (typeof installL2CPlus) +
    ", removeL2CPlus=" + (typeof removeL2CPlus);
  var trigs = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction() + (t.getEventType() === ScriptApp.EventType.CLOCK ? " [time]" : "");
  })
  ;
  var msg = "=== SCORECARD AUDIT ===\n" +
    "Dead functions still PRESENT (delete these blocks): " + (stillDead.length ? stillDead.join(", ") : "none — clean!") + "\n\n" +
    "Engine (must all be 'function'): " + engine + "\n" +
    "Scorecard layer (must all be 'function'): " + layer + "\n\n" +
    "Triggers (" + trigs.length + "): " + (trigs.join(" · ") || "(none)") + "\n" +
    "  ↳ for the scorecard you want exactly ONE time-driven: buildL2CTabPlus.";
  Logger.log(msg);
  return msg;
}
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
    })
    ;
    Logger.log("TEST_MODE: one preview email sent to " + DAILY_RECAP_CONFIG.testRecipient +
      " covering " + plan.working.length + " HCA(s). No HCA was contacted.");
    return plan;
  }
  const owedBy = whoStillOwesYesterday_(now);
  const failed = [];
  plan.working.forEach(hca => {
    const sent = sendEmailSafe_({
      to: [hca.email],
      subject: DAILY_RECAP_CONFIG.subjectPrefix + " — " + plan.dateLabel,
      body: buildRecapBody_(hca, plan.dateLabel, owedBy[hca.name] || "")
    })
    ;
    if (!sent) failed.push(hca.name);
  })
  ;
  if (!plan.exceptions.ok) {
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.managerEmail],
      subject: "Daily Recap warning — Schedule Exceptions sheet unreadable",
      body: "The recap for " + plan.dateLabel + " went out using base schedules only.\n\n" +
        "The Schedule Exceptions sheet could not be read, so Sick / Vacation / Swap\n" +
        "overrides were NOT applied. Anyone out today was emailed anyway.\n\n" +
        "Error: " + plan.exceptions.error
    })
    ;
  }
  /*
  * Recorded after the send, so a run that threw partway does not lock the day
  * out. Recorded only for a real send — a test-mode preview contacts nobody
  * and must not block the real one.
  *
  * And recorded only if EVERY recipient got theirs. sendEmailSafe_ swallows a
  * quota or delivery error to keep one bad address from killing the loop, so
  * writing the marker unconditionally meant a failed send still counted as
  * sent — and the duplicate-send guard then refused the retry. The people who
  * got nothing stayed with nothing, the log said the recap went out, and only
  * somebody noticing by eye and running forceSendDailyRecap could undo it.
  *
  * Leaving the marker unwritten costs a duplicate email to those who did
  * receive one. That is the cheaper mistake by a distance.
  */
  if (failed.length) {
    const msg = "The recap for " + plan.dateLabel + " did NOT reach " +
      failed.length + " of " + plan.working.length + " HCA(s):\n\n  " +
      failed.join("\n  ") + "\n\n" +
      "The day has deliberately NOT been marked as sent, so the next run — or\n" +
      "sendDailyRecap by hand — will try again. Anyone who did get theirs may\n" +
      "receive a second copy; that is the intended trade.\n\n" +
      "Usual cause is the daily MailApp quota. Check it before re-running.";
    Logger.log(msg);
    sendEmailSafe_({
      to: [DAILY_RECAP_CONFIG.managerEmail],
      subject: "Daily Recap warning — " + failed.length + " recap(s) failed to send, " +
        plan.dateLabel,
      body: msg
    })
    ;
    plan.sendFailures = failed;
    return plan;
  }
  writeLastRealSend_(plan.isoDate);
  Logger.log("Sent recap to " + plan.working.length + " HCA(s) for " + plan.dateLabel);
  return plan;
}
function sendEmailSafe_(message) {
  try {
    const to = (message.to || []).filter(Boolean).join(",");
    if (!to) return true;
    MailApp.sendEmail({
      to: to,
      subject: message.subject || "CM Heating Daily Recap",
      body: message.body || "",
      name: DAILY_RECAP_CONFIG.fromName
    })
    ;
    return true;
  }
  catch (err) {
    Logger.log("Daily recap email failed: " + (err && err.message ? err.message : String(err)));
    return false;
  }
}
function sendEveningFormNudge() {
  var now = new Date();
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var iso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var r = enCreditedToday_(now);
  if (!r.plan.working.length) {
    Logger.log("Evening nudge: nobody scheduled today.");
    return "nobody scheduled";
  }
  var already = enAlreadyNudged_(iso);
  var toNudge = r.plan.working.filter(function (h) {
    return !r.credited[enNorm_(h.name)] && already.indexOf(enNorm_(h.name)) < 0;
  })
  ;
  if (!toNudge.length) {
    Logger.log("Evening nudge: everyone scheduled today has filed (or was already nudged). Nothing sent.");
    return "nothing to send";
  }
  var testing = false;
  try {
    testing = isTestMode_();
  }
  catch (e2) {
  }
  if (testing) {
    var to = "";
    try {
      to = DAILY_RECAP_CONFIG.testRecipient;
    }
    catch (e3) {
    }
    sendEmailSafe_({
      to: [to],
      subject: "[TEST] Evening form nudge — " + r.plan.dateLabel,
      body: "TEST MODE — no HCA was contacted.\n\nWould nudge " + toNudge.length + ":\n" +
        toNudge.map(function (h) {
        return "  - " + h.name;
      })
      .join("\n") + "\n\n" +
        new Array(70).join("=") + "\n\n" + enNudgeBody_(toNudge[0], r.plan.dateLabel)
    })
    ;
    Logger.log("Evening nudge (TEST): would nudge " + toNudge.map(function (h) {
      return h.name;
    })
    .join(", "));
    return "test preview sent";
  }
  var sent = [];
  toNudge.forEach(function (h) {
    var okSend = sendEmailSafe_({
      to: [h.email],
      /* "Re:" keeps it in today's thread, so a reply still lands on the right day. */
      subject: "Re: " + DAILY_RECAP_CONFIG.subjectPrefix + " — " + r.plan.dateLabel,
      body: enNudgeBody_(h, r.plan.dateLabel)
    })
    ;
    if (okSend) sent.push(enNorm_(h.name));
  })
  ;
  enRememberNudged_(iso, already.concat(sent));
  var msg = "Evening nudge sent to " + sent.length + ": " +
    toNudge.map(function (h) {
    return h.name;
  })
  .join(", ");
  Logger.log(msg);
  return msg;
}
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
  })
  ;
  Logger.log(brief.body);
  return brief;
}
function showAllTriggers() {
  var ts = ScriptApp.getProjectTriggers();
  var lines = ts.map(function (t) {
    var kind = (t.getEventType() === ScriptApp.EventType.CLOCK) ? "TIME-DRIVEN" : String(t.getEventType());
    return "• " + t.getHandlerFunction() + "   [" + kind + "]";
  })
  ;
  var msg = ts.length + " trigger(s) in this project:\n" + (lines.join("\n") || "(none)");
  Logger.log(msg);
  return msg;
}
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
  })
  ;
  Logger.log("Run resumeHcaNow with PAUSE_HCA_NAME set to put someone back.");
  return names;
}
function showRecapTriggers() {
  const lines = ["Scheduled triggers on this project:"];
  ScriptApp.getProjectTriggers().forEach(t => {
    let when = "";
    try {
      when = String(t.getTriggerSource());
    }
    catch (err) {
      when = "?";
    }
    lines.push("  " + t.getHandlerFunction() + "   (" + when + ", id " + t.getUniqueId() + ")");
  })
  ;
  lines.push("Apps Script does not expose the hour of a time trigger, so check the " +
    "clock icon in the editor if you need to confirm one.");
  const msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function signedSupersedes(days) {
  var d = Number(days) || 30;
  var res = readSignedAlerts_(d);
  if (!res.ok) return "Signed alert read failed — see the log.";
  var byOpp = {
  };
  res.alerts.forEach(function (a) {
    var k = a.opportunityNumber || ("est:" + a.estimateNumber);
    (byOpp[k] = byOpp[k] || []).push(a);
  })
  ;
  var lines = ["Opportunities signed more than once in the last " + d + " days:"];
  var n = 0;
  Object.keys(byOpp).forEach(function (k) {
    var g = byOpp[k];
    if (g.length < 2) return;
    n++;
    g.sort(function (x, y) {
      return x.received - y.received;
    })
    ;
    lines.push("  opportunity " + k + " — " + (g[0].customer || "(no name)"));
    g.forEach(function (a, i) {
      lines.push("      " + (i === g.length - 1 ? "LATEST " : "earlier") +
        "  est " + a.estimateNumber + "  $" + a.amount.toFixed(2) + "  " +
        Utilities.formatDate(a.received, DAILY_RECAP_CONFIG.timeZone, "M/d h:mm a"));
    })
    ;
    var latest = g[g.length - 1].amount, sum = 0;
    g.forEach(function (a) {
      sum += a.amount;
    })
    ;
    lines.push("      counting only the latest: $" + latest.toFixed(2) +
      "   counting all of them: $" + sum.toFixed(2) +
      "   -> $" + (sum - latest).toFixed(2) + " of double-count if you total them all");
  })
  ;
  if (!n) lines.push("  none.");
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function signedTotals(fromIso, toIso) {
  var cfg = DAILY_RECAP_CONFIG;
  var today = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  var to = String(toIso || today).slice(0, 10);
  var from = String(fromIso || (today.slice(0, 8) + "01")).slice(0, 10);
  var sheet = getLogSpreadsheet_().ss.getSheetByName(SIGNED_SHEET_NAME);
  if (!sheet) return "No Signed vs Sold tab yet — run refreshSignedVsSold() first.";
  var last = sheet.getLastRow();
  if (last < 2) return "Signed vs Sold is empty.";
  var rows = sheet.getRange(2, 1, last - 1, SIGNED_HEADERS.length).getValues();
  var by = {
  };
  var bothSigned = 0, bothSold = 0, bothJobs = 0;
  var signedOnlyAmt = 0, signedOnlyN = 0, soldOnlyAmt = 0, soldOnlyN = 0;
  var reviewN = 0, reviewSigned = 0, reviewSold = 0;
  var non = {
    jobs: 0, amt: 0, rows: []
  };
  var rent = {
    jobs: 0, rows: []
  };
  rows.forEach(function (r) {
    var iso = String(normalizeSheetDate_(r[0]) || r[0] || "").slice(0, 10);
    if (!iso || iso < from || iso > to) return;
    if (String(r[11]).indexOf("Superseded") === 0) return;
    var hasS = r[5] !== "" && isFinite(Number(r[5]));
    var hasD = r[6] !== "" && isFinite(Number(r[6]));
    var s = hasS ? Number(r[5]) : 0;
    var d = hasD ? Number(r[6]) : 0;
    var bucket = hvacBucket_(r[6], r[5]);
    if (bucket !== "system") {
      var amt = hasD ? d : s;
      var rec = {
        iso: iso, hca: String(r[1] || "(rep unknown)"),
                  cust: String(r[2] || ""), amt: amt, name: String(r[10] || "")
      };
      if (bucket === "rental") {
        rent.jobs++;
        rent.rows.push(rec);
      }
      else {
        non.jobs++;
        non.amt += amt;
        non.rows.push(rec);
      }
      return;
    }
    var hca = String(r[1] || "(rep unknown)");
    var h = by[hca] = by[hca] || {
      signed: 0, sold: 0, jobs: 0
    };
    h.jobs++;
    h.signed += s;
    h.sold += d;
    if (hasS && hasD) {
      bothJobs++;
      bothSigned += s;
      bothSold += d;
    }
    else if (hasS) {
      signedOnlyN++;
      signedOnlyAmt += s;
    }
    else if (hasD) {
      soldOnlyN++;
      soldOnlyAmt += d;
    }
    if (String(r[11]).indexOf("REVIEW:") === 0) {
      reviewN++;
      reviewSigned += s;
      reviewSold += d;
    }
  })
  ;
  var names = Object.keys(by).sort(function (a, b) {
    return (by[b].signed || by[b].sold) - (by[a].signed || by[a].sold);
  })
  ;
  var lines = ["Signed vs sold — SYSTEMS ONLY (>= $" + SYSTEM_MIN_DOLLARS + "), " + from + " to " + to + ":"];
  names.forEach(function (n) {
    lines.push("  " + n + ": " + by[n].jobs + " system job(s), signed $" + by[n].signed.toFixed(2) +
      ", sold $" + by[n].sold.toFixed(2));
  })
  ;
  lines.push("");
  lines.push("  Systems carrying BOTH numbers (" + bothJobs + "): signed $" + bothSigned.toFixed(2) +
    ", sold $" + bothSold.toFixed(2) + ", gap $" + (bothSigned - bothSold).toFixed(2) +
    (bothSold ? " (" + ((bothSigned / bothSold - 1) * 100).toFixed(2) + "% over sold)" : ""));
  if (signedOnlyN) lines.push("  Systems signed with no sold alert (" + signedOnlyN + "): $" +
    signedOnlyAmt.toFixed(2) + " — nothing else in the system can see these.");
  if (soldOnlyN) lines.push("  Systems sold but never signed online (" + soldOnlyN + "): $" +
    soldOnlyAmt.toFixed(2) + " — normal; they have no signed figure to compare.");
  if (reviewN) {
    lines.push("  " + reviewN + " system row(s) share an opportunity with another live estimate — $" +
      reviewSigned.toFixed(2) + " signed, $" + reviewSold.toFixed(2) + " sold. If any of those are " +
      "revisions rather than add-ons, THIS TOTAL DOUBLE-COUNTS THEM. Mark them on the tab.");
  }
  lines.push("  The two column totals cover different sets of jobs, so do not subtract them.");
  lines.push("");
  if (!non.jobs) {
    lines.push("  Non-system (below $" + SYSTEM_MIN_DOLLARS + "): none in this window.");
  }
  else {
    lines.push("  Non-system — revenue, EXCLUDED from every system figure above:");
    non.rows.sort(function (a, b) {
      return b.amt - a.amt;
    })
    ;
    non.rows.forEach(function (x) {
      lines.push("    " + x.iso + "  " + x.hca + " / " + x.cust + "  $" + x.amt.toFixed(2) +
        "  \"" + x.name.slice(0, 45) + "\"");
    })
    ;
    lines.push("    " + non.jobs + " non-system job(s), $" + non.amt.toFixed(2) + " total.");
  }
  if (rent.jobs) {
    lines.push("  Rental / deferred ($0 — Comfort Club, penny test) — a SYSTEM sold as a rental, " +
      "so it is out of BOTH the system totals and non-system:");
    rent.rows.forEach(function (x) {
      lines.push("    " + x.iso + "  " + x.hca + " / " + x.cust + "  $" + x.amt.toFixed(2) +
        "  \"" + x.name.slice(0, 45) + "\"");
    })
    ;
  }
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function soldOnDay(iso) {
  ST_REG_CACHE = null;
  var day = String(iso || stToday_()).slice(0, 10);
  var res = readSoldAlerts_(SOLD_TODAY_LOOKBACK_DAYS);
  if (!res.ok) {
    var f = "Sold-alert read failed — see the log.";
    Logger.log(f);
    return f;
  }
  var collapsed = collapseResoldAlerts_(res.alerts);
  var doubles = stDoubleApprovals_(collapsed);
  var sold = collapsed
    .filter(function (a) {
    return a.soldOnIso === day;
  })
  .filter(function (a) {
    return !stExcluded_(a);
  })
  ;
  var booked = readBookedJobs_(BOOKED_LOOKBACK_DAYS);
  var buckets = {
    system: {
      n: 0, amt: 0, rows: []
    },
    fireplace: {
      n: 0, amt: 0, rows: []
    },
    nonsystem: {
      n: 0, amt: 0, rows: []
    },
    rental: {
      n: 0, amt: 0, rows: []
    }
  };
  var timing = {
    "SAME-DAY": {
      n: 0, amt: 0
    },
    "FOLLOW-UP": {
      n: 0, amt: 0
    },
    "UNKNOWN": {
      n: 0, amt: 0
    }
  };
  var perRep = {
  };
  sold.forEach(function (a) {
    var bucket = soldTodayBucket_(a);
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var jobKey = stJobKey_(a.jobNumber);
    var cls = jobKey ? classifySameDay_({
      job: jobKey, soldIso: a.soldOnIso
    },
    booked) : {
      tag: "UNKNOWN", ranIso: ""
    };
    var tag = cls.tag;
    buckets[bucket].n++;
    buckets[bucket].amt += amt;
    buckets[bucket].rows.push({
      hca: a.hca, customer: a.customer, amt: amt, name: a.name || "", tag: tag, ran: cls.ranIso
    })
    ;
    timing[tag].n++;
    timing[tag].amt += amt;
    var r = perRep[a.hca] = perRep[a.hca] ||
      {
      system: 0, systemAmt: 0, fireplace: 0, fireplaceAmt: 0, nonsystem: 0, nonsystemAmt: 0, rental: 0, sameday: 0, followup: 0, unknown: 0
    };
    if (bucket === "system") {
      r.system++;
      r.systemAmt += amt;
    }
    if (bucket === "fireplace") {
      r.fireplace++;
      r.fireplaceAmt += amt;
    }
    if (bucket === "nonsystem") {
      r.nonsystem++;
      r.nonsystemAmt += amt;
    }
    if (bucket === "rental") {
      r.rental++;
    }
    if (tag === "SAME-DAY") r.sameday++;
    if (tag === "FOLLOW-UP") r.followup++;
    if (tag === "UNKNOWN") r.unknown++;
  })
  ;
  var hvacN = buckets.system.n + buckets.fireplace.n;
  var hvacAmt = buckets.system.amt + buckets.fireplace.amt;
  var allN = hvacN + buckets.nonsystem.n + buckets.rental.n;
  var allAmt = hvacAmt + buckets.nonsystem.amt + buckets.rental.amt;
  var money = function (n) {
    return "$" + formatMoney_(Math.round(n));
  };
  var pad = function (s, w) {
    return (String(s) + "                         ").slice(0, w);
  };
  var lines = [];
  lines.push("Sold " + day + " — pre-tax, HCA only. Re-quotes counted once, on the day they first sold.");
  lines.push("  TOTAL SOLD:       " + pad(allN, 3) + " " + money(allAmt));
  lines.push("     same-day:       " + pad(timing["SAME-DAY"].n, 3) + " " + money(timing["SAME-DAY"].amt));
  lines.push("     follow-up:      " + pad(timing["FOLLOW-UP"].n, 3) + " " + money(timing["FOLLOW-UP"].amt));
  if (timing["UNKNOWN"].n)
    lines.push("     unknown:        " + pad(timing["UNKNOWN"].n, 3) + " " + money(timing["UNKNOWN"].amt) +
      "   (no booked alert within " + BOOKED_LOOKBACK_DAYS + "d)");
  if (!res.complete) lines.push("  ! PARTIAL read — hit the alert-search ceiling, so these are LOW.");
  lines.push("");
  lines.push("  Mix of that total:");
  lines.push("     HVAC (incl. fireplace): " + pad(hvacN, 3) + " " + money(hvacAmt));
  lines.push("        of which fireplace:  " + pad(buckets.fireplace.n, 3) + " " + money(buckets.fireplace.amt));
  if (buckets.nonsystem.n) lines.push("     Non-system (ductwork):  " + pad(buckets.nonsystem.n, 3) + " " + money(buckets.nonsystem.amt));
  if (buckets.rental.n)    lines.push("     Rental ($0):            " + pad(buckets.rental.n, 3));
  var open = doubles.filter(function (g) {
    return !g.resolved;
  })
  ;
  if (open.length) {
    lines.push("");
    lines.push("  ⚠ double approvals needing a ruling:");
    open.forEach(function (g) {
      lines.push("    " + g.customer + " — " + g.summary);
    })
    ;
  }
  lines.push("");
  lines.push("  by rep:");
  Object.keys(perRep).sort().forEach(function (name) {
    var r = perRep[name];
    var parts = [];
    if (r.system)    parts.push(r.system + " system " + money(r.systemAmt));
    if (r.fireplace) parts.push(r.fireplace + " fireplace " + money(r.fireplaceAmt));
    if (r.nonsystem) parts.push(r.nonsystem + " non-system " + money(r.nonsystemAmt));
    if (r.rental)    parts.push(r.rental + " rental ($0)");
    var t = [];
    if (r.sameday)  t.push(r.sameday + " same-day");
    if (r.followup) t.push(r.followup + " follow-up");
    if (r.unknown)  t.push(r.unknown + " unknown");
    lines.push("    " + name + ": " + parts.join(", ") + "   [" + t.join(", ") + "]");
  })
  ;
  lines.push("");
  lines.push("  detail:");
  ["system", "fireplace", "nonsystem", "rental"].forEach(function (b) {
    buckets[b].rows.sort(function (x, y) {
      return y.amt - x.amt;
    })
    ;
    buckets[b].rows.forEach(function (x) {
      lines.push("    " + pad(b.toUpperCase(), 10) + pad(x.tag, 10) + x.hca + " / " + (x.customer || "(no name)") +
        "  $" + x.amt.toFixed(2) + (x.ran ? "  ran " + x.ran.slice(5) : "") +
        "  \"" + String(x.name).slice(0, 40) + "\"");
    })
    ;
  })
  ;
  if (!allN) lines.push("    (nothing sold " + day + " yet)");
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function soldTodayData_(iso) {
  var day = String(iso || stToday_()).slice(0, 10);
  var res = readSoldAlerts_(SOLD_TODAY_LOOKBACK_DAYS);
  if (!res.ok) return {
    ok: false, day: day
  };
  var collapsed = collapseResoldAlerts_(res.alerts);
  var doubles = stDoubleApprovals_(collapsed);
  var sold = collapsed
    .filter(function (a) {
    return a.soldOnIso === day;
  })
  .filter(function (a) {
    return !stExcluded_(a);
  })
  ;
  var booked = readBookedJobs_(BOOKED_LOOKBACK_DAYS);
  var rows = sold.map(function (a) {
    var bucket = soldTodayBucket_(a);
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var jobKey = stJobKey_(a.jobNumber);
    var cls = jobKey ? classifySameDay_({
      job: jobKey, soldIso: a.soldOnIso
    },
    booked) : {
      tag: "UNKNOWN", ranIso: ""
    };
    return {
      hca: a.hca, customer: a.customer, amount: amt, name: a.name || "", bucket: bucket, timing: cls.tag, ranIso: cls.ranIso
    };
  })
  ;
  return {
    ok: true, complete: res.complete, day: day, rows: rows, doubles: doubles
  };
}
function splitQuoted_(body) {
  const out = [];
  const lines = String(body || "").split(/\r?\n/);
  let dangling = false;
  for (let i = 0;
  i < lines.length;
  i++) {
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
    if (/^\s*On\s.+<\s*$/.test(bare)) {
      dangling = true;
      continue;
    }
    out.push({
      text: bare, quoted: quoted
    })
    ;
  }
  return out;
}
function stAlarmNewPairs_(groups) {
  var props, seen = {
  };
  try {
    props = PropertiesService.getScriptProperties();
    seen = JSON.parse(props.getProperty("DOUBLE_APPROVAL_SEEN") || "{}") || {
    };
  }
  catch (e) {
    return;
  }
  var dirty = false, mailed = 0;
  groups.forEach(function (g) {
    if (seen[g.key]) return;
    seen[g.key] = g.newestIso || "seen";
    dirty = true;
    if (g.resolved) return;
    var to = "";
    try {
      to = DAILY_RECAP_CONFIG.managerEmail;
    }
    catch (e2) {
    }
    if (!to) return;
    var body =
      "Two sold approvals came through for the same homeowner:\n\n" +
      "  " + g.customer + (g.hca ? "  (HCA: " + g.hca + ")" : "") + "\n" +
      "  " + g.summary + "\n\n" +
      "That's either a genuine two-system deal or a wrong click and a fix.\n" +
      "Until you rule on it, BOTH approvals are counted.\n\n" +
      "To resolve (in the Apps Script file, top of the approval-guard block):\n" +
      "  - rental side is the mistake -> add the name to NOT_A_RENTAL,\n" +
      "    or answer \"No\" on their Rentals-register row\n" +
      "  - COD side is the mistake   -> add the name to NOT_A_SALE\n" +
      "  - both are real             -> add the name to DOUBLE_OK\n\n" +
      "This alert sends once per pair. The Sold Today tab shows the ⚠ until resolved.";
    if (typeof sendEmailSafe_ === "function") {
      mailed += sendEmailSafe_({
        to: [to], subject: "⚠ Double approval — " + g.customer, body: body
      })
      ? 1 : 0;
    }
  })
  ;
  if (dirty) {
    try {
      props.setProperty("DOUBLE_APPROVAL_SEEN", JSON.stringify(seen));
    }
    catch (e3) {
    }
  }
  if (mailed) Logger.log("Double-approval alert emailed for " + mailed + " new pair(s).");
}
function stDoubleApprovals_(collapsed) {
  var byCust = {
  };
  collapsed.forEach(function (a) {
    var k = stNormName_(a.customer);
    if (!k) return;
    (byCust[k] = byCust[k] || []).push(a);
  })
  ;
  var okSet = {
  };
  DOUBLE_OK.forEach(function (n) {
    okSet[stNormName_(n)] = true;
  })
  ;
  var groups = [];
  Object.keys(byCust).forEach(function (k) {
    var list = byCust[k];
    var jobs = {
    };
    list.forEach(function (a) {
      var j = String(a.jobNumber || "").trim();
      if (j) jobs[j] = true;
    })
    ;
    var jobN = Object.keys(jobs).length;
    var hasCash = list.some(function (a) {
      return !stIsNominal_(a.amount);
    })
    ;
    var hasNominal = list.some(function (a) {
      return stIsNominal_(a.amount);
    })
    ;
    var conflict = jobN >= 2 || (hasCash && hasNominal);
    if (!conflict) return;
    /* Resolved when you've said so, or every side but one is explained. */
    var resolved = !!okSet[k];
    if (!resolved) {
      var open = list.filter(function (a) {
        return !stExplained_(a);
      })
      ;
      var openJobs = {
      };
      open.forEach(function (a) {
        var j = String(a.jobNumber || "").trim();
        if (j) openJobs[j] = true;
      })
      ;
      var openCash = open.some(function (a) {
        return !stIsNominal_(a.amount);
      })
      ;
      var openNom = open.some(function (a) {
        return stIsNominal_(a.amount);
      })
      ;
      resolved = Object.keys(openJobs).length <= 1 && !(openCash && openNom);
    }
    var sorted = list.slice().sort(function (x, y) {
      return String(y.soldOnIso).localeCompare(String(x.soldOnIso)) || (Number(y.amount) || 0) - (Number(x.amount) || 0);
    })
    ;
    var newestIso = sorted.length ? String(sorted[0].soldOnIso) : "";
    var summary = sorted.map(function (a) {
      var amt = stIsNominal_(a.amount) ? "$0 rental-shaped" : "$" + Math.round(Number(a.amount)).toLocaleString();
      return amt + (a.jobNumber ? " (job " + a.jobNumber + ")" : "") + " on " + String(a.soldOnIso).slice(5);
    })
    .join("  +  ");
    var key = k + "|" + Object.keys(jobs).sort().join(",");
    groups.push({
      customer: sorted[0].customer || k, hca: sorted[0].hca || "",
      key: key, newestIso: newestIso, resolved: resolved, summary: summary,
      count: list.length
    })
    ;
  })
  ;
  groups.sort(function (x, y) {
    return y.newestIso.localeCompare(x.newestIso);
  })
  ;
  return groups;
}
function stNormName_(s) {
  try {
    if (typeof normName_ === "function") return normName_(s);
  }
  catch (e) {
  }
  return String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}
function stRegisterInfo_() {
  if (ST_REG_CACHE) return ST_REG_CACHE;
  var out = {
    noJob: {
    },
    noCust: {
    },
    ansJob: {
    },
    ansCust: {
    }
  };
  try {
    var name = (typeof RENTAL_SHEET_NAME !== "undefined") ? RENTAL_SHEET_NAME : "Rentals";
    var headerRow = (typeof RENTAL_HEADER_ROW !== "undefined") ? RENTAL_HEADER_ROW : 4;
    var firstRow = (typeof RENTAL_FIRST_DATA_ROW !== "undefined") ? RENTAL_FIRST_DATA_ROW : 5;
    var colNo = (typeof RENTAL_COL_ISRENTAL !== "undefined") ? RENTAL_COL_ISRENTAL : 6;
    var width = (typeof RENTAL_HEADERS !== "undefined") ? RENTAL_HEADERS.length : 13;
    var sheet = getLogSpreadsheet_().ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() >= firstRow) {
      sheet.getRange(firstRow, 1, sheet.getLastRow() - headerRow, width).getValues().forEach(function (r) {
        var ans = String(r[colNo]).trim().toLowerCase();
        if (ans !== "yes" && ans !== "no") return;
        var job = String(r[4] || "").trim();
        var cust = stNormName_(r[2]);
        if (job) out.ansJob[job] = true;
        if (cust) out.ansCust[cust] = true;
        if (ans === "no") {
          if (job) out.noJob[job] = true;
          if (cust) out.noCust[cust] = true;
        }
      })
      ;
    }
  }
  catch (e) {
    /* no register or unreadable — the lists still work */
  }
  ST_REG_CACHE = out;
  return out;
}
function stRegisterNoSet_() {
  if (ST_NOT_RENTAL_CACHE) return ST_NOT_RENTAL_CACHE;
  var out = {
    byJob: {
    },
    byCust: {
    }
  };
  try {
    var name = (typeof RENTAL_SHEET_NAME !== "undefined") ? RENTAL_SHEET_NAME : "Rentals";
    var headerRow = (typeof RENTAL_HEADER_ROW !== "undefined") ? RENTAL_HEADER_ROW : 4;
    var firstRow = (typeof RENTAL_FIRST_DATA_ROW !== "undefined") ? RENTAL_FIRST_DATA_ROW : 5;
    var colNo = (typeof RENTAL_COL_ISRENTAL !== "undefined") ? RENTAL_COL_ISRENTAL : 6;
    var width = (typeof RENTAL_HEADERS !== "undefined") ? RENTAL_HEADERS.length : 13;
    var sheet = getLogSpreadsheet_().ss.getSheetByName(name);
    if (sheet) {
      var last = sheet.getLastRow();
      if (last >= firstRow) {
        sheet.getRange(firstRow, 1, last - headerRow, width).getValues().forEach(function (r) {
          if (String(r[colNo]).trim().toLowerCase() !== "no") return;
          var job = String(r[4] || "").trim();
          var cust = stNormName_(r[2]);
          if (job) out.byJob[job] = true;
          if (cust) out.byCust[cust] = true;
        })
        ;
      }
    }
  }
  catch (e) {
    /* no register, or unreadable — the list below still works */
  }
  ST_NOT_RENTAL_CACHE = out;
  return out;
}
function stopOldGrowthWriter() {
  var trigs = ScriptApp.getProjectTriggers();
  var all = [], removed = [];
  trigs.forEach(function (t) {
    var h = String(t.getHandlerFunction());
    all.push(h);
    if (/growth/i.test(h)) {
      ScriptApp.deleteTrigger(t);
      removed.push(h);
    }
  })
  ;
  Logger.log(
    "All scheduled triggers were: " + (all.join(", ") || "(none)") +
    "\nRemoved (growth writers): " + (removed.join(", ") || "none found — see the list above and tell me which one to kill") +
    "\nYour recap-form / other triggers are untouched."
  );
  return removed;
}
function stripSoldIdentity_(rep) {
  if (!rep || !rep.sales) return rep;
  rep.sales = rep.sales.map(s => ({
    hca: s.hca,
    amount: s.amount,
    soldOnIso: s.soldOnIso,
    resold: !!s.resold,
    split: s.split
  })
  );
  rep.identityWithheld = true;
  return rep;
}
function sumDeals_(entries) {
  let oneTime = 0, monthly = 0, missing = 0;
  entries.forEach(e => {
    if (!e.deal) return;
    /* Split figures when the parser produced them. One appointment can carry a
    cash price AND a Comfort Club payment; the old single-amount path had to
    pick one, so the digest showed either the cash or the payment, never
    both. */
    const hasOne = e.dealOneTime !== null && e.dealOneTime !== undefined;
    const hasMo = e.dealMonthly !== null && e.dealMonthly !== undefined;
    if (hasOne || hasMo) {
      if (hasOne) oneTime += Number(e.dealOneTime) || 0;
      if (hasMo) monthly += Number(e.dealMonthly) || 0;
      return;
    }
    if (e.dealAmount === null || e.dealAmount === undefined) {
      missing++;
      return;
    }
    if (e.dealIsMonthly) monthly += e.dealAmount;
    else oneTime += e.dealAmount;
  })
  ;
  return {
    oneTime: oneTime, monthly: monthly, missing: missing
  };
}
function tidyAlertNumbers(previewOnly) {
  const ss = getLogSpreadsheet_().ss;
  /* Header names rather than positions, so this keeps working if a column moves. */
  const targets = [
    {
    sheet: "Rentals", headerRow: 4, columns: ["Job #"]
  },
  {
    sheet: "Signed vs Sold", headerRow: 1, columns: ["Estimate #", "Opportunity #"]
  }
  ];
  const report = [];
  let changedTotal = 0;
  targets.forEach(t => {
    const sheet = ss.getSheetByName(t.sheet);
    if (!sheet) {
      report.push(t.sheet + ": not present, skipped.");
      return;
    }
    const last = sheet.getLastRow();
    if (last <= t.headerRow) {
      report.push(t.sheet + ": no data rows.");
      return;
    }
    const header = sheet.getRange(t.headerRow, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || "").trim());
    t.columns.forEach(name => {
      const idx = header.indexOf(name);
      if (idx === -1) {
        report.push(t.sheet + " / " + name + ": column not found.");
        return;
      }
      const first = t.headerRow + 1;
      const range = sheet.getRange(first, idx + 1, last - t.headerRow, 1);
      const values = range.getValues();
      let changed = 0;
      const samples = [];
      const out = values.map((r, i) => {
        const before = String(r[0] === null || r[0] === undefined ? "" : r[0]);
        const after = cleanAlertNumber_(before);
        if (after !== before.trim()) {
          changed++;
          if (samples.length < 3) {
            samples.push("row " + (first + i) + ": " +
              JSON.stringify(before.slice(0, 60) + (before.length > 60 ? "…" : "")) +
              " -> " + JSON.stringify(after));
          }
        }
        return [after];
      })
      ;
      if (!previewOnly && changed) range.setValues(out);
      changedTotal += changed;
      report.push(t.sheet + " / " + name + ": " + changed + " cell(s) cleaned" +
        (samples.length ? "\n    " + samples.join("\n    ") : "."));
    })
    ;
  })
  ;
  const msg = (previewOnly ? "PREVIEW — nothing written.\n" : "Done.\n") +
    report.join("\n") +
    "\n" + changedTotal + " cell(s) " + (previewOnly ? "would change." : "changed.");
  Logger.log(msg);
  return msg;
}
function tidyRecapLog() {
  var out = ["Tidy Recap Log:"];
  /* 1) Stop the triggers that rebuild the sold tabs on THIS sheet. */
  var trg = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === "refreshSoldTodayTab" || h === "refreshSoldMTDTab") {
      ScriptApp.deleteTrigger(t);
      trg++;
    }
  })
  ;
  out.push("  removed " + trg + " sold-tab trigger(s) (refreshSoldTodayTab / refreshSoldMTDTab)");
  /* 2) Delete the two sold tabs — matched by their title text so the exact
  tab name doesn't matter. Only touches the Recap Log spreadsheet. */
  var ss = getLogSpreadsheet_().ss;
  var killed = [], kept = [];
  ss.getSheets().forEach(function (sh) {
    var a1 = "";
    try {
      a1 = String(sh.getRange("A1").getValue() || "");
    }
    catch (e) {
    }
    var name = sh.getName();
    var isSold = /^sold today/i.test(a1) ||
                 /sold\s*[—\-]\s*month to date/i.test(a1) ||
                 name === "Sold Today" || name === "Sold MTD";
    if (!isSold) return;
    /* Never delete the last remaining sheet (can't happen here, but safe). */
    if (ss.getSheets().length <= 1) {
      kept.push(name + " (last sheet — left alone)");
      return;
    }
    try {
      ss.deleteSheet(sh);
      killed.push(name);
    }
    catch (err) {
      kept.push(name + " (couldn't delete: " + err + ")");
    }
  })
  ;
  out.push("  deleted tab(s): " + (killed.join(", ") || "none found — already gone"));
  if (kept.length) out.push("  left: " + kept.join(", "));
  out.push("  Sold now lives only on the growth sheet's \"Same-Day Sold\" tab.");
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
function verifyRecapDateFix() {
  const book = getLogSpreadsheet_();
  const cfg = DAILY_RECAP_CONFIG;
  const toIso = Utilities.formatDate(new Date(), cfg.timeZone, "yyyy-MM-dd");
  const fromIso = Utilities.formatDate(new Date(Date.now() - 6 * 86400000), cfg.timeZone, "yyyy-MM-dd");
  const rows = readSheetRows_(book.ss, cfg.logSheetName, RECAP_LOG_HEADERS.length)
    .filter(r => String(r[0]) >= fromIso && String(r[0]) <= toIso);
  const byHca = {
  };
  rows.forEach(r => {
    byHca[String(r[1])] = (byHca[String(r[1])] || 0) + 1;
  })
  ;
  const lines = ["Window " + fromIso + " to " + toIso + ": " + rows.length +
    " row(s) visible to the same filter the web app uses."];
  Object.keys(byHca).sort().forEach(n => lines.push("  " + n + ": " + byHca[n]));
  if (!rows.length) lines.push("  STILL ZERO — the filter is not seeing the rows. Tell me.");
  const msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function whoStillOwesYesterday_(now) {
  var out = {
  };
  var norm = function (s) {
    return String(s || "").trim().toUpperCase();
  };
  try {
    var yesterday = new Date(now.getTime() - 86400000);
    var past = buildTodayPlan_(yesterday);
    if (!past.working.length) return out;
    var credited = {
    };
    // norm(name) -> "email" | "form"
    /* 1) Email replies — the original check, unchanged. */
    try {
      var found = findRecapReplies_(past.dateLabel, null);
      if (found && found.ok) {
        found.replies.forEach(function (r) {
          credited[norm(r.hca.name)] = "email";
        })
        ;
      }
    }
    catch (e1) {
      Logger.log("owes-yesterday: email check failed (" + e1 + ") — form check still runs.");
    }
    /* 2) Form submissions stamped on yesterday's date. */
    try {
      var tz;
      try {
        tz = DAILY_RECAP_CONFIG.timeZone;
      }
      catch (e2) {
        tz = "America/Los_Angeles";
      }
      var iso = Utilities.formatDate(yesterday, tz, "yyyy-MM-dd");
      var prop = (typeof RECAP_FORM_ID_PROP !== "undefined") ? RECAP_FORM_ID_PROP : "recapFormId";
      var id = "";
      try {
        id = PropertiesService.getScriptProperties().getProperty(prop) || "";
      }
      catch (e3) {
      }
      if (id) {
        FormApp.openById(id).getResponses().forEach(function (resp) {
          if (Utilities.formatDate(resp.getTimestamp(), tz, "yyyy-MM-dd") !== iso) return;
          var hca = "";
          resp.getItemResponses().forEach(function (ir) {
            if (String(ir.getItem().getTitle()).trim() === "HCA") hca = String(ir.getResponse() || "").trim();
          })
          ;
          if (hca && !credited[norm(hca)]) credited[norm(hca)] = "form";
        })
        ;
      }
    }
    catch (e4) {
      Logger.log("owes-yesterday: form check failed (" + e4 + ") — email replies still counted.");
    }
    past.working.forEach(function (h) {
      if (!credited[norm(h.name)]) out[h.name] = past.dateLabel;
    })
    ;
  }
  catch (err) {
    Logger.log("Could not work out who owes yesterday, sending without it: " +
      (err && err.message ? err.message : String(err)));
    return {
    };
  }
  return out;
}
function wireDailySold() {
  var ss = SpreadsheetApp.openById("1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww");
  var SDS = "Same-Day Sold";
  var daily = ss.getSheetByName("Daily");
  if (!daily) throw new Error("No Daily tab found.");
  var src = ss.getSheetByName(SDS);
  if (!src) throw new Error('No "' + SDS + '" tab found.');
  var g = src.getRange(1, 1, src.getLastRow(), src.getLastColumn()).getValues();
  var cDate = -1, cTot = -1, cDol = -1;
  for (var r = 0;
  r < g.length && cDate < 0;
  r++) {
    var row = g[r].map(function (x) {
      return String(x || "").trim().toLowerCase();
    })
    ;
    if (row.indexOf("date") > -1 && row.indexOf("$ sold") > -1) {
      for (var c = 0;
      c < row.length;
      c++) {
        if (row[c] === "date") cDate = c;
        else if (row[c] === "total sold") cTot = c;
        else if (row[c] === "$ sold") cDol = c;
      }
    }
  }
  if (cDate < 0 || cTot < 0 || cDol < 0)
    throw new Error("Couldn't find Same-Day Sold Date / Total Sold / $ Sold headers.");
  function L(i) {
    var n = i + 1, s = "";
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  var q = "'" + SDS + "'";
  var dateCol = q + "!" + L(cDate) + ":" + L(cDate);
  var totCol = q + "!" + L(cTot) + ":" + L(cTot);
  var dolCol = q + "!" + L(cDol) + ":" + L(cDol);
  var dayM = 'MATCH(TEXT(TODAY()-1,"ddd m/d"),ARRAYFORMULA(TEXT(' + dateCol + ',"ddd m/d")),0)';
  var mtdM = 'MATCH("MTD",' + dateCol + ',0)';
  var dv = daily.getRange(1, 1, daily.getLastRow(), Math.max(2, daily.getLastColumn())).getValues();
  function rowOf(pred) {
    for (var r = 0;
    r < dv.length;
    r++) {
      if (pred(String(dv[r][1] || "").trim().toLowerCase())) return r + 1;
    }
    return -1;
  }
  var rHdr = rowOf(function (s) {
    return s === "mtd";
  })
  ;
  var rSold = rowOf(function (s) {
    return s === "total sold";
  })
  ;
  var rDol = rowOf(function (s) {
    return s.indexOf("hvac sold $") === 0;
  })
  ;
  var rAvg = rowOf(function (s) {
    return s.indexOf("hvac avg ticket") === 0;
  })
  ;
  if (rSold < 0 || rDol < 0) throw new Error("Couldn't find Total Sold / HVAC Sold $ rows on Daily.");
  if (rHdr > 0) daily.getRange("C" + rHdr).setFormula("=TODAY()-1").setNumberFormat("ddd m/d");
  daily.getRange("C" + rSold).setFormula('=IFERROR(INDEX(' + totCol + ',' + dayM + '),0)');
  daily.getRange("D" + rSold).setFormula('=IFERROR(INDEX(' + totCol + ',' + mtdM + '),0)');
  daily.getRange("C" + rDol).setFormula('=IFERROR(INDEX(' + dolCol + ',' + dayM + '),0)').setNumberFormat("$#,##0");
  daily.getRange("D" + rDol).setFormula('=IFERROR(INDEX(' + dolCol + ',' + mtdM + '),0)').setNumberFormat("$#,##0");
  if (rAvg > 0) {
    daily.getRange("C" + rAvg).setFormula('=IFERROR(C' + rDol + '/C' + rSold + ',"")').setNumberFormat("$#,##0");
    daily.getRange("D" + rAvg).setFormula('=IFERROR(D' + rDol + '/D' + rSold + ',"")').setNumberFormat("$#,##0");
  }
  var clearLabels = ["total leads", "total installs", "hvac tech flip leads", "hvac tech flip deals", "hvac rev", "self gen"];
  var cleared = [];
  clearLabels.forEach(function (lab) {
    var rr = rowOf(function (s) {
      return s.indexOf(lab) === 0;
    })
    ;
    if (rr > 0) {
      daily.getRange("C" + rr).setValue("");
      cleared.push(daily.getRange("B" + rr).getValue());
    }
  })
  ;
  /* remove the long legend note row ("Day column = …") — do this LAST so it
  doesn't shift the rows written above it */
  var rNote = rowOf(function (s) {
    return s.indexOf("day column") === 0;
  })
  ;
  var noteRemoved = false;
  if (rNote > 0) {
    daily.deleteRow(rNote);
    noteRemoved = true;
  }
  SpreadsheetApp.flush();
  var dS = daily.getRange("C" + rSold).getValue(), mS = daily.getRange("D" + rSold).getValue();
  var dD = daily.getRange("C" + rDol).getValue(), mD = daily.getRange("D" + rDol).getValue();
  var lbl = rHdr > 0 ? daily.getRange("C" + rHdr).getDisplayValue() : "yesterday";
  var msg = "Day set to " + lbl + ".  SOLD: " + dS + " · $" + Math.round(dD) +
    "   |   MTD: " + mS + " · $" + Math.round(mD) +
    ".  Cleared (pending BI): " + cleared.join(", ") +
    (noteRemoved ? ".  Removed the legend note row." : "") +
    ".  MTD column + budgets untouched.";
  Logger.log(msg);
  return msg;
}
function writeActivityRows_(ss, rows) {
  var H = ACTIVITY_LOG_HEADERS_RICH;
  var sheet = ensureActivityLogRich_(ss);
  var existing = {
  };
  var lr = sheet.getLastRow();
  if (lr >= 2) {
    sheet.getRange(2, 1, lr - 1, H.length).getValues().forEach(function (r) {
      existing[activitySig_(r[0], r[1], r[3], r[13], r[11], r[10])] = true;
    })
    ;
  }
  var stamp = new Date();
  var out = [];
  rows.forEach(function (a) {
    var sig = activitySig_(a.iso, a.hca, a.customer || "", a.what || "", a.objection || "", a.nextFollowup || "");
    if (existing[sig]) return;
    existing[sig] = true;
    out.push([a.iso, a.hca, a.activity, a.customer || "", a.source || "", a.package || "", a.price || "",
      a.waterHeater || "", a.interest || "", a.outcome || "", a.nextFollowup || "", a.objection || "",
      a.objectionNotes || "", a.what || "", stamp, a.key]);
  })
  ;
  if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, H.length).setValues(out);
  return {
    written: out.length, skipped: rows.length - out.length
  };
}
function writeEmailNotes_(ss, byName, status, fromIso, toIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.emailNotesSheetName, EMAIL_NOTE_HEADERS);
  const stamp = new Date();
  const rows = [];
  const done = {
  };
  const collect = (date, hcaName, customer) => {
    const key = recapRowKey_(date, hcaName, customer);
    if (done[key] || !customer) return;
    done[key] = true;
    readEmailNotes_(customer, DAILY_RECAP_CONFIG.emailNoteLookbackDays).forEach(n => {
      rows.push([date, hcaName, customer, n.threadDate, n.from, n.subject,
        n.summary, n.link, key]);
    })
    ;
  };
  Object.keys(byName).sort().forEach(name => {
    const h = byName[name];
    (h.rows || []).forEach(r => collect(r.date, name, r.customer));
    (h.soldNotReported || []).forEach(s => collect(s.soldOnIso || toIso, name, s.customer));
  })
  ;
  /* Unclaimed appointments too — an email may be the only thing that says
  what happened to it. */
  (status.unclaimedAppointments || []).forEach(u =>
    collect(u.appointmentIso, "", u.customer));
  const existing = readSheetRows_(ss, DAILY_RECAP_CONFIG.emailNotesSheetName, EMAIL_NOTE_HEADERS.length);
  const kept = existing.filter(r => {
    const d = String(r[0]);
    return d && (d < fromIso || d > toIso);
  })
  ;
  const all = kept.concat(rows);
  all.sort((a, b) => String(b[0]).localeCompare(String(a[0])) ||
    String(b[3]).localeCompare(String(a[3])));
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, EMAIL_NOTE_HEADERS.length).clearContent();
  }
  if (all.length) {
    sheet.getRange(2, 1, all.length, EMAIL_NOTE_HEADERS.length).setValues(all);
  }
  return {
    rows: all.length
  };
}
function writeFollowUps_(ss, allLogRows, status, todayIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.followUpsSheetName, FOLLOWUP_HEADERS);
  /* Phone numbers only exist where ServiceTitan booked the job, so this is
  best-effort by design — most appointments have no booking behind them. */
  const phoneFor = {
  };
  (status.bookedContacts || []).forEach(c => {
    if (c.customer && c.phone) phoneFor[normName_(c.customer)] = c.phone;
  })
  ;
  const rows = [];
  (allLogRows || []).forEach(r => {
    const outcome = String(r[4] || "");
    if (outcome === "SOLD") return;
    // closed; Job Status owns it
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
    /* The CASH price, and only the cash price. On a Comfort Club row Deal
    Amount holds the monthly payment, and $289 sitting in a column headed
    "Amount" beside "Offered" reads as a $289 job. Prefer the explicit
    one-time column; leave the cell EMPTY on a monthly-only row rather than
    print a payment as though it were a job value — the Offered column
    right beside it still carries "$289/mo" in the rep's own words. Rows
    written before these columns existed fall back to Deal Amount. */
    (function () {
      const hasSplitCols = r.length > 14;
      const one = hasSplitCols ? r[13] : "";
      if (one !== "" && one !== null && one !== undefined && isFinite(Number(one))) return Number(one);
      if (hasSplitCols && String(r[7]) === "Monthly") return "";
      return (r[6] === "" || r[6] === null) ? "" : Number(r[6]);
    })
    (),
      String(r[10] || ""),
      phoneFor[normName_(customer)] || "",
      ranOn,
      age === null ? "" : age,
      String(r[9] || ""),                              // exactly what they typed
    recapRowKey_(ranOn, String(r[1] || ""), customer)
    ]);
  })
  ;
  /* Undated last, then by due date, then oldest appointment first. */
  rows.sort((a, b) => {
    const ka = a[0] || "9999-12-31", kb = b[0] || "9999-12-31";
    return ka.localeCompare(kb) || String(a[9]).localeCompare(String(b[9]));
  })
  ;
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
function writeJobStatus_(ss, byName, status, fromIso, toIso) {
  const sheet = ensureSheet_(ss, DAILY_RECAP_CONFIG.jobStatusSheetName, JOB_STATUS_HEADERS);
  const stamp = new Date();
  const rows = [];
  const seen = {
  };
  const bi = readBiLeads_();
  const biCols = (jobNumber, customer, iso) => {
    const m = biLookup_(bi, jobNumber, customer, iso);
    return m ? [m.rep, m.leadType, m.jobStatus] : ["", "", ""];
  };
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
      const b = r.booked || {
      };
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
      ].concat(biCols(b.jobNumber, r.customer, r.date)));
    })
    ;
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
      ].concat(biCols("", s.customer, date)));
    })
    ;
  })
  ;
  /* Booked, the day has passed, nobody reported it.
  The alert names no advisor, so the HCA column used to sit empty here — the
  row told you a consult went unreported but not by whom, which is the half
  that lets you do something about it. BI's TechName fills it. When BI has a
  name it goes in the HCA column and the status says so; without BI this is
  exactly the row it always was.
  A cancelled appointment is not an unreported one, so BI's jobStatus
  downgrades it rather than leaving it on the list as a failure. */
  (status.unclaimedAppointments || []).forEach(u => {
    const m = biLookup_(bi, u.jobNumber, u.customer, u.appointmentIso);
    const cancelled = m && /cancel/i.test(m.jobStatus || "");
    push([
      u.appointmentIso, m && m.rep ? m.rep : "", u.customer, "No", "", "",
      u.jobNumber || "", u.appointmentAt || "", u.jobType || "",
      u.sourceHint || "", u.assignedHint || "", "", "",
      "", "", "", "", "", "",
      "", "", "", "", "",
      cancelled ? "Cancelled in ServiceTitan — not a missed recap"
        : (m && m.rep ? "UNCLAIMED — " + m.rep + " ran it, no recap"
                      : "UNCLAIMED — booked, no recap"),
      stamp,
      recapRowKey_(u.appointmentIso, "", u.customer)
    ].concat(m ? [m.rep, m.leadType, m.jobStatus] : ["", "", ""]));
  })
  ;
  /* Replace only the window. Anything older stays where it is. */
  const existing = readSheetRows_(ss, DAILY_RECAP_CONFIG.jobStatusSheetName, JOB_STATUS_HEADERS.length);
  const kept = existing.filter(r => {
    const d = String(r[0]);
    return d && (d < fromIso || d > toIso);
  })
  ;
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
function writeMondayGrowth(previewOnly) {
  const ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  const sheet = ss.getSheets().filter(s => s.getSheetId() === MONDAY_GROWTH_GID)[0];
  if (!sheet) return "No tab with id " + MONDAY_GROWTH_GID + " in the growth sheet.";
  const grid = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const txt = v => String(v === null || v === undefined ? "" : v).trim();
  /* The block header, then the row inside it that names the weekday. */
  let blockRow = -1;
  for (let r = 0;
  r < grid.length && blockRow === -1;
  r++) {
    for (let c = 0;
    c < grid[r].length;
    c++) {
      if (txt(grid[r][c]) === MONDAY_GROWTH_BLOCK) {
        blockRow = r;
        break;
      }
    }
  }
  if (blockRow === -1) return 'Could not find a "' + MONDAY_GROWTH_BLOCK + '" block on that tab.';
  let dayCol = -1, mtdCol = -1, headerRow = -1;
  for (let r = blockRow;
  r < Math.min(blockRow + 6, grid.length);
  r++) {
    for (let c = 0;
    c < grid[r].length;
    c++) {
      if (txt(grid[r][c]).toLowerCase() === "monday") {
        headerRow = r;
        dayCol = c;
        break;
      }
    }
    if (dayCol !== -1) break;
  }
  if (dayCol === -1) return 'Found the block but no "Monday" column header inside it.';
  /* MTD is the first column labelled MTD to the RIGHT of the day column — the
  same row also carries an MTD label on the far left, which is not it. */
  for (let c = dayCol + 1;
  c < grid[headerRow].length;
  c++) {
    if (txt(grid[headerRow][c]).toLowerCase() === "mtd") {
      mtdCol = c;
      break;
    }
  }
  if (mtdCol === -1) return 'Found the Monday column but no MTD column to its right.';
  const report = ["Block \"" + MONDAY_GROWTH_BLOCK + "\" at row " + (blockRow + 1) +
    ", Monday = column " + (dayCol + 1) + ", MTD = column " + (mtdCol + 1) + "."];
  let wrote = 0, skipped = 0;
  const put = (row, col, value, what) => {
    const cell = sheet.getRange(row + 1, col + 1);
    const formula = cell.getFormula();
    if (formula) {
      skipped++;
      report.push("  SKIP  " + what + " — holds a formula (" + formula.slice(0, 40) + "), left alone.");
      return;
    }
    const current = grid[row][col];
    if (String(current) === String(value)) {
      report.push("  same  " + what + " already " + value);
      return;
    }
    if (!previewOnly) cell.setValue(value);
    wrote++;
    report.push("  WRITE " + what + ": " + JSON.stringify(txt(current)) + " -> " + value);
  };
  /* Label rows live between the header and the end of the block. */
  const end = Math.min(blockRow + 20, grid.length);
  Object.keys(MONDAY_GROWTH_VALUES).forEach(label => {
    let found = -1;
    for (let r = headerRow;
    r < end;
    r++) {
      for (let c = 0;
      c < grid[r].length;
      c++) {
        if (txt(grid[r][c]) === label) {
          found = r;
          break;
        }
      }
      if (found !== -1) break;
    }
    if (found === -1) {
      report.push("  MISS  no row labelled \"" + label + '"');
      return;
    }
    const pair = MONDAY_GROWTH_VALUES[label];
    if (pair[0] !== null) put(found, dayCol, pair[0], label + " (Monday)");
    if (pair[1] !== null) put(found, mtdCol, pair[1], label + " (MTD)");
  })
  ;
  /* The note goes in the Monday column of the Notes row, which is empty. Not in
  the label column underneath it — in this block that row belongs to the next
  day's block and writing there would overwrite it. */
  let notesRow = -1;
  for (let r = headerRow;
  r < end && notesRow === -1;
  r++) {
    for (let c = 0;
    c < grid[r].length;
    c++) {
      if (txt(grid[r][c]).toLowerCase().indexOf("notes:") === 0) {
        notesRow = r;
        break;
      }
    }
  }
  if (notesRow === -1) report.push("  MISS  no Notes row found — paste the note by hand.");
  else put(notesRow, dayCol, MONDAY_GROWTH_NOTE, "Notes (Monday)");
  report.push((previewOnly ? "PREVIEW — nothing written. " : "") +
    wrote + " cell(s) " + (previewOnly ? "would change" : "changed") +
    (skipped ? ", " + skipped + " skipped for holding formulas" : "") + ".");
  report.push("Marketed L2C % is left to the sheet's own formula: 1/6 = 16.7% Monday, 1/9 = 11.1% MTD.");
  const msg = report.join("\n");
  Logger.log(msg);
  return msg;
}
function writePausedHcas_(map) {
  PropertiesService.getScriptProperties()
    .setProperty(PAUSED_HCAS_PROPERTY, JSON.stringify(map || {
  })
  );
}
function buildRecapForm() {
  /* Never make a second one by accident — one form, reused. */
  var existing = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (existing) {
    try {
      var ex = FormApp.openById(existing);
      Logger.log("A recap form already exists — not creating another.\n fill: " + ex.getPublishedUrl() + "\n edit: " + ex.getEditUrl() + "\nTo rebuild from scratch, delete the '" + RECAP_FORM_ID_PROP + "' Script Property, then run this again.");
      return ex.getPublishedUrl();
    }
    catch (err) {
      /* stored id is dead — fall through and build a fresh one */
    }
  }
  var form = FormApp.create("CM Heating — HCA Appointment Recap");
  form.setDescription("One submission per appointment — fill it as you finish each one. " + "No appointments today? You don't need to submit anything.");
  form.setAllowResponseEdits(true);
  /* --- Section 1: the appointment --- */
  form.addListItem().setTitle("HCA").setRequired(true) .setChoiceValues(RECAP_ROSTER.map(function (h) {
    return h.name;
  }
  ));
  form.addTextItem().setTitle("Customer").setRequired(true);
  form.addListItem().setTitle("Source").setRequired(true) .setChoiceValues(["Web", "Inbound", "Tech Flip", "Revisit", "Self Generated Lead"]);
  form.addListItem().setTitle("Package offered") .setChoiceValues(["Good", "Better", "Best", "Comfort Club", "None / not presented"]);
  form.addTextItem().setTitle("Price offered") .setHelpText("Dollar amount, e.g. 18500. Comfort Club is monthly, e.g. 249/mo.");
  form.addListItem().setTitle("Water heater presented?").setRequired(true) .setChoiceValues(["Yes", "No"]);
  form.addListItem().setTitle("Water heater interest") .setChoiceValues(["Interested", "Not interested", "N/A"]);
  form.addTextItem().setTitle("Next follow-up") .setHelpText("When / what's next — type it however you like: 'call Mon', '8/12', 'waiting on spouse'.");
  /* Outcome is the branch point. Built here (stays in section 1), its choices wired AFTER the objection section exists so 'Not Sold' can point at it. */
  var outcome = form.addListItem().setTitle("Outcome").setRequired(true);
  /* --- Section 2: objection, only reached when Not Sold --- */
  var objectionPage = form.addPageBreakItem().setTitle("If not sold") .setHelpText("Only shows when the appointment didn't close.");
  form.addListItem().setTitle("Objection") .setChoiceValues(["HOA / Permitting", "Second party missing", "Price too high", "Getting estimates", "Other"]);
  form.addTextItem().setTitle("Objection — if Other") .setHelpText("Only if you picked Other above.");
  outcome.setChoices([ outcome.createChoice("Sold", FormApp.PageNavigationType.SUBMIT), outcome.createChoice("Not Sold", objectionPage) ]);
  /* Responses land in the recap log spreadsheet as their own tab, so the parser (next step) reads them from the same book everything else lives in. */
  try {
    var ss = getLogSpreadsheet_().ss;
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }
  catch (err) {
    Logger.log("Form built, but could not auto-link responses to the log sheet: " + (err && err.message ? err.message : String(err)) + "\nYou can link it by hand in the form's Responses tab; the parser can also be pointed at any sheet.");
  }
  PropertiesService.getScriptProperties().setProperty(RECAP_FORM_ID_PROP, form.getId());
  var msg = "Recap form created.\n FILL (share with HCAs): " + form.getPublishedUrl() + "\n EDIT: " + form.getEditUrl() + "\nResponses are linked to the recap log spreadsheet. Next: I wire them into the Recap Log " + "and build the per-HCA 1:1 tabs.";
  Logger.log(msg);
  return form.getPublishedUrl();
}
function formEntry_(a) {
  var pkg = String(a["Package offered"] || "").trim();
  var price = String(a["Price offered"] || "").trim();
  var pkgClean = /none/i.test(pkg) ? "" : pkg;
  var deal = [pkgClean, price].filter(function (x) {
    return x;
  }
  ).join(" ").trim();
  if (/comfort club/i.test(pkg) && deal && !/\bmo\b|month|\/\s*mo/i.test(deal)) deal += " per month";
  var money = deal ? parseDealAmount_(deal) : {
    amount: null, oneTime: null, monthlyAmount: null, mentionsMonthly: false, alternatives: false
  };
  var sold = /^\s*sold\s*$/i.test(String(a["Outcome"] || ""));
  var outcome = sold ? "SOLD" : "NO SALE";
  var wh = String(a["Water heater presented?"] || "").trim();
  var whI = String(a["Level of interest"] || a["Water heater interest"] || "").trim();
  var waterHeater = wh ? (wh + (whI && !/^n\/a$/i.test(whI) ? " — " + whI : "")) : "";
  var obj = String(a["Objection"] || "").trim();
  var other = String(a["Additional information on objection"] || a["Objection — if Other"] || "").trim();
  if (/^other$/i.test(obj)) {
    obj = other || "Other";
  } else if (other) {
    obj = obj ? (obj + " — " + other) : other;
  }
  return {
    customer: String(a["Customer"] || "").trim(), leadSource: String(a["Source"] || "").trim(), outcome: outcome, deal: deal, dealAmount: money.amount, dealOneTime: money.oneTime, dealMonthly: money.monthlyAmount, dealMentionsMonthly: money.mentionsMonthly, dealAlternatives: money.alternatives, waterHeater: waterHeater, followUpDate: String(a["Next follow-up"] || "").trim(), objection: sold ? "" : obj
  };
}
function refreshSoldMTDTab() {
  var from = monthStartIso_(), to = stToday_();
  var data = soldRangeData_(from, to);
  var ss = getLogSpreadsheet_().ss;
  var sheet = ss.getSheetByName(SOLD_MTD_TAB) || ss.insertSheet(SOLD_MTD_TAB);
  sheet.clearContents();
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var stamp = Utilities.formatDate(new Date(), tz, "EEE MMM d, h:mm a");
  sheet.getRange("A1").setValue("Sold — month to date").setFontWeight("bold").setFontSize(13);
  if (!data.ok) {
    sheet.getRange("A2").setValue("Updated " + stamp + " — read failed, try again.");
    return sheet.getParent().getUrl();
  }
  var sum = function (pred) {
    var n = 0, a = 0;
    data.rows.forEach(function (r) {
      if (pred(r)) {
        n++;
        a += r.amount;
      }
    }
    );
    return {
      n: n, amt: a
    };
  };
  var all = sum(function () {
    return true;
  }
  );
  var same = sum(function (r) {
    return r.timing === "SAME-DAY";
  }
  );
  var foll = sum(function (r) {
    return r.timing === "FOLLOW-UP";
  }
  );
  var unk = sum(function (r) {
    return r.timing === "UNKNOWN";
  }
  );
  var hvac = sum(function (r) {
    return r.bucket === "system" || r.bucket === "fireplace";
  }
  );
  var fire = sum(function (r) {
    return r.bucket === "fireplace";
  }
  );
  var nonsys = sum(function (r) {
    return r.bucket === "nonsystem";
  }
  );
  var rent = sum(function (r) {
    return r.bucket === "rental";
  }
  );
  sheet.getRange("A2").setValue("Updated " + stamp + " · " + from + " → " + to + " · pre-tax · HCA only · re-quotes counted once" + (data.complete === false ? " ! PARTIAL read" : "")) .setFontColor("#666666");
  var block = [ ["", "count", "$"], ["TOTAL SOLD", all.n, all.amt], [" same-day", same.n, same.amt], [" follow-up", foll.n, foll.amt], [" unknown", unk.n, unk.amt], ["", "", ""], ["HVAC (incl. fireplace)", hvac.n, hvac.amt], [" of which fireplace", fire.n, fire.amt], ["Non-system (ductwork)", nonsys.n, nonsys.amt], ["Rental ($0)", rent.n, rent.amt] ];
  sheet.getRange(4, 1, block.length, 3).setValues(block);
  sheet.getRange(4, 1, 1, 3).setFontWeight("bold");
  sheet.getRange(5, 1, 1, 3).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 3, block.length, 1).setNumberFormat("$#,##0");
  var byDay = {
  }
  , byRep = {
  };
  data.rows.forEach(function (r) {
    (byDay[r.iso] = byDay[r.iso] || {
      n: 0, amt: 0
    }
    );
    byDay[r.iso].n++;
    byDay[r.iso].amt += r.amount;
    (byRep[r.hca] = byRep[r.hca] || {
      n: 0, amt: 0
    }
    );
    byRep[r.hca].n++;
    byRep[r.hca].amt += r.amount;
  }
  );
  var dHead = 4 + block.length + 1;
  sheet.getRange(dHead, 1, 1, 3).setValues([["Day", "Sold", "$"]]).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  var dRows = Object.keys(byDay).sort().map(function (d) {
    return [d, byDay[d].n, byDay[d].amt];
  }
  );
  if (dRows.length) {
    sheet.getRange(dHead + 1, 1, dRows.length, 3).setValues(dRows);
    sheet.getRange(dHead + 1, 3, dRows.length, 1).setNumberFormat("$#,##0");
  }
  var rHead = dHead + dRows.length + 2;
  sheet.getRange(rHead, 1, 1, 3).setValues([["HCA (MTD)", "Sold", "$"]]).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  var rRows = Object.keys(byRep).sort(function (a, b) {
    return byRep[b].amt - byRep[a].amt;
  }
  ).map(function (n) {
    return [n, byRep[n].n, byRep[n].amt];
  }
  );
  if (rRows.length) {
    sheet.getRange(rHead + 1, 1, rRows.length, 3).setValues(rRows);
    sheet.getRange(rHead + 1, 3, rRows.length, 1).setNumberFormat("$#,##0");
  }
  [150, 70, 120].forEach(function (w, i) {
    sheet.setColumnWidth(i + 1, w);
  }
  );
  var url = sheet.getParent().getUrl();
  Logger.log("Sold MTD tab refreshed — " + all.n + " sold, $" + formatMoney_(Math.round(all.amt)) + " (" + from + " → " + to + ").\n" + url);
  return url;
}
function removeSoldMTDLive() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshSoldMTDTab") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  }
  );
  if (n) Logger.log("Removed " + n + " Sold MTD trigger(s).");
  return n;
}
function renameWaterHeaterInterest() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form built yet — run buildRecapForm() first.");
    return;
  }
  var form = FormApp.openById(id);
  var hit = 0;
  form.getItems(FormApp.ItemType.LIST).forEach(function (it) {
    if (/water heater interest|level of interest/i.test(it.getTitle())) {
      it.setTitle("Level of interest");
      hit++;
    }
  }
  );
  Logger.log(hit ? "Renamed the interest question to 'Level of interest'." : "Couldn't find the interest question — rename it by hand in the form editor (the parser already reads either title).");
}
function soldMonthToDate() {
  var from = monthStartIso_(), to = stToday_();
  var data = soldRangeData_(from, to);
  if (!data.ok) {
    var f = "Sold-alert read failed — see the log.";
    Logger.log(f);
    return f;
  }
  var money = function (n) {
    return "$" + formatMoney_(Math.round(n));
  };
  var pad = function (s, w) {
    return (String(s) + " ").slice(0, w);
  };
  var sum = function (pred) {
    var n = 0, a = 0;
    data.rows.forEach(function (r) {
      if (pred(r)) {
        n++;
        a += r.amount;
      }
    }
    );
    return {
      n: n, amt: a
    };
  };
  var all = sum(function () {
    return true;
  }
  );
  var same = sum(function (r) {
    return r.timing === "SAME-DAY";
  }
  );
  var foll = sum(function (r) {
    return r.timing === "FOLLOW-UP";
  }
  );
  var unk = sum(function (r) {
    return r.timing === "UNKNOWN";
  }
  );
  var hvac = sum(function (r) {
    return r.bucket === "system" || r.bucket === "fireplace";
  }
  );
  var fire = sum(function (r) {
    return r.bucket === "fireplace";
  }
  );
  var nonsys = sum(function (r) {
    return r.bucket === "nonsystem";
  }
  );
  var rent = sum(function (r) {
    return r.bucket === "rental";
  }
  );
  var byDay = {
  }
  , byRep = {
  };
  data.rows.forEach(function (r) {
    var d = byDay[r.iso] = byDay[r.iso] || {
      n: 0, amt: 0
    };
    d.n++;
    d.amt += r.amount;
    var p = byRep[r.hca] = byRep[r.hca] || {
      n: 0, amt: 0
    };
    p.n++;
    p.amt += r.amount;
  }
  );
  var lines = [];
  lines.push("Sold — month to date, " + from + " -> " + to + " (pre-tax, HCA only, re-quotes counted once).");
  lines.push(" TOTAL SOLD: " + pad(all.n, 3) + " " + money(all.amt));
  lines.push(" same-day: " + pad(same.n, 3) + " " + money(same.amt));
  lines.push(" follow-up: " + pad(foll.n, 3) + " " + money(foll.amt));
  if (unk.n) lines.push(" unknown: " + pad(unk.n, 3) + " " + money(unk.amt) + " (no booking within " + BOOKED_LOOKBACK_DAYS + "d)");
  if (!data.complete) lines.push(" ! PARTIAL read — hit the alert-search ceiling, so this is LOW.");
  lines.push(" Mix: HVAC (incl fireplace) " + money(hvac.amt) + " (fireplace " + money(fire.amt) + ")" + (nonsys.n ? ", non-system " + money(nonsys.amt) : "") + (rent.n ? ", rental " + rent.n : ""));
  lines.push("");
  lines.push(" by day:");
  Object.keys(byDay).sort().forEach(function (d) {
    lines.push(" " + d + " " + pad(byDay[d].n, 3) + " " + money(byDay[d].amt));
  }
  );
  lines.push(" " + pad("", 13) + "----------");
  lines.push(" " + pad("TOTAL", 13) + pad(all.n, 3) + " " + money(all.amt));
  lines.push("");
  lines.push(" by rep (MTD):");
  Object.keys(byRep).sort(function (a, b) {
    return byRep[b].amt - byRep[a].amt;
  }
  ).forEach(function (name) {
    lines.push(" " + (name + " ").slice(0, 20) + pad(byRep[name].n, 3) + " " + money(byRep[name].amt));
  }
  );
  var msg = lines.join("\n");
  Logger.log(msg);
  return msg;
}
function soldRangeData_(fromIso, toIso) {
  var res = readSoldAlerts_(mtdLookback_(fromIso));
  if (!res.ok) return {
    ok: false
  };
  var sold = collapseResoldAlerts_(res.alerts).filter(function (a) {
    return a.soldOnIso && a.soldOnIso >= fromIso && a.soldOnIso <= toIso;
  }
  );
  var booked = readBookedJobs_(BOOKED_LOOKBACK_DAYS);
  var rows = sold.map(function (a) {
    var bucket = soldTodayBucket_(a);
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var jobKey = stJobKey_(a.jobNumber);
    var cls = jobKey ? classifySameDay_({
      job: jobKey, soldIso: a.soldOnIso
    }
    , booked) : {
      tag: "UNKNOWN", ranIso: ""
    };
    return {
      hca: a.hca, customer: a.customer, amount: amt, name: a.name || "", bucket: bucket, timing: cls.tag, iso: a.soldOnIso
    };
  }
  );
  return {
    ok: true, complete: res.complete, from: fromIso, to: toIso, rows: rows
  };
}
function updateRecapFormFields() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) {
    Logger.log("No form yet — run buildRecapForm() first.");
    return;
  }
  var form = FormApp.openById(id);
  var done = [];
  form.getItems(FormApp.ItemType.LIST).forEach(function (it) {
    var t = String(it.getTitle() || "");
    /* Exact titles only — must never touch Outcome (it carries the branching). */
    if (/^package offered$/i.test(t)) {
      it.asListItem().setChoiceValues(["Good", "Better", "Best", "Value", "Comfort Club", "None / not presented"]);
      done.push("Package: added 'Value'");
    }
    else if (/^objection$/i.test(t)) {
      it.asListItem().setChoiceValues([ "HOA / Permitting", "Other decision maker not available", "Price too high", "Getting additional estimates", "Other" ]);
      done.push("Objection: reworded the options");
    }
  }
  );
  form.getItems(FormApp.ItemType.TEXT).forEach(function (it) {
    var t = String(it.getTitle() || "");
    if (/objection — if other|additional information on objection/i.test(t)) {
      it.setTitle("Additional information on objection");
      it.setHelpText("Anything else on why it didn't close — optional.");
      done.push("Renamed the 'if Other' field");
    }
  }
  );
  Logger.log(done.length ? ("Form updated:\n " + done.join("\n ")) : "Nothing matched — the field titles may already differ; check the form editor.");
}


/* -- One-time (idempotent) backfill: pull the "Additional information on
   objection" note from every past Form response and merge it into the Recap
   Log's Objection column, in the same "Objection — note" format new recaps
   now use. Safe to run repeatedly -- it only fills rows missing the note and
   never overwrites richer data. Run manually from the editor, then run
   refresh1on1Now() so the 1:1 tabs pick it up. -- */
function backfillObjectionNotes() {
  var id = readScriptProperty_(RECAP_FORM_ID_PROP);
  if (!id) { var m0 = "Backfill: no recap form yet (run buildRecapForm first)."; Logger.log(m0); return m0; }
  var form;
  try { form = FormApp.openById(id); }
  catch (e) { var m1 = "Backfill: cannot open recap form -- " + (e && e.message ? e.message : e); Logger.log(m1); return m1; }
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e2) { tz = "America/Los_Angeles"; }

  var wanted = {};   // recap key -> combined "Objection — note"
  form.getResponses().forEach(function (resp) {
    var a = {};
    resp.getItemResponses().forEach(function (ir) { a[ir.getItem().getTitle()] = ir.getResponse(); });
    var customer = String(a["Customer"] || "").trim();
    if (!customer) return;                              // activity-only submission, not a consult
    var hca = String(a["HCA"] || "").trim();
    if (!hca) return;
    var entry = formEntry_(a);                          // same combining logic as new recaps
    var combined = String(entry.objection || "").trim();
    if (!combined) return;                              // sold / no objection -- nothing to add
    var iso = Utilities.formatDate(resp.getTimestamp(), tz, "yyyy-MM-dd");
    var key = recapRowKey_(iso, hca, entry.customer);
    if (!wanted[key] || combined.length > wanted[key].length) wanted[key] = combined;
  });

  var ss = getLogSpreadsheet_().ss;
  var sheet = ss.getSheetByName(DAILY_RECAP_CONFIG.logSheetName);
  if (!sheet) { var m2 = "Backfill: no Recap Log tab."; Logger.log(m2); return m2; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { var m3 = "Backfill: Recap Log is empty."; Logger.log(m3); return m3; }
  var width = RECAP_LOG_HEADERS.length;
  var range = sheet.getRange(2, 1, lastRow - 1, width);
  var vals = range.getValues();
  var OBJ = 10, KEY = 12, updated = 0, matched = 0;
  vals.forEach(function (r) {
    var key = String(r[KEY] || "");
    if (!key) return;
    var combined = wanted[key];
    if (!combined) return;
    matched++;
    var cur = String(r[OBJ] || "").trim();
    /* Fill only when the form clearly has more: cell empty, or the combined
       value starts with the current objection and is longer. Never clobber. */
    if (combined !== cur && (cur === "" || (combined.length > cur.length && combined.indexOf(cur) === 0))) {
      r[OBJ] = combined;
      updated++;
    }
  });
  if (updated) range.setValues(vals);
  var msg = "Backfill objection notes -- " + updated + " row(s) updated of " + matched +
            " matched (" + Object.keys(wanted).length + " notes found on the form).";
  Logger.log(msg);
  return msg;
}

/* =====================================================================
   TIME-OFF / PTO MODULE
   ---------------------------------------------------------------------
   NOTE: the original module was lost in the 8/13 truncation and was not
   in any backup, so this is a REWRITE against the same eight function
   names, not a byte-for-byte restore. Behaviour is deliberately
   conservative:

     - Nothing here writes to the Schedule Exceptions sheet unless YOU
       call applyApprovedTimeOff() yourself. The scheduled tick only
       proposes (emails you a digest).
     - Only "Approved" rows are ever proposed.
     - Only people on RECAP_ROSTER are touched.
     - Writes are de-duplicated against rows already in the sheet, and
       past dates are skipped.

   It writes into the SAME sheet the recap already reads via
   readExceptionsForDate_(): columns Date | HCA Name | Type | Notes.
   The manual path you already use keeps working exactly as before.

   Run testTimeOffScan() first - it logs what it sees and sends nothing.
   ===================================================================== */

var TIME_OFF_CONFIG = {
  query: 'subject:("time off" OR "PTO" OR "vacation" OR "sick") newer_than:{DAYS}d',
  lookbackDays: 14,
  horizonDays: 60
};

/* Map whatever HR calls it onto the two words the schedule logic knows. */
function timeOffType_(raw) {
  var t = String(raw || "").toLowerCase().trim();
  if (!t) return "";
  if (t.indexOf("sick") !== -1) return "Sick";
  if (t.indexOf("paid time off") !== -1) return "Vacation";
  if (t.indexOf("pto") !== -1) return "Vacation";
  if (t.indexOf("vacation") !== -1) return "Vacation";
  if (t.indexOf("holiday") !== -1) return "Vacation";
  if (t.indexOf("bereavement") !== -1) return "Vacation";
  if (t.indexOf("personal") !== -1) return "Vacation";
  return "";
}

/* Pull ISO dates out of text. Handles "9/17/2026 - 9/18/2026" ranges and
   bare dates. Ranges expand to every day inclusive. */
function extractTimeOffDates_(text) {
  var s = String(text || "");
  var out = {};
  var D = "(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})";
  var rangeRe = new RegExp(D + "\\s*(?:-|\u2013|\u2014|to|through)\\s*" + D, "g");
  var seenSpan = [];
  var m;

  function iso(mm, dd, yyyy) { return yyyy + "-" + pad2_(mm) + "-" + pad2_(dd); }
  function addSpan(a, b) {
    var start = new Date(a + "T12:00:00"), end = new Date(b + "T12:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (end < start) return;
    var guard = 0, cur = start;
    while (cur <= end && guard < 90) {
      out[Utilities.formatDate(cur, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")] = true;
      cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      guard++;
    }
  }

  while ((m = rangeRe.exec(s)) !== null) {
    seenSpan.push(m[0]);
    addSpan(iso(m[1], m[2], m[3]), iso(m[4], m[5], m[6]));
  }
  var singleRe = new RegExp(D, "g");
  var consumed = seenSpan.join(" | ");
  while ((m = singleRe.exec(s)) !== null) {
    if (consumed.indexOf(m[0]) !== -1) continue;
    out[iso(m[1], m[2], m[3])] = true;
  }
  return Object.keys(out).sort();
}

/* Read recent time-off mail into structured candidates. Roster only. */
function scanTimeOffCandidates_(days) {
  var lookback = days || TIME_OFF_CONFIG.lookbackDays;
  var q = TIME_OFF_CONFIG.query.replace("{DAYS}", String(lookback));
  var out = [], threads;
  try {
    threads = GmailApp.search(q, 0, 50);
  } catch (err) {
    Logger.log("Time-off scan failed: " + (err && err.message ? err.message : err));
    return out;
  }

  var todayIso = Utilities.formatDate(new Date(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  var horizon = new Date(new Date().getTime() + TIME_OFF_CONFIG.horizonDays * 24 * 60 * 60 * 1000);
  var horizonIso = Utilities.formatDate(horizon, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");

  threads.forEach(function (th) {
    th.getMessages().forEach(function (msg) {
      var body = "";
      try { body = msg.getPlainBody() || ""; } catch (e) { return; }
      var subject = msg.getSubject() || "";
      var hay = subject + "\n" + body;

      RECAP_ROSTER.forEach(function (hca) {
        var target = normName_(hca.name);
        if (!target) return;
        var lines = hay.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          if (normName_(lines[i]).indexOf(target) === -1) continue;
          var chunk = lines.slice(i, i + 3).join(" ");
          var status = /approved/i.test(chunk) ? "Approved"
            : /denied/i.test(chunk) ? "Denied"
              : /requested/i.test(chunk) ? "Requested" : "";
          if (/cancellation/i.test(chunk)) status = "Cancelled";
          var type = timeOffType_(chunk);
          if (!type) continue;
          var dates = extractTimeOffDates_(chunk).filter(function (d) {
            return d >= todayIso && d <= horizonIso;
          });
          if (!dates.length) continue;
          out.push({
            name: hca.name, roster: hca, type: type, status: status, dates: dates,
            subject: subject, msgId: msg.getId(),
            date: Utilities.formatDate(msg.getDate(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")
          });
          break;
        }
      });
    });
  });
  return out;
}

/* Existing sheet rows keyed "iso|lowercased name" so we never duplicate. */
function timeOffExistingKeys_() {
  var seen = {};
  try {
    var cfg = DAILY_RECAP_CONFIG;
    var ss = SpreadsheetApp.openById(cfg.exceptionsSpreadsheetId);
    var sheet = cfg.exceptionsSheetName ? ss.getSheetByName(cfg.exceptionsSheetName) : ss.getSheets()[0];
    if (!sheet) return seen;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return seen;
    var header = values[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
    var cDate = indexOfHeader_(header, ["date"]);
    var cName = indexOfHeader_(header, ["hca name", "hca", "name"]);
    if (cDate === -1 || cName === -1) return seen;
    for (var i = 1; i < values.length; i++) {
      var iso = normalizeSheetDate_(values[i][cDate]);
      var nm = String(values[i][cName] || "").trim().toLowerCase();
      if (iso && nm) seen[iso + "|" + nm] = true;
    }
  } catch (err) {
    Logger.log("timeOffExistingKeys_ failed: " + (err && err.message ? err.message : err));
  }
  return seen;
}

/* Read-only. Emails you what it WOULD write. This is what the trigger runs. */
function proposeTimeOffFromEmail(days) {
  var cands = scanTimeOffCandidates_(days);
  var approved = cands.filter(function (c) { return c.status === "Approved"; });
  if (!approved.length) {
    Logger.log("Time-off scan: nothing approved and upcoming.");
    return { count: 0, candidates: [] };
  }
  var existing = timeOffExistingKeys_();
  var lines = [], newCount = 0;
  approved.forEach(function (c) {
    var fresh = c.dates.filter(function (d) { return !existing[d + "|" + c.name.toLowerCase()]; });
    if (!fresh.length) return;
    newCount += fresh.length;
    lines.push("  " + c.name + " - " + c.type + " - " + fresh.join(", ") +
      "\n      (from: " + c.subject + ")");
  });
  if (!newCount) {
    Logger.log("Time-off scan: " + approved.length + " approved request(s), all already on the sheet.");
    return { count: 0, candidates: approved };
  }
  var body = "Approved time off found in email that is NOT yet in the Schedule Exceptions sheet:\n\n" +
    lines.join("\n") + "\n\n" +
    "Nothing has been written. To apply these, run applyApprovedTimeOff() in the\n" +
    "Apps Script editor, or add the rows by hand as usual.\n\n" +
    "Sheet: https://docs.google.com/spreadsheets/d/" +
    DAILY_RECAP_CONFIG.exceptionsSpreadsheetId + "/edit\n";
  MailApp.sendEmail({
    to: DAILY_RECAP_CONFIG.managerEmail,
    subject: "Time off to review - " + newCount + " day(s) not on the schedule",
    body: body, name: DAILY_RECAP_CONFIG.fromName
  });
  Logger.log("Time-off scan: proposed " + newCount + " day(s) by email.");
  return { count: newCount, candidates: approved };
}

/* THE ONLY FUNCTION THAT WRITES. Run it by hand. */
function applyApprovedTimeOff(days) {
  var cfg = DAILY_RECAP_CONFIG;
  var cands = scanTimeOffCandidates_(days).filter(function (c) { return c.status === "Approved"; });
  if (!cands.length) { Logger.log("applyApprovedTimeOff: nothing approved to write."); return { written: 0 }; }

  var ss = SpreadsheetApp.openById(cfg.exceptionsSpreadsheetId);
  var sheet = cfg.exceptionsSheetName ? ss.getSheetByName(cfg.exceptionsSheetName) : ss.getSheets()[0];
  if (!sheet) { Logger.log("applyApprovedTimeOff: exceptions sheet not found."); return { written: 0 }; }

  var values = sheet.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
  var cDate = indexOfHeader_(header, ["date"]);
  var cName = indexOfHeader_(header, ["hca name", "hca", "name"]);
  var cType = indexOfHeader_(header, ["type"]);
  var cNote = indexOfHeader_(header, ["notes", "note"]);
  if (cDate === -1 || cName === -1 || cType === -1) {
    Logger.log("applyApprovedTimeOff: expected Date / HCA Name / Type columns, got: " + header.join(", "));
    return { written: 0 };
  }

  var existing = timeOffExistingKeys_();
  var width = Math.max(cDate, cName, cType, cNote) + 1;
  var rows = [], log = [];
  cands.forEach(function (c) {
    c.dates.forEach(function (d) {
      var key = d + "|" + c.name.toLowerCase();
      if (existing[key]) return;
      existing[key] = true;
      var row = [];
      for (var w = 0; w < width; w++) row.push("");
      row[cDate] = d; row[cName] = c.name; row[cType] = c.type;
      if (cNote !== -1) row[cNote] = "Auto-added from approved time-off email " + c.date;
      rows.push(row);
      log.push(c.name + " " + d + " " + c.type);
    });
  });
  if (!rows.length) { Logger.log("applyApprovedTimeOff: everything approved is already on the sheet."); return { written: 0 }; }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  Logger.log("applyApprovedTimeOff: wrote " + rows.length + " row(s):\n  " + log.join("\n  "));
  return { written: rows.length, rows: log };
}

/* Morning heads-up: who the schedule says is off today. Reads only. */
function sendTimeOffMorningCheck() {
  var iso = Utilities.formatDate(new Date(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  var ex = readExceptionsForDate_(iso);
  if (!ex.ok) {
    MailApp.sendEmail({
      to: DAILY_RECAP_CONFIG.managerEmail,
      subject: "Time off check - Schedule Exceptions sheet unreadable",
      body: "Could not read the Schedule Exceptions sheet this morning, so nobody " +
        "was suppressed from the recap.\n\nError: " + ex.error + "\n",
      name: DAILY_RECAP_CONFIG.fromName
    });
    return { ok: false };
  }
  var names = Object.keys(ex.byName);
  if (!names.length) { Logger.log("Time off check " + iso + ": nobody off today."); return { ok: true, count: 0 }; }
  var lines = names.map(function (k) {
    return "  " + k.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); }) +
      " - " + ex.byName[k].type + (ex.byName[k].notes ? " (" + ex.byName[k].notes + ")" : "");
  });
  MailApp.sendEmail({
    to: DAILY_RECAP_CONFIG.managerEmail,
    subject: "Off today (" + iso + "): " + names.length,
    body: "Per the Schedule Exceptions sheet, off today:\n\n" + lines.join("\n") +
      "\n\nThese people will not be nagged for a recap.\n",
    name: DAILY_RECAP_CONFIG.fromName
  });
  Logger.log("Time off check " + iso + ": " + names.length + " off.");
  return { ok: true, count: names.length };
}

/* Trigger handler. Propose-only by design. */
function timeOffTick() {
  try { proposeTimeOffFromEmail(); }
  catch (err) { Logger.log("timeOffTick failed: " + (err && err.message ? err.message : err)); }
}

/* Install (or reinstall) the two time-off triggers. Idempotent. */
function installTimeOffTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "timeOffTick" || fn === "sendTimeOffMorningCheck") ScriptApp.deleteTrigger(t);
  });
  var tz = DAILY_RECAP_CONFIG.timeZone;
  ScriptApp.newTrigger("timeOffTick").timeBased().everyDays(1).atHour(15).inTimezone(tz).create();
  ScriptApp.newTrigger("sendTimeOffMorningCheck").timeBased().everyDays(1).atHour(5).inTimezone(tz).create();
  Logger.log("Installed time-off triggers (scan 15:00, morning check 05:00, " + tz + ").");
}

/* Safe dry run - logs what the scanner sees, emails nothing, writes nothing. */
function testTimeOffScan() {
  var c = scanTimeOffCandidates_();
  Logger.log("Time-off candidates found: " + c.length);
  c.forEach(function (x) {
    Logger.log("  " + x.name + " | " + x.type + " | " + x.status + " | " + x.dates.join(", ") + " | " + x.subject);
  });
  return c;
}
/* ================= END TIME-OFF / PTO MODULE ================= */

/* =====================================================================
   SELF-ADVANCING GROWTH BUILDER  —  v2
   ---------------------------------------------------------------------
   Reads the newest "All Leads*" and "All Installs*" exports in your Drive
   and reports the four BI_MTD_* constants plus the day INSTALL columns,
   along with any drift from what this script currently holds.

   READ-ONLY. Nothing here writes to the growth sheet and nothing changes
   L2C_DAYS. It reports; you paste.

   It does NOT compute the day LEAD columns on purpose: the growth sheet
   defines those as consults that RAN that day (dispatch board), while the
   export counts leads RECEIVED. Different measures.

   SETUP: Editor -> Services (+) -> Drive API -> Add.
   ===================================================================== */

var GROWTH_AUTO = {
  /* The Daily Uploads folder. Its READ ME is the contract: drop the exports in,
     do not rename them, dated "Uploads MM.DD" subfolders optional. */
  uploadsFolderId: "1Ac4ApEHqxPUaYd9q2fnSTSPbPG15ifyR",
  /* Filenames are the FALLBACK only — see gaResolveUploads_ for why. */
  leadsTitlePrefix:    "All Leads",
  installsTitlePrefix: "All Installs",
  pipelineTitlePrefix: "HVAC Backlog and Pipeline Installs",
  staleAfterDays: 2,
  maxUploadReads: 10,
  /* Window for the unattended run, Pacific, inclusive of both hours.
     Uploads do not land at a fixed time — 8/17 arrived 06:39, 8/15 arrived
     14:20 — so a single fixed trigger would miss on roughly half the days.
     The handler polls across the window and goes quiet for the rest of the
     day once it has loaded the operational date.

     Starts at 7 because that is when the BI report lands; the poll interval
     is 15 minutes so a 7:30 upload is live before the 7:45 huddle rather
     than an hour later. Runs to 15:00 to catch an afternoon upload. */
  autoFromHour: 7,
  autoToHour: 15,
  autoEveryMinutes: 15
};

/* ----------------------------------------------------------------------------
 * WHICH FILE IS WHICH — by column header, never by filename.
 *
 * The Daily Uploads READ ME tells you not to rename anything, because these are
 * identified by their headers. The old prefix matcher disagreed with that: it
 * globbed all of Drive and had eleven "All Leads" candidates to guess between,
 * resolving by Drive's modified timestamp — so re-uploading an old file would
 * silently make it "newest". Headers cannot be gamed that way.
 *
 * Each signature requires EVERY field, and the three are mutually exclusive:
 *   leads    — only it has businessUnit.name / DuplicateFlag
 *   installs — only it has HVAC Type   (pipeline also carries SoldByName and
 *              BU_name_without_geo, so HVAC Type is the discriminator)
 *   pipeline — only it has zone        (leads also carries lastApptDate and
 *              jobStatus, so zone is the discriminator)
 * -------------------------------------------------------------------------- */
var GROWTH_UPLOAD_SIGNATURES = {
  leads:    ["lead type", "businessunit.name", "duplicateflag"],
  installs: ["hvac type", "soldbyname", "business unit"],
  pipeline: ["lastapptdate", "jobstatus", "zone"]
};

var GROWTH_UPLOADS_CACHE_ = null;

/* Reads a Drive file into a value grid. Native Sheets open directly; anything
   else goes through the xlsx converter. */
function gaReadTabular_(file) {
  if (String(file.getMimeType()) === MimeType.GOOGLE_SHEETS) {
    return SpreadsheetApp.openById(file.getId()).getSheets()[0].getDataRange().getValues();
  }
  return gaReadXlsx_(file.getId());
}

function gaMatchSignature_(values) {
  /* Headers are not always on row 1, so scan the first few rows. */
  for (var r = 0; r < Math.min(values.length, 8); r++) {
    var low = values[r].map(function (h) { return String(h || "").trim().toLowerCase(); });
    if (!low.join("")) continue;
    for (var kind in GROWTH_UPLOAD_SIGNATURES) {
      var need = GROWTH_UPLOAD_SIGNATURES[kind];
      var ok = need.every(function (h) { return low.indexOf(h) > -1; });
      if (ok) return kind;
    }
  }
  return "";
}

/* Every candidate in the uploads folder and one level of subfolders,
   newest first. One level is deliberate — it matches "Uploads MM.DD" and
   stops a stray nested archive from being pulled in. */
function gaUploadCandidates_() {
  var out = [];
  var root;
  try { root = DriveApp.getFolderById(GROWTH_AUTO.uploadsFolderId); }
  catch (e) {
    Logger.log("Uploads folder unreachable (" + e + ") — falling back to filename search.");
    return out;
  }
  function take(folder, where) {
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var mt = String(f.getMimeType());
      if (mt !== MimeType.GOOGLE_SHEETS &&
          mt !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") continue;
      out.push({ file: f, id: f.getId(), title: f.getName(), updated: f.getLastUpdated(), where: where });
    }
  }
  take(root, "(top level)");
  var subs = root.getFolders();
  while (subs.hasNext()) { var sf = subs.next(); take(sf, sf.getName()); }
  out.sort(function (a, b) { return b.updated - a.updated; });
  return out;
}

/* Resolves leads / installs / pipeline in ONE pass, memoized for the execution.
   Reading an xlsx means converting it, which is slow, so candidates are taken
   newest-first and the walk stops as soon as everything asked for is found.
   In practice today's folder holds exactly three files and it costs three
   reads — the same as the old prefix path, with none of the ambiguity. */
function gaResolveUploads_(kinds) {
  kinds = kinds || ["leads", "installs", "pipeline"];
  if (!GROWTH_UPLOADS_CACHE_) GROWTH_UPLOADS_CACHE_ = { found: {}, log: [], scanned: false };
  var C = GROWTH_UPLOADS_CACHE_;

  var missing = kinds.filter(function (k) { return !C.found[k]; });
  if (!missing.length) return C;

  /* The folder scan latches via C.scanned, so it happens at most once per
     execution — which means it must resolve ALL THREE kinds, not just the ones
     this caller asked for. Before this fix, growthMorningRefresh called
     gaResolveUploads_(["pipeline"]) first, the walk broke as soon as the
     pipeline file was found, C.scanned went true, and the later
     ["leads","installs"] call skipped the folder entirely and fell through to
     the Drive-wide filename search. */
  var ALL_KINDS = ["leads", "installs", "pipeline"];

  if (!C.scanned) {
    var cands = gaUploadCandidates_();
    C.log.push("uploads folder: " + cands.length + " spreadsheet file(s) visible");
    var reads = 0;
    for (var i = 0; i < cands.length && reads < GROWTH_AUTO.maxUploadReads; i++) {
      if (!ALL_KINDS.some(function (k) { return !C.found[k]; })) break;
      var c = cands[i], vals;
      try { vals = gaReadTabular_(c.file); reads++; }
      catch (e) { C.log.push("  skipped " + c.title + " (" + e + ")"); continue; }
      var kind = gaMatchSignature_(vals);
      if (!kind) { C.log.push("  " + c.title + " — no known header signature, ignored"); continue; }
      if (C.found[kind]) continue;
      C.found[kind] = { id: c.id, title: c.title, updated: c.updated, values: vals, where: c.where };
      C.log.push("  " + kind + ": " + c.title + "   [" + c.where + "]");
    }
    C.scanned = true;
  }

  /* Filename fallback for anything the folder did not yield. */
  var prefixes = { leads: GROWTH_AUTO.leadsTitlePrefix, installs: GROWTH_AUTO.installsTitlePrefix,
                   pipeline: GROWTH_AUTO.pipelineTitlePrefix };
  kinds.forEach(function (k) {
    if (C.found[k]) return;
    var f = gaNewestExport_(prefixes[k]);
    if (!f) { C.log.push("  " + k + ": NOT FOUND in the uploads folder or by filename"); return; }
    try {
      C.found[k] = { id: f.id, title: f.title, updated: f.updated,
                     values: gaReadXlsx_(f.id), where: "(filename fallback)" };
      C.log.push("  " + k + ": " + f.title + "   [filename fallback — newest by MODIFIED TIME across all of Drive, NOT from the uploads folder]");
    } catch (e) { C.log.push("  " + k + ": found " + f.title + " but could not read it (" + e + ")"); }
  });
  return C;
}

function gaNewestExport_(prefix) {
  var best = null, seen = [];
  try {
    var it = DriveApp.searchFiles('title contains "' + prefix.replace(/"/g, '') + '" and trashed = false');
    while (it.hasNext()) {
      var f = it.next();
      if (String(f.getName() || "").indexOf(prefix) !== 0) continue;
      seen.push(f.getName());
      var when = f.getLastUpdated();
      if (!best || when > best.updated) best = { id: f.getId(), title: f.getName(), updated: when };
    }
  } catch (err) {
    Logger.log("Drive search failed for '" + prefix + "': " + (err && err.message ? err.message : err));
  }
  if (seen.length > 1) Logger.log("Candidates for '" + prefix + "': " + seen.join(", ") + "  -> using " + (best ? best.title : "(none)"));
  return best;
}

function gaReadXlsx_(fileId) {
  if (typeof Drive === "undefined" || !Drive.Files) {
    throw new Error("Advanced Drive Service is off. Editor -> Services (+) -> Drive API -> Add.");
  }
  var blob = DriveApp.getFileById(fileId).getBlob();
  var tempId = null, values = null;
  try {
    var made;
    try { made = Drive.Files.insert({ title: "TEMP growth import", mimeType: MimeType.GOOGLE_SHEETS }, blob, { convert: true }); }
    catch (e2) { made = Drive.Files.create({ name: "TEMP growth import", mimeType: MimeType.GOOGLE_SHEETS }, blob); }
    tempId = made.id || made.getId();
    values = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
  } finally {
    if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e3) {} }
  }
  return values;
}

function gaIso_(value) {
  if (!value && value !== 0) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  }
  var t = String(value).trim();
  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { var yr = m[3].length === 2 ? ("20" + m[3]) : m[3]; return yr + "-" + pad2_(m[1]) + "-" + pad2_(m[2]); }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + pad2_(m[2]) + "-" + pad2_(m[3]);
  return "";
}

function gaBucket_(leadType) {
  var t = String(leadType || "").toLowerCase().trim();
  if (!t) return "";
  if (t.indexOf("self gen") !== -1) return "sg";
  if (t.indexOf("tech") !== -1) return "tech";
  if (t.indexOf("inbound") !== -1 || t.indexOf("webform") !== -1) return "mkt";
  return "";
}

function gaCountByDay_(values, whatFor) {
  var DATE_HEADERS = ["est", "export est", "date"];
  var out = {}, header = null, cDate = -1, cType = -1, parsed = 0, unbucketed = {};
  /* Fix 6: when processing installs, also detect rental rows via job.type column */
  var cJobType = -1, rentalTotal = 0;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!header) {
      var lower = row.map(function (h) { return String(h || "").trim().toLowerCase(); });
      if (lower.indexOf("lead type") === -1) continue;
      header = lower;
      cType = lower.indexOf("lead type");
      for (var k = 0; k < DATE_HEADERS.length && cDate === -1; k++) cDate = lower.indexOf(DATE_HEADERS[k]);
      if (cDate === -1) {
        throw new Error("No date column in the " + whatFor + " export. Looked for " +
          DATE_HEADERS.join(" / ") + ". Header row was: [" + lower.join(" | ") + "]");
      }
      /* Fix 6: locate the job.type column for rental detection (installs only) */
      if (whatFor === "installs") {
        cJobType = lower.indexOf("job.type");
      }
      continue;
    }
    var iso = gaIso_(row[cDate]);
    if (!iso) continue;
    var b = gaBucket_(row[cType]);
    if (!b) { var lt = String(row[cType] || "(blank)"); unbucketed[lt] = (unbucketed[lt] || 0) + 1; continue; }
    if (!out[iso]) out[iso] = { mkt: 0, tech: 0, sg: 0, rental: 0 };
    out[iso][b]++; parsed++;
    /* Fix 6: count rental installs per day — job.type containing "rental" (case-insensitive) */
    if (cJobType !== -1 && String(row[cJobType] || "").toLowerCase().indexOf("rental") !== -1) {
      out[iso].rental++; rentalTotal++;
    }
  }
  if (!header) throw new Error("No 'Lead Type' header found in the " + whatFor + " export.");
  var ub = Object.keys(unbucketed);
  if (ub.length) Logger.log(whatFor + ": ignored lead types -> " + ub.map(function (k) { return k + " x" + unbucketed[k]; }).join(", "));
  Logger.log(whatFor + ": parsed " + parsed + " rows across " + Object.keys(out).length + " days.");
  return out;
}

function growthPreview() {
  var warn = [];
  var today = Utilities.formatDate(new Date(), DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  var fromIso = monthStartIso_();
  var toIso   = today;

  var res = gaResolveUploads_(["leads", "installs"]);
  res.log.forEach(function (l) { Logger.log(l); });
  var leadsFile = res.found.leads, instFile = res.found.installs;
  if (!leadsFile) { Logger.log("No leads export found in the uploads folder."); return null; }
  if (!instFile)  { Logger.log("No installs export found in the uploads folder."); return null; }
  Logger.log("Leads file: " + leadsFile.title + "   Installs file: " + instFile.title);

  function ageDays(d) { return Math.floor((new Date().getTime() - d.getTime()) / 86400000); }
  var la = ageDays(leadsFile.updated), ia = ageDays(instFile.updated);
  if (la > GROWTH_AUTO.staleAfterDays) warn.push("Leads export is " + la + "d old (" + leadsFile.title + ") - re-export.");
  if (ia > GROWTH_AUTO.staleAfterDays) warn.push("Installs export is " + ia + "d old (" + instFile.title + ") - re-export.");

  var leadsBy, instBy;
  try {
    /* Already read during resolution — identifying a file and parsing it are
       the same expensive conversion, so it happens once. */
    leadsBy = gaCountByDay_(leadsFile.values, "leads");
    instBy  = gaCountByDay_(instFile.values, "installs");
  } catch (err) {
    var msg = "growthPreview failed: " + (err && err.message ? err.message : err);
    Logger.log(msg); return { ok: false, error: msg };
  }

  var tot = { mkt: 0, tech: 0, sg: 0 }, lastDay = "";
  Object.keys(leadsBy).forEach(function (d) {
    if (d < fromIso || d > toIso) return;
    tot.mkt += leadsBy[d].mkt; tot.tech += leadsBy[d].tech; tot.sg += leadsBy[d].sg;
    if (d > lastDay) lastDay = d;
  });
  var totalLeads = tot.mkt + tot.tech + tot.sg;

  var DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var curByLabel = {};
  {
    /* RAW, deliberately. readGrowthDays_ applies GROWTH_SOURCE_CORRECTIONS, and
       diffing corrected rows against the export would report every known
       mis-tag as drift forever. Corrections belong on top of stored data, not
       inside the comparison that maintains it. */
    readGrowthDaysRaw_().forEach(function (r) { curByLabel[r[0]] = r; });
  }
  var instLines = [], drift = [];
  Object.keys(instBy).sort().forEach(function (iso) {
    if (iso < fromIso || iso > toIso) return;
    if (iso > lastDay) lastDay = iso;
    var p = iso.split("-");
    var label = DN[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + " " + (+p[1]) + "/" + (+p[2]);
    var I = instBy[iso];
    instLines.push("  " + label + "  ->  mktInst " + I.mkt + ", techInst " + I.tech + ", sgInst " + I.sg);
    var cur = curByLabel[label];
    if (cur && (cur[4] !== I.mkt || cur[5] !== I.tech || cur[6] !== I.sg)) {
      drift.push(label + ": script(" + cur[4] + "," + cur[5] + "," + cur[6] + ") vs export(" + I.mkt + "," + I.tech + "," + I.sg + ")");
    }
    if (!cur) drift.push(label + ": MISSING from L2C_DAYS - add a row (installs " + I.mkt + "," + I.tech + "," + I.sg + ")");
  });

  var consts =
    "var BI_MTD_LEADS = " + totalLeads + ";\n" +
    "var BI_MTD_MKT_LEADS = " + tot.mkt + ";\n" +
    "var BI_MTD_TECH_LEADS = " + tot.tech + ";\n" +
    "var BI_MTD_SG_LEADS = " + tot.sg + ";";

  var curLeads = (typeof BI_MTD_LEADS === "number") ? BI_MTD_LEADS : null;
  var constDrift = (curLeads !== null && curLeads !== totalLeads);

  var body =
    "GROWTH SHEET - computed from your Drive exports\n" +
    "===============================================\n" +
    "Leads   : " + leadsFile.title + "  (" + la + "d old)\n" +
    "Installs: " + instFile.title + "  (" + ia + "d old)\n" +
    "Latest day present in the data: " + (lastDay || "(none)") + "\n" +
    "Today: " + today + "\n\n" +
    (warn.length ? ("!! " + warn.join("\n!! ") + "\n\n") : "") +
    (lastDay && lastDay < today ?
      ("NOTE: the exports have no data for today (" + today + "). ServiceTitan's\n" +
       "EST field posts a day late, so the newest complete day is " + lastDay + ".\n\n") : "") +
    "MTD CONSTANTS" + (constDrift ? "  *** DIFFERENT FROM THE SCRIPT (script has " + curLeads + ") ***" : "  (matches the script)") + "\n\n" +
    consts + "\n\n" +
    "DAY INSTALL COLUMNS (positions 5,6,7 of each L2C_DAYS row):\n" +
    (instLines.length ? instLines.join("\n") : "  (none)") + "\n\n" +
    "DRIFT vs the script:\n" +
    (drift.length ? ("  " + drift.join("\n  ")) : "  none - script matches the exports.") + "\n\n" +
    "NOT COMPUTED, ON PURPOSE:\n" +
    "  - day LEAD columns: the sheet defines those as consults that RAN\n" +
    "    that day (dispatch board). The export counts leads RECEIVED.\n" +
    "  - sold: overridden live by the sold engine.\n" +
    "  - $installed: not in either export. Add a revenue column to the\n" +
    "    ServiceTitan install report to make this fully automatic.\n\n" +
    "Cross-check the MTD constants against BI before publishing the link.\n";

  Logger.log(body);
  try {
    MailApp.sendEmail({
      to: DAILY_RECAP_CONFIG.managerEmail,
      subject: "Growth numbers - data through " + (lastDay || "?") +
        (warn.length ? " (STALE EXPORT)" : (drift.length || constDrift ? " (DRIFT)" : " (in sync)")),
      body: body, name: DAILY_RECAP_CONFIG.fromName
    });
  } catch (e) { Logger.log("Email failed: " + e); }

  return { ok: true, totalLeads: totalLeads, mkt: tot.mkt, tech: tot.tech, sg: tot.sg,
           lastDay: lastDay, drift: drift, constDrift: constDrift, warnings: warn };
}

function growthDriftCheck() { return growthPreview(); }
/* ============== END SELF-ADVANCING GROWTH BUILDER v2 ============== */
/* ============================================================================
 * STAGE 2b — the exports write themselves in.
 *
 * growthPreview() already computes the day install columns and the four MTD
 * lead figures from the newest Drive exports; it could only ever print them.
 * This commits them: install columns onto the Daily Data tab, MTD figures onto
 * the Growth Config tab.
 *
 * WHAT IT WILL NEVER WRITE, and why:
 *   - day LEAD columns. The sheet counts consults that RAN off the dispatch
 *     board; the export counts leads RECEIVED, and revisits are only visible
 *     as board position. No export field distinguishes them. Human read.
 *   - sold count / sold $. Owned by the live ServiceTitan engine, which is
 *     ahead of BI, so writing them here would move numbers backwards.
 *   - installed $. Not present in either export. Add a revenue column to the
 *     ServiceTitan install report and this becomes automatic too.
 *
 * THE TRUNCATION GUARD is the point of this module. Apple Numbers silently
 * truncates these exports, and a short export looks exactly like a real file.
 * Within a month, leads and installs only ever accumulate — so a total that
 * DROPS is proof the file is partial, never a real decline. Any drop aborts
 * the whole run before a single cell is written.
 * ========================================================================== */
/* ---- NEW: per-day Completed lead counts, keyed by lastApptDate (NOT the
   same thing as leadsBy above, which is keyed by EST/received-date and
   includes every status -- that's the correct shape for the MTD total the
   BI dashboard shows, but the wrong shape for "leads that ran this day". ---- */
function gaCountCompletedLeadsByApptDay_(values) {
  var out = {}, header = null, cDate = -1, cType = -1, cStatus = -1,
      parsed = 0, skippedStatus = 0, unbucketed = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!header) {
      var lower = row.map(function (h) { return String(h || "").trim().toLowerCase(); });
      if (lower.indexOf("lead type") === -1 || lower.indexOf("lastapptdate") === -1) continue;
      header = lower;
      cType = lower.indexOf("lead type");
      cDate = lower.indexOf("lastapptdate");
      cStatus = lower.indexOf("jobstatus");
      if (cStatus === -1) {
        throw new Error("No jobStatus column in the leads export -- cannot filter to Completed.");
      }
      continue;
    }
    if (String(row[cStatus] || "").trim() !== "Completed") { skippedStatus++; continue; }
    var iso = gaIso_(row[cDate]);
    if (!iso) continue;
    var b = gaBucket_(row[cType]);
    if (!b) { var lt = String(row[cType] || "(blank)"); unbucketed[lt] = (unbucketed[lt] || 0) + 1; continue; }
    if (!out[iso]) out[iso] = { mkt: 0, tech: 0, sg: 0 };
    out[iso][b]++; parsed++;
  }
  if (!header) throw new Error("No 'Lead Type' + 'lastApptDate' headers found in the leads export.");
  var ub = Object.keys(unbucketed);
  if (ub.length) Logger.log("leads (by appt day, Completed only): ignored lead types -> " +
    ub.map(function (k) { return k + " x" + unbucketed[k]; }).join(", "));
  Logger.log("leads (by appt day, Completed only): parsed " + parsed + " Completed rows across " +
    Object.keys(out).length + " days; skipped " + skippedStatus + " non-Completed rows.");
  return out;
}

function growthAutoAdvance_(commit) {
  var tz = DAILY_RECAP_CONFIG.timeZone;
  var today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var fromIso = monthStartIso_();   // business-month start (2nd of the month)
  var toIso   = today;              // through today
  var log = [], fatal = [];

  var res = gaResolveUploads_(["leads", "installs"]);
  log = log.concat(res.log);
  var leadsFile = res.found.leads, instFile = res.found.installs;
  if (!leadsFile) fatal.push("No leads export found — nothing in the uploads folder carries " +
    GROWTH_UPLOAD_SIGNATURES.leads.join(" / ") + ".");
  if (!instFile)  fatal.push("No installs export found — nothing in the uploads folder carries " +
    GROWTH_UPLOAD_SIGNATURES.installs.join(" / ") + ".");
  if (fatal.length) return growthAutoAbort_(fatal, log, commit);

  function ageDays(d) { return Math.floor((new Date().getTime() - d.getTime()) / 86400000); }
  var la = ageDays(leadsFile.updated), ia = ageDays(instFile.updated);
  log.push("leads   : " + leadsFile.title + "  (" + la + "d old)");
  log.push("installs: " + instFile.title + "  (" + ia + "d old)");
  if (la > GROWTH_AUTO.staleAfterDays) fatal.push("Leads export is " + la + " days old — re-export before advancing.");
  if (ia > GROWTH_AUTO.staleAfterDays) fatal.push("Installs export is " + ia + " days old — re-export before advancing.");
  if (fatal.length) return growthAutoAbort_(fatal, log, commit);

  var leadsBy, instBy, leadsByApptDay;
  try {
    /* Already read during resolution — identifying a file and parsing it are
       the same expensive conversion, so it happens once. */
    leadsBy = gaCountByDay_(leadsFile.values, "leads");
    instBy  = gaCountByDay_(instFile.values, "installs");
    leadsByApptDay = gaCountCompletedLeadsByApptDay_(leadsFile.values);
  } catch (err) {
    return growthAutoAbort_(["Could not parse an export: " + (err && err.message ? err.message : err)], log, commit);
  }

  /* ---- month totals from the exports ---- */
  var lt = { mkt: 0, tech: 0, sg: 0 }, it = { mkt: 0, tech: 0, sg: 0 }, lastDay = "";
  var mtdRentalInst = 0;  // Fix 6: sum only MTD rental installs
  Object.keys(leadsBy).forEach(function (d) {
    if (d < fromIso || d > toIso) return;
    lt.mkt += leadsBy[d].mkt; lt.tech += leadsBy[d].tech; lt.sg += leadsBy[d].sg;
    if (d > lastDay) lastDay = d;
  });
  Object.keys(instBy).forEach(function (d) {
    if (d < fromIso || d > toIso) return;
    it.mkt += instBy[d].mkt; it.tech += instBy[d].tech; it.sg += instBy[d].sg;
    mtdRentalInst += instBy[d].rental || 0;  // Fix 6: date-filtered rental count
    if (d > lastDay) lastDay = d;
  });
  var totalLeads = lt.mkt + lt.tech + lt.sg, totalInst = it.mkt + it.tech + it.sg;
  log.push("export MTD: leads " + totalLeads + " (mkt " + lt.mkt + ", tech " + lt.tech + ", sg " + lt.sg +
    ")  installs " + totalInst + " (mkt " + it.mkt + ", tech " + it.tech + ", sg " + it.sg + ")");
  log.push("data through: " + (lastDay || "(none)"));
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);

  /* ---- TRUNCATION GUARD ---- */
  var raw = readGrowthDaysRaw_(ss);
  var curInst = 0;
  raw.forEach(function (r) { curInst += (Number(r[4]) || 0) + (Number(r[5]) || 0) + (Number(r[6]) || 0); });
  var curBi = growthBiMtd_(ss);

  /* Detect business-month rollover: the stored BI_MONTH_START differs from
     the current fromIso, so the counters are expected to reset. On the first
     day of a new month EST usually has not posted yet, so 0 rows is normal —
     exit gracefully rather than ABORT. */
  var isNewMonth = !curBi.monthStart || curBi.monthStart !== fromIso;

  if (isNewMonth && !totalLeads && !totalInst) {
    log.push("");
    log.push("New business month (" + fromIso + ") — no activity has posted for today yet. Nothing to write.");
    var rep = log.join("\n"); Logger.log(rep);
    return { ok: true, committed: false, updates: 0, appends: 0,
             needsSoldAndDollars: [], dataThroughIso: "", report: rep };
  }

  if (!isNewMonth) {
    if (!totalLeads) fatal.push("The leads export produced 0 rows for " + fromIso + " to " + toIso + ".");
    if (!totalInst)  fatal.push("The installs export produced 0 rows for " + fromIso + " to " + toIso + ".");
    if (totalInst < curInst) {
      fatal.push("Installs would DROP from " + curInst + " to " + totalInst +
        ". Within a month installs only accumulate, so this export is partial — " +
        "almost always an Apple Numbers round-trip. Re-export from BI straight to Drive.");
    }
    if (curBi.leads && totalLeads < curBi.leads) {
      fatal.push("MTD leads would DROP from " + curBi.leads + " to " + totalLeads +
        ". Same cause — treat the export as truncated, not the month as shrinking.");
    }
  } else {
    log.push("Month rollover detected (" + (curBi.monthStart || "none") + " -> " + fromIso +
      ") — drop checks skipped.");
  }
  if (fatal.length) return growthAutoAbort_(fatal, log, commit);

  /* ---- build the per-day plan ---- */
  var DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var byLabel = {};
  raw.forEach(function (r, i) { byLabel[String(r[0]).trim()] = { row: i, vals: r }; });

  /* Row creation still gated on installs, same as before: a day only gets a
     row once an install has posted for it. Lead columns just ride along on
     that same row once it exists, instead of being left at 0. */
  var updates = [], appends = [], unchanged = 0;
  Object.keys(instBy).sort().forEach(function (iso) {
    if (iso < fromIso || iso > toIso) return;
    var p = iso.split("-");
    var label = DN[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + " " + (+p[1]) + "/" + (+p[2]);
    var I = instBy[iso];
    var L = leadsByApptDay[iso] || { mkt: 0, tech: 0, sg: 0 };
    var cur = byLabel[label];
    if (!cur) { appends.push({ label: label, iso: iso, I: I, L: L }); return; }
    var v = cur.vals;
    var instSame = (Number(v[4]) || 0) === I.mkt && (Number(v[5]) || 0) === I.tech && (Number(v[6]) || 0) === I.sg;
    var leadSame = (Number(v[1]) || 0) === L.mkt && (Number(v[2]) || 0) === L.tech && (Number(v[3]) || 0) === L.sg;
    if (instSame && leadSame) { unchanged++; return; }
    updates.push({
      label: label, row: cur.row,
      instFrom: [Number(v[4]) || 0, Number(v[5]) || 0, Number(v[6]) || 0], instTo: [I.mkt, I.tech, I.sg], instChanged: !instSame,
      leadFrom: [Number(v[1]) || 0, Number(v[2]) || 0, Number(v[3]) || 0], leadTo: [L.mkt, L.tech, L.sg], leadChanged: !leadSame
    });
  });

  log.push("");
  log.push("PLAN — install + lead columns");
  log.push("  unchanged: " + unchanged + "   update: " + updates.length + "   append: " + appends.length);
  updates.forEach(function (u) {
    if (u.instChanged) log.push("  update " + u.label + "  installs mkt/tech/sg " + u.instFrom.join("/") + " -> " + u.instTo.join("/"));
    if (u.leadChanged) log.push("  update " + u.label + "  leads    mkt/tech/sg " + u.leadFrom.join("/") + " -> " + u.leadTo.join("/") +
      "  (job status caught up since it was last written — this is expected, not a correction to override)");
  });
  appends.forEach(function (a) {
    log.push("  append " + a.label + "  installs " + a.I.mkt + "/" + a.I.tech + "/" + a.I.sg +
      "   leads " + a.L.mkt + "/" + a.L.tech + "/" + a.L.sg +
      "   *** sold count and installed $ still 0 — fill them in ***");
  });

  var biChanged = (curBi.leads !== totalLeads || curBi.mkt !== lt.mkt ||
                   curBi.tech !== lt.tech || curBi.sg !== lt.sg);
  log.push("");
  log.push("PLAN — MTD lead figures  (current source: " + curBi.source + ")");
  log.push("  leads " + curBi.leads + " -> " + totalLeads + ", mkt " + curBi.mkt + " -> " + lt.mkt +
    ", tech " + curBi.tech + " -> " + lt.tech + ", sg " + curBi.sg + " -> " + lt.sg +
    (biChanged ? "" : "   (no change)"));

  if (!commit) {
    log.push("");
    log.push("PREVIEW ONLY — nothing written. Run applyGrowthAutoAdvance() to commit.");
    var pv = log.join("\n"); Logger.log(pv);
    return { ok: true, committed: false, updates: updates.length, appends: appends.length,
             needsSoldAndDollars: appends.map(function (a) { return a.label; }),
             dataThroughIso: lastDay, report: pv };
  }

  /* ---- commit ---- */
  var sh = growthDaysSheet_(ss);
  if (!sh) return growthAutoAbort_(["No '" + GROWTH_DAILY_DATA_TAB +
    "' tab — run setupGrowthDailyDataSheet() first."], log, commit);

  updates.forEach(function (u) {
    if (u.instChanged) sh.getRange(u.row + 2, 5, 1, 3).setValues([u.instTo]);
    if (u.leadChanged) sh.getRange(u.row + 2, 2, 1, 3).setValues([u.leadTo]);
  });
  if (appends.length) {
    var startRow = sh.getLastRow() + 1;
    var rows = appends.map(function (a) {
      return [a.label, a.L.mkt, a.L.tech, a.L.sg, a.I.mkt, a.I.tech, a.I.sg, 0, 0];
    });
    sh.getRange(startRow, 1, rows.length, GROWTH_DAILY_DATA_HEADER.length).setValues(rows);
    sh.getRange(startRow, 9, rows.length, 1).setNumberFormat("$#,##0");
  }
  var wroteBi = growthWriteBiMtd_(ss, {
    leads: totalLeads, mkt: lt.mkt, tech: lt.tech, sg: lt.sg,
    installs: totalInst, instMkt: it.mkt, instTech: it.tech, instSg: it.sg,
    rentalInstalls: mtdRentalInst,  // Fix 6: rental installs within MTD date range
    monthStart: fromIso
  }, lastDay);
  GROWTH_DAYS_CACHE_ = null;

  log.push("");
  log.push("COMMITTED — " + updates.length + " day(s) updated, " + appends.length + " appended.");
  log.push(wroteBi === false
    ? "MTD figures NOT written: no '" + GROWTH_CONFIG_TAB + "' tab. Run setupGrowthConfigSheet(), then re-run."
    : "MTD figures written to '" + GROWTH_CONFIG_TAB + "': " + wroteBi + " cell(s) changed.");
  if (appends.length) {
    log.push("");
    log.push("STILL NEEDS YOU — sold count and installed $ on: " +
      appends.map(function (a) { return a.label; }).join(", "));
  }
  var rep = log.join("\n"); Logger.log(rep);
  return { ok: true, committed: true, updates: updates.length, appends: appends.length,
           needsSoldAndDollars: appends.map(function (a) { return a.label; }),
           biWritten: wroteBi, dataThroughIso: lastDay, report: rep };
}
function growthAutoAbort_(fatal, log, commit) {
  var body = log.concat(["", "ABORTED — nothing written:"])
    .concat(fatal.map(function (f) { return "  !! " + f; })).join("\n");
  Logger.log(body);
  return { ok: false, committed: false, errors: fatal, report: body };
}

/* Dry run. Shows exactly what would change and writes nothing. */
function previewGrowthAutoAdvance() { return growthAutoAdvance_(false).report; }

/* Commits it. */
function applyGrowthAutoAdvance() { return growthAutoAdvance_(true).report; }

/* ============================================================================
 * STAGE 2c — the Backlog Pipeline tab loads from Drive.
 *
 * That tab drives the "Awaiting Install" block, and it went ten days stale
 * once without anything noticing: stale in, stale out, no error. It is a
 * straight paste of a BI export, so a script can do it.
 *
 * The tab is REPLACED wholesale, so the guard runs first: the export has to
 * carry the two headers the consumer needs before anything is cleared.
 * ========================================================================== */

function importPipelineFromDrive_(commit) {
  var res = gaResolveUploads_(["pipeline"]);
  var log = [].concat(res.log);
  var f = res.found.pipeline;
  if (!f) return growthAutoAbort_(["No backlog/pipeline export found — nothing in the uploads " +
    "folder carries " + GROWTH_UPLOAD_SIGNATURES.pipeline.join(" / ") + "."], log, commit);

  var age = Math.floor((new Date().getTime() - f.updated.getTime()) / 86400000);
  log.push("pipeline: " + f.title + "  (" + age + "d old)");
  if (age > GROWTH_AUTO.staleAfterDays)
    return growthAutoAbort_(["Pipeline export is " + age + " days old — re-export."], log, commit);

  var values = f.values;

  /* The consumer looks for a row carrying both lastApptDate and Lead Type.
     No header, no write — a cleared tab is worse than a stale one. */
  var hr = -1;
  for (var i = 0; i < values.length && hr < 0; i++) {
    var low = values[i].map(function (x) { return String(x || "").trim().toLowerCase(); });
    var hasDate = low.some(function (h) { return h === "lastapptdate" || (h.indexOf("appt") > -1 && h.indexOf("date") > -1); });
    if (hasDate && low.indexOf("lead type") > -1) hr = i;
  }
  if (hr < 0) return growthAutoAbort_(["The pipeline export has no row containing both a " +
    "lastApptDate-style column and 'Lead Type'. The Awaiting Install block could not read it, " +
    "so the tab was left alone."], log, commit);

  var body = values.slice(hr).filter(function (r) {
    return r.some(function (c) { return String(c || "").trim(); });
  });
  var width = body.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  log.push("header row " + (hr + 1) + ", " + (body.length - 1) + " data row(s), " + width + " column(s)");
  if (body.length < 2) return growthAutoAbort_(["The pipeline export has a header but no data rows."], log, commit);

  if (!commit) {
    log.push("");
    log.push("PREVIEW ONLY — '" + PIPE_TAB + "' not touched. Run applyPipelineFromDrive() to commit.");
    var pv = log.join("\n"); Logger.log(pv);
    return { ok: true, committed: false, rows: body.length - 1, report: pv };
  }

  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = ss.getSheetByName(PIPE_TAB) || ss.insertSheet(PIPE_TAB);
  sh.clearContents();
  var grid = body.map(function (r) {
    var row = r.slice();
    while (row.length < width) row.push("");
    return row;
  });
  sh.getRange(1, 1, grid.length, width).setValues(grid);
  sh.getRange(1, 1, 1, width).setFontWeight("bold");

  log.push("");
  log.push("COMMITTED — '" + PIPE_TAB + "' replaced with " + (grid.length - 1) + " row(s) from " + f.title + ".");
  log.push("Run buildL2CTabPlus() to rebuild the Awaiting Install block from it.");
  var rep = log.join("\n"); Logger.log(rep);
  return { ok: true, committed: true, rows: grid.length - 1, report: rep };
}

function previewPipelineFromDrive() { return importPipelineFromDrive_(false).report; }
function applyPipelineFromDrive()   { return importPipelineFromDrive_(true).report; }

/* One button for the morning: pipeline tab, then day rows + MTD figures. */
function growthMorningRefresh() {
  var out = ["GROWTH MORNING REFRESH", "======================", ""];
  var p = importPipelineFromDrive_(true);
  out.push(p.report, "");
  if (!p.ok) {
    out.push("Stopped: the pipeline import failed, so the day rows were left alone.");
    var bad = out.join("\n"); Logger.log(bad); return bad;
  }
  var a = growthAutoAdvance_(true);
  out.push(a.report, "");
  out.push(a.ok ? "Next: run buildL2CTabPlus() (or let the 4am trigger do it)."
                : "Day rows were NOT advanced — see above.");
  var rep = out.join("\n"); Logger.log(rep);
  return rep;
}
/* ============================================================================
 * STAGE 2d — the unattended morning run.
 *
 * WHY THIS IS A WINDOW AND NOT A 5AM TRIGGER. The exports arrive whenever the
 * BI pull actually gets done: 06:39 on 8/17, 14:20 on 8/15. A fixed early
 * trigger would run before the files exist, find nothing new, and go back to
 * sleep until the next morning — leaving the huddle on yesterday's numbers
 * with nothing visibly broken. So this polls hourly across the window.
 *
 * IT IS CHEAP TO RUN OFTEN. Two gates come before any file is touched:
 *   1. outside the window -> return immediately
 *   2. already loaded through the operational date -> return immediately
 * so a normal day costs one real run and a handful of no-ops. Reading is only
 * attempted when there is plausibly something new.
 *
 * It rebuilds the Daily/L2C tabs ONLY when something actually changed —
 * loading input tabs does not repaint anything by itself, and the 4am
 * runGrowthDailyPipeline is long past by the time the files land.
 *
 * QUIET IS THE NORMAL OUTCOME. It emails on a real advance and on a failure,
 * never on a no-op. A silent morning means there was nothing new, which is
 * the same contract the Daily Uploads READ ME already sets.
 * ========================================================================== */

var GROWTH_AUTO_DONE_KEY = "growthAutoLoadedThroughIso";

function growthMorningAuto() {
  var tz = DAILY_RECAP_CONFIG.timeZone;
  var now = new Date();
  var hour = Number(Utilities.formatDate(now, tz, "H"));
  var props = PropertiesService.getScriptProperties();

  if (hour < GROWTH_AUTO.autoFromHour || hour > GROWTH_AUTO.autoToHour) {
    return { ok: true, skipped: true, reason: "outside the " + GROWTH_AUTO.autoFromHour +
      ":00-" + GROWTH_AUTO.autoToHour + ":00 window" };
  }

  /* BI posts a day late, so "current" means loaded through yesterday. The latch
     now stores the ACTUAL date the exports covered, not the target date. So an
     early poll that fires before today's export has landed (and therefore only
     carries data through the day before yesterday) does NOT mark the day done —
     later polls keep trying until a fresh file actually reaches yesterday. */
  var wantIso = growthDailyYesterdayIso_();
  var doneIso = props.getProperty(GROWTH_AUTO_DONE_KEY) || "";
  if (doneIso && doneIso >= wantIso) {
    return { ok: true, skipped: true, reason: "already loaded through " + doneIso };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: true, skipped: true, reason: "another run holds the lock" };

  try {
    var out = ["GROWTH MORNING AUTO — " + Utilities.formatDate(now, tz, "EEE M/d h:mm a"), ""];
    var pipe = importPipelineFromDrive_(true);
    out.push(pipe.report, "");
    if (!pipe.ok) {
      out.push("Stopped before touching the day rows.");
      return growthMorningNotify_(out, "PIPELINE IMPORT FAILED", true);
    }

    var adv = growthAutoAdvance_(true);
    out.push(adv.report, "");
    if (!adv.ok) return growthMorningNotify_(out, "DAY ROWS NOT ADVANCED", true);

    /* "Material" = a day row actually moved OR the export coverage advanced past
       what we last latched. A re-poll that only re-stamps the same MTD figures
       is NOT material — it exits quietly without repainting, emailing, or
       re-latching, so it never falsely marks the day done. */
    var reachedIso = adv.dataThroughIso || "";
    var coverageAdvanced = reachedIso && reachedIso > doneIso;
    var material = ((adv.updates || 0) + (adv.appends || 0)) > 0 || coverageAdvanced;
    if (!material) {
      Logger.log(out.join("\n") + "\nNo new coverage since " + (doneIso || "(never)") + " — quiet exit.");
      return { ok: true, skipped: false, changed: 0, reason: "nothing new since " + (doneIso || "(never)") };
    }

    /* Something moved, so repaint. Loading the input tabs does not do this. */
    try {
      buildL2CTabPlus();
      out.push("Rebuilt the Daily and L2C tabs.");
    } catch (e) {
      out.push("!! Data loaded but the rebuild failed: " + e);
      return growthMorningNotify_(out, "LOADED BUT REBUILD FAILED", true);
    }

    /* Latch the ACTUAL coverage date, never the target. Fall back to the prior
       latch if the advance reported no date, so we never move backward. */
    var latchIso = reachedIso || doneIso;
    if (latchIso) props.setProperty(GROWTH_AUTO_DONE_KEY, latchIso);

    if ((adv.needsSoldAndDollars || []).length) {
      out.push("");
      out.push("NEEDS YOU before the huddle — sold count and installed $ on: " +
        adv.needsSoldAndDollars.join(", "));
    }
    return growthMorningNotify_(out, "growth sheet advanced through " + (reachedIso || wantIso), false);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function growthMorningNotify_(lines, subjectTail, isProblem) {
  var body = lines.join("\n");
  Logger.log(body);
  try {
    MailApp.sendEmail({
      to: DAILY_RECAP_CONFIG.managerEmail,
      subject: (isProblem ? "!! Growth auto — " : "Growth auto — ") + subjectTail,
      body: body, name: DAILY_RECAP_CONFIG.fromName
    });
  } catch (e) { Logger.log("Email failed: " + e); }
  return { ok: !isProblem, changed: !isProblem, report: body };
}

/* Hourly, gated in the handler. One trigger rather than eight hourly ones —
   this project is already close to the per-script trigger ceiling. */
function installGrowthMorningTrigger() {
  var killed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "growthMorningAuto") { ScriptApp.deleteTrigger(t); killed++; }
  });
  ScriptApp.newTrigger("growthMorningAuto").timeBased().everyMinutes(GROWTH_AUTO.autoEveryMinutes).create();
  var msg = "Installed the growthMorningAuto trigger, every " + GROWTH_AUTO.autoEveryMinutes + " min" +
    (killed ? " (replaced " + killed + " existing)" : "") +
    ". It acts only between " + GROWTH_AUTO.autoFromHour + ":00 and " +
    GROWTH_AUTO.autoToHour + ":00 Pacific, and only until it has loaded through " +
    "the previous day. Quiet runs send nothing.";
  Logger.log(msg);
  return msg;
}

function removeGrowthMorningTrigger() {
  var killed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "growthMorningAuto") { ScriptApp.deleteTrigger(t); killed++; }
  });
  var msg = "Removed " + killed + " growthMorningAuto trigger(s).";
  Logger.log(msg); return msg;
}

/* Clears the once-a-day latch, so the next run re-reads even if it already
   loaded today. For when you re-upload a corrected export. */
function resetGrowthMorningLatch() {
  PropertiesService.getScriptProperties().deleteProperty(GROWTH_AUTO_DONE_KEY);
  var msg = "Latch cleared — the next in-window run will re-read the exports.";
  Logger.log(msg); return msg;
}
/* ================== END STAGE 2 ================== */

/* ============================================================================
 *  SKIP TONIGHT'S NUDGE - for people who are off
 *
 *  Paste this at the bottom of the HCA Daily Recap script, save, then run
 *  skipNudgeToday(). That is it. No deploy, no trigger changes.
 *
 *  How it works: the 7pm nudge already keeps a "who has been nudged today"
 *  list in Script Properties and skips anyone on it. This just writes a name
 *  onto that list early, so 7pm passes them over. It is keyed to today's
 *  date, so it clears itself overnight - you have to run it again for the
 *  next person on the next day.
 *
 *  To use it again later: change the name in EN_OFF_TODAY, save, run it.
 * ========================================================================== */

var EN_OFF_TODAY = ["Joseph Ruble"];

function skipNudgeToday() {
  var tz = "America/Los_Angeles";
  try { tz = DAILY_RECAP_CONFIG.timeZone || tz; } catch (e) {}
  var iso = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  /* Read the existing list first so anyone already nudged tonight stays on it. */
  var names = enAlreadyNudged_(iso);
  var added = [];

  EN_OFF_TODAY.forEach(function (n) {
    var key = enNorm_(n);
    if (names.indexOf(key) < 0) { names.push(key); added.push(n); }
  });

  enRememberNudged_(iso, names);

  Logger.log("Date            : " + iso);
  Logger.log("Newly suppressed: " + (added.length ? added.join(", ") : "(nobody new - already on the list)"));
  Logger.log("Skip list now   : " + names.join(", "));
  Logger.log("");
  Logger.log("Anyone NOT on that list who hasn't filed still gets nudged at 7pm.");
  return names;
}

/* Undo it, in case you set the wrong person. Clears the whole list for today,
 * which means everyone who hasn't filed is back in scope for the 7pm nudge. */
function clearNudgeSkipToday() {
  var tz = "America/Los_Angeles";
  try { tz = DAILY_RECAP_CONFIG.timeZone || tz; } catch (e) {}
  var iso = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  enRememberNudged_(iso, []);
  Logger.log("Skip list cleared for " + iso + ". Everyone unfiled is back in scope for 7pm.");
}
/* ============================================================================
 *  ADD THE TIME OFF ROWS - from the Paychex list, 8/14/2026
 *
 *  THIS IS CODE. It goes at the BOTTOM of the HCA Daily Recap script file,
 *  the same place the other blocks went. Do not paste it into the spreadsheet.
 *
 *  Paste -> Save -> pick addTimeOffRows from the dropdown -> Run.
 *
 *  It writes real Date objects, not text, so the pad2_ bug cannot bite.
 *  It skips any row that is already there, so running it twice is harmless.
 *  It touches nothing that is already in the sheet.
 *  It finishes by reading every date back through readExceptionsForDate_ -
 *  the exact function the 6am recap uses - so you see proof, not a promise.
 * ========================================================================== */

/* [year, month, day, roster name, type, notes] - month is 1-12, written plainly. */
var TIME_OFF_TO_ADD = [
  [2026, 8, 15, "Joseph Ruble",    "vacation", "PTO"],
  [2026, 8, 18, "Javierre Milo",   "vacation", "PTO"],
  [2026, 8, 19, "Javierre Milo",   "sick",     "Sick"],
  [2026, 8, 20, "Javierre Milo",   "sick",     "Sick"],
  [2026, 8, 21, "Kyle McAlister",  "vacation", "PTO"],
  [2026, 8, 22, "Adam Weberg",     "vacation", "PTO"],
  [2026, 8, 22, "Joe Chounramany", "vacation", "PTO"],
  [2026, 8, 22, "Kyle McAlister",  "vacation", "PTO"],
  [2026, 9,  5, "Javierre Milo",   "vacation", "PTO"],
  [2026, 9,  8, "Javierre Milo",   "vacation", "PTO"]
];

function addTimeOffRows() {
  var cfg = DAILY_RECAP_CONFIG;
  var ss = SpreadsheetApp.openById(cfg.exceptionsSpreadsheetId);
  var sh = cfg.exceptionsSheetName ? ss.getSheetByName(cfg.exceptionsSheetName) : ss.getSheets()[0];
  if (!sh) { Logger.log("Could not open the exceptions sheet."); return; }

  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
  var cDate = indexOfHeader_(header, ["date"]);
  var cName = indexOfHeader_(header, ["hca name", "hca", "name"]);
  var cType = indexOfHeader_(header, ["type"]);
  var cNote = indexOfHeader_(header, ["notes", "note"]);
  if (cDate === -1 || cName === -1 || cType === -1) {
    Logger.log("Unexpected headers: " + header.join(", "));
    return;
  }

  /* Build a set of what is already there so this is safe to run twice. */
  var have = {};
  for (var i = 1; i < values.length; i++) {
    var iso = normalizeSheetDate_(values[i][cDate]);
    var who = String(values[i][cName] || "").trim().toLowerCase();
    if (iso && who) have[iso + "|" + who] = true;
  }

  var added = 0, skippedDup = 0, dates = {};
  TIME_OFF_TO_ADD.forEach(function (r) {
    var y = r[0], m = r[1], d = r[2], name = r[3], type = r[4], note = r[5];
    var iso = y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
    dates[iso] = true;

    if (have[iso + "|" + name.toLowerCase()]) { skippedDup++; return; }

    var row = new Array(sh.getLastColumn() || 4).fill("");
    row[cDate] = new Date(y, m - 1, d);   /* a real Date, never a string */
    row[cName] = name;
    row[cType] = type;
    if (cNote !== -1) row[cNote] = note;

    sh.appendRow(row);
    have[iso + "|" + name.toLowerCase()] = true;
    added++;
  });

  /* Make the new date cells display like the rest of the column. */
  if (added > 0) {
    sh.getRange(2, cDate + 1, sh.getLastRow() - 1, 1).setNumberFormat("M/d/yyyy");
  }

  Logger.log("rows added   : " + added);
  Logger.log("already there: " + skippedDup);
  Logger.log("");
  Logger.log("--- read back through the same function the 6am recap uses ---");

  Object.keys(dates).sort().forEach(function (iso) {
    var res = readExceptionsForDate_(iso);
    var who = Object.keys(res.byName || {}).map(function (k) {
      return k + " (" + res.byName[k].type + ")";
    }).join(", ");
    Logger.log(iso + "   rows=" + res.count + "   " + (who || "*** NOBODY - SOMETHING IS WRONG ***"));
  });

  Logger.log("");
  Logger.log("Every line above should show at least rows=1 with a name.");
  Logger.log("A rows=0 line means that date landed as text instead of a date - tell Claude.");
}

/* ============================================================================
 * GROWTH DAILY PIPELINE — SAFE COORDINATOR
 *
 * Growth tabs only. This module does not read or write Firebase, Install
 * Availability, Install Check, the 1:1 Scheduler, recap forms, or Job Status.
 * ========================================================================== */

var GROWTH_DAILY_OVERRIDES_TAB = "Daily Overrides";
var GROWTH_DAILY_OVERRIDES_HEADERS = ["Date", "Consults Run", "Source / Note"];

function growthDailyYesterdayIso_() {
  var tz = (DAILY_RECAP_CONFIG && DAILY_RECAP_CONFIG.timeZone) || "America/Los_Angeles";
  return Utilities.formatDate(new Date(Date.now() - 86400000), tz, "yyyy-MM-dd");
}

function growthDailyIso_(value, tz) {
  if (value === null || value === undefined || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return isNaN(value.getTime()) ? "" : Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }
  var text = String(value).trim();
  var m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    var year = m[3].length === 2 ? "20" + m[3] : m[3];
    return year + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
  }
  return "";
}

function growthDailyFindSheet_(ss, wanted) {
  var target = String(wanted || "").toLowerCase().trim();
  var found = null;
  ss.getSheets().some(function (sheet) {
    if (String(sheet.getName()).toLowerCase().trim() === target) {
      found = sheet;
      return true;
    }
    return false;
  });
  return found;
}

function growthDailyEnsureOverrides_(ss) {
  var sh = ss.getSheetByName(GROWTH_DAILY_OVERRIDES_TAB);
  if (!sh) {
    sh = ss.insertSheet(GROWTH_DAILY_OVERRIDES_TAB);
    sh.getRange(1, 1, 1, GROWTH_DAILY_OVERRIDES_HEADERS.length)
      .setValues([GROWTH_DAILY_OVERRIDES_HEADERS])
      .setFontWeight("bold")
      .setBackground("#0f172a")
      .setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 110);
    sh.setColumnWidth(2, 110);
    sh.setColumnWidth(3, 420);
    sh.getRange("A1").setNote(
      "One row per operational date. Date may be a Sheet date or YYYY-MM-DD. " +
      "Consults Run excludes revisits, service work, cancellations, and no-runs."
    );
  }
  return sh;
}

function growthDailyReadOverride_(ss, iso, createIfMissing) {
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var sh = ss.getSheetByName(GROWTH_DAILY_OVERRIDES_TAB);
  if (!sh && createIfMissing) sh = growthDailyEnsureOverrides_(ss);
  if (!sh || sh.getLastRow() < 2) return { found: false, iso: iso };

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  var matches = [];
  values.forEach(function (row, index) {
    if (growthDailyIso_(row[0], tz) !== iso) return;
    matches.push({ row: index + 2, count: row[1], note: String(row[2] || "").trim() });
  });
  if (matches.length > 1) {
    throw new Error("Daily Overrides has more than one row for " + iso +
      " (rows " + matches.map(function (x) { return x.row; }).join(", ") + "). Keep one auditable answer.");
  }
  if (!matches.length) return { found: false, iso: iso };

  var rawCount = matches[0].count;
  var n = Number(rawCount);
  if (rawCount === "" || rawCount === null || rawCount === undefined ||
      !isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new Error("Daily Overrides row " + matches[0].row +
      " needs a whole-number Consults Run value (zero is allowed).");
  }
  return {
    found: true,
    iso: iso,
    count: n,
    note: matches[0].note,
    row: matches[0].row
  };
}

function growthDailyLatestStageIso_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return "";
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var headerRow = -1, dateCol = -1, typeCol = -1;
  for (var r = 0; r < grid.length && headerRow < 0; r++) {
    var header = grid[r].map(function (x) { return String(x || "").trim().toLowerCase(); });
    dateCol = header.indexOf("est");
    typeCol = header.indexOf("lead type");
    if (dateCol > -1 && typeCol > -1) headerRow = r;
  }
  if (headerRow < 0) return "";

  var latest = "";
  for (var i = headerRow + 1; i < grid.length; i++) {
    var leadType = String(grid[i][typeCol] || "").trim().toLowerCase();
    var validType = leadType === "inbound" || leadType === "webform" ||
      leadType === "tech lead" || leadType === "tech flip" || leadType.indexOf("self") === 0;
    if (!validType) continue;
    var iso = growthDailyIso_(grid[i][dateCol], tz);
    if (iso && (!latest || iso > latest)) latest = iso;
  }
  return latest;
}

function growthDailyRenderedBiThroughIso_(operationalIso) {
  var gd = readGrowthDays_();
  if (!gd.length) return "";
  var label = String(gd[gd.length - 1][0] || "");
  var m = label.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  var year = Number(String(operationalIso).slice(0, 4));
  var iso = year + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
  /* A December dataset viewed on a January operational day belongs to the
     prior year, never to a future reporting period. */
  if (iso > operationalIso) {
    year--;
    iso = year + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
  }
  return iso;
}

function growthDailyBiStatus_(ss, operationalIso) {
  var stagedLeadsIso = growthDailyLatestStageIso_(ss, "All Leads");
  var stagedInstallsIso = growthDailyLatestStageIso_(ss, "All Installs");
  var stagedThrough = stagedLeadsIso && stagedInstallsIso ?
    (stagedLeadsIso < stagedInstallsIso ? stagedLeadsIso : stagedInstallsIso) :
    (stagedLeadsIso || stagedInstallsIso);
  /* The displayed numbers still come from L2C_DAYS + BI_MTD_* constants.
     Staging tabs are availability only until importBI_ is run and verified;
     their newer dates must not make the rendered 92/38 appear current. */
  var through = growthDailyRenderedBiThroughIso_(operationalIso);
  return {
    renderedThroughIso: through,
    throughIso: through,
    stale: !through || through < operationalIso,
    stagedLeadsIso: stagedLeadsIso,
    stagedInstallsIso: stagedInstallsIso,
    stagedThroughIso: stagedThrough,
    stagingAhead: !!(stagedThrough && (!through || stagedThrough > through))
  };
}

function growthDailyPrettyIso_(iso, tz) {
  if (!iso) return "unavailable";
  var p = iso.split("-");
  return Utilities.formatDate(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12), tz, "EEE M/d");
}

function growthDailyRowByLabel_(sheet, labelPrefix) {
  var grid = sheet.getRange(1, 1, sheet.getLastRow(), Math.min(2, sheet.getLastColumn())).getValues();
  var wanted = String(labelPrefix).toLowerCase();
  for (var r = 0; r < grid.length; r++) {
    if (String(grid[r][1] || "").trim().toLowerCase().indexOf(wanted) === 0) return r + 1;
  }
  return -1;
}

function growthDailyApplyPresentation_(ss, operationalIso) {
  var tz = ss.getSpreadsheetTimeZone() || "America/Los_Angeles";
  var daily = growthDailyFindSheet_(ss, "Daily");
  var l2c = growthDailyFindSheet_(ss, "L2C");
  if (!daily) throw new Error('No "Daily" tab found after rebuilding Growth.');

  var override = growthDailyReadOverride_(ss, operationalIso, false);
  if (!override.found) {
    throw new Error("No Daily Overrides row for " + operationalIso +
      ". Growth presentation was not advanced; add the reviewed consult count and run again.");
  }
  var bi = growthDailyBiStatus_(ss, operationalIso);
  var operationalLabel = growthDailyPrettyIso_(operationalIso, tz);
  var biLabel = growthDailyPrettyIso_(bi.throughIso, tz);
  var stagedDetail = bi.stagedThroughIso ?
    (" · staging available through " + growthDailyPrettyIso_(bi.stagedThroughIso, tz) +
      " (Leads " + growthDailyPrettyIso_(bi.stagedLeadsIso, tz) +
      " · Installs " + growthDailyPrettyIso_(bi.stagedInstallsIso, tz) + ") — NOT IMPORTED") :
    " · no staging data detected";
  var detail = "Displayed BI metrics through " + biLabel +
    " (rendered L2C dataset)" + (bi.stale ? " — STALE vs operational day" : "") +
    stagedDetail;

  daily.getRange("B1").setValue("CM Sales Growth — operational day " + operationalLabel);
  daily.getRange("C3").setValue(new Date(
    Number(operationalIso.slice(0, 4)), Number(operationalIso.slice(5, 7)) - 1,
    Number(operationalIso.slice(8, 10)), 12
  )).setNumberFormat("ddd m/d");
  daily.getRange("D3").setValue("MTD (BI thru " + biLabel + ")");

  var leadsRow = growthDailyRowByLabel_(daily, "total leads");
  if (leadsRow < 0) throw new Error('Could not find the "Total Leads" row on Daily.');
  var leadsCell = daily.getRange(leadsRow, 3);
  leadsCell.setValue(override.count).setNote(
    "Actual consults run for " + operationalLabel + " from Daily Overrides row " +
    override.row + ". " + (override.note || "Source / Note was left blank.")
  );

  daily.getRange(daily.getLastRow() + 1, 2).setValue(detail)
    .setFontWeight("bold")
    .setFontColor(bi.stale ? "#b91c1c" : "#0a7d33");
  if (l2c) {
    l2c.getRange("A1").setValue("Lead-2-Cash — reconciled BI through " + biLabel)
      .setFontWeight("bold").setFontSize(14);
    l2c.getRange("A2").setValue(
      "Cash = completed installs · L2C = installs ÷ BI leads · " + detail +
      " · live sold is tracked separately on Same-Day Sold."
    ).setFontColor(bi.stale ? "#b91c1c" : "#64748b");
  }
  return { override: override, bi: bi, detail: detail };
}

function previewGrowthDailyPipeline() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var operationalIso = growthDailyYesterdayIso_();
  var override = growthDailyReadOverride_(ss, operationalIso, false);
  var bi = growthDailyBiStatus_(ss, operationalIso);
  var sold = sameDaySoldMonthData_();
  var soldMtd = 0, soldDollars = 0;
  if (sold && sold.ok) {
    Object.keys(sold.days || {}).forEach(function (iso) {
      soldMtd += sold.days[iso].total || 0;
      soldDollars += sold.days[iso].dollars || 0;
    });
  }
  var result = {
    preview: true,
    writes: false,
    pending: !override.found,
    operationalIso: operationalIso,
    override: override,
    bi: bi,
    soldReadOk: !!(sold && sold.ok),
    soldReadComplete: !!(sold && sold.ok && sold.complete !== false),
    soldMtd: soldMtd,
    soldDollarsMtd: soldDollars,
    includedSoldMtd: soldMtd,
    includedSoldDollarsMtd: soldDollars,
    excludedSoldMtd: sold && sold.excluded ? sold.excluded.count : 0,
    excludedSoldDollarsMtd: sold && sold.excluded ? sold.excluded.dollars : 0,
    growthRequoteAudit: sold && sold.dedupe ? sold.dedupe : {},
    unmatchedSalesClassifiedFollowUp: sold ? (sold.unmatchedFollowUp || 0) : 0,
    growthSoldDefinition: "amount > $" + GROWTH_HVAC_SOLD_MIN_DOLLARS +
      " and seller in RECAP_ROSTER plus Lyle Jones, Aaron Johnson, Geoff/Geoffrey Simons",
    plannedOrder: override.found ? [
        "refreshSameDaySoldTab",
        "buildL2CTabPlus",
        "wireDailySold",
        "writeTitanRanEstimate",
        "apply Daily Overrides and BI-through labels"
      ] : ["pending review — no Growth writes until yesterday has a Daily Overrides row"]
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function setupGrowthDailyOverridesSheet() {
  var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
  var sh = growthDailyEnsureOverrides_(ss);
  var msg = 'Ready: "' + sh.getName() + '". Add one row per day: Date, Consults Run, Source / Note.';
  Logger.log(msg);
  return msg;
}

function runGrowthDailyPipeline() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    var skipped = { ok: true, skipped: true, reason: "another Growth pipeline run holds ScriptLock" };
    Logger.log(JSON.stringify(skipped));
    return skipped;
  }

  try {
    var operationalIso = growthDailyYesterdayIso_();
    var preflightSs = SpreadsheetApp.openById(GROWTH_SHEET_ID);
    var preflightOverride = growthDailyReadOverride_(preflightSs, operationalIso, false);
    if (!preflightOverride.found) {
      var pending = {
        ok: true,
        pending: true,
        skipped: true,
        operationalIso: operationalIso,
        reason: "Daily Overrides review is missing; all prior Growth tabs were preserved"
      };
      Logger.log(JSON.stringify(pending, null, 2));
      return pending;
    }
    var sameDay = refreshSameDaySoldTab();
    if (String(sameDay).indexOf("Same-Day Sold tab updated") !== 0) {
      throw new Error("Same-Day Sold was not refreshed: " + sameDay + ". Previous good data was preserved.");
    }
    var rebuilt = buildL2CTabPlus();
    var wired = wireDailySold();
    var installs = writeTitanRanEstimate();
    var ss = SpreadsheetApp.openById(GROWTH_SHEET_ID);
    var presentation = growthDailyApplyPresentation_(ss, operationalIso);
    SpreadsheetApp.flush();

    var result = {
      ok: true,
      skipped: false,
      operationalIso: operationalIso,
      sameDaySold: sameDay,
      rebuilt: rebuilt,
      dailySold: wired,
      installEstimate: installs,
      overrideFound: presentation.override.found,
      biThroughIso: presentation.bi.throughIso,
      biStale: presentation.bi.stale
    };
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function installGrowthDailyPipelineTrigger() {
  var growthHandlers = {
    writeGrowthDays: true,
    writeGrowthSheetForYesterday: true,
    refreshTodayGrowth: true,
    refreshDailyGrowth: true,
    buildL2CTab: true,
    buildL2CTabPlus: true,
    refreshSameDaySoldTab: true,
    wireDailySold: true,
    writeTitanRanEstimate: true,
    runGrowthDailyPipeline: true
  };
  var removed = [];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var fn = trigger.getHandlerFunction();
    if (!growthHandlers[fn]) return;
    ScriptApp.deleteTrigger(trigger);
    removed.push(fn);
  });

  var cfg = DAILY_RECAP_CONFIG || {};
  var hour = isFinite(Number(cfg.growthWriteHour)) ? Number(cfg.growthWriteHour) : 7;
  var tz = cfg.timeZone || "America/Los_Angeles";
  ScriptApp.newTrigger("runGrowthDailyPipeline")
    .timeBased().everyDays(1).atHour(hour).inTimezone(tz).create();

  var msg = "Installed one daily Growth trigger: runGrowthDailyPipeline at " +
    hour + ":00 " + tz + ". Removed Growth-only trigger(s): " +
    (removed.length ? removed.join(", ") : "none") +
    ". Recap, reply, form, Job Status, 1:1, Install Check, and Firebase triggers were not touched.";
  Logger.log(msg);
  return msg;
}


function removeGrowthDailyPipelineTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() !== "runGrowthDailyPipeline") return;
    ScriptApp.deleteTrigger(trigger);
    removed++;
  });
  var msg = "Removed " + removed + " runGrowthDailyPipeline trigger(s). No other trigger was touched.";
  Logger.log(msg);
  return msg;
}

/* ============================================================================
 * STRANDED SOLD JOBS — the gap between "sold" and "on the board"
 *
 * A sold project reaches the install crews through a chain of hand-offs:
 *   Sold Estimate Alert -> HCA adds it to the Install Availability page ->
 *   the install coordinator moves it to a team -> COMBO LOG -> dispatch board.
 *
 * The HCA step is the one a human can simply forget. When they do, the job is
 * sold, invoiced against nobody's schedule, and invisible: it never reaches the
 * COMBO LOG, so it never reaches the board, so no report that reads the board
 * can see that it is missing. It surfaces when the customer calls to ask when
 * their furnace is going in.
 *
 * This check finds those by set difference: qualifying Growth sales that have
 * no COMBO LOG row. It reads only — no writes, no email — so it is safe to run
 * at any time.
 *
 * WHY NOT READ THE AVAILABILITY PAGE DIRECTLY: it would separate "the HCA never
 * added it" from "the coordinator has not assigned it yet". Both are stranded
 * and both need the same nudge, so the COMBO LOG is a sufficient oracle for
 * v1. growthStrandedSoldJobs_ returns the matched rows, so an availability
 * reader can be layered on later to split the two causes without reworking it.
 * ========================================================================== */

var GROWTH_STRANDED_CONFIG = {
  /* Sales newer than this are not flagged. A job sold Friday afternoon has not
     had a business day to be entered, and flagging it trains people to ignore
     the report. */
  graceDays: 3,
  /* How far back to look. Bounded because the COMBO LOG is reorganised by hand
     and old jobs move to COMPLETED tabs or age out; beyond this window an
     absent row stops being evidence of anything. */
  lookbackDays: 45
};

/* Name tokens for matching a Sold Estimate Alert customer against a COMBO LOG
   row. Alerts carry the billing name in full — "James Combel and Mary Shil" —
   while the log keeps FIRST and LAST, so neither string is a subset of the
   other and a plain equality test finds nothing. Joining words are dropped so
   they cannot manufacture an overlap. */
var GROWTH_STRANDED_STOPWORDS = { "and": 1, "the": 1, "or": 1, "of": 1, "jr": 1, "sr": 1, "mr": 1, "mrs": 1, "ms": 1 };

function growthStrandedTokens_(value) {
  return normName_(value).split(" ").filter(function (t) {
    /* Pure digits are ServiceTitan ids riding along on the name — "Laura
       Richmond 0011389" — never a name token, and they would otherwise take
       the surname position the single-token rule below depends on. */
    if (!t || t.length < 2 || /^\d+$/.test(t)) return false;
    return !GROWTH_STRANDED_STOPWORDS[t];
  });
}

/* Two names refer to the same customer when they share two distinct tokens —
   normally first + surname. A single shared token is not enough: "Mary" and
   "Smith" each collide across unrelated households, and a false match here is
   worse than a false miss, because it silently clears a genuinely stranded job.
   A one-token COMBO LOG name — the log does carry rows with FIRST or LAST
   blank — clears a job only when that token sits in the alert's SURNAME
   position. Length alone is not enough: "Donald Searles" against a log row
   reading just "Donald" would pass a 5-character test and silently mark a
   genuinely stranded job as scheduled, which is the exact failure this whole
   check exists to catch. Given the choice, miss forward: a false non-match
   costs a glance at the report, a false match costs a forgotten install. */
/* Trailing ServiceTitan customer id — "Laura Reynolds 0011389". It SURVIVES a
   customer rename; the name does not. Laura Richmond 0011389 in the 8/13 sold
   alert and the 8/15 backlog is Laura Reynolds 0011389 in the 8/17 exports —
   same customer, renamed in between, and the alert email keeps the old spelling
   forever. Name tokens share only "laura" across that pair, so a name-only
   matcher silently reports a false stranded job. The id is checked FIRST and is
   authoritative in both directions: same id matches whatever the names say,
   different ids never match. Only when at least one side has no id do we fall
   back to the token rules below. */
function growthStrandedCustomerId_(value) {
  var m = String(value || "").match(/\b(\d{5,})\b\s*$/);
  return m ? m[1] : "";
}

function growthStrandedNameMatch_(alertName, comboName) {
  var idA = growthStrandedCustomerId_(alertName);
  var idB = growthStrandedCustomerId_(comboName);
  if (idA && idB) return idA === idB;

  var a = growthStrandedTokens_(alertName);
  var b = growthStrandedTokens_(comboName);
  if (!a.length || !b.length) return false;
  var shared = b.filter(function (t) { return a.indexOf(t) !== -1; });
  if (shared.length >= 2) return true;
  if (b.length !== 1 || shared.length !== 1 || b[0].length < 5) return false;
  return b[0] === a[a.length - 1];
}

function growthStrandedIsoDaysAgo_(days, tz) {
  return Utilities.formatDate(new Date(new Date().getTime() - days * 86400000),
                              tz, "yyyy-MM-dd");
}

/* The report. Returns data; prints nothing and sends nothing. */
function growthStrandedSoldJobs_(opts) {
  opts = opts || {};
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }

  var graceDays = (opts.graceDays === undefined) ? GROWTH_STRANDED_CONFIG.graceDays : opts.graceDays;
  var lookbackDays = (opts.lookbackDays === undefined) ? GROWTH_STRANDED_CONFIG.lookbackDays : opts.lookbackDays;
  var newestIso = growthStrandedIsoDaysAgo_(graceDays, tz);
  var oldestIso = growthStrandedIsoDaysAgo_(lookbackDays, tz);

  var res = readSoldAlerts_(lookbackDays + 5);
  if (!res.ok) {
    return { ok: false, error: "sold alerts unreadable", stranded: [], tz: tz };
  }

  /* Collapse re-quotes first. Without this a job re-papered three times looks
     like three stranded sales, and the COMBO LOG only ever holds one row. */
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);
  var inWindow = collapse.alerts.filter(function (a) {
    return a.soldOnIso && a.soldOnIso >= oldestIso && a.soldOnIso <= newestIso;
  });

  /* Same qualification the Growth headline uses, so this report can never
     disagree with the sold count about what a Growth project is. */
  var qualifying = inWindow.filter(function (a) {
    if (!growthSoldQualification_(a).included) return false;
    if (typeof stExcluded_ !== "function") return true;
    return !(a.growthRevisionMembers || [a]).some(function (m) { return stExcluded_(m); });
  });

  var combo = readComboInstalls_();
  if (!combo.ok) {
    return { ok: false, error: "COMBO LOG unreachable", stranded: [], tz: tz };
  }

  var stranded = [], scheduled = [], undated = [], cancelled = [];
  /* Two sold alerts against one COMBO LOG row means one of the two never made
     it, even though the customer "is on the board". VOA is the opposite case —
     two sales, two rows, both fine — so a bare name match cannot tell them
     apart and the counts have to be compared. */
  var soldPerCustomer = {}, rowsPerCustomer = {}, saleByCustomer = {};
  /* Third opinion. COMBO LOG rows say what was scheduled; Completed Form Alerts
     say what was actually installed, each carrying its own ServiceTitan job
     number. Distinct numbers = distinct jobs, which settles a duplicate the way
     an address would if addresses were reliably recorded (they appear in JOB
     NOTES on 3 rows out of 227). */
  var completions = { ok: false, completions: [] };
  try { completions = readInstallCompletions_(lookbackDays + 30); }
  catch (e) { Logger.log("completion alerts unavailable: " + e); }

  qualifying.forEach(function (a) {
    var custKey = growthStrandedTokens_(a.customer).join(" ");
    /* A cancelled sale is off the board on purpose. Missing this is what makes
       a job read SOLD forever. */
    /* Cancellations span trades — the tab carries SALES, HVAC, PLUMBING and
       PLUMB rows. An explicitly plumbing or electrical cancellation must not
       clear a stranded HVAC sale for the same household; a blank department is
       treated as possibly-ours and still counts, which errs toward silence
       rather than toward a false "forgotten job" accusation. */
    var cancel = combo.cancellations.filter(function (c) {
      var dep = String(c.department || "").trim().toUpperCase();
      if (dep.indexOf("PLUM") === 0 || dep.indexOf("ELEC") === 0) return false;
      return growthStrandedNameMatch_(a.customer, c.customer);
    })[0];
    if (cancel) {
      cancelled.push({ sale: a, cancelledOn: cancel.cancelledOn, reason: cancel.reason });
      return;
    }

    /* Match across ALL trades. An HCA who sells a water heater or an electrical
       panel books a Growth sale — it qualifies on amount and seller by design —
       and that job lands on a PLUM or ELECT row in the COMBO LOG. Narrowing to
       HVAC here reported Volunteers of America's two E HWT water heaters as two
       stranded jobs when both were installed 7/23. The question this check asks
       is "did the sale reach the board", and any trade's row answers yes.
       (growthComboRowIsHvacInstall_ still guards the PERMIT report, where the
       question is about HVAC equipment timelines and the trade does matter.) */
    var rows = combo.installs.filter(function (row) {
      return growthStrandedNameMatch_(a.customer, row.customer);
    });
    soldPerCustomer[custKey] = (soldPerCustomer[custKey] || 0) + 1;
    rowsPerCustomer[custKey] = rows.length;
    saleByCustomer[custKey] = a;

    if (!rows.length) {
      stranded.push({
        customer: a.customer, hca: a.hca, amount: a.amount, soldOnIso: a.soldOnIso,
        jobNumber: a.jobNumber, estimateNumber: a.estimateNumber,
        opportunityNumber: a.opportunityNumber,
        ageDays: Math.round((new Date().getTime() - new Date(a.soldOnIso + "T12:00:00").getTime()) / 86400000),
        state: "NOT ON THE BOARD"
      });
      return;
    }
    if (rows.every(function (r) { return r.isCompleted || r.isDone; })) { scheduled.push(a); return; }

    /* Dated and open is the healthy end state. A row that exists but carries no
       date is a milder problem than absence — somebody knows about it — and on
       the TBD tab the JOB COMPLETED column is repurposed as a live action note,
       which is the most current word on the job anywhere, so carry it through. */
    var open = rows.filter(function (r) { return !r.isCompleted && !r.isDone; });
    if (open.length && open.every(function (r) { return r.isTbd; })) {
      undated.push({
        customer: a.customer, hca: a.hca, amount: a.amount, soldOnIso: a.soldOnIso,
        note: open.map(function (r) { return r.jobCompleted || r.jobNotes || ""; })
                 .filter(Boolean).join(" · "),
        sourceSheet: open.map(function (r) { return r.sourceSheet; }).join(", "),
        state: "ON THE BOARD, NO DATE"
      });
      return;
    }
    scheduled.push(a);
  });

  stranded.sort(function (x, y) { return y.ageDays - x.ageDays; });
  undated.sort(function (x, y) { return String(x.soldOnIso).localeCompare(String(y.soldOnIso)); });

  return {
    ok: true,
    complete: res.complete,
    tz: tz,
    windowFrom: oldestIso,
    windowTo: newestIso,
    graceDays: graceDays,
    qualifyingSales: qualifying.length,
    stranded: stranded,
    undated: undated,
    scheduledCount: scheduled.length,
    cancelledCount: cancelled.length,
    shortfall: Object.keys(soldPerCustomer).filter(function (k) {
      return rowsPerCustomer[k] > 0 && soldPerCustomer[k] > rowsPerCustomer[k];
    }).map(function (k) {
      var cust = saleByCustomer[k].customer;
      var jobs = {};
      (completions.completions || []).forEach(function (c) {
        if (c.jobNumber && growthStrandedNameMatch_(cust, c.customer)) jobs[c.jobNumber] = true;
      });
      return { customer: cust, hca: saleByCustomer[k].hca,
               sales: soldPerCustomer[k], rows: rowsPerCustomer[k],
               installedJobs: Object.keys(jobs).length,
               jobNumbers: Object.keys(jobs).join(", ") };
    }),
    comboRows: combo.installs.length
  };
}

/* Read-only preview. Run this from the editor; it writes nothing and emails
   nobody. */
function previewStrandedSoldJobs() {
  var r = growthStrandedSoldJobs_();
  if (!r.ok) { Logger.log("stranded check FAILED: " + r.error); return r; }

  var money = function (n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); };
  var out = [];
  out.push("STRANDED SOLD JOBS — sold but not on the board");
  out.push("================================================");
  out.push("Window   : " + r.windowFrom + " .. " + r.windowTo +
           "  (" + r.graceDays + "-day grace on new sales)");
  out.push("Qualifying Growth sales in window: " + r.qualifyingSales +
           "   COMBO LOG rows read: " + r.comboRows);
  out.push("Scheduled: " + r.scheduledCount + "   Cancelled: " + r.cancelledCount +
           "   Count shortfalls: " + r.shortfall.length);
  if (!r.complete) {
    out.push("!! PARTIAL sold-alert read — the Gmail ceiling was hit, so this");
    out.push("!! report can only be missing stranded jobs, never inventing them.");
  }
  out.push("");

  if (!r.stranded.length) {
    out.push("NOT ON THE BOARD: none. Every qualifying sale reached the COMBO LOG.");
  } else {
    out.push("NOT ON THE BOARD (" + r.stranded.length + ") — oldest first:");
    r.stranded.forEach(function (s) {
      out.push("  " + s.ageDays + "d  " + s.soldOnIso + "  " + money(s.amount) +
               "  " + s.customer + "  (" + s.hca + ")" +
               (s.jobNumber ? "  job " + s.jobNumber : "") +
               (s.opportunityNumber ? "  opp " + s.opportunityNumber : ""));
    });
  }
  out.push("");

  if (!r.undated.length) {
    out.push("ON THE BOARD, NO DATE: none.");
  } else {
    out.push("ON THE BOARD, NO DATE (" + r.undated.length + ") — known but unscheduled:");
    r.undated.forEach(function (s) {
      out.push("  " + s.soldOnIso + "  " + money(s.amount) + "  " + s.customer +
               "  (" + s.hca + ")  [" + s.sourceSheet + "]" +
               (s.note ? "  — " + s.note : ""));
    });
  }
  out.push("");
  if (r.shortfall.length) {
    out.push("MORE SALES THAN JOBS (" + r.shortfall.length + ") — the customer is on the");
    out.push("board, but with fewer COMBO LOG rows than qualifying sales, so at");
    out.push("least one sale has no job behind it:");
    r.shortfall.forEach(function (e) {
      out.push("  " + e.sales + " sales vs " + e.rows + " job row(s)" +
               (e.installedJobs ? " vs " + e.installedJobs + " installed job(s)" : "") +
               "  " + e.customer + "  (" + e.hca + ")" +
               (e.jobNumbers ? "  ST#" + e.jobNumbers : ""));
    });
    out.push("");
  }
  out.push("Name matching needs two shared tokens, so a stranded job can hide");
  out.push("behind a misspelling in the COMBO LOG. Spot-check anything you know");
  out.push("was sold and does not appear in either list above.");

  var msg = out.join("\n");
  Logger.log(msg);
  return r;
}

/* ============================================================================
 * PERMIT PIPELINE — sold jobs held up, and whether they are actually late
 *
 * "Late" is meaningless without the jurisdiction. Everett turns a residential
 * mechanical permit in 5 business days but takes 4-6 WEEKS on a commercial-zoned
 * property; Seattle is 1 week residential and 6 weeks commercial/multi-family;
 * City of Snohomish is 7 business days for an equipment swap and 6 weeks for an
 * add or relocate. A single global threshold would either bury the real stalls
 * or cry wolf on every permit-heavy city, so every age here is measured against
 * that jurisdiction's own published timeline.
 *
 * This is a DIFFERENT question from growthStrandedSoldJobs_. That one asks "did
 * this sale ever reach the board at all" and works from sold alerts. This one
 * walks the COMBO LOG itself, so it still sees a job sold months ago that has
 * been sitting in permitting since — which a sold-alert lookback would miss.
 * ========================================================================== */

var JURISDICTIONS_SHEET_ID = "1tLdBQ_G8PVbf20w88QGQV-evTgj9Xx1Fg2x-KyMyAnI";

var PERMIT_PIPELINE_CONFIG = {
  /* Slack on top of the jurisdiction's own timeline before calling it late.
     Published timelines are best cases and a few days of drift is normal. */
  graceDays: 5,
  /* Used only when the jurisdiction is known but its timeline cell is
     unparseable — never as a blanket default. */
  fallbackDays: 14,
  /* L&I Factory Assembled Structures turnaround for manufactured homes. The
     JURISDICTIONS sheet lists cities and counties only, so this has no source
     there. Leave null until someone confirms the real number: FAS rows then
     report in their own bucket with their age shown and no verdict, which is
     honest. Set it to a number and they get judged like anywhere else. */
  manufacturedHomeDays: null
};

/* The COMBO LOG's JURISDICTION column does not key to the JURISDICTIONS sheet.
   Left side is what the log actually contains, right side is the sheet's key.
   SNOHO PTB is Snohomish County — confirmed 2026-08-16, it is simply what the
   office calls it colloquially. The data agreed before anyone asked: same LNI
   electrical authority as SNOCO, running concurrently with it all year rather
   than replacing it, same department mix. */
var PERMIT_JURISDICTION_ALIASES = {
  "KING CO": "KINGCO",
  "KINGCO": "KINGCO",
  "SNO CO": "SNOCO",
  "MLT": "MOUNTLAKE TERRACE",
  "SNOHOMISH CITY": "CITY OF SNOHOMISH",
  "SNOHOMISH": "CITY OF SNOHOMISH",
  "SNOHO PTB": "SNOCO",
  "SKAGITCO": "SKAGIT CO",
  "ISLANDCO": "ISLAND CO",
  "WHATCOMCO": "WHATCOM CO"
};

/* FAS = Factory Assembled Structures, Washington L&I's manufactured-home
   program — confirmed with the install coordinator. It is a real permit
   authority, not a missing value and not a subcontractor: L&I issues
   manufactured-home permits STATEWIDE, which is why FAS appears in the
   ELECTRICAL column as well and carries its own permit numbers
   ("FAS 4758790F"). The city is genuinely irrelevant on these, so a FAS row
   must never be judged against a municipal timeline. */
var PERMIT_AUTHORITY_FAS = "FAS";

/* "COMBINED W/OTHER PERMIT" and friends mean the work is riding on a permit CM
   Heating did not pull — most often the homeowner sourced their own, sometimes
   it is rolled into another permit already open on the job. Either way nobody
   here is waiting on a city, so measuring it against a municipal timeline is
   meaningless: Wayne Ho read as 30 days overdue in Everett on exactly this.
   The phrase turns up in PERMIT NOTES on some rows and in the JURISDICTION cell
   on others (JAMES HABBERMAN DDS), so both are tested.
   These are surfaced in their own short section rather than dropped, because
   the reading is inferred from the wording rather than confirmed by a field —
   if it is ever wrong, it should be wrong in plain sight. */
var PERMIT_EXTERNAL_RE =
  /COMBINED|HOMEOWNER|OWNER[- ]?(SUPPLIED|PULLED|PROVIDED)|CUSTOMER[- ]?(SUPPLIED|PULLED|PROVIDED)/;

/* Values that occupy the JURISDICTION cell and really are absent. */
var PERMIT_NOT_A_JURISDICTION = { "NA": 1, "N/A": 1, "": 1 };

function growthNormalizeJurisdiction_(raw) {
  var s = String(raw || "").toUpperCase().replace(/\s+/g, " ").trim();
  /* Cells carry a trailing permit number: "EVERETT M2603-002", "FAS 4778507F". */
  s = s.replace(/\s+[A-Z]?\d[\w-]*$/, "").trim();
  if (PERMIT_NOT_A_JURISDICTION[s]) return { key: "", unmapped: true, raw: s };
  if (PERMIT_EXTERNAL_RE.test(s)) {
    return { key: "", unmapped: false, isExternalPermit: true, raw: s };
  }
  if (s === PERMIT_AUTHORITY_FAS) {
    return { key: PERMIT_AUTHORITY_FAS, unmapped: false, isManufacturedHome: true, raw: s };
  }
  var key = PERMIT_JURISDICTION_ALIASES[s] || s;
  return { key: key, unmapped: false, isManufacturedHome: false, raw: s };
}

/* "ASAP", "ALL EQ - 5 BUSINESS DAYS", "ODU - 2 WEEKS", "2-4 WEEKS", "6 WEEKS".
   Always takes the LARGEST duration mentioned: these cells describe a range or
   several equipment cases, and the optimistic end would generate false alarms.
   Business days convert at 7/5 so the answer stays in calendar days, which is
   what a date subtraction gives us. */
function growthParseTimelineDays_(text) {
  var s = String(text || "").toUpperCase();
  if (!s.trim()) return null;
  var best = null;
  var re = /(\d+)\s*(?:-\s*(\d+)\s*)?(BUSINESS\s+DAY|DAY|WEEK|MONTH)/g;
  var m;
  while ((m = re.exec(s)) !== null) {
    var n = Number(m[2] || m[1]);
    var unit = m[3];
    var days = unit.indexOf("WEEK") === 0 ? n * 7
             : unit.indexOf("MONTH") === 0 ? n * 30
             : unit.indexOf("BUSINESS") === 0 ? Math.ceil(n * 7 / 5)
             : n;
    if (best === null || days > best) best = days;
  }
  if (best !== null) return best;
  /* A bare unit with no digit — Burlington's commercial cell reads "WEEK OR
     LESS FOR COMMERCIAL GF SWAP". Read it as one whole unit, the upper bound,
     consistent with taking the longest duration everywhere else here. */
  if (/\bMONTH\b/.test(s)) return 30;
  if (/\bWEEK\b/.test(s)) return 7;
  /* "ASAP" / "TRIAL RUN - CAN GO NEXT DAY" with no number at all. */
  if (/ASAP|NEXT DAY/.test(s)) return 2;
  return null;
}

function readJurisdictionTimelines_() {
  var out = {};
  var ss;
  try { ss = SpreadsheetApp.openById(JURISDICTIONS_SHEET_ID); }
  catch (err) {
    Logger.log("JURISDICTIONS unreachable: " + err);
    return { ok: false, byKey: out };
  }
  var sh = ss.getSheets()[0];
  var values = sh.getDataRange().getValues();
  var hIdx = -1, cName = -1, cLine = -1, cComm = -1;
  for (var r = 0; r < Math.min(values.length, 12); r++) {
    var up = values[r].map(function (c) { return String(c == null ? "" : c).trim().toUpperCase(); });
    var i = up.indexOf("JURISDICTION");
    if (i !== -1) {
      hIdx = r; cName = i;
      for (var k = 0; k < up.length; k++) {
        if (up[k].indexOf("SCHEDULING") === 0) cLine = k;
        if (up[k].indexOf("COMMERCIAL") === 0) cComm = k;
      }
      break;
    }
  }
  if (hIdx === -1 || cLine === -1) return { ok: false, byKey: out };

  for (var i2 = hIdx + 1; i2 < values.length; i2++) {
    var name = String(values[i2][cName] || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (!name) continue;
    var resDays = growthParseTimelineDays_(values[i2][cLine]);
    var comText = cComm === -1 ? "" : String(values[i2][cComm] || "");
    out[name] = {
      name: name,
      residentialDays: resDays,
      commercialDays: growthParseTimelineDays_(comText),
      commercialNote: comText.trim()
    };
  }
  return { ok: true, byKey: out };
}

/* PERMIT NOTES is a small state machine, not prose: "REQUESTED 6/5",
   "ISSUED-WILL SEND ONCE SCHED", "FINALED 8/6", plus exceptions such as
   "CUST REFUSED ACCESS FOR INSPECTION". FINALED means the permit is closed out
   and the job is no longer waiting on the city. */
function growthPermitState_(note, tz) {
  var s = String(note || "").toUpperCase().trim();
  if (!s) return { state: "NONE", sinceIso: "" };
  /* FINALED first: a note may say both, and closed out beats everything. */
  var state = /FINAL/.test(s) ? "FINALED"
            : PERMIT_EXTERNAL_RE.test(s) ? "EXTERNAL"
            : /ISSUED/.test(s) ? "ISSUED"
            : /REQUESTED/.test(s) ? "REQUESTED"
            : "OTHER";
  var m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  var iso = "";
  if (m) {
    var yr = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3])
                  : Number(Utilities.formatDate(new Date(), tz, "yyyy"));
    iso = yr + "-" + pad2_(Number(m[1])) + "-" + pad2_(Number(m[2]));
    /* A month ahead of today means last year's permit, not a future one. */
    if (iso > Utilities.formatDate(new Date(), tz, "yyyy-MM-dd")) {
      iso = (yr - 1) + "-" + pad2_(Number(m[1])) + "-" + pad2_(Number(m[2]));
    }
  }
  return { state: state, sinceIso: iso, text: s };
}

/* HVAC EQUIPMENT INSTALLS ONLY.
 *
 * The COMBO LOG holds every trade — DEPARTMENT is HVAC on most rows but also
 * PLUM and ELECT/ELEC — and plumbing water heaters and electrical-only jobs must
 * never land in Growth HVAC numbers.
 *
 * DEPARTMENT = HVAC is still not sufficient on its own: duct-only work is logged
 * exactly the same way, and a duct job is not an equipment install. The
 * MECHANICAL test below matches the WHOLE CELL on purpose. Do NOT loosen it to a
 * substring test — "DUCTLESS", "DUCTLESS HP", "DUCTLESS SINGLE ZONE" and
 * "DUCTLESS 5 HU" are all real equipment installs and must keep passing. */
function growthIsHvacDepartment_(department) {
  var d = String(department || "").trim().toUpperCase();
  return d === "HVAC";
}
function growthIsHvacEquipmentRow_(mechanical) {
  var m = String(mechanical || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (m === "DUCTWORK" || m === "DUCT WORK" ||
      m === "DUCTWORK ONLY" || m === "DUCT WORK ONLY") return false;
  return true;
}
function growthComboRowIsHvacInstall_(row) {
  return growthIsHvacDepartment_(row && row.department) &&
         growthIsHvacEquipmentRow_(row && row.mechanical);
}

function growthPermitPipeline_() {
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  var todayIso = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  var combo = readComboInstalls_();
  if (!combo.ok) return { ok: false, error: "COMBO LOG unreachable" };
  var jur = readJurisdictionTimelines_();

  var waiting = [], overdue = [], noJurisdiction = [], noTimeline = [],
      otherTrades = [], manufacturedHome = [], externalPermit = [];

  combo.installs.forEach(function (row) {
    if (row.isCompleted || row.isDone) return;
    /* Plumbing and electrical permits are real and worth seeing, but they are
       not Growth HVAC and must not be counted alongside it. Duct-only HVAC rows
       are dropped for the same reason: not an equipment install. */
    if (!growthComboRowIsHvacInstall_(row)) {
      var pOther = growthPermitState_(row.permitNotes, tz);
      if (pOther.state !== "FINALED" && pOther.state !== "NONE") {
        otherTrades.push({
          customer: row.customer, department: row.department || "?",
          mechanical: row.mechanical || "", permitState: pOther.state,
          permitSince: pOther.sinceIso, jurisdictionRaw: row.jurisdiction || ""
        });
      }
      return;
    }
    var permit = growthPermitState_(row.permitNotes, tz);
    /* FINALED is done with the city. NONE means no permit tracked at all, which
       is a different problem and belongs to the stranded check, not here. */
    if (permit.state === "FINALED" || permit.state === "NONE") return;
    if (!permit.sinceIso) return;

    var ageDays = Math.round(
      (new Date(todayIso + "T12:00:00").getTime() -
       new Date(permit.sinceIso + "T12:00:00").getTime()) / 86400000);

    var norm = growthNormalizeJurisdiction_(row.jurisdiction);
    var entry = {
      customer: row.customer, salesRep: row.salesRep, installDate: row.installDate,
      jurisdictionRaw: norm.raw, jurisdiction: norm.key,
      permitState: permit.state, permitSince: permit.sinceIso, ageDays: ageDays,
      note: row.jobNotes || row.jobCompleted || "", sourceSheet: row.sourceSheet
    };

    if (permit.state === "EXTERNAL" || norm.isExternalPermit) {
      entry.why = permit.state === "EXTERNAL" ? permit.text : norm.raw;
      externalPermit.push(entry);
      return;
    }
    if (norm.unmapped) { noJurisdiction.push(entry); return; }

    if (norm.isManufacturedHome) {
      entry.authority = "L&I Factory Assembled Structures (manufactured home)";
      var fasDays = PERMIT_PIPELINE_CONFIG.manufacturedHomeDays;
      if (!fasDays) { manufacturedHome.push(entry); return; }
      entry.basis = "manufactured home";
      entry.expectedDays = fasDays;
      entry.limitDays = fasDays + PERMIT_PIPELINE_CONFIG.graceDays;
      (ageDays > entry.limitDays ? overdue : waiting).push(entry);
      return;
    }

    var spec = jur.byKey[norm.key];
    if (!spec || spec.residentialDays === null) { noTimeline.push(entry); return; }

    /* Residential window is the yardstick. Nothing in the COMBO LOG records
       that a property is commercial-zoned — a dentist office or storefront in a
       house — so where the commercial window is materially longer, the job is
       still surfaced but annotated, and a human decides on sight. Hiding it for
       six weeks on the chance it might be commercial is the worse error. */
    var base = spec.residentialDays;
    if (row.isCommercial && spec.commercialDays) {
      /* Known commercial — use the real window rather than guessing. Everett is
         5 business days residential and 4-6 WEEKS commercial, so this is the
         difference between a true alarm and a meaningless one. */
      base = spec.commercialDays;
      entry.basis = "commercial";
    } else {
      entry.basis = row.isCommercial ? "commercial (no commercial timeline on file)" : "residential";
      if (!row.isCommercial && spec.commercialDays && spec.commercialDays > spec.residentialDays * 2) {
        entry.commercialCaveat = "if commercial-zoned, allow ~" + spec.commercialDays + "d";
      }
    }
    var limit = base + PERMIT_PIPELINE_CONFIG.graceDays;
    entry.expectedDays = base;
    entry.limitDays = limit;
    (ageDays > limit ? overdue : waiting).push(entry);
  });

  overdue.sort(function (a, b) { return (b.ageDays - b.limitDays) - (a.ageDays - a.limitDays); });
  noJurisdiction.sort(function (a, b) { return b.ageDays - a.ageDays; });

  return {
    ok: true, tz: tz, todayIso: todayIso,
    jurisdictionsLoaded: jur.ok ? Object.keys(jur.byKey).length : 0,
    overdue: overdue, waiting: waiting,
    noJurisdiction: noJurisdiction, noTimeline: noTimeline,
    otherTrades: otherTrades, manufacturedHome: manufacturedHome,
    externalPermit: externalPermit,
    comboRows: combo.installs.length
  };
}

/* Read-only. Writes nothing, emails nobody. */
function previewPermitPipeline() {
  var r = growthPermitPipeline_();
  if (!r.ok) { Logger.log("permit pipeline FAILED: " + r.error); return r; }
  var out = [];
  out.push("PERMIT PIPELINE — open jobs waiting on a permit");
  out.push("================================================");
  out.push("As of " + r.todayIso + " · COMBO LOG rows " + r.comboRows +
           " · jurisdictions loaded " + r.jurisdictionsLoaded);
  out.push("HVAC EQUIPMENT INSTALLS ONLY — plumbing, electrical and duct-only");
  out.push("rows are held out below and never counted in these figures.");
  out.push("Overdue " + r.overdue.length + " · within window " + r.waiting.length +
           " · no jurisdiction recorded " + r.noJurisdiction.length +
           " · no timeline " + r.noTimeline.length +
           " · manufactured home " + r.manufacturedHome.length +
           " · permit not ours " + r.externalPermit.length +
           " · other trades held out " + r.otherTrades.length);
  out.push("");

  function line(e, showLimit) {
    return "  " + e.ageDays + "d" + (showLimit ? "/" + e.limitDays + "d" : "") +
           "  " + (e.jurisdiction || e.jurisdictionRaw || "?") +
           "  " + e.permitState + " " + e.permitSince +
           "  " + e.customer + (e.salesRep ? " (" + e.salesRep + ")" : "") +
           (e.basis === "commercial" ? "  [COMMERCIAL window]" : "") +
           (e.commercialCaveat ? "  [" + e.commercialCaveat + "]" : "") +
           (e.note ? "  — " + String(e.note).slice(0, 60) : "");
  }

  out.push(r.overdue.length ? "OVERDUE — past the jurisdiction's own timeline:"
                            : "OVERDUE: none.");
  r.overdue.forEach(function (e) { out.push(line(e, true)); });
  out.push("");

  if (r.externalPermit.length) {
    out.push("PERMIT NOT OURS (" + r.externalPermit.length + ") — combined with another");
    out.push("permit or supplied by the homeowner, so no city timeline applies");
    out.push("and nothing here is waiting on us:");
    r.externalPermit.forEach(function (e) {
      out.push(line(e, false) + (e.why ? "  <" + String(e.why).slice(0, 40) + ">" : ""));
    });
    out.push("");
  }
  if (r.manufacturedHome.length) {
    out.push("MANUFACTURED HOME — L&I Factory Assembled Structures (" +
             r.manufacturedHome.length + "). Permitted by the state, not the");
    out.push("city, so no municipal timeline applies. Age shown, no verdict —");
    out.push("set PERMIT_PIPELINE_CONFIG.manufacturedHomeDays to judge these:");
    r.manufacturedHome.forEach(function (e) { out.push(line(e, false)); });
    out.push("");
  }
  if (r.noJurisdiction.length) {
    out.push("NO JURISDICTION RECORDED (" + r.noJurisdiction.length +
             ") — the cell is blank or NA, so no timeline applies:");
    r.noJurisdiction.forEach(function (e) { out.push(line(e, false)); });
    out.push("");
  }
  if (r.noTimeline.length) {
    out.push("JURISDICTION NOT IN THE SHEET (" + r.noTimeline.length + "):");
    r.noTimeline.forEach(function (e) { out.push(line(e, false)); });
    out.push("");
  }
  if (r.otherTrades.length) {
    out.push("OTHER TRADES — open permits, deliberately NOT in the HVAC counts:");
    r.otherTrades.forEach(function (e) {
      out.push("  [" + e.department + "] " + e.permitState + " " + e.permitSince +
               "  " + e.customer + (e.mechanical ? "  " + e.mechanical : ""));
    });
    out.push("");
  }
  out.push("Timelines come from the JURISDICTIONS sheet and always take the");
  out.push("LONGEST duration in the cell. 'SNOHO PTB' is Snohomish County.");

  var msg = out.join("\n");
  Logger.log(msg);
  return r;
}
/* ============================================================================
 * readGrowthDaysRaw_ - THIS IS THE LIVE DEFINITION. This is the one that runs.
 *
 * Applied 2026-08-18 (the date-coercion fix). The pre-fix copy still exists
 * earlier in this file, renamed on 2026-08-28 to:
 *
 *     readGrowthDaysRaw_OLD_20260818
 *
 * It is parked, not deleted, and nothing calls it. Leave it that way.
 *
 * WHY IT WAS RENAMED AND NOT DELETED. Apps Script shares one global scope and
 * the LAST definition of a name wins. While both copies were named
 * readGrowthDaysRaw_, which one actually ran was decided by their order in the
 * file - silently, with no error and no log line. The rename makes the live one
 * unambiguous. Deleting a block instead of renaming it is how this project lost
 * the opening bracket of GROWTH_SOURCE_CORRECTIONS on 2026-08-25 and stopped
 * parsing.
 *
 * DO NOT restore the old name. Two live copies of it and the file's line order
 * silently decides your numbers again.
 *
 * DO NOT follow "replace lines N through M" instructions anywhere in this
 * project, including older ones left in comments. Line numbers here drift by
 * hundreds between edits. Find code by content, never by line number.
 * ========================================================================== */

function readGrowthDaysRaw_(ss) {
  var fallback = (typeof L2C_DAYS !== "undefined" && L2C_DAYS) ? L2C_DAYS : [];
  var sh = growthDaysSheet_(ss);
  if (!sh) return fallback;

  var rows;
  try {
    var last = sh.getLastRow();
    if (last < 2) return fallback;
    rows = sh.getRange(2, 1, last - 1, GROWTH_DAILY_DATA_HEADER.length).getValues();
  } catch (e) {
    Logger.log("Daily Data tab unreadable (" + e + "); using the L2C_DAYS array.");
    return fallback;
  }

  /* WHY THIS EXISTS. Google Sheets silently coerces a label typed or written as
     "Mon 8/17" into a real Date value formatted "ddd m/d". It still LOOKS like
     "Mon 8/17" on screen, but getValues() hands back a Date object whose
     String() form is "Mon Aug 17 2026 00:00:00 GMT-0700 (PDT)" — which contains
     no M/D. The old test therefore skipped EVERY row, out.length came back 0,
     and the whole tab silently fell back to the L2C_DAYS array with nothing
     logged and nothing visibly broken. The Daily panel sat on stale array data
     while the tab was correct and simply ignored.
     Normalise Dates back to "Ddd M/D" before testing. */
  var tz;
  try { tz = sh.getParent().getSpreadsheetTimeZone(); }
  catch (e) { tz = Session.getScriptTimeZone(); }

  function labelOf(v) {
    if (v instanceof Date && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, tz, "EEE M/d");   // -> "Mon 8/17"
    }
    return String(v == null ? "" : v).trim();
  }

  var out = [], skipped = 0, coerced = 0;
  rows.forEach(function (r) {
    if (r[0] instanceof Date) coerced++;
    var label = labelOf(r[0]);
    /* A label with no M/D in it cannot drive the BI-thru date, so it is not a
       day row — blank rows and stray notes land here and are skipped, not
       guessed at. */
    if (!label || !/\d{1,2}\/\d{1,2}/.test(label)) { if (label) skipped++; return; }
    var nums = [];
    for (var i = 1; i <= 8; i++) {
      var n = Number(r[i]);
      nums.push(isFinite(n) ? n : 0);
    }
    out.push([label].concat(nums));
  });

  if (!out.length) {
    Logger.log("Daily Data produced 0 usable rows out of " + rows.length +
               " — falling back to the L2C_DAYS array. Check column A.");
    return fallback;
  }
  if (coerced) Logger.log("Daily Data: " + coerced + " label(s) were stored as dates and were normalised.");
  if (skipped) Logger.log("Daily Data: skipped " + skipped + " row(s) with no M/D in the label.");
  return out;
}
/* ############################################################################
 * GROWTH COLLAPSE — BUNDLING FIX          paste as ONE block, 2026-08-21
 * ############################################################################
 *
 * WHERE  End of "0730daily-recaps" in HCA Daily Recap. Ctrl+End, Enter twice,
 *        paste, save. DELETE NOTHING. Four functions here supersede four that
 *        already exist further up; the later definition wins, which is how
 *        readGrowthDaysRaw_ has been running from line 15804 for weeks.
 *
 * WHAT   Sold alerts for one job arrive as separate estimates — system, water
 *        heater, IAQ, electrical panel, purification. The old code kept ONE
 *        alert per opportunity, whichever email landed last, and discarded the
 *        rest. That is right for a re-quote and wrong for a bundle. Five
 *        August sales were wrong because of it.
 *
 * EFFECT August moves from 60 sales / $881,742.15 to 61 / $942,071.78.
 *
 * THEN   Run zzPreviewBundledSold. It writes nothing. Only after it reads
 *        clean do you run refreshSameDaySoldTab and then refreshDailyGrowth.
 *
 * BACK   Delete this whole block. Nothing above it was touched. The tab is
 *        rebuilt from Gmail on every run, so no data is lost either way.
 * ######################################################################## */


/* ============================================================================
 * growthCollapseLatestSoldAlerts_  —  REPLACEMENT (2026-08-21)
 *
 * WHAT CHANGED AND WHY
 * The previous version grouped alerts by opportunity / job / estimate and kept
 * exactly ONE member per group: the latest-received alert, with only its own
 * amount. That is right for a re-quote and wrong for a bundle. When an HCA
 * sells a system and a water heater on the same opportunity, ServiceTitan fires
 * two alerts seconds apart; the old rule kept whichever email landed second and
 * threw the other away. Five August cases, each verified by closing the
 * arithmetic on the published day row, seller confirmed on RECAP_ROSTER:
 *
 *   8/10  Vincent Stevens  opp 408387028  Granard     $16,490.65  AC w/ return
 *         kept a $109.00 dryer vent, which then failed the $2,000 gate, so
 *         the whole sale left the tab.
 *   8/13  Laura Richmond   opp 409447315  Maddalena   $ 8,815.50  gas furnace
 *   8/18  Alisha Jang      opp 410395417  Chounramany $16,790.48  furnace + AC
 *   8/19  Evan Miller      opp 407848823  Milo        $ 2,749.00  water tank
 *         lost to an 8/20 re-paper of the system on the same opportunity.
 *   8/10  Schiebel/Watson  opp 407804785  Diosdado    $15,375.00  200A panel
 *         papered by an electrician, so the OLD readSoldAlerts_ discarded it
 *         at the seller gate before grouping. See rule 4.
 *
 * Together: 60 sales / $881,742.15 becomes 61 / $942,071.78 for August.
 *
 * THE RULE. Grouping is unchanged. Inside a group:
 *   1. An alert whose amount equals the exact sum of later alerts in the same
 *      group is a COMBINED estimate that was re-papered as line items. It is
 *      dropped. (Laura Richmond 8/13: est 409618580 is $13,540.50, and
 *      $8,815.50 + $4,725.00 is $13,540.50 to the penny.)
 *   2. Survivors are bucketed by PRODUCT, read off the estimate Name. Same
 *      bucket means successive versions of one thing, so the latest-received
 *      wins — a re-quote, a downgrade, a "- updated", a "- Copy".
 *   3. The bundling buckets in a group become ONE sale whose amount is their
 *      sum, regardless of sold date — HVAC and plumbing are written as separate
 *      estimates, sometimes days apart, and still count as one HCA sale. The
 *      record carries the anchor's date: rostered before unrostered, system
 *      before add-on, larger before smaller. Non-bundling buckets stand alone.
 *   4. The roster test is applied to the GROUP, not to each estimate, because
 *      readSoldAlerts_(days, true) now lets non-roster sellers through so their
 *      halves can be reunited. A group with no rostered member produces
 *      nothing; a standalone line item needs its own rostered seller. That is
 *      what keeps the COD service traffic out of the headline.
 *
 * Ryan Schiebel and Kasey Watson, opp 407804785: a $15,375.00 200A panel sold
 * 8/7 by an electrician plus a $15,482.54 ductless sold 8/10 by Diosdado is one
 * sale of $30,857.54, dated 8/10. growthClassifyLatestSale_ still reads the
 * EARLIEST member for same-day, so it classifies against 8/7's booked run.
 *
 * WHY NAME AND NOT DEPARTMENT. The Sold Estimate Alert body carries no
 * department, business unit, or trade — ALERT_FIELD_LABELS is the whole set,
 * and Name is the only field holding product identity. isFireplaceSale_ already
 * classifies by Name regex, so this follows the pattern already in the file.
 *
 * CONTRACT. Same signature, same return shape. Every consumer field is
 * preserved: growthRevisionCount, growthRevisionMembers (the same-day lookback
 * in growthClassifyLatestSale_ reads it), growthJobCandidates,
 * growthOpportunityCandidates, and diagnostics.rawAlerts / uniqueSales /
 * revisedGroups / supersededAlerts. Members carried on a record are only that
 * record's own members, never the whole opportunity, or the same-day lookback
 * and the stExcluded_ guard would reach across unrelated line items.
 * ========================================================================== */

/* Ordered most specific first. A combined estimate naming two products lands in
   the more specific bucket, which is where its own successor lives.

   bundles:true is Geoff's list — IAQ, water heater, electrical panel, water
   purification. HVAC and plumbing are typically written as two estimates and
   still count as ONE sale for the HCA, so these fold into the system sale
   instead of competing with it — across sold dates, not just within a day.

   bundles:false stands alone. Service work is a tech ticket, not an HCA bundle,
   and it fails the $2,000 gate on its own anyway. Fireplace is left standalone
   because the file already routes fireplace separately (isFireplaceSale_,
   soldTodayBucket_) and no August case exercises the combination — flip its
   flag if a furnace-plus-fireplace should count once. Edit this list to add a
   trade; nothing below needs to change. */
var GROWTH_PRODUCT_BUCKETS = [
  { key: "fireplace",    bundles: false, re: /\b(fireplace|firebox|insert|hearth|gas\s*log|slim\s*?line)\b/i },
  { key: "purification", bundles: true,  re: /\b(purif(y|ier|ication)|reverse\s*osmosis|water\s*softener|whole\s*house\s*filtr)\b/i },
  { key: "waterheater",  bundles: true,  re: /\b(water\s*(heater|tank)|hot\s*water|tankless)\b/i },
  { key: "electrical",   bundles: true,  re: /\b(amp|panel|breaker|circuit|sub-?panel|surge|electrical|rewire|wiring|generator|ev\s*charger)\b/i },
  { key: "airquality",   bundles: true,  re: /\b(duct|ductwork|return\s*air|air\s*scrubber|air\s*ranger|filter|iaq|humidifier|dryer\s*vent|vent\s*clean)\b/i },
  { key: "service",      bundles: false, re: /\b(maintenance|club|member(ship)?|service\s*fee|diag(nostic)?|repair|clean(ing)?|flush|p-?trap|drain|igniter|thermostat|inducer|blower|capacitor|contactor|control\s*board|pcb|switch|coil\s*clean|leak\s*search|waiver|discount)\b/i }
];
/* The primary. Everything with bundles:true folds into it. */
var GROWTH_PRODUCT_DEFAULT = "system";

function growthProductBucket_(name) {
  var s = String(name || "");
  for (var i = 0; i < GROWTH_PRODUCT_BUCKETS.length; i++) {
    if (GROWTH_PRODUCT_BUCKETS[i].re.test(s)) return GROWTH_PRODUCT_BUCKETS[i].key;
  }
  return GROWTH_PRODUCT_DEFAULT;
}

function growthBucketBundles_(key) {
  if (key === GROWTH_PRODUCT_DEFAULT) return true;
  for (var i = 0; i < GROWTH_PRODUCT_BUCKETS.length; i++) {
    if (GROWTH_PRODUCT_BUCKETS[i].key === key) return !!GROWTH_PRODUCT_BUCKETS[i].bundles;
  }
  return false;
}

function growthCents_(v) {
  var n = Number(v);
  return isFinite(n) ? Math.round(n * 100) : 0;
}

function growthAlertTime_(a) {
  return (a && a.received && a.received.getTime) ? a.received.getTime() : 0;
}

function growthCollapseLatestSoldAlerts_OLD_20260826(alerts) {
  alerts = alerts || [];

  /* ---- 1. GROUPING. Unchanged from the previous version. ---- */
  var parent = alerts.map(function (_, i) { return i; });
  var firstSeen = {};
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function link(key, i) {
    if (!key) return;
    if (firstSeen[key] === undefined) { firstSeen[key] = i; return; }
    var a = find(firstSeen[key]), b = find(i);
    if (a !== b) parent[b] = a;
  }
  alerts.forEach(function (alert, i) {
    var customer = normName_(alert.customer);
    if (alert.opportunityNumber) link("opp|" + alert.opportunityNumber + "|" + customer, i);
    if (alert.jobNumber) link("job|" + alert.jobNumber + "|" + customer, i);
    if (alert.estimateNumber) link("est|" + alert.estimateNumber + "|" + customer, i);
  });

  var groups = {};
  alerts.forEach(function (alert, i) {
    var root = find(i);
    (groups[root] = groups[root] || []).push({ alert: alert, index: i });
  });

  function ordered(members) {
    return members.slice().sort(function (x, y) {
      var xt = growthAlertTime_(x.alert), yt = growthAlertTime_(y.alert);
      if (xt !== yt) return xt - yt;
      var xd = String(x.alert.soldOnIso || ""), yd = String(y.alert.soldOnIso || "");
      return xd === yd ? x.index - y.index : xd.localeCompare(yd);
    });
  }

  var out = [];
  var revisedGroups = 0, bundledSales = 0, bundledDollars = 0, combinedDropped = 0;
  var unrosteredGroups = 0, unrosteredBundled = 0, unrosteredDollars = 0;

  Object.keys(groups).forEach(function (root) {
    var members = ordered(groups[root]);
    if (members.length > 1) revisedGroups++;

    /* ---- 2. Drop a COMBINED estimate that later got re-papered as line items.
       Guarded four ways, because "some later amounts happen to add up" is not
       evidence of anything. The later members must all carry real money, must
       sit in DISTINCT product buckets — that is what makes them line items
       rather than versions — and must total this alert to the exact cent.
       Terry Smith 8/6 is why: $15,027.48 / $0.00 / $15,027.48 sums correctly
       and means nothing, since the $0.00 is a re-paper of the same system. ---- */
    var live = members.slice();
    if (live.length > 2) {
      var keep = [];
      for (var i = 0; i < live.length; i++) {
        var mine = growthCents_(live[i].alert.amount);
        var later = live.slice(i + 1);
        var laterSum = 0, allPositive = true, buckets = [];
        later.forEach(function (m) {
          var c = growthCents_(m.alert.amount);
          laterSum += c;
          if (c <= 0) allPositive = false;
          var b = growthProductBucket_(m.alert.name);
          if (buckets.indexOf(b) < 0) buckets.push(b);
        });
        var isCombined = mine > 0 && later.length > 1 && allPositive &&
                         buckets.length === later.length && laterSum === mine;
        if (isCombined) { combinedDropped++; continue; }
        keep.push(live[i]);
      }
      live = keep;
    }

    /* ---- 3. One survivor per product bucket: the latest-received. ---- */
    var byBucket = {};
    live.forEach(function (m) {
      var b = growthProductBucket_(m.alert.name);
      byBucket[b] = m;   // live is oldest-first, so the last write is the newest
    });

    /* ---- 3b. Roster test, at the GROUP. ---- */
    var hasRostered = live.some(function (m) { return !m.alert.unrostered; });
    if (!hasRostered) { unrosteredGroups++; return; }

    /* ---- 4. Bundling buckets across the whole group become ONE sale.
       Non-bundling buckets stand alone and need their own rostered seller. ---- */
    var survivors = ordered(Object.keys(byBucket).map(function (b) { return byBucket[b]; }));
    var sales = [];
    var bundle = survivors.filter(function (m) {
      return growthBucketBundles_(growthProductBucket_(m.alert.name));
    });
    if (bundle.length && bundle.some(function (m) { return !m.alert.unrostered; })) {
      sales.push(bundle);
    }
    survivors.forEach(function (m) {
      if (!growthBucketBundles_(growthProductBucket_(m.alert.name)) && !m.alert.unrostered) {
        sales.push([m]);
      }
    });

    sales.forEach(function (lineItems) {
      var total = 0;
      lineItems.forEach(function (m) { total += growthCents_(m.alert.amount); });

      /* The anchor. Rostered first, so seller, customer, job number and the
         sold DATE never come from an electrician's half. Then the system over
         an add-on, then the larger figure. */
      var primary = lineItems.slice().sort(function (x, y) {
        var xr = x.alert.unrostered ? 0 : 1, yr = y.alert.unrostered ? 0 : 1;
        if (xr !== yr) return yr - xr;
        var xs = growthProductBucket_(x.alert.name) === GROWTH_PRODUCT_DEFAULT ? 1 : 0;
        var ys = growthProductBucket_(y.alert.name) === GROWTH_PRODUCT_DEFAULT ? 1 : 0;
        if (xs !== ys) return ys - xs;
        return growthCents_(y.alert.amount) - growthCents_(x.alert.amount);
      })[0];

      var kept = Object.assign({}, primary.alert);
      kept.amount = total / 100;

      /* Members are the alerts that fed these line items, including the
         versions superseded inside their buckets — growthClassifyLatestSale_
         walks them for the earliest sold date and stExcluded_ walks them for
         approval-guard rulings. A standalone sale never sees the bundle's. */
      var liveBuckets = lineItems.map(function (m) {
        return growthProductBucket_(m.alert.name);
      });
      var mine = members.filter(function (m) {
        return liveBuckets.indexOf(growthProductBucket_(m.alert.name)) >= 0;
      });
      if (!mine.length) mine = lineItems;

      kept.growthRevisionCount = mine.length;
      kept.growthRevisionMembers = mine.map(function (m) { return m.alert; });
      kept.growthLineItemCount = lineItems.length;
      kept.growthLineItems = lineItems.map(function (m) {
        return {
          bucket: growthProductBucket_(m.alert.name),
          name: m.alert.name,
          estimateNumber: m.alert.estimateNumber,
          soldOnIso: m.alert.soldOnIso,
          seller: m.alert.unrostered ? (m.alert.soldByRaw || "(not on roster)") : m.alert.hca,
          unrostered: !!m.alert.unrostered,
          amount: growthCents_(m.alert.amount) / 100
        };
      });
      kept.growthJobCandidates = [];
      kept.growthOpportunityCandidates = [];
      mine.forEach(function (m) {
        var a = m.alert;
        if (a.jobNumber && kept.growthJobCandidates.indexOf(String(a.jobNumber)) < 0) {
          kept.growthJobCandidates.push(String(a.jobNumber));
        }
        if (a.opportunityNumber && kept.growthOpportunityCandidates.indexOf(String(a.opportunityNumber)) < 0) {
          kept.growthOpportunityCandidates.push(String(a.opportunityNumber));
        }
      });

      if (lineItems.length > 1) {
        bundledSales++;
        bundledDollars += (total - growthCents_(primary.alert.amount)) / 100;
      }
      lineItems.forEach(function (m) {
        if (m.alert.unrostered) {
          unrosteredBundled++;
          unrosteredDollars += growthCents_(m.alert.amount) / 100;
        }
      });
      out.push(kept);
    });
  });

  return {
    alerts: out,
    diagnostics: {
      rawAlerts: alerts.length,
      uniqueSales: out.length,
      revisedGroups: revisedGroups,
      supersededAlerts: alerts.length - out.length,
      bundledSales: bundledSales,
      bundledDollars: Math.round(bundledDollars * 100) / 100,
      combinedEstimatesDropped: combinedDropped,
      unrosteredGroupsDropped: unrosteredGroups,
      unrosteredLineItemsBundled: unrosteredBundled,
      unrosteredDollarsBundled: Math.round(unrosteredDollars * 100) / 100
    }
  };
}
/* ============================================================================
 * growthCollapseLatestSoldAlerts_  —  REPLACEMENT (2026-08-26)
 *
 * ONE CHANGE, in step 3. Everything else is byte-for-byte the 2026-08-21 block.
 *
 * WHY. Jeff Tabor, opportunity 410448705, job 410448703: Adam Weberg sold a
 * $7,808.10 American Standard gas furnace and a $9,800.88 Mitsubishi ductless
 * on 8/25, twenty-six seconds apart. Both estimate names fall through every
 * GROWTH_PRODUCT_BUCKETS regex to the "system" catch-all ("Ductless" does not
 * match \bduct\b), so the two were read as two drafts of one quote and the
 * furnace was dropped. Verified by running the live functions against the two
 * real alerts: in 2 alerts / $17,608.98, out 1 sale / $9,800.88.
 *
 * WHAT CHANGED. A bundling bucket may now hold more than one survivor, when
 * growthIsCoSold_ says the two members are two different pieces of work sold
 * in one sitting rather than two versions of one. They still fold into ONE
 * sale through the existing bundling rule, so the sale COUNT cannot move —
 * only the dollars. Backtested over all 224 Sold Estimate Alerts from 7/30 to
 * 8/26: 91 sales before, 91 sales after, three sales gained dollars —
 * Kathy Davis +$14,374.24, Jeff Tabor +$7,808.10, Bonnie Piest +$2,865.13.
 * Nothing else moved, and all eleven zzSelfTest fixtures still pass.
 *
 * THE ONE THAT NEARLY BROKE IT. The Diosdado fixture — an 8/13 heat pump at
 * $17,478.47 replaced by an 8/16 furnace at $10,882.45 — is a downgrade, not
 * two systems, and an earlier version of this rule summed it. The sold-date
 * and thirty-minute gates are what stop that, and they are the only two gates
 * a fixture currently proves are load-bearing. The other four are redundant on
 * 27 days of real traffic; they are kept because each blocks a different way
 * this can go wrong, not because the data demanded them.
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * growthIsCoSold_  —  NEW (2026-08-26)
 * Two members of the same product bucket are two DIFFERENT pieces of work —
 * not two versions of one — only when every gate below holds.
 * ------------------------------------------------------------------------- */
var GROWTH_COSOLD = { minAmountGapPct: 20, minutesApart: 30, enabled: true };

var GROWTH_EQUIP_TOKENS = [
  ["furnace",     /\b(furnace|gas\s*furnace)\b/i],
  ["heatpump",    /\b(heat\s*pump|heatpump)\b/i],
  ["ductless",    /\b(ductless|mini-?split|single\s*head|single\s*zone|\d+\s*-?\s*zone)\b/i],
  ["ac",          /\b(a\/?c|air\s*condition\w*)\b/i],
  ["airhandler",  /\b(air\s*handler)\b/i],
  ["boiler",      /\b(boiler)\b/i],
  ["fireplace",   /\b(fireplace|firebox|insert|hearth)\b/i],
  ["waterheater", /\b(water\s*(heater|tank)|tankless|hot\s*water)\b/i],
  ["ductwork",    /\b(duct\s*work|ductwork|return\s*air|supply\s*run|heat\s*run|dropbox)\b/i],
  ["ductclean",   /\b(duct\s*clean\w*|vent\s*clean\w*)\b/i],
  ["scrubber",    /\b(air\s*scrubber|air\s*ranger|iaq|purif\w*)\b/i],
  ["filter",      /\b(filter|media\s*cabinet)\b/i],
  ["humidifier",  /\b(humidifier|dehumidifi\w*)\b/i],
  ["dryervent",   /\b(dryer\s*vent)\b/i],
  ["gaspiping",   /\b(gas\s*piping|gas\s*line)\b/i],
  ["panel",       /\b(panel|sub-?panel|breaker|circuit|generator|ev\s*charger|surge)\b/i],
  ["thermostat",  /\b(thermostat)\b/i]
];

function growthEquipSet_(name) {
  var s = String(name || ""), out = [];
  for (var i = 0; i < GROWTH_EQUIP_TOKENS.length; i++) {
    if (GROWTH_EQUIP_TOKENS[i][1].test(s)) out.push(GROWTH_EQUIP_TOKENS[i][0]);
  }
  return out.sort().join("+");
}

/* Strip the words a rep adds when re-papering the SAME estimate, then flatten.
   "NEW* Comfort Solution #2 ... - Copy" and "Comfort Solution #2 ..." must
   normalise to the same string, or every copy reads as a second system. */
function growthNameKey_(name) {
  return String(name || "")
    .replace(/\b(new\*?|updated?|revised?|copy|final|option)\b/gi, " ")
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase().trim();
}

/* TRUE = these two are two different pieces of work sold together. */
function growthIsCoSold_(a, b) {
  if (!GROWTH_COSOLD.enabled) return false;
  var av = Number(a.amount), bv = Number(b.amount);
  /* A zero or a credit is a re-paper or an adjustment, never a second system. */
  if (!(av > 0) || !(bv > 0)) return false;
  if (String(a.estimateNumber || "") === String(b.estimateNumber || "")) return false;
  /* Same equipment named on both = one system, quoted twice. */
  var ae = growthEquipSet_(a.name), be = growthEquipSet_(b.name);
  if (ae === be) return false;
  /* One name contained in the other = a re-paper with extra words. */
  var ak = growthNameKey_(a.name), bk = growthNameKey_(b.name);
  if (!ak || !bk) return false;
  if (ak === bk || ak.indexOf(bk) >= 0 || bk.indexOf(ak) >= 0) return false;
  /* A revision lands near the price it replaces. Two systems rarely do. */
  var hi = Math.max(av, bv), lo = Math.min(av, bv);
  if (((hi - lo) / hi) * 100 < GROWTH_COSOLD.minAmountGapPct) return false;
  /* Two things sold TOGETHER are papered in one sitting and carry one sold
     date. A downgrade is a second decision on a second day: James X 8/13 heat
     pump $17,478.47 replaced by an 8/16 furnace $10,882.45 is one sale, and
     without this gate the amount rule would have summed it. */
  if (String(a.soldOnIso || "") !== String(b.soldOnIso || "")) return false;
  var at = (a.received && a.received.getTime) ? a.received.getTime() : 0;
  var bt = (b.received && b.received.getTime) ? b.received.getTime() : 0;
  if (!at || !bt) return false;
  if (Math.abs(at - bt) > GROWTH_COSOLD.minutesApart * 60000) return false;
  return true;
}


function growthCollapseLatestSoldAlerts_(alerts) {
  alerts = alerts || [];

  /* ---- 1. GROUPING. Unchanged from the previous version. ---- */
  var parent = alerts.map(function (_, i) { return i; });
  var firstSeen = {};
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function link(key, i) {
    if (!key) return;
    if (firstSeen[key] === undefined) { firstSeen[key] = i; return; }
    var a = find(firstSeen[key]), b = find(i);
    if (a !== b) parent[b] = a;
  }
  alerts.forEach(function (alert, i) {
    var customer = normName_(alert.customer);
    if (alert.opportunityNumber) link("opp|" + alert.opportunityNumber + "|" + customer, i);
    if (alert.jobNumber) link("job|" + alert.jobNumber + "|" + customer, i);
    if (alert.estimateNumber) link("est|" + alert.estimateNumber + "|" + customer, i);
  });

  var groups = {};
  alerts.forEach(function (alert, i) {
    var root = find(i);
    (groups[root] = groups[root] || []).push({ alert: alert, index: i });
  });

  function ordered(members) {
    return members.slice().sort(function (x, y) {
      var xt = growthAlertTime_(x.alert), yt = growthAlertTime_(y.alert);
      if (xt !== yt) return xt - yt;
      var xd = String(x.alert.soldOnIso || ""), yd = String(y.alert.soldOnIso || "");
      return xd === yd ? x.index - y.index : xd.localeCompare(yd);
    });
  }

  var out = [];
  var revisedGroups = 0, bundledSales = 0, bundledDollars = 0, combinedDropped = 0;
  var unrosteredGroups = 0, unrosteredBundled = 0, unrosteredDollars = 0;
  var coSoldSplits = 0;

  Object.keys(groups).forEach(function (root) {
    var members = ordered(groups[root]);
    if (members.length > 1) revisedGroups++;

    /* ---- 2. Drop a COMBINED estimate that later got re-papered as line items.
       Guarded four ways, because "some later amounts happen to add up" is not
       evidence of anything. The later members must all carry real money, must
       sit in DISTINCT product buckets — that is what makes them line items
       rather than versions — and must total this alert to the exact cent.
       Terry Smith 8/6 is why: $15,027.48 / $0.00 / $15,027.48 sums correctly
       and means nothing, since the $0.00 is a re-paper of the same system. ---- */
    var live = members.slice();
    if (live.length > 2) {
      var keep = [];
      for (var i = 0; i < live.length; i++) {
        var mine = growthCents_(live[i].alert.amount);
        var later = live.slice(i + 1);
        var laterSum = 0, allPositive = true, buckets = [];
        later.forEach(function (m) {
          var c = growthCents_(m.alert.amount);
          laterSum += c;
          if (c <= 0) allPositive = false;
          var b = growthProductBucket_(m.alert.name);
          if (buckets.indexOf(b) < 0) buckets.push(b);
        });
        var isCombined = mine > 0 && later.length > 1 && allPositive &&
                         buckets.length === later.length && laterSum === mine;
        if (isCombined) { combinedDropped++; continue; }
        keep.push(live[i]);
      }
      live = keep;
    }

    /* ---- 3. Survivors per product bucket. The latest-received wins WITHIN a
       version chain, but a bundling bucket may hold more than one survivor when
       two members are two different pieces of work sold together rather than
       two drafts of one (growthIsCoSold_). Jeff Tabor 8/25 is why: a $7,808.10
       gas furnace and a $9,800.88 ductless, same job, 26 seconds apart, both
       landing in the "system" catch-all, so the furnace was silently dropped. */
    var byBucket = {};
    live.forEach(function (m) {
      var b = growthProductBucket_(m.alert.name);
      var list = byBucket[b] || (byBucket[b] = []);
      if (!list.length) { list.push(m); return; }
      /* A standalone bucket never holds two sales; keep the old behaviour. */
      if (!growthBucketBundles_(b)) { byBucket[b] = [m]; return; }
      /* Prefer to supersede the survivor naming the SAME equipment, so a
         furnace revision replaces the furnace and not the ductless beside it. */
      var mine = growthEquipSet_(m.alert.name), at = -1;
      for (var i = 0; i < list.length; i++) {
        if (growthEquipSet_(list[i].alert.name) === mine &&
            !growthIsCoSold_(list[i].alert, m.alert)) { at = i; break; }
      }
      if (at < 0) {
        for (var j = 0; j < list.length; j++) {
          if (!growthIsCoSold_(list[j].alert, m.alert)) { at = j; break; }
        }
      }
      if (at >= 0) list[at] = m;
      else { list.push(m); coSoldSplits++; }
    });

    /* ---- 3b. Roster test, at the GROUP. ---- */
    var hasRostered = live.some(function (m) { return !m.alert.unrostered; });
    if (!hasRostered) { unrosteredGroups++; return; }

    /* ---- 4. Bundling buckets across the whole group become ONE sale.
       Non-bundling buckets stand alone and need their own rostered seller. ---- */
    var flat = [];
    Object.keys(byBucket).forEach(function (b) { flat = flat.concat(byBucket[b]); });
    var survivors = ordered(flat);
    var sales = [];
    var bundle = survivors.filter(function (m) {
      return growthBucketBundles_(growthProductBucket_(m.alert.name));
    });
    if (bundle.length && bundle.some(function (m) { return !m.alert.unrostered; })) {
      sales.push(bundle);
    }
    survivors.forEach(function (m) {
      if (!growthBucketBundles_(growthProductBucket_(m.alert.name)) && !m.alert.unrostered) {
        sales.push([m]);
      }
    });

    sales.forEach(function (lineItems) {
      var total = 0;
      lineItems.forEach(function (m) { total += growthCents_(m.alert.amount); });

      /* The anchor. Rostered first, so seller, customer, job number and the
         sold DATE never come from an electrician's half. Then the system over
         an add-on, then the larger figure. */
      var primary = lineItems.slice().sort(function (x, y) {
        var xr = x.alert.unrostered ? 0 : 1, yr = y.alert.unrostered ? 0 : 1;
        if (xr !== yr) return yr - xr;
        var xs = growthProductBucket_(x.alert.name) === GROWTH_PRODUCT_DEFAULT ? 1 : 0;
        var ys = growthProductBucket_(y.alert.name) === GROWTH_PRODUCT_DEFAULT ? 1 : 0;
        if (xs !== ys) return ys - xs;
        return growthCents_(y.alert.amount) - growthCents_(x.alert.amount);
      })[0];

      var kept = Object.assign({}, primary.alert);
      kept.amount = total / 100;

      /* Members are the alerts that fed these line items, including the
         versions superseded inside their buckets — growthClassifyLatestSale_
         walks them for the earliest sold date and stExcluded_ walks them for
         approval-guard rulings. A standalone sale never sees the bundle's. */
      var liveBuckets = lineItems.map(function (m) {
        return growthProductBucket_(m.alert.name);
      });
      var mine = members.filter(function (m) {
        return liveBuckets.indexOf(growthProductBucket_(m.alert.name)) >= 0;
      });
      if (!mine.length) mine = lineItems;

      kept.growthRevisionCount = mine.length;
      kept.growthRevisionMembers = mine.map(function (m) { return m.alert; });
      kept.growthLineItemCount = lineItems.length;
      kept.growthLineItems = lineItems.map(function (m) {
        return {
          bucket: growthProductBucket_(m.alert.name),
          name: m.alert.name,
          estimateNumber: m.alert.estimateNumber,
          soldOnIso: m.alert.soldOnIso,
          seller: m.alert.unrostered ? (m.alert.soldByRaw || "(not on roster)") : m.alert.hca,
          unrostered: !!m.alert.unrostered,
          amount: growthCents_(m.alert.amount) / 100
        };
      });
      kept.growthJobCandidates = [];
      kept.growthOpportunityCandidates = [];
      mine.forEach(function (m) {
        var a = m.alert;
        if (a.jobNumber && kept.growthJobCandidates.indexOf(String(a.jobNumber)) < 0) {
          kept.growthJobCandidates.push(String(a.jobNumber));
        }
        if (a.opportunityNumber && kept.growthOpportunityCandidates.indexOf(String(a.opportunityNumber)) < 0) {
          kept.growthOpportunityCandidates.push(String(a.opportunityNumber));
        }
      });

      if (lineItems.length > 1) {
        bundledSales++;
        bundledDollars += (total - growthCents_(primary.alert.amount)) / 100;
      }
      lineItems.forEach(function (m) {
        if (m.alert.unrostered) {
          unrosteredBundled++;
          unrosteredDollars += growthCents_(m.alert.amount) / 100;
        }
      });
      out.push(kept);
    });
  });

  return {
    alerts: out,
    diagnostics: {
      rawAlerts: alerts.length,
      uniqueSales: out.length,
      revisedGroups: revisedGroups,
      supersededAlerts: alerts.length - out.length,
      bundledSales: bundledSales,
      bundledDollars: Math.round(bundledDollars * 100) / 100,
      combinedEstimatesDropped: combinedDropped,
      coSoldSplits: coSoldSplits,
      unrosteredGroupsDropped: unrosteredGroups,
      unrosteredLineItemsBundled: unrosteredBundled,
      unrosteredDollarsBundled: Math.round(unrosteredDollars * 100) / 100
    }
  };
}

/* ============================================================================
 * readSoldAlerts_  —  REPLACEMENT (2026-08-21)
 *
 * ONE CHANGE: an opt-in second argument. Called as readSoldAlerts_(days) it
 * behaves exactly as before — non-roster sellers are dropped at read time. All
 * 14 other call sites in this file pass one argument and are untouched.
 *
 * Called as readSoldAlerts_(days, true) it KEEPS non-roster alerts, tagged
 * unrostered:true with hca:"" and the raw name in soldByRaw. Only
 * sameDaySoldMonthData_ asks for this, and only so the collapse can see a
 * bundle whose halves were papered by different people.
 *
 * WHY. Ryan Schiebel and Kasey Watson, customer 407824308, opportunity
 * 407804785, job 407804783: a $15,482.54 Mitsubishi ductless sold 8/10 by
 * Davis Diosdado, and a $15,375.00 200A panel sold 8/7 by Jack Nichols, an
 * electrician. One job, one customer, one HCA sale. The old gate dropped the
 * panel here, before grouping, so no downstream logic could ever reunite them.
 *
 * A group with no roster seller in it still produces nothing — that filtering
 * moved into growthCollapseLatestSoldAlerts_, which drops any group and any
 * standalone line item that has no rostered member. The COD service traffic
 * that this flag now lets through is discarded there, not counted.
 * ========================================================================== */

function readSoldAlerts_(days, includeUnrostered) {
  const out = [];
  const res = searchAllThreads_(
    'from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' +
    Math.max(1, days) + "d", SOLD_ALERT_CEILING);
  if (!res.ok) {
    Logger.log("Sold alert search failed: " + res.error);
    return {
      ok: false, complete: false, alerts: out
    };
  }
  const threads = res.threads;
  threads.forEach(t => t.getMessages().forEach(msg => {
    const f = parseAlertFields_(msg.getPlainBody());
    const soldBy = f["sold by"] || "";
    const seller = soldSellerName_(soldBy);
    /* Default behaviour: a technician or trade seller is not counted, and the
       alert never leaves this function. With includeUnrostered the alert is
       kept and flagged, so a bundle can be reassembled before the roster test
       is applied to the GROUP rather than to each estimate. */
    if (!seller && !includeUnrostered) return;
    /* "7/30 8:15 AM" carries no year; the tracker needs a sortable date. */
    const md = String(f["date"] || "").match(/^(\d{1,2})\/(\d{1,2})/);
    out.push({
      hca: seller,
      unrostered: !seller,
      soldByRaw: soldBy,
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
    })
    ;
  })
  );
  if (!res.complete) {
    Logger.log("! Sold alert search hit its " + SOLD_ALERT_CEILING +
      "-thread ceiling — this is a PARTIAL read and every total from it is low.");
  }
  return {
    ok: true, complete: res.complete, alerts: out
  };
}


/* ============================================================================
 * sameDaySoldMonthData_  —  REPLACEMENT (2026-08-21)
 *
 * Byte-for-byte the live version except one call: readSoldAlerts_(40) becomes
 * readSoldAlerts_(40, true). Shipped as a whole function so there is nothing
 * to hunt for and nothing to hand-edit in a 15,862-line file.
 * ========================================================================== */

function sameDaySoldMonthData_() {
  var tz;
  try {
    tz = DAILY_RECAP_CONFIG.timeZone;
  }
  catch (e) {
    tz = "America/Los_Angeles";
  }
  var now = new Date();
  var fromIso = monthStartIso_();   // single source of truth (calendar-month 1st)
  var toIso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  /* Same reader as Sold Today: HCA-only, year-safe dates, real amount parse. */
  /* The only change: ask readSoldAlerts_ to keep non-roster sellers so a
     bundle whose halves were papered by different people can be reassembled.
     growthCollapseLatestSoldAlerts_ applies the roster test to the GROUP and
     discards anything with no HCA in it. */
  var res = readSoldAlerts_(40, true);
  if (!res.ok) return {
    ok: false, fromIso: fromIso, toIso: toIso, days: {
    },
    tz: tz
  };
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);
  var collapsed = collapse.alerts
    .filter(function (a) {
    return a.soldOnIso >= fromIso && a.soldOnIso <= toIso;
  })
  .filter(function (a) {
    /* honor the approval-guard rulings (phantom rentals / phantom CODs) */
    if (typeof stExcluded_ !== "function") return true;
    return !(a.growthRevisionMembers || [a]).some(function (member) {
      return stExcluded_(member);
    });
  })
  ;
  var mtdRevisedGroups = 0, mtdSupersededAlerts = 0;
  collapsed.forEach(function (alert) {
    var revisions = Number(alert.growthRevisionCount) || 1;
    if (revisions > 1) mtdRevisedGroups++;
    mtdSupersededAlerts += Math.max(0, revisions - 1);
  });
  var qualifying = [];
  var excluded = { count: 0, dollars: 0, amountCount: 0, sellerCount: 0 };
  collapsed.forEach(function (alert) {
    var decision = growthSoldQualification_(alert);
    if (decision.included) {
      qualifying.push(alert);
      return;
    }
    excluded.count++;
    excluded.dollars += decision.amount;
    if (decision.reason === "seller") excluded.sellerCount++;
    else excluded.amountCount++;
  });
  var booked = readBookedJobs_((typeof BOOKED_LOOKBACK_DAYS !== "undefined") ? BOOKED_LOOKBACK_DAYS : 60);
  var days = {
  };
  var unmatchedFollowUp = 0;
  qualifying.forEach(function (a) {
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var cls = growthClassifyLatestSale_(a, booked);
    var d = days[a.soldOnIso] = days[a.soldOnIso] || {
      total: 0, same: 0, follow: 0, unknown: 0, dollars: 0
    };
    d.total++;
    d.dollars += amt;
    if (cls.tag === "SAME-DAY") d.same++;
    else d.follow++;
    if (!cls.matched) unmatchedFollowUp++;
  })
  ;
  return {
    ok: true, complete: res.complete, fromIso: fromIso, toIso: toIso,
    days: days, tz: tz, includedCount: qualifying.length, excluded: excluded,
    dedupe: Object.assign({}, collapse.diagnostics, {
      mtdUniqueBeforeQualification: collapsed.length,
      mtdIncluded: qualifying.length,
      mtdRevisedGroups: mtdRevisedGroups,
      mtdSupersededAlerts: mtdSupersededAlerts
    }),
    unmatchedFollowUp: unmatchedFollowUp,
    qualification: "amount > $" + GROWTH_HVAC_SOLD_MIN_DOLLARS +
      " and seller in RECAP_ROSTER / approved manager sellers"
  };
}


/* ============================================================================
 * zzPreviewBundledSold  —  READ-ONLY VERIFIER (2026-08-21)
 *
 * Run this from the editor before letting anything repaint. It writes no cell,
 * creates no tab and sends no mail: it reads Gmail, runs the same collapse the
 * live path runs, and logs what it found. previewSameDaySold cannot do this —
 * it prints the day table only, and the collapse diagnostics never leave
 * sameDaySoldMonthData_.
 *
 * WHAT TO LOOK FOR
 *   unrosteredGroupsDropped     large once readSoldAlerts_(40, true) is live.
 *                               Still 0 means the one-line change at ~11156
 *                               did not take.
 *   unrosteredLineItemsBundled  should be SMALL — 1 expected, the Schiebel /
 *                               Watson 200A panel. If this is large, STOP:
 *                               tech-written add-ons are folding into HCA
 *                               sales and inflating the headline.
 *   bundledSales                4 expected for August.
 *   Every bundle is printed line by line, so each one can be eyeballed as a
 *   real bundle rather than a re-quote before any number is published.
 * ========================================================================== */

function zzPreviewBundledSold() {
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  var now = new Date();
  var fromIso = Utilities.formatDate(now, tz, "yyyy-MM") + "-01";
  var toIso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var money = function (n) {
    return "$" + (Math.round(Number(n) * 100) / 100).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  var out = [];

  /* ---- the day table and totals, straight off the live path ---- */
  var m = sameDaySoldMonthData_();
  if (!m.ok) {
    Logger.log("PREVIEW FAILED — sold-alert read did not succeed. Nothing changed.");
    return "read failed";
  }
  out.push("BUNDLED SOLD PREVIEW — nothing written. " + m.fromIso + " → " + m.toIso +
           (m.complete === false ? "   !! PARTIAL Gmail read, every total below is low" : ""));
  out.push("");
  var nTotal = 0, dTotal = 0;
  Object.keys(m.days).sort().forEach(function (iso) {
    var d = m.days[iso];
    nTotal += d.total;
    dTotal += d.dollars;
    out.push("  " + iso + "   total " + d.total + " · same-day " + d.same +
             " · follow-up " + d.follow + "   " + money(d.dollars));
  });
  out.push("  " + "-".repeat(56));
  out.push("  MTD   " + nTotal + " sales   " + money(dTotal));
  out.push("");

  var g = m.dedupe || {};
  out.push("DIAGNOSTICS");
  ["rawAlerts", "uniqueSales", "revisedGroups", "supersededAlerts",
   "bundledSales", "bundledDollars", "combinedEstimatesDropped",
   "unrosteredGroupsDropped", "unrosteredLineItemsBundled",
   "unrosteredDollarsBundled", "mtdUniqueBeforeQualification", "mtdIncluded",
   "mtdRevisedGroups", "mtdSupersededAlerts"].forEach(function (k) {
    if (g[k] !== undefined) out.push("  " + k + ": " + g[k]);
  });
  if (g.bundledSales === undefined) {
    out.push("  !! No bundling diagnostics. The OLD growthCollapseLatestSoldAlerts_");
    out.push("     is still the live definition — check for a second copy of it.");
  }
  if (g.unrosteredGroupsDropped === 0) {
    out.push("  !! unrosteredGroupsDropped is 0 — readSoldAlerts_(40, true) is");
    out.push("     probably not live at ~line 11156, so no non-roster half can");
    out.push("     rejoin its bundle.");
  }
  out.push("");

  /* ---- every bundle, line by line, so a human can judge each one ---- */
  var res = readSoldAlerts_(40, true);
  if (!res.ok) {
    out.push("Could not re-read alerts for the bundle detail; totals above still stand.");
    Logger.log(out.join("\n"));
    return out.join("\n");
  }
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);
  var bundles = (collapse.alerts || []).filter(function (a) {
    return (a.growthLineItemCount || 1) > 1 &&
           String(a.soldOnIso || "") >= fromIso && String(a.soldOnIso || "") <= toIso;
  }).sort(function (x, y) {
    return String(x.soldOnIso).localeCompare(String(y.soldOnIso));
  });

  out.push("BUNDLES THIS MONTH — " + bundles.length + " (each is ONE sale)");
  if (!bundles.length) {
    out.push("  none. If the collapse replacement is live, that is a red flag —");
    out.push("  August has four provable bundles.");
  }
  bundles.forEach(function (a) {
    out.push("");
    out.push("  " + a.soldOnIso + "   " + a.customer + "   " + a.hca +
             "   opp " + (a.opportunityNumber || "?") + "   TOTAL " + money(a.amount));
    (a.growthLineItems || []).forEach(function (li) {
      out.push("      " + (li.unrostered ? "[off-roster] " : "             ") +
               (li.bucket + "        ").slice(0, 12) + " " +
               (money(li.amount) + "           ").slice(0, 13) +
               li.soldOnIso + "  " + li.seller + "  est " + li.estimateNumber);
      out.push("                   " + String(li.name || "").slice(0, 78));
    });
  });

  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
/* ============================================================================
 * zzSupersessionAudit  —  READ-ONLY (2026-08-21)
 *
 * Finds the losses the bundling fix does NOT catch, and makes them visible.
 *
 * THE FAILURE IT LOOKS FOR. Product buckets are read off the estimate Name, and
 * "system" is the catch-all. Any accessory whose name matches none of the
 * bucket patterns lands in "system", collides with the actual equipment sale,
 * wins on recency, and takes the real number down with it. Two confirmed:
 *
 *   7/28  opp 407638256  Milo         $348.13 "Kumo cloud" superseded
 *                                     $12,325.60 Mitsubishi 2-zone.
 *   8/12  opp 408901659  Chounramany  $981.00 "Duct cleaning" superseded
 *                                     $2,865.13 "Ductwork Revision return air".
 *
 * Both predate the fix — neither is a regression — and neither is reachable by
 * adding more regex, because the next one will have a name nobody guessed.
 * So this does not try to decide. It reports, and a human judges.
 *
 * It calls growthCollapseLatestSoldAlerts_ rather than re-deriving the groups,
 * so it can never drift from what the live path actually does.
 *
 * THREE CLASSES
 *   RENTAL  the survivor is nominal — under $1 by the file's own stIsNominal_.
 *           That is not a loss. A Comfort Club rental is booked as DEFERRED
 *           REVENUE, so ServiceTitan writes $0.00 or a $0.01 placeholder (see
 *           the comment at readSoldAlerts_'s rental sweep, and RENTAL_MAX_
 *           DOLLARS = 1). James Haberman DDS is the worked example and is
 *           already documented by name in MONDAY_GROWTH_NOTE: Comfort Club at
 *           $464.99/mo, $44,639 over eight years, showing $0 in revenue on
 *           purpose. Listed so it can be seen, never as a defect.
 *   SEVERE  the survivor carries real money but still falls under the $2,000
 *           gate, while something it superseded was over it — a sale that is
 *           genuinely invisible on the tab.
 *   WATCH   the survivor is under half of what it superseded. Usually a real
 *           downgrade, occasionally an accessory that ate its own system.
 *
 * A combined estimate that was re-papered into exactly these line items is
 * skipped: its amount equals the record total to the cent, which is what makes
 * it a predecessor rather than a loss. Laura Richmond 8/13 is the case.
 *
 * USAGE  zzSupersessionAudit()          last 40 days
 *        zzSupersessionAudit(120)       last 120 days
 *        zzSupersessionAudit(120, 0.75) same, flag anything under 75%
 * ========================================================================== */

function zzSupersessionAudit(days, watchRatio) {
  days = Number(days) || 40;
  watchRatio = (watchRatio === undefined || watchRatio === null) ? 0.5 : Number(watchRatio);
  var floor = (typeof GROWTH_HVAC_SOLD_MIN_DOLLARS !== "undefined")
    ? GROWTH_HVAC_SOLD_MIN_DOLLARS : 2000;
  var money = function (n) {
    return "$" + (Math.round(Number(n) * 100) / 100).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  function r_opp(r) { return String(r.opp || r.cust || "?"); }

  var res = readSoldAlerts_(days, true);
  if (!res.ok) { Logger.log("SUPERSESSION AUDIT — alert read failed."); return "read failed"; }
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);

  var isNominal = (typeof stIsNominal_ === "function")
    ? stIsNominal_
    : function (v) {
        return v === null || v === undefined || String(v).trim() === "" ||
               !isFinite(Number(v)) || Number(v) < 1;
      };
  var severe = [], watch = [], rental = [], scanned = 0;
  var seen = {};
  (collapse.alerts || []).forEach(function (a) {
    scanned++;
    var total = Number(a.amount) || 0;
    var kept = {};
    (a.growthLineItems || []).forEach(function (li) { kept[li.bucket] = li; });

    (a.growthRevisionMembers || []).forEach(function (m) {
      var b = growthProductBucket_(m.name);
      var k = kept[b];
      if (!k) return;
      var mc = growthCents_(m.amount), kc = growthCents_(k.amount);
      /* the survivor itself, or an identical re-paper of it */
      if (String(m.estimateNumber) === String(k.estimateNumber) && mc === kc) return;
      /* a COMBINED estimate re-papered into exactly these line items: its
         amount is the record total to the cent. A predecessor, not a loss. */
      if (mc === growthCents_(total)) return;
      if (mc <= kc) return;
      if (mc < growthCents_(floor)) return;

      var row = {
        iso: a.soldOnIso, cust: a.customer, hca: a.hca,
        opp: a.opportunityNumber, bucket: b,
        lostName: m.name, lostEst: m.estimateNumber, lostAmt: Number(m.amount) || 0,
        keptName: k.name, keptEst: k.estimateNumber, keptAmt: Number(k.amount) || 0,
        total: total
      };
      /* One row per (opportunity, lost estimate, kept estimate). The Gmail
         read can hand back the same message twice when threads overlap, which
         double-counts nothing in the totals but would print twice here. */
      var dedupe = String(r_opp(row)) + "|" + row.lostEst + "|" + row.keptEst;
      if (seen[dedupe]) return;
      seen[dedupe] = true;

      if (isNominal(k.amount)) rental.push(row);
      else if (growthCents_(total) < growthCents_(floor)) severe.push(row);
      else if (kc < mc * watchRatio) watch.push(row);
    });
  });

  var out = [];
  out.push("SUPERSESSION AUDIT — nothing written.  last " + days + " days" +
           (res.complete === false ? "   !! PARTIAL Gmail read" : ""));
  out.push("  " + scanned + " collapsed sales scanned · gate " + money(floor) +
           " · watch ratio " + Math.round(watchRatio * 100) + "%");
  out.push("");

  function render(title, rows, note) {
    out.push(title + " — " + rows.length);
    out.push("  " + note);
    rows.sort(function (x, y) { return y.lostAmt - x.lostAmt; });
    rows.forEach(function (r) {
      out.push("");
      out.push("  " + r.iso + "   " + r.cust + "   " + r.hca + "   opp " + (r.opp || "?"));
      out.push("      LOST  " + money(r.lostAmt) + "   [" + r.bucket + "]  est " +
               r.lostEst + "   " + String(r.lostName || "").slice(0, 66));
      out.push("      KEPT  " + money(r.keptAmt) + "   [" + r.bucket + "]  est " +
               r.keptEst + "   " + String(r.keptName || "").slice(0, 66));
      var mo = (typeof rentalMonthlyFromName_ === "function")
        ? rentalMonthlyFromName_(r.keptName) : 0;
      out.push("      sale now totals " + money(r.total) +
               (mo ? "   (" + money(mo) + "/mo recurring)" : ""));
    });
    out.push("");
  }

  render("SEVERE", severe,
         "the whole sale is missing from the tab — survivor fell under the gate");
  render("WATCH", watch,
         "usually a real downgrade; check for an accessory that ate its system");
  render("RENTAL — not a defect", rental,
         "survivor is nominal, so this is deferred revenue, not a lost sale");

  if (!severe.length && !watch.length && !rental.length) {
    out.push("Nothing flagged. Every collapsed sale kept its largest line item.");
  }
  out.push("Nothing here is fixed automatically. Each one is a judgement about");
  out.push("whether two estimates are one sale or two, which the alert body");
  out.push("does not carry — it has no department, business unit or trade.");

  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
/* ============================================================================
 * readBiLeads_  —  REPLACEMENT (2026-08-21)
 *
 * WHAT WAS WRONG. This read one hardcoded file: BI_LEADS_SHEET_ID at line 63,
 * which is "All Leads MTD July 2026.xlsx", last modified 2026-08-03. Its only
 * caller is writeJobStatus_ (line 12756), which fills the Job Status sheet's
 * BI Rep / BI Lead Type / BI Job Status columns. So for eighteen days those
 * columns have been attributing AUGUST jobs from a JULY lead export — matching
 * nothing, or worse, matching a stale row for a repeat customer.
 *
 * WHAT IT DOES NOW. Asks gaResolveUploads_(["leads"]) first — the v2 builder's
 * resolver, which reads the Daily Uploads folder and identifies files by COLUMN
 * HEADER SIGNATURE rather than filename. That module already exists (line 13733)
 * and its own comment says why the filename approach was abandoned: "it globbed
 * all of Drive and had eleven 'All Leads' candidates to guess between, resolving
 * by Drive's modified timestamp — so re-uploading an old file would silently
 * make it 'newest'." Nothing was ever rewired to it. This rewires it.
 *
 * BI_LEADS_SHEET_ID stays as the fallback, so if the uploads folder is empty or
 * the Drive API service is not enabled, behaviour is exactly what it is today.
 *
 * The return shape is unchanged — byJob, byCustomerDate, rows — so biLookup_
 * and writeJobStatus_ need no edit. Two fields are ADDED, source and updated,
 * purely so the log can say which file the attribution actually came from.
 * Silent staleness is what caused this; a named source is the cure.
 * ========================================================================== */

/* ============================================================================
 * readBiLeads_  —  REPLACEMENT (2026-08-21)
 *
 * WHAT WAS WRONG. This read one hardcoded file: BI_LEADS_SHEET_ID at line 63,
 * which is "All Leads MTD July 2026.xlsx", last modified 2026-08-03. Its only
 * caller is writeJobStatus_ (line 12756), which fills the Job Status sheet's
 * BI Rep / BI Lead Type / BI Job Status columns. So for eighteen days those
 * columns have been attributing AUGUST jobs from a JULY lead export — matching
 * nothing, or worse, matching a stale row for a repeat customer.
 *
 * WHAT IT DOES NOW. Asks gaResolveUploads_(["leads"]) first — the v2 builder's
 * resolver, which reads the Daily Uploads folder and identifies files by COLUMN
 * HEADER SIGNATURE rather than filename. That module already exists (line 13733)
 * and its own comment says why the filename approach was abandoned: "it globbed
 * all of Drive and had eleven 'All Leads' candidates to guess between, resolving
 * by Drive's modified timestamp — so re-uploading an old file would silently
 * make it 'newest'." Nothing was ever rewired to it. This rewires it.
 *
 * BI_LEADS_SHEET_ID stays as the fallback, so if the uploads folder is empty or
 * the Drive API service is not enabled, behaviour is exactly what it is today.
 *
 * The return shape is unchanged — byJob, byCustomerDate, rows — so biLookup_
 * and writeJobStatus_ need no edit. Two fields are ADDED, source and updated,
 * purely so the log can say which file the attribution actually came from.
 * Silent staleness is what caused this; a named source is the cure.
 * ========================================================================== */

function readBiLeads_() {
  const out = { byJob: {}, byCustomerDate: {}, rows: 0, source: "", updated: "" };
  let temp = "";
  let grid = null;

  /* ---- PREFERRED: the v2 resolver, header-signature matched ---- */
  try {
    if (typeof gaResolveUploads_ === "function") {
      const res = gaResolveUploads_(["leads"]);
      const f = res && res.found && res.found.leads;
      if (f && f.values && f.values.length > 1) {
        grid = f.values;
        out.source = f.title + "  [" + (f.where || "uploads folder") + "]";
        out.updated = f.updated ? String(f.updated).slice(0, 10) : "";
      }
    }
  } catch (err) {
    Logger.log("BI leads: v2 resolver unavailable (" +
      (err && err.message ? err.message : String(err)) + ") — trying the pinned file.");
  }

  /* ---- FALLBACK: the pinned file, exactly as before ---- */
  if (!grid) {
    if (!BI_LEADS_SHEET_ID) {
      Logger.log("BI leads: no uploads-folder leads export and no BI_LEADS_SHEET_ID. " +
        "Job Status will be built without BI columns.");
      return out;
    }
    try {
      const opened = openBiLeadsBook_(BI_LEADS_SHEET_ID);
      const ss = opened.ss;
      temp = opened.tempId;
      const sheet = BI_LEADS_TAB ? ss.getSheetByName(BI_LEADS_TAB) : ss.getSheets()[0];
      if (!sheet || sheet.getLastRow() < 2) {
        trashBiTemp_(temp);
        return out;
      }
      grid = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      out.source = "BI_LEADS_SHEET_ID (pinned file — the uploads folder had no leads export)";
    } catch (err) {
      Logger.log("BI leads lookup unavailable, Job Status built without it: " +
        (err && err.message ? err.message : String(err)));
      trashBiTemp_(temp);
      return out;
    }
  }

  /* ---- Build the lookup. Column detection and record shape are unchanged. ---- */
  try {
    const head = {};
    grid[0].forEach((h, i) => {
      head[String(h || "").trim().toLowerCase()] = i;
    });
    const col = (...names) => {
      for (let i = 0; i < names.length; i++) if (names[i] in head) return head[names[i]];
      return -1;
    };
    const cJob = col("job.number", "jobnumber", "job number");
    const cRep = col("techname", "tech name", "soldbyname");
    const cType = col("lead type", "leadtype");
    const cCust = col("customer.name", "customer");
    const cAppt = col("lastapptdate", "appointment date", "est");
    const cStat = col("jobstatus", "job status");
    if (cJob === -1 && cCust === -1) {
      Logger.log("BI leads: " + (out.source || "source") +
        " has neither a job number nor a customer column — lookup skipped.");
      trashBiTemp_(temp);
      return out;
    }
    const iso = v => v instanceof Date
      ? Utilities.formatDate(v, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd")
      : String(v || "").trim().slice(0, 10);

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      const rec = {
        rep: cRep === -1 ? "" : String(row[cRep] || "").replace(/\s+/g, " ").trim(),
        leadType: cType === -1 ? "" : String(row[cType] || "").trim(),
        jobStatus: cStat === -1 ? "" : String(row[cStat] || "").trim(),
        customer: cCust === -1 ? "" : String(row[cCust] || "").trim(),
        apptIso: cAppt === -1 ? "" : iso(row[cAppt])
      };
      if (!rec.rep && !rec.leadType && !rec.jobStatus) continue;
      const job = cJob === -1 ? "" : String(row[cJob] || "").trim();
      if (job) out.byJob[job] = rec;
      if (rec.customer) {
        out.byCustomerDate[normName_(rec.customer)] = rec;
        if (rec.apptIso) out.byCustomerDate[normName_(rec.customer) + "|" + rec.apptIso] = rec;
      }
      out.rows++;
    }
  } catch (err) {
    Logger.log("BI leads parse failed, Job Status built without it: " +
      (err && err.message ? err.message : String(err)));
    trashBiTemp_(temp);
    return out;
  }

  trashBiTemp_(temp);
  Logger.log("BI leads: " + out.rows + " row(s) from " + (out.source || "unknown source") +
    (out.updated ? "  (updated " + out.updated + ")" : ""));
  return out;
}
/* ============================================================================
 * zzSoldBySource  —  READ-ONLY (2026-08-21)
 *
 * The L2C tab's by-source block (row 28: Source · Leads · Installs · L2C %)
 * has no SOLD column. Leads and installs break out Marketed / Tech Flip /
 * Self Gen; sold does not, so there is no close rate by source anywhere.
 *
 * This adds it, read-only, reusing what already exists:
 *   growthCollapseLatestSoldAlerts_  the same 61 MTD sales the tab publishes
 *   growthSoldQualification_         the same $2,000 + roster gate
 *   gaResolveUploads_                the header-signature upload resolver
 *   gaBucket_                        Lead Type -> mkt / tech / sg
 *
 * THREE SOURCES, NOT ONE. Attributing from All Leads alone left 26 of 61 sales
 * unattributed — 42.6%, measured. None of the 26 were in that export at all,
 * by job or by name: their leads predate the one-month window. But 17 of them
 * sit in All Installs and several more in the Backlog Pipeline, both of which
 * carry a Lead Type column. So all three are indexed, in precedence order:
 *
 *   1 leads     most authoritative — it IS the lead record
 *   2 installs  the same job after it installed, Lead Type preserved
 *   3 pipeline  sold and scheduled, not yet installed
 *
 * The source that answered is printed per sale, so a Tech Flip attributed off
 * the pipeline can be told apart from one read straight off the lead row.
 *
 * WHY THE JOB NUMBER IS NOT ENOUGH. A Sold Estimate Alert carries the QUOTE
 * job number; the install and pipeline rows carry the INSTALL job number, and
 * they are different jobs. Ryan Schiebel and Kasey Watson: sold alert Job#
 * 407804783, pipeline jobNumber 409427884, same sale. So biLookup_'s customer
 * fallback does most of the work here, and that is deliberate.
 *
 * UNATTRIBUTED IS A REAL ANSWER, NOT A FAILURE. The leads export is scoped to
 * one month — its own footer says "Date is on or after 8/1/2026 and is before
 * 8/22/2026". An August sale from a July lead has no row to match, and there
 * are several: Greg Anderson, Haberman, Schiebel/Watson. Those are reported as
 * Unattributed and listed by name. A percentage computed as though they did not
 * exist would be worse than one that admits the gap.
 *
 * SURNAME FALLBACK. "Sam and Barb Bateman" in the pipeline is "Sam Bateman" on
 * the sold alert. Exact normalised match is tried first; only if that fails does
 * it try the surname, and only when exactly ONE record in the whole index
 * carries it. Those are labelled "surname" so a wrong one is visible rather
 * than silently folded into a percentage.
 * ========================================================================== */

function zzSoldBySource(days) {
  days = Number(days) || 40;
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  var now = new Date();
  var fromIso = Utilities.formatDate(now, tz, "yyyy-MM") + "-01";
  var toIso = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var money = function (n) {
    return "$" + (Math.round(Number(n) * 100) / 100).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  var res = readSoldAlerts_(days, true);
  if (!res.ok) { Logger.log("SOLD BY SOURCE — alert read failed."); return "read failed"; }
  var collapse = growthCollapseLatestSoldAlerts_(res.alerts);

  /* Same MTD window, same approval guard, same qualification gate that
     sameDaySoldMonthData_ applies, so this counts the published 61. */
  var mtd = (collapse.alerts || []).filter(function (a) {
    return a.soldOnIso >= fromIso && a.soldOnIso <= toIso;
  }).filter(function (a) {
    if (typeof stExcluded_ !== "function") return true;
    return !(a.growthRevisionMembers || [a]).some(function (m) { return stExcluded_(m); });
  }).filter(function (a) {
    return growthSoldQualification_(a).included;
  });

  /* ---- Index all three uploads by job number and by customer ---- */
  var idx = { byJob: {}, byName: {}, bySurname: {}, sources: {}, ambiguous: {} };
  var order = ["leads", "installs", "pipeline"];
  try {
    var up = gaResolveUploads_(order);
    order.forEach(function (kind) {
      var f = up && up.found && up.found[kind];
      if (!f || !f.values || f.values.length < 2) return;
      var grid = f.values;
      var head = {};
      grid[0].forEach(function (h, i) { head[String(h || "").trim().toLowerCase()] = i; });
      function col() {
        for (var i = 0; i < arguments.length; i++) {
          if (arguments[i] in head) return head[arguments[i]];
        }
        return -1;
      }
      var cType = col("lead type", "leadtype");
      var cCust = col("customer.name", "customer");
      var cJob  = col("job.number", "jobnumber", "job number");
      if (cType === -1 || cCust === -1) return;
      idx.sources[kind] = f.title + " (" + (grid.length - 1) + " rows)";
      for (var r = 1; r < grid.length; r++) {
        var lt = String(grid[r][cType] || "").trim();
        if (!lt) continue;
        var cu = String(grid[r][cCust] || "").trim();
        if (!cu) continue;
        var rec = { leadType: lt, kind: kind, customer: cu };
        var nm = normName_(cu);
        if (nm && !idx.byName[nm]) idx.byName[nm] = rec;
        var parts = nm.split(" ").filter(function (t) { return t.length > 2 && !/^\d+$/.test(t); });
        var sn = parts.length ? parts[parts.length - 1] : "";
        if (sn) {
          if (idx.bySurname[sn] && normName_(idx.bySurname[sn].customer) !== nm) idx.ambiguous[sn] = true;
          else if (!idx.bySurname[sn]) idx.bySurname[sn] = rec;
        }
        var jb = cJob === -1 ? "" : String(grid[r][cJob] || "").trim();
        if (jb && !idx.byJob[jb]) idx.byJob[jb] = rec;
      }
    });
  } catch (err) {
    Logger.log("Upload resolver unavailable (" +
      (err && err.message ? err.message : String(err)) + ") — attribution will be empty.");
  }

  function attribute(a) {
    var jobs = [a.jobNumber].concat(a.growthJobCandidates || []);
    for (var i = 0; i < jobs.length; i++) {
      var j = String(jobs[i] || "").trim();
      if (j && idx.byJob[j]) return { rec: idx.byJob[j], how: "job" };
    }
    var nm = normName_(a.customer);
    if (nm && idx.byName[nm]) return { rec: idx.byName[nm], how: "name" };
    var parts = nm.split(" ").filter(function (t) { return t.length > 2 && !/^\d+$/.test(t); });
    var sn = parts.length ? parts[parts.length - 1] : "";
    if (sn && idx.bySurname[sn] && !idx.ambiguous[sn]) {
      return { rec: idx.bySurname[sn], how: "surname" };
    }
    return null;
  }

  var LABEL = { mkt: "Marketed (Inbound + Webform)", tech: "Tech Flip", sg: "Self Gen" };
  var tally = { mkt: { n: 0, $: 0 }, tech: { n: 0, $: 0 }, sg: { n: 0, $: 0 },
                unattributed: { n: 0, $: 0 } };
  var viaKind = { leads: 0, installs: 0, pipeline: 0 };
  var viaHow = { job: 0, name: 0, surname: 0 };
  var orphans = [];

  mtd.forEach(function (a) {
    var hit = attribute(a);
    var b = hit ? gaBucket_(hit.rec.leadType) : "";
    var amt = Number(a.amount) || 0;
    if (b && tally[b]) {
      tally[b].n++; tally[b].$ += amt;
      viaKind[hit.rec.kind] = (viaKind[hit.rec.kind] || 0) + 1;
      viaHow[hit.how] = (viaHow[hit.how] || 0) + 1;
    } else {
      tally.unattributed.n++; tally.unattributed.$ += amt;
      orphans.push({ iso: a.soldOnIso, cust: a.customer, hca: a.hca,
                     job: a.jobNumber, opp: a.opportunityNumber, amt: amt,
                     why: hit ? ("Lead Type '" + hit.rec.leadType + "' not bucketable")
                              : "in none of leads / installs / pipeline" });
    }
  });

  var out = [];
  out.push("SOLD BY SOURCE — nothing written.  " + fromIso + " → " + toIso +
           (res.complete === false ? "   !! PARTIAL Gmail read" : ""));
  ["leads", "installs", "pipeline"].forEach(function (k) {
    out.push("  " + pad(k, 10) + (idx.sources[k] || "NOT RESOLVED"));
  });
  if (!Object.keys(idx.sources).length) {
    out.push("  !! No uploads resolved. Every sale below will read Unattributed.");
  }
  out.push("");
  out.push("  " + pad("Source", 30) + pad("Sold", 7) + pad("$ Sold", 16) + "share");
  var total = mtd.length, dollars = 0;
  mtd.forEach(function (a) { dollars += Number(a.amount) || 0; });
  ["mkt", "tech", "sg", "unattributed"].forEach(function (k) {
    var t = tally[k];
    var name = LABEL[k] || "Unattributed";
    out.push("  " + pad(name, 30) + pad(String(t.n), 7) + pad(money(t.$), 16) +
             (total ? (Math.round(t.n / total * 1000) / 10) + "%" : "—"));
  });
  out.push("  " + "-".repeat(60));
  out.push("  " + pad("Total", 30) + pad(String(total), 7) + pad(money(dollars), 16));
  out.push("");

  if (orphans.length) {
    out.push("UNATTRIBUTED — " + orphans.length + " sale(s), " +
             money(tally.unattributed.$) + ". Most are August sales from July leads;");
    out.push("the leads export is scoped to one month, so there is no row to match.");
    orphans.sort(function (x, y) { return y.amt - x.amt; }).forEach(function (o) {
      out.push("  " + o.iso + "  " + pad(String(o.cust).slice(0, 30), 32) +
               pad(money(o.amt), 14) + pad(o.hca, 18) +
               "job " + (o.job || "?") + " · opp " + (o.opp || "?") + " · " + o.why);
    });
    out.push("");
  }
  out.push("Attributed via:  job " + viaHow.job + " · customer name " + viaHow.name +
           " · surname " + viaHow.surname);
  out.push("Answered by:     leads " + viaKind.leads + " · installs " + viaKind.installs +
           " · pipeline " + viaKind.pipeline);
  out.push("");
  out.push("A sale attributes to the source of the LEAD that produced it. Anything");
  out.push("still unattributed had no row in any of the three exports — its lead");
  out.push("predates the window and it has neither installed nor been scheduled.");
  out.push("Closing that needs a wider export, not a change here.");

  function pad(s, n) { s = String(s == null ? "" : s); return s + " ".repeat(Math.max(1, n - s.length)); }

  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}
/* ============================================================================
 * zzSoldWatch  —  sale sentinel (2026-08-21)
 *
 * Apps Script has no "new Gmail message" trigger. The only way to react to a
 * sale is to poll — so the point of this is to poll CHEAPLY and do the
 * expensive thing only when something actually changed.
 *
 * refreshSameDaySoldTab takes 65-75 seconds: readSoldAlerts_ walks a 40-day
 * Gmail window calling getMessages() and parseAlertFields_(getPlainBody()) on
 * every thread. Running that hourly costs ~28 minutes a day to catch maybe
 * four events. This runs a bare search over a 2-day window, reads thread
 * metadata only — no bodies — and exits in a couple of seconds when nothing
 * has moved.
 *
 * THE FINGERPRINT IS NOT THE NEWEST THREAD ID. Sold alerts bundle: one Gmail
 * thread routinely carries five of them. A new alert landing in an existing
 * thread does not change that thread's id, so an id-based fingerprint would
 * sleep through most sales. This uses thread count + total MESSAGE count +
 * the newest last-message timestamp, all of which move when an alert arrives
 * either way.
 *
 * SELF-HEALING. If the fingerprint has not been refreshed in STALE_MINUTES it
 * refreshes regardless. So a Gmail hiccup, a quota trip or a missed tick costs
 * you one late refresh, not a tab that quietly stops updating — which is the
 * failure mode that would make this worse than the hourly trigger it replaces.
 *
 * IT DOES NOT STORE A FINGERPRINT IT DID NOT EARN. refreshSameDaySoldTab
 * declines on a failed or partial Gmail read and preserves the previous table.
 * If that happens the fingerprint is left alone so the next tick tries again.
 *
 * refreshDailyGrowth is NOT called. It writes formulas, not values
 * (=IFERROR(INDEX(...)) at lines 9873-9876), so the Daily panel follows the
 * Same-Day Sold tab on its own the moment the tab changes.
 *
 * INSTALL   installSoldWatch()    every 10 min, and removes the hourly
 *                                 refreshSameDaySoldTab trigger it supersedes
 * REMOVE    removeSoldWatch()     deletes the watcher, restores the hourly
 * ========================================================================== */

var SOLD_WATCH = {
  everyMinutes: 10,      /* 1, 5, 10, 15 or 30 — Apps Script allows no others */
  windowDays: 2,         /* Gmail search window. Small on purpose: this is a
                            change detector, not a reader. */
  ceiling: 60,           /* threads to look at; 2 days never approaches this */
  staleMinutes: 90,      /* force a refresh if it has been longer than this */
  fromHour: 6,           /* Pacific. Outside this the sentinel returns at once */
  toHour: 20             /* rather than burning 100+ no-op ticks overnight */
};
var SOLD_WATCH_FP_PROP = "ZZ_SOLD_WATCH_FP";
var SOLD_WATCH_AT_PROP = "ZZ_SOLD_WATCH_AT";

function zzSoldWatch() {
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  var now = new Date();
  var hour = Number(Utilities.formatDate(now, tz, "H"));
  if (hour < SOLD_WATCH.fromHour || hour > SOLD_WATCH.toHour) {
    return "outside watch hours";
  }

  var props = PropertiesService.getScriptProperties();
  var q = 'from:alerts@servicetitan.com subject:"Sold Estimate Alert" newer_than:' +
          Math.max(1, SOLD_WATCH.windowDays) + "d";

  var threads;
  try {
    threads = GmailApp.search(q, 0, SOLD_WATCH.ceiling);
  } catch (err) {
    Logger.log("sold watch: Gmail search failed (" +
      (err && err.message ? err.message : String(err)) + ") — retrying next tick.");
    return "search failed";
  }

  /* Metadata only. No getMessages(), no getPlainBody() — that is the whole
     reason this is cheap. */
  var msgs = 0, newest = 0;
  threads.forEach(function (t) {
    msgs += t.getMessageCount();
    var d = t.getLastMessageDate();
    var ms = (d && d.getTime) ? d.getTime() : 0;
    if (ms > newest) newest = ms;
  });
  var fp = threads.length + "|" + msgs + "|" + newest;

  var stored = props.getProperty(SOLD_WATCH_FP_PROP) || "";
  var at = Number(props.getProperty(SOLD_WATCH_AT_PROP) || 0);
  var ageMin = at ? (now.getTime() - at) / 60000 : 1e9;

  if (fp === stored && ageMin < SOLD_WATCH.staleMinutes) {
    Logger.log("sold watch: no change — " + msgs + " alert(s) in " + threads.length +
      " thread(s), last refresh " + Math.round(ageMin) + " min ago. Nothing run.");
    return "no change";
  }

  var why = (fp !== stored)
    ? "new sold alert (" + stored + " -> " + fp + ")"
    : "heartbeat, " + Math.round(ageMin) + " min since last refresh";
  Logger.log("sold watch: " + why + " — refreshing Same-Day Sold.");

  var result;
  try {
    result = String(refreshSameDaySoldTab() || "");
  } catch (err) {
    Logger.log("sold watch: refresh threw (" +
      (err && err.message ? err.message : String(err)) +
      ") — fingerprint NOT stored, will retry next tick.");
    return "refresh failed";
  }

  /* Only a real repaint earns a fingerprint. A declined refresh keeps the old
     one so the next tick tries again instead of going quiet for 90 minutes. */
  if (result.indexOf("Same-Day Sold tab updated") !== 0) {
    Logger.log("sold watch: refresh declined (" + result +
      ") — fingerprint NOT stored, will retry next tick.");
    return result;
  }

  props.setProperty(SOLD_WATCH_FP_PROP, fp);
  props.setProperty(SOLD_WATCH_AT_PROP, String(now.getTime()));
  Logger.log("sold watch: " + result);
  return result;
}

/* Read-only. Says what it would do and what is currently installed. */
function previewSoldWatch() {
  var out = [];
  var trg = ScriptApp.getProjectTriggers();
  var watch = trg.filter(function (t) { return t.getHandlerFunction() === "zzSoldWatch"; });
  var hourly = trg.filter(function (t) { return t.getHandlerFunction() === "refreshSameDaySoldTab"; });
  var props = PropertiesService.getScriptProperties();
  out.push("SOLD WATCH — preview, nothing changed.");
  out.push("  zzSoldWatch triggers installed          : " + watch.length);
  out.push("  refreshSameDaySoldTab triggers installed: " + hourly.length);
  out.push("  stored fingerprint : " + (props.getProperty(SOLD_WATCH_FP_PROP) || "(none)"));
  var at = Number(props.getProperty(SOLD_WATCH_AT_PROP) || 0);
  out.push("  last refresh       : " + (at ? new Date(at) : "(never)"));
  out.push("  total project triggers: " + trg.length + " of 20 allowed");
  out.push("");
  out.push("installSoldWatch() would add one " + SOLD_WATCH.everyMinutes +
           "-minute trigger and delete " + hourly.length + " hourly refreshSameDaySoldTab trigger(s).");
  var msg = out.join("\n");
  Logger.log(msg);
  return msg;
}

function installSoldWatch() {
  var removed = 0, killedWatch = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === "zzSoldWatch") { ScriptApp.deleteTrigger(t); killedWatch++; }
    /* The watcher supersedes the hourly full refresh. Leaving both installed
       would cost more than doing nothing. */
    if (h === "refreshSameDaySoldTab") { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger("zzSoldWatch").timeBased()
    .everyMinutes(SOLD_WATCH.everyMinutes).create();
  var msg = "sold watch installed — every " + SOLD_WATCH.everyMinutes + " min, " +
    SOLD_WATCH.fromHour + ":00-" + SOLD_WATCH.toHour + ":00 Pacific. Replaced " +
    killedWatch + " old watcher(s) and removed " + removed +
    " hourly refreshSameDaySoldTab trigger(s). removeSoldWatch() reverses this.";
  Logger.log(msg);
  return msg;
}

function removeSoldWatch() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "zzSoldWatch") { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger("refreshSameDaySoldTab").timeBased().everyHours(1).create();
  var msg = "sold watch removed (" + removed +
    " trigger(s)) and the hourly refreshSameDaySoldTab trigger restored.";
  Logger.log(msg);
  return msg;
}
/* ============================================================================
 * zzSelfTest  —  DAILY CANARY, TRIGGER SELF-HEAL, LAST-KNOWN-GOOD (2026-08-21)
 *
 * WHAT THIS DEFENDS AGAINST. Apps Script shares one global scope and the
 * LAST definition to load wins, silently. This file already proves it:
 * readGrowthDaysRaw_ is defined twice, at 3194 and 15804, because a comment
 * said "REPLACE LINES 3189-3222" and nobody did. If another session appends a
 * third growthCollapseLatestSoldAlerts_, nothing errors — the numbers just
 * quietly become someone else's numbers.
 *
 * WHY THE TEST IS BEHAVIOURAL, NOT TEXTUAL. Apps Script cannot read its own
 * source without the Apps Script API and a script.projects OAuth scope, so a
 * function that counts its own definitions is not available. Instead this runs
 * TEN REAL AUGUST SALE GROUPS through whatever growthCollapseLatestSoldAlerts_
 * is currently loaded and asserts the exact dates and cents that were verified
 * against the published sheet on 2026-08-21. Every one of the ten is a case
 * that was checked by hand. If someone replaces the collapse, these fail — no
 * matter how it got replaced.
 *
 * WHAT SELF-HEALS AND WHAT DOES NOT. Be clear about this:
 *
 *   TRIGGERS      heal automatically. The script owns them and can rewrite
 *                 them. A missing sold watch is recreated, duplicates are
 *                 pruned, a resurrected hourly refreshSameDaySoldTab is
 *                 deleted. This is real repair.
 *   TABS / PANEL  already self-heal. refreshSameDaySoldTab rebuilds the tab
 *                 from Gmail every run and the Daily panel cells are
 *                 =IFERROR(INDEX(...)) formulas that follow it. Corrupt the
 *                 tab and the next run fixes it.
 *   SOURCE CODE   does NOT self-heal, deliberately. Restoring code needs the
 *                 Apps Script API and a script that can rewrite itself on a
 *                 timer is a worse hazard than the one it guards against —
 *                 one bad automated write and there is nothing left to
 *                 restore from. LAST KNOWN GOOD FOR CODE IS THE DATED BACKUP
 *                 PROJECT, restored by hand. What this gives you instead is
 *                 an unambiguous alarm naming exactly which rule broke, so
 *                 the manual restore is a two-minute job with a known target.
 *
 * LAST KNOWN GOOD, for numbers, is a high-water mark in Script Properties:
 * the MTD sold count and dollars from the last fully passing run. Within one
 * calendar month those only ever go up. A DECREASE is the signature of the
 * collapse regressing, so it raises a WARN with the delta — and the high-water
 * mark is deliberately NOT lowered, so it keeps complaining every day until it
 * recovers or you acknowledge it with zzSelfTestAcceptCurrent().
 *
 * VERSION DRIFT. installSelfTest() stamps the current GROWTH_FIX_VERSION into
 * Script Properties. Each run compares the loaded constant against the stamp.
 * If another session ships a block carrying a different version, that mismatch
 * is a FAIL on its own, before any fixture runs.
 *
 * INSTALL    installSelfTest()          one daily trigger, 05:00 Pacific
 * REMOVE     removeSelfTest()
 * RUN NOW    zzSelfTest()               logs, sends no mail. NOT read-only:
 *                                       it repairs triggers and, on a clean
 *                                       pass, writes the high-water mark. It
 *                                       writes no sheet cell and creates no
 *                                       tab. Set SELF_TEST.repairTriggers
 *                                       false for a look-but-touch-nothing run.
 * INSPECT    zzSelfTestBaseline()       genuinely read-only, prints stored state
 * ACCEPT     zzSelfTestAcceptCurrent()  re-stamp version + reset high-water
 *                                       mark. Run this AFTER a change you
 *                                       made on purpose.
 * ========================================================================== */

var GROWTH_FIX_VERSION = "2026-08-26a";

var SELF_TEST = {
  hour: 5,                 /* Pacific. growthWriteHour is 4, so this checks the
                              published state an hour after the pipeline wrote
                              it, and an hour before the 06:00 sold watch opens. */
  repairTriggers: true,    /* false = report drift, change nothing */
  emailTo: "",             /* blank = DAILY_RECAP_CONFIG.managerEmail */
  dollarTolerance: 0.01
};

var ZZ_ST_VERSION_PROP = "ZZ_SELFTEST_VERSION";
var ZZ_ST_LKG_PROP     = "ZZ_SELFTEST_LKG";
var ZZ_ST_LAST_PROP    = "ZZ_SELFTEST_LAST";

/* ---------------------------------------------------------------------------
 * The fixtures. Ten real August 2026 opportunity groups, each verified against
 * the published day row before it was written down here. Nine assert a date and
 * an amount; the tenth asserts that a group with no HCA in it produces nothing,
 * which is what keeps COD service traffic out of the headline.
 * ------------------------------------------------------------------------- */
function zzSelfTestFixtures_() {
  function A(o) {
    return {
      hca: o.un ? "" : (o.hca || "HCA"),
      unrostered: !!o.un,
      soldByRaw: o.hca || "",
      customer: o.cust,
      name: o.name,
      amount: o.amt,
      estimateNumber: o.est,
      opportunityNumber: o.opp,
      jobNumber: o.job,
      soldOnIso: o.sold,
      received: new Date(o.rcv)
    };
  }
  return [    
    { id: "Tabor 410448705 — furnace + ductless, 26s apart, both in the system bucket",
      exp: [["2026-08-25", 17608.98]],
      in: [
        A({cust:"Jeff Tabor",hca:"Adam Weberg",name:"American Standard 80% Single- Stage 40k Btu Gas Furnace",amt:7808.10,est:"410842473",opp:"410448705",job:"410448703",sold:"2026-08-25",rcv:"2026-08-25T16:51:24Z"}),
        A({cust:"Jeff Tabor",hca:"Adam Weberg",name:"Mitsubishi Single Head 9K Btu Ductless System",amt:9800.88,est:"411308311",opp:"410448705",job:"410448703",sold:"2026-08-25",rcv:"2026-08-25T16:51:50Z"})] },

    { id: "K Davis 408921212 — ducted heat pump + single-zone ductless, 10s apart",
      exp: [["2026-08-11", 22011.05]],
      in: [
        A({cust:"Kathy Davis",hca:"Davis Diosdado",name:"American Standard Silver 14 heat pump / AHRI# 215485200",amt:14374.24,est:"409219140",opp:"408921212",job:"408921210",sold:"2026-08-11",rcv:"2026-08-12T00:17:28Z"}),
        A({cust:"Kathy Davis",hca:"Davis Diosdado",name:"Mitsubishi HX single zone ductless heat pump installation",amt:7636.81,est:"409463860",opp:"408921212",job:"408921210",sold:"2026-08-11",rcv:"2026-08-12T00:17:38Z"})] },

    { id: "SYNTHETIC — the same two systems three days apart is a downgrade, not two sales",
      exp: [["2026-08-28", 9800.88]],
      in: [
        A({cust:"Synthetic Downgrade",hca:"Adam Weberg",name:"American Standard 80% Single- Stage 40k Btu Gas Furnace",amt:7808.10,est:"999000001",opp:"999000",job:"999001",sold:"2026-08-25",rcv:"2026-08-25T16:51:24Z"}),
        A({cust:"Synthetic Downgrade",hca:"Adam Weberg",name:"Mitsubishi Single Head 9K Btu Ductless System",amt:9800.88,est:"999000002",opp:"999000",job:"999001",sold:"2026-08-28",rcv:"2026-08-28T16:51:50Z"})] },
    { id: "Jang 410395417 — system + water heater bundle, 21s apart",
      exp: [["2026-08-18", 19539.48]],
      in: [
        A({cust:"Alisha Jang",name:"FURNACE AND AC - custom offer",amt:16790.48,est:"410513504",opp:"410395417",job:"410395415",sold:"2026-08-18",rcv:"2026-08-19T00:38:07Z"}),
        A({cust:"Alisha Jang",name:"Hot water tank",amt:2749.00,est:"410524811",opp:"410395417",job:"410395415",sold:"2026-08-18",rcv:"2026-08-19T00:38:28Z"})] },

    { id: "Richmond 409447315 — COMBINED estimate dropped, halves summed",
      exp: [["2026-08-13", 13540.50]],
      in: [
        A({cust:"Laura Richmond 0011389",name:"BETTER Replace high efficiency gas furnace Replace hot water heater",amt:13540.50,est:"409618580",opp:"409447315",job:"409447313",sold:"2026-08-13",rcv:"2026-08-13T17:22:34Z"}),
        A({cust:"Laura Richmond 0011389",name:"BETTER Replace high efficiency gas furnace",amt:8815.50,est:"409640504",opp:"409447315",job:"409447313",sold:"2026-08-13",rcv:"2026-08-13T18:41:42Z"}),
        A({cust:"Laura Richmond 0011389",name:"Replace hot water heater",amt:4725.00,est:"409642783",opp:"409447315",job:"409447313",sold:"2026-08-13",rcv:"2026-08-13T18:42:03Z"})] },

    { id: "V Stevens 408387028 — $109 add-on must not eat a $16,490 AC",
      exp: [["2026-08-10", 16599.65]],
      in: [
        A({cust:"Vincent Stevens",name:"American Standard AC w/Return Add",amt:16490.65,est:"408472217",opp:"408387028",job:"408387026",sold:"2026-08-10",rcv:"2026-08-10T16:58:35Z"}),
        A({cust:"Vincent Stevens",name:"Dryer vent cleaning",amt:109.00,est:"409388767",opp:"408387028",job:"408387026",sold:"2026-08-10",rcv:"2026-08-11T02:30:14Z"})] },

    { id: "Schiebel/Watson 407804785 — electrician's half rejoins, across dates",
      exp: [["2026-08-10", 30857.54]],
      in: [
        A({hca:"Jack Nichols",un:1,cust:"Ryan Schiebel and Kasey Watson",name:"200 amp service and panel upgrade (with circuit for freezer)",amt:15375.00,est:"408456521",opp:"407804785",job:"407804783",sold:"2026-08-07",rcv:"2026-08-07T19:25:08Z"}),
        A({hca:"Davis Diosdado",cust:"Ryan Schiebel and Kasey Watson",name:"Mitsubishi Hyper Heat 2-zone ductless heat pump installation",amt:15482.54,est:"408464399",opp:"407804785",job:"407804783",sold:"2026-08-10",rcv:"2026-08-10T18:53:41Z"})] },

    { id: "Bomstead 410391294 — same bucket re-paper, must NOT double",
      exp: [["2026-08-19", 5930.78]],
      in: [
        A({cust:"Jeffrey Bomstead",name:"Furnace option 1",amt:5930.78,est:"410557122",opp:"410391294",job:"410391292",sold:"2026-08-19",rcv:"2026-08-19T16:38:48Z"}),
        A({cust:"Jeffrey Bomstead",name:"Furnace option 1 - updated",amt:5930.78,est:"410571191",opp:"410391294",job:"410391292",sold:"2026-08-19",rcv:"2026-08-19T17:42:30Z"})] },

    { id: "Boisvert 408120596 — two-hour re-quote, latest wins",
      exp: [["2026-08-01", 16756.07]],
      in: [
        A({cust:"Caroline Boisvert",name:"American Standard furnace and heat pump",amt:16459.07,est:"408594912",opp:"408120596",job:"408120594",sold:"2026-08-01",rcv:"2026-08-01T17:46:00Z"}),
        A({cust:"Caroline Boisvert",name:"American Standard 2 stage furnace and heat pump",amt:16756.07,est:"408599745",opp:"408120596",job:"408120594",sold:"2026-08-01",rcv:"2026-08-01T19:51:53Z"})] },

    { id: "T Smith 408719760 — $0.00 re-paper must NOT trip the combined guard",
      exp: [["2026-08-06", 15027.48]],
      in: [
        A({cust:"Terry Smith",name:"Midea AC / S9V2 Variable Speed Furnace",amt:15027.48,est:"408793016",opp:"408719760",job:"408719758",sold:"2026-08-06",rcv:"2026-08-06T17:48:55Z"}),
        A({cust:"Terry Smith",name:"Midea 1800 ACGF - 2.0T for $349.99 per month - Copy",amt:0.00,est:"408909450",opp:"408719760",job:"408719758",sold:"2026-08-06",rcv:"2026-08-06T18:04:55Z"}),
        A({cust:"Terry Smith",name:"Midea AC / S9V2 Variable Speed Furnace",amt:15027.48,est:"408793016",opp:"408719760",job:"408719758",sold:"2026-08-06",rcv:"2026-08-06T18:30:23Z"})] },

    { id: "Diosdado 409486601 — heat pump downgraded to furnace, not summed",
      exp: [["2026-08-16", 10882.45]],
      in: [
        A({cust:"James X",name:"American Standard Silver 16 heat pump / AHRI# 216374489",amt:17478.47,est:"409653444",opp:"409486601",job:"409486599",sold:"2026-08-13",rcv:"2026-08-13T20:59:15Z"}),
        A({cust:"James X",name:"American Standard 96% gas furnace installation",amt:10882.45,est:"409621998",opp:"409486601",job:"409486599",sold:"2026-08-16",rcv:"2026-08-16T20:02:40Z"})] },

    { id: "E Miller 407848823 — six alerts, three re-papers, one water tank",
      exp: [["2026-08-20", 20572.89]],
      in: [
        A({cust:"Evan Miller",name:"Comfort Solution #2 American Standard Quest",amt:20572.89,est:"408469343",opp:"407848823",job:"407848821",sold:"2026-08-15",rcv:"2026-08-15T22:33:39Z"}),
        A({cust:"Evan Miller",name:"Comfort Solution #2 American Standard Quest",amt:20572.89,est:"408469343",opp:"407848823",job:"407848821",sold:"2026-08-17",rcv:"2026-08-18T00:46:44Z"}),
        A({cust:"Evan Miller",name:"Comfort Solution #2 American Standard Quest",amt:17823.89,est:"408469343",opp:"407848823",job:"407848821",sold:"2026-08-19",rcv:"2026-08-19T21:31:19Z"}),
        A({cust:"Evan Miller",name:'50 Gallon Tall (20" Wide) Atmospheric Vent Water Tank - NG - Bradford White',amt:2749.00,est:"410617383",opp:"407848823",job:"407848821",sold:"2026-08-19",rcv:"2026-08-19T21:31:24Z"}),
        A({cust:"Evan Miller",name:"NEW* Comfort Solution #2 American Standard Quest - Copy",amt:17823.89,est:"410661112",opp:"407848823",job:"407848821",sold:"2026-08-20",rcv:"2026-08-20T15:20:07Z"}),
        A({cust:"Evan Miller",name:"NEW* Comfort Solution #2 American Standard Quest - Copy",amt:17823.89,est:"410661112",opp:"407848823",job:"407848821",sold:"2026-08-20",rcv:"2026-08-20T15:25:00Z"})] },

    { id: "SYNTHETIC — combined estimate in a bucket nothing else reuses",
      exp: [["2026-08-11", 12000.00]],
      in: [
        A({cust:"Fixture Combined Guard",name:"200 amp panel and complete comfort system package",amt:12000.00,est:"900000001",opp:"900000000",job:"900000002",sold:"2026-08-11",rcv:"2026-08-11T16:00:00Z"}),
        A({cust:"Fixture Combined Guard",name:"High efficiency gas furnace",amt:8000.00,est:"900000003",opp:"900000000",job:"900000002",sold:"2026-08-11",rcv:"2026-08-11T16:05:00Z"}),
        A({cust:"Fixture Combined Guard",name:"Hot water tank",amt:4000.00,est:"900000004",opp:"900000000",job:"900000002",sold:"2026-08-11",rcv:"2026-08-11T16:06:00Z"})] },

    { id: "E Johnson 409288176 — no HCA in the group, must produce NOTHING",
      exp: [],
      in: [
        A({hca:"Doug Jansen",un:1,cust:"Elizabeth Johnson",name:"Service fee",amt:169.00,est:"409358479",opp:"409288176",job:"409288174",sold:"2026-08-10",rcv:"2026-08-10T17:02:17Z"}),
        A({hca:"Doug Jansen",un:1,cust:"Elizabeth Johnson",name:"Annual maintenance club",amt:251.88,est:"409360300",opp:"409288176",job:"409288174",sold:"2026-08-10",rcv:"2026-08-10T17:29:22Z"}),
        A({hca:"Doug Jansen",un:1,cust:"Elizabeth Johnson",name:"Install ez trap and overflow safety switch",amt:585.65,est:"409343535",opp:"409288176",job:"409288174",sold:"2026-08-10",rcv:"2026-08-10T17:29:48Z"}),
        A({hca:"Doug Jansen",un:1,cust:"Elizabeth Johnson",name:"Service fee discounts",amt:-169.00,est:"409363038",opp:"409288176",job:"409288174",sold:"2026-08-10",rcv:"2026-08-10T18:36:25Z"})] }
  ];
}

function zzSelfTest(sendEmail) {
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  var now = new Date();
  var stamp = Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm");
  var monthIso = Utilities.formatDate(now, tz, "yyyy-MM");
  var props = PropertiesService.getScriptProperties();

  var fails = [], warns = [], notes = [], out = [];
  function money(n) {
    return "$" + (Math.round(Number(n) * 100) / 100).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  out.push("SELF TEST — " + stamp + " " + tz);
  out.push("");

  /* ---- 1. VERSION ------------------------------------------------------ */
  var loaded = (typeof GROWTH_FIX_VERSION !== "undefined") ? String(GROWTH_FIX_VERSION) : "(undefined)";
  var stamped = props.getProperty(ZZ_ST_VERSION_PROP) || "";
  out.push("1. VERSION");
  out.push("   loaded  " + loaded);
  out.push("   stamped " + (stamped || "(not stamped — run installSelfTest)"));
  if (!stamped) {
    notes.push("No version stamped yet. Run installSelfTest() to set the baseline.");
  } else if (stamped !== loaded) {
    fails.push("VERSION DRIFT: stamped " + stamped + " but " + loaded + " is loaded. " +
               "Another block was appended after this one. Nothing below can be trusted " +
               "until you know what shipped.");
  }
  out.push("");

  /* ---- 2. FIXTURES ----------------------------------------------------- */
    out.push("2. COLLAPSE FIXTURES — twelve verified sale groups + two synthetic");
  var fx = zzSelfTestFixtures_(), fxPass = 0;
  if (typeof growthCollapseLatestSoldAlerts_ !== "function") {
    fails.push("growthCollapseLatestSoldAlerts_ is not defined. The block is gone.");
    out.push("   !! function not defined — all ten skipped");
  } else {
    fx.forEach(function (c) {
      var got, err = "";
      try {
        var r = growthCollapseLatestSoldAlerts_(c.in);
        got = (r && r.alerts ? r.alerts : []).map(function (a) {
          return [String(a.soldOnIso), Math.round(Number(a.amount) * 100) / 100];
        }).sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      } catch (e) {
        err = (e && e.message) ? e.message : String(e);
        got = null;
      }
      var exp = c.exp.slice().sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      var ok = !err && JSON.stringify(got) === JSON.stringify(exp);
      if (ok) { fxPass++; out.push("   PASS  " + c.id); return; }
      var show = function (v) {
        return (!v || !v.length) ? "(nothing)"
          : v.map(function (g) { return g[0] + " " + money(g[1]); }).join("  |  ");
      };
      out.push("   FAIL  " + c.id);
      out.push("         expected " + show(exp));
      out.push("         got      " + (err ? "THREW: " + err : show(got)));
      fails.push("Fixture failed — " + c.id + ": expected " + show(exp) +
                 ", got " + (err ? "THREW " + err : show(got)));
    });
  }
  out.push("   " + fxPass + " of " + fx.length + " passed");
  out.push("");

  /* ---- 3. LIVE PATH ---------------------------------------------------- */
  out.push("3. LIVE PATH — sameDaySoldMonthData_(), reads Gmail, writes nothing");
  var soldN = null, soldDollars = null;
  if (typeof sameDaySoldMonthData_ !== "function") {
    fails.push("sameDaySoldMonthData_ is not defined.");
    out.push("   !! function not defined");
  } else {
    try {
      var m = sameDaySoldMonthData_();
      if (!m || !m.ok) {
        fails.push("sameDaySoldMonthData_ returned not-ok. The Gmail read failed; " +
                   "the tab is preserving its previous table.");
        out.push("   !! returned not-ok");
      } else {
        soldN = 0; soldDollars = 0;
        Object.keys(m.days || {}).forEach(function (d) {
          soldN += Number(m.days[d].total) || 0;
          soldDollars += Number(m.days[d].dollars) || 0;
        });
        soldDollars = Math.round(soldDollars * 100) / 100;
        out.push("   window     " + m.fromIso + " -> " + m.toIso);
        out.push("   MTD sold   " + soldN + "   " + money(soldDollars));
        var dg = m.dedupe || {};
        out.push("   bundles    " + (dg.bundledSales || 0) +
                 " · combined dropped " + (dg.combinedEstimatesDropped || 0) +
                 " · unrostered groups dropped " + (dg.unrosteredGroupsDropped || 0) +
                 " · unrostered line items bundled " + (dg.unrosteredLineItemsBundled || 0));
        if (m.complete === false) {
          warns.push("PARTIAL Gmail read. The MTD figures above are a floor, not a total. " +
                     "This usually clears on its own next run.");
          out.push("   !! PARTIAL Gmail read");
        }
        if ((dg.unrosteredLineItemsBundled || 0) > 3) {
          warns.push("unrosteredLineItemsBundled is " + dg.unrosteredLineItemsBundled +
                     " — expected about 1. Tech-written add-ons may be folding into HCA " +
                     "sales and inflating the headline. Run zzPreviewBundledSold and read " +
                     "the bundle list.");
        }
      }
    } catch (e2) {
      fails.push("sameDaySoldMonthData_ threw: " + ((e2 && e2.message) ? e2.message : String(e2)));
      out.push("   !! threw " + ((e2 && e2.message) ? e2.message : String(e2)));
    }
  }
  out.push("");

  /* ---- 4. LAST KNOWN GOOD — high-water mark within the month ----------- */
  out.push("4. LAST KNOWN GOOD");
  var lkg = null;
  try { lkg = JSON.parse(props.getProperty(ZZ_ST_LKG_PROP) || "null"); } catch (e3) { lkg = null; }
  if (!lkg) {
    out.push("   none stored — this run will set it if everything passes");
  } else {
    out.push("   from       " + lkg.at + "   version " + lkg.version);
    out.push("   MTD sold   " + lkg.sold + "   " + money(lkg.dollars));
    if (lkg.monthIso !== monthIso) {
      out.push("   (different month — comparison skipped, mark resets)");
    } else if (soldN !== null) {
      if (soldN < lkg.sold) {
        warns.push("MTD SOLD WENT BACKWARDS: " + lkg.sold + " -> " + soldN +
                   " (" + (soldN - lkg.sold) + "). Within one month that number only " +
                   "goes up. This is what a regressed collapse looks like.");
        out.push("   !! sold " + lkg.sold + " -> " + soldN);
      }
      if (soldDollars < lkg.dollars - SELF_TEST.dollarTolerance) {
        warns.push("MTD DOLLARS WENT BACKWARDS: " + money(lkg.dollars) + " -> " +
                   money(soldDollars) + " (" + money(soldDollars - lkg.dollars) + ").");
        out.push("   !! dollars " + money(lkg.dollars) + " -> " + money(soldDollars));
      }
    }
  }
  out.push("");

  /* ---- 5. TRIGGERS — the part that actually repairs itself ------------- */
  out.push("5. TRIGGERS" + (SELF_TEST.repairTriggers ? "" : "   (repair disabled)"));
  var repaired = [];
  try {
    var trigs = ScriptApp.getProjectTriggers();
    var watch = [], hourly = [], byFn = {};
    trigs.forEach(function (t) {
      var fn = t.getHandlerFunction();
      byFn[fn] = (byFn[fn] || 0) + 1;
      if (fn === "zzSoldWatch") watch.push(t);
      if (fn === "refreshSameDaySoldTab") hourly.push(t);
    });
    out.push("   total " + trigs.length + " of 20 allowed");
    Object.keys(byFn).sort().forEach(function (fn) {
      out.push("     " + fn + (byFn[fn] > 1 ? "  x" + byFn[fn] : ""));
    });

    if (watch.length === 1 && !hourly.length) {
      out.push("   sold watch OK — 1 installed, no stale hourly");
    }

    if (SELF_TEST.repairTriggers) {
      if (watch.length > 1) {
        for (var i = 1; i < watch.length; i++) ScriptApp.deleteTrigger(watch[i]);
        repaired.push("deleted " + (watch.length - 1) + " duplicate zzSoldWatch trigger(s)");
      }
      if (!watch.length) {
        if (typeof zzSoldWatch === "function") {
          var every = 10;
          try { every = Number(SOLD_WATCH.everyMinutes) || 10; } catch (eSW) { every = 10; }
          ScriptApp.newTrigger("zzSoldWatch").timeBased().everyMinutes(every).create();
          repaired.push("recreated the missing zzSoldWatch trigger (every " + every + " min)");
        } else {
          fails.push("zzSoldWatch has no trigger AND the function is not defined. " +
                     "The sentinel block was removed. Same-Day Sold is now only " +
                     "refreshed by the 04:00 pipeline.");
        }
      }
      if (hourly.length) {
        hourly.forEach(function (t) { ScriptApp.deleteTrigger(t); });
        repaired.push("deleted " + hourly.length + " resurrected hourly " +
                      "refreshSameDaySoldTab trigger(s) — the sold watch supersedes them");
      }
      if (trigs.length >= 19) {
        warns.push("Trigger count is " + trigs.length + " of 20. The next install will fail.");
      }
    } else {
      if (watch.length !== 1) notes.push("zzSoldWatch triggers: " + watch.length + " (expected 1)");
      if (hourly.length) notes.push("stale hourly refreshSameDaySoldTab: " + hourly.length);
    }

    if (repaired.length) {
      repaired.forEach(function (r) { out.push("   REPAIRED  " + r); });
      warns.push("Triggers were repaired: " + repaired.join("; ") +
                 ". Something changed them. Worth knowing what.");
    }
  } catch (e4) {
    warns.push("Could not read triggers: " + ((e4 && e4.message) ? e4.message : String(e4)));
    out.push("   !! " + ((e4 && e4.message) ? e4.message : String(e4)));
  }
  out.push("");

  /* ---- 6. VERDICT ------------------------------------------------------ */
  var status = fails.length ? "FAIL" : (warns.length ? "WARN" : "OK");
  out.push("VERDICT  " + status);
  if (fails.length) {
    out.push("");
    out.push("FAILURES — the code is not what was shipped:");
    fails.forEach(function (f, i) { out.push("  " + (i + 1) + ". " + f); });
    out.push("");
    out.push("RESTORE. Source does not self-heal and never will from here. Last known");
    out.push("good code is the dated backup project, restored by hand:");
    out.push("  1. Open the backup Apps Script project for the last good date.");
    out.push("  2. Copy its whole file over the live one. Complete file — never a diff.");
    out.push("  3. Run zzSelfTest() and confirm 10 of 10 and VERDICT OK.");
    out.push("  4. Run installSelfTest() to re-stamp the version.");
  }
  if (warns.length) {
    out.push("");
    out.push("WARNINGS — look, judge, do not assume:");
    warns.forEach(function (w, i) { out.push("  " + (i + 1) + ". " + w); });
  }
  if (notes.length) {
    out.push("");
    notes.forEach(function (n) { out.push("NOTE  " + n); });
  }
  if (status === "WARN" && lkg && lkg.monthIso === monthIso) {
    out.push("");
    out.push("The high-water mark is NOT lowered on a WARN, so this repeats daily until it");
    out.push("recovers. If the drop is correct and intended, run zzSelfTestAcceptCurrent().");
  }

  /* ---- 7. PERSIST ------------------------------------------------------ */
  if (status === "OK" && soldN !== null) {
    props.setProperty(ZZ_ST_LKG_PROP, JSON.stringify({
      at: stamp, monthIso: monthIso, version: loaded,
      sold: soldN, dollars: soldDollars, fixtures: fxPass + "/" + fx.length
    }));
    out.push("");
    out.push("High-water mark updated: " + soldN + " sold · " + money(soldDollars));
  }

  var msg = out.join("\n");
  Logger.log(msg);

  /* ---- 8. EMAIL — on trouble, and once on recovery. Silent when OK->OK. */
  var prev = props.getProperty(ZZ_ST_LAST_PROP) || "";
  props.setProperty(ZZ_ST_LAST_PROP, status);
  if (sendEmail) {
    var shouldSend = (status !== "OK") || (prev && prev !== "OK");
    if (shouldSend) {
      var to = SELF_TEST.emailTo;
      if (!to) { try { to = DAILY_RECAP_CONFIG.managerEmail; } catch (e5) { to = ""; } }
      if (!to) {
        Logger.log("No recipient — set SELF_TEST.emailTo or DAILY_RECAP_CONFIG.managerEmail.");
      } else {
        var subj = (status === "OK")
          ? "Growth self-test RECOVERED — back to OK"
          : "Growth self-test " + status + " — " +
            (fails.length ? fails.length + " failure(s)" : warns.length + " warning(s)");
        try {
          MailApp.sendEmail(to, subj, msg);
          Logger.log("Emailed " + to + ": " + subj);
        } catch (e6) {
          Logger.log("Email failed: " + ((e6 && e6.message) ? e6.message : String(e6)));
        }
      }
    } else {
      Logger.log("OK and was OK — no email sent.");
    }
  }
  return msg;
}

function zzSelfTestDaily() { return zzSelfTest(true); }

function installSelfTest() {
  var props = PropertiesService.getScriptProperties();
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() !== "zzSelfTestDaily") return;
    ScriptApp.deleteTrigger(t); removed++;
  });
  var tz;
  try { tz = DAILY_RECAP_CONFIG.timeZone; } catch (e) { tz = "America/Los_Angeles"; }
  ScriptApp.newTrigger("zzSelfTestDaily").timeBased()
    .everyDays(1).atHour(SELF_TEST.hour).inTimezone(tz).create();
  props.setProperty(ZZ_ST_VERSION_PROP, String(GROWTH_FIX_VERSION));
  var total = ScriptApp.getProjectTriggers().length;
  var msg = "Self test installed — daily at " + SELF_TEST.hour + ":00 " + tz +
    ". Replaced " + removed + " old trigger(s). Version stamped " + GROWTH_FIX_VERSION +
    ". Total project triggers now " + total + " of 20. " +
    "Email goes to " + (SELF_TEST.emailTo || (function () {
      try { return DAILY_RECAP_CONFIG.managerEmail; } catch (e) { return "(none set)"; }
    })()) + " on FAIL, on WARN, and once on recovery — silent when it is fine.";
  Logger.log(msg);
  return msg;
}

function removeSelfTest() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() !== "zzSelfTestDaily") return;
    ScriptApp.deleteTrigger(t); n++;
  });
  var msg = "Removed " + n + " zzSelfTestDaily trigger(s). Stored version stamp and " +
            "high-water mark were left alone — zzSelfTest() still runs by hand.";
  Logger.log(msg);
  return msg;
}

function zzSelfTestBaseline() {
  var props = PropertiesService.getScriptProperties();
  var lkg = props.getProperty(ZZ_ST_LKG_PROP) || "(none)";
  var msg = [
    "SELF TEST BASELINE — read-only",
    "  version loaded  " + ((typeof GROWTH_FIX_VERSION !== "undefined") ? GROWTH_FIX_VERSION : "(undefined)"),
    "  version stamped " + (props.getProperty(ZZ_ST_VERSION_PROP) || "(none)"),
    "  last status     " + (props.getProperty(ZZ_ST_LAST_PROP) || "(never run)"),
    "  high-water mark " + lkg
  ].join("\n");
  Logger.log(msg);
  return msg;
}

function zzSelfTestAcceptCurrent() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(ZZ_ST_VERSION_PROP, String(GROWTH_FIX_VERSION));
  props.deleteProperty(ZZ_ST_LKG_PROP);
  props.deleteProperty(ZZ_ST_LAST_PROP);
  var msg = "Accepted current state. Version re-stamped " + GROWTH_FIX_VERSION +
    " and the high-water mark cleared. The next zzSelfTestAcceptCurrent run sets a fresh one. " +
    "Only run this after a change you made on purpose.";
  Logger.log(msg);
  return msg;
}
/* ============================================================================
 * growthBiMtd_ — REPLACEMENT, deployed 2026-08-28. THIS IS THE LIVE COPY.
 *
 * The pre-2026-08-28 version is parked earlier in this file as
 * growthBiMtd_OLD_20260828. Nothing calls it. Do not restore its name — Apps
 * Script shares one global scope and the LAST definition wins, so two copies
 * of this name means the file's line order silently decides which one runs.
 *
 * WHAT CHANGED. Every returned NUMBER is identical to the old version. What
 * changed is that the silent failures now say something:
 *
 *   1. Tab missing, tab empty, OR the spreadsheet unreachable — the catch on
 *      openById turned a real error (bad id, revoked access) into "no tab",
 *      so all three landed in one branch and returned the constants, NO LOG.
 *   2. BI_MTD_LEADS resolving to 0 — returned the constants, NO LOG. Note this
 *      fires only on a literal 0; an ABSENT key does not come here, it goes to
 *      case 3 below.
 *   3. Tab present but missing its BI_MTD rows — used to return the frozen
 *      constants while REPORTING `source` as the tab. Nothing downstream could
 *      tell it was reading mid-August numbers. This is the one that mattered:
 *      it is not a fallback with a missing log line, it is a false provenance
 *      claim, and the parts-equal-whole check cannot catch it because the
 *      constants are internally consistent by construction (71+29+1 = 101).
 *
 * The only non-log behaviour change is that `source` now tells the truth in
 * case 3. `source` is consumed in exactly one place — a Logger line in the
 * PLAN report — so nothing computed depends on it.
 * ========================================================================== */
function growthIsoCell_(v) {
  if (v == null || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v)) {
    return Utilities.formatDate(v, DAILY_RECAP_CONFIG.timeZone, "yyyy-MM-dd");
  }
  var s = String(v).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  var us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return us[3] + "-" + ("0" + us[1]).slice(-2) + "-" + ("0" + us[2]).slice(-2);
  return s.slice(0, 10);
}
function growthBiMtd_(ss) {
  if (GROWTH_BI_CACHE_) return GROWTH_BI_CACHE_;

  var fb = {
    leads: (typeof BI_MTD_LEADS === "number") ? BI_MTD_LEADS : 0,
    mkt:   (typeof BI_MTD_MKT_LEADS === "number") ? BI_MTD_MKT_LEADS : 0,
    tech:  (typeof BI_MTD_TECH_LEADS === "number") ? BI_MTD_TECH_LEADS : 0,
    sg:    (typeof BI_MTD_SG_LEADS === "number") ? BI_MTD_SG_LEADS : 0,
    installs: 0, instMkt: 0, instTech: 0, instSg: 0, rentalInstalls: 0,
    monthStart: "", throughIso: "", source: "code constants"
  };

  var sh = null, openErr = "";
  /* The catch below turns a real failure — bad sheet id, revoked access, API
     hiccup — into sh = null, which is indistinguishable from "the tab is not
     there." Keep the reason so the log can tell them apart. */
  try {
    sh = (ss || SpreadsheetApp.openById(GROWTH_SHEET_ID)).getSheetByName(GROWTH_CONFIG_TAB);
  } catch (e) { sh = null; openErr = String(e); }
  /* WAS SILENT, on all three causes. */
  if (!sh || sh.getLastRow() < 2) {
    Logger.log("Growth Config: " +
      (openErr
        ? "could not open the spreadsheet or reach the tab (" + openErr + ")"
        : (sh ? "tab '" + GROWTH_CONFIG_TAB + "' is present but empty (last row " + sh.getLastRow() + ")"
              : "tab '" + GROWTH_CONFIG_TAB + "' is MISSING")) +
      " — using the hardcoded BI_MTD_* constants instead (leads " + fb.leads +
      ", mkt " + fb.mkt + ", tech " + fb.tech + ", sg " + fb.sg +
      "). Those are a frozen snapshot. THE MTD LEAD FIGURES ARE NOT CURRENT.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }

  var map = {};
  try {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0] || "").trim();
      if (k) map[k] = r[1];
    });
  } catch (e) {
    Logger.log("Growth Config unreadable (" + e + "); using the code constants. " +
      "THE MTD LEAD FIGURES ARE NOT CURRENT.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }

  /* A key that is PRESENT but unparseable means someone typed into the tab.
     That is a corrupted config, not a missing one, so it rejects the whole tab
     rather than silently mixing a hand-edited value with the code constants. */
  var bad = [];
  var fromConst = [];   /* keys the tab did not supply — these came from code */
  function num(key, fallbackVal) {
    if (!(key in map) || map[key] === "" || map[key] === null) { fromConst.push(key); return fallbackVal; }
    var n = Number(map[key]);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { bad.push(key + "=" + map[key]); return fallbackVal; }
    return n;
  }
  /* A zero total-leads reading would silently blank every L2C percentage, so
     it is treated as an unset tab rather than a real zero.
     WAS SILENT. */
  var leads = num("BI_MTD_LEADS", fb.leads);
  if (!leads) {
    Logger.log("Growth Config: BI_MTD_LEADS resolved to 0 (tab value " +
      (("BI_MTD_LEADS" in map) ? JSON.stringify(map["BI_MTD_LEADS"])
                               : "absent, and the code constant is 0 too") +
      ") — treated as an unset tab, not a real zero. Using the hardcoded " +
      "BI_MTD_* constants. THE MTD LEAD FIGURES ARE NOT CURRENT.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }

  var out = {
    leads: leads,
    mkt:   num("BI_MTD_MKT_LEADS", fb.mkt),
    tech:  num("BI_MTD_TECH_LEADS", fb.tech),
    sg:    num("BI_MTD_SG_LEADS", fb.sg),
    installs: num("BI_MTD_INSTALLS", fb.installs),
    instMkt:  num("BI_MTD_MKT_INSTALLS", fb.instMkt),
    instTech: num("BI_MTD_TECH_INSTALLS", fb.instTech),
    instSg:   num("BI_MTD_SG_INSTALLS", fb.instSg),
    rentalInstalls: num("BI_MTD_RENTAL_INSTALLS", 0),  // Fix 6: rental installs excluded from avg ticket
        monthStart: growthIsoCell_(map["BI_MONTH_START"]),
    throughIso: growthIsoCell_(map["BI_THROUGH_ISO"]),
    source: "'" + GROWTH_CONFIG_TAB + "' tab"
  };
  if (bad.length) {
    Logger.log("Growth Config has non-numeric value(s): " + bad.join(", ") +
      ". Falling back to the code constants. THE MTD LEAD FIGURES ARE NOT CURRENT.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }
  /* WAS SILENT, AND WORSE THAN SILENT. A tab that exists but has lost its
     BI_MTD rows takes none of the fallback branches: num() hands back the code
     constants one by one, they sum consistently, the parts-equal-whole check
     passes, and the result is returned with source reading as the tab. The
     numbers are mid-August; the label says they came from the tab. Say so. */
  /* Install keys may not exist yet on a tab created before Fix 5. The four
     install keys will all be in fromConst (fallback 0). That is expected on the
     first run — growthWriteBiMtd_ auto-appends them. Only the LEAD keys being
     absent is a sign of a broken tab. */
  var leadConst = fromConst.filter(function (k) { return k.indexOf("INSTALLS") === -1; });
  if (leadConst.length) {
    Logger.log("Growth Config: " + leadConst.length + " of 4 lead key(s) not supplied by the tab (" +
      leadConst.join(", ") + ") — those values came from the hardcoded BI_MTD_* " +
      "constants, which are a frozen snapshot. The tab was read successfully; it " +
      "simply does not hold those rows. THE AFFECTED FIGURES ARE NOT CURRENT.");
    out.source = (leadConst.length >= 4)
      ? "code constants (the '" + GROWTH_CONFIG_TAB + "' tab exists but holds no BI_MTD rows)"
      : "'" + GROWTH_CONFIG_TAB + "' tab, plus " + leadConst.length + " value(s) from the code constants";
  }
  /* The parts must equal the whole. If they do not, the tab was hand-edited
     into an inconsistent state and the constants are the safer read. */
  if (out.mkt + out.tech + out.sg !== out.leads) {
    Logger.log("Growth Config: " + out.mkt + "+" + out.tech + "+" + out.sg + " != " + out.leads +
      " — the source split does not sum to total leads. Falling back to the code constants. " +
      "THE MTD LEAD FIGURES ARE NOT CURRENT.");
    GROWTH_BI_CACHE_ = fb; return fb;
  }
  /* Same check for installs, but only when they have been populated (non-zero).
     On the first run after Fix 5, the install keys may not exist yet. */
  if (out.installs && (out.instMkt + out.instTech + out.instSg !== out.installs)) {
    Logger.log("Growth Config: install split " + out.instMkt + "+" + out.instTech + "+" + out.instSg +
      " != " + out.installs + " — falling back to 0 for installs (the Daily Data row sums will be used instead).");
    out.installs = 0; out.instMkt = 0; out.instTech = 0; out.instSg = 0;
  }
  GROWTH_BI_CACHE_ = out;
  return out;
}
/* Diagnostic only — prints what gaReadTabular_ actually hands the matcher
   for All Installs 09.04.xlsx. Safe to delete afterward. */
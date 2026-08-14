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
  /* Fills yesterday's growth column and MTD, an hour after the morning rush.
  Silent unless a human is needed — see writeGrowthSheetForYesterday. */
  ScriptApp.newTrigger("writeGrowthSheetForYesterday")
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
  return "Hi " + hca.first + ",\n\n" + nudge + "Fill out the recap form for each appointment today (" + dateLabel + ") as you finish it:\n\n" + url + "\n\n" + "One submission per appointment, as many as you run. Nothing today? Nothing to submit.\n\n" + "Thanks,\n" + "Geoff\n";
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
  return Utilities.formatDate(new Date(), tz, "yyyy-MM") + "-01";
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
  return (n < 10 ? " " : "") + n;
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
  var NAVY = "#0f172a", AMBER = "#fff7ed", MUT = "#64748b", GOLD = "#ffc000", BLUE = "#4aa3df", GRAY = "#bfbfbf";
  var numF = "#,##0", pctF = "0.0%", moneyF = "$#,##0", div = function (n, dd) {
    return dd ? n / dd : "";
  };
  var mL = 0, tL = 0, sgL = 0, mI = 0, tI = 0, sgI = 0, sold = 0, dollars = 0;
  var perDay = L2C_DAYS.map(function (x) {
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
  var d = L2C_DAYS.length ? L2C_DAYS[L2C_DAYS.length - 1] : ["-", 0, 0, 0, 0, 0, 0, 0, 0];
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
  var rows = [ ["Total Leads", dLeads, BI_MTD_LEADS, "", numF], ["Total Sold", soldDayVal, soldMtdVal, "15%", numF], ["HVAC Sold $ (live)", sold$DayVal, sold$MtdVal, "", moneyF], ["Total Installs", dInst, Inst, "", numF], ["Total L2C %", "", div(Inst, BI_MTD_LEADS), "", pctF], ["Marketed L2C %", "", div(mI, BI_MTD_MKT_LEADS), "50%", pctF], ["HVAC Tech Flip Leads", d[2], BI_MTD_TECH_LEADS, 50, numF], ["HVAC Tech Flip Deals", d[5], tI, 28, numF], ["HVAC Tech Flip L2C %", "", div(tI, BI_MTD_TECH_LEADS), "55%", pctF], ["NPS Sales Overall", "", "", 85, numF], ["HVAC Rev (installed)", d[8], dollars, "$2.58M", moneyF], ["HVAC AVG Ticket", div(d[8], dInst), div(dollars, Inst), "$", moneyF], ["Self Gen", d[3], BI_MTD_SG_LEADS, "", numF] ];
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
    /* Budget/target cell: force a plain number format for numeric targets so a leftover percent format can't turn 28 into "2800%". String targets like "15%" / "$2.58M" are left alone (their format is irrelevant as text). */
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
  sh.getRange(base + 2, 2).setValue("Day column = consults that RAN that day (board) + sold/$. MTD L2C = Installs / BI leads (" + Inst + " / " + BI_MTD_LEADS + ") - the BI figure Paul sees. Day leads are consults-ran; MTD leads are BI (received). Sold count/$ are LIVE (ServiceTitan, pre-tax), ahead of Installs; HVAC Rev = installed (BI).").setFontColor(MUT).setFontStyle("italic");
  var stamp = Utilities.formatDate(new Date(), tz, "EEE M/d h:mm a");
  sh.getRange(base + 3, 2).setValue("Updated " + stamp + (live ? "" : " · sold engine unreadable, showing BI fallback") + (eng && eng.complete === false ? " · PARTIAL Gmail read" : "")).setFontColor(MUT);
  [30, 210, 110, 110, 110].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  }
  );
  sh.setFrozenRows(3);
  /* No setActiveSheet — an hourly trigger shouldn't yank whatever tab you're on. */
  Logger.log('Built "L2C" + "daily" (hybrid) - MTD L2C ' + (BI_MTD_LEADS ? Math.round(Inst * 1000 / BI_MTD_LEADS) / 10 : 0) + '% (' + Inst + '/' + BI_MTD_LEADS + ') Sold ' + (live ? "LIVE " : "BI ") + soldMtdVal + ' $' + Math.round(live ? sold$MtdVal : dollars) + (live && !todayIsBIday ? ' today ' + todayN + '/$' + Math.round(today$) : '') + '.');
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
/* L2C_DAYS - CONSULTS-RAN basis (by appointment date), 8/1-8/10/2026
 * Leads (cols 2-4) = consults that RAN each day = lastApptDate in All Leads 08.10,
 *   status Completed/InProgress. Reconciled to the 8/10 dispatch board EXACTLY -- 6 ran Mon:
 *   Fisher, Kegley, Moengkhom (booked earlier) + Mathena, Gardner[tech], Malmgren[tech].
 *   This is NOT the BI created-date count (that was 64 / 42.2%); it excludes leads booked
 *   for FUTURE appt dates. MTD consults-ran = 44  ->  L2C 27/44 = 61.4%.
 * Installs (cols 5-7) and $ (col 9) UNCHANGED -- install-date basis, tie to BI 27 installs / $421,100.
 * Sold (col 8) overridden live by ServiceTitan; 8/10 set to 3 per board.
 * Row: [label, mktLeads, techLeads, sgLeads, mktInst, techInst, sgInst, sold, $installed]
 */
var L2C_DAYS = [
  ["Sat 8/1", 0, 0, 0, 0, 0, 0, 1, 0],
  ["Sun 8/2", 2, 0, 0, 0, 0, 0, 0, 0],
  ["Mon 8/3", 4, 1, 0, 2, 0, 0, 2, 32630],
  ["Tue 8/4", 4, 2, 0, 3, 3, 0, 10, 114140],
  ["Wed 8/5", 6, 2, 0, 6, 1, 0, 7, 92550],
  ["Thu 8/6", 3, 3, 0, 4, 2, 1, 4, 117970],
  ["Fri 8/7", 3, 1, 0, 2, 2, 0, 3, 56290],
  ["Sat 8/8", 3, 1, 0, 0, 0, 0, 0, 0],
  ["Sun 8/9", 2, 1, 0, 0, 0, 0, 0, 0],
  ["Mon 8/10", 4, 2, 0, 1, 0, 0, 3, 7520],
  ["Tue 8/11", 5, 2, 0, 4, 0, 0, 10, 87020]
];

/* ============================================================================
 * BI MONTH-TO-DATE - the corporate headline (what BI / Paul report).
 * L2C_DAYS above are consults that RAN each day (dispatch board). BI counts
 * leads RECEIVED. The Daily scorecard MTD column reads its LEAD counts from
 * here, so the MTD L2C tile matches BI exactly. Installs and $ still come from
 * the array (they already tie to BI 27 installs / $421,100), so each morning
 * you only update these four lead numbers from the BI dashboard.
 *   Total 64 = Inbound 38 + Webform 8 + Self Gen 0 + Tech 18.
 * ============================================================================ */
var BI_MTD_LEADS = 74;        // BI dashboard Total Leads
var BI_MTD_MKT_LEADS = 52;    // Marketed = Inbound + Webform
var BI_MTD_TECH_LEADS = 22;   // Tech
var BI_MTD_SG_LEADS = 0;      // Self Gen
var L2CPLUS_SHEET_ID = "1WFeRFKvdyYLMJf1Q9iBVzWjFIrOH22KIkrM6_4Zsoww";
var L2CPLUS_PIPE_TAB = "Backlog Pipeline";
var L2CPLUS_MARKER = "Awaiting Install — BI Backlog & Pipeline";
var RAN_DAY_LABEL = "8/7";
var RAN_LEADS = 4;
var RAN_INSTALLS = 4;
var RAN_LEADS_NOTE = "LIVE estimate — 4 consults ran 8/7 (dispatch board, not BI): " + "Paul Priebe (Tech), Michael Stevens (Inbound), Kunjan Dayal (Inbound), " + "Sua Tan & Sandi Nagata (Inbound). Monday's BI replaces this.";
var RAN_INSTALLS_NOTE = "LIVE estimate — 4 installs ran 8/7 (Completed Form Alerts [HVAC Sales]): " + "Brassette, Drake, Corn, Lewis. Not the reconciled BI count (can be ±1 on " + "multi-day installs). Monday's BI replaces this.";
function buildL2CTabPlus() {
  var url = buildL2CTab();
  // untouched -- runs your live version
  try {
    Logger.log("L2C decorations: " + decorateL2C_());
  }
  catch (e) {
    Logger.log("decorateL2C_ skipped (scorecard fine, 8/7 unaffected): " + e);
  }
  try {
    Logger.log(applyDayRanEstimates_());
  }
  catch (e2) {
    Logger.log("day estimates skipped (scorecard fine): " + e2);
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
function applyDayRanEstimates_() {
  var ss = SpreadsheetApp.openById(L2CPLUS_SHEET_ID);
  var sh = null;
  ss.getSheets().forEach(function (s) {
    if (String(s.getName()).toLowerCase().trim() === "daily") sh = s;
  });
  if (!sh) { Logger.log("day estimates: no Daily tab."); return "no Daily tab."; }
  var c3 = String(sh.getRange(3, 3).getDisplayValue() || "");
  if (c3.indexOf(RAN_DAY_LABEL) < 0) {
    var skip = "day estimates: day column is '" + c3 + "' (no '" + RAN_DAY_LABEL + "') — skipped.";
    Logger.log(skip); return skip;
  }
  var dv = sh.getRange(1, 2, sh.getLastRow(), 1).getValues();   // col B labels
  function rowOf(pred) {
    for (var r = 0; r < dv.length; r++) {
      if (pred(String(dv[r][0] || "").trim().toLowerCase())) return r + 1;
    }
    return -1;
  }
  var rLeads = rowOf(function (s) { return s === "total leads"; });
  var rInst  = rowOf(function (s) { return s.indexOf("total installs") === 0; });
  var out = [];
  if (rLeads > 0) {
    sh.getRange(rLeads, 3).setValue(RAN_LEADS).setNote(RAN_LEADS_NOTE);
    out.push("Leads " + RAN_LEADS + " (row " + rLeads + ")");
  } else out.push("leads row NOT FOUND");
  if (rInst > 0) {
    sh.getRange(rInst, 3).setValue(RAN_INSTALLS).setNote(RAN_INSTALLS_NOTE);
    out.push("Installs " + RAN_INSTALLS + " (row " + rInst + ")");
  } else out.push("installs row NOT FOUND");
  SpreadsheetApp.flush();   // <<< commit the numbers to the sheet NOW
  // ---- flow line: isolated so it can never wipe the numbers above ----
  try {
    var sd = readSameDaySplit_(ss, RAN_DAY_LABEL);
    var flow = RAN_DAY_LABEL + " flow — " + RAN_LEADS + " consults ran · ";
    flow += sd
      ? (sd.sameDay + " sold same-day · " + sd.total + " sold total (" +
         sd.followUp + " follow-up" + (sd.unknown ? ", " + sd.unknown + " unknown" : "") + ") · ")
      : "sold split n/a · ";
    flow += RAN_INSTALLS + " installed (prior sales).  Separate cohorts — today's sold & " +
            "installs trace to earlier leads, not today's " + RAN_LEADS + ".";
    var upRow = -1;
    for (var u = 0; u < dv.length; u++) {
      if (String(dv[u][0] || "").indexOf("Updated ") === 0) upRow = u + 1;
    }
    var flowRow = (upRow > 0 ? upRow : sh.getLastRow()) + 1;
    sh.getRange(flowRow, 2).setValue(flow).setFontColor("#475569").setFontStyle("italic");
    out.push(sd ? "flow (same-day " + sd.sameDay + "/" + sd.total + ")" : "flow (no split)");
    SpreadsheetApp.flush();
  } catch (e) {
    out.push("flow skipped (numbers safe): " + e);
  }
  var msg = RAN_DAY_LABEL + " day estimates: C3='" + c3 + "' → " + out.join(", ") + ".";
  Logger.log(msg);
  return msg;
}
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
        fn === "refreshJobStatus" || fn === "writeGrowthSheetForYesterday") {
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
    lines.push("  " + iso + "    " + pad2_(s) + "     " + pad2_(i) + "      " + pad2_(l) + "     " +
      (l ? (l2c + "%") : "-") + "       " + (s - i));
  })
  ;
  var totL2C = tLead ? Math.round(tInst * 1000 / tLead) / 10 : 0;
  lines.push("  ------------------------------------------------------------");
  lines.push("  TOTAL         " + pad2_(tSold) + "     " + pad2_(tInst) + "      " + pad2_(tLead) + "     " +
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
function readBiLeads_() {
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
          /* On the TBD tab this column is repurposed as a live action note —
          "EMAILED JAY 7/29 AL", "AMBER IS WORKING ON THIS 7/29 AL" — which
          is the most current word on the job anywhere. */
          jobCompleted: at(col("JOB COMPLETED")),
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
    const m = body.match(/^[ \t]*(\d{1,2}\/\d{1,2})\s+\d{1,2}:\d{2}\s*[AP]M\s+(.+?)\s+\d{2,}\s/m);
    if (!m) return;
    const desc = (body.match(/INSTALL DESCRIPTION:\s*(.+)/i) || [])[1] || "";
    out.push({
      customer: m[2].replace(/\(M\)\s*$/i, "").trim(),
      installedOn: m[1],
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

function readSoldAlerts_(days) {
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
    out.push({
      job: jobM[1], amount: amount, soldIso: soldIso, soldMD: dateM[1],
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
  sh.clear();
  var NAVY = "#0f172a", AMBER = "#fff7ed", MUT = "#64748b";
  sh.getRange("A1").setValue("Same-Day Sold — booked appt matched to sold alert by Job #")
    .setFontWeight("bold").setFontSize(13);
  sh.getRange("A2").setValue("Same pipeline as the Sold Today tab: HCA only · re-quotes counted once · wrong-click exclusions honored. SAME-DAY = appointment ran the day it sold.")
    .setFontColor(MUT);
  if (!m.ok) {
    sh.getRange("A4").setValue("Sold-alert read FAILED — numbers not refreshed. Try again shortly.");
    Logger.log("Same-Day Sold tab: read failed; left a notice.");
    return "read failed";
  }
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
  var msg = "Same-Day Sold tab updated (tied to Sold Today): MTD " + t.total + " sold · " +
    t.same + " same-day · " + t.follow + " follow-up" +
    (t.unknown ? " · " + t.unknown + " unknown" : "") + " · $" + Math.round(t.dollars);
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
    appendComplianceRows_(book.ss, plan, byHca, responded, followUpsByHca);
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
function sameDaySoldMonthData_() {
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
  var collapsed = collapseResoldAlerts_(res.alerts)
    .filter(function (a) {
    return a.soldOnIso >= fromIso && a.soldOnIso <= toIso;
  })
  .filter(function (a) {
    /* honor the approval-guard rulings (phantom rentals / phantom CODs) */
    return (typeof stExcluded_ === "function") ? !stExcluded_(a) : true;
  })
  ;
  var booked = readBookedJobs_((typeof BOOKED_LOOKBACK_DAYS !== "undefined") ? BOOKED_LOOKBACK_DAYS : 60);
  var days = {
  };
  collapsed.forEach(function (a) {
    var amt = (isFinite(Number(a.amount)) && a.amount) ? Number(a.amount) : 0;
    var jobKey = (typeof stJobKey_ === "function") ? stJobKey_(a.jobNumber) : String(a.jobNumber || "").trim();
    var cls = jobKey ? classifySameDay_({
      job: jobKey, soldIso: a.soldOnIso
    },
    booked) : {
      tag: "UNKNOWN", ranIso: ""
    };
    var d = days[a.soldOnIso] = days[a.soldOnIso] || {
      total: 0, same: 0, follow: 0, unknown: 0, dollars: 0
    };
    d.total++;
    d.dollars += amt;
    if (cls.tag === "SAME-DAY") d.same++;
    else if (cls.tag === "FOLLOW-UP") d.follow++;
    else d.unknown++;
  })
  ;
  return {
    ok: true, complete: res.complete, fromIso: fromIso, toIso: toIso, days: days, tz: tz
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
  // de-dupe superseded/duplicate: one row per Job#, keep the highest amount
  var byJob = {
  };
  sold.forEach(function (s) {
    if (!byJob[s.job] || s.amount > byJob[s.job].amount) byJob[s.job] = s;
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
    ", applyDayRanEstimates_=" + (typeof applyDayRanEstimates_) +
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
  if (rAvg > 0) daily.getRange("C" + rAvg).setFormula('=IFERROR(C' + rDol + '/C' + rSold + ',"")').setNumberFormat("$#,##0");
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

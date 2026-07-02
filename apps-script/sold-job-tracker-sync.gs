/*
 * HCA Sold Job Tracker Sync
 *
 * Install this in a Google Apps Script project owned by an account that can access:
 * - Gmail ServiceTitan alert emails
 * - COMBO LOG 2026 Google Sheet
 * - Firebase Realtime Database write endpoint
 *
 * Required Script Properties:
 * - FIREBASE_DATABASE_URL = https://install-availability-tracker-default-rtdb.firebaseio.com
 * - FIREBASE_AUTH_TOKEN   = optional; only needed if Firebase rules require REST auth
 *
 * Main function:
 * - syncSoldJobTracker()
 */

const SOLD_TRACKER_CONFIG = {
  spreadsheetId: "16Z-PK7d2Y6MvNHM1vqZ6y0JsezITQG6fYnawomYl46c",
  firebasePath: "cmh_sold_tracker",
  backfillStartIso: "2026-06-01T00:00:00",
  gmailAfterQuery: "after:2026/6/1",
  maxThreadsPerQuery: 500,
  bundleWindowDays: 30,
  timeZone: "America/Los_Angeles"
};

const HCA_CANONICAL = [
  "Adam Weberg",
  "Amber Maddalena",
  "Chester Granard",
  "Davis Diosdado",
  "Javierre Milo",
  "Joe Chounramany",
  "Joseph Ruble",
  "Kyle McAlister",
  "Samir Khoury",
  "Trevor Bohm"
];

const HCA_ALIASES = {
  "ADAM WEBERG": "Adam Weberg",
  "AMBER MADDALENA": "Amber Maddalena",
  "CHESTER GRANARD": "Chester Granard",
  "DAVIS DIOSDADO": "Davis Diosdado",
  "JAY MILO": "Javierre Milo",
  "JAVIERRE MILO": "Javierre Milo",
  "JOE CHOUNRAMANY": "Joe Chounramany",
  "JOE RUBLE": "Joseph Ruble",
  "JOSEPH RUBLE": "Joseph Ruble",
  "KYLE MCALISTER": "Kyle McAlister",
  "SAMIR KHOURY": "Samir Khoury",
  "TREVOR BOHM": "Trevor Bohm"
};

function syncSoldJobTracker() {
  const startedAt = new Date();
  const soldAlerts = readSoldEstimateAlerts_();
  const bookedAlerts = readBookedJobAlerts_();
  const completedAlerts = readCompletedFormAlerts_();
  const combo = readComboLog_();
  const payload = buildSoldTrackerPayload_(soldAlerts, bookedAlerts, completedAlerts, combo, startedAt);
  pushSoldTrackerToFirebase_(payload);
  Logger.log(JSON.stringify(payload.summary, null, 2));
  return payload.summary;
}

function previewSoldJobTracker() {
  const startedAt = new Date();
  const soldAlerts = readSoldEstimateAlerts_();
  const bookedAlerts = readBookedJobAlerts_();
  const completedAlerts = readCompletedFormAlerts_();
  const combo = readComboLog_();
  const payload = buildSoldTrackerPayload_(soldAlerts, bookedAlerts, completedAlerts, combo, startedAt);
  Logger.log(JSON.stringify(payload, null, 2));
  return payload;
}

function setupSoldTrackerDailyTrigger() {
  deleteSoldTrackerTriggers_();
  ScriptApp.newTrigger("syncSoldJobTracker")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone(SOLD_TRACKER_CONFIG.timeZone)
    .create();
}

function deleteSoldTrackerTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "syncSoldJobTracker") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function readSoldEstimateAlerts_() {
  const query = 'subject:"Sold Estimate Alert [Sales Quote]" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  return readServiceTitanMessages_(query).map(msg => {
    const body = msg.body;
    const customer = getField_(body, ["Customer"]);
    const soldBy = getField_(body, ["Sold by", "Sold By"]);
    const rawDate = getField_(body, ["Date"]);
    return {
      source: "Sold Estimate Alert [Sales Quote]",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer: cleanText_(customer),
      hca: normalizeHca_(soldBy),
      soldByRaw: cleanText_(soldBy),
      soldDate: parseServiceTitanDate_(rawDate, msg.emailDate),
      soldDateRaw: cleanText_(rawDate),
      amount: parseMoney_(getField_(body, ["Amount"])),
      estimateName: cleanText_(getField_(body, ["Name", "Estimate Name"])),
      estimateNumber: cleanText_(getField_(body, ["Estimate#", "Estimate #", "Estimate"])),
      opportunityNumber: cleanText_(getField_(body, ["Opportunity#", "Opportunity #", "Opportunity"])),
      jobNumber: cleanText_(getField_(body, ["Job#", "Job #", "Job"])),
      personKey: personKeyFromFullName_(customer)
    };
  }).filter(item => item.customer && item.hca);
}

function readBookedJobAlerts_() {
  const query = 'subject:"Booked Job Alert [Sales Quote]" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  return readServiceTitanMessages_(query).map(msg => {
    const body = msg.body;
    const customer = cleanText_(getField_(body, ["Customer", "Name"]));
    return {
      source: "Booked Job Alert [Sales Quote]",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer,
      personKey: personKeyFromFullName_(customer),
      jobNumber: cleanText_(getField_(body, ["Job#", "Job #", "Job"])),
      appointmentNumber: cleanText_(getField_(body, ["Appointment#", "Appointment #", "Appointment"])),
      businessUnit: cleanText_(getField_(body, ["Business Unit", "BU"])),
      projectType: cleanText_(getField_(body, ["Job Type", "Project Type", "Type"])),
      notes: cleanText_(getField_(body, ["Summary", "Description", "Notes", "Job Notes"])),
      hoa: cleanText_(getField_(body, ["HOA", "Homeowners Association"])),
      timeline: cleanText_(getField_(body, ["Timeline", "When"])),
      systemAge: cleanText_(getField_(body, ["Age of Equipment", "System Age", "Equipment Age"]))
    };
  }).filter(item => item.customer || item.jobNumber || item.appointmentNumber);
}

function readCompletedFormAlerts_() {
  const query = 'subject:"Completed Form Alert" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  return readServiceTitanMessages_(query).map(msg => {
    const body = msg.body;
    const customer = cleanText_(getField_(body, ["Customer", "Name"]));
    return {
      source: "Completed Form Alert",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer,
      personKey: personKeyFromFullName_(customer),
      jobNumber: cleanText_(getField_(body, ["Job#", "Job #", "Job"])),
      formName: cleanText_(getField_(body, ["Form", "Form Name", "Name"])),
      completedDate: isoDate_(msg.emailDate)
    };
  }).filter(item => item.customer || item.jobNumber);
}

function readServiceTitanMessages_(query) {
  const threads = GmailApp.search(query, 0, SOLD_TRACKER_CONFIG.maxThreadsPerQuery);
  const messages = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const subject = message.getSubject() || "";
      if (!subject) return;
      messages.push({
        messageId: message.getId(),
        subject,
        emailDate: message.getDate(),
        body: message.getPlainBody() || ""
      });
    });
  });
  return messages;
}

function readComboLog_() {
  const ss = SpreadsheetApp.openById(SOLD_TRACKER_CONFIG.spreadsheetId);
  const sheets = ss.getSheets();
  const mainRows = [];
  const tbdRows = [];
  sheets.forEach(sheet => {
    const name = sheet.getName();
    const rows = sheetToObjects_(sheet);
    if (!rows.length) return;
    const hasComboHeaders = Object.prototype.hasOwnProperty.call(rows[0], "LAST") && Object.prototype.hasOwnProperty.call(rows[0], "FIRST");
    if (!hasComboHeaders) return;
    const normalized = rows.map(row => normalizeComboRow_(row, name)).filter(Boolean);
    if (/\bTBD\b/i.test(name)) tbdRows.push.apply(tbdRows, normalized);
    else mainRows.push.apply(mainRows, normalized);
  });
  return {
    mainRows: filterBackfillRows_(mainRows),
    tbdRows: filterBackfillRows_(tbdRows)
  };
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(v => normalizeHeader_(v));
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    return obj;
  });
}

function normalizeComboRow_(row, sheetName) {
  const last = cleanText_(row["LAST"]);
  const first = cleanText_(row["FIRST"]);
  if (!last && !first) return null;
  const installDate = parseSheetDate_(row["DATE"]);
  const department = cleanText_(row["DEPARTMENT"]);
  return {
    sourceSheet: sheetName,
    isTbd: /\bTBD\b/i.test(sheetName),
    installDate,
    totalDays: cleanText_(row["TOTAL DAYS"]),
    last,
    first,
    customer: [first, last].filter(Boolean).join(" "),
    personKey: personKeyFromParts_(first, last),
    department,
    jurisdiction: cleanText_(row["JURISDICTION"]),
    mechanical: cleanText_(row["MECHANICAL"]),
    electrical: cleanText_(row["ELECTRICAL"]),
    electricalRequested: cleanText_(row["ELEC RQSTD"]),
    permitNotes: cleanText_(row["PERMIT NOTES"]),
    jobNotes: cleanText_(row["JOB NOTES"]),
    jobCompleted: cleanText_(row["JOB COMPLETED"]),
    ductCleaning: cleanText_(row["DUCT CLEANING"]),
    registration: cleanText_(row["REG EQ"]),
    brand: cleanText_(row["BRAND"]),
    paymentMethod: cleanText_(row["PAYMENT METHOD"]),
    paymentNotes: cleanText_(row["PAYMENT NOTES"]),
    salesRep: normalizeHca_(row["SALES REP"]),
    salesRepRaw: cleanText_(row["SALES REP"])
  };
}

function filterBackfillRows_(rows) {
  const start = new Date(SOLD_TRACKER_CONFIG.backfillStartIso);
  return rows.filter(row => {
    if (!row.installDate) return row.isTbd;
    const d = new Date(row.installDate);
    return !Number.isNaN(d.getTime()) && d >= start;
  });
}

function buildSoldTrackerPayload_(soldAlerts, bookedAlerts, completedAlerts, combo, startedAt) {
  const bookedByKey = groupBy_(bookedAlerts, "personKey");
  const completedByJob = groupBy_(completedAlerts.filter(x => x.jobNumber), "jobNumber");
  const completedByKey = groupBy_(completedAlerts, "personKey");
  const mainByKey = groupBy_(combo.mainRows, "personKey");
  const tbdByKey = groupBy_(combo.tbdRows, "personKey");

  const jobs = soldAlerts.map(sold => {
    const mainMatches = pickComboMatches_(sold, mainByKey[sold.personKey] || [], false);
    const tbdMatches = pickComboMatches_(sold, tbdByKey[sold.personKey] || [], true);
    const primaryCombo = tbdMatches[0] || mainMatches.find(row => row.department.toUpperCase() === "HVAC") || mainMatches[0] || null;
    const booked = (bookedByKey[sold.personKey] || [])[0] || null;
    const completed = (sold.jobNumber && completedByJob[sold.jobNumber] && completedByJob[sold.jobNumber][0]) || (completedByKey[sold.personKey] || [])[0] || null;
    const relatedWork = buildRelatedWork_(sold, combo.mainRows.concat(combo.tbdRows), primaryCombo);
    const stage = determineStage_(primaryCombo, tbdMatches, completed);

    return {
      id: sold.jobNumber || sold.estimateNumber || sold.messageId,
      hca: sold.hca,
      customer: sold.customer,
      stage,
      soldDate: sold.soldDate,
      amount: sold.amount,
      estimateName: sold.estimateName,
      estimateNumber: sold.estimateNumber,
      opportunityNumber: sold.opportunityNumber,
      jobNumber: sold.jobNumber,
      installDate: primaryCombo ? primaryCombo.installDate : null,
      department: primaryCombo ? primaryCombo.department : "HVAC",
      jurisdiction: primaryCombo ? primaryCombo.jurisdiction : "",
      permitNotes: primaryCombo ? primaryCombo.permitNotes : "",
      paymentMethod: primaryCombo ? primaryCombo.paymentMethod : "",
      paymentNotes: primaryCombo ? primaryCombo.paymentNotes : "",
      jobNotes: primaryCombo ? primaryCombo.jobNotes : "",
      jobCompleted: primaryCombo ? primaryCombo.jobCompleted : "",
      ductCleaning: primaryCombo ? primaryCombo.ductCleaning : "",
      registration: primaryCombo ? primaryCombo.registration : "",
      brand: primaryCombo ? primaryCombo.brand : "",
      bookedContext: booked ? compactObject_({
        businessUnit: booked.businessUnit,
        projectType: booked.projectType,
        hoa: booked.hoa,
        timeline: booked.timeline,
        systemAge: booked.systemAge,
        notes: booked.notes
      }) : {},
      relatedWork,
      sourceRefs: {
        soldMessageId: sold.messageId,
        bookedMessageId: booked ? booked.messageId : "",
        completedMessageId: completed ? completed.messageId : "",
        comboSheet: primaryCombo ? primaryCombo.sourceSheet : ""
      }
    };
  });

  const summary = {
    updated: isoDateTime_(startedAt),
    soldAlerts: soldAlerts.length,
    bookedAlerts: bookedAlerts.length,
    completedAlerts: completedAlerts.length,
    comboRows: combo.mainRows.length,
    tbdRows: combo.tbdRows.length,
    jobs: jobs.length,
    needsAttention: jobs.filter(job => job.stage === "SOLD_NEEDS_ATTENTION").length,
    active: jobs.filter(job => job.stage === "SOLD_ACTIVE" || job.stage === "SOLD_PENDING_MATCH").length,
    done: jobs.filter(job => job.stage === "SOLD_DONE_FOLLOW_UP_LATER").length
  };

  return {
    updated: summary.updated,
    sourceStatus: "ok",
    sourceSummary: summary,
    hcas: HCA_CANONICAL,
    jobs
  };
}

function pickComboMatches_(sold, rows, isTbd) {
  const soldDate = sold.soldDate ? new Date(sold.soldDate) : null;
  return rows.filter(row => {
    const hcaMatch = normalizeHca_(row.salesRep) === sold.hca;
    const department = String(row.department || "").toUpperCase();
    const departmentOk = isTbd || department === "HVAC" || department === "";
    const dateOk = isTbd || !soldDate || !row.installDate || daysBetween_(soldDate, new Date(row.installDate)) <= SOLD_TRACKER_CONFIG.bundleWindowDays;
    return hcaMatch && departmentOk && dateOk;
  }).sort((a, b) => {
    if (!soldDate) return 0;
    return daysBetween_(soldDate, new Date(a.installDate || soldDate)) - daysBetween_(soldDate, new Date(b.installDate || soldDate));
  });
}

function buildRelatedWork_(sold, rows, primaryCombo) {
  const soldDate = sold.soldDate ? new Date(sold.soldDate) : null;
  return rows.filter(row => {
    if (row.personKey !== sold.personKey) return false;
    if (primaryCombo && row === primaryCombo) return false;
    if (!soldDate || !row.installDate) return false;
    return daysBetween_(soldDate, new Date(row.installDate)) <= SOLD_TRACKER_CONFIG.bundleWindowDays;
  }).map(row => compactObject_({
    department: row.department,
    installDate: row.installDate,
    salesRep: row.salesRep,
    jurisdiction: row.jurisdiction,
    mechanical: row.mechanical,
    electrical: row.electrical,
    notes: row.jobNotes || row.paymentNotes || row.permitNotes
  })).slice(0, 8);
}

function determineStage_(primaryCombo, tbdMatches, completed) {
  if (tbdMatches && tbdMatches.length) return "SOLD_NEEDS_ATTENTION";
  if (primaryCombo) {
    const joined = [primaryCombo.jobCompleted, primaryCombo.registration, primaryCombo.permitNotes, primaryCombo.paymentMethod].join(" ").toUpperCase();
    if (completed && /DONE|COMPLETE|FINALED|PIF|FUNDS SECURED/.test(joined)) return "SOLD_DONE_FOLLOW_UP_LATER";
    if (/DONE|COMPLETE/.test(String(primaryCombo.jobCompleted || "").toUpperCase())) return "SOLD_DONE_FOLLOW_UP_LATER";
    if (primaryCombo.installDate) return "SOLD_ACTIVE";
  }
  if (completed) return "SOLD_DONE_FOLLOW_UP_LATER";
  return "SOLD_PENDING_MATCH";
}

function pushSoldTrackerToFirebase_(payload) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = (props.getProperty("FIREBASE_DATABASE_URL") || "").replace(/\/$/, "");
  const token = props.getProperty("FIREBASE_AUTH_TOKEN") || "";
  if (!baseUrl) throw new Error("Missing Script Property FIREBASE_DATABASE_URL");
  let url = baseUrl + "/" + SOLD_TRACKER_CONFIG.firebasePath + ".json";
  if (token) url += "?auth=" + encodeURIComponent(token);
  const response = UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Firebase write failed: " + code + " " + response.getContentText());
  }
  return response.getContentText();
}

function getField_(body, labels) {
  const lines = String(body || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^" + escaped + "\\s*:?\\s*(.+)$", "i");
    for (const line of lines) {
      const match = line.match(re);
      if (match) return match[1].trim();
    }
  }
  return "";
}

function cleanText_(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader_(value) {
  return cleanText_(value).toUpperCase();
}

function normalizeHca_(value) {
  const clean = cleanText_(value).toUpperCase();
  return HCA_ALIASES[clean] || cleanText_(value);
}

function parseMoney_(value) {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseSheetDate_(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDate_(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : isoDate_(d);
}

function parseServiceTitanDate_(value, fallbackDate) {
  const raw = cleanText_(value);
  if (!raw) return isoDateTime_(fallbackDate);
  const currentYear = 2026;
  const d = new Date(raw + " " + currentYear);
  if (!Number.isNaN(d.getTime())) return isoDateTime_(d);
  const d2 = new Date(raw);
  if (!Number.isNaN(d2.getTime())) return isoDateTime_(d2);
  return isoDateTime_(fallbackDate);
}

function personKeyFromFullName_(name) {
  const words = cleanText_(name).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0];
  return words[words.length - 1] + "|" + words[0];
}

function personKeyFromParts_(first, last) {
  const f = cleanText_(first).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean)[0] || "";
  const l = cleanText_(last).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean)[0] || "";
  return l && f ? l + "|" + f : (l || f);
}

function groupBy_(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "";
    if (!value) return acc;
    if (!acc[value]) acc[value] = [];
    acc[value].push(item);
    return acc;
  }, {});
}

function compactObject_(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(key => {
    const value = obj[key];
    if (value !== null && value !== undefined && value !== "") out[key] = value;
  });
  return out;
}

function daysBetween_(a, b) {
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 9999;
  return Math.abs(Math.round((b.getTime() - a.getTime()) / 86400000));
}

function isoDate_(date) {
  return Utilities.formatDate(new Date(date), SOLD_TRACKER_CONFIG.timeZone, "yyyy-MM-dd");
}

function isoDateTime_(date) {
  return Utilities.formatDate(new Date(date), SOLD_TRACKER_CONFIG.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

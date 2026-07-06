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
 * - FIREBASE_WEB_API_KEY  = Firebase web API key for anonymous auth
 * - FIREBASE_AUTH_TOKEN   = optional; only needed if Firebase rules require a specific token
 *
 * Main function:
 * - syncSoldJobTracker()
 */

const SOLD_TRACKER_CONFIG = {
  spreadsheetId: "16Z-PK7d2Y6MvNHM1vqZ6y0JsezITQG6fYnawomYl46c",
  firebasePath: "cmh_sold_tracker",
  backfillStartIso: "2026-06-01T00:00:00",
  gmailAfterQuery: "after:2026/6/1",
  serviceTitanFrom: "alerts@servicetitan.com",
  maxThreadsPerQuery: 500,
  comboMatchWindowDays: 120,
  relatedWorkWindowDays: 60,
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
  "TREVOR BOHM": "Trevor Bohm",
  "ADAM": "Adam Weberg",
  "AMBER": "Amber Maddalena",
  "CHESTER": "Chester Granard",
  "DAVIS": "Davis Diosdado",
  "JAY": "Javierre Milo",
  "JAVIERRE": "Javierre Milo",
  "JOE": "Joe Chounramany",
  "JOSEPH": "Joseph Ruble",
  "KYLE": "Kyle McAlister",
  "SAMIR": "Samir Khoury",
  "TREVOR": "Trevor Bohm"
};


const SERVICE_TITAN_FIELD_LABELS = [
  "Booked Job Alert",
  "Sold Estimate Alert",
  "Completed Form Alert",
  "Sales Quote",
  "Name",
  "Estimate Name",
  "Estimate#",
  "Estimate #",
  "Opportunity#",
  "Opportunity #",
  "Sold by",
  "Sold By",
  "Date",
  "Amount",
  "Customer",
  "Job#",
  "Job #",
  "Appointment#",
  "Appointment #",
  "Business Unit",
  "BU",
  "Job Type",
  "Project Type",
  "Type",
  "Summary",
  "Description",
  "Notes",
  "Job Notes",
  "HOA",
  "Homeowners Association",
  "Timeline",
  "When",
  "Age of Equipment",
  "System Age",
  "Equipment Age",
  "Form",
  "Form Name"
];

function syncSoldJobTracker() {
  const startedAt = new Date();
  const soldAlerts = readSoldEstimateAlerts_();
  const bookedAlerts = readBookedJobAlerts_();
  const completedAlerts = readCompletedFormAlerts_();
  const combo = readComboLog_();
  const payload = buildSoldTrackerPayload_(soldAlerts, bookedAlerts, completedAlerts, combo, startedAt);
  pushSoldTrackerToFirebase_(payload);
  Logger.log(JSON.stringify(payload.sourceSummary, null, 2));
  return payload.sourceSummary;
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
  const query = 'from:' + SOLD_TRACKER_CONFIG.serviceTitanFrom + ' subject:"Sold Estimate Alert [Sales Quote]" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  const rows = readServiceTitanMessages_(query, "Sold Estimate Alert [Sales Quote]").map(msg => {
    const body = getServiceTitanBody_(msg.body, "Sold Estimate Alert");
    const customerRaw = getField_(body, ["Customer"]);
    const soldByRaw = getField_(body, ["Sold by", "Sold By"]);
    const rawDate = getField_(body, ["Date"]);
    const customer = cleanServiceTitanDisplay_(customerRaw);
    const hca = normalizeHca_(cleanServiceTitanDisplay_(soldByRaw));
    return {
      source: "Sold Estimate Alert [Sales Quote]",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer,
      hca,
      soldByRaw: cleanText_(soldByRaw),
      soldDate: parseServiceTitanDate_(rawDate, msg.emailDate),
      soldDateRaw: cleanText_(rawDate),
      amount: parseMoney_(getField_(body, ["Amount"])),
      estimateName: cleanServiceTitanDisplay_(getField_(body, ["Name", "Estimate Name"])),
      estimateNumber: extractServiceTitanNumber_(getField_(body, ["Estimate#", "Estimate #"])),
      opportunityNumber: extractServiceTitanNumber_(getField_(body, ["Opportunity#", "Opportunity #"])),
      jobNumber: extractServiceTitanNumber_(getField_(body, ["Job#", "Job #"])),
      personKey: personKeyFromFullName_(customer)
    };
  }).filter(item => item.customer && item.hca && HCA_CANONICAL.includes(item.hca))
    .filter(item => !shouldExcludeSoldTrackerEstimate_(item));
  return collapseDuplicateSoldAlerts_(dedupeBy_(rows, item => item.jobNumber || item.estimateNumber || item.messageId));
}

function shouldExcludeSoldTrackerEstimate_(item) {
  const text = normalizeDuplicateText_([
    item.estimateName,
    item.customer
  ].filter(Boolean).join(" "));

  const hasPrimaryHvacScope = /\b(FURNACE|HEAT PUMP|HP|AC|AIR CONDITIONER|AIR CONDITIONING|DUCTLESS|MINI SPLIT|MINISPLIT|MITSUBISHI|MIDEA|DAIKIN|GOODMAN|AMERICAN STANDARD|AMERISTAR|QUEST|AIR HANDLER|COIL|FULL SYSTEM|HPAH|DUAL FUEL)\b/.test(text);

  if (hasPrimaryHvacScope) return false;

  if (/\bAIR RANGER\b/.test(text) && /\b(STAND ALONE|STANDALONE|MAINTENANCE CLUB)\b/.test(text)) return true;
  if (/\bDRYER VENT\b/.test(text) && /\b(PAN OFF|CLEAN|CLEANING)\b/.test(text)) return true;

  return false;
}

function collapseDuplicateSoldAlerts_(rows) {
  const clusters = [];
  const sorted = rows.slice().sort((a, b) => {
    return new Date(a.soldDate || a.emailDate).getTime() - new Date(b.soldDate || b.emailDate).getTime();
  });

  sorted.forEach(row => {
    const key = [
      row.hca,
      row.personKey,
      normalizeDuplicateText_(row.estimateName),
      String(row.amount === null || row.amount === undefined ? "" : row.amount)
    ].join("|");

    const rowDate = new Date(row.soldDate || row.emailDate);
    const cluster = clusters.find(existing => {
      if (existing.key !== key) return false;
      return daysBetween_(new Date(existing.latestDate), rowDate) <= 3;
    });

    if (!cluster) {
      clusters.push({
        key,
        latestDate: row.soldDate || row.emailDate,
        item: row,
        count: 1,
        refs: row.messageId ? [row.messageId] : []
      });
      return;
    }

    cluster.count += 1;
    if (row.messageId) cluster.refs.push(row.messageId);

    const existingDate = new Date(cluster.latestDate);
    if (!Number.isNaN(rowDate.getTime()) && (Number.isNaN(existingDate.getTime()) || rowDate >= existingDate)) {
      cluster.latestDate = row.soldDate || row.emailDate;
      cluster.item = row;
    }

    cluster.item.duplicateSoldAlertCount = cluster.count;
    cluster.item.duplicateSoldAlertRefs = cluster.refs;
  });

  return clusters.map(cluster => cluster.item);
}

function normalizeDuplicateText_(value) {
  return cleanText_(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function readBookedJobAlerts_() {
  const query = 'from:' + SOLD_TRACKER_CONFIG.serviceTitanFrom + ' subject:"Booked Job Alert [Sales Quote]" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  const rows = readServiceTitanMessages_(query, "Booked Job Alert [Sales Quote]").map(msg => {
    const body = getServiceTitanBody_(msg.body, "Booked Job Alert");
    const customer = cleanServiceTitanDisplay_(getField_(body, ["Customer", "Name"]) || inferBookedCustomer_(body));
    return {
      source: "Booked Job Alert [Sales Quote]",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer,
      personKey: personKeyFromFullName_(customer),
      jobNumber: extractServiceTitanNumber_(getField_(body, ["Job#", "Job #"]) || inferHashNumber_(body)),
      appointmentNumber: extractServiceTitanNumber_(getField_(body, ["Appointment#", "Appointment #"])) || cleanText_(getField_(body, ["Appointment#", "Appointment #"])),
      businessUnit: cleanServiceTitanDisplay_(getField_(body, ["Business Unit", "BU"])),
      projectType: cleanServiceTitanDisplay_(getField_(body, ["Job Type", "Project Type", "Type"])),
      notes: cleanServiceTitanDisplay_(getField_(body, ["Summary", "Description", "Notes", "Job Notes"])),
      hoa: cleanServiceTitanDisplay_(getField_(body, ["HOA", "Homeowners Association"])),
      timeline: cleanServiceTitanDisplay_(getField_(body, ["Timeline", "When"])),
      systemAge: cleanServiceTitanDisplay_(getField_(body, ["Age of Equipment", "System Age", "Equipment Age"]))
    };
  }).filter(item => item.customer || item.jobNumber || item.appointmentNumber);
  return dedupeBy_(rows, item => item.jobNumber || item.appointmentNumber || item.messageId);
}

function readCompletedFormAlerts_() {
  const query = 'from:' + SOLD_TRACKER_CONFIG.serviceTitanFrom + ' subject:"Completed Form Alert" ' + SOLD_TRACKER_CONFIG.gmailAfterQuery;
  const rows = readServiceTitanMessages_(query, "Completed Form Alert").map(msg => {
    const body = getServiceTitanBody_(msg.body, "Completed Form Alert");
    const customer = cleanServiceTitanDisplay_(getField_(body, ["Customer", "Name"]) || inferCompletedCustomer_(body));
    return {
      source: "Completed Form Alert",
      messageId: msg.messageId,
      emailDate: msg.emailDate,
      subject: msg.subject,
      customer,
      personKey: personKeyFromFullName_(customer),
      jobNumber: extractServiceTitanNumber_(getField_(body, ["Job#", "Job #"]) || inferHashNumber_(body)),
      formName: cleanServiceTitanDisplay_(getField_(body, ["Form", "Form Name", "Name"])),
      completedDate: isoDate_(msg.emailDate)
    };
  }).filter(item => item.customer || item.jobNumber);
  return dedupeBy_(rows, item => item.jobNumber || item.messageId);
}

function readServiceTitanMessages_(query, subjectNeedle) {
  const threads = GmailApp.search(query, 0, SOLD_TRACKER_CONFIG.maxThreadsPerQuery);
  const messages = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const subject = message.getSubject() || "";
      const from = message.getFrom() || "";
      if (subjectNeedle && subject.indexOf(subjectNeedle) === -1) return;
      if (from.toLowerCase().indexOf(SOLD_TRACKER_CONFIG.serviceTitanFrom.toLowerCase()) === -1) return;
      messages.push({
        messageId: message.getId(),
        subject,
        from,
        emailDate: message.getDate(),
        body: message.getPlainBody() || ""
      });
    });
  });
  return messages;
}

function getServiceTitanBody_(body, alertMarker) {
  const text = String(body || "").replace(/\u00a0/g, " ");
  const markerIndex = alertMarker ? text.toLowerCase().indexOf(alertMarker.toLowerCase()) : -1;
  if (markerIndex >= 0) return text.slice(markerIndex);
  return text;
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
  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  if (values.length < 2) return [];
  const headers = displayValues[0].map(v => normalizeHeader_(v));
  return values.slice(1).map((row, rowOffset) => {
    const obj = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = row[index];
      const displayValue = displayValues[rowOffset + 1][index];
      obj[header] = value instanceof Date ? displayValue : value;
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
    const rowHca = normalizeHca_(row.salesRep);
    const hcaMatch = !rowHca || rowHca === sold.hca;
    const department = String(row.department || "").toUpperCase();
    const departmentOk = department === "HVAC" || department === "";
    const dateOk = isTbd || !soldDate || !row.installDate || daysBetween_(soldDate, new Date(row.installDate)) <= SOLD_TRACKER_CONFIG.comboMatchWindowDays;
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
    return daysBetween_(soldDate, new Date(row.installDate)) <= SOLD_TRACKER_CONFIG.relatedWorkWindowDays;
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
  if (!baseUrl) throw new Error("Missing Script Property FIREBASE_DATABASE_URL");

  const explicitToken = props.getProperty("FIREBASE_AUTH_TOKEN") || "";
  const authToken = explicitToken || getFirebaseAnonymousIdToken_();

  let url = baseUrl + "/" + SOLD_TRACKER_CONFIG.firebasePath + ".json";
  url += "?auth=" + encodeURIComponent(authToken);

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

function getFirebaseAnonymousIdToken_() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("FIREBASE_WEB_API_KEY");
  if (!apiKey) throw new Error("Missing Script Property FIREBASE_WEB_API_KEY");

  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(apiKey),
    {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ returnSecureToken: true })
    }
  );

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Firebase anonymous auth failed: " + code + " " + body);
  }

  const parsed = JSON.parse(body);
  if (!parsed.idToken) throw new Error("Firebase anonymous auth did not return idToken");
  return parsed.idToken;
}

function getField_(body, labels) {
  const text = String(body || "").replace(/\u00a0/g, " ");
  const labelsToFind = labels.map(escapeRegex_).join("|");
  const stopLabels = SERVICE_TITAN_FIELD_LABELS.map(escapeRegex_).join("|");
  const compact = text.replace(/\s+/g, " ").trim();
  const compactRegex = new RegExp("(?:^|\\s)(?:" + labelsToFind + ")\\s*:?\\s*(.*?)(?=\\s(?:" + stopLabels + ")\\s*:|$)", "i");
  const compactMatch = compact.match(compactRegex);
  if (compactMatch && cleanText_(compactMatch[1])) return cleanText_(compactMatch[1]);

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const label of labels) {
    const re = new RegExp("^" + escapeRegex_(label) + "\\s*:?\\s*(.+)$", "i");
    for (const line of lines) {
      const match = line.match(re);
      if (match) return trimAtNextLabel_(match[1]);
    }
  }
  return "";
}

function trimAtNextLabel_(value) {
  const stopLabels = SERVICE_TITAN_FIELD_LABELS.map(escapeRegex_).join("|");
  const re = new RegExp("^(.*?)(?=\\s(?:" + stopLabels + ")\\s*:|$)", "i");
  const match = cleanText_(value).match(re);
  return match ? cleanText_(match[1]) : cleanText_(value);
}

function cleanServiceTitanDisplay_(value) {
  return cleanText_(String(value || "")
    .replace(/<https?:\/\/[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+Alert:?$/i, "")
  );
}

function extractServiceTitanNumber_(value) {
  const clean = cleanText_(value);
  const match = clean.match(/\b\d{6,}\b/);
  return match ? match[0] : "";
}

function inferBookedCustomer_(body) {
  const lines = String(body || "").split(/\r?\n/).map(line => cleanText_(line)).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s*(AM|PM)$/i.test(lines[i])) {
      const candidate = lines[i + 1];
      if (/^[A-Za-z][A-Za-z .'-]+$/.test(candidate) && !/^BUSINESS UNIT/i.test(candidate)) return candidate;
    }
  }
  return "";
}

function inferCompletedCustomer_(body) {
  const compact = String(body || "").replace(/\s+/g, " ").trim();
  const match = compact.match(/\b\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s+(.+?)\s+\d{2,6}\s+/i);
  return match ? cleanText_(match[1]) : "";
}

function inferHashNumber_(body) {
  const match = String(body || "").match(/#\s*(\d{6,})/);
  return match ? match[1] : "";
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

  const raw = cleanText_(value);
  const slash = raw.match(/^(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return String(year).padStart(4, "0") + "-" +
        String(month).padStart(2, "0") + "-" +
        String(day).padStart(2, "0");
    }
  }

  const iso = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (iso) return raw;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, SOLD_TRACKER_CONFIG.timeZone, "yyyy-MM-dd");
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : Utilities.formatDate(d, SOLD_TRACKER_CONFIG.timeZone, "yyyy-MM-dd");
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

function nameWords_(value) {
  return cleanServiceTitanDisplay_(value)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !["M", "F", "MR", "MRS", "MS", "JR", "SR", "II", "III", "IV"].includes(word));
}

function isOrganizationName_(name) {
  const text = cleanServiceTitanDisplay_(name).toUpperCase();
  return /\b(CHURCH|LLC|INC|CORP|COMPANY|ASSOCIATION|HOA|BAPTIST|CENTER|SCHOOL|RESTAURANT|PROPERTY|PROPERTIES|APARTMENTS|CONDOMINIUM|CONDO|MINISTRIES)\b/.test(text);
}

function organizationKey_(name) {
  return cleanServiceTitanDisplay_(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function personKeyFromFullName_(name) {
  if (isOrganizationName_(name)) return organizationKey_(name);
  const words = nameWords_(name);
  if (!words.length) return "";
  if (words.length === 1) return words[0];
  return words[words.length - 1] + "|" + words[0];
}



function personKeyFromParts_(first, last) {
  if (!cleanText_(first) && isOrganizationName_(last)) return organizationKey_(last);
  const firstWords = nameWords_(first);
  const lastWords = nameWords_(last);
  const f = firstWords[0] || "";
  const l = lastWords.length ? lastWords[lastWords.length - 1] : "";
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

function dedupeBy_(items, keyFn) {
  const seen = {};
  return items.filter(item => {
    const key = keyFn(item);
    if (!key) return true;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
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

function escapeRegex_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

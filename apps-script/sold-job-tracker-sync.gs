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
  timeZone: "America/Los_Angeles",

  /* Email updates about a deal.
     A Gmail search costs a round trip and there are a couple of hundred sold
     jobs, so this is budgeted: results are cached in the payload itself and
     carried forward, and only jobs whose notes have gone stale are searched
     again — live jobs first. Set emailNotesEnabled false to turn it off. */
  emailNotesEnabled: true,
  emailNoteLookbackDays: 90,
  emailNoteRefreshHours: 6,
  emailNoteMaxSearchesPerRun: 40,
  emailNoteThreadsPerJob: 8,
  maxEmailNotesPerJob: 5
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



const CUSTOMER_NAME_ALIASES = {
  "JAE KIM": "TOPSTONE HOLDINGS"
};

const SOLD_TRACKER_EXCLUDED_JOB_NUMBERS = {
  "403071370": "Hobo Joe - test environment",
  "397908109": "Wayne Ho - custom ductwork corrections",
  "402164750": "Ralph Alexander - cancelled install",
  "399411772": "Bill Havelka - standalone Air Ranger"
};

const SOLD_TRACKER_EXCLUDED_ESTIMATE_NUMBERS = {
  "403381591": "Hobo Joe - test environment",
  "398353736": "Wayne Ho - custom ductwork corrections",
  "402319098": "Ralph Alexander - cancelled install",
  "399777519": "Bill Havelka - standalone Air Ranger"
};


const SOLD_TRACKER_CUSTOMER_NAME_BY_JOB_NUMBER = {
  "400247160": "April and Robert Pearson",
  "400716079": "Jeffrey Morris"
};

const SOLD_TRACKER_CUSTOMER_NAME_BY_ESTIMATE_NUMBER = {
  "400317699": "April and Robert Pearson",
  "402477206": "Jeffrey Morris"
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

  /* Read before write: last run's payload is the cache the email budget works
     against. Coordination notes need no cache — they come off the sheet. */
  const previous = readSoldTrackerFromFirebase_();
  const emailStats = attachEmailUpdates_(payload, previous, startedAt);
  payload.sourceSummary.emailUpdates = emailStats;

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

/*
 * Coordination notes and email updates for one customer, printed. Writes
 * nothing — for checking what the tracker will show before a full sync.
 */
function previewDealNotes(customerName) {
  const name = cleanText_(customerName);
  if (!name) {
    Logger.log('Call it with a name: previewDealNotes("Jessiah Johnson")');
    return null;
  }

  const combo = readComboLog_();
  const signature = nameSignature_(name);
  const rows = combo.mainRows.concat(combo.tbdRows)
    .filter(row => fuzzyNameMatch_(signature, comboRowSignature_(row)));

  const out = {
    customer: name,
    comboRowsMatched: rows.length,
    coordinationNotes: buildCoordinationNotes_(rows, rows[0] || null),
    emailUpdates: readDealEmailNotes_(name, SOLD_TRACKER_CONFIG.emailNoteLookbackDays)
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
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

    const estimateNumber = extractServiceTitanNumber_(getField_(body, ["Estimate#", "Estimate #"]));
    const opportunityNumber = extractServiceTitanNumber_(getField_(body, ["Opportunity#", "Opportunity #"]));
    const jobNumber = extractServiceTitanNumber_(getField_(body, ["Job#", "Job #"]));

    const customer = resolveSoldTrackerCustomerName_(customerRaw, jobNumber, estimateNumber);
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
      estimateNumber,
      opportunityNumber,
      jobNumber,
      personKey: personKeyFromFullName_(customer)
    };
  }).filter(item => item.customer && item.hca && HCA_CANONICAL.includes(item.hca))
    .filter(item => !shouldExcludeSoldTrackerEstimate_(item));

  return collapseDuplicateSoldAlerts_(dedupeBy_(rows, item => item.jobNumber || item.estimateNumber || item.messageId));
}

function isMalformedSoldCustomerName_(name) {
  const text = normalizeDuplicateText_(name);
  return /^CUSTOMER NEEDS\b/.test(text)
    || /^NEEDS\b/.test(text)
    || /\b(APPROXIMATE PAYMENT|QUALIFIES FOR|CUSTOM OFFER|REMOTE COIL|BTU HIGH EFFICIENCY)\b/.test(text);
}

function resolveSoldTrackerCustomerName_(customerRaw, jobNumber, estimateNumber) {
  const jobKey = String(jobNumber || "").trim();
  const estimateKey = String(estimateNumber || "").trim();

  if (jobKey && SOLD_TRACKER_CUSTOMER_NAME_BY_JOB_NUMBER[jobKey]) {
    return canonicalCustomerName_(SOLD_TRACKER_CUSTOMER_NAME_BY_JOB_NUMBER[jobKey]);
  }

  if (estimateKey && SOLD_TRACKER_CUSTOMER_NAME_BY_ESTIMATE_NUMBER[estimateKey]) {
    return canonicalCustomerName_(SOLD_TRACKER_CUSTOMER_NAME_BY_ESTIMATE_NUMBER[estimateKey]);
  }

  const candidate = canonicalCustomerName_(cleanServiceTitanDisplay_(customerRaw));
  return isMalformedSoldCustomerName_(candidate) ? "" : candidate;
}

function shouldExcludeSoldTrackerEstimate_(item) {
  const jobNumber = String(item.jobNumber || "").trim();
  const estimateNumber = String(item.estimateNumber || "").trim();

  if (jobNumber && SOLD_TRACKER_EXCLUDED_JOB_NUMBERS[jobNumber]) return true;
  if (estimateNumber && SOLD_TRACKER_EXCLUDED_ESTIMATE_NUMBERS[estimateNumber]) return true;

  const text = normalizeDuplicateText_([
    item.estimateName,
    item.customer
  ].filter(Boolean).join(" "));

  const primaryHvacTerms = [
    "FURNACE",
    "HEAT PUMP",
    "HP",
    "AC",
    "AIR CONDITIONER",
    "AIR CONDITIONING",
    "DUCTLESS",
    "MINI SPLIT",
    "MINISPLIT",
    "MITSUBISHI",
    "MIDEA",
    "DAIKIN",
    "GOODMAN",
    "AMERICAN STANDARD",
    "AMERISTAR",
    "QUEST",
    "AIR HANDLER",
    "COIL",
    "FULL SYSTEM",
    "HPAH",
    "DUAL FUEL"
  ];

  const hasPrimaryHvacScope = primaryHvacTerms.some(term => {
    return new RegExp("\\b" + term.replace(/ /g, "\\s+") + "\\b").test(text);
  });

  if (hasPrimaryHvacScope) return false;

  if (/\bAIR RANGER\b/.test(text) && /\b(STAND ALONE|STANDALONE|MAINTENANCE CLUB)\b/.test(text)) return true;
  if (/\bDRYER VENT\b/.test(text) && /\b(PAN OFF|CLEAN|CLEANING)\b/.test(text)) return true;
  if (/\bCUSTOM DUCTWORK CORRECTIONS\b/.test(text)) return true;

  if (/\bHOBO JOE\b/.test(text)) return true;
  if (/\bREANTAL 2\b/.test(text)) return true;

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
    const mainResolved = resolveComboRows_(sold, mainByKey, combo.mainRows);
    const tbdResolved = resolveComboRows_(sold, tbdByKey, combo.tbdRows);
    const comboRows = mainResolved.rows.concat(tbdResolved.rows);

    const mainMatches = pickComboMatches_(sold, mainResolved.rows, false);
    const tbdMatches = pickComboMatches_(sold, tbdResolved.rows, true);
    const tbdDependencyMatches = pickTbdDependencyMatches_(sold, tbdResolved.rows);
    const primaryCombo = tbdMatches[0] || mainMatches.find(row => row.department.toUpperCase() === "HVAC") || mainMatches[0] || null;
    const booked = resolveAlertMatch_(sold, bookedByKey, bookedAlerts);
    const completed = (sold.jobNumber && completedByJob[sold.jobNumber] && completedByJob[sold.jobNumber][0]) ||
      resolveAlertMatch_(sold, completedByKey, completedAlerts);
    const relatedWork = buildRelatedWork_(sold, comboRows, primaryCombo);
    const coordinationNotes = buildCoordinationNotes_(comboRows, primaryCombo);
    const stage = determineStage_(primaryCombo, tbdMatches, completed, tbdDependencyMatches);

    // How the COMBO LOG row was found, so a spelling-driven match can be
    // spot-checked rather than taken on faith.
    const comboMatch = primaryCombo
      ? (mainMatches.indexOf(primaryCombo) !== -1 ? mainResolved.method : tbdResolved.method)
      : "none";

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
      comboMatch,
      comboCustomer: primaryCombo && comboMatch === "fuzzy" ? primaryCombo.customer : "",
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
      coordinationNotes,
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
    done: jobs.filter(job => job.stage === "SOLD_DONE_FOLLOW_UP_LATER").length,
    fuzzyComboMatches: jobs.filter(job => job.comboMatch === "fuzzy").length,
    pendingComboMatch: jobs.filter(job => job.stage === "SOLD_PENDING_MATCH").length,
    coordinationNotes: jobs.reduce((n, job) => n + (job.coordinationNotes || []).length, 0)
  };

  return {
    updated: summary.updated,
    sourceStatus: "ok",
    sourceSummary: summary,
    hcas: HCA_CANONICAL,
    jobs
  };
}

function pickTbdDependencyMatches_(sold, rows) {
  return rows.filter(row => {
    const rowHca = normalizeHca_(row.salesRep);
    const hcaMatch = !rowHca || rowHca === sold.hca;

    const department = String(row.department || "").toUpperCase();

    // HVAC/blank TBD rows are already handled as primary TBD matches.
    // This function is only for dependencies like ELEC panel swaps.
    const isDependencyDepartment = department && department !== "HVAC";

    return hcaMatch && isDependencyDepartment;
  }).sort((a, b) => {
    return String(a.department || "").localeCompare(String(b.department || ""));
  });
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

/* ---------------------------------------------------------------------------
 * Coordination notes
 *
 * The install coordinators work the COMBO LOG by hand — a permit note here, a
 * payment note there, "EMAILED JAY 7/29 AL" in the JOB COMPLETED column of a
 * TBD row. Until now the tracker showed a handful of those as chips and
 * dropped the rest, so the HCA saw "no install date" without the sentence
 * explaining why.
 *
 * Every note column on every matched row is collected instead, labelled with
 * the column it came from and which sheet it was on, so a TBD electrical note
 * is not mistaken for the HVAC row's.
 * ------------------------------------------------------------------------- */

const COORDINATION_NOTE_FIELDS = [
  { key: "jobNotes", label: "Job notes" },
  { key: "permitNotes", label: "Permit" },
  { key: "paymentNotes", label: "Payment" },
  { key: "paymentMethod", label: "Payment method" },
  { key: "mechanical", label: "Mechanical permit" },
  { key: "electrical", label: "Electrical permit" },
  { key: "electricalRequested", label: "Electrical requested" },
  { key: "ductCleaning", label: "Duct cleaning" },
  { key: "registration", label: "Equipment registration" },
  { key: "jobCompleted", label: "Job completed" }
];

/* All-caps words that show up at the end of a note and are not somebody's
   initials. Without this list "PAID IN FULL PIF" reads as a note by "PIF". */
const NOT_INITIALS = [
  "TBD", "HOA", "PIF", "COD", "ACH", "EFT", "HVAC", "ELEC", "MECH", "WH",
  "AC", "HP", "DF", "NA", "OK", "NO", "YES", "ASAP", "EOD", "AM", "PM",
  "CC", "PO", "SO", "ETA", "RTU", "AHU", "DIY", "GC", "HO"
];

function isPlaceholderNote_(text) {
  const t = cleanText_(text).toUpperCase();
  if (!t) return true;
  if (/^[-–—_.*x\s]+$/i.test(t)) return true;
  return t === "N/A" || t === "NA" || t === "NONE" || t === "0";
}

/*
 * The coordinators stamp their notes "EMAILED JAY 7/29 AL" — what happened,
 * when, and who. Pulling the date and the initials out lets the tracker sort
 * and attribute them; the note text is left whole either way, so nothing is
 * lost if the convention was not followed.
 */
function parseNoteStamp_(text, contextIso) {
  const raw = cleanText_(text);
  const out = { date: "", initials: "" };

  const date = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (date) {
    const month = Number(date[1]);
    const day = Number(date[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = date[3] ? Number(date[3]) : Number(String(contextIso || "").slice(0, 4));
      if (!year) year = Number(Utilities.formatDate(new Date(), SOLD_TRACKER_CONFIG.timeZone, "yyyy"));
      if (year < 100) year += 2000;
      out.date = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    }
  }

  /* Initials only at the very end, and only when there is a note in front of
     them — a cell containing nothing but "AL" is not an attributed note. */
  const tail = raw.match(/\s([A-Z]{2,3})[.\s]*$/);
  if (tail && NOT_INITIALS.indexOf(tail[1]) === -1 && raw.split(/\s+/).length >= 3) {
    out.initials = tail[1];
  }
  return out;
}

function buildCoordinationNotes_(rows, primaryCombo) {
  const notes = [];
  const seen = {};

  (rows || []).forEach(row => {
    COORDINATION_NOTE_FIELDS.forEach(field => {
      const text = cleanText_(row[field.key]);
      if (isPlaceholderNote_(text)) return;

      /* On a TBD tab the JOB COMPLETED column is repurposed as a live action
         note — "AMBER IS WORKING ON THIS 7/29 AL" — so labelling it
         "Job completed" there would say the opposite of what it means. */
      const label = (row.isTbd && field.key === "jobCompleted") ? "TBD status" : field.label;

      const key = (label + "|" + row.sourceSheet + "|" + text).toUpperCase();
      if (seen[key]) return;
      seen[key] = true;

      const stamp = parseNoteStamp_(text, row.installDate);
      notes.push(compactObject_({
        source: "COMBO LOG",
        sheet: row.sourceSheet,
        department: row.department,
        label: label,
        text: text,
        on: stamp.date,
        by: stamp.initials,
        onPrimaryRow: primaryCombo && row === primaryCombo ? true : ""
      }));
    });
  });

  /* Dated notes first, newest first; undated ones keep sheet order behind them
     rather than being sorted arbitrarily. */
  return notes.sort((a, b) => {
    if (a.on && b.on) return a.on < b.on ? 1 : (a.on > b.on ? -1 : 0);
    if (a.on) return -1;
    if (b.on) return 1;
    return 0;
  }).slice(0, 24);
}

function buildRelatedWork_(sold, rows, primaryCombo) {
  const soldDate = sold.soldDate ? new Date(sold.soldDate) : null;

  return rows.filter(row => {
    if (primaryCombo && row === primaryCombo) return false;

    // Include TBD dependency rows even without an install date.
    // Example: HVAC sold by HCA, electrical panel swap on TBD holding the install.
    if (row.isTbd) return true;

    if (!soldDate || !row.installDate) return false;
    return daysBetween_(soldDate, new Date(row.installDate)) <= SOLD_TRACKER_CONFIG.relatedWorkWindowDays;
  }).map(row => compactObject_({
    department: row.department,
    installDate: row.installDate,
    sourceSheet: row.sourceSheet,
    salesRep: row.salesRep,
    jurisdiction: row.jurisdiction,
    mechanical: row.mechanical,
    electrical: row.electrical,
    permitNotes: row.permitNotes,
    jobCompleted: row.jobCompleted,
    notes: row.jobNotes || row.paymentNotes || row.permitNotes
  })).slice(0, 8);
}

function determineStage_(primaryCombo, tbdMatches, completed, tbdDependencyMatches) {
  if ((tbdMatches && tbdMatches.length) || (tbdDependencyMatches && tbdDependencyMatches.length)) {
    return "SOLD_NEEDS_ATTENTION";
  }

  if (primaryCombo) {
    const joined = [primaryCombo.jobCompleted, primaryCombo.registration, primaryCombo.permitNotes, primaryCombo.paymentMethod].join(" ").toUpperCase();
    if (completed && /DONE|COMPLETE|FINALED|PIF|FUNDS SECURED/.test(joined)) return "SOLD_DONE_FOLLOW_UP_LATER";
    if (/DONE|COMPLETE/.test(String(primaryCombo.jobCompleted || "").toUpperCase())) return "SOLD_DONE_FOLLOW_UP_LATER";
    if (primaryCombo.installDate) return "SOLD_ACTIVE";
  }

  if (completed) return "SOLD_DONE_FOLLOW_UP_LATER";
  return "SOLD_PENDING_MATCH";
}

/* ---------------------------------------------------------------------------
 * Email updates
 *
 * Everything said about a homeowner by email that is not a ServiceTitan alert
 * — the coordinator chasing a panel upgrade, the HCA reporting the customer
 * moved money around, the permit office reply. At the 1:1 that correspondence
 * is the story of the deal, and it was previously only findable by searching
 * Gmail by hand.
 *
 * The reader and summariser are deliberately the same shape as the ones in
 * daily-recap.gs. Those live in a separate Apps Script project and cannot be
 * imported; if the signature-trimming rules change in one, change both.
 * ------------------------------------------------------------------------- */

function readDealEmailNotes_(customer, sinceDays) {
  const name = cleanText_(customer);
  if (name.length < 4) return [];

  const exclude = ' -from:' + SOLD_TRACKER_CONFIG.serviceTitanFrom + ' -subject:"Daily Recap"';
  const window = " newer_than:" + Math.max(7, Math.min(180, sinceDays || 90)) + "d";
  const cap = SOLD_TRACKER_CONFIG.emailNoteThreadsPerJob;

  let threads = [];
  try {
    threads = GmailApp.search('"' + name.replace(/"/g, "") + '"' + exclude + window, 0, cap);
    /* Internal mail usually says the surname only — "any update on Manrao?" —
       so fall back, but only to a token distinctive enough to stand alone. */
    if (!threads.length) {
      const tokens = name.split(/\s+/).filter(t => t.length >= 6 && !/^and$/i.test(t));
      const distinctive = tokens[tokens.length - 1];
      if (distinctive) {
        threads = GmailApp.search('"' + distinctive + '"' + exclude + window, 0, cap);
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
    /* The last word on a thread is the one that matters. */
    const msg = messages[messages.length - 1];
    if (!msg) return;

    const who = emailSenderName_(msg.getFrom());
    const summary = summariseDealEmail_(msg.getPlainBody(), who);
    if (!summary) return;

    notes.push({
      on: Utilities.formatDate(msg.getDate(), SOLD_TRACKER_CONFIG.timeZone, "yyyy-MM-dd"),
      from: who,
      /* "Re: FW: Sold Estimate Alert" needs every prefix off, not just one. */
      subject: String(msg.getSubject() || "").replace(/^((re|fw|fwd)\s*:\s*)+/i, "").trim(),
      text: summary,
      link: "https://mail.google.com/mail/u/0/#all/" + thread.getId(),
      receivedMs: msg.getDate().getTime()
    });
  });

  notes.sort((a, b) => b.receivedMs - a.receivedMs);
  return notes.slice(0, SOLD_TRACKER_CONFIG.maxEmailNotesPerJob).map(n => {
    delete n.receivedMs;
    return n;
  });
}

/*
 * The sender's own words, trimmed to something readable at a glance.
 *
 * Everyone here signs with name, title, direct line, address. The signature
 * has to be cut rather than filtered line by line: "Amber Maddalena" and
 * "Comfort Advisor" are ordinary-looking lines and only their position gives
 * them away. So the first signature marker ends the message and nothing after
 * it is kept.
 */
function summariseDealEmail_(body, senderName) {
  const own = emailOwnText_(body);
  const who = cleanText_(senderName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const out = [];

  const lines = String(own || "").split(/\r?\n/).map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    /* Signature starts here — stop, do not merely skip. */
    if (who && line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === who) break;
    if (line.length < 45 && /\b(advisor|manager|coordinator|consultant|supervisor|director|specialist|representative|technician)\s*$/i.test(line)) break;
    if (/cmheating\.com|^www\.|\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/i.test(line)) break;
    if (/^(warmest regards|regards|thank you|thanks|best|sincerely)[,!]?\s*$/i.test(line)) break;

    /* Quote scaffolding, not signature — skip and keep reading. */
    if (/^(on .*wrote:|from:|sent:|to:|cc:|subject:)/i.test(line)) continue;
    if (/^(sent from my|get outlook)\b/i.test(line)) continue;
    if (/^[-_=]{3,}$/.test(line)) continue;

    out.push(line);
    if (out.length >= 3) break;
  }

  const text = out.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= 220) return text;
  return text.slice(0, 217).replace(/\s+\S*$/, "") + "...";
}

/* Everything before the quoted original. */
function emailOwnText_(body) {
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

function emailSenderName_(from) {
  const m = String(from || "").match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  return String(from || "").replace(/@cmheating\.com/i, "").trim();
}

/*
 * Attaches email updates to the payload within a search budget.
 *
 * A Gmail search per job would be a couple of hundred round trips an hour, so
 * the previous payload's notes are carried forward and only stale ones are
 * searched again. Live jobs are refreshed before done ones, and oldest first,
 * so the budget goes where someone is actually waiting on an answer.
 */
const EMAIL_REFRESH_PRIORITY = {
  SOLD_NEEDS_ATTENTION: 0,
  SOLD_PENDING_MATCH: 1,
  SOLD_ACTIVE: 2,
  SOLD_DONE_FOLLOW_UP_LATER: 3
};

function attachEmailUpdates_(payload, previousById, now) {
  const cfg = SOLD_TRACKER_CONFIG;
  const stats = { searched: 0, reused: 0, deferred: 0, disabled: false };

  if (!cfg.emailNotesEnabled) {
    stats.disabled = true;
    return stats;
  }

  const nowMs = now.getTime();
  const freshMs = cfg.emailNoteRefreshHours * 3600 * 1000;

  /* Carry everything forward first, so a job that never gets searched this run
     still shows whatever was found last time rather than going blank. */
  payload.jobs.forEach(job => {
    const prev = previousById[job.id];
    if (prev && prev.emailUpdates) job.emailUpdates = prev.emailUpdates;
    if (prev && prev.emailCheckedAt) job.emailCheckedAt = prev.emailCheckedAt;
  });

  const order = payload.jobs.slice().sort((a, b) => {
    const pa = EMAIL_REFRESH_PRIORITY[a.stage], pb = EMAIL_REFRESH_PRIORITY[b.stage];
    if (pa !== pb) return (pa === undefined ? 9 : pa) - (pb === undefined ? 9 : pb);
    const ta = a.emailCheckedAt ? new Date(a.emailCheckedAt).getTime() : 0;
    const tb = b.emailCheckedAt ? new Date(b.emailCheckedAt).getTime() : 0;
    return ta - tb;
  });

  let budget = cfg.emailNoteMaxSearchesPerRun;

  order.forEach(job => {
    const checkedMs = job.emailCheckedAt ? new Date(job.emailCheckedAt).getTime() : 0;
    if (checkedMs && (nowMs - checkedMs) < freshMs) { stats.reused++; return; }
    if (budget <= 0) { stats.deferred++; return; }

    budget--;
    stats.searched++;
    job.emailUpdates = readDealEmailNotes_(job.customer, cfg.emailNoteLookbackDays);
    job.emailCheckedAt = isoDateTime_(now);
  });

  /* An empty array round-trips through Firebase as a missing key, which would
     look identical to "never searched". Drop it and let emailCheckedAt say. */
  payload.jobs.forEach(job => {
    if (job.emailUpdates && !job.emailUpdates.length) delete job.emailUpdates;
  });

  return stats;
}

/*
 * Last run's payload, used only as a cache for email updates. A failure here
 * is not worth stopping a sync over — it just means every job looks unchecked
 * and the budget starts from scratch.
 */
function readSoldTrackerFromFirebase_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const baseUrl = (props.getProperty("FIREBASE_DATABASE_URL") || "").replace(/\/$/, "");
    if (!baseUrl) return {};

    const explicitToken = props.getProperty("FIREBASE_AUTH_TOKEN") || "";
    const authToken = explicitToken || getFirebaseAnonymousIdToken_();
    const url = baseUrl + "/" + SOLD_TRACKER_CONFIG.firebasePath +
      ".json?auth=" + encodeURIComponent(authToken);

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return {};

    const parsed = JSON.parse(response.getContentText() || "null");
    const jobs = parsed && parsed.jobs;
    const list = Array.isArray(jobs) ? jobs : (jobs ? Object.keys(jobs).map(k => jobs[k]) : []);

    const byId = {};
    list.forEach(job => { if (job && job.id) byId[job.id] = job; });
    return byId;
  } catch (err) {
    Logger.log("Could not read the previous tracker payload: " + err);
    return {};
  }
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
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
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

  /* The backslashes here were doubled, so this branch matched a literal "\d"
     and never an actual date — an ISO cell fell through to `new Date(raw)`. */
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
  return /\b(CHURCH|LLC|INC|CORP|COMPANY|ASSOCIATION|HOA|BAPTIST|CENTER|SCHOOL|RESTAURANT|PROPERTY|PROPERTIES|APARTMENTS|CONDOMINIUM|CONDO|MINISTRIES|HOLDINGS)\b/.test(text);
}

function organizationKey_(name) {
  return cleanServiceTitanDisplay_(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function primaryCustomerNameSegment_(name) {
  const cleaned = cleanServiceTitanDisplay_(name);
  const parts = cleaned.split(/\s+AND\s+/i).map(part => part.trim()).filter(Boolean);

  if (parts.length < 2) return cleaned;

  const firstPartWords = nameWords_(parts[0]);

  // Split only when the first side already looks like a complete person name.
  // Example: "Jeffrey Van Cleave and Sueyoung Han" -> "Jeffrey Van Cleave"
  // Do not split: "Brad and Stephanie Silldorff" -> keep full name.
  if (firstPartWords.length >= 2) return parts[0];

  return cleaned;
}

function canonicalCustomerName_(name) {
  const cleaned = cleanServiceTitanDisplay_(name);
  const normalized = organizationKey_(cleaned);
  return CUSTOMER_NAME_ALIASES[normalized] || cleaned;
}

function personKeyFromFullName_(name) {
  const canonicalName = canonicalCustomerName_(name);
  if (isOrganizationName_(canonicalName)) return organizationKey_(canonicalName);

  const primaryName = primaryCustomerNameSegment_(canonicalName);
  const words = nameWords_(primaryName);

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

/* ---------------------------------------------------------------------------
 * Fuzzy customer-name matching
 *
 * The COMBO LOG is typed by one set of hands, ServiceTitan alerts by another.
 * The same homeowner arrives as "Michael McEachern" in one and
 * "Michael Mc Eachern" in the other; as "Greg Anderson" and
 * "ANDERSON, GREG 0000348"; as "Habtemariam" and "Habpemariam". An exact key
 * misses every one of those and the job sits in PENDING COMBO LOG MATCH even
 * though the install is scheduled.
 *
 * The rule: reduce both names to significant tokens, then require either two
 * tokens that match — allowing a typo's worth of edit distance, scaled to how
 * long the token is — or one substantial token when a side only offers one.
 * A shared first name alone is never enough: "Sidney Abe" must not match
 * "Sidney Johnson".
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

function comboRowSignature_(row) {
  if (!row.nameSignature) {
    row.nameSignature = nameSignature_([row.first, row.last].filter(Boolean).join(" "));
  }
  return row.nameSignature;
}

/*
 * Exact key first — it is right the overwhelming majority of the time and
 * costs nothing. Only when it comes back empty do we scan the whole sheet
 * looking for a near miss.
 */
function resolveComboRows_(sold, byKey, allRows) {
  const exact = byKey[sold.personKey] || [];
  if (exact.length) return { rows: exact, method: "exact" };

  const signature = soldSignature_(sold);
  if (!signature.tokens.length) return { rows: [], method: "none" };

  const fuzzy = allRows.filter(row => fuzzyNameMatch_(signature, comboRowSignature_(row)));
  return { rows: fuzzy, method: fuzzy.length ? "fuzzy" : "none" };
}

/*
 * The Booked and Completed alerts come out of ServiceTitan the same way the
 * Sold alert does, but a customer renamed between appointments — or entered as
 * "LAST, FIRST" once — breaks the exact key just as easily.
 */
function resolveAlertMatch_(sold, byKey, allAlerts) {
  const exact = byKey[sold.personKey] || [];
  if (exact.length) return exact[0];

  const signature = soldSignature_(sold);
  if (!signature.tokens.length) return null;

  for (let i = 0; i < allAlerts.length; i++) {
    const alert = allAlerts[i];
    if (!alert.nameSignature) alert.nameSignature = nameSignature_(alert.customer);
    if (fuzzyNameMatch_(signature, alert.nameSignature)) return alert;
  }
  return null;
}

function soldSignature_(sold) {
  if (!sold.nameSignature) sold.nameSignature = nameSignature_(sold.customer);
  return sold.nameSignature;
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

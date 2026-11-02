/**
 * HCA Numbers feed — CM Heating
 * Standalone Apps Script project. Reads the morning Power BI exports that land in Drive
 * (CM Heating — Sales Ops > Daily Uploads > Uploads MM.DD) and serves per-HCA month-to-date
 * numbers as JSON for the "My Numbers" card on crm.html.
 *
 * Writes NOTHING to Firebase and touches no other script, sheet or rules file.
 * Output lives only in this project's Script Properties; doGet serves it read-only.
 *
 * Sources (all from the same "Uploads MM.DD" folder):
 *   HCA Leaderboard Mix      -> leads, installs, L2C (installs ÷ leads), marketed L2C, team totals
 *   HCA Leaderboard Revenue  -> "Total L2C" as shown on the BI revenue page (kept side by side; BI to confirm which is official)
 *   All Leads                -> tech-flip and self-gen LEADS per HCA (Lead Type, by TechName, DuplicateFlag 0)
 *   All Installs             -> tech-flip, self-gen and rental INSTALLS per HCA (counted directly, by SoldByName)
 * Cross-checks are published in `checks`, never silently corrected.
 *
 * Setup (once):
 *   1. New Apps Script project "HCA Numbers Feed", owned by geoffrey.simons@cmheating.com. Paste this file.
 *   2. Services (+) -> Drive API, version v3, identifier "Drive".
 *   3. Run previewHcaNumbers -> authorize -> check the log.
 *   4. Run buildHcaNumbers once, then installHcaNumbersTrigger (hourly; rebuilds only when newer exports exist).
 *   5. Deploy -> New deployment -> Web app: Execute as Me, Who has access: Anyone. Copy the /exec URL into
 *      NUMBERS_EXEC in crm.html.
 * Data served: HCA names and aggregate performance counts only. No customer names, job numbers or dollars.
 */

const HN = {
  TZ: "America/Los_Angeles",
  PROP_JSON: "HCA_NUMBERS_JSON",
  PROP_SRC: "HCA_NUMBERS_SRC",
  FILES: {
    mix: "HCA Leaderboard Mix",
    rev: "HCA Leaderboard Revenue",
    leads: "All Leads",
    installs: "All Installs"
  },
  EXCLUDE: ["geoffrey simons"]   // manager row in the leaderboard exports
};

/* ---------- web app ---------- */
function doGet(e) {
  const raw = PropertiesService.getScriptProperties().getProperty(HN.PROP_JSON);
  const body = raw || JSON.stringify({ ok: false, error: "Numbers not built yet." });
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- build ---------- */
function buildHcaNumbers() {
  const src = hnFindSources_();
  if (!src.mix) { console.warn("HCA Numbers: no Leaderboard Mix export found."); return; }
  const sig = ["mix", "rev", "leads", "installs"].map(k => src[k] ? src[k].getId() + "@" + src[k].getLastUpdated().getTime() : "-").join("|");
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(HN.PROP_SRC) === sig && props.getProperty(HN.PROP_JSON)) {
    console.log("HCA Numbers: sources unchanged, skip.");
    return;
  }
  const out = hnCompute_(src);
  props.setProperty(HN.PROP_JSON, JSON.stringify(out));
  props.setProperty(HN.PROP_SRC, sig);
  console.log("HCA Numbers built: " + out.hcas.length + " HCAs, export " + out.asOf.exportDate + ", checks " + out.checks.length);
}

function previewHcaNumbers() {
  const out = hnCompute_(hnFindSources_());
  console.log(JSON.stringify(out, null, 1));
}

function installHcaNumbersTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "buildHcaNumbers")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("buildHcaNumbers").timeBased().everyHours(1).create();
  console.log("Hourly buildHcaNumbers trigger installed.");
}

/* ---------- sources ---------- */
/* Newest Leaderboard Mix export decides the folder; the other three must come from that same folder. */
function hnFindSources_() {
  const mix = hnNewest_(DriveApp.searchFiles("title contains '" + HN.FILES.mix + "' and trashed = false"));
  const out = { mix: mix, rev: null, leads: null, installs: null, folder: null };
  if (!mix) return out;
  const parents = mix.getParents();
  if (!parents.hasNext()) return out;
  const folder = parents.next();
  out.folder = folder;
  ["rev", "leads", "installs"].forEach(k => {
    out[k] = hnNewest_(folder.searchFiles("title contains '" + HN.FILES[k] + "' and trashed = false"));
  });
  return out;
}
function hnNewest_(it) {
  let best = null;
  while (it.hasNext()) {
    const f = it.next();
    if (!/\.xlsx$/i.test(f.getName()) && f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    if (!best || f.getDateCreated() > best.getDateCreated()) best = f;
  }
  return best;
}

/* xlsx -> 2D array of display strings, via a temporary converted copy that is deleted afterwards. */
function hnRows_(file) {
  if (!file) return [];
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    return SpreadsheetApp.openById(file.getId()).getSheets()[0].getDataRange().getDisplayValues();
  }
  const tmp = Drive.Files.create(
    { name: "tmp-hca-numbers-" + file.getName(), mimeType: MimeType.GOOGLE_SHEETS },
    file.getBlob(),
    { fields: "id" }
  );
  try {
    return SpreadsheetApp.openById(tmp.id).getSheets()[0].getDataRange().getDisplayValues();
  } finally {
    Drive.Files.remove(tmp.id);
  }
}

/* ---------- parsing helpers ---------- */
function hnNorm_(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " "); }
function hnNum_(s) {
  const n = parseFloat(String(s == null ? "" : s).replace(/[$,%\s]/g, ""));
  return isFinite(n) ? n : 0;
}
function hnPct_(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
/* Find the header row: the first row that contains every required header (case-insensitive, exact cell). */
function hnTable_(rows, required) {
  const req = required.map(hnNorm_);
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(hnNorm_);
    if (req.every(h => cells.indexOf(h) >= 0)) {
      const col = name => cells.indexOf(hnNorm_(name));   // first occurrence (Mix repeats "Self Gen Installs")
      let nameCol = cells.findIndex(c => /(^|\s)hca$/.test(c));
      if (nameCol < 0) nameCol = 0;
      return { header: i, col: col, nameCol: nameCol, body: rows.slice(i + 1) };
    }
  }
  return null;
}
function hnIsDataRow_(name) {
  const n = hnNorm_(name);
  return n && n !== "total" && n.indexOf("applied filters") !== 0;
}

/* ---------- compute ---------- */
function hnCompute_(src) {
  const checks = [];
  const byName = {};
  const get = n => byName[n] || (byName[n] = {
    name: n, leads: 0, installs: 0, l2cMix: 0, l2cRev: null, mktL2c: 0,
    tfLeads: 0, tfInstalls: 0, sgLeads: 0, sgInstalls: 0, rentalInstalled: 0, leadsRowCount: 0
  });
  let team = null;

  /* Mix */
  const mix = hnTable_(hnRows_(src.mix), ["Total Installs", "Total Leads", "Total L2C", "Marketed L2C", "Rental Installs"]);
  if (!mix) throw new Error("Leaderboard Mix: header row not found.");
  mix.body.forEach(r => {
    const raw = String(r[mix.nameCol] || "").trim();
    const rec = {
      installs: hnNum_(r[mix.col("Total Installs")]),
      leads: hnNum_(r[mix.col("Total Leads")]),
      l2cMix: hnNum_(r[mix.col("Total L2C")]),
      mktL2c: hnNum_(r[mix.col("Marketed L2C")]),
      mixSelfGenInstalls: hnNum_(r[mix.col("Self Gen Installs")]),
      mixMarketedInstalls: hnNum_(r[mix.col("Marketed Installs")]),
      mixRental: hnNum_(r[mix.col("Rental Installs")])
    };
    if (hnNorm_(raw) === "total") { team = rec; return; }
    if (!hnIsDataRow_(raw) || HN.EXCLUDE.indexOf(hnNorm_(raw)) >= 0) return;
    if (!rec.leads && !rec.installs) return;
    Object.assign(get(raw), rec);
  });

  /* Revenue page L2C */
  if (src.rev) {
    const rev = hnTable_(hnRows_(src.rev), ["Total L2C", "Adjusted Revenue"]);
    if (rev) rev.body.forEach(r => {
      const raw = String(r[rev.nameCol] || "").trim();
      if (byName[raw]) byName[raw].l2cRev = hnNum_(r[rev.col("Total L2C")]);
      if (hnNorm_(raw) === "total" && team) team.l2cRev = hnNum_(r[rev.col("Total L2C")]);
    });
    else checks.push("Revenue export: header row not found; l2cRev left empty.");
  } else checks.push("Revenue export missing from the folder; l2cRev left empty.");

  /* All Leads: tech-flip and self-gen leads */
  if (src.leads) {
    const t = hnTable_(hnRows_(src.leads), ["Lead Type", "TechName"]);
    if (t) {
      const cType = t.col("Lead Type"), cName = t.col("TechName"), cDup = t.col("DuplicateFlag");
      t.body.forEach(r => {
        const n = String(r[cName] || "").trim();
        if (!byName[n]) return;
        if (cDup >= 0 && String(r[cDup]).trim() !== "" && hnNum_(r[cDup]) !== 0) return;
        const lt = hnNorm_(r[cType]);
        byName[n].leadsRowCount++;
        if (lt === "tech lead") byName[n].tfLeads++;
        if (lt === "self gen") byName[n].sgLeads++;
      });
    } else checks.push("All Leads: header row not found.");
  } else checks.push("All Leads export missing; tech-flip and self-gen leads are 0.");

  /* All Installs: tech-flip, self-gen and rental installs, counted row by row */
  const instRows = {};
  if (src.installs) {
    const t = hnTable_(hnRows_(src.installs), ["Lead Type", "SoldByName", "job.type"]);
    if (t) {
      const cType = t.col("Lead Type"), cName = t.col("SoldByName"), cJob = t.col("job.type"), cBu = t.col("Business Unit");
      t.body.forEach(r => {
        const n = String(r[cName] || "").trim();
        if (!byName[n]) return;
        instRows[n] = (instRows[n] || 0) + 1;
        const lt = hnNorm_(r[cType]);
        if (lt === "tech lead") byName[n].tfInstalls++;
        if (lt === "self gen") byName[n].sgInstalls++;
        const rental = /rental/i.test(String(r[cJob])) || (cBu >= 0 && /rhvac/i.test(String(r[cBu])));
        if (rental) byName[n].rentalInstalled++;
      });
    } else checks.push("All Installs: header row not found.");
  } else checks.push("All Installs export missing; tech-flip, self-gen and rental installs are 0.");

  /* Cross-checks (published, not corrected) */
  const hcas = Object.keys(byName).map(n => byName[n]);
  hcas.forEach(h => {
    if (src.leads && h.leadsRowCount !== h.leads) checks.push(h.name + ": All Leads rows " + h.leadsRowCount + " vs Mix leads " + h.leads + ".");
    if (src.installs && (instRows[h.name] || 0) !== h.installs) checks.push(h.name + ": All Installs rows " + (instRows[h.name] || 0) + " vs Mix installs " + h.installs + ".");
    const derivedTf = h.installs - h.mixMarketedInstalls - h.mixSelfGenInstalls;
    if (src.installs && derivedTf !== h.tfInstalls) checks.push(h.name + ": tech-flip installs direct " + h.tfInstalls + " vs Mix-derived " + derivedTf + ".");
    if (src.installs && h.mixRental !== h.rentalInstalled) checks.push(h.name + ": rental installs direct " + h.rentalInstalled + " vs Mix " + h.mixRental + ".");
    h.l2c = hnPct_(h.installs, h.leads);
    h.tfL2c = hnPct_(h.tfInstalls, h.tfLeads);
    h.rentalMix = hnPct_(h.rentalInstalled, h.installs);
    delete h.leadsRowCount; delete h.mixSelfGenInstalls; delete h.mixMarketedInstalls; delete h.mixRental;
  });
  hcas.sort((a, b) => b.l2c - a.l2c);

  const sum = k => hcas.reduce((s, h) => s + (Number(h[k]) || 0), 0);
  const T = {
    leads: sum("leads"), installs: sum("installs"), tfLeads: sum("tfLeads"), tfInstalls: sum("tfInstalls"),
    sgLeads: sum("sgLeads"), sgInstalls: sum("sgInstalls"), rentalInstalled: sum("rentalInstalled"),
    mktL2c: team ? team.mktL2c : null, l2cRev: team && team.l2cRev != null ? team.l2cRev : null
  };
  T.l2c = hnPct_(T.installs, T.leads);
  T.tfL2c = hnPct_(T.tfInstalls, T.tfLeads);
  T.rentalMix = hnPct_(T.rentalInstalled, T.installs);
  if (team && (team.leads !== T.leads || team.installs !== T.installs)) {
    checks.push("Team row in Mix (" + team.installs + "/" + team.leads + ") differs from the HCA rows summed (" + T.installs + "/" + T.leads + ").");
  }

  const created = src.mix.getDateCreated();
  const exportDate = Utilities.formatDate(created, HN.TZ, "yyyy-MM-dd");
  const through = new Date(created.getTime() - 24 * 3600 * 1000);   // BI runs one day behind
  return {
    ok: true,
    asOf: {
      exportDate: exportDate,
      dataThrough: Utilities.formatDate(through, HN.TZ, "yyyy-MM-dd"),
      folder: src.folder ? src.folder.getName() : "",
      builtUtc: new Date().toISOString()
    },
    definitions: {
      l2c: "Installs ÷ leads, month to date (HCA Leaderboard Install Mix).",
      l2cRev: "Total L2C as shown on the BI HCA Leaderboard revenue page.",
      tf: "Tech Lead leads (All Leads, by HCA who ran it) and Tech Lead installs (All Installs, by HCA who sold it).",
      rental: "Rental installs counted in All Installs (job type contains Rental or RHVAC Install business unit)."
    },
    hcas: hcas,
    team: T,
    checks: checks
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   One-off: file the two replies that arrived after this morning's backfill.
   Kyle's Dan Hallam recap (11:32am) and Amber's "ran nothing" (11:29am).

   Paste at the very BOTTOM of 0730daily-recaps.gs, save, then choose
   fileLateRepliesNow in the Run dropdown and press Run.

   Safe to run more than once — it checks before it writes, and leaves alone
   anything already recorded.
   ─────────────────────────────────────────────────────────────────────────── */
function fileLateRepliesNow() {
  const FALLBACK_ID = "1FGR4ZXjfJxJnKyXRhqNa7fu9ovnK_P6W8t5xXmhcI1k";
  const DATE = "2026-07-30";
  const TZ = "America/Los_Angeles";

  const id = PropertiesService.getScriptProperties().getProperty("logSpreadsheetId") || FALLBACK_ID;
  const ss = SpreadsheetApp.openById(id);
  Logger.log("Sheet: " + ss.getUrl());

  /* ---- 1. Kyle's appointment, into the Recap Log ------------------------- */
  const KEY = DATE + "|kyle mcalister|dan hallam";
  const row = [
    DATE, "Kyle McAlister", "Dan Hallam", "Tech Flip", "FOLLOW-UP NEEDED",
    "single stage full system 18k", 18000, "One-time", "no", "later next month",
    "what’s not? They are old. Getting multiple bids. Wife wasn’t home. " +
      "Wasn’t expecting to have to replace furnace also.",
    new Date(), KEY
  ];

  const log = ss.getSheetByName("Recap Log");
  if (!log) { Logger.log("STOP — no 'Recap Log' tab. Nothing written."); return; }

  const lastLogRow = log.getLastRow();
  const keys = lastLogRow > 1
    ? log.getRange(2, row.length, lastLogRow - 1, 1).getValues().map(r => String(r[0]).trim())
    : [];

  if (keys.indexOf(KEY) !== -1) {
    Logger.log("Recap Log — Dan Hallam already logged, left alone.");
  } else {
    log.getRange(lastLogRow + 1, 1, 1, row.length).setValues([row]);
    Logger.log("Recap Log — added Dan Hallam for Kyle on " + DATE + ".");
  }

  /* ---- 2. Kyle and Amber to Late on the compliance tab ------------------- */
  const comp = ss.getSheetByName("Reply Compliance");
  if (!comp) { Logger.log("STOP — no 'Reply Compliance' tab."); return; }

  /* Amber ran nothing and said so, so her count stays 0. Both answered after
     their night, which is what "Late" means — it is not a mark against them. */
  const want = [
    { name: "kyle mcalister", appointments: 1 },
    { name: "amber maddalena", appointments: 0 }
  ];

  const lastCompRow = comp.getLastRow();
  const values = lastCompRow > 1 ? comp.getRange(2, 1, lastCompRow - 1, 6).getValues() : [];

  want.forEach(target => {
    let found = false;
    for (let i = 0; i < values.length; i++) {
      const cell = values[i][0];
      const rowDate = cell instanceof Date
        ? Utilities.formatDate(cell, TZ, "yyyy-MM-dd")
        : String(cell).trim();
      if (rowDate !== DATE) continue;
      if (String(values[i][1]).trim().toLowerCase() !== target.name) continue;

      found = true;
      const replied = String(values[i][2]).trim().toLowerCase();
      if (replied === "yes" || replied === "late") {
        Logger.log("Compliance — " + values[i][1] + " already '" + values[i][2] + "', left alone.");
      } else {
        comp.getRange(i + 2, 3).setValue("Late");
        comp.getRange(i + 2, 4).setValue(target.appointments);
        comp.getRange(i + 2, 6).setValue(new Date());
        Logger.log("Compliance — " + values[i][1] + " set to Late, " +
          target.appointments + " appointment(s).");
      }
      break;
    }
    if (!found) Logger.log("Compliance — no row for " + target.name + " on " + DATE +
      ". Nothing changed for them.");
  });

  Logger.log("Done. Joe Chounramany is untouched — he still has not replied.");
  return ss.getUrl();
}

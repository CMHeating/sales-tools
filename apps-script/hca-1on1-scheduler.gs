/*
 * HCA 1:1 Scheduler Backend
 *
 * Deploy as Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone with the link, or anyone in CM Heating domain if available
 *
 * Calendar required:
 * - HCA 1:1 Schedule
 */

const HCA_1ON1_CONFIG = {
  calendarName: "HCA 1:1 Schedule",
  timeZone: "America/Los_Angeles",
  meetingMinutes: 20,
  bufferMinutes: 5,
  cycleAnchorIso: "2026-07-06",
  lookAheadDays: 21,
  windows: {
    Tuesday:   { start: "09:00", end: "11:30" },
    Wednesday: { start: "09:30", end: "11:30" },
    Thursday:  { start: "09:00", end: "11:30" },
    Friday:    { start: "08:00", end: "11:30" }
  }
};

const HCA_1ON1_ROSTER = [
  { name: "Amber Maddalena", homeDay: "Tuesday", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Davis Diosdado", homeDay: "Wednesday", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Chester Granard", homeDay: "Thursday", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Javierre Milo", homeDay: "Tuesday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Joe Chounramany", homeDay: "Tuesday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Joseph Ruble", homeDay: "Wednesday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Kyle McAlister", homeDay: "Wednesday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Samir Khoury", homeDay: "Thursday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Adam Weberg", homeDay: "Thursday", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] }
];

function doGet(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    const action = String(p.action || "status");

    if (action === "status") {
      return json_(buildHcaOneOnOnePayload_(null));
    }

    if (action === "availability") {
      return json_(buildHcaOneOnOnePayload_(p.hca || ""));
    }

    if (action === "book") {
      return json_(bookHcaOneOnOne_(p));
    }

    throw new Error("Unknown action: " + action);
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function buildHcaOneOnOnePayload_(selectedHca) {
  const scheduleCal = getHcaOneOnOneCalendar_();
  const primaryCal = CalendarApp.getDefaultCalendar();
  const cycle = currentHcaOneOnOneCycle_();
  const hcas = HCA_1ON1_ROSTER.map(hca => summarizeHcaOneOnOne_(hca, scheduleCal, cycle));
  const slots = selectedHca ? availableSlotsForHca_(selectedHca, scheduleCal, primaryCal) : [];

  return {
    ok: true,
    updated: isoDateTime_(new Date()),
    cycle,
    calendarName: HCA_1ON1_CONFIG.calendarName,
    hcas,
    slots
  };
}

function bookHcaOneOnOne_(params) {
  const hcaName = clean_(params.hca);
  const startIso = clean_(params.start);
  const hca = findHca_(hcaName);
  if (!hca) throw new Error("Unknown HCA: " + hcaName);
  if (!startIso) throw new Error("Missing selected start time.");

  const scheduleCal = getHcaOneOnOneCalendar_();
  const primaryCal = CalendarApp.getDefaultCalendar();

  const slots = availableSlotsForHca_(hcaName, scheduleCal, primaryCal);
  const selected = slots.find(slot => slot.available && slot.start === startIso);
  if (!selected) throw new Error("That slot is no longer available. Refresh and choose another slot.");

  const start = new Date(startIso);
  const end = new Date(start.getTime() + HCA_1ONONEMINUTES_() * 60000);

  const title = "HCA 1:1 — " + hca.name;
  const cycle = currentHcaOneOnOneCycle_();
  const description = [
    "HCA: " + hca.name,
    "Cycle: " + cycle.start + " to " + cycle.end,
    "",
    "Main topic: " + clean_(params.topic),
    "Customer/job/opportunity: " + clean_(params.jobRef),
    "Dispatch impact: " + clean_(params.dispatchImpact),
    "Desired outcome: " + clean_(params.outcome),
    "",
    "Notes:",
    clean_(params.notes)
  ].join("\n");

  scheduleCal.createEvent(title, start, end, {
    description,
    location: "CM Heating / Phone / Office"
  });

  return buildHcaOneOnOnePayload_(hca.name);
}

function availableSlotsForHca_(hcaName, scheduleCal, primaryCal) {
  const hca = findHca_(hcaName);
  if (!hca) throw new Error("Unknown HCA: " + hcaName);

  const now = new Date();
  const today = startOfDay_(now);
  const days = [];

  for (let i = 0; i <= HCA_1ON1_CONFIG.lookAheadDays; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const dayName = dayName_(d);
    if (!hca.allowed.includes(dayName)) continue;
    if (!HCA_1ON1_CONFIG.windows[dayName]) continue;
    days.push(d);
  }

  const allSlots = [];
  days.forEach(day => {
    const dayName = dayName_(day);
    const win = HCA_1ON1_CONFIG.windows[dayName];
    const starts = buildSlotStarts_(day, win.start, win.end);

    starts.forEach(start => {
      const end = new Date(start.getTime() + HCA_1ONONEMINUTES_() * 60000);
      const available = start > now && !hasCalendarConflict_(primaryCal, start, end) && !hasCalendarConflict_(scheduleCal, start, end);

      allSlots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        available,
        homeDay: dayName === hca.homeDay,
        reason: available
          ? (dayName === hca.homeDay ? "Assigned home day" : "Backup slot")
          : "Busy"
      });
    });
  });

  return allSlots
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.homeDay !== b.homeDay) return a.homeDay ? -1 : 1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    })
    .slice(0, 24);
}

function buildSlotStarts_(day, startTime, endTime) {
  const out = [];
  const start = withTime_(day, startTime);
  const end = withTime_(day, endTime);
  const step = HCA_1ONONEMINUTES_() + HCA_1ON1_CONFIG.bufferMinutes;

  for (let t = start.getTime(); t + HCA_1ONONEMINUTES_() * 60000 <= end.getTime(); t += step * 60000) {
    out.push(new Date(t));
  }

  return out;
}

function summarizeHcaOneOnOne_(hca, scheduleCal, cycle) {
  const start = new Date(cycle.start + "T00:00:00");
  const end = new Date(cycle.end + "T23:59:59");
  const events = scheduleCal.getEvents(start, end, { search: "HCA 1:1 — " + hca.name })
    .sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

  const now = new Date();
  const event = events[0] || null;
  const cycleEnd = new Date(cycle.end + "T23:59:59");
  const dueSoon = now >= new Date(cycleEnd.getTime() - 3 * 86400000);

  let status = "Not booked";
  if (event && event.getEndTime() < now) status = "Completed";
  else if (event) status = "Booked";
  else if (now > cycleEnd) status = "Overdue";
  else if (dueSoon) status = "Due soon";

  return {
    name: hca.name,
    homeDay: hca.homeDay,
    allowed: hca.allowed,
    off: hca.off,
    status,
    meetingStart: event ? event.getStartTime().toISOString() : "",
    meetingEnd: event ? event.getEndTime().toISOString() : "",
    eventTitle: event ? event.getTitle() : ""
  };
}

function currentHcaOneOnOneCycle_() {
  const anchor = new Date(HCA_1ON1_CONFIG.cycleAnchorIso + "T00:00:00");
  const today = startOfDay_(new Date());
  const diffDays = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
  const cycleIndex = Math.floor(diffDays / 14);
  const start = new Date(anchor.getTime() + cycleIndex * 14 * 86400000);
  const end = new Date(start.getTime() + 13 * 86400000);
  return {
    start: isoDate_(start),
    end: isoDate_(end)
  };
}

function getHcaOneOnOneCalendar_() {
  const calendars = CalendarApp.getCalendarsByName(HCA_1ON1_CONFIG.calendarName);
  if (calendars && calendars.length) return calendars[0];

  return CalendarApp.createCalendar(HCA_1ON1_CONFIG.calendarName, {
    timeZone: HCA_1ON1_CONFIG.timeZone,
    summary: "HCA 1:1 booking schedule for Geoff, Amy, and the HCA team."
  });
}

function hasCalendarConflict_(calendar, start, end) {
  const events = calendar.getEvents(
    new Date(start.getTime() - HCA_1ON1_CONFIG.bufferMinutes * 60000),
    new Date(end.getTime() + HCA_1ON1_CONFIG.bufferMinutes * 60000)
  );

  return events.some(event => {
    const title = event.getTitle() || "";
    if (/Canceled|Cancelled/i.test(title)) return false;
    return event.getEndTime() > start && event.getStartTime() < end;
  });
}

function findHca_(name) {
  const key = clean_(name).toUpperCase();
  return HCA_1ON1_ROSTER.find(hca => hca.name.toUpperCase() === key || String(hca.alias || "").toUpperCase() === key);
}

function HCA_1ONONEMINUTES_() {
  return HCA_1ON1_CONFIG.meetingMinutes;
}

function dayName_(date) {
  return Utilities.formatDate(date, HCA_1ON1_CONFIG.timeZone, "EEEE");
}

function withTime_(day, hhmm) {
  const parts = hhmm.split(":").map(Number);
  const text = Utilities.formatDate(day, HCA_1ON1_CONFIG.timeZone, "yyyy-MM-dd");
  return new Date(text + "T" + String(parts[0]).padStart(2, "0") + ":" + String(parts[1]).padStart(2, "0") + ":00");
}

function startOfDay_(date) {
  const text = Utilities.formatDate(date, HCA_1ON1_CONFIG.timeZone, "yyyy-MM-dd");
  return new Date(text + "T00:00:00");
}

function isoDate_(date) {
  return Utilities.formatDate(date, HCA_1ON1_CONFIG.timeZone, "yyyy-MM-dd");
}

function isoDateTime_(date) {
  return Utilities.formatDate(date, HCA_1ON1_CONFIG.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function clean_(value) {
  return String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

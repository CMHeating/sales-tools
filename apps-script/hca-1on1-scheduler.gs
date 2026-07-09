/*
 * HCA 1:1 Scheduler Backend
 *
 * Deploy as Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone with the link, or anyone in CM Heating domain if available
 *
 * Calendar behavior:
 * - Creates tracker event on the HCA 1:1 Schedule calendar
 * - Creates the actual invite on Geoffrey Simons' CM Heating calendar
 * - Adds the selected HCA as a guest so they receive a Google Calendar invite they can accept
 */

const HCA_1ON1_CONFIG = {
  calendarName: "HCA 1:1 Schedule",
  ownerCalendarId: "geoffrey.simons@cmheating.com",
  timeZone: "America/Los_Angeles",
  meetingMinutes: 20,
  bufferMinutes: 5,
  cycleAnchorIso: "2026-07-06",
  lookAheadDays: 21,
  bookingIdPrefix: "HCA_1ON1_BOOKING_ID:",
  windows: {
    Tuesday:   { start: "09:00", end: "11:30" },
    Wednesday: { start: "09:30", end: "11:30" },
    Thursday:  { start: "09:00", end: "11:30" },
    Friday:    { start: "08:00", end: "11:30" }
  }
};

const HCA_1ON1_ROSTER = [
  { name: "Amber Maddalena", email: "amber.maddalena@cmheating.com", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Davis Diosdado", email: "davis.diosdado@cmheating.com", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Chester Granard", email: "chester.granard@cmheating.com", off: ["Friday", "Saturday"], allowed: ["Tuesday", "Wednesday", "Thursday"] },
  { name: "Jay Milo", alias: "Jay", email: "javierre.milo@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Joe Chounramany", email: "jchounramany@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Joseph Ruble", email: "joseph.ruble@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Kyle McAlister", email: "kmcalister@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Samir Khoury", email: "samir.khoury@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] },
  { name: "Trevor Bohm", email: "trevor.bohm@cmheating.com", off: ["Tuesday", "Friday", "Sunday"], allowed: ["Wednesday", "Thursday"] },
  { name: "Adam Weberg", email: "adam@cmheating.com", off: ["Sunday", "Monday"], allowed: ["Tuesday", "Wednesday", "Thursday", "Friday"] }
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

    if (action === "cancel") {
      return json_(cancelHcaOneOnOne_(p));
    }

    throw new Error("Unknown action: " + action);
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function buildHcaOneOnOnePayload_(selectedHca) {
  const scheduleCal = getHcaOneOnOneCalendar_();
  const ownerCal = getOwnerCalendar_();
  const cycle = currentHcaOneOnOneCycle_();
  const hcas = HCA_1ON1_ROSTER.map(hca => summarizeHcaOneOnOne_(hca, scheduleCal, cycle));
  const selected = selectedHca ? findHca_(selectedHca) : null;
  const slots = selected ? availableSlotsForHca_(selected.name, scheduleCal, ownerCal) : [];

  return {
    ok: true,
    updated: isoDateTime_(new Date()),
    cycle,
    calendarName: HCA_1ON1_CONFIG.calendarName,
    ownerCalendarId: HCA_1ON1_CONFIG.ownerCalendarId,
    hcas,
    slots
  };
}

function bookHcaOneOnOne_(params) {
  const hcaName = clean_(params.hca);
  const startIso = clean_(params.start);
  const hca = findHca_(hcaName);
  if (!hca) throw new Error("Unknown HCA: " + hcaName);
  if (!hca.email) throw new Error("Missing email for HCA: " + hca.name);
  if (!startIso) throw new Error("Missing selected start time.");

  const scheduleCal = getHcaOneOnOneCalendar_();
  const ownerCal = getOwnerCalendar_();
  const cycle = currentHcaOneOnOneCycle_();
  const existing = summarizeHcaOneOnOne_(hca, scheduleCal, cycle);
  if (existing.meetingStart && String(existing.status || "").toLowerCase() === "booked") {
    throw new Error("You already have a 1:1 booked for this cycle. Cancel it first if you need to reschedule.");
  }

  const slots = availableSlotsForHca_(hca.name, scheduleCal, ownerCal);
  const selected = slots.find(slot => slot.available && slot.start === startIso);
  if (!selected) throw new Error("That slot is no longer available. Refresh and choose another slot.");

  const start = new Date(startIso);
  const end = new Date(start.getTime() + HCA_1ONONEMINUTES_() * 60000);
  const bookingId = bookingId_(hca.name, start);
  const title = "HCA 1:1 — " + hca.name;
  const description = bookingDescription_(hca, cycle, bookingId);
  const sharedEventOptions = {
    description,
    location: "CM Heating / Phone / Office"
  };
  const ownerInviteOptions = {
    description,
    location: "CM Heating / Phone / Office",
    guests: hca.email,
    sendInvites: true
  };

  const scheduleEvent = scheduleCal.createEvent(title, start, end, sharedEventOptions);
  const ownerEvent = ownerCal.createEvent(title, start, end, ownerInviteOptions);
  setBusyIfPossible_(scheduleEvent);
  setBusyIfPossible_(ownerEvent);

  return buildHcaOneOnOnePayload_(hca.name);
}

function cancelHcaOneOnOne_(params) {
  const hcaName = clean_(params.hca);
  const hca = findHca_(hcaName);
  if (!hca) throw new Error("Unknown HCA: " + hcaName);

  const scheduleCal = getHcaOneOnOneCalendar_();
  const ownerCal = getOwnerCalendar_();
  const cycle = currentHcaOneOnOneCycle_();
  const existing = summarizeHcaOneOnOne_(hca, scheduleCal, cycle);
  const start = clean_(params.start) ? new Date(clean_(params.start)) : (existing.meetingStart ? new Date(existing.meetingStart) : null);
  const bookingId = clean_(params.bookingId) || existing.bookingId || (start ? bookingId_(hca.name, start) : "");

  if (!bookingId && !start) {
    throw new Error("No booked 1:1 found for " + hca.name + " in the current cycle.");
  }

  const deletedFromSchedule = deleteMatchingBookings_(scheduleCal, hca, cycle, bookingId, start);
  const deletedFromOwner = deleteMatchingBookings_(ownerCal, hca, cycle, bookingId, start);
  const deleted = deletedFromSchedule + deletedFromOwner;

  if (!deleted) {
    throw new Error("No matching booked 1:1 found to cancel.");
  }

  return buildHcaOneOnOnePayload_(hca.name);
}

function availableSlotsForHca_(hcaName, scheduleCal, ownerCal) {
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
      const available = start > now && !hasCalendarConflict_(ownerCal, start, end) && !hasCalendarConflict_(scheduleCal, start, end);

      allSlots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        available
      });
    });
  });

  return allSlots
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
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
  const bounds = cycleBounds_(cycle);
  const title = "HCA 1:1 — " + hca.name;
  const events = scheduleCal.getEvents(bounds.start, bounds.end)
    .filter(event => eventLooksLikeHcaBooking_(event, hca, title))
    .sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

  const now = new Date();
  const event = events[0] || null;
  const cycleEnd = new Date(bounds.end.getTime() - 1000);
  const dueSoon = now >= new Date(cycleEnd.getTime() - 3 * 86400000);

  let status = "Not booked";
  if (event && event.getEndTime() < now) status = "Completed";
  else if (event) status = "Booked";
  else if (now > cycleEnd) status = "Overdue";
  else if (dueSoon) status = "Due soon";

  return {
    name: hca.name,
    email: hca.email || "",
    allowed: hca.allowed,
    off: hca.off,
    status,
    meetingStart: event ? event.getStartTime().toISOString() : "",
    meetingEnd: event ? event.getEndTime().toISOString() : "",
    bookingId: event ? (extractBookingId_(event.getDescription()) || bookingId_(hca.name, event.getStartTime())) : "",
    eventTitle: event ? event.getTitle() : ""
  };
}

function deleteMatchingBookings_(calendar, hca, cycle, bookingId, start) {
  const bounds = cycleBounds_(cycle);
  const title = "HCA 1:1 — " + hca.name;
  const events = calendar.getEvents(bounds.start, bounds.end);
  let deleted = 0;

  events.forEach(event => {
    if (!eventLooksLikeHcaBooking_(event, hca, title)) return;

    const desc = event.getDescription() || "";
    const eventBookingId = extractBookingId_(desc);
    const idMatches = bookingId && eventBookingId && eventBookingId === bookingId;
    const legacyTimeMatches = start && Math.abs(event.getStartTime().getTime() - start.getTime()) < 60000;

    if (idMatches || legacyTimeMatches) {
      event.deleteEvent();
      deleted += 1;
    }
  });

  return deleted;
}

function eventLooksLikeHcaBooking_(event, hca, title) {
  if (!event) return false;
  if (safeIsAllDay_(event)) return false;

  const eventTitle = event.getTitle() || "";
  const desc = event.getDescription() || "";
  const hasBookingId = desc.indexOf(HCA_1ON1_CONFIG.bookingIdPrefix) !== -1;
  const hasHcaLine = desc.indexOf("HCA: " + hca.name) !== -1;

  return eventTitle === title || (hasBookingId && hasHcaLine);
}

function hasCalendarConflict_(calendar, start, end) {
  const events = calendar.getEvents(
    new Date(start.getTime() - HCA_1ON1_CONFIG.bufferMinutes * 60000),
    new Date(end.getTime() + HCA_1ON1_CONFIG.bufferMinutes * 60000)
  );

  return events.some(event => {
    const title = event.getTitle() || "";
    if (/Canceled|Cancelled/i.test(title)) return false;
    if (safeIsAllDay_(event)) return false;
    if (safeIsTransparent_(event)) return false;
    return event.getEndTime() > start && event.getStartTime() < end;
  });
}

function bookingDescription_(hca, cycle, bookingId) {
  return [
    HCA_1ON1_CONFIG.bookingIdPrefix + " " + bookingId,
    "HCA: " + hca.name,
    "HCA Email: " + (hca.email || ""),
    "Organizer calendar: " + HCA_1ON1_CONFIG.ownerCalendarId,
    "Cycle: " + cycle.start + " to " + cycle.end,
    "Booked through HCA Toolkit.",
    "Cancel/reschedule by using the HCA 1:1 Scheduler page."
  ].join("\n");
}

function bookingId_(hcaName, start) {
  return slug_(hcaName) + "-" + new Date(start).toISOString().replace(/[:.]/g, "-");
}

function extractBookingId_(description) {
  const text = String(description || "");
  const prefix = HCA_1ON1_CONFIG.bookingIdPrefix;
  const line = text.split(/\r?\n/).find(row => row.indexOf(prefix) === 0);
  return line ? clean_(line.slice(prefix.length)) : "";
}

function cycleBounds_(cycle) {
  return {
    start: new Date(cycle.start + "T00:00:00"),
    end: new Date(cycle.end + "T23:59:59")
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

function getOwnerCalendar_() {
  const ownerCalendarId = clean_(HCA_1ON1_CONFIG.ownerCalendarId);
  if (ownerCalendarId) {
    const ownerCal = CalendarApp.getCalendarById(ownerCalendarId);
    if (ownerCal) return ownerCal;
  }

  return CalendarApp.getDefaultCalendar();
}

function setBusyIfPossible_(event) {
  try {
    event.setTransparency(CalendarApp.EventTransparency.OPAQUE);
  } catch (err) {
    // Created calendar events are normally busy by default. Keep going if Apps Script cannot set it.
  }
}

function safeIsAllDay_(event) {
  try {
    return event.isAllDayEvent();
  } catch (err) {
    return false;
  }
}

function safeIsTransparent_(event) {
  try {
    return event.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT;
  } catch (err) {
    return false;
  }
}

function findHca_(name) {
  const key = clean_(name).toUpperCase();
  return HCA_1ON1_ROSTER.find(hca => {
    const nameMatches = hca.name.toUpperCase() === key;
    const aliasMatches = String(hca.alias || "").toUpperCase() === key;
    const emailMatches = String(hca.email || "").toUpperCase() === key;
    return nameMatches || aliasMatches || emailMatches;
  });
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

function slug_(value) {
  return clean_(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function clean_(value) {
  return String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

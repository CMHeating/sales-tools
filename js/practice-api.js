/* PRACTICE MODE API — a faithful in-browser port of sandbox/server.py, so the practice site works on any static host
   (GitHub Pages) with NO server. Loaded only when the URL carries `practice=1`. Fake data only; everything lives in this
   browser's localStorage; nothing is sent anywhere. It intercepts fetch('/api/...') and answers from localStorage.
   Keep in step with sandbox/server.py (sandbox/tests/test_practice.py runs the same checks through this file). */
(function (g) {
  "use strict";
  var KEY = "cmh_practice_db_v1", MAX_BODY = 64 * 1024;
  var BASE_ITEMS = ["pay", "stock", "permit", "heatload", "ahri", "mat", "photos", "video", "i-labor", "e-disconnect", "e-outlet", "e-labor"];
  var RENTAL_ITEMS = ["r-contract", "r-penny", "r-credit", "r-payauth", "r-dl", "r-deed"];
  var NA_OK = ["ahri", "e-disconnect", "e-outlet", "r-contract", "r-penny", "r-credit", "r-payauth", "r-dl", "r-deed"];   /* items that may be answered N/A ("rebate" uses na for "No rebate") */
  var CLAIM_ITEMS = ["claim", "downpay", "rb-applied", "permitdelay"];   /* "ready to claim your spot on the install availability sheet?" yes / na (= no): stored, never counted or required */
  var REBATE_ITEMS = ["rebate", "rb-balance", "rb-ahri", "rb-tc", "rb-equip"];
  var REBATE_PROGRAM_ITEMS = { PSE: ["rb-balance", "rb-ahri", "rb-tc"], PUD: ["rb-balance", "rb-ahri"], Gensco: ["rb-balance", "rb-equip"], Other: ["rb-balance", "rb-ahri"] };
  function rebateKey(p) { p = String(p || ""); return p === "PSE" || p === "PUD" || p === "Gensco" ? p : (/^Other: \S/.test(p) ? "Other" : ""); }
  var REQUIRED_HCA = ["pay", "stock", "permit", "mat", "photos", "video", "i-labor", "e-labor"];
  var LANES = {
    sales: { who: "Geoff", items: ["disc", "rebate", "ahri-ok", "financing", "slip", "auths"] },
    install: { who: "Lyle", items: ["mat-ok", "stock-ok", "layout-ok", "labor", "sizing", "permit-ok"] },
    electrical: { who: "Jon", items: ["panel", "disconnect", "outlet", "elabor"] }
  };
  var LANE_LABELS = { disc: "Discounts correct", rebate: "Rebate submitted / eligible", "ahri-ok": "Equipment is an AHRI match",
    financing: "Financing arranged and approved", slip: "Sales slip signed", auths: "Authorizations done",
    "mat-ok": "Materials list complete", "stock-ok": "Equipment in stock", "layout-ok": "Layout photos and video",
    labor: "Install labor billed correctly", sizing: "Equipment matches the load", "permit-ok": "Permit ready",
    panel: "Panel / breaker scope", disconnect: "Disconnect over 24\"?", outlet: "Service outlet within 25'?", elabor: "Electrical labor billed correctly" };
  var RESULTS = ["verified", "missing", "mismatch"], SIGNOFFS = ["confirmed", "attention", "notready"], HCA_STATES = ["yes", "work", "no", "na"];

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayOffset(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, "+00:00"); }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function str(x, n) { return String(x == null ? "" : x).slice(0, n); }

  function seed() {
    var d = dayOffset;
    return {
      jobs: [
        { job: "900001", customer: "Sample Alpha", hca: "Samir Khoury", installDate: d(2), department: "HVAC", stage: "SOLD_ACTIVE" },
        { job: "900002", customer: "Sample Bravo", hca: "Samir Khoury", installDate: d(6), department: "HVAC", stage: "SOLD_ACTIVE" },
        { job: "900003", customer: "Sample Charlie (rental)", hca: "Samir Khoury", installDate: d(9), department: "HVAC", stage: "SOLD_ACTIVE" },
        { job: "900004", customer: "Sample Delta", hca: "Samir Khoury", installDate: "", department: "HVAC", stage: "SOLD_NEEDS_ATTENTION" },
        { job: "900005", customer: "Sample Echo", hca: "Chester Granard", installDate: d(3), department: "HVAC", stage: "SOLD_ACTIVE" },
        { job: "900006", customer: "Sample Foxtrot", hca: "Chester Granard", installDate: d(12), department: "PLUM", stage: "SOLD_ACTIVE" },
        { job: "900007", customer: "Sample Golf", hca: "Samir Khoury", installDate: d(-4), department: "HVAC", stage: "SOLD_DONE_FOLLOW_UP_LATER" }],
      pipeline: [
        { job: "800001", customer: "Sample Hotel (backlog)", hca: "Samir Khoury", source: "backlog", comboDate: d(5), comboTab: "PENDING" },
        { job: "800002", customer: "Sample India (backlog)", hca: "Samir Khoury", source: "backlog", comboDate: "", comboTab: "TBD" },
        { job: "800003", customer: "Sample Juliet (pipeline)", hca: "Samir Khoury", source: "pipeline", comboDate: "", comboTab: "" },
        { job: "800004", customer: "Sample Kilo (pipeline)", hca: "Samir Khoury", source: "pipeline", comboDate: d(15), comboTab: "PENDING" },
        { job: "800005", customer: "Sample Lima (backlog)", hca: "Chester Granard", source: "backlog", comboDate: "", comboTab: "TBD" }],
      records: {}, outbox: []
    };
  }
  function load() { try { var d = JSON.parse(g.localStorage.getItem(KEY)); if (d && d.jobs && d.records) return d; } catch (e) { } var s = seed(); save(s); return s; }
  function save(db) { try { g.localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } }

  function clearDrafts() { try { Object.keys(g.localStorage).filter(function (k) { return k.indexOf("cmh_practice_req_") === 0; }).forEach(function (k) { g.localStorage.removeItem(k); }); } catch (e) { } }
  function findJob(db, job) {
    for (var i = 0; i < db.jobs.length; i++) if (db.jobs[i].job === job) return db.jobs[i];
    for (var k = 0; k < db.pipeline.length; k++) if (db.pipeline[k].job === job) {
      var p = db.pipeline[k]; return Object.assign({}, p, { installDate: p.comboDate || "", department: p.department || "HVAC", stage: "PIPELINE" });
    }
    return null;
  }
  function payState(p) { if (!p || p === "Select…") return ""; if (p.indexOf("⏳") === 0) return "work"; if (p === "N/A") return ""; return p.indexOf("✔") === 0 ? "yes" : "no"; }
  function hcaItems(rec) {
    var h = rec.hca || {}, items = h.items || {}, pay = h.pay || "";
    var ids = BASE_ITEMS.concat(/rental/i.test(pay) ? RENTAL_ITEMS : [], ["rebate"]), out = {};
    if ((items.rebate || {}).v === "yes") ids = ids.concat(REBATE_PROGRAM_ITEMS[rebateKey(h.rebateProgram)] || []);
    ids.forEach(function (i) { var v = i === "pay" ? payState(pay) : ((items[i] || {}).v || ""); out[i] = v === "na" && i !== "pay" && i !== "rebate" && NA_OK.indexOf(i) < 0 ? "" : v; if (i === "heatload" && (items.heatload || {}).v === "no" && /^Mini split/.test((items.heatload || {}).why || "")) out[i] = "na"; });   /* a stale N/A on an item that no longer offers it is unanswered; a Heat load "No" because it is a mini split is acceptable (not applicable, no date needed) */
    return out;
  }
  function readiness(rec) {
    var st = hcaItems(rec), keys = Object.keys(st).filter(function (k) { return st[k] !== "na" && k !== "rebate"; });
    var done = 0, work = 0, no = [];
    keys.forEach(function (k) { if (st[k] === "yes") done++; else if (st[k] === "work") work++; else if (st[k] === "no") no.push(k); });
    var today = iso(new Date()), overdue = no.some(function (k) { var w = (((rec.hca || {}).items || {})[k] || {}).when; return w && w < today; });
    return { done: done, total: keys.length, working: work, open: no.length, overdue: overdue };
  }
  function laneState(rec, lane) {
    var l = (rec.lanes || {})[lane] || {}, items = l.items || {}, need = LANES[lane].items;
    var res = need.map(function (i) { return (items[i] || {}).result; });
    return { checked: res.filter(Boolean).length, total: need.length, missing: res.filter(function (r) { return r === "missing" || r === "mismatch"; }).length, signoff: l.signoff || "" };
  }
  function hcaMissing(rec) {
    var items = (rec.hca || {}).items || {}, st = hcaItems(rec), out = [];
    var need = REQUIRED_HCA.concat(["rebate"], RENTAL_ITEMS.filter(function (i) { return i in st; }), REBATE_ITEMS.slice(1).filter(function (i) { return i in st; }));
    need.forEach(function (i) { if (!st[i]) out.push(i); });
    if (st.rebate === "yes" && !rebateKey(h2(rec).rebateProgram)) out.push("rebate program");
    Object.keys(st).forEach(function (k) { if (st[k] === "no") { var it = items[k] || {}; if (!(it.why && it.when)) out.push(k + " (why and by when)"); } });
    return out;
  }
  function h2(rec) { return rec.hca || {}; }
  function rebateGate(rec) {
    var st = hcaItems(rec); if (st.rebate !== "yes") return true;
    var key = rebateKey(h2(rec).rebateProgram); return !!key && REBATE_PROGRAM_ITEMS[key].every(function (i) { return st[i] === "yes"; });
  }
  function deriveStatus(rec) {
    if (rec.installed) return "installed";
    if (!(rec.hca || {}).submittedAt) return "working";
    var ls = Object.keys(LANES).map(function (k) { return laneState(rec, k); });
    if (!hcaMissing(rec).length && rebateGate(rec) && ls.every(function (x) { return x.signoff === "confirmed" && x.missing === 0 && x.checked === x.total; })) return "ready";
    if (ls.some(function (x) { return x.checked || x.signoff; })) return "in_review";
    return "submitted";
  }
  function history(rec, who, field, from, to) { (rec.history = rec.history || []).push({ at: nowIso(), by: who || "?", field: field, from: from, to: to }); }
  function pub(rec) {
    var r = Object.assign({}, rec); r.readiness = readiness(rec); r.status = deriveStatus(rec);
    r.lanesSummary = {}; Object.keys(LANES).forEach(function (k) { r.lanesSummary[k] = laneState(rec, k); }); return r;
  }

  function openItems(rec) {
    var today = iso(new Date()), h = rec.hca || {}, st = hcaItems(rec), out = [];
    Object.keys(st).forEach(function (k) {
      var it = (h.items || {})[k] || {};
      if (st[k] === "no") out.push({ who: "HCA", item: k, state: "not done", why: it.why || "", when: it.when || "", overdue: !!(it.when && it.when < today) });
      else if (st[k] === "work") out.push({ who: "HCA", item: k, state: "working", why: "", when: "", overdue: false });
    });
    if (st.rebate === "yes" && !rebateGate(rec)) out.push({ who: "HCA", item: "rebate", state: "not secured", why: "", when: "", overdue: false });
    Object.keys(rec.lanes || {}).forEach(function (lane) {
      var items = (rec.lanes[lane] || {}).items || {};
      Object.keys(items).forEach(function (k) { var it = items[k];
        if (it.result === "missing" || it.result === "mismatch") out.push({ who: LANES[lane].who, item: k, state: it.result, why: it.found || "", when: it.when || "", overdue: !!(it.when && it.when < today) }); });
    });
    return out;
  }
  function adminRow(meta, rec, source) {
    rec = rec || { hca: {} }; var oi = openItems(rec), dues = oi.map(function (x) { return x.when; }).filter(Boolean).sort(), hist = rec.history || [], lanes = {};
    Object.keys(LANES).forEach(function (k) { lanes[k] = laneState(rec, k); });
    return Object.assign({}, meta, { source: source, status: deriveStatus(rec), readiness: readiness(rec), lanes: lanes, parked: rec.parked || null, openItems: oi,
      nextDue: dues[0] || "", overdue: oi.some(function (x) { return x.overdue; }), lastActivity: hist.length ? hist[hist.length - 1].at : "", reopen: rec.reopen || null });
  }

  function allProjects(db) { var out = db.jobs.slice(); db.pipeline.forEach(function (p) { if (!out.some(function (j) { return j.job === p.job; })) out.push(findJob(db, p.job)); }); return out; }

  function get(path, q, db) {
    var jobs = db.jobs, recs = db.records;
    if (path === "/api/jobs") {
      var rep = String(q.rep || "").trim().toLowerCase(), out = [];
      jobs.forEach(function (j) { if (rep && j.hca.toLowerCase() !== rep) return; var rec = recs[j.job] || { hca: {} };
        out.push(Object.assign({}, j, { readiness: readiness(rec), status: deriveStatus(rec), parked: rec.parked || null })); });
      var pipe = db.pipeline.filter(function (p) { return !rep || p.hca.toLowerCase() === rep; }).map(function (p) { var rec = recs[p.job] || { hca: {} };
        return Object.assign({}, p, { readiness: readiness(rec), status: deriveStatus(rec), parked: rec.parked || null }); });
      return [200, { ok: true, jobs: out, pipeline: pipe }];
    }
    if (path === "/api/record") {
      var meta = findJob(db, q.job || ""); if (!meta) return [404, { ok: false, error: "unknown job" }];
      return [200, { ok: true, job: meta, record: pub(recs[q.job] || { hca: {} }) }];
    }
    if (path === "/api/queue") {
      var o2 = []; allProjects(db).forEach(function (j) { var rec = recs[j.job]; if (!rec || !(rec.hca || {}).submittedAt) return;
        var lanes = {}; Object.keys(LANES).forEach(function (k) { lanes[k] = laneState(rec, k); });
        o2.push(Object.assign({}, j, { status: deriveStatus(rec), readiness: readiness(rec), lanes: lanes })); });
      return [200, { ok: true, jobs: o2 }];
    }
    if (path === "/api/ready") {
      return [200, { ok: true, jobs: allProjects(db).filter(function (j) { return recs[j.job] && deriveStatus(recs[j.job]) === "ready"; }).map(function (j) { return Object.assign({}, j, { readiness: readiness(recs[j.job]) }); }) }];
    }
    if (path === "/api/admin") {
      var rows = jobs.filter(function (j) { return !/DONE|COMPLETE/i.test(j.stage || ""); }).map(function (j) { return adminRow(j, recs[j.job], "sold"); });
      var have = {}; rows.forEach(function (r) { have[r.job] = 1; });
      db.pipeline.forEach(function (pj) { if (!have[pj.job]) rows.push(adminRow(findJob(db, pj.job), recs[pj.job], pj.source || "pipeline")); });
      return [200, { ok: true, jobs: rows }];
    }
    if (path === "/api/config") return [200, { ok: true, jurisdictionUrl: "" }];
    if (path === "/api/outbox") return [200, { ok: true, mail: db.outbox }];
    if (path === "/api/meta") return [200, { ok: true, lanes: LANES, labels: LANE_LABELS, sandbox: true, practice: true }];
    return [404, { ok: false, error: "no such endpoint" }];
  }

  function post(path, body, db) {
    if (path === "/api/reset") { var s = seed(); db.jobs = s.jobs; db.pipeline = s.pipeline; db.records = {}; db.outbox = []; clearDrafts(); return [200, { ok: true }]; }
    var job = String(body.job == null ? "" : body.job), meta = findJob(db, job);
    if (["/api/hca", "/api/lane", "/api/install", "/api/reopen"].indexOf(path) < 0) return [404, { ok: false, error: "no such endpoint" }];
    if (!meta) return [404, { ok: false, error: "unknown job" }];
    var rec = db.records[job] = db.records[job] || { hca: {} }, who = str(body.by, 60);
    if (path === "/api/hca") {
      if (["in_review", "ready", "installed"].indexOf(deriveStatus(rec)) >= 0) return [409, { ok: false, error: "locked: job is in review" }];
      var h = rec.hca = rec.hca || {};
      if ("pay" in body) h.pay = str(body.pay, 80);
      if ("notes" in body) h.notes = str(body.notes, 600);
      if ("rebateProgram" in body) h.rebateProgram = str(body.rebateProgram, 60);
      if ("system" in body) h.system = str(body.system, 60);
      if ("scope" in body) h.scope = str(body.scope, 60);
      if ("vendor" in body) h.vendor = str(body.vendor, 60);
      if ("filterSize" in body) h.filterSize = str(body.filterSize, 30);
      var itemsIn = body.items == null || (isObj(body.items) && !Object.keys(body.items).length) ? {} : body.items;
      if (!isObj(itemsIn) || !Object.keys(itemsIn).every(function (k) { return isObj(itemsIn[k]); })) return [400, { ok: false, error: "items must be an object of objects" }];
      var ks = Object.keys(itemsIn);
      for (var i = 0; i < ks.length; i++) {
        var k = ks[i], v = itemsIn[k];
        if ((BASE_ITEMS.concat(RENTAL_ITEMS, REBATE_ITEMS, CLAIM_ITEMS)).indexOf(k) < 0) return [400, { ok: false, error: "unknown item " + k }];
        if (HCA_STATES.indexOf(v.v) < 0 || ((k === "rebate" || k === "claim" || k === "rb-applied" || k === "permitdelay") && v.v !== "yes" && v.v !== "na") || (v.v === "na" && k !== "rebate" && k !== "claim" && k !== "rb-applied" && k !== "downpay" && k !== "permitdelay" && NA_OK.indexOf(k) < 0)) return [400, { ok: false, error: "bad state for " + k }];
        h.items = h.items || {}; var old = (h.items[k] || {}).v;
        h.items[k] = { v: v.v, why: str(v.why, 60), when: str(v.when, 10), note: str(v.note, 200) };
        if (old !== v.v) history(rec, who, "hca." + k, old === undefined ? null : old, v.v);
      }
      if ("parked" in body) {
        if (body.parked !== null && !isObj(body.parked)) return [400, { ok: false, error: "parked must be an object" }];
        rec.parked = body.parked && Object.keys(body.parked).length ? { reason: str(body.parked.reason, 200), revisit: str(body.parked.revisit, 200), note: str(body.parked.note, 200) } : null;
        history(rec, who, "parked", null, rec.parked ? rec.parked.reason : null);
      }
      if (body.submit) {
        var miss = hcaMissing(rec); if (miss.length) return [400, { ok: false, error: "cannot submit, still needed: " + miss.join(", ") }];
        h.submittedAt = nowIso(); delete rec.reopen; rec.parked = null; history(rec, who, "hca.submitted", null, "submitted");
        db.outbox.push({ at: nowIso(), to: ["Lyle", "Jon", "Geoff", "Amy"], subject: "Install requirements submitted — job " + job + " " + meta.customer, note: "PRACTICE: not sent", readiness: readiness(rec) });
      }
    } else if (path === "/api/lane") {
      var lane = body.lane; if (!LANES[lane]) return [400, { ok: false, error: "bad lane" }];
      var L = rec.lanes = rec.lanes || {}; L[lane] = L[lane] || { items: {} }; var l = L[lane]; l.items = l.items || {};
      var li = body.items == null || (isObj(body.items) && !Object.keys(body.items).length) ? {} : body.items;
      if (!isObj(li) || !Object.keys(li).every(function (k) { return isObj(li[k]); })) return [400, { ok: false, error: "items must be an object of objects" }];
      var lk = Object.keys(li);
      for (var j = 0; j < lk.length; j++) {
        var key = lk[j], it = li[key];
        if (LANES[lane].items.indexOf(key) < 0 || RESULTS.indexOf(it.result) < 0) return [400, { ok: false, error: "bad item " + key }];
        if (it.result !== "verified" && !(it.found && it.when)) return [400, { ok: false, error: "missing/mismatch needs what was found and a by-when date" }];
        var o = (l.items[key] || {}).result;
        l.items[key] = { result: it.result, found: str(it.found, 200), when: str(it.when, 10), note: str(it.note, 200), by: who, at: nowIso() };
        if (o !== it.result) history(rec, who, "lane." + lane + "." + key, o === undefined ? null : o, it.result);
      }
      if ("signoff" in body) {
        if (SIGNOFFS.indexOf(body.signoff) < 0) return [400, { ok: false, error: "bad signoff" }];
        l.signoff = body.signoff; l.by = who; l.at = nowIso(); history(rec, who, "lane." + lane + ".signoff", null, body.signoff);
      }
    } else if (path === "/api/reopen") {
      var reason = str(String(body.reason == null ? "" : body.reason).trim(), 200);
      if (reason.length < 3) return [400, { ok: false, error: "say why you are sending it back" }];
      if (["submitted", "in_review", "ready"].indexOf(deriveStatus(rec)) < 0) return [409, { ok: false, error: "only a submitted project can be sent back" }];
      if (rec.hca) delete rec.hca.submittedAt;
      rec.reopen = { by: who, reason: reason, at: nowIso() };
      Object.keys(rec.lanes || {}).forEach(function (k) { delete rec.lanes[k].signoff; });
      history(rec, who, "sent back", null, reason);
      db.outbox.push({ at: nowIso(), to: [meta.hca], subject: "Sent back — job " + job + " " + meta.customer, note: "PRACTICE: not sent", reason: reason });
    } else {
      if (["ready", "installed"].indexOf(deriveStatus(rec)) < 0) return [409, { ok: false, error: "only a ready project can be marked installed" }];
      rec.installed = "installed" in body ? !!body.installed : true; history(rec, who, "installed", null, rec.installed);
    }
    return [200, { ok: true, record: pub(rec) }];
  }

  function handle(method, urlStr, bodyText) {
    var u = new URL(urlStr, "http://x/"), path = u.pathname.replace(/^.*?(\/api\/)/, "/api/"), db = load();
    if (method === "GET") { var q = {}; u.searchParams.forEach(function (v, k) { q[k] = v; }); return get(path, q, db); }
    if ((bodyText || "").length > MAX_BODY) return [413, { ok: false, error: "body too large" }];
    var body; try { body = JSON.parse(bodyText || "{}"); } catch (e) { return [400, { ok: false, error: "bad json" }]; }
    if (!isObj(body)) return [400, { ok: false, error: "body must be an object" }];
    var r; try { r = post(path, body, db); } catch (e) { return [400, { ok: false, error: "malformed request" }]; }
    save(db); return r;
  }

  if (g.fetch && !g.__cmhPractice) {
    g.__cmhPractice = true;
    var realFetch = g.fetch.bind(g);
    g.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "", u;
      try { u = new URL(url, g.location.href); } catch (e) { return realFetch(input, init); }
      if (u.pathname.indexOf("/api/") < 0 || u.origin !== g.location.origin) return realFetch(input, init);
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var r = handle(method, u.href, init && init.body ? String(init.body) : "");
      return Promise.resolve(new Response(JSON.stringify(r[1]), { status: r[0], headers: { "Content-Type": "application/json" } }));
    };
  }
  g.CMHPracticeApi = { handle: handle, reset: function () { save(seed()); } };
  if (typeof module !== "undefined") module.exports = g.CMHPracticeApi;
})(typeof window !== "undefined" ? window : globalThis);

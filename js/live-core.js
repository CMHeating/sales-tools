/* LIVE DATA CORE — answers the same /api/... calls as sandbox/server.py and js/practice-api.js, but from Firebase, through an injected `store`.
   Nothing here talks to the network by itself: js/live-api.js supplies a store backed by the Firebase SDK; the emulator test supplies another.
   The database RULES are the real lock. This code only mirrors them so people get clear messages instead of PERMISSION_DENIED.
   Record layout (rules/cmh_install_req.rules.fragment.json):
     cmh_install_jobs/<hcaKey>/<job>             = job info {job, customer, hca, installDate, department, stage, source, comboDate, comboTab} (written by the trusted sync, never by this code)
     cmh_install_req/<hcaKey>/<job>/{hca, parked, lanes/<lane>, status, history/<id>, reopen}
     cmh_install_roster/{managers,schedulers,hcas}  (console-managed; hcas = {hcaKey: display name} so staff can list every HCA)
   Status is STORED (the rules check transitions): working -> submitted -> in_review -> ready -> installed; an admin send-back stores `working` + `reopen`. */
(function (g) {
  "use strict";
  var MAX_BODY = 64 * 1024;
  var BASE_ITEMS = ["pay", "stock", "permit", "heatload", "ahri", "mat", "photos", "video"];
  var RENTAL_ITEMS = ["r-contract", "r-penny", "r-credit", "r-payauth", "r-dl", "r-deed"];
  var REQUIRED_HCA = ["pay", "stock", "permit", "mat", "photos", "video"];
  var LANES = {
    sales: { who: "Geoff", items: ["disc", "rebate", "ahri-ok", "financing", "slip", "auths"] },
    install: { who: "Lyle", items: ["mat-ok", "stock-ok", "layout-ok", "labor", "sizing", "permit-ok"] },
    electrical: { who: "Jon", items: ["panel", "disconnect", "outlet", "elabor"] }
  };
  var LANE_LABELS = { disc: "Discounts correct", rebate: "Rebate submitted / eligible", "ahri-ok": "Equipment is an AHRI match",
    financing: "Financing arranged and approved", slip: "Sales slip signed", auths: "Authorizations done",
    "mat-ok": "Materials list complete", "stock-ok": "Equipment in stock", "layout-ok": "Layout photos and video",
    labor: "Install labor billed correctly", sizing: "Equipment matches the load", "permit-ok": "Permit ready",
    panel: "Panel / breaker scope", disconnect: "Disconnect", outlet: "Service outlet", elabor: "Electrical labor billed correctly" };
  var RESULTS = ["verified", "missing", "mismatch"], SIGNOFFS = ["confirmed", "attention", "notready"], HCA_STATES = ["yes", "work", "no", "na"];

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function str(x, n) { return String(x == null ? "" : x).slice(0, n); }
  function nowIso() { return new Date().toISOString(); }
  function rid() { return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---- record logic (same rules as practice-api.js; status comes from the stored value) ---- */
  function payState(p) { if (!p || p === "Select…") return ""; if (p.indexOf("⏳") === 0) return "work"; if (p === "N/A") return "na"; return p.indexOf("✔") === 0 ? "yes" : "no"; }
  function hcaItems(rec) {
    var h = rec.hca || {}, items = h.items || {}, pay = h.pay || "";
    var ids = BASE_ITEMS.concat(/rental/i.test(pay) ? RENTAL_ITEMS : []), out = {};
    ids.forEach(function (i) { out[i] = i === "pay" ? payState(pay) : ((items[i] || {}).v || ""); });
    return out;
  }
  function readiness(rec, todayIso) {
    var st = hcaItems(rec), keys = Object.keys(st).filter(function (k) { return st[k] !== "na"; });
    var done = 0, work = 0, no = [];
    keys.forEach(function (k) { if (st[k] === "yes") done++; else if (st[k] === "work") work++; else if (st[k] === "no") no.push(k); });
    var today = todayIso || iso(new Date()), overdue = no.some(function (k) { var w = (((rec.hca || {}).items || {})[k] || {}).when; return w && w < today; });
    return { done: done, total: keys.length, working: work, open: no.length, overdue: overdue };
  }
  function laneState(rec, lane) {
    var l = (rec.lanes || {})[lane] || {}, items = l.items || {}, need = LANES[lane].items;
    var res = need.map(function (i) { return (items[i] || {}).result; });
    return { checked: res.filter(Boolean).length, total: need.length, missing: res.filter(function (r) { return r === "missing" || r === "mismatch"; }).length, signoff: l.signoff || "" };
  }
  function hcaMissing(rec) {
    var items = (rec.hca || {}).items || {}, st = hcaItems(rec), out = [];
    var need = REQUIRED_HCA.concat(RENTAL_ITEMS.filter(function (i) { return i in st; }));
    need.forEach(function (i) { if (!st[i]) out.push(i); });
    Object.keys(st).forEach(function (k) { if (st[k] === "no") { var it = items[k] || {}; if (!(it.why && it.when)) out.push(k + " (why and by when)"); } });
    return out;
  }
  function allLanesReady(rec) {
    return Object.keys(LANES).map(function (k) { return laneState(rec, k); }).every(function (x) { return x.signoff === "confirmed" && x.missing === 0 && x.checked === x.total; });
  }
  /* The status a record SHOULD have. 'working' covers: never submitted, and sent back by an admin. */
  function deriveStatus(rec) {
    if (rec.status === "installed") return "installed";
    if (rec.status === "working" || !(rec.hca || {}).submittedAt) return "working";
    var ls = Object.keys(LANES).map(function (k) { return laneState(rec, k); });
    if (!hcaMissing(rec).length && allLanesReady(rec)) return "ready";
    if (ls.some(function (x) { return x.checked || x.signoff; })) return "in_review";
    return "submitted";
  }
  /* Firebase hands back keyed objects; the pages expect arrays, and a send-back note that the HCA has since answered by resubmitting is no longer current. */
  function normalize(raw) {
    var rec = Object.assign({}, raw || {}); rec.hca = Object.assign({}, rec.hca || {});
    var hist = rec.history; rec.history = isObj(hist) ? Object.keys(hist).map(function (k) { return hist[k]; }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }) : (Array.isArray(hist) ? hist : []);
    if (rec.reopen && rec.hca.submittedAt && String(rec.reopen.at || "") <= String(rec.hca.submittedAt)) delete rec.reopen;
    if (rec.status === "installed") rec.installed = true;
    return rec;
  }
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

  /* Who is this? Read from the private roster only. Returns {role: hca|manager|scheduler|admin|'' , email, name, lanes, hcaKey}. */
  function emailKey(e) { return String(e || "").toLowerCase().replace(/\./g, ","); }
  function identify(get, email) {
    if (!email) return Promise.reject(new Error("not signed in"));
    var k = emailKey(email), me = { email: email, role: "", name: "", lanes: {}, hcaKey: "" };
    function rd(p) { return get(p).catch(function () { return null; }); }
    return rd("cmh_install_roster/managers/" + k).then(function (m) {
      if (m) { me.role = m.admin === true ? "admin" : "manager"; me.name = m.name || ""; me.lanes = { sales: m.sales === true, install: m.install === true, electrical: m.electrical === true }; return me; }
      return rd("cmh_install_roster/schedulers/" + k).then(function (sc) {
        if (sc) { me.role = "scheduler"; return me; }
        return rd("cmh_followup_roster/hcas/" + k).then(function (h) { if (h) { me.role = "hca"; me.hcaKey = String(h); } return me; });
      });
    });
  }

  /* ---- the API ---- */
  function create(store) {
    var ME = null, INDEX = null, JOBKEY = {};
    function fail(code, msg) { return [code, { ok: false, error: msg }]; }
    function who() { return ME ? Promise.resolve(ME) : identify(store.get, store.email).then(function (m) { ME = m; return m; }); }
    function hcaKeys(me) {
      if (me.role === "hca") return Promise.resolve(me.hcaKey ? [me.hcaKey] : []);
      if (INDEX) return Promise.resolve(INDEX);
      return store.get("cmh_install_roster/hcas").then(function (v) { INDEX = Object.keys(v || {}); return INDEX; });
    }
    function jobMeta(hk, job, raw) {
      var m = isObj(raw) ? raw : {}; return Object.assign({ job: job, customer: "", hca: "", installDate: "", department: "", stage: "" }, m, { job: job, hcaKey: hk });
    }
    /* every project the caller may see: [{hk, job, meta}] */
    function allJobs(me) {
      return hcaKeys(me).then(function (keys) {
        return Promise.all(keys.map(function (k) { return store.get("cmh_install_jobs/" + k).then(function (v) { return { k: k, v: v || {} }; }); }));
      }).then(function (rows) {
        var out = []; rows.forEach(function (r) { Object.keys(r.v).forEach(function (j) { JOBKEY[j] = r.k; out.push({ hk: r.k, job: j, meta: jobMeta(r.k, j, r.v[j]) }); }); }); return out;
      });
    }
    function findJob(me, job) {
      var hk = JOBKEY[job];
      var p = hk ? Promise.resolve(hk) : allJobs(me).then(function () { return JOBKEY[job]; });
      return p.then(function (k) {
        if (!k) return null;
        return store.get("cmh_install_jobs/" + k + "/" + job).then(function (v) { return v == null ? null : { hk: k, meta: jobMeta(k, job, v) }; });
      });
    }
    function loadRec(hk, job) { return store.get("cmh_install_req/" + hk + "/" + job).then(function (v) { return normalize(v); }); }
    function recsFor(me, jobs) {
      var keys = {}; jobs.forEach(function (j) { keys[j.hk] = 1; });
      return Promise.all(Object.keys(keys).map(function (k) { return store.get("cmh_install_req/" + k).then(function (v) { return { k: k, v: v || {} }; }); })).then(function (rows) {
        var m = {}; rows.forEach(function (r) { Object.keys(r.v).forEach(function (j) { m[r.k + "/" + j] = normalize(r.v[j]); }); }); return m;
      });
    }
    function isSold(m) { return m.source !== "backlog" && m.source !== "pipeline"; }
    function histEntry(me, field, from, to) {
      var e = { at: nowIso(), by: str(me.email, 80), field: str(field, 80) }; if (from != null) e.from = str(from, 80); if (to != null) e.to = str(to, 80); return e;
    }
    function put(up, hk, job, rel, val) { up["cmh_install_req/" + hk + "/" + job + "/" + rel] = val; }
    function addHist(up, hk, job, me, field, from, to) { put(up, hk, job, "history/" + rid(), histEntry(me, field, from, to)); }
    function commit(hk, job, up) {
      return store.update(up).then(function () { return loadRec(hk, job); }).then(function (rec) { return [200, { ok: true, record: pub(rec) }]; });
    }

    function get(path, q) {
      return who().then(function (me) {
        if (!me || !me.role) return fail(403, "Your account is not set up for the install tools.");
        if (path === "/api/meta") return [200, { ok: true, lanes: LANES, labels: LANE_LABELS, sandbox: false, practice: false, live: true, me: { role: me.role, name: me.name, lanes: me.lanes || {} } }];
        if (path === "/api/outbox") return [200, { ok: true, mail: [] }];
        if (path === "/api/record") {
          return findJob(me, q.job || "").then(function (j) {
            if (!j) return fail(404, "unknown job");
            return loadRec(j.hk, q.job).then(function (rec) { return [200, { ok: true, job: j.meta, record: pub(rec) }]; });
          });
        }
        return allJobs(me).then(function (jobs) {
          return recsFor(me, jobs).then(function (recs) {
            var R = function (j) { return recs[j.hk + "/" + j.job] || normalize({}); };
            if (path === "/api/jobs") {
              var rep = String(q.rep || "").trim().toLowerCase();
              var mine = jobs.filter(function (j) { return !rep || String(j.meta.hca || "").toLowerCase() === rep; });
              var dec = function (j) { return Object.assign({}, j.meta, { readiness: readiness(R(j)), status: deriveStatus(R(j)), parked: R(j).parked || null }); };
              return [200, { ok: true, jobs: mine.filter(function (j) { return isSold(j.meta); }).map(dec), pipeline: mine.filter(function (j) { return !isSold(j.meta); }).map(dec) }];
            }
            if (path === "/api/queue") {
              return [200, { ok: true, jobs: jobs.filter(function (j) { return (R(j).hca || {}).submittedAt && deriveStatus(R(j)) !== "working"; }).map(function (j) {
                var lanes = {}; Object.keys(LANES).forEach(function (k) { lanes[k] = laneState(R(j), k); });
                return Object.assign({}, j.meta, { status: deriveStatus(R(j)), readiness: readiness(R(j)), lanes: lanes }); }) }];
            }
            if (path === "/api/ready") {
              return [200, { ok: true, jobs: jobs.filter(function (j) { return deriveStatus(R(j)) === "ready"; }).map(function (j) { return Object.assign({}, j.meta, { readiness: readiness(R(j)) }); }) }];
            }
            if (path === "/api/admin") {
              if (me.role !== "admin") return fail(403, "The admin page is for admins.");
              return [200, { ok: true, jobs: jobs.filter(function (j) { return !/DONE|COMPLETE/i.test(j.meta.stage || ""); }).map(function (j) { return adminRow(j.meta, R(j), isSold(j.meta) ? "sold" : (j.meta.source || "pipeline")); }) }];
            }
            return fail(404, "no such endpoint");
          });
        });
      });
    }

    function post(path, body) {
      return who().then(function (me) {
        if (!me || !me.role) return fail(403, "Your account is not set up for the install tools.");
        if (["/api/hca", "/api/lane", "/api/install", "/api/reopen"].indexOf(path) < 0) return fail(404, "no such endpoint");
        var job = String(body.job == null ? "" : body.job);
        return findJob(me, job).then(function (j) {
          if (!j) return fail(404, "unknown job");
          return loadRec(j.hk, job).then(function (rec) { return apply(me, path, body, j, job, rec); });
        });
      });
    }

    function apply(me, path, body, j, job, rec) {
      var hk = j.hk, up = {}, status = deriveStatus(rec), stored = rec.status || "";
      if (path === "/api/hca") {
        if (me.role !== "hca" || me.hcaKey !== hk) return fail(403, "Only the HCA who sold this project can change their answers.");
        if (["in_review", "ready", "installed"].indexOf(status) >= 0) return fail(409, "locked: job is in review");
        var itemsIn = body.items == null || (isObj(body.items) && !Object.keys(body.items).length) ? {} : body.items;
        if (!isObj(itemsIn) || !Object.keys(itemsIn).every(function (k) { return isObj(itemsIn[k]); })) return fail(400, "items must be an object of objects");
        var merged = JSON.parse(JSON.stringify(rec)); merged.hca = merged.hca || {};
        if ("pay" in body) { merged.hca.pay = str(body.pay, 80); put(up, hk, job, "hca/pay", merged.hca.pay); }
        if ("notes" in body) { merged.hca.notes = str(body.notes, 600); put(up, hk, job, "hca/notes", merged.hca.notes); }
        var ks = Object.keys(itemsIn);
        for (var i = 0; i < ks.length; i++) {
          var k = ks[i], v = itemsIn[k];
          if (BASE_ITEMS.concat(RENTAL_ITEMS).indexOf(k) < 0) return fail(400, "unknown item " + k);
          if (HCA_STATES.indexOf(v.v) < 0) return fail(400, "bad state for " + k);
          var old = ((merged.hca.items || {})[k] || {}).v, it = { v: v.v, why: str(v.why, 60), when: str(v.when, 10), note: str(v.note, 200) };
          merged.hca.items = merged.hca.items || {}; merged.hca.items[k] = it; put(up, hk, job, "hca/items/" + k, it);
          if (old !== v.v) addHist(up, hk, job, me, "hca." + k, old === undefined ? null : old, v.v);
        }
        if ("parked" in body) {
          if (body.parked !== null && !isObj(body.parked)) return fail(400, "parked must be an object");
          var pk = body.parked && Object.keys(body.parked).length ? { reason: str(body.parked.reason, 200), revisit: str(body.parked.revisit, 10), note: str(body.parked.note, 200) } : null;
          if (pk && !(pk.reason && pk.revisit)) return fail(400, "parking needs a reason and a date");
          put(up, hk, job, "parked", pk); addHist(up, hk, job, me, "parked", null, pk ? pk.reason : null);
        }
        if (body.submit) {
          var miss = hcaMissing(merged); if (miss.length) return fail(400, "cannot submit, still needed: " + miss.join(", "));
          put(up, hk, job, "hca/submittedAt", nowIso()); put(up, hk, job, "status", "submitted"); put(up, hk, job, "parked", null);
          addHist(up, hk, job, me, "hca.submitted", null, "submitted");
        } else if (!stored) put(up, hk, job, "status", "working");
        return commit(hk, job, up);
      }
      if (path === "/api/lane") {
        var lane = body.lane; if (!LANES[lane]) return fail(400, "bad lane");
        if (!(me.role === "manager" || me.role === "admin") || !(me.lanes || {})[lane]) return fail(403, "That lane belongs to someone else.");
        if (status === "working") return fail(409, "This project is with the HCA.");
        if (status === "installed") return fail(409, "This project is already installed.");
        var li = body.items == null || (isObj(body.items) && !Object.keys(body.items).length) ? {} : body.items;
        if (!isObj(li) || !Object.keys(li).every(function (k) { return isObj(li[k]); })) return fail(400, "items must be an object of objects");
        var m2 = JSON.parse(JSON.stringify(rec)); m2.lanes = m2.lanes || {}; m2.lanes[lane] = m2.lanes[lane] || {}; m2.lanes[lane].items = m2.lanes[lane].items || {};
        var lk = Object.keys(li), touched = false;
        for (var q = 0; q < lk.length; q++) {
          var key = lk[q], x = li[key];
          if (LANES[lane].items.indexOf(key) < 0 || RESULTS.indexOf(x.result) < 0) return fail(400, "bad item " + key);
          if (x.result !== "verified" && !(x.found && x.when)) return fail(400, "missing/mismatch needs what was found and a by-when date");
          var o = (m2.lanes[lane].items[key] || {}).result, name = str(me.name || me.email, 80);
          var row = { result: x.result, found: str(x.found, 200), when: str(x.when, 10), note: str(x.note, 200), by: name, at: nowIso() };
          m2.lanes[lane].items[key] = row; up["cmh_install_req/" + hk + "/" + job + "/lanes/" + lane + "/items/" + key] = row; touched = true;
          if (o !== x.result) addHist(up, hk, job, me, "lane." + lane + "." + key, o === undefined ? null : o, x.result);
        }
        if ("signoff" in body) {
          if (SIGNOFFS.indexOf(body.signoff) < 0) return fail(400, "bad signoff");
          m2.lanes[lane].signoff = body.signoff; touched = true;
          up["cmh_install_req/" + hk + "/" + job + "/lanes/" + lane + "/signoff"] = body.signoff;
          addHist(up, hk, job, me, "lane." + lane + ".signoff", null, body.signoff);
        }
        if (touched) { up["cmh_install_req/" + hk + "/" + job + "/lanes/" + lane + "/by"] = str(me.email, 80); up["cmh_install_req/" + hk + "/" + job + "/lanes/" + lane + "/at"] = nowIso(); }
        var next = deriveStatus(Object.assign({}, m2, { status: "submitted" }));
        up["cmh_install_req/" + hk + "/" + job + "/status"] = next === "ready" ? "ready" : "in_review";
        return commit(hk, job, up);
      }
      if (path === "/api/reopen") {
        if (me.role !== "admin") return fail(403, "Only an admin can send a project back.");
        var reason = str(String(body.reason == null ? "" : body.reason).trim(), 200);
        if (reason.length < 3) return fail(400, "say why you are sending it back");
        if (["submitted", "in_review", "ready"].indexOf(status) < 0) return fail(409, "only a submitted project can be sent back");
        put(up, hk, job, "status", "working"); put(up, hk, job, "reopen", { by: str(me.email, 80), reason: reason, at: nowIso() });
        Object.keys(rec.lanes || {}).forEach(function (l) { if ((rec.lanes[l] || {}).signoff) up["cmh_install_req/" + hk + "/" + job + "/lanes/" + l + "/signoff"] = null; });
        addHist(up, hk, job, me, "sent back", null, reason);
        return commit(hk, job, up);
      }
      if (me.role !== "admin") return fail(403, "Only an admin can mark a project installed.");
      if (status !== "ready") return fail(409, "only a ready project can be marked installed");
      put(up, hk, job, "status", "installed"); addHist(up, hk, job, me, "installed", null, "true");
      return commit(hk, job, up);
    }

    function handle(method, urlStr, bodyText) {
      var u = new URL(urlStr, "http://x/"), path = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      var run;
      if (method === "GET") { var q = {}; u.searchParams.forEach(function (v, k) { q[k] = v; }); run = function () { return get(path, q); }; }
      else {
        if ((bodyText || "").length > MAX_BODY) return Promise.resolve([413, { ok: false, error: "body too large" }]);
        var body; try { body = JSON.parse(bodyText || "{}"); } catch (e) { return Promise.resolve(fail(400, "bad json")); }
        if (!isObj(body)) return Promise.resolve(fail(400, "body must be an object"));
        run = function () { return post(path, body); };
      }
      return run().catch(function (e) {
        var m = String((e && (e.code || e.message)) || e);
        if (/PERMISSION_DENIED|permission_denied/i.test(m)) return fail(403, "The database refused this (your role does not allow it, or the project is locked).");
        if (/not signed in/i.test(m)) return fail(401, "Sign in with Google on the Install tools page first.");
        return fail(500, "Something went wrong talking to the database. Nothing was saved.");
      });
    }
    return { handle: handle };
  }

  var api = { create: create, identify: identify, emailKey: emailKey, _logic: { deriveStatus: deriveStatus, readiness: readiness, hcaMissing: hcaMissing, normalize: normalize, laneState: laneState } };
  g.CMHLiveCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

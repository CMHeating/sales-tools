#!/usr/bin/env python3
"""
CMH install-completion SANDBOX server (stdlib only).

Serves the repo's static pages AND a small JSON API that stands in for the not-yet-approved job-record
storage, so the whole flow (HCA page -> managers' QC -> ready to book -> CRM readiness) can be tried end to
end WITHOUT touching live Firebase, Apps Script, ServiceTitan, the Combo Log or email.

  * Data lives in sandbox/data/*.json (seeded with FAKE customers). `POST /api/reset` re-seeds.
  * "Sending" an email only appends a line to sandbox/data/outbox.jsonl. Nothing leaves this machine.
  * Binds 127.0.0.1 by default; use --lan to test from a phone on the same Wi-Fi.
  * No auth: this is a test rig. The record shape + status rules here are the DRAFT for the real storage
    (see INSTALL-RECORD-STRUCTURE_2026-10-04.md); nothing here is the live rule set.

Run:  python3 sandbox/server.py [--port 8787] [--lan]
"""
import argparse, datetime as dt, json, os, re, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(os.path.dirname(__file__), "data")
LOCK = threading.Lock()
MAX_BODY = 64 * 1024   # bytes; larger request bodies are refused

# ---- the item model (must match install-requirements.html) -------------------------------------------
BASE_ITEMS = ["pay", "stock", "permit", "heatload", "ahri", "mat", "photos", "video", "i-labor", "e-disconnect", "e-outlet", "e-labor"]
RENTAL_ITEMS = ["r-contract", "r-penny", "r-credit", "r-payauth", "r-dl", "r-deed"]
# Rebate (2026-10-04): "rebate" is answered yes / na (= no rebate). When yes, a program is chosen and its questions must all be Complete
# for the project to reach Ready (the "rebate gate"); an HCA may still submit while a question is Working on it / Not done.
NA_OK = ["ahri", "e-disconnect", "e-outlet"] + ["r-contract", "r-penny", "r-credit", "r-payauth", "r-dl", "r-deed"]   # items that may be answered N/A ("rebate" uses na for "No rebate")
REBATE_ITEMS = ["rebate", "rb-balance", "rb-ahri", "rb-tc", "rb-equip"]
REBATE_PROGRAM_ITEMS = {"PSE": ["rb-balance", "rb-ahri", "rb-tc"], "PUD": ["rb-balance", "rb-ahri"], "Gensco": ["rb-balance", "rb-equip"], "Other": ["rb-balance", "rb-ahri"]}


def rebate_key(prog):
    prog = str(prog or "")
    return prog if prog in ("PSE", "PUD", "Gensco") else ("Other" if re.match(r"^Other: \S", prog) else "")   # a bare "Other" (no name) is not a valid program
LANES = {
    "sales":      {"who": "Geoff",  "items": ["disc", "rebate", "ahri-ok", "financing", "slip", "auths"]},
    "install":    {"who": "Lyle",   "items": ["mat-ok", "stock-ok", "layout-ok", "labor", "sizing", "permit-ok"]},
    "electrical": {"who": "Jon",    "items": ["panel", "disconnect", "outlet", "elabor"]},
}
LANE_LABELS = {
    "disc": "Discounts correct", "rebate": "Rebate submitted / eligible", "ahri-ok": "Equipment is an AHRI match",
    "financing": "Financing arranged and approved", "slip": "Sales slip signed", "auths": "Authorizations done",
    "mat-ok": "Materials list complete", "stock-ok": "Equipment in stock", "layout-ok": "Layout photos and video",
    "labor": "Install labor billed correctly", "sizing": "Equipment matches the load", "permit-ok": "Permit ready",
    "panel": "Panel / breaker scope", "disconnect": "Disconnect over 24\"?", "outlet": "Service outlet within 25'?",
    "elabor": "Electrical labor billed correctly"}
RESULTS = ("verified", "missing", "mismatch")
SIGNOFFS = ("confirmed", "attention", "notready")
HCA_STATES = ("yes", "work", "no", "na")


def find_job(jobs, pipe, job):
    """Sold jobs first, then backlog/pipeline projects (they can be completed too)."""
    for j in jobs:
        if j["job"] == job:
            return j
    for p in pipe:
        if p["job"] == job:
            return dict(p, installDate=p.get("comboDate", ""), department=p.get("department", "HVAC"), stage="PIPELINE")
    return None


def all_projects(jobs, pipe):
    """Sold jobs first, then every backlog/pipeline project (they can be completed and reviewed too)."""
    return list(jobs) + [find_job(jobs, pipe, p["job"]) for p in pipe if not any(j["job"] == p["job"] for j in jobs)]


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def load(name, default):
    try:
        with open(os.path.join(DATA, name), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save(name, obj):
    os.makedirs(DATA, exist_ok=True)
    tmp = os.path.join(DATA, name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
    os.replace(tmp, os.path.join(DATA, name))


def seed():
    """FAKE data only. Dates are relative to today so the colours (red/yellow/green) show up."""
    today = dt.date.today()
    d = lambda n: (today + dt.timedelta(days=n)).isoformat()
    jobs = [
        {"job": "900001", "customer": "Sample Alpha", "hca": "Samir Khoury", "installDate": d(2), "department": "HVAC", "stage": "SOLD_ACTIVE"},
        {"job": "900002", "customer": "Sample Bravo", "hca": "Samir Khoury", "installDate": d(6), "department": "HVAC", "stage": "SOLD_ACTIVE"},
        {"job": "900003", "customer": "Sample Charlie (rental)", "hca": "Samir Khoury", "installDate": d(9), "department": "HVAC", "stage": "SOLD_ACTIVE"},
        {"job": "900004", "customer": "Sample Delta", "hca": "Samir Khoury", "installDate": "", "department": "HVAC", "stage": "SOLD_NEEDS_ATTENTION"},
        {"job": "900005", "customer": "Sample Echo", "hca": "Chester Granard", "installDate": d(3), "department": "HVAC", "stage": "SOLD_ACTIVE"},
        {"job": "900006", "customer": "Sample Foxtrot", "hca": "Chester Granard", "installDate": d(12), "department": "PLUM", "stage": "SOLD_ACTIVE"},
        {"job": "900007", "customer": "Sample Golf", "hca": "Samir Khoury", "installDate": d(-4), "department": "HVAC", "stage": "SOLD_DONE_FOLLOW_UP_LATER"},
    ]
    pipeline = [
        {"job": "800001", "customer": "Sample Hotel (backlog)", "hca": "Samir Khoury", "source": "backlog", "comboDate": d(5), "comboTab": "PENDING"},
        {"job": "800002", "customer": "Sample India (backlog)", "hca": "Samir Khoury", "source": "backlog", "comboDate": "", "comboTab": "TBD"},
        {"job": "800003", "customer": "Sample Juliet (pipeline)", "hca": "Samir Khoury", "source": "pipeline", "comboDate": "", "comboTab": ""},
        {"job": "800004", "customer": "Sample Kilo (pipeline)", "hca": "Samir Khoury", "source": "pipeline", "comboDate": d(15), "comboTab": "PENDING"},
        {"job": "800005", "customer": "Sample Lima (backlog)", "hca": "Chester Granard", "source": "backlog", "comboDate": "", "comboTab": "TBD"},
    ]
    save("jobs.json", jobs)
    save("pipeline.json", pipeline)
    save("records.json", {})
    open(os.path.join(DATA, "outbox.jsonl"), "w").close()


# ---- derived fields -----------------------------------------------------------------------------------
def pay_state(pay):
    if not pay or pay == "Select…":
        return ""
    if pay.startswith("⏳"):
        return "work"
    if pay == "N/A":
        return ""   # payment is never N/A
    return "yes" if pay.startswith("✔") else "no"


def hca_items(rec):
    h = rec.get("hca", {})
    items = h.get("items", {})
    pay = h.get("pay", "")
    ids = list(BASE_ITEMS) + (RENTAL_ITEMS if re.search("rental", pay or "", re.I) else []) + ["rebate"]
    if items.get("rebate", {}).get("v") == "yes":
        ids += REBATE_PROGRAM_ITEMS.get(rebate_key(h.get("rebateProgram")), [])
    out = {}
    for i in ids:
        v = pay_state(pay) if i == "pay" else (items.get(i, {}).get("v") or "")
        out[i] = "" if v == "na" and i != "pay" and i != "rebate" and i not in NA_OK else v   # a stale N/A on an item that no longer offers it is unanswered
    return out


def readiness(rec):
    states = hca_items(rec)
    act = {k: v for k, v in states.items() if v != "na" and k != "rebate"}   # the rebate Yes/No is a gate question, not a task: only its program questions count
    done = sum(1 for v in act.values() if v == "yes")
    work = sum(1 for v in act.values() if v == "work")
    no = [k for k, v in act.items() if v == "no"]
    overdue = False
    today = dt.date.today().isoformat()
    for k in no:
        w = rec.get("hca", {}).get("items", {}).get(k, {}).get("when")
        if w and w < today:
            overdue = True
    return {"done": done, "total": len(act), "working": work, "open": len(no), "overdue": overdue}


def lane_state(rec, lane):
    l = rec.get("lanes", {}).get(lane, {})
    items = l.get("items", {})
    needed = LANES[lane]["items"]
    results = [items.get(i, {}).get("result") for i in needed]
    return {
        "checked": sum(1 for r in results if r),
        "total": len(needed),
        "missing": sum(1 for r in results if r in ("missing", "mismatch")),
        "signoff": l.get("signoff") or "",
    }


REQUIRED_HCA = ["pay", "stock", "permit", "mat", "photos", "video", "i-labor", "e-labor"]


def hca_missing(rec):
    """What stops an HCA submission / booking: unanswered required items, and any 'No' without why + by-when."""
    h = rec.get("hca", {})
    items = h.get("items", {})
    states = hca_items(rec)
    need = list(REQUIRED_HCA) + ["rebate"] + [i for i in RENTAL_ITEMS if i in states] + [i for i in REBATE_ITEMS[1:] if i in states]
    out = [i for i in need if not states.get(i)]
    if states.get("rebate") == "yes" and not rebate_key(h.get("rebateProgram")):
        out.append("rebate program")
    if states.get("rebate") == "yes" and not re.search(r"\d", h.get("rebateAmount") or ""):
        out.append("rebate amount")
    for k, v in states.items():
        if v == "no":
            it = items.get(k, {})
            if not (it.get("why") and it.get("when")):
                out.append(k + " (why and by when)")
    return out


def rebate_gate(rec):
    """True when no rebate is claimed, or the program is chosen and every one of its questions is Complete."""
    states = hca_items(rec)
    if states.get("rebate") != "yes":
        return True
    key = rebate_key(rec.get("hca", {}).get("rebateProgram"))
    return bool(key) and all(states.get(i) == "yes" for i in REBATE_PROGRAM_ITEMS[key])


def derive_status(rec):
    if rec.get("installed"):
        return "installed"
    h = rec.get("hca", {})
    if not h.get("submittedAt"):
        return "working"
    ls = [lane_state(rec, k) for k in LANES]
    if not hca_missing(rec) and rebate_gate(rec) and all(x["signoff"] == "confirmed" and x["missing"] == 0 and x["checked"] == x["total"] for x in ls):
        return "ready"
    if any(x["checked"] or x["signoff"] for x in ls):
        return "in_review"
    return "submitted"


def history(rec, who, field, frm, to):
    rec.setdefault("history", []).append({"at": now(), "by": who or "?", "field": field, "from": frm, "to": to})


def public(rec):
    r = dict(rec)
    r["readiness"] = readiness(rec)
    r["lanesSummary"] = {k: lane_state(rec, k) for k in LANES}
    r["status"] = derive_status(rec)
    return r


def open_items(rec):
    """Everything still open on a project, from the HCA and from the managers, with by-when dates."""
    today = dt.date.today().isoformat()
    h = rec.get("hca", {}); out = []
    for k, v in hca_items(rec).items():
        it = h.get("items", {}).get(k, {})
        if v == "no":
            w = it.get("when", "")
            out.append({"who": "HCA", "item": k, "state": "not done", "why": it.get("why", ""), "when": w, "overdue": bool(w and w < today)})
        elif v == "work":
            out.append({"who": "HCA", "item": k, "state": "working", "why": "", "when": "", "overdue": False})
    if hca_items(rec).get("rebate") == "yes" and not rebate_gate(rec):
        out.append({"who": "HCA", "item": "rebate", "state": "not secured", "why": "", "when": "", "overdue": False})
    for lane, l in (rec.get("lanes") or {}).items():
        for k, it in (l.get("items") or {}).items():
            if it.get("result") in ("missing", "mismatch"):
                w = it.get("when", "")
                out.append({"who": LANES[lane]["who"], "item": k, "state": it["result"], "why": it.get("found", ""), "when": w, "overdue": bool(w and w < today)})
    return out


def admin_row(meta, rec, source):
    rec = rec or {"hca": {}}
    oi = open_items(rec)
    dues = sorted(x["when"] for x in oi if x["when"])
    hist = rec.get("history") or []
    return dict(meta, source=source, status=derive_status(rec), readiness=readiness(rec),
                lanes={k: lane_state(rec, k) for k in LANES}, parked=rec.get("parked"), openItems=oi,
                nextDue=dues[0] if dues else "", overdue=any(x["overdue"] for x in oi),
                lastActivity=(hist[-1]["at"] if hist else ""), reopen=rec.get("reopen"))


# ---- HTTP ---------------------------------------------------------------------------------------------
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("api %s\n" % (args[0],))

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if not u.path.startswith("/api/"):
            return super().do_GET()
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        with LOCK:
            jobs, recs, pipe_all = load("jobs.json", []), load("records.json", {}), load("pipeline.json", [])
            if u.path == "/api/jobs":
                rep = q.get("rep", "").strip().lower()
                out = []
                for j in jobs:
                    if rep and j["hca"].lower() != rep:
                        continue
                    rec = recs.get(j["job"], {"hca": {}})
                    out.append(dict(j, readiness=readiness(rec), status=derive_status(rec),
                                    parked=rec.get("parked")))
                pipe = [dict(p, readiness=readiness(recs.get(p["job"], {"hca": {}})), status=derive_status(recs.get(p["job"], {"hca": {}})), parked=(recs.get(p["job"]) or {}).get("parked"))
                        for p in load("pipeline.json", []) if not rep or p["hca"].lower() == rep]
                return self._json(200, {"ok": True, "jobs": out, "pipeline": pipe})
            if u.path == "/api/record":
                job = q.get("job", "")
                meta = find_job(jobs, pipe_all, job)
                if not meta:
                    return self._json(404, {"ok": False, "error": "unknown job"})
                rec = recs.get(job, {"hca": {}})
                return self._json(200, {"ok": True, "job": meta, "record": public(rec)})
            if u.path == "/api/queue":
                out = []
                for j in all_projects(jobs, pipe_all):
                    rec = recs.get(j["job"])
                    if not rec or not rec.get("hca", {}).get("submittedAt"):
                        continue
                    out.append(dict(j, status=derive_status(rec), readiness=readiness(rec),
                                    lanes={k: lane_state(rec, k) for k in LANES}))
                return self._json(200, {"ok": True, "jobs": out})
            if u.path == "/api/ready":
                out = [dict(j, readiness=readiness(recs[j["job"]])) for j in all_projects(jobs, pipe_all)
                       if j["job"] in recs and derive_status(recs[j["job"]]) == "ready"]
                return self._json(200, {"ok": True, "jobs": out})
            if u.path == "/api/admin":
                rows = [admin_row(j, recs.get(j["job"]), "sold") for j in jobs if not re.search("DONE|COMPLETE", j.get("stage", ""), re.I)]
                have = {r["job"] for r in rows}
                for pj in pipe_all:
                    if pj["job"] in have: continue
                    m = find_job(jobs, pipe_all, pj["job"])
                    rows.append(admin_row(m, recs.get(pj["job"]), pj.get("source", "pipeline")))
                return self._json(200, {"ok": True, "jobs": rows})
            if u.path == "/api/outbox":
                try:
                    with open(os.path.join(DATA, "outbox.jsonl"), encoding="utf-8") as f:
                        lines = [json.loads(x) for x in f if x.strip()]
                except Exception:
                    lines = []
                return self._json(200, {"ok": True, "mail": lines})
            if u.path == "/api/meta":
                return self._json(200, {"ok": True, "lanes": LANES, "labels": LANE_LABELS, "sandbox": True})
        return self._json(404, {"ok": False, "error": "no such endpoint"})

    def do_POST(self):
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"ok": False, "error": "bad length"})
        if n < 0 or n > MAX_BODY:
            return self._json(413, {"ok": False, "error": "body too large"})
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json(400, {"ok": False, "error": "bad json"})
        if not isinstance(body, dict):
            return self._json(400, {"ok": False, "error": "body must be an object"})
        try:
            return self._post(u, body)
        except (AttributeError, TypeError, ValueError, KeyError):
            return self._json(400, {"ok": False, "error": "malformed request"})

    def _post(self, u, body):
        with LOCK:
            jobs, recs, pipe_all = load("jobs.json", []), load("records.json", {}), load("pipeline.json", [])
            if u.path == "/api/reset":
                seed()
                return self._json(200, {"ok": True})
            job = str(body.get("job", ""))
            meta = find_job(jobs, pipe_all, job)
            if u.path in ("/api/hca", "/api/lane", "/api/install", "/api/reopen"):
                if not meta:
                    return self._json(404, {"ok": False, "error": "unknown job"})
                rec = recs.setdefault(job, {"hca": {}})
                who = str(body.get("by", ""))[:60]
                if u.path == "/api/hca":
                    # HCA writes only hca/ and parked/ (draft rule: while not yet in review)
                    if derive_status(rec) in ("in_review", "ready", "installed"):
                        return self._json(409, {"ok": False, "error": "locked: job is in review"})
                    h = rec.setdefault("hca", {})
                    if "pay" in body:
                        h["pay"] = str(body["pay"])[:80]
                    if "notes" in body:
                        h["notes"] = str(body["notes"])[:600]
                    if "rebateProgram" in body:
                        h["rebateProgram"] = str(body["rebateProgram"] or "")[:60]
                    if "system" in body:
                        h["system"] = str(body["system"] or "")[:60]
                    if "vendor" in body:
                        h["vendor"] = str(body["vendor"] or "")[:60]
                    if "filterSize" in body:
                        h["filterSize"] = str(body["filterSize"] or "")[:30]
                    if "scope" in body:
                        h["scope"] = str(body["scope"] or "")[:60]
                    if "rebateAmount" in body:
                        h["rebateAmount"] = re.sub(r"[^0-9.,$ ]", "", str(body["rebateAmount"] or ""))[:20]
                    items_in = body.get("items") or {}
                    if not isinstance(items_in, dict) or not all(isinstance(v, dict) for v in items_in.values()):
                        return self._json(400, {"ok": False, "error": "items must be an object of objects"})
                    for k, v in items_in.items():
                        if k not in BASE_ITEMS + RENTAL_ITEMS + REBATE_ITEMS:
                            return self._json(400, {"ok": False, "error": "unknown item " + k})
                        if v.get("v") not in HCA_STATES or (k == "rebate" and v.get("v") not in ("yes", "na")) or (v.get("v") == "na" and k != "rebate" and k not in NA_OK):
                            return self._json(400, {"ok": False, "error": "bad state for " + k})
                        old = h.setdefault("items", {}).get(k, {}).get("v")
                        h["items"][k] = {"v": v["v"], "why": str(v.get("why", ""))[:60], "when": str(v.get("when", ""))[:10], "note": str(v.get("note", ""))[:200]}
                        if old != v["v"]:
                            history(rec, who, "hca." + k, old, v["v"])
                    if "parked" in body:
                        if body["parked"] is not None and not isinstance(body["parked"], dict):
                            return self._json(400, {"ok": False, "error": "parked must be an object"})
                        rec["parked"] = body["parked"] and {k: str(body["parked"].get(k, ""))[:200] for k in ("reason", "revisit", "note")} or None
                        history(rec, who, "parked", None, (rec["parked"] or {}).get("reason"))
                    if body.get("submit"):
                        miss = hca_missing(rec)
                        if miss:
                            return self._json(400, {"ok": False, "error": "cannot submit, still needed: " + ", ".join(miss)})
                        h["submittedAt"] = now()
                        rec.pop("reopen", None)
                        rec["parked"] = None
                        history(rec, who, "hca.submitted", None, "submitted")
                        with open(os.path.join(DATA, "outbox.jsonl"), "a", encoding="utf-8") as f:
                            f.write(json.dumps({"at": now(), "to": ["Lyle", "Jon", "Geoff", "Amy"], "subject": "Install requirements submitted — job " + job + " " + meta["customer"],
                                                "note": "SANDBOX: not sent", "readiness": readiness(rec)}) + "\n")
                elif u.path == "/api/lane":
                    lane = body.get("lane")
                    if lane not in LANES:
                        return self._json(400, {"ok": False, "error": "bad lane"})
                    l = rec.setdefault("lanes", {}).setdefault(lane, {"items": {}})
                    litems = body.get("items") or {}
                    if not isinstance(litems, dict) or not all(isinstance(v, dict) for v in litems.values()):
                        return self._json(400, {"ok": False, "error": "items must be an object of objects"})
                    for k, v in litems.items():
                        if k not in LANES[lane]["items"] or v.get("result") not in RESULTS:
                            return self._json(400, {"ok": False, "error": "bad item " + k})
                        if v["result"] != "verified" and not (v.get("found") and v.get("when")):
                            return self._json(400, {"ok": False, "error": "missing/mismatch needs what was found and a by-when date"})
                        old = l["items"].get(k, {}).get("result")
                        l["items"][k] = {"result": v["result"], "found": str(v.get("found", ""))[:200], "when": str(v.get("when", ""))[:10], "note": str(v.get("note", ""))[:200], "by": who, "at": now()}
                        if old != v["result"]:
                            history(rec, who, "lane.%s.%s" % (lane, k), old, v["result"])
                    if "signoff" in body:
                        if body["signoff"] not in SIGNOFFS:
                            return self._json(400, {"ok": False, "error": "bad signoff"})
                        l["signoff"], l["by"], l["at"] = body["signoff"], who, now()
                        history(rec, who, "lane.%s.signoff" % lane, None, body["signoff"])
                elif u.path == "/api/reopen":
                    reason = str(body.get("reason", "")).strip()[:200]
                    if len(reason) < 3:
                        return self._json(400, {"ok": False, "error": "say why you are sending it back"})
                    if derive_status(rec) not in ("submitted", "in_review", "ready"):
                        return self._json(409, {"ok": False, "error": "only a submitted project can be sent back"})
                    rec.get("hca", {}).pop("submittedAt", None)
                    rec["reopen"] = {"by": who, "reason": reason, "at": now()}
                    for l in (rec.get("lanes") or {}).values():
                        l.pop("signoff", None)          # managers re-confirm after the HCA fixes things
                    history(rec, who, "sent back", None, reason)
                    with open(os.path.join(DATA, "outbox.jsonl"), "a", encoding="utf-8") as f:
                        f.write(json.dumps({"at": now(), "to": [meta["hca"]], "subject": "Sent back — job " + job + " " + meta["customer"], "note": "SANDBOX: not sent", "reason": reason}) + "\n")
                else:
                    if derive_status(rec) not in ("ready", "installed"):
                        return self._json(409, {"ok": False, "error": "only a ready project can be marked installed"})
                    rec["installed"] = bool(body.get("installed", True))
                    history(rec, who, "installed", None, rec["installed"])
                save("records.json", recs)
                return self._json(200, {"ok": True, "record": public(rec)})
        return self._json(404, {"ok": False, "error": "no such endpoint"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--lan", action="store_true", help="listen on all interfaces so a phone on the same Wi-Fi can test")
    a = ap.parse_args()
    os.makedirs(DATA, exist_ok=True)
    if not os.path.exists(os.path.join(DATA, "jobs.json")):
        seed()
    srv = ThreadingHTTPServer(("0.0.0.0" if a.lan else "127.0.0.1", a.port), H)
    print("SANDBOX on http://%s:%d  (fake data, nothing leaves this machine)" % ("0.0.0.0" if a.lan else "127.0.0.1", a.port), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()

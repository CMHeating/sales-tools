/* CMHProjects — shared by crm.html (Daily Activities card + My Schedule overlay) and the sandbox preview.
   Pure functions: pass the jobs in, get HTML/rows out. No Firebase, no network.

   Sold job   { customer, job|jobNumber, hca|salesRep, installDate, department, stage, readiness?{done,total,overdue} }
   Pipeline   { customer, job, hca, source:'backlog'|'pipeline', comboDate (ISO or ''), comboTab ('PENDING'|'TBD'|''), readiness? }
   "Where is it" for a pipeline job comes from the Combo Log: a date, the TBD tab, or not in the Combo Log yet. */
(function (g) {
  var C = { page: "install-requirements.html", total: 8, redDays: 3 };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(v) { return String(v || "").trim().toLowerCase(); }
  function num(j) { return String(j.jobNumber || j.job || j.number || j.jobNo || "").trim(); }
  function iso(j) { return String(j.comboDate || j.installDate || "").slice(0, 10); }
  function dateLabel(i) { if (!i) return "TBD"; var p = i.split("-"); return (+p[1]) + "/" + (+p[2]); }
  function owner(j) { return j.hca || j.salesRep || ""; }

  function link(j, who) {
    var q = new URLSearchParams({ job: num(j), cust: j.customer || "", date: iso(j), rep: (who && who.full) || owner(j) });
    return C.page + "#" + q.toString();
  }

  /* readiness colour: green = all done; red = date within redDays with items open (or overdue No); yellow otherwise */
  function ready(j, todayIso) {
    var r = j.readiness || {};
    var total = Math.max(1, Math.min(99, Math.floor(Number(r.total)) || C.total)), done = Math.max(0, Math.min(total, Math.floor(Number(r.done)) || 0));
    var i = iso(j), days = i ? Math.round((Date.parse(i + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 86400000) : null;
    var color = "y";
    if (done >= total) color = "g";
    else if (r.overdue || (days !== null && days <= C.redDays)) color = "r";
    return { done: done, total: total, color: color, days: days };
  }

  function where(j) {
    if (j.comboDate) return { k: "sched", t: "Scheduled " + dateLabel(String(j.comboDate).slice(0, 10)) };
    if (/tbd/i.test(j.comboTab || "")) return { k: "tbd", t: "TBD" };
    return { k: "none", t: "Not in Combo Log yet" };
  }

  function soldOpen(jobs, who) {
    if (!who) return [];
    return (jobs || []).filter(function (j) { return norm(owner(j)) === norm(who.full) && !/DONE|COMPLETE/i.test(j.stage || ""); });
  }
  /* backlog/pipeline jobs for this HCA that are not already a sold job (by job number) */
  function pipelineFor(pipe, sold, who) {
    if (!who) return [];
    var haveJob = {}, haveProj = {};
    (sold || []).forEach(function (j) { if (num(j)) haveJob[num(j)] = 1; if (j.projectId) haveProj[String(j.projectId)] = 1; });
    return (pipe || []).filter(function (j) {
      if (norm(owner(j)) !== norm(who.full)) return false;
      if (num(j) && haveJob[num(j)]) return false;
      if (j.projectId && haveProj[String(j.projectId)]) return false;
      return true;
    });
  }

  function row(j, who, sub, tag, todayIso) {
    var r = ready(j, todayIso);
    var glyph = { g: "✓", y: "…", r: "!" }[r.color], word = { g: "complete", y: "in progress", r: "needs attention" }[r.color];
    return '<a class="proj-row" href="' + esc(link(j, who)) + '"><span class="proj-dot ' + r.color + '" role="img" aria-label="' + word + '" title="' + word + '">' + glyph + "</span>" +
      '<span class="proj-main"><b>' + esc(j.customer || "Unknown") + "</b><span>" + esc(sub) + "</span></span>" +
      (tag ? '<span class="proj-tag">' + esc(tag) + "</span>" : "") +
      '<span class="proj-n">' + r.done + " of " + r.total + "</span></a>";
  }

  var RANK = { r: 0, y: 1, g: 2 };
  function sortRows(rows, todayIso) {
    return rows.map(function (j) { return { j: j, r: ready(j, todayIso) }; })
      .sort(function (a, b) { return RANK[a.r.color] - RANK[b.r.color] || (iso(a.j) || "9999").localeCompare(iso(b.j) || "9999"); })
      .map(function (x) { return x.j; });
  }

  /* Daily Activities card: sold projects, then backlog / pipeline to work through */
  function listHtml(sold, pipe, who, todayIso) {
    var s = sortRows(soldOpen(sold, who), todayIso), p = pipelineFor(pipe, sold, who);
    var html = "";
    if (s.length) html += s.map(function (j) { return row(j, who, dateLabel(iso(j)), "", todayIso); }).join("");
    if (p.length) {
      html += '<div class="proj-h">Backlog &amp; pipeline — to work through</div>';
      var order = { none: 0, tbd: 1, sched: 2 };
      p.slice().sort(function (a, b) { return order[where(a).k] - order[where(b).k] || (iso(a) || "9999").localeCompare(iso(b) || "9999"); })
        .forEach(function (j) { html += row(j, who, (j.source === "pipeline" ? "Pipeline" : "Backlog") + " · " + where(j).t, "", todayIso); });
    }
    return html || '<div class="soon">No open sold or backlog projects.</div>';
  }

  /* My Schedule overlay: jobs dated inside [from,to]; plus, always, the undated backlog/pipeline to work through */
  function overlayHtml(sold, pipe, who, fromIso, toIso, todayIso) {
    var inRange = function (j) { var i = iso(j); return i && i >= fromIso && i <= toIso; };
    var s = soldOpen(sold, who).filter(inRange).sort(function (a, b) { return iso(a).localeCompare(iso(b)); });
    var p = pipelineFor(pipe, sold, who), pDated = p.filter(inRange).sort(function (a, b) { return iso(a).localeCompare(iso(b)); });
    var pOpen = p.filter(function (j) { return !iso(j); });
    var html = "";
    if (s.length || pDated.length) {
      html += '<div class="sched-ov"><div class="sched-ov-h">Your installs</div>' +
        s.map(function (j) { return row(j, who, dateLabel(iso(j)) + (j.department ? " · " + j.department : ""), "", todayIso); }).join("") +
        pDated.map(function (j) { return row(j, who, dateLabel(iso(j)) + " · " + (j.source === "pipeline" ? "Pipeline" : "Backlog"), "", todayIso); }).join("") + "</div>";
    }
    if (pOpen.length) {
      html += '<div class="sched-ov"><div class="sched-ov-h">Backlog &amp; pipeline — no date yet (' + pOpen.length + ")</div>" +
        pOpen.map(function (j) { return row(j, who, (j.source === "pipeline" ? "Pipeline" : "Backlog") + " · " + where(j).t, "", todayIso); }).join("") + "</div>";
    }
    return html;
  }


  /* Project picker for the "Project completion" button: sold projects first (red, yellow, green; soonest first),
     then backlog / pipeline (not in Combo Log, TBD, then scheduled). Each option carries its own link. */
  function options(sold, pipe, who, todayIso) {
    var out = [];
    sortRows(soldOpen(sold, who), todayIso).forEach(function (j) {
      var r = ready(j, todayIso);
      out.push({ label: (j.customer || "Unknown") + " — " + dateLabel(iso(j)) + " · " + r.done + " of " + r.total, link: link(j, who), group: "Sold" });
    });
    var order = { none: 0, tbd: 1, sched: 2 };
    pipelineFor(pipe, sold, who).sort(function (a, b) { return order[where(a).k] - order[where(b).k] || (iso(a) || "9999").localeCompare(iso(b) || "9999"); })
      .forEach(function (j) {
        out.push({ label: (j.customer || "Unknown") + " — " + (j.source === "pipeline" ? "Pipeline" : "Backlog") + " · " + where(j).t, link: link(j, who), group: "Backlog & pipeline" });
      });
    return out;
  }
  function optionsHtml(opts) {
    var h = '<option value="">Choose a project…</option>', grp = "";
    opts.forEach(function (o, i) {
      if (o.group !== grp) { if (grp) h += "</optgroup>"; grp = o.group; h += '<optgroup label="' + esc(grp) + '">'; }
      h += '<option value="' + i + '">' + esc(o.label) + "</option>";
    });
    return h + (grp ? "</optgroup>" : "");
  }

  g.CMHProjects = { config: C, statusGlyph: function (c) { return { g: "✓", y: "…", r: "!" }[c]; }, esc: esc, norm: norm, num: num, iso: iso, link: link, ready: ready, where: where,
    soldOpen: soldOpen, pipelineFor: pipelineFor, listHtml: listHtml, overlayHtml: overlayHtml, options: options, optionsHtml: optionsHtml };
  if (typeof module !== "undefined") module.exports = g.CMHProjects;
})(typeof window !== "undefined" ? window : globalThis);

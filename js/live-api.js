/* LIVE DATA MODE — loaded ONLY when the page link carries `live=1` (js/live-core.js is loaded first).
   Intercepts fetch('/api/...') like js/practice-api.js, but answers from Firebase as the signed-in person (Google sign-in done on install-home.html or the CRM).
   Nothing changes for anyone unless a page is opened with live=1. The database rules decide what each person can read and write. */
(function (g) {
  "use strict";
  if (!g.fetch || g.__cmhLive || !g.CMHLiveCore) return;
  g.__cmhLive = true;
  var realFetch = g.fetch.bind(g), core = null, boot = null, V = "10.12.0", CDN = "https://www.gstatic.com/firebasejs/" + V + "/";
  var CONFIG = { apiKey: "AIzaSyAHnZ4r-WFQECx0XXqLuo8sqw6eoI1gEC0", authDomain: "install-availability-tracker.firebaseapp.com",
    databaseURL: "https://install-availability-tracker-default-rtdb.firebaseio.com", projectId: "install-availability-tracker", appId: "1:187871662912:web:1d52671de23c4f38d620a5" };
  function ensure() {
    if (core) return Promise.resolve(core);
    if (boot) return boot;
    boot = Promise.all([import(CDN + "firebase-app.js"), import(CDN + "firebase-database.js"), import(CDN + "firebase-auth.js")]).then(function (m) {
      var app = m[0].initializeApp(CONFIG), auth = m[2].getAuth(app), db = m[1].getDatabase(app);
      return new Promise(function (res) { var off = m[2].onAuthStateChanged(auth, function (u) { off(); res(u); }); }).then(function (u) {
        if (!u) throw new Error("not signed in");
        return u.getIdTokenResult().then(function (t) {
          if (!u.emailVerified || t.signInProvider !== "google.com" || !/@cmheating\.com$/i.test(u.email || "")) throw new Error("not signed in");
          var store = { email: u.email, get: function (p) { return m[1].get(m[1].ref(db, p)).then(function (s) { return s.val(); }); },
            update: function (up) { return m[1].update(m[1].ref(db), up); } };
          core = g.CMHLiveCore.create(store); return core;
        });
      });
    }).catch(function (e) { boot = null; throw e; });
    return boot;
  }
  g.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "", u;
    try { u = new URL(url, g.location.href); } catch (e) { return realFetch(input, init); }
    if (u.pathname.indexOf("/api/") < 0 || u.origin !== g.location.origin) return realFetch(input, init);
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase(), body = init && init.body ? String(init.body) : "";
    return ensure().then(function (c) { return c.handle(method, u.href, body); }, function () { return [401, { ok: false, error: "Sign in with Google on the Install tools page first." }]; })
      .then(function (r) { return new Response(JSON.stringify(r[1]), { status: r[0], headers: { "Content-Type": "application/json" } }); });
  };
})(typeof window !== "undefined" ? window : globalThis);

// Run locally (needs Java for the emulator):
//   npm install --no-save --package-lock=false @firebase/rules-unit-testing firebase
//   PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-install-req-rules.cjs'
// Expects database.rules.json = the ADDITIVE rules (live rules + rules/cmh_install_req.rules.fragment.json) built with rules/build-additive-rules.py.
// Every exploit sequence reported by the 2026-10-04 code audit is replayed here and must FAIL.
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let n = 0; const ok = async p => { n++; return assertSucceeds(p); }, no = async p => { n++; return assertFails(p); };
async function main() {
  const env = await initializeTestEnvironment({ projectId: 'demo-hca-rules', database: { rules: fs.readFileSync('database.rules.json', 'utf8') } });
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref('/').set({
      cmh_followup_roster: { hcas: { 'hca-one@cmheating,com': 'hca-one', 'hca-two@cmheating,com': 'hca-two' }, admins: { 'admin-one@cmheating,com': true } },
      cmh_install_roster: { managers: { 'mgr-install@cmheating,com': { install: true }, 'mgr-elec@cmheating,com': { electrical: true }, 'mgr-sales@cmheating,com': { sales: true } } },
      cmh_install_jobs: { 'hca-one': { j1: true, j2: true, j3: true } },
      cmh_install_req: { 'hca-one': {
        j1: { status: 'working', hca: { pay: 'x' } },
        j2: { status: 'in_review', hca: { pay: 'x', submittedAt: 't' } },
        j3: { status: 'in_review', hca: { pay: 'x', submittedAt: 't' }, lanes: { sales: { signoff: 'confirmed' }, install: { signoff: 'confirmed' }, electrical: { signoff: 'confirmed' } } } } }
    }));
    const g = (uid, email, provider = 'google.com', verified = true) => env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: provider } }).database();
    const hca1 = g('h1', 'hca-one@cmheating.com'), hca2 = g('h2', 'hca-two@cmheating.com');
    const hca1Pwd = g('h3', 'hca-one@cmheating.com', 'password', true), hca1Pin = g('h4', 'hca-one@cmheating.com', 'password', false);
    const mgrI = g('mi', 'mgr-install@cmheating.com'), mgrE = g('me', 'mgr-elec@cmheating.com'), mgrS = g('ms', 'mgr-sales@cmheating.com');
    const admin = g('ad', 'admin-one@cmheating.com'), stranger = g('st', 'someone-else@cmheating.com'), anon = env.unauthenticatedContext().database();
    const J = j => 'cmh_install_req/hca-one/' + j;

    // reads: owner, managers, admin only; never PIN/password sessions (even verified), another HCA, a stranger, anon
    for (const db of [hca1, mgrI, mgrE, admin]) await ok(db.ref(J('j1')).once('value'));
    for (const db of [hca1Pwd, hca1Pin, hca2, stranger, anon]) await no(db.ref(J('j1')).once('value'));
    await no(hca1.ref('cmh_install_req').once('value'));
    // HCA writes: own record while open, valid shape, indexed job only
    await ok(hca1.ref(J('j1/hca')).set({ pay: 'y' }));
    await ok(hca1.ref(J('j1/hca/items')).set({ photos: { v: 'no', why: 'Waiting on customer', when: '2026-10-06' } }));
    await no(hca1.ref(J('j1/hca')).set('invalid'));                                               // AUD-10
    await no(hca1.ref(J('j1/hca/items')).set({ photos: { v: 'maybe' } }));
    await no(hca1.ref(J('j1/hca/items')).set({ hacked: { v: 'yes' } }));
    await no(hca1.ref(J('j1/hca')).set({ pay: 'z'.repeat(500) }));
    await no(hca1.ref(J('j1/parked')).set({ unexpected: true }));                                  // AUD-10
    await ok(hca1.ref(J('j1/parked')).set({ reason: 'HOA approval', revisit: '2026-10-12' }));
    await no(hca1.ref('cmh_install_req/hca-one/j9/hca').set({ pay: 'y' }));                       // job not in the index
    await no(hca1Pwd.ref(J('j1/hca')).set({ pay: 'z' }));                                          // password session
    await no(hca2.ref(J('j1/hca')).set({ pay: 'z' }));
    await no(hca1.ref(J('j1/lanes/install')).set({ signoff: 'confirmed' }));
    // status: cannot submit without submittedAt, can submit with it, cannot roll back a reviewed job (AUD-02)
    await no(hca1.ref(J('j1/status')).set('submitted'));
    await ok(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted' }));
    await no(hca1.ref(J('j1/status')).set('ready'));
    await no(hca1.ref(J('j2/status')).set('working'));                                              // AUD-02 step 1
    await no(hca1.ref(J('j2/hca')).set({ pay: 'rewritten' }));                                      // AUD-02 step 2
    await no(hca1.ref(J('j3/status')).set('working'));

    // managers: own lane only, valid shape, cannot edit HCA answers
    const mi = { signoff: 'confirmed', by: 'mgr-install@cmheating.com', items: { 'mat-ok': { result: 'verified' }, 'layout-ok': { result: 'missing', found: 'no photos', when: '2026-10-07' } } };
    await ok(mgrI.ref(J('j1/lanes/install')).set(mi));
    await no(mgrI.ref(J('j1/lanes/install')).set({ ...mi, signoff: 'whatever' }));                  // AUD-10
    await no(mgrI.ref(J('j1/lanes/install/items')).set({ bogus: { result: 'verified' } }));
    await no(mgrI.ref(J('j1/lanes/install/items')).set({ 'layout-ok': { result: 'missing' } }));   // missing needs found + when
    await no(mgrI.ref(J('j1/lanes/electrical')).set({ signoff: 'confirmed', by: 'mgr-install@cmheating.com' }));
    await no(mgrI.ref(J('j1/hca')).set({ pay: 'hacked' }));
    await no(mgrI.ref(J('j1/lanes/install')).set({ ...mi, by: 'mgr-elec@cmheating.com' }));
    // status transitions (AUD-03): ready only after submission + all three lanes confirmed; no deletes; no skipping
    await no(mgrI.ref(J('j1/status')).set('ready'));                                                // not all lanes confirmed
    await no(mgrI.ref(J('j2/status')).set('ready'));                                                // in review, no lanes
    await no(mgrI.ref(J('j2/status')).set('installed'));
    await no(mgrI.ref(J('j2/status')).set('working'));
    await no(mgrI.ref(J('j3/status')).remove());
    await ok(mgrI.ref(J('j3/status')).set('ready'));
    await no(hca1.ref(J('j3/status')).set('working'));
    await ok(mgrI.ref(J('j3/status')).set('installed'));
    await no(mgrI.ref(J('j3/status')).set('in_review'));

    // history: append-only, signed, and only by the job's owner / managers / admin (AUD-09)
    const e = { at: '2026-01-01', by: 'mgr-install@cmheating.com', field: 'lane.install.signoff' };
    const r = await ok(mgrI.ref(J('j1/history')).push(e));
    await no(r.set(e));
    await no(mgrI.ref(J('j1/history')).push({ ...e, by: 'outsider@example.com' }));
    await no(mgrI.ref(J('j1/history')).push({ ...e, extra: 1 }));
    await no(stranger.ref(J('j1/history')).push({ ...e, by: 'someone-else@cmheating.com' }));      // AUD-09
    await no(hca2.ref(J('j1/history')).push({ ...e, by: 'hca-two@cmheating.com' }));
    await ok(hca1.ref(J('j1/history')).push({ ...e, by: 'hca-one@cmheating.com' }));
    await no(hca1.ref(J('j1/extra')).set(1));
    console.log('install-req rules checks passed (' + n + ' assertions)');
  } finally { await env.cleanup(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

// Run locally (needs Java for the emulator):
//   npm install --no-save --package-lock=false @firebase/rules-unit-testing firebase
//   PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-install-req-rules.cjs'
// Expects database.rules.json = the ADDITIVE rules (live rules + rules/cmh_install_req.rules.fragment.json) built with rules/build-additive-rules.py.
// Every exploit sequence reported by the 2026-10-04 code audit is replayed here and must FAIL.
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let n = 0; const ok = async p => { n++; return assertSucceeds(p); }, no = async p => { n++; return assertFails(p); };
const LANEKEYS = { sales: ['disc', 'rebate', 'ahri-ok', 'financing', 'slip', 'auths'], install: ['mat-ok', 'stock-ok', 'layout-ok', 'labor', 'sizing', 'permit-ok'], electrical: ['panel', 'disconnect', 'outlet', 'elabor'] };
const lanesFull = () => Object.fromEntries(Object.entries(LANEKEYS).map(([l, ks]) => [l, { signoff: 'confirmed', items: Object.fromEntries(ks.map(k => [k, { result: 'verified' }])) }]));
const HCAFULL = { pay: '\u2714 Paid in full', submittedAt: 't', items: { ...Object.fromEntries(['stock', 'permit', 'mat', 'photos', 'video', 'i-labor', 'e-labor'].map(k => [k, { v: 'yes' }])), rebate: { v: 'na' } } };
async function main() {
  const env = await initializeTestEnvironment({ projectId: 'demo-hca-rules', database: { rules: fs.readFileSync('database.rules.json', 'utf8') } });
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref('/').set({
      cmh_followup_roster: { hcas: { 'hca-one@cmheating,com': 'hca-one', 'hca-two@cmheating,com': 'hca-two' }, admins: { 'admin-one@cmheating,com': true } },
      cmh_install_roster: { managers: { 'mgr-install@cmheating,com': { install: true }, 'mgr-elec@cmheating,com': { electrical: true }, 'mgr-sales@cmheating,com': { sales: true }, 'adm-two@cmheating,com': { sales: true, install: true, electrical: true, admin: true } }, schedulers: { 'sched-one@cmheating,com': true }, hcas: { 'hca-one': 'HCA One' } },
      cmh_install_jobs: { 'hca-one': { j1: true, j2: true, j3: true, j3b: true, j4: true, j5: true, r1: true, r2: true, r3: true, r4: true, r5: true, r6: true, r7: true, r8: true, r9: true, r10: true } },
      cmh_install_req: { 'hca-one': {
        j1: { status: 'working', hca: { pay: 'x' } },
        j2: { status: 'in_review', hca: { pay: 'x', submittedAt: 't' } },
        j3b: { status: 'ready', hca: HCAFULL, lanes: lanesFull() },
        j3: { status: 'in_review', hca: HCAFULL, lanes: lanesFull() },
        j4: { status: 'in_review', hca: HCAFULL, lanes: { sales: lanesFull().sales, install: { signoff: 'confirmed', items: { ...lanesFull().install.items, 'stock-ok': { result: 'missing', found: 'x', when: '2026-12-01' } } }, electrical: lanesFull().electrical } },
        j5: { status: 'working', hca: { pay: 'x' } },
        r1: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'PSE', items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' }, 'rb-tc': { v: 'work' } } }, lanes: lanesFull() },
        r2: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'PSE', rebateAmount: '12', items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' }, 'rb-tc': { v: 'yes' } } }, lanes: lanesFull() },
        r3: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'Gensco', rebateAmount: '12', items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-equip': { v: 'yes' } } }, lanes: lanesFull() },
        r4: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'Gensco', items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-equip': { v: 'no' } } }, lanes: lanesFull() },
        r6: { status: 'in_review', hca: { ...HCAFULL, items: { ...HCAFULL.items, rebate: { v: 'work' } } }, lanes: lanesFull() },
        r7: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'Other', items: { ...HCAFULL.items, rebate: { v: 'yes' },'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' } } }, lanes: lanesFull() },
        r8: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'Other: Some Co-op', rebateAmount: '12', items: { ...HCAFULL.items, rebate: { v: 'yes' },'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' } } }, lanes: lanesFull() },
        r10: { status: 'in_review', hca: { ...HCAFULL, rebateProgram: 'PUD', items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' } } }, lanes: lanesFull() },
        r9: { status: 'in_review', hca: { ...HCAFULL, items: Object.fromEntries(Object.entries(HCAFULL.items).filter(([k]) => k !== 'rebate')) }, lanes: lanesFull() },
        r5: { status: 'in_review', hca: { ...HCAFULL, items: { ...HCAFULL.items, rebate: { v: 'yes' }, 'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' } } }, lanes: lanesFull() } } }
    }));
    const g = (uid, email, provider = 'google.com', verified = true) => env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: provider } }).database();
    const hca1 = g('h1', 'hca-one@cmheating.com'), hca2 = g('h2', 'hca-two@cmheating.com');
    const hca1Pwd = g('h3', 'hca-one@cmheating.com', 'password', true), hca1Pin = g('h4', 'hca-one@cmheating.com', 'password', false);
    const mgrI = g('mi', 'mgr-install@cmheating.com'), mgrE = g('me', 'mgr-elec@cmheating.com'), mgrS = g('ms', 'mgr-sales@cmheating.com');
    const adm2 = g('a2', 'adm-two@cmheating.com'), sched = g('sc', 'sched-one@cmheating.com'), schedPwd = g('sp', 'sched-one@cmheating.com', 'password', true);
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
    await no(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/pay': 'Select…' }));      // 2026-10-04: no empty submissions, even straight to the database
    await no(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/items': { photos: { v: 'yes' } } }));
    await no(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/pay': '\u2714 Paid in full', 'hca/items': Object.fromEntries(Object.entries(HCAFULL.items).filter(([k]) => k !== 'rebate')) }));   // rebate must be answered Yes or No
    await no(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/pay': '\u2714 Paid in full', 'hca/items': { ...HCAFULL.items, rebate: { v: 'yes' } } }));   // rebate yes needs a program
    await ok(hca1.ref(J('j1')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/pay': '\u2714 Paid in full', 'hca/items': HCAFULL.items }));
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
    // REBATE GATE (2026-10-04): rebate = yes needs the program and every one of its questions Complete before READY
    await no(adm2.ref(J('r1/status')).set('ready'));                                                // PSE, T&Cs still Working on it
    await ok(adm2.ref(J('r2/status')).set('ready'));                                                // PSE, all Complete
    await ok(adm2.ref(J('r3/status')).set('ready'));                                                // Gensco needs only balance point + equipment/model check (no AHRI, no T&Cs)
    await no(adm2.ref(J('r4/status')).set('ready'));                                                // Gensco equipment check Not done
    await no(adm2.ref(J('r5/status')).set('ready'));
    await no(adm2.ref(J('r6/status')).set('ready'));                                                // rebate answered "Working": only Yes / No count
    await no(adm2.ref(J('r7/status')).set('ready'));                                                // "Other" with no program name
    await ok(adm2.ref(J('r8/status')).set('ready'));                                                // "Other: <name>" with balance + AHRI Complete
    await no(adm2.ref(J('r10/status')).set('ready'));                                               // rebate yes, program + questions Complete, but no amount
    await no(adm2.ref(J('r9/status')).set('ready'));                                                // rebate never answered
    await no(hca1.ref(J('j5/hca/items/rebate')).set({ v: 'work' }));
    await ok(hca1.ref(J('j5/hca/system')).set('Mitsubishi Single Zone Ductless'));                  // the email lines (2026-10-05)
    await no(hca1.ref(J('j5/hca/scope')).set('x'.repeat(61)));
    await no(mgrI.ref(J('j5/hca/system')).set('manager cannot edit the HCA lines'));
    await no(hca1.ref(J('j5/hca/items/heatload')).set({ v: 'na' }));                                // N/A only where it is offered (2026-10-05)
    await no(hca1.ref(J('j5/hca/items/permit')).set({ v: 'na' }));
    await no(hca1.ref(J('j5/hca/items/i-labor')).set({ v: 'na' }));
    await ok(hca1.ref(J('j5/hca/items/ahri')).set({ v: 'na' }));
    await ok(hca1.ref(J('j5/hca/items/e-outlet')).set({ v: 'na' }));
    await ok(hca1.ref(J('j5/hca/items/r-dl')).set({ v: 'na' }));                                // the rebate row is Yes / No only
    await no(hca1.ref(J('j5')).update({ 'hca/submittedAt': 't', status: 'submitted', 'hca/pay': '\u2714 Paid in full', 'hca/rebateProgram': 'garbage', 'hca/items': { ...HCAFULL.items, rebate: { v: 'yes' } } }));                                                // rebate yes but no program chosen
    await no(adm2.ref(J('j4/status')).set('ready'));                                                // a lane item is still Missing: cannot be ready, even for an admin writing directly
    await no(mgrI.ref(J('j4/status')).set('ready'));
    await no(mgrI.ref(J('j3/status')).remove());
    await ok(mgrI.ref(J('j3/status')).set('ready'));
    await no(hca1.ref(J('j3/status')).set('working'));
    await no(mgrI.ref(J('j3/status')).set('installed'));                                            // 2026-10-04: marking installed is admin-only
    await no(sched.ref(J('j3/status')).set('installed'));
    await ok(adm2.ref(J('j3/status')).set('installed'));
    await no(mgrI.ref(J('j3/status')).set('in_review'));
    // roles (2026-10-04): schedulers read everything for booking but cannot write; admins send back and install; managers cannot send back
    await ok(sched.ref(J('j1')).once('value')); await no(schedPwd.ref(J('j1')).once('value')); await ok(sched.ref('cmh_install_jobs/hca-one').once('value'));
    await ok(sched.ref('cmh_install_roster/schedulers/sched-one@cmheating,com').once('value')); await no(sched.ref('cmh_install_roster/schedulers/sched-one@cmheating,com').set(null));
    await no(sched.ref('cmh_install_roster').once('value')); await no(hca1.ref('cmh_install_roster/schedulers').once('value')); await no(mgrI.ref('cmh_install_roster/schedulers/sched-one@cmheating,com').once('value'));
    await no(sched.ref(J('j2/status')).set('ready')); await no(sched.ref(J('j2/status')).set('working')); await no(sched.ref(J('j2/hca')).set({ pay: 'x' })); await no(sched.ref(J('j2/lanes/install/signoff')).set('confirmed'));
    await no(sched.ref(J('j2/reopen')).set({ by: 'sched-one@cmheating.com', reason: 'nope', at: 't' }));
    await no(mgrI.ref(J('j2/status')).set('working')); await no(mgrI.ref(J('j2/reopen')).set({ by: 'mgr-install@cmheating.com', reason: 'nope', at: 't' }));
    await ok(adm2.ref(J('j2/status')).set('working')); await ok(adm2.ref(J('j2/reopen')).set({ by: 'adm-two@cmheating.com', reason: 'Photos missing', at: 't' }));
    await no(adm2.ref(J('j2/reopen')).set({ by: 'someone@cmheating.com', reason: 'forged by', at: 't' })); await no(adm2.ref(J('j2/reopen')).set({ by: 'adm-two@cmheating.com', reason: 'x', at: 't' }));
    await no(hca1.ref(J('j2/reopen')).set({ by: 'hca-one@cmheating.com', reason: 'self send back', at: 't' }));
    await ok(mgrI.ref(J('j3b/status')).set('in_review')); // ready -> in review when a manager finds something missing (see seed j3b)
    await ok(sched.ref('cmh_install_roster/hcas').once('value')); await ok(mgrI.ref('cmh_install_roster/hcas').once('value')); await no(hca1.ref('cmh_install_roster/hcas').once('value')); await no(anon.ref('cmh_install_roster/hcas').once('value')); await no(mgrI.ref('cmh_install_roster/hcas/x').set('y'));
    await no(mgrI.ref(J('j5/lanes/install/items/labor')).set({ result: 'verified', by: 'x' }));          // lanes closed while the project is with the HCA
    await no(hca1.ref(J('j9x/history/h1')).set({ at: 't', by: 'hca-one@cmheating.com', field: 'installed' }));  // history only on real projects
    await ok(hca1.ref(J('j1/history/h1')).set({ at: 't', by: 'hca-one@cmheating.com', field: 'hca.stock' }));
    await no(admin.ref(J('j2/status')).set('working'));   // a followup-roster admin is NOT an install admin until given the flag in cmh_install_roster

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

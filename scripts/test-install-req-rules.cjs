// Run locally (needs Java for the emulator):
//   npm install --no-save --package-lock=false @firebase/rules-unit-testing firebase
//   firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-install-req-rules.cjs'
// Expects database.rules.json = codex/hca-crm-firebase-rules rules MERGED with rules/cmh_install_req.rules.fragment.json.
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
async function main() {
  const env = await initializeTestEnvironment({ projectId: 'demo-hca-rules', database: { rules: fs.readFileSync('database.rules.json', 'utf8') } });
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref('/').set({
      cmh_followup_roster: { hcas: { 'hca-one@cmheating,com': 'hca-one', 'hca-two@cmheating,com': 'hca-two' }, admins: { 'admin-one@cmheating,com': true } },
      cmh_install_roster: { managers: { 'mgr-install@cmheating,com': { install: true }, 'mgr-elec@cmheating,com': { electrical: true } } },
      cmh_install_req: { 'hca-one': { j1: { status: 'working', hca: { pay: 'x' } }, j2: { status: 'in_review', hca: { pay: 'x' } } } }
    }));
    const g = (uid, email, provider = 'google.com', verified = true) => env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: provider } }).database();
    const hca1 = g('s', 'hca-one@cmheating.com'), hca1Pin = g('s2', 'hca-one@cmheating.com', 'password', false), hca1PinVerified = g('s3', 'hca-one@cmheating.com', 'password', true);
    const hca2 = g('c', 'hca-two@cmheating.com'), mgrInstall = g('l', 'mgr-install@cmheating.com'), mgrElec = g('j', 'mgr-elec@cmheating.com'), adminOne = g('g', 'admin-one@cmheating.com');
    const anon = env.unauthenticatedContext().database();
    // read: owner, managers, admins; never PIN (even if its email were verified), never another HCA, never anon
    for (const db of [hca1, mgrInstall, mgrElec, adminOne]) await assertSucceeds(db.ref('cmh_install_req/hca-one/j1').once('value'));
    for (const db of [hca1Pin, hca1PinVerified, hca2, anon]) await assertFails(db.ref('cmh_install_req/hca-one/j1').once('value'));
    await assertFails(hca1.ref('cmh_install_req').once('value'));
    // HCA writes own hca/parked while open; not after review starts; not lanes
    await assertSucceeds(hca1.ref('cmh_install_req/hca-one/j1/hca').set({ pay: 'y' }));
    await assertFails(hca1.ref('cmh_install_req/hca-one/j2/hca').set({ pay: 'y' }));
    await assertFails(hca1Pin.ref('cmh_install_req/hca-one/j1/hca').set({ pay: 'z' }));
    await assertFails(hca2.ref('cmh_install_req/hca-one/j1/hca').set({ pay: 'z' }));
    await assertFails(hca1.ref('cmh_install_req/hca-one/j1/lanes/install').set({ signoff: 'confirmed' }));
    await assertSucceeds(hca1.ref('cmh_install_req/hca-one/j1/status').set('submitted'));
    await assertFails(hca1.ref('cmh_install_req/hca-one/j1/status').set('ready'));
    // managers write only their own lane; cannot edit the HCA's answers
    await assertSucceeds(mgrInstall.ref('cmh_install_req/hca-one/j1/lanes/install').set({ signoff: 'confirmed' }));
    await assertFails(mgrInstall.ref('cmh_install_req/hca-one/j1/lanes/electrical').set({ signoff: 'confirmed' }));
    await assertFails(mgrInstall.ref('cmh_install_req/hca-one/j1/hca').set({ pay: 'hacked' }));
    await assertSucceeds(mgrElec.ref('cmh_install_req/hca-one/j1/lanes/electrical').set({ signoff: 'confirmed' }));
    await assertSucceeds(mgrInstall.ref('cmh_install_req/hca-one/j1/status').set('in_review'));
    // history is append-only and signed by the writer
    const e = { at: '2026-01-01', by: 'mgr-install@cmheating.com', field: 'lane.install.signoff' };
    const r = await assertSucceeds(mgrInstall.ref('cmh_install_req/hca-one/j1/history').push(e));
    await assertFails(r.set(e));
    await assertFails(mgrInstall.ref('cmh_install_req/hca-one/j1/history').push({ ...e, by: 'outsider@example.com' }));
    // unknown child rejected
    await assertFails(hca1.ref('cmh_install_req/hca-one/j1/extra').set(1));
    console.log('install-req rules checks passed');
  } finally { await env.cleanup(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

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
      cmh_followup_roster: { hcas: { 'samir@cmheating,com': 'samir', 'chester@cmheating,com': 'chester' }, admins: { 'geoff@cmheating,com': true } },
      cmh_install_roster: { managers: { 'lyle@cmheating,com': { install: true }, 'jon@cmheating,com': { electrical: true } } },
      cmh_install_req: { samir: { j1: { status: 'working', hca: { pay: 'x' } }, j2: { status: 'in_review', hca: { pay: 'x' } } } }
    }));
    const g = (uid, email, provider = 'google.com', verified = true) => env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: provider } }).database();
    const samir = g('s', 'samir@cmheating.com'), samirPin = g('s2', 'samir@cmheating.com', 'password', false), samirPinVerified = g('s3', 'samir@cmheating.com', 'password', true);
    const chester = g('c', 'chester@cmheating.com'), lyle = g('l', 'lyle@cmheating.com'), jon = g('j', 'jon@cmheating.com'), geoff = g('g', 'geoff@cmheating.com');
    const anon = env.unauthenticatedContext().database();
    // read: owner, managers, admins; never PIN (even if its email were verified), never another HCA, never anon
    for (const db of [samir, lyle, jon, geoff]) await assertSucceeds(db.ref('cmh_install_req/samir/j1').once('value'));
    for (const db of [samirPin, samirPinVerified, chester, anon]) await assertFails(db.ref('cmh_install_req/samir/j1').once('value'));
    await assertFails(samir.ref('cmh_install_req').once('value'));
    // HCA writes own hca/parked while open; not after review starts; not lanes
    await assertSucceeds(samir.ref('cmh_install_req/samir/j1/hca').set({ pay: 'y' }));
    await assertFails(samir.ref('cmh_install_req/samir/j2/hca').set({ pay: 'y' }));
    await assertFails(samirPin.ref('cmh_install_req/samir/j1/hca').set({ pay: 'z' }));
    await assertFails(chester.ref('cmh_install_req/samir/j1/hca').set({ pay: 'z' }));
    await assertFails(samir.ref('cmh_install_req/samir/j1/lanes/install').set({ signoff: 'confirmed' }));
    await assertSucceeds(samir.ref('cmh_install_req/samir/j1/status').set('submitted'));
    await assertFails(samir.ref('cmh_install_req/samir/j1/status').set('ready'));
    // managers write only their own lane; cannot edit the HCA's answers
    await assertSucceeds(lyle.ref('cmh_install_req/samir/j1/lanes/install').set({ signoff: 'confirmed' }));
    await assertFails(lyle.ref('cmh_install_req/samir/j1/lanes/electrical').set({ signoff: 'confirmed' }));
    await assertFails(lyle.ref('cmh_install_req/samir/j1/hca').set({ pay: 'hacked' }));
    await assertSucceeds(jon.ref('cmh_install_req/samir/j1/lanes/electrical').set({ signoff: 'confirmed' }));
    await assertSucceeds(lyle.ref('cmh_install_req/samir/j1/status').set('in_review'));
    // history is append-only and signed by the writer
    const e = { at: '2026-01-01', by: 'lyle@cmheating.com', field: 'lane.install.signoff' };
    const r = await assertSucceeds(lyle.ref('cmh_install_req/samir/j1/history').push(e));
    await assertFails(r.set(e));
    await assertFails(lyle.ref('cmh_install_req/samir/j1/history').push({ ...e, by: 'someone@else.com' }));
    // unknown child rejected
    await assertFails(samir.ref('cmh_install_req/samir/j1/extra').set(1));
    console.log('install-req rules checks passed');
  } finally { await env.cleanup(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

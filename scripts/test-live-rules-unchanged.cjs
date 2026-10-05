// DIFFERENTIAL test: the deployable rules must behave EXACTLY like the live rules for everything that exists today
// (Install Availability page first of all). Same operations, same identities, two rule sets, outcomes must be identical.
//   LIVE_RULES=<private snapshot of the console rules>  NEW_RULES=<output of rules/build-additive-rules.py>
//   PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-live-rules-unchanged.cjs'
// No staff emails live in this file: identities are derived from the allowlists inside the live rules text at run time.
const fs = require('node:fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const liveText = fs.readFileSync(process.env.LIVE_RULES, 'utf8'), newText = fs.readFileSync(process.env.NEW_RULES, 'utf8');
const live = JSON.parse(liveText).rules;
const emails = s => [...String(s).matchAll(/auth\.token\.email == '([^']+)'/g)].map(m => m[1]);
const schedWrite = emails(live.cmh_schedule['.write']), availWrite = emails(live.cmh_availability['.write']), auditRead = emails(live.cmh_audit_logs['.read']);
const hcaOnly = availWrite.filter(e => !schedWrite.includes(e));              // may use the availability board, may not edit the schedule
if (!schedWrite.length || !hcaOnly.length) throw new Error('could not derive identities from the live rules');
const emailKey = e => e.toLowerCase().split('.').join(',');
const ok = async p => { try { await p; return 'allow'; } catch (e) { return 'deny'; } };
let compared = 0, diffs = [], controls = 0;

async function main() {
  const mk = async (id, text) => initializeTestEnvironment({ projectId: id, database: { rules: text } });
  const envLive = await mk('demo-live', liveText), envNew = await mk('demo-new', newText);
  try {
    const seed = {
      cmh_schedule: { week1: { row: 'x' } }, cmh_availability: { d1: { slot: 'x' } }, cmh_edit_locks: { k1: { by: 'x' } }, cmh_audit_logs: { old1: { at: 't' } },
      cmh_hca_activity: { n: { d: 1 } }, cmh_clearance: { u: 1 }, cmh_ar: { r: 1 }, cmh_sold_tracker: { jobs: [{ customer: 'Fixture' }] }, cmh_financing: { f: 1 }, cmh_install_checks: { c: 1 },
      cmh_followup_tracker: { leads: [] }, cmh_followup_roster: { hcas: { [emailKey(hcaOnly[0])]: 'hca-a' }, admins: { [emailKey(schedWrite[0])]: true } }, cmh_followup_log: { 'hca-a': { e1: { hcaKey: 'hca-a' } } } };
    for (const e of [envLive, envNew]) { await e.clearDatabase(); await e.withSecurityRulesDisabled(c => c.database().ref('/').set(seed)); }
    // identities: [name, email, verified, provider]  (PIN accounts are password + unverified; Google are verified)
    const ids = [['admin(PIN)', schedWrite[0], false, 'password'], ['admin(Google)', schedWrite[0], true, 'google.com'], ['hcaOnly(PIN)', hcaOnly[0], false, 'password'],
      ['hcaOnly(Google)', hcaOnly[0], true, 'google.com'], ['auditReader(PIN)', auditRead[auditRead.length - 1], false, 'password'],
      ['unlisted(PIN)', 'unlisted-person@cmheating.com', false, 'password'], ['unlisted(Google)', 'unlisted-person@cmheating.com', true, 'google.com'], ['outsider(Google)', 'outsider@example.com', true, 'google.com'], ['anon', null, false, null]];
    const ctxOf = (env, [n, email, ver, prov]) => email ? env.authenticatedContext('u-' + n, { email, email_verified: ver, firebase: { sign_in_provider: prov } }).database() : env.unauthenticatedContext().database();
    let stamp = 0;
    const ops = [   // [label, fn(db, tag)]
      ['read schedule', db => db.ref('cmh_schedule').once('value')], ['read availability', db => db.ref('cmh_availability').once('value')],
      ['read edit_locks', db => db.ref('cmh_edit_locks').once('value')], ['read audit_logs', db => db.ref('cmh_audit_logs').once('value')],
      ['read hca_activity', db => db.ref('cmh_hca_activity').once('value')], ['read clearance', db => db.ref('cmh_clearance').once('value')], ['read ar', db => db.ref('cmh_ar').once('value')],
      ['read sold_tracker', db => db.ref('cmh_sold_tracker').once('value')], ['read financing', db => db.ref('cmh_financing').once('value')], ['read install_checks', db => db.ref('cmh_install_checks').once('value')],
      ['read followup_tracker', db => db.ref('cmh_followup_tracker').once('value')], ['read followup_log', db => db.ref('cmh_followup_log/hca-a').once('value')],
      ['read own roster row', (db, t, c) => db.ref('cmh_followup_roster/hcas/' + emailKey(c[1] || 'x@x.x')).once('value')],
      ['write schedule', (db, t) => db.ref('cmh_schedule/w' + t).set({ r: 1 })], ['write availability', (db, t) => db.ref('cmh_availability/d' + t).set({ s: 1 })],
      ['update availability (multi-path)', (db, t) => db.ref('cmh_availability').update({ ['a' + t]: 1, ['b' + t]: 2 })],
      ['set edit lock', (db, t) => db.ref('cmh_edit_locks/k' + t).set({ by: 'x' })], ['remove edit lock', db => db.ref('cmh_edit_locks/k1').remove()],
      ['append audit entry', (db, t) => db.ref('cmh_audit_logs/new' + t).set({ at: 't' })], ['overwrite existing audit entry', db => db.ref('cmh_audit_logs/old1').set({ at: 'x' })],
      ['write sold_tracker', (db, t) => db.ref('cmh_sold_tracker/x' + t).set(1)], ['write financing', (db, t) => db.ref('cmh_financing/x' + t).set(1)], ['write install_checks', (db, t) => db.ref('cmh_install_checks/x' + t).set(1)],
      ['write followup_tracker', (db, t) => db.ref('cmh_followup_tracker/x' + t).set(1)], ['write hca_activity', (db, t) => db.ref('cmh_hca_activity/x' + t).set(1)],
      ['write clearance', (db, t) => db.ref('cmh_clearance/x' + t).set(1)], ['write ar', (db, t) => db.ref('cmh_ar/x' + t).set(1)],
      ['write at root', (db, t) => db.ref('/').update({ ['zz' + t]: 1 })], ['read unknown node', db => db.ref('cmh_unknown').once('value')], ['write unknown node', (db, t) => db.ref('cmh_unknown/x' + t).set(1)]];
    for (const id of ids) for (const [label, fn] of ops) {
      const t = ++stamp, a = await ok(fn(ctxOf(envLive, id), t, id)), b = await ok(fn(ctxOf(envNew, id), t, id));
      compared++; if (a !== b) diffs.push(`${id[0]} :: ${label}  live=${a} new=${b}`);
    }
    // controls: the Install Availability page's real operations must actually WORK under both (so this test cannot pass vacuously)
    const must = async (label, id, fn, expect) => { for (const env of [envLive, envNew]) { const r = await ok(fn(ctxOf(env, id))); controls++; if (r !== expect) diffs.push(`CONTROL ${label} (${id[0]}) expected ${expect} got ${r}`); } };
    const adm = ids[1], hca = ids[2], none = ids[5];
    await must('HCA reads availability', hca, db => db.ref('cmh_availability').once('value'), 'allow');
    await must('HCA books a slot', hca, db => db.ref('cmh_availability').update({ ctl1: 1 }), 'allow');
    await must('HCA takes an edit lock', hca, db => db.ref('cmh_edit_locks/ctl').set({ by: 'x' }), 'allow');
    await must('HCA writes an audit entry', hca, db => db.ref('cmh_audit_logs/ctlA').set({ at: 't' }), 'allow');
    await must('HCA cannot edit the schedule', hca, db => db.ref('cmh_schedule/ctl').set(1), 'deny');
    await must('HCA cannot read audit logs', hca, db => db.ref('cmh_audit_logs').once('value'), 'deny');
    await must('admin edits the schedule', adm, db => db.ref('cmh_schedule/ctl').set(1), 'allow');
    await must('unlisted user cannot read availability', none, db => db.ref('cmh_availability').once('value'), 'deny');
    await must('unlisted user cannot book', none, db => db.ref('cmh_availability').update({ ctl2: 1 }), 'deny');
    await must('audit entries cannot be overwritten', adm, db => db.ref('cmh_audit_logs/old1').set({ at: 'x' }), 'deny');
    if (diffs.length) { console.error('FAIL — rules behave differently from LIVE:\n  ' + diffs.join('\n  ')); process.exitCode = 1; }
    else console.log(`live-rules-unchanged: ${compared} operations x identities IDENTICAL under live and new rules; ${controls} Install Availability controls behave correctly`);
  } finally { await envLive.cleanup(); await envNew.cleanup(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

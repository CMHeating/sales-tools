// END-TO-END test of js/live-core.js against the Firebase emulator, with the ADDITIVE rules (live + rules/cmh_install_req.rules.fragment.json).
// Every call goes through the same code the pages will use and is judged by the real rules, as a different person each time. Fake identities only.
//   PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-live-core.cjs'
const fs = require('node:fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const Core = require(process.env.LIVE_CORE || '../js/live-core.js');
let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (!cond) { bad++; console.log('FAIL ' + label); } };
const d = k => { const t = new Date(); t.setDate(t.getDate() + k); return t.toISOString().slice(0, 10); };

async function main() {
  const env = await initializeTestEnvironment({ projectId: 'demo-hca-rules', database: { rules: fs.readFileSync('database.rules.json', 'utf8') } });
  try {
    await env.clearDatabase();
    const jobs = { 'hca-one': {
      j1: { job: 'j1', customer: 'Sample One', hca: 'HCA One', installDate: d(3), department: 'HVAC', stage: 'SOLD_ACTIVE' },
      j2: { job: 'j2', customer: 'Sample Two', hca: 'HCA One', installDate: d(5), department: 'HVAC', stage: 'SOLD_ACTIVE' },
      p1: { job: 'p1', customer: 'Sample Pipeline', hca: 'HCA One', source: 'pipeline', comboDate: '', comboTab: '' },
      q1: { job: 'q1', customer: 'Sample Rebate PSE', hca: 'HCA One', installDate: d(6), department: 'HVAC', stage: 'SOLD_ACTIVE' },
      q3: { job: 'q3', customer: 'Sample Open', hca: 'HCA One', installDate: d(8), department: 'HVAC', stage: 'SOLD_ACTIVE' },
      q2: { job: 'q2', customer: 'Sample Rebate Gensco', hca: 'HCA One', installDate: d(7), department: 'HVAC', stage: 'SOLD_ACTIVE' } },
      'hca-two': { k1: { job: 'k1', customer: 'Sample Other', hca: 'HCA Two', installDate: d(4), department: 'HVAC', stage: 'SOLD_ACTIVE' } } };
    await env.withSecurityRulesDisabled(ctx => ctx.database().ref('/').set({
      cmh_followup_roster: { hcas: { 'hca-one@cmheating,com': 'hca-one', 'hca-two@cmheating,com': 'hca-two' } },
      cmh_install_roster: {
        managers: { 'mgr-install@cmheating,com': { name: 'Mgr Install', install: true }, 'mgr-elec@cmheating,com': { name: 'Mgr Elec', electrical: true },
          'admin-one@cmheating,com': { name: 'Admin One', sales: true, install: true, electrical: true, admin: true } },
        config: { jurisdictionUrl: 'https://example.test/jurisdiction-sheet' }, schedulers: { 'sched-one@cmheating,com': true }, hcas: { 'hca-one': 'HCA One', 'hca-two': 'HCA Two' } },
      cmh_install_jobs: jobs }));
    const as = (uid, email, provider = 'google.com') => {
      const db = env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: provider } }).database();
      const store = { email, get: p => db.ref(p).once('value').then(s => s.val()), update: up => db.ref().update(up) };
      const api = Core.create(store);
      return { call: async (m, url, body) => { const r = await api.handle(m, url, body === undefined ? '' : JSON.stringify(body)); return { code: r[0], b: r[1] }; } };
    };
    const hca1 = as('h1', 'hca-one@cmheating.com'), hca2 = as('h2', 'hca-two@cmheating.com'), mI = as('mi', 'mgr-install@cmheating.com'), mE = as('me', 'mgr-elec@cmheating.com');
    const adm = as('ad', 'admin-one@cmheating.com'), sch = as('sc', 'sched-one@cmheating.com'), nobody = as('no', 'nobody@cmheating.com');
    const pw = as('pw', 'hca-one@cmheating.com', 'password');
    const full = { pay: '✔ Paid in full', items: { stock: { v: 'yes' }, mat: { v: 'yes' }, photos: { v: 'yes' }, video: { v: 'yes' }, 'i-labor': { v: 'yes' }, rebate: { v: 'na' }, cc: { v: 'na' } } };
    const allVerified = lane => Object.fromEntries({ sales: ['disc', 'rebate', 'ahri-ok', 'financing', 'slip', 'auths'], install: ['mat-ok', 'stock-ok', 'layout-ok', 'labor', 'sizing', 'permit-ok'], electrical: ['panel', 'disconnect', 'outlet', 'elabor'] }[lane].map(k => [k, { result: 'verified' }]));
    let r;

    // --- who sees what ---
    r = await hca1.call('GET', '/api/jobs'); ok('HCA lists only their own projects (5 sold + 1 pipeline)', r.code === 200 && r.b.jobs.length === 5 && r.b.pipeline.length === 1);
    r = await hca1.call('GET', '/api/record?job=k1'); ok("HCA cannot open another HCA's project (same 404 as a job that does not exist)", r.code === 404);
    r = await hca1.call('GET', '/api/record?job=zzz'); ok('unknown job is the same 404', r.code === 404);
    r = await hca1.call('GET', '/api/admin'); ok('HCA cannot use the admin list', r.code === 403);
    r = await hca1.call('GET', '/api/queue'); ok('HCA sees an empty review queue (only their own, none submitted)', r.code === 200 && r.b.jobs.length === 0);
    r = await nobody.call('GET', '/api/jobs'); ok('someone on no roster gets nothing (403)', r.code === 403);
    r = await pw.call('GET', '/api/jobs'); ok('password session on an HCA email gets nothing (rules refuse, never a stale success)', r.code !== 200 || (r.b.jobs || []).length === 0);

    // --- HCA fills and submits ---
    r = await hca1.call('POST', '/api/hca', { job: 'j1', submit: true }); ok('empty submit refused with what is still needed', r.code === 400 && /still needed/.test(r.b.error));
    r = await hca1.call('POST', '/api/hca', { job: 'j1', pay: full.pay, items: full.items }); ok('HCA saves answers (status working)', r.code === 200 && r.b.record.status === 'working' && r.b.record.readiness.done === 6);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', items: { bogus: { v: 'yes' } } }); ok('unknown item refused', r.code === 400);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', items: { stock: { v: 'no' } } }); ok('Not done is stored', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', submit: true }); ok('submit blocked while a Not-done has no why/when', r.code === 400);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', items: { stock: { v: 'yes' } } }); ok('fixed again', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', parked: { reason: 'HOA approval', revisit: d(4) } }); ok('park saved', r.code === 200 && r.b.record.parked && r.b.record.parked.reason === 'HOA approval');
    r = await hca1.call('POST', '/api/hca', { job: 'k1', pay: 'x' }); ok("HCA cannot write another HCA's project (404)", r.code === 404);
    r = await hca2.call('POST', '/api/hca', { job: 'j1', pay: 'x' }); ok("second HCA cannot write the first one's project (404)", r.code === 404);
    r = await mI.call('POST', '/api/hca', { job: 'j1', pay: 'x' }); ok('a manager cannot edit the HCA answers', r.code === 403);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', submit: true }); ok('submit works', r.code === 200 && r.b.record.status === 'submitted' && !r.b.record.parked);

    // --- managers verify; ready needs all three lanes ---
    r = await mI.call('GET', '/api/queue'); ok('manager sees the submitted project in the queue', r.b.jobs.some(j => j.job === 'j1' && j.status === 'submitted'));
    r = await sch.call('GET', '/api/record?job=j1'); ok('scheduler can read the project', r.code === 200);
    r = await sch.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'mat-ok': { result: 'verified' } } }); ok('scheduler cannot verify', r.code === 403);
    r = await mE.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'mat-ok': { result: 'verified' } } }); ok("a manager cannot verify another manager's lane", r.code === 403);
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'stock-ok': { result: 'missing' } } }); ok('Missing without found + date refused', r.code === 400);
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'stock-ok': { result: 'missing', found: 'Not in stock', when: d(2) } } }); ok('Missing with details saved; status in review', r.code === 200 && r.b.record.status === 'in_review');
    r = await hca1.call('POST', '/api/hca', { job: 'j1', pay: 'x' }); ok('HCA locked while in review (409)', r.code === 409);
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: allVerified('install'), signoff: 'confirmed' }); ok('install lane confirmed', r.code === 200 && r.b.record.status === 'in_review');
    r = await mE.call('POST', '/api/lane', { job: 'j1', lane: 'electrical', items: allVerified('electrical'), signoff: 'confirmed' }); ok('electrical lane confirmed; still not ready', r.code === 200 && r.b.record.status === 'in_review');
    r = await adm.call('POST', '/api/lane', { job: 'j1', lane: 'sales', items: allVerified('sales'), signoff: 'confirmed' }); ok('admin confirms the sales lane -> READY', r.code === 200 && r.b.record.status === 'ready');
    r = await sch.call('GET', '/api/ready'); ok('scheduler sees it on Ready to book', r.b.jobs.some(j => j.job === 'j1'));
    r = await hca2.call('GET', '/api/ready'); ok("other HCA's Ready list does not include it", !r.b.jobs.some(j => j.job === 'j1'));
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'stock-ok': { result: 'missing', found: 'Pallet short', when: d(3) } } }); ok('READY -> IN REVIEW when a manager finds something missing (rules allow it)', r.code === 200 && r.b.record.status === 'in_review');
    r = await sch.call('GET', '/api/ready'); ok('no longer on Ready to book', !r.b.jobs.some(j => j.job === 'j1'));
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'stock-ok': { result: 'verified' } } }); ok('restored to Verified -> READY again', r.code === 200 && r.b.record.status === 'ready');

    // --- admin: send back, HCA fixes and resubmits, install ---
    r = await mI.call('POST', '/api/reopen', { job: 'j1', reason: 'nope nope' }); ok('manager cannot send back', r.code === 403);
    r = await sch.call('POST', '/api/install', { job: 'j1' }); ok('scheduler cannot mark installed', r.code === 403);
    r = await adm.call('POST', '/api/reopen', { job: 'j1', reason: ' ' }); ok('send back needs a reason', r.code === 400);
    r = await adm.call('POST', '/api/reopen', { job: 'j1', reason: 'Photos need redoing' }); ok('admin sends it back: status working, note stored', r.code === 200 && r.b.record.status === 'working' && r.b.record.reopen.reason === 'Photos need redoing');
    r = await hca1.call('GET', '/api/record?job=j1'); ok('HCA sees the send-back note and lane sign-offs are cleared', r.b.record.reopen && r.b.record.lanesSummary.install.signoff === '' && r.b.record.lanesSummary.sales.signoff === '');
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { 'labor': { result: 'verified' } } }); ok('managers cannot verify while it is with the HCA (409)', r.code === 409);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', items: { photos: { v: 'yes', note: 'redone' } } }); ok('HCA edits again', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'j1', submit: true }); ok('HCA resubmits; the old note is no longer shown', r.code === 200 && r.b.record.status !== 'working' && !r.b.record.reopen);
    r = await adm.call('POST', '/api/install', { job: 'j1' }); ok('cannot mark installed before it is ready again (409)', r.code === 409);
    for (const [who, lane] of [[mI, 'install'], [mE, 'electrical'], [adm, 'sales']]) await who.call('POST', '/api/lane', { job: 'j1', lane, items: allVerified(lane), signoff: 'confirmed' });
    r = await adm.call('GET', '/api/record?job=j1'); ok('ready again after re-verification', r.b.record.status === 'ready');
    r = await adm.call('POST', '/api/install', { job: 'j1' }); ok('admin marks installed', r.code === 200 && r.b.record.status === 'installed');
    r = await mI.call('POST', '/api/lane', { job: 'j1', lane: 'install', items: { labor: { result: 'verified' } } }); ok('installed projects are closed (409)', r.code === 409);


    // --- verifier findings (2026-10-04): concurrent saves, stuck jobs, stale status ---
    const raw = async p => { let v; await env.withSecurityRulesDisabled(async c => { v = (await c.database().ref(p).once('value')).val(); }); return v; };
    r = await hca1.call('POST', '/api/hca', Object.assign({ job: 'j2' }, full)); r = await hca1.call('POST', '/api/hca', { job: 'j2', submit: true }); ok('j2 submitted', r.code === 200);
    await adm.call('POST', '/api/lane', { job: 'j2', lane: 'sales', items: allVerified('sales'), signoff: 'confirmed' });
    const both = await Promise.all([mI.call('POST', '/api/lane', { job: 'j2', lane: 'install', items: allVerified('install'), signoff: 'confirmed' }), mE.call('POST', '/api/lane', { job: 'j2', lane: 'electrical', items: allVerified('electrical'), signoff: 'confirmed' })]);
    ok('two managers confirm the last lanes at the same moment: both succeed', both.every(x => x.code === 200));
    ok('the STORED status ends as ready (never stuck on in_review while the page says ready)', (await raw('cmh_install_req/hca-one/j2/status')) === 'ready');
    r = await adm.call('POST', '/api/install', { job: 'j2' }); ok('Mark installed works after the concurrent saves', r.code === 200 && r.b.record.status === 'installed');
    r = await hca1.call('POST', '/api/hca', Object.assign({ job: 'p1' }, full)); r = await hca1.call('POST', '/api/hca', { job: 'p1', submit: true }); ok('p1 submitted', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'p1', items: { stock: { v: 'no' } } }); ok('HCA edits a submitted project into an incomplete state (Not done, no reason): it returns to the HCA', r.code === 200 && r.b.record.status === 'working' && (await raw('cmh_install_req/hca-one/p1/status')) === 'working');
    r = await mI.call('POST', '/api/lane', { job: 'p1', lane: 'install', items: allVerified('install'), signoff: 'confirmed' }); ok('managers cannot start reviewing it while it is with the HCA (409)', r.code === 409);
    r = await hca1.call('POST', '/api/hca', { job: 'p1', items: { stock: { v: 'yes' } } }); r = await hca1.call('POST', '/api/hca', { job: 'p1', submit: true }); ok('HCA completes it and resubmits', r.code === 200 && r.b.record.status === 'submitted');
    await adm.call('POST', '/api/reopen', { job: 'p1', reason: 'Recheck photos' }); r = await hca1.call('GET', '/api/record?job=p1'); ok('send-back note shown while with the HCA', r.b.record.reopen && r.b.record.reopen.reason === 'Recheck photos');
    r = await hca1.call('POST', '/api/hca', { job: 'p1', submit: true }); r = await hca1.call('GET', '/api/record?job=p1'); ok('resubmitted: the old note is gone (no clock comparison)', !r.b.record.reopen);

    // --- rebate gate (2026-10-04): through the real code AND the real rules ---
    const withReb = (prog, subs) => Object.assign({}, full, { rebateProgram: prog, items: Object.assign({}, full.items, { rebate: { v: 'yes' } }, subs) });
    r = await hca1.call('POST', '/api/hca', Object.assign({ job: 'q1' }, withReb('PSE', { 'rb-balance': { v: 'yes' }, 'rb-ahri': { v: 'yes' }, 'rb-tc': { v: 'work' } }))); ok('PSE with T&Cs still Working on it saves', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'q1', submit: true }); ok('...and can still be submitted (gate blocks booking, not submitting)', r.code === 200 && r.b.record.status === 'submitted');
    for (const [who, lane] of [[mI, 'install'], [mE, 'electrical'], [adm, 'sales']]) await who.call('POST', '/api/lane', { job: 'q1', lane, items: allVerified(lane), signoff: 'confirmed' });
    r = await adm.call('GET', '/api/record?job=q1'); ok('all lanes confirmed but the rebate gate is not passed => NOT ready', r.b.record.status === 'in_review' && (await raw('cmh_install_req/hca-one/q1/status')) === 'in_review');
    r = await adm.call('GET', '/api/admin'); ok('admin sees "rebate not secured"', r.b.jobs.find(j => j.job === 'q1').openItems.some(o => o.item === 'rebate' && o.state === 'not secured'));
    r = await sch.call('GET', '/api/ready'); ok('not on Ready to book', !r.b.jobs.some(j => j.job === 'q1'));
    r = await adm.call('POST', '/api/install', { job: 'q1' }); ok('cannot be marked installed', r.code === 409);
    await adm.call('POST', '/api/reopen', { job: 'q1', reason: 'Finish the rebate T and Cs' });
    r = await hca1.call('POST', '/api/hca', { job: 'q1', items: { 'rb-tc': { v: 'yes' } } }); r = await hca1.call('POST', '/api/hca', { job: 'q1', submit: true }); ok('HCA completes the T&Cs and resubmits', r.code === 200);
    for (const [who, lane] of [[mI, 'install'], [mE, 'electrical'], [adm, 'sales']]) await who.call('POST', '/api/lane', { job: 'q1', lane, items: allVerified(lane), signoff: 'confirmed' });
    r = await adm.call('GET', '/api/record?job=q1'); ok('rebate gate passed => READY (stored and shown)', r.b.record.status === 'ready' && (await raw('cmh_install_req/hca-one/q1/status')) === 'ready');
    r = await hca1.call('POST', '/api/hca', Object.assign({ job: 'q2' }, withReb('Gensco', { 'rb-balance': { v: 'yes' } }))); r = await hca1.call('POST', '/api/hca', { job: 'q2', submit: true }); ok('Gensco (balance point only) submits', r.code === 200);
    for (const [who, lane] of [[mI, 'install'], [mE, 'electrical'], [adm, 'sales']]) await who.call('POST', '/api/lane', { job: 'q2', lane, items: allVerified(lane), signoff: 'confirmed' });
    r = await adm.call('GET', '/api/record?job=q2'); ok('Gensco with the balance point Complete => READY', r.b.record.status === 'ready' && (await raw('cmh_install_req/hca-one/q2/status')) === 'ready');
    r = await hca1.call('POST', '/api/hca', { job: 'q3', system: 'Sample System', vendor: 'Sample Vendor', filterSize: '16x25x1' }); ok('email lines (what was sold, vendor, filter size) are stored on the record', r.code === 200 && r.b.record.hca.system === 'Sample System' && r.b.record.hca.vendor === 'Sample Vendor' && r.b.record.hca.filterSize === '16x25x1');
    r = await hca1.call('GET', '/api/config'); ok('the jurisdiction sheet link comes from the private config', r.code === 200 && r.b.jurisdictionUrl === 'https://example.test/jurisdiction-sheet');
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { claim: { v: 'yes' } } }); ok('claim your spot (Yes) is stored but never counted or required', r.code === 200 && r.b.record.hca.items.claim.v === 'yes' && r.b.record.readiness.total === 8);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { downpay: { v: 'no' } } }); ok('down payment collected accepts No and is never counted', r.code === 200 && r.b.record.readiness.total === 8);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { 'rb-applied': { v: 'work' } } }); ok('rebate applied only accepts Yes or No', r.code === 400);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { claim: { v: 'work' } } }); ok('claim only accepts Yes or No', r.code === 400);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { heatload: { v: 'na' } } }); ok('N/A is refused on Heat load (not offered)', r.code === 400);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { ahri: { v: 'na' } } }); ok('N/A still accepted on AHRI', r.code === 200);
    r = await hca1.call('POST', '/api/hca', { job: 'q3', items: { rebate: { v: 'work' } } }); ok('the rebate row only accepts Yes or No', r.code === 400);
    r = await hca1.call('GET', '/api/jobs'); 
    r = await hca1.call('POST', '/api/hca', { job: 'q2', rebateProgram: 'x'.repeat(100) }); ok('over-long program text refused', r.code !== 200);
    // --- admin view and history ---
    r = await adm.call('GET', '/api/admin'); ok('admin list covers every HCA, sold + pipeline', r.code === 200 && r.b.jobs.length === 7 && r.b.jobs.some(j => j.job === 'k1') && r.b.jobs.some(j => j.job === 'p1' && j.source === 'pipeline'));
    r = await adm.call('GET', '/api/record?job=j1'); ok('history is complete and signed with the person', r.b.record.history.length > 10 && r.b.record.history.every(h => /@cmheating\.com$/.test(h.by)));
    r = await mI.call('GET', '/api/admin'); ok('manager cannot use the admin list', r.code === 403);
    r = await adm.call('POST', '/api/reset', {}); ok('no reset endpoint in live mode', r.code === 404);
    r = await adm.call('POST', '/api/hca', 'x'.repeat(70000)); ok('oversized body refused', r.code === 413);
  } finally { await env.cleanup(); }
  console.log(`live-core end-to-end: ${n - bad}/${n} checks passed`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

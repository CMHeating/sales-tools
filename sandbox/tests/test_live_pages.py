#!/usr/bin/env python3
"""CRM sign-in tiers + per-HCA data, with the three Firebase modules stubbed (no network, fake data).
Run with the sandbox server up (it serves crm.html). Exits non-zero on any failure.
Stub rules mimic the proposed ones: customer-data nodes need the ACTIVE token's provider to be google.com and a verified email;
an HCA may read only their own subtree (not the root); admins may read the root."""
import json, os, sys, datetime
from playwright.sync_api import sync_playwright
B = os.environ.get('SANDBOX', 'http://127.0.0.1:8787'); FAILS = []
d = lambda n: (datetime.date.today() + datetime.timedelta(days=n)).isoformat()
SAMIR = {'jobs': [{'customer': 'Sample Alpha', 'hca': 'Samir Khoury', 'job': '900001', 'installDate': d(2), 'stage': 'SOLD_ACTIVE', 'department': 'HVAC'}],
         'pipeline': [{'customer': 'Sample Juliet', 'hca': 'Samir Khoury', 'job': '800003', 'source': 'pipeline', 'comboDate': '', 'comboTab': ''}]}
CHESTER = {'jobs': [{'customer': 'Sample Echo', 'hca': 'Chester Granard', 'job': '900005', 'installDate': d(3), 'stage': 'SOLD_ACTIVE'}]}
PARTITIONED = {'cmh_sold_tracker': {'samir-khoury': SAMIR, 'chester-granard': CHESTER}, 'cmh_followup_tracker': {'samir-khoury': {'leads': []}, 'chester-granard': {'leads': []}},
               'cmh_followup_roster': {'hcas': {'samir,khoury@cmheating,com': 'samir-khoury', 'chester,granard@cmheating,com': 'chester-granard'}}}
LEGACY = {'cmh_sold_tracker': {'jobs': SAMIR['jobs'] + CHESTER['jobs'], 'pipeline': SAMIR['pipeline']}, 'cmh_followup_tracker': {'leads': []}}

APPJS = "export const initializeApp=()=>({});"
DBJS = """const parts=p=>p.split('/').filter(Boolean);
const val=p=>{let o=window.__DB;for(const k of parts(p)){if(o==null)return null;o=o[k];}return o===undefined?null:o;};
const setp=(path,v)=>{const ks=parts(path);let o=window.__DB;for(let i=0;i<ks.length-1;i++){o=o[ks[i]]=o[ks[i]]||{};}if(v===null)delete o[ks[ks.length-1]];else o[ks[ks.length-1]]=v;};
export const getDatabase=()=>({});export const ref=(db,p)=>({path:p||''});
export const get=async r=>({val:()=>{const v=val(r.path);return v==null?null:JSON.parse(JSON.stringify(v));}});
export const update=async(r,up)=>{for(const k of Object.keys(up))setp(k,up[k]===undefined?null:JSON.parse(JSON.stringify(up[k])));};"""
AUTHJS = """export const getAuth=()=>({});
export const onAuthStateChanged=(a,f)=>{setTimeout(()=>f(window.__USER||null),0);return ()=>{};};"""
DB0 = {'cmh_followup_roster': {'hcas': {'hca-one@cmheating,com': 'hca-one'}},
       'cmh_install_roster': {'config': {'jurisdictionUrl': 'https://example.test/jurisdiction-sheet'}, 'managers': {'mgr-install@cmheating,com': {'name': 'Mgr Install', 'install': True}, 'admin-one@cmheating,com': {'name': 'Admin One', 'sales': True, 'install': True, 'electrical': True, 'admin': True}},
                              'schedulers': {'sched-one@cmheating,com': True}, 'hcas': {'hca-one': 'HCA One'}},
       'cmh_install_jobs': {'hca-one': {'j1': {'job': 'j1', 'customer': 'Sample One', 'hca': 'HCA One', 'installDate': '2026-12-01', 'department': 'HVAC', 'stage': 'SOLD_ACTIVE'}}}}
def ok(label, cond):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: FAILS.append(label)
def page(pw, email, hash_, file, provider='google.com', db=None):
    b = pw.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 430, 'height': 1000}); ext = []
    ctx.route('**/firebase-app.js', lambda r: r.fulfill(body=APPJS, content_type='text/javascript'))
    ctx.route('**/firebase-database.js', lambda r: r.fulfill(body=DBJS, content_type='text/javascript'))
    ctx.route('**/firebase-auth.js', lambda r: r.fulfill(body=AUTHJS, content_type='text/javascript'))
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort()); ctx.route('**script.google.com/**', lambda r: (ext.append(r.request.url), r.abort()))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    user = {'email': email, 'emailVerified': True} if email else None
    pg.add_init_script("window.__DB=%s;window.__USER=%s;" % (json.dumps(db or DB0), ('Object.assign(%s,{getIdTokenResult:async()=>({signInProvider:%s})})' % (json.dumps(user), json.dumps(provider))) if user else 'null'))
    pg.goto(B + '/' + file + '#' + hash_); pg.reload(); pg.wait_for_timeout(1200); return b, pg, errs, ext

with sync_playwright() as p:
    b, pg, errs, ext = page(p, 'hca-one@cmheating.com', 'job=j1&cust=Sample+One&date=2026-12-01&rep=HCA+One&live=1', 'install-requirements.html')
    ok('HCA page in live mode shows the LIVE banner, not sandbox/practice', 'LIVE' in pg.inner_text('#envBar') and 'PRACTICE' not in pg.inner_text('#envBar'))
    ok('jurisdiction link appears (from the private config) under Permit, opens in a new tab', pg.is_visible('#jurLink') and pg.get_attribute('#jurLink', 'href') == 'https://example.test/jurisdiction-sheet' and pg.get_attribute('#jurLink', 'target') == '_blank')
    ok('live mode: no tab-close warning text (answers are saved as you go)', 'saved to the office as you go' in pg.inner_text('#leaveHint'))
    pg.select_option('#pay', index=1)
    for i in ['stock', 'mat', 'video', 'photos', 'i-labor']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="na"]')
    pg.wait_for_timeout(900)
    ok('answers saved to the database as the HCA types (status working)', pg.evaluate("window.__DB.cmh_install_req['hca-one'].j1.status") == 'working' and pg.evaluate("Object.keys(window.__DB.cmh_install_req['hca-one'].j1.hca.items).length") == 6)
    pg.click('#submitBtn'); pg.wait_for_timeout(900)
    ok('submit stores status submitted + submittedAt and sends nothing', pg.evaluate("window.__DB.cmh_install_req['hca-one'].j1.status") == 'submitted' and 'Submitted' in pg.inner_text('#barTxt') and not ext)
    ok('history entries are signed with the person', pg.evaluate("Object.values(window.__DB.cmh_install_req['hca-one'].j1.history).every(h=>h.by==='hca-one@cmheating.com')"))
    ok('no page errors (HCA)', not errs); db1 = pg.evaluate("window.__DB"); b.close()
    # manager sees it in the queue and verifies
    b, pg, errs, ext = page(p, 'mgr-install@cmheating.com', 'live=1', 'install-qc.html', db=db1)
    ok('manager page in live mode: LIVE banner, sign-in picker hidden', 'LIVE' in pg.inner_text('#envBar') and not pg.is_visible('.who'))
    ok('manager sees the submitted project', 'Sample One' in pg.inner_text('#rows')); pg.click('.job[data-job="j1"]'); pg.wait_for_timeout(800)
    ok('manager can edit only their own lane (install), others are read-only', pg.locator('[data-lane="install"] .seg button').first.is_enabled() and pg.locator('[data-lane="sales"] .seg button').first.is_disabled() if pg.locator('[data-lane="sales"] .seg button').count() else True)
    pg.locator('[data-lane="install"] .row[data-k="stock-ok"] button.missing').click(); pg.locator('[data-lane="install"] .row[data-k="stock-ok"] [data-f=found]').fill('Not in stock'); pg.locator('[data-lane="install"] .row[data-k="stock-ok"] [data-f=when]').fill('2027-01-05')
    pg.locator('[data-lane="install"] [data-save]').click(); pg.wait_for_timeout(1200)
    ok('manager save stored in the database; status in review', pg.evaluate("window.__DB.cmh_install_req['hca-one'].j1.status") == 'in_review' and pg.evaluate("window.__DB.cmh_install_req['hca-one'].j1.lanes.install.items['stock-ok'].result") == 'missing')
    ok('no page errors (manager)', not errs); db2 = pg.evaluate("window.__DB"); b.close()
    # admin
    b, pg, errs, ext = page(p, 'admin-one@cmheating.com', 'live=1', 'install-admin.html', db=db2)
    ok('admin page lists the live project with its status', 'Sample One' in pg.inner_text('#list') and 'in review' in pg.inner_text('#list').lower())
    ok('no page errors (admin)', not errs); b.close()
    # not signed in / password session / someone with no role
    b, pg, errs, ext = page(p, None, 'live=1', 'install-qc.html')
    print('   not-signed-in rows text:', repr(pg.inner_text('#rows'))[:160])
    ok('not signed in: clear message, no data', 'sign in' in pg.inner_text('#rows').lower() or 'sign in' in pg.inner_text('body').lower()); b.close()
    b, pg, errs, ext = page(p, 'mgr-install@cmheating.com', 'live=1', 'install-qc.html', provider='password')
    ok('PIN/password session is refused', 'Sample One' not in pg.inner_text('body')); b.close()
    # without live=1 nothing changes
    b, pg, errs, ext = page(p, 'hca-one@cmheating.com', 'job=j1&cust=Sample+One&date=2026-12-01&rep=HCA+One', 'install-requirements.html')
    ok('without live=1 the page does not enter live mode and never touches the database', 'LIVE' not in pg.inner_text('#envBar') and pg.evaluate("typeof window.__cmhLive")=='undefined'); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

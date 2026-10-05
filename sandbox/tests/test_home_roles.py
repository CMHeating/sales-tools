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
APP = "export const initializeApp=()=>({});"
DBM = """const val=(p)=>{let o=window.__DB||{};for(const k of p.split('/')){if(o==null)return null;o=o[k];}return o===undefined?null:o;};
const denied=(p)=>{const parts=p.split('/');const guarded=['cmh_sold_tracker','cmh_followup_tracker'].includes(parts[0]);if(!guarded)return false;
 const u=window.__USER;if(!u||!u.emailVerified||window.__PROVIDER!=='google.com')return true;
 if(parts.length===1)return !window.__ADMIN;   // root read: admins only
 return false;};
export const getDatabase=()=>({});export const ref=(db,path)=>({path});
export const onValue=(r,cb,err)=>{if(denied(r.path)){err&&setTimeout(()=>err(new Error('PERMISSION_DENIED')),0);return ()=>{};}setTimeout(()=>cb({val:()=>val(r.path),forEach:()=>{}}),0);return ()=>{};};
export const get=async(r)=>({val:()=>val(r.path)});"""
AUTH = """let cb=null;
const mk=(email,provider,linked)=>({email,emailVerified:provider==='google.com',providerData:linked.map(p=>({providerId:p})),getIdTokenResult:async()=>({signInProvider:provider})});
export const getAuth=()=>({get currentUser(){return window.__USER||null}});
export const onAuthStateChanged=(a,f)=>{cb=f;setTimeout(()=>f(window.__USER||null),0);return ()=>{};};
export const signOut=async()=>{window.__USER=null;cb&&cb(null);};
export const signInWithEmailAndPassword=async()=>{};
export class GoogleAuthProvider{setCustomParameters(){}}
export const signInWithPopup=async()=>{window.__PROVIDER='google.com';window.__USER=mk(window.__EMAIL,'google.com',['google.com']);cb&&await cb(window.__USER);};
export const signInWithRedirect=async()=>{};"""

def ok(label, cond):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: FAILS.append(label)

ROSTER = {'cmh_install_roster': {'managers': {'lyle@cmheating,com': {'install': True, 'name': 'Lyle'}, 'boss@cmheating,com': {'sales': True, 'install': True, 'electrical': True, 'admin': True, 'name': 'Geoff'}},
                                 'schedulers': {'amy@cmheating,com': True}},
          'cmh_followup_roster': {'hcas': {'rep@cmheating,com': 'rep-one'}}}
def visit(pw, email, provider='google.com'):
    b = pw.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 430, 'height': 900})
    ctx.route('**/firebase-app.js', lambda r: r.fulfill(body=APP, content_type='text/javascript'))
    ctx.route('**/firebase-database.js', lambda r: r.fulfill(body=DBM, content_type='text/javascript'))
    ctx.route('**/firebase-auth.js', lambda r: r.fulfill(body=AUTH, content_type='text/javascript'))
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(f"window.__DB={json.dumps(ROSTER)};window.__ADMIN=false;"
        f"window.__USER={{email:{json.dumps(email)},emailVerified:{json.dumps(provider=='google.com')},providerData:[],getIdTokenResult:async()=>({{signInProvider:{json.dumps(provider)}}})}};")
    pg.goto(B + '/install-home.html'); pg.wait_for_timeout(900)
    return b, pg, errs, [a.inner_text() for a in pg.locator('#btns a').all()], pg.inner_text('#roleLine') if pg.is_visible('#tools') else ''

with sync_playwright() as p:
    b, pg, errs, btns, role = visit(p, 'rep@cmheating.com')
    ok('HCA sees only the CRM link (no manager, scheduler or admin buttons)', len(btns) == 1 and 'CRM' in btns[0] and 'Sales rep' in role); ok('no errors (HCA)', not errs); b.close()
    b, pg, errs, btns, role = visit(p, 'lyle@cmheating.com')
    ok('manager sees Review queue only, with their name', btns == ['Review queue'] and 'as=Lyle' in pg.get_attribute('#btns a', 'href') and 'Manager' in role); b.close()
    b, pg, errs, btns, role = visit(p, 'amy@cmheating.com')
    ok('scheduler sees Ready to book only', btns == ['Ready to book'] and 'view=ready' in pg.get_attribute('#btns a', 'href') and 'Scheduler' in role); b.close()
    b, pg, errs, btns, role = visit(p, 'boss@cmheating.com')
    ok('admin sees Admin page, Review queue and Ready to book', btns == ['Admin page', 'Review queue', 'Ready to book'] and 'Admin' in role); b.close()
    b, pg, errs, btns, role = visit(p, 'nobody@cmheating.com')
    ok('someone not on any roster gets no tools and a clear message', not btns and not pg.is_visible('#tools') and 'isn\'t set up' in pg.inner_text('#msg')); b.close()
    b, pg, errs, btns, role = visit(p, 'lyle@cmheating.com', provider='password')
    ok('PIN/password session is refused (Google only)', not btns and not pg.is_visible('#tools')); b.close()
    b, pg, errs, btns, role = visit(p, 'lyle@gmail.com')
    ok('non-company Google account is refused', not btns and not pg.is_visible('#tools')); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

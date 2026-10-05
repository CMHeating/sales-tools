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

def run(pw, email, provider, db, linked=None, admin=False):
    b = pw.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 430, 'height': 1200})
    ctx.route('**/firebase-app.js', lambda r: r.fulfill(body=APP, content_type='text/javascript'))
    ctx.route('**/firebase-database.js', lambda r: r.fulfill(body=DBM, content_type='text/javascript'))
    ctx.route('**/firebase-auth.js', lambda r: r.fulfill(body=AUTH, content_type='text/javascript'))
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort()); ctx.route('**script.google.com/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    linked = linked or [provider]
    pg.add_init_script(f"window.__DB={json.dumps(db)};window.__EMAIL={json.dumps(email)};window.__PROVIDER={json.dumps(provider)};window.__ADMIN={json.dumps(admin)};"
        f"window.__USER={{email:{json.dumps(email)},emailVerified:{json.dumps(provider=='google.com')},providerData:{json.dumps([{'providerId':p} for p in linked])},getIdTokenResult:async()=>({{signInProvider:{json.dumps(provider)}}})}};")
    pg.goto(B + '/crm.html'); pg.wait_for_timeout(1300); return b, pg, errs

with sync_playwright() as p:
    # Samir on a PIN (password) session
    b, pg, errs = run(p, 'samir.khoury@cmheating.com', 'password', PARTITIONED)
    t = lambda sel: pg.inner_text(sel).lower()
    ok('PIN: badge says customer info locked', 'pin' in t('#statusBadge'))
    ok('PIN: sold, follow-up and project cards show the Google prompt', all('sign in with google' in t(s) for s in ('#soldBody', '#followupBody', '#projList')))
    ok('PIN: project dropdown empty and completion button greyed out', pg.get_attribute('#actCompleteLink', 'aria-disabled') == 'true' and pg.is_disabled('#projPick'))
    pg.click('#soldBody [data-gsign]'); pg.wait_for_timeout(1200)
    ok('Google sign-in: badge says Google', 'google' in t('#statusBadge'))
    ok('PARTITIONED data: the HCA reads their own subtree (root read would be denied)', pg.inner_text('#soldBody').replace('\n', ' ').startswith('1'))
    ok('PARTITIONED data: own project + backlog/pipeline listed, not another HCA\'s', 'sample alpha' in t('#projList') and 'sample juliet' in t('#projList') and 'sample echo' not in t('#projList'))
    ok('status dots carry text alternatives', pg.evaluate("document.querySelectorAll('#projList .proj-dot[aria-label]').length") >= 2)
    ok('button greyed until a project is chosen, then carries the job', pg.get_attribute('#actCompleteLink', 'aria-disabled') == 'true')
    pg.select_option('#projPick', index=1); ok('choosing a sold project enables it with that job', pg.get_attribute('#actCompleteLink', 'aria-disabled') is None and 'job=900001' in pg.get_attribute('#actCompleteLink', 'href'))
    pg.select_option('#projPick', index=2); ok('pipeline project carries its job number', 'job=800003' in pg.get_attribute('#actCompleteLink', 'href'))
    pg.click('#schedWeekBtn'); pg.wait_for_timeout(300)
    ok('schedule overlay present', 'your installs' in t('#schedBody') or 'backlog' in t('#schedBody'))
    ok('no page errors', not errs); print('errors', errs[:3]); b.close()
    # AUD-11: a PASSWORD session on an account that is ALSO linked to Google must still be treated as PIN
    b, pg, errs = run(p, 'samir.khoury@cmheating.com', 'password', PARTITIONED, linked=['password', 'google.com'])
    ok('AUD-11 linked Google provider but password sign-in -> still locked', 'sign in with google' in pg.inner_text('#soldBody').lower() and 'pin' in pg.inner_text('#statusBadge').lower()); b.close()
    # legacy root layout (before the sync is partitioned): HCA root read is denied, so the page must say so, not show data
    b, pg, errs = run(p, 'samir.khoury@cmheating.com', 'google.com', LEGACY)
    ok('LEGACY root layout under new rules: no data leak to a non-admin (root read denied)', 'unavailable' in pg.inner_text('#soldBody').lower() or 'no sold jobs' in pg.inner_text('#soldBody').lower()); b.close()
    # legacy layout when the viewer may read the root (admin) still works: fallback path
    b, pg, errs = run(p, 'geoffrey.simons@cmheating.com', 'google.com', LEGACY, admin=True)
    pg.select_option('#viewAs', 'samir.khoury@cmheating.com'); pg.wait_for_timeout(1000)
    ok('admin viewing Samir on the legacy layout falls back to the root and shows his jobs', 'sample alpha' in pg.inner_text('#projList').lower()); b.close()
    # non-pilot HCA
    b, pg, errs = run(p, 'chester.granard@cmheating.com', 'google.com', PARTITIONED)
    ok('non-pilot HCA: list, dropdown and link hidden', not pg.is_visible('#projList') and not pg.is_visible('#projPick') and not pg.is_visible('#actCompleteLink'))
    ok('non-pilot HCA: own sold card works as before', pg.inner_text('#soldBody').replace('\n', ' ').startswith('1')); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

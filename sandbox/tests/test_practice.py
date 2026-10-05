#!/usr/bin/env python3
"""PRACTICE site test: the pages are served from the repo files but under the REAL public origin
(https://cmheating.github.io/sales-tools/ — mapped by Playwright, no network), so the hostname check, practice flag and
in-browser API (js/practice-api.js) behave exactly as they will for a tester. Exits non-zero on any failure."""
import json, mimetypes, os, sys, datetime
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIGIN = 'https://cmheating.github.io/sales-tools/'; FAILS = []; EXTERNAL = []
d = lambda n: (datetime.date.today() + datetime.timedelta(days=n)).isoformat()

def ok(label, cond):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: FAILS.append(label)

def handler(route):
    url = route.request.url
    if url.startswith(ORIGIN):
        rel = url[len(ORIGIN):].split('#')[0].split('?')[0] or 'index.html'
        path = os.path.join(ROOT, rel)
        if os.path.isdir(path): path = os.path.join(path, 'index.html')
        if os.path.exists(path):
            return route.fulfill(body=open(path, 'rb').read(), content_type=mimetypes.guess_type(path)[0] or 'text/plain')
        return route.fulfill(status=404, body='not found')
    if 'fonts.googleapis.com' in url or 'fonts.gstatic.com' in url: return route.abort()
    EXTERNAL.append(url); return route.abort()

with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.route('**/*', handler); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: b===null?undefined:(typeof b==='string'?b:JSON.stringify(b))}); return [r.status, await r.json()]; }""", [method, path, body])
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(800)
    ok('practice start page banner', 'practice' in pg.inner_text('#env').lower())
    links = pg.locator('#jobs a.btn'); ok('Samir sees 8 practice projects (4 sold + 4 backlog/pipeline), not other HCAs\'', links.count() == 8 and 'Echo' not in pg.inner_text('#jobs'))
    ok('every project link carries practice=1', all('practice=1' in (links.nth(i).get_attribute('href') or '') for i in range(links.count())))
    # --- API parity with the sandbox server ---
    api('POST', '/api/reset', {})
    c, r = api('GET', '/api/record?job=800001'); ok('pipeline project has a record', c == 200 and r['ok'])
    c, r = api('POST', '/api/hca', {'job': '800001', 'by': 'T', 'pay': '✔ Paid in full', 'items': {'stock': {'v': 'yes'}}}); ok('pipeline answers can be saved', c == 200)
    c, r = api('POST', '/api/hca', {'job': '900001', 'by': 'T', 'submit': True}); ok('empty submission refused', c == 400 and 'still needed' in r['error'])
    c, r = api('POST', '/api/hca', {'job': '900001', 'items': {'bogus': {'v': 'yes'}}}); ok('unknown item refused', c == 400)
    c, r = api('POST', '/api/hca', {'job': '900001', 'items': ['x']}); ok('items list refused (no crash)', c == 400)
    c, r = api('POST', '/api/lane', {'job': '900001', 'lane': 'install', 'items': {'mat-ok': None}}); ok('null lane item refused', c == 400)
    c, r = api('POST', '/api/hca', 'x' * 70000); ok('oversized body -> 413', c == 413)
    c, r = api('POST', '/api/hca', '{bad'); ok('bad json -> 400', c == 400)
    c, r = api('POST', '/api/lane', {'job': '900001', 'by': 'Lyle', 'lane': 'install', 'items': {'mat-ok': {'result': 'missing'}}}); ok('missing without found + when refused', c == 400)
    # --- UI flow in practice mode ---
    api('POST', '/api/reset', {}); pg.evaluate("localStorage.removeItem('cmh_practice_req_900001')")
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(600)
    pg.locator('#jobs a.btn', has_text='Sample Alpha').click(); pg.wait_for_timeout(900)
    ok('completion page opens in practice mode', 'PRACTICE' in pg.inner_text('#envBar') and pg.evaluate("PRACTICE===true && SANDBOX_RE.test(location.hostname)===false"))
    ok('Back link returns to the practice home', pg.get_attribute('.topbar .back', 'href') == 'practice/index.html')
    pg.select_option('#pay', index=1)
    for i, v in [('stock', 'yes'), ('permit', 'yes'), ('heatload', 'yes'), ('ahri', 'yes'), ('mat', 'yes'), ('video', 'yes'), ('photos', 'no')]: pg.click(f'button[data-id="{i}"][data-v="{v}"]')
    ok('submit blocked until the Not-done item has why + by-when', pg.is_disabled('#submitBtn'))
    pg.select_option('#why-photos select', 'Waiting on customer'); pg.fill('#why-photos input[type=date]', d(1)); pg.wait_for_timeout(500)
    pg.reload(); pg.wait_for_timeout(800); ok('answers survive a reload (saved in this browser)', pg.inner_text('#ringN').replace('\n', ' ') == '7 of 8')
    pg.click('#submitBtn'); pg.wait_for_timeout(600)
    c, r = api('GET', '/api/record?job=900001'); ok('submit -> submitted, nothing emailed', r['record']['status'] == 'submitted' and api('GET', '/api/outbox')[1]['mail'][0]['note'] == 'PRACTICE: not sent')
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); pg.locator('a.btn', has_text='Manager review').click(); pg.wait_for_timeout(800)
    ok('manager screen opens in practice mode and lists the submission', 'PRACTICE' in pg.inner_text('#envBar') and 'Sample Alpha' in pg.inner_text('#rows'))
    pg.select_option('#me', 'Lyle'); pg.click('[data-job="900001"]'); pg.wait_for_timeout(500)
    for k in ['mat-ok', 'stock-ok', 'labor', 'sizing', 'permit-ok', 'layout-ok']: pg.click(f'[data-lane=install] [data-k="{k}"] button.verified')
    pg.select_option('[data-lane=install] [data-so]', 'confirmed'); pg.click('[data-lane=install] [data-save]'); pg.wait_for_timeout(900)
    ok('a lane touched -> in review', api('GET', '/api/record?job=900001')[1]['record']['status'] == 'in_review')
    for lane, who in [('sales', 'Geoff'), ('electrical', 'Jon')]:
        its = json.loads(pg.evaluate("JSON.stringify(META.lanes['%s'].items)" % lane))
        c, r = api('POST', '/api/lane', {'job': '900001', 'by': who, 'lane': lane, 'items': {k: {'result': 'verified'} for k in its}, 'signoff': 'confirmed'})
    c, r = api('POST', '/api/lane', {'job': '900001', 'by': 'Lyle', 'lane': 'install', 'items': {'layout-ok': {'result': 'verified'}}, 'signoff': 'confirmed'})
    ok('all lanes confirmed -> ready', api('GET', '/api/record?job=900001')[1]['record']['status'] == 'ready' and any(j['job'] == '900001' for j in api('GET', '/api/ready')[1]['jobs']))
    # --- home cards ---
    pg.goto(ORIGIN + 'practice/hca-home.html'); pg.wait_for_timeout(700)
    ok('home cards: projects + backlog listed, links keep practice=1', 'sample alpha' in pg.inner_text('#projList').lower() and 'practice=1' in (pg.locator('#projList a').first.get_attribute('href') or ''))
    pg.select_option('#projPick', index=1); ok('home cards: choosing a project enables the button', pg.get_attribute('#actCompleteLink', 'aria-disabled') is None and 'practice=1' in pg.get_attribute('#actCompleteLink', 'href'))
    # --- reset ---
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); pg.click('#reset'); pg.wait_for_timeout(500)
    ok('reset puts the practice data back', api('GET', '/api/record?job=900001')[1]['record']['status'] == 'working')
    # --- real (non-practice) use of the same page is untouched ---
    p2 = ctx.new_page(); p2.goto(ORIGIN + 'install-requirements.html#job=123456&cust=Real+Name&date=2030-01-01&rep=Somebody'); p2.wait_for_timeout(800)
    ok('without practice=1 the page is in DEMO mode (no practice API, nothing stored in the practice db)', 'DEMO' in p2.inner_text('#envBar') and p2.evaluate("typeof window.__cmhPractice")  == 'undefined')
    ok('practice drafts use their own storage key', pg.evaluate("Object.keys(localStorage).filter(k=>k.indexOf('cmh_install_req_')===0).length") == 0)
    ok('NOTHING left the browser: no request to Apps Script, Firebase or anything but the site itself', not EXTERNAL)
    if EXTERNAL: print('   external:', EXTERNAL[:3])
    ok('no page errors', not errs); print('errors', errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

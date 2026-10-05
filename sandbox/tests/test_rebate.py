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



URL = ORIGIN + 'install-requirements.html#job=900001&cust=Sample+Alpha&date=%s&rep=Samir+Khoury&practice=1' % d(5)
BASE6 = ['stock', 'permit', 'mat', 'video', 'photos']
def lanes_all(api, job):
    for lane, ks in {'sales': ['disc', 'rebate', 'ahri-ok', 'financing', 'slip', 'auths'], 'install': ['mat-ok', 'stock-ok', 'layout-ok', 'labor', 'sizing', 'permit-ok'], 'electrical': ['panel', 'disconnect', 'outlet', 'elabor']}.items():
        api('POST', '/api/lane', {'job': job, 'by': 'X', 'lane': lane, 'items': {k: {'result': 'verified'} for k in ks}, 'signoff': 'confirmed'})
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 900})
    ctx.route('**/*', handler); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {})
    pg.goto(URL); pg.reload(); pg.wait_for_timeout(800)
    vis = lambda i: pg.is_visible(f'#row-{i}')
    ok('Rebate row asks Yes / No on every job; nothing else shows yet', pg.is_visible('#row-rebate') and pg.locator('button[data-id="rebate"]').count() == 2 and not pg.is_visible('#rebProgBox') and not vis('rb-balance'))
    pg.select_option('#pay', index=1)
    for i in BASE6: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    ok('rebate unanswered blocks Submit (one tap per job)', pg.is_disabled('#submitBtn') and 'Rebate' in pg.inner_text('#barTxt'))
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.wait_for_timeout(200)
    ok('Yes opens the program picker in place (no pop-up); Submit still blocked until a program is chosen', pg.is_visible('#rebProgBox') and not vis('rb-balance') and pg.is_disabled('#submitBtn'))
    shown = lambda: [i for i in ['rb-balance', 'rb-ahri', 'rb-tc', 'rb-equip'] if vis(i)]
    pg.select_option('#rebProg', 'PSE'); pg.wait_for_timeout(150); ok('PSE asks balance point, AHRI certificate and T&Cs', shown() == ['rb-balance', 'rb-ahri', 'rb-tc'])
    pg.select_option('#rebProg', 'PUD'); pg.wait_for_timeout(150); ok('PUD asks balance point and AHRI certificate (no T&Cs)', shown() == ['rb-balance', 'rb-ahri'])
    pg.select_option('#rebProg', 'Gensco'); pg.wait_for_timeout(150); ok('Gensco asks balance point and the equipment/model-number check (no AHRI, no T&Cs)', shown() == ['rb-balance', 'rb-equip'])
    pg.select_option('#rebProg', 'Other'); pg.wait_for_timeout(150); ok('Other shows a name box and asks balance point + AHRI certificate', pg.is_visible('#rebOther') and shown() == ['rb-balance', 'rb-ahri'] and pg.is_disabled('#submitBtn'))
    pg.fill('#rebOther', 'Some Co-op'); pg.select_option('#rebProg', 'PSE'); pg.wait_for_timeout(150)
    ok('footer lists the unanswered rebate questions', 'Balance point' in pg.inner_text('#barTxt') or 'Rebate' in pg.inner_text('#barTxt'))
    for i in ['rb-balance', 'rb-ahri', 'rb-tc']: pg.click(f'button[data-id="{i}"][data-v="work"]')
    pg.wait_for_timeout(300)
    ok('Working on it = rebate gate NOT passed: note says so, Submit is allowed (option 1)', 'not secured' in pg.inner_text('#rebNote').lower() and not pg.is_disabled('#submitBtn'))
    ok('open rebate questions appear in Needs you', 'Balance point' in pg.inner_text('#needs'))
    pg.click('button[data-id="rb-tc"][data-v="no"]'); pg.wait_for_timeout(200)
    ok('Not done needs why + date before Submit', pg.is_disabled('#submitBtn'))
    pg.click('button[data-id="rb-tc"][data-v="yes"]')
    pg.click('#submitBtn'); pg.wait_for_timeout(800)
    r = api('GET', '/api/record?job=900001')[1]['record']
    ok('submitted with rebate questions still open; program stored', r['status'] == 'submitted' and r['hca']['rebateProgram'] == 'PSE')
    lanes_all(api, '900001')
    r = api('GET', '/api/record?job=900001')[1]['record']; ok('all lanes verified + confirmed but rebate gate not passed => NOT ready (in review)', r['status'] == 'in_review')
    adm = api('GET', '/api/admin')[1]['jobs']; row = [x for x in adm if x['job'] == '900001'][0]
    ok('admin sees "rebate not secured" as an open item', any(o['item'] == 'rebate' and o['state'] == 'not secured' for o in row['openItems']))
    # full pass => ready
    api('POST', '/api/reset', {})
    pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in BASE6: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'Gensco')
    for i in ['rb-balance', 'rb-equip']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.wait_for_timeout(300); ok('Gensco all Complete: gate passed', 'requirements met' in pg.inner_text('#rebNote').lower())
    pg.click('#submitBtn'); pg.wait_for_timeout(800); lanes_all(api, '900001')
    ok('rebate gate passed + lanes confirmed => READY', api('GET', '/api/record?job=900001')[1]['record']['status'] == 'ready')
    # No rebate => nothing extra
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in BASE6: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="na"]'); pg.wait_for_timeout(200)
    ok('No rebate: nothing else required, Submit works, ring is 6 of 12', not pg.is_disabled('#submitBtn') and not pg.is_visible('#rebProgBox') and pg.inner_text('#ringN').replace('\n', ' ') == '6 of 12')
    # manager page shows what the HCA said about the rebate
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in BASE6: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'PUD')
    for i in ['rb-balance', 'rb-ahri']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('#submitBtn'); pg.wait_for_timeout(800)
    q = ctx.new_page(); q.goto(ORIGIN + 'install-qc.html#practice=1&as=Geoff'); q.reload(); q.wait_for_timeout(900); q.click('.job[data-job="900001"]'); q.wait_for_timeout(800)
    said = q.inner_text('[data-lane="sales"] .row[data-k="rebate"] .said')
    ok('sales lane shows the HCA rebate answers (program and only the questions that apply)', 'PUD' in said and 'Balance point' in said and 'AHRI certificate' in said and 'Terms' not in said)
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

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



full = {'pay': '✔ Financed — approved & sales slip signed', 'items': dict({k: {'v': 'yes'} for k in ['stock', 'heatload', 'ahri', 'mat', 'photos', 'video', 'i-labor']}, rebate={'v': 'na'})}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1100, 'height': 800})
    ctx.route('**/*', handler); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {})
    meta = api('GET', '/api/meta')[1]
    api('POST', '/api/hca', dict({'job': '900002', 'by': 'Samir Khoury'}, **full)); api('POST', '/api/hca', {'job': '900002', 'by': 'Samir Khoury', 'submit': True})
    who = {'sales': 'Geoff', 'install': 'Lyle', 'electrical': 'Jon'}
    for lane, ln in meta['lanes'].items():
        api('POST', '/api/lane', {'job': '900002', 'by': who[lane], 'lane': lane, 'items': {k: {'result': 'verified'} for k in ln['items']}, 'signoff': 'confirmed'})
    ok('setup: Bravo is ready', api('GET', '/api/record?job=900002')[1]['record']['status'] == 'ready')
    # #4 header follows saves in both directions
    pg.goto(ORIGIN + 'install-qc.html?practice=1&as=Lyle'); pg.wait_for_timeout(900); pg.click('#tabR'); pg.wait_for_timeout(500); pg.click('.job[data-job="900002"]'); pg.wait_for_timeout(700)
    hdr = lambda: pg.inner_text('#detail .st').strip().lower()
    ok('Bravo detail header starts READY', hdr() == 'ready')
    lane = pg.locator('[data-lane="install"]'); lane.locator('.row[data-k="stock-ok"] button.missing').click()
    lane.locator('[data-save]').click(); pg.wait_for_timeout(300)
    ok('blank details still rejected on Missing', 'needs' in lane.locator('[data-msg]').inner_text().lower() or 'found' in lane.locator('[data-msg]').inner_text().lower() or 'what' in lane.locator('[data-msg]').inner_text().lower())
    lane.locator('.row[data-k="stock-ok"] [data-f=found]').fill('Not in stock'); lane.locator('.row[data-k="stock-ok"] [data-f=when]').fill(d(2)); lane.locator('[data-save]').click(); pg.wait_for_timeout(1500)
    ok('header moves to IN REVIEW without reopening (got %r)' % hdr(), hdr() == 'in review' and api('GET', '/api/record?job=900002')[1]['record']['status'] == 'in_review')
    lane = pg.locator('[data-lane="install"]'); lane.locator('.row[data-k="stock-ok"] button.verified').click(); lane.locator('[data-save]').click(); pg.wait_for_timeout(1500)
    ok('header returns to READY after restoring Verified (got %r)' % hdr(), hdr() == 'ready')
    # #5 role text follows the selector
    pg.click('#backBtn'); pg.wait_for_timeout(300)
    pg.goto(ORIGIN + 'install-qc.html?practice=1&as=Amy'); pg.wait_for_timeout(900)
    ok('Amy sees scheduler text', 'Scheduler view' in pg.inner_text('#roleNote'))
    pg.select_option('#me', 'Lyle'); pg.wait_for_timeout(400)
    ok('switching to Lyle updates the helper text without navigating (got %r)' % pg.inner_text('#roleNote'), 'Scheduler' not in pg.inner_text('#roleNote') and 'verify' in pg.inner_text('#roleNote').lower())
    pg.select_option('#me', 'Brittny'); pg.wait_for_timeout(400)
    ok('switching back to a scheduler restores scheduler text', 'Scheduler view' in pg.inner_text('#roleNote'))
    pg.goto(ORIGIN + 'install-qc.html?practice=1&as=Lyle'); pg.wait_for_timeout(700)
    ok('manager page has a way back (practice home)', pg.is_visible('#homeBack') and 'practice/index.html' in pg.get_attribute('#homeBack', 'href'))
    pg.goto(ORIGIN + 'install-admin.html#practice=1'); pg.wait_for_timeout(700); pg.reload(); pg.wait_for_timeout(700)
    ok('admin page has a way back (practice home)', pg.is_visible('#homeBack') and 'practice/index.html' in pg.get_attribute('#homeBack', 'href'))
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

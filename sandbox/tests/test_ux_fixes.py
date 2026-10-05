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
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.route('**/*', handler); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {})
    pg.goto(URL); pg.reload(); pg.wait_for_timeout(900)
    # F4: partial (6 of 8, Heat load / AHRI unanswered) -- messages must agree
    pg.select_option('#pay', index=1)
    for i in ['stock', 'permit', 'mat', 'video', 'photos']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.wait_for_timeout(300)
    ok('F4 partial: Submit enabled (Heat load/AHRI stay optional)', not pg.is_disabled('#submitBtn'))
    ok('F4 partial: banner is not "Needs you" when only optional items are open', 'Needs you' not in pg.inner_text('#needs') and 'Optional' in pg.inner_text('#needs'))
    ok('F4 partial: footer says ready + optional count', 'Ready to submit' in pg.inner_text('#barTxt') and 'optional open' in pg.inner_text('#barTxt'))
    pg.click('#submitBtn'); pg.wait_for_timeout(600)
    ok('F4 submitted: header, banner, footer agree', 'Submitted' in pg.inner_text('#barTxt') and 'Submitted' in pg.inner_text('#needs') and pg.is_disabled('#submitBtn'))
    api('POST', '/api/reopen', {'job': '900001', 'by': 'Amy', 'reason': 'Photos missing'}); pg.reload(); pg.wait_for_timeout(900)
    ok('F4 reopened: not "Submitted"; Submit enabled again and footer says so', 'Submitted' not in pg.inner_text('#barTxt') and not pg.is_disabled('#submitBtn') and 'Sent back by Amy' in pg.inner_text('#needs'))
    # F3: Save & exit closes after success, keeps data, no duplicate
    pg.click('#parkBtn'); pg.select_option('#parkReason', index=1); pg.fill('#parkDate', d(3)); pg.dblclick('#parkSave'); pg.wait_for_timeout(700)
    ok('F3 Save & exit closes the modal after success', not pg.locator('#parkModal.on').count())
    ok('F3 footer confirms parked, answers kept', 'Parked' in pg.inner_text('#barTxt') and pg.inner_text('#ringN').startswith('6'))
    c, r = api('GET', '/api/record?job=900001'); ok('F3 parked stored once on the record', r['record'].get('parked') is not None)
    # F2: landscape modal inside the viewport
    pg.set_viewport_size({'width': 844, 'height': 390}); pg.click('#parkBtn'); pg.wait_for_timeout(300)
    box = pg.evaluate("(()=>{const h=document.getElementById('parkH').getBoundingClientRect(),s=document.getElementById('parkSave').getBoundingClientRect(),sh=document.querySelector('.sheet').getBoundingClientRect();return {h:h.top,s:s.bottom,sh:sh.height,vh:innerHeight}})()")
    ok('F2 landscape: sheet fits viewport, Save reachable (%s)' % box, box['sh'] <= box['vh'] + 1 and box['s'] <= box['vh'] + 1)
    pg.evaluate("document.querySelector('.sheet').scrollTop=0"); ok('F2 landscape: heading visible at top', pg.evaluate("document.getElementById('parkH').getBoundingClientRect().top") >= 0)
    pg.keyboard.press('Escape')
    # F1: narrow footer
    for w, h in [(320, 670), (390, 844)]:
        pg.set_viewport_size({'width': w, 'height': h}); pg.wait_for_timeout(200)
        r = pg.evaluate("(()=>{const b=document.querySelector('.bar').getBoundingClientRect();return {bh:b.height,vh:innerHeight,sw:document.getElementById('submitBtn').getBoundingClientRect().width,pw:document.getElementById('parkBtn').getBoundingClientRect().width}})()")
        ok('F1 footer at %dx%d is <=25%% of viewport and both buttons usable (%s)' % (w, h, r), r['bh'] <= r['vh'] * 0.25 and r['sw'] >= 100 and r['pw'] >= 100)
    pg.set_viewport_size({'width': 768, 'height': 1024}); pg.wait_for_timeout(200)
    ok('tablet: no horizontal overflow', pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

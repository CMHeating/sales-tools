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



import urllib.parse, datetime

URL = ORIGIN + 'install-requirements.html#job=900001&cust=Sample+Alpha&date=%s&rep=Samir+Khoury&practice=1' % d(5)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 900}); ctx.route('**/*', handler)
    ctx.add_init_script("window.__picks = 0; HTMLInputElement.prototype.showPicker = function () { window.__picks++; };")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    rec = lambda: api('GET', '/api/record?job=900001')[1]['record']['hca']
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800)
    # payment section
    ok('Payment section asks "Down payment collected?" with Yes / No / N/A', pg.is_visible('#sec-pay #row-downpay') and [pg.get_attribute(f'button[data-id="downpay"]:nth-of-type({n})', 'data-v') for n in (1, 2, 3)] == ['yes', 'no', 'na'])
    ok('"Rebate applied to the estimate?" stays hidden until Rebate eligible = Yes', not pg.is_visible('#row-rb-applied'))
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.wait_for_timeout(200)
    ok('...then appears in the Payment section', pg.is_visible('#sec-pay #row-rb-applied'))
    pg.click('button[data-id="downpay"][data-v="no"]'); pg.wait_for_timeout(500)
    ok('down payment No needs no reason or date (it is information, not a task)', not pg.is_visible('#why-downpay') and pg.inner_text('#ringN').replace('\n', ' ') == '0 of 12')
    ok('the extra answers are saved on the record', rec()['items']['downpay']['v'] == 'no')
    # electrical labor is Yes / No only
    labels = pg.eval_on_selector_all('button[data-id="e-labor"]', 'els => els.map(e => e.textContent.trim())')
    ok('Electrical labor billed correctly? is Yes / No (no Complete / Working on it / Not done)', labels == ['Yes', 'No'])
    pg.click('button[data-id="e-labor"][data-v="no"]'); pg.wait_for_timeout(300)
    ok('answering No asks why and by when (it needs fixing)', pg.is_visible('#why-e-labor'))
    # calendar pop-up instead of typing
    picks0 = pg.evaluate('window.__picks')
    pg.click('#why-e-labor input[type="date"]'); pg.wait_for_timeout(200)
    ok('tapping a date box opens the calendar pop-up', pg.evaluate('window.__picks') > picks0)
    pg.focus('#why-e-labor input[type="date"]'); pg.keyboard.type('2031'); pg.wait_for_timeout(200)
    ok('typing into a date box does nothing (pick from the calendar)', pg.input_value('#why-e-labor input[type="date"]') == '')
    pg.click('#parkBtn'); pg.wait_for_timeout(200); n0 = pg.evaluate('window.__picks'); pg.click('#parkDate'); pg.wait_for_timeout(200)
    ok('the Save & exit wrap-up date opens the calendar too', pg.evaluate('window.__picks') > n0)
    pg.keyboard.press('Escape')
    # email: explicit down payment and rebate-applied
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in ['stock', 'permit', 'mat', 'video', 'photos', 'i-labor', 'e-labor']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="downpay"][data-v="yes"]'); pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'PUD')
    for i in ['rb-balance', 'rb-ahri']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('#ahri-rb-ahri [data-ah="st"]'); pg.click('button[data-id="rb-applied"][data-v="na"]'); pg.wait_for_timeout(500)
    pg.click('#submitBtn'); pg.wait_for_timeout(900); prev = pg.inner_text('#emailPrev')
    ok('email: DOWN PAYMENT COLLECTED uses the HCA answer (Yes), not a guess from the payment type', 'DOWN PAYMENT COLLECTED: Yes' in prev)
    ok('email concerns say the rebate is NOT applied to the estimate yet', 'Rebate: PUD; NOT applied to the estimate yet' in prev)
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

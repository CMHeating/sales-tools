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
    ok('down payment No needs no reason or date (it is information, not a task)', not pg.is_visible('#why-downpay') and pg.inner_text('#ringN').replace('\n', ' ') == '0 of 8')
    ok('the extra answers are saved on the record', rec()['items']['downpay']['v'] == 'no')
    # heat load Yes / No (mini split is an acceptable No); AHRI Yes / No / N/A
    lab = lambda i: pg.eval_on_selector_all(f'button[data-id="{i}"]', 'els => els.map(e => e.textContent.trim())')
    ok('Heat load is Yes / No (no N/A); AHRI is Yes / No / N/A', lab('heatload') == ['Yes', 'No'] and lab('ahri') == ['Yes', 'No', 'N/A'])
    pg.click('button[data-id="heatload"][data-v="no"]'); pg.wait_for_timeout(300)
    opts = pg.eval_on_selector_all('#why-heatload select option', 'els => els.map(e => e.textContent.trim())')
    ok('No on Heat load offers "Mini split" as the first reason', opts[1].startswith('Mini split'))
    pg.select_option('#why-heatload select', label=opts[1]); pg.wait_for_timeout(600)
    ok('Mini split: no date needed (date box hidden) and Heat load drops out of the count (0 of 7)', not pg.is_visible('#why-heatload input[type="date"]') and pg.inner_text('#ringN').replace('\\n', ' ') == '0 of 7')
    ok('the record carries the reason and readiness total is 11', rec()['items']['heatload']['why'].startswith('Mini split') and api('GET', '/api/record?job=900001')[1]['record']['readiness']['total'] == 7)
    pg.select_option('#why-heatload select', 'Waiting on customer'); pg.wait_for_timeout(400)
    ok('any other reason needs a by-when date again and counts as open (0 of 8)', pg.is_visible('#why-heatload input[type="date"]') and pg.inner_text('#ringN').replace('\\n', ' ') == '0 of 8')
    pg.click('button[data-id="heatload"][data-v="yes"]')
    # balance point is Yes / No
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'Gensco'); pg.wait_for_timeout(200)
    ok('Balance point works for the program? is Yes / No (still asked for Gensco)', lab('rb-balance') == ['Yes', 'No'] and pg.is_visible('#row-rb-balance'))
    pg.click('button[data-id="rb-balance"][data-v="no"]'); pg.wait_for_timeout(300)
    ok('No on the balance point asks why and by when (rebate gate fails)', pg.is_visible('#why-rb-balance') and 'not secured' in pg.inner_text('#rebNote').lower())
    pg.click('button[data-id="rb-balance"][data-v="yes"]'); pg.click('button[data-id="rebate"][data-v="na"]'); pg.wait_for_timeout(200)
    # equipment in stock is Yes / No
    ok('Equipment in stock? is Yes / No', lab('stock') == ['Yes', 'No'])
    pg.click('button[data-id="stock"][data-v="no"]'); pg.wait_for_timeout(300)
    ok('No asks why and by when', pg.is_visible('#why-stock'))
    pg.click('button[data-id="stock"][data-v="yes"]'); pg.wait_for_timeout(200)
    # rental paperwork only for rentals
    ok('rental paperwork stays hidden unless a rental payment is chosen, with a hint saying how to get it', not pg.is_visible('#sec-rental') and 'rental payment' in pg.inner_text('#rentalHint').lower())
    pg.select_option('#pay', label=[o for o in pg.eval_on_selector_all('#pay option', 'els => els.map(e => e.textContent)') if 'rental' in o.lower()][0]); pg.wait_for_timeout(200)
    ok('choosing a rental payment brings up the six rental questions', pg.is_visible('#sec-rental') and pg.locator('#sec-rental .row').count() == 6)
    pg.select_option('#pay', index=0); pg.wait_for_timeout(200)
    ok('and they go away again when the payment is not a rental (nothing answered)', not pg.is_visible('#sec-rental'))
    # potential permit delays
    ok('"Potential permit delays?" sits right after the Permit question with Yes / No', pg.is_visible('#sec-equip #row-permitdelay') and pg.eval_on_selector_all('button[data-id="permitdelay"]', 'els => els.map(e => e.textContent.trim())') == ['Yes', 'No'])
    pg.click('button[data-id="permitdelay"][data-v="yes"]'); pg.wait_for_timeout(500)
    ok('saved, not counted, and needs no reason/date', rec()['items']['permitdelay']['v'] == 'yes' and pg.inner_text('#ringN').replace('\\n', ' ') == '2 of 8' and not pg.is_visible('#why-permitdelay'))
    c, r = api('POST', '/api/hca', {'job': '900001', 'items': {'permitdelay': {'v': 'work'}}}); ok('only Yes or No is accepted', c == 400)
    # electrical labor is Yes / No only
    labels = pg.eval_on_selector_all('button[data-id="i-labor"]', 'els => els.map(e => e.textContent.trim())')
    ok('Install labor billed correctly? is Yes / No (no Complete / Working on it / Not done)', labels == ['Yes', 'No'])
    pg.click('button[data-id="i-labor"][data-v="no"]'); pg.wait_for_timeout(300)
    ok('answering No asks why and by when (it needs fixing)', pg.is_visible('#why-i-labor'))
    # calendar pop-up instead of typing
    picks0 = pg.evaluate('window.__picks')
    pg.click('#why-i-labor input[type="date"]'); pg.wait_for_timeout(200)
    ok('tapping a date box opens the calendar pop-up', pg.evaluate('window.__picks') > picks0)
    pg.focus('#why-i-labor input[type="date"]'); pg.keyboard.type('2031'); pg.wait_for_timeout(200)
    ok('typing into a date box does nothing (pick from the calendar)', pg.input_value('#why-i-labor input[type="date"]') == '')
    pg.click('#parkBtn'); pg.wait_for_timeout(200); n0 = pg.evaluate('window.__picks'); pg.click('#parkDate'); pg.wait_for_timeout(200)
    ok('the Save & exit wrap-up date opens the calendar too', pg.evaluate('window.__picks') > n0)
    pg.keyboard.press('Escape')
    # email: explicit down payment and rebate-applied
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in ['stock', 'mat', 'video', 'photos', 'i-labor']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="downpay"][data-v="yes"]'); pg.click('button[data-id="permitdelay"][data-v="yes"]'); pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'PUD')
    for i in ['rb-balance', 'rb-ahri']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('#ahri-rb-ahri [data-ah="st"]'); pg.click('button[data-id="rb-applied"][data-v="na"]'); pg.wait_for_timeout(500)
    pg.click('#submitBtn'); pg.wait_for_timeout(900); prev = pg.inner_text('#emailPrev')
    ok('email: DOWN PAYMENT COLLECTED uses the HCA answer (Yes), not a guess from the payment type', 'DOWN PAYMENT COLLECTED: Yes' in prev)
    ok('email concerns carry Potential permit delays when the HCA said Yes', 'Potential permit delays' in prev)
    ok('email concerns say the rebate is NOT applied to the estimate yet', 'Rebate: PUD; NOT applied to the estimate yet' in prev)
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

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
BASE7 = ['stock', 'permit', 'mat', 'video', 'photos', 'i-labor', 'e-labor']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 900}); ctx.route('**/*', handler)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800)
    ok('the three optional email lines are on the page', pg.is_visible('#sysDesc') and pg.is_visible('#vendorTxt') and pg.is_visible('#filterTxt'))
    pg.select_option('#pay', index=1)
    for i in BASE7: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="na"]'); pg.fill('#sysDesc', 'Mitsubishi Single Zone Ductless'); pg.fill('#vendorTxt', 'Acme Supply'); pg.fill('#filterTxt', '16x25x1'); pg.wait_for_timeout(600)
    ok('no email prompt before Submit', not pg.is_visible('#sentModal'))
    pg.click('#submitBtn'); pg.wait_for_timeout(900)
    ok('after Submit the email draft appears (nothing is sent by the page)', pg.is_visible('#sentModal') and not EXTERNAL)
    prev = pg.inner_text('#emailPrev'); lines = prev.split('\n')
    want_day = (datetime.date.today() + datetime.timedelta(days=5)); wd = want_day.strftime('%A') + ' %d/%d' % (want_day.month, want_day.day)
    ok('subject: customer-what was sold', lines[0] == 'Subject: Sample Alpha-Mitsubishi Single Zone Ductless')
    for lab, val in [('CUSTOMER NAME', 'Sample Alpha'), ('INSTALL DATE', wd), ('PAYMENT', 'Financed'), ('DOWN PAYMENT COLLECTED', 'N/A (financed)'), ('VENDOR AND AVAILABILITY', 'Acme Supply - equipment available'), ('FILTER SIZE', '16x25x1'), ('ANY CONCERNS FOR INSTALL', 'None')]:
        ok('template line %s: %s' % (lab, val), ('\n' + lab + ': ' + val) in ('\n' + prev.split('\n\n', 1)[1]))
    ok('payment line has no tick mark; the email ends at ANY CONCERNS FOR INSTALL (no extra signature)', '\u2714' not in prev and prev.rstrip().endswith('ANY CONCERNS FOR INSTALL: None'))
    href = pg.get_attribute('#mailLink', 'href'); q = urllib.parse.parse_qs(href.split('?', 1)[1])
    ok('Open email draft is a mailto: with subject and body, recipient left for the HCA', href.startswith('mailto:?subject=') and q['subject'][0] == 'Sample Alpha-Mitsubishi Single Zone Ductless' and q['body'][0].startswith('CUSTOMER NAME: Sample Alpha'))
    pg.click('#copyEmail'); pg.wait_for_timeout(300); ok('Copy email gives feedback', len(pg.inner_text('#sentMsg')) > 5)
    pg.wait_for_timeout(2800); ok('no auto-redirect: the HCA decides when to leave', 'install-requirements' in pg.url)
    pg.click('#sentBack'); pg.wait_for_timeout(800); ok('Back to my projects returns to the list', 'practice/index.html' in pg.url)
    # down payment mapping + concerns + blanks
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800)
    pg.select_option('#pay', label='\u2714 Check/cash \u2014 half down received')
    for i in BASE7: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'PSE')
    for i in ['rb-balance', 'rb-ahri']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rb-tc"][data-v="work"]'); pg.fill('#notes', 'Gate code at the street'); pg.wait_for_timeout(300); pg.click('#submitBtn'); pg.wait_for_timeout(900)
    prev = pg.inner_text('#emailPrev')
    ok('blank optional lines fall back sensibly; subject is just the customer', prev.startswith('Subject: Sample Alpha\n') and 'VENDOR AND AVAILABILITY: vendor not entered - equipment available' in prev and 'FILTER SIZE: not entered' in prev)
    ok('check/cash half down received => down payment Yes', 'DOWN PAYMENT COLLECTED: Yes' in prev)
    ok('concerns carry the HCA note, what is still open and the rebate status', 'Gate code at the street' in prev and 'Terms & conditions done in progress' in prev and 'Rebate: PSE (not secured yet)' in prev)
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

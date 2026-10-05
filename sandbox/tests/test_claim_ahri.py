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

import urllib.parse
URL = ORIGIN + 'install-requirements.html#job=900001&cust=Sample+Alpha&date=%s&rep=Samir+Khoury&practice=1' % d(5)
TRACKER = 'https://install-availability-tracker.web.app/'
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 900}); ctx.route('**/*', handler)
    ctx.route('https://install-availability-tracker.web.app/**', lambda r: r.fulfill(body='<html><title>tracker</title></html>', content_type='text/html'))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    api = lambda method, path, body=None: pg.evaluate("""async ([m,p,b]) => { const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}); return [r.status, await r.json()]; }""", [method, path, body])
    rec = lambda: api('GET', '/api/record?job=900001')[1]['record']['hca']
    pg.goto(ORIGIN + 'practice/index.html'); pg.wait_for_timeout(500); api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800)
    first = pg.evaluate("document.querySelector('.card h2').textContent")
    ok('the FIRST card asks about claiming your spot on the install availability sheet (%s)' % first, 'Install availability' in first and pg.is_visible('#row-claim') and 'claim your spot' in pg.inner_text('#row-claim').lower())
    ok('answers are Yes / No', pg.locator('button[data-id="claim"]').count() == 2)
    with pg.expect_popup() as pop: pg.click('button[data-id="claim"][data-v="yes"]')
    ok('Yes opens the install availability sheet in a new tab', pop.value.url.startswith(TRACKER))
    ok('a note tells them to claim there and come back; the form stays usable', pg.is_visible('#claimNote') and 'claim your spot' in pg.inner_text('#claimNote').lower() and pg.locator('#claimLink').get_attribute('href') == TRACKER)
    pop.value.close()
    pg.click('button[data-id="claim"][data-v="na"]'); pg.wait_for_timeout(300)
    ok('No: nothing opens, the note hides, the rest of the process continues', not pg.is_visible('#claimNote') and pg.is_enabled('button[data-id="stock"][data-v="yes"]'))
    ok('the answer is saved but never blocks or counts (ring unchanged at 0 of 9)', pg.inner_text('#ringN').replace('\n', ' ') == '0 of 9')
    ok('the jurisdiction timing sheet is linked under Permit and opens in a new tab', pg.is_visible('#jurLink') and pg.get_attribute('#jurLink', 'href').startswith('https://docs.google.com/spreadsheets/') and pg.get_attribute('#jurLink', 'target') == '_blank')
    # AHRI follow-up
    pg.click('button[data-id="ahri"][data-v="yes"]'); pg.wait_for_timeout(250)
    ok('AHRI Complete asks: in ServiceTitan or can you provide it?', pg.is_visible('#ahri-ahri .ahq') and 'servicetitan' in pg.inner_text('#ahri-ahri').lower() and 'provide' in pg.inner_text('#ahri-ahri').lower())
    pg.click('#ahri-ahri [data-ah="st"]'); pg.wait_for_timeout(700)
    ok('"It is in ServiceTitan" is saved on the item and shown as a summary', rec()['items']['ahri']['note'] == 'In ServiceTitan' and 'In ServiceTitan' in pg.inner_text('#ahri-ahri .ahdone'))
    pg.click('#ahri-ahri .ahedit'); pg.fill('#ahri-ahri .aht', 'Joe sends it Friday'); pg.click('#ahri-ahri [data-ah="prov"]'); pg.wait_for_timeout(700)
    ok('"I can provide it" saves the typed detail', rec()['items']['ahri']['note'] == 'Can provide: Joe sends it Friday')
    pg.click('button[data-id="ahri"][data-v="na"]'); pg.wait_for_timeout(700)
    ok('changing AHRI away from Complete clears the answer and hides the box', not pg.is_visible('#ahri-ahri') and (rec()['items']['ahri'].get('note') or '') == '')
    # rebate AHRI certificate asks the same thing
    pg.click('button[data-id="rebate"][data-v="yes"]'); pg.select_option('#rebProg', 'PSE'); pg.click('button[data-id="rb-ahri"][data-v="yes"]'); pg.wait_for_timeout(250)
    ok('the rebate AHRI certificate asks too', pg.is_visible('#ahri-rb-ahri .ahq'))
    pg.click('#ahri-rb-ahri [data-ah="st"]'); pg.wait_for_timeout(600)
    # full flow: claim = No, AHRI "I can provide it" -> email concerns + manager sees the note
    api('POST', '/api/reset', {}); pg.goto(URL); pg.reload(); pg.wait_for_timeout(800); pg.select_option('#pay', index=1)
    for i in ['stock', 'permit', 'mat', 'video', 'photos', 'i-labor']: pg.click(f'button[data-id="{i}"][data-v="yes"]')
    pg.click('button[data-id="rebate"][data-v="na"]'); pg.click('button[data-id="claim"][data-v="na"]')
    pg.click('button[data-id="ahri"][data-v="yes"]'); pg.fill('#ahri-ahri .aht', 'Joe sends it Friday'); pg.click('#ahri-ahri [data-ah="prov"]'); pg.wait_for_timeout(600)
    pg.click('#submitBtn'); pg.wait_for_timeout(900)
    prev = pg.inner_text('#emailPrev')
    ok('email concerns: not on the availability sheet yet + the AHRI the HCA will provide', 'Not on the install availability sheet yet' in prev and 'AHRI match: I can provide it (Joe sends it Friday)' in prev)
    q = ctx.new_page(); q.goto(ORIGIN + 'install-qc.html#practice=1&as=Geoff'); q.reload(); q.wait_for_timeout(700); q.click('.job[data-job="900001"]'); q.wait_for_timeout(700)
    ok('the sales lane shows the AHRI note the HCA gave', 'Can provide: Joe sends it Friday' in q.inner_text('[data-lane="sales"] .row[data-k="ahri-ok"] .said'))
    ok('no page errors', not errs); print(errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

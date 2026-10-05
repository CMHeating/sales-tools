#!/usr/bin/env python3
"""Sandbox end-to-end + audit-regression tests. Needs: the sandbox server running on 127.0.0.1:8787, Playwright (python).
Exits NON-ZERO if any check fails (the earlier ad-hoc scripts only printed FAIL)."""
import json, os, subprocess, sys, datetime, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
B = os.environ.get('SANDBOX', 'http://127.0.0.1:8787'); FAILS = []
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
d = lambda n: (datetime.date.today() + datetime.timedelta(days=n)).isoformat()

def ok(label, cond):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: FAILS.append(label)

def call(path, body=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'Content-Type': 'application/json'} if data is not None else {}
    h.update(headers or {})
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + path, data=data, headers=h))
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {}

FULL = {'pay': '✔ Financed — approved & sales slip signed', 'items': {k: {'v': 'yes'} for k in ['stock', 'permit', 'heatload', 'ahri', 'mat', 'photos', 'video']}}
def hca(job, **kw): return call('/api/hca', dict({'job': job, 'by': 'Test HCA'}, **kw))
def lanes_all(job, result='verified'):
    from_meta = call('/api/meta')[1]['lanes']
    for lane, v in from_meta.items():
        call('/api/lane', {'job': job, 'by': v['who'], 'lane': lane, 'items': {k: {'result': result} for k in v['items']}, 'signoff': 'confirmed'})

# ---------- API: audit AUD-13 / 14 / 18 ----------
call('/api/reset', {})
c, r = call('/api/record?job=800001'); ok('AUD-13 pipeline job has a record', c == 200 and r['ok'])
c, r = hca('800001', **FULL); ok('AUD-13 pipeline job answers can be saved', c == 200)
c, r = hca('900001', submit=True); ok('AUD-14 empty submission is refused', c == 400 and 'still needed' in r.get('error', ''))
hca('900001', pay=FULL['pay'], items=dict(FULL['items'], photos={'v': 'no'}))
c, r = hca('900001', submit=True); ok('AUD-14 a Not-done item needs why + by-when to submit', c == 400 and 'why' in r.get('error', ''))
lanes_all('900001')
ok('AUD-14 all lanes confirmed but HCA never submitted is NOT ready', call('/api/record?job=900001')[1]['record']['status'] != 'ready')
call('/api/reset', {})
hca('900001', **FULL); c, r = hca('900001', submit=True); ok('complete answers can be submitted', c == 200)
ok('submitted -> status submitted', call('/api/record?job=900001')[1]['record']['status'] == 'submitted')
lanes_all('900001'); ok('all lanes confirmed after submit -> ready', call('/api/record?job=900001')[1]['record']['status'] == 'ready')
c, r = call('/api/lane', {'job': '900001', 'by': 'Lyle', 'lane': 'install', 'items': {'mat-ok': {'result': 'missing'}}}); ok('missing without found + when is refused', c == 400)
call('/api/reset', {})
for label, body in [('AUD-18 body is a list', []), ('AUD-18 item is null', {'job': '900001', 'lane': 'install', 'items': {'mat-ok': None}}),
                    ('AUD-18 items is a list', {'job': '900001', 'lane': 'install', 'items': ['mat-ok']}),
                    ('AUD-18 hca items is a list', {'job': '900001', 'items': ['x']}), ('AUD-18 parked is a string', {'job': '900001', 'parked': 'x'}),
                    ('unknown HCA item key', {'job': '900001', 'items': {'bogus': {'v': 'yes'}}})]:
    c, r = call('/api/lane' if 'lane' in (body if isinstance(body, dict) else {}) else '/api/hca', body)
    ok(label + ' -> 400, no crash', c == 400)
c, r = call('/api/hca', raw=b'x' * 70000); ok('AUD-18 oversized body -> 413', c == 413)
c, r = call('/api/hca', raw=b'{bad'); ok('bad json -> 400', c == 400)
ok('server still healthy after bad requests', call('/api/meta')[0] == 200)

# ---------- shared module (node) ----------
js = r'''
const P = require(process.argv[1] + '/js/install-projects.js'); const who = {full: 'A B'}; let bad = [];
const sold = [{customer:'X',hca:'A B',job:'111',projectId:'p1',installDate:'2030-01-02',stage:'SOLD_ACTIVE'}];
const pipe = [{customer:'X',hca:'A B',job:'222',projectId:'p1',source:'backlog',comboDate:'2030-01-02'},
              {customer:'Y',hca:'A B',job:'333',source:'pipeline',comboDate:''}];
const opts = P.options(sold, pipe, who, '2030-01-01');
if (opts.length !== 2) bad.push('AUD-16 projectId dedupe: got ' + opts.length);
const evil = [{customer:'Z',hca:'A B',job:'9',installDate:'2030-01-03',stage:'SOLD_ACTIVE',readiness:{done:'<img src=x onerror=1>',total:'<b>9</b>'}}];
const html = P.listHtml(evil, [], who, '2030-01-01');
if (/<img|onerror/.test(html)) bad.push('AUD-17 readiness reaches HTML unescaped');
if (!/of 8/.test(html)) bad.push('AUD-17 bad readiness should fall back to the default total');
const h2 = P.listHtml([{customer:'<script>alert(1)</script>',hca:'A B',job:'1',installDate:'2030-01-03',stage:'SOLD_ACTIVE'}], [], who, '2030-01-01');
if (/<script>/.test(h2)) bad.push('customer name not escaped');
if (!/aria-label="needs attention"|aria-label="in progress"|aria-label="complete"/.test(html)) bad.push('status dot has no text alternative');
console.log(JSON.stringify(bad));'''
out = subprocess.run(['node', '-e', js, ROOT], capture_output=True, text=True)
bad = json.loads(out.stdout.strip() or '["node failed: ' + out.stderr[-200:].replace('"', "'") + '"]')
ok('shared module: dedupe by projectId, numeric readiness, escaping, status dots have text', not bad)
for b_ in bad: print('   ', b_)

# ---------- browser ----------
call('/api/reset', {})
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 430, 'height': 932}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    url = lambda job, cust, n: f'{B}/install-requirements.html#job={job}&cust={cust}&date={d(n)}&rep=Samir+Khoury'
    pg.goto(url('900002', 'Sample+Bravo', 6)); pg.reload(); pg.wait_for_timeout(700)
    ok('sandbox banner on localhost', 'SANDBOX' in pg.inner_text('#envBar'))
    ok('AUD-hostname: attacker host names do not count as sandbox', pg.evaluate("[SANDBOX_RE.test('localhost.attacker.invalid'),SANDBOX_RE.test('evil.example.com'),SANDBOX_RE.test('10.0.0.5.evil.com'),SANDBOX_RE.test('127.0.0.1'),SANDBOX_RE.test('localhost'),SANDBOX_RE.test('192.168.1.20')]") == [False, False, False, True, True, True])
    ok('"No" is labelled "Not done"', pg.inner_text('button[data-id="photos"][data-v="no"]') == 'Not done')
    ok('Needs-you entries are real buttons (keyboard reachable)', pg.evaluate("document.querySelectorAll('#needs a[data-go]').length") == 0)
    # AUD-12: draft restore vs server state
    pg.evaluate("localStorage.clear()")
    call('/api/reset', {}); hca('900002', pay=FULL['pay'], items={'photos': {'v': 'no', 'why': 'Waiting on customer', 'when': d(12)}})
    pg.evaluate("localStorage.setItem('cmh_install_req_900002', JSON.stringify({items:{photos:{v:'no',why:'Waiting on customer',when:'%s'}},pay:'',notes:''}))" % d(10))
    pg.reload(); pg.wait_for_timeout(800)
    pg.fill('#why-photos input[type=date]', d(20)); pg.wait_for_timeout(500)
    ok('AUD-12 editing the date after a draft+server restore changes the CURRENT state', pg.evaluate("S.items.photos.when") == d(20))
    ok('AUD-12 ...and it reaches the server', call('/api/record?job=900002')[1]['record']['hca']['items']['photos']['when'] == d(20))
    # AUD-19: park dialog focus management
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.focus('#parkBtn'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    inside = []
    for _ in range(9): pg.keyboard.press('Tab'); inside.append(pg.evaluate("!!document.activeElement.closest('#parkModal')"))
    ok('AUD-19 Tab stays inside the park dialog', all(inside))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok('AUD-19 Escape closes the dialog and returns focus to the button', pg.evaluate("document.activeElement.id") == 'parkBtn' and not pg.is_visible('#parkModal'))
    # empty state
    pg.goto(B + '/install-requirements.html'); pg.reload(); pg.wait_for_timeout(500)
    ok('empty state: pick-a-project message, checklist hidden, submit disabled', 'pick a project first' in pg.inner_text('body').lower() and not pg.is_visible('#sec-pay') and pg.is_disabled('#submitBtn'))
    # full flow
    call('/api/reset', {})
    pg.goto(url('900001', 'Sample+Alpha', 2)); pg.reload(); pg.wait_for_timeout(700)
    pg.select_option('#pay', index=1)
    for i, v in [('stock', 'yes'), ('permit', 'yes'), ('heatload', 'yes'), ('ahri', 'yes'), ('mat', 'yes'), ('video', 'yes'), ('photos', 'no')]: pg.click(f'button[data-id="{i}"][data-v="{v}"]')
    ok('submit blocked: Not done needs why + by-when', pg.is_disabled('#submitBtn'))
    pg.select_option('#why-photos select', 'Waiting on customer'); pg.fill('#why-photos input[type=date]', d(1)); pg.wait_for_timeout(600)
    rec = call('/api/record?job=900001')[1]['record']
    ok('answers saved while typing', rec['hca']['items']['photos']['v'] == 'no' and rec['readiness']['done'] == 7)
    pg.click('#submitBtn'); pg.wait_for_timeout(700)
    ok('submit -> submitted + one outbox entry, nothing emailed', call('/api/record?job=900001')[1]['record']['status'] == 'submitted' and len(call('/api/outbox')[1]['mail']) == 1)
    q = ctx.new_page(); q.on('pageerror', lambda e: errs.append(str(e))); q.goto(B + '/install-qc.html'); q.wait_for_timeout(600)
    q.select_option('#me', 'Lyle'); q.click('[data-job="900001"]'); q.wait_for_timeout(500)
    ok('QC: Lyle\'s lane open, the others collapsed', q.evaluate("[...document.querySelectorAll('details[data-lane]')].map(x=>x.open)") == [False, True, False])
    ok('QC: non-rental job does not show rental items', 'rental contract' not in q.inner_text('[data-lane=sales]').lower())
    q.click('[data-lane=install] [data-k="layout-ok"] button.missing'); q.click('[data-lane=install] [data-save]'); q.wait_for_timeout(400)
    ok('QC: Missing without what-found/by-when is rejected', 'needs' in q.inner_text('[data-lane=install] [data-msg]').lower())
    q.fill('[data-lane=install] [data-k="layout-ok"] [data-f=found]', 'No photos in ServiceTitan'); q.fill('[data-lane=install] [data-k="layout-ok"] [data-f=when]', d(2))
    for k in ['mat-ok', 'stock-ok', 'labor', 'sizing', 'permit-ok']: q.click(f'[data-lane=install] [data-k="{k}"] button.verified')
    q.select_option('[data-lane=install] [data-so]', 'attention'); q.click('[data-lane=install] [data-save]'); q.wait_for_timeout(900)
    ok('QC: a lane touched -> in review', call('/api/record?job=900001')[1]['record']['status'] == 'in_review')
    pg.reload(); pg.wait_for_timeout(900)
    ok('HCA page locks while in review and shows the manager finding', pg.locator('.seg button').first.is_disabled() and 'found missing' in pg.inner_text('#needs'))
    call('/api/lane', {'job': '900001', 'by': 'Lyle', 'lane': 'install', 'items': {'layout-ok': {'result': 'verified'}}, 'signoff': 'confirmed'})
    lanes_all('900001')
    ok('all lanes confirmed -> ready, listed in Ready to book', call('/api/record?job=900001')[1]['record']['status'] == 'ready' and any(j['job'] == '900001' for j in call('/api/ready')[1]['jobs']))
    # desktop QC layout
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 900}); q2 = ctx2.new_page(); q2.goto(B + '/install-qc.html'); q2.wait_for_timeout(500)
    q2.click('#tabR'); q2.wait_for_timeout(300); q2.click('[data-job="900001"]'); q2.wait_for_timeout(500)
    ok('QC desktop: rows use the two-column grid', q2.evaluate("getComputedStyle(document.querySelector('.row')).display") == 'grid')
    # CRM-card preview
    pg3 = ctx.new_page(); pg3.goto(B + '/sandbox/hca-home.html'); pg3.wait_for_timeout(700)
    t = pg3.inner_text('#projList').lower()
    ok('preview: own jobs only, pipeline listed with where-is-it', 'sample alpha' in t and 'sample echo' not in t and 'not in combo log yet' in t)
    ok('preview: Project completion greyed until a project is chosen', pg3.get_attribute('#actCompleteLink', 'aria-disabled') == 'true')
    pg3.select_option('#projPick', index=2); ok('preview: choosing a project enables it with that job', pg3.get_attribute('#actCompleteLink', 'aria-disabled') is None and 'job=' in pg3.get_attribute('#actCompleteLink', 'href'))
    ok('no page errors', not errs); print('errors', errs[:3]); b.close()
print('\n%d check(s) failed' % len(FAILS) if FAILS else '\nALL CHECKS PASSED'); sys.exit(1 if FAILS else 0)

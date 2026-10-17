#!/usr/bin/env python3
"""Turn a Firebase export of the sold tracker (cmh_sold_tracker) into the JSON to import at cmh_install_jobs (console > Import JSON, at THAT node only).
Usage: make-jobs-import.py SOLD_TRACKER_EXPORT.json [--hca "Samir Khoury"] [--all] > jobs-import_PRIVATE.json
       make-jobs-import.py --selftest
Sold rows carry the job number as `jobNumber` (older exports: `job`). Only OPEN sold jobs are kept (jobCompleted blank); --all keeps completed ones too.
Handles both layouts: partitioned {hcaKey: {jobs, pipeline}} and legacy {jobs, pipeline}. Output: {hcaKey: {job: {job, customer, hca, installDate, department, stage, source?, comboDate?, comboTab?}}}.
The output holds customer names: keep it OUT of the repo (public). Without --hca every HCA is included; for the pilot pass the pilot HCA only."""
import json, re, sys
def slug(n): return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
def rows(x): return x if isinstance(x, list) else list((x or {}).values())
def build(d, only='', keep_all=False):
    out = {}
    parts = d if not ('jobs' in d or 'pipeline' in d) else {'_': d}
    for _, blob in parts.items():
        for kind, lst in (('sold', rows(blob.get('jobs'))), ('pipeline', rows(blob.get('pipeline')))):
            for j in lst:
                hca = str(j.get('hca') or '').strip()
                job = str(j.get('job') or j.get('jobNumber') or '').strip()
                if not hca or not job or (only and hca.lower() != only.lower()): continue
                if kind == 'sold' and not keep_all and str(j.get('jobCompleted') or '').strip(): continue
                rec = {'job': job, 'customer': s_(j.get('customer'))[:80], 'hca': hca, 'installDate': s_(j.get('installDate'))[:10], 'department': s_(j.get('department')) or 'HVAC', 'stage': s_(j.get('stage')) or ('SOLD_ACTIVE' if kind == 'sold' else 'PIPELINE')}
                if kind == 'pipeline': rec.update({'source': s_(j.get('source')) or 'pipeline', 'comboDate': s_(j.get('comboDate'))[:10], 'comboTab': s_(j.get('comboTab'))})
                out.setdefault(slug(hca), {})[job] = rec
    return out
def s_(v): return '' if v is None else str(v)
def selftest():
    d = {'jobs': [{'hca': 'Samir Khoury', 'jobNumber': 111, 'customer': 'A', 'installDate': None, 'stage': 'SOLD_PENDING_MATCH', 'jobCompleted': ''},
                  {'hca': 'Samir Khoury', 'jobNumber': '222', 'customer': 'B', 'installDate': '2026-10-20', 'jobCompleted': 'DONE AL'},
                  {'hca': 'Other Rep', 'job': '333', 'customer': 'C'}]}
    o = build(d, 'Samir Khoury')
    assert list(o) == ['samir-khoury'] and list(o['samir-khoury']) == ['111'], o
    assert o['samir-khoury']['111']['installDate'] == '' and o['samir-khoury']['111']['stage'] == 'SOLD_PENDING_MATCH'
    assert sorted(build(d, 'Samir Khoury', True)['samir-khoury']) == ['111', '222']
    assert build(d)['other-rep']['333']['job'] == '333'
    print('selftest OK')
def main(a):
    if '--selftest' in a: return selftest()
    only = a[a.index('--hca') + 1] if '--hca' in a else ''
    out = build(json.load(open(a[0])), only, '--all' in a)
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False); sys.stdout.write('\n')
    print('jobs: %d across %d HCA(s)' % (sum(len(v) for v in out.values()), len(out)), file=sys.stderr)
if __name__ == '__main__': main(sys.argv[1:])

#!/usr/bin/env python3
"""Turn a Firebase export of the sold tracker (cmh_sold_tracker) into the JSON to import at cmh_install_jobs (console > Import JSON, at THAT node only).
Usage: make-jobs-import.py SOLD_TRACKER_EXPORT.json [--hca "Samir Khoury"] > jobs-import_PRIVATE.json
Handles both layouts: partitioned {hcaKey: {jobs, pipeline}} and legacy {jobs, pipeline}. Output: {hcaKey: {job: {job, customer, hca, installDate, department, stage, source?, comboDate?, comboTab?}}}.
The output holds customer names: keep it OUT of the repo (public). Without --hca every HCA is included; for the pilot pass the pilot HCA only."""
import json, re, sys
def slug(n): return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
def rows(x): return x if isinstance(x, list) else list((x or {}).values())
def main(a):
    only = a[a.index('--hca') + 1] if '--hca' in a else ''
    d = json.load(open(a[0])); parts = d if not ('jobs' in d or 'pipeline' in d) else {'_': d}; out = {}
    for _, blob in parts.items():
        for kind, lst in (('sold', rows(blob.get('jobs'))), ('pipeline', rows(blob.get('pipeline')))):
            for j in lst:
                hca, job = str(j.get('hca', '')).strip(), str(j.get('job', '')).strip()
                if not hca or not job or (only and hca.lower() != only.lower()): continue
                rec = {'job': job, 'customer': str(j.get('customer', ''))[:80], 'hca': hca, 'installDate': str(j.get('installDate', ''))[:10], 'department': str(j.get('department', 'HVAC')), 'stage': str(j.get('stage', 'SOLD_ACTIVE' if kind == 'sold' else 'PIPELINE'))}
                if kind == 'pipeline': rec.update({'source': str(j.get('source', 'pipeline')), 'comboDate': str(j.get('comboDate', ''))[:10], 'comboTab': str(j.get('comboTab', ''))})
                out.setdefault(slug(hca), {})[job] = rec
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False); sys.stdout.write('\n')
    print('jobs: %d across %d HCA(s)' % (sum(len(v) for v in out.values()), len(out)), file=sys.stderr)
if __name__ == '__main__': main(sys.argv[1:])

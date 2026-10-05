#!/usr/bin/env python3
"""Build the deployable rules as LIVE + new nodes, and refuse to produce anything that touches a live node.

  build-additive-rules.py LIVE.json FRAGMENT.json OUT.json     build, then verify
  build-additive-rules.py --check LIVE.json CANDIDATE.json      verify only: every live node must be byte-for-byte equal

Why: `firebase deploy --only database` REPLACES the whole rule set. The Install Availability page (cmh_schedule, cmh_availability,
cmh_edit_locks, cmh_audit_logs) and every other live node must survive a deploy unchanged. LIVE.json is a private snapshot of the
console's Rules tab (it contains staff emails, so it is kept out of this public repo)."""
import json, sys

def load(p): return json.load(open(p, encoding="utf-8"))["rules"]

def check(live, cand):
    bad = []
    for k in live:
        if k not in cand: bad.append("DELETED: " + k)
        elif cand[k] != live[k]: bad.append("CHANGED: " + k)
    return bad

def main(a):
    if a and a[0] == "--check":
        bad = check(load(a[1]), load(a[2]))
    else:
        live, frag = load(a[0]), load(a[1])
        clash = [k for k in frag if k in live]
        if clash: sys.exit("REFUSED: fragment redefines live node(s): " + ", ".join(clash))
        out = dict(live); out.update(frag)
        json.dump({"rules": out}, open(a[2], "w", encoding="utf-8"), indent=2)
        bad = check(live, load(a[2]))
        print("added nodes:", ", ".join(frag))
    if bad: sys.exit("VERIFY FAILED:\n  " + "\n  ".join(bad))
    print("OK: every live node is unchanged (%d checked)" % len([k for k in load(a[-2] if a[0] == '--check' else a[0])]))

if __name__ == "__main__": main(sys.argv[1:])

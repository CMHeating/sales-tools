#!/usr/bin/env python3
"""Make the deployable database rules as LIVE + this build's Install Availability nodes.

  python3 scripts/merge-install-availability-rules.py LIVE.json OUT.json
  python3 scripts/merge-install-availability-rules.py --selftest

`firebase deploy --only database` REPLACES the whole rule set, and the live database also holds rules for
other tools (follow-up tracker, sold tracker, AR, ...) that this repo does not generate. So never deploy
database.install-availability.spark.rules.json on its own. Instead take a fresh snapshot of the live rules
(LIVE.json, kept OUTSIDE this public repo: it holds staff emails), then run this. OUT.json is the live rules
with only the nodes the build owns swapped in. It refuses if any other live node would change or vanish.
Write OUT.json outside the repo or to a gitignored *.private.json name."""
import json, sys

GENERATED = "database.install-availability.spark.rules.json"

def merge(live, gen):
    """Return (out, changed). gen's top-level nodes replace live's; '.read'/'.write' must already agree."""
    for k in (".read", ".write"):
        if live.get(k) != gen.get(k):
            sys.exit(f"REFUSED: root {k} differs (live {live.get(k)!r}, generated {gen.get(k)!r})")
    owned = [k for k in gen if not k.startswith(".")]
    out = dict(live)
    out.update({k: gen[k] for k in owned})
    for k in live:  # every node the build does not own must survive byte-for-byte
        if k not in owned and out.get(k) != live[k]:
            sys.exit("VERIFY FAILED: live node changed or deleted: " + k)
    return out, [k for k in owned if live.get(k) != gen[k]]

def selftest():
    live = {".read": False, ".write": False, "cmh_schedule": {"old": 1}, "cmh_ar": {"keep": 1}}
    gen = {".read": False, ".write": False, "cmh_schedule": {"new": 1}, "cmh_availability": {"a": 1}}
    out, changed = merge(live, gen)
    assert out["cmh_ar"] == {"keep": 1}, "other tool's node must survive"
    assert out["cmh_schedule"] == {"new": 1} and out["cmh_availability"] == {"a": 1}
    assert changed == ["cmh_schedule", "cmh_availability"]
    try:
        merge(dict(live, **{".read": True}), gen); raise AssertionError("root mismatch not refused")
    except SystemExit: pass
    print("selftest OK")

def main(a):
    if a == ["--selftest"]: return selftest()
    if len(a) != 2: sys.exit(__doc__)
    live = json.load(open(a[0], encoding="utf-8"))["rules"]
    gen = json.load(open(GENERATED, encoding="utf-8"))["rules"]
    out, changed = merge(live, gen)
    with open(a[1], "w", encoding="utf-8") as f:
        json.dump({"rules": out}, f, indent=2, ensure_ascii=False); f.write("\n")
    kept = [k for k in live if k not in gen]
    print("Install Availability nodes changed vs live:", ", ".join(changed) or "none (deploy would be a no-op)")
    print(f"Other live nodes kept unchanged ({len(kept)}):", ", ".join(kept) or "none")
    print("Wrote", a[1])

if __name__ == "__main__": main(sys.argv[1:])

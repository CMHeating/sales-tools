# Install-completion sandbox

Local test rig. FAKE data. Nothing here talks to live Firebase, Apps Script, ServiceTitan, the Combo Log or email.

    python3 sandbox/server.py            # http://127.0.0.1:8787  (add --lan to test from a phone on the same Wi-Fi)
    POST /api/reset                      # re-seed fake jobs

Pages (served by the same server):
- `/install-requirements.html#job=900001&cust=Sample+Alpha&date=YYYY-MM-DD&rep=Samir+Khoury`  HCA checklist (saves to the sandbox record)
- `/install-qc.html`                      managers: Verified / Missing / Mismatch per lane, sign-off, Ready to book
- `/sandbox/hca-home.html`                the two CRM cards (Daily Activities list + My Schedule overlay) with fake sold + backlog/pipeline jobs

Environment rule (install-requirements.html): localhost / private-IP host = SANDBOX (server record, outbox);
any other host = LIVE DEMO (answers stay on the device; Submit sends nothing) until `LIVE_SEND` is set to true.
The record shape and status rules in `server.py` are the DRAFT for the real storage; none of it is the live rule set.

## Tests (all exit non-zero on failure)
```
python3 sandbox/server.py --port 8787 &
python3 sandbox/tests/test_e2e.py            # API + browser + audit regressions (needs Playwright)
python3 sandbox/tests/test_crm_tiers.py      # CRM with stubbed Firebase modules
PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database 'node scripts/test-install-req-rules.cjs'   # with database.rules.json = rules/database.rules.merged.PROPOSED.json
```

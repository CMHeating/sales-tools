# Firebase rules for the install-completion records
- `cmh_install_req.rules.fragment.json`: NEW top-level nodes only. Never edits an existing node.
- `build-additive-rules.py`: builds `live + fragment` and verifies every live node is unchanged. Refuses anything else.
- Test with `scripts/test-live-rules-unchanged.cjs` and `scripts/test-install-req-rules.cjs`.
- The live rules snapshot contains staff emails and lives OUTSIDE this repo (private). Re-take it from the console before every deploy.
- Do NOT deploy rules from any other file. See `docs/AUTH-TIERS.md` > RULES DEPLOYMENT.

## Roster rows to create in the Firebase console BEFORE the rules are deployed (no real emails in this repo)
Key = the person's email, lowercase, every `.` replaced by `,` (for example `first,last@cmheating,com`).
- `cmh_install_roster/managers/<key>`: managers and admins.
  - Install manager: `{ "name": "Manager", "install": true }`
  - Electrical manager: `{ "name": "Electrical", "electrical": true }`
  - Admin (all three lanes, send back, mark installed): `{ "name": "Admin", "sales": true, "install": true, "electrical": true, "admin": true }`
- `cmh_install_roster/schedulers/<key>`: `true`. Read-only plus Ready to book. Add more people here later.
- HCAs stay in `cmh_followup_roster/hcas/<key>` as today.
- Role decisions 2026-10-04 (owner): two install managers; admins are the owner, the second admin and the coordinator (all admin rows); the scheduler row (read-only) is optional and unused for now.
- An email on no roster lands as no access on `install-home.html`; PIN/password sessions and non-@cmheating.com accounts are refused.

## GO-LIVE CHECKLIST (do in this order; stop if any step differs from expected)
1. Roster rows in the console (`cmh_install_roster/managers`, `/schedulers`, and `/hcas` = `{hcaKey: "Display Name"}` for every HCA), as above.
2. Jobs: `python3 scripts/make-jobs-import.py SOLD_TRACKER_EXPORT.json --hca "Samir Khoury" > jobs-import_PRIVATE.json`, then Import JSON at `cmh_install_jobs` ONLY (never the root). Keep that file out of the repo (customer names).
3. Fresh snapshot of the LIVE rules from the console -> `python3 rules/build-additive-rules.py LIVE.json rules/cmh_install_req.rules.fragment.json OUT.json` (verifies every live node unchanged).
4. Emulator tests with `database.rules.json` = OUT.json: `scripts/test-install-req-rules.cjs` (81 assertions), `scripts/test-live-core.cjs` (50 end-to-end checks through `js/live-core.js`), and `scripts/test-live-rules-unchanged.cjs` with `LIVE_RULES` and `NEW_RULES` set (270 comparisons identical, 20 Install Availability controls).
5. `firebase deploy --only database --dry-run`, then deploy with the owner watching; right after, test the Install Availability page as an HCA and as Amy.
6. Try it with `live=1` links (pages stay on practice/demo behaviour without it): `install-requirements.html#job=...&live=1`, `install-qc.html#live=1`, `install-admin.html#live=1`. Pilot HCA first. Submit sends no email (`LIVE_SEND` stays false) until the owner says yes.
7. Only then link `live=1` from the CRM / `install-home.html`.

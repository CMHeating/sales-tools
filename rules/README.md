# Firebase rules for the install-completion records
- `cmh_install_req.rules.fragment.json`: NEW top-level nodes only. Never edits an existing node.
- `build-additive-rules.py`: builds `live + fragment` and verifies every live node is unchanged. Refuses anything else.
- Test with `scripts/test-live-rules-unchanged.cjs` and `scripts/test-install-req-rules.cjs`.
- The live rules snapshot contains staff emails and lives OUTSIDE this repo (private). Re-take it from the console before every deploy.
- Do NOT deploy rules from any other file. See `docs/AUTH-TIERS.md` > RULES DEPLOYMENT.

## Roster rows to create in the Firebase console BEFORE the rules are deployed (no real emails in this repo)
Key = the person's email, lowercase, every `.` replaced by `,` (for example `first,last@cmheating,com`).
- `cmh_install_roster/managers/<key>`: managers and admins.
  - Install manager: `{ "name": "Lyle", "install": true }`
  - Electrical manager: `{ "name": "Jon", "electrical": true }`
  - Admin (all three lanes, send back, mark installed): `{ "name": "Geoff", "sales": true, "install": true, "electrical": true, "admin": true }`
- `cmh_install_roster/schedulers/<key>`: `true`. Read-only plus Ready to book. Add more people here later.
- HCAs stay in `cmh_followup_roster/hcas/<key>` as today.
- Role decisions 2026-10-04 (Geoff): managers Lyle and Jon Jansen; admins Geoff and Brittny; Amy = coordination (scheduler row; make her an admin row if she should send back or mark installed); Jazryn, Vanessa, Havana added later as schedulers.
- An email on no roster lands as no access on `install-home.html`; PIN/password sessions and non-@cmheating.com accounts are refused.

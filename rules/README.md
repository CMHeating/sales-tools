# Firebase rules for the install-completion records
- `cmh_install_req.rules.fragment.json`: NEW top-level nodes only. Never edits an existing node.
- `build-additive-rules.py`: builds `live + fragment` and verifies every live node is unchanged. Refuses anything else.
- Test with `scripts/test-live-rules-unchanged.cjs` and `scripts/test-install-req-rules.cjs`.
- The live rules snapshot contains staff emails and lives OUTSIDE this repo (private). Re-take it from the console before every deploy.
- Do NOT deploy rules from any other file. See `docs/AUTH-TIERS.md` > RULES DEPLOYMENT.

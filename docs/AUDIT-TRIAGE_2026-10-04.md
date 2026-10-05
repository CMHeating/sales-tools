# Audit triage — install completion + sign-in tiers (2026-10-04)
Auditors: ChatGPT (gpt-6-astra via codex-claudex, read-only) for code/logic/security; Gemini (read-only) for design. Author: Claude. Every finding was re-checked by the author; verdict + action + test below.
Reports: `AUDIT_CODE_chatgpt_2026-10-04.md`, `AUDIT_DESIGN_gemini_2026-10-04.md` (in the audit bundle, not in this repo).
Tests: `sandbox/tests/test_e2e.py` (API + browser, exits non-zero on failure), `sandbox/tests/test_crm_tiers.py` (CRM with stubbed Firebase), `scripts/test-install-req-rules.cjs` (emulator, 58 assertions). Run results at fix time: all pass.

## Code / logic / security (ChatGPT)
| ID | Sev | Verdict | Action | Test |
|---|---|---|---|---|
| AUD-01 | High | Confirmed | CRM now reads the HCA's own tracker subtree (roster key), falls back to the legacy root layout; admins may read the root. | test_crm_tiers (partitioned, legacy, admin) |
| AUD-02 | High | Confirmed | Rules: HCA may only move status working/submitted FROM null/working/submitted; a reviewed job cannot be reopened. | rules test (both exploit steps) |
| AUD-03 | High | Confirmed | Rules: `ready` needs `hca/submittedAt` + all three lanes `confirmed`; `installed` only from `ready`; no status delete/regress. | rules test |
| AUD-04 | High | Confirmed | `install-check.html` reverted to origin/main: the `#hca=1` mode (XSS sink) no longer exists. | file identical to main |
| AUD-05 | High | Confirmed | Same revert: the retired route to the live mailer is gone. | same |
| AUD-06 | High | Confirmed | Same revert (stock/permit verdict bug lived in that mode); the completion page handles stock/permit. | same |
| AUD-07 | Med | Confirmed | Same revert. | same |
| AUD-08 | Med | Confirmed | Same revert. | same |
| AUD-09 | Med | Confirmed | Rules: history only by the job's owner HCA, a manager, or an admin; fields typed + bounded. | rules test |
| AUD-10 | Med | Confirmed | Rules (additive nodes): schema validation (types, enums, lengths, allowed child names, per-lane item lists, found+when for missing), jobs must exist in `cmh_install_jobs` (trusted writer). | rules test |
| AUD-11 | Med | Confirmed | CRM tier = active token's `signInProvider`, not linked providers. Tightening the sold/follow-up rules to Google-only is NOT part of this deploy (it would break the anonymous sync); it stays a later cutover. | test_crm_tiers |
| AUD-12 | Med | Confirmed | Reason/date handlers read the CURRENT item; values refresh when state is replaced. | test_e2e |
| AUD-13 | Med | Confirmed | Sandbox resolves pipeline jobs. | test_e2e |
| AUD-14 | Med | Confirmed | Server refuses incomplete submissions; `ready` also requires a complete HCA section; rental items mapped into Sales authorizations in QC. | test_e2e |
| AUD-15 | Med | Confirmed, and worse | The live rules (supplied by Geoff) showed the other branch's rules would have CHANGED 8 live nodes and DELETED 3, including the Install Availability allowlists. Discarded. New approach: additive nodes only on top of the live rules, builder + verifier (`rules/build-additive-rules.py`), differential emulator test vs live (fails on the old proposal with 85 differences). | `scripts/test-live-rules-unchanged.cjs` |
| AUD-16 | Med | Confirmed | De-duplicate by `projectId` as well as job number. Rows with neither remain ambiguous (documented). | test_e2e (node) |
| AUD-17 | Med | Confirmed | Readiness values coerced to bounded integers. | test_e2e (node) |
| AUD-18 | Low | Confirmed | Body size cap, type validation, handler wrapped; no crash. | test_e2e |
| AUD-19 | Low | Confirmed | Park dialog traps focus and returns it; actionable anchors are buttons. | test_e2e |
| extra | — | Confirmed | Hostname test accepted `localhost.attacker.invalid`; now exact local hosts only (still never switches on the live mailer by itself). | test_e2e |
| extra | — | Confirmed | Old ad-hoc tests printed FAIL without failing. New suites exit non-zero. | — |

## Design (Gemini)
| ID | Verdict | Action |
|---|---|---|
| 01 colour-only status | Confirmed | Dots now carry a glyph (✓ … !) and a text alternative. |
| 02 lanes always expanded | Confirmed | Lanes are collapsible; only the signed-in manager's lane opens. |
| 03 desktop stacking | Confirmed | Two-column rows at 720px+. |
| 04 radius 16 vs 18 | PARTLY | New pages match `install-check.html` (16px); the CRM uses 18px. Left as is — pick one standard (owner decision). |
| 05 "No" wording | Adopted | UI label is now "Not done" (stored value unchanged). |
| 06 bottom padding | Applied | 140px; real keyboard behaviour needs a physical iPhone test. |
| 07 one-line found field | Confirmed | Textarea. |
| 08 empty-state skeleton | Not done | Polish. |
| 09 progress micro-animation / haptics | Not done | Polish. |

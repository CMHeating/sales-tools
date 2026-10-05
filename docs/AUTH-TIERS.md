# HCA Toolkit sign-in tiers (decided 2026-10-04, Geoff)

| Tier | Sign-in | What it unlocks |
|---|---|---|
| Customer information | Google, verified @cmheating.com | Sold jobs / tracker, follow-up and self-gen, project completion + QC pages, project list and schedule overlay, AR |
| Everything else | First name + PIN | Schedules, leaderboard, calculators, guides, clearance, pricing tools, activity counts |

## Why the database rules are the control (not the page)
- PIN accounts are real Firebase email/password accounts whose password is derived from the PIN by a formula that is visible in the public code. Anything a PIN session can read must be non-sensitive.
- The rules on branch `codex/hca-crm-firebase-rules` already require `email_verified == true` and an @cmheating.com address plus a roster match for the sold and follow-up trackers. PIN accounts are created without verified emails (script `create-install-auth-users-spark.js` uses signUp), so they are already refused. This is the reason the CRM now needs a Google step to read those cards at all.
- New nodes in `rules/cmh_install_req.rules.fragment.json` require `sign_in_provider == 'google.com'`, so a PIN session is refused even if its email were ever marked verified.

## What is built (this branch, not deployed)
- crm.html: "Sign in with Google" on the lock screen; badge shows the tier; sold, follow-up, project list and schedule overlay show a "Sign in with Google" prompt on a PIN session; Samir-only pilot gate for the new list/overlay/link.
  Tested headless with stubbed Firebase modules (15 checks): PIN vs Google, pilot vs non-pilot HCA, own jobs only.
- rules fragment (additive nodes only) + `scripts/test-install-req-rules.cjs` (52 assertions) + `scripts/test-live-rules-unchanged.cjs` (270 comparisons + 20 Install Availability controls): run in the Firebase emulator 2026-10-04, all pass. NOT deployed.

## What Geoff has to do / decide
1. Firebase console: Authentication > Google provider enabled, authorized domains include the live site (the follow-up tracker already uses Google sign-in, so this is probably done).
2. Java is installed (openjdk 27, keg-only). Run tests with `PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database '...'`. Do not deploy rules before they pass.
3. Create `cmh_install_roster/managers/<email key>` rows for Lyle, Jon, Geoff, Amy, Brittny (lane flags) in the console.
4. Merge the fragment into the codex branch rules, run both test files, then deploy rules (`firebase deploy --only database`). Geoff's action.
5. install-requirements.html / install-qc.html still use the sandbox or demo mode; they get Google sign-in + real storage when the rules are deployed.

## RULES DEPLOYMENT (revised after the live rules were compared, 2026-10-04)
**Never deploy a rules file built from the other session's branch (or any file that is not "live + new nodes").** A `firebase deploy --only database` replaces the WHOLE rule set. Comparing the live rules (console > Realtime Database > Rules) with that branch's rules showed it would have changed 8 live nodes and deleted 3, including the **Install Availability page's per-email allowlists** (`cmh_schedule`, `cmh_availability`, `cmh_edit_locks`, `cmh_audit_logs`): HCAs could have edited the schedule and overwritten audit entries, and the CRM would have lost `cmh_hca_activity`, `cmh_clearance`, `cmh_ar`.

Safe procedure (protects the live site):
1. Take a fresh private snapshot of the live Rules tab (it contains staff emails: keep it OUT of this public repo). Re-take it before every deploy; rules can change.
2. `python3 rules/build-additive-rules.py LIVE.json rules/cmh_install_req.rules.fragment.json OUT.json` builds live + new nodes only and verifies every live node is byte-for-byte unchanged (it refuses a fragment that redefines a live node). `--check LIVE.json CANDIDATE.json` verifies any other candidate.
3. Run `scripts/test-live-rules-unchanged.cjs` (differential: 9 identities x 30 operations, plus the Install Availability controls, must be IDENTICAL under live and new rules; it fails on the old proposal with 85 differences) and `scripts/test-install-req-rules.cjs` (every audit exploit) in the emulator.
4. `firebase deploy --only database --dry-run`, then deploy from a private firebase config whose rules path is OUT.json. Geoff's action. Firebase login must be current.
5. Afterwards: re-open the Install Availability page as an HCA and as Amy; re-run step 3 against a fresh snapshot.

What this additive deploy does NOT change (on purpose): `cmh_sold_tracker` stays `auth != null` read+write (the sync writes anonymously). So until a separate, later cutover (dedicated writer account + per-HCA partition + verified Google read, see the other session's branch), the Google-only gate on sold/follow-up cards is a UI gate: a PIN session could still read the sold tracker by calling Firebase directly. `cmh_followup_tracker` is already verified-email gated live.

## Not covered yet
- The follow-up tracker, follow-up/self-gen outreach pages and AR collections keep their own sign-in as is.
- The PIN tier is still guessable (short numeric PIN); acceptable only because nothing sensitive sits behind it.

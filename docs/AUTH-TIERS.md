# HCA Toolkit sign-in tiers (decided 2026-10-04, Geoff)

| Tier | Sign-in | What it unlocks |
|---|---|---|
| Customer information | Google, verified @cmheating.com | Sold jobs / tracker, follow-up and self-gen, project completion + QC pages, project list and schedule overlay, AR |
| Everything else | First name + PIN | Schedules, leaderboard, calculators, guides, clearance, pricing tools, activity counts |

## Why the database rules are the control (not the page)
- PIN accounts are real Firebase email/password accounts whose password is derived from the PIN by a formula that is visible in the public code. Anything a PIN session can read must be non-sensitive.
- The rules on branch `codex/hca-crm-firebase-rules` already require `email_verified == true` and an @cmheating.com address plus a roster match for the sold and follow-up trackers. PIN accounts are created without verified emails (script `create-install-auth-users-spark.js` uses signUp), so they are already refused. This is the reason the CRM now needs a Google step to read those cards at all.
- New nodes in `rules/cmh_install_req.rules.fragment.json` additionally require `sign_in_provider == 'google.com'`, so a PIN session is refused even if its email were ever marked verified.

## What is built (this branch, not deployed)
- crm.html: "Sign in with Google" on the lock screen; badge shows the tier; sold, follow-up, project list and schedule overlay show a "Sign in with Google" prompt on a PIN session; Samir-only pilot gate for the new list/overlay/link.
  Tested headless with stubbed Firebase modules (15 checks): PIN vs Google, pilot vs non-pilot HCA, own jobs only.
- rules fragment + `scripts/test-install-req-rules.cjs`: RUN 2026-10-04 in the Firebase emulator against the codex branch rules (commit 5f810a9) merged with the fragment: the existing `test-database-rules.cjs` and the new test both pass. `rules/database.rules.merged.PROPOSED.json` is that merged file. NOT deployed. Re-run both tests if the codex rules change.

## What Geoff has to do / decide
1. Firebase console: Authentication > Google provider enabled, authorized domains include the live site (the follow-up tracker already uses Google sign-in, so this is probably done).
2. Java is installed (openjdk 27, keg-only). Run tests with `PATH=/opt/homebrew/opt/openjdk/bin:$PATH firebase emulators:exec --project demo-hca-rules --only database '...'`. Do not deploy rules before they pass.
3. Create `cmh_install_roster/managers/<email key>` rows for Lyle, Jon, Geoff, Amy, Brittny (lane flags) in the console.
4. Merge the fragment into the codex branch rules, run both test files, then deploy rules (`firebase deploy --only database`). Geoff's action.
5. install-requirements.html / install-qc.html still use the sandbox or demo mode; they get Google sign-in + real storage when the rules are deployed.

## DEPLOYMENT ORDER (do not deploy rules first)
The tracker rules from branch `codex/hca-crm-firebase-rules` partition data per HCA and replace the anonymous sync writer with a dedicated writer account. Deploying them before the rest is in place breaks the live CRM, sold tracker page and the nightly sync. Required order:
1. Sync cutover: the Apps Script sync writes partitioned per-HCA data using the writer account (that branch's `apps-script/sold-job-tracker-sync.gs`; Geoff approves and runs it) and also writes `cmh_install_jobs`.
2. Console: roster rows (`cmh_followup_roster`, `cmh_install_roster`), Google provider/authorized domains.
3. Ship the CRM + pages from this branch (they read per-HCA subtrees and fall back to the legacy root layout, so this is safe before AND after).
4. Compare the LIVE rules (console > Realtime Database > Rules) with `rules/database.rules.merged.PROPOSED.json`; the proposal denies any node it does not list (audit AUD-15: `cmh_hca_activity`, `cmh_ar`, `cmh_clearance` are not in it). Add what the live CRM needs.
5. Re-run `scripts/test-install-req-rules.cjs` and that branch's tests, `firebase deploy --only database --dry-run`, then deploy. Firebase login must be current (`firebase login --reauth`).
The merged proposal ALSO tightens the other session's sold/follow-up rules to require a Google sign-in provider (audit AUD-11); their test file needs `firebase: { sign_in_provider: 'google.com' }` on its contexts.

## Not covered yet
- The follow-up tracker, follow-up/self-gen outreach pages and AR collections keep their own sign-in as is.
- The PIN tier is still guessable (short numeric PIN); acceptable only because nothing sensitive sits behind it.

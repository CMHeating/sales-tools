# Install Availability Security

Status: ACTIVE
Live URL: https://install-availability-tracker.web.app/
Firebase project: install-availability-tracker
Repo: CMHeating/sales-tools
Plan: Firebase Spark-compatible

## Summary

The Install Availability Tracker is secured without Firebase Blaze, Cloud Functions, or Secret Manager.

The existing HCA Toolkit link remains unchanged:

https://install-availability-tracker.web.app/

The tracker uses:

- Firebase Hosting for the live page
- Firebase Authentication Email/Password behind a name + PIN login flow
- Firebase Realtime Database rules for access control
- Real CM Heating emails for approved users

## Working Directory

Commands below use the Mac Mini checkout:

    cd ~/code/sales-tools

Earlier revisions of this runbook used `/workspaces/sales-tools`, the GitHub Codespaces
path. If you are working in a Codespace, substitute that path throughout.

## Verified Working State

Confirmed working:

- Admin login works
- HCA login works
- Firebase Auth users were created
- Real CM Heating emails are used
- Firebase Hosting deploy completed
- Existing HCA Toolkit link stays unchanged

The deployed database rule state is tracked in the private HANDOFFS notes, not here.
Do not assume the rules in this repo are the rules that are live — confirm in the
Firebase console before relying on them.

## Login Flow

Users log in with name + PIN.

Admins and HCAs open:

https://install-availability-tracker.web.app/

Then:

1. Click ADMIN / HCA EDIT
2. Enter first name
3. Enter normal PIN

Expected examples:

ADMIN:
EXIT - ADMIN: Geoff

HCA:
EXIT - HCA: Kyle

Joe and Joseph should type their full first name because partial names like Jo are ambiguous.

## Approved Admins

| Name | Email |
|---|---|
| Geoff | geoffrey.simons@cmheating.com |
| Amy | amy@cmheating.com |
| Laura | laura.weiss@cmheating.com |
| Jazryn | jazryn.delacruz@cmheating.com |
| Sabrina | sabrina.kennard@cmheating.com |
| Jen | jennifer@cmheating.com |
| Brittny | bmiller@cmheating.com |
| Vanessa | vanessa.williams@cmheating.com |

## Approved HCAs

| Name | Email |
|---|---|
| Amber | amber.maddalena@cmheating.com |
| Chester | chester.granard@cmheating.com |
| Davis | davis.diosdado@cmheating.com |
| Jay | javierre.milo@cmheating.com |
| Joe | jchounramany@cmheating.com |
| Joseph | joseph.ruble@cmheating.com |
| Kyle | kmcalister@cmheating.com |
| Samir | samir.khoury@cmheating.com |
| Trevor | trevor.bohm@cmheating.com |
| Adam | adam@cmheating.com |

## Permission Model

This table describes the model the rules in this repo are written to enforce.
It is the intended design, not a statement about what is currently deployed.

| Action | Admin | HCA | Public |
|---|---:|---:|---:|
| Open tracker page | Yes | Yes | Yes |
| Read schedule data | Yes | Yes | No |
| Read availability data | Yes | Yes | No |
| Edit availability | Yes | Yes | No |
| Write audit log | Yes | Yes | No |
| Read audit log | Yes | No | No |
| Edit master schedule | Yes | No | No |
| Place HOLD status | Yes | No | No |
| Move jobs | Yes | No | No |

## Important Files

Secure tracker source (generated):

install-availability-secure.html

Spark database rules (generated):

database.install-availability.spark.rules.json

Approved user map (the canonical roster — edit here):

scripts/install-availability-users.spark.js

Secure page/rules builder:

scripts/build-install-availability-spark.js

Firebase Auth user creator:

scripts/create-install-auth-users-spark.js

Legacy PIN extractor:

scripts/extract-install-pins.js

## Firebase Database Paths

The tracker uses these Realtime Database paths:

- cmh_schedule
- cmh_availability
- cmh_edit_locks
- cmh_audit_logs

## Rebuild Secure Tracker

Run:

    cd ~/code/sales-tools
    node scripts/build-install-availability-spark.js

This regenerates `install-availability-secure.html` and
`database.install-availability.spark.rules.json` from the roster.

It does NOT produce the live page. See the next section.

## Create or Verify Auth Users

Run only after Email/Password is enabled in Firebase Authentication:

    cd ~/code/sales-tools
    node scripts/create-install-auth-users-spark.js

Good output:

    CREATED
    EXISTS_OK
    Auth users ready.

This script only creates or verifies. It has no delete path — removing a user is a manual
action in the Firebase console. It also reads every PIN from `pin-config.private.json` and
provisions the whole roster, so it is a bulk tool. To add one person, use the console.

## Deploy Firebase Hosting

This keeps the original live URL:

https://install-availability-tracker.web.app/

### Merge onto the live page. Never overwrite it with the generated file.

`install-availability-secure.html` is generated from `install-availability.html` plus the
roster. **The live page is not built from it** and carries changes the generator cannot
reproduce.

Measured 2026-09-06: the previous procedure, `cp install-availability-secure.html
firebase-hosting-install/index.html`, would have replaced the live 98,352-byte page with an
83,147-byte one — removing 571 lines of working features. Until the two sources are
reconciled (see "Reconcile The Page Lineages"), **every deploy starts by downloading what is
already live.**

Step 1 — take the live page as the base:

    cd ~/code/sales-tools

    rm -rf firebase-hosting-install
    mkdir -p firebase-hosting-install
    curl -fsS https://install-availability-tracker.web.app/ -o firebase-hosting-install/index.html
    cp firebase-hosting-install/index.html /tmp/live-before.html

Step 2 — confirm you fetched a real page, not an error body:

    wc -c firebase-hosting-install/index.html
    grep -c "INSTALL_USERS" firebase-hosting-install/index.html

The byte count should be close to the current live size, and the grep must return at least 1.
If either looks wrong, stop — do not deploy a failed download.

Step 3 — apply ONLY the intended edits to `firebase-hosting-install/index.html`.

Edit that file in place. Roster entries in the live page are JSON-shaped objects:

    {
      "role": "ADMIN",
      "name": "Vanessa",
      "email": "vanessa.williams@cmheating.com"
    },

Step 4 — prove nothing else moved:

    diff /tmp/live-before.html firebase-hosting-install/index.html

**Read that diff.** It must show your intended edits and nothing else. If it shows hundreds
of changed lines, stop — you have replaced the page instead of editing it.

Step 5 — deploy:

    cat > firebase.hosting-install-only.json <<'JSON'
    {
      "hosting": {
        "public": "firebase-hosting-install",
        "ignore": [
          "firebase.json",
          "**/.*",
          "**/node_modules/**"
        ]
      }
    }
    JSON

    firebase --project install-availability-tracker --config firebase.hosting-install-only.json deploy --only hosting

Step 6 — verify what actually shipped:

    curl -fsS https://install-availability-tracker.web.app/ -o /tmp/live-after.html
    diff firebase-hosting-install/index.html /tmp/live-after.html

That diff must be empty. If it is not, the deploy did not ship what you built.

### If the deploy fails on authentication

    Authentication Error: Your credentials are no longer valid.

`firebase login` can report "Already logged in" while holding a stale credential. Fix with:

    firebase login --reauth

A trailing `Assertion failed: resolving hosting target of a site with no site name` is
usually a cascade from that auth failure, not a config problem. Reauth first, then retry.

### Never run a bare `firebase deploy` in this repo

The default `firebase.json` points `database.rules` at `database.rules.json` — the general
rules file, not the Spark one — and sets hosting `public` to `.`, the whole repo. Always
pass an explicit `--config` and `--only`, as every command in this runbook does.

## Reconcile The Page Lineages

Open item. Two files claim to be the install availability page:

- `firebase-hosting-install/index.html` — what is actually live. Tracked until commit
  `eefd85c` (2026-08-01), which untracked the directory so deploys could not destroy tracked
  files. The side effect is that the deployed artifact left version control and has been
  edited directly since.
- `install-availability-secure.html` — generated from `install-availability.html` plus the
  roster. It has never contained the live page's later features.

The merge procedure above is a safe workaround, not a fix. Resolve it one of two ways:

1. Fold the missing features back into `install-availability.html` so the builder reproduces
   the live page, then return to a plain generated deploy; or
2. Retire the builder for this page and treat the deployed file as canonical, restoring it to
   version control.

The last tracked copy is recoverable:

    git show eefd85c^:firebase-hosting-install/index.html

## Deploy Database Rules

Only deploy rules after Admin and HCA login have been verified.

Check the current live rules in the Firebase console before deploying, and confirm the change
you are about to make is the change you intend. A rules deploy replaces the whole ruleset.

    cd ~/code/sales-tools

    cat > firebase.database-spark-only.json <<'JSON'
    {
      "database": {
        "rules": "database.install-availability.spark.rules.json"
      }
    }
    JSON

    firebase --project install-availability-tracker --config firebase.database-spark-only.json deploy --only database

Immediately after deploying, have one Admin and one HCA load the page and confirm schedule
data appears. Signing in successfully is not sufficient — a rules problem lets a user
authenticate and then shows them no data.

Have the Emergency Rollback block below open before you start.

## Emergency Rollback

Only use this if valid Admin/HCA login fails and the tracker cannot load data.

This temporarily reopens the database and should only be used for emergency recovery.

    cd ~/code/sales-tools

    cat > database.install-availability.rollback-open.rules.json <<'JSON'
    {
      "rules": {
        ".read": true,
        ".write": true
      }
    }
    JSON

    cat > firebase.database-rollback-open.json <<'JSON'
    {
      "database": {
        "rules": "database.install-availability.rollback-open.rules.json"
      }
    }
    JSON

    firebase --project install-availability-tracker --config firebase.database-rollback-open.json deploy --only database

After rollback, fix the login issue and redeploy the Spark rules. Do not leave the open rules
in place any longer than the repair takes.

## Security Notes

The page contains approved names and emails, but it does not contain the old PIN map.

PINs are verified by Firebase Authentication as passwords.

Do not commit private PIN files.

Do not paste PIN config files into chat, Slack, email, or tickets.

Private local files should remain uncommitted:

- pin-config.private.json
- install-secret-one-line.private.txt
- install-auth-users.spark.private.json
- firebase-hosting-install/
- firebase.hosting-install-only.json
- firebase.database-spark-only.json

## If a User Leaves

**Step 1 is the one that actually removes access.** The roster and rules decide whose name is
offered and which addresses are listed; the Firebase Auth account decides whether anyone can
authenticate at all. Removing someone from the roster while their account still exists does
not lock them out.

1. Disable or delete their Firebase Auth user.
2. Remove them from `scripts/install-availability-users.spark.js`.
3. Rebuild: `node scripts/build-install-availability-spark.js`.
4. Deploy hosting using the merge procedure above — download live, remove their roster entry,
   diff, deploy.
5. Deploy database rules.
6. Confirm the removal in the Firebase Authentication console. The repo cannot show you Auth
   state, and nothing in a `git diff` will tell you whether step 1 happened.

Check for duplicate accounts while you are there. A misspelled address can leave a second
working account behind that masks the error — this happened with `kmcalistar@` versus
`kmcalister@`, discovered 2026-09-06.

## If a PIN Changes

1. Update the local private PIN config.
2. Reset that user's Firebase Auth password to match the new PIN pattern.
3. Re-test login.
4. No database rule change is needed unless the email changes.

## Final Verified Status

Install Availability is secured on Firebase Spark.

Admin and HCA login confirmed working.

Original HCA Toolkit Firebase link remains unchanged.

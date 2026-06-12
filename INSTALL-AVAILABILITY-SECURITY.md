# Install Availability Security

Status: ACTIVE
Live URL: https://install-availability-tracker.web.app/
Firebase project: install-availability-tracker
Repo: CMHeating/sales-tools
Plan: Firebase Spark-compatible

## Summary

The Install Availability Tracker is now secured without Firebase Blaze, Cloud Functions, or Secret Manager.

The existing HCA Toolkit link remains unchanged:

https://install-availability-tracker.web.app/

The tracker now uses:

- Firebase Hosting for the live page
- Firebase Authentication Email/Password behind a name + PIN login flow
- Firebase Realtime Database rules for Admin/HCA access control
- Real CM Heating emails for approved users

## Verified Working State

Confirmed working:

- Admin login works
- HCA login works
- Firebase Auth users were created
- Real CM Heating emails are used
- Firebase Hosting deploy completed
- Realtime Database rules deployed successfully
- Public anonymous database access is no longer open
- Existing HCA Toolkit link stays unchanged

## Login Flow

Users still log in with name + PIN.

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
| Lily | lily.sarrazin@cmheating.com |
| Jen | jennifer@cmheating.com |
| Brittny | bmiller@cmheating.com |

## Approved HCAs

| Name | Email |
|---|---|
| Amber | amber.maddalena@cmheating.com |
| Chester | chester.granard@cmheating.com |
| Davis | davis.diosdado@cmheating.com |
| Jay | javierre.milo@cmheating.com |
| Joe | jchounramany@cmheating.com |
| Joseph | joseph.ruble@cmheating.com |
| Kyle | kmcalistar@cmheating.com |
| Samir | samir.khoury@cmheating.com |
| Trevor | trevor.bohm@cmheating.com |

## Permission Model

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

Secure tracker source:

install-availability-secure.html

Spark database rules:

database.install-availability.spark.rules.json

Approved user map:

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

    cd /workspaces/sales-tools
    node scripts/build-install-availability-spark.js

## Create or Verify Auth Users

Run only after Email/Password is enabled in Firebase Authentication:

    cd /workspaces/sales-tools
    node scripts/create-install-auth-users-spark.js

Good output:

    CREATED
    EXISTS_OK
    Auth users ready.

## Deploy Firebase Hosting

This keeps the original live URL:

https://install-availability-tracker.web.app/

    cd /workspaces/sales-tools

    rm -rf firebase-hosting-install
    mkdir -p firebase-hosting-install

    cp install-availability-secure.html firebase-hosting-install/index.html

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

## Deploy Database Rules

Only deploy rules after Admin and HCA login have been verified.

    cd /workspaces/sales-tools

    cat > firebase.database-spark-only.json <<'JSON'
    {
      "database": {
        "rules": "database.install-availability.spark.rules.json"
      }
    }
    JSON

    firebase --project install-availability-tracker --config firebase.database-spark-only.json deploy --only database

## Emergency Rollback

Only use this if valid Admin/HCA login fails and the tracker cannot load data.

This temporarily reopens the database and should only be used for emergency recovery.

    cd /workspaces/sales-tools

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

After rollback, fix the secure login issue and redeploy the Spark rules.

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

1. Disable or delete their Firebase Auth user.
2. Remove them from scripts/install-availability-users.spark.js.
3. Rebuild the secure tracker and rules.
4. Deploy hosting.
5. Deploy database rules.

## If a PIN Changes

1. Update the local private PIN config.
2. Reset that user's Firebase Auth password to match the new PIN pattern.
3. Re-test login.
4. No database rule change is needed unless the email changes.

## Final Verified Status

Install Availability is secured on Firebase Spark.

Admin and HCA login confirmed working.

Original HCA Toolkit Firebase link remains unchanged.

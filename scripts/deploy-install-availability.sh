#!/bin/zsh
# Deploy the Install Availability page with the deploy-only service account (no personal Firebase login).
# Runbook steps 5-6 of INSTALL-AVAILABILITY-SECURITY.md. Expects firebase-hosting-install/ already built
# (step 1-4: live page as base, intended edits only, diff read). claude-16 2026-11-11, Geoff "Option 2".
set -euo pipefail
KEY="$HOME/.config/cmh/ia-hosting-deployer.json"
cd "$(dirname "$0")/.."
[[ -f "$KEY" ]] || { echo "Missing key $KEY (see INSTALL-AVAILABILITY-SECURITY.md, Deploy credentials)"; exit 2; }
[[ -f firebase-hosting-install/index.html && -f firebase-hosting-install/audit.html ]] || { echo "firebase-hosting-install/ must hold index.html AND audit.html"; exit 2; }
grep -q INSTALL_USERS firebase-hosting-install/index.html || { echo "index.html has no INSTALL_USERS: not a real page"; exit 2; }
export GOOGLE_APPLICATION_CREDENTIALS="$KEY"
# Hide any personal firebase login so the CLI can only use the service account key.
export XDG_CONFIG_HOME="$(mktemp -d)"; trap 'rm -rf "$XDG_CONFIG_HOME"' EXIT
firebase --project install-availability-tracker --config firebase.hosting-install-only.json deploy --only hosting --non-interactive
sleep 5
curl -fsS https://install-availability-tracker.web.app/ -o /tmp/live-after.html
if diff -q firebase-hosting-install/index.html /tmp/live-after.html >/dev/null; then echo "LIVE MATCHES BUILD"; else echo "LIVE DIFFERS FROM BUILD"; exit 1; fi
code=$(curl -s -o /dev/null -w '%{http_code}' https://install-availability-tracker.web.app/audit.html)
echo "audit.html $code"; [[ "$code" == 200 ]]

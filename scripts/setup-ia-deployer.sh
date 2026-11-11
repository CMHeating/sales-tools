#!/bin/zsh
# ONE-TIME, run by Geoff in Terminal: creates the deploy-only service account for Install Availability Hosting
# and stores its key outside every repo. claude-16 2026-11-11 (Geoff "Option 2"). Safe to re-run: skips what exists.
set -euo pipefail
P=install-availability-tracker
SA=ia-hosting-deployer
EMAIL="$SA@$P.iam.gserviceaccount.com"
KEY="$HOME/.config/cmh/ia-hosting-deployer.json"
mkdir -p "$HOME/.config/cmh" && chmod 700 "$HOME/.config/cmh"

gcloud iam service-accounts describe "$EMAIL" --project "$P" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA" --project "$P" \
       --display-name "Install Availability Hosting deployer (Mac mini)"
# One role only: publish Hosting. No database, Auth or rules access.
gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$EMAIL" \
  --role roles/firebasehosting.admin --condition=None >/dev/null
if [[ ! -f "$KEY" ]]; then
  ( umask 077; gcloud iam service-accounts keys create "$KEY" --iam-account "$EMAIL" --project "$P" )
fi
chmod 600 "$KEY"
echo "DONE: $EMAIL with roles/firebasehosting.admin; key at $KEY (600)"

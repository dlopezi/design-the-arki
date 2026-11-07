#!/usr/bin/env bash
#
# One-time Google Cloud setup so GitHub Actions can deploy the game to Firebase Hosting.
# Same recipe as System Defense ("Defend the Arki", startupvsworld/system-defense).
#
# - Uses Workload Identity Federation: GitHub gets a short-lived token from Google.
#   No service account key is created or stored anywhere.
# - Only the `main` branch of this repository can deploy.
# - Safe to run again: each step checks first and skips what already exists.
#
# Before running it:
#   1. The GCP project exists, without billing (see docs/deployment.md).
#      Use a project of its own, not defend-the-arki: a deploy without a site name
#      replaces the project's default site, which is System Defense there.
#   2. Firebase is added to the project (Firebase console → Add project → pick it).
#   3. You are logged in: `gcloud auth login` and `gh auth login`.
#
# Usage: PROJECT_ID=<project-id> scripts/setup-gcp.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID to the Google Cloud project id, for example: PROJECT_ID=my-project scripts/setup-gcp.sh}"
REPO="${REPO:-dlopezi/archi-game}"
BRANCH="${BRANCH:-main}"
POOL="github"
PROVIDER="github"
SA_NAME="github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

step() { printf '\n==> %s\n' "$1"; }

step "Project ${PROJECT_ID}"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
REPO_OWNER_ID="$(gh api "repos/${REPO}" --jq '.owner.id')"
echo "number ${PROJECT_NUMBER}, GitHub owner id ${REPO_OWNER_ID}"

step "Enable the APIs (all free, no billing needed)"
gcloud services enable --project "$PROJECT_ID" \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com

step "Workload Identity pool '${POOL}'"
if ! gcloud iam workload-identity-pools describe "$POOL" --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location=global --project "$PROJECT_ID" \
    --display-name="GitHub Actions"
fi

step "OIDC provider '${PROVIDER}' (only ${REPO}, branch ${BRANCH})"
# The owner id check stops a renamed or re-created account with the same name from deploying.
CONDITION="assertion.repository == '${REPO}' && assertion.repository_owner_id == '${REPO_OWNER_ID}' && assertion.ref == 'refs/heads/${BRANCH}'"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool="$POOL" \
  --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool="$POOL" --location=global --project "$PROJECT_ID" \
    --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="$CONDITION"
fi

step "Service account ${SA_EMAIL}"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" \
    --display-name="GitHub deploy (Firebase Hosting)"
fi

step "Roles: deploy to Hosting only"
for role in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition=None --quiet \
    --member="serviceAccount:${SA_EMAIL}" --role="$role" >/dev/null
  echo "$role"
done

step "Let GitHub Actions of ${REPO} act as the service account"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" --project "$PROJECT_ID" --quiet \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  >/dev/null

step "GitHub repository variables (not secrets: they are only names)"
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
gh variable set GCP_PROJECT_ID --repo "$REPO" --body "$PROJECT_ID"
gh variable set GCP_WIF_PROVIDER --repo "$REPO" --body "$WIF_PROVIDER"
gh variable set GCP_DEPLOY_SA --repo "$REPO" --body "$SA_EMAIL"

step "Done"
echo "Push to ${BRANCH}: the 'deploy' job publishes to https://${PROJECT_ID}.web.app"

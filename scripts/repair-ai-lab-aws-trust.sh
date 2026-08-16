#!/usr/bin/env bash
set -euo pipefail

ACCOUNT_ID="791860731989"
POLICY_FILE="infrastructure/iam/sozorock-ai-lab-github-trust.json"

actual_account=$(aws sts get-caller-identity --query Account --output text)
[[ "$actual_account" == "$ACCOUNT_ID" ]]

role_name="${AI_LAB_DEPLOY_ROLE_NAME:?AI_LAB_DEPLOY_ROLE_NAME is required}"
[[ "$role_name" =~ ^[A-Za-z0-9+=,.@_-]{1,64}$ ]]

# Deliberately address one configured role. The repair authority must grant
# iam:GetRole and iam:UpdateAssumeRolePolicy only for this role's exact ARN.
aws iam get-role --role-name "$role_name" >/dev/null

aws iam update-assume-role-policy \
  --role-name "$role_name" \
  --policy-document "file://${POLICY_FILE}"

role_json=$(aws iam get-role --role-name "$role_name" --output json)
jq -e '
  .Role.AssumeRolePolicyDocument.Statement[]
  | select(.Action == "sts:AssumeRoleWithWebIdentity")
  | .Condition.StringLike["token.actions.githubusercontent.com:sub"]
  | index("repo:drolu-cmyk/sozorock-ai-lab:environment:production") != null
' <<<"$role_json" >/dev/null

printf '%s\n' "$role_name"

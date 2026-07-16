#!/usr/bin/env bash
set -euo pipefail

ACCOUNT_ID="791860731989"
POLICY_FILE="infrastructure/iam/sozorock-ai-lab-github-trust.json"

actual_account=$(aws sts get-caller-identity --query Account --output text)
[[ "$actual_account" == "$ACCOUNT_ID" ]]

role_name="GitHubActionsSozorockAiLabDeployRole"
if ! aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
  mapfile -t candidates < <(
    aws iam list-roles \
      --query "Roles[?contains(RoleName, 'AiLab') || contains(RoleName, 'AILab') || contains(RoleName, 'AI-Lab') || contains(RoleName, 'SozorockAi') || contains(RoleName, 'SozoRockAi')].RoleName" \
      --output text | tr '\t' '\n' | sed '/^$/d' | sort -u
  )
  [[ "${#candidates[@]}" -eq 1 ]]
  role_name="${candidates[0]}"
fi

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

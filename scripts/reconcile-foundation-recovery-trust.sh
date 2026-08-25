#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
backup_dir="${2:-}"
account_id="${EXPECTED_AWS_ACCOUNT_ID:-791860731989}"
helper_role="cbcap-agentic-github-deploy"
helper_policy="CbcapAgenticRelease"
ai_lab_role="GitHubActionsSozorockAiLabDeployRole"
health_agentic_subject="repo:drolu-cmyk/sozorock-health-agentic:environment:production"
health_subject="repo:drolu-cmyk/sozorock-health:environment:production"
foundation_subject="repo:drolu-cmyk/sozorock-foundation:ref:refs/heads/main"
ai_lab_environment_subject="repo:drolu-cmyk/sozorock-ai-lab:environment:production"
ai_lab_main_subject="repo:drolu-cmyk/sozorock-ai-lab:ref:refs/heads/main"

require_account() {
  test "$(aws sts get-caller-identity --query Account --output text)" = "$account_id"
}

bridge() {
  test -n "$backup_dir"
  mkdir -p "$backup_dir"
  require_account

  aws iam get-role --role-name "$helper_role" --query 'Role.AssumeRolePolicyDocument' --output json > "$backup_dir/helper-trust.json"
  aws iam get-role-policy --role-name "$helper_role" --policy-name "$helper_policy" --query 'PolicyDocument' --output json > "$backup_dir/helper-policy.json"
  jq -e 'type == "object"' "$backup_dir/helper-trust.json" >/dev/null
  jq -e 'type == "object"' "$backup_dir/helper-policy.json" >/dev/null

  original_subject="$(jq -r '.Statement[] | select(.Action == "sts:AssumeRoleWithWebIdentity") | .Condition.StringEquals["token.actions.githubusercontent.com:sub"]' "$backup_dir/helper-trust.json")"
  test "$original_subject" = "$health_agentic_subject"
  if jq -e '.Statement[]? | select(.Sid == "RepairOnlyAiLabTrustForFoundationRecovery")' "$backup_dir/helper-policy.json" >/dev/null; then
    echo 'Temporary Foundation recovery permission already exists; refusing ambiguous bridge state.' >&2
    exit 1
  fi

  jq \
    --arg original "$health_agentic_subject" \
    --arg temporary "$health_subject" \
    '(.Statement[] | select(.Action == "sts:AssumeRoleWithWebIdentity") | .Condition.StringEquals["token.actions.githubusercontent.com:sub"]) = [$original, $temporary]' \
    "$backup_dir/helper-trust.json" > "$backup_dir/helper-trust-temporary.json"

  jq \
    --arg resource "arn:aws:iam::${account_id}:role/${ai_lab_role}" \
    '.Statement += [{
      "Sid":"RepairOnlyAiLabTrustForFoundationRecovery",
      "Effect":"Allow",
      "Action":["iam:GetRole","iam:UpdateAssumeRolePolicy"],
      "Resource":$resource
    }]' \
    "$backup_dir/helper-policy.json" > "$backup_dir/helper-policy-temporary.json"

  aws iam update-assume-role-policy --role-name "$helper_role" --policy-document "file://$backup_dir/helper-trust-temporary.json"
  aws iam put-role-policy --role-name "$helper_role" --policy-name "$helper_policy" --policy-document "file://$backup_dir/helper-policy-temporary.json"

  current_trust="$(aws iam get-role --role-name "$helper_role" --query 'Role.AssumeRolePolicyDocument' --output json)"
  jq -e --arg first "$health_agentic_subject" --arg second "$health_subject" '
    ([.Statement[] | select(.Action == "sts:AssumeRoleWithWebIdentity") | .Condition.StringEquals["token.actions.githubusercontent.com:sub"][]] | sort)
    == ([$first, $second] | sort)
  ' <<<"$current_trust" >/dev/null
  current_policy="$(aws iam get-role-policy --role-name "$helper_role" --policy-name "$helper_policy" --query 'PolicyDocument' --output json)"
  jq -e --arg resource "arn:aws:iam::${account_id}:role/${ai_lab_role}" '
    any(.Statement[];
      .Sid == "RepairOnlyAiLabTrustForFoundationRecovery" and
      .Effect == "Allow" and
      (.Action | sort) == (["iam:GetRole","iam:UpdateAssumeRolePolicy"] | sort) and
      .Resource == $resource)
  ' <<<"$current_policy" >/dev/null
}

repair() {
  trust_file="${FOUNDATION_AI_LAB_TRUST_FILE:-infrastructure/iam/sozorock-ai-lab-github-trust.json}"
  require_account
  test -f "$trust_file"
  jq -e \
    --arg foundation "$foundation_subject" \
    --arg environment "$ai_lab_environment_subject" \
    --arg main "$ai_lab_main_subject" '
      .Version == "2012-10-17" and
      (.Statement | length) == 1 and
      .Statement[0].Action == "sts:AssumeRoleWithWebIdentity" and
      .Statement[0].Principal.Federated == "arn:aws:iam::791860731989:oidc-provider/token.actions.githubusercontent.com" and
      .Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" and
      (.Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"] | sort) == ([$foundation,$environment,$main] | sort)
    ' "$trust_file" >/dev/null

  aws iam get-role --role-name "$ai_lab_role" >/dev/null
  aws iam update-assume-role-policy --role-name "$ai_lab_role" --policy-document "file://$trust_file"
  actual="$(aws iam get-role --role-name "$ai_lab_role" --query 'Role.AssumeRolePolicyDocument' --output json)"
  expected="$(jq -c '.Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"] | sort' "$trust_file")"
  received="$(jq -c '.Statement[] | select(.Action == "sts:AssumeRoleWithWebIdentity") | .Condition.StringLike["token.actions.githubusercontent.com:sub"] | sort' <<<"$actual")"
  test "$received" = "$expected"
}

restore() {
  test -n "$backup_dir"
  test -s "$backup_dir/helper-trust.json"
  test -s "$backup_dir/helper-policy.json"
  require_account
  aws iam update-assume-role-policy --role-name "$helper_role" --policy-document "file://$backup_dir/helper-trust.json"
  aws iam put-role-policy --role-name "$helper_role" --policy-name "$helper_policy" --policy-document "file://$backup_dir/helper-policy.json"

  restored_trust="$(aws iam get-role --role-name "$helper_role" --query 'Role.AssumeRolePolicyDocument' --output json)"
  restored_subject="$(jq -r '.Statement[] | select(.Action == "sts:AssumeRoleWithWebIdentity") | .Condition.StringEquals["token.actions.githubusercontent.com:sub"]' <<<"$restored_trust")"
  test "$restored_subject" = "$health_agentic_subject"
  restored_policy="$(aws iam get-role-policy --role-name "$helper_role" --policy-name "$helper_policy" --query 'PolicyDocument' --output json)"
  if jq -e '.Statement[]? | select(.Sid == "RepairOnlyAiLabTrustForFoundationRecovery")' <<<"$restored_policy" >/dev/null; then
    echo 'Temporary Foundation recovery permission remained after cleanup.' >&2
    exit 1
  fi
}

case "$mode" in
  bridge) bridge ;;
  repair) repair ;;
  restore) restore ;;
  *) echo 'Usage: reconcile-foundation-recovery-trust.sh {bridge|repair|restore} [backup-dir]' >&2; exit 64 ;;
esac

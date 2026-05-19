#!/usr/bin/env bash
# Provision AkiliRisk Cognito user pools (test + production) and web app clients.
#
# Usage (from repo root):
#   unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
#   AWS_PROFILE=root-user ./scripts/aws/create-cognito-pools.sh
#   (IAM users like buddy@ebilly.com need cognito-idp:CreateUserPool on the account.)
#
# Region: AWS_REGION or us-east-2 (matches app defaults).
# Output: scripts/aws/cognito-pools.manifest.json (pool + client IDs; no secrets).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
PROFILE="${AWS_PROFILE:-root-user}"
MANIFEST="${ROOT}/scripts/aws/cognito-pools.manifest.json"

export AWS_PROFILE="$PROFILE"
export AWS_DEFAULT_REGION="$REGION"

aws_cli() {
  aws "$@"
}

TMPDIR_JSON="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_JSON"' EXIT

write_json() {
  local path="$1"
  shift
  printf '%s' "$@" >"$path"
}

PASSWORD_POLICY_FILE="${TMPDIR_JSON}/password-policy.json"
write_json "$PASSWORD_POLICY_FILE" '{
  "PasswordPolicy": {
    "MinimumLength": 12,
    "RequireUppercase": true,
    "RequireLowercase": true,
    "RequireNumbers": true,
    "RequireSymbols": true,
    "TemporaryPasswordValidityDays": 7
  }
}'

pool_exists() {
  local name="$1"
  aws_cli cognito-idp list-user-pools --max-results 60 \
    --query "UserPools[?Name=='${name}'].Id | [0]" --output text 2>/dev/null \
    | grep -v '^None$' || true
}

create_pool() {
  local pool_name="$1"
  local env_tag="$2"
  local existing
  existing="$(pool_exists "$pool_name")"
  if [[ -n "$existing" && "$existing" != "None" ]]; then
    echo "User pool already exists: $pool_name ($existing)" >&2
    echo "$existing"
    return
  fi

  local recovery_file="${TMPDIR_JSON}/recovery-${env_tag}.json"
  local admin_file="${TMPDIR_JSON}/admin-${env_tag}.json"
  write_json "$recovery_file" '{
  "RecoveryMechanisms": [
    { "Name": "verified_email", "Priority": 1 }
  ]
}'
  write_json "$admin_file" '{ "AllowAdminCreateUserOnly": false }'
  aws_cli cognito-idp create-user-pool \
    --pool-name "$pool_name" \
    --policies "file://${PASSWORD_POLICY_FILE}" \
    --auto-verified-attributes email \
    --username-attributes email \
    --username-configuration CaseSensitive=false \
    --account-recovery-setting "file://${recovery_file}" \
    --admin-create-user-config "file://${admin_file}" \
    --mfa-configuration "OFF" \
    --user-pool-tags "Environment=${env_tag},Application=akili-risk,ManagedBy=scripts/aws/create-cognito-pools.sh" \
    --query 'UserPool.Id' --output text
}

create_web_client() {
  local pool_id="$1"
  local client_name="$2"
  local env_tag="$3"

  write_json "${TMPDIR_JSON}/token-units.json" '{
  "AccessToken": "hours",
  "IdToken": "hours",
  "RefreshToken": "days"
}'

  # Idempotent: return existing client id if name matches
  local existing_id
  existing_id="$(aws_cli cognito-idp list-user-pool-clients \
    --user-pool-id "$pool_id" --max-results 60 \
    --query "UserPoolClients[?ClientName=='${client_name}'].ClientId | [0]" \
    --output text 2>/dev/null || true)"
  if [[ -n "$existing_id" && "$existing_id" != "None" ]]; then
    echo "App client already exists: $client_name ($existing_id)" >&2
    echo "$existing_id"
    return
  fi

  aws_cli cognito-idp create-user-pool-client \
    --user-pool-id "$pool_id" \
    --client-name "$client_name" \
    --no-generate-secret \
    --prevent-user-existence-errors ENABLED \
    --enable-token-revocation \
    --explicit-auth-flows \
      ALLOW_USER_SRP_AUTH \
      ALLOW_REFRESH_TOKEN_AUTH \
      ALLOW_USER_PASSWORD_AUTH \
      ALLOW_ADMIN_USER_PASSWORD_AUTH \
    --supported-identity-providers COGNITO \
    --allowed-o-auth-flows-user-pool-client \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes openid email profile \
    --callback-urls \
      "http://localhost:3000/api/auth/callback/cognito" \
      "https://preview.akilirisk.com/api/auth/callback/cognito" \
      "https://akilirisk.com/api/auth/callback/cognito" \
    --logout-urls \
      "http://localhost:3000/signin" \
      "https://preview.akilirisk.com/signin" \
      "https://akilirisk.com/signin" \
    --access-token-validity 1 \
    --id-token-validity 1 \
    --refresh-token-validity 30 \
    --token-validity-units "file://${TMPDIR_JSON}/token-units.json" \
    --query 'UserPoolClient.ClientId' --output text
}

echo "AWS identity:" >&2
aws_cli sts get-caller-identity >&2
echo "Region: $REGION" >&2

TEST_POOL_ID="$(create_pool "akili-risk-test" "test")"
PROD_POOL_ID="$(create_pool "akili-risk-production" "production")"

TEST_CLIENT_ID="$(create_web_client "$TEST_POOL_ID" "akili-risk-web" "test")"
PROD_CLIENT_ID="$(create_web_client "$PROD_POOL_ID" "akili-risk-web" "production")"

mkdir -p "$(dirname "$MANIFEST")"
cat >"$MANIFEST" <<EOF
{
  "region": "${REGION}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "issuerTest": "https://cognito-idp.${REGION}.amazonaws.com/${TEST_POOL_ID}",
  "issuerProduction": "https://cognito-idp.${REGION}.amazonaws.com/${PROD_POOL_ID}",
  "test": {
    "userPoolId": "${TEST_POOL_ID}",
    "userPoolName": "akili-risk-test",
    "webClientId": "${TEST_CLIENT_ID}",
    "webClientName": "akili-risk-web"
  },
  "production": {
    "userPoolId": "${PROD_POOL_ID}",
    "userPoolName": "akili-risk-production",
    "webClientId": "${PROD_CLIENT_ID}",
    "webClientName": "akili-risk-web"
  },
  "envHints": {
    "test": {
      "COGNITO_USER_POOL_ID": "${TEST_POOL_ID}",
      "COGNITO_CLIENT_ID": "${TEST_CLIENT_ID}",
      "COGNITO_REGION": "${REGION}"
    },
    "production": {
      "COGNITO_USER_POOL_ID": "${PROD_POOL_ID}",
      "COGNITO_CLIENT_ID": "${PROD_CLIENT_ID}",
      "COGNITO_REGION": "${REGION}"
    }
  }
}
EOF

echo "" >&2
echo "Wrote ${MANIFEST}" >&2
cat "$MANIFEST"

#!/usr/bin/env bash
set -euo pipefail

access_token="${1:-}"
test -n "$access_token"

secret="$(aws cognito-idp associate-software-token \
  --access-token "$access_token" \
  --query SecretCode \
  --output text)"
test -n "$secret"

# Avoid submitting a code generated in the final seconds of a TOTP window.
window_offset="$(( $(date +%s) % 30 ))"
if (( window_offset >= 25 )); then
  sleep "$((31 - window_offset))"
fi

totp="$(MFA_SECRET="$secret" python3 - <<'PY'
import base64
import hashlib
import hmac
import os
import struct
import time

secret = os.environ["MFA_SECRET"].strip().replace(" ", "").upper()
padding = "=" * ((8 - len(secret) % 8) % 8)
key = base64.b32decode(secret + padding)
counter = int(time.time()) // 30
message = struct.pack(">Q", counter)
digest = hmac.new(key, message, hashlib.sha1).digest()
offset = digest[-1] & 0x0F
value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
print(f"{value % 1_000_000:06d}")
PY
)"

case "$totp" in
  [0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo 'Generated authenticator code was invalid.' >&2; exit 1 ;;
esac

aws cognito-idp verify-software-token \
  --access-token "$access_token" \
  --user-code "$totp" \
  --friendly-device-name 'Foundation production smoke' \
  --query Status \
  --output text | grep -qx 'SUCCESS'

aws cognito-idp set-user-mfa-preference \
  --access-token "$access_token" \
  --software-token-mfa-settings Enabled=true,PreferredMfa=true >/dev/null

unset secret totp MFA_SECRET

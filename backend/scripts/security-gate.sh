#!/usr/bin/env bash
#
# Pre-deploy security gate. Non-destructive. Exits non-zero on a hard failure so
# it can block a CI/deploy pipeline. Run from the repo root:
#   bash backend/scripts/security-gate.sh
#
# Checks: committed secrets, dependency vulnerabilities, live TLS + security
# headers. (Cross-account authZ is covered by cross-account-test.sh against
# staging — wire that in separately so prod isn't polluted.)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0; warn=0
note(){ echo "  $*"; }

echo "== 1. Secret scan (tracked files only) =="
# Real secret value patterns (not config key names). Excludes build caches.
SECRET_RE='sk_live_[0-9A-Za-z]{10,}|sk_test_[0-9A-Za-z]{10,}|whsec_[0-9A-Za-z]{10,}|re_[0-9A-Za-z]{20,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----'
HITS=$(cd "$ROOT" && git grep -nIE "$SECRET_RE" -- ':!*.lock' ':!**/.angular/**' 2>/dev/null || true)
if [ -n "$HITS" ]; then echo "FAIL: possible committed secret:"; echo "$HITS" | sed 's/\(....\).*/\1***REDACTED***/'; fail=1; else note "OK — no secret patterns in tracked files"; fi

echo "== 2. Backend dependency vulnerabilities =="
if command -v dotnet >/dev/null; then
  ( cd "$ROOT/backend/Clarity.Api" && dotnet list package --vulnerable --include-transitive 2>/dev/null \
    | grep -E 'Critical|High' && { echo "WARN: high/critical NuGet advisory (review compensating controls)"; warn=1; } ) || note "OK — no high/critical NuGet"
fi

echo "== 3. Frontend dependency vulnerabilities =="
if command -v npm >/dev/null; then
  ( cd "$ROOT/frontend" && npm audit --omit=dev 2>/dev/null | grep -E 'critical|high' && { echo "WARN: high/critical npm advisory"; warn=1; } ) || note "OK — no high/critical npm"
fi

echo "== 4. Live TLS + security headers =="
URL="${CLARITY_URL:-https://clarityfinancialtools.com}"
RED=$(curl -s -o /dev/null -w '%{http_code}' "http://${URL#https://}/" || echo 000)
[ "$RED" = "308" ] || [ "$RED" = "301" ] || { echo "WARN: HTTP did not redirect to HTTPS ($RED)"; warn=1; }
H=$(curl -sI "$URL/" || true)
for hdr in strict-transport-security content-security-policy x-content-type-options x-frame-options referrer-policy; do
  echo "$H" | grep -qi "$hdr" && note "header $hdr present" || { echo "FAIL: missing header $hdr"; fail=1; }
done

echo ""
[ "$fail" = 0 ] && echo "SECURITY GATE: PASS${warn:+ (with warnings)}" || { echo "SECURITY GATE: FAIL"; exit 1; }

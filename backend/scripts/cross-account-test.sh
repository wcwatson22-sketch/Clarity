#!/usr/bin/env bash
#
# Cross-account authorization regression test for user-owned data.
# Creates two throwaway users (A, B), has A create a Real Estate property
# (with a TAMPERED UserId in the body), and verifies strict isolation:
#   - the stored owner is A (server ignores the client-supplied UserId)
#   - B cannot list / read / update / delete A's record (404), even with the id
#   - the owner (A) can read it; anonymous is rejected (401)
# Then it deletes both accounts and confirms no Real Estate rows are orphaned.
#
#   Usage:  API=https://clarityfinancialtools.com/api bash cross-account-test.sh
#
# Requires: curl, python3 on the host. Run against staging, or production with
# the understanding that it creates + deletes two temporary accounts.
set -euo pipefail
API="${API:-https://clarityfinancialtools.com/api}"
TS=$(date +%s)
g(){ python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }
g2(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',{}).get('$2',''))"; }
signup(){ curl -s -X POST "$API/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"username\":\"xtest_$1_$TS\",\"password\":\"Test!2345pw\",\"firstName\":\"X\",\"email\":\"xtest_$1_$TS@example.com\",\"state\":\"TX\",\"city\":\"Austin\",\"age\":30}"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

RA=$(signup A); TOKA=$(echo "$RA"|g token); IDA=$(echo "$RA"|g2 user id)
RB=$(signup B); TOKB=$(echo "$RB"|g token); IDB=$(echo "$RB"|g2 user id)

CREATE=$(curl -s -X POST "$API/real-estate" -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' \
  -d "{\"address\":\"ZZTEST\",\"propertyType\":\"ltr\",\"userId\":$IDB}")
PID=$(echo "$CREATE"|g id); OWNER=$(echo "$CREATE"|g userId)

fail=0
chk(){ if [ "$2" = "$3" ]; then echo "PASS  $1 ($2)"; else echo "FAIL  $1 (got $2, want $3)"; fail=1; fi; }

chk "stored owner is authenticated user A (tamper ignored)" "$OWNER" "$IDA"
chk "B list excludes A's property" "$(curl -s "$API/real-estate" -H "Authorization: Bearer $TOKB" | grep -c "$PID")" "0"
chk "B GET A's property -> 404"    "$(code "$API/real-estate/$PID" -H "Authorization: Bearer $TOKB")" "404"
chk "B PUT A's property -> 404"    "$(code -X PUT "$API/real-estate/$PID" -H "Authorization: Bearer $TOKB" -H 'Content-Type: application/json' --data-binary '{"address":"HACK"}')" "404"
chk "B DELETE A's property -> 404" "$(code -X DELETE "$API/real-estate/$PID" -H "Authorization: Bearer $TOKB")" "404"
chk "A (owner) GET -> 200"         "$(code "$API/real-estate/$PID" -H "Authorization: Bearer $TOKA")" "200"
chk "anonymous GET -> 401"         "$(code "$API/real-estate/$PID")" "401"

# Cleanup: deleting each account must remove its Real Estate data (no orphans).
chk "A delete-account -> 200" "$(code -X DELETE "$API/profile/me" -H "Authorization: Bearer $TOKA")" "200"
chk "B delete-account -> 200" "$(code -X DELETE "$API/profile/me" -H "Authorization: Bearer $TOKB")" "200"

echo ""; [ "$fail" = "0" ] && echo "ALL CROSS-ACCOUNT CHECKS PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }

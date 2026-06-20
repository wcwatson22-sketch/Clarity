#!/usr/bin/env bash
#
# Clarity API deploy. Publishes the build, stages it on the droplet, and runs
# the server-side apply step (preflight -> ownership-correct rsync -> restart ->
# health check -> rollback). Safe to re-run.
#
#   Usage:  bash backend/deploy.sh
#   Env overrides: CLARITY_SSH_KEY, CLARITY_SERVER
#
# Never prints secrets. Aborts before touching the service if the build fails.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$HERE/Clarity.Api"
SSH_KEY="${CLARITY_SSH_KEY:-$HOME/.ssh/clarity_deploy}"
SERVER="${CLARITY_SERVER:-root@206.81.14.66}"
PUB="$(mktemp -d)"
trap 'rm -rf "$PUB"' EXIT

echo "[deploy] publishing (Release)…"
dotnet publish "$API_DIR" -c Release -o "$PUB" --nologo -v q || { echo "[deploy] BUILD FAILED — aborting, service untouched"; exit 1; }
[ -f "$PUB/Clarity.Api.dll" ] || { echo "[deploy] publish produced no Clarity.Api.dll — aborting"; exit 1; }

echo "[deploy] staging to server…"
ssh -i "$SSH_KEY" "$SERVER" "rm -rf /tmp/clarity-publish && mkdir -p /tmp/clarity-publish"
scp -i "$SSH_KEY" -q -r "$PUB/." "$SERVER:/tmp/clarity-publish/"
scp -i "$SSH_KEY" -q "$HERE/scripts/remote-apply.sh" "$SERVER:/tmp/remote-apply.sh"

echo "[deploy] applying on server…"
# Strip any CR (in case of CRLF checkout) so the shebang/script run cleanly.
ssh -i "$SSH_KEY" "$SERVER" "sed -i 's/\r\$//' /tmp/remote-apply.sh && bash /tmp/remote-apply.sh"

echo "[deploy] done."

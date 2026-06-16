#!/usr/bin/env bash
set -e

SSH_KEY="$HOME/.ssh/clarity_deploy"
SERVER="root@206.81.14.66"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIST="$REPO_ROOT/frontend/dist/clarity-frontend/browser"
BACKEND_PUBLISH="/tmp/clarity-publish"

echo "[1/4] Uploading frontend..."
$SSH "sudo rm -rf /var/www/clarity/* && mkdir -p /tmp/clarity-web"
$SCP -r "$FRONTEND_DIST/." "$SERVER:/tmp/clarity-web/"
$SSH "sudo cp -r /tmp/clarity-web/. /var/www/clarity/ && sudo chown -R www-data:www-data /var/www/clarity && sudo chmod -R a+rX /var/www/clarity && rm -rf /tmp/clarity-web"
echo "  Frontend uploaded."

echo "[2/4] Uploading backend..."
$SSH "sudo systemctl stop clarity-api 2>/dev/null || true && mkdir -p /tmp/clarity-api-new"
$SCP -r "$BACKEND_PUBLISH/." "$SERVER:/tmp/clarity-api-new/"
$SSH "sudo cp -r /tmp/clarity-api-new/. /opt/clarity-api/ && sudo chown -R www-data:www-data /opt/clarity-api && rm -rf /tmp/clarity-api-new"
echo "  Backend uploaded."

echo "[3/4] Restarting services..."
$SSH "sudo systemctl daemon-reload && sudo systemctl enable clarity-api && sudo systemctl start clarity-api"
echo "  Services restarted."

echo "[4/4] Health check..."
sleep 5
STATUS=$($SSH "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/healthz" || echo "000")
echo "  Health: $STATUS"

echo ""
echo "Done! Visit https://clarityfinancialtools.com"

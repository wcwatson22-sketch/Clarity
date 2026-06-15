#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — Deploy Script
#
# Builds the frontend + backend and ships them to your VPS.
# Run this every time you want to push an update.
#
# Usage (from your LOCAL machine, from the repo root):
#   bash scripts/deploy.sh
#
# Prerequisites:
#   - scripts/deploy.conf is filled in
#   - server-setup.sh has been run once
#   - /etc/clarity/env on the server has all secrets filled in
#   - dotnet SDK, node, npm, scp, ssh are available locally
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/deploy.conf"

SSH_CMD="ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
SCP_CMD="scp -i $SSH_KEY"

BUILD_OUT="/tmp/clarity-publish"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Clarity Finance — Deploying to $DOMAIN"
echo "  Server: $SERVER_USER@$SERVER_IP"
echo "════════════════════════════════════════════════════════"
echo ""

for cmd in dotnet node npm scp ssh; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ Missing tool: $cmd — please install it first."
    exit 1
  fi
done

if [ "$SERVER_IP" = "1.2.3.4" ]; then
  echo "❌ deploy.conf still has a placeholder SERVER_IP."
  echo "   Fill in your actual VPS IP address in scripts/deploy.conf first."
  exit 1
fi

# Check secrets are filled in on the server
echo "[pre-flight] Checking server secrets..."
UNFILLED=$(($SSH_CMD "grep -c 'REPLACE_ME' $REMOTE_ENV_FILE 2>/dev/null" | tr -d '[:space:]') || echo "0")
UNFILLED="${UNFILLED:-0}"
# Use arithmetic comparison so "00", "0", "" all treated as zero
if [ $(( UNFILLED + 0 )) -gt 0 ]; then
  echo ""
  echo "  ⚠️  WARNING: $UNFILLED value(s) in $REMOTE_ENV_FILE still say REPLACE_ME."
  echo "  The app will fail to start until all secrets are filled in."
  echo ""
  read -r -p "  Continue anyway? (y/N) " choice
  [[ "$choice" =~ ^[Yy]$ ]] || exit 0
fi

echo ""
read -r -p "  Ready to deploy? Press Enter to continue, Ctrl+C to cancel..."
echo ""

# ── Step 1: Build frontend ────────────────────────────────────────────────────
echo "[1/5] Building Angular frontend..."
cd "$REPO_ROOT/frontend"
npm install --silent
npx ng build --configuration production
echo "  ✅ Frontend built → dist/clarity-frontend/browser/"

# ── Step 2: Build backend ─────────────────────────────────────────────────────
echo "[2/5] Publishing .NET backend..."
rm -rf "$BUILD_OUT"
cd "$REPO_ROOT/backend/Clarity.Api"
dotnet publish -c Release -o "$BUILD_OUT" --nologo -v quiet
echo "  ✅ Backend published → $BUILD_OUT"

# ── Step 3: Ship frontend ─────────────────────────────────────────────────────
echo "[3/5] Uploading frontend to server..."
# Clear existing files first, then upload
$SSH_CMD "sudo rm -rf $REMOTE_WEB_DIR/* && sudo mkdir -p $REMOTE_WEB_DIR && mkdir -p /tmp/clarity-web"
$SCP_CMD -r "$REPO_ROOT/frontend/dist/clarity-frontend/browser/." \
  "$SERVER_USER@$SERVER_IP:/tmp/clarity-web/"
$SSH_CMD "sudo cp -r /tmp/clarity-web/. $REMOTE_WEB_DIR/ && sudo chown -R www-data:www-data $REMOTE_WEB_DIR && rm -rf /tmp/clarity-web"
echo "  ✅ Frontend uploaded to $REMOTE_WEB_DIR"

# ── Step 4: Ship backend ──────────────────────────────────────────────────────
echo "[4/5] Uploading backend to server..."
$SSH_CMD "sudo systemctl stop clarity-api 2>/dev/null || true && mkdir -p /tmp/clarity-api-new"
$SCP_CMD -r "$BUILD_OUT/." "$SERVER_USER@$SERVER_IP:/tmp/clarity-api-new/"

# Copy backup + restore scripts alongside the app
mkdir -p "$BUILD_OUT/scripts"
cp "$SCRIPT_DIR/backup.sh" "$BUILD_OUT/scripts/"
cp "$SCRIPT_DIR/restore.sh" "$BUILD_OUT/scripts/"

$SSH_CMD "
  sudo cp -r /tmp/clarity-api-new/. $REMOTE_APP_DIR/
  sudo chown -R www-data:www-data $REMOTE_APP_DIR
  sudo chmod +x $REMOTE_APP_DIR/scripts/backup.sh $REMOTE_APP_DIR/scripts/restore.sh
  rm -rf /tmp/clarity-api-new
"
echo "  ✅ Backend uploaded to $REMOTE_APP_DIR"

# ── Step 5: Configure services and start ─────────────────────────────────────
echo "[5/5] Configuring services and starting app..."

# Deploy systemd service file
$SCP_CMD "$SCRIPT_DIR/clarity-api.service" "$SERVER_USER@$SERVER_IP:/tmp/clarity-api.service"
$SSH_CMD "
  sudo cp /tmp/clarity-api.service /etc/systemd/system/clarity-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable clarity-api
  sudo systemctl start clarity-api
"

# Deploy Caddyfile (substitute domain)
sed "s/__DOMAIN__/$DOMAIN/g" "$SCRIPT_DIR/Caddyfile.template" > /tmp/Caddyfile-clarity
$SCP_CMD /tmp/Caddyfile-clarity "$SERVER_USER@$SERVER_IP:/tmp/Caddyfile"
$SSH_CMD "sudo cp /tmp/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy"
rm /tmp/Caddyfile-clarity

echo "  ✅ Services configured and started"

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "  Waiting 5 seconds for app to start..."
sleep 5

echo "  Running health check..."
HTTP_STATUS=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/healthz" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "  ✅ Health check passed (200 OK)"
else
  echo "  ⚠️  Health check returned HTTP $HTTP_STATUS"
  echo "  Check logs: ssh $SERVER_USER@$SERVER_IP 'sudo journalctl -u clarity-api -n 30'"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅  Deployment complete!"
echo ""
echo "  App URL:  https://$DOMAIN"
echo "  Health:   https://$DOMAIN/healthz"
echo ""
echo "  If this is your first deploy, Caddy will obtain an"
echo "  HTTPS certificate automatically (takes ~30 seconds)."
echo ""
echo "  Useful commands:"
echo "    Logs:    ssh $SERVER_USER@$SERVER_IP 'sudo journalctl -u clarity-api -f'"
echo "    Status:  ssh $SERVER_USER@$SERVER_IP 'sudo systemctl status clarity-api'"
echo "    Restart: ssh $SERVER_USER@$SERVER_IP 'sudo systemctl restart clarity-api'"
echo ""
echo "  Next steps:"
echo "    1. Open https://$DOMAIN and verify the app loads"
echo "    2. Register Stripe webhook at https://dashboard.stripe.com/webhooks"
echo "       URL: https://$DOMAIN/api/payments/webhook"
echo "    3. Add Stripe__WebhookSecret to $REMOTE_ENV_FILE on the server"
echo "    4. Run through SMOKE_TEST.md"
echo "════════════════════════════════════════════════════════"
echo ""

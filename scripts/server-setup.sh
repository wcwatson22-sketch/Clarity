#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — One-Time Server Setup
#
# Run this ONCE on a fresh Ubuntu 22.04 VPS before your first deployment.
#
# Usage (from your LOCAL machine — this SSHes into the server):
#   bash scripts/server-setup.sh
#
# Prerequisites:
#   - scripts/deploy.conf is filled in (DOMAIN, SERVER_IP, SERVER_USER, SSH_KEY)
#   - You can SSH into the server: ssh root@<SERVER_IP>
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy.conf"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $SERVER_USER@$SERVER_IP"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Clarity Finance — Server Setup"
echo "  Server:  $SERVER_USER@$SERVER_IP"
echo "  Domain:  $DOMAIN"
echo "════════════════════════════════════════════════════════"
echo ""
read -r -p "  Press Enter to begin setup, or Ctrl+C to cancel..."
echo ""

# ── 1. System update ──────────────────────────────────────────────────────────
echo "[1/7] Updating system packages..."
$SSH "sudo apt-get update -qq && sudo apt-get upgrade -y -qq"

# ── 2. Install .NET 9 runtime ─────────────────────────────────────────────────
echo "[2/7] Installing .NET 9 runtime..."
$SSH "
  if dotnet --version 2>/dev/null | grep -q '^9\.'; then
    echo '  .NET 9 already installed, skipping.'
  else
    wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O /tmp/packages-microsoft-prod.deb
    sudo dpkg -i /tmp/packages-microsoft-prod.deb
    sudo apt-get update -qq
    sudo apt-get install -y aspnetcore-runtime-9.0
    echo '  .NET 9 installed.'
  fi
"

# ── 3. Install Caddy ──────────────────────────────────────────────────────────
echo "[3/7] Installing Caddy..."
$SSH "
  if command -v caddy &>/dev/null; then
    echo '  Caddy already installed, skipping.'
  else
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl -qq
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y caddy
    echo '  Caddy installed.'
  fi
"

# ── 4. Install SQLite (for backup script) ─────────────────────────────────────
echo "[4/7] Installing SQLite CLI..."
$SSH "sudo apt-get install -y sqlite3 -qq && echo '  SQLite installed.'"

# ── 5. Create directories ─────────────────────────────────────────────────────
echo "[5/7] Creating application directories..."
$SSH "
  sudo mkdir -p $REMOTE_APP_DIR
  sudo mkdir -p $REMOTE_WEB_DIR
  sudo mkdir -p /etc/clarity
  sudo mkdir -p $REMOTE_BACKUP_DIR
  sudo chown -R www-data:www-data $REMOTE_APP_DIR
  sudo chown -R www-data:www-data $REMOTE_WEB_DIR
  sudo chown -R www-data:www-data $REMOTE_BACKUP_DIR
  echo '  Directories created.'
"

# ── 6. Copy env template to server ───────────────────────────────────────────
echo "[6/7] Copying env template to server..."
scp -i "$SSH_KEY" "$SCRIPT_DIR/env.template" "$SERVER_USER@$SERVER_IP:/tmp/clarity-env.template"
$SSH "
  if [ -f $REMOTE_ENV_FILE ]; then
    echo '  /etc/clarity/env already exists — skipping to avoid overwriting secrets.'
  else
    sudo cp /tmp/clarity-env.template $REMOTE_ENV_FILE
    sudo chmod 600 $REMOTE_ENV_FILE
    sudo chown root:root $REMOTE_ENV_FILE
    echo '  Env template copied to $REMOTE_ENV_FILE'
    echo '  ⚠️  IMPORTANT: You must fill in the secrets before starting the app.'
    echo '      Run: sudo nano $REMOTE_ENV_FILE'
  fi
"

# ── 7. Set up daily backup cron ───────────────────────────────────────────────
echo "[7/7] Setting up daily backup cron..."
$SSH "
  CRON_LINE='0 3 * * * www-data bash $REMOTE_APP_DIR/scripts/backup.sh >> /var/log/clarity-backup.log 2>&1'
  if sudo crontab -l -u www-data 2>/dev/null | grep -q 'backup.sh'; then
    echo '  Backup cron already configured, skipping.'
  else
    (sudo crontab -l -u www-data 2>/dev/null; echo \"\$CRON_LINE\") | sudo crontab -u www-data -
    echo '  Daily backup cron set for 3am.'
  fi
"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅  Server setup complete!"
echo ""
echo "  Next steps:"
echo "  1. SSH into server:  ssh $SERVER_USER@$SERVER_IP"
echo "  2. Fill in secrets:  sudo nano $REMOTE_ENV_FILE"
echo "     Replace every REPLACE_ME value (JWT key, Resend key, Stripe keys)"
echo "  3. Generate JWT key: openssl rand -base64 48"
echo "  4. Return here and run:  bash scripts/deploy.sh"
echo "════════════════════════════════════════════════════════"
echo ""

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — SQLite Restore Script
#
# Usage:
#   sudo bash /opt/clarity-api/scripts/restore.sh /opt/clarity-backups/clarity_20260101_030000.db
#
# What it does:
#   1. Stops the Clarity API service
#   2. Creates a safety backup of the current database
#   3. Restores the specified backup
#   4. Restarts the service
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DB_PATH="/opt/clarity-api/clarity.db"
SERVICE_NAME="clarity-api"

# ── Argument check ────────────────────────────────────────────────────────────
if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup-file>"
  echo "Example: $0 /opt/clarity-backups/clarity_20260101_030000.db"
  exit 1
fi

RESTORE_FROM="$1"

if [ ! -f "$RESTORE_FROM" ]; then
  echo "[restore] ERROR: Backup file not found: $RESTORE_FROM"
  exit 1
fi

# ── Confirmation ──────────────────────────────────────────────────────────────
echo ""
echo "  ⚠️  WARNING: This will replace the live database."
echo "  Restoring from: $RESTORE_FROM"
echo "  Current DB:     $DB_PATH"
echo ""
read -r -p "  Type YES to continue: " confirm
if [ "$confirm" != "YES" ]; then
  echo "[restore] Cancelled."
  exit 0
fi

# ── Safety backup of current DB ───────────────────────────────────────────────
SAFETY_BACKUP="${DB_PATH}.before-restore-$(date +%Y%m%d_%H%M%S)"
echo "[restore] Creating safety backup of current DB → $SAFETY_BACKUP"
cp "$DB_PATH" "$SAFETY_BACKUP"

# ── Stop service ──────────────────────────────────────────────────────────────
echo "[restore] Stopping $SERVICE_NAME..."
systemctl stop "$SERVICE_NAME"

# ── Restore ───────────────────────────────────────────────────────────────────
echo "[restore] Restoring from $RESTORE_FROM..."
sqlite3 "$RESTORE_FROM" ".backup '${DB_PATH}'"
chown www-data:www-data "$DB_PATH"

# ── Restart service ───────────────────────────────────────────────────────────
echo "[restore] Starting $SERVICE_NAME..."
systemctl start "$SERVICE_NAME"

sleep 2
STATUS=$(systemctl is-active "$SERVICE_NAME" || true)
if [ "$STATUS" = "active" ]; then
  echo "[restore] ✅ Service is running. Restore complete."
  echo "[restore] Safety backup saved at: $SAFETY_BACKUP"
else
  echo "[restore] ❌ Service failed to start. Check: journalctl -u $SERVICE_NAME -n 50"
  echo "[restore] Your safety backup is at: $SAFETY_BACKUP"
  exit 1
fi

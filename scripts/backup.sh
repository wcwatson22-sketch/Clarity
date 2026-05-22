#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — SQLite Backup Script
#
# Usage:
#   Manual:     sudo -u www-data bash /opt/clarity-api/scripts/backup.sh
#   Via cron:   see DEPLOY.md §10 for cron setup
#
# What it does:
#   1. Creates a timestamped backup of clarity.db using SQLite's .backup command
#      (safe to run while the app is live — no downtime, no lock contention)
#   2. Deletes backups older than RETENTION_DAYS
#   3. Logs what it did
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH="/opt/clarity-api/clarity.db"
BACKUP_DIR="/opt/clarity-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/clarity_${TIMESTAMP}.db"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [ ! -f "$DB_PATH" ]; then
  echo "[backup] ERROR: Database not found at $DB_PATH"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[backup] ERROR: Backup directory $BACKUP_DIR does not exist."
  echo "[backup] Create it with: sudo mkdir -p $BACKUP_DIR && sudo chown www-data:www-data $BACKUP_DIR"
  exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
  echo "[backup] ERROR: sqlite3 is not installed. Run: sudo apt-get install -y sqlite3"
  exit 1
fi

# ── Backup ────────────────────────────────────────────────────────────────────
echo "[backup] Starting backup → $BACKUP_FILE"
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[backup] Backup complete. Size: $SIZE"

# ── Prune old backups ─────────────────────────────────────────────────────────
echo "[backup] Removing backups older than $RETENTION_DAYS days..."
DELETED=$(find "$BACKUP_DIR" -name "clarity_*.db" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
echo "[backup] Deleted $DELETED old backup(s)."

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL=$(find "$BACKUP_DIR" -name "clarity_*.db" | wc -l)
echo "[backup] Done. Total backups on disk: $TOTAL"

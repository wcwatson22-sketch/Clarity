#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — Encrypted SQLite Restore Script
#
# Usage:
#   sudo bash restore.sh <backup-file.db.gz.enc> [output-path]
#
# By default this NEVER touches the live database — it decrypts and decompresses
# a backup into a separate output path (default: /tmp/clarity-restore-test/) so
# you can inspect/verify it before deciding to actually restore into production.
#
# To perform a REAL production restore (only after verifying the decrypted file):
#   1. sudo systemctl stop clarity-api
#   2. sudo cp /opt/clarity-api/clarity.db /opt/clarity-api/clarity.db.pre-restore
#   3. sudo cp <output-path> /opt/clarity-api/clarity.db
#   4. sudo chown www-data:www-data /opt/clarity-api/clarity.db
#   5. sudo systemctl start clarity-api
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

KEY_FILE="/etc/clarity/backup.key"
BACKUP_FILE="${1:?Usage: restore.sh <backup-file.db.gz.enc> [output-path]}"
OUT_DIR="/tmp/clarity-restore-test"
OUT_PATH="${2:-$OUT_DIR/restored_$(date +%Y%m%d_%H%M%S).db}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] ERROR: backup file not found: $BACKUP_FILE"; exit 1
fi
if [ ! -f "$KEY_FILE" ]; then
  echo "[restore] ERROR: encryption key not found at $KEY_FILE"; exit 1
fi

mkdir -p "$(dirname "$OUT_PATH")"
TMP_GZ="$(mktemp)"
trap 'rm -f "$TMP_GZ"' EXIT

echo "[restore] Decrypting $BACKUP_FILE …"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP_FILE" -pass file:"$KEY_FILE" -out "$TMP_GZ"

echo "[restore] Decompressing …"
gunzip -c "$TMP_GZ" > "$OUT_PATH"

echo "[restore] Verifying database integrity …"
INTEGRITY=$(sqlite3 "$OUT_PATH" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
  echo "[restore] FAILED integrity check: $INTEGRITY"; exit 1
fi

USERS=$(sqlite3 "$OUT_PATH" "SELECT COUNT(*) FROM Users;")
ACCOUNTS=$(sqlite3 "$OUT_PATH" "SELECT COUNT(*) FROM Accounts;")
echo "[restore] Integrity check: OK"
echo "[restore] Restored database at: $OUT_PATH"
echo "[restore] Sanity check — Users: $USERS, Accounts: $ACCOUNTS"
echo "[restore] This is a TEST restore only — the live database was not touched."
echo "[restore] To actually restore into production, follow the steps in this script's header."

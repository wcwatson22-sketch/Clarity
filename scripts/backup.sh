#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clarity Finance — Encrypted SQLite Backup Script
#
# Usage:
#   Manual:     sudo bash /opt/clarity-api/scripts/backup.sh
#   Via cron:   runs daily (installed during deploy)
#
# What it does:
#   1. Creates a consistent snapshot of clarity.db using SQLite's .backup command
#      (safe to run while the app is live — no downtime, no lock contention)
#   2. Compresses it, then encrypts it with AES-256 (encryption at rest for the
#      most leak-prone artifact — a backup file copied off the server is useless
#      without the key)
#   3. Deletes backups older than RETENTION_DAYS
#
# The key lives in /etc/clarity/backup.key (root-only, 600) and is NOT stored in
# the backup. Generated automatically on first run — copy it somewhere safe, or
# you cannot restore.
#
# Decrypt/restore:
#   openssl enc -d -aes-256-cbc -pbkdf2 -in clarity_YYYYMMDD.db.gz.enc \
#     -pass file:/etc/clarity/backup.key | gunzip > clarity.db
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH="/opt/clarity-api/clarity.db"
BACKUP_DIR="/opt/clarity-backups"
KEY_FILE="/etc/clarity/backup.key"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUT_FILE="${BACKUP_DIR}/clarity_${TIMESTAMP}.db.gz.enc"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [ ! -f "$DB_PATH" ]; then
  echo "[backup] ERROR: Database not found at $DB_PATH"; exit 1
fi
if ! command -v sqlite3 &>/dev/null; then
  echo "[backup] ERROR: sqlite3 is not installed. Run: sudo apt-get install -y sqlite3"; exit 1
fi
mkdir -p "$BACKUP_DIR"

# ── Encryption key (generate once, root-only) ─────────────────────────────────
if [ ! -f "$KEY_FILE" ]; then
  mkdir -p "$(dirname "$KEY_FILE")"
  ( umask 077; openssl rand -base64 32 > "$KEY_FILE" )
  chmod 600 "$KEY_FILE"
  echo "[backup] Generated new encryption key at $KEY_FILE — COPY IT SOMEWHERE SAFE."
fi

# ── Backup → compress → encrypt ───────────────────────────────────────────────
echo "[backup] Snapshotting database…"
sqlite3 "$DB_PATH" ".backup '${TMP_DIR}/clarity.db'"
gzip -c "${TMP_DIR}/clarity.db" > "${TMP_DIR}/clarity.db.gz"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "${TMP_DIR}/clarity.db.gz" \
  -out "$OUT_FILE" \
  -pass file:"$KEY_FILE"
chmod 600 "$OUT_FILE"

SIZE=$(du -sh "$OUT_FILE" | cut -f1)
echo "[backup] Encrypted backup complete: $OUT_FILE ($SIZE)"

# ── Prune old backups ─────────────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "clarity_*.db.gz.enc" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
echo "[backup] Deleted $DELETED backup(s) older than $RETENTION_DAYS days."

TOTAL=$(find "$BACKUP_DIR" -name "clarity_*.db.gz.enc" | wc -l)
echo "[backup] Done. Total encrypted backups on disk: $TOTAL"

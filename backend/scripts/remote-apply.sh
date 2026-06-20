#!/usr/bin/env bash
#
# Server-side deploy step for the Clarity API. Runs ON the droplet as root.
# Invoked by backend/deploy.sh after the new build is staged in $STAGE.
#
# It performs: preflight checks -> backup current release -> apply new files with
# CORRECT OWNERSHIP (www-data) -> restart -> health check -> rollback on failure.
#
# This permanently fixes the "rsync as root left files root-owned -> CHDIR
# Permission denied" crash: rsync --chown plus an explicit chown guarantee the
# service user owns its files every deploy. No manual chown required, ever.
set -euo pipefail

APP_DIR="/opt/clarity-api"
STAGE="/tmp/clarity-publish"
BACKUP="/opt/clarity-api.prev"
SVC="clarity-api"
SVC_USER="www-data"
SVC_GROUP="www-data"
ENV_FILE="/etc/clarity/env"
HEALTH_URL="http://127.0.0.1:5000/api/status"

fail() { echo "[deploy] PREFLIGHT/DEPLOY FAILED: $1" >&2; exit 1; }

# ── Preflight (do NOT touch the running service until these pass) ────────────
echo "[deploy] preflight checks…"
[ -d "$APP_DIR" ]                              || fail "target dir $APP_DIR does not exist"
[ -f "$STAGE/Clarity.Api.dll" ]                || fail "staged build missing ($STAGE/Clarity.Api.dll) — build did not complete"
[ -f "$STAGE/Clarity.Api.runtimeconfig.json" ] || fail "staged runtime config missing — incomplete publish"
[ -f "$APP_DIR/appsettings.Production.json" ]  || fail "production config missing ($APP_DIR/appsettings.Production.json)"
[ -f "$ENV_FILE" ]                             || fail "environment/secrets file missing ($ENV_FILE) — DB connection string unavailable"
id "$SVC_USER" >/dev/null 2>&1                 || fail "service user $SVC_USER does not exist"
# DB present (we never overwrite it; just confirm the data is there)
ls "$APP_DIR"/*.db >/dev/null 2>&1             || echo "[deploy] note: no *.db in $APP_DIR yet (first run / EnsureCreated will create it)"
echo "[deploy] preflight OK"

# ── Backup current release (app files only; never copy the DB) ──────────────
echo "[deploy] backing up current release to $BACKUP"
rm -rf "$BACKUP"; mkdir -p "$BACKUP"
rsync -a --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' "$APP_DIR/" "$BACKUP/"

# ── Apply new build with correct ownership/permissions ──────────────────────
echo "[deploy] stopping $SVC"
systemctl stop "$SVC"

# --chown sets owner:group on write; --chmod keeps dirs traversable and files
# readable but never world-writable. appsettings*.json and the DB are preserved.
rsync -a --chown="$SVC_USER:$SVC_GROUP" \
  --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r \
  --exclude 'appsettings*.json' \
  --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' \
  "$STAGE/" "$APP_DIR/"

# Belt-and-suspenders: guarantee the service user owns everything and can enter
# its working directory. (DB is already www-data-owned, so this is a no-op for it.)
chown -R "$SVC_USER:$SVC_GROUP" "$APP_DIR"
chmod 755 "$APP_DIR"
sudo -u "$SVC_USER" test -x "$APP_DIR" || fail "service user $SVC_USER cannot access $APP_DIR after chown"

# ── Restart + health check with retries ─────────────────────────────────────
echo "[deploy] starting $SVC"
systemctl start "$SVC"

healthy=0
for i in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then healthy=1; break; fi
  echo "[deploy] waiting for health ($i/15)… last=$code"
  sleep 2
done

if [ "$healthy" = "1" ]; then
  echo "[deploy] SUCCESS — $SVC active, health 200"
  rm -rf "$STAGE"
  exit 0
fi

# ── Rollback ────────────────────────────────────────────────────────────────
echo "[deploy] health check FAILED — rolling back to previous release" >&2
systemctl stop "$SVC" || true
rsync -a --chown="$SVC_USER:$SVC_GROUP" \
  --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' \
  "$BACKUP/" "$APP_DIR/"
chown -R "$SVC_USER:$SVC_GROUP" "$APP_DIR"; chmod 755 "$APP_DIR"
systemctl start "$SVC"
for i in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  [ "$code" = "200" ] && { echo "[deploy] rollback restored health 200"; break; }
  sleep 2
done
fail "deployment unhealthy; rolled back to previous release ($BACKUP)"

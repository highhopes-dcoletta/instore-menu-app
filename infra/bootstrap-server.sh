#!/bin/bash
# bootstrap-server.sh — one-time migration to versioned deploy structure
# Run this ON THE SERVER (or via ssh) to migrate from the old flat layout
# to the new releases/shared/backups structure.
#
# Usage: ssh root@104.236.29.111 'bash -s' < infra/bootstrap-server.sh
#
# Safe to re-run — skips steps that are already done.

set -e

# ── Which environment? ───────────────────────────────────────────────────────
# Pass "stage" as first arg to bootstrap staging instead of production
ENV="${1:-prod}"

if [ "$ENV" = "stage" ]; then
  BASE="/home/highhopes/highhopes-menu-stage"
  OLD_BASE="/home/highhopes/highhopes-menu-stage"
  OLD_VENV="$OLD_BASE/backend/venv"
  OLD_DB="$OLD_BASE/backend/analytics.db"
  OLD_ENV="$OLD_BASE/backend/.env"
  OLD_WEB="/var/www/highhopes-menu-stage"
  SERVICE="highhopes-menu-stage"
  echo "==> Bootstrapping STAGING at $BASE"
else
  BASE="/home/highhopes/highhopes-menu"
  OLD_BASE="/home/highhopes/highhopes-menu"
  OLD_VENV="$OLD_BASE/backend/venv"
  OLD_DB="$OLD_BASE/backend/analytics.db"
  OLD_ENV="$OLD_BASE/backend/.env"
  OLD_WEB="/var/www/highhopes-menu"
  SERVICE="highhopes-menu"
  echo "==> Bootstrapping PRODUCTION at $BASE"
fi

# ── Create directory structure ───────────────────────────────────────────────
echo "==> Creating directory structure..."
mkdir -p "$BASE/releases"
mkdir -p "$BASE/shared"
mkdir -p "$BASE/backups/db"

# ── Move venv to shared ─────────────────────────────────────────────────────
if [ -d "$OLD_VENV" ] && [ ! -d "$BASE/shared/backend-venv" ]; then
  echo "==> Moving venv to shared/backend-venv..."
  mv "$OLD_VENV" "$BASE/shared/backend-venv"
elif [ ! -d "$BASE/shared/backend-venv" ]; then
  echo "==> Creating new shared venv..."
  python3 -m venv "$BASE/shared/backend-venv"
fi

# ── Move analytics.db to shared ─────────────────────────────────────────────
if [ -f "$OLD_DB" ] && [ ! -f "$BASE/shared/analytics.db" ]; then
  echo "==> Moving analytics.db to shared/..."
  cp "$OLD_DB" "$BASE/shared/analytics.db"
  # Keep old copy as backup
  cp "$OLD_DB" "$BASE/backups/db/analytics-pre-migration.db"
fi

# ── Copy .env to shared ─────────────────────────────────────────────────────
if [ -f "$OLD_ENV" ] && [ ! -f "$BASE/shared/backend.env" ]; then
  echo "==> Copying .env to shared/backend.env..."
  cp "$OLD_ENV" "$BASE/shared/backend.env"
fi

# Add DB_PATH to backend.env pointing to shared DB
if [ -f "$BASE/shared/backend.env" ]; then
  grep -q "^DB_PATH=" "$BASE/shared/backend.env" || \
    echo "DB_PATH=$BASE/shared/analytics.db" >> "$BASE/shared/backend.env"
fi

# ── Create first release from current deployment ────────────────────────────
RELEASE="pre-migration-$(date +%Y%m%d-%H%M%S)"

if [ ! -L "$BASE/current" ]; then
  echo "==> Creating initial release: $RELEASE"
  mkdir -p "$BASE/releases/$RELEASE"

  # Copy backend (exclude venv and db)
  if [ -d "$OLD_BASE/backend" ]; then
    rsync -a \
      --exclude 'venv' \
      --exclude '__pycache__' \
      --exclude '*.pyc' \
      --exclude 'analytics.db' \
      "$OLD_BASE/backend/" "$BASE/releases/$RELEASE/backend/"
  fi

  # Copy infra
  if [ -d "$OLD_BASE/infra" ]; then
    rsync -a "$OLD_BASE/infra/" "$BASE/releases/$RELEASE/infra/"
  fi

  # Copy frontend (from web dir or dist)
  if [ -d "$OLD_WEB" ]; then
    rsync -a "$OLD_WEB/" "$BASE/releases/$RELEASE/frontend-dist/"
  fi

  # Write deploy metadata
  cat > "$BASE/releases/$RELEASE/.deploy-meta" <<METAEOF
sha=pre-migration
timestamp=$(date +%Y%m%d-%H%M%S)
deployer=bootstrap
METAEOF

  # Create symlink
  ln -sfn "$BASE/releases/$RELEASE" "$BASE/current"
  echo "  Symlink: current -> releases/$RELEASE"
else
  echo "==> Symlink already exists, skipping initial release creation."
fi

# ── Install updated systemd service ─────────────────────────────────────────
if [ -f "$BASE/current/infra/$SERVICE.service" ]; then
  echo "==> Installing updated systemd service..."
  cp "$BASE/current/infra/$SERVICE.service" "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE"
fi

# ── Install updated nginx config ────────────────────────────────────────────
if [ "$ENV" = "stage" ]; then
  NGINX_CONF="nginx-stage.conf"
else
  NGINX_CONF="nginx.conf"
fi
if [ -f "$BASE/current/infra/$NGINX_CONF" ]; then
  echo "==> Installing updated nginx config..."
  cp "$BASE/current/infra/$NGINX_CONF" "/etc/nginx/sites-available/$SERVICE"
  ln -sf "/etc/nginx/sites-available/$SERVICE" "/etc/nginx/sites-enabled/$SERVICE"
  nginx -t && systemctl reload nginx
fi

# ── Daily DB backup cron job ─────────────────────────────────────────────────
CRON_CMD="0 3 * * * cp $BASE/shared/analytics.db $BASE/backups/db/analytics-daily-\$(date +\\%Y\\%m\\%d).db && find $BASE/backups/db -name 'analytics-daily-*.db' -mtime +30 -delete"
if ! crontab -l 2>/dev/null | grep -qF "analytics-daily"; then
  echo "==> Adding daily DB backup cron job (3 AM)..."
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "  Cron job added."
else
  echo "==> Daily backup cron job already exists."
fi

# ── Restart service ──────────────────────────────────────────────────────────
echo "==> Restarting $SERVICE..."
systemctl restart "$SERVICE" || echo "  WARNING: service restart failed — check logs with: journalctl -u $SERVICE"

echo ""
echo "==> Bootstrap complete!"
echo "    Base:    $BASE"
echo "    Current: $(readlink $BASE/current)"
echo "    Shared:  $BASE/shared/"
echo "    Backups: $BASE/backups/"
echo ""
echo "Next steps:"
echo "  1. Verify the app is working"
echo "  2. Deploy with the new deploy script to confirm the full flow"

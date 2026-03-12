#!/bin/bash
# deploy-stage.sh — versioned deploy of local state to staging
# Unlike deploy.sh, this rsyncs local source directly — no git push required.
# Usage: ./deploy-stage.sh

set -e

HOST="root@104.236.29.111"
BASE="/home/highhopes/highhopes-menu-stage"
SERVICE="highhopes-menu-stage"
KEEP_RELEASES=10
KEEP_BACKUPS=30
SSHOPTS="-o IdentityAgent=SSH_AUTH_SOCK"

# ── Release name ─────────────────────────────────────────────────────────────
SHORT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="${TIMESTAMP}-${SHORT_SHA}"
echo "==> Release: $RELEASE"

# ── Build frontend ───────────────────────────────────────────────────────────
echo "==> Building frontend (staging mode)..."
(cd frontend && npx vite build --mode staging)

# ── Create release dir and rsync files ───────────────────────────────────────
echo "==> Creating release directory on server..."
ssh $SSHOPTS "$HOST" "mkdir -p $BASE/releases/$RELEASE"

echo "==> Syncing backend..."
rsync -az \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.venv' \
  --exclude 'venv' \
  --exclude 'analytics.db' \
  -e "ssh $SSHOPTS" \
  backend/ "$HOST:$BASE/releases/$RELEASE/backend/"

echo "==> Syncing infra..."
rsync -az -e "ssh $SSHOPTS" infra/ "$HOST:$BASE/releases/$RELEASE/infra/"

echo "==> Syncing frontend dist..."
rsync -az --delete -e "ssh $SSHOPTS" frontend/dist/ "$HOST:$BASE/releases/$RELEASE/frontend-dist/"

echo "==> Verifying frontend sync..."
LOCAL_HASH=$(md5 -q frontend/dist/index.html)
REMOTE_HASH=$(ssh $SSHOPTS "$HOST" "md5sum $BASE/releases/$RELEASE/frontend-dist/index.html | cut -d' ' -f1")
if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "ERROR: index.html mismatch after rsync (local=$LOCAL_HASH remote=$REMOTE_HASH)" >&2
  exit 1
fi
echo "  index.html verified."

# ── Write deploy metadata ───────────────────────────────────────────────────
ssh $SSHOPTS "$HOST" bash <<EOF
cat > $BASE/releases/$RELEASE/.deploy-meta <<METAEOF
sha=$(git rev-parse HEAD)
short_sha=$SHORT_SHA
timestamp=$TIMESTAMP
deployer=$(whoami)@$(hostname)
METAEOF
EOF

# ── Pre-deploy DB backup ────────────────────────────────────────────────────
echo "==> Backing up database..."
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
mkdir -p $BASE/backups/db
if [ -f "$BASE/shared/analytics.db" ]; then
  cp $BASE/shared/analytics.db $BASE/backups/db/analytics-${RELEASE}-pre-deploy.db
  echo "  DB backed up."
else
  echo "  No existing DB to back up."
fi
EOF

# ── Install pip deps into shared venv ────────────────────────────────────────
echo "==> Installing Python dependencies..."
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
if [ ! -d "$BASE/shared/backend-venv" ]; then
  python3 -m venv $BASE/shared/backend-venv
fi
$BASE/shared/backend-venv/bin/pip install --quiet -r $BASE/releases/$RELEASE/backend/requirements.txt
EOF

# ── Copy backend .env to shared ──────────────────────────────────────────────
echo "==> Copying backend .env to shared..."
scp $SSHOPTS backend/.env "$HOST:$BASE/shared/backend.env"
# Add PROD_DB_PATH for push-to-prod feature (stage points to prod DB)
ssh $SSHOPTS "$HOST" "grep -q PROD_DB_PATH $BASE/shared/backend.env || echo 'PROD_DB_PATH=/home/highhopes/highhopes-menu/shared/analytics.db' >> $BASE/shared/backend.env"

# ── Atomic symlink swap ──────────────────────────────────────────────────────
echo "==> Swapping symlink to new release..."
ssh $SSHOPTS "$HOST" "ln -sfn $BASE/releases/$RELEASE $BASE/current"

# ── Install systemd + nginx configs ──────────────────────────────────────────
echo "==> Installing service configs..."
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
# nginx
cp $BASE/current/infra/nginx-stage.conf /etc/nginx/sites-available/$SERVICE
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
nginx -t
systemctl reload nginx

# systemd
cp $BASE/current/infra/$SERVICE.service /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable $SERVICE
EOF

# ── Restart service ──────────────────────────────────────────────────────────
echo "==> Restarting staging service..."
ssh $SSHOPTS "$HOST" "systemctl restart $SERVICE"

# ── Health check ─────────────────────────────────────────────────────────────
echo "==> Waiting for staging API..."
for i in $(seq 1 30); do
  if ssh $SSHOPTS "$HOST" "nc -z 127.0.0.1 5002" 2>/dev/null; then
    echo "  API OK (${i}s)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: Staging API did not respond after 30s" >&2
    exit 1
  fi
  sleep 1
done

# ── Prune old releases ──────────────────────────────────────────────────────
echo "==> Pruning old releases (keeping $KEEP_RELEASES)..."
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
cd $BASE/releases
CURRENT_RELEASE=\$(readlink $BASE/current | xargs basename)
ls -1d */ | sort | head -n -$KEEP_RELEASES | while read dir; do
  dir_name=\$(basename "\$dir")
  if [ "\$dir_name" != "\$CURRENT_RELEASE" ]; then
    echo "  Removing \$dir_name"
    rm -rf "\$dir"
  fi
done
EOF

echo "==> Pruning old backups (keeping $KEEP_BACKUPS)..."
ssh $SSHOPTS "$HOST" bash <<EOF
cd $BASE/backups/db 2>/dev/null || exit 0
ls -1t *.db 2>/dev/null | tail -n +\$(($KEEP_BACKUPS + 1)) | xargs -r rm -f
EOF

# ── SSL cert ─────────────────────────────────────────────────────────────────
echo "==> Provisioning SSL certificate..."
ssh $SSHOPTS "$HOST" "certbot --nginx -d menu2-stage.highhopesma.com -n --redirect 2>&1" || \
  echo "  WARNING: certbot failed — DNS may not be propagated yet."

# ── E2E tests ────────────────────────────────────────────────────────────────
echo ""
echo "==> Running e2e tests against staging..."
if E2E_BASE_URL=https://menu2-stage.highhopesma.com npx --prefix monitor playwright test --config monitor/playwright.config.js --reporter=list; then
  echo ""
  echo "==> Done! https://menu2-stage.highhopesma.com"
  echo "    Release: $RELEASE"
else
  echo ""
  echo "ERROR: e2e tests failed against staging — see above for details." >&2
  exit 1
fi

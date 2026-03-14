#!/bin/bash
# deploy.sh — versioned deploy of High Hopes menu app to production
# Usage: ./deploy.sh
#
# Requires: the server has been bootstrapped with infra/bootstrap-server.sh

set -e

HOST="root@104.236.29.111"
BASE="/home/highhopes/highhopes-menu"
SERVICE="highhopes-menu"
KEEP_RELEASES=10
KEEP_BACKUPS=30
# Use macOS keychain agent (bypasses 1Password IdentityAgent override in ~/.ssh/config)
SSHOPTS="-o IdentityAgent=SSH_AUTH_SOCK"

# ── Release name ─────────────────────────────────────────────────────────────
SHORT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="${TIMESTAMP}-${SHORT_SHA}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERSION=$(git rev-list --count HEAD)
echo "==> Release: $RELEASE (branch: $BRANCH, v$VERSION)"

# ── Check for uncommitted changes ────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: You have uncommitted changes. Deploy will use the last commit ($SHORT_SHA)."
  read -p "Continue? [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# ── Build frontend ───────────────────────────────────────────────────────────
echo "==> Building frontend..."
(cd frontend && npm run build)

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

echo "==> Syncing frontend dist..."
rsync -az --delete -e "ssh $SSHOPTS" frontend/dist/ "$HOST:$BASE/releases/$RELEASE/frontend-dist/"

echo "==> Syncing infra configs..."
rsync -az -e "ssh $SSHOPTS" infra/ "$HOST:$BASE/releases/$RELEASE/infra/"

echo "==> Verifying frontend sync..."
LOCAL_HASH=$(md5 -q frontend/dist/index.html)
REMOTE_HASH=$(ssh $SSHOPTS "$HOST" "md5sum $BASE/releases/$RELEASE/frontend-dist/index.html | cut -d' ' -f1")
if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "ERROR: index.html mismatch after rsync (local=$LOCAL_HASH remote=$REMOTE_HASH)" >&2
  exit 1
fi
echo "  index.html verified."

# ── Set permissions for nginx ────────────────────────────────────────────────
ssh $SSHOPTS "$HOST" "chmod -R o+rX $BASE/releases/$RELEASE"

# ── Generate release metadata ────────────────────────────────────────────────
echo "==> Generating release notes..."
PREV_SHA=$(ssh $SSHOPTS "$HOST" "cat $BASE/current/.deploy-meta 2>/dev/null | grep '^sha=' | cut -d= -f2")
RELEASE_NOTES=$(bash scripts/release-notes.sh "$PREV_SHA")
echo "  Notes: $RELEASE_NOTES"

# Commit count since previous release
COMMIT_COUNT=0
if [ -n "$PREV_SHA" ] && git cat-file -t "$PREV_SHA" >/dev/null 2>&1; then
  COMMIT_COUNT=$(git rev-list --count "$PREV_SHA"..HEAD 2>/dev/null || echo 0)
fi
echo "  Commits: $COMMIT_COUNT"

# ── Write deploy metadata ───────────────────────────────────────────────────
ssh $SSHOPTS "$HOST" bash <<EOF
cat > $BASE/releases/$RELEASE/.deploy-meta <<METAEOF
sha=$(git rev-parse HEAD)
short_sha=$SHORT_SHA
timestamp=$TIMESTAMP
deployer=$(whoami)@$(hostname)
version=$VERSION
branch=$BRANCH
commit_count=$COMMIT_COUNT
notes=$RELEASE_NOTES
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
# Ensure DB_PATH points to the shared database
ssh $SSHOPTS "$HOST" "grep -q '^DB_PATH=' $BASE/shared/backend.env || echo 'DB_PATH=$BASE/shared/analytics.db' >> $BASE/shared/backend.env"
ssh $SSHOPTS "$HOST" "grep -q '^SERVICE_NAME=' $BASE/shared/backend.env || echo 'SERVICE_NAME=$SERVICE' >> $BASE/shared/backend.env"

# ── Atomic symlink swap ──────────────────────────────────────────────────────
echo "==> Swapping symlink to new release..."
ssh $SSHOPTS "$HOST" "ln -sfn $BASE/releases/$RELEASE $BASE/current"

# ── Install systemd + nginx configs ──────────────────────────────────────────
echo "==> Installing service configs..."
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
cp $BASE/current/infra/$SERVICE.service /etc/systemd/system/$SERVICE.service
systemctl daemon-reload

cp $BASE/current/infra/nginx.conf /etc/nginx/sites-available/$SERVICE
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
nginx -t
systemctl reload nginx
EOF

# ── Restart service ──────────────────────────────────────────────────────────
echo "==> Restarting service..."
ssh $SSHOPTS "$HOST" "systemctl restart $SERVICE"

# ── Health check ─────────────────────────────────────────────────────────────
echo "==> Waiting for API..."
for i in $(seq 1 30); do
  if ssh $SSHOPTS "$HOST" "nc -z 127.0.0.1 5001" 2>/dev/null; then
    echo "  API OK (${i}s)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: API did not respond after 30s" >&2
    echo "Rolling back to previous release..."
    PREV=$(ssh $SSHOPTS "$HOST" "ls -1d $BASE/releases/*/ | sort | tail -2 | head -1 | sed 's|/$||'")
    ssh $SSHOPTS "$HOST" "ln -sfn $PREV $BASE/current && systemctl restart $SERVICE"
    echo "Rolled back to $(basename $PREV). Investigate the failure."
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

# ── Download DB backup locally ───────────────────────────────────────────────
echo "==> Downloading DB backup locally..."
mkdir -p .db-backups
scp $SSHOPTS "$HOST:$BASE/backups/db/analytics-${RELEASE}-pre-deploy.db" ".db-backups/" 2>/dev/null || \
  echo "  No backup to download (first deploy?)."

echo ""
echo "==> Done! https://menu2.highhopesma.com"
echo "    Release: $RELEASE"

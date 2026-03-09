#!/bin/bash
# deploy-stage.sh — deploy current local state to staging (menu2-stage.highhopesma.com)
# Unlike deploy.sh, this rsyncs local source directly — no git push required.
# Usage: ./deploy-stage.sh

set -e

HOST="root@104.236.29.111"
REMOTE_DIR="/home/highhopes/highhopes-menu-stage"
WEB_DIR="/var/www/highhopes-menu-stage"
SERVICE="highhopes-menu-stage"
SSHOPTS="-o IdentityAgent=SSH_AUTH_SOCK"

echo "==> Building frontend..."
(cd frontend && npm run build)

echo "==> Provisioning staging server..."
ssh $SSHOPTS "$HOST" bash << EOF
set -e

apt-get install -y -q git nginx python3-venv python3-pip > /dev/null 2>&1 || true

# Create dirs
mkdir -p $REMOTE_DIR/backend
mkdir -p $WEB_DIR

# Set up Python venv
if [ ! -d "$REMOTE_DIR/backend/venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv $REMOTE_DIR/backend/venv
fi

# Install systemd service
cp /etc/systemd/system/highhopes-menu.service /etc/systemd/system/$SERVICE.service 2>/dev/null || true
EOF

echo "==> Syncing backend + infra..."
rsync -az --delete \
  --exclude venv \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude analytics.db \
  -e "ssh $SSHOPTS" \
  backend/ "$HOST:$REMOTE_DIR/backend/"
rsync -az -e "ssh $SSHOPTS" infra/ "$HOST:$REMOTE_DIR/infra/"

echo "==> Installing Python dependencies..."
ssh $SSHOPTS "$HOST" "$REMOTE_DIR/backend/venv/bin/pip install --quiet -r $REMOTE_DIR/backend/requirements.txt"

echo "==> Syncing frontend..."
rsync -az --delete -e "ssh $SSHOPTS" frontend/dist/ "$HOST:$WEB_DIR/"

echo "==> Verifying sync..."
LOCAL_HASH=$(md5 -q frontend/dist/index.html)
REMOTE_HASH=$(ssh $SSHOPTS "$HOST" "md5sum $WEB_DIR/index.html | cut -d' ' -f1")
if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "ERROR: index.html mismatch after rsync (local=$LOCAL_HASH remote=$REMOTE_HASH)" >&2
  exit 1
fi
echo "  index.html verified."

echo "==> Copying .env to server..."
scp $SSHOPTS backend/.env "$HOST:$REMOTE_DIR/backend/.env"

echo "==> Installing nginx + systemd config..."
ssh $SSHOPTS "$HOST" bash << EOF
set -e

# nginx
cp $REMOTE_DIR/infra/nginx-stage.conf /etc/nginx/sites-available/$SERVICE
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
nginx -t
systemctl reload nginx

# systemd
cp $REMOTE_DIR/infra/$SERVICE.service /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable $SERVICE
EOF

echo "==> Restarting staging service..."
ssh $SSHOPTS "$HOST" "systemctl restart $SERVICE"
sleep 8

echo "==> Waiting for staging API..."
for i in $(seq 1 30); do
  if ssh $SSHOPTS "$HOST" "curl -sm 2 http://127.0.0.1:5002/api/sessions" 2>/dev/null; then
    echo "  API OK (${i}s)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: Staging API did not respond after 38s" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Provisioning SSL certificate..."
ssh $SSHOPTS "$HOST" "certbot --nginx -d menu2-stage.highhopesma.com -n --redirect 2>&1" || \
  echo "  WARNING: certbot failed — DNS may not be propagated yet. Re-run deploy-stage.sh once DNS is set."

echo ""
echo "==> Done! https://menu2-stage.highhopesma.com"

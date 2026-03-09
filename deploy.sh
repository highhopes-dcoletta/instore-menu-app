#!/bin/bash
# deploy.sh — provision or update the High Hopes menu app on the VPS
# Usage: ./deploy.sh

set -e

HOST="root@104.236.29.111"
REMOTE_DIR="/home/highhopes/highhopes-menu"
WEB_DIR="/var/www/highhopes-menu"
REPO="https://github.com/highhopes-dcoletta/instore-menu-app.git"
SERVICE="highhopes-menu"
# Use macOS keychain agent (bypasses 1Password IdentityAgent override in ~/.ssh/config)
SSHOPTS="-o IdentityAgent=SSH_AUTH_SOCK"

echo "==> Building frontend..."
(cd frontend && npm run build)

echo "==> Setting up server..."
ssh $SSHOPTS "$HOST" bash << EOF
set -e

# Install system deps (includes git)
apt-get install -y -q git nginx python3-venv python3-pip > /dev/null 2>&1 || true

# Clone or update repo
export GIT_TERMINAL_PROMPT=0
if [ -d "$REMOTE_DIR/.git" ]; then
    echo "  Pulling latest..."
    cd $REMOTE_DIR && git pull
else
    echo "  Cloning repo..."
    git clone $REPO $REMOTE_DIR
fi

# Set timezone
timedatectl set-timezone America/New_York

# Create web root
mkdir -p $WEB_DIR

# Set up Python venv
if [ ! -d "$REMOTE_DIR/backend/venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv $REMOTE_DIR/backend/venv
fi

echo "  Installing Python dependencies..."
$REMOTE_DIR/backend/venv/bin/pip install --quiet -r $REMOTE_DIR/backend/requirements.txt

# Install systemd service
cp $REMOTE_DIR/infra/$SERVICE.service /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable $SERVICE

# Install nginx config
cp $REMOTE_DIR/infra/nginx.conf /etc/nginx/sites-available/$SERVICE
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx 2>/dev/null || systemctl start nginx

echo "  Done."
EOF

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

echo "==> Restarting service..."
ssh $SSHOPTS "$HOST" "systemctl daemon-reload; systemctl restart $SERVICE"

echo "==> Waiting for API..."
for i in $(seq 1 30); do
  if ssh $SSHOPTS "$HOST" "curl -sm 2 http://127.0.0.1:5001/api/sessions" 2>/dev/null; then
    echo "  API OK (${i}s)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: API did not respond after 30s" >&2
    exit 1
  fi
  sleep 1
done

echo ""
echo "==> Done! http://menu2.highhopesma.com"
echo "    (Run 'sudo certbot --nginx -d menu2.highhopesma.com' on the server to add SSL)"

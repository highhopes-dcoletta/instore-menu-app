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

# Clone or update repo
if [ -d "$REMOTE_DIR/.git" ]; then
    echo "  Pulling latest..."
    cd $REMOTE_DIR && git pull
else
    echo "  Cloning repo..."
    git clone $REPO $REMOTE_DIR
fi

# Set timezone
timedatectl set-timezone America/New_York

# Install system deps
apt-get install -y -q nginx python3-venv python3-pip > /dev/null 2>&1 || true

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

echo "==> Copying .env to server..."
scp $SSHOPTS backend/.env "$HOST:$REMOTE_DIR/backend/.env"

echo "==> Restarting service..."
ssh $SSHOPTS "$HOST" "systemctl restart $SERVICE"

echo ""
echo "==> Deploy complete. Testing API..."
ssh $SSHOPTS "$HOST" "curl -s http://127.0.0.1:5001/api/sessions"

echo ""
echo "==> Done! http://menu.highhopesma.com"
echo "    (Run 'sudo certbot --nginx -d menu.highhopesma.com' on the server to add SSL)"

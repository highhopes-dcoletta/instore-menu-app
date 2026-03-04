#!/usr/bin/env bash
# Deploy script — builds the Vue frontend and pushes to the VPS.
# Usage: ./deploy.sh
set -euo pipefail

VPS_USER="ubuntu"                          # ← change to your VPS username
VPS_HOST="menu.highhopesma.com"            # ← or use IP
VPS_WEB_PATH="/var/www/highhopes-menu"

echo "▶ Building frontend..."
(cd frontend && npm run build)

echo "▶ Syncing to $VPS_HOST:$VPS_WEB_PATH ..."
rsync -avz --delete frontend/dist/ "$VPS_USER@$VPS_HOST:$VPS_WEB_PATH/"

echo "✓ Deploy complete."

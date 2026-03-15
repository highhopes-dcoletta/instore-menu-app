#!/bin/bash
# provision-server.sh — Create a new DigitalOcean droplet and fully provision
# the High Hopes menu app (production + staging) from scratch.
#
# Prerequisites:
#   - DO_API_TOKEN env var (DigitalOcean personal access token)
#   - SSH key already added to your DigitalOcean account
#   - backend/.env exists locally
#   - frontend/.env.local exists locally (Dutchie credentials)
#   - Latest DB backup in .db-backups/ (optional — starts fresh without it)
#
# Usage:
#   export DO_API_TOKEN="your-token-here"
#   bash infra/provision-server.sh
#
# After provisioning:
#   1. Update DNS at pairdomains.com: point menu2.highhopesma.com and
#      menu2-stage.highhopesma.com to the new droplet IP
#   2. Run: bash infra/provision-server.sh --ssl  (after DNS propagates)
#   3. Run: bash infra/provision-server.sh --monitor <PAGERTREE_URL>  (install health check cron)
#   4. Run: bash infra/provision-server.sh --azure  (register SPA redirect URIs in Entra ID)
#
# Monthly rebuild:
#   To rebuild and switch over, run this script, update DNS, then destroy the
#   old droplet once you've confirmed everything works.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Configuration ─────────────────────────────────────────────────────────────
# Override with env vars for demo/alt instances:
#   PROD_DOMAIN=demo.example.com STAGE_DOMAIN=demo-stage.example.com bash infra/provision-server.sh
PROD_DOMAIN="${PROD_DOMAIN:-menu2.highhopesma.com}"
STAGE_DOMAIN="${STAGE_DOMAIN:-menu2-stage.highhopesma.com}"
DROPLET_NAME="highhopes-menu"
REGION="nyc1"
SIZE="s-1vcpu-1gb"        # $6/month — plenty for this app
IMAGE="ubuntu-24-04-x64"
SSHOPTS="-o StrictHostKeyChecking=accept-new -o IdentityAgent=SSH_AUTH_SOCK"
STATE_FILE="$PROJECT_DIR/.provision-state"

# ── Helpers ───────────────────────────────────────────────────────────────────
CREATED_DROPLET_ID=""
cleanup() {
  if [ -n "$CREATED_DROPLET_ID" ]; then
    echo ""
    echo "ERROR: Provisioning failed. Destroying droplet $CREATED_DROPLET_ID..."
    do_api DELETE "/droplets/$CREATED_DROPLET_ID" >/dev/null 2>&1 && \
      echo "Droplet destroyed." || echo "WARNING: Failed to destroy droplet. Delete it manually in the DO console."
    rm -f "$STATE_FILE"
  fi
}
trap cleanup EXIT

die()  { echo "ERROR: $1" >&2; exit 1; }
info() { echo "==> $1"; }
step() { echo ""; echo "── $1 ──"; }

do_api() {
  local method="$1" path="$2"
  shift 2
  curl -sf -X "$method" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.digitalocean.com/v2$path" "$@"
}

wait_for_ssh() {
  local ip="$1"
  info "Waiting for SSH on $ip..."
  for i in $(seq 1 60); do
    if ssh $SSHOPTS -o ConnectTimeout=5 "root@$ip" "echo ok" >/dev/null 2>&1; then
      info "SSH ready (${i}s)"
      return 0
    fi
    sleep 2
  done
  die "SSH not available after 120s"
}

# ── Handle sub-commands ───────────────────────────────────────────────────────
if [ "${1:-}" = "--ssl" ]; then
  [ ! -f "$STATE_FILE" ] && die "No provision state found. Run the full provision first."
  IP=$(grep '^IP=' "$STATE_FILE" | cut -d= -f2)
  [ -z "$IP" ] && die "No IP in state file"
  PROD_DOMAIN=$(grep '^PROD_DOMAIN=' "$STATE_FILE" | cut -d= -f2)
  STAGE_DOMAIN=$(grep '^STAGE_DOMAIN=' "$STATE_FILE" | cut -d= -f2)
  PROD_DOMAIN="${PROD_DOMAIN:-menu2.highhopesma.com}"
  STAGE_DOMAIN="${STAGE_DOMAIN:-menu2-stage.highhopesma.com}"
  step "Provisioning SSL certificates"
  # Install HTTP-only nginx configs so certbot can run (the full configs reference
  # Let's Encrypt files that don't exist until certbot has run at least once)
  ssh $SSHOPTS "root@$IP" bash <<EOF
set -e

# Production — HTTP-only config for certbot
cat > /etc/nginx/sites-available/highhopes-menu <<'NGINX'
server {
    listen 80;
    server_name $PROD_DOMAIN;
    root /home/highhopes/highhopes-menu/current/frontend-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/highhopes-menu /etc/nginx/sites-enabled/highhopes-menu

# Staging — HTTP-only config for certbot
cat > /etc/nginx/sites-available/highhopes-menu-stage <<'NGINX'
server {
    listen 80;
    server_name $STAGE_DOMAIN;
    root /home/highhopes/highhopes-menu-stage/current/frontend-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/highhopes-menu-stage /etc/nginx/sites-enabled/highhopes-menu-stage

nginx -t && systemctl reload nginx

# Now run certbot — it will modify the configs to add SSL
certbot --nginx -d $PROD_DOMAIN --non-interactive --agree-tos --email admin@highhopesma.com --redirect
certbot --nginx -d $STAGE_DOMAIN --non-interactive --agree-tos --email admin@highhopesma.com --redirect
echo "SSL certificates provisioned."
EOF
  info "SSL done. Verify: https://$PROD_DOMAIN"
  exit 0
fi

if [ "${1:-}" = "--monitor" ]; then
  [ ! -f "$STATE_FILE" ] && die "No provision state found. Run the full provision first."
  IP=$(grep '^IP=' "$STATE_FILE" | cut -d= -f2)
  [ -z "$IP" ] && die "No IP in state file"
  PT_URL="${2:-}"
  step "Installing health monitor"
  scp $SSHOPTS "$PROJECT_DIR/monitor.sh" "root@$IP:/usr/local/bin/highhopes-monitor"
  ssh $SSHOPTS "root@$IP" bash <<EOF
chmod +x /usr/local/bin/highhopes-monitor
echo "PAGERTREE_INTEGRATION_URL=$PT_URL" > /etc/highhopes-monitor.env
# Add cron if not present
if ! crontab -l 2>/dev/null | grep -qF "highhopes-monitor"; then
  (crontab -l 2>/dev/null; echo '*/5 * * * * . /etc/highhopes-monitor.env && /usr/local/bin/highhopes-monitor >> /var/log/highhopes-monitor.log 2>&1') | crontab -
  echo "Monitor cron installed (every 5 min)."
else
  echo "Monitor cron already exists."
fi
EOF
  info "Monitor installed."
  exit 0
fi

if [ "${1:-}" = "--enable-snapshots" ]; then
  [ ! -f "$STATE_FILE" ] && die "No provision state found. Run the full provision first."
  DROPLET_ID=$(grep '^DROPLET_ID=' "$STATE_FILE" | cut -d= -f2)
  [ -z "$DROPLET_ID" ] && die "No droplet ID in state file"
  step "Enabling weekly snapshots"
  do_api POST "/droplets/$DROPLET_ID/actions" \
    -d '{"type":"enable_backups"}' >/dev/null
  info "Weekly snapshots enabled (\$2/month)."
  exit 0
fi

if [ "${1:-}" = "--status" ]; then
  [ ! -f "$STATE_FILE" ] && die "No provision state found."
  cat "$STATE_FILE"
  exit 0
fi

if [ "${1:-}" = "--azure" ]; then
  [ ! -f "$STATE_FILE" ] && die "No provision state found. Run the full provision first."
  PROD_DOMAIN=$(grep '^PROD_DOMAIN=' "$STATE_FILE" | cut -d= -f2)
  STAGE_DOMAIN=$(grep '^STAGE_DOMAIN=' "$STATE_FILE" | cut -d= -f2)
  PROD_DOMAIN="${PROD_DOMAIN:-menu2.highhopesma.com}"
  STAGE_DOMAIN="${STAGE_DOMAIN:-menu2-stage.highhopesma.com}"

  # Read MSAL client ID from frontend/.env
  MSAL_CLIENT_ID=$(grep '^VITE_MSAL_CLIENT_ID=' "$PROJECT_DIR/frontend/.env" | cut -d= -f2)
  [ -z "$MSAL_CLIENT_ID" ] && die "VITE_MSAL_CLIENT_ID not found in frontend/.env"

  step "Registering Azure AD SPA redirect URIs"
  info "App registration: $MSAL_CLIENT_ID"
  info "Redirect URIs to add:"
  echo "    https://$PROD_DOMAIN/auth"
  echo "    https://$STAGE_DOMAIN/auth"

  # Check if az CLI is installed
  if ! command -v az &>/dev/null; then
    echo ""
    echo "Azure CLI (az) is not installed."
    echo "Install it now? This runs: brew install azure-cli"
    printf "  [y/N] "
    read -r INSTALL_AZ
    if [ "$INSTALL_AZ" = "y" ] || [ "$INSTALL_AZ" = "Y" ]; then
      info "Installing Azure CLI..."
      brew install azure-cli
    else
      echo ""
      echo "You can install it manually:"
      echo "  brew install azure-cli"
      echo ""
      echo "Or register the redirect URIs manually in the Azure portal:"
      echo "  https://portal.azure.com → App registrations → $MSAL_CLIENT_ID → Authentication"
      echo "  Add SPA redirect URIs:"
      echo "    https://$PROD_DOMAIN/auth"
      echo "    https://$STAGE_DOMAIN/auth"
      exit 1
    fi
  fi

  # Check if logged in
  if ! az account show &>/dev/null; then
    info "Not logged in to Azure. Opening browser login..."
    az login || die "Azure login failed"
  fi

  # Get the app's object ID (Graph API uses object ID, not client ID)
  OBJECT_ID=$(az ad app show --id "$MSAL_CLIENT_ID" --query "id" -o tsv 2>/dev/null) || \
    die "Failed to find app registration $MSAL_CLIENT_ID. Check that you're logged into the correct tenant."
  info "Object ID: $OBJECT_ID"

  # Get existing SPA redirect URIs
  EXISTING_URIS=$(az rest --method GET \
    --url "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
    --query "spa.redirectUris" -o json 2>/dev/null) || die "Failed to read existing redirect URIs"

  info "Existing SPA redirect URIs:"
  echo "$EXISTING_URIS" | python3 -c "import sys,json; [print('    ' + u) for u in json.load(sys.stdin)]" 2>/dev/null || echo "    (none)"

  # Build merged URI list: existing + new (deduplicated)
  NEW_PROD="https://$PROD_DOMAIN/auth"
  NEW_STAGE="https://$STAGE_DOMAIN/auth"

  MERGED_URIS=$(echo "$EXISTING_URIS" | python3 -c "
import sys, json
uris = set(json.load(sys.stdin) or [])
uris.add('$NEW_PROD')
uris.add('$NEW_STAGE')
print(json.dumps(sorted(uris)))
")

  # Check if anything changed
  EXISTING_COUNT=$(echo "$EXISTING_URIS" | python3 -c "import sys,json; print(len(json.load(sys.stdin) or []))")
  MERGED_COUNT=$(echo "$MERGED_URIS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  if [ "$EXISTING_COUNT" = "$MERGED_COUNT" ]; then
    info "Both redirect URIs are already registered. Nothing to do."
    exit 0
  fi

  # Update the app registration
  info "Updating app registration..."
  az rest --method PATCH \
    --url "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
    --headers "Content-Type=application/json" \
    --body "{\"spa\":{\"redirectUris\":$MERGED_URIS}}" || \
    die "Failed to update redirect URIs"

  # Verify
  UPDATED_URIS=$(az rest --method GET \
    --url "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
    --query "spa.redirectUris" -o json 2>/dev/null)
  info "Updated SPA redirect URIs:"
  echo "$UPDATED_URIS" | python3 -c "import sys,json; [print('    ' + u) for u in json.load(sys.stdin)]"

  info "Azure AD redirect URIs configured."
  exit 0
fi

# ── Validate prerequisites (for full provisioning) ───────────────────────────
[ -z "${DO_API_TOKEN:-}" ] && die "DO_API_TOKEN environment variable is required"

# ── Step 1: Find SSH key ─────────────────────────────────────────────────────
step "Finding SSH key in DigitalOcean account"
SSH_KEYS_JSON=$(do_api GET "/account/keys") || die "Failed to list SSH keys"
SSH_KEY_IDS=$(echo "$SSH_KEYS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ids = [str(k['id']) for k in data.get('ssh_keys', [])]
print(','.join(ids))
")
[ -z "$SSH_KEY_IDS" ] && die "No SSH keys found in your DigitalOcean account. Add one first."
info "Found SSH key(s): $SSH_KEY_IDS"

# ── Step 2: Create droplet ────────────────────────────────────────────────────
step "Creating droplet: $DROPLET_NAME"

# Build SSH key IDs as JSON array
SSH_KEY_ARRAY=$(echo "$SSH_KEYS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ids = [k['id'] for k in data.get('ssh_keys', [])]
print(json.dumps(ids))
")

CREATE_RESPONSE=$(do_api POST "/droplets" -d "{
  \"name\": \"$DROPLET_NAME\",
  \"region\": \"$REGION\",
  \"size\": \"$SIZE\",
  \"image\": \"$IMAGE\",
  \"ssh_keys\": $SSH_KEY_ARRAY,
  \"backups\": true,
  \"monitoring\": true,
  \"tags\": [\"highhopes\"]
}") || die "Failed to create droplet"

DROPLET_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['droplet']['id'])")
CREATED_DROPLET_ID="$DROPLET_ID"
info "Droplet created: ID=$DROPLET_ID"

# ── Step 3: Wait for droplet to be active ─────────────────────────────────────
info "Waiting for droplet to become active..."
for i in $(seq 1 60); do
  DROPLET_JSON=$(do_api GET "/droplets/$DROPLET_ID") || continue
  STATUS=$(echo "$DROPLET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['droplet']['status'])")
  if [ "$STATUS" = "active" ]; then
    IP=$(echo "$DROPLET_JSON" | python3 -c "
import sys, json
nets = json.load(sys.stdin)['droplet']['networks']['v4']
print(next(n['ip_address'] for n in nets if n['type'] == 'public'))
")
    info "Droplet active: IP=$IP (${i}s)"
    break
  fi
  [ "$i" -eq 60 ] && die "Droplet not active after 120s"
  sleep 2
done

# Save state for sub-commands
cat > "$STATE_FILE" <<EOF
DROPLET_ID=$DROPLET_ID
IP=$IP
PROD_DOMAIN=$PROD_DOMAIN
STAGE_DOMAIN=$STAGE_DOMAIN
CREATED=$(date -u '+%Y-%m-%d %H:%M UTC')
EOF
info "State saved to $STATE_FILE"

# ── Step 4: Wait for SSH ──────────────────────────────────────────────────────
wait_for_ssh "$IP"

# ── Step 5: Install system packages ───────────────────────────────────────────
step "Installing system packages"
ssh $SSHOPTS "root@$IP" bash <<'REMOTE'
set -e
export DEBIAN_FRONTEND=noninteractive

# Fresh DO droplets run unattended-upgrades on boot which holds the apt lock.
# Use apt-get's built-in lock timeout instead of trying to race with fuser.
echo "Installing packages (will wait up to 120s for apt lock)..."
apt-get -o DPkg::Lock::Timeout=120 update -qq
apt-get -o DPkg::Lock::Timeout=120 install -y -qq nginx python3 python3-venv certbot python3-certbot-nginx curl netcat-openbsd > /dev/null

# Disable unattended-upgrades for future boots
systemctl disable --now unattended-upgrades apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true

# Create app user home directory
mkdir -p /home/highhopes

# Set timezone
timedatectl set-timezone America/New_York

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

echo "System packages installed."
REMOTE

# ── Step 6: Bootstrap production ──────────────────────────────────────────────
step "Bootstrapping production"

# Create directory structure (bootstrap-server.sh expects an existing layout to migrate from,
# but on a fresh server we just need the directories)
ssh $SSHOPTS "root@$IP" bash <<'REMOTE'
set -e
BASE="/home/highhopes/highhopes-menu"
mkdir -p "$BASE/releases" "$BASE/shared" "$BASE/backups/db"
python3 -m venv "$BASE/shared/backend-venv"
chmod o+x /home/highhopes
chmod o+x "$BASE"
echo "Production directories created."
REMOTE

# ── Step 7: Bootstrap staging ─────────────────────────────────────────────────
step "Bootstrapping staging"
ssh $SSHOPTS "root@$IP" bash <<'REMOTE'
set -e
BASE="/home/highhopes/highhopes-menu-stage"
mkdir -p "$BASE/releases" "$BASE/shared" "$BASE/backups/db"
python3 -m venv "$BASE/shared/backend-venv"
chmod o+x "$BASE"
echo "Staging directories created."
REMOTE

# ── Step 7b: Install systemd services ─────────────────────────────────────────
# Install these before deploys so the services exist even if deploy fails partway
step "Installing systemd services"
scp $SSHOPTS "$PROJECT_DIR/infra/highhopes-menu.service" "root@$IP:/etc/systemd/system/"
scp $SSHOPTS "$PROJECT_DIR/infra/highhopes-menu-stage.service" "root@$IP:/etc/systemd/system/"
ssh $SSHOPTS "root@$IP" bash <<'REMOTE'
set -e
systemctl daemon-reload
systemctl enable highhopes-menu highhopes-menu-stage
echo "Systemd services installed."
REMOTE

# ── Step 8: Restore database from local backup ────────────────────────────────
step "Restoring database"
LATEST_BACKUP=$(ls -t "$PROJECT_DIR/.db-backups/"*.db 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  info "Restoring from: $(basename "$LATEST_BACKUP")"
  scp $SSHOPTS "$LATEST_BACKUP" "root@$IP:/home/highhopes/highhopes-menu/shared/analytics.db"
  # Stage gets a copy too
  scp $SSHOPTS "$LATEST_BACKUP" "root@$IP:/home/highhopes/highhopes-menu-stage/shared/analytics.db"
else
  info "No local DB backup found in .db-backups/ — starting with empty database."
fi

# ── Step 9: Install daily backup cron ─────────────────────────────────────────
step "Installing daily backup cron"
ssh $SSHOPTS "root@$IP" bash <<'REMOTE'
set -e
if ! crontab -l 2>/dev/null | grep -qF "analytics-daily"; then
  (crontab -l 2>/dev/null
   echo '0 3 * * * cp /home/highhopes/highhopes-menu/shared/analytics.db /home/highhopes/highhopes-menu/backups/db/analytics-daily-$(date +\%Y\%m\%d).db && find /home/highhopes/highhopes-menu/backups/db -name "analytics-daily-*.db" -mtime +30 -delete'
  ) | crontab -
  echo "Daily backup cron installed."
fi
REMOTE

# ── Step 10: Deploy production ────────────────────────────────────────────────
step "Deploying production"

# Deploy using DEPLOY_HOST env var (deploy scripts fall back to default if unset)
cd "$PROJECT_DIR"
yes y 2>/dev/null | DEPLOY_HOST="root@$IP" bash deploy.sh || true

# ── Step 11: Deploy staging ───────────────────────────────────────────────────
step "Deploying staging"
cd "$PROJECT_DIR"
DEPLOY_HOST="root@$IP" bash deploy-stage.sh || true

# ── Step 12: Fix nginx for pre-SSL state ──────────────────────────────────────
# The deploy scripts install SSL nginx configs that reference Let's Encrypt files
# that don't exist yet. Replace with HTTP-only configs so nginx starts and serves
# the app until --ssl is run.
step "Installing HTTP-only nginx configs (SSL added later with --ssl)"
ssh $SSHOPTS "root@$IP" bash <<EOF
set -e

cat > /etc/nginx/sites-available/highhopes-menu <<'NGINX'
server {
    listen 80;
    server_name $PROD_DOMAIN;
    root /home/highhopes/highhopes-menu/current/frontend-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

cat > /etc/nginx/sites-available/highhopes-menu-stage <<'NGINX'
server {
    listen 80;
    server_name $STAGE_DOMAIN;
    root /home/highhopes/highhopes-menu-stage/current/frontend-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/highhopes-menu /etc/nginx/sites-enabled/highhopes-menu
ln -sf /etc/nginx/sites-available/highhopes-menu-stage /etc/nginx/sites-enabled/highhopes-menu-stage
nginx -t && systemctl reload nginx

systemctl restart highhopes-menu 2>/dev/null || true
systemctl restart highhopes-menu-stage 2>/dev/null || true
echo "HTTP-only nginx configs installed. Services restarted."
EOF

# ── Done ──────────────────────────────────────────────────────────────────────
# Disable cleanup trap — provisioning succeeded
CREATED_DROPLET_ID=""
trap - EXIT

step "Provisioning complete!"
echo ""
echo "  Droplet ID:  $DROPLET_ID"
echo "  IP Address:  $IP"
echo "  Snapshots:   enabled (weekly, \$2/month)"
echo ""
echo "  Next steps:"
echo "    1. Update DNS at pairdomains.com:"
echo "       $PROD_DOMAIN        → $IP"
echo "       $STAGE_DOMAIN  → $IP"
echo ""
echo "    2. After DNS propagates (check with: dig $PROD_DOMAIN):"
echo "       bash infra/provision-server.sh --ssl"
echo ""
echo "    3. Install health monitor:"
echo "       bash infra/provision-server.sh --monitor <PAGERTREE_URL>"
echo ""
echo "    4. Verify everything works:"
echo "       curl https://$PROD_DOMAIN/api/sessions"
echo "       curl https://$STAGE_DOMAIN/api/sessions"
echo ""
echo "    5. Once confirmed, destroy the old droplet in the DO console."
echo ""
echo "    6. For future deploys to this server:"
echo "       DEPLOY_HOST=root@$IP bash deploy.sh"
echo "       DEPLOY_HOST=root@$IP bash deploy-stage.sh"
echo ""
echo "    To make it the default, update HOST in deploy.sh and deploy-stage.sh."
echo ""
echo "    7. Register redirect URIs in Azure AD app registration:"
echo "       bash infra/provision-server.sh --azure"
echo ""

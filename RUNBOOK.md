# High Hopes Menu — Incident Runbook

**Last updated:** 2026-03-14 · **Version:** 1.2

---

## Quick reference

```
Server:   root@104.236.29.111
SSH:      ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111
Prod URL: https://menu2.highhopesma.com
Stage:    https://menu2-stage.highhopesma.com
```

---

## First response: is it up?

Run this from your laptop to get a quick picture:

```bash
# 1. Can you reach the site at all?
curl -sI https://menu2.highhopesma.com | head -1

# 2. Is the API responding?
curl -sf https://menu2.highhopesma.com/api/sessions | head -c 100

# 3. Can you SSH to the server?
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 "uptime"
```

If step 3 fails, the VPS itself is down — check DigitalOcean console.

---

## Scenario 1: Flask/Waitress is down

**Symptoms:** Site loads (you see the spinner or a blank page) but products never appear. API calls return 502 Bad Gateway.

**Diagnose:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
echo "=== Service status ==="
systemctl status highhopes-menu --no-pager -l

echo ""
echo "=== Is port 5001 listening? ==="
ss -tlnp | grep 5001

echo ""
echo "=== Last 30 lines of journal ==="
journalctl -u highhopes-menu --no-pager -n 30
EOF
```

**Fix:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "systemctl restart highhopes-menu && sleep 2 && systemctl status highhopes-menu --no-pager"
```

**If it keeps crashing**, check the journal for Python tracebacks:

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "journalctl -u highhopes-menu --no-pager -n 100 | grep -A5 'Traceback\|Error\|Exception'"
```

Common causes:
- Corrupt `analytics.db` — see Scenario 6
- Bad `.env` file — verify with: `ssh ... "cat /home/highhopes/highhopes-menu/shared/backend.env"`
- Missing Python dependency — run: `ssh ... "/home/highhopes/highhopes-menu/shared/venv/bin/pip install -r /home/highhopes/highhopes-menu/current/backend/requirements.txt"`

**Note:** Restarting Flask clears all in-memory sessions. Active kiosk sessions will be lost, but kiosks recover automatically (the app creates a new session on the next interaction).

---

## Scenario 2: Nginx is down

**Symptoms:** Site is completely unreachable (connection refused or timeout). SSH still works.

**Diagnose:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
echo "=== Nginx status ==="
systemctl status nginx --no-pager -l

echo ""
echo "=== Config test ==="
nginx -t

echo ""
echo "=== Listening ports ==="
ss -tlnp | grep -E ':80|:443'
EOF
```

**Fix:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "nginx -t && systemctl restart nginx && systemctl status nginx --no-pager"
```

If `nginx -t` fails, the config is broken. Re-copy it from the repo:

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cp /home/highhopes/highhopes-menu/infra/nginx.conf /etc/nginx/sites-available/highhopes-menu
ln -sf /etc/nginx/sites-available/highhopes-menu /etc/nginx/sites-enabled/highhopes-menu
nginx -t && systemctl restart nginx
EOF
```

---

## Scenario 3: SSL certificate expired

**Symptoms:** Browser shows certificate warning. Monitor reports "SSL cert expires in X day(s)".

**Diagnose:**

```bash
# Check cert expiry from your laptop
echo | openssl s_client -connect menu2.highhopesma.com:443 -servername menu2.highhopesma.com 2>/dev/null \
  | openssl x509 -noout -enddate
```

**Fix:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "certbot renew --nginx && systemctl reload nginx"
```

If renewal fails:

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "certbot --nginx -d menu2.highhopesma.com -n --redirect"
```

---

## Scenario 4: Dutchie API is unreachable

**Symptoms:** Site loads, shows spinner, then either shows "Live menu unavailable — showing last known product list" (amber banner) or "unavailable" error message. The Flask API is fine.

**This is not something you can fix** — it's a Dutchie outage. The app has built-in resilience:

1. **localStorage cache**: If Dutchie is down, the app serves the last successful product list from the browser's localStorage. Users see an amber "last known product list" banner but can still browse and order.
2. **3 retries with backoff**: The initial load retries 3 times before falling back to cache.
3. **60-second background refresh**: Once Dutchie recovers, products update automatically within 60 seconds.

**Verify it's Dutchie and not your app:**

```bash
# Test the Dutchie API directly (uses your creds from .env.local)
source frontend/.env.local
curl -sf -X POST https://plus.dutchie.com/plus/2021-07/graphql \
  -H "Authorization: Bearer $VITE_DUTCHIE_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ menu(retailerId: \"'$VITE_DUTCHIE_RETAILER_ID'\") { products(pagination: {limit: 1}) { id } } }"}' \
  | head -c 200
```

If this returns an error or times out, it's a Dutchie problem. Wait it out.

---

## Scenario 5: Disk full

**Symptoms:** Various failures — Flask can't write to SQLite, Nginx can't write logs, service won't start.

**Diagnose:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
echo "=== Disk usage ==="
df -h /

echo ""
echo "=== Biggest directories ==="
du -sh /var/log/* 2>/dev/null | sort -rh | head -10

echo ""
echo "=== Analytics DB size ==="
ls -lh /home/highhopes/highhopes-menu/shared/analytics.db
ls -lh /home/highhopes/highhopes-menu-stage/shared/analytics.db 2>/dev/null

echo ""
echo "=== DB backup count ==="
ls /home/highhopes/highhopes-menu/backups/db/ 2>/dev/null | wc -l
EOF
```

**Fix:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
# Rotate logs
journalctl --vacuum-time=7d
find /var/log -name "*.gz" -mtime +7 -delete

# Clean apt cache
apt-get clean
EOF
```

---

## Scenario 6: SQLite database corruption

**Symptoms:** Flask crashes with "database is malformed" or "disk I/O error" in the journal.

**Diagnose:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "/home/highhopes/highhopes-menu/shared/venv/bin/python3 -c \"
import sqlite3
conn = sqlite3.connect('/home/highhopes/highhopes-menu/shared/analytics.db')
conn.execute('PRAGMA integrity_check')
print(conn.execute('PRAGMA integrity_check').fetchone())
\""
```

**Fix — restore from backup:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu
systemctl stop highhopes-menu

# Find the latest backup
LATEST=$(ls -t backups/db/*.db 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  echo "Restoring from: $LATEST"
  cp shared/analytics.db shared/analytics.db.corrupt.$(date +%s)
  cp "$LATEST" shared/analytics.db
else
  echo "No backups found — see rebuild option below"
fi

systemctl start highhopes-menu
EOF
```

Backups are stored at `/home/highhopes/highhopes-menu/backups/db/` (30 retained). You also have local copies in `.db-backups/` on the dev machine. To restore from a local backup:

```bash
scp .db-backups/latest.db root@104.236.29.111:/home/highhopes/highhopes-menu/shared/analytics.db
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 "systemctl restart highhopes-menu"
```

**Fix — rebuild from dump** (if backups are also corrupt):

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu/shared
cp analytics.db analytics.db.corrupt.$(date +%s)
sqlite3 analytics.db ".dump" > dump.sql
rm analytics.db
sqlite3 analytics.db < dump.sql
rm dump.sql
systemctl restart highhopes-menu
EOF
```

**Nuclear option** — if the dump also fails, you lose analytics history but the app keeps working:

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu/shared
mv analytics.db analytics.db.corrupt.$(date +%s)
systemctl restart highhopes-menu
# Flask will create a fresh database on startup
EOF
```

The only data lost is analytics events and bundle definitions. Bundles would need to be re-created from the staging database or manually.

---

## Scenario 7: Bad deploy broke the site

**Symptoms:** Site was working, you deployed, now it's broken.

There are three ways to roll back, all doing the same thing under the hood (swap the `current` symlink to a previous release directory, restart the service):

**Option A — It already happened automatically.** The production deploy script waits up to 30 seconds for the API to respond after restarting. If the health check fails, it automatically reverts to the previous release. Check the deploy output — if you see "ROLLING BACK", you're already on the old release.

**Option B — CLI rollback** (from your laptop):

```bash
bash rollback.sh            # list releases (current marked with *)
bash rollback.sh 20260312   # roll back by timestamp (production)
bash rollback.sh --stage c8eae26   # roll back by git SHA (staging)
```

If a partial match hits multiple releases, the script picks the latest one. It backs up the database, installs the target release's Python dependencies, swaps the symlink, restarts the service, and verifies the API responds.

**Option C — Admin UI** (from a browser): Go to `/budtender` → Releases tab. Shows all releases with deploy metadata and E2E test results. Click to roll back — useful if you're away from your laptop or a non-developer needs to act.

**Option D — Emergency rollback page** (from a browser): Go to `/rollback.html`. This is a standalone static HTML page with zero dependencies on the Vue app — it talks directly to the `/api/admin/releases` and `/api/admin/rollback` API endpoints. Use this when the deploy broke the frontend itself (bad JS build, white screen, etc.) and the `/budtender` UI won't load. It only requires:
- Nginx running (to serve the static file and proxy to the API)
- Flask/Waitress running (to handle the rollback API calls)
- A browser

It does **not** need the Vue JS bundle, Node.js, or the Dutchie API.

---

## Scenario 8: E2E tests failing but site looks fine

**Symptoms:** PagerTree alert from GitHub Actions, but you visit the site and it works.

This usually means:
1. **Flaky test** — a timing issue in the Playwright tests, not a real outage
2. **Dutchie was slow** — products took >25 seconds to load, exceeding the test timeout
3. **GitHub Actions issue** — runner was slow or had network problems

**Check the failure details:**

```bash
# List recent e2e runs
gh run list --workflow=e2e-monitor.yml --limit=5

# View a specific failed run (replace RUN_ID)
gh run view RUN_ID --log-failed
```

**If the next run passes**, it was transient. No action needed.

**If it keeps failing**, run the tests locally against prod to reproduce:

```bash
cd monitor && E2E_BASE_URL=https://menu2.highhopesma.com npx playwright test --reporter=list
```

---

## Scenario 9: Server is completely unreachable

**Symptoms:** SSH times out, site unreachable, nothing works.

1. **Check DigitalOcean console** — log in to DigitalOcean and check the droplet status. Use the web console if SSH is down.
2. **Power cycle** — if the droplet is running but unresponsive, try a power cycle from the DigitalOcean control panel.
3. **After reboot**, both systemd services (prod + stage) will start automatically. Verify:

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
systemctl status highhopes-menu --no-pager
systemctl status highhopes-menu-stage --no-pager
systemctl status nginx --no-pager
ss -tlnp | grep -E ':80|:443|:5001|:5002'
EOF
```

---

## Scenario 10: PagerTree alert but you can't investigate right now

Acknowledge the alert in PagerTree to stop escalation. The kiosk has graceful degradation:

- **Flask down**: Kiosk shows loading spinner. Customers can't browse but the physical store is unaffected.
- **Dutchie down**: Kiosk shows cached product list with an amber banner. Customers can still browse and order.
- **Full outage**: Kiosk shows loading screen. Staff can take orders manually.

This is an in-store display, not an e-commerce site. A few minutes of downtime is inconvenient, not catastrophic.

---

## Scenario 11: Staff can't sign in to budtender/bundles/analytics

**Symptoms:** Staff click "Sign in with Microsoft" but get an error, or the login loop redirects back to the sign-in page.

**Common causes and fixes:**

1. **Azure app registration misconfigured** — Verify the redirect URIs are registered as **SPA** (not Web) platform type in the Azure portal under the app registration's Authentication page. Required URIs:
   - `http://localhost:5173/auth` (dev)
   - `https://menu2-stage.highhopesma.com/auth` (staging)
   - `https://menu2.highhopesma.com/auth` (production)

2. **MSAL env vars missing from build** — The frontend must be built with the correct env vars. Check:
   - `frontend/.env` has `VITE_MSAL_CLIENT_ID` and `VITE_MSAL_TENANT_ID`
   - The correct `.env.production` or `.env.staging` has the right `VITE_MSAL_REDIRECT_URI`
   - Rebuild and redeploy if missing

3. **Staff session expired** — Sessions last 30 minutes. Staff simply need to sign in again. This is by design.

4. **Kiosk inactivity cleared the session** — If someone used the kiosk browser for staff pages, the 2-minute kiosk inactivity timer clears the MSAL session. Staff should use a separate browser/tab for admin pages.

5. **Microsoft Entra ID outage** — Check [Azure status](https://status.azure.com). If Microsoft's login service is down, staff auth won't work, but this does not affect kiosk customers at all.

**Note:** Staff authentication is entirely client-side (MSAL browser library + localStorage). There is no server-side component. The Flask backend is not involved.

---

## Disaster recovery

### Backup inventory

The system maintains multiple layers of database backups:

| Backup type | Location (on server) | Frequency | Retention |
|---|---|---|---|
| Pre-deploy | `backups/db/analytics-{RELEASE}-pre-deploy.db` | Every deploy | Last 30 |
| Pre-rollback | `backups/db/analytics-{TIMESTAMP}-pre-rollback.db` | Every rollback | Last 30 |
| Daily cron | `backups/db/analytics-daily-{YYYYMMDD}.db` | 3 AM daily | 30 days |
| Local copies | `.db-backups/` on dev machine | Every prod deploy | Manual |
| DO snapshots | DigitalOcean control panel | Weekly | Per DO plan |

All server backups are in `/home/highhopes/highhopes-menu/backups/db/`.

**List available backups:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 \
  "ls -lht /home/highhopes/highhopes-menu/backups/db/ | head -20"
```

**List local backups:**

```bash
ls -lht .db-backups/
```

---

### Versioned releases & rollback

Each deploy creates a timestamped release directory under `/home/highhopes/highhopes-menu/releases/`. A `current` symlink points to the active release. All three rollback methods (auto, CLI, admin UI) work the same way: swap the symlink, restart the service. See **Scenario 7** for details on each option.

**Release metadata:** Each release includes a `.deploy-meta` file with SHA, timestamp, deployer, version, branch, and (for staging) E2E test results.

**Release retention:** Only the last 10 releases are kept; older ones are automatically cleaned up. The current release is never deleted.

---

### Recovering from complete server loss

If the server is destroyed or unrecoverable, you can rebuild from scratch using the provisioning script. Prerequisites:
- `DO_API_TOKEN` environment variable set (DigitalOcean API token)
- SSH keys registered in your DigitalOcean account
- Local `.db-backups/` directory with database backups (if you want to restore data)

**Step 1: Provision a new server**

```bash
bash infra/provision-server.sh
```

This automatically:
1. Creates a new DigitalOcean droplet (Ubuntu 24.04, 1GB RAM)
2. Installs system packages (nginx, Python 3, certbot, etc.)
3. Creates the directory structure for prod and staging
4. Installs systemd services
5. Restores the latest database from `.db-backups/` (or starts fresh)
6. Deploys both production and staging from the current git branch
7. Saves the new droplet IP to `.provision-state`

If provisioning fails partway through, the script automatically cleans up the droplet.

**Step 2: Update DNS**

Point `menu2.highhopesma.com` and `menu2-stage.highhopesma.com` to the new IP address (managed at pairdomains.com). Wait for DNS to propagate.

**Step 3: Install SSL certificates**

```bash
bash infra/provision-server.sh --ssl
```

**Step 4: Install the health monitor**

```bash
bash infra/provision-server.sh --monitor <PAGERTREE_INTEGRATION_URL>
```

**Step 5: Enable weekly snapshots**

```bash
bash infra/provision-server.sh --enable-snapshots
```

**Step 6: Verify**

```bash
bash infra/provision-server.sh --status
curl -sI https://menu2.highhopesma.com | head -1
```

---

### What data survives vs. what's lost

| Component | Survives restart? | Survives rollback? | Survives server rebuild? |
|---|---|---|---|
| Product data (from Dutchie) | Yes (re-fetched) | Yes (re-fetched) | Yes (re-fetched) |
| Analytics events | Yes (SQLite) | Yes (shared DB) | If backup available |
| Bundle definitions | Yes (SQLite) | Yes (shared DB) | If backup available |
| Settings overrides | Yes (SQLite) | Yes (shared DB) | If backup available |
| Kiosk sessions | No (in-memory) | No (in-memory) | No |
| localStorage product cache | Yes (per browser) | Yes (per browser) | Yes (per browser) |
| Staff auth sessions | Yes (MSAL/browser) | Yes (MSAL/browser) | Yes (MSAL/browser) |

**Key point:** The database is stored in `/home/highhopes/highhopes-menu/shared/analytics.db`, which is outside the release directories and persists across deploys and rollbacks. Only a server loss or DB corruption puts it at risk, and backups exist at multiple levels.

---

### Monitoring & alerting overview

| Monitor | Frequency | What it checks | Alerts via |
|---|---|---|---|
| `monitor.sh` (cron) | Every 5 min | HTTP 200, API CRUD, SSL expiry (<14 days) | PagerTree webhook |
| GitHub Actions E2E | Every 15 min | Full Playwright test suite against prod | PagerTree webhook |
| Systemd `Restart=always` | On crash | Flask/Waitress process health | Auto-restarts (5s delay) |
| Deploy health check | On deploy | API port 5001 responds within 30s | Auto-rollback |

The monitor cron (`/etc/highhopes-monitor.env` for PagerTree URL) runs on the server itself. If the server is down, the GitHub Actions E2E monitor (running externally) will catch it within 15 minutes.

---

## Health check cheat sheet

Run this from your laptop for a full status check:

```bash
HOST="root@104.236.29.111"
SSH="ssh -o IdentityAgent=SSH_AUTH_SOCK $HOST"

echo "--- Site ---"
curl -sI https://menu2.highhopesma.com | head -1

echo "--- API ---"
curl -sf https://menu2.highhopesma.com/api/sessions | head -c 80
echo ""

echo "--- Server ---"
$SSH "uptime; echo ''; df -h / | tail -1; echo ''; free -h | head -2"

echo "--- Services ---"
$SSH "systemctl is-active highhopes-menu highhopes-menu-stage nginx"

echo "--- Ports ---"
$SSH "ss -tlnp | grep -E ':80|:443|:5001|:5002'"

echo "--- SSL expiry ---"
echo | openssl s_client -connect menu2.highhopesma.com:443 -servername menu2.highhopesma.com 2>/dev/null \
  | openssl x509 -noout -enddate
```

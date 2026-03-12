# High Hopes Menu — Incident Runbook

**Last updated:** 2026-03-11 · **Version:** 1.0

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
- Bad `.env` file — verify with: `ssh ... "cat /home/highhopes/highhopes-menu/backend/.env"`
- Missing Python dependency — run: `ssh ... "/home/highhopes/highhopes-menu/backend/venv/bin/pip install -r /home/highhopes/highhopes-menu/backend/requirements.txt"`

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
ls -lh /home/highhopes/highhopes-menu/backend/analytics.db
ls -lh /home/highhopes/highhopes-menu-stage/backend/analytics.db 2>/dev/null
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
  "/home/highhopes/highhopes-menu/backend/venv/bin/python3 -c \"
import sqlite3
conn = sqlite3.connect('/home/highhopes/highhopes-menu/backend/analytics.db')
conn.execute('PRAGMA integrity_check')
print(conn.execute('PRAGMA integrity_check').fetchone())
\""
```

**Fix — rebuild from dump:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu/backend
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
cd /home/highhopes/highhopes-menu/backend
mv analytics.db analytics.db.corrupt.$(date +%s)
systemctl restart highhopes-menu
# Flask will create a fresh database on startup
EOF
```

The only data lost is analytics events and bundle definitions. Bundles would need to be re-created from the staging database or manually.

---

## Scenario 7: Bad deploy broke the site

**Symptoms:** Site was working, you deployed, now it's broken.

**Rollback to previous version:**

```bash
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu

echo "=== Current commit ==="
git log --oneline -1

echo ""
echo "=== Previous commits (pick one to roll back to) ==="
git log --oneline -10
EOF
```

Then roll back:

```bash
# Replace COMMIT_SHA with the hash you want to revert to
ssh -o IdentityAgent=SSH_AUTH_SOCK root@104.236.29.111 bash <<'EOF'
cd /home/highhopes/highhopes-menu
git checkout COMMIT_SHA
/home/highhopes/highhopes-menu/backend/venv/bin/pip install --quiet -r backend/requirements.txt
systemctl restart highhopes-menu
EOF
```

For frontend rollback, you also need to rebuild and re-sync from that commit locally:

```bash
git checkout COMMIT_SHA
cd frontend && npm run build && cd ..
bash deploy.sh
```

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

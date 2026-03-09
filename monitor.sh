#!/usr/bin/env bash
# Synthetic monitor for menu2.highhopesma.com
#
# Tests the full session lifecycle. Alerts via Twilio SMS on failure.
#
# Environment variables (sourced from /etc/highhopes-monitor.env):
#   SENDGRID_API_KEY  — SendGrid API key
#   ALERT_FROM        — from address  (e.g. david.coletta@high-hopes.biz)
#   ALERT_TO          — to address    (e.g. david.coletta@high-hopes.biz)
#
# Cron example (every 5 minutes, on the server):
#   */5 * * * * . /etc/highhopes-monitor.env && /usr/local/bin/highhopes-monitor \
#               >> /var/log/highhopes-monitor.log 2>&1

set -uo pipefail

BASE="https://menu2.highhopesma.com"
SENDGRID_API_KEY="${SENDGRID_API_KEY:-}"
ALERT_FROM="${ALERT_FROM:-}"
ALERT_TO="${ALERT_TO:-}"
SESSION_ID="monitor-test-$(date +%s)"
PASS=0
FAIL=0
ERRORS=""

# ── Helpers ──────────────────────────────────────────────────────────────────

ok()   { PASS=$((PASS + 1)); }
fail() { FAIL=$((FAIL + 1)); ERRORS="${ERRORS}\n  ✗ $1"; }

http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$@" 2>/dev/null || echo "000"
}

# ── Checks ───────────────────────────────────────────────────────────────────

# 1. Static site
STATUS=$(http_status "$BASE/")
[ "$STATUS" = "200" ] && ok || fail "Static site returned HTTP $STATUS (expected 200)"

# 2. GET /api/sessions
BODY=$(curl -sf --max-time 10 "$BASE/api/sessions" 2>/dev/null || echo "FAIL")
if echo "$BODY" | grep -q '^\['; then
  ok
else
  fail "GET /api/sessions did not return a JSON array (got: ${BODY:0:80})"
fi

# 3. POST /api/session — create a test session
STATUS=$(http_status -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"selections\":{\"monitor-sku\":{\"name\":\"Monitor Test Product\",\"qty\":1,\"price\":1,\"unitWeight\":\"1g\",\"category\":\"FLOWER\"}}}")
[ "$STATUS" = "200" ] && ok || fail "POST /api/session returned HTTP $STATUS (expected 200)"

# 4. GET /api/session/:id — verify it exists
STATUS=$(http_status "$BASE/api/session/$SESSION_ID")
[ "$STATUS" = "200" ] && ok || fail "GET /api/session/$SESSION_ID returned HTTP $STATUS (expected 200)"

# 5. DELETE /api/session/:id — clean up
STATUS=$(http_status -X DELETE "$BASE/api/session/$SESSION_ID")
[ "$STATUS" = "200" ] && ok || fail "DELETE /api/session/$SESSION_ID returned HTTP $STATUS (expected 200)"

# 6. Confirm deletion (should 404 now)
STATUS=$(http_status "$BASE/api/session/$SESSION_ID")
[ "$STATUS" = "404" ] && ok || fail "Session still accessible after DELETE — returned HTTP $STATUS (expected 404)"

# 7. SSL cert — alert if expiring within 14 days
EXPIRY=$(echo | openssl s_client -connect menu2.highhopesma.com:443 -servername menu2.highhopesma.com 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -z "$EXPIRY" ]; then
  fail "SSL cert check failed — could not retrieve certificate"
else
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  if [ "$DAYS_LEFT" -lt 14 ]; then
    fail "SSL cert expires in ${DAYS_LEFT} day(s) (${EXPIRY})"
  else
    ok
  fi
fi

# ── Report ───────────────────────────────────────────────────────────────────

TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

if [ "$FAIL" -gt 0 ]; then
  SUBJECT="[ALERT] menu2.highhopesma.com — $FAIL check(s) failed"
  MSG="${SUBJECT} at ${TIMESTAMP}$(printf '%b' "$ERRORS")"

  echo "$MSG" >&2

  if [ -n "$SENDGRID_API_KEY" ] && [ -n "$ALERT_FROM" ] && [ -n "$ALERT_TO" ]; then
    PAYLOAD=$(printf '{"personalizations":[{"to":[{"email":"%s"}]}],"from":{"email":"%s"},"subject":"%s","content":[{"type":"text/plain","value":"%s"}]}' \
      "$ALERT_TO" "$ALERT_FROM" "$SUBJECT" \
      "$(printf '%b' "$MSG" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n')")
    curl -sf -X POST "https://api.sendgrid.com/v3/mail/send" \
      -H "Authorization: Bearer ${SENDGRID_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      >/dev/null 2>&1 || echo "WARNING: SendGrid API call failed"
  fi

  exit 1
else
  echo "[OK] All $PASS checks passed at $TIMESTAMP"
fi

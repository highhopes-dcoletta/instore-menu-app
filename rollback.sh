#!/bin/bash
# rollback.sh — roll back to a previous release
# Usage:
#   ./rollback.sh              # list available releases
#   ./rollback.sh <partial>    # rollback to a release matching <partial>
#   ./rollback.sh --stage ...  # operate on staging instead of production

set -e

# ── Parse flags ──────────────────────────────────────────────────────────────
STAGE=false
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --stage) STAGE=true ;;
    *) TARGET="$arg" ;;
  esac
done

HOST="root@104.236.29.111"
SSHOPTS="-o IdentityAgent=SSH_AUTH_SOCK"

if [ "$STAGE" = true ]; then
  BASE="/home/highhopes/highhopes-menu-stage"
  SERVICE="highhopes-menu-stage"
  echo "==> Operating on STAGING"
else
  BASE="/home/highhopes/highhopes-menu"
  SERVICE="highhopes-menu"
  echo "==> Operating on PRODUCTION"
fi

# ── List releases ────────────────────────────────────────────────────────────
CURRENT=$(ssh $SSHOPTS "$HOST" "readlink $BASE/current | xargs basename")

if [ -z "$TARGET" ]; then
  echo ""
  echo "Available releases (current marked with *):"
  echo ""
  ssh $SSHOPTS "$HOST" bash <<EOF
cd $BASE/releases
for dir in \$(ls -1d */ | sort -r); do
  name=\$(basename "\$dir")
  if [ "\$name" = "$CURRENT" ]; then
    echo "  * \$name"
  else
    echo "    \$name"
  fi
done
EOF
  echo ""
  echo "Usage: $0 [--stage] <release-name-or-partial-match>"
  exit 0
fi

# ── Find matching release ────────────────────────────────────────────────────
MATCH=$(ssh $SSHOPTS "$HOST" "ls -1d $BASE/releases/*${TARGET}*/ 2>/dev/null | sort | tail -1 | xargs basename 2>/dev/null || true")

if [ -z "$MATCH" ] || [ "$MATCH" = "." ]; then
  echo "ERROR: No release matching '$TARGET' found." >&2
  exit 1
fi

if [ "$MATCH" = "$CURRENT" ]; then
  echo "'$MATCH' is already the current release."
  exit 0
fi

echo "==> Rolling back: $CURRENT → $MATCH"

# ── Pre-rollback DB backup ──────────────────────────────────────────────────
echo "==> Backing up database before rollback..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ssh $SSHOPTS "$HOST" bash <<EOF
set -e
mkdir -p $BASE/backups/db
if [ -f "$BASE/shared/analytics.db" ]; then
  cp $BASE/shared/analytics.db $BASE/backups/db/analytics-${TIMESTAMP}-pre-rollback.db
  echo "  DB backed up."
fi
EOF

# ── Reinstall pip deps for target release ────────────────────────────────────
echo "==> Installing Python dependencies for $MATCH..."
ssh $SSHOPTS "$HOST" "$BASE/shared/backend-venv/bin/pip install --quiet -r $BASE/releases/$MATCH/backend/requirements.txt"

# ── Swap symlink ─────────────────────────────────────────────────────────────
echo "==> Swapping symlink..."
ssh $SSHOPTS "$HOST" "ln -sfn $BASE/releases/$MATCH $BASE/current"

# ── Restart service ──────────────────────────────────────────────────────────
echo "==> Restarting service..."
ssh $SSHOPTS "$HOST" "systemctl restart $SERVICE"

# ── Health check ─────────────────────────────────────────────────────────────
PORT=5001
[ "$STAGE" = true ] && PORT=5002

echo "==> Waiting for API..."
for i in $(seq 1 30); do
  if ssh $SSHOPTS "$HOST" "nc -z 127.0.0.1 $PORT" 2>/dev/null; then
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
echo "==> Rolled back to: $MATCH"

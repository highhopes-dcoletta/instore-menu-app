#!/bin/bash
# release-notes.sh — generate release notes JSON from closed GitHub issues
# Usage: ./scripts/release-notes.sh <prev_sha>
# Output: JSON array like [{"number":51,"title":"One-click rollback"}]
# If prev_sha is empty or unknown, outputs []

PREV_SHA="$1"
CURRENT_SHA=$(git rev-parse HEAD)

if [ -z "$PREV_SHA" ] || ! git cat-file -t "$PREV_SHA" >/dev/null 2>&1; then
  echo "[]"
  exit 0
fi

# Extract unique issue numbers from commit messages
ISSUE_NUMS=$(git log --oneline "$PREV_SHA".."$CURRENT_SHA" 2>/dev/null | grep -oE '#[0-9]+' | sort -t'#' -k2 -n -u | tr -d '#')

if [ -z "$ISSUE_NUMS" ]; then
  echo "[]"
  exit 0
fi

# Fetch issue titles via gh CLI, build JSON array
NOTES="["
FIRST=true
for NUM in $ISSUE_NUMS; do
  TITLE=$(gh issue view "$NUM" --json title --jq '.title' 2>/dev/null)
  if [ -n "$TITLE" ]; then
    # Escape double quotes and backslashes for JSON
    TITLE=$(echo "$TITLE" | sed 's/\\/\\\\/g; s/"/\\"/g')
    $FIRST || NOTES="$NOTES,"
    NOTES="$NOTES{\"number\":$NUM,\"title\":\"$TITLE\"}"
    FIRST=false
  fi
done
NOTES="$NOTES]"

echo "$NOTES"

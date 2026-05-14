#!/bin/bash
# deploy-preview.sh
# Commits & pushes the current branch to origin, then bumps the app version
# in the Supabase preview database so all clients clear their cache on reload.

set -e

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Preview DB credentials (read from ./vars) ──────────────────────────────
VARS_FILE="$(cd "$(dirname "$0")/.." && pwd)/vars"
if [[ ! -f "$VARS_FILE" ]]; then
  echo -e "${RED}✗ vars file not found at $VARS_FILE${NC}"
  exit 1
fi

DIRECT_URL=$(grep '^DIRECT_URL=' "$VARS_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')

if [[ -z "$DIRECT_URL" ]]; then
  echo -e "${RED}✗ DIRECT_URL not found in vars file${NC}"
  exit 1
fi

# ── Parse commit message from argument or prompt ───────────────────────────
COMMIT_MSG="${1:-}"
if [[ -z "$COMMIT_MSG" ]]; then
  echo -e "${CYAN}${BOLD}Enter commit message:${NC} "
  read -r COMMIT_MSG
fi

if [[ -z "$COMMIT_MSG" ]]; then
  echo -e "${RED}✗ Commit message cannot be empty${NC}"
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  🚀  Deploy to Preview${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Step 1: Git commit & push ──────────────────────────────────────────────
echo -e "${CYAN}[1/3] Git — staging all changes...${NC}"
git add -A

# Only commit if there's something staged
if git diff --cached --quiet; then
  echo -e "${YELLOW}  ⚠  Nothing to commit, working tree clean.${NC}"
else
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}  ✔ Committed: \"$COMMIT_MSG\"${NC}"
fi

echo -e "${CYAN}[2/3] Git — pushing branch '${BRANCH}' to origin...${NC}"
git push origin "$BRANCH"
echo -e "${GREEN}  ✔ Pushed to origin/${BRANCH}${NC}"

# ── Step 2: Bump app version in preview DB ────────────────────────────────
echo -e "${CYAN}[3/3] Supabase preview — bumping app version...${NC}"

# Fetch current version
CURRENT_VERSION=$(psql "$DIRECT_URL" -t -A -c \
  "SELECT app_version FROM system_config LIMIT 1;" 2>/dev/null || echo "")

if [[ -z "$CURRENT_VERSION" ]]; then
  CURRENT_VERSION="1.0.0"
  echo -e "${YELLOW}  ⚠  Could not read current version, defaulting to 1.0.0${NC}"
fi

# Auto-increment the patch segment (e.g. 1.0.4 → 1.0.5)
MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)

# Strip any non-numeric suffix from patch
PATCH=$(echo "$PATCH" | sed 's/[^0-9].*//')
PATCH=$((PATCH + 1))

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

psql "$DIRECT_URL" -c \
  "UPDATE system_config SET app_version = '${NEW_VERSION}';" > /dev/null

echo -e "${GREEN}  ✔ App version bumped: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ✅  Deploy complete!${NC}"
echo -e "  Branch  : ${BRANCH}"
echo -e "  Version : ${CURRENT_VERSION} → ${NEW_VERSION}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

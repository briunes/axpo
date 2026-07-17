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
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  🚀  Deploy to Preview${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Secret scrubbing helpers ───────────────────────────────────────────────
# Files that may contain real secrets that must not be committed to git.
# Each entry is a regex pattern (for grep -E) + the sed replacement key.
SECRET_FILES=(
  "$ROOT_DIR/.env.local.example"
  "$ROOT_DIR/.env.dev"
  "$ROOT_DIR/vars"
  "$ROOT_DIR/vars prod"
)
SECRET_PATTERNS=(
  'SENTRY_AUTH_TOKEN=sntryu_[A-Za-z0-9_]+'
  'SUPABASE_SECRET_KEY=["'\'']?sb_secret_[A-Za-z0-9_-]+["'\'']?'
  'SUPABASE_SERVICE_ROLE_KEY=["'\'']?sb_secret_[A-Za-z0-9_-]+["'\'']?'
)
SECRET_PLACEHOLDERS=(
  'SENTRY_AUTH_TOKEN=your_sentry_auth_token_here'
  'SUPABASE_SECRET_KEY=sb_secret_placeholder'
  'SUPABASE_SERVICE_ROLE_KEY=sb_secret_placeholder'
)

# Stores original lines so we can restore after push
# Using parallel arrays for bash 3.2 compatibility (macOS default)
_SECRET_KEYS=()
_SECRET_VALS=()
_SECRET_PLACEHOLDER_VALS=()

scrub_secrets() {
  for f in "${SECRET_FILES[@]}"; do
    [[ -f "$f" ]] || continue
    local redacted=0
    local rule_index
    for rule_index in "${!SECRET_PATTERNS[@]}"; do
      local pattern="${SECRET_PATTERNS[$rule_index]}"
      local placeholder="${SECRET_PLACEHOLDERS[$rule_index]}"
      local original
      original=$(grep -E "$pattern" "$f" || true)
      if [[ -n "$original" ]]; then
        _SECRET_KEYS+=("$f")
        _SECRET_VALS+=("$original")
        _SECRET_PLACEHOLDER_VALS+=("$placeholder")
        sed -i '' -E "s|${pattern}|${placeholder}|g" "$f"
        redacted=1
      fi
    done
    if [[ "$redacted" -eq 1 ]]; then
      echo -e "${YELLOW}  ⚠  Redacted secret in: $(basename "$f")${NC}"
    fi
  done
}

restore_secrets() {
  local i
  for i in "${!_SECRET_KEYS[@]}"; do
    local f="${_SECRET_KEYS[$i]}"
    local original="${_SECRET_VALS[$i]}"
    local placeholder="${_SECRET_PLACEHOLDER_VALS[$i]}"
    sed -i '' "s|${placeholder}|${original}|g" "$f"
    echo -e "${CYAN}  ↩  Restored secret in: $(basename "$f")${NC}"
  done
}

# ── Step 1: Git commit & push ──────────────────────────────────────────────
echo -e "${CYAN}[1/3] Git — staging all changes...${NC}"

# Scrub secrets before staging
scrub_secrets

git add -A

# Restore secrets on exit (success or failure) so local files are never left redacted
trap restore_secrets EXIT

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

# Restore secrets immediately after push (trap will also run on exit, idempotent)
restore_secrets
trap - EXIT

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

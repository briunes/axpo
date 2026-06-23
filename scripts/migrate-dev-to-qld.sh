#!/usr/bin/env bash
# migrate-dev-to-qld.sh
#
# Opens/reuses a PR from dev to qld, then applies any missing Prisma
# migrations to the QLD/QUA database configured in env.qld.
#
# Usage:
#   ./scripts/migrate-dev-to-qld.sh
#   ./scripts/migrate-dev-to-qld.sh --yes
#   ./scripts/migrate-dev-to-qld.sh --dry-run
#   ./scripts/migrate-dev-to-qld.sh --skip-pr
#   ./scripts/migrate-dev-to-qld.sh --skip-migrations
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${CYAN}${BOLD}${1}${NC}"; }
ok()   { echo -e "${GREEN}  v ${1}${NC}"; }
warn() { echo -e "${YELLOW}  ! ${1}${NC}"; }
die()  { echo -e "${RED}  x ${1}${NC}"; exit 1; }

HEAD_BRANCH="dev"
BASE_BRANCH="qld"
ENV_FILE="env.qld"
DRY_RUN=false
YES=false
SKIP_PR=false
SKIP_MIGRATIONS=false
PR_TITLE=""
PR_BODY=""

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --head <branch>          Source branch for the PR (default: dev)
  --base <branch>          Target branch for the PR (default: qld)
  --env-file <path>        Env file for the QLD/QUA database (default: env.qld)
  --title <text>           Pull request title
  --body <text>            Pull request body
  --yes                   Skip confirmation prompts
  --dry-run               Print what would happen without writes
  --skip-pr               Do not create/reuse the pull request
  --skip-migrations       Do not run Prisma migrations
  -h, --help              Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --head) HEAD_BRANCH="${2:-}"; shift 2 ;;
    --base) BASE_BRANCH="${2:-}"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --title) PR_TITLE="${2:-}"; shift 2 ;;
    --body) PR_BODY="${2:-}"; shift 2 ;;
    --yes) YES=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-pr) SKIP_PR=true; shift ;;
    --skip-migrations) SKIP_MIGRATIONS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -n "$HEAD_BRANCH" ]] || die "--head cannot be empty"
[[ -n "$BASE_BRANCH" ]] || die "--base cannot be empty"
[[ -n "$ENV_FILE" ]] || die "--env-file cannot be empty"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_PATH="$ROOT_DIR/$ENV_FILE"
SCHEMA_PATH="$ROOT_DIR/prisma/schema.prisma"

[[ -d "$ROOT_DIR/.git" ]] || die "Not a git repository: $ROOT_DIR"
cd "$ROOT_DIR"

if [[ -z "$PR_TITLE" ]]; then
  PR_TITLE="Merge ${HEAD_BRANCH} into ${BASE_BRANCH}"
fi

if [[ -z "$PR_BODY" ]]; then
  PR_BODY=$(
    cat <<EOF
Promote changes from \`${HEAD_BRANCH}\` to \`${BASE_BRANCH}\`.

QLD/QUA database migrations are handled by \`./scripts/migrate-dev-to-qld.sh\`
with \`prisma migrate deploy\`, which applies only missing migration folders.
EOF
  )
fi

run() {
  if $DRY_RUN; then
    printf '  dry-run:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

redact_url() {
  sed -E 's#(postgresql://[^:/]+:)[^@]+@#\1***@#; s#(postgres://[^:/]+:)[^@]+@#\1***@#'
}

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  Promote ${HEAD_BRANCH} -> ${BASE_BRANCH} + QLD/QUA migrations${NC}"
echo -e "${BOLD}================================================${NC}"
$DRY_RUN && warn "DRY RUN -- no PR, git push, or database migration will be executed"

step "0/4  Checking prerequisites..."
command -v git >/dev/null 2>&1 || die "git not found"
command -v pnpm >/dev/null 2>&1 || die "pnpm not found"
[[ -f "$SCHEMA_PATH" ]] || die "Prisma schema not found at $SCHEMA_PATH"

if ! $SKIP_PR && ! $DRY_RUN; then
  if command -v gh >/dev/null 2>&1; then
    ok "GitHub CLI found"
  else
    die "GitHub CLI (gh) is required to create the PR. Install it or rerun with --skip-pr."
  fi
elif ! $SKIP_PR; then
  warn "GitHub CLI check skipped for dry run"
fi

if ! $SKIP_MIGRATIONS; then
  [[ -f "$ENV_PATH" ]] || die "Env file not found at $ENV_PATH"
  ok "Migration env file: $ENV_FILE"
fi

git rev-parse --verify "$HEAD_BRANCH" >/dev/null 2>&1 \
  || die "Local branch '$HEAD_BRANCH' not found"
git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1 \
  || die "Local branch '$BASE_BRANCH' not found"
ok "Local branches found"

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Working tree has uncommitted changes. They will not be included unless already committed on '$HEAD_BRANCH'."
fi

echo ""
echo -e "  PR      : ${BOLD}${HEAD_BRANCH}${NC} -> ${BOLD}${BASE_BRANCH}${NC}"
echo -e "  DB env  : ${BOLD}${ENV_FILE}${NC}"
echo -e "  Schema  : ${BOLD}prisma/schema.prisma${NC}"

if ! $YES && ! $DRY_RUN; then
  echo ""
  read -rp "  Type '${BASE_BRANCH}' to create/reuse the PR and migrate QLD/QUA DB: " ANSWER
  [[ "$ANSWER" == "$BASE_BRANCH" ]] || { warn "Aborted."; exit 0; }
fi

step "1/4  Fetching latest branch refs..."
run git fetch origin "$HEAD_BRANCH" "$BASE_BRANCH" --prune
ok "Fetched origin refs"

step "2/4  Pushing ${HEAD_BRANCH} to origin..."
run git push origin "${HEAD_BRANCH}:${HEAD_BRANCH}"
ok "Pushed ${HEAD_BRANCH} to origin/${HEAD_BRANCH}"

step "3/4  Pull request ${HEAD_BRANCH} -> ${BASE_BRANCH}..."
if $SKIP_PR; then
  warn "Skipped PR step"
elif $DRY_RUN; then
  run gh pr create --base "$BASE_BRANCH" --head "$HEAD_BRANCH" --title "$PR_TITLE" --body "$PR_BODY"
else
  EXISTING_PR_URL="$(gh pr list --base "$BASE_BRANCH" --head "$HEAD_BRANCH" --state open --json url --jq '.[0].url // empty')"
  if [[ -n "$EXISTING_PR_URL" ]]; then
    ok "Open PR already exists: $EXISTING_PR_URL"
  else
    PR_URL="$(gh pr create --base "$BASE_BRANCH" --head "$HEAD_BRANCH" --title "$PR_TITLE" --body "$PR_BODY")"
    ok "Created PR: $PR_URL"
  fi
fi

step "4/4  Applying missing Prisma migrations to QLD/QUA..."
if $SKIP_MIGRATIONS; then
  warn "Skipped migration step"
else
  # Export the target DB URLs only for the Prisma commands below.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_PATH"
  set +a

  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL is missing from $ENV_FILE"
  [[ -n "${DIRECT_URL:-}" ]] || die "DIRECT_URL is missing from $ENV_FILE"
  if [[ "$DATABASE_URL" == *REPLACE_WITH* || "$DIRECT_URL" == *REPLACE_WITH* ]]; then
    if $DRY_RUN; then
      warn "$ENV_FILE still has placeholder database URLs"
    else
      die "$ENV_FILE still has placeholder database URLs"
    fi
  fi

  echo "  Database: $(printf '%s' "$DIRECT_URL" | redact_url)"
  if $DRY_RUN; then
    run pnpm exec prisma migrate status --schema "$SCHEMA_PATH"
    run pnpm exec prisma migrate deploy --schema "$SCHEMA_PATH"
  else
    pnpm exec prisma migrate status --schema "$SCHEMA_PATH" || true
    pnpm exec prisma migrate deploy --schema "$SCHEMA_PATH"
  fi
  ok "Missing migrations applied"
fi

echo ""
echo -e "${GREEN}${BOLD}Done. ${HEAD_BRANCH} is ready for ${BASE_BRANCH}, and QLD/QUA migrations are handled.${NC}"
echo ""

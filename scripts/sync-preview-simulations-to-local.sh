#!/usr/bin/env bash
# sync-preview-simulations-to-local.sh
#
# Syncs ONLY simulation-related tables from the Supabase preview DB to local.
# Specifically: simulations, simulation_versions
#
# What it does:
#   1. pg_dump only the simulation tables from preview (data only)
#   2. Truncates those tables locally (cascade)
#   3. Restores the data into local Docker Postgres
#
# Prerequisites:
#   - Docker container axpo-postgres-local must be running
#   - pg_dump/psql available (brew install libpq && brew link --force libpq)
#   - .env.preview with DIRECT_URL (or DATABASE_URL) defined
#
# Usage:
#   ./scripts/sync-preview-simulations-to-local.sh           # with confirmation prompt
#   ./scripts/sync-preview-simulations-to-local.sh --dry-run # show plan only, no writes
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${CYAN}${BOLD}${1}${NC}"; }
ok()   { echo -e "${GREEN}  v ${1}${NC}"; }
warn() { echo -e "${YELLOW}  ! ${1}${NC}"; }
die()  { echo -e "${RED}  x ${1}${NC}"; exit 1; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_PREVIEW="$ROOT_DIR/.env.preview"
DUMP_FILE="$(mktemp /tmp/axpo-preview-simulations-dump-XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

# Tables to sync (order matters: parent before child for inserts)
SIMULATION_TABLES=(
  "simulations"
  "simulation_versions"
)

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  Simulation Sync: Supabase Preview -> Local${NC}"
echo -e "${BOLD}================================================${NC}"
$DRY_RUN && warn "DRY RUN -- nothing will be written to local"

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
step "0/4  Checking prerequisites..."
command -v docker &>/dev/null || die "docker not found. Please install Docker."
docker info &>/dev/null       || die "Docker daemon is not running."
docker inspect axpo-postgres-local &>/dev/null \
  || die "Container axpo-postgres-local is not running. Run: docker compose up -d"

if command -v pg_dump &>/dev/null; then
  USE_DOCKER_PGDUMP=false
  ok "pg_dump found locally"
else
  USE_DOCKER_PGDUMP=true
  warn "pg_dump not found locally -- will use pg_dump inside a Docker container"
fi

[[ -f "$ENV_PREVIEW" ]] || die ".env.preview not found at $ENV_PREVIEW"

PREVIEW_URL="$(grep -E '^DIRECT_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\""  || true)"
if [[ -z "$PREVIEW_URL" ]]; then
  warn "DIRECT_URL not found in .env.preview, falling back to DATABASE_URL"
  PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" | sed 's/pgbouncer=true/pgbouncer=false/g' || true)"
fi
[[ -z "$PREVIEW_URL" ]] && die "No DIRECT_URL or DATABASE_URL found in .env.preview"
ok "Preview URL: $(echo "$PREVIEW_URL" | sed 's/:.*@/:***@/')"

DOCKER_PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" \
  | sed 's/pgbouncer=true//g; s/?$//g; s/&$//g; s/6543/5432/g' || true)"
if [[ -z "$DOCKER_PREVIEW_URL" ]]; then
  DOCKER_PREVIEW_URL="$PREVIEW_URL"
fi
ok "Docker preview URL: $(echo "$DOCKER_PREVIEW_URL" | sed 's/:.*@/:***@/')"

# ── Local DB ──────────────────────────────────────────────────────────────────
LOCAL_USER="axpo"
LOCAL_DB="axpo_simulator"

docker exec axpo-postgres-local psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -c "SELECT 1" -q --tuples-only &>/dev/null \
  || die "Cannot connect to local DB -- is Docker running? (docker compose up -d)"
ok "Local DB is reachable"

# Build --table flags for pg_dump
TABLE_FLAGS=()
for tbl in "${SIMULATION_TABLES[@]}"; do
  TABLE_FLAGS+=(--table="public.${tbl}")
done

echo ""
echo -e "  Tables to sync: ${BOLD}${SIMULATION_TABLES[*]}${NC}"

if $DRY_RUN; then
  warn "Dry run complete. Would truncate and restore: ${SIMULATION_TABLES[*]}"
  exit 0
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}${BOLD}  WARNING: This will DELETE and re-import all rows in:${NC}"
for tbl in "${SIMULATION_TABLES[@]}"; do
  echo -e "    - ${tbl}"
done
echo -e "${YELLOW}${BOLD}  Local schema is NOT touched. Only data is replaced.${NC}"
echo ""
read -rp '  Type "yes" to continue: ' ANSWER
[[ "$ANSWER" == "yes" ]] || { warn "Aborted."; exit 0; }

# ── 1. Dump simulation tables (data only) ─────────────────────────────────────
step "1/4  Dumping simulation tables from Supabase preview..."
if $USE_DOCKER_PGDUMP; then
  docker run --rm \
    postgres:17-alpine \
    pg_dump "$DOCKER_PREVIEW_URL" \
    --no-owner --no-acl --no-privileges \
    --schema=public --data-only \
    --disable-triggers \
    "${TABLE_FLAGS[@]}" \
    --format=plain \
    > "$DUMP_FILE"
else
  pg_dump "$PREVIEW_URL" \
    --no-owner --no-acl --no-privileges \
    --schema=public --data-only \
    --disable-triggers \
    "${TABLE_FLAGS[@]}" \
    --format=plain \
    --file="$DUMP_FILE"
fi

# Strip PG17-only settings that older local Postgres versions don't recognise
sed -i '' '/^SET transaction_timeout/d' "$DUMP_FILE"
ok "Dump complete ($(du -sh "$DUMP_FILE" | cut -f1))"

# ── 2. Truncate simulation tables locally ─────────────────────────────────────
step "2/4  Truncating simulation tables in local DB..."
# Truncate in reverse order to respect FK constraints, then cascade handles the rest
TRUNCATE_SQL="
SET session_replication_role = replica;
TRUNCATE TABLE public.simulation_versions, public.simulations RESTART IDENTITY CASCADE;
SET session_replication_role = DEFAULT;
"
docker exec axpo-postgres-local psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -v ON_ERROR_STOP=1 -q -c "$TRUNCATE_SQL"
ok "Simulation tables cleared"

# ── 3. Restore simulation data ────────────────────────────────────────────────
step "3/4  Restoring simulation data to local DB..."
docker exec -i axpo-postgres-local psql \
  -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -v ON_ERROR_STOP=1 -q \
  < "$DUMP_FILE"
ok "Restore complete"

# ── 4. Done ───────────────────────────────────────────────────────────────────
step "4/4  Cleanup..."
ok "Temp dump file removed"

echo ""
echo -e "${GREEN}${BOLD}Done! Simulation data now mirrors the Supabase preview DB.${NC}"
echo ""

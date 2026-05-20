#!/usr/bin/env bash
# sync-preview-to-local.sh
#
# Performs a FULL schema + data override of the local Docker Postgres DB
# using the Supabase preview DB as the source.
#
# What it does:
#   1. pg_dump preview DB (schema + data) to a temp SQL file
#   2. Drops ALL tables/views/sequences/types in local public schema
#   3. Restores the dump into local Docker Postgres
#
# Prerequisites:
#   - Docker container axpo-postgres-local must be running
#   - pg_dump/psql available (brew install libpq && brew link --force libpq)
#   - .env.preview with DIRECT_URL (or DATABASE_URL) defined
#
# Usage:
#   ./scripts/sync-preview-to-local.sh           # with confirmation prompt
#   ./scripts/sync-preview-to-local.sh --dry-run # show plan only, no writes
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
DUMP_FILE="$(mktemp /tmp/axpo-preview-dump-XXXXXX.sql)"
# Ensure temp file is cleaned up on exit
trap 'rm -f "$DUMP_FILE"' EXIT

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  Full DB Sync: Supabase Preview -> Local${NC}"
echo -e "${BOLD}================================================${NC}"
$DRY_RUN && warn "DRY RUN -- nothing will be written to local"

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
step "0/4  Checking prerequisites..."
command -v docker &>/dev/null || die "docker not found. Please install Docker."
docker info &>/dev/null       || die "Docker daemon is not running."
docker inspect axpo-postgres-local &>/dev/null \
  || die "Container axpo-postgres-local is not running. Run: docker compose up -d"

# Use pg_dump/psql from the container if not available locally
if command -v pg_dump &>/dev/null; then
  USE_DOCKER_PGDUMP=false
  ok "pg_dump found locally"
else
  USE_DOCKER_PGDUMP=true
  warn "pg_dump not found locally -- will use pg_dump inside a Docker container"
fi

if command -v psql &>/dev/null; then
  USE_DOCKER_PSQL=false
  ok "psql found locally"
else
  USE_DOCKER_PSQL=true
  warn "psql not found locally -- will use psql inside the Docker container (via docker exec)"
fi

[[ -f "$ENV_PREVIEW" ]] || die ".env.preview not found at $ENV_PREVIEW"

# Prefer DIRECT_URL (no pgBouncer -- required for multi-statement DDL / pg_dump)
PREVIEW_URL="$(grep -E '^DIRECT_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\""  || true)"
if [[ -z "$PREVIEW_URL" ]]; then
  warn "DIRECT_URL not found in .env.preview, falling back to DATABASE_URL"
  PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" | sed 's/pgbouncer=true/pgbouncer=false/g' || true)"
fi
[[ -z "$PREVIEW_URL" ]] && die "No DIRECT_URL or DATABASE_URL found in .env.preview"
ok "Preview URL: $(echo "$PREVIEW_URL" | sed 's/:.*@/:***@/')"

# For Docker-based pg_dump we need an IPv4-reachable URL (session pooler on port 5432).
DOCKER_PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" \
  | sed 's/pgbouncer=true//g; s/?$//g; s/&$//g; s/6543/5432/g' || true)"
if [[ -z "$DOCKER_PREVIEW_URL" ]]; then
  DOCKER_PREVIEW_URL="$PREVIEW_URL"
fi
ok "Docker preview URL: $(echo "$DOCKER_PREVIEW_URL" | sed 's/:.*@/:***@/')"

# ── Local DB ──────────────────────────────────────────────────────────────────
LOCAL_HOST="localhost"
LOCAL_PORT="5432"
LOCAL_USER="axpo"
LOCAL_PASS="axpo_dev_password"
LOCAL_DB="axpo_simulator"

docker exec axpo-postgres-local psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -c "SELECT 1" -q --tuples-only &>/dev/null \
  || die "Cannot connect to local DB -- is Docker running? (docker compose up -d)"
ok "Local DB is reachable"

if $DRY_RUN; then
  warn "Dry run complete. Would wipe local DB and restore preview dump."
  exit 0
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}${BOLD}  WARNING: This will COMPLETELY WIPE your local DB${NC}"
echo -e "${RED}${BOLD}  and replace it with the Supabase preview DB (schema + all data).${NC}"
echo ""
read -rp '  Type "yes" to continue: ' ANSWER
[[ "$ANSWER" == "yes" ]] || { warn "Aborted."; exit 0; }

# ── 1. Dump preview DB ────────────────────────────────────────────────────────
step "1/4  Dumping Supabase preview DB..."
if $USE_DOCKER_PGDUMP; then
  docker run --rm \
    postgres:17-alpine \
    pg_dump "$DOCKER_PREVIEW_URL" \
    --no-owner --no-acl --no-privileges \
    --schema=public --format=plain \
    > "$DUMP_FILE"
else
  pg_dump "$PREVIEW_URL" \
    --no-owner --no-acl --no-privileges \
    --schema=public --format=plain \
    --file="$DUMP_FILE"
fi
ok "Dump complete ($(du -sh "$DUMP_FILE" | cut -f1))"

# Patch CREATE SCHEMA to avoid "already exists" error on restore
sed -i '' 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' "$DUMP_FILE"
# Strip PG17-only settings that older local Postgres versions don't recognise
sed -i '' '/^SET transaction_timeout/d' "$DUMP_FILE"

# ── 2. Drop everything in local public schema ─────────────────────────────────
step "2/4  Dropping all objects in local public schema..."
DROP_SQL="
DO \$\$
DECLARE r RECORD;
BEGIN
  SET session_replication_role = replica;
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
  END LOOP;
  FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
  END LOOP;
  FOR r IN (
    SELECT typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e','c')
  ) LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
  SET session_replication_role = DEFAULT;
END\$\$;
"
docker exec axpo-postgres-local psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -v ON_ERROR_STOP=1 -q -c "$DROP_SQL"
ok "Local public schema cleared"

# ── 3. Restore dump ───────────────────────────────────────────────────────────
step "3/4  Restoring preview dump to local DB..."
docker exec -i axpo-postgres-local psql \
  -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -v ON_ERROR_STOP=1 -q \
  < "$DUMP_FILE"
ok "Restore complete"

# ── 4. Done (trap handles temp file cleanup) ──────────────────────────────────
step "4/4  Cleanup..."
ok "Temp dump file removed"

echo ""
echo -e "${GREEN}${BOLD}Done! Local DB now mirrors the Supabase preview DB.${NC}"
echo ""

#!/usr/bin/env bash
# sync-local-to-preview.sh
#
# Performs a FULL schema + data override of the Supabase preview DB
# using the local Docker Postgres as the source.
#
# What it does:
#   1. pg_dump local DB (schema + data) to a temp SQL file
#   2. Drops ALL tables/views/sequences/types in preview public schema
#   3. Restores the dump into preview
#
# Prerequisites:
#   - Docker container axpo-postgres-local must be running
#   - pg_dump/psql available (brew install libpq && brew link --force libpq)
#   - .env.preview with DIRECT_URL (or DATABASE_URL) defined
#
# Usage:
#   ./scripts/sync-local-to-preview.sh           # with confirmation prompt
#   ./scripts/sync-local-to-preview.sh --dry-run # show plan only, no writes
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
DUMP_FILE="$(mktemp /tmp/axpo-local-dump-XXXXXX.sql)"
RESTORE_FILE="$(mktemp /tmp/axpo-local-restore-XXXXXX.sql)"
# Ensure temp file is cleaned up on exit
trap 'rm -f "$DUMP_FILE" "$RESTORE_FILE"' EXIT

prepare_restore_file() {
  awk '
    function progress(message) {
      gsub(/\047/, "\047\047", message)
      print "DO $$ BEGIN RAISE NOTICE \047" message "\047; END $$;"
    }

    FNR == NR {
      if ($0 ~ /^COPY public\.[^[:space:]]+ .* FROM stdin;$/) {
        copy_table = $2
        copy_rows[copy_table] = 0
        next
      }
      if (copy_table != "" && $0 ~ /^\\\.$/) {
        copy_table = ""
        next
      }
      if (copy_table != "") {
        copy_rows[copy_table]++
      }
      next
    }

    /^SELECT pg_catalog.set_config\(/ {
      expr = $0
      sub(/^SELECT /, "", expr)
      sub(/;$/, "", expr)
      progress("  -> Setting restore search_path")
      print "DO $$ BEGIN PERFORM " expr "; END $$;"
      next
    }

    /^-- Name: / {
      section = $0
      name = section
      type = section
      schema = section
      sub(/^-- Name: /, "", name)
      sub(/; Type:.*$/, "", name)
      sub(/^.*; Type: /, "", type)
      sub(/; Schema:.*$/, "", type)
      sub(/^.*; Schema: /, "", schema)
      sub(/; Owner:.*$/, "", schema)

      if (type != "TABLE DATA" && type != "COMMENT" && type != "ACL") {
        if (schema == "-" || schema == "") {
          progress("  -> Restoring " type " " name)
        } else {
          progress("  -> Restoring " type " " schema "." name)
        }
      }

      print
      next
    }

    /^CREATE TABLE public\./ {
      obj = $3
      sub(/\($/, "", obj)
      progress("  -> Creating table " obj)
      print
      next
    }

    /^COPY public\.[^[:space:]]+ .* FROM stdin;$/ {
      copy_table = $2
      progress("  -> Loading " copy_table " (" copy_rows[copy_table] " rows)")
      print
      next
    }

    /^\\\.$/ {
      print
      if (copy_table != "") {
        progress("  <- Loaded " copy_table)
        copy_table = ""
      }
      next
    }

    /^ALTER TABLE ONLY public\./ {
      obj = $4
      if ($0 ~ / ADD CONSTRAINT /) {
        progress("  -> Adding constraints on " obj)
      }
      print
      next
    }

    /^CREATE INDEX / {
      progress("  -> Creating index " $3)
      print
      next
    }

    /^CREATE UNIQUE INDEX / {
      progress("  -> Creating unique index " $4)
      print
      next
    }

    /^CREATE TRIGGER / {
      progress("  -> Creating trigger " $3)
      print
      next
    }

    /^CREATE POLICY / {
      progress("  -> Creating policy " $3)
      print
      next
    }

    { print }
  ' "$DUMP_FILE" "$DUMP_FILE" > "$RESTORE_FILE"
}

run_with_heartbeat() {
  "$@" &
  local restore_pid=$!
  local elapsed=0

  while kill -0 "$restore_pid" 2>/dev/null; do
    sleep 30
    if kill -0 "$restore_pid" 2>/dev/null; then
      elapsed=$((elapsed + 30))
      echo "  ... restore still running (${elapsed}s elapsed)"
    fi
  done

  wait "$restore_pid"
}

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  Full DB Sync: Local -> Supabase Preview${NC}"
echo -e "${BOLD}================================================${NC}"
$DRY_RUN && warn "DRY RUN -- nothing will be written to preview"

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
  warn "pg_dump not found locally -- will use pg_dump inside the Docker container"
fi

if command -v psql &>/dev/null; then
  USE_DOCKER_PSQL=false
  ok "psql found locally"
else
  USE_DOCKER_PSQL=true
  warn "psql not found locally -- will use psql inside the Docker container (via docker exec)"
fi

[[ -f "$ENV_PREVIEW" ]] || die ".env.preview not found at $ENV_PREVIEW"

# Prefer DIRECT_URL (no pgBouncer -- required for multi-statement DDL)
PREVIEW_URL="$(grep -E '^DIRECT_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\""  || true)"
if [[ -z "$PREVIEW_URL" ]]; then
  warn "DIRECT_URL not found in .env.preview, falling back to DATABASE_URL"
  PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" | sed 's/pgbouncer=true/pgbouncer=false/g' || true)"
fi
[[ -z "$PREVIEW_URL" ]] && die "No DIRECT_URL or DATABASE_URL found in .env.preview"
ok "Preview URL: $(echo "$PREVIEW_URL" | sed 's/:.*@/:***@/')"

# For Docker-based psql we need an IPv4-reachable URL.
# The DIRECT_URL uses IPv6 (db.*.supabase.co) which Docker containers can't reach.
# The session pooler on port 5432 is IPv4 and works from Docker.
DOCKER_PREVIEW_URL="$(grep -E '^DATABASE_URL=' "$ENV_PREVIEW" | head -1 | cut -d= -f2- | tr -d "'\"" \
  | sed 's/pgbouncer=true//g; s/connection_limit=[^&]*//g; s/pool_timeout=[^&]*//g; s/connect_timeout=[^&]*//g; s/6543/5432/g; s/?&/\?/g; s/&&/\&/g; s/[?&]$//g' || true)"
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

PGPASSWORD="$LOCAL_PASS" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" \
  -c "SELECT 1" -q --tuples-only &>/dev/null \
  || docker exec axpo-postgres-local psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
       -c "SELECT 1" -q --tuples-only &>/dev/null \
  || die "Cannot connect to local DB at $LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB -- is Docker running?"
ok "Local DB is reachable"

LOCAL_ROW_COUNT="$(docker exec axpo-postgres-local psql \
  -U "$LOCAL_USER" -d "$LOCAL_DB" -t -c \
  "SELECT COALESCE(SUM(reltuples::bigint),0) FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'" 2>/dev/null | tr -d ' ' || echo '?')"
echo "  Local DB approx rows: $LOCAL_ROW_COUNT"

if $DRY_RUN; then
  warn "Dry run complete. Would wipe preview and restore local dump."
  exit 0
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}${BOLD}  WARNING: This will COMPLETELY WIPE the Supabase preview DB${NC}"
echo -e "${RED}${BOLD}  and replace it with your local DB (schema + all data).${NC}"
echo ""
read -rp '  Type "yes" to continue: ' ANSWER
[[ "$ANSWER" == "yes" ]] || { warn "Aborted."; exit 0; }

# ── 1. Dump local DB ─────────────────────────────────────────────────────────
step "1/4  Dumping local DB..."
if $USE_DOCKER_PGDUMP; then
  docker exec axpo-postgres-local pg_dump \
    -U "$LOCAL_USER" -d "$LOCAL_DB" \
    --no-owner --no-acl --no-privileges \
    --schema=public --format=plain \
    > "$DUMP_FILE"
else
  PGPASSWORD="$LOCAL_PASS" pg_dump \
    -h "$LOCAL_HOST" -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" -d "$LOCAL_DB" \
    --no-owner --no-acl --no-privileges \
    --schema=public --format=plain \
    --file="$DUMP_FILE"
fi
ok "Dump complete ($(du -sh "$DUMP_FILE" | cut -f1))"

# Patch CREATE SCHEMA to avoid "already exists" error on restore
sed -i '' 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' "$DUMP_FILE"

echo "  Preparing restore progress output..."
prepare_restore_file

# ── 2. Drop everything in preview public schema ───────────────────────────────
step "2/4  Dropping all objects in preview public schema..."
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
if $USE_DOCKER_PSQL; then
  echo "$DROP_SQL" | docker run --rm -i postgres:16-alpine psql "$DOCKER_PREVIEW_URL" -v ON_ERROR_STOP=1 -q
else
  psql "$PREVIEW_URL" -v ON_ERROR_STOP=1 -q -c "$DROP_SQL"
fi
ok "Preview public schema cleared"

# ── 3. Restore dump ───────────────────────────────────────────────────────────
step "3/4  Restoring dump to preview..."
echo "  Progress will pause during large table loads, then continue after each COPY finishes."
if $USE_DOCKER_PSQL; then
  # Mount the dump file into a fresh postgres container that has internet access
  run_with_heartbeat docker run --rm -i \
    -v "$RESTORE_FILE:/dump.sql:ro" \
    postgres:16-alpine \
    psql "$DOCKER_PREVIEW_URL" -v ON_ERROR_STOP=1 -q --echo-errors --file=/dump.sql
else
  run_with_heartbeat psql "$PREVIEW_URL" -v ON_ERROR_STOP=1 -q --echo-errors --file="$RESTORE_FILE"
fi
ok "Restore complete"

# ── 4. Done (trap handles temp file cleanup) ──────────────────────────────────
step "4/4  Cleanup..."
ok "Temp dump file removed"

echo ""
echo -e "${GREEN}${BOLD}Done! Preview DB now mirrors your local DB.${NC}"
echo ""

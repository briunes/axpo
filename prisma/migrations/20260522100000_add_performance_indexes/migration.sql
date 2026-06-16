-- Performance indexes for common query patterns.
-- These cover the most frequent WHERE/ORDER BY combinations seen in list endpoints.

-- simulations: list by agency, filtered by isDeleted, sorted by updatedAt (most common)
CREATE INDEX IF NOT EXISTS "simulations_agencyId_isDeleted_updatedAt_idx"
  ON "simulations" ("agencyId", "isDeleted", "updatedAt" DESC);

-- simulations: list by owner user (COMMERCIAL role scope), filtered by isDeleted, sorted by updatedAt
CREATE INDEX IF NOT EXISTS "simulations_ownerUserId_isDeleted_updatedAt_idx"
  ON "simulations" ("ownerUserId", "isDeleted", "updatedAt" DESC);

-- simulations: status filter (shared/expired queries)
CREATE INDEX IF NOT EXISTS "simulations_status_isDeleted_idx"
  ON "simulations" ("status", "isDeleted");

-- simulation_versions: fetching latest version per simulation (take:1, orderBy: createdAt desc)
CREATE INDEX IF NOT EXISTS "simulation_versions_simulationId_createdAt_idx"
  ON "simulation_versions" ("simulationId", "createdAt" DESC);

-- users: list by agency filtered by isDeleted (AGENT scope queries)
CREATE INDEX IF NOT EXISTS "users_agencyId_isDeleted_idx"
  ON "users" ("agencyId", "isDeleted");

-- users: email lookups (login, uniqueness checks)
CREATE INDEX IF NOT EXISTS "users_email_isDeleted_idx"
  ON "users" ("email", "isDeleted");

-- clients: list by agency filtered by isDeleted
CREATE INDEX IF NOT EXISTS "clients_agencyId_isDeleted_idx"
  ON "clients" ("agencyId", "isDeleted");

-- agencies: isDeleted filter (list endpoint)
CREATE INDEX IF NOT EXISTS "agencies_isDeleted_idx"
  ON "agencies" ("isDeleted");

-- audit_logs: common query pattern for logs listing (by actor, sorted by date)
CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_createdAt_idx"
  ON "audit_logs" ("actorUserId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_targetType_targetId_idx"
  ON "audit_logs" ("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"
  ON "audit_logs" ("createdAt" DESC);

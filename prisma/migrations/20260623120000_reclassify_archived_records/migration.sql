-- Existing soft-deleted simulations/clients are archived records under the new
-- active/archived/permanently-deleted state split.
UPDATE "simulations"
SET "deletedAt" = NULL
WHERE "isDeleted" = true;

UPDATE "clients"
SET "deletedAt" = NULL
WHERE "isDeleted" = true;

UPDATE "agencies"
SET "deletedAt" = NULL
WHERE "isDeleted" = true;

UPDATE "users"
SET "deletedAt" = NULL
WHERE "isDeleted" = true;

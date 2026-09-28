ALTER TABLE "system_config" ADD COLUMN "incidentRecipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Preserve existing recipients until an administrator changes the selection.
UPDATE "system_config" SET "incidentRecipientIds" = ARRAY(
  SELECT "id" FROM "users" WHERE "role" IN ('ADMIN', 'SYS_ADMIN')
    AND "isActive" = true AND "isDeleted" = false AND "deletedAt" IS NULL
);

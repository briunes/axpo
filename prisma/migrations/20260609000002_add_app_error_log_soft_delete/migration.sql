ALTER TABLE "app_error_logs"
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "app_error_logs_isDeleted_createdAt_idx"
ON "app_error_logs"("isDeleted", "createdAt" DESC);

NOTIFY pgrst, 'reload schema';

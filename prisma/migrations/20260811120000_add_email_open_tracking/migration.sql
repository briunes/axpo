ALTER TABLE "email_logs"
ADD COLUMN "trackingToken" TEXT,
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "email_logs_trackingToken_key" ON "email_logs"("trackingToken");
CREATE INDEX "email_logs_openedAt_idx" ON "email_logs"("openedAt");

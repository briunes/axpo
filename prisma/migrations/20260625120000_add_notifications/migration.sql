CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "audienceRole" "UserRole",
    "audienceUserId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
CREATE INDEX "notifications_audienceRole_resolvedAt_lastSeenAt_idx" ON "notifications"("audienceRole", "resolvedAt", "lastSeenAt" DESC);
CREATE INDEX "notifications_audienceUserId_resolvedAt_lastSeenAt_idx" ON "notifications"("audienceUserId", "resolvedAt", "lastSeenAt" DESC);
CREATE INDEX "notifications_category_severity_idx" ON "notifications"("category", "severity");
CREATE INDEX "notifications_sourceType_sourceId_idx" ON "notifications"("sourceType", "sourceId");
CREATE UNIQUE INDEX "notification_reads_notificationId_userId_key" ON "notification_reads"("notificationId", "userId");
CREATE INDEX "notification_reads_userId_dismissedAt_idx" ON "notification_reads"("userId", "dismissedAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audienceUserId_fkey" FOREIGN KEY ("audienceUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON TYPE "NotificationSeverity" TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications" TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notification_reads" TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

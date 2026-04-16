-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "triggeredByUserId" TEXT,
    "variables" JSONB,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "relatedUserId" TEXT,
    "relatedSimulationId" TEXT,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- CreateIndex
CREATE INDEX "email_logs_recipientEmail_idx" ON "email_logs"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_logs_triggeredBy_idx" ON "email_logs"("triggeredBy");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_triggeredByUserId_idx" ON "email_logs"("triggeredByUserId");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

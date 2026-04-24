-- CreateTable
CREATE TABLE "cron_logs" (
    "id" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobName" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration" INTEGER,
    "totalProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalAffected" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,

    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_logs_executedAt_idx" ON "cron_logs"("executedAt");

-- CreateIndex
CREATE INDEX "cron_logs_jobName_idx" ON "cron_logs"("jobName");

-- CreateIndex
CREATE INDEX "cron_logs_jobType_idx" ON "cron_logs"("jobType");

-- CreateIndex
CREATE INDEX "cron_logs_status_idx" ON "cron_logs"("status");

-- CreateTable
CREATE TABLE "app_error_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorType" TEXT NOT NULL,
    "errorCode" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "userId" TEXT,
    "sentryEventId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "app_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_error_logs_createdAt_idx" ON "app_error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "app_error_logs_errorType_idx" ON "app_error_logs"("errorType");

-- CreateIndex
CREATE INDEX "app_error_logs_path_idx" ON "app_error_logs"("path");

-- CreateIndex
CREATE INDEX "app_error_logs_userId_idx" ON "app_error_logs"("userId");

-- AddForeignKey
ALTER TABLE "app_error_logs" ADD CONSTRAINT "app_error_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

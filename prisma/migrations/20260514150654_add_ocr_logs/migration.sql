-- CreateTable
CREATE TABLE "ocr_logs" (
    "id" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSizeBytes" INTEGER,
    "pageCount" INTEGER,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "extractedFields" JSONB,
    "fieldsExtracted" INTEGER,
    "errorMessage" TEXT,
    "errorType" TEXT,
    "httpStatusCode" INTEGER,
    "rawResponseSnippet" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ocr_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_logs_requestedAt_idx" ON "ocr_logs"("requestedAt");

-- CreateIndex
CREATE INDEX "ocr_logs_userId_idx" ON "ocr_logs"("userId");

-- CreateIndex
CREATE INDEX "ocr_logs_provider_idx" ON "ocr_logs"("provider");

-- CreateIndex
CREATE INDEX "ocr_logs_status_idx" ON "ocr_logs"("status");

-- AddForeignKey
ALTER TABLE "ocr_logs" ADD CONSTRAINT "ocr_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "OcrLogType" AS ENUM ('INVOICE_EXTRACTION', 'PROVIDER_DETECTION');

-- AlterTable
ALTER TABLE "ocr_logs"
ADD COLUMN "simulationId" TEXT,
ADD COLUMN "type" "OcrLogType" NOT NULL DEFAULT 'INVOICE_EXTRACTION';

-- Backfill provider-detection log type from existing metadata
UPDATE "ocr_logs"
SET "type" = 'PROVIDER_DETECTION'
WHERE COALESCE("metadata"->>'requestType', '') = 'provider-detection';

-- CreateTable
CREATE TABLE "ocr_log_files" (
    "id" TEXT NOT NULL,
    "ocrLogId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_log_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_logs_simulationId_idx" ON "ocr_logs"("simulationId");

-- CreateIndex
CREATE INDEX "ocr_logs_type_idx" ON "ocr_logs"("type");

-- CreateIndex
CREATE INDEX "ocr_log_files_ocrLogId_idx" ON "ocr_log_files"("ocrLogId");

-- AddForeignKey
ALTER TABLE "ocr_logs" ADD CONSTRAINT "ocr_logs_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_log_files" ADD CONSTRAINT "ocr_log_files_ocrLogId_fkey" FOREIGN KEY ("ocrLogId") REFERENCES "ocr_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
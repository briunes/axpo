-- Add lifecycle fields for managing OCR log issues.
ALTER TABLE "ocr_logs" ADD COLUMN "issueStatus" TEXT;
ALTER TABLE "ocr_logs" ADD COLUMN "issueResolution" TEXT;
ALTER TABLE "ocr_logs" ADD COLUMN "issueNotes" TEXT;
ALTER TABLE "ocr_logs" ADD COLUMN "issueSubmittedAt" TIMESTAMP(3);
ALTER TABLE "ocr_logs" ADD COLUMN "issueHandledAt" TIMESTAMP(3);
ALTER TABLE "ocr_logs" ADD COLUMN "issueHandledByUserId" TEXT;

CREATE INDEX "ocr_logs_issueStatus_idx" ON "ocr_logs"("issueStatus");

UPDATE "ocr_logs"
SET "issueSubmittedAt" = COALESCE("issueSubmittedAt", "requestedAt")
WHERE "reportedIssue" IS NOT NULL OR "userCorrections" IS NOT NULL;

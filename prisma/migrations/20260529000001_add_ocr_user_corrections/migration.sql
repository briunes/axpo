-- Add userCorrections column to ocr_logs
-- Stores per-field corrections applied by the user after OCR extraction:
-- { fieldName: { ocr: rawValue, corrected: userValue } }
ALTER TABLE "ocr_logs" ADD COLUMN "userCorrections" JSONB;

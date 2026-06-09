-- Add missing foreign key constraints on ocr_usage_invoices.
--
-- The original 20260601000000_add_ocr_billing migration created the table with
-- nullable FK columns but no constraints, which made the Supabase Data API
-- adapter fall back to treating createdByUser / client / agency / user as
-- literal column names (causing "column users.createdByUser does not exist"
-- errors when nested selects referenced those relations).

ALTER TABLE "ocr_usage_invoices"
    ADD CONSTRAINT "ocr_usage_invoices_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_usage_invoices"
    ADD CONSTRAINT "ocr_usage_invoices_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_usage_invoices"
    ADD CONSTRAINT "ocr_usage_invoices_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_usage_invoices"
    ADD CONSTRAINT "ocr_usage_invoices_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

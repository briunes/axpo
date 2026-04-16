-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN     "editableSections" JSONB;

-- AlterTable
ALTER TABLE "pdf_templates" ADD COLUMN     "editableSections" JSONB;

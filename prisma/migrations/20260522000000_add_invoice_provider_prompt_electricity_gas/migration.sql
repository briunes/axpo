-- AlterTable: add per-commodity prompts to invoice_provider_prompts
ALTER TABLE "invoice_provider_prompts"
  ADD COLUMN "promptElectricity" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "promptGas"         TEXT NOT NULL DEFAULT '';

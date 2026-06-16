-- OCR usage billing & pricing
--
-- Adds:
--   * ocr_model_prices  - per (provider, model) unit pricing, admin-editable
--   * ocr_usage_invoices - billable snapshots of usage over a date range
--   * billing settings columns on system_config

-- ---------------------------------------------------------------------------
-- Per-model pricing
-- ---------------------------------------------------------------------------
CREATE TABLE "ocr_model_prices" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPricePer1kTokens" DECIMAL(18,8) NOT NULL,
    "outputPricePer1kTokens" DECIMAL(18,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitTokens" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_model_prices_pkey" PRIMARY KEY ("id")
);

-- A model can have multiple historical price rows but only one active at a time
CREATE UNIQUE INDEX "ocr_model_prices_provider_model_active_unique"
    ON "ocr_model_prices"("provider", "model")
    WHERE "isActive" = true;

CREATE INDEX "ocr_model_prices_provider_idx" ON "ocr_model_prices"("provider");
CREATE INDEX "ocr_model_prices_model_idx" ON "ocr_model_prices"("model");
CREATE INDEX "ocr_model_prices_isActive_idx" ON "ocr_model_prices"("isActive");

-- ---------------------------------------------------------------------------
-- Invoice line snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE "ocr_usage_invoices" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "agencyId" TEXT,
    "userId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "successfulCalls" INTEGER NOT NULL DEFAULT 0,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,
    "totalPromptTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCompletionTokens" BIGINT NOT NULL DEFAULT 0,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "baseCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "markupCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "fixedFeeCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_usage_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ocr_usage_invoices_periodStart_idx" ON "ocr_usage_invoices"("periodStart");
CREATE INDEX "ocr_usage_invoices_periodEnd_idx" ON "ocr_usage_invoices"("periodEnd");
CREATE INDEX "ocr_usage_invoices_clientId_idx" ON "ocr_usage_invoices"("clientId");
CREATE INDEX "ocr_usage_invoices_status_idx" ON "ocr_usage_invoices"("status");

-- ---------------------------------------------------------------------------
-- SystemConfig billing fields
-- ---------------------------------------------------------------------------
ALTER TABLE "system_config"
    ADD COLUMN "ocrBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "ocrBillingCurrency" TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN "ocrBillingUnitTokens" INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN "ocrBillingMarkupPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    ADD COLUMN "ocrBillingFixedFeePerCall" DECIMAL(18,8) NOT NULL DEFAULT 0,
    ADD COLUMN "ocrBillingIncludeFailedCalls" BOOLEAN NOT NULL DEFAULT false;

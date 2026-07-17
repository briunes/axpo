CREATE TABLE IF NOT EXISTS "excel_parser_product_configs" (
  "id" TEXT NOT NULL,
  "scopeType" "BaseValueScope" NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "commodity" TEXT NOT NULL,
  "pricingType" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "singlePeriod" BOOLEAN NOT NULL DEFAULT false,
  "eligibilityMin" DECIMAL(18, 6),
  "eligibilityMax" DECIMAL(18, 6),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "excel_parser_product_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "excel_parser_product_configs_scopeType_sourceLabel_key"
  ON "excel_parser_product_configs"("scopeType", "sourceLabel");

CREATE INDEX IF NOT EXISTS "excel_parser_product_configs_lookup_idx"
  ON "excel_parser_product_configs"("scopeType", "commodity", "pricingType", "enabled", "sortOrder");

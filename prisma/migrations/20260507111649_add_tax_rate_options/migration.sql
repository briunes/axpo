-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "electricityTaxRateOptions" JSONB,
ADD COLUMN     "hydrocarbonTaxRateOptions" JSONB,
ADD COLUMN     "ivaRateOptions" JSONB;

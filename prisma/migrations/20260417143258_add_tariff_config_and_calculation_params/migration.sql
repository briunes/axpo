/*
  Warnings:

  - You are about to drop the column `editableTextBlocks` on the `simulations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "base_value_sets" ADD COLUMN     "isProduction" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "simulations" DROP COLUMN "editableTextBlocks";

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "electricityTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0.051127,
ADD COLUMN     "ivaRate" DECIMAL(65,30) NOT NULL DEFAULT 0.21;

-- CreateTable
CREATE TABLE "agency_tariffs" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "tariffType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_tariffs_agencyId_tariffType_key" ON "agency_tariffs"("agencyId", "tariffType");

-- AddForeignKey
ALTER TABLE "agency_tariffs" ADD CONSTRAINT "agency_tariffs_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

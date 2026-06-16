/*
  Warnings:

  - A unique constraint covering the columns `[referenceNumber]` on the table `simulations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "simulations" ADD COLUMN     "referenceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "simulations_referenceNumber_key" ON "simulations"("referenceNumber");

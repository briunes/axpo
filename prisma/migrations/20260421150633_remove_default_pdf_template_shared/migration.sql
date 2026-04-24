/*
  Warnings:

  - You are about to drop the column `defaultPdfTemplateSharedId` on the `system_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "system_config" DROP COLUMN "defaultPdfTemplateSharedId";

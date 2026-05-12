/*
  Warnings:

  - A unique constraint covering the columns `[magicLinkToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "magicLinkEmailTemplateId" TEXT,
ADD COLUMN     "magicLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "magicLinkTokenValidityMinutes" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "magicLinkToken" TEXT,
ADD COLUMN     "magicLinkTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_magicLinkToken_key" ON "users"("magicLinkToken");

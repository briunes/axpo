/*
  Warnings:

  - A unique constraint covering the columns `[otpSessionToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "otpCodeValidityMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "otpEmailTemplateId" TEXT,
ADD COLUMN     "otpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "otpCode" TEXT,
ADD COLUMN     "otpCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpSecret" TEXT,
ADD COLUMN     "otpSessionToken" TEXT,
ADD COLUMN     "otpSessionTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_otpSessionToken_key" ON "users"("otpSessionToken");

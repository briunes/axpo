/*
  Warnings:

  - A unique constraint covering the columns `[passwordResetToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "passwordResetEmailTemplateId" TEXT,
ADD COLUMN     "passwordResetTokenValidityHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");

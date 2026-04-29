-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "attachmentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "errorStack" TEXT,
ADD COLUMN     "fromEmail" TEXT,
ADD COLUMN     "fromName" TEXT,
ADD COLUMN     "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpResponse" TEXT;

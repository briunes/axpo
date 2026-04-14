-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "smtpFromEmail" TEXT,
ADD COLUMN     "smtpFromName" TEXT DEFAULT 'Axpo Simulator',
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpPort" INTEGER DEFAULT 587,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpUser" TEXT;

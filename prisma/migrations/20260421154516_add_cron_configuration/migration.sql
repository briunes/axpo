-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "cronExpirationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cronExpirationSchedule" TEXT NOT NULL DEFAULT '0 2 * * *',
ADD COLUMN     "cronExpirationTimezone" TEXT NOT NULL DEFAULT 'UTC';

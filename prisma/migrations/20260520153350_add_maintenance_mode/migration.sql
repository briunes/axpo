-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "maintenanceMessage" TEXT,
ADD COLUMN     "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenanceUntil" TIMESTAMP(3);

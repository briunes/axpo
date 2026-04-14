-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('LEAD', 'ACTIVE', 'CONVERTED', 'INACTIVE');

-- AlterTable
ALTER TABLE "clients"
ADD COLUMN "cif"          TEXT,
ADD COLUMN "contactName"  TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "cups"         TEXT,
ADD COLUMN "otherDetails" TEXT,
ADD COLUMN "status"       "ClientStatus" NOT NULL DEFAULT 'LEAD',
ADD COLUMN "tags"         TEXT[] NOT NULL DEFAULT '{}';

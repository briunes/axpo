-- AlterTable
ALTER TABLE "users" ADD COLUMN "setupToken" TEXT UNIQUE,
                    ADD COLUMN "setupTokenExpiresAt" TIMESTAMP(3);

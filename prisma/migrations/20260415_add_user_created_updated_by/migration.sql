-- Add createdByUserId and updatedByUserId to users table for actor tracking
ALTER TABLE "users" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "updatedByUserId" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

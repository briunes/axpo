-- Add user contact/commercial profile fields
ALTER TABLE "users"
ADD COLUMN "mobilePhone" TEXT,
ADD COLUMN "commercialPhone" TEXT,
ADD COLUMN "commercialEmail" TEXT,
ADD COLUMN "otherDetails" TEXT;

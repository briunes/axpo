-- Add address fields to agencies table
ALTER TABLE "agencies" ADD COLUMN "street" TEXT;
ALTER TABLE "agencies" ADD COLUMN "city" TEXT;
ALTER TABLE "agencies" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "agencies" ADD COLUMN "province" TEXT;
ALTER TABLE "agencies" ADD COLUMN "country" TEXT;

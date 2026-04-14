-- Add plaintext PIN fields for backoffice display
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinCurrent" TEXT;
ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "pinSnapshot" TEXT;

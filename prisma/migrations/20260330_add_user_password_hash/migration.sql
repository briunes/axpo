-- Add password hash for internal email+password authentication.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

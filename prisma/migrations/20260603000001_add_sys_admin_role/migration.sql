-- Add SYS_ADMIN value to UserRole enum
-- Safe: uses IF NOT EXISTS so re-running is idempotent
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SYS_ADMIN' BEFORE 'ADMIN';

-- Add per-user max active devices
ALTER TABLE "users"
ADD COLUMN "maxActiveDevices" INTEGER NOT NULL DEFAULT 3;

-- Create user sessions table
CREATE TABLE "user_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionTokenId" TEXT NOT NULL,
  "deviceFingerprint" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "authMethod" TEXT NOT NULL,
  "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logoutAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "terminationReason" TEXT,
  "terminatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadataJson" JSONB,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_sessions_sessionTokenId_key"
ON "user_sessions"("sessionTokenId");

CREATE INDEX "user_sessions_userId_isActive_loginAt_idx"
ON "user_sessions"("userId", "isActive", "loginAt");

CREATE INDEX "user_sessions_isActive_lastActivityAt_idx"
ON "user_sessions"("isActive", "lastActivityAt");

CREATE INDEX "user_sessions_deviceFingerprint_idx"
ON "user_sessions"("deviceFingerprint");

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_terminatedByUserId_fkey"
FOREIGN KEY ("terminatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

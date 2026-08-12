CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kamUserId" TEXT NOT NULL,
    "comments" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notificationSentAt" TIMESTAMP(3),
    "notificationError" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_requests_status_createdAt_idx" ON "access_requests"("status", "createdAt" DESC);
CREATE INDEX "access_requests_email_status_idx" ON "access_requests"("email", "status");
CREATE INDEX "access_requests_agencyId_status_idx" ON "access_requests"("agencyId", "status");
CREATE INDEX "access_requests_kamUserId_status_idx" ON "access_requests"("kamUserId", "status");

ALTER TABLE "access_requests"
ADD CONSTRAINT "access_requests_agencyId_fkey"
FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_requests"
ADD CONSTRAINT "access_requests_kamUserId_fkey"
FOREIGN KEY ("kamUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_requests"
ADD CONSTRAINT "access_requests_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

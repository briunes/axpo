CREATE TYPE "SimulationIssueStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

CREATE TABLE "simulation_issues" (
  "id" TEXT NOT NULL,
  "simulationId" TEXT,
  "simulationReference" TEXT,
  "description" TEXT NOT NULL,
  "status" "SimulationIssueStatus" NOT NULL DEFAULT 'NEW',
  "snapshotFileName" TEXT NOT NULL,
  "snapshotMimeType" TEXT NOT NULL,
  "snapshotFileSize" INTEGER NOT NULL,
  "snapshotFileData" BYTEA NOT NULL,
  "reportedByUserId" TEXT NOT NULL,
  "handledByUserId" TEXT,
  "statusChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "simulation_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "simulation_issue_attachments" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileData" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "simulation_issue_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "simulation_issue_status_changes" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "fromStatus" "SimulationIssueStatus" NOT NULL,
  "toStatus" "SimulationIssueStatus" NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "simulation_issue_status_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "simulation_issues_status_createdAt_idx" ON "simulation_issues"("status", "createdAt" DESC);
CREATE INDEX "simulation_issues_reportedByUserId_createdAt_idx" ON "simulation_issues"("reportedByUserId", "createdAt" DESC);
CREATE INDEX "simulation_issues_simulationId_idx" ON "simulation_issues"("simulationId");
CREATE INDEX "simulation_issue_attachments_issueId_idx" ON "simulation_issue_attachments"("issueId");
CREATE INDEX "simulation_issue_status_changes_issueId_createdAt_idx" ON "simulation_issue_status_changes"("issueId", "createdAt" DESC);
ALTER TABLE "simulation_issues" ADD CONSTRAINT "simulation_issues_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_issues" ADD CONSTRAINT "simulation_issues_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "simulation_issues" ADD CONSTRAINT "simulation_issues_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_issue_attachments" ADD CONSTRAINT "simulation_issue_attachments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "simulation_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_issue_status_changes" ADD CONSTRAINT "simulation_issue_status_changes_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "simulation_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_issue_status_changes" ADD CONSTRAINT "simulation_issue_status_changes_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

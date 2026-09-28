CREATE TYPE "SimulationIssueAppStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
ALTER TABLE "simulation_issues" ADD COLUMN "appStatus" "SimulationIssueAppStatus";
ALTER TABLE "simulation_issue_status_changes"
  ADD COLUMN "fromAppStatus" "SimulationIssueAppStatus",
  ADD COLUMN "toAppStatus" "SimulationIssueAppStatus";

-- Keep previously escalated incidents in the app administrators' workflow,
-- including incidents that have already progressed beyond escalation.
UPDATE "simulation_issues" AS issue
SET "appStatus" = (CASE WHEN issue."status" = 'ESCALATED' THEN 'NEW' ELSE issue."status"::text END)::"SimulationIssueAppStatus",
    "status" = 'ESCALATED'
WHERE issue."status" = 'ESCALATED'
   OR EXISTS (SELECT 1 FROM "simulation_issue_status_changes" AS history
              WHERE history."issueId" = issue."id" AND history."toStatus" = 'ESCALATED');

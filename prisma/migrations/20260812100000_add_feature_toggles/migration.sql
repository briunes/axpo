ALTER TABLE "system_config"
ADD COLUMN "simulationIssuesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "accessRequestsEnabled" BOOLEAN NOT NULL DEFAULT true;

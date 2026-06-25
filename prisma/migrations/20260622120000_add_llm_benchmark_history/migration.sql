CREATE TABLE "llm_benchmark_runs" (
    "id" TEXT NOT NULL,
    "benchmarkRunId" TEXT,
    "providerConfigId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "benchmarkFileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detectionSuccess" BOOLEAN NOT NULL,
    "detectionScore" INTEGER NOT NULL,
    "detectionDurationMs" INTEGER NOT NULL,
    "detectionPromptTokens" INTEGER,
    "detectionCompletionTokens" INTEGER,
    "detectionTotalTokens" INTEGER,
    "detectionCorrectFields" INTEGER NOT NULL,
    "detectionTotalFields" INTEGER NOT NULL,
    "detectionResult" JSONB,
    "detectionFieldScores" JSONB,
    "detectionError" TEXT,
    "extractionSuccess" BOOLEAN NOT NULL,
    "extractionScore" INTEGER NOT NULL,
    "extractionDurationMs" INTEGER NOT NULL,
    "extractionPromptTokens" INTEGER,
    "extractionCompletionTokens" INTEGER,
    "extractionTotalTokens" INTEGER,
    "extractionCorrectFields" INTEGER NOT NULL,
    "extractionTotalFields" INTEGER NOT NULL,
    "extractionResult" JSONB,
    "extractionFieldScores" JSONB,
    "extractionError" TEXT,
    "overallScore" INTEGER NOT NULL,
    "totalDurationMs" INTEGER NOT NULL,
    "totalTokens" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_benchmark_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_benchmark_runs_benchmarkRunId_createdAt_idx" ON "llm_benchmark_runs"("benchmarkRunId", "createdAt" DESC);
CREATE INDEX "llm_benchmark_runs_providerConfigId_createdAt_idx" ON "llm_benchmark_runs"("providerConfigId", "createdAt" DESC);
CREATE INDEX "llm_benchmark_runs_provider_modelName_idx" ON "llm_benchmark_runs"("provider", "modelName");
CREATE INDEX "llm_benchmark_runs_createdAt_idx" ON "llm_benchmark_runs"("createdAt" DESC);

ALTER TABLE "llm_benchmark_runs"
    ADD CONSTRAINT "llm_benchmark_runs_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "llm_benchmark_runs" TO service_role;
  END IF;
END $$;

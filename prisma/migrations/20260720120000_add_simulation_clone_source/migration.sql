ALTER TABLE "simulations"
ADD COLUMN "clonedFromSimulationId" TEXT;

-- Preserve clone ancestry already recorded by the existing clone audit event.
UPDATE "simulations" AS clone
SET "clonedFromSimulationId" = source."id"
FROM "audit_logs" AS audit
JOIN "simulations" AS source
  ON source."id" = audit."metadataJson"->>'sourceSimulationId'
WHERE audit."eventType" = 'SIMULATION_CLONED'
  AND audit."targetType" = 'SIMULATION'
  AND audit."targetId" = clone."id";

CREATE INDEX "simulations_clonedFromSimulationId_idx"
ON "simulations"("clonedFromSimulationId");

ALTER TABLE "simulations"
ADD CONSTRAINT "simulations_clonedFromSimulationId_fkey"
FOREIGN KEY ("clonedFromSimulationId") REFERENCES "simulations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

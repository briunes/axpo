BEGIN;

ALTER TABLE "simulation_issues" ADD COLUMN "incidentNumber" INTEGER;
CREATE SEQUENCE "simulation_issues_incidentNumber_seq" AS INTEGER
  OWNED BY "simulation_issues"."incidentNumber";

-- Give existing incidents stable numbers, oldest first.
WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id")::integer AS number
  FROM "simulation_issues"
)
UPDATE "simulation_issues" AS issue
SET "incidentNumber" = numbered.number
FROM numbered WHERE issue."id" = numbered."id";

SELECT setval('"simulation_issues_incidentNumber_seq"',
  COALESCE(MAX("incidentNumber"), 0) + 1, false) FROM "simulation_issues";

ALTER TABLE "simulation_issues"
  ALTER COLUMN "incidentNumber" SET DEFAULT nextval('"simulation_issues_incidentNumber_seq"'),
  ALTER COLUMN "incidentNumber" SET NOT NULL;
CREATE UNIQUE INDEX "simulation_issues_incidentNumber_key" ON "simulation_issues"("incidentNumber");

-- jsonb_populate_record supplies NULL for omitted fields, so imports must
-- explicitly allocate a number instead of relying on the column default.
-- One atomic operation for each archive, including files and status history.
CREATE OR REPLACE FUNCTION public.axpo_import_simulation_issues(payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb;
  child jsonb;
  inserted_id text;
  imported integer := 0;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(payload) LOOP
    inserted_id := NULL;
    INSERT INTO simulation_issues
      SELECT (jsonb_populate_record(NULL::simulation_issues, (item - 'attachments' - 'statusChanges') || jsonb_build_object('incidentNumber', nextval('"simulation_issues_incidentNumber_seq"')))).*
      ON CONFLICT (id) DO NOTHING RETURNING id INTO inserted_id;
    IF inserted_id IS NULL THEN CONTINUE; END IF;
    FOR child IN SELECT value FROM jsonb_array_elements(item->'attachments') LOOP
      INSERT INTO simulation_issue_attachments
        SELECT (jsonb_populate_record(NULL::simulation_issue_attachments, child || jsonb_build_object('issueId', inserted_id))).*;
    END LOOP;
    FOR child IN SELECT value FROM jsonb_array_elements(item->'statusChanges') LOOP
      INSERT INTO simulation_issue_status_changes
        SELECT (jsonb_populate_record(NULL::simulation_issue_status_changes, child || jsonb_build_object('issueId', inserted_id))).*;
    END LOOP;
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SEQUENCE "simulation_issues_incidentNumber_seq" TO service_role;
  END IF;
END $$;

COMMIT;

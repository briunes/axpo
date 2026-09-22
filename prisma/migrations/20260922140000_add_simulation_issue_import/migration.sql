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
      SELECT (jsonb_populate_record(NULL::simulation_issues, item - 'attachments' - 'statusChanges')).*
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
REVOKE ALL ON FUNCTION public.axpo_import_simulation_issues(jsonb) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_import_simulation_issues(jsonb) TO service_role;
  END IF;
END $$;

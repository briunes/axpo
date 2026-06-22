CREATE OR REPLACE FUNCTION public.axpo_set_base_value_production(
  p_base_value_set_id text,
  p_now timestamp
)
RETURNS TABLE (
  id text,
  "scopeType" "BaseValueScope",
  "agencyId" text,
  name text,
  version integer,
  "isActive" boolean,
  "isProduction" boolean,
  "updatedAt" timestamp
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target_scope_type "BaseValueScope";
  target_agency_id text;
BEGIN
  SELECT
    base_value_sets."scopeType",
    base_value_sets."agencyId"
  INTO target_scope_type, target_agency_id
  FROM public.base_value_sets
  WHERE base_value_sets.id = p_base_value_set_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'base-value-production:' ||
      target_scope_type::text ||
      ':' ||
      COALESCE(target_agency_id, ''),
      0
    )
  );

  UPDATE public.base_value_sets
  SET
    "isProduction" = (base_value_sets.id = p_base_value_set_id),
    "isActive" = (base_value_sets.id = p_base_value_set_id),
    "updatedAt" = p_now
  WHERE
    base_value_sets."scopeType" = target_scope_type
    AND base_value_sets."agencyId" IS NOT DISTINCT FROM target_agency_id
    AND (
      base_value_sets.id = p_base_value_set_id
      OR base_value_sets."isProduction" = true
      OR base_value_sets."isActive" = true
    );

  RETURN QUERY
  SELECT
    base_value_sets.id,
    base_value_sets."scopeType",
    base_value_sets."agencyId",
    base_value_sets.name,
    base_value_sets.version,
    base_value_sets."isActive",
    base_value_sets."isProduction",
    base_value_sets."updatedAt"
  FROM public.base_value_sets
  WHERE base_value_sets.id = p_base_value_set_id;
END;
$$;

REVOKE ALL ON FUNCTION public.axpo_set_base_value_production(text, timestamp) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_set_base_value_production(text, timestamp) TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

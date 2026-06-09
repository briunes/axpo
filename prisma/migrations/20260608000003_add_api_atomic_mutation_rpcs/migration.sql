CREATE OR REPLACE FUNCTION public.axpo_update_agency(
  p_agency_id text,
  p_actor_user_id text,
  p_data jsonb,
  p_tariffs jsonb,
  p_now timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agencies
  SET
    name = CASE WHEN p_data ? 'name' THEN p_data->>'name' ELSE name END,
    street = CASE WHEN p_data ? 'street' THEN p_data->>'street' ELSE street END,
    city = CASE WHEN p_data ? 'city' THEN p_data->>'city' ELSE city END,
    "postalCode" = CASE WHEN p_data ? 'postalCode' THEN p_data->>'postalCode' ELSE "postalCode" END,
    province = CASE WHEN p_data ? 'province' THEN p_data->>'province' ELSE province END,
    country = CASE WHEN p_data ? 'country' THEN p_data->>'country' ELSE country END,
    "isActive" = CASE WHEN p_data ? 'isActive' THEN (p_data->>'isActive')::boolean ELSE "isActive" END,
    "updatedByUserId" = p_actor_user_id,
    "updatedAt" = p_now
  WHERE id = p_agency_id;

  IF p_tariffs IS NOT NULL THEN
    INSERT INTO public.agency_tariffs (
      id, "agencyId", "tariffType", "isEnabled", "createdAt", "updatedAt"
    )
    SELECT
      item->>'id',
      p_agency_id,
      item->>'tariffType',
      (item->>'isEnabled')::boolean,
      p_now,
      p_now
    FROM jsonb_array_elements(p_tariffs) item
    ON CONFLICT ("agencyId", "tariffType") DO UPDATE
    SET
      "isEnabled" = EXCLUDED."isEnabled",
      "updatedAt" = p_now;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.axpo_update_user(
  p_user_id text,
  p_actor_user_id text,
  p_data jsonb,
  p_preferences jsonb,
  p_preference_id text,
  p_now timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    "fullName" = CASE WHEN p_data ? 'fullName' THEN p_data->>'fullName' ELSE "fullName" END,
    email = CASE WHEN p_data ? 'email' THEN p_data->>'email' ELSE email END,
    "mobilePhone" = CASE WHEN p_data ? 'mobilePhone' THEN p_data->>'mobilePhone' ELSE "mobilePhone" END,
    "commercialPhone" = CASE WHEN p_data ? 'commercialPhone' THEN p_data->>'commercialPhone' ELSE "commercialPhone" END,
    "commercialEmail" = CASE WHEN p_data ? 'commercialEmail' THEN p_data->>'commercialEmail' ELSE "commercialEmail" END,
    "otherDetails" = CASE WHEN p_data ? 'otherDetails' THEN p_data->>'otherDetails' ELSE "otherDetails" END,
    "maxActiveDevices" = CASE WHEN p_data ? 'maxActiveDevices' THEN (p_data->>'maxActiveDevices')::integer ELSE "maxActiveDevices" END,
    "isActive" = CASE WHEN p_data ? 'isActive' THEN (p_data->>'isActive')::boolean ELSE "isActive" END,
    role = CASE WHEN p_data ? 'role' THEN (p_data->>'role')::"UserRole" ELSE role END,
    "agencyId" = CASE WHEN p_data ? 'agencyId' THEN p_data->>'agencyId' ELSE "agencyId" END,
    "passwordHash" = CASE WHEN p_data ? 'passwordHash' THEN p_data->>'passwordHash' ELSE "passwordHash" END,
    "updatedByUserId" = p_actor_user_id,
    "updatedAt" = p_now
  WHERE id = p_user_id;

  IF p_preferences IS NOT NULL THEN
    INSERT INTO public.user_preferences (
      id, "userId", language, "dateFormat", "timeFormat", timezone,
      "numberFormat", "itemsPerPage", "createdAt", "updatedAt"
    ) VALUES (
      p_preference_id,
      p_user_id,
      p_preferences->>'language',
      p_preferences->>'dateFormat',
      p_preferences->>'timeFormat',
      p_preferences->>'timezone',
      p_preferences->>'numberFormat',
      CASE WHEN p_preferences ? 'itemsPerPage'
        THEN (p_preferences->>'itemsPerPage')::integer ELSE NULL END,
      p_now,
      p_now
    )
    ON CONFLICT ("userId") DO UPDATE
    SET
      language = CASE WHEN p_preferences ? 'language' THEN p_preferences->>'language' ELSE user_preferences.language END,
      "dateFormat" = CASE WHEN p_preferences ? 'dateFormat' THEN p_preferences->>'dateFormat' ELSE user_preferences."dateFormat" END,
      "timeFormat" = CASE WHEN p_preferences ? 'timeFormat' THEN p_preferences->>'timeFormat' ELSE user_preferences."timeFormat" END,
      timezone = CASE WHEN p_preferences ? 'timezone' THEN p_preferences->>'timezone' ELSE user_preferences.timezone END,
      "numberFormat" = CASE WHEN p_preferences ? 'numberFormat' THEN p_preferences->>'numberFormat' ELSE user_preferences."numberFormat" END,
      "itemsPerPage" = CASE WHEN p_preferences ? 'itemsPerPage'
        THEN (p_preferences->>'itemsPerPage')::integer ELSE user_preferences."itemsPerPage" END,
      "updatedAt" = p_now;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.axpo_replace_base_value_items(
  p_base_value_set_id text,
  p_items jsonb,
  p_now timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.base_value_items
  WHERE "baseValueSetId" = p_base_value_set_id;

  INSERT INTO public.base_value_items (
    id, "baseValueSetId", key, "valueNumeric", "valueText", unit,
    "effectiveFrom", "effectiveTo", "createdAt", "updatedAt"
  )
  SELECT
    item->>'id',
    p_base_value_set_id,
    item->>'key',
    CASE WHEN item->'valueNumeric' IS NULL OR item->'valueNumeric' = 'null'::jsonb
      THEN NULL ELSE (item->>'valueNumeric')::numeric END,
    item->>'valueText',
    item->>'unit',
    CASE WHEN item->'effectiveFrom' IS NULL OR item->'effectiveFrom' = 'null'::jsonb
      THEN NULL ELSE (item->>'effectiveFrom')::timestamp END,
    CASE WHEN item->'effectiveTo' IS NULL OR item->'effectiveTo' = 'null'::jsonb
      THEN NULL ELSE (item->>'effectiveTo')::timestamp END,
    p_now,
    p_now
  FROM jsonb_array_elements(p_items) item;
END;
$$;

CREATE OR REPLACE FUNCTION public.axpo_activate_base_value_set(
  p_base_value_set_id text,
  p_name text,
  p_scope_type "BaseValueScope",
  p_agency_id text,
  p_now timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.base_value_sets
  SET "isActive" = false, "updatedAt" = p_now
  WHERE
    name = p_name
    AND "scopeType" = p_scope_type
    AND "agencyId" IS NOT DISTINCT FROM p_agency_id
    AND "isDeleted" = false;

  UPDATE public.base_value_sets
  SET "isActive" = true, "updatedAt" = p_now
  WHERE id = p_base_value_set_id;
END;
$$;

REVOKE ALL ON FUNCTION public.axpo_update_agency(text, text, jsonb, jsonb, timestamp) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.axpo_update_user(text, text, jsonb, jsonb, text, timestamp) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.axpo_replace_base_value_items(text, jsonb, timestamp) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.axpo_activate_base_value_set(text, text, "BaseValueScope", text, timestamp) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_update_agency(text, text, jsonb, jsonb, timestamp) TO service_role;
    GRANT EXECUTE ON FUNCTION public.axpo_update_user(text, text, jsonb, jsonb, text, timestamp) TO service_role;
    GRANT EXECUTE ON FUNCTION public.axpo_replace_base_value_items(text, jsonb, timestamp) TO service_role;
    GRANT EXECUTE ON FUNCTION public.axpo_activate_base_value_set(text, text, "BaseValueScope", text, timestamp) TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

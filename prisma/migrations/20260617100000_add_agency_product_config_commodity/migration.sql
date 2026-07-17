ALTER TABLE "agency_product_configs"
  ADD COLUMN IF NOT EXISTS "commodity" TEXT NOT NULL DEFAULT 'ELECTRICITY',
  ADD COLUMN IF NOT EXISTS "pricingType" TEXT NOT NULL DEFAULT 'FIXED';

DROP INDEX IF EXISTS "agency_product_configs_agencyId_productKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "agency_product_configs_agencyId_commodity_pricing_product_key"
  ON "agency_product_configs"("agencyId", "commodity", "pricingType", "productKey");

CREATE OR REPLACE FUNCTION public.axpo_update_agency(
  p_agency_id text,
  p_actor_user_id text,
  p_data jsonb,
  p_tariffs jsonb,
  p_products jsonb,
  p_now timestamp without time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.agencies
  SET
    "name" = COALESCE(p_data->>'name', "name"),
    "isTlv" = COALESCE((p_data->>'isTlv')::boolean, "isTlv"),
    "street" = CASE WHEN p_data ? 'street' THEN NULLIF(p_data->>'street', '') ELSE "street" END,
    "city" = CASE WHEN p_data ? 'city' THEN NULLIF(p_data->>'city', '') ELSE "city" END,
    "postalCode" = CASE WHEN p_data ? 'postalCode' THEN NULLIF(p_data->>'postalCode', '') ELSE "postalCode" END,
    "province" = CASE WHEN p_data ? 'province' THEN NULLIF(p_data->>'province', '') ELSE "province" END,
    "country" = CASE WHEN p_data ? 'country' THEN NULLIF(p_data->>'country', '') ELSE "country" END,
    "isActive" = COALESCE((p_data->>'isActive')::boolean, "isActive"),
    "updatedByUserId" = p_actor_user_id,
    "updatedAt" = p_now
  WHERE id = p_agency_id;

  IF p_tariffs IS NOT NULL THEN
    INSERT INTO public.agency_tariffs (id, "agencyId", "tariffType", "isEnabled", "createdAt", "updatedAt")
    SELECT
      COALESCE(t->>'id', gen_random_uuid()::text),
      p_agency_id,
      t->>'tariffType',
      COALESCE((t->>'isEnabled')::boolean, true),
      p_now,
      p_now
    FROM jsonb_array_elements(p_tariffs) AS t
    ON CONFLICT ("agencyId", "tariffType")
    DO UPDATE SET
      "isEnabled" = EXCLUDED."isEnabled",
      "updatedAt" = p_now;
  END IF;

  IF p_products IS NOT NULL THEN
    INSERT INTO public.agency_product_configs (
      id,
      "agencyId",
      "productKey",
      "commodity",
      "pricingType",
      "isEnabled",
      "createdAt",
      "updatedAt"
    )
    SELECT
      COALESCE(p->>'id', gen_random_uuid()::text),
      p_agency_id,
      p->>'productKey',
      COALESCE(p->>'commodity', 'ELECTRICITY'),
      COALESCE(p->>'pricingType', 'FIXED'),
      COALESCE((p->>'isEnabled')::boolean, true),
      p_now,
      p_now
    FROM jsonb_array_elements(p_products) AS p
    ON CONFLICT ("agencyId", "commodity", "pricingType", "productKey")
    DO UPDATE SET
      "isEnabled" = EXCLUDED."isEnabled",
      "updatedAt" = p_now;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.axpo_update_agency(text, text, jsonb, jsonb, jsonb, timestamp without time zone) TO service_role;
NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS "agency_product_configs" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agency_product_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agency_product_configs_agencyId_productKey_key"
  ON "agency_product_configs"("agencyId", "productKey");

ALTER TABLE "agency_product_configs"
  DROP CONSTRAINT IF EXISTS "agency_product_configs_agencyId_fkey";

ALTER TABLE "agency_product_configs"
  ADD CONSTRAINT "agency_product_configs_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.axpo_update_agency(
  p_agency_id text,
  p_actor_user_id text,
  p_data jsonb,
  p_tariffs jsonb,
  p_products jsonb,
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
    "isTlv" = CASE WHEN p_data ? 'isTlv' THEN (p_data->>'isTlv')::boolean ELSE "isTlv" END,
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

  IF p_products IS NOT NULL THEN
    INSERT INTO public.agency_product_configs (
      id, "agencyId", "productKey", "isEnabled", "createdAt", "updatedAt"
    )
    SELECT
      item->>'id',
      p_agency_id,
      item->>'productKey',
      (item->>'isEnabled')::boolean,
      p_now,
      p_now
    FROM jsonb_array_elements(p_products) item
    ON CONFLICT ("agencyId", "productKey") DO UPDATE
    SET
      "isEnabled" = EXCLUDED."isEnabled",
      "updatedAt" = p_now;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.axpo_update_agency(text, text, jsonb, jsonb, jsonb, timestamp) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_update_agency(text, text, jsonb, jsonb, jsonb, timestamp) TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

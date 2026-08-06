CREATE OR REPLACE FUNCTION public.axpo_expire_simulations(
  p_simulation_ids text[]
)
RETURNS TABLE (id text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.simulations
  SET status = 'EXPIRED'::public."SimulationStatus"
  WHERE
    simulations.id = ANY(p_simulation_ids)
    AND simulations.status = 'SHARED'::public."SimulationStatus"
    AND simulations."isDeleted" = false
    AND simulations."expiresAt" <= CURRENT_TIMESTAMP
  RETURNING simulations.id;
$$;

REVOKE ALL ON FUNCTION public.axpo_expire_simulations(text[]) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_expire_simulations(text[]) TO service_role;
  END IF;
END
$$;

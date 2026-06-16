-- Keep this separate from the connection-test migration so deployed databases
-- that already recorded that migration still receive the Data API grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO service_role;

    IF to_regprocedure('public.axpo_test_api_connection()') IS NOT NULL THEN
      GRANT EXECUTE ON FUNCTION public.axpo_test_api_connection() TO service_role;
    END IF;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

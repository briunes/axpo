CREATE OR REPLACE FUNCTION public.axpo_create_user_session(
  p_user_id text,
  p_session_id text,
  p_session_token_id text,
  p_auth_method text,
  p_ip_address text,
  p_user_agent text,
  p_browser text,
  p_os text,
  p_device_fingerprint text,
  p_login_at timestamptz,
  p_max_devices integer,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  kicked_ids text[] := ARRAY[]::text[];
  overflow_count integer;
BEGIN
  -- Prevent concurrent logins from bypassing the per-user device limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));

  UPDATE public.user_sessions
  SET
    "isActive" = false,
    "logoutAt" = p_login_at,
    "terminationReason" = 'REPLACED_BY_NEW_LOGIN',
    "terminatedByUserId" = p_user_id,
    "updatedAt" = p_login_at
  WHERE
    "userId" = p_user_id
    AND "isActive" = true
    AND "deviceFingerprint" = p_device_fingerprint;

  SELECT GREATEST(0, count(*)::integer - GREATEST(1, LEAST(10, p_max_devices)) + 1)
  INTO overflow_count
  FROM public.user_sessions
  WHERE "userId" = p_user_id AND "isActive" = true;

  IF overflow_count > 0 THEN
    SELECT COALESCE(array_agg(id ORDER BY "loginAt" ASC), ARRAY[]::text[])
    INTO kicked_ids
    FROM (
      SELECT id, "loginAt"
      FROM public.user_sessions
      WHERE "userId" = p_user_id AND "isActive" = true
      ORDER BY "loginAt" ASC
      LIMIT overflow_count
    ) oldest;

    UPDATE public.user_sessions
    SET
      "isActive" = false,
      "logoutAt" = p_login_at,
      "terminationReason" = 'DEVICE_LIMIT_AUTO_KICK',
      "terminatedByUserId" = p_user_id,
      "updatedAt" = p_login_at
    WHERE id = ANY(kicked_ids);
  END IF;

  INSERT INTO public.user_sessions (
    id,
    "userId",
    "sessionTokenId",
    "deviceFingerprint",
    "ipAddress",
    "userAgent",
    browser,
    os,
    "authMethod",
    "loginAt",
    "lastActivityAt",
    "isActive",
    "createdAt",
    "updatedAt",
    "metadataJson"
  ) VALUES (
    p_session_id,
    p_user_id,
    p_session_token_id,
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    p_browser,
    p_os,
    p_auth_method,
    p_login_at,
    p_login_at,
    true,
    p_login_at,
    p_login_at,
    p_metadata
  );

  RETURN to_jsonb(kicked_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.axpo_create_user_session(
  text, text, text, text, text, text, text, text, text, timestamptz, integer, jsonb
) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.axpo_create_user_session(
      text, text, text, text, text, text, text, text, text, timestamptz, integer, jsonb
    ) TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

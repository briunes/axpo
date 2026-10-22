-- Only trusted server code may call this; callers first select authorized IDs.
CREATE OR REPLACE FUNCTION public.axpo_simulation_list_versions(p_simulation_ids text[])
RETURNS TABLE ("simulationId" text, "payloadJson" jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $function$
SELECT s.id AS "simulationId", v."payloadJson"
FROM unnest(p_simulation_ids) AS s(id)
CROSS JOIN LATERAL (
  SELECT sv."createdAt", CASE WHEN jsonb_typeof(sv."payloadJson") = 'object' THEN
    COALESCE((SELECT jsonb_object_agg(k, CASE
      WHEN k IN ('electricity', 'gas') THEN jsonb_build_object('clientData', jsonb_build_object('cups', val #> '{clientData,cups}'))
      WHEN k IN ('invoiceData', 'results', 'schemaVersion') THEN 'null'::jsonb
      ELSE val END)
      FROM jsonb_each(sv."payloadJson") AS fields(k,val)
      WHERE k IN ('type','electricity','gas','invoiceData','results','schemaVersion','selectedOffer')), '{}'::jsonb)
    ELSE sv."payloadJson" END AS "payloadJson"
  FROM public.simulation_versions sv
  WHERE sv."simulationId" = s.id
  ORDER BY sv."createdAt" DESC
  LIMIT 5
) v
ORDER BY s.id, v."createdAt" DESC;
$function$;
REVOKE ALL ON FUNCTION public.axpo_simulation_list_versions(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.axpo_simulation_list_versions(text[]) TO service_role;

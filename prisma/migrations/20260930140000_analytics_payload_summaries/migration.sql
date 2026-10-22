-- Server-only compact reads; callers supply IDs already scoped by authorization.
CREATE OR REPLACE FUNCTION public.axpo_analytics_payloads(p_simulation_ids text[])
RETURNS TABLE ("simulationId" text, "payloadJson" jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
SELECT s.id, jsonb_build_object(
  'type', v."payloadJson"->'type',
  'electricity', jsonb_build_object(
    'tarifaAcceso', v."payloadJson" #> '{electricity,tarifaAcceso}',
    'clientData', CASE WHEN v."payloadJson" #> '{electricity,clientData,consumoAnual}' IS NULL
      THEN '{}'::jsonb
      ELSE jsonb_build_object('consumoAnual', v."payloadJson" #> '{electricity,clientData,consumoAnual}') END
  ),
  'gas', jsonb_build_object(
    'tarifaAcceso', v."payloadJson" #> '{gas,tarifaAcceso}'
  ) || CASE WHEN v."payloadJson" #> '{gas,consumo}' IS NULL THEN '{}'::jsonb
    ELSE jsonb_build_object('consumo', v."payloadJson" #> '{gas,consumo}') END
)
FROM unnest(p_simulation_ids) AS s(id)
CROSS JOIN LATERAL (
  SELECT sv."payloadJson" FROM public.simulation_versions sv
  WHERE sv."simulationId" = s.id ORDER BY sv."createdAt" DESC LIMIT 1
) v;
$function$;
REVOKE ALL ON FUNCTION public.axpo_analytics_payloads(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.axpo_analytics_payloads(text[]) TO service_role;

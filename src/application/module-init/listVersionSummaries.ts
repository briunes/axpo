import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";

type Version = { payloadJson: unknown };
type SummaryRow = Version & { simulationId: string };

/** IDs must come from the caller's authorized, filtered simulation query. */
export async function listVersionSummaries(ids: string[]): Promise<Map<string, Version[]>> {
  const summaries = new Map<string, Version[]>();
  if (!ids.length) return summaries;
  let rows: SummaryRow[];
  if (isSupabaseApiMode()) {
    try {
      rows = [];
      // At most 500 rows per RPC, below PostgREST's 1,000-row response cap.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const page = await (prisma as unknown as { $rpc: (name: string, args: object) => Promise<SummaryRow[]> })
          .$rpc("axpo_simulation_list_versions", { p_simulation_ids: ids.slice(offset, offset + 100) });
        rows.push(...page);
      }
    } catch (error) {
      // Allow code rollout before the migration. Never mask other database errors.
      if (!(error instanceof Error) || !error.message.includes("PGRST202")) throw error;
      const simulations = await prisma.simulation.findMany({
        where: { id: { in: ids } },
        select: { id: true, versions: { orderBy: { createdAt: "desc" }, take: 5, select: { payloadJson: true } } },
      });
      return new Map(simulations.map(sim => [sim.id, sim.versions]));
    }
  } else {
    rows = await prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
SELECT s.id AS "simulationId", v."payloadJson"
FROM unnest(ARRAY[${Prisma.join(ids)}]::text[]) AS s(id)
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
ORDER BY s.id, v."createdAt" DESC
    `);
  }
  for (const { simulationId, payloadJson } of rows) {
    const versions = summaries.get(simulationId) ?? [];
    versions.push({ payloadJson });
    summaries.set(simulationId, versions);
  }
  return summaries;
}

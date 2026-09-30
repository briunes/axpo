import { prisma } from "@/infrastructure/database/prisma";

/** Caller must first select authorized simulations. Never cache across users. */
export async function analyticsPayloadSummaries(ids: string[]): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  // Stay below both PostgREST's row limit and practical request sizes.
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    try {
      const rows = await (prisma as unknown as {
        $rpc: (name: string, args: object) => Promise<Array<{ simulationId: string; payloadJson: unknown }>>;
      }).$rpc("axpo_analytics_payloads", { p_simulation_ids: batch });
      for (const row of rows) result.set(row.simulationId, row.payloadJson);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("PGRST202")) throw error;
      // Compatibility during deployment before the function is installed.
      const simulations = await prisma.simulation.findMany({
        where: { id: { in: batch } },
        select: { id: true, versions: { orderBy: { createdAt: "desc" }, take: 1, select: { payloadJson: true } } },
      });
      for (const row of simulations) result.set(row.id, row.versions[0]?.payloadJson);
    }
  }
  return result;
}

import { analyticsPayloadSummaries } from "../payloadSummaries";
import { prisma } from "@/infrastructure/database/prisma";
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { $rpc: jest.fn(), simulation: { findMany: jest.fn() } } }));
const db = prisma as any;
beforeEach(() => jest.resetAllMocks());
it("does not query for an empty cohort", async () => {
  expect(await analyticsPayloadSummaries([])).toEqual(new Map());
  expect(db.$rpc).not.toHaveBeenCalled();
});
it("batches all scoped IDs without exceeding the API row limit", async () => {
  db.$rpc.mockImplementation(async (_: string, { p_simulation_ids }: { p_simulation_ids: string[] }) => p_simulation_ids.map(simulationId => ({ simulationId, payloadJson: { type: "GAS", gas: { consumo: 123 } } })));
  const ids = Array.from({ length: 1201 }, (_, i) => String(i));
  const result = await analyticsPayloadSummaries(ids);
  expect(result.size).toBe(1201);
  expect(db.$rpc.mock.calls.map((call: any) => call[1].p_simulation_ids.length)).toEqual([500, 500, 201]);
  expect(result.get("1200")).toEqual({ type: "GAS", gas: { consumo: 123 } });
});
it("falls back only when the function is missing", async () => {
  db.$rpc.mockRejectedValue(new Error("PGRST202"));
  db.simulation.findMany.mockResolvedValue([{ id: "allowed", versions: [{ payloadJson: { type: "ELECTRICITY" } }] }]);
  expect((await analyticsPayloadSummaries(["allowed"])).get("allowed")).toEqual({ type: "ELECTRICITY" });
  expect(db.simulation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["allowed"] } } }));
});
it("propagates access and database errors", async () => {
  db.$rpc.mockRejectedValue(new Error("permission denied"));
  await expect(analyticsPayloadSummaries(["allowed"])).rejects.toThrow("permission denied");
  expect(db.simulation.findMany).not.toHaveBeenCalled();
});

import { listVersionSummaries } from "../listVersionSummaries";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";

jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { $queryRaw: jest.fn(), $rpc: jest.fn(), simulation: { findMany: jest.fn() } } }));
jest.mock("@/infrastructure/database/databaseMode", () => ({ isSupabaseApiMode: jest.fn() }));
const db = prisma as any;
beforeEach(() => jest.resetAllMocks());

it("only requests authorized IDs and preserves version order in direct mode", async () => {
  db.$queryRaw.mockResolvedValue([{ simulationId: "allowed", payloadJson: { selectedOffer: null } }, { simulationId: "allowed", payloadJson: { type: "GAS" } }]);
  const result = await listVersionSummaries(["allowed"]);
  expect(result.get("allowed")).toEqual([{ payloadJson: { selectedOffer: null } }, { payloadJson: { type: "GAS" } }]);
  expect(db.$queryRaw.mock.calls[0][0].values).toEqual(["allowed"]);
  expect(db.$queryRaw.mock.calls[0][0].sql).toContain("LIMIT 5");
});
it("does no database work for an empty page", async () => {
  expect(await listVersionSummaries([])).toEqual(new Map());
  expect(db.$queryRaw).not.toHaveBeenCalled();
  expect(db.$rpc).not.toHaveBeenCalled();
});
it("batches API requests below the response row limit", async () => {
  (isSupabaseApiMode as jest.Mock).mockReturnValue(true);
  db.$rpc.mockResolvedValue([]);
  const ids = Array.from({ length: 201 }, (_, i) => String(i));
  await listVersionSummaries(ids);
  expect(db.$rpc.mock.calls.map((call: any) => call[1].p_simulation_ids.length)).toEqual([100, 100, 1]);
  expect(db.$rpc.mock.calls.flatMap((call: any) => call[1].p_simulation_ids)).toEqual(ids);
});
it("preserves the old read when the API migration is not installed", async () => {
  (isSupabaseApiMode as jest.Mock).mockReturnValue(true);
  db.$rpc.mockRejectedValue(new Error('PGRST202 function not found'));
  const versions = [{ payloadJson: { results: {}, selectedOffer: null } }];
  db.simulation.findMany.mockResolvedValue([{ id: "allowed", versions }]);
  expect((await listVersionSummaries(["allowed"])).get("allowed")).toEqual(versions);
  expect(db.simulation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["allowed"] } } }));
});
it("does not mask database failures with a fallback", async () => {
  (isSupabaseApiMode as jest.Mock).mockReturnValue(true);
  db.$rpc.mockRejectedValue(new Error('permission denied'));
  await expect(listVersionSummaries(["allowed"])).rejects.toThrow('permission denied');
  expect(db.simulation.findMany).not.toHaveBeenCalled();
});

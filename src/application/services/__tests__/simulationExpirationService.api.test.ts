const findManyMock = jest.fn();
const rpcMock = jest.fn();
const executeRawMock = jest.fn();
const notifyExpiringSoonMock = jest.fn();
const notifyExpiredMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    $rpc: (...args: unknown[]) => rpcMock(...args),
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
  },
}));

jest.mock("@/infrastructure/database/databaseMode", () => ({
  isSupabaseApiMode: () => true,
}));

jest.mock("@/application/services/notificationService", () => ({
  NotificationService: {
    notifySimulationExpiringSoon: (...args: unknown[]) =>
      notifyExpiringSoonMock(...args),
    notifySimulationExpired: (...args: unknown[]) => notifyExpiredMock(...args),
  },
}));

import { SimulationExpirationService } from "../simulationExpirationService";

describe("SimulationExpirationService in Supabase API mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "simulation-1",
          referenceNumber: "00001/2026",
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
          ownerUserId: "user-1",
          client: { name: "Example Client" },
        },
      ]);
    rpcMock.mockResolvedValue([{ id: "simulation-1" }]);
    notifyExpiredMock.mockResolvedValue(undefined);
  });

  it("expires simulations through the Postgres RPC instead of raw SQL", async () => {
    const result = await SimulationExpirationService.expireSimulations();

    expect(rpcMock).toHaveBeenCalledWith("axpo_expire_simulations", {
      p_simulation_ids: ["simulation-1"],
    });
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalExpired: 1,
      expiredIds: ["simulation-1"],
    });
  });
});

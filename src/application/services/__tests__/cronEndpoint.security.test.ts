import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/cron/expire-simulations/route";

const expireSimulationsMock = jest.fn();
const getExpirationStatsMock = jest.fn();

jest.mock("@/application/services/simulationExpirationService", () => ({
  SimulationExpirationService: {
    expireSimulations: (...args: unknown[]) => expireSimulationsMock(...args),
    getExpirationStats: (...args: unknown[]) => getExpirationStatsMock(...args),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    cronLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

describe("expiration cron endpoint security", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(
      new NextRequest("http://localhost/api/cron/expire-simulations"),
    );

    expect(response.status).toBe(401);
    expect(expireSimulationsMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong cron bearer token", async () => {
    process.env.CRON_SECRET = "correct-secret";

    const response = await GET(
      new NextRequest("http://localhost/api/cron/expire-simulations", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(expireSimulationsMock).not.toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/cron/expire-simulations/route";
import { GET as GET_OCR_PROMPT_IMPROVEMENTS } from "../../../../app/api/cron/ocr-prompt-improvements/route";

const expireSimulationsMock = jest.fn();
const getExpirationStatsMock = jest.fn();
const runRecentCorrectionsBatchMock = jest.fn();

jest.mock("@/application/services/simulationExpirationService", () => ({
  SimulationExpirationService: {
    expireSimulations: (...args: unknown[]) => expireSimulationsMock(...args),
    getExpirationStats: (...args: unknown[]) => getExpirationStatsMock(...args),
  },
}));

jest.mock("@/application/services/ocrPromptImprovementService", () => ({
  OcrPromptImprovementService: {
    runRecentCorrectionsBatch: (...args: unknown[]) =>
      runRecentCorrectionsBatchMock(...args),
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

  it("rejects a wrong bearer token for OCR prompt improvements", async () => {
    process.env.CRON_SECRET = "correct-secret";

    const response = await GET_OCR_PROMPT_IMPROVEMENTS(
      new NextRequest("http://localhost/api/cron/ocr-prompt-improvements", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(runRecentCorrectionsBatchMock).not.toHaveBeenCalled();
  });
});

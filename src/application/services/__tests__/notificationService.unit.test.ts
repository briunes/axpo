const notificationFindManyMock = jest.fn();
const notificationUpsertMock = jest.fn();
const notificationReadUpsertMock = jest.fn();
const appErrorLogCountMock = jest.fn();
const appErrorLogFindFirstMock = jest.fn();
const cronLogFindManyMock = jest.fn();
const emailLogCountMock = jest.fn();
const ocrLogCountMock = jest.fn();
const invoiceProviderPromptCountMock = jest.fn();
const systemConfigFindFirstMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    notification: {
      findMany: (...args: unknown[]) => notificationFindManyMock(...args),
      upsert: (...args: unknown[]) => notificationUpsertMock(...args),
    },
    notificationRead: {
      upsert: (...args: unknown[]) => notificationReadUpsertMock(...args),
    },
    appErrorLog: {
      count: (...args: unknown[]) => appErrorLogCountMock(...args),
      findFirst: (...args: unknown[]) => appErrorLogFindFirstMock(...args),
    },
    cronLog: {
      findMany: (...args: unknown[]) => cronLogFindManyMock(...args),
    },
    emailLog: {
      count: (...args: unknown[]) => emailLogCountMock(...args),
    },
    ocrLog: {
      count: (...args: unknown[]) => ocrLogCountMock(...args),
    },
    invoiceProviderPrompt: {
      count: (...args: unknown[]) => invoiceProviderPromptCountMock(...args),
    },
    systemConfig: {
      findFirst: (...args: unknown[]) => systemConfigFindFirstMock(...args),
    },
  },
}));

import { UserRole } from "@/domain/types";
import { NotificationService } from "../notificationService";

describe("NotificationService simulation lifecycle notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationUpsertMock.mockResolvedValue({});
  });

  it("creates an owner notification when a client first views a simulation", async () => {
    await NotificationService.notifySimulationViewed({
      simulationId: "sim-1",
      referenceNumber: "SIM-2026-0001",
      ownerUserId: "owner-1",
      clientName: "ACME Energia",
      viewedAt: new Date("2026-06-26T10:00:00.000Z"),
    });

    expect(notificationUpsertMock).toHaveBeenCalledWith({
      where: { dedupeKey: "user:owner-1:simulation.client_viewed:sim-1" },
      create: expect.objectContaining({
        type: "simulation.client_viewed",
        category: "simulations",
        severity: "SUCCESS",
        title: "Simulation SIM-2026-0001 was viewed by ACME Energia",
        audienceUserId: "owner-1",
        sourceType: "simulation",
        sourceId: "sim-1",
        actionUrl: "/internal/simulations/sim-1",
        metadata: {
          clientName: "ACME Energia",
          viewedAt: "2026-06-26T10:00:00.000Z",
        },
      }),
      update: expect.objectContaining({
        type: "simulation.client_viewed",
        title: "Simulation SIM-2026-0001 was viewed by ACME Energia",
        audienceUserId: "owner-1",
      }),
    });
  });

  it("creates expiring and expired notifications for the simulation owner", async () => {
    await NotificationService.notifySimulationExpiringSoon({
      simulationId: "sim-2",
      referenceNumber: "SIM-2026-0002",
      ownerUserId: "owner-2",
      clientName: "Client SL",
      expiresAt: new Date("2026-06-28T10:00:00.000Z"),
      daysRemaining: 2,
    });
    await NotificationService.notifySimulationExpired({
      simulationId: "sim-2",
      referenceNumber: "SIM-2026-0002",
      ownerUserId: "owner-2",
      clientName: "Client SL",
      expiresAt: new Date("2026-06-28T10:00:00.000Z"),
    });

    expect(notificationUpsertMock).toHaveBeenNthCalledWith(1, {
      where: { dedupeKey: "user:owner-2:simulation.expiring_soon:sim-2" },
      create: expect.objectContaining({
        type: "simulation.expiring_soon",
        severity: "INFO",
        title: "Simulation SIM-2026-0002 for Client SL expires in 2 days",
        audienceUserId: "owner-2",
        expiresAt: new Date("2026-06-28T10:00:00.000Z"),
      }),
      update: expect.objectContaining({
        type: "simulation.expiring_soon",
        title: "Simulation SIM-2026-0002 for Client SL expires in 2 days",
      }),
    });
    expect(notificationUpsertMock).toHaveBeenNthCalledWith(2, {
      where: { dedupeKey: "user:owner-2:simulation.expired:sim-2" },
      create: expect.objectContaining({
        type: "simulation.expired",
        severity: "WARNING",
        title: "Simulation SIM-2026-0002 for Client SL has expired",
        audienceUserId: "owner-2",
      }),
      update: expect.objectContaining({
        type: "simulation.expired",
        title: "Simulation SIM-2026-0002 for Client SL has expired",
      }),
    });
  });
});

describe("NotificationService.markForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NOTIFICATION_SYNC_TTL_MS;
  });

  it("skips stale ids before creating notification read rows", async () => {
    notificationFindManyMock.mockResolvedValue([{ id: "existing-notification" }]);
    notificationReadUpsertMock.mockResolvedValue({});

    const result = await NotificationService.markForUser(
      "user-1",
      UserRole.SYS_ADMIN,
      ["existing-notification", "deleted-notification"],
      "read",
    );

    expect(notificationFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["existing-notification", "deleted-notification"] },
        OR: [{ audienceRole: UserRole.SYS_ADMIN }, { audienceUserId: "user-1" }],
      },
      select: { id: true },
    });
    expect(notificationReadUpsertMock).toHaveBeenCalledTimes(1);
    expect(notificationReadUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          notificationId_userId: {
            notificationId: "existing-notification",
            userId: "user-1",
          },
        },
      }),
    );
    expect(result).toEqual({ updated: 1, skipped: 1 });
  });
});

describe("NotificationService.syncSysAdminNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOTIFICATION_SYNC_TTL_MS = "60000";
    appErrorLogCountMock.mockResolvedValue(0);
    appErrorLogFindFirstMock.mockResolvedValue(null);
    cronLogFindManyMock.mockResolvedValue([]);
    emailLogCountMock.mockResolvedValue(0);
    ocrLogCountMock.mockResolvedValue(0);
    invoiceProviderPromptCountMock.mockResolvedValue(0);
    systemConfigFindFirstMock.mockResolvedValue(null);
    notificationUpsertMock.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_SYNC_TTL_MS;
  });

  it("skips repeated sync work inside the TTL after a successful sync", async () => {
    await NotificationService.syncSysAdminNotifications({ force: true });
    await NotificationService.syncSysAdminNotifications();

    expect(appErrorLogCountMock).toHaveBeenCalledTimes(1);
    expect(appErrorLogFindFirstMock).toHaveBeenCalledTimes(1);
    expect(cronLogFindManyMock).toHaveBeenCalledTimes(1);
    expect(emailLogCountMock).toHaveBeenCalledTimes(1);
    expect(ocrLogCountMock).toHaveBeenCalledTimes(2);
    expect(invoiceProviderPromptCountMock).toHaveBeenCalledTimes(1);
    expect(systemConfigFindFirstMock).toHaveBeenCalledTimes(1);
  });
});

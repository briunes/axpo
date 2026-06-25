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

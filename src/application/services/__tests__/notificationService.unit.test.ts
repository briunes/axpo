const notificationFindManyMock = jest.fn();
const notificationReadUpsertMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    notification: {
      findMany: (...args: unknown[]) => notificationFindManyMock(...args),
    },
    notificationRead: {
      upsert: (...args: unknown[]) => notificationReadUpsertMock(...args),
    },
  },
}));

import { UserRole } from "@/domain/types";
import { NotificationService } from "../notificationService";

describe("NotificationService.markForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

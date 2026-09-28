import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "../../../../app/api/v1/internal/notifications/route";
const authMock = jest.fn();
const listMock = jest.fn();
const markMock = jest.fn();
const syncMock = jest.fn();
jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => authMock(...args) }));
jest.mock("@/application/services/notificationService", () => ({ NotificationService: {
  listForUser: (...args: unknown[]) => listMock(...args), markForUser: (...args: unknown[]) => markMock(...args),
  syncSysAdminNotifications: (...args: unknown[]) => syncMock(...args), isNotificationStoreUnavailable: () => false,
} }));
jest.mock("@/application/lib/appVersionCache", () => ({ warmAppVersionCache: async () => {}, getCachedAppVersion: () => "test" }));

describe("Notification inbox access", () => {
  beforeEach(() => { jest.clearAllMocks(); listMock.mockResolvedValue({ items: [], unreadCount: 0 }); markMock.mockResolvedValue({ updated: 0 }); });
  it.each(["ADMIN", "AGENT", "COMMERCIAL"])("lets %s read and mark their own inbox without syncing system alerts", async (role) => {
    authMock.mockResolvedValue({ userId: "user-1", role });
    expect((await GET(new NextRequest("http://localhost/api/v1/internal/notifications"))).status).toBe(200);
    expect((await POST(new NextRequest("http://localhost/api/v1/internal/notifications", { method: "POST" }))).status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", role }));
    expect(syncMock).not.toHaveBeenCalled();
    expect((await PATCH(new NextRequest("http://localhost/api/v1/internal/notifications", { method: "PATCH", body: JSON.stringify({ ids: ["notification-1"], action: "read" }), headers: { "Content-Type": "application/json" } }))).status).toBe(200);
    expect(markMock).toHaveBeenCalledWith("user-1", role, ["notification-1"], "read");
  });
  it("still syncs system alerts for system administrators", async () => {
    authMock.mockResolvedValue({ userId: "sys-1", role: "SYS_ADMIN" });
    await GET(new NextRequest("http://localhost/api/v1/internal/notifications"));
    expect(syncMock).toHaveBeenCalledTimes(1);
  });
});

import { UserRole } from "@/domain/types";

const rpcMock = jest.fn();
const transactionMock = jest.fn();
const signAccessTokenMock = jest.fn((_payload: unknown) => "access-token");
const logEventMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $rpc: (...args: unknown[]) => rpcMock(...args),
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

jest.mock("@/infrastructure/database/databaseMode", () => ({
  isSupabaseApiMode: () => true,
}));

jest.mock("../jwtService", () => ({
  JwtService: {
    signAccessToken: (payload: unknown) => signAccessTokenMock(payload),
  },
}));

jest.mock("../auditService", () => ({
  AuditService: {
    logEvent: (...args: unknown[]) => logEventMock(...args),
  },
}));

import { SessionService } from "../sessionService";

describe("SessionService in Supabase API mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockResolvedValue(["old-session"]);
    logEventMock.mockResolvedValue(undefined);
  });

  it("creates the session atomically through the database RPC", async () => {
    const result = await SessionService.createSessionForUser(
      {
        id: "user-1",
        role: UserRole.ADMIN,
        agencyId: "agency-1",
        email: "admin@example.com",
        maxActiveDevices: 3,
      },
      "OTP",
      {
        ipAddress: "ip-fingerprint",
        userAgent: "Browser UA",
        browser: "Chrome",
        os: "macOS",
        browserFingerprint: "DEVICE-ABC",
      },
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "axpo_create_user_session",
      expect.objectContaining({
        p_user_id: "user-1",
        p_auth_method: "OTP",
        p_device_fingerprint: "device-abc",
        p_max_devices: 3,
      }),
    );
    expect(transactionMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        token: "access-token",
        autoKickedSessionIds: ["old-session"],
      }),
    );
    expect(signAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "user-1", role: UserRole.ADMIN }),
    );
  });
});

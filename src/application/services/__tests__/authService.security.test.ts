import { AuthService } from "../authService";
import { UserRole } from "@/domain/types";
import { ForbiddenError } from "@/domain/errors/errors";
import { keyedDigest } from "@/application/lib/sensitiveData";

const findUniqueUserMock = jest.fn();
const updateUserMock = jest.fn();
const findSystemConfigMock = jest.fn();
const sendOtpEmailMock = jest.fn();
const createSessionForUserMock = jest.fn();
const verifyPasswordMock = jest.fn();

const rotatePinMock = jest.fn();
const maskPinMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueUserMock(...args),
      update: (...args: unknown[]) => updateUserMock(...args),
    },
    systemConfig: {
      findFirst: (...args: unknown[]) => findSystemConfigMock(...args),
    },
  },
}));

jest.mock("../pinService", () => ({
  PinService: {
    rotate: (...args: unknown[]) => rotatePinMock(...args),
    mask: (...args: unknown[]) => maskPinMock(...args),
  },
}));

jest.mock("../passwordService", () => ({
  PasswordService: {
    verify: (...args: unknown[]) => verifyPasswordMock(...args),
    validatePolicy: jest.fn(),
    hash: jest.fn(),
  },
}));

jest.mock("../emailService", () => ({
  EmailService: {
    sendOtpEmail: (...args: unknown[]) => sendOtpEmailMock(...args),
  },
}));

jest.mock("../sessionService", () => ({
  SessionService: {
    createSessionForUser: (...args: unknown[]) =>
      createSessionForUserMock(...args),
  },
}));

describe("AuthService.rotateUserPin security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECURITY_DATA_KEY = "test-security-data-key";
  });

  it("denies commercial rotating another user PIN", async () => {
    findUniqueUserMock.mockResolvedValue({
      id: "user-target",
      agencyId: "agency-1",
    });

    await expect(
      AuthService.rotateUserPin(
        {
          userId: "commercial-1",
          role: UserRole.COMMERCIAL,
          agencyId: "agency-1",
        },
        "user-target"
      )
    ).rejects.toThrow(ForbiddenError);

    expect(rotatePinMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("stores a keyed OTP hash instead of the plaintext code", async () => {
    findUniqueUserMock.mockResolvedValue({
      id: "user-1",
      agencyId: "agency-1",
      role: UserRole.COMMERCIAL,
      fullName: "Test User",
      email: "test@example.com",
      passwordHash: "password-hash",
      isActive: true,
      maxActiveDevices: 3,
    });
    verifyPasswordMock.mockResolvedValue(true);
    findSystemConfigMock.mockResolvedValue({
      otpEnabled: true,
      otpCodeValidityMinutes: 10,
    });
    updateUserMock.mockResolvedValue(undefined);
    sendOtpEmailMock.mockResolvedValue(undefined);

    const result = await AuthService.loginWithEmailAndPassword(
      "test@example.com",
      "StrongPassword!1",
    );

    const emailedCode = sendOtpEmailMock.mock.calls[0][0].otpCode;
    const storedCode = updateUserMock.mock.calls[0][0].data.otpCode;
    const sessionToken = result.otpSessionToken;

    expect(emailedCode).toMatch(/^\d{6}$/);
    expect(storedCode).not.toBe(emailedCode);
    expect(storedCode).toBe(
      keyedDigest(`${sessionToken}:${emailedCode}`, "auth-otp"),
    );
  });
});

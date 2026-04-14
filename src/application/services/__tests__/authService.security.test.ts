import { AuthService } from "../authService";
import { UserRole } from "@/domain/types";
import { ForbiddenError } from "@/domain/errors/errors";

const findUniqueUserMock = jest.fn();
const updateUserMock = jest.fn();

const rotatePinMock = jest.fn();
const maskPinMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueUserMock(...args),
      update: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}));

jest.mock("../pinService", () => ({
  PinService: {
    rotate: (...args: unknown[]) => rotatePinMock(...args),
    mask: (...args: unknown[]) => maskPinMock(...args),
  },
}));

describe("AuthService.rotateUserPin security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

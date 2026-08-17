import { UserRole } from "@/domain/types";
import {
  canDownloadUserManual,
  resolveUserManual,
} from "../userManuals";

describe("user manuals", () => {
  it("resolves only supported role, language, and format combinations", () => {
    expect(resolveUserManual("AGENT", "es", "pdf")).toEqual({
      role: UserRole.AGENT,
      fileName: "axpo-simulator-agent-manual-es.pdf",
      contentType: "application/pdf",
    });
    expect(resolveUserManual("SYS_ADMIN", "en", "pdf")).toBeNull();
    expect(resolveUserManual("AGENT", "fr", "pdf")).toBeNull();
    expect(resolveUserManual("AGENT", "en", "txt")).toBeNull();
  });

  it("allows normal users to download only their own role manual", () => {
    expect(canDownloadUserManual(UserRole.AGENT, UserRole.AGENT)).toBe(true);
    expect(canDownloadUserManual(UserRole.AGENT, UserRole.ADMIN)).toBe(false);
    expect(canDownloadUserManual(UserRole.ADMIN, UserRole.COMMERCIAL)).toBe(false);
  });

  it("allows SYS_ADMIN to download every role manual", () => {
    expect(canDownloadUserManual(UserRole.SYS_ADMIN, UserRole.ADMIN)).toBe(true);
    expect(canDownloadUserManual(UserRole.SYS_ADMIN, UserRole.AGENT)).toBe(true);
    expect(canDownloadUserManual(UserRole.SYS_ADMIN, UserRole.COMMERCIAL)).toBe(true);
  });
});

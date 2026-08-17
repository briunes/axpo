import { UserRole } from "@/domain/types";

export const USER_MANUAL_ROLES = [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.COMMERCIAL,
] as const;

export type UserManualRole = (typeof USER_MANUAL_ROLES)[number];
export type UserManualLanguage = "en" | "es";
export type UserManualFormat = "pdf" | "docx";

const isManualRole = (value: string): value is UserManualRole =>
  USER_MANUAL_ROLES.includes(value as UserManualRole);

export const resolveUserManual = (
  role: string,
  language: string,
  format: string,
): { role: UserManualRole; fileName: string; contentType: string } | null => {
  if (!isManualRole(role)) return null;
  if (language !== "en" && language !== "es") return null;
  if (format !== "pdf" && format !== "docx") return null;

  const roleSlug = role === UserRole.ADMIN
    ? "administrator"
    : role === UserRole.AGENT
      ? "agent"
      : "commercial";

  return {
    role,
    fileName: `axpo-simulator-${roleSlug}-manual-${language}.${format}`,
    contentType: format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
};

export const canDownloadUserManual = (
  requesterRole: UserRole,
  manualRole: UserManualRole,
): boolean => requesterRole === UserRole.SYS_ADMIN || requesterRole === manualRole;

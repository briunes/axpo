import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { AuthContext } from "./auth";

export const assertRole = (context: AuthContext, allowedRoles: UserRole[]) => {
  if (!allowedRoles.includes(context.role)) {
    throw new ForbiddenError("Insufficient permissions for this operation");
  }
};

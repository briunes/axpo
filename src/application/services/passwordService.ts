import bcrypt from "bcryptjs";
import { ValidationError } from "@/domain/errors/errors";

const SALT_ROUNDS = 12;

// Minimum baseline for strong passwords in internal auth.
const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/;

export class PasswordService {
  static validatePolicy(password: string): void {
    if (!PASSWORD_POLICY_REGEX.test(password)) {
      throw new ValidationError(
        "Password must be 12-128 chars and include uppercase, lowercase, number, and special character",
      );
    }
  }

  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

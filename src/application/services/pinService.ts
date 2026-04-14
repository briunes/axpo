import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { InvalidPINError } from "@/domain/errors/errors";

const PIN_LENGTH = Number(process.env.PIN_LENGTH ?? 4);
const PIN_SALT_ROUNDS = Number(process.env.PIN_SALT_ROUNDS ?? 10);

export class PinService {
  static generate(): string {
    const digits = Array.from({ length: PIN_LENGTH }, () => randomInt(0, 10));
    return digits.join("");
  }

  static validateFormat(pin: string): void {
    const regex = new RegExp(`^\\d{${PIN_LENGTH}}$`);
    if (!regex.test(pin)) {
      throw new InvalidPINError(
        `PIN must contain exactly ${PIN_LENGTH} numeric digits`,
      );
    }
  }

  static async hash(pin: string): Promise<string> {
    this.validateFormat(pin);
    return bcrypt.hash(pin, PIN_SALT_ROUNDS);
  }

  static async verify(pin: string, hash: string): Promise<boolean> {
    this.validateFormat(pin);
    return bcrypt.compare(pin, hash);
  }

  static async rotate(): Promise<{
    pin: string;
    pinHash: string;
    rotatedAt: Date;
  }> {
    const pin = this.generate();
    const pinHash = await this.hash(pin);
    return { pin, pinHash, rotatedAt: new Date() };
  }

  static mask(pin: string): string {
    if (pin.length <= 2) {
      return "*".repeat(pin.length);
    }
    return `${pin.slice(0, 1)}${"*".repeat(pin.length - 2)}${pin.slice(-1)}`;
  }
}

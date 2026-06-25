import crypto from "crypto";

const getSecurityKey = (): string =>
  process.env.SECURITY_DATA_KEY || process.env.JWT_SECRET || "";

export const keyedDigest = (value: string, context: string): string => {
  const key = getSecurityKey();
  if (!key) {
    throw new Error("SECURITY_DATA_KEY or JWT_SECRET must be configured");
  }

  return crypto
    .createHmac("sha256", key)
    .update(`${context}\0${value}`)
    .digest("hex");
};

export const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};

const ENCRYPTED_PREFIX = "enc:v1:";

const encryptionKey = (): Buffer => {
  const key = getSecurityKey();
  if (!key) {
    throw new Error("SECURITY_DATA_KEY or JWT_SECRET must be configured");
  }
  return crypto.createHash("sha256").update(key).digest();
};

export const encryptSensitiveValue = (value: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
};

export const decryptSensitiveValue = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const packed = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64url");
  if (packed.length < 29) {
    throw new Error("Invalid encrypted value");
  }

  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

export const tryDecryptSensitiveValue = (
  value: string | null | undefined,
): string | null => {
  try {
    return decryptSensitiveValue(value);
  } catch {
    return null;
  }
};

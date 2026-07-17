import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  keyedDigest,
  maskEmail,
  tryDecryptSensitiveValue,
} from "../sensitiveData";

describe("sensitive data protection", () => {
  beforeEach(() => {
    process.env.SECURITY_DATA_KEY = "test-security-data-key";
  });

  it("encrypts display-only secrets and supports legacy plaintext reads", () => {
    const encrypted = encryptSensitiveValue("1234");

    expect(encrypted).not.toContain("1234");
    expect(decryptSensitiveValue(encrypted)).toBe("1234");
    expect(decryptSensitiveValue("5678")).toBe("5678");
  });

  it("supports best-effort decrypt for display-only secrets", () => {
    const invalidEncryptedValue = "enc:v1:invalid";

    expect(() => decryptSensitiveValue(invalidEncryptedValue)).toThrow(
      "Invalid encrypted value",
    );
    expect(tryDecryptSensitiveValue(invalidEncryptedValue)).toBeNull();
  });

  it("creates stable keyed digests without retaining the source value", () => {
    const digest = keyedDigest("203.0.113.10", "public-access-ip");

    expect(digest).toHaveLength(64);
    expect(digest).toBe(keyedDigest("203.0.113.10", "public-access-ip"));
    expect(digest).not.toContain("203.0.113.10");
  });

  it("masks email addresses before PIN verification", () => {
    expect(maskEmail("person@example.com")).toBe("pe****@example.com");
  });
});

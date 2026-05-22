"use client";

let browserFingerprintPromise: Promise<string | null> | null = null;

export async function getBrowserFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!browserFingerprintPromise) {
    browserFingerprintPromise = import("@fingerprintjs/fingerprintjs")
      .then(({ default: FingerprintJS }) => FingerprintJS.load())
      .then((agent) => agent.get())
      .then((result) => result.visitorId)
      .catch((error) => {
        console.warn("Failed to load browser fingerprint", error);
        return null;
      });
  }

  return browserFingerprintPromise;
}

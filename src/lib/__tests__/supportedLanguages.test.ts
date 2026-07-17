import {
  normalizeLanguageCode,
  resolveTranslation,
} from "@/lib/supportedLanguages";

describe("supportedLanguages", () => {
  it("normalizes supported language codes", () => {
    expect(normalizeLanguageCode("ES")).toBe("es");
    expect(normalizeLanguageCode(" es ")).toBe("es");
  });

  it("resolves translations case-insensitively before falling back to English", () => {
    const translations = [
      { languageCode: "en", htmlContent: "English PDF" },
      { languageCode: "es", htmlContent: "PDF en Espanol" },
    ];

    expect(resolveTranslation(translations, "ES")?.htmlContent).toBe(
      "PDF en Espanol",
    );
  });
});

/**
 * Supported languages for email, PDF templates, business preferences, and language switchers.
 *
 * To add a new language, simply add a new entry to this array.
 * The `code` must match the language codes used in UserPreferences.language
 * and SystemConfig.defaultLanguage.
 */
export interface SupportedLanguage {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  // { code: "pt", label: "Português", flag: "🇵🇹" },
  // { code: "fr", label: "Français", flag: "🇫🇷" },
];

export const DEFAULT_LANGUAGE = "en";

export function getLanguageOptions(): Array<{ value: string; label: string }> {
  return SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: `${language.flag} ${language.label}`,
  }));
}

export function getSupportedLanguage(
  code: string,
): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code);
}

export function isSupportedLanguage(
  code: string | null | undefined,
): code is string {
  return (
    typeof code === "string" &&
    SUPPORTED_LANGUAGES.some((language) => language.code === code)
  );
}

export function getLanguageLabel(code: string): string {
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ??
    code.toUpperCase()
  );
}

export function getLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((l) => l.code);
}

/**
 * Maps a country name or ISO code to a language code supported by this app.
 * Falls back to DEFAULT_LANGUAGE if the country's language is not supported yet.
 *
 * To add support for a new country/language, add an entry to COUNTRY_LANGUAGE_MAP
 * and make sure the language code is in SUPPORTED_LANGUAGES.
 */
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  // Spain
  es: "es",
  spain: "es",
  españa: "es",
  // France – will activate automatically once "fr" is added to SUPPORTED_LANGUAGES
  fr: "fr",
  france: "fr",
  // Portugal
  pt: "pt",
  portugal: "pt",
  // Germany
  de: "de",
  germany: "de",
  // Italy
  it: "it",
  italy: "it",
};

export function getLanguageFromCountry(
  country: string | null | undefined,
): string {
  if (!country) return DEFAULT_LANGUAGE;
  const mapped = COUNTRY_LANGUAGE_MAP[country.toLowerCase().trim()];
  if (!mapped) return DEFAULT_LANGUAGE;
  // Only return the mapped language if it is actually supported; otherwise fall back
  const isSupported = SUPPORTED_LANGUAGES.some((l) => l.code === mapped);
  return isSupported ? mapped : DEFAULT_LANGUAGE;
}

/**
 * Resolve a template translation by language code, falling back to DEFAULT_LANGUAGE,
 * then the first available translation.
 */
export function resolveTranslation<T extends { languageCode: string }>(
  translations: T[],
  preferredLanguage: string,
): T | undefined {
  if (!translations || translations.length === 0) return undefined;

  // Try exact match
  const exact = translations.find((t) => t.languageCode === preferredLanguage);
  if (exact) return exact;

  // Try default language
  const defaultLang = translations.find(
    (t) => t.languageCode === DEFAULT_LANGUAGE,
  );
  if (defaultLang) return defaultLang;

  // First available
  return translations[0];
}

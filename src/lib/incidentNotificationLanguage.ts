import { DEFAULT_LANGUAGE, isSupportedLanguage } from "./supportedLanguages";
import { isLocale, translations } from "./translations";

const statusKeys = {
  NEW: "statusNew",
  IN_REVIEW: "statusInReview",
  ESCALATED: "statusEscalated",
  RESOLVED: "statusResolved",
  DISMISSED: "statusDismissed",
} as const;

const titleKeys = {
  created: "emailCreated",
  escalated: "notificationEscalatedTitle",
  status: "emailStatus",
  resolved: "emailResolved",
} as const;

export function incidentNotificationLanguage(preference?: string | null, defaultLanguage?: string | null) {
  // Accept regional preferences such as es-ES and es_ES as Spanish.
  const candidates = [preference, defaultLanguage, DEFAULT_LANGUAGE];
  const languageCode = candidates.map((value) => value?.trim().toLowerCase().split(/[-_]/)[0])
    .find((value) => value && isSupportedLanguage(value)) || DEFAULT_LANGUAGE;
  const messages = translations[isLocale(languageCode) ? languageCode : DEFAULT_LANGUAGE].simulationIssues;
  return {
    languageCode,
    status: (value: string) => value in statusKeys
      ? messages[statusKeys[value as keyof typeof statusKeys]] : value,
    title: (kind: keyof typeof titleKeys) => messages[titleKeys[kind]],
  };
}

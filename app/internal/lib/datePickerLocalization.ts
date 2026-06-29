const DATE_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
};

function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getDatePickerLocale(locale: string): string {
  return DATE_LOCALE_MAP[locale] ?? DATE_LOCALE_MAP.en;
}

export function getLocalizedMonthNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(getDatePickerLocale(locale), {
    month: "long",
  });

  return Array.from({ length: 12 }, (_, index) => {
    const label = formatter.format(new Date(2026, index, 1));
    return capitalizeLabel(label);
  });
}

export function getLocalizedDayNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(getDatePickerLocale(locale), {
    weekday: "short",
  });

  return Array.from({ length: 7 }, (_, index) => {
    const label = formatter.format(new Date(2026, 10, 1 + index));
    return capitalizeLabel(label.replace(".", ""));
  });
}

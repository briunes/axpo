import { COUNTRY_ENTRIES, SUBDIVISIONS_BY_COUNTRY } from "./location-data.generated";

export interface CountryOption {
  isoCode: string;
  name: string;
  flag: string;
}

function countryFlag(isoCode: string): string {
  return isoCode
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

export const COUNTRIES: readonly CountryOption[] = COUNTRY_ENTRIES.map(([isoCode, name]) => ({
  isoCode,
  name,
  flag: countryFlag(isoCode),
}));

const countryNames = new Map<string, string>(COUNTRY_ENTRIES);

export function getCountryName(isoCode?: string | null): string | undefined {
  return isoCode ? countryNames.get(isoCode.toUpperCase()) : undefined;
}

export function getSubdivisions(countryCode?: string | null): readonly string[] {
  return countryCode ? (SUBDIVISIONS_BY_COUNTRY[countryCode.toUpperCase()] ?? []) : [];
}

export function getSubdivisionLabel(countryCode: string | null | undefined, value: string): string {
  if (countryCode?.toUpperCase() !== "ES") return value;

  return value.replace(/^(?:Province of|Província de|Provincia (?:da|de))\s+/i, "");
}

export function normalizeSubdivision(countryCode: string, value: string): string {
  const match = getSubdivisions(countryCode).find(
    (subdivision) => subdivision.localeCompare(value, undefined, { sensitivity: "base" }) === 0,
  );
  return match ?? value;
}

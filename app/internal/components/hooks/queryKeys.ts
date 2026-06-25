"use client";

type QueryKeyValue = string | number | boolean | null | undefined;

export type QueryKeyParams = Record<string, QueryKeyValue>;

export function normalizeQueryKeyParams(
  params: QueryKeyParams,
): Record<string, string | number | boolean | null> {
  return Object.keys(params)
    .sort()
    .reduce<Record<string, string | number | boolean | null>>((acc, key) => {
      acc[key] = params[key] ?? null;
      return acc;
    }, {});
}

